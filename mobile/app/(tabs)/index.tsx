import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, Modal,
} from 'react-native';
import { COLORS, SHADOWS, RADIUS, FONTS, SPACING } from '../../shared/theme';
import { getBestDeals, searchItems, loadCustomItems, Item } from '../../shared/store';
import { PriceCard } from '../../components/PriceCard';
import BarcodeScanner from '../../components/BarcodeScanner';

const TRENDING = [
  { label: '🍌 Banana',  query: 'Banana' },
  { label: '🥕 Carrots', query: 'Carrots' },
  { label: '🍞 Bread',   query: 'Bread' },
  { label: '🥛 Milk',    query: 'Milk' },
  { label: '🍚 Rice',    query: 'Rice' },
  { label: '🍎 Apples',  query: 'Apples' },
];

const CompareScreen = () => {
  const [query, setQuery]               = useState('');
  const [ready, setReady]               = useState(false);
  const [showScanner, setShowScanner]   = useState(false);

  useEffect(() => {
    loadCustomItems().then(() => setReady(true));
  }, []);

  const isSearching = query.length > 0;
  const results     = isSearching ? searchItems(query) : [];
  const bestDeals   = getBestDeals(10);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.brand}>
            Basket<Text style={styles.brandAccent}>Buddy</Text> 🛒
          </Text>
          <View style={styles.locationPill}>
            <Text style={styles.locationText}>📍 Dublin, IE</Text>
          </View>
        </View>

        {/* Search + Barcode scanner */}
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search milk, bread, eggs…"
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={query}
              onChangeText={setQuery}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.clearBtn}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Barcode scanner button */}
          <TouchableOpacity
            style={styles.barcodeBtn}
            onPress={() => setShowScanner(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.barcodeBtnIcon}>▦</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <FlatList
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 20, paddingTop: 4 }}
        data={isSearching ? results : bestDeals}
        keyExtractor={item => String(item.id)}
        ListHeaderComponent={
          !isSearching ? (
            <View>
              {/* Barcode promo banner */}
              <TouchableOpacity
                style={styles.barcodeBanner}
                onPress={() => setShowScanner(true)}
                activeOpacity={0.9}
              >
                <Text style={styles.barcodeBannerIcon}>▦</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.barcodeBannerTitle}>Scan any barcode</Text>
                  <Text style={styles.barcodeBannerSub}>Instantly compare prices across all 5 stores</Text>
                </View>
                <Text style={styles.barcodeBannerArrow}>→</Text>
              </TouchableOpacity>

              {/* Trending */}
              <Text style={styles.sectionTitle}>🔥 Trending Searches</Text>
              <View style={styles.chipRow}>
                {TRENDING.map(t => (
                  <TouchableOpacity
                    key={t.query}
                    style={styles.chip}
                    onPress={() => setQuery(t.query)}
                  >
                    <Text style={styles.chipText}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.sectionTitle}>💡 Today's Best Deals</Text>
            </View>
          ) : (
            <Text style={styles.sectionTitle}>
              {results.length} result{results.length !== 1 ? 's' : ''} for "{query}"
            </Text>
          )
        }
        renderItem={({ item }) => (
          <PriceCard item={item} showAllPrices={isSearching} />
        )}
        ListEmptyComponent={
          isSearching ? (
            <View style={styles.empty}>
              <Text style={{ fontSize: 48 }}>🤷</Text>
              <Text style={styles.emptyText}>No items found for "{query}"</Text>
              <Text style={styles.emptyHint}>Try scanning the barcode instead →</Text>
              <TouchableOpacity
                style={[styles.chip, { marginTop: 12, alignSelf: 'center' }]}
                onPress={() => setShowScanner(true)}
              >
                <Text style={styles.chipText}>▦ Scan barcode</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
      />

      {/* Barcode scanner modal */}
      <Modal
        visible={showScanner}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowScanner(false)}
      >
        <BarcodeScanner onClose={() => setShowScanner(false)} />
      </Modal>
    </SafeAreaView>
  );
};

export default CompareScreen;

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.primary },
  header: { backgroundColor: COLORS.primary, paddingHorizontal: SPACING.xl, paddingBottom: 16 },

  headerTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 14, marginTop: 8,
  },
  brand:       { fontSize: 26, fontWeight: FONTS.black, color: '#fff' },
  brandAccent: { color: '#FFE0B2' },
  locationPill: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full,
  },
  locationText: { color: '#fff', fontWeight: FONTS.semibold, fontSize: 12 },

  // Search row
  searchRow: { flexDirection: 'row', gap: 10 },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: RADIUS.full, paddingHorizontal: 14, height: 48,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)',
  },
  searchIcon:  { fontSize: 16, marginRight: 8, color: 'rgba(255,255,255,0.8)' },
  searchInput: { flex: 1, fontSize: 15, fontWeight: FONTS.medium, color: '#fff' },
  clearBtn:    { color: 'rgba(255,255,255,0.6)', fontSize: 16, padding: 4 },

  // Barcode button
  barcodeBtn: {
    width: 48, height: 48, borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)',
  },
  barcodeBtnIcon: { color: '#fff', fontSize: 20, fontWeight: FONTS.bold },

  content: {
    flex: 1, backgroundColor: COLORS.background,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: SPACING.page, paddingTop: 8,
  },

  // Barcode promo banner
  barcodeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.primary + '12',
    borderRadius: RADIUS.lg, padding: 14, marginTop: 12, marginBottom: 4,
    borderWidth: 1.5, borderColor: COLORS.primary + '30',
  },
  barcodeBannerIcon:  { fontSize: 28, color: COLORS.primary },
  barcodeBannerTitle: { fontSize: 14, fontWeight: FONTS.bold, color: COLORS.primary },
  barcodeBannerSub:   { fontSize: 12, fontWeight: FONTS.medium, color: COLORS.textSecondary, marginTop: 2 },
  barcodeBannerArrow: { fontSize: 18, color: COLORS.primary, fontWeight: FONTS.bold },

  sectionTitle: { fontSize: 18, fontWeight: FONTS.bold, color: COLORS.text, marginTop: 16, marginBottom: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    backgroundColor: COLORS.chipBg, paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: RADIUS.full,
  },
  chipText: { fontWeight: FONTS.semibold, fontSize: 13, color: COLORS.primary },

  empty: { alignItems: 'center', marginTop: 40, paddingHorizontal: 20 },
  emptyText: { fontSize: 16, fontWeight: FONTS.bold, color: COLORS.text, marginTop: 8, textAlign: 'center' },
  emptyHint: { fontSize: 13, fontWeight: FONTS.medium, color: COLORS.muted, marginTop: 6, textAlign: 'center' },
});