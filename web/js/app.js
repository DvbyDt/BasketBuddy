// ─── js/app.js ───────────────────────────────────────────────────
// App initialisation — runs once the page loads.

document.addEventListener('DOMContentLoaded', () => {
  renderBestDeals();
  loadAISettingsIntoForm();
  updateAIStatusPill();
  initScraperStatus();
});

function initScraperStatus() {
  // Check if we have a stored last-updated timestamp
  const lastRun = localStorage.getItem('scraper_last_run');
  const meta    = document.getElementById('scraperMeta');
  const status  = document.getElementById('scraperStatus');
  if (!meta || !status) return;

  if (lastRun) {
    const d = new Date(lastRun);
    meta.textContent = `Last updated: ${d.toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    status.textContent = '✅ Up to date';
    status.style.color = 'var(--green)';
  }
}

function showScraperInfo() {
  openModal(`
    <h3 style="font-family:'Fredoka One',cursive;margin-bottom:16px;">🤖 How to Update Prices</h3>
    <p style="font-size:13px;color:var(--muted);font-weight:600;margin-bottom:16px;">
      Run the Python scraper on your computer to fetch live prices from Tesco.ie and Lidl.ie.
    </p>

    <div style="background:#F8F8F8;border-radius:12px;padding:14px;margin-bottom:12px;">
      <div style="font-size:11px;font-weight:800;color:var(--muted);margin-bottom:8px;">STEP 1 — Install</div>
      <code style="font-size:12px;display:block;line-height:1.8;color:var(--text);">
        pip install requests beautifulsoup4<br/>
        pip install playwright lxml<br/>
        playwright install chromium
      </code>
    </div>

    <div style="background:#F8F8F8;border-radius:12px;padding:14px;margin-bottom:12px;">
      <div style="font-size:11px;font-weight:800;color:var(--muted);margin-bottom:8px;">STEP 2 — Run (with free AI)</div>
      <code style="font-size:12px;display:block;line-height:1.8;color:var(--text);">
        # Install Ollama: ollama.com/download<br/>
        ollama pull llama3.2<br/>
        python grocery_scraper.py --force --ai
      </code>
    </div>

    <div style="background:#F8F8F8;border-radius:12px;padding:14px;margin-bottom:16px;">
      <div style="font-size:11px;font-weight:800;color:var(--muted);margin-bottom:8px;">STEP 3 — Update data.js</div>
      <code style="font-size:12px;display:block;line-height:1.8;color:var(--text);">
        python parse_csv.py<br/>
        # Copy output into js/data.js
      </code>
    </div>

    <div style="background:linear-gradient(135deg,#667eea,#764ba2);border-radius:12px;padding:14px;color:white;">
      <div style="font-weight:800;margin-bottom:6px;">🚀 Coming soon: Auto-sync</div>
      <div style="font-size:12px;opacity:0.9;">GitHub Actions will run the scraper weekly and update prices automatically with zero manual work.</div>
    </div>

    <button class="btn btn-primary" style="margin-top:16px;" onclick="closeModal()">Got it!</button>
  `);
}
