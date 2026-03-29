/**
 * BarcodeScanner.tsx — BasketBuddy MVP Feature
 *
 * HOW IT WORKS:
 * 1. expo-camera scans EAN-13 barcodes from camera (free, SDK 51+)
 * 2. We query Open Food Facts API (free, 3M+ products, no auth needed)
 *    → Returns: product name, brand, weight/quantity, categories
 * 3. We fuzzy-match the product name against your 91 data.json items
 * 4. Show matching item with all store prices → user taps + Add to basket
 *
 * COST: €0.00
 * SETUP: npx expo install expo-camera
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, Animated,
  Vibration, Modal,
  ScrollView
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { COLORS, SHADOWS, RADIUS, FONTS, SPACING } from '../shared/theme';
import { items, stores, getItemPrices, fmt, getCheapestStore } from '../shared/store';
import { StoreBadge } from '../components/StoreBadge';
import { useBasket } from '../shared/BasketContext';
import type { Item } from '../shared/types';

// ── Open Food Facts API ────────────────────────────────────────────
// Free public API, no auth, no rate limits for reasonable usage.
// Documentation: https://openfoodfacts.github.io/openfoodfacts-server/api/

interface OFFProduct {
  product_name?: string;
  product_name_en?: string;
  brands?: string;
  quantity?: string;          // e.g. "500 g", "1 l"
  categories?: string;
  categories_tags?: string[];
  nutriments?: Record<string, number>;
}

interface OFFResponse {
  status: number;             // 1 = found, 0 = not found
  product?: OFFProduct;
}

async function lookupBarcode(barcode: string): Promise<OFFProduct | null> {
  try {
    const url = `https://world.openfoodfacts.org/api/v2/product/${barcode}?fields=product_name,product_name_en,brands,quantity,categories,categories_tags`;
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'BasketBuddy/1.0 (Dublin grocery price comparison)' },
    });
    const data: OFFResponse = await resp.json();
    if (data.status === 1 && data.product) {
      return data.product;
    }
    return null;
  } catch {
    return null;
  }
}

// ── Fuzzy matching ─────────────────────────────────────────────────
// Match an Open Food Facts product name → your data.json items.
// Uses word overlap + brand matching.

function matchToLocalItems(product: OFFProduct): { item: Item; score: number }[] {
  const name   = (product.product_name_en || product.product_name || '').toLowerCase();
  const brand  = (product.brands || '').toLowerCase();
  const qty    = (product.quantity || '').toLowerCase().replace(/\s/g, '');

  // Build search tokens from the product
  const searchWords = new Set([
    ...name.split(/\W+/).filter(w => w.length > 2),
    ...brand.split(/\W+/).filter(w => w.length > 2),
  ]);

  const scores = items.map(item => {
    const itemWords = new Set(
      (item.name + ' ' + (item.quantity || '')).toLowerCase().split(/\W+/).filter(w => w.length > 2)
    );
    const overlap = [...searchWords].filter(w => itemWords.has(w)).length;
    const total   = Math.max(searchWords.size, itemWords.size);
    return { item, score: total > 0 ? overlap / total : 0 };
  });

  return scores
    .filter(s => s.score > 0.2)          // at least 20% word overlap
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);                          // top 3 matches
}

// ── Main Component ─────────────────────────────────────────────────

interface Props {
  onClose: () => void;
}

export default function BarcodeScanner({ onClose }: Props) {
  // permission handled by useCameraPermissions hook
  const [scanned, setScanned]             = useState(false);
  const [loading, setLoading]             = useState(false);
  const [result, setResult]               = useState<{
    barcode: string;
    product: OFFProduct | null;
    matches: { item: Item; score: number }[];
    notFound: boolean;
  } | null>(null);

  const pulseAnim  = useRef(new Animated.Value(1)).current;
  const successAnim = useRef(new Animated.Value(0)).current;
  const { addToBasket, isInBasket } = useBasket();

  // Request camera permission using expo-camera hook
  const [permission, requestPermission] = useCameraPermissions();

  // Pulse animation for scan frame
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.6, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    if (scanned || loading) return;
    setScanned(true);
    setLoading(true);
    Vibration.vibrate(50); // subtle haptic feedback

    try {
      const product = await lookupBarcode(data);
      const matches = product ? matchToLocalItems(product) : [];

      setResult({
        barcode: data,
        product,
        matches,
        notFound: !product,
      });
    } catch {
      setResult({ barcode: data, product: null, matches: [], notFound: true });
    } finally {
      setLoading(false);
    }
  };

  const handleAddToBasket = (item: Item, storeId: string) => {
    addToBasket(item, storeId, 1);
    // Animate success
    Animated.sequence([
      Animated.timing(successAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(600),
      Animated.timing(successAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  const resetScanner = () => {
    setScanned(false);
    setResult(null);
    setLoading(false);
  };

  // ── Permission states ────────────────────────────────────────────

  if (!permission) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.permissionView}>
          <ActivityIndicator color={COLORS.primary} size="large" />
          <Text style={styles.permissionText}>Requesting camera permission…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.permissionView}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>📷</Text>
          <Text style={styles.permissionTitle}>Camera Access Needed</Text>
          <Text style={styles.permissionText}>
            Allow camera access in Settings to use barcode scanning.
          </Text>
          <TouchableOpacity style={[styles.btn, { marginTop: 16 }]} onPress={requestPermission}>
            <Text style={styles.btnText}>Grant Camera Access</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, { marginTop: 10, backgroundColor: 'transparent', borderWidth: 2, borderColor: COLORS.border }]} onPress={onClose}>
            <Text style={[styles.btnText, { color: COLORS.text }]}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Scanner view ────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Camera */}
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'],
        }}
        onBarcodeScanned={scanned ? undefined : (result: BarcodeScanningResult) => {
          handleBarCodeScanned({ type: result.type, data: result.data });
        }}
      />

      {/* Dark overlay with scan hole */}
      <View style={styles.overlay}>
        {/* Top dark area */}
        <View style={styles.overlayTop} />

        {/* Middle row: dark | scan frame | dark */}
        <View style={styles.overlayMiddle}>
          <View style={styles.overlaySide} />

          {/* The scan frame */}
          <Animated.View style={[styles.scanFrame, { opacity: pulseAnim }]}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </Animated.View>

          <View style={styles.overlaySide} />
        </View>

        {/* Bottom dark area */}
        <View style={styles.overlayBottom}>
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.statusText}>Looking up product…</Text>
            </View>
          ) : (
            <Text style={styles.scanHint}>
              {scanned ? '✓ Scanned!' : 'Point at a barcode'}
            </Text>
          )}
        </View>
      </View>

      {/* Close button */}
      <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
        <Text style={styles.closeBtnText}>✕</Text>
      </TouchableOpacity>

      {/* Success flash */}
      <Animated.View style={[styles.successFlash, { opacity: successAnim }]} pointerEvents="none" />

      {/* Results bottom sheet */}
      <Modal
        visible={!!result && !loading}
        transparent
        animationType="slide"
        onRequestClose={resetScanner}
      >
        <View style={styles.sheetOverlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={resetScanner} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />

            {/* Null checks to prevent error */}
            {result?.notFound || !result?.product ? (
              <NotFoundView barcode={result?.barcode ?? ''} onRetry={resetScanner} onClose={onClose} />
            ) : result?.matches?.length === 0 ? (
              result?.product ? (
                <NoMatchView
                  product={result.product}
                  onRetry={resetScanner}
                  onClose={onClose}
                />
              ) : null
            ) : (
              result?.product && result?.matches ? (
                <MatchView
                  product={result.product}
                  matches={result.matches}
                  isInBasket={isInBasket}
                  onAdd={handleAddToBasket}
                  onScanAgain={resetScanner}
                  onClose={onClose}
                />
              ) : null
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Sub-views ──────────────────────────────────────────────────────

function MatchView({ product, matches, isInBasket, onAdd, onScanAgain, onClose }: {
  product: OFFProduct;
  matches: { item: Item; score: number }[];
  isInBasket: (itemId: number, storeId: string) => boolean;
  onAdd: (item: Item, storeId: string) => void;
  onScanAgain: () => void;
  onClose: () => void;
}) {
  const productName = product.product_name_en || product.product_name || 'Unknown Product';
  const brand       = product.brands?.split(',')[0].trim() || '';

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* Product info */}
      <View style={styles.productHeader}>
        <View style={styles.barcodeIcon}>
          <Text style={{ fontSize: 28 }}>📦</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.productName} numberOfLines={2}>{productName}</Text>
          {brand ? <Text style={styles.productBrand}>{brand}</Text> : null}
          {product.quantity ? <Text style={styles.productQty}>{product.quantity}</Text> : null}
        </View>
      </View>

      {/* Match label */}
      <Text style={styles.matchLabel}>
        {matches.length === 1
          ? '✅ Found in BasketBuddy'
          : `✅ ${matches.length} possible matches`}
      </Text>

      {/* Price comparison for each match */}
      {matches.map(({ item, score }) => {
        const prices   = getItemPrices(item);
        const cheapest = getCheapestStore(item);
        if (!cheapest || prices.length === 0) return null;

        return (
          <View key={item.id} style={styles.matchCard}>
            {matches.length > 1 && (
              <View style={styles.matchConfidence}>
                <Text style={styles.matchConfidenceText}>
                  {item.name} · {Math.round(score * 100)}% match
                </Text>
              </View>
            )}
            {matches.length === 1 && (
              <Text style={styles.matchItemName}>{item.name}{item.quantity ? ` (${item.quantity})` : ''}</Text>
            )}

            <View style={styles.priceList}>
              {prices.map((p, i) => {
                const isBest   = i === 0;
                const inBasket = isInBasket(item.id, p.store.id);
                return (
                  <View key={p.store.id} style={[styles.priceRow, isBest && styles.priceRowBest]}>
                    <StoreBadge store={p.store} size="sm" />
                    <Text style={[styles.priceAmount, isBest && styles.priceAmountBest]}>
                      {fmt(p.price)}
                    </Text>
                    {isBest && prices.length > 1 && (
                      <View style={styles.bestTag}>
                        <Text style={styles.bestTagText}>Best</Text>
                      </View>
                    )}
                    <TouchableOpacity
                      style={[styles.addBtn, inBasket && styles.addBtnActive]}
                      onPress={() => !inBasket && onAdd(item, p.store.id)}
                    >
                      <Text style={styles.addBtnText}>
                        {inBasket ? '✓ Added' : '+ Add'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}

      {/* Actions */}
      <View style={styles.sheetActions}>
        <TouchableOpacity style={styles.btnSecondary} onPress={onScanAgain}>
          <Text style={styles.btnSecondaryText}>📷 Scan another</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnPrimary} onPress={onClose}>
          <Text style={styles.btnPrimaryText}>Done</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function NoMatchView({ product, onRetry, onClose }: {
  product: OFFProduct;
  onRetry: () => void;
  onClose: () => void;
}) {
  const name = product.product_name_en || product.product_name || 'this product';
  return (
    <View style={styles.noMatchView}>
      <Text style={{ fontSize: 48, marginBottom: 12 }}>🤔</Text>
      <Text style={styles.noMatchTitle}>Not in BasketBuddy yet</Text>
      <Text style={styles.noMatchText}>
        We found "{name}" on Open Food Facts but it's not in our 91-item catalog yet.
      </Text>
      <Text style={styles.noMatchHint}>
        Add it manually in Settings → Add Custom Item, or search by name in the Compare tab.
      </Text>
      <TouchableOpacity style={[styles.btnPrimary, { marginTop: 20 }]} onPress={onRetry}>
        <Text style={styles.btnPrimaryText}>📷 Scan another item</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.btnSecondary, { marginTop: 8 }]} onPress={onClose}>
        <Text style={styles.btnSecondaryText}>Close</Text>
      </TouchableOpacity>
    </View>
  );
}

function NotFoundView({ barcode, onRetry, onClose }: {
  barcode: string;
  onRetry: () => void;
  onClose: () => void;
}) {
  return (
    <View style={styles.noMatchView}>
      <Text style={{ fontSize: 48, marginBottom: 12 }}>❓</Text>
      <Text style={styles.noMatchTitle}>Barcode not recognised</Text>
      <Text style={styles.noMatchText}>
        Barcode {barcode} wasn't found in the Open Food Facts database (3M+ products).
      </Text>
      <Text style={styles.noMatchHint}>
        Try searching by name in the Compare tab instead.
      </Text>
      <TouchableOpacity style={[styles.btnPrimary, { marginTop: 20 }]} onPress={onRetry}>
        <Text style={styles.btnPrimaryText}>📷 Try again</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.btnSecondary, { marginTop: 8 }]} onPress={onClose}>
        <Text style={styles.btnSecondaryText}>Close</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────

const FRAME_SIZE = 260;

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: '#000' },
  container: { flex: 1, backgroundColor: '#000' },

  // Permission
  permissionView: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, backgroundColor: COLORS.background },
  permissionTitle: { fontSize: 20, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 8 },
  permissionText: { fontSize: 14, fontWeight: FONTS.medium, color: COLORS.muted, textAlign: 'center', lineHeight: 22 },

  // Camera overlay
  overlay: { ...StyleSheet.absoluteFillObject, flexDirection: 'column' },
  overlayTop:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  overlayMiddle: { flexDirection: 'row', height: FRAME_SIZE },
  overlaySide:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  overlayBottom: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'flex-start', paddingTop: 20 },

  // Scan frame
  scanFrame: { width: FRAME_SIZE, height: FRAME_SIZE, position: 'relative' },
  corner: { position: 'absolute', width: 24, height: 24, borderColor: COLORS.primary, borderWidth: 3 },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },

  // Status
  loadingRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusText:  { color: '#fff', fontWeight: FONTS.semibold, fontSize: 14 },
  scanHint:    { color: 'rgba(255,255,255,0.8)', fontWeight: FONTS.semibold, fontSize: 14 },

  // Close button
  closeBtn: {
    position: 'absolute', top: 56, right: 20,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { color: '#fff', fontSize: 18, fontWeight: FONTS.bold },

  // Success flash
  successFlash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(82, 183, 136, 0.3)',
  },

  // Bottom sheet
  sheetOverlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40,
    maxHeight: '80%',
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: 16 },

  // Product header
  productHeader: { flexDirection: 'row', gap: 12, marginBottom: 16, alignItems: 'flex-start' },
  barcodeIcon: {
    width: 52, height: 52, borderRadius: RADIUS.md,
    backgroundColor: COLORS.divider, alignItems: 'center', justifyContent: 'center',
  },
  productName:  { fontSize: 16, fontWeight: FONTS.bold, color: COLORS.text },
  productBrand: { fontSize: 13, fontWeight: FONTS.medium, color: COLORS.muted, marginTop: 2 },
  productQty:   { fontSize: 12, fontWeight: FONTS.medium, color: COLORS.muted, marginTop: 2 },

  // Match display
  matchLabel: { fontSize: 13, fontWeight: FONTS.bold, color: COLORS.green, marginBottom: 12 },
  matchCard: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    padding: 14, marginBottom: 10, ...SHADOWS.card,
  },
  matchConfidence: {
    backgroundColor: COLORS.chipBg, alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full, marginBottom: 8,
  },
  matchConfidenceText: { fontSize: 12, fontWeight: FONTS.semibold, color: COLORS.primary },
  matchItemName: { fontSize: 15, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 10 },
  priceList:    { gap: 6 },
  priceRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F8FAF8', borderRadius: RADIUS.sm,
    padding: 8, borderWidth: 1, borderColor: 'transparent',
  },
  priceRowBest: { backgroundColor: COLORS.savingBg, borderColor: COLORS.green + '40' },
  priceAmount:     { fontSize: 15, fontWeight: FONTS.bold, color: COLORS.text, flex: 1, textAlign: 'right', marginRight: 4 },
  priceAmountBest: { color: COLORS.green },
  bestTag: {
    backgroundColor: COLORS.green + '25', paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.xs,
  },
  bestTagText: { fontSize: 10, fontWeight: FONTS.bold, color: COLORS.greenDark },
  addBtn: {
    backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: RADIUS.sm,
  },
  addBtnActive: { backgroundColor: COLORS.green },
  addBtnText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 12 },

  // Actions
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  btnPrimary: { flex: 1, backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center' },
  btnPrimaryText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 15 },
  btnSecondary: { flex: 1, borderWidth: 2, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingVertical: 13, alignItems: 'center' },
  btnSecondaryText: { color: COLORS.text, fontWeight: FONTS.semibold, fontSize: 14 },
  btn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 15 },

  // No match
  noMatchView: { alignItems: 'center', paddingVertical: 16 },
  noMatchTitle: { fontSize: 18, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 8 },
  noMatchText: { fontSize: 14, fontWeight: FONTS.medium, color: COLORS.muted, textAlign: 'center', lineHeight: 22 },
  noMatchHint: { fontSize: 13, fontWeight: FONTS.medium, color: COLORS.muted, textAlign: 'center', marginTop: 8, lineHeight: 20 },
});