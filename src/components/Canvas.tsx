import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { cva } from 'class-variance-authority';
import type {
  HTMLAttributes,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent
} from 'react';
import { useDndMonitor, useDroppable, useDraggable } from '@dnd-kit/core';
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';
import type { ReactZoomPanPinchContentRef, ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import { Button } from './ui/Button';
import { AlertCircle, X } from 'lucide-react';
import { useLayout } from '../context/LayoutContext';
import { applyDelta, type DragItem, type Point } from '../utils/dragMath';
import type { Bin, Placement } from '../context/LayoutContext';
import { OPEN_HOW_TO_EVENT } from '../lib/uiEvents';
import { DesktopQuickActions } from './canvas/desktop/QuickActions';
import { MobileQuickActions } from './canvas/mobile/QuickActions';
import { useCanvasController } from './canvas/hooks/useCanvasController';
import { PlacementEditor } from './canvas/shared/PlacementEditor';
import styles from './Canvas.module.css';
import {
  CUSTOM_COLOR_VALUE,
  DEFAULT_BIN_COLOR,
  getColorLabel,
  getColorSelection,
  getContrastText,
  normalizeHexColor
} from '../utils/colors';

const GRID_SIZE = 25; // px per inch on canvas
const FRAME_THROTTLE_MS = 16; // ~60fps
const DEFAULT_SNAP = 1;
const SNAP_MIN = 0.5;
const SNAP_MAX = 2;
const CANVAS_PADDING = 32; // px padding between canvas edge and drawer area
const LABEL_ZONE = CANVAS_PADDING / 2; // center labels within the padding zone
const VIEWPORT_PADDING_PX = 8;
const MIN_CANVAS_ZOOM = 0.5;
const MAX_CANVAS_ZOOM = 2.5;
const CANVAS_ALERT_EVENT = 'canvas-alert';
const ZOOM_DECIMALS = 4;
// NOTE: react-zoom-pan-pinch 3.7.0 can throw in internal animation RAF paths
// in some environments. Keep transforms immediate until the dependency is upgraded.
const ZOOM_BUTTON_ANIMATION_MS = 0;
const ZOOM_FIT_ANIMATION_MS = 0;
const WHEEL_ZOOM_SENSITIVITY = 0.00125;
const DESKTOP_CANVAS_STAGE_GUTTER_PX = 72;
const MOBILE_CANVAS_STAGE_GUTTER_PX = 48;
const MOBILE_PANEL_CLEARANCE_PX = 96;
const TRANSFORM_WRAPPER_TEST_PROPS = { 'data-testid': 'canvas-transform-wrapper' } as HTMLAttributes<HTMLDivElement>;
const TRANSFORM_CONTENT_TEST_PROPS = { 'data-testid': 'canvas-transform-content' } as HTMLAttributes<HTMLDivElement>;

const DESKTOP_TOUR_STEPS = [
  {
    selector: '[data-testid="side-panel-left"]',
    title: '1. Pick A Bin',
    description: 'Use the Bin Catalog on the left to browse sizes. Drag a bin card to start placing.'
  },
  {
    selector: '[data-tour="canvas-drop-zone"]',
    title: '2. Drop On Canvas',
    description: 'Drop bins inside the drawer area. Bins snap to the grid and stay within bounds.'
  },
  {
    selector: '[data-tour="quick-actions-pill"]',
    title: '3. Use Quick Actions',
    description: 'Undo/redo, toggle grid, change grid size, suggest layout, clear everything, and change bin color.'
  },
  {
    selector: '[data-tour="tour-bin-editor"]',
    title: '4. Edit A Bin',
    description: 'Click a bin on the canvas to open this editor and adjust label, color, width, and length.'
  },
  {
    selector: '[data-testid="side-panel-right"]',
    title: '5. Review Summary',
    description: 'Use the right panel for drawer settings, placed item groups, export/share actions, and Etsy cart.'
  }
] as const;

const MOBILE_TOUR_STEPS = [
  {
    selector: '[data-testid="mobile-tab-catalog"]',
    title: '1. Open The Catalog',
    description: 'Tap the Catalog tab to browse bin sizes.'
  },
  {
    selector: '[data-tour="canvas-drop-zone"]',
    title: '2. Drop On Canvas',
    description: 'Drop bins inside the drawer area. Bins snap to the grid and stay within bounds.'
  },
  {
    selector: '[data-tour="quick-actions-pill"]',
    title: '3. Use Quick Actions',
    description: 'Undo/redo, grid, suggest layout, clear, and paint are always within reach.'
  },
  {
    selector: '[data-testid="mobile-tab-summary"]',
    title: '4. Review Summary',
    description: 'Use the Summary tab for drawer settings, item groups, export/share actions, and Etsy cart.'
  }
] as const;

const toastToneClassName = cva('', {
  variants: {
    tone: {
      info: styles.toastInfo,
      error: styles.toastError
    }
  }
});

const canvasAlertToneClassName = cva('', {
  variants: {
    tone: {
      info: styles.canvasAlertInfo,
      error: styles.canvasAlertError
    }
  }
});

const modalSizeClassName = cva(styles.howToModal, {
  variants: {
    mobile: {
      true: styles.howToModalMobile,
      false: styles.howToModalDesktop
    }
  }
});

type CanvasProps = {
  isMobileLayout?: boolean;
  hideQuickActions?: boolean;
  mobileBottomInsetPx?: number;
  layoutResizeKey?: number;
};

export function Canvas({
  isMobileLayout = false,
  hideQuickActions = false,
  mobileBottomInsetPx = 0,
  layoutResizeKey = 0
}: CanvasProps = {}) {
  const {
    placements,
    bins,
    drawerWidth,
    drawerLength,
    addPlacement,
    movePlacement,
    updatePlacement,
    updatePlacements,
    removePlacements,
    clearPlacements,
    activePlacementEditor,
    openPlacementEditor,
    closePlacementEditor,
    undo,
    redo,
    canUndo,
    canRedo,
    suggestLayout
  } = useLayout();

  const debugLog = (...args: unknown[]) => {
    if (import.meta.env.DEV && import.meta.env.MODE !== 'test') {
      console.log(...args);
    }
  };

  const [showGrid, setShowGrid] = useState(true);
  const [snap, setSnap] = useState(DEFAULT_SNAP);
  const [snapDraft, setSnapDraft] = useState(String(DEFAULT_SNAP));
  const [snapHelper, setSnapHelper] = useState<string | null>(null);
  const [suggestMode, setSuggestMode] = useState<'pack' | 'random'>('pack');
  const [toast, setToast] = useState<{ type: 'info' | 'error'; message: string } | null>(null);
  const [canvasAlert, setCanvasAlert] = useState<{ type: 'info' | 'error'; message: string } | null>(null);
  const [suggestStatus, setSuggestStatus] = useState<'packing' | 'randomizing' | null>(null);
  const [binGhost, setBinGhost] = useState<{
    x: number;
    y: number;
    width: number;
    length: number;
    fits: boolean;
    outOfBounds: boolean;
  } | null>(null);
  const [dragStatus, setDragStatus] = useState<{ placementId: string; fits: boolean } | null>(null);
  const [paintMode, setPaintMode] = useState(false);
  const [paintColorDraft, setPaintColorDraft] = useState(DEFAULT_BIN_COLOR);
  const [paintColorSelection, setPaintColorSelection] = useState<string>(DEFAULT_BIN_COLOR);
  const [canvasZoom, setCanvasZoom] = useState(1);
  const [canvasPosition, setCanvasPosition] = useState<Point>({ x: 0, y: 0 });
  const [homeZoom, setHomeZoom] = useState(1);
  const [highlight, setHighlight] = useState<{ id: string; type: 'info' | 'error' } | null>(null);
  const [quickActionsOpen, setQuickActionsOpen] = useState(true);
  const [quickActionsMode, setQuickActionsMode] = useState<'mini' | 'full'>(() =>
    isMobileLayout ? 'mini' : 'full'
  );
  const [quickActionsTabbable, setQuickActionsTabbable] = useState(isMobileLayout);
  const [isPanningCanvas, setIsPanningCanvas] = useState(false);
  const [howToModalOpen, setHowToModalOpen] = useState(false);
  const [tourActive, setTourActive] = useState(false);
  const disableQuickActions = tourActive;
  const hasPlacements = placements.length > 0;
  const isQuickActionsMini = isMobileLayout && quickActionsMode === 'mini';
  const quickActionsTabIndex = !isMobileLayout && !quickActionsTabbable ? -1 : 0;
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const [tourTargetRect, setTourTargetRect] = useState<DOMRect | null>(null);
  const mobileBottomSafeInsetPx = isMobileLayout
    ? Math.max(mobileBottomInsetPx, MOBILE_PANEL_CLEARANCE_PX)
    : mobileBottomInsetPx;
  const canvasViewportRef = useRef<HTMLDivElement | null>(null);
  const transformRef = useRef<ReactZoomPanPinchContentRef | null>(null);
  const dropAreaRef = useRef<HTMLDivElement | null>(null);
  const lastFrameRef = useRef<number>(0);
  const activeDragRef = useRef<DragItem | null>(null);
  const pointerOriginRef = useRef<Point | null>(null);
  const dragOffsetRef = useRef<Point | null>(null);
  const originPlacementRef = useRef<Point | null>(null);
  const canvasZoomRef = useRef(canvasZoom);
  const canvasPositionRef = useRef<Point>({ x: 0, y: 0 });
  const panStateRef = useRef<{ pointerId: number; x: number; y: number; originX: number; originY: number } | null>(null);
  const suppressClickUntilRef = useRef(0);
  const snapInputRef = useRef<HTMLInputElement | null>(null);
  const highlightTimeoutRef = useRef<number | null>(null);
  const previousLayoutModeRef = useRef(isMobileLayout);
  const wheelZoomRafRef = useRef<number | null>(null);
  const wheelZoomDeltaRef = useRef(0);
  const wheelZoomPointerRef = useRef<Point | undefined>(undefined);
  const undoHintShownRef = useRef(false);
  const undoHintPendingRef = useRef(false);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (canUndo && !undoHintShownRef.current) {
      if (!toast) {
        setToast({ type: 'info', message: 'Undo available (Ctrl/Cmd+Z).' });
        undoHintShownRef.current = true;
      } else {
        undoHintPendingRef.current = true;
      }
    }
  }, [canUndo, toast]);

  useEffect(() => {
    if (!toast && undoHintPendingRef.current && !undoHintShownRef.current) {
      setToast({ type: 'info', message: 'Undo available (Ctrl/Cmd+Z).' });
      undoHintShownRef.current = true;
      undoHintPendingRef.current = false;
    }
  }, [toast]);

  useEffect(() => {
    if (!canvasAlert) return;
    const id = window.setTimeout(() => setCanvasAlert(null), 2200);
    return () => window.clearTimeout(id);
  }, [canvasAlert]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ type: 'info' | 'error'; message: string }>).detail;
      if (!detail?.message) return;
      setCanvasAlert(detail);
    };
    window.addEventListener(CANVAS_ALERT_EVENT, handler as EventListener);
    return () => window.removeEventListener(CANVAS_ALERT_EVENT, handler as EventListener);
  }, []);

  useEffect(() => {
    if (placements.length === 0) {
      setSuggestMode('pack');
      setPaintMode(false);
    }
  }, [placements.length]);

  useEffect(() => {
    if (isMobileLayout) {
      setQuickActionsOpen(true);
    }
  }, [isMobileLayout]);

  useEffect(() => {
    if (isMobileLayout) {
      setQuickActionsMode('mini');
    } else {
      setQuickActionsMode('full');
    }
  }, [isMobileLayout]);

  useEffect(() => {
    if (!isMobileLayout) return;
    if (!quickActionsOpen) {
      setQuickActionsMode('mini');
    }
  }, [isMobileLayout, quickActionsOpen]);

  useEffect(() => {
    if (isMobileLayout) {
      setQuickActionsTabbable(true);
    }
  }, [isMobileLayout]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => setQuickActionsTabbable(true);
    window.addEventListener('quick-actions-focus', handler);
    return () => window.removeEventListener('quick-actions-focus', handler);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const openHowTo = () => setHowToModalOpen(true);
    window.addEventListener(OPEN_HOW_TO_EVENT, openHowTo);
    return () => window.removeEventListener(OPEN_HOW_TO_EVENT, openHowTo);
  }, []);

  useEffect(() => {
    if (!howToModalOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setHowToModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [howToModalOpen]);

  useEffect(() => {
    canvasZoomRef.current = canvasZoom;
  }, [canvasZoom]);

  useEffect(() => {
    canvasPositionRef.current = canvasPosition;
  }, [canvasPosition]);

  useEffect(() => {
    if (snapInputRef.current && document.activeElement === snapInputRef.current) return;
    setSnapDraft(String(snap));
  }, [snap]);

  const canvasStageGutterPx = isMobileLayout ? MOBILE_CANVAS_STAGE_GUTTER_PX : DESKTOP_CANVAS_STAGE_GUTTER_PX;

  const clampZoom = useCallback((value: number) => {
    const clamped = Math.max(MIN_CANVAS_ZOOM, Math.min(MAX_CANVAS_ZOOM, value));
    return Number(clamped.toFixed(ZOOM_DECIMALS));
  }, []);

  const zoomCanvas = useCallback(
    (nextZoom: number, pointer?: Point, animationMs = ZOOM_BUTTON_ANIMATION_MS) => {
      const viewport = canvasViewportRef.current;
      const transform = transformRef.current;
      const previousZoom = canvasZoomRef.current;
      const targetZoom = clampZoom(nextZoom);
      if (targetZoom === previousZoom) return;

      if (!viewport || !transform) {
        canvasZoomRef.current = targetZoom;
        setCanvasZoom(targetZoom);
        return;
      }

      const rect = viewport.getBoundingClientRect();
      const anchorX = pointer
        ? Math.min(viewport.clientWidth, Math.max(0, pointer.x - rect.left))
        : viewport.clientWidth / 2;
      const anchorY = pointer
        ? Math.min(viewport.clientHeight, Math.max(0, pointer.y - rect.top))
        : viewport.clientHeight / 2;
      const currentPosition = canvasPositionRef.current;
      const zoomRatio = targetZoom / previousZoom;
      const nextPositionX = anchorX - (anchorX - currentPosition.x) * zoomRatio;
      const nextPositionY = anchorY - (anchorY - currentPosition.y) * zoomRatio;
      transform.setTransform(nextPositionX, nextPositionY, targetZoom, animationMs, 'easeOut');
    },
    [clampZoom]
  );

  const getFitZoom = useCallback(() => {
    const viewport = canvasViewportRef.current;
    if (!viewport) return null;
    const baseWidth = drawerWidth * GRID_SIZE + CANVAS_PADDING * 2 + canvasStageGutterPx * 2;
    const baseHeight = drawerLength * GRID_SIZE + CANVAS_PADDING * 2 + canvasStageGutterPx * 2;
    if (baseWidth <= 0 || baseHeight <= 0) return null;
    const availableWidth = Math.max(120, viewport.clientWidth - 24);
    const availableHeight = Math.max(120, viewport.clientHeight - 24);
    return clampZoom(Math.min(availableWidth / baseWidth, availableHeight / baseHeight));
  }, [canvasStageGutterPx, clampZoom, drawerLength, drawerWidth]);

  const fitCanvasInView = useCallback(() => {
    const transform = transformRef.current;
    const fitZoom = getFitZoom();
    if (fitZoom != null) {
      setHomeZoom(fitZoom);
    }
    if (!transform || fitZoom == null) return;
    transform.centerView(fitZoom, ZOOM_FIT_ANIMATION_MS, 'easeOut');
  }, [getFitZoom]);

  const handleSuggestLayout = useCallback(() => {
    setSuggestStatus(suggestMode === 'pack' ? 'packing' : 'randomizing');
    const mode = suggestMode;
    const result = suggestLayout(mode);
    window.setTimeout(() => setSuggestStatus(null), 700);
    if (result.status === 'blocked') {
      setToast({ type: 'error', message: 'No layout fits all bins in the drawer.' });
      return;
    }
    if (mode === 'pack') {
      setSuggestMode('random');
    }
    if (result.moved === 0) {
      setToast({
        type: 'info',
        message: mode === 'pack' ? 'Bins already packed.' : 'Random layout matched current layout.'
      });
      return;
    }
    setToast({ type: 'info', message: mode === 'pack' ? 'Bins packed together.' : 'Random layout applied.' });
  }, [suggestLayout, suggestMode]);

  const handleClearLayout = useCallback(() => {
    if (placements.length === 0) return;
    clearPlacements();
    setToast({ type: 'info', message: 'Layout cleared. Use Undo to restore.' });
  }, [clearPlacements, placements.length]);

  const triggerHighlight = useCallback((placementId: string, type: 'info' | 'error' = 'info') => {
    setHighlight({ id: placementId, type });
    if (highlightTimeoutRef.current != null) {
      window.clearTimeout(highlightTimeoutRef.current);
    }
    highlightTimeoutRef.current = window.setTimeout(() => {
      setHighlight(null);
      highlightTimeoutRef.current = null;
    }, 1200);
  }, []);

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current != null) {
        window.clearTimeout(highlightTimeoutRef.current);
        highlightTimeoutRef.current = null;
      }
    };
  }, []);

  const suggestModeLabel = suggestMode === 'pack' ? 'Pack' : 'Random';
  const layoutControlsDisabled = !hasPlacements;
  const {
    getPlacementSize,
    editor,
    editorRef,
    labelInputRef,
    selectedCount,
    selectedPlacement,
    selectedSize,
    editorPosition,
    labelDraft,
    setLabelDraft,
    colorDraft,
    colorSelection,
    resizeError,
    closeEditor,
    openEditorForPlacement,
    commitLabel,
    handleColorChange,
    handleColorSelectionChange,
    handleResize,
    deleteSelectedPlacements,
    sizeStep,
    minBinSize,
    maxBinSize
  } = useCanvasController({
    placements,
    bins,
    activePlacementEditor,
    closePlacementEditor,
    openPlacementEditor,
    updatePlacements,
    removePlacements,
    triggerHighlight,
    setToast,
    isMobileLayout,
    layoutResizeKey,
    mobileBottomSafeInsetPx,
    canvasViewportRef
  });

  const togglePaintMode = () => {
    setPaintMode((active) => {
      const next = !active;
      if (next) closeEditor();
      return next;
    });
  };

  const handlePaintColorSelectionChange = (value: string) => {
    setPaintColorSelection(value);
    if (value === CUSTOM_COLOR_VALUE) return;
    setPaintColorDraft(value);
  };

  const handlePaintColorChange = (value: string) => {
    const normalizedColor = normalizeHexColor(value);
    setPaintColorDraft(normalizedColor);
    setPaintColorSelection(getColorSelection(normalizedColor));
  };

  const getActivePaintColor = () =>
    paintColorSelection === CUSTOM_COLOR_VALUE ? paintColorDraft : paintColorSelection;

  const paintPlacement = (placementId: string) => {
    if (!paintMode) return;
    updatePlacement(placementId, { color: getActivePaintColor() });
    triggerHighlight(placementId, 'info');
  };

  useEffect(() => {
    if (!paintMode) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-testid="placed-bin"]')) return;
      if (target.closest('[data-testid="paint-mode-toggle"]')) return;
      if (target.closest('[data-testid="paint-color-select"]')) return;
      if (target.closest('[data-testid="paint-color-custom"]')) return;
      setPaintMode(false);
    };
    window.addEventListener('pointerdown', handlePointerDown, true);
    return () => window.removeEventListener('pointerdown', handlePointerDown, true);
  }, [paintMode]);

  const tourSteps = isMobileLayout ? MOBILE_TOUR_STEPS : DESKTOP_TOUR_STEPS;

  const stopTour = useCallback(() => {
    setTourActive(false);
    setTourTargetRect(null);
  }, []);

  const startTour = () => {
    setHowToModalOpen(false);
    if (isMobileLayout) {
      setQuickActionsOpen(true);
    }
    setTourStepIndex(0);
    setTourActive(true);
  };

  const nextTourStep = () => {
    if (tourStepIndex >= tourSteps.length - 1) {
      stopTour();
      return;
    }
    setTourStepIndex((current) => Math.min(current + 1, tourSteps.length - 1));
  };

  const previousTourStep = () => {
    setTourStepIndex((current) => Math.max(0, current - 1));
  };

  const activeTourStep = tourActive ? tourSteps[tourStepIndex] : null;
  const updateTourTarget = useCallback(
    (scrollIntoView: boolean) => {
      if (!activeTourStep) {
        setTourTargetRect(null);
        return;
      }
      const target = document.querySelector(activeTourStep.selector) as HTMLElement | null;
      if (!target) {
        setTourTargetRect(null);
        return;
      }
      if (scrollIntoView) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      }
      setTourTargetRect(target.getBoundingClientRect());
    },
    [activeTourStep]
  );

  useEffect(() => {
    if (!tourActive) return;
    updateTourTarget(true);
    const id = window.setTimeout(() => updateTourTarget(false), 220);
    return () => window.clearTimeout(id);
  }, [tourActive, tourStepIndex, updateTourTarget]);

  useEffect(() => {
    if (!tourActive) return;
    if (tourStepIndex > tourSteps.length - 1) {
      setTourStepIndex(0);
    }
  }, [tourActive, tourStepIndex, tourSteps.length]);

  useEffect(() => {
    const previous = previousLayoutModeRef.current;
    previousLayoutModeRef.current = isMobileLayout;
    if (tourActive && previous !== isMobileLayout) {
      stopTour();
    }
  }, [isMobileLayout, stopTour, tourActive]);

  useEffect(() => {
    if (!tourActive) return;
    const handlePositionUpdate = () => updateTourTarget(false);
    window.addEventListener('resize', handlePositionUpdate);
    window.addEventListener('scroll', handlePositionUpdate, true);
    return () => {
      window.removeEventListener('resize', handlePositionUpdate);
      window.removeEventListener('scroll', handlePositionUpdate, true);
    };
  }, [tourActive, updateTourTarget]);

  const tourPopoverPosition = useMemo(() => {
    if (!tourTargetRect) {
      return { top: 20, left: 20 };
    }
    const popoverWidth = 320;
    const popoverHeight = 190;
    const spacing = 12;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = tourTargetRect.left;
    if (left + popoverWidth + VIEWPORT_PADDING_PX > viewportWidth) {
      left = viewportWidth - popoverWidth - VIEWPORT_PADDING_PX;
    }
    left = Math.max(VIEWPORT_PADDING_PX, left);

    let top = tourTargetRect.bottom + spacing;
    if (top + popoverHeight + VIEWPORT_PADDING_PX > viewportHeight) {
      top = tourTargetRect.top - popoverHeight - spacing;
    }
    top = Math.max(VIEWPORT_PADDING_PX, top);

    return { top, left };
  }, [tourTargetRect]);

  const gridSize = GRID_SIZE;
  const scaledGridSize = GRID_SIZE * canvasZoom;
  const dropAreaSize = useMemo(
    () => ({ widthPx: drawerWidth * gridSize, heightPx: drawerLength * gridSize }),
    [drawerWidth, drawerLength, gridSize]
  );
  const canvasSize = useMemo(
    () => ({
      widthPx: dropAreaSize.widthPx + CANVAS_PADDING * 2,
      heightPx: dropAreaSize.heightPx + CANVAS_PADDING * 2
    }),
    [dropAreaSize]
  );
  const canvasStageSize = useMemo(
    () => ({
      widthPx: canvasSize.widthPx + canvasStageGutterPx * 2,
      heightPx: canvasSize.heightPx + canvasStageGutterPx * 2
    }),
    [canvasSize.heightPx, canvasSize.widthPx, canvasStageGutterPx]
  );

  const { setNodeRef: setDropNodeRef } = useDroppable({ id: 'drop-area' });

  const clampSnap = (value: number) => Math.max(SNAP_MIN, Math.min(SNAP_MAX, value));
  const snapValue = clampSnap(snap);
  const gridStepPx = gridSize * snapValue;
  const applySnap = (value: number) => Math.round(value / snapValue) * snapValue;
  const snapToBounds = (value: number, max: number) => {
    if (value <= snapValue) return 0;
    if (max - value <= snapValue) return max;
    return applySnap(value);
  };

  const handleSnapInputChange = (value: string) => {
    setSnapDraft(value);
    setSnapHelper(null);
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return;
    if (numeric < SNAP_MIN || numeric > SNAP_MAX) return;
    setSnap(numeric);
  };

  const commitSnapInput = () => {
    const numeric = Number(snapDraft);
    const fallback = DEFAULT_SNAP;
    if (!Number.isFinite(numeric)) {
      setSnap(fallback);
      setSnapDraft(String(fallback));
      setSnapHelper(`Enter ${SNAP_MIN}\u2013${SNAP_MAX} in.`);
      return;
    }
    const clamped = clampSnap(numeric);
    setSnap(clamped);
    setSnapDraft(String(clamped));
    setSnapHelper(clamped !== numeric ? `Clamped to ${SNAP_MIN}\u2013${SNAP_MAX} in.` : null);
  };

  const handleCanvasInit = useCallback((ref: ReactZoomPanPinchRef) => {
    transformRef.current = ref;
    const { scale, positionX, positionY } = ref.state;
    canvasZoomRef.current = scale;
    canvasPositionRef.current = { x: positionX, y: positionY };
    setCanvasZoom(scale);
    setCanvasPosition({ x: positionX, y: positionY });
    window.requestAnimationFrame(() => fitCanvasInView());
  }, [fitCanvasInView]);

  const handleCanvasTransformed = useCallback(
    (_ref: ReactZoomPanPinchRef, state: { scale: number; positionX: number; positionY: number }) => {
      const nextScale = clampZoom(state.scale);
      canvasZoomRef.current = nextScale;
      canvasPositionRef.current = { x: state.positionX, y: state.positionY };
      setCanvasZoom(nextScale);
      setCanvasPosition({ x: state.positionX, y: state.positionY });
    },
    [clampZoom]
  );

  useEffect(() => {
    const id = window.requestAnimationFrame(() => fitCanvasInView());
    return () => window.cancelAnimationFrame(id);
  }, [fitCanvasInView, drawerWidth, drawerLength, layoutResizeKey]);

  const quickActionsAvailable = !(hideQuickActions && isMobileLayout);
  const homeZoomPercent = Math.round(homeZoom * 100);

  const shouldStartCanvasPan = useCallback((target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;
    if (target.closest('[data-testid="placement-editor"]')) return false;
    if (target.closest('[data-testid="how-to-modal"]')) return false;
    if (target.closest('[data-tour="quick-actions-pill"]')) return false;
    if (target.closest('button, input, select, textarea, a, [role="button"], [contenteditable="true"]')) {
      return false;
    }
    return true;
  }, []);

  const isTypingTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;
    const tagName = target.tagName;
    const role = target.getAttribute('role');
    return (
      tagName === 'INPUT' ||
      tagName === 'TEXTAREA' ||
      tagName === 'SELECT' ||
      role === 'textbox' ||
      target.isContentEditable
    );
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (tourActive) return;
      if (isTypingTarget(event.target)) return;
      if (event.key === 'Enter' || event.key === ' ') {
        const target = event.target instanceof HTMLElement ? event.target : null;
        const placementNode = target?.closest('[data-testid="placed-bin"]') as HTMLElement | null;
        const placementId = placementNode?.getAttribute('data-placement-id');
        if (placementNode && placementId) {
          event.preventDefault();
          openEditorForPlacement(placementId, placementNode);
          return;
        }
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === 'g') {
        event.preventDefault();
        setShowGrid((prev) => !prev);
      }
      if (key === 's') {
        if (placements.length === 0) return;
        event.preventDefault();
        handleSuggestLayout();
      }
      if (key === 'c') {
        if (placements.length === 0) return;
        event.preventDefault();
        handleClearLayout();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleClearLayout, handleSuggestLayout, openEditorForPlacement, placements.length, tourActive]);

  const handleCanvasPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (tourActive || paintMode || event.pointerType === 'touch' || event.button !== 0) return;
    if (!shouldStartCanvasPan(event.target)) return;
    panStateRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      originX: canvasPositionRef.current.x,
      originY: canvasPositionRef.current.y
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsPanningCanvas(true);
    event.preventDefault();
  };

  const handleCanvasPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pan = panStateRef.current;
    const transform = transformRef.current;
    if (!pan || !transform || pan.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - pan.x;
    const deltaY = event.clientY - pan.y;
    transform.setTransform(pan.originX + deltaX, pan.originY + deltaY, canvasZoomRef.current, 0);
  };

  const handleCanvasPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pan = panStateRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    panStateRef.current = null;
    setIsPanningCanvas(false);
  };

  const handleWheelZoom = useCallback((event: WheelEvent) => {
    if (tourActive || paintMode) return;
    if (!shouldStartCanvasPan(event.target)) return;
    event.preventDefault();
    const normalizedDeltaY = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
    wheelZoomDeltaRef.current += normalizedDeltaY;
    wheelZoomPointerRef.current = { x: event.clientX, y: event.clientY };
    if (wheelZoomRafRef.current != null) return;
    wheelZoomRafRef.current = window.requestAnimationFrame(() => {
      const deltaY = wheelZoomDeltaRef.current;
      const anchor = wheelZoomPointerRef.current;
      wheelZoomDeltaRef.current = 0;
      wheelZoomPointerRef.current = undefined;
      wheelZoomRafRef.current = null;
      const zoomFactor = Math.exp(-deltaY * WHEEL_ZOOM_SENSITIVITY);
      zoomCanvas(canvasZoomRef.current * zoomFactor, anchor, 0);
    });
  }, [paintMode, shouldStartCanvasPan, tourActive, zoomCanvas]);

  useEffect(() => {
    const viewport = canvasViewportRef.current;
    if (!viewport) return;
    // Use a native non-passive listener so wheel zoom can cancel page scrolling.
    viewport.addEventListener('wheel', handleWheelZoom, { passive: false });
    return () => {
      viewport.removeEventListener('wheel', handleWheelZoom);
    };
  }, [handleWheelZoom]);

  useEffect(() => {
    return () => {
      if (wheelZoomRafRef.current != null) {
        window.cancelAnimationFrame(wheelZoomRafRef.current);
      }
    };
  }, []);

  const getDrawerScalePx = useCallback(() => {
    const dropArea = dropAreaRef.current;
    if (!dropArea || drawerWidth <= 0 || drawerLength <= 0) return null;
    const rect = dropArea.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: rect.width / drawerWidth,
      y: rect.height / drawerLength
    };
  }, [drawerLength, drawerWidth]);

  const attachDropAreaRef = (node: HTMLDivElement | null) => {
    dropAreaRef.current = node;
    setDropNodeRef(node);
  };

  const invalidPlacementIds = useMemo(() => {
    const invalid = new Set<string>();
    const sizedPlacements = placements
      .map((placement) => {
        const size = getPlacementSize(placement);
        if (!size) return null;
        return { placement, size };
      })
      .filter(Boolean) as Array<{ placement: Placement; size: { width: number; length: number } }>;

    sizedPlacements.forEach(({ placement, size }) => {
      if (
        placement.x < 0 ||
        placement.y < 0 ||
        placement.x + size.width > drawerWidth ||
        placement.y + size.length > drawerLength
      ) {
        invalid.add(placement.id);
      }
    });

    for (let i = 0; i < sizedPlacements.length; i += 1) {
      const a = sizedPlacements[i];
      for (let j = i + 1; j < sizedPlacements.length; j += 1) {
        const b = sizedPlacements[j];
        const overlap =
          a.placement.x < b.placement.x + b.size.width &&
          a.placement.x + a.size.width > b.placement.x &&
          a.placement.y < b.placement.y + b.size.length &&
          a.placement.y + a.size.length > b.placement.y;
        if (overlap) {
          invalid.add(a.placement.id);
          invalid.add(b.placement.id);
        }
      }
    }

    return invalid;
  }, [placements, drawerWidth, drawerLength, getPlacementSize]);

  const isTouchEvent = (e: Event): e is TouchEvent =>
    typeof TouchEvent !== 'undefined' && (e instanceof TouchEvent || 'touches' in e || 'changedTouches' in e);

  const getPointFromEvent = (event: Event | null | undefined): Point | null => {
    if (!event) return null;
    if ('clientX' in event && 'clientY' in event) {
      const e = event as MouseEvent | PointerEvent;
      return { x: e.clientX, y: e.clientY };
    }
    if (isTouchEvent(event)) {
      const t = event.touches?.[0] ?? event.changedTouches?.[0];
      if (t) return { x: t.clientX, y: t.clientY };
    }
    return null;
  };

  const computeDropPosition = (point: Point, drag: DragItem) => {
    if (!dropAreaRef.current) return null;
    const rect = dropAreaRef.current.getBoundingClientRect();
    const scalePx = getDrawerScalePx();
    if (!scalePx) return null;
    const offset = dragOffsetRef.current ?? { x: 0, y: 0 };
    const rawX = (point.x - rect.left - offset.x) / scalePx.x;
    const rawY = (point.y - rect.top - offset.y) / scalePx.y;
    const size =
      drag.type === 'bin'
        ? (() => {
            const bin = bins.find((b) => b.id === drag.binId);
            if (!bin) return null;
            return { width: bin.width, length: bin.length };
          })()
        : (() => {
            const placement = placements.find((p) => p.id === drag.placementId);
            if (!placement) return null;
            return getPlacementSize(placement);
          })();
    if (!size) return null;
    const maxX = Math.max(0, drawerWidth - size.width);
    const maxY = Math.max(0, drawerLength - size.length);
    const isOutOfBounds =
      rawX < 0 ||
      rawY < 0 ||
      rawX + size.width > drawerWidth ||
      rawY + size.length > drawerLength;
    const snappedX = snapToBounds(rawX, maxX);
    const snappedY = snapToBounds(rawY, maxY);
    const x = Math.max(0, Math.min(snappedX, maxX));
    const y = Math.max(0, Math.min(snappedY, maxY));
    return { rawX, rawY, x, y, size, isOutOfBounds };
  };

  const computePlacementTargetFromDelta = (delta: Point, drag: DragItem) => {
    if (drag.type !== 'placement' || !originPlacementRef.current) return null;
    const placement = placements.find((p) => p.id === drag.placementId);
    if (!placement) return null;
    const size = getPlacementSize(placement);
    if (!size) return null;
    const scalePx = getDrawerScalePx() ?? { x: scaledGridSize, y: scaledGridSize };
    const rawX = originPlacementRef.current.x + delta.x / scalePx.x;
    const rawY = originPlacementRef.current.y + delta.y / scalePx.y;
    const maxX = Math.max(0, drawerWidth - size.width);
    const maxY = Math.max(0, drawerLength - size.length);
    const isOutOfBounds =
      rawX < 0 ||
      rawY < 0 ||
      rawX + size.width > drawerWidth ||
      rawY + size.length > drawerLength;
    const snappedX = snapToBounds(rawX, maxX);
    const snappedY = snapToBounds(rawY, maxY);
    const x = Math.max(0, Math.min(snappedX, maxX));
    const y = Math.max(0, Math.min(snappedY, maxY));
    return { rawX, rawY, x, y, size, isOutOfBounds };
  };

  const getDragDelta = (event: {
    active: { rect: { current: { initial: { left: number; top: number } | null; translated: { left: number; top: number } | null } } };
    delta: Point;
  }) => {
    const initial = event.active.rect.current.initial;
    const translated = event.active.rect.current.translated;
    if (initial && translated) {
      return { x: translated.left - initial.left, y: translated.top - initial.top };
    }
    return event.delta;
  };

  const hasCollisionAt = (bin: { width: number; length: number }, x: number, y: number, ignoreId?: string) =>
    placements.some((p) => {
      if (ignoreId && p.id === ignoreId) return false;
      const otherSize = getPlacementSize(p);
      if (!otherSize) return false;
      return (
        x < p.x + otherSize.width &&
        x + bin.width > p.x &&
        y < p.y + otherSize.length &&
        y + bin.length > p.y
      );
    });

  const finalizeDrop = (point: Point, drag: DragItem) => {
    const drop = computeDropPosition(point, drag);
    if (!drop) return;
    const { rawX, rawY, x: dropX, y: dropY, isOutOfBounds } = drop;
    debugLog('raw target (in)', { x: rawX, y: rawY });
    debugLog('clamped target (in)', { x: dropX, y: dropY });

    if (drag.type === 'bin') {
      const result = addPlacement(drag.binId, dropX, dropY);
      debugLog('drop result status', result.status);
      if (result.status === 'blocked') {
        const message = 'No room for that bin.';
        setToast({ type: 'error', message });
        setCanvasAlert({ type: 'error', message });
      }
      if (result.status === 'autofit') {
        setToast({ type: 'info', message: 'Placed in nearest available spot.' });
        if (result.placementId) {
          triggerHighlight(result.placementId, 'info');
        }
      }
      if (result.status === 'placed' && isOutOfBounds) {
        setToast({ type: 'info', message: 'Dropped outside drawer — snapped to edge.' });
      }
      if (result.position) {
        debugLog('drop new placement position (in)', { x: result.position.x, y: result.position.y });
      } else {
        debugLog('drop new placement position (in)', { x: dropX, y: dropY });
      }
      return;
    }

    if (drag.type === 'placement') {
      const result = movePlacement(drag.placementId, dropX, dropY);
      debugLog('drop result status', result.status);
      if (result.status === 'blocked') {
        setToast({ type: 'error', message: 'Cannot move there — space is full.' });
        triggerHighlight(drag.placementId, 'error');
      }
      if (result.status === 'autofit') {
        setToast({ type: 'info', message: 'Moved to nearest available spot.' });
        triggerHighlight(drag.placementId, 'info');
      }
      if (result.status === 'placed' && isOutOfBounds) {
        setToast({ type: 'info', message: 'Dropped outside drawer — snapped to edge.' });
      }
      if (result.position) {
        debugLog('Actual drop moved placement position (in)', { x: result.position.x, y: result.position.y });
      } else {
        debugLog('Actual drop moved placement position (in)', { x: dropX, y: dropY });
      }
    }
  };

  useDndMonitor({
    onDragStart(event) {
      const drag = event.active.data.current as DragItem | undefined;
      if (!drag) return;
      activeDragRef.current = drag;
      setBinGhost(null);
      const startPoint = getPointFromEvent(event.activatorEvent);
      pointerOriginRef.current = startPoint;
      if (drag.type === 'placement') {
        const placement = placements.find((p) => p.id === drag.placementId);
        if (placement) {
          debugLog('drag start placement position (in)', { x: placement.x, y: placement.y });
          originPlacementRef.current = { x: placement.x, y: placement.y };
        }
      }
      // Capture grab offset so placements don't jump when picked up.
      if (drag.type === 'placement' && startPoint) {
        const placement = placements.find((p) => p.id === drag.placementId);
        const dropRect = dropAreaRef.current?.getBoundingClientRect();
        const scalePx = getDrawerScalePx();
        if (placement && dropRect) {
          const unitX = scalePx?.x ?? scaledGridSize;
          const unitY = scalePx?.y ?? scaledGridSize;
          const topLeftX = dropRect.left + placement.x * unitX;
          const topLeftY = dropRect.top + placement.y * unitY;
          dragOffsetRef.current = { x: startPoint.x - topLeftX, y: startPoint.y - topLeftY };
        } else {
          dragOffsetRef.current = null;
        }
        if (placement) {
          setDragStatus({ placementId: placement.id, fits: true });
        }
      } else {
        dragOffsetRef.current = null;
        setDragStatus(null);
      }
    },
    onDragMove(event) {
      const drag = activeDragRef.current;
      if (!drag) return;

      const now = performance.now();
      if (now - lastFrameRef.current < FRAME_THROTTLE_MS) return;
      lastFrameRef.current = now;

      const delta = getDragDelta(event);
      if (drag.type === 'placement') {
        const drop = computePlacementTargetFromDelta(delta, drag);
        if (!drop) return;

        // Use unclamped-to-grid position for live overlap feedback so it flips as soon as boxes intersect.
        const liveX = Math.max(0, Math.min(drop.rawX, drawerWidth - drop.size.width));
        const liveY = Math.max(0, Math.min(drop.rawY, drawerLength - drop.size.length));
        const collision = hasCollisionAt(drop.size, liveX, liveY, drag.placementId);
        setDragStatus({
          placementId: drag.placementId,
          fits: !collision && !drop.isOutOfBounds
        });
        return;
      }

      if (drag.type === 'bin') {
        if (!pointerOriginRef.current) return;
        const point = applyDelta(pointerOriginRef.current, event.delta);
        const drop = computeDropPosition(point, drag);
        if (!drop) {
          setBinGhost(null);
          return;
        }
        const collision = hasCollisionAt(drop.size, drop.x, drop.y);
        setBinGhost({
          x: drop.x,
          y: drop.y,
          width: drop.size.width,
          length: drop.size.length,
          fits: !collision && !drop.isOutOfBounds,
          outOfBounds: drop.isOutOfBounds
        });
      }
    },
    onDragEnd(event) {
      if (!activeDragRef.current) return;
      setBinGhost(null);
      const delta = getDragDelta(event);
      debugLog('drag move delta (px)', { x: delta.x, y: delta.y });
      if (activeDragRef.current.type === 'placement' && originPlacementRef.current) {
        suppressClickUntilRef.current = performance.now() + 250;
        const scalePx = getDrawerScalePx() ?? { x: scaledGridSize, y: scaledGridSize };
        const expectedX = originPlacementRef.current.x + delta.x / scalePx.x;
        const expectedY = originPlacementRef.current.y + delta.y / scalePx.y;
        debugLog('expected moved placement position (in)', { x: expectedX, y: expectedY });
        const drop = computePlacementTargetFromDelta(delta, activeDragRef.current);
        if (drop) {
          debugLog('raw target (in)', { x: drop.rawX, y: drop.rawY });
          debugLog('clamped target (in)', { x: drop.x, y: drop.y });
          const result = movePlacement(activeDragRef.current.placementId, drop.x, drop.y);
          debugLog('drop result status', result.status);
          if (result.status === 'blocked') {
            setToast({ type: 'error', message: 'Cannot move there — space is full.' });
            triggerHighlight(activeDragRef.current.placementId, 'error');
          }
          if (result.status === 'autofit') {
            setToast({ type: 'info', message: 'Moved to nearest available spot.' });
            triggerHighlight(activeDragRef.current.placementId, 'info');
          }
          if (result.status === 'placed' && drop.isOutOfBounds) {
            setToast({ type: 'info', message: 'Dropped outside drawer — snapped to edge.' });
          }
          if (result.position) {
            debugLog('Actual drop moved placement position (in)', { x: result.position.x, y: result.position.y });
          } else {
            debugLog('Actual drop moved placement position (in)', { x: drop.x, y: drop.y });
          }
        }
      } else {
        if (!pointerOriginRef.current) {
          activeDragRef.current = null;
          pointerOriginRef.current = null;
          dragOffsetRef.current = null;
          originPlacementRef.current = null;
          setDragStatus(null);
          return;
        }
        const point = applyDelta(pointerOriginRef.current, event.delta);
        finalizeDrop(point, activeDragRef.current);
      }
      activeDragRef.current = null;
      pointerOriginRef.current = null;
      dragOffsetRef.current = null;
      originPlacementRef.current = null;
      setDragStatus(null);
    },
    onDragCancel() {
      activeDragRef.current = null;
      pointerOriginRef.current = null;
      dragOffsetRef.current = null;
      originPlacementRef.current = null;
      setDragStatus(null);
      setBinGhost(null);
    }
  });

  return (
    <div className={clsx(styles.canvasRoot, paintMode && styles.cursorCopy)}>
      {/* Canvas Area */}
      <div
        data-testid="canvas-scroll-container"
        data-canvas-scale={canvasZoom.toFixed(3)}
        data-canvas-x={canvasPosition.x.toFixed(1)}
        data-canvas-y={canvasPosition.y.toFixed(1)}
        className={clsx(
          styles.canvasScrollContainer,
          isMobileLayout && styles.canvasScrollContainerMobile,
          isMobileLayout && styles.hideScrollbar
        )}
        style={
          isMobileLayout && mobileBottomSafeInsetPx > 0
            ? { paddingBottom: `${mobileBottomSafeInsetPx}px` }
            : undefined
        }
      >
        <div
          ref={canvasViewportRef}
          className={clsx(
            styles.canvasViewport,
            paintMode ? styles.cursorCopy : isPanningCanvas ? styles.cursorGrabbing : styles.cursorGrab
          )}
          style={isMobileLayout ? { touchAction: 'none' } : undefined}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerEnd}
          onPointerCancel={handleCanvasPointerEnd}
          onLostPointerCapture={handleCanvasPointerEnd}
        >
          <TransformWrapper
            key={`${drawerWidth}-${drawerLength}`}
            minScale={MIN_CANVAS_ZOOM}
            maxScale={MAX_CANVAS_ZOOM}
            centerOnInit
            centerZoomedOut={false}
            limitToBounds={false}
            disablePadding
            disabled={tourActive}
            panning={{ disabled: !isMobileLayout, velocityDisabled: true }}
            wheel={{ disabled: true }}
            pinch={{ step: 5 }}
            doubleClick={{ disabled: true }}
            zoomAnimation={{ disabled: true, animationTime: 0 }}
            alignmentAnimation={{ disabled: true }}
            velocityAnimation={{ disabled: true }}
            onInit={handleCanvasInit}
            onTransformed={handleCanvasTransformed}
          >
            <TransformComponent
              wrapperClass={styles.transformWrapper}
              wrapperStyle={{ width: '100%', height: '100%' }}
              contentClass={styles.transformContent}
              wrapperProps={TRANSFORM_WRAPPER_TEST_PROPS}
              contentProps={TRANSFORM_CONTENT_TEST_PROPS}
            >
              <div
                className={styles.canvasStage}
                style={{
                  width: `${canvasStageSize.widthPx}px`,
                  height: `${canvasStageSize.heightPx}px`
                }}
              >
                <div
                  className={styles.canvasFrame}
                  style={{
                    left: `${canvasStageGutterPx}px`,
                    top: `${canvasStageGutterPx}px`,
                    width: `${canvasSize.widthPx}px`,
                    height: `${canvasSize.heightPx}px`
                  }}
                >
                  <div
                    className={styles.dimensionLabel}
                    style={{
                      left: CANVAS_PADDING + dropAreaSize.widthPx / 2,
                      top: LABEL_ZONE,
                      transform: 'translate(-50%, -50%)'
                    }}
                  >
                    <div className={styles.dimensionPill}>
                      {drawerWidth}" Width
                    </div>
                  </div>
                  <div
                    className={styles.dimensionLabel}
                    style={{
                      left: LABEL_ZONE,
                      top: CANVAS_PADDING + dropAreaSize.heightPx / 2,
                      transform: 'translate(-50%, -50%)'
                    }}
                  >
                    <div className={clsx(styles.dimensionPill, styles.dimensionPillVertical)}>
                      {drawerLength}" Length
                    </div>
                  </div>

                  <div id="canvas-instructions" className={styles.srOnly}>
                    Layout canvas. Drag bins from the catalog here. Keyboard: focus a catalog card
                    and press Enter to place a bin, then focus a placed bin and press Enter to edit.
                  </div>
                  <div
                    ref={attachDropAreaRef}
                    id="canvas-drop-zone"
                    role="region"
                    aria-label="Layout canvas"
                    aria-describedby="canvas-instructions"
                    tabIndex={0}
                    className={styles.dropArea}
                    style={{
                      left: CANVAS_PADDING,
                      top: CANVAS_PADDING,
                      width: `${dropAreaSize.widthPx}px`,
                      height: `${dropAreaSize.heightPx}px`
                    }}
                    data-testid="canvas-drop-area"
                    data-tour="canvas-drop-zone"
                    onFocus={() => setQuickActionsTabbable(true)}
                  >
                    {canvasAlert && (
                      <div
                        role={canvasAlert.type === 'error' ? 'alert' : 'status'}
                        aria-live={canvasAlert.type === 'error' ? 'assertive' : 'polite'}
                        className={clsx(
                          styles.canvasAlert,
                          canvasAlertToneClassName({ tone: canvasAlert.type })
                        )}
                      >
                        <AlertCircle className={styles.iconSm} />
                        {canvasAlert.message}
                      </div>
                    )}
                    {showGrid && (
                      <div
                        data-testid="grid-overlay"
                        className={styles.gridOverlay}
                        style={{
                          backgroundImage:
                            'linear-gradient(#14476B 1px, transparent 1px), linear-gradient(90deg, #14476B 1px, transparent 1px)',
                          backgroundSize: `${gridStepPx}px ${gridStepPx}px`
                        }}
                      />
                    )}

                    {binGhost && (
                      <div
                        data-testid="new-bin-ghost"
                        className={styles.newBinGhost}
                        style={{
                          left: `${binGhost.x * gridSize}px`,
                          top: `${binGhost.y * gridSize}px`,
                          width: `${binGhost.width * gridSize}px`,
                          height: `${binGhost.length * gridSize}px`,
                          border: `2px dashed ${binGhost.fits ? '#16a34a' : '#dc2626'}`,
                          backgroundColor: binGhost.fits ? 'rgba(22,163,74,0.08)' : 'rgba(220,38,38,0.08)',
                          boxShadow: `0 0 0 2px rgba(248, 250, 252, 0.8)`
                        }}
                      />
                    )}

                    {placements.map((placement) => {
                      const size = getPlacementSize(placement);
                      if (!size) return null;
                      return (
                      <DraggablePlacement
                        key={placement.id}
                        placement={placement}
                        size={size}
                        gridSize={gridSize}
                        zoom={canvasZoom}
                        dragStatus={dragStatus}
                        paintMode={paintMode}
                        isInvalid={invalidPlacementIds.has(placement.id)}
                        highlight={highlight}
                        shouldBlockClick={() => performance.now() < suppressClickUntilRef.current}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (paintMode) {
                            paintPlacement(placement.id);
                            return;
                            }
                            openPlacementEditor([placement.id], event.clientX, event.clientY);
                          }}
                        onKeyActivate={(element) => openEditorForPlacement(placement.id, element)}
                        />
                      );
                    })}

                    {placements.length === 0 && (
                      <div className={styles.emptyHint}>
                        Drag bins here
                      </div>
                    )}

                    <div className={styles.dropBorder} />
                  </div>
                </div>
              </div>
            </TransformComponent>
          </TransformWrapper>
        </div>
      </div>
      {!tourActive && howToModalOpen && (
        <>
          <div
            className={styles.howToBackdrop}
            onClick={() => setHowToModalOpen(false)}
            aria-hidden="true"
          />
          <div
            data-testid="how-to-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="how-to-modal-title"
            className={modalSizeClassName({ mobile: isMobileLayout })}
          >
            <div className={styles.howToHeader}>
              <div>
                <p className={styles.howToEyebrow}>How To Start</p>
                <h3 id="how-to-modal-title" className={styles.howToTitle}>
                  Build your first layout in under a minute
                </h3>
              </div>
              <button
                type="button"
                className={styles.howToCloseButton}
                onClick={() => setHowToModalOpen(false)}
                aria-label="Close how to"
              >
                <X className={styles.iconMd} />
              </button>
            </div>
            <ol className={styles.howToList}>
              <li>1. Drag a bin from the catalog to the canvas.</li>
              <li>2. Drop it in the drawer and repeat for more bins.</li>
              <li>3. Click any bin (or placed-item group) to edit size, color, and label.</li>
              <li>4. Use Export PDF or Copy Share Link from the Summary panel.</li>
              <li>5. Use Open Etsy Cart in the Summary panel when your list is ready.</li>
            </ol>
            <div className={styles.howToActions}>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setHowToModalOpen(false)}
              >
                Close
              </Button>
              <Button
                size="sm"
                onClick={startTour}
              >
                Take Tour
              </Button>
            </div>
          </div>
        </>
      )}

      {suggestStatus && (
        <div className={styles.statusChip}>
          {suggestStatus === 'packing' ? 'Packing bins…' : 'Randomizing layout…'}
        </div>
      )}

      {paintMode && (
        <button
          type="button"
          data-testid="paint-mode-chip"
          onClick={togglePaintMode}
          className={styles.paintModeChip}
          aria-label="Disable paint mode"
          title="Disable paint mode"
        >
          <span
            className={styles.paintModeSwatch}
            style={{ backgroundColor: getActivePaintColor() }}
            aria-hidden="true"
          />
          Paint On
          <span className={styles.paintModeExitHint}>Tap to exit</span>
        </button>
      )}

      {quickActionsAvailable && isMobileLayout && (
        <MobileQuickActions
          isOpen={quickActionsOpen}
          isMini={isQuickActionsMini}
          paintMode={paintMode}
          disableQuickActions={disableQuickActions}
          quickActionsTabIndex={quickActionsTabIndex}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={undo}
          onRedo={redo}
          showGrid={showGrid}
          onToggleGrid={() => setShowGrid((current) => !current)}
          snapInputRef={snapInputRef}
          snapDraft={snapDraft}
          snapHelper={snapHelper}
          onSnapInputChange={handleSnapInputChange}
          onCommitSnapInput={commitSnapInput}
          canvasZoomPercent={Math.round(canvasZoom * 100)}
          canZoomOut={canvasZoom > MIN_CANVAS_ZOOM}
          canZoomIn={canvasZoom < MAX_CANVAS_ZOOM}
          onZoomOut={() => zoomCanvas(canvasZoomRef.current - 0.1)}
          onZoomIn={() => zoomCanvas(canvasZoomRef.current + 0.1)}
          homeZoomPercent={homeZoomPercent}
          onHomeCanvas={fitCanvasInView}
          layoutControlsDisabled={layoutControlsDisabled}
          suggestModeLabel={suggestModeLabel}
          onSuggestLayout={handleSuggestLayout}
          onClearLayout={handleClearLayout}
          onTogglePaintMode={togglePaintMode}
          paintColorSelection={paintColorSelection}
          paintColorDraft={paintColorDraft}
          onPaintColorSelectionChange={handlePaintColorSelectionChange}
          onPaintColorChange={handlePaintColorChange}
          onToggleSize={() => setQuickActionsMode(isQuickActionsMini ? 'full' : 'mini')}
          onCollapse={() => setQuickActionsOpen(false)}
          onExpand={() => setQuickActionsOpen(true)}
        />
      )}

      {quickActionsAvailable && !isMobileLayout && (
        <DesktopQuickActions
          paintMode={paintMode}
          disableQuickActions={disableQuickActions}
          quickActionsTabIndex={quickActionsTabIndex}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={undo}
          onRedo={redo}
          showGrid={showGrid}
          onToggleGrid={() => setShowGrid((current) => !current)}
          snapInputRef={snapInputRef}
          snapDraft={snapDraft}
          snapHelper={snapHelper}
          onSnapInputChange={handleSnapInputChange}
          onCommitSnapInput={commitSnapInput}
          canvasZoomPercent={Math.round(canvasZoom * 100)}
          canZoomOut={canvasZoom > MIN_CANVAS_ZOOM}
          canZoomIn={canvasZoom < MAX_CANVAS_ZOOM}
          onZoomOut={() => zoomCanvas(canvasZoomRef.current - 0.1)}
          onZoomIn={() => zoomCanvas(canvasZoomRef.current + 0.1)}
          homeZoomPercent={homeZoomPercent}
          onHomeCanvas={fitCanvasInView}
          layoutControlsDisabled={layoutControlsDisabled}
          onSuggestLayout={handleSuggestLayout}
          onClearLayout={handleClearLayout}
          onTogglePaintMode={togglePaintMode}
          paintColorSelection={paintColorSelection}
          paintColorDraft={paintColorDraft}
          onPaintColorSelectionChange={handlePaintColorSelectionChange}
          onPaintColorChange={handlePaintColorChange}
        />
      )}

      {editor && editorPosition && selectedPlacement && selectedSize && (
        <PlacementEditor
          editorRef={editorRef}
          labelInputRef={labelInputRef}
          isMobileLayout={isMobileLayout}
          editorPosition={editorPosition}
          selectedCount={selectedCount}
          selectedSize={selectedSize}
          labelDraft={labelDraft}
          onLabelDraftChange={setLabelDraft}
          onLabelCommit={commitLabel}
          colorSelection={colorSelection}
          onColorSelectionChange={handleColorSelectionChange}
          colorDraft={colorDraft}
          onColorChange={handleColorChange}
          onResize={handleResize}
          resizeError={resizeError}
          minBinSize={minBinSize}
          maxBinSize={maxBinSize}
          sizeStep={sizeStep}
          onDelete={deleteSelectedPlacements}
          onClose={closeEditor}
        />
      )}

      {toast && (
        <div
          role={toast.type === 'error' ? 'alert' : 'status'}
          aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
          aria-atomic="true"
          className={clsx(styles.toast, toastToneClassName({ tone: toast.type }))}
        >
          {toast.message}
        </div>
      )}

      {tourActive && activeTourStep?.selector === '[data-tour="tour-bin-editor"]' && (
        <div
          data-tour="tour-bin-editor"
          className={styles.tourEditorCard}
          style={{ right: 24, top: 96 }}
        >
          <div className={styles.tourEditorHeader}>
            <span className={styles.tourEditorTitle}>Edit Bin</span>
            <span className={styles.tourEditorClose}>Close</span>
          </div>
          <div className={styles.tourEditorFields}>
            <div className={styles.tourEditorField}>Label</div>
            <div className={styles.tourEditorField}>Color</div>
            <div className={styles.tourEditorFieldRow}>
              <span>Width</span>
              <span>4"</span>
            </div>
            <div className={styles.tourEditorFieldRow}>
              <span>Length</span>
              <span>6"</span>
            </div>
          </div>
        </div>
      )}

      {tourActive && activeTourStep && (
        <>
          <div className={styles.tourOverlay} />
          {tourTargetRect && (
            <div
              className={styles.tourTarget}
              style={{
                left: `${Math.max(0, tourTargetRect.left - 6)}px`,
                top: `${Math.max(0, tourTargetRect.top - 6)}px`,
                width: `${tourTargetRect.width + 12}px`,
                height: `${tourTargetRect.height + 12}px`,
                boxShadow: '0 0 0 2px rgba(255,255,255,0.95)'
              }}
            />
          )}
          <div
            data-testid="tour-popover"
            className={styles.tourPopover}
            style={{ left: `${tourPopoverPosition.left}px`, top: `${tourPopoverPosition.top}px` }}
          >
            <p className={styles.tourPopoverEyebrow}>
              Guided Tour
            </p>
            <h4 className={styles.tourPopoverTitle}>{activeTourStep.title}</h4>
            <p className={styles.tourPopoverDescription}>{activeTourStep.description}</p>
            <div className={styles.tourPopoverFooter}>
              <button
                type="button"
                className={styles.tourNavButton}
                onClick={previousTourStep}
                disabled={tourStepIndex === 0}
              >
                Back
              </button>
              <div className={styles.tourNavGroup}>
                <button
                  type="button"
                  className={styles.tourNavButton}
                  onClick={stopTour}
                >
                  Skip
                </button>
                <Button size="sm" onClick={nextTourStep}>
                  {tourStepIndex === tourSteps.length - 1 ? 'Done' : 'Next'}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function DraggablePlacement({
  placement,
  size,
  gridSize,
  zoom,
  dragStatus,
  paintMode,
  highlight,
  shouldBlockClick,
  onClick,
  onKeyActivate,
  isInvalid
}: {
  placement: Placement;
  size: { width: number; length: number; bin?: Bin };
  gridSize: number;
  zoom: number;
  dragStatus: { placementId: string; fits: boolean } | null;
  paintMode: boolean;
  highlight?: { id: string; type: 'info' | 'error' } | null;
  shouldBlockClick?: () => boolean;
  onClick: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onKeyActivate?: (element: HTMLDivElement) => void;
  isInvalid: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `placement-${placement.id}`,
    data: { type: 'placement', placementId: placement.id, binId: placement.binId }
  });

  const isActive = isDragging && dragStatus?.placementId === placement.id;
  const actionState: 'idle' | 'valid' | 'invalid' = isInvalid
    ? 'invalid'
    : isActive
      ? dragStatus?.fits
        ? 'valid'
        : 'invalid'
      : 'idle';
  const borderColor = actionState === 'valid' ? '#166534' : actionState === 'invalid' ? '#991b1b' : undefined;
  const actionRingColor = actionState === 'valid' ? '#16a34a' : actionState === 'invalid' ? '#dc2626' : undefined;
  const boxShadow = actionRingColor
    ? `0 0 0 2px rgba(248, 250, 252, 0.95), 0 0 0 4px ${actionRingColor}`
    : undefined;
  const isHighlighted = highlight?.id === placement.id;
  const highlightColor = highlight?.type === 'error' ? '#dc2626' : '#22c55e';

  const translate = transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined;
  const backgroundColor = placement.color ?? DEFAULT_BIN_COLOR;
  const effectiveWidth = size.width * gridSize * zoom;
  const effectiveHeight = size.length * gridSize * zoom;
  const showPrimaryLabel = effectiveWidth >= 36 && effectiveHeight >= 24;
  const showSecondaryLabel = effectiveWidth >= 48 && effectiveHeight >= 36;
  const colorLabel = getColorLabel(backgroundColor);
  const sizeLabel = `${size.length} by ${size.width} inches`;
  const ariaLabelParts = [
    placement.label ? placement.label : null,
    `Bin ${sizeLabel}`,
    colorLabel,
    isInvalid ? 'Needs attention' : null
  ].filter(Boolean) as string[];
  const ariaLabel = ariaLabelParts.join(', ');
  const dragAttributes = paintMode ? undefined : attributes;
  const dragListenerSet = paintMode ? undefined : listeners;
  const { onKeyDown: dragKeyDown, ...dragListeners } = dragListenerSet ?? {};

  return (
    <div
      data-testid="placed-bin"
      data-placement-id={placement.id}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      ref={setNodeRef}
      className={clsx(
        styles.placedBin,
        styles.placedBinFocus,
        paintMode ? styles.placedBinPaint : styles.placedBinMove,
        isHighlighted && 'animate-pulse'
      )}
      style={{
        left: `${placement.x * gridSize}px`,
        top: `${placement.y * gridSize}px`,
        width: `${size.width * gridSize}px`,
        height: `${size.length * gridSize}px`,
        transform: translate,
        transition: isDragging ? 'none' : undefined,
        zIndex: isDragging ? 30 : undefined,
        opacity: isDragging ? 0.55 : 1,
        borderColor,
        borderWidth: actionState === 'idle' ? undefined : '2px',
        boxShadow,
        backgroundColor,
        color: getContrastText(backgroundColor),
        outline: isHighlighted ? `2px solid ${highlightColor}` : undefined,
        outlineOffset: isHighlighted ? '2px' : undefined
      }}
      onClick={(event) => {
        if (isDragging || shouldBlockClick?.()) return;
        onClick(event);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onKeyActivate?.(event.currentTarget);
        }
        dragKeyDown?.(event);
      }}
      {...dragListeners}
      {...dragAttributes}
    >
      <div className={styles.placedBinContent}>
        {placement.label && showSecondaryLabel && (
          <span className={styles.placedBinLabel}>
            {placement.label}
          </span>
        )}
        {showPrimaryLabel && (
          <span className={styles.placedBinSize}>
            {size.length}" x {size.width}"
          </span>
        )}
        {showSecondaryLabel && (
          <span className={styles.placedBinColor}>
            {colorLabel}
          </span>
        )}
      </div>
      <div className={styles.placedBinCorner} />
    </div>
  );
}
