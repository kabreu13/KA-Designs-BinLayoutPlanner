export const ETSY_CART_ADD_BASE_URL = 'https://www.etsy.com/cart/add';

// One Etsy listing that contains all of the size/color variations used by the app.
// Example:
// export const ETSY_LISTING_ID = '1234567890';
export const ETSY_LISTING_ID = '';

// Map each SKU to the Etsy variation query params for that listing.
// Variation param names are typically "variation0", "variation1", etc.
// Example:
// 'REG-BIN-2x2-White': { variation0: '2x2', variation1: 'White' }
export const ETSY_VARIATIONS_BY_SKU: Record<string, Record<string, string>> = {};
