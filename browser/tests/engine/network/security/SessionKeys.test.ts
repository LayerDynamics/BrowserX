/**
 * SessionKeys Tests
 *
 * Comprehensive tests for TLS session key derivation.
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import {
    deriveSessionKeys,
    computeMasterSecret,
    deriveTrafficSecrets,
    type SessionKeys,
} from "../../../../src/engine/network/security/SessionKeys.ts";

// ============================================================================
// deriveSessionKeys Tests
// ============================================================================

Deno.test({
    name: "deriveSessionKeys - derives keys from master secret",
    async fn() {
        const masterSecret = new Uint8Array(48);
        const clientRandom = new Uint8Array(32);
        const serverRandom = new Uint8Array(32);
        const cipherSuite = "TLS_AES_128_GCM_SHA256";

        const keys = await deriveSessionKeys(masterSecret, clientRandom, serverRandom, cipherSuite);

        assertExists(keys);
        assertExists(keys.clientWriteKey);
        assertExists(keys.serverWriteKey);
        assertExists(keys.clientWriteIV);
        assertExists(keys.serverWriteIV);
    },
});

Deno.test({
    name: "deriveSessionKeys - AES-128 produces correct key lengths",
    async fn() {
        const masterSecret = new Uint8Array(48);
        const clientRandom = new Uint8Array(32);
        const serverRandom = new Uint8Array(32);
        const cipherSuite = "TLS_AES_128_GCM_SHA256";

        const keys = await deriveSessionKeys(masterSecret, clientRandom, serverRandom, cipherSuite);

        assertEquals(keys.clientWriteKey.byteLength, 16); // AES-128 = 16 bytes
        assertEquals(keys.serverWriteKey.byteLength, 16);
        assertEquals(keys.clientWriteIV.byteLength, 12); // GCM IV = 12 bytes
        assertEquals(keys.serverWriteIV.byteLength, 12);
    },
});

Deno.test({
    name: "deriveSessionKeys - AES-256 produces correct key lengths",
    async fn() {
        const masterSecret = new Uint8Array(48);
        const clientRandom = new Uint8Array(32);
        const serverRandom = new Uint8Array(32);
        const cipherSuite = "TLS_AES_256_GCM_SHA384";

        const keys = await deriveSessionKeys(masterSecret, clientRandom, serverRandom, cipherSuite);

        assertEquals(keys.clientWriteKey.byteLength, 32); // AES-256 = 32 bytes
        assertEquals(keys.serverWriteKey.byteLength, 32);
    },
});

Deno.test({
    name: "deriveSessionKeys - ChaCha20 produces correct key lengths",
    async fn() {
        const masterSecret = new Uint8Array(48);
        const clientRandom = new Uint8Array(32);
        const serverRandom = new Uint8Array(32);
        const cipherSuite = "TLS_CHACHA20_POLY1305_SHA256";

        const keys = await deriveSessionKeys(masterSecret, clientRandom, serverRandom, cipherSuite);

        assertEquals(keys.clientWriteKey.byteLength, 32); // ChaCha20 = 32 bytes
        assertEquals(keys.serverWriteKey.byteLength, 32);
        assertEquals(keys.clientWriteIV.byteLength, 12);
        assertEquals(keys.serverWriteIV.byteLength, 12);
    },
});

Deno.test({
    name: "deriveSessionKeys - AEAD ciphers do not include MAC keys",
    async fn() {
        const masterSecret = new Uint8Array(48);
        const clientRandom = new Uint8Array(32);
        const serverRandom = new Uint8Array(32);
        const cipherSuite = "TLS_AES_128_GCM_SHA256";

        const keys = await deriveSessionKeys(masterSecret, clientRandom, serverRandom, cipherSuite);

        assertEquals(keys.clientWriteMAC, undefined);
        assertEquals(keys.serverWriteMAC, undefined);
    },
});

Deno.test({
    name: "deriveSessionKeys - produces different keys for different inputs",
    async fn() {
        const masterSecret1 = new Uint8Array(48).fill(1);
        const masterSecret2 = new Uint8Array(48).fill(2);
        const clientRandom = new Uint8Array(32);
        const serverRandom = new Uint8Array(32);
        const cipherSuite = "TLS_AES_128_GCM_SHA256";

        const keys1 = await deriveSessionKeys(masterSecret1, clientRandom, serverRandom, cipherSuite);
        const keys2 = await deriveSessionKeys(masterSecret2, clientRandom, serverRandom, cipherSuite);

        // Keys should be different for different master secrets
        assert(
            keys1.clientWriteKey.some((byte, i) => byte !== keys2.clientWriteKey[i])
        );
    },
});

// ============================================================================
// computeMasterSecret Tests
// ============================================================================

Deno.test({
    name: "computeMasterSecret - computes master secret for TLS 1.2",
    async fn() {
        const preMasterSecret = new Uint8Array(48);
        const clientRandom = new Uint8Array(32);
        const serverRandom = new Uint8Array(32);
        const tlsVersion = "1.2";

        const masterSecret = await computeMasterSecret(preMasterSecret, clientRandom, serverRandom, tlsVersion);

        assertExists(masterSecret);
        assertEquals(masterSecret.byteLength, 48);
    },
});

Deno.test({
    name: "computeMasterSecret - produces 48-byte master secret",
    async fn() {
        const preMasterSecret = new Uint8Array(48);
        const clientRandom = new Uint8Array(32);
        const serverRandom = new Uint8Array(32);
        const tlsVersion = "1.2";

        const masterSecret = await computeMasterSecret(preMasterSecret, clientRandom, serverRandom, tlsVersion);

        assertEquals(masterSecret.byteLength, 48);
    },
});

Deno.test({
    name: "computeMasterSecret - throws error for TLS 1.3",
    async fn() {
        const preMasterSecret = new Uint8Array(48);
        const clientRandom = new Uint8Array(32);
        const serverRandom = new Uint8Array(32);
        const tlsVersion = "1.3";

        let errorThrown = false;
        try {
            await computeMasterSecret(preMasterSecret, clientRandom, serverRandom, tlsVersion);
        } catch (error) {
            errorThrown = true;
            assert(error instanceof Error);
            assertEquals(error.message, "Use deriveTrafficSecrets for TLS 1.3");
        }

        assertEquals(errorThrown, true);
    },
});

Deno.test({
    name: "computeMasterSecret - produces different secrets for different inputs",
    async fn() {
        const preMasterSecret1 = new Uint8Array(48).fill(1);
        const preMasterSecret2 = new Uint8Array(48).fill(2);
        const clientRandom = new Uint8Array(32);
        const serverRandom = new Uint8Array(32);
        const tlsVersion = "1.2";

        const masterSecret1 = await computeMasterSecret(preMasterSecret1, clientRandom, serverRandom, tlsVersion);
        const masterSecret2 = await computeMasterSecret(preMasterSecret2, clientRandom, serverRandom, tlsVersion);

        // Master secrets should be different
        assert(
            masterSecret1.some((byte, i) => byte !== masterSecret2[i])
        );
    },
});

// ============================================================================
// deriveTrafficSecrets Tests (TLS 1.3)
// ============================================================================

Deno.test({
    name: "deriveTrafficSecrets - derives TLS 1.3 traffic secrets",
    async fn() {
        const sharedSecret = new Uint8Array(32);
        const handshakeContext = new Uint8Array(32);

        const secrets = await deriveTrafficSecrets(sharedSecret, handshakeContext);

        assertExists(secrets);
        assertExists(secrets.clientHandshakeTrafficSecret);
        assertExists(secrets.serverHandshakeTrafficSecret);
        assertExists(secrets.clientApplicationTrafficSecret);
        assertExists(secrets.serverApplicationTrafficSecret);
    },
});

Deno.test({
    name: "deriveTrafficSecrets - produces 32-byte secrets",
    async fn() {
        const sharedSecret = new Uint8Array(32);
        const handshakeContext = new Uint8Array(32);

        const secrets = await deriveTrafficSecrets(sharedSecret, handshakeContext);

        assertEquals(secrets.clientHandshakeTrafficSecret.byteLength, 32);
        assertEquals(secrets.serverHandshakeTrafficSecret.byteLength, 32);
        assertEquals(secrets.clientApplicationTrafficSecret.byteLength, 32);
        assertEquals(secrets.serverApplicationTrafficSecret.byteLength, 32);
    },
});

Deno.test({
    name: "deriveTrafficSecrets - client and server secrets are different",
    async fn() {
        const sharedSecret = new Uint8Array(32);
        const handshakeContext = new Uint8Array(32);

        const secrets = await deriveTrafficSecrets(sharedSecret, handshakeContext);

        // Client and server handshake secrets should be different
        assert(
            secrets.clientHandshakeTrafficSecret.some((byte, i) => 
                byte !== secrets.serverHandshakeTrafficSecret[i]
            )
        );

        // Client and server application secrets should be different
        assert(
            secrets.clientApplicationTrafficSecret.some((byte, i) => 
                byte !== secrets.serverApplicationTrafficSecret[i]
            )
        );
    },
});

Deno.test({
    name: "deriveTrafficSecrets - handshake and application secrets are different",
    async fn() {
        const sharedSecret = new Uint8Array(32);
        const handshakeContext = new Uint8Array(32);

        const secrets = await deriveTrafficSecrets(sharedSecret, handshakeContext);

        // Handshake and application secrets should be different
        assert(
            secrets.clientHandshakeTrafficSecret.some((byte, i) => 
                byte !== secrets.clientApplicationTrafficSecret[i]
            )
        );
    },
});

Deno.test({
    name: "deriveTrafficSecrets - produces different secrets for different inputs",
    async fn() {
        const sharedSecret1 = new Uint8Array(32).fill(1);
        const sharedSecret2 = new Uint8Array(32).fill(2);
        const handshakeContext = new Uint8Array(32);

        const secrets1 = await deriveTrafficSecrets(sharedSecret1, handshakeContext);
        const secrets2 = await deriveTrafficSecrets(sharedSecret2, handshakeContext);

        // Secrets should be different for different shared secrets
        assert(
            secrets1.clientHandshakeTrafficSecret.some((byte, i) => 
                byte !== secrets2.clientHandshakeTrafficSecret[i]
            )
        );
    },
});

// ============================================================================
// Integration Tests
// ============================================================================

Deno.test({
    name: "SessionKeys - complete TLS 1.2 key derivation flow",
    async fn() {
        const preMasterSecret = new Uint8Array(48);
        crypto.getRandomValues(preMasterSecret);

        const clientRandom = new Uint8Array(32);
        crypto.getRandomValues(clientRandom);

        const serverRandom = new Uint8Array(32);
        crypto.getRandomValues(serverRandom);

        // Derive master secret
        const masterSecret = await computeMasterSecret(
            preMasterSecret,
            clientRandom,
            serverRandom,
            "1.2"
        );

        assertEquals(masterSecret.byteLength, 48);

        // Derive session keys
        const sessionKeys = await deriveSessionKeys(
            masterSecret,
            clientRandom,
            serverRandom,
            "TLS_AES_128_GCM_SHA256"
        );

        assertExists(sessionKeys.clientWriteKey);
        assertExists(sessionKeys.serverWriteKey);
        assertExists(sessionKeys.clientWriteIV);
        assertExists(sessionKeys.serverWriteIV);
    },
});

Deno.test({
    name: "SessionKeys - complete TLS 1.3 key derivation flow",
    async fn() {
        const sharedSecret = new Uint8Array(32);
        crypto.getRandomValues(sharedSecret);

        const handshakeContext = new Uint8Array(32);
        crypto.getRandomValues(handshakeContext);

        // Derive traffic secrets
        const secrets = await deriveTrafficSecrets(sharedSecret, handshakeContext);

        assertExists(secrets.clientHandshakeTrafficSecret);
        assertExists(secrets.serverHandshakeTrafficSecret);
        assertExists(secrets.clientApplicationTrafficSecret);
        assertExists(secrets.serverApplicationTrafficSecret);

        // All secrets should be 32 bytes
        assertEquals(secrets.clientHandshakeTrafficSecret.byteLength, 32);
        assertEquals(secrets.serverHandshakeTrafficSecret.byteLength, 32);
        assertEquals(secrets.clientApplicationTrafficSecret.byteLength, 32);
        assertEquals(secrets.serverApplicationTrafficSecret.byteLength, 32);
    },
});

Deno.test({
    name: "SessionKeys - different cipher suites produce appropriate key lengths",
    async fn() {
        const masterSecret = new Uint8Array(48);
        const clientRandom = new Uint8Array(32);
        const serverRandom = new Uint8Array(32);

        const cipherSuites = [
            { name: "TLS_AES_128_GCM_SHA256", keyLen: 16 },
            { name: "TLS_AES_256_GCM_SHA384", keyLen: 32 },
            { name: "TLS_CHACHA20_POLY1305_SHA256", keyLen: 32 },
        ];

        for (const suite of cipherSuites) {
            const keys = await deriveSessionKeys(
                masterSecret,
                clientRandom,
                serverRandom,
                suite.name
            );

            assertEquals(keys.clientWriteKey.byteLength, suite.keyLen);
            assertEquals(keys.serverWriteKey.byteLength, suite.keyLen);
        }
    },
});
