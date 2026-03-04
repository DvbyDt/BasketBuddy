import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  SafeAreaView,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { COLORS, SHADOWS } from '../../shared/theme';
import { fmt } from '../../shared/store';

interface SplitItem {
  id: number;
  name: string;
  price: number;
  owner: 'me' | 'shared' | 'them';
}

export default function SplitScreen() {
  const [items, setItems] = useState<SplitItem[]>([]);
  const [nextId, setNextId] = useState(100);
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');

  const setOwner = useCallback((id: number, owner: SplitItem['owner']) => {
    setItems(prev => prev.map(i => (i.id === id ? { ...i, owner } : i)));
  }, []);

  const removeItem = useCallback((id: number) => {
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const addItem = () => {
    const name = newName.trim();
    const price = parseFloat(newPrice);
    if (!name || isNaN(price) || price <= 0) {
      Alert.alert('Invalid', 'Enter a valid name and price');
      return;
    }
    setItems(prev => [...prev, { id: nextId, name, price, owner: 'shared' }]);
    setNextId(prev => prev + 1);
    setNewName('');
    setNewPrice('');
    setShowModal(false);
  };

  const clearAll = () => {
    if (items.length === 0) return;
    Alert.alert('Clear All', 'Remove all items?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => setItems([]) },
    ]);
  };

  // Calculate totals
  let myTotal = 0;
  let theirTotal = 0;
  items.forEach(i => {
    if (i.owner === 'me') myTotal += i.price;
    else if (i.owner === 'them') theirTotal += i.price;
    else {
      myTotal += i.price / 2;
      theirTotal += i.price / 2;
    }
  });
  const grandTotal = myTotal + theirTotal;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>🧾 Receipt Splitter</Text>
        {items.length > 0 && (
          <TouchableOpacity onPress={clearAll}>
            <Text style={styles.clearBtn}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 56 }}>🧾</Text>
          <Text style={styles.emptyTitle}>Split Your Bill</Text>
          <Text style={styles.emptySubtitle}>
            Add your grocery items below and assign each one to yourself or your roommate to see who owes what.
          </Text>
          <View style={styles.comingSoonBox}>
            <Text style={styles.comingSoonTitle}>📷 Receipt Scanning — Coming Soon!</Text>
            <Text style={styles.comingSoonText}>
              We're actively working on an exciting update that will let you snap a photo of your receipt and have AI automatically extract all items and prices for you — no manual entry needed! Stay tuned for this feature in a future update.
            </Text>
          </View>
          <View style={styles.emptyActions}>
            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={() => setShowModal(true)}
            >
              <Text style={styles.btnPrimaryText}>+ Add Item</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <>
          <FlatList
            data={items}
            keyExtractor={i => String(i.id)}
            contentContainerStyle={{ padding: 16, paddingBottom: 300 }}
            ListHeaderComponent={
              <TouchableOpacity
                style={[styles.btnOutline, { marginBottom: 12 }]}
                onPress={() => setShowModal(true)}
              >
                <Text style={styles.btnOutlineText}>+ Add Item</Text>
              </TouchableOpacity>
            }
            renderItem={({ item }) => (
              <View style={styles.card}>
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => removeItem(item.id)}
                >
                  <Text style={styles.removeTxt}>✕</Text>
                </TouchableOpacity>
                <View style={styles.cardRow}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemPrice}>{fmt(item.price)}</Text>
                </View>
                <View style={styles.toggleRow}>
                  <OwnerButton
                    label="🧍 Me"
                    active={item.owner === 'me'}
                    activeColor="#E3F2FD"
                    activeBorder="#2196F3"
                    onPress={() => setOwner(item.id, 'me')}
                  />
                  <OwnerButton
                    label="½ Split"
                    active={item.owner === 'shared'}
                    activeColor="#FFF3E0"
                    activeBorder={COLORS.primary}
                    onPress={() => setOwner(item.id, 'shared')}
                  />
                  <OwnerButton
                    label="👤 Them"
                    active={item.owner === 'them'}
                    activeColor="#E8F5E9"
                    activeBorder="#4CAF50"
                    onPress={() => setOwner(item.id, 'them')}
                  />
                </View>
              </View>
            )}
            ListFooterComponent={
              grandTotal > 0 ? (
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryTitle}>💸 Split Summary</Text>
                  <SummaryRow label="Total Bill" value={fmt(grandTotal)} />
                  <SummaryRow
                    label="🧍 You owe"
                    value={fmt(myTotal)}
                    highlight="#2196F3"
                  />
                  <SummaryRow
                    label="👤 Roommate owes"
                    value={fmt(theirTotal)}
                    highlight="#4CAF50"
                  />
                </View>
              ) : null
            }
          />
        </>
      )}

      {/* Add Item Modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Add Split Item</Text>

            <Text style={styles.label}>Item Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Pasta"
              placeholderTextColor={COLORS.muted}
              value={newName}
              onChangeText={setNewName}
              autoFocus
            />

            <Text style={styles.label}>Price (€)</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              placeholderTextColor={COLORS.muted}
              keyboardType="decimal-pad"
              value={newPrice}
              onChangeText={setNewPrice}
            />

            <TouchableOpacity style={styles.btnPrimary} onPress={addItem}>
              <Text style={styles.btnPrimaryText}>Add Item</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnOutline, { marginTop: 8 }]}
              onPress={() => setShowModal(false)}
            >
              <Text style={styles.btnOutlineText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

/* ── Sub-components ─────────────────────────────────────────────── */

function OwnerButton({
  label,
  active,
  activeColor,
  activeBorder,
  onPress,
}: {
  label: string;
  active: boolean;
  activeColor: string;
  activeBorder: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.ownerBtn,
        active && { backgroundColor: activeColor, borderColor: activeBorder },
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.ownerBtnText,
          active && { color: activeBorder },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function SummaryRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: string;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text
        style={[
          styles.summaryValue,
          highlight ? { color: highlight } : undefined,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

/* ── Styles ─────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  clearBtn: { fontSize: 14, fontWeight: '700', color: COLORS.red },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 6,
  },
  emptyActions: { marginTop: 20, gap: 10, width: '100%' },
  comingSoonBox: {
    backgroundColor: '#FFF3E0',
    borderRadius: 14,
    padding: 16,
    marginTop: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#FFB74D',
    width: '100%',
  },
  comingSoonTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#E65100',
    marginBottom: 6,
  },
  comingSoonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#BF360C',
    lineHeight: 18,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    ...SHADOWS.card,
  },
  removeBtn: {
    position: 'absolute',
    top: 8,
    right: 10,
    zIndex: 1,
  },
  removeTxt: { fontSize: 16, color: COLORS.muted, fontWeight: '700' },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingRight: 24,
  },
  itemName: { fontSize: 15, fontWeight: '700', color: COLORS.text, flex: 1 },
  itemPrice: { fontSize: 16, fontWeight: '800', color: COLORS.primary },
  toggleRow: { flexDirection: 'row', gap: 8 },
  ownerBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    alignItems: 'center',
  },
  ownerBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.muted },
  summaryCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    ...SHADOWS.card,
  },
  summaryTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  summaryLabel: { fontSize: 14, fontWeight: '600', color: COLORS.textLight },
  summaryValue: { fontSize: 15, fontWeight: '800', color: COLORS.text },
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
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textLight,
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 4,
  },
});
