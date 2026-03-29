// ─── Firestore cloud sync for custom items & basket ─────────────
import { db, ensureAuth } from './firebase';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  query,
  QuerySnapshot,
  DocumentData,
} from 'firebase/firestore';
import type { Item, BasketItem } from './types';

function userSubcol(uid: string, subpath: 'customItems' | 'basket') {
  return collection(db, 'users', uid, subpath);
}

function basketDocId(itemId: number, storeId: string): string {
  return `${itemId}_${storeId}`;
}

/** Push a custom item to Firestore (with auth) */
export async function syncCustomItemToCloud(item: Item): Promise<void> {
  const uid = await ensureAuth();
  try {
    const col = userSubcol(uid, 'customItems');
    await setDoc(doc(col, String(item.id)), {
      ...item,
      createdBy: uid,
      updatedAt: Date.now(),
    });
  } catch (e) {
    console.warn('[Firestore] Failed to sync custom item:', e);
  }
}

/** Remove a custom item from Firestore */
export async function removeCustomItemFromCloud(id: number): Promise<void> {
  try {
    const uid = await ensureAuth();
    const col = userSubcol(uid, 'customItems');
    await deleteDoc(doc(col, String(id)));
  } catch (e) {
    console.warn('[Firestore] Failed to remove custom item:', e);
  }
}

/** Subscribe to current user's custom items */
export function subscribeToCustomItems(
  onChange: (items: Item[]) => void
): () => void {
  // We don't use getCurrentUid() alone because the listener must start only after auth is ready.
  // Firestore snapshot will keep running; returning an unsubscribe ensures lifecycle cleanup.
  let unsubscribe: (() => void) | null = null;
  let stopped = false;

  (async () => {
    const uid = await ensureAuth();
    if (stopped) return;
    const col = userSubcol(uid, 'customItems');
    const q = query(col);
    unsubscribe = onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
      const cloudItems: Item[] = snapshot.docs.map(d => {
        const data = d.data();
        return {
          id: data.id,
          name: data.name,
          quantity: data.quantity || '',
          category: data.category || 'Other',
          prices: data.prices || {},
          history: data.history || {},
        } as Item;
      });
      onChange(cloudItems);
    }, (err) => {
      console.warn('[Firestore] Custom items listener error:', err);
    });
  })().catch((e) => console.warn('[Firestore] subscribeToCustomItems failed:', e));

  return () => {
    stopped = true;
    if (unsubscribe) unsubscribe();
  };
}

// ────────────────────────── Basket ────────────────────────────────
/** Push a basket item to Firestore (with auth) */
export async function syncBasketItemToCloud(item: BasketItem): Promise<void> {
  const uid = await ensureAuth();
  try {
    const col = userSubcol(uid, 'basket');
    await setDoc(doc(col, basketDocId(item.itemId, item.store)), {
      ...item,
      addedBy: uid,
      updatedAt: Date.now(),
    });
  } catch (e) {
    console.warn('[Firestore] Failed to sync basket item:', e);
  }
}

/** Remove a basket item from Firestore */
export async function removeBasketItemFromCloud(itemId: number, storeId: string): Promise<void> {
  try {
    const uid = await ensureAuth();
    const col = userSubcol(uid, 'basket');
    await deleteDoc(doc(col, basketDocId(itemId, storeId)));
  } catch (e) {
    console.warn('[Firestore] Failed to remove basket item:', e);
  }
}

/** Clear all basket items from Firestore */
export async function clearBasketInCloud(): Promise<void> {
  try {
    const uid = await ensureAuth();
    const col = userSubcol(uid, 'basket');
    const snapshot = await getDocs(col);
    const deletes = snapshot.docs.map(d => deleteDoc(d.ref));
    await Promise.all(deletes);
  } catch (e) {
    console.warn('[Firestore] Failed to clear basket:', e);
  }
}

/** Subscribe to current user's basket */
export function subscribeToBasket(
  onChange: (items: BasketItem[]) => void
): () => void {
  let unsubscribe: (() => void) | null = null;
  let stopped = false;

  (async () => {
    const uid = await ensureAuth();
    if (stopped) return;
    const col = userSubcol(uid, 'basket');
    const q = query(col);
    unsubscribe = onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
      const cloudBasket: BasketItem[] = snapshot.docs.map(d => {
        const data = d.data();
        return {
          itemId: data.itemId,
          name: data.name,
          quantity: data.quantity || '',
          store: data.store,
          price: data.price,
        } as BasketItem;
      });
      onChange(cloudBasket);
    }, (err) => {
      console.warn('[Firestore] Basket listener error:', err);
    });
  })().catch((e) => console.warn('[Firestore] subscribeToBasket failed:', e));

  return () => {
    stopped = true;
    if (unsubscribe) unsubscribe();
  };
}
