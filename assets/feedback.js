// APDC — feedback widget.
//
// A small "Feedback" launcher that opens a message composer (idea / bug /
// other). Submissions POST to a serverless proxy that files a GitHub issue and
// emails the studio (see docs/FEEDBACK-SETUP.md). Requires assets/icons.js.
//
// Ships DORMANT: it renders nothing until an endpoint is configured in
// assets/feedback-config.js, so there's no dead UI before setup. Privacy: we
// deliberately don't collect name/email — feedback lands in an issue tracker,
// which may be public.
(function () {
  'use strict';

  var ENDPOINT = (window.APDC_FEEDBACK_ENDPOINT || '').trim();
  if (!ENDPOINT) return;

  var CATEGORIES = [
    { id: 'idea', label: 'Idea' },
    { id: 'bug', label: 'Bug' },
    { id: 'other', label: 'Other' }
  ];

  var category = 'idea';
  var openedAt = 0;
  var lastFocus = null;
  var launch, panel, textarea, hp, sendBtn, statusEl;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function build() {
    launch = document.createElement('button');
    launch.type = 'button';
    launch.id = 'feedback-launch';
    launch.className = 'fb-launch';
    launch.setAttribute('aria-haspopup', 'dialog');
    launch.setAttribute('aria-expanded', 'false');
    launch.innerHTML = ICONS.chat + '<span>Feedback</span>';
    document.body.appendChild(launch);

    panel = document.createElement('div');
    panel.id = 'feedback-panel';
    panel.className = 'fb-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'false');
    panel.setAttribute('aria-labelledby', 'fb-title');
    panel.hidden = true;
    panel.innerHTML =
      '<div class="fb-head">' +
        '<span id="fb-title" class="fb-title">Send feedback</span>' +
        '<button type="button" class="fb-close" id="fb-close" aria-label="Close feedback"></button>' +
      '</div>' +
      '<div class="fb-body" id="fb-body">' +
        '<p class="fb-intro">Have an idea, a request, or found a bug? Send it over — every note is read.</p>' +
        '<div class="fb-cats" role="group" aria-label="Feedback type">' +
          CATEGORIES.map(function (c) {
            return '<button type="button" class="fb-cat' + (c.id === 'idea' ? ' active' : '') +
              '" data-cat="' + c.id + '" aria-pressed="' + (c.id === 'idea') + '">' + c.label + '</button>';
          }).join('') +
        '</div>' +
        '<label class="fb-label" for="fb-message">Your feedback</label>' +
        '<textarea id="fb-message" class="fb-textarea" rows="4" maxlength="2000" ' +
          'placeholder="What would you love to see? Or what went wrong?"></textarea>' +
        // Honeypot: hidden from people, tempting to bots. Real users leave it empty.
        '<input type="text" class="fb-hp" id="fb-hp" name="company" tabindex="-1" autocomplete="off" aria-hidden="true">' +
        '<button type="button" class="fb-send" id="fb-send">Send feedback</button>' +
        '<p class="fb-status" id="fb-status" role="status" aria-live="polite"></p>' +
      '</div>';
    document.body.appendChild(panel);

    panel.querySelector('#fb-close').innerHTML = ICONS.close;
    textarea = panel.querySelector('#fb-message');
    hp = panel.querySelector('#fb-hp');
    sendBtn = panel.querySelector('#fb-send');
    statusEl = panel.querySelector('#fb-status');

    launch.addEventListener('click', toggle);
    panel.querySelector('#fb-close').addEventListener('click', close);
    sendBtn.addEventListener('click', submit);
    panel.querySelectorAll('.fb-cat').forEach(function (b) {
      b.addEventListener('click', function () {
        category = b.dataset.cat;
        panel.querySelectorAll('.fb-cat').forEach(function (x) {
          var on = x === b;
          x.classList.toggle('active', on);
          x.setAttribute('aria-pressed', String(on));
        });
      });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !panel.hidden) close();
    });
  }

  function setStatus(msg, kind) {
    statusEl.textContent = msg || '';
    statusEl.className = 'fb-status' + (kind ? ' fb-status--' + kind : '');
  }

  function toggle() { panel.hidden ? open() : close(); }

  function open() {
    lastFocus = document.activeElement;
    panel.hidden = false;
    launch.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(function () { panel.classList.add('open'); });
    openedAt = Date.now();
    setStatus('');
    setTimeout(function () { textarea.focus(); }, 60);
  }

  function close() {
    panel.classList.remove('open');
    launch.setAttribute('aria-expanded', 'false');
    setTimeout(function () { panel.hidden = true; }, 220);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function submit() {
    var msg = textarea.value.trim();
    if (msg.length < 3) { setStatus('Please add a little more detail.', 'err'); textarea.focus(); return; }
    // Bot filled the honeypot — pretend it worked and quietly drop it.
    if (hp.value) { showThanks(); return; }

    sendBtn.disabled = true;
    setStatus('Sending…');
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: msg,
        category: category,
        page: location.pathname + location.search,
        ua: navigator.userAgent,
        ts: new Date().toISOString(),
        elapsed: Date.now() - openedAt,
        hp: hp.value
      })
    }).then(function (r) {
      if (!r.ok) throw new Error('bad status');
      return r.json().catch(function () { return {}; });
    }).then(function () {
      showThanks();
    }).catch(function () {
      sendBtn.disabled = false;
      setStatus('Couldn’t send just now — please try again in a moment.', 'err');
    });
  }

  function showThanks() {
    panel.querySelector('#fb-body').innerHTML =
      '<div class="fb-thanks">' + ICONS.check +
      '<p class="fb-thanks-title">Thank you!</p>' +
      '<p class="fb-thanks-sub">Your feedback came through — thanks for helping make this better.</p></div>';
    setTimeout(close, 2600);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
