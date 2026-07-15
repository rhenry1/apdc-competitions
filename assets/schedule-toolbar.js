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
  if (persist) {
    localStorage.setItem(OFFSET_KEY, String(delta));
    // Reinforce the disclaimer the first time someone actually adjusts the
    // offset (the always-on note stays for everyone).
    if (delta !== 0 && !localStorage.getItem(OFFSET_NOTE_KEY)) {
      showToast('Personal estimate only — shifts the times you see, not the official schedule');
      localStorage.setItem(OFFSET_NOTE_KEY, '1');
    }
  }
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
    '<div class="schedule-tools-right">' +
      '<button type="button" class="print-btn" id="print-btn" title="Print or save as PDF">' + ICONS.print + 'Print</button>' +
      '<div class="density-toggle" role="group" aria-label="Schedule density">' +
      '<button type="button" data-density="comfortable" aria-pressed="true">Comfortable</button>' +
      '<button type="button" data-density="compact" aria-pressed="false">Compact</button>' +
      '</div>' +
    '</div>';
  container.parentNode.insertBefore(tools, container);

  tools.querySelectorAll('.density-toggle button').forEach(b => {
    b.addEventListener('click', () => applyDensity(b.dataset.density));
  });
  document.getElementById('clear-all-global').addEventListener('click', clearAllFilters);
  // Print the current view — filter to Favorites first for a personal schedule.
  // The @media print stylesheet strips the app chrome and lays the visible
  // routines out cleanly on paper (times shown are the published scheduled
  // times, never the personal offset estimate).
  document.getElementById('print-btn').addEventListener('click', function () { window.print(); });

  // A print-only footer note (hidden on screen). Reinforces that printed times
  // are the published schedule, which can still change.
  if (!document.querySelector('.print-footer')) {
    const main = document.getElementById('main-content') || document.querySelector('main');
    if (main) {
      const pf = document.createElement('p');
      pf.className = 'print-only print-footer';
      pf.textContent = 'Scheduled times are subject to change. Printed from the APDC schedule portal.';
      main.appendChild(pf);
    }
  }

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

