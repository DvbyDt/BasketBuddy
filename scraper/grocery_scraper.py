"""
Grocery Price Scraper — Tesco.ie & Lidl.ie
==========================================
Uses Groq (FREE) for AI query generation — no Ollama, no Anthropic needed.
Reads your GROQ_API_KEY from a .env file automatically.

Setup (one time):
    pip install requests beautifulsoup4 playwright lxml python-dotenv groq
    playwright install chromium

    Create a .env file in this folder:
        GROQ_API_KEY=gsk_your_key_here

    Get a free key at: console.groq.com (no credit card)

Usage:
    python grocery_scraper.py              # fill in missing prices only
    python grocery_scraper.py --force      # re-scrape every single item
    python grocery_scraper.py --ai         # use Groq AI for smart queries
    python grocery_scraper.py --force --ai # full refresh with AI
"""

import csv
import time
import re
import json
import logging
import argparse
import sys
import os
from pathlib import Path
from dataclasses import dataclass
from typing import Optional

# Load .env file automatically — reads GROQ_API_KEY from .env
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv not installed — key must be set manually via export

logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
log = logging.getLogger(__name__)

INPUT_CSV   = "Grocery_Price_Comparison_Notion_Template_all.csv"
OUTPUT_CSV  = "grocery_prices_updated.csv"
QUERY_CACHE = "query_cache.json"

GROQ_MODEL  = "llama-3.3-70b-versatile"   # free on Groq


# ── Data model ────────────────────────────────────────────────────

@dataclass
class GroceryItem:
    name: str
    category: str
    quantity: str
    asian_price: str
    lidl_price: str
    super_value_price: str
    tesco_price: str


# ── CSV helpers ───────────────────────────────────────────────────

def load_csv(path: str) -> list[GroceryItem]:
    items = []
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = row.get("Itemtom", "").strip()
            if not name:
                continue
            items.append(GroceryItem(
                name=name,
                category=row.get("Category", "").strip(),
                quantity=row.get("Quantity / Weight", "").strip(),
                asian_price=row.get("Asian Supermarket (€)", "0").strip(),
                lidl_price=row.get("Lidl (€)", "0").strip(),
                super_value_price=row.get("Super Value", "").strip(),
                tesco_price=row.get("Tesco (€)", "0").strip(),
            ))
    log.info(f"Loaded {len(items)} items from {path}")
    return items


def save_csv(items: list[GroceryItem], path: str):
    fieldnames = [
        "Itemtom", "Asian Supermarket (€)", "Category",
        "Lidl (€)", "Quantity / Weight", "Super Value", "Tesco (€)"
    ]
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for item in items:
            writer.writerow({
                "Itemtom": item.name,
                "Asian Supermarket (€)": item.asian_price,
                "Category": item.category,
                "Lidl (€)": item.lidl_price,
                "Quantity / Weight": item.quantity,
                "Super Value": item.super_value_price,
                "Tesco (€)": item.tesco_price,
            })
    log.info(f"Saved updated CSV → {path}")


# ── Query cache ───────────────────────────────────────────────────

def load_cache(path: str) -> dict:
    if Path(path).exists():
        with open(path) as f:
            return json.load(f)
    return {}


def save_cache(cache: dict, path: str):
    with open(path, "w") as f:
        json.dump(cache, f, indent=2)


# ── Helpers ───────────────────────────────────────────────────────

def parse_price(text: str) -> Optional[str]:
    match = re.search(r"\d+\.\d{1,2}|\d+", text.replace(",", "."))
    return match.group(0) if match else None


def is_empty_price(val: str) -> bool:
    return not val or val.strip() in ("0", "", "-", "0.0", "0.00")


def build_basic_query(item: GroceryItem) -> str:
    """Rule-based query: clean name + quantity. No AI needed."""
    name = item.name
    name = re.sub(r"(?i)^(tesco|lidl|aldi|supervalu|super value)\s+", "", name)
    name = re.sub(r"\(.*?\)", "", name).strip()
    if "/" in name:
        parts = [p.strip() for p in name.split("/")]
        name = max(parts, key=len)
    qty = item.quantity.strip()
    if qty and qty not in ("-", "", "0"):
        qty = re.sub(r"(?i)pack of (\d+)", r"\1 pack", qty)
        return f"{name} {qty}".strip().lower()
    return name.strip().lower()


# ── Groq AI query generation ──────────────────────────────────────

def query_groq(item: GroceryItem) -> Optional[dict]:
    """
    Call Groq API (free) to generate smart search queries.
    Reads GROQ_API_KEY from .env file automatically.
    """
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        log.error("GROQ_API_KEY not found. Add it to your .env file.")
        return None

    try:
        from groq import Groq
        client = Groq(api_key=api_key)

        prompt = f"""You generate short grocery search queries for Tesco.ie and Lidl.ie in Dublin, Ireland.

Item: "{item.name}"
Category: "{item.category}"
Quantity: "{item.quantity or 'unknown'}"

Rules:
- Fix typos (e.g. "Cork flakes" → "corn flakes", "Funsize" → "fun size")
- Include quantity only if specific (500g, 1kg, 6 pack) — skip "-" or blank
- Strip store prefixes (e.g. "Tesco Baby Potato" → "baby potato")
- Plain lowercase, no brackets, 2-5 words max

Respond ONLY with valid JSON, no explanation, no markdown:
{{"tesco": "search query", "lidl": "search query"}}"""

        response = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=80,
            temperature=0.1
        )

        raw = response.choices[0].message.content.strip()
        raw = re.sub(r"```json|```", "", raw).strip()
        return json.loads(raw)

    except ImportError:
        log.error("Groq library not installed. Run: pip install groq")
        return None
    except json.JSONDecodeError as e:
        log.warning(f"  Groq returned invalid JSON: {e}")
        return None
    except Exception as e:
        log.warning(f"  Groq error: {e}")
        return None


def ai_generate_query(item: GroceryItem, cache: dict) -> dict:
    """
    Generate smart search queries.
    Priority: cache → Groq AI → basic rule-based fallback
    """
    cache_key = f"{item.name}|{item.quantity}"

    # 1. Use cached result if available (saves API calls on re-runs)
    if cache_key in cache:
        log.info(f"  (cached) tesco='{cache[cache_key]['tesco']}' lidl='{cache[cache_key]['lidl']}'")
        return cache[cache_key]

    # 2. Call Groq (free)
    log.info(f"  Asking Groq ({GROQ_MODEL})...")
    result = query_groq(item)

    if result and "tesco" in result and "lidl" in result:
        log.info(f"  ✅ Groq: tesco='{result['tesco']}' lidl='{result['lidl']}'")
        cache[cache_key] = result
        return result

    # 3. Fall back to basic rule-based query
    log.info(f"  Using basic query builder")
    fallback = build_basic_query(item)
    return {"tesco": fallback, "lidl": fallback}


# ── Tesco.ie scraper ──────────────────────────────────────────────

def scrape_tesco(query: str) -> Optional[str]:
    """Search Tesco.ie using headless Chromium (handles JS rendering)."""
    try:
        from playwright.sync_api import sync_playwright

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ))
            url = f"https://www.tesco.ie/groceries/en-GB/search?query={query.replace(' ', '+')}"
            page.goto(url, timeout=25000, wait_until="domcontentloaded")
            page.wait_for_timeout(3000)

            selectors = [
                "[data-auto='price-value']",
                ".price-per-sellable-unit .value",
                ".beans-price__text",
                ".price .value",
                "[class*='price'] .value",
            ]
            for selector in selectors:
                el = page.query_selector(selector)
                if el:
                    price = parse_price(el.inner_text())
                    if price:
                        browser.close()
                        return price

            browser.close()
            return None

    except Exception as e:
        log.warning(f"  Tesco scrape error: {e}")
        return None


# ── Lidl.ie scraper ───────────────────────────────────────────────

def scrape_lidl(query: str) -> Optional[str]:
    """Search Lidl.ie via JSON API with HTML fallback."""
    try:
        import requests
        from bs4 import BeautifulSoup

        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            "Accept-Language": "en-IE,en;q=0.9",
        }

        # Try Lidl JSON API first
        api_url = (
            "https://www.lidl.ie/api/gridboxes/IE/en-IE/"
            f"?query={requests.utils.quote(query)}&amount=5"
        )
        resp = requests.get(api_url, headers={**headers, "Accept": "application/json"}, timeout=10)
        if resp.status_code == 200:
            for box in resp.json().get("gridBoxes", []):
                price = (
                    box.get("price", {}).get("price")
                    or box.get("price", {}).get("originalPrice")
                )
                if price:
                    return str(price)

        # HTML fallback
        search_url = f"https://www.lidl.ie/en/search?query={query.replace(' ', '+')}"
        resp = requests.get(search_url, headers={**headers, "Accept": "text/html"}, timeout=10)
        soup = BeautifulSoup(resp.text, "lxml")
        for selector in [".m-price__bottom", ".price", "[class*='price']"]:
            el = soup.select_one(selector)
            if el:
                price = parse_price(el.get_text())
                if price:
                    return price

        return None

    except Exception as e:
        log.warning(f"  Lidl scrape error: {e}")
        return None


# ── Main loop ─────────────────────────────────────────────────────

def update_prices(items: list[GroceryItem], force: bool, use_ai: bool) -> list[GroceryItem]:
    cache = load_cache(QUERY_CACHE)
    total = len(items)
    tesco_updated = lidl_updated = 0

    for i, item in enumerate(items, 1):
        log.info(f"\n[{i}/{total}] '{item.name}' | qty: '{item.quantity or 'none'}' | cat: '{item.category}'")

        # Build search queries
        if use_ai:
            queries = ai_generate_query(item, cache)
            save_cache(cache, QUERY_CACHE)
            tesco_q = queries.get("tesco") or build_basic_query(item)
            lidl_q  = queries.get("lidl")  or build_basic_query(item)
        else:
            tesco_q = lidl_q = build_basic_query(item)

        log.info(f"  → Tesco: '{tesco_q}'  |  Lidl: '{lidl_q}'")

        # Scrape Tesco
        if force or is_empty_price(item.tesco_price):
            price = scrape_tesco(tesco_q)
            if price:
                log.info(f"  ✅ Tesco: €{price}")
                item.tesco_price = price
                tesco_updated += 1
            else:
                log.info(f"  ❌ Tesco: not found")
            time.sleep(1.5)
        else:
            log.info(f"  ⏭  Tesco: keeping €{item.tesco_price}  (use --force to refresh)")

        # Scrape Lidl
        if force or is_empty_price(item.lidl_price):
            price = scrape_lidl(lidl_q)
            if price:
                log.info(f"  ✅ Lidl:  €{price}")
                item.lidl_price = price
                lidl_updated += 1
            else:
                log.info(f"  ❌ Lidl:  not found")
            time.sleep(1.0)
        else:
            log.info(f"  ⏭  Lidl:  keeping €{item.lidl_price}  (use --force to refresh)")

    log.info(f"\nTesco updated: {tesco_updated} | Lidl updated: {lidl_updated}")
    return items


# ── Entry point ───────────────────────────────────────────────────

def parse_args():
    parser = argparse.ArgumentParser(description="Grocery scraper — Tesco.ie & Lidl.ie")
    parser.add_argument("--force", action="store_true",
                        help="Re-scrape ALL items including already-priced ones")
    parser.add_argument("--ai", action="store_true",
                        help="Use Groq AI to clean names and build smart queries (reads GROQ_API_KEY from .env)")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()

    if not Path(INPUT_CSV).exists():
        log.error(f"CSV not found: {INPUT_CSV}")
        log.error("Place your Notion export in the same folder as this script.")
        sys.exit(1)

    if args.ai:
        key = os.getenv("GROQ_API_KEY")
        if not key:
            log.error("GROQ_API_KEY not found!")
            log.error("Create a .env file in this folder with:")
            log.error("  GROQ_API_KEY=gsk_your_key_here")
            log.error("Get a free key at: console.groq.com")
            sys.exit(1)
        log.info(f"AI: Groq ({GROQ_MODEL}) — reading key from .env ✅")
    else:
        log.info("AI: OFF — using basic query builder (add --ai for smarter matching)")

    log.info(f"Force: {'ON' if args.force else 'OFF'}")

    items = load_csv(INPUT_CSV)
    items = update_prices(items, force=args.force, use_ai=args.ai)
    save_csv(items, OUTPUT_CSV)

    tesco_filled = sum(1 for i in items if not is_empty_price(i.tesco_price))
    lidl_filled  = sum(1 for i in items if not is_empty_price(i.lidl_price))

    print(f"\n✅ Done!")
    print(f"   Output : {OUTPUT_CSV}")
    print(f"   Total  : {len(items)} items")
    print(f"   Tesco  : {tesco_filled}/{len(items)} prices found")
    print(f"   Lidl   : {lidl_filled}/{len(items)} prices found")
    if args.ai:
        print(f"   Cache  : {QUERY_CACHE} (reused on next run — delete to regenerate)")
