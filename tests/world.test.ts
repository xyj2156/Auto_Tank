import { describe, expect, it } from 'vitest';
import { makeTank, makeWorld, seededRng, tuneGun } from './helpers';
import { KinematicPhysics } from '../src/game/physics';
import { ROUND_RESET_MS, STEP_MS, TANK_BASE } from '../src/config';

describe('World 回合流程', () => {
  it('spawn 生成指定数量、布置在界内且互不重叠', () => {
    const world = makeWorld(1200, 800);
    world.rng = seededRng(20260829);
    world.spawn(8);
    expect(world.tanks.length).toBe(8);
    expect(world.count).toBe(8);
    for (const t of world.tanks) {
      expect(t.x).toBeGreaterThanOrEqual(TANK_BASE.size);
      expect(t.x).toBeLessThanOrEqual(1200 - TANK_BASE.size);
      expect(t.y).toBeGreaterThanOrEqual(TANK_BASE.size);
      expect(t.y).toBeLessThanOrEqual(800 - TANK_BASE.size);
      expect(t.alive).toBe(true);
    }
    for (let i = 0; i < world.tanks.length; i++) {
      for (let j = i + 1; j < world.tanks.length; j++) {
        const d = world.tanks[i].distanceTo(world.tanks[j].x, world.tanks[j].y);
        expect(d).toBeGreaterThanOrEqual(TANK_BASE.size * 2);
      }
    }
  });

  it('剩最后一人：公告胜者并按时重开一局', () => {
    const world = makeWorld();
    world.spawn(3);
    for (const t of world.tanks.slice(1)) t.alive = false;

    world.step(STEP_MS); // cull 触发胜利判定
    expect(world.tanks.length).toBe(1);
    expect(world.banner?.text).toContain('胜出');
    expect(world.awaitingReset()).toBe(true);

    // 推进到重开时刻：awaitingReset 变 false 即新回合已开始
    const deadline = world.clock + ROUND_RESET_MS + STEP_MS * 2;
    while (world.awaitingReset() && world.clock < deadline) world.step(STEP_MS);
    expect(world.tanks.length).toBe(3);
    expect(world.clock).toBeLessThan(STEP_MS * 4); // 新回合时钟归零重走
    expect(world.tanks[0].id).toBe('T1'); // 重新编号
  });

  it('同归于尽：无胜者也有公告与重开', () => {
    const world = makeWorld();
    world.spawn(2);
    for (const t of world.tanks) t.alive = false;
    world.step(STEP_MS);
    expect(world.tanks.length).toBe(0);
    expect(world.banner?.text).toContain('同归于尽');
  });

  it('Kinematic 物理：位置始终被约束在边界内', () => {
    const world = makeWorld(300, 200);
    const tanks = [0, 1, 2, 3].map((i) =>
      makeTank(world, 'machinegun', 60 + i * 50, 100, 0)
    );
    for (const t of tanks) {
      tuneGun(t, { accuracy: 0 }); // 不互相杀伤，纯测运动边界
      t.orderTarget = { x: 295, y: 195 }; // 全部命令冲向界外
    }
    for (let i = 0; i < 600; i++) world.step(STEP_MS);
    for (const t of world.tanks) {
      expect(t.x).toBeGreaterThanOrEqual(t.size - 0.001);
      expect(t.x).toBeLessThanOrEqual(300 - t.size + 0.001);
      expect(t.y).toBeGreaterThanOrEqual(t.size - 0.001);
      expect(t.y).toBeLessThanOrEqual(200 - t.size + 0.001);
      expect(Number.isFinite(t.x)).toBe(true);
      expect(Number.isFinite(t.y)).toBe(true);
    }
  });

  it('resize 更新边界并同步物理', () => {
    const world = makeWorld(800, 600);
    world.spawn(4);
    world.resize(1000, 700);
    expect(world.width).toBe(1000);
    expect(world.height).toBe(700);
    expect(world.physics).toBeInstanceOf(KinematicPhysics);
    // 缩小时越界坦克会被下一帧夹回
    world.resize(60, 60);
    for (const t of world.tanks) {
      t.x = 900;
      t.y = 900;
    }
    world.step(STEP_MS);
    for (const t of world.tanks) {
      expect(t.x).toBeLessThanOrEqual(60);
      expect(t.y).toBeLessThanOrEqual(60);
    }
  });

  it('addTank 支持指定兵种并挂入战场', () => {
    const world = makeWorld();
    const t = world.addTank('rocket');
    expect(t.gun.power).toBe(100);
    expect(t.kind).toBe('rocket');
    expect(world.tanks).toContain(t);
  });
});
