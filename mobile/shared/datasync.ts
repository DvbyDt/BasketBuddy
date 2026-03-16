// ─── shared/dataSync.ts ──────────────────────────────────────────
//
// WHY THIS FILE EXISTS:
//   data.json is bundled into the APK at build time via require('./data.json').
//   That means if the scraper updates prices on Monday, users with the
//   installed APK still see old prices until they install a new APK build.
//
// THE FIX:
//   On startup, fetch fresh data.json from the GitHub raw URL.
//   Cache it in AsyncStorage for 24 hours so it works offline.
//   If fetch fails → fall back to bundled data.json (always available).
//
// RESULT:
//   Barcode scanner, Compare, Basket, Offers → all use the same live data.
//   Prices update automatically when the GitHub Actions scraper runs.
//   No new APK build needed just for price updates.
//
// USAGE (in app/_layout.tsx):
//   import { initDataSync } from '../shared/dataSync';
//   await initDataSync();   // call once before rendering tabs
//

import AsyncStorage from '@react-native-async-storage/async-storage';
import { items as bundledItems, stores as bundledStores } from './store';
import type { Item, Store } from './types';

// ── Config ────────────────────────────────────────────────────────
// Change REPO_OWNER/REPO_NAME/BRANCH to match your GitHub repo.

const REPO_OWNER = 'DvbyDt';
const REPO_NAME  = 'BasketBuddy';
const BRANCH     = 'main';

const DATA_URL = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/mobile/shared/data.json`;
const OFFERS_URL = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/mobile/shared/offers.json`;

const CACHE_KEY_DATA   = 'basketbuddy_live_data';
const CACHE_KEY_OFFERS = 'basketbuddy_live_offers';
const CACHE_TTL_MS     = 24 * 60 * 60 * 1000;  // 24 hours

// ── Types ─────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;  // unix ms
}

interface LiveData {
  stores: Store[];
  items:  Item[];
}

// ── Internal state ────────────────────────────────────────────────

let _syncDone    = false;
let _lastFetchAt = 0;

// ── Cache helpers ─────────────────────────────────────────────────

async function readCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    const age = Date.now() - entry.fetchedAt;
    if (age > CACHE_TTL_MS) return null;   // stale
    return entry.data;
  } catch {
    return null;
  }
}

async function writeCache<T>(key: string, data: T): Promise<void> {
  try {
    const entry: CacheEntry<T> = { data, fetchedAt: Date.now() };
    await AsyncStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // AsyncStorage failure is non-fatal
  }
}

// ── Apply live data to in-memory arrays ───────────────────────────
//
// The items array exported from store.ts is mutable — we replace its
// contents in-place so every screen that imported it sees fresh data.

function applyLiveData(liveData: LiveData): void {
  // Replace items array contents in-place
  items.splice(0, items.length, ...liveData.items);

  // Update stores (less likely to change but keep in sync)
  stores.splice(0, stores.length, ...liveData.stores);
}

// We import mutable arrays from store.ts
import { items, stores } from './store';

// ── Main sync function ────────────────────────────────────────────

/**
 * Fetches fresh data from GitHub and updates the in-memory item/store arrays.
 *
 * Strategy:
 *   1. Try AsyncStorage cache (valid for 24h) — instant, works offline
 *   2. Try fetch from GitHub — fresh data, updates cache
 *   3. Fall back to bundled require('./data.json') — always works
 *
 * Call this once in app/_layout.tsx before the tabs render.
 */
export async function initDataSync(): Promise<{
  source: 'cache' | 'network' | 'bundle';
  itemCount: number;
}> {
  if (_syncDone) {
    return { source: 'cache', itemCount: items.length };
  }

  // ── 1. Try reading from AsyncStorage cache ───────────────────
  const cached = await readCache<LiveData>(CACHE_KEY_DATA);
  if (cached) {
    console.log(`[DataSync] Using cached data (${cached.items.length} items)`);
    applyLiveData(cached);
    _syncDone = true;

    // Fetch fresh in background (don't await — don't block startup)
    fetchAndCacheInBackground();
    return { source: 'cache', itemCount: cached.items.length };
  }

  // ── 2. Try fetching from GitHub ──────────────────────────────
  try {
    const liveData = await fetchFromGitHub();
    applyLiveData(liveData);
    await writeCache(CACHE_KEY_DATA, liveData);
    _syncDone    = true;
    _lastFetchAt = Date.now();
    console.log(`[DataSync] Fetched live data (${liveData.items.length} items)`);
    return { source: 'network', itemCount: liveData.items.length };

  } catch (err) {
    // ── 3. Fall back to bundled data ─────────────────────────
    console.warn('[DataSync] GitHub fetch failed, using bundled data:', err);
    _syncDone = true;
    // bundled data is already loaded via store.ts imports
    return { source: 'bundle', itemCount: items.length };
  }
}

async function fetchFromGitHub(): Promise<LiveData> {
  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), 8000); // 8 second timeout

  try {
    const resp = await fetch(DATA_URL, {
      signal: controller.signal,
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json: LiveData = await resp.json();
    if (!json.items || !Array.isArray(json.items)) {
      throw new Error('Invalid data.json format');
    }
    return json;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchAndCacheInBackground(): Promise<void> {
  // Only re-fetch if last fetch was > 1 hour ago
  if (Date.now() - _lastFetchAt < 60 * 60 * 1000) return;

  try {
    const liveData = await fetchFromGitHub();
    applyLiveData(liveData);
    await writeCache(CACHE_KEY_DATA, liveData);
    _lastFetchAt = Date.now();
    console.log(`[DataSync] Background refresh complete (${liveData.items.length} items)`);
  } catch {
    // Silent fail — we already have cached/bundled data
  }
}

// ── Force refresh (call on pull-to-refresh) ───────────────────────

/**
 * Forces a fresh fetch from GitHub, bypassing the cache.
 * Call this when user pulls to refresh on any screen.
 */
export async function forceRefresh(): Promise<{
  success: boolean;
  itemCount: number;
}> {
  try {
    const liveData = await fetchFromGitHub();
    applyLiveData(liveData);
    await writeCache(CACHE_KEY_DATA, liveData);
    _lastFetchAt = Date.now();
    return { success: true, itemCount: liveData.items.length };
  } catch {
    return { success: false, itemCount: items.length };
  }
}

// ── Sync status ───────────────────────────────────────────────────

export function getLastSyncTime(): Date | null {
  return _lastFetchAt > 0 ? new Date(_lastFetchAt) : null;
}

export function isSyncDone(): boolean {
  return _syncDone;
}