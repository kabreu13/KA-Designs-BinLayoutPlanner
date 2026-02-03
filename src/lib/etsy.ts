import {
  ETSY_CART_ADD_BASE_URL,
  ETSY_LISTING_ID,
  ETSY_VARIATIONS_BY_SKU
} from '../config/etsy';

export interface EtsyCartItem {
  sku: string;
  quantity: number;
}

interface EtsyCartConfig {
  listingId: string;
  variationBySku: Record<string, Record<string, string>>;
  cartAddBaseUrl: string;
}

export function buildEtsyCartUrl(
  items: EtsyCartItem[],
  config: EtsyCartConfig = {
    listingId: ETSY_LISTING_ID,
    variationBySku: ETSY_VARIATIONS_BY_SKU,
    cartAddBaseUrl: ETSY_CART_ADD_BASE_URL
  }
) {
  if (!config.listingId) {
    return { url: null, missingSkus: [], missingListingId: true };
  }

  const missingSkus: string[] = [];
  const params = new URLSearchParams();

  items.forEach((item) => {
    const variation = config.variationBySku[item.sku];
    if (!variation) {
      missingSkus.push(item.sku);
      return;
    }

    params.append('listing_id', config.listingId);
    params.append('quantity', `${Math.max(1, Math.floor(item.quantity))}`);
    Object.entries(variation)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([key, value]) => params.append(key, value));
  });

  if (missingSkus.length > 0) {
    return { url: null, missingSkus, missingListingId: false };
  }

  const query = params.toString();
  if (!query) {
    return { url: null, missingSkus: [], missingListingId: false };
  }

  return {
    url: `${config.cartAddBaseUrl}?${query}`,
    missingSkus: [],
    missingListingId: false
  };
}
