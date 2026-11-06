/**
 * Phone landscape layout: full-viewport canvas, floating move stick, punch buttons.
 * Run: node tests/landscape.mjs
 */
import puppeteer from 'puppeteer-core';

const URL = process.env.GAME_URL || 'http://127.0.0.1:8765/';
const CHROME = process.env.CHROME_PATH || '/usr/local/bin/google-chrome';
const fail = [];
const check = (cond, msg) => { if (!cond) fail.push(msg); };

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu']
});

async function openFight(page, width, height, mobile) {
  await page.setViewport({
    width: width,
    height: height,
    isMobile: !!mobile,
    hasTouch: !!mobile,
    deviceScaleFactor: 1
  });
  await page.goto(URL, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.__punch && window.__punch.game);
  await page.evaluate(async () => {
    const PZ = window.__punch;
    PZ.audio.setMuted(true);
    PZ.game.manual = true;
    PZ.onHotspot('p1');
    PZ.onHotspot('fight');
    let t = 0;
    while (!(PZ.game.state === 'fight' && PZ.game.freeze <= 0) && t < 10) {
      PZ.advance(0.2);
      t += 0.2;
    }
  });
  await new Promise((r) => setTimeout(r, 250));
}

const page = await browser.newPage();
const errors = [];
page.on('pageerror', (err) => errors.push(err.message));

await openFight(page, 844, 390, true);
const land = await page.evaluate(() => {
  const canvas = document.getElementById('game');
  const c = canvas.getBoundingClientRect();
  const zone = document.querySelector('.stick-zone[data-p="0"]').getBoundingClientRect();
  const buttons = [...document.querySelectorAll('#touch .side[data-p="0"] .punches button, #touch .side[data-p="0"] .defense button')]
    .map((b) => b.getBoundingClientRect())
    .filter((r) => r.width > 2 && r.height > 2);
  const overlap = buttons.some((r) => zone.right > r.left + 1 && zone.left < r.right - 1 && zone.bottom > r.top + 1 && zone.top < r.bottom - 1);
  const punch = document.querySelector('#touch .side[data-p="0"] .punches button');
  const style = getComputedStyle(punch);
  const css = [...document.styleSheets].flatMap((s) => {
    try { return [...s.cssRules].map((r) => r.cssText); } catch (err) { return []; }
  }).join('\n');
  return {
    cw: c.width, ch: c.height, cx: c.x, cy: c.y,
    vw: innerWidth, vh: innerHeight,
    bufW: canvas.width, bufH: canvas.height,
    dpad: getComputedStyle(document.querySelector('#touch .dpad')).display,
    zoneW: zone.width, zoneH: zone.height,
    overlap,
    punchCount: document.querySelectorAll('#touch .side[data-p="0"] .punches button').length,
    border: style.borderTopWidth,
    radius: style.borderRadius,
    safe: css.includes('safe-area-inset-left') && css.includes('safe-area-inset-top'),
    cls: document.body.className
  };
});
check(Math.abs(land.cw - land.vw) < 2 && Math.abs(land.ch - land.vh) < 2, 'landscape canvas fills the viewport, got ' + Math.round(land.cw) + 'x' + Math.round(land.ch));
check(land.cx < 2 && land.cy < 2, 'landscape canvas starts at the viewport origin');
check(land.bufW >= land.cw - 2 && land.bufH >= land.ch - 2, 'canvas buffer matches the on-screen size');
check(land.dpad === 'none', 'movement buttons are hidden in landscape, display ' + land.dpad);
check(land.zoneW > land.vw * 0.35 && land.zoneH > land.vh * 0.8, 'stick zone covers the open left side, ' + Math.round(land.zoneW) + 'x' + Math.round(land.zoneH));
check(!land.overlap, 'stick zone overlaps a punch or defense button');
check(land.punchCount === 7, 'punch buttons are still there, saw ' + land.punchCount);
check(parseFloat(land.border) >= 2, 'punch buttons keep their border');
check(land.safe, 'layout uses safe-area insets');
check(land.cls.includes('stick-live') && land.cls.includes('phone-landscape'), 'landscape fight enables the floating stick');

const moved = await page.evaluate(() => {
  const PZ = window.__punch;
  const zone = document.querySelector('.stick-zone[data-p="0"]');
  const r = zone.getBoundingClientRect();
  const x = r.left + Math.min(100, r.width * 0.3);
  const y = r.top + r.height * 0.55;
  const fire = (type, cx, cy) => {
    const target = type === 'pointerdown' ? zone : window;
    target.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, clientX: cx, clientY: cy,
      pointerId: 7, pointerType: 'touch', isPrimary: true
    }));
  };
  fire('pointerdown', x, y);
  fire('pointermove', x + 38, y);
  const vis = document.querySelector('.stick-vis[data-p="0"]');
  const base = vis.querySelector('.stick-base').getBoundingClientRect();
  const shown = vis.classList.contains('on') && base.width > 40;
  const atTouch = Math.abs((base.left + base.width / 2) - x) < 4 && Math.abs((base.top + base.height / 2) - y) < 4;
  const x0 = PZ.game.players[0].x;
  const snap = PZ.input.snapshot(0, PZ.game.mode);
  PZ.advance(0.35);
  const x1 = PZ.game.players[0].x;
  fire('pointerup', x + 38, y);
  const released = !PZ.input.stick[0].on;
  const jab = document.querySelector('#touch .side[data-p="0"] .punches button[data-act="jabR"]');
  jab.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 8, pointerType: 'touch', isPrimary: true }));
  const armed = !!PZ.input.touchHold[0].jabR;
  jab.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 8, pointerType: 'touch', isPrimary: true }));
  return { shown, atTouch, moved: x1 > x0 + 0.05, mx: snap.moveX, released, armed };
});
check(moved.shown && moved.atTouch, 'stick base appears at the touch point');
check(moved.moved && moved.mx > 0.5, 'dragging the stick moves the fighter, mx ' + moved.mx);
check(moved.released, 'releasing the stick clears movement');
check(moved.armed, 'punch buttons still register');

const keys = await page.evaluate(() => {
  const PZ = window.__punch;
  PZ.advance(0.6);
  const x0 = PZ.game.players[0].x;
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
  PZ.advance(0.25);
  window.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', bubbles: true }));
  const pad = {
    connected: true,
    mapping: 'standard',
    axes: [0, 1, 0, 0],
    buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }))
  };
  window.__fakeGamepads = [pad];
  const z0 = PZ.game.players[0].z;
  PZ.advance(0.25);
  window.__fakeGamepads = [];
  return { keyed: PZ.game.players[0].x < x0 - 0.05, stick: PZ.game.players[0].z > z0 + 0.04, x0: x0, x1: PZ.game.players[0].x };
});
check(keys.keyed, 'keyboard still moves the fighter in landscape, x ' + keys.x0 + ' -> ' + keys.x1);
check(keys.stick, 'gamepad stick still moves the fighter in landscape');

await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
await new Promise((r) => setTimeout(r, 250));
const portrait = await page.evaluate(() => {
  const c = document.getElementById('game').getBoundingClientRect();
  return {
    aspect: c.width / c.height,
    gate: getComputedStyle(document.getElementById('rotate-gate')).display,
    sticks: getComputedStyle(document.getElementById('sticks')).display,
    cls: document.body.className
  };
});
check(Math.abs(portrait.aspect - 480 / 800) < 0.02, 'portrait canvas keeps the 480/800 frame, aspect ' + portrait.aspect);
check(portrait.gate === 'flex', 'portrait still asks you to turn sideways');
check(portrait.sticks === 'none' && !portrait.cls.includes('phone-landscape'), 'portrait does not use the landscape stick');

const desk = await browser.newPage();
await openFight(desk, 1280, 900, false);
await desk.evaluate(() => { document.getElementById('toggle-touch').click(); });
await new Promise((r) => setTimeout(r, 200));
const desktop = await desk.evaluate(() => {
  const c = document.getElementById('game').getBoundingClientRect();
  return {
    aspect: c.width / c.height,
    dpad: getComputedStyle(document.querySelector('#touch .dpad')).display,
    sticks: getComputedStyle(document.getElementById('sticks')).display,
    cls: document.body.className,
    state: window.__punch.game.state
  };
});
check(Math.abs(desktop.aspect - 480 / 800) < 0.02, 'desktop canvas keeps its aspect, ' + desktop.aspect);
check(!desktop.cls.includes('phone-landscape'), 'desktop is not the phone landscape layout');
check(desktop.dpad === 'grid' && desktop.sticks === 'none', 'desktop touch keeps the button pad');
check(desktop.state === 'fight', 'desktop fight is still running, ' + desktop.state);

const twoPage = await browser.newPage();
await twoPage.setViewport({ width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
await twoPage.goto(URL, { waitUntil: 'networkidle0' });
await twoPage.waitForFunction(() => window.__punch && window.__punch.game);
await twoPage.evaluate(async () => {
  const PZ = window.__punch;
  PZ.audio.setMuted(true);
  PZ.game.manual = true;
  PZ.onHotspot('p2');
  PZ.game.select.p1 = 0;
  PZ.game.select.p2 = 1;
  PZ.game.select.ready = [true, true];
  PZ.game.select.launchAt = PZ.game.t;
  PZ.advance(0.3);
  let t = 0;
  while (!(PZ.game.state === 'fight' && PZ.game.freeze <= 0) && t < 10) {
    PZ.advance(0.2);
    t += 0.2;
  }
});
await twoPage.waitForFunction(() => document.body.classList.contains('mode-2') && document.body.classList.contains('stick-live'));
const two = await twoPage.evaluate(() => {
  const rect = (sel) => document.querySelector(sel).getBoundingClientRect();
  const z0 = rect('.stick-zone[data-p="0"]');
  const z1 = rect('.stick-zone[data-p="1"]');
  const buttons = [...document.querySelectorAll('#touch .punches button, #touch .defense button')]
    .map((b) => b.getBoundingClientRect())
    .filter((r) => r.width > 2);
  const hits = (zone) => buttons.some((r) => zone.right > r.left + 1 && zone.left < r.right - 1 && zone.bottom > r.top + 1 && zone.top < r.bottom - 1);
  return {
    mode: document.body.className,
    z0: Math.round(z0.width),
    z1: Math.round(z1.width),
    overlap: hits(z0) || hits(z1),
    separate: z0.right < z1.left
  };
});
check(two.mode.includes('mode-2') && two.mode.includes('stick-live'), '2P landscape shows both sticks (' + two.mode + ')');
check(two.z0 > 80 && two.z1 > 80, 'both players get a stick zone, ' + two.z0 + ' / ' + two.z1);
check(!two.overlap && two.separate, '2P stick zones overlap the buttons or each other');

if (errors.length) fail.push('page errors: ' + errors.join(' | '));
await browser.close();
if (fail.length) {
  console.error('FAILED\n' + fail.join('\n'));
  process.exit(1);
}
console.log('landscape ok');
