import { useMemo, useState, useEffect } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { Button } from './ui/Button';
import { Trash2, AlertCircle } from 'lucide-react';
import { useLayout } from '../context/LayoutContext';
import { DEFAULT_BIN_COLOR, getColorLabel, normalizeHexColor } from '../utils/colors';
import { BinSizePreview } from './BinSizePreview';
import { buildEtsyCartUrl } from '../lib/etsy';

export function SummaryPanel() {
  const {
    placements,
    bins,
    layoutTitle,
    drawerWidth,
    drawerLength,
    setDrawerSize,
    removePlacement,
    openPlacementEditor,
    spaceUsedPercent
  } = useLayout();

  const drawerArea = drawerWidth * drawerLength;
  const [status, setStatus] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);
  useEffect(() => {
    if (!status) return;
    const id = window.setTimeout(() => setStatus(null), 2500);
    return () => window.clearTimeout(id);
  }, [status]);

  const uniquePlacements = useMemo(() => {
    const seen = new Map<string, typeof placements[number]>();
    placements.forEach((placement) => {
      if (!seen.has(placement.id)) {
        seen.set(placement.id, placement);
      }
    });
    return Array.from(seen.values());
  }, [placements]);

  const placementGroups = useMemo(() => {
    const groups = new Map<
      string,
      {
        placements: typeof placements;
        width: number;
        length: number;
        color: string;
      }
    >();

    uniquePlacements.forEach((placement) => {
      const bin = bins.find((b) => b.id === placement.binId);
      const width = placement.width ?? bin?.width;
      const length = placement.length ?? bin?.length;
      if (width == null || length == null) return;
      const color = normalizeHexColor(placement.color ?? DEFAULT_BIN_COLOR);
      const key = `${width}x${length}-${color}`;
      const existing = groups.get(key);
      if (existing) {
        existing.placements.push(placement);
      } else {
        groups.set(key, {
          placements: [placement],
          width,
          length,
          color
        });
      }
    });

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        label: `${group.width}x${group.length} Bin`
      }))
      .sort((a, b) => b.placements.length - a.placements.length);
  }, [uniquePlacements, bins]);

  const invalidCount = useMemo(() => {
    const invalid = new Set<string>();
    const sized = uniquePlacements
      .map((placement) => {
        const bin = bins.find((b) => b.id === placement.binId);
        const width = placement.width ?? bin?.width;
        const length = placement.length ?? bin?.length;
        if (width == null || length == null) return null;
        return { placement, width, length };
      })
      .filter(Boolean) as Array<{ placement: typeof placements[number]; width: number; length: number }>;

    sized.forEach(({ placement, width, length }) => {
      if (
        placement.x < 0 ||
        placement.y < 0 ||
        placement.x + width > drawerWidth ||
        placement.y + length > drawerLength
      ) {
        invalid.add(placement.id);
      }
    });

    for (let i = 0; i < sized.length; i += 1) {
      for (let j = i + 1; j < sized.length; j += 1) {
        const a = sized[i];
        const b = sized[j];
        const overlap =
          a.placement.x < b.placement.x + b.width &&
          a.placement.x + a.width > b.placement.x &&
          a.placement.y < b.placement.y + b.length &&
          a.placement.y + a.length > b.placement.y;
        if (overlap) {
          invalid.add(a.placement.id);
          invalid.add(b.placement.id);
        }
      }
    }

    return invalid.size;
  }, [uniquePlacements, bins, drawerWidth, drawerLength]);

  const etsyCartItems = useMemo(
    () =>
      placementGroups.map((group) => ({
        sku: buildPlacedItemSku(group.width, group.length, group.color),
        quantity: group.placements.length
      })),
    [placementGroups]
  );

  return (
    <div className="w-[320px] bg-white border-l border-slate-900/[0.06] flex flex-col h-full">
      <div className="p-6 border-b border-slate-900/[0.06] space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Drawer Settings
        </h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Length (in)</label>
            <input
              type="number"
              min={6}
              step={0.25}
              aria-label="Drawer length"
              data-testid="drawer-length-input"
              value={drawerLength}
              onChange={(e) => setDrawerSize(drawerWidth, Number(e.target.value) || drawerLength)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-[#0B0B0C] focus:outline-none focus:ring-2 focus:ring-[#14476B]/20"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Width (in)</label>
            <input
              type="number"
              min={6}
              step={0.25}
              aria-label="Drawer width"
              data-testid="drawer-width-input"
              value={drawerWidth}
              onChange={(e) => setDrawerSize(Number(e.target.value) || drawerWidth, drawerLength)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-[#0B0B0C] focus:outline-none focus:ring-2 focus:ring-[#14476B]/20"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Space Used</span>
            <span className="font-medium text-[#14476B]">{spaceUsedPercent.toFixed(0)}%</span>
          </div>
          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-[#14476B]" style={{ width: `${spaceUsedPercent}%` }} />
          </div>
          <p className="text-xs text-slate-400 flex items-center gap-1 mt-2">
            <AlertCircle className="h-3 w-3" />
            {uniquePlacements.length} bins placed · Drawer area {drawerArea.toFixed(0)} in²
          </p>
          <p
            className={`text-xs flex items-center gap-1 ${
              invalidCount === 0 ? 'text-emerald-600' : 'text-amber-600'
            }`}
          >
            <AlertCircle className="h-3 w-3" />
            {invalidCount === 0
              ? 'All bins safely placed.'
              : `${invalidCount} bin${invalidCount === 1 ? '' : 's'} need attention.`}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4">
          Placed Items
        </h3>
        <div className="space-y-3">
          {placementGroups.length === 0 && (
            <p className="text-sm text-slate-400">No bins placed yet.</p>
          )}
          {placementGroups.map((group) => {
            return (
              <div
                key={`${group.label}-${group.width}-${group.length}-${group.color}`}
                data-testid="placed-item-group"
                className="flex items-center justify-between group py-2 border-b border-slate-50 last:border-0 cursor-pointer"
                onClick={(event: ReactMouseEvent<HTMLDivElement>) =>
                  openPlacementEditor(
                    group.placements.map((placement) => placement.id),
                    event.clientX,
                    event.clientY
                  )}
              >
                <div className="flex items-center gap-3">
                  <div className="h-14 w-14 flex items-center justify-center">
                    <BinSizePreview
                      dataTestId="placed-item-preview"
                      width={group.width}
                      length={group.length}
                      color={group.color}
                      size="compact"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#0B0B0C]">
                      {buildPlacedItemSku(group.width, group.length, group.color)}
                    </p>
                    <p className="text-xs text-slate-500">
                      Color: {getColorLabel(group.color)} · Amount: {group.placements.length}
                    </p>
                  </div>
                </div>
                <button
                  aria-label="Delete bin"
                  className="text-slate-300 hover:text-red-500 transition-colors"
                  onClick={(event) => {
                    event.stopPropagation();
                    removePlacement(group.placements[0].id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-6 bg-slate-50 border-t border-slate-900/[0.06] space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="secondary"
            size="sm"
            className="w-full text-xs"
            onClick={async () => {
              const { exportLayoutToPdf } = await import('../lib/exporters');
              return exportLayoutToPdf(drawerWidth, drawerLength, placements, bins, layoutTitle);
            }}
          >
            Export PDF
          </Button>
          {/* <Button
            variant="secondary"
            size="sm"
            className="w-full text-xs"
            onClick={() => {
              const state = exportState();
              const blob = new Blob([JSON.stringify(state, null, 2)], {
                type: 'application/json'
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'bin-layout.json';
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Export JSON
          </Button> */}
          {/* <Button
            variant="secondary"
            size="sm"
            className="w-full text-xs"
            onClick={async () => {
              try {
                const state = exportState();
                const encoded = encodeURIComponent(btoa(JSON.stringify(state)));
                const link = `${window.location.origin}${window.location.pathname}?layout=${encoded}`;
                if (navigator.clipboard?.writeText) {
                  await navigator.clipboard.writeText(link);
                } else {
                  const ta = document.createElement('textarea');
                  ta.value = link;
                  document.body.appendChild(ta);
                  ta.select();
                  document.execCommand('copy');
                  document.body.removeChild(ta);
                }
                setStatus({ kind: 'info', text: 'Link copied to clipboard' });
              } catch (err) {
                setStatus({ kind: 'error', text: 'Failed to copy link' });
              }
            }}
          >
            Copy Link
          </Button> */}
          <Button
            variant="secondary"
            size="sm"
            className="w-full text-xs"
            onClick={() => {
              const cart = buildEtsyCartUrl(etsyCartItems);
              if (cart.missingListingId) {
                setStatus({ kind: 'error', text: 'Set ETSY_LISTING_ID in src/config/etsy.ts' });
                return;
              }
              if (cart.missingSkus.length > 0) {
                setStatus({
                  kind: 'error',
                  text:
                    cart.missingSkus.length === 1
                      ? `Missing Etsy variation mapping for ${cart.missingSkus[0]}`
                      : `Missing Etsy variation mappings for ${cart.missingSkus.length} SKUs`
                });
                return;
              }
              if (!cart.url) {
                setStatus({ kind: 'error', text: 'No items to build Etsy cart link' });
                return;
              }
              window.open(cart.url, '_blank', 'noopener,noreferrer');
              setStatus({ kind: 'info', text: 'Opened Etsy cart link' });
            }}
            disabled={etsyCartItems.length === 0}
          >
            Open Etsy Cart
          </Button>
        </div>

        {/* <input
          id="layout-import"
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            file.text().then((text) => {
              try {
                const data = JSON.parse(text);
                const ok = importState(data);
                setStatus(ok ? { kind: 'info', text: 'Layout imported' } : { kind: 'error', text: 'Invalid layout file' });
              } catch (err) {
                setStatus({ kind: 'error', text: 'Import failed: bad JSON' });
              }
            });
            e.target.value = '';
          }}
        /> */}
        {/* <Button
          variant="outline"
          size="sm"
          className="w-full text-xs"
          onClick={() => document.getElementById('layout-import')?.click()}
        >
          Import JSON
        </Button> */}

        {status && (
          <div
            className={`text-xs text-center px-3 py-2 rounded-md ${
              status.kind === 'error'
                ? 'bg-red-100 text-red-700 border border-red-200'
                : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
            }`}
          >
            {status.text}
          </div>
        )}
      </div>
    </div>
  );
}

function buildPlacedItemSku(width: number, length: number, color: string) {
  const normalized = normalizeHexColor(color);
  const colorLabel = getColorLabel(normalized);
  if (colorLabel === 'Custom') {
    return `REG-BIN-${length}x${width}-Custom-${normalized}`;
  }
  return `REG-BIN-${length}x${width}-${colorLabel.replace(/\s+/g, '')}`;
}
