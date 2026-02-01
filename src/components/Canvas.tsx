import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useDndMonitor, useDroppable, useDraggable } from '@dnd-kit/core';
import { Button } from './ui/Button';
import { Grid, Sparkles, RotateCcw, RotateCw, Magnet } from 'lucide-react';
import { useLayout } from '../context/LayoutContext';
import { applyDelta, type DragItem, type Point } from '../utils/dragMath';
import type { Bin, Placement } from '../context/LayoutContext';

const GRID_SIZE = 25; // px per inch on canvas
const FRAME_THROTTLE_MS = 16; // ~60fps
const SIZE_STEP = 2;
const MIN_BIN_SIZE = 2;
const MAX_BIN_SIZE = 8;

export function Canvas() {
  const {
    placements,
    bins,
    drawerWidth,
    drawerLength,
    addPlacement,
    movePlacement,
    updatePlacement,
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
  const [editor, setEditor] = useState<{ id: string; x: number; y: number } | null>(null);
  const [labelDraft, setLabelDraft] = useState('');
  const [colorDraft, setColorDraft] = useState('#ffffff');
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
    }
  }, [placements.length]);

  useEffect(() => {
    if (!editor) return;
    const placement = placements.find((p) => p.id === editor.id);
    if (!placement) return;
    setLabelDraft(placement.label ?? '');
    setColorDraft(placement.color ?? '#ffffff');
  }, [editor, placements]);

  useEffect(() => {
    if (!editor) return;
    const handlePointer = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (editorRef.current?.contains(target)) return;
      setEditor(null);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setEditor(null);
    };
    window.addEventListener('mousedown', handlePointer);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handlePointer);
      window.removeEventListener('keydown', handleKey);
    };
  }, [editor]);

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
    if (!selectedPlacement || !selectedSize) return;
    const current = axis === 'width' ? selectedSize.width : selectedSize.length;
    const next = Math.max(MIN_BIN_SIZE, Math.min(MAX_BIN_SIZE, current + direction * SIZE_STEP));
    if (next === current) return;
    const result = updatePlacement(selectedPlacement.id, { [axis]: next });
    if (result.status === 'blocked') {
      setToast({ type: 'error', message: 'Cannot resize — no space available.' });
    } else if (result.status === 'autofit') {
      setToast({ type: 'info', message: 'Resized and auto-fit to the nearest space.' });
    }
  };

  const commitLabel = () => {
    if (!selectedPlacement) return;
    updatePlacement(selectedPlacement.id, { label: labelDraft.trim() });
  };

  const handleColorChange = (value: string) => {
    if (!selectedPlacement) return;
    setColorDraft(value);
    updatePlacement(selectedPlacement.id, { color: value });
  };

  const gridSize = GRID_SIZE;
  const dropAreaSize = useMemo(
    () => ({ widthPx: drawerWidth * gridSize, heightPx: drawerLength * gridSize }),
    [drawerWidth, drawerLength, gridSize]
  );

  const { setNodeRef: setDropNodeRef } = useDroppable({ id: 'drop-area' });

  const clampSnap = (value: number) => Math.max(0.5, Math.min(2, value));
  const snapValue = clampSnap(snap);
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

  const selectedPlacement = editor ? placements.find((p) => p.id === editor.id) : null;
  const selectedSize = selectedPlacement ? getPlacementSize(selectedPlacement) : null;

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
    const snappedX = snapToBounds(rawX, maxX);
    const snappedY = snapToBounds(rawY, maxY);
    const isOutOfBounds = snappedX < 0 || snappedY < 0 || snappedX > maxX || snappedY > maxY;
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
    const snappedX = snapToBounds(rawX, maxX);
    const snappedY = snapToBounds(rawY, maxY);
    const isOutOfBounds = snappedX < 0 || snappedY < 0 || snappedX > maxX || snappedY > maxY;
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

      const collision = hasCollisionAt(drop.size, drop.x, drop.y, activeDragRef.current.placementId);
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
    <div className="flex-1 bg-[#F6F7F8] relative overflow-hidden flex flex-col">
      {/* Canvas Area */}
      <div
        ref={scrollContainerRef}
        className="flex-1 flex items-center justify-center p-12 overflow-auto"
      >
        <div
          className="bg-white rounded-lg shadow-xl border border-slate-900/[0.06] relative transition-transform duration-200"
          style={{
            width: `${dropAreaSize.widthPx}px`,
            height: `${dropAreaSize.heightPx}px`
          }}
        >
          {showGrid && (
            <div
              data-testid="grid-overlay"
              className="absolute inset-0 pointer-events-none opacity-20"
              style={{
                backgroundImage:
                  'linear-gradient(#14476B 1px, transparent 1px), linear-gradient(90deg, #14476B 1px, transparent 1px)',
                backgroundSize: `${gridSize}px ${gridSize}px`
              }}
            />
          )}

          <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-xs font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
            {drawerWidth}" Width
          </div>
          <div className="absolute -left-8 top-1/2 -translate-y-1/2 -rotate-90 text-xs font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
            {drawerLength}" Length
          </div>

          <div
            ref={attachDropAreaRef}
            className="absolute inset-4 border-2 border-dashed border-slate-200 rounded-md bg-slate-50/50"
            data-testid="canvas-drop-area"
          >
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
                  isInvalid={invalidPlacementIds.has(placement.id)}
                  onClick={(event) => {
                    event.stopPropagation();
                    setEditor({ id: placement.id, x: event.clientX, y: event.clientY });
                  }}
                />
              );
            })}

            {placements.length === 0 && (
              <div className="absolute bottom-4 right-4 text-xs text-slate-400 italic pointer-events-none">
                Drag bins here
              </div>
            )}

          </div>
        </div>
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur shadow-lg border border-slate-200 rounded-full px-4 py-2 flex items-center gap-4">
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

        <div className="w-px h-4 bg-slate-200" />

        <button
          onClick={() => setShowGrid(!showGrid)}
          title="Toggle grid"
          className={`p-2 rounded-full transition-colors ${
            showGrid ? 'bg-[#14476B]/10 text-[#14476B]' : 'hover:bg-slate-100 text-slate-600'
          }`}
        >
          <Grid className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2">
          <div className="p-2 rounded-full bg-slate-100 text-slate-700">
            <Magnet className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Snap</span>
            <input
              aria-label="Snap distance"
              title="Snap distance (inches)"
              type="number"
              min={0.5}
              max={2}
              step={0.5}
              value={snap}
              onChange={(e) => setSnap(clampSnap(Number(e.target.value) || 0.5))}
              className="w-14 px-2 py-1 text-xs rounded-md border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#14476B]/20"
            />
          </div>
        </div>

        <div className="w-px h-4 bg-slate-200" />

        <Button
          size="sm"
          variant="ghost"
          className="text-[#14476B]"
          leftIcon={<Sparkles className="h-3 w-3" />}
          onClick={handleSuggestLayout}
          disabled={placements.length === 0}
        >
          Suggest Layout
        </Button>
      </div>

      {editor && selectedPlacement && selectedSize && (
        <div
          ref={editorRef}
          data-testid="placement-editor"
          className="fixed z-50 w-60 rounded-xl border border-slate-200 bg-white shadow-xl p-3 text-sm"
          style={{ left: editor.x + 12, top: editor.y + 12 }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-700">Edit Bin</span>
            <button
              type="button"
              onClick={() => setEditor(null)}
              className="text-slate-400 hover:text-slate-600 text-xs"
            >
              Close
            </button>
          </div>

          <div className="space-y-2">
            <label className="flex flex-col gap-1 text-[11px] text-slate-500">
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

            <label className="flex items-center justify-between text-[11px] text-slate-500">
              Color
              <input
                data-testid="placement-color"
                type="color"
                value={colorDraft}
                onChange={(e) => handleColorChange(e.target.value)}
                className="h-7 w-10 rounded-md border border-slate-200 bg-white"
              />
            </label>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-500">
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

              <div className="flex items-center justify-between text-[11px] text-slate-500">
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
            <p className="text-[10px] text-slate-400">Sizes adjust in {SIZE_STEP}" steps (min {MIN_BIN_SIZE}", max {MAX_BIN_SIZE}").</p>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={`absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full shadow-md text-sm ${
            toast.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-slate-900 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

function DraggablePlacement({
  placement,
  size,
  gridSize,
  dragStatus,
  onClick,
  isInvalid
}: {
  placement: Placement;
  size: { width: number; length: number; bin?: Bin };
  gridSize: number;
  dragStatus: { placementId: string; fits: boolean } | null;
  onClick: (event: ReactMouseEvent<HTMLDivElement>) => void;
  isInvalid: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `placement-${placement.id}`,
    data: { type: 'placement', placementId: placement.id, binId: placement.binId }
  });

  const isActive = isDragging && dragStatus?.placementId === placement.id;
  const borderColor = isInvalid
    ? '#dc2626'
    : isActive
      ? dragStatus?.fits
        ? '#16a34a'
        : '#dc2626'
      : undefined;

  const translate = transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined;

  return (
    <div
      data-testid="placed-bin"
      ref={setNodeRef}
      className="absolute bg-white border border-slate-300 shadow-sm hover:shadow-md hover:border-[#14476B] hover:z-10 cursor-move transition-all group flex items-center justify-center"
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
        backgroundColor: placement.color ?? undefined,
        color: placement.color ? getContrastText(placement.color) : undefined
      }}
      onClick={(event) => {
        if (isDragging) return;
        onClick(event);
      }}
      {...listeners}
      {...attributes}
    >
      <div className="flex flex-col items-center gap-0.5">
        {placement.label && (
          <span className="text-[10px] font-semibold leading-none">
            {placement.label}
          </span>
        )}
        <span className="text-[10px] font-medium leading-none">
          {size.width}x{size.length}
        </span>
      </div>
      <div className="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full bg-slate-300 opacity-0 group-hover:opacity-100" />
    </div>
  );
}

function getContrastText(color: string) {
  const hex = color.replace('#', '');
  const normalized = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5 ? '#f8fafc' : '#0f172a';
}
