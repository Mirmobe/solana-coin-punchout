/* Chiptune-ish WebAudio: bell, punches, crowd, announcer stinger. */
(function () {
  'use strict';
  const PZ = (window.PZ = window.PZ || {});

  const Audio = {
    ctx: null,
    master: null,
    crowdGain: null,
    muted: false,
    unlocked: false,

    ensure: function () {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') {
          this.ctx.resume().catch(function () {});
        }
        return true;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      try {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.42;
        this.master.connect(this.ctx.destination);
        this.startCrowd();
        return true;
      } catch (err) {
        return false;
      }
    },

    unlock: function () {
      this.unlocked = true;
      this.ensure();
    },

    setMuted: function (m) {
      this.muted = m;
      if (this.master) this.master.gain.value = m ? 0 : 0.42;
    },

    envGain: function (t, vol, attack, dur) {
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      return g;
    },

    tone: function (freq, dur, type, vol, delay, slide) {
      if (!this.ensure() || this.muted) return;
      const t = this.ctx.currentTime + (delay || 0);
      const o = this.ctx.createOscillator();
      o.type = type || 'square';
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, slide), t + dur);
      const g = this.envGain(t, vol == null ? 0.08 : vol, 0.008, dur);
      o.connect(g);
      g.connect(this.master);
      o.start(t);
      o.stop(t + dur + 0.02);
    },

    noise: function (dur, vol, freq) {
      if (!this.ensure() || this.muted) return;
      const ctx = this.ctx;
      const n = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buf = ctx.createBuffer(1, n, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = freq || 900;
      const g = ctx.createGain();
      g.gain.value = vol == null ? 0.2 : vol;
      src.connect(f);
      f.connect(g);
      g.connect(this.master);
      src.start();
    },

    startCrowd: function () {
      const ctx = this.ctx;
      const len = Math.floor(ctx.sampleRate * 2);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;
        d[i] = last * 4;
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 700;
      filter.Q.value = 0.6;
      const gain = ctx.createGain();
      gain.gain.value = 0.02;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start();
      this.crowdGain = gain;
    },

    swell: function (amount, dur) {
      if (!this.crowdGain || !this.ctx || this.muted) return;
      const t = this.ctx.currentTime;
      const g = this.crowdGain.gain;
      const base = 0.02;
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(base + amount, t + 0.08);
      g.linearRampToValueAtTime(base, t + (dur || 0.8));
    },

    bell: function (times) {
      const n = times || 1;
      for (let i = 0; i < n; i++) this.bellOnce(i * 0.38);
    },

    bellOnce: function (delay) {
      if (!this.ensure() || this.muted) return;
      const t0 = this.ctx.currentTime + (delay || 0);
      const partials = [1, 2.01, 2.76, 3.94, 5.2];
      partials.forEach((ratio, i) => {
        const o = this.ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = 640 * ratio;
        const g = this.ctx.createGain();
        const vol = 0.18 / (i + 1);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.35);
        o.connect(g);
        g.connect(this.master);
        o.start(t0);
        o.stop(t0 + 1.4);
      });
      this.swell(0.03, 0.6);
    },

    swing: function (kind) {
      if (kind === 'star') {
        this.tone(220, 0.08, 'square', 0.06, 0, 440);
        this.tone(660, 0.12, 'square', 0.05, 0.06, 880);
        this.noise(0.1, 0.12, 1400);
        return;
      }
      const f = kind === 'jab' ? 210 : kind === 'body' ? 160 : kind === 'hook' ? 140 : 120;
      this.tone(f, 0.07, 'square', 0.05, 0, f * 0.6);
      this.noise(0.05, 0.08, 1200);
    },

    hit: function (kind) {
      const heavy = kind === 'hook' || kind === 'upper' || kind === 'star';
      this.noise(heavy ? 0.16 : 0.08, heavy ? 0.28 : 0.16, heavy ? 500 : 800);
      this.tone(heavy ? 90 : 140, heavy ? 0.16 : 0.09, 'square', heavy ? 0.1 : 0.07, 0, 50);
      if (kind === 'star') {
        [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.12, 'square', 0.06, i * 0.07));
        this.swell(0.08, 0.9);
      } else if (heavy) {
        this.swell(0.05, 0.45);
      }
    },

    block: function () {
      this.tone(180, 0.06, 'square', 0.06, 0, 90);
      this.noise(0.05, 0.08, 400);
    },

    whiff: function () {
      this.noise(0.09, 0.07, 1800);
      this.tone(720, 0.05, 'square', 0.03, 0, 400);
    },

    dodge: function () {
      this.tone(520, 0.05, 'square', 0.04, 0, 760);
    },

    tired: function () {
      this.tone(80, 0.08, 'square', 0.04, 0, 50);
    },

    kd: function () {
      this.tone(160, 0.3, 'square', 0.1, 0, 50);
      this.noise(0.25, 0.2, 300);
      this.swell(0.1, 1.2);
    },

    countBeep: function () {
      this.tone(440, 0.09, 'square', 0.07);
    },

    mash: function () {
      this.tone(300 + Math.random() * 80, 0.03, 'square', 0.03);
    },

    getup: function () {
      this.tone(392, 0.08, 'square', 0.06, 0);
      this.tone(523, 0.1, 'square', 0.06, 0.08);
    },

    ko: function () {
      [440, 370, 311, 247, 196].forEach((f, i) => this.tone(f, 0.22, 'square', 0.08, i * 0.14));
      this.swell(0.12, 1.6);
    },

    win: function () {
      [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.16, 'square', 0.07, i * 0.12));
      this.swell(0.08, 1.2);
    },

    lose: function () {
      [392, 349, 311, 262].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.07, i * 0.14));
    },

    ui: function () {
      this.tone(660, 0.04, 'square', 0.04);
    },

    confirm: function () {
      this.tone(523, 0.06, 'square', 0.05, 0);
      this.tone(784, 0.08, 'square', 0.05, 0.06);
    },

    rumble: function () {
      if (!this.ensure() || this.muted) return;
      const notes = [196, 262, 330, 392, 523];
      notes.forEach((f, i) => this.tone(f, 0.18, 'square', 0.07, i * 0.11));
      this.tone(98, 0.5, 'sawtooth', 0.05, 0.55, 70);
      this.noise(0.45, 0.1, 240);
      this.swell(0.07, 1.1);
      this.speakRumble();
    },

    speakRumble: function () {
      try {
        if (navigator.webdriver) return;
        if (!window.speechSynthesis || document.hidden) return;
        const u = new SpeechSynthesisUtterance("Let's get ready to rumble!");
        u.rate = 0.92;
        u.pitch = 0.55;
        u.volume = 0.9;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
      } catch (err) {
        /* speech is optional */
      }
    }
  };

  PZ.audio = Audio;
})();
