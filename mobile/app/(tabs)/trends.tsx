import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { COLORS, SHADOWS } from '../../shared/theme';
import {
  items,
  stores,
  getCategories,
  fmt,
  Item,
} from '../../shared/store';

const STORE_COLORS = ['#EE1C25', '#0050AA', '#FF6600', '#9B5DE5', '#06D6A0'];
const WEEK_LABELS = ['W1', 'W2', 'W3', 'W4', 'W5'];

export default function TrendsScreen() {
  const categories = getCategories();
  const [selectedCat, setSelectedCat] = useState('All');

  const filtered = selectedCat === 'All'
    ? items.slice(0, 12)
    : items.filter(i => i.category === selectedCat).slice(0, 12);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>📈 Price Trends</Text>
      </View>

      {/* Category filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.catScroll}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      >
        {categories.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[
              styles.catChip,
              selectedCat === cat && styles.catChipActive,
            ]}
            onPress={() => setSelectedCat(cat)}
          >
            <Text
              style={[
                styles.catChipText,
                selectedCat === cat && styles.catChipTextActive,
              ]}
            >
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 20 }}>
        {filtered.map(item => (
          <TrendCard key={item.id} item={item} />
        ))}
        {filtered.length === 0 && (
          <View style={styles.empty}>
            <Text style={{ fontSize: 40 }}>📊</Text>
            <Text style={styles.emptyText}>No trends for this category</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function TrendCard({ item }: { item: Item }) {
  const storeData = stores
    .map((s, si) => {
      const hist = item.history?.[s.id];
      if (!hist || hist.length === 0) return null;
      const maxH = Math.max(...hist);
      return { store: s, hist, maxH, color: STORE_COLORS[si] || '#9B5DE5' };
    })
    .filter(Boolean) as { store: typeof stores[0]; hist: number[]; maxH: number; color: string }[];

  if (storeData.length === 0) return null;
  const globalMax = Math.max(...storeData.map(d => d.maxH));

  return (
    <View style={[styles.card, SHADOWS.card]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>
          {item.name}
          {item.quantity ? (
            <Text style={styles.cardQty}> ({item.quantity})</Text>
          ) : null}
        </Text>
        <Text style={styles.cardCategory}>{item.category}</Text>
      </View>

      <View style={styles.chartRow}>
        {storeData.map(d => (
          <View key={d.store.id} style={styles.storeChart}>
            <Text style={[styles.storeName, { color: d.color }]}>
              {d.store.emoji} {d.store.name}
            </Text>
            <View style={styles.barsRow}>
              {d.hist.map((v, i) => {
                const height = Math.round((v / globalMax) * 50) + 5;
                const opacity = 0.5 + 0.5 * (i / Math.max(d.hist.length - 1, 1));
                return (
                  <View key={i} style={styles.barCol}>
                    <View
                      style={{
                        width: 10,
                        height,
                        backgroundColor: d.color,
                        borderRadius: 4,
                        opacity,
                      }}
                    />
                    <Text style={styles.barLabel}>{WEEK_LABELS[i]}</Text>
                  </View>
                );
              })}
            </View>
            <Text style={[styles.currentPrice, { color: d.color }]}>
              {fmt(d.hist[d.hist.length - 1])}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  catScroll: { maxHeight: 44, marginBottom: 8 },
  catChip: {
    backgroundColor: COLORS.chipBg,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  catChipActive: { backgroundColor: COLORS.primary },
  catChipText: { fontWeight: '700', fontSize: 13, color: COLORS.primary },
  catChipTextActive: { color: '#fff' },
  list: { flex: 1, paddingHorizontal: 16 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  cardQty: { fontSize: 12, fontWeight: '600', color: COLORS.muted },
  cardCategory: { fontSize: 12, fontWeight: '700', color: COLORS.muted },
  chartRow: { flexDirection: 'row', gap: 16 },
  storeChart: { flex: 1 },
  storeName: { fontSize: 10, fontWeight: '800', marginBottom: 4 },
  barsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 60 },
  barCol: { alignItems: 'center', flex: 1 },
  barLabel: { fontSize: 8, fontWeight: '700', color: COLORS.muted, marginTop: 2 },
  currentPrice: { fontSize: 13, fontWeight: '800', marginTop: 4 },
  empty: { alignItems: 'center', marginTop: 40 },
  emptyText: { fontSize: 16, fontWeight: '700', color: COLORS.muted, marginTop: 8 },
});
