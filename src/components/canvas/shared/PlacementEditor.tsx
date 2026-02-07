import type { MutableRefObject } from 'react';
import { AlertCircle, Trash2 } from 'lucide-react';
import { Button } from '../../ui/Button';
import { CUSTOM_COLOR_VALUE, PRESET_COLORS } from '../../../utils/colors';

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
      className={`fixed z-50 rounded-xl border border-slate-200 bg-white shadow-xl p-3 text-sm ${
        isMobileLayout ? 'w-[calc(100%-2rem)] max-w-sm' : 'w-60'
      }`}
      style={{ left: editorPosition.left, top: editorPosition.top, width: editorPosition.width }}
    >
      <div className="flex items-center justify-between mb-1">
        <span id="placement-editor-title" className="text-xs font-semibold text-slate-700">
          Edit Bin
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 text-xs"
        >
          Close
        </button>
      </div>
      {selectedCount > 1 && (
        <p className="text-[11px] text-slate-500 mb-2">Editing {selectedCount} bins</p>
      )}

      <div className="space-y-2">
        <label className="flex flex-col gap-1 text-xs text-slate-500">
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
            className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#14476B]/20"
            placeholder="Optional label"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-slate-500">
          Color
          <select
            data-testid="placement-color"
            value={colorSelection}
            onChange={(event) => onColorSelectionChange(event.target.value)}
            className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#14476B]/20"
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
          <label className="flex items-center justify-between text-xs text-slate-500">
            Custom Color
            <input
              data-testid="placement-color-custom"
              type="color"
              value={colorDraft}
              onChange={(event) => onColorChange(event.target.value)}
              className="h-7 w-10 rounded-md border border-slate-200 bg-white"
            />
          </label>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Width</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="size-width-decrease"
                onClick={() => onResize('width', -1)}
                disabled={selectedSize.width <= minBinSize}
                aria-label="Decrease width"
                title="Decrease width"
                className="h-6 w-6 rounded-full border border-slate-200 text-slate-600 disabled:opacity-40"
              >
                -
              </button>
              <span className="text-xs font-medium text-slate-700">{selectedSize.width}"</span>
              <button
                type="button"
                data-testid="size-width-increase"
                onClick={() => onResize('width', 1)}
                disabled={selectedSize.width >= maxBinSize}
                aria-label="Increase width"
                title="Increase width"
                className="h-6 w-6 rounded-full border border-slate-200 text-slate-600 disabled:opacity-40"
              >
                +
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Length</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="size-length-decrease"
                onClick={() => onResize('length', -1)}
                disabled={selectedSize.length <= minBinSize}
                aria-label="Decrease length"
                title="Decrease length"
                className="h-6 w-6 rounded-full border border-slate-200 text-slate-600 disabled:opacity-40"
              >
                -
              </button>
              <span className="text-xs font-medium text-slate-700">{selectedSize.length}"</span>
              <button
                type="button"
                data-testid="size-length-increase"
                onClick={() => onResize('length', 1)}
                disabled={selectedSize.length >= maxBinSize}
                aria-label="Increase length"
                title="Increase length"
                className="h-6 w-6 rounded-full border border-slate-200 text-slate-600 disabled:opacity-40"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {resizeError && (
          <p className="text-xs text-red-600 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {resizeError}
          </p>
        )}

        <p className="text-xs text-slate-400">
          Sizes adjust in {sizeStep}" steps (min {minBinSize}", max {maxBinSize}").
        </p>

        <Button
          data-testid="delete-bin-button"
          size="sm"
          variant="ghost"
          className="w-full justify-center text-red-600 hover:bg-red-50"
          aria-label={`Delete ${selectedCount} bin${selectedCount === 1 ? '' : 's'}`}
          leftIcon={<Trash2 className="h-3 w-3" />}
          onClick={onDelete}
        >
          Delete {selectedCount === 1 ? 'Bin' : 'Bins'}
        </Button>
      </div>
    </div>
  );
}
