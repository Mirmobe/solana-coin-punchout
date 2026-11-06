/* Real-time 3-round boxing. 1P circuit vs AI, or 2P on one device. */
(function () {
  'use strict';
  const PZ = (window.PZ = window.PZ || {});

  const EDGE_KEYS = [
    'dodgeL', 'dodgeR', 'jabL', 'jabR', 'bodyL', 'bodyR', 'hookL', 'hookR',
    'upper', 'pause', 'confirm', 'back', 'mash', 'up', 'down', 'left', 'right'
  ];

  function timings(f, move) {
    const speed = Math.max(0.72, 1.14 - (f.def.speed || 5) * 0.035);
    return {
      startup: move.startup * speed,
      active: move.active,
      recovery: move.recovery * (0.9 + speed * 0.1)
    };
  }

  PZ.punchExt = function (f) {
    if (!f.action) return 0;
    const move = PZ.MOVES[f.action.name];
    if (!move) return 0;
    const tm = timings(f, move);
    const age = f.action.age;
    const start = tm.startup;
    const end = start + tm.active;
    const total = end + tm.recovery;
    if (age <= 0) return 0;
    if (age < start) return (age / start) * 0.2;
    if (age < end) return 0.2 + 0.8 * ((age - start) / Math.max(0.01, tm.active));
    return Math.max(0, 1 - (age - end) / Math.max(0.01, tm.recovery));
  };

  function makeFighter(def, side, human) {
    return {
      def: def,
      side: side,
      facing: side === 0 ? 1 : -1,
      human: !!human,
      hp: def.hp,
      maxHp: def.hp,
      stam: def.stam,
      maxStam: def.stam,
      stars: human ? 0 : 0,
      kd: 0,
      roundDmg: 0,
      points: 0,
      action: null,
      dodge: null,
      duckHeld: false,
      blockHeld: false,
      duckAge: 0,
      slip: null,
      slipTimer: 0,
      stun: 0,
      locked: 0,
      flash: 0,
      iframe: 0,
      down: false,
      getUp: 0,
      tell: null,
      aiWait: 0.8,
      duckTimer: 0,
      blockTimer: 0,
      x: side === 0 ? -0.22 : 0.22,
      z: side === 0 ? 0.1 : -0.08
    };
  }

  function homeSpot(f) {
    f.x = f.side === 0 ? -0.22 : 0.22;
    f.z = f.side === 0 ? 0.1 : -0.08;
    f.facing = f.side === 0 ? 1 : -1;
  }

  function canMove(f) {
    return !f.down && !f.action && !(f.dodge && f.dodge.age < f.dodge.dur) && f.stun <= 0.05;
  }

  function moveFighter(f, dt, mx, mz, speedMul) {
    if (!canMove(f)) return;
    const mag = Math.hypot(mx, mz);
    if (mag < 0.08) return;
    const speed = 1.2 * (speedMul || 1) * (0.78 + (f.def.speed || 5) * 0.04);
    f.x += (mx / mag) * speed * dt;
    f.z += (mz / mag) * speed * dt;
    const r = Math.hypot(f.x, f.z);
    const maxR = 0.86;
    if (r > maxR) {
      f.x *= maxR / r;
      f.z *= maxR / r;
    }
  }

  function faceFoe(f) {
    const foe = foeOf(f);
    if (!foe) return;
    f.facing = foe.x >= f.x ? 1 : -1;
  }

  function reachOf(move) {
    if (move.kind === 'hook') return 0.9;
    if (move.kind === 'upper' || move.kind === 'star') return 0.94;
    if (move.kind === 'body') return 1.02;
    return 1.14;
  }

  function strikePoint(f) {
    if (PZ.project) {
      const p = PZ.project(f.x || 0, f.z || 0);
      return { x: p.x, y: p.y - 70 };
    }
    return { x: f.side === 0 ? 160 : 320, y: 460 };
  }

  PZ.dummyFighter = function (def, side) {
    return makeFighter(def, side, false);
  };

  const game = {
    state: 'title',
    mode: 1,
    menuIndex: 0,
    circuit: 0,
    cleared: false,
    players: [null, null],
    round: 1,
    clock: 60,
    freeze: 0,
    t: 0,
    shake: 0,
    count: 0,
    countAcc: 0,
    downIndex: 0,
    cardT: 0,
    cardRound: 2,
    introT: 0,
    banner: null,
    flashBanner: null,
    scores: [],
    result: null,
    resultMenu: [],
    select: { p1: 0, p2: 1, ready: [false, false] },
    pausedFrom: 'fight',
    controlsReturn: 'title',
    turbo: 1,
    effects: [],
    floaters: [],
    betResolved: false,
    manual: false
  };
  PZ.game = game;

  function loadCircuit() {
    try {
      const n = Number(localStorage.getItem('scp-circuit')) || 0;
      game.cleared = n >= 7;
      game.circuit = Math.max(0, Math.min(6, n));
    } catch (err) {
      game.circuit = 0;
    }
  }

  function saveCircuit(n) {
    try { localStorage.setItem('scp-circuit', String(n)); } catch (err) { /* private mode */ }
  }

  function log(msg) {
    if (PZ.log) PZ.log(msg);
  }

  function spawnFloater(x, y, text, color) {
    game.floaters.push({ x: x, y: y, text: text, life: 0.8, max: 0.8, color: color || '#fff', scale: 2 });
  }

  function spawnSparks(x, y, color) {
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 80;
      game.effects.push({
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20,
        life: 0.35, max: 0.35, color: color, s: 3
      });
    }
  }

  function foeOf(f) {
    return game.players[1 - f.side];
  }

  function clearActionEdges(inputs) {
    inputs.forEach(function (inp) {
      EDGE_KEYS.forEach(function (k) { inp[k] = false; });
    });
  }

  function stepCommon(f, dt) {
    if (f.flash > 0) f.flash -= dt;
    if (f.stun > 0) f.stun = Math.max(0, f.stun - dt);
    if (f.locked > 0) f.locked = Math.max(0, f.locked - dt);
    if (f.iframe > 0) f.iframe = Math.max(0, f.iframe - dt);
    if (f.slipTimer > 0) f.slipTimer = Math.max(0, f.slipTimer - dt);
    if (f.duckHeld) f.duckAge += dt;
    else f.duckAge = Math.max(0, f.duckAge - dt * 3);

    let regen = 15 * (f.def.regen || 1);
    if (f.blockHeld) regen = 4;
    if (f.action) regen = 2;
    if (!f.down) f.stam = Math.min(f.maxStam, f.stam + regen * dt);

    if (f.dodge) {
      f.dodge.age += dt;
      if (f.dodge.age >= f.dodge.dur) f.dodge = null;
    }

    }

  /* Advance timers. Hit detection is deferred so both fighters can trade. */
  function advanceFighter(f, dt) {
    if (f.flash > 0) f.flash -= dt;
    if (f.stun > 0) f.stun = Math.max(0, f.stun - dt);
    if (f.locked > 0) f.locked = Math.max(0, f.locked - dt);
    if (f.iframe > 0) f.iframe = Math.max(0, f.iframe - dt);
    if (f.slipTimer > 0) f.slipTimer = Math.max(0, f.slipTimer - dt);
    if (f.duckHeld) f.duckAge += dt;
    else f.duckAge = Math.max(0, f.duckAge - dt * 3);

    let regen = 15 * (f.def.regen || 1);
    if (f.blockHeld) regen = 4;
    if (f.action) regen = 2;
    if (!f.down) f.stam = Math.min(f.maxStam, f.stam + regen * dt);

    if (f.dodge) {
      f.dodge.age += dt;
      if (f.dodge.age >= f.dodge.dur) f.dodge = null;
    }

    if (!f.action) return false;
    const prev = f.action.age;
    f.action.age += dt;
    const move = PZ.MOVES[f.action.name];
    const tm = timings(f, move);
    const activeEnd = tm.startup + tm.active;
    return !f.action.didHit && prev < activeEnd && f.action.age >= tm.startup;
  }

  function finishAction(f) {
    if (!f.action) return;
    const move = PZ.MOVES[f.action.name];
    const tm = timings(f, move);
    const end = tm.startup + tm.active + tm.recovery;
    if (f.action.age < end) return;
    const follow = f.action.follow;
    f.action = null;
    if (follow && !f.human && PZ.MOVES[follow]) {
      const mv = PZ.MOVES[follow];
      f.tell = {
        move: follow, age: 0, dur: 0.3, hand: mv.hand, high: mv.high,
        avoid: mv.avoid, feint: false, follow: null
      };
    } else if (!f.human) {
      const gap = f.def.gap || [0.45, 0.8];
      f.aiWait = gap[0] + Math.random() * (gap[1] - gap[0]);
    }
  }

  function tryDodge(f, dir) {
    if (f.down || f.stun > 0.05 || f.locked > 0) return;
    if (f.action) return;
    if (f.dodge && f.dodge.age < f.dodge.dur * 0.65) return;
    f.dodge = { dir: dir, age: 0, dur: 0.36 };
    f.slip = dir;
    f.slipTimer = 0.26;
    f.duckHeld = false;
    PZ.audio.dodge();
  }

  function tryPunch(f, name) {
    if (f.down || f.stun > 0.05 || f.locked > 0) return;
    if (f.action) return;
    if (f.dodge && f.dodge.age < f.dodge.dur * 0.7) return;
    let moveName = name;
    let starPower = 0;
    if (moveName === 'upper' && f.stars >= 1) {
      moveName = 'star';
      starPower = f.stars;
      f.stars = 0;
    }
    if (moveName === 'star' && starPower <= 0 && f.human) {
      moveName = 'upper';
    }
    const move = PZ.MOVES[moveName];
    if (!move) return;
    let weak = false;
    if (f.stam < move.stam) {
      if (f.stam < move.stam * 0.35) {
        PZ.audio.tired();
        f.locked = 0.18;
        f.stam = 0;
        spawnFloater(f.side === 0 ? 140 : 340, 430, 'TIRED', '#9bd');
        return;
      }
      weak = true;
    }
    f.stam = Math.max(0, f.stam - (weak ? move.stam * 0.55 : move.stam));
    f.action = {
      name: moveName,
      age: 0,
      didHit: false,
      weak: weak,
      starPower: starPower,
      follow: null
    };
    f.tell = null;
    PZ.audio.swing(move.kind);
  }

  function resolveStrike(att, def) {
    if (!att.action || !def || def.down) return;
    const move = PZ.MOVES[att.action.name];
    if (!move) return;
    if (def.iframe > 0) {
      PZ.audio.whiff();
      return;
    }
    const dist = Math.hypot((att.x || 0) - (def.x || 0), (att.z || 0) - (def.z || 0));
    if (dist > reachOf(move)) {
      PZ.audio.whiff();
      return;
    }

    const slipping = def.slipTimer > 0 && (move.avoid === 'any' || move.avoid === def.slip);
    const ducking = def.duckHeld && def.duckAge > 0.045 && move.high && move.kind !== 'upper' && move.kind !== 'star';
    if (slipping || ducking) {
      PZ.audio.whiff();
      def.stars = Math.min(3, def.stars + 0.5);
      att.stun = Math.max(att.stun, 0.32);
      const slipAt = strikePoint(def);
      spawnFloater(slipAt.x, slipAt.y, slipping ? 'SLIP' : 'DUCK', '#14F195');
      spawnSparks(slipAt.x, slipAt.y + 40, '#14F195');
      return;
    }

    const blocking = def.blockHeld && def.stam > 3 && !move.unblockable && !def.action;
    if (blocking) {
      const chip = Math.max(1, Math.round(move.dmg * (att.def.power / 8) * 0.2));
      def.hp = Math.max(0, def.hp - chip);
      def.stam = Math.max(0, def.stam - 9);
      def.flash = 0.08;
      PZ.audio.block();
      const blockAt = strikePoint(def);
      spawnFloater(blockAt.x, blockAt.y, 'BLOCK', '#9bd');
      return;
    }

    let dmg = move.dmg * (att.def.power / 8);
    if (att.action.weak) dmg *= 0.45;
    if (move.kind === 'star') dmg = (18 + 8 * Math.max(1, att.action.starPower || 1)) * (att.def.power / 8);
    let counter = false;
    if (def.tell) {
      counter = true;
      def.tell = null;
      dmg *= 1.5;
      att.stars = Math.min(3, att.stars + 0.55);
    } else if (move.kind !== 'star') {
      att.stars = Math.min(3, att.stars + (move.kind === 'jab' ? 0.28 : 0.36));
    }
    dmg = Math.max(1, Math.round(dmg));
    def.hp = Math.max(0, def.hp - dmg);
    def.flash = move.kind === 'star' ? 0.22 : 0.12;
    def.stun = Math.max(def.stun, move.kind === 'star' ? 0.5 : move.kind === 'jab' ? 0.1 : 0.16);
    if (def.action) {
      const tm = timings(def, PZ.MOVES[def.action.name]);
      if (def.action.age < tm.startup) def.action = null;
    }
    att.roundDmg += dmg;
    att.points += move.kind === 'star' ? 3 : 2;
    game.shake = Math.max(game.shake, move.kind === 'star' ? 0.28 : 0.1);
    PZ.audio.hit(move.kind);
    const fx = strikePoint(def);
    spawnSparks(fx.x, fx.y + 30, move.kind === 'star' ? '#ffd24a' : '#fff');
    spawnFloater(fx.x, fx.y, (counter ? 'COUNTER ' : '') + dmg, move.kind === 'star' ? '#ffd24a' : '#fff');
    if (move.kind === 'star') {
      game.flashBanner = { text: 'STAR PUNCH!', age: 0, dur: 0.7 };
    }
  }

  function handleHuman(f, inp, dt) {
    f.duckHeld = !!inp.duck;
    f.blockHeld = !!inp.block && !inp.duck;
    if (f.down) return;
    moveFighter(f, dt, inp.moveX || 0, inp.moveY || 0, 1);
    faceFoe(f);
    if (inp.dodgeL) tryDodge(f, 'L');
    else if (inp.dodgeR) tryDodge(f, 'R');
    else if (inp.jabL) tryPunch(f, 'jabL');
    else if (inp.jabR) tryPunch(f, 'jabR');
    else if (inp.hookL) tryPunch(f, 'hookL');
    else if (inp.hookR) tryPunch(f, 'hookR');
    else if (inp.bodyL) tryPunch(f, 'bodyL');
    else if (inp.bodyR) tryPunch(f, 'bodyR');
    else if (inp.upper) tryPunch(f, 'upper');
  }

  function pickAttack(def) {
    const list = def.attacks || [{ move: 'jabL', tell: 0.5, w: 1 }];
    let total = 0;
    list.forEach(function (a) { total += a.w; });
    let r = Math.random() * total;
    for (let i = 0; i < list.length; i++) {
      r -= list[i].w;
      if (r <= 0) return list[i];
    }
    return list[0];
  }

  function handleAI(f, dt) {
    if (f.duckTimer > 0) {
      f.duckTimer -= dt;
      f.duckHeld = f.duckTimer > 0;
    } else f.duckHeld = false;
    if (f.blockTimer > 0) {
      f.blockTimer -= dt;
      f.blockHeld = f.blockTimer > 0;
    } else f.blockHeld = false;

    const quarry = foeOf(f);
    if (quarry && !f.tell && !f.down) {
      const dx = quarry.x - f.x;
      const dz = quarry.z - f.z;
      const dist = Math.hypot(dx, dz) || 0.001;
      if (dist > 0.58) moveFighter(f, dt, dx, dz, 1);
      else moveFighter(f, dt, -dz, dx, 0.42);
      faceFoe(f);
    }

    if (f.down || f.stun > 0.05 || f.locked > 0) return;
    if (f.action) return;
    if (f.dodge && f.dodge.age < f.dodge.dur) return;

    const player = foeOf(f);
    if (f.tell) {
      /* Player is hitting us out of the tell in resolveStrike. */
      f.tell.age += dt;
      if (f.tell.age >= f.tell.dur) {
        const tell = f.tell;
        f.tell = null;
        if (tell.feint) {
          f.aiWait = 0.1 + Math.random() * 0.12;
          return;
        }
        const move = PZ.MOVES[tell.move];
        if (f.stam < 8) { f.aiWait = 0.4; return; }
        f.stam = Math.max(0, f.stam - move.stam * 0.55);
        f.action = {
          name: tell.move, age: 0, didHit: false, weak: false,
          starPower: tell.move === 'star' ? 2 : 0, follow: tell.follow
        };
        PZ.audio.swing(move.kind);
      }
      return;
    }

    if (player && player.action && !player.action.didHit) {
      const mv = PZ.MOVES[player.action.name];
      const tm = timings(player, mv);
      if (player.action.age < tm.startup * 0.85 && Math.random() < (f.def.react || 0) * dt * 12) {
        if (mv.high && mv.kind !== 'upper' && mv.kind !== 'star' && Math.random() < 0.45) {
          f.duckHeld = true;
          f.duckTimer = 0.32;
          f.duckAge = 0.08;
        } else if (!mv.unblockable && Math.random() < 0.5) {
          f.blockHeld = true;
          f.blockTimer = 0.34;
        } else {
          tryDodge(f, mv.avoid === 'L' ? 'L' : 'R');
        }
        return;
      }
    }

    f.aiWait -= dt;
    if (f.aiWait > 0) return;
    const spec = pickAttack(f.def);
    const mv = PZ.MOVES[spec.move];
    const feint = !!(spec.feint && Math.random() < (f.def.feintChance || 0));
    f.tell = {
      move: spec.move,
      age: 0,
      dur: spec.tell,
      hand: mv.hand,
      high: mv.high,
      avoid: mv.avoid,
      feint: feint,
      follow: spec.follow || null
    };
  }

  function startKnockdown(pi) {
    const f = game.players[pi];
    f.kd += 1;
    f.hp = 0;
    f.down = true;
    f.action = null;
    f.tell = null;
    f.getUp = 0;
    f.dodge = null;
    game.players[1 - pi].roundDmg += 5;
    if (f.kd >= 3) {
      endFight({ type: 'tko', winner: 1 - pi });
      return;
    }
    game.state = 'down';
    game.downIndex = pi;
    game.count = 0;
    game.countAcc = 0;
    PZ.audio.kd();
    log('Knockdown ' + f.kd + ' on ' + f.def.name);
  }

  function getUp(f) {
    f.down = false;
    const back = f.kd === 1 ? 0.36 : 0.24;
    f.hp = Math.max(8, Math.round(f.maxHp * back));
    f.stun = 0.35;
    f.iframe = 0.7;
    f.stam = Math.max(f.stam, f.maxStam * 0.4);
    f.action = null;
    game.state = 'fight';
    PZ.audio.getup();
    log(f.def.name + ' beats the count');
  }

  function scoreRound() {
    const a = game.players[0];
    const b = game.players[1];
    let as = 10 - a.kd;
    let bs = 10 - b.kd;
    if (Math.abs(as - bs) < 0.5) {
      if (a.roundDmg > b.roundDmg + 1) bs -= 1;
      else if (b.roundDmg > a.roundDmg + 1) as -= 1;
    }
    return { a: Math.max(6, as), b: Math.max(6, bs) };
  }

  function endRound() {
    game.clock = 0;
    PZ.audio.bell(3);
    const card = scoreRound();
    game.scores.push(card);
    log('Round ' + game.round + ' card ' + card.a + '-' + card.b);
    if (game.round >= 3) {
      decide();
      return;
    }
    game.players.forEach(function (f) {
      if (!f) return;
      f.hp = Math.min(f.maxHp, f.hp + Math.round(f.maxHp * 0.08));
      f.stam = Math.min(f.maxStam, f.stam + f.maxStam * 0.35);
      f.action = null;
      f.tell = null;
      f.dodge = null;
      f.duckHeld = false;
      f.blockHeld = false;
    });
    game.state = 'card';
    game.cardT = 0;
    game.cardRound = game.round + 1;
  }

  function decide() {
    let at = 0, bt = 0, aw = 0, bw = 0;
    game.scores.forEach(function (s) {
      at += s.a;
      bt += s.b;
      if (s.a > s.b) aw++;
      else if (s.b > s.a) bw++;
    });
    let winner = -1;
    if (aw > bw) winner = 0;
    else if (bw > aw) winner = 1;
    else if (at > bt) winner = 0;
    else if (bt > at) winner = 1;
    endFight({
      type: winner < 0 ? 'draw' : 'decision',
      winner: winner,
      total: at + '-' + bt
    });
  }

  function endFight(info) {
    if (game.state === 'result') return;
    game.state = 'result';
    game.result = info;
    game.menuIndex = 0;
    game.shake = 0.2;
    if (info.type === 'ko' || info.type === 'tko') PZ.audio.ko();
    const playerWon = info.winner === 0;
    if (info.type !== 'draw' && info.winner === 0) PZ.audio.win();
    if (info.winner === 1) PZ.audio.lose();
    if (game.mode === 1 && playerWon) {
      if (game.circuit >= 6) {
        info.champion = true;
        game.cleared = true;
        saveCircuit(7);
        game.resultMenu = [['DEFEND THE BELT', 'retry'], ['TITLE', 'title']];
      } else {
        game.resultMenu = [['NEXT FIGHT', 'next'], ['TITLE', 'title']];
      }
    } else if (game.mode === 1) {
      game.resultMenu = [['RETRY', 'retry'], ['TITLE', 'title']];
    } else {
      game.resultMenu = [['REMATCH', 'retry'], ['TITLE', 'title']];
    }
    if (!game.betResolved && PZ.bet && PZ.bet.resolve) {
      game.betResolved = true;
      PZ.bet.resolve(info.winner, info.type);
    }
    const name = info.winner === 0 || info.winner === 1 ? game.players[info.winner].def.name : 'DRAW';
    log(info.type.toUpperCase() + ' — ' + name);
  }

  function beginRound(n) {
    game.round = n;
    game.clock = 60;
    game.freeze = 0.8;
    game.banner = { text: 'ROUND ' + n, age: 0, dur: 0.8 };
    game.state = 'fight';
    game.players.forEach(function (f) {
      f.kd = 0;
      f.roundDmg = 0;
      f.action = null;
      f.tell = null;
      f.down = false;
      f.dodge = null;
      f.stun = 0;
      f.duckHeld = false;
      f.blockHeld = false;
      f.aiWait = 0.7;
      homeSpot(f);
    });
  }

  function buildPlayers() {
    let d0, d1, h0, h1;
    if (game.mode === 1) {
      d0 = PZ.fighterById('freeman');
      d1 = PZ.circuitOpponents()[game.circuit];
      h0 = true;
      h1 = false;
    } else {
      d0 = PZ.FIGHTERS[game.select.p1];
      d1 = PZ.FIGHTERS[game.select.p2];
      h0 = true;
      h1 = true;
    }
    game.players = [makeFighter(d0, 0, h0), makeFighter(d1, 1, h1)];
  }

  function startMatch() {
    buildPlayers();
    game.scores = [];
    game.round = 1;
    game.clock = 60;
    game.result = null;
    game.betResolved = false;
    game.effects = [];
    game.floaters = [];
    game.introT = 0;
    game.state = 'intro';
    game.flashBanner = null;
    PZ.audio.unlock();
    PZ.audio.rumble();
    log(game.players[0].def.name + ' vs ' + game.players[1].def.name);
  }

  function goTitle() {
    game.state = 'title';
    game.menuIndex = 0;
    game.players = [null, null];
  }

  function goSelect() {
    game.state = 'select';
    game.menuIndex = 0;
    game.select.ready = [false, false];
    if (game.mode === 2) {
      game.select.p1 = 0;
      game.select.p2 = 1;
    }
  }

  function activate(id) {
    PZ.audio.confirm();
    if (id === 'p1') { game.mode = 1; goSelect(); return; }
    if (id === 'p2') { game.mode = 2; goSelect(); return; }
    if (id === 'controls') {
      game.controlsReturn = game.state === 'controls' ? game.controlsReturn : game.state;
      game.state = 'controls';
      return;
    }
    if (id === 'back') {
      game.state = game.controlsReturn || 'title';
      if (game.state === 'controls') game.state = 'title';
      return;
    }
    if (id === 'fight') { startMatch(); return; }
    if (id === 'resume') { game.state = game.pausedFrom || 'fight'; return; }
    if (id === 'quit') {
      if (PZ.bet && PZ.bet.forfeit) PZ.bet.forfeit();
      goTitle();
      return;
    }
    if (id === 'title') { goTitle(); return; }
    if (id === 'retry') { startMatch(); return; }
    if (id === 'next') {
      game.circuit = Math.min(6, game.circuit + 1);
      saveCircuit(game.circuit);
      startMatch();
      return;
    }
    if (id.indexOf('pick:') === 0) {
      const idx = Number(id.split(':')[1]);
      if (!game.select.ready[0]) {
        game.select.p1 = idx;
        game.select.ready[0] = true;
      } else if (!game.select.ready[1]) {
        game.select.p2 = idx;
        game.select.ready[1] = true;
      } else {
        game.select.p2 = idx;
      }
      PZ.audio.ui();
      if (game.select.ready[0] && game.select.ready[1]) {
        /* Stay a beat so the locks are visible, then the update loop starts it. */
        game.select.launchAt = game.t + 0.45;
      }
    }
  }

  PZ.onHotspot = function (id) {
    PZ.audio.unlock();
    activate(id);
  };

  function moveMenu(inp, count) {
    if (inp.up) {
      game.menuIndex = (game.menuIndex + count - 1) % count;
      PZ.audio.ui();
    } else if (inp.down) {
      game.menuIndex = (game.menuIndex + 1) % count;
      PZ.audio.ui();
    }
  }

  function updateTitle(inp) {
    moveMenu(inp, 3);
    if (inp.confirm || inp.pause) {
      const id = ['p1', 'p2', 'controls'][game.menuIndex];
      activate(id);
    }
  }

  function updateControls(inp) {
    if (inp.confirm || inp.back || inp.pause) {
      game.state = game.controlsReturn || 'title';
      if (game.state === 'controls') game.state = 'title';
      PZ.audio.ui();
    }
  }

  function updateSelect(inputs) {
    const inp = inputs[0];
    const inp2 = inputs[1];
    if (game.mode === 1) {
      moveMenu(inp, 2);
      if (inp.confirm) activate(game.menuIndex === 0 ? 'fight' : 'back');
      if (inp.back) goTitle();
      return;
    }
    if (inp.left) game.select.p1 = (game.select.p1 + PZ.FIGHTERS.length - 1) % PZ.FIGHTERS.length;
    if (inp.right) game.select.p1 = (game.select.p1 + 1) % PZ.FIGHTERS.length;
    if (inp2.left) game.select.p2 = (game.select.p2 + PZ.FIGHTERS.length - 1) % PZ.FIGHTERS.length;
    if (inp2.right) game.select.p2 = (game.select.p2 + 1) % PZ.FIGHTERS.length;
    if (inp.left || inp.right || inp2.left || inp2.right) PZ.audio.ui();
    if (inp.confirm) game.select.ready[0] = true;
    if (inp2.confirm || inp2.upper) game.select.ready[1] = true;
    if (inp.back) goTitle();
    if (game.select.ready[0] && game.select.ready[1]) {
      if (!game.select.launchAt) game.select.launchAt = game.t + 0.35;
      if (game.t >= game.select.launchAt) startMatch();
    } else {
      game.select.launchAt = 0;
    }
  }

  function updateIntro(inputs, dt) {
    game.introT += dt;
    const mash = inputs[0].confirm || inputs[0].mash || inputs[1].mash;
    if (game.introT > 3.3 || (game.introT > 0.45 && mash)) beginRound(1);
  }

  function updateFight(inputs, dt) {
    if (inputs[0].pause || inputs[1].pause) {
      game.pausedFrom = 'fight';
      game.controlsReturn = 'pause';
      game.state = 'pause';
      game.menuIndex = 0;
      return;
    }
    if (game.freeze > 0) {
      game.freeze -= dt;
      if (game.banner) game.banner.age += dt;
      if (game.freeze <= 0) PZ.audio.bell(1);
      return;
    }
    if (game.banner) game.banner.age += dt;
    if (game.flashBanner) game.flashBanner.age += dt;

    /* Input before the sim step so a slip on this frame still covers the punch. */
    if (game.players[0].human) handleHuman(game.players[0], inputs[0], dt);
    else handleAI(game.players[0], dt);
    if (game.players[1].human) handleHuman(game.players[1], inputs[1], dt);
    else handleAI(game.players[1], dt);
    game.players.forEach(faceFoe);
    const pending = [];
    game.players.forEach(function (f) { pending.push(advanceFighter(f, dt)); });
    pending.forEach(function (hit, i) {
      const f = game.players[i];
      if (hit && f.action && !f.action.didHit) {
        f.action.didHit = true;
        resolveStrike(f, foeOf(f));
      }
    });
    game.players.forEach(finishAction);

    const dead = [];
    if (game.players[0].hp <= 0) dead.push(0);
    if (game.players[1].hp <= 0) dead.push(1);
    if (dead.length === 2) {
      const live = game.players[0].roundDmg >= game.players[1].roundDmg ? 0 : 1;
      game.players[live].hp = 1;
      startKnockdown(1 - live);
      return;
    }
    if (dead.length === 1) {
      startKnockdown(dead[0]);
      return;
    }

    game.clock -= dt;
    if (game.clock <= 0) {
      game.clock = 0;
      endRound();
    }
  }

  function updateDown(inputs, dt) {
    if (inputs[0].pause || inputs[1].pause) {
      game.pausedFrom = 'down';
      game.state = 'pause';
      game.menuIndex = 0;
      return;
    }
    const f = game.players[game.downIndex];
    const inp = inputs[game.downIndex];
    game.players.forEach(function (p) { stepCommon(p, dt); });
    /* CPU fighters beat the count on their own. Later knockdowns are slower. */
    if (!f.human) {
      const mult = f.kd <= 1 ? 1.15 : 0.62;
      f.getUp = Math.min(100, f.getUp + (f.def.chin || 8) * 11 * mult * dt);
    }
    if (inp.mash) {
      const gain = (f.def.chin || 8) * (f.kd <= 1 ? 1.25 : 0.8);
      f.getUp = Math.min(100, f.getUp + gain);
      PZ.audio.mash();
    }
    game.countAcc += dt;
    if (game.countAcc >= 1) {
      game.countAcc -= 1;
      game.count += 1;
      PZ.audio.countBeep();
      if (game.count >= 10) {
        if (f.getUp >= 100) getUp(f);
        else endFight({ type: 'ko', winner: 1 - game.downIndex });
        return;
      }
    }
    if (f.getUp >= 100 && game.count >= 1) getUp(f);
  }

  function updateCard(inputs, dt) {
    game.cardT += dt;
    if (game.cardT > 1.2 && (inputs[0].confirm || inputs[0].mash || inputs[1].confirm)) {
      beginRound(game.round + 1);
      return;
    }
    if (game.cardT >= 7.15) beginRound(game.round + 1);
  }

  function updatePause(inp) {
    moveMenu(inp, 3);
    if (inp.confirm || inp.pause && game.menuIndex === 0) {
      const id = ['resume', 'controls', 'quit'][game.menuIndex];
      if (inp.pause && game.menuIndex === 0) activate('resume');
      else activate(id);
    } else if (inp.back) activate('resume');
  }

  function updateResult(inp) {
    const items = game.resultMenu || [['TITLE', 'title']];
    moveMenu(inp, items.length);
    if (inp.confirm) activate(items[game.menuIndex][1]);
  }

  function decayFx(dt) {
    game.shake = Math.max(0, game.shake - dt);
    game.effects.forEach(function (e) {
      e.life -= dt;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.vy += 180 * dt;
    });
    game.effects = game.effects.filter(function (e) { return e.life > 0; });
    game.floaters.forEach(function (f) {
      f.life -= dt;
      f.y -= 28 * dt;
    });
    game.floaters = game.floaters.filter(function (f) { return f.life > 0; });
  }

  function update(dt, inputs) {
    game.t += dt;
    decayFx(dt);
    if (PZ.input.keyEdge && PZ.input.keyEdge.has('m')) {
      PZ.audio.setMuted(!PZ.audio.muted);
      PZ.input.keyEdge.delete('m');
    }
    const st = game.state;
    if (st === 'title') updateTitle(inputs[0]);
    else if (st === 'controls') updateControls(inputs[0]);
    else if (st === 'select') updateSelect(inputs);
    else if (st === 'intro') updateIntro(inputs, dt);
    else if (st === 'fight') updateFight(inputs, dt);
    else if (st === 'down') updateDown(inputs, dt);
    else if (st === 'card') updateCard(inputs, dt);
    else if (st === 'pause') updatePause(inputs[0]);
    else if (st === 'result') updateResult(inputs[0]);
  }

  PZ.tick = function (dt) {
    const turbo = game.turbo || 1;
    let left = Math.max(0, dt) * turbo;
    /* Keep long stalls from skipping a whole round in one frame. */
    if (left > 0.75 * turbo) left = 0.75 * turbo;
    const mode = game.mode;
    let inputs = null;
    let first = true;
    while (left > 0.00005) {
      const s = Math.min(1 / 60, left);
      if (first) {
        inputs = [PZ.input.snapshot(0, mode), PZ.input.snapshot(1, mode)];
      }
      update(s, inputs);
      if (first) clearActionEdges(inputs);
      first = false;
      left -= s;
    }
    PZ.input.endFrame();
  };

  PZ.advance = function (dt) {
    game.manual = true;
    PZ.tick(dt);
  };

  PZ.canvasAction = function (x, y) {
    const spots = PZ.hotspots || [];
    for (let i = spots.length - 1; i >= 0; i--) {
      const h = spots[i];
      if (x >= h.x && y >= h.y && x <= h.x + h.w && y <= h.y + h.h) {
        PZ.onHotspot(h.id);
        return true;
      }
    }
    if (game.state === 'down') {
      const f = game.players[game.downIndex];
      if (f) {
        const gain = (f.def.chin || 8) * (f.kd <= 1 ? 1.25 : 0.8);
        f.getUp = Math.min(100, f.getUp + gain);
        PZ.audio.mash();
      }
      return true;
    }
    return false;
  };

  loadCircuit();
})();
