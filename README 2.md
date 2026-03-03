# Grocery Price Scraper — Setup & Usage

## What it does
Reads your Notion CSV, searches Tesco.ie and Lidl.ie for each item,
and writes an updated CSV with live prices filled in.

---

## 1. Install dependencies

```bash
pip install requests beautifulsoup4 playwright lxml
playwright install chromium
```

---

## 2. Place your files

Put both files in the **same folder**:
- `grocery_scraper.py`
- `Grocery_Price_Comparison_Notion_Template_all.csv`  ← your Notion export

---

## 3. Run the scraper

```bash
python grocery_scraper.py
```

Output file will be created: **`grocery_prices_updated.csv`**

---

## 4. Schedule it weekly (optional)

**Mac/Linux** — add to crontab (runs every Monday at 8am):
```
0 8 * * 1 cd /path/to/folder && python grocery_scraper.py
```

**Windows** — use Task Scheduler to run `python grocery_scraper.py` weekly.

---

## Notes
- The scraper only fills in prices that are currently `0` or empty — it won't overwrite data you've manually entered.
- Tesco uses JavaScript rendering, so Playwright (headless browser) is used for it.
- Lidl has a JSON API endpoint that's faster.
- A polite delay is built in between requests to avoid being blocked.
- If a price isn't found, the original value is kept.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `playwright install` fails | Run `pip install playwright` first, then `playwright install chromium` |
| Tesco prices not found | Tesco may have changed their HTML — open an issue or update the CSS selector in `scrape_tesco()` |
| Getting blocked / 403 errors | Increase the `time.sleep()` delays in `update_prices()` |
| Wrong CSV file name | Rename your Notion export to match `INPUT_CSV` at the top of the script |
