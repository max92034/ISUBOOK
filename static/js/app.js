'use strict';

// ===== Constants =====
const LS_KEYS = {
  PRODUCTS: 'usibook_products',
  INVENTORY: 'usibook_inventory',
  CONTAINERS: 'usibook_containers',
  LAST_IMPORT: 'usibook_last_import',
  SNAPSHOTS: 'usibook_snapshots',
};

const WEEKS_IN_YEAR = 52;
const WARN_WEEKS = 4;
const FOUR_MONTHS = 17;

const SKU_COLS = ['sku', 'item', 'item code', 'item_code', 'item no', 'item number', 'product', 'product code', 'product id', 'model', 'model no', '型號', '產品編號', '品號', '編號', '商品編號', '貨號'];
const QTY_COLS = ['quantity', 'qty', 'quantity ordered', 'order quantity', 'order qty', '數量', '訂購數量', '訂單數量', 'amount', 'count', '訂購量'];

// ===== State =====
const state = {
  products: [],
  inventory: [],
  containers: [],
  lastImport: null,
  snapshots: {},
  mergedData: [],
  stats: null,
  currentPage: 1,
  perPage: 50,
  sortField: 'j',
  sortDir: 'asc',
  statusFilter: '',
  prodFilter: '',
  searchQuery: '',
  selectedFile: null,
  selectedOrderFile: null,
  charts: {},
  orderItems: [],
  orderAnalysis: [],
  orderFileName: '',
  orderRawRows: [],
  orderHeaders: [],
  orderDetectedSkuCol: 0,
  orderDetectedQtyCol: 1,
};

// ===== Utility =====
const fmt = (n) => {
  if (n === null || n === undefined) return '-';
  if (typeof n !== 'number') return n;
  return n.toLocaleString('en-US', { maximumFractionDigits: 1 });
};

const fmtSigned = (n) => {
  if (n === null || n === undefined) return '-';
  const s = fmt(Math.abs(n));
  return n < 0 ? `(${s})` : s;
};

function safeNum(val) {
  if (val === null || val === undefined || val === '' || val === '#N/A') return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

function safeStr(val) {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

function valClass(n) {
  if (n < 0) return 'neg';
  if (n > 0) return 'pos';
  return '';
}

function statusIcon(status) {
  if (status === 'red') return '<span class="status-badge status-red">!</span>';
  if (status === 'yellow') return '<span class="status-badge status-yellow">▲</span>';
  return '<span class="status-badge status-green">✓</span>';
}

// ===== Data Layer (localStorage) =====
function loadData() {
  try {
    state.products = JSON.parse(localStorage.getItem(LS_KEYS.PRODUCTS) || '[]');
    state.inventory = JSON.parse(localStorage.getItem(LS_KEYS.INVENTORY) || '[]');
    state.containers = JSON.parse(localStorage.getItem(LS_KEYS.CONTAINERS) || '[]');
    state.lastImport = JSON.parse(localStorage.getItem(LS_KEYS.LAST_IMPORT) || 'null');
    state.snapshots = JSON.parse(localStorage.getItem(LS_KEYS.SNAPSHOTS) || '{}');
  } catch (e) {
    console.error('Failed to load data:', e);
    state.products = [];
    state.inventory = [];
    state.containers = [];
    state.lastImport = null;
    state.snapshots = {};
  }
}

function saveProducts() {
  localStorage.setItem(LS_KEYS.PRODUCTS, JSON.stringify(state.products));
}

function saveInventory() {
  localStorage.setItem(LS_KEYS.INVENTORY, JSON.stringify(state.inventory));
}

function saveContainers() {
  localStorage.setItem(LS_KEYS.CONTAINERS, JSON.stringify(state.containers));
}

function saveLastImport() {
  localStorage.setItem(LS_KEYS.LAST_IMPORT, JSON.stringify(state.lastImport));
}

function saveSnapshots() {
  localStorage.setItem(LS_KEYS.SNAPSHOTS, JSON.stringify(state.snapshots));
}

function hasData() {
  return state.products.length > 0;
}

// ===== Business Logic (ported from Python) =====
function getWeeksElapsed() {
  if (state.lastImport && state.lastImport.date && state.lastImport.date !== 'N/A') {
    const d = new Date(state.lastImport.date);
    const salesYear = 2025;
    if (d.getFullYear() === salesYear) {
      const start = new Date(salesYear, 0, 1);
      const diffDays = Math.floor((d - start) / (1000 * 60 * 60 * 24));
      return Math.max(1, Math.floor(diffDays / 7));
    }
    return 52;
  }
  return 33;
}

function calculateStatus(j, sales2025, pDiff, iIntransit, weeksElapsed) {
  if (j <= 0) return 'red';
  const weeklyRate = sales2025 > 0 && weeksElapsed > 0 ? sales2025 / weeksElapsed : 0;
  if (weeklyRate > 0) {
    const weeksLeft = j / weeklyRate;
    if (weeksLeft < WARN_WEEKS) return 'yellow';
  }
  if (pDiff !== null && pDiff < 0 && weeklyRate === 0) return 'yellow';
  return 'green';
}

function getMergedData() {
  const invMap = {};
  for (const inv of state.inventory) {
    invMap[inv.item_code] = inv;
  }
  const weeksElapsed = getWeeksElapsed();

  const merged = [];
  for (const p of state.products) {
    const code = p.item_code;
    const inv = invMap[code] || {};
    const g = safeNum(inv.g_inventory);
    const h = safeNum(inv.h_orders);
    const i = safeNum(inv.i_intransit);
    const l = safeNum(inv.l_prev_inventory);
    const m = safeNum(inv.m_prev_orders);
    const n = safeNum(inv.n_prev_intransit);

    const j = Math.round((g - h + i) * 10) / 10;
    const o = Math.round((l - m + n) * 10) / 10;
    const pDiff = Math.round((j - o) * 10) / 10;

    const sales2025 = safeNum(p.sales_2025);
    const totalShipped = safeNum(p.total_shipped);
    const status = calculateStatus(j, sales2025, pDiff, i, weeksElapsed);

    const weeklyRateW = sales2025 > 0 && weeksElapsed > 0
      ? Math.round((sales2025 / weeksElapsed) * 10) / 10 : 0;
    const weeksLeftW = weeklyRateW > 0 ? Math.round((j / weeklyRateW) * 10) / 10 : null;
    const weeksLeftP = pDiff && pDiff < 0 ? Math.round((j / Math.abs(pDiff)) * 10) / 10 : null;

    const totalProduced = safeNum(p.total_produced);
    const huiyangInv = safeNum(p.huiyang_inv);
    const indonesiaInv = safeNum(p.indonesia_inv);
    const myanmarInv = safeNum(p.myanmar_inv);

    let prodStatus = 'none';
    if (j < 0 && Math.abs(j) < totalProduced) {
      prodStatus = 'judge';
    } else if (weeksLeftW !== null && weeksLeftW <= FOUR_MONTHS) {
      if (totalProduced < 20) {
        prodStatus = 'produce';
      } else if (totalProduced > 0) {
        prodStatus = 'available';
      }
    }

    merged.push({
      item_code: code,
      name: p.name || '',
      english_name: p.english_name || '',
      discontinued: p.discontinued || '',
      production_unit: p.production_unit || '',
      factory_inventory: safeNum(p.factory_inventory),
      shipping_warehouse: safeNum(p.shipping_warehouse),
      sales_2025: sales2025,
      total_shipped: totalShipped,
      notes: p.notes || '',
      notes2: p.notes2 || '',
      directive: p.directive || '',
      pl_mold: p.pl_mold || '',
      total_produced: totalProduced,
      huiyang_inv: huiyangInv,
      indonesia_inv: indonesiaInv,
      myanmar_inv: myanmarInv,
      factory_unshipped: safeNum(p.factory_unshipped),
      website_on: p.website_on || '',
      web_note: p.web_note || '',
      g, h, i, j, l, m, n, o, p: pDiff,
      status,
      prod_status: prodStatus,
      weekly_rate_w: weeklyRateW,
      weeks_left_w: weeksLeftW,
      weeks_left_p: weeksLeftP,
    });
  }
  return merged;
}

function computeStats() {
  const data = state.mergedData;
  const red = data.filter(d => d.status === 'red').length;
  const yellow = data.filter(d => d.status === 'yellow').length;
  const green = data.filter(d => d.status === 'green').length;
  const inTransit = state.containers.filter(c => c.status === 'in_transit').length;
  const topSellers = data.filter(d => d.sales_2025 > 0).sort((a, b) => b.sales_2025 - a.sales_2025).slice(0, 20);
  const slowSellers = data.filter(d => d.sales_2025 > 0).sort((a, b) => a.sales_2025 - b.sales_2025).slice(0, 20);
  const biggestDrops = data.filter(d => d.p < 0).sort((a, b) => a.p - b.p).slice(0, 10);
  const judge = data.filter(d => d.prod_status === 'judge').length;
  const available = data.filter(d => d.prod_status === 'available').length;
  const produce = data.filter(d => d.prod_status === 'produce').length;

  return {
    total_products: data.length,
    red, yellow, green,
    judge, available, produce,
    in_transit_containers: inTransit,
    last_import: state.lastImport || { date: 'N/A', filename: 'N/A', item_count: 0 },
    weeks_elapsed: getWeeksElapsed(),
    top_sellers: topSellers,
    slow_sellers: slowSellers,
    biggest_drops: biggestDrops,
  };
}

// ===== SheetJS Excel Parsing =====
function getCellValue(ws, r, c) {
  const addr = XLSX.utils.encode_cell({ r, c });
  const cell = ws[addr];
  return cell ? cell.v : '';
}

function detectHasColB(ws, maxRow) {
  for (let r = 1; r < Math.min(maxRow || 20, 20); r++) {
    const v = getCellValue(ws, r, 1);
    if (v !== '' && v !== null && v !== undefined) return true;
  }
  return false;
}

function parseMainExcel(workbook) {
  const wsMain = workbook.Sheets['USI庫存情況'];
  if (!wsMain) throw new Error('找不到「USI庫存情況」工作表');

  const range = XLSX.utils.decode_range(wsMain['!ref']);
  const wsWeb = workbook.Sheets['在網站的情況'];
  const wsDisc = workbook.Sheets['不再销售的型号'];

  const webInfo = {};
  if (wsWeb) {
    const webRange = XLSX.utils.decode_range(wsWeb['!ref']);
    for (let r = 1; r <= webRange.e.r; r++) {
      const item = safeStr(getCellValue(wsWeb, r, 1));
      if (!item || item.length < 3) continue;
      webInfo[item] = {
        english_name: safeStr(getCellValue(wsWeb, r, 3)),
        factory_unshipped: safeNum(getCellValue(wsWeb, r, 8)),
        website_on: safeStr(getCellValue(wsWeb, r, 9)),
        web_note: safeStr(getCellValue(wsWeb, r, 11)),
      };
    }
  }

  const discInfo = {};
  if (wsDisc) {
    const discRange = XLSX.utils.decode_range(wsDisc['!ref']);
    for (let r = 0; r <= discRange.e.r; r++) {
      const item = safeStr(getCellValue(wsDisc, r, 0));
      if (!item || item.length < 3) continue;
      discInfo[item] = {
        english_name: safeStr(getCellValue(wsDisc, r, 3)),
        sales_total: safeNum(getCellValue(wsDisc, r, 4)),
      };
    }
  }

  const products = [];
  const inventory = [];

  for (let r = 3; r <= range.e.r; r++) {
    const item = safeStr(getCellValue(wsMain, r, 0));
    if (!item || item.length < 3) continue;

    const name = safeStr(getCellValue(wsMain, r, 2));
    if (!name) continue;

    const discontinued = safeStr(getCellValue(wsMain, r, 1));
    const prodUnit = safeStr(getCellValue(wsMain, r, 26));
    const factoryInv = safeNum(getCellValue(wsMain, r, 20));
    const shipWh = safeNum(getCellValue(wsMain, r, 21));
    const sales2025 = safeNum(getCellValue(wsMain, r, 22));
    const totalShipped = safeNum(getCellValue(wsMain, r, 23));
    const notes = safeStr(getCellValue(wsMain, r, 24));
    const notes2 = safeStr(getCellValue(wsMain, r, 25));
    const directive = safeStr(getCellValue(wsMain, r, 27));
    const plMold = safeStr(getCellValue(wsMain, r, 29));

    const totalProduced = safeNum(getCellValue(wsMain, r, 16));
    const huiyangInv = safeNum(getCellValue(wsMain, r, 17));
    const indonesiaInv = safeNum(getCellValue(wsMain, r, 18));
    const myanmarInv = safeNum(getCellValue(wsMain, r, 19));

    const gInv = safeNum(getCellValue(wsMain, r, 6));
    const hOrders = safeNum(getCellValue(wsMain, r, 7));
    const iIntransit = safeNum(getCellValue(wsMain, r, 8));

    const lPrev = safeNum(getCellValue(wsMain, r, 11));
    const mPrev = safeNum(getCellValue(wsMain, r, 12));
    const nPrev = safeNum(getCellValue(wsMain, r, 13));

    let englishName = '';
    let factoryUnshipped = 0;
    let websiteOn = '';
    let webNote = '';
    if (webInfo[item]) {
      englishName = webInfo[item].english_name;
      factoryUnshipped = webInfo[item].factory_unshipped;
      websiteOn = webInfo[item].website_on;
      webNote = webInfo[item].web_note;
    } else if (discInfo[item]) {
      englishName = discInfo[item].english_name;
    }

    products.push({
      item_code: item, name, english_name: englishName,
      discontinued, production_unit: prodUnit,
      factory_inventory: factoryInv, shipping_warehouse: shipWh,
      sales_2025: sales2025, total_shipped: totalShipped,
      notes, notes2, directive, pl_mold: plMold,
      total_produced: totalProduced, huiyang_inv: huiyangInv,
      indonesia_inv: indonesiaInv, myanmar_inv: myanmarInv,
      factory_unshipped: factoryUnshipped,
      website_on: websiteOn, web_note: webNote,
    });
    inventory.push({
      item_code: item, g_inventory: gInv, h_orders: hOrders,
      i_intransit: iIntransit, l_prev_inventory: lPrev,
      m_prev_orders: mPrev, n_prev_intransit: nPrev,
    });
  }

  return { products, inventory };
}

function parseWeeklyExcel(workbook) {
  const ws = workbook.Sheets[workbook.SheetNames[0]];
  const range = XLSX.utils.decode_range(ws['!ref']);
  const hasColB = detectHasColB(ws, range.e.r);

  const importData = {};
  for (let r = 1; r <= range.e.r; r++) {
    const item = safeStr(getCellValue(ws, r, 0));
    if (!item || item.length < 3) continue;

    let po, so, onHand;
    if (hasColB) {
      po = safeNum(getCellValue(ws, r, 1));
      so = safeNum(getCellValue(ws, r, 2));
      onHand = safeNum(getCellValue(ws, r, 3));
    } else {
      po = safeNum(getCellValue(ws, r, 2));
      so = safeNum(getCellValue(ws, r, 4));
      onHand = safeNum(getCellValue(ws, r, 6));
    }
    importData[item] = { g: onHand, h: so, i: po };
  }
  return importData;
}

function parseCSVFile(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return {};

  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
  const hasHeaders = headers.some(h => h.includes('item') || h.includes('quantity'));

  const importData = {};

  if (hasHeaders) {
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      const item = (cols[0] || '').trim();
      if (!item || item.length < 3) continue;

      let po = 0, so = 0, onHand = 0;
      const findCol = (names) => {
        for (const name of names) {
          const idx = headers.indexOf(name);
          if (idx >= 0 && cols[idx]) return safeNum(cols[idx]);
        }
        return null;
      };
      po = findCol(['quantity on purchase order', 'b', 'c']) ?? 0;
      so = findCol(['quantity on sales order', 'c', 'e']) ?? 0;
      onHand = findCol(['quantity on hand', 'd', 'g']) ?? 0;
      importData[item] = { g: onHand, h: so, i: po };
    }
  } else {
    const hasColB = lines.length > 1 && parseCSVLine(lines[1])[1];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      const item = (cols[0] || '').trim();
      if (!item || item.length < 3) continue;

      let po, so, onHand;
      if (hasColB) {
        po = safeNum(cols[1]);
        so = safeNum(cols[2]);
        onHand = safeNum(cols[3]);
      } else {
        po = safeNum(cols[2]);
        so = safeNum(cols[4]);
        onHand = safeNum(cols[6]);
      }
      importData[item] = { g: onHand, h: so, i: po };
    }
  }
  return importData;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ===== Import Logic =====
function doMainImport(products, inventory) {
  state.products = products;
  state.inventory = inventory;
  state.lastImport = {
    date: new Date().toISOString().slice(0, 10),
    filename: 'initial_setup',
    item_count: inventory.length,
    new_items: inventory.length,
    updated_items: 0,
  };

  saveProducts();
  saveInventory();
  saveLastImport();

  const todayStr = new Date().toISOString().slice(0, 10);
  const snapshot = {};
  for (const inv of inventory) {
    snapshot[inv.item_code] = {
      g_inventory: inv.g_inventory,
      h_orders: inv.h_orders,
      i_intransit: inv.i_intransit,
    };
  }
  state.snapshots[todayStr] = snapshot;
  saveSnapshots();
}

function doWeeklyImport(importData, filename) {
  const invMap = {};
  for (const inv of state.inventory) {
    invMap[inv.item_code] = inv;
  }
  const prodMap = {};
  for (const p of state.products) {
    prodMap[p.item_code] = p;
  }

  let newItems = 0;
  let updatedItems = 0;

  for (const [itemCode, newVals] of Object.entries(importData)) {
    if (invMap[itemCode]) {
      const old = invMap[itemCode];
      old.l_prev_inventory = old.g_inventory;
      old.m_prev_orders = old.h_orders;
      old.n_prev_intransit = old.i_intransit;
      old.g_inventory = newVals.g;
      old.h_orders = newVals.h;
      old.i_intransit = newVals.i;
      updatedItems++;
    } else {
      const newInv = {
        item_code: itemCode,
        g_inventory: newVals.g,
        h_orders: newVals.h,
        i_intransit: newVals.i,
        l_prev_inventory: 0,
        m_prev_orders: 0,
        n_prev_intransit: 0,
      };
      state.inventory.push(newInv);
      invMap[itemCode] = newInv;
      newItems++;
    }

    if (!prodMap[itemCode]) {
      state.products.push({
        item_code: itemCode, name: '', english_name: '',
        discontinued: '', production_unit: '',
        factory_inventory: 0, shipping_warehouse: 0,
        sales_2025: 0, total_shipped: 0,
        notes: '', notes2: '', directive: '', pl_mold: '',
        total_produced: 0, huiyang_inv: 0,
        indonesia_inv: 0, myanmar_inv: 0,
        factory_unshipped: 0, website_on: '', web_note: '',
      });
      prodMap[itemCode] = state.products[state.products.length - 1];
    }
  }

  saveInventory();
  saveProducts();

  const todayStr = new Date().toISOString().slice(0, 10);
  const snapshot = {};
  for (const [itemCode, vals] of Object.entries(importData)) {
    snapshot[itemCode] = {
      g_inventory: vals.g,
      h_orders: vals.h,
      i_intransit: vals.i,
    };
  }
  state.snapshots[todayStr] = snapshot;
  saveSnapshots();

  state.lastImport = {
    date: todayStr,
    filename: filename,
    item_count: Object.keys(importData).length,
    new_items: newItems,
    updated_items: updatedItems,
  };
  saveLastImport();

  return { newItems, updatedItems, totalItems: Object.keys(importData).length };
}

// ===== Export =====
function exportCSV() {
  const data = state.mergedData;
  const fields = [
    'item_code', 'name', 'english_name', 'g', 'h', 'i', 'j', 'l', 'm', 'n', 'o', 'p',
    'sales_2025', 'total_shipped', 'status', 'prod_status', 'production_unit',
    'factory_inventory', 'shipping_warehouse', 'notes', 'directive',
    'total_produced', 'huiyang_inv', 'indonesia_inv', 'myanmar_inv',
    'factory_unshipped', 'website_on', 'web_note',
  ];
  const lines = [fields.join(',')];
  for (const d of data) {
    const row = fields.map(f => {
      const v = d[f];
      if (v === null || v === undefined) return '';
      const s = String(v);
      return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    });
    lines.push(row.join(','));
  }
  const csv = '\uFEFF' + lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8-sig' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `inventory_export_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportBackup() {
  const backup = {
    products: state.products,
    inventory: state.inventory,
    containers: state.containers,
    last_import: state.lastImport,
    snapshots: state.snapshots,
    export_date: new Date().toISOString(),
    version: '1.0',
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `usibook_backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importBackup(jsonText) {
  const data = JSON.parse(jsonText);
  if (!data.products || !data.inventory) throw new Error('Invalid backup file format');
  state.products = data.products;
  state.inventory = data.inventory;
  state.containers = data.containers || [];
  state.lastImport = data.last_import || null;
  state.snapshots = data.snapshots || {};
  saveProducts();
  saveInventory();
  saveContainers();
  saveLastImport();
  saveSnapshots();
}

// ===== Rendering =====
function refreshData() {
  state.mergedData = getMergedData();
  state.stats = computeStats();
}

function renderAll() {
  renderKPIs();
  renderContainers();
  renderDrops();
  renderTable();
  renderCharts();
}

function renderKPIs() {
  if (!state.stats) return;
  const s = state.stats;
  document.getElementById('red-count').textContent = fmt(s.red);
  document.getElementById('yellow-count').textContent = fmt(s.yellow);
  document.getElementById('green-count').textContent = fmt(s.green);
  document.getElementById('container-count').textContent = fmt(s.in_transit_containers);
  document.getElementById('judge-count').textContent = fmt(s.judge);
  document.getElementById('available-count').textContent = fmt(s.available);
  document.getElementById('produce-count').textContent = fmt(s.produce);

  const inTransit = state.containers.filter(c => c.status === 'in_transit');
  if (inTransit.length > 0) {
    const routes = inTransit.map(c => c.route).join(', ');
    const etas = inTransit.map(c => c.eta).sort();
    const nextEta = etas[0];
    document.getElementById('container-detail').textContent = `${routes} | 最近到貨: ${nextEta}`;
  } else {
    document.getElementById('container-detail').textContent = '無在途貨櫃';
  }

  const li = s.last_import;
  document.getElementById('last-update').textContent =
    `上次更新: ${li.date} | ${li.item_count || 0} 項產品`;
}

function renderContainers() {
  const el = document.getElementById('container-timeline');
  if (!state.containers.length) {
    el.innerHTML = '<p style="color:var(--color-text-sub)">無在途貨櫃</p>';
    return;
  }
  el.innerHTML = state.containers.map(c => `
    <div class="container-card">
      <span class="route-badge">${c.route || '?'}</span>
      <div class="ship-info">出貨: ${c.ship_date} → ETA: ${c.eta}</div>
      ${c.status === 'arrived'
        ? '<span class="arrived-badge">已到貨</span>'
        : '<span class="eta-badge">在途中</span>'}
      <button class="delete-btn" onclick="deleteContainer('${c.id}')" title="標記為已到貨並移除">✕</button>
    </div>
  `).join('');
}

function renderDrops() {
  const el = document.getElementById('biggest-drops');
  if (!state.stats || !state.stats.biggest_drops) {
    el.innerHTML = '';
    return;
  }
  el.innerHTML = state.stats.biggest_drops.map(d => `
    <div class="change-item" onclick="showDetail('${d.item_code}')" style="cursor:pointer">
      <div class="change-code">${d.item_code}</div>
      <div class="change-name">${d.name || ''}</div>
      <div class="change-p">${fmtSigned(d.p)}</div>
      <div class="change-j">結餘 J: ${fmt(d.j)}</div>
    </div>
  `).join('');
}

function getFiltered() {
  let data = state.mergedData;
  if (state.statusFilter) {
    data = data.filter(d => d.status === state.statusFilter);
  }
  if (state.prodFilter) {
    data = data.filter(d => d.prod_status === state.prodFilter);
  }
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    data = data.filter(d =>
      d.item_code.toLowerCase().includes(q) ||
      (d.name || '').toLowerCase().includes(q) ||
      (d.english_name || '').toLowerCase().includes(q)
    );
  }
  const field = state.sortField;
  const dir = state.sortDir === 'desc' ? -1 : 1;
  data = [...data].sort((a, b) => {
    let av = a[field], bv = b[field];
    if (typeof av === 'string') return av.localeCompare(bv || '') * dir;
    return ((av || 0) - (bv || 0)) * dir;
  });
  return data;
}

function renderTable() {
  const data = getFiltered();
  const start = (state.currentPage - 1) * state.perPage;
  const pageData = data.slice(start, start + state.perPage);
  const tbody = document.getElementById('product-tbody');

  tbody.innerHTML = pageData.map(d => {
    const weeksW = d.weeks_left_w !== null ? `${d.weeks_left_w} 週` : '無數據';
    const weeksP = d.weeks_left_p !== null ? `${d.weeks_left_p} 週` : '-';
    const estimate = d.weeks_left_w !== null ? weeksW : weeksP;
    return `
      <tr onclick="toggleDetail('${d.item_code}')" style="cursor:pointer">
        <td>${statusIcon(d.status)}</td>
        <td><strong>${d.item_code}</strong></td>
        <td>${d.name || ''}</td>
        <td style="font-size:11px;color:var(--color-text-sub)">${d.english_name || ''}</td>
        <td class="num">${fmt(d.g)}</td>
        <td class="num">${fmt(d.h)}</td>
        <td class="num">${fmt(d.i)}</td>
        <td class="num ${valClass(d.j)}"><strong>${fmtSigned(d.j)}</strong></td>
        <td class="num ${valClass(d.p)}">${fmtSigned(d.p)}</td>
        <td class="num">${fmt(d.sales_2025)}</td>
        <td class="num">${fmt(d.total_shipped)}</td>
        <td class="num" style="font-weight:600">${fmt(d.total_produced)}</td>
        <td class="num">${fmt(d.huiyang_inv)}</td>
        <td class="num">${fmt(d.indonesia_inv)}</td>
        <td class="num">${fmt(d.myanmar_inv)}</td>
        <td class="num" style="font-size:12px;color:var(--color-text-sub)">${estimate}</td>
        <td>▼</td>
        <td style="text-align:center">${d.website_on === '1' ? '🟢' : d.website_on === '0' ? '🔴' : '-'}</td>
      </tr>
      <tr class="detail-row" id="detail-${d.item_code}">
        <td colspan="17">
          <div class="detail-grid">
            <div class="detail-item"><div class="detail-label">英文品名</div><div class="detail-value">${d.english_name || '-'}</div></div>
            <div class="detail-item"><div class="detail-label">總庫存 Q</div><div class="detail-value">${fmt(d.total_produced)}</div></div>
            <div class="detail-item"><div class="detail-label">惠陽廠 R</div><div class="detail-value">${fmt(d.huiyang_inv)}</div></div>
            <div class="detail-item"><div class="detail-label">印尼廠 S</div><div class="detail-value">${fmt(d.indonesia_inv)}</div></div>
            <div class="detail-item"><div class="detail-label">緬甸廠 T</div><div class="detail-value">${fmt(d.myanmar_inv)}</div></div>
            <div class="detail-item"><div class="detail-label">生產單位</div><div class="detail-value">${d.production_unit || '-'}</div></div>
            <div class="detail-item"><div class="detail-label">工廠庫存 U</div><div class="detail-value">${fmt(d.factory_inventory)}</div></div>
            <div class="detail-item"><div class="detail-label">出貨倉 V</div><div class="detail-value">${fmt(d.shipping_warehouse)}</div></div>
            <div class="detail-item"><div class="detail-label">工廠未出貨</div><div class="detail-value">${fmt(d.factory_unshipped)}</div></div>
            <div class="detail-item"><div class="detail-label">網站狀態</div><div class="detail-value">${d.website_on === '1' ? '上架中' : d.website_on === '0' ? '已下架' : '-'}</div></div>
            <div class="detail-item"><div class="detail-label">網站備註</div><div class="detail-value">${d.web_note || '-'}</div></div>
            <div class="detail-item"><div class="detail-label">上週結餘 O</div><div class="detail-value">${fmtSigned(d.o)}</div></div>
            <div class="detail-item"><div class="detail-label">上週庫存 L</div><div class="detail-value">${fmt(d.l)}</div></div>
            <div class="detail-item"><div class="detail-label">上週接單 M</div><div class="detail-value">${fmt(d.m)}</div></div>
            <div class="detail-item"><div class="detail-label">上週海上 N</div><div class="detail-value">${fmt(d.n)}</div></div>
            <div class="detail-item"><div class="detail-label">每週銷售 (W基準)</div><div class="detail-value">${fmt(d.weekly_rate_w)} pc/週</div></div>
            <div class="detail-item"><div class="detail-label">預估可用 (W)</div><div class="detail-value">${d.weeks_left_w !== null ? d.weeks_left_w + ' 週' : '無法估算'}</div></div>
            <div class="detail-item"><div class="detail-label">預估可用 (P)</div><div class="detail-value">${d.weeks_left_p !== null ? d.weeks_left_p + ' 週' : '無法估算'}</div></div>
            <div class="detail-item"><div class="detail-label">備註</div><div class="detail-value">${d.notes || '-'}</div></div>
            <div class="detail-item"><div class="detail-label">高總指示</div><div class="detail-value">${d.directive || '-'}</div></div>
            <div class="detail-item"><div class="detail-label">PL模种</div><div class="detail-value">${d.pl_mold || '-'}</div></div>
            <div class="detail-item"><div class="detail-label">週變化 P (J-O)</div><div class="detail-value ${valClass(d.p)}">${fmtSigned(d.p)}</div></div>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (!pageData.length) {
    tbody.innerHTML = '<tr><td colspan="17" style="text-align:center;padding:32px;color:var(--color-text-sub)">沒有符合條件的產品</td></tr>';
  }

  renderPagination(data.length);

  document.querySelectorAll('.sortable').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    if (th.dataset.sort === state.sortField) {
      th.classList.add(state.sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
    }
  });
}

function renderPagination(total) {
  const pages = Math.ceil(total / state.perPage);
  const el = document.getElementById('pagination');
  if (pages <= 1) { el.innerHTML = `<span class="page-info">${total} 項產品</span>`; return; }

  let html = `<button ${state.currentPage === 1 ? 'disabled' : ''} onclick="goPage(${state.currentPage - 1})">上一頁</button>`;
  const maxBtns = 7;
  let startP = Math.max(1, state.currentPage - 3);
  let endP = Math.min(pages, startP + maxBtns - 1);
  startP = Math.max(1, endP - maxBtns + 1);

  if (startP > 1) { html += `<button onclick="goPage(1)">1</button>`; if (startP > 2) html += '<span class="page-info">...</span>'; }
  for (let i = startP; i <= endP; i++) {
    html += `<button class="${i === state.currentPage ? 'active' : ''}" onclick="goPage(${i})">${i}</button>`;
  }
  if (endP < pages) { if (endP < pages - 1) html += '<span class="page-info">...</span>'; html += `<button onclick="goPage(${pages})">${pages}</button>`; }

  html += `<button ${state.currentPage === pages ? 'disabled' : ''} onclick="goPage(${state.currentPage + 1})">下一頁</button>`;
  html += `<span class="page-info">${total} 項 | 第 ${state.currentPage}/${pages} 頁</span>`;
  el.innerHTML = html;
}

function renderCharts() {
  if (!state.stats) return;
  renderBarChart('top-chart', state.stats.top_sellers, '#1a73e8');
  renderBarChart('bottom-chart', state.stats.slow_sellers, '#ea4335');
}

function renderBarChart(canvasId, data, color) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  if (state.charts[canvasId]) state.charts[canvasId].destroy();

  const labels = data.map(d => d.item_code);
  const values = data.map(d => d.sales_2025);

  state.charts[canvasId] = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: '2025年銷售量',
        data: values,
        backgroundColor: color,
        borderRadius: 4,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const item = data[ctx.dataIndex];
              return [`${item.name || ''}`, `銷售: ${fmt(item.sales_2025)}`, `總出: ${fmt(item.total_shipped)}`];
            }
          }
        }
      },
      scales: {
        x: { beginAtZero: true, ticks: { font: { size: 11 } } },
        y: { ticks: { font: { size: 10 } } },
      },
    },
  });
}

// ===== Detail / Navigation =====
function toggleDetail(code) {
  const row = document.getElementById(`detail-${code}`);
  if (row) row.classList.toggle('open');
}

function showDetail(code) {
  const p = state.mergedData.find(d => d.item_code === code);
  if (!p) return;
  document.getElementById('detail-title').textContent = `${p.item_code} - ${p.name || ''}`;
  const body = document.getElementById('detail-body');
  body.innerHTML = `
    <div class="detail-grid" style="grid-template-columns:repeat(3,1fr)">
      <div class="detail-item"><div class="detail-label">英文品名</div><div class="detail-value">${p.english_name || '-'}</div></div>
      <div class="detail-item"><div class="detail-label">總庫存 Q</div><div class="detail-value">${fmt(p.total_produced)}</div></div>
      <div class="detail-item"><div class="detail-label">惠陽廠 R</div><div class="detail-value">${fmt(p.huiyang_inv)}</div></div>
      <div class="detail-item"><div class="detail-label">印尼廠 S</div><div class="detail-value">${fmt(p.indonesia_inv)}</div></div>
      <div class="detail-item"><div class="detail-label">緬甸廠 T</div><div class="detail-value">${fmt(p.myanmar_inv)}</div></div>
      <div class="detail-item"><div class="detail-label">狀態</div><div class="detail-value">${p.status}</div></div>
      <div class="detail-item"><div class="detail-label">生產單位</div><div class="detail-value">${p.production_unit || '-'}</div></div>
      <div class="detail-item"><div class="detail-label">停售標記</div><div class="detail-value">${p.discontinued || '-'}</div></div>
      <div class="detail-item"><div class="detail-label">庫存 G</div><div class="detail-value">${fmt(p.g)}</div></div>
      <div class="detail-item"><div class="detail-label">接單 H</div><div class="detail-value">${fmt(p.h)}</div></div>
      <div class="detail-item"><div class="detail-label">海上 I</div><div class="detail-value">${fmt(p.i)}</div></div>
      <div class="detail-item"><div class="detail-label">結餘 J (G-H+I)</div><div class="detail-value ${valClass(p.j)}">${fmtSigned(p.j)}</div></div>
      <div class="detail-item"><div class="detail-label">上週庫存 L</div><div class="detail-value">${fmt(p.l)}</div></div>
      <div class="detail-item"><div class="detail-label">上週接單 M</div><div class="detail-value">${fmt(p.m)}</div></div>
      <div class="detail-item"><div class="detail-label">上週海上 N</div><div class="detail-value">${fmt(p.n)}</div></div>
      <div class="detail-item"><div class="detail-label">上週結餘 O</div><div class="detail-value">${fmtSigned(p.o)}</div></div>
      <div class="detail-item"><div class="detail-label">週變化 P (J-O)</div><div class="detail-value ${valClass(p.p)}">${fmtSigned(p.p)}</div></div>
      <div class="detail-item"><div class="detail-label">2025年銷售 W</div><div class="detail-value">${fmt(p.sales_2025)}</div></div>
      <div class="detail-item"><div class="detail-label">總出貨量 X</div><div class="detail-value">${fmt(p.total_shipped)}</div></div>
      <div class="detail-item"><div class="detail-label">每週銷售率</div><div class="detail-value">${fmt(p.weekly_rate_w)} pc/週</div></div>
      <div class="detail-item"><div class="detail-label">預估可用 (W基準)</div><div class="detail-value">${p.weeks_left_w !== null ? p.weeks_left_w + ' 週' : '無法估算'}</div></div>
      <div class="detail-item"><div class="detail-label">預估可用 (P基準)</div><div class="detail-value">${p.weeks_left_p !== null ? p.weeks_left_p + ' 週' : '無法估算'}</div></div>
      <div class="detail-item"><div class="detail-label">工廠庫存 U</div><div class="detail-value">${fmt(p.factory_inventory)}</div></div>
      <div class="detail-item"><div class="detail-label">出貨倉 V</div><div class="detail-value">${fmt(p.shipping_warehouse)}</div></div>
      <div class="detail-item"><div class="detail-label">工廠未出貨</div><div class="detail-value">${fmt(p.factory_unshipped)}</div></div>
      <div class="detail-item"><div class="detail-label">網站狀態</div><div class="detail-value">${p.website_on === '1' ? '上架中' : p.website_on === '0' ? '已下架' : '-'}</div></div>
      <div class="detail-item"><div class="detail-label">網站備註</div><div class="detail-value">${p.web_note || '-'}</div></div>
      <div class="detail-item"><div class="detail-label">PL模种</div><div class="detail-value">${p.pl_mold || '-'}</div></div>
      <div class="detail-item"><div class="detail-label">備註</div><div class="detail-value">${p.notes || '-'}</div></div>
      <div class="detail-item"><div class="detail-label">高總指示</div><div class="detail-value">${p.directive || '-'}</div></div>
    </div>
  `;
  document.getElementById('detail-modal').style.display = 'flex';
}

function goPage(page) {
  state.currentPage = page;
  renderTable();
}

// ===== Container Management =====
function deleteContainer(cid) {
  if (!confirm('確認此貨櫃已到貨並移除？')) return;
  state.containers = state.containers.filter(c => c.id !== cid);
  saveContainers();
  refreshData();
  renderContainers();
  renderKPIs();
}

// ===== Init =====
function showMainApp() {
  document.getElementById('setup-screen').style.display = 'none';
  document.getElementById('main-app').style.display = 'block';
  refreshData();
  renderAll();
}

function showSetupScreen() {
  document.getElementById('setup-screen').style.display = 'flex';
  document.getElementById('main-app').style.display = 'none';
}

function init() {
  loadData();
  if (hasData()) {
    showMainApp();
  } else {
    showSetupScreen();
  }
  setupEventListeners();
}

// ===== Event Listeners =====
function setupEventListeners() {
  // Filter tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      if (tab.dataset.prod !== undefined) {
        document.querySelectorAll('.tab[data-prod]').forEach(t => {
          if (t.dataset.prod !== '') t.classList.remove('active');
        });
        if (tab.dataset.prod !== '') tab.classList.add('active');
        state.prodFilter = tab.dataset.prod || '';
      } else {
        document.querySelectorAll('.tab[data-status]').forEach(t => {
          if (t.dataset.prod === undefined || t.dataset.prod === '') t.classList.remove('active');
        });
        tab.classList.add('active');
        state.statusFilter = tab.dataset.status || '';
      }
      state.currentPage = 1;
      renderTable();
    });
  });

  // Search
  document.getElementById('search-input').addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    state.currentPage = 1;
    renderTable();
  });

  // Sortable headers
  document.querySelectorAll('.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const field = th.dataset.sort;
      if (state.sortField === field) {
        state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortField = field;
        state.sortDir = 'asc';
      }
      renderTable();
    });
  });

  // ===== Setup screen (first-time) =====
  const setupDropZone = document.getElementById('setup-drop-zone');
  const setupFileInput = document.getElementById('setup-file-input');

  if (setupDropZone) {
    setupDropZone.addEventListener('click', () => setupFileInput.click());
    setupDropZone.addEventListener('dragover', (e) => { e.preventDefault(); setupDropZone.classList.add('dragover'); });
    setupDropZone.addEventListener('dragleave', () => setupDropZone.classList.remove('dragover'));
    setupDropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      setupDropZone.classList.remove('dragover');
      if (e.dataTransfer.files.length) handleSetupFile(e.dataTransfer.files[0]);
    });
    setupFileInput.addEventListener('change', (e) => {
      if (e.target.files.length) handleSetupFile(e.target.files[0]);
    });
  }

  // ===== Import modal =====
  document.getElementById('import-btn').addEventListener('click', () => {
    document.getElementById('import-modal').style.display = 'flex';
    document.getElementById('import-result').innerHTML = '';
    document.getElementById('import-confirm').disabled = true;
    state.selectedFile = null;
  });

  document.getElementById('import-close').addEventListener('click', closeImportModal);
  document.getElementById('import-cancel').addEventListener('click', closeImportModal);

  document.getElementById('drop-zone').addEventListener('click', () => {
    document.getElementById('file-input').click();
  });

  document.getElementById('file-input').addEventListener('change', (e) => {
    if (e.target.files.length) handleFileSelect(e.target.files[0]);
  });

  document.getElementById('drop-zone').addEventListener('dragover', (e) => {
    e.preventDefault();
    document.getElementById('drop-zone').classList.add('dragover');
  });

  document.getElementById('drop-zone').addEventListener('dragleave', () => {
    document.getElementById('drop-zone').classList.remove('dragover');
  });

  document.getElementById('drop-zone').addEventListener('drop', (e) => {
    e.preventDefault();
    document.getElementById('drop-zone').classList.remove('dragover');
    if (e.dataTransfer.files.length) handleFileSelect(e.dataTransfer.files[0]);
  });

  document.getElementById('import-confirm').addEventListener('click', handleImportConfirm);

  // ===== Detail modal =====
  document.getElementById('detail-close').addEventListener('click', () => {
    document.getElementById('detail-modal').style.display = 'none';
  });

  // ===== Export =====
  document.getElementById('export-btn').addEventListener('click', exportCSV);

  // ===== Data management modal =====
  document.getElementById('data-btn').addEventListener('click', () => {
    updateDataStatus();
    document.getElementById('data-modal').style.display = 'flex';
  });
  document.getElementById('data-close').addEventListener('click', () => {
    document.getElementById('data-modal').style.display = 'none';
  });

  document.getElementById('backup-export-btn').addEventListener('click', exportBackup);

  document.getElementById('backup-import-btn').addEventListener('click', () => {
    document.getElementById('backup-input').click();
  });
  document.getElementById('backup-input').addEventListener('change', async (e) => {
    if (!e.target.files.length) return;
    try {
      const text = await e.target.files[0].text();
      importBackup(text);
      document.getElementById('backup-result').innerHTML =
        '<div class="import-result success">✓ 備份還原成功！</div>';
      setTimeout(() => {
        document.getElementById('data-modal').style.display = 'none';
        init();
      }, 1500);
    } catch (err) {
      document.getElementById('backup-result').innerHTML =
        `<div class="import-result error">❌ 還原失敗: ${err.message}</div>`;
    }
  });

  document.getElementById('reinit-btn').addEventListener('click', () => {
    document.getElementById('reinit-input').click();
  });
  document.getElementById('reinit-input').addEventListener('change', async (e) => {
    if (!e.target.files.length) return;
    const file = e.target.files[0];
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const { products, inventory: newInv } = parseMainExcel(workbook);

      const existingInvMap = {};
      for (const inv of state.inventory) {
        existingInvMap[inv.item_code] = inv;
      }

      const mergedInv = newInv.map(ni => {
        const existing = existingInvMap[ni.item_code];
        if (existing) {
          return {
            ...ni,
            g_inventory: existing.g_inventory,
            h_orders: existing.h_orders,
            i_intransit: existing.i_intransit,
            l_prev_inventory: existing.l_prev_inventory,
            m_prev_orders: existing.m_prev_orders,
            n_prev_intransit: existing.n_prev_intransit,
          };
        }
        return ni;
      });

      state.products = products;
      state.inventory = mergedInv;
      saveProducts();
      saveInventory();

      document.getElementById('reinit-result').innerHTML =
        `<div class="import-result success">✓ 產品資料已更新！${products.length} 項產品</div>`;
      setTimeout(() => {
        document.getElementById('data-modal').style.display = 'none';
        refreshData();
        renderAll();
      }, 1500);
    } catch (err) {
      document.getElementById('reinit-result').innerHTML =
        `<div class="import-result error">❌ 失敗: ${err.message}</div>`;
    }
  });

  document.getElementById('clear-data-btn').addEventListener('click', () => {
    if (!confirm('確認清除所有資料？此操作無法復原！')) return;
    if (!confirm('再次確認：所有產品、庫存、貨櫃資料都將被清除！')) return;
    Object.values(LS_KEYS).forEach(k => localStorage.removeItem(k));
    location.reload();
  });

  // ===== Order Analysis =====
  document.getElementById('order-btn').addEventListener('click', () => {
    if (!hasData()) { alert('請先上傳 USI 總檔初始化資料'); return; }
    if (state.orderAnalysis.length > 0) {
      showOrderView();
      renderOrderAnalysis();
    } else {
      document.getElementById('order-import-modal').style.display = 'flex';
      document.getElementById('order-import-result').innerHTML = '';
      document.getElementById('order-mapping-section').style.display = 'none';
      document.getElementById('order-import-confirm').disabled = true;
      state.selectedOrderFile = null;
    }
  });

  document.getElementById('order-back').addEventListener('click', showDashboardView);
  document.getElementById('order-reimport').addEventListener('click', () => {
    document.getElementById('order-import-modal').style.display = 'flex';
    document.getElementById('order-import-result').innerHTML = '';
    document.getElementById('order-mapping-section').style.display = 'none';
    document.getElementById('order-import-confirm').disabled = true;
    state.selectedOrderFile = null;
  });

  document.getElementById('order-import-close').addEventListener('click', closeOrderImportModal);
  document.getElementById('order-import-cancel').addEventListener('click', closeOrderImportModal);

  const orderDropZone = document.getElementById('order-drop-zone');
  const orderFileInput = document.getElementById('order-file-input');

  orderDropZone.addEventListener('click', () => orderFileInput.click());
  orderDropZone.addEventListener('dragover', (e) => { e.preventDefault(); orderDropZone.classList.add('dragover'); });
  orderDropZone.addEventListener('dragleave', () => orderDropZone.classList.remove('dragover'));
  orderDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    orderDropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleOrderFileSelect(e.dataTransfer.files[0]);
  });
  orderFileInput.addEventListener('change', (e) => {
    if (e.target.files.length) handleOrderFileSelect(e.target.files[0]);
  });

  document.getElementById('order-import-confirm').addEventListener('click', handleOrderImportConfirm);
}

function updateDataStatus() {
  const snapshotDates = Object.keys(state.snapshots).sort();
  document.getElementById('data-status').innerHTML = `
    <div>產品數: <strong>${state.products.length}</strong></div>
    <div>庫存記錄: <strong>${state.inventory.length}</strong></div>
    <div>貨櫃數: <strong>${state.containers.length}</strong></div>
    <div>快照數: <strong>${snapshotDates.length}</strong></div>
    ${state.lastImport ? `<div>上次匯入: <strong>${state.lastImport.date}</strong> (${state.lastImport.filename})</div>` : ''}
  `;
}

// ===== Setup file handler =====
async function handleSetupFile(file) {
  const resultEl = document.getElementById('setup-result');
  resultEl.innerHTML = '<div class="info-box">正在解析 Excel 檔案...</div>';

  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    const { products, inventory } = parseMainExcel(workbook);

    if (!products.length) {
      resultEl.innerHTML = '<div class="import-result error">❌ 未找到任何產品資料，請確認檔案包含「USI庫存情況」工作表</div>';
      return;
    }

    doMainImport(products, inventory);

    resultEl.innerHTML = `
      <div class="import-result success">
        <div class="stat"><span>產品數量</span><strong>${products.length}</strong></div>
        <div class="stat"><span>庫存記錄</span><strong>${inventory.length}</strong></div>
      </div>
      <p style="margin-top:12px;color:var(--color-green)">✓ 初始化完成！正在載入儀表板...</p>
    `;
    setTimeout(() => {
      showMainApp();
    }, 1500);
  } catch (err) {
    resultEl.innerHTML = `<div class="import-result error">❌ ${err.message}</div>`;
  }
}

// ===== Import helpers =====
function closeImportModal() {
  document.getElementById('import-modal').style.display = 'none';
  state.selectedFile = null;
}

function handleFileSelect(file) {
  state.selectedFile = file;
  document.getElementById('import-result').innerHTML =
    `<div class="info-box">已選擇: <strong>${file.name}</strong> (${(file.size / 1024).toFixed(1)} KB)</div>`;
  document.getElementById('import-confirm').disabled = false;
}

async function handleImportConfirm() {
  if (!state.selectedFile) return;
  const btn = document.getElementById('import-confirm');
  btn.disabled = true;
  btn.textContent = '匯入中...';
  document.getElementById('import-result').innerHTML =
    '<div class="info-box">正在處理，請稍候...</div>';

  try {
    const file = state.selectedFile;
    const ext = file.name.split('.').pop().toLowerCase();
    let importData;

    if (ext === 'csv') {
      const text = await file.text();
      importData = parseCSVFile(text);
    } else {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      importData = parseWeeklyExcel(workbook);
    }

    const count = Object.keys(importData).length;
    if (!count) {
      document.getElementById('import-result').innerHTML =
        '<div class="import-result error">❌ 未找到有效資料</div>';
      btn.disabled = false;
      btn.textContent = '確認匯入';
      return;
    }

    // Validation: detect non-USI files (e.g. customer orders uploaded by mistake)
    const existingCodes = new Set(state.products.map(p => p.item_code));
    const sampleItems = Object.keys(importData).slice(0, 50);
    let matchedCount = 0;
    let suspiciouslyLarge = 0;
    for (const code of sampleItems) {
      if (existingCodes.has(code)) matchedCount++;
      const vals = importData[code];
      if (vals.g > 100000 || vals.h > 100000 || vals.i > 100000) suspiciouslyLarge++;
    }
    const matchRate = sampleItems.length > 0 ? matchedCount / sampleItems.length : 0;

    if (matchRate < 0.1) {
      document.getElementById('import-result').innerHTML =
        `<div class="import-result error">
          ❌ 此檔案可能不是 USI 週報！<br>
          偵測到 ${sampleItems.length} 個項目中只有 ${matchedCount} 個符合現有產品編號。<br>
          如果這是客戶訂單，請使用「📋 訂單分析」功能匯入。
        </div>`;
      btn.disabled = false;
      btn.textContent = '確認匯入';
      return;
    }

    if (suspiciouslyLarge > sampleItems.length * 0.3) {
      document.getElementById('import-result').innerHTML =
        `<div class="import-result error">
          ⚠️ 數值異常大（超過 10 萬），請確認檔案格式是否正確。<br>
          如果這是客戶訂單，請使用「📋 訂單分析」功能匯入。
        </div>`;
      btn.disabled = false;
      btn.textContent = '確認匯入';
      return;
    }

    const result = doWeeklyImport(importData, file.name);

    document.getElementById('import-result').innerHTML =
      `<div class="import-result success">
        <div class="stat"><span>匯入日期</span><strong>${state.lastImport.date}</strong></div>
        <div class="stat"><span>檔案名稱</span><strong>${file.name}</strong></div>
        <div class="stat"><span>總項目數</span><strong>${fmt(result.totalItems)}</strong></div>
        <div class="stat"><span>更新項目</span><strong>${fmt(result.updatedItems)}</strong></div>
        <div class="stat"><span>新增項目</span><strong>${fmt(result.newItems)}</strong></div>
      </div>
      <p style="margin-top:12px;color:var(--color-green)">✓ 匯入成功！頁面將自動刷新...</p>`;
    btn.textContent = '完成';
    setTimeout(() => {
      closeImportModal();
      btn.disabled = false;
      btn.textContent = '確認匯入';
      refreshData();
      renderAll();
    }, 2000);
  } catch (e) {
    document.getElementById('import-result').innerHTML =
      `<div class="import-result error">❌ 匯入失敗: ${e.message}</div>`;
    btn.disabled = false;
    btn.textContent = '確認匯入';
  }
}

// ===== Order Analysis =====
function detectColumns(headers, sampleRows) {
  let skuCol = -1, qtyCol = -1;

  // Phase 1: Match by header name
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].trim().toLowerCase();
    if (skuCol === -1 && SKU_COLS.includes(h)) skuCol = i;
    if (qtyCol === -1 && QTY_COLS.includes(h)) qtyCol = i;
  }

  // Phase 2: If SKU column not found by name, use smart detection on sample data
  if (skuCol === -1 && sampleRows.length > 0) {
    let bestCol = 0;
    let bestScore = -1;
    for (let c = 0; c < headers.length; c++) {
      let score = 0;
      for (const row of sampleRows) {
        const val = safeStr(row[c]);
        if (!val) continue;
        // SKU-like: short alphanumeric code (e.g., WU78157AA, 5-20 chars, mostly alphanumeric)
        if (val.length <= 25 && /^[A-Za-z0-9\-_]+$/.test(val) && /[A-Za-z]/.test(val) && /[0-9]/.test(val)) {
          score += 2;
        }
        // Product-name-like: long text with spaces
        else if (val.length > 25 || (val.includes(' ') && val.split(' ').length > 3)) {
          score -= 1;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestCol = c;
      }
    }
    skuCol = bestCol;
  }

  // Phase 3: If Qty column not found by name, find the column with most numeric values
  if (qtyCol === -1 && sampleRows.length > 0) {
    let bestCol = -1;
    let bestCount = 0;
    for (let c = 0; c < headers.length; c++) {
      if (c === skuCol) continue;
      let count = 0;
      for (const row of sampleRows) {
        const val = safeNum(row[c]);
        if (val > 0) count++;
      }
      if (count > bestCount) {
        bestCount = count;
        bestCol = c;
      }
    }
    qtyCol = bestCol >= 0 ? bestCol : (skuCol === 0 ? 1 : 0);
  }

  if (skuCol === -1) skuCol = 0;
  if (qtyCol === -1) qtyCol = skuCol === 0 ? 1 : 0;

  const hasHeader = headers.some(h => {
    const hl = h.trim().toLowerCase();
    return SKU_COLS.includes(hl) || QTY_COLS.includes(hl);
  }) || headers.some(h => h.trim().length > 0);

  return { skuCol, qtyCol, hasHeader };
}

function parseOrderExcelRaw(workbook) {
  const ws = workbook.Sheets[workbook.SheetNames[0]];
  const range = XLSX.utils.decode_range(ws['!ref']);

  const headers = [];
  for (let c = 0; c <= range.e.c; c++) {
    headers.push(safeStr(getCellValue(ws, 0, c)));
  }

  const allRows = [];
  for (let r = 0; r <= range.e.r; r++) {
    const row = [];
    for (let c = 0; c <= range.e.c; c++) {
      row.push(getCellValue(ws, r, c));
    }
    allRows.push(row);
  }

  return { headers, rows: allRows };
}

function parseOrderCSVRaw(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return { headers: [], rows: [] };

  const allRows = lines.map(l => parseCSVLine(l));
  const headers = allRows[0].map(c => safeStr(c));
  return { headers, rows: allRows };
}

function extractOrderItems(headers, rows, skuCol, qtyCol, hasHeader) {
  const items = [];
  const startRow = hasHeader ? 1 : 0;
  for (let r = startRow; r < rows.length; r++) {
    const sku = safeStr(rows[r][skuCol]);
    const qty = safeNum(rows[r][qtyCol]);
    if (!sku || sku.length < 2 || qty <= 0) continue;
    items.push({ sku, quantity: qty });
  }
  return items;
}

// Legacy compatibility (used by old code paths)
function parseOrderExcel(workbook) {
  const { headers, rows } = parseOrderExcelRaw(workbook);
  const sampleRows = rows.slice(1, 6);
  const { skuCol, qtyCol, hasHeader } = detectColumns(headers, sampleRows);
  return extractOrderItems(headers, rows, skuCol, qtyCol, hasHeader);
}

function parseOrderCSV(text) {
  const { headers, rows } = parseOrderCSVRaw(text);
  const sampleRows = rows.slice(1, 6);
  const { skuCol, qtyCol, hasHeader } = detectColumns(headers, sampleRows);
  return extractOrderItems(headers, rows, skuCol, qtyCol, hasHeader);
}

function aggregateOrders(items) {
  const map = {};
  const order = [];
  for (const item of items) {
    if (map[item.sku]) {
      map[item.sku].quantity += item.quantity;
    } else {
      map[item.sku] = { sku: item.sku, quantity: item.quantity };
      order.push(map[item.sku]);
    }
  }
  return order;
}

function analyzeOrders(orderItems) {
  const invMap = {};
  for (const inv of state.inventory) {
    invMap[inv.item_code] = inv;
  }
  const prodMap = {};
  for (const p of state.products) {
    prodMap[p.item_code] = p;
  }

  return orderItems.map(item => {
    const inv = invMap[item.sku];
    const prod = prodMap[item.sku];

    if (!prod) {
      return {
        ...item,
        status: 'not_found',
        name: '',
        english_name: '',
        g: 0, h: 0, i: 0, j: 0,
        newJ: 0,
        total_produced: 0,
        huiyang_inv: 0, indonesia_inv: 0, myanmar_inv: 0,
        shortage: 0,
      };
    }

    const g = safeNum(inv?.g_inventory);
    const h = safeNum(inv?.h_orders);
    const i = safeNum(inv?.i_intransit);
    const j = Math.round((g - h + i) * 10) / 10;
    const newJ = Math.round((j - item.quantity) * 10) / 10;
    const totalProduced = safeNum(prod.total_produced);
    const huiyang = safeNum(prod.huiyang_inv);
    const indonesia = safeNum(prod.indonesia_inv);
    const myanmar = safeNum(prod.myanmar_inv);

    let status, shortage = 0;
    if (newJ >= 0) {
      status = 'safe';
    } else if (totalProduced >= Math.abs(newJ)) {
      status = 'ship';
      shortage = Math.abs(newJ);
    } else {
      status = 'produce';
      shortage = Math.round((Math.abs(newJ) - totalProduced) * 10) / 10;
    }

    return {
      ...item,
      status,
      name: prod.name || '',
      english_name: prod.english_name || '',
      g, h, i, j, newJ,
      total_produced: totalProduced,
      huiyang_inv: huiyang,
      indonesia_inv: indonesia,
      myanmar_inv: myanmar,
      shortage,
    };
  });
}

function renderOrderAnalysis() {
  const analysis = state.orderAnalysis;
  const safe = analysis.filter(a => a.status === 'safe');
  const ship = analysis.filter(a => a.status === 'ship');
  const produce = analysis.filter(a => a.status === 'produce');
  const notFound = analysis.filter(a => a.status === 'not_found');

  document.getElementById('order-file-info').textContent =
    `${state.orderFileName} | ${analysis.length} 項 | ${new Date().toISOString().slice(0, 10)}`;

  document.getElementById('order-summary').innerHTML = `
    <div class="order-summary-bar">
      <div class="order-summary-item"><span class="order-dot dot-green"></span> 安全: <strong>${safe.length}</strong></div>
      <div class="order-summary-item"><span class="order-dot dot-blue"></span> 需出貨: <strong>${ship.length}</strong></div>
      <div class="order-summary-item"><span class="order-dot dot-red"></span> 需生產: <strong>${produce.length}</strong></div>
      ${notFound.length > 0 ? `<div class="order-summary-item"><span class="order-dot dot-gray"></span> 找不到: <strong>${notFound.length}</strong></div>` : ''}
    </div>
  `;

  renderOrderCard('produce-list', produce, 'produce');
  renderOrderCard('ship-list', ship, 'ship');
  document.getElementById('produce-list-count').textContent = produce.length;
  document.getElementById('ship-list-count').textContent = ship.length;

  const nfEl = document.getElementById('order-not-found');
  if (notFound.length > 0) {
    nfEl.style.display = 'block';
    document.getElementById('not-found-count').textContent = notFound.length;
    document.getElementById('not-found-list').innerHTML = notFound.map(a =>
      `<span class="not-found-tag">${a.sku} (${fmt(a.quantity)})</span>`
    ).join('');
  } else {
    nfEl.style.display = 'none';
  }

  renderOrderTable(analysis);
}

function renderOrderCard(elId, items, type) {
  const el = document.getElementById(elId);
  if (!items.length) {
    el.innerHTML = '<p class="order-card-empty">無項目</p>';
    return;
  }
  el.innerHTML = items.map(a => {
    const arrow = a.j >= 0 ? `${fmt(a.j)}` : `${fmtSigned(a.j)}`;
    const newJClass = a.newJ < 0 ? 'neg' : '';
    const shortageLabel = type === 'produce' ? '需生產' : '可出貨';
    return `
      <div class="order-item" onclick="showDetail('${a.sku}')" style="cursor:pointer">
        <div class="order-item-sku">${a.sku}</div>
        <div class="order-item-name">${a.name || a.english_name || ''}</div>
        <div class="order-item-nums">
          <span>訂單: <strong>${fmt(a.quantity)}</strong></span>
          <span>結餘: ${arrow} → <strong class="${newJClass}">${fmtSigned(a.newJ)}</strong></span>
        </div>
        <div class="order-item-nums">
          <span>廠庫: ${fmt(a.total_produced)}</span>
          <span class="${type === 'produce' ? 'neg' : 'pos'}">${shortageLabel}: ${fmt(a.shortage)}</span>
        </div>
        ${a.huiyang_inv || a.indonesia_inv || a.myanmar_inv ? `
        <div class="order-item-factory">
          ${a.huiyang_inv ? `惠陽:${fmt(a.huiyang_inv)}` : ''} ${a.indonesia_inv ? `印尼:${fmt(a.indonesia_inv)}` : ''} ${a.myanmar_inv ? `緬甸:${fmt(a.myanmar_inv)}` : ''}
        </div>` : ''}
      </div>
    `;
  }).join('');
}

function renderOrderTable(analysis) {
  const tbody = document.getElementById('order-tbody');
  tbody.innerHTML = analysis.map(a => {
    let badge = '';
    if (a.status === 'safe') badge = '<span class="status-badge status-green">✓</span>';
    else if (a.status === 'ship') badge = '<span class="status-badge status-yellow">出</span>';
    else if (a.status === 'produce') badge = '<span class="status-badge status-red">產</span>';
    else badge = '<span class="status-badge" style="background:#eee;color:#999">?</span>';

    return `
      <tr onclick="showDetail('${a.sku}')" style="cursor:pointer">
        <td>${badge}</td>
        <td><strong>${a.sku}</strong></td>
        <td>${a.name || '-'}</td>
        <td class="num">${fmt(a.quantity)}</td>
        <td class="num ${valClass(a.j)}">${fmtSigned(a.j)}</td>
        <td class="num ${valClass(a.newJ)}"><strong>${fmtSigned(a.newJ)}</strong></td>
        <td class="num">${fmt(a.total_produced)}</td>
        <td class="num">${fmt(a.huiyang_inv)}</td>
        <td class="num">${fmt(a.indonesia_inv)}</td>
        <td class="num">${fmt(a.myanmar_inv)}</td>
        <td class="num ${a.shortage > 0 ? 'neg' : ''}">${a.shortage > 0 ? fmt(a.shortage) : '-'}</td>
      </tr>
    `;
  }).join('');

  if (!analysis.length) {
    tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;padding:32px;color:var(--color-text-sub)">無訂單資料</td></tr>';
  }
}

function showOrderView() {
  document.querySelectorAll('.kpi-grid, .container-section, .changes-section, .product-section, .sales-section')
    .forEach(el => el.style.display = 'none');
  document.getElementById('order-view').style.display = 'block';
}

function showDashboardView() {
  document.getElementById('order-view').style.display = 'none';
  document.querySelectorAll('.kpi-grid, .container-section, .changes-section, .product-section, .sales-section')
    .forEach(el => el.style.display = '');
}

async function handleOrderFileSelect(file) {
  state.selectedOrderFile = file;
  document.getElementById('order-import-result').innerHTML =
    `<div class="info-box">已選擇: <strong>${file.name}</strong> (${(file.size / 1024).toFixed(1)} KB)</div>`;
  document.getElementById('order-mapping-section').style.display = 'none';
  document.getElementById('order-import-confirm').disabled = true;

  try {
    const ext = file.name.split('.').pop().toLowerCase();
    let raw;

    if (ext === 'csv') {
      const text = await file.text();
      raw = parseOrderCSVRaw(text);
    } else {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      raw = parseOrderExcelRaw(workbook);
    }

    if (!raw.rows.length) {
      document.getElementById('order-import-result').innerHTML =
        '<div class="import-result error">❌ 檔案中沒有資料</div>';
      return;
    }

    state.orderHeaders = raw.headers;
    state.orderRawRows = raw.rows;

    const sampleRows = raw.rows.slice(1, 6);
    const { skuCol, qtyCol, hasHeader } = detectColumns(raw.headers, sampleRows);
    state.orderDetectedSkuCol = skuCol;
    state.orderDetectedQtyCol = qtyCol;

    renderOrderMappingPreview(raw.headers, raw.rows, skuCol, qtyCol, hasHeader);
    document.getElementById('order-mapping-section').style.display = 'block';
    document.getElementById('order-import-confirm').disabled = false;
  } catch (e) {
    document.getElementById('order-import-result').innerHTML =
      `<div class="import-result error">❌ 解析失敗: ${e.message}</div>`;
  }
}

function renderOrderMappingPreview(headers, rows, skuCol, qtyCol, hasHeader) {
  const skuSelect = document.getElementById('mapping-sku-select');
  const qtySelect = document.getElementById('mapping-qty-select');

  const options = headers.map((h, i) => {
    const sampleVal = rows[1] ? safeStr(rows[1][i]) : '';
    const label = h ? `${h}` : `欄位 ${i + 1}`;
    return `<option value="${i}">${label} (例: ${sampleVal.slice(0, 30)})</option>`;
  }).join('');

  skuSelect.innerHTML = options;
  qtySelect.innerHTML = options;
  skuSelect.value = skuCol;
  qtySelect.value = qtyCol;

  skuSelect.onchange = () => updatePreviewTable();
  qtySelect.onchange = () => updatePreviewTable();

  updatePreviewTable();
}

function updatePreviewTable() {
  const skuCol = parseInt(document.getElementById('mapping-sku-select').value);
  const qtyCol = parseInt(document.getElementById('mapping-qty-select').value);
  const headers = state.orderHeaders;
  const rows = state.orderRawRows;

  const headerRow = document.getElementById('preview-header');
  headerRow.innerHTML = headers.map((h, i) => {
    let cls = '';
    if (i === skuCol) cls = 'preview-col-sku';
    if (i === qtyCol) cls = 'preview-col-qty';
    return `<th class="${cls}">${h || `欄位 ${i + 1}`}</th>`;
  }).join('');

  const body = document.getElementById('preview-body');
  const startRow = 1;
  const previewRows = rows.slice(startRow, startRow + 5);
  body.innerHTML = previewRows.map(row =>
    `<tr>${headers.map((_, i) => {
      let cls = '';
      if (i === skuCol) cls = 'preview-col-sku';
      if (i === qtyCol) cls = 'preview-col-qty';
      const val = safeStr(row[i]);
      return `<td class="${cls}">${val.slice(0, 40)}</td>`;
    }).join('')}</tr>`
  ).join('');
}

function closeOrderImportModal() {
  document.getElementById('order-import-modal').style.display = 'none';
  state.selectedOrderFile = null;
}

async function handleOrderImportConfirm() {
  if (!state.selectedOrderFile) return;
  const btn = document.getElementById('order-import-confirm');
  btn.disabled = true;
  btn.textContent = '解析中...';
  document.getElementById('order-import-result').innerHTML =
    '<div class="info-box">正在解析訂單檔案...</div>';

  try {
    const skuCol = parseInt(document.getElementById('mapping-sku-select').value);
    const qtyCol = parseInt(document.getElementById('mapping-qty-select').value);

    const items = extractOrderItems(
      state.orderHeaders, state.orderRawRows, skuCol, qtyCol, true
    );

    if (!items.length) {
      document.getElementById('order-import-result').innerHTML =
        '<div class="import-result error">❌ 未找到有效訂單資料，請確認欄位對應是否正確</div>';
      btn.disabled = false;
      btn.textContent = '確認匯入';
      return;
    }

    // Validation: warn if quantities are suspiciously large
    const largeQtyItems = items.filter(it => it.quantity > 100000);
    if (largeQtyItems.length > 0) {
      const sample = largeQtyItems.slice(0, 3).map(it => `${it.sku}: ${fmt(it.quantity)}`).join(', ');
      document.getElementById('order-import-result').innerHTML =
        `<div class="import-result error">
          ⚠️ 偵測到 ${largeQtyItems.length} 項數量異常大（超過 10 萬）：<br>
          ${sample}${largeQtyItems.length > 3 ? '...' : ''}<br>
          請確認數量欄位是否選擇正確。
        </div>`;
      btn.disabled = false;
      btn.textContent = '確認匯入';
      return;
    }

    // Validation: warn if SKU values look like full product names (too long)
    const longSkuItems = items.filter(it => it.sku.length > 30);
    if (longSkuItems.length > items.length * 0.3) {
      document.getElementById('order-import-result').innerHTML =
        `<div class="import-result error">
          ⚠️ SKU 值似乎不是產品編號，而是完整產品名稱。<br>
          偵測到 ${longSkuItems.length}/${items.length} 項 SKU 長度超過 30 字元。<br>
          請確認 SKU 欄位是否選擇正確（應為 WU78157AA 等短編號）。
        </div>`;
      btn.disabled = false;
      btn.textContent = '確認匯入';
      return;
    }

    const aggregated = aggregateOrders(items);
    state.orderItems = aggregated;
    state.orderFileName = state.selectedOrderFile.name;
    state.orderAnalysis = analyzeOrders(aggregated);

    const produce = state.orderAnalysis.filter(a => a.status === 'produce').length;
    const ship = state.orderAnalysis.filter(a => a.status === 'ship').length;
    const safe = state.orderAnalysis.filter(a => a.status === 'safe').length;
    const nf = state.orderAnalysis.filter(a => a.status === 'not_found').length;

    document.getElementById('order-import-result').innerHTML =
      `<div class="import-result success">
        <div class="stat"><span>總項目</span><strong>${aggregated.length}</strong></div>
        <div class="stat"><span>安全</span><strong>${safe}</strong></div>
        <div class="stat"><span>需出貨</span><strong>${ship}</strong></div>
        <div class="stat"><span>需生產</span><strong>${produce}</strong></div>
        ${nf > 0 ? `<div class="stat"><span>找不到</span><strong>${nf}</strong></div>` : ''}
      </div>
      <p style="margin-top:12px;color:var(--color-green)">✓ 解析完成！正在載入分析...</p>`;
    btn.textContent = '完成';
    setTimeout(() => {
      closeOrderImportModal();
      btn.disabled = false;
      btn.textContent = '確認匯入';
      showOrderView();
      renderOrderAnalysis();
    }, 1500);
  } catch (e) {
    document.getElementById('order-import-result').innerHTML =
      `<div class="import-result error">❌ 匯入失敗: ${e.message}</div>`;
    btn.disabled = false;
    btn.textContent = '確認匯入';
  }
}

// ===== Start =====
init();
