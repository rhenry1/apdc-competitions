// APDC — shared schedule template engine for competition pages.
// Reads a page-local `COMPETITION_CONFIG` + `SCHEDULE` (day key -> ordered list of
// { type: 'routine' | 'meta' | 'awards' | 'category', ... }) and renders the
// filterable, searchable schedule UI. Requires assets/icons.js.
//
// TO USE FOR A NEW COMPETITION: define COMPETITION_CONFIG + SCHEDULE in the page,
// include the shared markup (header/filter-bar/offset-bar/main), then load this file.

const STYLE_CLASS = {
  'Jazz': 'style-jazz', 'Contemporary': 'style-contemporary',
  'Lyrical': 'style-lyrical', 'Hip-Hop': 'style-hiphop',
  'Tap': 'style-tap', 'Musical Theater': 'style-musical', 'Open': 'style-open'
};

const OFFSET_KEY = 'apdc-schedule-offset';

let allRoutines = [];
let allDancers = [];
let allStudios = [];

function collectRoutines() {
  const out = [];
  COMPETITION_CONFIG.dayButtons.forEach(({ key }) => {
    (SCHEDULE[key] || []).forEach(item => {
      if (item.type === 'routine') out.push({ ...item, day: key });
    });
  });
  return out;
}

function buildDancerList() {
  const set = new Set();
  allRoutines.forEach(r => r.dancers.split(',').map(s => s.trim()).filter(Boolean).forEach(n => set.add(n)));
  allDancers = [...set].sort();
}

function buildStudioList() {
  const set = new Set();
  allRoutines.forEach(r => { if (r.studio) set.add(r.studio); });
  allStudios = [...set].sort();
}

function renderRoutineCard(r, dayKey) {
  const cardClass = r.isApdc
    ? [r.spotlight && r.props ? 'quinn-and-props' : r.props ? 'props-only' : r.spotlight ? 'quinn-only' : 'normal', 'apdc-card'].join(' ')
    : (r.spotlight && r.props ? 'quinn-and-props' : r.props ? 'props-only' : r.spotlight ? 'quinn-only' : 'normal');

  const styleClass = STYLE_CLASS[r.style] || '';
  const card = document.createElement('div');
  card.className = `routine-card ${cardClass}`;
  card.dataset.quinn   = String(r.spotlight);
  card.dataset.props   = String(r.props);
  card.dataset.dancers = r.dancers;
  card.dataset.level   = r.level;
  card.dataset.format  = r.format;
  card.dataset.studio  = r.studio;
  card.dataset.day     = dayKey;

  const stageTag  = r.stage ? `<span class="tag stage-${r.stage}">Stage ${r.stage}</span>` : '';
  const styleTag  = r.style ? `<span class="tag ${styleClass}">${r.style}</span>` : '';
  const fmtTag    = r.formatTag ? `<span class="tag">${r.formatTag}</span>` : '';
  const propsIcon = r.props ? ` <span class="props-icon">${ICONS.props}</span>` : '';
  const apdcBadge = r.isApdc ? '<span class="apdc-badge">APDC</span>' : '';
  const entryNum  = r.entry ? `<div class="entry-num">#${r.entry}</div>` : '';

  card.innerHTML = `
    <div class="card-time" data-orig-time="${r.time}">${r.time}</div>
    <div class="card-main">
      ${entryNum}<div class="card-title">${r.title}${propsIcon}${apdcBadge}</div>
      <div class="card-meta">${stageTag}${styleTag}${fmtTag}</div>
      <div class="card-dancers">${r.dancers}</div>
    </div>
    <div class="card-right"><span class="age-badge">${r.ageLabel}</span></div>
  `;
  return card;
}

function buildSchedule() {
  document.getElementById('header-title').textContent    = COMPETITION_CONFIG.name;
  document.getElementById('header-subtitle').textContent = COMPETITION_CONFIG.subtitle;

  const dayRow = document.getElementById('day-filter-row');
  COMPETITION_CONFIG.dayButtons.forEach(btn => {
    const el = document.createElement('button');
    el.className = 'btn day-btn';
    el.dataset.day = btn.key;
    el.setAttribute('aria-pressed', 'false');
    el.textContent = btn.label;
    dayRow.appendChild(el);
  });

  const container = document.getElementById('schedule-container');
  container.innerHTML = '';

  COMPETITION_CONFIG.dayButtons.forEach(({ key }) => {
    const items = SCHEDULE[key];
    if (!items || items.length === 0) return;

    const dayConf = COMPETITION_CONFIG.days[key] || {};
    const section = document.createElement('div');
    section.className = 'day-section';
    section.setAttribute('data-day', key);
    section.innerHTML = `
      <div class="day-header">
        <div class="day-label">${ICONS.sparkle}${dayConf.label || ''}</div>
        <div class="day-title">${dayConf.title || key}</div>
        <div class="day-count">${dayConf.count || ''}</div>
      </div>
    `;

    items.forEach(item => {
      if (item.type === 'routine') {
        section.appendChild(renderRoutineCard(item, key));
      } else if (item.type === 'category') {
        const cat = document.createElement('div');
        cat.className = 'battle-category';
        if (item.teal) cat.style.cssText = 'color:#67e8f9;border-bottom-color:rgba(103,232,249,0.2);margin-top:20px;';
        cat.textContent = item.text;
        section.appendChild(cat);
      } else {
        const row = document.createElement('div');
        row.className = 'meta-row' + (item.type === 'awards' ? ' awards' : '');
        row.innerHTML = item.type === 'awards' ? `${ICONS.trophy} ${item.text}` : item.text;
        section.appendChild(row);
      }
    });

    container.appendChild(section);
  });

  window._cards    = document.querySelectorAll('.routine-card');
  window._sections = document.querySelectorAll('.day-section');
  window._metaRows  = document.querySelectorAll('.meta-row');

  document.querySelectorAll('.day-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setActiveInGroup(document.querySelectorAll('.day-btn'), btn);
      activeDay = btn.dataset.day;
      applyFilters();
    });
  });

  allRoutines = collectRoutines();
  buildDancerList();
  buildStudioList();
}

// ── State ──
let activeFilter  = 'all';
let activeDay     = 'all';
let activeDancers = [];
let activeStudios = [];
let activeLevel   = '';
let activeFormat  = '';
let offsetMinutes = 0;

// ── Element refs ──
const showBtns       = document.querySelectorAll('.show-btn');
const catBtns        = document.querySelectorAll('.cat-btn');
const callout        = document.getElementById('quinn-callout');
const calloutHeader  = document.getElementById('callout-header');
const calloutSched   = document.getElementById('callout-schedule');
const noResults      = document.getElementById('no-results');
const dancerInput    = document.getElementById('dancer-input');
const dancerDropdown = document.getElementById('dancer-dropdown');
const pillWrap       = document.getElementById('dancer-pill-wrap');
const pillRow        = document.getElementById('pill-row');
const clearAllBtn    = document.getElementById('clear-all-btn');
const studioInput    = document.getElementById('studio-input');
const studioDropdown = document.getElementById('studio-dropdown');
const studioPillWrap = document.getElementById('studio-pill-wrap');
const studioClearBtn = document.getElementById('studio-clear-btn');
const offsetBtns     = document.querySelectorAll('.offset-btn');
const offsetStatus   = document.getElementById('offset-status');

function setActiveInGroup(nodeList, activeEl) {
  nodeList.forEach(b => {
    const on = b === activeEl;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', String(on));
  });
}

// ── Apply filters ──
function applyFilters() {
  const cards    = window._cards    || document.querySelectorAll('.routine-card');
  const sections = window._sections || document.querySelectorAll('.day-section');
  const metaRows = window._metaRows || document.querySelectorAll('.meta-row');
  const hasDancers = activeDancers.length > 0;
  let visible = 0;

  sections.forEach(sec => {
    const secDay = sec.getAttribute('data-day') || '';
    const show = activeDay === 'all' || secDay === activeDay;
    sec.style.display = show ? '' : 'none';
    sec.classList.toggle('hidden', !show);
  });

  cards.forEach(card => {
    const sec      = card.closest('.day-section');
    const secDay   = sec ? (sec.getAttribute('data-day') || '') : '';
    const dayMatch = activeDay === 'all' || secDay === activeDay;
    const dancers  = card.dataset.dancers || '';
    const isProps  = card.dataset.props === 'true';

    let showMatch = false;
    if (hasDancers)                    showMatch = activeDancers.some(n => dancers.toLowerCase().includes(n.toLowerCase()));
    else if (activeFilter === 'all')   showMatch = true;
    else if (activeFilter === 'props') showMatch = isProps;

    const levelMatch  = !activeLevel  || card.dataset.level  === activeLevel;
    const formatMatch = !activeFormat || card.dataset.format === activeFormat;
    const studioMatch = activeStudios.length === 0 ||
      activeStudios.some(s => (card.dataset.studio || '').toLowerCase() === s.toLowerCase());

    const show = dayMatch && showMatch && levelMatch && formatMatch && studioMatch;
    card.classList.toggle('hidden', !show);
    if (show) visible++;
  });

  metaRows.forEach(row => {
    const sec      = row.closest('.day-section');
    const secDay   = sec ? (sec.getAttribute('data-day') || '') : '';
    const dayMatch = activeDay === 'all' || secDay === activeDay;
    row.classList.toggle('hidden', hasDancers || activeFilter !== 'all' || !dayMatch);
  });

  renderCallout();
  noResults.style.display = visible === 0 ? 'block' : 'none';
}

// ── Callout ──
function renderCallout() {
  if (activeDancers.length === 0) { callout.style.display = 'none'; return; }
  const dayIndex = {};
  COMPETITION_CONFIG.dayButtons.forEach((b, i) => dayIndex[b.key] = i);
  const seen = new Set();
  const entries = allRoutines
    .filter(r => activeDancers.some(n => r.dancers.toLowerCase().includes(n.toLowerCase())))
    .filter(r => { const k = r.day + r.time + r.title; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => (dayIndex[a.day] ?? 99) - (dayIndex[b.day] ?? 99));

  calloutHeader.innerHTML = ICONS.sparkle + (activeDancers.length === 1
    ? 'All routines for ' + activeDancers[0]
    : 'All routines for selected dancers');
  calloutSched.innerHTML = '';
  entries.forEach(r => {
    const dayTitle = (COMPETITION_CONFIG.days[r.day] || {}).title || r.day;
    const item = document.createElement('div');
    item.className = 'quinn-item';
    item.innerHTML = `<div class="quinn-item-title">${r.title}${r.props ? ' ' + ICONS.props : ''}</div>
      <div class="quinn-item-meta">${dayTitle} · ${r.time}${r.stage ? ' · Stage ' + r.stage : ''}</div>`;
    calloutSched.appendChild(item);
  });
  callout.style.display = entries.length > 0 ? '' : 'none';
}

// ── Dancer search ──
function renderDancerDropdown(q) {
  const query = q.trim().toLowerCase();
  const avail = allDancers.filter(n => !activeDancers.includes(n));
  const matches = query ? avail.filter(n => n.toLowerCase().includes(query)) : avail;
  dancerDropdown.innerHTML = matches.length === 0
    ? '<div class="dropdown-empty">No dancers found</div>'
    : matches.map(n => {
        const idx = query ? n.toLowerCase().indexOf(query) : -1;
        const label = idx >= 0
          ? n.slice(0,idx) + '<mark>' + n.slice(idx,idx+query.length) + '</mark>' + n.slice(idx+query.length)
          : n;
        return `<div class="dropdown-item" data-name="${n}">${label}</div>`;
      }).join('');
  dancerDropdown.classList.add('open');
  dancerDropdown.querySelectorAll('.dropdown-item').forEach(d => {
    d.addEventListener('mousedown', e => { e.preventDefault(); addDancer(d.dataset.name); });
    d.addEventListener('touchstart', e => { e.preventDefault(); addDancer(d.dataset.name); }, { passive: false });
  });
}

function addDancer(name) {
  if (activeDancers.includes(name)) { dancerDropdown.classList.remove('open'); dancerInput.value = ''; dancerInput.blur(); return; }
  activeDancers.push(name);
  setActiveInGroup(showBtns, null);
  activeFilter = 'all';
  dancerInput.value = ''; dancerInput.blur(); dancerDropdown.classList.remove('open');
  renderDancerPills(); applyFilters();
}

function removeDancer(name) {
  activeDancers = activeDancers.filter(n => n !== name);
  if (activeDancers.length === 0) {
    setActiveInGroup(showBtns, document.querySelector('.show-btn[data-filter="all"]'));
    activeFilter = 'all';
  }
  renderDancerPills(); applyFilters();
}

function renderDancerPills() {
  pillWrap.innerHTML = '';
  activeDancers.forEach(name => {
    const pill = document.createElement('div'); pill.className = 'dancer-pill';
    pill.innerHTML = `<span>${ICONS.sparkle}${name}</span><button class="pill-clear" aria-label="Remove ${name}">${ICONS.close}</button>`;
    pill.querySelector('.pill-clear').addEventListener('click', () => removeDancer(name));
    pillWrap.appendChild(pill);
  });
  pillRow.style.display = activeDancers.length > 0 ? '' : 'none';
  clearAllBtn.style.display = activeDancers.length > 1 ? '' : 'none';
  dancerInput.placeholder = activeDancers.length > 0 ? 'Add dancer...' : 'Dancer...';
}

dancerInput.addEventListener('input', () => renderDancerDropdown(dancerInput.value));
dancerInput.addEventListener('focus', () => renderDancerDropdown(dancerInput.value));
dancerInput.addEventListener('blur',  () => setTimeout(() => dancerDropdown.classList.remove('open'), 200));
clearAllBtn.addEventListener('click', () => {
  activeDancers = []; renderDancerPills();
  setActiveInGroup(showBtns, document.querySelector('.show-btn[data-filter="all"]'));
  activeFilter = 'all'; applyFilters();
});

// ── Studio search ──
function renderStudioDropdown(q) {
  const query = q.trim().toLowerCase();
  const avail = allStudios.filter(s => !activeStudios.includes(s));
  const matches = query ? avail.filter(s => s.toLowerCase().includes(query)) : avail;
  studioDropdown.innerHTML = matches.length === 0
    ? '<div class="dropdown-empty">No studios found</div>'
    : matches.map(s => {
        const idx = query ? s.toLowerCase().indexOf(query) : -1;
        const label = idx >= 0
          ? s.slice(0,idx) + '<mark>' + s.slice(idx,idx+query.length) + '</mark>' + s.slice(idx+query.length)
          : s;
        return `<div class="dropdown-item" data-name="${s}">${label}</div>`;
      }).join('');
  studioDropdown.classList.add('open');
  studioDropdown.querySelectorAll('.dropdown-item').forEach(d => {
    d.addEventListener('mousedown', e => { e.preventDefault(); addStudio(d.dataset.name); });
    d.addEventListener('touchstart', e => { e.preventDefault(); addStudio(d.dataset.name); }, { passive: false });
  });
}

function addStudio(name) {
  if (activeStudios.includes(name)) { studioDropdown.classList.remove('open'); studioInput.value = ''; studioInput.blur(); return; }
  activeStudios.push(name);
  studioInput.value = ''; studioInput.blur(); studioDropdown.classList.remove('open');
  renderStudioPills(); applyFilters();
}

function removeStudio(name) {
  activeStudios = activeStudios.filter(s => s !== name);
  renderStudioPills(); applyFilters();
}

function renderStudioPills() {
  studioPillWrap.innerHTML = '';
  activeStudios.forEach(name => {
    const pill = document.createElement('div'); pill.className = 'dancer-pill';
    pill.style.cssText = 'background:rgba(233,196,106,0.15);border-color:rgba(233,196,106,0.4);color:#fde68a;';
    pill.innerHTML = `<span>${ICONS.building}${name}</span><button class="pill-clear" style="color:#fde68a" aria-label="Remove ${name}">${ICONS.close}</button>`;
    pill.querySelector('.pill-clear').addEventListener('click', () => removeStudio(name));
    studioPillWrap.appendChild(pill);
  });
  studioClearBtn.style.display = activeStudios.length > 1 ? '' : 'none';
  studioInput.placeholder = activeStudios.length > 0 ? 'Add studio...' : 'Studio...';
}

studioInput.addEventListener('input', () => renderStudioDropdown(studioInput.value));
studioInput.addEventListener('focus', () => renderStudioDropdown(studioInput.value));
studioInput.addEventListener('blur',  () => setTimeout(() => studioDropdown.classList.remove('open'), 200));
studioClearBtn.addEventListener('click', () => { activeStudios = []; renderStudioPills(); applyFilters(); });

// ── Show / Type / Cat buttons ──
showBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    activeDancers = []; renderDancerPills();
    dancerInput.value = '';
    setActiveInGroup(showBtns, btn);
    activeFilter = btn.dataset.filter;
    applyFilters();
  });
});

catBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    setActiveInGroup(catBtns, btn);
    activeLevel  = btn.dataset.level;
    activeFormat = btn.dataset.format;
    applyFilters();
  });
});

// ── Offset ──
function parseTime(str) {
  const [tp, ap] = str.trim().split(' ');
  let [h, m] = tp.split(':').map(Number);
  if (ap === 'pm' && h !== 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  return h * 60 + m;
}
function formatTime(mins) {
  let h = Math.floor(mins / 60), m = mins % 60;
  const ap = h >= 12 ? 'pm' : 'am';
  if (h > 12) h -= 12; if (h === 0) h = 12;
  return h + ':' + String(m).padStart(2, '0') + ' ' + ap;
}
function applyOffset(delta, { persist = true } = {}) {
  offsetMinutes = delta;
  setActiveInGroup(offsetBtns, [...offsetBtns].find(b => parseInt(b.dataset.delta) === delta) || null);
  document.querySelectorAll('.card-time[data-orig-time]').forEach(el => {
    const orig = el.dataset.origTime;
    if (delta === 0) {
      el.innerHTML = orig; el.className = 'card-time';
    } else {
      const newTime = formatTime(parseTime(orig) + delta);
      el.innerHTML = `<span class="time-adjusted">${newTime}</span><span class="time-original">${orig}</span>`;
      el.className = 'card-time card-time--shifted';
    }
  });
  offsetStatus.textContent = delta === 0 ? '' : 'Running ' + (delta < 0 ? '' : '+') + delta + ' min';
  offsetStatus.style.display = delta === 0 ? 'none' : '';
  if (persist) localStorage.setItem(OFFSET_KEY, String(delta));
}
offsetBtns.forEach(btn => btn.addEventListener('click', () => applyOffset(parseInt(btn.dataset.delta))));

window.addEventListener('DOMContentLoaded', () => {
  buildSchedule();
  document.querySelectorAll('.day-section').forEach(s => { s.style.display = ''; s.classList.remove('hidden'); });

  const savedOffset = parseInt(localStorage.getItem(OFFSET_KEY));
  applyOffset(Number.isFinite(savedOffset) ? savedOffset : 0, { persist: false });

  applyFilters();
  APDCPwa.initServiceWorker('../service-worker.js');
});
