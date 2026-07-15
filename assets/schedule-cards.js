// ── Routine cards + favorites UI ──
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
  calendarBtn.addEventListener('click', (e) => { e.stopPropagation(); downloadICS(r); });
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

// In the Favorites view (and only when there are favorites), offer a one-tap
// export of every favorited routine as a single calendar file.
function updateFavExportBar() {
  const show = activeFilter === 'favorites' && favoriteCount() > 0;
  let bar = document.getElementById('fav-export-bar');
  if (!show) { if (bar) bar.remove(); return; }
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'fav-export-bar';
    bar.className = 'fav-export-bar';
    const af = document.getElementById('active-filters');
    if (af && af.parentNode) af.parentNode.insertBefore(bar, af.nextSibling);
    else {
      const main = document.querySelector('main') || document.body;
      main.insertBefore(bar, main.firstChild);
    }
  }
  const n = favoriteCount();
  bar.innerHTML =
    `<span class="fav-export-count">${n} favorite${n === 1 ? '' : 's'}</span>` +
    `<button type="button" class="fav-export-btn">${ICONS.calendar}<span>Add all to calendar</span></button>`;
  bar.querySelector('.fav-export-btn').addEventListener('click', exportFavoritesICS);
}

// In the Favorites view, a compact per-day recap so a parent can plan the day
// at a glance: how many favorites each day, the scheduled span (first–last),
// and the longest scheduled gap between them. All values come straight from the
// published schedule; nothing here reflects live or actual timing.
function updateFavSummary() {
  const show = activeFilter === 'favorites' && favoriteCount() > 0;
  let box = document.getElementById('fav-summary');
  if (!show) { if (box) box.remove(); return; }

  // Group favorited routines by day, preserving the configured day order.
  const rows = [];
  COMPETITION_CONFIG.dayButtons.forEach(({ key }) => {
    const favs = allRoutines.filter(r => r.day === key && favorites.has(r.id));
    if (!favs.length) return;
    const dayConf = COMPETITION_CONFIG.days[key] || {};
    const dayTitle = dayConf.title || key;

    // Order by scheduled time; keep only entries we can place on a clock.
    const timed = favs
      .map(r => ({ mins: timeToMinutes(r.scheduledTime), time: r.scheduledTime }))
      .filter(t => t.mins !== null)
      .sort((a, b) => a.mins - b.mins);

    let span = '', gap = '';
    if (timed.length) {
      const first = timed[0], last = timed[timed.length - 1];
      span = first === last ? first.time : `${first.time}–${last.time}`;
      let longest = 0;
      for (let i = 1; i < timed.length; i++) longest = Math.max(longest, timed[i].mins - timed[i - 1].mins);
      if (longest > 0) gap = formatGap(longest);
    }
    rows.push({ dayTitle, count: favs.length, span, gap });
  });
  if (!rows.length) { if (box) box.remove(); return; }

  if (!box) {
    box = document.createElement('div');
    box.id = 'fav-summary';
    box.className = 'fav-summary';
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', 'Your favorites at a glance');
    const bar = document.getElementById('fav-export-bar');
    const af = document.getElementById('active-filters');
    const anchor = bar || af;
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(box, anchor.nextSibling);
    else {
      const main = document.querySelector('main') || document.body;
      main.insertBefore(box, main.firstChild);
    }
  }

  box.innerHTML =
    '<div class="fav-summary-head">Your favorites at a glance</div>' +
    '<ul class="fav-summary-list">' +
    rows.map(r =>
      '<li class="fav-summary-day">' +
        `<span class="fs-day">${r.dayTitle}</span>` +
        '<span class="fs-meta">' +
          `<strong>${r.count}</strong> favorite${r.count === 1 ? '' : 's'}` +
          (r.span ? ` &middot; ${r.span} scheduled` : '') +
          (r.gap ? ` &middot; longest gap ${r.gap}` : '') +
        '</span>' +
      '</li>'
    ).join('') +
    '</ul>' +
    '<p class="fav-summary-note">Scheduled times, subject to change.</p>';
}

