import { describe, expect, it } from 'vitest';
import { angleDiff, clamp, directionAngle, normalizeAngle, round2, turnToward, TAU } from '../src/core/math';

const EAST = Math.PI / 2;
const WEST = (3 * Math.PI) / 2;

describe('角度约定与工具', () => {
  it('directionAngle 符合 (sin, cos) 约定', () => {
    expect(directionAngle(1, 0)).toBeCloseTo(EAST);
    expect(directionAngle(0, 1)).toBe(0);
    expect(directionAngle(-1, 0)).toBeCloseTo(WEST);
    expect(directionAngle(0, -1)).toBeCloseTo(Math.PI);
  });

  it('normalizeAngle 收敛到 [0, 2π)', () => {
    expect(normalizeAngle(-Math.PI / 2)).toBeCloseTo((3 * Math.PI) / 2);
    expect(normalizeAngle(TAU + 0.1)).toBeCloseTo(0.1);
  });

  it('angleDiff 取最短路径（跨 0 点）', () => {
    expect(angleDiff(0.1, TAU - 0.1)).toBeCloseTo(0.2);
    expect(angleDiff(TAU - 0.1, 0.1)).toBeCloseTo(-0.2);
    expect(angleDiff(Math.PI, 0)).toBeCloseTo(Math.PI);
  });

  it('turnToward 按步长 clamp，接近时精确吸附', () => {
    expect(turnToward(0, Math.PI / 2, 0.1)).toBeCloseTo(0.1);
    expect(turnToward(0.05, 0, 0.1)).toBe(0);
    // 跨 0 点向负方向转
    expect(turnToward(TAU - 0.05, 0.05, 0.2)).toBeCloseTo(0.05);
  });

  it('turnToward 迭代收敛不抖动（修复旧版象限法的炮口晃动）', () => {
    let a = 0;
    const target = Math.PI / 7;
    let steps = 0;
    while (Math.abs(angleDiff(target, a)) > 1e-9 && steps < 100) {
      const next = turnToward(a, target, 0.05);
      // 单调接近，不回摆
      if (steps > 0) expect(Math.abs(angleDiff(target, next))).toBeLessThan(Math.abs(angleDiff(target, a)));
      a = next;
      steps++;
    }
    expect(a).toBeCloseTo(target);
    // 吸附后原地不动
    expect(turnToward(a, target, 0.05)).toBe(a);
  });

  it('round2 / clamp', () => {
    expect(round2(1.2345)).toBe(1.23);
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
  });
});
