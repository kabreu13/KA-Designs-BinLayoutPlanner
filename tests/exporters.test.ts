import { describe, expect, it } from 'vitest';
import { buildBinSku } from '../src/lib/exporters';

describe('buildBinSku', () => {
  it('formats preset color SKUs without dimension markers', () => {
    expect(buildBinSku(4, 2, '#dc2626')).toBe('REG-BIN-2x4-Red');
  });

  it('formats custom color SKUs with # hex color', () => {
    expect(buildBinSku(6, 8, '#a1b2c3')).toBe('REG-BIN-8x6-Custom-#a1b2c3');
  });
});
