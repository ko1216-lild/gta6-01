// Keyboard and mouse input. Held keys give movement and driving axes; one-shot presses are
// queued as bit flags and taken once by the loop, so a press between frames is never lost
// and never counted twice. The mouse position and button are tracked for aiming.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_MELEE = 8;
export const ACTION_MUTE = 16;

const HELD = {
  up: new Set(['ArrowUp', 'KeyW']),
  down: new Set(['ArrowDown', 'KeyS']),
  left: new Set(['ArrowLeft', 'KeyA']),
  right: new Set(['ArrowRight', 'KeyD']),
};
const ONE_SHOT = new Map([
  ['Enter', ACTION_CONFIRM],
  ['KeyP', ACTION_PAUSE],
  ['Escape', ACTION_PAUSE],
  ['KeyE', ACTION_ENTER],
  ['KeyF', ACTION_MELEE],
  ['KeyM', ACTION_MUTE],
]);

export function createInput(canvas) {
  const held = { up: false, down: false, left: false, right: false };
  const mouse = { x: 0, y: 0, down: false };
  let actions = 0;

  function axisFor(code) {
    for (const axis of Object.keys(HELD)) if (HELD[axis].has(code)) return axis;
    return null;
  }

  window.addEventListener('keydown', (event) => {
    const axis = axisFor(event.code);
    if (axis) held[axis] = true;
    else if (event.code === 'Space') held.shoot = true;
    else if (ONE_SHOT.has(event.code)) {
      if (!event.repeat) actions |= ONE_SHOT.get(event.code);
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    const axis = axisFor(event.code);
    if (axis) held[axis] = false;
    else if (event.code === 'Space') held.shoot = false;
  });
  window.addEventListener('blur', () => {
    held.up = held.down = held.left = held.right = held.shoot = false;
    mouse.down = false;
  });

  function trackMouse(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 1280;
    mouse.y = ((event.clientY - rect.top) / rect.height) * 720;
  }
  canvas.addEventListener('pointermove', trackMouse);
  canvas.addEventListener('pointerdown', (event) => {
    trackMouse(event);
    mouse.down = true;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => {
    mouse.down = false;
  });

  return {
    held,
    mouse,
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
