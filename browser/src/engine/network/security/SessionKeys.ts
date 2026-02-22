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
  // Use correct hash algorithm based on cipher suite
  const label = new TextEncoder().encode("key expansion");
  const seed = concat(serverRandom, clientRandom);
  const hashAlgorithm = getPRFHashForCipherSuite(cipherSuite);

  const keyMaterial = await prfWithHash(masterSecret, label, seed, totalLength, hashAlgorithm);

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
 * @param cipherSuite - Cipher suite name (for selecting PRF hash algorithm)
 * @returns Master secret (48 bytes)
 *
 * TLS 1.2: PRF(pre_master_secret, "master secret", ClientHello.random + ServerHello.random)[0..47]
 */
export async function computeMasterSecret(
  preMasterSecret: ByteBuffer,
  clientRandom: ByteBuffer,
  serverRandom: ByteBuffer,
  tlsVersion: string,
  cipherSuite?: string,
): Promise<ByteBuffer> {
  if (tlsVersion === "1.3") {
    // TLS 1.3 uses HKDF instead
    throw new Error("Use deriveTrafficSecrets for TLS 1.3");
  }

  // TLS 1.2 and below: PRF(pre_master_secret, "master secret", client_random + server_random)
  const label = new TextEncoder().encode("master secret");
  const seed = concat(clientRandom, serverRandom);

  // Select hash algorithm based on cipher suite (SHA384 cipher suites use P_SHA384)
  const hashAlgorithm = cipherSuite ? getPRFHashForCipherSuite(cipherSuite) : "SHA-256";
  const masterSecret = await prfWithHash(preMasterSecret, label, seed, 48, hashAlgorithm);

  return masterSecret;
}

/**
 * TLS 1.3 cipher suite information
 */
export interface CipherSuiteInfo {
  hashAlgorithm: "SHA-256" | "SHA-384";
  hashLength: number;
  keyLength: number; // AES key length in bytes
}

/**
 * Get cipher suite info from cipher suite code
 * Supports both TLS 1.3 and TLS 1.2 cipher suites
 */
export function getCipherSuiteInfo(cipherSuite: number): CipherSuiteInfo {
  switch (cipherSuite) {
    // TLS 1.3 cipher suites
    case 0x1301: // TLS_AES_128_GCM_SHA256
      return { hashAlgorithm: "SHA-256", hashLength: 32, keyLength: 16 };
    case 0x1302: // TLS_AES_256_GCM_SHA384
      return { hashAlgorithm: "SHA-384", hashLength: 48, keyLength: 32 };
    case 0x1303: // TLS_CHACHA20_POLY1305_SHA256
      return { hashAlgorithm: "SHA-256", hashLength: 32, keyLength: 32 };

    // TLS 1.2 cipher suites with SHA-256
    case 0xc02b: // TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256
    case 0xc02f: // TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256
      return { hashAlgorithm: "SHA-256", hashLength: 32, keyLength: 16 };

    // TLS 1.2 cipher suites with SHA-384
    case 0xc02c: // TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384
    case 0xc030: // TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384
      return { hashAlgorithm: "SHA-384", hashLength: 48, keyLength: 32 };

    // TLS 1.2 ChaCha20-Poly1305 cipher suites (use SHA-256)
    case 0xcca9: // TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256
    case 0xcca8: // TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256
      return { hashAlgorithm: "SHA-256", hashLength: 32, keyLength: 32 };

    default:
      // Default to AES-128-GCM-SHA256
      return { hashAlgorithm: "SHA-256", hashLength: 32, keyLength: 16 };
  }
}

/**
 * HMAC with configurable hash algorithm
 */
async function hmacHash(
  key: ByteBuffer,
  data: ByteBuffer,
  hashAlgorithm: "SHA-256" | "SHA-384",
): Promise<ByteBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: hashAlgorithm },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, data);
  return new Uint8Array(signature);
}

/**
 * HKDF-Extract with configurable hash algorithm
 */
async function hkdfExtractWithHash(
  salt: ByteBuffer,
  ikm: ByteBuffer,
  hashAlgorithm: "SHA-256" | "SHA-384",
): Promise<ByteBuffer> {
  return await hmacHash(salt, ikm, hashAlgorithm);
}

/**
 * Derive-Secret with configurable hash algorithm
 */
async function deriveSecretWithHash(
  secret: ByteBuffer,
  label: string,
  context: ByteBuffer,
  length: number,
  hashAlgorithm: "SHA-256" | "SHA-384",
): Promise<ByteBuffer> {
  return await hkdfExpandLabelWithHash(secret, label, context, length, hashAlgorithm);
}

/**
 * HKDF-Expand-Label with configurable hash algorithm
 */
async function hkdfExpandLabelWithHash(
  secret: ByteBuffer,
  label: string,
  context: ByteBuffer,
  length: number,
  hashAlgorithm: "SHA-256" | "SHA-384",
): Promise<ByteBuffer> {
  const prefix = "tls13 ";
  const fullLabel = new TextEncoder().encode(prefix + label);

  const hkdfLabel = new Uint8Array(2 + 1 + fullLabel.byteLength + 1 + context.byteLength);
  const view = new DataView(hkdfLabel.buffer);

  let offset = 0;
  view.setUint16(offset, length);
  offset += 2;
  hkdfLabel[offset++] = fullLabel.byteLength;
  hkdfLabel.set(fullLabel, offset);
  offset += fullLabel.byteLength;
  hkdfLabel[offset++] = context.byteLength;
  hkdfLabel.set(context, offset);

  return await hkdfExpandWithHash(secret, hkdfLabel, length, hashAlgorithm);
}

/**
 * HKDF-Expand with configurable hash algorithm
 */
async function hkdfExpandWithHash(
  prk: ByteBuffer,
  info: ByteBuffer,
  length: number,
  hashAlgorithm: "SHA-256" | "SHA-384",
): Promise<ByteBuffer> {
  const hashLen = hashAlgorithm === "SHA-384" ? 48 : 32;
  const n = Math.ceil(length / hashLen);
  const okm = new Uint8Array(n * hashLen);
  let t = new Uint8Array(0);

  for (let i = 0; i < n; i++) {
    const input = concat(t, info, new Uint8Array([i + 1]));
    t = await hmacHash(prk, input, hashAlgorithm);
    okm.set(t, i * hashLen);
  }

  return okm.slice(0, length);
}

/**
 * TLS 1.3 key schedule - derives handshake traffic secrets
 *
 * @param sharedSecret - ECDHE shared secret
 * @param handshakeContext - Hash of ClientHello + ServerHello
 * @param cipherSuite - Negotiated cipher suite code (optional, defaults to 0x1301)
 * @returns Handshake traffic secrets and master secret for later derivation
 *
 * Implements TLS 1.3 key schedule using HKDF with appropriate hash algorithm
 */
export async function deriveHandshakeTrafficSecrets(
  sharedSecret: ByteBuffer,
  handshakeContext: ByteBuffer,
  cipherSuite: number = 0x1301,
): Promise<{
  clientHandshakeTrafficSecret: ByteBuffer;
  serverHandshakeTrafficSecret: ByteBuffer;
  masterSecret: ByteBuffer;
}> {
  const csInfo = getCipherSuiteInfo(cipherSuite);
  const hashLength = csInfo.hashLength;
  const hashAlgorithm = csInfo.hashAlgorithm;
  const zeros = new Uint8Array(hashLength);

  // Hash of empty string with appropriate algorithm
  const emptyMessageHash = new Uint8Array(
    await crypto.subtle.digest(hashAlgorithm, new Uint8Array(0)),
  );

  // Early Secret = HKDF-Extract(salt=0, IKM=0)
  const earlySecret = await hkdfExtractWithHash(zeros, zeros, hashAlgorithm);

  // Handshake Secret = HKDF-Extract(Derive-Secret(Early Secret, "derived", ""), ECDHE)
  const derivedSecret = await deriveSecretWithHash(
    earlySecret,
    "derived",
    emptyMessageHash,
    hashLength,
    hashAlgorithm,
  );
  const handshakeSecret = await hkdfExtractWithHash(derivedSecret, sharedSecret, hashAlgorithm);

  // Client Handshake Traffic Secret - uses hash(ClientHello + ServerHello)
  const clientHandshakeTrafficSecret = await deriveSecretWithHash(
    handshakeSecret,
    "c hs traffic",
    handshakeContext,
    hashLength,
    hashAlgorithm,
  );

  // Server Handshake Traffic Secret - uses hash(ClientHello + ServerHello)
  const serverHandshakeTrafficSecret = await deriveSecretWithHash(
    handshakeSecret,
    "s hs traffic",
    handshakeContext,
    hashLength,
    hashAlgorithm,
  );

  // Master Secret = HKDF-Extract(Derive-Secret(Handshake Secret, "derived", ""), 0)
  const derivedFromHandshake = await deriveSecretWithHash(
    handshakeSecret,
    "derived",
    emptyMessageHash,
    hashLength,
    hashAlgorithm,
  );
  const masterSecret = await hkdfExtractWithHash(derivedFromHandshake, zeros, hashAlgorithm);

  return {
    clientHandshakeTrafficSecret,
    serverHandshakeTrafficSecret,
    masterSecret,
  };
}

/**
 * TLS 1.3 - derives application traffic secrets from master secret
 *
 * @param masterSecret - Master secret from handshake derivation
 * @param applicationContext - Hash of full handshake transcript through server Finished
 * @param cipherSuite - Negotiated cipher suite code (optional, defaults to 0x1301)
 * @returns Application traffic secrets
 */
export async function deriveApplicationTrafficSecrets(
  masterSecret: ByteBuffer,
  applicationContext: ByteBuffer,
  cipherSuite: number = 0x1301,
): Promise<{
  clientApplicationTrafficSecret: ByteBuffer;
  serverApplicationTrafficSecret: ByteBuffer;
}> {
  const csInfo = getCipherSuiteInfo(cipherSuite);
  const hashLength = csInfo.hashLength;
  const hashAlgorithm = csInfo.hashAlgorithm;

  // Client Application Traffic Secret - uses hash(full handshake through server Finished)
  const clientApplicationTrafficSecret = await deriveSecretWithHash(
    masterSecret,
    "c ap traffic",
    applicationContext,
    hashLength,
    hashAlgorithm,
  );

  // Server Application Traffic Secret - uses hash(full handshake through server Finished)
  const serverApplicationTrafficSecret = await deriveSecretWithHash(
    masterSecret,
    "s ap traffic",
    applicationContext,
    hashLength,
    hashAlgorithm,
  );

  return {
    clientApplicationTrafficSecret,
    serverApplicationTrafficSecret,
  };
}

/**
 * TLS 1.3 key schedule - derives traffic secrets (legacy wrapper)
 * @deprecated Use deriveHandshakeTrafficSecrets and deriveApplicationTrafficSecrets instead
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
  const handshakeSecrets = await deriveHandshakeTrafficSecrets(sharedSecret, handshakeContext);
  const appSecrets = await deriveApplicationTrafficSecrets(
    handshakeSecrets.masterSecret,
    handshakeContext,
  );

  return {
    clientHandshakeTrafficSecret: handshakeSecrets.clientHandshakeTrafficSecret,
    serverHandshakeTrafficSecret: handshakeSecrets.serverHandshakeTrafficSecret,
    clientApplicationTrafficSecret: appSecrets.clientApplicationTrafficSecret,
    serverApplicationTrafficSecret: appSecrets.serverApplicationTrafficSecret,
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
 * P_SHA384 expansion function (for SHA384 cipher suites)
 * Same algorithm as P_SHA256 but with SHA-384 HMAC
 */
async function pSHA384(
  secret: ByteBuffer,
  seed: ByteBuffer,
  length: number,
): Promise<ByteBuffer> {
  const result = new Uint8Array(length);
  let offset = 0;
  let a = seed; // A(0) = seed

  while (offset < length) {
    // A(i) = HMAC(secret, A(i-1))
    a = await hmacSHA384(secret, a);

    // HMAC(secret, A(i) + seed)
    const output = await hmacSHA384(secret, concat(a, seed));

    const toCopy = Math.min(output.byteLength, length - offset);
    result.set(output.slice(0, toCopy), offset);
    offset += toCopy;
  }

  return result;
}

/**
 * HMAC-SHA384
 */
async function hmacSHA384(key: ByteBuffer, data: ByteBuffer): Promise<ByteBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-384" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, data);
  return new Uint8Array(signature);
}

/**
 * Get PRF hash algorithm based on cipher suite
 * TLS 1.2 cipher suites ending in SHA384 use P_SHA384, others use P_SHA256
 */
function getPRFHashForCipherSuite(cipherSuite: string): "SHA-256" | "SHA-384" {
  if (cipherSuite.includes("SHA384")) {
    return "SHA-384";
  }
  return "SHA-256";
}

/**
 * TLS 1.2 PRF with configurable hash algorithm
 */
async function prfWithHash(
  secret: ByteBuffer,
  label: ByteBuffer,
  seed: ByteBuffer,
  length: number,
  hashAlgorithm: "SHA-256" | "SHA-384",
): Promise<ByteBuffer> {
  const labelAndSeed = concat(label, seed);
  if (hashAlgorithm === "SHA-384") {
    return await pSHA384(secret, labelAndSeed, length);
  }
  return await pSHA256(secret, labelAndSeed, length);
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
  cipherSuite: number = 0x1301,
): Promise<ByteBuffer> {
  const csInfo = getCipherSuiteInfo(cipherSuite);
  return await hkdfExpandLabelWithHash(secret, label, context, length, csInfo.hashAlgorithm);
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
 * Cipher-suite-aware HMAC
 * Uses the hash algorithm from the cipher suite
 */
export async function hmacWithCipherSuite(
  key: ByteBuffer,
  data: ByteBuffer,
  cipherSuite: number = 0x1301,
): Promise<ByteBuffer> {
  const csInfo = getCipherSuiteInfo(cipherSuite);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: csInfo.hashAlgorithm },
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
 *
 * For TLS 1.2 AES-GCM (RFC 5288): Uses 4-byte implicit IV from key derivation
 * plus 8-byte explicit nonce sent with each record = 12 bytes total.
 * This function returns the implicit IV length needed for key derivation.
 *
 * Note: TLS 1.3 uses HKDF (deriveHandshakeTrafficSecrets) not this function.
 */
function getCipherIVLength(cipherSuite: string): number {
  // TLS 1.2 AES-GCM uses 4-byte implicit IV from key derivation (RFC 5288)
  // The remaining 8 bytes are the explicit nonce sent with each record
  if (cipherSuite.includes("GCM")) return 4;

  // TLS 1.2 ChaCha20-Poly1305 uses 4-byte implicit IV (RFC 7905)
  if (cipherSuite.includes("CHACHA20")) return 4;

  // AES-CBC uses 16-byte IV
  if (cipherSuite.includes("CBC")) return 16;

  // Default to 4 bytes for AEAD ciphers
  return 4;
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
