/* Pixel-art arena matched to the promo: purple ring, gold apron, big fighters. */
(function () {
  'use strict';
  const PZ = (window.PZ = window.PZ || {});

  const W = 480;
  const H = 800;
  PZ.VIEW = {
    W: W,
    H: H,
    ground: 690,
    leftX: 118,
    rightX: 362,
    elev: 33 * Math.PI / 180,
    ringC: { x: 240, y: 545, rx: 220 },
    ring: [[76, 368], [404, 368], [458, 712], [22, 712]]
  };

  /* 33 degrees above the horizon: the ring floor is an ellipse, nearer edge larger. */
  PZ.project = function (x, z) {
    const c = PZ.VIEW.ringC;
    const ry = c.rx * Math.sin(PZ.VIEW.elev);
    return {
      x: c.x + x * c.rx,
      y: c.y + z * ry,
      scale: 0.5 + ((z + 1) * 0.5) * 0.26
    };
  };

  const promo = new Image();
  promo.src = 'promo.jpg';

  let backdrop = null;

  PZ.hotspots = [];

  function px(n) { return Math.round(n); }

  function rect(ctx, x, y, w, h, fill) {
    ctx.fillStyle = fill;
    ctx.fillRect(px(x), px(y), px(w), px(h));
  }

  function polyPath(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  }

  function inPoly(x, y, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1];
      const xj = poly[j][0], yj = poly[j][1];
      const hit = ((yi > y) !== (yj > y)) &&
        (x < ((xj - xi) * (y - yi)) / ((yj - yi) || 0.0001) + xi);
      if (hit) inside = !inside;
    }
    return inside;
  }

  function text(ctx, str, x, y, scale, color, align, outline) {
    PZ.font.drawText(ctx, str, x, y, {
      scale: scale, color: color, align: align || 'left', outline: outline || '#140818'
    });
  }

  function ensureBackdrop() {
    if (backdrop) return backdrop;
    backdrop = document.createElement('canvas');
    backdrop.width = W;
    backdrop.height = H;
    const ctx = backdrop.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#07060f');
    g.addColorStop(0.35, '#1a0a32');
    g.addColorStop(0.7, '#14081f');
    g.addColorStop(1, '#09060f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#f4efe2';
    const stars = [[20, 24], [60, 70], [110, 30], [180, 54], [250, 18], [310, 48], [370, 22], [430, 64], [460, 30], [90, 100], [400, 96]];
    stars.forEach(function (s, i) {
      ctx.globalAlpha = 0.35 + (i % 3) * 0.15;
      ctx.fillRect(s[0], s[1], (i % 2) + 1, (i % 2) + 1);
    });
    ctx.globalAlpha = 1;

    /* Crowd mass. */
    for (let row = 0; row < 9; row++) {
      const y = 150 + row * 22;
      const inset = row * 6;
      for (let x = 16 + inset; x < W - 16 - inset; x += 14) {
        const shade = (x + row) % 3 === 0 ? '#3a1868' : '#2a1248';
        ctx.fillStyle = shade;
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = (x + row) % 5 === 0 ? '#ffd0f0' : '#c9a0d8';
        ctx.fillRect(x - 1, y - 1, 2, 2);
      }
    }

    drawOverheadRing(ctx);
    return backdrop;
  }

  function drawOverheadRing(ctx) {
    const c = PZ.VIEW.ringC;
    const ry = c.rx * Math.sin(PZ.VIEW.elev);
    ctx.fillStyle = '#e8b423';
    ctx.beginPath();
    ctx.ellipse(c.x, c.y + 10, c.rx + 28, ry + 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c48a14';
    ctx.beginPath();
    ctx.ellipse(c.x, c.y + 16, c.rx + 28, ry + 16, 0, 0, Math.PI * 2);
    ctx.fill();
    const fg = ctx.createLinearGradient(0, c.y - ry, 0, c.y + ry);
    fg.addColorStop(0, '#2a1468');
    fg.addColorStop(1, '#5a28b0');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, c.rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7a4ad8';
    for (let row = -4; row <= 4; row++) {
      for (let col = -6; col <= 6; col++) {
        const px = c.x + col * 28;
        const py = c.y + row * 18;
        const nx = (px - c.x) / c.rx;
        const nz = (py - c.y) / ry;
        if (nx * nx + nz * nz < 0.86 && ((col + row) % 2 === 0)) ctx.fillRect(px, py, 2, 2);
      }
    }
    const colors = ['#3d7dff', '#f4f4f8', '#e23b4a'];
    colors.forEach(function (color, i) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.rx - 8 + i * 7, ry - 4 + i * 4, 0, 0, Math.PI * 2);
      ctx.stroke();
    });
    [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(function (p) {
      const x = c.x + p[0] * c.rx;
      const y = c.y + p[1] * ry;
      ctx.fillStyle = '#141414';
      ctx.fillRect(x - 5, y - 18, 10, 28);
      ctx.fillStyle = '#ffd24a';
      ctx.fillRect(x - 7, y - 24, 14, 8);
    });
  }

  function drawRopes(ctx) {
    const ring = PZ.VIEW.ring;
    const posts = [
      { x: ring[0][0], y1: ring[0][1] - 46, y2: ring[0][1] + 8 },
      { x: ring[1][0], y1: ring[1][1] - 46, y2: ring[1][1] + 8 },
      { x: ring[2][0], y1: ring[2][1] - 70, y2: ring[2][1] },
      { x: ring[3][0], y1: ring[3][1] - 70, y2: ring[3][1] }
    ];
    const colors = ['#3d7dff', '#f4f4f8', '#e23b4a'];
    /* Far rope. */
    colors.forEach(function (c, i) {
      ctx.strokeStyle = c;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(ring[0][0], ring[0][1] - 36 + i * 12);
      ctx.lineTo(ring[1][0], ring[1][1] - 36 + i * 12);
      ctx.stroke();
    });
    /* Side ropes. */
    [[0, 3], [1, 2]].forEach(function (pair) {
      colors.forEach(function (c, i) {
        const a = posts[pair[0]];
        const b = posts[pair[1]];
        ctx.strokeStyle = c;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y1 + 8 + i * 14);
        ctx.lineTo(b.x, b.y1 + 18 + i * 16);
        ctx.stroke();
      });
    });
    /* Near rope, in front of the apron edge. */
    colors.forEach(function (c, i) {
      ctx.strokeStyle = c;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(ring[3][0] + 8, 724 + i * 12);
      ctx.lineTo(ring[2][0] - 8, 724 + i * 12);
      ctx.stroke();
    });
    posts.forEach(function (p) {
      ctx.fillStyle = '#141414';
      ctx.fillRect(p.x - 5, p.y1, 10, p.y2 - p.y1);
      ctx.fillStyle = '#ffd24a';
      ctx.fillRect(p.x - 7, p.y1 - 6, 14, 8);
    });
  }

  function drawSpotlights(ctx, t) {
    const spots = [90, 240, 390];
    spots.forEach(function (x, i) {
      const flick = 0.55 + Math.sin(t * 3 + i) * 0.2;
      ctx.fillStyle = 'rgba(255, 70, 210, ' + (0.13 * flick) + ')';
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x - 70, 360);
      ctx.lineTo(x + 70, 360);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 240, 255, ' + (0.8 * flick) + ')';
      ctx.fillRect(x - 16, 8, 32, 10);
      for (let k = 0; k < 4; k++) ctx.fillRect(x - 22 + k * 12, 4, 6, 6);
    });
  }

  function drawCoins(ctx, t, cheer) {
    const coins = [
      { x: 36, y: 268, r: 16, c: '#9945FF', m: '#14F195' },
      { x: 78, y: 318, r: 13, c: '#e8b923', m: '#5a3a08' },
      { x: 446, y: 268, r: 16, c: '#14F195', m: '#083' },
      { x: 404, y: 324, r: 13, c: '#c084fc', m: '#fff' },
      { x: 240, y: 214, r: 11, c: '#3d7dff', m: '#fff' },
      { x: 28, y: 360, r: 12, c: '#ff7a18', m: '#fff' },
      { x: 452, y: 360, r: 12, c: '#ffd24a', m: '#333' }
    ];
    coins.forEach(function (coin, i) {
      const bob = Math.sin(t * 2.2 + i) * 2;
      const y = coin.y + bob - (cheer ? 6 : 0);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(coin.x, y + coin.r + 16, coin.r * 0.7, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a1030';
      ctx.fillRect(coin.x - 7, y + coin.r - 2, 14, 16);
      ctx.fillStyle = coin.c;
      ctx.beginPath();
      ctx.arc(coin.x, y, coin.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1a0830';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = coin.m;
      ctx.fillRect(coin.x - 5, y - 5, 10, 2);
      ctx.fillRect(coin.x - 3, y - 1, 10, 2);
      ctx.fillRect(coin.x - 1, y + 3, 10, 2);
      /* Tiny gloves cheer. */
      ctx.fillStyle = '#e02028';
      const ay = cheer ? y + 2 : y + 8;
      ctx.fillRect(coin.x - 14, ay, 5, 5);
      ctx.fillRect(coin.x + 9, ay, 5, 5);
    });
  }

  function pal(f, color) {
    if (f.flash > 0 && Math.sin(f.flash * 80) > 0) return '#ffffff';
    if (f.iframe > 0 && Math.floor(PZ.game.t * 16) % 2 === 0) return '#d7fff0';
    return color;
  }

  function visualOf(f) {
    const v = {
      duck: 0,
      back: 0,
      slipY: 0,
      tellAmt: 0,
      tellHand: null,
      tellHigh: true,
      punch: null,
      block: false,
      bob: Math.sin((PZ.game.t || 0) * 3 + f.side * 1.7) * 2
    };
    if (f.duckHeld || f.duckAge > 0) v.duck = Math.max(f.duckHeld ? 1 : 0, Math.min(1, (f.duckAge || 0) / 0.08));
    if (f.dodge) {
      const u = Math.min(1, f.dodge.age / f.dodge.dur);
      const mag = Math.sin(u * Math.PI);
      const dir = f.dodge.dir === 'L' ? 1 : -1;
      v.slipX = f.facing * dir * 28 * mag;
      v.slipY = -8 * mag;
      v.back = 16 * mag;
    }
    if (f.tell) {
      const p = Math.min(1, f.tell.age / Math.max(0.01, f.tell.dur));
      v.tellAmt = Math.sin(Math.min(1, p / 0.75) * Math.PI * 0.5);
      v.tellHand = f.tell.hand;
      v.tellHigh = f.tell.high !== false;
    }
    if (f.action && PZ.punchExt) {
      const ext = PZ.punchExt(f);
      const move = PZ.MOVES[f.action.name];
      if (move && ext > 0) v.punch = { kind: move.kind, hand: move.hand, ext: ext, name: f.action.name };
    }
    v.block = !!(f.blockHeld && !v.punch);
    return v;
  }

function skeleton(f, vis) {
  const h = f.def.height || 1;
  const w = f.def.width || 1;
  const duck = vis.duck;
  const lean = (vis.punch ? vis.punch.ext * 22 : 0) - vis.back;
  const hipY = -112 * h + duck * 40;
  const shY = -206 * h + duck * 64;
  const headY = -272 * h + duck * 78;
  const headR = 36 * (0.9 + 0.1 * w);
  const leadSh = { x: 22 * w + lean, y: shY + 8 };
  const rearSh = { x: -24 * w + lean, y: shY + 14 };
  /* Gloves sit up by the cheeks so a jab, hook, or uppercut reads. */
  let lead = { x: headR + 16 + lean, y: headY + headR * 0.55 };
  let rear = { x: lean - 6, y: headY + headR + 6 };
  if (vis.block) {
    lead = { x: 28 * w + lean, y: headY + 4 };
    rear = { x: 8 * w + lean, y: headY + 12 };
  }
  if (vis.punch) {
    const e = vis.punch.ext;
    const glove = vis.punch.hand === 'L' ? lead : rear;
    if (vis.punch.kind === 'jab') glove.x += 132 * e;
    else if (vis.punch.kind === 'body') { glove.x += 96 * e; glove.y += 86 * e; }
    else if (vis.punch.kind === 'hook') { glove.x += 92 * e; glove.y -= 10 * e; }
    else {
      glove.x += 48 * e;
      glove.y = glove.y + 64 * (1 - e) - 96 * e;
    }
  } else if (vis.tellAmt > 0 && vis.tellHand) {
    const glove = vis.tellHand === 'L' ? lead : rear;
    glove.x -= 42 * vis.tellAmt;
    glove.y += (vis.tellHigh ? -34 : 40) * vis.tellAmt;
  }
    return {
      h: h, w: w, lean: lean, hipY: hipY, shY: shY, headY: headY, headR: headR,
      leadSh: leadSh, rearSh: rearSh, lead: lead, rear: rear,
      leadFoot: { x: 36 * w, y: -6 },
      rearFoot: { x: -30 * w, y: 0 },
      hip: { x: lean * 0.25, y: hipY }
    };
  }

  function limb(ctx, x1, y1, x2, y2, thick, color, outline) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = outline;
    ctx.lineWidth = thick + 5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = thick;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

function drawHairBack(ctx, f, hx, hy, r) {
  const hair = pal(f, f.def.hair);
  ctx.fillStyle = hair;
  const style = f.def.hairStyle;
  if (style === 'wig') {
    ctx.beginPath();
    ctx.arc(hx - 4, hy - 4, r + 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(hx - r - 16, hy - 4, 16, 26);
    ctx.beginPath();
    ctx.arc(hx - r - 8, hy + 24, 8, 0, Math.PI * 2);
    ctx.fill();
  } else if (style === 'curly') {
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.arc(hx - 6 + i * 9, hy - r + 4, 10, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillRect(hx - r, hy - r - 4, r * 1.5, 12);
  } else if (style === 'crop' || style === 'short') {
    ctx.beginPath();
    ctx.arc(hx - 2, hy - 6, r * 0.95, Math.PI, Math.PI * 2);
    ctx.fill();
  } else if (style === 'receding') {
    ctx.fillRect(hx - r - 2, hy - 6, 10, r);
    ctx.beginPath();
    ctx.arc(hx - 8, hy - r + 6, r * 0.48, Math.PI, Math.PI * 2);
    ctx.fill();
  } else if (style === 'swept') {
    ctx.beginPath();
    ctx.ellipse(hx, hy - r + 2, r * 1.05, r * 0.5, -0.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHairFront(ctx, f, hx, hy, r) {
  const style = f.def.hairStyle;
  if (style === 'curly') {
    ctx.fillStyle = pal(f, f.def.band || '#14d48a');
    ctx.fillRect(hx - r * 0.15, hy - r * 0.72, r * 1.15, 8);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillRect(hx - r * 0.05, hy - r * 0.68, 6, 3);
  } else if (style === 'stovepipe') {
    ctx.fillStyle = '#111';
    ctx.fillRect(hx - 18, hy - r - 58, 36, 54);
    ctx.fillRect(hx - 30, hy - r - 8, 60, 8);
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(hx - 18, hy - r - 58, 8, 54);
  } else if (style === 'wig') {
    ctx.fillStyle = pal(f, f.def.hair);
    ctx.beginPath();
    ctx.arc(hx - 2, hy - r + 4, r * 0.55, Math.PI, Math.PI * 2);
    ctx.fill();
  } else if (style === 'swept') {
    ctx.fillStyle = pal(f, f.def.hair);
    ctx.fillRect(hx + 4, hy - r - 8, r * 0.9, 12);
  }
}

  function drawFace(ctx, f, hx, hy, r) {
    const outline = f.def.outline || '#1a100c';
    ctx.fillStyle = outline;
    ctx.beginPath();
    ctx.arc(hx, hy, r + 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal(f, f.def.skin);
    ctx.beginPath();
    ctx.arc(hx, hy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal(f, f.def.skinShade);
    ctx.beginPath();
    ctx.arc(hx - r * 0.55, hy + 4, r * 0.28, 0, Math.PI * 2);
    ctx.fill();

    if (f.def.facial === 'beard') {
      ctx.fillStyle = '#161616';
      ctx.beginPath();
      ctx.ellipse(hx + 2, hy + r * 0.55, r * 0.85, r * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = pal(f, f.def.skin);
      ctx.beginPath();
      ctx.arc(hx + 4, hy - 2, r * 0.72, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#fff';
    ctx.fillRect(hx + r * 0.05, hy - r * 0.22, 14, 10);
    ctx.fillStyle = '#111';
    ctx.fillRect(hx + r * 0.22, hy - r * 0.16, 6, 7);
    ctx.fillStyle = f.def.hair === '#f7f3e6' ? '#5a4636' : f.def.hair;
    const browY = hy - r * 0.42;
    ctx.fillRect(hx + r * 0.02, browY, f.def.brows === 'heavy' ? 20 : 16, f.def.brows === 'heavy' ? 5 : 3);

    ctx.fillStyle = pal(f, f.def.skinShade);
    ctx.fillRect(hx + r * 0.62, hy - 2, 8, 7);

    const mouthY = hy + r * 0.32;
    if (f.def.glasses) {
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 2;
      ctx.strokeRect(hx + r * 0.02, hy - r * 0.28, 16, 12);
      ctx.beginPath();
      ctx.moveTo(hx + r * 0.02, hy - r * 0.12);
      ctx.lineTo(hx - r * 0.2, hy - r * 0.16);
      ctx.stroke();
    }

    if (f.def.facial === 'mustache') {
      ctx.fillStyle = f.def.hair;
      ctx.fillRect(hx - 2, mouthY - 6, 20, 6);
    }

    ctx.fillStyle = '#6e2434';
    if (f.def.face === 'smile') {
      ctx.beginPath();
      ctx.arc(hx + r * 0.15, mouthY, 7, 0.15, Math.PI - 0.15);
      ctx.strokeStyle = '#6e2434';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (f.def.face === 'frown') {
      ctx.fillRect(hx + 2, mouthY + 2, 14, 3);
    } else if (f.def.face === 'grit') {
      ctx.fillStyle = '#f4f4f4';
      ctx.fillRect(hx + 2, mouthY, 14, 5);
      ctx.fillStyle = '#6e2434';
      ctx.fillRect(hx + 8, mouthY, 2, 5);
    } else {
      ctx.fillRect(hx + 4, mouthY, 12, 3);
    }

    if (f.def.sweaty) {
      ctx.fillStyle = '#bfe9ff';
      ctx.fillRect(hx - 8, hy - 6, 3, 4);
    }
  }

function drawGlove(ctx, f, p, hot) {
  const rad = 26 * Math.min(1.15, f.def.width || 1);
    ctx.fillStyle = f.def.outline || '#1a100c';
    ctx.beginPath();
    ctx.arc(p.x, p.y, rad + 3, 0, Math.PI * 2);
    ctx.fill();
    let col = f.def.gloves;
    if (hot) col = Math.sin((PZ.game.t || 0) * 28) > 0 ? '#fff6c2' : '#ffd24a';
    ctx.fillStyle = pal(f, col);
    ctx.beginPath();
    ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.arc(p.x - 4, p.y - 4, rad * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal(f, f.def.gloveShade || '#501018');
    ctx.fillRect(p.x - rad * 0.2, p.y + rad * 0.3, rad * 0.7, 4);
  }

  function drawDowned(ctx, f) {
    const skin = pal(f, f.def.skin);
    const outline = f.def.outline || '#1a100c';
    limb(ctx, 10, -8, 48, -20, 16, skin, outline);
    limb(ctx, 20, -6, 36, 0, 12, skin, outline);
    rect(ctx, 40, -36, 52, 26, pal(f, f.def.trunks));
    rect(ctx, 40, -38, 52, 4, pal(f, f.def.trim || f.def.trunks));
    limb(ctx, 78, -24, 110, -16, 18, skin, outline);
    drawHairBack(ctx, f, 118, -28, 16);
    drawFace(ctx, f, 118, -28, 16);
    drawHairFront(ctx, f, 118, -28, 16);
    drawGlove(ctx, f, { x: 70, y: -42 }, false);
    drawGlove(ctx, f, { x: 54, y: -8 }, false);
    /* Swirls. */
    ctx.strokeStyle = '#ffd24a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(118, -52, 8 + Math.sin(PZ.game.t * 6) * 2, 0, Math.PI * 1.6);
    ctx.stroke();
  }

  function drawFighter(ctx, f, x, y, scale) {
    const vis = visualOf(f);
    ctx.save();
    ctx.translate(px(x + (vis.slipX || 0)), px(y + vis.slipY));
    ctx.scale(scale || 1, scale || 1);
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.beginPath();
    ctx.ellipse(0, 4, 36 * (f.def.width || 1), 8, 0, 0, Math.PI * 2);
    ctx.fill();

    if (f.stun > 0.2 && !f.down) {
      ctx.fillStyle = '#ffd24a';
      for (let i = 0; i < 3; i++) {
        const a = PZ.game.t * 6 + i * 2.1;
        const sx = Math.cos(a) * 30;
        const sy = -210 + Math.sin(a) * 10;
        ctx.fillRect(sx, sy, 4, 4);
      }
    }

    ctx.scale(f.facing, 1);

    if (f.down) {
      drawDowned(ctx, f);
      ctx.restore();
      return;
    }

    const sk = skeleton(f, vis);
    const skin = pal(f, f.def.skin);
    const outline = f.def.outline || '#1a100c';

    if (f.def.coinAura) {
      ctx.fillStyle = '#6d28d9';
      ctx.beginPath();
      ctx.arc(sk.lean * 0.2, sk.headY, sk.headR + 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#14F195';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.save();
      ctx.translate(sk.lean * 0.2 + 4, sk.headY - sk.headR + 6);
      ctx.rotate(-0.35);
      ctx.fillStyle = '#14F195';
      ctx.fillRect(-8, -18, 26, 4);
      ctx.fillRect(-4, -10, 26, 4);
      ctx.fillRect(0, -2, 26, 4);
      ctx.restore();
    }

    limb(ctx, sk.hip.x - 6, sk.hipY, sk.rearFoot.x, sk.rearFoot.y, 26 * sk.w, skin, outline);
    limb(ctx, sk.rearSh.x, sk.rearSh.y, sk.rear.x, sk.rear.y, 22, skin, outline);

    const torsoTop = sk.shY - 10;
    const torsoBot = sk.hipY + 10;
    const torsoW = 62 * sk.w;
    rect(ctx, sk.lean - torsoW / 2 - 3, torsoTop - 3, torsoW + 6, torsoBot - torsoTop + 6, outline);
    rect(ctx, sk.lean - torsoW / 2, torsoTop, torsoW, torsoBot - torsoTop, skin);
    rect(ctx, sk.lean - torsoW / 2, torsoTop, 8, torsoBot - torsoTop, pal(f, f.def.skinShade));
    if ((f.def.width || 1) > 1.08 || f.def.coinAura) {
      rect(ctx, sk.lean - 6, sk.shY + 16, 14, 4, pal(f, f.def.skinShade));
      rect(ctx, sk.lean - 6, sk.shY + 26, 14, 3, pal(f, f.def.skinShade));
    }

    const shortH = 32 * sk.h;
    rect(ctx, sk.lean - torsoW / 2 - 2, sk.hipY, torsoW + 8, shortH, pal(f, f.def.trunksShade || f.def.trunks));
    rect(ctx, sk.lean - torsoW / 2 + 2, sk.hipY, torsoW, shortH - 4, pal(f, f.def.trunks));
    rect(ctx, sk.lean - torsoW / 2 + 2, sk.hipY + shortH - 10, torsoW, 6, pal(f, f.def.trim || '#fff'));
    if (f.def.belt) {
      rect(ctx, sk.lean - torsoW / 2, sk.hipY - 4, torsoW + 4, 8, pal(f, f.def.belt));
      rect(ctx, sk.lean + 4, sk.hipY - 6, 10, 12, '#fff4c4');
    }

    limb(ctx, sk.hip.x + 8, sk.hipY + 12, sk.leadFoot.x, sk.leadFoot.y, 26 * sk.w, skin, outline);

    /* Boots. */
    [[sk.rearFoot.x, sk.rearFoot.y], [sk.leadFoot.x, sk.leadFoot.y]].forEach(function (ft) {
      rect(ctx, ft[0] - 8, ft[1] - 8, 22, 12, outline);
      rect(ctx, ft[0] - 6, ft[1] - 6, 18, 8, pal(f, f.def.boots));
      rect(ctx, ft[0] - 6, ft[1] - 2, 18, 3, pal(f, f.def.bootShade || '#ccc'));
    });

    const hx = sk.lean * 0.15;
    drawHairBack(ctx, f, hx, sk.headY, sk.headR);
    limb(ctx, sk.lean, sk.shY - 6, hx, sk.headY + sk.headR * 0.55, 18, skin, outline);
    drawFace(ctx, f, hx, sk.headY, sk.headR);
    drawHairFront(ctx, f, hx, sk.headY, sk.headR);

    limb(ctx, sk.leadSh.x, sk.leadSh.y, sk.lead.x, sk.lead.y, 22, skin, outline);
    const tellHotL = vis.tellAmt > 0.4 && vis.tellHand === 'L';
    const tellHotR = vis.tellAmt > 0.4 && vis.tellHand === 'R';
    drawGlove(ctx, f, sk.rear, tellHotR || (vis.punch && vis.punch.hand === 'R' && vis.punch.ext > 0.6));
    drawGlove(ctx, f, sk.lead, tellHotL || (vis.punch && vis.punch.hand === 'L' && vis.punch.ext > 0.6));

    if (vis.punch && (vis.punch.kind === 'star' || vis.punch.name === 'star') && vis.punch.ext > 0.45) {
      burst(ctx, (vis.punch.hand === 'L' ? sk.lead.x : sk.rear.x), (vis.punch.hand === 'L' ? sk.lead.y : sk.rear.y), '#ffd24a');
    }
    ctx.restore();
  }

  function burst(ctx, x, y, color) {
    ctx.fillStyle = color;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.fillRect(x + Math.cos(a) * 18, y + Math.sin(a) * 18, 4, 4);
    }
  }

  function ringPoint(s) {
    const a = ((s % 1) + 1) % 1 * Math.PI * 2;
    const p = PZ.project(Math.cos(a) * 0.92, Math.sin(a) * 0.92);
    return { x: p.x, y: p.y, facing: Math.cos(a) >= 0 ? 1 : -1, scale: p.scale * 1.35 };
  }

  function drawGirl(ctx, x, y, scale, facing, sign) {
    ctx.save();
    ctx.translate(px(x), px(y));
    ctx.scale(scale * facing, scale);
    const step = Math.sin((PZ.game.t || 0) * 8);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 2, 16, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    /* Legs. */
    limb(ctx, -4, -28, -6 - step * 4, 0, 6, '#e7b08a', '#3a2418');
    limb(ctx, 4, -28, 6 + step * 4, 0, 6, '#e7b08a', '#3a2418');
    rect(ctx, -8, -6, 8, 6, '#e8b923');
    rect(ctx, 2, -6, 8, 6, '#e8b923');
    /* Trunks / bikini bottom and top, flat cartoon blocks. */
    rect(ctx, -11, -46, 22, 20, '#5b21b6');
    rect(ctx, -11, -44, 22, 4, '#14F195');
    rect(ctx, -10, -64, 20, 16, '#14F195');
    rect(ctx, -10, -64, 20, 3, '#0c8f62');
    /* Arm holding the sign up, other arm swinging. */
    limb(ctx, -8, -58, -16, -40 + step * 3, 5, '#e7b08a', '#3a2418');
    limb(ctx, 8, -60, 10, -92, 5, '#e7b08a', '#3a2418');
    /* Head. */
    ctx.fillStyle = '#3a2418';
    ctx.beginPath();
    ctx.arc(0, -78, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e7b08a';
    ctx.beginPath();
    ctx.arc(0, -78, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a2418';
    ctx.fillRect(-8, -90, 16, 8);
    ctx.fillRect(6, -84, 4, 14 + step * 2);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-4, -80, 2, 2);
    ctx.fillRect(2, -80, 2, 2);
    ctx.fillStyle = '#a13848';
    ctx.fillRect(-2, -74, 5, 2);
    ctx.restore();

    /* Sign faces the camera, not mirrored. */
    const sw = Math.max(108, 78 * scale);
    const sh = Math.max(40, 32 * scale);
    const sx = x - sw / 2;
    const sy = y - 128 * scale;
    ctx.fillStyle = '#1a0830';
    ctx.fillRect(sx - 3, sy - 3, sw + 6, sh + 6);
    ctx.fillStyle = '#ffd24a';
    ctx.fillRect(sx - 3, sy - 3, sw + 6, 4);
    ctx.fillRect(sx - 3, sy + sh - 1, sw + 6, 4);
    ctx.fillStyle = '#2a1050';
    ctx.fillRect(sx, sy, sw, sh);
    const label = sign || 'ROUND 2';
    text(ctx, label, x, sy + sh / 2 - 8, 2, '#ffd24a', 'center', '#1a0830');
  }

  function drawRef(ctx, x, y, count) {
    ctx.save();
    ctx.translate(x, y);
    const arm = Math.sin((count + (PZ.game.countAcc || 0)) * Math.PI);
    limb(ctx, -4, -28, -8, -2, 7, '#111', '#000');
    limb(ctx, 4, -28, 8, -2, 7, '#111', '#000');
    rect(ctx, -10, -36, 20, 8, '#111');
    rect(ctx, -12, -58, 24, 24, '#f4f4f4');
    rect(ctx, -3, -58, 6, 24, '#111');
    limb(ctx, 8, -54, 16, -54 - arm * 16, 5, '#e7b08a', '#3a2418');
    ctx.fillStyle = '#e7b08a';
    ctx.beginPath();
    ctx.arc(0, -68, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ddd';
    ctx.fillRect(-7, -76, 14, 4);
    ctx.restore();
  }

function drawHeart(ctx, x, y, fill) {
  const c = fill > 0 ? '#ff3355' : '#3a2030';
  ctx.fillStyle = c;
  ctx.fillRect(x + 1, y, 5, 4);
  ctx.fillRect(x + 8, y, 5, 4);
  ctx.fillRect(x, y + 3, 14, 5);
  ctx.fillRect(x + 2, y + 8, 10, 3);
  ctx.fillRect(x + 4, y + 11, 6, 2);
  ctx.fillRect(x + 6, y + 13, 2, 2);
  if (fill === 1) {
    ctx.fillStyle = '#3a2030';
    ctx.fillRect(x + 7, y, 7, 14);
  }
}

  function drawStars(ctx, x, y, stars) {
    for (let i = 0; i < 3; i++) {
      const on = stars >= i + 1 - 0.01;
      text(ctx, '*', x + i * 14, y, 2, on ? '#ffd24a' : '#4a3a18', 'left', '#140818');
    }
  }

  function drawEffects(ctx, game) {
    (game.floaters || []).forEach(function (fl) {
      const alpha = Math.max(0, fl.life / fl.max);
      ctx.globalAlpha = alpha;
      text(ctx, fl.text, fl.x, fl.y, fl.scale || 2, fl.color || '#fff', 'center', '#140818');
      ctx.globalAlpha = 1;
    });
    (game.effects || []).forEach(function (e) {
      ctx.globalAlpha = Math.max(0, e.life / e.max);
      ctx.fillStyle = e.color;
      ctx.fillRect(e.x, e.y, e.s || 3, e.s || 3);
      ctx.globalAlpha = 1;
    });
  }

  function fighterPos(game, f) {
    const spread = game.state === 'card' ? 0.18 : 0;
    const x = (f.x || 0) + (f.side === 0 ? -spread : spread);
    return PZ.project(x, f.z || 0);
  }

  function drawArena(game) {
    const ctx = PZ.ctx;
    ctx.drawImage(ensureBackdrop(), 0, 0);
    drawSpotlights(ctx, game.t || 0);
    const cheer = game.shake > 0.05 || game.state === 'result' || game.state === 'down';
    drawCoins(ctx, game.t || 0, cheer);

    const girl = game.state === 'card' ? ringPoint((game.cardT || 0) / 7) : null;
    if (girl && girl.y < 520) {
      drawGirl(ctx, girl.x, girl.y - 30, girl.scale * 1.85, girl.facing, 'ROUND ' + (game.cardRound || 2));
    }

    if (game.players[0] && game.players[1]) {
      const slots = game.players.map(function (f) {
        const p = fighterPos(game, f);
        const vis = visualOf(f);
        return { f: f, x: p.x, y: p.y + vis.slipY };
      });
      slots.sort(function (a, b) { return a.y - b.y; });
      slots.forEach(function (s) {
        const p = fighterPos(game, s.f);
        drawFighter(ctx, s.f, p.x, p.y, p.scale || 0.62);
      });
    }

    if (girl && girl.y >= 520) {
      drawGirl(ctx, girl.x, Math.min(girl.y - 36, 620), girl.scale * 2.35, girl.facing, 'ROUND ' + (game.cardRound || 2));
    }

    if (game.state === 'down' && game.players[game.downIndex]) {
      const df = game.players[game.downIndex];
      const p = fighterPos(game, df);
      const rx = df.side === 0 ? p.x + 90 : p.x - 90;
      drawRef(ctx, rx, p.y, game.count || 0);
    }

    drawEffects(ctx, game);
  }

  function drawHUD(game) {
    const ctx = PZ.ctx;
    ctx.fillStyle = 'rgba(8, 4, 16, 0.78)';
    ctx.fillRect(0, 0, W, 86);
    ctx.fillStyle = '#ffd24a';
    ctx.fillRect(0, 84, W, 3);

    const a = game.players[0];
    const b = game.players[1];
    if (!a || !b) return;
    text(ctx, a.def.name, 12, 8, 2, '#14F195', 'left', '#042');
    text(ctx, b.def.name, W - 12, 8, 2, '#ffd24a', 'right', '#140818');

    drawHeartsRow(ctx, 12, 26, a.hp, a.maxHp);
    drawHeartsRow(ctx, W - 12 - 8 * 16, 26, b.hp, b.maxHp);

    meter(ctx, 12, 48, 100, 8, a.stam / a.maxStam, '#3af', '#123');
    meter(ctx, W - 112, 48, 100, 8, b.stam / b.maxStam, '#3af', '#123');
    text(ctx, 'STM', 12, 58, 1, '#9bd', 'left');
    text(ctx, 'STM', W - 12, 58, 1, '#9bd', 'right');

    drawStars(ctx, 12, 68, a.stars || 0);
    drawStars(ctx, W - 54, 68, b.stars || 0);

    const clock = formatClock(game.clock);
    const urgent = game.clock <= 10 && game.state === 'fight';
    text(ctx, 'R' + game.round, W / 2, 8, 2, '#f4efe2', 'center', '#140818');
    text(ctx, clock, W / 2, 28, 3, urgent ? '#ff3355' : '#ffd24a', 'center', '#140818');

    if (game.banner && game.banner.age < game.banner.dur) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(70, 150, 340, 64);
      text(ctx, game.banner.text, W / 2, 168, 4, '#ffd24a', 'center', '#140818');
    }
    if (game.flashBanner && game.flashBanner.age < game.flashBanner.dur) {
      text(ctx, game.flashBanner.text, W / 2, 250, 3, '#fff6c2', 'center', '#5a2080');
    }

    if (game.state === 'fight' && game.mode === 1 && b.tell && b.def.rank <= 2) {
      text(ctx, hintFor(b.tell), W / 2, 760, 2, '#fff', 'center', '#140818');
    }

    if (b.tell && b.tell.age > b.tell.dur * 0.45) {
      const p = fighterPos(game, b);
      text(ctx, '!', p.x + b.facing * 20, 400, 4, '#ffd24a', 'center', '#140818');
    }
    if (a.tell && a.tell.age > a.tell.dur * 0.45) {
      const p = fighterPos(game, a);
      text(ctx, '!', p.x + a.facing * 20, 400, 4, '#ffd24a', 'center', '#140818');
    }
  }

  function hintFor(tell) {
    const move = PZ.MOVES[tell.move];
    if (!move) return '';
    if (tell.feint) return 'FEINT?';
    if (move.kind === 'upper' || move.kind === 'star') return 'DODGE EITHER WAY';
    if (!move.high) return move.avoid === 'R' ? 'SLIP RIGHT' : 'SLIP LEFT';
    return move.avoid === 'R' ? 'DUCK OR SLIP RIGHT' : 'DUCK OR SLIP LEFT';
  }

  function drawHeartsRow(ctx, x, y, hp, maxHp) {
    const hearts = 8;
    const per = maxHp / hearts;
    for (let i = 0; i < hearts; i++) {
      const rem = hp - i * per;
      const fill = rem >= per * 0.75 ? 2 : rem >= per * 0.25 ? 1 : 0;
      drawHeart(ctx, x + i * 16, y, fill);
    }
  }

  function meter(ctx, x, y, w, h, t, fill, back) {
    ctx.fillStyle = back;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = t < 0.3 ? '#ff3355' : fill;
    ctx.fillRect(x, y, Math.max(0, Math.min(w, w * t)), h);
    ctx.strokeStyle = '#ffd24a';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  function formatClock(t) {
    const left = Math.max(0, t || 0);
    let show = Math.ceil(left - 1e-4);
    if (show > 60) show = 60;
    if (left <= 0) show = 0;
    const m = Math.floor(show / 60);
    const s = show % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function hotspot(x, y, w, h, id) {
    PZ.hotspots.push({ x: x, y: y, w: w, h: h, id: id });
  }

  function menuItem(ctx, label, y, selected, id) {
    const x = 90;
    const w = 300;
    const h = 36;
    ctx.fillStyle = selected ? '#ffd24a' : '#1a0c30';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#ffd24a';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);
    text(ctx, (selected ? '> ' : '  ') + label, W / 2, y + 8, 2, selected ? '#1a0a04' : '#ffd24a', 'center');
    hotspot(x, y, w, h, id);
  }

  function drawTitle(game) {
    const ctx = PZ.ctx;
    ctx.fillStyle = '#07060f';
    ctx.fillRect(0, 0, W, H);
    if (promo.complete && promo.naturalWidth) {
      ctx.drawImage(promo, 0, 0, promo.naturalWidth, promo.naturalHeight * 0.78, 0, 0, W, 520);
      const fade = ctx.createLinearGradient(0, 430, 0, 560);
      fade.addColorStop(0, 'rgba(7,6,15,0)');
      fade.addColorStop(1, 'rgba(7,6,15,1)');
      ctx.fillStyle = fade;
      ctx.fillRect(0, 430, W, 130);
    } else {
      text(ctx, 'SOLANA', W / 2, 80, 5, '#ffd24a', 'center', '#5a2ca0');
      text(ctx, 'COIN', W / 2, 140, 4, '#14F195', 'center', '#043');
      text(ctx, 'PUNCH-OUT!!', W / 2, 190, 3, '#ff3ec8', 'center', '#140818');
    }
    ctx.fillStyle = '#07060f';
    ctx.fillRect(0, 540, W, 260);
    text(ctx, 'TOP 10 SOLANA COINS. ONE RING.', W / 2, 548, 1, '#14F195', 'center');
    const items = [
      ['1 PLAYER', 'p1'],
      ['2 PLAYERS', 'p2'],
      ['CONTROLS', 'controls']
    ];
    items.forEach(function (item, i) {
      menuItem(ctx, item[0], 580 + i * 48, game.menuIndex === i, item[1]);
    });
    if (Math.floor((game.t || 0) * 2) % 2 === 0) {
      text(ctx, 'PRESS START', W / 2, 708, 2, '#f4efe2', 'center', '#140818');
    }
    const circuit = game.circuit || 0;
    if (circuit > 0) text(ctx, 'CIRCUIT ' + circuit + ' / 7', W / 2, 730, 1, '#b7a8d4', 'center');
  }

  function drawControls() {
    const ctx = PZ.ctx;
    ctx.fillStyle = '#07060f';
    ctx.fillRect(0, 0, W, H);
    text(ctx, 'CONTROLS', W / 2, 16, 3, '#ffd24a', 'center', '#140818');

    text(ctx, 'KEYBOARD  P1', 16, 58, 2, '#14F195', 'left');
    const p1 = [
      'WASD MOVE   Q / E SLIP',
      'SHIFT BLOCK    X DUCK',
      'F / G  LEFT / RIGHT JAB',
      'R / T  LEFT / RIGHT HOOK',
      'C / V  LEFT / RIGHT BODY',
      'SPACE  UPPERCUT / STAR PUNCH'
    ];
    p1.forEach(function (line, i) { text(ctx, line, 16, 84 + i * 18, 1, '#f4efe2', 'left'); });

    text(ctx, 'KEYBOARD  P2', 16, 190, 2, '#ffd24a', 'left');
    const p2 = [
      'ARROWS MOVE   N / M SLIP',
      '[ BLOCK    ] DUCK',
      'K / L  LEFT / RIGHT JAB',
      'I / O  LEFT / RIGHT HOOK',
      ', / .  LEFT / RIGHT BODY',
      'ENTER  UPPERCUT / STAR PUNCH'
    ];
    p2.forEach(function (line, i) { text(ctx, line, 16, 216 + i * 18, 1, '#f4efe2', 'left'); });

    text(ctx, 'XBOX GAMEPAD', 16, 320, 2, '#ff3ec8', 'left');
    const pad = [
      'LEFT STICK MOVES AROUND THE RING',
      'D-PAD  SLIP / DUCK / BLOCK',
      'A / B   LEFT / RIGHT JAB',
      'X / Y   LEFT / RIGHT HOOK',
      'LB / LT LEFT / RIGHT BODY',
      'RB / RT UPPERCUT / STAR PUNCH',
      'START   PAUSE',
      'TWO PADS: PAD 1 IS P1, PAD 2 IS P2'
    ];
    pad.forEach(function (line, i) { text(ctx, line, 16, 348 + i * 18, 1, '#f4efe2', 'left'); });

    text(ctx, 'TOUCH', 16, 510, 2, '#14F195', 'left');
    const touch = [
      'TURN THE PHONE SIDEWAYS',
      'DRAG WHERE YOU TOUCH TO MOVE',
      '2P: A STICK ON EACH SIDE',
      'OR ONE PAD PLUS A GAMEPAD',
      'P PAUSE    M MUTE    ESC BACK'
    ];
    touch.forEach(function (line, i) { text(ctx, line, 16, 536 + i * 18, 1, '#f4efe2', 'left'); });

    text(ctx, 'SLIP THE FLASHING GLOVE.', 16, 650, 1, '#ffd24a', 'left');
    text(ctx, 'DUCK BEATS HEAD SHOTS.', 16, 666, 1, '#ffd24a', 'left');
    text(ctx, 'DODGE BODY BLOWS AND UPPERCUTS.', 16, 682, 1, '#ffd24a', 'left');
    text(ctx, 'FILL STARS, THEN UPPERCUT.', 16, 698, 1, '#ffd24a', 'left');
    text(ctx, '3 KNOCKDOWNS IN A ROUND IS A TKO.', 16, 714, 1, '#ffd24a', 'left');

    menuItem(ctx, 'BACK', 740, true, 'back');
  }

  function drawSelect(game) {
    const ctx = PZ.ctx;
    ctx.fillStyle = '#07060f';
    ctx.fillRect(0, 0, W, H);
    if (game.mode === 1) drawSelect1P(game);
    else drawSelect2P(game);
  }

  function drawSelect1P(game) {
    const ctx = PZ.ctx;
    const opp = PZ.circuitOpponents()[game.circuit] || PZ.circuitOpponents()[0];
    text(ctx, 'CIRCUIT ' + (game.circuit + 1) + ' / 7', W / 2, 12, 2, '#14F195', 'center');
    text(ctx, 'FREEMAN VS ' + opp.name, W / 2, 36, 2, '#ffd24a', 'center', '#140818');
    const dummyL = PZ.dummyFighter(PZ.fighterById('freeman'), 0);
    const dummyR = PZ.dummyFighter(opp, 1);
    drawFighter(ctx, dummyL, 120, 400, 0.52);
    drawFighter(ctx, dummyR, 360, 400, 0.52);
    text(ctx, opp.nickname, W / 2, 470, 2, '#ff3ec8', 'center', '#140818');
    const lines = PZ.font.wrap(opp.intro, 28);
    lines.forEach(function (ln, i) {
      text(ctx, ln, W / 2, 500 + i * 16, 1, '#f4efe2', 'center');
    });
    PZ.circuitOpponents().forEach(function (f, i) {
      const y = 560 + i * 16;
      const col = i === game.circuit ? '#ffd24a' : i < game.circuit ? '#14F195' : '#6a5a88';
      const mark = i < game.circuit ? 'OK ' : i === game.circuit ? '> ' : '  ';
      text(ctx, mark + (i + 1) + ' ' + f.name, W / 2, y, 1, col, 'center');
    });
    menuItem(ctx, 'FIGHT', 690, game.menuIndex === 0, 'fight');
    menuItem(ctx, 'BACK', 738, game.menuIndex === 1, 'back');
  }

  function drawSelect2P(game) {
    const ctx = PZ.ctx;
    text(ctx, 'PICK YOUR FIGHTER', W / 2, 10, 2, '#ffd24a', 'center', '#140818');
    const sel = game.select;
    PZ.FIGHTERS.forEach(function (f, i) {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const x = 24 + col * 114;
      const y = 50 + row * 250;
      ctx.fillStyle = '#14081f';
      ctx.fillRect(x, y, 106, 210);
      const p1 = sel.p1 === i;
      const p2 = sel.p2 === i;
      ctx.strokeStyle = p1 && p2 ? '#fff' : p1 ? '#14F195' : p2 ? '#ffd24a' : '#3a2060';
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, 106, 210);
      const dummy = PZ.dummyFighter(f, 0);
      dummy.facing = 1;
      drawFighter(ctx, dummy, x + 52, y + 168, 0.3);
      text(ctx, f.name, x + 53, y + 176, 1, '#f4efe2', 'center');
      if (p1) text(ctx, sel.ready[0] ? 'P1 OK' : 'P1', x + 8, y + 8, 1, '#14F195', 'left');
      if (p2) text(ctx, sel.ready[1] ? 'P2 OK' : 'P2', x + 98, y + 8, 1, '#ffd24a', 'right');
      hotspot(x, y, 106, 210, 'pick:' + i);
    });
    text(ctx, 'P1 A/D + SPACE    P2 ARROWS + ENTER', W / 2, 560, 1, '#b7a8d4', 'center');
    text(ctx, 'TAP A PORTRAIT TO LOCK P1, THEN P2', W / 2, 576, 1, '#b7a8d4', 'center');
    menuItem(ctx, 'BACK', 740, false, 'back');
  }

  function drawIntro(game) {
    const ctx = PZ.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(30, 220, 420, 250);
    ctx.strokeStyle = '#ffd24a';
    ctx.lineWidth = 4;
    ctx.strokeRect(30, 220, 420, 250);
    const pulse = 3 + (Math.sin((game.t || 0) * 10) > 0 ? 1 : 0);
    text(ctx, "LET'S GET READY", W / 2, 240, 2, '#ffd24a', 'center', '#140818');
    text(ctx, 'TO RUMBLE!', W / 2, 270, pulse, '#ff3ec8', 'center', '#140818');
    const a = game.players[0];
    const b = game.players[1];
    if (a && b) {
      text(ctx, a.def.name, W / 2, 330, 3, '#14F195', 'center', '#042');
      text(ctx, 'VS', W / 2, 362, 2, '#f4efe2', 'center');
      text(ctx, b.def.name, W / 2, 390, 3, '#ffd24a', 'center', '#140818');
      const line = game.mode === 1 ? b.def.intro : a.def.nickname + '  VS  ' + b.def.nickname;
      const lines = PZ.font.wrap(line, 26);
      lines.forEach(function (ln, i) {
        text(ctx, ln, W / 2, 430 + i * 16, 1, '#f4efe2', 'center');
      });
    }
  }

  function drawCount(game) {
    const ctx = PZ.ctx;
    const n = game.count || 0;
    text(ctx, n === 0 ? 'DOWN' : String(n), W / 2, 250, 8, '#f4efe2', 'center', '#140818');
    text(ctx, 'GET UP!', W / 2, 330, 3, '#ffd24a', 'center', '#140818');
    const f = game.players[game.downIndex];
    if (!f) return;
    meter(ctx, 120, 370, 240, 14, (f.getUp || 0) / 100, '#14F195', '#123');
    text(ctx, 'MASH PUNCHES', W / 2, 392, 1, '#f4efe2', 'center');
    text(ctx, 'KD ' + f.kd + ' / 3 THIS ROUND', W / 2, 412, 1, '#ff9ab0', 'center');
  }

  function drawCardUi(game) {
    const ctx = PZ.ctx;
    text(ctx, 'ROUND ' + (game.round) + ' OVER', W / 2, 96, 2, '#ffd24a', 'center', '#140818');
    if (game.scores && game.scores.length) {
      const last = game.scores[game.scores.length - 1];
      text(ctx, last.a + '  -  ' + last.b, W / 2, 120, 2, '#f4efe2', 'center', '#140818');
    }
  }

  function drawPause(game) {
    const ctx = PZ.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, W, H);
    text(ctx, 'PAUSED', W / 2, 250, 4, '#ffd24a', 'center', '#140818');
    const items = [['RESUME', 'resume'], ['CONTROLS', 'controls'], ['QUIT', 'quit']];
    items.forEach(function (item, i) {
      menuItem(ctx, item[0], 330 + i * 52, game.menuIndex === i, item[1]);
    });
  }

  function drawResult(game) {
    const ctx = PZ.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(20, 150, 440, 460);
    ctx.strokeStyle = '#ffd24a';
    ctx.lineWidth = 4;
    ctx.strokeRect(20, 150, 440, 460);
    const r = game.result || {};
    let headline = 'DECISION';
    if (r.type === 'ko') headline = 'KNOCKOUT';
    if (r.type === 'tko') headline = 'TKO';
    if (r.type === 'draw') headline = 'DRAW';
    text(ctx, headline, W / 2, 170, 3, '#ffd24a', 'center', '#140818');
    let who = 'NO CONTEST';
    if (r.winner === 0 || r.winner === 1) who = game.players[r.winner].def.name + ' WINS';
    if (r.type === 'draw') who = 'EVEN ON THE CARDS';
    text(ctx, who, W / 2, 210, 2, '#14F195', 'center', '#042');
    if (r.champion) text(ctx, 'NEW CIRCUIT CHAMPION', W / 2, 236, 1, '#ff3ec8', 'center');

    (game.scores || []).forEach(function (s, i) {
      text(ctx, 'R' + (i + 1) + '   ' + s.a + ' - ' + s.b, W / 2, 270 + i * 20, 2, '#f4efe2', 'center');
    });
    if (r.total) text(ctx, 'TOTAL  ' + r.total, W / 2, 340, 2, '#ffd24a', 'center', '#140818');

    const items = game.resultMenu || [['TITLE', 'title']];
    items.forEach(function (item, i) {
      menuItem(ctx, item[0], 420 + i * 52, game.menuIndex === i, item[1]);
    });
  }

  function paintFrame(ctx, game, arenaOnly) {
    PZ.ctx = ctx;
    PZ.hotspots = [];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    if (game.shake > 0) {
      const m = game.shake * 18;
      ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
    }
    if (game.state === 'title') drawTitle(game);
    else if (game.state === 'controls') drawControls(game);
    else if (game.state === 'select') drawSelect(game);
    else {
      drawArena(game);
      if (!arenaOnly) {
        if (game.state === 'intro') drawIntro(game);
        if (game.state === 'down') drawCount(game);
        if (game.state === 'card') drawCardUi(game);
        if (game.state === 'fight' || game.state === 'down' || game.state === 'card' || game.state === 'intro') drawHUD(game);
        if (game.state === 'pause') {
          drawHUD(game);
          drawPause(game);
        }
        if (game.state === 'result') drawResult(game);
      }
    }
  }

  let offscreen = null;
  function offscreenCanvas() {
    if (!offscreen) {
      offscreen = document.createElement('canvas');
      offscreen.width = W;
      offscreen.height = H;
    }
    return offscreen;
  }

  /* Backdrop gradient sampled the same way as the portrait arena. */
  function backdropRGB(t) {
    const stops = [
      [0, [7, 6, 15]],
      [0.35, [26, 10, 50]],
      [0.7, [20, 8, 31]],
      [1, [9, 6, 15]]
    ];
    const u = Math.max(0, Math.min(1, t));
    let i = 0;
    while (i < stops.length - 1 && u > stops[i + 1][0]) i++;
    const a = stops[i];
    const b = stops[Math.min(stops.length - 1, i + 1)];
    const k = a[0] === b[0] ? 0 : (u - a[0]) / (b[0] - a[0]);
    const c = a[1].map(function (v, n) { return Math.round(v + (b[1][n] - v) * k); });
    return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
  }

  function fillArenaWings(ctx, dw, dh, sy, srcH) {
    const g = ctx.createLinearGradient(0, 0, 0, dh);
    g.addColorStop(0, backdropRGB(sy / H));
    g.addColorStop(0.5, backdropRGB((sy + srcH * 0.5) / H));
    g.addColorStop(1, backdropRGB((sy + srcH) / H));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, dw, dh);
    ctx.fillStyle = '#f4efe2';
    for (let i = 0; i < 48; i++) {
      const x = (i * 97) % Math.max(1, dw);
      const y = ((i * 53) % Math.max(1, Math.floor(dh * 0.45)));
      ctx.globalAlpha = 0.28 + (i % 3) * 0.12;
      ctx.fillRect(x, y, (i % 2) + 1, (i % 2) + 1);
    }
    ctx.globalAlpha = 1;
    for (let row = 0; row < 7; row++) {
      const y = dh * 0.12 + row * Math.max(14, dh * 0.045);
      for (let x = 10; x < dw; x += 16) {
        ctx.fillStyle = (x + row) % 3 === 0 ? '#3a1868' : '#2a1248';
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = (x + row) % 5 === 0 ? '#ffd0f0' : '#c9a0d8';
        ctx.fillRect(x - 1, y - 1, 2, 2);
      }
    }
  }

  function drawLandscapeChrome(ctx, game, dw, dh) {
    const sc = dw / Math.max(1, window.innerWidth || dw);
    ctx.save();
    ctx.setTransform(sc, 0, 0, sc, 0, 0);
    const w = dw / sc;
    const h = dh / sc;
    const bar = 54;
    ctx.fillStyle = 'rgba(8, 4, 16, 0.82)';
    ctx.fillRect(0, 0, w, bar);
    ctx.fillStyle = '#ffd24a';
    ctx.fillRect(0, bar - 2, w, 2);
    const a = game.players[0];
    const b = game.players[1];
    if (a && b) {
      text(ctx, a.def.name, 10, 4, 1, '#14F195', 'left', '#042');
      text(ctx, b.def.name, w - 10, 4, 1, '#ffd24a', 'right', '#140818');
      drawHeartsRow(ctx, 10, 16, a.hp, a.maxHp);
      drawHeartsRow(ctx, w - 10 - 8 * 16, 16, b.hp, b.maxHp);
      const clock = formatClock(game.clock);
      const urgent = game.clock <= 10 && game.state === 'fight';
      text(ctx, 'R' + game.round + '  ' + clock, w / 2, 4, 2, urgent ? '#ff3355' : '#ffd24a', 'center', '#140818');
      meter(ctx, 10, 36, 90, 7, a.stam / a.maxStam, '#3af', '#123');
      meter(ctx, w - 100, 36, 90, 7, b.stam / b.maxStam, '#3af', '#123');
      drawStars(ctx, 108, 32, a.stars || 0);
      drawStars(ctx, w - 100 - 48, 32, b.stars || 0);
    }
    if (game.banner && game.banner.age < game.banner.dur) {
      text(ctx, game.banner.text, w / 2, bar + 10, 3, '#ffd24a', 'center', '#140818');
    }
    if (game.flashBanner && game.flashBanner.age < game.flashBanner.dur) {
      text(ctx, game.flashBanner.text, w / 2, bar + 48, 2, '#fff6c2', 'center', '#5a2080');
    }
    if (game.state === 'intro' && a && b) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(w / 2 - 210, h * 0.28, 420, 150);
      ctx.strokeStyle = '#ffd24a';
      ctx.lineWidth = 4;
      ctx.strokeRect(w / 2 - 210, h * 0.28, 420, 150);
      text(ctx, "LET'S GET READY", w / 2, h * 0.28 + 16, 2, '#ffd24a', 'center', '#140818');
      text(ctx, a.def.name, w / 2, h * 0.28 + 48, 2, '#14F195', 'center', '#042');
      text(ctx, 'VS', w / 2, h * 0.28 + 74, 2, '#f4efe2', 'center');
      text(ctx, b.def.name, w / 2, h * 0.28 + 100, 2, '#ffd24a', 'center', '#140818');
    }
    if (game.state === 'down') {
      const n = game.count || 0;
      const f = game.players[game.downIndex];
      text(ctx, n === 0 ? 'DOWN' : String(n), w / 2, bar + 8, 4, '#f4efe2', 'center', '#140818');
      text(ctx, 'GET UP!', w / 2, bar + 52, 2, '#ffd24a', 'center', '#140818');
      if (f) {
        meter(ctx, w / 2 - 90, bar + 80, 180, 12, (f.getUp || 0) / 100, '#14F195', '#123');
        text(ctx, 'MASH PUNCHES', w / 2, bar + 98, 1, '#f4efe2', 'center');
      }
    }
    if (game.state === 'card') {
      text(ctx, 'ROUND ' + game.round + ' OVER', w / 2, bar + 8, 2, '#ffd24a', 'center', '#140818');
      if (game.scores && game.scores.length) {
        const last = game.scores[game.scores.length - 1];
        text(ctx, last.a + '  -  ' + last.b, w / 2, bar + 32, 2, '#f4efe2', 'center', '#140818');
      }
    }
    if (game.state === 'fight' && game.mode === 1 && b && b.tell && b.def.rank <= 2) {
      text(ctx, hintFor(b.tell), w / 2, h - 18, 1, '#fff', 'center', '#140818');
    }
    ctx.restore();
  }

  /* Phone landscape: the canvas element fills the safe viewport. The fight is
     scaled uniformly around the ring so fighters stay in proportion, and the
     arena crowd continues into the side space. Menus fit the whole portrait
     frame inside that full-screen canvas. */
  function presentLandscape(screen, off, game, fightLike) {
    const dw = screen.canvas.width;
    const dh = screen.canvas.height;
    screen.setTransform(1, 0, 0, 1, 0, 0);
    screen.imageSmoothingEnabled = true;
    if (!fightLike) {
      const s = Math.min(dw / W, dh / H);
      const bw = Math.round(W * s);
      const bh = Math.round(H * s);
      const ox = Math.round((dw - bw) / 2);
      const oy = Math.round((dh - bh) / 2);
      fillArenaWings(screen, dw, dh, 0, H);
      screen.drawImage(off, 0, 0, W, H, ox, oy, bw, bh);
      PZ.presentRect = { ox: ox, oy: oy, bw: bw, bh: bh };
      PZ.screenToGame = function (x, y) {
        return { x: (x - ox) / s, y: (y - oy) / s };
      };
      return;
    }
    const ry = PZ.VIEW.ringC.rx * Math.sin(PZ.VIEW.elev);
    const top = Math.max(0, Math.round(PZ.VIEW.ringC.y - ry - 168));
    const bot = Math.min(H, Math.round(PZ.VIEW.ringC.y + ry + 88));
    const sy = top;
    const srcH = Math.max(1, bot - top);
    let s = dh / srcH;
    let bw = W * s;
    let bh = dh;
    if (bw > dw) {
      s = dw / W;
      bw = dw;
      bh = srcH * s;
    }
    const ox = Math.round((dw - bw) / 2);
    const oy = Math.round((dh - bh) / 2);
    fillArenaWings(screen, dw, dh, sy, srcH);
    const destW = Math.round(bw);
    const destH = Math.round(bh);
    screen.drawImage(off, 0, sy, W, srcH, ox, oy, destW, destH);
    /* Soften the join between the centered ring view and the side crowd. */
    screen.save();
    screen.globalCompositeOperation = 'destination-out';
    const fade = Math.min(22, Math.round(destW * 0.05));
    const leftFade = screen.createLinearGradient(ox, 0, ox + fade, 0);
    leftFade.addColorStop(0, 'rgba(0,0,0,1)');
    leftFade.addColorStop(1, 'rgba(0,0,0,0)');
    screen.fillStyle = leftFade;
    screen.fillRect(ox, oy, fade, destH);
    const rightFade = screen.createLinearGradient(ox + destW, 0, ox + destW - fade, 0);
    rightFade.addColorStop(0, 'rgba(0,0,0,1)');
    rightFade.addColorStop(1, 'rgba(0,0,0,0)');
    screen.fillStyle = rightFade;
    screen.fillRect(ox + destW - fade, oy, fade, destH);
    screen.restore();
    PZ.presentRect = { ox: ox, oy: oy, bw: Math.round(bw), bh: Math.round(bh) };
    PZ.screenToGame = function (x, y) {
      return { x: (x - ox) / s, y: sy + (y - oy) / s };
    };
    screen.imageSmoothingEnabled = false;
    drawLandscapeChrome(screen, game, dw, dh);
  }

  PZ.drawFrame = function (game) {
    const screen = PZ.screenCtx || PZ.ctx;
    if (!screen) return;
    PZ.screenCtx = screen;
    const landscape = document.body.classList.contains('phone-landscape');
    if (!landscape) {
      PZ.presentRect = null;
      PZ.screenToGame = null;
      paintFrame(screen, game, false);
      PZ.ctx = screen;
      return;
    }
    const off = offscreenCanvas();
    const fightLike = game.state === 'fight' || game.state === 'down' || game.state === 'card' || game.state === 'intro';
    paintFrame(off.getContext('2d'), game, fightLike);
    presentLandscape(screen, off, game, fightLike);
    PZ.ctx = screen;
  };

  PZ.formatClock = formatClock;
})();
