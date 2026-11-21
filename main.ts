// Neon Tide: Coral Bay — hand-in program for the gta6-01 bounty (Node 22, standard library only).
//
// What this program does, in order:
//   1. checks that the entry beside it is complete (game/index.html and a proper set of screenshots),
//   2. copies game/ and screenshots/ into the output directory,
//   3. asks the vendored make.fun library to summarise the staged copy as dossier.json,
//   4. prints a short build summary so a human can see what was handed in.
//
// The output directory is /output under the grader; anywhere else, MAKEFUN_OUTPUT_DIR names it:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// To play the game itself, serve this folder (`node serve.ts`) and open game/index.html in a browser.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The scorer's limits for this bounty, handed to buildDossier whole. text_max_bytes is the only
// one that shapes the dossier's bytes; the rest make this program refuse exactly what the scorer
// would refuse (more than 4 screenshots or one over 256 KiB; more than 993 entries or 48 MiB in
// game/; a path under game/ over 1000 bytes).
const GATE = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

const entryDir = dirname(fileURLToPath(import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** Refuse early, with a readable reason, when the entry beside this file is incomplete. */
function checkEntryLayout(dir: string): void {
  const page = join(dir, 'game', 'index.html');
  if (!existsSync(page)) throw new Error(`entry is incomplete: ${page} is missing`);
  const shotsDir = join(dir, 'screenshots');
  const shots = existsSync(shotsDir)
    ? readdirSync(shotsDir).filter((name) => /\.(png|jpe?g)$/i.test(name))
    : [];
  if (shots.length === 0) throw new Error('entry is incomplete: screenshots/ holds no PNG or JPEG image');
  if (shots.length > GATE.screenshots.max) {
    throw new Error(`entry is incomplete: ${shots.length} screenshots, over the ${GATE.screenshots.max} allowed`);
  }
}

/** Files and bytes under a directory, counted recursively (directories themselves cost no bytes). */
function measure(dir: string): { files: number; bytes: number } {
  let files = 0;
  let bytes = 0;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) {
      const inner = measure(path);
      files += inner.files;
      bytes += inner.bytes;
    } else {
      files += 1;
      bytes += st.size;
    }
  }
  return { files, bytes };
}

/** Copy one payload folder into the output directory and report what landed there. */
function stageFolder(name: string): { files: number; bytes: number } {
  const from = join(entryDir, name);
  const to = join(outputDir, name);
  mkdirSync(to, { recursive: true });
  if (existsSync(from)) cpSync(from, to, { recursive: true });
  return measure(to);
}

checkEntryLayout(entryDir);
mkdirSync(outputDir, { recursive: true });
const game = stageFolder('game');
const shots = stageFolder('screenshots');

const dossier = buildDossier(outputDir, GATE);
writeFileSync(join(outputDir, 'dossier.json'), dossier);

console.log(`Neon Tide: Coral Bay handed in to ${outputDir}`);
console.log(`  game/        ${game.files} files, ${game.bytes} bytes`);
console.log(`  screenshots/ ${shots.files} files, ${shots.bytes} bytes`);
console.log(`  dossier.json ${dossier.length} bytes`);
