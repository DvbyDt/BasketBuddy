import csv, json

rows = []
with open("grocery_prices_updated.csv", newline='', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    for r in reader:
        rows.append(dict(r))

def parse_price(val):
    if val is None: return None
    val = val.strip()
    if not val or val == '0': return None
    try:
        p = float(val)
        return p if p > 0 else None
    except:
        return None

items = []
item_id = 1

for r in rows:
    name = r.get('Itemtom', '').strip()
    if not name:
        continue
    qty = (r.get('Quantity / Weight') or '').strip()
    cat = (r.get('Category') or '').strip()

    prices = {}
    asian = parse_price(r.get('Asian Supermarket (\u20ac)'))
    lidl = parse_price(r.get('Lidl (\u20ac)'))
    sv = parse_price(r.get('Super Value'))
    tesco = parse_price(r.get('Tesco (\u20ac)'))

    if asian: prices['asian'] = asian
    if lidl: prices['lidl'] = lidl
    if sv: prices['supervalue'] = sv
    if tesco: prices['tesco'] = tesco

    if not prices:
        continue

    history = {}
    for sid, p in prices.items():
        base = round(p * 0.95, 2)
        h = [round(base + (p - base) * (i / 4), 2) for i in range(5)]
        h[4] = p
        history[sid] = h

    # Clean up quantity display
    qty_display = qty if qty and qty != '-' else ''

    items.append({
        'id': item_id,
        'name': name,
        'quantity': qty_display,
        'category': cat if cat else 'Other',
        'prices': prices,
        'history': history
    })
    item_id += 1

print(f"Total items parsed: {len(items)}")

# Generate JS
lines = []
for it in items:
    p_str = ', '.join(f"{k}: {v}" for k, v in it['prices'].items())
    h_parts = []
    for k, v in it['history'].items():
        h_parts.append(f"{k}: [{','.join(str(x) for x in v)}]")
    h_str = ', '.join(h_parts)
    name_escaped = it['name'].replace("'", "\\'").replace('"', '\\"')
    qty_escaped = it['quantity'].replace("'", "\\'")
    lines.append(
        f"  {{\n"
        f"    id: {it['id']}, name: '{name_escaped}', quantity: '{qty_escaped}', category: '{it['category']}',\n"
        f"    prices:  {{ {p_str} }},\n"
        f"    history: {{ {h_str} }}\n"
        f"  }}"
    )

js_items = ',\n'.join(lines)
with open('/tmp/csv_items_v2.txt', 'w') as f:
    f.write(js_items)

print(f"nextId should be: {len(items) + 1}")
print("JS output written to /tmp/csv_items_v2.txt")
