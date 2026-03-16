/**
 * AISettingsSection.tsx
 *
 * Drop this component into your settings.tsx screen.
 * It saves both keys to AsyncStorage under 'basketbuddy_ai':
 *   { groqKey: "gsk_...", ocrKey: "K81..." }
 *
 * The split.tsx receipt scanner reads these keys automatically.
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, FONTS, RADIUS, SHADOWS, SPACING } from '../shared/theme';

const STORAGE_KEY = 'basketbuddy_ai';

interface AISettings {
  groqKey: string;
  ocrKey:  string;
}

export default function AISettingsSection() {
  const [groqKey, setGroqKey]   = useState('');
  const [ocrKey, setOcrKey]     = useState('');
  const [saved, setSaved]       = useState(false);
  const [showGroq, setShowGroq] = useState(false);
  const [showOcr, setShowOcr]   = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (!raw) return;
      try {
        const s: AISettings = JSON.parse(raw);
        if (s.groqKey) setGroqKey(s.groqKey);
        if (s.ocrKey)  setOcrKey(s.ocrKey);
      } catch {}
    });
  }, []);

  const save = async () => {
    if (!groqKey.trim() && !ocrKey.trim()) {
      Alert.alert('Nothing to save', 'Enter at least one API key.');
      return;
    }
    const settings: AISettings = {
      groqKey: groqKey.trim(),
      ocrKey:  ocrKey.trim(),
      // keep backward compat — some code reads 'key' for groq
      ...(groqKey.trim() ? { key: groqKey.trim() } : {}),
    } as any;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const clear = () => {
    Alert.alert('Clear API Keys', 'Remove all saved API keys?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear', style: 'destructive', onPress: async () => {
          await AsyncStorage.removeItem(STORAGE_KEY);
          setGroqKey('');
          setOcrKey('');
        }
      },
    ]);
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>🤖 AI & Receipt Scanning</Text>

      {/* Groq key */}
      <View style={styles.card}>
        <View style={styles.keyHeader}>
          <View>
            <Text style={styles.keyName}>Groq API Key</Text>
            <Text style={styles.keyDesc}>Basket optimizer + receipt parsing · Free</Text>
          </View>
          <TouchableOpacity onPress={() => Linking.openURL('https://console.groq.com')}>
            <Text style={styles.getKeyLink}>Get free key →</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.keyInput}
            placeholder="gsk_xxxxxxxxxxxxxxxxxxxx"
            placeholderTextColor={COLORS.muted}
            value={groqKey}
            onChangeText={setGroqKey}
            secureTextEntry={!showGroq}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity onPress={() => setShowGroq(v => !v)} style={styles.eyeBtn}>
            <Text style={styles.eyeIcon}>{showGroq ? '🙈' : '👁️'}</Text>
          </TouchableOpacity>
        </View>
        {groqKey.length > 0 && (
          <View style={styles.keyStatus}>
            <Text style={[styles.keyStatusDot, groqKey.startsWith('gsk_') ? styles.dotGreen : styles.dotAmber]} />
            <Text style={styles.keyStatusText}>
              {groqKey.startsWith('gsk_') ? 'Looks valid' : 'Should start with gsk_'}
            </Text>
          </View>
        )}
      </View>

      {/* OCR.space key */}
      <View style={[styles.card, { marginTop: 10 }]}>
        <View style={styles.keyHeader}>
          <View>
            <Text style={styles.keyName}>OCR.space API Key</Text>
            <Text style={styles.keyDesc}>Receipt photo scanning · 25,000/month free</Text>
          </View>
          <TouchableOpacity onPress={() => Linking.openURL('https://ocr.space/ocrapi/freekey')}>
            <Text style={styles.getKeyLink}>Get free key →</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.keyInput}
            placeholder="K81xxxxxxxxxxxxxxx"
            placeholderTextColor={COLORS.muted}
            value={ocrKey}
            onChangeText={setOcrKey}
            secureTextEntry={!showOcr}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity onPress={() => setShowOcr(v => !v)} style={styles.eyeBtn}>
            <Text style={styles.eyeIcon}>{showOcr ? '🙈' : '👁️'}</Text>
          </TouchableOpacity>
        </View>
        {ocrKey.length > 0 && (
          <View style={styles.keyStatus}>
            <Text style={[styles.keyStatusDot, ocrKey.startsWith('K') ? styles.dotGreen : styles.dotAmber]} />
            <Text style={styles.keyStatusText}>
              {ocrKey.startsWith('K') ? 'Looks valid' : 'Should start with K'}
            </Text>
          </View>
        )}
      </View>

      {/* How to get keys — step by step */}
      <View style={styles.howTo}>
        <Text style={styles.howToTitle}>How to get these keys (both free)</Text>

        <Text style={styles.howToSubtitle}>Groq (basket AI + receipt parsing)</Text>
        <StepRow n="1" text="Open console.groq.com in your browser" />
        <StepRow n="2" text="Sign up with Google or GitHub — no credit card" />
        <StepRow n="3" text='Click "API Keys" → "Create API Key"' />
        <StepRow n="4" text='Copy the key starting with "gsk_" and paste above' />

        <Text style={[styles.howToSubtitle, { marginTop: 14 }]}>OCR.space (receipt photo reading)</Text>
        <StepRow n="1" text="Open ocr.space/ocrapi/freekey in your browser" />
        <StepRow n="2" text="Enter your email address and submit" />
        <StepRow n="3" text='Check your email — key arrives in under a minute' />
        <StepRow n="4" text='Key starts with "K" — paste it above' />
      </View>

      {/* Save / Clear buttons */}
      <View style={styles.btnRow}>
        <TouchableOpacity style={[styles.saveBtn, saved && styles.saveBtnDone]} onPress={save}>
          <Text style={styles.saveBtnText}>{saved ? '✓ Saved!' : 'Save Keys'}</Text>
        </TouchableOpacity>
        {(groqKey || ocrKey) && (
          <TouchableOpacity style={styles.clearBtn} onPress={clear}>
            <Text style={styles.clearBtnText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function StepRow({ n, text }: { n: string; text: string }) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepNum}>
        <Text style={styles.stepNumText}>{n}</Text>
      </View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 10 },

  card: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: 14, ...SHADOWS.card },
  keyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  keyName: { fontSize: 14, fontWeight: FONTS.bold, color: COLORS.text },
  keyDesc: { fontSize: 12, fontWeight: FONTS.medium, color: COLORS.muted, marginTop: 2 },
  getKeyLink: { fontSize: 12, fontWeight: FONTS.bold, color: COLORS.primary },

  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  keyInput: {
    flex: 1, backgroundColor: COLORS.background, borderRadius: RADIUS.sm,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 13,
    fontWeight: FONTS.medium, color: COLORS.text,
    borderWidth: 1.5, borderColor: COLORS.border,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  eyeBtn: { padding: 8 },
  eyeIcon: { fontSize: 18 },

  keyStatus: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  keyStatusDot: { width: 8, height: 8, borderRadius: 4 },
  dotGreen: { backgroundColor: COLORS.green },
  dotAmber: { backgroundColor: COLORS.amber },
  keyStatusText: { fontSize: 12, fontWeight: FONTS.medium, color: COLORS.muted },

  howTo: { backgroundColor: COLORS.chipBg, borderRadius: RADIUS.lg, padding: 14, marginTop: 10 },
  howToTitle: { fontSize: 13, fontWeight: FONTS.bold, color: COLORS.text, marginBottom: 10 },
  howToSubtitle: { fontSize: 12, fontWeight: FONTS.bold, color: COLORS.primary, marginBottom: 6 },
  stepRow: { flexDirection: 'row', gap: 10, marginBottom: 6, alignItems: 'flex-start' },
  stepNum: { width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepNumText: { fontSize: 11, fontWeight: FONTS.black, color: '#fff' },
  stepText: { fontSize: 12, fontWeight: FONTS.medium, color: COLORS.muted, flex: 1, lineHeight: 18 },

  btnRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  saveBtn: { flex: 1, backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: 13, alignItems: 'center' },
  saveBtnDone: { backgroundColor: COLORS.green },
  saveBtnText: { color: '#fff', fontWeight: FONTS.bold, fontSize: 14 },
  clearBtn: { borderWidth: 2, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingVertical: 13, paddingHorizontal: 20, alignItems: 'center' },
  clearBtnText: { color: COLORS.muted, fontWeight: FONTS.semibold, fontSize: 14 },
});

// Platform import needed for fontFamily
import { Platform } from 'react-native';