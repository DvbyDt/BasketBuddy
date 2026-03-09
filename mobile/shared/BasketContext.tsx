import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Item } from './store';
import { BasketItem } from './types';
import {
  syncBasketItemToCloud,
  removeBasketItemFromCloud,
  clearBasketInCloud,
  subscribeToBasket,
} from './firestore';

export type { BasketItem } from './types';

interface BasketContextType {
  basket: BasketItem[];
  addToBasket: (item: Item, storeId: string, quantity: number) => void;
  removeFromBasket: (itemId: number, storeId: string) => void;
  updateQuantity: (itemId: number, storeId: string, quantity: number) => void;
  clearBasket: () => void;
  isInBasket: (itemId: number, storeId: string) => boolean;
  getQuantity: (itemId: number, storeId: string) => number;
}

const BasketContext = createContext<BasketContextType>({
  basket: [],
  addToBasket: () => {},
  removeFromBasket: () => {},
  updateQuantity: () => {},
  clearBasket: () => {},
  isInBasket: () => false,
  getQuantity: () => 1,
});

export function BasketProvider({ children }: { children: ReactNode }) {
  const [basket, setBasket] = useState<BasketItem[]>([]);

  // Subscribe to Firestore basket changes (real-time sync)
  useEffect(() => {
    const unsubscribe = subscribeToBasket((cloudBasket) => {
      setBasket(cloudBasket);
    });
    return () => unsubscribe();
  }, []);

  const addToBasket = (item: Item, storeId: string, quantity: number) => {
    // If already in basket, just update quantity
    const existing = basket.find(b => b.itemId === item.id && b.store === storeId);
    if (existing) {
      updateQuantity(item.id, storeId, existing.quantity + quantity);
      return;
    }
    const price = item.prices[storeId];
    if (price == null) return;
    const basketItem: BasketItem = {
      itemId: item.id,
      name: item.name,
      quantity,
      store: storeId,
      price,
    };
    setBasket(prev => [...prev, basketItem]);
    syncBasketItemToCloud(basketItem);
  };

  const updateQuantity = (itemId: number, storeId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromBasket(itemId, storeId);
      return;
    }
    setBasket(prev =>
      prev.map(b =>
        b.itemId === itemId && b.store === storeId
          ? { ...b, quantity }
          : b
      )
    );
    const existing = basket.find(b => b.itemId === itemId && b.store === storeId);
    if (existing) {
      syncBasketItemToCloud({ ...existing, quantity });
    }
  };

  const removeFromBasket = (itemId: number, storeId: string) => {
    setBasket(prev => prev.filter(b => !(b.itemId === itemId && b.store === storeId)));
    removeBasketItemFromCloud(itemId);
  };

  const clearBasket = () => {
    setBasket([]);
    clearBasketInCloud();
  };

  const isInBasket = (itemId: number, storeId: string) =>
    basket.some(b => b.itemId === itemId && b.store === storeId);

  const getQuantity = (itemId: number, storeId: string): number => {
    const found = basket.find(b => b.itemId === itemId && b.store === storeId);
    return found?.quantity ?? 1;
  };

  return (
    <BasketContext.Provider
      value={{ basket, addToBasket, removeFromBasket, updateQuantity, clearBasket, isInBasket, getQuantity }}
    >
      {children}
    </BasketContext.Provider>
  );
}

export function useBasket() {
  return useContext(BasketContext);
}