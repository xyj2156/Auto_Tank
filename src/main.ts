import { World } from './game/world';
import { MatterPhysics } from './physics/matterPhysics';
import { PixiRenderer } from './render/pixiRenderer';
import { InputController } from './game/input';
import { createSelection, pruneSelection } from './game/selection';
import { HtmlHud } from './ui/hud';
import { GameLoop } from './core/loop';
import { STEP_MS } from './config';

const TANK_COUNT = 12;

async function boot(): Promise<void> {
  const mount = document.getElementById('stage');
  if (!mount) throw new Error('#stage 容器不存在');

  const renderer = new PixiRenderer();
  await renderer.init(mount, 0x0d1117);

  const world = new World(new MatterPhysics(), window.innerWidth, window.innerHeight);
  world.spawn(TANK_COUNT);

  const sel = createSelection();
  new InputController(renderer.canvas, world, sel);
  const hud = new HtmlHud();

  window.addEventListener('resize', () => {
    world.resize(window.innerWidth, window.innerHeight);
  });

  const loop = new GameLoop(
    STEP_MS,
    (dt) => world.step(dt),
    () => {
      pruneSelection(sel, world);
      renderer.render(world, sel);
      hud.update(world, sel);
    }
  );
  loop.start();
}

boot().catch((err) => {
  console.error('Auto_Tank 启动失败:', err);
  const el = document.getElementById('boot-error');
  if (el) el.hidden = false;
});
