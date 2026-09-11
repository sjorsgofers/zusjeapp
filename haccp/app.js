/* HACCP taken-app – logica */
(function () {
  'use strict';

  var OPSLAG = 'haccp.registraties.v1';
  var OPSLAG_KOP = 'haccp.koppeling.v1';

  var koppeling = leesOp(OPSLAG_KOP, null) ||
    { endpoint: INSTELLINGEN.endpoint };
  var registraties = leesOp(OPSLAG, []);
  var actieveCat = CATEGORIEEN[0].id;
  var bereik = 'vandaag';
  var huidigeTaak = null;
  var invoer = {};

  /* ---------------- opslag ---------------- */
  function leesOp(sleutel, standaard) {
    try {
      var v = localStorage.getItem(sleutel);
      return v === null ? standaard : JSON.parse(v);
    } catch (e) { return standaard; }
  }
  function schrijfOp(sleutel, waarde) {
    try { localStorage.setItem(sleutel, JSON.stringify(waarde)); } catch (e) { /* prive-modus */ }
  }

  /* ---------------- datum ---------------- */
  function vandaag() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function isoDag(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  /* 1 = maandag .. 7 = zondag */
  function weekdag(d) { return d.getDay() === 0 ? 7 : d.getDay(); }
  function maandagVan(d) {
    var m = new Date(d); m.setDate(m.getDate() - (weekdag(m) - 1)); m.setHours(0, 0, 0, 0); return m;
  }
  function zondagVan(d) { var z = maandagVan(d); z.setDate(z.getDate() + 6); return z; }
  function weeknummer(d) {
    var t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    t.setDate(t.getDate() + 4 - weekdag(t));
    var jan1 = new Date(t.getFullYear(), 0, 1);
    return Math.ceil((((t - jan1) / 86400000) + 1) / 7);
  }
  function nlDatum(d) {
    var dagen = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];
    return dagen[d.getDay()] + ' ' + pad(d.getDate()) + '-' + pad(d.getMonth() + 1) + '-' + d.getFullYear();
  }

  /* ---------------- planning ---------------- */
  function frequentieTekst(f) {
    if (f.type === 'dag') return 'Elke dag';
    if (f.type === 'week') return 'Elke week';
    if (f.n === 13) return 'Elk kwartaal';
    return 'Elke ' + f.n + ' weken';
  }

  /* deadline van de lopende periode, of null als de taak deze week niet loopt */
  function deadlineVan(taak, ref) {
    var f = taak.frequentie;
    if (f.type === 'dag') return new Date(ref);
    if (f.type === 'week') {
      var d = maandagVan(ref);
      d.setDate(d.getDate() + (f.dag - 1));
      return d;
    }
    /* elke n weken vanaf startdatum */
    var start = new Date(f.start + 'T00:00:00');
    var startMa = maandagVan(start);
    var refMa = maandagVan(ref);
    var weken = Math.round((refMa - startMa) / (7 * 86400000));
    if (weken < 0 || weken % f.n !== 0) return null;
    return zondagVan(ref);
  }

  function periodeSleutel(taak, ref) {
    var f = taak.frequentie;
    if (f.type === 'dag') return isoDag(ref);
    return isoDag(maandagVan(ref));
  }

  function isAf(taak, ref) {
    var sleutel = periodeSleutel(taak, ref);
    for (var i = 0; i < registraties.length; i++) {
      if (registraties[i].taakId === taak.id && registraties[i].periode === sleutel) return true;
    }
    return false;
  }

  /* taken die in de lopende week/dag op de planning staan */
  function takenVoor(catId, bereikKeuze) {
    var nu = vandaag();
    var uit = [];
    for (var i = 0; i < TAKEN.length; i++) {
      var t = TAKEN[i];
      if (t.cat !== catId) continue;
      var dl = deadlineVan(t, nu);
      if (bereikKeuze === 'alle') { uit.push({ taak: t, deadline: dl, af: dl ? isAf(t, nu) : false }); continue; }
      if (!dl) continue;
      var vandaagDeadline = isoDag(dl) === isoDag(nu);
      if (bereikKeuze === 'vandaag' && !vandaagDeadline) continue;
      if (bereikKeuze === 'week' && vandaagDeadline) continue;
      uit.push({ taak: t, deadline: dl, af: isAf(t, nu) });
    }
    return uit;
  }

  function aantalOpen(catId, bereikKeuze) {
    var lijst = takenVoor(catId, bereikKeuze);
    var n = 0;
    for (var i = 0; i < lijst.length; i++) if (!lijst[i].af) n++;
    return n;
  }

  /* ---------------- normcontrole ---------------- */
  function normLabel(veld) {
    if (veld.label) return veld.label;
    var prefix = veld.prefix || 'Norm';
    var teken = veld.richting === 'hoger' ? ' of hoger' : (veld.richting === 'lager' ? ' of lager' : '');
    var eenheid = veld.type === 'getal' ? (' ' + (veld.eenheid || '')) : '°C';
    return prefix + ': ' + veld.limiet + eenheid + teken + (veld.suffix || '');
  }

  function binnenNorm(veld, waarde) {
    if (waarde === '' || waarde === null || isNaN(waarde)) return null;
    var w = parseFloat(waarde);
    if (veld.richting === 'lager') return w <= veld.limiet;
    if (veld.richting === 'hoger') return w >= veld.limiet;
    if (veld.richting === 'gelijk') return Math.abs(w - veld.limiet) <= (veld.marge || 1);
    return null;
  }

  /* ---------------- weergave ---------------- */
  function tekenAlles() { tekenKop(); tekenCats(); tekenLijst(); }

  function tekenKop() {
    var nu = vandaag();
    var open = { vandaag: 0, week: 0 }, klaar = 0;
    for (var i = 0; i < TAKEN.length; i++) {
      var t = TAKEN[i], dl = deadlineVan(t, nu);
      if (!dl) continue;
      var af = isAf(t, nu);
      if (af) { klaar++; continue; }
      if (isoDag(dl) === isoDag(nu)) open.vandaag++; else open.week++;
    }
    zet('tVandaag', open.vandaag); zet('bVandaag', open.vandaag);
    zet('tWeek', open.week); zet('bWeek', open.week);
    zet('tKlaar', klaar); zet('bKlaar', klaar);
    zet('tWeeknr', 'wk ' + weeknummer(nu));
    zet('bDatum', pad(nu.getDate()) + '/' + pad(nu.getMonth() + 1));
    document.querySelector('#tabVandaag b').textContent = open.vandaag;
    document.querySelector('#tabWeek b').textContent = open.week;
  }

  function zet(id, tekst) { document.getElementById(id).textContent = tekst; }

  function tekenCats() {
    var doel = document.getElementById('cats');
    doel.innerHTML = '';
    CATEGORIEEN.forEach(function (c) {
      var dag = aantalOpen(c.id, 'vandaag');
      var wk = aantalOpen(c.id, 'week');
      var b = document.createElement('button');
      b.className = 'cat' + (c.id === actieveCat ? ' actief' : '');
      b.innerHTML = '<span class="ic">' + c.icon + '</span><span class="nm"></span>' +
        '<span class="bal ' + (dag ? 'oranje' : 'leeg') + '">' + dag + '</span>' +
        '<span class="bal ' + (wk ? 'blauw' : 'leeg') + '">' + wk + '</span>';
      b.querySelector('.nm').textContent = c.naam;
      b.onclick = function () { actieveCat = c.id; tekenCats(); tekenLijst(); };
      doel.appendChild(b);
    });
  }

  function tekenLijst() {
    var doel = document.getElementById('lijst');
    var rijen = takenVoor(actieveCat, bereik);
    document.querySelectorAll('.tab').forEach(function (t) {
      t.classList.toggle('actief', t.dataset.bereik === bereik);
    });
    if (!rijen.length) {
      doel.innerHTML = '<div class="leeg-melding">Geen taken in deze categorie voor dit bereik.</div>';
      return;
    }
    var tabel = document.createElement('table');
    tabel.innerHTML = '<thead><tr><th>Taak</th><th>Afdeling</th><th>Frequentie</th><th>Deadline</th><th></th></tr></thead>';
    var body = document.createElement('tbody');
    rijen.forEach(function (r) {
      var tr = document.createElement('tr');
      tr.className = 'rij' + (r.af ? ' klaar' : '');
      var tds = [
        r.taak.naam,
        r.taak.afdeling || '',
        frequentieTekst(r.taak.frequentie),
        r.deadline ? (r.taak.frequentie.type === 'dag' ? 'Vandaag' : nlDatum(r.deadline)) : 'Niet deze week'
      ];
      tds.forEach(function (tekst, i) {
        var td = document.createElement('td');
        td.textContent = tekst;
        if (i === 1) td.className = 'afd';
        tr.appendChild(td);
      });
      var tdv = document.createElement('td');
      tdv.className = 'vink';
      tdv.textContent = r.af ? '✓' : '';
      tr.appendChild(tdv);
      tr.onclick = function () { openTaak(r.taak); };
      body.appendChild(tr);
    });
    tabel.appendChild(body);
    doel.innerHTML = '';
    doel.appendChild(tabel);
  }

  /* ---------------- registratieformulier ---------------- */
  function openTaak(taak) {
    huidigeTaak = taak;
    invoer = { nvt: false, velden: {}, beoordeling: {}, keuze: '', opmerking: '', norm: null };
    tekenFormulier();
    toon('ovTaak');
  }

  function tekenFormulier() {
    var t = huidigeTaak;
    var cat = CATEGORIEEN.filter(function (c) { return c.id === t.cat; })[0];
    var b = document.getElementById('taakBody');
    b.innerHTML = '';

    b.appendChild(el('p', 'taaktitel', cat.naam + ': ' + t.naam));
    if (t.afdeling) b.appendChild(el('p', 'taakafd', 'Afdeling: ' + t.afdeling));
    if (t.instructie) b.appendChild(el('p', 'instructie', t.instructie));

    /* niet van toepassing / niet in gebruik */
    var sch = document.createElement('label');
    sch.className = 'schakel';
    sch.innerHTML = '<input type="checkbox"><span class="spoor"></span><span></span>';
    sch.querySelector('span:last-child').textContent = t.nvtLabel || 'Niet van toepassing';
    sch.querySelector('input').checked = invoer.nvt;
    sch.querySelector('input').onchange = function () { invoer.nvt = this.checked; tekenFormulier(); };
    b.appendChild(sch);

    if (!invoer.nvt) {
      b.appendChild(el('div', 'kopje', 'Gegevens meting'));
      var velden = velenVoor(t);
      velden.forEach(function (v, i) { b.appendChild(renderVeld(v, i)); });
    }

    b.appendChild(el('div', 'kopje', 'Opmerking(en)'));
    var ta = document.createElement('textarea');
    ta.value = invoer.opmerking;
    ta.oninput = function () { invoer.opmerking = this.value; };
    b.appendChild(ta);

    b.appendChild(el('p', 'let-op', 'Let op! De taak wordt afgerond bij het opslaan van de gegevens.'));
  }

  /* velden, rekening houdend met de gekozen norm bij ontvangst goederen */
  function velenVoor(t) {
    var uit = [], wachtend = null;
    t.velden.forEach(function (v) {
      uit.push(v);
      if (v.type === 'normkeuze') {
        var gekozen = invoer.norm || v.standaard || v.opties[0].naam;
        invoer.norm = gekozen;
        var opt = v.opties.filter(function (o) { return o.naam === gekozen; })[0];
        if (opt && opt.limiet !== null && opt.limiet !== undefined) {
          /* het temperatuurveld staat in de originele app onder Productnaam */
          wachtend = { type: 'temperatuur', limiet: opt.limiet, richting: opt.richting, sleutel: 'normtemp' };
        }
      } else if (wachtend && v.type === 'tekst') {
        uit.push(wachtend); wachtend = null;
      }
    });
    if (wachtend) uit.push(wachtend);
    return uit;
  }

  function renderVeld(v, i) {
    var sleutel = v.sleutel || (v.type + '-' + i);

    if (v.type === 'normkeuze') {
      var l = document.createElement('label'); l.className = 'veld';
      l.appendChild(el('span', 'lbl', v.label));
      var sel = document.createElement('select');
      v.opties.forEach(function (o) {
        var op = document.createElement('option');
        op.value = o.naam; op.textContent = o.naam;
        if (o.naam === invoer.norm) op.selected = true;
        sel.appendChild(op);
      });
      sel.onchange = function () { invoer.norm = this.value; delete invoer.velden.normtemp; tekenFormulier(); };
      l.appendChild(sel);
      return l;
    }

    if (v.type === 'tekst') {
      var lt = document.createElement('label'); lt.className = 'veld';
      lt.appendChild(el('span', 'lbl', v.label));
      var inp = document.createElement('input');
      inp.type = 'text'; inp.value = invoer.velden[sleutel] || '';
      inp.oninput = function () { invoer.velden[sleutel] = this.value; };
      lt.appendChild(inp);
      return lt;
    }

    if (v.type === 'temperatuur' || v.type === 'getal') {
      var ln = document.createElement('label'); ln.className = 'veld';
      ln.appendChild(el('span', 'lbl', normLabel(v)));
      var num = document.createElement('input');
      num.type = 'number'; num.step = '0.1'; num.className = 'kort';
      num.inputMode = 'decimal';
      num.value = invoer.velden[sleutel] === undefined ? '' : invoer.velden[sleutel];
      var melding = document.createElement('div');
      function check() {
        var ok = binnenNorm(v, num.value);
        num.classList.toggle('buiten-norm', ok === false);
        melding.className = ok === false ? 'norm-waarschuwing' : 'norm-ok';
        melding.textContent = ok === null ? '' :
          (ok ? 'Binnen norm' : (v.richtwaarde ? 'Buiten richtwaarde – noteer een toelichting'
                                               : 'BUITEN NORM – onderneem actie en noteer dit'));
      }
      num.oninput = function () { invoer.velden[sleutel] = this.value; check(); };
      check();
      ln.appendChild(num); ln.appendChild(melding);
      return ln;
    }

    if (v.type === 'beoordeling') {
      var wrap = document.createElement('div');
      wrap.appendChild(el('div', 'kopje', v.label));
      v.items.forEach(function (naam) {
        var rij = document.createElement('div'); rij.className = 'beoordeling-rij';
        rij.appendChild(el('span', '', naam));
        [['op', '\u{1F44D}', true], ['neer', '\u{1F44E}', false]].forEach(function (d) {
          var knop = document.createElement('button');
          knop.className = 'duim ' + d[0] + (invoer.beoordeling[naam] === d[2] ? ' aan' : '');
          knop.textContent = d[1];
          knop.onclick = function () {
            invoer.beoordeling[naam] = invoer.beoordeling[naam] === d[2] ? undefined : d[2];
            tekenFormulier();
          };
          rij.appendChild(knop);
        });
        wrap.appendChild(rij);
      });
      return wrap;
    }

    if (v.type === 'keuze') {
      var wk = document.createElement('div'); wk.className = 'veld';
      wk.appendChild(el('span', 'lbl', v.label));
      var rijk = document.createElement('div'); rijk.className = 'keuzes';
      v.opties.forEach(function (o) {
        var kn = document.createElement('button');
        kn.className = 'keuze' + (invoer.keuze === o ? ' aan' : '');
        kn.textContent = o;
        kn.onclick = function () { invoer.keuze = invoer.keuze === o ? '' : o; tekenFormulier(); };
        rijk.appendChild(kn);
      });
      wk.appendChild(rijk);
      return wk;
    }

    return document.createElement('span');
  }

  function el(tag, klasse, tekst) {
    var e = document.createElement(tag);
    if (klasse) e.className = klasse;
    if (tekst !== undefined) e.textContent = tekst;
    return e;
  }

  /* ---------------- opslaan ---------------- */
  function opslaan() {
    var t = huidigeTaak, nu = new Date();
    var velden = [], metingen = [], product = '';
    if (!invoer.nvt) {
      velenVoor(t).forEach(function (v, i) {
        var sleutel = v.sleutel || (v.type + '-' + i);
        if (v.type === 'tekst') {
          var tekstWaarde = invoer.velden[sleutel] || '';
          velden.push({ label: v.label, waarde: tekstWaarde });
          if (!product) product = tekstWaarde;
        }
        if (v.type === 'temperatuur' || v.type === 'getal') {
          var w = invoer.velden[sleutel];
          var ok = binnenNorm(v, w);
          velden.push({ label: normLabel(v), waarde: w === undefined ? '' : w, ok: ok });
          metingen.push({
            norm: normLabel(v),
            waarde: w === undefined ? '' : w,
            oordeel: ok === null ? '' : (ok ? 'Binnen norm' : (v.richtwaarde ? 'Buiten richtwaarde' : 'Buiten norm'))
          });
        }
      });
    }
    var rec = {
      id: nieuwId(),
      taakId: t.id,
      taak: t.naam,
      categorie: (CATEGORIEEN.filter(function (c) { return c.id === t.cat; })[0] || {}).naam,
      afdeling: t.afdeling || '',
      periode: periodeSleutel(t, vandaag()),
      moment: nu.toISOString(),
      nvt: invoer.nvt,
      norm: invoer.norm || '',
      product: product,
      velden: velden,
      metingen: metingen,
      beoordeling: invoer.beoordeling,
      keuze: invoer.keuze,
      opmerking: invoer.opmerking,
      verzonden: false
    };
    registraties.push(rec);
    schrijfOp(OPSLAG, registraties);
    verberg('ovTaak');
    tekenAlles();
    verstuur(rec);
  }

  function nieuwId() {
    var d = new Date();
    return 'R' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' +
      pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds()) + '-' +
      Math.random().toString(36).slice(2, 6).toUpperCase();
  }

  /* ---------------- koppeling met het spreadsheet ---------------- */
  function lading(rec) {
    return {
      id: rec.id,
      moment: rec.moment,
      categorie: rec.categorie,
      taak: rec.taak,
      afdeling: rec.afdeling,
      nvt: !!rec.nvt,
      normgroep: rec.norm || '',
      product: rec.product || '',
      metingen: rec.metingen || [],
      beoordeling: rec.beoordeling || {},
      antwoord: rec.keuze || '',
      opmerking: rec.opmerking || ''
    };
  }

  function markeerVerzonden(id) {
    for (var i = 0; i < registraties.length; i++) {
      if (registraties[i].id === id) { registraties[i].verzonden = true; break; }
    }
    schrijfOp(OPSLAG, registraties);
    tekenSync();
  }

  function verstuur(rec, klaar) {
    if (!koppeling.endpoint) { tekenSync(); if (klaar) klaar(false); return; }
    var pakket = lading(rec);
    var afgerond = false;
    function gelukt(a) {
      if (afgerond) return; afgerond = true;
      if (a && a.ok) markeerVerzonden(rec.id); else tekenSync();
      if (klaar) klaar(!!(a && a.ok));
    }
    if (window.fetch) {
      fetch(koppeling.endpoint, { method: 'POST', body: JSON.stringify(pakket) })
        .then(function (r) { return r.json(); })
        .then(gelukt)
        .catch(function () { viaScript(pakket, gelukt); });
    } else {
      viaScript(pakket, gelukt);
    }
    setTimeout(function () { if (!afgerond) { afgerond = true; tekenSync(); if (klaar) klaar(false); } }, 20000);
  }

  /* fallback zonder CORS: Apps Script antwoordt via een callback in een <script>-tag */
  function viaScript(pakket, klaar) {
    var naam = 'haccpCb' + Math.random().toString(36).slice(2, 9);
    var s = document.createElement('script');
    var opgeruimd = false;
    function ruimOp() {
      if (opgeruimd) return; opgeruimd = true;
      try { delete window[naam]; } catch (e) { window[naam] = undefined; }
      if (s.parentNode) s.parentNode.removeChild(s);
    }
    window[naam] = function (a) { ruimOp(); klaar(a); };
    s.onerror = function () { ruimOp(); klaar(null); };
    s.src = koppeling.endpoint + '?callback=' + naam + '&data=' + encodeURIComponent(JSON.stringify(pakket));
    document.body.appendChild(s);
    setTimeout(ruimOp, 25000);
  }

  function wachtrij() {
    return registraties.filter(function (r) { return !r.verzonden; });
  }

  function verstuurWachtrij(klaar) {
    var rij = wachtrij();
    if (!rij.length || !koppeling.endpoint) { if (klaar) klaar(0, 0); return; }
    var gedaan = 0, gelukt = 0;
    rij.forEach(function (r) {
      verstuur(r, function (ok) {
        gedaan++; if (ok) gelukt++;
        if (gedaan === rij.length && klaar) klaar(gelukt, rij.length);
      });
    });
  }

  function tekenSync() {
    var e = document.getElementById('syncStatus');
    if (!e) return;   // statusbadge staat niet (meer) op de pagina
    if (!koppeling.endpoint) { e.className = 'sync uit'; e.textContent = 'Niet gekoppeld'; return; }
    var open = wachtrij().length;
    if (open) { e.className = 'sync wacht'; e.textContent = open + ' in wachtrij'; }
    else { e.className = 'sync ok'; e.textContent = 'Spreadsheet bij'; }
  }

  function testVerbinding(klaar) {
    if (!koppeling.endpoint) { klaar({ ok: false, bericht: 'geen URL ingevuld' }); return; }
    var naam = 'haccpPing' + Math.random().toString(36).slice(2, 9);
    var s = document.createElement('script');
    var af = false;
    function ruimOp() { try { delete window[naam]; } catch (e) { window[naam] = undefined; } if (s.parentNode) s.parentNode.removeChild(s); }
    window[naam] = function (a) { if (af) return; af = true; ruimOp(); klaar(a); };
    s.onerror = function () { if (af) return; af = true; ruimOp(); klaar({ ok: false, bericht: 'geen antwoord van de web-app' }); };
    s.src = koppeling.endpoint + '?actie=ping&callback=' + naam;
    document.body.appendChild(s);
    setTimeout(function () { if (!af) { af = true; ruimOp(); klaar({ ok: false, bericht: 'time-out' }); } }, 15000);
  }

  /* ---------------- historie ---------------- */
  function tekenHistorie() {
    var b = document.getElementById('histBody');
    b.innerHTML = '';
    if (!registraties.length) { b.appendChild(el('p', 'leeg-melding', 'Nog geen registraties.')); return; }
    registraties.slice().reverse().slice(0, 100).forEach(function (r) {
      var d = new Date(r.moment);
      var rij = document.createElement('div'); rij.className = 'hist-rij';
      rij.appendChild(el('b', '', r.taak));
      rij.appendChild(el('div', 'hist-meta',
        r.categorie + ' · ' + nlDatum(d) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) +
        ' · ' + (r.verzonden ? 'in spreadsheet' : 'wachtrij')));
      var detail = [];
      if (r.nvt) detail.push('Niet van toepassing / niet in gebruik');
      if (r.norm) detail.push('Norm: ' + r.norm);
      r.velden.forEach(function (v) {
        if (v.waarde !== '') detail.push(v.label + ' → ' + v.waarde + (v.ok === false ? ' (buiten norm!)' : ''));
      });
      Object.keys(r.beoordeling || {}).forEach(function (k) {
        if (r.beoordeling[k] !== undefined) detail.push(k + ': ' + (r.beoordeling[k] ? 'akkoord' : 'niet akkoord'));
      });
      if (r.keuze) detail.push('Antwoord: ' + r.keuze);
      if (r.opmerking) detail.push('Opmerking: ' + r.opmerking);
      if (detail.length) rij.appendChild(el('div', 'hist-detail', detail.join(' · ')));
      b.appendChild(rij);
    });
  }

  function exporteer() {
    var regels = [['Datum', 'Tijd', 'Categorie', 'Taak', 'Afdeling', 'NVT', 'Norm', 'Metingen', 'Beoordeling', 'Antwoord', 'Opmerking']];
    registraties.forEach(function (r) {
      var d = new Date(r.moment);
      var metingen = r.velden.map(function (v) { return v.label + '=' + v.waarde; }).join(' | ');
      var beo = Object.keys(r.beoordeling || {}).filter(function (k) { return r.beoordeling[k] !== undefined; })
        .map(function (k) { return k + '=' + (r.beoordeling[k] ? 'ok' : 'niet ok'); }).join(' | ');
      regels.push([isoDag(d), pad(d.getHours()) + ':' + pad(d.getMinutes()), r.categorie, r.taak,
        r.afdeling, r.nvt ? 'ja' : 'nee', r.norm, metingen, beo, r.keuze, r.opmerking]);
    });
    var csv = regels.map(function (rij) {
      return rij.map(function (c) { return '"' + String(c === undefined ? '' : c).replace(/"/g, '""') + '"'; }).join(';');
    }).join('\r\n');
    var blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'haccp-registraties-' + isoDag(new Date()) + '.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  /* ---------------- dialogen ---------------- */
  function toon(id) { document.getElementById(id).hidden = false; }
  function verberg(id) { document.getElementById(id).hidden = true; }

  /* ---------------- start ---------------- */
  function start() {
    /* Knoppen die niet op de pagina staan (Historie, Koppeling) worden overgeslagen:
       dan krijgt de handler een leeg object en gebeurt er niets. */
    function knop(id) { return document.getElementById(id) || {}; }
    knop('knopHistorie').onclick = function () { tekenHistorie(); toon('ovHistorie'); };
    knop('btnOpslaan').onclick = opslaan;
    knop('btnExport').onclick = exporteer;

    var vEnd = document.getElementById('veldEndpoint');
    var mld = document.getElementById('koppelMelding');
    knop('knopKoppeling').onclick = function () {
      vEnd.value = koppeling.endpoint;
      mld.textContent = ''; toon('ovKoppeling');
    };
    knop('btnKoppelOpslaan').onclick = function () {
      koppeling = { endpoint: vEnd.value.trim() };
      schrijfOp(OPSLAG_KOP, koppeling);
      mld.className = 'melding goed'; mld.textContent = 'Opgeslagen.';
      tekenSync();
      verstuurWachtrij(function (gelukt, totaal) {
        if (totaal) { mld.textContent = 'Opgeslagen. ' + gelukt + ' van ' + totaal + ' uit de wachtrij verstuurd.'; }
      });
    };
    knop('btnTest').onclick = function () {
      mld.className = 'melding'; mld.textContent = 'Bezig met testen…';
      koppeling = { endpoint: vEnd.value.trim() };
      testVerbinding(function (a) {
        mld.className = 'melding ' + (a && a.ok ? 'goed' : 'fout');
        mld.textContent = a && a.ok ? 'Verbinding in orde – het spreadsheet is bereikbaar.'
                                    : 'Geen verbinding: ' + ((a && a.bericht) || 'onbekende fout');
      });
    };
    knop('btnWachtrij').onclick = function () {
      mld.className = 'melding'; mld.textContent = 'Bezig met versturen…';
      verstuurWachtrij(function (gelukt, totaal) {
        mld.className = 'melding ' + (gelukt === totaal ? 'goed' : 'fout');
        mld.textContent = totaal ? gelukt + ' van ' + totaal + ' registraties verstuurd.'
                                 : 'De wachtrij is leeg.';
      });
    };

    document.querySelectorAll('[data-sluit]').forEach(function (k) {
      k.onclick = function () { verberg(k.dataset.sluit); };
    });
    document.querySelectorAll('.tab').forEach(function (t) {
      t.onclick = function () { bereik = t.dataset.bereik; tekenLijst(); };
    });
    document.querySelectorAll('.overlay').forEach(function (o) {
      o.onclick = function (e) { if (e.target === o) o.hidden = true; };
    });

    tekenAlles();
    tekenSync();
    verstuurWachtrij();
    setInterval(function () { if (wachtrij().length) verstuurWachtrij(); }, 300000);
  }

  document.addEventListener('DOMContentLoaded', start);
})();
