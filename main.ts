// Neon Tide: Coral Bay — hand-in program for the gta6-01 bounty.
// Written for this recorded round-2 pass. Node 22, standard library only.
//
// The job, end to end:
//   * look over the entry that sits beside this file and refuse early if a piece is missing,
//   * stage a copy of game/ and screenshots/ in the output directory,
//   * ask the vendored library to summarise the staged tree as dossier.json,
//   * print what was staged, so the hand-in can be eyeballed from the log.
//
// MAKEFUN_OUTPUT_DIR says where the output goes; without it the grader's /output is used:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Playing the game is separate: serve this folder and open game/index.html in a browser.

import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The bounty gate, passed whole to buildDossier. Only text_max_bytes shapes the bytes of
// the dossier itself; the remaining caps are this program's own early-warning limits, set
// to the values the task specifies for this hand-in.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 1024,
  game_max_bytes: 67108864,
  game_path_max_bytes: 1000,
};

const home = dirname(fileURLToPath(import.meta.url));
const destination = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const IMAGE_NAME = /\.(png|jpe?g)$/i;

function fail(reason: string): never {
  throw new Error(`cannot hand in: ${reason}`);
}

/** Names of the screenshot images on disk, in directory order. */
function screenshotNames(): string[] {
  const dir = join(home, 'screenshots');
  if (!existsSync(dir)) fail('screenshots/ is missing');
  return readdirSync(dir).filter((name) => IMAGE_NAME.test(name));
}

/** Check the entry's shape against the gate before anything is copied anywhere. */
function inspectEntry(): void {
  const page = join(home, 'game', 'index.html');
  if (!existsSync(page)) fail('game/index.html is missing');

  const names = screenshotNames();
  if (names.length === 0) fail('screenshots/ holds no PNG or JPEG image');
  if (names.length > CAPS.screenshots.max) {
    fail(`${names.length} screenshots, over the ${CAPS.screenshots.max} allowed`);
  }
  for (const name of names) {
    const size = statSync(join(home, 'screenshots', name)).size;
    if (size > CAPS.screenshots.max_bytes) {
      fail(`screenshots/${name} is ${size} bytes, over the ${CAPS.screenshots.max_bytes} allowed`);
    }
  }

  // Walk game/ once, holding it to the file-count, byte and path-length caps.
  let entries = 0;
  let bytes = 0;
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      const rel = relative(join(home, 'game'), path);
      if (Buffer.byteLength(rel, 'utf8') > CAPS.game_path_max_bytes) {
        fail(`game/${rel} has a path over ${CAPS.game_path_max_bytes} bytes`);
      }
      entries += 1;
      const st = statSync(path);
      if (st.isDirectory()) walk(path);
      else bytes += st.size;
    }
  };
  walk(join(home, 'game'));
  if (entries > CAPS.game_max_files) fail(`game/ holds ${entries} entries, over the ${CAPS.game_max_files} allowed`);
  if (bytes > CAPS.game_max_bytes) fail(`game/ holds ${bytes} bytes, over the ${CAPS.game_max_bytes} allowed`);
}

/** Copy a folder tree file by file; returns how many files landed and their total size. */
function stageTree(name: string): { files: number; bytes: number } {
  const fromRoot = join(home, name);
  const toRoot = join(destination, name);
  let files = 0;
  let bytes = 0;
  const copy = (from: string, to: string): void => {
    mkdirSync(to, { recursive: true });
    for (const entry of readdirSync(from)) {
      const src = join(from, entry);
      const dst = join(to, entry);
      if (statSync(src).isDirectory()) {
        copy(src, dst);
      } else {
        copyFileSync(src, dst);
        files += 1;
        bytes += statSync(dst).size;
      }
    }
  };
  if (existsSync(fromRoot)) copy(fromRoot, toRoot);
  return { files, bytes };
}

inspectEntry();
mkdirSync(destination, { recursive: true });
const gameStats = stageTree('game');
const shotStats = stageTree('screenshots');

const dossierBytes = buildDossier(destination, CAPS);
writeFileSync(join(destination, 'dossier.json'), dossierBytes);

console.log('Neon Tide: Coral Bay — hand-in staged');
console.log(`  output:      ${destination}`);
console.log(`  game/:       ${gameStats.files} files, ${gameStats.bytes} bytes`);
console.log(`  screenshots: ${shotStats.files} files, ${shotStats.bytes} bytes`);
console.log(`  dossier:     ${dossierBytes.length} bytes written`);
