'use strict';

const state = {
  products: [],
  stats: null,
  containers: [],
  currentPage: 1,
  perPage: 50,
  sortField: 'j',
  sortDir: 'asc',
  statusFilter: '',
  prodFilter: '',
  searchQuery: '',
  selectedFile: null,
  charts: {},
};

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

function statusIcon(status) {
  if (status === 'red') return '<span class="status-badge status-red">!</span>';
  if (status === 'yellow') return '<span class="status-badge status-yellow">▲</span>';
  return '<span class="status-badge status-green">✓</span>';
}

function valClass(n) {
  if (n < 0) return 'neg';
  if (n > 0) return 'pos';
  return '';
}

async function api(path, options) {
  const res = await fetch(path, options);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function init() {
  await Promise.all([loadStats(), loadProducts(), loadContainers()]);
  renderAll();
}

async function loadStats() {
  try {
    state.stats = await api('/api/stats');
  } catch (e) { console.error(e); }
}

async function loadProducts() {
  try {
    const data = await api('/api/products');
    state.products = data.products;
  } catch (e) { console.error(e); }
}

async function loadContainers() {
  try {
    const data = await api('/api/containers');
    state.containers = data.containers;
  } catch (e) { console.error(e); }
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
    const nextEta = inTransit.map(c => c.eta).sort()[0];
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
  let data = state.products;
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
            <div class="detail-item"><div class="detail-label">未出訂單 HY</div><div class="detail-value">${fmt(d.unshipped_hy)}</div></div>
            <div class="detail-item"><div class="detail-label">未出訂單 PL</div><div class="detail-value">${fmt(d.unshipped_pl)}</div></div>
            <div class="detail-item"><div class="detail-label">未出訂單 XR</div><div class="detail-value">${fmt(d.unshipped_xr)}</div></div>
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
  renderBarChart('top-chart', state.stats.top_sellers, '#1a73e8', true);
  renderBarChart('bottom-chart', state.stats.slow_sellers, '#ea4335', false);
}

function renderBarChart(canvasId, data, color, isTop) {
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

function toggleDetail(code) {
  const row = document.getElementById(`detail-${code}`);
  if (row) row.classList.toggle('open');
}

function showDetail(code) {
  const p = state.products.find(d => d.item_code === code);
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
      <div class="detail-item"><div class="detail-label">未出訂單 HY</div><div class="detail-value">${fmt(p.unshipped_hy)}</div></div>
      <div class="detail-item"><div class="detail-label">未出訂單 PL</div><div class="detail-value">${fmt(p.unshipped_pl)}</div></div>
      <div class="detail-item"><div class="detail-label">未出訂單 XR</div><div class="detail-value">${fmt(p.unshipped_xr)}</div></div>
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

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    if (tab.dataset.prod !== undefined) {
      document.querySelectorAll('.tab[data-prod]').forEach(t => {
        if (t.dataset.prod !== '') t.classList.remove('active');
      });
      if (tab.dataset.prod !== '') {
        tab.classList.add('active');
      }
      state.prodFilter = tab.dataset.prod || '';
    } else {
      document.querySelectorAll('.tab[data-status]').forEach(t => {
        if (t.dataset.status !== '' || t.dataset.status === undefined) {
          if (t.dataset.prod === undefined || t.dataset.prod === '') t.classList.remove('active');
        }
      });
      tab.classList.add('active');
      state.statusFilter = tab.dataset.status || '';
    }
    state.currentPage = 1;
    renderTable();
  });
});

document.getElementById('search-input').addEventListener('input', (e) => {
  state.searchQuery = e.target.value;
  state.currentPage = 1;
  renderTable();
});

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

// Import modal
document.getElementById('import-btn').addEventListener('click', () => {
  document.getElementById('import-modal').style.display = 'flex';
  document.getElementById('import-result').innerHTML = '';
  document.getElementById('import-confirm').disabled = true;
  state.selectedFile = null;
});

document.getElementById('import-close').addEventListener('click', closeImportModal);
document.getElementById('import-cancel').addEventListener('click', closeImportModal);

function closeImportModal() {
  document.getElementById('import-modal').style.display = 'none';
  state.selectedFile = null;
}

document.getElementById('drop-zone').addEventListener('click', () => {
  document.getElementById('file-input').click();
});

document.getElementById('file-input').addEventListener('change', (e) => {
  if (e.target.files.length) {
    handleFileSelect(e.target.files[0]);
  }
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
  if (e.dataTransfer.files.length) {
    handleFileSelect(e.dataTransfer.files[0]);
  }
});

function handleFileSelect(file) {
  state.selectedFile = file;
  document.getElementById('import-result').innerHTML =
    `<div class="info-box">已選擇: <strong>${file.name}</strong> (${(file.size / 1024).toFixed(1)} KB)</div>`;
  document.getElementById('import-confirm').disabled = false;
}

document.getElementById('import-confirm').addEventListener('click', async () => {
  if (!state.selectedFile) return;
  const btn = document.getElementById('import-confirm');
  btn.disabled = true;
  btn.textContent = '匯入中...';
  document.getElementById('import-result').innerHTML =
    '<div class="info-box">正在處理，請稍候...</div>';

  const formData = new FormData();
  formData.append('file', state.selectedFile);

  try {
    const res = await fetch('/api/import', { method: 'POST', body: formData });
    const data = await res.json();
    if (data.error) {
      document.getElementById('import-result').innerHTML =
        `<div class="import-result error">❌ ${data.error}</div>`;
      btn.disabled = false;
      btn.textContent = '確認匯入';
      return;
    }
    document.getElementById('import-result').innerHTML =
      `<div class="import-result success">
        <div class="stat"><span>匯入日期</span><strong>${data.date}</strong></div>
        <div class="stat"><span>檔案名稱</span><strong>${data.filename}</strong></div>
        <div class="stat"><span>總項目數</span><strong>${fmt(data.total_items)}</strong></div>
        <div class="stat"><span>更新項目</span><strong>${fmt(data.updated_items)}</strong></div>
        <div class="stat"><span>新增項目</span><strong>${fmt(data.new_items)}</strong></div>
      </div>
      <p style="margin-top:12px;color:var(--color-green)">✓ 匯入成功！頁面將自動刷新...</p>`;
    btn.textContent = '完成';
    setTimeout(async () => {
      closeImportModal();
      btn.disabled = false;
      btn.textContent = '確認匯入';
      await init();
    }, 2000);
  } catch (e) {
    document.getElementById('import-result').innerHTML =
      `<div class="import-result error">❌ 匯入失敗: ${e.message}</div>`;
    btn.disabled = false;
    btn.textContent = '確認匯入';
  }
});

document.getElementById('detail-close').addEventListener('click', () => {
  document.getElementById('detail-modal').style.display = 'none';
});

document.getElementById('export-btn').addEventListener('click', () => {
  window.location.href = '/api/export';
});

async function deleteContainer(cid) {
  if (!confirm('確認此貨櫃已到貨並移除？')) return;
  await fetch(`/api/containers/${cid}`, { method: 'DELETE' });
  await loadContainers();
  renderContainers();
  renderKPIs();
}

init();
