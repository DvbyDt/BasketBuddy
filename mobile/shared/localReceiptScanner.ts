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
  price: number;      // total line price (unit price × quantity)
  unitPrice: number;  // price per single unit
  quantity: number;   // number of units (default 1)
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
            'Format: {"items":[{"name":"string","unitPrice":number,"quantity":number,"price":number,"isDiscount":boolean}]}',
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
                'Read this receipt image carefully and extract every purchased item.\n\n' +

                'QUANTITY PATTERNS — receipts show multiples in two ways:\n' +
                '  PATTERN A (Aldi): The quantity line comes BEFORE the item name:\n' +
                '    "2 x  1.29"\n' +
                '    "746222 HIGH PROTEIN NOODL  2.58"\n' +
                '    → name: "High Protein Noodles", quantity: 2, unitPrice: 1.29, price: 2.58\n\n' +
                '  PATTERN B (Lidl/Tesco): The quantity line comes AFTER the item name:\n' +
                '    "High Protein Wraps  8.10"\n' +
                '    "  6 x 1.35"\n' +
                '    → name: "High Protein Wraps", quantity: 6, unitPrice: 1.35, price: 8.10\n\n' +
                '  PATTERN C (single item): Just a name and price — no quantity line:\n' +
                '    "Romaine Lettuce  0.99"\n' +
                '    → name: "Romaine Lettuce", quantity: 1, unitPrice: 0.99, price: 0.99\n\n' +

                'FIELDS:\n' +
                '  name       — clean readable product name (fix OCR noise: "Ml1k"→"Milk", "1.S9"→1.59)\n' +
                '  unitPrice  — price for ONE unit\n' +
                '  quantity   — number of units purchased (integer, default 1)\n' +
                '  price      — total for this line = unitPrice × quantity\n' +
                '  isDiscount — true ONLY for discount/saving/clubcard/offer lines\n\n' +

                'EXCLUDE: store name, address, date, time, subtotal, TOTAL, VAT, cash, card payment, receipt number, loyalty points, thank you messages.\n\n' +

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
    .map((it: any) => {
      const quantity  = Math.max(1, Math.round(Number(it.quantity) || 1));
      const unitPrice = Math.abs(Number(it.unitPrice) || Number(it.price) || 0);
      const price     = Math.abs(Number(it.price) || unitPrice * quantity);
      return {
        name:       String(it.name ?? '').trim(),
        unitPrice,
        quantity,
        price,
        isDiscount: Boolean(it.isDiscount),
      };
    })
    .filter((it: ScannedItem) => it.name.length > 0 && it.price > 0);

  if (items.length === 0) {
    console.error('[Scanner] Parsed but no items found. Raw output:', text);
    throw new Error(
      'No items could be read.\nMake sure prices are visible and the photo is clear.'
    );
  }

  return items;
}
