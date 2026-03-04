// ─── Firebase configuration for BasketBuddy ─────────────────────
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, User } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyBiT18T3LF9iopQsMdmeBN0BmGrHCCrxOU',
  authDomain: 'basketbuddy-e6676.firebaseapp.com',
  projectId: 'basketbuddy-e6676',
  storageBucket: 'basketbuddy-e6676.firebasestorage.app',
  messagingSenderId: '134089448283',
  appId: '1:134089448283:web:606976ef00f6ac003e187e',
  measurementId: 'G-H7JVZEKM9M',
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
