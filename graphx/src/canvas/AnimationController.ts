// Browser animation frame globals — declared here so the module compiles in both browser
// and Deno environments. The actual implementations are provided by the browser runtime or
// injected by the test harness via globalThis assignment.
declare function requestAnimationFrame(callback: (timestamp: number) => void): number;
declare function cancelAnimationFrame(handle: number): void;

export class AnimationController {
  private renderFn: (timestamp: number) => void;
  private animationId: number | null = null;
  private dirty = true;
  private _isRunning = false;

  constructor(renderFn: (timestamp: number) => void) {
    this.renderFn = renderFn;
  }

  get isRunning(): boolean {
    return this._isRunning;
  }

  start(): void {
    if (this._isRunning) return;
    this._isRunning = true;
    this.dirty = true;
    this.tick(performance.now());
  }

  stop(): void {
    this._isRunning = false;
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  markDirty(): void {
    this.dirty = true;
  }

  tick(timestamp: number): void {
    if (!this._isRunning) return;
    if (this.dirty) {
      this.dirty = false;
      this.renderFn(timestamp);
    }
    this.animationId = requestAnimationFrame((ts) => this.tick(ts));
  }
}
