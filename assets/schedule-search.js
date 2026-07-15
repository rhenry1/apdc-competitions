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

