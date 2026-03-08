import requests
from bs4 import BeautifulSoup
import csv
import time

# Lidl category URLs (example, you can expand this list)
lidl_categories = [
    "https://www.lidl.ie/c/fresh-fruit-vegetables/c1000",
    "https://www.lidl.ie/c/bakery/c1002",
    "https://www.lidl.ie/c/drinks/c1003",
    # Add more category URLs here
]

def scrape_lidl_category(url):
    items = []
    page = 1
    while True:
        paged_url = f"{url}?page={page}"
        resp = requests.get(paged_url, timeout=15)
        soup = BeautifulSoup(resp.text, "lxml")
        products = soup.select(".product-list-item")
        if not products:
            break
        for prod in products:
            name = prod.select_one(".product-title").get_text(strip=True) if prod.select_one(".product-title") else ""
            price = prod.select_one(".m-price__bottom").get_text(strip=True) if prod.select_one(".m-price__bottom") else ""
            qty = prod.select_one(".product-info-pack-size").get_text(strip=True) if prod.select_one(".product-info-pack-size") else ""
            items.append({"name": name, "price": price, "quantity": qty, "category": url.split("/c/")[1].split("/")[0]})
        page += 1
        time.sleep(1)
    return items

def scrape_all_lidl():
    all_items = []
    for cat_url in lidl_categories:
        print(f"Scraping Lidl category: {cat_url}")
        items = scrape_lidl_category(cat_url)
        all_items.extend(items)
    with open("lidl_all_items.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["name", "price", "quantity", "category"])
        writer.writeheader()
        for item in all_items:
            writer.writerow(item)
    print(f"Done. Total items scraped: {len(all_items)}")

if __name__ == "__main__":
    scrape_all_lidl()
