import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useBasket } from '../shared/BasketContext';
import { Item, getItemPrices, fmt } from '../shared/store';

interface Props {
  items: Item[];
}

export function OptimizeBasket({ items }: Props) {
  const { basket } = useBasket();
  const suggestions: Array<{
    itemId: number;
    currentStore: string;
    currentPrice: number;
    betterStore: string;
    betterPrice: number;
    betterStoreId: string;
    quantity: number;
  }> = [];

  const { addToBasket, removeFromBasket } = useBasket();
  basket.forEach(basketItem => {
    const item = items.find(i => i.id === basketItem.itemId);
    if (!item) return;
    const prices = getItemPrices(item);
    const current = prices.find(p => p.store.id === basketItem.store);
    if (!current) return;
    // Find cheaper store
    const cheaper = prices.filter(p => p.price < current.price);
    if (cheaper.length > 0) {
      const best = cheaper.sort((a, b) => a.price - b.price)[0];
      suggestions.push({
        itemId: item.id,
        currentStore: current.store.name,
        currentPrice: current.price,
        betterStore: best.store.name,
        betterPrice: best.price,
        betterStoreId: best.store.id,
        quantity: basketItem.quantity,
      });
    }
  });

  if (suggestions.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.noSuggestions}>Your basket is already optimized!</Text>
      </View>
    );
  }

  // Show all optimized items and savings, handle quantity for all items in basket
  const optimizedItems = basket.map(basketItem => {
    const item = items.find(i => i.id === basketItem.itemId);
    if (!item) return null;
    const prices = getItemPrices(item);
    // Find best store for this item
    const best = prices.sort((a, b) => a.price - b.price)[0];
    return {
      name: item.name,
      bestStore: best.store.name,
      bestPrice: best.price,
      currentStore: basketItem.store,
      currentPrice: basketItem.price,
      quantity: basketItem.quantity,
    };
  }).filter(Boolean);
  const totalCurrent = optimizedItems.reduce((sum, i) => sum + (i?.currentPrice ?? 0) * (i?.quantity ?? 1), 0);
  const totalOptimized = optimizedItems.reduce((sum, i) => sum + (i?.bestPrice ?? 0) * (i?.quantity ?? 1), 0);
  const totalSavings = totalCurrent - totalOptimized;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Optimize Your Basket</Text>
      {optimizedItems.map((i, idx) => (
        <View key={`${i?.name}-${i?.bestStore}`} style={styles.suggestion}>
          <Text style={styles.suggestionText}>
            {`"${i?.name}" x${i?.quantity ?? 1} is cheapest at ${i?.bestStore ?? ''} for ${fmt((i?.bestPrice ?? 0) * (i?.quantity ?? 1))} (currently in ${i?.currentStore ?? ''} for ${fmt((i?.currentPrice ?? 0) * (i?.quantity ?? 1))})`}
          </Text>
        </View>
      ))}
      <Text style={styles.savingText}>Total Savings: {fmt(totalSavings)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
    switchBtn: {
      backgroundColor: '#007bff',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 10,
      marginTop: 6,
      alignSelf: 'flex-start',
    },
    switchBtnText: {
      color: '#fff',
      fontWeight: '800',
      fontSize: 13,
    },
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  header: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
    color: '#333',
  },
  suggestion: {
    marginBottom: 10,
  },
  suggestionText: {
    fontSize: 15,
    color: '#555',
  },
  noSuggestions: {
    fontSize: 15,
    color: '#888',
    textAlign: 'center',
  },
  savingText: {
    fontSize: 16,
    color: '#228B22',
    fontWeight: 'bold',
    marginTop: 10,
  },
});
