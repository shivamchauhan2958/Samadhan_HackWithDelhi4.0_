import { MAP_H, MAP_W } from "@/lib/ward";

// A camera is a zoom (s) about a map point (cx, cy), shown at a fractional screen point (fx, fy) of the map box.
export type Cam = { s: number; cx: number; cy: number; fx: number; fy: number };

export const IDENTITY_CAM: Cam = { s: 1, cx: MAP_W / 2, cy: MAP_H / 2, fx: 0.5, fy: 0.5 };

// The SVG uses preserveAspectRatio="xMidYMid slice", so one map unit is k pixels in both axes.
export function mapScale(cw: number, ch: number) {
  return Math.max(cw / MAP_W, ch / MAP_H);
}

// Group transform for the SVG camera layer. Equivalent to the screen math in toScreen().
export function camTransform(cw: number, ch: number, cam: Cam) {
  const k = mapScale(cw, ch);
  const dx = cam.fx * cw - cw / 2;
  const dy = cam.fy * ch - ch / 2;
  const tx = MAP_W / 2 + dx / k - cam.s * cam.cx;
  const ty = MAP_H / 2 + dy / k - cam.s * cam.cy;
  return `translate(${tx.toFixed(3)} ${ty.toFixed(3)}) scale(${cam.s.toFixed(4)})`;
}

// Map unit → container pixel.
export function toScreen(cw: number, ch: number, cam: Cam, x: number, y: number) {
  const k = mapScale(cw, ch);
  const dx = cam.fx * cw - cw / 2;
  const dy = cam.fy * ch - ch / 2;
  return {
    x: cw / 2 + dx + k * cam.s * (x - cam.cx),
    y: ch / 2 + dy + k * cam.s * (y - cam.cy),
  };
}

// Container pixel → map unit (inverse of toScreen), used for tap-to-place.
export function toMap(cw: number, ch: number, cam: Cam, px: number, py: number) {
  const k = mapScale(cw, ch);
  const dx = cam.fx * cw - cw / 2;
  const dy = cam.fy * ch - ch / 2;
  const x = cam.cx + (px - cw / 2 - dx) / (k * cam.s);
  const y = cam.cy + (py - ch / 2 - dy) / (k * cam.s);
  return {
    x: Math.min(Math.max(x, 0), MAP_W),
    y: Math.min(Math.max(y, 0), MAP_H),
  };
}
