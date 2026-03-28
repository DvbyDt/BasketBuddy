// ─── shared/localReceiptScanner.ts ───────────────────────────────
//
// Receipt scanning using Groq Vision — works in Expo Go, no native
// modules, no Cloud Functions, no OCR.space.
//
// Pipeline:
//   base64 image → Groq llama-3.2-11b-vision (reads + parses in one call)
//               → structured items JSON
//
// Requires EXPO_PUBLIC_GROQ_API_KEY in mobile/.env

// Expo SDK 50+ inlines EXPO_PUBLIC_* vars from mobile/.env at bundle time
const GROQ_API_KEY: string = process.env.EXPO_PUBLIC_GROQ_API_KEY ?? '';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

export interface ScannedItem {
  name: string;
  price: number;
  isDiscount: boolean;
}

// ── Groq Vision: reads image + parses items in one call ───────────

export async function scanReceiptLocal(
  imageBase64: string,
  onStatus?: (msg: string, step: number) => void
): Promise<ScannedItem[]> {
  if (!GROQ_API_KEY) {
    throw new Error(
      'Groq API key not set.\nAdd EXPO_PUBLIC_GROQ_API_KEY to mobile/.env and restart Expo.'
    );
  }

  onStatus?.('🤖 Reading receipt with Groq Vision…', 1);

  const prompt = `You are reading a grocery receipt photo.
Extract every purchased item and return clean structured JSON.

RULES:
- Regular purchased items → isDiscount: false, price as positive number
- Discount/saving/offer/clubcard lines → isDiscount: true, price as positive number
- SKIP: store name, address, date, time, subtotal, total, VAT, cash, card, receipt number, loyalty points
- Fix OCR errors: "1.S9" → 1.59, "€2,99" → 2.99, "MI1k" → "Milk"
- Skip items with unreadable prices
- Keep names concise: "Whole Milk 2L" not "WHL MLK 2LTR IRSH"

Return ONLY valid JSON, no markdown, no explanation:
{"items":[{"name":"Whole Milk 2L","price":1.59,"isDiscount":false},{"name":"Clubcard Saving","price":0.30,"isDiscount":true}]}`;

  const resp = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      max_tokens: 1500,
      temperature: 0.1,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    }),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`Groq error ${resp.status}: ${body.slice(0, 200)}`);
  }

  const data = await resp.json();
  const text: string = data?.choices?.[0]?.message?.content ?? '';

  onStatus?.('✅ Parsing items…', 2);

  let parsed: { items?: any[] } | null = null;
  try {
    parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch {
    throw new Error('Could not parse receipt items. Try a clearer photo with better lighting.');
  }

  return (parsed?.items ?? [])
    .map((it: any) => ({
      name:       String(it.name ?? '').trim(),
      price:      Math.abs(Number(it.price) || 0),
      isDiscount: Boolean(it.isDiscount),
    }))
    .filter((it: ScannedItem) => it.name.length > 0 && it.price > 0);
}
