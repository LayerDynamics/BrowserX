/**
 * TLS Session Key Derivation
 *
 * Handles cryptographic key derivation for TLS sessions including
 * master secret computation and key material generation.
 */

import type { ByteBuffer } from "../../../types/identifiers.ts";

/**
 * TLS session keys derived from master secret
 */
export interface SessionKeys {
    clientWriteKey: ByteBuffer;
    serverWriteKey: ByteBuffer;
    clientWriteIV: ByteBuffer;
    serverWriteIV: ByteBuffer;
    clientWriteMAC?: ByteBuffer; // TLS 1.2 and below
    serverWriteMAC?: ByteBuffer; // TLS 1.2 and below
}

/**
 * Derive session keys from master secret using PRF
 *
 * @param masterSecret - The master secret
 * @param clientRandom - Client random bytes from ClientHello
 * @param serverRandom - Server random bytes from ServerHello
 * @param cipherSuite - The negotiated cipher suite
 * @returns Session keys for encryption/decryption
 *
 * Uses TLS 1.2 PRF with HMAC-SHA256
 */
export async function deriveSessionKeys(
    masterSecret: ByteBuffer,
    clientRandom: ByteBuffer,
    serverRandom: ByteBuffer,
    cipherSuite: string,
): Promise<SessionKeys> {
    // Parse cipher suite to determine key/IV lengths
    const keyLength = getCipherKeyLength(cipherSuite);
    const ivLength = getCipherIVLength(cipherSuite);
    const macLength = getCipherMACLength(cipherSuite);

    // Compute total key material needed
    const totalLength = (keyLength * 2) + (ivLength * 2) + (macLength * 2);

    // PRF(master_secret, "key expansion", server_random + client_random)
    const label = new TextEncoder().encode("key expansion");
    const seed = concat(serverRandom, clientRandom);
    const keyMaterial = await prf(masterSecret, label, seed, totalLength);

    // Split key material into individual keys
    let offset = 0;
    const clientWriteMAC = keyMaterial.slice(offset, offset + macLength);
    offset += macLength;
    const serverWriteMAC = keyMaterial.slice(offset, offset + macLength);
    offset += macLength;
    const clientWriteKey = keyMaterial.slice(offset, offset + keyLength);
    offset += keyLength;
    const serverWriteKey = keyMaterial.slice(offset, offset + keyLength);
    offset += keyLength;
    const clientWriteIV = keyMaterial.slice(offset, offset + ivLength);
    offset += ivLength;
    const serverWriteIV = keyMaterial.slice(offset, offset + ivLength);

    return {
        clientWriteKey,
        serverWriteKey,
        clientWriteIV,
        serverWriteIV,
        clientWriteMAC: macLength > 0 ? clientWriteMAC : undefined,
        serverWriteMAC: macLength > 0 ? serverWriteMAC : undefined,
    };
}

/**
 * Compute master secret from pre-master secret
 *
 * @param preMasterSecret - Pre-master secret from key exchange
 * @param clientRandom - Client random bytes
 * @param serverRandom - Server random bytes
 * @param tlsVersion - TLS version (1.2, 1.3, etc.)
 * @returns Master secret (48 bytes)
 *
 * TLS 1.2: PRF(pre_master_secret, "master secret", ClientHello.random + ServerHello.random)[0..47]
 */
export async function computeMasterSecret(
    preMasterSecret: ByteBuffer,
    clientRandom: ByteBuffer,
    serverRandom: ByteBuffer,
    tlsVersion: string,
): Promise<ByteBuffer> {
    if (tlsVersion === "1.3") {
        // TLS 1.3 uses HKDF instead
        throw new Error("Use deriveTrafficSecrets for TLS 1.3");
    }

    // TLS 1.2 and below: PRF(pre_master_secret, "master secret", client_random + server_random)
    const label = new TextEncoder().encode("master secret");
    const seed = concat(clientRandom, serverRandom);
    const masterSecret = await prf(preMasterSecret, label, seed, 48);

    return masterSecret;
}

/**
 * TLS 1.3 key schedule - derives traffic secrets
 *
 * @param sharedSecret - ECDHE shared secret
 * @param handshakeContext - Handshake message hash
 * @returns Traffic secrets for encryption
 *
 * Implements TLS 1.3 key schedule using HKDF-SHA256
 */
export async function deriveTrafficSecrets(
    sharedSecret: ByteBuffer,
    handshakeContext: ByteBuffer,
): Promise<{
    clientHandshakeTrafficSecret: ByteBuffer;
    serverHandshakeTrafficSecret: ByteBuffer;
    clientApplicationTrafficSecret: ByteBuffer;
    serverApplicationTrafficSecret: ByteBuffer;
}> {
    const hashLength = 32; // SHA-256
    const emptyHash = new Uint8Array(hashLength);

    // Early Secret = HKDF-Extract(0, 0)
    const earlySecret = await hkdfExtract(new Uint8Array(hashLength), new Uint8Array(1));

    // Handshake Secret = HKDF-Extract(Derive-Secret(Early Secret, "derived", ""), ECDHE)
    const derivedSecret = await deriveSecret(earlySecret, "derived", emptyHash, hashLength);
    const handshakeSecret = await hkdfExtract(derivedSecret, sharedSecret);

    // Client Handshake Traffic Secret
    const clientHandshakeTrafficSecret = await deriveSecret(
        handshakeSecret,
        "c hs traffic",
        handshakeContext,
        hashLength,
    );

    // Server Handshake Traffic Secret
    const serverHandshakeTrafficSecret = await deriveSecret(
        handshakeSecret,
        "s hs traffic",
        handshakeContext,
        hashLength,
    );

    // Master Secret = HKDF-Extract(Derive-Secret(Handshake Secret, "derived", ""), 0)
    const derivedFromHandshake = await deriveSecret(
        handshakeSecret,
        "derived",
        emptyHash,
        hashLength,
    );
    const masterSecret = await hkdfExtract(derivedFromHandshake, new Uint8Array(1));

    // Client Application Traffic Secret
    const clientApplicationTrafficSecret = await deriveSecret(
        masterSecret,
        "c ap traffic",
        handshakeContext,
        hashLength,
    );

    // Server Application Traffic Secret
    const serverApplicationTrafficSecret = await deriveSecret(
        masterSecret,
        "s ap traffic",
        handshakeContext,
        hashLength,
    );

    return {
        clientHandshakeTrafficSecret,
        serverHandshakeTrafficSecret,
        clientApplicationTrafficSecret,
        serverApplicationTrafficSecret,
    };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * TLS 1.2 PRF using HMAC-SHA256
 * PRF(secret, label, seed) = P_SHA256(secret, label + seed)
 */
async function prf(
    secret: ByteBuffer,
    label: ByteBuffer,
    seed: ByteBuffer,
    length: number,
): Promise<ByteBuffer> {
    const labelAndSeed = concat(label, seed);
    return await pSHA256(secret, labelAndSeed, length);
}

/**
 * P_SHA256 expansion function
 * P_SHA256(secret, seed) = HMAC(secret, A(1) + seed) + HMAC(secret, A(2) + seed) + ...
 * Where A(0) = seed, A(i) = HMAC(secret, A(i-1))
 */
async function pSHA256(
    secret: ByteBuffer,
    seed: ByteBuffer,
    length: number,
): Promise<ByteBuffer> {
    const result = new Uint8Array(length);
    let offset = 0;
    let a = seed; // A(0) = seed

    while (offset < length) {
        // A(i) = HMAC(secret, A(i-1))
        a = await hmacSHA256(secret, a);

        // HMAC(secret, A(i) + seed)
        const output = await hmacSHA256(secret, concat(a, seed));

        const toCopy = Math.min(output.byteLength, length - offset);
        result.set(output.slice(0, toCopy), offset);
        offset += toCopy;
    }

    return result;
}

/**
 * HKDF-Extract
 * HKDF-Extract(salt, IKM) -> PRK
 */
async function hkdfExtract(salt: ByteBuffer, ikm: ByteBuffer): Promise<ByteBuffer> {
    return await hmacSHA256(salt, ikm);
}

/**
 * HKDF-Expand
 * HKDF-Expand(PRK, info, L) -> OKM
 */
async function hkdfExpand(
    prk: ByteBuffer,
    info: ByteBuffer,
    length: number,
): Promise<ByteBuffer> {
    const hashLen = 32; // SHA-256
    const n = Math.ceil(length / hashLen);
    const okm = new Uint8Array(n * hashLen);
    let t = new Uint8Array(0);

    for (let i = 0; i < n; i++) {
        const input = concat(t, info, new Uint8Array([i + 1]));
        t = await hmacSHA256(prk, input);
        okm.set(t, i * hashLen);
    }

    return okm.slice(0, length);
}

/**
 * TLS 1.3 Derive-Secret
 * Derive-Secret(Secret, Label, Messages) = HKDF-Expand-Label(Secret, Label, Hash(Messages), Hash.length)
 */
async function deriveSecret(
    secret: ByteBuffer,
    label: string,
    context: ByteBuffer,
    length: number,
): Promise<ByteBuffer> {
    return await hkdfExpandLabel(secret, label, context, length);
}

/**
 * HKDF-Expand-Label (TLS 1.3)
 * struct {
 *   uint16 length;
 *   opaque label<7..255> = "tls13 " + Label;
 *   opaque context<0..255> = Context;
 * } HkdfLabel;
 */
export async function hkdfExpandLabel(
    secret: ByteBuffer,
    label: string,
    context: ByteBuffer,
    length: number,
): Promise<ByteBuffer> {
    // Build HkdfLabel structure
    const prefix = "tls13 ";
    const fullLabel = new TextEncoder().encode(prefix + label);

    const hkdfLabel = new Uint8Array(2 + 1 + fullLabel.byteLength + 1 + context.byteLength);
    const view = new DataView(hkdfLabel.buffer);

    let offset = 0;

    // Length (2 bytes)
    view.setUint16(offset, length);
    offset += 2;

    // Label length (1 byte) + label
    hkdfLabel[offset++] = fullLabel.byteLength;
    hkdfLabel.set(fullLabel, offset);
    offset += fullLabel.byteLength;

    // Context length (1 byte) + context
    hkdfLabel[offset++] = context.byteLength;
    hkdfLabel.set(context, offset);

    return await hkdfExpand(secret, hkdfLabel, length);
}

/**
 * HMAC-SHA256
 */
export async function hmacSHA256(key: ByteBuffer, data: ByteBuffer): Promise<ByteBuffer> {
    const cryptoKey = await crypto.subtle.importKey(
        "raw",
        key,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
    );

    const signature = await crypto.subtle.sign("HMAC", cryptoKey, data);
    return new Uint8Array(signature);
}

/**
 * Concatenate multiple byte buffers
 */
function concat(...buffers: ByteBuffer[]): ByteBuffer {
    const totalLength = buffers.reduce((sum, buf) => sum + buf.byteLength, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;

    for (const buffer of buffers) {
        result.set(buffer, offset);
        offset += buffer.byteLength;
    }

    return result;
}

/**
 * Get cipher suite key length in bytes
 */
function getCipherKeyLength(cipherSuite: string): number {
    // Common cipher suites
    if (cipherSuite.includes("AES_128")) return 16;
    if (cipherSuite.includes("AES_256")) return 32;
    if (cipherSuite.includes("CHACHA20")) return 32;

    // Default to AES-128
    return 16;
}

/**
 * Get cipher suite IV length in bytes
 */
function getCipherIVLength(cipherSuite: string): number {
    // AES-GCM uses 12-byte IV (96 bits)
    if (cipherSuite.includes("GCM")) return 12;

    // ChaCha20-Poly1305 uses 12-byte nonce
    if (cipherSuite.includes("CHACHA20")) return 12;

    // AES-CBC uses 16-byte IV
    if (cipherSuite.includes("CBC")) return 16;

    // Default to 12 bytes (GCM)
    return 12;
}

/**
 * Get cipher suite MAC length in bytes
 * Note: AEAD ciphers (GCM, CCM, Poly1305) don't use separate MAC keys
 */
function getCipherMACLength(cipherSuite: string): number {
    // AEAD ciphers don't use MAC keys
    if (cipherSuite.includes("GCM")) return 0;
    if (cipherSuite.includes("CCM")) return 0;
    if (cipherSuite.includes("CHACHA20")) return 0;

    // Legacy cipher suites with HMAC
    if (cipherSuite.includes("SHA384")) return 48;
    if (cipherSuite.includes("SHA256")) return 32;
    if (cipherSuite.includes("SHA")) return 20;

    // Default to no MAC (AEAD)
    return 0;
}
