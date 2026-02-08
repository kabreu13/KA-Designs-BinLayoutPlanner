import type { MutableRefObject } from 'react';
import clsx from 'clsx';
import { cva } from 'class-variance-authority';
import {
  ChevronDown,
  ChevronUp,
  Grid,
  House,
  PaintBucket,
  RotateCcw,
  RotateCw,
  Sparkles,
  Trash2,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { Button } from '../../ui/Button';
import { CUSTOM_COLOR_VALUE, PRESET_COLORS } from '../../../utils/colors';
import styles from './QuickActions.module.css';

const panelStateClassName = cva('', {
  variants: {
    paintMode: {
      true: styles.panelPaintMode,
      false: ''
    }
  }
});

const interactivityClassName = cva('', {
  variants: {
    enabled: {
      true: styles.pointerEnabled,
      false: styles.pointerDisabled
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

type MobileQuickActionsProps = {
  isOpen: boolean;
  isMini: boolean;
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
  onToggleSize: () => void;
  onCollapse: () => void;
  onExpand: () => void;
};

export function MobileQuickActions({
  isOpen,
  isMini,
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
  onPaintColorChange,
  onToggleSize,
  onCollapse,
  onExpand
}: MobileQuickActionsProps) {
  if (!isOpen) {
    return (
      <button
        type="button"
        data-testid="quick-actions-toggle"
        aria-expanded={isOpen}
        aria-label="Expand quick actions"
        title="Expand quick actions"
        tabIndex={quickActionsTabIndex}
        onClick={onExpand}
        className={styles.collapsedToggle}
      >
        <ChevronUp className={styles.iconMd} />
        <span className={styles.collapsedToggleLabel}>Actions</span>
      </button>
    );
  }

  return (
    <div
      data-tour="quick-actions-pill"
      className={clsx(styles.panel, panelStateClassName({ paintMode }))}
    >
      <div
        className={clsx(styles.section, interactivityClassName({ enabled: !disableQuickActions }))}
      >
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

        {!isMini && (
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
        )}

        {!isMini && (
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
                {`Home ${homeZoomPercent}%`}
              </Button>
            </div>
          </div>
        )}
      </div>

      {!isMini && (
        <div
          className={clsx(
            styles.section,
            styles.layoutSection,
            interactivityClassName({ enabled: !disableQuickActions })
          )}
        >
          <div data-tour="canvas-actions" className={styles.group}>
            <span className={styles.label}>Layout</span>
            <div className={clsx(styles.row, styles.layoutRow)}>
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
                {`Suggest (${suggestModeLabel})`}
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
            {layoutControlsDisabled && (
              <div className={styles.layoutHint}>Add a bin to enable layout tools.</div>
            )}
          </div>
        </div>
      )}

      <div
        className={clsx(styles.footer, interactivityClassName({ enabled: !disableQuickActions }))}
      >
        <button
          type="button"
          onClick={onToggleSize}
          tabIndex={quickActionsTabIndex}
          className={styles.footerButton}
        >
          <span className={styles.footerLabel}>
            {isMini ? 'More' : 'Less'}
          </span>
        </button>
        <button
          type="button"
          data-testid="quick-actions-toggle"
          aria-expanded={isOpen}
          aria-label="Collapse quick actions"
          title="Collapse quick actions"
          onClick={onCollapse}
          tabIndex={quickActionsTabIndex}
          className={styles.footerButton}
        >
          <ChevronDown className={styles.iconMd} />
          <span className={styles.footerLabel}>Hide</span>
        </button>
      </div>
    </div>
  );
}
