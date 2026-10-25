# Local rules — trees

Rules true only in this repo. Fleet-wide rules live in `../fleet/FLEET.md`, copied into AGENTS.md.

- Owner choices (2026-10-25) are fixed scope: low-poly cherry blossom in Three.js, generated from a seed, wind, grass, sky and time of day, WASD and mouse camera, local `npm run dev` only (no GitHub Pages until the owner asks).
- Any visual change is checked with `npm run shots` and the PNGs read at native resolution; any change to camera or panel input is also checked with `npm run shots -- --input`.
- Shots are CPU heavy (software WebGL): run one at a time on shared machines and give each worker its own `--port`.
