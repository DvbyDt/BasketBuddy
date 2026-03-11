import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList, ScrollView,
  TouchableOpacity, StyleSheet, SafeAreaView,
  Alert, Modal, KeyboardAvoidingView, Platform,
  ActivityIndicator, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, SHADOWS } from '../../shared/theme';
import { fmt } from '../../shared/store';

// ── Types ─────────────────────────────────────────────────────────

interface ReceiptItem {
  id: number;
  name: string;
  price: number;
  isDiscount: boolean;          // true for offer/discount lines
  assignedTo: number | null;   // person index, null = unassigned, -1 = shared
}

interface Person {
  name: string;
  emoji: string;
  color: string;
}

type Step = 'capture' | 'people' | 'assign' | 'summary';

const PERSON_EMOJIS = ['🧍', '👤', '🙋', '🧑', '👱', '🧔'];
const PERSON_COLORS = ['#2196F3', '#4CAF50', '#9C27B0', '#FF5722', '#FF9800', '#00BCD4'];

// ── Main Screen ───────────────────────────────────────────────────

export default function SplitScreen() {
  const [step, setStep]               = useState<Step>('capture');
  const [imageUri, setImageUri]       = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [scanning, setScanning]       = useState(false);
  const [receiptItems, setReceiptItems] = useState<ReceiptItem[]>([]);
  const [people, setPeople]           = useState<Person[]>([
    { name: 'Me',   emoji: '🧍', color: '#2196F3' },
    { name: 'Them', emoji: '👤', color: '#4CAF50' },
  ]);
  const [addPersonName, setAddPersonName] = useState('');
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [showAddItem, setShowAddItem]     = useState(false);
  const [newItemName, setNewItemName]     = useState('');
  const [newItemPrice, setNewItemPrice]   = useState('');
  const [nextId, setNextId]               = useState(1);

  // ── Step 1: Capture ─────────────────────────────────────────────

  const pickCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow camera access to scan receipts.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      base64: true,
      quality: 0.8,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setImageBase64(result.assets[0].base64 ?? null);
      await scanReceipt(result.assets[0].base64 ?? null);
    }
  };

  const pickGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      base64: true,
      quality: 0.8,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setImageBase64(result.assets[0].base64 ?? null);
      await scanReceipt(result.assets[0].base64 ?? null);
    }
  };

  const scanReceipt = async (base64: string | null) => {
    if (!base64) return;
    setScanning(true);

    try {
      // Load Anthropic key from AsyncStorage
      const stored = await AsyncStorage.getItem('basketbuddy_ai');
      const settings = stored ? JSON.parse(stored) : {};

      if (settings.provider !== 'anthropic' || !settings.key) {
        Alert.alert(
          'Anthropic key needed',
          'Receipt scanning uses AI vision. Go to Settings and add an Anthropic API key (it\'s very cheap — ~€0.01 per scan).',
          [{ text: 'OK' }]
        );
        setScanning(false);
        // Let user add items manually
        setStep('people');
        return;
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': settings.key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1500,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: 'image/jpeg', data: base64 },
              },
              {
                type: 'text',
                text: `Extract all items from this grocery receipt.

Return ONLY valid JSON with this exact structure:
{
  "items": [
    {"name": "Item name", "price": 1.99, "isDiscount": false},
    {"name": "Clubcard Saving", "price": -0.50, "isDiscount": true}
  ]
}

Rules:
- Include EVERY line item with a price
- Discount/offer lines (Clubcard, loyalty, multibuy, savings) → isDiscount: true, price as NEGATIVE number
- Regular items → isDiscount: false, price as POSITIVE number
- If price is unclear, skip the item
- No markdown, no explanation, just the JSON object`,
              },
            ],
          }],
        }),
      });

      const data = await response.json();
      const text = data.content?.map((c: any) => c.text || '').join('') ?? '';
      const clean = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);

      const extracted: ReceiptItem[] = (parsed.items ?? []).map((item: any, i: number) => ({
        id: i + 1,
        name: item.name,
        price: parseFloat(item.price) || 0,
        isDiscount: item.isDiscount ?? false,
        assignedTo: null,
      }));

      setReceiptItems(extracted);
      setNextId(extracted.length + 1);
      setStep('people');
    } catch (e: any) {
      console.error('Scan error:', e);
      Alert.alert(
        'Scan failed',
        'Could not read the receipt. You can add items manually.',
        [{ text: 'Add manually', onPress: () => setStep('people') }]
      );
    } finally {
      setScanning(false);
    }
  };

  // ── Step 2: People ──────────────────────────────────────────────

  const addPerson = () => {
    const name = addPersonName.trim();
    if (!name) return;
    if (people.length >= 6) {
      Alert.alert('Max 6 people', 'That\'s a big group — max 6 people for now!');
      return;
    }
    const idx = people.length;
    setPeople(prev => [...prev, {
      name,
      emoji: PERSON_EMOJIS[idx] ?? '🧑',
      color: PERSON_COLORS[idx] ?? '#607D8B',
    }]);
    setAddPersonName('');
    setShowAddPerson(false);
  };

  const removePerson = (idx: number) => {
    if (people.length <= 2) {
      Alert.alert('Minimum 2 people', 'Need at least 2 people to split a bill!');
      return;
    }
    setPeople(prev => prev.filter((_, i) => i !== idx));
    // Unassign items assigned to removed person
    setReceiptItems(prev =>
      prev.map(item => item.assignedTo === idx
        ? { ...item, assignedTo: null }
        : item
      )
    );
  };

  const addItemManually = () => {
    const name = newItemName.trim();
    const price = parseFloat(newItemPrice);
    if (!name || isNaN(price) || price === 0) {
      Alert.alert('Invalid', 'Enter a valid name and price');
      return;
    }
    setReceiptItems(prev => [...prev, {
      id: nextId,
      name,
      price: Math.abs(price),
      isDiscount: price < 0,
      assignedTo: null,
    }]);
    setNextId(n => n + 1);
    setNewItemName('');
    setNewItemPrice('');
    setShowAddItem(false);
  };

  // ── Step 3: Assign ──────────────────────────────────────────────

  const assignItem = (itemId: number, personIdx: number | -1) => {
    setReceiptItems(prev =>
      prev.map(item =>
        item.id === itemId
          ? { ...item, assignedTo: item.assignedTo === personIdx ? null : personIdx }
          : item
      )
    );
  };

  const assignAll = (personIdx: number | -1) => {
    setReceiptItems(prev => prev.map(item => ({ ...item, assignedTo: personIdx })));
  };

  const unassignedCount = receiptItems.filter(
    i => !i.isDiscount && i.assignedTo === null
  ).length;

  // ── Step 4: Summary ─────────────────────────────────────────────

  const computeSummary = () => {
    const totals = people.map(() => 0);
    let totalDiscounts = 0;
    let totalBill = 0;

    // Sum regular items
    receiptItems.forEach(item => {
      if (item.isDiscount) {
        totalDiscounts += Math.abs(item.price); // accumulate discounts
        return;
      }
      if (item.assignedTo === null) return; // unassigned, skip
      if (item.assignedTo === -1) {
        // Shared — split equally
        const share = item.price / people.length;
        totals.forEach((_, i) => { totals[i] += share; });
      } else {
        totals[item.assignedTo] += item.price;
      }
      totalBill += item.price;
    });

    // Distribute discounts proportionally
    if (totalDiscounts > 0 && totalBill > 0) {
      totals.forEach((total, i) => {
        const proportion = total / totalBill;
        totals[i] = Math.max(0, total - totalDiscounts * proportion);
      });
    }

    const grandTotal = totals.reduce((s, t) => s + t, 0);
    return { totals, grandTotal, totalDiscounts };
  };

  const resetAll = () => {
    Alert.alert('Start over?', 'This will clear everything.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Start over', style: 'destructive', onPress: () => {
              // Reset all UI state
              setStep('capture');
              setImageUri(null);
              setImageBase64(null);
              setReceiptItems([]);
              setPeople([
                { name: 'Me',   emoji: '🧍', color: '#2196F3' },
                { name: 'Them', emoji: '👤', color: '#4CAF50' },
              ]);
              Alert.alert('Reset', 'Receipt split UI has been reset.');
        }
      },
    ]);
  };

  // ── Render ───────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>🧾 Receipt Splitter</Text>
        {step !== 'capture' && (
          <TouchableOpacity onPress={resetAll}>
            <Text style={styles.resetBtn}>Reset</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Progress steps */}
      {step !== 'capture' && (
        <StepIndicator current={step} />
      )}

      {/* ── STEP 1: Capture ── */}
      {step === 'capture' && (
        <CaptureStep
          scanning={scanning}
          imageUri={imageUri}
          onCamera={pickCamera}
          onGallery={pickGallery}
          onManual={() => { setReceiptItems([]); setStep('people'); }}
        />
      )}

      {/* ── STEP 2: People setup ── */}
      {step === 'people' && (
        <PeopleStep
          people={people}
          receiptItems={receiptItems}
          onRemovePerson={removePerson}
          onAddPerson={() => setShowAddPerson(true)}
          onAddItem={() => setShowAddItem(true)}
          onRemoveItem={(id) => setReceiptItems(prev => prev.filter(i => i.id !== id))}
          onNext={() => setStep('assign')}
        />
      )}

      {/* ── STEP 3: Assign ── */}
      {step === 'assign' && (
        <AssignStep
          items={receiptItems}
          people={people}
          onAssign={assignItem}
          onAssignAll={assignAll}
          unassignedCount={unassignedCount}
          onNext={() => setStep('summary')}
          onBack={() => setStep('people')}
        />
      )}

      {/* ── STEP 4: Summary ── */}
      {step === 'summary' && (
        <SummaryStep
          people={people}
          summary={computeSummary()}
          receiptItems={receiptItems}
          onBack={() => setStep('assign')}
          onReset={resetAll}
        />
      )}

      {/* Add person modal */}
      <Modal visible={showAddPerson} transparent animationType="slide" onRequestClose={() => setShowAddPerson(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Add Person</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter name (e.g. Sarah)"
              placeholderTextColor={COLORS.muted}
              value={addPersonName}
              onChangeText={setAddPersonName}
              autoFocus
              onSubmitEditing={addPerson}
            />
            <TouchableOpacity style={styles.btnPrimary} onPress={addPerson}>
              <Text style={styles.btnPrimaryText}>Add Person</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btnOutline, { marginTop: 8 }]} onPress={() => setShowAddPerson(false)}>
              <Text style={styles.btnOutlineText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add item modal */}
      <Modal visible={showAddItem} transparent animationType="slide" onRequestClose={() => setShowAddItem(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Add Item</Text>
            <Text style={styles.label}>Item name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Milk"
              placeholderTextColor={COLORS.muted}
              value={newItemName}
              onChangeText={setNewItemName}
              autoFocus
            />
            <Text style={styles.label}>Price (€) — use negative for discounts</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 1.99 or -0.50 for discount"
              placeholderTextColor={COLORS.muted}
              keyboardType="decimal-pad"
              value={newItemPrice}
              onChangeText={setNewItemPrice}
            />
            <TouchableOpacity style={styles.btnPrimary} onPress={addItemManually}>
              <Text style={styles.btnPrimaryText}>Add Item</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btnOutline, { marginTop: 8 }]} onPress={() => setShowAddItem(false)}>
              <Text style={styles.btnOutlineText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ── Step Indicator ────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: 'capture', label: '📷' },
    { key: 'people',  label: '👥' },
    { key: 'assign',  label: '✏️' },
    { key: 'summary', label: '💸' },
  ];
  const currentIdx = steps.findIndex(s => s.key === current);
  return (
    <View style={styles.stepIndicator}>
      {steps.map((s, i) => (
        <React.Fragment key={s.key}>
          <View style={[styles.stepDot, i <= currentIdx && styles.stepDotActive]}>
            <Text style={styles.stepDotText}>{s.label}</Text>
          </View>
          {i < steps.length - 1 && (
            <View style={[styles.stepLine, i < currentIdx && styles.stepLineActive]} />
          )}
        </React.Fragment>
      ))}
    </View>
  );
}

// ── Step 1: Capture ───────────────────────────────────────────────

function CaptureStep({ scanning, imageUri, onCamera, onGallery, onManual }: {
  scanning: boolean;
  imageUri: string | null;
  onCamera: () => void;
  onGallery: () => void;
  onManual: () => void;
}) {
  if (scanning) {
    return (
      <View style={styles.scanningView}>
        {imageUri && <Image source={{ uri: imageUri }} style={styles.receiptPreview} resizeMode="contain" />}
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 24 }} />
        <Text style={styles.scanningTitle}>Reading your receipt…</Text>
        <Text style={styles.scanningSubtitle}>AI is extracting items and prices</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.captureContainer}>
      <Text style={styles.captureIcon}>🧾</Text>
      <Text style={styles.captureTitle}>Scan Your Receipt</Text>
      <Text style={styles.captureSubtitle}>
        Take a photo or upload an image — AI will extract all items and prices automatically, including any discounts at the bottom.
      </Text>

      {/* Camera button */}
      <TouchableOpacity style={styles.captureBtn} onPress={onCamera}>
        <Text style={styles.captureBtnIcon}>📷</Text>
        <View>
          <Text style={styles.captureBtnTitle}>Take a Photo</Text>
          <Text style={styles.captureBtnSub}>Open camera and snap your receipt</Text>
        </View>
      </TouchableOpacity>

      {/* Upload button */}
      <TouchableOpacity style={[styles.captureBtn, { backgroundColor: '#F3E8FF' }]} onPress={onGallery}>
        <Text style={styles.captureBtnIcon}>🖼️</Text>
        <View>
          <Text style={[styles.captureBtnTitle, { color: '#7C3AED' }]}>Upload Image</Text>
          <Text style={styles.captureBtnSub}>Choose from your photo library</Text>
        </View>
      </TouchableOpacity>

      {/* Manual entry */}
      <TouchableOpacity style={styles.manualBtn} onPress={onManual}>
        <Text style={styles.manualBtnText}>✏️ Enter items manually instead</Text>
      </TouchableOpacity>

      <View style={styles.aiNote}>
        <Text style={styles.aiNoteText}>
          🤖 Powered by Anthropic AI · Requires Anthropic key in Settings · ~€0.01 per scan
        </Text>
      </View>
    </ScrollView>
  );
}

// ── Step 2: People + Items review ─────────────────────────────────

function PeopleStep({ people, receiptItems, onRemovePerson, onAddPerson, onAddItem, onRemoveItem, onNext }: {
  people: Person[];
  receiptItems: ReceiptItem[];
  onRemovePerson: (i: number) => void;
  onAddPerson: () => void;
  onAddItem: () => void;
  onRemoveItem: (id: number) => void;
  onNext: () => void;
}) {
  return (
    <ScrollView style={styles.stepContent} contentContainerStyle={{ paddingBottom: 32 }}>
      {/* People */}
      <Text style={styles.sectionTitle}>👥 Who's splitting?</Text>
      <Text style={styles.sectionSub}>Add everyone who's sharing this bill</Text>

      <View style={styles.peopleRow}>
        {people.map((p, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.personChip, { borderColor: p.color, backgroundColor: p.color + '15' }]}
            onLongPress={() => onRemovePerson(i)}
          >
            <Text style={styles.personChipEmoji}>{p.emoji}</Text>
            <Text style={[styles.personChipName, { color: p.color }]}>{p.name}</Text>
          </TouchableOpacity>
        ))}
        {people.length < 6 && (
          <TouchableOpacity style={styles.addPersonChip} onPress={onAddPerson}>
            <Text style={styles.addPersonText}>+ Add</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.hintText}>Long-press a person to remove them</Text>

      {/* Items review */}
      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
        🧾 Receipt Items {receiptItems.length > 0 ? `(${receiptItems.length})` : ''}
      </Text>
      <Text style={styles.sectionSub}>Review and edit before assigning</Text>

      {receiptItems.length === 0 && (
        <View style={styles.emptyItems}>
          <Text style={styles.emptyItemsText}>No items yet — add them manually</Text>
        </View>
      )}

      {receiptItems.map(item => (
        <View key={item.id} style={[styles.reviewItem, item.isDiscount && styles.reviewItemDiscount]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.reviewItemName} numberOfLines={1}>{item.name}</Text>
            {item.isDiscount && <Text style={styles.discountLabel}>🏷️ Discount</Text>}
          </View>
          <Text style={[styles.reviewItemPrice, item.isDiscount && { color: COLORS.green }]}>
            {item.isDiscount ? `-${fmt(Math.abs(item.price))}` : fmt(item.price)}
          </Text>
          <TouchableOpacity onPress={() => onRemoveItem(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.removeItemBtn}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity style={[styles.btnOutline, { marginTop: 12 }]} onPress={onAddItem}>
        <Text style={styles.btnOutlineText}>+ Add item manually</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btnPrimary, { marginTop: 20 }]}
        onPress={onNext}
        disabled={receiptItems.filter(i => !i.isDiscount).length === 0}
      >
        <Text style={styles.btnPrimaryText}>
          Assign Items →
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ── Step 3: Assign ────────────────────────────────────────────────

function AssignStep({ items, people, onAssign, onAssignAll, unassignedCount, onNext, onBack }: {
  items: ReceiptItem[];
  people: Person[];
  onAssign: (itemId: number, personIdx: number | -1) => void;
  onAssignAll: (personIdx: number | -1) => void;
  unassignedCount: number;
  onNext: () => void;
  onBack: () => void;
}) {
  const regularItems  = items.filter(i => !i.isDiscount);
  const discountItems = items.filter(i => i.isDiscount);

  return (
    <View style={{ flex: 1 }}>
      {/* Quick assign bar */}
      <View style={styles.quickAssignBar}>
        <Text style={styles.quickAssignLabel}>Assign all to:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {people.map((p, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.quickChip, { backgroundColor: p.color }]}
              onPress={() => onAssignAll(i)}
            >
              <Text style={styles.quickChipText}>{p.emoji} {p.name}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.quickChip, { backgroundColor: '#607D8B' }]}
            onPress={() => onAssignAll(-1)}
          >
            <Text style={styles.quickChipText}>½ Split all</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <FlatList
        data={regularItems}
        keyExtractor={i => String(i.id)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
        ListHeaderComponent={
          unassignedCount > 0 ? (
            <View style={styles.assignProgressBar}>
              <Text style={styles.assignProgressText}>
                {regularItems.length - unassignedCount}/{regularItems.length} items assigned
              </Text>
              <View style={styles.progressTrack}>
                <View style={[
                  styles.progressFill,
                  { width: `${((regularItems.length - unassignedCount) / regularItems.length) * 100}%` }
                ]} />
              </View>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <AssignCard item={item} people={people} onAssign={onAssign} />
        )}
        ListFooterComponent={
          discountItems.length > 0 ? (
            <View style={styles.discountSection}>
              <Text style={styles.discountSectionTitle}>🏷️ Discounts (auto-distributed)</Text>
              <Text style={styles.discountSectionSub}>
                These will be split proportionally based on each person's share
              </Text>
              {discountItems.map(item => (
                <View key={item.id} style={styles.discountRow}>
                  <Text style={styles.discountRowName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.discountRowPrice}>-{fmt(Math.abs(item.price))}</Text>
                </View>
              ))}
            </View>
          ) : null
        }
      />

      {/* Bottom actions */}
      <View style={styles.assignFooter}>
        {unassignedCount > 0 && (
          <Text style={styles.unassignedWarning}>
            ⚠️ {unassignedCount} item{unassignedCount > 1 ? 's' : ''} not yet assigned
          </Text>
        )}
        <View style={styles.assignFooterBtns}>
          <TouchableOpacity style={styles.btnBack} onPress={onBack}>
            <Text style={styles.btnBackText}>← Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btnPrimary, { flex: 1 }]}
            onPress={onNext}
          >
            <Text style={styles.btnPrimaryText}>See Summary →</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function AssignCard({ item, people, onAssign }: {
  item: ReceiptItem;
  people: Person[];
  onAssign: (itemId: number, personIdx: number | -1) => void;
}) {
  const isUnassigned = item.assignedTo === null;

  return (
    <View style={[styles.assignCard, SHADOWS.card, isUnassigned && styles.assignCardUnassigned]}>
      <View style={styles.assignCardTop}>
        <Text style={styles.assignCardName} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.assignCardPrice}>{fmt(item.price)}</Text>
      </View>
      <Text style={styles.assignCardHint}>Tap to assign →</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.assignBtnsRow}>
        {/* Per-person buttons */}
        {people.map((p, i) => {
          const isActive = item.assignedTo === i;
          return (
            <TouchableOpacity
              key={i}
              style={[
                styles.assignPersonBtn,
                { borderColor: p.color },
                isActive && { backgroundColor: p.color },
              ]}
              onPress={() => onAssign(item.id, i)}
            >
              <Text style={[styles.assignPersonBtnText, isActive && { color: '#fff' }]}>
                {p.emoji} {p.name}
              </Text>
            </TouchableOpacity>
          );
        })}
        {/* Shared button */}
        <TouchableOpacity
          style={[
            styles.assignPersonBtn,
            { borderColor: '#607D8B' },
            item.assignedTo === -1 && { backgroundColor: '#607D8B' },
          ]}
          onPress={() => onAssign(item.id, -1)}
        >
          <Text style={[styles.assignPersonBtnText, item.assignedTo === -1 && { color: '#fff' }]}>
            ½ Split
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ── Step 4: Summary ───────────────────────────────────────────────

function SummaryStep({ people, summary, receiptItems, onBack, onReset }: {
  people: Person[];
  summary: { totals: number[]; grandTotal: number; totalDiscounts: number };
  receiptItems: ReceiptItem[];
  onBack: () => void;
  onReset: () => void;
}) {
  const { totals, grandTotal, totalDiscounts } = summary;
  const preTaxTotal = receiptItems.filter(i => !i.isDiscount).reduce((s, i) => s + i.price, 0);

  return (
    <ScrollView style={styles.stepContent} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.summaryHero}>💸 Here's who owes what</Text>

      {/* Per-person cards */}
      {people.map((p, i) => (
        <View key={i} style={[styles.summaryPersonCard, { borderLeftColor: p.color }]}>
          <View style={styles.summaryPersonHeader}>
            <Text style={styles.summaryPersonEmoji}>{p.emoji}</Text>
            <Text style={styles.summaryPersonName}>{p.name}</Text>
            <Text style={[styles.summaryPersonTotal, { color: p.color }]}>
              {fmt(totals[i])}
            </Text>
          </View>

          {/* Their items */}
          {receiptItems
            .filter(item => !item.isDiscount && item.assignedTo === i)
            .map(item => (
              <View key={item.id} style={styles.summaryItemRow}>
                <Text style={styles.summaryItemName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.summaryItemPrice}>{fmt(item.price)}</Text>
              </View>
            ))}

          {/* Shared items (their portion) */}
          {receiptItems
            .filter(item => !item.isDiscount && item.assignedTo === -1)
            .map(item => (
              <View key={item.id} style={styles.summaryItemRow}>
                <Text style={[styles.summaryItemName, { color: COLORS.muted }]} numberOfLines={1}>
                  ½ {item.name}
                </Text>
                <Text style={[styles.summaryItemPrice, { color: COLORS.muted }]}>
                  {fmt(item.price / people.length)}
                </Text>
              </View>
            ))}

          {/* Discount saving */}
          {totalDiscounts > 0 && (
            <View style={styles.summaryItemRow}>
              <Text style={[styles.summaryItemName, { color: COLORS.green }]}>🏷️ Discounts applied</Text>
              <Text style={[styles.summaryItemPrice, { color: COLORS.green }]}>
                -{fmt(totalDiscounts * (totals[i] / (grandTotal + totalDiscounts > 0 ? grandTotal + totalDiscounts : 1)))}
              </Text>
            </View>
          )}
        </View>
      ))}

      {/* Grand total */}
      <View style={styles.grandTotalCard}>
        <View style={styles.grandTotalRow}>
          <Text style={styles.grandTotalLabel}>Subtotal</Text>
          <Text style={styles.grandTotalValue}>{fmt(preTaxTotal)}</Text>
        </View>
        {totalDiscounts > 0 && (
          <View style={styles.grandTotalRow}>
            <Text style={[styles.grandTotalLabel, { color: COLORS.green }]}>🏷️ Total discounts</Text>
            <Text style={[styles.grandTotalValue, { color: COLORS.green }]}>-{fmt(totalDiscounts)}</Text>
          </View>
        )}
        <View style={[styles.grandTotalRow, styles.grandTotalFinal]}>
          <Text style={styles.grandTotalFinalLabel}>Total paid</Text>
          <Text style={styles.grandTotalFinalValue}>{fmt(grandTotal)}</Text>
        </View>
      </View>

      {/* Actions */}
      <TouchableOpacity style={styles.btnBack} onPress={onBack}>
        <Text style={styles.btnBackText}>← Edit assignments</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.btnPrimary, { marginTop: 12 }]} onPress={onReset}>
        <Text style={styles.btnPrimaryText}>🔄 Start new receipt</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  headerBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  resetBtn: { fontSize: 14, fontWeight: '700', color: COLORS.red },

  // Step indicator
  stepIndicator: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 24, paddingVertical: 12,
  },
  stepDot: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  stepDotActive: { backgroundColor: COLORS.primary + '25' },
  stepDotText: { fontSize: 16 },
  stepLine: { flex: 1, height: 2, backgroundColor: COLORS.border, marginHorizontal: 4 },
  stepLineActive: { backgroundColor: COLORS.primary },

  // Step 1: Capture
  scanningView: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  receiptPreview: { width: '100%', height: 220, borderRadius: 16 },
  scanningTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text, marginTop: 16 },
  scanningSubtitle: { fontSize: 14, fontWeight: '600', color: COLORS.muted, marginTop: 4 },
  captureContainer: { padding: 24, alignItems: 'center' },
  captureIcon: { fontSize: 64, marginBottom: 12 },
  captureTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 8 },
  captureSubtitle: { fontSize: 14, fontWeight: '600', color: COLORS.muted, textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  captureBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: '#FFF3E0', borderRadius: 16, padding: 18,
    width: '100%', marginBottom: 12,
  },
  captureBtnIcon: { fontSize: 36 },
  captureBtnTitle: { fontSize: 16, fontWeight: '800', color: COLORS.primary },
  captureBtnSub: { fontSize: 13, fontWeight: '600', color: COLORS.muted, marginTop: 2 },
  manualBtn: { paddingVertical: 14, alignItems: 'center' },
  manualBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.muted },
  aiNote: {
    backgroundColor: '#F8F4FF', borderRadius: 12, padding: 12,
    marginTop: 8, width: '100%',
  },
  aiNoteText: { fontSize: 11, fontWeight: '600', color: '#7C3AED', textAlign: 'center' },

  // Step 2: People
  stepContent: { flex: 1, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text, marginTop: 16, marginBottom: 4 },
  sectionSub: { fontSize: 13, fontWeight: '600', color: COLORS.muted, marginBottom: 12 },
  peopleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  personChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 20, borderWidth: 2,
  },
  personChipEmoji: { fontSize: 18 },
  personChipName: { fontSize: 14, fontWeight: '800' },
  addPersonChip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
    borderWidth: 2, borderStyle: 'dashed', borderColor: COLORS.primary,
    alignItems: 'center',
  },
  addPersonText: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  hintText: { fontSize: 11, fontWeight: '600', color: COLORS.muted, marginTop: 6 },

  reviewItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.card, borderRadius: 12,
    padding: 12, marginBottom: 6, gap: 10, ...SHADOWS.card,
  },
  reviewItemDiscount: { backgroundColor: '#F0FDF8', borderWidth: 1, borderColor: COLORS.green + '40' },
  reviewItemName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  discountLabel: { fontSize: 11, fontWeight: '700', color: COLORS.green, marginTop: 2 },
  reviewItemPrice: { fontSize: 15, fontWeight: '800', color: COLORS.primary },
  removeItemBtn: { fontSize: 16, color: COLORS.muted, fontWeight: '700', padding: 4 },
  emptyItems: {
    backgroundColor: COLORS.card, borderRadius: 12, padding: 20,
    alignItems: 'center', marginBottom: 8,
  },
  emptyItemsText: { fontSize: 14, fontWeight: '600', color: COLORS.muted },

  // Step 3: Assign
  quickAssignBar: {
    backgroundColor: COLORS.card, paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  quickAssignLabel: { fontSize: 12, fontWeight: '700', color: COLORS.muted, marginBottom: 8 },
  quickChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16 },
  quickChipText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  assignProgressBar: { paddingVertical: 12 },
  assignProgressText: { fontSize: 13, fontWeight: '700', color: COLORS.muted, marginBottom: 6 },
  progressTrack: { height: 6, backgroundColor: COLORS.border, borderRadius: 3 },
  progressFill: { height: 6, backgroundColor: COLORS.primary, borderRadius: 3 },
  assignCard: {
    backgroundColor: COLORS.card, borderRadius: 16, padding: 14,
    marginBottom: 10, marginTop: 2,
  },
  assignCardUnassigned: { borderWidth: 2, borderColor: '#FFB74D', borderStyle: 'dashed' },
  assignCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  assignCardName: { fontSize: 15, fontWeight: '800', color: COLORS.text, flex: 1, marginRight: 8 },
  assignCardPrice: { fontSize: 16, fontWeight: '800', color: COLORS.primary },
  assignCardHint: { fontSize: 11, fontWeight: '600', color: COLORS.muted, marginBottom: 10 },
  assignBtnsRow: { gap: 8, paddingBottom: 2 },
  assignPersonBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 2,
  },
  assignPersonBtnText: { fontSize: 13, fontWeight: '800', color: COLORS.text },
  discountSection: {
    backgroundColor: '#F0FDF8', borderRadius: 14, padding: 14, marginTop: 8,
    borderWidth: 1, borderColor: COLORS.green + '40',
  },
  discountSectionTitle: { fontSize: 14, fontWeight: '800', color: '#1a7a5e', marginBottom: 4 },
  discountSectionSub: { fontSize: 12, fontWeight: '600', color: COLORS.muted, marginBottom: 10 },
  discountRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  discountRowName: { fontSize: 13, fontWeight: '600', color: COLORS.text, flex: 1 },
  discountRowPrice: { fontSize: 13, fontWeight: '800', color: COLORS.green },
  assignFooter: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.card, padding: 16,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  unassignedWarning: { fontSize: 13, fontWeight: '700', color: '#E65100', textAlign: 'center', marginBottom: 8 },
  assignFooterBtns: { flexDirection: 'row', gap: 10 },
  btnBack: {
    borderWidth: 2, borderColor: COLORS.border, borderRadius: 12,
    paddingVertical: 13, paddingHorizontal: 16, alignItems: 'center',
  },
  btnBackText: { color: COLORS.text, fontWeight: '700', fontSize: 14 },

  // Step 4: Summary
  summaryHero: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginTop: 16, marginBottom: 16, textAlign: 'center' },
  summaryPersonCard: {
    backgroundColor: COLORS.card, borderRadius: 16, padding: 16,
    marginBottom: 12, borderLeftWidth: 4, ...SHADOWS.card,
  },
  summaryPersonHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  summaryPersonEmoji: { fontSize: 24 },
  summaryPersonName: { fontSize: 16, fontWeight: '800', color: COLORS.text, flex: 1 },
  summaryPersonTotal: { fontSize: 22, fontWeight: '800' },
  summaryItemRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 4, borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  summaryItemName: { fontSize: 13, fontWeight: '600', color: COLORS.text, flex: 1, marginRight: 8 },
  summaryItemPrice: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  grandTotalCard: {
    backgroundColor: '#1E1B4B', borderRadius: 16, padding: 18,
    marginBottom: 16, gap: 8,
  },
  grandTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  grandTotalLabel: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  grandTotalValue: { fontSize: 15, fontWeight: '800', color: '#fff' },
  grandTotalFinal: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)', paddingTop: 10, marginTop: 4 },
  grandTotalFinalLabel: { fontSize: 16, fontWeight: '700', color: '#fff' },
  grandTotalFinalValue: { fontSize: 22, fontWeight: '800', color: '#fff' },

  // Shared
  btnPrimary: { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  btnOutline: { borderWidth: 2, borderColor: COLORS.primary, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  btnOutlineText: { color: COLORS.primary, fontWeight: '700', fontSize: 14 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: {
    backgroundColor: COLORS.card, borderTopLeftRadius: 24,
    borderTopRightRadius: 24, padding: 24, paddingBottom: 40,
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '700', color: COLORS.textLight, marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: COLORS.background, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, fontWeight: '600', color: COLORS.text,
    borderWidth: 1, borderColor: COLORS.border, marginBottom: 4,
  },
});