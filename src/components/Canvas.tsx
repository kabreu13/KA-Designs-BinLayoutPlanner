import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type {
  HTMLAttributes,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent
} from 'react';
import { useDndMonitor, useDroppable, useDraggable } from '@dnd-kit/core';
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';
import type { ReactZoomPanPinchContentRef, ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import { Button } from './ui/Button';
import { Grid, Sparkles, RotateCcw, RotateCw, PaintBucket, Trash2, ChevronDown, ChevronUp, ZoomIn, ZoomOut, House, GripHorizontal } from 'lucide-react';
import { useLayout } from '../context/LayoutContext';
import { applyDelta, type DragItem, type Point } from '../utils/dragMath';
import type { Bin, Placement } from '../context/LayoutContext';
import {
  CUSTOM_COLOR_VALUE,
  DEFAULT_BIN_COLOR,
  PRESET_COLORS,
  getColorLabel,
  getColorSelection,
  getContrastText,
  normalizeHexColor
} from '../utils/colors';

const GRID_SIZE = 25; // px per inch on canvas
const FRAME_THROTTLE_MS = 16; // ~60fps
const SIZE_STEP = 2;
const MIN_BIN_SIZE = 2;
const MAX_BIN_SIZE = 8;
const DEFAULT_SNAP = 1;
const SNAP_MIN = 0.5;
const SNAP_MAX = 2;
const CANVAS_PADDING = 32; // px padding between canvas edge and drawer area
const LABEL_ZONE = CANVAS_PADDING / 2; // center labels within the padding zone
const EDITOR_WIDTH_PX = 240;
const EDITOR_HEIGHT_PX = 320;
const EDITOR_OFFSET_PX = 12;
const VIEWPORT_PADDING_PX = 8;
const MIN_CANVAS_ZOOM = 0.5;
const MAX_CANVAS_ZOOM = 2.5;
const ZOOM_DECIMALS = 4;
const ZOOM_BUTTON_ANIMATION_MS = 140;
const ZOOM_FIT_ANIMATION_MS = 180;
const WHEEL_ZOOM_SENSITIVITY = 0.00125;
const DESKTOP_CANVAS_STAGE_GUTTER_PX = 72;
const MOBILE_CANVAS_STAGE_GUTTER_PX = 48;
const ACTIONS_DRAG_MARGIN_PX = 12;
const HOW_TO_STORAGE_KEY = 'bin-layout-howto-hidden';
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
    description: 'Use the right panel for drawer settings, placed item groups, exports, and quick edits.'
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
    description: 'Use the Summary tab for drawer settings, item groups, exports, and quick edits.'
  }
] as const;

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
  const [binGhost, setBinGhost] = useState<{
    x: number;
    y: number;
    width: number;
    length: number;
    fits: boolean;
    outOfBounds: boolean;
  } | null>(null);
  const [dragStatus, setDragStatus] = useState<{ placementId: string; fits: boolean } | null>(null);
  const [editor, setEditor] = useState<{ placementIds: string[]; x: number; y: number } | null>(null);
  const [labelDraft, setLabelDraft] = useState('');
  const [colorDraft, setColorDraft] = useState(DEFAULT_BIN_COLOR);
  const [colorSelection, setColorSelection] = useState<string>(DEFAULT_BIN_COLOR);
  const [paintMode, setPaintMode] = useState(false);
  const [paintColorDraft, setPaintColorDraft] = useState(DEFAULT_BIN_COLOR);
  const [paintColorSelection, setPaintColorSelection] = useState<string>(DEFAULT_BIN_COLOR);
  const [canvasZoom, setCanvasZoom] = useState(1);
  const [canvasPosition, setCanvasPosition] = useState<Point>({ x: 0, y: 0 });
  const [highlight, setHighlight] = useState<{ id: string; type: 'info' | 'error' } | null>(null);
  const [quickActionsOpen, setQuickActionsOpen] = useState(() => !isMobileLayout);
  const [quickActionsMode, setQuickActionsMode] = useState<'mini' | 'full'>(() =>
    isMobileLayout ? 'mini' : 'full'
  );
  const [isPanningCanvas, setIsPanningCanvas] = useState(false);
  const [zoomLockActive, setZoomLockActive] = useState(false);
  const [actionsOffset, setActionsOffset] = useState<Point>({ x: 0, y: 0 });
  const [isDraggingActions, setIsDraggingActions] = useState(false);
  const [showHowTo, setShowHowTo] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem(HOW_TO_STORAGE_KEY) !== 'true';
  });
  const [tourActive, setTourActive] = useState(false);
  const disableQuickActions = showHowTo && !tourActive;
  const hasPlacements = placements.length > 0;
  const isQuickActionsMini = isMobileLayout && quickActionsMode === 'mini';
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const [tourTargetRect, setTourTargetRect] = useState<DOMRect | null>(null);
  const canvasViewportRef = useRef<HTMLDivElement | null>(null);
  const transformRef = useRef<ReactZoomPanPinchContentRef | null>(null);
  const dropAreaRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const lastFrameRef = useRef<number>(0);
  const activeDragRef = useRef<DragItem | null>(null);
  const pointerOriginRef = useRef<Point | null>(null);
  const dragOffsetRef = useRef<Point | null>(null);
  const originPlacementRef = useRef<Point | null>(null);
  const canvasZoomRef = useRef(canvasZoom);
  const canvasPositionRef = useRef<Point>({ x: 0, y: 0 });
  const panStateRef = useRef<{ pointerId: number; x: number; y: number; originX: number; originY: number } | null>(null);
  const actionsDragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    rect: DOMRect | null;
  } | null>(null);
  const actionsHandleRef = useRef<HTMLButtonElement | null>(null);
  const actionsDragElementRef = useRef<HTMLElement | null>(null);
  const actionsClickBlockedRef = useRef(false);
  const suppressClickUntilRef = useRef(0);
  const lastFocusRef = useRef<HTMLElement | null>(null);
  const labelInputRef = useRef<HTMLInputElement | null>(null);
  const snapInputRef = useRef<HTMLInputElement | null>(null);
  const highlightTimeoutRef = useRef<number | null>(null);
  const previousLayoutModeRef = useRef(isMobileLayout);
  const wheelZoomRafRef = useRef<number | null>(null);
  const wheelZoomDeltaRef = useRef(0);
  const wheelZoomPointerRef = useRef<Point | undefined>(undefined);
  const drawerZoomResetTimeoutRef = useRef<number | null>(null);
  const drawerZoomResetLateTimeoutRef = useRef<number | null>(null);
  const drawerZoomResetIntervalRef = useRef<number | null>(null);
  const drawerZoomResetIntervalStopRef = useRef<number | null>(null);
  const zoomLockTimeoutRef = useRef<number | null>(null);
  const zoomHintShownRef = useRef(false);
  const hasInitializedRef = useRef(false);
  const drawerSizeRef = useRef<{ width: number; length: number; initialized: boolean }>({
    width: drawerWidth,
    length: drawerLength,
    initialized: false
  });
  const autoFitSuppressedUntilRef = useRef<number>(0);
  const forceZoomResetUntilRef = useRef<number>(0);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (placements.length === 0) {
      setSuggestMode('pack');
      setPaintMode(false);
    }
  }, [placements.length]);

  useEffect(() => {
    setQuickActionsOpen(!isMobileLayout);
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
    setActionsOffset({ x: 0, y: 0 });
  }, [isMobileLayout]);

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
      if (zoomLockActive) return;
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
    [clampZoom, zoomLockActive]
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
    if (performance.now() < autoFitSuppressedUntilRef.current) return;
    const transform = transformRef.current;
    const fitZoom = getFitZoom();
    if (!transform || fitZoom == null) return;
    transform.centerView(fitZoom, ZOOM_FIT_ANIMATION_MS, 'easeOut');
  }, [getFitZoom]);

  useEffect(() => {
    if (!activePlacementEditor) return;
    if (typeof document !== 'undefined') {
      lastFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    setEditor(activePlacementEditor);
  }, [activePlacementEditor]);

  const closeEditor = useCallback(() => {
    setEditor(null);
    closePlacementEditor();
    const lastFocus = lastFocusRef.current;
    if (lastFocus && typeof document !== 'undefined' && document.contains(lastFocus)) {
      window.requestAnimationFrame(() => lastFocus.focus());
    }
  }, [closePlacementEditor]);

  useEffect(() => {
    if (!editor) return;
    const id = window.requestAnimationFrame(() => {
      labelInputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [editor]);

  const hideHowTo = () => {
    setShowHowTo(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem(HOW_TO_STORAGE_KEY, 'true');
    }
  };

  const showHowToCard = () => {
    setShowHowTo(true);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(HOW_TO_STORAGE_KEY);
    }
  };

  useEffect(() => {
    if (!editor) return;
    const placement = placements.find((p) => p.id === editor.placementIds[0]);
    if (!placement) {
      closeEditor();
      return;
    }
    setLabelDraft(placement.label ?? '');
    setColorDraft(normalizeHexColor(placement.color ?? DEFAULT_BIN_COLOR));
    setColorSelection(getColorSelection(placement.color));
  }, [closeEditor, editor, placements]);

  useEffect(() => {
    if (!editor) return;
    const handlePointer = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (editorRef.current?.contains(target)) return;
      closeEditor();
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeEditor();
    };
    window.addEventListener('mousedown', handlePointer);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handlePointer);
      window.removeEventListener('keydown', handleKey);
    };
  }, [closeEditor, editor]);

  const handleSuggestLayout = useCallback(() => {
    const mode = suggestMode;
    const result = suggestLayout(mode);
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

  const handleResize = (axis: 'width' | 'length', direction: -1 | 1) => {
    if (!selectedSize || selectedPlacementIds.length === 0) return;
    const current = axis === 'width' ? selectedSize.width : selectedSize.length;
    const next = Math.max(MIN_BIN_SIZE, Math.min(MAX_BIN_SIZE, current + direction * SIZE_STEP));
    if (next === current) return;
    const result = updatePlacements(selectedPlacementIds, { [axis]: next });
    if (result.status === 'blocked') {
      setToast({ type: 'error', message: 'Cannot resize — would overlap or exceed drawer.' });
      if (selectedPlacementIds[0]) {
        triggerHighlight(selectedPlacementIds[0], 'error');
      }
    }
  };

  const commitLabel = (rawLabel?: string) => {
    if (selectedPlacementIds.length === 0) return;
    const nextLabel = (rawLabel ?? labelDraft).trim();
    updatePlacements(selectedPlacementIds, { label: nextLabel });
  };

  const handleColorChange = (value: string) => {
    if (selectedPlacementIds.length === 0) return;
    const normalizedColor = normalizeHexColor(value);
    setColorDraft(normalizedColor);
    setColorSelection(getColorSelection(normalizedColor));
    updatePlacements(selectedPlacementIds, { color: normalizedColor });
  };

  const handleColorSelectionChange = (value: string) => {
    setColorSelection(value);
    if (value === CUSTOM_COLOR_VALUE || selectedPlacementIds.length === 0) return;
    setColorDraft(value);
    updatePlacements(selectedPlacementIds, { color: value });
  };

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
    setShowHowTo(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem(HOW_TO_STORAGE_KEY, 'true');
    }
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

  const setCanvasToScale = useCallback(
    (scale: number, animationMs = 0) => {
      const viewport = canvasViewportRef.current;
      const transform = transformRef.current;
      if (!viewport || !transform) return;
      const rect = viewport.getBoundingClientRect();
      const stageWidth = drawerWidth * GRID_SIZE + CANVAS_PADDING * 2 + canvasStageGutterPx * 2;
      const stageHeight = drawerLength * GRID_SIZE + CANVAS_PADDING * 2 + canvasStageGutterPx * 2;
      const targetWidth = stageWidth * scale;
      const targetHeight = stageHeight * scale;
      const nextX = (rect.width - targetWidth) / 2;
      const nextY = (rect.height - targetHeight) / 2;
      transform.setTransform(nextX, nextY, scale, animationMs, 'easeOut');
    },
    [canvasStageGutterPx, drawerLength, drawerWidth]
  );

  const handleCanvasInit = useCallback((ref: ReactZoomPanPinchRef) => {
    transformRef.current = ref;
    const { scale, positionX, positionY } = ref.state;
    canvasZoomRef.current = scale;
    canvasPositionRef.current = { x: positionX, y: positionY };
    setCanvasZoom(scale);
    setCanvasPosition({ x: positionX, y: positionY });
    const shouldFit = !hasInitializedRef.current;
    hasInitializedRef.current = true;
    window.requestAnimationFrame(() => {
      if (shouldFit) {
        fitCanvasInView();
      } else {
        setCanvasToScale(1, 0);
      }
    });
  }, [fitCanvasInView, setCanvasToScale]);

  const handleCanvasTransformed = useCallback(
    (_ref: ReactZoomPanPinchRef, state: { scale: number; positionX: number; positionY: number }) => {
      if (performance.now() < forceZoomResetUntilRef.current && Math.abs(state.scale - 1) > 0.01) {
        setCanvasToScale(1, 0);
        canvasZoomRef.current = 1;
        setCanvasZoom(1);
        setCanvasPosition({ x: state.positionX, y: state.positionY });
        return;
      }
      const nextScale = clampZoom(state.scale);
      canvasZoomRef.current = nextScale;
      canvasPositionRef.current = { x: state.positionX, y: state.positionY };
      setCanvasZoom(nextScale);
      setCanvasPosition({ x: state.positionX, y: state.positionY });
    },
    [clampZoom, setCanvasToScale]
  );

  useEffect(() => {
    fitCanvasInView();
  }, [fitCanvasInView, layoutResizeKey]);

  useLayoutEffect(() => {
    const previous = drawerSizeRef.current;
    const drawerChanged = previous.width !== drawerWidth || previous.length !== drawerLength;
    drawerSizeRef.current = { width: drawerWidth, length: drawerLength, initialized: true };

    const id = window.requestAnimationFrame(() => {
      if (!previous.initialized) {
        fitCanvasInView();
        return;
      }

      if (drawerChanged) {
        const transform = transformRef.current;
        if (!transform) {
          canvasZoomRef.current = 1;
          setCanvasZoom(1);
          return;
        }
        autoFitSuppressedUntilRef.current = performance.now() + 2000;
        forceZoomResetUntilRef.current = performance.now() + 1500;
        if (drawerZoomResetTimeoutRef.current != null) {
          window.clearTimeout(drawerZoomResetTimeoutRef.current);
        }
        if (drawerZoomResetLateTimeoutRef.current != null) {
          window.clearTimeout(drawerZoomResetLateTimeoutRef.current);
        }
        if (drawerZoomResetIntervalRef.current != null) {
          window.clearInterval(drawerZoomResetIntervalRef.current);
        }
        if (drawerZoomResetIntervalStopRef.current != null) {
          window.clearTimeout(drawerZoomResetIntervalStopRef.current);
        }
        if (zoomLockTimeoutRef.current != null) {
          window.clearTimeout(zoomLockTimeoutRef.current);
        }
        setZoomLockActive(true);
        setCanvasToScale(1, 0);
        drawerZoomResetTimeoutRef.current = window.setTimeout(() => {
          setCanvasToScale(1, 0);
        }, ZOOM_FIT_ANIMATION_MS + 50);
        drawerZoomResetLateTimeoutRef.current = window.setTimeout(() => {
          setCanvasToScale(1, 0);
        }, 800);
        drawerZoomResetIntervalRef.current = window.setInterval(() => {
          setCanvasToScale(1, 0);
        }, 120);
        drawerZoomResetIntervalStopRef.current = window.setTimeout(() => {
          if (drawerZoomResetIntervalRef.current != null) {
            window.clearInterval(drawerZoomResetIntervalRef.current);
            drawerZoomResetIntervalRef.current = null;
          }
        }, 1400);
        zoomLockTimeoutRef.current = window.setTimeout(() => {
          setZoomLockActive(false);
        }, 1500);
        canvasZoomRef.current = 1;
        setCanvasZoom(1);
        return;
      }

      fitCanvasInView();
    });

    return () => {
      window.cancelAnimationFrame(id);
      if (drawerZoomResetTimeoutRef.current != null) {
        window.clearTimeout(drawerZoomResetTimeoutRef.current);
        drawerZoomResetTimeoutRef.current = null;
      }
      if (drawerZoomResetLateTimeoutRef.current != null) {
        window.clearTimeout(drawerZoomResetLateTimeoutRef.current);
        drawerZoomResetLateTimeoutRef.current = null;
      }
      if (drawerZoomResetIntervalRef.current != null) {
        window.clearInterval(drawerZoomResetIntervalRef.current);
        drawerZoomResetIntervalRef.current = null;
      }
      if (drawerZoomResetIntervalStopRef.current != null) {
        window.clearTimeout(drawerZoomResetIntervalStopRef.current);
        drawerZoomResetIntervalStopRef.current = null;
      }
      if (zoomLockTimeoutRef.current != null) {
        window.clearTimeout(zoomLockTimeoutRef.current);
        zoomLockTimeoutRef.current = null;
      }
    };
  }, [fitCanvasInView, drawerWidth, drawerLength, isMobileLayout, setCanvasToScale]);

  const quickActionsAvailable = !(hideQuickActions && isMobileLayout);
  const mobileActionsLiftPx = isMobileLayout ? Math.max(0, mobileBottomInsetPx - 80) : 0;
  const mobileActionsBottom = `calc(0.75rem + env(safe-area-inset-bottom) + ${mobileActionsLiftPx}px)`;
  const mobileActionsToggleBottom = `calc(5rem + env(safe-area-inset-bottom) + ${mobileActionsLiftPx}px)`;
  const resetActionsPosition = useCallback(() => {
    setActionsOffset({ x: 0, y: 0 });
  }, []);

  const startActionsDrag = useCallback(
    (clientX: number, clientY: number) => {
      if (!isMobileLayout) return;
      const rect = actionsDragElementRef.current?.getBoundingClientRect() ?? null;
      actionsDragRef.current = {
        startX: clientX,
        startY: clientY,
        originX: actionsOffset.x,
        originY: actionsOffset.y,
        rect
      };
      actionsClickBlockedRef.current = false;
      setIsDraggingActions(true);
    },
    [actionsOffset.x, actionsOffset.y, isMobileLayout]
  );

  const handleActionsDragStart = (event: ReactPointerEvent<HTMLButtonElement>) => {
    startActionsDrag(event.clientX, event.clientY);
    event.preventDefault();
  };

  const handleActionsMouseDown = (event: ReactMouseEvent<HTMLButtonElement>) => {
    startActionsDrag(event.clientX, event.clientY);
    event.preventDefault();
  };

  const shouldStartActionsDragFromTarget = (target: EventTarget | null) => {
    if (target instanceof Element) {
      return !!target.closest('[data-testid="quick-actions-drag-handle"]');
    }
    if (target instanceof Node) {
      return !!target.parentElement?.closest('[data-testid="quick-actions-drag-handle"]');
    }
    return false;
  };

  const handleActionsContainerPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!shouldStartActionsDragFromTarget(event.target)) return;
    startActionsDrag(event.clientX, event.clientY);
    event.preventDefault();
  };

  const handleActionsContainerMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!shouldStartActionsDragFromTarget(event.target)) return;
    startActionsDrag(event.clientX, event.clientY);
    event.preventDefault();
  };

  useEffect(() => {
    const handle = actionsHandleRef.current;
    if (!handle) return;
    const handleMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return;
      startActionsDrag(event.clientX, event.clientY);
      event.preventDefault();
    };
    handle.addEventListener('mousedown', handleMouseDown);
    return () => handle.removeEventListener('mousedown', handleMouseDown);
  }, [startActionsDrag]);

  useEffect(() => {
    const handleMove = (event: PointerEvent | MouseEvent) => {
      const drag = actionsDragRef.current;
      if (!drag) return;
      const distanceX = event.clientX - drag.startX;
      const distanceY = event.clientY - drag.startY;
      let clampedDistanceX = distanceX;
      let clampedDistanceY = distanceY;
      if (drag.rect) {
        const minDx = ACTIONS_DRAG_MARGIN_PX - drag.rect.left;
        const maxDx = window.innerWidth - ACTIONS_DRAG_MARGIN_PX - drag.rect.right;
        const minDy = ACTIONS_DRAG_MARGIN_PX - drag.rect.top;
        const maxDy = window.innerHeight - ACTIONS_DRAG_MARGIN_PX - drag.rect.bottom;
        clampedDistanceX = Math.min(Math.max(distanceX, minDx), maxDx);
        clampedDistanceY = Math.min(Math.max(distanceY, minDy), maxDy);
      }
      if (!actionsClickBlockedRef.current && distanceX * distanceX + distanceY * distanceY > 16) {
        actionsClickBlockedRef.current = true;
      }
      setActionsOffset({
        x: drag.originX + clampedDistanceX,
        y: drag.originY + clampedDistanceY
      });
    };
    const handleEnd = () => {
      const drag = actionsDragRef.current;
      if (!drag) return;
      actionsDragRef.current = null;
      setIsDraggingActions(false);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('pointerup', handleEnd);
    window.addEventListener('pointercancel', handleEnd);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('pointerup', handleEnd);
      window.removeEventListener('pointercancel', handleEnd);
    };
  }, []);

  const shouldStartCanvasPan = useCallback((target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;
    if (target.closest('[data-testid="placed-bin"]')) return false;
    if (target.closest('[data-testid="placement-editor"]')) return false;
    if (target.closest('[data-testid="canvas-how-to"]')) return false;
    if (target.closest('[data-testid="canvas-how-to-collapsed"]')) return false;
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
  }, [handleClearLayout, handleSuggestLayout, placements.length, tourActive]);

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
    if (!event.ctrlKey && !event.metaKey) {
      if (!zoomHintShownRef.current) {
        setToast({ type: 'info', message: 'Hold Ctrl/Cmd + scroll to zoom.' });
        zoomHintShownRef.current = true;
      }
      return;
    }
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

  const getPlacementSize = useCallback(
    (placement: Placement) => {
      const bin = bins.find((b) => b.id === placement.binId);
      const width = placement.width ?? bin?.width;
      const length = placement.length ?? bin?.length;
      if (width == null || length == null) return null;
      return { width, length, bin };
    },
    [bins]
  );

  const attachDropAreaRef = (node: HTMLDivElement | null) => {
    dropAreaRef.current = node;
    setDropNodeRef(node);
  };

  const selectedPlacementIds = editor?.placementIds ?? [];
  const selectedCount = selectedPlacementIds.length;
  const selectedPlacement = selectedPlacementIds.length > 0
    ? placements.find((p) => p.id === selectedPlacementIds[0]) ?? null
    : null;
  const selectedSize = selectedPlacement ? getPlacementSize(selectedPlacement) : null;
  const editorPosition = useMemo(() => {
    if (!editor) return null;
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : Number.POSITIVE_INFINITY;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : Number.POSITIVE_INFINITY;
    let left = editor.x + EDITOR_OFFSET_PX;
    if (left + EDITOR_WIDTH_PX + VIEWPORT_PADDING_PX > viewportWidth) {
      left = editor.x - EDITOR_WIDTH_PX - EDITOR_OFFSET_PX;
    }
    const maxLeft = Math.max(VIEWPORT_PADDING_PX, viewportWidth - EDITOR_WIDTH_PX - VIEWPORT_PADDING_PX);
    left = Math.min(Math.max(VIEWPORT_PADDING_PX, left), maxLeft);
    const maxTop = Math.max(VIEWPORT_PADDING_PX, viewportHeight - EDITOR_HEIGHT_PX - VIEWPORT_PADDING_PX);
    const top = Math.min(
      Math.max(VIEWPORT_PADDING_PX, editor.y + EDITOR_OFFSET_PX),
      maxTop
    );
    return { left, top };
  }, [editor]);

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
        setToast({ type: 'error', message: 'No room for that bin.' });
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
    <div className={`flex-1 min-h-0 min-w-0 bg-[#F6F7F8] relative overflow-visible flex flex-col ${paintMode ? 'cursor-copy' : ''}`}>
      {/* Canvas Area */}
      <div
        data-testid="canvas-scroll-container"
        data-canvas-scale={canvasZoom.toFixed(3)}
        data-canvas-x={canvasPosition.x.toFixed(1)}
        data-canvas-y={canvasPosition.y.toFixed(1)}
        className={`flex-1 min-h-0 min-w-0 overflow-hidden ${isMobileLayout ? 'p-4 pt-5 hide-scrollbar' : 'p-0'}`}
        style={isMobileLayout && mobileBottomInsetPx > 0 ? { paddingBottom: `${mobileBottomInsetPx}px` } : undefined}
      >
        <div
          ref={canvasViewportRef}
          className={`h-full w-full min-h-0 min-w-0 ${paintMode ? 'cursor-copy' : isPanningCanvas ? 'cursor-grabbing' : 'cursor-grab'}`}
          style={isMobileLayout ? { touchAction: 'none' } : undefined}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerEnd}
          onPointerCancel={handleCanvasPointerEnd}
          onLostPointerCapture={handleCanvasPointerEnd}
        >
          <TransformWrapper
            key={`${drawerWidth}-${drawerLength}`}
            minScale={zoomLockActive ? 1 : MIN_CANVAS_ZOOM}
            maxScale={zoomLockActive ? 1 : MAX_CANVAS_ZOOM}
            centerOnInit
            centerZoomedOut={false}
            limitToBounds={false}
            disablePadding
            smooth
            disabled={tourActive}
            panning={{ disabled: !isMobileLayout }}
            wheel={{ disabled: true }}
            pinch={{ step: 5 }}
            doubleClick={{ disabled: true }}
            onInit={handleCanvasInit}
            onTransformed={handleCanvasTransformed}
          >
            <TransformComponent
              wrapperClass="h-full w-full min-h-0 min-w-0 !overflow-hidden"
              wrapperStyle={{ width: '100%', height: '100%' }}
              contentClass="!w-fit !h-fit"
              wrapperProps={TRANSFORM_WRAPPER_TEST_PROPS}
              contentProps={TRANSFORM_CONTENT_TEST_PROPS}
            >
              <div
                className="relative shrink-0"
                style={{
                  width: `${canvasStageSize.widthPx}px`,
                  height: `${canvasStageSize.heightPx}px`
                }}
              >
                <div
                  className="absolute bg-slate-100/70 rounded-lg shadow-xl border border-slate-900/[0.06]"
                  style={{
                    left: `${canvasStageGutterPx}px`,
                    top: `${canvasStageGutterPx}px`,
                    width: `${canvasSize.widthPx}px`,
                    height: `${canvasSize.heightPx}px`
                  }}
                >
                  <div
                    className="absolute z-10 pointer-events-none"
                    style={{
                      left: CANVAS_PADDING + dropAreaSize.widthPx / 2,
                      top: LABEL_ZONE,
                      transform: 'translate(-50%, -50%)'
                    }}
                  >
                    <div className="text-xs font-medium text-slate-400 bg-white px-2 py-1 rounded-full shadow-sm whitespace-nowrap">
                      {drawerWidth}" Width
                    </div>
                  </div>
                  <div
                    className="absolute z-10 pointer-events-none"
                    style={{
                      left: LABEL_ZONE,
                      top: CANVAS_PADDING + dropAreaSize.heightPx / 2,
                      transform: 'translate(-50%, -50%)'
                    }}
                  >
                    <div className="text-xs font-medium text-slate-400 bg-white px-2 py-1 rounded-full shadow-sm -rotate-90 whitespace-nowrap">
                      {drawerLength}" Length
                    </div>
                  </div>

                  <div
                    ref={attachDropAreaRef}
                    className="absolute bg-white shadow-inner"
                    style={{
                      left: CANVAS_PADDING,
                      top: CANVAS_PADDING,
                      width: `${dropAreaSize.widthPx}px`,
                      height: `${dropAreaSize.heightPx}px`
                    }}
                    data-testid="canvas-drop-area"
                    data-tour="canvas-drop-zone"
                  >
                    {showGrid && (
                      <div
                        data-testid="grid-overlay"
                        className="absolute inset-0 pointer-events-none opacity-25"
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
                        className="absolute pointer-events-none rounded-sm"
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
                            setEditor({ placementIds: [placement.id], x: event.clientX, y: event.clientY });
                            closePlacementEditor();
                          }}
                        />
                      );
                    })}

                    {placements.length === 0 && (
                      <div className="absolute bottom-4 right-4 text-xs text-slate-400 italic pointer-events-none">
                        Drag bins here
                      </div>
                    )}

                    <div className="absolute inset-0 pointer-events-none border-2 border-slate-300" />
                  </div>
                </div>
              </div>
            </TransformComponent>
          </TransformWrapper>
        </div>
      </div>
      

      {!tourActive && showHowTo && (
        <div
          data-testid="canvas-how-to"
          className={`absolute top-4 left-4 z-[60] rounded-xl border border-slate-200 bg-white/95 shadow-lg backdrop-blur p-4 ${
            isMobileLayout ? 'w-[calc(100%-2rem)] max-w-sm' : 'w-80'
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">How To Start</p>
              <h3 className="text-sm font-semibold text-[#0B0B0C] mt-1">Build your first layout in under a minute</h3>
            </div>
            <button
              type="button"
              className="text-xs text-slate-400 hover:text-slate-600"
              onClick={hideHowTo}
            >
              Hide
            </button>
          </div>
          <ol className="mt-3 space-y-1 text-xs text-slate-600">
            <li>1. Drag a bin from the catalog to the canvas.</li>
            <li>2. Drop it in the drawer and repeat for more bins.</li>
            <li>3. Click any bin (or placed-item group) to edit size, color, and label.</li>
          </ol>
          <Button
            size="sm"
            className="mt-3"
            onClick={startTour}
          >
            Take Tour
          </Button>
        </div>
      )}

      {!tourActive && !showHowTo && (
        <div
          data-testid="canvas-how-to-collapsed"
          className={`absolute ${isMobileLayout ? 'top-4' : 'top-16'} left-4 z-[60] rounded-full border border-slate-200 bg-white/95 shadow-md backdrop-blur px-3 py-2 flex items-center gap-3 ${
            isMobileLayout ? 'max-w-[calc(100%-2rem)]' : ''
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">How To Start</p>
          <button
            type="button"
            className="text-xs font-medium text-[#14476B] hover:text-[#1a5a8a]"
            onClick={showHowToCard}
          >
            Show
          </button>
        </div>
      )}

      {quickActionsAvailable && !showHowTo && isMobileLayout && quickActionsOpen && (
        <div
          data-tour="quick-actions-pill"
          data-actions-offset-x={actionsOffset.x.toFixed(1)}
          data-actions-offset-y={actionsOffset.y.toFixed(1)}
          ref={(node) => {
            actionsDragElementRef.current = node;
          }}
          onPointerDownCapture={handleActionsContainerPointerDown}
          onMouseDownCapture={handleActionsContainerMouseDown}
          className={`absolute left-2 right-2 bg-white/90 backdrop-blur shadow-lg border border-slate-200 rounded-2xl px-3 py-2 flex flex-col gap-3 relative z-50 ${
            disableQuickActions ? 'pointer-events-none' : ''
          }`}
          style={{ transform: `translate(${actionsOffset.x}px, ${actionsOffset.y}px)`, bottom: mobileActionsBottom }}
        >
          <button
            type="button"
            ref={actionsHandleRef}
            data-testid="quick-actions-drag-handle"
            aria-label="Drag quick actions"
            title="Drag quick actions (double click to reset)"
            onPointerDown={handleActionsDragStart}
            onMouseDown={handleActionsMouseDown}
            onDoubleClick={resetActionsPosition}
            className={`absolute -top-3 left-1/2 -translate-x-1/2 h-7 px-3 rounded-full border border-slate-200 bg-white text-slate-500 flex items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-wide ${
              isDraggingActions ? 'cursor-grabbing' : 'cursor-grab'
            } touch-none`}
          >
            <GripHorizontal className="h-3.5 w-3.5" />
            Drag
          </button>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs uppercase tracking-wide text-slate-400">History</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={undo}
                  disabled={!canUndo}
                  title="Undo (Ctrl/Cmd+Z)"
                  aria-label="Undo"
                  className="hover:bg-slate-100 disabled:opacity-40 rounded-full text-slate-600 h-11 w-11"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={redo}
                  disabled={!canRedo}
                  title="Redo (Shift+Ctrl/Cmd+Z)"
                  aria-label="Redo"
                  className="hover:bg-slate-100 disabled:opacity-40 rounded-full text-slate-600 h-11 w-11"
                >
                  <RotateCw className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex flex-col items-center gap-1">
              <span className="text-xs uppercase tracking-wide text-slate-400">Grid</span>
              <button
                onClick={() => setShowGrid(!showGrid)}
                title="Toggle grid (G)"
                aria-label="Toggle grid"
                aria-pressed={showGrid}
                className={`rounded-full transition-colors h-11 w-11 ${
                  showGrid ? 'bg-[#14476B]/10 text-[#14476B]' : 'hover:bg-slate-100 text-slate-600'
                }`}
              >
                <Grid className="h-4 w-4" />
              </button>
            </div>

            {!isQuickActionsMini && (
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs uppercase tracking-wide text-slate-400">Snap</span>
                <div className="flex items-center gap-1">
                  <input
                    ref={snapInputRef}
                    aria-label="Snap to grid"
                    title="Snap to the nearest grid line (inches)"
                    type="number"
                    min={SNAP_MIN}
                    max={SNAP_MAX}
                    step={0.5}
                    value={snapDraft}
                    inputMode="decimal"
                    onChange={(e) => handleSnapInputChange(e.target.value)}
                    onBlur={commitSnapInput}
                    aria-invalid={Boolean(snapHelper)}
                    aria-describedby={snapHelper ? 'snap-helper' : undefined}
                    className="w-14 px-2 py-2 min-h-10 text-xs rounded-md border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#14476B]/20"
                  />
                  <span className="text-[10px] text-slate-400">in</span>
                </div>
                {snapHelper && (
                  <span id="snap-helper" className="text-[10px] text-amber-600">
                    {snapHelper}
                  </span>
                )}
              </div>
            )}

            {!isQuickActionsMini && (
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs uppercase tracking-wide text-slate-400">View</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Zoom out"
                    title="Zoom out"
                    disabled={canvasZoom <= MIN_CANVAS_ZOOM}
                    onClick={() => zoomCanvas(canvasZoomRef.current - 0.1)}
                    className="hover:bg-slate-100 disabled:opacity-40 rounded-full text-slate-600 h-11 w-11"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </button>
                  <span className="w-12 text-center text-xs font-medium text-slate-600">
                    <span data-testid="canvas-zoom-value">{Math.round(canvasZoom * 100)}%</span>
                  </span>
                  <button
                    type="button"
                    aria-label="Zoom in"
                    title="Zoom in"
                    disabled={canvasZoom >= MAX_CANVAS_ZOOM}
                    onClick={() => zoomCanvas(canvasZoomRef.current + 0.1)}
                    className="hover:bg-slate-100 disabled:opacity-40 rounded-full text-slate-600 h-11 w-11"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </button>
                  <Button
                    data-testid="home-canvas-button"
                    size="sm"
                    variant="ghost"
                    title="Home canvas"
                    aria-label="Home canvas"
                    className="min-h-10 px-3 text-slate-700"
                    leftIcon={<House className="h-3 w-3" />}
                    onClick={fitCanvasInView}
                  >
                    Home
                  </Button>
                </div>
              </div>
            )}
          </div>

          {!isQuickActionsMini && (
            <div className="flex flex-wrap items-center justify-center gap-3">
              <div data-tour="canvas-actions" className="flex flex-col items-center gap-1">
                <span className="text-xs uppercase tracking-wide text-slate-400">Layout</span>
                {hasPlacements ? (
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button
                      data-testid="suggest-layout-button"
                      size="sm"
                      variant="ghost"
                      className="text-[#14476B] min-h-10 px-3"
                      leftIcon={<Sparkles className="h-3 w-3" />}
                      title="Suggest layout (S)"
                      onClick={handleSuggestLayout}
                    >
                      {`Suggest (${suggestModeLabel})`}
                    </Button>
                    <Button
                      data-testid="clear-layout-button"
                      size="sm"
                      variant="ghost"
                      className="text-slate-600 min-h-10 px-3"
                      leftIcon={<Trash2 className="h-3 w-3" />}
                      title="Clear layout (C)"
                      onClick={handleClearLayout}
                    >
                      Clear
                    </Button>
                    <div className="flex flex-col items-center gap-1">
                      <Button
                        data-testid="paint-mode-toggle"
                        data-tour="paint-action"
                        size="sm"
                        variant="ghost"
                        className={`${paintMode ? 'text-[#14476B] bg-[#14476B]/10' : 'text-slate-600'} min-h-10 px-3`}
                        leftIcon={<PaintBucket className="h-3 w-3" />}
                        onClick={togglePaintMode}
                        aria-label={paintMode ? 'Disable paint mode' : 'Enable paint mode'}
                        aria-pressed={paintMode}
                      >
                        {paintMode ? 'Paint On' : 'Paint'}
                      </Button>
                      {paintMode && (
                        <select
                          data-testid="paint-color-select"
                          value={paintColorSelection}
                          onChange={(e) => handlePaintColorSelectionChange(e.target.value)}
                          aria-label="Paint color"
                          className="w-28 rounded-md border border-slate-200 px-2 py-2 min-h-10 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#14476B]/20"
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
                          onChange={(e) => handlePaintColorChange(e.target.value)}
                          className="h-7 w-10 rounded-md border border-slate-200 bg-white"
                        />
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-400">Add a bin to enable layout tools.</div>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            {!isQuickActionsMini && (
              <button
                type="button"
                onClick={resetActionsPosition}
                className="rounded-full text-slate-600 hover:bg-slate-100 flex items-center justify-center gap-1 h-11 px-3"
              >
                <span className="text-xs font-semibold uppercase tracking-wide">Reset</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setQuickActionsMode(isQuickActionsMini ? 'full' : 'mini')}
              className="rounded-full text-slate-600 hover:bg-slate-100 flex items-center justify-center gap-1 h-11 px-3"
            >
              <span className="text-xs font-semibold uppercase tracking-wide">
                {isQuickActionsMini ? 'More' : 'Less'}
              </span>
            </button>
            <button
              type="button"
              data-testid="quick-actions-toggle"
              aria-expanded={quickActionsOpen}
              aria-label="Collapse quick actions"
              title="Collapse quick actions"
              onClick={() => setQuickActionsOpen(false)}
              className="rounded-full text-slate-600 hover:bg-slate-100 flex items-center justify-center gap-1 h-11 px-3"
            >
              <ChevronDown className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wide">Hide</span>
            </button>
          </div>
        </div>
      )}

      {paintMode && (
        <button
          type="button"
          data-testid="paint-mode-indicator"
          onClick={() => setPaintMode(false)}
          className="absolute top-4 right-4 z-[60] rounded-full border border-[#14476B]/20 bg-white/95 shadow-md backdrop-blur px-3 py-2 flex items-center gap-2 text-xs font-semibold text-[#14476B] hover:bg-[#14476B]/10"
        >
          <PaintBucket className="h-3.5 w-3.5" />
          Paint On
          <span className="text-[10px] font-medium text-slate-500">Tap to exit</span>
        </button>
      )}

      {quickActionsAvailable && !showHowTo && !isMobileLayout && (
        <div
          data-tour="quick-actions-pill"
          className="absolute top-4 inset-x-0 z-50 flex justify-center pointer-events-none px-4"
        >
          <div
            className={`bg-white/90 backdrop-blur shadow-lg border border-slate-200 rounded-2xl px-3 py-2 inline-flex items-center gap-2 w-full max-w-[720px] ${
              disableQuickActions ? 'pointer-events-none' : 'pointer-events-auto'
            }`}
          >
            <div className="flex flex-wrap items-end justify-center gap-x-2 gap-y-2 xl:flex-nowrap">
              <div className="flex flex-col items-center gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 leading-none">History</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={undo}
                    disabled={!canUndo}
                    title="Undo (Ctrl/Cmd+Z)"
                    aria-label="Undo"
                    className="hover:bg-slate-100 disabled:opacity-40 rounded-full text-slate-600 p-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={redo}
                    disabled={!canRedo}
                    title="Redo (Shift+Ctrl/Cmd+Z)"
                    aria-label="Redo"
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
                  onClick={() => setShowGrid(!showGrid)}
                  title="Toggle grid (G)"
                  aria-label="Toggle grid"
                  aria-pressed={showGrid}
                  className={`rounded-full transition-colors p-2 ${
                    showGrid ? 'bg-[#14476B]/10 text-[#14476B]' : 'hover:bg-slate-100 text-slate-600'
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
                    min={SNAP_MIN}
                    max={SNAP_MAX}
                    step={0.5}
                    value={snapDraft}
                    inputMode="decimal"
                    onChange={(e) => handleSnapInputChange(e.target.value)}
                    onBlur={commitSnapInput}
                    aria-invalid={Boolean(snapHelper)}
                    aria-describedby={snapHelper ? 'snap-helper' : undefined}
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
                    disabled={canvasZoom <= MIN_CANVAS_ZOOM}
                    onClick={() => zoomCanvas(canvasZoomRef.current - 0.1)}
                    className="hover:bg-slate-100 disabled:opacity-40 rounded-full text-slate-600 p-2"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </button>
                  <span className="w-10 text-center text-xs font-medium text-slate-600">
                    <span data-testid="canvas-zoom-value">
                      {Math.round(canvasZoom * 100)}%
                    </span>
                  </span>
                  <button
                    type="button"
                    aria-label="Zoom in"
                    title="Zoom in"
                    disabled={canvasZoom >= MAX_CANVAS_ZOOM}
                    onClick={() => zoomCanvas(canvasZoomRef.current + 0.1)}
                    className="hover:bg-slate-100 disabled:opacity-40 rounded-full text-slate-600 p-2"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </button>
                  <Button
                    data-testid="home-canvas-button"
                    size="sm"
                    variant="ghost"
                    title="Home canvas"
                    aria-label="Home canvas"
                    className="text-slate-700 px-2"
                    leftIcon={<House className="h-3 w-3" />}
                    onClick={fitCanvasInView}
                  >
                    Home
                  </Button>
                </div>
              </div>

              <div className="hidden xl:block w-px bg-slate-200 h-8" />

              <div data-tour="canvas-actions" className="flex flex-col items-center gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 leading-none">Layout</span>
                {hasPlacements ? (
                  <div className="flex items-center gap-2">
                    <Button
                      data-testid="suggest-layout-button"
                      size="sm"
                      variant="ghost"
                      className="text-[#14476B] px-2"
                      leftIcon={<Sparkles className="h-3 w-3" />}
                      title="Suggest layout (S)"
                      onClick={handleSuggestLayout}
                    >
                      {`Suggest (${suggestModeLabel})`}
                    </Button>
                    <Button
                      data-testid="clear-layout-button"
                      size="sm"
                      variant="ghost"
                      className="text-slate-600 px-2"
                      leftIcon={<Trash2 className="h-3 w-3" />}
                      title="Clear layout (C)"
                      onClick={handleClearLayout}
                    >
                      Clear
                    </Button>
                    <div className="flex flex-col items-center gap-1">
                      <Button
                        data-testid="paint-mode-toggle"
                        data-tour="paint-action"
                        size="sm"
                        variant="ghost"
                        className={`${paintMode ? 'text-[#14476B] bg-[#14476B]/10' : 'text-slate-600'} px-2`}
                        leftIcon={<PaintBucket className="h-3 w-3" />}
                        onClick={togglePaintMode}
                        aria-label={paintMode ? 'Disable paint mode' : 'Enable paint mode'}
                        aria-pressed={paintMode}
                      >
                        {paintMode ? 'Paint On' : 'Paint'}
                      </Button>
                      {paintMode && (
                        <select
                          data-testid="paint-color-select"
                          value={paintColorSelection}
                          onChange={(e) => handlePaintColorSelectionChange(e.target.value)}
                          aria-label="Paint color"
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
                          onChange={(e) => handlePaintColorChange(e.target.value)}
                          className="h-7 w-10 rounded-md border border-slate-200 bg-white"
                        />
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-[10px] text-slate-400">Add a bin to enable layout tools.</div>
                )}
              </div>

              <div className="hidden xl:block w-px bg-slate-200 h-8" />

            </div>
          </div>
        </div>
      )}

      {quickActionsAvailable && !showHowTo && isMobileLayout && !quickActionsOpen && (
        <button
          type="button"
          data-testid="quick-actions-toggle"
          data-actions-offset-x={actionsOffset.x.toFixed(1)}
          data-actions-offset-y={actionsOffset.y.toFixed(1)}
          aria-expanded={quickActionsOpen}
          aria-label="Expand quick actions"
          title="Expand quick actions"
          ref={(node) => {
            actionsDragElementRef.current = node;
          }}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            startActionsDrag(event.clientX, event.clientY);
          }}
          onClick={(event) => {
            if (actionsClickBlockedRef.current) {
              actionsClickBlockedRef.current = false;
              event.preventDefault();
              event.stopPropagation();
              return;
            }
            setQuickActionsOpen(true);
          }}
          className={`absolute z-50 rounded-full border border-slate-200 bg-white/95 backdrop-blur shadow-md text-slate-700 flex items-center gap-2 ${
            isMobileLayout
              ? 'right-3 px-3 h-11'
              : 'bottom-6 left-1/2 -translate-x-1/2 px-3 h-10'
          } ${isDraggingActions ? 'cursor-grabbing' : 'cursor-grab'}`}
          style={
            isMobileLayout
              ? { transform: `translate(${actionsOffset.x}px, ${actionsOffset.y}px)`, bottom: mobileActionsToggleBottom }
              : { transform: `translate(-50%, 0) translate(${actionsOffset.x}px, ${actionsOffset.y}px)` }
          }
        >
          <ChevronUp className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-wide">Actions</span>
        </button>
      )}

      {editor && editorPosition && selectedPlacement && selectedSize && (
        <div
          ref={editorRef}
          data-testid="placement-editor"
          className="fixed z-50 w-60 rounded-xl border border-slate-200 bg-white shadow-xl p-3 text-sm"
          style={{ left: editorPosition.left, top: editorPosition.top }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-700">Edit Bin</span>
            <button
              type="button"
              onClick={closeEditor}
              className="text-slate-400 hover:text-slate-600 text-xs"
            >
              Close
            </button>
          </div>

          <div className="space-y-2">
            <label className="flex flex-col gap-1 text-xs text-slate-500">
              Label
              <input
                data-testid="placement-label"
                ref={labelInputRef}
                type="text"
                value={labelDraft}
                onChange={(e) => setLabelDraft(e.target.value)}
                onBlur={(e) => commitLabel(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    commitLabel((e.target as HTMLInputElement).value);
                    (e.target as HTMLInputElement).blur();
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
                onChange={(e) => handleColorSelectionChange(e.target.value)}
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
                  onChange={(e) => handleColorChange(e.target.value)}
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
                    onClick={() => handleResize('width', -1)}
                    disabled={selectedSize.width <= MIN_BIN_SIZE}
                    className="h-6 w-6 rounded-full border border-slate-200 text-slate-600 disabled:opacity-40"
                  >
                    -
                  </button>
                  <span className="text-xs font-medium text-slate-700">{selectedSize.width}"</span>
                  <button
                    type="button"
                    data-testid="size-width-increase"
                    onClick={() => handleResize('width', 1)}
                    disabled={selectedSize.width >= MAX_BIN_SIZE}
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
                    onClick={() => handleResize('length', -1)}
                    disabled={selectedSize.length <= MIN_BIN_SIZE}
                    className="h-6 w-6 rounded-full border border-slate-200 text-slate-600 disabled:opacity-40"
                  >
                    -
                  </button>
                  <span className="text-xs font-medium text-slate-700">{selectedSize.length}"</span>
                  <button
                    type="button"
                    data-testid="size-length-increase"
                    onClick={() => handleResize('length', 1)}
                    disabled={selectedSize.length >= MAX_BIN_SIZE}
                    className="h-6 w-6 rounded-full border border-slate-200 text-slate-600 disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-400">Sizes adjust in {SIZE_STEP}" steps (min {MIN_BIN_SIZE}", max {MAX_BIN_SIZE}").</p>
            <Button
              data-testid="delete-bin-button"
              size="sm"
              variant="ghost"
              className="w-full justify-center text-red-600 hover:bg-red-50"
              aria-label={`Delete ${selectedCount} bin${selectedCount === 1 ? '' : 's'}`}
              leftIcon={<Trash2 className="h-3 w-3" />}
              onClick={() => {
                removePlacements(selectedPlacementIds);
                closeEditor();
              }}
            >
              Delete {selectedCount === 1 ? 'Bin' : 'Bins'}
            </Button>
          </div>
        </div>
      )}

      {toast && (
        <div
          role={toast.type === 'error' ? 'alert' : 'status'}
          aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
          aria-atomic="true"
          className={`absolute top-4 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-full shadow-md text-sm ${
            toast.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-slate-900 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}

      {tourActive && activeTourStep?.selector === '[data-tour="tour-bin-editor"]' && (
        <div
          data-tour="tour-bin-editor"
          className="fixed z-[61] w-60 rounded-xl border border-slate-200 bg-white shadow-xl p-3 text-sm pointer-events-none"
          style={{ right: 24, top: 96 }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-700">Edit Bin</span>
            <span className="text-slate-300 text-xs">Close</span>
          </div>
          <div className="space-y-2 text-xs text-slate-500">
            <div className="rounded-md border border-slate-200 px-2 py-1">Label</div>
            <div className="rounded-md border border-slate-200 px-2 py-1">Color</div>
            <div className="flex items-center justify-between rounded-md border border-slate-200 px-2 py-1">
              <span>Width</span>
              <span>4"</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-slate-200 px-2 py-1">
              <span>Length</span>
              <span>6"</span>
            </div>
          </div>
        </div>
      )}

      {tourActive && activeTourStep && (
        <>
          <div className="fixed inset-0 z-[60] bg-slate-900/35 pointer-events-none" />
          {tourTargetRect && (
            <div
              className="fixed z-[61] rounded-lg border-2 border-emerald-500 pointer-events-none"
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
            className="fixed z-[62] w-80 rounded-xl border border-slate-200 bg-white shadow-xl p-4"
            style={{ left: `${tourPopoverPosition.left}px`, top: `${tourPopoverPosition.top}px` }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Guided Tour
            </p>
            <h4 className="mt-1 text-sm font-semibold text-[#0B0B0C]">{activeTourStep.title}</h4>
            <p className="mt-2 text-xs text-slate-600">{activeTourStep.description}</p>
            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                className="text-xs text-slate-500 hover:text-slate-700 disabled:opacity-40"
                onClick={previousTourStep}
                disabled={tourStepIndex === 0}
              >
                Back
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="text-xs text-slate-500 hover:text-slate-700"
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
  dragStatus,
  paintMode,
  highlight,
  shouldBlockClick,
  onClick,
  isInvalid
}: {
  placement: Placement;
  size: { width: number; length: number; bin?: Bin };
  gridSize: number;
  dragStatus: { placementId: string; fits: boolean } | null;
  paintMode: boolean;
  highlight?: { id: string; type: 'info' | 'error' } | null;
  shouldBlockClick?: () => boolean;
  onClick: (event: ReactMouseEvent<HTMLDivElement>) => void;
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
  const dragListeners = paintMode ? undefined : listeners;

  return (
    <div
      data-testid="placed-bin"
      aria-label={ariaLabel}
      ref={setNodeRef}
      className={`absolute bg-white border border-slate-300 shadow-sm hover:shadow-md hover:border-[#14476B] hover:z-10 transition-all group flex items-center justify-center ${
        paintMode ? 'cursor-copy' : 'cursor-move'
      } ${isHighlighted ? 'animate-pulse' : ''}`}
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
      {...dragListeners}
      {...dragAttributes}
    >
      <div className="flex flex-col items-center gap-0.5">
        {placement.label && (
          <span className="text-xs font-semibold leading-none">
            {placement.label}
          </span>
        )}
        <span className="text-xs font-medium leading-none">
          {size.length}" x {size.width}"
        </span>
        <span className="text-[10px] font-medium leading-none opacity-90">
          {colorLabel}
        </span>
      </div>
      <div className="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full bg-slate-300 opacity-0 group-hover:opacity-100" />
    </div>
  );
}
