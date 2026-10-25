// Render the app headlessly from fixed and random camera angles into shots/<label>/.
// Usage: node scripts/shots.mjs [--label name] [--query "seed=7&season=autumn"] [--random N] [--port 4173]
// Bound: proves only what the saved PNGs show for the given query, at 1280x800, with wind time frozen at t=2s.
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
const outDir = `shots/${label}`;
mkdirSync(outDir, { recursive: true });

const FIXED = [
  { name: 'front', az: 0, el: 8, dist: 2.2 },
  { name: 'three-quarter', az: 45, el: 12, dist: 2.2 },
  { name: 'side', az: 90, el: 8, dist: 2.2 },
  { name: 'back', az: 180, el: 8, dist: 2.2 },
  { name: 'low-hero', az: 30, el: 2, dist: 1.4 },
  { name: 'high', az: 20, el: 45, dist: 2.6 },
  { name: 'canopy-close', az: 60, el: 25, dist: 0.9 },
  { name: 'far', az: 30, el: 10, dist: 4.5 },
];

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(port), '--strictPort'], { stdio: 'pipe' });
await new Promise((resolve, reject) => {
  server.stdout.on('data', (d) => d.toString().includes('http') && resolve());
  server.on('exit', (code) => reject(new Error(`vite preview exited with code ${code}; run "npm run build" first and check port ${port} is free`)));
});

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
try {
  await page.goto(`http://localhost:${port}/?${query}`);
  await page.waitForSelector('body[data-ready="true"]', { timeout: 60000 });
  await page.evaluate(() => window.__trees.freezeTime(2));
  const views = [...FIXED];
  for (let i = 0; i < randomCount; i++) views.push({ name: `random-${i}`, az: Math.random() * 360, el: 2 + Math.random() * 40, dist: 0.9 + Math.random() * 3 });
  const manifest = [];
  for (const v of views) {
    await page.evaluate(({ az, el, dist }) => window.__trees.setCamera(az, el, dist), v);
    await page.waitForTimeout(400);
    const file = `${outDir}/${v.name}.png`;
    await page.screenshot({ path: file });
    manifest.push({ ...v, file, sha256: createHash('sha256').update(readFileSync(file)).digest('hex') });
  }
  const stats = await page.evaluate(() => window.__trees.stats());
  writeFileSync(`${outDir}/manifest.json`, JSON.stringify({ query, stats, errors, views: manifest }, null, 2));
  console.log(JSON.stringify({ outDir, stats, errors, shots: manifest.length }));
  if (errors.length) process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}
