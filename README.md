# gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/ko1216-lild/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/ko1216-lild/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Neon Tide: Coral Bay is an original top-down open-world crime game that runs offline in a desktop browser from static files alone. Its city, Coral Bay in the invented state of Solana, is laid out on a 6×5 road grid with named landmarks, a beach and a pier. Traffic drives the grid, pedestrians scatter when danger comes close, and cars can be stolen. A five-star wanted system brings CBPD Interceptors after the player, with BUSTED and WASTED outcomes. The story runs through five missions with dialogue and cash rewards; combat covers fists and a pistol; the HUD carries a minimap; and a title screen, pause and localStorage autosave round it out. Nothing is loaded from the network and no library is used — each sprite is drawn and each sound is synthesised in code while the game runs.

## How to play

Walk and drive with W A S D or the arrow keys. Press E to get into a car, F to punch, and aim with the mouse. Follow the gold marker to work through Rosa Delgado's five missions, and keep an eye on the wanted stars: the more heat, the more Interceptors join the chase.

## Run it

```sh
node main.ts   # copies game/ and screenshots/ to the output directory; open game/index.html in a browser to play
```

## Round 2 revision

This pass replaces the hand-in program with one written for the occasion: main.ts now inspects the entry against the bounty caps before copying anything, stages game/ and screenshots/ file by file, and reports the staged totals in its own summary. The README was rewritten in the same pass, and every game file was re-issued with it, so the submitted tree is exactly the tree that was recorded. The game itself is untouched — same city, same missions, same screenshots.

---

<sub>Entered on [make.fun](https://make.fun/?ref=vivid-stork-95&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
