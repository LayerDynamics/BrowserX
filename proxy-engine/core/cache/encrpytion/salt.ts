/**
 * Salt Generation
 *
 * Random salt generation for cache security
 */

import { sha256Hex } from "./sha.ts";

/**
 * Generate random salt as hex string
 */
export function generateSalt(length = 32): string {
  return sha256Hex(generateSaltBytes(length));
}

/**
 * Generate random salt as byte array
 */
export function generateSaltBytes(length = 32): Uint8Array {
  const salt = new Uint8Array(length);
  crypto.getRandomValues(salt);
  return salt;
}

/**
 * Generate a cryptographically secure random string
 */
export function generateRandomString(length: number): string {
  const bytes = generateSaltBytes(Math.ceil(length / 2));
  return sha256Hex(bytes).slice(0, length);
}

/**
 * Generate a random nonce (number used once)
 */
export function generateNonce(): string {
  const timestamp = Date.now();
  const random = generateSalt(16);
  return `${timestamp}-${random}`;
}

/**
 * Generate a random IV (initialization vector) for encryption
 */
export function generateIV(length = 16): Uint8Array {
  return generateSaltBytes(length);
}
