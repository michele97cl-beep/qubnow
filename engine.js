// ================================================================
//  ENGINE — Renderer, InputManager, GameLoop
//  No game logic lives here. Stable once built.
// ================================================================

class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.gridTime = 0;
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.W = this.canvas.width;
    this.H = this.canvas.height;
    this.cx = this.W / 2;
    this.cy = this.H / 2;
  }

  clear() {
    this.ctx.fillStyle = "#f5f5f3";
    this.ctx.fillRect(0, 0, this.W, this.H);
    this._drawGrid();
  }

  _drawGrid() {
    const ctx = this.ctx;
    const cx = this.cx;
    const cy = this.cy;

    const numRings = 4;
    const speed = numRings * 1500;
    const cycle = (this.gridTime % speed) / speed;

    const bgGates = [];
    for (let i = 0; i < numRings; i++) {
      const tRaw = (i / numRings + cycle) % 1.0;
      const t = Math.pow(tRaw, 1.6);
      bgGates.push({ tRaw, t });
    }

    const ca = Math.atan2(this.H / 2, this.W / 2);
    const structural = [
      0,
      ca,
      Math.PI / 2,
      Math.PI - ca,
      Math.PI,
      Math.PI + ca,
      (3 * Math.PI) / 2,
      2 * Math.PI - ca,
    ];
    const intermediaries = structural.map((angle, i) => {
      const next = structural[(i + 1) % structural.length];
      const adjustedNext = next < angle ? next + Math.PI * 2 : next;
      return (angle + adjustedNext) / 2;
    });
    const allSpokes = [...structural, ...intermediaries];

    const reach = Math.sqrt(this.W * this.W + this.H * this.H);
    const segments = 80;
    const sigma = 0.07;
    const spokePeak = 0.13;

    allSpokes.forEach((angle) => {
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      for (let s = 0; s < segments; s++) {
        const t0 = s / segments;
        const t1 = (s + 1) / segments;
        const tMid = (t0 + t1) / 2;
        let brightness = 0;
        bgGates.forEach(({ t: gateT }) => {
          const d = tMid - gateT;
          brightness += Math.exp(-(d * d) / (2 * sigma * sigma));
        });
        const alpha = Math.min(brightness, 1) * spokePeak;
        if (alpha < 0.003) continue;
        ctx.strokeStyle = `rgba(0,0,0,${alpha.toFixed(3)})`;
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(cx + cosA * t0 * reach, cy + sinA * t0 * reach);
        ctx.lineTo(cx + cosA * t1 * reach, cy + sinA * t1 * reach);
        ctx.stroke();
      }
    });

    const rectPeak = 0.07;
    bgGates.forEach(({ tRaw, t }) => {
      const halfW = t * this.W * 0.5;
      const halfH = t * this.H * 0.5;
      if (halfW < 2 || halfH < 2) return;
      const alpha = Math.sin(tRaw * Math.PI) * rectPeak;
      if (alpha < 0.003) return;
      ctx.strokeStyle = `rgba(30,20,20,${alpha.toFixed(3)})`;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.rect(cx - halfW, cy - halfH, halfW * 2, halfH * 2);
      ctx.stroke();
    });
  }

  // Fixed marker at tRaw=0.5 depth.
  // Stable colour and opacity always. Only lineWidth grows with proximity.
  drawProximityMarker(proximity) {
    const ctx = this.ctx;
    const t = Math.pow(0.5, 1.6);
    const halfW = t * this.W * 0.5;
    const halfH = t * this.H * 0.5;

    ctx.save();
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 0.8 + proximity * 2.5; // only this responds to proximity
    ctx.beginPath();
    ctx.rect(this.cx - halfW, this.cy - halfH, halfW * 2, halfH * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawGate(
    x,
    y,
    w,
    h,
    backScale,
    holeSize,
    holeOffsetX,
    holeOffsetY,
    shape,
    rotation,
    color,
    alpha,
    flashProgress
  ) {
    if (w < 1 || h < 1 || holeSize < 1) return;
    const ctx = this.ctx;
    const { r, g, b } = color;

    const bW = w * backScale;
    const bH = h * backScale;

    const offW = Math.ceil(w + 4);
    const offH = Math.ceil(h + 4);
    const off = new OffscreenCanvas(offW, offH);
    const oc = off.getContext("2d");

    const lx = offW / 2;
    const ly = offH / 2;

    const fHoleX = lx + holeOffsetX * (w / 2 - holeSize);
    const fHoleY = ly + holeOffsetY * (h / 2 - holeSize);
    const bHoleX = lx + holeOffsetX * (bW / 2 - holeSize * backScale);
    const bHoleY = ly + holeOffsetY * (bH / 2 - holeSize * backScale);

    oc.save();
    oc.globalAlpha = 0.28;
    oc.fillStyle = `rgb(${r},${g},${b})`;
    oc.fillRect(lx - bW / 2, ly - bH / 2, bW, bH);
    oc.globalCompositeOperation = "destination-out";
    this._drawHoleShape(
      oc,
      bHoleX,
      bHoleY,
      holeSize * backScale,
      shape,
      rotation
    );
    oc.globalCompositeOperation = "source-over";
    oc.restore();

    oc.save();
    oc.globalAlpha = 0.5;
    oc.fillStyle = `rgb(${r},${g},${b})`;
    oc.fillRect(lx - w / 2, ly - h / 2, w, h);
    oc.globalCompositeOperation = "destination-out";
    this._drawHoleShape(oc, fHoleX, fHoleY, holeSize, shape, rotation);
    oc.globalCompositeOperation = "source-over";
    oc.restore();

    const pulses = 3;
    const pulseBright =
      flashProgress > 0
        ? Math.abs(Math.sin(flashProgress * Math.PI * pulses))
        : 0;

    const edgeR = Math.round(r + (255 - r) * pulseBright);
    const edgeG = Math.round(g + (255 - g) * pulseBright);
    const edgeB = Math.round(b + (255 - b) * pulseBright);

    oc.save();
    oc.lineWidth = 1.2 + pulseBright * 1.5;

    const fc = [
      [lx - w / 2, ly - h / 2],
      [lx + w / 2, ly - h / 2],
      [lx + w / 2, ly + h / 2],
      [lx - w / 2, ly + h / 2],
    ];
    const bc = [
      [lx - bW / 2, ly - bH / 2],
      [lx + bW / 2, ly - bH / 2],
      [lx + bW / 2, ly + bH / 2],
      [lx - bW / 2, ly + bH / 2],
    ];

    // Gate corner connecting edges
    oc.strokeStyle = `rgba(${edgeR},${edgeG},${edgeB},${(
      0.5 +
      pulseBright * 0.5
    ).toFixed(2)})`;
    fc.forEach(([fx, fy], i) => {
      oc.beginPath();
      oc.moveTo(fx, fy);
      oc.lineTo(bc[i][0], bc[i][1]);
      oc.stroke();
    });

    // Gate front and back outlines
    oc.strokeStyle = `rgba(${edgeR},${edgeG},${edgeB},${(
      0.7 +
      pulseBright * 0.3
    ).toFixed(2)})`;
    oc.strokeRect(lx - w / 2, ly - h / 2, w, h);
    oc.strokeStyle = `rgba(${edgeR},${edgeG},${edgeB},${(
      0.45 +
      pulseBright * 0.3
    ).toFixed(2)})`;
    oc.strokeRect(lx - bW / 2, ly - bH / 2, bW, bH);

    // Hole outlines and connecting ridges
    const fPts = this._getHoleTips(fHoleX, fHoleY, holeSize, shape, rotation);
    const bPts = this._getHoleTips(
      bHoleX,
      bHoleY,
      holeSize * backScale,
      shape,
      rotation
    );

    if (fPts.length > 0) {
      // Front hole outline
      oc.strokeStyle = `rgba(${edgeR},${edgeG},${edgeB},${(
        0.7 +
        pulseBright * 0.3
      ).toFixed(2)})`;
      oc.beginPath();
      fPts.forEach(([px, py], i) =>
        i === 0 ? oc.moveTo(px, py) : oc.lineTo(px, py)
      );
      oc.closePath();
      oc.stroke();

      // Back hole outline
      oc.strokeStyle = `rgba(${edgeR},${edgeG},${edgeB},${(
        0.45 +
        pulseBright * 0.3
      ).toFixed(2)})`;
      oc.beginPath();
      bPts.forEach(([px, py], i) =>
        i === 0 ? oc.moveTo(px, py) : oc.lineTo(px, py)
      );
      oc.closePath();
      oc.stroke();

      // Connecting ridges between front and back tips
      oc.strokeStyle = `rgba(${edgeR},${edgeG},${edgeB},${(
        0.5 +
        pulseBright * 0.5
      ).toFixed(2)})`;
      fPts.forEach(([fx, fy], i) => {
        oc.beginPath();
        oc.moveTo(fx, fy);
        oc.lineTo(bPts[i][0], bPts[i][1]);
        oc.stroke();
      });
    }

    oc.restore();

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(off, x - offW / 2, y - offH / 2);
    ctx.restore();
  }

  _drawHoleShape(oc, cx, cy, size, shape, rotation) {
    oc.save();
    oc.translate(cx, cy);
    oc.rotate(rotation);
    oc.translate(-cx, -cy);
    oc.beginPath();
    switch (shape) {
      case "circle":
        oc.arc(cx, cy, size, 0, Math.PI * 2);
        break;
      case "square":
        oc.rect(cx - size, cy - size, size * 2, size * 2);
        break;
      case "diamond":
        oc.moveTo(cx, cy - size);
        oc.lineTo(cx + size, cy);
        oc.lineTo(cx, cy + size);
        oc.lineTo(cx - size, cy);
        oc.closePath();
        break;
      case "triangle":
        oc.moveTo(cx, cy - size);
        oc.lineTo(cx + size * 0.866, cy + size * 0.5);
        oc.lineTo(cx - size * 0.866, cy + size * 0.5);
        oc.closePath();
        break;
      case "pentagon": {
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
          if (i === 0)
            oc.moveTo(cx + Math.cos(a) * size, cy + Math.sin(a) * size);
          else oc.lineTo(cx + Math.cos(a) * size, cy + Math.sin(a) * size);
        }
        oc.closePath();
        break;
      }
      case "cross": {
        const arm = size,
          thick = size * 0.4;
        oc.rect(cx - arm, cy - thick, arm * 2, thick * 2);
        oc.rect(cx - thick, cy - arm, thick * 2, arm * 2);
        break;
      }
    }
    oc.fill();
    oc.restore();
  }

  _getHoleTips(cx, cy, size, shape, rotation) {
    const pts = [];
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const rot = ([x, y]) => [
      cx + (x - cx) * cos - (y - cy) * sin,
      cy + (x - cx) * sin + (y - cy) * cos,
    ];

    switch (shape) {
      case "square":
        pts.push(
          [cx - size, cy - size],
          [cx + size, cy - size],
          [cx + size, cy + size],
          [cx - size, cy + size]
        );
        break;
      case "diamond":
        pts.push(
          [cx, cy - size],
          [cx + size, cy],
          [cx, cy + size],
          [cx - size, cy]
        );
        break;
      case "triangle":
        pts.push(
          [cx, cy - size],
          [cx + size * 0.866, cy + size * 0.5],
          [cx - size * 0.866, cy + size * 0.5]
        );
        break;
      case "pentagon":
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
          pts.push([cx + Math.cos(a) * size, cy + Math.sin(a) * size]);
        }
        break;
      case "cross": {
        const arm = size,
          thick = size * 0.4;
        pts.push(
          [cx - arm, cy - thick],
          [cx - thick, cy - thick],
          [cx - thick, cy - arm],
          [cx + thick, cy - arm],
          [cx + thick, cy - thick],
          [cx + arm, cy - thick],
          [cx + arm, cy + thick],
          [cx + thick, cy + thick],
          [cx + thick, cy + arm],
          [cx - thick, cy + arm],
          [cx - thick, cy + thick],
          [cx - arm, cy + thick]
        );
        break;
      }
      case "circle":
      default:
        return [];
    }

    return pts.map(rot);
  }

  drawCube(x, y, size, rollX, rollY, state, accentProgress) {
    const ctx = this.ctx;
    const h = size / 2;

    const verts = [
      [-h, -h, h],
      [h, -h, h],
      [h, h, h],
      [-h, h, h],
      [-h, -h, -h],
      [h, -h, -h],
      [h, h, -h],
      [-h, h, -h],
    ];

    function rotate(vx, vy, vz) {
      const x1 = vx * Math.cos(rollY) + vz * Math.sin(rollY);
      const z1 = -vx * Math.sin(rollY) + vz * Math.cos(rollY);
      const y1 = vy;
      const y2 = y1 * Math.cos(rollX) - z1 * Math.sin(rollX);
      const z2 = y1 * Math.sin(rollX) + z1 * Math.cos(rollX);
      return [x1, y2, z2];
    }

    const rotated = verts.map(([vx, vy, vz]) => rotate(vx, vy, vz));
    const p = rotated.map(([rx, ry]) => [rx, ry]);

    const faces = [
      { vIdx: [0, 1, 2, 3], normal: [0, 0, 1] },
      { vIdx: [5, 4, 7, 6], normal: [0, 0, -1] },
      { vIdx: [4, 5, 1, 0], normal: [0, -1, 0] },
      { vIdx: [3, 2, 6, 7], normal: [0, 1, 0] },
      { vIdx: [1, 5, 6, 2], normal: [1, 0, 0] },
      { vIdx: [4, 0, 3, 7], normal: [-1, 0, 0] },
    ];

    const light = [-0.4, -0.7, 0.6];
    const ap = accentProgress || 0;
    const baseGrey = 160;
    const alertGrey = 28;
    const gv = Math.round(baseGrey + (alertGrey - baseGrey) * ap);
    const edgeColor = state === "dead" ? "#cc0000" : `rgb(${gv},${gv},${gv})`;

    const faceData = faces.map((face) => {
      const [nx, ny, nz] = rotate(...face.normal);
      const dot = nx * light[0] + ny * light[1] + nz * light[2];
      const viewDot = nz;
      const brightness = Math.round(128 + ((dot + 1) / 2) * 118);
      const fill = `rgb(${brightness},${brightness},${brightness})`;
      const alpha = Math.max(
        0.15,
        Math.min(0.95, ((viewDot + 1) / 2) * 0.8 + 0.15)
      );
      const avgZ = face.vIdx.reduce((s, i) => s + rotated[i][2], 0) / 4;
      return { ...face, fill, alpha, avgZ };
    });

    faceData.sort((a, b) => a.avgZ - b.avgZ);

    ctx.save();
    ctx.translate(x, y);
    ctx.shadowColor = "rgba(0,0,0,0.18)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = 6;

    faceData.forEach((face, fi) => {
      if (fi === 1) {
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      }
      ctx.beginPath();
      face.vIdx.forEach((vi, i) => {
        const [sx, sy] = p[vi];
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      ctx.closePath();
      ctx.globalAlpha = face.alpha;
      ctx.fillStyle = face.fill;
      ctx.fill();
      ctx.globalAlpha = Math.max(0.12, face.alpha * 0.65);
      ctx.strokeStyle = edgeColor;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    });

    ctx.globalAlpha = 0.15;
    ctx.strokeStyle = edgeColor;
    ctx.lineWidth = 1;
    [
      [0, 4],
      [1, 5],
      [2, 6],
      [3, 7],
    ].forEach(([a, b]) => {
      ctx.beginPath();
      ctx.moveTo(p[a][0], p[a][1]);
      ctx.lineTo(p[b][0], p[b][1]);
      ctx.stroke();
    });

    ctx.globalAlpha = 1.0;
    ctx.restore();
  }

  drawOriginCrosshair() {
    const ctx = this.ctx,
      size = 20;
    ctx.save();
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(this.cx - size, this.cy);
    ctx.lineTo(this.cx + size, this.cy);
    ctx.moveTo(this.cx, this.cy - size);
    ctx.lineTo(this.cx, this.cy + size);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
}

// ────────────────────────────────────────────────────────────────
class InputManager {
  constructor() {
    this.keys = {};
    this.justPressed = {};
    window.addEventListener("keydown", (e) => {
      if (!this.keys[e.code]) this.justPressed[e.code] = true;
      this.keys[e.code] = true;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code))
        e.preventDefault();
    });
    window.addEventListener("keyup", (e) => {
      this.keys[e.code] = false;
    });
  }
  isDown(code) {
    return !!this.keys[code];
  }
  consume(code) {
    const w = !!this.justPressed[code];
    delete this.justPressed[code];
    return w;
  }
}

// ────────────────────────────────────────────────────────────────
class GameLoop {
  constructor(updateFn, drawFn) {
    this.update = updateFn;
    this.draw = drawFn;
    this.lastTime = 0;
    this.rafHandle = null;
    this.running = false;
  }
  start() {
    this.running = true;
    this.lastTime = performance.now();
    this._tick(this.lastTime);
  }
  stop() {
    this.running = false;
    cancelAnimationFrame(this.rafHandle);
  }
  _tick(now) {
    if (!this.running) return;
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;
    this.update(dt);
    this.draw();
    this.rafHandle = requestAnimationFrame((t) => this._tick(t));
  }
}
