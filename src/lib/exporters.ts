import { Bin, Placement } from '../context/LayoutContext';

export async function exportLayoutToPdf(
  drawerWidth: number,
  drawerLength: number,
  placements: Placement[],
  bins: Bin[]
) {
  const { default: jsPDF } = await import('jspdf');

  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text('Bin Layout Plan', 14, 18);
  doc.setFontSize(11);
  doc.text(`Drawer: ${drawerWidth}" x ${drawerLength}"`, 14, 28);

  // Layout drawing
  const marginX = 14;
  const marginY = 44;
  const maxDrawWidth = 120;
  const maxDrawHeight = 100;
  const scale = Math.min(maxDrawWidth / drawerWidth, maxDrawHeight / drawerLength);

  doc.setDrawColor(20, 71, 107);
  doc.rect(marginX, marginY, drawerWidth * scale, drawerLength * scale);
  doc.setFontSize(8);
  doc.text(`Scale 1" = ${(1 * scale).toFixed(2)}pt`, marginX, marginY - 4);

  const getPlacementSize = (placement: Placement) => {
    const bin = bins.find((b) => b.id === placement.binId);
    const width = placement.width ?? bin?.width;
    const length = placement.length ?? bin?.length;
    if (width == null || length == null) return null;
    return { width, length, name: bin?.name ?? 'Bin' };
  };

  placements.forEach((p) => {
    const size = getPlacementSize(p);
    if (!size) return;
    const x = marginX + p.x * scale;
    const y = marginY + p.y * scale;
    doc.setFillColor(244, 246, 248);
    doc.rect(x, y, size.width * scale, size.length * scale, 'FD');
    doc.setTextColor(80, 90, 104);
    doc.setFontSize(7);
    doc.text(`${size.width}x${size.length}`, x + 2, y + 6);
  });

  // Item list
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text('Items:', marginX, marginY + maxDrawHeight + 12);
  const rows = placements
    .map((p) => {
      const size = getPlacementSize(p);
      if (!size) return null;
      return `${size.name} — ${size.width}x${size.length} at (${p.x}", ${p.y}")`;
    })
    .filter(Boolean) as string[];

  rows.forEach((row, i) => {
    const y = marginY + maxDrawHeight + 20 + i * 6;
    doc.text(row, marginX + 2, y);
  });

  // Legend
  const legendY = marginY + maxDrawHeight + 20 + rows.length * 6 + 6;
  doc.setFontSize(9);
  doc.text('Legend:', marginX, legendY);
  doc.setFontSize(8);
  doc.setTextColor(80, 90, 104);
  doc.text('Light fill: bins placed', marginX + 2, legendY + 6);
  doc.text('Dark outline: drawer boundary', marginX + 2, legendY + 12);

  doc.save('bin-layout.pdf');
}
