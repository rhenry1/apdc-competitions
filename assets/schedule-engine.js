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
const DENSITY_KEY = 'apdc-schedule-density';
const FAVORITES_KEY = 'apdc-favorites';

// Favorited routine ids. Ids are competition-namespaced (see normalizeRoutine),
// so a single flat set is safe across competitions — identical routine numbers
// in different events never collide. Persisted locally; never leaves the device.
let favorites = loadFavorites();

function loadFavorites() {
  try {
    const raw = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
    return new Set(Array.isArray(raw) ? raw : []);
  } catch (e) { return new Set(); }
}
function saveFavorites() {
  try { localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites])); } catch (e) { /* storage full/blocked */ }
}
function isFavorite(id) { return favorites.has(id); }

let allRoutines = [];
let allDancers = [];
let allStudios = [];

function slugify(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Normalize free-text for search: lowercase, punctuation → spaces, collapsed.
// Makes matching case-insensitive and punctuation-tolerant ("Hip-Hop" ~ "hip hop").
function normalizeSearch(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

// Human-readable venue label, e.g. "Long Branch, NJ" or "Venue · City, ST".
// Accepts the new structured location object or a legacy plain string.
function locationLabel(loc) {
  if (!loc) return '';
  if (typeof loc === 'string') return loc;
  const cityState = [loc.city, loc.state].filter(Boolean).join(', ');
  return [loc.venue, cityState].filter(Boolean).join(' · ');
}

// Best query string for a maps search — prefers a full street address.
function mapsQuery(loc) {
  if (!loc) return '';
  if (typeof loc === 'string') return loc;
  return loc.address || [loc.venue, loc.city, loc.state].filter(Boolean).join(' ') || locationLabel(loc);
}

// Convert a raw authored routine (compact per-page format) into the canonical
// runtime model used across the app. The authored SCHEDULE data is preserved
// as-is; normalization happens once at load. `id` is stable and derived from the
// competition id + routine number (never array position), so favorites and
// shareable state can reference a routine reliably across sessions.
function normalizeRoutine(raw, dayKey, dayConf, index) {
  const compId = COMPETITION_CONFIG.id || slugify(COMPETITION_CONFIG.name);
  const routineNumber = raw.entry || '';
  // Day-scoped so a routine number scheduled on two days (e.g. a regular-day
  // performance and a Battle-Day repeat) yields two distinct instance ids;
  // `routineNumber` still links them. Index is only a last-resort tiebreaker.
  const idSuffix = routineNumber ? 'r' + routineNumber : 'i' + index;
  const dancersText = raw.dancers || '';
  const dancers = dancersText.split(',').map(s => s.trim()).filter(Boolean);
  return {
    id: compId + '-' + dayKey + '-' + idSuffix,
    day: dayKey,
    routineNumber,
    routineName: raw.title || '',
    dancers,                                   // array — for favorites / search
    dancersText,                               // original joined string — for display + substring filters
    studio: raw.studio || '',
    scheduledDate: (dayConf && dayConf.date) || '',
    scheduledTime: raw.time || '',             // display form, e.g. "8:45 am"
    type: raw.format || '',                    // solo | group | production
    style: raw.style || '',
    division: raw.level || '',                 // mini | petite | junior | teen | senior
    stage: raw.stage || '',
    props: !!raw.props,
    isApdc: !!raw.isApdc,
    spotlight: !!raw.spotlight,
    formatTag: raw.formatTag || '',
    ageLabel: raw.ageLabel || '',
    awardsSessionId: raw.awardsSessionId || null,
    notes: raw.notes || ''
  };
}

function buildDancerList() {
  const set = new Set();
  allRoutines.forEach(r => r.dancers.forEach(n => set.add(n)));
  allDancers = [...set].sort();
}

function buildStudioList() {
  const set = new Set();
  allRoutines.forEach(r => { if (r.studio) set.add(r.studio); });
  allStudios = [...set].sort();
}

function renderRoutineCard(r, dayKey, dayConf) {
  const cardClass = r.isApdc
    ? [r.spotlight && r.props ? 'quinn-and-props' : r.props ? 'props-only' : r.spotlight ? 'quinn-only' : 'normal', 'apdc-card'].join(' ')
    : (r.spotlight && r.props ? 'quinn-and-props' : r.props ? 'props-only' : r.spotlight ? 'quinn-only' : 'normal');

  const styleClass = STYLE_CLASS[r.style] || '';
  const card = document.createElement('div');
  card.className = `routine-card ${cardClass}`;
  card.dataset.routineId = r.id;
  card.dataset.quinn   = String(r.spotlight);
  card.dataset.props   = String(r.props);
  card.dataset.dancers = r.dancersText;
  card.dataset.level   = r.division;
  card.dataset.format  = r.type;
  card.dataset.studio  = r.studio;
  card.dataset.day     = dayKey;
  // Combined, normalized text index backing the unified search.
  card.dataset.search  = normalizeSearch([
    r.routineNumber, r.routineName, r.dancersText, r.studio, r.style, r.type,
    r.division, r.formatTag, r.stage ? 'stage ' + r.stage : '', r.props ? 'props prop' : ''
  ].filter(Boolean).join(' '));

  const stageTag  = r.stage ? `<span class="tag stage-${r.stage}">Stage ${r.stage}</span>` : '';
  const styleTag  = r.style ? `<span class="tag ${styleClass}">${r.style}</span>` : '';
  const fmtTag    = r.formatTag ? `<span class="tag">${r.formatTag}</span>` : '';
  const propsIcon = r.props ? ` <span class="props-icon">${ICONS.props}</span>` : '';
  const apdcBadge = r.isApdc ? '<span class="apdc-badge">APDC</span>' : '';
  const entryNum  = r.routineNumber ? `<div class="entry-num">#${r.routineNumber}</div>` : '';

  const faved = isFavorite(r.id);
  if (faved) card.classList.add('favorited');

  card.innerHTML = `
    <div class="card-time" data-orig-time="${r.scheduledTime}">${r.scheduledTime}</div>
    <div class="card-main">
      ${entryNum}<div class="card-title">${r.routineName}${propsIcon}${apdcBadge}</div>
      <div class="card-meta">${stageTag}${styleTag}${fmtTag}</div>
      <div class="card-dancers">${r.dancersText}</div>
      <div class="card-actions">
        <button class="card-action-btn" type="button" title="Share this routine" aria-label="Share ${r.routineName}">${ICONS.share}</button>
        <button class="card-action-btn" type="button" title="Add to calendar" aria-label="Add ${r.routineName} to calendar">${ICONS.calendar}</button>
      </div>
    </div>
    <div class="card-right">
      <button class="card-fav${faved ? ' is-fav' : ''}" type="button" aria-pressed="${faved}" title="Favorite" aria-label="Favorite ${r.routineName}">${ICONS.star}</button>
      <span class="age-badge">${r.ageLabel}</span>
    </div>
  `;

  const [shareBtn, calendarBtn] = card.querySelectorAll('.card-action-btn');
  shareBtn.addEventListener('click', (e) => { e.stopPropagation(); shareRoutine(r, dayConf); });
  calendarBtn.addEventListener('click', (e) => { e.stopPropagation(); downloadICS(r, dayConf); });
  card.querySelector('.card-fav').addEventListener('click', (e) => { e.stopPropagation(); toggleFavorite(r.id, card); });

  return card;
}

function toggleFavorite(id, card) {
  const nowFav = !favorites.has(id);
  if (nowFav) favorites.add(id); else favorites.delete(id);
  saveFavorites();
  if (card) {
    card.classList.toggle('favorited', nowFav);
    const btn = card.querySelector('.card-fav');
    if (btn) { btn.classList.toggle('is-fav', nowFav); btn.setAttribute('aria-pressed', String(nowFav)); }
  }
  updateFavCount();
  // In favorites-only view, unstarring should drop the card from the list.
  if (activeFilter === 'favorites') applyFilters();
}

function favoriteCount() {
  // count only favorites belonging to this competition's rendered routines
  return allRoutines.filter(r => favorites.has(r.id)).length;
}

function updateFavCount() {
  const badge = document.getElementById('fav-count');
  if (!badge) return;
  const n = favoriteCount();
  badge.textContent = String(n);
  badge.style.display = n > 0 ? '' : 'none';
}

// ── Share + Add to Calendar ──
function showToast(message) {
  let toast = document.getElementById('action-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'action-toast';
    toast.className = 'action-toast';
    toast.setAttribute('aria-live', 'polite');
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove('visible'), 2200);
}

async function shareRoutine(r, dayConf) {
  const text = `${r.routineName} — ${dayConf.title || ''} at ${r.scheduledTime}` +
    (r.stage ? ` (Stage ${r.stage})` : '') +
    (r.dancersText ? `\n${r.dancersText}` : '') +
    `\n${COMPETITION_CONFIG.name}`;

  if (navigator.share) {
    try { await navigator.share({ title: r.routineName, text }); } catch (e) { /* user cancelled */ }
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied to clipboard');
  } catch (e) {
    showToast('Could not copy — try again');
  }
}

function icsEscape(text) {
  return String(text || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function icsDateTime(date) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}T${p(date.getHours())}${p(date.getMinutes())}00`;
}

function downloadICS(r, dayConf) {
  const scheduledDate = r.scheduledDate || (dayConf && dayConf.date);
  if (!scheduledDate) { showToast('Date unavailable for this routine'); return; }

  const [timePart, ampm] = r.scheduledTime.trim().split(' ');
  let [hour, minute] = timePart.split(':').map(Number);
  if (ampm === 'pm' && hour !== 12) hour += 12;
  if (ampm === 'am' && hour === 12) hour = 0;

  const [y, mo, d] = scheduledDate.split('-').map(Number);
  const start = new Date(y, mo - 1, d, hour, minute);
  const end = new Date(start.getTime() + 15 * 60000); // short reminder block — routines run just a few minutes

  const description = [r.dancersText, r.formatTag, r.stage ? `Stage ${r.stage}` : '',
    'Scheduled time — competition times may change. Arrive a few minutes early.']
    .filter(Boolean).join('\n');

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//APDC Competitions//EN',
    'BEGIN:VEVENT',
    `UID:${r.id}@apdc-competitions`,
    `DTSTART:${icsDateTime(start)}`,
    `DTEND:${icsDateTime(end)}`,
    `SUMMARY:${icsEscape(r.routineName + (r.routineNumber ? ` (#${r.routineNumber})` : '') + ' — ' + COMPETITION_CONFIG.name)}`,
    `DESCRIPTION:${icsEscape(description)}`,
    `LOCATION:${icsEscape(locationLabel(COMPETITION_CONFIG.location))}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const filename = `${r.routineNumber || 'routine'}-${r.routineName}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) + '.ics';

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildSchedule() {
  allRoutines = [];
  document.getElementById('header-title').textContent = COMPETITION_CONFIG.name;
  const locLabel = locationLabel(COMPETITION_CONFIG.location);
  const locHtml = locLabel
    ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery(COMPETITION_CONFIG.location))}" target="_blank" rel="noopener noreferrer">${ICONS.pin}${locLabel}</a> &middot; `
    : '';
  document.getElementById('header-subtitle').innerHTML = locHtml + (COMPETITION_CONFIG.dates || '');

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

    let routineIndex = 0;
    items.forEach(item => {
      if (item.type === 'routine') {
        const routine = normalizeRoutine(item, key, dayConf, routineIndex++);
        allRoutines.push(routine);
        section.appendChild(renderRoutineCard(routine, key, dayConf));
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
let activeSearch  = '';
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
const filterToggle   = document.getElementById('filter-toggle');
const filterExtra    = document.getElementById('filter-extra');
const filterBadge    = document.getElementById('filter-badge');

if (filterToggle) {
  filterToggle.innerHTML =
    ICONS.chevron +
    '<span class="filter-toggle-text">More Filters</span>' +
    '<span class="filter-toggle-sub">Studio &middot; Type &middot; Day</span>' +
    '<span class="filter-badge" id="filter-badge" style="display:none">0</span>';
}

function updateFilterBadge() {
  const badge = document.getElementById('filter-badge');
  if (!badge) return;
  let count = 0;
  if (activeStudios.length > 0) count++;
  if (activeLevel || activeFormat) count++;
  if (activeDay !== 'all') count++;
  badge.textContent = String(count);
  badge.style.display = count > 0 ? '' : 'none';
}

// ── Filter drawer (accessible bottom sheet) ──
let filterBackdrop = null;
let _drawerKeydown = null;

function focusablesIn(el) {
  return [...el.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
    .filter(n => !n.disabled && n.offsetParent !== null);
}

function openFilterDrawer() {
  if (!filterExtra) return;
  filterBackdrop.classList.add('open');
  filterExtra.classList.add('open');
  filterExtra.setAttribute('aria-hidden', 'false');
  filterToggle.classList.add('open');
  filterToggle.setAttribute('aria-expanded', 'true');

  const focusables = focusablesIn(filterExtra);
  if (focusables.length) focusables[0].focus();

  _drawerKeydown = (e) => {
    if (e.key === 'Escape') { closeFilterDrawer(); return; }
    if (e.key !== 'Tab') return;
    const f = focusablesIn(filterExtra);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  document.addEventListener('keydown', _drawerKeydown);
}

function closeFilterDrawer() {
  if (!filterExtra) return;
  filterBackdrop.classList.remove('open');
  filterExtra.classList.remove('open');
  filterExtra.setAttribute('aria-hidden', 'true');
  filterToggle.classList.remove('open');
  filterToggle.setAttribute('aria-expanded', 'false');
  if (_drawerKeydown) { document.removeEventListener('keydown', _drawerKeydown); _drawerKeydown = null; }
  filterToggle.focus();
}

function initFilterDrawer() {
  if (!filterToggle || !filterExtra) return;

  // Relocate the drawer to <body> so position:fixed is viewport-relative
  // (the sticky toolbar uses backdrop-filter, which would otherwise contain it).
  document.body.appendChild(filterExtra);
  filterExtra.setAttribute('role', 'dialog');
  filterExtra.setAttribute('aria-modal', 'true');
  filterExtra.setAttribute('aria-label', 'Filters');
  filterExtra.setAttribute('aria-hidden', 'true');

  const header = document.createElement('div');
  header.className = 'filter-drawer-header';
  header.innerHTML =
    '<span class="filter-drawer-title">Filters</span>' +
    '<button type="button" class="filter-drawer-close" aria-label="Close filters">' + ICONS.close + '</button>';
  filterExtra.insertBefore(header, filterExtra.firstChild);

  filterBackdrop = document.createElement('div');
  filterBackdrop.className = 'filter-backdrop';
  document.body.appendChild(filterBackdrop);

  filterToggle.setAttribute('aria-haspopup', 'dialog');
  filterToggle.addEventListener('click', openFilterDrawer);
  filterBackdrop.addEventListener('click', closeFilterDrawer);
  header.querySelector('.filter-drawer-close').addEventListener('click', closeFilterDrawer);
}

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
  const searchTokens = activeSearch ? normalizeSearch(activeSearch).split(' ').filter(Boolean) : [];
  let visible = 0;

  cards.forEach(card => {
    const sec      = card.closest('.day-section');
    const secDay   = sec ? (sec.getAttribute('data-day') || '') : '';
    const dayMatch = activeDay === 'all' || secDay === activeDay;
    const dancers  = card.dataset.dancers || '';
    const isProps  = card.dataset.props === 'true';

    let showMatch = false;
    if (hasDancers)                        showMatch = activeDancers.some(n => dancers.toLowerCase().includes(n.toLowerCase()));
    else if (activeFilter === 'all')       showMatch = true;
    else if (activeFilter === 'props')     showMatch = isProps;
    else if (activeFilter === 'favorites') showMatch = favorites.has(card.dataset.routineId);

    const levelMatch  = !activeLevel  || card.dataset.level  === activeLevel;
    const formatMatch = !activeFormat || card.dataset.format === activeFormat;
    const studioMatch = activeStudios.length === 0 ||
      activeStudios.some(s => (card.dataset.studio || '').toLowerCase() === s.toLowerCase());
    const searchText  = card.dataset.search || '';
    const searchMatch = searchTokens.length === 0 || searchTokens.every(tok => searchText.includes(tok));

    const show = dayMatch && showMatch && levelMatch && formatMatch && studioMatch && searchMatch;
    card.classList.toggle('hidden', !show);
    if (show) visible++;
  });

  // Hide a day section entirely when the active day excludes it OR none of its
  // routines survive the current filters — avoids empty sticky day headers.
  sections.forEach(sec => {
    const secDay = sec.getAttribute('data-day') || '';
    const dayMatch = activeDay === 'all' || secDay === activeDay;
    const hasVisibleCard = sec.querySelector('.routine-card:not(.hidden)') !== null;
    const show = dayMatch && hasVisibleCard;
    sec.style.display = show ? '' : 'none';
    sec.classList.toggle('hidden', !show);
  });

  metaRows.forEach(row => {
    const sec      = row.closest('.day-section');
    const secDay   = sec ? (sec.getAttribute('data-day') || '') : '';
    const dayMatch = activeDay === 'all' || secDay === activeDay;
    row.classList.toggle('hidden', hasDancers || activeFilter !== 'all' || !dayMatch);
  });

  renderCallout();
  const empty = visible === 0;
  if (empty) renderEmptyState();
  noResults.classList.toggle('is-visible', empty);
  updateFilterBadge();
  updateFavCount();
  updateClearAll();
  renderActiveFilters();
}

// ── Callout ──
function renderCallout() {
  if (activeDancers.length === 0) { callout.style.display = 'none'; return; }
  const dayIndex = {};
  COMPETITION_CONFIG.dayButtons.forEach((b, i) => dayIndex[b.key] = i);
  const seen = new Set();
  const entries = allRoutines
    .filter(r => activeDancers.some(n => r.dancersText.toLowerCase().includes(n.toLowerCase())))
    .filter(r => { const k = r.day + r.scheduledTime + r.routineName; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => (dayIndex[a.day] ?? 99) - (dayIndex[b.day] ?? 99));

  calloutHeader.innerHTML = ICONS.sparkle + (activeDancers.length === 1
    ? 'All routines for ' + activeDancers[0]
    : 'All routines for selected dancers');
  calloutSched.innerHTML = '';
  entries.forEach(r => {
    const dayTitle = (COMPETITION_CONFIG.days[r.day] || {}).title || r.day;
    const item = document.createElement('div');
    item.className = 'quinn-item';
    item.innerHTML = `<div class="quinn-item-title">${r.routineName}${r.props ? ' ' + ICONS.props : ''}</div>
      <div class="quinn-item-meta">${dayTitle} · ${r.scheduledTime}${r.stage ? ' · Stage ' + r.stage : ''}</div>`;
    calloutSched.appendChild(item);
  });
  callout.style.display = entries.length > 0 ? '' : 'none';
}

// ── Unified search ──
// The main box is a free-text search across all routine fields. When the query
// also matches dancer names, those surface as suggestions so a dancer can still
// be "pinned" (pill + spotlight callout). Suggestions only show when there are
// dancer matches — a non-dancer query (e.g. "jazz", "1042") just filters cards.
function renderDancerDropdown(q) {
  const query = q.trim().toLowerCase();
  const avail = allDancers.filter(n => !activeDancers.includes(n));
  const matches = query ? avail.filter(n => n.toLowerCase().includes(query)) : [];
  if (matches.length === 0) {
    dancerDropdown.innerHTML = '';
    dancerDropdown.classList.remove('open');
    return;
  }
  dancerDropdown.innerHTML = matches.map(n => {
    const idx = n.toLowerCase().indexOf(query);
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
  // Pinning a dancer supersedes the transient free-text query.
  clearTimeout(_searchDebounce);
  activeSearch = '';
  dancerInput.value = '';
  updateSearchClear();
  dancerInput.blur();
  dancerDropdown.classList.remove('open');
  if (activeDancers.includes(name)) return;
  activeDancers.push(name);
  setActiveInGroup(showBtns, null);
  activeFilter = 'all';
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

// Active filters are now shown as unified chips beneath the toolbar
// (renderActiveFilters). The old in-toolbar dancer pill-row is retired.
function renderDancerPills() {
  if (pillRow) pillRow.style.display = 'none';
}

// ── Active-filter chips (unified, removable, beneath the toolbar) ──
const FORMAT_LABEL = { solo: 'Solo', group: 'Groups', production: 'Production' };
function titleCase(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function dayButtonLabel(dayKey) {
  const btn = COMPETITION_CONFIG.dayButtons.find(b => b.key === dayKey);
  return btn ? btn.label : dayKey;
}

function renderActiveFilters() {
  const wrap = document.getElementById('active-filters');
  if (!wrap) return;
  wrap.innerHTML = '';

  const addChip = (key, label, onRemove) => {
    const chip = document.createElement('div');
    chip.className = 'filter-chip';
    chip.dataset.chip = key;
    chip.innerHTML = `<span>${label}</span>` +
      `<button class="chip-remove" type="button" aria-label="Remove ${label} filter">${ICONS.close}</button>`;
    chip.querySelector('.chip-remove').addEventListener('click', onRemove);
    wrap.appendChild(chip);
  };

  activeDancers.forEach(name => addChip('dancer:' + name, name, () => removeDancer(name)));
  activeStudios.forEach(name => addChip('studio:' + name, name, () => removeStudio(name)));
  if (activeSearch) {
    addChip('search', 'Search: “' + activeSearch + '”', () => {
      dancerInput.value = ''; activeSearch = ''; updateSearchClear(); applyFilters();
    });
  }
  if (activeFilter === 'props' || activeFilter === 'favorites') {
    addChip('show', activeFilter === 'props' ? 'Props' : 'Favorites', () => {
      activeFilter = 'all';
      setActiveInGroup(showBtns, document.querySelector('.show-btn[data-filter="all"]'));
      applyFilters();
    });
  }
  if (activeLevel) addChip('level', titleCase(activeLevel), resetCategory);
  if (activeFormat) addChip('format', FORMAT_LABEL[activeFormat] || titleCase(activeFormat), resetCategory);
  if (activeDay !== 'all') {
    addChip('day', dayButtonLabel(activeDay), () => {
      activeDay = 'all';
      setActiveInGroup(document.querySelectorAll('.day-btn'), document.querySelector('.day-btn[data-day="all"]'));
      applyFilters();
    });
  }

  wrap.classList.toggle('visible', wrap.children.length > 0);
}

function resetCategory() {
  activeLevel = '';
  activeFormat = '';
  setActiveInGroup(catBtns, catBtns[0] || null);
  applyFilters();
}

function initActiveFilters() {
  const main = document.getElementById('main-content');
  if (!main || document.getElementById('active-filters')) return;
  const wrap = document.createElement('div');
  wrap.id = 'active-filters';
  wrap.className = 'active-filters';
  wrap.setAttribute('aria-label', 'Active filters');
  main.insertBefore(wrap, main.firstChild);
}

// ── Unified search input wiring (debounced free-text + dancer suggestions) ──
let _searchDebounce;
function onSearchInput() {
  updateSearchClear();
  renderDancerDropdown(dancerInput.value); // suggestions update immediately
  clearTimeout(_searchDebounce);
  // Read the current value when the timer fires (not the value at input time),
  // so a fast pin/clear that empties the box isn't overwritten by a stale query.
  _searchDebounce = setTimeout(() => {
    activeSearch = dancerInput.value.trim();
    applyFilters();
  }, 120);
}
function updateSearchClear() {
  const btn = document.getElementById('search-clear');
  if (btn) btn.style.display = dancerInput.value ? 'flex' : 'none';
}
function initSearchClear() {
  const wrap = document.getElementById('search-wrap');
  if (!wrap || document.getElementById('search-clear')) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'search-clear';
  btn.className = 'search-clear';
  btn.setAttribute('aria-label', 'Clear search');
  btn.innerHTML = ICONS.close;
  btn.style.display = 'none';
  btn.addEventListener('click', () => {
    dancerInput.value = '';
    activeSearch = '';
    updateSearchClear();
    dancerDropdown.classList.remove('open');
    applyFilters();
    dancerInput.focus();
  });
  wrap.appendChild(btn);
}

dancerInput.addEventListener('input', onSearchInput);
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

// Selected studios appear in the unified active-filter chips row; inside the
// drawer we only keep the "Clear" affordance and the input placeholder.
function renderStudioPills() {
  if (studioPillWrap) studioPillWrap.innerHTML = '';
  if (studioClearBtn) studioClearBtn.style.display = activeStudios.length > 1 ? '' : 'none';
  if (studioInput) studioInput.placeholder = activeStudios.length > 0 ? 'Add studio…' : 'Studio…';
}

studioInput.addEventListener('input', () => renderStudioDropdown(studioInput.value));
studioInput.addEventListener('focus', () => renderStudioDropdown(studioInput.value));
studioInput.addEventListener('blur',  () => setTimeout(() => studioDropdown.classList.remove('open'), 200));
studioClearBtn.addEventListener('click', () => { activeStudios = []; renderStudioPills(); applyFilters(); });

// ── Empty state (no routines visible) ──
function renderEmptyState() {
  const favMode = activeFilter === 'favorites';
  const actions = [];
  if (favMode) {
    actions.push({ label: 'Browse all routines', primary: true, fn: () => {
      activeFilter = 'all';
      setActiveInGroup(showBtns, document.querySelector('.show-btn[data-filter="all"]'));
      applyFilters();
    }});
  } else if (hasActiveFilters()) {
    actions.push({ label: 'Clear all filters', primary: true, fn: clearAllFilters });
    if (activeDay !== 'all') {
      actions.push({ label: 'Show all days', primary: false, fn: () => {
        activeDay = 'all';
        setActiveInGroup(document.querySelectorAll('.day-btn'), document.querySelector('.day-btn[data-day="all"]'));
        applyFilters();
      }});
    }
  }

  const title = favMode ? 'No favorites yet' : 'No routines match';
  const msg = favMode
    ? 'Tap the star on any routine to save it here.'
    : 'Try removing a filter or searching a different name.';

  noResults.innerHTML =
    `<div class="empty-icon">${favMode ? ICONS.star : ICONS.search}</div>` +
    `<div class="empty-title">${title}</div>` +
    `<div class="empty-msg">${msg}</div>` +
    (actions.length ? '<div class="empty-actions"></div>' : '');

  const box = noResults.querySelector('.empty-actions');
  if (box) actions.forEach(a => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'empty-btn' + (a.primary ? ' primary' : '');
    btn.textContent = a.label;
    btn.addEventListener('click', a.fn);
    box.appendChild(btn);
  });
}

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
  offsetStatus.textContent = delta === 0 ? '' : (delta < 0 ? '' : '+') + delta + ' min · estimate';
  offsetStatus.style.display = delta === 0 ? 'none' : '';
  if (persist) localStorage.setItem(OFFSET_KEY, String(delta));
}
offsetBtns.forEach(btn => btn.addEventListener('click', () => applyOffset(parseInt(btn.dataset.delta))));

// ── Density toggle (comfortable / compact), persisted locally ──
function applyDensity(mode, { persist = true } = {}) {
  const compact = mode === 'compact';
  document.body.classList.toggle('compact', compact);
  document.querySelectorAll('.density-toggle button').forEach(b => {
    const on = b.dataset.density === mode;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', String(on));
  });
  if (persist) localStorage.setItem(DENSITY_KEY, mode);
}

function initScheduleTools() {
  const container = document.getElementById('schedule-container');
  if (!container || document.querySelector('.schedule-tools')) return;
  const saved = localStorage.getItem(DENSITY_KEY) === 'compact' ? 'compact' : 'comfortable';

  const tools = document.createElement('div');
  tools.className = 'schedule-tools';
  tools.innerHTML =
    '<button type="button" class="clear-all-global" id="clear-all-global">' + ICONS.close + 'Clear all filters</button>' +
    '<div class="density-toggle" role="group" aria-label="Schedule density">' +
    '<button type="button" data-density="comfortable" aria-pressed="true">Comfortable</button>' +
    '<button type="button" data-density="compact" aria-pressed="false">Compact</button>' +
    '</div>';
  container.parentNode.insertBefore(tools, container);

  tools.querySelectorAll('.density-toggle button').forEach(b => {
    b.addEventListener('click', () => applyDensity(b.dataset.density));
  });
  document.getElementById('clear-all-global').addEventListener('click', clearAllFilters);
  applyDensity(saved, { persist: false });
}

// Wrap the filter bar + offset bar into one sticky toolbar unit, and keep
// --toolbar-h in sync with its height so sticky day headers pin right below it
// (the height changes when "More Filters" expands/collapses or on resize).
function initToolbar() {
  const filterBar = document.getElementById('filter-bar');
  if (!filterBar || filterBar.closest('.schedule-toolbar')) return;
  const offsetBar = document.getElementById('offset-bar');

  const toolbar = document.createElement('div');
  toolbar.className = 'schedule-toolbar';
  filterBar.parentNode.insertBefore(toolbar, filterBar);
  toolbar.appendChild(filterBar);
  if (offsetBar) toolbar.appendChild(offsetBar);

  const setH = () => document.documentElement.style.setProperty('--toolbar-h', toolbar.offsetHeight + 'px');
  setH();
  if (window.ResizeObserver) new ResizeObserver(setH).observe(toolbar);
  else window.addEventListener('resize', setH);
}

// ── Global clear-all ──
function hasActiveFilters() {
  return activeDancers.length > 0 || activeStudios.length > 0 ||
    !!activeLevel || !!activeFormat || activeDay !== 'all' || activeFilter !== 'all' ||
    !!activeSearch;
}

function updateClearAll() {
  const btn = document.getElementById('clear-all-global');
  if (btn) btn.classList.toggle('visible', hasActiveFilters());
}

function clearAllFilters() {
  activeDancers = [];
  activeStudios = [];
  activeLevel = '';
  activeFormat = '';
  activeDay = 'all';
  activeFilter = 'all';
  activeSearch = '';
  if (dancerInput) dancerInput.value = '';
  if (studioInput) studioInput.value = '';
  updateSearchClear();
  renderDancerPills();
  renderStudioPills();
  setActiveInGroup(showBtns, document.querySelector('.show-btn[data-filter="all"]'));
  setActiveInGroup(catBtns, catBtns[0] || null);
  setActiveInGroup(document.querySelectorAll('.day-btn'), document.querySelector('.day-btn[data-day="all"]'));
  applyFilters();
}

// Public runtime API — the normalized data model other features (favorites,
// unified search, personal summary) and the test suite build on. Read-only
// accessors so callers never mutate engine state directly.
window.APDC = {
  config: () => COMPETITION_CONFIG,
  routines: () => allRoutines.slice(),
  dancers: () => allDancers.slice(),
  studios: () => allStudios.slice(),
  favorites: () => [...favorites],
  isFavorite,
  locationLabel, mapsQuery, normalizeRoutine
};

window.addEventListener('DOMContentLoaded', () => {
  buildSchedule();
  document.querySelectorAll('.day-section').forEach(s => { s.style.display = ''; s.classList.remove('hidden'); });

  const savedOffset = parseInt(localStorage.getItem(OFFSET_KEY));
  applyOffset(Number.isFinite(savedOffset) ? savedOffset : 0, { persist: false });

  initToolbar();
  initScheduleTools();
  initSearchClear();
  initActiveFilters();
  initFilterDrawer();
  applyFilters();
  APDCPwa.initServiceWorker('../service-worker.js');
});
