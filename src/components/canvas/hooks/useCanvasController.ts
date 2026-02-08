import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { Bin, Placement, PlacementResult } from '../../../context/LayoutContext';
import {
  CUSTOM_COLOR_VALUE,
  DEFAULT_BIN_COLOR,
  getColorSelection,
  normalizeHexColor
} from '../../../utils/colors';

const SIZE_STEP = 2;
const MIN_BIN_SIZE = 2;
const MAX_BIN_SIZE = 8;
const EDITOR_WIDTH_PX = 240;
const EDITOR_HEIGHT_PX = 320;
const EDITOR_OFFSET_PX = 12;
const VIEWPORT_PADDING_PX = 8;

type EditorState = { placementIds: string[]; x: number; y: number } | null;
type ToastState = { type: 'info' | 'error'; message: string } | null;

type UseCanvasControllerArgs = {
  placements: Placement[];
  bins: Bin[];
  activePlacementEditor: EditorState;
  closePlacementEditor: () => void;
  openPlacementEditor: (placementIds: string[], x: number, y: number) => void;
  updatePlacements: (
    placementIds: string[],
    updates: Partial<Pick<Placement, 'width' | 'length' | 'color' | 'label'>>
  ) => PlacementResult;
  removePlacements: (placementIds: string[]) => void;
  triggerHighlight: (placementId: string, type?: 'info' | 'error') => void;
  setToast: Dispatch<SetStateAction<ToastState>>;
  isMobileLayout: boolean;
  layoutResizeKey: number;
  mobileBottomSafeInsetPx: number;
  canvasViewportRef: MutableRefObject<HTMLDivElement | null>;
};

export function useCanvasController({
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
}: UseCanvasControllerArgs) {
  const [editor, setEditor] = useState<EditorState>(null);
  const [labelDraft, setLabelDraft] = useState('');
  const [colorDraft, setColorDraft] = useState(DEFAULT_BIN_COLOR);
  const [colorSelection, setColorSelection] = useState<string>(DEFAULT_BIN_COLOR);
  const [resizeError, setResizeError] = useState<string | null>(null);

  const editorRef = useRef<HTMLDivElement | null>(null);
  const labelInputRef = useRef<HTMLInputElement | null>(null);
  const lastFocusRef = useRef<HTMLElement | null>(null);

  const getPlacementSize = useCallback(
    (placement: Placement) => {
      const bin = bins.find((item) => item.id === placement.binId);
      const width = placement.width ?? bin?.width;
      const length = placement.length ?? bin?.length;
      if (width == null || length == null) return null;
      return { width, length, bin };
    },
    [bins]
  );

  const selectedPlacementIds = useMemo(() => editor?.placementIds ?? [], [editor]);
  const selectedCount = selectedPlacementIds.length;
  const selectedPlacement = selectedPlacementIds.length > 0
    ? placements.find((placement) => placement.id === selectedPlacementIds[0]) ?? null
    : null;
  const selectedSize = selectedPlacement ? getPlacementSize(selectedPlacement) : null;

  const editorPosition = useMemo(() => {
    if (!editor) return null;
    void layoutResizeKey;

    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : Number.POSITIVE_INFINITY;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : Number.POSITIVE_INFINITY;

    if (isMobileLayout) {
      const padding = 16;
      const width = Math.max(240, viewportWidth - padding * 2);
      const top = Math.min(
        Math.max(VIEWPORT_PADDING_PX, viewportHeight - mobileBottomSafeInsetPx - EDITOR_HEIGHT_PX - padding),
        viewportHeight - EDITOR_HEIGHT_PX - VIEWPORT_PADDING_PX
      );
      return { left: padding, top, width };
    }

    const canvasRect = canvasViewportRef.current?.getBoundingClientRect();
    let minLeft = VIEWPORT_PADDING_PX;
    let maxLeft = Math.max(VIEWPORT_PADDING_PX, viewportWidth - EDITOR_WIDTH_PX - VIEWPORT_PADDING_PX);
    let minTop = VIEWPORT_PADDING_PX;
    let maxTop = Math.max(VIEWPORT_PADDING_PX, viewportHeight - EDITOR_HEIGHT_PX - VIEWPORT_PADDING_PX);

    if (canvasRect) {
      minLeft = canvasRect.left + VIEWPORT_PADDING_PX;
      maxLeft = Math.max(minLeft, canvasRect.right - EDITOR_WIDTH_PX - VIEWPORT_PADDING_PX);
      minTop = canvasRect.top + VIEWPORT_PADDING_PX;
      maxTop = Math.max(minTop, canvasRect.bottom - EDITOR_HEIGHT_PX - VIEWPORT_PADDING_PX);
    }

    let left = editor.x + EDITOR_OFFSET_PX;
    if (left + EDITOR_WIDTH_PX + VIEWPORT_PADDING_PX > maxLeft + EDITOR_WIDTH_PX) {
      left = editor.x - EDITOR_WIDTH_PX - EDITOR_OFFSET_PX;
    }

    left = Math.min(Math.max(minLeft, left), maxLeft);
    const top = Math.min(Math.max(minTop, editor.y + EDITOR_OFFSET_PX), maxTop);
    return { left, top };
  }, [canvasViewportRef, editor, isMobileLayout, layoutResizeKey, mobileBottomSafeInsetPx]);

  const closeEditor = useCallback(() => {
    setEditor(null);
    closePlacementEditor();

    const lastFocus = lastFocusRef.current;
    if (lastFocus && typeof document !== 'undefined' && document.contains(lastFocus)) {
      window.requestAnimationFrame(() => lastFocus.focus());
    }
  }, [closePlacementEditor]);

  const openEditorForPlacement = useCallback(
    (placementId: string, element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      openPlacementEditor([placementId], rect.right, rect.top + rect.height / 2);
    },
    [openPlacementEditor]
  );

  const commitLabel = useCallback(
    (rawLabel?: string) => {
      if (selectedPlacementIds.length === 0) return;
      const nextLabel = (rawLabel ?? labelDraft).trim();
      updatePlacements(selectedPlacementIds, { label: nextLabel });
    },
    [labelDraft, selectedPlacementIds, updatePlacements]
  );

  const handleColorChange = useCallback(
    (value: string) => {
      if (selectedPlacementIds.length === 0) return;
      const normalizedColor = normalizeHexColor(value);
      setColorDraft(normalizedColor);
      setColorSelection(getColorSelection(normalizedColor));
      updatePlacements(selectedPlacementIds, { color: normalizedColor });
    },
    [selectedPlacementIds, updatePlacements]
  );

  const handleColorSelectionChange = useCallback(
    (value: string) => {
      setColorSelection(value);
      if (value === CUSTOM_COLOR_VALUE || selectedPlacementIds.length === 0) return;
      setColorDraft(value);
      updatePlacements(selectedPlacementIds, { color: value });
    },
    [selectedPlacementIds, updatePlacements]
  );

  const handleResize = useCallback(
    (axis: 'width' | 'length', direction: -1 | 1) => {
      if (!selectedSize || selectedPlacementIds.length === 0) return;
      const current = axis === 'width' ? selectedSize.width : selectedSize.length;
      const next = Math.max(MIN_BIN_SIZE, Math.min(MAX_BIN_SIZE, current + direction * SIZE_STEP));
      if (next === current) return;

      const result = updatePlacements(selectedPlacementIds, { [axis]: next });
      if (result.status === 'blocked') {
        const message = 'Cannot resize — would overlap or exceed drawer.';
        setToast({ type: 'error', message });
        setResizeError(message);
        if (selectedPlacementIds[0]) {
          triggerHighlight(selectedPlacementIds[0], 'error');
        }
        return;
      }

      setResizeError(null);
    },
    [selectedPlacementIds, selectedSize, setToast, triggerHighlight, updatePlacements]
  );

  const deleteSelectedPlacements = useCallback(() => {
    if (selectedPlacementIds.length === 0) return;
    removePlacements(selectedPlacementIds);
    closeEditor();
  }, [closeEditor, removePlacements, selectedPlacementIds]);

  useEffect(() => {
    if (!activePlacementEditor) return;
    if (typeof document !== 'undefined') {
      lastFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    setEditor(activePlacementEditor);
  }, [activePlacementEditor]);

  useEffect(() => {
    if (!editor) {
      setResizeError(null);
    }
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    const id = window.requestAnimationFrame(() => {
      labelInputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    const placement = placements.find((item) => item.id === editor.placementIds[0]);
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

  useEffect(() => {
    if (!editor || editor.placementIds.length === 0) return;
    triggerHighlight(editor.placementIds[0], 'info');
  }, [editor, triggerHighlight]);

  return {
    getPlacementSize,
    editor,
    editorRef,
    labelInputRef,
    selectedPlacementIds,
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
    sizeStep: SIZE_STEP,
    minBinSize: MIN_BIN_SIZE,
    maxBinSize: MAX_BIN_SIZE
  };
}
