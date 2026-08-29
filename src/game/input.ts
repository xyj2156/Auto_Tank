import type { World } from './world';
import type { Tank } from './tank';
import type { SelectionState } from './selection';
import { DRAG_THRESHOLD } from '../config';

/**
 * 输入控制器：左键拖拽框选、单击选中、右键（或单击空地）下达移动指令。
 * 修正旧版“在持续移动的目标上 click 命中不稳”的问题——按下/抬起落在同一处即可，
 * 命中判定用世界坐标圆距离，而非 canvas isPointInPath 的副作用。
 */
export class InputController {
  private startX = 0;
  private startY = 0;
  private down = false;
  private dragging = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private world: World,
    private sel: SelectionState
  ) {
    canvas.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('contextmenu', this.onContext);
  }

  private toLocal(e: PointerEvent | MouseEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private onDown = (e: PointerEvent): void => {
    if (e.button === 2) return; // 右键交给 onContext
    const p = this.toLocal(e);
    this.startX = p.x;
    this.startY = p.y;
    this.down = true;
    this.dragging = false;
    this.sel.rect = null;
  };

  private onMove = (e: PointerEvent): void => {
    if (!this.down) return;
    const p = this.toLocal(e);
    const dx = p.x - this.startX;
    const dy = p.y - this.startY;
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
      this.dragging = true;
      this.sel.rect = {
        x: Math.min(this.startX, p.x),
        y: Math.min(this.startY, p.y),
        w: Math.abs(dx),
        h: Math.abs(dy)
      };
    }
  };

  private onUp = (e: PointerEvent): void => {
    if (e.button === 2 || !this.down) return;
    this.down = false;
    const p = this.toLocal(e);
    if (this.dragging && this.sel.rect) {
      this.boxSelect(this.sel.rect);
    } else {
      this.clickSelectOrMove(p.x, p.y, e.shiftKey);
    }
    this.dragging = false;
    this.sel.rect = null;
  };

  private onContext = (e: MouseEvent): void => {
    e.preventDefault();
    const p = this.toLocal(e);
    this.issueMove(p.x, p.y);
  };

  /** 命中：以车身半径 + 容差判定，取最近的一辆 */
  private pick(x: number, y: number): Tank | null {
    let best: Tank | null = null;
    let bestD = Infinity;
    for (const t of this.world.tanks) {
      if (!t.alive) continue;
      const d = t.distanceTo(x, y);
      if (d <= t.size + 6 && d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return best;
  }

  private clickSelectOrMove(x: number, y: number, additive: boolean): void {
    const hit = this.pick(x, y);
    if (hit) {
      if (additive) {
        if (!this.sel.selected.includes(hit)) this.sel.selected.push(hit);
      } else {
        this.sel.selected = [hit];
      }
    } else if (!additive) {
      // 单击空地：对已选坦克下达移动指令（旧版行为）；无选中则清空
      if (this.sel.selected.length) this.issueMove(x, y);
      else this.sel.selected = [];
    }
  }

  private boxSelect(rect: { x: number; y: number; w: number; h: number }): void {
    const picked: Tank[] = [];
    for (const t of this.world.tanks) {
      if (!t.alive) continue;
      const nearX = Math.max(rect.x, Math.min(t.x, rect.x + rect.w));
      const nearY = Math.max(rect.y, Math.min(t.y, rect.y + rect.h));
      if (t.distanceTo(nearX, nearY) <= t.size) picked.push(t);
    }
    this.sel.selected = picked;
  }

  private issueMove(x: number, y: number): void {
    const tx = Math.max(20, Math.min(this.world.width - 20, x));
    const ty = Math.max(20, Math.min(this.world.height - 20, y));
    for (const t of this.sel.selected) {
      if (!t.alive) continue;
      t.orderTarget = { x: tx, y: ty };
    }
  }

  destroy(): void {
    this.canvas.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    this.canvas.removeEventListener('contextmenu', this.onContext);
  }
}
