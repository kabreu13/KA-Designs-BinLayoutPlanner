import { useMemo, useState, useEffect } from 'react';
import { Button } from './ui/Button';
import { Trash2, AlertCircle } from 'lucide-react';
import { useLayout } from '../context/LayoutContext';

export function SummaryPanel() {
  const {
    placements,
    bins,
    drawerWidth,
    drawerLength,
    setDrawerSize,
    removePlacement,
    exportState,
    importState,
    spaceUsedPercent
  } = useLayout();

  const drawerArea = drawerWidth * drawerLength;
  const [status, setStatus] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);
  useEffect(() => {
    if (!status) return;
    const id = window.setTimeout(() => setStatus(null), 2500);
    return () => window.clearTimeout(id);
  }, [status]);

  const placedWithMeta = useMemo(
    () =>
      placements
        .map((p) => ({ placement: p, bin: bins.find((b) => b.id === p.binId) }))
        .filter((item) => Boolean(item.bin)) as { placement: typeof placements[number]; bin: typeof bins[number] }[],
    [placements, bins]
  );

  return (
    <div className="w-[320px] bg-white border-l border-slate-900/[0.06] flex flex-col h-full">
      <div className="p-6 border-b border-slate-900/[0.06] space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Drawer Settings
        </h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Width (in)</label>
            <input
              type="number"
              min={6}
              step={0.25}
              value={drawerWidth}
              onChange={(e) => setDrawerSize(Number(e.target.value) || drawerWidth, drawerLength)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-[#0B0B0C] focus:outline-none focus:ring-2 focus:ring-[#14476B]/20"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Length (in)</label>
            <input
              type="number"
              min={6}
              step={0.25}
              value={drawerLength}
              onChange={(e) => setDrawerSize(drawerWidth, Number(e.target.value) || drawerLength)}
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
            {placedWithMeta.length} bins placed · Drawer area {drawerArea.toFixed(0)} in²
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4">
          Placed Items
        </h3>
        <div className="space-y-3">
          {placedWithMeta.length === 0 && (
            <p className="text-sm text-slate-400">No bins placed yet.</p>
          )}
          {placedWithMeta.map(({ placement, bin }) => (
            <div
              key={placement.id}
              className="flex items-center justify-between group py-2 border-b border-slate-50 last:border-0"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 bg-slate-100 border border-slate-200 text-[10px] text-slate-500 flex items-center justify-center">
                  {bin.width}x{bin.length}
                </div>
                <div>
                  <p className="text-sm font-medium text-[#0B0B0C]">{bin.name}</p>
                </div>
              </div>
              <button
                className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                onClick={() => removePlacement(placement.id)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="p-6 bg-slate-50 border-t border-slate-900/[0.06] space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Button
            variant="secondary"
            size="sm"
            className="w-full text-xs"
            onClick={async () => {
              const { exportLayoutToPdf } = await import('../lib/exporters');
              return exportLayoutToPdf(drawerWidth, drawerLength, placements, bins);
            }}
          >
            Export PDF
          </Button>
          <Button
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
          </Button>
          <Button
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
                setStatus({ kind: 'info', text: 'Share link copied to clipboard' });
              } catch (err) {
                setStatus({ kind: 'error', text: 'Failed to copy share link' });
              }
            }}
          >
            Copy Share Link
          </Button>
        </div>

        <input
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
        />
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs"
          onClick={() => document.getElementById('layout-import')?.click()}
        >
          Import JSON
        </Button>

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
