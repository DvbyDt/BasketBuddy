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
      max_tokens: 2000,
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

                '━━ QUANTITY PATTERNS ━━\n' +
                'PATTERN A (Aldi) — quantity line BEFORE item name:\n' +
                '  "2 x  1.29"\n' +
                '  "746222 HIGH PROTEIN NOODL  2.58"\n' +
                '  → quantity:2, unitPrice:1.29, price:2.58\n\n' +

                'PATTERN B (Lidl) — quantity line AFTER item name:\n' +
                '  "High Protein Wraps  8.10"\n' +
                '  "  6 x 1.35"\n' +
                '  → quantity:6, unitPrice:1.35, price:8.10\n\n' +

                'PATTERN C (Tesco) — quantity NUMBER prefix on same line, unit price on next line:\n' +
                '  "2  Tesco Salad Tomatoes 6 Pack  2.58"\n' +
                '  "   1.29 each"\n' +
                '  → quantity:2, unitPrice:1.29, price:2.58\n\n' +

                'PATTERN D (single item) — no quantity indicator:\n' +
                '  "1  Romaine Lettuce  0.99"  OR  "Romaine Lettuce  0.99"\n' +
                '  → quantity:1, unitPrice:0.99, price:0.99\n\n' +

                '━━ INLINE DISCOUNTS (Tesco "Cc", Lidl/Aldi offer lines) ━━\n' +
                'Supermarkets show item-level discounts as 1–2 lines directly after the item:\n' +
                '  "1  Dove Body Wash 720ml  9.00"   ← full shelf price\n' +
                '  "   Cc 4.50"                       ← Clubcard saving label\n' +
                '  "                        -4.50"    ← negative deduction\n' +
                'RULE: The ONLY thing to emit is ONE item at the NET price (9.00 − 4.50 = 4.50).\n' +
                '  → name:"Dove Body Wash 720ml", price:4.50, unitPrice:4.50, isDiscount:false\n' +
                'The "Cc" label line and the negative line are NOT separate items — do not emit them.\n\n' +

                'CRITICAL — DO NOT confuse a normal item price with a Cc discount:\n' +
                '  "1  Tesco Easy Cook Brown Rice 1kg   1.30"  ← NORMAL item at €1.30, include it.\n' +
                '  A "Cc" discount only follows an item if the VERY NEXT LINE starts with "Cc".\n' +
                '  A negative value that appears several lines later belongs to the item IT follows.\n\n' +

                '━━ BOTTOM-OF-RECEIPT SUMMARY LINES — ALWAYS EXCLUDE ━━\n' +
                'Receipts print a savings summary at the bottom AFTER all items. These are NOT items.\n' +
                'NEVER emit any of these as items or discounts — they are already reflected in net prices:\n' +
                '  "Subtotal:", "Savings:", "Promotions:", "TOTAL:", "Total savings:", "You saved:"\n' +
                'Example: "Savings: -€9.30" is a summary of Cc discounts already merged into items.\n' +
                'Emitting it would double-count the discount and make the split total wrong.\n\n' +

                '━━ FIELDS ━━\n' +
                '  name       — clean product name (fix OCR noise: "Ml1k"→"Milk")\n' +
                '  unitPrice  — price for ONE unit AFTER any inline discount\n' +
                '  quantity   — integer, default 1\n' +
                '  price      — unitPrice × quantity (net amount charged for this line)\n' +
                '  isDiscount — always false; every line you emit IS a purchased item at its net price\n\n' +

                'EXCLUDE: store name, address, VAT number, date/time, Subtotal, TOTAL, Savings,\n' +
                'Promotions, "You saved", cash/card payment lines, receipt numbers,\n' +
                'loyalty points balance, thank-you messages, barcode numbers,\n' +
                'any negative-only lines (they are already merged into the item above).\n\n' +

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

  // Summary-line keywords that should never appear as items.
  // If the model emits them despite instructions, drop them here.
  const SUMMARY_KEYWORDS = /^(subtotal|total|savings|promotions|you saved|vat|card|cash|clubcard points)/i;

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
        // Always false — all inline discounts are merged into net item price.
        // The split screen has no discounts to double-apply.
        isDiscount: false as const,
      };
    })
    .filter((it: ScannedItem) =>
      it.name.length > 0 &&
      it.price > 0 &&
      !SUMMARY_KEYWORDS.test(it.name)  // drop any summary lines the model leaked through
    );

  if (items.length === 0) {
    console.error('[Scanner] Parsed but no items found. Raw output:', text);
    throw new Error(
      'No items could be read.\nMake sure prices are visible and the photo is clear.'
    );
  }

  return items;
}
