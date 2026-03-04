# 🛒 BasketBuddy

**The smartest way to compare grocery prices across Dublin stores.**

BasketBuddy helps you save money on every grocery shop by comparing prices across **Tesco, Lidl, Aldi, Asian Supermarket, and Super Value** — all in one place. Available as a **progressive web app** and a **native Android app**.

[![Deploy to GitHub Pages](https://github.com/DvbyDt/BasketBuddy/actions/workflows/deploy.yml/badge.svg)](https://github.com/DvbyDt/BasketBuddy/actions/workflows/deploy.yml)

---

## 📲 Download

| Platform | Link |
|----------|------|
| 🌐 **Web App** | [dvbydt.github.io/BasketBuddy](https://dvbydt.github.io/BasketBuddy/) |
| 🤖 **Android APK** | [Download BasketBuddy.apk](https://github.com/DvbyDt/BasketBuddy/releases/latest/download/BasketBuddy.apk) |

> **Android install:** Download the APK → open it on your phone → allow "Install from unknown sources" → tap Install. No Play Store needed!

---

## ✨ Features

| Feature | Web | Mobile |
|---------|:---:|:------:|
| 🔍 **Search & Compare** — instant price lookup across all stores | ✅ | ✅ |
| 💰 **Best Deals Feed** — top savings ranked automatically | ✅ | ✅ |
| 🧺 **Smart Basket** — build a basket, see cheapest route per store | ✅ | ✅ |
| 🤖 **AI Basket Optimizer** — Groq/Claude rearranges basket for max savings | ✅ | ✅ |
| 🧾 **Receipt Splitter** — assign items to "Me" / "Split" / "Them" | ✅ | ✅ |
| 📈 **5-Week Price Trends** — visual bar charts with AI insights | ✅ | ✅ |
| ➕ **Add Items & Stores** — extend the database on the fly | ✅ | ✅ |
| ⚙️ **Settings** — AI provider config, store management | ✅ | ✅ |
| 📷 **AI Receipt Scanner** — snap receipt, auto-extract items | 🔜 | 🔜 |
| 📱 **Native Mobile Experience** — smooth 60fps, offline data | — | ✅ |
| 🌐 **PWA Installable** — add to home screen on any device | ✅ | — |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      BasketBuddy Monorepo                   │
├──────────────┬──────────────────┬────────────────────────────┤
│   web/       │   mobile/        │   scraper/                 │
│   (PWA)      │   (React Native) │   (Python)                 │
│              │                  │                            │
│  index.html  │  Expo Router     │  grocery_scraper.py        │
│  css/        │  app/(tabs)/     │  parse_csv.py              │
│  js/         │    index.tsx     │  update_prices.py           │
│   ├ data.js  │    basket.tsx    │                            │
│   ├ compare  │    split.tsx     │  Reads CSV ──► Generates:  │
│   ├ basket   │    trends.tsx    │   • web/js/data.js         │
│   ├ split    │    settings.tsx  │   • mobile/shared/data.json│
│   ├ trends   │  shared/         │                            │
│   ├ additem  │   ├ store.ts     │  Auto-bumps cache version  │
│   ├ ai       │   ├ theme.ts     │  in web/index.html         │
│   └ ui       │   └ data.json    │                            │
│              │  components/     │                            │
│  Served via  │   ├ PriceCard    │                            │
│  GitHub      │   └ StoreBadge   │                            │
│  Pages       │                  │                            │
│              │  Built via EAS   │                            │
│              │  → Play Store    │                            │
└──────────────┴──────────────────┴────────────────────────────┘
```

### Data Flow

```
CSV (scraped prices)
       │
       ▼
 update_prices.py ──────┬──► web/js/data.js      (JavaScript module)
                        │
                        └──► mobile/shared/data.json (JSON import)
                                    │
                                    ▼
                              store.ts (typed data access layer)
                                    │
                              ┌─────┴──────┐
                              │            │
                         React Native    Web JS
                          Screens        Modules
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Web Frontend** | Vanilla HTML/CSS/JS, CSS custom properties, PWA manifest |
| **Mobile Frontend** | React Native (Expo SDK 52), TypeScript, Expo Router |
| **AI Integration** | Groq (free Llama 3.3) / Anthropic Claude Haiku |
| **Data Pipeline** | Python 3 — CSV parsing, JS/JSON code generation |
| **Web Hosting** | GitHub Pages (auto-deploy via GitHub Actions) |
| **Mobile Build** | EAS Build (Expo Application Services) |
| **Mobile Store** | Google Play Store (AAB via EAS Submit) |

---

## 📁 Project Structure

```
basketbuddy/
│
├── .github/
│   └── workflows/
│       └── deploy.yml              # GitHub Pages auto-deploy on push to main
│
├── web/                             # ── Progressive Web App ──────────────
│   ├── index.html                   # Single-page app shell (5 tab views)
│   ├── manifest.json                # PWA manifest for install prompt
│   ├── css/
│   │   └── styles.css               # Full styling (~600 lines)
│   └── js/
│       ├── data.js                  # Auto-generated: 91 items, 5 stores
│       ├── compare.js               # Search engine + best deals ranking
│       ├── basket.js                # Basket management + AI optimizer
│       ├── split.js                 # Receipt splitter (Me / ½ / Them)
│       ├── trends.js                # 5-week price charts + AI insights
│       ├── additem.js               # Add items + manage custom stores
│       ├── ai.js                    # AI provider abstraction (Groq/Anthropic)
│       ├── ui.js                    # Shared helpers (toast, modal, formatters)
│       └── app.js                   # Boot + initialization
│
├── mobile/                          # ── React Native (Expo) ──────────────
│   ├── app.json                     # Expo config (name, slug, package ID)
│   ├── eas.json                     # EAS Build profiles (dev/preview/prod)
│   ├── package.json                 # Dependencies (expo, expo-router, etc.)
│   ├── tsconfig.json                # TypeScript config (extends expo base)
│   ├── babel.config.js              # Babel preset for Expo
│   ├── app/
│   │   ├── _layout.tsx              # Root Stack navigator
│   │   └── (tabs)/
│   │       ├── _layout.tsx          # Tab bar (5 tabs with emoji icons)
│   │       ├── index.tsx            # 🔍 Compare — search + best deals
│   │       ├── basket.tsx           # 🧺 Basket — build + optimize
│   │       ├── split.tsx            # 🧾 Split — receipt splitter
│   │       ├── trends.tsx           # 📈 Trends — price charts
│   │       └── settings.tsx         # ⚙️ Settings — AI config + stores
│   ├── components/
│   │   ├── PriceCard.tsx            # Item card with prices + savings
│   │   └── StoreBadge.tsx           # Colored store badge component
│   ├── shared/
│   │   ├── data.json                # Auto-generated: same data as data.js
│   │   ├── store.ts                 # Data access (search, sort, filter)
│   │   └── theme.ts                 # Colors, fonts, shadows
│   └── assets/
│       ├── icon.png                 # App icon (1024×1024)
│       ├── adaptive-icon.png        # Android adaptive icon
│       ├── splash-icon.png          # Splash screen
│       └── favicon.png              # Web favicon
│
├── scraper/                         # ── Python Data Pipeline ─────────────
│   ├── grocery_scraper.py           # Scrapes live prices from store websites
│   ├── parse_csv.py                 # Parses exported CSV into structured data
│   ├── update_prices.py             # One-command: CSV → data.js + data.json
│   └── .env                         # API keys (not committed)
│
├── .gitignore                       # Ignores node_modules, .env, CSVs, etc.
└── README.md                        # You are here
```

---

## 🚀 Quick Start

### Prerequisites
- **Python 3.8+** (for web server & scraper)
- **Node.js 18+** and **npm** (for mobile app)

### Web App (local)
```bash
cd web
python3 -m http.server 8080
# Open http://localhost:8080
# Add ?admin=1 to URL for admin features (AI settings, scraper controls)
```

### Mobile App (local)
```bash
cd mobile
npm install
npx expo start
# Scan QR code with Expo Go app on your phone
# Or press 'w' for web preview
```

### Update Prices from CSV
```bash
cd scraper
python3 update_prices.py
# ✅ Reads CSV → generates web/js/data.js + mobile/shared/data.json
# ✅ Auto-bumps cache version in web/index.html
```

---

## 🏪 Supported Stores

| Store | ID | Color | Emoji |
|-------|-----|-------|-------|
| **Tesco** | `tesco` | `#EE1C25` | 🔴 |
| **Lidl** | `lidl` | `#0050AA` | 🔵 |
| **Aldi** | `aldi` | `#FF6600` | 🟠 |
| **Asian Supermarket** | `asian` | `#9B5DE5` | 🟣 |
| **Super Value** | `supervalue` | `#06D6A0` | 🟢 |

Custom stores can be added through the Settings tab in both web and mobile.

---

## 📊 Data

- **91 grocery items** across 11 categories (Dairy, Bakery, Meat, Produce, Fruits, Vegetables, Grains, Snacks, Drinks, Frozen, Other)
- Each item tracks: `name`, `quantity` (e.g. "2L", "500g"), `category`, per-store `prices`, and 5-week `history`
- Data is auto-generated by `scraper/update_prices.py` — never hand-edit `data.js` or `data.json`

---

## 🤖 AI Integration

BasketBuddy supports two AI providers for the **basket optimizer** (rearranges your basket across stores for maximum savings):

| Provider | Cost | Model | Setup |
|----------|------|-------|-------|
| **Groq** | Free | Llama 3.3 70B | [console.groq.com](https://console.groq.com) — no credit card |
| **Anthropic** | ~€0.003/request | Claude Haiku | [console.anthropic.com](https://console.anthropic.com) |

Configure in **Settings → AI Provider** (web: visible with `?admin=1`).

---

## 🚢 Deployment

### Web → GitHub Pages
The repo includes a GitHub Actions workflow that auto-deploys on push to `main`:

```bash
git push origin main
# GitHub Actions deploys web/ → https://<username>.github.io/BasketBuddy
```

### Mobile → Google Play Store

#### 1. Install EAS CLI
```bash
npm install -g eas-cli
eas login
```

#### 2. Build test APK
```bash
cd mobile
eas build --platform android --profile preview
# Downloads .apk — install on any Android phone
```

#### 3. Build production AAB
```bash
cd mobile
eas build --platform android --profile production
# Downloads .aab — upload to Google Play Console
```

#### 4. Submit to Play Store
```bash
eas submit --platform android
```

Or manually upload the `.aab` at [Google Play Console](https://play.google.com/console) ($25 one-time fee).

---

## 🛠️ Development

### Adding a new item (manual)
Use the **Settings (➕)** tab in the web app — enter name, quantity, category, and prices per store.

### Adding items in bulk
1. Update the CSV file in `scraper/`
2. Run `python3 scraper/update_prices.py`
3. Both `data.js` and `data.json` are regenerated automatically

### Adding a new screen (mobile)
1. Create `mobile/app/(tabs)/myscreen.tsx`
2. Add a `<Tabs.Screen>` entry in `mobile/app/(tabs)/_layout.tsx`
3. Import shared data from `../../shared/store`

### Styling conventions
- **Web**: CSS custom properties (`--primary`, `--tesco`, etc.) in `styles.css`
- **Mobile**: Centralized in `shared/theme.ts` — `COLORS`, `FONTS`, `SHADOWS`

---

## 📸 Screenshots

> *Coming soon — add screenshots of the Compare, Basket, Split, and Trends tabs here.*

---

## 📝 License

MIT

---

## 🙏 Credits

Built with ❤️ in Dublin. Helping students and families save money on groceries, one shop at a time.
