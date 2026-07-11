// APDC — shared PWA install-banner, standalone-close button, and service-worker registration.
// Requires assets/icons.js to be loaded first.
(function () {
  const DISMISSED_KEY = 'apdc-install-dismissed';
  let deferredPrompt = null;

  function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream; }
  function isChrome() { return /CriOS/i.test(navigator.userAgent); }
  function isStandalone() {
    return ('standalone' in navigator && navigator.standalone) ||
      window.matchMedia('(display-mode: standalone)').matches;
  }
  function isDismissed() { return localStorage.getItem(DISMISSED_KEY) === '1'; }
  function markDismissed() { localStorage.setItem(DISMISSED_KEY, '1'); }

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
  });

  function shareInstructionsHTML() {
    return isChrome()
      ? 'Tap the <strong>three dots</strong> menu in the top-right corner of Chrome, then <strong>Add to Home Screen</strong>.'
      : 'Tap the share icon ' + ICONS.share + ' at the bottom of Safari, then <strong>Add to Home Screen</strong>.';
  }

  function initBanner() {
    const banner  = document.getElementById('install-banner');
    if (!banner) return;
    const icon    = document.getElementById('banner-icon');
    const body    = document.getElementById('banner-body');
    const install = document.getElementById('banner-install');
    const dismiss = document.getElementById('banner-dismiss');
    const close   = document.getElementById('banner-close');
    if (icon) icon.innerHTML = ICONS.install;
    if (close) close.innerHTML = ICONS.close;

    function hide() {
      banner.classList.remove('visible');
      setTimeout(() => banner.classList.add('hidden'), 400);
    }
    function doDismiss() { markDismissed(); hide(); }
    function show() {
      banner.classList.remove('hidden');
      setTimeout(() => banner.classList.add('visible'), 50);
    }

    if (dismiss) dismiss.addEventListener('click', doDismiss);
    if (close)   close.addEventListener('click', doDismiss);
    if (install) install.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null;
        if (outcome === 'accepted') doDismiss();
      }
    });

    if (isStandalone() || isDismissed()) return;

    if (isIOS()) {
      if (body) body.innerHTML = shareInstructionsHTML();
      if (install) install.style.display = 'none';
      setTimeout(show, 2500);
    } else {
      window.addEventListener('beforeinstallprompt', () => {
        if (body) body.innerHTML = 'Get quick access to the schedule — tap <strong>Install App</strong> below.';
        if (install) install.style.display = '';
        show();
      });
    }
  }

  function initPwaClose() {
    const btn = document.getElementById('pwa-close');
    if (!btn) return;
    btn.innerHTML = ICONS.close;
    if (isStandalone()) document.body.classList.add('standalone');
    btn.addEventListener('click', () => {
      window.close();
      setTimeout(() => { window.location.href = 'about:blank'; }, 100);
    });
  }

  function initServiceWorker(swPath) {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () =>
      navigator.serviceWorker.register(swPath).catch(() => {})
    );
  }

  window.APDCPwa = {
    isIOS, isChrome, isStandalone, isDismissed, markDismissed, shareInstructionsHTML,
    initServiceWorker,
    getDeferredPrompt: () => deferredPrompt,
    clearDeferredPrompt: () => { deferredPrompt = null; }
  };

  window.addEventListener('DOMContentLoaded', () => {
    initPwaClose();
    initBanner();
  });
})();
