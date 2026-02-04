/**
 * TCPConnection Tests
 * Comprehensive tests for high-level TCP connection implementation
 */

import { assertEquals, assertExists, assert, assertRejects } from "@std/assert";
import {
  TCPConnection,
  type TCPConnectionConfig,
  type TCPConnectionStats,
} from "../../../../../core/network/transport/tcp/tcp_connection.ts";
import { TCPState } from "../../../../../core/network/transport/tcp/tcp_state.ts";
import { Socket, SocketState } from "../../../../../core/network/transport/socket/socket.ts";

// ============================================================================
// Mock Socket for Testing
// ============================================================================

/**
 * Mock socket for testing TCPConnection without real network
 */
class MockSocket {
  private state: SocketState = SocketState.CLOSED;
  private readBuffer: Uint8Array[] = [];
  private writeBuffer: Uint8Array[] = [];
  public host: string;
  public port: number;
  public closed = false;
  public optionsSet: { tcpNoDelay?: boolean; tcpKeepAlive?: boolean } = {};
  private readPromiseResolve?: (value: Uint8Array | null) => void;

  constructor(host = "127.0.0.1", port = 8080) {
    this.host = host;
    this.port = port;
    this.state = SocketState.OPEN; // Start connected for most tests
  }

  async read(p: Uint8Array): Promise<number | null> {
    if (this.closed) {
      return null;
    }

    if (this.readBuffer.length > 0) {
      const data = this.readBuffer.shift()!;
      const copyLen = Math.min(data.length, p.length);
      p.set(data.subarray(0, copyLen));
      return copyLen;
    }

    // Wait for data to be pushed
    return new Promise((resolve) => {
      this.readPromiseResolve = (data) => {
        if (data === null) {
          resolve(null);
        } else {
          const copyLen = Math.min(data.length, p.length);
          p.set(data.subarray(0, copyLen));
          resolve(copyLen);
        }
      };
    });
  }

  async write(p: Uint8Array): Promise<number> {
    if (this.closed) {
      throw new Error("Socket closed");
    }
    this.writeBuffer.push(new Uint8Array(p));
    return p.length;
  }

  close(): void {
    this.closed = true;
    this.state = SocketState.CLOSED;
    if (this.readPromiseResolve) {
      this.readPromiseResolve(null);
    }
  }

  getState(): SocketState {
    return this.state;
  }

  isConnected(): boolean {
    return this.state === SocketState.OPEN && !this.closed;
  }

  async setOptions(options: { tcpNoDelay?: boolean; tcpKeepAlive?: boolean }): Promise<void> {
    this.optionsSet = { ...this.optionsSet, ...options };
  }

  // Test helpers
  pushReadData(data: Uint8Array): void {
    if (this.readPromiseResolve) {
      this.readPromiseResolve(data);
      this.readPromiseResolve = undefined;
    } else {
      this.readBuffer.push(data);
    }
  }

  getWrittenData(): Uint8Array[] {
    return [...this.writeBuffer];
  }

  clearWriteBuffer(): void {
    this.writeBuffer = [];
  }
}

// ============================================================================
// TCPConnectionConfig Tests
// ============================================================================

Deno.test({
  name: "TCPConnectionConfig - interface has timeout property",
  fn() {
    const config: TCPConnectionConfig = {
      timeout: 30000,
    };
    assertEquals(config.timeout, 30000);
  },
});

Deno.test({
  name: "TCPConnectionConfig - interface has noDelay property",
  fn() {
    const config: TCPConnectionConfig = {
      noDelay: true,
    };
    assertEquals(config.noDelay, true);
  },
});

Deno.test({
  name: "TCPConnectionConfig - interface has keepAlive property",
  fn() {
    const config: TCPConnectionConfig = {
      keepAlive: true,
    };
    assertEquals(config.keepAlive, true);
  },
});

Deno.test({
  name: "TCPConnectionConfig - interface has keepAliveInterval property",
  fn() {
    const config: TCPConnectionConfig = {
      keepAliveInterval: 60000,
    };
    assertEquals(config.keepAliveInterval, 60000);
  },
});

Deno.test({
  name: "TCPConnectionConfig - interface has sendBufferSize property",
  fn() {
    const config: TCPConnectionConfig = {
      sendBufferSize: 65536,
    };
    assertEquals(config.sendBufferSize, 65536);
  },
});

Deno.test({
  name: "TCPConnectionConfig - interface has receiveBufferSize property",
  fn() {
    const config: TCPConnectionConfig = {
      receiveBufferSize: 65536,
    };
    assertEquals(config.receiveBufferSize, 65536);
  },
});

Deno.test({
  name: "TCPConnectionConfig - all properties are optional",
  fn() {
    const config: TCPConnectionConfig = {};
    assertExists(config);
  },
});

Deno.test({
  name: "TCPConnectionConfig - can set all properties",
  fn() {
    const config: TCPConnectionConfig = {
      timeout: 30000,
      noDelay: true,
      keepAlive: true,
      keepAliveInterval: 60000,
      sendBufferSize: 131072,
      receiveBufferSize: 131072,
    };

    assertEquals(config.timeout, 30000);
    assertEquals(config.noDelay, true);
    assertEquals(config.keepAlive, true);
    assertEquals(config.keepAliveInterval, 60000);
    assertEquals(config.sendBufferSize, 131072);
    assertEquals(config.receiveBufferSize, 131072);
  },
});

// ============================================================================
// TCPConnectionStats Tests
// ============================================================================

Deno.test({
  name: "TCPConnectionStats - has state property",
  fn() {
    const stats: TCPConnectionStats = {
      state: TCPState.ESTABLISHED,
      bytesSent: 0,
      bytesReceived: 0,
      segmentsSent: 0,
      segmentsReceived: 0,
      retransmissions: 0,
      rtt: 0,
      cwnd: 0,
      duration: 0,
    };
    assertEquals(stats.state, TCPState.ESTABLISHED);
  },
});

Deno.test({
  name: "TCPConnectionStats - has bytesSent property",
  fn() {
    const stats: TCPConnectionStats = {
      state: TCPState.CLOSED,
      bytesSent: 1000,
      bytesReceived: 0,
      segmentsSent: 0,
      segmentsReceived: 0,
      retransmissions: 0,
      rtt: 0,
      cwnd: 0,
      duration: 0,
    };
    assertEquals(stats.bytesSent, 1000);
  },
});

Deno.test({
  name: "TCPConnectionStats - has bytesReceived property",
  fn() {
    const stats: TCPConnectionStats = {
      state: TCPState.CLOSED,
      bytesSent: 0,
      bytesReceived: 2000,
      segmentsSent: 0,
      segmentsReceived: 0,
      retransmissions: 0,
      rtt: 0,
      cwnd: 0,
      duration: 0,
    };
    assertEquals(stats.bytesReceived, 2000);
  },
});

Deno.test({
  name: "TCPConnectionStats - has segmentsSent property",
  fn() {
    const stats: TCPConnectionStats = {
      state: TCPState.CLOSED,
      bytesSent: 0,
      bytesReceived: 0,
      segmentsSent: 10,
      segmentsReceived: 0,
      retransmissions: 0,
      rtt: 0,
      cwnd: 0,
      duration: 0,
    };
    assertEquals(stats.segmentsSent, 10);
  },
});

Deno.test({
  name: "TCPConnectionStats - has segmentsReceived property",
  fn() {
    const stats: TCPConnectionStats = {
      state: TCPState.CLOSED,
      bytesSent: 0,
      bytesReceived: 0,
      segmentsSent: 0,
      segmentsReceived: 15,
      retransmissions: 0,
      rtt: 0,
      cwnd: 0,
      duration: 0,
    };
    assertEquals(stats.segmentsReceived, 15);
  },
});

Deno.test({
  name: "TCPConnectionStats - has retransmissions property",
  fn() {
    const stats: TCPConnectionStats = {
      state: TCPState.CLOSED,
      bytesSent: 0,
      bytesReceived: 0,
      segmentsSent: 0,
      segmentsReceived: 0,
      retransmissions: 3,
      rtt: 0,
      cwnd: 0,
      duration: 0,
    };
    assertEquals(stats.retransmissions, 3);
  },
});

Deno.test({
  name: "TCPConnectionStats - has rtt property",
  fn() {
    const stats: TCPConnectionStats = {
      state: TCPState.CLOSED,
      bytesSent: 0,
      bytesReceived: 0,
      segmentsSent: 0,
      segmentsReceived: 0,
      retransmissions: 0,
      rtt: 50,
      cwnd: 0,
      duration: 0,
    };
    assertEquals(stats.rtt, 50);
  },
});

Deno.test({
  name: "TCPConnectionStats - has cwnd property",
  fn() {
    const stats: TCPConnectionStats = {
      state: TCPState.CLOSED,
      bytesSent: 0,
      bytesReceived: 0,
      segmentsSent: 0,
      segmentsReceived: 0,
      retransmissions: 0,
      rtt: 0,
      cwnd: 14600,
      duration: 0,
    };
    assertEquals(stats.cwnd, 14600);
  },
});

Deno.test({
  name: "TCPConnectionStats - has duration property",
  fn() {
    const stats: TCPConnectionStats = {
      state: TCPState.CLOSED,
      bytesSent: 0,
      bytesReceived: 0,
      segmentsSent: 0,
      segmentsReceived: 0,
      retransmissions: 0,
      rtt: 0,
      cwnd: 0,
      duration: 5000,
    };
    assertEquals(stats.duration, 5000);
  },
});

// ============================================================================
// TCPConnection Constructor Tests
// ============================================================================

Deno.test({
  name: "TCPConnection - constructor accepts socket",
  fn() {
    const mockSocket = new MockSocket() as unknown as Socket;
    const conn = new TCPConnection(mockSocket);

    assertExists(conn);
  },
});

Deno.test({
  name: "TCPConnection - constructor accepts config",
  fn() {
    const mockSocket = new MockSocket() as unknown as Socket;
    const config: TCPConnectionConfig = {
      timeout: 5000,
      noDelay: true,
    };
    const conn = new TCPConnection(mockSocket, config);

    assertExists(conn);
  },
});

Deno.test({
  name: "TCPConnection - constructor with empty config",
  fn() {
    const mockSocket = new MockSocket() as unknown as Socket;
    const conn = new TCPConnection(mockSocket, {});

    assertExists(conn);
  },
});

Deno.test({
  name: "TCPConnection - initial state is CLOSED",
  fn() {
    const mockSocket = new MockSocket() as unknown as Socket;
    const conn = new TCPConnection(mockSocket);

    assertEquals(conn.getState(), TCPState.CLOSED);
  },
});

Deno.test({
  name: "TCPConnection - isEstablished returns false initially",
  fn() {
    const mockSocket = new MockSocket() as unknown as Socket;
    const conn = new TCPConnection(mockSocket);

    assertEquals(conn.isEstablished(), false);
  },
});

// ============================================================================
// TCPConnection.fromSocket Tests
// ============================================================================

Deno.test({
  name: "TCPConnection - fromSocket creates connection",
  fn() {
    const mockSocket = new MockSocket() as unknown as Socket;
    const conn = TCPConnection.fromSocket(mockSocket);

    assertExists(conn);
  },
});

Deno.test({
  name: "TCPConnection - fromSocket with config",
  fn() {
    const mockSocket = new MockSocket() as unknown as Socket;
    const config: TCPConnectionConfig = {
      timeout: 10000,
      keepAlive: true,
    };
    const conn = TCPConnection.fromSocket(mockSocket, config);

    assertExists(conn);
  },
});

// ============================================================================
// TCPConnection.connect Tests
// ============================================================================

Deno.test({
  name: "TCPConnection - connect performs handshake",
  async fn() {
    const mockSocket = new MockSocket() as unknown as Socket;
    const conn = new TCPConnection(mockSocket);

    await conn.connect();

    assertEquals(conn.getState(), TCPState.ESTABLISHED);
  },
});

Deno.test({
  name: "TCPConnection - connect sets isEstablished to true",
  async fn() {
    const mockSocket = new MockSocket() as unknown as Socket;
    const conn = new TCPConnection(mockSocket);

    await conn.connect();

    assertEquals(conn.isEstablished(), true);
  },
});

Deno.test({
  name: "TCPConnection - connect rejects if already connected",
  async fn() {
    const mockSocket = new MockSocket() as unknown as Socket;
    const conn = new TCPConnection(mockSocket);

    await conn.connect();

    await assertRejects(
      async () => await conn.connect(),
      Error,
      "Already connected",
    );
  },
});

Deno.test({
  name: "TCPConnection - connect applies noDelay option",
  async fn() {
    const mockSocket = new MockSocket();
    const conn = new TCPConnection(mockSocket as unknown as Socket, {
      noDelay: true,
    });

    await conn.connect();

    assertEquals(mockSocket.optionsSet.tcpNoDelay, true);
  },
});

Deno.test({
  name: "TCPConnection - connect applies keepAlive option",
  async fn() {
    const mockSocket = new MockSocket();
    const conn = new TCPConnection(mockSocket as unknown as Socket, {
      keepAlive: true,
    });

    await conn.connect();

    assertEquals(mockSocket.optionsSet.tcpKeepAlive, true);
  },
});

Deno.test({
  name: "TCPConnection - connect initializes startTime for duration tracking",
  async fn() {
    const mockSocket = new MockSocket() as unknown as Socket;
    const conn = new TCPConnection(mockSocket);

    const before = Date.now();
    await conn.connect();
    const after = Date.now();

    const stats = conn.getStats();
    assert(stats.duration >= 0);
    assert(stats.duration <= after - before + 100); // Allow some tolerance
  },
});

// ============================================================================
// TCPConnection.accept Tests
// ============================================================================

Deno.test({
  name: "TCPConnection - accept transitions to passive open",
  async fn() {
    const mockSocket = new MockSocket() as unknown as Socket;
    const conn = new TCPConnection(mockSocket);

    await conn.accept();

    // After accept, connection should be "connected" for data transfer
    // The state machine will be in LISTEN initially
  },
});

Deno.test({
  name: "TCPConnection - accept rejects if already connected",
  async fn() {
    const mockSocket = new MockSocket() as unknown as Socket;
    const conn = new TCPConnection(mockSocket);

    await conn.accept();

    await assertRejects(
      async () => await conn.accept(),
      Error,
      "Already connected",
    );
  },
});

// ============================================================================
// TCPConnection.send Tests
// ============================================================================

Deno.test({
  name: "TCPConnection - send requires connection",
  async fn() {
    const mockSocket = new MockSocket() as unknown as Socket;
    const conn = new TCPConnection(mockSocket);

    const data = new TextEncoder().encode("Hello");

    await assertRejects(
      async () => await conn.send(data),
      Error,
      "Not connected",
    );
  },
});

Deno.test({
  name: "TCPConnection - send in ESTABLISHED state works",
  async fn() {
    const mockSocket = new MockSocket();
    const conn = new TCPConnection(mockSocket as unknown as Socket);

    await conn.connect();

    const data = new TextEncoder().encode("Hello, World!");
    await conn.send(data);

    // Verify data was written
    const written = mockSocket.getWrittenData();
    assert(written.length > 0);
  },
});

Deno.test({
  name: "TCPConnection - send updates bytesSent stat",
  async fn() {
    const mockSocket = new MockSocket();
    const conn = new TCPConnection(mockSocket as unknown as Socket);

    await conn.connect();
    mockSocket.clearWriteBuffer(); // Clear handshake writes

    const data = new TextEncoder().encode("Test data");
    await conn.send(data);

    const stats = conn.getStats();
    assertEquals(stats.bytesSent, data.length);
  },
});

Deno.test({
  name: "TCPConnection - send updates segmentsSent stat",
  async fn() {
    const mockSocket = new MockSocket();
    const conn = new TCPConnection(mockSocket as unknown as Socket);

    await conn.connect();
    const initialStats = conn.getStats();
    const initialSegments = initialStats.segmentsSent;

    const data = new TextEncoder().encode("Segment data");
    await conn.send(data);

    const stats = conn.getStats();
    assert(stats.segmentsSent > initialSegments);
  },
});

Deno.test({
  name: "TCPConnection - multiple sends queue correctly",
  async fn() {
    const mockSocket = new MockSocket();
    const conn = new TCPConnection(mockSocket as unknown as Socket);

    await conn.connect();
    mockSocket.clearWriteBuffer();

    const data1 = new TextEncoder().encode("First");
    const data2 = new TextEncoder().encode("Second");
    const data3 = new TextEncoder().encode("Third");

    await conn.send(data1);
    await conn.send(data2);
    await conn.send(data3);

    const stats = conn.getStats();
    assertEquals(stats.bytesSent, data1.length + data2.length + data3.length);
  },
});

// ============================================================================
// TCPConnection.receive Tests
// ============================================================================

Deno.test({
  name: "TCPConnection - receive requires connection",
  async fn() {
    const mockSocket = new MockSocket() as unknown as Socket;
    const conn = new TCPConnection(mockSocket);

    await assertRejects(
      async () => await conn.receive(),
      Error,
      "Not connected",
    );
  },
});

Deno.test({
  name: "TCPConnection - receive returns data from socket",
  async fn() {
    const mockSocket = new MockSocket();
    const conn = new TCPConnection(mockSocket as unknown as Socket);

    await conn.connect();

    // Push data to be read
    const testData = new TextEncoder().encode("Received data");
    mockSocket.pushReadData(testData);

    // Schedule close to resolve the second fill() call that StreamReader makes after reading data
    // This must happen before receive() returns, but after the first read completes
    setTimeout(() => mockSocket.close(), 0);

    const received = await conn.receive();

    assertEquals(received.length, testData.length);
  },
});

Deno.test({
  name: "TCPConnection - receive updates bytesReceived stat",
  async fn() {
    const mockSocket = new MockSocket();
    const conn = new TCPConnection(mockSocket as unknown as Socket);

    await conn.connect();

    const testData = new TextEncoder().encode("Test received");
    mockSocket.pushReadData(testData);

    // Schedule close to resolve the second fill() call
    setTimeout(() => mockSocket.close(), 0);

    await conn.receive();

    const stats = conn.getStats();
    assert(stats.bytesReceived > 0);
  },
});

Deno.test({
  name: "TCPConnection - receive updates segmentsReceived stat",
  async fn() {
    const mockSocket = new MockSocket();
    const conn = new TCPConnection(mockSocket as unknown as Socket);

    await conn.connect();

    const testData = new TextEncoder().encode("Segment");
    mockSocket.pushReadData(testData);

    // Schedule close to resolve the second fill() call
    setTimeout(() => mockSocket.close(), 0);

    await conn.receive();

    const stats = conn.getStats();
    assert(stats.segmentsReceived > 0);
  },
});

Deno.test({
  name: "TCPConnection - receive respects maxBytes parameter",
  async fn() {
    const mockSocket = new MockSocket();
    const conn = new TCPConnection(mockSocket as unknown as Socket);

    await conn.connect();

    const largeData = new Uint8Array(10000);
    mockSocket.pushReadData(largeData);

    // Schedule close to resolve the second fill() call
    setTimeout(() => mockSocket.close(), 0);

    const received = await conn.receive(1000);

    assert(received.length <= 1000);
  },
});

Deno.test({
  name: "TCPConnection - receive returns empty array on no data",
  async fn() {
    const mockSocket = new MockSocket();
    const conn = new TCPConnection(mockSocket as unknown as Socket);

    await conn.connect();

    // Close socket to return null from read
    mockSocket.close();

    const received = await conn.receive();

    assertEquals(received.length, 0);
  },
});

// ============================================================================
// TCPConnection.close Tests
// ============================================================================

Deno.test({
  name: "TCPConnection - close on unconnected does nothing",
  async fn() {
    const mockSocket = new MockSocket();
    const conn = new TCPConnection(mockSocket as unknown as Socket);

    await conn.close();

    // Should not throw
    assertEquals(mockSocket.closed, false);
  },
});

Deno.test({
  name: "TCPConnection - close after connect closes socket",
  async fn() {
    const mockSocket = new MockSocket();
    const conn = new TCPConnection(mockSocket as unknown as Socket);

    await conn.connect();
    await conn.close();

    assertEquals(mockSocket.closed, true);
  },
});

Deno.test({
  name: "TCPConnection - close sets connected to false",
  async fn() {
    const mockSocket = new MockSocket();
    const conn = new TCPConnection(mockSocket as unknown as Socket);

    await conn.connect();
    assertEquals(conn.isEstablished(), true);

    await conn.close();

    // State should reflect termination
    assert(!conn.isEstablished() || conn.getState() === TCPState.FIN_WAIT_1);
  },
});

Deno.test({
  name: "TCPConnection - close is idempotent",
  async fn() {
    const mockSocket = new MockSocket();
    const conn = new TCPConnection(mockSocket as unknown as Socket);

    await conn.connect();
    await conn.close();
    await conn.close(); // Should not throw
    await conn.close(); // Should not throw

    assertEquals(mockSocket.closed, true);
  },
});

// ============================================================================
// TCPConnection.abort Tests
// ============================================================================

Deno.test({
  name: "TCPConnection - abort closes socket immediately",
  fn() {
    const mockSocket = new MockSocket();
    const conn = new TCPConnection(mockSocket as unknown as Socket);

    conn.abort();

    assertEquals(mockSocket.closed, true);
  },
});

Deno.test({
  name: "TCPConnection - abort sends RST (state change)",
  async fn() {
    const mockSocket = new MockSocket();
    const conn = new TCPConnection(mockSocket as unknown as Socket);

    await conn.connect();
    conn.abort();

    // After abort, connection is no longer established
    assertEquals(conn.isEstablished(), false);
  },
});

Deno.test({
  name: "TCPConnection - abort sets connected to false",
  async fn() {
    const mockSocket = new MockSocket();
    const conn = new TCPConnection(mockSocket as unknown as Socket);

    await conn.connect();
    conn.abort();

    assertEquals(conn.isEstablished(), false);
  },
});

// ============================================================================
// TCPConnection.getState Tests
// ============================================================================

Deno.test({
  name: "TCPConnection - getState returns CLOSED initially",
  fn() {
    const mockSocket = new MockSocket() as unknown as Socket;
    const conn = new TCPConnection(mockSocket);

    assertEquals(conn.getState(), TCPState.CLOSED);
  },
});

Deno.test({
  name: "TCPConnection - getState returns ESTABLISHED after connect",
  async fn() {
    const mockSocket = new MockSocket() as unknown as Socket;
    const conn = new TCPConnection(mockSocket);

    await conn.connect();

    assertEquals(conn.getState(), TCPState.ESTABLISHED);
  },
});

Deno.test({
  name: "TCPConnection - getState reflects state machine state",
  fn() {
    const mockSocket = new MockSocket() as unknown as Socket;
    const conn = new TCPConnection(mockSocket);

    const state = conn.getState();

    // Should match internal state machine
    assertExists(state);
    assertEquals(typeof state, "string");
  },
});

// ============================================================================
// TCPConnection.isEstablished Tests
// ============================================================================

Deno.test({
  name: "TCPConnection - isEstablished returns false before connect",
  fn() {
    const mockSocket = new MockSocket() as unknown as Socket;
    const conn = new TCPConnection(mockSocket);

    assertEquals(conn.isEstablished(), false);
  },
});

Deno.test({
  name: "TCPConnection - isEstablished returns true after connect",
  async fn() {
    const mockSocket = new MockSocket() as unknown as Socket;
    const conn = new TCPConnection(mockSocket);

    await conn.connect();

    assertEquals(conn.isEstablished(), true);
  },
});

Deno.test({
  name: "TCPConnection - isEstablished returns false after close",
  async fn() {
    const mockSocket = new MockSocket() as unknown as Socket;
    const conn = new TCPConnection(mockSocket);

    await conn.connect();
    await conn.close();

    assertEquals(conn.isEstablished(), false);
  },
});

Deno.test({
  name: "TCPConnection - isEstablished returns false after abort",
  async fn() {
    const mockSocket = new MockSocket() as unknown as Socket;
    const conn = new TCPConnection(mockSocket);

    await conn.connect();
    conn.abort();

    assertEquals(conn.isEstablished(), false);
  },
});

// ============================================================================
// TCPConnection.getStats Tests
// ============================================================================

Deno.test({
  name: "TCPConnection - getStats returns TCPConnectionStats",
  fn() {
    const mockSocket = new MockSocket() as unknown as Socket;
    const conn = new TCPConnection(mockSocket);

    const stats = conn.getStats();

    assertExists(stats);
    assertExists(stats.state);
    assertExists(stats.bytesSent);
    assertExists(stats.bytesReceived);
    assertExists(stats.segmentsSent);
    assertExists(stats.segmentsReceived);
    assertExists(stats.retransmissions);
    assertExists(stats.rtt);
    assertExists(stats.cwnd);
    assertExists(stats.duration);
  },
});

Deno.test({
  name: "TCPConnection - getStats initial bytesSent is 0",
  fn() {
    const mockSocket = new MockSocket() as unknown as Socket;
    const conn = new TCPConnection(mockSocket);

    const stats = conn.getStats();

    assertEquals(stats.bytesSent, 0);
  },
});

Deno.test({
  name: "TCPConnection - getStats initial bytesReceived is 0",
  fn() {
    const mockSocket = new MockSocket() as unknown as Socket;
    const conn = new TCPConnection(mockSocket);

    const stats = conn.getStats();

    assertEquals(stats.bytesReceived, 0);
  },
});

Deno.test({
  name: "TCPConnection - getStats initial retransmissions is 0",
  fn() {
    const mockSocket = new MockSocket() as unknown as Socket;
    const conn = new TCPConnection(mockSocket);

    const stats = conn.getStats();

    assertEquals(stats.retransmissions, 0);
  },
});

Deno.test({
  name: "TCPConnection - getStats initial duration is 0",
  fn() {
    const mockSocket = new MockSocket() as unknown as Socket;
    const conn = new TCPConnection(mockSocket);

    const stats = conn.getStats();

    assertEquals(stats.duration, 0);
  },
});

Deno.test({
  name: "TCPConnection - getStats duration increases after connect",
  async fn() {
    const mockSocket = new MockSocket() as unknown as Socket;
    const conn = new TCPConnection(mockSocket);

    await conn.connect();
    await new Promise((resolve) => setTimeout(resolve, 50));

    const stats = conn.getStats();

    assert(stats.duration >= 50);
  },
});

Deno.test({
  name: "TCPConnection - getStats includes state machine stats",
  async fn() {
    const mockSocket = new MockSocket() as unknown as Socket;
    const conn = new TCPConnection(mockSocket);

    await conn.connect();

    const stats = conn.getStats();

    // Should include RTT from handshake
    assert(stats.rtt >= 0);
    // Should include congestion window
    assert(stats.cwnd > 0);
  },
});

// ============================================================================
// Integration Tests
// ============================================================================

Deno.test({
  name: "TCPConnection - full send/receive cycle",
  async fn() {
    const mockSocket = new MockSocket();
    const conn = new TCPConnection(mockSocket as unknown as Socket);

    // Connect
    await conn.connect();
    assertEquals(conn.isEstablished(), true);

    // Send data
    const sendData = new TextEncoder().encode("Request");
    await conn.send(sendData);

    // Receive data
    const responseData = new TextEncoder().encode("Response");
    mockSocket.pushReadData(responseData);

    // Schedule close to resolve the second fill() call
    setTimeout(() => mockSocket.close(), 0);

    const received = await conn.receive();

    assertEquals(received.length, responseData.length);

    // Check stats
    const stats = conn.getStats();
    assertEquals(stats.bytesSent, sendData.length);
    assert(stats.bytesReceived > 0);

    // MockSocket is closed but TCPConnection state machine isn't updated
    // (socket was closed directly, not through conn.close())
    assertEquals(mockSocket.closed, true);
  },
});

Deno.test({
  name: "TCPConnection - multiple connections are independent",
  async fn() {
    const mockSocket1 = new MockSocket();
    const mockSocket2 = new MockSocket();

    const conn1 = new TCPConnection(mockSocket1 as unknown as Socket);
    const conn2 = new TCPConnection(mockSocket2 as unknown as Socket);

    await conn1.connect();

    assertEquals(conn1.isEstablished(), true);
    assertEquals(conn2.isEstablished(), false);

    await conn2.connect();

    assertEquals(conn1.isEstablished(), true);
    assertEquals(conn2.isEstablished(), true);

    conn1.abort();

    assertEquals(conn1.isEstablished(), false);
    assertEquals(conn2.isEstablished(), true);
  },
});

Deno.test({
  name: "TCPConnection - handles large data transfer",
  async fn() {
    const mockSocket = new MockSocket();
    const conn = new TCPConnection(mockSocket as unknown as Socket);

    await conn.connect();
    mockSocket.clearWriteBuffer();

    // Send 1MB of data in chunks
    const chunkSize = 65536;
    const chunks = 16;
    const totalSize = chunkSize * chunks;

    for (let i = 0; i < chunks; i++) {
      const chunk = new Uint8Array(chunkSize);
      chunk.fill(i);
      await conn.send(chunk);
    }

    const stats = conn.getStats();
    assertEquals(stats.bytesSent, totalSize);
  },
});

Deno.test({
  name: "TCPConnection - stats accumulate correctly",
  async fn() {
    const mockSocket = new MockSocket();
    const conn = new TCPConnection(mockSocket as unknown as Socket);

    await conn.connect();
    mockSocket.clearWriteBuffer();

    // Multiple sends
    for (let i = 0; i < 10; i++) {
      const data = new Uint8Array(100);
      await conn.send(data);
    }

    const stats = conn.getStats();
    assertEquals(stats.bytesSent, 1000);
    assertEquals(stats.segmentsSent >= 10, true);
  },
});

Deno.test({
  name: "TCPConnection - connection lifecycle complete",
  async fn() {
    const mockSocket = new MockSocket();
    const conn = new TCPConnection(mockSocket as unknown as Socket, {
      timeout: 30000,
      noDelay: true,
      keepAlive: true,
    });

    // Initial state
    assertEquals(conn.getState(), TCPState.CLOSED);
    assertEquals(conn.isEstablished(), false);

    // Connect
    await conn.connect();
    assertEquals(conn.getState(), TCPState.ESTABLISHED);
    assertEquals(conn.isEstablished(), true);

    // Data transfer
    const sendData = new TextEncoder().encode("Hello");
    await conn.send(sendData);

    const recvData = new TextEncoder().encode("World");
    mockSocket.pushReadData(recvData);

    // Schedule close to resolve the second fill() call
    setTimeout(() => mockSocket.close(), 0);

    await conn.receive();

    // Verify options applied
    assertEquals(mockSocket.optionsSet.tcpNoDelay, true);
    assertEquals(mockSocket.optionsSet.tcpKeepAlive, true);

    // Get final stats
    const stats = conn.getStats();
    assert(stats.bytesSent > 0);
    assert(stats.bytesReceived > 0);
    assert(stats.duration > 0);

    // Socket is already closed by setTimeout
    assertEquals(mockSocket.closed, true);
  },
});

// ============================================================================
// Error Handling Tests
// ============================================================================

Deno.test({
  name: "TCPConnection - send throws on wrong state",
  async fn() {
    const mockSocket = new MockSocket() as unknown as Socket;
    const conn = new TCPConnection(mockSocket);

    // Not connected yet
    await assertRejects(
      async () => await conn.send(new Uint8Array(10)),
      Error,
      "Not connected",
    );
  },
});

Deno.test({
  name: "TCPConnection - receive throws on wrong state",
  async fn() {
    const mockSocket = new MockSocket() as unknown as Socket;
    const conn = new TCPConnection(mockSocket);

    // Not connected yet
    await assertRejects(
      async () => await conn.receive(),
      Error,
      "Not connected",
    );
  },
});

Deno.test({
  name: "TCPConnection - double connect throws",
  async fn() {
    const mockSocket = new MockSocket() as unknown as Socket;
    const conn = new TCPConnection(mockSocket);

    await conn.connect();

    await assertRejects(
      async () => await conn.connect(),
      Error,
      "Already connected",
    );
  },
});

// ============================================================================
// Config Application Tests
// ============================================================================

Deno.test({
  name: "TCPConnection - config noDelay false",
  async fn() {
    const mockSocket = new MockSocket();
    const conn = new TCPConnection(mockSocket as unknown as Socket, {
      noDelay: false,
    });

    await conn.connect();

    assertEquals(mockSocket.optionsSet.tcpNoDelay, false);
  },
});

Deno.test({
  name: "TCPConnection - config keepAlive false",
  async fn() {
    const mockSocket = new MockSocket();
    const conn = new TCPConnection(mockSocket as unknown as Socket, {
      keepAlive: false,
    });

    await conn.connect();

    assertEquals(mockSocket.optionsSet.tcpKeepAlive, false);
  },
});

Deno.test({
  name: "TCPConnection - config without socket options skips setOptions",
  async fn() {
    const mockSocket = new MockSocket();
    const conn = new TCPConnection(mockSocket as unknown as Socket, {
      timeout: 5000, // Only timeout, no socket options
    });

    await conn.connect();

    // No socket options should be set
    assertEquals(mockSocket.optionsSet.tcpNoDelay, undefined);
    assertEquals(mockSocket.optionsSet.tcpKeepAlive, undefined);
  },
});
