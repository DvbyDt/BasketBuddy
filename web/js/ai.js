// ─── js/ai.js ────────────────────────────────────────────────────
// Central AI module — supports Groq (free) and Anthropic (paid).
// Groq runs Llama 3.3 for free at console.groq.com — no credit card.
// Settings are saved to localStorage so they persist across sessions.

// ✅ Production hardening:
// AI calls are proxied via Firebase Cloud Functions so users are never asked for API keys.
// Configure this if you deploy Functions to a region/project:
//   window.BASKETBUDDY_FUNCTIONS_BASE_URL = "https://<region>-<project>.cloudfunctions.net";
const FUNCTIONS_BASE_URL =
  window.BASKETBUDDY_FUNCTIONS_BASE_URL ||
  'http://localhost:5001/basketbuddy-e6676/us-central1';

const AI_PROVIDERS = {
  groq: {
    name: 'Groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.3-70b-versatile',
    keyPrefix: 'gsk_',
    keyPlaceholder: 'gsk_...',
    keyLabel: 'Groq API Key (free at console.groq.com)',
    helpText: '💡 <strong>Groq is completely free</strong> — sign up at console.groq.com, create an API key, paste it above. No credit card needed. Runs Llama 3.3 for free.',
    buildHeaders: (key) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    }),
    buildBody: (systemPrompt, userPrompt, maxTokens) => JSON.stringify({
      model: AI_PROVIDERS.groq.model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    }),
    extractText: (data) => data.choices?.[0]?.message?.content || ''
  },
  anthropic: {
    name: 'Anthropic Claude',
    url: 'https://api.anthropic.com/v1/messages',
    model: 'claude-haiku-4-5-20251001',
    keyPrefix: 'sk-ant-',
    keyPlaceholder: 'sk-ant-...',
    keyLabel: 'Anthropic API Key (console.anthropic.com)',
    helpText: '💡 Anthropic Claude Haiku — very cheap (~$0.003 for all 90 items). Get key at console.anthropic.com.',
    buildHeaders: (key) => ({
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    }),
    buildBody: (systemPrompt, userPrompt, maxTokens) => JSON.stringify({
      model: AI_PROVIDERS.anthropic.model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    }),
    extractText: (data) => data.content?.map(c => c.text || '').join('') || ''
  }
};

// ── Settings persistence ──────────────────────────────────────────

function loadAISettings() {
  try {
    return JSON.parse(localStorage.getItem('basketbuddy_ai') || '{}');
  } catch { return {}; }
}

function saveAISettings() {
  updateAIStatusPill();
  showToast('✅ AI is enabled automatically');
}

function loadAISettingsIntoForm() {
  const s = loadAISettings();
  const providerEl = document.getElementById('aiProvider');
  const keyEl = document.getElementById('aiApiKey');
  if (providerEl && s.provider) providerEl.value = s.provider;
  if (keyEl && s.key) keyEl.value = s.key;
  onAIProviderChange();
}

function onAIProviderChange() {
  const providerEl = document.getElementById('aiProvider');
  if (!providerEl) return;
  const keyRow   = document.getElementById('aiKeyRow');
  const keyLabel = document.getElementById('aiKeyLabel');
  const keyHelp  = document.getElementById('aiKeyHelp');
  const keyInput = document.getElementById('aiApiKey');

  // AI is always enabled via backend proxy. No user API keys.
  if (keyRow) keyRow.style.display = 'none';
  if (keyLabel) keyLabel.textContent = 'AI (managed by BasketBuddy)';
  if (keyInput) keyInput.value = '';
  if (keyHelp) keyHelp.innerHTML = '✅ AI is enabled automatically. You don’t need to paste any API keys.';
}

function updateAIStatusPill() {
  const pill = document.getElementById('aiStatusPill');
  if (!pill) return;
  pill.textContent = '⚡ AI enabled';
  pill.style.background = 'rgba(6,214,160,0.3)';
}

function showAISettings() {
  // Jump to settings tab
  const btn = document.querySelectorAll('.nav-btn')[4];
  showPage('add', btn);
  setTimeout(() => {
    document.getElementById('aiProvider')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 200);
}

// ── Core AI call ──────────────────────────────────────────────────

async function callAI(systemPrompt, userPrompt, maxTokens = 800) {
  // Route all text-only prompts through your backend.
  const prompt = `${systemPrompt}\n\n${userPrompt}`;
  await ensureWebAuth();
  const token = await fbAuth.currentUser.getIdToken();

  const response = await fetch(`${FUNCTIONS_BASE_URL}/aiGroqComplete`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ prompt, maxTokens }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
  return data.content || '';
}

// ── AI: Receipt scanning ──────────────────────────────────────────
// For receipt scanning we need vision — only Anthropic supports images.
// Groq doesn't support image input, so we use Anthropic for this one feature.

async function callAnthropicVision(base64Image, mediaType) {
  // Web currently supports receipt scanning via the backend OCR+Groq pipeline.
  // Keep this function for backward compatibility with older UI flows.
  await ensureWebAuth();
  const token = await fbAuth.currentUser.getIdToken();
  const response = await fetch(`${FUNCTIONS_BASE_URL}/aiScanReceipt`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ imageBase64: base64Image }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
  return JSON.stringify((data.items || []).map(i => ({ name: i.name, price: i.price })));
}

// ── AI: Basket optimiser ──────────────────────────────────────────

async function getBasketInsight(basketSummary) {
  const systemPrompt = `You are a friendly Dublin grocery shopping assistant. Give very short, punchy money-saving tips. Max 2 sentences. Use € not $.`;
  const userPrompt   = `My basket: ${basketSummary}. Give me one smart tip to save money.`;
  return await callAI(systemPrompt, userPrompt, 150);
}

// ── AI: Price query generation (for scraper) ──────────────────────

async function generateSearchQuery(itemName, category, quantity) {
  const systemPrompt = `You generate short grocery search queries for Tesco.ie and Lidl.ie. Fix typos. Return only JSON.`;
  const userPrompt   = `Item: "${itemName}", Category: "${category}", Qty: "${quantity || 'unknown'}". Return: {"tesco":"query","lidl":"query"}. No markdown.`;
  const raw = await callAI(systemPrompt, userPrompt, 80);
  return JSON.parse(raw.replace(/```json|```/g, '').trim());
}
