/**
 * SHA-256 Hashing
 *
 * Uses Web Crypto API for secure SHA-256 hashing
 */

/**
 * Compute SHA-256 hash and return as hex string
 */
export async function sha256(data: string | Uint8Array): Promise<string> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  return sha256Hex(new Uint8Array(hashBuffer));
}

/**
 * Compute SHA-256 hash and return as bytes
 */
export async function sha256Bytes(data: Uint8Array): Promise<Uint8Array> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", new Uint8Array(data));
  return new Uint8Array(hashBuffer);
}

/**
 * Convert byte array to hex string
 */
export function sha256Hex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Compute SHA-256 hash of multiple data chunks
 */
export async function sha256Multi(...chunks: (string | Uint8Array)[]): Promise<string> {
  // Concatenate all chunks
  const totalLength = chunks.reduce((sum, chunk) => {
    return sum + (typeof chunk === "string" ? new TextEncoder().encode(chunk).length : chunk.length);
  }, 0);

  const combined = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    const bytes = typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk;
    combined.set(bytes, offset);
    offset += bytes.length;
  }

  return await sha256(combined);
}

/**
 * Verify that data matches a given hash
 */
export async function verifySha256(
  data: string | Uint8Array,
  expectedHash: string,
): Promise<boolean> {
  const actualHash = await sha256(data);
  return actualHash === expectedHash;
}

/**
 * Compute SHA-256 HMAC (Hash-based Message Authentication Code)
 */
export async function sha256Hmac(
  key: string | Uint8Array,
  data: string | Uint8Array,
): Promise<string> {
  const keyBytes = typeof key === "string" ? new TextEncoder().encode(key) : new Uint8Array(key);
  const dataBytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, dataBytes);
  return sha256Hex(new Uint8Array(signature));
}

/**
 * Compute SHA-256 HMAC and return as bytes
 */
export async function sha256HmacBytes(
  key: Uint8Array,
  data: Uint8Array,
): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new Uint8Array(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, new Uint8Array(data));
  return new Uint8Array(signature);
}
