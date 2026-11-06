# AGENTS.md — trees

## What this is

A procedurally generated low-poly cherry blossom tree on a grassy hill under a sky, swaying in the wind, with a time-of-day setting, explored with WASD and the mouse. It runs locally with `npm run dev`; there is no hosting.

- **Stack:** Vite + TypeScript + Three.js, no framework; lil-gui for the panel; vitest for unit tests; Playwright (preinstalled globally, not a dependency) for `scripts/shots.mjs`. Node 24 (`.nvmrc`, `package.json` `engines` `>=24`), the fleet baseline.
- **Non-goals:** hosting or publishing, other species, seasons, realistic rendering, mobile touch controls (`docs/work/0_first-tree/plan.md`).
- **Repo rules:** [`docs/policies/local-rules.md`](docs/policies/local-rules.md).

<!-- FLEET-CANON:BEGIN sha=926530db9933 generated from ../fleet/FLEET.md by `npm run sync-canon` — do not edit inside this block; this repo's own rules go in docs/policies/local-rules.md -->
## Fleet constitution

Shared rules for every repo under `github/`, kept in `../fleet/FLEET.md`; `../fleet/` is fleet's checkout beside this repo's primary checkout. Where a rule gives its reason, use the reason to judge cases the rule does not name; each `[Rn]`'s history is in `../fleet/docs/canon-rationale.md`. This repo's `docs/policies/local-rules.md` may add rules but cannot change these permissions or limits. [R13]

The designated coordinator reads `../fleet/docs/skills/coordinator.md` before planning and after each compaction, and any agent reads that file's "Delegate" section before delegating. Before these kinds of work, read the matching section of `../fleet/docs/work-rules.md`: standing loops and unattended runs; editing skills, agent instructions or rules; handing off or stopping mid-task.

### Permissions

- Commit, merge to main and push without asking. Force-pushing and rewriting history (they destroy history), and deploying and publishing (they reach other people), need the owner's OK. [R14]
- Ask before a major architecture or product change, a new major dependency, a change to a persistent format or a security boundary, or any other consequential action outside this machine, such as posting or sending something. [R8]
- Change fleet rules (FLEET.md, fleet skills and runbooks, agent memory) or add a rule to a repo's `docs/policies/local-rules.md` only when the owner asks, because the owner sets policy. You may add a proposal with its evidence to `../fleet/canon-candidates.md`, but not edit its entries. [R8]

### Sharing the machine

- Other Claude and Codex sessions may be working in this checkout, and you cannot see them. Do anything beyond a quick read in your own worktree, because two sessions in one tree spoil each other's gates and commits. Never revert, overwrite or delete changes you did not make. When resuming, check which worktrees, branches and files already exist. [R7]
- Done means merged to main and pushed: the owner archives sessions, and work left on a branch is lost. Merge on your branch, get the gates passing there, then move main, because other worktrees build on local main. Judge the merged result itself, not a worker's summary. Then remove your worktree and branch, and report where any unmerged work is. [R14]

### Doing the work

- The repo's gates must pass before any commit that touches code. Docs-only changes need content checks and any gate the repo names for docs, not runtime tests or CI waits. [R14]
- Check the thing that should have changed (the file, the page, the number), not just the exit code or a tool's report: both can pass over a defect. Retest a blocker you inherit before repeating it. Never weaken a test or hide a failure to get green. [R9]
- Look at visual and interactive work rendered at full resolution, through the real controls, from fixed and random views, because passing tests say nothing about pixels. Run it headless unless a visible window is needed. [R16]
- Slowness on the critical path, such as a gate rendering on the CPU of a machine with a GPU, is a defect to fix. [R22]
- After pushing code, follow CI to the end; read a failed job's steps before blaming the code, since a billing limit fails jobs before any step runs. [R15]
- If a fix fails twice for one reason, rethink it. After five real repair attempts at one problem, whatever the approach and counting earlier sessions, stop and report, unless the owner set another limit; for a problem that keeps winning, run the search in `../fleet/docs/skills/hard-problem.md`. Stop when the task's criteria are met; do not invent follow-up work. [R11]
- For substantial or high-risk changes, use independent review when available. High-risk includes persistence and migrations, security and auth, concurrency, money, supply chain, and code changes in another repo. Review the exact revision against the task's criteria, and say so when review was unavailable. Fix the findings that matter and have those fixes checked; note minor ones instead of starting another round. `../fleet/docs/skills/multi-cli-review.md` provides the review mechanics. [R10]
- A defect the owner reports gets a test for its whole class and an entry in `docs/learning/defect-register.md`, because a fix without a check tends to come back. [R17]
- Sessions run long: take new requests in the same session, and never hand off to a new session to shed context. Split work expected to need more than about 200k tokens of context into milestones, each merged to main. [R6]

### Records, sized to the work

- Read `docs/learning/lessons.md` at session start; it lists this repo's known traps, and its header says how to add one. [R18]
- Every change that alters behaviour adds a dated line to `docs/devlog/summary.md` (`../fleet/docs/devlog-template.md`) when it lands, because later sessions orient from its newest entries. Work that spans sessions, has several agents writing, or gets an independent review also keeps its plan and review records in `docs/work/` (`../fleet/docs/work-docs.md`); other work needs none. [R24]
- Raw output (logs, captures, screenshots) stays in ignored folders. Never commit a binary over 512 KiB or any file over 1 MiB; LFS needs the owner's OK. [R23]

### Style and environment

- Plain words; one line per paragraph, no hard wrapping. A report says what changed, how it was checked (including any check skipped or failed) and what is not done. [R25]
- Node 24 is the baseline. Products pin the model IDs they call in their own repo, and nowhere else. Reviewer model pins live only in `../fleet/docs/skills/multi-cli-review.md`. Runtime model calls are allowed and paid for; make per-item calls one-shot, not agent sessions. [R28, R29]
<!-- FLEET-CANON:END -->

## Gates

Run before every commit, from the repo root. Node 24 is the declared version, but there is no CI: the local agent machine ran these gates on Node 22.22, so Node 24 is not CI-proven, and `engines` is advisory there.

- `npm run build` — `tsc --noEmit` then `vite build`; must pass with no type errors.
- `npm test` — vitest over `tests/`.
- `npm run shots -- --label <name>` — renders 8 fixed and 3 random views into `shots/<name>/` from the built `dist/` (run `npm run build` first) with SwiftShader software WebGL, and fails on any page error, console error or console warning. It shows the picture, not the look on a real GPU or the frame rate. Read the PNGs at native resolution for any visual change. Add `--input` to drive the camera and panel through real key, mouse, wheel and click events; it fails unless each step moves the camera or changes the params, and it checks that a half-typed seed applies nothing and that Space on a focused button does not move the camera. Use `--port` when another worker holds 4173.
- `npm audit --audit-level=high` — dependency audit; also with `--omit=dev`.

## Invariants & boundaries

- `src/contracts.ts` is the shared interface between modules and changes only through the coordinator. `src/main.ts` wires modules and owns `window.__trees`, the shots hook. Each module lives in its own folder (`src/tree/`, `src/foliage/`, `src/scene/`, `src/ui/`) and talks to others only through the contracts.
- `src/shading/` is shared code owned by the coordinator, like `src/contracts.ts`: the wind, petal-light and up-facing-normals shader patches that several modules apply. Every patch edits three.js chunks through `replaceChunk`, which throws when a needle is missing, and `tests/shading.test.ts` runs each patch against the real ShaderLib sources.
- Generation is a pure function of `TreeParams`: every random draw goes through a seeded `src/random.ts` generator, never `Math.random`. The same params always grow the same tree. (The panel's "New tree" button picks a new seed with `Math.random`; that is user input, not generation.)
- Render budget: under 150k main-pass triangles and under 30 main-pass draw calls, at default params and at age 1 for the seeds `tests/budget.test.ts` checks (`docs/work/0_first-tree/plan.md`). Triangles count index (or vertex) count / 3, times `count` for an InstancedMesh; draw calls count one per visible Mesh, Points or Line. Shadow passes are not counted. `tests/budget.test.ts` builds scene, tree and foliage together and checks both.
- The URL query `?seed=&age=&time=&wind=&leaves=` is the shareable state: `src/urlParams.ts` reads it and `src/ui/urlSync.ts` writes it; keep the two round-tripping (`tests/ui.test.ts`).
- The camera stays above `y = 0.3` and within 80 m of the origin (`src/ui/movement.ts`).

## Conventions

- Low-poly look: flat shading (`flatShading: true`), visible facets, colour gradients rather than textures.
- Units are metres; the trunk base is at the origin and the ground near it is at `y = 0`.
- Pure math lives in DOM-free files so vitest can test it in node (jsdom is not installed).
- Shots go in `shots/` (gitignored). Plans and work docs go in `docs/work/`; history in `docs/devlog/`; lessons in `docs/learning/`.
