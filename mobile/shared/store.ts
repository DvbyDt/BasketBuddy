// ─── Shared data & helper functions for BasketBuddy ──────────────
import rawData from './data.json';
import { Store, Item } from './types';
export type { Store, Item, BasketItem } from './types';
import {
  syncCustomItemToCloud,
  removeCustomItemFromCloud,
  subscribeToCustomItems,
} from './firestore';

export const stores: Store[] = rawData.stores;
export const items: Item[] = [...(rawData.items as unknown as Item[])];

let _customItemsLoaded = false;
let _unsubscribe: (() => void) | null = null;
let _onCustomItemsChange: ((items: Item[]) => void) | null = null;

/** Register a callback to be notified when cloud custom items change */
export function onCustomItemsUpdate(cb: (customItems: Item[]) => void) {
  _onCustomItemsChange = cb;
}

/** Load custom items from Firestore (real-time listener) */
export async function loadCustomItems(): Promise<void> {
  if (_customItemsLoaded) return;
  _customItemsLoaded = true;

  // Subscribe to Firestore real-time updates
  _unsubscribe = subscribeToCustomItems((cloudItems: Item[]) => {
    // Remove all existing custom items from the local array
    for (let i = items.length - 1; i >= 0; i--) {
      if (items[i].id >= 10000) items.splice(i, 1);
    }
    // Add cloud items
    cloudItems.forEach(ci => {
      if (!items.find(i => i.id === ci.id)) {
        items.push(ci);
      }
    });
    // Notify listeners
    if (_onCustomItemsChange) {
      _onCustomItemsChange(items.filter(i => i.id >= 10000));
    }
  });
}

/** Add a custom item locally + sync to Firestore */
export async function addCustomItem(item: Item): Promise<void> {
  if (!items.find(i => i.id === item.id)) {
    items.push(item);
  }
  await syncCustomItemToCloud(item);
}

/** Remove a custom item locally + sync to Firestore */
export async function removeCustomItem(id: number): Promise<void> {
  const idx = items.findIndex(i => i.id === id);
  if (idx !== -1) items.splice(idx, 1);
  await removeCustomItemFromCloud(id);
}

export function getNextCustomId(): number {
  const customIds = items.filter(i => i.id >= 10000).map(i => i.id);
  return customIds.length > 0 ? Math.max(...customIds) + 1 : 10000;
}

export function fmt(price: number): string {
  return `€${price.toFixed(2)}`;
}

export function getCheapestStore(item: Item): { store: Store; price: number } | null {
  let best: { store: Store; price: number } | null = null;
  for (const s of stores) {
    const p = item.prices[s.id];
    if (p != null && (best === null || p < best.price)) {
      best = { store: s, price: p };
    }
  }
  return best;
}

export function getStoreById(id: string): Store | undefined {
  return stores.find(s => s.id === id);
}

export function getItemPrices(item: Item): { store: Store; price: number }[] {
  return stores
    .map(s => ({ store: s, price: item.prices[s.id] }))
    .filter((x): x is { store: Store; price: number } => x.price != null)
    .sort((a, b) => a.price - b.price);
}

export function getSavings(item: Item): number {
  const prices = getItemPrices(item);
  if (prices.length < 2) return 0;
  return prices[prices.length - 1].price - prices[0].price;
}

export function getCategories(): string[] {
  const cats = new Set(items.map(i => i.category));
  return ['All', ...Array.from(cats).sort()];
}

export function searchItems(query: string): Item[] {
  const q = query.toLowerCase();
  return items.filter(
    i => i.name.toLowerCase().includes(q) || (i.quantity && i.quantity.toLowerCase().includes(q))
  );
}

export function getBestDeals(limit = 10): Item[] {
  const comparable = items.filter(i => {
    const count = stores.filter(s => i.prices[s.id] != null).length;
    return count >= 2;
  });
  return comparable
    .map(item => ({ item, saving: getSavings(item) }))
    .sort((a, b) => b.saving - a.saving)
    .slice(0, limit)
    .map(x => x.item);
}
