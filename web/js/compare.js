// ─── js/compare.js ───────────────────────────────────────────────
// Handles search, results rendering, and "Best Deals" home feed.

function handleSearch(val) {
  document.getElementById('searchClear').style.display = val ? 'block' : 'none';
  document.getElementById('compareHome').style.display  = val ? 'none'  : 'block';
  if (val.length < 1) {
    document.getElementById('searchResults').innerHTML = '';
    return;
  }
  const q = val.toLowerCase();
  const results = items.filter(i => i.name.toLowerCase().includes(q) || (i.quantity && i.quantity.toLowerCase().includes(q)));
  renderSearchResults(results);
}

function clearSearch() {
  document.getElementById('searchInput').value = '';
  handleSearch('');
}

function doSearch(q) {
  document.getElementById('searchInput').value = q;
  handleSearch(q);
  // Switch to compare tab if not already active
  const compareBtn = document.querySelector('.nav-btn');
  showPage('compare', compareBtn);
}

function renderSearchResults(results) {
  const el = document.getElementById('searchResults');
  if (!results.length) {
    el.innerHTML = `<div class="empty-state"><div class="e-icon">🤷</div><p>No items found.<br/>Add it in the ➕ tab!</p></div>`;
    return;
  }
  el.innerHTML = '<br/>' + results.map(item => {
    const prices = stores
      .map(s => ({ store: s, price: item.prices[s.id] }))
      .filter(x => x.price != null)
      .sort((a, b) => a.price - b.price);
    const best  = prices[0];
    const worst = prices[prices.length - 1];
    const saving = worst.price - best.price;

    return `<div class="price-card cheapest">
      <div class="cheapest-ribbon">BEST DEAL</div>
      <div class="price-card-header">
        <div>
          <div class="item-name">${item.name}${item.quantity ? ' <span style="font-weight:600;color:var(--muted);font-size:13px">(' + item.quantity + ')</span>' : ''}</div>
          <div class="item-unit">${item.category}</div>
        </div>
        <button class="btn btn-sm btn-outline" onclick="addToBasket(${item.id})">+ Basket</button>
      </div>
      <div class="price-list">
        ${prices.map((p, i) => `
          <div class="price-row ${i === 0 ? 'best' : ''}">
            ${storeBadgeHtml(p.store.id)}
            <div style="text-align:right">
              <div class="price-amount ${i === 0 ? 'best' : i === prices.length - 1 ? 'worst' : ''}">${fmt(p.price)}</div>
              ${i === 0 ? `<div class="price-diff">Save ${fmt(saving)} vs most expensive</div>` : ''}
            </div>
          </div>`).join('')}
      </div>
    </div>`;
  }).join('');
}

function renderBestDeals() {
  // Only show items that have prices at 2+ stores (so we can show savings)
  const comparable = items.filter(item => {
    const storeCount = stores.filter(s => item.prices[s.id] != null).length;
    return storeCount >= 2;
  });

  const sorted = [...comparable].sort((a, b) => {
    const pricesA = stores.map(s => a.prices[s.id]).filter(p => p != null);
    const pricesB = stores.map(s => b.prices[s.id]).filter(p => p != null);
    const savA = Math.max(...pricesA) - Math.min(...pricesA);
    const savB = Math.max(...pricesB) - Math.min(...pricesB);
    return savB - savA;
  }).slice(0, 5);

  document.getElementById('bestDeals').innerHTML = sorted.map(item => {
    const { store, price } = getCheapestStore(item);
    const maxP   = Math.max(...stores.filter(s => item.prices[s.id] != null).map(s => item.prices[s.id]));
    const saving = maxP - price;
    return `<div class="price-card" onclick="doSearch('${item.name}')" style="cursor:pointer">
      <div class="price-card-header">
        <div>
          <div class="item-name">${item.name}${item.quantity ? ' <span style="font-weight:600;color:var(--muted);font-size:13px">(' + item.quantity + ')</span>' : ''}</div>
          <div class="item-unit">${item.category}</div>
        </div>
        ${storeBadgeHtml(store.id)}
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;">
        <span class="price-amount best">${fmt(price)}</span>
        <span style="background:#E8FDF6;color:var(--green);padding:4px 10px;border-radius:10px;font-weight:800;font-size:12px;">
          Save ${fmt(saving)}
        </span>
      </div>
    </div>`;
  }).join('');
}
