/* Boot, $PUNCH betting, wallet, and the animation loop. */
(function () {
  'use strict';
  const PZ = (window.PZ = window.PZ || {});

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  PZ.ctx = ctx;

  const balanceEl = document.getElementById('punch-balance');
  const logEl = document.getElementById('log');
  const walletStatus = document.getElementById('wallet-status');
  let wallet = null;

  const bet = {
    balance: 1000,
    active: 0,
    render: function () {
      if (balanceEl) balanceEl.textContent = String(this.balance);
    },
    place: function () {
      const input = document.getElementById('punch-stake');
      const stake = parseInt(input && input.value, 10) || 50;
      if (stake < 10) { PZ.log('Minimum bet is 10 PUNCH.'); return; }
      if (stake > this.balance) { alert('Not enough PUNCH!'); return; }
      this.balance -= stake;
      this.active += stake;
      this.render();
      PZ.log('Bet ' + stake + ' PUNCH on the left corner (P1).');
    },
    resolve: function (winner, type) {
      if (!this.active) return;
      const stake = this.active;
      this.active = 0;
      if (type === 'draw' || winner < 0) {
        this.balance += stake;
        PZ.log('Draw. Stake of ' + stake + ' PUNCH returned.');
      } else if (winner === 0) {
        this.balance += stake * 2;
        PZ.log('You win ' + (stake * 2) + ' PUNCH!');
      } else {
        PZ.log('Bet lost: ' + stake + ' PUNCH.');
      }
      this.render();
    },
    forfeit: function () {
      if (!this.active) return;
      PZ.log('Bet forfeited: ' + this.active + ' PUNCH.');
      this.active = 0;
      this.render();
    }
  };
  PZ.bet = bet;
  bet.render();

  PZ.log = function (msg) {
    if (!logEl) return;
    const line = document.createElement('div');
    line.textContent = msg;
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
  };

  window.placePunchBet = function () { bet.place(); };
  window.swapPunch = function () {
    if (!wallet) { alert('Connect wallet first'); return; }
    window.open('https://jup.ag/swap/SOL-BdVA3nqz5mgZrhnxffe8ubkEvy4LcdNr4cNRMYDLpump', '_blank', 'noopener');
  };
  window.connectWallet = async function () {
    const sol = window.solana;
    if (sol && sol.isPhantom) {
      try {
        const resp = await sol.connect();
        wallet = resp.publicKey.toString();
        walletStatus.textContent = 'Connected: ' + wallet.slice(0, 4) + '...' + wallet.slice(-4);
        PZ.log('Wallet connected');
      } catch (err) {
        PZ.log('Wallet connect cancelled');
      }
    } else {
      alert('Install Phantom');
    }
  };

  const connectBtn = document.getElementById('connect-wallet');
  if (connectBtn) connectBtn.addEventListener('click', window.connectWallet);

  function canvasPoint(e) {
    const r = canvas.getBoundingClientRect();
    let x = (e.clientX - r.left) * (canvas.width / Math.max(1, r.width));
    let y = (e.clientY - r.top) * (canvas.height / Math.max(1, r.height));
    if (PZ.screenToGame) {
      const p = PZ.screenToGame(x, y);
      x = p.x;
      y = p.y;
    }
    return { x: x, y: y };
  }

  canvas.addEventListener('pointerdown', function (e) {
    PZ.audio.unlock();
    const p = canvasPoint(e);
    if (PZ.canvasAction(p.x, p.y)) e.preventDefault();
  });

  function unlock() { PZ.audio.unlock(); }
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);

  const params = new URLSearchParams(location.search);
  if (params.get('turbo')) PZ.game.turbo = Number(params.get('turbo')) || 1;

  PZ.input.bind();

  const betPanel = document.getElementById('bet-panel');
  const touchWant = { on: false };

  function coarsePointer() {
    return window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  }

  function phoneLandscape() {
    const landscape = window.innerWidth > window.innerHeight + 30;
    const phone = coarsePointer() || window.innerWidth < 980;
    return landscape && phone && window.innerHeight <= 560;
  }

  function syncCanvas() {
    const on = document.body.classList.contains('phone-landscape');
    if (!on) {
      if (canvas.width !== 480 || canvas.height !== 800) {
        canvas.width = 480;
        canvas.height = 800;
      }
      return;
    }
    const r = canvas.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = Math.max(2, Math.round(r.width * dpr));
    let h = Math.max(2, Math.round(r.height * dpr));
    const maxW = 1600;
    if (w > maxW) {
      h = Math.max(2, Math.round(h * maxW / w));
      w = maxW;
    }
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  /* Keep the stick's hit area on the open side of the punch and defense buttons. */
  function layoutStickZones() {
    const fit = document.querySelector('.stick-fit');
    const zone0 = document.querySelector('.stick-zone[data-p="0"]');
    const zone1 = document.querySelector('.stick-zone[data-p="1"]');
    if (!fit || !zone0 || !zone1) return;
    const live = document.body.classList.contains('stick-live');
    if (!live) return;
    const root = fit.getBoundingClientRect();
    const gap = 8;
    const buttonsFor = function (player) {
      return document.querySelectorAll('#touch .side[data-p="' + player + '"] .punches button, #touch .side[data-p="' + player + '"] .defense button');
    };
    const visible = function (btn) {
      const r = btn.getBoundingClientRect();
      return r.width > 2 && r.height > 2 && getComputedStyle(btn).display !== 'none';
    };
    let limit = root.right;
    buttonsFor(0).forEach(function (btn) {
      if (!visible(btn)) return;
      limit = Math.min(limit, btn.getBoundingClientRect().left);
    });
    const width = Math.max(0, limit - root.left - gap);
    zone0.style.display = 'block';
    zone0.style.left = '0px';
    zone0.style.right = 'auto';
    zone0.style.top = '0px';
    zone0.style.bottom = '0px';
    zone0.style.width = width + 'px';
    if (!document.body.classList.contains('mode-2')) {
      zone1.style.display = 'none';
      return;
    }
    let start = root.left;
    buttonsFor(1).forEach(function (btn) {
      if (!visible(btn)) return;
      start = Math.max(start, btn.getBoundingClientRect().right);
    });
    zone1.style.display = 'block';
    zone1.style.left = (start - root.left + gap) + 'px';
    zone1.style.right = '0px';
    zone1.style.top = '0px';
    zone1.style.bottom = '0px';
    zone1.style.width = 'auto';
  }

  function applyChrome() {
    const g = PZ.game;
    document.body.classList.toggle('mode-2', g.mode === 2 && (g.state === 'fight' || g.state === 'down' || g.state === 'pause' || g.state === 'select'));
    document.body.classList.toggle('mode-1', !document.body.classList.contains('mode-2'));
    const play = g.state === 'fight' || g.state === 'down' || g.state === 'pause';
    const phonePlay = play || g.state === 'intro' || g.state === 'card';
    const portrait = window.innerHeight > window.innerWidth + 30;
    const phone = coarsePointer() || window.innerWidth < 980;
    const land = phoneLandscape();
    document.body.classList.toggle('touch-on', !!(touchWant.on && play));
    document.body.classList.toggle('need-rotate', !!(phonePlay && portrait && phone));
    document.body.classList.toggle('float-controls', !!(touchWant.on && play && !portrait));
    document.body.classList.toggle('phone-landscape', land);
    const stickLive = !!(touchWant.on && land && (g.state === 'fight' || g.state === 'down'));
    document.body.classList.toggle('stick-live', stickLive);
    if (!stickLive && PZ.input && PZ.input.clearSticks) PZ.input.clearSticks();
    document.body.classList.toggle('title-screen', g.state === 'title');
    syncCanvas();
    layoutStickZones();
    if (window.innerWidth < 980) betPanel.classList.add('collapsed');
  }

  function placeTipLink() {
    const link = document.getElementById('tip-jar-link');
    const canvasEl = document.getElementById('game');
    const stage = document.getElementById('stage');
    if (!link || !canvasEl || !stage || PZ.game.state !== 'title') return;
    const cr = canvasEl.getBoundingClientRect();
    const sr = stage.getBoundingClientRect();
    const pr = PZ.presentRect;
    let left = cr.left;
    let top = cr.top;
    let width = cr.width;
    let height = cr.height;
    if (pr && canvasEl.width) {
      const sx = cr.width / canvasEl.width;
      const sy = cr.height / canvasEl.height;
      left = cr.left + pr.ox * sx;
      top = cr.top + pr.oy * sy;
      width = pr.bw * sx;
      height = pr.bh * sy;
    }
    const band = height * (64 / 800);
    link.style.left = (left - sr.left + width / 2) + 'px';
    link.style.top = (top - sr.top + height - band) + 'px';
    link.style.width = Math.round(Math.min(width * 0.7, 300)) + 'px';
  }

  /* Phones start with the on-screen pad available. */
  touchWant.on = coarsePointer() || window.innerWidth < 900;
  const touchToggle = document.getElementById('toggle-touch');
  if (touchToggle) {
    touchToggle.addEventListener('click', function () {
      touchWant.on = !touchWant.on;
      applyChrome();
    });
  }
  const betToggle = document.getElementById('toggle-bets');
  if (betToggle) {
    betToggle.addEventListener('click', function () {
      betPanel.classList.toggle('collapsed');
    });
  }
  if (window.innerWidth < 980) betPanel.classList.add('collapsed');
  window.addEventListener('resize', function () {
    if (coarsePointer() || window.innerWidth < 900) touchWant.on = true;
    applyChrome();
  });

  let last = performance.now();
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;
    if (dt < 0) dt = 0;
    if (!PZ.game.manual) PZ.tick(dt);
    applyChrome();
    PZ.drawFrame(PZ.game);
    placeTipLink();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.__punch = PZ;
  PZ.log('Solana Coin Punch-Out ready. 1P circuit or 2P.');
})();
