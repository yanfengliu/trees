// Render the app headlessly from fixed and random camera angles into shots/<label>/.
// Usage: node scripts/shots.mjs [--label name] [--query "seed=7&age=1&time=12"] [--random N] [--port 4173] [--input]
// It serves and renders whatever dist/ holds, so run `npm run build` first or it shows a stale build.
// Rendering is SwiftShader software WebGL in headless Chromium: it says nothing about the look on a real GPU or the frame rate.
// Bound: proves only what the saved PNGs show for the given query, at 1280x800, with wind time frozen at t=2s.
// Fails on any page error, console error or console warning (none are allow-listed; add one to WARNING_ALLOW with a reason).
// --input instead drives the camera through real Playwright key, mouse and wheel events and fails unless each
// step changed the pose the controls mirror into canvas[data-pose] ("x,y,z,yaw,pitch") and the frame's hash.
// It proves the input wiring and direction of motion in headless Chromium, not feel, speed at 60 fps or touch input.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// Playwright is preinstalled globally on the agent machines and is not a project dependency; CommonJS resolution honours NODE_PATH.
const { chromium } = createRequire(import.meta.url)('playwright');

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []));
const label = args.label ?? 'default';
const query = args.query ?? '';
const randomCount = Number(args.random ?? 3);
const port = Number(args.port ?? 4173);
const inputMode = 'input' in args;
const outDir = `shots/${label}`;
mkdirSync(outDir, { recursive: true });

const FIXED = [
  { name: 'front', az: 0, el: 8, dist: 2.2 },
  { name: 'three-quarter', az: 45, el: 12, dist: 2.2 },
  { name: 'side', az: 90, el: 8, dist: 2.2 },
  { name: 'back', az: 180, el: 8, dist: 2.2 },
  { name: 'low-hero', az: 30, el: 2, dist: 1.4 },
  { name: 'high', az: 20, el: 45, dist: 2.6 },
  // Just outside the crown edge, slightly below the blossom, looking in: shows branch structure under the blossoms.
  { name: 'crown-edge', az: 60, el: -6, edge: 1.0 },
  { name: 'far', az: 30, el: 10, dist: 4.5 },
];

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(port), '--strictPort'], { stdio: 'pipe' });
await new Promise((resolve, reject) => {
  server.stdout.on('data', (d) => d.toString().includes('http') && resolve());
  server.on('exit', (code) => reject(new Error(`vite preview exited with code ${code}; run "npm run build" first and check port ${port} is free`)));
});

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
/** Console warnings that may appear without failing the run, as regular expressions with the reason. Keep it empty if you can. */
const WARNING_ALLOW = [];
const errors = [];
const warnings = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
  else if (m.type() === 'warning' && !WARNING_ALLOW.some(({ pattern }) => pattern.test(m.text()))) warnings.push(m.text());
});
try {
  await page.goto(`http://localhost:${port}/?${query}`);
  await page.waitForSelector('body[data-ready="true"]', { timeout: 60000 });
  await page.evaluate(() => window.__trees.freezeTime(2));
  if (inputMode) await checkInput();
  else {
    await page.evaluate(() => window.__trees.pause());
    // An `edge` view sits that many metres outside the crown radius, measured on the ground plane.
    const { height, crownRadius } = await page.evaluate(() => window.__trees.stats());
    const views = FIXED.map((v) => (v.edge === undefined ? v : { ...v, dist: (crownRadius + v.edge) / (height * Math.cos((v.el * Math.PI) / 180)) }));
    for (let i = 0; i < randomCount; i++) views.push({ name: `random-${i}`, az: Math.random() * 360, el: 2 + Math.random() * 40, dist: 0.9 + Math.random() * 3 });
    const manifest = [];
    for (const v of views) {
      await page.evaluate(({ az, el, dist }) => { window.__trees.setCamera(az, el, dist); window.__trees.renderOnce(); }, v);
      const file = `${outDir}/${v.name}.png`;
      await page.screenshot({ path: file });
      manifest.push({ ...v, file, sha256: createHash('sha256').update(readFileSync(file)).digest('hex') });
    }
    const stats = await page.evaluate(() => window.__trees.stats());
    writeFileSync(`${outDir}/manifest.json`, JSON.stringify({ query, stats, errors, warnings, views: manifest }, null, 2));
    console.log(JSON.stringify({ outDir, stats, errors, warnings, shots: manifest.length }));
  }
  if (errors.length || warnings.length) {
    for (const e of errors) console.error(`page error: ${e}`);
    for (const w of warnings) console.error(`console warning: ${w}`);
    process.exitCode = 1;
  }
} finally {
  await browser.close();
  server.kill();
}

/** Drive the camera with real input and assert each step moved it. Writes input-*.png and manifest.json. */
async function checkInput() {
  const pose = async () => (await page.$eval('canvas', (c) => c.dataset.pose ?? '')).split(',').map(Number);
  const steps = [];
  let failed = 0;
  // Wait until the damped velocity has died out: the pose is unchanged over SETTLE_FRAMES rendered frames.
  // Counted in frames, not milliseconds: under SwiftShader one frame can take longer than any fixed wait, and
  // main.ts caps dt at 0.1 s, so momentum takes many frames to decay however slow they are. Each page
  // requestAnimationFrame tick runs the app's frame (and so controls.update) exactly once between two reads.
  const SETTLE_FRAMES = 5;
  const settle = async () => {
    const ok = await page.evaluate(async (need) => {
      const read = () => document.querySelector('canvas')?.dataset.pose ?? '';
      const tick = () => new Promise((r) => requestAnimationFrame(() => r()));
      const t0 = performance.now();
      let last = read(), same = 0;
      while (same < need && performance.now() - t0 < 60000) {
        await tick();
        const now = read();
        same = now === last ? same + 1 : 0;
        last = now;
      }
      return same >= need;
    }, SETTLE_FRAMES);
    if (!ok) throw new Error('camera pose did not settle within 60 s');
  };
  // Hold a key for at least `ms` and at least `frames` rendered frames, so a slow frame rate still applies the input.
  const hold = async (key, ms, frames) => {
    await page.keyboard.down(key);
    await Promise.all([page.waitForTimeout(ms), page.evaluate(async (n) => { for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(() => r())); }, frames)]);
    await page.keyboard.up(key);
  };
  const shot = async (name) => {
    const file = `${outDir}/input-${name}.png`;
    await page.screenshot({ path: file });
    return { file, sha256: createHash('sha256').update(readFileSync(file)).digest('hex') };
  };
  await page.evaluate(() => window.__trees.setCamera(30, 8, 2.2));
  await settle();
  let before = { pose: await pose(), ...(await shot('start')) };
  // Each check gets the pose before and after: [x, y, z, yaw, pitch].
  const step = async (name, act, check) => {
    await act();
    await settle();
    const after = { pose: await pose(), ...(await shot(name)) };
    const [ok, detail] = check(before.pose, after.pose);
    const frameChanged = after.sha256 !== before.sha256;
    const pass = ok && (frameChanged || name === 'typing-ignored');
    if (!pass) failed++;
    steps.push({ name, pass, detail, frameChanged, before: before.pose, after: after.pose, file: after.file });
    before = after;
  };
  const moved = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  // Ground-plane forward for the yaw before the move.
  const along = (a, b) => (b[0] - a[0]) * -Math.sin(a[3]) + (b[2] - a[2]) * -Math.cos(a[3]);
  const box = await page.$eval('canvas', (c) => { const r = c.getBoundingClientRect(); return { x: r.width / 2, y: r.height / 2 }; });

  await step('hold-w', () => hold('KeyW', 1000, 10),
    (a, b) => [along(a, b) > 0.3 && Math.abs(b[1] - a[1]) < 0.05, `forward ${along(a, b).toFixed(2)} m, dy ${(b[1] - a[1]).toFixed(3)}`]);
  await step('hold-e', () => hold('KeyE', 1000, 10),
    (a, b) => [b[1] - a[1] > 0.2, `up ${(b[1] - a[1]).toFixed(2)} m`]);
  await step('drag-look', async () => {
    await page.mouse.move(box.x, box.y);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(box.x + i * 20, box.y - i * 6);
    await page.mouse.up();
  }, (a, b) => [b[3] - a[3] < -0.3 && b[4] - a[4] > 0.1 && moved(a, b) < 0.05, `yaw ${(b[3] - a[3]).toFixed(2)} rad, pitch ${(b[4] - a[4]).toFixed(2)} rad, moved ${moved(a, b).toFixed(3)} m`]);
  await step('scroll', async () => { await page.mouse.move(box.x, box.y); await page.mouse.wheel(0, -300); },
    (a, b) => [moved(a, b) > 0.5, `moved ${moved(a, b).toFixed(2)} m`]);
  await step('typing-ignored', async () => {
    const field = page.locator('.lil-gui input').first();
    await field.click();
    await hold('KeyW', 500, 5);
    await page.keyboard.press('Escape');
    await page.locator('.lil-gui .lil-title').first().click(); // blur the field without touching the canvas
    await page.locator('.lil-gui .lil-title').first().click();
  }, (a, b) => [moved(a, b) < 0.05, `moved ${moved(a, b).toFixed(3)} m while typing in the panel`]);

  // The panel through real clicks: "New tree" changes the seed and the URL, "Cycle day" advances the clock.
  const panel = async (name, act, check) => {
    const a = await page.evaluate(() => window.__trees.params());
    await act();
    const b = await page.evaluate(() => window.__trees.params());
    const [pass, detail] = check(a, b, new URL(page.url()).searchParams);
    if (!pass) failed++;
    steps.push({ name, pass, detail, before: a, after: b, ...(await shot(name)) });
  };
  await panel('new-tree', async () => { await page.getByText('New tree').click(); await page.waitForTimeout(1500); },
    (a, b, q) => [a.seed !== b.seed && q.get('seed') === String(b.seed), `seed ${a.seed} -> ${b.seed}, url seed=${q.get('seed')}`]);
  await panel('cycle-day', async () => {
    await page.getByText('Cycle day').click();
    await page.waitForTimeout(2000);
    await page.getByText('Cycle day').click();
  }, (a, b) => [b.timeOfDay > a.timeOfDay && b.timeOfDay - a.timeOfDay < 1, `time ${a.timeOfDay.toFixed(3)} -> ${b.timeOfDay.toFixed(3)} h`]);
  // Typing a seed while "Cycle day" ticks applies nothing until Enter: no trees 1 and 12 on the way to 123.
  const seedField = page.locator('.lil-gui input').first();
  let midTyping = null;
  await panel('seed-typing', async () => {
    await page.getByText('Cycle day').click();
    await seedField.click();
    await seedField.fill('');
    await page.keyboard.type('12', { delay: 100 });
    await page.waitForTimeout(800); // several 10 Hz cycle ticks with "12" in the field
    midTyping = await page.evaluate(() => window.__trees.params());
    await page.keyboard.type('3');
    await page.keyboard.press('Enter');
    await page.getByText('Cycle day').click();
    await page.waitForTimeout(300);
  }, (a, b) => [midTyping.seed === a.seed && midTyping.timeOfDay !== a.timeOfDay && b.seed === 123,
    `seed ${a.seed} -> ${midTyping.seed} while typing (time ${a.timeOfDay.toFixed(3)} -> ${midTyping.timeOfDay.toFixed(3)} h) -> ${b.seed} after Enter`]);
  // Space on a focused "New tree" button presses the button and does not also raise the camera.
  let spacePose = null;
  await panel('space-on-button', async () => {
    await page.locator('.lil-gui button', { hasText: 'New tree' }).focus();
    const y0 = (await pose())[1];
    await hold('Space', 600, 6);
    await page.waitForTimeout(1500);
    await settle();
    spacePose = { y0, y1: (await pose())[1] };
  }, (a, b) => [a.seed !== b.seed && Math.abs(spacePose.y1 - spacePose.y0) < 0.01, `seed ${a.seed} -> ${b.seed}, camera dy ${(spacePose.y1 - spacePose.y0).toFixed(3)} m`]);

  const url = page.url();
  writeFileSync(`${outDir}/manifest.json`, JSON.stringify({ query, mode: 'input', url, errors, warnings, steps }, null, 2));
  for (const s of steps) console.log(`${s.pass ? 'PASS' : 'FAIL'} ${s.name}: ${s.detail}${s.frameChanged === false ? ' (frame unchanged)' : ''}`);
  console.log(JSON.stringify({ outDir, errors, warnings, steps: steps.length, failed }));
  if (failed) process.exitCode = 1;
}
