import { TANK_BASE, WEAPONS, type WeaponKind, type WeaponSpec } from '../config';
import { directionAngle, normalizeAngle, TAU } from '../core/math';

export interface TankStats {
  shoot: number;
  hit: number;
  /** 对某 id 输出伤害（含 all 总计） */
  hurtOut: Record<string, number>;
  /** 来自某 id 的伤害（含 all 总计） */
  hurtIn: Record<string, number>;
}

/** 武器规格 + 派生的弧度转速 */
export type Gun = WeaponSpec & { rotRad: number };

/**
 * 坦克实体：纯数据 + 少量派生访问器，行为在 systems/ 里。
 * 与旧版的区别：不再共享模板对象引用、不持有 canvas/战场父对象。
 * 约定：所有“射程/视野/追击”距离比较时由调用方叠加 size（车身半径）。
 */
export class Tank {
  readonly id: string;
  readonly kind: WeaponKind;
  readonly size: number;
  readonly speed: number;
  /** 初始生命（常量，升级加成见 maxHp） */
  readonly strength: number;
  hue: number;

  x: number;
  y: number;
  /** 期望速度，px/s（物理适配器消费） */
  vx = 0;
  vy = 0;

  hp: number;
  /** 当前生命上限（坦克升级会提升） */
  maxHp: number;
  lv = 0;
  expTable: number[];

  /** 期望车体朝向（目标方向 + 避让偏压后的最终值），方向为 (sin, cos) */
  heading: number;
  /** 纯目标方向（不含避让偏压），由指令/追击/游走维护 */
  goalHeading: number;
  /** 实际运动朝向（物理写回，渲染用） */
  moveHeading: number;
  /** 炮管指向 */
  gunHeading: number;

  gun: Gun;
  /** 装填完成时刻（世界时钟 ms） */
  reloadAt = 0;

  foe: Tank | null = null;
  /** 玩家移动指令目标点 */
  orderTarget: { x: number; y: number } | null = null;
  /** 是否处于“停在原地对射”状态（AI 写入，供渲染/调试） */
  stopped = false;
  /** 游走重选方向时刻（世界时钟 ms） */
  wanderAt = 0;

  /** —— 触墙反射锁：撞墙时方向沿墙轴反射并锁定，离开指定距离后解锁 —— */
  wallLock: { axis: 'x' | 'y'; side: 1 | -1 } | null = null;
  /** 锁定期内行驶的方向（反射后的朝向） */
  lockHeading = 0;

  /** 头顶浮动消息 */
  msg: { text: string; expiresAt: number } | null = null;

  /** 战斗统计（开火/命中/双向伤害明细） */
  stats: TankStats;

  alive = true;
  /** 关联物理刚体（由物理适配器写入） */
  body: unknown = null;

  /** 视野与追击半径（不含 size），不小于当前射程 */
  sight: number = TANK_BASE.sight;
  pursuitRange: number = TANK_BASE.pursuitRange;

  constructor(opts: {
    id: string;
    kind: WeaponKind;
    x: number;
    y: number;
    heading?: number;
    expTable: number[];
  }) {
    this.id = opts.id;
    this.kind = opts.kind;
    this.x = opts.x;
    this.y = opts.y;
    this.size = TANK_BASE.size;
    this.speed = TANK_BASE.speed;
    this.strength = TANK_BASE.strength;
    this.hp = TANK_BASE.strength;
    this.maxHp = TANK_BASE.strength;
    this.expTable = opts.expTable;
    this.hue = Math.floor(Math.random() * 360);

    this.heading = opts.heading ?? normalizeAngle(Math.random() * TAU);
    this.goalHeading = this.heading;
    this.moveHeading = this.heading;
    this.gunHeading = this.heading;

    this.gun = makeGun(WEAPONS[opts.kind][0]);
    this.refreshRanges();
    this.stats = { shoot: 0, hit: 0, hurtOut: { all: 0 }, hurtIn: { all: 0 } };
  }

  /** 炮口世界坐标（渲染/弹道起点） */
  get gunMuzzle(): { x: number; y: number } {
    return {
      x: this.x + Math.sin(this.gunHeading) * this.gun.length,
      y: this.y + Math.cos(this.gunHeading) * this.gun.length
    };
  }

  distanceTo(x: number, y: number): number {
    const dx = x - this.x;
    const dy = y - this.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /** 指向某世界坐标的角度（本约定） */
  angleTo(x: number, y: number): number {
    return directionAngle(x - this.x, y - this.y);
  }

  /** 换装/升级炮塔后，视野与追击范围不小于新射程 */
  refreshRanges(): void {
    this.sight = Math.max(this.sight, this.gun.sight);
    this.pursuitRange = Math.max(this.pursuitRange, this.gun.sight);
  }

  /** 炮塔升到指定等级（越界钳制，满级重复调用无副作用变化） */
  upgradeGun(targetLv: number): void {
    const list = WEAPONS[this.kind];
    const lv = Math.max(0, Math.min(list.length - 1, targetLv));
    this.gun = makeGun(list[lv]);
    this.refreshRanges();
  }
}

export function makeGun(spec: WeaponSpec): Gun {
  return { ...spec, rotRad: (spec.rotDeg * Math.PI) / 180 };
}
