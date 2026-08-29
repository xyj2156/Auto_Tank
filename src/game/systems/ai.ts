import { ARRIVE_EPS } from '../../config';
import { angleDiff, clamp, directionAngle, normalizeAngle, turnToward } from '../../core/math';
import type { Tank } from '../tank';
import type { World } from '../world';

/** 扫掠避让参数：扫出快、回正慢 → 迟滞环让坦克以掠射角贴墙滑行 */
const AVOID_RATE = 3.0; // 顶墙时偏转扫描速度 rad/s
const RELAX_RATE = 1.5; // 解除后回正速度 rad/s（小于扫描速度，形成迟滞）
const AVOID_MAX = 2.6;  // 最大偏转 ≈150°，到极值反向扫描（应对死角/车堆）

/**
 * AI 系统：索敌（粘性目标 + 炮口夹角加权）→ 决策移动 → 扫掠避让 → 旋转炮管。
 * 旧版 bug 的修正：
 * - 索敌角度过滤用的“敌车车头角 + 常数 7”改为真实的炮口夹角加权；
 * - 象限分支转向改为最短角差 clamp（消除炮口抖动）；
 * - 顶墙死锁改为位移检测 + 渐进扫掠避让（上一版 137° 跳转 + 方向交替会左右摆动抵消，已废弃）。
 */
export function updateAI(t: Tank, world: World, dtMs: number): void {
  const dtS = dtMs / 1000;

  // —— 目标校验：死亡或超出追击范围则放弃 ——
  if (t.foe && (!t.foe.alive || t.distanceTo(t.foe.x, t.foe.y) > t.pursuitRange + t.size)) {
    t.foe = null;
  }
  if (!t.foe) t.foe = findTarget(t, world);

  // —— 移动目标方向（goalHeading 保持“干净”，避让偏压单独叠加）——
  let moving = true;
  if (t.orderTarget) {
    const dx = t.orderTarget.x - t.x;
    const dy = t.orderTarget.y - t.y;
    if (Math.sqrt(dx * dx + dy * dy) <= ARRIVE_EPS) {
      t.orderTarget = null;
    } else {
      t.goalHeading = directionAngle(dx, dy);
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

  // —— 扫掠避让：物理层报告“想动但没动”时渐进偏转寻找切向通路，解除后缓慢回正 ——
  if (t.blocked) {
    t.avoid = clamp(t.avoid + t.avoidDir * AVOID_RATE * dtS, -AVOID_MAX, AVOID_MAX);
    if (Math.abs(t.avoid) >= AVOID_MAX) t.avoidDir = -t.avoidDir;
  } else if (t.avoid !== 0) {
    t.avoid =
      Math.abs(t.avoid) <= RELAX_RATE * dtS ? 0 : t.avoid - Math.sign(t.avoid) * RELAX_RATE * dtS;
  }

  if (moving) t.heading = normalizeAngle(t.goalHeading + t.avoid);

  t.stopped = !moving;
  const speed = moving ? t.speed : 0;
  t.vx = Math.sin(t.heading) * speed;
  t.vy = Math.cos(t.heading) * speed;

  // —— 炮管旋转：向目标或车头方向以最大角速度 clamp（避让机动期间照常跟踪开火）——
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
