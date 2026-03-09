import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
} from 'react-native';
import { COLORS, SHADOWS } from '../../shared/theme';
import { items, stores, getStoreById, fmt } from '../../shared/store';
import { StoreBadge } from '../../components/StoreBadge';
import { useBasket } from '../../shared/BasketContext';

export default function BasketScreen() {
  const { basket, removeFromBasket, clearBasket, updateQuantity } = useBasket();
  const [optimized, setOptimized] = useState(false);

  // Total spent at chosen stores
  const total = basket.reduce((s, b) => s + b.price * b.quantity, 0);

  // ── Optimizer: cheapest store for EVERY basket item ──────────────
  const optimizerPlan = React.useMemo(() => {
    if (basket.length === 0) return null;

    // For each basket item, find cheapest store across all stores
    const itemPlans = basket.map(b => {
      const item = items.find(i => i.id === b.itemId);
      if (!item) return null;

      const allPrices = stores
        .map(s => ({ store: s, price: item.prices[s.id] }))
        .filter(x => x.price != null)
        .sort((a, b) => a.price - b.price);

      const cheapest = allPrices[0];
      const currentPrice = b.price;
      const saving = (currentPrice - cheapest.price) * b.quantity;

      return {
        name: b.name,
        quantity: b.quantity,
        currentStore: getStoreById(b.store)?.name ?? b.store,
        currentPrice,
        bestStore: cheapest.store,
        bestPrice: cheapest.price,
        saving,
      };
    }).filter(Boolean) as {
      name: string;
      quantity: number;
      currentStore: string;
      currentPrice: number;
      bestStore: typeof stores[0];
      bestPrice: number;
      saving: number;
    }[];

    // Group by best store
    const byStore: Record<string, typeof itemPlans> = {};
    itemPlans.forEach(plan => {
      const sid = plan.bestStore.id;
      if (!byStore[sid]) byStore[sid] = [];
      byStore[sid].push(plan);
    });

    const totalSaving = itemPlans.reduce((s, p) => s + p.saving, 0);
    const optimizedTotal = itemPlans.reduce((s, p) => s + p.bestPrice * p.quantity, 0);

    return { itemPlans, byStore, totalSaving, optimizedTotal };
  }, [basket]);

  const handleOptimize = () => {
    if (basket.length === 0) {
      Alert.alert('Empty basket', 'Add items to basket first!');
      return;
    }
    setOptimized(true);
  };

  const handleClear = () => {
    Alert.alert('Clear Basket', 'Remove all items?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => { clearBasket(); setOptimized(false); } },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>🧺 My Basket</Text>
        {basket.length > 0 && (
          <TouchableOpacity onPress={handleClear}>
            <Text style={styles.clearBtn}>Clear all</Text>
          </TouchableOpacity>
        )}
      </View>

      {basket.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 56 }}>🧺</Text>
          <Text style={styles.emptyTitle}>Your basket is empty</Text>
          <Text style={styles.emptySubtitle}>
            Tap "+ Add" on any item in the Compare tab
          </Text>
        </View>
      ) : (
        <FlatList
          style={styles.list}
          contentContainerStyle={{ paddingBottom: 32 }}
          data={basket}
          keyExtractor={item => `${item.itemId}-${item.store}`}
          renderItem={({ item: b }) => {
            const store = getStoreById(b.store);
            return (
              <View style={[styles.basketItem, SHADOWS.card]}>
                <View style={styles.itemLeft}>
                  {store && <StoreBadge store={store} size="sm" />}
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName} numberOfLines={2}>{b.name}</Text>
                    <Text style={styles.itemUnit}>{fmt(b.price)} each</Text>
                  </View>
                </View>
                <View style={styles.itemRight}>
                  {/* Qty controls */}
                  <View style={styles.qtyRow}>
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => {
                        if (b.quantity <= 1) removeFromBasket(b.itemId, b.store);
                        else updateQuantity(b.itemId, b.store, b.quantity - 1);
                      }}
                    >
                      <Text style={styles.qtyBtnText}>{b.quantity <= 1 ? '✕' : '−'}</Text>
                    </TouchableOpacity>
                    <Text style={styles.qtyNum}>{b.quantity}</Text>
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => updateQuantity(b.itemId, b.store, b.quantity + 1)}
                    >
                      <Text style={styles.qtyBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.itemTotal}>{fmt(b.price * b.quantity)}</Text>
                </View>
              </View>
            );
          }}
          ListFooterComponent={
            <View style={{ marginTop: 4 }}>
              {/* Total row */}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>{fmt(total)}</Text>
              </View>

              {/* Optimize button */}
              <TouchableOpacity style={styles.optimizeBtn} onPress={handleOptimize}>
                <Text style={styles.optimizeBtnText}>✨ Optimize My Basket</Text>
              </TouchableOpacity>

              {/* Optimizer results */}
              {optimized && optimizerPlan && (
                <View style={styles.optimizerCard}>
                  <Text style={styles.optimizerTitle}>✨ Optimized Shopping Plan</Text>

                  {/* Per-store groups */}
                  {Object.entries(optimizerPlan.byStore).map(([storeId, plans]) => {
                    const store = getStoreById(storeId);
                    const storeTotal = plans.reduce((s, p) => s + p.bestPrice * p.quantity, 0);
                    return (
                      <View key={storeId} style={styles.storeGroup}>
                        <View style={styles.storeGroupHeader}>
                          <Text style={styles.storeGroupName}>
                            {store?.emoji} {store?.name}
                          </Text>
                          <Text style={styles.storeGroupTotal}>{fmt(storeTotal)}</Text>
                        </View>
                        {plans.map((p, i) => (
                          <View key={i} style={styles.optimizerItem}>
                            <Text style={styles.optimizerItemName} numberOfLines={1}>
                              {p.name} ×{p.quantity}
                            </Text>
                            <View style={styles.optimizerItemRight}>
                              <Text style={styles.optimizerItemPrice}>
                                {fmt(p.bestPrice * p.quantity)}
                              </Text>
                              {p.saving > 0.001 && (
                                <View style={styles.savingTag}>
                                  <Text style={styles.savingTagText}>-{fmt(p.saving)}</Text>
                                </View>
                              )}
                            </View>
                          </View>
                        ))}
                      </View>
                    );
                  })}

                  {/* Summary */}
                  <View style={styles.optimizerSummary}>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Original total</Text>
                      <Text style={styles.summaryOriginal}>{fmt(total)}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Optimized total</Text>
                      <Text style={styles.summaryOptimized}>{fmt(optimizerPlan.optimizedTotal)}</Text>
                    </View>
                    {optimizerPlan.totalSaving > 0.01 && (
                      <View style={[styles.summaryRow, styles.savingRow]}>
                        <Text style={styles.savingLabel}>💚 You save</Text>
                        <Text style={styles.savingAmount}>{fmt(optimizerPlan.totalSaving)}</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  clearBtn: { fontSize: 14, fontWeight: '700', color: COLORS.red },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text, marginTop: 12 },
  emptySubtitle: {
    fontSize: 14, fontWeight: '600', color: COLORS.muted,
    marginTop: 6, textAlign: 'center',
  },
  list: { flex: 1, paddingHorizontal: 16 },

  // Basket item
  basketItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
    marginRight: 8,
  },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  itemUnit: { fontSize: 12, fontWeight: '600', color: COLORS.muted, marginTop: 2 },
  itemRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  qtyBtn: {
    backgroundColor: COLORS.primary,
    width: 26,
    height: 26,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  qtyNum: { fontSize: 15, fontWeight: '800', color: COLORS.text, minWidth: 18, textAlign: 'center' },
  itemTotal: { fontSize: 15, fontWeight: '800', color: COLORS.primary },

  // Total
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 12,
    paddingHorizontal: 4,
  },
  totalLabel: { fontSize: 17, fontWeight: '700', color: COLORS.textLight },
  totalValue: { fontSize: 24, fontWeight: '800', color: COLORS.primary },

  // Optimize button
  optimizeBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  optimizeBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },

  // Optimizer card
  optimizerCard: {
    backgroundColor: '#1E1B4B',
    borderRadius: 18,
    padding: 18,
    gap: 12,
  },
  optimizerTitle: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 17,
    marginBottom: 4,
  },

  // Store group inside optimizer
  storeGroup: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  storeGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  storeGroupName: { color: '#E0D4F7', fontWeight: '800', fontSize: 14 },
  storeGroupTotal: { color: '#fff', fontWeight: '800', fontSize: 15 },

  // Per-item row inside store group
  optimizerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optimizerItemName: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  optimizerItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  optimizerItemPrice: { color: '#fff', fontWeight: '700', fontSize: 13 },
  savingTag: {
    backgroundColor: 'rgba(6,214,160,0.25)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  savingTagText: { color: '#06D6A0', fontWeight: '800', fontSize: 11 },

  // Summary at bottom of optimizer
  optimizerSummary: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
    paddingTop: 12,
    gap: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: { color: 'rgba(255,255,255,0.6)', fontWeight: '600', fontSize: 13 },
  summaryOriginal: { color: 'rgba(255,255,255,0.6)', fontWeight: '700', fontSize: 14, textDecorationLine: 'line-through' },
  summaryOptimized: { color: '#fff', fontWeight: '800', fontSize: 15 },
  savingRow: {
    backgroundColor: 'rgba(6,214,160,0.15)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 4,
  },
  savingLabel: { color: '#06D6A0', fontWeight: '800', fontSize: 14 },
  savingAmount: { color: '#06D6A0', fontWeight: '800', fontSize: 16 },
});