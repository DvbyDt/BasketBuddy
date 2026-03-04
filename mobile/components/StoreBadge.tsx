import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Store } from '../shared/store';

interface Props {
  store: Store;
  size?: 'sm' | 'md';
}

export function StoreBadge({ store, size = 'md' }: Props) {
  const isSmall = size === 'sm';
  return (
    <View style={[styles.badge, { backgroundColor: store.color }, isSmall && styles.badgeSm]}>
      <Text style={[styles.text, isSmall && styles.textSm]}>
        {store.emoji} {store.name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeSm: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  text: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  textSm: {
    fontSize: 11,
  },
});
