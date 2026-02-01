import { useEffect, useMemo, useRef, useState } from 'react';
import { useDndMonitor, useDroppable, useDraggable } from '@dnd-kit/core';
import { Button } from './ui/Button';
import { Grid, Sparkles, RotateCcw, RotateCw, Magnet } from 'lucide-react';
import { useLayout } from '../context/LayoutContext';
import { applyDelta, type DragItem, type Point } from '../utils/dragMath';
import type { Bin, Placement } from '../context/LayoutContext';

const GRID_SIZE = 25; // px per inch on canvas
const FRAME_THROTTLE_MS = 16; // ~60fps

export function Canvas() {
  const {
    placements,
    bins,
    drawerWidth,
    drawerLength,
    addPlacement,
    movePlacement,
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
  const [snap, setSnap] = useState<0.5 | 1>(1);
  const [toast, setToast] = useState<{ type: 'info' | 'error'; message: string } | null>(null);
  const [dragStatus, setDragStatus] = useState<{ placementId: string; fits: boolean } | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const dropAreaRef = useRef<HTMLDivElement | null>(null);
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

  const handleSuggestLayout = () => {
    const result = suggestLayout();
    if (result.status === 'blocked') {
      setToast({ type: 'error', message: 'No layout fits all bins in the drawer.' });
      return;
    }
    if (result.moved === 0) {
      setToast({ type: 'info', message: 'Layout already fits.' });
      return;
    }
    setToast({ type: 'info', message: 'Suggested layout applied.' });
  };

  const gridSize = GRID_SIZE;
  const dropAreaSize = useMemo(
    () => ({ widthPx: drawerWidth * gridSize, heightPx: drawerLength * gridSize }),
    [drawerWidth, drawerLength, gridSize]
  );

  const { setNodeRef: setDropNodeRef } = useDroppable({ id: 'drop-area' });

  const attachDropAreaRef = (node: HTMLDivElement | null) => {
    dropAreaRef.current = node;
    setDropNodeRef(node);
  };

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
    const bin = bins.find((b) => b.id === drag.binId);
    if (!bin) return null;
    const maxX = Math.max(0, drawerWidth - bin.width);
    const maxY = Math.max(0, drawerLength - bin.length);
    const isOutOfBounds = rawX < 0 || rawY < 0 || rawX > maxX || rawY > maxY;
    const x = Math.max(0, Math.min(rawX, maxX));
    const y = Math.max(0, Math.min(rawY, maxY));
    return { rawX, rawY, x, y, bin, isOutOfBounds };
  };

  const computePlacementTargetFromDelta = (delta: Point, drag: DragItem) => {
    if (drag.type !== 'placement' || !originPlacementRef.current) return null;
    const bin = bins.find((b) => b.id === drag.binId);
    if (!bin) return null;
    const rawX = originPlacementRef.current.x + delta.x / gridSize;
    const rawY = originPlacementRef.current.y + delta.y / gridSize;
    const maxX = Math.max(0, drawerWidth - bin.width);
    const maxY = Math.max(0, drawerLength - bin.length);
    const isOutOfBounds = rawX < 0 || rawY < 0 || rawX > maxX || rawY > maxY;
    const x = Math.max(0, Math.min(rawX, maxX));
    const y = Math.max(0, Math.min(rawY, maxY));
    return { rawX, rawY, x, y, bin, isOutOfBounds };
  };

  const getDragDelta = (event: { active: { rect: { current: { initial: DOMRect | null; translated: DOMRect | null } } }; delta: Point }) => {
    const initial = event.active.rect.current.initial;
    const translated = event.active.rect.current.translated;
    if (initial && translated) {
      return { x: translated.left - initial.left, y: translated.top - initial.top };
    }
    return event.delta;
  };

  const hasCollisionAt = (bin: Bin, x: number, y: number, ignoreId?: string) =>
    placements.some((p) => {
      if (ignoreId && p.id === ignoreId) return false;
      const other = bins.find((b) => b.id === p.binId);
      if (!other) return false;
      return (
        x < p.x + other.width &&
        x + bin.width > p.x &&
        y < p.y + other.length &&
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

      const collision = hasCollisionAt(drop.bin, drop.x, drop.y, activeDragRef.current.placementId);
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
              const bin = bins.find((b) => b.id === placement.binId);
              if (!bin) return null;
              return (
                <DraggablePlacement
                  key={placement.id}
                  placement={placement}
                  bin={bin}
                  gridSize={gridSize}
                  dragStatus={dragStatus}
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

        <button
          onClick={() => setSnap((s) => (s === 1 ? 0.5 : 1))}
          title={`Snap to ${snap === 1 ? '1"' : '0.5"'}`}
          className={`p-2 rounded-full transition-colors ${
            snap === 1 ? 'bg-slate-100 text-slate-700' : 'bg-[#14476B]/10 text-[#14476B]'
          }`}
        >
          <Magnet className="h-4 w-4" />
        </button>

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
  bin,
  gridSize,
  dragStatus
}: {
  placement: Placement;
  bin: Bin;
  gridSize: number;
  dragStatus: { placementId: string; fits: boolean } | null;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `placement-${placement.id}`,
    data: { type: 'placement', placementId: placement.id, binId: placement.binId }
  });

  const isActive = isDragging && dragStatus?.placementId === placement.id;
  const borderColor = isActive ? (dragStatus?.fits ? '#16a34a' : '#dc2626') : undefined;

  const translate = transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined;

  return (
    <div
      data-testid="placed-bin"
      ref={setNodeRef}
      className="absolute bg-white border border-slate-300 shadow-sm hover:shadow-md hover:border-[#14476B] hover:z-10 cursor-move transition-all group flex items-center justify-center"
      style={{
        left: `${placement.x * gridSize}px`,
        top: `${placement.y * gridSize}px`,
        width: `${bin.width * gridSize}px`,
        height: `${bin.length * gridSize}px`,
        transform: translate,
        transition: isDragging ? 'none' : undefined,
        zIndex: isDragging ? 30 : undefined,
        opacity: isDragging ? 0.55 : 1,
        borderColor
      }}
      {...listeners}
      {...attributes}
    >
      <span className="text-[10px] font-medium text-slate-500 group-hover:text-[#14476B]">
        {bin.width}x{bin.length}
      </span>
      <div className="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full bg-slate-300 opacity-0 group-hover:opacity-100" />
    </div>
  );
}
