/* =========================================================
   Dotty Homes — /estimate/ form behaviour

   Posts to the `lead-intake` Supabase Edge Function, which stores the
   lead and pings Slack so someone can call back inside the 5-minute SLA.

   Nothing secret lives here: the endpoint is a public URL protected by
   Turnstile + a honeypot + a time trap, and there is no anon key at all
   (the function writes with a service role that never leaves the server).

   The governing rule for every branch below: a lost lead costs far more
   than a spam row. When something goes wrong we keep what the visitor
   typed and hand them a phone number — we never clear the form.
   ========================================================= */
(function () {
  'use strict';

  var ENDPOINT = 'https://pwrnywsojomrygsiezzi.supabase.co/functions/v1/lead-intake';

  /* Cloudflare Turnstile site key (public — safe in this file).
     Empty until the widget is created in the Cloudflare dashboard. While
     it's empty the widget is simply skipped: the honeypot and time trap
     still run server-side, and every lead arrives flagged
     `suspected_spam` so nothing is silently trusted. Fill this in and the
     verification turns itself on with no other change. */
  var TURNSTILE_SITEKEY = '';

  /* Sources the print pieces use. Anything else is ignored so a stray
     query string can't pollute which placement gets credit. The function
     whitelists these again server-side. */
  var VALID_SRC = ['flyer', 'banner', 'yard', 'door'];
  var SRC_KEY = 'dotty_src';

  var form = document.getElementById('estimateForm');
  var formCard = document.getElementById('formCard');
  var thanksCard = document.getElementById('thanksCard');
  var submitBtn = document.getElementById('submitBtn');
  var errorBox = document.getElementById('errorBox');
  var renderedAt = Date.now();
  var turnstileWidgetId = null;

  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ── Attribution ──────────────────────────────────────────────────
     A QR on a flyer lands on /estimate/?src=flyer. Stash it in the
     session so it survives a reload or a detour to the homepage and
     back — the scan is the only moment we learn where they came from. */
  function resolveSrc() {
    var q = '';
    try {
      q = (new URLSearchParams(window.location.search).get('src') || '').toLowerCase();
    } catch (e) { /* very old browser — fall through to storage */ }

    if (VALID_SRC.indexOf(q) !== -1) {
      try { sessionStorage.setItem(SRC_KEY, q); } catch (e) { /* private mode */ }
      return q;
    }
    try {
      var stored = sessionStorage.getItem(SRC_KEY);
      if (stored && VALID_SRC.indexOf(stored) !== -1) return stored;
    } catch (e) { /* private mode */ }
    return 'web';
  }

  /* ── Turnstile (optional) ─────────────────────────────────────────
     Loaded only when a site key is configured. If the script is blocked
     the token comes back empty and the server flags the lead rather than
     dropping it, so this never becomes a wall between a neighbor and us. */
  function loadTurnstile() {
    if (!TURNSTILE_SITEKEY) return;
    window.onTurnstileLoad = function () {
      if (!window.turnstile) return;
      turnstileWidgetId = window.turnstile.render('#turnstile-slot', {
        sitekey: TURNSTILE_SITEKEY,
        size: 'flexible',
        theme: 'light'
      });
    };
    var s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad&render=explicit';
    s.async = true;
    s.defer = true;
    document.head.appendChild(s);
  }

  function turnstileToken() {
    if (!window.turnstile || turnstileWidgetId === null) return '';
    try { return window.turnstile.getResponse(turnstileWidgetId) || ''; } catch (e) { return ''; }
  }

  /* ── UI helpers ───────────────────────────────────────────────────── */
  function showError(html) {
    errorBox.innerHTML = html;
    errorBox.hidden = false;
    errorBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function clearError() {
    errorBox.hidden = true;
    errorBox.textContent = '';
  }

  function val(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function markInvalid(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.setAttribute('aria-invalid', 'true');
    el.focus();
  }

  function clearInvalid() {
    ['name', 'phone'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.removeAttribute('aria-invalid');
    });
  }

  /* Same 10-digit rule the server applies — checking here just saves the
     visitor a round trip. */
  function phoneLooksDialable(raw) {
    var d = raw.replace(/\D/g, '');
    if (d.length === 11 && d.charAt(0) === '1') d = d.slice(1);
    return d.length === 10;
  }

  /* ── Submit ───────────────────────────────────────────────────────── */
  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    clearError();
    clearInvalid();

    if (!val('name')) {
      showError('Please tell us your name so we know who we’re calling.');
      markInvalid('name');
      return;
    }
    if (!phoneLooksDialable(val('phone'))) {
      showError('Please enter a 10-digit phone number so we can call you back.');
      markInvalid('phone');
      return;
    }

    var payload = {
      name: val('name'),
      phone: val('phone'),
      email: val('email'),
      city: val('city'),
      project_type: val('project_type'),
      notes: val('notes'),
      company: val('company'),
      src: resolveSrc(),
      page: window.location.href,
      referrer: document.referrer || '',
      turnstile_token: turnstileToken(),
      elapsed_ms: Date.now() - renderedAt
    };

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';

    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (resp) {
        return resp.json().catch(function () { return { ok: resp.ok }; });
      })
      .then(function (data) {
        if (data && data.ok) {
          formCard.hidden = true;
          thanksCard.hidden = false;
          thanksCard.focus();
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
        // A validation message from the server — the visitor can fix this.
        restoreButton();
        showError(
          (data && data.error)
            ? escapeHtml(data.error)
            : fallbackMessage()
        );
      })
      .catch(function () {
        // Network died, or the function is down. Their answers stay on
        // screen; give them a way through that doesn't depend on us.
        restoreButton();
        showError(fallbackMessage());
      });
  });

  function restoreButton() {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Request my free estimate';
  }

  function fallbackMessage() {
    return 'We couldn’t send that just now — nothing you typed is lost. ' +
      'Please try again, or call us at <a href="tel:+16263404388">626&nbsp;340&nbsp;4388</a> ' +
      'or email <a href="mailto:hello@dottyhomes.com">hello@dottyhomes.com</a>.';
  }

  function escapeHtml(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  loadTurnstile();
  resolveSrc(); // capture the QR source at load, not only at submit
})();
