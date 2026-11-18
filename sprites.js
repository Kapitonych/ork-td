/* sprites.js — вся графика игры рисуется один раз в offscreen-канвасы (2×).
   view.js только блитит готовые спрайты: дешево по кадру и одинаково резко на retina. */
(function (root) {
'use strict';

var S = 2;

var C = {
  grass1: '#3d5a33', grass2: '#35502c', grass3: '#466639',
  dirt: '#7a6242', dirtDark: '#5d4a30', dirtLight: '#94795a',
  stone: '#7c8073', stoneD: '#4d5147', stoneL: '#9aa093',
  wood: '#7a5430', woodD: '#4e3419', woodL: '#9a6c3d',
  roof: '#b04a33', roofD: '#7a2b1c', roofL: '#cf6446',
  iron: '#98a0a8', ironD: '#5b646d',
  leather: '#5a3d22', leatherL: '#7a5530',
  skin: '#6f9a45', skinD: '#4a6d2c', skinL: '#8cb95c',
  bone: '#efe6cf', gold: '#e0b64e', goldD: '#8a6c22',
  ice: '#b8e8ff', iceD: '#5aa6cf', magic: '#b98cff', magicD: '#6a3fb0'
};

function Spr(w, h, draw) {
  var c = document.createElement('canvas');
  c.width = Math.ceil(w * S); c.height = Math.ceil(h * S);
  var g = c.getContext('2d');
  g.scale(S, S); g.lineJoin = 'round'; g.lineCap = 'round';
  draw(g, w, h);
  return { c: c, w: w, h: h };
}
function rr(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
}
function lg(g, x0, y0, x1, y1, stops) {
  var gr = g.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(function (s, i) { gr.addColorStop(i / (stops.length - 1), s); });
  return gr;
}
function rg(g, x, y, r0, r1, stops) {
  var gr = g.createRadialGradient(x, y, r0, x, y, r1);
  stops.forEach(function (s, i) { gr.addColorStop(i / (stops.length - 1), s); });
  return gr;
}
function shadow(g, x, y, rx, ry, a) {
  g.fillStyle = 'rgba(12,16,8,' + (a || 0.34) + ')';
  g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 6.283); g.fill();
}
/* мягкий контур для читаемости на траве */
function outline(g, color, w) {
  g.strokeStyle = color || 'rgba(18,24,12,.66)'; g.lineWidth = w || 1.2; g.stroke();
}

/* ==================== БАШНИ ==================== */
var TW = 46, TH = 58, GX = 23, GY = 54;   // точка «земли» в спрайте

function stoneBase(g) {
  shadow(g, GX, GY + 1, 17, 5.4, 0.36);
  rr(g, 8, GY - 10, 30, 10, 3);
  g.fillStyle = lg(g, 0, GY - 10, 0, GY, [C.stoneL, C.stone, C.stoneD]); g.fill(); outline(g);
  /* кладка */
  g.strokeStyle = 'rgba(30,34,26,.35)'; g.lineWidth = 0.9;
  g.beginPath(); g.moveTo(8, GY - 5.5); g.lineTo(38, GY - 5.5); g.stroke();
  g.beginPath(); g.moveTo(16, GY - 10); g.lineTo(16, GY - 5.5); g.stroke();
  g.beginPath(); g.moveTo(29, GY - 5.5); g.lineTo(29, GY); g.stroke();
}

var TOWER = {};

TOWER.archer = Spr(TW, TH, function (g) {
  stoneBase(g);
  /* палисад из брёвен */
  for (var i = 0; i < 5; i++) {
    var x = 10 + i * 5.6;
    rr(g, x, GY - 28, 4.8, 19, 1.6);
    g.fillStyle = lg(g, x, 0, x + 5, 0, [C.woodL, C.wood, C.woodD]); g.fill(); outline(g, 'rgba(28,18,8,.55)', 0.8);
  }
  /* настил */
  rr(g, 7, GY - 31, 32, 6, 2);
  g.fillStyle = lg(g, 0, GY - 31, 0, GY - 25, [C.woodL, C.wood]); g.fill(); outline(g);
  /* перила */
  g.strokeStyle = C.wood; g.lineWidth = 2;
  g.beginPath(); g.moveTo(9, GY - 31); g.lineTo(9, GY - 37); g.moveTo(37, GY - 31); g.lineTo(37, GY - 37); g.stroke();
  /* лучник на настиле */
  g.fillStyle = '#3f4a33';
  rr(g, 19, GY - 40, 7, 9, 3); g.fill();
  g.fillStyle = '#d9c9a3';
  g.beginPath(); g.arc(22.5, GY - 41, 3.1, 0, 6.283); g.fill();
  g.strokeStyle = C.woodD; g.lineWidth = 1.4;
  g.beginPath(); g.arc(27, GY - 38, 4.4, -1.1, 1.1); g.stroke();
  /* крыша */
  g.beginPath(); g.moveTo(GX, 6); g.lineTo(GX + 20, GY - 38); g.lineTo(GX - 20, GY - 38); g.closePath();
  g.fillStyle = lg(g, 0, 6, 0, GY - 38, [C.roofL, C.roof, C.roofD]); g.fill();
  g.strokeStyle = 'rgba(50,14,8,.7)'; g.lineWidth = 1.2; g.stroke();
  /* черепица */
  g.strokeStyle = 'rgba(70,20,12,.32)'; g.lineWidth = 0.9;
  for (var r = 12; r < GY - 39; r += 4.6) {
    var k = (r - 6) / (GY - 44);
    g.beginPath(); g.moveTo(GX - k * 20, r); g.lineTo(GX + k * 20, r); g.stroke();
  }
  /* конёк и флаг */
  g.fillStyle = C.gold; g.beginPath(); g.arc(GX, 6, 2.1, 0, 6.283); g.fill();
  g.strokeStyle = C.woodD; g.lineWidth = 1.4;
  g.beginPath(); g.moveTo(GX, 6); g.lineTo(GX, 0.5); g.stroke();
});

TOWER.ballista = Spr(TW, TH, function (g) {
  stoneBase(g);
  /* рама */
  rr(g, 11, GY - 26, 24, 16, 3);
  g.fillStyle = lg(g, 0, GY - 26, 0, GY - 10, [C.woodL, C.wood, C.woodD]); g.fill(); outline(g);
  g.strokeStyle = 'rgba(30,18,8,.5)'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(11, GY - 19); g.lineTo(35, GY - 19); g.stroke();
  /* дуги */
  g.strokeStyle = '#d8c8a4'; g.lineWidth = 3;
  g.beginPath(); g.arc(GX, GY - 30, 15, Math.PI * 1.06, Math.PI * 1.94); g.stroke();
  g.strokeStyle = '#8a7450'; g.lineWidth = 1.2;
  g.beginPath(); g.arc(GX, GY - 30, 15, Math.PI * 1.06, Math.PI * 1.94); g.stroke();
  /* тетива */
  g.strokeStyle = '#efe6cf'; g.lineWidth = 1.3;
  g.beginPath(); g.moveTo(GX - 13.6, GY - 34); g.lineTo(GX, GY - 26); g.lineTo(GX + 13.6, GY - 34); g.stroke();
  /* болт */
  g.strokeStyle = C.woodD; g.lineWidth = 2.2;
  g.beginPath(); g.moveTo(GX, GY - 22); g.lineTo(GX, GY - 40); g.stroke();
  g.fillStyle = C.iron;
  g.beginPath(); g.moveTo(GX, GY - 44); g.lineTo(GX - 2.6, GY - 39); g.lineTo(GX + 2.6, GY - 39); g.closePath(); g.fill();
  /* ворот */
  g.strokeStyle = C.woodD; g.lineWidth = 2;
  g.beginPath(); g.arc(GX, GY - 14, 4.6, 0, 6.283); g.stroke();
  g.strokeStyle = C.goldD; g.lineWidth = 1.2;
  g.beginPath(); g.moveTo(GX - 3.4, GY - 14); g.lineTo(GX + 3.4, GY - 14); g.stroke();
  g.beginPath(); g.moveTo(GX, GY - 17.4); g.lineTo(GX, GY - 10.6); g.stroke();
});

TOWER.frost = Spr(TW, TH, function (g) {
  stoneBase(g);
  /* снег на основании */
  g.fillStyle = 'rgba(226,245,255,.9)';
  g.beginPath(); g.ellipse(GX, GY - 10, 14, 3.6, 0, Math.PI, 0); g.fill();
  /* кристалл */
  var top = GY - 48;
  g.beginPath();
  g.moveTo(GX, top); g.lineTo(GX + 9, GY - 30); g.lineTo(GX + 6, GY - 12);
  g.lineTo(GX - 6, GY - 12); g.lineTo(GX - 9, GY - 30); g.closePath();
  g.fillStyle = lg(g, GX - 9, 0, GX + 9, 0, [C.iceD, C.ice, '#ffffff']); g.fill();
  g.strokeStyle = 'rgba(60,120,150,.65)'; g.lineWidth = 1.1; g.stroke();
  /* грани */
  g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(GX, top); g.lineTo(GX, GY - 12); g.stroke();
  g.beginPath(); g.moveTo(GX - 9, GY - 30); g.lineTo(GX, GY - 26); g.lineTo(GX + 9, GY - 30); g.stroke();
  /* сияние */
  g.fillStyle = rg(g, GX, GY - 28, 2, 22, ['rgba(150,235,255,.55)', 'rgba(120,200,240,0)']);
  g.beginPath(); g.arc(GX, GY - 28, 22, 0, 6.283); g.fill();
  /* мелкие льдинки */
  [[GX - 13, GY - 14], [GX + 13, GY - 17]].forEach(function (p) {
    g.fillStyle = C.ice;
    g.beginPath(); g.moveTo(p[0], p[1] - 5); g.lineTo(p[0] + 3, p[1]); g.lineTo(p[0], p[1] + 4); g.lineTo(p[0] - 3, p[1]); g.closePath(); g.fill();
  });
});

TOWER.mage = Spr(TW, TH, function (g) {
  stoneBase(g);
  /* колонна */
  rr(g, 15, GY - 30, 16, 20, 3);
  g.fillStyle = lg(g, 15, 0, 31, 0, ['#5a4a6e', '#3d3350', '#2b2440']); g.fill(); outline(g);
  /* руны */
  g.strokeStyle = 'rgba(200,160,255,.85)'; g.lineWidth = 1.2;
  g.beginPath(); g.arc(GX, GY - 22, 3.2, 0, 6.283); g.stroke();
  g.beginPath(); g.moveTo(GX, GY - 26.5); g.lineTo(GX, GY - 17.5); g.stroke();
  /* орб */
  g.fillStyle = rg(g, GX - 2, GY - 40, 1, 16, ['rgba(240,215,255,.95)', 'rgba(185,140,255,.85)', 'rgba(120,70,200,0)']);
  g.beginPath(); g.arc(GX, GY - 38, 16, 0, 6.283); g.fill();
  g.fillStyle = '#e6d0ff';
  g.beginPath(); g.arc(GX, GY - 38, 6, 0, 6.283); g.fill();
  g.fillStyle = '#ffffff';
  g.beginPath(); g.arc(GX - 2, GY - 40, 2.2, 0, 6.283); g.fill();
  /* осколки вокруг */
  g.fillStyle = 'rgba(200,160,255,.9)';
  [[GX - 11, GY - 44], [GX + 12, GY - 36], [GX + 8, GY - 48]].forEach(function (p) {
    g.beginPath(); g.moveTo(p[0], p[1] - 2.2); g.lineTo(p[0] + 1.6, p[1]); g.lineTo(p[0], p[1] + 2.2); g.lineTo(p[0] - 1.6, p[1]); g.closePath(); g.fill();
  });
});

/* ==================== ВРАГИ ==================== */
/* Один орк: ground point (cx, cy), радиус r, кадр 0/1. */
function orc(g, cx, cy, r, o, frame) {
  var stride = frame ? 1 : -1;
  var hip = cy - r * 0.55;
  var skin = o.skin || '#7fb050', skinD = o.skinD || '#4e7232', skinL = o.skinL || '#a8d072';

  /* плащ */
  if (o.cape) {
    g.beginPath();
    g.moveTo(cx - r * 0.62, cy - r * 1.65);
    g.quadraticCurveTo(cx - r * 1.2, cy - r * 0.5, cx - r * 1.0, cy + r * 0.15);
    g.lineTo(cx - r * 0.55, cy - r * 0.1);
    g.lineTo(cx - r * 0.15, cy + r * 0.2);
    g.lineTo(cx + r * 0.25, cy - r * 0.1);
    g.lineTo(cx + r * 0.7, cy + r * 0.15);
    g.quadraticCurveTo(cx + r * 1.2, cy - r * 0.5, cx + r * 0.62, cy - r * 1.65);
    g.closePath();
    g.fillStyle = lg(g, cx - r, 0, cx + r, 0, ['#8d241b', '#6d1810']);
    g.fill(); outline(g, 'rgba(40,8,6,.6)', 1);
  }
  shadow(g, cx, cy + 1, r * 0.95, r * 0.3, 0.36);

  /* ноги */
  [-1, 1].forEach(function (side) {
    g.save();
    g.translate(cx + side * r * 0.3, hip);
    g.rotate(stride * side * 0.14);
    rr(g, -r * 0.19, 0, r * 0.38, r * 0.62, r * 0.15);
    g.fillStyle = '#4a3520'; g.fill(); outline(g, 'rgba(24,16,8,.6)', 1);
    rr(g, -r * 0.24, r * 0.46, r * 0.5, r * 0.19, r * 0.09);
    g.fillStyle = '#2f2113'; g.fill();
    g.restore();
  });

  /* торс */
  g.beginPath();
  g.moveTo(cx - r * 0.56, hip + r * 0.1);
  g.quadraticCurveTo(cx - r * 0.66, cy - r * 1.15, cx - r * 0.4, cy - r * 1.42);
  g.lineTo(cx + r * 0.4, cy - r * 1.42);
  g.quadraticCurveTo(cx + r * 0.66, cy - r * 1.15, cx + r * 0.56, hip + r * 0.1);
  g.closePath();
  g.fillStyle = lg(g, cx - r, 0, cx + r, 0, [skinD, skin, skinL]);
  g.fill(); outline(g, 'rgba(20,28,12,.55)', 1);

  /* жилет / броня */
  if (o.armor !== false) {
    g.beginPath();
    g.moveTo(cx - r * 0.5, cy - r * 1.34);
    g.lineTo(cx + r * 0.5, cy - r * 1.34);
    g.lineTo(cx + r * 0.54, cy - r * 0.5);
    g.lineTo(cx - r * 0.54, cy - r * 0.5);
    g.closePath();
    g.fillStyle = o.armor || '#5f4123'; g.fill();
    outline(g, 'rgba(24,14,6,.5)', 1);
    /* вертикальные полосы */
    g.strokeStyle = 'rgba(30,18,8,.35)'; g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(cx - r * 0.18, cy - r * 1.3); g.lineTo(cx - r * 0.18, cy - r * 0.55); g.stroke();
    g.beginPath(); g.moveTo(cx + r * 0.18, cy - r * 1.3); g.lineTo(cx + r * 0.18, cy - r * 0.55); g.stroke();
  } else {
    /* голая грудь: линия ключиц и живот */
    g.strokeStyle = 'rgba(40,20,10,.35)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(cx - r * 0.28, cy - r * 1.12); g.lineTo(cx + r * 0.28, cy - r * 1.12); g.stroke();
  }

  /* ремень */
  g.fillStyle = '#2e1f0e';
  g.fillRect(cx - r * 0.56, cy - r * 0.62, r * 1.12, r * 0.2);
  g.fillStyle = C.gold;
  rr(g, cx - r * 0.11, cy - r * 0.64, r * 0.22, r * 0.24, 1); g.fill();

  /* плечи */
  [-1, 1].forEach(function (side) {
    g.fillStyle = o.armor || skinD;
    g.beginPath(); g.ellipse(cx + side * r * 0.5, cy - r * 1.28, r * 0.28, r * 0.23, side * 0.35, 0, 6.283); g.fill();
    outline(g, 'rgba(24,16,8,.5)', 0.9);
  });

  /* руки */
  var handY = cy - r * (frame ? 0.72 : 0.6);
  g.strokeStyle = skinD; g.lineWidth = r * 0.26;
  g.beginPath(); g.moveTo(cx - r * 0.5, cy - r * 1.2); g.lineTo(cx - r * 0.78, handY); g.stroke();
  g.beginPath(); g.moveTo(cx + r * 0.5, cy - r * 1.2); g.lineTo(cx + r * 0.78, handY); g.stroke();
  g.fillStyle = skin;
  g.beginPath(); g.arc(cx - r * 0.79, handY, r * 0.15, 0, 6.283); g.fill();
  g.beginPath(); g.arc(cx + r * 0.79, handY, r * 0.15, 0, 6.283); g.fill();

  /* голова */
  var hx = cx, hy = cy - r * 1.78, hr = r * 0.56;
  g.fillStyle = skin;
  g.beginPath(); g.arc(hx, hy, hr, 0, 6.283); g.fill();
  outline(g, 'rgba(20,28,12,.55)', 1);
  /* уши */
  g.beginPath();
  g.moveTo(hx - hr * 0.85, hy - hr * 0.1); g.lineTo(hx - hr * 1.65, hy - hr * 0.75); g.lineTo(hx - hr * 0.7, hy + hr * 0.35); g.closePath();
  g.moveTo(hx + hr * 0.85, hy - hr * 0.1); g.lineTo(hx + hr * 1.65, hy - hr * 0.75); g.lineTo(hx + hr * 0.7, hy + hr * 0.35); g.closePath();
  g.fillStyle = skin; g.fill(); outline(g, 'rgba(20,28,12,.5)', 0.8);
  /* брови */
  g.strokeStyle = 'rgba(30,40,16,.65)'; g.lineWidth = Math.max(1, hr * 0.16);
  g.beginPath(); g.moveTo(hx - hr * 0.62, hy - hr * 0.28); g.lineTo(hx - hr * 0.12, hy - hr * 0.12); g.stroke();
  g.beginPath(); g.moveTo(hx + hr * 0.62, hy - hr * 0.28); g.lineTo(hx + hr * 0.12, hy - hr * 0.12); g.stroke();
  /* глаза */
  g.fillStyle = '#fff4c8';
  g.beginPath(); g.arc(hx - hr * 0.33, hy + hr * 0.06, hr * 0.2, 0, 6.283); g.fill();
  g.beginPath(); g.arc(hx + hr * 0.33, hy + hr * 0.06, hr * 0.2, 0, 6.283); g.fill();
  g.fillStyle = '#241a06';
  g.beginPath(); g.arc(hx - hr * 0.3, hy + hr * 0.09, hr * 0.09, 0, 6.283); g.fill();
  g.beginPath(); g.arc(hx + hr * 0.36, hy + hr * 0.09, hr * 0.09, 0, 6.283); g.fill();
  /* рот и клыки */
  g.strokeStyle = 'rgba(26,16,6,.75)'; g.lineWidth = Math.max(1, hr * 0.12);
  g.beginPath(); g.moveTo(hx - hr * 0.3, hy + hr * 0.45); g.lineTo(hx + hr * 0.3, hy + hr * 0.45); g.stroke();
  g.fillStyle = C.bone;
  g.beginPath(); g.moveTo(hx - hr * 0.3, hy + hr * 0.42); g.lineTo(hx - hr * 0.22, hy + hr * 0.05); g.lineTo(hx - hr * 0.12, hy + hr * 0.42); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(hx + hr * 0.3, hy + hr * 0.42); g.lineTo(hx + hr * 0.22, hy + hr * 0.05); g.lineTo(hx + hr * 0.12, hy + hr * 0.42); g.closePath(); g.fill();

  /* шлем: только верх и наносник, лицо открыто */
  if (o.helm) {
    g.beginPath();
    g.arc(hx, hy - hr * 0.12, hr * 1.02, Math.PI * 1.02, Math.PI * 1.98);
    g.closePath();
    g.fillStyle = lg(g, 0, hy - hr * 1.1, 0, hy - hr * 0.1, ['#b6bec6', '#6d757d']);
    g.fill(); outline(g, 'rgba(20,24,28,.7)', 1);
    g.fillStyle = '#565e66';
    g.fillRect(hx - hr * 1.02, hy - hr * 0.3, hr * 2.04, hr * 0.2);
    /* наносник */
    g.fillStyle = '#7d858d';
    g.fillRect(hx - hr * 0.11, hy - hr * 0.32, hr * 0.22, hr * 0.62);
    if (o.horns) {
      g.fillStyle = lg(g, 0, hy - hr * 2, 0, hy - hr, ['#f4ecd8', '#c2b394', '#8d7d5c']);
      [-1, 1].forEach(function (s) {
        g.beginPath();
        g.moveTo(hx + s * hr * 0.55, hy - hr * 0.9);
        g.quadraticCurveTo(hx + s * hr * 2.1, hy - hr * 1.55, hx + s * hr * 1.85, hy - hr * 2.35);
        g.quadraticCurveTo(hx + s * hr * 1.45, hy - hr * 1.55, hx + s * hr * 0.35, hy - hr * 1.25);
        g.closePath(); g.fill(); outline(g, 'rgba(70,58,34,.7)', 0.9);
      });
    }
  } else if (o.hood) {
    g.beginPath();
    g.arc(hx, hy - hr * 0.2, hr * 1.12, Math.PI * 1.05, Math.PI * 1.95);
    g.lineTo(hx + hr * 1.1, hy + hr * 0.25); g.lineTo(hx - hr * 1.1, hy + hr * 0.25);
    g.closePath();
    g.fillStyle = o.hood; g.fill(); outline(g, 'rgba(20,26,14,.6)', 1);
  }

  /* оружие */
  if (o.axes) {
    var ax = cx + r * 0.86, ay = handY;
    g.strokeStyle = '#4a3a1e'; g.lineWidth = r * 0.15;
    g.beginPath(); g.moveTo(ax, ay + r * 0.2); g.lineTo(ax + r * 0.08, ay - r * 1.05); g.stroke();
    g.fillStyle = lg(g, ax, ay - r * 1.05, ax + r * 0.6, ay - r * 0.6, ['#c9d2db', '#7c848c']);
    g.beginPath();
    g.moveTo(ax + r * 0.04, ay - r * 1.0);
    g.lineTo(ax + r * 0.56, ay - r * 0.88);
    g.lineTo(ax + r * 0.44, ay - r * 0.48);
    g.lineTo(ax + r * 0.04, ay - r * 0.6);
    g.closePath(); g.fill(); outline(g, 'rgba(24,28,32,.75)', 1);
  }
  if (o.shield) {
    g.beginPath();
    g.moveTo(cx - r * 1.0, cy - r * 1.3);
    g.lineTo(cx - r * 0.46, cy - r * 1.3);
    g.lineTo(cx - r * 0.46, cy - r * 0.25);
    g.lineTo(cx - r * 0.73, cy + r * 0.15);
    g.lineTo(cx - r * 1.0, cy - r * 0.25);
    g.closePath();
    g.fillStyle = lg(g, cx - r, 0, cx - r * 0.5, 0, ['#c8bda4', '#8c8270', '#5f5747']);
    g.fill(); outline(g, 'rgba(28,20,10,.7)', 1.1);
    g.fillStyle = '#6d757d';
    g.beginPath(); g.arc(cx - r * 0.73, cy - r * 0.85, r * 0.15, 0, 6.283); g.fill();
  }
  if (o.dagger) {
    g.strokeStyle = '#d4dae2'; g.lineWidth = r * 0.13;
    g.beginPath(); g.moveTo(cx + r * 0.8, handY); g.lineTo(cx + r * 1.02, handY - r * 0.5); g.stroke();
  }
}

function warg(g, cx, cy, r, frame) {
  var stride = frame ? 1 : -1;
  shadow(g, cx, cy + 1, r * 1.05, r * 0.28, 0.34);
  /* лапы */
  g.strokeStyle = '#2f2a22'; g.lineWidth = r * 0.19; g.lineCap = 'round';
  [[-0.62, 1], [-0.2, -1], [0.32, 1], [0.72, -1]].forEach(function (p) {
    g.beginPath();
    g.moveTo(cx + r * p[0], cy - r * 0.55);
    g.lineTo(cx + r * (p[0] + stride * 0.16 * p[1]), cy - r * 0.02);
    g.stroke();
  });
  /* хвост */
  g.strokeStyle = '#4a4238'; g.lineWidth = r * 0.16;
  g.beginPath(); g.moveTo(cx - r * 1.0, cy - r * 0.8); g.quadraticCurveTo(cx - r * 1.5, cy - r * 1.0, cx - r * 1.4, cy - r * 1.45); g.stroke();
  /* тело */
  g.beginPath(); g.ellipse(cx - r * 0.1, cy - r * 0.78, r * 1.05, r * 0.5, -0.06, 0, 6.283);
  g.fillStyle = lg(g, 0, cy - r * 1.25, 0, cy - r * 0.3, ['#8b8272', '#5f574a', '#3d372e']);
  g.fill(); outline(g, 'rgba(18,16,12,.7)', 1.1);
  /* шерсть на загривке */
  g.fillStyle = '#3d372e';
  for (var k = 0; k < 3; k++) {
    g.beginPath();
    g.moveTo(cx - r * 0.5 + k * r * 0.3, cy - r * 1.2);
    g.lineTo(cx - r * 0.4 + k * r * 0.3, cy - r * 1.5);
    g.lineTo(cx - r * 0.28 + k * r * 0.3, cy - r * 1.18);
    g.closePath(); g.fill();
  }
  /* голова */
  var hx = cx + r * 0.85, hy = cy - r * 1.0;
  g.beginPath(); g.ellipse(hx, hy, r * 0.46, r * 0.38, 0.12, 0, 6.283);
  g.fillStyle = '#6b6355'; g.fill(); outline(g, 'rgba(18,16,12,.7)', 1.1);
  /* морда */
  g.beginPath(); g.moveTo(hx + r * 0.1, hy + r * 0.16); g.lineTo(hx + r * 0.72, hy + r * 0.06); g.lineTo(hx + r * 0.12, hy - r * 0.12); g.closePath();
  g.fillStyle = '#57503f'; g.fill();
  /* уши */
  g.fillStyle = '#4a4238';
  g.beginPath(); g.moveTo(hx - r * 0.26, hy - r * 0.3); g.lineTo(hx - r * 0.2, hy - r * 0.78); g.lineTo(hx + r * 0.1, hy - r * 0.34); g.closePath(); g.fill();
  /* глаз */
  g.fillStyle = '#ff6a4a';
  g.beginPath(); g.arc(hx + r * 0.14, hy - r * 0.08, r * 0.1, 0, 6.283); g.fill();
  g.fillStyle = '#2a1408';
  g.beginPath(); g.arc(hx + r * 0.16, hy - r * 0.08, r * 0.045, 0, 6.283); g.fill();
  /* клыки */
  g.fillStyle = C.bone;
  g.beginPath(); g.moveTo(hx + r * 0.42, hy + r * 0.16); g.lineTo(hx + r * 0.5, hy + r * 0.42); g.lineTo(hx + r * 0.56, hy + r * 0.12); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(hx + r * 0.24, hy + r * 0.18); g.lineTo(hx + r * 0.3, hy + r * 0.4); g.lineTo(hx + r * 0.36, hy + r * 0.14); g.closePath(); g.fill();
}

function enemySheet(r, draw) {
  var w = r * 5.2, h = r * 5.0;
  return [0, 1].map(function (f) {
    return Spr(w, h, function (g) { draw(g, w / 2, h - r * 0.4, r, f); });
  });
}

var ENEMY = {
  goblin: enemySheet(12, function (g, cx, cy, r, f) {
    orc(g, cx, cy, r, { skin: '#79a34c', skinD: '#4f7230', skinL: '#95bd63', armor: '#4a3a24', hood: '#3f5230', dagger: true, axes: false }, f);
  }),
  orc: enemySheet(16, function (g, cx, cy, r, f) {
    orc(g, cx, cy, r, { skin: C.skin, skinD: C.skinD, skinL: C.skinL, armor: C.leather, helm: true, axes: true }, f);
  }),
  shield: enemySheet(17, function (g, cx, cy, r, f) {
    orc(g, cx, cy, r, { skin: '#6b8f46', skinD: '#43632c', skinL: '#8ab55c', armor: '#4f5a3a', helm: true, shield: true, axes: false }, f);
  }),
  berserk: enemySheet(15, function (g, cx, cy, r, f) {
    orc(g, cx, cy, r, { skin: '#a85433', skinD: '#7c3620', skinL: '#c97248', armor: false, axes: true, hood: '#7c2418' }, f);
  }),
  warg: enemySheet(18, function (g, cx, cy, r, f) { warg(g, cx, cy, r, f); }),
  boss: enemySheet(26, function (g, cx, cy, r, f) {
    orc(g, cx, cy, r, { skin: '#8a4a34', skinD: '#5e2c1c', skinL: '#a86446', armor: '#4a2a1c', helm: true, horns: true, cape: '#7d1f18', axes: true }, f);
  })
};

/* ==================== СНАРЯДЫ ==================== */
var SHOT = {};
SHOT.arrow = Spr(20, 6, function (g) {
  g.strokeStyle = '#d9c8a2'; g.lineWidth = 1.6;
  g.beginPath(); g.moveTo(2, 3); g.lineTo(16, 3); g.stroke();
  g.fillStyle = C.iron;
  g.beginPath(); g.moveTo(20, 3); g.lineTo(15, 0.9); g.lineTo(15, 5.1); g.closePath(); g.fill();
  g.fillStyle = '#c86a4a';
  g.beginPath(); g.moveTo(2, 3); g.lineTo(0.5, 0.6); g.lineTo(5.5, 3); g.lineTo(0.5, 5.4); g.closePath(); g.fill();
});
SHOT.bolt = Spr(26, 8, function (g) {
  g.strokeStyle = '#a9865a'; g.lineWidth = 2.6;
  g.beginPath(); g.moveTo(3, 4); g.lineTo(19, 4); g.stroke();
  g.fillStyle = '#cfd6de';
  g.beginPath(); g.moveTo(26, 4); g.lineTo(18, 1); g.lineTo(18, 7); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(30,24,16,.6)'; g.lineWidth = 0.8; g.stroke();
  g.fillStyle = '#e0d6bb';
  g.beginPath(); g.moveTo(3, 4); g.lineTo(0.6, 1.6); g.lineTo(6, 4); g.lineTo(0.6, 6.4); g.closePath(); g.fill();
});
SHOT.ice = Spr(18, 18, function (g) {
  g.fillStyle = rg(g, 9, 9, 1, 9, ['rgba(235,252,255,.95)', 'rgba(150,225,255,.75)', 'rgba(110,190,240,0)']);
  g.beginPath(); g.arc(9, 9, 9, 0, 6.283); g.fill();
  g.strokeStyle = '#ffffff'; g.lineWidth = 1.4;
  for (var a = 0; a < 3; a++) {
    var an = a * Math.PI / 3;
    g.beginPath();
    g.moveTo(9 - Math.cos(an) * 6, 9 - Math.sin(an) * 6);
    g.lineTo(9 + Math.cos(an) * 6, 9 + Math.sin(an) * 6);
    g.stroke();
  }
});
SHOT.orb = Spr(22, 22, function (g) {
  g.fillStyle = rg(g, 11, 11, 1, 11, ['rgba(245,228,255,.98)', 'rgba(185,140,255,.9)', 'rgba(110,60,190,0)']);
  g.beginPath(); g.arc(11, 11, 11, 0, 6.283); g.fill();
  g.fillStyle = '#ffffff';
  g.beginPath(); g.arc(9.5, 9, 2, 0, 6.283); g.fill();
});

/* ==================== ДЕКОР ==================== */
var DECORSPR = {};
DECORSPR.oak = Spr(52, 62, function (g, w, h) {
  shadow(g, 26, 58, 16, 5, 0.32);
  g.fillStyle = '#4a3421';
  g.beginPath(); g.moveTo(22, 58); g.lineTo(24, 30); g.lineTo(28, 30); g.lineTo(30, 58); g.closePath(); g.fill();
  var blobs = [[26, 28, 17], [15, 34, 12], [37, 34, 12], [26, 15, 13]];
  blobs.forEach(function (b) {
    g.fillStyle = rg(g, b[0] - b[2] * 0.35, b[1] - b[2] * 0.4, 1, b[2], ['#4f7a3c', '#2f5427', '#1e3a19']);
    g.beginPath(); g.arc(b[0], b[1], b[2], 0, 6.283); g.fill();
  });
  g.fillStyle = 'rgba(150,205,120,.25)';
  g.beginPath(); g.arc(21, 15, 6, 0, 6.283); g.fill();
});
DECORSPR.pine = Spr(44, 64, function (g) {
  shadow(g, 22, 60, 13, 4.4, 0.32);
  g.fillStyle = '#3d2a18'; g.fillRect(20, 40, 4, 20);
  for (var i = 0; i < 3; i++) {
    var y = 12 + i * 14, wd = 11 + i * 6;
    g.beginPath(); g.moveTo(22, y - 6); g.lineTo(22 + wd, y + 12); g.lineTo(22 - wd, y + 12); g.closePath();
    g.fillStyle = lg(g, 0, y - 6, 0, y + 12, ['#3f6b3a', '#254a24']); g.fill();
    g.strokeStyle = 'rgba(16,30,14,.4)'; g.lineWidth = 0.9; g.stroke();
  }
});
DECORSPR.rock = Spr(40, 32, function (g) {
  shadow(g, 20, 27, 15, 5, 0.3);
  g.beginPath(); g.moveTo(4, 25); g.lineTo(9, 9); g.lineTo(20, 4); g.lineTo(32, 10); g.lineTo(36, 24); g.lineTo(30, 28); g.lineTo(9, 28); g.closePath();
  g.fillStyle = lg(g, 0, 4, 0, 28, ['#8d9187', '#666b60', '#454a3f']); g.fill(); outline(g, 'rgba(20,24,16,.5)', 1);
  g.fillStyle = 'rgba(200,210,190,.35)';
  g.beginPath(); g.moveTo(9, 9); g.lineTo(20, 4); g.lineTo(23, 12); g.lineTo(12, 15); g.closePath(); g.fill();
});
DECORSPR.bush = Spr(32, 24, function (g) {
  shadow(g, 16, 21, 12, 3.6, 0.28);
  [[11, 15, 8], [21, 15, 8], [16, 10, 8]].forEach(function (b) {
    g.fillStyle = rg(g, b[0] - 2, b[1] - 3, 1, b[2], ['#4e7a3a', '#33561f', '#22400f']);
    g.beginPath(); g.arc(b[0], b[1], b[2], 0, 6.283); g.fill();
  });
});

/* ==================== ЗАМОК ==================== */
var CASTLE = Spr(260, 88, function (g) {
  var cx = 130, baseY = 88, topY = 26;
  /* стена */
  var wall = lg(g, 0, topY, 0, baseY, ['#9a9d8a', '#787c68', '#4e5142']);
  g.fillStyle = wall;
  rr(g, 26, topY, 208, baseY - topY, 4); g.fill();
  /* кладка */
  g.strokeStyle = 'rgba(30,34,26,.26)'; g.lineWidth = 1;
  for (var y = topY + 13; y < baseY; y += 13) {
    g.beginPath(); g.moveTo(26, y); g.lineTo(234, y); g.stroke();
    var off = Math.round((y - topY) / 13) % 2 ? 16 : 0;
    for (var x = 34 + off; x < 234; x += 32) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 13); g.stroke(); }
  }
  /* зубцы стены */
  for (var i = 0; i < 11; i++) {
    g.fillStyle = i % 2 ? '#8f927e' : '#7b7f6b';
    g.fillRect(28 + i * 19, topY - 11, 12, 13);
    g.fillStyle = 'rgba(24,28,18,.22)';
    g.fillRect(28 + i * 19, topY + 1, 12, 2.5);
  }
  /* боковые башни */
  [4, 208].forEach(function (bx, idx) {
    g.fillStyle = lg(g, bx, 0, bx + 48, 0, ['#a3a692', '#7d816c', '#4f5243']);
    rr(g, bx, 2, 48, baseY - 2, 4); g.fill();
    outline(g, 'rgba(24,26,18,.55)', 1.1);
    for (var k = 0; k < 4; k++) {
      g.fillStyle = k % 2 ? '#94977f' : '#7f8370';
      g.fillRect(bx + 2 + k * 12, -8, 8, 13);
    }
    /* бойница */
    g.fillStyle = '#1e2116';
    rr(g, bx + 20, 24, 8, 16, 4); g.fill();
    /* знамя на башне */
    g.strokeStyle = '#2d2418'; g.lineWidth = 1.8;
    g.beginPath(); g.moveTo(bx + 24, -8); g.lineTo(bx + 24, -30); g.stroke();
    g.fillStyle = idx ? '#a5372a' : '#c9922f';
    g.beginPath(); g.moveTo(bx + 24, -30); g.lineTo(bx + 44, -24); g.lineTo(bx + 24, -17); g.closePath(); g.fill();
  });
  /* ворота */
  g.fillStyle = '#15160f';
  g.beginPath();
  g.moveTo(cx - 30, baseY); g.lineTo(cx - 30, topY + 22);
  g.quadraticCurveTo(cx, topY - 4, cx + 30, topY + 22);
  g.lineTo(cx + 30, baseY); g.closePath(); g.fill();
  /* створки */
  g.fillStyle = '#5a4026';
  rr(g, cx - 28, topY + 26, 56, baseY - topY - 26, 3); g.fill();
  g.strokeStyle = 'rgba(24,16,8,.7)'; g.lineWidth = 1.4;
  for (var d = -18; d <= 18; d += 12) { g.beginPath(); g.moveTo(cx + d, topY + 28); g.lineTo(cx + d, baseY); g.stroke(); }
  g.strokeStyle = 'rgba(140,140,120,.45)'; g.lineWidth = 1.4;
  for (var v = -22; v <= 22; v += 7.5) { g.beginPath(); g.moveTo(cx + v, baseY); g.lineTo(cx + v, topY + 6); g.stroke(); }
  /* арка ворот */
  g.strokeStyle = '#a3a692'; g.lineWidth = 4;
  g.beginPath(); g.moveTo(cx - 32, topY + 22); g.quadraticCurveTo(cx, topY - 6, cx + 32, topY + 22); g.stroke();
  /* факелы у ворот */
  [-1, 1].forEach(function (s) {
    var tx = cx + s * 42, ty = topY + 30;
    g.fillStyle = '#3b2a16'; g.fillRect(tx - 1.6, ty, 3.2, 10);
    g.fillStyle = rg(g, tx, ty - 2, 1, 12, ['rgba(255,220,130,.95)', 'rgba(240,150,40,.45)', 'rgba(220,120,20,0)']);
    g.beginPath(); g.arc(tx, ty - 2, 12, 0, 6.283); g.fill();
    g.fillStyle = '#ffd977';
    g.beginPath(); g.ellipse(tx, ty - 1, 2.2, 3.8, 0, 0, 6.283); g.fill();
  });
});

/* ==================== ЗЕМЛЯ ==================== */
function prand(i) { var x = Math.sin(i * 127.1 + 0.5) * 43758.5453; return x - Math.floor(x); }

var TILES = [0, 1, 2].map(function (k) {
  return Spr(40, 40, function (g) {
    g.fillStyle = k === 0 ? C.grass1 : k === 1 ? C.grass2 : C.grass3;
    g.fillRect(0, 0, 40, 40);
    for (var i = 0; i < 26; i++) {
      var x = prand(k * 91 + i * 7) * 40, y = prand(k * 37 + i * 13) * 40;
      g.fillStyle = 'rgba(' + (i % 3 ? '26,42,20,' : '86,116,58,') + (0.25 + prand(i) * 0.35) + ')';
      g.fillRect(x, y, 1.6, 2.6 + prand(i * 3) * 2.4);
    }
    /* редкие цветы */
    if (k === 2) {
      [[9, 30], [31, 12]].forEach(function (p) {
        g.fillStyle = '#d9d06a';
        g.beginPath(); g.arc(p[0], p[1], 1.3, 0, 6.283); g.fill();
      });
    }
  });
});

/* камни мостовой */
var COBBLE = [0, 1, 2, 3].map(function (k) {
  return Spr(14, 10, function (g) {
    g.fillStyle = k % 2 ? 'rgba(120,104,80,.55)' : 'rgba(96,82,60,.55)';
    rr(g, 1, 1, 12, 8, 4); g.fill();
    g.fillStyle = 'rgba(180,162,130,.25)';
    g.beginPath(); g.ellipse(6, 4, 4, 2.2, 0, 0, 6.283); g.fill();
  });
});

/* точки привязки: gx/gy — где у спрайта «земля» */
Object.keys(TOWER).forEach(function (k) { TOWER[k].gx = GX; TOWER[k].gy = GY; });
['oak', 'pine', 'rock', 'bush'].forEach(function (k) { DECORSPR[k].gx = DECORSPR[k].w / 2; DECORSPR[k].gy = DECORSPR[k].h - 3; });
CASTLE.gx = 130; CASTLE.gy = 88;

root.SPR = {
  S: S, TOWER: TOWER, ENEMY: ENEMY, SHOT: SHOT, DECOR: DECORSPR, CASTLE: CASTLE,
  TILES: TILES, COBBLE: COBBLE, TW: TW, TH: TH, GX: GX, GY: GY,
  /* спрайт ставится нижней точкой привязки в (x, y) */
  put: function (g, spr, x, y, sc, rot) {
    sc = sc || 1;
    g.save(); g.translate(x, y); if (rot) g.rotate(rot);
    g.drawImage(spr.c, -(spr.gx != null ? spr.gx : spr.w / 2) * sc, -(spr.gy != null ? spr.gy : spr.h - 2) * sc,
      spr.w * sc, spr.h * sc);
    g.restore();
  },
  /* снаряд: центр спрайта в точке, поворот по направлению */
  shot: function (g, spr, x, y, rot, sc) {
    sc = sc || 1;
    g.save(); g.translate(x, y); if (rot) g.rotate(rot);
    g.drawImage(spr.c, -spr.w * sc / 2, -spr.h * sc / 2, spr.w * sc, spr.h * sc);
    g.restore();
  }
};
})(window);
