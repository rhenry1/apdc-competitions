// ── Bootstrap ──
window.addEventListener('DOMContentLoaded', () => {
  buildSchedule();
  document.querySelectorAll('.day-section').forEach(s => { s.style.display = ''; s.classList.remove('hidden'); });

  const savedOffset = parseInt(localStorage.getItem(OFFSET_KEY));
  applyOffset(Number.isFinite(savedOffset) ? savedOffset : 0, { persist: false });

  initA11y();
  initToolbar();
  initScheduleTools();
  initSearchClear();
  initActiveFilters();
  initFilterDrawer();
  restoreFromURL();
  applyFilters();
  focusPendingRoutine();
  APDCPwa.initServiceWorker('../service-worker.js');
});
