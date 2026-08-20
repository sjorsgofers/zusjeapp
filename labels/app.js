// ===== STATE =====
const state = {
  products: [],
  allergens: [],         // [{key, nl}, ...] uit /api/allergens
  search: '',
  activeLetter: '',      // '' = alles, 'A'-'Z' = filter
  view: 'print',
  editingProduct: null,
  modalAllergenState: [], // array of 0-3 values, length = state.allergens.length
};

// ===== HELPERS =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// API-basis: leeg = zelfde host (lokaal op de werk-PC). Op GitHub Pages wordt
// window.LABELS_API_BASE gezet naar de Tailscale-tunnel-URL van de werk-PC.
const API_BASE = (typeof window !== 'undefined' && window.LABELS_API_BASE) || '';

async function api(path, opts = {}) {
  const res = await fetch(API_BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Onbekende fout' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

function toast(msg, type = 'ok', ms = 2200) {
  const el = $('#toast');
  el.textContent = msg;
  el.className = `toast show ${type}`;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.className = 'toast'; }, ms);
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Parse allergens CSV -> array van 14 numbers (0-3)
function parseAllergens(csv) {
  if (!csv) return new Array(state.allergens.length).fill(0);
  const parts = String(csv).split(',').map(n => Number(n));
  while (parts.length < state.allergens.length) parts.push(0);
  return parts.slice(0, state.allergens.length);
}

function getBevat(csv) {
  const arr = parseAllergens(csv);
  return state.allergens.filter((a, i) => arr[i] === 3).map(a => a.nl);
}
function getSporen(csv) {
  const arr = parseAllergens(csv);
  return state.allergens.filter((a, i) => arr[i] === 2).map(a => a.nl);
}

// ===== PRINTER STATUS =====
async function refreshPrinterStatus() {
  const pill = $('#printer-pill');
  try {
    const status = await api('/api/printer/status');
    if (status.available) {
      pill.className = 'printer-pill ok';
      pill.querySelector('.label').textContent = 'Printer OK';
      pill.title = `Verbonden: ${status.printerName}`;
    } else {
      pill.className = 'printer-pill error';
      pill.querySelector('.label').textContent = 'Geen printer';
      pill.title = `Niet gevonden: ${status.configuredName}. Beschikbaar: ${(status.allPrinters || []).join(', ') || 'geen'}`;
    }
  } catch (err) {
    pill.className = 'printer-pill error';
    pill.querySelector('.label').textContent = 'Status?';
    pill.title = err.message;
  }
}

// ===== DATA LOAD =====
async function loadData() {
  const [products, allergens] = await Promise.all([
    api('/api/products'),
    api('/api/allergens'),
  ]);
  state.products = products;
  state.allergens = allergens;
}

// ===== RENDER: ALFABET =====
function renderAlphabet() {
  const bar = $('#alphabet');
  // Welke letters hebben producten?
  const letters = new Set(state.products.map(p => (p.name?.[0] || '').toUpperCase()).filter(Boolean));
  const all = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const html = [
    `<button class="alpha all ${state.activeLetter === '' ? 'active' : ''}" data-letter="">Alles</button>`,
    ...all.map(L => {
      const has = letters.has(L);
      return `<button class="alpha ${state.activeLetter === L ? 'active' : ''}" data-letter="${L}" ${has ? '' : 'disabled'}>${L}</button>`;
    }),
  ].join('');
  bar.innerHTML = html;
  bar.querySelectorAll('.alpha').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      state.activeLetter = btn.dataset.letter;
      renderAlphabet();
      renderProductGrid();
    });
  });
}

// ===== RENDER: PRINT GRID =====
function filteredProducts() {
  const q = state.search.toLowerCase().trim();
  return state.products.filter(p => {
    if (state.activeLetter && (p.name?.[0] || '').toUpperCase() !== state.activeLetter) return false;
    if (q && !p.name.toLowerCase().includes(q)) return false;
    return true;
  });
}

function renderProductGrid() {
  const grid = $('#product-grid');
  const empty = $('#empty-print');
  const items = filteredProducts();
  if (items.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  grid.innerHTML = items.map(p => {
    const bevat = getBevat(p.allergens);
    const sporen = getSporen(p.allergens);
    const chips = [];
    const MAX = 3;
    bevat.slice(0, MAX).forEach(a => chips.push(`<span class="a-chip">${escapeHtml(a)}</span>`));
    const overflow = bevat.length - MAX;
    if (overflow > 0) chips.push(`<span class="a-chip more">+${overflow}</span>`);
    if (bevat.length === 0 && sporen.length > 0) {
      sporen.slice(0, MAX).forEach(a => chips.push(`<span class="a-chip sporen">${escapeHtml(a)}</span>`));
    }
    return `
      <button class="card" data-id="${p.id}">
        <div>
          <div class="name">${escapeHtml(p.name)}</div>
          <div class="meta">${p.shelf_life_days} ${p.shelf_life_days === 1 ? 'dag' : 'dagen'} houdbaar</div>
        </div>
        ${chips.length ? `<div class="allergens">${chips.join('')}</div>` : ''}
      </button>
    `;
  }).join('');
  grid.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', () => handlePrint(card));
  });
}

// ===== PRINT HANDLERS =====
// ===== MULTIPLIER STATE =====
// Volgende print-actie gebruikt dit aantal en reset daarna naar 1.
let pendingMultiplier = 1;

function setPendingMultiplier(n) {
  pendingMultiplier = Math.max(1, Math.min(50, Number(n) || 1));
  updateMultiplierUI();
}
function consumeMultiplier() {
  const n = pendingMultiplier;
  pendingMultiplier = 1;
  updateMultiplierUI();
  return n;
}
function updateMultiplierUI() {
  const btn = $('#btn-multi');
  const banner = $('#multi-banner');
  if (!btn) return;
  if (pendingMultiplier > 1) {
    btn.classList.add('armed');
    btn.querySelector('.multi-x').textContent = `${pendingMultiplier}×`;
    btn.querySelector('.multi-label').textContent = 'klaar';
    if (banner) {
      banner.classList.remove('hidden');
      $('#multi-banner-count').textContent = `${pendingMultiplier}×`;
      $('#multi-banner-num').textContent = pendingMultiplier;
    }
  } else {
    btn.classList.remove('armed');
    btn.querySelector('.multi-x').textContent = '×';
    btn.querySelector('.multi-label').textContent = 'aantal';
    if (banner) banner.classList.add('hidden');
  }
}

async function printDateSticker({ heading = 'Geopend', btnEl = null } = {}) {
  if (btnEl && btnEl.classList.contains('printing')) return;
  if (btnEl) btnEl.classList.add('printing');
  const count = consumeMultiplier();
  try {
    const result = await api('/api/print/date', {
      method: 'POST',
      body: { heading, count },
    });
    if (btnEl) {
      btnEl.classList.remove('printing');
      btnEl.classList.add('flash');
      setTimeout(() => btnEl.classList.remove('flash'), 1000);
    }
    const label =
      count > 1
        ? `${count}× geprint · "${heading}: ${result.dateStr}"`
        : `Geprint · "${heading}: ${result.dateStr}"`;
    toast(label, 'ok');
    return true;
  } catch (err) {
    if (btnEl) btnEl.classList.remove('printing');
    toast(err.message, 'error', 4000);
    refreshPrinterStatus();
    return false;
  }
}

function handlePrintDate() {
  return printDateSticker({ heading: 'Geopend', btnEl: $('#date-hero') });
}

function handlePrintUitgehaald() {
  return printDateSticker({ heading: 'Uitgehaald op', btnEl: $('#btn-uitgehaald') });
}

function handlePrintGeopend() {
  return printDateSticker({ heading: 'Geopend op', btnEl: $('#btn-geopend') });
}

// ===== AANTAL-KIEZER MODAL =====
// Tik × → kies aantal → de volgende knop-tik (product/datumknop) print N keer.
let multiQty = 5;

function openMultiModal() {
  // Als hij al armed is: klik op × annuleert
  if (pendingMultiplier > 1) {
    setPendingMultiplier(1);
    toast('Aantal geannuleerd', 'ok', 1500);
    return;
  }
  multiQty = 5;
  syncMultiUI();
  $('#modal-multi').classList.remove('hidden');
  setTimeout(() => $('#mf-qty').focus(), 50);
}

function closeMultiModal() {
  $('#modal-multi').classList.add('hidden');
}

function syncMultiUI() {
  $('#mf-qty').value = multiQty;
  $$('#mf-quick button').forEach((b) =>
    b.classList.toggle('active', Number(b.dataset.qty) === multiQty)
  );
}

function confirmMulti() {
  const n = Math.max(1, Math.min(50, Number($('#mf-qty').value) || 1));
  closeMultiModal();
  setPendingMultiplier(n);
  toast(`Aantal: ${n}× — tik een knop om te printen`, 'ok', 2500);
}

// ===== DATE HERO =====
const DAYS_NL = ['zondag','maandag','dinsdag','woensdag','donderdag','vrijdag','zaterdag'];
const MONTHS_NL = ['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'];

function updateDateHero() {
  const now = new Date();
  const main = `${now.getDate()} ${MONTHS_NL[now.getMonth()]} ${now.getFullYear()}`;
  const day = DAYS_NL[now.getDay()];
  $('#hero-date-main').textContent = main;
  $('#hero-date-day').textContent = day;
}

async function handlePrint(cardEl) {
  if (cardEl.classList.contains('printing')) return;
  const id = Number(cardEl.dataset.id);
  const count = consumeMultiplier();
  cardEl.classList.add('printing');
  try {
    const result = await api('/api/print', { method: 'POST', body: { product_id: id, count } });
    cardEl.classList.remove('printing');
    cardEl.classList.add('flash');
    setTimeout(() => cardEl.classList.remove('flash'), 900);
    const msg = count > 1 ? `${count}× geprint: ${result.product}` : `Geprint: ${result.product}`;
    toast(msg, 'ok');
  } catch (err) {
    cardEl.classList.remove('printing');
    toast(err.message, 'error', 4000);
    refreshPrinterStatus();
  }
}

// ===== RENDER: MANAGE =====
function renderProductList() {
  const list = $('#product-list');
  const countEl = $('#product-count');
  if (countEl) countEl.textContent = state.products.length;
  if (state.products.length === 0) {
    list.innerHTML = '<p class="empty">Nog geen producten.</p>';
    return;
  }
  list.innerHTML = state.products.map(p => {
    const bevat = getBevat(p.allergens);
    const sporen = getSporen(p.allergens);
    const aSummary = [];
    if (bevat.length) aSummary.push(`bevat: ${bevat.join(', ')}`);
    if (sporen.length) aSummary.push(`sporen: ${sporen.join(', ')}`);
    return `
      <div class="row">
        <div class="info">
          <div class="name">${escapeHtml(p.name)}</div>
          <div class="sub">${p.shelf_life_days} ${p.shelf_life_days === 1 ? 'dag' : 'dagen'}${aSummary.length ? ` · <span class="extra-tag">${escapeHtml(aSummary.join(' · '))}</span>` : ''}</div>
        </div>
        <div class="row-actions">
          <button class="btn btn-ghost btn-sm" data-edit="${p.id}">Bewerken</button>
          <button class="btn btn-danger btn-sm" data-del="${p.id}">Verwijderen</button>
        </div>
      </div>`;
  }).join('');

  list.querySelectorAll('[data-edit]').forEach(btn =>
    btn.addEventListener('click', () => openProductModal(Number(btn.dataset.edit)))
  );
  list.querySelectorAll('[data-del]').forEach(btn =>
    btn.addEventListener('click', () => deleteProduct(Number(btn.dataset.del)))
  );
}

// ===== PRODUCT MODAL =====
const STATE_LABELS = { 0: '', 1: 'Onbekend', 2: 'Sporen', 3: 'Bevat' };
const NEXT_STATE = { 0: 3, 3: 2, 2: 1, 1: 0 }; // klik-cyclus

function renderAllergenGrid() {
  const grid = $('#pf-allergens');
  grid.innerHTML = state.allergens.map((a, i) => {
    const s = state.modalAllergenState[i] ?? 0;
    return `<button type="button" class="allergen-toggle" data-state="${s}" data-idx="${i}">
      <span class="name">${escapeHtml(a.nl)}</span>
      <span class="state">${STATE_LABELS[s]}</span>
    </button>`;
  }).join('');
  grid.querySelectorAll('.allergen-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = Number(btn.dataset.idx);
      const cur = state.modalAllergenState[i] ?? 0;
      state.modalAllergenState[i] = NEXT_STATE[cur];
      renderAllergenGrid();
    });
  });
}

function openProductModal(id = null) {
  state.editingProduct = id;
  const product = id ? state.products.find(p => p.id === id) : null;
  $('#modal-product-title').textContent = product ? 'Product bewerken' : 'Nieuw product';
  $('#pf-name').value = product?.name || '';
  $('#pf-days').value = product?.shelf_life_days ?? 3;
  $('#pf-custom').value = product?.custom_text || '';
  state.modalAllergenState = parseAllergens(product?.allergens);
  renderAllergenGrid();
  $('#modal-product').classList.remove('hidden');
  setTimeout(() => $('#pf-name').focus(), 50);
}

function closeProductModal() {
  $('#modal-product').classList.add('hidden');
  state.editingProduct = null;
}

async function saveProduct() {
  const name = $('#pf-name').value.trim();
  const daysRaw = $('#pf-days').value;
  const days = daysRaw === '' ? 0 : Math.max(0, Number(daysRaw) || 0);
  const allergens = state.modalAllergenState.join(',');
  const custom_text = $('#pf-custom').value.trim();

  if (!name) return toast('Naam is verplicht', 'error');
  if (daysRaw === '') return toast('Voer 0 of meer dagen in', 'error');

  const payload = { name, shelf_life_days: days, allergens, custom_text };
  try {
    if (state.editingProduct) {
      await api(`/api/products/${state.editingProduct}`, { method: 'PUT', body: payload });
      toast('Product bijgewerkt');
    } else {
      await api('/api/products', { method: 'POST', body: payload });
      toast('Product toegevoegd');
    }
    closeProductModal();
    await loadData();
    renderAll();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function deleteProduct(id) {
  const p = state.products.find(x => x.id === id);
  if (!p) return;
  if (!confirm(`"${p.name}" verwijderen?`)) return;
  try {
    await api(`/api/products/${id}`, { method: 'DELETE' });
    toast('Product verwijderd');
    await loadData();
    renderAll();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ===== VIEW SWITCHING (via dropdown onder logo) =====
function switchView(view) {
  state.view = view;
  $$('.view-option').forEach(t => t.classList.toggle('active', t.dataset.view === view));
  $$('.view').forEach(v => v.classList.toggle('active', v.id === `view-${view}`));
  closeViewDropdown();
  // Bij wisselen naar controle-view: data laden
  if (view === 'check') loadCheckList();
}

function openViewDropdown() {
  $('#view-dropdown').classList.remove('hidden');
  $('#brand-btn').setAttribute('aria-expanded', 'true');
}
function closeViewDropdown() {
  $('#view-dropdown').classList.add('hidden');
  $('#brand-btn').setAttribute('aria-expanded', 'false');
}
function toggleViewDropdown(e) {
  e?.stopPropagation();
  const open = $('#view-dropdown').classList.contains('hidden');
  if (open) openViewDropdown(); else closeViewDropdown();
}

function renderAll() {
  renderAlphabet();
  renderProductGrid();
  renderProductList();
}

// ===== CONTROLE-LIJST =====
let checkDaysAgo = 2;

async function loadCheckList() {
  try {
    const data = await api(`/api/check-list?daysAgo=${checkDaysAgo}`);
    renderCheckList(data);
  } catch (err) {
    toast('Kon controle-lijst niet laden: ' + err.message, 'error', 4000);
  }
}

function renderCheckList(data) {
  const list = $('#check-list');
  const empty = $('#check-empty');
  const info = $('#check-date-info');

  // Datum mooi weergeven: "Maandag 25 mei 2026"
  const d = parseLocalDate(data.date);
  const niceDate = `${capitalize(DAYS_NL[d.getDay()])} ${d.getDate()} ${MONTHS_NL[d.getMonth()]} ${d.getFullYear()}`;
  const productCount = data.items.length;
  const totalPrints = data.items.reduce((sum, it) => sum + (it.print_count || 0), 0);

  if (productCount === 0) {
    info.innerHTML = `<span class="count">0</span> producten geprint op <strong>${niceDate}</strong>`;
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  info.innerHTML = `<span class="count">${productCount}</span> producten geprint op <strong>${niceDate}</strong> (totaal ${totalPrints} label${totalPrints === 1 ? '' : 's'})`;

  list.innerHTML = data.items.map((it) => {
    const bevat = getBevat(it.allergens);
    const firstTime = formatTime(it.first_printed_at);
    const lastTime = formatTime(it.last_printed_at);
    const timesInfo =
      it.print_count > 1
        ? `${it.print_count}× geprint · van ${firstTime} tot ${lastTime}`
        : `om ${firstTime}`;
    return `
      <div class="row check-row">
        <div class="info">
          <div class="name">${escapeHtml(it.product_name)}</div>
          <div class="sub">${timesInfo}</div>
          ${bevat.length ? `<div class="allergen-mini">Bevat: ${escapeHtml(bevat.join(', '))}</div>` : ''}
        </div>
        ${it.print_count > 1 ? `<span class="count-badge">${it.print_count}×</span>` : ''}
      </div>
    `;
  }).join('');
}

function parseLocalDate(str) {
  // str is "YYYY-MM-DD"
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }
function formatTime(isoStr) {
  if (!isoStr) return '?';
  const d = new Date(isoStr.replace(' ', 'T') + 'Z'); // SQLite UTC format
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

// ===== INIT =====
function init() {
  // Brand dropdown
  $('#brand-btn').addEventListener('click', toggleViewDropdown);
  $$('.view-option').forEach(opt =>
    opt.addEventListener('click', () => switchView(opt.dataset.view))
  );
  // Klik buiten dropdown sluit hem
  document.addEventListener('click', (e) => {
    const dd = $('#view-dropdown');
    if (dd.classList.contains('hidden')) return;
    if (!e.target.closest('.brand-wrap')) closeViewDropdown();
  });

  $('#search').addEventListener('input', e => {
    state.search = e.target.value;
    renderProductGrid();
  });

  $('#btn-new-product').addEventListener('click', () => openProductModal());

  $('#date-hero').addEventListener('click', handlePrintDate);
  $('#btn-geopend').addEventListener('click', handlePrintGeopend);
  $('#btn-uitgehaald').addEventListener('click', handlePrintUitgehaald);
  $('#btn-multi').addEventListener('click', openMultiModal);
  updateDateHero();
  setInterval(updateDateHero, 30 * 60 * 1000);

  $('#pf-save').addEventListener('click', saveProduct);
  $('#pf-cancel').addEventListener('click', closeProductModal);

  // Controle-lijst: dagen-knoppen
  $$('#check-days button').forEach((b) =>
    b.addEventListener('click', () => {
      checkDaysAgo = Number(b.dataset.days);
      $$('#check-days button').forEach((x) =>
        x.classList.toggle('active', Number(x.dataset.days) === checkDaysAgo)
      );
      loadCheckList();
    })
  );

  // Multi modal wiring
  $('#mf-cancel').addEventListener('click', closeMultiModal);
  $('#mf-print').addEventListener('click', confirmMulti);

  // Banner annuleren
  $('#multi-banner-cancel').addEventListener('click', () => {
    setPendingMultiplier(1);
    toast('Aantal geannuleerd', 'ok', 1500);
  });
  $$('#mf-quick button').forEach((b) =>
    b.addEventListener('click', () => {
      multiQty = Number(b.dataset.qty);
      syncMultiUI();
    })
  );
  $('#mf-qty').addEventListener('input', (e) => {
    multiQty = Math.max(1, Math.min(50, Number(e.target.value) || 1));
    $$('#mf-quick button').forEach((b) =>
      b.classList.toggle('active', Number(b.dataset.qty) === multiQty)
    );
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeProductModal();
      closeMultiModal();
      closeViewDropdown();
    }
  });

  $$('.modal').forEach(m =>
    m.addEventListener('click', e => {
      if (e.target === m) m.classList.add('hidden');
    })
  );

  loadData()
    .then(renderAll)
    .catch(err => toast('Kon data niet laden: ' + err.message, 'error', 5000));
  refreshPrinterStatus();
  setInterval(refreshPrinterStatus, 15000);
}

document.addEventListener('DOMContentLoaded', init);
