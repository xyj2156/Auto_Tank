import { ARRIVE_EPS } from '../../config';
import { angleDiff, directionAngle, turnToward } from '../../core/math';
import type { Tank } from '../tank';
import type { World } from '../world';

/** 触墙反射锁参数（用户指定方案：不预测“开始撞墙”，真撞上才锁，退到指定距离解锁） */
const WALL_CONTACT = 3; // 真实接触带（px）：贴上才算撞
const WALL_PRESS_MIN = 0.35; // 撞墙分量阈值（≈20°）：沿墙掠过的擦碰永不触发，消除“疯狂试探”
const WALL_RELEASE = 60; // 锁定后退，离该墙超过此距离且目标不再压墙才解锁（px）
const WALL_RETREAT_MAX = 260; // 后退上限：目标始终压墙（如墙角蹲敌）时到此距离强制解锁，避免横穿全图
const OBLIQUE = 0.6; // 斜向反弹的切向分量（≈31°偏置）：解锁点已沿墙错位，回 approach 变小角度

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
 * AI 系统：索敌（粘性目标 + 炮口夹角加权）→ 移动决策 → 触墙反射锁 → 旋转炮管。
 * 顶墙脱困（用户方案“速度反向 + 距离限制”的完整形态）：真撞上（接触带内且
 * 撞墙分量>≈20°）才反向并锁定后退；解锁 = 离墙到位 且 当前意图不再压这面墙
 * （防止“退出去又折回来撞”的乒乓），退过上限则强制解锁兜底；
 * 双墙贴角时锁定方向直指战场中心，一发解套。纯几何判定，单测=浏览器行为。
 */
export function updateAI(t: Tank, world: World, dtMs: number): void {
  const dtS = dtMs / 1000;

  // —— 目标校验：死亡或超出追击范围则放弃 ——
  if (t.foe && (!t.foe.alive || t.distanceTo(t.foe.x, t.foe.y) > t.pursuitRange + t.size)) {
    t.foe = null;
  }
  if (!t.foe) t.foe = findTarget(t, world);

  // —— 常规移动决策始终评估：锁定期也刷新 goalHeading，
  //    解锁判定要靠它，敌方挪位后目标不再压墙的那一帧才能平滑衔接 ——
  let wantMove = true;
  if (t.orderTarget) {
    const ox = t.orderTarget.x - t.x;
    const oy = t.orderTarget.y - t.y;
    if (Math.sqrt(ox * ox + oy * oy) <= ARRIVE_EPS) {
      t.orderTarget = null;
      t.wanderAt = 0; // 指令完成：本帧就重掷游走方向，避免 goalHeading 残留指向墙
    } else {
      t.goalHeading = directionAngle(ox, oy);
    }
  } else if (t.foe) {
    const foeDist = t.distanceTo(t.foe.x, t.foe.y);
    if (foeDist <= t.gun.sight + t.size) {
      wantMove = false; // 进入射程，停下对射
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

  const d = wallDist(t, world);

  if (t.wallLock) {
    // —— 锁定态：沿锁定方向后退；双墙贴角直接奔战场中心一发解套，否则对二次触墙逐轴反射 ——
    let dx = Math.sin(t.lockHeading);
    let dy = Math.cos(t.lockHeading);
    const contactX = d.right < WALL_CONTACT || d.left < WALL_CONTACT;
    const contactY = d.bottom < WALL_CONTACT || d.top < WALL_CONTACT;
    if (contactX && contactY) {
      dx = world.width / 2 - t.x;
      dy = world.height / 2 - t.y;
    } else {
      if (
        (dx > WALL_PRESS_MIN && d.right < WALL_CONTACT) ||
        (dx < -WALL_PRESS_MIN && d.left < WALL_CONTACT)
      ) {
        dx = -dx;
      }
      if (
        (dy > WALL_PRESS_MIN && d.bottom < WALL_CONTACT) ||
        (dy < -WALL_PRESS_MIN && d.top < WALL_CONTACT)
      ) {
        dy = -dy;
      }
    }
    t.lockHeading = directionAngle(dx, dy);

    const w = t.wallLock;
    const away = w.axis === 'x' ? (w.side > 0 ? d.right : d.left) : w.side > 0 ? d.bottom : d.top;
    // 目标方向在这面墙法轴上的投影：>阈值说明“解锁后必然又折回来撞”；
    // 停顿对射（wantMove=false）没有移动意图，解锁后就地开火，不算折返
    const towardWall =
      wantMove &&
      (w.axis === 'x' ? Math.sin(t.goalHeading) : Math.cos(t.goalHeading)) * w.side >
        WALL_PRESS_MIN;
    // 解锁 = 距离到位且目标已不压墙；退过上限仍压墙（墙角蹲敌）则强制解锁兜底
    if ((away > WALL_RELEASE && !towardWall) || away > WALL_RETREAT_MAX) t.wallLock = null;
  } else if (wantMove) {
    // —— 真撞检测（事后式）：接触带内 + 目标方向撞墙分量足够大才锁 ——
    let dx = Math.sin(t.goalHeading);
    let dy = Math.cos(t.goalHeading);
    const hitX =
      (dx > WALL_PRESS_MIN && d.right < WALL_CONTACT) ||
      (dx < -WALL_PRESS_MIN && d.left < WALL_CONTACT);
    const hitY =
      (dy > WALL_PRESS_MIN && d.bottom < WALL_CONTACT) ||
      (dy < -WALL_PRESS_MIN && d.top < WALL_CONTACT);
    let lock: { axis: 'x' | 'y'; side: 1 | -1 } | null = null;
    if (hitX && hitY) {
      // 角落：不玩逐轴弹球，锁定方向直指战场中心
      lock =
        Math.abs(dx) >= Math.abs(dy)
          ? { axis: 'x', side: (dx > 0 ? 1 : -1) as 1 | -1 }
          : { axis: 'y', side: (dy > 0 ? 1 : -1) as 1 | -1 };
      t.lockHeading = directionAngle(world.width / 2 - t.x, world.height / 2 - t.y);
    } else if (hitX || hitY) {
      if (hitX) {
        lock = { axis: 'x', side: (dx > 0 ? 1 : -1) as 1 | -1 };
        dx = -dx;
        const ty = dy !== 0 ? Math.sign(dy) : t.hue % 2 === 0 ? 1 : -1;
        dy += ty * OBLIQUE;
      } else {
        lock = { axis: 'y', side: (dy > 0 ? 1 : -1) as 1 | -1 };
        dy = -dy;
        const tx = dx !== 0 ? Math.sign(dx) : t.hue % 2 === 0 ? 1 : -1;
        dx += tx * OBLIQUE;
      }
      t.lockHeading = directionAngle(dx, dy);
    }
    if (lock) t.wallLock = lock;
  }

  const moving = t.wallLock !== null ? true : wantMove;
  t.heading = t.wallLock ? t.lockHeading : t.goalHeading;

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
