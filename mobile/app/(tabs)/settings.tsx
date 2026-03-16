import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  SafeAreaView,
  Alert,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, SHADOWS } from '../../shared/theme';
import {
  stores,
  items,
  addCustomItem,
  removeCustomItem,
  getNextCustomId,
  loadCustomItems,
  onCustomItemsUpdate,
} from '../../shared/store';
import type { Store } from '../../shared/types';
import AISettingsSection from '../../components/AISettingsSection';

const STORES_STORAGE_KEY = 'basketbuddy_custom_stores';

export default function SettingsScreen() {
  // Custom stores
  const [customStores, setCustomStores] = useState<Store[]>([]);
  const [showAddStore, setShowAddStore] = useState(false);
  const [newStoreName, setNewStoreName] = useState('');

  // Custom items
  const [showAddItem, setShowAddItem] = useState(false);
  const [itemName, setItemName] = useState('');
  const [itemQuantity, setItemQuantity] = useState('');
  const [itemCategory, setItemCategory] = useState('Other');
  const [itemPrices, setItemPrices] = useState<Record<string, string>>({});
  const [customItemsList, setCustomItemsList] = useState(items.filter(i => i.id >= 10000));

  const CATEGORIES = ['Dairy', 'Bakery', 'Meat', 'Produce', 'Fruits', 'Vegetables', 'Grains', 'Snacks', 'Drinks', 'Frozen', 'Other'];

  // Load settings on mount
  useEffect(() => {
    loadSettings();
    // Listen for real-time custom items changes from Firestore
    onCustomItemsUpdate((customItems) => {
      setCustomItemsList(customItems);
    });
  }, []);

  const loadSettings = async () => {
    try {
      await loadCustomItems();
      setCustomItemsList(items.filter(i => i.id >= 10000));
      const storesJson = await AsyncStorage.getItem(STORES_STORAGE_KEY);
      if (storesJson) {
        setCustomStores(JSON.parse(storesJson));
      }
    } catch {}
  };

  const addCustomStore = async () => {
    const name = newStoreName.trim();
    if (!name) return;
    const id = name.toLowerCase().replace(/\s+/g, '_');
    if (
      stores.find(s => s.id === id) ||
      customStores.find(s => s.id === id)
    ) {
      Alert.alert('Exists', 'A store with that name already exists');
      return;
    }
    const newStore: Store = { id, name, color: '#9B5DE5', emoji: '🟣' };
    const updated = [...customStores, newStore];
    setCustomStores(updated);
    setNewStoreName('');
    setShowAddStore(false);
    try {
      await AsyncStorage.setItem(STORES_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  };

  const removeCustomStore = async (id: string) => {
    const updated = customStores.filter(s => s.id !== id);
    setCustomStores(updated);
    try {
      await AsyncStorage.setItem(STORES_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  };

  const saveNewItem = async () => {
    const name = itemName.trim();
    if (!name) { Alert.alert('Error', 'Enter an item name'); return; }
    const prices: Record<string, number> = {};
    for (const s of stores) {
      const v = parseFloat(itemPrices[s.id] || '');
      if (!isNaN(v) && v > 0) prices[s.id] = v;
    }
    if (Object.keys(prices).length === 0) {
      Alert.alert('Error', 'Enter at least one price');
      return;
    }
    const newItem = {
      id: getNextCustomId(),
      name,
      quantity: itemQuantity.trim(),
      category: itemCategory,
      prices,
      history: {} as Record<string, number[]>,
    };
    await addCustomItem(newItem);
    setCustomItemsList(items.filter(i => i.id >= 10000));
    setItemName('');
    setItemQuantity('');
    setItemCategory('Other');
    setItemPrices({});
    setShowAddItem(false);
    Alert.alert('Added!', `${name} has been added to the database.`);
  };

  const deleteCustomItem = async (id: number, name: string) => {
    Alert.alert('Remove Item', `Remove "${name}" from the database?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await removeCustomItem(id);
          setCustomItemsList(items.filter(i => i.id >= 10000));
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
      <AISettingsSection />
        <Text style={styles.headerTitle}>⚙️ Settings</Text>

        {/* ── Add Custom Item ────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>➕ Add Custom Item</Text>
          <View style={styles.card}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.textLight, marginBottom: 12, lineHeight: 20 }}>
              Can't find an item? Add it yourself with prices from any store.
            </Text>
            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={() => setShowAddItem(true)}
            >
              <Text style={styles.btnPrimaryText}>+ Add New Item</Text>
            </TouchableOpacity>

            {customItemsList.length > 0 && (
              <View style={{ marginTop: 14 }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: COLORS.text, marginBottom: 8 }}>
                  Your custom items ({customItemsList.length}):
                </Text>
                {customItemsList.map(item => (
                  <View key={item.id} style={styles.storeRow}>
                    <Text style={[styles.storeName, { flex: 1 }]}>
                      {item.name}{item.quantity ? ` (${item.quantity})` : ''}
                    </Text>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.muted, marginRight: 8 }}>
                      {item.category}
                    </Text>
                    <TouchableOpacity onPress={() => deleteCustomItem(item.id, item.name)}>
                      <Text style={styles.removeStoreBtn}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* ── Manage Stores ──────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏪 Manage Stores</Text>
          <View style={styles.card}>
            {stores.map(s => (
              <View key={s.id} style={styles.storeRow}>
                <View style={[styles.storeDot, { backgroundColor: s.color }]} />
                <Text style={styles.storeName}>
                  {s.emoji} {s.name}
                </Text>
                <Text style={styles.builtInLabel}>Built-in</Text>
              </View>
            ))}

            {customStores.map(s => (
              <View key={s.id} style={styles.storeRow}>
                <View
                  style={[styles.storeDot, { backgroundColor: s.color }]}
                />
                <Text style={styles.storeName}>
                  {s.emoji} {s.name}
                </Text>
                <TouchableOpacity onPress={() => removeCustomStore(s.id)}>
                  <Text style={styles.removeStoreBtn}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))}

            {showAddStore ? (
              <View style={styles.addStoreRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="e.g. Dunnes Stores"
                  placeholderTextColor={COLORS.muted}
                  value={newStoreName}
                  onChangeText={setNewStoreName}
                  autoFocus
                />
                <TouchableOpacity style={styles.addBtn} onPress={addCustomStore}>
                  <Text style={styles.addBtnText}>Add</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.btnOutline, { marginTop: 10 }]}
                onPress={() => setShowAddStore(true)}
              >
                <Text style={styles.btnOutlineText}>+ Add Custom Store</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── About ──────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ℹ️ About</Text>
          <View style={styles.card}>
            <Text style={styles.aboutName}>BasketBuddy 🛒</Text>
            <Text style={styles.aboutDesc}>
              Compare grocery prices across Dublin stores. Find the cheapest
              option and save money on every shop.
            </Text>
            <Text style={styles.aboutVersion}>Version 1.0.0</Text>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Add Item Modal ───────────────────────────────── */}
      <Modal visible={showAddItem} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              <Text style={styles.modalTitle}>➕ Add Custom Item</Text>

              <Text style={styles.modalLabel}>Item Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Organic Oats"
                placeholderTextColor={COLORS.muted}
                value={itemName}
                onChangeText={setItemName}
              />

              <Text style={styles.modalLabel}>Quantity / Weight</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 500g, 2L, Pack of 6"
                placeholderTextColor={COLORS.muted}
                value={itemQuantity}
                onChangeText={setItemQuantity}
              />

              <Text style={styles.modalLabel}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                {CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setItemCategory(cat)}
                    style={[
                      styles.catChip,
                      itemCategory === cat && styles.catChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.catChipText,
                        itemCategory === cat && styles.catChipTextActive,
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.modalLabel}>Prices by Store (€)</Text>
              {stores.map(s => (
                <View key={s.id} style={styles.priceRow}>
                  <Text style={[styles.priceLabel, { color: s.color }]}>
                    {s.emoji} {s.name}
                  </Text>
                  <TextInput
                    style={[styles.input, { flex: 1, marginBottom: 0 }]}
                    placeholder="0.00"
                    placeholderTextColor={COLORS.muted}
                    keyboardType="decimal-pad"
                    value={itemPrices[s.id] || ''}
                    onChangeText={v =>
                      setItemPrices(prev => ({ ...prev, [s.id]: v }))
                    }
                  />
                </View>
              ))}

              <View style={{ height: 16 }} />
              <TouchableOpacity style={styles.btnPrimary} onPress={saveNewItem}>
                <Text style={styles.btnPrimaryText}>💾 Save Item</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnOutline, { marginTop: 10 }]}
                onPress={() => setShowAddItem(false)}
              >
                <Text style={styles.btnOutlineText}>Cancel</Text>
              </TouchableOpacity>
              <View style={{ height: 30 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ── Styles ─────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 16 },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 8,
    marginBottom: 16,
  },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 8,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    ...SHADOWS.card,
  },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  btnPrimary: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnPrimaryText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
  btnOutline: {
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnOutlineText: { color: COLORS.primary, fontWeight: '700', fontSize: 14 },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  storeDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  storeName: { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.text },
  builtInLabel: { fontSize: 12, fontWeight: '700', color: COLORS.muted },
  removeStoreBtn: { fontSize: 12, fontWeight: '700', color: COLORS.red },
  addStoreRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  addBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  addBtnText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  aboutName: { fontSize: 18, fontWeight: '800', color: COLORS.text, marginBottom: 6 },
  aboutDesc: { fontSize: 13, fontWeight: '600', color: COLORS.textLight, lineHeight: 20 },
  aboutVersion: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.muted,
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6,
    marginTop: 4,
  },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    marginRight: 8,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  catChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  catChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },
  catChipTextActive: {
    color: '#FFF',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  priceLabel: {
    fontSize: 13,
    fontWeight: '700',
    width: 130,
  },
});
