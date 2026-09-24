/**
 * A tiny particle/animation engine drawn on a canvas laid over the SVG map.
 * Positions live in map (SVG) coordinates; sizes are in screen pixels so effects
 * read the same at every zoom level.
 */

export interface View {
  x: number;
  y: number;
  /** Map units per screen pixel. */
  k: number;
}

type Draw = (ctx: CanvasRenderingContext2D, now: number, toScreen: (x: number, y: number) => [number, number]) => boolean;

interface Item {
  start: number;
  draw: Draw;
}

const ease = {
  out: (t: number) => 1 - Math.pow(1 - t, 3),
  inOut: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
};

function rgba(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`;
}

export class FxEngine {
  private items: Item[] = [];
  private canvas: HTMLCanvasElement | null = null;
  private raf = 0;
  private view: () => View = () => ({ x: 0, y: 0, k: 1 });
  reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  attach(canvas: HTMLCanvasElement | null, view: () => View) {
    this.canvas = canvas;
    this.view = view;
    if (canvas) this.kick();
  }

  clear() {
    this.items = [];
  }

  private add(delayMs: number, draw: Draw) {
    this.items.push({ start: performance.now() + delayMs, draw });
    this.kick();
  }

  private kick() {
    if (!this.raf && this.canvas) this.raf = requestAnimationFrame(this.frame);
  }

  private frame = (now: number) => {
    this.raf = 0;
    const c = this.canvas;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth;
    const h = c.clientHeight;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const v = this.view();
    const toScreen = (x: number, y: number): [number, number] => [(x - v.x) / v.k, (y - v.y) / v.k];
    this.items = this.items.filter((it) => {
      if (now < it.start) return true;
      return it.draw(ctx, now - it.start, toScreen);
    });
    if (this.items.length) this.raf = requestAnimationFrame(this.frame);
  };

  // ---------- effects ----------

  explosion(x: number, y: number, size = 1, color = '#ffb547', delay = 0) {
    const s = this.reduced ? 0.6 : size;
    // Flash core.
    this.add(delay, (ctx, t, P) => {
      const d = 260;
      if (t > d) return false;
      const [sx, sy] = P(x, y);
      const p = t / d;
      const r = (10 + 26 * ease.out(p)) * s;
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
      g.addColorStop(0, `rgba(255,236,160,${1 - p})`);
      g.addColorStop(0.35, rgba(color, 0.9 * (1 - p)));
      g.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
      return true;
    });
    // Shockwave ring.
    this.ring(x, y, 4 * s, 40 * s, 'rgba(17,17,17,1)', 420, 2, delay);
    if (this.reduced) return;
    // Sparks.
    const n = Math.round(14 * s);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = (60 + Math.random() * 140) * s;
      const life = 350 + Math.random() * 350;
      this.add(delay, (ctx, t, P) => {
        if (t > life) return false;
        const p = t / life;
        const [sx, sy] = P(x, y);
        const dist = v * ease.out(p) * 0.6;
        const px = sx + Math.cos(a) * dist;
        const py = sy + Math.sin(a) * dist + 30 * p * p;
        ctx.strokeStyle = `rgba(255,${200 - 120 * p},${80 - 60 * p},${1 - p})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px - Math.cos(a) * 6 * (1 - p), py - Math.sin(a) * 6 * (1 - p));
        ctx.stroke();
        return true;
      });
    }
    // Smoke.
    for (let i = 0; i < Math.round(4 * s); i++) {
      const ox = (Math.random() - 0.5) * 20 * s;
      const oy = (Math.random() - 0.5) * 12 * s;
      const life = 1100 + Math.random() * 700;
      this.add(delay + 80, (ctx, t, P) => {
        if (t > life) return false;
        const p = t / life;
        const [sx, sy] = P(x, y);
        const r = (6 + 18 * ease.out(p)) * s;
        ctx.fillStyle = `rgba(40,38,34,${0.35 * (1 - p)})`;
        ctx.beginPath();
        ctx.arc(sx + ox, sy + oy - 16 * p, r, 0, Math.PI * 2);
        ctx.fill();
        return true;
      });
    }
  }

  ring(x: number, y: number, r0: number, r1: number, color: string, dur = 600, width = 2, delay = 0) {
    this.add(delay, (ctx, t, P) => {
      if (t > dur) return false;
      const p = ease.out(t / dur);
      const [sx, sy] = P(x, y);
      ctx.strokeStyle = color.startsWith('#') ? rgba(color, 1 - t / dur) : color.replace(/[\d.]+\)$/, `${1 - t / dur})`);
      ctx.lineWidth = width * (1 - p) + 0.5;
      ctx.beginPath();
      ctx.arc(sx, sy, r0 + (r1 - r0) * p, 0, Math.PI * 2);
      ctx.stroke();
      return true;
    });
  }

  /** A glowing shell arcing from one territory to another. Calls onHit on arrival. */
  projectile(x1: number, y1: number, x2: number, y2: number, color: string, delay = 0, dur = 380, onHit?: () => void) {
    const bend = (Math.random() * 0.5 + 0.35) * (Math.random() < 0.5 ? -1 : 1);
    let hit = false;
    this.add(delay, (ctx, t, P) => {
      const p = Math.min(1, t / dur);
      const [ax, ay] = P(x1, y1);
      const [bx, by] = P(x2, y2);
      const mx = (ax + bx) / 2 - (by - ay) * bend * 0.35;
      const my = (ay + by) / 2 + (bx - ax) * bend * 0.35 - Math.hypot(bx - ax, by - ay) * 0.25;
      const at = (q: number): [number, number] => [
        (1 - q) * (1 - q) * ax + 2 * (1 - q) * q * mx + q * q * bx,
        (1 - q) * (1 - q) * ay + 2 * (1 - q) * q * my + q * q * by,
      ];
      const e = ease.inOut(p);
      // Trail.
      ctx.lineCap = 'round';
      for (let i = 0; i < 10; i++) {
        const q0 = Math.max(0, e - (i + 1) * 0.035);
        const q1 = Math.max(0, e - i * 0.035);
        const [a0, b0] = at(q0);
        const [a1, b1] = at(q1);
        ctx.strokeStyle = rgba(color, 0.7 * (1 - i / 10));
        ctx.lineWidth = 3.2 * (1 - i / 10);
        ctx.beginPath();
        ctx.moveTo(a0, b0);
        ctx.lineTo(a1, b1);
        ctx.stroke();
      }
      const [hx, hy] = at(e);
      const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, 7);
      g.addColorStop(0, 'rgba(17,17,17,1)');
      g.addColorStop(0.5, rgba(color, 0.9));
      g.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(hx, hy, 6, 0, Math.PI * 2);
      ctx.fill();
      if (p >= 1 && !hit) {
        hit = true;
        onHit?.();
      }
      return p < 1;
    });
  }

  /** Muzzle flash at the firing territory. */
  muzzle(x: number, y: number, color: string, delay = 0) {
    this.add(delay, (ctx, t, P) => {
      if (t > 140) return false;
      const [sx, sy] = P(x, y);
      const r = 14 * (1 - t / 140);
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
      g.addColorStop(0, 'rgba(255,255,255,0.9)');
      g.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
      return true;
    });
  }

  /** Dots marching along a line, for troop movements. */
  stream(x1: number, y1: number, x2: number, y2: number, color: string, count = 6, delay = 0) {
    const dur = 700;
    for (let i = 0; i < count; i++) {
      this.add(delay + i * 70, (ctx, t, P) => {
        if (t > dur) return false;
        const p = ease.inOut(t / dur);
        const [ax, ay] = P(x1, y1);
        const [bx, by] = P(x2, y2);
        const x = ax + (bx - ax) * p;
        const y = ay + (by - ay) * p;
        ctx.fillStyle = rgba(color, 1 - Math.pow(t / dur, 4));
        ctx.strokeStyle = 'rgba(17,17,17,0.9)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(x, y, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        return true;
      });
    }
  }

  text(x: number, y: number, text: string, color: string, delay = 0, big = false) {
    const dur = 1100;
    this.add(delay, (ctx, t, P) => {
      if (t > dur) return false;
      const p = t / dur;
      const [sx, sy] = P(x, y);
      ctx.font = `800 condensed ${big ? 16 : 14}px Archivo, "Arial Narrow", sans-serif`;
      ctx.textAlign = 'center';
      const yy = sy - 18 - 26 * ease.out(p);
      ctx.lineWidth = 3;
      ctx.strokeStyle = `rgba(255,255,255,${0.95 * (1 - p)})`;
      ctx.strokeText(text, sx, yy);
      ctx.fillStyle = rgba(color, 1 - Math.pow(p, 3));
      ctx.fillText(text, sx, yy);
      return true;
    });
  }

  /** Territory changes hands: shockwave rings and a burst of hex shards in the new colour. */
  capture(x: number, y: number, color: string, delay = 0) {
    this.ring(x, y, 6, 70, color, 800, 3, delay);
    this.ring(x, y, 4, 40, '#111111', 500, 1.5, delay + 60);
    if (this.reduced) return;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + Math.random() * 0.3;
      const v = 40 + Math.random() * 40;
      const rot = Math.random() * 6;
      this.add(delay, (ctx, t, P) => {
        const life = 700;
        if (t > life) return false;
        const p = ease.out(t / life);
        const [sx, sy] = P(x, y);
        const px = sx + Math.cos(a) * v * p;
        const py = sy + Math.sin(a) * v * p;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(rot + p * 3);
        ctx.fillStyle = rgba(color, 1 - t / life);
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const aa = (Math.PI / 3) * k;
          const r = 3.5 * (1 - p * 0.5);
          if (k === 0) ctx.moveTo(Math.cos(aa) * r, Math.sin(aa) * r);
          else ctx.lineTo(Math.cos(aa) * r, Math.sin(aa) * r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        return true;
      });
    }
  }

  /** Reinforcements drop in: a descending chevron and a pulse. */
  drop(x: number, y: number, color: string, n: number) {
    this.ring(x, y, 22, 6, color, 380, 2.5);
    this.ring(x, y, 8, 30, color, 600, 1.5, 300);
    this.text(x, y, `+${n}`, color, 120);
  }

  nuke(x: number, y: number) {
    const dur = 3200;
    this.add(0, (ctx, t, P) => {
      if (t > dur) return false;
      const p = t / dur;
      const [sx, sy] = P(x, y);
      const r = 30 + 380 * ease.out(p);
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
      g.addColorStop(0, `rgba(255,255,255,${1 - p})`);
      g.addColorStop(0.3, `rgba(255,210,120,${0.9 * (1 - p)})`);
      g.addColorStop(0.7, `rgba(255,90,40,${0.5 * (1 - p)})`);
      g.addColorStop(1, 'rgba(255,90,40,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
      return true;
    });
    for (let i = 0; i < 3; i++) this.ring(x, y, 10, 500, 'rgba(255,255,255,1)', 1600, 4, i * 250);
  }
}
