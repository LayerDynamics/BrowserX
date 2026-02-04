/**
 * TCPState Tests
 * Comprehensive tests for TCP state machine implementation
 */

import { assertEquals, assertExists, assert, assertNotEquals } from "@std/assert";
import {
  TCPState,
  TCPStateMachine,
  type TCPFlags,
  type TCPSegment,
  type TCPEvent,
} from "../../../../../core/network/transport/tcp/tcp_state.ts";

// ============================================================================
// TCPState Enum Tests
// ============================================================================

Deno.test({
  name: "TCPState - has CLOSED state",
  fn() {
    assertEquals(TCPState.CLOSED, "CLOSED");
  },
});

Deno.test({
  name: "TCPState - has LISTEN state",
  fn() {
    assertEquals(TCPState.LISTEN, "LISTEN");
  },
});

Deno.test({
  name: "TCPState - has SYN_SENT state",
  fn() {
    assertEquals(TCPState.SYN_SENT, "SYN_SENT");
  },
});

Deno.test({
  name: "TCPState - has SYN_RECEIVED state",
  fn() {
    assertEquals(TCPState.SYN_RECEIVED, "SYN_RECEIVED");
  },
});

Deno.test({
  name: "TCPState - has ESTABLISHED state",
  fn() {
    assertEquals(TCPState.ESTABLISHED, "ESTABLISHED");
  },
});

Deno.test({
  name: "TCPState - has FIN_WAIT_1 state",
  fn() {
    assertEquals(TCPState.FIN_WAIT_1, "FIN_WAIT_1");
  },
});

Deno.test({
  name: "TCPState - has FIN_WAIT_2 state",
  fn() {
    assertEquals(TCPState.FIN_WAIT_2, "FIN_WAIT_2");
  },
});

Deno.test({
  name: "TCPState - has CLOSE_WAIT state",
  fn() {
    assertEquals(TCPState.CLOSE_WAIT, "CLOSE_WAIT");
  },
});

Deno.test({
  name: "TCPState - has CLOSING state",
  fn() {
    assertEquals(TCPState.CLOSING, "CLOSING");
  },
});

Deno.test({
  name: "TCPState - has LAST_ACK state",
  fn() {
    assertEquals(TCPState.LAST_ACK, "LAST_ACK");
  },
});

Deno.test({
  name: "TCPState - has TIME_WAIT state",
  fn() {
    assertEquals(TCPState.TIME_WAIT, "TIME_WAIT");
  },
});

Deno.test({
  name: "TCPState - has 11 states total",
  fn() {
    const states = Object.values(TCPState);
    assertEquals(states.length, 11);
  },
});

// ============================================================================
// TCPStateMachine Constructor Tests
// ============================================================================

Deno.test({
  name: "TCPStateMachine - initializes in CLOSED state",
  fn() {
    const sm = new TCPStateMachine();
    assertEquals(sm.getState(), TCPState.CLOSED);
  },
});

Deno.test({
  name: "TCPStateMachine - generates initial sequence number",
  fn() {
    const sm = new TCPStateMachine();
    const stats = sm.getStats();

    assertExists(stats.sequenceNumber);
    assert(stats.sequenceNumber >= 0);
    assert(stats.sequenceNumber <= 0xffffffff);
  },
});

Deno.test({
  name: "TCPStateMachine - different instances have different ISNs",
  fn() {
    const sm1 = new TCPStateMachine();
    const sm2 = new TCPStateMachine();

    // Not strictly guaranteed but very likely
    assertNotEquals(sm1.getStats().sequenceNumber, sm2.getStats().sequenceNumber);
  },
});

// ============================================================================
// PASSIVE_OPEN Tests (Server Side)
// ============================================================================

Deno.test({
  name: "TCPStateMachine - PASSIVE_OPEN transitions CLOSED to LISTEN",
  fn() {
    const sm = new TCPStateMachine();

    const segment = sm.processEvent({ type: "PASSIVE_OPEN" });

    assertEquals(sm.getState(), TCPState.LISTEN);
    assertEquals(segment, null);
  },
});

Deno.test({
  name: "TCPStateMachine - LISTEN receives SYN and transitions to SYN_RECEIVED",
  fn() {
    const sm = new TCPStateMachine();
    sm.processEvent({ type: "PASSIVE_OPEN" });

    const synSegment: TCPSegment = {
      sourcePort: 12345,
      destPort: 80,
      sequenceNumber: 1000,
      acknowledgmentNumber: 0,
      flags: { SYN: true, ACK: false, FIN: false, RST: false, PSH: false, URG: false },
      windowSize: 65535,
      data: new Uint8Array(0),
    };

    const response = sm.processEvent({ type: "RECEIVE", segment: synSegment });

    assertEquals(sm.getState(), TCPState.SYN_RECEIVED);
    assertExists(response);
    assertEquals(response!.flags.SYN, true);
    assertEquals(response!.flags.ACK, true);
  },
});

// ============================================================================
// ACTIVE_OPEN Tests (Client Side)
// ============================================================================

Deno.test({
  name: "TCPStateMachine - ACTIVE_OPEN transitions CLOSED to SYN_SENT",
  fn() {
    const sm = new TCPStateMachine();

    const segment = sm.processEvent({ type: "ACTIVE_OPEN" });

    assertEquals(sm.getState(), TCPState.SYN_SENT);
    assertExists(segment);
    assertEquals(segment!.flags.SYN, true);
    assertEquals(segment!.flags.ACK, false);
  },
});

Deno.test({
  name: "TCPStateMachine - SYN_SENT receives SYN+ACK and transitions to ESTABLISHED",
  fn() {
    const sm = new TCPStateMachine();
    sm.processEvent({ type: "ACTIVE_OPEN" });

    const synAckSegment: TCPSegment = {
      sourcePort: 80,
      destPort: 12345,
      sequenceNumber: 2000,
      acknowledgmentNumber: 1001,
      flags: { SYN: true, ACK: true, FIN: false, RST: false, PSH: false, URG: false },
      windowSize: 65535,
      data: new Uint8Array(0),
    };

    const response = sm.processEvent({ type: "RECEIVE", segment: synAckSegment });

    assertEquals(sm.getState(), TCPState.ESTABLISHED);
    assertExists(response);
    assertEquals(response!.flags.ACK, true);
    assertEquals(response!.flags.SYN, false);
  },
});

// ============================================================================
// Simultaneous Open Tests
// ============================================================================

Deno.test({
  name: "TCPStateMachine - SYN_SENT receives SYN (no ACK) and transitions to SYN_RECEIVED",
  fn() {
    const sm = new TCPStateMachine();
    sm.processEvent({ type: "ACTIVE_OPEN" });

    const synSegment: TCPSegment = {
      sourcePort: 80,
      destPort: 12345,
      sequenceNumber: 2000,
      acknowledgmentNumber: 0,
      flags: { SYN: true, ACK: false, FIN: false, RST: false, PSH: false, URG: false },
      windowSize: 65535,
      data: new Uint8Array(0),
    };

    const response = sm.processEvent({ type: "RECEIVE", segment: synSegment });

    assertEquals(sm.getState(), TCPState.SYN_RECEIVED);
    assertExists(response);
    assertEquals(response!.flags.SYN, true);
    assertEquals(response!.flags.ACK, true);
  },
});

// ============================================================================
// Data Transfer Tests (ESTABLISHED state)
// ============================================================================

Deno.test({
  name: "TCPStateMachine - ESTABLISHED allows SEND",
  fn() {
    const sm = new TCPStateMachine();
    sm.processEvent({ type: "ACTIVE_OPEN" });

    const synAckSegment: TCPSegment = {
      sourcePort: 80,
      destPort: 12345,
      sequenceNumber: 2000,
      acknowledgmentNumber: 1001,
      flags: { SYN: true, ACK: true, FIN: false, RST: false, PSH: false, URG: false },
      windowSize: 65535,
      data: new Uint8Array(0),
    };
    sm.processEvent({ type: "RECEIVE", segment: synAckSegment });

    const data = new Uint8Array([1, 2, 3, 4, 5]);
    const segment = sm.processEvent({ type: "SEND", data });

    assertExists(segment);
    assertEquals(segment!.flags.ACK, true);
    assertEquals(segment!.flags.PSH, true);
    assertEquals(segment!.data, data);
  },
});

Deno.test({
  name: "TCPStateMachine - ESTABLISHED receives data and sends ACK",
  fn() {
    const sm = new TCPStateMachine();
    sm.processEvent({ type: "ACTIVE_OPEN" });

    const synAckSegment: TCPSegment = {
      sourcePort: 80,
      destPort: 12345,
      sequenceNumber: 2000,
      acknowledgmentNumber: 1001,
      flags: { SYN: true, ACK: true, FIN: false, RST: false, PSH: false, URG: false },
      windowSize: 65535,
      data: new Uint8Array(0),
    };
    sm.processEvent({ type: "RECEIVE", segment: synAckSegment });

    const dataSegment: TCPSegment = {
      sourcePort: 80,
      destPort: 12345,
      sequenceNumber: 2001,
      acknowledgmentNumber: 1001,
      flags: { SYN: false, ACK: true, FIN: false, RST: false, PSH: true, URG: false },
      windowSize: 65535,
      data: new Uint8Array([10, 20, 30]),
    };

    const response = sm.processEvent({ type: "RECEIVE", segment: dataSegment });

    assertEquals(sm.getState(), TCPState.ESTABLISHED);
    assertExists(response);
    assertEquals(response!.flags.ACK, true);
  },
});

// ============================================================================
// Connection Termination Tests (Active Close)
// ============================================================================

Deno.test({
  name: "TCPStateMachine - ESTABLISHED CLOSE transitions to FIN_WAIT_1",
  fn() {
    const sm = new TCPStateMachine();
    sm.processEvent({ type: "ACTIVE_OPEN" });

    const synAckSegment: TCPSegment = {
      sourcePort: 80,
      destPort: 12345,
      sequenceNumber: 2000,
      acknowledgmentNumber: 1001,
      flags: { SYN: true, ACK: true, FIN: false, RST: false, PSH: false, URG: false },
      windowSize: 65535,
      data: new Uint8Array(0),
    };
    sm.processEvent({ type: "RECEIVE", segment: synAckSegment });

    const segment = sm.processEvent({ type: "CLOSE" });

    assertEquals(sm.getState(), TCPState.FIN_WAIT_1);
    assertExists(segment);
    assertEquals(segment!.flags.FIN, true);
    assertEquals(segment!.flags.ACK, true);
  },
});

Deno.test({
  name: "TCPStateMachine - FIN_WAIT_1 receives ACK transitions to FIN_WAIT_2",
  fn() {
    const sm = new TCPStateMachine();
    sm.processEvent({ type: "ACTIVE_OPEN" });

    const synAckSegment: TCPSegment = {
      sourcePort: 80,
      destPort: 12345,
      sequenceNumber: 2000,
      acknowledgmentNumber: 1001,
      flags: { SYN: true, ACK: true, FIN: false, RST: false, PSH: false, URG: false },
      windowSize: 65535,
      data: new Uint8Array(0),
    };
    sm.processEvent({ type: "RECEIVE", segment: synAckSegment });
    sm.processEvent({ type: "CLOSE" });

    const ackSegment: TCPSegment = {
      sourcePort: 80,
      destPort: 12345,
      sequenceNumber: 2001,
      acknowledgmentNumber: 1002,
      flags: { SYN: false, ACK: true, FIN: false, RST: false, PSH: false, URG: false },
      windowSize: 65535,
      data: new Uint8Array(0),
    };

    sm.processEvent({ type: "RECEIVE", segment: ackSegment });

    assertEquals(sm.getState(), TCPState.FIN_WAIT_2);
  },
});

Deno.test({
  name: "TCPStateMachine - FIN_WAIT_2 receives FIN transitions to TIME_WAIT",
  fn() {
    const sm = new TCPStateMachine();
    sm.processEvent({ type: "ACTIVE_OPEN" });

    const synAckSegment: TCPSegment = {
      sourcePort: 80,
      destPort: 12345,
      sequenceNumber: 2000,
      acknowledgmentNumber: 1001,
      flags: { SYN: true, ACK: true, FIN: false, RST: false, PSH: false, URG: false },
      windowSize: 65535,
      data: new Uint8Array(0),
    };
    sm.processEvent({ type: "RECEIVE", segment: synAckSegment });
    sm.processEvent({ type: "CLOSE" });

    const ackSegment: TCPSegment = {
      sourcePort: 80,
      destPort: 12345,
      sequenceNumber: 2001,
      acknowledgmentNumber: 1002,
      flags: { SYN: false, ACK: true, FIN: false, RST: false, PSH: false, URG: false },
      windowSize: 65535,
      data: new Uint8Array(0),
    };
    sm.processEvent({ type: "RECEIVE", segment: ackSegment });

    const finSegment: TCPSegment = {
      sourcePort: 80,
      destPort: 12345,
      sequenceNumber: 2001,
      acknowledgmentNumber: 1002,
      flags: { SYN: false, ACK: true, FIN: true, RST: false, PSH: false, URG: false },
      windowSize: 65535,
      data: new Uint8Array(0),
    };

    const response = sm.processEvent({ type: "RECEIVE", segment: finSegment });

    assertEquals(sm.getState(), TCPState.TIME_WAIT);
    assertExists(response);
    assertEquals(response!.flags.ACK, true);

    // Cleanup timer to prevent leak
    sm.cleanup();
  },
});

// ============================================================================
// Connection Termination Tests (Passive Close)
// ============================================================================

Deno.test({
  name: "TCPStateMachine - ESTABLISHED receives FIN transitions to CLOSE_WAIT",
  fn() {
    const sm = new TCPStateMachine();
    sm.processEvent({ type: "ACTIVE_OPEN" });

    const synAckSegment: TCPSegment = {
      sourcePort: 80,
      destPort: 12345,
      sequenceNumber: 2000,
      acknowledgmentNumber: 1001,
      flags: { SYN: true, ACK: true, FIN: false, RST: false, PSH: false, URG: false },
      windowSize: 65535,
      data: new Uint8Array(0),
    };
    sm.processEvent({ type: "RECEIVE", segment: synAckSegment });

    const finSegment: TCPSegment = {
      sourcePort: 80,
      destPort: 12345,
      sequenceNumber: 2001,
      acknowledgmentNumber: 1001,
      flags: { SYN: false, ACK: true, FIN: true, RST: false, PSH: false, URG: false },
      windowSize: 65535,
      data: new Uint8Array(0),
    };

    const response = sm.processEvent({ type: "RECEIVE", segment: finSegment });

    assertEquals(sm.getState(), TCPState.CLOSE_WAIT);
    assertExists(response);
    assertEquals(response!.flags.ACK, true);
  },
});

Deno.test({
  name: "TCPStateMachine - CLOSE_WAIT CLOSE transitions to LAST_ACK",
  fn() {
    const sm = new TCPStateMachine();
    sm.processEvent({ type: "ACTIVE_OPEN" });

    const synAckSegment: TCPSegment = {
      sourcePort: 80,
      destPort: 12345,
      sequenceNumber: 2000,
      acknowledgmentNumber: 1001,
      flags: { SYN: true, ACK: true, FIN: false, RST: false, PSH: false, URG: false },
      windowSize: 65535,
      data: new Uint8Array(0),
    };
    sm.processEvent({ type: "RECEIVE", segment: synAckSegment });

    const finSegment: TCPSegment = {
      sourcePort: 80,
      destPort: 12345,
      sequenceNumber: 2001,
      acknowledgmentNumber: 1001,
      flags: { SYN: false, ACK: true, FIN: true, RST: false, PSH: false, URG: false },
      windowSize: 65535,
      data: new Uint8Array(0),
    };
    sm.processEvent({ type: "RECEIVE", segment: finSegment });

    const response = sm.processEvent({ type: "CLOSE" });

    assertEquals(sm.getState(), TCPState.LAST_ACK);
    assertExists(response);
    assertEquals(response!.flags.FIN, true);
    assertEquals(response!.flags.ACK, true);
  },
});

Deno.test({
  name: "TCPStateMachine - LAST_ACK receives ACK transitions to CLOSED",
  fn() {
    const sm = new TCPStateMachine();
    sm.processEvent({ type: "ACTIVE_OPEN" });

    const synAckSegment: TCPSegment = {
      sourcePort: 80,
      destPort: 12345,
      sequenceNumber: 2000,
      acknowledgmentNumber: 1001,
      flags: { SYN: true, ACK: true, FIN: false, RST: false, PSH: false, URG: false },
      windowSize: 65535,
      data: new Uint8Array(0),
    };
    sm.processEvent({ type: "RECEIVE", segment: synAckSegment });

    const finSegment: TCPSegment = {
      sourcePort: 80,
      destPort: 12345,
      sequenceNumber: 2001,
      acknowledgmentNumber: 1001,
      flags: { SYN: false, ACK: true, FIN: true, RST: false, PSH: false, URG: false },
      windowSize: 65535,
      data: new Uint8Array(0),
    };
    sm.processEvent({ type: "RECEIVE", segment: finSegment });
    sm.processEvent({ type: "CLOSE" });

    const ackSegment: TCPSegment = {
      sourcePort: 80,
      destPort: 12345,
      sequenceNumber: 2002,
      acknowledgmentNumber: 1003,
      flags: { SYN: false, ACK: true, FIN: false, RST: false, PSH: false, URG: false },
      windowSize: 65535,
      data: new Uint8Array(0),
    };

    sm.processEvent({ type: "RECEIVE", segment: ackSegment });

    assertEquals(sm.getState(), TCPState.CLOSED);
  },
});

// ============================================================================
// Simultaneous Close Tests
// ============================================================================

Deno.test({
  name: "TCPStateMachine - FIN_WAIT_1 receives FIN+ACK transitions to TIME_WAIT",
  fn() {
    const sm = new TCPStateMachine();
    sm.processEvent({ type: "ACTIVE_OPEN" });

    const synAckSegment: TCPSegment = {
      sourcePort: 80,
      destPort: 12345,
      sequenceNumber: 2000,
      acknowledgmentNumber: 1001,
      flags: { SYN: true, ACK: true, FIN: false, RST: false, PSH: false, URG: false },
      windowSize: 65535,
      data: new Uint8Array(0),
    };
    sm.processEvent({ type: "RECEIVE", segment: synAckSegment });
    sm.processEvent({ type: "CLOSE" });

    const finAckSegment: TCPSegment = {
      sourcePort: 80,
      destPort: 12345,
      sequenceNumber: 2001,
      acknowledgmentNumber: 1002,
      flags: { SYN: false, ACK: true, FIN: true, RST: false, PSH: false, URG: false },
      windowSize: 65535,
      data: new Uint8Array(0),
    };

    const response = sm.processEvent({ type: "RECEIVE", segment: finAckSegment });

    assertEquals(sm.getState(), TCPState.TIME_WAIT);
    assertExists(response);
    assertEquals(response!.flags.ACK, true);

    // Cleanup timer to prevent leak
    sm.cleanup();
  },
});

Deno.test({
  name: "TCPStateMachine - FIN_WAIT_1 receives FIN (no ACK) transitions to CLOSING",
  fn() {
    const sm = new TCPStateMachine();
    sm.processEvent({ type: "ACTIVE_OPEN" });

    const synAckSegment: TCPSegment = {
      sourcePort: 80,
      destPort: 12345,
      sequenceNumber: 2000,
      acknowledgmentNumber: 1001,
      flags: { SYN: true, ACK: true, FIN: false, RST: false, PSH: false, URG: false },
      windowSize: 65535,
      data: new Uint8Array(0),
    };
    sm.processEvent({ type: "RECEIVE", segment: synAckSegment });
    sm.processEvent({ type: "CLOSE" });

    const finSegment: TCPSegment = {
      sourcePort: 80,
      destPort: 12345,
      sequenceNumber: 2001,
      acknowledgmentNumber: 1001,
      flags: { SYN: false, ACK: false, FIN: true, RST: false, PSH: false, URG: false },
      windowSize: 65535,
      data: new Uint8Array(0),
    };

    const response = sm.processEvent({ type: "RECEIVE", segment: finSegment });

    assertEquals(sm.getState(), TCPState.CLOSING);
    assertExists(response);
    assertEquals(response!.flags.ACK, true);
  },
});

Deno.test({
  name: "TCPStateMachine - CLOSING receives ACK transitions to TIME_WAIT",
  fn() {
    const sm = new TCPStateMachine();
    sm.processEvent({ type: "ACTIVE_OPEN" });

    const synAckSegment: TCPSegment = {
      sourcePort: 80,
      destPort: 12345,
      sequenceNumber: 2000,
      acknowledgmentNumber: 1001,
      flags: { SYN: true, ACK: true, FIN: false, RST: false, PSH: false, URG: false },
      windowSize: 65535,
      data: new Uint8Array(0),
    };
    sm.processEvent({ type: "RECEIVE", segment: synAckSegment });
    sm.processEvent({ type: "CLOSE" });

    const finSegment: TCPSegment = {
      sourcePort: 80,
      destPort: 12345,
      sequenceNumber: 2001,
      acknowledgmentNumber: 1001,
      flags: { SYN: false, ACK: false, FIN: true, RST: false, PSH: false, URG: false },
      windowSize: 65535,
      data: new Uint8Array(0),
    };
    sm.processEvent({ type: "RECEIVE", segment: finSegment });

    const ackSegment: TCPSegment = {
      sourcePort: 80,
      destPort: 12345,
      sequenceNumber: 2002,
      acknowledgmentNumber: 1002,
      flags: { SYN: false, ACK: true, FIN: false, RST: false, PSH: false, URG: false },
      windowSize: 65535,
      data: new Uint8Array(0),
    };

    sm.processEvent({ type: "RECEIVE", segment: ackSegment });

    assertEquals(sm.getState(), TCPState.TIME_WAIT);

    // Cleanup timer to prevent leak
    sm.cleanup();
  },
});

// ============================================================================
// TIME_WAIT Timeout Tests
// ============================================================================

Deno.test({
  name: "TCPStateMachine - TIME_WAIT TIMEOUT transitions to CLOSED",
  fn() {
    const sm = new TCPStateMachine();
    sm.processEvent({ type: "ACTIVE_OPEN" });

    const synAckSegment: TCPSegment = {
      sourcePort: 80,
      destPort: 12345,
      sequenceNumber: 2000,
      acknowledgmentNumber: 1001,
      flags: { SYN: true, ACK: true, FIN: false, RST: false, PSH: false, URG: false },
      windowSize: 65535,
      data: new Uint8Array(0),
    };
    sm.processEvent({ type: "RECEIVE", segment: synAckSegment });
    sm.processEvent({ type: "CLOSE" });

    const finAckSegment: TCPSegment = {
      sourcePort: 80,
      destPort: 12345,
      sequenceNumber: 2001,
      acknowledgmentNumber: 1002,
      flags: { SYN: false, ACK: true, FIN: true, RST: false, PSH: false, URG: false },
      windowSize: 65535,
      data: new Uint8Array(0),
    };
    sm.processEvent({ type: "RECEIVE", segment: finAckSegment });

    assertEquals(sm.getState(), TCPState.TIME_WAIT);

    // Cleanup the TIME_WAIT timer since we're manually processing TIMEOUT
    sm.cleanup();

    sm.processEvent({ type: "TIMEOUT" });

    assertEquals(sm.getState(), TCPState.CLOSED);
  },
});

// ============================================================================
// Retransmit Timeout Tests
// ============================================================================

Deno.test({
  name: "TCPStateMachine - SYN_SENT TIMEOUT retransmits SYN",
  fn() {
    const sm = new TCPStateMachine();
    sm.processEvent({ type: "ACTIVE_OPEN" });

    assertEquals(sm.getState(), TCPState.SYN_SENT);

    const segment = sm.processEvent({ type: "TIMEOUT" });

    // State should remain SYN_SENT
    assertEquals(sm.getState(), TCPState.SYN_SENT);
    assertExists(segment);
    assertEquals(segment!.flags.SYN, true);
  },
});

// ============================================================================
// RTT Estimation Tests
// ============================================================================

Deno.test({
  name: "TCPStateMachine - updateRTT sets initial smoothedRTT",
  fn() {
    const sm = new TCPStateMachine();
    const initialStats = sm.getStats();

    assertEquals(initialStats.smoothedRTT, 0);

    sm.updateRTT(100);

    const updatedStats = sm.getStats();
    assertEquals(updatedStats.smoothedRTT, 100);
  },
});

Deno.test({
  name: "TCPStateMachine - updateRTT uses exponential weighted moving average",
  fn() {
    const sm = new TCPStateMachine();

    sm.updateRTT(100);
    sm.updateRTT(200);

    const stats = sm.getStats();

    // EWMA with alpha = 0.125
    // smoothedRTT = (1 - 0.125) * 100 + 0.125 * 200 = 87.5 + 25 = 112.5
    assert(stats.smoothedRTT > 100);
    assert(stats.smoothedRTT < 200);
  },
});

Deno.test({
  name: "TCPStateMachine - updateRTT updates RTO",
  fn() {
    const sm = new TCPStateMachine();
    const initialStats = sm.getStats();
    const initialRTO = initialStats.rto;

    // Use RTT value large enough to produce RTO > 1000ms minimum
    // RTO = smoothedRTT + 4 * rttVariance = 3 * measuredRTT (first measurement)
    // For RTO > 1000: measuredRTT > 333.33
    sm.updateRTT(500);

    const updatedStats = sm.getStats();
    assertNotEquals(updatedStats.rto, initialRTO);
  },
});

Deno.test({
  name: "TCPStateMachine - RTO is clamped to minimum 1000ms",
  fn() {
    const sm = new TCPStateMachine();

    sm.updateRTT(1); // Very small RTT

    const stats = sm.getStats();
    assert(stats.rto >= 1000);
  },
});

Deno.test({
  name: "TCPStateMachine - RTO is clamped to maximum 60000ms",
  fn() {
    const sm = new TCPStateMachine();

    sm.updateRTT(100000); // Very large RTT

    const stats = sm.getStats();
    assert(stats.rto <= 60000);
  },
});

// ============================================================================
// Congestion Control Tests
// ============================================================================

Deno.test({
  name: "TCPStateMachine - initial cwnd is 1",
  fn() {
    const sm = new TCPStateMachine();
    const stats = sm.getStats();

    assertEquals(stats.cwnd, 1);
  },
});

Deno.test({
  name: "TCPStateMachine - initial ssthresh is 65535",
  fn() {
    const sm = new TCPStateMachine();
    const stats = sm.getStats();

    assertEquals(stats.ssthresh, 65535);
  },
});

Deno.test({
  name: "TCPStateMachine - updateCongestionWindow increases cwnd on successful ACK",
  fn() {
    const sm = new TCPStateMachine();
    const initialCwnd = sm.getStats().cwnd;

    sm.updateCongestionWindow(true, false);

    const updatedCwnd = sm.getStats().cwnd;
    assert(updatedCwnd > initialCwnd);
  },
});

Deno.test({
  name: "TCPStateMachine - updateCongestionWindow on duplicate ACK triggers fast recovery",
  fn() {
    const sm = new TCPStateMachine();

    sm.updateCongestionWindow(false, true);

    const stats = sm.getStats();
    // ssthresh should be reduced and cwnd set to ssthresh + 3
    assert(stats.ssthresh < 65535);
    assertEquals(stats.cwnd, stats.ssthresh + 3);
  },
});

Deno.test({
  name: "TCPStateMachine - handleTimeout reduces cwnd to 1",
  fn() {
    const sm = new TCPStateMachine();

    // Increase cwnd first
    sm.updateCongestionWindow(true, false);
    sm.updateCongestionWindow(true, false);

    sm.handleTimeout();

    const stats = sm.getStats();
    assertEquals(stats.cwnd, 1);
  },
});

Deno.test({
  name: "TCPStateMachine - handleTimeout doubles retransmit timeout",
  fn() {
    const sm = new TCPStateMachine();

    sm.updateRTT(100);
    const rtoBefore = sm.getStats().rto;

    sm.handleTimeout();

    const rtoAfter = sm.getStats().rto;
    assertEquals(rtoAfter, rtoBefore * 2);
  },
});

// ============================================================================
// getStats Tests
// ============================================================================

Deno.test({
  name: "TCPStateMachine - getStats returns all statistics",
  fn() {
    const sm = new TCPStateMachine();
    const stats = sm.getStats();

    assertExists(stats.state);
    assertExists(stats.sequenceNumber);
    assertExists(stats.acknowledgmentNumber);
    assertExists(stats.sendWindow);
    assertExists(stats.receiveWindow);
    assertExists(stats.cwnd);
    assertExists(stats.ssthresh);
    assertExists(stats.rto);
    assertExists(stats.smoothedRTT);
    assertExists(stats.rttVariance);
  },
});

Deno.test({
  name: "TCPStateMachine - getStats state matches getState",
  fn() {
    const sm = new TCPStateMachine();

    assertEquals(sm.getStats().state, sm.getState());

    sm.processEvent({ type: "ACTIVE_OPEN" });

    assertEquals(sm.getStats().state, sm.getState());
  },
});

// ============================================================================
// CLOSE Event from Various States Tests
// ============================================================================

Deno.test({
  name: "TCPStateMachine - CLOSE in LISTEN transitions to CLOSED",
  fn() {
    const sm = new TCPStateMachine();
    sm.processEvent({ type: "PASSIVE_OPEN" });

    assertEquals(sm.getState(), TCPState.LISTEN);

    sm.processEvent({ type: "CLOSE" });

    assertEquals(sm.getState(), TCPState.CLOSED);
  },
});

Deno.test({
  name: "TCPStateMachine - CLOSE in SYN_SENT transitions to CLOSED",
  fn() {
    const sm = new TCPStateMachine();
    sm.processEvent({ type: "ACTIVE_OPEN" });

    assertEquals(sm.getState(), TCPState.SYN_SENT);

    sm.processEvent({ type: "CLOSE" });

    assertEquals(sm.getState(), TCPState.CLOSED);
  },
});

Deno.test({
  name: "TCPStateMachine - CLOSE in SYN_RECEIVED transitions to FIN_WAIT_1",
  fn() {
    const sm = new TCPStateMachine();
    sm.processEvent({ type: "PASSIVE_OPEN" });

    const synSegment: TCPSegment = {
      sourcePort: 12345,
      destPort: 80,
      sequenceNumber: 1000,
      acknowledgmentNumber: 0,
      flags: { SYN: true, ACK: false, FIN: false, RST: false, PSH: false, URG: false },
      windowSize: 65535,
      data: new Uint8Array(0),
    };
    sm.processEvent({ type: "RECEIVE", segment: synSegment });

    assertEquals(sm.getState(), TCPState.SYN_RECEIVED);

    const segment = sm.processEvent({ type: "CLOSE" });

    assertEquals(sm.getState(), TCPState.FIN_WAIT_1);
    assertExists(segment);
    assertEquals(segment!.flags.FIN, true);
  },
});

// ============================================================================
// Complete Connection Lifecycle Tests
// ============================================================================

Deno.test({
  name: "TCPStateMachine - complete client connection lifecycle",
  fn() {
    const sm = new TCPStateMachine();

    // 1. CLOSED -> SYN_SENT (ACTIVE_OPEN)
    assertEquals(sm.getState(), TCPState.CLOSED);
    sm.processEvent({ type: "ACTIVE_OPEN" });
    assertEquals(sm.getState(), TCPState.SYN_SENT);

    // 2. SYN_SENT -> ESTABLISHED (receive SYN+ACK)
    const synAckSegment: TCPSegment = {
      sourcePort: 80,
      destPort: 12345,
      sequenceNumber: 2000,
      acknowledgmentNumber: 1001,
      flags: { SYN: true, ACK: true, FIN: false, RST: false, PSH: false, URG: false },
      windowSize: 65535,
      data: new Uint8Array(0),
    };
    sm.processEvent({ type: "RECEIVE", segment: synAckSegment });
    assertEquals(sm.getState(), TCPState.ESTABLISHED);

    // 3. Data transfer
    sm.processEvent({ type: "SEND", data: new Uint8Array([1, 2, 3]) });
    assertEquals(sm.getState(), TCPState.ESTABLISHED);

    // 4. ESTABLISHED -> FIN_WAIT_1 (CLOSE)
    sm.processEvent({ type: "CLOSE" });
    assertEquals(sm.getState(), TCPState.FIN_WAIT_1);

    // 5. FIN_WAIT_1 -> FIN_WAIT_2 (receive ACK)
    const ackSegment: TCPSegment = {
      sourcePort: 80,
      destPort: 12345,
      sequenceNumber: 2001,
      acknowledgmentNumber: 1005,
      flags: { SYN: false, ACK: true, FIN: false, RST: false, PSH: false, URG: false },
      windowSize: 65535,
      data: new Uint8Array(0),
    };
    sm.processEvent({ type: "RECEIVE", segment: ackSegment });
    assertEquals(sm.getState(), TCPState.FIN_WAIT_2);

    // 6. FIN_WAIT_2 -> TIME_WAIT (receive FIN)
    const finSegment: TCPSegment = {
      sourcePort: 80,
      destPort: 12345,
      sequenceNumber: 2001,
      acknowledgmentNumber: 1005,
      flags: { SYN: false, ACK: true, FIN: true, RST: false, PSH: false, URG: false },
      windowSize: 65535,
      data: new Uint8Array(0),
    };
    sm.processEvent({ type: "RECEIVE", segment: finSegment });
    assertEquals(sm.getState(), TCPState.TIME_WAIT);

    // Clean up the TIME_WAIT timer before manually processing TIMEOUT
    sm.cleanup();

    // 7. TIME_WAIT -> CLOSED (TIMEOUT)
    sm.processEvent({ type: "TIMEOUT" });
    assertEquals(sm.getState(), TCPState.CLOSED);
  },
});

Deno.test({
  name: "TCPStateMachine - complete server connection lifecycle",
  fn() {
    const sm = new TCPStateMachine();

    // 1. CLOSED -> LISTEN (PASSIVE_OPEN)
    assertEquals(sm.getState(), TCPState.CLOSED);
    sm.processEvent({ type: "PASSIVE_OPEN" });
    assertEquals(sm.getState(), TCPState.LISTEN);

    // 2. LISTEN -> SYN_RECEIVED (receive SYN)
    const synSegment: TCPSegment = {
      sourcePort: 12345,
      destPort: 80,
      sequenceNumber: 1000,
      acknowledgmentNumber: 0,
      flags: { SYN: true, ACK: false, FIN: false, RST: false, PSH: false, URG: false },
      windowSize: 65535,
      data: new Uint8Array(0),
    };
    sm.processEvent({ type: "RECEIVE", segment: synSegment });
    assertEquals(sm.getState(), TCPState.SYN_RECEIVED);

    // 3. SYN_RECEIVED -> ESTABLISHED (receive ACK)
    const ackSegment: TCPSegment = {
      sourcePort: 12345,
      destPort: 80,
      sequenceNumber: 1001,
      acknowledgmentNumber: 2001,
      flags: { SYN: false, ACK: true, FIN: false, RST: false, PSH: false, URG: false },
      windowSize: 65535,
      data: new Uint8Array(0),
    };
    sm.processEvent({ type: "RECEIVE", segment: ackSegment });
    assertEquals(sm.getState(), TCPState.ESTABLISHED);

    // 4. ESTABLISHED -> CLOSE_WAIT (receive FIN)
    const finSegment: TCPSegment = {
      sourcePort: 12345,
      destPort: 80,
      sequenceNumber: 1001,
      acknowledgmentNumber: 2001,
      flags: { SYN: false, ACK: true, FIN: true, RST: false, PSH: false, URG: false },
      windowSize: 65535,
      data: new Uint8Array(0),
    };
    sm.processEvent({ type: "RECEIVE", segment: finSegment });
    assertEquals(sm.getState(), TCPState.CLOSE_WAIT);

    // 5. CLOSE_WAIT -> LAST_ACK (CLOSE)
    sm.processEvent({ type: "CLOSE" });
    assertEquals(sm.getState(), TCPState.LAST_ACK);

    // 6. LAST_ACK -> CLOSED (receive ACK)
    const finalAckSegment: TCPSegment = {
      sourcePort: 12345,
      destPort: 80,
      sequenceNumber: 1002,
      acknowledgmentNumber: 2002,
      flags: { SYN: false, ACK: true, FIN: false, RST: false, PSH: false, URG: false },
      windowSize: 65535,
      data: new Uint8Array(0),
    };
    sm.processEvent({ type: "RECEIVE", segment: finalAckSegment });
    assertEquals(sm.getState(), TCPState.CLOSED);
  },
});
