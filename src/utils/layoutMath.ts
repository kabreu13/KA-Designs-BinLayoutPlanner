import type { Bin, Placement } from '../context/LayoutContext';

type Size = Pick<Bin, 'width' | 'length'>;

export function clampPosition(x: number, y: number, bin: Size, drawerWidth: number, drawerLength: number) {
  const clampedX = Math.max(0, Math.min(x, drawerWidth - bin.width));
  const clampedY = Math.max(0, Math.min(y, drawerLength - bin.length));
  return { x: clampedX, y: clampedY };
}

const getPlacementSize = (placement: Placement, bins: Bin[]): Size | null => {
  const bin = bins.find((b) => b.id === placement.binId);
  const width = placement.width ?? bin?.width;
  const length = placement.length ?? bin?.length;
  if (width == null || length == null) return null;
  return { width, length };
};

export function hasCollision(
  bin: Size,
  x: number,
  y: number,
  placements: Placement[],
  bins: Bin[],
  ignoreId?: string
) {
  const right = x + bin.width;
  const bottom = y + bin.length;

  return placements.some((p) => {
    if (ignoreId && p.id === ignoreId) return false;
    const otherSize = getPlacementSize(p, bins);
    if (!otherSize) return false;
    const oRight = p.x + otherSize.width;
    const oBottom = p.y + otherSize.length;
    const overlap =
      x < oRight &&
      right > p.x &&
      y < oBottom &&
      bottom > p.y;
    return overlap;
  });
}

export function hasFractionalPlacements(placements: Placement[], startX: number, startY: number) {
  return (
    startX % 1 !== 0 ||
    startY % 1 !== 0 ||
    placements.some((p) => p.x % 1 !== 0 || p.y % 1 !== 0)
  );
}

export function findFirstFit(
  bin: Size,
  startX: number,
  startY: number,
  placements: Placement[],
  bins: Bin[],
  drawerWidth: number,
  drawerLength: number
): { x: number; y: number } | null {
  const maxX = drawerWidth - bin.width;
  const maxY = drawerLength - bin.length;
  const step = hasFractionalPlacements(placements, startX, startY) ? 0.5 : 1;

  const candidates: { x: number; y: number; d2: number }[] = [];
  for (let y = 0; y <= maxY + 1e-6; y += step) {
    for (let x = 0; x <= maxX + 1e-6; x += step) {
      const dx = x - startX;
      const dy = y - startY;
      candidates.push({ x, y, d2: dx * dx + dy * dy });
    }
  }

  candidates.sort((a, b) => a.d2 - b.d2);

  for (const c of candidates) {
    if (!hasCollision(bin, c.x, c.y, placements, bins)) return { x: c.x, y: c.y };
  }
  return null;
}
