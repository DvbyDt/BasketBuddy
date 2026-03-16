/**
 * ShimmerLoader.tsx — Animated skeleton loading placeholders.
 *
 * Usage:
 *   <ShimmerLoader type="offer-card" count={4} />
 *   <ShimmerLoader type="price-row" count={3} />
 *   <ShimmerLoader type="product-card" count={5} />
 */

import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, RADIUS } from '../shared/theme';

// ── Core shimmer animation ────────────────────────────────────────

function ShimmerBox({ style }: { style?: ViewStyle | ViewStyle[] }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] });

  return (
    <Animated.View style={[styles.shimmerBox, style, { opacity }]} />
  );
}

// ── Offer card shimmer ────────────────────────────────────────────

function OfferCardShimmer() {
  return (
    <View style={styles.offerCard}>
      <View style={styles.offerAccent} />
      <View style={styles.offerContent}>
        <View style={styles.offerTopRow}>
          <ShimmerBox style={styles.offerTitle} />
          <ShimmerBox style={styles.offerBadge} />
        </View>
        <ShimmerBox style={styles.offerDesc} />
        <View style={styles.offerBottomRow}>
          <ShimmerBox style={styles.offerPrice} />
          <ShimmerBox style={styles.offerBtn} />
        </View>
      </View>
    </View>
  );
}

// ── Price row shimmer ─────────────────────────────────────────────

function PriceRowShimmer() {
  return (
    <View style={styles.priceRow}>
      <ShimmerBox style={styles.priceStoreBadge} />
      <ShimmerBox style={styles.priceAmount} />
      <ShimmerBox style={styles.priceAddBtn} />
    </View>
  );
}

// ── Product card shimmer ──────────────────────────────────────────

function ProductCardShimmer() {
  return (
    <View style={styles.productCard}>
      <View style={styles.productHeader}>
        <ShimmerBox style={styles.productTitle} />
        <ShimmerBox style={styles.productCategory} />
      </View>
      <PriceRowShimmer />
      <PriceRowShimmer />
    </View>
  );
}

// ── Store section header shimmer ──────────────────────────────────

function StoreSectionShimmer() {
  return (
    <View style={styles.storeSection}>
      <View style={styles.storeSectionHeader}>
        <ShimmerBox style={styles.storeDot} />
        <ShimmerBox style={styles.storeName} />
        <ShimmerBox style={styles.storeCount} />
      </View>
      <OfferCardShimmer />
      <OfferCardShimmer />
    </View>
  );
}

// ── Main export ───────────────────────────────────────────────────

type ShimmerType = 'offer-card' | 'price-row' | 'product-card' | 'offers-screen';

interface Props {
  type: ShimmerType;
  count?: number;
}

export default function ShimmerLoader({ type, count = 3 }: Props) {
  if (type === 'offers-screen') {
    // Full offers screen skeleton — store sections with cards inside
    return (
      <View style={styles.container}>
        {/* Filter tabs skeleton */}
        <View style={styles.filterRow}>
          {[80, 70, 65, 75].map((w, i) => (
            <ShimmerBox key={i} style={[styles.filterTab, { width: w }]} />
          ))}
        </View>

        {/* Savings banner skeleton */}
        <ShimmerBox style={styles.savingsBanner} />

        {/* Store sections */}
        <StoreSectionShimmer />
        <StoreSectionShimmer />
      </View>
    );
  }

  if (type === 'offer-card') {
    return (
      <View>
        {Array.from({ length: count }).map((_, i) => (
          <OfferCardShimmer key={i} />
        ))}
      </View>
    );
  }

  if (type === 'price-row') {
    return (
      <View>
        {Array.from({ length: count }).map((_, i) => (
          <PriceRowShimmer key={i} />
        ))}
      </View>
    );
  }

  if (type === 'product-card') {
    return (
      <View>
        {Array.from({ length: count }).map((_, i) => (
          <ProductCardShimmer key={i} />
        ))}
      </View>
    );
  }

  return null;
}

// ── Styles ────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingTop: 8 },

  shimmerBox: {
    backgroundColor: COLORS.border,
    borderRadius: RADIUS.sm,
  },

  // Offer card
  offerCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    marginBottom: 8,
    flexDirection: 'row',
    overflow: 'hidden',
    minHeight: 90,
  },
  offerAccent: { width: 4, backgroundColor: COLORS.border },
  offerContent: { flex: 1, padding: 12, gap: 8 },
  offerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  offerTitle: { height: 14, width: '55%', borderRadius: 7 },
  offerBadge: { height: 20, width: 64, borderRadius: 10 },
  offerDesc:  { height: 12, width: '70%', borderRadius: 6 },
  offerBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  offerPrice: { height: 18, width: 60, borderRadius: 9 },
  offerBtn:   { height: 28, width: 72, borderRadius: 10 },

  // Price row
  priceRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, padding: 8,
    backgroundColor: '#F8FAF8', borderRadius: 10, marginBottom: 6,
  },
  priceStoreBadge: { height: 24, width: 80, borderRadius: 12 },
  priceAmount:     { height: 18, width: 50, borderRadius: 9, flex: 1 },
  priceAddBtn:     { height: 30, width: 64, borderRadius: 10 },

  // Product card
  productCard: {
    backgroundColor: COLORS.card, borderRadius: 16,
    padding: 14, marginBottom: 10,
  },
  productHeader: { marginBottom: 10, gap: 6 },
  productTitle:    { height: 16, width: '65%', borderRadius: 8 },
  productCategory: { height: 12, width: '30%', borderRadius: 6 },

  // Store section
  storeSection: { marginBottom: 20 },
  storeSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  storeDot:  { width: 10, height: 10, borderRadius: 5 },
  storeName: { height: 16, width: 80, borderRadius: 8, flex: 1 },
  storeCount: { height: 14, width: 50, borderRadius: 7 },

  // Filter tabs
  filterRow: { flexDirection: 'row', gap: 8, paddingVertical: 10 },
  filterTab: { height: 34, borderRadius: 17 },

  // Savings banner
  savingsBanner: { height: 64, borderRadius: 14, marginBottom: 16 },
});