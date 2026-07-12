// APDC — shared PWA install-banner and service-worker registration.
// Requires assets/icons.js to be loaded first.
(function () {
  const DISMISSED_KEY = 'apdc-install-dismissed';
  let deferredPrompt = null;

  function isIOS()     { return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream; }
  function isAndroid() { return /android/i.test(navigator.userAgent); }
  function isFirefox() { return /firefox|fxios/i.test(navigator.userAgent); }
  function isSamsung() { return /samsungbrowser/i.test(navigator.userAgent); }
  function isSafari() {
    // True Safari (iOS or macOS) — excludes the other browsers that also
    // include "Safari" in their UA string (Chrome, Firefox, Edge, Opera).
    return /safari/i.test(navigator.userAgent) && !/crios|fxios|edgios|opios|chrome|edg\//i.test(navigator.userAgent);
  }
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

  // Returns { html, button } describing how to install on the current
  // browser, or null when this browser has no install path at all
  // (e.g. desktop Firefox) — callers should hide install UI in that case.
  function installInstructions() {
    if (isIOS()) {
      if (isSafari()) {
        return { html: 'Tap the share icon ' + ICONS.share + ' at the bottom of Safari, then <strong>Add to Home Screen</strong>.', button: false };
      }
      // Every other iOS browser is a WebKit wrapper with its own menu layout
      // that varies by app and changes often (Chrome-for-iOS, for example,
      // has since moved its menu from top-right to the bottom toolbar) —
      // rather than guess a specific menu location and risk being wrong,
      // point people to Safari, the one flow guaranteed to actually work.
      return { html: 'Open this page in <strong>Safari</strong> for the full app experience — tap the share icon, then <strong>Add to Home Screen</strong>.', button: false };
    }
    if (isAndroid()) {
      if (isSamsung()) {
        return { html: 'Tap the menu <strong>&#9776;</strong>, then <strong>Add page to</strong> &rarr; <strong>Home screen</strong>.', button: false };
      }
      if (isFirefox()) {
        return { html: 'Tap the menu <strong>&#8942;</strong>, then <strong>Install</strong> (or <strong>Add to Home screen</strong>).', button: false };
      }
      // Chrome, Edge, and other Chromium-based Android browsers support the
      // native install prompt — show the manual steps too until it fires.
      return { html: 'Tap the menu <strong>&#8942;</strong>, then <strong>Install app</strong>.', button: true };
    }
    // Desktop
    if (isSafari()) {
      return { html: 'Click <strong>File</strong> &rarr; <strong>Add to Dock</strong> in Safari&rsquo;s menu bar.', button: false };
    }
    if (isFirefox()) {
      return null; // desktop Firefox has no install/home-screen equivalent
    }
    // Chromium-based desktop browsers (Chrome, Edge) support the native prompt.
    return { html: 'Click the install icon in your address bar, or the menu <strong>&#8942;</strong> &rarr; <strong>Install APDC Competitions</strong>.', button: true };
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

    const info = installInstructions();
    if (!info) return; // nothing actionable on this browser — don't show the banner

    if (body) body.innerHTML = info.html;
    // The install button only works once a native prompt is actually ready;
    // keep it hidden until then so it's never a dead click.
    if (install) install.style.display = 'none';
    if (info.button) {
      window.addEventListener('beforeinstallprompt', () => {
        if (body) body.innerHTML = 'Get quick access to the schedule — tap <strong>Install App</strong> below.';
        if (install) install.style.display = '';
      });
    }

    setTimeout(show, 2500);
  }

  // "Schedule update available" toast — shown when an updated service worker
  // is installed and waiting. Refresh is always the user's choice; we never
  // reload mid-view on our own.
  let _updateUserInitiated = false;
  function showUpdateToast(waitingWorker) {
    if (document.getElementById('update-toast')) return;
    const toast = document.createElement('div');
    toast.id = 'update-toast';
    toast.className = 'update-toast';
    toast.setAttribute('role', 'status');
    toast.innerHTML =
      '<span class="update-toast-text">Schedule update available</span>' +
      '<button type="button" class="update-refresh">Refresh</button>';
    toast.querySelector('.update-refresh').addEventListener('click', () => {
      _updateUserInitiated = true;
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    });
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('visible'));
  }

  function initServiceWorker(swPath) {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(swPath).then(reg => {
        // Update already waiting from a previous visit.
        if (reg.waiting && navigator.serviceWorker.controller) showUpdateToast(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const next = reg.installing;
          if (!next) return;
          next.addEventListener('statechange', () => {
            // "installed" with an existing controller = a new version is
            // waiting. Without a controller it's the very first install —
            // nothing to announce.
            if (next.state === 'installed' && navigator.serviceWorker.controller) {
              showUpdateToast(reg.waiting || next);
            }
          });
        });
      }).catch(() => {});

      // Reload only for a user-chosen update. controllerchange also fires on
      // the very first install (clients.claim) — never reload for that.
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!_updateUserInitiated) return;
        _updateUserInitiated = false;
        location.reload();
      });
    });
  }

  // Subtle "you're offline" pill (bottom-center, safe-area aware). The cached
  // schedule keeps being served either way — this only tells the user why the
  // content might not be the latest. Injected lazily on first need.
  function initOfflineIndicator() {
    let el = null;
    function ensure() {
      if (!el) {
        el = document.createElement('div');
        el.id = 'offline-indicator';
        el.className = 'offline-indicator';
        el.setAttribute('role', 'status');
        el.innerHTML = '<span class="offline-dot"></span>Offline — showing saved schedule';
        document.body.appendChild(el);
      }
      return el;
    }
    function update() {
      if (navigator.onLine === false) ensure().classList.add('visible');
      else if (el) el.classList.remove('visible');
    }
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();
  }

  window.APDCPwa = {
    isIOS, isAndroid, isFirefox, isSamsung, isSafari, isStandalone,
    isDismissed, markDismissed, installInstructions, initServiceWorker,
    getDeferredPrompt: () => deferredPrompt,
    clearDeferredPrompt: () => { deferredPrompt = null; }
  };

  window.addEventListener('DOMContentLoaded', () => {
    initBanner();
    initOfflineIndicator();
  });
})();
