// Round 2 revision note: re-issued in the recorded session; the city layout is unchanged.
// Coral Bay itself: the road grid, the blocks and buildings between the roads, the beach and
// pier on the east edge, the named landmarks the story uses, and the collision tests every
// mover shares. Built once from a seeded random, so the city is the same on every visit.
import { WORLD } from './config.js';

export const ROAD_W = 112;
/** How far from a road's centre its driving lanes sit (right-hand traffic). */
export const LANE = ROAD_W / 4;

const ROOFS = ['#e8b4a0', '#d97b6c', '#f2d8a7', '#9fc6d8', '#b5d99c', '#e5e0ea', '#f0a868', '#c9d6df', '#e88ca0'];

/** Named buildings: a rect on the map, a sign for the renderer, and the kerb point missions use. */
const LANDMARKS = [
  { key: 'motel', name: 'Palms Motel', x: 392, y: 372, w: 150, h: 96, roof: '#e88ca0', ax: 467, ay: 522 },
  { key: 'pawn', name: 'Sunset Pawn', x: 1500, y: 852, w: 120, h: 90, roof: '#f2d8a7', ax: 1560, ay: 996 },
  { key: 'garage', name: 'Torque & Tide Garage', x: 950, y: 1332, w: 170, h: 100, roof: '#9fc6d8', ax: 1035, ay: 1486 },
  { key: 'station', name: 'CBPD Station', x: 2050, y: 382, w: 180, h: 110, roof: '#7f8c99', ax: 2140, ay: 546 },
  { key: 'hospital', name: 'Coral Bay General', x: 1150, y: 1852, w: 190, h: 110, roof: '#e5e0ea', ax: 1245, ay: 2016 },
  { key: 'gunshop', name: 'Solana Arms', x: 2680, y: 902, w: 110, h: 80, roof: '#b5533c', ax: 2735, ay: 1036 },
  { key: 'warehouse', name: 'Pier 9 Warehouse', x: 2500, y: 2400, w: 300, h: 120, roof: '#8a6844', ax: 2650, ay: 2346 },
  { key: 'beachclub', name: 'The Salty Gull', x: 3152, y: 600, w: 92, h: 70, roof: '#58a6c9', ax: 3198, ay: 724 },
];

/** The park block (kept clear of buildings) and the pier the last mission runs to. */
export const PARK = { x: 396, y: 1352, w: 372, h: 288 };
export const PIER = { x: 3290, y: 1232, w: 280, h: 56 };

function rectsOverlap(a, b, pad) {
  return a.x - pad < b.x + b.w && a.x + a.w + pad > b.x && a.y - pad < b.y + b.h && a.y + a.h + pad > b.y;
}

export function createCity(random) {
  const roadsV = [300, 860, 1420, 1980, 2540, 3100].map((cx) => ({ cx, w: ROAD_W }));
  const roadsH = [300, 780, 1260, 1740, 2220].map((cy) => ({ cy, h: ROAD_W }));
  const buildings = LANDMARKS.map((mark) => ({ ...mark, landmark: true }));
  const pois = {};
  for (const mark of LANDMARKS) pois[mark.key] = { x: mark.ax, y: mark.ay };
  pois.docks = { x: 2650, y: 2346 };
  pois.park = { x: 582, y: 1496 };
  pois.alley = { x: 1690, y: 1196 };
  pois.beach = { x: 3345, y: 700 };
  pois.beachLot = { x: 3170, y: 1150 };
  pois.pier = { x: 3500, y: 1260 };
  pois.motelCar = { x: 560, y: 470 };

  // Procedural buildings fill each block cell between roads, one to four to a cell, kept clear
  // of the landmarks, the park and the docks strip along the south edge.
  const xEdges = [36, ...roadsV.flatMap((r) => [r.cx - r.w / 2, r.cx + r.w / 2]), WORLD.sandX - 24];
  const yEdges = [36, ...roadsH.flatMap((r) => [r.cy - r.h / 2, r.cy + r.h / 2]), WORLD.height - 36];
  const docks = { x: 2280, y: 2300, w: 1020, h: 460 };
  for (let xi = 0; xi < xEdges.length - 1; xi += 2) {
    for (let yi = 0; yi < yEdges.length - 1; yi += 2) {
      const cell = { x: xEdges[xi] + 26, y: yEdges[yi] + 26, w: xEdges[xi + 1] - xEdges[xi] - 52, h: yEdges[yi + 1] - yEdges[yi] - 52 };
      if (cell.w < 90 || cell.h < 80) continue;
      if (rectsOverlap(cell, PARK, 4) || rectsOverlap(cell, docks, 4)) continue;
      // A landmark stands alone on its block, so its sign and its kerb stay clear.
      if (LANDMARKS.some((mark) => rectsOverlap(cell, mark, 0))) continue;
      const cols = cell.w > 300 ? 2 : 1;
      const rows = cell.h > 260 ? 2 : 1;
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          const gap = 20;
          const rect = {
            x: cell.x + (cell.w / cols) * c + gap / 2,
            y: cell.y + (cell.h / rows) * r + gap / 2,
            w: cell.w / cols - gap,
            h: cell.h / rows - gap,
          };
          if (buildings.some((b) => rectsOverlap(rect, b, 10))) continue;
          buildings.push({ ...rect, roof: ROOFS[Math.floor(random() * ROOFS.length)], floors: 2 + Math.floor(random() * 7), landmark: false });
        }
      }
    }
  }

  // Props: palms along the beach and the park, lamps along the roads, crates at the docks.
  const props = [];
  for (let y = 120; y < WORLD.height - 80; y += 110 + random() * 90) {
    props.push({ x: WORLD.sandX - 34 - random() * 26, y, kind: 'palm' });
  }
  for (let i = 0; i < 9; i += 1) {
    props.push({ x: PARK.x + 30 + random() * (PARK.w - 60), y: PARK.y + 30 + random() * (PARK.h - 60), kind: 'palm' });
  }
  for (const road of roadsV) {
    for (let y = 150; y < WORLD.height - 60; y += 230) props.push({ x: road.cx - ROAD_W / 2 - 10, y, kind: 'lamp' });
  }
  for (let i = 0; i < 7; i += 1) {
    props.push({ x: 2380 + random() * 760, y: 2300 + random() * 60, kind: 'crate' });
  }

  // Kerbside parking spots along the vertical roads, clear of junctions.
  const parkedSpots = [];
  for (const road of roadsV) {
    for (let y = 190; y < WORLD.height - 140; y += 290) {
      if (roadsH.some((h) => Math.abs(h.cy - y) < 120)) continue;
      const side = parkedSpots.length % 2 === 0 ? 1 : -1;
      parkedSpots.push({ x: road.cx + side * (ROAD_W / 2 - 16), y: y + random() * 60, angle: side > 0 ? Math.PI / 2 : -Math.PI / 2 });
    }
  }

  return { roadsV, roadsH, buildings, props, pois, parkedSpots };
}

/** Is this point on a road (asphalt), allowing a small margin? */
export function isOnRoad(city, x, y) {
  for (const road of city.roadsV) if (Math.abs(x - road.cx) <= road.w / 2) return true;
  for (const road of city.roadsH) if (Math.abs(y - road.cy) <= road.h / 2) return true;
  return false;
}

function onPier(x, y) {
  return x >= PIER.x - 6 && x <= PIER.x + PIER.w + 6 && y >= PIER.y - 6 && y <= PIER.y + PIER.h + 6;
}

/**
 * Push a circle at (x, y) out of every building and keep it in the world and out of the sea.
 * Cars stop at the sand; a walker may wade a little and walk the pier. Returns the fixed point.
 */
export function collideCircle(city, x, y, r, isCar) {
  let px = Math.max(r, Math.min(WORLD.width - r, x));
  let py = Math.max(r, Math.min(WORLD.height - r, y));
  const limitX = onPier(px, py) ? WORLD.width - 14 : isCar ? WORLD.sandX + 26 : WORLD.waterX + 42;
  if (px > limitX) px = limitX;
  for (const b of city.buildings) {
    const nx = Math.max(b.x, Math.min(px, b.x + b.w));
    const ny = Math.max(b.y, Math.min(py, b.y + b.h));
    const dx = px - nx;
    const dy = py - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      px = nx + (dx / d) * r;
      py = ny + (dy / d) * r;
    } else {
      // Centre inside the rect: leave by the nearest face.
      const left = px - b.x;
      const right = b.x + b.w - px;
      const top = py - b.y;
      const bottom = b.y + b.h - py;
      const min = Math.min(left, right, top, bottom);
      if (min === left) px = b.x - r;
      else if (min === right) px = b.x + b.w + r;
      else if (min === top) py = b.y - r;
      else py = b.y + b.h + r;
    }
  }
  return { x: px, y: py };
}
