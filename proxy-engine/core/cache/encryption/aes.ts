/**
 * AES-GCM Encryption for Cache Data
 * Uses Web Crypto API for AES-256-GCM with PBKDF2 key derivation
 *
 * Note: Type assertions (as BufferSource) are used due to TypeScript strictness
 * with Uint8Array<ArrayBufferLike> vs ArrayBuffer types. The code works correctly
 * at runtime and all tests pass.
 */

import { generateSaltBytes } from "./salt.ts";

export interface EncryptedData {
  ciphertext: Uint8Array;
  iv: Uint8Array; // 12 bytes for GCM
}

/**
 * Derive AES-256 key from passphrase using PBKDF2
 * Same passphrase + salt always produces same key
 */
export async function deriveKey(
  passphrase: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  return await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: 100000, // Strong protection
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt data using AES-256-GCM
 * Generates unique IV automatically
 */
export async function encrypt(
  key: CryptoKey,
  plaintext: Uint8Array
): Promise<EncryptedData> {
  const iv = generateSaltBytes(12); // 12-byte IV for GCM

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv as BufferSource,
      tagLength: 128, // 16-byte auth tag
    },
    key,
    plaintext
  );

  return {
    ciphertext: new Uint8Array(ciphertext),
    iv: iv as Uint8Array,
  };
}

/**
 * Decrypt data using AES-256-GCM
 * Throws if authentication fails (wrong key or corrupted data)
 */
export async function decrypt(
  key: CryptoKey,
  ciphertext: Uint8Array,
  iv: Uint8Array
): Promise<Uint8Array> {
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv as BufferSource,
      tagLength: 128,
    },
    key,
    ciphertext
  );

  return new Uint8Array(plaintext);
}

/**
 * String encryption convenience wrappers
 */
export async function encryptString(key: CryptoKey, text: string): Promise<EncryptedData> {
  return await encrypt(key, new TextEncoder().encode(text));
}

export async function decryptString(
  key: CryptoKey,
  ciphertext: Uint8Array,
  iv: Uint8Array
): Promise<string> {
  const bytes = await decrypt(key, ciphertext, iv);
  return new TextDecoder().decode(bytes);
}
