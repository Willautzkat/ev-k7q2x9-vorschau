/* Spielraum: Glaskugel auf dem Rasen (früher ein Fußball, die Physik ist dieselbe geblieben).
   Die Kugel ist aus Glas in der Akzentfarbe der Seite: Man sieht den Rasen gebrochen durch sie hindurch,
   oben links sitzt das Glanzlicht, und im Schatten auf dem Rasen liegt der helle Lichtfleck, den das Glas bündelt.
   Der Ball lebt in Bodenkoordinaten (x nach rechts 0..1, y nach hinten 0..ASP, z nach oben).
   Die Abbildung Boden -> Bild (H) ist aus den vier Ecken der Rasenfläche im Foto berechnet,
   deshalb wird der Ball hinten kleiner und bleibt genau auf dem Rasen. */
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
  var EDGE = 0.025;               /* Abstand, den der Ball zur Rasenkante hält */
  var G = 7.5;                    /* Schwerkraft */
  var ZMAX = 0.42;                /* größte Flughöhe */
  var X0 = R + EDGE, X1 = 1 - R - EDGE, Y0 = R + EDGE + 0.02, Y1 = ASP - R - EDGE - 0.05;
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
    'uniform mat3 uHI;uniform mat3 uH;uniform sampler2D uTex;uniform float uTexOk;uniform vec3 uCol;',
    'uniform vec3 uPos;uniform float uR;uniform float uAsp;uniform float uSink;',
    'const vec3 L=vec3(-0.385,-0.128,0.914);',        /* Licht von links oben, leicht von vorn */
    'const vec3 CR=vec3(1.,0.,0.);const vec3 CU=vec3(0.,0.8,0.6);const vec3 CF=vec3(0.,-0.6,0.8);',
    'float h1(float n){return fract(sin(n*127.1)*43758.5453);}',
    /* Umgebung, die sich im Glas spiegelt: unten der Rasen, oben ein ruhiger Himmel, links oben die Lichtquelle */
    'vec3 env(vec3 d){',
    '  vec3 c=mix(vec3(0.07,0.12,0.03),vec3(0.33,0.37,0.43),smoothstep(-0.15,0.5,d.z));',
    '  float l=max(dot(d,L),0.);',
    '  return c+vec3(1.,0.98,0.94)*(pow(l,90.)*2.2+pow(l,6.)*0.2);',
    '}',
    /* Was die Kugel mit dem Rasen macht. a: Schatten, rgb: Licht, das das Glas zu einem hellen Fleck bündelt */
    'vec4 lawnFx(vec2 g){',
    '  float hgt=uPos.z+uR;',
    '  vec2 ld=normalize(L.xy);',
    '  vec2 sc=uPos.xy-L.xy/L.z*hgt;',
    '  vec2 dv=g-sc;float al=dot(dv,ld);vec2 pe=dv-ld*al;',
    '  float dd=length(vec2(al*L.z,length(pe)))/uR;',
    '  float blur=0.2+uPos.z*1.1;',
    '  float sh=(1.-smoothstep(1.-blur,1.+blur,dd))*0.56/(1.+uPos.z*1.5);',      /* Glas lässt Licht durch: heller als ein Ballschatten */
    '  float cd=length(g-uPos.xy)/uR;',
    '  sh=max(sh,(1.-smoothstep(0.2,1.15,cd))*0.58*uSink);',
    '  vec2 cv=g-(sc-ld*uR*0.3);float ca=dot(cv,ld);',
    '  float cq=length(vec2(ca*L.z,length(cv-ld*ca)))/uR;',
    '  float cs=exp(-cq*cq/(0.1+uPos.z*1.4))*0.9/(1.+uPos.z*7.);',
    '  return vec4(mix(vec3(1.),uCol,0.6)*cs,sh*(1.-0.5*cs));',
    '}',
    /* Blick aus der Kugel heraus: trifft der Strahl den Rasen, zeigt er das Foto an dieser Stelle */
    'vec3 lawn(vec3 P,vec3 d){',
    '  if(d.z>-0.02)return env(d);',
    '  vec2 g=P.xy+d.xy*(-P.z/d.z);',
    '  vec3 ip=uH*vec3(g,1.);vec2 iu=ip.xy/ip.z;',
    '  float ins=step(0.,ip.z)*smoothstep(-0.01,0.01,iu.x)*smoothstep(1.01,0.99,iu.x)*smoothstep(-0.01,0.01,iu.y)*smoothstep(1.01,0.99,iu.y);',
    '  vec3 c=uTexOk>0.5?texture2D(uTex,clamp(iu,0.,1.)).rgb:vec3(0.16,0.3,0.06);',
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
    '  vec4 fx=lawnFx(g)*inl*step(0.,gp.z);',
    '  outc=fx.rgb;outa=fx.a;',
    /* Ball */
    '  vec2 d=(fc-uBall.xy)/uBall.z;d.y=-d.y;',
    '  if(dot(d,d)<1.08){',
    '    vec3 acc=vec3(0.);float ca=0.;float c;',
    '    float o=0.3/uBall.z;',
    '    acc+=shade(d+vec2(o,o*0.4),c);ca+=c;acc+=shade(d+vec2(-o,-o*0.4),c);ca+=c;',
    '    acc+=shade(d+vec2(-o*0.4,o),c);ca+=c;acc+=shade(d+vec2(o*0.4,-o),c);ca+=c;',
    '    acc*=0.25;ca*=0.25;',
    /* Grashalme vor dem Ball: unten ausgefranst, der Ball sitzt im Rasen */
    '    float px=fc.x/max(uBall.z*0.075,1.5);',
    '    float i0=floor(px),f0=fract(px);',
    '    float tip=mix(h1(i0),h1(i0+1.),f0)*0.6+h1(floor(px*2.3))*0.4;',
    '    float edge=-0.89+tip*0.2-(1.-uSink)*0.6;',
    '    float gm=smoothstep(edge-0.05,edge+0.05,d.y);',
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
  ['uRes', 'uImg', 'uBall', 'uHI', 'uH', 'uPos', 'uR', 'uAsp', 'uSink', 'uTex', 'uTexOk', 'uCol'].forEach(function (n) { U[n] = gl.getUniformLocation(pr, n); });

  /* Das Rasenfoto als Bild auf der Grafikkarte: Die Kugel zeigt es gebrochen in ihrem Inneren */
  gl.uniform1i(U.uTex, 0); gl.uniform1f(U.uTexOk, 0);
  (function () {
    var im = media.querySelector('img');
    if (!im) return;
    function up() {
      try {
        var tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, im);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.uniform1f(U.uTexOk, 1);
        draw();
      } catch (err) {}
    }
    if (im.complete && im.naturalWidth) up(); else im.addEventListener('load', up, { once: true });
  })();
  /* Glasfarbe je Material der Tilde; beim Wechsel blendet sie weich über */
  var GLASS = { moos: [0.62, 0.80, 0.10], gold: [0.92, 0.64, 0.16], fell: [0.36, 0.66, 0.96], chrom: [0.80, 0.84, 0.90] };
  function glassNow() { return GLASS[document.documentElement.getAttribute('data-mat')] || GLASS.moos; }
  var col = glassNow().slice(), colTo = col, colRaf = 0;
  function colStep() {
    colRaf = 0;
    var d = 0, i;
    for (i = 0; i < 3; i++) { col[i] += (colTo[i] - col[i]) * 0.07; d += Math.abs(colTo[i] - col[i]); }
    if (d < 0.004 || !visible) col = colTo.slice(); else colRaf = requestAnimationFrame(colStep);
    if (visible && !running) draw();
  }
  if ('MutationObserver' in window) {
    new MutationObserver(function () { colTo = glassNow(); if (!colRaf) colRaf = requestAnimationFrame(colStep); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ['data-mat'] });
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
    gl.uniform3f(U.uCol, col[0], col[1], col[2]);
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
        if (b.vz < -0.55) { b.vz = -b.vz * 0.46; b.vx *= 0.86; b.vy *= 0.86; }
        else b.vz = 0;
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
        var ns = Math.max(0, sp - (0.7 + 0.9 * sp) * dt);
        b.vx *= ns / sp; b.vy *= ns / sp; sp = ns;
      }
      /* Rollen ohne Rutschen: Drehung folgt der Bewegung */
      var tx = -b.vy / R, ty = b.vx / R, k = Math.min(1, 14 * dt);
      b.wx += (tx - b.wx) * k; b.wy += (ty - b.wy) * k; b.wz *= 1 - Math.min(1, 5 * dt);
    }
    b.x += b.vx * dt; b.y += b.vy * dt;
    /* Unsichtbare Bande: kurz vor der Rasenkante prallt der Ball ab */
    if (b.x < X0) { b.x = X0; if (b.vx < 0) { b.vx = -b.vx * 0.74; b.wz += b.vy * 3; } }
    else if (b.x > X1) { b.x = X1; if (b.vx > 0) { b.vx = -b.vx * 0.74; b.wz -= b.vy * 3; } }
    if (b.y < Y0) { b.y = Y0; if (b.vy < 0) { b.vy = -b.vy * 0.74; b.wz -= b.vx * 3; } }
    else if (b.y > Y1) { b.y = Y1; if (b.vy > 0) { b.vy = -b.vy * 0.74; b.wz += b.vx * 3; } }
    spin(dt);
    return !!drag || sp > 0.004 || b.z > 0 || Math.abs(b.vz) > 0 ||
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
    var power = 1.75 + Math.random() * 0.55;
    b.vx = b.vx * 0.25 + dx * power;
    b.vy = b.vy * 0.25 + dy * power;
    b.vz = 1.15 + Math.random() * 0.75 + Math.max(0, -h.dy) * 0.5;
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
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(media);
  window.addEventListener('resize', resize);
  resize();
})();
