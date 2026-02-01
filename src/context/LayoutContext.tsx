import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { BINS } from '../data/bins';
import { clampPosition, hasCollision, findFirstFit } from '../utils/layoutMath';

export type BinCategory = 'small' | 'medium' | 'large';

export interface Bin {
  id: string;
  name: string;
  width: number; // inches
  length: number; // inches
  height: number; // inches
  category: BinCategory;
}

export interface Placement {
  id: string;
  binId: string;
  x: number; // inches from left
  y: number; // inches from top
  width?: number;
  length?: number;
  color?: string;
  label?: string;
}

interface LayoutState {
  drawerWidth: number;
  drawerLength: number;
  placements: Placement[];
  usage: Record<string, number>;
}

interface HistoryState {
  past: LayoutState[];
  present: LayoutState;
  future: LayoutState[];
}

const MAX_HISTORY = 100;

export type PlacementResultStatus = 'placed' | 'autofit' | 'blocked';

export interface PlacementResult {
  status: PlacementResultStatus;
  position?: { x: number; y: number };
}

export type SuggestLayoutStatus = 'applied' | 'blocked';
export type SuggestLayoutMode = 'pack' | 'random';

export interface SuggestLayoutResult {
  status: SuggestLayoutStatus;
  moved: number;
}

interface LayoutContextValue {
  bins: Bin[];
  placements: Placement[];
  drawerWidth: number;
  drawerLength: number;
  binUsage: Record<string, number>;
  addPlacement: (binId: string, x?: number, y?: number) => PlacementResult;
  movePlacement: (placementId: string, x: number, y: number) => PlacementResult;
  updatePlacement: (placementId: string, updates: Partial<Pick<Placement, 'width' | 'length' | 'color' | 'label'>>) => PlacementResult;
  removePlacement: (placementId: string) => void;
  setDrawerSize: (width: number, length: number) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  suggestLayout: (mode: SuggestLayoutMode) => SuggestLayoutResult;
  exportState: () => LayoutState;
  importState: (incoming: LayoutState) => boolean;
  spaceUsedPercent: number;
}

const LayoutContext = createContext<LayoutContextValue | undefined>(undefined);
const STORAGE_KEY = 'bin-layout-state';

export function LayoutProvider({ children }: { children: React.ReactNode }) {
  const devWarn = (...args: unknown[]) => {
    if (import.meta.env.DEV && import.meta.env.MODE !== 'test') {
      console.warn(...args);
    }
  };

  const devError = (...args: unknown[]) => {
    if (import.meta.env.DEV && import.meta.env.MODE !== 'test') {
      console.error(...args);
    }
  };

  const initial: LayoutState = {
    drawerWidth: 24,
    drawerLength: 18,
    placements: [],
    usage: {}
  };

  const [history, setHistory] = useState<HistoryState>(() => ({
    past: [],
    present: initial,
    future: []
  }));

  const state = history.present;
  const getPlacementSize = (placement: Placement) => {
    const bin = BINS.find((b) => b.id === placement.binId);
    const width = placement.width ?? bin?.width;
    const length = placement.length ?? bin?.length;
    if (width == null || length == null) return null;
    return { width, length };
  };

  // Load from localStorage once
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as LayoutState;
      if (parsed.drawerWidth && parsed.drawerLength && Array.isArray(parsed.placements)) {
        setHistory({
          past: [],
          present: {
            drawerWidth: parsed.drawerWidth,
            drawerLength: parsed.drawerLength,
            placements: parsed.placements,
            usage: parsed.usage ?? {}
          },
          future: []
        });
      }
    } catch (err) {
      devWarn('Failed to load layout state', err);
    }
  }, []);

  // Load from share link if present (takes precedence on first load)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get('layout');
    if (!encoded) return;
    try {
      const json = atob(decodeURIComponent(encoded));
      const parsed = JSON.parse(json) as LayoutState;
      if (parsed.drawerWidth && parsed.drawerLength && Array.isArray(parsed.placements)) {
        setHistory({
          past: [],
          present: {
            drawerWidth: parsed.drawerWidth,
            drawerLength: parsed.drawerLength,
            placements: parsed.placements,
            usage: parsed.usage ?? {}
          },
          future: []
        });
      }
    } catch (err) {
      devWarn('Failed to load layout from share link', err);
    }
  }, []);

  // Persist whenever state changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // Dev-only invariant checks: bounds + overlap
  useEffect(() => {
    if (!import.meta.env?.DEV) return;
    const problems: string[] = [];
    state.placements.forEach((placement) => {
      const size = getPlacementSize(placement);
      if (!size) return;
      if (placement.x < 0 || placement.y < 0) {
        problems.push(`Placement ${placement.id} has negative coords`);
      }
      if (placement.x + size.width > state.drawerWidth || placement.y + size.length > state.drawerLength) {
        problems.push(`Placement ${placement.id} out of bounds`);
      }
      if (hasCollision(size, placement.x, placement.y, state.placements, BINS, placement.id)) {
        problems.push(`Placement ${placement.id} overlaps another placement`);
      }
    });

    if (problems.length > 0) {
      devError('Layout invariant violations:', problems);
    }
  }, [state.drawerWidth, state.drawerLength, state.placements]);

  const pushState = (next: LayoutState) =>
    setHistory((prev) => {
      const nextPast = [...prev.past, prev.present].slice(-MAX_HISTORY);
      return {
        past: nextPast,
        present: next,
        future: []
      };
    });

  const addPlacement = (binId: string, x = 0, y = 0): PlacementResult => {
    const bin = BINS.find((b) => b.id === binId);
    if (!bin) return { status: 'blocked' };

    const { x: safeX, y: safeY } = clampPosition(x, y, bin, state.drawerWidth, state.drawerLength);

    const directCollision = hasCollision(bin, safeX, safeY, state.placements, BINS);
    let target = { x: safeX, y: safeY };
    let status: PlacementResultStatus = 'placed';

    if (directCollision) {
      const suggestion = findFirstFit(
        bin,
        safeX,
        safeY,
        state.placements,
        BINS,
        state.drawerWidth,
        state.drawerLength
      );
      if (!suggestion) return { status: 'blocked' };
      target = suggestion;
      status = 'autofit';
    }

    pushState({
      ...state,
      placements: [
        ...state.placements,
        {
          id: crypto.randomUUID ? crypto.randomUUID() : `placement-${Date.now()}-${Math.random()}`,
          binId,
          x: target.x,
          y: target.y,
          width: bin.width,
          length: bin.length
        }
      ],
      usage: { ...state.usage, [binId]: (state.usage[binId] ?? 0) + 1 }
    });
    return { status, position: target };
  };

  const movePlacement = (placementId: string, x: number, y: number): PlacementResult => {
    let result: PlacementResult = { status: 'blocked' };

    const next = (() => {
      const placement = state.placements.find((p) => p.id === placementId);
      if (!placement) return null;
      const size = getPlacementSize(placement);
      if (!size) return null;
      const { x: safeX, y: safeY } = clampPosition(x, y, size, state.drawerWidth, state.drawerLength);

      let status: PlacementResultStatus = 'placed';
      let target = { x: safeX, y: safeY };

      const collision = hasCollision(size, safeX, safeY, state.placements, BINS, placementId);
      if (collision) {
        const suggestion = findFirstFit(
          size,
          safeX,
          safeY,
          state.placements.filter((p) => p.id !== placementId),
          BINS,
          state.drawerWidth,
          state.drawerLength
        );
        if (!suggestion) {
          result = { status: 'blocked' };
          return null;
        }
        target = suggestion;
        status = 'autofit';
      }

      result = { status, position: target };
      return {
        ...state,
        placements: state.placements.map((p) =>
          p.id === placementId ? { ...p, x: target.x, y: target.y } : p
        )
      };
    })();

    if (next) pushState(next);

    return result;
  };

  const updatePlacement = (
    placementId: string,
    updates: Partial<Pick<Placement, 'width' | 'length' | 'color' | 'label'>>
  ): PlacementResult => {
    let result: PlacementResult = { status: 'blocked' };
    const next = (() => {
      const placement = state.placements.find((p) => p.id === placementId);
      if (!placement) return null;
      const currentSize = getPlacementSize(placement);
      if (!currentSize) return null;

      const nextWidth = updates.width ?? currentSize.width;
      const nextLength = updates.length ?? currentSize.length;
      const size = { width: nextWidth, length: nextLength };
      if (size.width < 2 || size.length < 2 || size.width > 8 || size.length > 8) {
        result = { status: 'blocked' };
        return null;
      }

      result = { status: 'placed', position: { x: placement.x, y: placement.y } };
      return {
        ...state,
        placements: state.placements.map((p) =>
          p.id === placementId
            ? {
                ...p,
                ...updates,
                width: nextWidth,
                length: nextLength,
                x: placement.x,
                y: placement.y
              }
            : p
        )
      };
    })();

    if (next) pushState(next);
    return result;
  };

  const suggestLayout = (mode: SuggestLayoutMode): SuggestLayoutResult => {
    if (state.placements.length === 0) {
      return { status: 'applied', moved: 0 };
    }

    const originalById = new Map(state.placements.map((p) => [p.id, p]));
    const packPlacements = (ordered: Placement[]) => {
      const nextPlacements: Placement[] = [];
      let moved = 0;
      let cursorX = 0;
      let cursorY = 0;
      let rowHeight = 0;

      for (const placement of ordered) {
        const currentSize = getPlacementSize(placement);
        if (!currentSize) return { status: 'blocked' as const, moved, placements: nextPlacements };
        if (currentSize.width > state.drawerWidth || currentSize.length > state.drawerLength) {
          return { status: 'blocked' as const, moved, placements: nextPlacements };
        }

        if (cursorX + currentSize.width > state.drawerWidth) {
          cursorX = 0;
          cursorY += rowHeight;
          rowHeight = 0;
        }

        if (cursorY + currentSize.length > state.drawerLength) {
          return { status: 'blocked' as const, moved, placements: nextPlacements };
        }

        const target = { x: cursorX, y: cursorY };
        cursorX += currentSize.width;
        rowHeight = Math.max(rowHeight, currentSize.length);

        const original = originalById.get(placement.id);
        if (!original || target.x !== original.x || target.y !== original.y) {
          moved += 1;
        }
        nextPlacements.push({ ...placement, x: target.x, y: target.y });
      }

      return { status: 'applied' as const, moved, placements: nextPlacements };
    };

    const ordered =
      mode === 'random'
        ? [...state.placements].sort(() => Math.random() - 0.5)
        : [...state.placements].sort((a, b) => {
            const sizeA = getPlacementSize(a);
            const sizeB = getPlacementSize(b);
            const areaA = sizeA ? sizeA.width * sizeA.length : 0;
            const areaB = sizeB ? sizeB.width * sizeB.length : 0;
            return areaB - areaA;
          });

    const packed = packPlacements(ordered);
    if (packed.status === 'blocked') {
      return { status: 'blocked', moved: packed.moved };
    }

    if (packed.moved > 0) {
      pushState({
        ...state,
        placements: packed.placements
      });
    }

    return { status: 'applied', moved: packed.moved };
  };

  const removePlacement = (placementId: string) => {
    pushState({
      ...state,
      placements: state.placements.filter((p) => p.id !== placementId)
    });
  };

  const setDrawerSize = (width: number, length: number) => {
    pushState({ ...state, drawerWidth: width, drawerLength: length });
  };

  const undo = () =>
    setHistory((prev) =>
      prev.past.length === 0
        ? prev
        : {
            past: prev.past.slice(0, -1),
            present: prev.past[prev.past.length - 1],
            future: [prev.present, ...prev.future]
          }
    );

  const redo = () =>
    setHistory((prev) =>
      prev.future.length === 0
        ? prev
        : {
            past: [...prev.past, prev.present],
            present: prev.future[0],
            future: prev.future.slice(1)
          }
    );

  const exportState = () => state;
  const importState = (incoming: LayoutState) => {
    if (!incoming.drawerWidth || !incoming.drawerLength || !Array.isArray(incoming.placements)) return false;
    pushState({
      drawerWidth: incoming.drawerWidth,
      drawerLength: incoming.drawerLength,
      placements: incoming.placements,
      usage: incoming.usage ?? state.usage
    });
    return true;
  };

  // Keyboard shortcuts: Ctrl/Cmd+Z / Shift+Ctrl/Cmd+Z
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
        if (history.past.length > 0) {
          e.preventDefault();
          undo();
        }
      } else if (e.key.toLowerCase() === 'z' && e.shiftKey) {
        if (history.future.length > 0) {
          e.preventDefault();
          redo();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [history.past.length, history.future.length]);

  const { spaceUsedPercent } = useMemo(() => {
    const totalArea = state.drawerWidth * state.drawerLength;
    const usedArea = state.placements.reduce((sum, placement) => {
      const size = getPlacementSize(placement);
      if (!size) return sum;
      return sum + size.width * size.length;
    }, 0);
    return {
      spaceUsedPercent: totalArea > 0 ? Math.min(100, (usedArea / totalArea) * 100) : 0
    };
  }, [state.drawerLength, state.drawerWidth, state.placements]);

  const value: LayoutContextValue = {
    bins: BINS,
    placements: state.placements,
    drawerWidth: state.drawerWidth,
    drawerLength: state.drawerLength,
    binUsage: state.usage,
    addPlacement,
    movePlacement,
    updatePlacement,
    removePlacement,
    setDrawerSize,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    suggestLayout,
    exportState,
    importState,
    spaceUsedPercent
  };

  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLayout() {
  const ctx = useContext(LayoutContext);
  if (!ctx) throw new Error('useLayout must be used within LayoutProvider');
  return ctx;
}
