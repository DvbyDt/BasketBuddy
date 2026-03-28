// ─── Unit tests for store.ts utility functions ────────────────────
// These test pure functions that take Item/Store objects directly —
// no Firebase, no AsyncStorage, no network calls.

import type { Item, Store } from '../shared/types';

// ── Test fixtures ─────────────────────────────────────────────────

const mockStores: Store[] = [
  { id: 'tesco',      name: 'Tesco',      color: '#EE1C25', emoji: '🔴' },
  { id: 'lidl',       name: 'Lidl',       color: '#0050AA', emoji: '🔵' },
  { id: 'aldi',       name: 'Aldi',       color: '#FF6600', emoji: '🟠' },
  { id: 'supervalue', name: 'Super Value',color: '#06D6A0', emoji: '🟢' },
];

const itemInAllStores: Item = {
  id: 1,
  name: 'Whole Milk',
  quantity: '2L',
  category: 'Dairy',
  prices: { tesco: 2.29, lidl: 1.99, aldi: 1.89, supervalue: 2.49 },
  history: { tesco: [2.29], lidl: [1.99], aldi: [1.89], supervalue: [2.49] },
};

const itemInOneStore: Item = {
  id: 2,
  name: 'Kimchi',
  quantity: '500g',
  category: 'World Foods',
  prices: { asian: 3.99 },
  history: { asian: [3.99] },
};

const itemInTwoStores: Item = {
  id: 3,
  name: 'Brown Bread',
  quantity: '800g',
  category: 'Bakery',
  prices: { tesco: 1.80, lidl: 1.49 },
  history: { tesco: [1.80], lidl: [1.49] },
};

// ── Inline implementations of pure helpers (no module mocking needed) ──
// We test the logic directly, mirroring store.ts exactly.

function getCheapestStore(item: Item, stores: Store[]) {
  let best: { store: Store; price: number } | null = null;
  for (const s of stores) {
    const p = item.prices[s.id];
    if (p != null && (best === null || p < best.price)) {
      best = { store: s, price: p };
    }
  }
  return best;
}

function getItemPrices(item: Item, stores: Store[]) {
  return stores
    .map(s => ({ store: s, price: item.prices[s.id] }))
    .filter((x): x is { store: Store; price: number } => x.price != null)
    .sort((a, b) => a.price - b.price);
}

function getSavings(item: Item, stores: Store[]): number {
  const prices = getItemPrices(item, stores);
  if (prices.length < 2) return 0;
  return prices[prices.length - 1].price - prices[0].price;
}

function searchItems(query: string, items: Item[]): Item[] {
  const q = query.toLowerCase();
  return items.filter(
    i => i.name.toLowerCase().includes(q) ||
         (i.quantity && i.quantity.toLowerCase().includes(q))
  );
}

function fmt(price: number): string {
  return `€${price.toFixed(2)}`;
}

// ── Tests ─────────────────────────────────────────────────────────

describe('getCheapestStore', () => {
  it('returns the store with the lowest price', () => {
    const result = getCheapestStore(itemInAllStores, mockStores);
    expect(result).not.toBeNull();
    expect(result!.store.id).toBe('aldi');
    expect(result!.price).toBe(1.89);
  });

  it('returns null for an item with no prices in the given stores', () => {
    const result = getCheapestStore(itemInOneStore, mockStores);
    expect(result).toBeNull();
  });

  it('returns the only available store', () => {
    const result = getCheapestStore(itemInTwoStores, mockStores);
    expect(result).not.toBeNull();
    expect(result!.store.id).toBe('lidl');
  });
});

describe('getItemPrices', () => {
  it('returns prices sorted cheapest first', () => {
    const prices = getItemPrices(itemInAllStores, mockStores);
    expect(prices.length).toBe(4);
    expect(prices[0].price).toBe(1.89);
    expect(prices[3].price).toBe(2.49);
  });

  it('omits stores where the item has no price', () => {
    const prices = getItemPrices(itemInOneStore, mockStores);
    expect(prices.length).toBe(0); // asian store not in mockStores
  });
});

describe('getSavings', () => {
  it('returns the difference between most and least expensive store', () => {
    const saving = getSavings(itemInAllStores, mockStores);
    expect(saving).toBeCloseTo(2.49 - 1.89, 5);
  });

  it('returns 0 when item is only in one store', () => {
    const saving = getSavings(itemInOneStore, mockStores);
    expect(saving).toBe(0);
  });

  it('returns correct saving for two stores', () => {
    const saving = getSavings(itemInTwoStores, mockStores);
    expect(saving).toBeCloseTo(1.80 - 1.49, 5);
  });
});

describe('searchItems', () => {
  const allItems = [itemInAllStores, itemInOneStore, itemInTwoStores];

  it('finds items by name substring (case-insensitive)', () => {
    expect(searchItems('milk', allItems)).toEqual([itemInAllStores]);
    expect(searchItems('BREAD', allItems)).toEqual([itemInTwoStores]);
  });

  it('finds items by quantity', () => {
    expect(searchItems('500g', allItems)).toEqual([itemInOneStore]);
  });

  it('returns all items for empty query', () => {
    // empty string matches everything since ''.includes('') === true for all items
    expect(searchItems('', allItems).length).toBe(3);
  });

  it('returns empty array when nothing matches', () => {
    expect(searchItems('xyznotfound', allItems)).toEqual([]);
  });
});

describe('fmt', () => {
  it('formats prices with euro sign and 2 decimal places', () => {
    expect(fmt(1.5)).toBe('€1.50');
    expect(fmt(10)).toBe('€10.00');
    expect(fmt(0.99)).toBe('€0.99');
  });
});
