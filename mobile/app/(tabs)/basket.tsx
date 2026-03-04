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
import {
  items,
  stores,
  getStoreById,
  fmt,
} from '../../shared/store';
import { StoreBadge } from '../../components/StoreBadge';
import { useBasket } from '../../shared/BasketContext';

export default function BasketScreen() {
  const { basket, removeFromBasket, clearBasket } = useBasket();

  const total = basket.reduce((s, b) => s + b.price, 0);

  // AI Optimizer: group by cheapest store
  const [optimized, setOptimized] = useState(false);
  const optimize = () => {
    if (basket.length === 0) {
      Alert.alert('Empty basket', 'Add items to basket first!');
      return;
    }
    setOptimized(true);
  };

  // Group basket by store
  const storeGroups: Record<string, typeof basket> = {};
  basket.forEach(b => {
    if (!storeGroups[b.store]) storeGroups[b.store] = [];
    storeGroups[b.store].push(b);
  });

  // Total at most expensive
  const totalExpensive = basket.reduce((s, b) => {
    const item = items.find(i => i.id === b.itemId);
    if (!item) return s + b.price;
    const storePrices = stores.map(st => item.prices[st.id]).filter(p => p != null);
    return s + (storePrices.length ? Math.max(...storePrices) : b.price);
  }, 0);
  const saving = totalExpensive - total;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>🧺 My Basket</Text>
        {basket.length > 0 && (
          <Text style={styles.headerCount}>{basket.length} items</Text>
        )}
      </View>

      {basket.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 56 }}>🧺</Text>
          <Text style={styles.emptyTitle}>Your basket is empty</Text>
          <Text style={styles.emptySubtitle}>
            Search and tap "+ Basket" on the Compare tab
          </Text>
        </View>
      ) : (
        <FlatList
          style={styles.list}
          contentContainerStyle={{ paddingBottom: 20 }}
          data={basket}
          keyExtractor={item => String(item.itemId)}
          renderItem={({ item: b }) => {
            const store = getStoreById(b.store);
            return (
              <View style={[styles.basketItem, SHADOWS.card]}>
                {store && <StoreBadge store={store} size="sm" />}
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>
                    {b.name}
                    {b.quantity ? (
                      <Text style={styles.itemQty}> ({b.quantity})</Text>
                    ) : null}
                  </Text>
                  <Text style={styles.itemStore}>
                    Best at {store?.name}
                  </Text>
                </View>
                <Text style={styles.itemPrice}>{fmt(b.price)}</Text>
                <TouchableOpacity onPress={() => removeFromBasket(b.itemId)}>
                  <Text style={styles.removeBtn}>✕</Text>
                </TouchableOpacity>
              </View>
            );
          }}
          ListFooterComponent={
            <View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total:</Text>
                <Text style={styles.totalValue}>{fmt(total)}</Text>
              </View>

              <TouchableOpacity style={styles.optimizeBtn} onPress={optimize}>
                <Text style={styles.optimizeBtnText}>✨ AI Optimize My Basket</Text>
              </TouchableOpacity>

              {optimized && (
                <View style={[styles.optimizerCard, SHADOWS.card]}>
                  <Text style={styles.optimizerTitle}>✨ AI Basket Plan</Text>
                  {Object.entries(storeGroups).map(([sid, its]) => {
                    const s = getStoreById(sid);
                    const subtotal = its.reduce((t, i) => t + i.price, 0);
                    return (
                      <View key={sid} style={styles.storeRoute}>
                        <Text style={styles.routeName}>
                          {s?.emoji} {s?.name}
                        </Text>
                        <Text style={styles.routeItems}>
                          {its.map(i => i.name).join(' · ')}
                        </Text>
                        <Text style={styles.routePrice}>{fmt(subtotal)}</Text>
                      </View>
                    );
                  })}
                  <View style={styles.savingsPill}>
                    <Text style={styles.savingsText}>
                      💚 You save {fmt(saving)} by shopping smart!
                    </Text>
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
  headerCount: { fontSize: 14, fontWeight: '700', color: COLORS.muted },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text, marginTop: 12 },
  emptySubtitle: { fontSize: 14, fontWeight: '600', color: COLORS.muted, marginTop: 4, textAlign: 'center', paddingHorizontal: 40 },
  list: { flex: 1, paddingHorizontal: 16 },
  basketItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    gap: 10,
  },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  itemQty: { fontSize: 12, fontWeight: '600', color: COLORS.muted },
  itemStore: { fontSize: 12, fontWeight: '600', color: COLORS.muted, marginTop: 2 },
  itemPrice: { fontSize: 16, fontWeight: '800', color: COLORS.primary },
  removeBtn: { fontSize: 16, color: '#ccc', padding: 4 },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
    gap: 8,
  },
  totalLabel: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  totalValue: { fontSize: 22, fontWeight: '800', color: COLORS.primary },
  optimizeBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  optimizeBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  optimizerCard: {
    backgroundColor: '#6C4AB6',
    borderRadius: 18,
    padding: 20,
  },
  optimizerTitle: { color: '#fff', fontWeight: '800', fontSize: 18, marginBottom: 12 },
  storeRoute: { marginBottom: 12 },
  routeName: { color: '#E0D4F7', fontWeight: '800', fontSize: 14 },
  routeItems: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600', marginTop: 2 },
  routePrice: { color: '#fff', fontWeight: '800', fontSize: 16, marginTop: 4 },
  savingsPill: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  savingsText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
