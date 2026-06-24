const TAU = Math.PI * 2;
const GRAVITY = 0.08;
const DRAG = 0.97;
const ROCKET_SPEED = 14;
const MAX_PARTICLES = 1200;
const BURST_COUNT_MIN = 80;
const BURST_COUNT_MAX = 120;
const COMBO_WINDOW_MS = 1500;
const AUTO_LAUNCH_MIN_MS = 800;
const AUTO_LAUNCH_MAX_MS = 2000;
const HIT_RADIUS = 30;
const GAME_DURATION = 60;

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
  constructor(x, y, text, color = 'white') {
    this.x = x;
    this.y = y;
    this.text = text;
    this.color = color;
    this.alpha = 1;
    this.vy = -1.5;
  }

  update() {
    this.y += this.vy;
    this.alpha -= 0.018;
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
      }));
    }

    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    if (Math.sqrt(dx * dx + dy * dy) < ROCKET_SPEED) {
      this.done = true;
    }
  }

  burst(particles) {
    const bx = this.x;
    const by = this.y;
    const count = randInt(BURST_COUNT_MIN, BURST_COUNT_MAX);

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * TAU + rand(-0.2, 0.2);
      const speed = rand(3, 10);
      particles.push(new Particle(bx, by, {
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
      particles.push(new Particle(bx, by, {
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
    this._nextLaunchTime = 0;
    this.gameStarted = false;
    this.gameOver = false;
    this._startTimestamp = 0;
    this.timeLeft = GAME_DURATION;
    this._replayBtn = null;
    this._audioCtx = null;
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

  _initAudio() {
    if (!this._audioCtx) {
      this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  _playLaunch() {
    if (!this._audioCtx) return;
    const ctx = this._audioCtx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.linearRampToValueAtTime(700, now + 0.25);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  _playBurst() {
    if (!this._audioCtx) return;
    const ctx = this._audioCtx;
    const now = ctx.currentTime;
    const duration = 0.2;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.linearRampToValueAtTime(0, now + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
  }

  _resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  _onClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (this.gameOver) {
      if (this._replayBtn) {
        const b = this._replayBtn;
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
          this._resetGame();
        }
      }
      return;
    }

    this._initAudio();

    if (!this.gameStarted) {
      this.gameStarted = true;
      this._startTimestamp = performance.now();
      this._nextLaunchTime = 0;
      return;
    }

    let hit = null;
    let hitDist = Infinity;
    for (const rocket of this.rockets) {
      const dx = rocket.x - x;
      const dy = rocket.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < HIT_RADIUS && dist < hitDist) {
        hit = rocket;
        hitDist = dist;
      }
    }

    if (hit) {
      hit.burst(this.particles);
      this._addScore(hit.x, hit.y);
      this._playBurst();
      this.rockets.splice(this.rockets.indexOf(hit), 1);
    }
  }

  _resetGame() {
    this.rockets = [];
    this.particles = [];
    this.scoreLabels = [];
    this.score = 0;
    this.combo = 1;
    this.lastBurstTime = 0;
    this.gameStarted = false;
    this.gameOver = false;
    this._startTimestamp = 0;
    this.timeLeft = GAME_DURATION;
    this._nextLaunchTime = 0;
  }

  _spawnRocket() {
    const startX = this.canvas.width / 2 + rand(-120, 120);
    const startY = this.canvas.height;
    const targetX = rand(this.canvas.width * 0.1, this.canvas.width * 0.9);
    const targetY = rand(this.canvas.height * 0.08, this.canvas.height * 0.5);
    const hue = rand(0, 360);
    this.rockets.push(new Rocket(startX, startY, targetX, targetY, hue));
    this._playLaunch();
  }

  _addScore(x, y) {
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
    this.scoreLabels.push(new ScoreLabel(x, y - 20, label, 'white'));
  }

  _frame(timestamp) {
    this._lastTimestamp = timestamp;

    this._frameCount++;
    if (timestamp - this._lastFpsCheck > 1000) {
      this._fps = this._frameCount;
      this._frameCount = 0;
      this._lastFpsCheck = timestamp;
      this.glowEnabled = this._fps >= 45;
    }

    if (this.gameStarted && !this.gameOver) {
      this.timeLeft = Math.max(0, GAME_DURATION - (performance.now() - this._startTimestamp) / 1000);
      if (this.timeLeft <= 0) {
        this.gameOver = true;
        this.rockets = [];
      }
    }

    if (this.gameStarted && !this.gameOver && timestamp >= this._nextLaunchTime) {
      this._spawnRocket();
      this._nextLaunchTime = timestamp + rand(AUTO_LAUNCH_MIN_MS, AUTO_LAUNCH_MAX_MS);
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
        this.scoreLabels.push(new ScoreLabel(rocket.x, rocket.y, 'MANQUÉ !', '#ff4455'));
        this.combo = 1;
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

    if (this.glowEnabled) ctx.shadowBlur = 8;

    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.shadowColor = `hsl(${p.hue}, 100%, 70%)`;
      ctx.fillStyle = `hsl(${p.hue}, ${p.sat}%, ${p.light}%)`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, TAU);
      ctx.fill();
    }

    if (this.glowEnabled) ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    for (const rocket of this.rockets) {
      ctx.shadowBlur = this.glowEnabled ? 20 : 0;
      ctx.shadowColor = `hsl(${rocket.hue}, 100%, 70%)`;
      ctx.fillStyle = `hsl(${rocket.hue}, 100%, 65%)`;
      ctx.beginPath();
      ctx.arc(rocket.x, rocket.y, 10, 0, TAU);
      ctx.fill();
    }

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    this._renderHUD();

    if (this.gameOver) this._renderGameOver();
  }

  _renderHUD() {
    const { ctx, canvas } = this;

    for (const label of this.scoreLabels) {
      ctx.globalAlpha = Math.max(0, label.alpha);
      ctx.font = 'bold 20px monospace';
      ctx.fillStyle = label.color;
      ctx.textAlign = 'center';
      ctx.fillText(label.text, label.x, label.y);
    }

    ctx.globalAlpha = 1;

    if (!this.gameStarted) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 32px monospace';
      ctx.fillStyle = 'white';
      ctx.fillText('FEUX D\'ARTIFICE', canvas.width / 2, canvas.height / 2 - 40);
      ctx.font = '16px monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.fillText('Tapez sur les boules colorées pour les faire exploser !', canvas.width / 2, canvas.height / 2 + 4);
      ctx.font = 'bold 22px monospace';
      ctx.fillStyle = 'rgba(255, 220, 50, 0.95)';
      ctx.fillText('▶  Toucher pour commencer', canvas.width / 2, canvas.height / 2 + 52);
      ctx.textAlign = 'left';
      return;
    }

    ctx.textAlign = 'left';
    ctx.font = 'bold 22px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText(`SCORE: ${this.score}`, 20, 38);

    const comboHue = Math.max(0, 60 - this.combo * 5);
    ctx.fillStyle = this.combo > 1
      ? `hsl(${comboHue}, 100%, 65%)`
      : 'rgba(255,255,255,0.45)';
    ctx.fillText(`COMBO x${this.combo}`, 20, 66);

    const secs = Math.ceil(this.timeLeft);
    const mm = String(Math.floor(secs / 60)).padStart(2, '0');
    const ss = String(secs % 60).padStart(2, '0');
    ctx.textAlign = 'right';
    ctx.font = 'bold 28px monospace';
    ctx.fillStyle = this.timeLeft < 10 ? '#ff4455' : 'rgba(255,255,255,0.9)';
    ctx.fillText(`⏱ ${mm}:${ss}`, canvas.width - 20, 40);

    ctx.textAlign = 'center';
    ctx.font = '13px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillText('Tapez sur les boules pour les faire exploser !', canvas.width / 2, canvas.height - 18);
    ctx.textAlign = 'left';
  }

  _renderGameOver() {
    const { ctx, canvas } = this;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    ctx.fillStyle = 'rgba(0,0,0,0.78)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.textAlign = 'center';
    ctx.font = 'bold 44px monospace';
    ctx.fillStyle = '#ff4455';
    ctx.fillText('TEMPS ÉCOULÉ !', cx, cy - 70);

    ctx.font = 'bold 30px monospace';
    ctx.fillStyle = 'white';
    ctx.fillText(`Score final : ${this.score}`, cx, cy - 10);

    const bw = 240, bh = 56;
    const bx = cx - bw / 2;
    const by = cy + 30;
    this._replayBtn = { x: bx, y: by, w: bw, h: bh };

    ctx.fillStyle = 'rgba(255, 220, 50, 0.95)';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(bx, by, bw, bh, 14);
    } else {
      ctx.rect(bx, by, bw, bh);
    }
    ctx.fill();

    ctx.font = 'bold 22px monospace';
    ctx.fillStyle = '#000';
    ctx.fillText('↺  Rejouer', cx, by + 38);

    ctx.textAlign = 'left';
  }
}

const game = new Game();
game.init();
