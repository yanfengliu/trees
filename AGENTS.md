# AGENTS.md — trees

## What this is

A procedurally generated low-poly cherry blossom tree on a grassy hill under a sky, swaying in the wind, with a time-of-day setting, explored with WASD and the mouse. It runs locally with `npm run dev`; there is no hosting.

- **Stack:** Vite + TypeScript + Three.js, no framework; lil-gui for the panel; vitest for unit tests; Playwright (preinstalled globally, not a dependency) for `scripts/shots.mjs`. Node 24 (`.nvmrc`, `package.json` `engines` `>=24`), the fleet baseline.
- **Non-goals:** hosting or publishing, other species, seasons, realistic rendering, mobile touch controls (`docs/work/0_first-tree/plan.md`).
- **Repo rules:** [`docs/policies/local-rules.md`](docs/policies/local-rules.md).

<!-- FLEET-CANON:BEGIN sha=e54f2a9ae007 generated from ../fleet/FLEET.md by `npm run sync-canon` — do not edit inside this block; this repo's own rules go in docs/policies/local-rules.md -->
## Fleet constitution

Reasons and evidence per `[Rn]`: `../fleet/docs/canon-rationale.md`. `../fleet/` is fleet's checkout beside the repo's primary checkout, also from a worktree. The designated coordinator reads `../fleet/docs/skills/coordinator.md` before planning and after each compaction, and any agent reads that file's "Delegate" section before delegating. Before these kinds of work, read the matching section of `../fleet/docs/work-rules.md`: visual and interactive work; games, simulations and research; measuring, debugging and slow steps; writing error messages; toolchains, dependencies and model calls; standing loops and unattended runs; pushing executable changes; a user-reported defect; editing skills, agent instructions or rules; run output and files over 256 KiB; handing off or stopping mid-task.

### Fleet Orchestration Policy

Deliver the requested outcome with verified correctness, coherent architecture and minimal necessary complexity. Optimize useful progress, not agent count, code volume or maximum reasoning. Adapt rigor to risk. This policy grants no new permissions or capabilities. [R1]

**Roles.** Only an explicitly designated agent coordinates; each scope has one accountable integration owner. [R2]

Workers own bounded outcomes and local implementation decisions. [R3]

Inspect instructions, code, docs, tree state and active tasks; set outcome, non-goals, acceptance criteria, dependencies and verification; settle ambiguity with evidence and reversible defaults. [R4]

**Session size** (owner directives, 2026-09-23 and 2026-10-22). Sessions run long: take new requests as separate assignments in the same session, and never hand off to a successor session to shed context; auto-compaction carries the session. Split tasks expected to exceed about 200k context tokens into milestones within that budget, each committed and merged to main once green. Milestones are task boundaries; a compaction never justifies wrapping up or handing off. [R6]

**Coordinate safely.** Beyond a trivial read, each session or agent defaults to its own worktree; serialize overlapping writes only when none is available, and say why. Finish each bounded increment in its session: merge to main, push, then `git worktree remove`, remove completed task-owned branches and unneeded temporary files, and explicitly transfer the ownership and location of still-needed resources. Report any merged worktree left and its location as a defect. Never overwrite or discard another participant's work. On resumption, first inspect surviving worktrees, artifacts and task status, assuming nothing survived until checked; recover what exists and preserve unfinished work. [R7]

Workers act autonomously in scope; escalate cross-task interfaces, persistent formats, security boundaries, major dependencies and scope changes to the coordinator for resolution within the approved mandate. Unapproved major architecture or product changes and consequential external actions need human authorization. Fleet rules (FLEET.md, the fleet's skills and runbooks, canon candidates, and agent memory) change only when the owner asks (owner directive, 2026-10-28). Agents propose changes instead of making them. The one exception: they may add a proposal to `../fleet/canon-candidates.md`, with the lesson, its evidence and the rule it would change (owner directive, 2026-10-29). They never change, promote or delete an entry: the owner decides each one, and the session the owner asks makes the change. Never reset consumed allowances. [R8]

**Implement and verify.** Inspect, implement a coherent increment, check, diagnose, fix, recheck. Preserve architecture; no unrelated rewrites, speculative abstractions or unnecessary dependencies. Implement when requested. Use task-appropriate evidence and baselines; prototype uncertain ideas before generalizing. Never weaken tests or conceal failures to claim success. Docs-only work uses content and version checks; skip runtime tests and CI waits. [R9]

During authorized work and within scope and budget, proactively improve products and the task's orchestration, learn from recorded outcomes and propose improvements to fleet rules. Read `../fleet/docs/skills/self-improvement/SKILL.md` when proposing a fleet-rule change or turning a mistake into a gate (owner directive, 2026-10-29). [R33]

Obtain independent, preferably read-only review for substantial or high-risk changes when available. Review the exact revision against acceptance criteria. Report unavailable review; fix justified findings, rerun affected checks, and obtain focused re-review when fixes invalidate earlier review. [R10]

**Integrate, report, and stop.** Reassess after two failures for one reason. Unless another budget is set or the user authorizes more, cap automatic repair at five substantive attempts, then report; explicit overrides hold for their stated scope without asking again. Keep updates brief and decision-relevant. Stop when acceptance criteria and material findings are resolved; invent no follow-up work. [R11]

**Final acceptance gate.** The integration owner integrates in dependency order and on the final integrated revision's actual changes and evidence, not worker summaries, checks every acceptance criterion, runs relevant automated checks and exercises affected end-to-end behavior and cross-task interactions. Substantial or high-risk work gets independent read-only review of the integrated changes, integration fixes included. Confirm the merge to main; report that revision, review status and every failed, skipped or unavailable check and unmet criterion. Nothing is fully verified with an open material finding or required check. [R12]

### Fleet conventions

- Repository rules add local constraints consistent with this policy; they cannot override its permissions, adaptive workflow or stopping limits. [R13]
- Gates pass before any commit touching code, a merge included: merge on a detached HEAD or its own branch and move main to it once its gate passes. The user's standing grant covers committing, merging to main and pushing in their repos; force-pushing, rewriting history, deploying and publishing still need authorization. Work is done only once merged to main, regardless of green branch or worktree gates; report unmerged work's location. [R14]
- For substantial or high-risk changes, use independent review when available. High-risk includes persistence and migrations, security and auth, concurrency, money, supply chain, and executable changes in sibling repos; `../fleet/docs/skills/multi-cli-review.md` provides the review mechanics. [R10]
- Reviewer model pins live only in `../fleet/docs/skills/multi-cli-review.md`; every model a product calls is pinned in its calling repo. No model IDs are hardcoded elsewhere. [R29]
- Read `docs/learning/lessons.md` at session start. Record the session's lessons there; each names its retiring gate and is deleted in the commit landing it. A gate counts only after going red with the defect reintroduced, following `../fleet/docs/lessons-template.md`. [R18]
- Gates prove nothing beyond their bounds: name the bound in the header and pin every reproducing input. Distinguish passed from did-not-run; a check built from its checked symbol proves only self-agreement. [R19]
- Verify outcomes beyond exit status, red or green, and return values: read the artifact that should have changed. Retest inherited blockers before repeating them. [R20]
- Keep plans and every authored review round in permanent `docs/work/<id>_<theme>/` folders (`../fleet/docs/work-docs.md`). Record history, not status: a dated devlog line per behaviour-changing session in `docs/devlog/summary.md` (`../fleet/docs/devlog-template.md`). [R24]
- Use common words with the same meaning in chat, docs, commits, PRs, comments and errors. One idea per sentence unless a rule needs more. Cut length, not facts: keep exact terms, numbers and evidence. Quotes and pastes are exempt; do not copy this canon's style. One line per paragraph, no hard wrapping. [R25]
- When blocked, immediately hand over the redacted artifact with the named blocker, before analysis; continue safe independent work. [R27]
- The owner's directions that outlive a task land that session in `../fleet/FLEET.md` if fleet-wide, otherwise the repo's `docs/policies/local-rules.md`; report where. [R31]
- When a hard problem blocks progress, run the search in `../fleet/docs/skills/hard-problem.md`. [R32]
<!-- FLEET-CANON:END -->

## Gates

Run before every commit, from the repo root. Node 24 is the declared version, but there is no CI: the local agent machine ran these gates on Node 22.22, so Node 24 is not CI-proven (canon R28), and `engines` is advisory there.

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
