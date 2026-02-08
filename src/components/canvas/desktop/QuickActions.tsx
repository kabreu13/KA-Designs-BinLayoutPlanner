import type { MutableRefObject } from 'react';
import clsx from 'clsx';
import { cva } from 'class-variance-authority';
import { Grid, House, PaintBucket, RotateCcw, RotateCw, Sparkles, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '../../ui/Button';
import { CUSTOM_COLOR_VALUE, PRESET_COLORS } from '../../../utils/colors';
import styles from './QuickActions.module.css';

const pillStateClassName = cva('', {
  variants: {
    paintMode: {
      true: styles.quickActionsPillPaintMode,
      false: ''
    },
    interactive: {
      true: styles.quickActionsPillInteractive,
      false: styles.quickActionsPillDisabled
    }
  }
});

const gridButtonStateClassName = cva('', {
  variants: {
    pressed: {
      true: styles.gridButtonPressed,
      false: styles.gridButtonIdle
    }
  }
});

const paintModeButtonStateClassName = cva('', {
  variants: {
    active: {
      true: styles.paintToggleActive,
      false: styles.paintToggleIdle
    }
  }
});

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
      className={styles.quickActionsRoot}
    >
      <div
        className={clsx(
          styles.quickActionsPill,
          pillStateClassName({
            paintMode,
            interactive: !disableQuickActions
          })
        )}
      >
        <div className={styles.groups}>
          <div className={styles.group}>
            <span className={styles.label}>History</span>
            <div className={styles.row}>
              <button
                type="button"
                onClick={onUndo}
                disabled={!canUndo}
                title="Undo (Ctrl/Cmd+Z)"
                aria-label="Undo"
                data-quick-actions-start
                tabIndex={quickActionsTabIndex}
                className={styles.iconButton}
              >
                <RotateCcw className={styles.iconMd} />
              </button>
              <button
                type="button"
                onClick={onRedo}
                disabled={!canRedo}
                title="Redo (Shift+Ctrl/Cmd+Z)"
                aria-label="Redo"
                tabIndex={quickActionsTabIndex}
                className={styles.iconButton}
              >
                <RotateCw className={styles.iconMd} />
              </button>
            </div>
          </div>

          <div className={styles.group}>
            <span className={styles.label}>Grid</span>
            <button
              onClick={onToggleGrid}
              title="Toggle grid (G)"
              aria-label="Toggle grid"
              aria-pressed={showGrid}
              tabIndex={quickActionsTabIndex}
              className={clsx(styles.iconButton, gridButtonStateClassName({ pressed: showGrid }))}
            >
              <Grid className={styles.iconMd} />
            </button>
          </div>

          <div className={styles.group}>
            <span className={styles.label}>Snap</span>
            <div className={styles.row}>
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
                className={styles.snapInput}
              />
              <span className={styles.unit}>in</span>
            </div>
            {snapHelper && (
              <span id="snap-helper" className={styles.helper}>
                {snapHelper}
              </span>
            )}
          </div>

          <div className={styles.group}>
            <span className={styles.label}>View</span>
            <div className={styles.row}>
              <button
                type="button"
                aria-label="Zoom out"
                title="Zoom out"
                disabled={!canZoomOut}
                onClick={onZoomOut}
                tabIndex={quickActionsTabIndex}
                className={styles.iconButton}
              >
                <ZoomOut className={styles.iconMd} />
              </button>
              <span className={styles.zoomValue}>
                <span data-testid="canvas-zoom-value">{canvasZoomPercent}%</span>
              </span>
              <button
                type="button"
                aria-label="Zoom in"
                title="Zoom in"
                disabled={!canZoomIn}
                onClick={onZoomIn}
                tabIndex={quickActionsTabIndex}
                className={styles.iconButton}
              >
                <ZoomIn className={styles.iconMd} />
              </button>
              <Button
                data-testid="home-canvas-button"
                size="sm"
                variant="ghost"
                title={`Home canvas (${homeZoomPercent}%)`}
                aria-label={`Home canvas ${homeZoomPercent}%`}
                tabIndex={quickActionsTabIndex}
                className={styles.homeButton}
                leftIcon={<House className={styles.iconSm} />}
                onClick={onHomeCanvas}
              >
                Home
              </Button>
            </div>
          </div>

          <div data-tour="canvas-actions" className={styles.group}>
            <span className={styles.label}>Layout</span>
            <div className={styles.layoutActions}>
              <Button
                data-testid="suggest-layout-button"
                size="sm"
                variant="ghost"
                className={styles.suggestButton}
                leftIcon={<Sparkles className={styles.iconSm} />}
                title={layoutControlsDisabled ? 'Add a bin to enable suggest layout' : 'Suggest layout (S)'}
                tabIndex={quickActionsTabIndex}
                onClick={onSuggestLayout}
                disabled={layoutControlsDisabled}
              >
                Suggest
              </Button>
              <Button
                data-testid="clear-layout-button"
                size="sm"
                variant="ghost"
                className={styles.clearButton}
                leftIcon={<Trash2 className={styles.iconSm} />}
                title={layoutControlsDisabled ? 'Add a bin to enable clear' : 'Clear layout (C)'}
                tabIndex={quickActionsTabIndex}
                onClick={onClearLayout}
                disabled={layoutControlsDisabled}
              >
                Clear
              </Button>
              <div className={styles.paintStack}>
                <Button
                  data-testid="paint-mode-toggle"
                  data-tour="paint-action"
                  size="sm"
                  variant="ghost"
                  className={clsx(
                    styles.paintToggleBase,
                    paintModeButtonStateClassName({ active: paintMode })
                  )}
                  leftIcon={<PaintBucket className={styles.iconSm} />}
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
                    className={styles.paintSelect}
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
                    className={styles.customColorInput}
                  />
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
