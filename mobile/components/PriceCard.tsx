import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Item, getCheapestStore, getItemPrices, fmt, getSavings } from '../shared/store';
import { StoreBadge } from './StoreBadge';
import { COLORS, SHADOWS } from '../shared/theme';

interface Props {
  item: Item;
  onPress?: () => void;
  showAllPrices?: boolean;
}

export function PriceCard({ item, onPress, showAllPrices = false }: Props) {
  const cheapest = getCheapestStore(item);
  const saving = getSavings(item);
  const prices = getItemPrices(item);

  if (!cheapest) return null;

  return (
    <TouchableOpacity
      style={[styles.card, SHADOWS.card]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>
            {item.name}
            {item.quantity ? (
              <Text style={styles.quantity}> ({item.quantity})</Text>
            ) : null}
          </Text>
          <Text style={styles.category}>{item.category}</Text>
        </View>
        <StoreBadge store={cheapest.store} size="sm" />
      </View>

      {showAllPrices && prices.length > 1 ? (
        <View style={styles.priceList}>
          {prices.map((p, i) => (
            <View key={p.store.id} style={styles.priceRow}>
              <StoreBadge store={p.store} size="sm" />
              <Text
                style={[
                  styles.priceAmount,
                  i === 0 && { color: COLORS.green },
                  i === prices.length - 1 && { color: COLORS.red },
                ]}
              >
                {fmt(p.price)}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.footer}>
          <Text style={[styles.bestPrice, { color: COLORS.green }]}>
            {fmt(cheapest.price)}
          </Text>
          {saving > 0 && (
            <View style={styles.savingPill}>
              <Text style={styles.savingText}>Save {fmt(saving)}</Text>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  name: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
  },
  quantity: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.muted,
  },
  category: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.muted,
    marginTop: 2,
  },
  priceList: {
    marginTop: 12,
    gap: 8,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceAmount: {
    fontSize: 16,
    fontWeight: '800',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  bestPrice: {
    fontSize: 20,
    fontWeight: '800',
  },
  savingPill: {
    backgroundColor: COLORS.savingBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  savingText: {
    color: COLORS.green,
    fontWeight: '800',
    fontSize: 12,
  },
});
