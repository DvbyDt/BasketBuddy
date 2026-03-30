import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Store } from '../shared/store';

interface Props {
  store: Store;
  size?: 'sm' | 'md';
}

export function StoreBadge({ store, size = 'md' }: Props) {
  if (size === 'sm') {
    // Compact square chip: emoji + 4-char abbreviated name.
    // Fixed width prevents overflow inside PriceCard rows on narrow screens.
    return (
      <View style={[styles.badgeSm, { backgroundColor: store.color }]}>
        <Text style={styles.emojiSm}>{store.emoji}</Text>
        <Text style={styles.textSm} numberOfLines={1}>{store.name.slice(0, 5)}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.badge, { backgroundColor: store.color }]}>
      <Text style={styles.text}>{store.emoji} {store.name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // md — full pill used in cards, detail views
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  text: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },

  // sm — compact fixed-width chip used inside PriceCard rows
  badgeSm: {
    width: 52,
    paddingVertical: 5,
    borderRadius: 8,
    alignItems: 'center',
    flexShrink: 0,
  },
  emojiSm: {
    fontSize: 13,
    lineHeight: 15,
  },
  textSm: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 9,
    lineHeight: 11,
    marginTop: 1,
  },
});
