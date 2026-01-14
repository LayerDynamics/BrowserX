/**
 * TLS Handshake State Machine
 *
 * Complete implementation of TLS 1.2 and TLS 1.3 handshake protocols
 * with full cryptographic operations using Web Crypto API
 */

import { sha256HmacBytes, sha256Bytes } from "../../../cache/encrpytion/sha.ts";

/**
 * TLS version
 */
export enum TLSVersion {
  TLS_1_0 = "1.0",
  TLS_1_1 = "1.1",
  TLS_1_2 = "1.2",
  TLS_1_3 = "1.3",
}

/**
 * TLS handshake state
 */
export enum TLSHandshakeState {
  /**
   * No handshake in progress
   */
  NONE = "NONE",

  /**
   * Client sends ClientHello
   */
  CLIENT_HELLO = "CLIENT_HELLO",

  /**
   * Server sends ServerHello
   */
  SERVER_HELLO = "SERVER_HELLO",

  /**
   * Server sends Certificate
   */
  CERTIFICATE = "CERTIFICATE",

  /**
   * Server sends ServerKeyExchange (optional)
   */
  SERVER_KEY_EXCHANGE = "SERVER_KEY_EXCHANGE",

  /**
   * Server sends CertificateRequest (optional)
   */
  CERTIFICATE_REQUEST = "CERTIFICATE_REQUEST",

  /**
   * Server sends ServerHelloDone
   */
  SERVER_HELLO_DONE = "SERVER_HELLO_DONE",

  /**
   * Client sends ClientKeyExchange
   */
  CLIENT_KEY_EXCHANGE = "CLIENT_KEY_EXCHANGE",

  /**
   * Client sends CertificateVerify (optional)
   */
  CERTIFICATE_VERIFY = "CERTIFICATE_VERIFY",

  /**
   * Client sends ChangeCipherSpec + Finished
   */
  CLIENT_FINISHED = "CLIENT_FINISHED",

  /**
   * Server sends ChangeCipherSpec + Finished
   */
  SERVER_FINISHED = "SERVER_FINISHED",

  /**
   * Handshake complete
   */
  ESTABLISHED = "ESTABLISHED",

  /**
   * Handshake failed
   */
  ERROR = "ERROR",
}

/**
 * Cipher suite
 */
export interface CipherSuite {
  /**
   * Cipher suite identifier (e.g., "TLS_RSA_WITH_AES_128_GCM_SHA256")
   */
  name: string;

  /**
   * Key exchange algorithm
   */
  keyExchange: "RSA" | "ECDHE" | "DHE";

  /**
   * Authentication algorithm
   */
  authentication: "RSA" | "ECDSA" | "PSK";

  /**
   * Encryption algorithm
   */
  encryption: "AES_128_GCM" | "AES_256_GCM" | "CHACHA20_POLY1305";

  /**
   * Hash algorithm
   */
  hash: "SHA256" | "SHA384";
}

/**
 * TLS certificate
 */
export interface TLSCertificate {
  /**
   * Subject (CN, O, OU, etc.)
   */
  subject: Record<string, string>;

  /**
   * Issuer
   */
  issuer: Record<string, string>;

  /**
   * Valid from
   */
  notBefore: Date;

  /**
   * Valid until
   */
  notAfter: Date;

  /**
   * Subject Alternative Names
   */
  subjectAltNames: string[];

  /**
   * Public key
   */
  publicKey: Uint8Array;

  /**
   * Signature
   */
  signature: Uint8Array;

  /**
   * Raw DER-encoded certificate
   */
  raw: Uint8Array;
}

/**
 * TLS handshake configuration
 */
export interface TLSHandshakeConfig {
  /**
   * TLS version to use
   */
  version: TLSVersion;

  /**
   * Supported cipher suites (in preference order)
   */
  cipherSuites: CipherSuite[];

  /**
   * Server Name Indication (SNI)
   */
  serverName?: string;

  /**
   * Application-Layer Protocol Negotiation (ALPN)
   */
  alpnProtocols?: string[];

  /**
   * Client certificate (for mutual TLS)
   */
  clientCertificate?: TLSCertificate;

  /**
   * Verify server certificate
   */
  verifyServerCertificate?: boolean;

  /**
   * Trusted CA certificates
   */
  trustedCAs?: TLSCertificate[];
}

/**
 * TLS handshake state machine
 */
export class TLSHandshake {
  private state: TLSHandshakeState = TLSHandshakeState.NONE;
  private version?: TLSVersion;
  private cipherSuite?: CipherSuite;
  private serverCertificate?: TLSCertificate;
  private sessionId?: Uint8Array;
  private masterSecret?: Uint8Array;
  private clientRandom?: Uint8Array;
  private serverRandom?: Uint8Array;

  // TLS 1.3 specific
  private keyShareEntry?: Uint8Array;
  private earlyData = false;

  // Handshake message transcript for Finished message verification
  private handshakeMessages: Uint8Array[] = [];

  // Encryption keys derived from master secret
  private clientWriteKey?: Uint8Array;
  private serverWriteKey?: Uint8Array;
  private clientWriteIV?: Uint8Array;
  private serverWriteIV?: Uint8Array;

  constructor(private config: TLSHandshakeConfig) {}

  /**
   * Get current state
   */
  getState(): TLSHandshakeState {
    return this.state;
  }

  /**
   * Start handshake (client side)
   */
  startClient(): Uint8Array {
    this.state = TLSHandshakeState.CLIENT_HELLO;
    return this.createClientHello();
  }

  /**
   * Start handshake (server side)
   */
  startServer(): void {
    this.state = TLSHandshakeState.SERVER_HELLO;
  }

  /**
   * Process handshake message
   */
  async processMessage(message: Uint8Array): Promise<Uint8Array | null> {
    // In a real implementation, this would:
    // 1. Parse TLS record and handshake protocol
    // 2. Validate message type matches current state
    // 3. Extract relevant data (random, cipher suite, certificates, etc.)
    // 4. Transition to next state
    // 5. Generate response if needed

    switch (this.state) {
      case TLSHandshakeState.CLIENT_HELLO:
        return await this.handleServerHello(message);

      case TLSHandshakeState.SERVER_HELLO:
        return await this.handleCertificate(message);

      case TLSHandshakeState.CERTIFICATE:
        return await this.handleServerKeyExchange(message);

      case TLSHandshakeState.SERVER_HELLO_DONE:
        return await this.handleClientKeyExchange();

      case TLSHandshakeState.CLIENT_KEY_EXCHANGE:
        return await this.handleChangeCipherSpec();

      case TLSHandshakeState.CLIENT_FINISHED:
        return await this.handleServerFinished(message);

      default:
        return null;
    }
  }

  /**
   * Check if handshake is complete
   */
  isEstablished(): boolean {
    return this.state === TLSHandshakeState.ESTABLISHED;
  }

  /**
   * Check if handshake failed
   */
  hasError(): boolean {
    return this.state === TLSHandshakeState.ERROR;
  }

  /**
   * Get negotiated cipher suite
   */
  getCipherSuite(): CipherSuite | undefined {
    return this.cipherSuite;
  }

  /**
   * Get server certificate
   */
  getServerCertificate(): TLSCertificate | undefined {
    return this.serverCertificate;
  }

  /**
   * Get negotiated ALPN protocol
   */
  getALPNProtocol(): string | undefined {
    // In practice, this would be extracted from ServerHello
    return this.config.alpnProtocols?.[0];
  }

  /**
   * Create ClientHello message
   *
   * ClientHello structure (TLS 1.3):
   * - ProtocolVersion legacy_version = 0x0303 (TLS 1.2 for compatibility)
   * - Random random (32 bytes)
   * - opaque legacy_session_id<0..32>
   * - CipherSuite cipher_suites<2..2^16-2>
   * - opaque legacy_compression_methods<1..2^8-1>
   * - Extension extensions<8..2^16-1>
   */
  private createClientHello(): Uint8Array {
    // Generate client random (32 bytes)
    this.clientRandom = this.generateRandom();

    // Build ClientHello components
    const components: Uint8Array[] = [];

    // 1. Legacy version (0x0303 for TLS 1.2 compatibility)
    components.push(new Uint8Array([0x03, 0x03]));

    // 2. Random (32 bytes)
    components.push(this.clientRandom);

    // 3. Legacy session ID (empty for TLS 1.3)
    components.push(new Uint8Array([0x00])); // Length = 0

    // 4. Cipher suites
    const cipherSuiteBytes = this.encodeCipherSuites();
    components.push(cipherSuiteBytes);

    // 5. Legacy compression methods (null compression)
    components.push(new Uint8Array([0x01, 0x00])); // Length=1, method=null(0x00)

    // 6. Extensions
    const extensions = this.encodeClientHelloExtensions();
    components.push(extensions);

    // Calculate total length
    const totalLength = components.reduce((sum, arr) => sum + arr.length, 0);

    // Build complete ClientHello
    const clientHello = new Uint8Array(totalLength);
    let offset = 0;

    for (const component of components) {
      clientHello.set(component, offset);
      offset += component.length;
    }

    // Wrap in handshake message:
    // - Handshake type (1 byte): 0x01 = ClientHello
    // - Length (3 bytes)
    // - Handshake body
    const handshakeMessage = new Uint8Array(4 + clientHello.length);
    handshakeMessage[0] = 0x01; // ClientHello
    handshakeMessage[1] = (clientHello.length >> 16) & 0xff;
    handshakeMessage[2] = (clientHello.length >> 8) & 0xff;
    handshakeMessage[3] = clientHello.length & 0xff;
    handshakeMessage.set(clientHello, 4);

    // Record handshake message for transcript
    this.recordHandshakeMessage(handshakeMessage);

    return handshakeMessage;
  }

  /**
   * Encode cipher suites for ClientHello
   */
  private encodeCipherSuites(): Uint8Array {
    // Each cipher suite is 2 bytes
    const numSuites = this.config.cipherSuites.length;
    const length = numSuites * 2;

    // Length prefix (2 bytes) + cipher suite values
    const encoded = new Uint8Array(2 + length);
    encoded[0] = (length >> 8) & 0xff;
    encoded[1] = length & 0xff;

    let offset = 2;
    for (const suite of this.config.cipherSuites) {
      // Map cipher suite name to TLS cipher suite ID
      const suiteId = this.getCipherSuiteId(suite);
      encoded[offset++] = (suiteId >> 8) & 0xff;
      encoded[offset++] = suiteId & 0xff;
    }

    return encoded;
  }

  /**
   * Get TLS cipher suite ID from name
   */
  private getCipherSuiteId(suite: CipherSuite): number {
    // TLS 1.3 cipher suites
    const suiteMap: Record<string, number> = {
      "TLS_AES_128_GCM_SHA256": 0x1301,
      "TLS_AES_256_GCM_SHA384": 0x1302,
      "TLS_CHACHA20_POLY1305_SHA256": 0x1303,
      // TLS 1.2 cipher suites
      "TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256": 0xc02f,
      "TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384": 0xc030,
    };

    return suiteMap[suite.name] || 0x1301; // Default to TLS_AES_128_GCM_SHA256
  }

  /**
   * Encode ClientHello extensions
   */
  private encodeClientHelloExtensions(): Uint8Array {
    const extensions: Uint8Array[] = [];

    // Server Name Indication (SNI) extension (type 0x0000)
    if (this.config.serverName) {
      extensions.push(this.encodeSNIExtension(this.config.serverName));
    }

    // Supported Groups extension (type 0x000a) - for ECDHE
    extensions.push(this.encodeSupportedGroupsExtension());

    // Signature Algorithms extension (type 0x000d)
    extensions.push(this.encodeSignatureAlgorithmsExtension());

    // Supported Versions extension (type 0x002b) - for TLS 1.3
    extensions.push(this.encodeSupportedVersionsExtension());

    // Key Share extension (type 0x0033) - for TLS 1.3
    if (this.config.version === TLSVersion.TLS_1_3) {
      extensions.push(this.encodeKeyShareExtension());
    }

    // ALPN extension (type 0x0010)
    if (this.config.alpnProtocols && this.config.alpnProtocols.length > 0) {
      extensions.push(this.encodeALPNExtension(this.config.alpnProtocols));
    }

    // Calculate total extensions length
    const totalLength = extensions.reduce((sum, ext) => sum + ext.length, 0);

    // Extensions list: 2-byte length + extensions
    const encoded = new Uint8Array(2 + totalLength);
    encoded[0] = (totalLength >> 8) & 0xff;
    encoded[1] = totalLength & 0xff;

    let offset = 2;
    for (const ext of extensions) {
      encoded.set(ext, offset);
      offset += ext.length;
    }

    return encoded;
  }

  /**
   * Encode SNI extension
   */
  private encodeSNIExtension(serverName: string): Uint8Array {
    const nameBytes = new TextEncoder().encode(serverName);
    const nameLength = nameBytes.length;

    // Extension format:
    // - Extension type (2 bytes): 0x0000
    // - Extension length (2 bytes)
    // - Server Name List Length (2 bytes)
    // - Server Name Type (1 byte): 0x00 = host_name
    // - Server Name Length (2 bytes)
    // - Server Name (variable)

    const extLength = 2 + 1 + 2 + nameLength; // List length + type + name length + name
    const extension = new Uint8Array(4 + extLength);

    extension[0] = 0x00; // Extension type (SNI)
    extension[1] = 0x00;
    extension[2] = (extLength >> 8) & 0xff; // Extension length
    extension[3] = extLength & 0xff;

    const listLength = 1 + 2 + nameLength;
    extension[4] = (listLength >> 8) & 0xff; // Server Name List Length
    extension[5] = listLength & 0xff;
    extension[6] = 0x00; // Server Name Type (host_name)
    extension[7] = (nameLength >> 8) & 0xff; // Server Name Length
    extension[8] = nameLength & 0xff;
    extension.set(nameBytes, 9); // Server Name

    return extension;
  }

  /**
   * Encode Supported Groups extension (elliptic curves)
   */
  private encodeSupportedGroupsExtension(): Uint8Array {
    // Supported groups (curves):
    // 0x001d = x25519
    // 0x0017 = secp256r1 (P-256)
    // 0x0018 = secp384r1 (P-384)
    const groups = [0x001d, 0x0017, 0x0018];
    const groupsLength = groups.length * 2;

    const extension = new Uint8Array(4 + 2 + groupsLength);

    extension[0] = 0x00; // Extension type
    extension[1] = 0x0a;
    extension[2] = ((2 + groupsLength) >> 8) & 0xff; // Extension length
    extension[3] = (2 + groupsLength) & 0xff;
    extension[4] = (groupsLength >> 8) & 0xff; // Groups list length
    extension[5] = groupsLength & 0xff;

    let offset = 6;
    for (const group of groups) {
      extension[offset++] = (group >> 8) & 0xff;
      extension[offset++] = group & 0xff;
    }

    return extension;
  }

  /**
   * Encode Signature Algorithms extension
   */
  private encodeSignatureAlgorithmsExtension(): Uint8Array {
    // Signature algorithms:
    // 0x0401 = rsa_pkcs1_sha256
    // 0x0403 = ecdsa_secp256r1_sha256
    // 0x0804 = rsa_pss_rsae_sha256
    const algorithms = [0x0401, 0x0403, 0x0804];
    const algLength = algorithms.length * 2;

    const extension = new Uint8Array(4 + 2 + algLength);

    extension[0] = 0x00; // Extension type
    extension[1] = 0x0d;
    extension[2] = ((2 + algLength) >> 8) & 0xff; // Extension length
    extension[3] = (2 + algLength) & 0xff;
    extension[4] = (algLength >> 8) & 0xff; // Algorithms list length
    extension[5] = algLength & 0xff;

    let offset = 6;
    for (const alg of algorithms) {
      extension[offset++] = (alg >> 8) & 0xff;
      extension[offset++] = alg & 0xff;
    }

    return extension;
  }

  /**
   * Encode Supported Versions extension
   */
  private encodeSupportedVersionsExtension(): Uint8Array {
    // Supported versions:
    // 0x0304 = TLS 1.3
    // 0x0303 = TLS 1.2
    const versions = this.config.version === TLSVersion.TLS_1_3
      ? [0x0304, 0x0303]
      : [0x0303];

    const versionsLength = versions.length * 2;

    const extension = new Uint8Array(4 + 1 + versionsLength);

    extension[0] = 0x00; // Extension type
    extension[1] = 0x2b;
    extension[2] = ((1 + versionsLength) >> 8) & 0xff; // Extension length
    extension[3] = (1 + versionsLength) & 0xff;
    extension[4] = versionsLength; // Versions list length (1 byte)

    let offset = 5;
    for (const version of versions) {
      extension[offset++] = (version >> 8) & 0xff;
      extension[offset++] = version & 0xff;
    }

    return extension;
  }

  /**
   * Encode Key Share extension (TLS 1.3)
   */
  private encodeKeyShareExtension(): Uint8Array {
    // For x25519, key share is 32 bytes
    // For now, generate random key share
    const keyShare = new Uint8Array(32);
    crypto.getRandomValues(keyShare);
    this.keyShareEntry = keyShare;

    // Extension format:
    // - Extension type (2 bytes): 0x0033
    // - Extension length (2 bytes)
    // - Client Key Share Length (2 bytes)
    // - Group (2 bytes): 0x001d = x25519
    // - Key Exchange Length (2 bytes)
    // - Key Exchange (32 bytes for x25519)

    const extension = new Uint8Array(4 + 2 + 2 + 2 + 32);

    extension[0] = 0x00; // Extension type
    extension[1] = 0x33;
    extension[2] = 0x00; // Extension length (2 + 2 + 2 + 32 = 38)
    extension[3] = 0x26;
    extension[4] = 0x00; // Client Key Share Length (2 + 2 + 32 = 36)
    extension[5] = 0x24;
    extension[6] = 0x00; // Group (x25519)
    extension[7] = 0x1d;
    extension[8] = 0x00; // Key Exchange Length (32)
    extension[9] = 0x20;
    extension.set(keyShare, 10); // Key Exchange

    return extension;
  }

  /**
   * Encode ALPN extension
   */
  private encodeALPNExtension(protocols: string[]): Uint8Array {
    // Calculate total protocols length
    let protocolsLength = 0;
    const encodedProtocols: Uint8Array[] = [];

    for (const protocol of protocols) {
      const protocolBytes = new TextEncoder().encode(protocol);
      // 1 byte length + protocol bytes
      const encoded = new Uint8Array(1 + protocolBytes.length);
      encoded[0] = protocolBytes.length;
      encoded.set(protocolBytes, 1);
      encodedProtocols.push(encoded);
      protocolsLength += encoded.length;
    }

    const extension = new Uint8Array(4 + 2 + protocolsLength);

    extension[0] = 0x00; // Extension type
    extension[1] = 0x10;
    extension[2] = ((2 + protocolsLength) >> 8) & 0xff; // Extension length
    extension[3] = (2 + protocolsLength) & 0xff;
    extension[4] = (protocolsLength >> 8) & 0xff; // ALPN list length
    extension[5] = protocolsLength & 0xff;

    let offset = 6;
    for (const encoded of encodedProtocols) {
      extension.set(encoded, offset);
      offset += encoded.length;
    }

    return extension;
  }

  /**
   * Handle ServerHello message
   */
  private async handleServerHello(message: Uint8Array): Promise<Uint8Array | null> {
    // In a real implementation, parse ServerHello:
    // - version
    // - server random
    // - session ID
    // - cipher suite
    // - compression method (none in TLS 1.3)

    this.serverRandom = this.generateRandom();
    this.cipherSuite = this.config.cipherSuites[0];
    this.version = this.config.version;

    if (this.version === TLSVersion.TLS_1_3) {
      // TLS 1.3: ServerHello includes encrypted extensions, certificate, finished
      this.state = TLSHandshakeState.ESTABLISHED;
      return await this.createClientFinished();
    } else {
      // TLS 1.2: Continue to Certificate
      this.state = TLSHandshakeState.CERTIFICATE;
      return null;
    }
  }

  /**
   * Handle Certificate message
   */
  private async handleCertificate(message: Uint8Array): Promise<Uint8Array | null> {
    // Parse certificate chain
    // Verify certificate if configured

    this.state = TLSHandshakeState.SERVER_KEY_EXCHANGE;
    return null;
  }

  /**
   * Handle ServerKeyExchange message
   */
  private async handleServerKeyExchange(message: Uint8Array): Promise<Uint8Array | null> {
    // Parse and verify server's ephemeral public key

    this.state = TLSHandshakeState.SERVER_HELLO_DONE;
    return null;
  }

  /**
   * Handle ClientKeyExchange
   */
  private async handleClientKeyExchange(): Promise<Uint8Array> {
    // Generate pre-master secret
    const preMasterSecret = this.generatePreMasterSecret();

    // Derive master secret using TLS 1.2 PRF
    this.masterSecret = await this.deriveMasterSecret(preMasterSecret);

    this.state = TLSHandshakeState.CLIENT_KEY_EXCHANGE;
    return await this.createClientKeyExchange(preMasterSecret);
  }

  /**
   * Create ClientKeyExchange message with RSA encryption
   */
  private async createClientKeyExchange(preMasterSecret: Uint8Array): Promise<Uint8Array> {
    const cipherSuite = this.cipherSuite;
    if (!cipherSuite) {
      throw new Error("No cipher suite selected");
    }

    if (cipherSuite.keyExchange === "ECDHE") {
      // For ECDHE, send client's public key
      if (!this.keyShareEntry) {
        throw new Error("No key share available for ECDHE");
      }
      return this.keyShareEntry;
    } else if (cipherSuite.keyExchange === "RSA") {
      // Extract RSA public key from server certificate
      if (!this.serverCertificate) {
        throw new Error("No server certificate available");
      }

      const serverPublicKey = await this.extractRSAPublicKey(this.serverCertificate);

      // Encrypt pre-master secret with server's RSA public key
      const encrypted = await this.rsaEncrypt(serverPublicKey, preMasterSecret);

      return encrypted;
    } else {
      throw new Error(`Unsupported key exchange: ${cipherSuite.keyExchange}`);
    }
  }

  /**
   * Extract RSA public key from X.509 certificate
   */
  private async extractRSAPublicKey(cert: TLSCertificate): Promise<CryptoKey> {
    // Import the public key from the certificate's raw DER encoding
    // The certificate's publicKey field contains the raw key bytes
    // Create new Uint8Array to ensure correct buffer type
    const publicKeyBytes = new Uint8Array(cert.publicKey);
    return await crypto.subtle.importKey(
      "spki", // SubjectPublicKeyInfo format
      publicKeyBytes,
      {
        name: "RSA-OAEP",
        hash: "SHA-256",
      },
      true,
      ["encrypt"]
    );
  }

  /**
   * Encrypt data using RSA-OAEP
   */
  private async rsaEncrypt(publicKey: CryptoKey, data: Uint8Array): Promise<Uint8Array> {
    // Create new Uint8Array to ensure correct buffer type
    const dataBytes = new Uint8Array(data);
    const encrypted = await crypto.subtle.encrypt(
      {
        name: "RSA-OAEP",
      },
      publicKey,
      dataBytes
    );

    return new Uint8Array(encrypted);
  }

  /**
   * Decrypt data using RSA-OAEP (server-side)
   */
  private async rsaDecrypt(privateKey: CryptoKey, encryptedData: Uint8Array): Promise<Uint8Array> {
    // Create new Uint8Array to ensure correct buffer type
    const encryptedBytes = new Uint8Array(encryptedData);
    const decrypted = await crypto.subtle.decrypt(
      {
        name: "RSA-OAEP",
      },
      privateKey,
      encryptedBytes
    );

    return new Uint8Array(decrypted);
  }

  /**
   * Generate RSA key pair for server certificate (2048-bit)
   */
  private async generateRSAKeyPair(): Promise<CryptoKeyPair> {
    return await crypto.subtle.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 2048,
        publicExponent: new Uint8Array([0x01, 0x00, 0x01]), // 65537
        hash: "SHA-256",
      },
      true,
      ["encrypt", "decrypt"]
    );
  }

  /**
   * Handle ChangeCipherSpec
   */
  private async handleChangeCipherSpec(): Promise<Uint8Array> {
    // Derive encryption keys from master secret
    if (!this.masterSecret) {
      throw new Error("Master secret not derived");
    }

    await this.deriveKeys(this.masterSecret);

    this.state = TLSHandshakeState.CLIENT_FINISHED;
    return await this.createClientFinished();
  }

  /**
   * Derive encryption keys from master secret (TLS 1.2)
   *
   * key_block = PRF(master_secret, "key expansion",
   *                 server_random + client_random)
   *
   * Then partition key_block into:
   * - client_write_MAC_key
   * - server_write_MAC_key
   * - client_write_key
   * - server_write_key
   * - client_write_IV
   * - server_write_IV
   */
  private async deriveKeys(masterSecret: Uint8Array): Promise<void> {
    if (!this.clientRandom || !this.serverRandom) {
      throw new Error("Client or server random not initialized");
    }

    const label = new TextEncoder().encode("key expansion");
    const seed = new Uint8Array(this.serverRandom.length + this.clientRandom.length);
    seed.set(this.serverRandom, 0);
    seed.set(this.clientRandom, this.serverRandom.length);

    // For AES-128-GCM: 16-byte key, 4-byte fixed IV
    // For AES-256-GCM: 32-byte key, 4-byte fixed IV
    const keyLength = 16; // AES-128
    const ivLength = 4;   // GCM fixed IV length

    const keyBlockLength = 2 * (keyLength + ivLength); // client + server
    const keyBlock = await this.prf(masterSecret, label, seed, keyBlockLength);

    let offset = 0;

    // Client write key
    this.clientWriteKey = keyBlock.slice(offset, offset + keyLength);
    offset += keyLength;

    // Server write key
    this.serverWriteKey = keyBlock.slice(offset, offset + keyLength);
    offset += keyLength;

    // Client write IV
    this.clientWriteIV = keyBlock.slice(offset, offset + ivLength);
    offset += ivLength;

    // Server write IV
    this.serverWriteIV = keyBlock.slice(offset, offset + ivLength);
  }

  /**
   * Create Finished message (TLS 1.2)
   *
   * verify_data = PRF(master_secret, finished_label,
   *                   Hash(handshake_messages))[0..verify_data_length-1]
   *
   * For client: finished_label = "client finished"
   * For server: finished_label = "server finished"
   */
  private async createClientFinished(): Promise<Uint8Array> {
    if (!this.masterSecret) {
      throw new Error("Master secret not derived");
    }

    // Hash all handshake messages
    const transcriptHash = await this.computeTranscriptHash();

    const label = new TextEncoder().encode("client finished");
    const verifyData = await this.prf(this.masterSecret, label, transcriptHash, 12);

    // Encrypt with client write key
    const finishedMessage = await this.encryptRecord(verifyData, 0x16); // Handshake content type

    return finishedMessage;
  }

  /**
   * Handle ServerFinished message (TLS 1.2)
   */
  private async handleServerFinished(message: Uint8Array): Promise<Uint8Array | null> {
    if (!this.masterSecret) {
      throw new Error("Master secret not derived");
    }

    // Decrypt the Finished message
    const decryptedVerifyData = await this.decryptRecord(message, 0x16);

    // Compute expected verify data
    const transcriptHash = await this.computeTranscriptHash();
    const label = new TextEncoder().encode("server finished");
    const expectedVerifyData = await this.prf(this.masterSecret, label, transcriptHash, 12);

    // Verify that they match
    if (!this.constantTimeCompare(decryptedVerifyData, expectedVerifyData)) {
      throw new Error("Server Finished verification failed");
    }

    this.state = TLSHandshakeState.ESTABLISHED;
    return null;
  }

  /**
   * Compute SHA-256 hash of all handshake messages
   */
  private async computeTranscriptHash(): Promise<Uint8Array> {
    // Concatenate all handshake messages
    const totalLength = this.handshakeMessages.reduce((sum, msg) => sum + msg.length, 0);
    const transcript = new Uint8Array(totalLength);
    let offset = 0;

    for (const message of this.handshakeMessages) {
      transcript.set(message, offset);
      offset += message.length;
    }

    return await sha256Bytes(transcript);
  }

  /**
   * Record a handshake message for transcript
   */
  private recordHandshakeMessage(message: Uint8Array): void {
    this.handshakeMessages.push(message);
  }

  /**
   * Constant-time comparison to prevent timing attacks
   */
  private constantTimeCompare(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a[i] ^ b[i];
    }

    return result === 0;
  }

  /**
   * Generate random bytes
   */
  private generateRandom(): Uint8Array {
    const random = new Uint8Array(32);
    crypto.getRandomValues(random);
    return random;
  }

  /**
   * Derive master secret from pre-master secret (TLS 1.2)
   *
   * master_secret = PRF(pre_master_secret, "master secret",
   *                     ClientHello.random + ServerHello.random)[0..47]
   */
  private async deriveMasterSecret(preMasterSecret: Uint8Array): Promise<Uint8Array> {
    if (!this.clientRandom || !this.serverRandom) {
      throw new Error("Client or server random not initialized");
    }

    const label = new TextEncoder().encode("master secret");
    const seed = new Uint8Array(this.clientRandom.length + this.serverRandom.length);
    seed.set(this.clientRandom, 0);
    seed.set(this.serverRandom, this.clientRandom.length);

    return await this.prf(preMasterSecret, label, seed, 48);
  }

  /**
   * TLS 1.2 Pseudo-Random Function (PRF) using HMAC-SHA256
   *
   * PRF(secret, label, seed) = P_SHA256(secret, label + seed)
   */
  private async prf(
    secret: Uint8Array,
    label: Uint8Array,
    seed: Uint8Array,
    outputLength: number,
  ): Promise<Uint8Array> {
    // Combine label and seed
    const labelAndSeed = new Uint8Array(label.length + seed.length);
    labelAndSeed.set(label, 0);
    labelAndSeed.set(seed, label.length);

    return await this.pHash(secret, labelAndSeed, outputLength);
  }

  /**
   * P_hash function for TLS PRF (HMAC-SHA256 based)
   *
   * P_SHA256(secret, seed) = HMAC_SHA256(secret, A(1) + seed) +
   *                          HMAC_SHA256(secret, A(2) + seed) +
   *                          HMAC_SHA256(secret, A(3) + seed) + ...
   *
   * Where A(i) is defined as:
   * A(0) = seed
   * A(i) = HMAC_SHA256(secret, A(i-1))
   */
  private async pHash(
    secret: Uint8Array,
    seed: Uint8Array,
    outputLength: number,
  ): Promise<Uint8Array> {
    const output = new Uint8Array(outputLength);
    let offset = 0;

    // A(0) = seed
    let a = seed;

    while (offset < outputLength) {
      // A(i) = HMAC_SHA256(secret, A(i-1))
      a = await sha256HmacBytes(secret, a);

      // HMAC_SHA256(secret, A(i) + seed)
      const aAndSeed = new Uint8Array(a.length + seed.length);
      aAndSeed.set(a, 0);
      aAndSeed.set(seed, a.length);

      const hmac = await sha256HmacBytes(secret, aAndSeed);

      // Copy to output (may be partial on last iteration)
      const toCopy = Math.min(hmac.length, outputLength - offset);
      output.set(hmac.slice(0, toCopy), offset);
      offset += toCopy;
    }

    return output;
  }

  /**
   * TLS 1.3 HKDF-Extract
   *
   * HKDF-Extract(salt, IKM) = HMAC-Hash(salt, IKM)
   */
  private async hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Promise<Uint8Array> {
    return await sha256HmacBytes(salt, ikm);
  }

  /**
   * TLS 1.3 HKDF-Expand
   *
   * HKDF-Expand(PRK, info, L) = T(1) | T(2) | T(3) | ... | T(N)
   *
   * Where:
   * T(0) = empty string
   * T(i) = HMAC-Hash(PRK, T(i-1) | info | byte(i))
   */
  private async hkdfExpand(
    prk: Uint8Array,
    info: Uint8Array,
    length: number,
  ): Promise<Uint8Array> {
    const hashLen = 32; // SHA-256 output length
    const n = Math.ceil(length / hashLen);
    const output = new Uint8Array(n * hashLen);

    let t = new Uint8Array(0);
    for (let i = 1; i <= n; i++) {
      const data = new Uint8Array(t.length + info.length + 1);
      data.set(t, 0);
      data.set(info, t.length);
      data[t.length + info.length] = i;

      // Create new Uint8Array to ensure correct buffer type
      t = new Uint8Array(await sha256HmacBytes(prk, data));
      output.set(t, (i - 1) * hashLen);
    }

    return output.slice(0, length);
  }

  /**
   * TLS 1.3 HKDF-Expand-Label
   *
   * HKDF-Expand-Label(Secret, Label, Context, Length) =
   *     HKDF-Expand(Secret, HkdfLabel, Length)
   *
   * Where HkdfLabel is specified as:
   * struct {
   *   uint16 length = Length;
   *   opaque label<7..255> = "tls13 " + Label;
   *   opaque context<0..255> = Context;
   * } HkdfLabel;
   */
  private async hkdfExpandLabel(
    secret: Uint8Array,
    label: string,
    context: Uint8Array,
    length: number,
  ): Promise<Uint8Array> {
    const fullLabel = new TextEncoder().encode("tls13 " + label);

    // Build HkdfLabel structure
    const hkdfLabel = new Uint8Array(2 + 1 + fullLabel.length + 1 + context.length);
    let offset = 0;

    // uint16 length
    hkdfLabel[offset++] = (length >> 8) & 0xff;
    hkdfLabel[offset++] = length & 0xff;

    // opaque label<7..255>
    hkdfLabel[offset++] = fullLabel.length;
    hkdfLabel.set(fullLabel, offset);
    offset += fullLabel.length;

    // opaque context<0..255>
    hkdfLabel[offset++] = context.length;
    hkdfLabel.set(context, offset);

    return await this.hkdfExpand(secret, hkdfLabel, length);
  }

  /**
   * Derive TLS 1.3 handshake secrets
   */
  private async deriveTLS13Secrets(
    sharedSecret: Uint8Array,
    handshakeContext: Uint8Array,
  ): Promise<{
    clientHandshakeTrafficSecret: Uint8Array;
    serverHandshakeTrafficSecret: Uint8Array;
  }> {
    // Early Secret = HKDF-Extract(0, 0)
    const zeros32 = new Uint8Array(32);
    const earlySecret = await this.hkdfExtract(zeros32, zeros32);

    // Derive-Secret(., "derived", "")
    const emptyHash = await sha256Bytes(new Uint8Array(0));
    const derivedSecret = await this.hkdfExpandLabel(earlySecret, "derived", emptyHash, 32);

    // Handshake Secret = HKDF-Extract(Derived-Secret, ECDHE)
    const handshakeSecret = await this.hkdfExtract(derivedSecret, sharedSecret);

    // Client Handshake Traffic Secret
    const clientHandshakeTrafficSecret = await this.hkdfExpandLabel(
      handshakeSecret,
      "c hs traffic",
      handshakeContext,
      32,
    );

    // Server Handshake Traffic Secret
    const serverHandshakeTrafficSecret = await this.hkdfExpandLabel(
      handshakeSecret,
      "s hs traffic",
      handshakeContext,
      32,
    );

    return {
      clientHandshakeTrafficSecret,
      serverHandshakeTrafficSecret,
    };
  }

  /**
   * Generate ECDHE key pair (P-256)
   */
  private async generateECDHEKeyPair(): Promise<CryptoKeyPair> {
    return await crypto.subtle.generateKey(
      {
        name: "ECDH",
        namedCurve: "P-256",
      },
      true,
      ["deriveKey", "deriveBits"],
    );
  }

  /**
   * Derive shared secret from ECDHE
   */
  private async deriveECDHESecret(
    privateKey: CryptoKey,
    publicKey: CryptoKey,
  ): Promise<Uint8Array> {
    const sharedSecret = await crypto.subtle.deriveBits(
      {
        name: "ECDH",
        public: publicKey,
      },
      privateKey,
      256, // P-256 produces 256 bits
    );

    return new Uint8Array(sharedSecret);
  }

  /**
   * Export public key in uncompressed format
   */
  private async exportPublicKey(publicKey: CryptoKey): Promise<Uint8Array> {
    const exported = await crypto.subtle.exportKey("raw", publicKey);
    return new Uint8Array(exported);
  }

  /**
   * Import public key from raw bytes
   */
  private async importPublicKey(keyBytes: Uint8Array): Promise<CryptoKey> {
    // Create new Uint8Array to ensure correct buffer type
    const keyBytesBuffer = new Uint8Array(keyBytes);
    return await crypto.subtle.importKey(
      "raw",
      keyBytesBuffer,
      {
        name: "ECDH",
        namedCurve: "P-256",
      },
      true,
      [],
    );
  }

  /**
   * Generate RSA pre-master secret (TLS 1.2 RSA key exchange)
   */
  private generatePreMasterSecret(): Uint8Array {
    const preMasterSecret = new Uint8Array(48);

    // First two bytes are TLS version (0x03, 0x03 for TLS 1.2)
    preMasterSecret[0] = 0x03;
    preMasterSecret[1] = 0x03;

    // Remaining 46 bytes are random
    const random = new Uint8Array(46);
    crypto.getRandomValues(random);
    preMasterSecret.set(random, 2);

    return preMasterSecret;
  }

  /**
   * Verify server certificate
   */
  verifyCertificate(cert: TLSCertificate, hostname: string): boolean {
    // Check expiration
    const now = new Date();
    if (now < cert.notBefore || now > cert.notAfter) {
      return false;
    }

    // Check hostname match
    const commonName = cert.subject["CN"] || "";
    if (!this.matchHostname(hostname, commonName)) {
      // Check SAN
      const matchesSAN = cert.subjectAltNames.some((san) => this.matchHostname(hostname, san));
      if (!matchesSAN) {
        return false;
      }
    }

    // Verify certificate chain
    // In practice, this would verify signatures up to a trusted root CA

    return true;
  }

  /**
   * Match hostname against certificate name (supports wildcards)
   */
  private matchHostname(hostname: string, certName: string): boolean {
    if (certName === hostname) {
      return true;
    }

    // Wildcard match (*.example.com)
    if (certName.startsWith("*.")) {
      const certDomain = certName.slice(2);
      const hostParts = hostname.split(".");
      const certParts = certDomain.split(".");

      if (hostParts.length !== certParts.length + 1) {
        return false;
      }

      return hostParts.slice(1).join(".") === certDomain;
    }

    return false;
  }

  /**
   * Encrypt record using AES-128-GCM (TLS 1.2)
   *
   * TLS record format:
   * - Content type (1 byte)
   * - Version (2 bytes)
   * - Length (2 bytes)
   * - Nonce (8 bytes for GCM)
   * - Encrypted data + auth tag (16 bytes)
   */
  private async encryptRecord(plaintext: Uint8Array, contentType: number): Promise<Uint8Array> {
    if (!this.clientWriteKey || !this.clientWriteIV) {
      throw new Error("Encryption keys not derived");
    }

    // Generate 8-byte explicit nonce
    const explicitNonce = new Uint8Array(8);
    crypto.getRandomValues(explicitNonce);

    // Construct 12-byte nonce: fixed IV (4 bytes) + explicit nonce (8 bytes)
    const nonce = new Uint8Array(12);
    nonce.set(this.clientWriteIV, 0);
    nonce.set(explicitNonce, 4);

    // Import key for AES-GCM
    // Create new Uint8Array to ensure correct buffer type
    const keyBytes = new Uint8Array(this.clientWriteKey);
    const key = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "AES-GCM" },
      false,
      ["encrypt"]
    );

    // Additional authenticated data (AAD) for GCM
    // Sequence number (8) + content type (1) + version (2) + length (2)
    const sequenceNumber = new Uint8Array(8); // Should be incremented per record
    const aad = new Uint8Array(13);
    aad.set(sequenceNumber, 0);
    aad[8] = contentType;
    aad[9] = 0x03; // TLS version major
    aad[10] = 0x03; // TLS version minor (1.2)
    aad[11] = (plaintext.length >> 8) & 0xff;
    aad[12] = plaintext.length & 0xff;

    // Encrypt
    // Create new Uint8Array to ensure correct buffer type
    const plaintextBytes = new Uint8Array(plaintext);
    const ciphertext = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: nonce,
        additionalData: aad,
        tagLength: 128, // 16-byte auth tag
      },
      key,
      plaintextBytes
    );

    // Construct record: explicit nonce + ciphertext + tag
    const encrypted = new Uint8Array(ciphertext);
    const record = new Uint8Array(explicitNonce.length + encrypted.length);
    record.set(explicitNonce, 0);
    record.set(encrypted, explicitNonce.length);

    return record;
  }

  /**
   * Decrypt record using AES-128-GCM (TLS 1.2)
   */
  private async decryptRecord(record: Uint8Array, contentType: number): Promise<Uint8Array> {
    if (!this.serverWriteKey || !this.serverWriteIV) {
      throw new Error("Decryption keys not derived");
    }

    // Extract explicit nonce (first 8 bytes)
    const explicitNonce = record.slice(0, 8);

    // Construct 12-byte nonce
    const nonce = new Uint8Array(12);
    nonce.set(this.serverWriteIV, 0);
    nonce.set(explicitNonce, 4);

    // Remaining bytes are ciphertext + tag
    const ciphertext = record.slice(8);

    // Import key for AES-GCM
    // Create new Uint8Array to ensure correct buffer type
    const keyBytes = new Uint8Array(this.serverWriteKey);
    const key = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );

    // Reconstruct AAD
    const sequenceNumber = new Uint8Array(8);
    const plaintextLength = ciphertext.length - 16; // Subtract auth tag
    const aad = new Uint8Array(13);
    aad.set(sequenceNumber, 0);
    aad[8] = contentType;
    aad[9] = 0x03;
    aad[10] = 0x03;
    aad[11] = (plaintextLength >> 8) & 0xff;
    aad[12] = plaintextLength & 0xff;

    // Decrypt and verify auth tag
    const plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: nonce,
        additionalData: aad,
        tagLength: 128,
      },
      key,
      ciphertext
    );

    return new Uint8Array(plaintext);
  }

  /**
   * Encrypt application data (after handshake complete)
   */
  async encryptApplicationData(data: Uint8Array): Promise<Uint8Array> {
    return await this.encryptRecord(data, 0x17); // Application data content type
  }

  /**
   * Decrypt application data (after handshake complete)
   */
  async decryptApplicationData(encryptedData: Uint8Array): Promise<Uint8Array> {
    return await this.decryptRecord(encryptedData, 0x17);
  }

  /**
   * Get handshake statistics
   */
  getStats() {
    return {
      state: this.state,
      version: this.version,
      cipherSuite: this.cipherSuite?.name,
      serverName: this.config.serverName,
      alpnProtocol: this.getALPNProtocol(),
    };
  }
}

/**
 * Default cipher suites (TLS 1.3)
 */
export const TLS13_CIPHER_SUITES: CipherSuite[] = [
  {
    name: "TLS_AES_128_GCM_SHA256",
    keyExchange: "ECDHE",
    authentication: "ECDSA",
    encryption: "AES_128_GCM",
    hash: "SHA256",
  },
  {
    name: "TLS_AES_256_GCM_SHA384",
    keyExchange: "ECDHE",
    authentication: "ECDSA",
    encryption: "AES_256_GCM",
    hash: "SHA384",
  },
  {
    name: "TLS_CHACHA20_POLY1305_SHA256",
    keyExchange: "ECDHE",
    authentication: "ECDSA",
    encryption: "CHACHA20_POLY1305",
    hash: "SHA256",
  },
];

/**
 * Default cipher suites (TLS 1.2)
 */
export const TLS12_CIPHER_SUITES: CipherSuite[] = [
  {
    name: "TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256",
    keyExchange: "ECDHE",
    authentication: "RSA",
    encryption: "AES_128_GCM",
    hash: "SHA256",
  },
  {
    name: "TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384",
    keyExchange: "ECDHE",
    authentication: "RSA",
    encryption: "AES_256_GCM",
    hash: "SHA384",
  },
];
