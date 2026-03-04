// ─── Theme constants for BasketBuddy ─────────────────────────────
export const COLORS = {
  background: '#FFF9F0',
  card: '#FFFFFF',
  primary: '#FF6B35',
  primaryDark: '#E55A28',
  green: '#06D6A0',
  red: '#FF4444',
  orange: '#FF6B35',
  muted: '#999',
  text: '#333',
  textLight: '#666',
  border: '#F0EDE8',
  chipBg: '#FFF0E8',
  savingBg: '#E8FDF6',

  // Store colors
  tesco: '#EE1C25',
  lidl: '#0050AA',
  aldi: '#FF6600',
  asian: '#9B5DE5',
  supervalue: '#06D6A0',
} as const;

export const FONTS = {
  title: { fontSize: 22, fontWeight: '800' as const, color: COLORS.text },
  subtitle: { fontSize: 16, fontWeight: '700' as const, color: COLORS.text },
  body: { fontSize: 14, fontWeight: '600' as const, color: COLORS.text },
  caption: { fontSize: 12, fontWeight: '600' as const, color: COLORS.muted },
  price: { fontSize: 20, fontWeight: '800' as const },
};

export const SHADOWS = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
};
