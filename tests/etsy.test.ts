import { describe, expect, it } from 'vitest';
import { buildEtsyCartUrl } from '../src/lib/etsy';

describe('buildEtsyCartUrl', () => {
  it('builds an Etsy cart URL for one listing with variation mappings', () => {
    const result = buildEtsyCartUrl(
      [
        { sku: 'REG-BIN-2x2-White', quantity: 2 },
        { sku: 'REG-BIN-4x4-Red', quantity: 1 }
      ],
      {
        listingId: '111',
        cartAddBaseUrl: 'https://www.etsy.com/cart/add',
        variationBySku: {
          'REG-BIN-2x2-White': { variation0: '2x2', variation1: 'White' },
          'REG-BIN-4x4-Red': { variation0: '4x4', variation1: 'Red' }
        }
      }
    );

    expect(result.missingSkus).toEqual([]);
    expect(result.missingListingId).toBe(false);
    expect(result.url).toBe(
      'https://www.etsy.com/cart/add?listing_id=111&quantity=2&variation0=2x2&variation1=White&listing_id=111&quantity=1&variation0=4x4&variation1=Red'
    );
  });

  it('returns missing SKUs when variation mappings are not configured', () => {
    const result = buildEtsyCartUrl(
      [{ sku: 'REG-BIN-2x2-White', quantity: 1 }],
      { listingId: '111', cartAddBaseUrl: 'https://www.etsy.com/cart/add', variationBySku: {} }
    );
    expect(result.url).toBeNull();
    expect(result.missingSkus).toEqual(['REG-BIN-2x2-White']);
    expect(result.missingListingId).toBe(false);
  });

  it('returns missingListingId when listing id is not configured', () => {
    const result = buildEtsyCartUrl(
      [{ sku: 'REG-BIN-2x2-White', quantity: 1 }],
      {
        listingId: '',
        cartAddBaseUrl: 'https://www.etsy.com/cart/add',
        variationBySku: { 'REG-BIN-2x2-White': { variation0: '2x2', variation1: 'White' } }
      }
    );
    expect(result.url).toBeNull();
    expect(result.missingSkus).toEqual([]);
    expect(result.missingListingId).toBe(true);
  });
});
