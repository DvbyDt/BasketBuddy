// ─── BasketBuddy Design System ───────────────────────────────────
// Single source of truth for all visual tokens.
// Every color, shadow, radius and animation lives here.

import { Dimensions } from 'react-native';

// ── Responsive scale ─────────────────────────────────────────────
// rs(size) linearly interpolates from a 390px design reference.
// Use for font sizes, padding, and icon sizes that should scale with
// the device width rather than staying fixed.
const BASE_W = 390; // iPhone 15 Pro / design reference

export function rs(size: number): number {
  const { width } = Dimensions.get('window');
  return Math.round(size * (width / BASE_W));
}

export const COLORS = {
  // ── Brand ─────────────────────────────────────────────────────
  primary:      '#2D6A4F',   // Deep forest green — trust + savings
  primaryLight: '#40916C',   // Hover state
  primaryDark:  '#1B4332',   // Pressed state
  accent:       '#FF6B35',   // Warm orange — energy + action
  accentLight:  '#FF8F5E',

  // ── Surfaces ──────────────────────────────────────────────────
  background:   '#F8FAF8',   // Very light green-tinted white
  card:         '#FFFFFF',
  cardElevated: '#FAFFFE',   // Slightly tinted card for variety
  overlay:      'rgba(0,0,0,0.45)',

  // ── Text ──────────────────────────────────────────────────────
  text:         '#1A2E1A',   // Near black with green tint
  textSecondary:'#4A6741',   // Muted green-grey for secondary text
  textLight:    '#7A9E7E',   // Placeholder / hint text (FIXED — was white before)
  muted:        '#9BB59C',   // Disabled / very subtle

  // ── Borders ───────────────────────────────────────────────────
  border:       '#E4EDE4',
  borderFocus:  '#2D6A4F',
  divider:      '#F0F5F0',

  // ── Semantic ──────────────────────────────────────────────────
  green:        '#52B788',   // Success / savings
  greenDark:    '#1B7A4A',
  red:          '#E63946',   // Warning / expensive
  amber:        '#F4A261',   // Medium price
  blue:         '#3A86FF',   // Info

  // ── Store Brand Colors ─────────────────────────────────────────
  tesco:        '#EE1C25',
  lidl:         '#0050AA',
  aldi:         '#FF6600',
  asian:        '#9B5DE5',
  supervalue:   '#06D6A0',

  // ── Savings UI ────────────────────────────────────────────────
  savingBg:     '#E8F5E0',   // Soft green background for saving pills
  savingText:   '#2D6A4F',

  // ── Special UI ────────────────────────────────────────────────
  chipBg:       '#EDF5EE',   // Search chip background
  chipText:     '#2D6A4F',
  badgeBg:      '#FFF0EB',   // Offer badge background
  splash:       '#FFF9F0',   // Splash screen bg

  // ── Gradient stops (use with LinearGradient) ───────────────────
  gradientStart: '#2D6A4F',
  gradientEnd:   '#52B788',
  heroStart:     '#1B4332',
  heroEnd:       '#40916C',
};

export const SHADOWS = {
  // Layered realistic shadows — no single-value elevation
  card: {
    shadowColor: '#1A2E1A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHover: {
    shadowColor: '#1A2E1A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  float: {
    shadowColor: '#1A2E1A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 8,
  },
  button: {
    shadowColor: '#2D6A4F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
};

export const RADIUS = {
  xs:   6,
  sm:   10,
  md:   14,
  lg:   20,
  xl:   28,
  full: 999,
};

export const FONTS = {
  // Font weights as named constants for consistency
  regular:     '400' as const,
  medium:      '600' as const,
  semibold:    '700' as const,
  bold:        '800' as const,
  black:       '900' as const,
};

export const SPACING = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  xxl:  28,
  page: 16,   // standard page horizontal padding
};

// ── Animation durations (ms) ─────────────────────────────────────
export const ANIMATION = {
  fast:   150,
  normal: 250,
  slow:   400,
  spring: { friction: 7, tension: 40 },
};

// ── Store config (single source of truth) ────────────────────────
export const STORE_CONFIG: Record<string, { color: string; emoji: string; name: string }> = {
  tesco:      { color: COLORS.tesco,      emoji: '🔴', name: 'Tesco' },
  lidl:       { color: COLORS.lidl,       emoji: '🔵', name: 'Lidl' },
  aldi:       { color: COLORS.aldi,       emoji: '🟠', name: 'Aldi' },
  asian:      { color: COLORS.asian,      emoji: '🟣', name: 'Asian Supermarket' },
  supervalue: { color: COLORS.supervalue, emoji: '🟢', name: 'Super Value' },
};