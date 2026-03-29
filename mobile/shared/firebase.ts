// ─── Firebase configuration for BasketBuddy ─────────────────────
import Constants from 'expo-constants';
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, User } from 'firebase/auth';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string>;

const firebaseConfig = {
  apiKey:            extra.firebaseApiKey            ?? 'AIzaSyBiT18T3LF9iopQsMdmeBN0BmGrHCCrxOU',
  authDomain:        extra.firebaseAuthDomain        ?? 'basketbuddy-e6676.firebaseapp.com',
  projectId:         extra.firebaseProjectId         ?? 'basketbuddy-e6676',
  storageBucket:     extra.firebaseStorageBucket     ?? 'basketbuddy-e6676.firebasestorage.app',
  messagingSenderId: extra.firebaseMessagingSenderId ?? '134089448283',
  appId:             extra.firebaseAppId             ?? '1:134089448283:web:606976ef00f6ac003e187e',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// ─── Anonymous Auth ──────────────────────────────────────────────
let _currentUser: User | null = null;
let _authReady: ((user: User) => void) | null = null;
const _authPromise = new Promise<User>((resolve) => {
  _authReady = resolve;
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    _currentUser = user;
    if (_authReady) { _authReady(user); _authReady = null; }
  } else {
    // Not signed in — sign in anonymously
    signInAnonymously(auth).catch(e => console.warn('[Auth] anonymous sign-in failed:', e));
  }
});

/** Wait until the user is authenticated, then return the uid */
export async function ensureAuth(): Promise<string> {
  if (_currentUser) return _currentUser.uid;
  const user = await _authPromise;
  return user.uid;
}

/** Get current user UID (or null if not yet authed) */
export function getCurrentUid(): string | null {
  return _currentUser?.uid ?? null;
}

/** Get a fresh Firebase ID token for calling your backend */
export async function getIdToken(): Promise<string> {
  await ensureAuth();
  if (!_currentUser) throw new Error('AUTH_NOT_READY');
  return await _currentUser.getIdToken(/* forceRefresh */ false);
}
