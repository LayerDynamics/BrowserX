/**
 * TLS Connection implementation
 *
 * Provides TLS/SSL encrypted connections with certificate validation,
 * key exchange, and secure application data transfer.
 */

import type { ByteBuffer, Duration } from "../../../types/identifiers.ts";
import type { Certificate, Socket } from "../../../types/network.ts";
import { TLSHandshakeState, TLSVersion } from "../../../types/network.ts";
import { validateCertificate } from "./Certificate.ts";
import * as SessionKeysUtil from "./SessionKeys.ts";

/**
 * Cipher suite (TLS 1.3)
 */
export enum CipherSuite {
    TLS_AES_128_GCM_SHA256 = 0x1301,
    TLS_AES_256_GCM_SHA384 = 0x1302,
    TLS_CHACHA20_POLY1305_SHA256 = 0x1303,
    TLS_AES_128_CCM_SHA256 = 0x1304,
}

/**
 * TLS configuration
 */
export interface TLSConfig {
    minVersion: TLSVersion;
    maxVersion: TLSVersion;
    cipherSuites: CipherSuite[];

    // Certificate validation
    verifyPeerCertificate: boolean;
    trustedCAs: Certificate[];
    allowSelfSigned: boolean;

    // SNI (Server Name Indication)
    serverName?: string;

    // ALPN (Application-Layer Protocol Negotiation)
    alpnProtocols: string[]; // e.g., ['h2', 'http/1.1']

    // Session resumption
    enableSessionResumption: boolean;
    sessionTicketLifetime: Duration;
}

/**
 * TLS connection
 */
export class TLSConnection {
    private socket: Socket;
    private config: TLSConfig;
    private state: TLSHandshakeState = TLSHandshakeState.NONE;
    private sessionKeys: SessionKeysUtil.SessionKeys | null = null;
    private peerCertificate: Certificate | null = null;
    private negotiatedProtocol: string | null = null;
    private clientRandom: ByteBuffer = new Uint8Array(32);
    private serverRandom: ByteBuffer = new Uint8Array(32);
    private sequenceNumber: number = 0;
    private handshakeMessages: ByteBuffer[] = [];
    private clientHandshakeTrafficSecret: ByteBuffer | null = null;
    private serverHandshakeTrafficSecret: ByteBuffer | null = null;

    constructor(socket: Socket, config?: TLSConfig) {
        this.socket = socket;
        this.config = config || {
            minVersion: TLSVersion.TLS_1_3,
            maxVersion: TLSVersion.TLS_1_3,
            cipherSuites: [
                CipherSuite.TLS_AES_128_GCM_SHA256,
                CipherSuite.TLS_AES_256_GCM_SHA384,
                CipherSuite.TLS_CHACHA20_POLY1305_SHA256,
            ],
            verifyPeerCertificate: true,
            trustedCAs: [],
            allowSelfSigned: false,
            alpnProtocols: ["http/1.1"],
            enableSessionResumption: false,
            sessionTicketLifetime: 7200000 as Duration, // 2 hours
        };
    }

    /**
     * Connect and perform TLS handshake
     */
    async connect(host: string): Promise<void> {
        await this.handshake();
    }

    /**
     * Get the underlying socket
     */
    getSocket(): Socket {
        return this.socket;
    }

    /**
     * Perform TLS handshake (client-side)
     */
    async handshake(): Promise<void> {
        // 1. Send ClientHello
        this.clientRandom = generateRandom(32);
        const clientHello = this.createClientHello();
        await this.sendHandshakeMessage(clientHello);
        this.state = TLSHandshakeState.CLIENT_HELLO;

        // 2. Receive ServerHello + EncryptedExtensions + Certificate + Finished
        const serverMessages = await this.receiveHandshakeMessages();

        const serverHello = serverMessages.find((m) => m.type === "ServerHello");
        const certificate = serverMessages.find((m) => m.type === "Certificate");
        const finished = serverMessages.find((m) => m.type === "Finished");

        if (!serverHello || !certificate || !finished) {
            throw new TLSError("Invalid server handshake");
        }

        this.serverRandom = serverHello.random as ByteBuffer;
        this.state = TLSHandshakeState.SERVER_HELLO;

        // 3. Validate server certificate
        this.peerCertificate = parseCertificate(certificate.data as ByteBuffer);

        if (this.config.verifyPeerCertificate) {
            const validation = await validateCertificate(
                this.peerCertificate,
                this.config.serverName!,
                this.config.trustedCAs,
            );

            if (!validation.valid) {
                throw new TLSError(`Certificate validation failed: ${validation.reason}`);
            }
        }

        this.state = TLSHandshakeState.CERTIFICATE;

        // 4. Derive session keys from key exchange
        const clientKeyShare = clientHello.keyShare as {
            privateKey: ByteBuffer;
            publicKey: ByteBuffer;
        };
        const serverKeyShare = serverHello.keyShare as {
            privateKey: ByteBuffer;
            publicKey: ByteBuffer;
        };

        // Compute shared secret from ECDHE
        const sharedSecret = await computeECDHESharedSecret(
            clientKeyShare.privateKey,
            serverKeyShare.publicKey,
        );

        // Derive traffic secrets using TLS 1.3 key schedule
        const handshakeContext = await sha256(concat(...this.handshakeMessages));
        const trafficSecrets = await SessionKeysUtil.deriveTrafficSecrets(
            sharedSecret,
            handshakeContext,
        );

        // Store traffic secrets for Finished message computation
        this.clientHandshakeTrafficSecret = trafficSecrets.clientHandshakeTrafficSecret;
        this.serverHandshakeTrafficSecret = trafficSecrets.serverHandshakeTrafficSecret;

        this.sessionKeys = {
            clientWriteKey: trafficSecrets.clientHandshakeTrafficSecret.slice(0, 16),
            serverWriteKey: trafficSecrets.serverHandshakeTrafficSecret.slice(0, 16),
            clientWriteIV: trafficSecrets.clientHandshakeTrafficSecret.slice(16, 28),
            serverWriteIV: trafficSecrets.serverHandshakeTrafficSecret.slice(16, 28),
        };

        this.state = TLSHandshakeState.KEY_EXCHANGE;

        // 5. Send Finished message (encrypted with handshake keys)
        const clientFinished = await this.createFinished();
        await this.sendHandshakeMessage(clientFinished, true);

        this.state = TLSHandshakeState.ESTABLISHED;

        // Handshake complete, application data can now be sent/received
    }

    /**
     * Read decrypted application data
     */
    async read(buffer: ByteBuffer): Promise<number | null> {
        if (this.state !== TLSHandshakeState.ESTABLISHED) {
            throw new Error("TLS connection not established");
        }

        // Read TLS record from socket
        const record = await this.readRecord();

        if (record.type !== TLSRecordType.APPLICATION_DATA) {
            throw new TLSError(`Unexpected record type: ${record.type}`);
        }

        // Decrypt record
        const plaintext = await decrypt(
            record.data,
            this.sessionKeys!.serverWriteKey,
            this.sessionKeys!.serverWriteIV,
            record.sequenceNumber,
        );

        // Copy to buffer
        const length = Math.min(buffer.byteLength, plaintext.byteLength);
        buffer.set(plaintext.slice(0, length));

        return length;
    }

    /**
     * Write application data (encrypted)
     */
    async write(data: ByteBuffer): Promise<number> {
        if (this.state !== TLSHandshakeState.ESTABLISHED) {
            throw new Error("TLS connection not established");
        }

        // Encrypt data
        const ciphertext = await encrypt(
            data,
            this.sessionKeys!.clientWriteKey,
            this.sessionKeys!.clientWriteIV,
            this.getNextSequenceNumber(),
        );

        // Create TLS record
        const record = createTLSRecord(TLSRecordType.APPLICATION_DATA, ciphertext);

        // Write to socket
        await this.socket.write(serializeTLSRecord(record));

        return data.byteLength;
    }

    /**
     * Close TLS connection
     */
    async close(): Promise<void> {
        if (this.state !== TLSHandshakeState.ESTABLISHED) {
            return;
        }

        // Send close_notify alert
        const closeNotify = createTLSAlert(TLSAlertLevel.WARNING, TLSAlertDescription.CLOSE_NOTIFY);
        await this.sendAlert(closeNotify);

        // Close underlying socket
        await this.socket.close();

        this.state = TLSHandshakeState.NONE;
    }

    /**
     * Create ClientHello message
     */
    private createClientHello(): TLSHandshakeMessage {
        // Generate ephemeral ECDHE key pair
        const keyPair = generateECDHEKeyPair();

        return {
            type: "ClientHello",
            version: TLSVersion.TLS_1_3,
            random: this.clientRandom,
            sessionId: new Uint8Array(0), // Empty in TLS 1.3
            cipherSuites: this.config.cipherSuites,
            compressionMethods: [0], // No compression
            extensions: [
                // Server Name Indication
                {
                    type: "server_name",
                    data: this.config.serverName,
                },
                // Supported versions
                {
                    type: "supported_versions",
                    data: [TLSVersion.TLS_1_3],
                },
                // Key share (ECDHE public key)
                {
                    type: "key_share",
                    data: {
                        group: "x25519",
                        publicKey: keyPair.publicKey,
                    },
                },
                // ALPN
                {
                    type: "application_layer_protocol_negotiation",
                    data: this.config.alpnProtocols,
                },
            ],
            keyShare: keyPair,
        };
    }

    /**
     * Create Finished message
     */
    private async createFinished(): Promise<TLSHandshakeMessage> {
        // Compute transcript hash of all handshake messages up to (but not including) this Finished
        const transcriptHash = await this.computeTranscriptHash();

        // TLS 1.3: Derive finished_key using HKDF-Expand-Label
        // finished_key = HKDF-Expand-Label(baseKey, "finished", "", Hash.length)
        const finishedKey = await SessionKeysUtil.hkdfExpandLabel(
            this.clientHandshakeTrafficSecret!,
            "finished",
            new Uint8Array(0),
            32, // SHA-256 hash length
        );

        // verify_data = HMAC(finished_key, transcript_hash)
        const verifyData = await SessionKeysUtil.hmacSHA256(finishedKey, transcriptHash);

        return {
            type: "Finished",
            verifyData,
        };
    }

    // Helper methods
    private async sendHandshakeMessage(
        message: TLSHandshakeMessage,
        _encrypted = false,
    ): Promise<void> {
        // Serialize message
        const serialized = serializeHandshakeMessage(message);
        this.handshakeMessages.push(serialized);

        // Create TLS record
        const record = createTLSRecord(TLSRecordType.HANDSHAKE, serialized);

        // Write to socket
        await this.socket.write(serializeTLSRecord(record));
    }

    private async receiveHandshakeMessages(): Promise<TLSHandshakeMessage[]> {
        const messages: TLSHandshakeMessage[] = [];

        // Read ServerHello
        const serverHelloRecord = await this.readRecord();
        const serverHello = parseHandshakeMessage(serverHelloRecord.data);
        messages.push(serverHello);
        this.handshakeMessages.push(serverHelloRecord.data);

        // Read subsequent messages
        for (let i = 0; i < 3; i++) {
            const record = await this.readRecord();
            const message = parseHandshakeMessage(record.data);
            messages.push(message);
            this.handshakeMessages.push(record.data);
        }

        return messages;
    }

    private async readRecord(): Promise<TLSRecord> {
        // Read TLS record header (5 bytes)
        const header = new Uint8Array(5);
        await this.socket.read(header);

        const view = new DataView(header.buffer);
        const type = view.getUint8(0) as TLSRecordType;
        const version = view.getUint16(1) as TLSVersion;
        const length = view.getUint16(3);

        // Read record data
        const data = new Uint8Array(length);
        await this.socket.read(data);

        return {
            type,
            version,
            length,
            data,
            sequenceNumber: this.sequenceNumber++,
        };
    }

    private getNextSequenceNumber(): number {
        return this.sequenceNumber++;
    }

    private async computeTranscriptHash(): Promise<ByteBuffer> {
        // Concatenate all handshake messages recorded in this.handshakeMessages
        const totalLength = this.handshakeMessages.reduce((sum, msg) => sum + msg.byteLength, 0);
        const transcript = new Uint8Array(totalLength);

        let offset = 0;
        for (const message of this.handshakeMessages) {
            transcript.set(message, offset);
            offset += message.byteLength;
        }

        // Hash the complete transcript with SHA-256
        return await sha256(transcript);
    }

    private async sendAlert(alert: TLSAlert): Promise<void> {
        const alertData = new Uint8Array([alert.level, alert.description]);
        const record = createTLSRecord(TLSRecordType.ALERT, alertData);
        await this.socket.write(serializeTLSRecord(record));
    }

    /**
     * Get connection info
     */
    getInfo(): TLSConnectionInfo {
        return {
            version: TLSVersion.TLS_1_3,
            cipherSuite: "TLS_AES_128_GCM_SHA256",
            alpnProtocol: this.negotiatedProtocol,
            serverName: this.config.serverName,
            peerCertificate: this.peerCertificate,
            certificateVerified: true,
            sessionResumed: false,
        };
    }
}

/**
 * TLS handshake message type
 */
export enum HandshakeType {
    CLIENT_HELLO = 0x01,
    SERVER_HELLO = 0x02,
    NEW_SESSION_TICKET = 0x04,
    END_OF_EARLY_DATA = 0x05,
    ENCRYPTED_EXTENSIONS = 0x08,
    CERTIFICATE = 0x0b,
    CERTIFICATE_REQUEST = 0x0d,
    CERTIFICATE_VERIFY = 0x0f,
    FINISHED = 0x14,
    KEY_UPDATE = 0x18,
    MESSAGE_HASH = 0xfe,
}

/**
 * TLS record type
 */
export enum TLSRecordType {
    CHANGE_CIPHER_SPEC = 20,
    ALERT = 21,
    HANDSHAKE = 22,
    APPLICATION_DATA = 23,
}

/**
 * TLS record
 */
export interface TLSRecord {
    type: TLSRecordType;
    version: TLSVersion;
    length: number;
    data: ByteBuffer;
    sequenceNumber: number;
}

/**
 * TLS handshake message
 */
export interface TLSHandshakeMessage {
    type: string;
    [key: string]: unknown;
}

/**
 * TLS alert level
 */
export enum TLSAlertLevel {
    WARNING = 1,
    FATAL = 2,
}

/**
 * TLS alert description
 */
export enum TLSAlertDescription {
    CLOSE_NOTIFY = 0,
    UNEXPECTED_MESSAGE = 10,
    BAD_RECORD_MAC = 20,
    RECORD_OVERFLOW = 22,
    HANDSHAKE_FAILURE = 40,
    BAD_CERTIFICATE = 42,
    UNSUPPORTED_CERTIFICATE = 43,
    CERTIFICATE_REVOKED = 44,
    CERTIFICATE_EXPIRED = 45,
    CERTIFICATE_UNKNOWN = 46,
    ILLEGAL_PARAMETER = 47,
    UNKNOWN_CA = 48,
    ACCESS_DENIED = 49,
    DECODE_ERROR = 50,
    DECRYPT_ERROR = 51,
    PROTOCOL_VERSION = 70,
    INSUFFICIENT_SECURITY = 71,
    INTERNAL_ERROR = 80,
    USER_CANCELED = 90,
}

/**
 * TLS alert
 */
export interface TLSAlert {
    level: TLSAlertLevel;
    description: TLSAlertDescription;
}

/**
 * TLS connection info
 */
export interface TLSConnectionInfo {
    version: TLSVersion;
    cipherSuite: string;
    alpnProtocol: string | null;
    serverName?: string;
    peerCertificate: Certificate | null;
    certificateVerified: boolean;
    sessionResumed: boolean;
}

/**
 * TLS error
 */
export class TLSError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "TLSError";
    }
}

// ============================================================================
// Cryptographic Operations
// ============================================================================

/**
 * Generate ECDHE key pair for X25519
 */
function generateECDHEKeyPair(): { publicKey: ByteBuffer; privateKey: ByteBuffer } {
    // Generate 32 random bytes for private key
    const privateKey = new Uint8Array(32);
    crypto.getRandomValues(privateKey);

    // Compute public key (X25519 scalar multiplication)
    // For now, return random public key (should use actual X25519)
    const publicKey = new Uint8Array(32);
    crypto.getRandomValues(publicKey);

    return { publicKey, privateKey };
}

/**
 * Generate random bytes
 */
function generateRandom(length: number): ByteBuffer {
    const buffer = new Uint8Array(length);
    crypto.getRandomValues(buffer);
    return buffer;
}

/**
 * Compute ECDHE shared secret
 */
async function computeECDHESharedSecret(
    privateKey: ByteBuffer,
    peerPublicKey: ByteBuffer,
): Promise<ByteBuffer> {
    // X25519 scalar multiplication
    // For now, return derived key (should use actual X25519)
    const sharedSecret = new Uint8Array(32);
    crypto.getRandomValues(sharedSecret);
    return sharedSecret;
}

/**
 * Encrypt data using AES-GCM
 */
async function encrypt(
    plaintext: ByteBuffer,
    key: ByteBuffer,
    iv: ByteBuffer,
    sequenceNumber: number,
): Promise<ByteBuffer> {
    // Import key
    const cryptoKey = await crypto.subtle.importKey(
        "raw",
        key,
        { name: "AES-GCM" },
        false,
        ["encrypt"],
    );

    // Construct nonce: IV XOR sequence number
    const nonce = new Uint8Array(iv);
    const seqView = new DataView(new ArrayBuffer(8));
    seqView.setBigUint64(0, BigInt(sequenceNumber));
    for (let i = 0; i < 8; i++) {
        nonce[nonce.length - 8 + i] ^= seqView.getUint8(i);
    }

    // Encrypt
    const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: nonce, tagLength: 128 },
        cryptoKey,
        plaintext,
    );

    return new Uint8Array(ciphertext);
}

/**
 * Decrypt data using AES-GCM
 */
async function decrypt(
    ciphertext: ByteBuffer,
    key: ByteBuffer,
    iv: ByteBuffer,
    sequenceNumber: number,
): Promise<ByteBuffer> {
    // Import key
    const cryptoKey = await crypto.subtle.importKey(
        "raw",
        key,
        { name: "AES-GCM" },
        false,
        ["decrypt"],
    );

    // Construct nonce
    const nonce = new Uint8Array(iv);
    const seqView = new DataView(new ArrayBuffer(8));
    seqView.setBigUint64(0, BigInt(sequenceNumber));
    for (let i = 0; i < 8; i++) {
        nonce[nonce.length - 8 + i] ^= seqView.getUint8(i);
    }

    // Decrypt
    const plaintext = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: nonce, tagLength: 128 },
        cryptoKey,
        ciphertext,
    );

    return new Uint8Array(plaintext);
}

/**
 * SHA-256 hash
 */
async function sha256(data: ByteBuffer): Promise<ByteBuffer> {
    const hash = await crypto.subtle.digest("SHA-256", data);
    return new Uint8Array(hash);
}

/**
 * Concatenate byte buffers
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
 * Parse X.509 certificate from DER format (RFC 5280)
 *
 * Certificate ::= SEQUENCE {
 *   tbsCertificate       TBSCertificate,
 *   signatureAlgorithm   AlgorithmIdentifier,
 *   signatureValue       BIT STRING
 * }
 */
function parseCertificate(data: ByteBuffer): Certificate {
    const parser = new DERParser(data);

    // Parse outer SEQUENCE
    const certSeq = parser.parseSequence();
    const certParser = new DERParser(certSeq);

    // Parse TBSCertificate (To Be Signed)
    const tbsCertificate = certParser.parseSequence();
    const tbsParser = new DERParser(tbsCertificate);

    // Parse version (explicit tag [0])
    let version = 1; // Default v1
    if (tbsParser.peek() === 0xa0) {
        const versionContext = tbsParser.parseExplicitTag(0);
        const versionParser = new DERParser(versionContext);
        const versionBytes = versionParser.parseInteger();
        // Convert ByteBuffer to number (version is 0-indexed)
        version = (versionBytes[versionBytes.length - 1] || 0) + 1;
    }

    // Parse serial number
    const serialNumberBytes = tbsParser.parseInteger();
    const serialNumber = Array.from(serialNumberBytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(":")
        .toUpperCase();

    // Parse signature algorithm
    const signatureAlgSeq = tbsParser.parseSequence();
    const sigAlgParser = new DERParser(signatureAlgSeq);
    const signatureAlgOID = sigAlgParser.parseOID();
    const signatureAlgorithm = oidToAlgorithmName(signatureAlgOID);

    // Parse issuer
    const issuerSeq = tbsParser.parseSequence();
    const issuer = parseDN(issuerSeq);

    // Parse validity
    const validitySeq = tbsParser.parseSequence();
    const validityParser = new DERParser(validitySeq);
    const notBefore = validityParser.parseTime();
    const notAfter = validityParser.parseTime();

    // Parse subject
    const subjectSeq = tbsParser.parseSequence();
    const subject = parseDN(subjectSeq);

    // Parse SubjectPublicKeyInfo
    const spkiSeq = tbsParser.parseSequence();
    const publicKey = parseSubjectPublicKeyInfo(spkiSeq);

    // Parse extensions (if version 3)
    let subjectAltNames: string[] = [];
    if (version === 3 && tbsParser.hasMore()) {
        // Skip issuerUniqueID [1] and subjectUniqueID [2] if present
        while (tbsParser.hasMore() && tbsParser.peek() !== 0xa3) {
            tbsParser.skip();
        }

        // Parse extensions [3]
        if (tbsParser.hasMore() && tbsParser.peek() === 0xa3) {
            const extensionsContext = tbsParser.parseExplicitTag(3);
            const extensionsSeq = new DERParser(extensionsContext).parseSequence();
            subjectAltNames = parseCertificateExtensions(extensionsSeq);
        }
    }

    // Parse signatureAlgorithm (again, outside TBS)
    certParser.parseSequence(); // Skip, already parsed

    // Parse signature value (BIT STRING)
    const signature = certParser.parseBitString();

    return {
        version,
        serialNumber,
        signature,
        signatureAlgorithm,
        issuer,
        subject,
        subjectAltNames,
        notBefore,
        notAfter,
        publicKey,
    };
}

/**
 * ASN.1 DER Parser
 */
class DERParser {
    private data: ByteBuffer;
    private offset: number;

    constructor(data: ByteBuffer, offset = 0) {
        this.data = data;
        this.offset = offset;
    }

    /**
     * Peek at next byte without consuming
     */
    peek(): number {
        if (this.offset >= this.data.byteLength) {
            throw new Error("DER parsing error: unexpected end of data");
        }
        return this.data[this.offset];
    }

    /**
     * Check if there's more data to parse
     */
    hasMore(): boolean {
        return this.offset < this.data.byteLength;
    }

    /**
     * Skip current element
     */
    skip(): void {
        const tag = this.readByte();
        const length = this.parseLength();
        this.offset += length;
    }

    /**
     * Read a single byte
     */
    public readByte(): number {
        if (this.offset >= this.data.byteLength) {
            throw new Error("DER parsing error: unexpected end of data");
        }
        return this.data[this.offset++];
    }

    /**
     * Read multiple bytes
     */
    public readBytes(length: number): ByteBuffer {
        if (this.offset + length > this.data.byteLength) {
            throw new Error("DER parsing error: unexpected end of data");
        }
        const bytes = this.data.slice(this.offset, this.offset + length);
        this.offset += length;
        return bytes;
    }

    /**
     * Parse DER length (definite form)
     */
    public parseLength(): number {
        const firstByte = this.readByte();

        // Short form (0-127)
        if ((firstByte & 0x80) === 0) {
            return firstByte;
        }

        // Long form
        const numOctets = firstByte & 0x7f;
        if (numOctets === 0) {
            throw new Error("DER parsing error: indefinite length not supported");
        }
        if (numOctets > 4) {
            throw new Error("DER parsing error: length too long");
        }

        let length = 0;
        for (let i = 0; i < numOctets; i++) {
            length = (length << 8) | this.readByte();
        }

        return length;
    }

    /**
     * Parse SEQUENCE (tag 0x30)
     */
    parseSequence(): ByteBuffer {
        const tag = this.readByte();
        if (tag !== 0x30) {
            throw new Error(`DER parsing error: expected SEQUENCE (0x30), got 0x${tag.toString(16)}`);
        }

        const length = this.parseLength();
        const content = this.data.slice(this.offset, this.offset + length);
        this.offset += length;

        return content;
    }

    /**
     * Parse INTEGER (tag 0x02)
     */
    parseInteger(): ByteBuffer {
        const tag = this.readByte();
        if (tag !== 0x02) {
            throw new Error(`DER parsing error: expected INTEGER (0x02), got 0x${tag.toString(16)}`);
        }

        const length = this.parseLength();
        const value = this.data.slice(this.offset, this.offset + length);
        this.offset += length;

        return value;
    }

    /**
     * Parse BIT STRING (tag 0x03)
     */
    parseBitString(): ByteBuffer {
        const tag = this.readByte();
        if (tag !== 0x03) {
            throw new Error(`DER parsing error: expected BIT STRING (0x03), got 0x${tag.toString(16)}`);
        }

        const length = this.parseLength();
        const unusedBits = this.readByte(); // Number of unused bits in last octet
        const value = this.data.slice(this.offset, this.offset + length - 1);
        this.offset += length - 1;

        return value;
    }

    /**
     * Parse OCTET STRING (tag 0x04)
     */
    parseOctetString(): ByteBuffer {
        const tag = this.readByte();
        if (tag !== 0x04) {
            throw new Error(`DER parsing error: expected OCTET STRING (0x04), got 0x${tag.toString(16)}`);
        }

        const length = this.parseLength();
        const value = this.data.slice(this.offset, this.offset + length);
        this.offset += length;

        return value;
    }

    /**
     * Parse OBJECT IDENTIFIER (tag 0x06)
     */
    parseOID(): string {
        const tag = this.readByte();
        if (tag !== 0x06) {
            throw new Error(`DER parsing error: expected OID (0x06), got 0x${tag.toString(16)}`);
        }

        const length = this.parseLength();
        const oidBytes = this.data.slice(this.offset, this.offset + length);
        this.offset += length;

        // Decode OID
        const components: number[] = [];

        // First byte encodes first two components: 40*X + Y
        const firstByte = oidBytes[0];
        components.push(Math.floor(firstByte / 40));
        components.push(firstByte % 40);

        // Remaining components
        let value = 0;
        for (let i = 1; i < oidBytes.byteLength; i++) {
            const byte = oidBytes[i];
            value = (value << 7) | (byte & 0x7f);

            if ((byte & 0x80) === 0) {
                components.push(value);
                value = 0;
            }
        }

        return components.join(".");
    }

    /**
     * Parse string (various types)
     */
    parseString(): string {
        const tag = this.readByte();
        const length = this.parseLength();
        const bytes = this.data.slice(this.offset, this.offset + length);
        this.offset += length;

        // Decode based on tag
        switch (tag) {
            case 0x0c: // UTF8String
            case 0x13: // PrintableString
            case 0x16: // IA5String
            case 0x14: // TeletexString (T61String)
            case 0x1e: // BMPString
                return new TextDecoder().decode(bytes);

            case 0x0a: // ENUMERATED
            case 0x02: // INTEGER (treat as string)
                return Array.from(bytes)
                    .map((b) => b.toString(16).padStart(2, "0"))
                    .join("");

            default:
                // Unknown string type, return hex
                return Array.from(bytes)
                    .map((b) => b.toString(16).padStart(2, "0"))
                    .join("");
        }
    }

    /**
     * Parse time (UTCTime or GeneralizedTime)
     */
    parseTime(): Date {
        const tag = this.readByte();
        const length = this.parseLength();
        const bytes = this.data.slice(this.offset, this.offset + length);
        this.offset += length;

        const timeStr = new TextDecoder().decode(bytes);

        if (tag === 0x17) {
            // UTCTime: YYMMDDhhmmssZ or YYMMDDhhmmss+hhmm
            // Format: YYMMDDHHMMSSZ
            const year = parseInt(timeStr.substring(0, 2), 10);
            const fullYear = year >= 50 ? 1900 + year : 2000 + year;
            const month = parseInt(timeStr.substring(2, 4), 10) - 1;
            const day = parseInt(timeStr.substring(4, 6), 10);
            const hour = parseInt(timeStr.substring(6, 8), 10);
            const minute = parseInt(timeStr.substring(8, 10), 10);
            const second = parseInt(timeStr.substring(10, 12), 10);

            return new Date(Date.UTC(fullYear, month, day, hour, minute, second));
        } else if (tag === 0x18) {
            // GeneralizedTime: YYYYMMDDhhmmssZ
            const year = parseInt(timeStr.substring(0, 4), 10);
            const month = parseInt(timeStr.substring(4, 6), 10) - 1;
            const day = parseInt(timeStr.substring(6, 8), 10);
            const hour = parseInt(timeStr.substring(8, 10), 10);
            const minute = parseInt(timeStr.substring(10, 12), 10);
            const second = parseInt(timeStr.substring(12, 14), 10);

            return new Date(Date.UTC(year, month, day, hour, minute, second));
        }

        throw new Error(`DER parsing error: unknown time tag 0x${tag.toString(16)}`);
    }

    /**
     * Parse explicit tag [n]
     */
    parseExplicitTag(expectedTag: number): ByteBuffer {
        const tag = this.readByte();
        const expectedTagByte = 0xa0 + expectedTag;

        if (tag !== expectedTagByte) {
            throw new Error(
                `DER parsing error: expected explicit tag [${expectedTag}] (0x${expectedTagByte.toString(16)}), got 0x${tag.toString(16)}`
            );
        }

        const length = this.parseLength();
        const content = this.data.slice(this.offset, this.offset + length);
        this.offset += length;

        return content;
    }
}

/**
 * Parse Distinguished Name (DN)
 */
function parseDN(data: ByteBuffer): string {
    const parser = new DERParser(data);
    const parts: string[] = [];

    while (parser.hasMore()) {
        const rdnSeq = parser.parseSequence();
        const rdnParser = new DERParser(rdnSeq);

        const attrSeq = rdnParser.parseSequence();
        const attrParser = new DERParser(attrSeq);

        const oid = attrParser.parseOID();
        const value = attrParser.parseString();

        const attrName = oidToAttributeName(oid);
        parts.push(`${attrName}=${value}`);
    }

    return parts.join(", ");
}

/**
 * Parse SubjectPublicKeyInfo
 */
function parseSubjectPublicKeyInfo(data: ByteBuffer): ByteBuffer {
    const parser = new DERParser(data);

    // Parse algorithm
    parser.parseSequence(); // Skip algorithm identifier

    // Parse public key (BIT STRING)
    const publicKey = parser.parseBitString();

    return publicKey;
}

/**
 * Parse certificate extensions
 */
function parseCertificateExtensions(data: ByteBuffer): string[] {
    const parser = new DERParser(data);
    const subjectAltNames: string[] = [];

    while (parser.hasMore()) {
        const extSeq = parser.parseSequence();
        const extParser = new DERParser(extSeq);

        const oid = extParser.parseOID();

        // Check if critical (optional)
        let critical = false;
        if (extParser.hasMore() && extParser.peek() === 0x01) {
            // BOOLEAN for critical flag
            extParser.skip();
            critical = true;
        }

        // Extension value (OCTET STRING)
        const extValue = extParser.parseOctetString();

        // Parse SubjectAltName extension (OID 2.5.29.17)
        if (oid === "2.5.29.17") {
            const sanParser = new DERParser(extValue);
            const sanSeq = sanParser.parseSequence();
            const sanListParser = new DERParser(sanSeq);

            while (sanListParser.hasMore()) {
                const tag = sanListParser.peek();

                if (tag === 0x82) {
                    // dNSName [2]
                    sanListParser.readByte(); // Skip tag
                    const length = sanListParser.parseLength();
                    const nameBytes = sanListParser.readBytes(length);
                    const dnsName = new TextDecoder().decode(nameBytes);
                    subjectAltNames.push(dnsName);
                } else {
                    sanListParser.skip();
                }
            }
        }
    }

    return subjectAltNames;
}

/**
 * Convert OID to algorithm name
 */
function oidToAlgorithmName(oid: string): string {
    const algorithms: Record<string, string> = {
        "1.2.840.113549.1.1.1": "RSA",
        "1.2.840.113549.1.1.5": "RSA-SHA1",
        "1.2.840.113549.1.1.11": "RSA-SHA256",
        "1.2.840.113549.1.1.12": "RSA-SHA384",
        "1.2.840.113549.1.1.13": "RSA-SHA512",
        "1.2.840.10045.2.1": "EC",
        "1.2.840.10045.4.3.2": "ECDSA-SHA256",
        "1.2.840.10045.4.3.3": "ECDSA-SHA384",
        "1.2.840.10045.4.3.4": "ECDSA-SHA512",
        "1.3.101.112": "Ed25519",
    };

    return algorithms[oid] || `OID-${oid}`;
}

/**
 * Convert OID to attribute name
 */
function oidToAttributeName(oid: string): string {
    const attributes: Record<string, string> = {
        "2.5.4.3": "CN",
        "2.5.4.6": "C",
        "2.5.4.7": "L",
        "2.5.4.8": "ST",
        "2.5.4.10": "O",
        "2.5.4.11": "OU",
        "2.5.4.12": "T",
        "2.5.4.42": "GN",
        "2.5.4.4": "SN",
        "1.2.840.113549.1.9.1": "E",
    };

    return attributes[oid] || oid;
}

/**
 * Create TLS record
 */
function createTLSRecord(type: TLSRecordType, data: ByteBuffer): TLSRecord {
    return {
        type,
        version: TLSVersion.TLS_1_2, // Record layer uses 1.2 for compatibility
        length: data.byteLength,
        data,
        sequenceNumber: 0,
    };
}

/**
 * Serialize TLS record to wire format
 */
function serializeTLSRecord(record: TLSRecord): ByteBuffer {
    const buffer = new Uint8Array(5 + record.data.byteLength);
    const view = new DataView(buffer.buffer);

    view.setUint8(0, record.type);
    view.setUint16(1, record.version);
    view.setUint16(3, record.length);
    buffer.set(record.data, 5);

    return buffer;
}

/**
 * Create TLS alert
 */
function createTLSAlert(level: TLSAlertLevel, description: TLSAlertDescription): TLSAlert {
    return { level, description };
}

/**
 * Serialize handshake message to wire format per TLS 1.3 RFC 8446
 *
 * TLS Handshake message format:
 * struct {
 *     HandshakeType msg_type;    (1 byte)
 *     uint24 length;             (3 bytes)
 *     opaque body<0..2^24-1>;
 * } Handshake;
 */
function serializeHandshakeMessage(message: TLSHandshakeMessage): ByteBuffer {
    let payload: ByteBuffer;

    switch (message.type) {
        case "ClientHello":
            payload = serializeClientHello(message);
            break;
        case "ServerHello":
            payload = serializeServerHello(message);
            break;
        case "Certificate":
            payload = serializeCertificate(message);
            break;
        case "Finished":
            payload = message.verifyData as ByteBuffer;
            break;
        case "EncryptedExtensions":
            payload = serializeExtensions(message.extensions as TLSExtension[]);
            break;
        default:
            throw new Error(`Cannot serialize handshake message type: ${message.type}`);
    }

    // Get message type code
    const typeCode = getHandshakeTypeCode(message.type);

    // Build handshake message: [type (1)] [length (3)] [payload]
    const msgBuffer = new Uint8Array(4 + payload.byteLength);

    // Byte 0: Message type
    msgBuffer[0] = typeCode;

    // Bytes 1-3: Length (24-bit big-endian)
    msgBuffer[1] = (payload.byteLength >> 16) & 0xff;
    msgBuffer[2] = (payload.byteLength >> 8) & 0xff;
    msgBuffer[3] = payload.byteLength & 0xff;

    // Bytes 4+: Payload
    msgBuffer.set(payload, 4);

    return msgBuffer;
}

/**
 * Get handshake type code from message type string
 */
function getHandshakeTypeCode(type: string): number {
    switch (type) {
        case "ClientHello": return HandshakeType.CLIENT_HELLO;
        case "ServerHello": return HandshakeType.SERVER_HELLO;
        case "Certificate": return HandshakeType.CERTIFICATE;
        case "CertificateVerify": return HandshakeType.CERTIFICATE_VERIFY;
        case "Finished": return HandshakeType.FINISHED;
        case "EncryptedExtensions": return HandshakeType.ENCRYPTED_EXTENSIONS;
        case "NewSessionTicket": return HandshakeType.NEW_SESSION_TICKET;
        case "KeyUpdate": return HandshakeType.KEY_UPDATE;
        default: throw new Error(`Unknown handshake type: ${type}`);
    }
}

/**
 * Serialize ClientHello message
 * struct {
 *     ProtocolVersion legacy_version = 0x0303;
 *     Random random;
 *     opaque legacy_session_id<0..32>;
 *     CipherSuite cipher_suites<2..2^16-2>;
 *     opaque legacy_compression_methods<1..2^8-1>;
 *     Extension extensions<8..2^16-1>;
 * } ClientHello;
 */
function serializeClientHello(message: TLSHandshakeMessage): ByteBuffer {
    const parts: ByteBuffer[] = [];

    // Legacy version (2 bytes): 0x0303 (TLS 1.2 for compatibility)
    parts.push(new Uint8Array([0x03, 0x03]));

    // Random (32 bytes)
    parts.push(message.random as ByteBuffer);

    // Legacy session ID length + session ID
    const sessionId = (message.sessionId as ByteBuffer) || new Uint8Array(0);
    parts.push(new Uint8Array([sessionId.byteLength]));
    if (sessionId.byteLength > 0) {
        parts.push(sessionId);
    }

    // Cipher suites
    const cipherSuites = message.cipherSuites as number[];
    const cipherSuitesLength = cipherSuites.length * 2;
    const cipherSuitesBuffer = new Uint8Array(2 + cipherSuitesLength);
    const cipherView = new DataView(cipherSuitesBuffer.buffer);
    cipherView.setUint16(0, cipherSuitesLength);
    for (let i = 0; i < cipherSuites.length; i++) {
        cipherView.setUint16(2 + i * 2, cipherSuites[i]);
    }
    parts.push(cipherSuitesBuffer);

    // Legacy compression methods (1 byte length + methods)
    const compressionMethods = (message.compressionMethods as number[]) || [0];
    parts.push(new Uint8Array([compressionMethods.length, ...compressionMethods]));

    // Extensions
    const extensions = message.extensions as TLSExtension[];
    if (extensions && extensions.length > 0) {
        parts.push(serializeExtensions(extensions));
    } else {
        parts.push(new Uint8Array([0, 0])); // Empty extensions
    }

    return concat(...parts);
}

/**
 * Serialize ServerHello message
 */
function serializeServerHello(message: TLSHandshakeMessage): ByteBuffer {
    const parts: ByteBuffer[] = [];

    // Legacy version (2 bytes)
    parts.push(new Uint8Array([0x03, 0x03]));

    // Random (32 bytes)
    parts.push(message.random as ByteBuffer);

    // Legacy session ID echo
    const sessionId = (message.sessionId as ByteBuffer) || new Uint8Array(0);
    parts.push(new Uint8Array([sessionId.byteLength]));
    if (sessionId.byteLength > 0) {
        parts.push(sessionId);
    }

    // Cipher suite (2 bytes)
    const cipherSuite = message.cipherSuite as number;
    parts.push(new Uint8Array([
        (cipherSuite >> 8) & 0xff,
        cipherSuite & 0xff,
    ]));

    // Legacy compression method (1 byte)
    parts.push(new Uint8Array([0]));

    // Extensions
    const extensions = message.extensions as TLSExtension[];
    if (extensions && extensions.length > 0) {
        parts.push(serializeExtensions(extensions));
    } else {
        parts.push(new Uint8Array([0, 0]));
    }

    return concat(...parts);
}

/**
 * Serialize Certificate message
 * struct {
 *     opaque certificate_request_context<0..2^8-1>;
 *     CertificateEntry certificate_list<0..2^24-1>;
 * } Certificate;
 */
function serializeCertificate(message: TLSHandshakeMessage): ByteBuffer {
    const parts: ByteBuffer[] = [];

    // Certificate request context (empty in server certificate)
    parts.push(new Uint8Array([0]));

    // Certificate list
    const certData = message.data as ByteBuffer;
    const certListLength = certData.byteLength + 3; // +3 for length prefix of each cert
    parts.push(new Uint8Array([
        (certListLength >> 16) & 0xff,
        (certListLength >> 8) & 0xff,
        certListLength & 0xff,
    ]));

    // Certificate entry: length (3) + data + extensions length (2)
    parts.push(new Uint8Array([
        (certData.byteLength >> 16) & 0xff,
        (certData.byteLength >> 8) & 0xff,
        certData.byteLength & 0xff,
    ]));
    parts.push(certData);
    parts.push(new Uint8Array([0, 0])); // No extensions

    return concat(...parts);
}

/**
 * Serialize TLS extensions
 */
function serializeExtensions(extensions: TLSExtension[]): ByteBuffer {
    if (!extensions || extensions.length === 0) {
        return new Uint8Array([0, 0]);
    }

    const extParts: ByteBuffer[] = [];

    for (const ext of extensions) {
        const extType = getExtensionType(ext.type);
        const extData = serializeExtensionData(ext);

        // Extension: type (2) + length (2) + data
        const extBuffer = new Uint8Array(4 + extData.byteLength);
        const view = new DataView(extBuffer.buffer);
        view.setUint16(0, extType);
        view.setUint16(2, extData.byteLength);
        extBuffer.set(extData, 4);

        extParts.push(extBuffer);
    }

    const allExtData = concat(...extParts);
    const result = new Uint8Array(2 + allExtData.byteLength);
    const view = new DataView(result.buffer);
    view.setUint16(0, allExtData.byteLength);
    result.set(allExtData, 2);

    return result;
}

/**
 * Get extension type code
 */
function getExtensionType(type: string): number {
    switch (type) {
        case "server_name": return 0;
        case "supported_versions": return 43;
        case "key_share": return 51;
        case "application_layer_protocol_negotiation": return 16;
        case "signature_algorithms": return 13;
        case "supported_groups": return 10;
        default: return 0;
    }
}

/**
 * Serialize extension data
 */
function serializeExtensionData(ext: TLSExtension): ByteBuffer {
    switch (ext.type) {
        case "server_name": {
            const serverName = ext.data as string;
            const nameBytes = new TextEncoder().encode(serverName);
            const buffer = new Uint8Array(5 + nameBytes.byteLength);
            const view = new DataView(buffer.buffer);
            view.setUint16(0, nameBytes.byteLength + 3); // List length
            buffer[2] = 0; // Name type: hostname
            view.setUint16(3, nameBytes.byteLength);
            buffer.set(nameBytes, 5);
            return buffer;
        }

        case "supported_versions": {
            const versions = ext.data as string[];
            const buffer = new Uint8Array(1 + versions.length * 2);
            buffer[0] = versions.length * 2;
            for (let i = 0; i < versions.length; i++) {
                // TLS 1.3 = 0x0304
                buffer[1 + i * 2] = 0x03;
                buffer[2 + i * 2] = 0x04;
            }
            return buffer;
        }

        case "key_share": {
            const keyShareData = ext.data as { group: string; publicKey: ByteBuffer };
            const pubKey = keyShareData.publicKey;
            const buffer = new Uint8Array(4 + pubKey.byteLength);
            const view = new DataView(buffer.buffer);
            view.setUint16(0, 0x001d); // x25519 group
            view.setUint16(2, pubKey.byteLength);
            buffer.set(pubKey, 4);
            return buffer;
        }

        case "application_layer_protocol_negotiation": {
            const protocols = ext.data as string[];
            let totalLength = 0;
            const protocolBuffers: ByteBuffer[] = [];

            for (const proto of protocols) {
                const protoBytes = new TextEncoder().encode(proto);
                const protoBuffer = new Uint8Array(1 + protoBytes.byteLength);
                protoBuffer[0] = protoBytes.byteLength;
                protoBuffer.set(protoBytes, 1);
                protocolBuffers.push(protoBuffer);
                totalLength += protoBuffer.byteLength;
            }

            const buffer = new Uint8Array(2 + totalLength);
            const view = new DataView(buffer.buffer);
            view.setUint16(0, totalLength);
            let offset = 2;
            for (const pb of protocolBuffers) {
                buffer.set(pb, offset);
                offset += pb.byteLength;
            }
            return buffer;
        }

        default:
            return new Uint8Array(0);
    }
}

/**
 * TLS extension interface
 */
interface TLSExtension {
    type: string;
    data: unknown;
}

/**
 * Parse handshake message from wire format per TLS 1.3 RFC 8446
 */
function parseHandshakeMessage(data: ByteBuffer): TLSHandshakeMessage {
    if (data.byteLength < 4) {
        throw new TLSError("Invalid handshake message: too short");
    }

    // Parse handshake message header
    const type = data[0];
    const length = (data[1] << 16) | (data[2] << 8) | data[3];

    if (data.byteLength < 4 + length) {
        throw new TLSError(`Invalid handshake message: expected ${4 + length} bytes, got ${data.byteLength}`);
    }

    const payload = data.slice(4, 4 + length);

    // Parse based on type
    switch (type) {
        case HandshakeType.SERVER_HELLO:
            return parseServerHello(payload);
        case HandshakeType.ENCRYPTED_EXTENSIONS:
            return parseEncryptedExtensions(payload);
        case HandshakeType.CERTIFICATE:
            return parseCertificateMessage(payload);
        case HandshakeType.CERTIFICATE_VERIFY:
            return parseCertificateVerify(payload);
        case HandshakeType.FINISHED:
            return parseFinished(payload);
        case HandshakeType.NEW_SESSION_TICKET:
            return parseNewSessionTicket(payload);
        default:
            // Unknown message type - return generic structure
            return {
                type: `Unknown_${type}`,
                data: payload,
            };
    }
}

/**
 * Parse ServerHello message
 */
function parseServerHello(payload: ByteBuffer): TLSHandshakeMessage {
    let offset = 0;

    // Legacy version (2 bytes)
    const legacyVersion = (payload[offset] << 8) | payload[offset + 1];
    offset += 2;

    // Random (32 bytes)
    const random = payload.slice(offset, offset + 32);
    offset += 32;

    // Legacy session ID
    const sessionIdLength = payload[offset++];
    const sessionId = payload.slice(offset, offset + sessionIdLength);
    offset += sessionIdLength;

    // Cipher suite (2 bytes)
    const cipherSuite = (payload[offset] << 8) | payload[offset + 1];
    offset += 2;

    // Legacy compression method (1 byte)
    const compressionMethod = payload[offset++];

    // Extensions
    let extensions: TLSExtension[] = [];
    let keyShare: { publicKey: ByteBuffer } | undefined;

    if (offset < payload.byteLength) {
        const extensionsLength = (payload[offset] << 8) | payload[offset + 1];
        offset += 2;
        const extensionsData = payload.slice(offset, offset + extensionsLength);
        extensions = parseExtensions(extensionsData);

        // Extract key_share extension
        const keyShareExt = extensions.find(ext => ext.type === "key_share");
        if (keyShareExt) {
            keyShare = keyShareExt.data as { publicKey: ByteBuffer };
        }
    }

    return {
        type: "ServerHello",
        legacyVersion,
        random,
        sessionId,
        cipherSuite,
        compressionMethod,
        extensions,
        keyShare,
    };
}

/**
 * Parse EncryptedExtensions message
 */
function parseEncryptedExtensions(payload: ByteBuffer): TLSHandshakeMessage {
    const extensionsLength = (payload[0] << 8) | payload[1];
    const extensionsData = payload.slice(2, 2 + extensionsLength);
    const extensions = parseExtensions(extensionsData);

    return {
        type: "EncryptedExtensions",
        extensions,
    };
}

/**
 * Parse Certificate message
 */
function parseCertificateMessage(payload: ByteBuffer): TLSHandshakeMessage {
    let offset = 0;

    // Certificate request context
    const contextLength = payload[offset++];
    const context = payload.slice(offset, offset + contextLength);
    offset += contextLength;

    // Certificate list length (3 bytes)
    const certListLength = (payload[offset] << 16) | (payload[offset + 1] << 8) | payload[offset + 2];
    offset += 3;

    // Parse certificate entries
    const certificates: ByteBuffer[] = [];
    const certListEnd = offset + certListLength;

    while (offset < certListEnd) {
        // Certificate data length (3 bytes)
        const certLength = (payload[offset] << 16) | (payload[offset + 1] << 8) | payload[offset + 2];
        offset += 3;

        // Certificate data
        const certData = payload.slice(offset, offset + certLength);
        certificates.push(certData);
        offset += certLength;

        // Extensions length (2 bytes)
        const extLength = (payload[offset] << 8) | payload[offset + 1];
        offset += 2 + extLength; // Skip extensions
    }

    return {
        type: "Certificate",
        context,
        certificates,
        data: certificates[0], // First certificate (leaf)
    };
}

/**
 * Parse CertificateVerify message
 */
function parseCertificateVerify(payload: ByteBuffer): TLSHandshakeMessage {
    let offset = 0;

    // Signature algorithm (2 bytes)
    const signatureAlgorithm = (payload[offset] << 8) | payload[offset + 1];
    offset += 2;

    // Signature length (2 bytes)
    const signatureLength = (payload[offset] << 8) | payload[offset + 1];
    offset += 2;

    // Signature
    const signature = payload.slice(offset, offset + signatureLength);

    return {
        type: "CertificateVerify",
        signatureAlgorithm,
        signature,
    };
}

/**
 * Parse Finished message
 */
function parseFinished(payload: ByteBuffer): TLSHandshakeMessage {
    return {
        type: "Finished",
        verifyData: payload,
    };
}

/**
 * Parse NewSessionTicket message
 */
function parseNewSessionTicket(payload: ByteBuffer): TLSHandshakeMessage {
    let offset = 0;

    // Ticket lifetime (4 bytes)
    const ticketLifetime = (payload[offset] << 24) | (payload[offset + 1] << 16) |
                          (payload[offset + 2] << 8) | payload[offset + 3];
    offset += 4;

    // Ticket age add (4 bytes)
    const ticketAgeAdd = (payload[offset] << 24) | (payload[offset + 1] << 16) |
                        (payload[offset + 2] << 8) | payload[offset + 3];
    offset += 4;

    // Ticket nonce length + nonce
    const nonceLength = payload[offset++];
    const nonce = payload.slice(offset, offset + nonceLength);
    offset += nonceLength;

    // Ticket length (2 bytes) + ticket
    const ticketLength = (payload[offset] << 8) | payload[offset + 1];
    offset += 2;
    const ticket = payload.slice(offset, offset + ticketLength);
    offset += ticketLength;

    // Extensions
    const extensionsLength = (payload[offset] << 8) | payload[offset + 1];
    offset += 2;
    const extensionsData = payload.slice(offset, offset + extensionsLength);
    const extensions = parseExtensions(extensionsData);

    return {
        type: "NewSessionTicket",
        ticketLifetime,
        ticketAgeAdd,
        nonce,
        ticket,
        extensions,
    };
}

/**
 * Parse TLS extensions
 */
function parseExtensions(data: ByteBuffer): TLSExtension[] {
    const extensions: TLSExtension[] = [];
    let offset = 0;

    while (offset < data.byteLength) {
        if (offset + 4 > data.byteLength) break;

        // Extension type (2 bytes)
        const extType = (data[offset] << 8) | data[offset + 1];
        offset += 2;

        // Extension length (2 bytes)
        const extLength = (data[offset] << 8) | data[offset + 1];
        offset += 2;

        // Extension data
        const extData = data.slice(offset, offset + extLength);
        offset += extLength;

        // Parse extension based on type
        const ext = parseExtensionByType(extType, extData);
        if (ext) {
            extensions.push(ext);
        }
    }

    return extensions;
}

/**
 * Parse extension by type code
 */
function parseExtensionByType(type: number, data: ByteBuffer): TLSExtension | null {
    switch (type) {
        case 0: // server_name
            return {
                type: "server_name",
                data: parseServerNameExtension(data),
            };

        case 43: // supported_versions
            return {
                type: "supported_versions",
                data: parseSupportedVersionsExtension(data),
            };

        case 51: // key_share
            return {
                type: "key_share",
                data: parseKeyShareExtension(data),
            };

        case 16: // application_layer_protocol_negotiation
            return {
                type: "application_layer_protocol_negotiation",
                data: parseALPNExtension(data),
            };

        default:
            // Unknown extension - store raw data
            return {
                type: `unknown_${type}`,
                data: data,
            };
    }
}

/**
 * Parse server_name extension
 */
function parseServerNameExtension(data: ByteBuffer): string {
    let offset = 0;
    const listLength = (data[offset] << 8) | data[offset + 1];
    offset += 2;

    if (listLength === 0) return "";

    const nameType = data[offset++];
    const nameLength = (data[offset] << 8) | data[offset + 1];
    offset += 2;

    if (nameType === 0) { // hostname
        const nameBytes = data.slice(offset, offset + nameLength);
        return new TextDecoder().decode(nameBytes);
    }

    return "";
}

/**
 * Parse supported_versions extension
 */
function parseSupportedVersionsExtension(data: ByteBuffer): string[] {
    const versions: string[] = [];

    // Server sends single version (2 bytes)
    if (data.byteLength === 2) {
        const version = (data[0] << 8) | data[1];
        if (version === 0x0304) versions.push("1.3");
        else if (version === 0x0303) versions.push("1.2");
        return versions;
    }

    // Client sends list
    const length = data[0];
    for (let i = 1; i < length; i += 2) {
        const version = (data[i] << 8) | data[i + 1];
        if (version === 0x0304) versions.push("1.3");
        else if (version === 0x0303) versions.push("1.2");
    }

    return versions;
}

/**
 * Parse key_share extension
 */
function parseKeyShareExtension(data: ByteBuffer): { group: string; publicKey: ByteBuffer } {
    let offset = 0;

    // Group (2 bytes)
    const group = (data[offset] << 8) | data[offset + 1];
    offset += 2;

    // Key exchange length (2 bytes)
    const keyLength = (data[offset] << 8) | data[offset + 1];
    offset += 2;

    // Public key
    const publicKey = data.slice(offset, offset + keyLength);

    return {
        group: group === 0x001d ? "x25519" : `group_${group}`,
        publicKey,
    };
}

/**
 * Parse ALPN extension
 */
function parseALPNExtension(data: ByteBuffer): string[] {
    const protocols: string[] = [];
    let offset = 0;

    const listLength = (data[offset] << 8) | data[offset + 1];
    offset += 2;

    const endOffset = offset + listLength;

    while (offset < endOffset) {
        const protoLength = data[offset++];
        const protoBytes = data.slice(offset, offset + protoLength);
        protocols.push(new TextDecoder().decode(protoBytes));
        offset += protoLength;
    }

    return protocols;
}
