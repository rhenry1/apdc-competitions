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

// ── Deep links (shareable filter + routine state in the URL) ──
// Non-sensitive view state (day, pinned dancers/studios, search text, the Props
// category) is mirrored into the query string so a link reproduces the view.
// Favorites are private/local-only and are never encoded. A single-routine link
// (?routine=<id>) opens cleanly and scrolls/highlights that card.
let _restoringURL = false;
let _pendingRoutineFocus = null;

function currentStateQuery() {
  const p = new URLSearchParams();
  if (activeDay && activeDay !== 'all') p.set('day', activeDay);
  activeDancers.forEach(n => p.append('dancer', n));
  activeStudios.forEach(s => p.append('studio', s));
  if (activeSearch) p.set('q', activeSearch);
  if (activeFilter === 'props') p.set('cat', 'props');
  return p;
}

function syncURL() {
  if (_restoringURL || typeof history === 'undefined' || !history.replaceState) return;
  const qs = currentStateQuery().toString();
  history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
}

function buildRoutineShareURL(id) {
  return location.origin + location.pathname + '?routine=' + encodeURIComponent(id);
}

function restoreFromURL() {
  const p = new URLSearchParams(location.search);
  if (![...p.keys()].length) return;
  _restoringURL = true;

  // A single-routine deep link is handled after the first render (focus only),
  // deliberately ignoring any filter params so the card is always reachable.
  const routine = p.get('routine');
  if (routine) { _pendingRoutineFocus = routine; _restoringURL = false; return; }

  const day = p.get('day');
  if (day && day !== 'all') {
    const btn = document.querySelector('.day-btn[data-day="' + (window.CSS && CSS.escape ? CSS.escape(day) : day) + '"]');
    if (btn) { setActiveInGroup(document.querySelectorAll('.day-btn'), btn); activeDay = day; }
  }
  if (p.get('cat') === 'props') {
    const btn = document.querySelector('.show-btn[data-filter="props"]');
    if (btn) { setActiveInGroup(showBtns, btn); activeFilter = 'props'; }
  }
  const validDancers = new Set(allDancers);
  p.getAll('dancer').forEach(n => { if (validDancers.has(n) && !activeDancers.includes(n)) activeDancers.push(n); });
  const validStudios = new Set(allStudios);
  p.getAll('studio').forEach(s => { if (validStudios.has(s) && !activeStudios.includes(s)) activeStudios.push(s); });
  const q = p.get('q');
  if (q) { activeSearch = q; if (dancerInput) { dancerInput.value = q; updateSearchClear(); } }

  // Pinned dancers supersede the category selector (mirrors addDancer()).
  if (activeDancers.length && activeFilter !== 'props') activeFilter = 'all';
  _restoringURL = false;
}

function focusPendingRoutine() {
  if (!_pendingRoutineFocus) return;
  const id = _pendingRoutineFocus; _pendingRoutineFocus = null;
  const card = document.querySelector('.routine-card[data-routine-id="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]');
  if (!card) return;
  card.classList.remove('hidden');
  const sec = card.closest('.day-section');
  if (sec) { sec.style.display = ''; sec.classList.remove('hidden'); }
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  card.classList.add('deep-target');
  // Keep the spotlight until the user does anything (scroll/tap/key), rather
  // than on a fixed timer — so a slow load never clears it before it's seen.
  // Arm the dismissers slightly late so the initial programmatic scroll doesn't
  // immediately clear it.
  const clear = () => {
    card.classList.remove('deep-target');
    window.removeEventListener('scroll', clear);
    window.removeEventListener('pointerdown', clear);
    window.removeEventListener('keydown', clear);
  };
  setTimeout(() => {
    window.addEventListener('scroll', clear, { once: true, passive: true });
    window.addEventListener('pointerdown', clear, { once: true });
    window.addEventListener('keydown', clear, { once: true });
  }, 900);
}

