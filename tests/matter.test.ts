import { describe, expect, it } from 'vitest';
import { World } from '../src/game/world';
import { MatterPhysics } from '../src/physics/matterPhysics';
import { makeTank, noWander } from './helpers';
import { STEP_MS } from '../src/config';

/**
 * Matter 集成回归：直接在 node 里跑真实物理循环（matter-js 无 DOM 依赖），
 * 复现验收反馈的“贴边卡死”场景——这是上一版限时跳转脱困失效的对照组。
 */
describe('Matter 物理集成', () => {
  it('指令指向墙内方向：坦克滑到墙边后贴墙切向移动，而非冻结在墙上', () => {
    const physics = new MatterPhysics();
    const world = new World(physics, 200, 200);
    world.rng = () => 0.5;
    const a = makeTank(world, 'machinegun', 60, 100, Math.PI / 2);
    physics.addTank(a);
    noWander(a);
    // 目标点在 x=195，而墙的有效边界是 x=180：后半程必然顶墙
    a.orderTarget = { x: 195, y: 100 };

    for (let i = 0; i < 300; i++) world.step(STEP_MS); // 预热：走到墙边
    expect(a.x).toBeGreaterThan(170);

    // 之后 10 秒：统计轨迹累计长度与横向偏移峰值，贴墙滑行应持续产生位移
    let path = 0;
    let maxDy = 0;
    let px = a.x;
    let py = a.y;
    for (let i = 0; i < 600; i++) {
      world.step(STEP_MS);
      path += Math.hypot(a.x - px, a.y - py);
      maxDy = Math.max(maxDy, Math.abs(a.y - 100));
      px = a.x;
      py = a.y;
      expect(Number.isFinite(a.x) && Number.isFinite(a.y)).toBe(true);
    }
    expect(path).toBeGreaterThan(50); // 若仍是“按压死锁”，路径会趋近 0
    expect(maxDy).toBeGreaterThan(5); // 避让扫掠确实把直线顶墙改成了斜向滑行
  });

  it('六车混战 25 秒：位置有界、数值有限、战斗持续进行', () => {
    const physics = new MatterPhysics();
    const world = new World(physics, 1000, 600);
    world.rng = () => 0.5; // 常量随机源 → 全部狙击型，340 射程混战
    world.spawn(6);

    for (let i = 0; i < 1500; i++) world.step(STEP_MS);

    for (const t of world.tanks) {
      expect(t.x).toBeGreaterThanOrEqual(t.size - 0.5);
      expect(t.x).toBeLessThanOrEqual(1000 - t.size + 0.5);
      expect(t.y).toBeGreaterThanOrEqual(t.size - 0.5);
      expect(t.y).toBeLessThanOrEqual(600 - t.size + 0.5);
    }
    const shots = world.tanks.reduce((s, t) => s + t.stats.shoot, 0);
    expect(shots).toBeGreaterThan(0); // 物理管线未阻断战斗
  });
});
