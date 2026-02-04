import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useDndMonitor, useDroppable, useDraggable } from '@dnd-kit/core';
import { Button } from './ui/Button';
import { Grid, Sparkles, RotateCcw, RotateCw, PaintBucket, Trash2 } from 'lucide-react';
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
const CANVAS_PADDING = 32; // px padding between canvas edge and drawer area
const LABEL_ZONE = CANVAS_PADDING / 2; // center labels within the padding zone
const EDITOR_WIDTH_PX = 240;
const EDITOR_OFFSET_PX = 12;
const VIEWPORT_PADDING_PX = 8;

const TOUR_STEPS = [
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

export function Canvas() {
  const {
    placements,
    bins,
    drawerWidth,
    drawerLength,
    addPlacement,
    movePlacement,
    updatePlacement,
    updatePlacements,
    removePlacement,
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
  const [snap, setSnap] = useState(1);
  const [suggestMode, setSuggestMode] = useState<'pack' | 'random'>('pack');
  const [toast, setToast] = useState<{ type: 'info' | 'error'; message: string } | null>(null);
  const [dragStatus, setDragStatus] = useState<{ placementId: string; fits: boolean } | null>(null);
  const [editor, setEditor] = useState<{ placementIds: string[]; x: number; y: number } | null>(null);
  const [labelDraft, setLabelDraft] = useState('');
  const [colorDraft, setColorDraft] = useState(DEFAULT_BIN_COLOR);
  const [colorSelection, setColorSelection] = useState<string>(DEFAULT_BIN_COLOR);
  const [paintMode, setPaintMode] = useState(false);
  const [paintColorDraft, setPaintColorDraft] = useState(DEFAULT_BIN_COLOR);
  const [paintColorSelection, setPaintColorSelection] = useState<string>(DEFAULT_BIN_COLOR);
  const [showHowTo, setShowHowTo] = useState(true);
  const [tourActive, setTourActive] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const [tourTargetRect, setTourTargetRect] = useState<DOMRect | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const dropAreaRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const lastFrameRef = useRef<number>(0);
  const activeDragRef = useRef<DragItem | null>(null);
  const pointerOriginRef = useRef<Point | null>(null);
  const dragOffsetRef = useRef<Point | null>(null);
  const originPlacementRef = useRef<Point | null>(null);

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
    if (!activePlacementEditor) return;
    setEditor(activePlacementEditor);
  }, [activePlacementEditor]);

  const closeEditor = useCallback(() => {
    setEditor(null);
    closePlacementEditor();
  }, [closePlacementEditor]);

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

  const handleSuggestLayout = () => {
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
  };

  const handleResize = (axis: 'width' | 'length', direction: -1 | 1) => {
    if (!selectedSize || selectedPlacementIds.length === 0) return;
    const current = axis === 'width' ? selectedSize.width : selectedSize.length;
    const next = Math.max(MIN_BIN_SIZE, Math.min(MAX_BIN_SIZE, current + direction * SIZE_STEP));
    if (next === current) return;
    const result = updatePlacements(selectedPlacementIds, { [axis]: next });
    if (result.status === 'blocked') setToast({ type: 'error', message: 'Cannot resize — no space available.' });
  };

  const commitLabel = () => {
    if (selectedPlacementIds.length === 0) return;
    const nextLabel = labelDraft.trim();
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

  const stopTour = useCallback(() => {
    setTourActive(false);
    setTourTargetRect(null);
  }, []);

  const startTour = () => {
    setShowHowTo(false);
    setTourStepIndex(0);
    setTourActive(true);
  };

  const nextTourStep = () => {
    if (tourStepIndex >= TOUR_STEPS.length - 1) {
      stopTour();
      return;
    }
    setTourStepIndex((current) => Math.min(current + 1, TOUR_STEPS.length - 1));
  };

  const previousTourStep = () => {
    setTourStepIndex((current) => Math.max(0, current - 1));
  };

  const activeTourStep = tourActive ? TOUR_STEPS[tourStepIndex] : null;
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

  const { setNodeRef: setDropNodeRef } = useDroppable({ id: 'drop-area' });

  const clampSnap = (value: number) => Math.max(0.5, Math.min(2, value));
  const snapValue = clampSnap(snap);
  const gridStepPx = gridSize * snapValue;
  const applySnap = (value: number) => Math.round(value / snapValue) * snapValue;
  const snapToBounds = (value: number, max: number) => {
    if (value <= snapValue) return 0;
    if (max - value <= snapValue) return max;
    return applySnap(value);
  };

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
  const selectedPlacement = selectedPlacementIds.length > 0
    ? placements.find((p) => p.id === selectedPlacementIds[0]) ?? null
    : null;
  const selectedSize = selectedPlacement ? getPlacementSize(selectedPlacement) : null;
  const editorPosition = useMemo(() => {
    if (!editor) return null;
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : Number.POSITIVE_INFINITY;
    let left = editor.x + EDITOR_OFFSET_PX;
    if (left + EDITOR_WIDTH_PX + VIEWPORT_PADDING_PX > viewportWidth) {
      left = editor.x - EDITOR_WIDTH_PX - EDITOR_OFFSET_PX;
    }
    const maxLeft = Math.max(VIEWPORT_PADDING_PX, viewportWidth - EDITOR_WIDTH_PX - VIEWPORT_PADDING_PX);
    left = Math.min(Math.max(VIEWPORT_PADDING_PX, left), maxLeft);
    return { left, top: Math.max(VIEWPORT_PADDING_PX, editor.y + EDITOR_OFFSET_PX) };
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
    const offset = dragOffsetRef.current ?? { x: 0, y: 0 };
    const rawX = (point.x - rect.left - offset.x) / gridSize;
    const rawY = (point.y - rect.top - offset.y) / gridSize;
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
    const rawX = originPlacementRef.current.x + delta.x / gridSize;
    const rawY = originPlacementRef.current.y + delta.y / gridSize;
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
    const { rawX, rawY, x: dropX, y: dropY } = drop;
    debugLog('raw target (in)', { x: rawX, y: rawY });
    debugLog('clamped target (in)', { x: dropX, y: dropY });

    if (drag.type === 'bin') {
      const result = addPlacement(drag.binId, dropX, dropY);
      debugLog('drop result status', result.status);
      if (result.status === 'blocked') {
        setToast({ type: 'error', message: 'No room for that bin.' });
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
        if (placement && dropRect) {
          const topLeftX = dropRect.left + placement.x * gridSize;
          const topLeftY = dropRect.top + placement.y * gridSize;
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
      if (!activeDragRef.current) return;
      if (activeDragRef.current.type !== 'placement') {
        return;
      }

      const now = performance.now();
      if (now - lastFrameRef.current < FRAME_THROTTLE_MS) return;
      lastFrameRef.current = now;

      const delta = getDragDelta(event);
      const drop = computePlacementTargetFromDelta(delta, activeDragRef.current);
      if (!drop) return;

      // Use unclamped-to-grid position for live overlap feedback so it flips as soon as boxes intersect.
      const liveX = Math.max(0, Math.min(drop.rawX, drawerWidth - drop.size.width));
      const liveY = Math.max(0, Math.min(drop.rawY, drawerLength - drop.size.length));
      const collision = hasCollisionAt(drop.size, liveX, liveY, activeDragRef.current.placementId);
      setDragStatus({
        placementId: activeDragRef.current.placementId,
        fits: !collision && !drop.isOutOfBounds
      });
    },
    onDragEnd(event) {
      if (!activeDragRef.current) return;
      const delta = getDragDelta(event);
      debugLog('drag move delta (px)', { x: delta.x, y: delta.y });
      if (activeDragRef.current.type === 'placement' && originPlacementRef.current) {
        const expectedX = originPlacementRef.current.x + delta.x / gridSize;
        const expectedY = originPlacementRef.current.y + delta.y / gridSize;
        debugLog('expected moved placement position (in)', { x: expectedX, y: expectedY });
        const drop = computePlacementTargetFromDelta(delta, activeDragRef.current);
        if (drop) {
          debugLog('raw target (in)', { x: drop.rawX, y: drop.rawY });
          debugLog('clamped target (in)', { x: drop.x, y: drop.y });
          const result = movePlacement(activeDragRef.current.placementId, drop.x, drop.y);
          debugLog('drop result status', result.status);
          if (result.status === 'blocked') {
            setToast({ type: 'error', message: 'Cannot move there — space is full.' });
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
    }
  });

  return (
    <div className={`flex-1 bg-[#F6F7F8] relative overflow-hidden flex flex-col ${paintMode ? 'cursor-copy' : ''}`}>
      {/* Canvas Area */}
      <div
        ref={scrollContainerRef}
        className="flex-1 flex items-center justify-center p-12 overflow-auto"
      >
        <div
          className="bg-slate-100/70 rounded-lg shadow-xl border border-slate-900/[0.06] relative transition-transform duration-200"
          style={{
            width: `${canvasSize.widthPx}px`,
            height: `${canvasSize.heightPx}px`
          }}
        >
          <div
            className="absolute z-10"
            style={{
              left: CANVAS_PADDING + dropAreaSize.widthPx / 2,
              top: LABEL_ZONE,
              transform: 'translate(-50%, -50%)'
            }}
          >
            <div className="text-xs font-medium text-slate-400 bg-white px-2 py-1 rounded-full shadow-sm">
              {drawerWidth}" Width
            </div>
          </div>
          <div
            className="absolute z-10"
            style={{
              left: LABEL_ZONE,
              top: CANVAS_PADDING + dropAreaSize.heightPx / 2,
              transform: 'translate(-50%, -50%)'
            }}
          >
            <div className="text-xs font-medium text-slate-400 bg-white px-2 py-1 rounded-full shadow-sm -rotate-90">
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

      {!tourActive && showHowTo && (
        <div
          data-testid="canvas-how-to"
          className="absolute top-4 left-4 z-40 w-80 rounded-xl border border-slate-200 bg-white/95 shadow-lg backdrop-blur p-4"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">How To Start</p>
              <h3 className="text-sm font-semibold text-[#0B0B0C] mt-1">Build your first layout in under a minute</h3>
            </div>
            <button
              type="button"
              className="text-xs text-slate-400 hover:text-slate-600"
              onClick={() => setShowHowTo(false)}
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
          className="absolute top-4 left-4 z-40 rounded-full border border-slate-200 bg-white/95 shadow-md backdrop-blur px-3 py-2 flex items-center gap-3"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">How To Start</p>
          <button
            type="button"
            className="text-xs font-medium text-[#14476B] hover:text-[#1a5a8a]"
            onClick={() => setShowHowTo(true)}
          >
            Show
          </button>
        </div>
      )}

      <div
        data-tour="quick-actions-pill"
        className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur shadow-lg border border-slate-200 rounded-2xl px-4 py-2 flex items-start gap-5"
      >
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs uppercase tracking-wide text-slate-400">History</span>
          <div className="flex items-center gap-1">
            <button
              onClick={undo}
              disabled={!canUndo}
              title="Undo (Ctrl/Cmd+Z)"
              className="p-2 hover:bg-slate-100 disabled:opacity-40 rounded-full text-slate-600"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              title="Redo (Shift+Ctrl/Cmd+Z)"
              className="p-2 hover:bg-slate-100 disabled:opacity-40 rounded-full text-slate-600"
            >
              <RotateCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="w-px bg-slate-200 self-stretch my-1" />

        <div className="flex flex-col items-center gap-1">
          <span className="text-xs uppercase tracking-wide text-slate-400">Grid</span>
          <button
            onClick={() => setShowGrid(!showGrid)}
            title="Toggle grid"
            className={`p-2 rounded-full transition-colors ${
              showGrid ? 'bg-[#14476B]/10 text-[#14476B]' : 'hover:bg-slate-100 text-slate-600'
            }`}
          >
            <Grid className="h-4 w-4" />
          </button>
        </div>

        <div className="w-px bg-slate-200 self-stretch my-1" />

        <div className="flex flex-col items-center gap-1">
          <span className="text-xs uppercase tracking-wide text-slate-400">Grid Size</span>
          <input
            aria-label="Snap to grid"
            title="Snap to the nearest grid line (inches)"
            type="number"
            min={0.5}
            max={2}
            step={0.5}
            value={snap}
            onChange={(e) => setSnap(clampSnap(Number(e.target.value) || 0.5))}
            className="w-14 px-2 py-1 text-xs rounded-md border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#14476B]/20"
          />
        </div>

        <div className="w-px bg-slate-200 self-stretch my-1" />

        <div data-tour="canvas-actions" className="flex flex-col items-center gap-1">
          <span className="text-xs uppercase tracking-wide text-slate-400">Actions</span>
          <div className="flex items-center gap-1">
            <Button
              data-testid="suggest-layout-button"
              size="sm"
              variant="ghost"
              className="text-[#14476B]"
              leftIcon={<Sparkles className="h-3 w-3" />}
              onClick={handleSuggestLayout}
              disabled={placements.length === 0}
            >
              Suggest Layout
            </Button>
            <Button
              data-testid="clear-layout-button"
              size="sm"
              variant="ghost"
              className="text-slate-600"
              leftIcon={<Trash2 className="h-3 w-3" />}
              onClick={clearPlacements}
              disabled={placements.length === 0}
            >
              Clear
            </Button>
            <Button
              data-testid="paint-mode-toggle"
              data-tour="paint-action"
              size="sm"
              variant="ghost"
              className={paintMode ? 'text-[#14476B] bg-[#14476B]/10' : 'text-slate-600'}
              leftIcon={<PaintBucket className="h-3 w-3" />}
              onClick={togglePaintMode}
              disabled={placements.length === 0}
              aria-label={paintMode ? 'Disable paint mode' : 'Enable paint mode'}
            >
              {paintMode ? '' : 'Paint Bins'}
            </Button>
            {paintMode && (
              <select
                data-testid="paint-color-select"
                value={paintColorSelection}
                onChange={(e) => handlePaintColorSelectionChange(e.target.value)}
                className="w-28 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#14476B]/20"
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
      </div>

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
                type="text"
                value={labelDraft}
                onChange={(e) => setLabelDraft(e.target.value)}
                onBlur={commitLabel}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    commitLabel();
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
              aria-label="Delete bin"
              leftIcon={<Trash2 className="h-3 w-3" />}
              onClick={() => {
                removePlacement(selectedPlacement.id);
                closeEditor();
              }}
            >
              Delete Bin
            </Button>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={`absolute top-4 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-full shadow-md text-sm ${
            toast.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-slate-900 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}

      {tourActive && tourStepIndex === 3 && (
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
                  {tourStepIndex === TOUR_STEPS.length - 1 ? 'Done' : 'Next'}
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
  onClick,
  isInvalid
}: {
  placement: Placement;
  size: { width: number; length: number; bin?: Bin };
  gridSize: number;
  dragStatus: { placementId: string; fits: boolean } | null;
  paintMode: boolean;
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

  const translate = transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined;
  const backgroundColor = placement.color ?? DEFAULT_BIN_COLOR;
  const dragAttributes = paintMode ? undefined : attributes;
  const dragListeners = paintMode ? undefined : listeners;

  return (
    <div
      data-testid="placed-bin"
      ref={setNodeRef}
      className={`absolute bg-white border border-slate-300 shadow-sm hover:shadow-md hover:border-[#14476B] hover:z-10 transition-all group flex items-center justify-center ${
        paintMode ? 'cursor-copy' : 'cursor-move'
      }`}
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
        color: getContrastText(backgroundColor)
      }}
      onClick={(event) => {
        if (isDragging) return;
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
          {getColorLabel(backgroundColor)}
        </span>
      </div>
      <div className="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full bg-slate-300 opacity-0 group-hover:opacity-100" />
    </div>
  );
}
