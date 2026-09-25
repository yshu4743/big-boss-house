// ---------------------------------------------------------------------------
// Static + dynamic canvas rendering for the Bigg Boss House world.
// The whole static scene (lawn, paths, building, floors, furniture) is
// pre-rendered once to an offscreen canvas; only players, chat bubbles,
// cloud shadows and water sparkle animate per frame.
// ---------------------------------------------------------------------------
import { WORLD, ROOMS, FURNITURE, DOORWAYS, ARENA } from '../../../shared/map.js';

const FONT = '"Segoe UI", "Trebuchet MS", system-ui, sans-serif';

// ---- seeded rng (deterministic scenery) ----------------------------------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- small canvas helpers -------------------------------------------------
function rr(ctx, x, y, w, h, r) {
  const rr2 = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr2, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr2);
  ctx.arcTo(x + w, y + h, x, y + h, rr2);
  ctx.arcTo(x, y + h, x, y, rr2);
  ctx.arcTo(x, y, x + w, y, rr2);
  ctx.closePath();
}

function ellipse(ctx, x, y, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.closePath();
}

function shadow(ctx, x, y, rx, ry, a = 0.18) {
  ctx.save();
  ctx.fillStyle = `rgba(20,25,15,${a})`;
  ellipse(ctx, x, y, rx, ry);
  ctx.fill();
  ctx.restore();
}

function spaced(ctx, text, x, y, gap = 1.5) {
  ctx.save();
  let cx = x - ((text.length - 1) * gap + ctx.measureText(text).width) / 2;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + gap;
  }
  ctx.restore();
}

// ---- stove anchors (north kitchen counter) --------------------------------
const STOVE_BURNERS = (() => {
  const f = FURNITURE.find((it) => it.t === 'counter' && it.w > 220);
  if (!f) return null;
  return { xs: [-60, 0, 60].map((b) => f.x + f.w / 2 + b), y: f.y - 18 };
})();

function drawStoveFlames(ctx, time) {
  if (!STOVE_BURNERS) return;
  const t = time * 0.001;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < STOVE_BURNERS.xs.length; i++) {
    const x = STOVE_BURNERS.xs[i], y = STOVE_BURNERS.y;
    const ph = t * 10 + i * 2.1;
    const h = 13 + Math.sin(ph) * 3 + Math.sin(ph * 2.7 + i) * 2;
    const w = 9 + Math.sin(ph * 1.7 + i * 1.3) * 2;
    const g = ctx.createRadialGradient(x, y - h * 0.4, 2, x, y - h * 0.4, Math.max(13, h));
    g.addColorStop(0, 'rgba(255,244,190,0.95)');
    g.addColorStop(0.4, 'rgba(255,176,64,0.85)');
    g.addColorStop(1, 'rgba(255,70,15,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x - w, y - h * 0.4, x - w * 0.5, y - h);
    ctx.quadraticCurveTo(x, y - h * 1.7, x + w * 0.5, y - h);
    ctx.quadraticCurveTo(x + w, y - h * 0.4, x, y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// ===========================================================================
// STATIC SCENE
// ===========================================================================
let staticCanvas = null;

function buildStatic() {
  const c = document.createElement('canvas');
  c.width = WORLD.w;
  c.height = WORLD.h;
  const ctx = c.getContext('2d');
  const rnd = mulberry32(20260906);

  drawGround(ctx, rnd);
  drawBuilding(ctx);
  drawFurniture(ctx);
  drawGardenFeatures(ctx);
  drawArena(ctx);
  drawSignage(ctx);
  return c;
}

export function getStaticCanvas() {
  if (!staticCanvas) staticCanvas = buildStatic();
  return staticCanvas;
}

// ---- GROUND (lawn, paths, flower beds) -----------------------------------
function drawGround(ctx, rnd) {
  ctx.fillStyle = '#5f9447';
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);

  // grass texture
  ctx.save();
  ctx.globalAlpha = 0.55;
  const nBlades = 5200;
  for (let i = 0; i < nBlades; i++) {
    const x = rnd() * WORLD.w;
    const y = rnd() * WORLD.h;
    const a = rnd() * Math.PI;
    const len = 3 + rnd() * 4;
    const hue = 84 + (rnd() - 0.5) * 26;
    const lum = 30 + rnd() * 22;
    ctx.strokeStyle = `hsl(${hue}, 48%, ${lum}%)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  ctx.restore();

  // gravel apron around the building
  const gym = 30;
  ctx.fillStyle = '#cdc6ae';
  rr(ctx, 220 - gym, 120 - gym, 1960 + gym * 2, 1280 + gym * 2, 18);
  ctx.fill();
  ctx.fillStyle = '#bdb59c';
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 900; i++) {
    const x = 220 - gym + rnd() * (1960 + gym * 2);
    const y = 120 - gym + rnd() * (1280 + gym * 2);
    if (x > 220 && x < 2180 && y > 120 && y < 1400) continue;
    ctx.fillStyle = `hsl(${40 + rnd() * 20}, 20%, ${60 + rnd() * 14}%)`;
    ctx.beginPath();
    ctx.arc(x, y, 1.5 + rnd() * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // stone paths
  const slab = (x, y, w, h) => {
    ctx.fillStyle = 'rgba(226,222,203,0.92)';
    rr(ctx, x, y, w, h, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,115,95,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(x + 4 + rnd() * (w - 8), y + 4 + rnd() * (h - 8), 3, 3);
    }
  };
  // front garden path (gate -> main entrance)
  for (let y = 1408; y <= 1656; y += 34) {
    slab(1118 + rnd() * 8, y + rnd() * 6, 120 + rnd() * 30, 26 + rnd() * 8);
  }
  // courtyard cross paths
  for (let x = 590; x <= 1740; x += 30) slab(x + rnd() * 6, 975, 22 + rnd() * 8, 30);
  for (let y = 848; y <= 1064; y += 26) slab(1168, y + rnd() * 4, 30, 20 + rnd() * 6);

  // flower beds along building south
  const flowerBed = (x, y, w, h) => {
    ctx.fillStyle = '#4a3018';
    rr(ctx, x, y, w, h, 14);
    ctx.fill();
    for (let i = 0; i < (w * h) / 60; i++) {
      const fx = x + 8 + rnd() * (w - 16);
      const fy = y + 8 + rnd() * (h - 16);
      const col = ['#e76f8a', '#f9c74f', '#b78cfa', '#ff6d4d', '#9be564'][Math.floor(rnd() * 5)];
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(fx, fy, 3 + rnd() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  flowerBed(300, 1408, 560, 44);
  flowerBed(1500, 1408, 620, 44);
}

// ---- BUILDING & ROOMS -----------------------------------------------------
const FLOORS = {
  living:     '#d4a05f',
  bedroom:    '#c99a62',
  powder:     '#e7dfe3',
  bath:       '#cfdfea',
  kitchen:    '#f1ead9',
  dining:     '#bfa97f',
  confession: '#3c4054',
  courtyard:  '#7cb25f',
};

function drawWallTrim(ctx) {
  ctx.fillStyle = '#d9c9a8';
  ctx.fillRect(220, 120, 1960, 1280);
  ctx.strokeStyle = 'rgba(90,72,40,0.55)';
  ctx.lineWidth = 6;
  ctx.strokeRect(220, 120, 1960, 1280);
  ctx.strokeStyle = 'rgba(60,45,22,0.35)';
  ctx.lineWidth = 3;
  ctx.strokeRect(236, 136, 1928, 1248);
}

function drawBuilding(ctx) {
  drawWallTrim(ctx);

  for (const r of ROOMS) {
    const col = FLOORS[r.id];
    ctx.fillStyle = col;
    ctx.fillRect(r.x, r.y, r.w, r.h);

    // floor patterns
    if (r.id === 'living') {
      ctx.strokeStyle = 'rgba(120,72,30,0.25)';
      ctx.lineWidth = 1;
      for (let x = r.x + 12; x < r.x + r.w; x += 24) {
        ctx.beginPath(); ctx.moveTo(x, r.y); ctx.lineTo(x, r.y + r.h); ctx.stroke();
      }
    } else if (r.id === 'bedroom') {
      ctx.strokeStyle = 'rgba(106,64,28,0.22)';
      ctx.lineWidth = 1;
      for (let x = r.x + 16; x < r.x + r.w; x += 28) {
        ctx.beginPath(); ctx.moveTo(x, r.y + 22); ctx.lineTo(x, r.y + r.h); ctx.stroke();
      }
    } else if (r.id === 'powder') {
      ctx.fillStyle = 'rgba(0,0,0,0.04)';
      for (let cx = r.x; cx < r.x + r.w; cx += 40) {
        for (let cy = r.y; cy < r.y + r.h; cy += 40) {
          if ((cx + cy) % 80 === 0) ctx.fillRect(cx, cy, 40, 40);
        }
      }
    } else if (r.id === 'bath') {
      ctx.strokeStyle = 'rgba(70,120,150,0.25)';
      ctx.lineWidth = 1;
      for (let x = r.x + 12; x < r.x + r.w; x += 30) {
        ctx.beginPath(); ctx.moveTo(x, r.y); ctx.lineTo(x, r.y + r.h); ctx.stroke();
      }
      for (let y = r.y + 12; y < r.y + r.h; y += 30) {
        ctx.beginPath(); ctx.moveTo(r.x, y); ctx.lineTo(r.x + r.w, y); ctx.stroke();
      }
    } else if (r.id === 'kitchen') {
      // jaipur-inspired cream + jewel tile accents
      ctx.strokeStyle = 'rgba(150,120,60,0.18)';
      ctx.lineWidth = 1;
      for (let x = r.x + 16; x < r.x + r.w; x += 32) {
        ctx.beginPath(); ctx.moveTo(x, r.y); ctx.lineTo(x, r.y + r.h); ctx.stroke();
      }
      ctx.globalAlpha = 0.5;
      for (const [tx, ty, tc] of [
        [600, 1150, '#e76f8a'], [640, 1150, '#4cc9f0'], [720, 1150, '#f9c74f'], [680, 1150, '#80ed99'],
        [600, 1180, '#4cc9f0'], [680, 1180, '#f9c74f'], [640, 1180, '#80ed99'], [720, 1180, '#e76f8a'],
        [600, 1140, '#f9c74f'], [720, 1140, '#80ed99'], [700, 1140, '#4cc9f0'],
      ]) {
        ctx.fillStyle = tc;
        ctx.beginPath(); ctx.arc(tx, ty, 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else if (r.id === 'dining') {
      // raised marble dais
      ctx.strokeStyle = 'rgba(120,95,60,0.5)';
      ctx.lineWidth = 4;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.globalAlpha = 0.35;
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = `rgba(255,255,255,${(i % 2) * 0.12})`;
        ctx.fillRect(r.x + (i * 97) % r.w, r.y + (i * 53) % r.h, 34, 22);
      }
      ctx.globalAlpha = 1;
    } else if (r.id === 'confession') {
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth = 2;
      for (let x = r.x; x < r.x + r.w; x += 66) {
        ctx.beginPath(); ctx.moveTo(x, r.y); ctx.lineTo(x, r.y + r.h); ctx.stroke();
      }
    } else if (r.id === 'courtyard') {
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.beginPath(); ctx.ellipse(r.x + r.w / 2, r.y + r.h / 2, r.w * 0.32, r.h * 0.3, 0, 0, Math.PI * 2); ctx.fill();
      drawButterfly(ctx, 1175, 940, 46);
      // potted accents row by walls
      ctx.fillStyle = '#9be564';
      for (const px of [585, 615, 645, 1715, 1745, 1775]) {
        ctx.beginPath(); ctx.arc(px, 855, 7, 0, Math.PI * 2); ctx.fill();
      }
    }

    // room label
    ctx.save();
    ctx.fillStyle = 'rgba(40,30,15,0.34)';
    ctx.font = `700 15px ${FONT}`;
    ctx.globalAlpha = 0.75;
    const label = r.id === 'courtyard' ? 'CENTRAL GARDEN' : r.name.toUpperCase();
    spaced(ctx, label, r.x + r.w / 2, r.y + (r.id === 'courtyard' ? 210 : r.h / 2), 2);
    ctx.restore();
  }

  drawRoomDecor(ctx);
  drawDoorways(ctx);
}

function drawButterfly(ctx, cx, cy, s) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalAlpha = 0.5;
  const wings = [
    [ -s, 0, s * 0.95, s * 0.55, 0.6], [s, 0, s * 0.95, s * 0.55, -0.6],
    [-s, s * 0.2, s * 0.6, s * 0.4, -0.4], [s, s * 0.2, s * 0.6, s * 0.4, 0.4],
  ];
  for (const [x, y, w, h, ra] of wings) {
    ctx.save();
    ctx.rotate(ra);
    ctx.fillStyle = '#ff9d00';
    ctx.beginPath(); ctx.ellipse(x, y + s * 0.1, w, h, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a86ff';
    ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.ellipse(x + s * 0.1, y + s * 0.1, w * 0.45, h * 0.45, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 0.5;
  }
  ctx.fillStyle = '#201a12';
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.14, s * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawRoomDecor(ctx) {
  // ---- BEDROOM: large tree mural on the long wall ----
  ctx.save();
  ctx.fillStyle = '#6b4a2a';
  rr(ctx, 960, 146, 90, 26, 6); ctx.fill();
  ctx.strokeStyle = '#7d5a34';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(970, 158); ctx.lineTo(970, 120);
  ctx.moveTo(1005, 172); ctx.lineTo(1005, 122);
  ctx.moveTo(1040, 158); ctx.lineTo(1040, 120);
  ctx.stroke();
  ctx.globalAlpha = 0.9;
  for (const [bx, by, r] of [[960, 110, 46], [1005, 96, 60], [1040, 110, 46], [1005, 112, 54]]) {
    ctx.fillStyle = '#4f8a4a';
    ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#63a75a';
    ctx.beginPath(); ctx.arc(bx - r * 0.2, by - r * 0.25, r * 0.7, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#314f86';
  for (let y = 116; y < 140; y += 6) {
    for (let x = 940; x < 1060; x += 14) {
      if ((x + y) % 22 === 0) ctx.fillRect(x, y, 3, 2);
    }
  }
  ctx.restore();

  // ---- BATHROOM: bougainvillea + parrot mural ----
  ctx.save();
  ctx.fillStyle = '#2e7d5b';
  rr(ctx, 1496, 496, 90, 130, 10); ctx.fill();
  for (const [bx, by, r, c] of [
    [1508, 510, 16, '#e76f8a'], [1530, 502, 14, '#f9c74f'], [1550, 516, 15, '#e76f8a'],
    [1514, 540, 15, '#f9c74f'], [1542, 546, 14, '#e76f8a'], [1526, 566, 15, '#ef476f'],
    [1550, 586, 13, '#e76f8a'],
  ]) {
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#ef476f';
  ctx.beginPath(); ctx.moveTo(1520, 596); ctx.lineTo(1522, 560); ctx.lineTo(1506, 568); ctx.closePath(); ctx.fill();
  ctx.restore();

  // ---- POWDER ROOM: quote glow wall ----
  ctx.save();
  ctx.fillStyle = 'rgba(255,214,224,0.95)';
  ctx.font = `600 13px ${FONT}`;
  ctx.fillText('“Beauty lies in the', 1560, 96);
  ctx.fillText('  eyes of the beholder.”', 1560, 116);
  ctx.restore();

  // ---- CONFESSION: LED backdrop ----
  ctx.save();
  const bx1 = 176; // local offset within confession room (x from 1480)
  const cx = 1480 + bx1;
  ctx.fillStyle = '#14161f';
  rr(ctx, cx, 1260, 580, 110, 16); ctx.fill();
  ctx.strokeStyle = '#ff2e63';
  ctx.lineWidth = 5;
  rr(ctx, cx, 1260, 580, 110, 16); ctx.stroke();
  ctx.fillStyle = '#ff2e63';
  rr(ctx, cx + 40, 1272, 500, 8, 4); ctx.fill();
  ctx.fillStyle = '#ffe9f0';
  ctx.font = `900 34px ${FONT}`;
  ctx.fillText('BIGG BOSS', cx + 150, 1322);
  drawEyeIcon(ctx, cx + 470, 1315, 26, '#ff2e63');
  ctx.restore();

  // ---- LIVING ROOM: TV glow ----
  ctx.save();
  ctx.fillStyle = '#0b0d12';
  rr(ctx, 430, 152, 170, 40, 6); ctx.fill();
  ctx.fillStyle = 'rgba(120,180,255,0.5)';
  rr(ctx, 436, 158, 158, 28, 4); ctx.fill();
  ctx.restore();
}

function drawDoorways(ctx) {
  ctx.save();
  for (const d of DOORWAYS) {
    ctx.fillStyle = 'rgba(40,28,12,0.5)';
    ctx.fillRect(d.x, d.y, d.w, d.h);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(d.x, d.y, d.w, 3);
  }
  ctx.restore();
}

// ---- FURNITURE ------------------------------------------------------------
function drawFurniture(ctx) {
  ctx.save();
  for (const f of FURNITURE) {
    const mx = f.x + f.w / 2;
    const my = f.y + f.h / 2;
    const big = f.w * f.h > 12000;
    shadow(ctx, mx, my + 6, f.w / 2, Math.max(8, f.h / 3), big ? 0.2 : 0.14);
    ctx.save();
    ctx.translate(mx, my);
    const rot = { s: 0, n: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 }[f.rot] || 0;
    ctx.rotate(rot);
    drawItem(ctx, f, mx, my);
    ctx.restore();
  }
  ctx.restore();
}

function drawItem(ctx, f, mx, my) {
  const x = -f.w / 2, y = -f.h / 2, w = f.w, h = f.h;
  switch (f.t) {
    case 'tv': {
      ctx.fillStyle = '#111318';
      rr(ctx, x, y, w, h, 6); ctx.fill();
      ctx.fillStyle = 'rgba(150,220,255,0.75)';
      rr(ctx, x + 5, y + 5, w - 10, h - 12, 3); ctx.fill();
      ctx.fillStyle = '#22262e';
      ctx.fillRect(x + w / 2 - 12, y + h - 6, 24, 10);
      break;
    }
    case 'rug': {
      const g = ctx.createRadialGradient(mx, my, 10, mx, my, Math.max(w, h) / 2);
      g.addColorStop(0, '#a3445f'); g.addColorStop(1, '#7c2f46');
      ctx.fillStyle = g;
      rr(ctx, x, y, w, h, 14); ctx.fill();
      ctx.strokeStyle = '#c9866787'; ctx.lineWidth = 5; rr(ctx, x + 10, y + 10, w - 20, h - 20, 10); ctx.stroke();
      ctx.strokeStyle = '#e0a95e'; ctx.lineWidth = 2; rr(ctx, x + 22, y + 22, w - 44, h - 44, 8); ctx.stroke();
      break;
    }
    case 'sofa': case 'sofa2': {
      let cBack = '#7d3c3f', cSeat = '#98484c', cArm = '#6f3336';
      if (f.t === 'sofa2') { cBack = '#2b4a6e'; cSeat = '#3a5f8a'; cArm = '#223952'; }
      ctx.fillStyle = cBack;
      rr(ctx, x, y, w, Math.min(18, h / 3), 6); ctx.fill();
      ctx.fillStyle = cSeat;
      rr(ctx, x + 3, y + Math.min(18, h / 3), w - 6, h - Math.min(18, h / 3) - 4, 8); ctx.fill();
      ctx.fillStyle = cArm;
      rr(ctx, x, y + 8, Math.min(10, w / 6), h - 16, 6); ctx.fill();
      rr(ctx, x + w - Math.min(10, w / 6), y + 8, Math.min(10, w / 6), h - 16, 6); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      for (let i = 0; i < 3; i++) {
        const px = x + 14 + i * ((w - 28) / 3);
        rr(ctx, px, y + 20, (w - 28) / 3 - 6, 9, 4); ctx.fill();
      }
      break;
    }
    case 'bed': {
      ctx.fillStyle = '#5a3d24';
      rr(ctx, x, y, w, h, 8); ctx.fill();
      ctx.fillStyle = '#efe6d3';
      rr(ctx, x + 8, y + (f.y > 400 ? 8 : 8), w - 16, h - 16, 6); ctx.fill();
      ctx.fillStyle = '#ffffff';
      rr(ctx, x + 10, y + 10, w - 20, h * 0.52, 5); ctx.fill();
      ctx.fillStyle = '#d9c98f';
      rr(ctx, x + w - 20, y + 12, 10, h - 24, 4); ctx.fill();
      ctx.fillStyle = 'rgba(180,150,90,0.5)';
      rr(ctx, x + 12, y + h * 0.58, w - 24, h * 0.34, 6); ctx.fill();
      break;
    }
    case 'night': {
      ctx.fillStyle = '#6d4a26'; rr(ctx, x, y, w, h, 4); ctx.fill();
      ctx.fillStyle = '#ffd27f';
      ctx.beginPath(); ctx.arc(mx, my - h / 2 - 6, 5, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'wardrobe': {
      ctx.fillStyle = '#7a5230'; rr(ctx, x, y, w, h, 5); ctx.fill();
      ctx.strokeStyle = '#4a3018'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(0, y + h); ctx.stroke();
      ctx.fillStyle = '#caa86c';
      ctx.beginPath(); ctx.arc(0, my, 4, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'runner': {
      ctx.fillStyle = '#8e4560'; rr(ctx, x, y, w, h, 10); ctx.fill();
      ctx.strokeStyle = '#e5c98f'; ctx.lineWidth = 2; rr(ctx, x + 8, y + 8, w - 16, h - 16, 8); ctx.stroke();
      break;
    }
    case 'vanity': {
      ctx.fillStyle = '#f4e6d8'; rr(ctx, x, y, w, h, 8); ctx.fill();
      ctx.fillStyle = '#2a2f3a';
      rr(ctx, x + 10, y + 6, w - 20, 22, 4); ctx.fill();
      ctx.fillStyle = 'rgba(255,231,120,0.9)';
      for (const lx of [-40, -10, 20, 50]) { ctx.beginPath(); ctx.arc(lx, y + 10, 3, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#c9a97a';
      for (let i = 0; i < 3; i++) rr(ctx, x + 12 + i * ((w - 24) / 3), y + 40, (w - 24) / 3 - 6, h - 48, 3); ctx.fill();
      break;
    }
    case 'cabinet': {
      ctx.fillStyle = '#b5835a'; rr(ctx, x, y, w, h, 6); ctx.fill();
      ctx.fillStyle = '#efe0c4'; rr(ctx, x + 6, y + 8, w - 12, h - 20, 3); ctx.fill();
      break;
    }
    case 'stool': {
      ctx.fillStyle = '#a06b3c';
      ctx.beginPath(); ctx.arc(0, 0, Math.min(w, h) / 2, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'sink': {
      ctx.fillStyle = '#e9f2f6'; rr(ctx, x, y, w, h, 6); ctx.fill();
      ctx.fillStyle = '#b8d4e4';
      ctx.beginPath(); ctx.ellipse(0, y + 8, w * 0.24, 10, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8b98a5';
      ctx.fillRect(4, y - 2, 6, 6);
      break;
    }
    case 'tub': {
      ctx.fillStyle = '#dce7ee'; rr(ctx, x, y, w, h, 16); ctx.fill();
      ctx.strokeStyle = '#a9c0cf'; ctx.lineWidth = 3; rr(ctx, x + 8, y + 8, w - 16, h - 34, 14); ctx.stroke();
      ctx.fillStyle = 'rgba(90,160,220,0.5)';
      rr(ctx, x + 12, y + 14, w - 24, h - 48, 12); ctx.fill();
      ctx.fillStyle = '#c7d7e2'; rr(ctx, x + 16, y + 12, w - 32, 12, 6); ctx.fill();
      break;
    }
    case 'shower': {
      ctx.fillStyle = 'rgba(190,222,235,0.35)'; rr(ctx, x, y, w, h, 6); ctx.fill();
      ctx.strokeStyle = 'rgba(120,150,170,0.7)'; ctx.lineWidth = 2; rr(ctx, x, y, w, h, 6); ctx.stroke();
      ctx.fillStyle = '#cfd8dc'; rr(ctx, x + 4, y + 4, 20, 20, 4); ctx.fill();
      ctx.fillStyle = '#9ae2fd';
      for (const [dx, dy] of [[20, 30], [32, 36], [24, 46], [36, 22], [28, 56]]) {
        ctx.beginPath(); ctx.moveTo(x + 14, y + 14); ctx.lineTo(x + dx, y + dy); ctx.lineWidth = 1.5; ctx.strokeStyle = '#9ae2fd'; ctx.stroke();
      }
      break;
    }
    case 'counter': {
      ctx.fillStyle = '#e8e1d0'; rr(ctx, x, y, w, h, 6); ctx.fill();
      ctx.strokeStyle = 'rgba(120,95,55,0.4)'; ctx.lineWidth = 2; rr(ctx, x + 4, y + 4, w - 8, h - 8, 4); ctx.stroke();
      ctx.fillStyle = 'rgba(160,130,80,0.5)';
      for (let i = 0; i < Math.floor(w / 40); i++) rr(ctx, x + 10 + i * 42, y + h * 0.45, 30, 22, 3); ctx.fill();
      if (f.w > 220) {
        // north counter = stove + hood
        ctx.fillStyle = '#3d4147';
        for (const bx of [-60, 0, 60]) { ctx.beginPath(); ctx.arc(bx, y - 18, 13, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#24262b'; ctx.stroke(); }
        ctx.fillStyle = '#c0392b';
        ctx.beginPath(); ctx.arc(0, y - 18, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#2b1b12'; rr(ctx, x + 40, y - 46, 100, 26, 4); ctx.fill();
      } else {
        // west counter = sink
        ctx.fillStyle = '#b8d4e4';
        rr(ctx, x + 6, y + 10, 40, 26, 6); ctx.fill();
        ctx.fillStyle = '#8b98a5';
        ctx.fillRect(x + 24, y + 26, 8, 8);
      }
      break;
    }
    case 'island': {
      ctx.fillStyle = '#b58a5a'; rr(ctx, x, y, w, h, 8); ctx.fill();
      ctx.fillStyle = '#6b4325';
      ctx.font = `900 13px ${FONT}`; ctx.fillText('BB', -8, 5);
      ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 2; rr(ctx, x + 8, y + 8, w - 16, h - 16, 6); ctx.stroke();
      break;
    }
    case 'fridge': {
      ctx.fillStyle = '#dfe6ea'; rr(ctx, x, y, w, h, 5); ctx.fill();
      ctx.fillStyle = '#c2ccd4';
      ctx.fillRect(x + 4, y + 4, w - 8, h / 2 - 5);
      ctx.fillRect(x + 4, y + h / 2 + 5, w - 8, h / 2 - 9);
      ctx.fillStyle = '#8b98a5'; rr(ctx, x - 6, my, 4, 8, 2); ctx.fill();
      break;
    }
    case 'shelf': {
      ctx.fillStyle = '#7a5230'; rr(ctx, x, y, w, h, 5); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(x + 3, y + 3, w - 6, 10);
      for (const [bx, by] of [[-10, 26], [12, 30], [34, 24]]) {
        ctx.fillStyle = ['#e76f8a', '#4cc9f0', '#f9c74f'][Math.abs(bx) / 10 % 3];
        ctx.fillRect(x + bx, y + by, 8, 10);
      }
      break;
    }
    case 'table_round': {
      ctx.fillStyle = '#7c4a24';
      ctx.beginPath(); ctx.arc(0, 0, Math.min(w, h) / 2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#5c341a'; ctx.lineWidth = 4; ctx.stroke();
      ctx.fillStyle = '#f4eee0';
      ctx.beginPath(); ctx.arc(0, 0, Math.min(w, h) / 2 - 14, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(150,110,60,0.8)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, Math.min(w, h) / 2 - 30, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#c9a15a';
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath(); ctx.arc(Math.cos(a) * 30, Math.sin(a) * 30, 6, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case 'chair': {
      ctx.fillStyle = '#8a5a2c';
      ctx.beginPath(); ctx.arc(0, 0, Math.min(w, h) / 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#a9773f';
      ctx.beginPath(); ctx.arc(0, 0, Math.min(w, h) / 2 - 3, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.arc(0, 0, Math.min(w, h) / 2, 0, Math.PI * 2); ctx.stroke();
      break;
    }
    case 'coffee': {
      ctx.fillStyle = '#8a5a2c';
      ctx.beginPath(); ctx.arc(0, 0, Math.min(w, h) / 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e0d3b8';
      ctx.beginPath(); ctx.arc(0, 0, Math.min(w, h) / 2 - 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#b8a06a';
      ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'plant': case 'tree': {
      const r = f.t === 'tree' ? f.w * 0.44 : f.w * 0.3;
      ctx.fillStyle = '#3a6b2c';
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4d8638';
      ctx.beginPath(); ctx.arc(-r * 0.25, -r * 0.3, r * 0.75, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#63a54e';
      ctx.beginPath(); ctx.arc(r * 0.2, r * 0.05, r * 0.55, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'lamp': {
      ctx.fillStyle = '#565b66';
      ctx.fillRect(-4, -14, 8, 20);
      ctx.fillStyle = '#ffd87f';
      ctx.beginPath(); ctx.arc(0, -18, 10, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'fountain': {
      ctx.fillStyle = '#9aa0a8'; rr(ctx, x, y, w, h, Math.min(w, h) / 2); ctx.fill();
      ctx.strokeStyle = '#6d737c'; ctx.lineWidth = 4; rr(ctx, x + 4, y + 4, w - 8, h - 8, 14); ctx.stroke();
      ctx.fillStyle = '#3f87c4';
      ctx.beginPath(); ctx.arc(0, 0, w * 0.28, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'planter': {
      ctx.fillStyle = '#5c3820'; rr(ctx, x, y, w, h, 8); ctx.fill();
      ctx.fillStyle = '#3f7d33';
      ctx.beginPath(); ctx.ellipse(0, 0, w * 0.4, h * 0.6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e76f8a';
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.arc(i * w * 0.16, -h * 0.2, 3.5, 0, Math.PI * 2); ctx.fill(); }
      break;
    }
    case 'bench': {
      ctx.fillStyle = '#5f4831'; rr(ctx, x, y, w, h - 14, 6); ctx.fill();
      ctx.fillStyle = '#79583a'; rr(ctx, x + 4, y + 2, w - 8, h - 22, 4); ctx.fill();
      ctx.fillStyle = '#4c3a24'; rr(ctx, x, y + h - 16, w, 12, 4); ctx.fill();
      ctx.fillStyle = '#4c3a24'; rr(ctx, x + 14, y - 8, w - 28, 10, 3); ctx.fill();
      break;
    }
    case 'sitout': {
      ctx.fillStyle = '#585e63'; rr(ctx, x, y, w, h, 8); ctx.fill();
      ctx.fillStyle = '#9aa0a8'; rr(ctx, x + 8, y + 10, w - 16, 26, 6); ctx.fill();
      ctx.fillStyle = '#33383d'; ctx.beginPath(); ctx.arc(x + w - 24, y + 22, 10, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'lawnchair': {
      ctx.fillStyle = '#e8913a'; rr(ctx, x, y, w, h, 8); ctx.fill();
      ctx.fillStyle = '#f7b05c'; rr(ctx, x + 4, y - 6, w - 8, 16, 6); ctx.fill();
      ctx.fillStyle = '#4b3622'; for (let i = 0; i < 4; i++) ctx.fillRect(x + 4 + i * 16, y - 10, 4, 8);
      break;
    }
    case 'stage': {
      ctx.fillStyle = '#9d8258'; rr(ctx, x, y, w, h, 10); ctx.fill();
      ctx.strokeStyle = '#6f5a38'; ctx.lineWidth = 4; rr(ctx, x, y, w, h, 10); ctx.stroke();
      ctx.fillStyle = '#7d633d'; rr(ctx, x, y + h - 10, w, 12, 4); ctx.fill();
      break;
    }
    case 'podium': {
      ctx.fillStyle = '#5f4b2e'; rr(ctx, x, y, w, h, 6); ctx.fill();
      ctx.fillStyle = '#8a6d42'; rr(ctx, x + 6, y + 4, w - 12, 14, 4); ctx.fill();
      ctx.fillStyle = '#22252a'; ctx.fillRect(x + w / 2 - 2, y - 18, 4, 20);
      ctx.fillStyle = '#ffb703'; ctx.beginPath(); ctx.arc(x + w / 2, y - 20, 5, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'ballot': {
      ctx.fillStyle = '#2f6a4f'; rr(ctx, x, y, w, h, 5); ctx.fill();
      ctx.fillStyle = '#111318'; rr(ctx, x + w / 2 - 9, y + 4, 18, 8, 3); ctx.fill();
      break;
    }
    case 'jailbed': {
      ctx.fillStyle = '#6b6257'; rr(ctx, x, y, w, h, 6); ctx.fill();
      ctx.fillStyle = '#4c463f'; rr(ctx, x + 4, y + h / 2, w - 8, h - 10, 4); ctx.fill();
      ctx.fillStyle = '#8d8578'; rr(ctx, x + 30, y + 4, w - 44, 10, 4); ctx.fill();
      break;
    }
    case 'bar': {
      ctx.fillStyle = '#c8c1b5'; rr(ctx, x, y, w, h, 2); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x, y, 2, h);
      break;
    }
    case 'treasure': {
      ctx.fillStyle = '#a0682f'; rr(ctx, x, y, w, h, 4); ctx.fill();
      ctx.strokeStyle = '#6b4325'; ctx.lineWidth = 3; rr(ctx, x, y, w, h, 4); ctx.stroke();
      ctx.fillStyle = '#ffd166'; ctx.fillRect(x + w / 2 - 3, y, 6, h);
      ctx.fillStyle = '#f9c74f'; ctx.font = `900 12px ${FONT}`; ctx.fillText('★', 0, 4);
      break;
    }
  }
}

// ---- GARDEN FEATURES & SIGNS ---------------------------------------------
function drawGardenFeatures(ctx) {
  // Main entrance gate + Bigg Boss arch
  ctx.save();
  ctx.fillStyle = '#6f5636';
  rr(ctx, 1080, 1630, 240, 46, 10); ctx.fill();
  ctx.fillStyle = '#5a4528';
  rr(ctx, 1080, 1620, 46, 90, 8); ctx.fill();
  rr(ctx, 1274, 1620, 46, 90, 8); ctx.fill();
  ctx.fillStyle = '#ffb703';
  ctx.font = `900 26px ${FONT}`;
  ctx.fillText('BIGG BOSS', 1096, 1642);
  ctx.fillStyle = '#ffd970';
  ctx.font = `700 13px ${FONT}`;
  ctx.fillText('JAYICHAL MATHRA PORA · S8', 1096, 1660);
  ctx.restore();

  // democracy flags beside janasabha
  ctx.save();
  for (const [fx, fc] of [[1110, '#ff2e63'], [1250, '#0081fb']]) {
    ctx.fillStyle = '#2a2e35';
    ctx.fillRect(fx, 126, 4, 26);
    ctx.fillStyle = fc;
    ctx.beginPath(); ctx.moveTo(fx, 126); ctx.lineTo(fx + 20, 132); ctx.lineTo(fx, 138); ctx.closePath(); ctx.fill();
  }
  ctx.restore();

  // Janasabha / Democracy gate sign
  ctx.save();
  ctx.font = `800 13px ${FONT}`;
  ctx.fillStyle = '#ffd970';
  spaced(ctx, 'JANASABHA · DEMOCRACY SQUARE', 1220, 168, 0.5);
  ctx.font = `600 10px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  spaced(ctx, '— THE PEOPLE RULE —', 1220, 186, 1);
  ctx.restore();

  // lawn lamps
  ctx.save();
  for (const [lx, ly] of [[460, 1460], [820, 1490], [1790, 1490]]) {
    ctx.fillStyle = '#3a3e44'; ctx.fillRect(lx - 3, ly - 16, 6, 22);
    ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(lx, ly - 20, 8, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// ---- TASK ARENA (courtyard game zone) --------------------------------------
function drawArena(ctx) {
  const a = ARENA;
  const tile = 26;
  ctx.save();
  ctx.fillStyle = 'rgba(20,25,30,0.22)';
  rr(ctx, a.x - 16, a.y - 16, a.w + 32, a.h + 32, 16); ctx.fill();

  for (let ty = 0; ty * tile < a.h; ty++) {
    for (let tx = 0; tx * tile < a.w; tx++) {
      ctx.fillStyle = (tx + ty) % 2 === 0 ? '#8b1f1f' : '#efe0bd';
      rr(ctx, a.x + tx * tile + 1, a.y + ty * tile + 1, tile - 2, tile - 2, 4); ctx.fill();
    }
  }
  ctx.strokeStyle = '#ffb703'; ctx.lineWidth = 5;
  rr(ctx, a.x, a.y, a.w, a.h, 12); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
  rr(ctx, a.x + 8, a.y + 8, a.w - 16, a.h - 16, 8); ctx.stroke();

  ctx.fillStyle = '#131613'; rr(ctx, a.x + a.w / 2 - 110, a.y - 26, 220, 30, 8); ctx.fill();
  ctx.fillStyle = '#ffd970'; ctx.font = `900 17px ${FONT}`;
  spaced(ctx, 'TASK ARENA', a.x + a.w / 2, a.y - 6, 2.5);
  ctx.restore();
}

function drawSignage(ctx) {
  ctx.save();
  // Jail sign
  ctx.fillStyle = '#2c2f36'; rr(ctx, 2240, 152, 124, 34, 8); ctx.fill();
  ctx.strokeStyle = '#ffb703'; ctx.lineWidth = 2; rr(ctx, 2240, 152, 124, 34, 8); ctx.stroke();
  ctx.fillStyle = '#ffb703'; ctx.font = `900 18px ${FONT}`;
  ctx.fillText('JAIL', 2272, 176);
  ctx.restore();

  // Panippura
  ctx.save();
  ctx.fillStyle = '#5f4b2e'; rr(ctx, 30, 100, 90, 26, 8); ctx.fill();
  ctx.fillStyle = '#ffd970'; ctx.font = `700 13px ${FONT}`;
  ctx.fillText('PANIPPURA', 40, 118);
  ctx.restore();
  // hut door
  ctx.fillStyle = '#4a3b26';
  rr(ctx, 100, 344, 46, 16, 4); ctx.fill();
}

// ===========================================================================
// DYNAMIC PER-FRAME DRAW
// ===========================================================================
export function drawWorld(ctx, S) {
  ctx.drawImage(getStaticCanvas(), 0, 0);

  // stove burners light up while the cook act is running
  if (S.stoveLit) drawStoveFlames(ctx, S.time);

  // soft drifting cloud shadows
  ctx.save();
  const t = S.time * 0.001;
  for (let i = 0; i < 4; i++) {
    const cx = ((S.cloudBase?.[i] ?? i * 700) + t * (12 + i * 6)) % (WORLD.w + 800) - 400;
    const cy = 500 + i * 140;
    ctx.fillStyle = 'rgba(12,22,10,0.05)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 340, 120, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // fountain water sparkle
  const fp = { x: 1176, y: 936 };
  ctx.save();
  ctx.globalAlpha = 0.6;
  const tt = S.time * 0.006;
  for (let i = 0; i < 6; i++) {
    const a = tt + (i / 6) * Math.PI * 2;
    ctx.strokeStyle = '#bfe6ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(fp.x, fp.y);
    ctx.quadraticCurveTo(
      fp.x + Math.cos(a) * 16, fp.y + Math.sin(a) * 16 - 12,
      fp.x + Math.cos(a) * 26, fp.y + Math.sin(a) * 26 + 6
    );
    ctx.stroke();
  }
  ctx.restore();

  // ----- players & bubbles -----
  const list = [...S.players.values()].sort((a, b) => a.y - b.y);
  for (const p of list) drawPlayer(ctx, p, p.id === S.meId, S.time, S.speaking?.has(p.id));

  // ----- task props (on top, small, non-blocking) -----
  if (S.choreSpots) {
    ctx.save();
    for (const s of S.choreSpots.values()) drawGrime(ctx, s, S.time);
    ctx.restore();
  }
  if (S.cookItems) {
    ctx.save();
    for (const it of S.cookItems.values()) drawCookPot(ctx, it, S.time);
    ctx.restore();
  }

  for (const b of S.bubbles) drawBubble(ctx, b, S.players.get(b.sender));
}

// ---- CHORE GRIME ----------------------------------------------------------
function drawGrime(ctx, s, time) {
  const x = s.x, y = s.y;
  const pulse = Math.sin(time * 0.004 + x * 0.1) * 0.5 + 0.5;
  ctx.globalAlpha = 0.82 + pulse * 0.18;
  // base stain
  ctx.fillStyle = '#4a3520';
  ctx.beginPath(); ctx.ellipse(x, y, 14, 11, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#6d5433';
  for (const [dx, dy, r] of [[-5, -3, 6], [5, 2, 7], [2, -6, 5], [-2, 5, 6]]) {
    ctx.beginPath(); ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2); ctx.fill();
  }
  // glistening goo
  ctx.fillStyle = '#8a7448';
  ctx.beginPath(); ctx.ellipse(x - 4, y + 2, 4, 2.5, 0.5, 0, Math.PI * 2); ctx.fill();
  // flies circling
  for (let i = 0; i < 3; i++) {
    const a = time * 0.003 + (i / 3) * Math.PI * 2;
    const fx = x + Math.cos(a) * 16;
    const fy = y - 8 + Math.sin(a * 1.4) * 6;
    ctx.fillStyle = `rgba(20,20,20,${0.55 + pulse * 0.3})`;
    ctx.beginPath(); ctx.arc(fx, fy, 1.6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ---- COOK ITEM POT ----------------------------------------------------------
function drawCookPot(ctx, it, time) {
  const x = it.x, y = it.y;
  const taken = !!it.takenBy;
  const bob = Math.sin(time * 0.003 + (it.id.charCodeAt(0) || 0)) * 2;
  ctx.globalAlpha = taken ? 0.35 : 1;

  shadow(ctx, x, y + 12, 14, 7, 0.22);
  // pot body
  ctx.fillStyle = '#7a4a1f';
  rr(ctx, x - 13, y - 6 + bob, 26, 16, 7); ctx.fill();
  ctx.fillStyle = '#9c6a33';
  rr(ctx, x - 11, y - 8 + bob, 22, 5, 3); ctx.fill();
  ctx.fillStyle = '#5e3715';
  rr(ctx, x - 2, y + 8 + bob, 4, 3, 1); ctx.fill();

  if (it.detail) {
    // emoji + name over the pot
    ctx.font = `20px serif`;
    ctx.textAlign = 'center';
    ctx.fillText(it.detail.e, x, y - 14 + bob * 0.5);
    ctx.fillStyle = '#fff8e7';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 2.5;
    ctx.font = `700 10px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.strokeText(it.detail.name, x, y + 30 + bob * 0.5);
    ctx.fillText(it.detail.name, x, y + 30 + bob * 0.5);
  }

  if (taken) {
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffb703';
    ctx.font = `900 12px ${FONT}`;
    ctx.fillText('✓', x, y - 20);
  }
  ctx.globalAlpha = 1;
}

function drawPlayer(ctx, p, isMe, time, speaking) {
  const bob = p.moving ? Math.sin(p.anim * 0.5) * 2 : 0;
  const x = p.x, y = p.y + bob;

  // shadow
  shadow(ctx, x, y + 4, 12, 6, 0.22);

  // legs
  const stride = p.moving ? Math.sin(p.anim * 0.9) * 4 : 0;
  ctx.fillStyle = '#20242c';
  ctx.fillRect(x + 2 * Math.cos(stride) - 3, y - 2, 5, 9);
  ctx.fillRect(x - 2 * Math.cos(stride) - 2, y - 1, 5, 8);

  // body (rounded, facing offset)
  const off = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] }[p.face] || [0, 1];
  ctx.fillStyle = p.color;
  rr(ctx, x - 9, y - 20, 18, 18 + off[1] * 2, 7);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  rr(ctx, x - 9, y - 20, 18, 18 + off[1] * 2, 7);
  ctx.stroke();

  // arms swing
  ctx.fillStyle = p.color;
  ctx.fillRect(x + off[0] * 6 - 2 + Math.cos(stride) * 2, y - 12, 5, 9);
  ctx.fillRect(x - off[0] * 6 - 3 - Math.cos(stride) * 2, y - 12, 5, 9);

  // head
  ctx.fillStyle = '#e7b98c';
  ctx.beginPath(); ctx.arc(x + off[0] * 2, y - 26, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(30,26,22,0.85)';
  ctx.beginPath(); ctx.arc(x + off[0] * 2, y - 28, 8, Math.PI, 0); ctx.fill();

  // eyes facing
  const ex = x + off[0] * 4;
  const ey = y - 26;
  ctx.fillStyle = '#111';
  if (off[0] === 0) {
    ctx.beginPath(); ctx.arc(ex - 2.4, ey, 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(ex + 2.4, ey, 1.6, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.beginPath(); ctx.arc(ex, ey - 1.6, 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(ex, ey + 1.6, 1.6, 0, Math.PI * 2); ctx.fill();
  }

  // name tag
  const label = isMe ? `${p.name} (you)` : p.name;
  ctx.font = `600 11px ${FONT}`;
  const w = ctx.measureText(label).width + 10;
  ctx.fillStyle = 'rgba(10,12,16,0.75)';
  rr(ctx, x - w / 2, y - 52, w, 16, 4); ctx.fill();
  ctx.fillStyle = p.color;
  ctx.fillText(label, x - w / 2 + 5, y - 40);

  // live voice indicator
  if (speaking) {
    const pulse = (Math.sin(time * 0.008 + p.id.length) * 0.5 + 0.5);
    ctx.fillStyle = '#ff4d4d';
    ctx.beginPath(); ctx.arc(x, y - 63, 3 + pulse * 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,77,77,0.35)';
    ctx.beginPath(); ctx.arc(x, y - 63, 6 + pulse * 3, 0, Math.PI * 2); ctx.fill();
  }
}

function wrapText(ctx, text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function drawBubble(ctx, b, sender) {
  if (!sender) return;
  ctx.font = `12px ${FONT}`;
  const lines = wrapText(ctx, b.text, 200);
  const lw = Math.max(...lines.map((l) => ctx.measureText(l).width), 40);
  const pad = 7;
  const lh = 15;
  const h = lines.length * lh + pad * 2;
  const x = sender.x - lw / 2 - pad;
  const y = sender.y - 62 - h;

  const a = 1 - Math.max(0, (Date.now() - b.born) - 3800) / 1200;

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, a));
  ctx.fillStyle = 'rgba(255,255,255,0.94)';
  rr(ctx, x, y, lw + pad * 2, h, 9); ctx.fill();
  ctx.strokeStyle = sender.color; ctx.lineWidth = 2; rr(ctx, x, y, lw + pad * 2, h, 9); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(sender.x - 7, y + h - 2);
  ctx.lineTo(sender.x, y + h + 9);
  ctx.lineTo(sender.x + 7, y + h - 2);
  ctx.closePath(); ctx.fill();

  ctx.fillStyle = '#222';
  lines.forEach((l, i) => ctx.fillText(l, x + pad, y + pad + lh * (i + 1) - 2));
  ctx.restore();
}

// ---- shared eye icon ------------------------------------------------------
function drawEyeIcon(ctx, x, y, r, accent = '#ffb703') {
  ctx.save();
  ctx.fillStyle = '#101014';
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = accent;
  ctx.beginPath(); ctx.arc(x, y, r * 0.62, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#101014';
  ctx.beginPath(); ctx.arc(x, y, r * 0.32, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}