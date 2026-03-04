// ─── Shared data & helper functions for BasketBuddy ──────────────
import rawData from './data.json';

export interface Store {
  id: string;
  name: string;
  color: string;
  emoji: string;
}

export interface Item {
  id: number;
  name: string;
  quantity: string;
  category: string;
  prices: Record<string, number>;
  history: Record<string, number[]>;
}

export const stores: Store[] = rawData.stores;
export const items = rawData.items as unknown as Item[];

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
