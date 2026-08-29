/**
 * 固定步长游戏循环：逻辑以恒定 stepMs 推进（世界时钟可靠、冷却确定），
 * 渲染按 rAF 频率执行。彻底替代旧版 setTimeout 冷却/消息/重置三套时序。
 */
export class GameLoop {
  private rafId = 0;
  private last = 0;
  private acc = 0;
  private running = false;

  constructor(
    private readonly stepMs: number,
    private readonly onStep: (dtMs: number) => void,
    private readonly onFrame: () => void
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.acc = 0;
    const tick = (now: number) => {
      if (!this.running) return;
      // 回溯超过 250ms 视为标签页挂起，丢弃以免死亡螺旋
      this.acc = Math.min(this.acc + (now - this.last), 250);
      this.last = now;
      while (this.acc >= this.stepMs) {
        this.onStep(this.stepMs);
        this.acc -= this.stepMs;
      }
      this.onFrame();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }
}
