import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SHADOWS, RADIUS, FONTS, SPACING } from '../../shared/theme';
import {
  items,
  stores,
  getCategories,
  fmt,
  Item,
} from '../../shared/store';

const STORE_COLORS: Record<string, string> = {
  tesco:      '#EE1C25',
  lidl:       '#0050AA',
  aldi:       '#FF6600',
  asian:      '#9B5DE5',
  supervalue: '#06D6A0',
};

const WEEK_LABELS = ['W1', 'W2', 'W3', 'W4', 'W5'];

export default function TrendsScreen() {
  const categories = getCategories();
  const [selectedCat, setSelectedCat] = useState('All');

  const filtered = selectedCat === 'All'
    ? items.slice(0, 12)
    : items.filter(i => i.category === selectedCat).slice(0, 12);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Price Trends</Text>
        <Text style={styles.headerSub}>Historical prices across stores</Text>
      </View>

      {/* Category filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.catScroll}
        contentContainerStyle={styles.catScrollContent}
      >
        {categories.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[styles.catChip, selectedCat === cat && styles.catChipActive]}
            onPress={() => setSelectedCat(cat)}
          >
            <Text style={[styles.catChipText, selectedCat === cat && styles.catChipTextActive]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyText}>No trends for this category</Text>
          </View>
        ) : (
          filtered.map(item => <TrendCard key={item.id} item={item} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function TrendCard({ item }: { item: Item }) {
  const { width } = useWindowDimensions();

  // Responsive bar width: 2.5% of screen, capped 7–16px
  const barW = Math.min(16, Math.max(7, Math.round(width * 0.025)));
  // Chart height scales slightly on wider screens
  const chartH = Math.min(72, Math.max(48, Math.round(width * 0.14)));

  const storeData = stores
    .map(s => {
      const hist = item.history?.[s.id];
      if (!hist || hist.length === 0) return null;
      const maxH = Math.max(...hist);
      return {
        store: s,
        hist,
        maxH,
        color: STORE_COLORS[s.id] ?? '#9B5DE5',
      };
    })
    .filter(Boolean) as {
      store: typeof stores[0];
      hist: number[];
      maxH: number;
      color: string;
    }[];

  if (storeData.length === 0) return null;

  const globalMax = Math.max(...storeData.map(d => d.maxH), 0.01);
  const latestPrices = storeData.map(d => d.hist[d.hist.length - 1]);
  const cheapestIdx = latestPrices.indexOf(Math.min(...latestPrices));

  return (
    <View style={[styles.card, SHADOWS.card]}>
      {/* Card header */}
      <View style={styles.cardHeader}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {item.name}
            {item.quantity ? (
              <Text style={styles.cardQty}> {item.quantity}</Text>
            ) : null}
          </Text>
          <Text style={styles.cardCategory}>{item.category}</Text>
        </View>
        {storeData.length > 1 && (
          <View style={styles.savingTag}>
            <Text style={styles.savingTagText}>
              Best: {storeData[cheapestIdx]?.store.emoji} {fmt(latestPrices[cheapestIdx])}
            </Text>
          </View>
        )}
      </View>

      {/* Store charts */}
      <View style={styles.chartGrid}>
        {storeData.map((d, di) => {
          const isCheapest = di === cheapestIdx;
          return (
            <View key={d.store.id} style={styles.storeChart}>
              {/* Store label */}
              <View style={styles.storeLabelRow}>
                <Text style={styles.storeEmoji}>{d.store.emoji}</Text>
                <Text style={[styles.storeName, { color: d.color }]} numberOfLines={1}>
                  {d.store.name}
                </Text>
                {isCheapest && storeData.length > 1 && (
                  <View style={[styles.bestPill, { backgroundColor: d.color + '22' }]}>
                    <Text style={[styles.bestPillText, { color: d.color }]}>Best</Text>
                  </View>
                )}
              </View>

              {/* Bar chart */}
              <View style={[styles.barsRow, { height: chartH }]}>
                {d.hist.map((v, i) => {
                  const barH = Math.max(4, Math.round((v / globalMax) * (chartH - 8)));
                  const isLatest = i === d.hist.length - 1;
                  return (
                    <View key={i} style={styles.barCol}>
                      <View
                        style={{
                          width: barW,
                          height: barH,
                          backgroundColor: d.color,
                          borderRadius: barW / 2,
                          opacity: isLatest ? 1 : 0.35 + 0.5 * (i / Math.max(d.hist.length - 1, 1)),
                        }}
                      />
                      <Text style={styles.barLabel}>{WEEK_LABELS[i]}</Text>
                    </View>
                  );
                })}
              </View>

              {/* Current price */}
              <Text style={[styles.currentPrice, { color: d.color }]}>
                {fmt(d.hist[d.hist.length - 1])}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },

  header: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  headerTitle: { fontSize: 22, fontWeight: FONTS.bold, color: COLORS.text },
  headerSub:   { fontSize: 13, fontWeight: FONTS.medium, color: COLORS.muted, marginTop: 2 },

  catScroll: { flexGrow: 0, maxHeight: 48 },
  catScrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: 6,
    gap: 8,
  },
  catChip: {
    backgroundColor: COLORS.chipBg,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  catChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primaryDark,
  },
  catChipText: { fontWeight: FONTS.semibold, fontSize: 13, color: COLORS.primary },
  catChipTextActive: { color: '#fff' },

  list: { flex: 1 },
  listContent: { paddingHorizontal: SPACING.page, paddingTop: SPACING.sm, paddingBottom: 24 },

  // ── Cards ──────────────────────────────────────────────────────
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  cardTitle: { fontSize: 16, fontWeight: FONTS.bold, color: COLORS.text, lineHeight: 22 },
  cardQty:   { fontSize: 12, fontWeight: FONTS.medium, color: COLORS.muted },
  cardCategory: {
    fontSize: 11, fontWeight: FONTS.semibold,
    color: COLORS.muted, marginTop: 3,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  savingTag: {
    backgroundColor: COLORS.savingBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    flexShrink: 0,
  },
  savingTagText: { fontSize: 11, fontWeight: FONTS.bold, color: COLORS.green },

  // ── Chart grid ─────────────────────────────────────────────────
  chartGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  storeChart: {
    flex: 1,
    minWidth: 100,
  },
  storeLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  storeEmoji: { fontSize: 12 },
  storeName: {
    fontSize: 11,
    fontWeight: FONTS.bold,
    flex: 1,
  },
  bestPill: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: RADIUS.xs,
  },
  bestPillText: { fontSize: 9, fontWeight: FONTS.bold },

  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    backgroundColor: COLORS.divider,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  barCol: { alignItems: 'center', flex: 1 },
  barLabel: {
    fontSize: 8,
    fontWeight: FONTS.semibold,
    color: COLORS.muted,
    marginTop: 2,
  },
  currentPrice: {
    fontSize: 14,
    fontWeight: FONTS.bold,
    marginTop: 6,
  },

  // ── Empty ──────────────────────────────────────────────────────
  empty: { alignItems: 'center', marginTop: 60, gap: 10 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 16, fontWeight: FONTS.semibold, color: COLORS.muted },
});
