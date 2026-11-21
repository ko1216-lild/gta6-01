// Final recorded pass (boot): re-issued with the authored hand-in; the loop and screens are unchanged.
// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps, and the renderer paints what is there. This file owns the screens (title, play,
// paused, busted, wasted, story complete), the sound that answers the world's events, the
// autosave, and the screenshot mode (?shot=...) that stages one scene and stops.
//
// ?seed=N fixes the city's random layout. In shot mode the game exposes the staged scene
// and sets window.__shotReady when it has painted; window.__game is a small debug handle.
import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_CASH, EVENT_CRASH, EVENT_CRIME, EVENT_ENTER, EVENT_MISSION, EVENT_NOGUN, EVENT_PICKUP, EVENT_PUNCH, EVENT_SHOT } from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_MELEE, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_COMPLETE, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED } from './render.js';
import { createAudio } from './audio.js';
import { clearSave, loadSave, writeSave } from './save.js';
import { MISSIONS } from './missions.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function objective() {
  const state = world.state;
  if (state.storyComplete) {
    return { title: 'CORAL BAY — FREE ROAM', text: 'Earn, drive, and stay ahead of the CBPD' };
  }
  const mission = MISSIONS[state.mission.index];
  const step = mission.steps[state.mission.step];
  return { title: `JOB ${state.mission.index + 1} OF 5 — ${mission.title.toUpperCase()}`, text: step.text };
}

function buildUi(flash) {
  const state = world.state;
  const saved = loadSave();
  let prompt = flash;
  if (!prompt && state.player.inCar) prompt = 'E — Exit vehicle';
  if (!prompt && !state.player.inCar) {
    for (const car of state.cars) {
      if (car.mode !== 'wreck' && Math.hypot(car.x - state.player.x, car.y - state.player.y) < 54) {
        prompt = car.mode === 'parked' ? 'E — Enter vehicle' : 'E — Steal vehicle';
        break;
      }
    }
  }
  return {
    marker: world.marker(),
    objective: objective(),
    prompt,
    hasSave: !!saved,
    saveMoney: saved?.money ?? 0,
    saveJob: saved ? Math.min((saved.mission ?? 0) + 1, 5) : 0,
  };
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, buildUi(null));
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  let saveT = 0;
  let alarmT = 0;
  let flash = null;
  let flashT = 0;
  let freshGame = false;
  let justStarted = false;

  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyN' && screen === SCREEN_TITLE) freshGame = true;
  });

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    if (freshGame) {
      clearSave();
      world.reset(null);
    } else {
      world.reset(loadSave());
    }
    freshGame = false;
    justStarted = true;
    screen = SCREEN_PLAY;
    announce('Playing Neon Tide: Coral Bay.');
  }

  function save() {
    writeSave(world.snapshot());
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) audio.toggleMute();
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) startGame();
      return actions;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        save();
      }
      return actions;
    }
    if (screen === SCREEN_BUSTED || screen === SCREEN_WASTED) {
      if (actions & ACTION_CONFIRM) {
        world.respawn();
        screen = SCREEN_PLAY;
        save();
        announce('Back on the street.');
      }
      return actions;
    }
    if (screen === SCREEN_COMPLETE) {
      if (actions & ACTION_CONFIRM) {
        screen = SCREEN_PLAY;
        save();
      }
      return actions;
    }
    if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      save();
      announce('Paused.');
    }
    return actions;
  }

  function worldInput(actions) {
    const held = input.held;
    const cam = renderer.camera;
    return {
      mx: (held.right ? 1 : 0) - (held.left ? 1 : 0),
      my: (held.down ? 1 : 0) - (held.up ? 1 : 0),
      up: !!held.up,
      down: !!held.down,
      enterPressed: !!(actions & ACTION_ENTER),
      meleePressed: !!(actions & ACTION_MELEE),
      shootHeld: input.mouse.down || !!held.shoot,
      confirmPressed: !!(actions & ACTION_CONFIRM),
      aimX: cam.x + input.mouse.x,
      aimY: cam.y + input.mouse.y,
    };
  }

  function react(events, dt) {
    if (events & EVENT_SHOT) audio.shot();
    if (events & EVENT_PUNCH) audio.punch();
    if (events & EVENT_CASH) audio.cash();
    else if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_MISSION) {
      audio.mission();
      save();
    }
    if (events & EVENT_ENTER) audio.enter();
    if (events & EVENT_CRASH) audio.crash();
    if (events & EVENT_NOGUN) {
      flash = 'No weapon yet — finish Rosa’s second job';
      flashT = 2.2;
    }
    alarmT -= dt;
    if ((events & EVENT_CRIME) && world.state.wanted >= 2 && alarmT <= 0) {
      audio.alarm();
      alarmT = 2.5;
    }
    const state = world.state;
    if (state.justCompleted) {
      state.justCompleted = false;
      screen = SCREEN_COMPLETE;
      save();
      announce('Story complete.');
    } else if (state.over === 'busted') {
      screen = SCREEN_BUSTED;
      audio.alarm();
      announce('Busted.');
    } else if (state.over === 'wasted') {
      screen = SCREEN_WASTED;
      announce('Wasted.');
    }
  }

  function stepFrame(dt, actions) {
    const events = world.step(dt, worldInput(actions));
    react(events, dt);
    saveT += dt;
    if (saveT > 5) {
      saveT = 0;
      save();
    }
    if (flashT > 0) {
      flashT -= dt;
      if (flashT <= 0) flash = null;
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const actions = handleActions();
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    if (screen === SCREEN_PLAY) {
      let first = true;
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        // The press that started the game must not also skip its first dialogue line.
        stepFrame(STEP, first ? (justStarted ? actions & ~ACTION_CONFIRM : actions) : 0);
        first = false;
        justStarted = false;
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_TITLE) {
      // The city lives behind the title: traffic and walkers move, Marco waits.
      while (accumulator >= STEP) {
        world.step(STEP, { mx: 0, my: 0, up: false, down: false, enterPressed: false, meleePressed: false, shootHeld: false, confirmPressed: false });
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    // Continuous voices.
    const state = world.state;
    if (screen === SCREEN_PLAY && state.player.inCar) {
      audio.engine(Math.abs(state.player.inCar.speed) / state.player.inCar.type.topSpeed);
    } else audio.engine(null);
    let policeNear = false;
    if (state.wanted > 0) {
      for (const car of state.cars) {
        if (car.mode === 'police' && Math.hypot(car.x - state.player.x, car.y - state.player.y) < 720) { policeNear = true; break; }
      }
    }
    audio.siren(policeNear && screen === SCREEN_PLAY, STEP);
    renderer.draw(state, screen, buildUi(flash));
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      save();
    }
  });

  window.__game = {
    world,
    get screen() { return screen; },
    start: startGame,
    teleport(x, y) {
      world.state.player.x = x;
      world.state.player.y = y;
    },
  };

  announce('Neon Tide: Coral Bay. Press Enter to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
