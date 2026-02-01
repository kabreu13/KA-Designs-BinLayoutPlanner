import { describe, it, expect } from 'vitest';
import { clampPosition, findFirstFit, hasCollision, hasFractionalPlacements } from '../src/utils/layoutMath';
import type { Bin, Placement } from '../src/context/LayoutContext';

const bin2x2: Bin = { id: 'b1', name: '2x2', width: 2, length: 2, height: 2, category: 'small' };
const bin4x4: Bin = { id: 'b2', name: '4x4', width: 4, length: 4, height: 2, category: 'small' };
const binHalf: Bin = { id: 'b3', name: '0.5x0.5', width: 0.5, length: 0.5, height: 1, category: 'small' };

describe('layoutMath basics', () => {
  it('clampPosition clamps within bounds', () => {
    const pos = clampPosition(-5, 20, bin2x2, 10, 10);
    expect(pos.x).toBe(0);
    expect(pos.y).toBe(8);
  });

  it('hasCollision detects overlap', () => {
    const placements: Placement[] = [{ id: 'p1', binId: 'b1', x: 1, y: 1 }];
    expect(hasCollision(bin2x2, 1, 1, placements, [bin2x2])).toBe(true);
    expect(hasCollision(bin2x2, 4, 4, placements, [bin2x2])).toBe(false);
  });

  it('hasCollision ignores matching placement id and missing bins', () => {
    const placements: Placement[] = [
      { id: 'p1', binId: 'b1', x: 0, y: 0 },
      { id: 'p2', binId: 'missing', x: 0, y: 0 }
    ];
    expect(hasCollision(bin2x2, 0, 0, placements, [bin2x2], 'p1')).toBe(false);
    expect(hasCollision(bin2x2, 0, 0, placements, [bin2x2])).toBe(true);
  });

  it('hasCollision respects placement size overrides', () => {
    const placements: Placement[] = [{ id: 'p1', binId: 'b1', x: 0, y: 0, width: 4, length: 4 }];
    expect(hasCollision(bin2x2, 3, 3, placements, [bin2x2, bin4x4])).toBe(true);
    expect(hasCollision(bin2x2, 4, 4, placements, [bin2x2, bin4x4])).toBe(false);
  });

  it('hasFractionalPlacements detects fractional inputs', () => {
    const placements: Placement[] = [{ id: 'p1', binId: 'b1', x: 0.5, y: 0 }];
    expect(hasFractionalPlacements([], 0, 0)).toBe(false);
    expect(hasFractionalPlacements([], 0.5, 0)).toBe(true);
    expect(hasFractionalPlacements(placements, 0, 0)).toBe(true);
  });

  it('findFirstFit returns null when no space', () => {
    const placements: Placement[] = [{ id: 'p1', binId: 'b2', x: 0, y: 0 }];
    const result = findFirstFit(bin2x2, 0, 0, placements, [bin2x2, bin4x4], 4, 4);
    expect(result).toBeNull();
  });

  it('findFirstFit returns nearest free cell', () => {
    const placements: Placement[] = [
      { id: 'p1', binId: 'b1', x: 0, y: 0 },
      { id: 'p2', binId: 'b1', x: 2, y: 0 }
    ];
    const result = findFirstFit(bin2x2, 0, 0, placements, [bin2x2], 6, 6);
    expect(result).not.toBeNull();
    if (result) {
      expect(result.x).toBe(0);
      expect(result.y).toBe(2);
    }
  });

  it('findFirstFit honors fractional start positions', () => {
    const placements: Placement[] = [];
    const result = findFirstFit(bin2x2, 0.5, 0.5, placements, [bin2x2], 6, 6);
    expect(result).not.toBeNull();
    if (result) {
      expect(result.x).toBe(0.5);
      expect(result.y).toBe(0.5);
    }
  });

  it('findFirstFit uses fractional steps when placements are fractional', () => {
    const placements: Placement[] = [
      { id: 'p1', binId: 'b3', x: 0, y: 0 },
      { id: 'p2', binId: 'b3', x: 0.5, y: 0 }
    ];
    const result = findFirstFit(binHalf, 0, 0, placements, [binHalf], 1, 1);
    expect(result).toEqual({ x: 0, y: 0.5 });
  });
});
