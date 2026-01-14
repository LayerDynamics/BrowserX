/**
 * Socket Tests
 *
 * Comprehensive tests for socket implementation.
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import {
    SocketImpl,
    SocketError,
    AddressFamily,
    SocketType,
    type SocketOptions,
} from "../../../../src/engine/network/primitives/Socket.ts";
import { SocketState } from "../../../../src/types/network.ts";

// ============================================================================
// AddressFamily Enum Tests
// ============================================================================

Deno.test({
    name: "AddressFamily - has IPv4",
    fn() {
        assertEquals(AddressFamily.IPv4, "IPv4");
    },
});

Deno.test({
    name: "AddressFamily - has IPv6",
    fn() {
        assertEquals(AddressFamily.IPv6, "IPv6");
    },
});

// ============================================================================
// SocketType Enum Tests
// ============================================================================

Deno.test({
    name: "SocketType - has STREAM for TCP",
    fn() {
        assertEquals(SocketType.STREAM, "STREAM");
    },
});

Deno.test({
    name: "SocketType - has DGRAM for UDP",
    fn() {
        assertEquals(SocketType.DGRAM, "DGRAM");
    },
});

// ============================================================================
// SocketImpl Constructor Tests
// ============================================================================

Deno.test({
    name: "SocketImpl - constructor creates socket with IPv4 STREAM",
    fn() {
        const socket = new SocketImpl(AddressFamily.IPv4, SocketType.STREAM);

        assertExists(socket);
    },
});

Deno.test({
    name: "SocketImpl - constructor creates socket with IPv6 STREAM",
    fn() {
        const socket = new SocketImpl(AddressFamily.IPv6, SocketType.STREAM);

        assertExists(socket);
    },
});

Deno.test({
    name: "SocketImpl - constructor creates socket with IPv4 DGRAM",
    fn() {
        const socket = new SocketImpl(AddressFamily.IPv4, SocketType.DGRAM);

        assertExists(socket);
    },
});

Deno.test({
    name: "SocketImpl - constructor initializes fd",
    fn() {
        const socket = new SocketImpl(AddressFamily.IPv4, SocketType.STREAM);

        assertExists(socket.fd);
        assertEquals(typeof socket.fd, "number");
        assert(socket.fd > 0);
    },
});

Deno.test({
    name: "SocketImpl - constructor initializes state to CLOSED",
    fn() {
        const socket = new SocketImpl(AddressFamily.IPv4, SocketType.STREAM);

        assertEquals(socket.state, SocketState.CLOSED);
    },
});

Deno.test({
    name: "SocketImpl - constructor initializes empty addresses",
    fn() {
        const socket = new SocketImpl(AddressFamily.IPv4, SocketType.STREAM);

        assertEquals(socket.localAddress, "");
        assertEquals(socket.localPort, 0);
        assertEquals(socket.remoteAddress, "");
        assertEquals(socket.remotePort, 0);
    },
});

Deno.test({
    name: "SocketImpl - constructor initializes statistics",
    fn() {
        const socket = new SocketImpl(AddressFamily.IPv4, SocketType.STREAM);

        const stats = socket.getStats();
        assertExists(stats);
        assertEquals(typeof stats.bytesRead, "number");
        assertEquals(typeof stats.bytesWritten, "number");
    },
});

// ============================================================================
// SocketImpl Getter Tests
// ============================================================================

Deno.test({
    name: "SocketImpl - fd getter returns file descriptor",
    fn() {
        const socket = new SocketImpl(AddressFamily.IPv4, SocketType.STREAM);

        const fd = socket.fd;

        assertEquals(typeof fd, "number");
        assert(fd > 0);
    },
});

Deno.test({
    name: "SocketImpl - state getter returns initial CLOSED state",
    fn() {
        const socket = new SocketImpl(AddressFamily.IPv4, SocketType.STREAM);

        assertEquals(socket.state, SocketState.CLOSED);
    },
});

Deno.test({
    name: "SocketImpl - localAddress getter returns empty initially",
    fn() {
        const socket = new SocketImpl(AddressFamily.IPv4, SocketType.STREAM);

        assertEquals(socket.localAddress, "");
    },
});

Deno.test({
    name: "SocketImpl - localPort getter returns 0 initially",
    fn() {
        const socket = new SocketImpl(AddressFamily.IPv4, SocketType.STREAM);

        assertEquals(socket.localPort, 0);
    },
});

Deno.test({
    name: "SocketImpl - remoteAddress getter returns empty initially",
    fn() {
        const socket = new SocketImpl(AddressFamily.IPv4, SocketType.STREAM);

        assertEquals(socket.remoteAddress, "");
    },
});

Deno.test({
    name: "SocketImpl - remotePort getter returns 0 initially",
    fn() {
        const socket = new SocketImpl(AddressFamily.IPv4, SocketType.STREAM);

        assertEquals(socket.remotePort, 0);
    },
});

// ============================================================================
// SocketImpl connect() Tests
// ============================================================================

Deno.test({
    name: "SocketImpl - connect throws from non-CLOSED state",
    async fn() {
        const socket = new SocketImpl(AddressFamily.IPv4, SocketType.STREAM);

        // Try to connect once (will fail but change state)
        try {
            await socket.connect("localhost", 80);
        } catch {
            // Expected to fail
        }

        // Try to connect again from non-CLOSED state
        let errorThrown = false;
        try {
            await socket.connect("localhost", 80);
        } catch (error) {
            errorThrown = true;
            assert(error instanceof Error);
            assert(error.message.includes("Cannot connect from state"));
        }

        assert(errorThrown);
    },
});

Deno.test({
    name: "SocketImpl - connect handles connection failure",
    async fn() {
        const socket = new SocketImpl(AddressFamily.IPv4, SocketType.STREAM);

        let errorThrown = false;
        try {
            // Try to connect to invalid host/port
            await socket.connect("invalid-host-12345.local", 99999);
        } catch (error) {
            errorThrown = true;
            assert(error instanceof SocketError);
            assert(error.message.includes("Connection failed"));
            assert(error.cause !== undefined);
        }

        assert(errorThrown);
        // State should be ERROR after failed connection
        assertEquals(socket.state, SocketState.ERROR);
    },
});

Deno.test({
    name: "SocketImpl - connect updates state to OPENING then OPEN or ERROR",
    async fn() {
        const socket = new SocketImpl(AddressFamily.IPv4, SocketType.STREAM);

        assertEquals(socket.state, SocketState.CLOSED);

        try {
            await socket.connect("localhost", 80);
        } catch {
            // Expected to fail, but state should have changed
        }

        // State should no longer be CLOSED
        assert(socket.state !== SocketState.CLOSED);
    },
});

// ============================================================================
// SocketImpl read() Tests
// ============================================================================

Deno.test({
    name: "SocketImpl - read throws when not OPEN",
    async fn() {
        const socket = new SocketImpl(AddressFamily.IPv4, SocketType.STREAM);
        const buffer = new Uint8Array(1024);

        let errorThrown = false;
        try {
            await socket.read(buffer);
        } catch (error) {
            errorThrown = true;
            assert(error instanceof Error);
            assert(error.message.includes("Cannot read from socket in state"));
        }

        assert(errorThrown);
    },
});

// ============================================================================
// SocketImpl write() Tests
// ============================================================================

Deno.test({
    name: "SocketImpl - write throws when not OPEN",
    async fn() {
        const socket = new SocketImpl(AddressFamily.IPv4, SocketType.STREAM);
        const data = new Uint8Array([1, 2, 3]);

        let errorThrown = false;
        try {
            await socket.write(data);
        } catch (error) {
            errorThrown = true;
            assert(error instanceof Error);
            assert(error.message.includes("Cannot write to socket in state"));
        }

        assert(errorThrown);
    },
});

// ============================================================================
// SocketImpl close() Tests
// ============================================================================

Deno.test({
    name: "SocketImpl - close from CLOSED state is no-op",
    async fn() {
        const socket = new SocketImpl(AddressFamily.IPv4, SocketType.STREAM);

        assertEquals(socket.state, SocketState.CLOSED);

        await socket.close();

        assertEquals(socket.state, SocketState.CLOSED);
    },
});

Deno.test({
    name: "SocketImpl - close can be called multiple times",
    async fn() {
        const socket = new SocketImpl(AddressFamily.IPv4, SocketType.STREAM);

        await socket.close();
        await socket.close();
        await socket.close();

        assertEquals(socket.state, SocketState.CLOSED);
    },
});

Deno.test({
    name: "SocketImpl - close updates state to CLOSING then CLOSED",
    async fn() {
        const socket = new SocketImpl(AddressFamily.IPv4, SocketType.STREAM);

        // Try to connect first (will fail but change state)
        try {
            await socket.connect("localhost", 80);
        } catch {
            // Expected
        }

        await socket.close();

        assertEquals(socket.state, SocketState.CLOSED);
    },
});

// ============================================================================
// SocketImpl setOptions() Tests
// ============================================================================

Deno.test({
    name: "SocketImpl - setOptions accepts TCP_NODELAY",
    fn() {
        const socket = new SocketImpl(AddressFamily.IPv4, SocketType.STREAM);

        const options: SocketOptions = {
            TCP_NODELAY: true,
        };

        socket.setOptions(options);

        // Should not throw
        assert(true);
    },
});

Deno.test({
    name: "SocketImpl - setOptions accepts TCP_KEEPALIVE",
    fn() {
        const socket = new SocketImpl(AddressFamily.IPv4, SocketType.STREAM);

        const options: SocketOptions = {
            TCP_KEEPALIVE: true,
            TCP_KEEPIDLE: 60,
            TCP_KEEPINTVL: 10,
            TCP_KEEPCNT: 3,
        };

        socket.setOptions(options);

        assert(true);
    },
});

Deno.test({
    name: "SocketImpl - setOptions accepts SO_REUSEADDR",
    fn() {
        const socket = new SocketImpl(AddressFamily.IPv4, SocketType.STREAM);

        const options: SocketOptions = {
            SO_REUSEADDR: true,
            SO_REUSEPORT: true,
        };

        socket.setOptions(options);

        assert(true);
    },
});

Deno.test({
    name: "SocketImpl - setOptions accepts buffer sizes",
    fn() {
        const socket = new SocketImpl(AddressFamily.IPv4, SocketType.STREAM);

        const options: SocketOptions = {
            SO_RCVBUF: 65536,
            SO_SNDBUF: 65536,
        };

        socket.setOptions(options);

        assert(true);
    },
});

Deno.test({
    name: "SocketImpl - setOptions accepts timeouts",
    fn() {
        const socket = new SocketImpl(AddressFamily.IPv4, SocketType.STREAM);

        const options: SocketOptions = {
            SO_RCVTIMEO: 5000,
            SO_SNDTIMEO: 5000,
        };

        socket.setOptions(options);

        assert(true);
    },
});

Deno.test({
    name: "SocketImpl - setOptions accepts SO_LINGER",
    fn() {
        const socket = new SocketImpl(AddressFamily.IPv4, SocketType.STREAM);

        const options: SocketOptions = {
            SO_LINGER: { enabled: true, timeout: 10 },
        };

        socket.setOptions(options);

        assert(true);
    },
});

Deno.test({
    name: "SocketImpl - setOptions accepts multiple options",
    fn() {
        const socket = new SocketImpl(AddressFamily.IPv4, SocketType.STREAM);

        const options: SocketOptions = {
            TCP_NODELAY: true,
            TCP_KEEPALIVE: true,
            SO_REUSEADDR: true,
            SO_RCVBUF: 65536,
            SO_SNDBUF: 65536,
        };

        socket.setOptions(options);

        assert(true);
    },
});

// ============================================================================
// SocketImpl getStats() Tests
// ============================================================================

Deno.test({
    name: "SocketImpl - getStats returns statistics object",
    fn() {
        const socket = new SocketImpl(AddressFamily.IPv4, SocketType.STREAM);

        const stats = socket.getStats();

        assertExists(stats);
        assertEquals(typeof stats.bytesRead, "number");
        assertEquals(typeof stats.bytesWritten, "number");
        assertEquals(typeof stats.readOperations, "number");
        assertEquals(typeof stats.writeOperations, "number");
        assertEquals(typeof stats.errors, "number");
    },
});

Deno.test({
    name: "SocketImpl - getStats returns copy of statistics",
    fn() {
        const socket = new SocketImpl(AddressFamily.IPv4, SocketType.STREAM);

        const stats1 = socket.getStats();
        const stats2 = socket.getStats();

        // Should be different objects
        assert(stats1 !== stats2);

        // But with same values
        assertEquals(stats1.bytesRead, stats2.bytesRead);
        assertEquals(stats1.bytesWritten, stats2.bytesWritten);
    },
});

Deno.test({
    name: "SocketImpl - getStats initializes with zero values",
    fn() {
        const socket = new SocketImpl(AddressFamily.IPv4, SocketType.STREAM);

        const stats = socket.getStats();

        assertEquals(stats.bytesRead, 0);
        assertEquals(stats.bytesWritten, 0);
        assertEquals(stats.readOperations, 0);
        assertEquals(stats.writeOperations, 0);
        assertEquals(stats.errors, 0);
    },
});

// ============================================================================
// SocketError Tests
// ============================================================================

Deno.test({
    name: "SocketError - creates error with message",
    fn() {
        const error = new SocketError("Test error");

        assertExists(error);
        assertEquals(error.message, "Test error");
        assertEquals(error.name, "SocketError");
    },
});

Deno.test({
    name: "SocketError - creates error with cause",
    fn() {
        const cause = new Error("Original error");
        const error = new SocketError("Test error", cause);

        assertEquals(error.message, "Test error");
        assertEquals(error.cause, cause);
    },
});

Deno.test({
    name: "SocketError - is instance of Error",
    fn() {
        const error = new SocketError("Test error");

        assert(error instanceof Error);
        assert(error instanceof SocketError);
    },
});

Deno.test({
    name: "SocketError - preserves stack trace",
    fn() {
        const error = new SocketError("Test error");

        assertExists(error.stack);
        assert(error.stack!.includes("SocketError"));
    },
});

// ============================================================================
// Integration Tests
// ============================================================================

Deno.test({
    name: "SocketImpl - complete socket lifecycle",
    async fn() {
        const socket = new SocketImpl(AddressFamily.IPv4, SocketType.STREAM);

        // Initial state
        assertEquals(socket.state, SocketState.CLOSED);
        assertEquals(socket.localAddress, "");
        assertEquals(socket.remoteAddress, "");

        // Try to connect
        try {
            await socket.connect("localhost", 80);
        } catch (error) {
            // Expected to fail without actual server
            assert(error instanceof SocketError);
        }

        // State should have changed
        assert(socket.state !== SocketState.CLOSED);

        // Get statistics
        const stats = socket.getStats();
        assertExists(stats);

        // Close socket
        await socket.close();
    },
});

Deno.test({
    name: "SocketImpl - different socket types",
    fn() {
        const tcpSocket = new SocketImpl(AddressFamily.IPv4, SocketType.STREAM);
        const udpSocket = new SocketImpl(AddressFamily.IPv4, SocketType.DGRAM);

        assertExists(tcpSocket);
        assertExists(udpSocket);

        // Both should have different file descriptors
        assert(tcpSocket.fd !== udpSocket.fd);
    },
});

Deno.test({
    name: "SocketImpl - different address families",
    fn() {
        const ipv4Socket = new SocketImpl(AddressFamily.IPv4, SocketType.STREAM);
        const ipv6Socket = new SocketImpl(AddressFamily.IPv6, SocketType.STREAM);

        assertExists(ipv4Socket);
        assertExists(ipv6Socket);

        // Both should have different file descriptors
        assert(ipv4Socket.fd !== ipv6Socket.fd);
    },
});

Deno.test({
    name: "SocketImpl - error handling updates statistics",
    async fn() {
        const socket = new SocketImpl(AddressFamily.IPv4, SocketType.STREAM);

        const initialStats = socket.getStats();
        const initialErrors = initialStats.errors;

        // Try to connect to invalid host
        try {
            await socket.connect("invalid-host-99999.local", 12345);
        } catch {
            // Expected
        }

        const finalStats = socket.getStats();

        // Error count should have increased
        assertEquals(finalStats.errors, initialErrors + 1);
    },
});

Deno.test({
    name: "SocketImpl - operations fail in ERROR state",
    async fn() {
        const socket = new SocketImpl(AddressFamily.IPv4, SocketType.STREAM);

        // Force socket into ERROR state
        try {
            await socket.connect("invalid-host.local", 99999);
        } catch {
            // Expected
        }

        assertEquals(socket.state, SocketState.ERROR);

        // Try to read
        let readError = false;
        try {
            await socket.read(new Uint8Array(1024));
        } catch {
            readError = true;
        }
        assert(readError);

        // Try to write
        let writeError = false;
        try {
            await socket.write(new Uint8Array([1, 2, 3]));
        } catch {
            writeError = true;
        }
        assert(writeError);
    },
});
