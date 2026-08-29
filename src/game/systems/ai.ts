import { ARRIVE_EPS } from '../../config';
import { angleDiff, directionAngle, turnToward } from '../../core/math';
import type { Tank } from '../tank';
import type { World } from '../world';

/** 触墙反射锁定参数（用户指定方案：纯几何判定，不依赖物理引擎反馈） */
const WALL_CONTACT = 6; // 距墙接触带（px）
const WALL_RELEASE = 60; // 锁定期内离该墙超过此距离才解锁（px）
const PRESS_EPS = 0.05; // 朝向在该轴上的分量阈值，确保是“朝墙开”而非离开

/** 到四面墙的内侧距离（可为负=穿透，判定同样成立） */
function wallDist(t: Tank, world: World) {
  return {
    left: t.x - t.size,
    right: world.width - t.size - t.x,
    top: t.y - t.size,
    bottom: world.height - t.size - t.y
  };
}

/**
 * AI 系统：索敌（粘性目标 + 炮口夹角加权）→ 移动决策 → 触墙反射锁定 → 旋转炮管。
 * 顶墙脱困采用几何反射锁：触墙且朝向含撞墙分量时把方向沿该墙轴反射并锁定，
 * 保持反射方向行驶，直到离开该墙指定距离才解锁恢复 AI——
 * 不依赖物理引擎的速度/位移反馈，逻辑层单测与浏览器行为完全一致。
 */
export function updateAI(t: Tank, world: World, dtMs: number): void {
  const dtS = dtMs / 1000;

  // —— 目标校验：死亡或超出追击范围则放弃 ——
  if (t.foe && (!t.foe.alive || t.distanceTo(t.foe.x, t.foe.y) > t.pursuitRange + t.size)) {
    t.foe = null;
  }
  if (!t.foe) t.foe = findTarget(t, world);

  let moving = true;

  if (t.wallLock) {
    // —— 锁定态：沿反射方向行驶；贴到别的墙/死角时二次反射；离开锁定墙指定距离才解锁 ——
    let dx = Math.sin(t.lockHeading);
    let dy = Math.cos(t.lockHeading);
    const d = wallDist(t, world);
    if ((dx > PRESS_EPS && d.right < WALL_CONTACT) || (dx < -PRESS_EPS && d.left < WALL_CONTACT)) {
      dx = -dx;
    }
    if ((dy > PRESS_EPS && d.bottom < WALL_CONTACT) || (dy < -PRESS_EPS && d.top < WALL_CONTACT)) {
      dy = -dy;
    }
    t.lockHeading = directionAngle(dx, dy);
    t.heading = t.lockHeading;
    const away =
      t.wallLock.axis === 'x'
        ? t.wallLock.side > 0
          ? d.right
          : d.left
        : t.wallLock.side > 0
          ? d.bottom
          : d.top;
    if (away > WALL_RELEASE) t.wallLock = null; // 解锁后 goalHeading 照常驱动，指令/索敌不丢
  } else {
    // —— 常规移动决策：指令 > 对射停顿/追击 > 游走 ——
    if (t.orderTarget) {
      const ox = t.orderTarget.x - t.x;
      const oy = t.orderTarget.y - t.y;
      if (Math.sqrt(ox * ox + oy * oy) <= ARRIVE_EPS) {
        t.orderTarget = null;
      } else {
        t.goalHeading = directionAngle(ox, oy);
      }
    } else if (t.foe) {
      const d = t.distanceTo(t.foe.x, t.foe.y);
      if (d <= t.gun.sight + t.size) {
        moving = false; // 进入射程，停下对射
      } else {
        t.goalHeading = t.angleTo(t.foe.x, t.foe.y); // 追击
      }
    } else if (world.clock >= t.wanderAt) {
      // 游走：定期小角度转向
      t.goalHeading = directionAngle(
        Math.sin(t.goalHeading) + (world.rng() - 0.5),
        Math.cos(t.goalHeading) + (world.rng() - 0.5)
      );
      t.wanderAt = world.clock + 1500 + world.rng() * 3000;
    }
    t.heading = t.goalHeading;

    // —— 触墙检测（仅移动时）：撞哪面墙就沿哪根轴反射；转角可能同时撞两面墙 ——
    if (moving) {
      const d = wallDist(t, world);
      let dx = Math.sin(t.heading);
      let dy = Math.cos(t.heading);
      let lock: { axis: 'x' | 'y'; side: 1 | -1 } | null = null;
      if (dx > PRESS_EPS && d.right < WALL_CONTACT) {
        dx = -dx;
        lock = { axis: 'x', side: 1 };
      } else if (dx < -PRESS_EPS && d.left < WALL_CONTACT) {
        dx = -dx;
        lock = { axis: 'x', side: -1 };
      }
      if (dy > PRESS_EPS && d.bottom < WALL_CONTACT) {
        dy = -dy;
        lock = lock ?? { axis: 'y', side: 1 };
      } else if (dy < -PRESS_EPS && d.top < WALL_CONTACT) {
        dy = -dy;
        lock = lock ?? { axis: 'y', side: -1 };
      }
      if (lock) {
        t.heading = directionAngle(dx, dy);
        t.lockHeading = t.heading;
        t.wallLock = lock;
      }
    }
  }

  t.stopped = !moving;
  const speed = moving ? t.speed : 0;
  t.vx = Math.sin(t.heading) * speed;
  t.vy = Math.cos(t.heading) * speed;

  // —— 炮管旋转：向目标或车头方向以最大角速度 clamp（锁定机动期间照常跟踪开火）——
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
