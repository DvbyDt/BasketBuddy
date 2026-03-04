import React, { createContext, useContext, useState, ReactNode } from 'react';
import { getCheapestStore, Item, fmt } from './store';

export interface BasketItem {
  itemId: number;
  name: string;
  quantity: string;
  store: string;
  price: number;
}

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

  const addToBasket = (item: Item) => {
    if (basket.find(b => b.itemId === item.id)) return; // already in basket
    const cheapest = getCheapestStore(item);
    if (!cheapest) return;
    setBasket(prev => [
      ...prev,
      {
        itemId: item.id,
        name: item.name,
        quantity: item.quantity || '',
        store: cheapest.store.id,
        price: cheapest.price,
      },
    ]);
  };

  const removeFromBasket = (itemId: number) => {
    setBasket(prev => prev.filter(b => b.itemId !== itemId));
  };

  const clearBasket = () => setBasket([]);

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
