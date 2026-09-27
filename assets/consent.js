/* E-AI zdravo: privola za kolačiće + Meta Pixel.
   Pixel se učitava TEK nakon klika "Prihvati" (GDPR / ePrivacy). Odbijanje = ništa se ne učitava.
   Izbor se pamti u localStorage ("eai_consent" = "yes" | "no"). Promjena: link "Postavke kolačića" (data-consent-reset).
   Događaji: window.eaiTrack('Lead') — šalje se samo ako je privola dana, inače tiho ništa. */
(function () {
  var PIXEL_ID = '1608983517302133';
  var KEY = 'eai_consent';
  var queue = [];

  function get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function set(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }

  function loadPixel() {
    if (window.fbq) return;
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', PIXEL_ID);
    window.fbq('track', 'PageView');
    while (queue.length) window.fbq.apply(null, queue.shift());
  }

  window.eaiTrack = function (event, params, opts) {
    if (get() !== 'yes') return;
    var args = ['track', event, params || {}].concat(opts ? [opts] : []);
    if (window.fbq) window.fbq.apply(null, args); else queue.push(args);
  };

  function banner() {
    var css = document.createElement('style');
    css.textContent =
      '.eai-cc{position:fixed;left:16px;right:16px;bottom:16px;z-index:9999;max-width:560px;margin:0 auto;' +
      'background:#fff;color:#1a1a1a;border:1px solid rgba(0,0,0,.12);border-radius:14px;box-shadow:0 8px 28px rgba(0,0,0,.14);' +
      'padding:16px 18px;font:15px/1.45 Figtree,system-ui,sans-serif;display:flex;flex-wrap:wrap;gap:12px;align-items:center}' +
      '.eai-cc p{margin:0;flex:1 1 260px}.eai-cc a{color:inherit}' +
      '.eai-cc .b{display:flex;gap:8px;flex:0 0 auto}' +
      '.eai-cc button{font:600 14px Figtree,system-ui,sans-serif;border-radius:999px;padding:9px 16px;cursor:pointer;border:1px solid #1a1a1a}' +
      '.eai-cc .y{background:#1a1a1a;color:#fff}.eai-cc .n{background:#fff;color:#1a1a1a}' +
      '@media (prefers-color-scheme:dark){.eai-cc{background:#1c1c1e;color:#f2f2f2;border-color:rgba(255,255,255,.14)}' +
      '.eai-cc button{border-color:#f2f2f2}.eai-cc .y{background:#f2f2f2;color:#1c1c1e}.eai-cc .n{background:transparent;color:#f2f2f2}}';
    document.head.appendChild(css);
    var el = document.createElement('div');
    el.className = 'eai-cc'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Kolačići');
    el.innerHTML = '<p>Koristimo Meta kolačić da izmjerimo koliko ljudi dođe preko oglasa. Bez tvoje privole ne učitavamo ništa. ' +
      '<a href="/privatnost#kolacici">Više</a></p><div class="b"><button type="button" class="n">Odbij</button>' +
      '<button type="button" class="y">Prihvati</button></div>';
    el.querySelector('.y').onclick = function () { set('yes'); el.remove(); loadPixel(); };
    el.querySelector('.n').onclick = function () { set('no'); el.remove(); };
    document.body.appendChild(el);
  }

  function init() {
    var c = get();
    if (c === 'yes') loadPixel();
    else if (c !== 'no') banner();
    document.querySelectorAll('[data-consent-reset]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault(); try { localStorage.removeItem(KEY); } catch (x) {}
        if (!document.querySelector('.eai-cc')) banner();
      });
    });
  }

  function cookie(n) { var m = document.cookie.match('(?:^|; )' + n + '=([^;]*)'); return m ? decodeURIComponent(m[1]) : ''; }
  // Podaci za server-side Lead (CAPI). Prazno ako nema privole.
  window.eaiMeta = function () {
    if (get() !== 'yes') return { meta_consent: false };
    var id = 'lead-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
    var fbc = cookie('_fbc');
    var clid = new URLSearchParams(location.search).get('fbclid');
    if (!fbc && clid) fbc = 'fb.1.' + Date.now() + '.' + clid;
    return { meta_consent: true, event_id: id, fbp: cookie('_fbp'), fbc: fbc, source_url: location.href.split('#')[0] };
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
