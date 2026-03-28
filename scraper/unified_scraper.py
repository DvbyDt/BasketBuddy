#!/usr/bin/env python3
"""
unified_scraper.py — Scrapes ALL stores and MERGES with existing data.json.

STORES:
  Tesco     -> Playwright (JS-rendered React app)
  Lidl      -> Playwright (JS-rendered)
  Aldi      -> requests + BeautifulSoup (mostly static HTML)
  SuperValu -> Playwright (JS-rendered)

MERGE LOGIC:
  For every scraped item we try to find it in existing data.json by name.
  MATCH found  -> UPDATE that store's price only. All other stores untouched.
  NO match     -> ADD as new item with next available ID.

USAGE:
  python unified_scraper.py                  # 50 items per store
  python unified_scraper.py --limit 20       # quick test
  python unified_scraper.py --limit 0        # unlimited
  python unified_scraper.py --store tesco    # one store only
  python unified_scraper.py --dry-run        # preview, don't save

SETUP:
  pip install playwright requests beautifulsoup4 lxml python-dotenv
  playwright install chromium
"""

import argparse, json, re, sys, time
from datetime import datetime
from pathlib import Path

import requests as req
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-IE,en;q=0.9",
}

TESCO_CATS = [
    ("shop/fresh-food/fresh-fruit/all",                   "Fruits"),
    ("shop/fresh-food/fresh-vegetables/all",              "Vegetables"),
    ("shop/fresh-food/dairy-eggs-chilled/all",            "Dairy"),
    ("shop/fresh-food/fresh-meat-poultry/all",            "Meat"),
    ("shop/fresh-food/fish-seafood/all",                  "Fish"),
    ("shop/bakery/all",                                   "Bakery"),
    ("shop/food-cupboard/pasta-rice-noodles/all",         "Grains"),
    ("shop/food-cupboard/cereals/all",                    "Cereals"),
    ("shop/food-cupboard/tinned-food/all",                "Tinned"),
    ("shop/food-cupboard/condiments-dressings-sauces/all","Condiments"),
    ("shop/drinks/soft-drinks/all",                       "Drinks"),
    ("shop/drinks/juices-smoothies/all",                  "Juice"),
    ("shop/frozen-food/frozen-vegetables/all",            "Frozen"),
    ("shop/frozen-food/frozen-meat-poultry/all",          "Frozen Meat"),
    ("shop/snacks-sweets/snacks/all",                     "Snacks"),
    ("shop/world-foods/all",                              "World Foods"),
]
LIDL_CATS = [
    ("c/fresh-fruit-vegetables/c1000", "Fruits & Vegetables"),
    ("c/dairy-eggs-chilled/c1004",     "Dairy"),
    ("c/bakery-cakes/c1002",           "Bakery"),
    ("c/meat-poultry/c1003",           "Meat"),
    ("c/fish-seafood/c1005",           "Fish"),
    ("c/frozen-food/c1006",            "Frozen"),
    ("c/food-cupboard/c1007",          "Food Cupboard"),
    ("c/drinks/c1008",                 "Drinks"),
    ("c/snacks-confectionery/c1009",   "Snacks"),
]
ALDI_CATS = [
    ("en/groceries/fresh-produce",    "Fresh Produce"),
    ("en/groceries/dairy-eggs",       "Dairy"),
    ("en/groceries/meat-poultry",     "Meat"),
    ("en/groceries/fish-seafood",     "Fish"),
    ("en/groceries/bakery",           "Bakery"),
    ("en/groceries/food-cupboard",    "Food Cupboard"),
    ("en/groceries/frozen",           "Frozen"),
    ("en/groceries/drinks",           "Drinks"),
    ("en/groceries/snacks",           "Snacks"),
]
SUPERVALU_CATS = [
    ("fruit-veg/fresh-fruit",         "Fruits"),
    ("fruit-veg/fresh-vegetables",    "Vegetables"),
    ("dairy-eggs-chilled",            "Dairy"),
    ("meat-poultry",                  "Meat"),
    ("fish-seafood",                  "Fish"),
    ("bakery",                        "Bakery"),
    ("food-cupboard/cereals",         "Cereals"),
    ("food-cupboard/pasta-rice",      "Grains"),
    ("drinks/soft-drinks",            "Drinks"),
    ("frozen",                        "Frozen"),
    ("snacks-confectionery",          "Snacks"),
]


def parse_price(text):
    if not text: return None
    text = text.replace(",", ".").replace("\u20ac", "").strip()
    m = re.search(r"(\d+\.\d{1,2}|\d+)", text)
    if m:
        v = float(m.group(1))
        return v if 0.01 < v < 500 else None
    return None


def normalise(name):
    name = name.lower().strip()
    for p in ["tesco ", "lidl ", "aldi ", "supervalu "]:
        if name.startswith(p): name = name[len(p):]
    name = re.sub(r"\b\d+\s*(g|kg|ml|l|oz|lb|pack|pk)\b", "", name)
    return re.sub(r"\s+", " ", name).strip()


def similarity(a, b):
    wa = set(re.split(r"\W+", normalise(a))) - {""}
    wb = set(re.split(r"\W+", normalise(b))) - {""}
    if not wa or not wb: return 0.0
    return len(wa & wb) / max(len(wa), len(wb))


# ── Playwright scrapers ───────────────────────────────────────────

def _pw_scrape(page, base, categories, store_id, limit):
    products = []
    for slug, category in categories:
        if limit and len(products) >= limit: break
        url = f"{base}/{slug}"
        try:
            page.goto(url, timeout=25000, wait_until="domcontentloaded")
            selectors = {
                "tesco":      ("[data-auto='product-tile'], .product-list--list-item",
                               "[data-auto='product-title'], .product-title, h3",
                               ".price-per-sellable-unit .value, .beans-price__text",
                               ".product-info-pack-size"),
                "lidl":       (".s-grid__item, [class*='ProductTile'], .ret-o-card",
                               "h3, h4, [class*='headline']",
                               ".m-price__bottom, [class*='m-price']",
                               "[class*='gramm'], [class*='weight']"),
                "supervalue": ("[data-testid='product-item'], .product-card",
                               "[data-testid='product-name'], h3",
                               "[data-testid='product-price'], [class*='price']",
                               "[data-testid='product-weight']"),
            }[store_id]

            try:
                page.wait_for_selector(selectors[0], timeout=10000)
            except Exception:
                print(f"    No products: {category}")
                continue

            page.wait_for_timeout(1500)
            tiles = page.query_selector_all(selectors[0])
            n = 0
            for tile in tiles:
                if limit and len(products) >= limit: break
                try:
                    ne = tile.query_selector(selectors[1])
                    pe = tile.query_selector(selectors[2])
                    qe = tile.query_selector(selectors[3])
                    if not ne or not pe: continue
                    name  = ne.inner_text().strip()
                    price = parse_price(pe.inner_text())
                    qty   = qe.inner_text().strip() if qe else ""
                    if name and price:
                        products.append({"name": name, "price": price,
                                         "quantity": qty, "category": category,
                                         "store": store_id})
                        n += 1
                except Exception: continue
            print(f"    {category}: {n} items (total: {len(products)})")
            time.sleep(1.2)
        except Exception as e:
            print(f"    ERROR {category}: {e}")
    return products[:limit] if limit else products


def scrape_tesco(page, limit):
    print(f"  Tesco (Playwright, limit={limit or 'inf'})...")
    r = _pw_scrape(page, "https://www.tesco.ie/groceries/en-IE", TESCO_CATS, "tesco", limit)
    print(f"  -> Tesco: {len(r)} items")
    return r


def scrape_lidl(page, limit):
    print(f"  Lidl (Playwright, limit={limit or 'inf'})...")
    r = _pw_scrape(page, "https://www.lidl.ie", LIDL_CATS, "lidl", limit)
    print(f"  -> Lidl: {len(r)} items")
    return r


def scrape_supervalu(page, limit):
    print(f"  SuperValu (Playwright, limit={limit or 'inf'})...")
    r = _pw_scrape(page, "https://shop.supervalu.ie/sm/delivery/rsid/5550", SUPERVALU_CATS, "supervalue", limit)
    print(f"  -> SuperValu: {len(r)} items")
    return r


def scrape_aldi(limit):
    """Aldi.ie is mostly static HTML -- no Playwright needed."""
    print(f"  Aldi (requests, limit={limit or 'inf'})...")
    products = []
    for slug, category in ALDI_CATS:
        if limit and len(products) >= limit: break
        url = f"https://www.aldi.ie/{slug}"
        try:
            r = req.get(url, headers=HEADERS, timeout=15)
            if r.status_code != 200:
                print(f"    {category}: HTTP {r.status_code}")
                continue
            soup = BeautifulSoup(r.text, "lxml")
            tiles = soup.select(".js-product-tile, .product-tile, [class*='product-grid__item']")
            n = 0
            for tile in tiles:
                if limit and len(products) >= limit: break
                try:
                    ne = tile.select_one("h3, h4, .product-tile__name")
                    pe = tile.select_one(".product-tile__price, [class*='price']")
                    qe = tile.select_one(".product-tile__weight, [class*='weight']")
                    if not ne or not pe: continue
                    name  = ne.get_text(strip=True)
                    price = parse_price(pe.get_text(strip=True))
                    qty   = qe.get_text(strip=True) if qe else ""
                    if name and price:
                        products.append({"name": name, "price": price,
                                         "quantity": qty, "category": category,
                                         "store": "aldi"})
                        n += 1
                except Exception: continue
            print(f"    {category}: {n} items (total: {len(products)})")
            time.sleep(1.0)
        except Exception as e:
            print(f"    ERROR {category}: {e}")
    print(f"  -> Aldi: {len(products)} items")
    return products[:limit] if limit else products


# ── Merge ─────────────────────────────────────────────────────────

def merge(existing, scraped):
    """
    Merge scraped items into existing data.json items.

    For each scraped item:
      - Find best name match in existing (threshold 0.55)
      - If found: update ONLY that store's price, push old to history
      - If not:   add as new item with next ID
    """
    items = [dict(i) for i in existing]
    for i in items:
        i["prices"]  = dict(i.get("prices", {}))
        i["history"] = {k: list(v) for k, v in i.get("history", {}).items()}

    next_id = max((i["id"] for i in items), default=0) + 1
    stats   = {"updated": 0, "unchanged": 0, "added": 0}

    for s in scraped:
        sid, price, sname = s["store"], s["price"], s["name"]

        # Find best match
        best, best_score = None, 0.0
        for item in items:
            sc = similarity(sname, item["name"])
            if sc > best_score:
                best_score, best = sc, item

        if best and best_score >= 0.55:
            old = best["prices"].get(sid)
            h   = best["history"].get(sid, [])

            if old != price:
                if old:
                    print(f"    PRICE: {best['name']} @ {sid}: EUR{old:.2f} -> EUR{price:.2f}")
                h = (h + [old] if old else h) + [price]
                best["prices"][sid]  = price
                stats["updated"] += 1
            else:
                h = h + [price]
                stats["unchanged"] += 1

            best["history"][sid] = h[-5:]
        else:
            items.append({
                "id":       next_id,
                "name":     sname,
                "quantity": s.get("quantity", ""),
                "category": s.get("category", "Other"),
                "prices":   {sid: price},
                "history":  {sid: [price]},
            })
            print(f"    NEW: {sname} @ {sid} EUR{price:.2f} (id:{next_id})")
            next_id += 1
            stats["added"] += 1

    return items, stats


# ── Main ──────────────────────────────────────────────────────────

def generate_web_data_js(items, output_path):
    """Generate web/js/data.js from the merged data.json items list."""
    import os
    stores_js = """  { id: 'tesco',      name: 'Tesco',             color: '#EE1C25', emoji: '🔴' },
  { id: 'lidl',       name: 'Lidl',              color: '#0050AA', emoji: '🔵' },
  { id: 'aldi',       name: 'Aldi',              color: '#FF6600', emoji: '🟠' },
  { id: 'asian',      name: 'Asian Supermarket', color: '#9B5DE5', emoji: '🟣' },
  { id: 'supervalue', name: 'Super Value',       color: '#06D6A0', emoji: '🟢' },"""

    def fmt_item(it):
        p_str = ', '.join(f"{k}: {v}" for k, v in it['prices'].items())
        h_parts = []
        for k, v in it.get('history', {}).items():
            h_parts.append(f"{k}: [{','.join(str(x) for x in v)}]")
        h_str = ', '.join(h_parts)
        n = it['name'].replace("'", "\\'")
        q = str(it.get('quantity', '')).replace("'", "\\'")
        cat = it.get('category', 'Other')
        return (
            f"  {{\n"
            f"    id: {it['id']}, name: '{n}', quantity: '{q}', category: '{cat}',\n"
            f"    prices:  {{ {p_str} }},\n"
            f"    history: {{ {h_str} }}\n"
            f"  }}"
        )

    js_items = ',\n'.join(fmt_item(it) for it in items)
    next_id = max((i['id'] for i in items), default=0) + 1

    content = f"""// ─── js/data.js ──────────────────────────────────────────────────
// Central data store. Auto-generated by unified_scraper.py — do not hand-edit.

const stores = [
{stores_js}
];

let items = [
{js_items},
];

let basket = [];
let splitItems = [];
let customStoreCount = 0;
let nextId = {next_id};
"""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"  Wrote {len(items)} items -> {output_path}")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--limit",   type=int, default=0, help="items per store (0 = unlimited)")
    p.add_argument("--store",   default=None)
    p.add_argument("--data",    default="../mobile/shared/data.json")
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()

    limit = args.limit if args.limit > 0 else None

    dp = Path(args.data)
    if not dp.exists():
        print(f"ERROR: data.json not found at {args.data}")
        sys.exit(1)

    with open(dp) as f:
        data = json.load(f)
    existing = data.get("items", [])

    print(f"BasketBuddy Unified Scraper")
    print(f"  Existing items : {len(existing)}")
    print(f"  Limit/store    : {limit or 'unlimited'}")
    print(f"  Store filter   : {args.store or 'all'}")
    print(f"  Mode           : {'DRY RUN' if args.dry_run else 'LIVE'}")
    print("=" * 50)

    scraped = []
    use_pw  = not args.store or args.store in ("tesco", "lidl", "supervalue")

    if use_pw:
        try:
            from playwright.sync_api import sync_playwright
        except ImportError:
            print("ERROR: playwright not installed. Run:")
            print("  pip install playwright && playwright install chromium")
            sys.exit(1)

        with sync_playwright() as pw:
            browser = pw.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-setuid-sandbox"]
            )
            ctx = browser.new_context(
                user_agent=HEADERS["User-Agent"],
                locale="en-IE",
                viewport={"width": 1280, "height": 900},
            )
            page = ctx.new_page()

            # Accept Tesco cookies once
            print("\nAccepting cookies...")
            try:
                page.goto("https://www.tesco.ie/groceries/en-IE/shop/fresh-food/all",
                          timeout=20000, wait_until="domcontentloaded")
                page.wait_for_timeout(2000)
                for sel in ["#onetrust-accept-btn-handler",
                            "button:has-text('Accept all')",
                            "button:has-text('Accept cookies')"]:
                    btn = page.query_selector(sel)
                    if btn:
                        btn.click()
                        page.wait_for_timeout(800)
                        print(f"  Cookies accepted")
                        break
            except Exception: pass

            print()
            if not args.store or args.store == "tesco":
                scraped += scrape_tesco(page, limit)
            if not args.store or args.store == "lidl":
                scraped += scrape_lidl(page, limit)
            if not args.store or args.store == "supervalue":
                scraped += scrape_supervalu(page, limit)

            browser.close()

    if not args.store or args.store == "aldi":
        scraped += scrape_aldi(limit)

    print(f"\nTotal scraped: {len(scraped)}")

    if not scraped:
        print("Nothing scraped -- data.json unchanged.")
        return

    print(f"\nMerging into data.json...")
    merged, stats = merge(existing, scraped)

    print(f"\nResults:")
    print(f"  Prices updated  : {stats['updated']}")
    print(f"  Prices unchanged: {stats['unchanged']}")
    print(f"  New items added : {stats['added']}")
    print(f"  Total items now : {len(merged)}")

    if args.dry_run:
        print("\nDRY RUN -- nothing saved.")
        return

    data["items"] = merged
    with open(dp, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"\nSaved -> {dp}")

    # Also regenerate web/js/data.js so web and mobile stay in sync
    web_js_path = str(dp.parent.parent / "web" / "js" / "data.js")
    print(f"\nGenerating web data.js...")
    generate_web_data_js(merged, web_js_path)

    print(f"Done! {datetime.now().strftime('%H:%M:%S')}")


if __name__ == "__main__":
    main()