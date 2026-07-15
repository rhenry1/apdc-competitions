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
  const url = buildRoutineShareURL(r.id);
  const text = `${r.routineName} — ${dayConf.title || ''} at ${r.scheduledTime}` +
    (r.stage ? ` (Stage ${r.stage})` : '') +
    (r.dancersText ? `\n${r.dancersText}` : '') +
    `\n${COMPETITION_CONFIG.name}`;

  if (navigator.share) {
    try { await navigator.share({ title: r.routineName, text, url }); } catch (e) { /* user cancelled */ }
    return;
  }
  try {
    // Clipboard fallback carries the deep link so the recipient lands on the card.
    await navigator.clipboard.writeText(text + '\n' + url);
    showToast('Link copied to clipboard');
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

function icsSlug(s, max) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max || 60);
}

// A routine's start/end as Date objects (15-min reminder block), or null if the
// date is unknown.
function routineStartEnd(r) {
  const scheduledDate = r.scheduledDate;
  if (!scheduledDate) return null;
  const [timePart, ampm] = r.scheduledTime.trim().split(' ');
  let [hour, minute] = timePart.split(':').map(Number);
  if (ampm === 'pm' && hour !== 12) hour += 12;
  if (ampm === 'am' && hour === 12) hour = 0;
  const [y, mo, d] = scheduledDate.split('-').map(Number);
  const start = new Date(y, mo - 1, d, hour, minute);
  return { start, end: new Date(start.getTime() + 15 * 60000) };
}

// Parse a display time ("8:45 am") into minutes-since-midnight, or null if it
// can't be parsed. Used only to order/label the published schedule — never to
// imply real-time event state.
function timeToMinutes(display) {
  if (!display) return null;
  const parts = display.trim().split(' ');
  if (parts.length < 2) return null;
  const [timePart, ampm] = parts;
  const [h, m] = timePart.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  let hour = h;
  if (/pm/i.test(ampm) && hour !== 12) hour += 12;
  if (/am/i.test(ampm) && hour === 12) hour = 0;
  return hour * 60 + m;
}

// Human duration from a minute count: "1h 20m", "45m".
function formatGap(mins) {
  const h = Math.floor(mins / 60), m = mins % 60;
  return (h ? h + 'h' : '') + (h && m ? ' ' : '') + (m || !h ? m + 'm' : '');
}

// One VEVENT (array of lines) for a routine, or null if it has no date.
function buildVEvent(r) {
  const se = routineStartEnd(r);
  if (!se) return null;
  const description = [r.dancersText, r.formatTag, r.stage ? `Stage ${r.stage}` : '',
    'Scheduled time — competition times may change. Arrive a few minutes early.']
    .filter(Boolean).join('\n');
  return [
    'BEGIN:VEVENT',
    `UID:${r.id}@apdc-competitions`,
    `DTSTART:${icsDateTime(se.start)}`,
    `DTEND:${icsDateTime(se.end)}`,
    `SUMMARY:${icsEscape(r.routineName + (r.routineNumber ? ` (#${r.routineNumber})` : '') + ' — ' + COMPETITION_CONFIG.name)}`,
    `DESCRIPTION:${icsEscape(description)}`,
    `LOCATION:${icsEscape(locationLabel(COMPETITION_CONFIG.location))}`,
    'END:VEVENT',
  ];
}

function wrapICS(eventLineArrays) {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//APDC Competitions//EN']
    .concat(...eventLineArrays)
    .concat(['END:VCALENDAR'])
    .join('\r\n');
}

function triggerICSDownload(ics, filename) {
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadICS(r) {
  const ev = buildVEvent(r);
  if (!ev) { showToast('Date unavailable for this routine'); return; }
  triggerICSDownload(wrapICS([ev]), `${r.routineNumber || 'routine'}-${icsSlug(r.routineName)}.ics`);
}

// Export every favorited routine as a single multi-event calendar file.
function exportFavoritesICS() {
  const events = allRoutines.filter(r => favorites.has(r.id)).map(buildVEvent).filter(Boolean);
  if (!events.length) { showToast('No favorites to export yet'); return; }
  triggerICSDownload(wrapICS(events), `${icsSlug(COMPETITION_CONFIG.name)}-favorites.ics`);
  showToast(`Exported ${events.length} favorite${events.length === 1 ? '' : 's'} to calendar`);
}

