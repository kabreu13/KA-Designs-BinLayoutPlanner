import { useState } from 'react';
import { cva } from 'class-variance-authority';
import { useDraggable } from '@dnd-kit/core';
import { Card } from './ui/Card';
import { ChevronDown, ChevronRight, GripVertical } from 'lucide-react';
import { useLayout } from '../context/LayoutContext';
import { BinSizePreview } from './BinSizePreview';
import styles from './BinCatalog.module.css';

const rootClassName = cva(styles.catalogRoot, {
  variants: {
    mobile: {
      true: styles.catalogRootMobile,
      false: styles.catalogRootDesktop
    }
  }
});

const headerClassName = cva(styles.header, {
  variants: {
    mobile: {
      true: styles.headerMobile,
      false: styles.headerDesktop
    }
  }
});

const listClassName = cva(styles.list, {
  variants: {
    mobile: {
      true: styles.listMobile,
      false: styles.listDesktop
    }
  }
});

const bucketHeaderClassName = cva(styles.bucketHeader, {
  variants: {
    mobile: {
      true: styles.bucketHeaderMobile,
      false: styles.bucketHeaderDesktop
    }
  }
});

const bucketToggleClassName = cva(styles.bucketToggle, {
  variants: {
    mobile: {
      true: styles.bucketToggleMobile,
      false: styles.bucketToggleDesktop
    }
  }
});

const bucketGridClassName = cva(styles.bucketGrid, {
  variants: {
    mobile: {
      true: styles.bucketGridMobile,
      false: styles.bucketGridDesktop
    }
  }
});

const cardClassName = cva(styles.binCard, {
  variants: {
    mobile: {
      true: styles.binCardMobile,
      false: styles.binCardDesktop
    }
  }
});

const cardContentClassName = cva(styles.binCardContent, {
  variants: {
    mobile: {
      true: styles.binCardContentMobile,
      false: styles.binCardContentDesktop
    }
  }
});

const dragHintClassName = cva(styles.dragHint, {
  variants: {
    mobile: {
      true: styles.dragHintMobile,
      false: styles.dragHintDesktop
    }
  }
});

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
      className={rootClassName({ mobile })}
    >
      {/* Header */}
      <div className={headerClassName({ mobile })}>
        <h2 className={styles.title}>Bin Catalog</h2>
        <p className={styles.subtitle}>Click or drag to place</p>
        {bucketOrder.length > 0 && (
          <div className={styles.toggleRow}>
            <button
              type="button"
              data-testid="catalog-toggle-all"
              onClick={() => {
                if (allExpanded) collapseAll();
                else expandAll();
              }}
              className={styles.toggleAllButton}
            >
              {allExpanded ? 'Collapse All' : 'Expand All'}
            </button>
            <div />
          </div>
        )}
      </div>

      {/* Catalog List */}
      <div
        className={listClassName({ mobile })}
      >
        {allCollapsed && (
          <div className={styles.emptyState}>
            <span className={styles.emptyStateTitle}>No Bins Showing</span>
            <span>Expand a length to see available bin sizes.</span>
            <button
              type="button"
              onClick={expandAll}
              className={styles.emptyStateAction}
            >
              Expand All Lengths
            </button>
          </div>
        )}
        {bucketOrder.map(
          (bucket) =>
            grouped[bucket].length > 0 && (
              <div key={bucket} className={styles.bucketGroup}>
                <div className={bucketHeaderClassName({ mobile })}>
                  <button
                    type="button"
                    data-testid={`catalog-group-toggle-${bucket}`}
                    aria-expanded={!isBucketCollapsed(bucket)}
                    aria-controls={`catalog-group-body-${bucket}`}
                    onClick={() => toggleBucket(bucket)}
                    className={bucketToggleClassName({ mobile })}
                  >
                    {isBucketCollapsed(bucket) ? (
                      <ChevronRight className={styles.bucketIcon} />
                    ) : (
                      <ChevronDown className={styles.bucketIcon} />
                    )}
                    <span>
                      Length {bucket}" ({grouped[bucket].length})
                    </span>
                  </button>
                </div>
                {!isBucketCollapsed(bucket) && (
                  <div
                    id={`catalog-group-body-${bucket}`}
                    data-testid={`catalog-group-body-${bucket}`}
                    className={bucketGridClassName({ mobile })}
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
          <div className={styles.mobileBottomFade} />
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
      title="Drag or click to place"
      className={cardClassName({ mobile })}
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
      <div className={cardContentClassName({ mobile })}>
        <BinSizePreview width={bin.width} length={bin.length} size="catalog" />
      </div>
      <div className={dragHintClassName({ mobile })}>
        <GripVertical className={styles.dragIcon} />
        <span className={styles.dragLabel}>Drag</span>
      </div>
    </Card>
  );
}
