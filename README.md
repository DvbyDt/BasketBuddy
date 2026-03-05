# 🛒 BasketBuddy

**Compare grocery prices across Dublin stores. Save money on every shop.**

BasketBuddy is a full-stack grocery price comparison platform that helps Dublin shoppers find the cheapest prices across **Tesco, Lidl, Aldi, Asian Supermarket, and Super Value**. Available as a **progressive web app** and a **native Android app**, with **real-time cloud sync** so custom items and baskets are shared across all users and devices.

[![Deploy to GitHub Pages](https://github.com/DvbyDt/BasketBuddy/actions/workflows/deploy.yml/badge.svg)](https://github.com/DvbyDt/BasketBuddy/actions/workflows/deploy.yml)

---

## 📲 Download

| Platform | Link |
|----------|------|
| 🌐 **Web App** | [dvbydt.github.io/BasketBuddy](https://dvbydt.github.io/BasketBuddy/) |
| 🤖 **Android APK** | [Download BasketBuddy.apk](https://github.com/DvbyDt/BasketBuddy/releases/latest/download/BasketBuddy.apk) |

> **Android install:** Download the APK → open it on your phone → allow "Install from unknown sources" → tap Install.

---

## ✨ Features

| Feature | Web | Mobile |
|---------|:---:|:------:|
| 🔍 **Search & Compare** — instant price lookup across all stores | ✅ | ✅ |
| 💰 **Best Deals Feed** — top savings ranked automatically | ✅ | ✅ |
| 🧺 **Smart Basket** — build a basket, see cheapest route per store | ✅ | ✅ |
| 🤖 **AI Basket Optimizer** — rearranges basket for max savings | ✅ | ✅ |
| 🧾 **Receipt Splitter** — assign items to "Me" / "Split" / "Them" | ✅ | ✅ |
| 📈 **5-Week Price Trends** — visual bar charts per category | ✅ | ✅ |
| ➕ **Add Custom Items** — extend the database on the fly | ✅ | ✅ |
| 🔥 **Real-time Cloud Sync** — custom items & basket sync via Firebase | ✅ | ✅ |
| 🔐 **Firebase Auth** — anonymous auth + Firestore security rules | ✅ | ✅ |
| 📱 **Native Mobile Experience** — animated splash, smooth 60fps | — | ✅ |
| 🌐 **PWA Installable** — add to home screen on any device | ✅ | — |
| 🔄 **Auto CI/CD** — push to main → web deploys + APK builds | ✅ | ✅ |

---

## 🏗️ Architecture

### High-Level Overview

```
                          ┌──────────────────┐
                          │   GitHub (main)   │
                          └──────┬───────────┘
                                 │ push
                    ┌────────────┼────────────┐
                    ▼                         ▼
          ┌─────────────────┐       ┌──────────────────┐
          │  GitHub Actions  │       │   EAS Workflow    │
          │  deploy.yml      │       │   build.yml       │
          └────────┬────────┘       └────────┬─────────┘
                   ▼                         ▼
          ┌─────────────────┐       ┌──────────────────┐
          │  GitHub Pages    │       │   EAS Build       │
          │  (Web PWA)       │       │   (Android APK)   │
          └────────┬────────┘       └────────┬─────────┘
                   │                         │
                   └────────────┬────────────┘
                                ▼
                    ┌───────────────────────┐
                    │   Firebase Firestore   │
                    │   (Cloud Database)     │
                    │                       │
                    │  ┌─────────────────┐  │
                    │  │  customItems    │  │
                    │  │  sharedBasket   │  │
                    │  └─────────────────┘  │
                    │                       │
                    │   Firebase Auth        │
                    │   (Anonymous)          │
                    └───────────────────────┘
```

### Monorepo Structure

```
basketbuddy/
│
├── .github/workflows/
│   └── deploy.yml                  # GitHub Pages auto-deploy
│
├── web/                            # ── Progressive Web App ──────────
│   ├── index.html                  # Single-page shell (5 tab views)
│   ├── manifest.json               # PWA manifest
│   ├── css/styles.css              # Full styling (~600 lines)
│   └── js/
│       ├── data.js                 # Auto-generated: 91 items, 5 stores
│       ├── firebase-sync.js        # Firestore cloud sync + auth
│       ├── compare.js              # Search engine + best deals
│       ├── basket.js               # Basket management + AI optimizer
│       ├── split.js                # Receipt splitter
│       ├── trends.js               # Price trend charts
│       ├── additem.js              # Add items + stores
│       ├── ai.js                   # AI provider abstraction
│       ├── ui.js                   # Shared UI helpers
│       └── app.js                  # Boot + initialization
│
├── mobile/                         # ── React Native (Expo) ──────────
│   ├── app.json                    # Expo config
│   ├── eas.json                    # EAS Build profiles
│   ├── .eas/workflows/
│   │   └── build.yml               # Auto-build APK on push to main
│   ├── app/
│   │   ├── _layout.tsx             # Root layout + animated splash screen
│   │   └── (tabs)/
│   │       ├── _layout.tsx         # Tab bar (5 tabs)
│   │       ├── index.tsx           # 🔍 Compare
│   │       ├── basket.tsx          # 🧺 Basket
│   │       ├── split.tsx           # 🧾 Split
│   │       ├── trends.tsx          # 📈 Trends
│   │       └── settings.tsx        # ⚙️ Settings
│   ├── components/
│   │   ├── PriceCard.tsx           # Item card with "+ Basket" button
│   │   └── StoreBadge.tsx          # Colored store badge
│   └── shared/
│       ├── data.json               # Auto-generated item data
│       ├── store.ts                # Data access layer + cloud sync
│       ├── firebase.ts             # Firebase init + anonymous auth
│       ├── firestore.ts            # Firestore CRUD + real-time listeners
│       ├── types.ts                # Shared TypeScript interfaces
│       ├── theme.ts                # Colors, fonts, shadows
│       └── BasketContext.tsx        # React Context for shared basket
│
├── scraper/                        # ── Python Data Pipeline ─────────
│   ├── grocery_scraper.py          # Scrapes live prices
│   ├── parse_csv.py                # CSV → structured data
│   └── update_prices.py            # One-command: CSV → data.js + data.json
│
├── firebase.json                   # Firebase project config
├── firestore.rules                 # Firestore security rules
└── README.md
```

### Data Flow

```
                                  ┌──────────────┐
                                  │  CSV prices   │
                                  └──────┬───────┘
                                         ▼
                                  update_prices.py
                                   ┌─────┴──────┐
                                   ▼             ▼
                            web/js/data.js   mobile/shared/data.json
                                   │             │
                                   ▼             ▼
                               Web JS        store.ts
                              Modules     (typed data access)
                                   │             │
                                   └──────┬──────┘
                                          ▼
                                   Firebase Firestore
                                (custom items + basket sync)
                                          │
                                  ┌───────┴───────┐
                                  ▼               ▼
                              User-1's         User-2's
                               Device           Device
```

---

## 🔧 Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Web Frontend** | Vanilla HTML/CSS/JS | Zero build step, instant deploy, tiny bundle — perfect for a static price comparison |
| **Mobile Frontend** | React Native + Expo SDK 52 | Cross-platform from one codebase, Expo handles native builds without Xcode/Android Studio |
| **Navigation** | Expo Router ~4.0 | File-based routing, same mental model as Next.js |
| **Cloud Database** | Firebase Firestore | Real-time sync, generous free tier (1 GB), offline-first caching on mobile |
| **Authentication** | Firebase Auth (Anonymous) | Zero-friction — users get a UID instantly, no sign-up form needed |
| **Web Hosting** | GitHub Pages | Free, auto-deploys from GitHub Actions, perfect for static PWA |
| **Mobile Build** | EAS Build (Expo) | Cloud builds — no need for local Android SDK. Produces APK/AAB |
| **CI/CD (Web)** | GitHub Actions | Push to main → auto-deploy to GitHub Pages |
| **CI/CD (Mobile)** | EAS Workflows | Push to main → auto-build Android APK on Expo servers |
| **Data Pipeline** | Python 3 | Quick CSV → JS/JSON code generation, one-command price updates |

---

## 🤔 Design Decisions & Trade-offs

### Why Vanilla JS for Web (not React)?

| Pro | Con |
|-----|-----|
| Zero build step — edit and deploy instantly | No component model — UI code is more imperative |
| Tiny payload (~50 KB total vs ~150 KB+ for React) | Harder to maintain as app grows |
| Works on GitHub Pages with no bundler | Manual DOM manipulation vs declarative rendering |

**Verdict:** For a 5-tab price comparison app with mostly static data, vanilla JS keeps things simple and fast. React would be overkill for the web side.

### Why React Native / Expo for Mobile (not Flutter or PWA)?

| Option | Pros | Cons |
|--------|------|------|
| **React Native + Expo** ✅ | JS/TS shared logic with web, huge ecosystem, EAS cloud builds, hot reload | Larger APK (~66 MB), bridge overhead |
| **Flutter** | Smaller APK, smoother animations | Dart (can't share code with web JS), separate ecosystem |
| **PWA only** | Zero install, one codebase | No app store presence, limited native APIs, worse offline UX |

**Verdict:** Expo lets us share TypeScript types and data logic between web and mobile. EAS handles builds in the cloud so no local Android SDK is needed. The 66 MB APK is acceptable for the feature set.

### Why Firebase over Supabase?

| | Firebase | Supabase |
|---|---|---|
| **Offline-first** | ✅ Firestore caches locally, syncs when online | ❌ No native offline cache |
| **Real-time sync** | ✅ `onSnapshot` listeners built-in | ⚠️ WebSocket-based, weaker mobile support |
| **Data model** | NoSQL (flexible, matches our item schema) | PostgreSQL (needs migrations for schema changes) |
| **React Native SDK** | Mature, well-documented | JS client works but no native offline persistence |
| **Self-hosting** | ❌ Vendor lock-in | ✅ Full Docker self-host |

**Verdict:** For a grocery app used in stores with spotty mobile signal, Firestore's **offline-first caching** is the killer feature. Data is document-shaped (items with nested prices), which maps naturally to NoSQL. If we needed complex relational queries or wanted self-hosting, Supabase would win.

### Why Anonymous Auth (not Email/Password)?

| Approach | UX | Security |
|----------|-----|---------|
| **Anonymous Auth** ✅ | Instant — no sign-up friction | Each device gets a unique UID, rules enforce ownership |
| **Email/Password** | Requires registration form | Stronger identity, but overkill for a grocery app |
| **No Auth** | Simplest | Firestore is wide open — anyone can delete anything |

**Verdict:** Anonymous auth gives us Firestore security rules (only authenticated users can read/write, only creators can delete) without making users create an account. Perfect for a utility app.

### Why EAS Workflows (not GitHub Actions for mobile)?

| | EAS Workflows | GitHub Actions + EAS CLI |
|---|---|---|
| **Setup** | 4-line YAML, native Expo integration | Need EXPO_TOKEN secret, install eas-cli, 20+ line YAML |
| **Auth** | Automatic via GitHub App link | Manual token management |
| **Build triggers** | Native `on: push` support | Works but more boilerplate |
| **Cost** | Free tier (limited queue priority) | Free tier + EAS build minutes |

**Verdict:** EAS Workflows is purpose-built for Expo projects. One `type: build` declaration replaces 15+ lines of GitHub Actions setup.

---

## 🔐 Security

### Three Layers of Protection

```
┌─────────────────────────────────────────────────┐
│  Layer 1: Firebase Auth (Anonymous)              │
│  → Every user auto-signs in with a unique UID    │
│  → No unauthenticated access to Firestore        │
├─────────────────────────────────────────────────┤
│  Layer 2: Firestore Security Rules               │
│  → customItems: auth read/write, creator-only    │
│    delete                                        │
│  → sharedBasket: auth read/write                 │
│  → Everything else: deny all                     │
├─────────────────────────────────────────────────┤
│  Layer 3: API Key Restrictions (GCP Console)     │
│  → HTTP referrer whitelist (github.io, localhost) │
│  → API restrictions (Firestore + Auth APIs only)  │
└─────────────────────────────────────────────────┘
```

### Firestore Rules Summary

| Collection | Read | Create | Update | Delete |
|-----------|------|--------|--------|--------|
| `customItems` | Auth required | Auth + `createdBy == uid` | Auth required | Auth + `createdBy == uid` |
| `sharedBasket` | Auth required | Auth required | Auth required | Auth required |
| Everything else | Denied | Denied | Denied | Denied |

---

## 🔄 CI/CD Pipeline

### Web (GitHub Actions)
```
Push to main → GitHub Actions → Deploy web/ to GitHub Pages
                                 ↓
                    https://dvbydt.github.io/BasketBuddy/
```

### Mobile (EAS Workflows)
```
Push to main → EAS Workflow triggers → Build Android APK
                                        ↓
                        Available at expo.dev/artifacts/...
```

**Workflow file:** `mobile/.eas/workflows/build.yml`
```yaml
name: Build Android APK
on:
  push:
    branches: [main]
jobs:
  build_android:
    type: build
    params:
      platform: android
      profile: preview
```

---

## 🚀 Quick Start

### Prerequisites
- **Python 3.8+** (for web server & scraper)
- **Node.js 18+** and **npm** (for mobile app)
- **EAS CLI** (`npm install -g eas-cli`) for mobile builds

### Web App (local)
```bash
cd web
python3 -m http.server 8080
# Open http://localhost:8080
# Add ?admin=1 for admin features (scraper controls)
```

### Mobile App (local)
```bash
cd mobile
npm install
npx expo start
# Scan QR code with Expo Go on your phone
```

### Build Android APK
```bash
cd mobile
eas build --platform android --profile preview
```

### Update Prices from CSV
```bash
cd scraper
python3 update_prices.py
# Reads CSV → generates web/js/data.js + mobile/shared/data.json
# Auto-bumps cache version in web/index.html
```

### Deploy Firestore Rules
```bash
npx firebase-tools deploy --only firestore:rules --project basketbuddy-e6676
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

Custom stores can be added through the Settings tab on both web and mobile.

---

## 📊 Data

- **91 grocery items** across 11 categories (Dairy, Bakery, Meat, Produce, Fruits, Vegetables, Grains, Snacks, Drinks, Frozen, Other)
- Each item: `name`, `quantity` (e.g. "2L", "500g"), `category`, per-store `prices`, 5-week `history`
- Custom items (ID ≥ 10000) sync across all users via Firestore
- Data is auto-generated by `scraper/update_prices.py` — never hand-edit `data.js` or `data.json`

---

## 🛠️ Development

### Adding a new item
Use the **Settings → Add Custom Item** section in the app. The item will sync to all users via Firestore.

### Adding items in bulk
```bash
cd scraper
# Edit the CSV file with new items
python3 update_prices.py
# Regenerates data.js + data.json, bumps cache version
```

### Adding a new screen (mobile)
1. Create `mobile/app/(tabs)/myscreen.tsx`
2. Add a `<Tabs.Screen>` entry in `mobile/app/(tabs)/_layout.tsx`
3. Import shared data from `../../shared/store`

### Styling conventions
- **Web**: CSS custom properties (`--primary`, `--tesco`, etc.) in `styles.css`
- **Mobile**: Centralized in `shared/theme.ts` — `COLORS`, `FONTS`, `SHADOWS`

---

## 🗺️ Roadmap

- [ ] 📷 AI Receipt Scanner — snap a receipt photo, auto-extract items
- [ ] 🍎 iOS build & App Store submission
- [ ] 👤 User profiles with email auth (optional upgrade from anonymous)
- [ ] 🔔 Price drop notifications
- [ ] 🗺️ Store location map integration

---

## 📝 License

MIT

---

## 🙏 Credits

Built with ❤️ in Dublin. Helping students and families save money on groceries, one shop at a time.
