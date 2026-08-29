import { ROUND_RESET_MS, TANK_BASE, buildExpTable, type WeaponKind } from '../config';
import { Tank } from './tank';
import type { PhysicsAdapter } from './physics';
import { updateAI } from './systems/ai';
import { updateCombat } from './systems/combat';

export interface Tracer {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  hue: number;
  bornAt: number;
  life: number;
}

const KINDS: WeaponKind[] = ['machinegun', 'sniper', 'rocket'];

/**
 * 战场世界：持有全部坦克、物理适配器、世界时钟与演出数据（弹道/公告）。
 * 渲染无关、输入无关——纯逻辑容器，可在 node 环境单测。
 */
export class World {
  tanks: Tank[] = [];
  tracers: Tracer[] = [];
  banner: { text: string; expiresAt: number } | null = null;

  /** 世界时钟（ms），逻辑固定步累加 */
  clock = 0;
  width: number;
  height: number;

  /** 可注入随机源，便于单测复现 */
  rng: () => number = Math.random;

  private nextId = 0;
  private resetAt: number | null = null;
  private expTable = buildExpTable(20);
  /** 本局坦克数，重开时复用 */
  count = 0;

  constructor(
    public readonly physics: PhysicsAdapter,
    width: number,
    height: number
  ) {
    this.width = width;
    this.height = height;
    physics.setBounds(width, height);
  }

  /** 生成一场对战（数量越多越热闹） */
  spawn(num: number): void {
    this.count = num;
    this.physics.clear();
    this.tanks = [];
    this.tracers = [];
    this.banner = null;
    this.resetAt = null;
    this.clock = 0;
    this.nextId = 0;
    for (let i = 0; i < num; i++) this.addTank();
  }

  addTank(kind?: WeaponKind): Tank {
    const k = kind ?? KINDS[Math.floor(this.rng() * KINDS.length)];
    const margin = 40;
    const minDist = TANK_BASE.size * 2.2;
    let x = margin;
    let y = margin;
    for (let attempt = 0; attempt < 40; attempt++) {
      x = margin + this.rng() * Math.max(1, this.width - 2 * margin);
      y = margin + this.rng() * Math.max(1, this.height - 2 * margin);
      const spaced = this.tanks.every(
        (o) => Math.hypot(o.x - x, o.y - y) >= minDist
      );
      if (spaced) break;
    }
    const tank = new Tank({
      id: `T${++this.nextId}`,
      kind: k,
      x,
      y,
      expTable: this.expTable
    });
    this.physics.addTank(tank);
    this.tanks.push(tank);
    return tank;
  }

  /** 逻辑步：重开判定 → AI → 战斗 → 物理 → 清理。dtMs 建议为固定步长 */
  step(dtMs: number): void {
    if (this.resetAt !== null && this.clock >= this.resetAt) {
      this.spawn(this.count);
    }
    this.clock += dtMs;

    for (const t of this.tanks) {
      if (!t.alive) continue;
      updateAI(t, this, dtMs);
      updateCombat(t, this);
    }

    this.physics.step(this, dtMs);

    // 过期弹道/消息清理
    this.tracers = this.tracers.filter((tr) => this.clock - tr.bornAt < tr.life);
    for (const t of this.tanks) {
      if (t.msg && this.clock >= t.msg.expiresAt) t.msg = null;
    }
    if (this.banner && this.clock >= this.banner.expiresAt) this.banner = null;

    this.cull();
  }

  /** 移除尸体；判定胜负并安排重开 */
  private cull(): void {
    const alive = this.tanks.filter((t) => t.alive);
    if (alive.length === this.tanks.length) return;

    for (const dead of this.tanks) {
      if (!dead.alive) this.physics.removeTank(dead);
    }
    // 清掉指向已死目标的引用
    for (const t of alive) {
      if (t.foe && !t.foe.alive) t.foe = null;
    }
    this.tanks = alive;

    if (alive.length <= 1 && this.resetAt === null) {
      const winner = alive[0];
      this.setBanner(
        winner ? `${winner.id} 胜出，是最后的幸运者。` : '同归于尽，战场清空。',
        ROUND_RESET_MS
      );
      this.resetAt = this.clock + ROUND_RESET_MS;
    }
  }

  setBanner(text: string, ms: number): void {
    this.banner = { text, expiresAt: this.clock + ms };
  }

  /** 本局是否已结束、正在等待重开 */
  awaitingReset(): boolean {
    return this.resetAt !== null;
  }

  resize(width: number, height: number): void {
    const sx = width / this.width;
    const sy = height / this.height;
    this.width = width;
    this.height = height;
    this.physics.setBounds(width, height);
    this.physics.scalePositions(sx, sy);
  }
}
