// Dashboard: savings panel (always on top) + everything collected in onboarding.
(function () {
  var E = window.EAI, L = E.L, esc = E.esc;
  var $root = document.getElementById('root');
  var $dlg = document.getElementById('del');

  function stat(k, w) {
    return '<div class="stat"><span class="k">' + k + '</span><span class="eur">' + E.eur(w.saving) + '</span><span class="pct">' + E.pct(w.pct) + '</span></div>';
  }

  function savingsPanel(me) {
    var s = me.savings, since = E.date(me.user.created_at);
    if (s.empty) {
      return '<section class="savings" aria-labelledby="sv-t"><h2 id="sv-t">Tvoja ušteda</h2>' +
        '<div class="stats">' + stat('Ovaj tjedan', s.week) + stat('Ovaj mjesec', s.month) + stat('Ove godine', s.year) + '</div>' +
        '<div class="tot"><span>Ukupno od prijave (' + since + ')</span><b>' + E.eur(0) + '</b></div>' +
        '<div class="meta">Prvi plan stiže u nedjelju. Od tada ovdje vidiš koliko si platio manje od uobičajene cijene.</div></section>';
    }
    var t = s.total;
    var anyPlan = s.week.fromPlan || s.month.fromPlan || s.year.fromPlan || t.fromPlan;
    return '<section class="savings" aria-labelledby="sv-t"><h2 id="sv-t">Tvoja ušteda</h2>' +
      '<div class="stats">' + stat('Ovaj tjedan', s.week) + stat('Ovaj mjesec', s.month) + stat('Ove godine', s.year) + '</div>' +
      '<div class="tot"><span>Ukupno od prijave (' + since + ')</span><b>' + E.eur(t.saving) + ' · ' + E.pct(t.pct) + '</b></div>' +
      '<div class="meta">akcije ' + E.eur(t.promo) + ' + izbor trgovine ' + E.eur(t.store) +
      (anyPlan ? ' · prema planu' : '') + '</div></section>';
  }

  function card(title, step, rows, extra) {
    return '<section class="card"><header><h3>' + title + '</h3><a class="edit" href="/onboarding/' + step + '?edit=1" aria-label="Uredi: ' + title + '">Uredi</a></header>' +
      '<dl class="kv">' + rows.map(function (r) { return '<div><dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd></div>'; }).join('') + '</dl>' + (extra || '') + '</section>';
  }

  function render(me) {
    var p = me.profile || {}, t = me.training, h = me.household || {}, lead = me.trainerLead;
    var ne = 'nije uneseno';
    var first = (me.user.full_name || '').split(' ')[0];
    var portions = (h.adults || 1) + 0.5 * (h.children || 0);
    var a = Math.round(100 / portions), c = Math.round(50 / portions);
    var split = []; for (var i = 0; i < (h.adults || 0); i++) split.push(a + ' %'); for (var j = 0; j < (h.children || 0); j++) split.push(c + ' %');

    var training = [['Treniram', t ? (t.trains ? 'Da' : 'Ne') : ne]];
    if (t && t.trains) {
      training.push(['Cilj', E.label(L.trainingGoals, t.training_goal)]);
      training.push(['Plan', (t.plan_status || []).map(function (x) { return E.label(L.planStatus, x); }).join(', ') || '—']);
      if (t.trainer_mode) training.push(['Trener', E.label(L.trainerModes, t.trainer_mode) + (lead && lead.status !== 'closed' ? ' · ' + (L.leadStatus[lead.status] || lead.status) : '')]);
    }

    $root.innerHTML =
      '<h1 class="hello">' + (first ? 'Bok, ' + esc(first) : 'Tvoj dashboard') + '</h1>' +
      savingsPanel(me) +
      '<div class="cards">' +
      card('Ja', 1, [
        ['Godište', p.birth_year || ne], ['Visina', p.height_cm ? p.height_cm + ' cm' : ne],
        ['Težina', p.weight_kg ? E.num(p.weight_kg) + ' kg' : ne],
      ], p.health_consent_at ? '' : '<p class="small-muted">Bez privole računamo standardnu porciju.</p>') +
      card('Ciljevi', 2, [['Najvažnije', (p.goals || []).map(function (g) { return E.label(L.goals, g); }).join(', ') || ne]]) +
      card('Trening', 3, training) +
      card('Program i prehrana', 4, [
        ['Program', h.program ? E.label(L.programs, h.program, 2) : ne],
        ['Prehrana', (h.diets || []).map(function (x) { return E.label(L.diets, x); }).join(', ') || '—'],
      ]) +
      card('Alergeni', 5, [
        ['Alergeni', (h.allergens || []).map(function (x) { return E.label(L.allergens, x); }).join(', ') || 'nema'],
        ['Ne jedemo', h.dislikes || '—'],
      ]) +
      card('Kućanstvo', 6, [
        ['Odrasli / djeca', (h.adults || 0) + ' / ' + (h.children || 0)],
        ['Porcija po obroku', E.num(portions)],
        ['Podjela troška', split.join(' · ')],
        ['Kuhanje', 'Nedjelja + srijeda'],
      ]) +
      '</div>' +
      '<div class="actions">' +
      '<button type="button" class="btn btn-line" disabled title="Prvi PDF stiže u nedjelju">Preuzmi tjedni PDF</button>' +
      '<button type="button" class="btn btn-line" disabled>Poveži Telegram · uskoro</button>' +
      '<button type="button" class="btn btn-danger" data-act="delete">Obriši moje podatke</button>' +
      '</div>' +
      '<p class="small-muted">Tjedni PDF stiže u nedjelju. Prijavljen kao ' + esc(me.user.email) + '.</p>';
  }

  document.addEventListener('click', function (ev) {
    var t = ev.target.closest('[data-act]');
    if (!t) return;
    var act = t.getAttribute('data-act');
    if (act === 'delete') $dlg.showModal();
    if (act === 'cancel') $dlg.close();
    if (act === 'confirm') {
      t.disabled = true;
      E.api('/api/account', { method: 'DELETE', body: {} }).then(function (r) {
        if (r.status === 200) location.replace('/');
        else { t.disabled = false; $dlg.close(); alert('Brisanje nije uspjelo. Pokušaj ponovno ili piši na info@eai-zdravo.com.'); }
      });
    }
  });

  E.api('/api/me').then(function (r) {
    if (E.requireLogin(r)) return;
    if (!r.data.profile.onboarding_completed_at) { location.replace('/onboarding/' + Math.min(r.data.profile.onboarding_step, 6)); return; }
    render(r.data);
  }).catch(function () { $root.innerHTML = '<p class="note warn">Nema veze sa serverom. Osvježi stranicu.</p>'; });
})();
