import { describe, expect, it } from 'vitest';
import { updateAI } from '../src/game/systems/ai';
import { applyDamage, settleUpgrades, updateCombat } from '../src/game/systems/combat';
import { EAST, makeTank, makeWorld, noWander, tuneGun, WEST } from './helpers';
import { STEP_MS } from '../src/config';

const dt = STEP_MS;

/** 推进 AI+战斗一个逻辑帧（模拟 world.step 但不引入物理） */
function tickAICombat(world: ReturnType<typeof makeWorld>): void {
  world.clock += dt;
  for (const t of world.tanks) {
    if (!t.alive) continue;
    updateAI(t, world, dt);
    updateCombat(t, world);
  }
}

function runFrames(world: ReturnType<typeof makeWorld>, n: number): void {
  for (let i = 0; i < n; i++) tickAICombat(world);
}

describe('战斗系统', () => {
  it('对准且进入射程才开火；伤害 = power × (0.7+0.3×rng)，常量 rng=0.5 → ×0.85', () => {
    const world = makeWorld();
    const a = makeTank(world, 'machinegun', 100, 400, EAST);
    const b = makeTank(world, 'machinegun', 240, 400, WEST, { hp: 1e9, maxHp: 1e9 });
    noWander(a, b);
    tuneGun(a, { accuracy: 1, exp: null }); // 必中，冻结炮塔升级
    tuneGun(b, { accuracy: 0 });            // 靶机还手但永不命中

    runFrames(world, 1);
    expect(a.stats.shoot).toBe(1);
    expect(a.stats.hit).toBe(1);
    expect(b.hp).toBeCloseTo(1e9 - 2 * 0.85, 10);
    expect(b.stats.hurtIn[a.id]).toBeCloseTo(1.7, 10);
    expect(b.stats.hurtIn.all).toBeCloseTo(1.7, 10);
    expect(a.stats.hurtOut[b.id]).toBeCloseTo(1.7, 10);
    expect(world.tracers.length).toBe(1);
  });

  it('装填冷却基于世界时钟（旧版 setTimeout 的替代品）', () => {
    const world = makeWorld();
    const a = makeTank(world, 'machinegun', 100, 400, EAST);
    const b = makeTank(world, 'machinegun', 240, 400, WEST, { hp: 1e9, maxHp: 1e9 });
    noWander(a, b);
    tuneGun(a, { accuracy: 1, exp: null, timeout: 100 });
    tuneGun(b, { accuracy: 0 });

    runFrames(world, Math.floor(90 / dt)); // 90ms < 100ms 装填
    expect(a.stats.shoot).toBe(1);
    runFrames(world, Math.floor(40 / dt)); // 130ms > 100ms
    expect(a.stats.shoot).toBe(2);
  });

  it('未对准或超出射程不开火', () => {
    const world = makeWorld();
    const a = makeTank(world, 'sniper', 100, 400, WEST); // 炮口朝西，敌人在东
    const b = makeTank(world, 'machinegun', 240, 400, WEST);
    noWander(a, b);
    a.reloadAt = 0;

    updateAI(a, world, dt); // 这一步尚未转到位（狙击 lv0 60°/s → 每步 ~0.017rad）
    expect(a.foe).toBe(b);
    updateCombat(a, world);
    expect(a.stats.shoot).toBe(0);
  });

  it('命中率为 0 时：计入开火与落空消息，不产生伤害', () => {
    const world = makeWorld();
    const a = makeTank(world, 'machinegun', 100, 400, EAST);
    const b = makeTank(world, 'machinegun', 240, 400, WEST);
    noWander(a, b);
    tuneGun(a, { accuracy: 0 });

    tickAICombat(world);
    expect(a.stats.shoot).toBe(1);
    expect(a.stats.hit).toBe(0);
    expect(b.hp).toBe(b.maxHp);
    expect(a.msg?.text).toContain('没打中');
  });

  it('击杀：置死、公告、双向统计；剩余 1 人时安排重开', () => {
    const world = makeWorld();
    const a = makeTank(world, 'machinegun', 100, 400, EAST);
    const b = makeTank(world, 'machinegun', 240, 400, WEST, { hp: 5 });
    noWander(a, b);
    tuneGun(a, { accuracy: 1, exp: null });
    tuneGun(b, { accuracy: 0 });

    // 每发 1.7，5 血需 3 发；冷却 100ms → 约 210ms
    runFrames(world, Math.ceil(260 / dt));
    expect(b.alive).toBe(false);
    expect(world.banner?.text).toContain('打死');
    expect(world.banner?.text).toContain('机枪型');

    // cull 在 step 中；跑一个完整 step（Kinematic 物理对位置无影响）
    world.step(dt);
    expect(world.tanks).not.toContain(b);
    expect(world.tanks.length).toBe(1);
  });

  it('applyDamage 幂等安全：对已死目标不重复触发公告', () => {
    const world = makeWorld();
    const a = makeTank(world, 'machinegun', 100, 400, EAST);
    const b = makeTank(world, 'machinegun', 240, 400, WEST, { hp: 1 });
    applyDamage(a, b, 10, world);
    const first = world.banner?.text;
    applyDamage(a, b, 10, world);
    expect(world.banner?.text).toBe(first);
    expect(b.alive).toBe(false);
    expect(b.hp).toBe(0);
  });

  it('炮塔升级：越过 exp 阈值换装，且不重复触发；修复旧版射程随升级累加的 bug', () => {
    const world = makeWorld();
    const a = makeTank(world, 'machinegun', 100, 400, EAST, { expTable: [] });
    a.stats.hurtOut.all = 201;
    const sightBefore = a.sight;
    settleUpgrades(a, world);
    expect(a.gun.lv).toBe(1);
    settleUpgrades(a, world); // 201 < 350 不应再升
    expect(a.gun.lv).toBe(1);
    // sight 不小于射程，但不会每次叠加 size
    expect(a.sight).toBe(Math.max(sightBefore, a.gun.sight));
    expect(a.msg?.text).toContain('炮塔升级');
  });

  it('坦克升级：提升上限并回复等量（修复旧版 strength += strength*=lv/100 的血量蒸发 bug）', () => {
    const world = makeWorld();
    const a = makeTank(world, 'machinegun', 100, 400, EAST, { hp: 400, maxHp: 800 });
    a.stats.hurtOut.all = 200;
    settleUpgrades(a, world); // expTable[0] = 160
    expect(a.lv).toBe(1);
    expect(a.maxHp).toBe(800 + Math.round((800 * 1) / 100)); // 8 + 800 = 808
    expect(a.hp).toBe(408);
    expect(a.msg?.text).toContain('坦克升级');
  });
});
