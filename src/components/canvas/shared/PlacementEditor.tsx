import type { MutableRefObject } from 'react';
import clsx from 'clsx';
import { cva } from 'class-variance-authority';
import { AlertCircle, Trash2 } from 'lucide-react';
import { Button } from '../../ui/Button';
import { CUSTOM_COLOR_VALUE, PRESET_COLORS } from '../../../utils/colors';
import styles from './PlacementEditor.module.css';

const editorSizeClassName = cva('', {
  variants: {
    mobile: {
      true: styles.editorMobile,
      false: styles.editorDesktop
    }
  }
});

export type PlacementEditorPosition = {
  left: number;
  top: number;
  width?: number;
};

type PlacementEditorProps = {
  editorRef: MutableRefObject<HTMLDivElement | null>;
  labelInputRef: MutableRefObject<HTMLInputElement | null>;
  isMobileLayout: boolean;
  editorPosition: PlacementEditorPosition;
  selectedCount: number;
  selectedSize: { width: number; length: number };
  labelDraft: string;
  onLabelDraftChange: (value: string) => void;
  onLabelCommit: (value?: string) => void;
  colorSelection: string;
  onColorSelectionChange: (value: string) => void;
  colorDraft: string;
  onColorChange: (value: string) => void;
  onResize: (axis: 'width' | 'length', direction: -1 | 1) => void;
  resizeError: string | null;
  minBinSize: number;
  maxBinSize: number;
  sizeStep: number;
  onDelete: () => void;
  onClose: () => void;
};

export function PlacementEditor({
  editorRef,
  labelInputRef,
  isMobileLayout,
  editorPosition,
  selectedCount,
  selectedSize,
  labelDraft,
  onLabelDraftChange,
  onLabelCommit,
  colorSelection,
  onColorSelectionChange,
  colorDraft,
  onColorChange,
  onResize,
  resizeError,
  minBinSize,
  maxBinSize,
  sizeStep,
  onDelete,
  onClose
}: PlacementEditorProps) {
  return (
    <div
      ref={editorRef}
      data-testid="placement-editor"
      role="dialog"
      aria-labelledby="placement-editor-title"
      className={clsx(styles.editor, editorSizeClassName({ mobile: isMobileLayout }))}
      style={{ left: editorPosition.left, top: editorPosition.top, width: editorPosition.width }}
    >
      <div className={styles.header}>
        <span id="placement-editor-title" className={styles.title}>
          Edit Bin
        </span>
        <button
          type="button"
          onClick={onClose}
          className={styles.closeButton}
        >
          Close
        </button>
      </div>
      {selectedCount > 1 && (
        <p className={styles.multiEditNotice}>Editing {selectedCount} bins</p>
      )}

      <div className={styles.content}>
        <label className={styles.field}>
          Label
          <input
            data-testid="placement-label"
            ref={labelInputRef}
            type="text"
            value={labelDraft}
            onChange={(event) => onLabelDraftChange(event.target.value)}
            onBlur={(event) => onLabelCommit(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                onLabelCommit((event.target as HTMLInputElement).value);
                (event.target as HTMLInputElement).blur();
              }
            }}
            className={styles.inputField}
            placeholder="Optional label"
          />
        </label>

        <label className={styles.field}>
          Color
          <select
            data-testid="placement-color"
            value={colorSelection}
            onChange={(event) => onColorSelectionChange(event.target.value)}
            className={styles.inputField}
          >
            {PRESET_COLORS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
            <option value={CUSTOM_COLOR_VALUE}>Custom</option>
          </select>
        </label>

        {colorSelection === CUSTOM_COLOR_VALUE && (
          <label className={styles.customColorRow}>
            Custom Color
            <input
              data-testid="placement-color-custom"
              type="color"
              value={colorDraft}
              onChange={(event) => onColorChange(event.target.value)}
              className={styles.customColorInput}
            />
          </label>
        )}

        <div className={styles.sizeGrid}>
          <div className={styles.sizeRow}>
            <span>Width</span>
            <div className={styles.sizeControls}>
              <button
                type="button"
                data-testid="size-width-decrease"
                onClick={() => onResize('width', -1)}
                disabled={selectedSize.width <= minBinSize}
                aria-label="Decrease width"
                title="Decrease width"
                className={styles.sizeButton}
              >
                -
              </button>
              <span className={styles.sizeValue}>{selectedSize.width}"</span>
              <button
                type="button"
                data-testid="size-width-increase"
                onClick={() => onResize('width', 1)}
                disabled={selectedSize.width >= maxBinSize}
                aria-label="Increase width"
                title="Increase width"
                className={styles.sizeButton}
              >
                +
              </button>
            </div>
          </div>

          <div className={styles.sizeRow}>
            <span>Length</span>
            <div className={styles.sizeControls}>
              <button
                type="button"
                data-testid="size-length-decrease"
                onClick={() => onResize('length', -1)}
                disabled={selectedSize.length <= minBinSize}
                aria-label="Decrease length"
                title="Decrease length"
                className={styles.sizeButton}
              >
                -
              </button>
              <span className={styles.sizeValue}>{selectedSize.length}"</span>
              <button
                type="button"
                data-testid="size-length-increase"
                onClick={() => onResize('length', 1)}
                disabled={selectedSize.length >= maxBinSize}
                aria-label="Increase length"
                title="Increase length"
                className={styles.sizeButton}
              >
                +
              </button>
            </div>
          </div>
        </div>

        {resizeError && (
          <p className={styles.error}>
            <AlertCircle className={styles.iconSm} />
            {resizeError}
          </p>
        )}

        <p className={styles.hint}>
          Sizes adjust in {sizeStep}" steps (min {minBinSize}", max {maxBinSize}").
        </p>

        <Button
          data-testid="delete-bin-button"
          size="sm"
          variant="ghost"
          className={styles.deleteButton}
          aria-label={`Delete ${selectedCount} bin${selectedCount === 1 ? '' : 's'}`}
          leftIcon={<Trash2 className={styles.iconSm} />}
          onClick={onDelete}
        >
          Delete {selectedCount === 1 ? 'Bin' : 'Bins'}
        </Button>
      </div>
    </div>
  );
}
