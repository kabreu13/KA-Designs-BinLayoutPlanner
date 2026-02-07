import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Card } from './ui/Card';
import { ChevronDown, ChevronRight, GripVertical } from 'lucide-react';
import { useLayout } from '../context/LayoutContext';
import { BinSizePreview } from './BinSizePreview';

export function BinCatalog({ mobile = false }: { mobile?: boolean }) {
  const { bins, addPlacement } = useLayout();
  const availableBuckets = Array.from(new Set(bins.map((bin) => bin.length))).sort((a, b) => a - b);
  const [collapsedBuckets, setCollapsedBuckets] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(availableBuckets.map((bucket, index) => [bucket, index !== 0]))
  );
  const dispatchCanvasAlert = (detail: { type: 'info' | 'error'; message: string }) => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('canvas-alert', { detail }));
  };

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
  const allCollapsed = bucketOrder.length > 0 && bucketOrder.every((bucket) => isBucketCollapsed(bucket));
  const allExpanded = bucketOrder.length > 0 && bucketOrder.every((bucket) => !isBucketCollapsed(bucket));
  const expandAll = () =>
    setCollapsedBuckets(Object.fromEntries(bucketOrder.map((bucket) => [bucket, false])));
  const collapseAll = () =>
    setCollapsedBuckets(Object.fromEntries(bucketOrder.map((bucket) => [bucket, true])));

  return (
    <div
      className={`flex flex-col h-full bg-white ${mobile ? 'w-full border-0' : 'w-[320px] border-r border-slate-900/[0.06]'}`}
    >
      {/* Header */}
      <div className={`border-b border-slate-900/[0.06] ${mobile ? 'p-3' : 'p-4'}`}>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Bin Catalog</h2>
        <p className="text-xs text-slate-500">Click or drag to place</p>
        {bucketOrder.length > 0 && (
          <div className="mt-2 flex items-center justify-between">
            <button
              type="button"
              data-testid="catalog-toggle-all"
              onClick={() => {
                if (allExpanded) collapseAll();
                else expandAll();
              }}
              className="text-xs font-semibold uppercase tracking-wide text-[#14476B] hover:text-[#1a5a8a]"
            >
              {allExpanded ? 'Collapse All' : 'Expand All'}
            </button>
            <div />
          </div>
        )}
      </div>

      {/* Catalog List */}
      <div
        className={`relative flex-1 overflow-y-auto overflow-x-hidden ${mobile ? 'p-3 space-y-6 hide-scrollbar' : 'p-4 space-y-8'}`}
      >
        {allCollapsed && (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-xs text-slate-500 flex flex-col gap-2">
            <span className="font-semibold uppercase tracking-wide text-slate-400">No Bins Showing</span>
            <span>Expand a length to see available bin sizes.</span>
            <button
              type="button"
              onClick={expandAll}
              className="self-start text-xs font-semibold uppercase tracking-wide text-[#14476B] hover:text-[#1a5a8a]"
            >
              Expand All Lengths
            </button>
          </div>
        )}
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
                    <span>
                      Length {bucket}" ({grouped[bucket].length})
                    </span>
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
                            dispatchCanvasAlert({ type: 'error', message: 'No room for that bin.' });
                            return;
                          }
                          if (result.status === 'autofit') {
                            dispatchCanvasAlert({ type: 'info', message: 'Placed in nearest available spot.' });
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
        {mobile && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white via-white/70 to-transparent" />
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
      title="Drag or click to place"
      className={`group relative cursor-grab active:cursor-grabbing border-slate-200 hover:border-[#14476B]/30 w-full focus-visible:ring-2 focus-visible:ring-[#14476B]/30 ${
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
      <div
        className={`pointer-events-none absolute right-2 top-2 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 ${
          mobile ? 'opacity-70' : 'opacity-0 group-hover:opacity-70 group-focus-visible:opacity-70'
        }`}
      >
        <GripVertical className="h-3 w-3" />
        <span className="hidden sm:inline">Drag</span>
      </div>
    </Card>
  );
}
