/**
 * 数据配置层：武器表、坦克基准值、全局常量。
 * 数值取自旧版 tank.bot.js，速度/角速度已从“每帧”换算为“每秒”（配固定步长循环，帧率无关）。
 */

export type WeaponKind = 'machinegun' | 'sniper' | 'rocket';

export interface WeaponSpec {
  /** 等级（从 0 起） */
  lv: number;
  /** 单发基础威力（实际伤害 = power × 0.7~1.0 随机衰减） */
  power: number;
  /** 开火射程 px（不含车身半径，运行时叠加 size） */
  sight: number;
  /** 炮管长度 px（不含车身半径，运行时叠加 size） */
  length: number;
  /** 炮管粗细 px */
  width: number;
  /** 炮塔转速 度/秒（旧值 度/帧 × 60） */
  rotDeg: number;
  /** 装填间隔 ms */
  timeout: number;
  /** 升级到下一级所需总输出伤害，null 表示满级 */
  exp: number | null;
  /** 命中率 0~1 */
  accuracy: number;
}

export const KIND_NAMES: Record<WeaponKind, string> = {
  machinegun: '机枪型',
  sniper: '狙击型',
  rocket: '火箭炮'
};

export const WEAPONS: Record<WeaponKind, WeaponSpec[]> = {
  machinegun: [
    { lv: 0, power: 2,   sight: 140, length: 30, width: 4,  rotDeg: 180, timeout: 100,  exp: 200,  accuracy: 0.6 },
    { lv: 1, power: 3,   sight: 185, length: 32, width: 5,  rotDeg: 240, timeout: 50,   exp: 350,  accuracy: 0.75 },
    { lv: 2, power: 5.5, sight: 220, length: 35, width: 6,  rotDeg: 300, timeout: 30,   exp: null, accuracy: 0.8 }
  ],
  sniper: [
    { lv: 0, power: 50,  sight: 340, length: 40, width: 5,  rotDeg: 60,  timeout: 2000, exp: 200,  accuracy: 0.9 },
    { lv: 1, power: 100, sight: 380, length: 42, width: 6,  rotDeg: 120, timeout: 1800, exp: 450,  accuracy: 0.93 },
    { lv: 2, power: 150, sight: 400, length: 45, width: 7,  rotDeg: 180, timeout: 1500, exp: null, accuracy: 0.95 }
  ],
  rocket: [
    { lv: 0, power: 100, sight: 240, length: 40, width: 15, rotDeg: 60,  timeout: 4500, exp: 200,  accuracy: 0.6 },
    { lv: 1, power: 200, sight: 280, length: 42, width: 16, rotDeg: 90,  timeout: 3500, exp: 350,  accuracy: 0.65 },
    { lv: 2, power: 250, sight: 300, length: 45, width: 17, rotDeg: 120, timeout: 3000, exp: null, accuracy: 0.75 }
  ]
};

/** 坦克基准属性（旧版全局 tank 模板，改为只读常量） */
export const TANK_BASE = {
  speed: 60,        // px/s，旧值 1px/帧
  sight: 200,       // 基础视野 px
  size: 20,         // 车身半径 px
  pursuitRange: 270,// 基础追击范围 px
  strength: 800     // 初始生命
} as const;

/** 固定步长（ms），逻辑按 60Hz 推进 */
export const STEP_MS = 1000 / 60;
/** 一局结束后重开倒计时 */
export const ROUND_RESET_MS = 3000;
/** 消息默认存活时间 */
export const MESSAGE_MS = 3000;
/** 弹道轨迹存活时间 */
export const TRACER_MS = 150;
/** 判定为“对准”的角容差 rad */
export const ALIGN_EPS = 0.03;
/** 移动指令到达容差 px */
export const ARRIVE_EPS = 8;
/** 框选/点击区分阈值 px */
export const DRAG_THRESHOLD = 8;

/** 旧版经验表：a[i] = (i+16)*10 + a[i-1]，超过 20 级不再升级 */
export function buildExpTable(levels = 20): number[] {
  const table: number[] = [];
  for (let i = 0; i < levels; i++) {
    let v = (i + 16) * 10;
    if (i > 0) v += table[i - 1];
    table.push(v);
  }
  return table;
}
