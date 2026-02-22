/**
 * WorkerNavigator - navigator.gpu shim for Web Worker contexts
 *
 * Provides a WorkerNavigator that exposes a GPU interface,
 * enabling WebGPU usage inside Web Workers / Deno workers.
 */

/** Shape of globalThis with optional navigator.gpu */
interface GlobalWithNavigator {
  navigator?: { gpu?: GPU };
}

export class WorkerNavigator {
  readonly gpu: GPU | null;

  constructor(options?: { gpuAvailable?: boolean }) {
    if (options?.gpuAvailable === false) {
      this.gpu = null;
    } else {
      // Try to get the real GPU adapter from the environment
      const g = globalThis as unknown as GlobalWithNavigator;
      this.gpu = g.navigator?.gpu ?? null;
    }
  }

  /**
   * Whether a GPU adapter is available.
   */
  isGPUAvailable(): boolean {
    return this.gpu !== null;
  }

  /**
   * Install a WorkerNavigator on globalThis.navigator so that
   * navigator.gpu is available in worker contexts.
   */
  static install(): WorkerNavigator {
    const nav = new WorkerNavigator();
    const g = globalThis as unknown as GlobalWithNavigator;
    if (!g.navigator) {
      g.navigator = {};
    }
    if (!g.navigator.gpu && nav.gpu) {
      g.navigator.gpu = nav.gpu;
    }
    return nav;
  }
}
