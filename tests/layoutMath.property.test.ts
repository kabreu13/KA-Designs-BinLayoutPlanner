import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { clampPosition, findFirstFit, hasCollision } from '../src/utils/layoutMath';
import type { Bin, Placement } from '../src/context/LayoutContext';

const makeBins = (drawerWidth: number, drawerLength: number, count: number): Bin[] =>
  Array.from({ length: count }, (_, i) => {
    const width = Math.max(1, Math.min(drawerWidth, (i + 2) % drawerWidth || 1));
    const length = Math.max(1, Math.min(drawerLength, (i + 3) % drawerLength || 1));
    return {
      id: `bin-${i}`,
      name: `bin-${i}`,
      width,
      length,
      height: 2,
      category: 'small'
    };
  });

const bruteHasSpace = (
  bin: Bin,
  placements: Placement[],
  bins: Bin[],
  drawerWidth: number,
  drawerLength: number,
  startX: number,
  startY: number
) => {
  const maxX = drawerWidth - bin.width;
  const maxY = drawerLength - bin.length;
  const candidates: { x: number; y: number; d2: number }[] = [];
  for (let y = 0; y <= maxY; y += 1) {
    for (let x = 0; x <= maxX; x += 1) {
      const dx = x - startX;
      const dy = y - startY;
      candidates.push({ x, y, d2: dx * dx + dy * dy });
    }
  }
  candidates.sort((a, b) => a.d2 - b.d2);
  return candidates.find((c) => !hasCollision(bin, c.x, c.y, placements, bins)) ?? null;
};

describe('layoutMath properties', () => {
  it('clampPosition always keeps bins within bounds', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 4, max: 10 }),
        fc.integer({ min: 4, max: 10 }),
        fc.integer({ min: -20, max: 20 }),
        fc.integer({ min: -20, max: 20 }),
        (drawerWidth, drawerLength, x, y) => {
          const bin: Bin = {
            id: 'bin',
            name: 'bin',
            width: Math.max(1, Math.min(drawerWidth, 3)),
            length: Math.max(1, Math.min(drawerLength, 3)),
            height: 2,
            category: 'small'
          };
          const pos = clampPosition(x, y, bin, drawerWidth, drawerLength);
          expect(pos.x).toBeGreaterThanOrEqual(0);
          expect(pos.y).toBeGreaterThanOrEqual(0);
          expect(pos.x).toBeLessThanOrEqual(drawerWidth - bin.width);
          expect(pos.y).toBeLessThanOrEqual(drawerLength - bin.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('hasCollision ignores the provided placement id', () => {
    const bin: Bin = { id: 'bin', name: 'bin', width: 2, length: 2, height: 2, category: 'small' };
    const placements: Placement[] = [{ id: 'p1', binId: 'bin', x: 1, y: 1 }];
    const result = hasCollision(bin, 1, 1, placements, [bin], 'p1');
    expect(result).toBe(false);
  });

  it('findFirstFit returns a non-colliding in-bounds placement if one exists', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 4, max: 8 }),
        fc.integer({ min: 4, max: 8 }),
        fc.integer({ min: 0, max: 3 }),
        fc.integer({ min: 0, max: 3 }),
        fc.integer({ min: 1, max: 3 }),
        fc.integer({ min: 1, max: 3 }),
        fc.integer({ min: 0, max: 4 }),
        (drawerWidth, drawerLength, startX, startY, binW, binL, placementCount) => {
          const bin: Bin = { id: 'b0', name: 'b0', width: Math.min(binW, drawerWidth), length: Math.min(binL, drawerLength), height: 2, category: 'small' };
          const bins = [bin, ...makeBins(drawerWidth, drawerLength, 2)];
          const placements: Placement[] = Array.from({ length: placementCount }, (_, i) => {
            const otherBin = bins[(i + 1) % bins.length];
            const maxX = Math.max(0, drawerWidth - otherBin.width);
            const maxY = Math.max(0, drawerLength - otherBin.length);
            return {
              id: `p${i}`,
              binId: otherBin.id,
              x: (i * 2) % (maxX + 1),
              y: (i * 3) % (maxY + 1)
            };
          });

          const expected = bruteHasSpace(bin, placements, bins, drawerWidth, drawerLength, startX, startY);
          const actual = findFirstFit(bin, startX, startY, placements, bins, drawerWidth, drawerLength);

          if (expected) {
            expect(actual).not.toBeNull();
          }
          if (actual) {
            expect(actual.x).toBeGreaterThanOrEqual(0);
            expect(actual.y).toBeGreaterThanOrEqual(0);
            expect(actual.x).toBeLessThanOrEqual(drawerWidth - bin.width);
            expect(actual.y).toBeLessThanOrEqual(drawerLength - bin.length);
            expect(hasCollision(bin, actual.x, actual.y, placements, bins)).toBe(false);
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});
