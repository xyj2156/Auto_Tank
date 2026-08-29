/** 角度工具。约定：角度 a 对应屏幕方向 (sin a, cos a)，画布坐标系 y 轴向下。 */

export const TAU = Math.PI * 2;

/** 归一化到 [0, 2π) */
export function normalizeAngle(a: number): number {
  a %= TAU;
  return a < 0 ? a + TAU : a;
}

/** 从 current 到 target 的带符号最短角差，结果在 (-π, π] */
export function angleDiff(target: number, current: number): number {
  let d = normalizeAngle(target - current);
  if (d > Math.PI) d -= TAU;
  return d;
}

/** 按最大步长 maxStep(rad) 向 target 旋转；足够接近时直接吸附到 target */
export function turnToward(current: number, target: number, maxStep: number): number {
  const d = angleDiff(target, current);
  if (Math.abs(d) <= maxStep) return normalizeAngle(target);
  return normalizeAngle(current + Math.sign(d) * maxStep);
}

/** 方向向量 (dx, dy) → 本约定下的角度 */
export function directionAngle(dx: number, dy: number): number {
  return normalizeAngle(Math.atan2(dx, dy));
}

export function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
