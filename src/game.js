const TAU = Math.PI * 2;
const GRAVITY = 0.08;
const DRAG = 0.97;
const ROCKET_SPEED = 18;
const MAX_PARTICLES = 1200;
const BURST_COUNT_MIN = 80;
const BURST_COUNT_MAX = 120;
const COMBO_WINDOW_MS = 1500;
const BOTTOM_GUARD = 80;

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}

class Particle {
  constructor(x, y, opts) {
    this.x = x;
    this.y = y;
    this.vx = opts.vx ?? 0;
    this.vy = opts.vy ?? 0;
    this.hue = opts.hue ?? 0;
    this.sat = opts.sat ?? 100;
    this.light = opts.light ?? 65;
    this.alpha = opts.alpha ?? 1;
    this.alphaDecay = opts.alphaDecay ?? 0.012;
    this.radius = opts.radius ?? 3;
    this.radiusDecay = opts.radiusDecay ?? 0.98;
    this.gravity = opts.gravity ?? GRAVITY;
    this.drag = opts.drag ?? DRAG;
    this.isTail = opts.isTail ?? false;
  }

  update() {
    this.vy += this.gravity;
    this.vx *= this.drag;
    this.vy *= this.drag;
    this.x += this.vx;
    this.y += this.vy;
    this.alpha -= this.alphaDecay;
    this.radius *= this.radiusDecay;
  }

  get dead() {
    return this.alpha <= 0 || this.radius < 0.3;
  }
}

class ScoreLabel {
  constructor(x, y, text) {
    this.x = x;
    this.y = y;
    this.text = text;
    this.alpha = 1;
    this.vy = -1.2;
  }

  update() {
    this.y += this.vy;
    this.alpha -= 0.016;
  }

  get dead() {
    return this.alpha <= 0;
  }
}

class Rocket {
  constructor(x, y, targetX, targetY, hue) {
    this.x = x;
    this.y = y;
    this.targetX = targetX;
    this.targetY = targetY;
    this.hue = hue;
    this.done = false;
    this._tailTimer = 0;

    const angle = Math.atan2(targetY - y, targetX - x);
    this.vx = Math.cos(angle) * ROCKET_SPEED;
    this.vy = Math.sin(angle) * ROCKET_SPEED;
  }

  update(particles) {
    this.x += this.vx;
    this.y += this.vy;

    this._tailTimer++;
    if (this._tailTimer >= 2) {
      this._tailTimer = 0;
      particles.push(new Particle(this.x, this.y, {
        vx: rand(-0.5, 0.5),
        vy: rand(-0.5, 0.5),
        hue: 45,
        sat: 100,
        light: 80,
        alpha: 0.8,
        alphaDecay: 0.045,
        radius: rand(1, 2),
        radiusDecay: 0.94,
        gravity: 0.02,
        drag: 0.95,
        isTail: true,
      }));
    }

    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    if (Math.sqrt(dx * dx + dy * dy) < ROCKET_SPEED) {
      this.done = true;
    }
  }

  burst(particles) {
    const count = randInt(BURST_COUNT_MIN, BURST_COUNT_MAX);

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * TAU + rand(-0.2, 0.2);
      const speed = rand(3, 10);
      particles.push(new Particle(this.targetX, this.targetY, {
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        hue: this.hue + rand(-15, 15),
        sat: rand(80, 100),
        light: rand(55, 75),
        alpha: 1,
        alphaDecay: rand(0.008, 0.018),
        radius: rand(2, 4),
        radiusDecay: 0.98,
        gravity: GRAVITY,
        drag: DRAG,
      }));
    }

    for (let i = 0; i < 30; i++) {
      const angle = rand(0, TAU);
      const speed = rand(0.5, 2.5);
      particles.push(new Particle(this.targetX, this.targetY, {
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        hue: this.hue + rand(-10, 10),
        sat: rand(90, 100),
        light: rand(60, 80),
        alpha: 1,
        alphaDecay: rand(0.005, 0.012),
        radius: rand(3, 6),
        radiusDecay: 0.97,
        gravity: GRAVITY * 0.7,
        drag: 0.94,
      }));
    }
  }
}

class Game {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.rockets = [];
    this.particles = [];
    this.scoreLabels = [];
    this.score = 0;
    this.combo = 1;
    this.lastBurstTime = 0;
    this.glowEnabled = true;
    this._frameCount = 0;
    this._lastFpsCheck = 0;
    this._fps = 60;
    this._lastTimestamp = 0;
  }

  init() {
    this.canvas = document.getElementById('canvas');
    this.ctx = this.canvas.getContext('2d');

    this._resize();
    window.addEventListener('resize', () => this._resize());
    this.canvas.addEventListener('click', (e) => this._onClick(e));
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      this._onClick({ clientX: t.clientX, clientY: t.clientY });
    }, { passive: false });

    requestAnimationFrame((ts) => this._frame(ts));
  }

  _resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  _onClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (y > this.canvas.height - BOTTOM_GUARD) return;

    const startX = this.canvas.width / 2 + rand(-40, 40);
    const startY = this.canvas.height;
    const hue = rand(0, 360);

    this.rockets.push(new Rocket(startX, startY, x, y, hue));
  }

  _addScore(targetX, targetY) {
    const now = Date.now();
    if (now - this.lastBurstTime < COMBO_WINDOW_MS) {
      this.combo = Math.min(this.combo + 1, 10);
    } else {
      this.combo = 1;
    }
    this.lastBurstTime = now;

    const points = 100 * this.combo;
    this.score += points;

    const label = this.combo > 1 ? `+${points} x${this.combo}` : `+${points}`;
    this.scoreLabels.push(new ScoreLabel(targetX, targetY - 20, label));
  }

  _frame(timestamp) {
    const dt = Math.min(timestamp - this._lastTimestamp, 50);
    this._lastTimestamp = timestamp;

    this._frameCount++;
    if (timestamp - this._lastFpsCheck > 1000) {
      this._fps = this._frameCount;
      this._frameCount = 0;
      this._lastFpsCheck = timestamp;
      this.glowEnabled = this._fps >= 45;
    }

    this._update();
    this._render();

    requestAnimationFrame((ts) => this._frame(ts));
  }

  _update() {
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const rocket = this.rockets[i];
      rocket.update(this.particles);
      if (rocket.done) {
        rocket.burst(this.particles);
        this._addScore(rocket.targetX, rocket.targetY);
        this.rockets.splice(i, 1);
      }
    }

    let i = this.particles.length;
    while (i--) {
      this.particles[i].update();
      if (this.particles[i].dead) {
        this.particles[i] = this.particles[this.particles.length - 1];
        this.particles.pop();
      }
    }

    if (this.particles.length > MAX_PARTICLES) {
      this.particles.splice(0, this.particles.length - MAX_PARTICLES);
    }

    i = this.scoreLabels.length;
    while (i--) {
      this.scoreLabels[i].update();
      if (this.scoreLabels[i].dead) {
        this.scoreLabels.splice(i, 1);
      }
    }
  }

  _render() {
    const { ctx, canvas } = this;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (this.glowEnabled) {
      ctx.shadowBlur = 8;
    }

    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.shadowColor = `hsl(${p.hue}, 100%, 70%)`;
      ctx.fillStyle = `hsl(${p.hue}, ${p.sat}%, ${p.light}%)`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, TAU);
      ctx.fill();
    }

    if (this.glowEnabled) {
      ctx.shadowBlur = 0;
    }

    ctx.globalAlpha = 1;

    for (const rocket of this.rockets) {
      ctx.fillStyle = 'white';
      ctx.shadowBlur = this.glowEnabled ? 6 : 0;
      ctx.shadowColor = 'white';
      ctx.beginPath();
      ctx.arc(rocket.x, rocket.y, 3, 0, TAU);
      ctx.fill();
    }

    ctx.shadowBlur = 0;

    this._renderHUD();
  }

  _renderHUD() {
    const { ctx, canvas } = this;

    for (const label of this.scoreLabels) {
      ctx.globalAlpha = Math.max(0, label.alpha);
      ctx.font = 'bold 18px monospace';
      ctx.fillStyle = 'white';
      ctx.textAlign = 'center';
      ctx.fillText(label.text, label.x, label.y);
    }

    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';

    ctx.font = 'bold 22px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText(`SCORE: ${this.score}`, 20, 38);

    const comboHue = Math.max(0, 60 - this.combo * 5);
    ctx.fillStyle = this.combo > 1
      ? `hsl(${comboHue}, 100%, 65%)`
      : 'rgba(255,255,255,0.5)';
    ctx.fillText(`COMBO x${this.combo}`, 20, 66);

    ctx.font = '14px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillText('Cliquez pour lancer des feux d\'artifice !', 20, canvas.height - 20);
  }
}

const game = new Game();
game.init();
