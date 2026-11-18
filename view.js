/* view.js — рендер, ввод, UI. Логика только в sim.js. */
(function () {
'use strict';

var CELL = SIM.CELL, COLS = SIM.COLS, ROWS = SIM.ROWS;
var W = COLS * CELL, H = ROWS * CELL;

var cv = document.getElementById('cv'), ctx = cv.getContext('2d');
var flashEl = document.getElementById('flash'), toastEl = document.getElementById('toast');
var rail = document.getElementById('rail'), panel = document.getElementById('towerPanel');
var overlay = document.getElementById('overlay');
var el = {
  gold: document.getElementById('hudGold'), lives: document.getElementById('hudLives'),
  wave: document.getElementById('hudWave'), speed: document.getElementById('btnSpeed'),
  waveBtn: document.getElementById('btnWave'), tpName: document.getElementById('tpName'),
  tpStats: document.getElementById('tpStats'), up: document.getElementById('btnUp'),
  sell: document.getElementById('btnSell'), ovTitle: document.getElementById('ovTitle'),
  ovText: document.getElementById('ovText'), ovBtn: document.getElementById('ovBtn'),
  stars: document.getElementById('winStars')
};

/* трекер ошибок для проверки сборки */
window.__errs = [];
window.addEventListener('error', function (e) { window.__errs.push(String(e.message || e.error)); });
window.addEventListener('unhandledrejection', function (e) { window.__errs.push('rej: ' + e.reason); });

var G = SIM.newGame((Date.now() & 0x7fffffff) || 7);
var UI = { placing: null, sel: null, ghost: null, speed: 1, toastT: 0, hudT: 0, record: 0 };
try { UI.record = (Platform.load() || {}).bestStars || 0; } catch (e) {}

var ICONS = { archer: '🏹', ballista: '🎯', frost: '❄️', mage: '✨' };

/* ================= отрисовка поля (один раз) ================= */
var FIELD = null;
function prand(i) { var x = Math.sin(i * 127.1 + 0.5) * 43758.5453; return x - Math.floor(x); }
function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
}

function drawTree(g, x, y, s) {
  g.fillStyle = 'rgba(0,0,0,.28)';
  g.beginPath(); g.ellipse(x + 3, y + 9 * s, 10 * s, 4 * s, 0, 0, 6.283); g.fill();
  g.fillStyle = '#4a3421';
  g.fillRect(x - 2.2 * s, y - 2 * s, 4.4 * s, 12 * s);
  var greens = ['#2a4429', '#31512f', '#3a5d36'];
  for (var i = 0; i < 3; i++) {
    g.fillStyle = greens[i];
    g.beginPath(); g.arc(x + (i - 1) * 7 * s, y - 9 * s - (i % 2) * 4 * s, 8.5 * s, 0, 6.283); g.fill();
  }
  g.fillStyle = 'rgba(120,160,90,.25)';
  g.beginPath(); g.arc(x - 3 * s, y - 14 * s, 4 * s, 0, 6.283); g.fill();
}

function drawRock(g, x, y) {
  g.fillStyle = 'rgba(0,0,0,.3)';
  g.beginPath(); g.ellipse(x + 2, y + 7, 12, 5, 0, 0, 6.283); g.fill();
  g.fillStyle = '#5d6058';
  g.beginPath(); g.moveTo(x - 11, y + 6); g.lineTo(x - 6, y - 8); g.lineTo(x + 4, y - 10);
  g.lineTo(x + 11, y + 1); g.lineTo(x + 7, y + 7); g.closePath(); g.fill();
  g.fillStyle = '#767a70';
  g.beginPath(); g.moveTo(x - 6, y - 8); g.lineTo(x + 4, y - 10); g.lineTo(x + 1, y - 2); g.closePath(); g.fill();
}

function drawCastle(g) {
  var cx = 180, top = 582;
  /* стена */
  var grd = g.createLinearGradient(0, top, 0, H);
  grd.addColorStop(0, '#6d6f62'); grd.addColorStop(1, '#3d3f36');
  g.fillStyle = grd;
  g.fillRect(96, top + 8, 168, H - top - 8);
  /* зубцы */
  for (var i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? '#616353' : '#71735f';
    g.fillRect(96 + i * 21, top - 2, 13, 12);
  }
  /* башни по бокам */
  [96, 246].forEach(function (bx) {
    var bg = g.createLinearGradient(bx, top, bx + 18, H);
    bg.addColorStop(0, '#7c7e6c'); bg.addColorStop(1, '#45473c');
    g.fillStyle = bg;
    g.fillRect(bx, top - 26, 22, H - top + 26);
    for (var k = 0; k < 2; k++) g.fillRect(bx + k * 12, top - 36, 9, 12);
    /* флаг */
    g.strokeStyle = '#2c2418'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(bx + 11, top - 36); g.lineTo(bx + 11, top - 62); g.stroke();
    g.fillStyle = '#a5372a';
    g.beginPath(); g.moveTo(bx + 11, top - 62); g.lineTo(bx + 34, top - 55); g.lineTo(bx + 11, top - 48); g.closePath(); g.fill();
  });
  /* ворота */
  g.fillStyle = '#17170f';
  g.beginPath();
  g.moveTo(cx - 30, H); g.lineTo(cx - 30, top + 34);
  g.quadraticCurveTo(cx, top + 6, cx + 30, top + 34);
  g.lineTo(cx + 30, H); g.closePath(); g.fill();
  g.strokeStyle = '#8b8b72'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(cx - 30, top + 34); g.quadraticCurveTo(cx, top + 6, cx + 30, top + 34); g.stroke();
  /* решётка */
  g.strokeStyle = 'rgba(120,110,80,.5)'; g.lineWidth = 1.6;
  for (var v = -24; v <= 24; v += 8) { g.beginPath(); g.moveTo(cx + v, H); g.lineTo(cx + v, top + 20); g.stroke(); }
  /* кладка */
  g.strokeStyle = 'rgba(20,20,14,.18)'; g.lineWidth = 1;
  for (var ry = top + 14; ry < H; ry += 11) { g.beginPath(); g.moveTo(96, ry); g.lineTo(264, ry); g.stroke(); }
}

function bake() {
  var b = document.createElement('canvas'); b.width = W; b.height = H;
  var g = b.getContext('2d');
  /* трава */
  for (var c = 0; c < COLS; c++) for (var r = 0; r < ROWS; r++) {
    var n = prand(c * 31 + r * 7);
    g.fillStyle = (c + r) % 2 ? '#33492e' : '#2e4229';
    if (n > 0.82) g.fillStyle = '#38502f';
    g.fillRect(c * CELL, r * CELL, CELL, CELL);
    if (n > 0.55) {
      g.fillStyle = 'rgba(24,38,20,.5)';
      var tx = c * CELL + n * 30 + 5, ty = r * CELL + (1 - n) * 30 + 5;
      g.fillRect(tx, ty, 1.6, 5); g.fillRect(tx + 3, ty + 2, 1.4, 4);
    }
  }
  /* тропа */
  function trace() {
    g.beginPath(); g.moveTo(SIM.PATH[0].x, SIM.PATH[0].y);
    for (var i = 1; i < SIM.PATH.length; i++) g.lineTo(SIM.PATH[i].x, SIM.PATH[i].y);
  }
  g.lineJoin = 'round'; g.lineCap = 'round';
  trace(); g.strokeStyle = '#2b2417'; g.lineWidth = 38; g.stroke();
  trace(); g.strokeStyle = '#6b5637'; g.lineWidth = 31; g.stroke();
  trace(); g.strokeStyle = '#7d6644'; g.lineWidth = 22; g.stroke();
  /* камешки по тропе */
  for (var s = 14; s < SIM.TOTAL; s += 17) {
    var p = SIM.posAt(s), q = prand(s);
    g.fillStyle = 'rgba(50,40,26,' + (0.25 + q * 0.3) + ')';
    g.beginPath(); g.ellipse(p.x + (q - 0.5) * 22, p.y + (prand(s + 3) - 0.5) * 22, 2.6, 1.8, q * 3, 0, 6.283); g.fill();
  }
  /* декор */
  SIM.DECOR.forEach(function (d) {
    var p = { x: (d[0] + 0.5) * CELL, y: (d[1] + 0.5) * CELL };
    if ((d[0] + d[1]) % 2) drawTree(g, p.x, p.y, 1); else drawRock(g, p.x, p.y);
  });
  drawCastle(g);
  /* виньетка */
  var vg = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.78);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.45)');
  g.fillStyle = vg; g.fillRect(0, 0, W, H);
  FIELD = b;
}

/* ================= башни ================= */
function drawTower(g, t, ghost, ok) {
  var x = t.x, y = t.y, lvl = t.lvl || 1, alpha = ghost ? 0.55 : 1;
  g.save(); g.globalAlpha = alpha;
  /* тень + основание */
  g.fillStyle = 'rgba(0,0,0,.35)';
  g.beginPath(); g.ellipse(x, y + 12, 15, 6, 0, 0, 6.283); g.fill();
  g.fillStyle = ghost ? (ok ? '#4e6b3a' : '#7a3230') : '#5e6054';
  rr(g, x - 14, y + 4, 28, 10, 3); g.fill();
  g.fillStyle = ghost ? 'rgba(255,255,255,.15)' : '#71735f';
  rr(g, x - 14, y + 4, 28, 4, 2); g.fill();

  var rec = t.recoil || 0;
  if (t.type === 'archer' || (!t.type && ghost)) {
    g.fillStyle = '#6b4a2a'; g.fillRect(x - 10, y - 8, 20, 16);
    g.fillStyle = '#7d5730'; g.fillRect(x - 10, y - 8, 20, 3);
    /* стрелки на площадке */
    g.strokeStyle = '#d8cba8'; g.lineWidth = 1.4;
    for (var i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(x + i * 5, y - 2); g.lineTo(x + i * 5 + 4, y - 9); g.stroke(); }
    /* крыша */
    g.fillStyle = '#8f3b2b';
    g.beginPath(); g.moveTo(x - 14, y - 10); g.lineTo(x, y - 25); g.lineTo(x + 14, y - 10); g.closePath(); g.fill();
    g.fillStyle = '#a94b36';
    g.beginPath(); g.moveTo(x - 14, y - 10); g.lineTo(x, y - 25); g.lineTo(x - 2, y - 10); g.closePath(); g.fill();
  } else if (t.type === 'ballista') {
    g.fillStyle = '#5a3f24'; rr(g, x - 12, y - 10, 24, 16, 3); g.fill();
    g.strokeStyle = '#3d2a16'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(x - 12, y - 4); g.lineTo(x + 12, y - 4); g.stroke();
    /* дуга */
    g.strokeStyle = '#c8b489'; g.lineWidth = 2.4;
    g.beginPath(); g.arc(x, y - 6, 12 - rec * 2, Math.PI * 1.12, Math.PI * 1.88); g.stroke();
    g.strokeStyle = '#efe3c4'; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(x - 9, y - 12); g.lineTo(x + 9, y - 12); g.stroke();
  } else if (t.type === 'frost') {
    g.fillStyle = '#3e4a52'; rr(g, x - 11, y - 12, 22, 20, 4); g.fill();
    var pg = g.createRadialGradient(x, y - 16, 1, x, y - 16, 17);
    pg.addColorStop(0, 'rgba(160,230,255,.85)'); pg.addColorStop(1, 'rgba(90,170,220,0)');
    g.fillStyle = pg; g.beginPath(); g.arc(x, y - 16, 17, 0, 6.283); g.fill();
    g.fillStyle = '#bdeeff';
    g.beginPath(); g.moveTo(x, y - 28); g.lineTo(x + 7, y - 16); g.lineTo(x, y - 4); g.lineTo(x - 7, y - 16); g.closePath(); g.fill();
    g.fillStyle = '#e8faff';
    g.beginPath(); g.moveTo(x, y - 28); g.lineTo(x + 3, y - 16); g.lineTo(x, y - 6); g.closePath(); g.fill();
  } else if (t.type === 'mage') {
    g.fillStyle = '#4a3a5c'; rr(g, x - 11, y - 14, 22, 22, 4); g.fill();
    g.fillStyle = '#5d4a72'; rr(g, x - 11, y - 14, 22, 5, 3); g.fill();
    var mg = g.createRadialGradient(x, y - 22, 1, x, y - 22, 16);
    mg.addColorStop(0, 'rgba(210,160,255,.95)'); mg.addColorStop(1, 'rgba(150,90,220,0)');
    g.fillStyle = mg; g.beginPath(); g.arc(x, y - 22, 16, 0, 6.283); g.fill();
    g.fillStyle = '#c9a3ff'; g.beginPath(); g.arc(x, y - 22, 6, 0, 6.283); g.fill();
    g.fillStyle = '#f0e0ff'; g.beginPath(); g.arc(x - 2, y - 24, 2.2, 0, 6.283); g.fill();
  }
  /* уровень */
  for (var l = 0; l < lvl; l++) {
    g.fillStyle = '#e0b64e';
    g.beginPath(); g.arc(x - 5 + l * 5, y + 16, 1.8, 0, 6.283); g.fill();
  }
  g.restore();
}

/* ================= враги ================= */
function hpBar(g, e, y) {
  var w = Math.max(18, e.r * 2.3), h = 3.2, x = e.x - w / 2;
  g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(x - 1, y - 1, w + 2, h + 2);
  var k = Math.max(0, e.hp / e.maxHp);
  g.fillStyle = k > 0.6 ? '#7fbf4d' : k > 0.3 ? '#d8a53c' : '#c0452f';
  g.fillRect(x, y, w * k, h);
}

function drawEnemy(g, e) {
  var r = e.r, x = e.x, y = e.y + Math.sin(e.wob) * 1.4, t = e.type;
  g.fillStyle = 'rgba(0,0,0,.32)';
  g.beginPath(); g.ellipse(x, e.y + r * 0.85, r * 0.9, r * 0.35, 0, 0, 6.283); g.fill();

  var body = t === 'goblin' ? '#6f9a45' : t === 'warg' ? '#5b5347' : t === 'berserk' ? '#a3562f'
    : t === 'shield' ? '#4f6b3a' : t === 'boss' ? '#7a3a2c' : '#5d7f3c';

  if (t === 'warg') {
    /* варг — зверь */
    g.fillStyle = body; rr(g, x - r, y - r * 0.4, r * 2, r * 0.85, r * 0.4); g.fill();
    g.strokeStyle = 'rgba(18,24,12,.65)'; g.lineWidth = 1.4; g.stroke();
    g.beginPath(); g.arc(x + r * 0.75, y - r * 0.5, r * 0.42, 0, 6.283); g.fill(); g.stroke();
    g.fillStyle = '#3a352c';
    g.beginPath(); g.moveTo(x + r * 0.62, y - r * 0.85); g.lineTo(x + r * 0.72, y - r * 1.25); g.lineTo(x + r * 0.85, y - r * 0.85); g.closePath(); g.fill();
    g.strokeStyle = '#3a352c'; g.lineWidth = 2;
    var sw = Math.sin(e.wob) * r * 0.35;
    g.beginPath(); g.moveTo(x - r * 0.6, y + r * 0.35); g.lineTo(x - r * 0.6 + sw, y + r * 0.85); g.stroke();
    g.beginPath(); g.moveTo(x + r * 0.5, y + r * 0.35); g.lineTo(x + r * 0.5 - sw, y + r * 0.85); g.stroke();
    g.fillStyle = '#c33'; g.beginPath(); g.arc(x + r * 0.86, y - r * 0.55, 1.5, 0, 6.283); g.fill();
  } else {
    /* ноги */
    g.strokeStyle = '#3f2a1c'; g.lineWidth = Math.max(2.2, r * 0.3); g.lineCap = 'round';
    var sg = Math.sin(e.wob) * r * 0.34;
    g.beginPath(); g.moveTo(x - r * 0.28, y + r * 0.3); g.lineTo(x - r * 0.28 + sg, y + r * 0.9); g.stroke();
    g.beginPath(); g.moveTo(x + r * 0.28, y + r * 0.3); g.lineTo(x + r * 0.28 - sg, y + r * 0.9); g.stroke();
    /* плащ босса */
    if (t === 'boss') {
      g.fillStyle = '#5a1f1a';
      g.beginPath(); g.moveTo(x - r * 0.8, y - r * 0.5); g.lineTo(x + r * 0.8, y - r * 0.5);
      g.lineTo(x + r * 0.95, y + r * 0.75); g.lineTo(x - r * 0.95, y + r * 0.75); g.closePath(); g.fill();
    }
    /* тело */
    g.fillStyle = body; rr(g, x - r * 0.55, y - r * 0.45, r * 1.1, r * 0.92, r * 0.35); g.fill();
    g.strokeStyle = 'rgba(18,24,12,.65)'; g.lineWidth = 1.4; g.stroke();
    /* голова */
    g.beginPath(); g.arc(x, y - r * 0.82, r * 0.5, 0, 6.283); g.fill(); g.stroke();
    /* уши */
    g.beginPath(); g.moveTo(x - r * 0.5, y - r * 0.9); g.lineTo(x - r * 0.72, y - r * 1.12); g.lineTo(x - r * 0.44, y - r * 1.02); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(x + r * 0.5, y - r * 0.9); g.lineTo(x + r * 0.72, y - r * 1.12); g.lineTo(x + r * 0.44, y - r * 1.02); g.closePath(); g.fill();
    /* глаза */
    g.fillStyle = '#f2d34a';
    g.beginPath(); g.arc(x - r * 0.18, y - r * 0.86, 1.7, 0, 6.283); g.fill();
    g.beginPath(); g.arc(x + r * 0.18, y - r * 0.86, 1.7, 0, 6.283); g.fill();
    /* клыки */
    g.fillStyle = '#efe6cf';
    g.beginPath(); g.moveTo(x - r * 0.22, y - r * 0.68); g.lineTo(x - r * 0.16, y - r * 0.52); g.lineTo(x - r * 0.08, y - r * 0.68); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(x + r * 0.22, y - r * 0.68); g.lineTo(x + r * 0.16, y - r * 0.52); g.lineTo(x + r * 0.08, y - r * 0.68); g.closePath(); g.fill();
    /* шлем */
    if (t === 'orc' || t === 'shield' || t === 'boss') {
      g.fillStyle = t === 'boss' ? '#8a6a2a' : '#4a4a42';
      g.beginPath(); g.arc(x, y - r * 0.9, r * 0.52, Math.PI, 0); g.fill();
      g.fillRect(x - r * 0.52, y - r * 0.9, r * 1.04, r * 0.12);
    }
    /* щит */
    if (t === 'shield') {
      g.fillStyle = '#8a8378';
      rr(g, x - r * 0.95, y - r * 0.45, r * 0.42, r * 0.85, 3); g.fill();
      g.strokeStyle = '#5b554b'; g.lineWidth = 1.4; g.stroke();
    }
    /* оружие */
    if (t === 'orc' || t === 'berserk' || t === 'boss') {
      var k = t === 'boss' ? 1.5 : 1;
      g.strokeStyle = '#4a3a26'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x + r * 0.55, y - r * 0.1); g.lineTo(x + r * (0.9 + 0.1 * Math.sin(e.wob * 0.5)), y - r * (0.9 * k)); g.stroke();
      g.fillStyle = '#b8bcc4';
      g.beginPath(); g.moveTo(x + r * 0.95, y - r * 1.05); g.lineTo(x + r * 1.45, y - r * 0.85); g.lineTo(x + r * 1.1, y - r * 0.55); g.closePath(); g.fill();
    }
  }
  /* заморозка */
  if (e.slowT > 0) {
    g.fillStyle = 'rgba(150,220,255,.35)';
    g.beginPath(); g.arc(x, y - r * 0.3, r * 1.05, 0, 6.283); g.fill();
  }
  hpBar(g, e, y - r * 1.55);
  if (t === 'boss') {
    g.fillStyle = '#f3d98a'; g.font = 'bold 9px Georgia'; g.textAlign = 'center';
    g.fillText('ВОЖДЬ', x, y - r * 1.85);
  }
}

/* ================= сцена ================= */
function render() {
  ctx.clearRect(0, 0, W, H);
  if (FIELD) ctx.drawImage(FIELD, 0, 0);

  /* радиус выбранной/ставимой башни */
  var showR = null;
  if (UI.placing && UI.ghost) showR = SIM.towerStats(UI.placing, 1).range;
  else if (UI.sel != null) {
    for (var i = 0; i < G.towers.length; i++) if (G.towers[i].id === UI.sel) showR = G.towers[i].st.range;
  }
  if (showR != null) {
    var gp = UI.ghost ? { x: (UI.ghost.c + 0.5) * CELL, y: (UI.ghost.r + 0.5) * CELL } : null;
    var t0 = null;
    if (!gp) { for (var j = 0; j < G.towers.length; j++) if (G.towers[j].id === UI.sel) t0 = G.towers[j]; }
    if (gp || t0) {
      var cx = gp ? gp.x : t0.x, cy = gp ? gp.y : t0.y;
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, showR * CELL, 0, 6.283);
      ctx.fillStyle = 'rgba(224,182,78,.10)'; ctx.fill();
      ctx.setLineDash([5, 5]); ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(224,182,78,.55)'; ctx.stroke();
      ctx.restore();
    }
  }

  /* башни */
  for (var k = 0; k < G.towers.length; k++) drawTower(ctx, G.towers[k], false, true);

  /* призрак постановки */
  if (UI.placing && UI.ghost) {
    var ok = SIM.cellFree(G, UI.ghost.c, UI.ghost.r) && G.gold >= SIM.TOWERS[UI.placing].cost;
    var gh = { type: UI.placing, x: (UI.ghost.c + 0.5) * CELL, y: (UI.ghost.r + 0.5) * CELL, lvl: 1, recoil: 0 };
    ctx.save();
    ctx.fillStyle = ok ? 'rgba(80,200,110,.18)' : 'rgba(210,60,50,.22)';
    ctx.fillRect(UI.ghost.c * CELL, UI.ghost.r * CELL, CELL, CELL);
    drawTower(ctx, gh, true, ok);
    ctx.restore();
  }

  /* враги (дальние первыми) */
  var list = G.enemies.slice().sort(function (a, b) { return a.y - b.y; });
  for (var m = 0; m < list.length; m++) drawEnemy(ctx, list[m]);

  /* снаряды */
  for (var s = 0; s < G.shots.length; s++) {
    var sh = G.shots[s];
    if (sh.type === 'ice') {
      ctx.fillStyle = 'rgba(190,240,255,' + Math.max(0, sh.life * 5) + ')';
      ctx.beginPath(); ctx.arc(sh.x, sh.y, 9, 0, 6.283); ctx.fill();
      continue;
    }
    var ang = Math.atan2(sh.ty - sh.y, sh.tx - sh.x);
    if (sh.type === 'orb') {
      var og = ctx.createRadialGradient(sh.x, sh.y, 1, sh.x, sh.y, 12);
      og.addColorStop(0, 'rgba(225,190,255,1)'); og.addColorStop(1, 'rgba(160,100,240,0)');
      ctx.fillStyle = og; ctx.beginPath(); ctx.arc(sh.x, sh.y, 12, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#d0a8ff'; ctx.beginPath(); ctx.arc(sh.x, sh.y, 3.4, 0, 6.283); ctx.fill();
    } else {
      var len = sh.type === 'bolt' ? 15 : 11;
      ctx.strokeStyle = sh.type === 'bolt' ? '#cfd6de' : '#e8dfc0';
      ctx.lineWidth = sh.type === 'bolt' ? 2.6 : 1.6; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sh.x - Math.cos(ang) * len, sh.y - Math.sin(ang) * len);
      ctx.lineTo(sh.x, sh.y); ctx.stroke();
      if (sh.type === 'bolt') { ctx.fillStyle = '#9aa3ad'; ctx.beginPath(); ctx.arc(sh.x, sh.y, 2.2, 0, 6.283); ctx.fill(); }
    }
  }

  /* частицы */
  for (var p = 0; p < G.parts.length; p++) {
    var q = G.parts[p];
    ctx.globalAlpha = Math.max(0, q.life / q.max);
    ctx.fillStyle = q.color;
    ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 6.283); ctx.fill();
  }
  ctx.globalAlpha = 1;

  /* индикатор урона по замку */
  if (G.flash > 0) {
    ctx.fillStyle = 'rgba(170,40,30,' + (G.flash * 0.35) + ')';
    ctx.fillRect(0, 0, W, H);
  }
}

/* ================= UI ================= */
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('on');
  UI.toastT = 1.8;
}

function buildRail() {
  rail.innerHTML = '';
  ['archer', 'ballista', 'frost', 'mage'].forEach(function (key) {
    var sp = SIM.TOWERS[key];
    var b = document.createElement('button');
    b.className = 'tbtn'; b.dataset.type = key;
    b.innerHTML = '<span class="ic">' + ICONS[key] + '</span><span class="nm">' + sp.name + '</span><span class="pr">' + sp.cost + '</span>';
    b.addEventListener('click', function (ev) {
      ev.preventDefault(); ev.stopPropagation();
      if (UI.placing === key) { UI.placing = null; UI.ghost = null; toast('Постройка отменена'); }
      else {
        if (G.gold < sp.cost) { toast('Не хватает золота: нужно ' + sp.cost); Platform.haptic('error'); return; }
        UI.placing = key; UI.sel = null;
        toast(sp.name + ': тапни по траве рядом с тропой');
      }
      updateUI();
    });
    rail.appendChild(b);
  });
}

function updateUI() {
  el.gold.textContent = G.gold;
  el.lives.textContent = G.lives;
  el.wave.textContent = Math.min(G.wave, SIM.WAVES) + '/' + SIM.WAVES;
  el.speed.textContent = '×' + UI.speed;

  var btns = rail.querySelectorAll('.tbtn');
  for (var i = 0; i < btns.length; i++) {
    var k = btns[i].dataset.type;
    btns[i].classList.toggle('sel', UI.placing === k);
    btns[i].classList.toggle('poor', G.gold < SIM.TOWERS[k].cost);
  }

  if (G.phase === 'build' && G.wave < SIM.WAVES) {
    el.waveBtn.textContent = 'Начать волну ' + (G.wave + 1) + ' · ' + Math.ceil(Math.max(0, G.buildLeft));
    el.waveBtn.classList.add('wait');
  } else if (G.phase === 'wave') {
    el.waveBtn.textContent = 'Волна ' + G.wave + ' идёт · осталось ' + (G.queue.length + G.enemies.length);
    el.waveBtn.classList.remove('wait');
  } else {
    el.waveBtn.textContent = G.phase === 'win' ? 'Замок выстоял' : 'Замок пал';
    el.waveBtn.classList.add('wait');
  }

  /* панель башни */
  var t = null;
  for (var j = 0; j < G.towers.length; j++) if (G.towers[j].id === UI.sel) t = G.towers[j];
  if (!t) { panel.classList.add('hidden'); return; }
  panel.classList.remove('hidden');
  var sp = SIM.TOWERS[t.type];
  el.tpName.textContent = sp.name + ' · ур. ' + t.lvl;
  el.tpStats.innerHTML = 'Урон ' + t.st.dmg + ' · ' + t.st.rate.toFixed(1) + '/с · радиус ' + t.st.range.toFixed(1) +
    (t.st.splash ? ' · по площади' : '') + (t.st.slow ? ' · замедление' : '');
  if (t.lvl < 3) {
    el.up.disabled = G.gold < SIM.upCost(t);
    el.up.textContent = 'Улучшить · ' + SIM.upCost(t);
  } else {
    el.up.disabled = true; el.up.textContent = 'Максимум';
  }
  el.sell.textContent = 'Продать · ' + Math.round(t.spent * 0.5);
}

/* ================= ввод ================= */
function toField(cx, cy) {
  var r = cv.getBoundingClientRect();
  var k = Math.min(r.width / W, r.height / H);
  var ox = (r.width - W * k) / 2, oy = (r.height - H * k) / 2;
  return { x: (cx - r.left - ox) / k, y: (cy - r.top - oy) / k };
}

function cellOf(ev) {
  var p = toField(ev.clientX, ev.clientY);
  return { c: Math.floor(p.x / CELL), r: Math.floor(p.y / CELL) };
}

cv.addEventListener('pointerdown', function (ev) {
  ev.preventDefault();
  var cell = cellOf(ev);
  if (cell.c < 0 || cell.c >= COLS || cell.r < 0 || cell.r >= ROWS) return;
  if (UI.placing) {
    var res = SIM.placeTower(G, cell.c, cell.r, UI.placing);
    if (!res.ok) { toast(res.why); Platform.haptic('error'); }
    else {
      Platform.haptic('medium');
      UI.sel = res.tower.id;
      if (G.gold < SIM.TOWERS[UI.placing].cost) UI.placing = null;
    }
    UI.ghost = null;
  } else {
    var t = SIM.towerAt(G, cell.c, cell.r);
    UI.sel = t ? t.id : null;
    if (t) { Platform.haptic('light'); }
  }
  updateUI(); render();
});

cv.addEventListener('pointermove', function (ev) {
  if (!UI.placing) { if (UI.ghost) { UI.ghost = null; } return; }
  var cell = cellOf(ev);
  if (cell.c >= 0 && cell.c < COLS && cell.r >= 0 && cell.r < ROWS) UI.ghost = cell;
  render();
});

el.waveBtn.addEventListener('click', function () {
  if (G.phase !== 'build') return;
  SIM.startWave(G);
  Platform.haptic('heavy');
  updateUI(); render();
});

el.speed.addEventListener('click', function () {
  UI.speed = UI.speed === 1 ? 2 : UI.speed === 2 ? 3 : 1;
  updateUI();
});

el.up.addEventListener('click', function () {
  if (UI.sel == null) return;
  var r = SIM.upgrade(G, UI.sel);
  if (!r.ok) toast(r.why); else Platform.haptic('success');
  updateUI(); render();
});

el.sell.addEventListener('click', function () {
  if (UI.sel == null) return;
  var r = SIM.sell(G, UI.sel);
  if (r.ok) { toast('Продано · +' + r.refund); UI.sel = null; }
  updateUI(); render();
});

el.ovBtn.addEventListener('click', function () { restart(); });

function showOverlay() {
  var win = G.phase === 'win';
  el.stars.textContent = win ? '★'.repeat(G.stars) + '☆'.repeat(3 - G.stars) : '';
  el.ovTitle.textContent = win ? 'Замок выстоял!' : 'Замок пал';
  el.ovText.textContent = win
    ? 'Волн: ' + G.wave + ' · Убито: ' + G.kills + ' · Жизней: ' + G.lives
    : 'Орки прорвались на волне ' + G.wave + ' · Убито: ' + G.kills;
  overlay.classList.remove('hidden');
  if (G.stars > UI.record) {
    UI.record = G.stars;
    try { Platform.save({ bestStars: UI.record, lastWave: G.wave }); } catch (e) {}
  }
  Platform.haptic(win ? 'success' : 'error');
}

function restart() {
  G = SIM.newGame((Date.now() & 0x7fffffff) || 11);
  UI.sel = null; UI.placing = null; UI.ghost = null;
  overlay.classList.add('hidden');
  updateUI(); render();
  toast('Выбери башню внизу и поставь рядом с тропой');
}

/* ================= цикл ================= */
var last = performance.now(), acc = 0, stepH = 1 / 60;
function frame(now) {
  var dt = (now - last) / 1000; last = now;
  if (dt > 0.3) dt = 0.3;
  acc += dt * UI.speed;
  var guard = 0;
  while (acc >= stepH && guard++ < 14) { SIM.step(G, stepH); acc -= stepH; }
  render();
  UI.hudT += dt;
  if (UI.hudT > 0.1) { UI.hudT = 0; updateUI(); }
  if (UI.toastT > 0) { UI.toastT -= dt; if (UI.toastT <= 0) toastEl.classList.remove('on'); }
  if ((G.phase === 'win' || G.phase === 'lose') && overlay.classList.contains('hidden')) showOverlay();
  requestAnimationFrame(frame);
}

/* ================= старт ================= */
Platform.ready();
bake();
buildRail();
updateUI();
render();
requestAnimationFrame(frame);
setTimeout(function () { toast('Выбери башню внизу и поставь рядом с тропой'); }, 600);

/* API для проверки/баланса */
window.Game = {
  get G() { return G; },
  SIM: SIM, UI: UI,
  render: render, updateUI: updateUI, restart: restart,
  stepMany: function (n, h) {
    h = h || 1 / 60;
    for (var i = 0; i < n; i++) SIM.step(G, h);
    render(); updateUI();
  },
  balance: function (n, opt) { return SIM.simulateMany(n || 40, opt); },
  cellOf: function (c, r) {
    var rect = cv.getBoundingClientRect();
    var k = Math.min(rect.width / W, rect.height / H);
    var ox = (rect.width - W * k) / 2, oy = (rect.height - H * k) / 2;
    return { x: rect.left + ox + (c + 0.5) * CELL * k, y: rect.top + oy + (r + 0.5) * CELL * k };
  }
};
})();
