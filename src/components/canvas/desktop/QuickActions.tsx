import type { MutableRefObject } from 'react';
import { Grid, House, PaintBucket, RotateCcw, RotateCw, Sparkles, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '../../ui/Button';
import { CUSTOM_COLOR_VALUE, PRESET_COLORS } from '../../../utils/colors';

type DesktopQuickActionsProps = {
  paintMode: boolean;
  disableQuickActions: boolean;
  quickActionsTabIndex: number;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  snapInputRef: MutableRefObject<HTMLInputElement | null>;
  snapDraft: string;
  snapHelper: string | null;
  onSnapInputChange: (value: string) => void;
  onCommitSnapInput: () => void;
  canvasZoomPercent: number;
  canZoomOut: boolean;
  canZoomIn: boolean;
  onZoomOut: () => void;
  onZoomIn: () => void;
  homeZoomPercent: number;
  onHomeCanvas: () => void;
  layoutControlsDisabled: boolean;
  suggestModeLabel: string;
  onSuggestLayout: () => void;
  onClearLayout: () => void;
  onTogglePaintMode: () => void;
  paintColorSelection: string;
  paintColorDraft: string;
  onPaintColorSelectionChange: (value: string) => void;
  onPaintColorChange: (value: string) => void;
};

export function DesktopQuickActions({
  paintMode,
  disableQuickActions,
  quickActionsTabIndex,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  showGrid,
  onToggleGrid,
  snapInputRef,
  snapDraft,
  snapHelper,
  onSnapInputChange,
  onCommitSnapInput,
  canvasZoomPercent,
  canZoomOut,
  canZoomIn,
  onZoomOut,
  onZoomIn,
  homeZoomPercent,
  onHomeCanvas,
  layoutControlsDisabled,
  suggestModeLabel,
  onSuggestLayout,
  onClearLayout,
  onTogglePaintMode,
  paintColorSelection,
  paintColorDraft,
  onPaintColorSelectionChange,
  onPaintColorChange
}: DesktopQuickActionsProps) {
  return (
    <div
      data-tour="quick-actions-pill"
      className="absolute top-4 inset-x-0 z-50 flex justify-center pointer-events-none px-4"
    >
      <div
        className={`bg-white/90 backdrop-blur shadow-lg border border-slate-200 rounded-2xl px-3 py-2 inline-flex items-center gap-2 w-full max-w-[720px] overflow-visible ${
          paintMode ? 'pb-4' : ''
        } ${disableQuickActions ? 'pointer-events-none' : 'pointer-events-auto'}`}
      >
        <div className="flex flex-wrap items-end justify-center gap-x-2 gap-y-2 xl:flex-nowrap">
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 leading-none">History</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onUndo}
                disabled={!canUndo}
                title="Undo (Ctrl/Cmd+Z)"
                aria-label="Undo"
                data-quick-actions-start
                tabIndex={quickActionsTabIndex}
                className="hover:bg-slate-100 disabled:opacity-40 rounded-full text-slate-600 p-2"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onRedo}
                disabled={!canRedo}
                title="Redo (Shift+Ctrl/Cmd+Z)"
                aria-label="Redo"
                tabIndex={quickActionsTabIndex}
                className="hover:bg-slate-100 disabled:opacity-40 rounded-full text-slate-600 p-2"
              >
                <RotateCw className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="hidden xl:block w-px bg-slate-200 h-8" />

          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 leading-none">Grid</span>
            <button
              onClick={onToggleGrid}
              title="Toggle grid (G)"
              aria-label="Toggle grid"
              aria-pressed={showGrid}
              tabIndex={quickActionsTabIndex}
              className={`rounded-full transition-colors p-2 border ${
                showGrid
                  ? 'bg-[#14476B]/10 text-[#14476B] border-[#14476B]/30'
                  : 'border-transparent hover:border-slate-200 hover:bg-slate-100 text-slate-600'
              }`}
            >
              <Grid className="h-4 w-4" />
            </button>
          </div>

          <div className="hidden xl:block w-px bg-slate-200 h-8" />

          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 leading-none">Snap</span>
            <div className="flex items-center gap-1">
              <input
                ref={snapInputRef}
                aria-label="Snap to grid"
                title="Snap to the nearest grid line (inches)"
                type="number"
                min={0.5}
                max={2}
                step={0.5}
                value={snapDraft}
                inputMode="decimal"
                onChange={(event) => onSnapInputChange(event.target.value)}
                onBlur={onCommitSnapInput}
                aria-invalid={Boolean(snapHelper)}
                aria-describedby={snapHelper ? 'snap-helper' : undefined}
                tabIndex={quickActionsTabIndex}
                className="w-12 px-2 py-1 text-xs rounded-md border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#14476B]/20"
              />
              <span className="text-[10px] text-slate-400">in</span>
            </div>
            {snapHelper && (
              <span id="snap-helper" className="text-[10px] text-amber-600">
                {snapHelper}
              </span>
            )}
          </div>

          <div className="hidden xl:block w-px bg-slate-200 h-8" />

          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 leading-none">View</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Zoom out"
                title="Zoom out"
                disabled={!canZoomOut}
                onClick={onZoomOut}
                tabIndex={quickActionsTabIndex}
                className="hover:bg-slate-100 disabled:opacity-40 rounded-full text-slate-600 p-2"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="w-10 text-center text-xs font-medium text-slate-600">
                <span data-testid="canvas-zoom-value">{canvasZoomPercent}%</span>
              </span>
              <button
                type="button"
                aria-label="Zoom in"
                title="Zoom in"
                disabled={!canZoomIn}
                onClick={onZoomIn}
                tabIndex={quickActionsTabIndex}
                className="hover:bg-slate-100 disabled:opacity-40 rounded-full text-slate-600 p-2"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              <Button
                data-testid="home-canvas-button"
                size="sm"
                variant="ghost"
                title={`Home canvas (${homeZoomPercent}%)`}
                aria-label={`Home canvas ${homeZoomPercent}%`}
                tabIndex={quickActionsTabIndex}
                className="text-slate-700 px-2"
                leftIcon={<House className="h-3 w-3" />}
                onClick={onHomeCanvas}
              >
                {`Home ${homeZoomPercent}%`}
              </Button>
            </div>
          </div>

          <div className="hidden xl:block w-px bg-slate-200 h-8" />

          <div data-tour="canvas-actions" className="flex flex-col items-center gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 leading-none">Layout</span>
            <div className="flex items-center gap-2">
              <Button
                data-testid="suggest-layout-button"
                size="sm"
                variant="ghost"
                className="text-[#14476B] px-2"
                leftIcon={<Sparkles className="h-3 w-3" />}
                title={layoutControlsDisabled ? 'Add a bin to enable suggest layout' : 'Suggest layout (S)'}
                tabIndex={quickActionsTabIndex}
                onClick={onSuggestLayout}
                disabled={layoutControlsDisabled}
              >
                {`Suggest (${suggestModeLabel})`}
              </Button>
              <Button
                data-testid="clear-layout-button"
                size="sm"
                variant="ghost"
                className="text-slate-600 px-2"
                leftIcon={<Trash2 className="h-3 w-3" />}
                title={layoutControlsDisabled ? 'Add a bin to enable clear' : 'Clear layout (C)'}
                tabIndex={quickActionsTabIndex}
                onClick={onClearLayout}
                disabled={layoutControlsDisabled}
              >
                Clear
              </Button>
              <div className="flex flex-col items-center gap-1">
                <Button
                  data-testid="paint-mode-toggle"
                  data-tour="paint-action"
                  size="sm"
                  variant="ghost"
                  className={`${paintMode ? 'text-[#14476B] bg-[#14476B]/10 border border-[#14476B]/30' : 'text-slate-600 border border-transparent hover:border-slate-200'} px-2`}
                  leftIcon={<PaintBucket className="h-3 w-3" />}
                  onClick={onTogglePaintMode}
                  aria-label={paintMode ? 'Disable paint mode' : 'Enable paint mode'}
                  aria-pressed={paintMode}
                  tabIndex={quickActionsTabIndex}
                  disabled={layoutControlsDisabled}
                >
                  {paintMode ? 'Paint On' : 'Paint'}
                </Button>
                {paintMode && (
                  <select
                    data-testid="paint-color-select"
                    value={paintColorSelection}
                    onChange={(event) => onPaintColorSelectionChange(event.target.value)}
                    aria-label="Paint color"
                    tabIndex={quickActionsTabIndex}
                    className="w-24 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#14476B]/20"
                  >
                    {PRESET_COLORS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                    <option value={CUSTOM_COLOR_VALUE}>Custom</option>
                  </select>
                )}
                {paintMode && paintColorSelection === CUSTOM_COLOR_VALUE && (
                  <input
                    data-testid="paint-color-custom"
                    aria-label="Paint custom color"
                    type="color"
                    value={paintColorDraft}
                    onChange={(event) => onPaintColorChange(event.target.value)}
                    tabIndex={quickActionsTabIndex}
                    className="h-7 w-10 rounded-md border border-slate-200 bg-white"
                  />
                )}
              </div>
            </div>
            {layoutControlsDisabled && (
              <div className="text-[10px] text-slate-400">Add a bin to enable layout tools.</div>
            )}
          </div>

          <div className="hidden xl:block w-px bg-slate-200 h-8" />
        </div>
      </div>
    </div>
  );
}
