// ─── js/basket.js ────────────────────────────────────────────────
// Shopping basket + AI-powered optimizer using Groq (free).

function addToBasket(itemId) {
  const item = items.find(i => i.id === itemId);
  if (!item) return;
  if (basket.find(b => b.itemId === itemId)) {
    showToast('Already in basket!');
    return;
  }
  const cheapest = getCheapestStore(item);
  if (!cheapest.store) { showToast('No price data for this item'); return; }
  const { store, price } = cheapest;
  const basketItem = { itemId, name: item.name, quantity: item.quantity || '', store: store.id, price };
  basket.push(basketItem);
  if (typeof syncBasketItemToCloud === 'function') syncBasketItemToCloud(basketItem);
  showToast(`✅ Added ${item.name} to basket`);
}

function removeFromBasket(itemId) {
  const existing = basket.find(b => b.itemId === itemId);
  basket = basket.filter(b => b.itemId !== itemId);
  if (existing && typeof removeBasketItemFromCloud === 'function') {
    removeBasketItemFromCloud(itemId, existing.store);
  }
  renderBasket();
}

function renderBasket() {
  const el = document.getElementById('basketItems');
  if (!basket.length) {
    el.innerHTML = `<div class="empty-state"><div class="e-icon">🧺</div><p>Your basket is empty.<br/>Search and add items!</p></div>`;
    document.getElementById('optimizerResult').innerHTML = '';
    return;
  }
  const total = basket.reduce((s, b) => s + b.price, 0);
  el.innerHTML = basket.map(b => `
    <div class="basket-item">
      ${storeBadgeHtml(b.store)}
      <div class="basket-item-info">
        <div class="basket-item-name">${b.name}${b.quantity ? ' <span style="font-weight:600;color:var(--muted);font-size:12px">(' + b.quantity + ')</span>' : ''}</div>
        <div class="basket-item-store">Best at ${stores.find(s => s.id === b.store)?.name}</div>
      </div>
      <div class="basket-item-price">${fmt(b.price)}</div>
      <button class="basket-remove" onclick="removeFromBasket(${b.itemId})">✕</button>
    </div>`).join('')
    + `<div style="text-align:right;font-family:'Fredoka One',cursive;font-size:22px;color:var(--orange);margin-top:8px;">
         Total: ${fmt(total)}
       </div>`;
}

async function runOptimizer() {
  const el = document.getElementById('optimizerResult');
  if (!basket.length) { showToast('Add items to basket first!'); return; }

  el.innerHTML = `<div class="optimizer-card">
    <div class="loading-box">
      <div class="spinner" style="border-top-color:white"></div>
      <p style="color:white;margin-top:10px;">AI optimising your basket…</p>
    </div>
  </div>`;

  // Group items by cheapest store
  const storeGroups = {};
  stores.forEach(s => (storeGroups[s.id] = []));
  basket.forEach(b => {
    if (!storeGroups[b.store]) storeGroups[b.store] = [];
    storeGroups[b.store].push(b);
  });

  const totalCheapest   = basket.reduce((s, b) => s + b.price, 0);
  const totalExpensive  = basket.reduce((s, b) => {
    const item = items.find(i => i.id === b.itemId);
    if (!item) return s + b.price;
    const ps = stores.map(st => item.prices[st.id]).filter(p => p != null);
    return s + (ps.length ? Math.max(...ps) : b.price);
  }, 0);
  const saving = totalExpensive - totalCheapest;

  // Try to get an AI insight tip
  let aiTip = '';
  try {
    const summary = basket.map(b => `${b.name} €${b.price} at ${b.store}`).join(', ');
    aiTip = await getBasketInsight(summary);
  } catch (e) {
    // Silently skip if no AI key
  }

  const activeGroups = Object.entries(storeGroups).filter(([, v]) => v.length);

  el.innerHTML = `<div class="optimizer-card">
    <h3>✨ AI Basket Plan</h3>
    ${activeGroups.map(([sid, its]) => {
      const s        = stores.find(x => x.id === sid);
      const subtotal = its.reduce((t, i) => t + i.price, 0);
      return `<div class="store-route">
        <div class="store-route-name">${s?.emoji} ${s?.name}</div>
        <div class="store-route-items">${its.map(i => i.name).join(' · ')}</div>
        <div class="store-route-price">${fmt(subtotal)}</div>
      </div>`;
    }).join('')}
    <div class="savings-pill">💚 You save ${fmt(saving)} by shopping smart!</div>
    ${aiTip ? `<div style="margin-top:12px;background:rgba(255,255,255,0.15);border-radius:10px;padding:10px;font-size:13px;font-weight:700;">🤖 ${aiTip}</div>` : ''}
  </div>`;
}
