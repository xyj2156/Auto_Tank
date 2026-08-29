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

  it('触墙反射锁定：正东压右墙 → 斜向反弹进入锁定（非 180° 直线弹回）', () => {
    const world = makeWorld(600, 600);
    const a = makeTank(world, 'machinegun', 578, 300, EAST); // d.right = 600-20-578 = 2 < 接触带
    noWander(a);
    a.orderTarget = { x: 598, y: 300 }; // 指令点在墙内一侧，抵达后必然持续朝东顶墙
    updateAI(a, world, dt);
    expect(a.wallLock).toEqual({ axis: 'x', side: 1 });
    expect(a.vx).toBeLessThan(-45); // 法轴反射：向西撤离
    expect(Math.abs(a.vy)).toBeGreaterThan(20); // 叠加了切向斜置，不走原路乒乓
  });

  it('锁定迟滞：未到解锁距离前指令不得改向；离开后恢复常规决策', () => {
    const world = makeWorld(600, 600);
    const a = makeTank(world, 'machinegun', 560, 300, EAST);
    noWander(a);
    a.wallLock = { axis: 'x', side: 1 };
    a.lockHeading = WEST;
    a.orderTarget = { x: 598, y: 300 }; // 指令要求向东，但 d.right=20<60，锁定维持向西

    updateAI(a, world, dt);
    expect(a.wallLock).not.toBeNull();
    expect(a.vx).toBeLessThan(0);

    a.x = 500; // d.right = 80 > 60 → 本帧走完解除锁定
    updateAI(a, world, dt);
    expect(a.wallLock).toBeNull();

    updateAI(a, world, dt); // 解锁后指令重新接管 → 向东
    expect(a.vx).toBeGreaterThan(0);
  });

  it('擦墙不触发：贴接触带平行移动不锁、不反弹（消除“疯狂试探”）', () => {
    const world = makeWorld(600, 600);
    const a = makeTank(world, 'machinegun', 579, 300, 0); // d.right = 1px，朝正南（平行右墙）
    noWander(a);
    a.orderTarget = { x: 579, y: 500 }; // 指令沿墙直下
    updateAI(a, world, dt);
    expect(a.wallLock).toBeNull(); // 撞墙分量 0 < 阈值，不算撞
    expect(a.vy).toBeGreaterThan(0); // 正常南下
  });

  it('转角逐帧解套：先锁先撞的轴，几帧内二次反射合成斜向撤离', () => {
    const world = makeWorld(600, 600);
    const a = makeTank(world, 'machinegun', 578, 578, Math.PI / 4); // 东南向压右下角
    noWander(a);
    a.orderTarget = { x: 598, y: 598 };
    updateAI(a, world, dt);
    expect(a.wallLock).toEqual({ axis: 'x', side: 1 }); // 单轴触发，x 优先
    expect(a.vx).toBeLessThan(0);

    for (let i = 0; i < 5; i++) world.step(STEP_MS); // 锁定分支对底墙二次反射
    expect(a.wallLock?.axis).toBe('x'); // 撤离中锁定锚点不变
    expect(a.vx).toBeLessThan(0);
    expect(a.vy).toBeLessThan(0); // 已转为西北斜向撤离
  });

  it('锁定期间不停火：向西脱离的同时炮管转向东敌并命中', () => {
    const world = makeWorld(600, 600);
    const a = makeTank(world, 'machinegun', 560, 300, EAST);
    const c = makeTank(world, 'machinegun', 585, 300, WEST); // 贴墙靶机（对射距离内 → 原地停）
    noWander(a, c);
    tuneGun(a, { exp: null });
    tuneGun(c, { exp: null, accuracy: 0 }); // 不还手
    a.wallLock = { axis: 'x', side: 1 };
    a.lockHeading = WEST;

    for (let i = 0; i < 90; i++) world.step(STEP_MS); // 1.5s：转 180° 需约 60 步，之后开火
    expect(a.stats.shoot).toBeGreaterThanOrEqual(1);
    expect(a.stats.hit).toBeGreaterThanOrEqual(1); // 常量 rng=0.5 ≤ 命中线
    expect(c.hp).toBeLessThan(c.maxHp);
  });
});
