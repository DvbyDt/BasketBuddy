// ─── shared/aiFeatures.ts ────────────────────────────────────────
// All AI-powered features using only Groq (100% free).
// Every function here costs €0.00 per call.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Item, BasketItem } from './types';

const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL    = 'llama-3.3-70b-versatile';

// ── Core Groq caller ─────────────────────────────────────────────

async function callGroq(prompt: string, maxTokens = 300): Promise<string> {
  const stored = await AsyncStorage.getItem('basketbuddy_ai');
  const settings = stored ? JSON.parse(stored) : {};
  const key = settings.groqKey || settings.key;
  if (!key) throw new Error('NO_KEY');

  const resp = await fetch(GROQ_API, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      temperature: 0.7,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await resp.json();
  return data.choices?.[0]?.message?.content ?? '';
}

// ── 1. Smart Basket Tips ─────────────────────────────────────────
// Analyses your basket and gives personalized money-saving advice.
// Shown on the Basket screen after optimisation.

export async function getBasketTip(
  basket: BasketItem[],
  totalSaving: number
): Promise<string> {
  if (basket.length === 0) return '';

  const summary = basket
    .map(b => `${b.name} (${b.store}, €${b.price.toFixed(2)})`)
    .join(', ');

  const prompt = `You're a friendly Dublin grocery shopping assistant. Be concise and specific.

Basket: ${summary}
Potential savings by store switching: €${totalSaving.toFixed(2)}

Give ONE specific, actionable money-saving tip for this exact basket. Max 2 sentences. 
Use Dublin context (Tesco, Lidl, Aldi prices). Use € not $. Be punchy and friendly.`;

  return await callGroq(prompt, 120);
}

// ── 2. Price Trend Prediction ────────────────────────────────────
// Predicts whether a price will go up or down next week.
// Uses the 5-week history to spot patterns.

export async function predictPriceTrend(
  itemName: string,
  history: number[],  // 5 weeks of prices
  currentPrice: number,
  store: string
): Promise<{ direction: 'up' | 'down' | 'stable'; confidence: 'high' | 'medium' | 'low'; reason: string }> {
  const trend = history.length >= 2
    ? history[history.length - 1] - history[0]
    : 0;

  const prompt = `Analyze this grocery price trend for ${itemName} at ${store} in Ireland.

Price history (oldest → newest): ${history.map(p => `€${p.toFixed(2)}`).join(' → ')}
Current price: €${currentPrice.toFixed(2)}
5-week change: ${trend >= 0 ? '+' : ''}€${trend.toFixed(2)}

Based purely on this trend, predict next week's price direction.
Respond ONLY with this JSON (no markdown):
{"direction":"up|down|stable","confidence":"high|medium|low","reason":"one short sentence"}`;

  try {
    const raw = await callGroq(prompt, 80);
    const clean = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch {
    // Fallback: simple rule-based prediction
    if (trend > 0.05) return { direction: 'up', confidence: 'medium', reason: 'Prices have been rising steadily.' };
    if (trend < -0.05) return { direction: 'down', confidence: 'medium', reason: 'Prices have been falling.' };
    return { direction: 'stable', confidence: 'high', reason: 'Price has been consistent recently.' };
  }
}

// ── 3. Weekly Budget Planner ─────────────────────────────────────
// Given a budget and typical shopping list, suggests the optimal 
// store combination to stay within budget.

export async function planWeeklyBudget(
  budget: number,
  basket: BasketItem[],
  currentTotal: number
): Promise<string> {
  const over = currentTotal > budget;
  const diff = Math.abs(currentTotal - budget).toFixed(2);

  const items = basket.map(b => `${b.name}: €${b.price.toFixed(2)} at ${b.store}`).join('\n');

  const prompt = `Weekly grocery budget planner for Dublin shopper.

Budget: €${budget.toFixed(2)}
Current basket total: €${currentTotal.toFixed(2)} (${over ? `€${diff} OVER` : `€${diff} under`})

Basket items:
${items}

${over
  ? `Give 2-3 specific suggestions to reduce spending by €${diff} or more. Be practical.`
  : `Confirm they're on track and suggest 1 smart tip to save even more.`
}
Max 3 sentences. Use Dublin store names. Be encouraging. Use € not $.`;

  return await callGroq(prompt, 150);
}

// ── 4. Meal Deal Suggester ───────────────────────────────────────
// Looks at what's in the basket and suggests complementary items
// that would complete a meal, from the cheapest store.

export async function suggestMealItems(
  basket: BasketItem[],
  availableItems: Item[]
): Promise<{ suggestion: string; itemIds: number[] }> {
  const basketNames = basket.map(b => b.name).join(', ');
  const availableNames = availableItems
    .slice(0, 30) // limit to avoid huge prompts
    .map(i => `${i.id}:${i.name}`)
    .join(', ');

  const prompt = `You're a Dublin grocery shopping assistant helping complete a meal.

Items already in basket: ${basketNames}

Available items in the database (id:name): ${availableNames}

Based on what's in the basket, suggest 2-3 complementary items that would complete a meal.
Only suggest items from the available list above.

Respond ONLY with this JSON (no markdown):
{"suggestion":"one friendly sentence about the meal idea","itemIds":[id1,id2]}`;

  try {
    const raw = await callGroq(prompt, 120);
    const clean = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch {
    return { suggestion: '', itemIds: [] };
  }
}

// ── 5. Smart Price Alert Checker ────────────────────────────────
// Compares current prices to last week's and alerts on big changes.
// Runs locally — no API needed for this one.

export function detectPriceAlerts(items: Item[]): {
  itemName: string;
  store: string;
  oldPrice: number;
  newPrice: number;
  change: number;
  type: 'drop' | 'spike';
}[] {
  const alerts = [];

  for (const item of items) {
    for (const [storeId, history] of Object.entries(item.history || {})) {
      if (!Array.isArray(history) || history.length < 2) continue;
      const prev = history[history.length - 2];
      const curr = history[history.length - 1];
      const change = ((curr - prev) / prev) * 100;

      if (Math.abs(change) >= 5) { // 5% threshold
        alerts.push({
          itemName: item.name,
          store: storeId,
          oldPrice: prev,
          newPrice: curr,
          change: Math.round(change),
          type: change < 0 ? 'drop' as const : 'spike' as const,
        });
      }
    }
  }

  return alerts.sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, 5);
}

// ── 6. Shopping Habit Insights ───────────────────────────────────
// Analyses basket history from AsyncStorage and gives insights.

export async function getShoppingInsights(): Promise<string> {
  const stored = await AsyncStorage.getItem('basketbuddy_history');
  if (!stored) return '';

  const history = JSON.parse(stored) as { date: string; total: number; stores: string[] }[];
  if (history.length < 3) return '';

  const avgTotal = history.reduce((s, h) => s + h.total, 0) / history.length;
  const storeCounts: Record<string, number> = {};
  history.forEach(h => h.stores.forEach(s => { storeCounts[s] = (storeCounts[s] || 0) + 1; }));
  const favStore = Object.entries(storeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'mixed stores';

  const prompt = `Grocery shopping insights for a Dublin shopper.

Average weekly spend: €${avgTotal.toFixed(2)}
Favourite store: ${favStore}
Shopping sessions tracked: ${history.length}

Give 1 encouraging insight about their shopping habits and 1 specific tip to save more.
Max 2 sentences. Be warm and specific. Use € not $.`;

  return await callGroq(prompt, 120);
}

// ── 7. "Is it worth the trip?" Calculator ───────────────────────
// Tells you if the savings at a different store justify going there.
// Pure logic — no AI needed.

export function isWorthTheTrip(
  savingAmount: number,
  extraDistanceKm: number,
  fuelCostPerKm = 0.15 // average Ireland fuel cost per km
): { worthIt: boolean; fuelCost: number; netSaving: number; verdict: string } {
  const fuelCost   = extraDistanceKm * 2 * fuelCostPerKm; // return trip
  const netSaving  = savingAmount - fuelCost;
  const worthIt    = netSaving > 0.50; // worth it if you save at least 50c after fuel

  let verdict = '';
  if (netSaving > 5)    verdict = '🚗 Definitely worth the trip!';
  else if (netSaving > 1) verdict = '✅ Worth it if you\'re passing anyway';
  else if (netSaving > 0) verdict = '🤷 Marginal — only if very close';
  else                    verdict = '❌ Fuel costs more than you\'d save';

  return { worthIt, fuelCost: Math.round(fuelCost * 100) / 100, netSaving: Math.round(netSaving * 100) / 100, verdict };
}

// ── Cache helper ──────────────────────────────────────────────────
// Cache AI responses for 24 hours to avoid redundant calls

const AI_CACHE_KEY = 'basketbuddy_ai_cache';

export async function getCachedOrFetch(
  cacheKey: string,
  fetcher: () => Promise<string>,
  ttlHours = 24
): Promise<string> {
  try {
    const stored = await AsyncStorage.getItem(AI_CACHE_KEY);
    const cache = stored ? JSON.parse(stored) : {};
    const entry = cache[cacheKey];

    if (entry && Date.now() - entry.ts < ttlHours * 3600 * 1000) {
      return entry.value;
    }

    const value = await fetcher();
    cache[cacheKey] = { value, ts: Date.now() };
    await AsyncStorage.setItem(AI_CACHE_KEY, JSON.stringify(cache));
    return value;
  } catch {
    return fetcher();
  }
}