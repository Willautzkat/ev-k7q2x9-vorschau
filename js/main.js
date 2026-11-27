/* eq-valent · Startseite · Interaktionen ohne Abhängigkeiten */
(function () {
  'use strict';

  var doc = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---------- Einblenden beim Scrollen ---------- */
  var revealEls = $$('[data-reveal]');
  if (!('IntersectionObserver' in window) || reduce) {
    revealEls.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        el.classList.add('is-in');
        io.unobserve(el);
        if (el.id === 'rings' || el.id === 'braille') {
          setTimeout(function () { el.classList.add('is-ready'); }, 1400);
        }
        $$('[data-count]', el).forEach(countUp);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    revealEls.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Zahlen hochzählen ---------- */
  function countUp(el) {
    var target = parseInt(el.getAttribute('data-count'), 10);
    if (reduce || !target || target < 2) return;
    var start = null, dur = 1100;
    el.textContent = '0';
    function tick(t) {
      if (start === null) start = t;
      var p = Math.min((t - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = String(Math.round(target * eased));
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* ---------- Überschriften: Wörter steigen auf, Tilde unter dem Schlüsselwort ---------- */
  $$('.h1[data-reveal],.h2[data-reveal],.h3[data-reveal]').forEach(function (h) {
    if (!reduce) {
      var n = 0;
      (function walk(node) {
        Array.prototype.slice.call(node.childNodes).forEach(function (c) {
          if (c.nodeType === 1) { if (c.tagName !== 'BR') walk(c); return; }
          if (c.nodeType !== 3) return;
          var prev = c.previousSibling;
          var frag = document.createDocumentFragment();
          c.nodeValue.split(/(\s+)/).forEach(function (part, idx) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            var w = document.createElement('span');
            var inner = document.createElement('span');
            w.className = 'w'; inner.className = 'w__in';
            inner.style.setProperty('--w', n++);
            inner.textContent = part;
            w.appendChild(inner);
            if (idx === 0 && prev && prev.nodeType === 1 && prev.tagName !== 'BR') {
              /* Satzzeichen direkt nach dem Schlüsselwort darf nicht allein umbrechen */
              var glue = document.createElement('span');
              glue.className = 'nw';
              node.insertBefore(glue, prev);
              glue.appendChild(prev);
              glue.appendChild(w);
            } else {
              frag.appendChild(w);
            }
          });
          node.replaceChild(frag, c);
        });
      })(h);
      h.classList.add('split');
    }
    if (h.classList.contains('h1')) {
      $$('.serif', h).forEach(function (em) {
        em.insertAdjacentHTML('beforeend', '<svg class="tilde" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M1 6.5C17 .5 31 .5 50 5s33 4.500 49-1.500"/></svg>');
      });
    }
  });

  /* ---------- Wind: feine Teilchen in den dunklen Abschnitten ---------- */
  var fields = [];
  var windRaf = 0, windLast = 0;
  function seed(f, anywhere) {
    var z = Math.random();
    return {
      x: anywhere ? Math.random() * f.w : -12, y: Math.random() * f.h,
      r: 0.5 + z * 1.15, v: 10 + z * 32, a: 0.1 + z * 0.44,
      ph: Math.random() * 6.283, fr: 0.35 + Math.random() * 0.8, amp: 5 + Math.random() * 18,
      green: Math.random() < 0.1
    };
  }
  function sizeField(f) {
    var w = f.host.offsetWidth, h = f.host.offsetHeight;
    if (w === f.w && h === f.h) return;
    f.w = w; f.h = h; f.c.width = w; f.c.height = h;
    var count = Math.max(14, Math.min(96, Math.round(w * h / 19000)));
    f.p = [];
    for (var i = 0; i < count; i++) f.p.push(seed(f, true));
  }
  var windAcc = 0;
  var MAT_ACCENT = { moos: '#ACBE1D', gold: '#D6A23A', fell: '#72ADE4', chrom: '#A3ADBA' };
  function windFrame(t) {
    windRaf = 0;
    /* 30 Bilder pro Sekunde reichen für die langsamen Teilchen */
    if (t - windAcc < 30) { windRaf = requestAnimationFrame(windFrame); return; }
    windAcc = t;
    var dt = Math.min(0.08, (t - windLast) / 1000 || 0.033);
    windLast = t;
    var gust = 1 + 0.45 * Math.sin(t * 0.00023) + 0.2 * Math.sin(t * 0.0011);
    var any = false, accent = MAT_ACCENT[doc.getAttribute('data-mat')] || '#ACBE1D';
    for (var k = 0; k < fields.length; k++) {
      var f = fields[k];
      if (!f.on) continue;
      any = true;
      var ctx = f.ctx, i, p;
      /* nur die alten Teilchenflächen löschen statt der ganzen Fläche */
      for (i = 0; i < f.p.length; i++) { p = f.p[i]; if (p.dy !== undefined) ctx.clearRect(p.dx - 3, p.dy - 3, 6, 6); }
      for (i = 0; i < f.p.length; i++) {
        p = f.p[i];
        p.x += p.v * gust * dt;
        p.ph += p.fr * dt;
        if (p.x > f.w + 12) { f.p[i] = p = seed(f, false); }
        p.dx = p.x; p.dy = p.y + Math.sin(p.ph) * p.amp;
        ctx.globalAlpha = p.a * (0.7 + 0.3 * Math.sin(p.ph * 1.7));
        ctx.fillStyle = p.green ? accent : '#FFFFFF';
        ctx.beginPath();
        ctx.arc(p.dx, p.dy, p.r, 0, 6.283);
        ctx.fill();
      }
    }
    if (any && !document.hidden) windRaf = requestAnimationFrame(windFrame);
  }
  function windStart() { if (!windRaf) { windLast = performance.now(); windRaf = requestAnimationFrame(windFrame); } }
  if (!reduce && 'IntersectionObserver' in window) {
    var windIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        fields.forEach(function (f) { if (f.host === e.target) { f.on = e.isIntersecting; if (f.on) sizeField(f); } });
      });
      windStart();
    }, { rootMargin: '80px 0px' });
    $$('.section--dark,.contact').forEach(function (host) {
      var c = document.createElement('canvas');
      c.className = 'wind';
      c.setAttribute('aria-hidden', 'true');
      host.insertBefore(c, host.firstChild);
      fields.push({ host: host, c: c, ctx: c.getContext('2d'), p: [], on: false, w: 0, h: 0 });
      windIO.observe(host);
    });
    var windResize = 0;
    window.addEventListener('resize', function () {
      clearTimeout(windResize);
      windResize = setTimeout(function () { fields.forEach(function (f) { if (f.on) sizeField(f); }); }, 200);
    }, { passive: true });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) windStart(); });
  }

  /* ---------- Fortschritt im Erstgespräch-Knopf: der Ring schließt sich bis zum Kontakt ---------- */
  var ctaBtn = $('.header__cta'), ctaRing = $('#cta-ring'), ctaLast = -1, CTA_LEN = 56.55;
  function gaugeUpdate(y) {
    if (!ctaRing) return;
    var p = M.ctaEnd > 0 ? Math.min(1, Math.max(0, y / M.ctaEnd)) : 0;
    var q = Math.round(p * 200) / 200;
    if (q === ctaLast) return;
    ctaLast = q;
    ctaRing.style.strokeDashoffset = (CTA_LEN * (1 - q)).toFixed(2);
    ctaBtn.classList.toggle('is-started', q > 0.004);
    ctaBtn.classList.toggle('is-full', q >= 1);
  }

  /* ---------- Scrollgekoppelte Details ---------- */
  var darkSecs = $$('.section--dark');
  var probList = $('.problems__list');
  var probs = $$('.problem');
  var stepsBox = $('.steps');
  var stepEls = $$('.step');
  var wordmark = $('.footer__wordmark');
  var archTrack = $('.arch__track');
  var archGrid = $('.arch__grid');
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  var probFocus = -2, stepLast = [], wordLast = '';
  function fxUpdate(y, vh) {
    var i, m, top;
    if (M.probList) {
      top = M.probList.top - y;
      var best = -1;
      if (top < vh * 0.62 && top + M.probList.h > vh * 0.38) {
        var bestD = 1e9;
        for (i = 0; i < M.probs.length; i++) {
          var d = Math.abs(M.probs[i].top - y + M.probs[i].h / 2 - vh * 0.5);
          if (d < bestD) { bestD = d; best = i; }
        }
      }
      if (best !== probFocus) {
        probFocus = best;
        probList.classList.toggle('has-focus', best > -1);
        for (i = 0; i < probs.length; i++) probs[i].classList.toggle('is-focus', i === best);
      }
    }
    if (M.steps && M.stepsScrub) {
      top = M.steps.top - y;
      if (top < vh && top + M.steps.h > 0) {
        var sp = clamp01((vh * 0.82 - top) / (vh * 0.5)) * stepEls.length;
        for (i = 0; i < stepEls.length; i++) {
          var v = clamp01(sp - i).toFixed(2);
          if (stepLast[i] !== v) { stepLast[i] = v; stepEls[i].style.setProperty('--sp', v); }
        }
      }
    }
    for (i = 0; i < readEls.length; i++) {
      var re = readEls[i];
      m = M.read[i];
      top = m.top - y;
      if (!window.__haltPin && (top + m.h < -50 || top > vh + 50)) continue;
      var n = re.spans.length;
      var hp = window.__haltPin ? window.__haltPin() : -1;   /* steht der Bereich, zählt der Scrollweg im Stand */
      var rp = (hp >= 0 ? hp : clamp01((vh * 0.86 - top) / (vh * 0.42 + m.h))) * (n + 3);
      if (Math.abs(rp - re.last) < 0.05) continue;
      re.last = rp;
      for (var w = 0; w < n; w++) {
        var o = clamp01(rp - w).toFixed(1);
        if (re.vals[w] !== o) { re.vals[w] = o; re.spans[w].style.setProperty('--o', o); }
      }
    }
    if (M.word) {
      top = M.word.top - y;
      if (top < vh + 160) {
        var wy = ((1 - clamp01((vh + 60 - top) / (M.word.h + 60))) * 72).toFixed(0) + 'px';
        if (wy !== wordLast) { wordLast = wy; wordmark.style.setProperty('--wy', wy); }
      }
    }
  }

  /* ---------- Messwerte: einmal lesen, beim Scrollen nur noch rechnen ----------
     So muss der Browser beim Scrollen kein Layout neu berechnen. */
  var M = { ready: false };
  function absRect(el) { var r = el.getBoundingClientRect(); return { top: r.top + (window.scrollY || 0), h: r.height }; }
  function measure() {
    M.vh = window.innerHeight;
    M.max = Math.max(0, doc.scrollHeight - M.vh);
    var kEl = document.getElementById('kontakt');
    M.ctaEnd = kEl ? Math.max(1, Math.min(M.max, kEl.getBoundingClientRect().top + window.scrollY - M.vh * 0.45)) : M.max;
    var hr = header.getBoundingClientRect();
    M.hy = hr.top + hr.height / 2;
    M.dark = darkSecs.map(absRect);
    M.nav = sections.map(function (s) { return s ? absRect(s) : null; });
    M.probList = probList && getComputedStyle(probList).display !== 'flex' ? absRect(probList) : null;
    M.probs = probs.map(absRect);
    M.steps = stepsBox ? absRect(stepsBox) : null;
    M.stepsScrub = !!stepsBox && getComputedStyle(stepsBox).display === 'grid';
    M.read = readEls.map(function (r) { return absRect(r.el); });
    M.word = wordmark ? absRect(wordmark) : null;
    M.play = playMedia ? absRect(playMedia) : null;
    M.rings = rings ? absRect(rings) : null;
    M.pinned = false;
    if (archGrid && archTrack) {
      var cs = getComputedStyle(archGrid);
      M.pinned = cs.position === 'sticky';
      M.gTop = parseFloat(cs.top) || 0;
      M.gMt = parseFloat(cs.marginTop) || 0;
      M.gH = archGrid.offsetHeight;
      /* kleine Fenster: den stehenden Bereich so weit verkleinern, dass er ganz ins Bild passt */
      M.gScale = M.pinned ? Math.min(1, (window.innerHeight - M.gTop - 14) / M.gH) : 1;
      archGrid.style.transform = M.gScale < 0.999 ? 'scale(' + M.gScale.toFixed(4) + ')' : '';
      M.track = absRect(archTrack);
    }
    M.ready = true;
  }

  /* ---------- Leitsätze: Wörter für das Lesen im Scrolltempo vorbereiten ---------- */
  var readEls = reduce ? [] : $$('.haltung__text').map(function (el) {
    var words = el.textContent.split(/\s+/).filter(Boolean);
    el.textContent = '';
    var spans = words.map(function (w, i) {
      var s = document.createElement('span');
      s.className = 'rw';
      s.textContent = w;
      el.appendChild(s);
      if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
      return s;
    });
    return { el: el, spans: spans, last: -1, vals: [] };
  });

  /* ---------- Licht folgt dem Zeiger über Karten ---------- */
  if (finePointer) {
    $$('.card,.inset,.base,.value').forEach(function (el) {
      var ball = el.querySelector('.card__icon');
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty('--lx', (e.clientX - r.left).toFixed(0) + 'px');
        el.style.setProperty('--ly', (e.clientY - r.top).toFixed(0) + 'px');
        /* Glaskugel der Karte: das Glanzlicht wandert auf die Seite, von der der Zeiger kommt */
        if (ball) {
          var b = ball.getBoundingClientRect(), R = b.width * 0.33;
          var dx = e.clientX - (b.left + b.width * 0.5), dy = e.clientY - (b.top + b.height * 0.52);
          var d = Math.sqrt(dx * dx + dy * dy) || 1, k = Math.min(1, d / (R * 2.2)) * 0.62;
          ball.style.setProperty('--hx', (50 + dx / d * k * 50).toFixed(1) + '%');
          ball.style.setProperty('--hy', (50 + dy / d * k * 50).toFixed(1) + '%');
          ball.style.setProperty('--hn', Math.max(0.35, 1 - d / (R * 9)).toFixed(2));
        }
      }, { passive: true });
    });
  }

  /* ---------- Weiches Scrollen mit Nachlauf (nur Maus und Trackpad) ---------- */
  if (finePointer && !reduce) {
    doc.style.scrollBehavior = 'auto';
    var sCur = 0, sTarget = 0, sRun = false, sLast = 0, sK = 7;
    var sMax = function () { return Math.max(0, doc.scrollHeight - window.innerHeight); };
    var sTick = function (t) {
      var dt = Math.min(0.05, (t - sLast) / 1000 || 0.016);
      sLast = t;
      var d = sTarget - sCur;
      if (Math.abs(d) < 0.5) { sCur = sTarget; window.scrollTo(0, sCur); sRun = false; return; }
      sCur += d * (1 - Math.exp(-dt * sK));
      window.scrollTo(0, sCur);
      requestAnimationFrame(sTick);
    };
    var sGo = function (to, k) {
      if (!sRun) sCur = window.scrollY;
      sTarget = Math.max(0, Math.min(sMax(), to));
      sK = k;
      if (!sRun) { sRun = true; sLast = performance.now(); requestAnimationFrame(sTick); }
    };
    window.addEventListener('wheel', function (e) {
      if (e.ctrlKey || e.metaKey || e.defaultPrevented) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      var dy = e.deltaY * (e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? window.innerHeight : 1);
      var from = sRun ? sCur : window.scrollY, to = (sRun ? sTarget : window.scrollY) + dy;
      /* Bühne (Haltung): innerhalb der Strecke darf das Ziel dem Stand nur ein Stück vorauseilen –
         so läuft die Animation immer zu Ende, auch bei schnellem Scrollen */
      var gate = window.__scrollGate ? window.__scrollGate() : null;
      if (gate) {
        var LEAD = 92;
        if (dy > 0 && from < gate[1] && to > gate[0]) to = Math.min(to, Math.max(from, gate[0]) + LEAD);
        else if (dy < 0 && from > gate[0] && to < gate[1]) to = Math.max(to, Math.min(from, gate[1]) - LEAD);
      }
      var gated = gate && to !== (sRun ? sTarget : window.scrollY) + dy;
      sGo(to, gated ? 7 : Math.abs(dy) < 40 ? 16 : 7);
    }, { passive: false });
    /* Tastatur, Scrollleiste und Co. laufen nativ – der Nachlauf übernimmt deren Stand */
    window.addEventListener('keydown', function () { sRun = false; }, { passive: true });
    window.addEventListener('pointerdown', function () { sRun = false; }, { passive: true });
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a || e.defaultPrevented) return;
      var id = a.getAttribute('href');
      var el = id.length > 1 ? document.getElementById(id.slice(1)) : null;
      if (!el) return;
      e.preventDefault();
      var top = id === '#top' ? 0 : el.getBoundingClientRect().top + window.scrollY - parseFloat(getComputedStyle(doc).scrollPaddingTop || 0);
      sGo(top, 4.5);
      if (history.pushState) history.pushState(null, '', id);
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
      el.focus({ preventScroll: true });
    });
  }

  /* ---------- Header: Zustand beim Scrollen, aktiver Menüpunkt ---------- */
  var header = $('#header');
  var navLinks = $$('.nav__link');
  var sections = navLinks.map(function (a) { return $(a.getAttribute('href')); });
  var playMedia = $('#play-media');
  var playImg = playMedia ? $('img', playMedia) : null;
  var rings = $('#rings');
  var ticking = false;
  var hoverLock = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }

  var wasDark = null, navCur = -2;
  function update() {
    ticking = false;
    if (!M.ready) measure();
    var y = window.scrollY || window.pageYOffset, vh = M.vh, i, m;
    header.classList.toggle('is-scrolled', y > 24);
    gaugeUpdate(y);

    var hyAbs = y + M.hy, onDark = false;
    for (i = 0; i < M.dark.length; i++) {
      m = M.dark[i];
      if (m.top <= hyAbs && m.top + m.h > hyAbs) { onDark = true; break; }
    }
    if (onDark !== wasDark) { wasDark = onDark; header.classList.toggle('on-dark', onDark); }

    var probe = y + vh * 0.4, current = -1;
    for (i = 0; i < M.nav.length; i++) {
      m = M.nav[i];
      if (m && m.top <= probe && m.top + m.h > probe) current = i;
    }
    if (current !== navCur) {
      navCur = current;
      navLinks.forEach(function (a, idx) {
        var on = idx === current;
        a.classList.toggle('is-active', on);
        if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      });
    }

    var archNear = M.track && M.track.top - y < vh && M.track.top + M.track.h - y > 0;
    if (M.pinned && archNear) linkKick();
    if (reduce) return;
    fxUpdate(y, vh);

    /* Rasen im Abschnitt Spielraum: leichte Parallaxe */
    if (playImg && M.play && M.pinned) {
      var pt = M.play.top - y;
      if (pt + M.play.h > 0 && pt < vh) playMedia.style.setProperty('--py', ((0.5 - (vh - pt) / (vh + M.play.h)) * 48).toFixed(0) + 'px');
    }

    /* Markenarchäologie: Schicht für Schicht nach innen */
    if (rings && !hoverLock) {
      var raw = -1;
      if (M.pinned) {
        if (archNear) raw = clamp01((M.gTop - M.gMt - (M.track.top - y)) / (M.track.h - M.gH - M.gMt) * 1.28);
      } else if (M.rings) {
        var rt = M.rings.top - y;
        if (rt + M.rings.h > 0 && rt < vh) raw = clamp01((vh * 0.78 - (rt + M.rings.h / 2)) / (vh * 0.5));
      }
      if (raw > -1) {
        /* weich von Schicht zu Schicht: an jeder Schicht kurz verweilen */
        var q = raw * 4, fl = Math.min(3, Math.floor(q)), fr = Math.min(1, q - fl);
        fr = fr * fr * fr * (fr * (fr * 6 - 15) + 10);
        setStack(fl + fr);
      }
    }
  }

  /* ---------- Markenarchäologie: Ringe und Liste koppeln ---------- */
  var layerEls = $$('.layer');
  var ringEls = $$('.ring');
  var activeLayer = 4;

  /* Der Stapel folgt einem gleitenden Wert zwischen 0 und 4, nie einem Sprung */
  var pT = 4, pC = 4, pRaf = 0, pLast = 0;
  function pTick(t) {
    var k = 1 - Math.exp(-Math.min(0.05, (t - pLast) / 1000 || 0.016) * 9);
    pLast = t;
    pC += (pT - pC) * k;
    if (Math.abs(pT - pC) < 0.0015) pC = pT;
    rings.style.setProperty('--p', pC.toFixed(4));
    pRaf = pC !== pT ? requestAnimationFrame(pTick) : 0;
    linkKick();
  }
  function setStack(v) {
    pT = v;
    setLayer(Math.round(v));
    if (!rings) return;
    if (reduce) { pC = pT; rings.style.setProperty('--p', pT); return; }
    if (!pRaf && pC !== pT) { pLast = performance.now(); pRaf = requestAnimationFrame(pTick); }
  }

  /* Bezugslinie von der obersten Platte zur aktiven Zeile */
  var link = $('#arch-link');
  var linkPath = link ? $('path', link) : null, linkA = link ? $('.arch__link-a', link) : null, linkB = link ? $('.arch__link-b', link) : null;
  var plateFaces = $$('.plate__face');
  var lk = null, lRaf = 0, lLast = 0;
  function linkTarget() {
    if (!link || !archGrid || !plateFaces[activeLayer] || !layerEls[activeLayer] || link.getBoundingClientRect().width === 0) return null;
    var g = archGrid.getBoundingClientRect();
    if (g.bottom < 0 || g.top > window.innerHeight) return null;
    var pr = plateFaces[activeLayer].getBoundingClientRect();
    var rr = layerEls[activeLayer].getBoundingClientRect();
    var gs = M.gScale || 1;
    return [(pr.right - g.left) / gs - 3, (pr.top + pr.height / 2 - g.top) / gs, (rr.left - g.left) / gs - 12, (rr.top + rr.height / 2 - g.top) / gs];
  }
  function linkTick(t) {
    lRaf = 0;
    var tg = linkTarget();
    if (!tg) { link && link.classList.remove('is-on'); return; }
    var k = reduce ? 1 : 1 - Math.exp(-Math.min(0.05, (t - lLast) / 1000 || 0.016) * 11);
    lLast = t;
    var moving = false;
    if (!lk) lk = tg.slice();
    for (var i = 0; i < 4; i++) {
      var d = tg[i] - lk[i];
      if (Math.abs(d) > 0.3) { lk[i] += d * k; moving = true; } else lk[i] = tg[i];
    }
    var mx = lk[0] + (lk[2] - lk[0]) * 0.55;
    linkPath.setAttribute('d', 'M' + lk[0].toFixed(1) + ' ' + lk[1].toFixed(1) + 'H' + mx.toFixed(1) + 'V' + lk[3].toFixed(1) + 'H' + lk[2].toFixed(1));
    linkA.setAttribute('cx', lk[0].toFixed(1)); linkA.setAttribute('cy', lk[1].toFixed(1));
    linkB.setAttribute('cx', lk[2].toFixed(1)); linkB.setAttribute('cy', lk[3].toFixed(1));
    link.classList.toggle('is-on', rings.classList.contains('is-in'));
    if (moving || pRaf) lRaf = requestAnimationFrame(linkTick);
  }
  function linkKick() { if (link && !lRaf) { lLast = performance.now(); lRaf = requestAnimationFrame(linkTick); } }

  function setLayer(n) {
    if (n === activeLayer) return;
    activeLayer = n;
    layerEls.forEach(function (el, i) { el.classList.toggle('is-active', i === n); });
    ringEls.forEach(function (el, i) { el.classList.toggle('is-active', i === n); });
    if (rings) rings.setAttribute('data-n', n);
    linkKick();
  }

  layerEls.forEach(function (el, i) {
    /* Schichten wechseln nur beim Scrollen – oder gezielt per Klick/Tastatur auf eine Zeile */
    var pick = function () {
      if (M.pinned && M.track) {
        /* im Stand: an die Scrollstelle dieser Schicht fahren, dann stimmen Stapel und Scrollstand überein */
        var span = M.track.h - M.gH - M.gMt;
        var to = M.track.top - (M.gTop - M.gMt) + (i / 4) / 1.28 * span + (i ? 2 : 0);
        hoverLock = false;
        if (typeof sGo === 'function') sGo(to, 4.5); else window.scrollTo({ top: to, behavior: 'smooth' });
      } else {
        hoverLock = true; lockY = window.scrollY; setStack(i);
      }
    };
    el.addEventListener('click', pick);
    el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
  });
  var lockY = 0;
  /* ohne Stand (kleine Fenster, Handy): die gewählte Schicht bleibt, bis weitergescrollt wird */
  window.addEventListener('scroll', function () { if (hoverLock && Math.abs(window.scrollY - lockY) > 48) hoverLock = false; }, { passive: true });
  var layersBox = $('#layers');
  if (layersBox) {

  }
  window.addEventListener('scroll', onScroll, { passive: true });
  var remeasure = 0;
  function measureSoon() { clearTimeout(remeasure); remeasure = setTimeout(function () { measure(); onScroll(); }, 120); }
  window.addEventListener('resize', measureSoon, { passive: true });
  window.addEventListener('load', measureSoon);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureSoon);
  if ('ResizeObserver' in window) new ResizeObserver(measureSoon).observe(document.body);
  /* Touch: Eine angetippte Schicht bleibt nur stehen, bis wieder gescrollt wird */
  window.addEventListener('touchmove', function () { hoverLock = false; }, { passive: true });
  update();

  /* ---------- Hero: Ein Klick auf die Tilde wechselt das Material, die Akzentfarbe der Seite wechselt mit ----------
     Start ist immer Moos. Jeder Klick zieht zufällig ein anderes Material; erst wenn alle dran waren, wiederholt sich eines. */
  /* Bilder, die mit dem Material der Tilde wechseln: Das neue blendet über dem alten ein, erst danach verschwindet das alte.
     Bilder mit data-src laden erst, wenn sie gebraucht werden. Gibt es für ein Material kein Bild, bleibt der Grund darunter sichtbar. */
  function matSwap(box, sel) {
    var els = {}, cur = null, timer = 0;
    if (!box) return function () {};
    Array.prototype.forEach.call(box.querySelectorAll(sel), function (el) {
      els[el.getAttribute('data-m')] = el;
      if (el.classList.contains('is-on')) cur = el;
    });
    return function (m) {
      var next = els[m] || null, old = cur, k;
      if (next === cur) return;
      clearTimeout(timer);
      for (k in els) if (els[k] !== next && els[k] !== cur) els[k].classList.remove('is-on', 'is-top');
      cur = next;
      if (next) {
        if (!next.getAttribute('src')) {
          if (next.getAttribute('data-srcset')) next.srcset = next.getAttribute('data-srcset');
          next.src = next.getAttribute('data-src');
        }
        if (old) old.classList.remove('is-top');
        next.classList.add('is-top');
        var show = function () { if (cur === next) next.classList.add('is-on'); };
        if (next.complete && next.naturalWidth) show(); else next.addEventListener('load', show, { once: true });
        timer = setTimeout(function () { if (old && old !== cur) old.classList.remove('is-on'); }, 1600);
      } else if (old) {
        old.classList.add('is-top'); old.classList.remove('is-on');
      }
    };
  }
  /* Spielraum: die Fläche unter der Kugel (Rasen bei Moos). Kontakt: die Tilde über der Kontakt-Box. */
  var playSurf = matSwap($('#play-media'), '.play__surf');
  var contactTilde = matSwap($('.contact__moss'), 'img');
  var MAT_NAME = { moos: 'Moos', gold: 'Gold', fell: 'Hellblaues Fell', chrom: 'Flüssiges Chrom' };
  var heroMat = { cur: 'moos', gl: null, busy: false, queued: false, fast: false, done: null };
  (function () {
    var art = $('#hero-art'), alt = $('.hero__alt');
    if (!art || !alt) return;
    doc.setAttribute('data-mat', 'moos');
    art.removeAttribute('aria-hidden');
    art.setAttribute('role', 'button');
    art.setAttribute('tabindex', '0');
    art.setAttribute('aria-label', 'Material der Tilde wechseln. Aktuell: Moos');
    var bag = [];
    function pick() {
      if (!bag.length) {
        for (var k in MAT_NAME) if (k !== heroMat.cur) bag.push(k);
        for (var i = bag.length - 1; i > 0; i--) { var r = Math.floor(Math.random() * (i + 1)), x = bag[i]; bag[i] = bag[r]; bag[r] = x; }
      }
      return bag.pop();
    }
    function go() {
      /* läuft noch eine Verwandlung, wird sie beschleunigt und der Klick danach ausgeführt */
      if (heroMat.busy) { heroMat.queued = true; heroMat.fast = true; return; }
      var prev = heroMat.cur, m = pick();
      heroMat.cur = m;
      doc.setAttribute('data-mat', m);
      doc.classList.toggle('is-gold', m === 'gold');
      doc.classList.toggle('is-alt', m !== 'moos');
      art.setAttribute('aria-label', 'Material der Tilde wechseln. Aktuell: ' + MAT_NAME[m]);
      if (m !== 'moos') {
        /* Standbild für Geräte ohne WebGL oder mit „weniger Bewegung“ */
        alt.srcset = 'assets/img/' + m + '-tilde-800.webp 800w, assets/img/' + m + '-tilde.webp 1400w';
        alt.src = 'assets/img/' + m + '-tilde-800.webp';
      }
      playSurf(m);
      contactTilde(m);
      if (heroMat.gl) heroMat.gl(prev, m);
    }
    heroMat.done = function () {
      heroMat.fast = false;
      if (heroMat.queued) { heroMat.queued = false; go(); }
    };
    art.addEventListener('click', go);
    art.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
    });
  })();

  /* ---------- Hero: die Tilde als kleine Grafikkarten-Routine ----------
     Der Schatten ist ein eigenes, festes Bild. Im Ruhezustand lebt jedes Material auf seine Art:
     Im Moos zieht Wind in Wellen durch die Büschel, durch das Fell geht derselbe Wind und lässt vor allem die Spitzen am Rand wehen, über das Gold läuft ein Lichtstreif, der Ballon schwebt und lässt sich anstupsen,
     das Chrom steht still und spiegelt das Licht des Mauszeigers. Beim Wechsel hat jedes Material seine eigene Verwandlung:
     Gold drückt sich heraus, Moos wächst in Inseln zu, Fell wächst Strähne für Strähne, Chrom läuft als Flüssigkeit darüber.
     Licht kommt dabei immer von links oben. Ohne WebGL bleibt das Standbild stehen. */
  (function () {
    var img = $('.hero__moss'), heroSec = $('#top'), altEl = $('.hero__alt');
    if (!img || !heroSec || reduce) return;
    var MAT_ID = { moos: 0, gold: 1, fell: 2, chrom: 3 };
    var DUR = { gold: 4600, moos: 4600, fell: 3600, chrom: 4000 };
    function start() {
      var c = document.createElement('canvas');
      c.className = 'hero__moss-gl';
      c.setAttribute('aria-hidden', 'true');
      var gl = c.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false });
      if (!gl) return;
      var VS = 'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
      var FS = [
        /* s: Material A (das bisherige), g: Material B (das neue). ma/mb: 0 Moos, 1 Gold, 2 Fell, 3 Chrom.
           md: 0 A reißt auf und B drückt sich heraus · 1 dasselbe rückwärts (B wächst über A zu) · 2 Fell wächst · 3 Chrom fließt */
        'precision highp float;varying vec2 v;uniform sampler2D s;uniform sampler2D g;uniform float t;uniform float u;uniform float gt;uniform float ma;uniform float mb;uniform float md;uniform sampler2D nm;uniform vec3 lp;uniform vec3 dp;',
        'const vec2 R=vec2(1185.,670.);const float T=6.2831853;',
        'vec2 gD;float gLean;float gFl;float gGust;',
        'vec4 tx(float w,vec2 c){return w<.5?texture2D(s,c):texture2D(g,c);}',
        'float sq(float x){return x*x;}',
        'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
        /* ein weicher Zufallswert je Büschel */
        'float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}',
        /* Landkarte, wo das Moos zuerst aufreißt und wo es am längsten bleibt */
        'float Hf(vec2 p){return clamp((.6*n(p/92.)+.4*n(p/37.+7.)-.14)/.72,0.,1.);}',
        /* Eine Ebene in ihrem Ruhezustand. w: welches Bild, m: Material, off: zusätzliche Verschiebung in Pixeln,
           sc: Größe um die Mitte, boost: verstärkt die Eigenbewegung, sk: Anteil des Lichtstreifs (nur Gold) */
        'vec4 layer(float w,float m,vec2 off,float sc,float boost,float sk){',
        ' vec2 c=(v-.5)/sc+.5;',
        ' float ws=m<.5?1.:(abs(m-2.)<.5?.75*(1.+.45*boost):0.);',
        ' float wg=0.;vec2 d=off;',
        ' if(ws>0.){',
        '  float e=min(min(tx(w,c+vec2(14.,0.)/R).a,tx(w,c+vec2(-14.,0.)/R).a),min(tx(w,c+vec2(0.,14.)/R).a,tx(w,c+vec2(0.,-14.)/R).a));',
        /* Moos bewegt sich am Rand weniger, beim Fell wehen gerade die Spitzen am Rand */
        '  wg=(m<.5?mix(.5,1.,e):mix(1.6,.85,e))*ws;d+=gD*wg;',
        ' }',
        ' vec2 o=d/R;o.y=-o.y;',
        ' vec2 cc=c-o;',
        /* Gold-Ballon: Wo der Mauszeiger die Folie berührt (dp), gibt sie nach. Das Bild zieht sich zur Delle hin zusammen. */
        ' float dk=0.,dr=0.;vec2 dn=vec2(0.);',
        ' if(abs(m-1.)<.5&&dp.z>.001){vec2 da=vec2(R.x/R.y,1.);vec2 dv=(c-dp.xy)*da;dr=length(dv);dk=exp(-dr*dr/.011)*dp.z;dn=dv/(dr+.0001);cc-=dv/da*dk*.3;}',
        ' vec4 px;',
        ' if(abs(m-3.)<.5){',
        /* Chrom: die Spiegelung wandert langsam, der Umriss bleibt fest */
        /* Chrom steht still und antwortet auf das Licht: Der Mauszeiger ist eine Lichtquelle über der Fläche (lp).
           nm ist das Relief der Tilde. Das Licht spiegelt sich als helle Fläche und als Glanzpunkt in den Falten,
           die dem Licht abgewandten Flanken werden dunkler, und die Spiegelung in den Schrägen wandert mit.
           Nur direkt nach dem Darüberfließen schwappt die Spiegelung noch kurz nach (boost). */
        '  float fa=.0032*boost;',
        '  vec2 fw=fa*vec2(sin(T*(c.y*2.1+t*.055)+3.*c.x),cos(T*(c.x*1.6-t*.045)+2.*c.y));',
        '  vec3 nn=texture2D(nm,cc).rgb;',
        '  vec3 N=normalize(vec3((nn.r-.5)*2.,-(nn.g-.5)*2.,max(nn.b,.06)));',
        '  vec2 asp=vec2(R.x/R.y,1.);',
        '  vec3 lv=vec3((lp.xy-c)*asp,.34);float ld=length(lv.xy);vec3 l=normalize(lv);',
        '  float att=1./(1.+ld*ld*1.6);',
        '  float ndh=max(dot(N,normalize(l+vec3(0.,0.,1.))),0.);',
        '  float lit=dot(N,l);',
        /* vier Abtastpunkte je Bildpunkt: Das große Bild wird sauber verkleinert, harte Kanten bleiben glatt */
        '  vec2 cs=cc+fw-l.xy/asp*(1.-N.z)*.018*lp.z;vec2 po=.3/R;',
        '  px=.25*(tx(w,cs+po)+tx(w,cs-po)+tx(w,cs+vec2(po.x,-po.y))+tx(w,cs+vec2(-po.x,po.y)));px.a=tx(w,cc).a;',
        '  px.rgb*=mix(1.,mix(.6,1.1,smoothstep(-.3,.7,lit)),lp.z*(.35+.65*att));',
        '  px.rgb+=vec3(1.)*(smoothstep(.925,.975,ndh)*.5+pow(ndh,140.)*.8)*att*lp.z;',
        ' }else{px=tx(w,cc);}',
        ' px.rgb*=1.+.1*(gLean-.36)*wg+.03*gFl*wg*gGust;',
        /* Delle im Licht von links oben: Die Mulde ist dunkler, ihre dem Licht zugewandte Wand glänzt, die andere liegt im Schatten */
        ' if(dk>.0005){',
        '  float rim=exp(-sq((dr-.085)/.035))*dp.z;float side=dot(dn,vec2(.7071,-.7071));',
        '  px.rgb*=1.-.15*dk-.2*rim*max(-side,0.);',
        '  px.rgb+=vec3(1.,.93,.7)*.42*rim*max(side,0.);',
        ' }',
        ' if(abs(m-1.)<.5&&sk>0.){',
        '  vec2 q=v*R;q.y=R.y-q.y;',
        '  float sweep=exp(-sq((q.x/R.x*1.15+(q.y/R.y)*.4-fract(gt*.1)*2.4+.45)*6.5))*.2*sk;',
        '  px.rgb=px.rgb*(1.+sweep)+vec3(1.,.93,.7)*.1*sweep;',
        ' }',
        ' return px;',
        '}',
        /* Wie weit das Fell an einer Stelle gewachsen ist: von links unten nach rechts oben */
        'float furP(vec2 q){return clamp((u*1.42-(.62*q.x/R.x+.18*(1.-q.y/R.y)+.2*n(q/130.+3.)))/.42,0.,1.);}',
        /* Wie tief eine Stelle schon im Chrom liegt: Die Flüssigkeit läuft von links oben, Tropfen eilen voraus */
        'float chromC(vec2 q){return mix(-.25,1.22,u)-(.6*q.x/R.x+.4*q.y/R.y)+.1*(n(q/85.+vec2(0.,t*.25))-.5)+.085*(n(q/24.+vec2(t*.35,0.))-.6);}',
        'void main(){',
        ' vec2 q=v*R;q.y=R.y-q.y;float x01=q.x/R.x;',
        ' float r1=n(q/9.),r2=n(q/9.+37.),r3=n(q/9.+91.),r4=n(q/17.+13.);',
        ' float g1=.5+.5*sin(T*((q.x+.25*q.y)/520.-t*.25));',
        ' float g2=.5+.5*sin(T*((q.x-.4*q.y)/310.-t*.375)+1.3);',
        ' float g3=.5+.5*sin(T*((q.x+.12*q.y)/150.-t*.85)+2.1);',
        ' float zone=smoothstep(.38,.72,n(q/210.+vec2(t*.06,t*.02)));',
        ' float gust=.55*g1*g1+.3*g2*g2+.55*zone*g3*g3;',
        ' float lean=gust*(.35+.65*r1);',
        ' float fr=mix(.7,2.3,r3)*(.8+.5*zone);',
        ' float fl=sin(T*fr*t+T*r2),fl2=sin(T*.625*t+T*r4);',
        ' float k=.25+.75*gust;',
        ' gD=vec2(6.2*lean+(1.5*fl+.8*fl2)*k,-1.9*lean+.75*fl*k*(r1-.5)*2.);gLean=lean;gFl=fl;gGust=gust;',
        ' float idle=1.-smoothstep(0.,.08,u);',
        ' if(md<1.5){',
        /* Aufreißen: Die obere Schicht reißt an vielen Stellen auf und zieht sich ungleichmäßig zu Inseln zusammen,
           bis nichts mehr übrig ist. Die untere drückt sich dabei heraus. Rückwärts wächst die obere wieder zu. */
        '  float sw=md<.5?0.:1.;',
        '  float uu=sw<.5?u:1.-u;',
        '  float mt=sw<.5?ma:mb,mu=sw<.5?mb:ma;',
        '  float H=Hf(q);',
        '  float xu=2.*uu-1.;',
        '  float thr=mix(-.1,1.1,.5+.5*sign(xu)*pow(abs(xu),1.9));',   /* in der Mitte langsamer, damit die Fläche gleichmäßig schwindet */
        '  vec2 gr=vec2(Hf(q+vec2(6.,0.))-Hf(q-vec2(6.,0.)),Hf(q+vec2(0.,6.))-Hf(q-vec2(0.,6.)));',
        '  vec2 inw=gr/(length(gr)+.0008);',                         /* Richtung ins Innere der Insel */
        '  float rim=1.-smoothstep(0.,.22,H-thr);',                  /* wie nah am Rand der Insel */
        '  float act=step(.001,uu);',
        '  vec4 m=layer(sw,mt,-inw*(rim*rim*(10.+26.*uu))*act,1.,0.,sw<.5?idle:0.);',   /* am Rand staucht sich die Schicht nach innen */
        '  float am=m.a*mix(1.,smoothstep(thr-.012,thr+.03,H),act);',
        '  vec3 col=m.rgb;',
        '  col*=1.-.3*rim*rim*act*(1.-step(.999,uu));',               /* der dicke Rand liegt im Schatten */
        /* Untere Schicht: startet etwas kleiner und dunkler, wölbt sich heraus und federt am Ende leicht nach */
        '  float c1=1.70158,c3=2.70158,ub=uu-1.;',
        '  float back=1.+c3*ub*ub*ub+c1*ub*ub;',
        '  float sg=.925+.075*back;',
        '  vec4 G=uu>0.?layer(1.-sw,mu,vec2(0.),sg,0.,sw<.5?0.:idle):vec4(0.);',
        '  float open=max(smoothstep(0.,.3,thr-H),smoothstep(.8,1.,uu));',                     /* wie lange die Stelle schon frei liegt */
        '  float moving=act*(1.-step(.999,uu));',
        '  float near=exp(-sq((thr-H)/.05))*moving;',            /* direkt am Rand: Schlagschatten */
        '  float flash=exp(-sq((thr-H-.13)/.08))*moving*.5;',       /* knapp dahinter blitzt es auf */
        '  vec3 tint=abs(mu-1.)<.5?vec3(1.,.93,.7):(abs(mu-2.)<.5?vec3(.86,.94,1.):vec3(1.));',
        '  vec3 gc=G.rgb*(mix(.62,1.,open)*(1.-.38*near)+.5*flash)+tint*.2*flash;',
        '  float ag=G.a*act;',
        '  gl_FragColor=vec4(col*am+gc*ag*(1.-am),am+ag*(1.-am));',
        ' }else if(md<2.5){',
        /* Fell wächst: Strähne für Strähne schiebt sich aus der Fläche, erst kurz und im Schatten, dann lang und hell.
           Das wachsende Fell wirft seinen Schatten nach rechts unten auf das alte Material und schüttelt sich kurz auf. */
        '  float p=furP(q);',
        '  vec2 hd=normalize(vec2(.55,-.83)+.28*vec2(n(q/190.)-.5,n(q/190.+9.)-.5));',   /* Wuchsrichtung, leicht verwirbelt */
        '  vec2 hp=vec2(-hd.y,hd.x);',
        '  float st=n(vec2(dot(q,hp)/2.2,dot(q,hd)/26.));',          /* jede Strähne kommt zu ihrer Zeit */
        '  float len=smoothstep(st*.68,st*.68+.3,p);',
        '  float gw=1.-p;',
        '  vec4 F=layer(1.,mb,-hd*gw*gw*24.,1.-.045*gw,2.4*sin(3.14159*p),0.);',
        '  float af=F.a*len;',
        '  vec3 fc=F.rgb*mix(.5,1.,smoothstep(0.,.9,p));',            /* der Ansatz liegt im Schatten */
        '  fc+=vec3(.78,.9,1.)*.2*exp(-sq((p-.38)/.17))*len;',    /* frische Spitzen fangen das Licht */
        '  vec4 A0=layer(0.,ma,vec2(0.),1.,0.,idle);',
        '  float sh=smoothstep(.05,.6,furP(q-vec2(13.,13.)))*(1.-len);',
        '  vec3 ac=A0.rgb*(1.-.45*sh);',
        '  float aa=A0.a*(1.-smoothstep(.5,.95,p));',
        '  gl_FragColor=vec4(fc*af+ac*aa*(1.-af),af+aa*(1.-af));',
        ' }else{',
        /* Chrom fließt: Die Flüssigkeit läuft über die Form. Ihr Rand ist ein runder Wulst: zur Lichtseite hell,
           zur anderen dunkel, er staucht die Spiegelung wie eine Linse und wirft einen Schatten voraus. */
        '  float c0=chromC(q),cx=chromC(q+vec2(5.,0.)),cy=chromC(q+vec2(0.,5.));',
        '  vec2 gd=vec2(cx-c0,cy-c0);',
        '  vec2 no=-gd/(length(gd)+.00001);',                       /* zeigt aus der Flüssigkeit heraus */
        '  float cov=smoothstep(0.,.008,c0);',
        '  float bead=1.-clamp(c0/.075,0.,1.);',                    /* 1 am Rand, 0 im Inneren */
        '  float lit=dot(no,vec2(-.7071,-.7071));',                 /* Licht von links oben */
        '  float settle=1.-clamp(c0/.4,0.,1.);',
        '  vec4 C=layer(1.,mb,no*bead*bead*30.,1.,5.*settle,0.);',
        '  vec3 cc=C.rgb*(1.-.5*bead*max(-lit,0.))*(1.-.4*smoothstep(.78,1.,bead));',
        '  cc+=vec3(1.)*.85*exp(-sq((bead-.5)/.17))*pow(max(lit,0.),1.5);',
        '  float ac2=C.a*cov;',
        '  vec4 A0=layer(0.,ma,vec2(0.),1.,0.,idle);',
        '  float sh=smoothstep(0.,.035,chromC(q-vec2(10.,10.)))*(1.-cov);',
        '  vec3 ac=A0.rgb*(1.-.5*sh);',
        '  float aa=A0.a*(1.-smoothstep(.02,.1,c0));',
        '  gl_FragColor=vec4(cc*ac2+ac*aa*(1.-ac2),ac2+aa*(1.-ac2));',
        ' }',
        '}'].join('\n');
      function sh(type, src) { var o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); return gl.getShaderParameter(o, gl.COMPILE_STATUS) ? o : null; }
      var vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
      if (!vs || !fs) return;
      var pr = gl.createProgram();
      gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return;
      gl.useProgram(pr);
      var buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      var loc = gl.getAttribLocation(pr, 'p');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      /* je Material ein Bild auf der Grafikkarte */
      var texs = {}, ready = {};
      function upload(name, source) {
        var tex = gl.createTexture();
        gl.activeTexture(gl.TEXTURE3);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.activeTexture(gl.TEXTURE0);
        texs[name] = tex; ready[name] = true;
      }
      function bind(unit, name) {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, texs[name]);
        gl.activeTexture(gl.TEXTURE0);
      }
      try { upload('moos', img); } catch (err) { return; }
      var uT = gl.getUniformLocation(pr, 't'), uU = gl.getUniformLocation(pr, 'u'), uGt = gl.getUniformLocation(pr, 'gt');
      var uMa = gl.getUniformLocation(pr, 'ma'), uMb = gl.getUniformLocation(pr, 'mb'), uMd = gl.getUniformLocation(pr, 'md');
      gl.uniform1i(gl.getUniformLocation(pr, 's'), 0);
      gl.uniform1i(gl.getUniformLocation(pr, 'g'), 1);
      /* Relief der Chrom-Tilde (Platz 2). Bis es geladen ist, gilt eine glatte Fläche. */
      gl.uniform1i(gl.getUniformLocation(pr, 'nm'), 2);
      var uLp = gl.getUniformLocation(pr, 'lp'), uDp = gl.getUniformLocation(pr, 'dp'), nmTex = gl.createTexture();
      function nmSet(source) {
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, nmTex);
        if (source) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, source);
        else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([128, 128, 255]));
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.activeTexture(gl.TEXTURE0);
      }
      nmSet(null);
      /* Licht über dem Chrom: folgt dem Mauszeiger. Ohne Maus (Handy) oder wenn sie länger ruht, wandert es langsam von selbst. */
      var lx = 0.3, ly = 0.8, la = 0, mX = 0, mY = 0, mAt = -1e9, mDirty = false, cRect = null;
      /* Umriss des Ballons (48 Punkte, Anteile der Bildbreite und -höhe). Damit wird gemessen, wie viel Platz bis zum Text bleibt. */
      var GOLD_OUT = [0.857,0.047,0.811,0.134,0.760,0.211,0.708,0.255,0.654,0.273,0.601,0.273,0.548,0.262,0.495,0.231,0.441,0.201,0.389,0.169,0.335,0.144,0.282,0.123,0.229,0.116,0.175,0.131,0.122,0.152,0.069,0.193,0.019,0.262,0.011,0.355,0.013,0.449,0.014,0.544,0.009,0.637,0.009,0.732,0.009,0.826,0.011,0.920,0.051,0.900,0.101,0.832,0.155,0.780,0.208,0.756,0.261,0.757,0.314,0.767,0.368,0.786,0.421,0.810,0.474,0.845,0.527,0.871,0.581,0.900,0.634,0.920,0.687,0.922,0.741,0.910,0.794,0.881,0.847,0.843,0.898,0.780,0.947,0.695,0.989,0.604,0.971,0.509,0.951,0.417,0.928,0.322,0.906,0.229,0.885,0.134];
      var goldLim = null;
      function goldLimits() {
        var ar = img.getBoundingClientRect(), rects = [], list = [], i, j;
        Array.prototype.forEach.call(heroSec.querySelectorAll('h1,p,.btn'), function (el) {
          if (el.closest('#hero-art') || el.closest('.logos__view')) return;
          if (el.classList.contains('btn')) { rects.push(el.getBoundingClientRect()); return; }
          var rg = document.createRange(); rg.selectNodeContents(el);
          var cr = rg.getClientRects(); for (var q = 0; q < cr.length; q++) if (cr[q].width > 2 && cr[q].height > 2) rects.push(cr[q]);
        });
        for (i = 0; i < rects.length; i++) {
          var r = rects[i], bd = 1e9, bnx = 0, bny = 0;
          for (j = 0; j < GOLD_OUT.length; j += 2) {
            var px = ar.left + GOLD_OUT[j] * ar.width, py = ar.top + GOLD_OUT[j + 1] * ar.height;
            var ddx = Math.max(r.left, Math.min(r.right, px)) - px, ddy = Math.max(r.top, Math.min(r.bottom, py)) - py, dd = Math.sqrt(ddx * ddx + ddy * ddy);
            if (dd < bd) { bd = dd; bnx = ddx / (dd || 1); bny = ddy / (dd || 1); }
          }
          /* in Richtung dieses Textes darf sich der Ballon nur so weit bewegen, dass 10 px Luft bleiben (plus Spielraum für die Drehung) */
          if (bd < ar.width * 0.1) list.push([bnx, bny, Math.max(0, bd - 10 - ar.width * 0.008)]);
        }
        goldLim = list;
      }
      window.addEventListener('resize', function () { goldLim = null; }, { passive: true });
      var shEl = $('.hero__moss-shadow'), gG = 0, nX = 0, nY = 0, nR = 0, vX = 0, vY = 0, vR = 0, bX = 0, bY = 0, dZ = 0, gMoved = false;
      if (finePointer) window.addEventListener('pointermove', function (e) {
        if (e.pointerType && e.pointerType !== 'mouse') return;
        mX = e.clientX; mY = e.clientY; mAt = performance.now(); mDirty = true;
      }, { passive: true });
      window.addEventListener('scroll', function () { cRect = null; }, { passive: true });
      window.addEventListener('resize', function () { cRect = null; }, { passive: true });
      bind(0, 'moos'); bind(1, 'moos');
      gl.uniform1f(uMa, 0); gl.uniform1f(uMb, 0); gl.uniform1f(uMd, 0);
      /* Verwandlung von A nach B; rp läuft von 0 bis 1 */
      var A = 'moos', B = 'moos', running = false, rp = 0, dur = 1, lastNow = 0, since = performance.now(), pend = null;
      function begin(from, to) {
        A = from; B = to; rp = 0; running = true; dur = DUR[to];
        bind(0, A); bind(1, B);
        gl.uniform1f(uMa, MAT_ID[A]); gl.uniform1f(uMb, MAT_ID[B]);
        gl.uniform1f(uMd, to === 'gold' ? 0 : to === 'moos' ? 1 : to === 'fell' ? 2 : 3);
        kick();
      }
      function finish() {
        running = false; rp = 0; A = B;
        bind(0, A);
        gl.uniform1f(uMa, MAT_ID[A]); gl.uniform1f(uMd, 0);
        since = performance.now();
        heroMat.busy = false;
        if (heroMat.done) heroMat.done();
      }
      heroMat.gl = function (from, to) {
        heroMat.busy = true;
        if (ready[to]) begin(from, to); else pend = [from, to];
      };
      /* die übrigen Materialien nacheinander nachladen, sobald die Seite steht */
      var base = img.currentSrc || img.src, rest = ['gold', 'fell', 'chrom'];
      function loadNext() {
        var name = rest.shift();
        if (!name) return;
        var im = new Image();
        im.onload = function () {
          try { upload(name, im); } catch (err) {}
          if (pend && pend[1] === name) { var pp = pend; pend = null; if (ready[name]) begin(pp[0], pp[1]); else { heroMat.busy = false; heroMat.queued = false; } }
          loadNext();
        };
        im.onerror = function () {
          if (pend && pend[1] === name) { pend = null; heroMat.busy = false; heroMat.queued = false; }
          loadNext();
        };
        var src = base.replace('moos-tilde', name + '-tilde');
        /* Chrom hat harte Kanten: auf großen Bildschirmen immer das große Bild, sonst wirkt es weich */
        if (name === 'chrom' && img.clientWidth * (window.devicePixelRatio || 1) > 560) src = src.replace('-tilde-800', '-tilde');
        if (name === 'chrom') {
          var nmImg = new Image();
          nmImg.onload = function () { try { nmSet(nmImg); } catch (err) {} };
          nmImg.src = src.replace(/chrom-tilde(-800)?/, 'chrom-normal');
        }
        im.src = src;
      }
      loadNext();
      function size() {
        var d = Math.min(window.devicePixelRatio || 1, 1.5);
        var w = Math.max(1, Math.round(img.clientWidth * d)), h = Math.max(1, Math.round(img.clientHeight * d));
        if (c.width !== w || c.height !== h) { c.width = w; c.height = h; gl.viewport(0, 0, w, h); }
      }
      img.parentNode.appendChild(c);
      size();
      var on = false, raf = 0, skip = false, live = false, t0 = performance.now();
      function frame(now) {
        raf = 0;
        if (!on || document.hidden) { lastNow = 0; return; }
        raf = requestAnimationFrame(frame);
        var dt = lastNow ? Math.min(100, now - lastNow) : 0;
        lastNow = now;
        if (running) rp = Math.min(1, rp + dt / dur * (heroMat.fast ? 3.5 : 1));
        if (!finePointer) { skip = !skip; if (skip) return; }
        gl.uniform1f(uT, (now - t0) / 1000);
        var uNow = 0;
        if (running) {
          if (rp >= 1) finish(); else uNow = 0.5 - 0.5 * Math.cos(Math.PI * rp);
        }
        gl.uniform1f(uU, uNow);
        gl.uniform1f(uGt, (now - since) / 1000);
        if (A === 'chrom' || (running && B === 'chrom')) {
          var tx_, ty_, sec = now / 1000;
          if (now - mAt < 5000) {
            if (!cRect) cRect = img.getBoundingClientRect();
            tx_ = Math.max(-0.8, Math.min(1.8, (mX - cRect.left) / (cRect.width || 1)));
            ty_ = Math.max(-0.8, Math.min(1.8, 1 - (mY - cRect.top) / (cRect.height || 1)));
          } else {
            tx_ = 0.5 + 0.4 * Math.sin(sec * 0.33); ty_ = 0.6 + 0.22 * Math.sin(sec * 0.21 + 1.2);
          }
          var lk = Math.min(1, dt / 1000 * (now - mAt < 5000 ? 9 : 1.5));
          lx += (tx_ - lx) * lk; ly += (ty_ - ly) * lk; la += (1 - la) * Math.min(1, dt / 1000 * 2.5);
          gl.uniform3f(uLp, lx, ly, la);
        } else if (la) { la = 0; gl.uniform3f(uLp, lx, ly, 0); }
        /* Gold-Ballon: schwebt ruhig und lässt sich mit der Maus anstupsen. Er weicht aus, federt zurück und bekommt
           an der berührten Stelle eine Delle. Alle Ausschläge sind fest begrenzt, damit er in seinem Rahmen bleibt. */
        var goldIdle = A === 'gold' && !running, ds = Math.min(0.05, dt / 1000);
        gG += ((goldIdle ? 1 : 0) - gG) * Math.min(1, ds * (goldIdle ? 1.2 : 5));
        if (gG > 0.002 || Math.abs(nX) + Math.abs(nY) + Math.abs(nR) * 0.01 > 0.0004 || dZ > 0.002) {
          var fX = 0, fY = 0, tq = 0, dzT = 0, dpx = 0.5, dpy = 0.5, aw = img.clientWidth || 1, ah = img.clientHeight || 1;
          if (goldIdle && finePointer && mAt > 0) {
            if (!cRect) cRect = img.getBoundingClientRect();
            var qx = (mX - cRect.left) / (cRect.width || 1) - 0.5, qy = ((mY - cRect.top) / (cRect.height || 1) - 0.5) * ah / aw;
            var ee = Math.sqrt(qx * qx / 0.3136 + qy * qy / 0.1296);       /* 1 = Rand des Bereichs, in dem der Ballon die Maus spürt */
            if (ee < 1) {
              var ql = Math.sqrt(qx * qx + qy * qy) + 0.0001, mag = 1.06 * Math.sin(Math.PI * ee);
              fX = -qx / ql * mag; fY = -qy / ql * mag; tq = (qx * fY - qy * fX) * 260;
              dzT = Math.min(1, (1 - ee) / 0.45);
            }
            dpx = qx + 0.5 - bX; dpy = 1 - ((qy - bY) * aw / ah + 0.5);
          }
          vX += (fX - 38 * nX - 4.2 * vX) * ds; nX += vX * ds;
          vY += (fY - 38 * nY - 4.2 * vY) * ds; nY += vY * ds;
          vR += (tq - 30 * nR - 3.6 * vR) * ds; nR += vR * ds;
          dZ += (dzT - dZ) * Math.min(1, ds * 9);
          var fs = now / 1000;
          bX = Math.max(-0.03, Math.min(0.03, Math.sin(fs * 0.21 + 2.1) * 0.005 * gG + nX));
          bY = Math.max(-0.028, Math.min(0.028, (Math.sin(fs * 0.62) * 0.013 + Math.sin(fs * 0.27 + 1.3) * 0.006) * gG + nY));
          /* nie näher als 10 px an Überschrift, Text und Knöpfe */
          if (!goldLim) goldLimits();
          var ox = bX * aw, oy = bY * aw, gi, gp, go;
          for (gp = 0; gp < 2; gp++) for (gi = 0; gi < goldLim.length; gi++) {
            go = ox * goldLim[gi][0] + oy * goldLim[gi][1] - goldLim[gi][2];
            if (go > 0) { ox -= go * goldLim[gi][0]; oy -= go * goldLim[gi][1]; }
          }
          bX = ox / aw; bY = oy / aw;
          var bR = Math.max(-0.9, Math.min(0.9, Math.sin(fs * 0.38 + 0.4) * 0.5 * gG + nR)), lift = -bY / 0.028;
          c.style.transform = 'translate3d(' + (bX * aw).toFixed(2) + 'px,' + (bY * aw).toFixed(2) + 'px,0) rotate(' + bR.toFixed(3) + 'deg)';
          if (shEl) {
            /* steigt der Ballon, wird sein Schatten kleiner und blasser */
            shEl.style.transform = 'translate3d(' + (bX * aw * 0.7).toFixed(2) + 'px,' + (bY * aw * 0.3).toFixed(2) + 'px,0) scale(' + (1.04 * (1 - 0.022 * lift)).toFixed(4) + ')';
            shEl.style.opacity = (0.85 * (1 - 0.1 * lift)).toFixed(3);
          }
          gl.uniform3f(uDp, dpx, dpy, dZ * gG);
          gMoved = true;
        } else if (gMoved) {
          gMoved = false; nX = nY = nR = vX = vY = vR = bX = bY = dZ = 0;
          c.style.transform = ''; if (shEl) { shEl.style.transform = ''; shEl.style.opacity = ''; }
          gl.uniform3f(uDp, 0.5, 0.5, 0);
        }
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        if (!live) { live = true; img.classList.add('is-live'); if (altEl) altEl.classList.add('is-live'); }
      }
      function kick() { if (on && !raf) raf = requestAnimationFrame(frame); }
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (es) { on = es[0].isIntersecting; if (!on && running) { finish(); } kick(); }).observe(heroSec);
      } else { on = true; kick(); }
      window.addEventListener('resize', size, { passive: true });
      document.addEventListener('visibilitychange', kick);
      c.addEventListener('webglcontextlost', function (e) { e.preventDefault(); on = false; c.style.display = 'none'; img.classList.remove('is-live'); if (altEl) altEl.classList.remove('is-live'); heroMat.gl = null; heroMat.busy = false; heroMat.queued = false; });
    }
    if (img.complete && img.naturalWidth) start(); else img.addEventListener('load', start, { once: true });
  })();

  /* ---------- Buttons: sichtbarer Druck auch bei Touch und Tastatur ---------- */
  var PRESS = '.btn,.header__cta,.nav__link,.round,.card,.faq__q,.burger,.tag,.chip';
  var pressed = null, pressedAt = 0;
  function press(el) {
    if (!el) return;
    if (pressed && pressed !== el) pressed.classList.remove('is-pressed');
    pressed = el; pressedAt = Date.now();
    el.classList.add('is-pressed');
  }
  function release() {
    if (!pressed) return;
    var el = pressed, wait = Math.max(0, 140 - (Date.now() - pressedAt));
    pressed = null;
    setTimeout(function () { el.classList.remove('is-pressed'); }, wait);
  }
  document.addEventListener('pointerdown', function (e) {
    if (e.button && e.button !== 0) return;
    press(e.target.closest(PRESS));
  }, { passive: true });
  ['pointerup', 'pointercancel', 'dragstart', 'blur'].forEach(function (ev) {
    window.addEventListener(ev, release, { passive: true });
  });
  document.addEventListener('pointerleave', release, { passive: true });
  document.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) press(document.activeElement && document.activeElement.closest(PRESS));
  });
  document.addEventListener('keyup', function (e) {
    if (e.key === 'Enter' || e.key === ' ') release();
  });

  /* ---------- FAQ ---------- */
  $$('.faq__q').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item = btn.closest('.faq__item');
      var open = btn.getAttribute('aria-expanded') === 'true';
      $$('.faq__item.is-open').forEach(function (other) {
        if (other === item) return;
        other.classList.remove('is-open');
        $('.faq__q', other).setAttribute('aria-expanded', 'false');
      });
      item.classList.toggle('is-open', !open);
      btn.setAttribute('aria-expanded', String(!open));
    });
  });

  /* ---------- Mobiles Menü ---------- */
  var burger = $('.burger');
  var nav = $('#nav');
  function closeNav() {
    nav.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Menü öffnen');
  }
  if (burger && nav) {
    burger.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
    });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) closeNav(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeNav(); });
    document.addEventListener('click', function (e) {
      if (!nav.classList.contains('is-open')) return;
      if (!e.target.closest('.header__bar')) closeNav();
    });
  }
})();
