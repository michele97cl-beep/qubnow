// ================================================================
//  MAIN — constants, wiring, game loop
//  Depends on: engine.js, entities.js
// ================================================================

const canvas = document.getElementById("gameCanvas");
const renderer = new Renderer(canvas);
const input = new InputManager();
const player = new Player(renderer);
const levelMgr = new LevelManager();
const spawner = new GateSpawner(levelMgr, renderer);
const tutorial = new TutorialManager();
const announcer = new LevelUpAnnouncer();
const scoreEl = document.getElementById("score");
const levelEl = document.getElementById("level");
const speedEl = document.getElementById("speed");
const overlay = document.getElementById("overlay");
const deathOv = document.getElementById("deathOverlay");

let distance = 0;
let gridTime = 0;
let gameActive = false;

const loop = new GameLoop(
  (dt) => {
    if (!gameActive) return;
    gridTime += dt * 1000;
    renderer.gridTime = gridTime;
    player.update(dt, input);
    distance += dt * 80 * levelMgr.speedMultiplier;
    scoreEl.textContent = String(Math.max(0, Math.floor(distance))).padStart(
      4,
      "0"
    );
    const leveledUp = levelMgr.update(distance);
    if (leveledUp) {
      spawner.triggerBreather(4000, () => {
        levelMgr.commitLevel();
        announcer.show(levelMgr.level, levelMgr.color);
        levelEl.textContent = String(levelMgr.level).padStart(2, "0");
        speedEl.textContent = levelMgr.speedMultiplier.toFixed(1) + "x";
      });
    }
    announcer.update(dt);
    spawner.update(dt);

    if (gameActive) {
      for (const gate of spawner.gates) {
        if (gate.checkCollision(player.x, player.y, player.size, renderer)) {
          gameActive = false;
          loop.stop();
          player.kill();
          document.getElementById("deathScore").textContent =
            "DISTANCE: " + String(Math.floor(distance)).padStart(4, "0");
          document.getElementById("deathMessage").textContent =
            randomDeathMessage();
          deathOv.classList.add("active");
          break;
        }
      }
    }
  },
  () => {
    renderer.clear();
    renderer.drawOriginCrosshair();
    const maxProximity = spawner.gates.reduce(
      (max, g) => Math.max(max, g.proximity),
      0
    );
    renderer.drawProximityMarker(maxProximity);
    const allGates = tutorial.active && tutorial.gate
      ? [...spawner.gates, tutorial.gate]
      : [...spawner.gates];

    allGates
      .sort((a, b) => a.t - b.t)
      .forEach((gate) => {
        const gW = gate.t * renderer.W * 0.92;
        const gH = gate.t * renderer.H * 0.92;
        if (gW < 20 || gH < 20) return;
        renderer.drawGate(
          renderer.cx,
          renderer.cy,
          gW,
          gH,
          0.91,
          gate.holeSize * gate.t,
          gate.holeOffsetX,
          gate.holeOffsetY,
          gate.shape,
          gate.rotation,
          gate.color,
          gate.alpha,
          gate.flashProgress
        );
      });
    player.draw(maxProximity);
  }
);

function startGame() {
  distance = 0;
  gridTime = 0;
  gameActive = true;
  renderer.gridTime = 0;
  levelMgr.reset();
  spawner.reset();
  levelEl.textContent = "01";
  speedEl.textContent = "1.0x";
  overlay.classList.remove("active");
  deathOv.classList.remove("active");
  player.reset();
  loop.stop();
  loop.start();
}

window.addEventListener("keydown", (e) => {
  if (e.code !== "Escape" || !gameActive) return;
  gameActive = false;
  loop.stop();
  deathOv.classList.remove("active");
  overlay.classList.add("active");
  renderer.gridTime = 0;
  loop.draw();
});

document.getElementById("startBtn").addEventListener("click", startGame);
document.getElementById("restartBtn").addEventListener("click", startGame);
loop.draw();
