import { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SHADOWS, RADIUS, FONTS, SPACING } from '../../shared/theme';
import { items, getStoreById, fmt } from '../../shared/store';
import {
  loadOffers, getActiveOffers, calcDiscount,
  hasOffers, getOffersUpdatedAt, Offer,
} from '../../shared/offers';
import { useBasket } from '../../shared/BasketContext';
import ShimmerLoader from '../../components/ShimmerLoader';

const STORE_ORDER = ['tesco', 'lidl', 'aldi', 'supervalue'];

export default function OffersScreen() {
  const [loadState, setLoadState] = useState<'loading' | 'done'>('loading');
  const [refreshing, setRefreshing]       = useState(false);
  const [selectedStore, setSelectedStore] = useState('all');
  const { addToBasket, isInBasket }       = useBasket();

  const doLoad = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoadState('loading');

    await loadOffers(/* forceReload= */ isRefresh);

    if (isRefresh) setRefreshing(false);
    else setLoadState('done');
  };

  useEffect(() => { doLoad(); }, []);

  const activeOffers = useMemo(
    () => loadState === 'done' ? getActiveOffers() : [],
    [loadState]
  );
  const updatedAt = getOffersUpdatedAt();

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
    Alert.alert('Added! 🛒', `${offer.itemName} added to basket.`);
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
      added > 0
        ? `${added} offer item${added > 1 ? 's' : ''} added.`
        : 'All offer items are already in your basket.'
    );
  };

  // ── Shimmer loading state ────────────────────────────────────────
  if (loadState === 'loading') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.headerBar}>
          <Text style={styles.headerTitle}>🏷️ Weekly Offers</Text>
          <Text style={styles.headerSub}>Checking for deals…</Text>
        </View>
        <ScrollView showsVerticalScrollIndicator={false}>
          <ShimmerLoader type="offers-screen" />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Empty state — no offers found by scraper ─────────────────────
  if (!hasOffers()) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.headerBar}>
          <Text style={styles.headerTitle}>🏷️ Weekly Offers</Text>
        </View>
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => doLoad(true)}
              tintColor={COLORS.primary}
            />
          }
        >
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={styles.emptyTitle}>No offers right now</Text>
            <Text style={styles.emptyBody}>
              We scrape Tesco, Lidl, Aldi and SuperValu every Monday morning for real deals.
              Only verified offers appear here — we never show made-up discounts.
            </Text>

            {updatedAt && (
              <View style={styles.lastCheckedRow}>
                <Text style={styles.lastCheckedLabel}>Last checked</Text>
                <Text style={styles.lastCheckedValue}>{formatDate(updatedAt)}</Text>
              </View>
            )}

            <View style={styles.nextCheckRow}>
              <Text style={styles.nextCheckLabel}>Next check</Text>
              <Text style={styles.nextCheckValue}>Monday 7am</Text>
            </View>

            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={() => doLoad(true)}
            >
              <Text style={styles.refreshBtnText}>↻ Pull to refresh</Text>
            </TouchableOpacity>
          </View>

          {/* Explain what this tab does */}
          <View style={styles.explainCard}>
            <Text style={styles.explainTitle}>How Offers Work</Text>
            <ExplainRow icon="🤖" text="Our scraper runs every Monday using headless Chrome to read live store websites" />
            <ExplainRow icon="🔗" text="Offers are matched to items in our catalog so you can add them to your basket" />
            <ExplainRow icon="✅" text="Only real, verified offers are shown — if nothing is found, this screen stays empty" />
            <ExplainRow icon="📱" text="Pull down on this screen to force a refresh anytime" />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Offers found ─────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.headerBar}>
        <View>
          <Text style={styles.headerTitle}>🏷️ Weekly Offers</Text>
          <Text style={styles.headerSub}>
            {activeOffers.length} deals · {updatedAt ? `Updated ${formatDate(updatedAt)}` : ''}
          </Text>
        </View>
      </View>

      {/* Store filter chips */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 8 }}
      >
        <FilterChip
          label="All"
          count={activeOffers.length}
          active={selectedStore === 'all'}
          onPress={() => setSelectedStore('all')}
        />
        {STORE_ORDER.map(sid => {
          const store = getStoreById(sid);
          const count = activeOffers.filter(o => o.storeId === sid).length;
          if (!store || count === 0) return null;
          return (
            <FilterChip
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

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => doLoad(true)}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* Total savings banner */}
        <SavingsBanner offers={filtered} />

        {/* Offers grouped by store */}
        {(selectedStore === 'all' ? STORE_ORDER : [selectedStore]).map(sid => {
          const storeOffers = byStore[sid];
          if (!storeOffers?.length) return null;
          const store = getStoreById(sid);
          if (!store) return null;

          return (
            <View key={sid} style={styles.storeSection}>
              <View style={styles.storeSectionHeader}>
                <View style={[styles.storeDot, { backgroundColor: store.color }]} />
                <Text style={styles.storeSectionName}>{store.emoji} {store.name}</Text>
                <Text style={styles.storeSectionCount}>{storeOffers.length} offers</Text>
                <TouchableOpacity
                  style={[styles.addAllBtn, { backgroundColor: store.color }]}
                  onPress={() => handleAddAll(sid)}
                >
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
          <View style={styles.noStoreOffers}>
            <Text style={{ fontSize: 36, marginBottom: 8 }}>🏷️</Text>
            <Text style={styles.noStoreOffersText}>No offers for this store right now</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────────

function FilterChip({ label, count, active, color, onPress }: {
  label: string; count: number; active: boolean; color?: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.filterChip,
        active && { backgroundColor: color || COLORS.primary, borderColor: color || COLORS.primary },
      ]}
      onPress={onPress}
    >
      <Text style={[styles.filterChipText, active && { color: '#fff' }]}>{label}</Text>
      <View style={[styles.filterChipBadge, active && { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
        <Text style={[styles.filterChipBadgeText, active && { color: '#fff' }]}>{count}</Text>
      </View>
    </TouchableOpacity>
  );
}

function SavingsBanner({ offers }: { offers: Offer[] }) {
  let total = 0;
  offers.forEach(o => {
    if (!o.itemId) return;
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
  const item     = items.find(i => i.id === offer.itemId);
  const base     = item?.prices[offer.storeId];
  const discount = base != null ? calcDiscount(offer, base, 1) : null;

  const badgeColors: Record<string, string> = {
    percentage: '#9B5DE5', fixed: COLORS.green,
    bogo: '#FF6B35', multibuy: '#F72585', fixed_price: COLORS.green,
  };
  const bc = badgeColors[offer.discountType] ?? COLORS.green;

  return (
    <View style={[styles.offerCard, SHADOWS.card]}>
      <View style={[styles.offerAccent, { backgroundColor: storeColor }]} />
      <View style={styles.offerContent}>
        <View style={styles.offerTopRow}>
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
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: storeColor }]}
              onPress={onAdd}
            >
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

function ExplainRow({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.explainRow}>
      <Text style={styles.explainRowIcon}>{icon}</Text>
      <Text style={styles.explainRowText}>{text}</Text>
    </View>
  );
}

function badgeLabel(offer: Offer): string {
  const map: Record<string, string> = {
    percentage: `${offer.value}% OFF`,
    fixed:      `€${offer.value.toFixed(2)} OFF`,
    bogo:       'BOGO FREE',
    multibuy:   'MULTIBUY',
    fixed_price:'SPECIAL',
  };
  return map[offer.discountType] ?? 'OFFER';
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-IE', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return iso; }
}

// ── Styles ────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },

  headerBar: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg, paddingBottom: 4 },
  headerTitle: { fontSize: 22, fontWeight: FONTS.bold, color: COLORS.text },
  headerSub:   { fontSize: 13, fontWeight: FONTS.medium, color: COLORS.muted, marginTop: 2 },

  // Empty state
  emptyContainer: { padding: 16 },
  emptyCard: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.xl,
    padding: 24, alignItems: 'center', ...SHADOWS.card, marginBottom: 12,
  },
  emptyIcon:  { fontSize: 52, marginBottom: 12 },
  emptyTitle: { fontSize: 20, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 10, textAlign: 'center' },
  emptyBody:  { fontSize: 14, fontWeight: FONTS.medium, color: COLORS.muted, textAlign: 'center', lineHeight: 22, marginBottom: 16 },
  lastCheckedRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    width: '100%', paddingVertical: 8, borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  lastCheckedLabel: { fontSize: 13, fontWeight: FONTS.semibold, color: COLORS.muted },
  lastCheckedValue: { fontSize: 13, fontWeight: FONTS.bold, color: COLORS.text },
  nextCheckRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    width: '100%', paddingVertical: 8, borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  nextCheckLabel: { fontSize: 13, fontWeight: FONTS.semibold, color: COLORS.muted },
  nextCheckValue: { fontSize: 13, fontWeight: FONTS.bold, color: COLORS.primary },
  refreshBtn: {
    marginTop: 16, paddingVertical: 10, paddingHorizontal: 20,
    borderRadius: RADIUS.full, borderWidth: 1.5, borderColor: COLORS.border,
  },
  refreshBtnText: { fontSize: 13, fontWeight: FONTS.semibold, color: COLORS.muted },

  // Explain card
  explainCard: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.xl,
    padding: 20, ...SHADOWS.card,
  },
  explainTitle: { fontSize: 15, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 14 },
  explainRow: { flexDirection: 'row', gap: 12, marginBottom: 12, alignItems: 'flex-start' },
  explainRowIcon: { fontSize: 18, marginTop: 1 },
  explainRowText: { fontSize: 13, fontWeight: FONTS.medium, color: COLORS.muted, flex: 1, lineHeight: 20 },

  // Filter chips
  filterScroll: { maxHeight: 52 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: RADIUS.full, borderWidth: 1.5,
    borderColor: COLORS.border, backgroundColor: COLORS.card,
  },
  filterChipText: { fontWeight: FONTS.semibold, fontSize: 13, color: COLORS.text },
  filterChipBadge: { backgroundColor: COLORS.chipBg, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 10 },
  filterChipBadgeText: { fontSize: 11, fontWeight: FONTS.bold, color: COLORS.primary },

  content: { flex: 1, paddingHorizontal: 16 },

  // Savings banner
  savingsBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.savingBg, borderRadius: RADIUS.lg,
    padding: 14, marginBottom: 16, marginTop: 4,
    borderWidth: 1, borderColor: COLORS.green + '40',
  },
  savingsBannerTitle: { fontSize: 15, fontWeight: FONTS.bold, color: '#1a7a5e' },
  savingsBannerSub:   { fontSize: 12, fontWeight: FONTS.medium, color: COLORS.muted, marginTop: 2 },

  // Store sections
  storeSection:       { marginBottom: 20 },
  storeSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  storeDot:           { width: 10, height: 10, borderRadius: 5 },
  storeSectionName:   { fontSize: 16, fontWeight: FONTS.bold, color: COLORS.text, flex: 1 },
  storeSectionCount:  { fontSize: 12, fontWeight: FONTS.semibold, color: COLORS.muted },
  addAllBtn:          { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.sm },
  addAllText:         { color: '#fff', fontWeight: FONTS.bold, fontSize: 12 },

  // Offer card
  offerCard: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    marginBottom: 8, flexDirection: 'row', overflow: 'hidden',
  },
  offerAccent:  { width: 4 },
  offerContent: { flex: 1, padding: 12 },
  offerTopRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', gap: 8, marginBottom: 4,
  },
  offerName: { fontSize: 14, fontWeight: FONTS.bold, color: COLORS.text, flex: 1 },
  badge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, borderWidth: 1, flexShrink: 0 },
  badgeText: { fontSize: 10, fontWeight: FONTS.bold },
  offerDesc: { fontSize: 12, fontWeight: FONTS.medium, color: COLORS.muted, marginBottom: 6 },
  priceRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  wasPrice:  { fontSize: 13, fontWeight: FONTS.medium, color: COLORS.muted, textDecorationLine: 'line-through' },
  nowPrice:  { fontSize: 16, fontWeight: FONTS.bold, color: COLORS.green },
  savingPill: { backgroundColor: COLORS.savingBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  savingPillText: { fontSize: 11, fontWeight: FONTS.bold, color: COLORS.green },
  offerFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  validUntil:  { fontSize: 11, fontWeight: FONTS.medium, color: COLORS.muted },
  addBtn:      { paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.sm },
  addBtnText:  { color: '#fff', fontWeight: FONTS.bold, fontSize: 13 },
  addedTag:    { backgroundColor: COLORS.savingBg, paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.sm },
  addedTagText:{ color: COLORS.green, fontWeight: FONTS.bold, fontSize: 12 },

  noStoreOffers: { alignItems: 'center', marginTop: 40, gap: 8 },
  noStoreOffersText: { fontSize: 15, fontWeight: FONTS.semibold, color: COLORS.muted },
});