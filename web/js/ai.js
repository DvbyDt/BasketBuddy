// ─── js/ai.js ────────────────────────────────────────────────────
// Central AI module — supports Groq (free) and Anthropic (paid).
// Groq runs Llama 3.3 for free at console.groq.com — no credit card.
// Settings are saved to localStorage so they persist across sessions.

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
  const providerEl = document.getElementById('aiProvider');
  const keyEl = document.getElementById('aiApiKey');
  if (!providerEl || !keyEl) return;
  const provider = providerEl.value;
  const key      = keyEl.value.trim();
  if (provider !== 'none' && !key) {
    showToast('Enter your API key first!');
    return;
  }
  localStorage.setItem('basketbuddy_ai', JSON.stringify({ provider, key }));
  updateAIStatusPill();
  showToast('✅ AI settings saved!');
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
  const provider = providerEl.value;
  const keyRow   = document.getElementById('aiKeyRow');
  const keyLabel = document.getElementById('aiKeyLabel');
  const keyHelp  = document.getElementById('aiKeyHelp');
  const keyInput = document.getElementById('aiApiKey');

  if (provider === 'none') {
    if (keyRow) keyRow.style.display = 'none';
    if (keyHelp) keyHelp.innerHTML = '⚠️ AI features disabled. Receipt scanning and basket optimizer will use demo mode.';
  } else {
    if (keyRow) keyRow.style.display = 'block';
    const p = AI_PROVIDERS[provider];
    if (keyLabel) keyLabel.textContent = p.keyLabel;
    if (keyInput) keyInput.placeholder = p.keyPlaceholder;
    if (keyHelp) keyHelp.innerHTML = p.helpText;
  }
}

function updateAIStatusPill() {
  const pill = document.getElementById('aiStatusPill');
  if (!pill) return;
  const s = loadAISettings();
  if (s.provider && s.provider !== 'none' && s.key) {
    const name = AI_PROVIDERS[s.provider]?.name || s.provider;
    pill.textContent = `⚡ ${name}`;
    pill.style.background = 'rgba(6,214,160,0.3)';
  } else {
    pill.textContent = '⚙️ Set up AI';
    pill.style.background = 'rgba(255,255,255,0.2)';
  }
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
  const s = loadAISettings();
  if (!s.provider || s.provider === 'none' || !s.key) {
    throw new Error('NO_AI_KEY');
  }
  const p = AI_PROVIDERS[s.provider];
  if (!p) throw new Error('Unknown provider');

  const response = await fetch(p.url, {
    method: 'POST',
    headers: p.buildHeaders(s.key),
    body: p.buildBody(systemPrompt, userPrompt, maxTokens)
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return p.extractText(data);
}

// ── AI: Receipt scanning ──────────────────────────────────────────
// For receipt scanning we need vision — only Anthropic supports images.
// Groq doesn't support image input, so we use Anthropic for this one feature.

async function callAnthropicVision(base64Image, mediaType) {
  const s = loadAISettings();

  // If user has Anthropic key, use it
  if (s.provider === 'anthropic' && s.key) {
    const p = AI_PROVIDERS.anthropic;
    const response = await fetch(p.url, {
      method: 'POST',
      headers: p.buildHeaders(s.key),
      body: JSON.stringify({
        model: p.model,
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Image } },
            { type: 'text', text: 'Extract all grocery items and their prices from this receipt. Return ONLY a JSON array like: [{"name":"Item name","price":1.99}]. No preamble, no markdown.' }
          ]
        }]
      })
    });
    const data = await response.json();
    return p.extractText(data);
  }

  // If Groq, use text-only mode with a note that vision isn't supported
  if (s.provider === 'groq' && s.key) {
    throw new Error('GROQ_NO_VISION');
  }

  throw new Error('NO_AI_KEY');
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
