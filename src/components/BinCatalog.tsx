import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Input } from './ui/Input';
import { Card } from './ui/Card';
import { Search, Star } from 'lucide-react';
import { useLayout } from '../context/LayoutContext';

export function BinCatalog() {
  const { bins, binUsage, addPlacement } = useLayout();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'fav'>('all');

  const sourceBins =
    activeTab === 'fav'
      ? bins
          .filter((bin) => (binUsage[bin.id] ?? 0) > 0)
          .sort((a, b) => (binUsage[b.id] ?? 0) - (binUsage[a.id] ?? 0))
      : bins;

  const filteredBins = sourceBins.filter((bin) =>
    bin.name.toLowerCase().includes(search.toLowerCase())
  );

  const bucketForLength = (Length: number) => {
    if (Length <= 2) return 2;
    if (Length <= 4) return 4;
    if (Length <= 6) return 6;
    return 8; // 8"+ bucket
  };

  const grouped: Record<number, typeof filteredBins> = { 2: [], 4: [], 6: [], 8: [] };
  filteredBins.forEach((bin) => {
    const bucket = bucketForLength(bin.length);
    grouped[bucket] = [...grouped[bucket], bin];
  });
  const bucketOrder = [2, 4, 6, 8];

  return (
    <div className="w-[320px] flex flex-col h-full bg-white border-r border-slate-900/[0.06]">
      {/* Search Header */}
      <div className="p-4 border-b border-slate-900/[0.06] space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Bin Catalog</h2>
        <p className="text-xs text-slate-500">Click or drag to place</p>
        <Input
          placeholder="Search sizes..."
          icon={<Search className="h-4 w-4" />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="flex p-1 bg-slate-100 rounded-lg">
          <button
            className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-all ${
              activeTab === 'all'
                ? 'bg-white shadow-sm text-[#0B0B0C]'
                : 'text-slate-500 hover:text-slate-700'
            }`}
            onClick={() => setActiveTab('all')}
          >
            All Sizes
          </button>
          <button
            className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-all flex items-center justify-center gap-1 ${
              activeTab === 'fav'
                ? 'bg-white shadow-sm text-[#0B0B0C]'
                : 'text-slate-500 hover:text-slate-700'
            }`}
            onClick={() => setActiveTab('fav')}
          >
            <Star className="h-3 w-3" /> Favorites
          </button>
        </div>
      </div>

      {/* Catalog List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-8">
        {bucketOrder.map(
          (bucket) =>
            grouped[bucket].length > 0 && (
              <div key={bucket}>
                <div className="flex items-center justify-between pr-1 mb-1">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider pl-1">
                    Length {bucket}"{bucket === 8 ? '+' : ''}
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {grouped[bucket].map((bin) => (
                    <DraggableBinCard key={bin.id} bin={bin} onClick={() => addPlacement(bin.id)} />
                  ))}
                </div>
              </div>
            )
        )}
      </div>
    </div>
  );
}

function DraggableBinCard({ bin, onClick }: { bin: ReturnType<typeof useLayout>['bins'][number]; onClick: () => void }) {
  const maxPreview = 80;
  const previewFrame = maxPreview + 24;
  const scale = maxPreview / Math.max(bin.width, bin.length);
  const previewWidth = Math.max(bin.width * scale, 40);
  const previewHeight = Math.max(bin.length * scale, 40);
  const boxLeft = (previewFrame - previewWidth) / 2;
  const boxTop = (previewFrame - previewHeight) / 2;
  const labelOffset = 10;
  const labelOffsetLeft = labelOffset;

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `bin-${bin.id}`,
    data: { type: 'bin', binId: bin.id }
  });

  const dragStyle = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

  return (
    <Card
      data-testid="bin-card"
      className="group cursor-grab active:cursor-grabbing border-slate-200 hover:border-[#14476B]/30 w-full"
      noPadding
      hoverable
      ref={setNodeRef}
      style={{ ...dragStyle, opacity: isDragging ? 0.65 : 1 }}
      onClick={onClick}
      {...listeners}
      {...attributes}
    >
      <div className="p-4 flex items-center justify-center">
        <div
          className="relative flex items-center justify-center p-2"
          style={{ width: `${previewFrame}px`, height: `${previewFrame}px` }}
        >
          <div
            className="relative bg-slate-100 border border-slate-200"
            style={{
              width: `${previewWidth}px`,
              height: `${previewHeight}px`,
              minWidth: '40px',
              minHeight: '40px'
            }}
          />
          <span
            className="absolute text-xs text-slate-700 font-mono"
            style={{
              left: `${boxLeft + previewWidth / 2}px`,
              top: `${boxTop + previewHeight + labelOffset}px`,
              transform: 'translateX(-50%)'
            }}
          >
            {bin.width}"
          </span>
          <span
            className="absolute text-xs text-slate-700 font-mono"
            style={{
              left: `${boxLeft - labelOffsetLeft}px`,
              top: `${boxTop + previewHeight / 2}px`,
              transform: 'translate(-100%, -50%)'
            }}
          >
            {bin.length}"
          </span>
        </div>
      </div>
    </Card>
  );
}
