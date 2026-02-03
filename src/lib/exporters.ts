import { Bin, Placement } from '../context/LayoutContext';
import { DEFAULT_BIN_COLOR, getColorLabel, normalizeHexColor } from '../utils/colors';

type Rgb = { r: number; g: number; b: number };

type PreparedPlacement = {
  index: number;
  placement: Placement;
  width: number;
  length: number;
  color: string;
  colorLabel: string;
  sku: string;
  name: string;
};

type SkuSummaryRow = {
  sku: string;
  color: string;
  colorLabel: string;
  width: number;
  length: number;
  quantity: number;
};

type PdfDoc = {
  internal: {
    pageSize: {
      getWidth: () => number;
      getHeight: () => number;
    };
  };
  setPage: (pageNumber: number) => void;
  getNumberOfPages: () => number;
  addPage: () => void;
  save: (filename: string) => void;
  setFontSize: (size: number) => void;
  setTextColor: (r: number, g: number, b: number) => void;
  text: (text: string | string[], x: number, y: number, options?: { align?: 'left' | 'center' | 'right' }) => void;
  setFillColor: (r: number, g: number, b: number) => void;
  setDrawColor: (r: number, g: number, b: number) => void;
  setLineWidth: (width: number) => void;
  rect: (x: number, y: number, width: number, height: number, style?: 'S' | 'F' | 'FD') => void;
  line: (x1: number, y1: number, x2: number, y2: number) => void;
  splitTextToSize: (text: string, maxWidth: number) => string[];
};

const PAGE_MARGIN_MM = 14;
const HEADER_TITLE_Y_MM = 18;
const HEADER_META_Y_MM = 24;
const DRAW_TOP_Y_MM = 34;
const DRAW_MAX_HEIGHT_RATIO = 0.45;
const ROW_SPACING_MM = 5;

const TEXT_PRIMARY: [number, number, number] = [15, 23, 42];
const TEXT_MUTED: [number, number, number] = [71, 85, 105];
const BORDER_COLOR: [number, number, number] = [20, 71, 107];
const GRID_COLOR: [number, number, number] = [226, 232, 240];
const PLACEMENT_BORDER: [number, number, number] = [51, 65, 85];

function parseHexToRgb(hexColor: string): Rgb {
  const normalized = normalizeHexColor(hexColor).replace('#', '');
  const fullHex =
    normalized.length === 3 ? normalized.split('').map((segment) => segment + segment).join('') : normalized;
  const safeHex = fullHex.padEnd(6, '0').slice(0, 6);
  return {
    r: Number.parseInt(safeHex.slice(0, 2), 16),
    g: Number.parseInt(safeHex.slice(2, 4), 16),
    b: Number.parseInt(safeHex.slice(4, 6), 16)
  };
}

function isDarkColor(hexColor: string) {
  const { r, g, b } = parseHexToRgb(hexColor);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5;
}

function getPlacementSize(placement: Placement, bins: Bin[]) {
  const bin = bins.find((candidate) => candidate.id === placement.binId);
  const width = placement.width ?? bin?.width;
  const length = placement.length ?? bin?.length;
  if (width == null || length == null) return null;
  return { width, length, name: bin?.name ?? 'Bin' };
}

function formatInches(value: number) {
  if (Number.isInteger(value)) return `${value}`;
  return value.toFixed(2).replace(/\.?0+$/, '');
}

export function buildBinSku(width: number, length: number, color: string) {
  const normalizedColor = normalizeHexColor(color);
  const colorLabel = getColorLabel(normalizedColor);
  if (colorLabel === 'Custom') {
    return `REG-BIN-L${formatInches(length)}xW${formatInches(width)}-Custom-${normalizedColor}`;
  }
  return `REG-BIN-L${formatInches(length)}xW${formatInches(width)}-${colorLabel.replace(/\s+/g, '')}`;
}

function preparePlacements(placements: Placement[], bins: Bin[]): PreparedPlacement[] {
  const prepared: PreparedPlacement[] = [];
  placements.forEach((placement, index) => {
    const size = getPlacementSize(placement, bins);
    if (!size) return;
    const normalizedColor = normalizeHexColor(placement.color ?? DEFAULT_BIN_COLOR);
    const colorLabel = getColorLabel(normalizedColor);
    prepared.push({
      index: index + 1,
      placement,
      width: size.width,
      length: size.length,
      color: normalizedColor,
      colorLabel,
      sku: buildBinSku(size.width, size.length, normalizedColor),
      name: size.name
    });
  });
  return prepared;
}

function buildSkuSummaryRows(preparedPlacements: PreparedPlacement[]): SkuSummaryRow[] {
  const bySku = new Map<string, SkuSummaryRow>();
  preparedPlacements.forEach((item) => {
    const existing = bySku.get(item.sku);
    if (existing) {
      existing.quantity += 1;
      return;
    }
    bySku.set(item.sku, {
      sku: item.sku,
      color: item.color,
      colorLabel: item.colorLabel,
      width: item.width,
      length: item.length,
      quantity: 1
    });
  });
  return Array.from(bySku.values()).sort((a, b) => {
    if (b.quantity !== a.quantity) return b.quantity - a.quantity;
    return a.sku.localeCompare(b.sku);
  });
}

function drawSectionHeader(doc: PdfDoc, title: string, x: number, y: number) {
  doc.setFontSize(11);
  doc.setTextColor(...TEXT_PRIMARY);
  doc.text(title, x, y);
}

function addFooterPageNumbers(doc: PdfDoc, pageWidth: number, pageHeight: number) {
  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(`Page ${page} of ${totalPages}`, pageWidth - PAGE_MARGIN_MM, pageHeight - 6, { align: 'right' });
  }
}

export async function exportLayoutToPdf(
  drawerWidth: number,
  drawerLength: number,
  placements: Placement[],
  bins: Bin[]
) {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as unknown as PdfDoc;

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const skuTextX = PAGE_MARGIN_MM + 7;
  const detailsTextX = pageWidth - PAGE_MARGIN_MM - 50;
  const qtyTextX = pageWidth - PAGE_MARGIN_MM;
  const safeDrawerWidth = Math.max(drawerWidth, 0.001);
  const safeDrawerLength = Math.max(drawerLength, 0.001);

  const preparedPlacements = preparePlacements(placements, bins);
  const summaryRows = buildSkuSummaryRows(preparedPlacements);
  const drawerArea = drawerWidth * drawerLength;
  const usedArea = preparedPlacements.reduce((sum, item) => sum + item.width * item.length, 0);
  const usedPercent = drawerArea > 0 ? Math.min(100, (usedArea / drawerArea) * 100) : 0;

  doc.setFontSize(16);
  doc.setTextColor(...TEXT_PRIMARY);
  doc.text('Bin Layout Plan', PAGE_MARGIN_MM, HEADER_TITLE_Y_MM);
  doc.setFontSize(10);
  doc.setTextColor(...TEXT_MUTED);
  doc.text(
    `Drawer: ${formatInches(drawerWidth)}" x ${formatInches(drawerLength)}"`,
    PAGE_MARGIN_MM,
    HEADER_META_Y_MM
  );

  const maxDrawWidth = pageWidth - PAGE_MARGIN_MM * 2;
  const maxDrawHeight = pageHeight * DRAW_MAX_HEIGHT_RATIO;
  const scale = Math.min(maxDrawWidth / safeDrawerWidth, maxDrawHeight / safeDrawerLength);
  const drawWidth = drawerWidth * scale;
  const drawHeight = drawerLength * scale;
  const drawX = (pageWidth - drawWidth) / 2;
  const drawY = DRAW_TOP_Y_MM;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...BORDER_COLOR);
  doc.setLineWidth(0.5);
  doc.rect(drawX, drawY, drawWidth, drawHeight, 'FD');

  if (scale >= 3) {
    doc.setDrawColor(...GRID_COLOR);
    doc.setLineWidth(0.1);
    for (let x = 1; x < drawerWidth; x += 1) {
      const drawLineX = drawX + x * scale;
      doc.line(drawLineX, drawY, drawLineX, drawY + drawHeight);
    }
    for (let y = 1; y < drawerLength; y += 1) {
      const drawLineY = drawY + y * scale;
      doc.line(drawX, drawLineY, drawX + drawWidth, drawLineY);
    }
    doc.setDrawColor(...BORDER_COLOR);
    doc.setLineWidth(0.5);
    doc.rect(drawX, drawY, drawWidth, drawHeight);
  }

  const drawOrder = [...preparedPlacements].sort(
    (a, b) => b.width * b.length - a.width * a.length || a.index - b.index
  );

  drawOrder.forEach((item) => {
    const x = drawX + item.placement.x * scale;
    const y = drawY + item.placement.y * scale;
    const width = item.width * scale;
    const length = item.length * scale;
    const fill = parseHexToRgb(item.color);
    const darkBackground = isDarkColor(item.color);
    const textColor: [number, number, number] = darkBackground ? [248, 250, 252] : [15, 23, 42];

    doc.setFillColor(fill.r, fill.g, fill.b);
    doc.setDrawColor(...PLACEMENT_BORDER);
    doc.setLineWidth(0.25);
    doc.rect(x, y, width, length, 'FD');

    if (width >= 7 && length >= 6) {
      doc.setTextColor(...textColor);
      doc.setFontSize(12);
      doc.text(`#${item.index}`, x + 1.2, y + 4.2);
    }

    if (width >= 12 && length >= 8) {
      doc.setTextColor(...textColor);
      doc.setFontSize(16);
      doc.text(`${formatInches(item.length)}x${formatInches(item.width)}`, x + width / 2, y + length / 2 + 1, {
        align: 'center'
      });
    }
  });

  let cursorY = drawY + drawHeight + 10;

  drawSectionHeader(doc, 'Layout Summary', PAGE_MARGIN_MM, cursorY);
  cursorY += 6;
  doc.setFontSize(9);
  doc.setTextColor(...TEXT_MUTED);
  doc.text(
    `Bins: ${preparedPlacements.length}   |   Unique SKUs: ${summaryRows.length}   |   Space used: ${usedPercent.toFixed(1)}%`,
    PAGE_MARGIN_MM,
    cursorY
  );
  cursorY += 9;

  drawSectionHeader(doc, 'SKU Summary', PAGE_MARGIN_MM, cursorY);
  cursorY += 6;
  doc.setFontSize(9);
  doc.setTextColor(...TEXT_MUTED);
  doc.text('SKU', skuTextX, cursorY);
  doc.text('DETAILS', detailsTextX, cursorY);
  doc.text('QTY', qtyTextX, cursorY, { align: 'right' });
  cursorY += 4;

  summaryRows.forEach((row) => {
    if (cursorY + ROW_SPACING_MM > pageHeight - PAGE_MARGIN_MM) {
      doc.addPage();
      cursorY = PAGE_MARGIN_MM;
      drawSectionHeader(doc, 'SKU Summary (cont.)', PAGE_MARGIN_MM, cursorY);
      cursorY += 6;
    }

    const swatch = parseHexToRgb(row.color);
    doc.setFillColor(swatch.r, swatch.g, swatch.b);
    doc.setDrawColor(...PLACEMENT_BORDER);
    doc.rect(PAGE_MARGIN_MM, cursorY - 3.3, 4.5, 3.6, 'FD');

    const maxSkuWidth = Math.max(35, detailsTextX - skuTextX - 4);
    const clippedSku = doc.splitTextToSize(row.sku, maxSkuWidth)[0] ?? row.sku;

    doc.setFontSize(8.5);
    doc.setTextColor(...TEXT_PRIMARY);
    doc.text(clippedSku, skuTextX, cursorY);

    doc.setFontSize(8);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(`${row.colorLabel} | L${formatInches(row.length)} x W${formatInches(row.width)}`, detailsTextX, cursorY);

    doc.setFontSize(9);
    doc.setTextColor(...TEXT_PRIMARY);
    doc.text(`${row.quantity}`, qtyTextX, cursorY, { align: 'right' });
    cursorY += ROW_SPACING_MM + 2;
  });

  addFooterPageNumbers(doc, pageWidth, pageHeight);
  doc.save('bin-layout.pdf');
}
