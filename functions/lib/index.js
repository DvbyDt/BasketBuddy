"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiGroqComplete = exports.aiScanReceipt = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const firebase_functions_1 = require("firebase-functions");
admin.initializeApp();
function json(res, status, body) {
    res.status(status);
    res.setHeader('content-type', 'application/json');
    res.send(JSON.stringify(body));
}
async function requireAuth(req) {
    const header = String(req.headers.authorization || '');
    const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
    if (!token) {
        const err = new Error('Missing auth token');
        err.status = 401;
        throw err;
    }
    const decoded = await admin.auth().verifyIdToken(token);
    return { uid: decoded.uid };
}
function requireEnv(name) {
    const v = process.env[name];
    if (!v)
        throw new Error(`Missing env var: ${name}`);
    return v;
}
function getClientIp(req) {
    const xff = String(req.headers['x-forwarded-for'] || '');
    const first = xff.split(',')[0]?.trim();
    return first || String(req.ip || req.connection?.remoteAddress || 'unknown');
}
async function checkRateLimit(params) {
    const { uid, key, limit, windowSec } = params;
    const now = Date.now();
    const windowMs = windowSec * 1000;
    const ref = admin.firestore().collection('rateLimits').doc(`${uid}_${key}`);
    const result = await admin.firestore().runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const data = snap.exists ? snap.data() : null;
        const windowStart = typeof data?.windowStart === 'number' ? data.windowStart : now;
        const count = typeof data?.count === 'number' ? data.count : 0;
        const inWindow = now - windowStart < windowMs;
        const nextStart = inWindow ? windowStart : now;
        const nextCount = inWindow ? count + 1 : 1;
        if (inWindow && count >= limit) {
            const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - windowStart)) / 1000));
            return { ok: false, retryAfterSec };
        }
        tx.set(ref, {
            windowStart: nextStart,
            count: nextCount,
            updatedAt: now,
            // Basic TTL support if you later enable Firestore TTL on `expiresAt`
            expiresAt: now + windowMs * 2,
        }, { merge: true });
        return { ok: true };
    });
    return result;
}
async function trackEvent(uid, name, props = {}) {
    try {
        // Never store receipt text/base64. Keep only safe metadata.
        await admin.firestore().collection('users').doc(uid).collection('events').add({
            name,
            props,
            ts: Date.now(),
        });
    }
    catch (e) {
        firebase_functions_1.logger.warn('[Analytics] trackEvent failed', { name, uid, error: String(e?.message || e) });
    }
}
exports.aiScanReceipt = (0, https_1.onRequest)({ cors: true, maxInstances: 20, timeoutSeconds: 60, memory: '512MiB' }, async (req, res) => {
    try {
        if (req.method !== 'POST')
            return json(res, 405, { error: 'METHOD_NOT_ALLOWED' });
        const { uid } = await requireAuth(req);
        const ip = getClientIp(req);
        const rl = await checkRateLimit({ uid, key: 'aiScanReceipt', limit: 10, windowSec: 60 });
        if (!rl.ok) {
            res.setHeader('retry-after', String(rl.retryAfterSec));
            return json(res, 429, { error: 'RATE_LIMITED', retryAfterSec: rl.retryAfterSec });
        }
        const { imageBase64 } = (req.body || {});
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
            body: ocrForm,
        });
        if (!ocrResp.ok) {
            return json(res, 502, { error: 'OCR_UPSTREAM', status: ocrResp.status });
        }
        const ocrData = await ocrResp.json();
        const rawText = ocrData?.ParsedResults?.[0]?.ParsedText;
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
        const groqData = await groqResp.json();
        const text = groqData?.choices?.[0]?.message?.content ?? '';
        let parsed = null;
        try {
            parsed = JSON.parse(String(text).replace(/```json|```/g, '').trim());
        }
        catch {
            parsed = null;
        }
        const items = (parsed?.items ?? [])
            .map((it) => ({
            name: String(it.name ?? '').trim(),
            price: Math.abs(Number(it.price) || 0),
            isDiscount: Boolean(it.isDiscount),
        }))
            .filter((it) => it.name.length > 0 && it.price > 0);
        await trackEvent(uid, 'receipt_scan_succeeded', { itemCount: items.length });
        return json(res, 200, { items });
    }
    catch (e) {
        const status = typeof e?.status === 'number' ? e.status : 500;
        try {
            const header = String(req.headers.authorization || '');
            const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
            if (token) {
                const decoded = await admin.auth().verifyIdToken(token);
                await trackEvent(decoded.uid, 'receipt_scan_failed', { reason: 'INTERNAL', status });
            }
        }
        catch { }
        return json(res, status, { error: 'INTERNAL', message: String(e?.message || e) });
    }
});
exports.aiGroqComplete = (0, https_1.onRequest)({ cors: true, maxInstances: 20, timeoutSeconds: 30, memory: '256MiB' }, async (req, res) => {
    try {
        if (req.method !== 'POST')
            return json(res, 405, { error: 'METHOD_NOT_ALLOWED' });
        const { uid } = await requireAuth(req);
        const rl = await checkRateLimit({ uid, key: 'aiGroqComplete', limit: 30, windowSec: 60 });
        if (!rl.ok) {
            res.setHeader('retry-after', String(rl.retryAfterSec));
            return json(res, 429, { error: 'RATE_LIMITED', retryAfterSec: rl.retryAfterSec });
        }
        const { prompt, maxTokens } = (req.body || {});
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
        const data = await groqResp.json();
        const content = data?.choices?.[0]?.message?.content ?? '';
        await trackEvent(uid, 'groq_complete_succeeded', { contentLen: content.length });
        return json(res, 200, { content });
    }
    catch (e) {
        const status = typeof e?.status === 'number' ? e.status : 500;
        return json(res, status, { error: 'INTERNAL', message: String(e?.message || e) });
    }
});
