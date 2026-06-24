const TAU = Math.PI * 2;
const GRAVITY = 0.08;
const DRAG = 0.97;
const ROCKET_SPEED = 14;
const MAX_PARTICLES = 1200;
const BURST_COUNT_MIN = 80;
const BURST_COUNT_MAX = 120;
const COMBO_WINDOW_MS = 1500;
const AUTO_LAUNCH_MIN_MS = 1200;
const AUTO_LAUNCH_MAX_MS = 2500;
const HIT_RADIUS = 50;
const GAME_DURATION = 60;
const CHAIN_RADIUS = 95;
const CHAIN_DELAY_MS = 120;
const BIRD_HIT_RADIUS   = 35;
const DEBRIS_HIT_RADIUS = 28;
const BIRD_SPAWN_MIN_MS = 7000;
const BIRD_SPAWN_MAX_MS = 14000;

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
    this._ux = Math.cos(angle);
    this._uy = Math.sin(angle);
    this._totalDist = Math.hypot(targetX - x, targetY - y);
    this._gravityVy = 0;
  }

  update(particles) {
    const remaining = Math.hypot(this.targetX - this.x, this.targetY - this.y);
    const progress = 1 - remaining / this._totalDist;

    if (progress > 0.70) {
      this._gravityVy = Math.min(this._gravityVy + 0.05, 1.0);
    }

    const speed = ROCKET_SPEED * Math.max(0.08, 1 - Math.pow(progress, 1.3));
    this.x += this._ux * speed;
    this.y += this._uy * speed + this._gravityVy;

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

    if (speed < 0.6 || (this._gravityVy > 0.4 && remaining < 60)) {
      this.done = true;
    }
  }

  burst(particles) {
    const bx = this.x;
    const by = this.y;
    const count = randInt(BURST_COUNT_MIN, BURST_COUNT_MAX);
    const style = randInt(0, 2);

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * TAU + rand(-0.2, 0.2);
      let vx, vy;

      if (style === 1) {
        // Étoile : branches rapides / creux lents
        const speed = i % 2 === 0 ? rand(7, 11) : rand(1.5, 3);
        vx = Math.cos(angle) * speed;
        vy = Math.sin(angle) * speed;
      } else if (style === 2) {
        // Cœur paramétrique
        const t = (i / count) * TAU;
        const hx = 16 * Math.pow(Math.sin(t), 3);
        const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        const scale = rand(0.35, 0.65);
        vx = hx * scale;
        vy = hy * scale;
      } else {
        // Anneau uniforme
        const speed = rand(3, 10);
        vx = Math.cos(angle) * speed;
        vy = Math.sin(angle) * speed;
      }

      particles.push(new Particle(bx, by, {
        vx,
        vy,
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

class Bird {
  constructor(x, y, vx, vy) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.done = false;
  }

  update(canvasW, canvasH) {
    this.vy += 0.06;
    this.x += this.vx;
    this.y += this.vy;
    if (this.x < -70 || this.x > canvasW + 70 || this.y > canvasH + 70) {
      this.done = true;
    }
  }

  explode(particles, debrisParticles) {
    for (let i = 0; i < 25; i++) {
      const angle = rand(0, TAU);
      debrisParticles.push(new Particle(this.x, this.y, {
        vx: Math.cos(angle) * rand(4, 13),
        vy: Math.sin(angle) * rand(4, 13),
        hue: rand(0, 30), sat: 90, light: 60,
        alpha: 1, alphaDecay: 0.018,
        radius: rand(3, 6), radiusDecay: 0.965,
        gravity: 0.08, drag: 0.97,
      }));
    }
    particles.push(new Particle(this.x, this.y, {
      vx: 0, vy: 0, hue: 0, sat: 0, light: 100,
      alpha: 0.9, alphaDecay: 0.1, radius: 42, radiusDecay: 0.84,
      gravity: 0, drag: 1,
    }));
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
    this._shake = 0;
    this.birds = [];
    this._nextBirdTime = 0;
    this.debrisParticles = [];
    this._birdSprites = null;
    this._stars = null;
  }

  init() {
    this.canvas = document.getElementById('canvas');
    this.ctx = this.canvas.getContext('2d');
    this._buildBirdSprites();
    this._stars = Array.from({ length: 80 }, () => ({
      fx: Math.random(),
      fy: Math.random() * 0.75,
      r: rand(0.5, 1.5),
      phase: rand(0, TAU),
    }));

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
    const duration = 0.9;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 15;
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.exponentialRampToValueAtTime(3000, now + duration * 0.8);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.05);
    gain.gain.linearRampToValueAtTime(0.15, now + duration * 0.7);
    gain.gain.linearRampToValueAtTime(0, now + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
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
      this._nextBirdTime = performance.now() + rand(3000, 6000);
      return;
    }

    for (let i = this.birds.length - 1; i >= 0; i--) {
      const b = this.birds[i];
      if (Math.hypot(b.x - x, b.y - y) < BIRD_HIT_RADIUS) {
        b.explode(this.particles, this.debrisParticles);
        this._addScore(b.x, b.y);
        this._playBurst();
        this.birds.splice(i, 1);
        return;
      }
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
      this.particles.push(new Particle(hit.x, hit.y, {
        vx: 0, vy: 0,
        hue: 0, sat: 0, light: 100,
        alpha: 0.85,
        alphaDecay: 0.08,
        radius: 55,
        radiusDecay: 0.88,
        gravity: 0,
        drag: 1,
      }));
      this._addScore(hit.x, hit.y);
      this._playBurst();
      this.rockets.splice(this.rockets.indexOf(hit), 1);
      this._triggerChain(hit.x, hit.y, 0);
    }
  }

  _resetGame() {
    this.birds = [];
    this.debrisParticles = [];
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
    this._nextBirdTime = 0;
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

  _spawnBurst() {
    const count = randInt(1, 3);
    for (let i = 0; i < count; i++) {
      if (i === 0) {
        this._spawnRocket();
      } else {
        setTimeout(() => {
          if (!this.gameOver) this._spawnRocket();
        }, i * randInt(80, 220));
      }
    }
  }

  _buildBirdSprites() {
    const size = 80;
    this._birdSprites = [false, true].map(flipped => {
      const oc = document.createElement('canvas');
      oc.width = size; oc.height = size;
      const saved = this.ctx;
      this.ctx = oc.getContext('2d');
      this._drawBird({ x: size / 2, y: size / 2, vx: flipped ? -1 : 1 });
      this.ctx = saved;
      return oc;
    });
  }

  _spawnBird() {
    const fromLeft = Math.random() < 0.5;
    const x = fromLeft ? -30 : this.canvas.width + 30;
    const y = rand(this.canvas.height * 0.15, this.canvas.height * 0.65);
    const vx = fromLeft ? rand(5, 9) : rand(-9, -5);
    const vy = rand(-7, -2);
    this.birds.push(new Bird(x, y, vx, vy));
  }

  _drawBird(bird) {
    const { ctx } = this;
    const r = 20;
    ctx.save();
    ctx.translate(bird.x, bird.y);
    if (bird.vx < 0) ctx.scale(-1, 1);

    ctx.beginPath(); ctx.arc(0, 3, r, 0, TAU);
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fill();

    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU);
    ctx.fillStyle = '#c0392b'; ctx.fill();

    ctx.beginPath(); ctx.ellipse(2, 6, 12, 8, -0.1, 0, TAU);
    ctx.fillStyle = '#e8b49a'; ctx.fill();

    ctx.fillStyle = '#922b21';
    ctx.beginPath();
    ctx.moveTo(-5, -r + 3);
    ctx.bezierCurveTo(-10, -r - 4, -6, -r - 15, 0, -r - 11);
    ctx.bezierCurveTo(6, -r - 15, 10, -r - 4, 5, -r + 3);
    ctx.fill();

    ctx.beginPath(); ctx.arc(-4, -5, 6, 0, TAU);
    ctx.fillStyle = 'white'; ctx.fill();
    ctx.beginPath(); ctx.arc(-3, -4.5, 3.5, 0, TAU);
    ctx.fillStyle = '#5d4037'; ctx.fill();
    ctx.beginPath(); ctx.arc(-2.5, -4.5, 2, 0, TAU);
    ctx.fillStyle = '#111'; ctx.fill();
    ctx.beginPath(); ctx.arc(-3.5, -5.5, 0.9, 0, TAU);
    ctx.fillStyle = 'white'; ctx.fill();

    ctx.beginPath(); ctx.arc(6, -5, 6.5, 0, TAU);
    ctx.fillStyle = 'white'; ctx.fill();
    ctx.beginPath(); ctx.arc(7, -4.5, 4, 0, TAU);
    ctx.fillStyle = '#5d4037'; ctx.fill();
    ctx.beginPath(); ctx.arc(7.5, -4.5, 2.2, 0, TAU);
    ctx.fillStyle = '#111'; ctx.fill();
    ctx.beginPath(); ctx.arc(6.5, -5.8, 1, 0, TAU);
    ctx.fillStyle = 'white'; ctx.fill();

    ctx.strokeStyle = '#3e2009'; ctx.lineWidth = 3.5;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-11, -10);
    ctx.lineTo(-4, -14);
    ctx.lineTo(2, -11);
    ctx.lineTo(9, -14);
    ctx.lineTo(14, -9);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(r - 5, 1); ctx.lineTo(r + 9, -1);
    ctx.lineTo(r + 9, 2.5); ctx.lineTo(r - 5, 4);
    ctx.closePath();
    ctx.fillStyle = '#f5a623'; ctx.fill();

    ctx.beginPath();
    ctx.moveTo(r - 5, 4); ctx.lineTo(r + 9, 2.5);
    ctx.lineTo(r + 7, 7); ctx.lineTo(r - 5, 7);
    ctx.closePath();
    ctx.fillStyle = '#e67e22'; ctx.fill();

    ctx.restore();
  }

  _triggerChain(x, y, depth = 0) {
    if (depth >= 3) return;
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i];
      if (Math.hypot(r.x - x, r.y - y) < CHAIN_RADIUS) {
        const chainRocket = r;
        this.rockets.splice(i, 1);
        setTimeout(() => {
          if (this.gameOver) return;
          chainRocket.burst(this.particles);
          this.particles.push(new Particle(chainRocket.x, chainRocket.y, {
            vx: 0, vy: 0,
            hue: 0, sat: 0, light: 100,
            alpha: 0.7,
            alphaDecay: 0.08,
            radius: 45,
            radiusDecay: 0.88,
            gravity: 0,
            drag: 1,
          }));
          this._playBurst();
          this.score += 50;
          this.scoreLabels.push(new ScoreLabel(chainRocket.x, chainRocket.y - 20, 'CHAIN ! +50', '#ff9900'));
          this._triggerChain(chainRocket.x, chainRocket.y, depth + 1);
        }, CHAIN_DELAY_MS * (depth + 1));
      }
    }
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

    if (this.combo >= 3) {
      this._shake = Math.min(this.combo * 2.5, 15);
    }

    const label = this.combo > 1 ? `+${points} x${this.combo}` : `+${points}`;
    this.scoreLabels.push(new ScoreLabel(x, y - 20, label, 'white'));
  }

  _frame(timestamp) {
    this._lastTimestamp = timestamp;
    this._shake *= 0.82;

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
      this._spawnBurst();
      this._nextLaunchTime = timestamp + rand(AUTO_LAUNCH_MIN_MS, AUTO_LAUNCH_MAX_MS);
    }

    if (this.gameStarted && !this.gameOver && timestamp >= this._nextBirdTime && this._nextBirdTime > 0) {
      this._spawnBird();
      this._nextBirdTime = timestamp + rand(BIRD_SPAWN_MIN_MS, BIRD_SPAWN_MAX_MS);
    }

    this._update();
    this._render();

    requestAnimationFrame((ts) => this._frame(ts));
  }

  _update() {
    for (let i = this.birds.length - 1; i >= 0; i--) {
      this.birds[i].update(this.canvas.width, this.canvas.height);
      if (this.birds[i].done) this.birds.splice(i, 1);
    }

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

    let d = this.debrisParticles.length;
    while (d--) {
      this.debrisParticles[d].update();
      if (this.debrisParticles[d].dead) {
        this.debrisParticles[d] = this.debrisParticles[this.debrisParticles.length - 1];
        this.debrisParticles.pop();
      }
    }

    for (let i = this.debrisParticles.length - 1; i >= 0; i--) {
      const p = this.debrisParticles[i];
      if (p.alpha < 0.15) continue;
      let hit = false;
      for (let j = this.rockets.length - 1; j >= 0; j--) {
        if (Math.hypot(p.x - this.rockets[j].x, p.y - this.rockets[j].y) < DEBRIS_HIT_RADIUS) {
          const r = this.rockets[j];
          this.rockets.splice(j, 1);
          r.burst(this.particles);
          this._playBurst();
          this.score += 30;
          this.scoreLabels.push(new ScoreLabel(r.x, r.y - 20, 'FRAPPE ! +30', '#ff6600'));
          hit = true;
          break;
        }
      }
      if (hit) {
        this.debrisParticles[i] = this.debrisParticles[this.debrisParticles.length - 1];
        this.debrisParticles.pop();
      }
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

    const shaking = this._shake > 0.5;
    if (shaking) {
      ctx.save();
      ctx.translate(rand(-this._shake, this._shake), rand(-this._shake, this._shake));
    }

    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Lune pleine
    ctx.save();
    ctx.shadowBlur = 22;
    ctx.shadowColor = 'rgba(255, 240, 160, 0.7)';
    const moonX = canvas.width * 0.85;
    const moonY = canvas.height * 0.12;
    ctx.beginPath(); ctx.arc(moonX, moonY, 28, 0, TAU);
    ctx.fillStyle = '#fffde0'; ctx.fill();
    ctx.beginPath(); ctx.arc(moonX + 8, moonY - 4, 24, 0, TAU);
    ctx.fillStyle = 'rgba(200,190,150,0.18)'; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();

    // Étoiles scintillantes
    ctx.save();
    const t = this._lastTimestamp;
    for (const s of this._stars) {
      ctx.globalAlpha = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(t * 0.0007 + s.phase));
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(s.fx * canvas.width, s.fy * canvas.height, s.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    if (this.glowEnabled) ctx.shadowBlur = 8;

    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.shadowColor = `hsl(${p.hue}, 100%, 70%)`;
      ctx.fillStyle = `hsl(${p.hue}, ${p.sat}%, ${p.light}%)`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, TAU);
      ctx.fill();
    }

    for (const p of this.debrisParticles) {
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

    for (const bird of this.birds) {
      const sprite = this._birdSprites[bird.vx < 0 ? 1 : 0];
      ctx.drawImage(sprite, bird.x - 40, bird.y - 40, 80, 80);
    }

    if (shaking) ctx.restore();

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

      ctx.font = '12px monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillText('by GUIM', canvas.width / 2, canvas.height - 18);

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

    const titleSize = Math.min(44, Math.floor(canvas.width / 11));
    const scoreSize = Math.min(30, Math.floor(canvas.width / 13));
    const btnSize   = Math.min(22, Math.floor(canvas.width / 17));
    const bw = Math.min(240, canvas.width * 0.60);
    const bh = 56;

    ctx.textAlign = 'center';
    ctx.font = `bold ${titleSize}px monospace`;
    ctx.fillStyle = 'rgba(255, 210, 40, 0.95)';
    ctx.fillText('Bonne Saint-Jean !', cx, cy - 70);

    ctx.font = `bold ${scoreSize}px monospace`;
    ctx.fillStyle = 'white';
    ctx.fillText(`Score final : ${this.score}`, cx, cy - 10);

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

    ctx.font = `bold ${btnSize}px monospace`;
    ctx.fillStyle = '#000';
    ctx.fillText('↺  Rejouer', cx, by + 38);

    ctx.font = `${Math.min(13, Math.floor(canvas.width / 28))}px monospace`;
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillText('by GUIM', cx, canvas.height - 18);

    ctx.textAlign = 'left';
  }
}

const game = new Game();
game.init();
