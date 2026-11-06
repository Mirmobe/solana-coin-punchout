/* Keyboard, on-screen touch, and standard-mapping gamepads (Xbox layout). */
(function () {
  'use strict';
  const PZ = (window.PZ = window.PZ || {});

  const PUNCHES = ['jabL', 'jabR', 'bodyL', 'bodyR', 'hookL', 'hookR', 'upper'];

  function emptySnap() {
    return {
      dodgeL: false, dodgeR: false, duck: false, block: false,
      jabL: false, jabR: false, bodyL: false, bodyR: false,
      hookL: false, hookR: false, upper: false,
      pause: false, confirm: false, back: false, mash: false,
      up: false, down: false, left: false, right: false,
      moveX: 0, moveY: 0
    };
  }

  const Input = {
    keys: new Set(),
    keyEdge: new Set(),
    touchHold: [{}, {}],
    touchEdge: [new Set(), new Set()],
    stick: [
      { x: 0, y: 0, on: false, pointerId: null, ox: 0, oy: 0 },
      { x: 0, y: 0, on: false, pointerId: null, ox: 0, oy: 0 }
    ],
    prevButtons: [[], []],
    stickPrev: [{ x: 0, y: 0 }, { x: 0, y: 0 }],
    padCount: 0,

    bind: function () {
      const self = this;
      window.addEventListener('keydown', function (e) {
        const k = e.key.toLowerCase();
        if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'enter', 'w', 'a', 's', 'd', 'q', 'e', 'x'].indexOf(k) >= 0) {
          e.preventDefault();
        }
        if (e.repeat) return;
        if (!self.keys.has(k)) self.keyEdge.add(k);
        self.keys.add(k);
      });
      window.addEventListener('keyup', function (e) {
        self.keys.delete(e.key.toLowerCase());
      });
      window.addEventListener('blur', function () {
        self.keys.clear();
      });
      document.querySelectorAll('#touch [data-act]').forEach(function (btn) {
        const player = Number(btn.closest('[data-p]').getAttribute('data-p'));
        const act = btn.getAttribute('data-act');
        function down(e) {
          e.preventDefault();
          try { btn.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
          btn.classList.add('held');
          self.touchDown(player, act);
        }
        function up(e) {
          btn.classList.remove('held');
          self.touchUp(player, act);
        }
        btn.addEventListener('pointerdown', down);
        btn.addEventListener('pointerup', up);
        btn.addEventListener('pointercancel', up);
      });
      this.bindSticks();
    },

    /* Floating thumbstick. The base appears where the thumb lands and dragging steers. */
    bindSticks: function () {
      const self = this;
      const maxR = 38;
      document.querySelectorAll('.stick-zone').forEach(function (zone) {
        zone.addEventListener('pointerdown', function (e) {
          if (!document.body.classList.contains('stick-live')) return;
          const player = Number(zone.getAttribute('data-p'));
          if (self.stick[player].on) return;
          e.preventDefault();
          e.stopPropagation();
          const s = self.stick[player];
          s.pointerId = e.pointerId;
          s.ox = e.clientX;
          s.oy = e.clientY;
          s.x = 0;
          s.y = 0;
          s.on = true;
          self.placeStick(player, e.clientX, e.clientY, 0, 0);
          try { zone.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        });
      });
      window.addEventListener('pointermove', function (e) {
        for (let p = 0; p < 2; p++) {
          const s = self.stick[p];
          if (!s.on || s.pointerId !== e.pointerId) continue;
          e.preventDefault();
          let dx = e.clientX - s.ox;
          let dy = e.clientY - s.oy;
          const mag = Math.hypot(dx, dy);
          if (mag > maxR) {
            dx = dx / mag * maxR;
            dy = dy / mag * maxR;
          }
          let mx = dx / maxR;
          let my = dy / maxR;
          if (Math.hypot(mx, my) < 0.2) { mx = 0; my = 0; }
          s.x = mx;
          s.y = my;
          self.placeStick(p, s.ox, s.oy, dx, dy);
        }
      });
      const endStick = function (e) {
        for (let p = 0; p < 2; p++) {
          const s = self.stick[p];
          if (!s.on) continue;
          if (e && s.pointerId !== e.pointerId) continue;
          self.setStick(p, 0, 0, false);
        }
      };
      window.addEventListener('pointerup', endStick);
      window.addEventListener('pointercancel', endStick);
      window.addEventListener('blur', function () { endStick(null); });
    },

    setStick: function (player, x, y, on) {
      const s = this.stick[player];
      if (!s) return;
      s.x = on ? x : 0;
      s.y = on ? y : 0;
      s.on = !!on;
      if (!on) {
        s.pointerId = null;
        this.hideStick(player);
      }
    },

    clearSticks: function () {
      this.setStick(0, 0, 0, false);
      this.setStick(1, 0, 0, false);
    },

    placeStick: function (player, ox, oy, dx, dy) {
      const fit = document.querySelector('.stick-fit');
      const vis = document.querySelector('.stick-vis[data-p="' + player + '"]');
      if (!fit || !vis) return;
      const root = fit.getBoundingClientRect();
      vis.classList.add('on');
      vis.style.left = (ox - root.left) + 'px';
      vis.style.top = (oy - root.top) + 'px';
      const nub = vis.querySelector('.stick-nub');
      if (nub) nub.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    },

    hideStick: function (player) {
      const vis = document.querySelector('.stick-vis[data-p="' + player + '"]');
      if (!vis) return;
      vis.classList.remove('on');
      const nub = vis.querySelector('.stick-nub');
      if (nub) nub.style.transform = 'translate(0px,0px)';
    },

    touchDown: function (player, act) {
      if (!this.touchHold[player][act]) this.touchEdge[player].add(act);
      this.touchHold[player][act] = true;
    },

    touchUp: function (player, act) {
      this.touchHold[player][act] = false;
    },

    endFrame: function () {
      this.keyEdge.clear();
      this.touchEdge[0].clear();
      this.touchEdge[1].clear();
      this._cached = null;
    },

    heldKey: function (list) {
      for (let i = 0; i < list.length; i++) if (this.keys.has(list[i])) return true;
      return false;
    },

    edgeKey: function (list) {
      for (let i = 0; i < list.length; i++) if (this.keyEdge.has(list[i])) return true;
      return false;
    },

    /* Standard gamepad: A0 B1 X2 Y3 LB4 RB5 LT6 RT7 Back8 Start9 Dpad 12-15. */
    readPads: function () {
      const found = [];
      try {
        const native = navigator.getGamepads ? navigator.getGamepads() : [];
        if (native) {
          for (let i = 0; i < native.length; i++) {
            if (native[i]) found.push(native[i]);
          }
        }
      } catch (err) { /* some browsers throw if gamepads are blocked */ }
      const fake = window.__fakeGamepads;
      if (fake && fake.length) {
        for (let i = 0; i < fake.length; i++) {
          if (fake[i] && fake[i].connected !== false) found.push(fake[i]);
        }
      }
      this.padCount = found.length;
      return found;
    },

    padSnap: function (pad, index) {
      const snap = emptySnap();
      if (!pad) return snap;
      const b = pad.buttons || [];
      const pressed = function (i) { return !!(b[i] && b[i].pressed); };
      const edge = function (i) {
        const now = pressed(i);
        const prev = !!this.prevButtons[index][i];
        this.prevButtons[index][i] = now;
        return now && !prev;
      }.bind(this);

      const ax = pad.axes || [0, 0, 0, 0];
      const sx = ax[0] || 0;
      const sy = ax[1] || 0;
      const prev = this.stickPrev[index];
      const moveDead = 0.18;
      prev.x = sx;
      prev.y = sy;
      snap.moveX = Math.abs(sx) > moveDead ? Math.max(-1, Math.min(1, sx)) : 0;
      snap.moveY = Math.abs(sy) > moveDead ? Math.max(-1, Math.min(1, sy)) : 0;

      snap.dodgeL = edge(14);
      snap.dodgeR = edge(15);
      snap.duck = pressed(13);
      snap.block = pressed(12) && !pressed(13);
      snap.up = edge(12);
      snap.down = edge(13);
      snap.left = edge(14);
      snap.right = edge(15);

      snap.jabL = edge(0);
      snap.jabR = edge(1);
      snap.hookL = edge(2);
      snap.hookR = edge(3);
      snap.bodyL = edge(4);
      snap.upper = edge(5) || edge(7);
      snap.bodyR = edge(6);
      snap.pause = edge(9);
      snap.confirm = edge(0) || edge(9);
      snap.back = edge(1);
      snap.mash = snap.jabL || snap.jabR || snap.hookL || snap.hookR || snap.bodyL || snap.bodyR || snap.upper;
      return snap;
    },

    keySnap: function (scheme) {
      const snap = emptySnap();
      const edge = this.edgeKey.bind(this);
      const held = this.heldKey.bind(this);
      snap.dodgeL = edge(scheme.dodgeL);
      snap.dodgeR = edge(scheme.dodgeR);
      snap.duck = held(scheme.duck);
      snap.block = held(scheme.block);
      snap.moveX = (held(scheme.moveR || []) ? 1 : 0) - (held(scheme.moveL || []) ? 1 : 0);
      snap.moveY = (held(scheme.moveD || []) ? 1 : 0) - (held(scheme.moveU || []) ? 1 : 0);
      snap.jabL = edge(scheme.jabL);
      snap.jabR = edge(scheme.jabR);
      snap.bodyL = edge(scheme.bodyL);
      snap.bodyR = edge(scheme.bodyR);
      snap.hookL = edge(scheme.hookL);
      snap.hookR = edge(scheme.hookR);
      snap.upper = edge(scheme.upper);
      snap.pause = edge(scheme.pause || []);
      snap.confirm = edge(scheme.confirm || []);
      snap.back = edge(scheme.back || []);
      snap.up = edge(scheme.moveU || scheme.block || []);
      snap.down = edge(scheme.moveD || scheme.duck || []);
      snap.left = edge(scheme.moveL || []);
      snap.right = edge(scheme.moveR || []);
      PUNCHES.forEach(function (p) { if (snap[p]) snap.mash = true; });
      return snap;
    },

    touchSnap: function (player) {
      const snap = emptySnap();
      const hold = this.touchHold[player];
      const edge = this.touchEdge[player];
      snap.dodgeL = edge.has('dodgeL');
      snap.dodgeR = edge.has('dodgeR');
      snap.duck = !!hold.duck;
      snap.block = !!hold.block;
      if (this.stick[player].on) {
        snap.moveX = this.stick[player].x;
        snap.moveY = this.stick[player].y;
      } else {
        snap.moveX = (hold.moveR ? 1 : 0) - (hold.moveL ? 1 : 0);
        snap.moveY = (hold.moveD ? 1 : 0) - (hold.moveU ? 1 : 0);
      }
      PUNCHES.forEach(function (p) { snap[p] = edge.has(p); });
      snap.up = edge.has('moveU') || edge.has('block');
      snap.down = edge.has('moveD') || edge.has('duck');
      snap.left = edge.has('moveL') || snap.dodgeL;
      snap.right = edge.has('moveR') || snap.dodgeR;
      snap.confirm = edge.has('jabL') || edge.has('upper');
      snap.back = edge.has('jabR');
      PUNCHES.forEach(function (p) { if (snap[p]) snap.mash = true; });
      return snap;
    },

    merge: function (a, b) {
      const o = emptySnap();
      Object.keys(o).forEach(function (k) {
        if (k === 'moveX' || k === 'moveY') {
          const av = Number(a[k]) || 0;
          const bv = Number(b[k]) || 0;
          o[k] = Math.abs(av) >= Math.abs(bv) ? av : bv;
        } else o[k] = !!(a[k] || b[k]);
      });
      return o;
    },

    /* scheme ids: p1 uses WASD+FG, p2 uses arrows. In 1P both schemes drive player 0.
       Pad edges are sampled once per frame so player 2 is not consumed by player 1. */
    ensureCache: function (mode) {
      if (this._cached) return this._cached;
      const pads = this.readPads();
      const p1scheme = mode === 2
        ? Object.assign({}, SCHEMES.p1, { confirm: [' '] })
        : SCHEMES.p1;
      const p2scheme = mode === 2
        ? Object.assign({}, SCHEMES.p2, { confirm: ['enter'] })
        : SCHEMES.p2;
      this._cached = {
        p1keys: this.keySnap(p1scheme),
        p2keys: this.keySnap(p2scheme),
        t0: this.touchSnap(0),
        t1: this.touchSnap(1),
        pad0: this.padSnap(pads[0], 0),
        pad1: pads[1] ? this.padSnap(pads[1], 1) : emptySnap()
      };
      return this._cached;
    },

    snapshot: function (player, mode) {
      const c = this.ensureCache(mode);
      if (mode !== 2) {
        if (player !== 0) return emptySnap();
        return this.merge(this.merge(this.merge(c.p1keys, c.p2keys), this.merge(c.t0, c.t1)), this.merge(c.pad0, c.pad1));
      }
      if (player === 0) return this.merge(this.merge(c.p1keys, c.t0), c.pad0);
      return this.merge(this.merge(c.p2keys, c.t1), c.pad1);
    }
  };

  const SCHEMES = {
    p1: {
      moveL: ['a'],
      moveR: ['d'],
      moveU: ['w'],
      moveD: ['s'],
      dodgeL: ['q'],
      dodgeR: ['e'],
      duck: ['x'],
      block: ['shift'],
      jabL: ['f', 'j'],
      jabR: ['g'],
      hookL: ['r', 'u'],
      hookR: ['t'],
      bodyL: ['c', 'h'],
      bodyR: ['v'],
      upper: [' '],
      pause: ['p', 'escape'],
      confirm: ['enter', ' '],
      back: ['escape', 'backspace']
    },
    p2: {
      moveL: ['arrowleft'],
      moveR: ['arrowright'],
      moveU: ['arrowup'],
      moveD: ['arrowdown'],
      dodgeL: ['n'],
      dodgeR: ['m'],
      duck: [']'],
      block: ['['],
      jabL: ['k'],
      jabR: ['l'],
      hookL: ['i'],
      hookR: ['o'],
      bodyL: [','],
      bodyR: ['.'],
      upper: ['enter', '/'],
      pause: [],
      confirm: [],
      back: []
    }
  };

  /* In 1-player, arrows also belong to the human. snapshot() merges both schemes. */

  PZ.input = Input;
  PZ.SCHEMES = SCHEMES;
})();
