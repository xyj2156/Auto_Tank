import type { Tank } from './tank';

/** 选择状态：input 写入，renderer/hud 读取 */
export interface SelectionState {
  selected: Tank[];
  rect: { x: number; y: number; w: number; h: number } | null;
}

export function createSelection(): SelectionState {
  return { selected: [], rect: null };
}

/** 每帧剔除阵亡/随回合重置消失的坦克 */
export function pruneSelection(sel: SelectionState, world: { tanks: Tank[] }): void {
  if (!sel.selected.length) return;
  const present = new Set(world.tanks);
  sel.selected = sel.selected.filter((t) => t.alive && present.has(t));
}
