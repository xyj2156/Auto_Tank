import Matter from 'matter-js';
import type { PhysicsAdapter } from '../game/physics';
import type { Tank } from '../game/tank';
import type { World } from '../game/world';
import { clamp, directionAngle } from '../core/math';

const WALL = 80;
/** Matter 速度单位：px / 16.666ms 标准步。固定步长下 px/s ÷ 60 即得 */
const VEL_DIV = 60;

/**
 * Matter.js 物理适配器：坦克为无转动的圆形刚体（inertia: Infinity），
 * 只受彼此推挤与边界墙阻挡；位置以物理为准写回逻辑层。
 * 旧版注释里“碰撞问题不好解决，不做了”的坦克互推/卡墙，由这一层兜住。
 */
export class MatterPhysics implements PhysicsAdapter {
  private engine: Matter.Engine;
  private walls: Matter.Body[] = [];
  private width = 0;
  private height = 0;

  constructor() {
    this.engine = Matter.Engine.create();
    this.engine.gravity.x = 0;
    this.engine.gravity.y = 0;
  }

  setBounds(width: number, height: number): void {
    this.width = width;
    this.height = height;
    for (const w of this.walls) Matter.Composite.remove(this.engine.world, w);
    this.walls = [
      rect(width / 2, -WALL / 2, width + WALL * 2, WALL),
      rect(width / 2, height + WALL / 2, width + WALL * 2, WALL),
      rect(-WALL / 2, height / 2, WALL, height + WALL * 2),
      rect(width + WALL / 2, height / 2, WALL, height + WALL * 2)
    ].map((b) => {
      Matter.Composite.add(this.engine.world, b);
      return b;
    });
  }

  addTank(t: Tank): void {
    const body = Matter.Bodies.circle(t.x, t.y, t.size, {
      inertia: Infinity, // 不因碰撞而自转
      friction: 0,
      frictionAir: 0,
      restitution: 0.05,
      mass: t.size / 10
    });
    t.body = body;
    Matter.Composite.add(this.engine.world, body);
  }

  removeTank(t: Tank): void {
    if (t.body) {
      Matter.Composite.remove(this.engine.world, t.body as Matter.Body);
      t.body = null;
    }
  }

  scalePositions(sx: number, sy: number): void {
    for (const body of Matter.Composite.allBodies(this.engine.world)) {
      if (!body.isStatic && body.circleRadius) {
        Matter.Body.setPosition(body, {
          x: body.position.x * sx,
          y: body.position.y * sy
        });
      }
    }
  }

  step(world: World, dtMs: number): void {
    for (const t of world.tanks) {
      if (!t.alive || !t.body) continue;
      Matter.Body.setVelocity(t.body as Matter.Body, {
        x: t.vx / VEL_DIV,
        y: t.vy / VEL_DIV
      });
    }
    Matter.Engine.update(this.engine, dtMs);
    for (const t of world.tanks) {
      if (!t.alive || !t.body) continue;
      const b = t.body as Matter.Body;
      // 卡死检测用“命令速度 vs 实际获得速度”，不用位移差：
      // body 稳定停在墙的法向接触点（略有穿透），位移/钳位偏差恒 >0.4px 会漏判；
      // 而顶墙时法向分量被求解器归零，Engine.update 后的 body.speed 才真实反映“动没动”。
      const commanded = Math.hypot(t.vx, t.vy) / VEL_DIV; // 换算到 Matter 速度单位
      t.blocked = commanded > 0.2 && b.speed < commanded * 0.35;
      t.x = clamp(b.position.x, t.size, this.width - t.size);
      t.y = clamp(b.position.y, t.size, this.height - t.size);
      if (b.speed > 0.3) t.moveHeading = directionAngle(b.velocity.x, b.velocity.y);
    }
  }

  clear(): void {
    Matter.Composite.clear(this.engine.world, false);
    this.walls = [];
    if (this.width > 0) this.setBounds(this.width, this.height);
  }
}

function rect(x: number, y: number, w: number, h: number): Matter.Body {
  return Matter.Bodies.rectangle(x, y, w, h, { isStatic: true });
}
