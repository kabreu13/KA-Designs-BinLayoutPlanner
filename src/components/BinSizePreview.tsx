import clsx from 'clsx';
import styles from './BinSizePreview.module.css';

interface BinSizePreviewProps {
  width: number;
  length: number;
  color?: string;
  size?: 'catalog' | 'compact';
  className?: string;
  dataTestId?: string;
}

const SIZE_CONFIG = {
  catalog: {
    maxPreview: 80,
    minDimension: 40,
    framePadding: 12,
    labelOffset: 10
  },
  compact: {
    maxPreview: 28,
    minDimension: 14,
    framePadding: 10,
    labelOffset: 7
  }
} as const;

export function BinSizePreview({
  width,
  length,
  color = '#f1f5f9',
  size = 'catalog',
  className,
  dataTestId
}: BinSizePreviewProps) {
  const config = SIZE_CONFIG[size];
  const frameSize = config.maxPreview + config.framePadding * 2;
  const scale = config.maxPreview / Math.max(width, length);
  const previewWidth = Math.max(width * scale, config.minDimension);
  const previewHeight = Math.max(length * scale, config.minDimension);
  const boxLeft = (frameSize - previewWidth) / 2;
  const boxTop = (frameSize - previewHeight) / 2;

  return (
    <div
      data-testid={dataTestId}
      data-size={`${width}x${length}`}
      className={clsx(styles.root, className)}
      style={{ width: `${frameSize}px`, height: `${frameSize}px` }}
    >
      <div
        data-testid={dataTestId ? `${dataTestId}-body` : undefined}
        className={styles.body}
        style={{
          width: `${previewWidth}px`,
          height: `${previewHeight}px`,
          minWidth: `${config.minDimension}px`,
          minHeight: `${config.minDimension}px`,
          backgroundColor: color
        }}
      />
      <span
        className={styles.measurementLabel}
        style={{
          left: `${boxLeft + previewWidth / 2}px`,
          top: `${boxTop + previewHeight + config.labelOffset}px`,
          transform: 'translateX(-50%)'
        }}
      >
        {width}"
      </span>
      <span
        className={styles.measurementLabel}
        style={{
          left: `${boxLeft - config.labelOffset}px`,
          top: `${boxTop + previewHeight / 2}px`,
          transform: 'translate(-100%, -50%)'
        }}
      >
        {length}"
      </span>
    </div>
  );
}
