import { Application, Container, Graphics, Text } from 'pixi.js';
import type { World } from '../game/world';
import type { Tank } from '../game/tank';
import type { SelectionState } from '../game/selection';
import { round2 } from '../core/math';
import { KIND_NAMES } from '../config';

const FONT = 'Microsoft YaHei, PingFang SC, sans-serif';

function hsl(h: number, s: number, l: number, a = 1): string {
  return a >= 1 ? `hsl(${h} ${s}% ${l}%)` : `hsl(${h} ${s}% ${l}% / ${a})`;
}

/** 单辆坦克的显示对象树：root 平移；hullC/gunC 各自按角度旋转（rotation = -angle 使局部 +Y 为前方） */
class TankView {
  root = new Container();
  private hullC = new Container();
  private gunC = new Container();
  private bodyG = new Graphics();
  private stubG = new Graphics();
  private gunG = new Graphics();
  private hpG = new Graphics();
  private ringG = new Graphics();
  private label = new Text({
    text: '',
    resolution: 3,
    style: { fontFamily: FONT, fontSize: 12, fill: 0xd8e3f0 }
  });
  private msg = new Text({
    text: '',
    resolution: 3,
    style: { fontFamily: FONT, fontSize: 16, fontWeight: 'bold', fill: 0xffd166 }
  });
  private drawnGunLv = -1;

  constructor(tank: Tank) {
    const color = hsl(tank.hue, 85, 62);
    this.bodyG.circle(0, 0, tank.size).stroke({ width: 3, color, alpha: 0.95 });
    this.bodyG.circle(0, 0, 5).fill({ color });
    this.stubG.rect(-tank.size * 0.45, -3, tank.size * 0.9, tank.size + 3).fill({
      color: hsl(tank.hue, 75, 42),
      alpha: 0.95
    });
    this.ringG.circle(0, 0, tank.size + 7).stroke({ width: 2, color: 0xfbbf24 });
    this.ringG.visible = false;

    this.label.anchor.set(0.5, 1);
    this.label.position.set(0, -tank.size - 12);
    this.msg.anchor.set(0.5, 1);
    this.msg.position.set(0, -tank.size - 26);
    this.hpG.position.set(0, -tank.size - 10);

    this.hullC.addChild(this.stubG, this.bodyG);
    this.gunC.addChild(this.gunG);
    this.hullC.rotation = -tank.moveHeading;
    this.gunC.rotation = -tank.gunHeading;
    this.root.addChild(this.hullC, this.gunC, this.ringG, this.hpG, this.label, this.msg);
  }

  sync(t: Tank, selected: boolean): void {
    this.root.position.set(t.x, t.y);
    this.hullC.rotation = -t.moveHeading;
    this.gunC.rotation = -t.gunHeading;

    if (this.drawnGunLv !== t.gun.lv) {
      this.drawnGunLv = t.gun.lv;
      const gun = t.gun;
      const color = hsl(t.hue, 95, 72);
      this.gunG.clear();
      this.gunG.moveTo(0, 0).lineTo(0, gun.length).stroke({ width: gun.width, color });
      this.gunG.circle(0, gun.length, gun.width * 0.65).fill({ color });
    }

    const ratio = Math.max(0, Math.min(1, t.hp / t.maxHp));
    const w = 46;
    this.hpG.clear();
    this.hpG.rect(-w / 2, 0, w, 5).fill({ color: 0x000000, alpha: 0.55 });
    if (ratio > 0) {
      this.hpG.rect(-w / 2, 0, w * ratio, 5).fill({
        color: ratio > 0.5 ? 0x4ade80 : ratio > 0.25 ? 0xfacc15 : 0xf87171
      });
    }

    this.label.text = `${t.id} Lv.${t.lv + 1} ${KIND_NAMES[t.kind]} ${round2(t.hp)}`;
    this.msg.text = t.msg?.text ?? '';
    this.ringG.visible = selected;
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }
}

/**
 * Pixi v8 WebGL 渲染器：与逻辑完全解耦，只读 World/Selection 数据。
 */
export class PixiRenderer {
  private app = new Application();
  private tankLayer = new Container();
  private tracerG = new Graphics();
  private rectG = new Graphics();
  private views = new Map<string, TankView>();

  async init(mount: HTMLElement, background: number): Promise<void> {
    await this.app.init({ resizeTo: window, background, antialias: true });
    mount.appendChild(this.app.canvas);
    this.app.stage.addChild(this.tankLayer, this.tracerG, this.rectG);
  }

  get canvas(): HTMLCanvasElement {
    return this.app.canvas;
  }

  render(world: World, sel: SelectionState): void {
    const selectedIds = new Set(sel.selected.map((t) => t.id));

    // 视图与实体同步（增/删/更新）
    const live = new Set(world.tanks.map((t) => t.id));
    for (const [id, view] of this.views) {
      if (!live.has(id)) {
        view.destroy();
        this.views.delete(id);
      }
    }
    for (const t of world.tanks) {
      let view = this.views.get(t.id);
      if (!view) {
        view = new TankView(t);
        this.views.set(t.id, view);
        this.tankLayer.addChild(view.root);
      }
      view.sync(t, selectedIds.has(t.id));
    }

    // 弹道
    const g = this.tracerG;
    g.clear();
    for (const tr of world.tracers) {
      const alpha = 1 - (world.clock - tr.bornAt) / tr.life;
      g.moveTo(tr.x1, tr.y1)
        .lineTo(tr.x2, tr.y2)
        .stroke({ width: tr.width, color: hsl(tr.hue, 95, 70), alpha: Math.max(alpha, 0) });
    }

    // 框选矩形
    this.rectG.clear();
    if (sel.rect) {
      const r = sel.rect;
      this.rectG
        .rect(r.x, r.y, r.w, r.h)
        .fill({ color: 0x22c55e, alpha: 0.1 })
        .stroke({ width: 1, color: 0x22c55e, alpha: 0.9 });
    }
  }

  destroy(): void {
    for (const v of this.views.values()) v.destroy();
    this.views.clear();
    this.app.destroy(true, { children: true });
  }
}
