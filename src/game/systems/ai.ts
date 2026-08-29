import { ARRIVE_EPS } from '../../config';
import { angleDiff, directionAngle, normalizeAngle, turnToward } from '../../core/math';
import type { Tank } from '../tank';
import type { World } from '../world';

/**
 * AI 系统：索敌（粘性目标 + 炮口夹角加权）→ 决策移动 → 旋转炮管。
 * 旧版 bug 的修正：
 * - 索敌角度过滤用的“敌车车头角 + 常数 7”改为真实的炮口夹角加权；
 * - 象限分支转向改为最短角差 clamp（消除炮口抖动）。
 */
export function updateAI(t: Tank, world: World, dtMs: number): void {
  const dtS = dtMs / 1000;

  // —— 目标校验：死亡或超出追击范围则放弃 ——
  if (t.foe && (!t.foe.alive || t.distanceTo(t.foe.x, t.foe.y) > t.pursuitRange + t.size)) {
    t.foe = null;
  }
  if (!t.foe) t.foe = findTarget(t, world);

  // —— 移动决策 ——
  let moving = true;
  if (t.orderTarget) {
    const dx = t.orderTarget.x - t.x;
    const dy = t.orderTarget.y - t.y;
    if (Math.sqrt(dx * dx + dy * dy) <= ARRIVE_EPS) {
      t.orderTarget = null;
    } else {
      t.heading = directionAngle(dx, dy);
    }
  } else if (t.foe) {
    const d = t.distanceTo(t.foe.x, t.foe.y);
    if (d <= t.gun.sight + t.size) {
      moving = false; // 进入射程，停下对射
    } else {
      t.heading = t.angleTo(t.foe.x, t.foe.y); // 追击
    }
  } else {
    // 游走：定期小角度转向，避免永远贴墙
    if (world.clock >= t.wanderAt) {
      t.heading = directionAngle(
        Math.sin(t.heading) + (world.rng() - 0.5),
        Math.cos(t.heading) + (world.rng() - 0.5)
      );
      t.wanderAt = world.clock + 1500 + world.rng() * 3000;
    }
  }

  // —— 脱困机动：物理层报告“想动但没动”（顶墙/被别车卡住）时，限时向侧后方绕行 ——
  if (moving && world.clock < t.escapeUntil) {
    t.heading = t.escapeHeading;
  } else if (t.blocked && moving) {
    t.blockFlip = !t.blockFlip;
    t.escapeHeading = normalizeAngle(t.heading + (t.blockFlip ? 1 : -1) * 2.4);
    t.escapeUntil = world.clock + 450;
    t.heading = t.escapeHeading;
    moving = true;
  }

  t.stopped = !moving;
  const speed = moving ? t.speed : 0;
  t.vx = Math.sin(t.heading) * speed;
  t.vy = Math.cos(t.heading) * speed;

  // —— 炮管旋转：向目标或车头方向以最大角速度 clamp ——
  const want = t.foe ? t.angleTo(t.foe.x, t.foe.y) : t.heading;
  t.gunHeading = turnToward(t.gunHeading, want, t.gun.rotRad * dtS);
}

/** 在视野内挑选“炮口夹角 + 距离”综合最优的敌人 */
export function findTarget(t: Tank, world: World): Tank | null {
  let best: Tank | null = null;
  let bestScore = Infinity;
  const range = t.sight + t.size;
  for (const other of world.tanks) {
    if (other === t || !other.alive) continue;
    const dx = other.x - t.x;
    const dy = other.y - t.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > range) continue;
    const off = Math.abs(angleDiff(t.angleTo(other.x, other.y), t.gunHeading)); // 0~π
    // 偏向炮口方向的敌人，兼顾距离；不再需要旧版形同虚设的 7 弧度阈值
    const score = d * (0.5 + off / Math.PI);
    if (score < bestScore) {
      bestScore = score;
      best = other;
    }
  }
  return best;
}

/** 炮管是否已对准当前敌人（可开火判定，供战斗系统使用） */
export function gunAligned(t: Tank): boolean {
  if (!t.foe || !t.foe.alive) return false;
  const want = t.angleTo(t.foe.x, t.foe.y);
  return Math.abs(angleDiff(want, t.gunHeading)) <= 0.001;
}
