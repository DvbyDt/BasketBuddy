import { getIdToken } from './firebase';
import Constants from 'expo-constants';

// Set this to your deployed Functions base URL.
// Example: https://us-central1-basketbuddy-e6676.cloudfunctions.net
const FUNCTIONS_BASE_URL: string =
  // Expo `extra` (recommended)
  ((Constants.expoConfig as any)?.extra?.functionsBaseUrl as string | undefined) ||
  // Expo public env (optional)
  (process.env.EXPO_PUBLIC_FUNCTIONS_BASE_URL as string | undefined) ||
  // Local emulator default
  'http://localhost:5001/basketbuddy-e6676/us-central1';

async function postJson<T>(path: string, body: any, timeoutMs = 20000): Promise<T> {
  const token = await getIdToken();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(`${FUNCTIONS_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const message = data?.error || `HTTP_${resp.status}`;
      const err: any = new Error(message);
      err.status = resp.status;
      err.payload = data;
      throw err;
    }
    return data as T;
  } finally {
    clearTimeout(timeout);
  }
}

export async function aiScanReceipt(imageBase64: string): Promise<{
  items: { name: string; price: number; isDiscount: boolean }[];
}> {
  return await postJson('/aiScanReceipt', { imageBase64 }, 60000);
}

export async function aiGroqComplete(prompt: string, maxTokens = 300): Promise<{ content: string }> {
  return await postJson('/aiGroqComplete', { prompt, maxTokens }, 30000);
}

