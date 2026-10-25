# A beautiful 3D tree

Status: in-progress
Owner: Coordinator (Claude thread)
Created: 2026-10-25
Updated: 2026-10-25

## Problem and outcome

Yanfeng asked for "a beautiful tree in 3D". Outcome: `npm run dev` opens a browser scene with a procedurally generated low-poly cherry blossom tree on a grassy hill under a sky, swaying in wind, with a time-of-day setting, explored with WASD and mouse.

## Scope

Owner answers (2026-10-25): low-poly style; cherry blossom; Three.js; generated from a seed; wind motion; tree, grass, sky and time of day; WASD and mouse camera; local `npm run dev` only, no GitHub Pages yet; full fleet setup.

Exclusions: hosting or publishing, other species, seasons, realistic rendering, mobile touch controls.

## Approach

Vite + TypeScript + Three.js, no framework. `src/contracts.ts` is the shared interface; `src/main.ts` wires modules and exposes `window.__trees` for `scripts/shots.mjs`. Low-poly means flat shading (`flatShading: true`) and visible facets, with soft colour gradients rather than textures. All generation is a pure function of `TreeParams` via `src/random.ts`.

Four parallel workers, one module each, each in its own git worktree and branch:

| Worker | Owns | Branch |
| --- | --- | --- |
| tree | `src/tree/`, tree tests | `w/tree` |
| foliage | `src/foliage/`, `src/wind/`, falling petals | `w/foliage` |
| scene | `src/scene/` (sky, sun, time of day, hill, grass, fog) | `w/scene` |
| ui | `src/ui/` (WASD + mouse camera, panel), AGENTS.md and fleet docs, `scripts/shots.mjs` | `w/ui` |

Integration order: tree, foliage, scene, ui; the coordinator merges and runs the final gate.

## Acceptance criteria

- [ ] `npm run build` and `npm test` pass.
- [ ] `npm run dev` shows a cherry blossom tree, grass, sky and sun; no console errors.
- [ ] Same seed gives the same tree; different seeds give visibly different trees (unit test plus shots).
- [ ] Branches and blossoms sway; petals drift; the motion is gentle at default wind.
- [ ] Time of day changes sun position, sky and light colour from dawn through night.
- [ ] WASD moves, mouse drag looks around, verified through real key and mouse input in Playwright.
- [ ] Shots from 8 fixed and 3 random angles reviewed at native resolution, at three times of day and two seeds.
- [ ] 60 fps class performance: under 150k triangles and under 30 draw calls, at default params and at age 1 for any seed. Both are measured on the main render pass of the whole scene (terrain, meadow, sky, tree and foliage): triangles are index (or vertex) count / 3, times `count` for an InstancedMesh; draw calls are one per visible Mesh, Points or Line; shadow passes are not counted. `tests/budget.test.ts` checks it. After the 2026-10-25 review: 133,851 triangles and 12 draw calls at defaults, 142,566 at the worst tested age-1 seed (18).
- [ ] Fleet setup: AGENTS.md with canon block, CLAUDE.md = `@AGENTS.md`, devlog, lessons, defect register.

## Implementation steps

- [x] Scaffold, contracts and shots script (coordinator).
- [ ] Workers deliver modules in parallel.
- [ ] Integrate, multi-angle review, independent review, merge to main.

## Outcome

Pending.
