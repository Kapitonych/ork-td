/* view.js — рендер, ввод, UI. Логика только в sim.js, спрайты в sprites.js. */
(function () {
'use strict';

var CELL = SIM.CELL, COLS = SIM.COLS, ROWS = SIM.ROWS;
var W = COLS * CELL, H = ROWS * CELL;
var BK = 2;                                   // поле печём в 2× — резко на retina

var cv = document.getElementById('cv');
var DPR = Math.min(2, window.devicePixelRatio || 1);
cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
var ctx = cv.getContext('2d');
ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

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

var ICONS = { archer: '🏹', frost: '❄️', ballista: '🎯', mage: '✨' };
var ORDER = Object.keys(SIM.TOWERS).sort(function (a, b) { return SIM.TOWERS[a].cost - SIM.TOWERS[b].cost; });

function prand(i) { var x = Math.sin(i * 127.1 + 0.5) * 43758.5453; return x - Math.floor(x); }

/* ================= поле (печётся один раз) ================= */
var FIELD = null;

function bake() {
  var b = document.createElement('canvas');
  b.width = W * BK; b.height = H * BK;
  var g = b.getContext('2d');
  g.scale(BK, BK); g.lineJoin = 'round'; g.lineCap = 'round';

  /* трава плитками */
  for (var c = 0; c < COLS; c++) for (var r = 0; r < ROWS; r++) {
    var t = SPR.TILES[(c * 3 + r * 7) % 3];
    g.drawImage(t.c, c * CELL, r * CELL, CELL, CELL);
  }
  /* крупные пятна, чтобы не было шахматки */
  for (var i = 0; i < 60; i++) {
    var px = prand(i * 3.1) * W, py = prand(i * 7.7 + 2) * H, rad = 12 + prand(i * 1.7) * 26;
    g.fillStyle = i % 2 ? 'rgba(38,62,32,.30)' : 'rgba(96,130,66,.14)';
    g.beginPath(); g.arc(px, py, rad, 0, 6.283); g.fill();
  }

  /* тропа */
  function trace() {
    g.beginPath(); g.moveTo(SIM.PATH[0].x, SIM.PATH[0].y);
    for (var k = 1; k < SIM.PATH.length; k++) g.lineTo(SIM.PATH[k].x, SIM.PATH[k].y);
  }
  trace(); g.strokeStyle = 'rgba(24,20,12,.55)'; g.lineWidth = 42; g.stroke();
  trace(); g.strokeStyle = '#3a3020'; g.lineWidth = 38; g.stroke();
  trace(); g.strokeStyle = '#6d5837'; g.lineWidth = 32; g.stroke();
  trace(); g.strokeStyle = '#82683f'; g.lineWidth = 24; g.stroke();

  /* фактура земли: пятна и борозды */
  for (var s = 6; s < SIM.TOTAL; s += 9) {
    var p = SIM.posAt(s), q = prand(s * 1.7);
    g.fillStyle = 'rgba(58,44,26,' + (0.10 + q * 0.18) + ')';
    g.beginPath(); g.ellipse(p.x + (q - 0.5) * 24, p.y + (prand(s) - 0.5) * 24, 4 + q * 5, 2.4 + q * 3, q * 3, 0, 6.283); g.fill();
  }
  /* булыжник: редкие камни по дороге, а не сплошная кладка */
  for (var s2 = 12; s2 < SIM.TOTAL; s2 += 21) {
    var p1 = SIM.posAt(s2), p2 = SIM.posAt(s2 + 5);
    var dx = p2.x - p1.x, dy = p2.y - p1.y, L = Math.hypot(dx, dy) || 1;
    var nx = -dy / L, ny = dx / L;
    var q2 = prand(s2 * 3.3), off = (q2 - 0.5) * 24;
    var cob = SPR.COBBLE[(s2 | 0) % 4];
    g.globalAlpha = 0.35 + q2 * 0.25;
    SPR.shot(g, cob, p1.x + nx * off, p1.y + ny * off, Math.atan2(dy, dx) + (q2 - 0.5) * 0.6, 0.6 + q2 * 0.5);
    g.globalAlpha = 1;
  }
  /* травяные пучки по обочинам — мягкая кромка дороги */
  for (var s3 = 4; s3 < SIM.TOTAL; s3 += 6) {
    var a1 = SIM.posAt(s3), a2 = SIM.posAt(s3 + 5);
    var ddx = a2.x - a1.x, ddy = a2.y - a1.y, LL = Math.hypot(ddx, ddy) || 1;
    var px2 = -ddy / LL, py2 = ddx / LL;
    [-1, 1].forEach(function (side) {
      var q3 = prand(s3 * 1.3 + side * 3.7);
      var bx = a1.x + px2 * side * (16 + q3 * 4), by = a1.y + py2 * side * (16 + q3 * 4);
      g.fillStyle = 'rgba(' + (q3 > 0.5 ? '76,112,54,' : '46,74,38,') + (0.55 + q3 * 0.35) + ')';
      g.fillRect(bx, by - 3, 1.5, 3 + q3 * 3);
      g.fillRect(bx + 2.2, by - 1.5, 1.2, 2.5 + q3 * 2);
    });
  }

  /* колеи от телег вдоль дороги */
  for (var s4 = 0; s4 < SIM.TOTAL - 12; s4 += 13) {
    var b1 = SIM.posAt(s4), b2 = SIM.posAt(s4 + 13);
    var ex = b2.x - b1.x, ey = b2.y - b1.y, EL = Math.hypot(ex, ey) || 1;
    var mx = -ey / EL, my = ex / EL;
    [-7.5, 7.5].forEach(function (side) {
      g.strokeStyle = 'rgba(56,40,22,.30)'; g.lineWidth = 2.6; g.lineCap = 'round';
      g.beginPath();
      g.moveTo(b1.x + mx * side, b1.y + my * side);
      g.lineTo(b2.x + mx * side, b2.y + my * side);
      g.stroke();
    });
  }

  /* декор */
  SIM.DECOR.forEach(function (d, idx) {
    var p = { x: (d[0] + 0.5) * CELL, y: (d[1] + 0.5) * CELL + 12 };
    var kind = idx % 4;
    var spr = kind === 0 ? SPR.DECOR.oak : kind === 1 ? SPR.DECOR.pine : kind === 2 ? SPR.DECOR.rock : SPR.DECOR.bush;
    SPR.put(g, spr, p.x, p.y, kind < 2 ? 0.95 : 1);
  });

  /* замок */
  SPR.put(g, SPR.CASTLE, 180, H);

  /* виньетка */
  var vg = g.createRadialGradient(W / 2, H * 0.45, H * 0.3, W / 2, H * 0.45, H * 0.8);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(8,12,6,.42)');
  g.fillStyle = vg; g.fillRect(0, 0, W, H);

  FIELD = b;
}

/* ================= объекты ================= */
function drawTower(g, t, ghost, ok) {
  var spr = SPR.TOWER[t.type];
  if (!spr) return;
  var bob = t.recoil ? t.recoil * 1.6 : 0;
  g.save();
  if (ghost) g.globalAlpha = 0.55;
  SPR.put(g, spr, t.x, t.y + 14 + bob, 1.28);
  g.restore();
  /* уровень — золотые ромбы под башней */
  var lvl = t.lvl || 1;
  for (var l = 0; l < lvl; l++) {
    var lx = t.x - (lvl - 1) * 3.6 + l * 7.2, ly = t.y + 22;
    g.fillStyle = '#f0cf78';
    g.beginPath(); g.moveTo(lx, ly - 2.6); g.lineTo(lx + 2.2, ly); g.lineTo(lx, ly + 2.6); g.lineTo(lx - 2.2, ly); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(60,42,10,.65)'; g.lineWidth = 0.7; g.stroke();
  }
}

function hpBar(g, e, y) {
  var w = Math.max(20, e.r * 2.2), h = 3.4, x = e.x - w / 2;
  g.fillStyle = 'rgba(0,0,0,.62)'; g.fillRect(x - 1, y - 1, w + 2, h + 2);
  var k = Math.max(0, e.hp / e.maxHp);
  g.fillStyle = k > 0.6 ? '#88c94f' : k > 0.3 ? '#e0ad3c' : '#cf4a33';
  g.fillRect(x, y, w * k, h);
}

function drawEnemy(g, e) {
  var sheet = SPR.ENEMY[e.type];
  if (!sheet) return;
  var fr = (Math.floor(e.wob * 0.35) % 2 + 2) % 2;
  var spr = sheet[fr];
  var bob = Math.sin(e.wob) * 1.1;
  SPR.put(g, spr, e.x, e.y + e.r * 0.42 + bob);
  /* заморозка */
  if (e.slowT > 0) {
    g.save();
    g.globalAlpha = 0.45;
    g.fillStyle = 'rgba(150,220,255,.55)';
    g.beginPath(); g.ellipse(e.x, e.y - e.r * 0.7, e.r * 1.05, e.r * 1.35, 0, 0, 6.283); g.fill();
    g.restore();
  }
  hpBar(g, e, e.y - e.r * 2.8);
  if (e.type === 'boss') {
    g.fillStyle = '#f6dfa0'; g.font = 'bold 10px Georgia'; g.textAlign = 'center';
    g.fillText('ВОЖДЬ', e.x, e.y - e.r * 3.15);
    g.textAlign = 'left';
  }
}

/* ================= сцена ================= */
function render() {
  ctx.clearRect(0, 0, W, H);
  if (FIELD) ctx.drawImage(FIELD, 0, 0, W, H);

  /* радиус */
  var showR = null, cx = 0, cy = 0;
  if (UI.placing && UI.ghost) {
    showR = SIM.towerStats(UI.placing, 1).range;
    cx = (UI.ghost.c + 0.5) * CELL; cy = (UI.ghost.r + 0.5) * CELL;
  } else if (UI.sel != null) {
    for (var i = 0; i < G.towers.length; i++) if (G.towers[i].id === UI.sel) { showR = G.towers[i].st.range; cx = G.towers[i].x; cy = G.towers[i].y; }
  }
  if (showR != null) {
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, showR * CELL, 0, 6.283);
    ctx.fillStyle = 'rgba(224,182,78,.09)'; ctx.fill();
    ctx.setLineDash([5, 5]); ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(224,182,78,.5)'; ctx.stroke();
    ctx.restore();
  }

  for (var k = 0; k < G.towers.length; k++) drawTower(ctx, G.towers[k], false, true);

  if (UI.placing && UI.ghost) {
    var ok = SIM.cellFree(G, UI.ghost.c, UI.ghost.r) && G.gold >= SIM.TOWERS[UI.placing].cost;
    ctx.save();
    ctx.fillStyle = ok ? 'rgba(80,200,110,.16)' : 'rgba(210,60,50,.22)';
    ctx.fillRect(UI.ghost.c * CELL, UI.ghost.r * CELL, CELL, CELL);
    if (ok) { ctx.strokeStyle = 'rgba(120,230,140,.55)'; ctx.lineWidth = 1.2; ctx.strokeRect(UI.ghost.c * CELL + 0.5, UI.ghost.r * CELL + 0.5, CELL - 1, CELL - 1); }
    drawTower(ctx, { type: UI.placing, x: (UI.ghost.c + 0.5) * CELL, y: (UI.ghost.r + 0.5) * CELL, lvl: 1, recoil: 0 }, true, ok);
    ctx.restore();
  }

  /* враги: дальние первыми */
  var list = G.enemies.slice().sort(function (a, b) { return a.y - b.y; });
  for (var m = 0; m < list.length; m++) drawEnemy(ctx, list[m]);

  /* снаряды */
  for (var s = 0; s < G.shots.length; s++) {
    var sh = G.shots[s];
    if (sh.type === 'ice') {
      ctx.globalAlpha = Math.max(0, Math.min(1, sh.life * 6));
      SPR.shot(ctx, SPR.SHOT.ice, sh.x, sh.y, 0, 0.9);
      ctx.globalAlpha = 1;
      continue;
    }
    var ang = Math.atan2(sh.ty - sh.y, sh.tx - sh.x);
    SPR.shot(ctx, SPR.SHOT[sh.type] || SPR.SHOT.arrow, sh.x, sh.y, ang, 1);
  }

  /* частицы */
  for (var p = 0; p < G.parts.length; p++) {
    var q = G.parts[p];
    ctx.globalAlpha = Math.max(0, q.life / q.max);
    ctx.fillStyle = q.color;
    ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 6.283); ctx.fill();
  }
  ctx.globalAlpha = 1;

  if (G.flash > 0) {
    ctx.fillStyle = 'rgba(170,40,30,' + (G.flash * 0.35) + ')';
    ctx.fillRect(0, 0, W, H);
  }
}

/* ================= UI ================= */
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('on');
  UI.toastT = 2.2;
}

function buildRail() {
  rail.innerHTML = '';
  ORDER.forEach(function (key) {
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
        toast(sp.name + ' · ' + sp.desc + ' — тапни по траве рядом с тропой');
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

  /* подсказка «есть на что построиться»: рейка начинает пульсировать */
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
  var cell = cellOf(ev);
  if (cell.c >= 0 && cell.c < COLS && cell.r >= 0 && cell.r < ROWS) UI.ghost = cell;
  render();
});

el.waveBtn.addEventListener('click', function () {
  if (G.phase === 'build') {
    SIM.startWave(G);
    Platform.haptic('heavy');
  } else if (G.phase === 'wave' && G.wave < SIM.WAVES) {
    var r = SIM.startWave(G, true);
    if (r.ok) {
      toast('Волна ' + G.wave + ' досрочно · +' + r.bonus + ' золота');
      Platform.haptic('success');
    }
  }
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
setTimeout(function () { toast('Выбери башню внизу и поставь рядом с тропой'); }, 700);

/* API для проверки/баланса */
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
    var k = Math.min(rect.width / W, rect.height / H);
    var ox = (rect.width - W * k) / 2, oy = (rect.height - H * k) / 2;
    return { x: rect.left + ox + (c + 0.5) * CELL * k, y: rect.top + oy + (r + 0.5) * CELL * k };
  }
};
})();
