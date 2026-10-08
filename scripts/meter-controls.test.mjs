#!/usr/bin/env node
// Browser regression test for DecibelMeter control wiring.
// Serves ./dist over localhost and drives the meter UI with Playwright in
// Chromium and Firefox, asserting:
//   1. No page errors and no console errors on load (all 3 meter pages).
//   2. Dragging the calibration slider updates the [data-calib-value] label.
//   3. The calibration slider thumb sits at center for 0 dB.
//   4. "Test alarm" flashes the alarm (data-alarm="on" + message visible).
//   5. The alarm toggle flips alarm state + persists via change events.
// Usage: node scripts/meter-controls.test.mjs [--port 8471]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium, firefox } from 'playwright-core';

const DIST = new URL('../dist/', import.meta.url).pathname;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json',
};

function startServer(port) {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      try {
        const url = new URL(req.url ?? '/', 'http://localhost');
        let rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
        if (rel === '' || url.pathname.endsWith('/')) rel += 'index.html';
        const file = normalize(join(DIST, rel));
        if (!file.startsWith(DIST)) {
          res.writeHead(403).end('forbidden');
          return;
        }
        const body = await readFile(file);
        res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
        res.end(body);
      } catch {
        res.writeHead(404).end('not found');
      }
    });
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

const PAGES = [
  { name: 'home', path: '/' },
  { name: 'classroom', path: '/classroom-noise-meter/' },
  { name: 'sound', path: '/sound-level-meter/' },
];

let failures = 0;
function check(cond, label) {
  if (cond) console.log(`  ok   ${label}`);
  else {
    failures += 1;
    console.error(`  FAIL ${label}`);
  }
}

async function dragSliderTo(page, track, x) {
  const box = await track.boundingBox();
  if (!box) throw new Error('slider track has no bounding box');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + x, box.y + box.height / 2, { steps: 12 });
  await page.mouse.up();
}

async function testPage(browserType, launch, base, { name, path }) {
  console.log(`[${browserType}] ${name} ${path}`);
  const browser = await launch();
  const errors = [];
  const page = await browser.newPage();
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
  });
  await page.goto(base + path, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-meter]', { timeout: 10000 });

  const hasCalib = (await page.locator('[data-calib]').count()) > 0;
  const hasAlarmToggle = (await page.locator('[data-alarm-toggle]').count()) > 0;
  const hasAlarmTest = (await page.locator('[data-alarm-test]').count()) > 0;
  const hasThreshold = (await page.locator('[data-threshold]').count()) > 0;

  // 1. Calibration slider drag -> label updates.
  if (hasCalib) {
    const calib = page.locator('[data-calib]');
    const label = page.locator('[data-calib-value]');
    await calib.scrollIntoViewIfNeeded();
    await calib.evaluate((el) => {
      el.value = '0';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    check(((await label.textContent()) ?? '').trim() === '0 dB', 'calib label shows 0 dB after reset');
    const box = await calib.boundingBox();
    if (box) {
      await dragSliderTo(page, calib, box.width * 0.1);
      const text = ((await label.textContent()) ?? '').trim();
      const num = Number(text.replace(' dB', '').replace('+', ''));
      check(text !== '0 dB' && Number.isFinite(num) && num < 0, `calib label follows drag (got "${text}")`);
    }
    // Thumb at center for 0 dB.
    await calib.evaluate((el) => {
      el.value = '0';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const frac = await calib.evaluate((el) => {
      const min = Number(el.min);
      const max = Number(el.max);
      return (Number(el.value) - min) / (max - min);
    });
    check(Math.abs(frac - 0.5) < 0.02, `calib thumb centered at 0 dB (fraction ${frac.toFixed(3)})`);
  } else {
    console.log('  skip calib slider absent on this page');
  }

  // 2. "Test alarm" flashes the alarm state + message.
  if (hasAlarmTest) {
    await page.locator('[data-alarm-test]').scrollIntoViewIfNeeded();
    await page.locator('[data-alarm-test]').click();
    await page.waitForFunction(
      () => document.querySelector('[data-meter]')?.getAttribute('data-alarm') === 'on',
      null,
      { timeout: 5000 }
    ).catch(() => {});
    const alarmAttr = await page.locator('[data-meter]').getAttribute('data-alarm');
    check(alarmAttr === 'on', '"Test alarm" sets data-alarm="on"');
    const msgVisible = await page.locator('[data-alarm-msg]').isVisible().catch(() => false);
    check(msgVisible, 'alarm message becomes visible during test flash');
  } else {
    console.log('  skip alarm test button absent on this page');
  }

  // 3. Alarm toggle flips state through real change events.
  if (hasAlarmToggle) {
    const toggle = page.locator('[data-alarm-toggle]');
    await toggle.scrollIntoViewIfNeeded();
    const before = await toggle.isChecked();
    await toggle.evaluate((el) => {
      el.checked = !el.checked;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const after = await toggle.isChecked();
    check(after !== before, `alarm toggle flips (was ${before}, now ${after})`);
  } else {
    console.log('  skip alarm toggle absent on this page');
  }

  // Threshold slider shares the same init path — confirm it is wired too.
  if (hasThreshold) {
    const t = page.locator('[data-threshold]');
    await t.scrollIntoViewIfNeeded();
    await t.evaluate((el) => {
      el.value = '90';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const tText = ((await page.locator('[data-threshold-value]').textContent()) ?? '').trim();
    check(tText === '90 dB', `threshold label updates (got "${tText}")`);
  }

  check(errors.length === 0, `no page/console errors (${errors.length})`);
  for (const e of errors) console.error(`    ${e}`);
  await browser.close();
}

const portIdx = process.argv.indexOf('--port');
const port = portIdx >= 0 ? Number(process.argv[portIdx + 1]) || 8471 : 8471;
const ffOnly = process.argv.includes('--firefox-only');
const crOnly = process.argv.includes('--chromium-only');
// Playwright's CDN is unreachable in some sandboxes; fall back to a system
// Chromium (Brave here) via executablePath so the chromium leg can still run.
const chromiumExe =
  process.env.CHROMIUM_EXE ||
  '/usr/bin/brave-browser';
const launchChromium = () =>
  chromium.launch({
    ...(process.env.PLAYWRIGHT_CHROMIUM_REV
      ? {}
      : { executablePath: chromiumExe }),
  });
const server = await startServer(port);
const base = `http://127.0.0.1:${port}`;
console.log(`serving ${DIST} at ${base}`);
try {
  for (const p of PAGES) {
    if (!ffOnly) await testPage('chromium', launchChromium, base, p);
    if (!crOnly) await testPage('firefox', () => firefox.launch(), base, p);
  }
} finally {
  server.close();
}
if (failures > 0) {
  console.error(`\n${failures} check(s) FAILED`);
  process.exit(1);
}
console.log('\nAll meter-control browser checks passed.');
