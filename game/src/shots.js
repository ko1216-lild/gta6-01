// Final recorded pass (shots): re-issued with the authored hand-in; the staged scenes are unchanged.
// The screenshot scenes behind ?shot=start|drive|mission|chase. Each one resets the world,
// arranges a real moment of the game (the same state the rules produce in play — a drive in
// traffic, a mission marker with dialogue up, a three-star chase), settles it for a fixed
// number of steps and reports the screen to paint. Same seed, same frame, every time.
import { CAR_TYPES } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const IDLE = { mx: 0, my: 0, up: false, down: false, enterPressed: false, meleePressed: false, shootHeld: false, confirmPressed: false };

function settle(world, steps, input) {
  const activeInput = input ?? IDLE;
  let remaining = steps;
  while (remaining > 0) {
    world.step(1 / 60, activeInput);
    remaining -= 1;
  }
}

function nearestCar(state, x, y, mode) {
  let best = null;
  let bestD = Infinity;
  for (const car of state.cars) {
    if (mode && car.mode !== mode) continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

/** Put Marco in a car and the car on a road, already rolling south. */
function putPlayerDriving(world, x, y) {
  const state = world.state;
  const car = nearestCar(state, state.city.pois.motelCar.x, state.city.pois.motelCar.y, 'parked');
  car.mode = 'player';
  car.x = x;
  car.y = y;
  car.angle = Math.PI / 2;
  car.speed = 230;
  state.player.inCar = car;
  state.player.x = x;
  state.player.y = y;
  return car;
}

/** Move traffic out of a rectangle, so a staged drive has a clear road ahead. */
function clearArea(state, x0, y0, x1, y1) {
  for (const car of state.cars) {
    if (car.mode !== 'traffic') continue;
    if (car.x > x0 && car.x < x1 && car.y > y0 && car.y < y1) car.pos += 1400;
  }
}

export function stageShot(name, world) {
  const state = world.state;
  world.reset(null);
  if (name === 'drive') {
    putPlayerDriving(world, 888, 560);
    clearArea(state, 740, 360, 1040, 1320);
    settle(world, 95, { ...IDLE, up: true });
    return { screen: SCREEN_PLAY };
  }
  if (name === 'mission') {
    settle(world, 90);
    state.mission.step = 1; // the drive to Pier 9, marker on the warehouse
    state.player.x = 2470;
    state.player.y = 2300;
    state.dialogue.lines = ['Rosa: Quiet pays nothing, baby. My Marlin is parked round the side — take it down to Pier 9.'];
    state.dialogue.index = 0;
    state.dialogue.t = 0;
    return { screen: SCREEN_PLAY };
  }
  if (name === 'chase') {
    putPlayerDriving(world, 1448, 940);
    clearArea(state, 1300, 700, 1600, 1560);
    state.wanted = 3;
    state.crimeT = 0;
    // Three nearby traffic cars become the interceptors on Marco's tail.
    const px = state.player.x;
    const py = state.player.y;
    const spots = [[0, -125], [0, -215], [0, -305]];
    let used = 0;
    for (const car of state.cars) {
      if (used >= 3) break;
      if (car.mode !== 'traffic') continue;
      car.mode = 'police';
      car.kind = 'police';
      car.type = CAR_TYPES.police;
      car.color = '#1d2733';
      car.x = px + spots[used][0];
      car.y = py + spots[used][1];
      car.angle = Math.PI / 2;
      car.speed = 250;
      used += 1;
    }
    settle(world, 42, { ...IDLE, up: true });
    state.wanted = 3;
    return { screen: SCREEN_PLAY };
  }
  settle(world, 150);
  return { screen: SCREEN_TITLE };
}
