// ─── shared/localReceiptScanner.ts ───────────────────────────────
//
// Receipt scanning using Groq Vision — works in Expo Go, no native
// modules, no Cloud Functions, no OCR.space.
//
// Pipeline:
//   base64 image → Groq llama-4-scout (reads + parses in one call)
//               → structured items JSON
//
// Requires EXPO_PUBLIC_GROQ_API_KEY in mobile/.env

const GROQ_API_KEY: string = process.env.EXPO_PUBLIC_GROQ_API_KEY ?? '';
const GROQ_URL    = 'https://api.groq.com/openai/v1/chat/completions';
const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

export interface ScannedItem {
  name: string;
  price: number;
  isDiscount: boolean;
}

// ── Detect image MIME type from base64 header ─────────────────────

function detectMimeType(base64: string): string {
  if (base64.startsWith('/9j'))   return 'image/jpeg';
  if (base64.startsWith('iVBOR')) return 'image/png';
  if (base64.startsWith('R0lGO')) return 'image/gif';
  if (base64.startsWith('UklGR')) return 'image/webp';
  return 'image/jpeg'; // safe default
}

// ── Extract JSON from model response robustly ─────────────────────
// Llama 4 Scout often wraps JSON in prose. This pulls the JSON object
// out regardless of what surrounds it.

function extractJson(text: string): { items?: any[] } | null {
  // 1. Strip markdown code fences
  const stripped = text.replace(/```(?:json)?/gi, '').trim();

  // 2. Try parsing the whole thing first (ideal case)
  try { return JSON.parse(stripped); } catch {}

  // 3. Find the outermost { ... } block via regex
  const match = stripped.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch {}
  }

  // 4. Try to find an "items" array even without outer braces
  const arrayMatch = stripped.match(/"items"\s*:\s*(\[[\s\S]*?\])/);
  if (arrayMatch) {
    try { return { items: JSON.parse(arrayMatch[1]) }; } catch {}
  }

  return null;
}

// ── Main export ───────────────────────────────────────────────────

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

  const mimeType = detectMimeType(imageBase64);

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
          role: 'system',
          content:
            'You are a receipt parser. Output ONLY a raw JSON object — no markdown, no explanation, no text before or after. ' +
            'Format: {"items":[{"name":"string","price":number,"isDiscount":boolean}]}',
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${imageBase64}` },
            },
            {
              type: 'text',
              text:
                'Read this receipt and extract every line item.\n\n' +
                'Rules:\n' +
                '- Each purchased product → isDiscount: false, price as positive number\n' +
                '- Discount/saving/clubcard/offer lines → isDiscount: true, price as positive number\n' +
                '- EXCLUDE: store name, address, date/time, subtotal, TOTAL, VAT, cash tendered, card payment, receipt number, loyalty points, thank you\n' +
                '- Fix OCR noise: "1.S9"→1.59, "€2,99"→2.99, "Ml1k"→"Milk"\n' +
                '- Short clean names: "Whole Milk 2L" not "WHL MLK 2LTR IRSH"\n\n' +
                'Return ONLY the JSON object, nothing else.',
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

  const data  = await resp.json();
  const text: string = data?.choices?.[0]?.message?.content ?? '';

  onStatus?.('✅ Parsing items…', 2);

  const parsed = extractJson(text);

  if (!parsed) {
    // Show the raw model output so the user can report it
    console.error('[Scanner] Raw model output:', text);
    throw new Error(
      `Could not read items from the receipt.\nTip: Make sure the receipt is flat, well-lit and fully visible.`
    );
  }

  const items = (parsed.items ?? [])
    .map((it: any) => ({
      name:       String(it.name ?? '').trim(),
      price:      Math.abs(Number(it.price) || 0),
      isDiscount: Boolean(it.isDiscount),
    }))
    .filter((it: ScannedItem) => it.name.length > 0 && it.price > 0);

  if (items.length === 0) {
    console.error('[Scanner] Parsed but no items found. Raw output:', text);
    throw new Error(
      'No items could be read.\nMake sure prices are visible and the photo is clear.'
    );
  }

  return items;
}
