'use strict';

// ===== Constants =====
const LS_KEYS = {
  PRODUCTS: 'usibook_products',
  INVENTORY: 'usibook_inventory',
  CONTAINERS: 'usibook_containers',
  LAST_IMPORT: 'usibook_last_import',
  SNAPSHOTS: 'usibook_snapshots',
  DISCONTINUED: 'usibook_discontinued',
};

const WEEKS_IN_YEAR = 52;
const WARN_WEEKS = 4;
const FOUR_WEEKS = 4;
const PRODUCE_WEEKS = 13;
const PACK_SIZE = 12;

const PACK12_SKUS = new Set([
  'WU77437AA','WU77437AP','WU77438AA','WU77438AP','WU77439AP',
  'WU77440AA','WU77440AP','WU77441AA','WU77441AP','WU77442AA',
  'WU77442AP','WU77443AA','WU77443AP','WU77444AP','WU77445AP',
  'WU77446AP','WU77447AP','WU77448AP','WU77451AA','WU77451AP',
  'WU77452AP','WU77453AA','WU77453AP','WU77454AP','WU77455AP',
  'WU77456AP','WU77458AA','WU77458AP','WU77459AP','WU77460AP',
  'WU77461AP','WU77462AA','WU77462AP','WU77474AA','WU77474AP',
  'WU77475AA','WU77475AP','WU77476AA','WU77476AP','WU77477AA',
  'WU77477AP','WU77478AA','WU77478AP','WU77479AA','WU77479AP',
  'WU77480AA','WU77480AP','WU77481AA','WU77481AP','WU77482AA',
  'WU77482AP','WU77483AA','WU77483AP','WU77484AA','WU77484AP',
  'WU77485AA','WU77485AP','WU78025AA','WU78025AP','WU78026AA',
  'WU78026AP','WU78027AA','WU78027AP','WU78028AA','WU78028AP',
  'WU78029AA','WU78029AP','WU78030AA','WU78030AP','WU78031AA',
  'WU78031AP','WU78032AA','WU78032AP','WU78033AA','WU78033AP',
  'WU78034AA','WU78034AP','WU78035AA','WU78035AP','WU78036AA',
  'WU78036AP','WU78056AP','WU78057AP','WU78058AP','WU78062AP',
  'WU78063AP','WU78064AP','WU78135AP','WU78230AP','WU78250AP',
  'WU78350AA','WU78351AA','WU78352AA','WU78353AA','WU78354AA',
  'WU78355AA','WU78483AP',
]);

function isPack12(code) {
  return PACK12_SKUS.has(code);
}

const SKU_COLS = ['sku', 'item', 'item code', 'item_code', 'item no', 'item number', 'product', 'product code', 'product id', 'model', 'model no', '型號', '產品編號', '品號', '編號', '商品編號', '貨號'];
const QTY_COLS = ['quantity', 'qty', 'quantity ordered', 'order quantity', 'order qty', '數量', '訂購數量', '訂單數量', 'amount', 'count', '訂購量'];

// ===== State =====
const state = {
  products: [],
  inventory: [],
  containers: [],
  lastImport: null,
  snapshots: {},
  discontinued: [],
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
  selectedUSWeeklyFile: null,
  selectedOrderFiles: [],
  charts: {},
  orderItems: [],
  orderAnalysis: [],
  orderFileName: '',
  orderFiles: [],
  orderSortField: null,
  orderSortDir: 'desc',
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
    state.discontinued = JSON.parse(localStorage.getItem(LS_KEYS.DISCONTINUED) || '[]');
  } catch (e) {
    console.error('Failed to load data:', e);
    state.products = [];
    state.inventory = [];
    state.containers = [];
    state.lastImport = null;
    state.snapshots = {};
    state.discontinued = [];
  }
}

function saveDiscontinued() {
  localStorage.setItem(LS_KEYS.DISCONTINUED, JSON.stringify(state.discontinued));
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
  return WEEKS_IN_YEAR;
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
    const pack12 = isPack12(code);
    const g = pack12 ? safeNum(inv.g_inventory) * PACK_SIZE : safeNum(inv.g_inventory);
    const h = pack12 ? safeNum(inv.h_orders) * PACK_SIZE : safeNum(inv.h_orders);
    const i = pack12 ? safeNum(inv.i_intransit) * PACK_SIZE : safeNum(inv.i_intransit);
    const l = pack12 ? safeNum(inv.l_prev_inventory) * PACK_SIZE : safeNum(inv.l_prev_inventory);
    const m = pack12 ? safeNum(inv.m_prev_orders) * PACK_SIZE : safeNum(inv.m_prev_orders);
    const n = pack12 ? safeNum(inv.n_prev_intransit) * PACK_SIZE : safeNum(inv.n_prev_intransit);

    const j = (inv.explicit_j !== undefined && inv.explicit_j !== null)
      ? Math.round((pack12 ? safeNum(inv.explicit_j) * PACK_SIZE : safeNum(inv.explicit_j)) * 10) / 10
      : Math.round((g - h + i) * 10) / 10;
    const o = (inv.explicit_o !== undefined && inv.explicit_o !== null)
      ? Math.round((pack12 ? safeNum(inv.explicit_o) * PACK_SIZE : safeNum(inv.explicit_o)) * 10) / 10
      : Math.round((l - m + n) * 10) / 10;
    const pDiff = Math.round((j - o) * 10) / 10;

    const sales2025Raw = safeNum(p.sales_2025);
    const totalShippedRaw = safeNum(p.total_shipped);
    const sales2025 = pack12 ? sales2025Raw * PACK_SIZE : sales2025Raw;
    const totalShipped = pack12 ? totalShippedRaw * PACK_SIZE : totalShippedRaw;
    const status = calculateStatus(j, sales2025, pDiff, i, weeksElapsed);

    const weeklyRateW = sales2025 > 0 && weeksElapsed > 0
      ? Math.round((sales2025 / weeksElapsed) * 10) / 10 : 0;
    const weeksLeftW = weeklyRateW > 0 ? Math.round((j / weeklyRateW) * 10) / 10 : null;
    const totalProduced = safeNum(p.total_produced);
    const huiyangInv = safeNum(p.huiyang_inv);
    const indonesiaInv = safeNum(p.indonesia_inv);
    const myanmarInv = safeNum(p.myanmar_inv);

    const isDiscontinued = (p.discontinued || '').trim() !== '';
    const totalInv = Math.round((j + totalProduced) * 10) / 10;
    const weeksLeftTotal = weeklyRateW > 0 ? Math.round((totalInv / weeklyRateW) * 10) / 10 : null;

    const wLow = weeksLeftW !== null && weeksLeftW < FOUR_WEEKS;
    const jLow = wLow || j < 50;

    let prodStatus = 'none';
    if (weeksLeftTotal !== null && weeksLeftTotal < PRODUCE_WEEKS) {
      prodStatus = 'produce';
    } else if (jLow && totalProduced > 0) {
      prodStatus = 'available';
    } else if (totalProduced < 60 || wLow) {
      prodStatus = 'judge';
    }

    merged.push({
      item_code: code,
      name: p.name || '',
      english_name: p.english_name || '',
      is_pack12: pack12,
      discontinued: p.discontinued || '',
      production_unit: p.production_unit || '',
      sales_2025: sales2025,
      total_shipped: totalShipped,
      notes: p.notes || '',
      directive: p.directive || '',
      pl_mold: p.pl_mold || '',
      total_produced: totalProduced,
      huiyang_inv: huiyangInv,
      indonesia_inv: indonesiaInv,
      myanmar_inv: myanmarInv,
      website_on: p.website_on || '',
      web_note: p.web_note || '',
      g, h, i, j, l, m, n, o, p: pDiff,
      status,
      prod_status: prodStatus,
      weekly_rate_w: weeklyRateW,
      weeks_left_w: weeksLeftW,
      total_inv: totalInv,
      weeks_left_total: weeksLeftTotal,
    });
  }
  return merged;
}

function computeStats() {
  const data = state.mergedData;
  const red = data.filter(d => d.status === 'red').length;
  const yellow = data.filter(d => d.status === 'yellow').length;
  const green = data.filter(d => d.status === 'green').length;
  const inTransitContainers = state.containers.filter(c => c.status === 'in_transit').length;
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
    in_transit_containers: inTransitContainers,
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


function detectColumnMapping(wsMain, range) {
  let headerRow = 2;
  for (let r = 0; r <= Math.min(10, range.e.r); r++) {
    const val = safeStr(getCellValue(wsMain, r, 0));
    if (val === 'Item' || val === 'item') { headerRow = r; break; }
  }

  const headers = [];
  for (let c = 0; c <= range.e.c; c++) {
    headers.push(safeStr(getCellValue(wsMain, headerRow, c)));
  }

  const m = {
    headerRow,
    dataStartRow: headerRow + 1,
    item_code: 0,
    discontinued: 1,
    name: 2,
    explicit_j: null,
    explicit_o: null,
  };

  // Find 結餘 columns to identify section boundaries
  const balanceCols = [];
  for (let c = 3; c < headers.length; c++) {
    if (headers[c].includes('結餘') || headers[c].includes('结余')) balanceCols.push(c);
  }
  if (balanceCols.length >= 1) m.explicit_j = balanceCols[0];
  if (balanceCols.length >= 2) m.explicit_o = balanceCols[1];

  // Current week section: col 3 to first 結餘
  const cwEnd = balanceCols.length > 0 ? balanceCols[0] : 10;
  for (let c = 3; c < cwEnd; c++) {
    const h = headers[c];
    if (!h) continue;
    if (h.includes('海上')) m.i_intransit = c;
    else if (h.includes('接单') || h.includes('接單')) { if (m.h_orders === undefined) m.h_orders = c; }
    else if (h.includes('库') || h.includes('庫') || h.includes('仓') || h.includes('倉')) { if (m.g_inventory === undefined) m.g_inventory = c; }
  }

  // Detect container columns: non-inventory columns with date+route pattern or ETA dates
  let etaRow = -1;
  for (let r = 0; r < headerRow; r++) {
    for (let c = 3; c < cwEnd; c++) {
      if (safeStr(getCellValue(wsMain, r, c)).includes('到')) { etaRow = r; break; }
    }
    if (etaRow >= 0) break;
  }
  const invColSet = new Set();
  if (m.g_inventory !== undefined) invColSet.add(m.g_inventory);
  if (m.h_orders !== undefined) invColSet.add(m.h_orders);
  if (m.i_intransit !== undefined) invColSet.add(m.i_intransit);
  if (m.explicit_j !== null) invColSet.add(m.explicit_j);
  m.container_cols = [];
  for (let c = 3; c < cwEnd; c++) {
    if (invColSet.has(c)) continue;
    const hVal = headers[c];
    const etaVal = etaRow >= 0 ? safeStr(getCellValue(wsMain, etaRow, c)) : '';
    if (/^\d+-\d+[A-Za-z]/.test(hVal) || etaVal.includes('到')) {
      m.container_cols.push({ col: c, header: hVal, eta: etaVal });
    }
  }

  // Previous week section: after first 結餘 to second 結餘 or 全部訂單
  const pwStart = balanceCols.length > 0 ? balanceCols[0] + 1 : 11;
  let pwEnd = balanceCols.length > 1 ? balanceCols[1] : 14;
  if (balanceCols.length <= 1) {
    for (let c = pwStart; c < headers.length; c++) {
      if (headers[c].includes('全部訂單') || headers[c].includes('全部订单')) { pwEnd = c - 1; break; }
    }
  }
  for (let c = pwStart; c <= pwEnd; c++) {
    const h = headers[c];
    if (!h) continue;
    if (h.includes('海上')) m.n_prev_intransit = c;
    else if (h.includes('接单') || h.includes('接單')) { if (m.m_prev_orders === undefined) m.m_prev_orders = c; }
    else if (h.includes('仓') || h.includes('倉') || h.includes('库') || h.includes('庫')) { if (m.l_prev_inventory === undefined) m.l_prev_inventory = c; }
  }

  // Unique keyword fields
  for (let c = 0; c < headers.length; c++) {
    const h = headers[c];
    if (!h) continue;
    if (h.includes('全部訂單') || h.includes('全部订单')) m.total_produced = c;
    else if (h.trim() === 'HY') m.huiyang_inv = c;
    else if (h.trim() === 'PL') m.indonesia_inv = c;
    else if (h.trim() === 'XR') m.myanmar_inv = c;
    else if (h.includes('年售') || h.includes('年销')) m.sales_2025 = c;
    else if (h.includes('总出货') || h.includes('總出貨')) m.total_shipped = c;
    else if (h.includes('生產單位') || h.includes('生产单位')) m.production_unit = c;
    else if (h.includes('PL有模')) m.pl_mold = c;
  }

  // Fallbacks for undetected fields (old format compatibility)
  const fb = {
    g_inventory: 6, h_orders: 7, i_intransit: 8,
    l_prev_inventory: 11, m_prev_orders: 12,
    total_produced: 16, huiyang_inv: 17, indonesia_inv: 18, myanmar_inv: 19,
    sales_2025: 22, total_shipped: 23, production_unit: 26, pl_mold: 29,
  };
  for (const [k, v] of Object.entries(fb)) {
    if (m[k] === undefined) m[k] = v;
  }
  // n_prev_intransit: only set if detected; no fallback (some formats lack this column)

  // Notes: relative to total_shipped
  m.notes = m.total_shipped + 1;
  m.notes2 = m.total_shipped + 2;
  // Directive: between notes2 and production_unit, or between production_unit and pl_mold
  if (m.production_unit > m.notes2 + 1) {
    m.directive = m.notes2 + 1;
  } else if (m.pl_mold > m.production_unit + 1) {
    m.directive = m.production_unit + 1;
  } else {
    m.directive = null;
  }

  return m;
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

  const colMap = detectColumnMapping(wsMain, range);

  const products = [];
  const inventory = [];

  for (let r = colMap.dataStartRow; r <= range.e.r; r++) {
    const item = safeStr(getCellValue(wsMain, r, colMap.item_code));
    if (!item || item.length < 3) continue;

    const name = safeStr(getCellValue(wsMain, r, colMap.name));
    if (!name) continue;

    const discontinued = safeStr(getCellValue(wsMain, r, colMap.discontinued));
    const prodUnit = safeStr(getCellValue(wsMain, r, colMap.production_unit));
    const sales2025 = safeNum(getCellValue(wsMain, r, colMap.sales_2025));
    const totalShipped = safeNum(getCellValue(wsMain, r, colMap.total_shipped));
    const notes = safeStr(getCellValue(wsMain, r, colMap.notes));
    const directive = colMap.directive !== null ? safeStr(getCellValue(wsMain, r, colMap.directive)) : '';
    const plMold = safeStr(getCellValue(wsMain, r, colMap.pl_mold));

    const totalProduced = safeNum(getCellValue(wsMain, r, colMap.total_produced));
    const huiyangInv = safeNum(getCellValue(wsMain, r, colMap.huiyang_inv));
    const indonesiaInv = safeNum(getCellValue(wsMain, r, colMap.indonesia_inv));
    const myanmarInv = safeNum(getCellValue(wsMain, r, colMap.myanmar_inv));

    const gInv = safeNum(getCellValue(wsMain, r, colMap.g_inventory));
    const hOrders = safeNum(getCellValue(wsMain, r, colMap.h_orders));
    const iIntransit = safeNum(getCellValue(wsMain, r, colMap.i_intransit));

    const lPrev = safeNum(getCellValue(wsMain, r, colMap.l_prev_inventory));
    const mPrev = safeNum(getCellValue(wsMain, r, colMap.m_prev_orders));
    const nPrev = colMap.n_prev_intransit !== undefined
      ? safeNum(getCellValue(wsMain, r, colMap.n_prev_intransit)) : 0;

    const explicitJ = colMap.explicit_j !== null ? safeNum(getCellValue(wsMain, r, colMap.explicit_j)) : null;
    const explicitO = colMap.explicit_o !== null ? safeNum(getCellValue(wsMain, r, colMap.explicit_o)) : null;

    let englishName = '';
    let websiteOn = '';
    let webNote = '';
    if (webInfo[item]) {
      englishName = webInfo[item].english_name;
      websiteOn = webInfo[item].website_on;
      webNote = webInfo[item].web_note;
    } else if (discInfo[item]) {
      englishName = discInfo[item].english_name;
    }

    products.push({
      item_code: item, name, english_name: englishName,
      discontinued, production_unit: prodUnit,
      sales_2025: sales2025, total_shipped: totalShipped,
      notes, directive, pl_mold: plMold,
      total_produced: totalProduced, huiyang_inv: huiyangInv,
      indonesia_inv: indonesiaInv, myanmar_inv: myanmarInv,
      website_on: websiteOn, web_note: webNote,
    });
    inventory.push({
      item_code: item, g_inventory: gInv, h_orders: hOrders,
      i_intransit: iIntransit, l_prev_inventory: lPrev,
      m_prev_orders: mPrev, n_prev_intransit: nPrev,
      explicit_j: explicitJ, explicit_o: explicitO,
    });
  }

  const discontinued = Object.entries(discInfo).map(([code, info]) => ({
    item_code: code,
    english_name: info.english_name,
    sales_total: info.sales_total,
  }));

  // Parse containers from container columns
  const containers = [];
  if (colMap.container_cols && colMap.container_cols.length > 0) {
    const today = new Date();
    for (const cc of colMap.container_cols) {
      const header = cc.header;
      const etaStr = cc.eta;

      let shipDate = '', route = '';
      const shipMatch = header.match(/(\d+)-(\d+)\s*([A-Za-z]+)/);
      if (shipMatch) {
        shipDate = `${shipMatch[1]}-${shipMatch[2]}`;
        route = shipMatch[3].toUpperCase();
      }

      let eta = '';
      const etaMatch = etaStr.match(/(\d+)-(\d+)/);
      if (etaMatch) eta = `${etaMatch[1]}-${etaMatch[2]}`;

      let totalQty = 0;
      let itemCount = 0;
      for (let r = colMap.dataStartRow; r <= range.e.r; r++) {
        const qty = safeNum(getCellValue(wsMain, r, cc.col));
        if (qty > 0) { totalQty += qty; itemCount++; }
      }

      if (totalQty > 0) {
        containers.push({
          id: `container_col_${cc.col}`,
          route, ship_date: shipDate, eta, status: 'in_transit',
          total_qty: totalQty, item_count: itemCount,
        });
      }
    }
  }

  return { products, inventory, discontinued, containers };
}

function parseUSWeeklyExcel(workbook) {
  let ws = null;
  let range = null;

  for (const sheetName of workbook.SheetNames) {
    const candidate = workbook.Sheets[sheetName];
    if (!candidate || !candidate['!ref']) continue;
    const candidateRange = XLSX.utils.decode_range(candidate['!ref']);
    if (candidateRange.e.c < 0 || candidateRange.e.r < 1) continue;

    let hasData = false;
    for (let r = 0; r < Math.min(candidateRange.e.r + 1, 20); r++) {
      const val = safeStr(getCellValue(candidate, r, 0));
      if (val.length >= 3) { hasData = true; break; }
    }
    if (hasData) { ws = candidate; range = candidateRange; break; }
  }
  if (!ws) throw new Error('找不到包含資料的工作表');

  const headerRow = [];
  for (let c = 0; c <= range.e.c; c++) {
    headerRow.push(safeStr(getCellValue(ws, 0, c)).toLowerCase());
  }

  let poCol = -1, soCol = -1, onHandCol = -1, itemCol = 0;
  for (let c = 0; c < headerRow.length; c++) {
    const h = headerRow[c];
    if (h.includes('purchase order')) poCol = c;
    if (h.includes('sales order')) soCol = c;
    if (h.includes('on hand') || h.includes('onhand')) onHandCol = c;
    if (h === 'item' || h.includes('item code') || h.includes('sku') || h.includes('型號')) itemCol = c;
  }

  if (poCol < 0 || soCol < 0 || onHandCol < 0) {
    throw new Error('找不到 QuickBooks 欄位，請確認檔案格式');
  }

  const importData = {};
  for (let r = 1; r <= range.e.r; r++) {
    const item = safeStr(getCellValue(ws, r, itemCol));
    if (!item || item.length < 3) continue;
    if (item.toLowerCase() === 'item' || item.toLowerCase() === 'sku') continue;

    const po = safeNum(getCellValue(ws, r, poCol));
    const so = safeNum(getCellValue(ws, r, soCol));
    const onHand = safeNum(getCellValue(ws, r, onHandCol));
    importData[item] = { g: onHand, h: so, i: po };
  }
  return importData;
}

function parseUSWeeklyCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return {};

  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());

  let poCol = -1, soCol = -1, onHandCol = -1, itemCol = 0;
  for (let c = 0; c < headers.length; c++) {
    const h = headers[c];
    if (h.includes('purchase order')) poCol = c;
    if (h.includes('sales order')) soCol = c;
    if (h.includes('on hand') || h.includes('onhand')) onHandCol = c;
    if (h === 'item' || h.includes('item code') || h.includes('sku') || h.includes('型號')) itemCol = c;
  }

  if (poCol < 0 || soCol < 0 || onHandCol < 0) {
    throw new Error('找不到 QuickBooks 欄位，請確認檔案格式');
  }

  const importData = {};
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const item = (cols[itemCol] || '').trim();
    if (!item || item.length < 3) continue;
    if (item.toLowerCase() === 'item' || item.toLowerCase() === 'sku') continue;

    const po = safeNum(cols[poCol]);
    const so = safeNum(cols[soCol]);
    const onHand = safeNum(cols[onHandCol]);
    importData[item] = { g: onHand, h: so, i: po };
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
      old.n_prev_intransit = 0;
      old.explicit_o = old.explicit_j;
      old.explicit_j = null;
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
        explicit_j: null,
        explicit_o: null,
      };
      state.inventory.push(newInv);
      invMap[itemCode] = newInv;
      newItems++;
    }

    if (!prodMap[itemCode]) {
      state.products.push({
        item_code: itemCode, name: '', english_name: '',
        discontinued: '', production_unit: '',
        sales_2025: 0, total_shipped: 0,
        notes: '', directive: '', pl_mold: '',
        total_produced: 0, huiyang_inv: 0,
        indonesia_inv: 0, myanmar_inv: 0,
        website_on: '', web_note: '',
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
    'item_code', 'name', 'english_name', 'is_pack12', 'g', 'h', 'i', 'j', 'l', 'm', 'n', 'o', 'p',
    'sales_2025', 'total_shipped', 'status', 'prod_status', 'production_unit',
    'notes', 'directive',
    'total_produced', 'total_inv', 'weeks_left_total', 'huiyang_inv', 'indonesia_inv', 'myanmar_inv',
    'website_on', 'web_note',
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
    discontinued: state.discontinued,
    export_date: new Date().toISOString(),
    version: '1.1',
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
  state.discontinued = data.discontinued || [];
  saveProducts();
  saveInventory();
  saveContainers();
  saveLastImport();
  saveSnapshots();
  saveDiscontinued();
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
    const routeList = inTransit.map(c => `${c.route}(${c.eta})`).join('、');
    const totalQty = inTransit.reduce((sum, c) => sum + (c.total_qty || 0), 0);
    document.getElementById('container-detail').textContent = `${routeList} | 共 ${fmt(totalQty)} 件`;
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
    el.innerHTML = '<p style="color:var(--color-text-sub)">無在途貨櫃，請使用「總檔更新(新貨櫃)」匯入貨櫃資料</p>';
    return;
  }
  el.innerHTML = state.containers.map(c => `
    <div class="container-card">
      <span class="route-badge">${c.route || '?'}</span>
      <div class="ship-info">出貨: ${c.ship_date} → ETA: ${c.eta}</div>
      ${c.total_qty ? `<div class="ship-info">${fmt(c.total_qty)} 件 / ${c.item_count || 0} 項</div>` : ''}
      ${c.status === 'arrived'
        ? '<span class="arrived-badge">已到貨</span>'
        : '<span class="eta-badge">在途中</span>'}
    </div>
  `).join('');
}

function renderDrops() {
  const el = document.getElementById('biggest-drops');
  const dateEl = document.getElementById('drops-date');
  if (!state.stats || !state.stats.biggest_drops) {
    el.innerHTML = '';
    if (dateEl) dateEl.textContent = '';
    return;
  }
  const li = state.lastImport;
  if (dateEl && li && li.date) {
    dateEl.textContent = `（截至 ${li.date}）`;
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

  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    data = data.filter(d =>
      d.item_code.toLowerCase().includes(q) ||
      (d.name || '').toLowerCase().includes(q) ||
      (d.english_name || '').toLowerCase().includes(q)
    );
  } else {
    if (state.statusFilter) {
      data = data.filter(d => d.status === state.statusFilter);
    }
    if (state.prodFilter) {
      data = data.filter(d => d.prod_status === state.prodFilter);
    }
  }

  const field = state.sortField;
  const dir = state.sortDir === 'desc' ? -1 : 1;
  data = [...data].sort((a, b) => {
    let av = a[field], bv = b[field];
    if (field === 'weeks_left_w' || field === 'weeks_left_total') {
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
    }
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

  if (state.searchQuery && data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="17" style="text-align:center;padding:24px;color:var(--color-red)">
      ❌ 找不到型號「${state.searchQuery}」，請確認編號是否正確</td></tr>`;
    return;
  }

  tbody.innerHTML = pageData.map(d => {
    const weeksW = d.weeks_left_w !== null ? `${d.weeks_left_w} 週` : '無法估算';
    const estimate = weeksW;
    const weeksTotal = d.weeks_left_total !== null ? `${d.weeks_left_total} 週` : '無法估算';
    const pack12Badge = d.is_pack12 ? '<span class="pack12-badge" title="此SKU的G/I/L/N已從12PC包裝自動轉換為件">12PC</span>' : '';
    return `
      <tr onclick="toggleDetail('${d.item_code}')" style="cursor:pointer">
        <td>${statusIcon(d.status)}</td>
        <td><strong>${d.item_code}</strong>${pack12Badge}</td>
        <td>${d.name || ''}</td>
        <td class="num">${fmt(d.g)}</td>
        <td class="num">${fmt(d.h)}</td>
        <td class="num ${valClass(d.j)}"><strong>${fmtSigned(d.j)}</strong></td>
        <td class="num ${valClass(d.p)}">${fmtSigned(d.p)}</td>
        <td class="num">${fmt(d.sales_2025)}</td>
        <td class="num">${fmt(d.total_shipped)}</td>
        <td class="num" style="font-weight:600">${fmt(d.total_inv)}</td>
        <td class="num">${fmt(d.huiyang_inv)}</td>
        <td class="num">${fmt(d.indonesia_inv)}</td>
        <td class="num">${fmt(d.myanmar_inv)}</td>
        <td class="num" style="font-size:12px;color:var(--color-text-sub)">${estimate}</td>
        <td class="num" style="font-size:12px;color:var(--color-text-sub)">${weeksTotal}</td>
        <td>▼</td>
        <td style="text-align:center">${d.website_on === '1' ? '🟢' : d.website_on === '0' ? '🔴' : '-'}</td>
      </tr>
      <tr class="detail-row" id="detail-${d.item_code}">
        <td colspan="17">
          <div class="detail-grid">
            <div class="detail-item"><div class="detail-label">英文品名</div><div class="detail-value">${d.english_name || '-'}</div></div>
            <div class="detail-item"><div class="detail-label">總庫存 (J+Q)</div><div class="detail-value">${fmt(d.total_inv)}</div></div>
            <div class="detail-item"><div class="detail-label">惠陽廠 R</div><div class="detail-value">${fmt(d.huiyang_inv)}</div></div>
            <div class="detail-item"><div class="detail-label">印尼廠 S</div><div class="detail-value">${fmt(d.indonesia_inv)}</div></div>
            <div class="detail-item"><div class="detail-label">緬甸廠 T</div><div class="detail-value">${fmt(d.myanmar_inv)}</div></div>
            <div class="detail-item"><div class="detail-label">生產單位</div><div class="detail-value">${d.production_unit || '-'}</div></div>
            <div class="detail-item"><div class="detail-label">網站狀態</div><div class="detail-value">${d.website_on === '1' ? '上架中' : d.website_on === '0' ? '已下架' : '-'}</div></div>
            <div class="detail-item"><div class="detail-label">網站備註</div><div class="detail-value">${d.web_note || '-'}</div></div>
            <div class="detail-item"><div class="detail-label">上週結餘 O</div><div class="detail-value">${fmtSigned(d.o)}</div></div>
            <div class="detail-item"><div class="detail-label">上週庫存 L</div><div class="detail-value">${fmt(d.l)}</div></div>
            <div class="detail-item"><div class="detail-label">上週接單 M</div><div class="detail-value">${fmt(d.m)}</div></div>
            <div class="detail-item"><div class="detail-label">每週銷售 (W基準)</div><div class="detail-value">${fmt(d.weekly_rate_w)} pc/週</div></div>
            <div class="detail-item"><div class="detail-label">預估可用 (W)</div><div class="detail-value">${d.weeks_left_w !== null ? d.weeks_left_w + ' 週' : '無法估算'}</div></div>
            <div class="detail-item"><div class="detail-label">總庫存預估 (W)</div><div class="detail-value">${d.weeks_left_total !== null ? d.weeks_left_total + ' 週' : '無法估算'}</div></div>
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
      <div class="detail-item"><div class="detail-label">總庫存 (J+Q)</div><div class="detail-value">${fmt(p.total_inv)}</div></div>
      <div class="detail-item"><div class="detail-label">惠陽廠 R</div><div class="detail-value">${fmt(p.huiyang_inv)}</div></div>
      <div class="detail-item"><div class="detail-label">印尼廠 S</div><div class="detail-value">${fmt(p.indonesia_inv)}</div></div>
      <div class="detail-item"><div class="detail-label">緬甸廠 T</div><div class="detail-value">${fmt(p.myanmar_inv)}</div></div>
      <div class="detail-item"><div class="detail-label">狀態</div><div class="detail-value">${p.status}</div></div>
      <div class="detail-item"><div class="detail-label">生產單位</div><div class="detail-value">${p.production_unit || '-'}</div></div>
      <div class="detail-item"><div class="detail-label">停售標記</div><div class="detail-value">${p.discontinued || '-'}</div></div>
      <div class="detail-item"><div class="detail-label">庫存 G</div><div class="detail-value">${fmt(p.g)}</div></div>
      <div class="detail-item"><div class="detail-label">接單 H</div><div class="detail-value">${fmt(p.h)}</div></div>
      <div class="detail-item"><div class="detail-label">結餘 J</div><div class="detail-value ${valClass(p.j)}">${fmtSigned(p.j)}</div></div>
      <div class="detail-item"><div class="detail-label">上週庫存 L</div><div class="detail-value">${fmt(p.l)}</div></div>
      <div class="detail-item"><div class="detail-label">上週接單 M</div><div class="detail-value">${fmt(p.m)}</div></div>
      <div class="detail-item"><div class="detail-label">上週結餘 O</div><div class="detail-value">${fmtSigned(p.o)}</div></div>
      <div class="detail-item"><div class="detail-label">週變化 P (J-O)</div><div class="detail-value ${valClass(p.p)}">${fmtSigned(p.p)}</div></div>
      <div class="detail-item"><div class="detail-label">2025年銷售 W</div><div class="detail-value">${fmt(p.sales_2025)}</div></div>
      <div class="detail-item"><div class="detail-label">總出貨量 X</div><div class="detail-value">${fmt(p.total_shipped)}</div></div>
      <div class="detail-item"><div class="detail-label">每週銷售率</div><div class="detail-value">${fmt(p.weekly_rate_w)} pc/週</div></div>
      <div class="detail-item"><div class="detail-label">預估可用 (W基準)</div><div class="detail-value">${p.weeks_left_w !== null ? p.weeks_left_w + ' 週' : '無法估算'}</div></div>
      <div class="detail-item"><div class="detail-label">總庫存預估 (W基準)</div><div class="detail-value">${p.weeks_left_total !== null ? p.weeks_left_total + ' 週' : '無法估算'}</div></div>
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
  if (!localStorage.getItem('tour_seen')) {
    setTimeout(startTour, 500);
    localStorage.setItem('tour_seen', '1');
  }
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
      const isAll = tab.dataset.status === '' && tab.dataset.prod === '';
      if (isAll) {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        state.statusFilter = '';
        state.prodFilter = '';
      } else if (tab.dataset.prod !== undefined && tab.dataset.prod !== '') {
        document.querySelectorAll('.tab[data-prod]').forEach(t => {
          if (t.dataset.prod !== '') t.classList.remove('active');
        });
        tab.classList.add('active');
        state.prodFilter = tab.dataset.prod;
      } else if (tab.dataset.status !== undefined && tab.dataset.status !== '') {
        document.querySelectorAll('.tab[data-status]').forEach(t => {
          if (t.dataset.status !== '') t.classList.remove('active');
        });
        tab.classList.add('active');
        state.statusFilter = tab.dataset.status;
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

  // ===== US Weekly Import modal =====
  document.getElementById('us-weekly-btn').addEventListener('click', () => {
    if (!hasData()) { alert('請先上傳 USI 總檔初始化資料'); return; }
    document.getElementById('us-weekly-modal').style.display = 'flex';
    document.getElementById('us-weekly-result').innerHTML = '';
    document.getElementById('us-weekly-confirm').disabled = true;
    state.selectedUSWeeklyFile = null;
  });

  document.getElementById('us-weekly-close').addEventListener('click', closeUSWeeklyModal);
  document.getElementById('us-weekly-cancel').addEventListener('click', closeUSWeeklyModal);

  const usDropZone = document.getElementById('us-weekly-drop-zone');
  const usFileInput = document.getElementById('us-weekly-file-input');

  usDropZone.addEventListener('click', () => usFileInput.click());
  usDropZone.addEventListener('dragover', (e) => { e.preventDefault(); usDropZone.classList.add('dragover'); });
  usDropZone.addEventListener('dragleave', () => usDropZone.classList.remove('dragover'));
  usDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    usDropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleUSWeeklyFileSelect(e.dataTransfer.files[0]);
  });
  usFileInput.addEventListener('change', (e) => {
    if (e.target.files.length) handleUSWeeklyFileSelect(e.target.files[0]);
  });

  document.getElementById('us-weekly-confirm').addEventListener('click', handleUSWeeklyImportConfirm);

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
      const { products, inventory: newInv, discontinued: newDisc, containers: newContainers } = parseMainExcel(workbook);

      if (newDisc && newDisc.length) {
        state.discontinued = newDisc;
        saveDiscontinued();
      }
      if (newContainers && newContainers.length) {
        state.containers = newContainers;
        saveContainers();
      }

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
      state.orderFiles = [];
    }
  });

  document.getElementById('order-back').addEventListener('click', showDashboardView);

  // Order table sortable headers
  document.querySelectorAll('#order-table th.sortable').forEach(th => {
    th.style.cursor = 'pointer';
    th.addEventListener('click', () => handleOrderSort(th.dataset.sort));
  });
  document.getElementById('order-reimport').addEventListener('click', () => {
    document.getElementById('order-import-modal').style.display = 'flex';
    document.getElementById('order-import-result').innerHTML = '';
    document.getElementById('order-mapping-section').style.display = 'none';
    document.getElementById('order-import-confirm').disabled = true;
    state.orderFiles = [];
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
    if (e.dataTransfer.files.length) handleOrderFileSelect(e.dataTransfer.files);
  });
  orderFileInput.addEventListener('change', (e) => {
    if (e.target.files.length) handleOrderFileSelect(e.target.files);
  });

  document.getElementById('order-import-confirm').addEventListener('click', handleOrderImportConfirm);

  document.getElementById('daily-order-btn').addEventListener('click', () => {
    if (!state.products.length) {
      alert('請先匯入總檔資料');
      return;
    }
    document.getElementById('daily-order-modal').style.display = 'flex';
    document.getElementById('daily-order-textarea').value = '';
    document.getElementById('daily-order-result').innerHTML = '';
  });

  document.getElementById('daily-order-close').addEventListener('click', () => {
    document.getElementById('daily-order-modal').style.display = 'none';
  });

  document.getElementById('daily-order-cancel').addEventListener('click', () => {
    document.getElementById('daily-order-modal').style.display = 'none';
  });

  document.getElementById('daily-order-analyze').addEventListener('click', handleDailyOrderAnalyze);

  document.getElementById('tour-btn').addEventListener('click', startTour);
  document.getElementById('tour-next').addEventListener('click', nextTourStep);
  document.getElementById('tour-prev').addEventListener('click', prevTourStep);
  document.getElementById('tour-skip').addEventListener('click', closeTour);
  window.addEventListener('resize', () => { if (tourActive) repositionTour(); });
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
    const { products, inventory, discontinued, containers } = parseMainExcel(workbook);

    if (!products.length) {
      resultEl.innerHTML = '<div class="import-result error">❌ 未找到任何產品資料，請確認檔案包含「USI庫存情況」工作表</div>';
      return;
    }

    state.discontinued = discontinued || [];
    saveDiscontinued();
    state.containers = containers || [];
    saveContainers();
    doMainImport(products, inventory);

    resultEl.innerHTML = `
      <div class="import-result success">
        <div class="stat"><span>產品數量</span><strong>${products.length}</strong></div>
        <div class="stat"><span>庫存記錄</span><strong>${inventory.length}</strong></div>
        <div class="stat"><span>貨櫃數量</span><strong>${(containers || []).length}</strong></div>
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

    if (ext !== 'xlsx' && ext !== 'xls') {
      document.getElementById('import-result').innerHTML =
        '<div class="import-result error">❌ 總檔更新(新貨櫃)僅支援 .xlsx / .xls 格式。若要更新週報，請使用「🇺🇸 週報更新」。</div>';
      btn.disabled = false;
      btn.textContent = '確認匯入';
      return;
    }

    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });

    if (!workbook.Sheets['USI庫存情況']) {
      document.getElementById('import-result').innerHTML =
        '<div class="import-result error">❌ 找不到「USI庫存情況」工作表，請確認上傳的是 USI 總檔。<br>若要更新週報，請使用「🇺🇸 週報更新」。</div>';
      btn.disabled = false;
      btn.textContent = '確認匯入';
      return;
    }

    const { products, inventory, discontinued, containers } = parseMainExcel(workbook);
    if (!products.length) {
      document.getElementById('import-result').innerHTML =
        '<div class="import-result error">❌ 未找到任何產品資料，請確認檔案包含「USI庫存情況」工作表</div>';
      btn.disabled = false;
      btn.textContent = '確認匯入';
      return;
    }
    state.discontinued = discontinued || [];
    saveDiscontinued();
    state.containers = containers || [];
    saveContainers();
    doMainImport(products, inventory);
    document.getElementById('import-result').innerHTML =
      `<div class="import-result success">
        <div class="stat"><span>產品數量</span><strong>${products.length}</strong></div>
        <div class="stat"><span>庫存記錄</span><strong>${inventory.length}</strong></div>
      </div>
      <p style="margin-top:12px;color:var(--color-green)">✓ 總檔更新(新貨櫃)成功！頁面將自動刷新...</p>`;
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

// ===== US Weekly Import =====
function closeUSWeeklyModal() {
  document.getElementById('us-weekly-modal').style.display = 'none';
  state.selectedUSWeeklyFile = null;
}

function handleUSWeeklyFileSelect(file) {
  state.selectedUSWeeklyFile = file;
  document.getElementById('us-weekly-result').innerHTML =
    `<div class="info-box">已選擇: <strong>${file.name}</strong> (${(file.size / 1024).toFixed(1)} KB)</div>`;
  document.getElementById('us-weekly-confirm').disabled = false;
}

async function handleUSWeeklyImportConfirm() {
  if (!state.selectedUSWeeklyFile) return;
  const btn = document.getElementById('us-weekly-confirm');
  btn.disabled = true;
  btn.textContent = '匯入中...';
  document.getElementById('us-weekly-result').innerHTML =
    '<div class="info-box">正在處理，請稍候...</div>';

  try {
    const file = state.selectedUSWeeklyFile;
    const ext = file.name.split('.').pop().toLowerCase();
    let importData;

    if (ext === 'csv') {
      const text = await file.text();
      importData = parseUSWeeklyCSV(text);
    } else {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      importData = parseUSWeeklyExcel(workbook);
    }

    const count = Object.keys(importData).length;
    if (!count) {
      document.getElementById('us-weekly-result').innerHTML =
        '<div class="import-result error">❌ 未找到有效資料，請確認檔案格式為 QuickBooks 匯出</div>';
      btn.disabled = false;
      btn.textContent = '確認匯入';
      return;
    }

    const existingCodes = new Set(state.products.map(p => p.item_code));
    const sampleItems = Object.keys(importData).slice(0, 50);
    let matchedCount = 0;
    for (const code of sampleItems) {
      if (existingCodes.has(code)) matchedCount++;
    }
    const matchRate = sampleItems.length > 0 ? matchedCount / sampleItems.length : 0;

    if (matchRate < 0.1) {
      document.getElementById('us-weekly-result').innerHTML =
        `<div class="import-result error">
          ❌ 此檔案的項目與現有產品編號吻合率過低 (${matchedCount}/${sampleItems.length})。<br>
          請確認檔案為美國辦公室傳來的 QuickBooks 週報。
        </div>`;
      btn.disabled = false;
      btn.textContent = '確認匯入';
      return;
    }

    const result = doWeeklyImport(importData, file.name);

    document.getElementById('us-weekly-result').innerHTML =
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
      closeUSWeeklyModal();
      btn.disabled = false;
      btn.textContent = '確認匯入';
      refreshData();
      renderAll();
    }, 2000);
  } catch (e) {
    document.getElementById('us-weekly-result').innerHTML =
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

function splitOrderLine(line) {
  return line.split(/[\t,]+|\s+/).map(c => c.trim()).filter(c => c);
}

function parseDailyOrderText(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l);
  if (!lines.length) return [];

  let skuCol = -1, qtyCol = -1;
  let dataStart = 0;

  const headerLower = lines[0].toLowerCase();
  if (headerLower.includes('sku') || headerLower.includes('item')) {
    const cols = splitOrderLine(lines[0]).map(c => c.trim().toLowerCase());
    for (let i = 0; i < cols.length; i++) {
      if (cols[i].includes('sku') || cols[i].includes('item') || cols[i].includes('品') || cols[i].includes('型')) skuCol = i;
      if (cols[i] === 'qty' || cols[i].includes('qty') || cols[i].includes('數量') || cols[i].includes('quantity')) qtyCol = i;
    }
    if (skuCol >= 0 || qtyCol >= 0) dataStart = 1;
  }

  const skuPattern = /^[A-Za-z]+\d{3,}[A-Za-z0-9]*$/;
  const items = [];

  for (let li = dataStart; li < lines.length; li++) {
    const parts = splitOrderLine(lines[li]);
    if (parts.length < 2) continue;

    let sku = null, qty = null;

    if (skuCol >= 0 && qtyCol >= 0 && parts[skuCol] && parts[qtyCol]) {
      if (skuPattern.test(parts[skuCol])) {
        sku = parts[skuCol];
        qty = parseInt(parts[qtyCol]) || 0;
      }
    }

    if (!sku) {
      for (let i = 0; i < parts.length; i++) {
        if (skuPattern.test(parts[i])) {
          sku = parts[i];
          for (let j = 0; j < parts.length; j++) {
            if (j === i) continue;
              if (/^\d+$/.test(parts[j])) {
              const val = parseInt(parts[j]);
              if (val > 0) {
                qty = val;
                break;
              }
            }
          }
          break;
        }
      }
    }

    if (sku && qty > 0) {
      items.push({ sku, quantity: qty });
    }
  }

  return items;
}

function handleDailyOrderAnalyze() {
  const text = document.getElementById('daily-order-textarea').value.trim();
  if (!text) {
    document.getElementById('daily-order-result').innerHTML =
      '<div class="import-result error">請貼上訂單內容</div>';
    return;
  }

  const items = parseDailyOrderText(text);
  if (!items.length) {
    document.getElementById('daily-order-result').innerHTML =
      '<div class="import-result error">未解析出任何訂單項目，請確認格式是否正確</div>';
    return;
  }

  const aggregated = aggregateOrders(items);
  const analysis = analyzeOrders(aggregated);

  state.orderAnalysis = analysis;
  state.orderFileName = `每日訂單 ${new Date().toISOString().slice(0, 10)}`;

  const safe = analysis.filter(a => a.status === 'safe').length;
  const ship = analysis.filter(a => a.status === 'ship').length;
  const produce = analysis.filter(a => a.status === 'produce').length;
  const nf = analysis.filter(a => a.status === 'not_found').length;

  document.getElementById('daily-order-result').innerHTML =
    `<div class="import-result success">
      <div class="stat"><span>解析項目</span><strong>${items.length}</strong></div>
      <div class="stat"><span>合併後</span><strong>${aggregated.length}</strong></div>
      <div class="stat"><span>安全</span><strong>${safe}</strong></div>
      <div class="stat"><span>需出貨</span><strong>${ship}</strong></div>
      <div class="stat"><span>需生產</span><strong>${produce}</strong></div>
      ${nf > 0 ? `<div class="stat"><span>找不到</span><strong>${nf}</strong></div>` : ''}
    </div>`;

  document.getElementById('daily-order-modal').style.display = 'none';
  showOrderView();
  renderOrderAnalysis();
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
  const discSet = new Set(state.discontinued.map(d => d.item_code));
  const discNameMap = {};
  for (const d of state.discontinued) {
    discNameMap[d.item_code] = d.english_name || '';
  }

  const weeksElapsed = getWeeksElapsed();
  const sales2025Year = 2025;

  return orderItems.map(item => {
    const inv = invMap[item.sku];
    const prod = prodMap[item.sku];
    const isDiscontinued = discSet.has(item.sku);

    if (!prod) {
      return {
        ...item,
        status: 'not_found',
        prod_status: 'none',
        name: '',
        english_name: discNameMap[item.sku] || '',
        discontinued: isDiscontinued,
        g: 0, h: 0, i: 0, j: 0,
        newJ: 0,
        total_produced: 0,
        total_inv: 0,
        huiyang_inv: 0, indonesia_inv: 0, myanmar_inv: 0,
        shortage: 0,
        weekly_rate_w: 0, weeks_left_w: null,
      };
    }

    const pack12 = isPack12(item.sku);
    const g = pack12 ? safeNum(inv?.g_inventory) * PACK_SIZE : safeNum(inv?.g_inventory);
    const h = pack12 ? safeNum(inv?.h_orders) * PACK_SIZE : safeNum(inv?.h_orders);
    const i = pack12 ? safeNum(inv?.i_intransit) * PACK_SIZE : safeNum(inv?.i_intransit);
    const l = pack12 ? safeNum(inv?.l_prev_inventory) * PACK_SIZE : safeNum(inv?.l_prev_inventory);
    const m = pack12 ? safeNum(inv?.m_prev_orders) * PACK_SIZE : safeNum(inv?.m_prev_orders);
    const n = pack12 ? safeNum(inv?.n_prev_intransit) * PACK_SIZE : safeNum(inv?.n_prev_intransit);

    const j = (inv?.explicit_j !== undefined && inv?.explicit_j !== null)
      ? Math.round((pack12 ? safeNum(inv?.explicit_j) * PACK_SIZE : safeNum(inv?.explicit_j)) * 10) / 10
      : Math.round((g - h + i) * 10) / 10;
    const o = (inv?.explicit_o !== undefined && inv?.explicit_o !== null)
      ? Math.round((pack12 ? safeNum(inv?.explicit_o) * PACK_SIZE : safeNum(inv?.explicit_o)) * 10) / 10
      : Math.round((l - m + n) * 10) / 10;
    const pDiff = Math.round((j - o) * 10) / 10;
    const newJ = Math.round((j - item.quantity) * 10) / 10;
    const totalProduced = safeNum(prod.total_produced);
    const huiyang = safeNum(prod.huiyang_inv);
    const indonesia = safeNum(prod.indonesia_inv);
    const myanmar = safeNum(prod.myanmar_inv);
    const sales2025 = pack12 ? safeNum(prod.sales_2025) * PACK_SIZE : safeNum(prod.sales_2025);

    const weeklyRateW = sales2025 > 0 && weeksElapsed > 0
      ? Math.round((sales2025 / weeksElapsed) * 10) / 10 : 0;
    const weeksLeftW = weeklyRateW > 0 ? Math.round((j / weeklyRateW) * 10) / 10 : null;

    const totalInv = Math.round((j + totalProduced) * 10) / 10;
    const weeksLeftTotal = weeklyRateW > 0 ? Math.round((totalInv / weeklyRateW) * 10) / 10 : null;

    const wLow = weeksLeftW !== null && weeksLeftW < FOUR_WEEKS;
    const jLow = wLow || j < 50;

    let prodStatus = 'none';
    if (weeksLeftTotal !== null && weeksLeftTotal < PRODUCE_WEEKS) {
      prodStatus = 'produce';
    } else if (jLow && totalProduced > 0) {
      prodStatus = 'available';
    } else if (totalProduced < 60 || wLow) {
      prodStatus = 'judge';
    }

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
      prod_status: prodStatus,
      name: prod.name || '',
      english_name: prod.english_name || '',
      discontinued: isDiscontinued,
      is_pack12: pack12,
      g, h, i, j, newJ,
      total_produced: totalProduced,
      total_inv: totalInv,
      weeks_left_total: weeksLeftTotal,
      huiyang_inv: huiyang,
      indonesia_inv: indonesia,
      myanmar_inv: myanmar,
      shortage,
      weekly_rate_w: weeklyRateW,
      weeks_left_w: weeksLeftW,
    };
  });
}

function renderOrderAnalysis() {
  const analysis = state.orderAnalysis;
  const ship = analysis.filter(a => a.status === 'ship');
  const produce = analysis.filter(a => a.status === 'produce');
  const notFound = analysis.filter(a => a.status === 'not_found');
  const discontinued = analysis.filter(a => a.discontinued);
  const safeCount = analysis.filter(a => a.status === 'safe').length;

  document.getElementById('order-file-info').textContent =
    `${state.orderFileName} | ${analysis.length} 項 | ${new Date().toISOString().slice(0, 10)}`;

  document.getElementById('order-summary').innerHTML = `
    <div class="order-summary-bar">
      <div class="order-summary-item"><span class="order-dot dot-green"></span> 安全: <strong>${safeCount}</strong></div>
      <div class="order-summary-item"><span class="order-dot dot-blue"></span> 需出貨: <strong>${ship.length}</strong></div>
      <div class="order-summary-item"><span class="order-dot dot-red"></span> 需生產: <strong>${produce.length}</strong></div>
      ${discontinued.length > 0 ? `<div class="order-summary-item"><span class="order-dot dot-orange"></span> 不再銷售: <strong>${discontinued.length}</strong></div>` : ''}
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
    document.getElementById('not-found-list').innerHTML = notFound.map(a => {
      const discTag = a.discontinued ? ' <span class="disc-badge">不再銷售</span>' : '';
      const discName = a.english_name ? ` - ${a.english_name.slice(0, 30)}` : '';
      return `<span class="not-found-tag ${a.discontinued ? 'not-found-disc' : ''}">${a.sku} (${fmt(a.quantity)})${discName}${discTag}</span>`;
    }).join('');
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
    const discBadge = a.discontinued ? '<span class="disc-badge" title="此型號已不再銷售">⚠ 不再銷售</span>' : '';

    let actionLine = '';
    if (type === 'produce') {
      actionLine = `<span class="neg">需生產: ${fmt(a.shortage)}</span>`;
    } else if (type === 'ship') {
      actionLine = `<span class="pos">可出貨: ${fmt(a.shortage)}</span>`;
    }

    return `
      <div class="order-item ${a.discontinued ? 'order-item-disc' : ''}" onclick="showDetail('${a.sku}')" style="cursor:pointer">
        <div class="order-item-sku">${a.sku} ${discBadge}</div>
        <div class="order-item-name">${a.name || a.english_name || ''}</div>
        <div class="order-item-nums">
          <span>訂單: <strong>${fmt(a.quantity)}</strong></span>
          <span>結餘: ${arrow} → <strong class="${newJClass}">${fmtSigned(a.newJ)}</strong></span>
        </div>
        <div class="order-item-nums">
          <span>廠庫: ${fmt(a.total_produced)}</span>
          ${actionLine}
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
  let sorted = [...analysis];
  if (state.orderSortField) {
    const field = state.orderSortField;
    const dir = state.orderSortDir === 'asc' ? 1 : -1;
    sorted.sort((a, b) => {
      let va, vb;
      if (field === 'weeks_left_w' || field === 'weeks_left_total') {
        va = a.weeks_left_w === null ? -1 : a.weeks_left_w;
        vb = b.weeks_left_w === null ? -1 : b.weeks_left_w;
      } else {
        va = a[field] ?? 0;
        vb = b[field] ?? 0;
      }
      if (typeof va === 'string') return va.localeCompare(vb) * dir;
      return (va - vb) * dir;
    });
  }

  updateOrderSortIcons();

  const tbody = document.getElementById('order-tbody');
  tbody.innerHTML = sorted.map(a => {
    let badge = '';
    if (a.status === 'safe') badge = '<span class="status-badge status-green">✓</span>';
    else if (a.status === 'ship') badge = '<span class="status-badge status-yellow">出</span>';
    else if (a.status === 'produce') badge = '<span class="status-badge status-red">產</span>';
    else badge = '<span class="status-badge" style="background:#eee;color:#999">?</span>';

    const discBadge = a.discontinued ? ' <span class="disc-badge" title="此型號已不再銷售">⚠</span>' : '';
    const pack12Badge = a.is_pack12 ? ' <span class="pack12-badge" title="G/I/L/N已從12PC包裝自動轉換為件">12PC</span>' : '';
    const rowClass = a.discontinued ? ' class="disc-row"' : '';
    const weeksInfo = a.weeks_left_w !== null ? `${fmt(a.weeks_left_w)}週` : '-';

    return `
      <tr onclick="showDetail('${a.sku}')" style="cursor:pointer"${rowClass}>
        <td>${badge}</td>
        <td><strong>${a.sku}</strong>${discBadge}${pack12Badge}</td>
        <td>${a.name || a.english_name || '-'}</td>
        <td class="num">${fmt(a.quantity)}</td>
        <td class="num ${valClass(a.j)}">${fmtSigned(a.j)}</td>
        <td class="num ${valClass(a.newJ)}"><strong>${fmtSigned(a.newJ)}</strong></td>
        <td class="num">${fmt(a.total_inv)}</td>
        <td class="num">${weeksInfo}</td>
        <td class="num ${a.shortage > 0 ? 'neg' : ''}">${a.shortage > 0 ? fmt(a.shortage) : '-'}</td>
      </tr>
    `;
  }).join('');

  if (!analysis.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--color-text-sub)">無訂單資料</td></tr>';
  }
}

function updateOrderSortIcons() {
  document.querySelectorAll('#order-table th.sortable').forEach(th => {
    const icon = th.querySelector('.sort-icon');
    if (!icon) return;
    if (th.dataset.sort === state.orderSortField) {
      icon.textContent = state.orderSortDir === 'asc' ? '▲' : '▼';
      th.classList.add('sort-active');
    } else {
      icon.textContent = '⇅';
      th.classList.remove('sort-active');
    }
  });
}

function handleOrderSort(field) {
  if (state.orderSortField === field) {
    state.orderSortDir = state.orderSortDir === 'asc' ? 'desc' : 'asc';
  } else {
    state.orderSortField = field;
    state.orderSortDir = 'desc';
  }
  renderOrderTable(state.orderAnalysis);
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

async function handleOrderFileSelect(files) {
  const fileArr = Array.from(files);
  if (!fileArr.length) return;

  for (const file of fileArr) {
    if (state.orderFiles.some(f => f.file.name === file.name)) continue;
    const orderFile = { file, headers: [], rows: [], skuCol: 0, qtyCol: 1, status: 'pending', error: '' };
    state.orderFiles.push(orderFile);
  }

  document.getElementById('order-import-result').innerHTML = '';
  document.getElementById('order-mapping-section').style.display = 'block';
  document.getElementById('order-import-confirm').disabled = true;

  await Promise.all(state.orderFiles.filter(f => f.status === 'pending').map(async (f) => {
    f.status = 'parsing';
    try {
      const ext = f.file.name.split('.').pop().toLowerCase();
      let raw;
      if (ext === 'csv') {
        const text = await f.file.text();
        raw = parseOrderCSVRaw(text);
      } else {
        const data = await f.file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        raw = parseOrderExcelRaw(workbook);
      }
      if (!raw.rows.length) {
        f.status = 'error';
        f.error = '檔案中沒有資料';
      } else {
        f.headers = raw.headers;
        f.rows = raw.rows;
        const sampleRows = raw.rows.slice(1, 6);
        const { skuCol, qtyCol } = detectColumns(raw.headers, sampleRows);
        f.skuCol = skuCol;
        f.qtyCol = qtyCol;
        f.status = 'ready';
      }
    } catch (e) {
      f.status = 'error';
      f.error = e.message;
    }
  }));

  renderOrderFileList();
  updateOrderConfirmButton();
}

function renderOrderFileList() {
  const container = document.getElementById('order-file-list');
  if (!state.orderFiles.length) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = state.orderFiles.map((f, idx) => {
    if (f.status === 'error') {
      return `
        <div class="order-file-item order-file-error">
          <div class="order-file-header">
            <strong>📄 ${f.file.name}</strong>
            <button class="btn-icon" onclick="removeOrderFile(${idx})" title="移除">✕</button>
          </div>
          <div class="order-file-error-msg">❌ ${f.error}</div>
        </div>
      `;
    }

    const options = f.headers.map((h, i) => {
      const sampleVal = f.rows[1] ? safeStr(f.rows[1][i]) : '';
      const label = h ? `${h}` : `欄位 ${i + 1}`;
      return `<option value="${i}">${label} (例: ${sampleVal.slice(0, 30)})</option>`;
    }).join('');

    const previewRows = f.rows.slice(1, 4);
    const previewHtml = previewRows.map(row =>
      `<tr>${f.headers.map((_, i) => {
        let cls = '';
        if (i === f.skuCol) cls = 'preview-col-sku';
        if (i === f.qtyCol) cls = 'preview-col-qty';
        return `<td class="${cls}">${safeStr(row[i]).slice(0, 40)}</td>`;
      }).join('')}</tr>`
    ).join('');

    return `
      <div class="order-file-item">
        <div class="order-file-header">
          <strong>📄 ${f.file.name}</strong>
          <button class="btn-icon" onclick="removeOrderFile(${idx})" title="移除">✕</button>
        </div>
        <div class="mapping-row">
          <label>SKU：</label>
          <select id="order-sku-${idx}" onchange="updateOrderFileMapping(${idx})">${options}</select>
        </div>
        <div class="mapping-row">
          <label>數量：</label>
          <select id="order-qty-${idx}" onchange="updateOrderFileMapping(${idx})">${options}</select>
        </div>
        <div class="preview-table-wrapper">
          <table class="preview-table">
            <thead><tr>${f.headers.map((h, i) => {
              let cls = '';
              if (i === f.skuCol) cls = 'preview-col-sku';
              if (i === f.qtyCol) cls = 'preview-col-qty';
              return `<th class="${cls}">${h || `欄位 ${i+1}`}</th>`;
            }).join('')}</tr></thead>
            <tbody>${previewHtml}</tbody>
          </table>
        </div>
      </div>
    `;
  }).join('');

  state.orderFiles.forEach((f, idx) => {
    if (f.status !== 'ready') return;
    const skuSel = document.getElementById(`order-sku-${idx}`);
    const qtySel = document.getElementById(`order-qty-${idx}`);
    if (skuSel) skuSel.value = f.skuCol;
    if (qtySel) qtySel.value = f.qtyCol;
  });
}

function updateOrderFileMapping(idx) {
  const f = state.orderFiles[idx];
  if (!f) return;
  f.skuCol = parseInt(document.getElementById(`order-sku-${idx}`).value);
  f.qtyCol = parseInt(document.getElementById(`order-qty-${idx}`).value);
  renderOrderFileList();
}

function removeOrderFile(idx) {
  state.orderFiles.splice(idx, 1);
  renderOrderFileList();
  updateOrderConfirmButton();
}

function updateOrderConfirmButton() {
  const hasReady = state.orderFiles.some(f => f.status === 'ready');
  document.getElementById('order-import-confirm').disabled = !hasReady;
}

function closeOrderImportModal() {
  document.getElementById('order-import-modal').style.display = 'none';
  state.orderFiles = [];
}

async function handleOrderImportConfirm() {
  const readyFiles = state.orderFiles.filter(f => f.status === 'ready');
  if (!readyFiles.length) return;
  const btn = document.getElementById('order-import-confirm');
  btn.disabled = true;
  btn.textContent = '解析中...';
  document.getElementById('order-import-result').innerHTML =
    `<div class="info-box">正在合併 ${readyFiles.length} 張訂單...</div>`;

  try {
    let allItems = [];
    for (const f of readyFiles) {
      const items = extractOrderItems(f.headers, f.rows, f.skuCol, f.qtyCol, true);
      allItems = allItems.concat(items);
    }

    if (!allItems.length) {
      document.getElementById('order-import-result').innerHTML =
        '<div class="import-result error">❌ 未找到有效訂單資料，請確認欄位對應是否正確</div>';
      btn.disabled = false;
      btn.textContent = '確認匯入';
      return;
    }

    const largeQtyItems = allItems.filter(it => it.quantity > 100000);
    if (largeQtyItems.length > 0) {
      const sample = largeQtyItems.slice(0, 3).map(it => `${it.sku}: ${fmt(it.quantity)}`).join(', ');
      document.getElementById('order-import-result').innerHTML =
        `<div class="import-result error">
          ⚠️ 偵測到 ${largeQtyItems.length} 項數量異常大（超過 10 萬）：<br>
          ${sample}<br>
          請確認數量欄位是否選擇正確。
        </div>`;
      btn.disabled = false;
      btn.textContent = '確認匯入';
      return;
    }

    const longSkuItems = allItems.filter(it => it.sku.length > 30);
    if (longSkuItems.length > allItems.length * 0.3) {
      document.getElementById('order-import-result').innerHTML =
        `<div class="import-result error">
          ⚠️ SKU 值似乎不是產品編號，而是完整產品名稱。<br>
          偵測到 ${longSkuItems.length}/${allItems.length} 項 SKU 長度超過 30 字元。<br>
          請確認 SKU 欄位是否選擇正確（應為 WU78157AA 等短編號）。
        </div>`;
      btn.disabled = false;
      btn.textContent = '確認匯入';
      return;
    }

    const aggregated = aggregateOrders(allItems);
    state.orderItems = aggregated;
    state.orderFileName = readyFiles.length === 1
      ? readyFiles[0].file.name
      : `${readyFiles.length} 張訂單合併`;
    state.orderAnalysis = analyzeOrders(aggregated);

    const produce = state.orderAnalysis.filter(a => a.status === 'produce').length;
    const ship = state.orderAnalysis.filter(a => a.status === 'ship').length;
    const safe = state.orderAnalysis.filter(a => a.status === 'safe').length;
    const nf = state.orderAnalysis.filter(a => a.status === 'not_found').length;

    document.getElementById('order-import-result').innerHTML =
      `<div class="import-result success">
        <div class="stat"><span>合併項目</span><strong>${aggregated.length}</strong></div>
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

// ===== Tour Guide =====
const tourSteps = [
  {
    target: null,
    icon: '👋',
    title: '歡迎使用',
    body: '歡迎使用 USI 庫存管理工具！這個快速教學將帶您認識所有功能。<br><br>隨時可點擊右上角的 ❓ 重新觀看。',
  },
  {
    target: '#import-btn',
    icon: '📥',
    title: '總檔更新（新貨櫃）',
    body: '<b>方法 1 — 完整大更新</b><br><br>上傳手動更新完的 USI 總檔 Excel，完整重新匯入所有資料。<br><br>適用時機：<br>• 新增型號<br>• 海上新貨櫃<br>• 欄位調整<br><br>系統會自動偵測欄位位置，不需擔心格式變動。',
  },
  {
    target: '#us-weekly-btn',
    icon: '🇺🇸',
    title: '週報更新',
    body: '<b>方法 2 — 每週更新</b><br><br>用美國傳來的 4 欄位 QuickBooks 紀錄更新庫存。<br><br>系統自動：<br>• 將目前 G/H 移至 L/M（上週快照）<br>• 填入新的 G/H/I<br>• 計算結餘 J 和週變化 P<br><br>⚠️ 此方式<b>不會更新海上新貨櫃</b>，有新貨櫃時請用「總檔更新」。',
  },
  {
    target: '.kpi-grid',
    icon: '📊',
    title: 'KPI 庫存概覽',
    body: '即時顯示庫存狀態概覽：<br><br>🔴 緊急下單 — 結餘 ≤ 0<br>🟡 需關注 — 預估 4 週內用完<br>🟢 庫存健康 — 庫存充足<br>🔵 在途貨櫃 — 海上貨櫃追蹤<br>🔍 需判斷生產 — Q&lt;60 或預估&lt;4 週<br>📦 有貨可出 — J 不足但 Q 有庫存<br>🏭 需要生產 — 總庫存預估 &lt; 13 週',
  },
  {
    target: '.table-toolbar',
    icon: '📋',
    title: '產品列表',
    body: '可搜尋產品編號或名稱，點擊欄位標題排序。<br><br>上方篩選標籤可切換狀態分類（緊急 / 注意 / 健康 / 需判斷生產 / 有貨可出 / 需要生產）。<br><br>點擊產品行左側的 ▶ 可展開詳細資訊。',
  },
  {
    target: '#order-btn',
    icon: '📋',
    title: '訂單分析',
    body: '匯入客戶訂單 Excel 或 CSV，系統自動比對庫存。<br><br>分析結果分為三種狀態：<br>🟢 安全 — 結餘充足<br>📦 需出貨 — 結餘不足但總庫存夠<br>🏭 需生產 — 結餘和總庫存都不夠',
  },
  {
    target: '#daily-order-btn',
    icon: '📝',
    title: '每日訂單',
    body: '收到 Email 訂單後，直接複製 GRID 內容貼上即可分析。<br><br>不需整理成 Excel，系統自動辨識 SKU / QTY / AMOUNT 等欄位。',
  },
  {
    target: '#export-btn',
    icon: '📊',
    title: '匯出 CSV',
    body: '將目前產品列表匯出為 CSV 檔案，方便製作報表或分享。',
  },
  {
    target: '#data-btn',
    icon: '💾',
    title: '資料管理',
    body: '管理瀏覽器中的資料：<br>• 查看資料狀態<br>• 重新初始化（重新匯入總檔）<br>• 清除所有資料',
  },
  {
    target: null,
    icon: '✅',
    title: '教學完成！',
    body: '以上就是所有功能介紹！<br><br>💡 <b>記住兩種更新方式：</b><br>1. 總檔更新 — 有新貨櫃或大改動時用<br>2. 週報更新 — 每週更新庫存數字<br><br>所有資料儲存在您的瀏覽器中，不會上傳到伺服器。<br><br>有問題隨時點擊 ❓ 重新觀看。',
  },
];

let tourCurrentStep = 0;
let tourActive = false;

function startTour() {
  tourCurrentStep = 0;
  tourActive = true;
  document.getElementById('tour-overlay').style.display = 'block';
  showTourStep(0);
}

function showTourStep(index) {
  const step = tourSteps[index];
  tourCurrentStep = index;

  document.getElementById('tour-header').innerHTML = `${step.icon} ${step.title}`;
  document.getElementById('tour-body').innerHTML = step.body;

  const dotsEl = document.getElementById('tour-dots');
  dotsEl.innerHTML = tourSteps.map((_, i) =>
    `<span class="tour-dot${i === index ? ' active' : ''}"></span>`
  ).join('');

  const prevBtn = document.getElementById('tour-prev');
  const nextBtn = document.getElementById('tour-next');
  const skipBtn = document.getElementById('tour-skip');

  prevBtn.style.display = index > 0 ? '' : 'none';
  skipBtn.style.display = index === tourSteps.length - 1 ? 'none' : '';

  if (index === tourSteps.length - 1) {
    nextBtn.textContent = '完成';
  } else {
    nextBtn.textContent = '下一步';
  }

  const tooltip = document.getElementById('tour-tooltip');
  tooltip.style.display = 'block';

  let targetEl = null;
  if (step.target) {
    targetEl = document.querySelector(step.target);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }
  }

  setTimeout(() => positionTourElements(targetEl), 350);
}

function positionTourElements(targetEl) {
  const spotlight = document.getElementById('tour-spotlight');
  const tooltip = document.getElementById('tour-tooltip');
  const tipWidth = tooltip.offsetWidth || 360;
  const tipHeight = tooltip.offsetHeight || 200;
  const margin = 14;

  if (!targetEl) {
    spotlight.style.display = 'none';
    tooltip.style.left = `${Math.max(margin, (window.innerWidth - tipWidth) / 2)}px`;
    tooltip.style.top = `${Math.max(margin, (window.innerHeight - tipHeight) / 2)}px`;
    return;
  }

  const rect = targetEl.getBoundingClientRect();
  const pad = 6;

  spotlight.style.display = 'block';
  spotlight.style.left = `${rect.left - pad}px`;
  spotlight.style.top = `${rect.top - pad}px`;
  spotlight.style.width = `${rect.width + pad * 2}px`;
  spotlight.style.height = `${rect.height + pad * 2}px`;

  let top = rect.bottom + margin;
  let left = rect.left + rect.width / 2 - tipWidth / 2;

  if (top + tipHeight > window.innerHeight - margin) {
    top = rect.top - tipHeight - margin;
  }
  if (top < margin) {
    top = Math.max(margin, rect.top);
    left = rect.right + margin;
  }
  if (left + tipWidth > window.innerWidth - margin) {
    left = rect.left - tipWidth - margin;
  }

  left = Math.max(margin, Math.min(left, window.innerWidth - tipWidth - margin));
  top = Math.max(margin, Math.min(top, window.innerHeight - tipHeight - margin));

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function repositionTour() {
  const step = tourSteps[tourCurrentStep];
  const targetEl = step.target ? document.querySelector(step.target) : null;
  positionTourElements(targetEl);
}

function nextTourStep() {
  if (tourCurrentStep < tourSteps.length - 1) {
    showTourStep(tourCurrentStep + 1);
  } else {
    closeTour();
  }
}

function prevTourStep() {
  if (tourCurrentStep > 0) {
    showTourStep(tourCurrentStep - 1);
  }
}

function closeTour() {
  tourActive = false;
  document.getElementById('tour-overlay').style.display = 'none';
  document.getElementById('tour-spotlight').style.display = 'none';
  document.getElementById('tour-tooltip').style.display = 'none';
}

// ===== Start =====
init();
