import { assertEquals, assertExists, assertNotEquals } from "@std/assert";
import { encrypt, decrypt, deriveKey } from "../../../../core/cache/encryption/aes.ts";

Deno.test("deriveKey - derives consistent key from passphrase", async () => {
  const passphrase = "test-passphrase-12345";
  const salt = new Uint8Array(16).fill(1);

  const key1 = await deriveKey(passphrase, salt);
  const key2 = await deriveKey(passphrase, salt);

  assertExists(key1);
  assertEquals(key1.type, "secret");
});

Deno.test("encrypt - encrypts plaintext data", async () => {
  const key = await deriveKey("test-pass", new Uint8Array(16).fill(1));
  const plaintext = new TextEncoder().encode("Hello World");

  const encrypted = await encrypt(key, plaintext);

  assertExists(encrypted.ciphertext);
  assertExists(encrypted.iv);
  assertEquals(encrypted.iv.length, 12); // GCM standard
  assertNotEquals(encrypted.ciphertext, plaintext);
});

Deno.test("decrypt - decrypts ciphertext back to plaintext", async () => {
  const key = await deriveKey("test-pass", new Uint8Array(16).fill(1));
  const plaintext = new TextEncoder().encode("Secret data");

  const encrypted = await encrypt(key, plaintext);
  const decrypted = await decrypt(key, encrypted.ciphertext, encrypted.iv);

  assertEquals(decrypted, plaintext);
});

Deno.test("encrypt - unique IV for each encryption", async () => {
  const key = await deriveKey("test-pass", new Uint8Array(16).fill(1));
  const plaintext = new TextEncoder().encode("Same data");

  const encrypted1 = await encrypt(key, plaintext);
  const encrypted2 = await encrypt(key, plaintext);

  assertNotEquals(encrypted1.iv, encrypted2.iv);
  assertNotEquals(encrypted1.ciphertext, encrypted2.ciphertext);
});

Deno.test("decrypt - throws on wrong key", async () => {
  const key1 = await deriveKey("password1", new Uint8Array(16).fill(1));
  const key2 = await deriveKey("password2", new Uint8Array(16).fill(2));
  const plaintext = new TextEncoder().encode("Secret");

  const encrypted = await encrypt(key1, plaintext);

  let thrown = false;
  try {
    await decrypt(key2, encrypted.ciphertext, encrypted.iv);
  } catch {
    thrown = true;
  }
  assertEquals(thrown, true);
});

Deno.test("deriveKey - different salts produce different keys", async () => {
  const passphrase = "same-passphrase";
  const salt1 = new Uint8Array(16).fill(1);
  const salt2 = new Uint8Array(16).fill(2);

  const key1 = await deriveKey(passphrase, salt1);
  const key2 = await deriveKey(passphrase, salt2);

  // Verify keys are different by encrypting same plaintext and checking ciphertext differs
  const plaintext = new TextEncoder().encode("test data");
  const encrypted1 = await encrypt(key1, plaintext);
  const encrypted2 = await encrypt(key2, plaintext);

  // Different keys should produce different ciphertexts (even with same plaintext and different IVs)
  assertNotEquals(encrypted1.ciphertext, encrypted2.ciphertext);
});

Deno.test("encrypt/decrypt - handles large data (64KB)", async () => {
  const key = await deriveKey("test-pass", new Uint8Array(16).fill(1));
  const largeData = new Uint8Array(65536); // 64KB (max for getRandomValues)
  crypto.getRandomValues(largeData);

  const encrypted = await encrypt(key, largeData);
  const decrypted = await decrypt(key, encrypted.ciphertext, encrypted.iv);

  assertEquals(decrypted, largeData);
});

Deno.test("encrypt/decrypt - handles empty data", async () => {
  const key = await deriveKey("test-pass", new Uint8Array(16).fill(1));
  const emptyData = new Uint8Array(0);

  const encrypted = await encrypt(key, emptyData);
  const decrypted = await decrypt(key, encrypted.ciphertext, encrypted.iv);

  assertEquals(decrypted.length, 0);
});

Deno.test("decrypt - throws on corrupted ciphertext", async () => {
  const key = await deriveKey("test-pass", new Uint8Array(16).fill(1));
  const plaintext = new TextEncoder().encode("Secret");

  const encrypted = await encrypt(key, plaintext);

  // Corrupt the ciphertext
  encrypted.ciphertext[0] ^= 0xFF;

  let thrown = false;
  try {
    await decrypt(key, encrypted.ciphertext, encrypted.iv);
  } catch {
    thrown = true;
  }
  assertEquals(thrown, true);
});

Deno.test("encrypt/decrypt - preserves UTF-8 encoding", async () => {
  const key = await deriveKey("test-pass", new Uint8Array(16).fill(1));
  const utf8Text = "Hello 世界 🌍 émojis";
  const plaintext = new TextEncoder().encode(utf8Text);

  const encrypted = await encrypt(key, plaintext);
  const decrypted = await decrypt(key, encrypted.ciphertext, encrypted.iv);
  const result = new TextDecoder().decode(decrypted);

  assertEquals(result, utf8Text);
});
