// ─── Firebase + Firestore for BasketBuddy Web ───────────────────
// Uses Firebase compat CDN (loaded via <script> tags in index.html)
// Firestore collections (multi-tenant, per-user):
//   users/{uid}/customItems/{itemId}
//   users/{uid}/basket/{basketItemId}

const firebaseConfig = {
  apiKey: 'AIzaSyBiT18T3LF9iopQsMdmeBN0BmGrHCCrxOU',
  authDomain: 'basketbuddy-e6676.firebaseapp.com',
  projectId: 'basketbuddy-e6676',
  storageBucket: 'basketbuddy-e6676.firebasestorage.app',
  messagingSenderId: '134089448283',
  appId: '1:134089448283:web:606976ef00f6ac003e187e',
  measurementId: 'G-H7JVZEKM9M',
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const fbAuth = firebase.auth();

// ─── Anonymous Auth ──────────────────────────────────────────────
let _fbUid = null;
const _fbAuthReady = new Promise((resolve) => {
  fbAuth.onAuthStateChanged(user => {
    if (user) {
      _fbUid = user.uid;
      resolve(user.uid);
    } else {
      fbAuth.signInAnonymously().catch(e => console.warn('[Auth] anon sign-in failed:', e));
    }
  });
});

async function ensureWebAuth() {
  if (_fbUid) return _fbUid;
  return _fbAuthReady;
}

function basketDocId(itemId, storeId) {
  return `${itemId}_${storeId}`;
}

// ──── Custom Items Cloud Sync ────────────────────────────────────

/** Push a custom item to Firestore */
function syncCustomItemToCloud(item) {
  ensureWebAuth().then(uid => {
    db.collection('users').doc(uid).collection('customItems').doc(String(item.id)).set({
      ...item,
      createdBy: uid,
      updatedAt: Date.now(),
    }).catch(e => console.warn('[Firestore] sync error:', e));
  });
}

/** Remove a custom item from Firestore */
function removeCustomItemFromCloud(id) {
  ensureWebAuth().then(uid => {
    db.collection('users').doc(uid).collection('customItems').doc(String(id)).delete()
      .catch(e => console.warn('[Firestore] remove error:', e));
  });
}

/** Listen for current user's custom items */
function subscribeToCustomItems(onChange) {
  let unsubscribe = null;
  ensureWebAuth().then(uid => {
    unsubscribe = db.collection('users').doc(uid).collection('customItems').onSnapshot(snapshot => {
      const cloudItems = snapshot.docs.map(d => d.data());
      onChange(cloudItems);
    }, err => {
      console.warn('[Firestore] custom items listener error:', err);
    });
  });
  return () => { try { if (unsubscribe) unsubscribe(); } catch(e) {} };
}

/** Replace saveCustomItems — now syncs to cloud */
function saveCustomItemsToCloud() {
  const custom = items.filter(i => i.id >= 10000);
  custom.forEach(item => syncCustomItemToCloud(item));
}

/** Load custom items from Firestore (real-time) */
function loadCustomItemsFromCloud() {
  subscribeToCustomItems(cloudItems => {
    // Remove old custom items
    for (let i = items.length - 1; i >= 0; i--) {
      if (items[i].id >= 10000) items.splice(i, 1);
    }
    // Add cloud items
    cloudItems.forEach(ci => {
      if (!items.find(i => i.id === ci.id)) {
        items.push(ci);
        if (ci.id >= nextId) nextId = ci.id + 1;
      }
    });
    // Re-render current tab
    if (typeof renderBestDeals === 'function') {
      try { renderBestDeals(); } catch(e) {}
    }
  });
}

// ──── Basket Cloud Sync ──────────────────────────────────────────

function syncBasketItemToCloud(item) {
  ensureWebAuth().then(uid => {
    const docId = basketDocId(item.itemId, item.store);
    db.collection('users').doc(uid).collection('basket').doc(docId).set({
      ...item,
      addedBy: uid,
      updatedAt: Date.now(),
    }).catch(e => console.warn('[Firestore] basket sync error:', e));
  });
}

function removeBasketItemFromCloud(itemId, storeId) {
  ensureWebAuth().then(uid => {
    db.collection('users').doc(uid).collection('basket').doc(basketDocId(itemId, storeId)).delete()
      .catch(e => console.warn('[Firestore] basket remove error:', e));
  });
}

function clearBasketInCloud() {
  ensureWebAuth().then(uid => {
    db.collection('users').doc(uid).collection('basket').get().then(snapshot => {
      snapshot.docs.forEach(d => d.ref.delete());
    }).catch(e => console.warn('[Firestore] basket clear error:', e));
  });
}

function subscribeToBasket(onChange) {
  let unsubscribe = null;
  ensureWebAuth().then(uid => {
    unsubscribe = db.collection('users').doc(uid).collection('basket').onSnapshot(snapshot => {
      const cloudBasket = snapshot.docs.map(d => d.data());
      onChange(cloudBasket);
    }, err => {
      console.warn('[Firestore] basket listener error:', err);
    });
  });
  return () => { try { if (unsubscribe) unsubscribe(); } catch(e) {} };
}
