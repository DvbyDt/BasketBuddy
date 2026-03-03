// ─── js/ui.js ────────────────────────────────────────────────────
// Shared UI helpers: toast, modal, page switching, formatters.

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

function showPage(name, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  btn.classList.add('active');

  // Trigger page-specific renders
  if (name === 'basket')  renderBasket();
  if (name === 'trends')  renderTrends();
  if (name === 'add')     renderStoreList();
  if (name === 'split')   renderSplit();
}

function closeModal(e) {
  if (!e || e.target === document.getElementById('modalOverlay')) {
    document.getElementById('modalOverlay').classList.remove('open');
  }
}

function openModal(htmlContent) {
  document.getElementById('modalContent').innerHTML = htmlContent;
  document.getElementById('modalOverlay').classList.add('open');
}

// Format number as euro price
function fmt(n) {
  return '€' + Number(n).toFixed(2);
}

// Return HTML for a coloured store badge
function storeBadgeHtml(storeId) {
  const s = stores.find(x => x.id === storeId);
  if (!s) return '';
  return `<span class="store-badge" style="background:${s.color}">${s.emoji} ${s.name}</span>`;
}

// Return the cheapest store object + price for a given item
function getCheapestStore(item) {
  let best = null, bestPrice = Infinity;
  stores.forEach(s => {
    const p = item.prices[s.id];
    if (p !== undefined && p < bestPrice) { bestPrice = p; best = s; }
  });
  return { store: best, price: bestPrice };
}
