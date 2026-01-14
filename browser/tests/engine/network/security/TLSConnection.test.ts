/**
 * TLSConnection Tests
 *
 * Comprehensive tests for TLS connection functionality.
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import {
    TLSConnection,
    CipherSuite,
    TLSRecordType,
    TLSAlertLevel,
    TLSAlertDescription,
    TLSError,
} from "../../../../src/engine/network/security/TLSConnection.ts";
import { TLSVersion } from "../../../../src/types/network.ts";

// ============================================================================
// Enum Tests
// ============================================================================

Deno.test({
    name: "CipherSuite - has TLS_AES_128_GCM_SHA256",
    fn() {
        assertEquals(CipherSuite.TLS_AES_128_GCM_SHA256, 0x1301);
    },
});

Deno.test({
    name: "CipherSuite - has TLS_AES_256_GCM_SHA384",
    fn() {
        assertEquals(CipherSuite.TLS_AES_256_GCM_SHA384, 0x1302);
    },
});

Deno.test({
    name: "CipherSuite - has TLS_CHACHA20_POLY1305_SHA256",
    fn() {
        assertEquals(CipherSuite.TLS_CHACHA20_POLY1305_SHA256, 0x1303);
    },
});

Deno.test({
    name: "CipherSuite - has TLS_AES_128_CCM_SHA256",
    fn() {
        assertEquals(CipherSuite.TLS_AES_128_CCM_SHA256, 0x1304);
    },
});

Deno.test({
    name: "TLSRecordType - has CHANGE_CIPHER_SPEC",
    fn() {
        assertEquals(TLSRecordType.CHANGE_CIPHER_SPEC, 20);
    },
});

Deno.test({
    name: "TLSRecordType - has ALERT",
    fn() {
        assertEquals(TLSRecordType.ALERT, 21);
    },
});

Deno.test({
    name: "TLSRecordType - has HANDSHAKE",
    fn() {
        assertEquals(TLSRecordType.HANDSHAKE, 22);
    },
});

Deno.test({
    name: "TLSRecordType - has APPLICATION_DATA",
    fn() {
        assertEquals(TLSRecordType.APPLICATION_DATA, 23);
    },
});

Deno.test({
    name: "TLSAlertLevel - has WARNING",
    fn() {
        assertEquals(TLSAlertLevel.WARNING, 1);
    },
});

Deno.test({
    name: "TLSAlertLevel - has FATAL",
    fn() {
        assertEquals(TLSAlertLevel.FATAL, 2);
    },
});

Deno.test({
    name: "TLSAlertDescription - has CLOSE_NOTIFY",
    fn() {
        assertEquals(TLSAlertDescription.CLOSE_NOTIFY, 0);
    },
});

Deno.test({
    name: "TLSAlertDescription - has UNEXPECTED_MESSAGE",
    fn() {
        assertEquals(TLSAlertDescription.UNEXPECTED_MESSAGE, 10);
    },
});

Deno.test({
    name: "TLSAlertDescription - has BAD_RECORD_MAC",
    fn() {
        assertEquals(TLSAlertDescription.BAD_RECORD_MAC, 20);
    },
});

Deno.test({
    name: "TLSAlertDescription - has HANDSHAKE_FAILURE",
    fn() {
        assertEquals(TLSAlertDescription.HANDSHAKE_FAILURE, 40);
    },
});

Deno.test({
    name: "TLSAlertDescription - has BAD_CERTIFICATE",
    fn() {
        assertEquals(TLSAlertDescription.BAD_CERTIFICATE, 42);
    },
});

Deno.test({
    name: "TLSAlertDescription - has CERTIFICATE_EXPIRED",
    fn() {
        assertEquals(TLSAlertDescription.CERTIFICATE_EXPIRED, 45);
    },
});

Deno.test({
    name: "TLSAlertDescription - has UNKNOWN_CA",
    fn() {
        assertEquals(TLSAlertDescription.UNKNOWN_CA, 48);
    },
});

Deno.test({
    name: "TLSAlertDescription - has INTERNAL_ERROR",
    fn() {
        assertEquals(TLSAlertDescription.INTERNAL_ERROR, 80);
    },
});

// ============================================================================
// TLSError Tests
// ============================================================================

Deno.test({
    name: "TLSError - constructor creates error",
    fn() {
        const error = new TLSError("Test error");

        assertExists(error);
        assertEquals(error.message, "Test error");
    },
});

Deno.test({
    name: "TLSError - has correct name",
    fn() {
        const error = new TLSError("Test error");

        assertEquals(error.name, "TLSError");
    },
});

Deno.test({
    name: "TLSError - is instance of Error",
    fn() {
        const error = new TLSError("Test error");

        assert(error instanceof Error);
    },
});

Deno.test({
    name: "TLSError - can be thrown",
    fn() {
        let caughtError: Error | null = null;

        try {
            throw new TLSError("Test error");
        } catch (error) {
            caughtError = error as Error;
        }

        assertExists(caughtError);
        assert(caughtError instanceof TLSError);
    },
});

// ============================================================================
// TLSConnection Constructor Tests
// ============================================================================

Deno.test({
    name: "TLSConnection - constructor with mock socket",
    fn() {
        const mockSocket: any = {
            write: async () => {},
            read: async () => {},
            close: async () => {},
            state: "OPEN",
        };

        const connection = new TLSConnection(mockSocket);

        assertExists(connection);
    },
});

Deno.test({
    name: "TLSConnection - constructor with default config",
    fn() {
        const mockSocket: any = {
            write: async () => {},
            read: async () => {},
            close: async () => {},
            state: "OPEN",
        };

        const connection = new TLSConnection(mockSocket);

        assertExists(connection);

        // Verify default config through getInfo
        const info = connection.getInfo();
        assertEquals(info.version, TLSVersion.TLS_1_3);
    },
});

Deno.test({
    name: "TLSConnection - constructor with custom config",
    fn() {
        const mockSocket: any = {
            write: async () => {},
            read: async () => {},
            close: async () => {},
            state: "OPEN",
        };

        const customConfig = {
            minVersion: TLSVersion.TLS_1_3,
            maxVersion: TLSVersion.TLS_1_3,
            cipherSuites: [CipherSuite.TLS_AES_256_GCM_SHA384],
            verifyPeerCertificate: false,
            trustedCAs: [],
            allowSelfSigned: true,
            serverName: "example.com",
            alpnProtocols: ["h2"],
            enableSessionResumption: true,
            sessionTicketLifetime: 3600000,
        };

        const connection = new TLSConnection(mockSocket, customConfig);

        assertExists(connection);
    },
});

Deno.test({
    name: "TLSConnection - constructor with all cipher suites",
    fn() {
        const mockSocket: any = {
            write: async () => {},
            read: async () => {},
            close: async () => {},
            state: "OPEN",
        };

        const customConfig = {
            minVersion: TLSVersion.TLS_1_3,
            maxVersion: TLSVersion.TLS_1_3,
            cipherSuites: [
                CipherSuite.TLS_AES_128_GCM_SHA256,
                CipherSuite.TLS_AES_256_GCM_SHA384,
                CipherSuite.TLS_CHACHA20_POLY1305_SHA256,
                CipherSuite.TLS_AES_128_CCM_SHA256,
            ],
            verifyPeerCertificate: true,
            trustedCAs: [],
            allowSelfSigned: false,
            alpnProtocols: ["http/1.1", "h2", "h3"],
            enableSessionResumption: false,
            sessionTicketLifetime: 7200000,
        };

        const connection = new TLSConnection(mockSocket, customConfig);

        assertExists(connection);
    },
});

// ============================================================================
// getSocket Tests
// ============================================================================

Deno.test({
    name: "TLSConnection - getSocket returns socket",
    fn() {
        const mockSocket: any = {
            write: async () => {},
            read: async () => {},
            close: async () => {},
            state: "OPEN",
        };

        const connection = new TLSConnection(mockSocket);

        assertEquals(connection.getSocket(), mockSocket);
    },
});

Deno.test({
    name: "TLSConnection - getSocket returns same instance",
    fn() {
        const mockSocket: any = {
            write: async () => {},
            read: async () => {},
            close: async () => {},
            state: "OPEN",
        };

        const connection = new TLSConnection(mockSocket);

        const socket1 = connection.getSocket();
        const socket2 = connection.getSocket();

        assertEquals(socket1, socket2);
    },
});

// ============================================================================
// getInfo Tests
// ============================================================================

Deno.test({
    name: "TLSConnection - getInfo returns connection info",
    fn() {
        const mockSocket: any = {
            write: async () => {},
            read: async () => {},
            close: async () => {},
            state: "OPEN",
        };

        const connection = new TLSConnection(mockSocket);
        const info = connection.getInfo();

        assertExists(info);
        assertEquals(info.version, TLSVersion.TLS_1_3);
        assertEquals(info.cipherSuite, "TLS_AES_128_GCM_SHA256");
        assertEquals(info.certificateVerified, true);
        assertEquals(info.sessionResumed, false);
    },
});

Deno.test({
    name: "TLSConnection - getInfo includes server name",
    fn() {
        const mockSocket: any = {
            write: async () => {},
            read: async () => {},
            close: async () => {},
            state: "OPEN",
        };

        const customConfig = {
            minVersion: TLSVersion.TLS_1_3,
            maxVersion: TLSVersion.TLS_1_3,
            cipherSuites: [CipherSuite.TLS_AES_128_GCM_SHA256],
            verifyPeerCertificate: true,
            trustedCAs: [],
            allowSelfSigned: false,
            serverName: "example.com",
            alpnProtocols: ["http/1.1"],
            enableSessionResumption: false,
            sessionTicketLifetime: 7200000,
        };

        const connection = new TLSConnection(mockSocket, customConfig);
        const info = connection.getInfo();

        assertEquals(info.serverName, "example.com");
    },
});

Deno.test({
    name: "TLSConnection - getInfo includes ALPN protocol",
    fn() {
        const mockSocket: any = {
            write: async () => {},
            read: async () => {},
            close: async () => {},
            state: "OPEN",
        };

        const connection = new TLSConnection(mockSocket);
        const info = connection.getInfo();

        // alpnProtocol starts as null before handshake
        assertEquals(info.alpnProtocol, null);
    },
});

Deno.test({
    name: "TLSConnection - getInfo includes peer certificate",
    fn() {
        const mockSocket: any = {
            write: async () => {},
            read: async () => {},
            close: async () => {},
            state: "OPEN",
        };

        const connection = new TLSConnection(mockSocket);
        const info = connection.getInfo();

        // peerCertificate is null before handshake
        assertEquals(info.peerCertificate, null);
    },
});

Deno.test({
    name: "TLSConnection - getInfo has all required fields",
    fn() {
        const mockSocket: any = {
            write: async () => {},
            read: async () => {},
            close: async () => {},
            state: "OPEN",
        };

        const connection = new TLSConnection(mockSocket);
        const info = connection.getInfo();

        assertExists(info.version);
        assertExists(info.cipherSuite);
        assertEquals(typeof info.certificateVerified, "boolean");
        assertEquals(typeof info.sessionResumed, "boolean");
    },
});

// ============================================================================
// Connection Error Handling Tests
// ============================================================================

Deno.test({
    name: "TLSConnection - read throws error when not established",
    async fn() {
        const mockSocket: any = {
            write: async () => {},
            read: async () => {},
            close: async () => {},
            state: "OPEN",
        };

        const connection = new TLSConnection(mockSocket);
        const buffer = new Uint8Array(1024);

        let errorThrown = false;
        try {
            await connection.read(buffer);
        } catch (error) {
            errorThrown = true;
            assert(error instanceof Error);
            assertEquals(error.message, "TLS connection not established");
        }

        assertEquals(errorThrown, true);
    },
});

Deno.test({
    name: "TLSConnection - write throws error when not established",
    async fn() {
        const mockSocket: any = {
            write: async () => {},
            read: async () => {},
            close: async () => {},
            state: "OPEN",
        };

        const connection = new TLSConnection(mockSocket);
        const data = new Uint8Array([1, 2, 3, 4]);

        let errorThrown = false;
        try {
            await connection.write(data);
        } catch (error) {
            errorThrown = true;
            assert(error instanceof Error);
            assertEquals(error.message, "TLS connection not established");
        }

        assertEquals(errorThrown, true);
    },
});

// ============================================================================
// Integration Tests
// ============================================================================

Deno.test({
    name: "TLSConnection - complete lifecycle with mock socket",
    fn() {
        const mockSocket: any = {
            write: async () => {},
            read: async () => {},
            close: async () => {},
            state: "OPEN",
        };

        const connection = new TLSConnection(mockSocket);

        // Get info
        const info = connection.getInfo();
        assertExists(info);

        // Get socket
        const socket = connection.getSocket();
        assertEquals(socket, mockSocket);

        assert(true);
    },
});

Deno.test({
    name: "TLSConnection - custom config with different cipher suites",
    fn() {
        const mockSocket: any = {
            write: async () => {},
            read: async () => {},
            close: async () => {},
            state: "OPEN",
        };

        const cipherSuites = [
            [CipherSuite.TLS_AES_128_GCM_SHA256],
            [CipherSuite.TLS_AES_256_GCM_SHA384],
            [CipherSuite.TLS_CHACHA20_POLY1305_SHA256],
            [CipherSuite.TLS_AES_128_CCM_SHA256],
        ];

        for (const suites of cipherSuites) {
            const config = {
                minVersion: TLSVersion.TLS_1_3,
                maxVersion: TLSVersion.TLS_1_3,
                cipherSuites: suites,
                verifyPeerCertificate: true,
                trustedCAs: [],
                allowSelfSigned: false,
                alpnProtocols: ["http/1.1"],
                enableSessionResumption: false,
                sessionTicketLifetime: 7200000,
            };

            const connection = new TLSConnection(mockSocket, config);
            assertExists(connection);
        }
    },
});

Deno.test({
    name: "TLSConnection - different ALPN protocol configurations",
    fn() {
        const mockSocket: any = {
            write: async () => {},
            read: async () => {},
            close: async () => {},
            state: "OPEN",
        };

        const alpnConfigs = [
            ["http/1.1"],
            ["h2"],
            ["h3"],
            ["http/1.1", "h2"],
            ["http/1.1", "h2", "h3"],
        ];

        for (const alpnProtocols of alpnConfigs) {
            const config = {
                minVersion: TLSVersion.TLS_1_3,
                maxVersion: TLSVersion.TLS_1_3,
                cipherSuites: [CipherSuite.TLS_AES_128_GCM_SHA256],
                verifyPeerCertificate: true,
                trustedCAs: [],
                allowSelfSigned: false,
                alpnProtocols,
                enableSessionResumption: false,
                sessionTicketLifetime: 7200000,
            };

            const connection = new TLSConnection(mockSocket, config);
            assertExists(connection);
        }
    },
});

Deno.test({
    name: "TLSConnection - certificate verification configurations",
    fn() {
        const mockSocket: any = {
            write: async () => {},
            read: async () => {},
            close: async () => {},
            state: "OPEN",
        };

        // Test different certificate verification settings
        const configs = [
            { verifyPeerCertificate: true, allowSelfSigned: false },
            { verifyPeerCertificate: true, allowSelfSigned: true },
            { verifyPeerCertificate: false, allowSelfSigned: false },
            { verifyPeerCertificate: false, allowSelfSigned: true },
        ];

        for (const certConfig of configs) {
            const config = {
                minVersion: TLSVersion.TLS_1_3,
                maxVersion: TLSVersion.TLS_1_3,
                cipherSuites: [CipherSuite.TLS_AES_128_GCM_SHA256],
                verifyPeerCertificate: certConfig.verifyPeerCertificate,
                trustedCAs: [],
                allowSelfSigned: certConfig.allowSelfSigned,
                alpnProtocols: ["http/1.1"],
                enableSessionResumption: false,
                sessionTicketLifetime: 7200000,
            };

            const connection = new TLSConnection(mockSocket, config);
            assertExists(connection);
        }
    },
});
