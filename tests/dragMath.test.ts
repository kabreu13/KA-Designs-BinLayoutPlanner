import { describe, it, expect } from 'vitest';
import { applyDelta } from '../src/utils/dragMath';

describe('applyDelta', () => {
  it('adds delta to origin point', () => {
    expect(applyDelta({ x: 10, y: 5 }, { x: -3, y: 7 })).toEqual({ x: 7, y: 12 });
  });
});
