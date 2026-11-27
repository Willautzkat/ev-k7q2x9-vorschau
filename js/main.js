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
  function windFrame(t) {
    windRaf = 0;
    /* 30 Bilder pro Sekunde reichen für die langsamen Teilchen */
    if (t - windAcc < 30) { windRaf = requestAnimationFrame(windFrame); return; }
    windAcc = t;
    var dt = Math.min(0.08, (t - windLast) / 1000 || 0.033);
    windLast = t;
    var gust = 1 + 0.45 * Math.sin(t * 0.00023) + 0.2 * Math.sin(t * 0.0011);
    var any = false, accent = doc.classList.contains('is-gold') ? '#D6A23A' : '#ACBE1D';
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

  /* ---------- Hero: Ein Klick auf die Tilde legt das Gold frei, die Akzentfarbe der Seite wechselt mit ---------- */
  var heroGold = { on: false, gl: null };
  (function () {
    var art = $('#hero-art');
    if (!art || !$('.hero__gold')) return;
    art.removeAttribute('aria-hidden');
    art.setAttribute('role', 'button');
    art.setAttribute('tabindex', '0');
    art.setAttribute('aria-pressed', 'false');
    art.setAttribute('aria-label', 'Zwischen Moos und Gold wechseln');
    function toggle() {
      heroGold.on = !heroGold.on;
      if (heroGold.gl) heroGold.gl(heroGold.on);
      doc.classList.toggle('is-gold', heroGold.on);
      art.setAttribute('aria-pressed', heroGold.on ? 'true' : 'false');
    }
    art.addEventListener('click', toggle);
    art.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
  })();

  /* ---------- Hero: Wind zieht in Wellen durch das Moos ----------
     Der Schatten ist ein eigenes, festes Bild. Das Moos selbst rechnet eine kleine Grafikkarten-Routine neu:
     Jedes Büschel neigt sich und zittert für sich, auch am Rand. Ohne WebGL bleibt das Standbild stehen. */
  (function () {
    var img = $('.hero__moss'), heroSec = $('#top'), goldEl = $('.hero__gold');
    if (!img || !heroSec || reduce) return;
    function start() {
      var c = document.createElement('canvas');
      c.className = 'hero__moss-gl';
      c.setAttribute('aria-hidden', 'true');
      var gl = c.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false });
      if (!gl) return;
      var VS = 'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
      var FS = [
        'precision highp float;varying vec2 v;uniform sampler2D s;uniform sampler2D g;uniform float t;uniform float u;uniform float gt;',
        'const vec2 R=vec2(1185.,670.);const float T=6.2831853;',
        'float A(vec2 o){return texture2D(s,v+o/R).a;}',
        'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
        /* ein weicher Zufallswert je Büschel */
        'float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}',
        /* Landkarte, wo das Moos zuerst aufreißt und wo es am längsten bleibt */
        'float Hf(vec2 p){return clamp((.6*n(p/92.)+.4*n(p/37.+7.)-.14)/.72,0.,1.);}',
        'void main(){',
        ' vec2 q=v*R;q.y=R.y-q.y;float x01=q.x/R.x;',
        ' float e=min(min(A(vec2(14.,0.)),A(vec2(-14.,0.))),min(A(vec2(0.,14.)),A(vec2(0.,-14.))));',
        ' float w=mix(.5,1.,e);',
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
        ' vec2 d=vec2(6.2*lean+(1.5*fl+.8*fl2)*k,-1.9*lean+.75*fl*k*(r1-.5)*2.)*w;',
        /* Freilegen: Das Moos reißt an vielen Stellen auf und zieht sich ungleichmäßig zu Inseln zusammen,
           bis nichts mehr übrig ist. Das Gold darunter drückt sich dabei heraus. */
        ' float H=Hf(q);',
        ' float xu=2.*u-1.;',
        ' float thr=mix(-.1,1.1,.5+.5*sign(xu)*pow(abs(xu),1.9));',   /* in der Mitte langsamer, damit die Fläche gleichmäßig schwindet */
        ' vec2 gr=vec2(Hf(q+vec2(6.,0.))-Hf(q-vec2(6.,0.)),Hf(q+vec2(0.,6.))-Hf(q-vec2(0.,6.)));',
        ' vec2 inw=gr/(length(gr)+.0008);',                         /* Richtung ins Innere der Moosinsel */
        ' float rim=1.-smoothstep(0.,.22,H-thr);',                  /* wie nah am Rand der Insel */
        ' float act=step(.001,u);',
        ' d-=inw*(rim*rim*(10.+26.*u))*act;',                       /* am Rand staucht sich das Moos nach innen */
        ' vec2 o=d/R;o.y=-o.y;',
        ' vec4 m=texture2D(s,v-o);',
        ' float am=m.a*mix(1.,smoothstep(thr-.012,thr+.03,H),act);',
        ' vec3 col=m.rgb*(1.+.1*(lean-.36)*w+.03*fl*w*gust);',
        ' col*=1.-.3*rim*rim*act*(1.-step(.999,u));',               /* der dicke Moosrand liegt im Schatten */
        /* Gold: startet etwas kleiner und dunkler, wölbt sich heraus und federt am Ende leicht nach */
        ' float c1=1.70158,c3=2.70158,ub=u-1.;',
        ' float back=1.+c3*ub*ub*ub+c1*ub*ub;',
        ' float sg=.925+.075*back;',
        ' vec2 gv=(v-.5)/sg+.5;',
        ' vec4 G=u>0.?texture2D(g,gv):vec4(0.);',
        ' float open=max(smoothstep(0.,.3,thr-H),smoothstep(.8,1.,u));',                     /* wie lange die Stelle schon frei liegt */
        ' float moving=act*(1.-step(.999,u));',
        ' float near=exp(-pow((thr-H)/.05,2.))*moving;',            /* direkt am Moosrand: Schlagschatten */
        ' float flash=exp(-pow((thr-H-.13)/.08,2.))*moving*.5;',       /* knapp dahinter blitzt es auf */
        ' float sweep=exp(-pow((x01*1.15+(q.y/R.y)*.4-fract(gt*.1)*2.4+.45)*6.5,2.))*.2*step(.999,u);',
        ' vec3 gc=G.rgb*(mix(.62,1.,open)*(1.-.38*near)+.5*flash+sweep)+vec3(1.,.93,.7)*(.2*flash+.1*sweep);',
        ' float ag=G.a*act;',
        ' gl_FragColor=vec4(col*am+gc*ag*(1.-am),am+ag*(1.-am));',
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
      var tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img); } catch (err) { return; }
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      var uT = gl.getUniformLocation(pr, 't'), uU = gl.getUniformLocation(pr, 'u'), uGt = gl.getUniformLocation(pr, 'gt');
      gl.uniform1i(gl.getUniformLocation(pr, 's'), 0);
      gl.uniform1i(gl.getUniformLocation(pr, 'g'), 1);
      /* Gold liegt als zweites Bild darunter */
      var goldReady = false, goldTex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, goldTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
      gl.activeTexture(gl.TEXTURE0);
      var goldImg = new Image();
      goldImg.onload = function () {
        try {
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, goldTex);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, goldImg);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.activeTexture(gl.TEXTURE0);
          goldReady = true;
          if (heroGold.on) heroGold.gl(true);
        } catch (err) {}
      };
      goldImg.src = (img.currentSrc || img.src).replace('moos-tilde', 'gold-tilde');
      var revealFrom = 0, revealTo = 0, revealStart = 0, revealNow = 0, goldSince = 0, REVEAL_MS = 4600;
      heroGold.gl = function (to) {
        if (!goldReady) return;
        revealFrom = revealNow; revealTo = to ? 1 : 0; revealStart = performance.now();
      };
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
        if (!on || document.hidden) return;
        raf = requestAnimationFrame(frame);
        if (!finePointer) { skip = !skip; if (skip) return; }
        gl.uniform1f(uT, (now - t0) / 1000);
        if (revealNow !== revealTo) {
          var rp = Math.min(1, (now - revealStart) / (REVEAL_MS * Math.abs(revealTo - revealFrom) || 1));
          var ez = 0.5 - 0.5 * Math.cos(Math.PI * rp);
          revealNow = revealFrom + (revealTo - revealFrom) * ez;
          if (rp >= 1) { revealNow = revealTo; goldSince = now; }
        }
        gl.uniform1f(uU, revealNow);
        gl.uniform1f(uGt, (now - goldSince) / 1000);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        if (!live) { live = true; img.classList.add('is-live'); if (goldEl) goldEl.classList.add('is-live'); }
      }
      function kick() { if (on && !raf) raf = requestAnimationFrame(frame); }
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (es) { on = es[0].isIntersecting; kick(); }).observe(heroSec);
      } else { on = true; kick(); }
      window.addEventListener('resize', size, { passive: true });
      document.addEventListener('visibilitychange', kick);
      c.addEventListener('webglcontextlost', function (e) { e.preventDefault(); on = false; c.style.display = 'none'; img.classList.remove('is-live'); if (goldEl) goldEl.classList.remove('is-live'); heroGold.gl = null; });
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
