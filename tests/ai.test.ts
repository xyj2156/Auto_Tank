import { describe, expect, it } from 'vitest';
import { findTarget, gunAligned, updateAI } from '../src/game/systems/ai';
import { EAST, makeTank, makeWorld, noWander, tuneGun, WEST } from './helpers';
import { STEP_MS, TANK_BASE } from '../src/config';

const dt = STEP_MS;

describe('AI 索敌与移动决策', () => {
  it('进入射程：停下对射，速度为零，炮管逐渐转向目标', () => {
    const world = makeWorld();
    const a = makeTank(world, 'machinegun', 100, 400, EAST);
    const b = makeTank(world, 'machinegun', 240, 400, WEST);
    noWander(a, b);

    updateAI(a, world, dt);
    expect(a.foe).toBe(b);
    expect(a.stopped).toBe(true);
    expect(a.vx).toBe(0);
    // 机枪 lv0 转速 180°/s，一步约 0.052rad，从 0 转到 π/2 需要多步
    for (let i = 0; i < 40; i++) updateAI(a, world, dt);
    expect(gunAligned(a)).toBe(true);
  });

  it('可见但在射程外：追击（向东速度为正）', () => {
    const world = makeWorld();
    const a = makeTank(world, 'machinegun', 100, 400, EAST);
    const b = makeTank(world, 'machinegun', 300, 400, WEST); // 距离 200：>射程160，≤视野220
    noWander(a, b);

    updateAI(a, world, dt);
    expect(a.foe).toBe(b);
    expect(a.stopped).toBe(false);
    expect(a.vx).toBeGreaterThan(0);
    expect(a.heading).toBeCloseTo(EAST);
  });

  it('目标阵亡或逃出追击范围后放弃', () => {
    const world = makeWorld();
    const a = makeTank(world, 'machinegun', 100, 400, EAST);
    const b = makeTank(world, 'machinegun', 240, 400, WEST);
    noWander(a, b);
    updateAI(a, world, dt);
    expect(a.foe).toBe(b);

    b.alive = false;
    updateAI(a, world, dt);
    expect(a.foe).toBeNull();
  });

  it('粘性目标：更近的新目标出现也不立刻放弃当前目标', () => {
    const world = makeWorld();
    const a = makeTank(world, 'machinegun', 100, 400, EAST);
    const b = makeTank(world, 'machinegun', 240, 400, WEST);
    const c = makeTank(world, 'machinegun', 200, 405, WEST);
    noWander(a, b, c);
    updateAI(a, world, dt);
    a.foe = b;
    updateAI(a, world, dt);
    expect(a.foe).toBe(b); // 未死未超程，保持粘性
  });

  it('findTarget 在无敌人时返回 null', () => {
    const world = makeWorld();
    const a = makeTank(world, 'machinegun', 100, 100, EAST);
    noWander(a);
    expect(findTarget(a, world)).toBeNull();
  });

  it('移动指令优先：朝指令点行进，到达后清除', () => {
    const world = makeWorld();
    const a = makeTank(world, 'machinegun', 400, 400, EAST);
    tuneGun(a, { accuracy: 0 }); // 不让战斗干扰
    const foe = makeTank(world, 'machinegun', 410, 400, WEST);
    noWander(a, foe);

    a.orderTarget = { x: 200, y: 400 };
    updateAI(a, world, dt);
    // 有指令时压过对射停顿
    expect(a.vx).toBeLessThan(0);
    expect(a.heading).toBeCloseTo(WEST);

    a.orderTarget = { x: a.x - 4, y: 400 }; // 距离 < ARRIVE_EPS
    updateAI(a, world, dt);
    expect(a.orderTarget).toBeNull();
  });

  it('游走：随机源驱动转向且会安排下次转向时刻', () => {
    const world = makeWorld();
    world.rng = () => 0.99;
    const a = makeTank(world, 'machinegun', 400, 400, EAST);
    a.wanderAt = 0;
    updateAI(a, world, dt);
    expect(a.wanderAt).toBeGreaterThan(0);
    expect(a.heading).not.toBeCloseTo(EAST);
    expect(Math.hypot(a.vx, a.vy)).toBeCloseTo(TANK_BASE.speed);
  });
});
