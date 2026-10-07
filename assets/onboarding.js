// Onboarding /onboarding/1..6 (one page, one step at a time). Data via /api/me + /api/onboarding.
(function () {
  var E = window.EAI, L = E.L, esc = E.esc;
  var $main = document.getElementById('main');
  var $foot = document.getElementById('foot');
  var q = new URLSearchParams(location.search);
  var m = location.pathname.match(/\/onboarding\/([1-6])/);
  var S = { step: m ? Number(m[1]) : 1, edit: q.get('edit') === '1', me: null, d: {}, errors: {}, busy: false, msg: '' };

  var INFO = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16.5v.5"/></svg>';
  var LOCK = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2C5E1F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
  var MINUS = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2C5E1F" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg>';
  var PLUS = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/><path d="M12 5v14"/></svg>';

  // ---------- state from server ----------
  function initData() {
    var me = S.me, p = me.profile || {}, t = me.training, h = me.household || {};
    S.d = {
      1: { consent: Boolean(p.health_consent_at), birth_year: p.birth_year || '', height_cm: p.height_cm || '', weight_kg: p.weight_kg || '' },
      2: { goals: (p.goals || []).slice() },
      3: t ? { trains: t.trains, training_goal: t.training_goal, plan_status: (t.plan_status || []).slice(), trainer_mode: t.trainer_mode }
           : { trains: null, training_goal: null, plan_status: [], trainer_mode: null },
      4: { program: h.program || null, diets: (h.diets || []).slice() },
      5: { allergens: (h.allergens || []).slice(), dislikes: h.dislikes || '' },
      6: { adults: h.adults || 2, children: h.children == null ? 0 : h.children }
    };
    var tg = S.d[3].training_goal;
    if (!S.d[4].program && S.d[3].trains && (tg === 'build_muscle' || tg === 'gain_weight')) S.d[4].program = 'protein_150';
  }

  // ---------- small builders ----------
  function checkOpt(act, key, on, title, sub, role, disabled) {
    return '<button type="button" class="opt" role="' + (role || 'checkbox') + '" aria-checked="' + on + '" data-act="' + act + '" data-k="' + key + '"' + (disabled ? ' disabled' : '') + '>' +
      '<span class="box">' + E.CHECK + '</span><span class="opt-t"><b>' + esc(title) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span></button>';
  }
  function field(id, label, value, opts) {
    var err = S.errors[id];
    return '<div class="field"><label for="' + id + '">' + label + '</label>' +
      '<input id="' + id + '" name="' + id + '" type="number" inputmode="' + (opts.dec ? 'decimal' : 'numeric') + '" placeholder="' + opts.ph + '" value="' + esc(value) + '"' +
      (opts.disabled ? ' disabled' : '') + (err ? ' aria-invalid="true" aria-describedby="' + id + '-err"' : '') + '>' +
      (err ? '<span class="err" id="' + id + '-err">' + esc(err) + '</span>' : '') + '</div>';
  }
  function head(title, lead) {
    return '<div><h1 class="title">' + title + '</h1>' + (lead ? '<p class="lead">' + lead + '</p>' : '') + '</div>';
  }
  function errNote() {
    return S.msg ? '<p class="note warn" role="alert">' + INFO + '<span>' + esc(S.msg) + '</span></p>' : '';
  }

  // ---------- steps ----------
  var STEPS = {
    1: function (d) {
      var off = !d.consent;
      return {
        main: head('Krenimo od tebe', 'Tri broja i znamo koliku porciju i koliko proteina planirati. Treba 30 sekundi.') + errNote() +
          '<label class="consent"><input type="checkbox" id="consent" data-act="consent"' + (d.consent ? ' checked' : '') + '>' +
          '<span>Pristajem da E-AI zdravo koristi visinu, težinu i alergene samo za izračun porcija. Privolu mogu povući u postavkama.</span></label>' +
          field('birth_year', 'Godište', d.birth_year, { ph: 'npr. 1986', disabled: off }) +
          '<div class="grid2">' + field('height_cm', 'Visina (cm)', d.height_cm, { ph: '182', disabled: off }) +
          field('weight_kg', 'Težina (kg)', d.weight_kg, { ph: '88', dec: true, disabled: off }) + '</div>' +
          '<p class="note">' + LOCK + '<span>Podaci služe samo za izračun porcija. Ne dijelimo ih i možeš ih obrisati na dashboardu.</span></p>',
        foot: primary('Dalje', false) + '<button type="button" class="btn-ghost" data-act="skip1">Preskoči — koristi standardnu porciju</button>'
      };
    },
    2: function (d) {
      var full = d.goals.length >= 2;
      return {
        main: head('Što ti je najvažnije?', 'Odaberi do 2. Prema tome slažemo omjer cijene, porcija i proteina.') + errNote() +
          '<div class="opts" role="group" aria-label="Ciljevi">' + L.goals.map(function (g) {
            var on = d.goals.indexOf(g[0]) >= 0;
            return checkOpt('goal', g[0], on, g[1], g[2], 'checkbox', full && !on);
          }).join('') + '</div>',
        foot: primary('Dalje', d.goals.length === 0)
      };
    },
    3: function (d) {
      var yes = d.trains === true;
      var ref = d.plan_status.indexOf('wants_trainer_referral') >= 0;
      var html = head('Treniraš?', 'Ako da, porcije i proteine prilagođavamo treningu.') + errNote() +
        '<div class="seg" role="radiogroup" aria-label="Treniraš">' +
        '<button type="button" role="radio" aria-checked="' + (d.trains === true) + '" data-act="trains" data-k="1">Da</button>' +
        '<button type="button" role="radio" aria-checked="' + (d.trains === false) + '" data-act="trains" data-k="0">Ne</button></div>';
      if (yes) {
        html += '<div class="opts"><h2 class="sub">Cilj treninga</h2><div class="agrid" role="radiogroup" aria-label="Cilj treninga">' +
          L.trainingGoals.map(function (g) { return checkOpt('tgoal', g[0], d.training_goal === g[0], g[1], '', 'radio'); }).join('') + '</div></div>' +
          '<div class="opts"><div><h2 class="sub">Imaš li plan treninga?</h2><p class="hint">Može više odgovora.</p></div>' +
          L.planStatus.map(function (o) { return checkOpt('pstatus', o[0], d.plan_status.indexOf(o[0]) >= 0, o[1], o[2]); }).join('') + '</div>';
        if (ref) {
          html += '<div class="subcard"><b>Kako želiš trenirati s trenerom?</b>' +
            '<div class="seg" role="radiogroup" aria-label="Način rada s trenerom">' +
            L.trainerModes.map(function (mo) { return '<button type="button" role="radio" aria-checked="' + (d.trainer_mode === mo[0]) + '" data-act="tmode" data-k="' + mo[0] + '">' + mo[1] + '</button>'; }).join('') +
            '</div><p class="hint">Javit ćemo ti se s provjerenim osobnim trenerom. Bez obveze.</p></div>';
        }
      }
      var ok = d.trains === false || (yes && d.training_goal && (!ref || d.trainer_mode));
      return { main: html, foot: primary('Dalje', !ok) };
    },
    4: function (d) {
      var warn = conflict(d.program, d.diets);
      return {
        main: head('Kakvu kuhinju želiš?', 'Jedan program. Možeš ga mijenjati svaki tjedan.') + errNote() +
          '<div class="tiles" role="radiogroup" aria-label="Program">' + L.programs.map(function (p) {
            return '<button type="button" class="tile" role="radio" aria-checked="' + (d.program === p[0]) + '" data-act="program" data-k="' + p[0] + '">' +
              '<span class="k">' + p[1] + '</span><b>' + p[2] + '</b><small>' + p[3] + '</small></button>';
          }).join('') + '</div>' +
          '<div><h2 class="sub">Način prehrane <span style="font-weight:600;color:var(--c-muted)">(opcionalno)</span></h2><p class="hint">Filtrira jela unutar odabranog programa. Može više.</p></div>' +
          '<div class="chips">' + L.diets.map(function (x) {
            return '<button type="button" class="chip" aria-pressed="' + (d.diets.indexOf(x[0]) >= 0) + '" data-act="diet" data-k="' + x[0] + '">' + x[1] + '</button>';
          }).join('') + '</div>' +
          (warn ? '<p class="note warn" role="status">' + INFO + '<span>' + warn + '</span></p>' : ''),
        foot: primary('Dalje', !d.program)
      };
    },
    5: function (d) {
      return {
        main: head('Što ne smije u lonac?', 'Označi alergene za bilo koga u kućanstvu. Ta jela i sastojci ne ulaze u plan.') + errNote() +
          '<div class="agrid" role="group" aria-label="Alergeni">' + L.allergens.map(function (a) {
            return checkOpt('allergen', a[0], d.allergens.indexOf(a[0]) >= 0, a[1], '');
          }).join('') + '</div>' +
          '<div class="field"><label for="dislikes">Ne jedemo / ne volimo</label>' +
          '<input id="dislikes" type="text" maxlength="200" placeholder="npr. jetrica, gljive, ljuto" value="' + esc(d.dislikes) + '"></div>',
        foot: primary('Dalje', false) + '<button type="button" class="btn-ghost" data-act="noallergy">Nemamo alergija</button>'
      };
    },
    6: function (d) {
      var portions = d.adults + 0.5 * d.children;
      var a = Math.round(100 / portions), c = Math.round(50 / portions);
      var split = []; for (var i = 0; i < d.adults; i++) split.push(a + ' %'); for (var j = 0; j < d.children; j++) split.push(c + ' %');
      var bar = ''; for (i = 0; i < d.adults; i++) bar += '<i style="flex:' + a + '"></i>'; for (j = 0; j < d.children; j++) bar += '<i class="kid" style="flex:' + c + '"></i>';
      var h = S.d, prog = E.label(L.programs, h[4].program, 2);
      var t = h[3].trains ? 'Da · ' + E.label(L.trainingGoals, h[3].training_goal).toLowerCase() : 'Ne';
      return {
        main: head('Za koliko ljudi kuhamo?', 'Količine u shopping listi i trošak po članu računamo prema ovome.') + errNote() +
          stepper('adults', 'Odrasli', '14 godina i više', d.adults, 1, 8) +
          stepper('children', 'Djeca', 'Računamo kao ½ porcije', d.children, 0, 8) +
          '<div class="portion"><div class="row"><span>Porcija po obroku</span><span class="big">' + E.num(portions) + '</span></div>' +
          '<div class="bar" aria-hidden="true">' + bar + '</div><small>Trošak obroka dijelimo ' + split.join(' · ') + '</small></div>' +
          (h[4].program === 'protein_150' ? '<p class="note">' + INFO + '<span>150 g proteina računamo samo za odrasle.</span></p>' : '') +
          '<div class="summary"><b style="text-align:left">Tvoj profil</b>' +
          row('Program', prog || '—') + row('Trening', t) +
          row('Prehrana', h[4].diets.map(function (x) { return E.label(L.diets, x); }).join(', ') || '—') +
          row('Alergeni', h[5].allergens.map(function (x) { return E.label(L.allergens, x); }).join(', ') || 'nema') +
          row('Kuhanje', 'Nedjelja + srijeda') + '</div>',
        foot: primary(S.edit ? 'Spremi' : 'Složi moj prvi tjedan', false)
      };
    }
  };
  function row(k, v) { return '<div><span>' + k + '</span><b>' + esc(v) + '</b></div>'; }
  function stepper(key, title, sub, val, min, max) {
    return '<div class="stepper"><div><b style="color:var(--c-ink);font-size:17px">' + title + '</b><div class="hint">' + sub + '</div></div>' +
      '<div class="ctl"><button type="button" class="round" data-act="dec" data-k="' + key + '" aria-label="Manje: ' + title + '"' + (val <= min ? ' disabled' : '') + '>' + MINUS + '</button>' +
      '<output aria-live="polite">' + val + '</output>' +
      '<button type="button" class="round plus" data-act="inc" data-k="' + key + '" aria-label="Više: ' + title + '"' + (val >= max ? ' disabled' : '') + '>' + PLUS + '</button></div></div>';
  }
  function primary(text, disabled) {
    return '<button type="button" class="btn" data-act="next"' + (disabled || S.busy ? ' disabled' : '') + '>' + (S.busy ? 'Spremam…' : text) + '</button>';
  }
  function conflict(program, diets) {
    var veg = diets.indexOf('vegan') >= 0 || diets.indexOf('vegetarian') >= 0;
    if (veg && (program === 'old_school' || program === 'protein_150')) return 'Vegan/vegetarijanska prehrana i ovaj program ostavljaju malo jela. Javit ćemo kad filter ostavi premalo jela.';
    if (diets.indexOf('keto') >= 0 && program === 'survivor') return 'Keto i Survivor se teško slažu — keto namirnice rijetko su najjeftinije.';
    return '';
  }

  // ---------- render ----------
  function render() {
    var r = STEPS[S.step](S.d[S.step]);
    document.getElementById('count').textContent = 'Korak ' + S.step + ' od 6';
    var bars = ''; for (var i = 1; i <= 6; i++) bars += '<span class="' + (i <= S.step ? 'on' : '') + '"></span>';
    document.getElementById('progress').innerHTML = bars;
    var back = document.getElementById('back');
    back.href = S.step > 1 ? '/onboarding/' + (S.step - 1) + (S.edit ? '?edit=1' : '') : (S.edit ? '/dashboard' : '/');
    $main.innerHTML = r.main;
    $foot.innerHTML = r.foot;
  }

  function readInputs() {
    if (S.step === 1) ['birth_year', 'height_cm', 'weight_kg'].forEach(function (k) {
      var el = document.getElementById(k); if (el) S.d[1][k] = el.value;
    });
    if (S.step === 5) { var el = document.getElementById('dislikes'); if (el) S.d[5].dislikes = el.value; }
  }

  function toggle(list, k) { var i = list.indexOf(k); if (i >= 0) list.splice(i, 1); else list.push(k); }

  function submit(payload) {
    S.busy = true; S.msg = ''; S.errors = {}; render();
    E.api('/api/onboarding', { method: 'POST', body: { step: S.step, data: payload, edit: S.edit } }).then(function (r) {
      S.busy = false;
      if (E.requireLogin(r)) return;
      if (r.status === 200) { location.href = r.data.next + (S.edit && r.data.next.indexOf('/onboarding') === 0 ? '?edit=1' : ''); return; }
      if (r.status === 409 && r.data.step) { location.replace('/onboarding/' + Math.min(r.data.step, 6)); return; }
      S.errors = (r.data && r.data.errors) || {};
      S.msg = (r.data && r.data.error) || 'Nešto je zapelo. Pokušaj ponovno.';
      render();
    }).catch(function () { S.busy = false; S.msg = 'Nema veze sa serverom. Pokušaj ponovno.'; render(); });
  }

  document.addEventListener('click', function (ev) {
    var t = ev.target.closest('[data-act]');
    if (!t || t.disabled) return;
    var act = t.getAttribute('data-act'), k = t.getAttribute('data-k'), d = S.d[S.step];
    readInputs();
    switch (act) {
      case 'consent': d.consent = t.checked; if (!d.consent) { d.birth_year = d.height_cm = d.weight_kg = ''; } break;
      case 'goal': toggle(d.goals, k); break;
      case 'trains': d.trains = k === '1'; break;
      case 'tgoal': d.training_goal = k; break;
      case 'pstatus': toggle(d.plan_status, k); if (d.plan_status.indexOf('wants_trainer_referral') < 0) d.trainer_mode = null; break;
      case 'tmode': d.trainer_mode = k; break;
      case 'program': d.program = k; break;
      case 'diet': toggle(d.diets, k); break;
      case 'allergen': toggle(d.allergens, k); break;
      case 'inc': d[k] = Math.min(8, d[k] + 1); break;
      case 'dec': d[k] = Math.max(k === 'adults' ? 1 : 0, d[k] - 1); break;
      case 'skip1': return submit({ skip: true });
      case 'noallergy': return submit({ none: true, dislikes: S.d[5].dislikes });
      case 'next': return submit(S.step === 1 ? { consent: d.consent, birth_year: d.birth_year, height_cm: d.height_cm, weight_kg: d.weight_kg } : d);
      default: return;
    }
    var focusKey = act + ':' + (k || '');
    render();
    var again = document.querySelector('[data-act="' + act + '"]' + (k ? '[data-k="' + k + '"]' : ''));
    if (again && focusKey) again.focus();
  });

  // ---------- boot ----------
  E.api('/api/me').then(function (r) {
    if (E.requireLogin(r)) return;
    S.me = r.data;
    var p = S.me.profile;
    if (p.onboarding_completed_at && !S.edit) { location.replace('/dashboard'); return; }
    if (!p.onboarding_completed_at && S.step > p.onboarding_step) { location.replace('/onboarding/' + Math.min(p.onboarding_step, 6)); return; }
    if (!m) { history.replaceState(null, '', '/onboarding/' + Math.min(p.onboarding_step, 6)); S.step = Math.min(p.onboarding_step, 6); }
    initData();
    render();
  }).catch(function () { $main.innerHTML = '<p class="note warn">Nema veze sa serverom. Osvježi stranicu.</p>'; });
})();
