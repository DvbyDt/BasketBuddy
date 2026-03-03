// ─── js/split.js ─────────────────────────────────────────────────
// Receipt splitter: AI receipt scanning + per-item assignment.

function renderSplit() {
  const el = document.getElementById('splitItems');
  if (!splitItems.length) {
    el.innerHTML = `<div class="empty-state"><div class="e-icon">🧾</div><p>No items yet.<br/>Scan a receipt or add manually.</p></div>`;
    document.getElementById('splitSummary').innerHTML = '';
    return;
  }
  el.innerHTML = splitItems.map((item, i) => `
    <div class="split-item">
      <div class="split-item-name">${item.name}</div>
      <div class="split-item-price">${fmt(item.price)}</div>
      <div class="split-toggle">
        <button class="split-btn ${item.owner === 'me'     ? 'active-me'     : ''}" onclick="setSplitOwner(${i},'me')">Me</button>
        <button class="split-btn ${item.owner === 'shared' ? 'active-shared' : ''}" onclick="setSplitOwner(${i},'shared')">½</button>
        <button class="split-btn ${item.owner === 'them'   ? 'active-them'   : ''}" onclick="setSplitOwner(${i},'them')">Them</button>
      </div>
    </div>`).join('');
  updateSplitSummary();
}

function setSplitOwner(idx, owner) {
  splitItems[idx].owner = owner;
  renderSplit();
}

function updateSplitSummary() {
  let myTotal = 0, theirTotal = 0;
  splitItems.forEach(i => {
    if (i.owner === 'me')       myTotal    += i.price;
    else if (i.owner === 'them') theirTotal += i.price;
    else { myTotal += i.price / 2; theirTotal += i.price / 2; }
  });
  const total = myTotal + theirTotal;
  document.getElementById('splitSummary').innerHTML = total
    ? `<div class="split-summary">
        <h3>💸 Split Summary</h3>
        <div class="split-row"><span>Total Bill</span><span>${fmt(total)}</span></div>
        <div class="split-row"><span>🧍 You owe</span><span class="split-amount">${fmt(myTotal)}</span></div>
        <div class="split-row"><span>👤 Roommate owes</span><span class="split-amount">${fmt(theirTotal)}</span></div>
      </div>`
    : '';
}

function openAddSplitItem() {
  openModal(`
    <h3 style="font-family:'Fredoka One',cursive;margin-bottom:16px;">Add Split Item</h3>
    <div class="form-row">
      <label class="form-label">Item Name</label>
      <input class="form-input" id="splitName" placeholder="e.g. Pasta"/>
    </div>
    <div class="form-row">
      <label class="form-label">Price (€)</label>
      <input class="form-input" id="splitPrice" type="number" step="0.01" placeholder="0.00"/>
    </div>
    <button class="btn btn-primary" onclick="saveSplitItem()" style="margin-top:8px;">Add Item</button>
  `);
}

function saveSplitItem() {
  const name  = document.getElementById('splitName').value.trim();
  const price = parseFloat(document.getElementById('splitPrice').value);
  if (!name || isNaN(price)) { showToast('Fill in all fields'); return; }
  splitItems.push({ name, price, owner: 'shared' });
  closeModal();
  renderSplit();
}

// ── AI Receipt Scanner ─────────────────────────────────────────
// Sends the receipt image to Claude via the Anthropic API.
// Falls back to demo data if the API is unreachable (e.g. local dev).
async function scanReceipt(input) {
  if (!input.files[0]) return;
  const file = input.files[0];

  document.getElementById('splitItems').innerHTML = `
    <div class="loading-box">
      <div class="spinner"></div>
      <p>AI scanning receipt…</p>
    </div>`;
  document.getElementById('splitSummary').innerHTML = '';

  // Convert image to base64
  const base64 = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res(r.result.split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

  const mediaType = file.type || 'image/jpeg';

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
            {
              type: 'text',
              text: 'Extract all grocery items and their prices from this receipt. Return ONLY a JSON array like: [{"name":"Item name","price":1.99}]. No preamble, no markdown backticks.'
            }
          ]
        }]
      })
    });

    const data  = await response.json();
    const text  = data.content.map(c => c.text || '').join('');
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    splitItems = parsed.map(p => ({ name: p.name, price: parseFloat(p.price) || 0, owner: 'shared' }));
    renderSplit();
    showToast(`✅ Extracted ${splitItems.length} items!`);
  } catch (e) {
    // Demo fallback for local development (no API key in browser)
    splitItems = [
      { name: 'Whole Milk 2L',    price: 1.15, owner: 'shared' },
      { name: 'Large Eggs 6pk',   price: 1.49, owner: 'shared' },
      { name: 'Sliced Pan',       price: 0.89, owner: 'shared' },
      { name: 'Cheddar Cheese',   price: 2.69, owner: 'shared' },
    ];
    renderSplit();
    showToast('📄 Demo receipt loaded (deploy with API key for real scanning)');
  }
}
