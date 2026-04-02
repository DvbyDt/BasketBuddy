/**
 * split.tsx — Receipt Splitter
 *
 * TECH STACK (all free):
 *   OCR.space API  → reads text from receipt photo (free key from ocr.space/ocrapi)
 *   Groq API       → parses raw OCR text into clean items (free key from console.groq.com)
 *   expo-image-picker → camera + gallery access (already installed)
 *
 * FLOW:
 *   1. Capture — take photo or upload
 *   2. Scan    — OCR.space reads text, Groq parses items
 *   3. People  — enter names of everyone splitting
 *   4. Assign  — tap each item, tap a person to assign it
 *   5. Summary — who owes what, discounts split proportionally
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList, ScrollView,
  TouchableOpacity, StyleSheet,
  Alert, Modal, KeyboardAvoidingView, Platform,
  ActivityIndicator, Image, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, SHADOWS, RADIUS, FONTS, SPACING } from '../../shared/theme';
import { fmt } from '../../shared/store';
import { scanReceiptLocal } from '../../shared/localReceiptScanner';

// ── Types ─────────────────────────────────────────────────────────

interface ReceiptItem {
  id: number;
  name: string;
  price: number;      // total line price (unitPrice × quantity)
  unitPrice: number;  // price per single unit
  quantity: number;   // units on this line
  isDiscount: boolean;
  assignedTo: number | null; // person index | -1 = shared equally | null = unassigned
}

interface Person {
  name: string;
  emoji: string;
  color: string;
}

type Step = 'capture' | 'people' | 'assign' | 'summary';

const PERSON_EMOJIS = ['🧍', '👤', '🙋', '🧑', '👱', '🧔'];
const PERSON_COLORS = ['#3A86FF', '#2D6A4F', '#9B5DE5', '#FF6B35', '#FF9800', '#00BCD4'];

// ── OCR + Parse pipeline ─────────────────────────────────────────
//
// Groq Vision reads the image and parses items in a single API call.
// Works in Expo Go — no native modules, no Cloud Functions.

async function scanReceiptWithOCR(
  imageBase64: string,
  onStatus: (msg: string, step: number) => void
): Promise<ReceiptItem[]> {
  const scanned = await scanReceiptLocal(imageBase64, onStatus);
  return scanned.map((item, i) => ({
    id:         i + 1,
    name:       item.name,
    price:      item.price,
    unitPrice:  item.unitPrice,
    quantity:   item.quantity,
    isDiscount: item.isDiscount,
    assignedTo: null,
  }));
}

// ── Main Screen ───────────────────────────────────────────────────

export default function SplitScreen() {
  const [step, setStep]                   = useState<Step>('capture');
  const [imageUri, setImageUri]           = useState<string | null>(null);
  const [scanning, setScanning]           = useState(false);
  const [scanStatus, setScanStatus]       = useState('');
  const [scanStep, setScanStep]           = useState(0); // 0=idle 1=ocr 2=groq 3=done
  const [receiptItems, setReceiptItems]   = useState<ReceiptItem[]>([]);
  const [people, setPeople]               = useState<Person[]>([]);
  const [newPersonName, setNewPersonName] = useState('');
  const [showAddItem, setShowAddItem]     = useState(false);
  const [newItemName, setNewItemName]     = useState('');
  const [newItemPrice, setNewItemPrice]   = useState('');
  const [nextId, setNextId]               = useState(1);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);

  // ── Capture ──────────────────────────────────────────────────────

  const pickCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow camera access to scan receipts.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      base64: true,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      await doScan(result.assets[0].base64 ?? '');
    }
  };

  const pickGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.8,
      base64: true,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      await doScan(result.assets[0].base64 ?? '');
    }
  };

  const doScan = async (base64: string) => {
    setScanning(true);
    setScanStep(1);
    setScanStatus('Reading receipt…');

    try {
      const items = await scanReceiptWithOCR(base64, (msg, step) => {
        setScanStatus(msg);
        setScanStep(step);
      });

      setScanStep(3);
      setScanStatus(`✅ Found ${items.length} items!`);
      setReceiptItems(items);
      setNextId(items.length + 1);

      await delay(800);
      setStep('people');

    } catch (e: any) {
      const msg = e.message ?? 'Unknown error';

      Alert.alert(
        'Scan failed',
        msg,
        [{ text: 'Add items manually', onPress: () => { setReceiptItems([]); setStep('people'); } }]
      );
    } finally {
      setScanning(false);
      setScanStep(0);
      setScanStatus('');
    }
  };

  // ── People ───────────────────────────────────────────────────────

  const addPerson = () => {
    const name = newPersonName.trim();
    if (!name) return;
    if (people.length >= 6) {
      Alert.alert('Max 6 people');
      return;
    }
    const idx = people.length;
    setPeople(prev => [...prev, {
      name,
      emoji: PERSON_EMOJIS[idx] ?? '🧑',
      color: PERSON_COLORS[idx] ?? '#607D8B',
    }]);
    setNewPersonName('');
  };

  const removePerson = (idx: number) => {
    setPeople(prev => prev.filter((_, i) => i !== idx));
    setReceiptItems(prev =>
      prev.map(item =>
        item.assignedTo === idx ? { ...item, assignedTo: null } :
        item.assignedTo !== null && item.assignedTo > idx
          ? { ...item, assignedTo: item.assignedTo - 1 }
          : item
      )
    );
  };

  // ── Items ────────────────────────────────────────────────────────

  const addItemManually = () => {
    const name  = newItemName.trim();
    const price = parseFloat(newItemPrice);
    if (!name || isNaN(price) || price === 0) {
      Alert.alert('Invalid', 'Enter a valid name and price');
      return;
    }
    setReceiptItems(prev => [...prev, {
      id: nextId, name,
      price:     Math.abs(price),
      unitPrice: Math.abs(price),
      quantity:  1,
      isDiscount: price < 0,
      assignedTo: null,
    }]);
    setNextId(n => n + 1);
    setNewItemName('');
    setNewItemPrice('');
    setShowAddItem(false);
  };

  // ── Assign ───────────────────────────────────────────────────────

  const assignItem = (itemId: number, personIdx: number | -1) => {
    setReceiptItems(prev =>
      prev.map(item =>
        item.id === itemId
          ? { ...item, assignedTo: item.assignedTo === personIdx ? null : personIdx }
          : item
      )
    );
    setSelectedItemId(null); // collapse after assigning
  };

  const assignAll = (personIdx: number | -1) => {
    setReceiptItems(prev => prev.map(item =>
      item.isDiscount ? item : { ...item, assignedTo: personIdx }
    ));
  };

  const regularItems   = receiptItems.filter(i => !i.isDiscount);
  const discountItems  = receiptItems.filter(i => i.isDiscount);
  const unassigned     = regularItems.filter(i => i.assignedTo === null).length;
  const assigned       = regularItems.length - unassigned;

  // ── Summary ──────────────────────────────────────────────────────

  const computeSummary = useCallback(() => {
    const totals: number[] = people.map(() => 0);
    let totalBill      = 0;
    let totalDiscounts = 0;

    receiptItems.forEach(item => {
      if (item.isDiscount) { totalDiscounts += item.price; return; }
      if (item.assignedTo === null) return;

      if (item.assignedTo === -1) {
        // Shared equally among all people
        const share = item.price / people.length;
        totals.forEach((_, i) => { totals[i] += share; });
      } else {
        totals[item.assignedTo] += item.price;
      }
      totalBill += item.price;
    });

    // Distribute discounts proportionally
    // Person who spent more gets more of the discount
    if (totalDiscounts > 0 && totalBill > 0) {
      totals.forEach((total, i) => {
        const proportion = total / totalBill;
        totals[i] = Math.max(0, total - totalDiscounts * proportion);
      });
    }

    return {
      totals,
      grandTotal:     totals.reduce((s, t) => s + t, 0),
      totalDiscounts,
      subtotal:       totalBill,
    };
  }, [receiptItems, people]);

  const resetAll = () => {
    Alert.alert('Start over?', 'This will clear everything.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Start over', style: 'destructive',
        onPress: () => {
          setStep('capture');
          setImageUri(null);
          setReceiptItems([]);
          setPeople([]);
        }
      },
    ]);
  };

  // ── Render ───────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🧾 Receipt Splitter</Text>
        {step !== 'capture' && (
          <TouchableOpacity onPress={resetAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.resetText}>Reset</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Step progress indicator */}
      {step !== 'capture' && <StepBar current={step} />}

      {/* ── STEP 1: Capture ── */}
      {step === 'capture' && (
        <CaptureStep
          scanning={scanning}
          scanStatus={scanStatus}
          scanStep={scanStep}
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
          newPersonName={newPersonName}
          onNewPersonNameChange={setNewPersonName}
          onAddPerson={addPerson}
          onRemovePerson={removePerson}
          onAddItem={() => setShowAddItem(true)}
          onRemoveItem={id => setReceiptItems(prev => prev.filter(i => i.id !== id))}
          onNext={() => {
            if (people.length < 2) {
              Alert.alert('Need at least 2 people', 'Add at least 2 people to split the bill.');
              return;
            }
            if (regularItems.length === 0) {
              Alert.alert('No items', 'Add at least one item to split.');
              return;
            }
            setStep('assign');
          }}
        />
      )}

      {/* ── STEP 3: Assign items ── */}
      {step === 'assign' && (
        <AssignStep
          regularItems={regularItems}
          discountItems={discountItems}
          people={people}
          assigned={assigned}
          unassigned={unassigned}
          selectedItemId={selectedItemId}
          onSelectItem={id => setSelectedItemId(prev => prev === id ? null : id)}
          onAssign={assignItem}
          onAssignAll={assignAll}
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

      {/* Add item modal */}
      <Modal visible={showAddItem} transparent animationType="slide" onRequestClose={() => setShowAddItem(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>➕ Add Item</Text>
            <Text style={styles.inputLabel}>Item name</Text>
            <TextInput
              style={styles.input} placeholder="e.g. Whole Milk 2L"
              placeholderTextColor={COLORS.muted} value={newItemName}
              onChangeText={setNewItemName} autoFocus
            />
            <Text style={styles.inputLabel}>Price (negative = discount, e.g. -0.50)</Text>
            <TextInput
              style={styles.input} placeholder="1.99"
              placeholderTextColor={COLORS.muted} keyboardType="decimal-pad"
              value={newItemPrice} onChangeText={setNewItemPrice}
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

// ── Step Progress Bar ─────────────────────────────────────────────

function StepBar({ current }: { current: Step }) {
  const steps = [
    { key: 'capture', icon: '📷', label: 'Scan' },
    { key: 'people',  icon: '👥', label: 'People' },
    { key: 'assign',  icon: '✏️', label: 'Assign' },
    { key: 'summary', icon: '💸', label: 'Done' },
  ] as const;
  const idx = steps.findIndex(s => s.key === current);
  return (
    <View style={styles.stepBar}>
      {steps.map((s, i) => (
        <React.Fragment key={s.key}>
          <View style={styles.stepItem}>
            <View style={[styles.stepCircle, i <= idx && styles.stepCircleActive]}>
              <Text style={{ fontSize: 15 }}>{s.icon}</Text>
            </View>
            <Text style={[styles.stepLabel, i <= idx && styles.stepLabelActive]}>{s.label}</Text>
          </View>
          {i < steps.length - 1 && (
            <View style={[styles.stepLine, i < idx && styles.stepLineActive]} />
          )}
        </React.Fragment>
      ))}
    </View>
  );
}

// ── Step 1: Capture ───────────────────────────────────────────────

function CaptureStep({ scanning, scanStatus, scanStep, imageUri, onCamera, onGallery, onManual }: {
  scanning: boolean; scanStatus: string; scanStep: number;
  imageUri: string | null; onCamera: () => void; onGallery: () => void; onManual: () => void;
}) {
  if (scanning) {
    return (
      <View style={styles.scanView}>
        {imageUri && <Image source={{ uri: imageUri }} style={styles.scanThumb} resizeMode="contain" />}
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 24 }} />
        <Text style={styles.scanStatusText}>{scanStatus}</Text>

        {/* Pipeline steps */}
        <View style={styles.pipeline}>
          <PipelineStep icon="📷" label="Captured"   done={scanStep >= 1} active={scanStep === 1} />
          <View style={styles.pipelineLine} />
          <PipelineStep icon="🤖" label="Groq Vision" done={scanStep >= 2} active={scanStep === 2} />
          <View style={styles.pipelineLine} />
          <PipelineStep icon="✅" label="Parsing"     done={scanStep >= 3} active={scanStep === 3} />
        </View>
        <Text style={styles.freeLabel}>Powered by Groq Vision AI</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.captureScroll} showsVerticalScrollIndicator={false}>
      <Text style={styles.captureHeroIcon}>🧾</Text>
      <Text style={styles.captureHeroTitle}>Split Your Receipt</Text>
      <Text style={styles.captureHeroSub}>
        Take a photo of your receipt — we'll extract every item automatically using free AI tools.
      </Text>

      <TouchableOpacity style={styles.captureCard} onPress={onCamera} activeOpacity={0.85}>
        <View style={[styles.captureCardIcon, { backgroundColor: '#FFF3E0' }]}>
          <Text style={{ fontSize: 30 }}>📷</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.captureCardTitle}>Take a Photo</Text>
          <Text style={styles.captureCardSub}>Open camera and snap your receipt</Text>
        </View>
        <Text style={styles.captureCardArrow}>→</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.captureCard, { marginTop: 10, backgroundColor: '#F3E8FF' }]} onPress={onGallery} activeOpacity={0.85}>
        <View style={[styles.captureCardIcon, { backgroundColor: '#EDE9FE' }]}>
          <Text style={{ fontSize: 30 }}>🖼️</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.captureCardTitle, { color: '#7C3AED' }]}>Upload Image</Text>
          <Text style={styles.captureCardSub}>Choose from your photo library</Text>
        </View>
        <Text style={[styles.captureCardArrow, { color: '#7C3AED' }]}>→</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.manualLink} onPress={onManual}>
        <Text style={styles.manualLinkText}>✏️ Enter items manually instead</Text>
      </TouchableOpacity>

      {/* Tips for good results */}
      <View style={styles.tipsCard}>
        <Text style={styles.tipsTitle}>📸 Tips for best results</Text>
        <TipRow text="Lay the receipt flat on a surface" />
        <TipRow text="Good lighting — avoid shadows across text" />
        <TipRow text="Hold camera directly above, not at an angle" />
        <TipRow text="Make sure all items are visible in frame" />
      </View>

      {/* Keys needed */}
      <View style={styles.keysCard}>
        <Text style={styles.keysTitle}>🔒 Privacy</Text>
        <Text style={styles.keysNote}>
          Your receipt image is processed to extract items. We don’t ask you for API keys.
        </Text>
      </View>
    </ScrollView>
  );
}

function PipelineStep({ icon, label, done, active }: { icon: string; label: string; done?: boolean; active?: boolean }) {
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <View style={[
        styles.pipelineCircle,
        done && { backgroundColor: COLORS.green + '30' },
        active && { backgroundColor: COLORS.primary + '20' },
      ]}>
        <Text style={{ fontSize: 16 }}>{icon}</Text>
      </View>
      <Text style={[styles.pipelineLabel, done && { color: COLORS.green }, active && { color: COLORS.primary }]}>
        {label}
      </Text>
    </View>
  );
}

function TipRow({ text }: { text: string }) {
  return (
    <View style={styles.tipRow}>
      <Text style={styles.tipDot}>•</Text>
      <Text style={styles.tipText}>{text}</Text>
    </View>
  );
}

// ── Step 2: People ────────────────────────────────────────────────

function PeopleStep({ people, receiptItems, newPersonName, onNewPersonNameChange,
  onAddPerson, onRemovePerson, onAddItem, onRemoveItem, onNext }: {
  people: Person[]; receiptItems: ReceiptItem[];
  newPersonName: string; onNewPersonNameChange: (v: string) => void;
  onAddPerson: () => void; onRemovePerson: (i: number) => void;
  onAddItem: () => void; onRemoveItem: (id: number) => void;
  onNext: () => void;
}) {
  const regular   = receiptItems.filter(i => !i.isDiscount);
  const discounts = receiptItems.filter(i => i.isDiscount);

  return (
    <ScrollView style={styles.stepContent} contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>

      {/* Add people */}
      <Text style={styles.sectionTitle}>👥 Who's splitting?</Text>
      <Text style={styles.sectionHint}>Add everyone sharing this bill (min. 2)</Text>

      {/* Input row */}
      <View style={styles.addPersonRow}>
        <TextInput
          style={styles.addPersonInput}
          placeholder="Enter a name…"
          placeholderTextColor={COLORS.muted}
          value={newPersonName}
          onChangeText={onNewPersonNameChange}
          onSubmitEditing={onAddPerson}
          returnKeyType="done"
        />
        <TouchableOpacity
          style={[styles.addPersonBtn, !newPersonName.trim() && { opacity: 0.4 }]}
          onPress={onAddPerson}
          disabled={!newPersonName.trim()}
        >
          <Text style={styles.addPersonBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {/* People pills */}
      {people.length > 0 && (
        <View style={styles.peopleWrap}>
          {people.map((p, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.personPill, { borderColor: p.color, backgroundColor: p.color + '18' }]}
              onLongPress={() => onRemovePerson(i)}
            >
              <Text style={styles.personEmoji}>{p.emoji}</Text>
              <Text style={[styles.personName, { color: p.color }]}>{p.name}</Text>
              <TouchableOpacity
                onPress={() => onRemovePerson(i)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.personRemove, { color: p.color }]}>✕</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {people.length < 2 && (
        <Text style={styles.validationHint}>
          {people.length === 0 ? '👆 Add at least 2 people above' : '👆 Add one more person'}
        </Text>
      )}

      <View style={styles.divider} />

      {/* Receipt items review */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>
          🧾 Receipt Items ({regular.length})
        </Text>
        {discounts.length > 0 && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountBadgeText}>🏷️ {discounts.length} discounts</Text>
          </View>
        )}
      </View>
      <Text style={styles.sectionHint}>Review and remove any misread items</Text>

      {receiptItems.length === 0 ? (
        <View style={styles.emptyItems}>
          <Text style={{ fontSize: 32, marginBottom: 8 }}>📝</Text>
          <Text style={styles.emptyItemsText}>No items yet</Text>
          <Text style={styles.emptyItemsSub}>Scan a receipt above or add manually</Text>
        </View>
      ) : (
        receiptItems.map(item => (
          <View key={item.id} style={[styles.reviewItem, item.isDiscount && styles.reviewItemDiscount]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.reviewItemName} numberOfLines={1}>{item.name}</Text>
              {item.isDiscount && <Text style={styles.reviewDiscountLabel}>🏷️ Discount — shared proportionally</Text>}
            </View>
            <Text style={[styles.reviewItemPrice, item.isDiscount && { color: COLORS.green }]}>
              {item.isDiscount ? `-${fmt(item.price)}` : fmt(item.price)}
            </Text>
            <TouchableOpacity onPress={() => onRemoveItem(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.reviewRemove}>✕</Text>
            </TouchableOpacity>
          </View>
        ))
      )}

      <TouchableOpacity style={[styles.btnOutline, { marginTop: 12 }]} onPress={onAddItem}>
        <Text style={styles.btnOutlineText}>+ Add item manually</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btnPrimary, { marginTop: 16, opacity: (people.length >= 2 && regular.length > 0) ? 1 : 0.4 }]}
        onPress={onNext}
        disabled={people.length < 2 || regular.length === 0}
      >
        <Text style={styles.btnPrimaryText}>
          Assign {regular.length} Items →
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ── Step 3: Assign ────────────────────────────────────────────────

function AssignStep({ regularItems, discountItems, people, assigned, unassigned,
  selectedItemId, onSelectItem, onAssign, onAssignAll, onNext, onBack }: {
  regularItems: ReceiptItem[]; discountItems: ReceiptItem[];
  people: Person[]; assigned: number; unassigned: number;
  selectedItemId: number | null;
  onSelectItem: (id: number) => void;
  onAssign: (itemId: number, personIdx: number | -1) => void;
  onAssignAll: (personIdx: number | -1) => void;
  onNext: () => void; onBack: () => void;
}) {
  const progress = regularItems.length > 0 ? assigned / regularItems.length : 0;

  return (
    <View style={{ flex: 1 }}>
      {/* Quick assign strip */}
      <View style={styles.quickBar}>
        <Text style={styles.quickBarLabel}>Quick assign all →</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
          {people.map((p, i) => (
            <TouchableOpacity key={i} style={[styles.quickChip, { backgroundColor: p.color }]} onPress={() => onAssignAll(i)}>
              <Text style={styles.quickChipText}>{p.emoji} {p.name}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[styles.quickChip, { backgroundColor: '#607D8B' }]} onPress={() => onAssignAll(-1)}>
            <Text style={styles.quickChipText}>½ Split equally</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <FlatList
        data={regularItems}
        keyExtractor={i => String(i.id)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.progressWrap}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressText}>{assigned}/{regularItems.length} assigned</Text>
              {unassigned === 0 && <Text style={styles.progressDone}>✅ All done!</Text>}
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` as any }]} />
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const isSelected = selectedItemId === item.id;
          const assignedPerson = item.assignedTo === -1
            ? { name: 'Split equally', emoji: '½', color: '#607D8B' }
            : item.assignedTo !== null
              ? people[item.assignedTo]
              : null;

          return (
            <TouchableOpacity
              style={[styles.assignCard, SHADOWS.card, item.assignedTo === null && styles.assignCardUnassigned]}
              onPress={() => onSelectItem(item.id)}
              activeOpacity={0.85}
            >
              {/* Item row */}
              <View style={styles.assignCardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.assignCardName} numberOfLines={1}>{item.name}</Text>
                  {assignedPerson && (
                    <Text style={[styles.assignedLabel, { color: assignedPerson.color }]}>
                      {assignedPerson.emoji} {assignedPerson.name}
                    </Text>
                  )}
                  {!assignedPerson && (
                    <Text style={styles.tapToAssign}>Tap to assign →</Text>
                  )}
                </View>
                <Text style={styles.assignCardPrice}>{fmt(item.price)}</Text>
                <Text style={styles.expandIcon}>{isSelected ? '▲' : '▼'}</Text>
              </View>

              {/* People buttons — only shown when item is selected */}
              {isSelected && (
                <View style={styles.assignButtons}>
                  {people.map((p, i) => {
                    const active = item.assignedTo === i;
                    return (
                      <TouchableOpacity
                        key={i}
                        style={[styles.assignBtn, { borderColor: p.color }, active && { backgroundColor: p.color }]}
                        onPress={() => onAssign(item.id, i)}
                      >
                        <Text style={styles.assignBtnEmoji}>{p.emoji}</Text>
                        <Text style={[styles.assignBtnName, active && { color: '#fff' }]}>{p.name}</Text>
                        {active && <Text style={styles.assignBtnCheck}>✓</Text>}
                      </TouchableOpacity>
                    );
                  })}
                  {/* Split equally button */}
                  <TouchableOpacity
                    style={[styles.assignBtn, { borderColor: '#607D8B' }, item.assignedTo === -1 && { backgroundColor: '#607D8B' }]}
                    onPress={() => onAssign(item.id, -1)}
                  >
                    <Text style={styles.assignBtnEmoji}>½</Text>
                    <Text style={[styles.assignBtnName, item.assignedTo === -1 && { color: '#fff' }]}>Split</Text>
                    {item.assignedTo === -1 && <Text style={styles.assignBtnCheck}>✓</Text>}
                  </TouchableOpacity>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
        ListFooterComponent={
          discountItems.length > 0 ? (
            <View style={styles.discountBox}>
              <Text style={styles.discountBoxTitle}>🏷️ {discountItems.length} discount{discountItems.length > 1 ? 's' : ''} detected</Text>
              <Text style={styles.discountBoxSub}>Automatically split based on each person's share of the bill</Text>
              {discountItems.map(d => (
                <View key={d.id} style={styles.discountBoxRow}>
                  <Text style={styles.discountBoxName} numberOfLines={1}>{d.name}</Text>
                  <Text style={styles.discountBoxPrice}>-{fmt(d.price)}</Text>
                </View>
              ))}
            </View>
          ) : null
        }
      />

      {/* Footer */}
      <View style={styles.assignFooter}>
        {unassigned > 0 && (
          <Text style={styles.unassignedWarn}>
            ⚠️ {unassigned} item{unassigned > 1 ? 's' : ''} not assigned — will be excluded from totals
          </Text>
        )}
        <View style={styles.footerBtns}>
          <TouchableOpacity style={styles.btnBack} onPress={onBack}>
            <Text style={styles.btnBackText}>← Back</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btnPrimary, { flex: 1 }]} onPress={onNext}>
            <Text style={styles.btnPrimaryText}>See Summary →</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ── Step 4: Summary ───────────────────────────────────────────────

function SummaryStep({ people, summary, receiptItems, onBack, onReset }: {
  people: Person[];
  summary: { totals: number[]; grandTotal: number; totalDiscounts: number; subtotal: number };
  receiptItems: ReceiptItem[];
  onBack: () => void; onReset: () => void;
}) {
  const { totals, grandTotal, totalDiscounts, subtotal } = summary;

  const handleShare = () => {
    const lines: string[] = ['🧾 BasketBuddy Receipt Split\n'];
    people.forEach((p, i) => {
      lines.push(`${p.emoji} ${p.name}: €${totals[i].toFixed(2)}`);
      const myItems   = receiptItems.filter(it => !it.isDiscount && it.assignedTo === i);
      const halfItems = receiptItems.filter(it => !it.isDiscount && it.assignedTo === -1);
      myItems.forEach(it => lines.push(`   ${it.name} — €${it.price.toFixed(2)}`));
      halfItems.forEach(it => lines.push(`   ½ ${it.name} — €${(it.price / people.length).toFixed(2)}`));
      lines.push('');
    });
    lines.push(`Total paid: €${grandTotal.toFixed(2)}`);
    if (totalDiscounts > 0) lines.push(`Savings: -€${totalDiscounts.toFixed(2)}`);
    Share.share({ message: lines.join('\n') });
  };

  return (
    <ScrollView style={styles.stepContent} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <Text style={styles.summaryTitle}>💸 Here's who owes what</Text>

      {people.map((p, i) => {
        const myItems   = receiptItems.filter(item => !item.isDiscount && item.assignedTo === i);
        const halfItems = receiptItems.filter(item => !item.isDiscount && item.assignedTo === -1);
        const myDiscount = totalDiscounts > 0 && grandTotal > 0
          ? totalDiscounts * (totals[i] / (grandTotal + totalDiscounts * (totals[i] / (grandTotal || 1))))
          : 0;

        return (
          <View key={i} style={[styles.summaryCard, { borderLeftColor: p.color }]}>
            <View style={styles.summaryCardHeader}>
              <Text style={styles.summaryCardEmoji}>{p.emoji}</Text>
              <Text style={styles.summaryCardName}>{p.name}</Text>
              <Text style={[styles.summaryCardTotal, { color: p.color }]}>{fmt(totals[i])}</Text>
            </View>

            {myItems.map(item => (
              <View key={item.id} style={styles.summaryLine}>
                <Text style={styles.summaryLineName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.summaryLinePrice}>{fmt(item.price)}</Text>
              </View>
            ))}

            {halfItems.map(item => (
              <View key={item.id} style={styles.summaryLine}>
                <Text style={[styles.summaryLineName, { color: COLORS.muted }]} numberOfLines={1}>½ {item.name}</Text>
                <Text style={[styles.summaryLinePrice, { color: COLORS.muted }]}>{fmt(item.price / people.length)}</Text>
              </View>
            ))}

            {totalDiscounts > 0 && (
              <View style={styles.summaryLine}>
                <Text style={[styles.summaryLineName, { color: COLORS.green }]}>🏷️ Discount applied</Text>
                <Text style={[styles.summaryLinePrice, { color: COLORS.green }]}>-{fmt(myDiscount)}</Text>
              </View>
            )}
          </View>
        );
      })}

      {/* Grand total dark card */}
      <View style={styles.grandCard}>
        <View style={styles.grandRow}>
          <Text style={styles.grandLabel}>Subtotal</Text>
          <Text style={styles.grandValue}>{fmt(subtotal)}</Text>
        </View>
        {totalDiscounts > 0 && (
          <View style={styles.grandRow}>
            <Text style={[styles.grandLabel, { color: '#6EE7B7' }]}>🏷️ Total discounts</Text>
            <Text style={[styles.grandValue, { color: '#6EE7B7' }]}>-{fmt(totalDiscounts)}</Text>
          </View>
        )}
        <View style={[styles.grandRow, styles.grandFinal]}>
          <Text style={styles.grandFinalLabel}>Total paid</Text>
          <Text style={styles.grandFinalValue}>{fmt(grandTotal)}</Text>
        </View>
      </View>

      {/* Share row */}
      <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
        <Text style={styles.shareBtnText}>📤 Share split with group</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.btnBack, { marginTop: 10 }]} onPress={onBack}>
        <Text style={styles.btnBackText}>← Edit assignments</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.btnPrimary, { marginTop: 10 }]} onPress={onReset}>
        <Text style={styles.btnPrimaryText}>🔄 Start new receipt</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ── Helpers ───────────────────────────────────────────────────────

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ── Styles ────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  headerTitle: { fontSize: 22, fontWeight: FONTS.bold, color: COLORS.text },
  resetText: { fontSize: 14, fontWeight: FONTS.semibold, color: COLORS.red },

  // Step bar
  stepBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  stepItem: { alignItems: 'center', gap: 4 },
  stepCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.divider, alignItems: 'center', justifyContent: 'center' },
  stepCircleActive: { backgroundColor: COLORS.primary + '22' },
  stepLabel: { fontSize: 10, fontWeight: FONTS.semibold, color: COLORS.muted },
  stepLabelActive: { color: COLORS.primary },
  stepLine: { flex: 1, height: 2, backgroundColor: COLORS.border, marginHorizontal: 4, marginBottom: 16 },
  stepLineActive: { backgroundColor: COLORS.primary },

  // Scan view
  scanView: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  scanThumb: { width: '100%', height: 180, borderRadius: 16, marginBottom: 8 },
  scanStatusText: { fontSize: 16, fontWeight: FONTS.bold, color: COLORS.text, marginTop: 16, marginBottom: 20 },
  pipeline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pipelineLine: { width: 28, height: 2, backgroundColor: COLORS.border },
  pipelineCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.divider, alignItems: 'center', justifyContent: 'center' },
  pipelineLabel: { fontSize: 11, fontWeight: FONTS.semibold, color: COLORS.muted, marginTop: 4 },
  freeLabel: { fontSize: 12, fontWeight: FONTS.medium, color: COLORS.muted, marginTop: 16 },

  // Capture step
  captureScroll: { padding: 20, alignItems: 'center' },
  captureHeroIcon: { fontSize: 64, marginBottom: 12 },
  captureHeroTitle: { fontSize: 24, fontWeight: FONTS.black, color: COLORS.text, marginBottom: 8 },
  captureHeroSub: { fontSize: 14, fontWeight: FONTS.medium, color: COLORS.muted, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  captureCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: COLORS.card, borderRadius: 16, padding: 18, width: '100%', ...SHADOWS.card },
  captureCardIcon: { width: 56, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  captureCardTitle: { fontSize: 16, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 2 },
  captureCardSub: { fontSize: 13, fontWeight: FONTS.medium, color: COLORS.muted },
  captureCardArrow: { fontSize: 20, fontWeight: FONTS.bold, color: COLORS.primary },
  manualLink: { paddingVertical: 16 },
  manualLinkText: { fontSize: 14, fontWeight: FONTS.semibold, color: COLORS.muted },
  tipsCard: { backgroundColor: COLORS.card, borderRadius: 16, padding: 16, width: '100%', marginBottom: 12, ...SHADOWS.card },
  tipsTitle: { fontSize: 14, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 10 },
  tipRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  tipDot: { fontSize: 14, color: COLORS.primary, fontWeight: FONTS.bold },
  tipText: { fontSize: 13, fontWeight: FONTS.medium, color: COLORS.muted, flex: 1, lineHeight: 20 },
  keysCard: { backgroundColor: '#F0FDF4', borderRadius: 16, padding: 16, width: '100%', borderWidth: 1, borderColor: '#BBF7D0' },
  keysTitle: { fontSize: 14, fontWeight: FONTS.bold, color: '#166534', marginBottom: 10 },
  keyRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  keyName: { fontSize: 13, fontWeight: FONTS.bold, color: '#15803D' },
  keyUrl: { fontSize: 12, fontWeight: FONTS.medium, color: '#166534' },
  keysNote: { fontSize: 12, fontWeight: FONTS.medium, color: '#15803D', marginTop: 6 },

  // People step
  stepContent: { flex: 1, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 16, fontWeight: FONTS.bold, color: COLORS.text, marginTop: 20, marginBottom: 4 },
  sectionHint: { fontSize: 12, fontWeight: FONTS.medium, color: COLORS.muted, marginBottom: 12 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 4 },
  addPersonRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  addPersonInput: { flex: 1, backgroundColor: COLORS.card, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontWeight: FONTS.medium, color: COLORS.text, borderWidth: 1.5, borderColor: COLORS.border },
  addPersonBtn: { backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 18, justifyContent: 'center' },
  addPersonBtnText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 14 },
  peopleWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  personPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 2 },
  personEmoji: { fontSize: 16 },
  personName: { fontSize: 14, fontWeight: FONTS.bold },
  personRemove: { fontSize: 12, fontWeight: FONTS.bold, marginLeft: 2 },
  validationHint: { fontSize: 13, fontWeight: FONTS.semibold, color: COLORS.amber, marginBottom: 8 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 16 },
  discountBadge: { backgroundColor: '#F0FDF4', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#BBF7D0' },
  discountBadgeText: { fontSize: 11, fontWeight: FONTS.bold, color: '#166534' },
  reviewItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 12, padding: 12, marginBottom: 6, gap: 10, ...SHADOWS.card },
  reviewItemDiscount: { backgroundColor: '#F0FDF8', borderWidth: 1, borderColor: '#6EE7B7' },
  reviewItemName: { fontSize: 14, fontWeight: FONTS.semibold, color: COLORS.text },
  reviewDiscountLabel: { fontSize: 11, fontWeight: FONTS.bold, color: COLORS.green, marginTop: 2 },
  reviewItemPrice: { fontSize: 15, fontWeight: FONTS.bold, color: COLORS.primary },
  reviewRemove: { fontSize: 15, color: COLORS.muted, fontWeight: FONTS.bold, padding: 4 },
  emptyItems: { backgroundColor: COLORS.card, borderRadius: 14, padding: 28, alignItems: 'center', ...SHADOWS.card },
  emptyItemsText: { fontSize: 15, fontWeight: FONTS.bold, color: COLORS.text },
  emptyItemsSub: { fontSize: 13, fontWeight: FONTS.medium, color: COLORS.muted, marginTop: 4 },

  // Assign step
  quickBar: { backgroundColor: COLORS.card, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  quickBarLabel: { fontSize: 11, fontWeight: FONTS.bold, color: COLORS.muted, marginBottom: 8 },
  quickChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  quickChipText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 13 },
  progressWrap: { paddingVertical: 14 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressText: { fontSize: 13, fontWeight: FONTS.semibold, color: COLORS.muted },
  progressDone: { fontSize: 13, fontWeight: FONTS.bold, color: COLORS.green },
  progressTrack: { height: 6, backgroundColor: COLORS.border, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: COLORS.primary, borderRadius: 3 },
  assignCard: { backgroundColor: COLORS.card, borderRadius: 16, padding: 14, marginBottom: 10 },
  assignCardUnassigned: { borderWidth: 2, borderColor: '#FCD34D', borderStyle: 'dashed' },
  assignCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  assignCardName: { fontSize: 15, fontWeight: FONTS.bold, color: COLORS.text, flex: 1 },
  assignedLabel: { fontSize: 12, fontWeight: FONTS.semibold, marginTop: 2 },
  tapToAssign: { fontSize: 12, fontWeight: FONTS.medium, color: COLORS.muted, marginTop: 2 },
  assignCardPrice: { fontSize: 15, fontWeight: FONTS.bold, color: COLORS.primary },
  expandIcon: { fontSize: 12, color: COLORS.muted, fontWeight: FONTS.bold },
  assignButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  assignBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 2, borderColor: COLORS.border },
  assignBtnEmoji: { fontSize: 14 },
  assignBtnName: { fontSize: 13, fontWeight: FONTS.bold, color: COLORS.text },
  assignBtnCheck: { fontSize: 12, color: '#fff', marginLeft: 2 },
  discountBox: { backgroundColor: '#F0FDF8', borderRadius: 14, padding: 14, marginTop: 8, borderWidth: 1, borderColor: '#6EE7B7' },
  discountBoxTitle: { fontSize: 14, fontWeight: FONTS.bold, color: '#166534', marginBottom: 4 },
  discountBoxSub: { fontSize: 12, fontWeight: FONTS.medium, color: '#15803D', marginBottom: 10 },
  discountBoxRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderTopWidth: 1, borderTopColor: '#BBF7D0' },
  discountBoxName: { fontSize: 13, fontWeight: FONTS.medium, color: COLORS.text, flex: 1 },
  discountBoxPrice: { fontSize: 13, fontWeight: FONTS.bold, color: COLORS.green },
  assignFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.card, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, borderTopWidth: 1, borderTopColor: COLORS.border },
  unassignedWarn: { fontSize: 13, fontWeight: FONTS.semibold, color: '#D97706', textAlign: 'center', marginBottom: 8 },
  footerBtns: { flexDirection: 'row', gap: 10 },

  // Summary
  summaryTitle: { fontSize: 20, fontWeight: FONTS.black, color: COLORS.text, textAlign: 'center', marginTop: 16, marginBottom: 16 },
  summaryCard: { backgroundColor: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 12, borderLeftWidth: 4, ...SHADOWS.card },
  summaryCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  summaryCardEmoji: { fontSize: 24 },
  summaryCardName: { fontSize: 16, fontWeight: FONTS.bold, color: COLORS.text, flex: 1 },
  summaryCardTotal: { fontSize: 22, fontWeight: FONTS.black },
  summaryLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderTopWidth: 1, borderTopColor: COLORS.border },
  summaryLineName: { fontSize: 13, fontWeight: FONTS.medium, color: COLORS.text, flex: 1, marginRight: 8 },
  summaryLinePrice: { fontSize: 13, fontWeight: FONTS.semibold, color: COLORS.text },
  grandCard: { backgroundColor: COLORS.primaryDark, borderRadius: 16, padding: 18, marginBottom: 16, gap: 8 },
  grandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  grandLabel: { fontSize: 14, fontWeight: FONTS.medium, color: 'rgba(255,255,255,0.65)' },
  grandValue: { fontSize: 15, fontWeight: FONTS.bold, color: '#fff' },
  grandFinal: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)', paddingTop: 10, marginTop: 4 },
  grandFinalLabel: { fontSize: 16, fontWeight: FONTS.semibold, color: '#fff' },
  grandFinalValue: { fontSize: 24, fontWeight: FONTS.black, color: '#fff' },
  shareBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 16,
  },
  shareBtnText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 15 },

  // Shared
  btnPrimary: { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  btnPrimaryText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 15 },
  btnOutline: { borderWidth: 2, borderColor: COLORS.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  btnOutlineText: { color: COLORS.primary, fontWeight: FONTS.semibold, fontSize: 14 },
  btnBack: { borderWidth: 2, borderColor: COLORS.border, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 16, alignItems: 'center' },
  btnBackText: { color: COLORS.text, fontWeight: FONTS.semibold, fontSize: 14 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: { backgroundColor: COLORS.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 16 },
  inputLabel: { fontSize: 12, fontWeight: FONTS.bold, color: COLORS.textSecondary, marginBottom: 6, marginTop: 8 },
  input: { backgroundColor: COLORS.background, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, fontWeight: FONTS.medium, color: COLORS.text, borderWidth: 1.5, borderColor: COLORS.border, marginBottom: 4 },
});