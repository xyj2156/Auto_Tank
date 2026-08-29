import type { Tank } from './tank';
import type { World } from './world';
import { directionAngle } from '../core/math';

/** 物理适配器接口：逻辑层只产出期望速度 (vx, vy)，位置由适配器写回 */
export interface PhysicsAdapter {
  addTank(t: Tank): void;
  removeTank(t: Tank): void;
  setBounds(width: number, height: number): void;
  /** 窗口缩放时按比例移动刚体 */
  scalePositions(sx: number, sy: number): void;
  /** 步进 dtMs，更新所有坦克的 x/y */
  step(world: World, dtMs: number): void;
  /** 清空所有刚体（回合重开） */
  clear(): void;
}

/** 无引擎运动学：欧拉积分 + 边界反弹（还原旧版行为），供单测与 Matter 缺席时兜底 */
export class KinematicPhysics implements PhysicsAdapter {
  addTank(): void {}
  removeTank(): void {}
  clear(): void {}
  scalePositions(): void {}

  private width = 0;
  private height = 0;

  setBounds(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  step(world: World, dtMs: number): void {
    const dtS = dtMs / 1000;
    for (const t of world.tanks) {
      if (!t.alive) continue;
      t.blocked = false; // 运动学模式自带边界反弹，不存在卡死
      t.x += t.vx * dtS;
      t.y += t.vy * dtS;
      const min = t.size;
      if (t.x < min) {
        t.x = min;
        if (t.vx < 0) t.vx = -t.vx;
      } else if (t.x > this.width - min) {
        t.x = this.width - min;
        if (t.vx > 0) t.vx = -t.vx;
      }
      if (t.y < min) {
        t.y = min;
        if (t.vy < 0) t.vy = -t.vy;
      } else if (t.y > this.height - min) {
        t.y = this.height - min;
        if (t.vy > 0) t.vy = -t.vy;
      }
      if (t.vx !== 0 || t.vy !== 0) {
        t.heading = directionAngle(t.vx, t.vy);
        t.moveHeading = t.heading;
      }
    }
  }
}
