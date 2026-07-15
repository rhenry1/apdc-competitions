// ── State ──
let scheduleReady = false; // gate the no-results state on data being loaded
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
  filterExtra.inert = false;
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
  filterExtra.inert = true;
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
  // aria-hidden alone isn't enough: an ARIA-hidden container must not contain
  // focusable descendants (WCAG 4.1.2 / axe rule aria-hidden-focus) — a sighted
  // keyboard user could still Tab into "invisible" controls. `inert` removes
  // the whole subtree from both focus and hit-testing while closed, and is
  // cleared alongside aria-hidden the moment the drawer opens.
  filterExtra.inert = true;

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

  // Safari's back/forward cache can restore this page with the drawer's
  // closed-state `transform` still painted at wherever it was mid-slide when
  // the user navigated away, even though the (correct, closed) DOM state was
  // preserved too — the class says closed, but the compositor never got a
  // paint telling it so. Forcing a reflow on restore repaints it against the
  // current (closed) styles instead of the stale frozen one.
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    filterExtra.style.transition = 'none';
    void filterExtra.offsetHeight;
    filterExtra.style.transition = '';
  });
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
  // Only surface the empty state once the schedule data has actually loaded —
  // never flash "no routines" while the skeleton is still up.
  const empty = visible === 0 && scheduleReady;
  if (empty) renderEmptyState();
  noResults.classList.toggle('is-visible', empty);
  updateFilterBadge();
  updateFavCount();
  updateFavExportBar();
  updateFavSummary();
  updateClearAll();
  renderActiveFilters();
  announceResults(visible);
  syncURL();
}

// Screen-reader live announcement of how many routines are shown after a change.
function announceResults(count) {
  const sr = document.getElementById('sr-status');
  if (!sr) return;
  sr.textContent = count === 0
    ? 'No routines match the current filters.'
    : count + (count === 1 ? ' routine' : ' routines') + ' shown.';
}

// Inject a skip link and a screen-reader live region (keeps page markup DRY).
function initA11y() {
  if (!document.querySelector('.skip-link')) {
    const skip = document.createElement('a');
    skip.className = 'skip-link';
    skip.href = '#main-content';
    skip.textContent = 'Skip to schedule';
    document.body.insertBefore(skip, document.body.firstChild);
  }
  if (!document.getElementById('sr-status')) {
    const sr = document.createElement('div');
    sr.id = 'sr-status';
    sr.className = 'sr-only';
    sr.setAttribute('role', 'status');
    sr.setAttribute('aria-live', 'polite');
    document.body.appendChild(sr);
  }
}

