/* sim.js — логика Tower Defense «Орды у ворот».
   Никакого DOM: этот файл можно гонять headless (баланс, автоигра). */
(function (root) {
'use strict';

var CELL = 40, COLS = 10, ROWS = 16;
var START_GOLD = 200, LIVES = 20, WAVES = 10;
var BUILD_SECONDS = 12;
/* числа, которые крутятся при балансировке */
var TUNE = {
  WAVE_DIFF: 1.10, START_GOLD: 300, WAVE_BONUS: 45, GOLDK: 0.12, LIVES: 25,
  /* множитель HP по волнам: первые — обучающие, к десятой давление растёт */
  SHAPE: [1,1,1.1,1.3,1.55,1.85,2.2,2.7,3.3,4.0]
};

/* ---------- путь ---------- */
var WAY = [[-1,2],[8,2],[8,6],[1,6],[1,10],[8,10],[8,13],[4,13],[4,13.55]];
function PX(c, r) { return { x: (c + 0.5) * CELL, y: (r + 0.5) * CELL }; }
var PATH = WAY.map(function (p) { return PX(p[0], p[1]); });
var SEGS = [], TOTAL = 0;
(function () {
  for (var i = 0; i < PATH.length - 1; i++) {
    var a = PATH[i], b = PATH[i + 1], len = Math.hypot(b.x - a.x, b.y - a.y);
    SEGS.push({ a: a, b: b, len: len, start: TOTAL }); TOTAL += len;
  }
})();
function posAt(s) {
  if (s <= 0) return { x: PATH[0].x, y: PATH[0].y };
  for (var i = 0; i < SEGS.length; i++) {
    var g = SEGS[i];
    if (s <= g.start + g.len) {
      var t = (s - g.start) / g.len;
      return { x: g.a.x + (g.b.x - g.a.x) * t, y: g.a.y + (g.b.y - g.a.y) * t };
    }
  }
  var L = PATH[PATH.length - 1]; return { x: L.x, y: L.y };
}

/* клетки пути и декора — строить нельзя */
var PATH_CELLS = {};
(function () {
  for (var s = 0; s <= TOTAL; s += 4) {
    var p = posAt(s);
    var c = Math.floor(p.x / CELL), r = Math.floor(p.y / CELL);
    if (c >= 0 && c < COLS && r >= 0 && r < ROWS) PATH_CELLS[c + ',' + r] = 1;
  }
})();
var DECOR = [[6,3],[7,7],[6,11],[2,7],[3,11],[7,15]];
var BLOCK = {};
DECOR.forEach(function (d) { BLOCK[d[0] + ',' + d[1]] = 1; });
/* пятно замка внизу строить нельзя */
[[1,14],[2,14],[3,14],[4,14],[5,14],[6,14],[7,14],[8,14],[1,15],[2,15],[3,15],[4,15],[5,15],[6,15],[7,15],[8,15]]
  .forEach(function (d) { BLOCK[d[0] + ',' + d[1]] = 1; });

/* ---------- башни ---------- */
var TOWERS = {
  archer:   { name: 'Лучники',  cost: 80,  dmg: 16, rate: 2.4, range: 2.9, proj: 'arrow', pspeed: 520, desc: 'Быстрые стрелы по одной цели' },
  ballista: { name: 'Баллиста', cost: 150, dmg: 85, rate: 0.9, range: 4.4, proj: 'bolt',  pspeed: 760, desc: 'Тяжёлый болт, пробивает броню' },
  frost:    { name: 'Стужа',    cost: 120, dmg: 9,  rate: 1.5, range: 2.7, proj: 'ice',   pspeed: 460, slow: 0.45, slowDur: 1.6, desc: 'Замедляет орков на 45%' },
  mage:     { name: 'Магия',    cost: 190, dmg: 38, rate: 1.2, range: 3.3, proj: 'orb',   pspeed: 340, splash: 1.15, desc: 'Урон по площади' },
  catapult: { name: 'Катапульта', cost: 220, dmg: 80, rate: 0.5, range: 4.0, proj: 'stone', pspeed: 300, splash: 1.55, desc: 'Тяжёлый камень, бьёт по толпе' }
};
var UP_MUL = [0, 0.75, 1.3];        // цена апгрейда как доля base cost

function towerStats(type, lvl) {
  var sp = TOWERS[type], m = Math.pow(1.75, lvl - 1);
  return {
    dmg: Math.round(sp.dmg * m), rate: sp.rate,
    range: sp.range + 0.22 * (lvl - 1),
    splash: sp.splash || 0, slow: sp.slow || 0, slowDur: sp.slowDur || 0,
    proj: sp.proj, pspeed: sp.pspeed
  };
}
function upCost(t) { return Math.round(TOWERS[t.type].cost * UP_MUL[t.lvl]); }

/* ---------- враги ---------- */
var ENEMIES = {
  goblin:  { name: 'Гоблин',       hp: 0.55, speed: 64,  gold: 6,  armor: 0, r: 12, leak: 1 },
  orc:     { name: 'Орк',          hp: 1.00, speed: 47,  gold: 8,  armor: 1, r: 14, leak: 1 },
  shield:  { name: 'Щитоносец',    hp: 1.55, speed: 38,  gold: 12, armor: 3, r: 15, leak: 1 },
  berserk: { name: 'Берсерк',      hp: 0.90, speed: 82,  gold: 10, armor: 0, r: 13, leak: 1 },
  warg:    { name: 'Варг',         hp: 0.50, speed: 100, gold: 7,  armor: 0, r: 12, leak: 1 },
  boss:    { name: 'Вождь орков',  hp: 1.8,  speed: 26,  gold: 90, armor: 2, r: 24, leak: 5 }
};

/* Волны: HP растёт медленно, давление — количеством и типами (как в Kingdom Rush).
   hp — HP одного «эталонного» орка в волне; TUNE.WAVE_DIFF масштабирует всю таблицу. */
var WAVEDEF = [
  { hp: 180, groups: [{ t: 'goblin',  n: 8,  gap: 0.80 }] },
  { hp: 180, groups: [{ t: 'goblin',  n: 10, gap: 0.70 }] },
  { hp: 145, groups: [{ t: 'orc',     n: 6,  gap: 1.00 }, { t: 'goblin', n: 5, gap: 0.65 }] },
  { hp: 155, groups: [{ t: 'orc',     n: 8,  gap: 0.85 }, { t: 'warg',   n: 4, gap: 0.50 }] },
  { hp: 140, groups: [{ t: 'orc',     n: 6,  gap: 0.90 }, { t: 'shield', n: 5, gap: 1.10 }] },
  { hp: 185, groups: [{ t: 'orc',     n: 8,  gap: 0.75 }, { t: 'berserk',n: 5, gap: 0.55 }] },
  { hp: 215, groups: [{ t: 'warg',    n: 10, gap: 0.40 }, { t: 'shield', n: 5, gap: 1.00 }] },
  { hp: 215, groups: [{ t: 'orc',     n: 10, gap: 0.62 }, { t: 'berserk',n: 7, gap: 0.48 }, { t: 'shield', n: 3, gap: 1.0 }] },
  { hp: 210, groups: [{ t: 'shield',  n: 8,  gap: 0.85 }, { t: 'berserk',n: 9, gap: 0.42 }, { t: 'warg', n: 6, gap: 0.38 }] },
  { hp: 220, groups: [{ t: 'boss',    n: 1,  gap: 1.50 }, { t: 'orc',    n: 12, gap: 0.55 }, { t: 'shield', n: 5, gap: 0.9 }, { t: 'warg', n: 8, gap: 0.38 }] }
];

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* ---------- игра ---------- */
function newGame(seed) {
  return {
    seed: (seed >>> 0) || 1, rng: mulberry32((seed >>> 0) || 1),
    gold: TUNE.START_GOLD, lives: TUNE.LIVES, wave: 0, phase: 'build',
    time: 0, buildLeft: BUILD_SECONDS,
    towers: [], enemies: [], shots: [], parts: [], rings: [],
    queue: [], spawnT: 0, waveHp: 0,
    kills: 0, leaks: 0, nextId: 1, over: null, stars: 0, flash: 0
  };
}

/* Волну можно позвать раньше — поверх текущей, за золотой бонус. */
function earlyBonus(wave) { return 20 + 5 * wave; }

/* сколько врагов в волне — для подписи кнопки */
function waveCount(w) {
  var def = WAVEDEF[w - 1]; if (!def) return 0;
  return def.groups.reduce(function (a, g) { return a + g.n; }, 0);
}

function startWave(G, early) {
  if (G.wave >= WAVES) return { ok: false, why: 'волны кончились' };
  var canNormal = G.phase === 'build',
      canEarly = !!early && G.phase === 'wave' && G.wave < WAVES && G.wave >= 1;
  if (!canNormal && !canEarly) return { ok: false, why: 'сейчас нельзя' };

  G.wave++;
  var def = WAVEDEF[G.wave - 1];
  var hp = def.hp * (TUNE.WAVE_DIFF || 1) * ((TUNE.SHAPE && TUNE.SHAPE[G.wave - 1]) || 1);
  var goldK = 1 + TUNE.GOLDK * (G.wave - 1);
  var at = 0.6, q = [];
  def.groups.forEach(function (grp) {
    for (var i = 0; i < grp.n; i++) {
      q.push({ type: grp.t, at: at, hp: hp, goldK: goldK });
      at += grp.gap;
    }
    at += 0.8;
  });

  if (canNormal) {
    G.queue = q; G.spawnT = 0; G.phase = 'wave'; G.waveHp = hp;
    return { ok: true, early: false };
  }
  /* ранний вызов: враги новой волны идут сразу за текущими */
  var off = G.spawnT + 1.0, bonus = earlyBonus(G.wave);
  q.forEach(function (it) { it.at += off; G.queue.push(it); });
  G.queue.sort(function (a, b) { return a.at - b.at; });
  G.gold += bonus;
  return { ok: true, early: true, bonus: bonus };
}

function spawn(G, item) {
  var d = ENEMIES[item.type];
  var e = {
    id: G.nextId++, type: item.type, name: d.name,
    maxHp: Math.round((item.hp || G.waveHp) * d.hp), hp: Math.round((item.hp || G.waveHp) * d.hp),
    speed: d.speed, armor: d.armor, r: d.r, leak: d.leak,
    gold: Math.round(d.gold * (item.goldK || 1)),
    s: 0, lane: (G.rng() - 0.5) * 22, slowT: 0, slowMul: 0,
    x: PATH[0].x, y: PATH[0].y, dead: false, wob: G.rng() * 6.28
  };
  place(e);
  G.enemies.push(e);
}

function place(e) {
  var p = posAt(e.s), p2 = posAt(e.s + 6);
  var dx = p2.x - p.x, dy = p2.y - p.y, L = Math.hypot(dx, dy) || 1;
  e.x = p.x - dy / L * e.lane;
  e.y = p.y + dx / L * e.lane;
}

function damage(G, e, dmg, sp) {
  if (e.dead) return;
  var d = Math.max(1, dmg - e.armor);
  e.hp -= d;
  if (sp && sp.slow) { e.slowT = sp.slowDur; e.slowMul = sp.slow; }
  if (e.hp <= 0) {
    e.dead = true;
    G.gold += e.gold;
    G.kills++;
    burst(G, e.x, e.y, e.type === 'boss' ? 22 : 7, '#5b7a34');
  }
}

function burst(G, x, y, n, color) {
  for (var i = 0; i < n; i++) {
    var a = G.rng() * 6.283, sp = 30 + G.rng() * 90;
    G.parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.35 + G.rng() * 0.3, max: 0.65, color: color, r: 1.5 + G.rng() * 2 });
  }
  if (G.parts.length > 220) G.parts.splice(0, G.parts.length - 220);
}

function fire(G, t) {
  var st = t.st, range = st.range * CELL, best = null, bs = -1;
  for (var i = 0; i < G.enemies.length; i++) {
    var e = G.enemies[i];
    if (e.dead) continue;
    if (Math.hypot(e.x - t.x, e.y - t.y) <= range && e.s > bs) { bs = e.s; best = e; }
  }
  if (!best) return;
  t.cd = 1 / st.rate;
  t.recoil = 1;
  if (st.proj === 'ice') {
    damage(G, best, st.dmg, st);
    G.shots.push({ x: t.x, y: t.y - 16, target: best, type: 'ice', life: 0.18, dmg: 0, speed: 0 });
  } else {
    G.shots.push({
      x: t.x, y: t.y - 16, target: best, tx: best.x, ty: best.y,
      type: st.proj, speed: st.pspeed, dmg: st.dmg, splash: st.splash, slow: st.slow,
      slowDur: st.slowDur, life: 3
    });
  }
}

function step(G, dt) {
  if (G.phase === 'win' || G.phase === 'lose') { G.flash = Math.max(0, G.flash - dt * 2); return; }
  G.time += dt;
  if (G.flash > 0) G.flash = Math.max(0, G.flash - dt * 2);

  if (G.phase === 'build') {
    G.buildLeft -= dt;
    if (G.buildLeft <= 0 && G.wave < WAVES) startWave(G);
  }

  if (G.phase === 'wave') {
    G.spawnT += dt;
    while (G.queue.length && G.queue[0].at <= G.spawnT) spawn(G, G.queue.shift());
  }

  /* враги */
  for (var i = 0; i < G.enemies.length; i++) {
    var e = G.enemies[i];
    if (e.dead) continue;
    if (e.slowT > 0) e.slowT -= dt;
    var mul = e.slowT > 0 ? (1 - e.slowMul) : 1;
    e.s += e.speed * mul * dt;
    e.wob += dt * 9;
    if (e.s >= TOTAL) {
      e.dead = true; e.leaked = true;
      G.lives -= e.leak; G.leaks++; G.flash = 0.6;
      burst(G, e.x, e.y, 10, '#b4402c');
      continue;
    }
    place(e);
  }

  /* башни */
  for (var j = 0; j < G.towers.length; j++) {
    var t = G.towers[j];
    if (t.recoil > 0) t.recoil = Math.max(0, t.recoil - dt * 4);
    if (t.cd > 0) { t.cd -= dt; if (t.cd > 0) continue; }
    fire(G, t);
  }

  /* снаряды */
  for (var k = G.shots.length - 1; k >= 0; k--) {
    var s = G.shots[k];
    s.life -= dt;
    if (s.type === 'ice') { if (s.life <= 0) G.shots.splice(k, 1); continue; }
    var tg = s.target;
    if (tg && !tg.dead) { s.tx = tg.x; s.ty = tg.y; }
    var dx = s.tx - s.x, dy = s.ty - s.y, d = Math.hypot(dx, dy);
    var move = s.speed * dt;
    if (d <= move + 4) {
      if (s.splash) {
        var rad = s.splash * CELL;
        for (var m = 0; m < G.enemies.length; m++) {
          var en = G.enemies[m];
          if (en.dead) continue;
          var dd = Math.hypot(en.x - s.tx, en.y - s.ty);
          if (dd > rad) continue;
          /* затухание: 100% в центре, 45% на краю — толпа больше не удаляется одним камнем */
          var falloff = 1 - 0.55 * (dd / rad);
          damage(G, en, s.dmg * falloff, s);
        }
        burst(G, s.tx, s.ty, 10, '#b98cff');
        G.rings.push({ x: s.tx, y: s.ty, r: 6, max: s.splash * CELL, life: 0.32, t: 0.32 });
      } else if (tg && !tg.dead) {
        damage(G, tg, s.dmg, s);
      }
      G.shots.splice(k, 1); continue;
    }
    s.x += dx / d * move; s.y += dy / d * move;
    if (s.life <= 0) G.shots.splice(k, 1);
  }

  /* кольца взрывов */
  for (var r = G.rings.length - 1; r >= 0; r--) {
    var rn = G.rings[r];
    rn.life -= dt;
    rn.r += (rn.max - rn.r) * Math.min(1, dt * 9);
    if (rn.life <= 0) G.rings.splice(r, 1);
  }

  /* частицы */
  for (var p = G.parts.length - 1; p >= 0; p--) {
    var q = G.parts[p];
    q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 90 * dt;
    if (q.life <= 0) G.parts.splice(p, 1);
  }

  /* уборка */
  for (var n = G.enemies.length - 1; n >= 0; n--) if (G.enemies[n].dead) G.enemies.splice(n, 1);

  /* конец волны / игры */
  if (G.lives <= 0 && G.phase !== 'lose') { G.lives = 0; G.phase = 'lose'; G.over = 'lose'; return; }
  if (G.phase === 'wave' && !G.queue.length && !G.enemies.length) {
    G.gold += TUNE.WAVE_BONUS;
    if (G.wave >= WAVES) {
      G.phase = 'win'; G.over = 'win';
      G.stars = G.lives >= 20 ? 3 : G.lives >= 12 ? 2 : 1;
    } else {
      G.phase = 'build'; G.buildLeft = BUILD_SECONDS;
    }
  }
}

/* ---------- действия игрока ---------- */
function cellFree(G, c, r) {
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return false;
  var key = c + ',' + r;
  if (PATH_CELLS[key] || BLOCK[key]) return false;
  for (var i = 0; i < G.towers.length; i++) if (G.towers[i].c === c && G.towers[i].r === r) return false;
  return true;
}
function towerAt(G, c, r) {
  for (var i = 0; i < G.towers.length; i++) if (G.towers[i].c === c && G.towers[i].r === r) return G.towers[i];
  return null;
}
function placeTower(G, c, r, type) {
  var sp = TOWERS[type];
  if (!sp) return { ok: false, why: 'нет такой башни' };
  if (!cellFree(G, c, r)) return { ok: false, why: 'здесь нельзя строить' };
  if (G.gold < sp.cost) return { ok: false, why: 'не хватает золота' };
  G.gold -= sp.cost;
  var p = PX(c, r);
  var t = { id: G.nextId++, c: c, r: r, x: p.x, y: p.y, type: type, lvl: 1, cd: 0, spent: sp.cost, recoil: 0 };
  t.st = towerStats(type, 1);
  G.towers.push(t);
  return { ok: true, tower: t };
}
function upgrade(G, id) {
  var t = null;
  for (var i = 0; i < G.towers.length; i++) if (G.towers[i].id === id) t = G.towers[i];
  if (!t) return { ok: false, why: 'нет башни' };
  if (t.lvl >= 3) return { ok: false, why: 'максимальный уровень' };
  var cost = upCost(t);
  if (G.gold < cost) return { ok: false, why: 'не хватает золота' };
  G.gold -= cost; t.spent += cost; t.lvl++;
  t.st = towerStats(t.type, t.lvl);
  return { ok: true };
}
function sell(G, id) {
  for (var i = 0; i < G.towers.length; i++) {
    if (G.towers[i].id === id) {
      var t = G.towers[i];
      var refund = Math.round(t.spent * 0.5);
      G.gold += refund;
      G.towers.splice(i, 1);
      return { ok: true, refund: refund };
    }
  }
  return { ok: false };
}

/* ---------- автоигра для баланса ---------- */
var SPOTS = [];
(function () {
  for (var c = 0; c < COLS; c++) for (var r = 0; r < ROWS; r++) {
    if (!cellFree({ towers: [] }, c, r)) continue;
    var p = PX(c, r), cover = 0;
    for (var s = 0; s <= TOTAL; s += 10) {
      var q = posAt(s);
      if (Math.hypot(q.x - p.x, q.y - p.y) <= 3.2 * CELL) cover++;
    }
    if (cover > 0) SPOTS.push({ c: c, r: r, cover: cover });
  }
  SPOTS.sort(function (a, b) { return b.cover - a.cover; });
})();

function nextSpot(G) {
  for (var i = 0; i < SPOTS.length; i++) if (cellFree(G, SPOTS[i].c, SPOTS[i].r)) return SPOTS[i];
  return null;
}

/* skill 1.0 — идеальный игрок, 0.5 — «поставил куда попало, улучшил что смог» */
function simSpot(G, skill) {
  var pool = skill >= 0.95 ? 4 : Math.round(4 + (1 - skill) * 110);
  var start = Math.floor(G.rng() * Math.min(pool, SPOTS.length));
  for (var i = 0; i < SPOTS.length; i++) {
    var sp = SPOTS[(start + i) % SPOTS.length];
    if (cellFree(G, sp.c, sp.r)) return sp;
  }
  return null;
}

function simulate(seed, opt) {
  opt = opt || {};
  var skill = opt.skill == null ? 1 : opt.skill;
  var G = newGame(seed), t = 0, h = 1 / 30, order = ['archer', 'ballista', 'mage', 'frost'], mixed = 0;
  var trace = [], traceLast = 0;
  while (!G.over && t < 900) {
    if (G.phase === 'build') {
      var guard = 0;
      while (guard++ < 30) {
        var maxT = opt.maxTowers || 12;
        var spot = simSpot(G, skill);
        var type = G.wave >= 6 && G.gold >= TOWERS.catapult.cost && mixed % 4 === 3 ? 'catapult'
          : G.gold >= TOWERS.mage.cost && mixed % 3 === 2 ? 'mage'
          : G.gold >= TOWERS.ballista.cost && mixed % 3 === 1 ? 'ballista' : 'archer';
        var reserve = 1 + (1 - skill) * 0.9;   // новичок копит и строит реже
        if (spot && G.towers.length < maxT && G.gold >= TOWERS[type].cost * reserve) {
          placeTower(G, spot.c, spot.r, type); mixed++; continue;
        }
        var up = null;
        for (var i = 0; i < G.towers.length; i++) {
          var tt = G.towers[i];
          if (tt.lvl < 3 && G.gold >= upCost(tt) * (skill >= 0.95 ? 1 : 1.7) && (!up || upCost(tt) < upCost(up))) up = tt;
        }
        if (up) { upgrade(G, up.id); continue; }
        break;
      }
      startWave(G);
    }
    step(G, h); t += h;
    if (G.phase === 'build' && traceLast !== G.wave) {
      traceLast = G.wave;
      trace.push({ wave: G.wave, lives: G.lives, gold: G.gold, towers: G.towers.length, towersLvl: G.towers.reduce(function (a, x) { return a + x.lvl; }, 0) });
    }
  }
  return {
    win: G.over === 'win', wave: G.wave, lives: G.lives, kills: G.kills,
    gold: G.gold, towers: G.towers.length, seconds: Math.round(t), stars: G.stars, trace: trace
  };
}

function simulateMany(n, opt) {
  opt = opt || {};
  var wins = 0, waves = [], lives = [], secs = [], stars = [], diedOn = [];
  for (var i = 1; i <= n; i++) {
    var r = simulate(i * 7919, opt);
    if (!r.win) diedOn.push(r.wave);
    if (r.win) wins++;
    waves.push(r.wave); lives.push(r.lives); secs.push(r.seconds); stars.push(r.stars);
  }
  function avg(a) { return Math.round(a.reduce(function (x, y) { return x + y; }, 0) / a.length * 10) / 10; }
  function max(a) { return Math.max.apply(null, a); }
  function min(a) { return Math.min.apply(null, a); }
  return { runs: n, winRate: Math.round(wins / n * 100), avgWave: avg(waves), maxWave: max(waves), minWave: min(waves),
    avgLives: avg(lives), avgSeconds: avg(secs), avgStars: avg(stars),
    diedOn: diedOn.length ? Math.round(diedOn.reduce(function (a, b) { return a + b; }, 0) / diedOn.length * 10) / 10 : null };
}

root.SIM = {
  CELL: CELL, COLS: COLS, ROWS: ROWS, WAVES: WAVES, LIVES: TUNE.LIVES, START_GOLD: TUNE.START_GOLD, TUNE: TUNE,
  TOWERS: TOWERS, ENEMIES: ENEMIES, UP_MUL: UP_MUL, WAVEDEF: WAVEDEF,
  PATH: PATH, TOTAL: TOTAL, PATH_CELLS: PATH_CELLS, DECOR: DECOR, SPOTS: SPOTS,
  newGame: newGame, startWave: startWave, earlyBonus: earlyBonus, waveCount: waveCount, step: step, placeTower: placeTower,
  upgrade: upgrade, sell: sell, upCost: upCost, towerAt: towerAt, cellFree: cellFree,
  towerStats: towerStats, posAt: posAt, simulate: simulate, simulateMany: simulateMany
};
})(typeof window !== 'undefined' ? window : globalThis);
