// ─── Shared types for BasketBuddy ────────────────────────────────

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

export interface BasketItem {
  itemId: number;
  name: string;
  quantity: number;
  store: string;
  price: number;
}
