// ─── Firestore cloud sync for custom items & basket ─────────────
import { db, ensureAuth, getCurrentUid } from './firebase';
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

// ────────────────────────── Custom Items ──────────────────────────
const customItemsCol = collection(db, 'customItems');

/** Push a custom item to Firestore (with auth) */
export async function syncCustomItemToCloud(item: Item): Promise<void> {
  const uid = await ensureAuth();
  try {
    await setDoc(doc(customItemsCol, String(item.id)), {
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
    await deleteDoc(doc(customItemsCol, String(id)));
  } catch (e) {
    console.warn('[Firestore] Failed to remove custom item:', e);
  }
}

/** Subscribe to custom items — calls onChange whenever any user adds/removes items */
export function subscribeToCustomItems(
  onChange: (items: Item[]) => void
): () => void {
  const q = query(customItemsCol);
  return onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
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
}

// ────────────────────────── Basket ────────────────────────────────
const basketCol = collection(db, 'sharedBasket');

/** Push a basket item to Firestore (with auth) */
export async function syncBasketItemToCloud(item: BasketItem): Promise<void> {
  const uid = await ensureAuth();
  try {
    await setDoc(doc(basketCol, String(item.itemId)), {
      ...item,
      addedBy: uid,
      updatedAt: Date.now(),
    });
  } catch (e) {
    console.warn('[Firestore] Failed to sync basket item:', e);
  }
}

/** Remove a basket item from Firestore */
export async function removeBasketItemFromCloud(itemId: number): Promise<void> {
  try {
    await deleteDoc(doc(basketCol, String(itemId)));
  } catch (e) {
    console.warn('[Firestore] Failed to remove basket item:', e);
  }
}

/** Clear all basket items from Firestore */
export async function clearBasketInCloud(): Promise<void> {
  try {
    const snapshot = await getDocs(basketCol);
    const deletes = snapshot.docs.map(d => deleteDoc(d.ref));
    await Promise.all(deletes);
  } catch (e) {
    console.warn('[Firestore] Failed to clear basket:', e);
  }
}

/** Subscribe to basket — calls onChange whenever any user modifies the basket */
export function subscribeToBasket(
  onChange: (items: BasketItem[]) => void
): () => void {
  const q = query(basketCol);
  return onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
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
}
