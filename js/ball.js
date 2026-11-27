/* Spielraum: Glaskugel auf einer Fläche, die mit dem Material der Tilde wechselt
   (Rasen bei Moos, Fellteppich, Goldkissen, flüssiges Chrom).
   Die Kugel ist aus Glas in der Akzentfarbe der Seite: Man sieht die Fläche gebrochen durch sie hindurch,
   oben links sitzt das Glanzlicht, und im Schatten liegt der helle Lichtfleck, den das Glas bündelt.
   Jede Fläche hat ihr eigenes Verhalten (SURF): wie hoch die Kugel springt, wie weit sie rollt, wie sie aufliegt,
   wie ihr Schatten fällt, ob sie sich spiegelt und ob die Fläche beim Aufprall nachgibt.
   Der Ball lebt in Bodenkoordinaten (x nach rechts 0..1, y nach hinten 0..ASP, z nach oben).
   Die Abbildung Boden -> Bild (H) ist aus den vier Ecken der Rasenfläche im Foto berechnet,
   deshalb wird der Ball hinten kleiner und bleibt genau auf der Fläche. Alle Flächenbilder sind auf dieselben Ecken eingepasst. */
(function () {
  'use strict';
  var sec = document.getElementById('spielraum');
  var media = document.getElementById('play-media');
  if (!sec || !media) return;

  var cv = document.createElement('canvas');
  cv.className = 'play__ball';
  var gl = cv.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false }) ||
           cv.getContext('experimental-webgl', { alpha: true, premultipliedAlpha: true, antialias: false });
  if (!gl) return;
  media.appendChild(cv);

  /* ---- Geometrie des Fotos ---- */
  var ASP = 1.15;                 /* Tiefe des Rasens im Verhältnis zur Breite */
  var IMG_AR = 1000 / 910;        /* Seitenverhältnis des Fotos */
  var TOP = 0.22;                 /* Canvas ragt oben über das Foto hinaus (für hohe Bälle) */
  var H  = [0.8543213, 0.08666272, 0.072, -0.01256334, -0.6526175, 0.8813187, -0.001808887, 0.2200072, 1];
  var HI = [1.521259, 0.1272736, -0.2216992, -0.01971248, -1.535523, 1.354705, 0.007088671, 0.3380563, 1];
  var CAM_UP = 0.6;               /* Kamera schaut ca. 53° von oben: 1 Einheit Höhe = 0.6 Bildhöhe */

  /* ---- Ball ---- */
  var R = 0.088;                  /* Radius in Rasenbreiten */
  var G = 7.5;                    /* Schwerkraft */
  var ZMAX = 0.42;                /* größte Flughöhe */
  /* ---- Die Flächen ----
     Verhalten: rest = wie viel Sprunghöhe beim Aufprall bleibt, thr = ab welcher Fallgeschwindigkeit sie noch einmal springt,
     bfr = wie viel Tempo sie beim Aufprall behält, r0/r1 = Rollwiderstand, wall = Abprall am Rand, kz/kxy = Schuss nach oben / zur Seite,
     edge = Abstand zur Kante, jit = Büschel lenken die Kugel leicht ab, rip = Fläche gibt nach (1 Kissen federt, 2 Flüssigkeit schlägt Wellen).
     Aussehen: glass = Glasfarbe, gnd = Farbe, die von unten ins Glas scheint, sh = [Schatten, Weichheit, Kontaktschatten, Lichtfleck],
     refl = Spiegelbild der Kugel, tuft = [wie tief sie einsinkt, Länge der Fasern davor, Weichheit, Breite der Büschel] */
  var SURF = {
    moos:  { rest: 0.46, thr: 0.55, bfr: 0.86, r0: 0.7,  r1: 0.9,  wall: 0.74, kz: 1,    kxy: 1,    edge: 0.025, jit: 0,   rip: 0,
             glass: [0.62, 0.80, 0.10], gnd: [0.07, 0.12, 0.03], sh: [1, 0, 0.58, 0.9],      refl: 0,    tuft: [-0.89, 0.2, 0.05, 0.075] },
    fell:  { rest: 0.2,  thr: 0.75, bfr: 0.68, r0: 1.5,  r1: 1.7,  wall: 0.45, kz: 0.88, kxy: 0.92, edge: 0.05,  jit: 2.2, rip: 0,
             glass: [0.36, 0.66, 0.96], gnd: [0.10, 0.17, 0.27], sh: [0.85, 0.3, 0.5, 0.55], refl: 0,    tuft: [-0.68, 0.36, 0.12, 0.15] },
    gold:  { rest: 0.8,  thr: 0.28, bfr: 0.97, r0: 0.4,  r1: 0.35, wall: 0.85, kz: 1.3,  kxy: 1,    edge: 0.10,  jit: 0,   rip: 1,
             glass: [0.92, 0.64, 0.16], gnd: [0.33, 0.22, 0.05], sh: [0.8, 0.08, 0.66, 1.1], refl: 0.14, tuft: [-3, 0, 0.05, 0.075] },
    chrom: { rest: 0.34, thr: 0.5,  bfr: 0.93, r0: 0.16, r1: 0.22, wall: 0.8,  kz: 0.95, kxy: 1.05, edge: 0.06,  jit: 0,   rip: 2,
             glass: [0.80, 0.84, 0.90], gnd: [0.26, 0.27, 0.30], sh: [0.38, 0, 0.3, 1.3],    refl: 0.5,  tuft: [-3, 0, 0.05, 0.075] }
  };
  /* Wellen: [Tempo, Breite, Dichte, Glanz, Ausschlag, Lebensdauer] für Kissen (1) und Flüssigkeit (2) */
  var RIP = { 1: [0.34, 0.13, 24, 5, 0.010, 1.0], 2: [0.5, 0.08, 62, 14, 0.022, 1.7] };
  function matNow() { var m = document.documentElement.getAttribute('data-mat'); return SURF[m] ? m : 'moos'; }
  var P = SURF.moos, edge = P.edge;
  var X0, X1, Y0, Y1;
  function bounds() { X0 = R + edge; X1 = 1 - R - edge; Y0 = R + edge + 0.02; Y1 = ASP - R - edge - 0.05; }
  bounds();
  var b = { x: 0.63, y: 0.36, z: 0, vx: 0, vy: 0, vz: 0, wx: 0, wy: 0, wz: 0, q: [0.966, 0.15, -0.2, 0.06] };
  (function () { var q = b.q, l = Math.sqrt(q[0]*q[0]+q[1]*q[1]+q[2]*q[2]+q[3]*q[3]); for (var i = 0; i < 4; i++) q[i] /= l; })();

  function ground(x, y) {          /* Boden -> Bild (0..1) */
    var w = H[6] * x + H[7] * y + 1;
    return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w];
  }
  /* Die Tiefe wird etwas betont, damit man klar sieht, dass der Ball nach hinten rollt */
  function depthK(y) { return 1.14 - 0.30 * (y / ASP); }
  function scaleAt(y) {            /* Bildbreite einer Rasenbreite in dieser Tiefe (0..1) */
    return ground(1, y)[0] - ground(0, y)[0];
  }
  /* Bildschirmlage des Balls: Mittelpunkt (Bild 0..1, bezogen auf Bildbreite) und Radius */
  function screenBall() {
    var p = ground(b.x, b.y), s = scaleAt(b.y);
    var k = depthK(b.y), r = R * s * k;                /* in Bildbreiten */
    return { x: p[0], y: p[1] - (r + b.z * s * k) * CAM_UP * IMG_AR, r: r, s: s, k: k };
  }

  /* ---- Shader ---- */
  var VS = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  var FS = [
    'precision highp float;',
    'uniform vec2 uRes;uniform vec4 uImg;',          /* uImg: x0,y0,w,h des Fotos in Canvas-Pixeln */
    'uniform vec3 uBall;',                            /* Mittelpunkt (px) und Radius (px) */
    'uniform mat3 uHI;uniform mat3 uH;uniform sampler2D uTex;uniform sampler2D uTex2;uniform float uTm;uniform float uTexOk;uniform vec3 uCol;',
    'uniform vec3 uGnd;uniform vec4 uSh;uniform vec4 uTuft;uniform float uRefl;uniform float uMir;uniform vec4 uRip[4];uniform vec4 uRipP;',
    'uniform vec3 uPos;uniform float uR;uniform float uAsp;uniform float uSink;',
    'const vec3 L=vec3(-0.385,-0.128,0.914);',        /* Licht von links oben, leicht von vorn */
    'const vec3 CR=vec3(1.,0.,0.);const vec3 CU=vec3(0.,0.8,0.6);const vec3 CF=vec3(0.,-0.6,0.8);',
    'float h1(float n){return fract(sin(n*127.1)*43758.5453);}',
    /* Das Bild der Fläche; beim Wechsel blendet es zum nächsten über */
    'vec3 photo(vec2 iu){vec3 a=texture2D(uTex,iu).rgb;return uTm>0.?mix(a,texture2D(uTex2,iu).rgb,uTm):a;}',
    /* Umgebung, die sich im Glas spiegelt: unten die Fläche, oben ein ruhiger Himmel, links oben die Lichtquelle */
    'vec3 env(vec3 d){',
    '  vec3 c=mix(uGnd,vec3(0.33,0.37,0.43),smoothstep(-0.15,0.5,d.z));',
    '  float l=max(dot(d,L),0.);',
    '  return c+vec3(1.,0.98,0.94)*(pow(l,90.)*2.2+pow(l,6.)*0.2);',
    '}',
    /* Was die Kugel mit der Fläche macht. a: Schatten, rgb: Licht, das das Glas zu einem hellen Fleck bündelt.
       uSh: Stärke des Schattens, zusätzliche Weichheit, Kontaktschatten, Lichtfleck */
    'vec4 lawnFx(vec2 g){',
    '  float hgt=uPos.z+uR;',
    '  vec2 ld=normalize(L.xy);',
    '  vec2 sc=uPos.xy-L.xy/L.z*hgt;',
    '  vec2 dv=g-sc;float al=dot(dv,ld);vec2 pe=dv-ld*al;',
    '  float dd=length(vec2(al*L.z,length(pe)))/uR;',
    '  float blur=0.2+uSh.y+uPos.z*1.1;',
    '  float sh=(1.-smoothstep(1.-blur,1.+blur,dd))*0.56*uSh.x/(1.+uPos.z*1.5);',
    '  float cd=length(g-uPos.xy)/uR;',
    '  sh=max(sh,(1.-smoothstep(0.2,1.15+uSh.y,cd))*uSh.z*uSink);',
    '  vec2 cv=g-(sc-ld*uR*0.3);float ca=dot(cv,ld);',
    '  float cq=length(vec2(ca*L.z,length(cv-ld*ca)))/uR;',
    '  float cs=exp(-cq*cq/(0.1+uSh.y*0.4+uPos.z*1.4))*uSh.w/(1.+uPos.z*7.);',
    '  return vec4(mix(vec3(1.),uCol,0.6)*cs,sh*(1.-0.5*cs));',
    '}',
    /* Wellen: Wo die Kugel aufkommt, gibt die Fläche nach. Ringe laufen nach außen und verziehen das Bild der Fläche.
       xy: Verschiebung in Bodenkoordinaten, z: ihre Stärke */
    'vec3 ripple(vec2 g){',
    '  vec2 dsp=vec2(0.);',
    '  for(int i=0;i<4;i++){vec4 r=uRip[i];if(r.w>0.){',
    '    vec2 dv=g-r.xy;float d=length(dv);float fr=r.z*uRipP.x;float q=(d-fr)/uRipP.y;',
    '    dsp+=dv/(d+0.001)*exp(-q*q)*r.w*sin((d-fr)*uRipP.z);}}',
    '  return vec3(dsp,length(dsp));',
    '}',
    /* Blick aus der Kugel heraus: trifft der Strahl den Rasen, zeigt er das Foto an dieser Stelle */
    'vec3 lawn(vec3 P,vec3 d){',
    '  if(d.z>-0.02)return env(d);',
    '  vec2 g=P.xy+d.xy*(-P.z/d.z);',
    '  vec3 ip=uH*vec3(g,1.);vec2 iu=ip.xy/ip.z;',
    '  float ins=step(0.,ip.z)*smoothstep(-0.01,0.01,iu.x)*smoothstep(1.01,0.99,iu.x)*smoothstep(-0.01,0.01,iu.y)*smoothstep(1.01,0.99,iu.y);',
    '  vec3 c=uTexOk>0.5?photo(clamp(iu,0.,1.)):uGnd*2.2;',
    '  vec4 fx=lawnFx(g);',
    '  c=c*(1.-fx.a)+fx.rgb;',
    '  return mix(vec3(0.05,0.06,0.05),c,ins);',
    '}',
    'vec3 shade(vec2 uv,out float cov){',
    '  float r2=dot(uv,uv);cov=1.-smoothstep(1.-2.4/uBall.z,1.,sqrt(r2));',
    '  if(r2>1.)return vec3(0.);',
    '  float w=sqrt(1.-r2);',
    '  vec3 n=uv.x*CR+uv.y*CU+w*CF;',
    '  vec3 I=-CF;',
    /* Der Sehstrahl wird beim Eintritt gebrochen, läuft durch das Glas und tritt hinten wieder aus */
    '  vec3 t1=refract(I,n,1./1.5);',
    '  float len=-2.*dot(t1,n);',
    '  vec3 p2=n+t1*len;',
    '  vec3 t2=refract(t1,-p2,1.5);if(dot(t2,t2)<0.5)t2=reflect(t1,-p2);',
    '  vec3 tr=lawn(vec3(uPos.xy,uPos.z+uR)+uR*p2,t2);',
    '  tr*=pow(uCol,vec3(0.3+0.8*len));',                               /* je länger der Weg im Glas, desto satter die Farbe */
    /* Licht, das von links oben durch die Kugel fällt, sammelt sich auf der abgewandten Innenseite */
    '  tr+=uCol*(pow(max(dot(p2,-L),0.),5.)*0.8+0.07);',
    '  float F=0.04+0.96*pow(1.-w,5.);',
    '  vec3 col=mix(tr,env(reflect(I,n)),F);',
    '  vec3 hv=normalize(L+CF);col+=vec3(1.)*pow(max(dot(n,hv),0.),240.)*1.3;',   /* Glanzlicht */
    /* unten sitzt die Kugel im Rasen: leichter Kontaktschatten */
    '  col*=mix(1.,smoothstep(-1.,-0.15,n.z)*0.5+0.5,uSink);',
    '  return col;',
    '}',
    'void main(){',
    '  vec2 fc=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y);',
    '  vec3 outc=vec3(0.);float outa=0.;',
    /* Schatten auf dem Rasen */
    '  vec2 ip=(fc-uImg.xy)/uImg.zw;',
    '  vec3 gp=uHI*vec3(ip,1.);vec2 g=gp.xy/gp.z;',
    '  float inl=smoothstep(-0.01,0.02,g.x)*smoothstep(1.01,0.98,g.x)*smoothstep(-0.02,0.015,g.y)*smoothstep(uAsp+0.01,uAsp-0.02,g.y);',
    '  inl*=step(0.,gp.z);',
    /* 1. Wellen in der Fläche: das verzogene Bild liegt über dem Foto */
    '  vec3 rp=ripple(g);',
    '  if(rp.z>0.00005&&uTexOk>0.5){',
    '    float ra=clamp(rp.z/0.003,0.,1.)*inl;',
    '    vec3 ir=uH*vec3(g+rp.xy,1.);',
    '    vec3 rc=photo(clamp(ir.xy/ir.z,0.,1.));',
    '    rc+=vec3(clamp(dot(rp.xy,-normalize(L.xy))*uRipP.w,-0.2,0.3));',   /* die dem Licht zugewandte Flanke glänzt */
    '    outc=rc*ra;outa=ra;',
    '  }',
    /* 2. Spiegelbild der Kugel auf glatten Flächen: liegt unter dem Auflagepunkt, verblasst mit der Flughöhe */
    '  if(uRefl>0.001){',
    '    vec2 dm=(fc-vec2(uBall.x,uMir))/uBall.z;',
    '    dm.x+=0.05*sin(dm.y*7.+g.x*38.)+rp.x*30.;dm.y+=rp.y*30.;',
    '    if(dot(dm,dm)<1.){',
    '      float mc;vec3 mcol=shade(dm,mc);',
    '      float ma=uRefl*mc*inl/(1.+uPos.z*5.);',
    '      outc=mcol*ma+outc*(1.-ma);outa=ma+outa*(1.-ma);',
    '    }',
    '  }',
    /* 3. Schatten und Lichtfleck */
    '  vec4 fx=lawnFx(g)*inl;',
    '  outc=outc*(1.-fx.a)+fx.rgb;outa=fx.a+outa*(1.-fx.a);',
    /* Ball */
    '  vec2 d=(fc-uBall.xy)/uBall.z;d.y=-d.y;',
    '  if(dot(d,d)<1.08){',
    '    vec3 acc=vec3(0.);float ca=0.;float c;',
    '    float o=0.3/uBall.z;',
    '    acc+=shade(d+vec2(o,o*0.4),c);ca+=c;acc+=shade(d+vec2(-o,-o*0.4),c);ca+=c;',
    '    acc+=shade(d+vec2(-o*0.4,o),c);ca+=c;acc+=shade(d+vec2(o*0.4,-o),c);ca+=c;',
    '    acc*=0.25;ca*=0.25;',
    /* Fasern vor der Kugel: Im Rasen und im Fell sitzt sie unten zwischen den Halmen, auf Gold und Chrom liegt sie frei auf */
    '    float px=fc.x/max(uBall.z*uTuft.w,1.5);',
    '    float i0=floor(px),f0=fract(px);',
    '    float tip=mix(h1(i0),h1(i0+1.),f0)*0.6+h1(floor(px*2.3))*0.4;',
    '    float edge=uTuft.x+tip*uTuft.y-(1.-uSink)*0.6;',
    '    float gm=smoothstep(edge-uTuft.z,edge+uTuft.z,d.y);',
    '    ca*=gm;',
    '    outc=acc*ca+outc*(1.-ca);outa=ca+outa*(1.-ca);',
    '  }',
    '  gl_FragColor=vec4(outc,outa);',
    '}'
  ].join('\n');

  function sh(t, s) { var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return gl.getShaderParameter(o, gl.COMPILE_STATUS) ? o : null; }
  var vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) { media.removeChild(cv); return; }
  var pr = gl.createProgram();
  gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { media.removeChild(cv); return; }
  gl.useProgram(pr);
  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  var la = gl.getAttribLocation(pr, 'a');
  gl.enableVertexAttribArray(la); gl.vertexAttribPointer(la, 2, gl.FLOAT, false, 0, 0);
  var U = {};
  ['uRes', 'uImg', 'uBall', 'uHI', 'uH', 'uPos', 'uR', 'uAsp', 'uSink', 'uTex', 'uTex2', 'uTm', 'uTexOk', 'uCol', 'uGnd', 'uSh', 'uTuft', 'uRefl', 'uMir', 'uRip', 'uRipP'].forEach(function (n) { U[n] = gl.getUniformLocation(pr, n); });

  /* Das Bild der Fläche auf der Grafikkarte: Die Kugel zeigt es gebrochen in ihrem Inneren.
     Zwei Plätze: das aktuelle Bild und das, zu dem gerade übergeblendet wird. */
  gl.uniform1i(U.uTex, 0); gl.uniform1i(U.uTex2, 1); gl.uniform1f(U.uTexOk, 0); gl.uniform1f(U.uTm, 0);
  var texA = null, texB = null, tm = 0, tmOn = false;
  function upload(im) {
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, im);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }
  function bindTex() {
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texB || texA);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texA);
  }
  function surfImg(m) { return m === 'moos' ? media.querySelector('img:not(.play__surf)') : media.querySelector('.play__surf[data-m="' + m + '"]'); }
  var texFor = '';
  function loadSurf(m) {
    var im = surfImg(m);
    if (!im) return;
    texFor = m;
    function up() {
      if (texFor !== m) return;
      try {
        var t = upload(im);
        if (!texA) { texA = t; bindTex(); gl.uniform1f(U.uTexOk, 1); }
        else {
          if (texB) { gl.deleteTexture(texA); texA = texB; }        /* ein laufender Übergang wird abgeschlossen */
          texB = t; tm = 0; tmOn = true; bindTex();
        }
        fade();
      } catch (err) {}
    }
    if (im.complete && im.naturalWidth) up(); else im.addEventListener('load', up, { once: true });
  }
  /* Aussehen der aktuellen Fläche; beim Wechsel gleiten alle Werte weich zum neuen Material */
  var KEYS = ['glass', 'gnd', 'sh', 'tuft'];
  var look = { glass: P.glass.slice(), gnd: P.gnd.slice(), sh: P.sh.slice(), tuft: P.tuft.slice(), refl: P.refl };
  var fadeRaf = 0, fadeLast = 0;
  function fadeStep(now) {
    fadeRaf = 0;
    var dt = Math.min(0.05, (now - fadeLast) / 1000 || 0.016); fadeLast = now;
    var k = visible ? Math.min(1, 3.2 * dt) : 1, d = 0, i, j, a, t;
    for (i = 0; i < KEYS.length; i++) { a = look[KEYS[i]]; t = P[KEYS[i]]; for (j = 0; j < a.length; j++) { a[j] += (t[j] - a[j]) * k; d += Math.abs(t[j] - a[j]); } }
    look.refl += (P.refl - look.refl) * k; d += Math.abs(P.refl - look.refl);
    if (tmOn) {
      tm = visible ? Math.min(1, tm + dt / 1.2) : 1;
      if (tm >= 1) { gl.deleteTexture(texA); texA = texB; texB = null; tm = 0; tmOn = false; bindTex(); }
    }
    if (visible && !running) draw();
    if (d > 0.004 || tmOn) fadeRaf = requestAnimationFrame(fadeStep);
  }
  function fade() { if (!fadeRaf) { fadeLast = performance.now(); fadeRaf = requestAnimationFrame(fadeStep); } }
  function setSurf() {
    var m = matNow();
    if (SURF[m] === P && texFor === m) return;
    P = SURF[m]; rips.length = 0;
    loadSurf(m); fade(); wake();
  }
  if ('MutationObserver' in window) {
    new MutationObserver(setSurf).observe(document.documentElement, { attributes: true, attributeFilter: ['data-mat'] });
  }
  /* Wellen, die gerade über die Fläche laufen */
  var rips = [], ripBuf = new Float32Array(16), wakeD = 0;
  function ripple(x, y, amp) {
    if (!P.rip || amp <= 0) return;
    rips.push({ x: x, y: y, t: performance.now(), a: Math.min(1, amp) });
    if (rips.length > 4) rips.shift();
  }
  function ripsAlive(now) {
    if (!P.rip) return false;
    var life = RIP[P.rip][5] * 1000;
    for (var i = 0; i < rips.length; i++) if (now - rips[i].t < life) return true;
    return false;
  }
  /* mat3 spaltenweise */
  gl.uniformMatrix3fv(U.uHI, false, new Float32Array([HI[0], HI[3], HI[6], HI[1], HI[4], HI[7], HI[2], HI[5], HI[8]]));
  gl.uniformMatrix3fv(U.uH, false, new Float32Array([H[0], H[3], H[6], H[1], H[4], H[7], H[2], H[5], H[8]]));
  gl.uniform1f(U.uAsp, ASP);
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);

  /* ---- Größe ---- */
  var cw = 0, ch = 0, dpr = 1, imgRect = [0, 0, 1, 1];
  function resize() {
    var w = media.clientWidth, h = media.clientHeight;
    if (!w || !h) return;
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var W = Math.round(w * dpr), Hh = Math.round(h * (1 + TOP) * dpr);
    if (W !== cw || Hh !== ch) { cw = cv.width = W; ch = cv.height = Hh; gl.viewport(0, 0, W, Hh); }
    imgRect = [0, h * TOP * dpr, w * dpr, h * dpr];
    draw();
  }

  function draw() {
    if (!cw) return;
    var s = screenBall();
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(U.uRes, cw, ch);
    gl.uniform4f(U.uImg, imgRect[0], imgRect[1], imgRect[2], imgRect[3]);
    gl.uniform3f(U.uBall, imgRect[0] + s.x * imgRect[2], imgRect[1] + s.y * imgRect[3], s.r * imgRect[2]);
    gl.uniform3f(U.uCol, look.glass[0], look.glass[1], look.glass[2]);
    gl.uniform3f(U.uGnd, look.gnd[0], look.gnd[1], look.gnd[2]);
    gl.uniform4f(U.uSh, look.sh[0], look.sh[1], look.sh[2], look.sh[3]);
    gl.uniform4f(U.uTuft, look.tuft[0], look.tuft[1], look.tuft[2], look.tuft[3]);
    gl.uniform1f(U.uRefl, look.refl);
    gl.uniform1f(U.uTm, tmOn ? tm * tm * (3 - 2 * tm) : 0);
    /* Spiegelbild: gleich weit unter dem Auflagepunkt, wie die Kugel darüber steht */
    var pg = ground(b.x, b.y);
    gl.uniform1f(U.uMir, imgRect[1] + (pg[1] + (s.r + b.z * s.s * s.k) * CAM_UP * IMG_AR) * imgRect[3]);
    var rp = RIP[P.rip] || RIP[1], now = performance.now(), i;
    gl.uniform4f(U.uRipP, rp[0], rp[1], rp[2], rp[3]);
    for (i = 0; i < 4; i++) {
      var rr = rips[i], age = rr ? (now - rr.t) / 1000 : 9;
      ripBuf[i * 4] = rr ? rr.x : 0; ripBuf[i * 4 + 1] = rr ? rr.y : 0; ripBuf[i * 4 + 2] = age;
      ripBuf[i * 4 + 3] = rr && P.rip && age < rp[5] ? rr.a * rp[4] * Math.pow(1 - age / rp[5], 1.6) : 0;
    }
    gl.uniform4fv(U.uRip, ripBuf);
    gl.uniform3f(U.uPos, b.x, b.y, b.z * s.k); gl.uniform1f(U.uR, R * s.k);
    gl.uniform1f(U.uSink, Math.max(0, 1 - b.z / 0.05));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /* ---- Physik ---- */
  function spin(dt) {
    var ax = b.wx * dt, ay = b.wy * dt, az = b.wz * dt;
    var an = Math.sqrt(ax*ax + ay*ay + az*az);
    if (an < 1e-7) return;
    var sn = Math.sin(an / 2) / an, c = Math.cos(an / 2);
    var dx = ax * sn, dy = ay * sn, dz = az * sn, q = b.q, w = q[0], x = q[1], y = q[2], z = q[3];
    q[0] = c*w - dx*x - dy*y - dz*z;
    q[1] = c*x + dx*w + dy*z - dz*y;
    q[2] = c*y - dx*z + dy*w + dz*x;
    q[3] = c*z + dx*y - dy*x + dz*w;
    var l = Math.sqrt(q[0]*q[0] + q[1]*q[1] + q[2]*q[2] + q[3]*q[3]);
    q[0] /= l; q[1] /= l; q[2] /= l; q[3] /= l;
  }
  function step(dt) {
    var onGround = b.z <= 0 && b.vz <= 0;
    if (!onGround) {
      b.vz -= G * dt; b.z += b.vz * dt;
      if (b.z <= 0) {
        b.z = 0;
        if (b.vz < -P.thr) { ripple(b.x, b.y, -b.vz / 1.9); b.vz = -b.vz * P.rest; b.vx *= P.bfr; b.vy *= P.bfr; }
        else { ripple(b.x, b.y, -b.vz / 3); b.vz = 0; }
      }
      b.wx *= 1 - 0.3 * dt; b.wy *= 1 - 0.3 * dt; b.wz *= 1 - 0.6 * dt;
    }
    if (drag) {
      /* Ziehen: der Ball wird zum Zeiger hin beschleunigt, mit begrenztem Tempo */
      var ex = Math.min(X1, Math.max(X0, drag.tx)) - b.x, ey = Math.min(Y1, Math.max(Y0, drag.ty)) - b.y;
      var wx_ = ex * 16, wy_ = ey * 16, wl = Math.sqrt(wx_*wx_ + wy_*wy_);
      if (wl > VMAX_DRAG) { wx_ *= VMAX_DRAG / wl; wy_ *= VMAX_DRAG / wl; }
      var kk = Math.min(1, 22 * dt);
      b.vx += (wx_ - b.vx) * kk; b.vy += (wy_ - b.vy) * kk;
    }
    var sp = Math.sqrt(b.vx*b.vx + b.vy*b.vy);
    if (b.z <= 0 && b.vz === 0) {
      /* Rollwiderstand im Gras */
      if (sp > 0 && !drag) {
        var ns = Math.max(0, sp - (P.r0 + P.r1 * sp) * dt);
        b.vx *= ns / sp; b.vy *= ns / sp; sp = ns;
      }
      /* Im Fell lenken die Büschel die Kugel leicht ab */
      if (P.jit && sp > 0.08) {
        var ja = (Math.random() - 0.5) * P.jit * dt * 6, jc = Math.cos(ja), js = Math.sin(ja), jx = b.vx;
        b.vx = jx * jc - b.vy * js; b.vy = jx * js + b.vy * jc;
      }
      /* Auf der Flüssigkeit zieht die rollende Kugel kleine Wellen hinter sich her */
      if (P.rip === 2 && sp > 0.22) { wakeD += sp * dt; if (wakeD > 0.12) { wakeD = 0; ripple(b.x, b.y, 0.2 + 0.25 * Math.min(1, sp / 1.6)); } }
      /* Rollen ohne Rutschen: Drehung folgt der Bewegung */
      var tx = -b.vy / R, ty = b.vx / R, k = Math.min(1, 14 * dt);
      b.wx += (tx - b.wx) * k; b.wy += (ty - b.wy) * k; b.wz *= 1 - Math.min(1, 5 * dt);
    }
    b.x += b.vx * dt; b.y += b.vy * dt;
    /* der Spielbereich passt sich weich an die Fläche an (das Kissen hat einen breiteren Rand) */
    var eD = P.edge - edge;
    if (eD) { edge = Math.abs(eD) < 0.0005 ? P.edge : edge + eD * Math.min(1, 5 * dt); bounds(); }
    /* Unsichtbare Bande: kurz vor der Rasenkante prallt der Ball ab */
    if (b.x < X0) { b.x = X0; if (b.vx < 0) { b.vx = -b.vx * P.wall; b.wz += b.vy * 3; } }
    else if (b.x > X1) { b.x = X1; if (b.vx > 0) { b.vx = -b.vx * P.wall; b.wz -= b.vy * 3; } }
    if (b.y < Y0) { b.y = Y0; if (b.vy < 0) { b.vy = -b.vy * P.wall; b.wz -= b.vx * 3; } }
    else if (b.y > Y1) { b.y = Y1; if (b.vy > 0) { b.vy = -b.vy * P.wall; b.wz += b.vx * 3; } }
    spin(dt);
    return !!drag || sp > 0.004 || b.z > 0 || Math.abs(b.vz) > 0 || edge !== P.edge ||
           (Math.abs(b.wx) + Math.abs(b.wy) + Math.abs(b.wz)) > 0.05;
  }

  var drag = null, VMAX_DRAG = 5.5, VMAX_THROW = 3.4;
  var running = false, visible = false, last = 0, acc = 0, STEP = 1 / 120;
  function frame(t) {
    if (!running) return;
    if (!visible) { running = false; return; }
    var dt = Math.min(0.05, (t - last) / 1000); last = t; acc += dt;
    var alive = true;
    while (acc >= STEP) { alive = step(STEP); acc -= STEP; }
    if (ripsAlive(t)) alive = true;      /* Wellen laufen aus, auch wenn die Kugel schon liegt */
    draw();
    if (alive) requestAnimationFrame(frame);
    else { running = false; b.vx = b.vy = b.vz = 0; b.wx = b.wy = b.wz = 0; }
  }
  function wake() {
    if (running || !visible) return;
    running = true; acc = 0; last = performance.now();
    requestAnimationFrame(frame);
  }

  /* ---- Schuss ---- */
  function hit(e) {                /* Zeiger -> Lage relativ zum Ball, in Ballradien */
    var rc = cv.getBoundingClientRect();
    if (!rc.width) return null;
    var s = screenBall(), iw = rc.width, ih = rc.height / (1 + TOP), top = rc.top + ih * TOP;
    var cx = rc.left + s.x * iw, cy = top + s.y * ih, r = s.r * iw;
    return { dx: (e.clientX - cx) / r, dy: (cy - e.clientY) / r, r: r };
  }
  function kick(h) {
    /* Der Ball fliegt von der Stelle weg, an der er getroffen wird */
    var dx = -h.dx, dy = -h.dy, l = Math.sqrt(dx*dx + dy*dy);
    var tcx = 0.5 - b.x, tcy = ASP / 2 - b.y, tl = Math.sqrt(tcx*tcx + tcy*tcy) || 1;
    if (l < 0.22) { var a = Math.random() * 6.283; dx = Math.cos(a); dy = Math.sin(a); l = 1; }
    dx = dx / l + 0.35 * tcx / tl; dy = dy / l + 0.35 * tcy / tl;
    l = Math.sqrt(dx*dx + dy*dy) || 1; dx /= l; dy /= l;
    var power = (1.75 + Math.random() * 0.55) * P.kxy;
    b.vx = b.vx * 0.25 + dx * power;
    b.vy = b.vy * 0.25 + dy * power;
    b.vz = (1.15 + Math.random() * 0.75 + Math.max(0, -h.dy) * 0.5) * P.kz;
    /* nie höher als ZMAX, auch bei schnellen Klicks in der Luft */
    b.vz = Math.min(b.vz, Math.sqrt(Math.max(0, 2 * G * (ZMAX - b.z))));
    if (b.z <= 0) b.z = 0.0005;
    /* etwas Effet, je nachdem wie seitlich getroffen wurde */
    b.wz += (h.dx * dy + h.dy * dx) * 9;
    b.wx += -dy * 6; b.wy += dx * 6;
    wake();
  }
  /* Zeiger -> Punkt auf dem Rasen (Bodenkoordinaten) */
  function toGround(e) {
    var rc = cv.getBoundingClientRect(), ih = rc.height / (1 + TOP);
    var ix = (e.clientX - rc.left) / rc.width, iy = (e.clientY - rc.top - ih * TOP) / ih;
    var w = HI[6] * ix + HI[7] * iy + 1;
    return [(HI[0] * ix + HI[1] * iy + HI[2]) / w, (HI[3] * ix + HI[4] * iy + HI[5]) / w];
  }
  /* Tippen = schießen. Halten oder Bewegen = ziehen, beim Loslassen rollt der Ball mit Schwung weiter. */
  var press = null;
  function startDrag() {
    if (!press || drag) return;
    var g = toGround(press.last);
    drag = { ox: b.x - g[0], oy: b.y - g[1], tx: b.x, ty: b.y };
    sec.classList.add('is-grab');
    wake();
  }
  function endPress(e, cancel) {
    if (!press || (e && e.pointerId !== press.id)) return;
    clearTimeout(press.timer);
    try { sec.releasePointerCapture(press.id); } catch (err) {}
    if (drag) {
      drag = null; sec.classList.remove('is-grab');
      var sp = Math.sqrt(b.vx*b.vx + b.vy*b.vy);
      if (sp > VMAX_THROW) { b.vx *= VMAX_THROW / sp; b.vy *= VMAX_THROW / sp; }
      wake();
    } else if (!cancel) {
      kick(press.h);
    }
    press = null;
  }
  sec.addEventListener('pointerdown', function (e) {
    if (e.button || press) return;
    var h = hit(e); if (!h) return;
    var reach = e.pointerType === 'mouse' ? 1.12 : Math.max(1.5, 30 / h.r);
    if (h.dx*h.dx + h.dy*h.dy > reach*reach) return;
    press = { id: e.pointerId, h: h, x: e.clientX, y: e.clientY, last: e, timer: setTimeout(startDrag, 190) };
    try { sec.setPointerCapture(e.pointerId); } catch (err) {}
    if (e.pointerType === 'mouse') e.preventDefault();      /* keine Textmarkierung beim Ziehen */
  });
  sec.addEventListener('pointermove', function (e) {
    if (press && e.pointerId === press.id) {
      press.last = e;
      if (!drag) {
        var mx = e.clientX - press.x, my = e.clientY - press.y;
        if (mx*mx + my*my > 36) startDrag();
      }
      if (drag) { var g = toGround(e); drag.tx = g[0] + drag.ox; drag.ty = g[1] + drag.oy; }
      return;
    }
    if (e.pointerType !== 'mouse') return;
    var h = hit(e);
    sec.classList.toggle('is-ball', !!h && h.dx*h.dx + h.dy*h.dy <= 1.25);
  });
  sec.addEventListener('pointerup', function (e) { endPress(e, false); });
  sec.addEventListener('pointercancel', function (e) { endPress(e, true); });
  sec.addEventListener('pointerleave', function () { if (!press) sec.classList.remove('is-ball'); });
  /* Am Handy: solange der Finger auf dem Ball liegt, scrollt die Seite nicht mit */
  sec.addEventListener('touchmove', function (e) { if (press && e.cancelable) e.preventDefault(); }, { passive: false });
  window.addEventListener('blur', function () { endPress(null, true); });

  /* ---- Start ---- */
  var dropped = false;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) {
      visible = en[0].isIntersecting;
      if (visible && !dropped && en[0].intersectionRatio > 0.35) {
        dropped = true;
        if (!reduce) { b.z = 0.42; b.vz = 0; b.vx = -0.16; b.vy = 0.1; b.wx = -2; b.wy = -3; }
      }
      if (visible) { draw(); wake(); }
    }, { threshold: [0, 0.35, 0.6] }).observe(media);
  } else { visible = true; }
  loadSurf(matNow());
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(media);
  window.addEventListener('resize', resize);
  resize();
})();
