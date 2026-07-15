// APDC — shared schedule template engine for competition pages, split (W3.9)
// into focused files that share one global scope (classic scripts, not ES
// modules — the inline per-page COMPETITION_CONFIG/SCHEDULE script wouldn't be
// visible to a module's isolated scope). They must load in this order via
// separate <script src> tags:
//
//   1. schedule-data.js     — favorites persistence, routine/dancer/studio model
//   2. schedule-cards.js    — routine card rendering + favorites UI
//   3. schedule-calendar.js — share + .ics calendar export
//   4. schedule-build.js    — reads COMPETITION_CONFIG/SCHEDULE, builds the DOM
//   5. schedule-filters.js  — filter state, drawer, applyFilters
//   6. schedule-search.js   — dancer/studio pickers, active-filter chips, search
//   7. schedule-toolbar.js  — time offset, density toggle, print, clear-all
//   8. schedule-api.js      — window.APDC public API, shareable deep links
//   9. schedule-init.js     — DOMContentLoaded bootstrap
//
// Reads a page-local `COMPETITION_CONFIG` + `SCHEDULE` (day key -> ordered list of
// { type: 'routine' | 'meta' | 'awards' | 'category', ... }) and renders the
// filterable, searchable schedule UI. Requires assets/icons.js.
//
// TO USE FOR A NEW COMPETITION: define COMPETITION_CONFIG + SCHEDULE in the page,
// include the shared markup (header/filter-bar/offset-bar/main), then load all
// nine files above in order — easiest by copying an existing competition
// page's <script> block, which already has them in the right order.

const STYLE_CLASS = {
  'Jazz': 'style-jazz', 'Contemporary': 'style-contemporary',
  'Lyrical': 'style-lyrical', 'Hip-Hop': 'style-hiphop',
  'Tap': 'style-tap', 'Musical Theater': 'style-musical', 'Open': 'style-open'
};

const OFFSET_KEY = 'apdc-schedule-offset';
const OFFSET_NOTE_KEY = 'apdc-offset-note-seen'; // first-use disclaimer toast flag
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

