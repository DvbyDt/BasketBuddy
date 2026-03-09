#!/usr/bin/env python3
"""
scrape_offers.py — Scrapes weekly offers from Tesco, Lidl, Aldi, SuperValu.
Matches results to BasketBuddy data.json items using Groq AI.
If scraping fails or finds nothing, outputs an empty offers array.

Usage:
    python scrape_offers.py
    python scrape_offers.py --data ../mobile/shared/data.json --output ../mobile/shared/offers.json
    python scrape_offers.py --dry-run
    python scrape_offers.py --no-ai
"""

import argparse
import json
import os
import re
import time
from datetime import datetime, timedelta
from pathlib import Path

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

load_dotenv()
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-IE,en;q=0.9",
}


# ── Load items ────────────────────────────────────────────────────

def load_items(data_path: str) -> list:
    try:
        with open(data_path) as f:
            return json.load(f).get("items", [])
    except FileNotFoundError:
        print(f"⚠️  data.json not found at {data_path}")
        return []


# ── Scrapers ──────────────────────────────────────────────────────

def scrape_tesco() -> list:
    offers = []
    urls = [
        "https://www.tesco.ie/groceries/en-IE/promotions/all",
        "https://www.tesco.ie/groceries/en-IE/promotions/clubcard-prices",
    ]
    for url in urls:
        try:
            print(f"  GET {url}")
            r = requests.get(url, headers=HEADERS, timeout=15)
            if r.status_code != 200:
                print(f"  ⚠️  HTTP {r.status_code}")
                continue
            soup = BeautifulSoup(r.text, "lxml")
            for tile in soup.select(
                "[data-auto='product-tile'], .product-list--list-item, "
                ".styled__StyledProductListItem, [class*='ProductTile']"
            ):
                name_el  = tile.select_one(".product-title, [data-auto='product-title'], [class*='Name']")
                price_el = tile.select_one(".price-per-sellable-unit, .offer-text, [class*='OfferText'], [class*='Price']")
                was_el   = tile.select_one(".price-per-sellable-unit--price-was, [class*='WasPrice']")
                if not name_el:
                    continue
                o = parse_raw(
                    name_el.get_text(strip=True),
                    price_el.get_text(strip=True) if price_el else "",
                    was_el.get_text(strip=True) if was_el else "",
                    "tesco",
                )
                if o:
                    offers.append(o)
            time.sleep(1.5)
        except Exception as e:
            print(f"  ❌ Tesco error: {e}")
    print(f"  → Tesco: {len(offers)} raw offers")
    return offers


def scrape_lidl() -> list:
    offers = []
    urls = [
        "https://www.lidl.ie/en/offers",
        "https://www.lidl.ie/en/middle-of-lidl",
    ]
    for url in urls:
        try:
            print(f"  GET {url}")
            r = requests.get(url, headers=HEADERS, timeout=15)
            if r.status_code != 200:
                print(f"  ⚠️  HTTP {r.status_code}")
                continue
            soup = BeautifulSoup(r.text, "lxml")
            for tile in soup.select(
                ".offer-tile, .product-tile, [class*='OfferTile'], [class*='ProductTile']"
            ):
                name_el  = tile.select_one("h3, h4, [class*='title'], [class*='Title']")
                price_el = tile.select_one("[class*='price'], [class*='Price']")
                was_el   = tile.select_one("[class*='old'], [class*='was'], [class*='Was']")
                if not name_el:
                    continue
                o = parse_raw(
                    name_el.get_text(strip=True),
                    price_el.get_text(strip=True) if price_el else "",
                    was_el.get_text(strip=True) if was_el else "",
                    "lidl",
                )
                if o:
                    offers.append(o)
            time.sleep(1.0)
        except Exception as e:
            print(f"  ❌ Lidl error: {e}")
    print(f"  → Lidl: {len(offers)} raw offers")
    return offers


def scrape_aldi() -> list:
    offers = []
    url = "https://www.aldi.ie/offers"
    try:
        print(f"  GET {url}")
        r = requests.get(url, headers=HEADERS, timeout=15)
        if r.status_code != 200:
            print(f"  ⚠️  HTTP {r.status_code}")
            return offers
        soup = BeautifulSoup(r.text, "lxml")
        for tile in soup.select(
            ".tile, [class*='offer'], [class*='Offer'], [class*='product-tile'], [class*='ProductTile']"
        ):
            name_el  = tile.select_one("h3, h4, [class*='title'], [class*='name']")
            price_el = tile.select_one("[class*='price'], [class*='Price']")
            was_el   = tile.select_one("[class*='was'], [class*='old'], [class*='original']")
            if not name_el:
                continue
            o = parse_raw(
                name_el.get_text(strip=True),
                price_el.get_text(strip=True) if price_el else "",
                was_el.get_text(strip=True) if was_el else "",
                "aldi",
            )
            if o:
                offers.append(o)
        time.sleep(1.0)
    except Exception as e:
        print(f"  ❌ Aldi error: {e}")
    print(f"  → Aldi: {len(offers)} raw offers")
    return offers


def scrape_supervalu() -> list:
    offers = []
    url = "https://shop.supervalu.ie/sm/delivery/rsid/5550/offers"
    try:
        print(f"  GET {url}")
        r = requests.get(url, headers=HEADERS, timeout=15)
        if r.status_code != 200:
            print(f"  ⚠️  HTTP {r.status_code}")
            return offers
        soup = BeautifulSoup(r.text, "lxml")
        for tile in soup.select(
            "[data-testid*='product'], .product-card, [class*='ProductCard'], [class*='product-card']"
        ):
            name_el  = tile.select_one("[data-testid='product-name'], h3, h4, [class*='name']")
            price_el = tile.select_one("[data-testid='product-price'], [class*='price']")
            was_el   = tile.select_one("[class*='was'], [data-testid='was-price']")
            if not name_el:
                continue
            o = parse_raw(
                name_el.get_text(strip=True),
                price_el.get_text(strip=True) if price_el else "",
                was_el.get_text(strip=True) if was_el else "",
                "supervalue",
            )
            if o:
                offers.append(o)
        time.sleep(1.0)
    except Exception as e:
        print(f"  ❌ SuperValu error: {e}")
    print(f"  → SuperValu: {len(offers)} raw offers")
    return offers


# ── Parser ────────────────────────────────────────────────────────

def parse_raw(name: str, offer_text: str, was_text: str, store_id: str) -> dict | None:
    name = name.strip()
    if len(name) < 3:
        return None

    now_price = extract_price(offer_text) or extract_price(name)
    was_price = extract_price(was_text)
    combined  = (name + " " + offer_text + " " + was_text).lower()

    if "buy" in combined and ("get" in combined or "free" in combined):
        dtype, value = "bogo", 1
    elif re.search(r"\d+\s*for", combined):
        dtype, value = "multibuy", extract_multibuy(combined) or 0
    elif "%" in combined:
        dtype, value = "percentage", extract_pct(combined) or 10
    elif was_price and now_price and was_price > now_price:
        dtype, value = "fixed", round(was_price - now_price, 2)
    elif now_price:
        dtype, value = "fixed_price", now_price
    else:
        return None  # not enough info

    valid_until = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")

    return {
        "id": f"{store_id}-{slugify(name)}",
        "itemId": None,
        "storeId": store_id,
        "itemName": name,
        "description": build_desc(name, dtype, value, was_price, now_price),
        "discountType": dtype,
        "value": value,
        "originalPrice": was_price,
        "offerPrice": now_price,
        "validUntil": valid_until,
    }


def extract_price(text: str) -> float | None:
    if not text:
        return None
    m = re.search(r"€\s*([\d]+\.[\d]{1,2}|[\d]+)", text)
    return float(m.group(1)) if m else None

def extract_pct(text: str) -> int | None:
    m = re.search(r"(\d+)\s*%", text)
    return int(m.group(1)) if m else None

def extract_multibuy(text: str) -> float | None:
    m = re.search(r"\d+\s*for\s*€?\s*([\d.]+)", text)
    return float(m.group(1)) if m else None

def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:40]

def build_desc(name, dtype, value, was, now) -> str:
    if dtype == "bogo":        return f"Buy 1 Get 1 Free — {name}"
    if dtype == "percentage":  return f"{value}% off — {name}"
    if dtype == "fixed" and was and now:
        return f"Was €{was:.2f}, Now €{now:.2f} — {name}"
    if dtype == "fixed_price" and now:
        return f"Special price €{now:.2f} — {name}"
    if dtype == "multibuy":    return f"Multibuy deal — {name}"
    return f"Offer on {name}"


# ── AI Matching ───────────────────────────────────────────────────

def match_with_ai(offers: list, items: list) -> list:
    if not GROQ_API_KEY:
        print("⚠️  No GROQ_API_KEY — using basic name matching")
        return match_basic(offers, items)

    print(f"\n🤖 AI matching {len(offers)} offers → {len(items)} items...")
    item_list = "\n".join([
        f'{i["id"]}: {i["name"]}{" (" + i["quantity"] + ")" if i["quantity"] else ""}'
        for i in items
    ])

    matched = []
    BATCH = 20
    for start in range(0, len(offers), BATCH):
        batch = offers[start:start + BATCH]
        offer_list = "\n".join([
            f'{idx}: {o["itemName"]} ({o["storeId"]})'
            for idx, o in enumerate(batch)
        ])
        prompt = f"""Match grocery offer names to this product catalog.

CATALOG (id: name):
{item_list}

OFFERS (index: name (store)):
{offer_list}

Return ONLY a JSON array: [{{"index":0,"itemId":7}}, ...]
Use itemId: null if no match. No markdown."""

        try:
            resp = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
                json={"model": "llama-3.3-70b-versatile", "max_tokens": 800,
                      "messages": [{"role": "user", "content": prompt}]},
                timeout=30,
            )
            raw = resp.json()["choices"][0]["message"]["content"]
            results = json.loads(raw.replace("```json", "").replace("```", "").strip())
            for r in results:
                idx, item_id = r.get("index"), r.get("itemId")
                if idx is not None and idx < len(batch) and item_id is not None:
                    offer = dict(batch[idx])
                    offer["itemId"] = item_id
                    matched.append(offer)
            print(f"  Batch {start//BATCH + 1}: {len([r for r in results if r.get('itemId')])}/{len(batch)} matched")
            time.sleep(0.5)
        except Exception as e:
            print(f"  ⚠️  AI batch error: {e} — falling back to basic for this batch")
            for offer in batch:
                result = match_one_basic(offer, items)
                if result:
                    matched.append(result)

    return matched


def match_basic(offers: list, items: list) -> list:
    return [r for o in offers for r in [match_one_basic(o, items)] if r]

def match_one_basic(offer: dict, items: list) -> dict | None:
    name = offer["itemName"].lower()
    best, score = None, 0
    for item in items:
        words = set(re.split(r"\W+", item["name"].lower()))
        offer_words = set(re.split(r"\W+", name))
        overlap = len(words & offer_words)
        if overlap > score:
            score, best = overlap, item
    if score >= 1 and best:
        return {**offer, "itemId": best["id"]}
    return None


# ── Main ──────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data",    default="data.json")
    parser.add_argument("--output",  default="offers.json")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--no-ai",   action="store_true")
    args = parser.parse_args()

    print("🛒 BasketBuddy Offers Scraper")
    print("=" * 40)

    items = load_items(args.data)
    print(f"📦 {len(items)} items loaded\n")

    print("📡 Scraping stores...")
    raw = []
    raw += scrape_tesco()
    raw += scrape_lidl()
    raw += scrape_aldi()
    raw += scrape_supervalu()
    print(f"\n📊 Total raw: {len(raw)}")

    # If nothing scraped, write empty and exit cleanly
    if len(raw) == 0:
        print("\n⚠️  No offers scraped from any store.")
        output = {"updatedAt": datetime.now().isoformat(), "offers": []}
        if not args.dry_run:
            with open(args.output, "w") as f:
                json.dump(output, f, indent=2)
            print(f"💾 Empty offers.json saved to {args.output}")
        return

    # Match to items
    if items:
        matched = match_with_ai(raw, items) if not args.no_ai else match_basic(raw, items)
    else:
        matched = raw  # no items to match against, keep all

    # Deduplicate
    seen, deduped = set(), []
    for o in matched:
        if o["id"] not in seen:
            seen.add(o["id"])
            deduped.append(o)

    # Filter expired
    today = datetime.now().strftime("%Y-%m-%d")
    deduped = [o for o in deduped if o.get("validUntil", "9999") >= today]

    print(f"\n✅ Final matched offers: {len(deduped)}")

    output = {"updatedAt": datetime.now().isoformat(), "offers": deduped}

    if args.dry_run:
        print("\n📋 DRY RUN:")
        for o in deduped:
            print(f"  [{o['storeId']}] {o['description']} → itemId {o['itemId']}")
    else:
        with open(args.output, "w") as f:
            json.dump(output, f, indent=2)
        print(f"💾 Saved → {args.output}")


if __name__ == "__main__":
    main()