import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { BINS } from '../data/bins';
import { clampPosition, hasCollision, findFirstFit } from '../utils/layoutMath';
import { DEFAULT_BIN_COLOR, normalizeHexColor } from '../utils/colors';

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
  layoutTitle: string;
  drawerWidth: number;
  drawerLength: number;
  placements: Placement[];
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
  layoutTitle: string;
  placements: Placement[];
  drawerWidth: number;
  drawerLength: number;
  addPlacement: (binId: string, x?: number, y?: number) => PlacementResult;
  movePlacement: (placementId: string, x: number, y: number) => PlacementResult;
  updatePlacement: (placementId: string, updates: Partial<Pick<Placement, 'width' | 'length' | 'color' | 'label'>>) => PlacementResult;
  updatePlacements: (placementIds: string[], updates: Partial<Pick<Placement, 'width' | 'length' | 'color' | 'label'>>) => PlacementResult;
  removePlacement: (placementId: string) => void;
  clearPlacements: () => void;
  activePlacementEditor: { placementIds: string[]; x: number; y: number } | null;
  openPlacementEditor: (placementIds: string[], x: number, y: number) => void;
  closePlacementEditor: () => void;
  setLayoutTitle: (title: string) => void;
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
const MIN_DRAWER_DIMENSION = 0.25;
const MAX_DRAWER_DIMENSION = 200;
const MIN_BIN_DIMENSION = 2;
const MAX_BIN_DIMENSION = 8;
const MAX_LAYOUT_TITLE_LENGTH = 80;
const MAX_LABEL_LENGTH = 80;
const MAX_PLACEMENTS = 500;
const MAX_SERIALIZED_LAYOUT_CHARS = 200_000;
const MAX_LAYOUT_QUERY_PARAM_CHARS = 300_000;
const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/;
const BINS_BY_ID = new Map(BINS.map((bin) => [bin.id, bin]));

const roundToQuarterInch = (value: number) => Math.round(value * 4) / 4;
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const normalizeDrawerDimension = (value: unknown) => {
  if (!isFiniteNumber(value)) return null;
  const roundedToQuarterInch = roundToQuarterInch(value);
  if (roundedToQuarterInch < MIN_DRAWER_DIMENSION || roundedToQuarterInch > MAX_DRAWER_DIMENSION) return null;
  return roundedToQuarterInch;
};

const normalizeDrawerSize = (width: unknown, length: unknown) => {
  const normalizedWidth = normalizeDrawerDimension(width);
  const normalizedLength = normalizeDrawerDimension(length);
  if (normalizedWidth == null || normalizedLength == null) return null;
  return { width: normalizedWidth, length: normalizedLength };
};

const normalizeBinDimension = (value: unknown) => {
  if (!isFiniteNumber(value)) return null;
  const roundedToQuarterInch = roundToQuarterInch(value);
  if (roundedToQuarterInch < MIN_BIN_DIMENSION || roundedToQuarterInch > MAX_BIN_DIMENSION) return null;
  return roundedToQuarterInch;
};

const normalizeCoordinate = (value: unknown) => {
  if (!isFiniteNumber(value)) return null;
  const roundedToQuarterInch = roundToQuarterInch(value);
  if (roundedToQuarterInch < 0 || roundedToQuarterInch > MAX_DRAWER_DIMENSION) return null;
  return roundedToQuarterInch;
};

const normalizeOptionalText = (value: unknown, maxLength: number) => {
  if (typeof value !== 'string') return undefined;
  return value.slice(0, maxLength);
};

const normalizePlacementColor = (value: unknown) => {
  if (typeof value !== 'string') return DEFAULT_BIN_COLOR;
  const normalized = normalizeHexColor(value);
  return HEX_COLOR_PATTERN.test(normalized) ? normalized : DEFAULT_BIN_COLOR;
};

const getPlacementSize = (placement: Pick<Placement, 'binId' | 'width' | 'length'>) => {
  const bin = BINS_BY_ID.get(placement.binId);
  if (!bin) return null;
  const width = placement.width ?? bin.width;
  const length = placement.length ?? bin.length;
  return { width, length };
};

const normalizePlacement = (
  candidate: unknown,
  drawerSize: { width: number; length: number },
  seenIds: Set<string>
) => {
  if (!candidate || typeof candidate !== 'object') return null;
  const value = candidate as Record<string, unknown>;

  const id = normalizeOptionalText(value.id, 120)?.trim();
  if (!id || seenIds.has(id)) return null;

  const binId = typeof value.binId === 'string' ? value.binId : null;
  if (!binId || !BINS_BY_ID.has(binId)) return null;

  const x = normalizeCoordinate(value.x);
  const y = normalizeCoordinate(value.y);
  if (x == null || y == null) return null;

  const width = value.width == null ? undefined : normalizeBinDimension(value.width);
  const length = value.length == null ? undefined : normalizeBinDimension(value.length);
  if ((value.width != null && width == null) || (value.length != null && length == null)) return null;

  const normalized: Placement = {
    id,
    binId,
    x,
    y,
    ...(width != null ? { width } : {}),
    ...(length != null ? { length } : {}),
    color: normalizePlacementColor(value.color)
  };

  const label = normalizeOptionalText(value.label, MAX_LABEL_LENGTH);
  if (label !== undefined) normalized.label = label;

  const size = getPlacementSize(normalized);
  if (!size) return null;
  if (normalized.x + size.width > drawerSize.width || normalized.y + size.length > drawerSize.length) return null;

  seenIds.add(id);
  return normalized;
};

const normalizeIncomingState = (incoming: unknown): LayoutState | null => {
  if (!incoming || typeof incoming !== 'object') return null;
  const value = incoming as Record<string, unknown>;
  const normalizedSize = normalizeDrawerSize(value.drawerWidth, value.drawerLength);
  if (!normalizedSize || !Array.isArray(value.placements)) return null;
  if (value.placements.length > MAX_PLACEMENTS) return null;

  const placements: Placement[] = [];
  const seenIds = new Set<string>();
  for (const candidate of value.placements) {
    const normalized = normalizePlacement(candidate, normalizedSize, seenIds);
    if (!normalized) return null;
    placements.push(normalized);
  }

  return {
    layoutTitle:
      typeof value.layoutTitle === 'string' ? value.layoutTitle.slice(0, MAX_LAYOUT_TITLE_LENGTH) : '',
    drawerWidth: normalizedSize.width,
    drawerLength: normalizedSize.length,
    placements
  };
};

const parseSerializedState = (raw: string): LayoutState | null => {
  if (raw.length > MAX_SERIALIZED_LAYOUT_CHARS) return null;
  const parsed = JSON.parse(raw) as unknown;
  return normalizeIncomingState(parsed);
};

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
    layoutTitle: '',
    drawerWidth: 24,
    drawerLength: 18,
    placements: []
  };

  const [history, setHistory] = useState<HistoryState>(() => ({
    past: [],
    present: initial,
    future: []
  }));
  const [activePlacementEditor, setActivePlacementEditor] = useState<{ placementIds: string[]; x: number; y: number } | null>(null);

  const state = history.present;

  // Load from localStorage once
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = parseSerializedState(raw);
      if (parsed) {
        setHistory({
          past: [],
          present: parsed,
          future: []
        });
      } else {
        devWarn('Ignoring invalid persisted layout state');
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
    if (encoded.length > MAX_LAYOUT_QUERY_PARAM_CHARS) {
      devWarn('Ignoring oversized share link payload');
      return;
    }
    try {
      const decoded = decodeURIComponent(encoded);
      if (decoded.length > MAX_LAYOUT_QUERY_PARAM_CHARS) {
        devWarn('Ignoring oversized share link payload');
        return;
      }
      const json = atob(decoded);
      const parsed = parseSerializedState(json);
      if (!parsed) {
        devWarn('Ignoring invalid share link payload');
        return;
      }
      const shouldApply =
        typeof window.confirm !== 'function'
          ? true
          : window.confirm('Load shared layout from this link? This will replace your current layout.');
      if (!shouldApply) return;

      setHistory({
        past: [],
        present: parsed,
        future: []
      });
    } catch (err) {
      devWarn('Failed to load layout from share link', err);
    }
  }, []);

  // Persist whenever state changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      devWarn('Failed to persist layout state', err);
    }
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
    if (bin.width > state.drawerWidth || bin.length > state.drawerLength) {
      return { status: 'blocked' };
    }

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
          length: bin.length,
          color: DEFAULT_BIN_COLOR
        }
      ]
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
      const nextColor = updates.color ? normalizeHexColor(updates.color) : undefined;
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
                ...(nextColor ? { color: nextColor } : {}),
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

  const updatePlacements = (
    placementIds: string[],
    updates: Partial<Pick<Placement, 'width' | 'length' | 'color' | 'label'>>
  ): PlacementResult => {
    const ids = Array.from(new Set(placementIds));
    if (ids.length === 0) return { status: 'blocked' };
    let result: PlacementResult = { status: 'blocked' };
    const next = (() => {
      const targetSet = new Set(ids);
      const targetPlacements = state.placements.filter((placement) => targetSet.has(placement.id));
      if (targetPlacements.length === 0) return null;
      const nextColor = updates.color ? normalizeHexColor(updates.color) : undefined;

      const nextById = new Map<string, Placement>();
      for (const placement of targetPlacements) {
        const currentSize = getPlacementSize(placement);
        if (!currentSize) return null;
        const nextWidth = updates.width ?? currentSize.width;
        const nextLength = updates.length ?? currentSize.length;
        if (nextWidth < 2 || nextLength < 2 || nextWidth > 8 || nextLength > 8) {
          return null;
        }
        nextById.set(placement.id, {
          ...placement,
          ...updates,
          ...(nextColor ? { color: nextColor } : {}),
          width: nextWidth,
          length: nextLength,
          x: placement.x,
          y: placement.y
        });
      }

      result = {
        status: 'placed',
        position: { x: targetPlacements[0].x, y: targetPlacements[0].y }
      };

      return {
        ...state,
        placements: state.placements.map((placement) => nextById.get(placement.id) ?? placement)
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

  const clearPlacements = () => {
    if (state.placements.length === 0) return;
    pushState({
      ...state,
      placements: []
    });
  };

  const openPlacementEditor = (placementIds: string[], x: number, y: number) => {
    const ids = Array.from(new Set(placementIds));
    if (ids.length === 0) return;
    setActivePlacementEditor({ placementIds: ids, x, y });
  };

  const closePlacementEditor = () => {
    setActivePlacementEditor(null);
  };

  const setDrawerSize = (width: number, length: number) => {
    const normalizedSize = normalizeDrawerSize(width, length);
    if (!normalizedSize) return;
    if (normalizedSize.width === state.drawerWidth && normalizedSize.length === state.drawerLength) return;
    pushState({ ...state, drawerWidth: normalizedSize.width, drawerLength: normalizedSize.length });
  };

  const setLayoutTitle = (title: string) => {
    setHistory((prev) => ({
      ...prev,
      present: { ...prev.present, layoutTitle: title }
    }));
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
    const normalized = normalizeIncomingState(incoming);
    if (!normalized) return false;
    pushState(normalized);
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
    layoutTitle: state.layoutTitle,
    placements: state.placements,
    drawerWidth: state.drawerWidth,
    drawerLength: state.drawerLength,
    addPlacement,
    movePlacement,
    updatePlacement,
    updatePlacements,
    removePlacement,
    clearPlacements,
    activePlacementEditor,
    openPlacementEditor,
    closePlacementEditor,
    setLayoutTitle,
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
