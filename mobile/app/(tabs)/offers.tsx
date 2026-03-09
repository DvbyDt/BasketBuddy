import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, Alert,
} from 'react-native';
import { COLORS, SHADOWS } from '../../shared/theme';
import { items, getStoreById, fmt } from '../../shared/store';
import {
  loadOffers, getActiveOffers, calcDiscount,
  hasOffers, getOffersUpdatedAt, Offer,
} from '../../shared/offers';
import { useBasket } from '../../shared/BasketContext';

const STORE_ORDER = ['tesco', 'lidl', 'aldi', 'supervalue'];

export default function OffersScreen() {
  const [ready, setReady] = useState(false);
  const [selectedStore, setSelectedStore] = useState('all');
  const { addToBasket, isInBasket } = useBasket();

  useEffect(() => {
    loadOffers().then(() => setReady(true));
  }, []);

  const activeOffers = useMemo(() => (ready ? getActiveOffers() : []), [ready]);
  const updatedAt    = getOffersUpdatedAt();

  const filtered = selectedStore === 'all'
    ? activeOffers
    : activeOffers.filter(o => o.storeId === selectedStore);

  const byStore: Record<string, Offer[]> = {};
  filtered.forEach(o => {
    if (!byStore[o.storeId]) byStore[o.storeId] = [];
    byStore[o.storeId].push(o);
  });

  const handleAdd = (offer: Offer) => {
    if (!offer.itemId) return;
    const item = items.find(i => i.id === offer.itemId);
    if (!item) return;
    if (isInBasket(offer.itemId, offer.storeId)) {
      Alert.alert('Already in basket', `${offer.itemName} is already added.`);
      return;
    }
    addToBasket(item, offer.storeId, 1);
    Alert.alert('Added! 🛒', `${offer.itemName} added to basket with offer applied.`);
  };

  const handleAddAll = (storeId: string) => {
    const storeOffers = byStore[storeId] ?? [];
    let added = 0;
    storeOffers.forEach(offer => {
      if (!offer.itemId) return;
      const item = items.find(i => i.id === offer.itemId);
      if (!item || isInBasket(offer.itemId, offer.storeId)) return;
      addToBasket(item, offer.storeId, 1);
      added++;
    });
    Alert.alert(
      added > 0 ? 'Added to basket! 🛒' : 'Nothing new to add',
      added > 0 ? `${added} offer item${added > 1 ? 's' : ''} added.` : 'All offer items are already in your basket.'
    );
  };

  // ── Empty state ─────────────────────────────────────────────────
  if (ready && !hasOffers()) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.headerBar}>
          <Text style={styles.headerTitle}>🏷️ Weekly Offers</Text>
        </View>
        <View style={styles.emptyFull}>
          <Text style={styles.emptyIcon}>🔍</Text>
          <Text style={styles.emptyTitle}>No offers right now</Text>
          <Text style={styles.emptyBody}>
            We check Tesco, Lidl, Aldi and SuperValu every Monday for the latest deals.
            As soon as we find something we'll show it here!
          </Text>
          {updatedAt && (
            <Text style={styles.lastChecked}>
              Last checked: {formatDate(updatedAt)}
            </Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // ── Loading ─────────────────────────────────────────────────────
  if (!ready) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.emptyFull}>
          <Text style={styles.emptyBody}>Loading offers…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Offers found ────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.headerBar}>
        <View>
          <Text style={styles.headerTitle}>🏷️ Weekly Offers</Text>
          <Text style={styles.headerSub}>{activeOffers.length} deals this week</Text>
        </View>
      </View>

      {/* Store filter tabs */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      >
        <FilterTab label="All" count={activeOffers.length} active={selectedStore === 'all'} onPress={() => setSelectedStore('all')} />
        {STORE_ORDER.map(sid => {
          const store = getStoreById(sid);
          const count = activeOffers.filter(o => o.storeId === sid).length;
          if (!store || count === 0) return null;
          return (
            <FilterTab
              key={sid}
              label={`${store.emoji} ${store.name}`}
              count={count}
              active={selectedStore === sid}
              color={store.color}
              onPress={() => setSelectedStore(sid)}
            />
          );
        })}
      </ScrollView>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Savings banner */}
        <SavingsBanner offers={filtered} />

        {/* Offers by store */}
        {(selectedStore === 'all' ? STORE_ORDER : [selectedStore]).map(sid => {
          const storeOffers = byStore[sid];
          if (!storeOffers?.length) return null;
          const store = getStoreById(sid);
          if (!store) return null;
          return (
            <View key={sid} style={styles.storeSection}>
              <View style={styles.storeHeader}>
                <View style={[styles.storeDot, { backgroundColor: store.color }]} />
                <Text style={styles.storeName}>{store.emoji} {store.name}</Text>
                <Text style={styles.offerCount}>{storeOffers.length} offers</Text>
                <TouchableOpacity style={[styles.addAllBtn, { backgroundColor: store.color }]} onPress={() => handleAddAll(sid)}>
                  <Text style={styles.addAllText}>+ Add all</Text>
                </TouchableOpacity>
              </View>
              {storeOffers.map(offer => (
                <OfferCard
                  key={offer.id}
                  offer={offer}
                  storeColor={store.color}
                  inBasket={offer.itemId ? isInBasket(offer.itemId, offer.storeId) : false}
                  onAdd={() => handleAdd(offer)}
                />
              ))}
            </View>
          );
        })}

        {filtered.length === 0 && (
          <View style={styles.empty}>
            <Text style={{ fontSize: 40 }}>🏷️</Text>
            <Text style={styles.emptyText}>No offers for this store right now</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────────

function FilterTab({ label, count, active, color, onPress }: {
  label: string; count: number; active: boolean; color?: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.filterTab, active && { backgroundColor: color || COLORS.primary, borderColor: color || COLORS.primary }]}
      onPress={onPress}
    >
      <Text style={[styles.filterTabText, active && { color: '#fff' }]}>{label}</Text>
      <View style={[styles.filterBadge, active && { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
        <Text style={[styles.filterBadgeText, active && { color: '#fff' }]}>{count}</Text>
      </View>
    </TouchableOpacity>
  );
}

function SavingsBanner({ offers }: { offers: Offer[] }) {
  let total = 0;
  offers.forEach(o => {
    const item = items.find(i => i.id === o.itemId);
    if (!item) return;
    const base = item.prices[o.storeId];
    if (!base) return;
    total += calcDiscount(o, base, 1).saving;
  });
  if (total < 0.01) return null;
  return (
    <View style={styles.savingsBanner}>
      <Text style={{ fontSize: 28 }}>💰</Text>
      <View>
        <Text style={styles.savingsBannerTitle}>Save up to {fmt(total)} this week</Text>
        <Text style={styles.savingsBannerSub}>If you buy all {offers.length} offer items</Text>
      </View>
    </View>
  );
}

function OfferCard({ offer, storeColor, inBasket, onAdd }: {
  offer: Offer; storeColor: string; inBasket: boolean; onAdd: () => void;
}) {
  const item = items.find(i => i.id === offer.itemId);
  const base = item?.prices[offer.storeId];
  const discount = base != null ? calcDiscount(offer, base, 1) : null;

  const badgeColor: Record<string, string> = {
    percentage: '#9B5DE5', fixed: COLORS.green,
    bogo: '#FF6B35', multibuy: '#F72585', fixed_price: COLORS.green,
  };
  const bc = badgeColor[offer.discountType] ?? COLORS.green;

  return (
    <View style={[styles.offerCard, SHADOWS.card]}>
      <View style={[styles.offerAccent, { backgroundColor: storeColor }]} />
      <View style={styles.offerContent}>
        <View style={styles.offerTop}>
          <Text style={styles.offerName} numberOfLines={2}>{offer.itemName}</Text>
          <View style={[styles.badge, { backgroundColor: bc + '20', borderColor: bc }]}>
            <Text style={[styles.badgeText, { color: bc }]}>{badgeLabel(offer)}</Text>
          </View>
        </View>
        <Text style={styles.offerDesc}>{offer.description}</Text>
        {discount && base != null && (
          <View style={styles.priceRow}>
            {offer.originalPrice != null && (
              <Text style={styles.wasPrice}>€{offer.originalPrice.toFixed(2)}</Text>
            )}
            <Text style={styles.nowPrice}>{fmt(discount.discountedPrice)}</Text>
            {discount.saving > 0.001 && (
              <View style={styles.savingPill}>
                <Text style={styles.savingPillText}>Save {fmt(discount.saving)}</Text>
              </View>
            )}
          </View>
        )}
        <View style={styles.offerFooter}>
          <Text style={styles.validUntil}>Valid until {formatDate(offer.validUntil)}</Text>
          {!inBasket ? (
            <TouchableOpacity style={[styles.addBtn, { backgroundColor: storeColor }]} onPress={onAdd}>
              <Text style={styles.addBtnText}>+ Basket</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.addedTag}>
              <Text style={styles.addedTagText}>✓ In basket</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

function badgeLabel(offer: Offer): string {
  const map: Record<string, string> = {
    percentage: `${offer.value}% OFF`,
    fixed: `€${offer.value.toFixed(2)} OFF`,
    bogo: 'BOGO',
    multibuy: 'MULTIBUY',
    fixed_price: 'SPECIAL',
  };
  return map[offer.discountType] ?? 'OFFER';
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return iso; }
}

// ── Styles ────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  headerBar: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  headerSub: { fontSize: 13, fontWeight: '600', color: COLORS.muted, marginTop: 2 },

  // Empty full-screen state
  emptyFull: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginBottom: 12, textAlign: 'center' },
  emptyBody: {
    fontSize: 15, fontWeight: '600', color: COLORS.muted,
    textAlign: 'center', lineHeight: 24, marginBottom: 16,
  },
  lastChecked: { fontSize: 12, fontWeight: '600', color: COLORS.muted },

  filterScroll: { maxHeight: 52, marginVertical: 8 },
  filterTab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1.5,
    borderColor: COLORS.border, backgroundColor: COLORS.card,
  },
  filterTabText: { fontWeight: '700', fontSize: 13, color: COLORS.text },
  filterBadge: { backgroundColor: COLORS.chipBg, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 10 },
  filterBadgeText: { fontSize: 11, fontWeight: '800', color: COLORS.primary },

  content: { flex: 1, paddingHorizontal: 16 },
  savingsBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.savingBg, borderRadius: 14,
    padding: 14, marginBottom: 16, marginTop: 4,
    borderWidth: 1, borderColor: COLORS.green + '40',
  },
  savingsBannerTitle: { fontSize: 15, fontWeight: '800', color: '#1a7a5e' },
  savingsBannerSub: { fontSize: 12, fontWeight: '600', color: COLORS.muted, marginTop: 2 },

  storeSection: { marginBottom: 20 },
  storeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  storeDot: { width: 10, height: 10, borderRadius: 5 },
  storeName: { fontSize: 16, fontWeight: '800', color: COLORS.text, flex: 1 },
  offerCount: { fontSize: 12, fontWeight: '700', color: COLORS.muted },
  addAllBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  addAllText: { color: '#fff', fontWeight: '800', fontSize: 12 },

  offerCard: { backgroundColor: COLORS.card, borderRadius: 14, marginBottom: 8, flexDirection: 'row', overflow: 'hidden' },
  offerAccent: { width: 4 },
  offerContent: { flex: 1, padding: 12 },
  offerTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 },
  offerName: { fontSize: 14, fontWeight: '800', color: COLORS.text, flex: 1 },
  badge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, borderWidth: 1, flexShrink: 0 },
  badgeText: { fontSize: 10, fontWeight: '800' },
  offerDesc: { fontSize: 12, fontWeight: '600', color: COLORS.muted, marginBottom: 6 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  wasPrice: { fontSize: 13, fontWeight: '600', color: COLORS.muted, textDecorationLine: 'line-through' },
  nowPrice: { fontSize: 16, fontWeight: '800', color: COLORS.green },
  savingPill: { backgroundColor: COLORS.savingBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  savingPillText: { fontSize: 11, fontWeight: '800', color: COLORS.green },
  offerFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  validUntil: { fontSize: 11, fontWeight: '600', color: COLORS.muted },
  addBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  addedTag: { backgroundColor: COLORS.savingBg, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  addedTagText: { color: COLORS.green, fontWeight: '800', fontSize: 12 },

  empty: { alignItems: 'center', marginTop: 40, gap: 8 },
  emptyText: { fontSize: 15, fontWeight: '700', color: COLORS.muted },
});