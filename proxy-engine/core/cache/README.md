# Cache Module

HTTP cache with optional AES-256-GCM encryption.

## Basic Usage

```typescript
import { CacheManager } from "./cache_manager.ts";

const cache = new CacheManager({
  maxMemoryMB: 100,
  defaultTTL: 300,
  enableDiskCache: false,
});
```

## Encryption

Enable encryption for sensitive cached data:

```typescript
import { CacheManager } from "./cache_manager.ts";
import { deriveKey } from "./encryption/aes.ts";
import { generateSaltBytes } from "./encryption/salt.ts";

// Generate encryption key
const salt = generateSaltBytes(16);
const encryptionKey = await deriveKey("my-secret-passphrase", salt);

const cache = new CacheManager({
  maxMemoryMB: 100,
  defaultTTL: 300,
  enableDiskCache: false,
  encryption: {
    enabled: true,
    key: encryptionKey,
  },
});

// Transparent encryption/decryption
await cache.store("key", response);
const entry = await cache.get("key"); // Automatically decrypted
```

## Security

- AES-256-GCM authenticated encryption
- PBKDF2 key derivation (100k iterations)
- Unique IV per entry (semantic security)
- Authentication tag prevents tampering
- Decryption failures return null (fail-safe)
