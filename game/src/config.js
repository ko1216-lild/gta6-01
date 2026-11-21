// Final recorded pass (config): re-issued with the authored hand-in; no tuning value was changed.
// Every tuning number and colour for Neon Tide: Coral Bay in one place. The view is a fixed
// 1280x720 logical area that the renderer scales to the window; the world is a much larger
// city the camera moves through, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The whole city of Coral Bay, in world pixels. The sea takes the east edge. */
export const WORLD = { width: 3600, height: 2760, waterX: 3420, sandX: 3300 };

export const PLAYER = {
  radius: 13,
  walkSpeed: 185,
  health: 100,
  punchRange: 40,
  punchCooldown: 0.38,
  punchDamage: 34,
};

/** Car kinds: how they look and how they drive. Police is its own kind so it reads at a glance. */
export const CAR_TYPES = {
  sedan: { name: 'Marlin Sedan', width: 46, height: 22, topSpeed: 335, accel: 210, colors: ['#c94f42', '#4a7fb5', '#c9c9c9', '#3f9e63', '#7a4fa3', '#d9a441'] },
  hatch: { name: 'Pico Hatch', width: 40, height: 20, topSpeed: 295, accel: 200, colors: ['#e0e0e0', '#e2703a', '#58a6c9', '#8bc34a', '#f2d13c'] },
  sport: { name: 'Vantara GT', width: 48, height: 21, topSpeed: 460, accel: 320, colors: ['#ffcf3f', '#ff5e78', '#27e0c9', '#f5f5f5'] },
  van: { name: 'Hauler Van', width: 54, height: 24, topSpeed: 265, accel: 165, colors: ['#d8d8d8', '#7f8c99', '#b5533c'] },
  police: { name: 'CBPD Interceptor', width: 47, height: 22, topSpeed: 430, accel: 300, colors: ['#1d2733'] },
};
export const TRAFFIC_KINDS = ['sedan', 'sedan', 'hatch', 'hatch', 'van', 'sport'];

export const TUNING = {
  trafficCars: 12,
  parkedCars: 11,
  peds: 22,
  crimeCooldown: 0.8,
  wantedDecayDelay: 22,
  wantedDecayEvery: 14,
  bustFillTime: 2.4,
  bustRange: 95,
  cashSpawnEvery: 18,
};

export const PALETTE = {
  backdrop: '#171024',
  grass: '#3e7d46',
  parkPath: '#cbb98a',
  sidewalk: '#b9b3a4',
  curb: '#8f897c',
  road: '#33333d',
  roadEdge: '#26262e',
  lane: '#e8d44d',
  sand: '#ecd28f',
  water: '#1d6f8e',
  waterLight: '#2b8cae',
  pier: '#8a6844',
  player: '#ffd23c',
  playerSkin: '#c98a5e',
  pedShirts: ['#e2703a', '#58a6c9', '#8bc34a', '#e5e5e5', '#b565a7', '#f2d13c', '#4fc3f7'],
  marker: '#ffd23c',
  policeLightA: '#ff5252',
  policeLightB: '#4fc3f7',
  text: '#fdf6ec',
  muted: '#cbb9d9',
  panel: 'rgba(16, 10, 28, 0.82)',
  health: '#58d977',
  healthLow: '#ff5252',
  cash: '#7be495',
};

export const FONT = '"Trebuchet MS", system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the save is kept between visits (this browser only). */
export const SAVE_KEY = 'neon-tide-coral-bay.save.v1';
