import { World } from '../src/game/world';
import { KinematicPhysics } from '../src/game/physics';
import { Tank } from '../src/game/tank';
import { buildExpTable, type WeaponKind } from '../src/config';

let seq = 0;

/** 确定性线性同余随机源（用于需要“分布”但不能引入抖动的测试） */
export function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

export function makeWorld(width = 1200, height = 800): World {
  const world = new World(new KinematicPhysics(), width, height);
  world.rng = () => 0.5; // 默认常量随机源：命中判定 0.5>acc(1) 为假 → 必命中
  return world;
}

/** 直接构造坦克（不经 addTank 的随机落点），便于精确编排场景 */
export function makeTank(
  world: World,
  kind: WeaponKind,
  x: number,
  y: number,
  heading: number,
  tweak: Partial<Pick<Tank, 'hp' | 'maxHp' | 'expTable'>> = {}
): Tank {
  seq += 1;
  const t = new Tank({
    id: `T${seq}`,
    kind,
    x,
    y,
    heading,
    expTable: tweak.expTable ?? buildExpTable(20)
  });
  t.hue = 0; // 构造器内 Math.random 不参与逻辑，置 0 保证快照稳定
  if (tweak.hp !== undefined) t.hp = tweak.hp;
  if (tweak.maxHp !== undefined) t.maxHp = tweak.maxHp;
  world.tanks.push(t);
  return t;
}

/** 锁定精度/装填/经验门槛，消除随机对断言的干扰 */
export function tuneGun(t: Tank, over: Partial<{ accuracy: number; timeout: number; exp: number | null }>): void {
  t.gun = { ...t.gun, ...over };
}

/** 关闭游走随机转向（wanderAt 永不到期） */
export function noWander(...tanks: Tank[]): void {
  for (const t of tanks) t.wanderAt = Infinity;
}

/** 朝 +x 的角度（约定：方向 = (sin a, cos a)） */
export const EAST = Math.PI / 2;
/** 朝 -x */
export const WEST = (3 * Math.PI) / 2;
