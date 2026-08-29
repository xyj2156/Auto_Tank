import type { World } from '../game/world';
import type { Tank } from '../game/tank';
import type { SelectionState } from '../game/selection';
import { KIND_NAMES } from '../config';
import { round2 } from '../core/math';

/**
 * HTML overlay HUD：居中公告条 + 选中坦克属性面板。
 * 数据刷新限频 ~8Hz（DOM 重建成本），公告逐帧同步淡入淡出交给 CSS。
 */
export class HtmlHud {
  private banner: HTMLElement;
  private panel: HTMLElement;
  private lastPanelAt = -Infinity;
  private lastBannerText = '\u0000';

  constructor() {
    this.banner = document.createElement('div');
    this.banner.className = 'banner';
    this.panel = document.createElement('div');
    this.panel.className = 'panel';
    const hud = document.getElementById('hud');
    hud?.append(this.banner, this.panel);
  }

  update(world: World, sel: SelectionState): void {
    const text = world.banner?.text ?? '';
    if (text !== this.lastBannerText) {
      this.lastBannerText = text;
      this.banner.textContent = text;
      this.banner.classList.toggle('show', text.length > 0);
    }
    if (world.clock - this.lastPanelAt >= 125) {
      this.lastPanelAt = world.clock;
      this.renderPanel(sel.selected);
    }
  }

  private renderPanel(selected: Tank[]): void {
    const alive = selected.filter((t) => t.alive);
    if (alive.length === 0) {
      if (this.panel.childElementCount) this.panel.textContent = '';
      return;
    }
    this.panel.textContent = '';
    for (const t of alive.slice(0, 6)) this.panel.appendChild(this.card(t));
    if (alive.length > 6) {
      const more = document.createElement('div');
      more.className = 'card';
      more.textContent = `…… 另有 ${alive.length - 6} 辆被选中`;
      this.panel.appendChild(more);
    }
  }

  private card(t: Tank): HTMLElement {
    const card = document.createElement('div');
    card.className = 'card';

    const title = document.createElement('h3');
    title.textContent = `${t.id} · ${KIND_NAMES[t.kind]}`;
    title.style.color = `hsl(${t.hue} 85% 66%)`;
    card.appendChild(title);

    const gun = t.gun;
    this.row(card, '等级 / 炮塔', `Lv.${t.lv + 1} / Lv.${gun.lv + 1}`);
    this.row(card, '生命', `${round2(t.hp)} / ${round2(t.maxHp)}`);
    this.row(card, '单发威力', String(gun.power));
    this.row(card, '速度 · 炮转速', `${t.speed} px/s · ${gun.rotDeg}°/s`);
    this.row(card, '射速', `${round2(1000 / gun.timeout)} 次/秒`);
    this.row(
      card,
      '开火 / 命中 / 命中率',
      `${t.stats.shoot} / ${t.stats.hit} / ${t.stats.shoot ? round2((t.stats.hit / t.stats.shoot) * 100) : 0}%`
    );
    this.row(
      card,
      '射程 · 视野 · 追击',
      `${gun.sight + t.size} · ${t.sight + t.size} · ${t.pursuitRange + t.size}`
    );
    this.row(card, '输出 / 承受', `${round2(t.stats.hurtOut.all)} / ${round2(t.stats.hurtIn.all)}`);

    const targets = Object.entries(t.stats.hurtOut)
      .filter(([k]) => k !== 'all')
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    if (targets.length) {
      const line = document.createElement('p');
      line.className = 'sub';
      line.textContent = '伤害明细：' + targets.map(([k, v]) => `${k} ${round2(v)}`).join('，');
      card.appendChild(line);
    }
    return card;
  }

  private row(parent: HTMLElement, label: string, value: string): void {
    const r = document.createElement('div');
    r.className = 'row';
    const b = document.createElement('b');
    b.textContent = label;
    const s = document.createElement('span');
    s.textContent = value;
    r.append(b, s);
    parent.appendChild(r);
  }
}
