/* view.js — рендер (изометрия 2:1), ввод, UI. Логика в sim.js, спрайты в sprites.js. */
(function () {
'use strict';

var CELL = SIM.CELL, COLS = SIM.COLS, ROWS = SIM.ROWS;
var W = COLS * CELL, H = ROWS * CELL;         // виртуальный размер поля (не экранный)
var VW = 400, VH = 640;                        // холст = площадь поля (логические px)
var K = 1;                                     // пикселей на мировую единицу
var U = 40;                                    // сторона клетки на экране (K * CELL)

var cv = document.getElementById('cv');
var DPR = Math.min(2, window.devicePixelRatio || 1);
var ctx = cv.getContext('2d');

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
  stars: document.getElementById('winStars'),
  brTitle: document.getElementById('brTitle'), brCount: document.getElementById('brCount'),
  brIcons: document.getElementById('brIcons'), brDef: document.getElementById('brDef'),
  waveTrack: document.getElementById('waveTrack'),
  stTowers: document.getElementById('stTowers'), stDps: document.getElementById('stDps'), stGold: document.getElementById('stGold')
};

window.__errs = [];
window.addEventListener('error', function (e) { window.__errs.push(String(e.message || e.error)); });
window.addEventListener('unhandledrejection', function (e) { window.__errs.push('rej: ' + e.reason); });

var G = SIM.newGame((Date.now() & 0x7fffffff) || 7);
var UI = { placing: null, sel: null, ghost: null, speed: 1, toastT: 0, hudT: 0, record: 0 };
try { UI.record = (Platform.load() || {}).bestStars || 0; } catch (e) {}

var ORDER = Object.keys(SIM.TOWERS).sort(function (a, b) { return SIM.TOWERS[a].cost - SIM.TOWERS[b].cost; });

function prand(i) { var x = Math.sin(i * 127.1 + 0.5) * 43758.5453; return x - Math.floor(x); }

/* ================= проекция: ровная сетка ================= */
var OX = 0, OY = 0;
function iso(wx, wy) { return { x: OX + wx * K, y: OY + wy * K }; }
function unIso(sx, sy) { return { x: (sx - OX) / K, y: (sy - OY) / K }; }
function cellCenter(c, r) { return { x: (c + 0.5) * CELL, y: (r + 0.5) * CELL }; }

/* ================= поле ================= */
var FIELD = null;
var BK = 2;

function diamond(g, c, r, fill, stroke) {
  var p = iso(c * CELL, r * CELL);
  var q = iso((c + 1) * CELL, r * CELL);
  var s = iso((c + 1) * CELL, (r + 1) * CELL);
  var t = iso(c * CELL, (r + 1) * CELL);
  /* клетка = ровный квадрат: углы клетки, без вписанного ромба */
  var pad = Math.max(0.5, U * 0.02);
  g.beginPath();
  g.moveTo(p.x + pad, p.y + pad);
  g.lineTo(q.x - pad, q.y + pad);
  g.lineTo(s.x - pad, s.y - pad);
  g.lineTo(t.x + pad, t.y - pad);
  g.closePath();
  g.fillStyle = fill; g.fill();
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1; g.stroke(); }
}

function bake() {
  var b = document.createElement('canvas');
  b.width = VW * BK; b.height = VH * BK;
  var g = b.getContext('2d');
  g.scale(BK, BK); g.lineJoin = 'round'; g.lineCap = 'round';

  /* газон под всей сценой */
  var grd = g.createLinearGradient(0, 0, 0, VH);
  grd.addColorStop(0, '#6fb746'); grd.addColorStop(1, '#7ec850');
  g.fillStyle = grd; g.fillRect(0, 0, VW, VH);
  for (var i = 0; i < 40; i++) {
    var px = prand(i * 3.1) * VW, py = prand(i * 7.7 + 2) * VH, rad = 22 + prand(i * 1.7) * 40;
    g.fillStyle = i % 2 ? 'rgba(48,104,34,.10)' : 'rgba(255,255,255,.06)';
    g.beginPath(); g.ellipse(px, py, rad, rad * 0.55, 0, 0, 6.283); g.fill();
  }

  /* клетки */
  for (var c = 0; c < COLS; c++) for (var r = 0; r < ROWS; r++) {
    var key = c + ',' + r;
    var isPath = !!SIM.PATH_CELLS[key];
    diamond(g, c, r, isPath ? (((c + r) % 2) ? '#d3ac76' : '#c9a06b')
      : (((c + r) % 2) ? '#86cf57' : '#75bd46'), 'rgba(28,60,18,.16)');
  }

  /* тропа поверх клеток — мягкая лента */
  g.save();
  g.beginPath();
  var first = iso(SIM.PATH[0].x, SIM.PATH[0].y);
  g.moveTo(first.x, first.y);
  for (var k = 1; k < SIM.PATH.length; k++) {
    var q = iso(SIM.PATH[k].x, SIM.PATH[k].y);
    g.lineTo(q.x, q.y);
  }
  g.strokeStyle = 'rgba(140,104,58,.55)'; g.lineWidth = U * 0.58; g.stroke();
  g.strokeStyle = '#c9a06b'; g.lineWidth = U * 0.48; g.stroke();
  g.restore();

  /* декор по всей поляне (за пределами клеток — просто украшение) */
  var extra = [[1,0],[6,0],[0,2],[7,6],[0,9],[2,11],[6,9],[4,6],[3,3],[5,8],[1,11],[6,2],[-1,3],[8,4],[-1,7],[8,8],[3,-1],[4,12]];
  extra.forEach(function (d, idx) {
    if (SIM.PATH_CELLS[d[0] + ',' + d[1]]) return;
    var p0 = iso((d[0] + 0.5) * CELL, (d[1] + 0.5) * CELL);
    var sp0 = idx % 3 === 0 ? SPR.DECOR.pine : idx % 3 === 1 ? SPR.DECOR.oak : SPR.DECOR.bush;
    SPR.put(g, sp0, p0.x, p0.y, idx % 3 === 2 ? 0.5 : 0.58);
  });

  /* декор клеток */
  SIM.DECOR.forEach(function (d, idx) {
    var p = iso((d[0] + 0.5) * CELL, (d[1] + 0.5) * CELL);
    var kind = idx % 4;
    var spr = kind === 0 ? SPR.DECOR.oak : kind === 1 ? SPR.DECOR.pine : kind === 2 ? SPR.DECOR.rock : SPR.DECOR.bush;
    SPR.put(g, spr, p.x, p.y, kind < 2 ? 0.62 : 0.6);
  });

  /* замок у конца тропы */
  var end = iso(SIM.PATH[SIM.PATH.length - 1].x, SIM.PATH[SIM.PATH.length - 1].y);
  SPR.put(g, SPR.CASTLE, end.x, end.y + U * 0.55, 0.52);

  /* виньетка */
  var vg = g.createRadialGradient(VW / 2, VH * 0.5, VH * 0.25, VW / 2, VH * 0.5, VH * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(18,40,14,.22)');
  g.fillStyle = vg; g.fillRect(0, 0, VW, VH);

  FIELD = b;
}

/* ================= объекты ================= */
var TSC = 1.0, ESC = 0.86;       /* масштабы спрайтов: под размер клетки */

function drawTower(g, t, ghost) {
  var spr = SPR.TOWER[t.type];
  if (!spr) return;
  var bob = t.recoil ? t.recoil * 1.4 : 0;
  var p = iso(t.x, t.y);
  g.fillStyle = 'rgba(0,0,0,.22)';
  g.beginPath(); g.ellipse(p.x, p.y + U * 0.13, U * 0.36, U * 0.14, 0, 0, 6.283); g.fill();
  g.save();
  if (ghost) g.globalAlpha = 0.55;
  SPR.put(g, spr, p.x, p.y + U * 0.16 + bob, TSC);
  g.restore();
  var lvl = t.lvl || 1;
  for (var l = 0; l < lvl; l++) {
    var lx = p.x - (lvl - 1) * 2.8 + l * 5.6, ly = p.y + U * 0.42;
    g.fillStyle = '#f0cf78';
    g.beginPath(); g.moveTo(lx, ly - 2); g.lineTo(lx + 1.7, ly); g.lineTo(lx, ly + 2); g.lineTo(lx - 1.7, ly); g.closePath(); g.fill();
  }
}

/* полоса рисуется в ЭКРАННЫХ координатах: x — центр, y — верх */
function hpBar(g, cx, y, w, k) {
  var h = 3, x = cx - w / 2;
  g.fillStyle = 'rgba(10,14,8,.78)'; g.fillRect(x - 1, y - 1, w + 2, h + 2);
  g.fillStyle = k > 0.6 ? '#88c94f' : k > 0.3 ? '#e0ad3c' : '#cf4a33';
  g.fillRect(x, y, w * Math.max(0, k), h);
}

function drawEnemy(g, e) {
  var sheet = SPR.ENEMY[e.type];
  if (!sheet) return;
  var fr = (Math.floor(e.wob * 0.35) % 4 + 4) % 4;
  var p = iso(e.x, e.y);
  g.fillStyle = 'rgba(0,0,0,.24)';
  g.beginPath(); g.ellipse(p.x, p.y + U * 0.10, U * 0.21, U * 0.09, 0, 0, 6.283); g.fill();
  SPR.put(g, sheet[fr], p.x, p.y + U * 0.12, ESC);
  if (e.slowT > 0) {
    g.save(); g.globalAlpha = 0.4; g.fillStyle = 'rgba(150,220,255,.6)';
    g.beginPath(); g.ellipse(p.x, p.y - e.r * ESC, e.r * ESC * 1.1, e.r * ESC * 1.5, 0, 0, 6.283); g.fill();
    g.restore();
  }
  if (e.type === 'boss') {
    var bw = Math.max(40, e.r * ESC * 3), bh = 5;
    var bx = Math.min(VW - bw - 5, Math.max(5, p.x - bw / 2)), by = Math.max(6, p.y - e.r * ESC * 2.4);
    g.fillStyle = 'rgba(12,10,6,.75)'; g.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
    var grd2 = g.createLinearGradient(bx, 0, bx + bw, 0);
    grd2.addColorStop(0, '#cf4a33'); grd2.addColorStop(1, '#f0a05a');
    g.fillStyle = grd2; g.fillRect(bx, by, bw * Math.max(0, e.hp / e.maxHp), bh);
  } else {
    var cc = Math.floor(e.x / CELL), rr2 = Math.floor(e.y / CELL);
    if (cc >= 0 && cc < COLS && rr2 >= 0 && rr2 < ROWS) {
      hpBar(g, p.x, p.y - e.r * ESC * 2.2, Math.max(14, e.r * ESC * 2.4), e.hp / e.maxHp);
    }
  }
}

/* ================= сцена ================= */
/* ломаная молния между двумя точками */
function boltPath(g, x1, y1, x2, y2) {
  var dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
  var nx = -dy / len, ny = dx / len, seg = Math.max(3, Math.round(len / 22));
  g.beginPath(); g.moveTo(x1, y1);
  for (var i = 1; i < seg; i++) {
    var t = i / seg, j = (Math.sin(i * 12.9898 + x1 * 0.7) * 43758.5453) % 1;
    var off = (j - Math.round(j)) * 9;
    g.lineTo(x1 + dx * t + nx * off, y1 + dy * t + ny * off);
  }
  g.lineTo(x2, y2);
}

function render() {
  ctx.clearRect(0, 0, VW, VH);
  ctx.save();
  if (FX.shx || FX.shy) ctx.translate(FX.shx, FX.shy);
  if (FIELD) ctx.drawImage(FIELD, 0, 0, VW, VH);

  /* радиус выбранной башни — эллипс в изометрии */
  var showR = null, rp = null;
  if (UI.placing && UI.ghost) {
    showR = SIM.towerStats(UI.placing, 1).range;
    rp = iso((UI.ghost.c + 0.5) * CELL, (UI.ghost.r + 0.5) * CELL);
  } else if (UI.sel != null) {
    for (var i = 0; i < G.towers.length; i++) if (G.towers[i].id === UI.sel) { showR = G.towers[i].st.range; rp = iso(G.towers[i].x, G.towers[i].y); }
  }
  if (showR != null && rp) {
    var rx = showR * U, ry = showR * U;
    ctx.save();
    ctx.beginPath(); ctx.ellipse(rp.x, rp.y, rx, ry, 0, 0, 6.283);
    ctx.fillStyle = 'rgba(224,182,78,.09)'; ctx.fill();
    ctx.setLineDash([5, 5]); ctx.lineWidth = 1.3; ctx.strokeStyle = 'rgba(224,182,78,.5)'; ctx.stroke();
    ctx.restore();
  }

  /* все свободные места под башни — видны во время постановки */
  if (UI.placing) {
    for (var si = 0; si < SIM.SPOTS.length; si++) {
      var sp0 = SIM.SPOTS[si];
      if (!SIM.cellFree(G, sp0.c, sp0.r)) continue;
      diamond(ctx, sp0.c, sp0.r, 'rgba(255,255,255,.10)', 'rgba(206,244,158,.55)');
      var ctr = iso((sp0.c + 0.5) * CELL, (sp0.r + 0.5) * CELL);
      ctx.fillStyle = 'rgba(214,246,168,.75)';
      ctx.beginPath(); ctx.arc(ctr.x, ctr.y, 2.2, 0, 6.283); ctx.fill();
    }
  }

  /* подсветка клетки при постановке */
  if (UI.placing && UI.ghost) {
    var ok = SIM.cellFree(G, UI.ghost.c, UI.ghost.r) && G.gold >= SIM.TOWERS[UI.placing].cost;
    diamond(ctx, UI.ghost.c, UI.ghost.r, ok ? 'rgba(120,230,140,.35)' : 'rgba(220,70,50,.35)', 'rgba(255,255,255,.35)');
  }

  /* сборка списка по глубине */
  var items = [];
  G.towers.forEach(function (t) { items.push({ d: t.x + t.y, kind: 'tower', o: t }); });
  G.enemies.forEach(function (e) { items.push({ d: e.x + e.y + 1, kind: 'enemy', o: e }); });
  if (UI.placing && UI.ghost) {
    var gh = { type: UI.placing, x: (UI.ghost.c + 0.5) * CELL, y: (UI.ghost.r + 0.5) * CELL, lvl: 1, recoil: 0 };
    items.push({ d: gh.x + gh.y, kind: 'ghost', o: gh });
  }
  items.sort(function (a, b) { return a.d - b.d; });
  items.forEach(function (it) {
    if (it.kind === 'tower') drawTower(ctx, it.o, false);
    else if (it.kind === 'ghost') drawTower(ctx, it.o, true);
    else drawEnemy(ctx, it.o);
  });

  /* снаряды */
  for (var s = 0; s < G.shots.length; s++) {
    var sh = G.shots[s];
    var sp = iso(sh.x, sh.y);
    if (sh.type === 'ice') {
      ctx.globalAlpha = Math.max(0, Math.min(1, sh.life * 6));
      SPR.shot(ctx, SPR.SHOT.ice, sp.x, sp.y, 0, 0.85);
      ctx.globalAlpha = 1;
      continue;
    }
    if (sh.type === 'zap') {
      var o = iso(sh.ox != null ? sh.ox : sh.x, sh.oy != null ? sh.oy : sh.y);
      var e2 = iso(sh.x, sh.y);
      var a2 = Math.max(0, Math.min(1, sh.life * 4));
      ctx.save();
      ctx.globalAlpha = a2;
      ctx.strokeStyle = 'rgba(150,215,255,.55)'; ctx.lineWidth = 4.5; ctx.lineJoin = 'round';
      boltPath(ctx, o.x, o.y, e2.x, e2.y);
      ctx.stroke();
      ctx.strokeStyle = '#eaf6ff'; ctx.lineWidth = 1.6;
      boltPath(ctx, o.x, o.y, e2.x, e2.y);
      ctx.stroke();
      ctx.globalAlpha = a2 * 0.9; ctx.fillStyle = '#dff2ff';
      ctx.beginPath(); ctx.arc(e2.x, e2.y, 3.2, 0, 6.283); ctx.fill();
      ctx.restore();
      continue;
    }
    var t2 = iso(sh.tx, sh.ty);
    var ang = Math.atan2(t2.y - sp.y, t2.x - sp.x);
    SPR.shot(ctx, SPR.SHOT[sh.type] || SPR.SHOT.arrow, sp.x, sp.y, ang, 0.95);
  }

  /* кольца взрывов */
  for (var rr = 0; rr < G.rings.length; rr++) {
    var rn = G.rings[rr], a = Math.max(0, rn.life / rn.t);
    var cp = iso(rn.x, rn.y);
    ctx.strokeStyle = 'rgba(255,196,110,' + (a * 0.7) + ')';
    ctx.lineWidth = 2 * a + 0.6;
    ctx.beginPath(); ctx.arc(cp.x, cp.y, rn.r * K, 0, 6.283); ctx.stroke();
  }

  /* частицы */
  for (var p2 = 0; p2 < G.parts.length; p2++) {
    var q2 = G.parts[p2], qp = iso(q2.x, q2.y);
    ctx.globalAlpha = Math.max(0, q2.life / q2.max);
    ctx.fillStyle = q2.color;
    ctx.beginPath(); ctx.arc(qp.x, qp.y, q2.r, 0, 6.283); ctx.fill();
  }
  ctx.globalAlpha = 1;

  for (var pz2 = 0; pz2 < (G.pops || []).length; pz2++) {
    var pp2 = G.pops[pz2], ppos = iso(pp2.x, pp2.y);
    var al = Math.max(0, pp2.life / pp2.max);
    ctx.globalAlpha = al;
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(20,26,14,.85)';
    ctx.strokeText(pp2.txt, ppos.x, ppos.y);
    ctx.fillStyle = '#ffe07a';
    ctx.fillText(pp2.txt, ppos.x, ppos.y);
    ctx.globalAlpha = 1;
  }

  ctx.restore();

  if (G.flash > 0) {
    ctx.fillStyle = 'rgba(170,40,30,' + (G.flash * 0.3) + ')';
    ctx.fillRect(0, 0, VW, VH);
  }
}

/* ================= UI ================= */
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('on');
  UI.toastT = 2.2;
}

function railIcon(key) {
  var spr = SPR.TOWER[key];
  var w = 38, h = 46, c = document.createElement('canvas');
  c.width = w * 2; c.height = h * 2;
  var g = c.getContext('2d'); g.scale(2, 2);
  var sc = Math.min((w - 6) / spr.w, (h - 6) / spr.h) * 1.5;
  g.translate(w / 2, h - 5);
  g.drawImage(spr.c, -spr.gx * sc, -spr.gy * sc, spr.w * sc, spr.h * sc);
  return c;
}

function enemyIcon(type) {
  var spr = SPR.ENEMY[type][0];
  var w = 26, h = 30, c = document.createElement('canvas');
  c.width = w * 2; c.height = h * 2;
  var g = c.getContext('2d'); g.scale(2, 2);
  var sc = Math.min((w - 3) / spr.w, (h - 3) / spr.h) * 1.12;
  var gx = spr.gx != null ? spr.gx : spr.w / 2;
  var gy = spr.gy != null ? spr.gy : spr.h;
  g.translate(w / 2, h - 4);
  g.drawImage(spr.c, -gx * sc, -gy * sc, spr.w * sc, spr.h * sc);
  return c;
}

var briefWave = -1;
function updateBrief() {
  if (!el.stTowers) return;
  var nx = G.phase === 'wave' ? G.wave : Math.min(SIM.WAVES, G.wave + 1);
  var def = SIM.WAVEDEF[nx - 1];
  el.brTitle.textContent = G.phase === 'wave' ? 'Идёт волна ' + nx : 'Следующая волна ' + nx;
  if (UI.trackWave !== nx) {
    UI.trackWave = nx;
    var tr = '';
    for (var w2 = 1; w2 <= SIM.WAVES; w2++) tr += '<i class="' + (w2 < nx ? 'done' : w2 === nx ? 'now' : '') + '"></i>';
    el.waveTrack.innerHTML = tr;
  }
  if (nx !== briefWave) {
    briefWave = nx;
    el.brIcons.innerHTML = '';
    if (def) {
      var total = 0;
      def.groups.forEach(function (grp) {
        total += grp.n;
        var ic = document.createElement('span');
        ic.className = 'br-ic';
        ic.appendChild(enemyIcon(grp.t));
        var nn = document.createElement('b'); nn.textContent = '×' + grp.n;
        ic.appendChild(nn);
        el.brIcons.appendChild(ic);
      });
      el.brCount.textContent = total + ' врагов';
    }
  }
  var dps = 0;
  for (var i = 0; i < G.towers.length; i++) dps += G.towers[i].st.dmg * G.towers[i].st.rate;
  var lv = { 1: 'ур.1', 2: 'ур.2', 3: 'ур.3' }, byLv = {};
  for (var k = 0; k < G.towers.length; k++) byLv[G.towers[k].lvl] = (byLv[G.towers[k].lvl] || 0) + 1;
  var parts = [];
  for (var L in byLv) parts.push((lv[L] || L) + '×' + byLv[L]);
  el.brDef.textContent = G.towers.length ? parts.join(' · ') : 'пусто';
  el.stTowers.textContent = G.towers.length;
  el.stDps.textContent = Math.round(dps);
  el.stGold.textContent = Math.floor(G.gold);
}

function buildRail() {
  rail.innerHTML = '';
  ORDER.forEach(function (key) {
    var sp = SIM.TOWERS[key];
    var b = document.createElement('button');
    b.className = 'tbtn'; b.dataset.type = key;
    b.appendChild(railIcon(key));
    var nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = sp.name;
    var pr = document.createElement('span'); pr.className = 'pr'; pr.textContent = sp.cost;
    b.appendChild(nm); b.appendChild(pr);
    b.addEventListener('click', function (ev) {
      ev.preventDefault(); ev.stopPropagation();
      if (UI.placing === key) { UI.placing = null; UI.ghost = null; toast('Постройка отменена'); }
      else {
        if (G.gold < sp.cost) { toast('Не хватает золота: нужно ' + sp.cost); Platform.haptic('error'); return; }
        UI.placing = key; UI.sel = null;
        toast('Тапни по траве у тропы');
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
  var canBuild = G.phase === 'build' && G.gold >= SIM.TOWERS[ORDER[0]].cost && !UI.placing;
  rail.classList.toggle('nudge', canBuild);

  el.waveBtn.classList.remove('wait', 'early');
  if (G.phase === 'build' && G.wave < SIM.WAVES) {
    el.waveBtn.textContent = 'В бой · волна ' + (G.wave + 1) + ' · ' + SIM.waveCount(G.wave + 1) + ' врагов (' + Math.ceil(Math.max(0, G.buildLeft)) + ')';
    el.waveBtn.classList.add('wait');
  } else if (G.phase === 'wave' && G.wave < SIM.WAVES) {
    el.waveBtn.textContent = 'Рано волну ' + (G.wave + 1) + ' · +' + SIM.earlyBonus(G.wave + 1);
    el.waveBtn.classList.add('early');
  } else if (G.phase === 'wave') {
    el.waveBtn.textContent = 'Волна ' + G.wave + ' идёт · осталось ' + (G.queue.length + G.enemies.length);
    el.waveBtn.classList.add('wait');
  } else {
    el.waveBtn.textContent = G.phase === 'win' ? 'Замок выстоял' : 'Замок пал';
    el.waveBtn.classList.add('wait');
  }

  updateBrief();

  var t = null;
  for (var j = 0; j < G.towers.length; j++) if (G.towers[j].id === UI.sel) t = G.towers[j];
  if (!t) { panel.classList.add('hidden'); return; }
  panel.classList.remove('hidden');
  var sp = SIM.TOWERS[t.type], st = t.st;
  var dps = Math.round(st.dmg * st.rate);
  el.tpName.textContent = sp.name + ' · ' + t.lvl + (t.lvl < 3 ? '→' + (t.lvl + 1) : ' макс.');
  var cur = 'Сейчас: ' + st.dmg + ' · ' + dps + ' DPS · ' + st.range.toFixed(1) +
    (st.splash ? ' · АоЕ' : '') + (st.slow ? ' · ' + Math.round(st.slow * 100) + '%' : '');
  if (t.lvl < 3) {
    var nx = SIM.towerStats(t.type, t.lvl + 1);
    var ndps = Math.round(nx.dmg * nx.rate);
    el.tpStats.innerHTML = cur + '<br><b class="nx">После: ' + nx.dmg + ' (+' + (nx.dmg - st.dmg) + ') · ' +
      ndps + ' DPS · ' + nx.range.toFixed(1) + '</b>';
    el.up.disabled = G.gold < SIM.upCost(t);
    el.up.textContent = 'Улучшить · ' + SIM.upCost(t);
  } else {
    el.tpStats.innerHTML = cur;
    el.up.disabled = true; el.up.textContent = 'Максимум';
  }
  el.sell.textContent = 'Продать · ' + Math.round(t.spent * 0.5);
}

/* ================= ввод ================= */
function toField(cx, cy) {
  var r = cv.getBoundingClientRect();
  var k = Math.min(r.width / VW, r.height / VH);
  var ox = (r.width - VW * k) / 2, oy = (r.height - VH * k) / 2;
  return unIso((cx - r.left - ox) / k, (cy - r.top - oy) / k);
}
function cellOf(ev) {
  var p = toField(ev.clientX, ev.clientY);
  return { c: Math.floor(p.x / CELL), r: Math.floor(p.y / CELL) };
}
/* тап «прощает» промах: берём ближайшую свободную клетку в радиусе */
function nearestFreeCell(px, py, rad) {
  var best = null, bd = 1e9;
  for (var c = 0; c < COLS; c++) for (var r = 0; r < ROWS; r++) {
    if (!SIM.cellFree(G, c, r)) continue;
    var cc = cellCenter(c, r), d = Math.hypot(cc.x - px, cc.y - py);
    if (d < bd) { bd = d; best = { c: c, r: r }; }
  }
  return (best && bd <= rad * CELL) ? best : null;
}
function nearestTower(px, py, rad) {
  var best = null, bd = 1e9;
  for (var i = 0; i < G.towers.length; i++) {
    var t = G.towers[i], d = Math.hypot(t.x - px, t.y - py);
    if (d < bd) { bd = d; best = t; }
  }
  return (best && bd <= rad * CELL) ? best : null;
}

cv.addEventListener('pointerdown', function (ev) {
  ev.preventDefault();
  audioInit();
  var f = toField(ev.clientX, ev.clientY);
  var cell = cellOf(ev);
  var inMap = cell.c >= 0 && cell.c < COLS && cell.r >= 0 && cell.r < ROWS;
  if (UI.placing) {
    var ofree = inMap && SIM.cellFree(G, cell.c, cell.r);
    var snap = ofree ? null : nearestFreeCell(f.x, f.y, 2.4);
    if (snap) cell = snap;
    else if (!ofree) {
      var tw0 = nearestTower(f.x, f.y, 1.6);
      if (tw0) { UI.sel = tw0.id; UI.placing = null; UI.ghost = null; Platform.haptic('light'); updateUI(); render(); return; }
      toast('Тапни ближе к тропе — там встанет башня');
      Platform.haptic('error'); return;
    }
  }
  if (!inMap && !UI.placing) {
    var tw1 = nearestTower(f.x, f.y, 1.6);
    UI.sel = tw1 ? tw1.id : null;
    if (tw1) Platform.haptic('light');
    updateUI(); render(); return;
  }
  if (cell.c < 0 || cell.c >= COLS || cell.r < 0 || cell.r >= ROWS) return;
  if (UI.placing) {
    var existing = SIM.towerAt(G, cell.c, cell.r);
    if (existing) {
      UI.sel = existing.id; UI.placing = null; UI.ghost = null;
      Platform.haptic('light'); updateUI(); render(); return;
    }
    var res = SIM.placeTower(G, cell.c, cell.r, UI.placing);
    if (!res.ok) { toast(res.why); Platform.haptic('error'); }
    else {
      Platform.haptic('medium');
      SFX.build();
      UI.sel = null;
      if (G.gold < SIM.TOWERS[UI.placing].cost) { UI.placing = null; toast('Золото кончилось — ждём волну'); }
    }
    UI.ghost = null;
  } else {
    var t = SIM.towerAt(G, cell.c, cell.r);
    UI.sel = t ? t.id : null;
    if (t) Platform.haptic('light');
  }
  updateUI(); render();
});

cv.addEventListener('pointermove', function (ev) {
  if (!UI.placing) { if (UI.ghost) { UI.ghost = null; render(); } return; }
  var f = toField(ev.clientX, ev.clientY), cell = cellOf(ev);
  var ok = cell.c >= 0 && cell.c < COLS && cell.r >= 0 && cell.r < ROWS && SIM.cellFree(G, cell.c, cell.r);
  if (!ok) { var sn = nearestFreeCell(f.x, f.y, 2.4); if (sn) cell = sn; }
  if (cell.c >= 0 && cell.c < COLS && cell.r >= 0 && cell.r < ROWS) UI.ghost = cell;
  render();
});

el.waveBtn.addEventListener('click', function () {
  if (G.phase === 'build') { SIM.startWave(G); Platform.haptic('heavy'); SFX.wave(); }
  else if (G.phase === 'wave' && G.wave < SIM.WAVES) {
    var r = SIM.startWave(G, true);
    if (r.ok) { toast('Волна ' + G.wave + ' досрочно · +' + r.bonus + ' золота'); Platform.haptic('success'); }
  }
  updateUI(); render();
});

var sndBtn = document.getElementById('btnSnd');
if (sndBtn) {
  sndBtn.addEventListener('click', function () {
    audioInit();
    muted = !muted;
    sndBtn.classList.toggle('off', muted);
    sndBtn.textContent = muted ? '♪̸' : '♪';
    try { localStorage.setItem('ork_td_mute', muted ? '1' : '0'); } catch (e) {}
    if (!muted) SFX.coin();
  });
}

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

/* ================= раскладка ================= */
function fit() {
  var wrap = document.getElementById('fieldWrap');
  if (!wrap) return;
  var w = Math.max(240, wrap.clientWidth), h = Math.max(200, wrap.clientHeight);
  VW = Math.round(w); VH = Math.round(h);
  cv.width = Math.round(VW * DPR); cv.height = Math.round(VH * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  K = Math.min((VW - 8) / W, (VH - 56) / H);
  U = K * CELL;
  OX = (VW - W * K) / 2;
  OY = (VH - H * K) / 2 + 4;
  bake();
}
var fitT = 0;
function layout() {
  clearTimeout(fitT);
  fitT = setTimeout(fit, 60);
}
window.addEventListener('resize', layout);
window.addEventListener('orientationchange', layout);

/* ================= звук (синтез, без файлов) ================= */
var AC = null, muted = false;
try { muted = localStorage.getItem('ork_td_mute') === '1'; } catch (e) {}
(function () {
  var b = document.getElementById('btnSnd');
  if (b) { b.classList.toggle('off', muted); b.textContent = muted ? '♪̸' : '♪'; }
})();
function audioInit() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; }
}
function blip(f1, f2, dur, type, vol) {
  if (!AC || muted) return;
  var t0 = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
  o.type = type || 'square';
  o.frequency.setValueAtTime(f1, t0);
  if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(40, f2), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol || 0.05, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(AC.destination);
  o.start(t0); o.stop(t0 + dur + 0.02);
}
function noise(dur, vol, cut) {
  if (!AC || muted) return;
  var n = Math.floor(AC.sampleRate * dur), buf = AC.createBuffer(1, n, AC.sampleRate), d = buf.getChannelData(0);
  for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  var src = AC.createBufferSource(); src.buffer = buf;
  var f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cut || 900;
  var g = AC.createGain(); g.gain.value = vol || 0.1;
  src.connect(f); f.connect(g); g.connect(AC.destination); src.start();
}
var SFX = {
  arrow: function () { blip(900, 520, 0.06, 'square', 0.022); },
  bolt: function () { blip(320, 150, 0.10, 'sawtooth', 0.04); },
  zap: function () { noise(0.07, 0.07, 2800); blip(1500, 380, 0.09, 'square', 0.025); },
  ice: function () { blip(1250, 900, 0.06, 'sine', 0.025); },
  stone: function () { noise(0.12, 0.09, 700); blip(190, 90, 0.14, 'sine', 0.045); },
  orb: function () { blip(700, 400, 0.08, 'sine', 0.03); },
  coin: function () { blip(1320, 1760, 0.06, 'triangle', 0.03); },
  hurt: function () { blip(230, 85, 0.22, 'sawtooth', 0.06); noise(0.16, 0.07, 520); },
  wave: function () { blip(330, 500, 0.16, 'triangle', 0.045); },
  build: function () { blip(520, 800, 0.09, 'triangle', 0.045); }
};
function sfxPlay(name) { var f = SFX[name]; if (f) f(); }
function drainSfx() {
  if (!G.sfx || !G.sfx.length) return;
  var names = G.sfx.splice(0, G.sfx.length);
  var budget = 4;                       /* не больше 4 звуков на кадр */
  for (var i = 0; i < names.length && budget > 0; i++) { sfxPlay(names[i]); budget--; }
}

/* ================= джус ================= */
/* тряска от «травмы» (trauma^2) и hit-stop — только визуал, логику не трогаем */
var FX = { trauma: 0, stop: 0, t: 0, shx: 0, shy: 0, shake: 1 };
function addTrauma(a) { FX.trauma = Math.min(1, FX.trauma + a); }
function hitStop(ms) { FX.stop = Math.max(FX.stop, ms / 1000); }
function fxTick(real) {
  if (FX.stop > 0) FX.stop = Math.max(0, FX.stop - real);
  FX.trauma = Math.max(0, FX.trauma - real * 1.5);
  var s = FX.trauma * FX.trauma * FX.shake;
  FX.t += real * 30;
  FX.shx = 11 * s * Math.sin(FX.t * 1.7);
  FX.shy = 8 * s * Math.sin(FX.t * 2.3);
}

/* ================= цикл ================= */
var last = performance.now(), acc = 0, stepH = 1 / 60;
var prevKills = 0, prevLives = 0;
function frame(now) {
  var real = (now - last) / 1000; last = now;
  if (real > 0.3) real = 0.3;
  fxTick(real);

  /* hit-stop: время в симуляции провисает, тряска и UI идут по реальному */
  var dt = real * (FX.stop > 0 ? 0.16 : 1);
  if (G.kills > prevKills) {
    addTrauma(G.kills - prevKills > 2 ? 0.3 : 0.16);
    prevKills = G.kills;
  }
  if (G.lives < prevLives) {
    addTrauma(0.62); hitStop(70);
    prevLives = G.lives;
  } else if (G.lives > prevLives) prevLives = G.lives;

  acc += dt * UI.speed;
  var guard = 0;
  while (acc >= stepH && guard++ < 14) { SIM.step(G, stepH); acc -= stepH; }
  drainSfx();
  render();
  UI.hudT += dt;
  if (UI.hudT > 0.1) { UI.hudT = 0; updateUI(); layout(); }
  if (UI.toastT > 0) { UI.toastT -= dt; if (UI.toastT <= 0) toastEl.classList.remove('on'); }
  if ((G.phase === 'win' || G.phase === 'lose') && overlay.classList.contains('hidden')) showOverlay();
  requestAnimationFrame(frame);
}

/* ================= старт ================= */
Platform.ready();
fit();
buildRail();
updateUI();
render();
requestAnimationFrame(frame);
setTimeout(function () { toast('Выбери башню внизу и поставь рядом с тропой'); }, 700);

window.Game = {
  get G() { return G; },
  SIM: SIM, UI: UI, SPR: SPR,
  render: render, updateUI: updateUI, restart: restart, bake: bake,
  stepMany: function (n, h) {
    h = h || 1 / 60;
    for (var i = 0; i < n; i++) SIM.step(G, h);
    render(); updateUI();
  },
  balance: function (n, opt) { return SIM.simulateMany(n || 40, opt); },
  cellOf: function (c, r) {
    var rect = cv.getBoundingClientRect();
    var k = Math.min(rect.width / VW, rect.height / VH);
    var ox = (rect.width - VW * k) / 2, oy = (rect.height - VH * k) / 2;
    var p = iso((c + 0.5) * CELL, (r + 0.5) * CELL);
    return { x: rect.left + ox + p.x * k, y: rect.top + oy + p.y * k };
  }
};
})();
