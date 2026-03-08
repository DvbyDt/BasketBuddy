import requests
from bs4 import BeautifulSoup
import csv
import time

# Tesco category URLs (example, you can expand this list)
tesco_categories = [
    "https://www.tesco.ie/groceries/en-GB/shop/fresh-food/all",
    "https://www.tesco.ie/groceries/en-GB/shop/bakery/all",
    "https://www.tesco.ie/groceries/en-GB/shop/drinks/all",
    # Add more category URLs here
]

def scrape_tesco_category(url):
    items = []
    page = 1
    while True:
        paged_url = f"{url}?page={page}"
        resp = requests.get(paged_url, timeout=15)
        soup = BeautifulSoup(resp.text, "lxml")
        products = soup.select(".product-list--list-item")
        if not products:
            break
        for prod in products:
            name = prod.select_one(".product-title").get_text(strip=True) if prod.select_one(".product-title") else ""
            price = prod.select_one(".price-per-sellable-unit .value").get_text(strip=True) if prod.select_one(".price-per-sellable-unit .value") else ""
            qty = prod.select_one(".product-info-pack-size").get_text(strip=True) if prod.select_one(".product-info-pack-size") else ""
            items.append({"name": name, "price": price, "quantity": qty, "category": url.split("/shop/")[1].split("/")[0]})
        page += 1
        time.sleep(1)
    return items

def scrape_all_tesco():
    all_items = []
    for cat_url in tesco_categories:
        print(f"Scraping Tesco category: {cat_url}")
        items = scrape_tesco_category(cat_url)
        all_items.extend(items)
    with open("tesco_all_items.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["name", "price", "quantity", "category"])
        writer.writeheader()
        for item in all_items:
            writer.writerow(item)
    print(f"Done. Total items scraped: {len(all_items)}")

if __name__ == "__main__":
    scrape_all_tesco()
