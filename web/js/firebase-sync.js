// ─── Firebase + Firestore for BasketBuddy Web ───────────────────
// Uses Firebase compat CDN (loaded via <script> tags in index.html)
// Firestore collections: customItems, sharedBasket

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

// ──── Custom Items Cloud Sync ────────────────────────────────────

/** Push a custom item to Firestore */
function syncCustomItemToCloud(item) {
  ensureWebAuth().then(uid => {
    db.collection('customItems').doc(String(item.id)).set({
      ...item,
      createdBy: uid,
      updatedAt: Date.now(),
    }).catch(e => console.warn('[Firestore] sync error:', e));
  });
}

/** Remove a custom item from Firestore */
function removeCustomItemFromCloud(id) {
  db.collection('customItems').doc(String(id)).delete()
    .catch(e => console.warn('[Firestore] remove error:', e));
}

/** Listen for real-time custom items from all users */
function subscribeToCustomItems(onChange) {
  return db.collection('customItems').onSnapshot(snapshot => {
    const cloudItems = snapshot.docs.map(d => d.data());
    onChange(cloudItems);
  }, err => {
    console.warn('[Firestore] custom items listener error:', err);
  });
}

/** Replace saveCustomItems — now syncs to cloud */
function saveCustomItemsToCloud() {
  const custom = items.filter(i => i.id >= 92);
  custom.forEach(item => syncCustomItemToCloud(item));
}

/** Load custom items from Firestore (real-time) */
function loadCustomItemsFromCloud() {
  subscribeToCustomItems(cloudItems => {
    // Remove old custom items
    for (let i = items.length - 1; i >= 0; i--) {
      if (items[i].id >= 92) items.splice(i, 1);
    }
    // Add cloud items
    cloudItems.forEach(ci => {
      if (!items.find(i => i.id === ci.id)) {
        items.push(ci);
        if (ci.id >= nextId) nextId = ci.id + 1;
      }
    });
    // Re-render current tab
    if (typeof renderCompare === 'function') {
      try { renderCompare(); } catch(e) {}
    }
  });
}

// ──── Basket Cloud Sync ──────────────────────────────────────────

function syncBasketItemToCloud(item) {
  ensureWebAuth().then(uid => {
    db.collection('sharedBasket').doc(String(item.id || item.name)).set({
      ...item,
      addedBy: uid,
      updatedAt: Date.now(),
    }).catch(e => console.warn('[Firestore] basket sync error:', e));
  });
}

function removeBasketItemFromCloud(itemName) {
  db.collection('sharedBasket').doc(String(itemName)).delete()
    .catch(e => console.warn('[Firestore] basket remove error:', e));
}

function clearBasketInCloud() {
  db.collection('sharedBasket').get().then(snapshot => {
    snapshot.docs.forEach(d => d.ref.delete());
  }).catch(e => console.warn('[Firestore] basket clear error:', e));
}

function subscribeToBasket(onChange) {
  return db.collection('sharedBasket').onSnapshot(snapshot => {
    const cloudBasket = snapshot.docs.map(d => d.data());
    onChange(cloudBasket);
  }, err => {
    console.warn('[Firestore] basket listener error:', err);
  });
}
