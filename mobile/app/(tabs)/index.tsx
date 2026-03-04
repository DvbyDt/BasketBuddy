import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { COLORS, SHADOWS } from '../../shared/theme';
import {
  getBestDeals,
  searchItems,
  loadCustomItems,
  Item,
} from '../../shared/store';
import { PriceCard } from '../../components/PriceCard';

const TRENDING = [
  { label: '🍌 Banana', query: 'Banana' },
  { label: '🥕 Carrots', query: 'Carrots' },
  { label: '🍞 Bread', query: 'Bread' },
  { label: '🥛 Milk', query: 'Milk' },
  { label: '🍚 Rice', query: 'Rice' },
  { label: '🍎 Apples', query: 'Apples' },
];

export default function CompareScreen() {
  const [query, setQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadCustomItems().then(() => setReady(true));
  }, []);

  const isSearching = query.length > 0;
  const results = isSearching ? searchItems(query) : [];
  const bestDeals = getBestDeals(10);

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
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search milk, bread, eggs…"
            placeholderTextColor="#ccc"
            value={query}
            onChangeText={setQuery}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Text style={styles.clearBtn}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 20 }}
        data={isSearching ? results : bestDeals}
        keyExtractor={item => String(item.id)}
        ListHeaderComponent={
          !isSearching ? (
            <View>
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
          <PriceCard
            item={item}
            showAllPrices={isSearching}
            onPress={() => setSelectedItem(item)}
          />
        )}
        ListEmptyComponent={
          isSearching ? (
            <View style={styles.empty}>
              <Text style={{ fontSize: 48 }}>🤷</Text>
              <Text style={styles.emptyText}>No items found</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.primary },
  header: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  brand: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
  },
  brandAccent: {
    color: '#FFE0B2',
  },
  locationPill: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  locationText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
  },
  searchIcon: { fontSize: 18, marginRight: 8 },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  clearBtn: {
    color: '#ccc',
    fontSize: 18,
    padding: 4,
  },
  content: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 16,
    marginBottom: 12,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    backgroundColor: COLORS.chipBg,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  chipText: {
    fontWeight: '700',
    fontSize: 13,
    color: COLORS.primary,
  },
  empty: {
    alignItems: 'center',
    marginTop: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.muted,
    marginTop: 8,
  },
});
