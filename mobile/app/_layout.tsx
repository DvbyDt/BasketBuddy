import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { BasketProvider } from '../shared/BasketContext';
import { initDataSync } from '../shared/datasync';

// ── Splash screen (unchanged from your existing version) ──────────

function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const logoScale   = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const taglineOp   = useRef(new Animated.Value(0)).current;
  const taglineY    = useRef(new Animated.Value(20)).current;
  const dotsOp      = useRef(new Animated.Value(0)).current;
  const screenOp    = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale,   { toValue: 1, friction: 6, tension: 40, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(taglineOp, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(taglineY,  { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
      Animated.timing(dotsOp, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(800),
      Animated.timing(screenOp, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(() => onFinish());
  }, []);

  return (
    <Animated.View style={[styles.splash, { opacity: screenOp }]}>
      <Animated.View style={{ opacity: logoOpacity, transform: [{ scale: logoScale }], alignItems: 'center' }}>
        <Text style={styles.splashEmoji}>🛒</Text>
        <Text style={styles.splashTitle}>
          Basket<Text style={styles.splashAccent}>Buddy</Text>
        </Text>
      </Animated.View>
      <Animated.Text style={[styles.splashTagline, { opacity: taglineOp, transform: [{ translateY: taglineY }] }]}>
        Compare. Save. Shop Smart.
      </Animated.Text>
      <Animated.View style={[styles.dots, { opacity: dotsOp }]}>
        <LoadingDots />
      </Animated.View>
    </Animated.View>
  );
}

function LoadingDots() {
  const d1 = useRef(new Animated.Value(0.3)).current;
  const d2 = useRef(new Animated.Value(0.3)).current;
  const d3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = (d: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.timing(d, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(d, { toValue: 0.3, duration: 300, useNativeDriver: true }),
      ]));
    anim(d1, 0).start();
    anim(d2, 200).start();
    anim(d3, 400).start();
  }, []);

  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {[d1, d2, d3].map((d, i) => (
        <Animated.View key={i} style={[styles.dot, { opacity: d, transform: [{ scale: d }] }]} />
      ))}
    </View>
  );
}

// ── Root layout ───────────────────────────────────────────────────

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);
  const [syncSource, setSyncSource] = useState<string | null>(null);

  // Start data sync in parallel with splash animation.
  // Splash lasts ~2.5 seconds — enough time for the GitHub fetch.
  useEffect(() => {
    initDataSync().then(result => {
      console.log(`[App] Data ready: ${result.itemCount} items from ${result.source}`);
      setSyncSource(result.source);
    });
  }, []);

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  return (
    <BasketProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </BasketProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1, backgroundColor: '#FFF9F0',
    alignItems: 'center', justifyContent: 'center',
  },
  splashEmoji:   { fontSize: 80, marginBottom: 12 },
  splashTitle:   { fontSize: 36, fontWeight: '900', color: '#333' },
  splashAccent:  { color: '#FF6B35' },
  splashTagline: { fontSize: 16, fontWeight: '700', color: '#999', marginTop: 12 },
  dots:          { position: 'absolute', bottom: 120, alignItems: 'center' },
  dot:           { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF6B35' },
});