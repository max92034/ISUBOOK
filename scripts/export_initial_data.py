import csv
import os
import xlrd

EXCEL_PATH = r'c:\Users\max92034\.trae-cn\attachments\6a85248c1cf9f57731cb72a3\dc992e5c-97d2-4caa-b983-30a33128f58b_8f49780c-62c0-4731-9dac-53748cf1f70e_USI庫存及接单明细总档 (version 3).xls'
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
SNAPSHOT_DIR = os.path.join(DATA_DIR, 'snapshots')
os.makedirs(SNAPSHOT_DIR, exist_ok=True)

def safe_num(val):
    if val is None or val == '' or val == '#N/A':
        return 0
    if isinstance(val, str):
        try:
            return float(val)
        except:
            return 0
    return float(val) if isinstance(val, (int, float)) else 0

def safe_str(val):
    if val is None:
        return ''
    s = str(val).strip()
    if s == '0.0' or s == '0':
        # Don't treat numeric 0 as string for text fields
        pass
    return s

wb = xlrd.open_workbook(EXCEL_PATH, formatting_info=False)

# === 1. Read "在網站的情況" for English descriptions and website status ===
ws_web = wb.sheet_by_name('在網站的情況')
web_info = {}
for r in range(1, ws_web.nrows):
    item = safe_str(ws_web.cell_value(r, 1))  # B = Item
    if not item or len(item) < 3:
        continue
    web_info[item] = {
        'english_name': safe_str(ws_web.cell_value(r, 3)),  # D
        'factory_unshipped': safe_num(ws_web.cell_value(r, 8)),  # I
        'website_on': safe_str(ws_web.cell_value(r, 9)),  # J
        'web_note': safe_str(ws_web.cell_value(r, 11)),  # L
    }

# === 2. Read "不再销售的型号" for discontinued info ===
ws_disc = wb.sheet_by_name('不再销售的型号')
disc_info = {}
for r in range(ws_disc.nrows):
    item = safe_str(ws_disc.cell_value(r, 0))  # A
    if not item or len(item) < 3:
        continue
    disc_info[item] = {
        'english_name': safe_str(ws_disc.cell_value(r, 3)),  # D
        'sales_total': safe_num(ws_disc.cell_value(r, 4)),  # E
    }

# === 3. Read main "USI庫存情況" sheet ===
ws = wb.sheet_by_name('USI庫存情況')

products = []
inventory = []

# Row 0 = ETA info, Row 1 = empty, Row 2 = headers, Row 3+ = data
for row_idx in range(3, ws.nrows):
    item = ws.cell_value(row_idx, 0)  # A
    if not item:
        continue
    item = str(item).strip()
    if len(item) < 3:
        continue

    name = safe_str(ws.cell_value(row_idx, 2))  # C
    if not name:
        continue

    discontinued = safe_str(ws.cell_value(row_idx, 1))    # B
    prod_unit = safe_str(ws.cell_value(row_idx, 26))       # AA
    factory_inv = safe_num(ws.cell_value(row_idx, 20))    # U
    ship_wh = safe_num(ws.cell_value(row_idx, 21))        # V
    sales_2025 = safe_num(ws.cell_value(row_idx, 22))     # W
    total_shipped = safe_num(ws.cell_value(row_idx, 23))  # X
    notes = safe_str(ws.cell_value(row_idx, 24))          # Y
    notes2 = safe_str(ws.cell_value(row_idx, 25))         # Z
    directive = safe_str(ws.cell_value(row_idx, 27))      # AB
    pl_mold = safe_str(ws.cell_value(row_idx, 29))        # AD

    total_produced = safe_num(ws.cell_value(row_idx, 16))  # Q
    huiyang_inv = safe_num(ws.cell_value(row_idx, 17))     # R
    indonesia_inv = safe_num(ws.cell_value(row_idx, 18))  # S
    myanmar_inv = safe_num(ws.cell_value(row_idx, 19))    # T

    g_inv = safe_num(ws.cell_value(row_idx, 6))    # G
    h_orders = safe_num(ws.cell_value(row_idx, 7))  # H
    i_intransit = safe_num(ws.cell_value(row_idx, 8))  # I

    l_prev = safe_num(ws.cell_value(row_idx, 11))  # L
    m_prev = safe_num(ws.cell_value(row_idx, 12))  # M
    n_prev = safe_num(ws.cell_value(row_idx, 13))  # N

    # Get English name from web info or discontinued info
    english_name = ''
    factory_unshipped = 0
    website_on = ''
    web_note = ''
    if item in web_info:
        english_name = web_info[item]['english_name']
        factory_unshipped = web_info[item]['factory_unshipped']
        website_on = web_info[item]['website_on']
        web_note = web_info[item]['web_note']
    elif item in disc_info:
        english_name = disc_info[item]['english_name']

    products.append({
        'item_code': item, 'name': name, 'english_name': english_name,
        'discontinued': discontinued, 'production_unit': prod_unit,
        'factory_inventory': factory_inv, 'shipping_warehouse': ship_wh,
        'sales_2025': sales_2025, 'total_shipped': total_shipped,
        'notes': notes, 'notes2': notes2, 'directive': directive,
        'pl_mold': pl_mold,
        'total_produced': total_produced, 'huiyang_inv': huiyang_inv,
        'indonesia_inv': indonesia_inv, 'myanmar_inv': myanmar_inv,
        'factory_unshipped': factory_unshipped,
        'website_on': website_on, 'web_note': web_note,
    })
    inventory.append({
        'item_code': item, 'g_inventory': g_inv, 'h_orders': h_orders,
        'i_intransit': i_intransit, 'l_prev_inventory': l_prev,
        'm_prev_orders': m_prev, 'n_prev_intransit': n_prev,
    })

# Write products CSV
prod_fields = ['item_code', 'name', 'english_name', 'discontinued',
    'production_unit', 'factory_inventory', 'shipping_warehouse',
    'sales_2025', 'total_shipped', 'notes', 'notes2', 'directive',
    'pl_mold', 'total_produced', 'huiyang_inv', 'indonesia_inv',
    'myanmar_inv', 'factory_unshipped', 'website_on', 'web_note']
with open(os.path.join(DATA_DIR, 'products.csv'), 'w', newline='', encoding='utf-8-sig') as f:
    w = csv.DictWriter(f, fieldnames=prod_fields)
    w.writeheader()
    w.writerows(products)

# Write inventory CSV
inv_fields = ['item_code', 'g_inventory', 'h_orders', 'i_intransit',
              'l_prev_inventory', 'm_prev_orders', 'n_prev_intransit']
with open(os.path.join(DATA_DIR, 'inventory.csv'), 'w', newline='', encoding='utf-8-sig') as f:
    w = csv.DictWriter(f, fieldnames=inv_fields)
    w.writeheader()
    w.writerows(inventory)

# === 4. Containers (D=6-29柜 is arrived, delete it; E and F are in transit) ===
containers = [
    {'id': 'E_7-16xr', 'ship_date': '2025-07-16', 'eta': '2025-08-31', 'route': 'XR', 'status': 'in_transit'},
    {'id': 'F_7-30HY', 'ship_date': '2025-07-30', 'eta': '2025-08-28', 'route': 'HY', 'status': 'in_transit'},
]
with open(os.path.join(DATA_DIR, 'containers.csv'), 'w', newline='', encoding='utf-8-sig') as f:
    w = csv.DictWriter(f, fieldnames=['id', 'ship_date', 'eta', 'route', 'status'])
    w.writeheader()
    w.writerows(containers)

# === 5. Snapshots ===
# Previous snapshot (L/M/N data) = 2025-08-05
with open(os.path.join(SNAPSHOT_DIR, '2025-08-05.csv'), 'w', newline='', encoding='utf-8-sig') as f:
    w = csv.DictWriter(f, fieldnames=['item_code', 'g_inventory', 'h_orders', 'i_intransit'])
    w.writeheader()
    for inv in inventory:
        w.writerow({'item_code': inv['item_code'], 'g_inventory': inv['l_prev_inventory'],
                    'h_orders': inv['m_prev_orders'], 'i_intransit': inv['n_prev_intransit']})

# Current snapshot (G/H/I data) = 2025-08-12
with open(os.path.join(SNAPSHOT_DIR, '2025-08-12.csv'), 'w', newline='', encoding='utf-8-sig') as f:
    w = csv.DictWriter(f, fieldnames=['item_code', 'g_inventory', 'h_orders', 'i_intransit'])
    w.writeheader()
    for inv in inventory:
        w.writerow({'item_code': inv['item_code'], 'g_inventory': inv['g_inventory'],
                    'h_orders': inv['h_orders'], 'i_intransit': inv['i_intransit']})

# Last import info
import json
with open(os.path.join(DATA_DIR, 'last_import.json'), 'w', encoding='utf-8') as f:
    json.dump({'date': '2025-08-12', 'filename': 'initial_export_v3', 'item_count': len(inventory)}, f)

# === 6. Import format reference (from '0812' sheet) ===
# The '0812' sheet uses A/B/C/D format: Item, PO, SO, OnHand
# Sheet1 uses A/C/E/G format: Item, PO, SO, OnHand (spaced out)
# Both formats should be supported by the import endpoint.

print(f'Exported {len(products)} products, {len(inventory)} inventory records, {len(containers)} containers')
print(f'Web info: {len(web_info)} items, Discontinued info: {len(disc_info)} items')
print(f'Data directory: {DATA_DIR}')

# Verify J = G-H-I for first 10 rows
print(f'\n=== Verification (first 10 rows) ===')
for i, inv in enumerate(inventory[:10]):
    g = inv['g_inventory']
    h = inv['h_orders']
    ii = inv['i_intransit']
    calc_j = round(g - h - ii, 1)
    print(f'  {inv["item_code"]}: G={g} H={h} I={ii} => J={calc_j}')
