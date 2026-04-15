// ================================================================
//  ENTITIES — Player, Gate, GateSpawner, LevelManager, Announcer
//  Depends on: engine.js (Renderer must be loaded first)
// ================================================================

const LEVEL_PALETTE = [
  { hex: "#7c3aed", r: 124, g: 58, b: 237 },
  { hex: "#0ea5e9", r: 14, g: 165, b: 233 },
  { hex: "#10b981", r: 16, g: 185, b: 129 },
  { hex: "#f59e0b", r: 245, g: 158, b: 11 },
  { hex: "#ef4444", r: 239, g: 68, b: 68 },
  { hex: "#ec4899", r: 236, g: 72, b: 153 },
  { hex: "#6366f1", r: 99, g: 102, b: 241 },
  { hex: "#14b8a6", r: 20, g: 184, b: 166 },
];

function getLevelColor(level) {
  const safeLevel = Math.max(1, level || 1);
  return LEVEL_PALETTE[(safeLevel - 1) % LEVEL_PALETTE.length];
}

const HOLE_SHAPES = [
  "circle",
  "square",
  "diamond",
  "triangle",
  "pentagon",
  "cross",
];

const DEATH_MESSAGES = [
  "The system has withdrawn—what lies ahead no longer reveals itself.",
  "You approached the unknown, but the system's horizon has receded further still.",
  "The system watched and withdrew—progress remains undefined.",
  "The veil remains unbroken—what lies beyond is no closer.",
  "The system has withheld its design—your journey paused in silence.",
  "The path is not yet revealed—the next step dissolves in the ether.",
  "The system withdraws its presence—what remains is the absence of meaning.",
  "The system's veil lingers—you touched a threshold that dissipated.",
  "The structure of the system remains unsolved—your trajectory fades into the unknown.",
  "The system has retracted—what remains is the void before the next attempt.",
];

function randomDeathMessage() {
  return DEATH_MESSAGES[Math.floor(Math.random() * DEATH_MESSAGES.length)];
}

// ────────────────────────────────────────────────────────────────
class LevelManager {
  constructor() {
    this.level = 1;
    this.distPerLevel = 2400;
  }

  update(distance) {
    const newLevel = Math.max(1, 1 + Math.floor(distance / this.distPerLevel));
    if (newLevel !== this.level && !this.pendingLevel) {
      this.pendingLevel = newLevel;
      return true;
    }
    return false;
  }

  commitLevel() {
    if (this.pendingLevel) {
      this.level = this.pendingLevel;
      this.pendingLevel = null;
    }
  }

  get speedMultiplier() {
    return 1 + Math.log(Math.max(1, this.level)) * 0.4;
  }
  get color() {
    return getLevelColor(this.level);
  }
  get holeSizeFactor() {
    return Math.max(0.4, 1 - (this.level - 1) * 0.012);
  }
  reset() {
    this.level = 1;
  }
}

// ────────────────────────────────────────────────────────────────
class Gate {
  constructor(levelManager) {
    this.tRaw = 0;
    this.alive = true;
    this.shape = HOLE_SHAPES[Math.floor(Math.random() * HOLE_SHAPES.length)];
    this.holeSize = 90 * levelManager.holeSizeFactor;
    this.color = { ...getLevelColor(levelManager.level) };
    this.rotation = Math.random() * Math.PI * 2;
    const maxReach = 112;
    const gWAtCross = Math.pow(0.5, 1.6) * renderer.W * 0.92 / 2;
    const gHAtCross = Math.pow(0.5, 1.6) * renderer.H * 0.92 / 2;
    const maxOffsetX = Math.min(1, maxReach / Math.max(1, gWAtCross - this.holeSize));
    const maxOffsetY = Math.min(1, maxReach / Math.max(1, gHAtCross - this.holeSize));
    this.holeOffsetX = (Math.random() * 2 - 1) * maxOffsetX;
    this.holeOffsetY = (Math.random() * 2 - 1) * maxOffsetY;
    this.flashDuration = 1.2;
    this.flashTimer = 0;
    this.hasCrossed = false;
  }

  update(dt, journeyMs) {
    const prev = this.tRaw;
    this.tRaw += (dt * 1000) / journeyMs;
    if (!this.hasCrossed && prev < 0.5 && this.tRaw >= 0.5) {
      this.hasCrossed = true;
      this.flashTimer = this.flashDuration;
    }
    if (this.flashTimer > 0)
      this.flashTimer = Math.max(0, this.flashTimer - dt);
    if (this.tRaw >= 1) this.alive = false;
  }

  get t() {
    return Math.pow(this.tRaw, 1.6);
  }
  get alpha() {
    return Math.sin(this.tRaw * Math.PI) * 0.82;
  }
  get flashProgress() {
    return this.flashTimer / this.flashDuration;
  }
  get proximity() {
    return this.tRaw >= 0.5 ? 0 : this.tRaw * 2;
  }

  checkCollision(px, py, cubeSize, renderer) {
    if (this.tRaw < 0.48 || this.tRaw > 0.52) return false;

    const gW = this.t * renderer.W * 0.92;
    const gH = this.t * renderer.H * 0.92;

    const dx = px - renderer.cx;
    const dy = py - renderer.cy;

    if (Math.abs(dx) > gW / 2 || Math.abs(dy) > gH / 2) return false;

    const holeX =
      renderer.cx + this.holeOffsetX * (gW / 2 - this.holeSize * this.t);
    const holeY =
      renderer.cy + this.holeOffsetY * (gH / 2 - this.holeSize * this.t);
    const holeSize = this.holeSize * this.t + cubeSize * 0.05;

    const cos = Math.cos(-this.rotation);
    const sin = Math.sin(-this.rotation);
    const lx = (px - holeX) * cos - (py - holeY) * sin;
    const ly = (px - holeX) * sin + (py - holeY) * cos;
    const size = holeSize;

    let inHole = false;
    switch (this.shape) {
      case "circle":
        inHole = Math.sqrt(lx * lx + ly * ly) <= size;
        break;
      case "square":
        inHole = Math.abs(lx) <= size && Math.abs(ly) <= size;
        break;
      case "diamond":
        inHole = Math.abs(lx) + Math.abs(ly) <= size;
        break;
      case "triangle": {
        const h = size * 1.5;
        const inBounds = ly >= -size && ly <= size * 0.5;
        const slope = (size * 0.866) / h;
        inHole = inBounds && Math.abs(lx) <= size * 0.866 - slope * (ly + size);
        break;
      }
      case "pentagon": {
        let inside = true;
        const verts = [];
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
          verts.push([Math.cos(a) * size, Math.sin(a) * size]);
        }
        for (let i = 0; i < 5; i++) {
          const [ax, ay] = verts[i];
          const [bx, by] = verts[(i + 1) % 5];
          if ((by - ay) * (lx - ax) - (bx - ax) * (ly - ay) > 0) {
            inside = false;
            break;
          }
        }
        inHole = inside;
        break;
      }
      case "cross": {
        const arm = size,
          thick = size * 0.4;
        inHole =
          (Math.abs(lx) <= arm && Math.abs(ly) <= thick) ||
          (Math.abs(lx) <= thick && Math.abs(ly) <= arm);
        break;
      }
    }

    return !inHole;
  }
}

// ────────────────────────────────────────────────────────────────
class GateSpawner {
  constructor(levelManager, renderer) {
    this.lm = levelManager;
    this.gates = [];
    this.journeyMs = 6000;
    this.nextSpawnIn = 500;
    this.timeSinceSpawn = 0;
    this.breatherRemaining = 0;
  }

  triggerBreather(duration = 4000, onComplete) {
    this.breatherRemaining = duration;
    this.onBreatherComplete = onComplete || null;
  }

  _spawnInterval() {
    const base = Math.max(
      this.journeyMs * 0.6,
      this.journeyMs / Math.sqrt(this.lm.level)
    );
    const jitter = base * 0.1;
    return base - jitter + Math.random() * jitter * 2;
  }

  update(dt) {
    if (this.breatherRemaining > 0) {
      this.breatherRemaining -= dt * 1000;
      this.gates.forEach((g) => g.update(dt, this.journeyMs));
      this.gates = this.gates.filter((g) => g.alive);
      if (this.breatherRemaining <= 0 && this.onBreatherComplete) {
        this.onBreatherComplete();
        this.onBreatherComplete = null;
      }
      return;
    }
    this.timeSinceSpawn += dt * 1000;
    if (this.timeSinceSpawn >= this.nextSpawnIn) {
      this.gates.push(new Gate(this.lm, this.renderer));
      this.timeSinceSpawn = 0;
      this.nextSpawnIn = this._spawnInterval();
    }
    this.gates.forEach((g) => g.update(dt, this.journeyMs));
    this.gates = this.gates.filter((g) => g.alive);
  }

  reset() {
    this.gates = [];
    this.timeSinceSpawn = 0;
    this.nextSpawnIn = 500;
    this.breatherRemaining = 0;
    this.onBreatherComplete = null;
    this.lm.pendingLevel = null;
  }
}

// ────────────────────────────────────────────────────────────────
class Player {
  constructor(renderer) {
    this.R = renderer;
    this.x = renderer.cx;
    this.y = renderer.cy;
    this.vx = 0;
    this.vy = 0;
    this.nudgeForce = 900;
    this.springK = 8;
    this.damping = 0.88;
    this.size = Math.min(renderer.W, renderer.H) * 0.055;
    this.state = "idle";
    this.rollX = 0;
    this.rollY = 0;
  }

  update(dt, input) {
    if (this.state === "dead") return;
    let moving = false;
    if (input.isDown("ArrowLeft")) {
      this.vx -= this.nudgeForce * dt;
      moving = true;
    }
    if (input.isDown("ArrowRight")) {
      this.vx += this.nudgeForce * dt;
      moving = true;
    }
    if (input.isDown("ArrowUp")) {
      this.vy -= this.nudgeForce * dt;
      moving = true;
    }
    if (input.isDown("ArrowDown")) {
      this.vy += this.nudgeForce * dt;
      moving = true;
    }
    this.vx += (this.R.cx - this.x) * this.springK * dt;
    this.vy += (this.R.cy - this.y) * this.springK * dt;
    const damp = Math.pow(this.damping, dt * 60);
    this.vx *= damp;
    this.vy *= damp;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const m = this.size;
    this.x = Math.max(m, Math.min(this.R.W - m, this.x));
    this.y = Math.max(m, Math.min(this.R.H - m, this.y));
    const radius = this.size / 2;
    this.rollY += (this.vx * dt) / radius;
    this.rollX += (this.vy * dt) / radius;
    this.state = moving ? "moving" : "idle";
  }

  draw(accentProgress) {
    this.R.drawCube(
      this.x,
      this.y,
      this.size,
      this.rollX,
      this.rollY,
      this.state,
      accentProgress
    );
  }

  kill() {
    this.state = "dead";
  }
  reset() {
    this.x = this.R.cx;
    this.y = this.R.cy;
    this.vx = 0;
    this.vy = 0;
    this.state = "idle";
    this.size = Math.min(this.R.W, this.R.H) * 0.055;
  }
}

// ────────────────────────────────────────────────────────────────
class LevelUpAnnouncer {
  constructor() {
    this.el = document.getElementById("levelUp");
    this.label = document.getElementById("levelUpLabel");
    this.number = document.getElementById("levelUpNumber");
    this.timer = 0;
    this.visible = false;
  }

  show(level, color) {
    document.documentElement.style.setProperty("--level-color", color.hex);
    this.label.textContent = "LEVEL";
    this.number.textContent = String(level).padStart(2, "0");
    this.el.classList.add("active");
    this.timer = 2.2;
    this.visible = true;
  }

  update(dt) {
    if (!this.visible) return;
    this.timer -= dt;
    if (this.timer <= 0.5) this.el.classList.remove("active");
    if (this.timer <= 0) this.visible = false;
  }
}
