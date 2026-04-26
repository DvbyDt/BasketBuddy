<p align="center">
  <img src="https://img.shields.io/github/actions/workflow/status/DvbyDt/BasketBuddy/deploy.yml?branch=main&label=Web%20Deploy&logo=github&style=for-the-badge" alt="Web Deploy"/>
  <img src="https://img.shields.io/github/actions/workflow/status/DvbyDt/BasketBuddy/release-apk.yml?branch=main&label=Android%20Build&logo=android&style=for-the-badge" alt="Android Build"/>
  <img src="https://img.shields.io/badge/Expo-SDK%2054-1B1F23?logo=expo&logoColor=white&style=for-the-badge" alt="Expo SDK"/>
  <img src="https://img.shields.io/badge/React%20Native-0.81.5-61DAFB?logo=react&logoColor=white&style=for-the-badge" alt="React Native"/>
  <img src="https://img.shields.io/badge/Firebase-Cloud%20Sync-FFCA28?logo=firebase&logoColor=white&style=for-the-badge" alt="Firebase"/>
  <img src="https://img.shields.io/badge/AI-Groq%20Vision-8B5CF6?logo=openai&logoColor=white&style=for-the-badge" alt="AI"/>
  <img src="https://img.shields.io/badge/Android-APK%20Ready-3DDC84?logo=android&logoColor=white&style=for-the-badge" alt="Android"/>
  <img src="https://img.shields.io/badge/PWA-Installable-5A0FC8?logo=pwa&logoColor=white&style=for-the-badge" alt="PWA"/>
  <img src="https://img.shields.io/github/license/DvbyDt/BasketBuddy?style=for-the-badge" alt="License"/>
</p>

# BasketBuddy


BasketBuddy is a grocery price comparison app built for Dublin shoppers. Compare prices across Tesco, Lidl, Aldi, SuperValu, and Asian Supermarket — then split receipts with housemates using Groq Vision AI that reads your actual receipt photo and handles Clubcard discounts automatically.

Available as a **native Android APK** and an **installable PWA**, with real-time Firebase sync for custom items and baskets.

---

## Feature Matrix

| Feature | Web | Mobile | Description |
|---------|:---:|:------:|-------------|
| 🔍 **Search & Compare** | ✅ | ✅ | Instant price lookup across all 5 stores, sorted cheapest-first |
| 💰 **Best Deals Feed** | ✅ | ✅ | Items with the biggest price gaps — auto-ranked by savings |
| 🧺 **Smart Basket** | ✅ | ✅ | Build a basket, see the cheapest single store for the whole shop |
| 🤖 **AI Basket Optimizer** | ✅ | ✅ | Groups basket by cheapest store, calculates total savings + AI tips |
| 🧾 **Receipt Splitter** | ✅ | ✅ | Scan a receipt with Groq Vision AI — assign items per person, share the split |
| 📊 **Price Per Unit** | — | ✅ | €/100g or €/100ml shown under each store price for fair comparison |
| 📈 **5-Week Price Trends** | ✅ | ✅ | Bar charts per store per week, color-coded, with category filters |
| 📤 **Share Split** | — | ✅ | One-tap share of the split summary to WhatsApp / iMessage / email |
| ➕ **Custom Items & Stores** | ✅ | ✅ | Add your own items/stores — synced via Firebase |
| 🔥 **Real-time Cloud Sync** | ✅ | ✅ | Custom items and baskets sync instantly via Firestore `onSnapshot` |
| 🔐 **Anonymous Auth** | ✅ | ✅ | Zero friction — UID assigned instantly, Firestore rules enforce ownership |
| 🌐 **PWA Installable** | ✅ | — | Add to home screen on any device |
| 🔄 **Auto CI/CD** | ✅ | ✅ | Push to `main` → web auto-deploys + Android APK auto-builds via EAS |
| 🕷️ **Weekly Auto-Scraper** | ✅ | ✅ | GitHub Actions scrapes fresh prices every Monday at 6am UTC |

---

## How Key Features Work

### 🧾 Receipt Splitter (the unique feature)

1. Take a photo of your receipt
2. Groq Vision AI (`meta-llama/llama-4-scout-17b-16e-instruct`) reads and parses it in one call — no separate OCR service needed
3. Tesco Clubcard discounts are merged into net item prices automatically (no double-counting)
4. Assign each item to **Me**, **½ Split**, or **Them**
5. Tap **Share split with group** to send totals via any app

Completely free — powered by Groq's free tier.

### 🧺 Smart Basket + AI Optimizer

Build a basket from the price database. The optimizer groups items by cheapest store, shows total savings vs buying everything at the most expensive stores, and optionally generates an AI tip via Groq (free) or Anthropic Claude (paid, ~€0.003/request).

### 📊 Price Per Unit

Every store price shows `€X.XX/100g` or `€X.XX/100ml` automatically — handles kg→g and L→ml conversion so you can compare a 500g pack vs a 1kg pack fairly.

---

## Architecture

```
                        ┌──────────────────────────┐
                        │      GitHub (main)         │
                        └────────────┬──────────────┘
                                     │ push
                     ┌───────────────┼───────────────┐
                     ▼               ▼               ▼
           ┌──────────────┐  ┌─────────────┐  ┌──────────────┐
           │  deploy.yml   │  │ release-    │  │  scrape.yml  │
           │  (web deploy) │  │ apk.yml     │  │  (Mon 6am)   │
           └──────┬───────┘  │ (EAS build) │  └──────┬───────┘
                  ▼          └──────┬──────┘         ▼
         ┌────────────────┐         ▼         ┌─────────────────┐
         │  GitHub Pages  │  ┌─────────────┐  │  data.json +    │
         │  (Static PWA)  │  │  EAS Build  │  │  web/js/data.js │
         └────────┬───────┘  │  (APK)      │  └─────────────────┘
                  │          └──────┬──────┘
                  │                 │ GitHub Release
                  └────────┬────────┘
                           ▼
                  Firebase Firestore
                  (basketbuddy-e6676)
                  ┌──────────────────────────────┐
                  │ users/{uid}/customItems/*     │
                  │ users/{uid}/basket/*          │
                  └──────────────────────────────┘
```

### Data Flow

```
 Tesco.ie (Playwright)    Lidl.ie (requests)    Aldi.ie
          └───────────────────┬───────────────────┘
                              ▼
                   unified_scraper.py
                   (AI-assisted query generation via Groq)
                              │
                    ┌─────────┴──────────┐
                    ▼                    ▼
            web/js/data.js      mobile/shared/data.json
            (JS module)         (JSON import)
                    │                    │
                    ▼                    ▼
                Web PWA          React Native App
                    │                    │
                    └──────────┬─────────┘
                               ▼
                      Firebase Firestore
                      (real-time sync layer)
```

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Mobile** | React Native + Expo | SDK 54, RN 0.81.5 |
| **Mobile Navigation** | Expo Router | ~6.0.23 |
| **Language** | TypeScript | ~5.9.2 |
| **Web Frontend** | Vanilla HTML/CSS/JS | — |
| **Cloud Database** | Firebase Firestore | v12.10.0 |
| **Authentication** | Firebase Anonymous Auth | — |
| **AI — Receipt OCR** | Groq Vision (`llama-4-scout`) | Free |
| **AI — Basket Tips** | Groq (`llama-3.3-70b`) | Free |
| **AI — Basket Tips (paid)** | Anthropic Claude Haiku 4.5 | ~€0.003/req |
| **Web Hosting** | GitHub Pages | — |
| **Mobile Build** | EAS Build | — |
| **CI/CD** | GitHub Actions | v4 |
| **Scraping** | Playwright + Requests | — |

---

## Project Structure

```
BasketBuddy/
│
├── .github/
│   └── workflows/
│       ├── deploy.yml          # Web → GitHub Pages on push to main
│       ├── release-apk.yml     # Triggers EAS build → GitHub Release with APK
│       └── scrape.yml          # Weekly scraper (Mon 6am UTC) + manual trigger
│
├── web/                        # Progressive Web App
│   ├── index.html
│   ├── manifest.json
│   ├── css/styles.css
│   └── js/
│       ├── data.js             # Auto-generated price data
│       ├── firebase-sync.js
│       ├── ai.js               # Groq + Anthropic
│       ├── compare.js
│       ├── basket.js
│       ├── split.js
│       ├── trends.js
│       ├── additem.js
│       └── app.js
│
├── mobile/                     # React Native (Expo SDK 54)
│   ├── app.config.js           # Expo config (plain JS — required for EAS sucrase)
│   ├── eas.json                # Build profiles (dev / preview / production)
│   ├── package.json
│   ├── tsconfig.json
│   ├── app/
│   │   ├── _layout.tsx         # Root layout + animated splash
│   │   └── (tabs)/
│   │       ├── _layout.tsx     # Tab bar with dynamic safe area insets
│   │       ├── index.tsx       # 🔍 Compare
│   │       ├── basket.tsx      # 🧺 Basket + AI optimizer
│   │       ├── split.tsx       # 🧾 Receipt splitter
│   │       ├── trends.tsx      # 📈 Price trends
│   │       └── settings.tsx    # ⚙️ Settings
│   ├── components/
│   │   ├── PriceCard.tsx       # Item card with price-per-unit display
│   │   └── StoreBadge.tsx      # Store chip (fixed 52px sm variant)
│   └── shared/
│       ├── data.json           # Auto-generated price data
│       ├── store.ts            # Data access + parseQuantity + fmtPerUnit
│       ├── localReceiptScanner.ts  # Groq Vision receipt OCR + parsing
│       ├── firebase.ts
│       ├── firestore.ts
│       ├── types.ts
│       ├── theme.ts            # Colors, fonts, rs() responsive scale
│       └── BasketContext.tsx
│
├── scraper/
│   ├── unified_scraper.py      # Scrapes Tesco, Lidl, Aldi, Asian Supermarket
│   ├── requirements.txt
│   └── query_cache.json        # Cached AI-generated search queries
│
├── firestore.rules
└── README.md
```

---

## Quick Start

### Web App

```bash
git clone https://github.com/DvbyDt/BasketBuddy.git
cd BasketBuddy/web
python3 -m http.server 8080
# Open http://localhost:8080
```

### Mobile App (local dev)

```bash
cd mobile

# Create mobile/.env with your keys
cp .env.example .env   # or create manually (see Environment Variables below)

npm install --legacy-peer-deps
npx expo start

# Press 'a' for Android emulator, scan QR for Expo Go
```

### Build Android APK

The APK builds automatically via GitHub Actions on every push to `main` that touches `mobile/**`. The APK is attached to the GitHub Release.

To build manually:

```bash
cd mobile
npm install -g eas-cli
eas login
eas build --platform android --profile preview
```

---

## Environment Variables

### Local development — `mobile/.env`

```
EXPO_PUBLIC_GROQ_API_KEY=your_groq_key_here
EXPO_PUBLIC_FUNCTIONS_BASE_URL=https://us-central1-basketbuddy-e6676.cloudfunctions.net
FIREBASE_API_KEY=...
FIREBASE_AUTH_DOMAIN=...
FIREBASE_PROJECT_ID=...
FIREBASE_STORAGE_BUCKET=...
FIREBASE_MESSAGING_SENDER_ID=...
FIREBASE_APP_ID=...
```

This file is gitignored. Get a free Groq key at [console.groq.com](https://console.groq.com).

### EAS builds — Expo secrets

```bash
cd mobile
eas env:create --name EXPO_PUBLIC_GROQ_API_KEY --value "gsk_..." \
  --environment production --visibility sensitive
# Repeat for all FIREBASE_* and EXPO_PUBLIC_* vars
```

### GitHub Actions — repo secrets

Set `EXPO_TOKEN` in **Settings → Secrets and variables → Actions** (get it from expo.dev → Account Settings → Access Tokens).

---

## CI/CD Pipeline

| Workflow | Trigger | What it does |
|----------|---------|-------------|
| `deploy.yml` | Push to `main` | Deploys `web/` to GitHub Pages |
| `release-apk.yml` | Push to `main` (mobile/**) or manual | Triggers EAS build → downloads APK → creates GitHub Release |
| `scrape.yml` | Every Monday 6am UTC or manual | Runs `unified_scraper.py`, commits updated price data if changed |

### Trigger a manual scrape

```bash
gh workflow run scrape.yml --ref main
# Or: GitHub → Actions → "Weekly Price Scraper" → Run workflow
```

---

## Receipt Scanner — How It Works

1. User picks a receipt photo from camera or gallery
2. Image is base64-encoded and sent to Groq Vision API
3. Single LLM call reads text + parses structured items simultaneously
4. Post-processing rules:
   - Tesco Clubcard "Cc" discounts are merged into net item prices
   - Bottom-of-receipt summary lines (Savings, Promotions, VAT) are stripped
   - `isDiscount` is hardcoded `false` — no discount line items ever reach the split screen
5. Items arrive ready to assign to people

---

## License
MIT
