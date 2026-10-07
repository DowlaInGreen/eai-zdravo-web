// Shared labels + helpers for prijava / onboarding / dashboard (no framework).
(function () {
  var L = {
    goals: [
      ['save_money', 'Uštedjeti na hrani', 'Akcije iz trgovina, manje dostave i pekare'],
      ['less_time', 'Manje vremena u kuhinji', '2 kuhanja tjedno, 14 obroka'],
      ['more_protein', 'Više proteina', 'Najviše proteina po euru'],
      ['portion_control', 'Kontrolirane porcije', 'Manje porcije, kalorije pod kontrolom'],
      ['kid_friendly', 'Hrana koju djeca jedu', 'Bez eksperimenata za klince']
    ],
    trainingGoals: [
      ['gain_weight', 'Udebljati se'], ['build_muscle', 'Povećati mišićnu masu'],
      ['conditioning', 'Uhvatiti kondiciju'], ['lose_weight', 'Smršavjeti']
    ],
    planStatus: [
      ['has_plan', 'Imam plan', 'Samo nam treba hrana uz njega'],
      ['has_trainer', 'Imam trenera', 'Plan prehrane možeš mu proslijediti'],
      ['needs_ideas', 'Trebam pomoć', 'Ideje za trening uz tvoj jelovnik'],
      ['online_challenges', 'Volim online izazove', 'Tjedni izazovi u Telegram grupi'],
      ['wants_trainer_referral', 'Trebam preporuku za trenera', 'Spojit ćemo vas s provjerenim osobnim trenerom']
    ],
    trainerModes: [['online', 'Online'], ['in_person', 'Uživo (1 na 1)']],
    programs: [
      ['survivor', 'Low cost', 'Survivor', 'Najjeftinije što prolazi. Do 25 € po odraslom tjedno.'],
      ['old_school', 'Retro', 'ExYu Old School', 'Grah, segedin, vrat, bataci. Klasika, uvijek najjeftinija varijanta.'],
      ['modern', 'Obitelj', 'Moderna kuhinja', 'Bowlovi, wok, tjestenina, riba. Brzo i raznoliko.'],
      ['protein_150', 'Fitness', '150 g proteina / dan', 'Samo za odrasle. Makroi uz svako jelo.']
    ],
    diets: [
      ['vegan', 'Vegan'], ['vegetarian', 'Vegetarijanska'], ['un_diet', 'UN dijeta'], ['keto', 'Keto'],
      ['high_protein', 'High protein'], ['low_fat', 'Low fat'], ['gluten_free', 'Bez glutena'], ['lactose_free', 'Bez laktoze']
    ],
    allergens: [
      ['gluten', 'Gluten'], ['milk', 'Mlijeko'], ['eggs', 'Jaja'], ['fish', 'Riba'], ['crustaceans', 'Rakovi'],
      ['molluscs', 'Mekušci'], ['peanuts', 'Kikiriki'], ['tree_nuts', 'Orašasti plodovi'], ['soy', 'Soja'],
      ['sesame', 'Sezam'], ['celery', 'Celer'], ['mustard', 'Gorušica'], ['lupin', 'Lupina'], ['sulphites', 'Sulfiti']
    ],
    leadStatus: { new: 'zaprimljeno', contacted: 'u kontaktu', matched: 'spojeno s trenerom', closed: 'zatvoreno' }
  };

  function label(list, key, idx) {
    for (var i = 0; i < list.length; i++) if (list[i][0] === key) return list[i][idx || 1];
    return key;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var eurFmt = new Intl.NumberFormat('hr-HR', { style: 'currency', currency: 'EUR' });
  var pctFmt = new Intl.NumberFormat('hr-HR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  function eur(x) { return eurFmt.format(x || 0); }
  function pct(x) { return x == null ? '—' : '−' + pctFmt.format(x * 100) + ' %'; }
  function num(x) { return new Intl.NumberFormat('hr-HR').format(x); }
  function date(iso) {
    var d = new Date(iso);
    return new Intl.DateTimeFormat('hr-HR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Zagreb' }).format(d).replace(/\s/g, '');
  }

  function api(path, opts) {
    opts = opts || {};
    var init = { method: opts.method || 'GET', credentials: 'same-origin', headers: {} };
    if (opts.body !== undefined) { init.headers['content-type'] = 'application/json'; init.body = JSON.stringify(opts.body); }
    return fetch(path, init).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, data: j }; });
    });
  }

  function requireLogin(res) {
    if (res.status === 401) {
      location.replace('/prijava?next=' + encodeURIComponent(location.pathname + location.search));
      return true;
    }
    if (res.status === 503) {
      location.replace('/prijava?greska=uskoro');
      return true;
    }
    return false;
  }

  var CHECK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';

  window.EAI = { L: L, label: label, esc: esc, eur: eur, pct: pct, num: num, date: date, api: api, requireLogin: requireLogin, CHECK: CHECK };
})();
