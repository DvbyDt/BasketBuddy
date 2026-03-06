// ── Custom store fields ───────────────────────────────────────────
function addCustomStoreField() {
  customStoreCount++;
  const div = document.createElement('div');
  div.className = 'form-row';
  div.id = 'customStore_' + customStoreCount;
  div.innerHTML = `
    <label class="form-label">Custom Store ${customStoreCount}</label>
    <div style="display:flex;gap:8px;">
      <input class="form-input" style="flex:2" placeholder="Store name"
             id="csName_${customStoreCount}"/>
      <input class="form-input" style="flex:1;text-align:center" type="number"
             step="0.01" placeholder="€" id="csPrice_${customStoreCount}"/>
    </div>`;
  document.getElementById('customStoreInputs').appendChild(div);
}

// ── Save new item ─────────────────────────────────────────────────
function saveItem() {
  const name = document.getElementById('addName').value.trim();
  if (!name) { showToast('Enter an item name!'); return; }

  const quantity = (document.getElementById('addQuantity')?.value || '').trim();
  const category = document.getElementById('addCategory').value;
  const prices   = {};

  // Built-in stores
  const builtInStores = [
    { id: 'tesco', inputId: 'addTesco' },
    { id: 'lidl',  inputId: 'addLidl' },
    { id: 'aldi',  inputId: 'addAldi' },
    { id: 'asian', inputId: 'addAsian' },
    { id: 'supervalue', inputId: 'addSupervalue' },
  ];
  builtInStores.forEach(({ id, inputId }) => {
    const el = document.getElementById(inputId);
    if (!el) return;
    const v = parseFloat(el.value);
    if (!isNaN(v) && v > 0) prices[id] = v;
  });

  // Custom stores entered inline
  for (let i = 1; i <= customStoreCount; i++) {
    const n = document.getElementById('csName_' + i)?.value.trim();
    const p = parseFloat(document.getElementById('csPrice_' + i)?.value);
    if (n && !isNaN(p) && p > 0) {
      const sid = n.toLowerCase().replace(/\s+/g, '_');
      if (!stores.find(s => s.id === sid)) {
        stores.push({ id: sid, name: n, color: '#9B5DE5', emoji: '🟣' });
      }
      prices[sid] = p;
    }
  }

  if (!Object.keys(prices).length) {
    showToast('Enter at least one price!');
    return;
  }

  items.push({ id: nextId++, name, quantity, category, prices, history: {} });
  saveCustomItems();

  // Reset form
  document.getElementById('addName').value = '';
  const qtyEl = document.getElementById('addQuantity');
  if (qtyEl) qtyEl.value = '';
  ['addTesco', 'addLidl', 'addAldi', 'addAsian', 'addSupervalue'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('customStoreInputs').innerHTML = '';
  customStoreCount = 0;

  showToast(`✅ ${name} added!`);
  renderBestDeals();
}

// ── Store management ──────────────────────────────────────────────
function renderStoreList() {
  document.getElementById('storeList').innerHTML = stores.map(s => `
    <div class="basket-item">
      <span class="store-badge" style="background:${s.color}">${s.emoji} ${s.name}</span>
      <div style="flex:1"></div>
      ${['tesco', 'lidl', 'aldi', 'asian', 'supervalue'].includes(s.id)
        ? '<span style="font-size:12px;color:#ccc;font-weight:700">Built-in</span>'
        : `<button class="btn btn-sm"
              style="background:#FFEEEE;color:#FF4444;border-radius:10px;"
              onclick="removeStore('${s.id}')">Remove</button>`}
    </div>`).join('');
}

function removeStore(id) {
  const idx = stores.findIndex(s => s.id === id);
  if (idx !== -1) stores.splice(idx, 1);
  renderStoreList();
  showToast('Store removed');
}

function openAddStore() {
  openModal(`
    <h3 style="font-family:'Fredoka One',cursive;margin-bottom:16px;">Add Custom Store</h3>
    <div class="form-row">
      <label class="form-label">Store Name</label>
      <input class="form-input" id="newStoreName" placeholder="e.g. Dunnes Stores"/>
    </div>
    <button class="btn btn-primary" onclick="saveStore()">Add Store</button>
  `);
}

function saveStore() {
  const name = document.getElementById('newStoreName').value.trim();
  if (!name) return;
  const id = name.toLowerCase().replace(/\s+/g, '_');
  if (!stores.find(s => s.id === id)) {
    stores.push({ id, name, color: '#9B5DE5', emoji: '🟣' });
    showToast(`✅ ${name} added!`);
  }
  closeModal();
  renderStoreList();
}
