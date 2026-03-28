// ─── shared/localReceiptScanner.ts ───────────────────────────────
//
// On-device receipt scanning — no Cloud Functions, no OCR.space.
//
// Pipeline:
//   Image URI → react-native-mlkit-ocr (on-device, free, offline)
//             → Groq Llama 3.3 (direct API call, free)
//             → structured items JSON
//
// Requires EXPO_PUBLIC_GROQ_API_KEY in mobile/.env

import MlkitOcr from 'react-native-mlkit-ocr';
import Constants from 'expo-constants';

const GROQ_API_KEY: string =
  (Constants.expoConfig?.extra as any)?.groqApiKey ?? '';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

export interface ScannedItem {
  name: string;
  price: number;
  isDiscount: boolean;
}

// ── Step 1: On-device OCR ─────────────────────────────────────────

async function extractTextFromImage(imageUri: string): Promise<string> {
  const blocks = await MlkitOcr.detectFromUri(imageUri);
  const rawText = blocks.map(b => b.text).join('\n').trim();
  if (rawText.length < 10) {
    throw new Error(
      'Could not read text from the image.\nTry better lighting or hold the camera steadier.'
    );
  }
  return rawText;
}

// ── Step 2: Groq parses raw text → structured items ───────────────

async function parseItemsWithGroq(rawText: string): Promise<ScannedItem[]> {
  if (!GROQ_API_KEY) {
    throw new Error(
      'Groq API key not set.\nAdd EXPO_PUBLIC_GROQ_API_KEY to mobile/.env and restart.'
    );
  }

  const prompt = `You are parsing raw OCR text extracted from a grocery receipt photo.
Your job is to identify every purchased item and return clean structured JSON.

RAW OCR TEXT FROM RECEIPT:
${rawText}

RULES:
- Regular purchased items → isDiscount: false, price as positive number
- Discount/saving/offer/clubcard lines → isDiscount: true, price as positive number (we handle the sign)
- SKIP these lines entirely: store name, address, date, time, subtotal, total, VAT, cash, card payment, receipt number, loyalty points, thank you messages
- Fix obvious OCR errors: "1.S9" → 1.59, "€2,99" → 2.99, "MI1k" → "Milk"
- If a price is completely unreadable, skip that item
- Keep item names concise but clear (e.g. "Whole Milk 2L" not "WHL MLK 2LTR IRSH")

Return ONLY this exact JSON format, no markdown, no explanation:
{"items":[{"name":"Whole Milk 2L","price":1.59,"isDiscount":false},{"name":"Clubcard Saving","price":0.30,"isDiscount":true}]}`;

  const resp = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 1500,
      temperature: 0.1,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`Groq error ${resp.status}: ${body.slice(0, 120)}`);
  }

  const data = await resp.json();
  const text: string = data?.choices?.[0]?.message?.content ?? '';

  let parsed: { items?: any[] } | null = null;
  try {
    parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch {
    throw new Error('Could not parse receipt. Try scanning again with better lighting.');
  }

  return (parsed?.items ?? [])
    .map((it: any) => ({
      name:       String(it.name ?? '').trim(),
      price:      Math.abs(Number(it.price) || 0),
      isDiscount: Boolean(it.isDiscount),
    }))
    .filter((it: ScannedItem) => it.name.length > 0 && it.price > 0);
}

// ── Public API ────────────────────────────────────────────────────

/**
 * Scan a receipt image entirely on-device + Groq.
 * No Cloud Functions. No OCR.space. No base64 upload.
 *
 * @param imageUri  Local file URI from expo-image-picker
 * @param onStatus  Optional callback for status updates shown in UI
 */
export async function scanReceiptLocal(
  imageUri: string,
  onStatus?: (msg: string, step: number) => void
): Promise<ScannedItem[]> {
  onStatus?.('📱 Reading receipt on device…', 1);
  const rawText = await extractTextFromImage(imageUri);

  onStatus?.('🤖 Groq is parsing items…', 2);
  const items = await parseItemsWithGroq(rawText);

  return items;
}
