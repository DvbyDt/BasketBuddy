# BasketBuddy

BasketBuddy is a full-stack grocery price comparison platform for Dublin shoppers. It tracks prices of grocery items across Tesco, Lidl, Aldi, Asian Supermarket, and Super Value. Available as a progressive web app and a native Android app, with real-time cloud sync for custom items and baskets.

## Features
**Expo SDK 54, React 19, TypeScript 5.9, Firebase 12, EAS Build, Groq/Anthropic AI, and full CI/CD.**
- Compare prices across 5 Dublin grocery stores
- Smart basket with AI optimizer
- Receipt splitter
- 5-week price trends
- Real-time cloud sync via Firebase
- Custom items & stores
- Android APK and PWA

## Architecture
**Mobile:** React Native Expo SDK 54, TypeScript 5.9, React 19
- **Web:** Vanilla HTML/CSS/JS PWA
- **Mobile:** React Native Expo SDK 52, TypeScript
- **Backend:** Firebase Firestore, Anonymous Auth
- **Scraper:** Python scripts for price updates

## Project Structure
- `web/` — PWA frontend
- `mobile/` — React Native app
- `scraper/` — Python scripts for price scraping

## Quick Start
1. Clone the repo
2. Run the web app (`web/index.html`) or install the APK
3. Use the scraper to update prices

## Data Pipeline
- Scraper fetches prices from Tesco, Lidl, Aldi, etc.
- Data is imported into the app automatically

## Firebase & Cloud Sync
- Firestore stores custom items and shared baskets
- Anonymous Auth for user sessions

## Security
- Firestore rules restrict updates to item creators

## CI/CD Pipeline
- GitHub Actions for web deploy and APK release
- Expo EAS for Android builds

## Contributing
Pull requests are welcome. For major changes, please open an issue first.

## License
MIT

### Feature Matrix

| Feature | Web | Mobile | Description |
|---------|:---:|:------:|-------------|
| 🔍 **Search & Compare** | ✅ | ✅ | Instant price lookup across all 5 stores with real-time filtering |
| 💰 **Best Deals Feed** | ✅ | ✅ | Auto-ranked savings — shows items with the biggest price gaps between stores |
| 🧺 **Smart Basket** | ✅ | ✅ | Build a shopping basket, see the cheapest store for each item |
| 🤖 **AI Basket Optimizer** | ✅ | ✅ | Groups basket items by cheapest store, calculates total savings, optional AI tips |
| 🧾 **Receipt Splitter** | ✅ | ✅ | Assign items to "Me" / "½ Split" / "Them" — calculates who owes what |
| 📈 **5-Week Price Trends** | ✅ | ✅ | Visual bar charts showing price history per store with category filters |
| ➕ **Custom Items & Stores** | ✅ | ✅ | Add your own items/stores — synced across all users via Firebase |
| 🔥 **Real-time Cloud Sync** | ✅ | ✅ | Custom items and baskets sync via Firestore `onSnapshot` listeners |
| 🔐 **Anonymous Auth** | ✅ | ✅ | Zero-friction — users get a UID instantly, Firestore rules enforce ownership |
| 📱 **Native Mobile UX** | — | ✅ | Custom animated splash screen, smooth 60fps, native tab navigation |
| 🌐 **PWA Installable** | ✅ | — | Add to home screen on any device via `manifest.json` |
| 🔄 **Auto CI/CD** | ✅ | ✅ | Push to `main` → web auto-deploys + Android APK auto-builds |

### How Each Feature Works

#### 🔍 Search & Compare
Type any item name in the search bar. Results show **all store prices sorted cheapest-first**, with a green "BEST DEAL" ribbon on the cheapest option and a savings pill showing how much you save vs the most expensive store.

#### 💰 Best Deals Feed
The home screen auto-renders the top 5 items (web) / top 10 items (mobile) with the **biggest price differences** across stores. Only items available at ≥2 stores are shown, sorted by savings descending.

#### 🤖 AI Basket Optimizer
Two AI providers are supported:

| Provider | Model | Cost | Vision Support |
|----------|-------|------|:--------------:|
| **Groq** | Llama 3.3 70B Versatile | Free (no credit card) | ❌ |
| **Anthropic** | Claude Haiku 4.5 | ~€0.003/request | ✅ |

The optimizer groups your basket by cheapest store, calculates savings vs "worst case" (buying everything at most expensive stores), and optionally generates a money-saving tip via AI. Configure in Settings → AI Provider.

#### 🧾 Receipt Splitter
Three ownership modes per item: **🧍 Me** (you pay 100%), **½ Split** (50/50), **👤 Them** (roommate pays 100%). The summary card shows Total Bill, You Owe, and Roommate Owes in real-time.

#### 📈 Price Trends
Each item shows a **5-week bar chart** with one bar per week per store, color-coded by store. Includes curated insights for select items (e.g., "Grapes are 12% cheaper at Tesco than Lidl"). Filter by category via horizontal chip scroll.

---

## 🏗️ Architecture

### High-Level System Diagram

```
                          ┌──────────────────────────┐
                          │      GitHub (main)        │
                          │  github.com/DvbyDt/       │
                          │       BasketBuddy         │
                          └────────────┬──────────────┘
                                       │ push
                          ┌────────────┼────────────┐
                          ▼                         ▼
                ┌──────────────────┐      ┌──────────────────┐
                │  GitHub Actions   │      │   EAS Workflow    │
                │  deploy.yml       │      │   build.yml       │
                │  (auto-deploy)    │      │   (auto-build)    │
                └────────┬─────────┘      └────────┬─────────┘
                         ▼                         ▼
                ┌──────────────────┐      ┌──────────────────┐
                │  GitHub Pages     │      │   EAS Build       │
                │  (Static PWA)     │      │  (Android APK)    │
                └────────┬─────────┘      └────────┬─────────┘
                         │                         │
                         └────────────┬────────────┘
                                      │
                           ┌──────────▼──────────┐
                           │  Firebase Firestore  │
                           │  (basketbuddy-e6676) │
                           │                      │
                           │  ┌────────────────┐  │
                           │  │ customItems     │  │
                           │  │ sharedBasket    │  │
                           │  └────────────────┘  │
                           │                      │
                           │  Firebase Auth        │
                           │  (Anonymous)          │
                           └──────────────────────┘
```

### Data Flow

```
 ┌──────────────────┐      ┌──────────────────┐
 │  Tesco.ie         │      │  Lidl.ie          │
 │  (Playwright)     │      │  (requests + API) │
 └────────┬─────────┘      └────────┬─────────┘
          │                         │
          └────────────┬────────────┘
                       ▼
              grocery_scraper.py
              (AI query generation via Groq)
                       │
                       ▼
              ┌────────────────┐
              │  CSV (91 items) │
              └────────┬───────┘
                       ▼
              update_prices.py
              ┌────────┴────────┐
              ▼                 ▼
    web/js/data.js    mobile/shared/data.json
    (JS module)       (JSON import)
              │                 │
              ▼                 ▼
          Web PWA         React Native
          (10 JS modules)   (TypeScript)
              │                 │
              └────────┬────────┘
                       ▼
              Firebase Firestore
           (real-time sync layer)
                       │
              ┌────────┴────────┐
              ▼                 ▼
          User-1's          User-2's
           Device            Device
```

---

## 🔧 Tech Stack

| Layer | Technology | Version | Why |
|-------|-----------|---------|-----|
| **Web Frontend** | Vanilla HTML/CSS/JS | — | Zero build step, instant deploy, tiny ~50 KB bundle |
| **Web Styling** | CSS Custom Properties | — | 360-line stylesheet, mobile-first, `--orange`, `--tesco`, etc. |
| **Web Fonts** | Fredoka One + Nunito | — | Playful headings + readable body text |
| **Mobile Frontend** | React Native + Expo | SDK 54, RN 0.81.5 | Cross-platform from one TypeScript codebase |
| **Mobile Navigation** | Expo Router | ~6.0.23 | File-based routing, same mental model as Next.js |
| **Mobile State** | React Context | — | `BasketContext` for shared basket state across screens |
| **Language** | TypeScript | ~5.9.2 | Type-safe data layer, shared interfaces (`Store`, `Item`, `BasketItem`) |
| **Cloud Database** | Firebase Firestore | v10.12.0 (web), v12.10.0 (mobile) | Real-time `onSnapshot` sync, offline-first caching |
| **Authentication** | Firebase Auth (Anonymous) | — | Instant UID, no sign-up friction, enables security rules |
| **AI (Free)** | Groq | Llama 3.3 70B | Free API, basket optimizer tips, scraper query generation |
| **AI (Paid)** | Anthropic Claude | Haiku 4.5 | Receipt scanning (vision), basket tips, ~€0.003/request |
| **Web Hosting** | GitHub Pages | — | Auto-deployed via GitHub Actions on every push |
| **Mobile Build** | EAS Build | — | Cloud Android builds, no local SDK needed |
| **CI/CD (Web)** | GitHub Actions | v4/v5 | `deploy.yml` → GitHub Pages |
| **CI/CD (Mobile)** | EAS Workflows | — | `build.yml` → auto-build APK on push to `main` |
| **Scraping** | Playwright + Requests | — | Headless Chrome for Tesco.ie, HTTP API for Lidl.ie |
| **Data Pipeline** | Python 3 | — | CSV → JS/JSON code generation, synthetic price history |
| **Local Storage** | AsyncStorage | 2.2.0 | Custom stores persistence on mobile |

---

## 📁 Project Structure

```
BasketBuddy/
│
├── .github/
│   └── workflows/
│       └── deploy.yml                  # [34 lines] GitHub Pages auto-deploy
│
├── web/                                # ── Progressive Web App ──────────────
│   ├── index.html                      # [191 lines] Single-page shell, 5 views
│   ├── manifest.json                   # [14 lines] PWA manifest (standalone)
│   ├── css/
│   │   └── styles.css                  # [360 lines] Full styling, CSS variables
│   └── js/
│       ├── data.js                     # [500 lines] Auto-generated: 91 items, 5 stores
│       ├── firebase-sync.js            # [120 lines] Firestore cloud sync + auth
│       ├── ui.js                       # [56 lines] Toast, modal, page switching, formatters
│       ├── ai.js                       # [172 lines] Groq + Anthropic, vision, optimizer
│       ├── compare.js                  # [91 lines] Search engine + best deals
│       ├── basket.js                   # [87 lines] Basket management + AI optimizer
│       ├── split.js                    # [120 lines] Receipt splitter (Me / ½ / Them)
│       ├── trends.js                   # [104 lines] 5-week price charts + insights
│       ├── additem.js                  # [108 lines] Add items + manage stores
│       └── app.js                      # [73 lines] Boot + Firestore subscription
│
├── mobile/                             # ── React Native (Expo) ──────────────
│   ├── app.json                        # [45 lines] Expo config, owner: dvbydt, SDK 54
│   ├── eas.json                        # [27 lines] Build profiles (dev/preview/prod)
│   ├── package.json                    # [32 lines] Dependencies (Expo 54, Firebase 12, React 19, TypeScript 5.9)
│   ├── tsconfig.json                   # [10 lines] TypeScript config (strict mode)
│   ├── babel.config.js                 # Babel preset for Expo
│   ├── .eas/
│   │   └── workflows/
│   │       └── build.yml               # [12 lines] Auto-build APK on push to main
│   ├── app/
│   │   ├── _layout.tsx                 # [180 lines] Root layout + animated splash screen
│   │   └── (tabs)/
│   │       ├── _layout.tsx             # [65 lines] Tab bar (5 tabs with emoji icons)
│   │       ├── index.tsx               # [207 lines] 🔍 Compare — search + best deals
│   │       ├── basket.tsx              # [186 lines] 🧺 Basket — build + AI optimize
│   │       ├── split.tsx               # [459 lines] 🧾 Split — receipt splitter
│   │       ├── trends.tsx              # [173 lines] 📈 Trends — price charts
│   │       └── settings.tsx            # [470 lines] ⚙️ Settings — items, stores, about
│   ├── components/
│   │   ├── PriceCard.tsx               # [162 lines] Item card with prices + basket toggle
│   │   └── StoreBadge.tsx              # [40 lines] Colored store badge component
│   ├── shared/
│   │   ├── data.json                   # Auto-generated: same 91 items as data.js
│   │   ├── store.ts                    # [110 lines] Data access + Firestore sync
│   │   ├── firebase.ts                 # [47 lines] Firebase init + anonymous auth
│   │   ├── firestore.ts               # [113 lines] Firestore CRUD + real-time listeners
│   │   ├── types.ts                    # [26 lines] Shared interfaces (Store, Item, BasketItem)
│   │   ├── theme.ts                    # [42 lines] Colors, fonts, shadows
│   │   └── BasketContext.tsx           # [80 lines] React Context for basket state
│   └── assets/
│       ├── icon.png                    # App icon (1024×1024)
│       ├── adaptive-icon.png           # Android adaptive icon foreground
│       ├── splash-icon.png             # Splash screen image
│       └── favicon.png                 # Web favicon
│
├── scraper/                            # ── Python Data Pipeline ─────────────
│   ├── grocery_scraper.py              # [305 lines] Scrapes Tesco.ie + Lidl.ie
│   ├── parse_csv.py                    # [73 lines] CSV → structured data (debug)
│   ├── update_prices.py                # [165 lines] CSV → data.js + data.json (production)
│   └── query_cache.json                # [362 lines] Cached AI-generated search queries
│
├── firebase.json                       # Firebase project config
├── firestore.rules                     # [33 lines] Security rules (auth + creator-only)
├── .gitignore                          # [21 lines] Standard ignores
└── README.md                           # You are here
```

**Total codebase**: ~4,700 lines across 37 source files (excluding auto-generated data and node_modules).

---

## 🚀 Quick Start

### Prerequisites

| Tool | Version | Required For |
|------|---------|-------------|
| **Python** | 3.8+ | Web dev server, scraper, data pipeline |
| **Node.js** | 18+ | Mobile app, EAS CLI |
| **npm** | 9+ | Package management |
| **EAS CLI** | 12+ | Mobile builds (`npm i -g eas-cli`) |

### Web App (local development)

```bash
# Clone the repo
git clone https://github.com/DvbyDt/BasketBuddy.git
cd BasketBuddy

# Serve the web app
cd web
python3 -m http.server 8080

# Open http://localhost:8080
# For admin features (scraper controls): http://localhost:8080?admin=1
```

### Mobile App (local development)
**Expo SDK 54, React 19, TypeScript 5.9, Firebase 12, EAS Build**

```bash
cd mobile
npm install
npx expo start

# Options:
#   Scan QR code with Expo Go (SDK 54) on your phone
#   Press 'a' to open Android emulator
#   Press 'w' for web preview
### Upgrade Guide (Expo SDK 54)

If you are upgrading from an older Expo SDK:

1. Update all dependencies in mobile/package.json to the required versions:
  - "expo": "~54.0.0"
  - "react": "19.1.0"
  - "react-dom": "19.1.0"
  - "react-native": "0.81.5"
  - "@expo/vector-icons": "^15.0.3"
  - "@react-native-async-storage/async-storage": "2.2.0"
  - "expo-router": "~6.0.23"
  - "react-native-safe-area-context": "~5.6.0"
  - "react-native-screens": "~4.16.0"
  - "react-native-web": "^0.21.0"
  - "typescript": "~5.9.2"
  - "@types/react": "~19.1.10"
2. Update tsconfig.json:
  - Add "jsx": "react-jsx"
  - Add "esModuleInterop": true
3. Run:
  ```bash
  rm -rf node_modules package-lock.json
  npm install --legacy-peer-deps
  npx expo-doctor
  ```
4. Fix any breaking changes in your code (JSX, imports, types).
5. Use Expo Go SDK 54 on your device.

**Troubleshooting:**
- If you see "Project is incompatible with this version of Expo Go", check your expo version and dependencies.
- If splash or opening screen logo is stretched, use a square PNG and set resizeMode to "contain" in app.json.
- For opening screen UI, center the logo and remove excessive shadow/background in your screen component.
### Splash & Opening Screen Customization

**Splash Screen:**
- Use a square PNG (e.g., 512x512) for the splash image.
- Set resizeMode to "contain" and backgroundColor to match your brand.
- Example app.json:
  ```json
  "splash": {
    "image": "./assets/splash-icon.png",
    "resizeMode": "contain",
    "backgroundColor": "#FFF9F0"
  }
  ```

**Opening Screen:**
- Center the logo, use minimal background/shadow, and add padding/margin for a modern look.
- Edit your opening screen component (e.g., Home.tsx) to improve logo display.
```

### Build Android APK

```bash
cd mobile
npm install -g eas-cli
eas login
eas build --platform android --profile preview
# Downloads .apk — install on any Android phone
```

### Build Production AAB (Play Store)

```bash
cd mobile
eas build --platform android --profile production
# Downloads .aab — upload to Google Play Console
```

---

## 🕷️ Data Pipeline & Scraper

The scraper fetches real prices from Irish grocery store websites and generates the app's data files.

### How It Works

```
┌─────────────┐    Playwright     ┌────────────┐
│  Tesco.ie    │ ◄──────────────── │            │
└─────────────┘   headless Chrome  │  grocery_  │
                                   │  scraper   │
┌─────────────┐    Requests + API  │  .py       │
│  Lidl.ie     │ ◄──────────────── │            │
└─────────────┘   BeautifulSoup    └─────┬──────┘
                                         │
                                         ▼
                                   ┌────────────┐
                                   │  CSV file   │
                                   │  (91 rows)  │
                                   └─────┬──────┘
                                         │
                                         ▼
                                   update_prices.py
                                   ┌─────┴──────┐
                                   ▼             ▼
                            web/js/data.js   mobile/shared/
                            (JS module)       data.json
```

### Running the Scraper

```bash
cd scraper

# Install dependencies
pip install requests beautifulsoup4 playwright python-dotenv
playwright install chromium

# Set up AI query generation (optional but recommended)
echo "GROQ_API_KEY=gsk_your_key_here" > .env

# Run the scraper
python3 grocery_scraper.py --force --ai

# Update both web + mobile data files
python3 update_prices.py
# ✅ Generates web/js/data.js (JS module with 91 items)
# ✅ Generates mobile/shared/data.json (JSON import)
# ✅ Auto-bumps cache version in web/index.html (?v=7 → ?v=8)
```

### Scraper Features

| Feature | Description |
|---------|-------------|
| **AI Query Generation** | Uses Groq (free Llama 3.3 70B) to generate smart search queries from item names |
| **Query Caching** | Stores AI-generated queries in `query_cache.json` (362 cached queries) to avoid redundant API calls |
| **Fallback Queries** | Rule-based query builder strips store prefixes, cleans names when AI is unavailable |
| **History Generation** | Synthesizes 5-week price history (±5% from current price) for trend charts |
| **Dual Output** | Generates both JS (web) and JSON (mobile) from a single CSV source |

---

## 🔥 Firebase & Cloud Sync

### Architecture

BasketBuddy uses Firebase for **real-time data synchronization** between all users and devices.

| Component | Details |
|-----------|---------|
| **Project** | `basketbuddy-e6676` |
| **Database** | Cloud Firestore (NoSQL, document-based) |
| **Auth** | Firebase Auth with Anonymous sign-in |
| **Collections** | `customItems`, `sharedBasket` |

### Firestore Collections

#### `customItems` — User-Added Grocery Items

```javascript
{
  id: 10001,
  name: "Oat Milk",
  quantity: "1L",
  category: "Dairy",
  prices: { tesco: 2.49, lidl: 2.19 },
  history: {},
  createdBy: "anonymous-uid-abc123",   // Firebase Auth UID
  updatedAt: 1709827200000              // Timestamp
}
```

#### `sharedBasket` — Shared Shopping Basket

```javascript
{
  itemId: 7,
  name: "Grapes",
  quantity: "500g",
  store: "tesco",
  price: 2.89,
  addedBy: "anonymous-uid-abc123",
  updatedAt: 1709827200000
}
```

### Real-Time Sync Flow

Both web and mobile use Firestore `onSnapshot` listeners for **instant UI updates** when data changes:

```
User A adds "Oat Milk"          User B sees it instantly
        │                              ▲
        ▼                              │
  syncCustomItemToCloud()  ──►  Firestore  ──►  onSnapshot callback
  (write to Firestore)          (cloud)         (re-renders UI)
```

### Web vs Mobile Firebase SDK

| | Web | Mobile |
|---|---|---|
| **SDK** | Firebase Compat CDN (v10.12.0) | Firebase JS SDK (v12.10.0) |
| **Import Style** | `<script>` tags + global `firebase` | ES module `import { ... }` |
| **Auth** | `firebase.auth().signInAnonymously()` | `signInAnonymously(auth)` |
| **Firestore** | `firebase.firestore().collection(...)` | `collection(db, '...')` |
| **Config File** | `web/js/firebase-sync.js` | `mobile/shared/firebase.ts` |

### Deploy Firestore Rules

```bash
npx firebase-tools deploy --only firestore:rules --project basketbuddy-e6676
```

---

## 🔐 Security

### Three-Layer Protection Model

```
┌───────────────────────────────────────────────────────────┐
│  Layer 1: Firebase Anonymous Auth                          │
│  → Every user auto-signs in with a unique UID              │
│  → No unauthenticated access to Firestore                  │
├───────────────────────────────────────────────────────────┤
│  Layer 2: Firestore Security Rules                         │
│  → Read: any authenticated user                           │
│  → Create/Update: only the document creator (createdBy)    │
│  → Delete: only the document creator                       │
│  → sharedBasket: any authenticated user (collaborative)    │
│  → Everything else: deny all                               │
├───────────────────────────────────────────────────────────┤
│  Layer 3: API Key Restrictions (GCP Console)               │
│  → HTTP referrer whitelist (dvbydt.github.io, localhost)    │
│  → API restrictions (Firestore + Auth APIs only)           │
└───────────────────────────────────────────────────────────┘
```

### Firestore Rules Summary

| Collection | Read | Create | Update | Delete |
|-----------|------|--------|--------|--------|
| `customItems` | ✅ Auth required | ✅ Auth + `createdBy == uid` | ✅ Auth + `createdBy == uid` | ✅ Auth + `createdBy == uid` |
| `sharedBasket` | ✅ Auth required | ✅ Auth required | ✅ Auth required | ✅ Auth required |
| Everything else | ❌ Denied | ❌ Denied | ❌ Denied | ❌ Denied |

### Current `firestore.rules`

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /customItems/{itemId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null
                    && request.resource.data.createdBy == request.auth.uid;
      allow update: if request.auth != null
                    && resource.data.createdBy == request.auth.uid;
      allow delete: if request.auth != null
                    && resource.data.createdBy == request.auth.uid;
    }
    match /sharedBasket/{itemId} {
      allow read, write: if request.auth != null;
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

---

## 🔄 CI/CD Pipeline

### Web: GitHub Actions → GitHub Pages

```
Push to main ──► GitHub Actions ──► Upload web/ ──► Deploy to GitHub Pages
                  deploy.yml                         dvbydt.github.io/BasketBuddy
```

**Workflow**: `.github/workflows/deploy.yml`
- **Trigger**: Push to `main` branch or manual dispatch
- **Runner**: `ubuntu-latest`
- **Steps**: Checkout → Configure Pages → Upload `web/` as artifact → Deploy
- **Permissions**: `contents: read`, `pages: write`, `id-token: write`

### Mobile: EAS Workflows → Android APK

```
Push to main ──► EAS Workflow ──► Cloud Build ──► Android APK
                  build.yml        (Expo servers)   available on EAS
```

**Workflow**: `mobile/.eas/workflows/build.yml`
```yaml
name: Build Android APK
on:
  push:
    branches: [main]
jobs:
  build_android:
    name: Build Android APK
    type: build
    params:
      platform: android
      profile: preview
```

### Build Profiles (`eas.json`)

| Profile | Output | Distribution | Use Case |
|---------|--------|-------------|----------|
| `development` | Dev client | Internal | Local development with dev tools |
| `preview` | `.apk` | Internal | Testing — install directly on phone |
| `production` | `.aab` | Store | Google Play Store submission |

---

## 🤔 Design Decisions & Trade-offs

### Why Vanilla JS for Web (not React)?

| Vanilla JS ✅ | React |
|---|---|
| Zero build step — edit a file and deploy | Requires bundler (Webpack/Vite), build pipeline |
| Tiny payload (~50 KB total) | ~150 KB+ minimum (React + ReactDOM) |
| Works on GitHub Pages with no config | Needs build step before deploy |
| Perfect for a mostly-static price comparison | Better for highly dynamic, component-heavy UIs |

**Trade-off accepted:** More imperative DOM manipulation, no component model. For a 5-tab app with static data + search, the simplicity wins.

### Why React Native / Expo (not Flutter or PWA-only)?

| Option | Pros | Cons |
|--------|------|------|
| **React Native + Expo** ✅ | Share TS types with web, huge ecosystem, EAS cloud builds, hot reload | Larger APK (~66 MB), JS bridge overhead |
| **Flutter** | Smaller APK, great animations | Dart ecosystem (can't share code with web JS), different paradigm |
| **PWA Only** | Zero install, one codebase | No app store presence, limited native APIs, worse offline on mobile |

**Trade-off accepted:** 66 MB APK size for the benefit of shared TypeScript types/logic and zero-config cloud builds via EAS.

### Why Firebase Firestore (not Supabase)?

| Criteria | Firebase ✅ | Supabase |
|----------|---|---|
| **Offline-first** | ✅ Local cache, syncs when online | ❌ No native offline cache |
| **Real-time sync** | ✅ Built-in `onSnapshot` | ⚠️ WebSocket-based, weaker mobile |
| **Data model** | NoSQL (flexible, matches items with nested prices) | PostgreSQL (needs migrations) |
| **React Native SDK** | Mature, well-documented | JS client works but no native offline |
| **Self-hosting** | ❌ Vendor lock-in | ✅ Full Docker self-host |
| **Free tier** | 1 GB storage, 50K reads/day | 500 MB, 50K requests/month |

**Trade-off accepted:** Vendor lock-in for the killer feature: **offline-first caching** (crucial for grocery shopping in stores with spotty signal).

### Why Anonymous Auth (not Email/Password)?

| Anonymous ✅ | Email/Password |
|---|---|
| Instant — no sign-up form, zero friction | Requires registration, password management |
| Each device gets a unique UID for ownership rules | Stronger identity, account recovery |
| Perfect for a utility app | Better for social features, user profiles |

**Trade-off accepted:** No account recovery or cross-device login. Acceptable for a grocery comparison tool.

### Why EAS Workflows (not GitHub Actions for Mobile)?

| EAS Workflows ✅ | GitHub Actions + EAS CLI |
|---|---|
| 4-line YAML, native Expo integration | Need `EXPO_TOKEN` secret, install eas-cli, 20+ lines |
| Automatic auth via GitHub App link | Manual token management |
| Purpose-built for Expo projects | General-purpose CI, more boilerplate |

**Trade-off accepted:** Less flexibility for simpler configuration. One `type: build` declaration replaces 15+ lines of Actions YAML.

---

## 🏪 Supported Stores

| Store | ID | Color | Emoji | Data Source |
|-------|-----|-------|-------|-------------|
| **Tesco** | `tesco` | `#EE1C25` | 🔴 | Tesco.ie (Playwright headless Chrome) |
| **Lidl** | `lidl` | `#0050AA` | 🔵 | Lidl.ie (Requests + JSON API) |
| **Aldi** | `aldi` | `#FF6600` | 🟠 | CSV import |
| **Asian Supermarket** | `asian` | `#9B5DE5` | 🟣 | CSV import |
| **Super Value** | `supervalue` | `#06D6A0` | 🟢 | CSV import |

Custom stores can be added through the Settings tab on both web and mobile. Custom stores on mobile persist via AsyncStorage.

---

## 📊 Data Overview

| Metric | Value |
|--------|-------|
| **Total items** | 91 grocery items (IDs 1–91) |
| **Custom item IDs** | Start at 10000 (synced via Firestore) |
| **Categories** | 11 — Dairy, Bakery, Meat, Produce, Fruits, Vegetables, Grains, Snacks, Drinks, Frozen, Other |
| **Price history** | 5 weeks per item per store |
| **Data files** | `web/js/data.js` (JS module) + `mobile/shared/data.json` (JSON) |
| **Auto-generated by** | `scraper/update_prices.py` — never hand-edit data files |

### Sample Item Structure

```javascript
{
  id: 7,
  name: 'Grapes',
  quantity: '500g',
  category: 'Fruits',
  prices:  { lidl: 3.29, tesco: 2.89 },
  history: {
    lidl:  [3.13, 3.17, 3.21, 3.25, 3.29],   // W1 → W5
    tesco: [2.75, 2.79, 2.82, 2.85, 2.89]
  }
}
```

---

## 🛠️ Development Guide

### Adding a New Item

**Via the app (recommended):** Use Settings → Add Custom Item. Enter name, quantity, category, and prices per store. The item syncs to all users automatically via Firestore.

**Via CSV (bulk):**
```bash
cd scraper
# Edit the CSV file with new rows
python3 update_prices.py
# Regenerates data.js + data.json, bumps cache version
```

### Adding a New Mobile Screen

1. Create `mobile/app/(tabs)/myscreen.tsx`
2. Add a `<Tabs.Screen>` entry in `mobile/app/(tabs)/_layout.tsx`
3. Import shared data from `../../shared/store`
4. Use `useBasket()` for basket operations

### Adding a New Store (permanent)

1. Add to `stores` array in `scraper/update_prices.py`
2. Add to `web/js/data.js` stores array
3. Add color variables to `web/css/styles.css` and `mobile/shared/theme.ts`
4. Run `update_prices.py` to regenerate data files

### Styling Conventions

| Platform | Where | System |
|----------|-------|--------|
| **Web** | `web/css/styles.css` | CSS custom properties (`--primary`, `--tesco`, `--radius: 20px`) |
| **Mobile** | `mobile/shared/theme.ts` | Centralized `COLORS`, `FONTS`, `SHADOWS` objects |

### Key Shared Types (`mobile/shared/types.ts`)

```typescript
interface Store {
  id: string;     // 'tesco', 'lidl', etc.
  name: string;   // 'Tesco'
  color: string;  // '#EE1C25'
  emoji: string;  // '🔴'
}

interface Item {
  id: number;
  name: string;
  quantity: string;
  category: string;
  prices: Record<string, number>;     // { tesco: 2.89, lidl: 3.29 }
  history: Record<string, number[]>;  // { tesco: [2.75, 2.79, ...] }
}

interface BasketItem {
  itemId: number;
  name: string;
  quantity: string;
  store: string;   // cheapest store ID
  price: number;
}
```

---

## 🗺️ Roadmap
**Latest Upgrades:**
- Expo SDK 54, React 19, TypeScript 5.9, Firebase 12, EAS Build, Groq/Anthropic AI, full CI/CD, improved splash/opening screen customization.

- [ ] 📷 **AI Receipt Scanner** — snap a receipt photo, auto-extract items (Anthropic Vision ready, UI planned)
- [ ] 🍎 **iOS Build** — App Store submission via EAS
- [ ] 👤 **User Profiles** — optional email auth upgrade from anonymous
- [ ] 🔔 **Price Drop Notifications** — Firebase Cloud Messaging
- [ ] 🗺️ **Store Locator** — map integration showing nearest stores
- [ ] 🔄 **Auto Scraper** — GitHub Actions scheduled weekly scraping run
- [ ] 📦 **More Stores** — Dunnes Stores, Centra, Spar

---

## 📝 License

MIT

---

<p align="center">
  Built with ❤️ in Dublin<br/>
  Helping students and families save money on groceries, one shop at a time.
</p>
