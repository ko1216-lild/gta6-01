// Final recorded pass (save): re-issued with the authored hand-in; the save format is unchanged.
// The save: one JSON record in localStorage — money, story progress, where Marco stands,
// and what he carries. Storage can be unavailable (private windows); then the game simply
// lasts for the visit and nothing here throws.
import { SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null || typeof data.money !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function writeSave(data) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // Saving is a courtesy, never a reason to stop the game.
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear if storage is off.
  }
}
