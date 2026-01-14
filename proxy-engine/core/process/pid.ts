// pid.ts - Process ID tracking and registry

/**
 * Process ID type
 */
export type ProcessID = string;

/**
 * Process information
 */
export interface ProcessInfo {
  pid: number;
  name: string;
  startTime: number;
  status: 'running' | 'stopped' | 'crashed';
  memoryUsage?: number;
  cpuUsage?: number;
}

/**
 * PID registry for tracking processes
 */
export class PIDRegistry {
  private processes: Map<number, ProcessInfo>;
  private nextPid: number;

  constructor(startPid: number = 1000) {
    this.processes = new Map();
    this.nextPid = startPid;
  }

  /**
   * Allocate a new PID
   */
  allocate(name: string): number {
    const pid = this.nextPid++;
    this.processes.set(pid, {
      pid,
      name,
      startTime: Date.now(),
      status: 'running'
    });
    return pid;
  }

  /**
   * Register an existing PID
   */
  register(pid: number, info: Omit<ProcessInfo, 'pid'>): void {
    this.processes.set(pid, { pid, ...info });
  }

  /**
   * Unregister a PID
   */
  unregister(pid: number): boolean {
    return this.processes.delete(pid);
  }

  /**
   * Get process info
   */
  get(pid: number): ProcessInfo | null {
    return this.processes.get(pid) ?? null;
  }

  /**
   * Update process status
   */
  updateStatus(pid: number, status: ProcessInfo['status']): void {
    const proc = this.processes.get(pid);
    if (proc) {
      proc.status = status;
    }
  }

  /**
   * Update process stats
   */
  updateStats(pid: number, memoryUsage: number, cpuUsage: number): void {
    const proc = this.processes.get(pid);
    if (proc) {
      proc.memoryUsage = memoryUsage;
      proc.cpuUsage = cpuUsage;
    }
  }

  /**
   * Get all processes
   */
  getAll(): ProcessInfo[] {
    return Array.from(this.processes.values());
  }

  /**
   * Get processes by status
   */
  getByStatus(status: ProcessInfo['status']): ProcessInfo[] {
    return Array.from(this.processes.values())
      .filter(proc => proc.status === status);
  }

  /**
   * Clear all processes
   */
  clear(): void {
    this.processes.clear();
  }

  /**
   * Get registry size
   */
  size(): number {
    return this.processes.size;
  }
}
