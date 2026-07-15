// A quiet "Schedule updated <date>" line in the header, shown only when the
// config carries a real lastUpdated date. It reflects when the published
// schedule data was last edited — not any live/day-of timing.
function renderLastUpdated() {
  const lu = COMPETITION_CONFIG.lastUpdated;
  const host = document.querySelector('.header-inner');
  let el = document.getElementById('last-updated');
  if (!lu) { if (el) el.remove(); return; }
  const d = new Date(lu + 'T00:00:00');
  const fmt = isNaN(d) ? lu : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  if (!el && host) {
    el = document.createElement('p');
    el.id = 'last-updated';
    el.className = 'last-updated';
    host.appendChild(el);
  }
  if (el) el.textContent = 'Schedule updated ' + fmt;
}

function buildSchedule() {
  allRoutines = [];
  // Header hierarchy: type/season eyebrow → competition name → where & when.
  document.getElementById('header-title').textContent = COMPETITION_CONFIG.name;
  const eyebrowEl = document.getElementById('header-eyebrow');
  if (eyebrowEl) {
    const season = COMPETITION_CONFIG.season ? COMPETITION_CONFIG.season.replace('-', '–') + ' Season' : '';
    eyebrowEl.textContent = [COMPETITION_CONFIG.type, season].filter(Boolean).join(' · ');
  }
  const locLabel = locationLabel(COMPETITION_CONFIG.location);
  const locHtml = locLabel
    ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery(COMPETITION_CONFIG.location))}" target="_blank" rel="noopener noreferrer">${ICONS.pin}${locLabel}</a> &middot; `
    : '';
  document.getElementById('header-subtitle').innerHTML = locHtml + (COMPETITION_CONFIG.dates || '');
  renderLastUpdated();

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
        <h2 class="day-title">${dayConf.title || key}</h2>
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
  scheduleReady = true; // data is rendered — the empty state may now be shown
}

