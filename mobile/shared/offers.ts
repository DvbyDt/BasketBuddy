// ─── shared/offers.ts ────────────────────────────────────────────
// Reads from mobile/shared/offers.json — generated weekly by the scraper.
// NO hardcoded data. If offers.json is empty or missing → empty state shown.

export type DiscountType = 'percentage' | 'fixed' | 'bogo' | 'multibuy' | 'fixed_price';

export interface Offer {
  id: string;
  itemId: number | null;
  storeId: string;
  itemName: string;
  description: string;
  discountType: DiscountType;
  value: number;
  originalPrice?: number | null;
  offerPrice?: number | null;
  validUntil: string;   // YYYY-MM-DD
}

export interface OffersFile {
  updatedAt: string;
  offers: Offer[];
}

// ── State ─────────────────────────────────────────────────────────

let _offersData: Offer[]    = [];
let _updatedAt: string|null = null;
let _loaded                 = false;

// ── Apply live data (called by datasync after GitHub fetch) ───────

export interface LiveOffersData {
  updatedAt: string;
  offers: Offer[];
}

export function applyLiveOffers(data: LiveOffersData): void {
  _offersData = data.offers ?? [];
  _updatedAt  = data.updatedAt ?? null;
  _loaded     = true;
}

// ── Load ──────────────────────────────────────────────────────────

/**
 * Load offers from offers.json.
 * @param forceReload - set true on pull-to-refresh to re-read the file
 */
export async function loadOffers(forceReload = false): Promise<void> {
  if (_loaded && !forceReload) return;
  _loaded = true;

  try {
    // React Native's require() is synchronous and cached by Metro.
    // To force a re-read on refresh in production we'd need a fetch() call,
    // but during development this works correctly each time the bundle reloads.
    const file: OffersFile = require('./offers.json');
    _offersData = file.offers ?? [];
    _updatedAt  = file.updatedAt ?? null;
  } catch {
    // offers.json doesn't exist yet — that's fine, show empty state
    _offersData = [];
    _updatedAt  = null;
  }
}

// ── Accessors ─────────────────────────────────────────────────────

export function getOffersUpdatedAt(): string | null {
  return _updatedAt;
}

export function hasOffers(): boolean {
  return _offersData.length > 0;
}

export function getActiveOffers(): Offer[] {
  const today = new Date().toISOString().split('T')[0];
  return _offersData.filter(o => (o.validUntil ?? '9999') >= today);
}

export function getOffersForItem(itemId: number, storeId: string): Offer[] {
  const today = new Date().toISOString().split('T')[0];
  return _offersData.filter(
    o => o.itemId === itemId &&
         o.storeId === storeId &&
         (o.validUntil ?? '9999') >= today
  );
}

export function getOffersForStore(storeId: string): Offer[] {
  const today = new Date().toISOString().split('T')[0];
  return _offersData.filter(
    o => o.storeId === storeId && (o.validUntil ?? '9999') >= today
  );
}

export function hasOffer(itemId: number, storeId: string): boolean {
  return getOffersForItem(itemId, storeId).length > 0;
}

// ── Discount calculator ───────────────────────────────────────────

export function calcDiscount(
  offer: Offer,
  basePrice: number,
  quantity: number
): { discountedPrice: number; saving: number; offerLabel: string } {
  let discountedPrice = basePrice;
  let saving          = 0;
  let offerLabel      = offer.description;

  switch (offer.discountType) {
    case 'percentage':
      discountedPrice = basePrice * (1 - offer.value / 100);
      saving          = (basePrice - discountedPrice) * quantity;
      offerLabel      = `${offer.value}% off`;
      break;

    case 'fixed':
      discountedPrice = Math.max(0, basePrice - offer.value);
      saving          = offer.value * quantity;
      offerLabel      = `Save €${offer.value.toFixed(2)}`;
      break;

    case 'fixed_price':
      discountedPrice = offer.value;
      saving          = Math.max(0, basePrice - offer.value) * quantity;
      offerLabel      = `Special €${offer.value.toFixed(2)}`;
      break;

    case 'bogo':
      if (quantity >= 2) {
        saving = Math.floor(quantity / 2) * basePrice;
      }
      offerLabel = 'Buy 1 Get 1 Free';
      break;

    case 'multibuy':
      if (quantity >= 2 && offer.value > 0) {
        const bundles = Math.floor(quantity / 2);
        saving = Math.max(
          0,
          basePrice * quantity - (bundles * offer.value + (quantity % 2) * basePrice)
        );
      }
      offerLabel = `2 for €${offer.value.toFixed(2)}`;
      break;
  }

  return {
    discountedPrice: Math.max(0, discountedPrice),
    saving:          Math.max(0, saving),
    offerLabel,
  };
}

export function getBestOffer(
  itemId: number,
  storeId: string,
  basePrice: number,
  quantity = 1
): { offer: Offer; discountedPrice: number; saving: number; offerLabel: string } | null {
  const offers = getOffersForItem(itemId, storeId);
  if (offers.length === 0) return null;

  let best: ReturnType<typeof getBestOffer> = null;
  for (const offer of offers) {
    const result = calcDiscount(offer, basePrice, quantity);
    if (!best || result.saving > best.saving) {
      best = { offer, ...result };
    }
  }
  return best;
}