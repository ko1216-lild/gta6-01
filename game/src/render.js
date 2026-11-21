// Round 2 revision note: re-issued in the recorded session; drawing behaviour is unchanged.
// Drawing only: the world state and the current screen in, pixels out. A camera follows
// Marco through Coral Bay; only what the camera can see is painted. The HUD (money, health,
// wanted stars, objective, dialogue) and the minimap are drawn in screen space on top, and
// the menu and end screens are translucent panels over the living city.
import { FIELD, FONT, PALETTE, WORLD } from './config.js';
import { PARK, PIER } from './city.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_COMPLETE = 'complete';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const cam = { x: 0, y: 0 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    view.scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    view.x = (canvas.width - FIELD.width * view.scale) / 2;
    view.y = (canvas.height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, weight) {
    const key = `${size}/${weight ?? 400}`;
    if (!fonts.has(key)) fonts.set(key, `${weight ?? 400} ${size}px ${FONT}`);
    ctx.font = fonts.get(key);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(value, x, y);
  }

  function visible(x, y, pad) {
    return x > cam.x - pad && x < cam.x + FIELD.width + pad && y > cam.y - pad && y < cam.y + FIELD.height + pad;
  }

  function drawGround(state) {
    const city = state.city;
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(cam.x, cam.y, FIELD.width, FIELD.height);
    // The park: lighter lawn and a pale path cross.
    ctx.fillStyle = '#4c9153';
    ctx.fillRect(PARK.x, PARK.y, PARK.w, PARK.h);
    ctx.fillStyle = PALETTE.parkPath;
    ctx.fillRect(PARK.x, PARK.y + PARK.h / 2 - 9, PARK.w, 18);
    ctx.fillRect(PARK.x + PARK.w / 2 - 9, PARK.y, 18, PARK.h);
    // Beach and sea.
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(WORLD.sandX, 0, WORLD.width - WORLD.sandX, WORLD.height);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(WORLD.waterX, 0, WORLD.width - WORLD.waterX, WORLD.height);
    ctx.fillStyle = PALETTE.waterLight;
    const drift = (state.time * 22) % 90;
    for (let x = WORLD.waterX + 26; x < WORLD.width; x += 90) {
      for (let y = -90 + drift; y < WORLD.height; y += 90) ctx.fillRect(x, y, 34, 4);
    }
    // The pier: planks over the water.
    ctx.fillStyle = PALETTE.pier;
    ctx.fillRect(PIER.x, PIER.y, PIER.w, PIER.h);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let x = PIER.x + 16; x < PIER.x + PIER.w; x += 24) ctx.fillRect(x, PIER.y, 3, PIER.h);
    // Sidewalk aprons under the roads, then the asphalt itself.
    ctx.fillStyle = PALETTE.sidewalk;
    for (const road of city.roadsV) ctx.fillRect(road.cx - road.w / 2 - 15, 0, road.w + 30, WORLD.height);
    for (const road of city.roadsH) ctx.fillRect(0, road.cy - road.h / 2 - 15, WORLD.width, road.h + 30);
    ctx.fillStyle = PALETTE.road;
    for (const road of city.roadsV) ctx.fillRect(road.cx - road.w / 2, 0, road.w, WORLD.height);
    for (const road of city.roadsH) ctx.fillRect(0, road.cy - road.h / 2, WORLD.width, road.h);
  }

  function drawMarkings(state) {
    const city = state.city;
    ctx.fillStyle = PALETTE.lane;
    for (const road of city.roadsV) {
      for (let y = 12; y < WORLD.height; y += 64) {
        if (city.roadsH.some((h) => Math.abs(h.cy - y) < 74)) continue;
        if (visible(road.cx, y, 60)) ctx.fillRect(road.cx - 2, y, 4, 34);
      }
    }
    for (const road of city.roadsH) {
      for (let x = 12; x < WORLD.width; x += 64) {
        if (city.roadsV.some((v) => Math.abs(v.cx - x) < 74)) continue;
        if (visible(x, road.cy, 60)) ctx.fillRect(x, road.cy - 2, 34, 4);
      }
    }
  }

  function drawBuildings(state) {
    for (const b of state.city.buildings) {
      if (!visible(b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h))) continue;
      ctx.fillStyle = 'rgba(20, 8, 30, 0.35)';
      ctx.fillRect(b.x + 8, b.y + 10, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,0.20)';
      ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
      ctx.fillStyle = 'rgba(30, 16, 44, 0.28)';
      const cols = Math.max(1, Math.floor(b.w / 34));
      const rows = Math.max(1, Math.floor(b.h / 30));
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          ctx.fillRect(b.x + 12 + c * 34, b.y + 11 + r * 30, 15, 11);
        }
      }
      if (b.landmark) {
        const label = b.name.toUpperCase();
        ctx.font = `700 13px ${FONT}`;
        const w = ctx.measureText(label).width + 18;
        ctx.fillStyle = 'rgba(14, 8, 26, 0.78)';
        roundRect(ctx, b.x + b.w / 2 - w / 2, b.y - 24, w, 19, 5);
        ctx.fill();
        ctx.textBaseline = 'middle';
        text(label, b.x + b.w / 2, b.y - 14, 13, '#ffd23c', 'center', 700);
        ctx.textBaseline = 'alphabetic';
      }
    }
  }

  function drawProps(state) {
    for (const prop of state.city.props) {
      if (!visible(prop.x, prop.y, 60)) continue;
      if (prop.kind === 'palm') {
        ctx.strokeStyle = '#7a5a36';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(prop.x, prop.y);
        ctx.lineTo(prop.x + 4, prop.y - 12);
        ctx.stroke();
        ctx.strokeStyle = '#2f9e57';
        ctx.lineWidth = 3;
        for (let i = 0; i < 6; i += 1) {
          const a = (i / 6) * Math.PI * 2 + 0.4;
          ctx.beginPath();
          ctx.moveTo(prop.x + 4, prop.y - 12);
          ctx.quadraticCurveTo(
            prop.x + 4 + Math.cos(a) * 13, prop.y - 12 + Math.sin(a) * 8 - 4,
            prop.x + 4 + Math.cos(a) * 21, prop.y - 12 + Math.sin(a) * 13 + 5,
          );
          ctx.stroke();
        }
      } else if (prop.kind === 'lamp') {
        ctx.fillStyle = '#3a3f4a';
        ctx.fillRect(prop.x - 2, prop.y - 10, 4, 12);
        ctx.fillStyle = '#ffe9a8';
        ctx.beginPath();
        ctx.arc(prop.x, prop.y - 13, 4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#9a7448';
        ctx.fillRect(prop.x - 11, prop.y - 11, 22, 22);
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 2;
        ctx.strokeRect(prop.x - 11, prop.y - 11, 22, 22);
      }
    }
  }

  function drawPickups(state) {
    for (const pickup of state.pickups) {
      if (!pickup.active || !visible(pickup.x, pickup.y, 40)) continue;
      const bob = Math.sin(state.time * 3.2 + pickup.x) * 3;
      const y = pickup.y + bob;
      ctx.fillStyle = 'rgba(20, 8, 30, 0.3)';
      ctx.beginPath();
      ctx.ellipse(pickup.x, pickup.y + 9, 11, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      if (pickup.kind === 'cash' || pickup.kind === 'bag') {
        ctx.fillStyle = pickup.kind === 'bag' ? '#5b4632' : '#2e8b4f';
        roundRect(ctx, pickup.x - 10, y - 8, 20, 16, 4);
        ctx.fill();
        ctx.textBaseline = 'middle';
        text('$', pickup.x, y + 1, 13, '#ffe066', 'center', 800);
        ctx.textBaseline = 'alphabetic';
      } else if (pickup.kind === 'health') {
        ctx.fillStyle = '#f5f5f5';
        ctx.beginPath();
        ctx.arc(pickup.x, y, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e5534b';
        ctx.fillRect(pickup.x - 2.5, y - 7, 5, 14);
        ctx.fillRect(pickup.x - 7, y - 2.5, 14, 5);
      } else {
        ctx.fillStyle = '#e2703a';
        roundRect(ctx, pickup.x - 10, y - 7, 20, 14, 3);
        ctx.fill();
        ctx.fillStyle = '#ffd23c';
        ctx.fillRect(pickup.x - 6, y - 2, 12, 4);
      }
    }
  }

  function drawMarker(state, marker) {
    if (!marker) return;
    const pulse = 1 + Math.sin(state.time * 5) * 0.16;
    ctx.strokeStyle = PALETTE.marker;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, 24 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 210, 60, 0.13)';
    ctx.fillRect(marker.x - 13, cam.y - 4, 26, marker.y - cam.y);
    const bob = Math.sin(state.time * 5) * 5;
    ctx.fillStyle = PALETTE.marker;
    ctx.beginPath();
    ctx.moveTo(marker.x, marker.y - 34 + bob);
    ctx.lineTo(marker.x - 11, marker.y - 54 + bob);
    ctx.lineTo(marker.x + 11, marker.y - 54 + bob);
    ctx.closePath();
    ctx.fill();
  }

  function drawPed(ped, state) {
    ctx.fillStyle = 'rgba(20, 8, 30, 0.3)';
    ctx.beginPath();
    ctx.ellipse(ped.x, ped.y + 5, 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    if (ped.mode === 'down') {
      ctx.save();
      ctx.translate(ped.x, ped.y);
      ctx.rotate(ped.angle);
      ctx.fillStyle = PALETTE.pedShirts[ped.shirt];
      roundRect(ctx, -13, -6, 26, 12, 6);
      ctx.fill();
      ctx.fillStyle = '#c98a5e';
      ctx.beginPath();
      ctx.arc(15, 0, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    ctx.fillStyle = PALETTE.pedShirts[ped.shirt];
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, 9.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c98a5e';
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, 5.2, 0, Math.PI * 2);
    ctx.fill();
    if (ped.mode === 'flee') {
      ctx.textBaseline = 'middle';
      text('!', ped.x, ped.y - 20, 16, '#ff5252', 'center', 800);
      ctx.textBaseline = 'alphabetic';
    }
  }

  function drawCar(car, state) {
    const { width: w, height: h } = car.type;
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(20, 8, 30, 0.35)';
    roundRect(ctx, -w / 2 + 3, -h / 2 + 5, w, h, 6);
    ctx.fill();
    ctx.fillStyle = car.mode === 'wreck' ? '#3c3c40' : car.color;
    roundRect(ctx, -w / 2, -h / 2, w, h, 6);
    ctx.fill();
    // Cabin and glass.
    ctx.fillStyle = car.mode === 'wreck' ? '#2c2c30' : 'rgba(16, 24, 38, 0.85)';
    roundRect(ctx, -w * 0.16, -h / 2 + 3, w * 0.34, h - 6, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(190, 225, 245, 0.75)';
    ctx.fillRect(w * 0.2, -h / 2 + 4, 3.5, h - 8);
    // Headlights.
    ctx.fillStyle = '#fff6c9';
    ctx.fillRect(w / 2 - 2, -h / 2 + 2.5, 2.5, 4.5);
    ctx.fillRect(w / 2 - 2, h / 2 - 7, 2.5, 4.5);
    if (car.kind === 'sport') {
      ctx.fillStyle = 'rgba(14, 8, 26, 0.65)';
      ctx.fillRect(-w / 2 + 1, -h / 2 + 1.5, 5, h - 3);
    }
    if (car.kind === 'police') {
      ctx.fillStyle = '#e8ecf2';
      ctx.fillRect(-w * 0.05, -h / 2 + 1.5, w * 0.2, h - 3);
      const phase = Math.floor(state.time * 2.4) % 2 === 0;
      ctx.fillStyle = phase ? PALETTE.policeLightA : '#5c1a1a';
      ctx.fillRect(-7, -h / 2 + 2, 6, 6);
      ctx.fillStyle = phase ? '#1a3a5c' : PALETTE.policeLightB;
      ctx.fillRect(1, -h / 2 + 2, 6, 6);
      ctx.fillStyle = phase ? PALETTE.policeLightB : '#1a3a5c';
      ctx.fillRect(-7, h / 2 - 8, 6, 6);
      ctx.fillStyle = phase ? '#5c1a1a' : PALETTE.policeLightA;
      ctx.fillRect(1, h / 2 - 8, 6, 6);
    }
    ctx.restore();
    if (car.marked) {
      ctx.strokeStyle = PALETTE.marker;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(car.x, car.y, w * 0.78 + Math.sin(state.time * 5) * 3, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawPlayer(state) {
    const player = state.player;
    if (player.inCar) return;
    ctx.fillStyle = 'rgba(20, 8, 30, 0.32)';
    ctx.beginPath();
    ctx.ellipse(player.x, player.y + 6, 10, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.playerSkin;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 6, 0, Math.PI * 2);
    ctx.fill();
    // Facing tick, and the pistol when he has one.
    const fx = Math.cos(player.angle);
    const fy = Math.sin(player.angle);
    ctx.strokeStyle = '#14100e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(player.x + fx * 8, player.y + fy * 8);
    ctx.lineTo(player.x + fx * (player.hasGun ? 19 : 13), player.y + fy * (player.hasGun ? 19 : 13));
    ctx.stroke();
  }

  function drawEffects(state) {
    ctx.strokeStyle = '#ffe066';
    ctx.lineWidth = 2.5;
    for (const bullet of state.bullets) {
      ctx.beginPath();
      ctx.moveTo(bullet.x - bullet.vx * 0.016, bullet.y - bullet.vy * 0.016);
      ctx.lineTo(bullet.x, bullet.y);
      ctx.stroke();
    }
    ctx.textBaseline = 'middle';
    for (const item of state.texts) {
      ctx.globalAlpha = Math.max(0, 1 - item.t / 1.5);
      text(item.text, item.x, item.y - item.t * 34, 17, item.color, 'center', 800);
    }
    ctx.globalAlpha = 1;
    ctx.textBaseline = 'alphabetic';
  }

  function drawTint(state) {
    const gradient = ctx.createLinearGradient(0, cam.y, 0, cam.y + FIELD.height);
    gradient.addColorStop(0, 'rgba(255, 138, 76, 0.07)');
    gradient.addColorStop(0.55, 'rgba(255, 94, 98, 0.03)');
    gradient.addColorStop(1, 'rgba(64, 20, 96, 0.10)');
    ctx.fillStyle = gradient;
    ctx.fillRect(cam.x, cam.y, FIELD.width, FIELD.height);
  }

  // ---- HUD (screen space) ------------------------------------------------------
  function drawMinimap(state, marker) {
    const W = 198;
    const H = 152;
    const x0 = 16;
    const y0 = FIELD.height - H - 16;
    const scale = Math.min(W / WORLD.width, H / WORLD.height);
    const mw = WORLD.width * scale;
    const mh = WORLD.height * scale;
    ctx.fillStyle = 'rgba(12, 8, 24, 0.8)';
    roundRect(ctx, x0 - 4, y0 - 4, mw + 8, mh + 8, 8);
    ctx.fill();
    ctx.fillStyle = '#274b33';
    ctx.fillRect(x0, y0, mw, mh);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(x0 + WORLD.waterX * scale, y0, (WORLD.width - WORLD.waterX) * scale, mh);
    ctx.strokeStyle = 'rgba(230, 230, 220, 0.4)';
    ctx.lineWidth = 2;
    for (const road of state.city.roadsV) {
      ctx.beginPath();
      ctx.moveTo(x0 + road.cx * scale, y0);
      ctx.lineTo(x0 + road.cx * scale, y0 + mh);
      ctx.stroke();
    }
    for (const road of state.city.roadsH) {
      ctx.beginPath();
      ctx.moveTo(x0, y0 + road.cy * scale);
      ctx.lineTo(x0 + mw, y0 + road.cy * scale);
      ctx.stroke();
    }
    for (const car of state.cars) {
      if (car.mode === 'wreck') continue;
      ctx.fillStyle = car.mode === 'police' ? (Math.floor(state.time * 2.4) % 2 ? '#ff5252' : '#4fc3f7') : 'rgba(220,220,220,0.55)';
      ctx.fillRect(x0 + car.x * scale - 1.5, y0 + car.y * scale - 1.5, 3, 3);
    }
    if (marker) {
      ctx.fillStyle = PALETTE.marker;
      ctx.beginPath();
      ctx.arc(x0 + marker.x * scale, y0 + marker.y * scale, 4 + Math.sin(state.time * 5) * 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    const player = state.player;
    ctx.save();
    ctx.translate(x0 + player.x * scale, y0 + player.y * scale);
    ctx.rotate(player.angle);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(-4, -3.6);
    ctx.lineTo(-4, 3.6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawHud(state, ui) {
    const player = state.player;
    // Money and health, top left.
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, 16, 14, 208, player.hasGun ? 84 : 62, 9);
    ctx.fill();
    ctx.textBaseline = 'alphabetic';
    text(`$${player.money.toLocaleString('en-US')}`, 30, 46, 27, PALETTE.cash, 'left', 800);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    roundRect(ctx, 30, 56, 180, 13, 6);
    ctx.fill();
    ctx.fillStyle = player.health > 30 ? PALETTE.health : PALETTE.healthLow;
    roundRect(ctx, 30, 56, Math.max(0, 180 * (player.health / 100)), 13, 6);
    ctx.fill();
    if (player.hasGun) text(`PISTOL · ${player.ammo} rounds`, 30, 90, 14, '#ffd23c', 'left', 700);
    // Wanted stars, top right.
    if (state.wanted > 0 || player.bust > 0) {
      ctx.fillStyle = PALETTE.panel;
      roundRect(ctx, FIELD.width - 216, 14, 200, player.bust > 0 ? 76 : 52, 9);
      ctx.fill();
      for (let i = 0; i < 5; i += 1) {
        text('★', FIELD.width - 192 + i * 38, 52, 30, i < state.wanted ? '#ffd23c' : 'rgba(255,255,255,0.22)', 'left', 400);
      }
      if (player.bust > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.16)';
        roundRect(ctx, FIELD.width - 196, 62, 160, 10, 5);
        ctx.fill();
        ctx.fillStyle = '#ff5252';
        roundRect(ctx, FIELD.width - 196, 62, 160 * Math.min(1, player.bust), 10, 5);
        ctx.fill();
      }
    }
    // Objective, top centre.
    if (ui.objective) {
      ctx.font = `700 16px ${FONT}`;
      const w = Math.max(ctx.measureText(ui.objective.title).width, ctx.measureText(ui.objective.text).width) + 36;
      ctx.fillStyle = PALETTE.panel;
      roundRect(ctx, FIELD.width / 2 - w / 2, 14, w, 56, 9);
      ctx.fill();
      text(ui.objective.title, FIELD.width / 2, 38, 16, '#ffd23c', 'center', 800);
      text(ui.objective.text, FIELD.width / 2, 60, 15, PALETTE.text, 'center', 400);
    }
    if (ui.prompt) {
      ctx.fillStyle = PALETTE.panel;
      roundRect(ctx, FIELD.width / 2 - 130, FIELD.height - 118, 260, 34, 8);
      ctx.fill();
      text(ui.prompt, FIELD.width / 2, FIELD.height - 96, 16, '#ffd23c', 'center', 700);
    }
    if (player.inCar) {
      const mph = Math.round(Math.abs(player.inCar.speed) * 0.21);
      text(`${player.inCar.type.name} · ${mph} mph`, FIELD.width - 24, FIELD.height - 22, 17, PALETTE.text, 'right', 700);
    }
    drawMinimap(state, ui.marker);
    // Dialogue, bottom centre.
    const dlg = state.dialogue;
    if (dlg.index < dlg.lines.length) {
      const line = dlg.lines[dlg.index];
      const split = line.indexOf(':');
      ctx.fillStyle = 'rgba(12, 8, 24, 0.88)';
      roundRect(ctx, FIELD.width / 2 - 400, FIELD.height - 96, 800, 62, 10);
      ctx.fill();
      if (split > 0) {
        text(line.slice(0, split + 1), FIELD.width / 2 - 382, FIELD.height - 68, 17, '#ffd23c', 'left', 800);
        text(line.slice(split + 1).trim(), FIELD.width / 2 - 382, FIELD.height - 44, 16, PALETTE.text, 'left', 400);
      } else {
        text(line, FIELD.width / 2, FIELD.height - 56, 16, PALETTE.text, 'center', 400);
      }
    }
  }

  // ---- Screens ---------------------------------------------------------------------
  function panel(w, h) {
    ctx.fillStyle = 'rgba(10, 6, 20, 0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.fillStyle = 'rgba(16, 10, 28, 0.92)';
    roundRect(ctx, FIELD.width / 2 - w / 2, FIELD.height / 2 - h / 2, w, h, 14);
    ctx.fill();
    return { x: FIELD.width / 2 - w / 2, y: FIELD.height / 2 - h / 2 };
  }

  function drawTitle(state, ui) {
    ctx.fillStyle = 'rgba(24, 8, 34, 0.45)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    const gradient = ctx.createLinearGradient(0, 120, 0, 250);
    gradient.addColorStop(0, '#ffe066');
    gradient.addColorStop(0.55, '#ff8a5c');
    gradient.addColorStop(1, '#ff5e78');
    ctx.fillStyle = gradient;
    ctx.font = `800 92px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('NEON TIDE', FIELD.width / 2, 218);
    text('C O R A L   B A Y', FIELD.width / 2, 262, 30, '#7be9ff', 'center', 800);
    text('Marco Vidal is back in the bay — and Rosa has work for a driver who does not ask questions.', FIELD.width / 2, 306, 17, PALETTE.text, 'center', 400);
    const lines = [
      'W A S D / Arrows — walk and drive        E — enter / exit a car',
      'F — punch        Mouse + click or Space — shoot (once armed)',
      'P — pause        M — mute        Steal cars, dodge the CBPD, run Rosa’s jobs.',
    ];
    lines.forEach((line, i) => text(line, FIELD.width / 2, 356 + i * 26, 16, PALETTE.muted, 'center', 400));
    const pulse = 0.72 + Math.sin(state.time * 3.4) * 0.28;
    ctx.globalAlpha = pulse;
    text(ui.hasSave ? 'Press ENTER to continue  ·  N for a new game' : 'Press ENTER or click to start', FIELD.width / 2, 486, 22, '#ffd23c', 'center', 800);
    ctx.globalAlpha = 1;
    if (ui.hasSave) text(`Saved: $${ui.saveMoney} · job ${ui.saveJob} of 5`, FIELD.width / 2, 522, 15, PALETTE.muted, 'center', 400);
  }

  function drawEnd(state, screen) {
    if (screen === SCREEN_BUSTED) {
      const phase = Math.floor(state.time * 2.4) % 2 === 0;
      ctx.strokeStyle = phase ? 'rgba(255, 82, 82, 0.8)' : 'rgba(79, 195, 247, 0.8)';
      ctx.lineWidth = 10;
      ctx.strokeRect(5, 5, FIELD.width - 10, FIELD.height - 10);
      panel(560, 240);
      text('BUSTED', FIELD.width / 2, FIELD.height / 2 - 42, 54, '#ff5252', 'center', 800);
      text('The CBPD got their man. The fine comes out of your roll.', FIELD.width / 2, FIELD.height / 2 + 8, 17, PALETTE.text, 'center', 400);
      text('Press ENTER to leave the station', FIELD.width / 2, FIELD.height / 2 + 62, 18, '#ffd23c', 'center', 700);
    } else if (screen === SCREEN_WASTED) {
      ctx.fillStyle = 'rgba(80, 4, 10, 0.45)';
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
      panel(560, 240);
      text('WASTED', FIELD.width / 2, FIELD.height / 2 - 42, 54, '#ff8a80', 'center', 800);
      text('Coral Bay General patches Marco up — for a price.', FIELD.width / 2, FIELD.height / 2 + 8, 17, PALETTE.text, 'center', 400);
      text('Press ENTER to leave the hospital', FIELD.width / 2, FIELD.height / 2 + 62, 18, '#ffd23c', 'center', 700);
    } else if (screen === SCREEN_COMPLETE) {
      panel(620, 264);
      text('STORY COMPLETE', FIELD.width / 2, FIELD.height / 2 - 52, 44, '#7be495', 'center', 800);
      text('Marco caught the last tide out — and came back for the city anyway.', FIELD.width / 2, FIELD.height / 2, 17, PALETTE.text, 'center', 400);
      text(`Final roll: $${state.player.money.toLocaleString('en-US')}`, FIELD.width / 2, FIELD.height / 2 + 34, 18, PALETTE.cash, 'center', 700);
      text('Press ENTER to keep roaming Coral Bay', FIELD.width / 2, FIELD.height / 2 + 78, 18, '#ffd23c', 'center', 700);
    } else if (screen === SCREEN_PAUSED) {
      panel(480, 220);
      text('PAUSED', FIELD.width / 2, FIELD.height / 2 - 40, 40, PALETTE.text, 'center', 800);
      text('Your progress saves itself as you play.', FIELD.width / 2, FIELD.height / 2 + 6, 16, PALETTE.muted, 'center', 400);
      text('Press P to drive on', FIELD.width / 2, FIELD.height / 2 + 56, 18, '#ffd23c', 'center', 700);
    }
  }

  /** Paint one frame: the city through the camera, then the HUD, then any screen panel. */
  function draw(state, screen, ui) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const player = state.player;
    const shakeX = state.shake ? (Math.random() - 0.5) * state.shake : 0;
    const shakeY = state.shake ? (Math.random() - 0.5) * state.shake : 0;
    cam.x = Math.max(0, Math.min(WORLD.width - FIELD.width, player.x - FIELD.width / 2 + shakeX));
    cam.y = Math.max(0, Math.min(WORLD.height - FIELD.height, player.y - FIELD.height / 2 + shakeY));
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x - cam.x * view.scale, view.y - cam.y * view.scale);
    drawGround(state);
    drawMarkings(state);
    drawBuildings(state);
    drawProps(state);
    drawPickups(state);
    drawMarker(state, ui.marker);
    for (const ped of state.peds) if (visible(ped.x, ped.y, 40)) drawPed(ped, state);
    for (const car of state.cars) if (visible(car.x, car.y, 90)) drawCar(car, state);
    drawPlayer(state);
    drawEffects(state);
    drawTint(state);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    if (screen === SCREEN_TITLE) {
      drawTitle(state, ui);
      return;
    }
    drawHud(state, ui);
    if (screen !== SCREEN_PLAY) drawEnd(state, screen);
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, camera: cam };
}
