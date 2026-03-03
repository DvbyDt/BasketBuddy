# 🛒 BasketBuddy

A mobile-first PWA for comparing grocery prices across Tesco, Lidl, Aldi, Asian Supermarket & Super Value in Dublin — with AI-powered features including a basket optimiser, receipt scanner, and price trend insights.

---

## 📁 File Structure

```
basketbuddy/
├── index.html          ← Main HTML (entry point)
├── manifest.json       ← PWA manifest
├── css/
│   └── style.css       ← All styles
└── js/
    ├── data.js         ← All item/store data & state
    ├── utils.js        ← Shared helpers (toast, modal, navigation)
    ├── compare.js      ← Search & price comparison
    ├── basket.js       ← Basket + AI basket optimiser
    ├── split.js        ← Receipt splitter (Splitwise-style)
    ├── trends.js       ← Price trend charts
    ├── additem.js      ← Add items & manage stores
    └── app.js          ← App initialisation
```

---

## 🚀 Running Locally in VS Code

### Option 1 — Live Server (recommended)
1. Install the **Live Server** extension in VS Code
2. Right-click `index.html` → **Open with Live Server**
3. Opens at `http://127.0.0.1:5500`

### Option 2 — Python HTTP server
```bash
cd basketbuddy
python3 -m http.server 8080
# Open http://localhost:8080
```

### Option 3 — Node http-server
```bash
npm install -g http-server
cd basketbuddy
http-server
```

> ⚠️ You **must** serve over HTTP (not open as a file) for the Anthropic API calls to work correctly in the receipt scanner.

---

## ✨ Features

| Tab | Feature |
|-----|---------|
| 🔍 Compare | Search items, see ranked prices, best deal highlighted |
| 🧺 Basket | Build a basket, AI groups by cheapest store |
| 🧾 Split | Scan receipt with AI, assign items to Me / Shared / Roommate |
| 📈 Trends | 5-week price history charts + AI insights |
| ➕ Add | Add items, prices, and custom stores |

---

## 🤖 AI Features (Anthropic API)

The **Receipt Scanner** calls the Anthropic API to extract items from a photo. When running locally the API key is injected automatically by the Claude.ai environment.

To use outside Claude.ai, add your API key to the fetch call in `js/split.js`:

```js
headers: {
  'Content-Type': 'application/json',
  'x-api-key': 'YOUR_API_KEY_HERE',
  'anthropic-version': '2023-06-01',
  'anthropic-dangerous-direct-browser-access': 'true'
}
```

---

## 📱 Installing as a PWA

Once hosted (e.g. on Vercel, Netlify, or GitHub Pages):
- **iOS**: Safari → Share → Add to Home Screen
- **Android**: Chrome → Menu → Add to Home Screen
- **Desktop**: Chrome address bar → Install icon

---

## 🛣️ Future Improvements

- [ ] Real-time price scraping via backend API
- [ ] User accounts & price contribution history
- [ ] Push notifications for price drops
- [ ] Barcode scanner for quick item lookup
- [ ] Weekly shopping list planner
