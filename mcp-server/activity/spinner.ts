/**
 * Terminal Spinner
 * Animated spinner for showing activity in the terminal
 */

import { SPINNER_FRAMES, COLORS, TERMINAL } from "./types.ts";

/**
 * Spinner state
 */
interface SpinnerState {
  text: string;
  frameIndex: number;
  startTime: number;
}

/**
 * Writable sync interface for output
 */
interface WritableSync {
  writeSync(p: Uint8Array): number;
}

/**
 * Terminal spinner for activity indication
 */
export class Spinner {
  private intervalId: number | null = null;
  private state: SpinnerState | null = null;
  private readonly frames: string[];
  private readonly interval: number;
  private readonly useColors: boolean;
  private readonly output: WritableSync;
  private readonly encoder = new TextEncoder();

  constructor(options: {
    frames?: string[];
    interval?: number;
    useColors?: boolean;
    output?: WritableSync;
  } = {}) {
    this.frames = options.frames ?? SPINNER_FRAMES;
    this.interval = options.interval ?? 80;
    this.useColors = options.useColors ?? Deno.stderr.isTerminal();
    this.output = options.output ?? Deno.stderr;
  }

  /**
   * Start the spinner with a message
   */
  start(text: string): void {
    if (this.intervalId !== null) {
      this.update(text);
      return;
    }

    this.state = {
      text,
      frameIndex: 0,
      startTime: Date.now(),
    };

    // Hide cursor during animation
    this.write(TERMINAL.hideCursor);

    // Start the animation loop
    this.intervalId = setInterval(() => {
      this.render();
    }, this.interval);

    // Render immediately
    this.render();
  }

  /**
   * Update the spinner text
   */
  update(text: string): void {
    if (this.state) {
      this.state.text = text;
      this.render();
    }
  }

  /**
   * Stop the spinner with success message
   */
  succeed(text?: string): void {
    this.stop(text, "success");
  }

  /**
   * Stop the spinner with failure message
   */
  fail(text?: string): void {
    this.stop(text, "error");
  }

  /**
   * Stop the spinner with warning message
   */
  warn(text?: string): void {
    this.stop(text, "warn");
  }

  /**
   * Stop the spinner with info message
   */
  info(text?: string): void {
    this.stop(text, "info");
  }

  /**
   * Stop the spinner
   */
  stop(text?: string, type: "success" | "error" | "warn" | "info" = "info"): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Clear the current line
    this.clearLine();

    // Show final message if provided
    if (text && this.state) {
      const elapsed = Date.now() - this.state.startTime;
      const icon = this.getIcon(type);
      const color = this.getColor(type);
      const timeStr = this.formatDuration(elapsed);

      if (this.useColors) {
        this.writeLine(`${color}${icon}${COLORS.reset} ${text} ${COLORS.dim}(${timeStr})${COLORS.reset}`);
      } else {
        this.writeLine(`${icon} ${text} (${timeStr})`);
      }
    }

    this.state = null;

    // Show cursor again
    this.write(TERMINAL.showCursor);
  }

  /**
   * Check if spinner is currently running
   */
  isSpinning(): boolean {
    return this.intervalId !== null;
  }

  /**
   * Get the current text
   */
  getText(): string | null {
    return this.state?.text ?? null;
  }

  /**
   * Render the current frame
   */
  private render(): void {
    if (!this.state) return;

    const frame = this.frames[this.state.frameIndex];
    const elapsed = Date.now() - this.state.startTime;
    const timeStr = this.formatDuration(elapsed);

    let line: string;
    if (this.useColors) {
      line = `${COLORS.cyan}${frame}${COLORS.reset} ${this.state.text} ${COLORS.dim}(${timeStr})${COLORS.reset}`;
    } else {
      line = `${frame} ${this.state.text} (${timeStr})`;
    }

    this.clearLine();
    this.write(line);

    // Advance to next frame
    this.state.frameIndex = (this.state.frameIndex + 1) % this.frames.length;
  }

  /**
   * Clear the current line
   */
  private clearLine(): void {
    this.write(TERMINAL.cursorStart + TERMINAL.clearLine);
  }

  /**
   * Write to output
   */
  private write(text: string): void {
    this.output.writeSync(this.encoder.encode(text));
  }

  /**
   * Write line to output
   */
  private writeLine(text: string): void {
    this.write(text + "\n");
  }

  /**
   * Get icon for message type
   */
  private getIcon(type: "success" | "error" | "warn" | "info"): string {
    switch (type) {
      case "success":
        return "✓";
      case "error":
        return "✗";
      case "warn":
        return "⚠";
      case "info":
        return "ℹ";
    }
  }

  /**
   * Get color for message type
   */
  private getColor(type: "success" | "error" | "warn" | "info"): string {
    if (!this.useColors) return "";
    switch (type) {
      case "success":
        return COLORS.green;
      case "error":
        return COLORS.red;
      case "warn":
        return COLORS.yellow;
      case "info":
        return COLORS.cyan;
    }
  }

  /**
   * Format duration in human-readable form
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }

  /**
   * Strip ANSI codes from string
   */
  private stripAnsi(str: string): string {
    // eslint-disable-next-line no-control-regex
    return str.replace(/\x1b\[[0-9;]*m/g, "");
  }
}

/**
 * Create a new spinner instance
 */
export function createSpinner(options?: {
  frames?: string[];
  interval?: number;
  useColors?: boolean;
  output?: WritableSync;
}): Spinner {
  return new Spinner(options);
}
