import { useState, useEffect } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Card } from './ui/Card';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useLayout } from '../context/LayoutContext';
import { BinSizePreview } from './BinSizePreview';

export function BinCatalog({ mobile = false }: { mobile?: boolean }) {
  const { bins, addPlacement } = useLayout();
  const availableBuckets = Array.from(new Set(bins.map((bin) => bin.length))).sort((a, b) => a - b);
  const [collapsedBuckets, setCollapsedBuckets] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(availableBuckets.map((bucket, index) => [bucket, index !== 0]))
  );
  const [status, setStatus] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!status) return;
    const id = window.setTimeout(() => setStatus(null), 2500);
    return () => window.clearTimeout(id);
  }, [status]);

  const grouped = bins.reduce<Record<number, typeof bins>>((acc, bin) => {
    if (!acc[bin.length]) {
      acc[bin.length] = [];
    }
    acc[bin.length].push(bin);
    return acc;
  }, {});
  const bucketOrder = Object.keys(grouped).map(Number).sort((a, b) => a - b);
  const isBucketCollapsed = (bucket: number) => collapsedBuckets[bucket] ?? true;
  const toggleBucket = (bucket: number) =>
    setCollapsedBuckets((prev) => ({ ...prev, [bucket]: !(prev[bucket] ?? true) }));

  return (
    <div
      className={`flex flex-col h-full bg-white ${mobile ? 'w-full border-0' : 'w-[320px] border-r border-slate-900/[0.06]'}`}
    >
      {/* Header */}
      <div className={`border-b border-slate-900/[0.06] ${mobile ? 'p-3' : 'p-4'}`}>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Bin Catalog</h2>
        <p className="text-xs text-slate-500">Click or drag to place</p>
        {status && (
          <div
            role="status"
            aria-live="polite"
            className={`mt-2 text-xs px-2 py-1 rounded-md border ${
              status.kind === 'error'
                ? 'bg-red-100 text-red-700 border-red-200'
                : 'bg-emerald-100 text-emerald-700 border-emerald-200'
            }`}
          >
            {status.text}
          </div>
        )}
      </div>

      {/* Catalog List */}
      <div
        className={`flex-1 overflow-y-auto overflow-x-hidden ${mobile ? 'p-3 space-y-6 hide-scrollbar' : 'p-4 space-y-8'}`}
      >
        {bucketOrder.map(
          (bucket) =>
            grouped[bucket].length > 0 && (
              <div key={bucket}>
                <div className={`flex items-center justify-between pr-1 mb-1 ${mobile ? 'sticky top-0 bg-white/95 backdrop-blur py-1 z-10' : ''}`}>
                  <button
                    type="button"
                    data-testid={`catalog-group-toggle-${bucket}`}
                    aria-expanded={!isBucketCollapsed(bucket)}
                    aria-controls={`catalog-group-body-${bucket}`}
                    onClick={() => toggleBucket(bucket)}
                    className={`w-full flex items-center gap-1 text-xs font-semibold text-slate-400 uppercase tracking-wider pl-1 text-left hover:text-slate-600 transition-colors ${
                      mobile ? 'min-h-11' : ''
                    }`}
                  >
                    {isBucketCollapsed(bucket) ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    <span>Length {bucket}"</span>
                  </button>
                </div>
                {!isBucketCollapsed(bucket) && (
                  <div
                    id={`catalog-group-body-${bucket}`}
                    data-testid={`catalog-group-body-${bucket}`}
                    className={`grid gap-3 ${mobile ? 'grid-cols-2' : 'grid-cols-1 md:grid-cols-2'}`}
                  >
                    {grouped[bucket].map((bin) => (
                      <DraggableBinCard
                        key={bin.id}
                        bin={bin}
                        onClick={() => {
                          const result = addPlacement(bin.id);
                          if (result.status === 'blocked') {
                            setStatus({ kind: 'error', text: 'No room for that bin.' });
                            return;
                          }
                          if (result.status === 'autofit') {
                            setStatus({ kind: 'info', text: 'Placed in nearest available spot.' });
                          }
                        }}
                        mobile={mobile}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
        )}
      </div>
    </div>
  );
}

function DraggableBinCard({
  bin,
  onClick,
  mobile
}: {
  bin: ReturnType<typeof useLayout>['bins'][number];
  onClick: () => void;
  mobile: boolean;
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `bin-${bin.id}`,
    data: { type: 'bin', binId: bin.id }
  });

  return (
    <Card
      data-testid="bin-card"
      aria-label={`Add ${bin.name}`}
      role="button"
      tabIndex={0}
      className={`group cursor-grab active:cursor-grabbing border-slate-200 hover:border-[#14476B]/30 w-full ${
        mobile ? 'min-h-24' : ''
      }`}
      noPadding
      hoverable
      ref={setNodeRef}
      style={{ opacity: 1 }}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onClick();
      }}
      {...listeners}
      {...attributes}
    >
      <div className={`${mobile ? 'p-3' : 'p-4'} flex items-center justify-center`}>
        <BinSizePreview width={bin.width} length={bin.length} size="catalog" />
      </div>
    </Card>
  );
}
