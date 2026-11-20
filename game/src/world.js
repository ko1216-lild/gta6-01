// The rules of Coral Bay, with no drawing and no browser in it: Marco on foot and in cars,
// traffic that drives the road grid, pedestrians, police and the wanted level, combat,
// pickups, and the mission chain from missions.js. step() advances one fixed step, reads an
// input object and returns what happened as bit flags, so main can answer with sound.
import { CAR_TYPES, PLAYER, TRAFFIC_KINDS, TUNING, WORLD } from './config.js';
import { LANE, collideCircle, createCity, isOnRoad } from './city.js';
import { MISSIONS } from './missions.js';

export const EVENT_SHOT = 1;
export const EVENT_PUNCH = 2;
export const EVENT_CASH = 4;
export const EVENT_PICKUP = 8;
export const EVENT_CRIME = 16;
export const EVENT_MISSION = 32;
export const EVENT_ENTER = 64;
export const EVENT_CRASH = 128;
export const EVENT_NOGUN = 256;

const TAU = Math.PI * 2;

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function angleTo(from, to) {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

function turnToward(angle, target, maxTurn) {
  let diff = (target - angle) % TAU;
  if (diff > Math.PI) diff -= TAU;
  if (diff < -Math.PI) diff += TAU;
  return angle + Math.max(-maxTurn, Math.min(maxTurn, diff));
}

export function createWorld(random) {
  const city = createCity(random);
  const player = {
    x: city.pois.motel.x, y: city.pois.motel.y + 42, angle: -Math.PI / 2,
    health: PLAYER.health, money: 60, inCar: null, hasGun: false, ammo: 0,
    punchT: 0, fireT: 0, bust: 0, speedNow: 0,
  };
  const state = {
    city, player, cars: [], peds: [], pickups: [], bullets: [], texts: [],
    wanted: 0, crimeT: 99, decayT: 0, time: 0, shake: 0, cashT: 8, policeT: 0,
    mission: { index: 0, step: 0 }, storyComplete: false,
    dialogue: { lines: [], index: 0, t: 0 }, pendingNext: false,
    markedCar: null, over: null, hint: '', justCompleted: false,
  };

  // ---- cars ---------------------------------------------------------------
  let carId = 0;
  function makeCar(kind, x, y, angle, mode) {
    const type = CAR_TYPES[kind];
    const car = {
      id: carId += 1, kind, type, x, y, angle, speed: 0, mode,
      color: type.colors[Math.floor(random() * type.colors.length)],
      health: 100, axis: 'v', line: 0, dir: 1, pos: 0, lastCross: -1, stuck: 0, marked: false,
    };
    state.cars.push(car);
    return car;
  }

  /** Put a car on the road grid: it will drive one road, turning at junctions. */
  function putOnRoad(car, nearX, nearY) {
    const useV = random() < 0.5;
    if (useV) {
      const road = city.roadsV[Math.floor(random() * city.roadsV.length)];
      car.axis = 'v'; car.line = road.cx; car.dir = random() < 0.5 ? 1 : -1;
      car.pos = nearY !== undefined && Math.abs(road.cx - nearX) < 200 ? nearY : 200 + random() * (WORLD.height - 400);
    } else {
      const road = city.roadsH[Math.floor(random() * city.roadsH.length)];
      car.axis = 'h'; car.line = road.cy; car.dir = random() < 0.5 ? 1 : -1;
      car.pos = nearX !== undefined && Math.abs(road.cy - nearY) < 200 ? nearX : 200 + random() * (WORLD.width - 500);
    }
    syncRoadCar(car);
  }

  function syncRoadCar(car) {
    if (car.axis === 'v') {
      car.x = car.line + (car.dir > 0 ? LANE : -LANE);
      car.y = car.pos;
      car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      car.x = car.pos;
      car.y = car.line + (car.dir > 0 ? LANE : -LANE);
      car.angle = car.dir > 0 ? 0 : Math.PI;
    }
  }

  function spawnTraffic() {
    const kind = TRAFFIC_KINDS[Math.floor(random() * TRAFFIC_KINDS.length)];
    const car = makeCar(kind, 0, 0, 0, 'traffic');
    putOnRoad(car);
    car.speed = car.type.topSpeed * (0.45 + random() * 0.2);
    return car;
  }

  function spawnParked(spot) {
    const kind = TRAFFIC_KINDS[Math.floor(random() * TRAFFIC_KINDS.length)];
    return makeCar(kind, spot.x, spot.y, spot.angle, 'parked');
  }

  function spawnPolice() {
    // Come from a junction a few streets away, already on the road and rolling.
    const car = makeCar('police', 0, 0, 0, 'police');
    const options = [];
    for (const rv of city.roadsV) for (const rh of city.roadsH) options.push({ x: rv.cx, y: rh.cy });
    let best = options[0];
    let bestScore = -1;
    for (const point of options) {
      const d = Math.hypot(point.x - player.x, point.y - player.y);
      const score = d > 620 && d < 1100 ? 1 : 0;
      if (score > bestScore) { bestScore = score; best = point; }
    }
    car.x = best.x + (random() - 0.5) * 60;
    car.y = best.y + (random() - 0.5) * 60;
    car.speed = 200;
    return car;
  }

  // ---- pedestrians ----------------------------------------------------------
  function spawnPed(x, y) {
    const ped = {
      x: x ?? 0, y: y ?? 0, angle: 0, speed: 52 + random() * 26, health: 30,
      mode: 'walk', axis: 'v', line: 0, dir: 1, pos: 0, side: 1, fleeT: 0, downT: 0,
      shirt: Math.floor(random() * 7), threat: null,
    };
    if (x === undefined) {
      const useV = random() < 0.5;
      if (useV) {
        const road = city.roadsV[Math.floor(random() * city.roadsV.length)];
        ped.axis = 'v'; ped.line = road.cx; ped.pos = 150 + random() * (WORLD.height - 300);
      } else {
        const road = city.roadsH[Math.floor(random() * city.roadsH.length)];
        ped.axis = 'h'; ped.line = road.cy; ped.pos = 150 + random() * (WORLD.width - 400);
      }
      ped.side = random() < 0.5 ? 1 : -1;
      ped.dir = random() < 0.5 ? 1 : -1;
      syncPed(ped);
    }
    state.peds.push(ped);
    return ped;
  }

  function syncPed(ped) {
    const off = ped.side * (LANE * 2 + 13);
    if (ped.axis === 'v') {
      ped.x = ped.line + off;
      ped.y = ped.pos;
      ped.angle = ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      ped.x = ped.pos;
      ped.y = ped.line + off;
      ped.angle = ped.dir > 0 ? 0 : Math.PI;
    }
  }

  // ---- pickups, crimes, floating texts --------------------------------------
  function addPickup(x, y, kind, amount, respawn) {
    state.pickups.push({ x, y, kind, amount, respawn: respawn ?? 0, active: true, t: random() * 6 });
  }

  function addText(x, y, text, color) {
    state.texts.push({ x, y, text, color, t: 0 });
  }

  /** A crime the city notices: at least `floor` stars, the decay clock restarts. */
  function crime(floor, events) {
    state.wanted = Math.min(5, Math.max(state.wanted, floor));
    state.crimeT = 0;
    state.decayT = 0;
    return events | EVENT_CRIME;
  }

  function addWanted(n) {
    state.wanted = Math.min(5, state.wanted + n);
    state.crimeT = 0;
    state.decayT = 0;
  }

  // ---- missions ---------------------------------------------------------------
  function currentMission() {
    return state.storyComplete ? null : MISSIONS[state.mission.index];
  }

  function currentStep() {
    const mission = currentMission();
    return mission ? mission.steps[state.mission.step] : null;
  }

  function stepPoint(step) {
    if ((step.kind === 'steal' || step.kind === 'deliver') && state.markedCar) {
      return step.kind === 'deliver' ? city.pois[step.at] : state.markedCar;
    }
    return city.pois[step.at];
  }

  function say(lines) {
    state.dialogue.lines = lines.slice();
    state.dialogue.index = 0;
    state.dialogue.t = 0;
  }

  function startMission(index) {
    state.mission.index = index;
    state.mission.step = 0;
    const mission = MISSIONS[index];
    say(mission.intro);
    setupStep();
    state.hint = `New job: ${mission.title}`;
  }

  function setupStep() {
    const step = currentStep();
    if (!step) return;
    if (step.setWanted) crime(step.setWanted, 0);
    if (step.kind === 'steal') {
      const at = city.pois[step.at];
      state.markedCar = makeCar('sport', at.x + 26, at.y - 30, Math.PI / 2, 'parked');
      state.markedCar.color = '#ffcf3f';
      state.markedCar.marked = true;
    }
    if (step.kind === 'collect') {
      const at = city.pois[step.at];
      addPickup(at.x, at.y, 'bag', 0, 0);
    }
  }

  function completeMission(events) {
    const mission = currentMission();
    player.money += mission.reward;
    addText(player.x, player.y - 30, `+$${mission.reward}`, '#7be495');
    if (mission.giveGun) {
      player.hasGun = true;
      player.ammo += 24;
      addText(player.x, player.y - 52, 'Pistol acquired', '#ffd23c');
    }
    say(mission.outro);
    state.pendingNext = true;
    if (state.mission.index === MISSIONS.length - 1) state.justCompleted = true;
    return events | EVENT_MISSION | EVENT_CASH;
  }

  function advanceStep(events) {
    state.mission.step += 1;
    const mission = currentMission();
    if (state.mission.step >= mission.steps.length) return completeMission(events);
    setupStep();
    return events;
  }

  function checkStep(events) {
    const step = currentStep();
    if (!step) return events;
    const at = stepPoint(step);
    const d = Math.hypot(player.x - at.x, player.y - at.y);
    switch (step.kind) {
      case 'goto':
        if (d < 92 && (!step.needCar || player.inCar)) return advanceStep(events);
        break;
      case 'enterCar':
        if (player.inCar && d < 130) return advanceStep(events);
        break;
      case 'steal':
        if (player.inCar && player.inCar === state.markedCar) return advanceStep(events);
        break;
      case 'deliver':
        if (player.inCar && player.inCar === state.markedCar && d < 104) return advanceStep(events);
        break;
      case 'escape':
        if (d < 84) return advanceStep(events);
        break;
      default:
        break; // collect steps advance when the bag is picked up
    }
    return events;
  }

  /** The marker the HUD and minimap show: where the current step wants Marco. */
  function marker() {
    const step = currentStep();
    if (!step) return null;
    const at = stepPoint(step);
    return { x: at.x, y: at.y, text: step.text };
  }

  // ---- traffic ----------------------------------------------------------------
  /** The nearest thing ahead of a road car in its lane: a car, the player's car, or a walker. */
  function obstacleAhead(car) {
    let nearest = Infinity;
    const fx = Math.cos(car.angle);
    const fy = Math.sin(car.angle);
    const test = (ox, oy, radius) => {
      const dx = ox - car.x;
      const dy = oy - car.y;
      const ahead = dx * fx + dy * fy;
      const side = Math.abs(dx * -fy + dy * fx);
      if (ahead > 0 && ahead < nearest && side < 24 + radius) nearest = ahead;
    };
    for (const other of state.cars) {
      if (other !== car && other.mode !== 'wreck') test(other.x, other.y, 6);
    }
    for (const ped of state.peds) if (ped.mode !== 'down') test(ped.x, ped.y, 0);
    return nearest;
  }

  function updateTraffic(car, dt) {
    const gap = obstacleAhead(car);
    const cruise = car.type.topSpeed * 0.55;
    let target = cruise;
    if (gap < 88) target = Math.min(target, Math.max(0, (gap - 44) * 2.2));
    car.speed += Math.max(-320 * dt, Math.min(150 * dt, target - car.speed));
    if (car.speed < 0) car.speed = 0;
    car.pos += car.dir * car.speed * dt;
    // Junctions: crossing a perpendicular road's centre is a chance to turn onto it.
    const crosses = car.axis === 'v' ? city.roadsH : city.roadsV;
    for (const road of crosses) {
      const centre = car.axis === 'v' ? road.cy : road.cx;
      if (Math.abs(car.pos - centre) < Math.max(2, car.speed * dt) && state.time > 0 && random() < 0.30) {
        const along = car.line;
        car.axis = car.axis === 'v' ? 'h' : 'v';
        car.line = centre;
        car.dir = random() < 0.5 ? 1 : -1;
        car.pos = along;
        break;
      }
    }
    const limit = car.axis === 'v' ? WORLD.height : WORLD.width;
    if (car.pos < 90 || car.pos > limit - 90) car.dir *= -1;
    car.pos = Math.max(70, Math.min(limit - 70, car.pos));
    syncRoadCar(car);
  }

  // ---- police -------------------------------------------------------------------
  function updatePolice(car, dt) {
    const target = player.inCar ? player.inCar : player;
    const d = dist(car, target);
    const want = angleTo(car, target);
    if (car.stuck > 0) {
      car.stuck -= dt;
      car.speed = Math.max(-120, car.speed - 260 * dt);
      car.angle += 1.6 * dt;
    } else {
      car.angle = turnToward(car.angle, want, 2.7 * dt);
      let top = car.type.topSpeed * (d > 340 ? 1 : 0.8);
      if (!player.inCar && d < 52) top = 0; // pull up beside a runner, ready for the bust
      if (player.inCar && d < 30) top = Math.min(top, Math.abs(player.inCar.speed) + 30);
      car.speed += Math.max(-380 * dt, Math.min(300 * dt, top - car.speed));
    }
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const fixed = collideCircle(city, nx, ny, car.type.width / 2, true);
    if (Math.hypot(fixed.x - nx, fixed.y - ny) > 4 && Math.abs(car.speed) > 120) car.stuck = 0.55;
    car.x = fixed.x;
    car.y = fixed.y;
  }

  function policeCount() {
    return state.cars.filter((car) => car.mode === 'police').length;
  }

  function updatePoliceForce(dt) {
    if (state.wanted > 0) {
      state.policeT -= dt;
      if (policeCount() < Math.min(5, state.wanted + 1) && state.policeT <= 0) {
        spawnPolice();
        state.policeT = 2.5;
      }
    } else {
      // Heat off: the interceptors peel away and become ordinary traffic.
      for (const car of state.cars) {
        if (car.mode === 'police') {
          car.mode = 'traffic';
          car.kind = 'sedan';
          car.type = CAR_TYPES.sedan;
          car.color = '#4a7fb5';
          putOnRoad(car, car.x, car.y);
        }
      }
    }
  }

  // ---- pedestrians ----------------------------------------------------------------
  function scarePeds(x, y, radius) {
    for (const ped of state.peds) {
      if (ped.mode === 'down') continue;
      if (Math.hypot(ped.x - x, ped.y - y) < radius) {
        ped.mode = 'flee';
        ped.fleeT = 2 + random() * 2;
        ped.threat = { x, y };
      }
    }
  }

  function updatePed(ped, dt) {
    if (ped.mode === 'down') {
      ped.downT -= dt;
      if (ped.downT <= 0) {
        // The city quietly replaces its walkers; a fresh one starts across town.
        const fresh = spawnPed();
        ped.x = fresh.x; ped.y = fresh.y; ped.axis = fresh.axis; ped.line = fresh.line;
        ped.pos = fresh.pos; ped.side = fresh.side; ped.dir = fresh.dir;
        ped.mode = 'walk'; ped.health = 30;
        state.peds.splice(state.peds.indexOf(fresh), 1);
      }
      return;
    }
    if (ped.mode === 'flee') {
      ped.fleeT -= dt;
      const away = angleTo(ped.threat ?? player, ped);
      ped.angle = turnToward(ped.angle, away, 6 * dt);
      const stepX = ped.x + Math.cos(ped.angle) * 168 * dt;
      const stepY = ped.y + Math.sin(ped.angle) * 168 * dt;
      const fixed = collideCircle(city, stepX, stepY, 10, false);
      ped.x = fixed.x;
      ped.y = fixed.y;
      if (ped.fleeT <= 0) {
        ped.mode = 'walk';
        // Rejoin the nearest sidewalk line.
        let bestRoad = city.roadsV[0];
        let bestD = Infinity;
        for (const road of city.roadsV) { const d = Math.abs(road.cx - ped.x); if (d < bestD) { bestD = d; bestRoad = road; } }
        ped.axis = 'v'; ped.line = bestRoad.cx; ped.pos = ped.y; ped.side = ped.x >= bestRoad.cx ? 1 : -1;
      }
      return;
    }
    ped.pos += ped.dir * ped.speed * dt;
    const limit = ped.axis === 'v' ? WORLD.height : WORLD.width;
    if (ped.pos < 80 || ped.pos > limit - 80) ped.dir *= -1;
    ped.pos = Math.max(70, Math.min(limit - 70, ped.pos));
    syncPed(ped);
  }

  function downPed(ped, events, byPlayer) {
    if (ped.mode === 'down') return events;
    ped.mode = 'down';
    ped.downT = 7;
    scarePeds(ped.x, ped.y, 130);
    if (byPlayer) {
      events = crime(2, events);
      if (random() < 0.55) addPickup(ped.x + 8, ped.y + 6, 'cash', 5 + Math.floor(random() * 26), 0);
    }
    return events;
  }

  // ---- Marco ----------------------------------------------------------------------
  function exitCar() {
    const car = player.inCar;
    if (!car) return;
    if (car.mode !== 'wreck') car.mode = 'parked';
    player.inCar = null;
    player.x = car.x + Math.cos(car.angle - Math.PI / 2) * 30;
    player.y = car.y + Math.sin(car.angle - Math.PI / 2) * 30;
    const fixed = collideCircle(city, player.x, player.y, PLAYER.radius, false);
    player.x = fixed.x;
    player.y = fixed.y;
  }

  function enterNearestCar(events) {
    let best = null;
    let bestD = 52;
    for (const car of state.cars) {
      if (car.mode === 'wreck') continue;
      const d = dist(player, car);
      if (d < bestD) { bestD = d; best = car; }
    }
    if (!best) return events;
    const wasTraffic = best.mode === 'traffic';
    best.mode = 'player';
    best.speed = 0;
    player.inCar = best;
    player.bust = 0;
    if (wasTraffic || best.marked) {
      events = crime(1, events);
      addText(player.x, player.y - 34, 'Stolen!', '#ff9d5c');
    }
    scarePeds(best.x, best.y, 90);
    return events | EVENT_ENTER;
  }

  function updateOnFoot(dt, input, events) {
    const mx = input.mx;
    const my = input.my;
    const moving = mx !== 0 || my !== 0;
    player.speedNow = moving ? PLAYER.walkSpeed : 0;
    if (moving) {
      const len = Math.hypot(mx, my);
      const nx = player.x + (mx / len) * PLAYER.walkSpeed * dt;
      const ny = player.y + (my / len) * PLAYER.walkSpeed * dt;
      const fixed = collideCircle(city, nx, ny, PLAYER.radius, false);
      player.x = fixed.x;
      player.y = fixed.y;
      player.angle = Math.atan2(my, mx);
    }
    // Cars are solid to a walker too.
    for (const car of state.cars) {
      if (car.mode === 'wreck') continue;
      const d = dist(player, car);
      const min = car.type.width / 2 + PLAYER.radius - 4;
      if (d > 0.01 && d < min) {
        player.x = car.x + ((player.x - car.x) / d) * min;
        player.y = car.y + ((player.y - car.y) / d) * min;
      }
    }
    if (input.enterPressed) events = enterNearestCar(events);
    return events;
  }

  function updateDriving(dt, input, events) {
    const car = player.inCar;
    const t = car.type;
    if (input.up) car.speed += t.accel * dt * (1 - Math.max(0, car.speed) / (t.topSpeed * 1.25));
    else if (input.down) car.speed -= (car.speed > 4 ? 400 : t.accel * 0.55) * dt;
    else car.speed -= car.speed * 0.5 * dt;
    if (!isOnRoad(city, car.x, car.y)) car.speed -= car.speed * 0.55 * dt; // sand and grass drag
    car.speed = Math.max(-t.topSpeed * 0.34, Math.min(t.topSpeed, car.speed));
    if (Math.abs(car.speed) < 2 && !input.up && !input.down) car.speed = 0;
    const steer = input.mx * 2.05 * Math.max(-1, Math.min(1, car.speed / 130));
    car.angle += steer * dt * (car.speed < 0 ? -1 : 1);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const fixed = collideCircle(city, nx, ny, t.width / 2, true);
    if (Math.hypot(fixed.x - nx, fixed.y - ny) > 5 && Math.abs(car.speed) > 130) {
      player.health -= 4;
      car.health -= 10;
      state.shake = Math.min(9, state.shake + 4);
      car.speed *= -0.22;
      events |= EVENT_CRASH;
    } else {
      car.x = fixed.x;
      car.y = fixed.y;
    }
    player.x = car.x;
    player.y = car.y;
    player.angle = car.angle;
    player.speedNow = Math.abs(car.speed);
    // A fast car near walkers panics them.
    if (Math.abs(car.speed) > 190) scarePeds(car.x, car.y, 110);
    if (input.enterPressed) exitCar();
    return events;
  }

  /** Car against car: push apart, trade speed, and charge the damage to whoever is at fault. */
  function collideCars(events) {
    const cars = state.cars;
    for (let i = 0; i < cars.length; i += 1) {
      for (let j = i + 1; j < cars.length; j += 1) {
        const a = cars[i];
        const b = cars[j];
        if (a.mode === 'wreck' || b.mode === 'wreck') continue;
        const d = dist(a, b);
        const min = a.type.width / 2 + b.type.width / 2 - 6;
        if (d < 0.01 || d >= min) continue;
        const push = (min - d) / 2;
        const ux = (b.x - a.x) / d;
        const uy = (b.y - a.y) / d;
        a.x -= ux * push; a.y -= uy * push;
        b.x += ux * push; b.y += uy * push;
        const rel = Math.abs(a.speed - b.speed);
        const playerInvolved = player.inCar === a || player.inCar === b;
        if (rel > 120) {
          a.health -= rel * 0.05;
          b.health -= rel * 0.05;
          a.speed *= 0.55;
          b.speed *= 0.55;
          if (playerInvolved) {
            player.health -= rel * 0.03;
            state.shake = Math.min(10, state.shake + rel * 0.02);
            events |= EVENT_CRASH;
            if (a.kind === 'police' || b.kind === 'police') events = crime(2, events);
            else events = crime(1, events);
          }
        } else {
          const swap = (a.speed + b.speed) / 2;
          if (a.mode !== 'parked') a.speed = swap * 0.8;
          if (b.mode !== 'parked') b.speed = swap * 0.8;
        }
        if (a.health <= 0 && a.mode !== 'player') a.mode = 'wreck';
        if (b.health <= 0 && b.mode !== 'player') b.mode = 'wreck';
      }
    }
    return events;
  }

  // ---- combat -----------------------------------------------------------------------
  function updateCombat(dt, input, events) {
    player.punchT = Math.max(0, player.punchT - dt);
    player.fireT = Math.max(0, player.fireT - dt);
    if (player.inCar) return events;
    if (input.aimX !== undefined) player.angle = Math.atan2(input.aimY - player.y, input.aimX - player.x);
    if (input.meleePressed && player.punchT <= 0) {
      player.punchT = PLAYER.punchCooldown;
      events |= EVENT_PUNCH;
      const fx = player.x + Math.cos(player.angle) * PLAYER.punchRange;
      const fy = player.y + Math.sin(player.angle) * PLAYER.punchRange;
      for (const ped of state.peds) {
        if (ped.mode !== 'down' && Math.hypot(ped.x - fx, ped.y - fy) < 26) {
          ped.health -= PLAYER.punchDamage;
          if (ped.health <= 0) events = downPed(ped, events, true);
          else { ped.mode = 'flee'; ped.fleeT = 3; ped.threat = { x: player.x, y: player.y }; }
        }
      }
    }
    if (input.shootHeld && player.fireT <= 0) {
      if (!player.hasGun) {
        player.fireT = 0.4;
        events |= EVENT_NOGUN;
      } else if (player.ammo <= 0) {
        player.fireT = 0.3;
        state.hint = 'Out of ammo — Solana Arms sells more';
      } else {
        player.fireT = 0.21;
        player.ammo -= 1;
        state.bullets.push({
          x: player.x + Math.cos(player.angle) * 18, y: player.y + Math.sin(player.angle) * 18,
          vx: Math.cos(player.angle) * 980, vy: Math.sin(player.angle) * 980, life: 0.5,
        });
        scarePeds(player.x, player.y, 240);
        events = crime(1, events | EVENT_SHOT);
      }
    }
    return events;
  }

  function updateBullets(dt, events) {
    for (const bullet of state.bullets) {
      bullet.life -= dt;
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      if (bullet.life <= 0) continue;
      for (const ped of state.peds) {
        if (ped.mode !== 'down' && Math.hypot(ped.x - bullet.x, ped.y - bullet.y) < 15) {
          bullet.life = 0;
          events = downPed(ped, events, true);
          break;
        }
      }
      if (bullet.life <= 0) continue;
      for (const car of state.cars) {
        if (car.mode !== 'wreck' && car !== player.inCar && Math.hypot(car.x - bullet.x, car.y - bullet.y) < car.type.width / 2) {
          bullet.life = 0;
          car.health -= 26;
          if (car.kind === 'police') addWanted(1);
          if (car.health <= 0) car.mode = 'wreck';
          break;
        }
      }
    }
    state.bullets = state.bullets.filter((bullet) => bullet.life > 0);
    return events;
  }

  // ---- pickups, being run down, the law ----------------------------------------------
  function updatePickups(dt, events) {
    for (const pickup of state.pickups) {
      if (!pickup.active) {
        if (pickup.respawn > 0) {
          pickup.t -= dt;
          if (pickup.t <= 0) pickup.active = true;
        }
        continue;
      }
      const d = Math.hypot(player.x - pickup.x, player.y - pickup.y);
      if (d > 30) continue;
      if (pickup.kind === 'bag') {
        pickup.active = false;
        addText(pickup.x, pickup.y - 18, 'Bag collected', '#ffd23c');
        events = advanceStep(events | EVENT_PICKUP);
      } else if (pickup.kind === 'cash') {
        pickup.active = false;
        player.money += pickup.amount;
        addText(pickup.x, pickup.y - 18, `+$${pickup.amount}`, '#7be495');
        events |= EVENT_CASH;
      } else if (pickup.kind === 'health') {
        if (player.health >= PLAYER.health) continue;
        pickup.active = false;
        pickup.t = 20;
        player.health = Math.min(PLAYER.health, player.health + 45);
        addText(pickup.x, pickup.y - 18, '+Health', '#58d977');
        events |= EVENT_PICKUP;
      } else if (pickup.kind === 'ammo') {
        if (!player.hasGun) continue;
        pickup.active = false;
        pickup.t = 20;
        player.ammo += 18;
        addText(pickup.x, pickup.y - 18, '+18 rounds', '#ffd23c');
        events |= EVENT_PICKUP;
      }
    }
    return events;
  }

  function updateRunDowns(events) {
    for (const ped of state.peds) {
      if (ped.mode === 'down') continue;
      for (const car of state.cars) {
        if (Math.abs(car.speed) > 70 && Math.hypot(ped.x - car.x, ped.y - car.y) < car.type.width / 2 + 5) {
          events = downPed(ped, events, car === player.inCar || car.mode === 'player');
          break;
        }
      }
    }
    if (!player.inCar) {
      for (const car of state.cars) {
        if (car.mode === 'traffic' || car.mode === 'police') {
          if (Math.abs(car.speed) > 90 && dist(player, car) < car.type.width / 2 + PLAYER.radius - 2) {
            player.health -= 22;
            state.shake = Math.min(10, state.shake + 5);
            const away = angleTo(car, player);
            player.x += Math.cos(away) * 26;
            player.y += Math.sin(away) * 26;
            events |= EVENT_CRASH;
          }
        }
      }
    }
    return events;
  }

  function updateWanted(dt) {
    state.crimeT += dt;
    if (state.wanted > 0 && state.crimeT > TUNING.wantedDecayDelay) {
      state.decayT += dt;
      if (state.decayT >= TUNING.wantedDecayEvery) {
        state.decayT = 0;
        state.wanted -= 1;
        if (state.wanted === 0) player.bust = 0;
      }
    }
    // The bust: a close interceptor and a slow or cornered Marco fill the meter.
    let nearest = Infinity;
    for (const car of state.cars) {
      if (car.mode === 'police') nearest = Math.min(nearest, dist(car, player));
    }
    const cornered = nearest < TUNING.bustRange && (!player.inCar || Math.abs(player.inCar.speed) < 42);
    if (state.wanted > 0 && cornered) player.bust += dt / TUNING.bustFillTime;
    else player.bust = Math.max(0, player.bust - dt * 0.7);
    if (player.bust >= 1) state.over = 'busted';
    if (player.health <= 0) state.over = 'wasted';
  }

  function updateDialogue(dt, input) {
    const dlg = state.dialogue;
    if (dlg.index >= dlg.lines.length) {
      if (state.pendingNext) {
        state.pendingNext = false;
        if (state.mission.index + 1 < MISSIONS.length) startMission(state.mission.index + 1);
        else {
          state.storyComplete = true;
          state.mission.index = MISSIONS.length;
          say(['Rosa (phone): The bay is yours now, Marco. Try not to buy it all at once.']);
        }
      }
      return;
    }
    dlg.t += dt;
    if (dlg.t > 4.2 || input.confirmPressed) {
      dlg.index += 1;
      dlg.t = 0;
    }
  }

  /** Ambient life: a dropped wallet on a sidewalk now and then. */
  function updateAmbient(dt) {
    state.cashT -= dt;
    if (state.cashT <= 0) {
      state.cashT = TUNING.cashSpawnEvery;
      const active = state.pickups.filter((p) => p.active && p.kind === 'cash').length;
      if (active < 3) {
        const road = city.roadsV[Math.floor(random() * city.roadsV.length)];
        addPickup(road.cx + (random() < 0.5 ? -1 : 1) * (LANE * 2 + 13), 200 + random() * (WORLD.height - 400), 'cash', 10 + Math.floor(random() * 31), 0);
      }
    }
  }

  // ---- reset, respawn, save -----------------------------------------------------------
  function reset(saved) {
    state.cars = [];
    state.peds = [];
    state.pickups = [];
    state.bullets = [];
    state.texts = [];
    state.wanted = 0;
    state.crimeT = 99;
    state.decayT = 0;
    state.over = null;
    state.markedCar = null;
    state.pendingNext = false;
    state.storyComplete = false;
    player.inCar = null;
    player.health = PLAYER.health;
    player.money = 60;
    player.hasGun = false;
    player.ammo = 0;
    player.bust = 0;
    player.x = city.pois.motel.x;
    player.y = city.pois.motel.y + 42;

    for (let i = 0; i < TUNING.trafficCars; i += 1) spawnTraffic();
    const spots = city.parkedSpots.slice();
    for (let i = 0; i < Math.min(TUNING.parkedCars, spots.length); i += 1) {
      const spot = spots[Math.floor(random() * spots.length)];
      spawnParked(spot);
    }
    const motelCar = makeCar('sedan', city.pois.motelCar.x, city.pois.motelCar.y, Math.PI / 2, 'parked');
    motelCar.color = '#c94f42';
    for (let i = 0; i < TUNING.peds; i += 1) spawnPed();
    addPickup(city.pois.hospital.x, city.pois.hospital.y, 'health', 0, 20);
    addPickup(city.pois.gunshop.x, city.pois.gunshop.y, 'ammo', 0, 20);

    if (saved) {
      player.money = saved.money ?? player.money;
      player.hasGun = !!saved.hasGun;
      player.ammo = saved.ammo ?? 0;
      player.health = saved.health ?? PLAYER.health;
      if (typeof saved.x === 'number' && typeof saved.y === 'number') {
        player.x = saved.x;
        player.y = saved.y;
      }
      if (saved.storyComplete) {
        state.storyComplete = true;
        state.mission.index = MISSIONS.length;
        say(['Rosa (phone): Coral Bay is still yours, Marco.']);
        return;
      }
      startMission(Math.min(saved.mission ?? 0, MISSIONS.length - 1));
      // A driver who already earned the pistol keeps it from the first mission on.
      if ((saved.mission ?? 0) >= 2) player.hasGun = true;
      return;
    }
    startMission(0);
  }

  function respawn() {
    const kind = state.over;
    if (player.inCar) {
      player.inCar.mode = 'parked';
      player.inCar = null;
    }
    for (const car of state.cars) if (car.mode === 'police') { car.mode = 'traffic'; putOnRoad(car, car.x, car.y); }
    state.wanted = 0;
    player.bust = 0;
    player.health = PLAYER.health;
    player.money -= Math.min(player.money, kind === 'busted' ? 120 : 80);
    const at = kind === 'busted' ? city.pois.station : city.pois.hospital;
    player.x = at.x;
    player.y = at.y + 16;
    state.over = null;
  }

  function snapshot() {
    return {
      money: player.money,
      mission: state.mission.index,
      storyComplete: state.storyComplete,
      x: Math.round(player.x),
      y: Math.round(player.y),
      health: Math.round(player.health),
      hasGun: player.hasGun,
      ammo: player.ammo,
    };
  }

  // ---- the step -------------------------------------------------------------------------
  function step(dt, input) {
    let events = 0;
    state.time += dt;
    if (state.over) return events;
    updateDialogue(dt, input);
    if (player.inCar) events = updateDriving(dt, input, events);
    else events = updateOnFoot(dt, input, events);
    events = updateCombat(dt, input, events);
    for (const car of state.cars) {
      if (car.mode === 'traffic') updateTraffic(car, dt);
      else if (car.mode === 'police') updatePolice(car, dt);
    }
    updatePoliceForce(dt);
    for (const ped of state.peds) updatePed(ped, dt);
    events = collideCars(events);
    events = updateRunDowns(events);
    events = updateBullets(dt, events);
    events = updatePickups(dt, events);
    events = checkStep(events);
    if (player.inCar && player.inCar.health <= 0) {
      player.inCar.mode = 'wreck';
      exitCar();
      player.health -= 8;
      addText(player.x, player.y - 30, 'Wrecked!', '#ff9d5c');
    }
    updateWanted(dt);
    updateAmbient(dt);
    for (const text of state.texts) text.t += dt;
    state.texts = state.texts.filter((text) => text.t < 1.5);
    state.shake = Math.max(0, state.shake - dt * 14);
    return events;
  }

  reset(null);
  return { state, reset, respawn, snapshot, step, marker };
}
