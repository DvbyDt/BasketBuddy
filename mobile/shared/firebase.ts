// ─── Firebase configuration for BasketBuddy ─────────────────────
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

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
