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
    return {
      x: (e.clientX - r.left) * (canvas.width / r.width),
      y: (e.clientY - r.top) * (canvas.height / r.height)
    };
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

  function applyChrome() {
    const g = PZ.game;
    document.body.classList.toggle('mode-2', g.mode === 2 && (g.state === 'fight' || g.state === 'down' || g.state === 'pause' || g.state === 'select'));
    document.body.classList.toggle('mode-1', !document.body.classList.contains('mode-2'));
    const play = g.state === 'fight' || g.state === 'down' || g.state === 'pause';
    document.body.classList.toggle('touch-on', !!(touchWant.on && play));
    if (window.innerWidth < 980) betPanel.classList.add('collapsed');
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

  let last = performance.now();
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;
    if (dt < 0) dt = 0;
    if (!PZ.game.manual) PZ.tick(dt);
    PZ.drawFrame(PZ.game);
    applyChrome();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.__punch = PZ;
  PZ.log('Solana Coin Punch-Out ready. 1P circuit or 2P.');
})();
