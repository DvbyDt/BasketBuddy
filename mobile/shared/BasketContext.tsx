import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getCheapestStore, Item } from './store';
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
  addToBasket: (item: Item) => void;
  removeFromBasket: (itemId: number) => void;
  clearBasket: () => void;
  isInBasket: (itemId: number) => boolean;
}

const BasketContext = createContext<BasketContextType>({
  basket: [],
  addToBasket: () => {},
  removeFromBasket: () => {},
  clearBasket: () => {},
  isInBasket: () => false,
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

  const addToBasket = (item: Item) => {
    if (basket.find(b => b.itemId === item.id)) return;
    const cheapest = getCheapestStore(item);
    if (!cheapest) return;
    const basketItem: BasketItem = {
      itemId: item.id,
      name: item.name,
      quantity: item.quantity || '',
      store: cheapest.store.id,
      price: cheapest.price,
    };
    // Optimistic local update + cloud sync
    setBasket(prev => [...prev, basketItem]);
    syncBasketItemToCloud(basketItem);
  };

  const removeFromBasket = (itemId: number) => {
    setBasket(prev => prev.filter(b => b.itemId !== itemId));
    removeBasketItemFromCloud(itemId);
  };

  const clearBasket = () => {
    setBasket([]);
    clearBasketInCloud();
  };

  const isInBasket = (itemId: number) => basket.some(b => b.itemId === itemId);

  return (
    <BasketContext.Provider
      value={{ basket, addToBasket, removeFromBasket, clearBasket, isInBasket }}
    >
      {children}
    </BasketContext.Provider>
  );
}

export function useBasket() {
  return useContext(BasketContext);
}
