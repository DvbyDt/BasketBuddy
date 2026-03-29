import * as admin from 'firebase-admin';
import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';

admin.initializeApp();

type ReceiptItem = {
  name: string;
  price: number;
  isDiscount: boolean;
};

function json(res: any, status: number, body: any) {
  res.status(status);
  res.setHeader('content-type', 'application/json');
  res.send(JSON.stringify(body));
}

async function requireAuth(req: any): Promise<{ uid: string }> {
  const header = String(req.headers.authorization || '');
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  if (!token) {
    const err: any = new Error('Missing auth token');
    err.status = 401;
    throw err;
  }
  const decoded = await admin.auth().verifyIdToken(token);
  return { uid: decoded.uid };
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function getClientIp(req: any): string {
  const xff = String(req.headers['x-forwarded-for'] || '');
  const first = xff.split(',')[0]?.trim();
  return first || String(req.ip || req.connection?.remoteAddress || 'unknown');
}

async function checkRateLimit(params: {
  uid: string;
  key: string;
  limit: number;
  windowSec: number;
}): Promise<{ ok: true } | { ok: false; retryAfterSec: number }> {
  const { uid, key, limit, windowSec } = params;
  const now = Date.now();
  const windowMs = windowSec * 1000;
  const ref = admin.firestore().collection('rateLimits').doc(`${uid}_${key}`);

  const result = await admin.firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? (snap.data() as any) : null;
    const windowStart = typeof data?.windowStart === 'number' ? data.windowStart : now;
    const count = typeof data?.count === 'number' ? data.count : 0;

    const inWindow = now - windowStart < windowMs;
    const nextStart = inWindow ? windowStart : now;
    const nextCount = inWindow ? count + 1 : 1;

    if (inWindow && count >= limit) {
      const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - windowStart)) / 1000));
      return { ok: false as const, retryAfterSec };
    }

    tx.set(
      ref,
      {
        windowStart: nextStart,
        count: nextCount,
        updatedAt: now,
        // Basic TTL support if you later enable Firestore TTL on `expiresAt`
        expiresAt: now + windowMs * 2,
      },
      { merge: true }
    );
    return { ok: true as const };
  });

  return result;
}

async function trackEvent(uid: string, name: string, props: Record<string, any> = {}) {
  try {
    // Never store receipt text/base64. Keep only safe metadata.
    await admin.firestore().collection('users').doc(uid).collection('events').add({
      name,
      props,
      ts: Date.now(),
    });
  } catch (e) {
    logger.warn('[Analytics] trackEvent failed', { name, uid, error: String((e as any)?.message || e) });
  }
}

export const aiScanReceipt = onRequest(
  { cors: true, maxInstances: 20, timeoutSeconds: 60, memory: '512MiB', secrets: ['GROQ_API_KEY', 'OCR_SPACE_API_KEY'] },
  async (req, res) => {
    try {
      if (req.method !== 'POST') return json(res, 405, { error: 'METHOD_NOT_ALLOWED' });
      const { uid } = await requireAuth(req);
      const ip = getClientIp(req);

      const rl = await checkRateLimit({ uid, key: 'aiScanReceipt', limit: 10, windowSec: 60 });
      if (!rl.ok) {
        res.setHeader('retry-after', String(rl.retryAfterSec));
        return json(res, 429, { error: 'RATE_LIMITED', retryAfterSec: rl.retryAfterSec });
      }

      const { imageBase64 } = (req.body || {}) as { imageBase64?: string };
      if (!imageBase64 || typeof imageBase64 !== 'string' || imageBase64.length < 50) {
        return json(res, 400, { error: 'INVALID_IMAGE' });
      }
      // Prevent abusive payload sizes (base64 expands ~33%)
      if (imageBase64.length > 8_000_000) {
        return json(res, 413, { error: 'IMAGE_TOO_LARGE' });
      }

      await trackEvent(uid, 'receipt_scan_started', {
        ipHash: String(ip).slice(0, 32),
        size: imageBase64.length,
      });

      const OCR_KEY = requireEnv('OCR_SPACE_API_KEY');
      const GROQ_KEY = requireEnv('GROQ_API_KEY');

      // ── Step 1: OCR.space ─────────────────────────────────────────
      const ocrForm = new FormData();
      ocrForm.append('base64Image', `data:image/jpeg;base64,${imageBase64}`);
      ocrForm.append('language', 'eng');
      ocrForm.append('isOverlayRequired', 'false');
      ocrForm.append('detectOrientation', 'true');
      ocrForm.append('scale', 'true');
      ocrForm.append('OCREngine', '2');

      const ocrResp = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        headers: { apikey: OCR_KEY },
        body: ocrForm as any,
      });
      if (!ocrResp.ok) {
        return json(res, 502, { error: 'OCR_UPSTREAM', status: ocrResp.status });
      }
      const ocrData: any = await ocrResp.json();
      const rawText: string | undefined = ocrData?.ParsedResults?.[0]?.ParsedText;
      if (!rawText || rawText.trim().length < 10) {
        await trackEvent(uid, 'receipt_scan_failed', { reason: 'OCR_NO_TEXT' });
        return json(res, 422, { error: 'OCR_NO_TEXT' });
      }

      // ── Step 2: Groq parse to structured items ───────────────────
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

      const groqResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${GROQ_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 1500,
          temperature: 0.1,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!groqResp.ok) {
        await trackEvent(uid, 'receipt_scan_failed', { reason: 'GROQ_UPSTREAM', status: groqResp.status });
        return json(res, 502, { error: 'GROQ_UPSTREAM', status: groqResp.status });
      }
      const groqData: any = await groqResp.json();
      const text: string = groqData?.choices?.[0]?.message?.content ?? '';

      let parsed: { items?: ReceiptItem[] } | null = null;
      try {
        parsed = JSON.parse(String(text).replace(/```json|```/g, '').trim());
      } catch {
        parsed = null;
      }
      const items = (parsed?.items ?? [])
        .map((it: any) => ({
          name: String(it.name ?? '').trim(),
          price: Math.abs(Number(it.price) || 0),
          isDiscount: Boolean(it.isDiscount),
        }))
        .filter((it: ReceiptItem) => it.name.length > 0 && it.price > 0);

      await trackEvent(uid, 'receipt_scan_succeeded', { itemCount: items.length });
      return json(res, 200, { items });
    } catch (e: any) {
      const status = typeof e?.status === 'number' ? e.status : 500;
      try {
        const header = String(req.headers.authorization || '');
        const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
        if (token) {
          const decoded = await admin.auth().verifyIdToken(token);
          await trackEvent(decoded.uid, 'receipt_scan_failed', { reason: 'INTERNAL', status });
        }
      } catch {}
      return json(res, status, { error: 'INTERNAL', message: String(e?.message || e) });
    }
  }
);

export const aiGroqComplete = onRequest(
  { cors: true, maxInstances: 20, timeoutSeconds: 30, memory: '256MiB', secrets: ['GROQ_API_KEY'] },
  async (req, res) => {
    try {
      if (req.method !== 'POST') return json(res, 405, { error: 'METHOD_NOT_ALLOWED' });
      const { uid } = await requireAuth(req);

      const rl = await checkRateLimit({ uid, key: 'aiGroqComplete', limit: 30, windowSec: 60 });
      if (!rl.ok) {
        res.setHeader('retry-after', String(rl.retryAfterSec));
        return json(res, 429, { error: 'RATE_LIMITED', retryAfterSec: rl.retryAfterSec });
      }

      const { prompt, maxTokens } = (req.body || {}) as { prompt?: string; maxTokens?: number };
      if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 3) {
        return json(res, 400, { error: 'INVALID_PROMPT' });
      }
      if (prompt.length > 20_000) {
        return json(res, 413, { error: 'PROMPT_TOO_LARGE' });
      }
      const GROQ_KEY = requireEnv('GROQ_API_KEY');
      const cappedMax = Math.max(1, Math.min(800, Number(maxTokens) || 300));

      await trackEvent(uid, 'groq_complete_started', { maxTokens: cappedMax });
      const groqResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${GROQ_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          max_tokens: cappedMax,
          temperature: 0.7,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!groqResp.ok) {
        await trackEvent(uid, 'groq_complete_failed', { reason: 'GROQ_UPSTREAM', status: groqResp.status });
        return json(res, 502, { error: 'GROQ_UPSTREAM', status: groqResp.status });
      }
      const data: any = await groqResp.json();
      const content: string = data?.choices?.[0]?.message?.content ?? '';
      await trackEvent(uid, 'groq_complete_succeeded', { contentLen: content.length });
      return json(res, 200, { content });
    } catch (e: any) {
      const status = typeof e?.status === 'number' ? e.status : 500;
      return json(res, status, { error: 'INTERNAL', message: String(e?.message || e) });
    }
  }
);

