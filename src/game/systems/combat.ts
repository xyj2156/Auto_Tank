import { KIND_NAMES, MESSAGE_MS, TRACER_MS } from '../../config';
import type { Tank } from '../tank';
import type { World } from '../world';
import { gunAligned } from './ai';

/**
 * 战斗系统：hitscan 开火、伤害统计、暴击、炮塔/坦克升级、击杀公告。
 * 时序全部走世界时钟（reloadAt），不再用 setTimeout。
 */
export function updateCombat(t: Tank, world: World): void {
  const foe = t.foe;
  if (!foe || !foe.alive) return;
  if (!gunAligned(t)) return;
  if (t.distanceTo(foe.x, foe.y) > t.gun.sight + t.size) return;
  if (world.clock < t.reloadAt) return;

  const gun = t.gun;
  t.reloadAt = world.clock + gun.timeout;
  t.stats.shoot++;

  // 命中率判定（旧版守卫 `!obj && !obj.position` 的隐患在类型层已杜绝）
  if (world.rng() > gun.accuracy) {
    setTankMessage(t, world, `我操，没打中。${foe.id} 躲的够快。`);
    return;
  }
  t.stats.hit++;

  // 命中才画弹道（与旧版一致：落空只有头顶文字）
  world.tracers.push({
    x1: t.gunMuzzle.x,
    y1: t.gunMuzzle.y,
    x2: foe.x,
    y2: foe.y,
    width: Math.max(1, gun.width * 0.6),
    hue: t.hue,
    bornAt: world.clock,
    life: TRACER_MS
  });

  let power = gun.power * (0.7 + 0.3 * world.rng());
  if (world.rng() > 0.95) {
    // 暴击：额外附加 0~100% 伤害（修正旧版 `power += power *= r` 的连环赋值歧义）
    power *= 1 + world.rng();
    setTankMessage(t, world, `对 ${foe.id} 造成暴击伤害 ${Math.round(power * 100) / 100}`);
  }

  applyDamage(t, foe, power, world);
  settleUpgrades(t, world);
}

/** 扣血 + 双向统计 + 击杀公告（导出供测试与后续新武器复用） */
export function applyDamage(from: Tank, to: Tank, power: number, world: World): void {
  to.hp -= power;
  if (to.hp < 0) to.hp = 0;

  to.stats.hurtIn[from.id] = (to.stats.hurtIn[from.id] ?? 0) + power;
  to.stats.hurtIn.all += power;
  from.stats.hurtOut[to.id] = (from.stats.hurtOut[to.id] ?? 0) + power;
  from.stats.hurtOut.all += power;

  if (to.hp <= 0 && to.alive) {
    to.hp = 0;
    to.alive = false;
    world.setBanner(
      `${from.id} 用 ${KIND_NAMES[from.kind]} 打死了 ${to.id}，${to.id} 使用${KIND_NAMES[to.kind]}`,
      MESSAGE_MS + 1000
    );
  }
}

/** 经验结算：炮塔升级（纯输出伤害）与坦克升级（输出 + 承受×0.3） */
export function settleUpgrades(t: Tank, world: World): void {
  const out = t.stats.hurtOut.all;
  const gun = t.gun;
  if (gun.exp !== null && out > gun.exp) {
    t.upgradeGun(gun.lv + 1);
    setTankMessage(t, world, `炮塔升级了，当前 ${t.gun.lv + 1} 级。`);
  }

  const threshold = t.expTable[t.lv];
  const score = out + t.stats.hurtIn.all * 0.3;
  if (threshold !== undefined && score > threshold) {
    t.lv++;
    // 修正旧版 `strength += strength *= lv/100` 的反直觉写法：
    // 按等级提升生命上限，并回复等量提升值
    const gain = Math.round((t.strength * t.lv) / 100 * 100) / 100;
    t.maxHp += gain;
    t.hp = Math.min(t.maxHp, t.hp + gain);
    setTankMessage(t, world, `坦克升级到 ${t.lv + 1} 级。`);
  }
}

export function setTankMessage(t: Tank, world: World, text: string, ms = MESSAGE_MS): void {
  t.msg = { text, expiresAt: world.clock + ms };
}
