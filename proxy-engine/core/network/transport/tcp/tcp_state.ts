/**
 * TCP State Machine
 *
 * Implements the complete TCP state machine as defined in RFC 793
 */

/**
 * TCP connection states
 */
export enum TCPState {
  /**
   * No connection exists
   */
  CLOSED = "CLOSED",

  /**
   * Waiting for connection request from any remote TCP
   */
  LISTEN = "LISTEN",

  /**
   * Sent SYN, waiting for matching SYN+ACK
   */
  SYN_SENT = "SYN_SENT",

  /**
   * Received SYN, sent SYN+ACK, waiting for ACK
   */
  SYN_RECEIVED = "SYN_RECEIVED",

  /**
   * Connection established
   */
  ESTABLISHED = "ESTABLISHED",

  /**
   * Sent FIN, waiting for ACK or FIN
   */
  FIN_WAIT_1 = "FIN_WAIT_1",

  /**
   * Received ACK of our FIN, waiting for remote FIN
   */
  FIN_WAIT_2 = "FIN_WAIT_2",

  /**
   * Received FIN, waiting to send ACK
   */
  CLOSE_WAIT = "CLOSE_WAIT",

  /**
   * Sent FIN after receiving FIN, waiting for ACK
   */
  CLOSING = "CLOSING",

  /**
   * Sent final ACK, waiting for TIME_WAIT timeout
   */
  LAST_ACK = "LAST_ACK",

  /**
   * Waiting for enough time to pass to be sure remote received ACK of its FIN
   * Typically 2 * MSL (Maximum Segment Lifetime)
   */
  TIME_WAIT = "TIME_WAIT",
}

/**
 * TCP segment flags
 */
export interface TCPFlags {
  FIN: boolean;
  SYN: boolean;
  RST: boolean;
  PSH: boolean;
  ACK: boolean;
  URG: boolean;
}

/**
 * TCP segment
 */
export interface TCPSegment {
  sourcePort: number;
  destPort: number;
  sequenceNumber: number;
  acknowledgmentNumber: number;
  flags: TCPFlags;
  windowSize: number;
  data: Uint8Array;
}

/**
 * TCP state machine event
 */
export type TCPEvent =
  | { type: "PASSIVE_OPEN" }
  | { type: "ACTIVE_OPEN" }
  | { type: "SEND"; data: Uint8Array }
  | { type: "RECEIVE"; segment: TCPSegment }
  | { type: "CLOSE" }
  | { type: "ABORT" }
  | { type: "TIMEOUT" };

/**
 * TCP state machine
 */
export class TCPStateMachine {
  private state: TCPState = TCPState.CLOSED;
  private sequenceNumber = 0;
  private acknowledgmentNumber = 0;
  private sendWindow = 65535;
  private receiveWindow = 65535;

  // Retransmission tracking
  private retransmitTimer?: number;
  private retransmitTimeout = 1000; // Initial RTO: 1 second
  private smoothedRTT = 0;
  private rttVariance = 0;

  // Congestion control
  private cwnd = 1; // Congestion window (in MSS units)
  private ssthresh = 65535; // Slow start threshold

  constructor() {
    this.sequenceNumber = this.generateISN();
  }

  /**
   * Get current state
   */
  getState(): TCPState {
    return this.state;
  }

  /**
   * Process event and transition state
   */
  processEvent(event: TCPEvent): TCPSegment | null {
    switch (this.state) {
      case TCPState.CLOSED:
        return this.handleClosed(event);

      case TCPState.LISTEN:
        return this.handleListen(event);

      case TCPState.SYN_SENT:
        return this.handleSynSent(event);

      case TCPState.SYN_RECEIVED:
        return this.handleSynReceived(event);

      case TCPState.ESTABLISHED:
        return this.handleEstablished(event);

      case TCPState.FIN_WAIT_1:
        return this.handleFinWait1(event);

      case TCPState.FIN_WAIT_2:
        return this.handleFinWait2(event);

      case TCPState.CLOSE_WAIT:
        return this.handleCloseWait(event);

      case TCPState.CLOSING:
        return this.handleClosing(event);

      case TCPState.LAST_ACK:
        return this.handleLastAck(event);

      case TCPState.TIME_WAIT:
        return this.handleTimeWait(event);

      default:
        throw new Error(`Unknown TCP state: ${this.state}`);
    }
  }

  /**
   * Handle CLOSED state
   */
  private handleClosed(event: TCPEvent): TCPSegment | null {
    switch (event.type) {
      case "PASSIVE_OPEN":
        this.state = TCPState.LISTEN;
        return null;

      case "ACTIVE_OPEN":
        this.state = TCPState.SYN_SENT;
        return this.createSYNSegment();

      default:
        // Ignore other events in CLOSED state
        return null;
    }
  }

  /**
   * Handle LISTEN state
   */
  private handleListen(event: TCPEvent): TCPSegment | null {
    switch (event.type) {
      case "RECEIVE":
        if (event.segment.flags.SYN) {
          this.acknowledgmentNumber = event.segment.sequenceNumber + 1;
          this.state = TCPState.SYN_RECEIVED;
          return this.createSYNACKSegment();
        }
        return null;

      case "CLOSE":
        this.state = TCPState.CLOSED;
        return null;

      default:
        return null;
    }
  }

  /**
   * Handle SYN_SENT state
   */
  private handleSynSent(event: TCPEvent): TCPSegment | null {
    switch (event.type) {
      case "RECEIVE":
        if (event.segment.flags.SYN && event.segment.flags.ACK) {
          // Received SYN+ACK
          this.acknowledgmentNumber = event.segment.sequenceNumber + 1;
          this.sequenceNumber = event.segment.acknowledgmentNumber;
          this.state = TCPState.ESTABLISHED;
          return this.createACKSegment();
        } else if (event.segment.flags.SYN) {
          // Simultaneous open
          this.acknowledgmentNumber = event.segment.sequenceNumber + 1;
          this.state = TCPState.SYN_RECEIVED;
          return this.createSYNACKSegment();
        }
        return null;

      case "CLOSE":
        this.state = TCPState.CLOSED;
        return null;

      case "TIMEOUT":
        // Retransmit SYN
        return this.createSYNSegment();

      default:
        return null;
    }
  }

  /**
   * Handle SYN_RECEIVED state
   */
  private handleSynReceived(event: TCPEvent): TCPSegment | null {
    switch (event.type) {
      case "RECEIVE":
        if (event.segment.flags.ACK) {
          this.sequenceNumber = event.segment.acknowledgmentNumber;
          this.state = TCPState.ESTABLISHED;
        }
        return null;

      case "CLOSE":
        this.state = TCPState.FIN_WAIT_1;
        return this.createFINSegment();

      default:
        return null;
    }
  }

  /**
   * Handle ESTABLISHED state
   */
  private handleEstablished(event: TCPEvent): TCPSegment | null {
    switch (event.type) {
      case "SEND":
        return this.createDataSegment(event.data);

      case "RECEIVE":
        if (event.segment.flags.FIN) {
          this.acknowledgmentNumber = event.segment.sequenceNumber + 1;
          this.state = TCPState.CLOSE_WAIT;
          return this.createACKSegment();
        }
        if (event.segment.data.length > 0) {
          this.acknowledgmentNumber = event.segment.sequenceNumber + event.segment.data.length;
          return this.createACKSegment();
        }
        return null;

      case "CLOSE":
        this.state = TCPState.FIN_WAIT_1;
        return this.createFINSegment();

      default:
        return null;
    }
  }

  /**
   * Handle FIN_WAIT_1 state
   */
  private handleFinWait1(event: TCPEvent): TCPSegment | null {
    switch (event.type) {
      case "RECEIVE":
        if (event.segment.flags.FIN && event.segment.flags.ACK) {
          // Simultaneous close
          this.acknowledgmentNumber = event.segment.sequenceNumber + 1;
          this.state = TCPState.TIME_WAIT;
          this.startTimeWaitTimer();
          return this.createACKSegment();
        } else if (event.segment.flags.FIN) {
          this.acknowledgmentNumber = event.segment.sequenceNumber + 1;
          this.state = TCPState.CLOSING;
          return this.createACKSegment();
        } else if (event.segment.flags.ACK) {
          this.state = TCPState.FIN_WAIT_2;
        }
        return null;

      default:
        return null;
    }
  }

  /**
   * Handle FIN_WAIT_2 state
   */
  private handleFinWait2(event: TCPEvent): TCPSegment | null {
    switch (event.type) {
      case "RECEIVE":
        if (event.segment.flags.FIN) {
          this.acknowledgmentNumber = event.segment.sequenceNumber + 1;
          this.state = TCPState.TIME_WAIT;
          this.startTimeWaitTimer();
          return this.createACKSegment();
        }
        return null;

      default:
        return null;
    }
  }

  /**
   * Handle CLOSE_WAIT state
   */
  private handleCloseWait(event: TCPEvent): TCPSegment | null {
    switch (event.type) {
      case "CLOSE":
        this.state = TCPState.LAST_ACK;
        return this.createFINSegment();

      default:
        return null;
    }
  }

  /**
   * Handle CLOSING state
   */
  private handleClosing(event: TCPEvent): TCPSegment | null {
    switch (event.type) {
      case "RECEIVE":
        if (event.segment.flags.ACK) {
          this.state = TCPState.TIME_WAIT;
          this.startTimeWaitTimer();
        }
        return null;

      default:
        return null;
    }
  }

  /**
   * Handle LAST_ACK state
   */
  private handleLastAck(event: TCPEvent): TCPSegment | null {
    switch (event.type) {
      case "RECEIVE":
        if (event.segment.flags.ACK) {
          this.state = TCPState.CLOSED;
        }
        return null;

      default:
        return null;
    }
  }

  /**
   * Handle TIME_WAIT state
   */
  private handleTimeWait(event: TCPEvent): TCPSegment | null {
    switch (event.type) {
      case "TIMEOUT":
        this.state = TCPState.CLOSED;
        return null;

      default:
        return null;
    }
  }

  /**
   * Create SYN segment
   */
  private createSYNSegment(): TCPSegment {
    return {
      sourcePort: 0,
      destPort: 0,
      sequenceNumber: this.sequenceNumber,
      acknowledgmentNumber: 0,
      flags: {
        SYN: true,
        ACK: false,
        FIN: false,
        RST: false,
        PSH: false,
        URG: false,
      },
      windowSize: this.receiveWindow,
      data: new Uint8Array(0),
    };
  }

  /**
   * Create SYN+ACK segment
   */
  private createSYNACKSegment(): TCPSegment {
    return {
      sourcePort: 0,
      destPort: 0,
      sequenceNumber: this.sequenceNumber,
      acknowledgmentNumber: this.acknowledgmentNumber,
      flags: {
        SYN: true,
        ACK: true,
        FIN: false,
        RST: false,
        PSH: false,
        URG: false,
      },
      windowSize: this.receiveWindow,
      data: new Uint8Array(0),
    };
  }

  /**
   * Create ACK segment
   */
  private createACKSegment(): TCPSegment {
    return {
      sourcePort: 0,
      destPort: 0,
      sequenceNumber: this.sequenceNumber,
      acknowledgmentNumber: this.acknowledgmentNumber,
      flags: {
        SYN: false,
        ACK: true,
        FIN: false,
        RST: false,
        PSH: false,
        URG: false,
      },
      windowSize: this.receiveWindow,
      data: new Uint8Array(0),
    };
  }

  /**
   * Create FIN segment
   */
  private createFINSegment(): TCPSegment {
    return {
      sourcePort: 0,
      destPort: 0,
      sequenceNumber: this.sequenceNumber,
      acknowledgmentNumber: this.acknowledgmentNumber,
      flags: {
        SYN: false,
        ACK: true,
        FIN: true,
        RST: false,
        PSH: false,
        URG: false,
      },
      windowSize: this.receiveWindow,
      data: new Uint8Array(0),
    };
  }

  /**
   * Create data segment
   */
  private createDataSegment(data: Uint8Array): TCPSegment {
    const segment: TCPSegment = {
      sourcePort: 0,
      destPort: 0,
      sequenceNumber: this.sequenceNumber,
      acknowledgmentNumber: this.acknowledgmentNumber,
      flags: {
        SYN: false,
        ACK: true,
        FIN: false,
        RST: false,
        PSH: true,
        URG: false,
      },
      windowSize: this.receiveWindow,
      data,
    };

    this.sequenceNumber += data.length;
    return segment;
  }

  /**
   * Generate Initial Sequence Number (ISN)
   */
  private generateISN(): number {
    // In practice, this should be based on time and random factors
    // For simplicity, using a random number
    return Math.floor(Math.random() * 0xffffffff);
  }

  /**
   * Start TIME_WAIT timer (2 * MSL)
   */
  private startTimeWaitTimer(): void {
    // 2 * MSL = 2 * 2 minutes = 4 minutes
    const MSL = 2 * 60 * 1000;
    setTimeout(() => {
      this.processEvent({ type: "TIMEOUT" });
    }, 2 * MSL);
  }

  /**
   * Update RTT estimate
   */
  updateRTT(measuredRTT: number): void {
    if (this.smoothedRTT === 0) {
      // First measurement
      this.smoothedRTT = measuredRTT;
      this.rttVariance = measuredRTT / 2;
    } else {
      // Exponential weighted moving average
      const alpha = 0.125;
      const beta = 0.25;

      const diff = Math.abs(this.smoothedRTT - measuredRTT);
      this.rttVariance = (1 - beta) * this.rttVariance + beta * diff;
      this.smoothedRTT = (1 - alpha) * this.smoothedRTT + alpha * measuredRTT;
    }

    // Update RTO (Retransmission Timeout)
    this.retransmitTimeout = this.smoothedRTT + 4 * this.rttVariance;

    // Clamp RTO to reasonable bounds
    this.retransmitTimeout = Math.max(1000, Math.min(60000, this.retransmitTimeout));
  }

  /**
   * Update congestion window (slow start / congestion avoidance)
   */
  updateCongestionWindow(acked: boolean, duplicate: boolean): void {
    if (acked && !duplicate) {
      if (this.cwnd < this.ssthresh) {
        // Slow start: exponential growth
        this.cwnd += 1;
      } else {
        // Congestion avoidance: linear growth
        this.cwnd += 1 / this.cwnd;
      }
    } else if (duplicate) {
      // Fast retransmit / fast recovery
      this.ssthresh = Math.max(this.cwnd / 2, 2);
      this.cwnd = this.ssthresh + 3;
    }
  }

  /**
   * Handle timeout (packet loss)
   */
  handleTimeout(): void {
    // Multiplicative decrease
    this.ssthresh = Math.max(this.cwnd / 2, 2);
    this.cwnd = 1;

    // Exponential backoff
    this.retransmitTimeout *= 2;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      state: this.state,
      sequenceNumber: this.sequenceNumber,
      acknowledgmentNumber: this.acknowledgmentNumber,
      sendWindow: this.sendWindow,
      receiveWindow: this.receiveWindow,
      cwnd: this.cwnd,
      ssthresh: this.ssthresh,
      rto: this.retransmitTimeout,
      smoothedRTT: this.smoothedRTT,
      rttVariance: this.rttVariance,
    };
  }
}
