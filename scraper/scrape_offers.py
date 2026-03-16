#!/usr/bin/env python3
"""
scrape_offers.py — Scrapes REAL weekly offers using Playwright (headless Chrome).

WHY PLAYWRIGHT:
  All 4 Irish grocery sites are JavaScript-rendered React/Vue apps.
  Plain requests.get() returns empty HTML. We need a real browser.

HOW IT WORKS:
  1. Playwright opens a real Chrome browser (headless, invisible)
  2. Navigates to each store's offers/promotions page
  3. Waits for JavaScript to load the product tiles
  4. Extracts: name, current price, was-price, offer description
  5. Groq AI matches scraped names → your data.json item IDs
  6. Saves to offers.json — app reads this file

IMPORTANT:
  If scraping returns 0 results, the EXISTING offers.json is kept unchanged.
  We NEVER write fake/dummy data. Empty = nothing shown in app.

USAGE:
  python scrape_offers.py                         # full run, save to offers.json
  python scrape_offers.py --dry-run               # show results, don't save
  python scrape_offers.py --store tesco           # one store only
  python scrape_offers.py --data path/data.json   # custom data.json path

SETUP (one time):
  pip install playwright requests python-dotenv
  playwright install chromium
"""

import argparse
import json
import os
import re
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv()
GROQ_API_KEY = os.getenv("GROQ_API_KEY")


# ── Helpers ───────────────────────────────────────────────────────

def parse_price(text: str) -> float | None:
    if not text:
        return None
    text = text.replace(",", ".").replace("€", "").strip()
    m = re.search(r"(\d+\.\d{1,2}|\d+)", text)
    if m:
        v = float(m.group(1))
        return v if 0.01 < v < 500 else None
    return None

def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:35]

def valid_until_str(days=7) -> str:
    return (datetime.now() + timedelta(days=days)).strftime("%Y-%m-%d")

def make_description(name, dtype, value, was, now) -> str:
    if dtype == "bogo":        return f"Buy 1 Get 1 Free — {name}"
    if dtype == "percentage":  return f"{int(value)}% off — {name}"
    if dtype == "fixed" and was and now:
        return f"Was €{was:.2f}, Now €{now:.2f} — {name}"
    if dtype == "fixed_price": return f"Special price €{now:.2f} — {name}"
    if dtype == "multibuy":    return f"Multibuy deal — {name}"
    return f"Offer on {name}"

def build_offer(name, now_text, was_text, store_id) -> dict | None:
    name = name.strip()
    if len(name) < 2 or len(name) > 120:
        return None

    now = parse_price(now_text)
    was = parse_price(was_text)
    combo = (name + " " + now_text + " " + was_text).lower()

    if re.search(r"buy\s*1\s*get\s*1|b1g1|bogo|free", combo):
        dtype, value = "bogo", 1
    elif re.search(r"\d+\s*for\s*[€£]?\d", combo):
        dtype, value = "multibuy", _multibuy_val(combo) or 0
    elif re.search(r"\d+\s*%\s*off", combo):
        dtype, value = "percentage", _pct_val(combo) or 10
    elif was and now and was > now:
        dtype, value = "fixed", round(was - now, 2)
    elif now:
        dtype, value = "fixed_price", now
    else:
        return None

    if dtype == "fixed" and value < 0.01:
        return None

    return {
        "id":           f"{store_id}-{slugify(name)}-{int(time.time()) % 100000}",
        "itemId":       None,
        "storeId":      store_id,
        "itemName":     name,
        "description":  make_description(name, dtype, value, was, now),
        "discountType": dtype,
        "value":        value,
        "originalPrice": was,
        "offerPrice":   now,
        "validUntil":   valid_until_str(7),
    }

def _pct_val(text):
    m = re.search(r"(\d+)\s*%", text)
    return int(m.group(1)) if m else None

def _multibuy_val(text):
    m = re.search(r"\d+\s*for\s*[€£]?\s*(\d+[\.,]\d{1,2}|\d+)", text.replace(",", "."))
    return float(m.group(1)) if m else None


# ── Tesco Offers (Playwright) ─────────────────────────────────────

def scrape_tesco_offers(page) -> list:
    offers = []
    print("  🔴 Tesco offers...")

    urls = [
        "https://www.tesco.ie/groceries/en-IE/promotions/all?count=48",
        "https://www.tesco.ie/groceries/en-IE/promotions/clubcard-prices?count=48",
    ]

    for url in urls:
        try:
            page.goto(url, timeout=25000, wait_until="domcontentloaded")
            try:
                page.wait_for_selector(
                    "[data-auto='product-tile'], .product-list--list-item",
                    timeout=12000
                )
            except Exception:
                print(f"    No products loaded at {url[:50]}")
                continue

            page.wait_for_timeout(2000)

            tiles = page.query_selector_all(
                "[data-auto='product-tile'], .product-list--list-item"
            )
            print(f"    Found {len(tiles)} tiles at {url[:50]}")

            for tile in tiles:
                try:
                    name_el  = tile.query_selector("[data-auto='product-title'], .product-title, h3")
                    price_el = tile.query_selector(".price-per-sellable-unit .value, .beans-price__text, [data-auto='price-value']")
                    was_el   = tile.query_selector(".price-per-sellable-unit--price-was .value, [data-auto='price-was']")
                    offer_el = tile.query_selector(".offer-text, [data-auto='offer-badge'], .clubcard-price")

                    if not name_el:
                        continue

                    name      = name_el.inner_text().strip()
                    price_txt = price_el.inner_text().strip() if price_el else ""
                    was_txt   = was_el.inner_text().strip() if was_el else ""
                    offer_txt = offer_el.inner_text().strip() if offer_el else ""

                    # Use offer text if it gives more info (e.g. "3 for €5")
                    combined_price = offer_txt or price_txt

                    o = build_offer(name, combined_price, was_txt, "tesco")
                    if o:
                        offers.append(o)
                except Exception:
                    continue

            time.sleep(1.5)
        except Exception as e:
            print(f"    ❌ Tesco error: {e}")

    print(f"  → Tesco: {len(offers)} raw offers")
    return offers


# ── Lidl Offers (Playwright) ──────────────────────────────────────

def scrape_lidl_offers(page) -> list:
    offers = []
    print("  🔵 Lidl offers...")

    urls = [
        "https://www.lidl.ie/c/weekly-offers/c10000",
        "https://www.lidl.ie/c/fresh-food/c100",
    ]

    for url in urls:
        try:
            page.goto(url, timeout=25000, wait_until="domcontentloaded")
            try:
                page.wait_for_selector(
                    ".s-grid__item, [class*='ProductTile'], .ret-o-card, [class*='product']",
                    timeout=12000
                )
            except Exception:
                print(f"    No products loaded at {url[:50]}")
                continue

            page.wait_for_timeout(2000)

            tiles = page.query_selector_all(
                ".s-grid__item, [class*='ProductTile'], .ret-o-card"
            )
            print(f"    Found {len(tiles)} tiles at {url[:50]}")

            for tile in tiles:
                try:
                    name_el  = tile.query_selector("h3, h4, [class*='headline'], [class*='title']")
                    price_el = tile.query_selector(".m-price, [class*='price-value'], [class*='Price']")
                    was_el   = tile.query_selector(".m-price--rrp, [class*='rrp'], [class*='was']")

                    if not name_el:
                        continue

                    name      = name_el.inner_text().strip()
                    price_txt = price_el.inner_text().strip() if price_el else ""
                    was_txt   = was_el.inner_text().strip() if was_el else ""

                    # Only include if there's an actual discount
                    now = parse_price(price_txt)
                    was = parse_price(was_txt)
                    if not (was and now and was > now) and "%" not in price_txt and "for" not in price_txt.lower():
                        continue

                    o = build_offer(name, price_txt, was_txt, "lidl")
                    if o:
                        offers.append(o)
                except Exception:
                    continue

            time.sleep(1.5)
        except Exception as e:
            print(f"    ❌ Lidl error: {e}")

    print(f"  → Lidl: {len(offers)} raw offers")
    return offers


# ── Aldi Offers (Playwright) ──────────────────────────────────────

def scrape_aldi_offers(page) -> list:
    offers = []
    print("  🟠 Aldi offers...")

    try:
        page.goto("https://www.aldi.ie/en/special-buys", timeout=25000, wait_until="domcontentloaded")
        try:
            page.wait_for_selector(
                ".js-product-tile, .product-tile, [class*='ProductCard']",
                timeout=10000
            )
        except Exception:
            print("    No products loaded")
            return offers

        page.wait_for_timeout(2000)

        tiles = page.query_selector_all(
            ".js-product-tile, .product-tile, [class*='ProductCard']"
        )
        print(f"    Found {len(tiles)} tiles")

        for tile in tiles:
            try:
                name_el  = tile.query_selector("h3, h4, .product-tile__name, [class*='name']")
                price_el = tile.query_selector(".product-tile__price, [class*='price']")
                was_el   = tile.query_selector(".product-tile__price--rrp, [class*='rrp']")

                if not name_el:
                    continue

                name      = name_el.inner_text().strip()
                price_txt = price_el.inner_text().strip() if price_el else ""
                was_txt   = was_el.inner_text().strip() if was_el else ""

                o = build_offer(name, price_txt, was_txt, "aldi")
                if o:
                    offers.append(o)
            except Exception:
                continue

    except Exception as e:
        print(f"    ❌ Aldi error: {e}")

    print(f"  → Aldi: {len(offers)} raw offers")
    return offers


# ── SuperValu Offers (Playwright) ─────────────────────────────────

def scrape_supervalu_offers(page) -> list:
    offers = []
    print("  🟢 SuperValu offers...")

    try:
        page.goto(
            "https://shop.supervalu.ie/sm/delivery/rsid/5550/offers",
            timeout=25000, wait_until="domcontentloaded"
        )
        try:
            page.wait_for_selector(
                "[data-testid='product-item'], .product-card, [class*='ProductItem']",
                timeout=12000
            )
        except Exception:
            print("    No products loaded")
            return offers

        page.wait_for_timeout(2000)

        tiles = page.query_selector_all(
            "[data-testid='product-item'], .product-card, [class*='ProductItem']"
        )
        print(f"    Found {len(tiles)} tiles")

        for tile in tiles:
            try:
                name_el  = tile.query_selector("[data-testid='product-name'], .product-name, h3")
                price_el = tile.query_selector("[data-testid='product-price'], [class*='price']")
                was_el   = tile.query_selector("[data-testid='was-price'], [class*='was']")

                if not name_el:
                    continue

                name      = name_el.inner_text().strip()
                price_txt = price_el.inner_text().strip() if price_el else ""
                was_txt   = was_el.inner_text().strip() if was_el else ""

                o = build_offer(name, price_txt, was_txt, "supervalue")
                if o:
                    offers.append(o)
            except Exception:
                continue

    except Exception as e:
        print(f"    ❌ SuperValu error: {e}")

    print(f"  → SuperValu: {len(offers)} raw offers")
    return offers


# ── Groq AI Matching ──────────────────────────────────────────────

def match_offers_to_catalog(offers: list, items: list) -> list:
    """
    Uses Groq (free) to fuzzy-match scraped offer names → data.json item IDs.
    Falls back to keyword matching if Groq unavailable.
    """
    if not items:
        print("  ⚠️  No catalog items — keeping all offers unmatched")
        return offers

    if not GROQ_API_KEY:
        print("  ⚠️  No GROQ_API_KEY — using keyword matching")
        return _keyword_match_all(offers, items)

    print(f"\n  🤖 Groq matching {len(offers)} offers → {len(items)} catalog items...")
    catalog = "\n".join([
        f"{i['id']}: {i['name']}" + (f" ({i['quantity']})" if i.get('quantity') else "")
        for i in items
    ])

    matched = []
    BATCH   = 20

    for start in range(0, len(offers), BATCH):
        batch = offers[start:start + BATCH]
        offer_lines = "\n".join([
            f"{idx}: {o['itemName']} @ {o['storeId']}"
            for idx, o in enumerate(batch)
        ])

        prompt = f"""You are matching grocery offer names to a product catalog.
Return ONLY a JSON array. No explanation, no markdown.

CATALOG (id: name):
{catalog}

OFFERS (index: scraped name @ store):
{offer_lines}

Match each offer to the most similar catalog item by name.
Use itemId: null if there is no reasonable match.

Return: [{{"index": 0, "itemId": 7}}, {{"index": 1, "itemId": null}}, ...]"""

        try:
            resp = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
                json={
                    "model": "llama-3.3-70b-versatile",
                    "max_tokens": 600,
                    "temperature": 0.1,
                    "messages": [{"role": "user", "content": prompt}],
                },
                timeout=30,
            )
            raw     = resp.json()["choices"][0]["message"]["content"]
            clean   = raw.replace("```json", "").replace("```", "").strip()
            results = json.loads(clean)

            hit = 0
            for r in results:
                idx, item_id = r.get("index"), r.get("itemId")
                if idx is not None and idx < len(batch):
                    o = dict(batch[idx])
                    o["itemId"] = item_id
                    matched.append(o)
                    if item_id is not None:
                        hit += 1

            print(f"    Batch {start // BATCH + 1}: {hit}/{len(batch)} matched to catalog")
            time.sleep(0.5)

        except Exception as e:
            print(f"    ⚠️  Groq error: {e} — keyword fallback for this batch")
            matched.extend(_keyword_match_all(batch, items))

    return matched


def _keyword_match_all(offers, items):
    return [_keyword_match_one(o, items) for o in offers]

def _keyword_match_one(offer, items):
    words = set(re.split(r"\W+", offer["itemName"].lower()))
    best, score = None, 0
    for item in items:
        iw = set(re.split(r"\W+", item["name"].lower()))
        overlap = len(words & iw)
        if overlap > score:
            score, best = overlap, item
    result = dict(offer)
    result["itemId"] = best["id"] if (best and score >= 1) else None
    return result


# ── Main ──────────────────────────────────────────────────────────

def load_items(data_path):
    try:
        with open(data_path) as f:
            return json.load(f).get("items", [])
    except FileNotFoundError:
        print(f"  ⚠️  data.json not found at {data_path}")
        return []


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data",    default="../mobile/shared/data.json")
    parser.add_argument("--output",  default="../mobile/shared/offers.json")
    parser.add_argument("--store",   default=None, help="Scrape one store only: tesco|lidl|aldi|supervalue")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--no-ai",   action="store_true")
    args = parser.parse_args()

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("❌ Playwright not installed. Run: pip install playwright && playwright install chromium")
        sys.exit(1)

    print("🏷️  BasketBuddy Offers Scraper (Playwright)")
    print("=" * 50)

    items = load_items(args.data)
    print(f"📦 Loaded {len(items)} catalog items\n")
    print("📡 Launching headless Chrome...")

    raw = []

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox"]
        )
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/122.0.0.0 Safari/537.36"
            ),
            locale="en-IE",
            viewport={"width": 1280, "height": 900},
        )
        page = context.new_page()

        # Accept cookies once
        print("🍪 Handling cookie consent...")
        try:
            page.goto("https://www.tesco.ie/groceries/en-IE/promotions/all", timeout=20000, wait_until="domcontentloaded")
            page.wait_for_timeout(2000)
            for sel in ["#onetrust-accept-btn-handler", "button:has-text('Accept all')", "button:has-text('Accept cookies')"]:
                btn = page.query_selector(sel)
                if btn:
                    btn.click()
                    page.wait_for_timeout(800)
                    break
        except Exception:
            pass

        print("📡 Scraping stores...\n")

        store = args.store
        if not store or store == "tesco":      raw += scrape_tesco_offers(page)
        if not store or store == "lidl":       raw += scrape_lidl_offers(page)
        if not store or store == "aldi":       raw += scrape_aldi_offers(page)
        if not store or store == "supervalue": raw += scrape_supervalu_offers(page)

        browser.close()

    print(f"\n📊 Total raw offers scraped: {len(raw)}")

    if len(raw) == 0:
        print("\n⚠️  No offers scraped from any store.")
        print("   Possible causes:")
        print("   - Store websites changed their HTML structure (update selectors)")
        print("   - Network/timeout issues (try again)")
        print("   - Stores have no active offers this week")
        print("\n   The existing offers.json is kept unchanged.")
        # IMPORTANT: Do NOT overwrite with empty — keep previous file
        return

    # Match to catalog
    if not args.no_ai:
        matched = match_offers_to_catalog(raw, items)
    else:
        matched = _keyword_match_all(raw, items) if items else raw

    # Deduplicate
    seen, deduped = set(), []
    for o in matched:
        key = f"{o['storeId']}-{o['itemId'] or slugify(o['itemName'])}"
        if key not in seen:
            seen.add(key)
            deduped.append(o)

    # Filter expired
    today  = datetime.now().strftime("%Y-%m-%d")
    active = [o for o in deduped if o.get("validUntil", "9999") >= today]

    with_id    = [o for o in active if o.get("itemId") is not None]
    without_id = [o for o in active if o.get("itemId") is None]

    print(f"\n✅ Final: {len(active)} offers")
    print(f"   Matched to your catalog: {len(with_id)} (these appear in the app)")
    print(f"   No catalog match:        {len(without_id)} (hidden — not in your 91 items)")

    output = {"updatedAt": datetime.now().isoformat(), "offers": active}

    if args.dry_run:
        print("\n📋 DRY RUN — not saving:")
        for o in with_id[:15]:
            print(f"  [{o['storeId']}] item #{o['itemId']} — {o['description']}")
        if len(with_id) > 15:
            print(f"  ... and {len(with_id) - 15} more")
    else:
        Path(args.output).parent.mkdir(parents=True, exist_ok=True)
        with open(args.output, "w") as f:
            json.dump(output, f, indent=2)
        print(f"\n💾 Saved → {args.output}")
        print(f"   The app will show {len(with_id)} offers on next load")


if __name__ == "__main__":
    main()