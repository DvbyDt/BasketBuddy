// ─── js/trends.js ────────────────────────────────────────────────
// Renders 5-week price history bar charts + AI insights per item.

const TREND_INSIGHTS = {
  7:  'Grapes are €0.40 cheaper at Tesco vs Lidl this week 🍇',
  10: 'Scallions: 37% cheaper at Lidl (€0.88) vs Tesco (€1.39) 🧅',
  11: 'Broccoli prices nearly the same — Lidl just 6c cheaper 🥦',
  20: 'Carrots 1kg: identical price at both Lidl and Tesco! 🥕',
  25: 'Red Onions: 17% cheaper at Lidl vs Tesco 🧅',
  26: 'Red Apples: save €0.26 by buying at Lidl instead of Tesco 🍎',
  50: 'Avocado pack: Tesco is €1.10 cheaper than Lidl! 🥑',
  58: 'Whole Milk: same price at Super Value and Tesco 🥛',
};

const STORE_COLORS = ['#EE1C25', '#0050AA', '#FF6600', '#9B5DE5', '#06D6A0'];
const WEEK_LABELS  = ['W1', 'W2', 'W3', 'W4', 'W5'];

function renderTrends() {
  const el = document.getElementById('trendsContainer');
  el.innerHTML = items.slice(0, 6).map(item => {
    const storeData = stores.map((s, si) => {
      const hist = item.history?.[s.id] || [item.prices[s.id] || 0];
      const maxH = Math.max(...hist);
      return { store: s, hist, maxH, color: STORE_COLORS[si] || '#9B5DE5' };
    });
    const globalMax = Math.max(...storeData.map(d => d.maxH));

    return `<div class="trend-card">
      <div class="trend-header">
        <div class="trend-title">${item.name}${item.quantity ? ' <span style="font-weight:600;color:var(--muted);font-size:12px">(' + item.quantity + ')</span>' : ''}</div>
        <span style="font-size:12px;color:var(--muted);font-weight:700">${item.category}</span>
      </div>
      <div style="display:flex;gap:16px;">
        ${storeData.map(d => `
          <div style="flex:1">
            <div style="font-size:10px;font-weight:800;color:${d.store.color};margin-bottom:4px">
              ${d.store.emoji} ${d.store.name}
            </div>
            <div class="trend-chart">
              ${d.hist.map((v, i) => `
                <div style="flex:1;display:flex;flex-direction:column;align-items:center">
                  <div class="trend-bar"
                    style="background:${d.color};height:${Math.round((v / globalMax) * 55) + 5}px;
                           opacity:${0.5 + 0.5 * (i / (d.hist.length - 1))}">
                  </div>
                  <div class="trend-bar-label">${WEEK_LABELS[i]}</div>
                </div>`).join('')}
            </div>
            <div style="font-size:13px;font-weight:800;color:${d.store.color};margin-top:4px">
              ${fmt(d.hist[d.hist.length - 1])}
            </div>
          </div>`).join('')}
      </div>
      ${TREND_INSIGHTS[item.id]
        ? `<div class="trend-insight">💡 ${TREND_INSIGHTS[item.id]}</div>`
        : ''}
    </div>`;
  }).join('');
}
