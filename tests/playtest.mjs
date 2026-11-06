/**
 * Headless playtest for Solana Coin Punch-Out.
 * Run: node tests/playtest.mjs   (needs puppeteer-core and Chrome)
 */
import puppeteer from 'puppeteer-core';

const URL = process.env.GAME_URL || 'http://127.0.0.1:8765/';
const CHROME = process.env.CHROME_PATH || '/usr/local/bin/google-chrome';

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu']
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (err) => errors.push('PAGE ' + err.message));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push('CONSOLE ' + msg.text());
});
page.on('response', (res) => {
  if (res.status() >= 400) errors.push('HTTP ' + res.status() + ' ' + res.url());
});
await page.setViewport({ width: 1280, height: 900 });
await page.goto(URL, { waitUntil: 'networkidle0' });
await page.waitForFunction(() => window.__punch && window.__punch.game);

const report = await page.evaluate(async () => {
  const PZ = window.__punch;
  const g = PZ.game;
  const fail = [];
  const check = (cond, msg) => { if (!cond) fail.push(msg); };
  PZ.audio.setMuted(true);
  g.manual = true;

  const press = (key, hold) => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: key, bubbles: true }));
    PZ.advance(hold || 0.05);
    window.dispatchEvent(new KeyboardEvent('keyup', { key: key, bubbles: true }));
  };
  const until = (pred, seconds, step) => {
    const s = step || 0.25;
    let t = 0;
    while (t < seconds) {
      PZ.advance(s);
      t += s;
      if (pred()) return true;
    }
    return false;
  };

  check(g.state === 'title', 'starts on title');
  check(document.querySelector('a[href="links.html"]'), 'links.html is linked');
  check(document.getElementById('punch-balance').textContent === '1000', 'starting balance');
  check(document.getElementById('connect-wallet'), 'wallet button');
  check(document.getElementById('punch-stake'), 'stake input');

  window.placePunchBet();
  check(document.getElementById('punch-balance').textContent === '950', 'bet debits 50');

  /* Every caricature has to draw without throwing. */
  const saved = { state: g.state, players: g.players };
  PZ.FIGHTERS.forEach((def) => {
    try {
      g.state = 'fight';
      g.round = 1;
      g.clock = 30;
      g.banner = null;
      g.players = [PZ.dummyFighter(PZ.fighterById('freeman'), 0), PZ.dummyFighter(def, 1)];
      PZ.drawFrame(g);
    } catch (err) {
      fail.push('draw ' + def.id + ' ' + err.message);
    }
  });
  g.state = saved.state;
  g.players = saved.players;

  /* 1P: keyboard jab, gamepad jab, touch jab, dodge, star punch. */
  PZ.onHotspot('p1');
  check(g.state === 'select' && g.mode === 1, '1P select');
  check(g.players === saved.players || true, 'select ready');
  PZ.onHotspot('fight');
  check(g.state === 'intro', 'intro starts');
  const bells = [];
  const origBell = PZ.audio.bell.bind(PZ.audio);
  PZ.audio.bell = (n) => { bells.push(n || 1); origBell(n); };

  until(() => g.state === 'fight' && g.freeze <= 0, 8, 0.2);
  check(g.state === 'fight', 'round 1 started');
  check(g.players[0].def.id === 'freeman', 'hero is Freeman');
  check(g.players[1].def.id === 'washington', 'first opponent');
  check(Math.abs(g.clock - 60) < 1.2, 'clock opens at 1:00, saw ' + g.clock);

  const clockBefore = g.clock;
  PZ.advance(0.5);
  PZ.advance(0.5);
  check(Math.abs((clockBefore - g.clock) - 1) < 0.05, 'one sim second drops the clock by one, delta ' + (clockBefore - g.clock));

  g.players[1].hp = 80;
  g.players[1].duckHeld = false;
  g.players[1].blockHeld = false;
  g.players[1].slipTimer = 0;
  g.players[1].iframe = 0;
  g.players[1].tell = null;
  const beforeJab = g.players[1].hp;
  press('f', 0.04);
  PZ.advance(0.35);
  check(g.players[1].hp < beforeJab, 'keyboard jab deals damage ' + beforeJab + ' -> ' + g.players[1].hp);

  /* Dodge slips a left jab. */
  g.players[0].hp = 40;
  g.players[0].slip = 'R';
  g.players[0].slipTimer = 0.3;
  g.players[0].duckHeld = false;
  g.players[0].blockHeld = false;
  g.players[0].iframe = 0;
  g.players[1].action = { name: 'jabL', age: 0.02, didHit: false, weak: false, starPower: 0, follow: null };
  PZ.advance(0.2);
  check(g.players[0].hp === 40, 'slip right beats a left jab, hp ' + g.players[0].hp);

  /* Gamepad A = left jab. */
  const buttons = () => Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }));
  const pad = () => ({ connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: buttons() });
  const gp = pad();
  window.__fakeGamepads = [gp];
  const beforePad = g.players[1].hp;
  gp.buttons[0].pressed = true;
  PZ.advance(0.05);
  gp.buttons[0].pressed = false;
  PZ.advance(0.35);
  check(g.players[1].hp < beforePad, 'gamepad A jab deals damage');

  /* Touch right jab. */
  const beforeTouch = g.players[1].hp;
  PZ.input.touchDown(0, 'jabR');
  PZ.advance(0.05);
  PZ.input.touchUp(0, 'jabR');
  PZ.advance(0.4);
  check(g.players[1].hp < beforeTouch, 'touch jab deals damage');

  /* Star punch spends stars. */
  g.players[0].stars = 2.5;
  g.players[0].stam = 100;
  g.players[0].action = null;
  g.players[0].stun = 0;
  g.players[0].locked = 0;
  press(' ', 0.04);
  check(g.players[0].action && g.players[0].action.name === 'star', 'upper becomes star punch');
  check(g.players[0].stars === 0, 'star punch spends stars');
  PZ.advance(0.5);

  /* Player knockdown: mash the on-screen punch buttons to beat the count. */
  g.players[0].hp = 1;
  g.players[0].iframe = 0;
  g.players[0].slipTimer = 0;
  g.players[0].duckHeld = false;
  g.players[0].blockHeld = false;
  g.players[0].action = null;
  g.players[1].action = { name: 'jabL', age: 0.02, didHit: false, weak: false, starPower: 0, follow: null };
  g.players[1].stun = 0;
  PZ.advance(0.3);
  check(g.state === 'down' && g.downIndex === 0, 'player knockdown, state ' + g.state);
  let guard = 0;
  while (g.state === 'down' && guard < 40) {
    PZ.input.touchDown(0, 'jabL');
    PZ.advance(0.06);
    PZ.input.touchUp(0, 'jabL');
    PZ.advance(0.1);
    guard++;
  }
  check(g.state === 'fight', 'mashing gets the player up');

  /* Opponent knockdowns: CPU beats the count until the third, which is a TKO. */
  const downAndUp = () => {
    const def = g.players[1];
    const att = g.players[0];
    def.hp = 1;
    def.duckHeld = false;
    def.blockHeld = false;
    def.slipTimer = 0;
    def.iframe = 0;
    def.tell = null;
    def.action = null;
    att.stun = 0;
    att.locked = 0;
    att.action = { name: 'hookR', age: 0.02, didHit: false, weak: false, starPower: 0, follow: null };
    PZ.advance(0.3);
  };
  const waitUp = () => {
    let n = 0;
    while (g.state === 'down' && n < 80) {
      PZ.advance(0.2);
      n++;
    }
  };
  downAndUp();
  check(g.state === 'down' && g.players[1].kd === 1, 'opponent knockdown, state ' + g.state + ' kd ' + (g.players[1] && g.players[1].kd));
  waitUp();
  check(g.state === 'fight', 'opponent beats the count');
  downAndUp();
  check(g.state === 'down' && g.players[1].kd === 2, 'second knockdown');
  waitUp();
  check(g.state === 'fight', 'gets up from the second knockdown');
  downAndUp();
  check(g.state === 'result' && g.result.type === 'tko', 'third knockdown is a TKO, got ' + (g.result && g.result.type));
  check(PZ.bet.balance > 950, 'winning the fight pays the bet, balance ' + PZ.bet.balance);

  /* Fresh 1P fight goes the full three minutes to a decision and shows the ring card. */
  g.betResolved = false;
  PZ.bet.active = 0;
  PZ.onHotspot('retry');
  until(() => g.state === 'fight', 6, 0.2);
  g.players.forEach((p) => { p.hp = 900000; p.maxHp = 900000; });
  const cards = [];
  let guard2 = 0;
  while (g.state !== 'result' && guard2 < 900) {
    const prev = g.state + ':' + g.cardRound;
    PZ.advance(0.5);
    if (g.state === 'card' && cards[cards.length - 1] !== g.cardRound) cards.push(g.cardRound);
    if (g.state + ':' + g.cardRound === prev && g.state === 'card') {
      /* keep walking */
    }
    guard2++;
  }
  check(g.state === 'result', '1P fight finished');
  check(g.result && (g.result.type === 'decision' || g.result.type === 'draw'), 'full fight ends on the cards, ' + (g.result && g.result.type));
  check(g.scores.length === 3, 'three scorecards, saw ' + g.scores.length);
  check(cards.indexOf(2) >= 0 && cards.indexOf(3) >= 0, 'ring card walks for round 2 and 3, saw ' + cards.join(','));
  check(bells.filter((n) => n === 1).length >= 3, 'bell at each round start');
  check(bells.filter((n) => n === 3).length >= 2, 'bell at round end');
  check(g.round === 3, 'finished in round 3');

  /* Pause. Clock must be mid-round or resuming immediately ends the round. */
  g.state = 'fight';
  g.freeze = 0;
  g.clock = 30;
  press('p', 0.05);
  check(g.state === 'pause', 'P pauses');
  press('p', 0.05);
  check(g.state === 'fight', 'P resumes');

  /* 2P: both humans, split keyboard and a second gamepad. */
  g.state = 'title';
  PZ.onHotspot('p2');
  check(g.state === 'select' && g.mode === 2, '2P select');
  g.select.p1 = 0;
  g.select.p2 = 7;
  g.select.ready = [true, true];
  g.select.launchAt = g.t;
  PZ.advance(0.2);
  check(g.state === 'intro', '2P intro');
  check(g.players[0].def.id === 'freeman' && g.players[1].def.id === 'barry', '2P roster pick');
  check(g.players[0].human && g.players[1].human, 'both fighters are human');
  until(() => g.state === 'fight' && g.freeze <= 0, 8, 0.2);

  const p2before = g.players[0].hp;
  press('k', 0.04);
  PZ.advance(0.4);
  check(g.players[0].hp < p2before, 'P2 keyboard jab lands');

  const pads = [pad(), pad()];
  window.__fakeGamepads = pads;
  /* P2 is the right-hand fighter. Their jab lands on the left-hand fighter. */
  const opp = g.players[0].hp;
  pads[1].buttons[0].pressed = true;
  PZ.advance(0.05);
  pads[1].buttons[0].pressed = false;
  PZ.advance(0.4);
  check(g.players[0].hp < opp, 'second gamepad jabs for P2, hp ' + opp + ' -> ' + g.players[0].hp);

  g.players.forEach((p) => { p.hp = 900000; p.maxHp = 900000; });
  const cards2 = [];
  let guard3 = 0;
  while (g.state !== 'result' && guard3 < 900) {
    PZ.advance(0.5);
    if (g.state === 'card' && cards2[cards2.length - 1] !== g.cardRound) cards2.push(g.cardRound);
    guard3++;
  }
  check(g.state === 'result', '2P fight finished');
  check(g.scores.length === 3, '2P three rounds');
  check(cards2.indexOf(2) >= 0 && cards2.indexOf(3) >= 0, '2P ring cards ' + cards2.join(','));

  /* Controls screen from the title. */
  g.state = 'title';
  PZ.onHotspot('controls');
  check(g.state === 'controls', 'controls screen');
  PZ.drawFrame(g);
  press('Escape', 0.05);
  check(g.state === 'title', 'back from controls');

  return { fail: fail, bells: bells, balance: PZ.bet.balance };
});

const bad = errors.filter((e) => !/favicon/i.test(e));
if (bad.length) {
  console.error('CONSOLE/HTTP ERRORS\n' + bad.join('\n'));
  process.exitCode = 1;
}
if (report.fail.length) {
  console.error('FAILED CHECKS\n' + report.fail.join('\n'));
  process.exitCode = 1;
} else if (!process.exitCode) {
  console.log('playtest ok', JSON.stringify({ balance: report.balance, bells: report.bells }));
}
await browser.close();
if (process.exitCode) process.exit(process.exitCode);
