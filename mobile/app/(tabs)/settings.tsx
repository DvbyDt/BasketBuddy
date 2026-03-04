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
  Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, SHADOWS } from '../../shared/theme';
import { stores, Store } from '../../shared/store';

const AI_STORAGE_KEY = 'basketbuddy_ai';
const STORES_STORAGE_KEY = 'basketbuddy_custom_stores';

type AIProvider = 'groq' | 'anthropic' | 'none';

interface AISettings {
  provider: AIProvider;
  key: string;
}

export default function SettingsScreen() {
  // AI settings
  const [provider, setProvider] = useState<AIProvider>('groq');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  // Custom stores
  const [customStores, setCustomStores] = useState<Store[]>([]);
  const [showAddStore, setShowAddStore] = useState(false);
  const [newStoreName, setNewStoreName] = useState('');

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const aiJson = await AsyncStorage.getItem(AI_STORAGE_KEY);
      if (aiJson) {
        const ai: AISettings = JSON.parse(aiJson);
        setProvider(ai.provider);
        setApiKey(ai.key || '');
      }
      const storesJson = await AsyncStorage.getItem(STORES_STORAGE_KEY);
      if (storesJson) {
        setCustomStores(JSON.parse(storesJson));
      }
    } catch {}
  };

  const saveAI = async () => {
    if (provider !== 'none' && !apiKey.trim()) {
      Alert.alert('Missing Key', 'Enter your API key first!');
      return;
    }
    try {
      await AsyncStorage.setItem(
        AI_STORAGE_KEY,
        JSON.stringify({ provider, key: apiKey.trim() })
      );
      Alert.alert('Saved', 'AI settings saved!');
    } catch {
      Alert.alert('Error', 'Failed to save settings');
    }
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

  const builtInStoreIds = ['tesco', 'lidl', 'aldi', 'asian', 'supervalue'];

  const providerInfo: Record<string, { label: string; placeholder: string; help: string }> = {
    groq: {
      label: 'Groq API Key',
      placeholder: 'gsk_...',
      help: '💡 Groq is completely free — sign up at console.groq.com, create an API key. No credit card needed.',
    },
    anthropic: {
      label: 'Anthropic API Key',
      placeholder: 'sk-ant-...',
      help: '💡 Anthropic Claude Haiku — very cheap (~€0.003 for 90 items). Get key at console.anthropic.com.',
    },
    none: {
      label: '',
      placeholder: '',
      help: '⚠️ AI features disabled. Receipt scanning and basket optimizer will use demo mode.',
    },
  };

  const current = providerInfo[provider];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.headerTitle}>⚙️ Settings</Text>

        {/* ── AI Provider ────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🤖 AI Provider</Text>
          <View style={styles.card}>
            <View style={styles.providerRow}>
              {(['groq', 'anthropic', 'none'] as AIProvider[]).map(p => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.providerChip,
                    provider === p && styles.providerChipActive,
                  ]}
                  onPress={() => setProvider(p)}
                >
                  <Text
                    style={[
                      styles.providerChipText,
                      provider === p && styles.providerChipTextActive,
                    ]}
                  >
                    {p === 'groq' ? '⚡ Groq (Free)' : p === 'anthropic' ? '🧠 Claude' : '❌ None'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.helpBox}>
              <Text style={styles.helpText}>{current.help}</Text>
            </View>

            {provider !== 'none' && (
              <>
                <Text style={styles.label}>{current.label}</Text>
                <View style={styles.keyRow}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder={current.placeholder}
                    placeholderTextColor={COLORS.muted}
                    value={apiKey}
                    onChangeText={setApiKey}
                    secureTextEntry={!showKey}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    style={styles.eyeBtn}
                    onPress={() => setShowKey(!showKey)}
                  >
                    <Text style={{ fontSize: 18 }}>{showKey ? '🙈' : '👁️'}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            <TouchableOpacity style={styles.btnPrimary} onPress={saveAI}>
              <Text style={styles.btnPrimaryText}>💾 Save AI Settings</Text>
            </TouchableOpacity>
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
  providerRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  providerChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  providerChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.chipBg,
  },
  providerChipText: { fontSize: 12, fontWeight: '700', color: COLORS.muted },
  providerChipTextActive: { color: COLORS.primary },
  helpBox: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  helpText: { fontSize: 12, fontWeight: '600', color: COLORS.textLight, lineHeight: 18 },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textLight,
    marginBottom: 6,
  },
  keyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  eyeBtn: {
    padding: 8,
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
});
