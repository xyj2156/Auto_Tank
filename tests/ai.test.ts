import { describe, expect, it } from 'vitest';
import { findTarget, gunAligned, updateAI } from '../src/game/systems/ai';
import { angleDiff } from '../src/core/math';
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

  it('卡死避让：blocked 期间渐进扫偏且保持移动与索敌；解除后迟滞回正', () => {
    const world = makeWorld();
    const a = makeTank(world, 'machinegun', 100, 400, EAST);
    const b = makeTank(world, 'machinegun', 300, 400, WEST); // 距离 200：可见但在射程外，本应向东追击
    noWander(a, b);

    a.blocked = true; // 模拟物理层报告“顶墙/被挤住”
    updateAI(a, world, dt);
    expect(Math.abs(a.avoid)).toBeGreaterThan(0); // 偏转量开始累积
    expect(Math.abs(angleDiff(a.heading, EAST))).toBeGreaterThan(0.04); // 已偏离撞墙方向
    expect(Math.hypot(a.vx, a.vy)).toBeCloseTo(TANK_BASE.speed); // 机动中保持全速移动
    expect(a.foe).toBe(b); // 索敌与炮管跟踪不受影响

    // 持续顶墙：扫掠角连续增大（不是跳转一次就回头）
    for (let i = 0; i < 30; i++) updateAI(a, world, dt);
    expect(Math.abs(a.avoid)).toBeGreaterThan(0.5);

    // 解除卡住 → 以低于扫掠的速度渐进回正
    a.blocked = false;
    for (let i = 0; i < 120; i++) updateAI(a, world, dt);
    expect(a.avoid).toBe(0);
    expect(a.heading).toBeCloseTo(EAST); // 恢复向东追击
  });

  it('避让扫掠方向具有粘滞性：未扫到极限不会反向，避免左右抵消', () => {
    const world = makeWorld();
    const a = makeTank(world, 'machinegun', 100, 400, EAST);
    const b = makeTank(world, 'machinegun', 300, 400, WEST);
    noWander(a, b);

    // 极限(2.6rad)之前持续扫到极限：40 步远未到达（约 52 步），方向应始终如一
    for (let i = 0; i < 40; i++) {
      a.blocked = true;
      updateAI(a, world, dt);
      expect(a.avoidDir).toBe(1);
    }
    expect(a.avoid).toBeGreaterThan(1.5); // 单向持续累积，而非来回摆动
    expect(a.avoid).toBeLessThanOrEqual(2.6);
  });
});
