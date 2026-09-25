// ---------------------------------------------------------------------------
// BIGG BOSS HOUSE — Kerala Season 8 inspired open-world floor plan
// Top-down world. Y grows downward. All units are world pixels.
// ---------------------------------------------------------------------------

export const WORLD = { w: 2400, h: 1700 };
export const CELL = 20; // collision grid cell size

// ----- Rooms (for room detection, floor coloring & labels) ---------------
export const ROOMS = [
  { id: 'living',    name: 'Living Room',   x: 240,  y: 140,  w: 560, h: 680 },
  { id: 'bedroom',   name: 'Common Bedroom',x: 820,  y: 140,  w: 640, h: 680 },
  { id: 'powder',    name: 'Powder Room',   x: 1480, y: 140,  w: 660, h: 320 },
  { id: 'bath',      name: 'Bathroom',      x: 1480, y: 480,  w: 660, h: 320 },
  { id: 'courtyard', name: 'Central Garden',x: 560,  y: 840,  w: 1340,h: 240 },
  { id: 'kitchen',   name: 'Kitchen',       x: 240,  y: 1120, w: 580, h: 260 },
  { id: 'dining',    name: 'Dining Area',   x: 820,  y: 1120, w: 640, h: 260 },
  { id: 'confession',name: 'Confession Room',x: 1480, y: 1120, w: 660, h: 260 },
];

export const GARDEN_ZONES = {
  front:  { x: 0, y: 1400, w: 2400, h: 300, name: 'Front Garden' },
  north:  { x: 0, y: 0,    w: 2400, h: 120, name: 'North Garden' },
  east:   { x: 2180, y: 0, w: 220,  h: 1700, name: 'East Garden' },
  west:   { x: 0, y: 0,    w: 220,  h: 1700, name: 'West Garden' },
};

// ----- Solid (collision) rectangles ----------------------------------------
// World boundary fence
const BOUNDARY = [
  { x: 0,     y: 0,     w: 24,   h: WORLD.h },
  { x: WORLD.w - 24, y: 0, w: 24, h: WORLD.h },
  { x: 24, y: 0, w: WORLD.w - 48, h: 24 },
  { x: 24, y: WORLD.h - 24, w: WORLD.w - 48, h: 24 },
];

// Outer building walls
const OUTER = [
  { x: 220, y: 120, w: 1960, h: 16 },   // north
  { x: 220, y: 1384, w: 1960, h: 16 },  // south
  { x: 220, y: 120, w: 16, h: 1280 },   // west
  { x: 2164, y: 120, w: 16, h: 1280 },  // east
];

// Interior partition walls
const WALLS = [
  { x: 800, y: 140, w: 20, h: 680 },    // living | bedroom
  { x: 1460, y: 140, w: 20, h: 660 },   // bedroom | powder/bath
  { x: 1480, y: 440, w: 660, h: 40 },   // powder | bath
  { x: 240, y: 820, w: 1660, h: 20 },   // north rooms | courtyard north band
  { x: 1900, y: 820, w: 240, h: 20 },   // band tail to east wall
  { x: 240, y: 840, w: 320, h: 260 },   // sealed west pocket (store area)
  { x: 1900, y: 840, w: 20, h: 240 },   // courtyard east wall
  { x: 1920, y: 800, w: 220, h: 280 },  // sealed east area
  { x: 240, y: 1080, w: 580, h: 40 },   // kitchen north wall
  { x: 820, y: 1080, w: 640, h: 40 },   // dining north wall
  { x: 1480, y: 1080, w: 660, h: 40 },  // confession north wall
  { x: 800, y: 1100, w: 20, h: 280 },   // kitchen | dining
  { x: 1460, y: 1100, w: 20, h: 280 },  // dining | confession
  // Jail cage frame (Alakkukallu)
  { x: 2240, y: 160, w: 140, h: 16 },    // cage back
  { x: 2364, y: 160, w: 16, h: 400 },    // cage right
  { x: 2240, y: 544, w: 124, h: 16 },    // cage front (here gate opens)
  // Panippura (tasks) hut
  { x: 30, y: 120, w: 170, h: 16 },      // hut top
  { x: 30, y: 120, w: 16, h: 240 },      // hut left
  { x: 184, y: 120, w: 16, h: 240 },     // hut right
  { x: 30, y: 344, w: 170, h: 16 },      // hut bottom
];

// Door openings carved out of the walls above
export const DOORWAYS = [
  { x: 1140, y: 1676, w: 120, h: 24 },   // front gate
  { x: 1080, y: 1380, w: 240, h: 24 },   // main entrance -> dining (foyer)
  { x: 2148, y: 520, w: 32, h: 160 },    // bathroom -> east garden
  { x: 1760, y: 440, w: 100, h: 40 },    // powder -> bath corridor
  { x: 640, y: 820, w: 120, h: 20 },     // living -> courtyard
  { x: 300, y: 120, w: 100, h: 24 },     // living -> north garden (janasabha side)
  { x: 950, y: 820, w: 100, h: 20 },     // bedroom -> courtyard
  { x: 1220, y: 820, w: 100, h: 20 },    // bedroom -> courtyard
  { x: 1580, y: 820, w: 100, h: 20 },    // bath -> courtyard
  { x: 620, y: 1080, w: 120, h: 40 },    // kitchen -> courtyard
  { x: 700, y: 1160, w: 100, h: 96 },    // kitchen counter east-end pass (opens the stove/stations aisle)
  { x: 1000, y: 1080, w: 280, h: 40 },   // dining (steps) -> courtyard
  { x: 1580, y: 1080, w: 100, h: 40 },   // confession -> courtyard
  { x: 2318, y: 530, w: 42, h: 30 },     // jail cell door
  { x: 100, y: 344, w: 46, h: 16 },      // panippura hut door
];

export const SOLID = [...BOUNDARY, ...OUTER, ...WALLS];

// ----- Furniture -----------------------------------------------------------
// s: true  -> solid (blocks movement)
// decals / open furniture are non-solid for easy walking.
export const FURNITURE = [
  // ================= LIVING ROOM =================
  { t: 'tv',        x: 420, y: 150, w: 190, h: 44, s: true },
  { t: 'rug',       x: 300, y: 300, w: 340, h: 280, s: false },
  { t: 'sofa',      x: 300, y: 300, w: 260, h: 70, s: true, rot: 's' },
  { t: 'sofa',      x: 248, y: 380, w: 70,  h: 180, s: true, rot: 'e' },
  { t: 'sofa',      x: 642, y: 380, w: 70,  h: 180, s: true, rot: 'w' },
  { t: 'coffee',    x: 430, y: 440, w: 70,  h: 70, s: true },
  { t: 'plant',     x: 272, y: 176, w: 40,  h: 40, s: false },
  { t: 'plant',     x: 514, y: 700, w: 40,  h: 40, s: false },
  { t: 'lamp',      x: 580, y: 720, w: 40,  h: 40, s: false },

  // ================= COMMON BEDROOM =================
  { t: 'bed',       x: 860, y: 220, w: 240, h: 130, s: true, rot: 'n' },
  { t: 'bed',       x: 1140, y: 220, w: 240, h: 130, s: true, rot: 'n' },
  { t: 'bed',       x: 860, y: 520, w: 240, h: 130, s: true, rot: 's' },
  { t: 'bed',       x: 1140, y: 520, w: 240, h: 130, s: true, rot: 's' },
  { t: 'wardrobe',  x: 832, y: 330, w: 40, h: 260, s: true },
  { t: 'wardrobe',  x: 1388, y: 330, w: 40, h: 260, s: true },
  { t: 'runner',    x: 900, y: 330, w: 460, h: 120, s: false },

  // ================= POWDER ROOM =================
  { t: 'vanity',    x: 1560, y: 148, w: 340, h: 92, s: true },
  { t: 'cabinet',   x: 1960, y: 148, w: 150, h: 72, s: true },
  { t: 'stool',     x: 1710, y: 260, w: 52,  h: 52, s: true },

  // ================= BATHROOM =================
  { t: 'sink',      x: 1930, y: 500, w: 120, h: 58, s: true },
  { t: 'tub',       x: 1500, y: 640, w: 220, h: 120, s: true },
  { t: 'shower',    x: 2000, y: 600, w: 130, h: 130, s: true },

  // ================= KITCHEN =================
  { t: 'counter',   x: 420, y: 1170, w: 340, h: 80, s: true }, // north counter w/ stove
  { t: 'counter',   x: 252, y: 1170, w: 108, h: 150, s: true }, // west counter w/ sink
  { t: 'island',    x: 460, y: 1320, w: 200, h: 52, s: true },
  { t: 'fridge',    x: 360, y: 1280, w: 40, h: 55, s: true },
  { t: 'shelf',     x: 470, y: 1132, w: 60, h: 38, s: false },

  // ================= DINING AREA (raised) =================
  // Table + chairs leave a clear north aisle off the steps and open
  // east/west/south circulation so the room is fully walkable.
  { t: 'table_round', x: 1030, y: 1160, w: 200, h: 180, s: true },
  { t: 'chair',     x: 1004, y: 1210, w: 26, h: 26, s: true },
  { t: 'chair',     x: 1004, y: 1290, w: 26, h: 26, s: true },
  { t: 'chair',     x: 1244, y: 1200, w: 26, h: 26, s: true },
  { t: 'chair',     x: 1244, y: 1300, w: 26, h: 26, s: true },
  { t: 'chair',     x: 1060, y: 1300, w: 26, h: 26, s: true },
  { t: 'chair',     x: 1144, y: 1300, w: 26, h: 26, s: true },

  // ================= CONFESSION ROOM =================
  { t: 'sofa2',     x: 1680, y: 1240, w: 220, h: 80, s: true },

  // ================= CENTRAL GARDEN (courtyard) =================
  { t: 'planter',   x: 600, y: 880, w: 130, h: 42, s: true },
  { t: 'planter',   x: 1730, y: 880, w: 130, h: 42, s: true },
  { t: 'bench',     x: 830, y: 985, w: 150, h: 50, s: true },
  { t: 'bench',     x: 1620, y: 985, w: 150, h: 50, s: true },
  { t: 'fountain',  x: 1140, y: 900, w: 72, h: 72, s: true },

  // ================= FRONT GARDEN =================
  { t: 'tree',      x: 520,  y: 1460, w: 90, h: 90, s: true },
  { t: 'tree',      x: 1650, y: 1440, w: 90, h: 90, s: true },
  { t: 'tree',      x: 1960, y: 1500, w: 90, h: 90, s: true },
  { t: 'tree',      x: 360,  y: 1580, w: 90, h: 90, s: true },

  // ================= GARDENS (north/east/west) =================
  { t: 'tree',      x: 150, y: 44, w: 70, h: 70, s: true },
  { t: 'tree',      x: 2200, y: 900, w: 90, h: 90, s: true },
  { t: 'sitout',    x: 60, y: 980, w: 120, h: 70, s: true },
  { t: 'lawnchair', x: 2280, y: 780, w: 70, h: 44, s: true },
  { t: 'lawnchair', x: 2280, y: 860, w: 70, h: 44, s: true },

  // ================= JANASABHA (Democracy Room / pavilion) =================
  { t: 'stage',     x: 1040, y: 20, w: 320, h: 100, s: true },
  { t: 'podium',    x: 1160, y: 34, w: 80,  h: 48, s: false },
  { t: 'ballot',    x: 1280, y: 44, w: 44,  h: 44, s: false },

  // ================= JAIL (Alakkukallu) =================
  { t: 'jailbed',   x: 2270, y: 220, w: 90, h: 80, s: true },
  { t: 'bar',       x: 2240, y: 176, w: 8, h: 368, s: true },
  { t: 'bar',       x: 2262, y: 176, w: 8, h: 368, s: true },
  { t: 'bar',       x: 2284, y: 176, w: 8, h: 368, s: true },
  { t: 'bar',       x: 2306, y: 176, w: 8, h: 368, s: true },
  { t: 'bar',       x: 2360, y: 176, w: 8, h: 368, s: true },

  // ================= PANIPPURA (Tasks room) =================
  { t: 'shelf',     x: 50, y: 138, w: 70, h: 84, s: true },
  { t: 'treasure',  x: 120, y: 150, w: 60, h: 60, s: true },
  { t: 'treasure',  x: 150, y: 300, w: 60, h: 40, s: true },
];

// Doors also function as a few draw-friendly "openings"
export const DOORS = DOORWAYS;

// Task Arena: the marked spot in the Central Garden where Bigg Boss games are
// answered. Players must physically stand inside to take part.
export const ARENA = { x: 1240, y: 870, w: 340, h: 150 };
export function pointInArena(x, y) {
  return x >= ARENA.x && x <= ARENA.x + ARENA.w && y >= ARENA.y && y <= ARENA.y + ARENA.h;
}

export const SPAWN = { x: 1140, y: 1035 };

// ----- Collision grid ------------------------------------------------------
// A walkable bitmap. 0 = blocked, 1 = walkable.
export function buildGrid() {
  const cols = Math.ceil(WORLD.w / CELL);
  const rows = Math.ceil(WORLD.h / CELL);
  const grid = new Uint8Array(cols * rows);
  // Everything walkable first
  for (let i = 0; i < grid.length; i++) grid[i] = 1;

  // strict: solids/furniture stop at their exact edge so a wall exactly
  // CELL-aligned (e.g. y 1080..1100) does not swallow the walkable floor in
  // the 20px cell that holds its edge. Doorways are marked wide (inclusive)
  // so each opening stays a comfortable multi-cell throat for the player.
  const markRect = (x, y, w, h, v, strict) => {
    const x0 = Math.max(0, Math.floor(x / CELL));
    const y0 = Math.max(0, Math.floor(y / CELL));
    const x1 = Math.min(cols - 1, strict ? Math.floor((x + w - 0.001) / CELL) : Math.floor((x + w) / CELL));
    const y1 = Math.min(rows - 1, strict ? Math.floor((y + h - 0.001) / CELL) : Math.floor((y + h) / CELL));
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        grid[cy * cols + cx] = v;
      }
    }
  };

  for (const r of SOLID) markRect(r.x, r.y, r.w, r.h, 0, true);
  for (const f of FURNITURE) if (f.s) markRect(f.x, f.y, f.w, f.h, 0, true);
  for (const d of DOORWAYS) markRect(d.x, d.y, d.w, d.h, 1, false);

  return { grid, cols, rows, cell: CELL };
}

export function isWalkable(grid, cols, rows, x, y) {
  const cx = Math.floor(x / CELL);
  const cy = Math.floor(y / CELL);
  if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return false;
  return grid[cy * cols + cx] === 1;
}

export function pointInRoom(x, y) {
  for (const r of ROOMS) {
    if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return r;
  }
  for (const zone of Object.values(GARDEN_ZONES)) {
    if (x >= zone.x && x < zone.x + zone.w && y >= zone.y && y < zone.y + zone.h) {
      return { id: zone.name.toLowerCase().replace(/\s+/g, '_'), name: zone.name, garden: true };
    }
  }
  return { id: 'grounds', name: 'House Grounds' };
}