/**
 * NetworkStack Tests
 *
 * Comprehensive tests for OS-level networking operations.
 */

import { assertEquals, assertExists, assertRejects } from "@std/assert";
import { NetworkStack, OSSocket } from "../../../src/os/networking/NetworkStack.ts";

Deno.test({
    name: "NetworkStack - createSocket with TCP IPv4",
    fn() {
        const stack = new NetworkStack();

        const socket = stack.createSocket("IPv4", "tcp");

        assertExists(socket);
        assertEquals(socket.family, "IPv4");
        assertEquals(socket.type, "tcp");
        assertEquals(socket.conn, null);
    },
});

Deno.test({
    name: "NetworkStack - createSocket with TCP IPv6",
    fn() {
        const stack = new NetworkStack();

        const socket = stack.createSocket("IPv6", "tcp");

        assertExists(socket);
        assertEquals(socket.family, "IPv6");
        assertEquals(socket.type, "tcp");
    },
});

Deno.test({
    name: "NetworkStack - createSocket with UDP",
    fn() {
        const stack = new NetworkStack();

        const socket = stack.createSocket("IPv4", "udp");

        assertExists(socket);
        assertEquals(socket.family, "IPv4");
        assertEquals(socket.type, "udp");
    },
});

Deno.test({
    name: "NetworkStack - createSocket creates independent sockets",
    fn() {
        const stack = new NetworkStack();

        const socket1 = stack.createSocket("IPv4", "tcp");
        const socket2 = stack.createSocket("IPv4", "tcp");

        // Should be different socket objects
        assertEquals(socket1 !== socket2, true);
    },
});

Deno.test({
    name: "NetworkStack - connect TCP socket to echo server",
    async fn() {
        const stack = new NetworkStack();
        const socket = stack.createSocket("IPv4", "tcp");

        // Use public echo server for testing
        await stack.connect(socket, "tcpbin.com", 4242);

        assertExists(socket.conn);
        assertEquals(socket.conn !== null, true);

        // Cleanup
        stack.close(socket);
    },
    sanitizeResources: false,
    sanitizeOps: false,
});

Deno.test({
    name: "NetworkStack - connect to localhost",
    async fn() {
        // Start a test server
        const listener = Deno.listen({ port: 0 }); // Random port
        const addr = listener.addr as Deno.NetAddr;
        const port = addr.port;

        // Accept connection in background
        const acceptPromise = listener.accept();

        // Connect to it
        const stack = new NetworkStack();
        const socket = stack.createSocket("IPv4", "tcp");

        await stack.connect(socket, "127.0.0.1", port);

        assertExists(socket.conn);

        // Cleanup
        stack.close(socket);
        const conn = await acceptPromise;
        conn.close();
        listener.close();
    },
});

Deno.test({
    name: "NetworkStack - connect throws error for invalid host",
    async fn() {
        const stack = new NetworkStack();
        const socket = stack.createSocket("IPv4", "tcp");

        await assertRejects(
            async () => {
                await stack.connect(socket, "invalid-host-that-does-not-exist-12345", 80);
            },
        );
    },
});

Deno.test({
    name: "NetworkStack - connect throws error for unreachable port",
    async fn() {
        const stack = new NetworkStack();
        const socket = stack.createSocket("IPv4", "tcp");

        await assertRejects(
            async () => {
                // Try to connect to port that's likely not listening
                await stack.connect(socket, "127.0.0.1", 1);
            },
        );
    },
});

Deno.test({
    name: "NetworkStack - connect UDP socket stores connection info",
    async fn() {
        const stack = new NetworkStack();
        const socket = stack.createSocket("IPv4", "udp");

        await stack.connect(socket, "8.8.8.8", 53);

        assertEquals(socket.remoteHost, "8.8.8.8");
        assertEquals(socket.remotePort, 53);
    },
});

Deno.test({
    name: "NetworkStack - connect throws error for unsupported socket type",
    async fn() {
        const stack = new NetworkStack();
        const socket = stack.createSocket("IPv4", "invalid_type");

        await assertRejects(
            async () => {
                await stack.connect(socket, "127.0.0.1", 80);
            },
            Error,
            "Unsupported socket type",
        );
    },
});

Deno.test({
    name: "NetworkStack - write and read data",
    async fn() {
        // Start test server
        const listener = Deno.listen({ port: 0 });
        const addr = listener.addr as Deno.NetAddr;
        const port = addr.port;

        // Handle connection - echo server
        const serverPromise = (async () => {
            const conn = await listener.accept();
            const buffer = new Uint8Array(1024);
            const n = await conn.read(buffer);
            if (n) {
                await conn.write(buffer.subarray(0, n));
            }
            conn.close();
        })();

        // Connect client
        const stack = new NetworkStack();
        const socket = stack.createSocket("IPv4", "tcp");
        await stack.connect(socket, "127.0.0.1", port);

        // Write data
        const testData = new TextEncoder().encode("Hello, Server!");
        const written = await stack.write(socket, testData);
        assertEquals(written, testData.length);

        // Read response
        const buffer = new Uint8Array(1024);
        const read = await stack.read(socket, buffer);
        assertExists(read);
        assertEquals(read, testData.length);

        if (read !== null) {
            const response = new TextDecoder().decode(buffer.subarray(0, read));
            assertEquals(response, "Hello, Server!");
        }

        // Cleanup
        stack.close(socket);
        await serverPromise;
        listener.close();
    },
});

Deno.test({
    name: "NetworkStack - read throws error for unconnected socket",
    async fn() {
        const stack = new NetworkStack();
        const socket = stack.createSocket("IPv4", "tcp");

        const buffer = new Uint8Array(1024);

        await assertRejects(
            async () => {
                await stack.read(socket, buffer);
            },
            Error,
            "Socket not connected",
        );
    },
});

Deno.test({
    name: "NetworkStack - write throws error for unconnected socket",
    async fn() {
        const stack = new NetworkStack();
        const socket = stack.createSocket("IPv4", "tcp");

        const data = new Uint8Array([1, 2, 3, 4]);

        await assertRejects(
            async () => {
                await stack.write(socket, data);
            },
            Error,
            "Socket not connected",
        );
    },
});

Deno.test({
    name: "NetworkStack - read returns null at EOF",
    async fn() {
        // Start test server that closes immediately
        const listener = Deno.listen({ port: 0 });
        const addr = listener.addr as Deno.NetAddr;
        const port = addr.port;

        const serverPromise = (async () => {
            const conn = await listener.accept();
            conn.close(); // Close immediately
        })();

        // Connect and try to read
        const stack = new NetworkStack();
        const socket = stack.createSocket("IPv4", "tcp");
        await stack.connect(socket, "127.0.0.1", port);

        await serverPromise;

        // Give server time to close
        await new Promise((resolve) => setTimeout(resolve, 100));

        const buffer = new Uint8Array(1024);
        const result = await stack.read(socket, buffer);

        // Should return null for EOF
        assertEquals(result, null);

        stack.close(socket);
        listener.close();
    },
});

Deno.test({
    name: "NetworkStack - write sends all data",
    async fn() {
        const listener = Deno.listen({ port: 0 });
        const addr = listener.addr as Deno.NetAddr;
        const port = addr.port;

        let receivedData: Uint8Array | null = null;

        const serverPromise = (async () => {
            const conn = await listener.accept();
            const buffer = new Uint8Array(1024);
            const n = await conn.read(buffer);
            if (n) {
                receivedData = buffer.subarray(0, n);
            }
            conn.close();
        })();

        const stack = new NetworkStack();
        const socket = stack.createSocket("IPv4", "tcp");
        await stack.connect(socket, "127.0.0.1", port);

        const testData = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        const written = await stack.write(socket, testData);

        assertEquals(written, testData.length);

        stack.close(socket);
        await serverPromise;

        assertExists(receivedData);
        const data = receivedData as Uint8Array;
        assertEquals(data.length, testData.length);
        for (let i = 0; i < testData.length; i++) {
            assertEquals(data[i], testData[i]);
        }

        listener.close();
    },
});

Deno.test({
    name: "NetworkStack - write empty data",
    async fn() {
        const listener = Deno.listen({ port: 0 });
        const addr = listener.addr as Deno.NetAddr;
        const port = addr.port;

        const serverPromise = (async () => {
            const conn = await listener.accept();
            // Just accept and close
            await new Promise((resolve) => setTimeout(resolve, 50));
            conn.close();
        })();

        const stack = new NetworkStack();
        const socket = stack.createSocket("IPv4", "tcp");
        await stack.connect(socket, "127.0.0.1", port);

        const written = await stack.write(socket, new Uint8Array(0));
        assertEquals(written, 0);

        stack.close(socket);
        await serverPromise;
        listener.close();
    },
});

Deno.test({
    name: "NetworkStack - read with small buffer",
    async fn() {
        const listener = Deno.listen({ port: 0 });
        const addr = listener.addr as Deno.NetAddr;
        const port = addr.port;

        const testData = new TextEncoder().encode("Hello, this is a longer message!");

        const serverPromise = (async () => {
            const conn = await listener.accept();
            await conn.write(testData);
            conn.close();
        })();

        const stack = new NetworkStack();
        const socket = stack.createSocket("IPv4", "tcp");
        await stack.connect(socket, "127.0.0.1", port);

        // Read with small buffer
        const buffer = new Uint8Array(10); // Only 10 bytes
        const read = await stack.read(socket, buffer);

        assertExists(read);
        assertEquals(read, 10); // Should only read buffer size

        stack.close(socket);
        await serverPromise;
        listener.close();
    },
});

Deno.test({
    name: "NetworkStack - close socket",
    async fn() {
        const listener = Deno.listen({ port: 0 });
        const addr = listener.addr as Deno.NetAddr;
        const port = addr.port;

        const serverPromise = (async () => {
            const conn = await listener.accept();
            await new Promise((resolve) => setTimeout(resolve, 50));
            conn.close();
        })();

        const stack = new NetworkStack();
        const socket = stack.createSocket("IPv4", "tcp");
        await stack.connect(socket, "127.0.0.1", port);

        assertExists(socket.conn);

        stack.close(socket);

        await serverPromise;
        listener.close();
    },
});

Deno.test({
    name: "NetworkStack - close unconnected socket doesn't throw",
    fn() {
        const stack = new NetworkStack();
        const socket = stack.createSocket("IPv4", "tcp");

        // Should not throw
        stack.close(socket);
    },
});

Deno.test({
    name: "NetworkStack - close socket twice doesn't throw",
    async fn() {
        const listener = Deno.listen({ port: 0 });
        const addr = listener.addr as Deno.NetAddr;
        const port = addr.port;

        const serverPromise = (async () => {
            const conn = await listener.accept();
            conn.close();
        })();

        const stack = new NetworkStack();
        const socket = stack.createSocket("IPv4", "tcp");
        await stack.connect(socket, "127.0.0.1", port);

        stack.close(socket);
        stack.close(socket); // Close again - should not throw

        await serverPromise;
        listener.close();
    },
});

Deno.test({
    name: "NetworkStack - getLocalAddress returns local address info",
    async fn() {
        const listener = Deno.listen({ port: 0 });
        const addr = listener.addr as Deno.NetAddr;
        const port = addr.port;

        const serverPromise = (async () => {
            const conn = await listener.accept();
            await new Promise((resolve) => setTimeout(resolve, 50));
            conn.close();
        })();

        const stack = new NetworkStack();
        const socket = stack.createSocket("IPv4", "tcp");
        await stack.connect(socket, "127.0.0.1", port);

        const localAddr = stack.getLocalAddress(socket);

        assertExists(localAddr);
        assertEquals(localAddr.transport, "tcp");

        stack.close(socket);
        await serverPromise;
        listener.close();
    },
});

Deno.test({
    name: "NetworkStack - getLocalAddress throws error for unconnected socket",
    fn() {
        const stack = new NetworkStack();
        const socket = stack.createSocket("IPv4", "tcp");

        try {
            stack.getLocalAddress(socket);
            throw new Error("Should have thrown");
        } catch (error) {
            assertEquals((error as Error).message, "Socket not connected");
        }
    },
});

Deno.test({
    name: "NetworkStack - getRemoteAddress returns remote address info",
    async fn() {
        const listener = Deno.listen({ port: 0 });
        const addr = listener.addr as Deno.NetAddr;
        const port = addr.port;

        const serverPromise = (async () => {
            const conn = await listener.accept();
            await new Promise((resolve) => setTimeout(resolve, 50));
            conn.close();
        })();

        const stack = new NetworkStack();
        const socket = stack.createSocket("IPv4", "tcp");
        await stack.connect(socket, "127.0.0.1", port);

        const remoteAddr = stack.getRemoteAddress(socket);

        assertExists(remoteAddr);
        assertEquals(remoteAddr.transport, "tcp");

        stack.close(socket);
        await serverPromise;
        listener.close();
    },
});

Deno.test({
    name: "NetworkStack - getRemoteAddress throws error for unconnected socket",
    fn() {
        const stack = new NetworkStack();
        const socket = stack.createSocket("IPv4", "tcp");

        try {
            stack.getRemoteAddress(socket);
            throw new Error("Should have thrown");
        } catch (error) {
            assertEquals((error as Error).message, "Socket not connected");
        }
    },
});

Deno.test({
    name: "NetworkStack - multiple sockets can connect independently",
    async fn() {
        const listener1 = Deno.listen({ port: 0 });
        const listener2 = Deno.listen({ port: 0 });
        const addr1 = listener1.addr as Deno.NetAddr;
        const addr2 = listener2.addr as Deno.NetAddr;

        const server1Promise = (async () => {
            const conn = await listener1.accept();
            await new Promise((resolve) => setTimeout(resolve, 50));
            conn.close();
        })();

        const server2Promise = (async () => {
            const conn = await listener2.accept();
            await new Promise((resolve) => setTimeout(resolve, 50));
            conn.close();
        })();

        const stack = new NetworkStack();
        const socket1 = stack.createSocket("IPv4", "tcp");
        const socket2 = stack.createSocket("IPv4", "tcp");

        await stack.connect(socket1, "127.0.0.1", addr1.port);
        await stack.connect(socket2, "127.0.0.1", addr2.port);

        assertExists(socket1.conn);
        assertExists(socket2.conn);
        assertEquals(socket1.conn !== socket2.conn, true);

        stack.close(socket1);
        stack.close(socket2);

        await server1Promise;
        await server2Promise;
        listener1.close();
        listener2.close();
    },
});

Deno.test({
    name: "NetworkStack - write large data",
    async fn() {
        const listener = Deno.listen({ port: 0 });
        const addr = listener.addr as Deno.NetAddr;
        const port = addr.port;

        let receivedSize = 0;

        const serverPromise = (async () => {
            const conn = await listener.accept();
            const buffer = new Uint8Array(100000);
            let total = 0;
            while (true) {
                const n = await conn.read(buffer);
                if (n === null) break;
                total += n;
            }
            receivedSize = total;
            conn.close();
        })();

        const stack = new NetworkStack();
        const socket = stack.createSocket("IPv4", "tcp");
        await stack.connect(socket, "127.0.0.1", port);

        // Write 64KB of data
        const largeData = new Uint8Array(65536);
        for (let i = 0; i < largeData.length; i++) {
            largeData[i] = i % 256;
        }

        const written = await stack.write(socket, largeData);
        assertEquals(written, largeData.length);

        stack.close(socket);
        await serverPromise;

        assertEquals(receivedSize, 65536);

        listener.close();
    },
});

Deno.test({
    name: "NetworkStack - connect with port 80",
    async fn() {
        const stack = new NetworkStack();
        const socket = stack.createSocket("IPv4", "tcp");

        // Connect to a public HTTP server
        await stack.connect(socket, "example.com", 80);

        assertExists(socket.conn);

        stack.close(socket);
    },
    sanitizeResources: false,
    sanitizeOps: false,
});

Deno.test({
    name: "NetworkStack - connect with high port number",
    async fn() {
        const listener = Deno.listen({ port: 0 });
        const addr = listener.addr as Deno.NetAddr;

        const serverPromise = (async () => {
            const conn = await listener.accept();
            conn.close();
        })();

        const stack = new NetworkStack();
        const socket = stack.createSocket("IPv4", "tcp");

        await stack.connect(socket, "127.0.0.1", addr.port);

        assertExists(socket.conn);

        stack.close(socket);
        await serverPromise;
        listener.close();
    },
});

Deno.test({
    name: "NetworkStack - multiple NetworkStack instances are independent",
    async fn() {
        const listener1 = Deno.listen({ port: 0 });
        const listener2 = Deno.listen({ port: 0 });
        const addr1 = listener1.addr as Deno.NetAddr;
        const addr2 = listener2.addr as Deno.NetAddr;

        const server1Promise = (async () => {
            const conn = await listener1.accept();
            conn.close();
        })();

        const server2Promise = (async () => {
            const conn = await listener2.accept();
            conn.close();
        })();

        const stack1 = new NetworkStack();
        const stack2 = new NetworkStack();

        const socket1 = stack1.createSocket("IPv4", "tcp");
        const socket2 = stack2.createSocket("IPv4", "tcp");

        await stack1.connect(socket1, "127.0.0.1", addr1.port);
        await stack2.connect(socket2, "127.0.0.1", addr2.port);

        assertExists(socket1.conn);
        assertExists(socket2.conn);

        stack1.close(socket1);
        stack2.close(socket2);

        await server1Promise;
        await server2Promise;
        listener1.close();
        listener2.close();
    },
});
