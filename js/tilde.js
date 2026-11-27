/* Haltung: Der Bereich rastet ein, Text und Glaskugel laufen mit dem Scrollweg, danach geht es weiter.
   Alles Bewegte läuft nur über transform/opacity; Positionen werden einmal gemessen, nicht pro Bild. */
(function () {
  'use strict';
  var sec = document.getElementById('haltung');
  var fig = document.getElementById('wave-fig');
  if (!sec || !fig) return;
  var path = fig.querySelector('#wave-path'), orb = fig.querySelector('#orb'), floor = fig.querySelector('#orb-floor');
  var pin = sec.querySelector('.haltung__pin'), stage = sec.querySelector('.haltung__stage');
  if (!path || !orb || !path.getTotalLength) return;
  var dots = orb.querySelectorAll('#orb-in circle');
  var R = 43, N = 360, LEN = path.getTotalLength();

  /* Bahn einmal abtasten: Punkt und Richtung je Stützstelle */
  var PX = new Float32Array(N + 1), PY = new Float32Array(N + 1);
  (function () { for (var i = 0; i <= N; i++) { var q = path.getPointAtLength(LEN * i / N); PX[i] = q.x; PY[i] = q.y; } })();

  /* Einschlüsse im Glas: Punkte auf der Kugel, die beim Rollen mitwandern */
  var P = [[0.55, 0.2, 0.81], [-0.6, 0.45, 0.66], [0.1, -0.75, 0.65], [-0.35, -0.3, -0.89], [0.7, -0.5, -0.5]];
  var SZ = [3.6, 2.2, 2.8, 4, 1.8];
  function roll(ax, ay, ang) {
    var c = Math.cos(ang), s = Math.sin(ang), i, p, d, x, y, z;
    for (i = 0; i < P.length; i++) {
      p = P[i]; d = ax * p[0] + ay * p[1];
      x = p[0] * c + (ay * p[2]) * s + ax * d * (1 - c);
      y = p[1] * c + (-ax * p[2]) * s + ay * d * (1 - c);
      z = p[2] * c + (ax * p[1] - ay * p[0]) * s;
      p[0] = x; p[1] = y; p[2] = z;
    }
  }
  var s0 = 0;
  function place(t) {
    var f = t * N, i = Math.min(N - 1, Math.floor(f)), u = f - i;
    var x = PX[i] + (PX[i + 1] - PX[i]) * u, y = PY[i] + (PY[i + 1] - PY[i]) * u;
    var s = t * LEN, ds = s - s0;
    if (ds) {
      var tx = PX[i + 1] - PX[i], ty = PY[i + 1] - PY[i], l = Math.sqrt(tx * tx + ty * ty) || 1;
      roll(-ty / l, tx / l, ds / R);        /* Rollen ohne Rutschen: Winkel = Weg / Radius */
      s0 = s;
      for (var k = 0; k < dots.length && k < P.length; k++) {
        var p = P[k], front = p[2] > 0;
        dots[k].setAttribute('cx', (p[0] * R * 0.8).toFixed(1));
        dots[k].setAttribute('cy', (p[1] * R * 0.8).toFixed(1));
        dots[k].setAttribute('opacity', (front ? 0.14 + 0.2 * p[2] : 0.06 + 0.05 * (1 + p[2])).toFixed(2));
      }
    }
    /* 640 Einheiten = 100cqw der Grafik */
    var tr = 'translate3d(' + (x / 6.4).toFixed(3) + 'cqw,' + (y / 6.4).toFixed(3) + 'cqw,0)';
    orb.style.transform = tr;
    if (floor) floor.style.transform = tr;
  }
  for (var k0 = 0; k0 < dots.length && k0 < SZ.length; k0++) dots[k0].setAttribute('r', SZ[k0]);

  /* ---- Maße: einmal und bei Größenänderung ---- */
  var G = { on: false, start: 0, run: 1, fit: 1, figTop: 0, figH: 1 };
  function measure() {
    var y = window.scrollY, vh = window.innerHeight;
    G.on = false;
    var fr = fig.getBoundingClientRect(); G.figTop = fr.top + y; G.figH = fr.height || 1;
    if (!pin || getComputedStyle(pin).position !== 'sticky') return;
    G.run = parseFloat(getComputedStyle(sec, '::after').height) || 0;
    G.start = sec.getBoundingClientRect().top + y;       /* Scrollstand, an dem der Bereich einrastet */
    /* niedrige Fenster: Inhalt so weit verkleinern, dass er unter dem Menü ganz ins Bild passt */
    G.fit = stage ? Math.min(1, (vh - 200) / (stage.offsetHeight * 1.07)) : 1;
    G.on = G.run > 50;
  }
  function pinP() {                /* 0 beim Einrasten, 1 beim Loslassen */
    if (!G.on) return -1;
    var p = (window.scrollY - G.start) / G.run;
    return p < 0 ? 0 : p > 1 ? 1 : p;
  }
  function seg(p, a, b) { var t = (p - a) / (b - a); return t < 0 ? 0 : t > 1 ? 1 : t; }
  function ease(t) { return t * t * (3 - 2 * t); }
  /* Ablauf im Stand: heranzoomen (0–8 %), Text (6–78 %), Kugel (6–82 %), Ruhe, herauszoomen (92–100 %) */
  window.__haltPin = function () { var p = pinP(); return p < 0 ? -1 : seg(p, 0.06, 0.78); };
  /* Für das weiche Scrollen: Strecke, in der nicht hindurchgerast werden kann */
  window.__scrollGate = function () { return G.on ? [G.start, G.start + G.run * 0.9] : null; };

  var cur = -1, zCur = -1, raf = 0, visible = false;
  function goal() {
    var p = pinP();
    if (p >= 0) return seg(p, 0.06, 0.82);
    var t = (window.scrollY + window.innerHeight * 0.86 - (G.figTop + G.figH / 2)) / (window.innerHeight * 0.62);
    return t < 0 ? 0 : t > 1 ? 1 : t;
  }
  function zoomGoal() {
    var p = pinP(); if (p < 0) return 1;
    return G.fit * (1 + 0.07 * ease(seg(p, 0, 0.08)) * (1 - ease(seg(p, 0.92, 1))));
  }
  function tick() {
    raf = 0;
    var tg = goal(), zg = zoomGoal();
    if (cur < 0) { cur = tg; zCur = zg; }
    var d = tg - cur; cur = Math.abs(d) < 0.0008 ? tg : cur + d * 0.24;      /* nur ein Hauch Trägheit */
    var zd = zg - zCur; zCur = Math.abs(zd) < 0.0005 ? zg : zCur + zd * 0.18;
    place(cur);
    if (stage) stage.style.transform = G.on ? 'scale(' + zCur.toFixed(4) + ')' : '';
    if ((cur !== tg || zCur !== zg) && visible) raf = requestAnimationFrame(tick);
  }
  function kick() { if (!raf && visible) raf = requestAnimationFrame(tick); }
  function remeasure() { measure(); cur = -1; kick(); }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (e) { visible = e[0].isIntersecting; kick(); }, { rootMargin: '25% 0px' }).observe(sec);
  } else { visible = true; }
  window.addEventListener('scroll', kick, { passive: true });
  var rt = 0;
  function later() { clearTimeout(rt); rt = setTimeout(remeasure, 120); }
  window.addEventListener('resize', later);
  window.addEventListener('load', remeasure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(later);
  if ('ResizeObserver' in window) new ResizeObserver(later).observe(document.body);
  measure(); place(0); kick();
})();
