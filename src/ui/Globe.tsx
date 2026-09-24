import { useEffect, useRef } from 'react';
import { LAND_HEXES } from './geometry';

interface Props {
  /** Colour per territory index. */
  colors: string[];
  /** Longitude/latitude to face; the globe eases toward it. */
  focus: [number, number];
  /** Degrees per second of idle drift. */
  spin?: number;
  className?: string;
}

const RAD = Math.PI / 180;

/** An orthographic dot-globe drawn from the game's own hex map. */
export function Globe({ colors, focus, spin = 4, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const state = useRef({ lon: focus[0] - 30, lat: 10, focus, colors, spin, drift: 0 });
  state.current.focus = focus;
  state.current.colors = colors;
  state.current.spin = spin;

  useEffect(() => {
    state.current.drift = 0;
  }, [focus]);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = state.current;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = c.clientWidth;
      const h = c.clientHeight;
      if (c.width !== Math.round(w * dpr)) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // Ease toward the focus, then drift slowly eastward.
      s.drift += reduced ? 0 : s.spin * dt;
      const target = s.focus[0] - s.drift;
      const dl = ((target - s.lon + 540) % 360) - 180;
      s.lon += dl * Math.min(1, dt * 2.2);
      s.lat += (Math.max(-25, Math.min(35, s.focus[1] * 0.6)) - s.lat) * Math.min(1, dt * 2.2);

      const R = Math.min(w, h) * 0.46;
      const cx = w / 2;
      const cy = h / 2;
      const lam0 = s.lon * RAD;
      const phi0 = s.lat * RAD;
      const sinP0 = Math.sin(phi0);
      const cosP0 = Math.cos(phi0);

      // Atmosphere.
      const atm = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.25);
      atm.addColorStop(0, 'rgba(90,170,255,0.28)');
      atm.addColorStop(1, 'rgba(90,170,255,0)');
      ctx.fillStyle = atm;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.25, 0, Math.PI * 2);
      ctx.fill();
      // Ocean sphere, lit from the upper left.
      const sea = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
      sea.addColorStop(0, '#16385a');
      sea.addColorStop(0.6, '#0b1f33');
      sea.addColorStop(1, '#061220');
      ctx.fillStyle = sea;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();
      // Graticule.
      ctx.strokeStyle = 'rgba(140,190,240,0.08)';
      ctx.lineWidth = 1;
      for (let lat = -60; lat <= 60; lat += 30) {
        ctx.beginPath();
        let pen = false;
        for (let lon = -180; lon <= 180; lon += 4) {
          const p = project(lon, lat);
          if (p) {
            if (pen) ctx.lineTo(p[0], p[1]);
            else ctx.moveTo(p[0], p[1]);
            pen = true;
          } else pen = false;
        }
        ctx.stroke();
      }
      for (let lon = -180; lon < 180; lon += 30) {
        ctx.beginPath();
        let pen = false;
        for (let lat = -80; lat <= 80; lat += 4) {
          const p = project(lon, lat);
          if (p) {
            if (pen) ctx.lineTo(p[0], p[1]);
            else ctx.moveTo(p[0], p[1]);
            pen = true;
          } else pen = false;
        }
        ctx.stroke();
      }
      // Land dots.
      const dot = Math.max(1.2, R / 150);
      for (const hx of LAND_HEXES) {
        const p = project(hx.lon, hx.lat);
        if (!p) continue;
        ctx.globalAlpha = 0.35 + 0.65 * p[2];
        ctx.fillStyle = s.colors[hx.t];
        ctx.beginPath();
        ctx.arc(p[0], p[1], dot * (0.75 + 0.35 * p[2]), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // Terminator shading and rim light.
      const shade = ctx.createRadialGradient(cx - R * 0.45, cy - R * 0.5, R * 0.2, cx, cy, R * 1.02);
      shade.addColorStop(0, 'rgba(255,255,255,0.06)');
      shade.addColorStop(0.55, 'rgba(0,0,0,0)');
      shade.addColorStop(1, 'rgba(0,6,14,0.55)');
      ctx.fillStyle = shade;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(150,210,255,0.35)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      raf = requestAnimationFrame(frame);

      function project(lon: number, lat: number): [number, number, number] | null {
        const lam = lon * RAD - lam0;
        const phi = lat * RAD;
        const cosPhi = Math.cos(phi);
        const cosc = sinP0 * Math.sin(phi) + cosP0 * cosPhi * Math.cos(lam);
        if (cosc < 0) return null;
        const x = cosPhi * Math.sin(lam);
        const y = cosP0 * Math.sin(phi) - sinP0 * cosPhi * Math.cos(lam);
        return [cx + R * x, cy - R * y, cosc];
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
