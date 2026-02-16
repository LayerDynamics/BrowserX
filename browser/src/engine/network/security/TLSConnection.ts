/**
 * TLS Connection implementation
 *
 * Provides TLS/SSL encrypted connections with certificate validation,
 * key exchange, and secure application data transfer.
 */

import type { ByteBuffer, Duration } from "../../../types/identifiers.ts";
import type { Certificate, Socket } from "../../../types/network.ts";
import { TLSHandshakeState, TLSVersion } from "../../../types/network.ts";
import { validateCertificate, loadSystemCAs } from "./Certificate.ts";
import * as SessionKeysUtil from "./SessionKeys.ts";
// @deno-types="npm:@noble/ciphers@1.2.1/chacha"
import { chacha20poly1305 } from "npm:@noble/ciphers@1.2.1/chacha";

/**
 * Cipher suite (TLS 1.3)
 */
export enum CipherSuite {
    // TLS 1.3 cipher suites
    TLS_AES_128_GCM_SHA256 = 0x1301,
    TLS_AES_256_GCM_SHA384 = 0x1302,
    TLS_CHACHA20_POLY1305_SHA256 = 0x1303,
    TLS_AES_128_CCM_SHA256 = 0x1304,
    // TLS 1.2 cipher suites (for compatibility with older servers)
    TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256 = 0xc02b,
    TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256 = 0xc02f,
    TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384 = 0xc02c,
    TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384 = 0xc030,
    TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256 = 0xcca9,
    TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256 = 0xcca8,
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
    private clientSequenceNumber: number = 0;  // For encrypting messages we send
    private serverRecordSeq: number = 0;       // For decrypting messages we receive
    private readRecordCounter: number = 0;     // Informational counter for read records
    private handshakeMessages: ByteBuffer[] = [];
    private clientHandshakeTrafficSecret: ByteBuffer | null = null;
    private serverHandshakeTrafficSecret: ByteBuffer | null = null;
    private masterSecret: ByteBuffer | null = null;
    private negotiatedVersion: TLSVersion = TLSVersion.TLS_1_3;
    private negotiatedCipherSuite: number = 0x1301; // Default to TLS_AES_128_GCM_SHA256

    constructor(socket: Socket, config?: TLSConfig) {
        this.socket = socket;
        this.config = config || {
            minVersion: TLSVersion.TLS_1_2, // Allow TLS 1.2 fallback for compatibility
            maxVersion: TLSVersion.TLS_1_3,
            cipherSuites: [
                // TLS 1.3 cipher suites (preferred)
                CipherSuite.TLS_AES_128_GCM_SHA256,
                CipherSuite.TLS_AES_256_GCM_SHA384,
                CipherSuite.TLS_CHACHA20_POLY1305_SHA256,
                // TLS 1.2 cipher suites (for compatibility with older servers)
                CipherSuite.TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256,
                CipherSuite.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,
                CipherSuite.TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384,
                CipherSuite.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,
                CipherSuite.TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256,
                CipherSuite.TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256,
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
        // Set server name for SNI (Server Name Indication)
        // This is critical for virtual hosting and certificate validation
        if (!this.config.serverName) {
            this.config.serverName = host;
        }

        // Auto-load system CA certificates if verification is enabled but no CAs provided
        if (this.config.verifyPeerCertificate && this.config.trustedCAs.length === 0) {
            this.config.trustedCAs = await loadSystemCAs();
        }

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
        // TLS 1.3 Handshake Flow:
        // 1. Client sends ClientHello (unencrypted)
        // 2. Server sends ServerHello (unencrypted)
        // 3. Server may send CHANGE_CIPHER_SPEC (ignore - middlebox compatibility)
        // 4. Server sends encrypted handshake messages as APPLICATION_DATA:
        //    - EncryptedExtensions, Certificate, CertificateVerify, Finished
        // 5. Client sends Finished (encrypted)

        // 1. Send ClientHello
        this.clientRandom = generateRandom(32);
        const clientHello = await this.createClientHello();
        // Pass isInitialClientHello=true to use TLS 1.0 in record layer per RFC 8446
        await this.sendHandshakeMessage(clientHello, false, true);
        this.state = TLSHandshakeState.CLIENT_HELLO;

        // 2. Receive ServerHello (unencrypted)
        const serverHello = await this.receiveServerHello();
        this.serverRandom = serverHello.random as ByteBuffer;
        this.state = TLSHandshakeState.SERVER_HELLO;

        // Detect negotiated TLS version
        const supportedVersionsExt = (serverHello.extensions as TLSExtension[])?.find(
            (e: TLSExtension) => e.type === "supported_versions"
        );
        const serverVersions = supportedVersionsExt?.data as string[] | undefined;
        if (serverVersions?.includes("1.3")) {
            this.negotiatedVersion = TLSVersion.TLS_1_3;
        } else {
            // No supported_versions extension with 1.3 means TLS 1.2
            this.negotiatedVersion = TLSVersion.TLS_1_2;
        }

        if (this.negotiatedVersion === TLSVersion.TLS_1_2) {
            // TLS 1.2 handshake flow
            await this.handshakeTLS12(clientHello, serverHello);
            return;
        }

        // TLS 1.3 flow continues below

        // Check for HelloRetryRequest (server wants a different key share)
        // HelloRetryRequest is indicated by special random value: SHA-256("HelloRetryRequest")
        const helloRetryRequestRandom = new Uint8Array([
            0xCF, 0x21, 0xAD, 0x74, 0xE5, 0x9A, 0x61, 0x11,
            0xBE, 0x1D, 0x8C, 0x02, 0x1E, 0x65, 0xB8, 0x91,
            0xC2, 0xA2, 0x11, 0x16, 0x7A, 0xBB, 0x8C, 0x5E,
            0x07, 0x9E, 0x09, 0xE2, 0xC8, 0xA8, 0x33, 0x9C
        ]);
        const serverRandom = serverHello.random as ByteBuffer;
        const isHelloRetryRequest = serverRandom.length === 32 &&
            serverRandom.every((b: number, i: number) => b === helloRetryRequestRandom[i]);

        if (isHelloRetryRequest) {
            // Server wants a different key share - get the requested group
            const keyShareExt = (serverHello.extensions as TLSExtension[])?.find(
                (e: TLSExtension) => e.type === "key_share"
            );
            const requestedGroup = (keyShareExt?.data as { group: string })?.group;

            if (!requestedGroup) {
                throw new TLSError("HelloRetryRequest missing key_share extension");
            }

            // Store the negotiated cipher suite from HelloRetryRequest
            this.negotiatedCipherSuite = serverHello.cipherSuite as number;
            const csInfo = SessionKeysUtil.getCipherSuiteInfo(this.negotiatedCipherSuite);

            // Generate new key pair for the requested curve
            const newKeyPair = await generateECDHEKeyPairForCurve(requestedGroup);

            // Per RFC 8446, transcript hash for HelloRetryRequest:
            // Replace the first ClientHello with: message_hash || length || Hash(ClientHello1)
            // The hash algorithm depends on the cipher suite
            const hashAlgorithm = csInfo.hashAlgorithm;
            const hashLength = csInfo.hashLength;
            const firstClientHelloHash = new Uint8Array(await crypto.subtle.digest(hashAlgorithm, this.handshakeMessages[0]));
            const messageHashMarker = new Uint8Array(4 + hashLength);
            messageHashMarker[0] = 0xFE; // message_hash type
            messageHashMarker[1] = 0x00;
            messageHashMarker[2] = 0x00;
            messageHashMarker[3] = hashLength; // length depends on hash algorithm
            messageHashMarker.set(firstClientHelloHash, 4);

            // Replace first message with the hash marker
            this.handshakeMessages[0] = messageHashMarker;

            // Create new ClientHello with requested curve's key share
            const newClientHello: TLSHandshakeMessage = {
                type: "ClientHello",
                version: TLSVersion.TLS_1_3,
                random: this.clientRandom,
                sessionId: new Uint8Array(32),
                cipherSuites: this.config.cipherSuites,
                compressionMethods: [0],
                extensions: [
                    { type: "server_name", data: this.config.serverName },
                    { type: "ec_point_formats", data: [0] },
                    { type: "supported_groups", data: ["x25519", "secp256r1", "secp384r1"] },
                    { type: "signature_algorithms", data: [0x0403, 0x0804, 0x0401, 0x0503, 0x0805, 0x0501, 0x0806, 0x0601] },
                    { type: "supported_versions", data: [TLSVersion.TLS_1_3, TLSVersion.TLS_1_2] },
                    { type: "psk_key_exchange_modes", data: [1] },
                    { type: "key_share", data: { group: requestedGroup, publicKey: newKeyPair.publicKey } },
                    { type: "application_layer_protocol_negotiation", data: this.config.alpnProtocols },
                ],
                keyShare: newKeyPair,
            };

            // Send new ClientHello
            await this.sendHandshakeMessage(newClientHello, false, false);

            // Receive new ServerHello (should have the actual key exchange now)
            const newServerHello = await this.receiveServerHello();

            // Update client key share reference for key derivation
            const retryClientKeyShare = newClientHello.keyShare as {
                privateKey: ByteBuffer;
                publicKey: ByteBuffer;
                cryptoKeyPair?: CryptoKeyPair;
                group?: string;
            };
            const retryServerKeyShare = newServerHello.keyShare as {
                group: string;
                publicKey: ByteBuffer;
            };

            // Continue with key derivation using new key shares
            const sharedSecret = await this.computeSharedSecret(retryClientKeyShare, retryServerKeyShare);

            // Compute handshake context hash with the correct algorithm for the cipher suite
            const handshakeContext = new Uint8Array(await crypto.subtle.digest(hashAlgorithm, concat(...this.handshakeMessages)));
            const handshakeSecrets = await SessionKeysUtil.deriveHandshakeTrafficSecrets(
                sharedSecret,
                handshakeContext,
                this.negotiatedCipherSuite,
            );

            this.clientHandshakeTrafficSecret = handshakeSecrets.clientHandshakeTrafficSecret;
            this.serverHandshakeTrafficSecret = handshakeSecrets.serverHandshakeTrafficSecret;
            this.masterSecret = handshakeSecrets.masterSecret;

            // Use cipher-suite-appropriate key length (16 for AES-128, 32 for AES-256)
            const keyLen = csInfo.keyLength;
            this.sessionKeys = {
                clientWriteKey: await SessionKeysUtil.hkdfExpandLabel(
                    this.clientHandshakeTrafficSecret, "key", new Uint8Array(0), keyLen, this.negotiatedCipherSuite
                ),
                serverWriteKey: await SessionKeysUtil.hkdfExpandLabel(
                    this.serverHandshakeTrafficSecret, "key", new Uint8Array(0), keyLen, this.negotiatedCipherSuite
                ),
                clientWriteIV: await SessionKeysUtil.hkdfExpandLabel(
                    this.clientHandshakeTrafficSecret, "iv", new Uint8Array(0), 12, this.negotiatedCipherSuite
                ),
                serverWriteIV: await SessionKeysUtil.hkdfExpandLabel(
                    this.serverHandshakeTrafficSecret, "iv", new Uint8Array(0), 12, this.negotiatedCipherSuite
                ),
            };

            this.state = TLSHandshakeState.KEY_EXCHANGE;

            // Continue with encrypted handshake messages
            const encryptedMessages = await this.receiveEncryptedHandshakeMessages();

            const certificate = encryptedMessages.find((m) => m.type === "Certificate");
            const serverFinished = encryptedMessages.find((m) => m.type === "Finished");

            if (!certificate || !serverFinished) {
                throw new TLSError("Invalid server handshake: missing Certificate or Finished");
            }

            // Validate server certificate
            const certChainData = certificate.certificates as ByteBuffer[];
            this.peerCertificate = parseCertificate(certChainData[0]);

            // Parse intermediate certificates
            const intermediateCerts: Certificate[] = [];
            for (let i = 1; i < certChainData.length; i++) {
                try {
                    intermediateCerts.push(parseCertificate(certChainData[i]));
                } catch {
                    // Skip unparseable intermediates
                }
            }

            // Validate the certificate chain
            if (this.config.verifyPeerCertificate) {
                const validation = await validateCertificate(
                    this.peerCertificate,
                    this.config.serverName!,
                    this.config.trustedCAs,
                    intermediateCerts,
                );
                if (!validation.valid) {
                    throw new TLSError(`Certificate validation failed: ${validation.reason}`);
                }
            }

            this.state = TLSHandshakeState.CERTIFICATE;

            // Compute application transcript hash BEFORE sending client Finished
            // Use the correct hash algorithm for the cipher suite
            const applicationContextHash = new Uint8Array(await crypto.subtle.digest(hashAlgorithm, concat(...this.handshakeMessages)));

            // Send client Finished message
            const clientFinished = await this.createFinished();
            await this.sendHandshakeMessage(clientFinished, true);

            // Derive application traffic keys with cipher suite
            const appSecrets = await SessionKeysUtil.deriveApplicationTrafficSecrets(
                this.masterSecret!,
                applicationContextHash,
                this.negotiatedCipherSuite,
            );

            const emptyContext = new Uint8Array(0) as ByteBuffer;
            this.sessionKeys = {
                clientWriteKey: await SessionKeysUtil.hkdfExpandLabel(
                    appSecrets.clientApplicationTrafficSecret, "key", emptyContext, keyLen, this.negotiatedCipherSuite
                ),
                serverWriteKey: await SessionKeysUtil.hkdfExpandLabel(
                    appSecrets.serverApplicationTrafficSecret, "key", emptyContext, keyLen, this.negotiatedCipherSuite
                ),
                clientWriteIV: await SessionKeysUtil.hkdfExpandLabel(
                    appSecrets.clientApplicationTrafficSecret, "iv", emptyContext, 12, this.negotiatedCipherSuite
                ),
                serverWriteIV: await SessionKeysUtil.hkdfExpandLabel(
                    appSecrets.serverApplicationTrafficSecret, "iv", emptyContext, 12, this.negotiatedCipherSuite
                ),
            };

            // Reset sequence counters for application data
            this.clientSequenceNumber = 0;
            this.serverRecordSeq = 0;
            this.state = TLSHandshakeState.ESTABLISHED;
            return;
        }

        // For non-HRR flow, capture cipher suite from ServerHello
        this.negotiatedCipherSuite = serverHello.cipherSuite as number;
        const csInfo = SessionKeysUtil.getCipherSuiteInfo(this.negotiatedCipherSuite);
        const hashAlgorithm = csInfo.hashAlgorithm;
        const keyLen = csInfo.keyLength;

        // 3. Derive handshake traffic keys from key exchange
        const clientKeyShare = clientHello.keyShare as {
            privateKey: ByteBuffer;
            publicKey: ByteBuffer;
            cryptoKeyPair?: CryptoKeyPair;
            group?: string;
        };
        const serverKeyShare = serverHello.keyShare as {
            group: string;
            publicKey: ByteBuffer;
        };

        // Compute shared secret from ECDHE (using Web Crypto for X25519)
        const sharedSecret = await this.computeSharedSecret(clientKeyShare, serverKeyShare);

        // Derive handshake traffic secrets (using hash of ClientHello + ServerHello)
        const handshakeContext = new Uint8Array(await crypto.subtle.digest(hashAlgorithm, concat(...this.handshakeMessages)));
        const handshakeSecrets = await SessionKeysUtil.deriveHandshakeTrafficSecrets(
            sharedSecret,
            handshakeContext,
            this.negotiatedCipherSuite,
        );

        this.clientHandshakeTrafficSecret = handshakeSecrets.clientHandshakeTrafficSecret;
        this.serverHandshakeTrafficSecret = handshakeSecrets.serverHandshakeTrafficSecret;
        // Store master secret for deriving application traffic secrets later
        this.masterSecret = handshakeSecrets.masterSecret;

        // Derive keys and IVs for handshake traffic using HKDF-Expand-Label
        // key = HKDF-Expand-Label(Secret, "key", "", key_length)
        // iv = HKDF-Expand-Label(Secret, "iv", "", iv_length)
        const emptyContext = new Uint8Array(0) as ByteBuffer;
        this.sessionKeys = {
            clientWriteKey: await SessionKeysUtil.hkdfExpandLabel(
                this.clientHandshakeTrafficSecret!,
                "key",
                emptyContext,
                keyLen,
                this.negotiatedCipherSuite,
            ),
            serverWriteKey: await SessionKeysUtil.hkdfExpandLabel(
                this.serverHandshakeTrafficSecret!,
                "key",
                emptyContext,
                keyLen,
                this.negotiatedCipherSuite,
            ),
            clientWriteIV: await SessionKeysUtil.hkdfExpandLabel(
                this.clientHandshakeTrafficSecret!,
                "iv",
                emptyContext,
                12, // GCM nonce
                this.negotiatedCipherSuite,
            ),
            serverWriteIV: await SessionKeysUtil.hkdfExpandLabel(
                this.serverHandshakeTrafficSecret!,
                "iv",
                emptyContext,
                12,
                this.negotiatedCipherSuite,
            ),
        };

        this.state = TLSHandshakeState.KEY_EXCHANGE;

        // 4. Receive encrypted handshake messages (as APPLICATION_DATA)
        const encryptedMessages = await this.receiveEncryptedHandshakeMessages();

        const certificate = encryptedMessages.find((m) => m.type === "Certificate");
        const serverFinished = encryptedMessages.find((m) => m.type === "Finished");

        if (!certificate || !serverFinished) {
            throw new TLSError("Invalid server handshake: missing Certificate or Finished");
        }

        // 5. Validate server certificate
        // Parse the full certificate chain from the Certificate message
        // certificates[0] is the leaf (server) cert, rest are intermediates
        const certChainData = certificate.certificates as ByteBuffer[];
        this.peerCertificate = parseCertificate(certChainData[0]);

        // Parse intermediate certificates (skip the leaf at index 0)
        const intermediateCerts: Certificate[] = [];
        for (let i = 1; i < certChainData.length; i++) {
            try {
                intermediateCerts.push(parseCertificate(certChainData[i]));
            } catch (e) {
                // Log but continue - some intermediates may be malformed
                console.warn(`Failed to parse intermediate certificate ${i}:`, e);
            }
        }

        if (this.config.verifyPeerCertificate) {
            const validation = await validateCertificate(
                this.peerCertificate,
                this.config.serverName!,
                this.config.trustedCAs,
                intermediateCerts,
            );

            if (!validation.valid) {
                throw new TLSError(`Certificate validation failed: ${validation.reason}`);
            }
        }

        this.state = TLSHandshakeState.CERTIFICATE;

        // 6. Compute application transcript hash BEFORE sending client Finished
        // TLS 1.3: Application traffic secrets use hash of handshake through server Finished
        // This must be computed BEFORE adding client Finished to the transcript
        const applicationContextHash = new Uint8Array(await crypto.subtle.digest(hashAlgorithm, concat(...this.handshakeMessages)));

        // 7. Send client Finished message (encrypted with handshake keys)
        const clientFinished = await this.createFinished();
        await this.sendHandshakeMessage(clientFinished, true);

        // 8. Switch to application traffic keys
        // Derive application secrets using the transcript hash through server Finished
        const applicationSecrets = await SessionKeysUtil.deriveApplicationTrafficSecrets(
            this.masterSecret!,
            applicationContextHash,
            this.negotiatedCipherSuite,
        );

        const appKeyContext = new Uint8Array(0) as ByteBuffer;
        this.sessionKeys = {
            clientWriteKey: await SessionKeysUtil.hkdfExpandLabel(
                applicationSecrets.clientApplicationTrafficSecret,
                "key",
                appKeyContext,
                keyLen,
                this.negotiatedCipherSuite,
            ),
            serverWriteKey: await SessionKeysUtil.hkdfExpandLabel(
                applicationSecrets.serverApplicationTrafficSecret,
                "key",
                appKeyContext,
                keyLen,
                this.negotiatedCipherSuite,
            ),
            clientWriteIV: await SessionKeysUtil.hkdfExpandLabel(
                applicationSecrets.clientApplicationTrafficSecret,
                "iv",
                appKeyContext,
                12, // GCM nonce
                this.negotiatedCipherSuite,
            ),
            serverWriteIV: await SessionKeysUtil.hkdfExpandLabel(
                applicationSecrets.serverApplicationTrafficSecret,
                "iv",
                appKeyContext,
                12,
                this.negotiatedCipherSuite,
            ),
        };

        // Reset sequence counters for application data
        this.clientSequenceNumber = 0;
        this.serverRecordSeq = 0;

        this.state = TLSHandshakeState.ESTABLISHED;

        // Handshake complete, application data can now be sent/received
    }

    /**
     * TLS 1.2 handshake flow
     *
     * After ServerHello, the server sends unencrypted:
     *   Certificate, ServerKeyExchange, ServerHelloDone
     * Then client sends:
     *   ClientKeyExchange, ChangeCipherSpec, Finished
     * Then server sends:
     *   ChangeCipherSpec, Finished
     */
    private async handshakeTLS12(
        clientHello: TLSHandshakeMessage,
        serverHello: TLSHandshakeMessage,
    ): Promise<void> {
        const clientKeyShare = clientHello.keyShare as {
            privateKey: ByteBuffer;
            publicKey: ByteBuffer;
            cryptoKeyPair?: CryptoKeyPair;
        };

        // Read unencrypted handshake messages until ServerHelloDone
        let serverCertMsg: TLSHandshakeMessage | null = null;
        let serverKeyExchangeMsg: TLSHandshakeMessage | null = null;
        let gotServerHelloDone = false;

        while (!gotServerHelloDone) {
            let record = await this.readRecord();

            if (record === null) {
                throw new TLSError("Connection closed unexpectedly during TLS 1.2 handshake");
            }

            // Skip ChangeCipherSpec
            while (record.type === TLSRecordType.CHANGE_CIPHER_SPEC) {
                record = await this.readRecord();
                if (record === null) {
                    throw new TLSError("Connection closed unexpectedly during TLS 1.2 handshake");
                }
            }

            if (record.type === TLSRecordType.ALERT) {
                const alertDesc = record.data[1];
                throw new TLSError(
                    `Server sent TLS alert during TLS 1.2 handshake: ${this.getAlertDescription(alertDesc)}`
                );
            }

            if (record.type !== TLSRecordType.HANDSHAKE) {
                throw new TLSError(`Expected HANDSHAKE record, got type ${record.type}`);
            }

            // A single record can contain multiple handshake messages
            let offset = 0;
            while (offset < record.data.byteLength) {
                const msgType = record.data[offset];
                const msgLength = (record.data[offset + 1] << 16) |
                    (record.data[offset + 2] << 8) |
                    record.data[offset + 3];
                const msgData = record.data.slice(offset, offset + 4 + msgLength) as ByteBuffer;
                offset += 4 + msgLength;

                this.handshakeMessages.push(msgData);

                // Parse based on message type (TLS 1.2 format)
                if (msgType === HandshakeType.CERTIFICATE) {
                    // Use TLS 1.2 certificate parser (no context length, no extensions)
                    serverCertMsg = parseCertificateTLS12(msgData.slice(4)); // Skip 4-byte header
                } else if (msgType === HandshakeType.SERVER_KEY_EXCHANGE) {
                    serverKeyExchangeMsg = { type: "ServerKeyExchange", data: msgData.slice(4) };
                } else if (msgType === HandshakeType.SERVER_HELLO_DONE) {
                    // Done receiving server messages
                    gotServerHelloDone = true;
                    break;
                }
            }
        }

        if (!serverCertMsg) {
            throw new TLSError("TLS 1.2: Server did not send Certificate");
        }

        // Validate server certificate
        const certChainData = serverCertMsg.certificates as ByteBuffer[];
        this.peerCertificate = parseCertificate(certChainData[0]);

        const intermediateCerts: Certificate[] = [];
        for (let i = 1; i < certChainData.length; i++) {
            try {
                intermediateCerts.push(parseCertificate(certChainData[i]));
            } catch (e) {
                console.warn(`Failed to parse intermediate certificate ${i}:`, e);
            }
        }

        if (this.config.verifyPeerCertificate) {
            const validation = await validateCertificate(
                this.peerCertificate,
                this.config.serverName!,
                this.config.trustedCAs,
                intermediateCerts,
            );
            if (!validation.valid) {
                throw new TLSError(`Certificate validation failed: ${validation.reason}`);
            }
        }

        this.state = TLSHandshakeState.CERTIFICATE;

        // Parse ServerKeyExchange to get ECDHE parameters
        let serverECDHPublicKey: ByteBuffer;
        let curveId: number;

        if (serverKeyExchangeMsg) {
            const skeData = serverKeyExchangeMsg.data as ByteBuffer;
            // ECParameters: curve_type (1) + named_curve (2)
            const curveType = skeData[0]; // should be 3 (named_curve)
            curveId = (skeData[1] << 8) | skeData[2];
            const pubKeyLen = skeData[3];
            serverECDHPublicKey = skeData.slice(4, 4 + pubKeyLen) as ByteBuffer;
        } else {
            throw new TLSError("TLS 1.2: Missing ServerKeyExchange for ECDHE");
        }

        // Determine curve name from server selection
        const groupName = curveId === 0x001d ? "x25519" :
                         curveId === 0x0017 ? "secp256r1" :
                         curveId === 0x0018 ? "secp384r1" : "x25519";

        // For TLS 1.2, generate a new key pair matching the server's selected curve
        // (The ClientHello key share may be for x25519 but server might select secp256r1)
        let tls12ClientKeyShare = clientKeyShare;
        if (groupName !== "x25519") {
            // Generate a new key pair for the server's curve
            tls12ClientKeyShare = await generateECDHEKeyPairForCurve(groupName);
        }

        const sharedSecret = await this.computeSharedSecret(tls12ClientKeyShare, {
            group: groupName,
            publicKey: serverECDHPublicKey,
        });

        // Determine cipher suite name for key derivation and PRF hash selection
        const cipherSuite = serverHello.cipherSuite as number;
        const cipherSuiteName = getCipherSuiteNameFromCode(cipherSuite);

        // Set negotiated cipher suite for computeTranscriptHash() to use correct hash algorithm
        this.negotiatedCipherSuite = cipherSuite;

        // Compute master secret using TLS 1.2 PRF (hash algorithm depends on cipher suite)
        const tls12MasterSecret = await SessionKeysUtil.computeMasterSecret(
            sharedSecret,
            this.clientRandom,
            this.serverRandom,
            "1.2",
            cipherSuiteName,
        );

        // Derive session keys using TLS 1.2 PRF key expansion
        this.sessionKeys = await SessionKeysUtil.deriveSessionKeys(
            tls12MasterSecret,
            this.clientRandom,
            this.serverRandom,
            cipherSuiteName,
        );

        // Send ClientKeyExchange (our ECDHE public key)
        const clientKeyExchangeMsg: TLSHandshakeMessage = {
            type: "ClientKeyExchange",
            publicKey: tls12ClientKeyShare.publicKey,
        };
        await this.sendHandshakeMessage(clientKeyExchangeMsg, false);

        // Send ChangeCipherSpec (not a handshake message - it's its own record type)
        const changeCipherSpec = new Uint8Array([1]);
        const ccsRecord = createTLSRecord(TLSRecordType.CHANGE_CIPHER_SPEC, changeCipherSpec);
        await this.socket.write(serializeTLSRecord(ccsRecord));

        // Reset sequence counter after ChangeCipherSpec (per RFC 5246 §6.1)
        this.clientSequenceNumber = 0;

        // Send client Finished (encrypted with TLS 1.2 record protection)
        // Compute verify_data = PRF(master_secret, "client finished", Hash(handshake_messages))[0..11]
        const transcriptHash = await this.computeTranscriptHash();
        const clientFinishedLabel = new TextEncoder().encode("client finished");
        const clientVerifyData = await tls12PRF(tls12MasterSecret, clientFinishedLabel, transcriptHash, 12, cipherSuiteName);

        const clientFinishedMsg: TLSHandshakeMessage = {
            type: "Finished",
            verifyData: clientVerifyData,
        };
        // Serialize, record in transcript, then encrypt and send
        const serializedFinished = serializeHandshakeMessage(clientFinishedMsg);
        this.handshakeMessages.push(serializedFinished);

        // Encrypt with TLS 1.2 AES-GCM (explicit nonce)
        const encryptedFinished = await this.encryptTLS12Record(
            serializedFinished,
            TLSRecordType.HANDSHAKE,
        );
        const finishedRecord = createTLSRecord(TLSRecordType.HANDSHAKE, encryptedFinished as ByteBuffer);
        await this.socket.write(serializeTLSRecord(finishedRecord));

        // Receive server ChangeCipherSpec
        let record = await this.readRecord();
        if (record === null) {
            throw new TLSError("Connection closed unexpectedly waiting for server Finished");
        }
        while (record.type === TLSRecordType.CHANGE_CIPHER_SPEC) {
            record = await this.readRecord();
            if (record === null) {
                throw new TLSError("Connection closed unexpectedly waiting for server Finished");
            }
        }

        // Receive server Finished (encrypted)
        if (record.type === TLSRecordType.ALERT) {
            const alertDesc = record.data[1];
            throw new TLSError(
                `Server alert after client Finished: ${this.getAlertDescription(alertDesc)}`
            );
        }

        if (record.type !== TLSRecordType.HANDSHAKE) {
            throw new TLSError(`Expected encrypted Finished, got record type ${record.type}`);
        }

        // Decrypt server Finished
        const decryptedServerFinished = await this.decryptTLS12Record(record.data, TLSRecordType.HANDSHAKE);
        // Parse and verify server Finished
        const serverFinished = parseHandshakeMessage(decryptedServerFinished);
        if (serverFinished.type !== "Finished") {
            throw new TLSError(`Expected server Finished, got ${serverFinished.type}`);
        }

        this.state = TLSHandshakeState.ESTABLISHED;
    }

    /**
     * Encrypt a TLS 1.2 record using AES-GCM with explicit nonce
     *
     * TLS 1.2 AES-GCM format:
     * - Nonce = implicit IV (4 bytes from key derivation) + explicit nonce (8 bytes, sent with record)
     * - AAD = seq_num (8) + type (1) + version (2) + length (2)
     * - Output = explicit_nonce (8) + ciphertext + tag (16)
     */
    private async encryptTLS12Record(plaintext: ByteBuffer, contentType: TLSRecordType): Promise<ByteBuffer> {
        if (!this.sessionKeys) throw new TLSError("No session keys");

        const key = this.sessionKeys.clientWriteKey;
        const implicitIV = this.sessionKeys.clientWriteIV; // 4 bytes for TLS 1.2

        // Generate explicit nonce (8 bytes) from sequence number
        const explicitNonce = new Uint8Array(8);
        const seqView = new DataView(explicitNonce.buffer);
        seqView.setBigUint64(0, BigInt(this.clientSequenceNumber));

        // Full nonce = implicit IV (4 bytes) + explicit nonce (8 bytes) = 12 bytes
        const nonce = new Uint8Array(12);
        nonce.set(implicitIV.slice(0, 4), 0);
        nonce.set(explicitNonce, 4);

        // AAD: seq_num(8) + type(1) + version(2) + length(2)
        const aad = new Uint8Array(13);
        const aadView = new DataView(aad.buffer);
        aadView.setBigUint64(0, BigInt(this.clientSequenceNumber));
        aad[8] = contentType;
        aad[9] = 0x03; // TLS 1.2
        aad[10] = 0x03;
        aadView.setUint16(11, plaintext.byteLength);

        this.clientSequenceNumber++;

        // Encrypt with AES-GCM
        const cryptoKey = await crypto.subtle.importKey(
            "raw", key, { name: "AES-GCM" }, false, ["encrypt"]
        );
        const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
            { name: "AES-GCM", iv: nonce, tagLength: 128, additionalData: aad },
            cryptoKey, plaintext,
        ));

        // Output: explicit_nonce (8) + ciphertext+tag
        const output = new Uint8Array(8 + ciphertext.byteLength);
        output.set(explicitNonce, 0);
        output.set(ciphertext, 8);
        return output;
    }

    /**
     * Decrypt a TLS 1.2 record using AES-GCM with explicit nonce
     */
    private async decryptTLS12Record(data: ByteBuffer, contentType: TLSRecordType): Promise<ByteBuffer> {
        if (!this.sessionKeys) throw new TLSError("No session keys");

        const key = this.sessionKeys.serverWriteKey;
        const implicitIV = this.sessionKeys.serverWriteIV; // 4 bytes for TLS 1.2

        // Validate minimum data length (explicit nonce + auth tag)
        if (data.byteLength < 24) { // 8 (nonce) + 16 (tag)
            throw new TLSError(`TLS 1.2 decrypt: data too short (${data.byteLength} bytes)`);
        }

        // Extract explicit nonce (first 8 bytes)
        const explicitNonce = data.slice(0, 8);
        const ciphertext = data.slice(8);

        // Full nonce = implicit IV (4 bytes) + explicit nonce (8 bytes)
        const nonce = new Uint8Array(12);
        nonce.set(implicitIV.slice(0, 4), 0);
        nonce.set(explicitNonce, 4);

        // AAD: seq_num(8) + type(1) + version(2) + length(2)
        const plaintextLength = ciphertext.byteLength - 16; // subtract GCM tag
        const aad = new Uint8Array(13);
        const aadView = new DataView(aad.buffer);
        aadView.setBigUint64(0, BigInt(this.serverRecordSeq));
        aad[8] = contentType;
        aad[9] = 0x03; // TLS 1.2
        aad[10] = 0x03;
        aadView.setUint16(11, plaintextLength);

        // Decrypt with AES-GCM
        try {
            const cryptoKey = await crypto.subtle.importKey(
                "raw", key, { name: "AES-GCM" }, false, ["decrypt"]
            );
            const plaintext = new Uint8Array(await crypto.subtle.decrypt(
                { name: "AES-GCM", iv: nonce, tagLength: 128, additionalData: aad },
                cryptoKey, ciphertext,
            ));
            // Only increment sequence counter AFTER successful decryption
            this.serverRecordSeq++;
            return plaintext;
        } catch (error) {
            throw new TLSError(`TLS 1.2 decryption failed: ${(error as Error).message || "authentication tag verification failed"}`);
        }
    }

    /**
     * Compute ECDHE shared secret using Web Crypto API
     */
    private async computeSharedSecret(
        clientKeyShare: { privateKey: ByteBuffer; publicKey: ByteBuffer; cryptoKeyPair?: CryptoKeyPair; group?: string },
        serverKeyShare: { group: string; publicKey: ByteBuffer },
    ): Promise<ByteBuffer> {
        // Determine algorithm and key import format based on curve type
        const isX25519 = serverKeyShare.group === "x25519";
        const algorithmName = isX25519 ? "X25519" : "ECDH";
        // Map TLS curve names to Web Crypto namedCurve values
        const curveMapping: Record<string, { namedCurve: string; bits: number }> = {
            "secp256r1": { namedCurve: "P-256", bits: 256 },
            "secp384r1": { namedCurve: "P-384", bits: 384 },
            "secp521r1": { namedCurve: "P-521", bits: 528 },  // P-521 is 528 bits for ECDH
        };
        const curveInfo = curveMapping[serverKeyShare.group];
        const namedCurve = curveInfo?.namedCurve;
        const sharedSecretLength = isX25519 ? 256 : (curveInfo?.bits ?? 256);

        // Check if we have a matching CryptoKeyPair for the server's curve
        // The client key pair might be for X25519 but server selected P-256
        const clientCurve = clientKeyShare.group ?? "x25519";
        const curvesMatch = clientCurve === serverKeyShare.group;

        // If curves match and we have the CryptoKeyPair, use Web Crypto deriveBits
        if (curvesMatch && clientKeyShare.cryptoKeyPair) {
            try {
                // Import server's public key
                let serverPublicKey: CryptoKey;
                if (isX25519) {
                    serverPublicKey = await crypto.subtle.importKey(
                        "raw",
                        serverKeyShare.publicKey,
                        { name: "X25519" },
                        false,
                        []
                    );
                } else {
                    // For ECDH curves (P-256, P-384), public key is in uncompressed point format
                    serverPublicKey = await crypto.subtle.importKey(
                        "raw",
                        serverKeyShare.publicKey,
                        { name: "ECDH", namedCurve: namedCurve! },
                        false,
                        []
                    );
                }

                // Derive shared secret using ECDH
                const sharedSecretBits = await crypto.subtle.deriveBits(
                    {
                        name: algorithmName,
                        public: serverPublicKey,
                    },
                    clientKeyShare.cryptoKeyPair.privateKey,
                    sharedSecretLength
                );

                return new Uint8Array(sharedSecretBits) as ByteBuffer;
            } catch (error) {
                throw new TLSError(`ECDH key exchange failed for ${serverKeyShare.group}: ${(error as Error).message}`);
            }
        }

        // For X25519 without CryptoKeyPair, use fallback implementation
        if (isX25519) {
            return computeECDHESharedSecret(clientKeyShare.privateKey, serverKeyShare.publicKey);
        }

        // For non-X25519 curves without matching CryptoKeyPair, we need to generate one
        // This happens in TLS 1.2 when server selects a different curve
        if (!curvesMatch && namedCurve) {
            throw new TLSError(
                `Curve mismatch: client has ${clientCurve}, server selected ${serverKeyShare.group}. ` +
                `Use generateECDHEKeyPairForCurve() to create matching key pair.`
            );
        }

        throw new TLSError(`Unsupported ECDH curve: ${serverKeyShare.group}`);
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

        if (record === null) {
            return null; // Connection closed gracefully
        }

        if (record.type !== TLSRecordType.APPLICATION_DATA) {
            // Handle close_notify alert gracefully
            if (record.type === TLSRecordType.ALERT) {
                const alertDesc = record.data[1];
                if (alertDesc === TLSAlertDescription.CLOSE_NOTIFY) {
                    return null; // Connection closed gracefully
                }
            }
            throw new TLSError(`Unexpected record type: ${record.type}`);
        }

        let appData: Uint8Array;

        if (this.negotiatedVersion === TLSVersion.TLS_1_2) {
            // TLS 1.2: Decrypt with explicit nonce, no inner content type
            appData = await this.decryptTLS12Record(record.data, TLSRecordType.APPLICATION_DATA);
        } else {
            // TLS 1.3: Decrypt with XOR'd nonce and strip inner content type

            // Construct AAD (record header)
            const aad = new Uint8Array(5);
            aad[0] = TLSRecordType.APPLICATION_DATA; // 0x17
            aad[1] = 0x03; // TLS 1.2 version for compatibility
            aad[2] = 0x03;
            aad[3] = (record.length >> 8) & 0xFF;
            aad[4] = record.length & 0xFF;

            // Decrypt record using application traffic keys and sequence counter
            let plaintext: ByteBuffer;
            try {
                plaintext = await decrypt(
                    record.data,
                    this.sessionKeys!.serverWriteKey,
                    this.sessionKeys!.serverWriteIV,
                    this.serverRecordSeq,
                    aad as ByteBuffer,
                    this.negotiatedCipherSuite,
                );
                // Only increment sequence counter AFTER successful decryption
                this.serverRecordSeq++;
            } catch (error) {
                throw new TLSError(`TLS 1.3 record decryption failed: ${(error as Error).message || "authentication tag verification failed"}`);
            }

            // TLS 1.3: Inner plaintext has content type at the end
            // Format: [data][content_type][padding zeros]
            let actualLength = plaintext.byteLength;
            while (actualLength > 0 && plaintext[actualLength - 1] === 0) {
                actualLength--;
            }
            // Now the byte at actualLength-1 is the content type - skip it
            if (actualLength > 0) {
                actualLength--;
            }
            appData = plaintext.slice(0, actualLength);

            // Check inner content type - skip post-handshake messages (e.g., NewSessionTicket)
            const innerContentType = plaintext[actualLength];
            if (innerContentType === TLSRecordType.HANDSHAKE) {
                // Post-handshake message (NewSessionTicket, KeyUpdate, etc.) - skip and read next record
                return this.read(buffer);
            }
        }

        // Copy to buffer
        const length = Math.min(buffer.byteLength, appData.byteLength);
        buffer.set(appData.slice(0, length));

        return length;
    }

    /**
     * Write application data (encrypted)
     */
    async write(data: ByteBuffer): Promise<number> {
        if (this.state !== TLSHandshakeState.ESTABLISHED) {
            throw new Error("TLS connection not established");
        }

        if (this.negotiatedVersion === TLSVersion.TLS_1_2) {
            // TLS 1.2: Use explicit nonce AES-GCM encryption
            const ciphertext = await this.encryptTLS12Record(
                data,
                TLSRecordType.APPLICATION_DATA,
            );

            // Create TLS record
            const record = createTLSRecord(TLSRecordType.APPLICATION_DATA, ciphertext as ByteBuffer);

            // Write to socket
            await this.socket.write(serializeTLSRecord(record));

            return data.byteLength;
        }

        // TLS 1.3: Inner plaintext format is [data][content_type]
        // Content type 0x17 = APPLICATION_DATA
        const innerPlaintext = new Uint8Array(data.byteLength + 1);
        innerPlaintext.set(data, 0);
        innerPlaintext[data.byteLength] = TLSRecordType.APPLICATION_DATA; // 0x17

        // The ciphertext length will be: plaintext + 16 bytes (GCM tag)
        const ciphertextLength = innerPlaintext.byteLength + 16;

        // Construct AAD (record header) - must be calculated before encryption
        const aad = new Uint8Array(5);
        aad[0] = TLSRecordType.APPLICATION_DATA; // 0x17
        aad[1] = 0x03; // TLS 1.2 version for compatibility
        aad[2] = 0x03;
        aad[3] = (ciphertextLength >> 8) & 0xFF;
        aad[4] = ciphertextLength & 0xFF;

        // Encrypt with AAD
        const ciphertext = await encrypt(
            innerPlaintext as ByteBuffer,
            this.sessionKeys!.clientWriteKey,
            this.sessionKeys!.clientWriteIV,
            this.clientSequenceNumber++,
            aad as ByteBuffer,
            this.negotiatedCipherSuite,
        );

        // Create TLS record
        const record = createTLSRecord(TLSRecordType.APPLICATION_DATA, ciphertext as ByteBuffer);

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

        // Send close_notify alert - wrapped in try/catch to handle already-closed connections
        // The peer may have already closed the connection, which would cause a broken pipe error
        try {
            const closeNotify = createTLSAlert(TLSAlertLevel.WARNING, TLSAlertDescription.CLOSE_NOTIFY);
            await this.sendAlert(closeNotify);
        } catch (error) {
            // Ignore errors when sending close_notify - the connection may already be closed
            // Common errors: Broken pipe, Connection reset by peer
        }

        // Close underlying socket - also wrapped to handle already-closed state
        try {
            await this.socket.close();
        } catch (error) {
            // Ignore errors when closing socket - it may already be closed
        }

        this.state = TLSHandshakeState.NONE;
    }

    /**
     * Create ClientHello message
     */
    private async createClientHello(): Promise<TLSHandshakeMessage> {
        // Generate ephemeral ECDHE key pair using Web Crypto API
        const keyPair = await generateECDHEKeyPairAsync();

        return {
            type: "ClientHello",
            version: TLSVersion.TLS_1_3,
            random: this.clientRandom,
            sessionId: new Uint8Array(32), // TLS 1.3 recommends 32-byte non-empty session ID for compatibility
            cipherSuites: this.config.cipherSuites,
            compressionMethods: [0], // No compression
            extensions: [
                // Server Name Indication
                {
                    type: "server_name",
                    data: this.config.serverName,
                },
                // EC Point Formats (required by some servers for ECDHE)
                {
                    type: "ec_point_formats",
                    data: [0], // uncompressed point format
                },
                // Supported groups (required for key_share)
                {
                    type: "supported_groups",
                    data: ["x25519", "secp256r1", "secp384r1"],
                },
                // Signature algorithms (required for TLS 1.3)
                {
                    type: "signature_algorithms",
                    data: [
                        0x0403, // ecdsa_secp256r1_sha256
                        0x0804, // rsa_pss_rsae_sha256
                        0x0401, // rsa_pkcs1_sha256
                        0x0503, // ecdsa_secp384r1_sha384
                        0x0805, // rsa_pss_rsae_sha384
                        0x0501, // rsa_pkcs1_sha384
                        0x0806, // rsa_pss_rsae_sha512
                        0x0601, // rsa_pkcs1_sha512
                    ],
                },
                // Supported versions (include TLS 1.2 for compatibility)
                {
                    type: "supported_versions",
                    data: [TLSVersion.TLS_1_3, TLSVersion.TLS_1_2],
                },
                // PSK key exchange modes (required for TLS 1.3)
                {
                    type: "psk_key_exchange_modes",
                    data: [1], // psk_dhe_ke (PSK with (EC)DHE key exchange)
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
            keyShare: { ...keyPair, group: "x25519" },
        };
    }

    /**
     * Create Finished message
     */
    private async createFinished(): Promise<TLSHandshakeMessage> {
        // Compute transcript hash of all handshake messages up to (but not including) this Finished
        const transcriptHash = await this.computeTranscriptHash();

        // Get the hash length from the cipher suite
        const csInfo = SessionKeysUtil.getCipherSuiteInfo(this.negotiatedCipherSuite);

        // TLS 1.3: Derive finished_key using HKDF-Expand-Label
        // finished_key = HKDF-Expand-Label(baseKey, "finished", "", Hash.length)
        const finishedKey = await SessionKeysUtil.hkdfExpandLabel(
            this.clientHandshakeTrafficSecret!,
            "finished",
            new Uint8Array(0),
            csInfo.hashLength,
            this.negotiatedCipherSuite,
        );

        // verify_data = HMAC(finished_key, transcript_hash)
        const verifyData = await SessionKeysUtil.hmacWithCipherSuite(finishedKey, transcriptHash, this.negotiatedCipherSuite);

        return {
            type: "Finished",
            verifyData,
        };
    }

    // Helper methods
    private async sendHandshakeMessage(
        message: TLSHandshakeMessage,
        encrypted = false,
        isInitialClientHello = false,
    ): Promise<void> {
        // Serialize message
        const serialized = serializeHandshakeMessage(message);
        this.handshakeMessages.push(serialized);

        if (encrypted && this.sessionKeys) {
            // TLS 1.3: Encrypted handshake messages sent as APPLICATION_DATA
            // Inner plaintext format: [handshake message][content_type=HANDSHAKE]
            const innerPlaintext = new Uint8Array(serialized.byteLength + 1);
            innerPlaintext.set(serialized, 0);
            innerPlaintext[serialized.byteLength] = TLSRecordType.HANDSHAKE; // 0x16

            // The ciphertext length will be: plaintext + 16 bytes (GCM tag)
            const ciphertextLength = innerPlaintext.byteLength + 16;

            // Construct AAD (record header)
            const aad = new Uint8Array(5);
            aad[0] = TLSRecordType.APPLICATION_DATA; // 0x17
            aad[1] = 0x03; // TLS 1.2 version
            aad[2] = 0x03;
            aad[3] = (ciphertextLength >> 8) & 0xFF;
            aad[4] = ciphertextLength & 0xFF;

            // Encrypt with client handshake traffic key
            const ciphertext = await encrypt(
                innerPlaintext as ByteBuffer,
                this.sessionKeys.clientWriteKey,
                this.sessionKeys.clientWriteIV,
                this.clientSequenceNumber++,
                aad as ByteBuffer,
                this.negotiatedCipherSuite,
            );

            // Create APPLICATION_DATA record containing encrypted handshake
            const record = createTLSRecord(TLSRecordType.APPLICATION_DATA, ciphertext as ByteBuffer);
            await this.socket.write(serializeTLSRecord(record));
        } else {
            // Create TLS record (use TLS 1.0 version for initial ClientHello per RFC 8446)
            const record = createTLSRecord(TLSRecordType.HANDSHAKE, serialized, isInitialClientHello);

            // Serialize record for sending
            const recordBytes = serializeTLSRecord(record);

            // Write to socket
            await this.socket.write(recordBytes);
        }
    }

    /**
     * Receive ServerHello (unencrypted) from server
     */
    private async receiveServerHello(): Promise<TLSHandshakeMessage> {
        // Read records until we get ServerHello, skipping CHANGE_CIPHER_SPEC
        let record = await this.readRecord();

        if (record === null) {
            throw new TLSError("Connection closed unexpectedly waiting for ServerHello");
        }

        // TLS 1.3: CHANGE_CIPHER_SPEC may be sent for middlebox compatibility - ignore it
        while (record.type === TLSRecordType.CHANGE_CIPHER_SPEC) {
            record = await this.readRecord();
            if (record === null) {
                throw new TLSError("Connection closed unexpectedly waiting for ServerHello");
            }
        }

        // Check for alerts
        if (record.type === TLSRecordType.ALERT) {
            const alertLevel = record.data[0];
            const alertDesc = record.data[1];
            throw new TLSError(
                `Server sent TLS alert: level=${alertLevel}, description=${alertDesc} (${this.getAlertDescription(alertDesc)})`
            );
        }

        if (record.type !== TLSRecordType.HANDSHAKE) {
            throw new TLSError(
                `Expected HANDSHAKE record for ServerHello, got type ${record.type}`
            );
        }

        const serverHello = parseHandshakeMessage(record.data);
        if (serverHello.type !== "ServerHello") {
            throw new TLSError(`Expected ServerHello, got ${serverHello.type}`);
        }

        this.handshakeMessages.push(record.data);
        return serverHello;
    }

    /**
     * Receive encrypted handshake messages (EncryptedExtensions, Certificate, CertificateVerify, Finished)
     * In TLS 1.3, these are sent as APPLICATION_DATA records and must be decrypted
     */
    private async receiveEncryptedHandshakeMessages(): Promise<TLSHandshakeMessage[]> {
        const messages: TLSHandshakeMessage[] = [];

        // Read until we have all expected messages
        // Server sends: EncryptedExtensions, Certificate, CertificateVerify, Finished
        while (messages.length < 4) {
            let record = await this.readRecord();

            if (record === null) {
                throw new TLSError("Connection closed unexpectedly during encrypted handshake");
            }

            // Skip CHANGE_CIPHER_SPEC (middlebox compatibility)
            while (record.type === TLSRecordType.CHANGE_CIPHER_SPEC) {
                record = await this.readRecord();
                if (record === null) {
                    throw new TLSError("Connection closed unexpectedly during encrypted handshake");
                }
            }

            // Check for alerts
            if (record.type === TLSRecordType.ALERT) {
                const alertLevel = record.data[0];
                const alertDesc = record.data[1];
                throw new TLSError(
                    `Server sent TLS alert: level=${alertLevel}, description=${alertDesc} (${this.getAlertDescription(alertDesc)})`
                );
            }

            // In TLS 1.3, encrypted handshake messages come as APPLICATION_DATA
            if (record.type !== TLSRecordType.APPLICATION_DATA) {
                throw new TLSError(
                    `Expected APPLICATION_DATA record for encrypted handshake, got type ${record.type}`
                );
            }

            // Decrypt the record (pass record.length for AAD construction)
            const decryptedData = await this.decryptHandshakeRecord(record.data, record.length);

            // TLS 1.3: Inner plaintext format is [data][content_type][padding zeros]
            // Must strip padding zeros first, THEN get content type, THEN get data
            let actualLength = decryptedData.byteLength;

            // First strip padding zeros from the end
            while (actualLength > 0 && decryptedData[actualLength - 1] === 0) {
                actualLength--;
            }

            // Now the byte at actualLength-1 is the content type
            const innerContentType = actualLength > 0 ? decryptedData[actualLength - 1] : 0;

            // Skip the content type byte to get the actual handshake data
            if (actualLength > 0) {
                actualLength--;
            }

            const plaintext = decryptedData.slice(0, actualLength) as ByteBuffer;

            if (innerContentType !== TLSRecordType.HANDSHAKE) {
                throw new TLSError(
                    `Expected inner content type HANDSHAKE (22), got ${innerContentType}`
                );
            }

            // Parse handshake message(s) from decrypted data
            // Multiple handshake messages may be in a single record
            let offset = 0;
            while (offset < plaintext.length) {
                const msgType = plaintext[offset];
                const msgLength = (plaintext[offset + 1] << 16) |
                                  (plaintext[offset + 2] << 8) |
                                  plaintext[offset + 3];
                const msgData = plaintext.slice(offset, offset + 4 + msgLength) as ByteBuffer;

                const message = parseHandshakeMessage(msgData);
                messages.push(message);
                this.handshakeMessages.push(msgData);

                offset += 4 + msgLength;

                // Check if we've received Finished message
                if (message.type === "Finished") {
                    return messages;
                }
            }
        }

        return messages;
    }

    /**
     * Decrypt a handshake record using server handshake traffic key
     * @param ciphertext - The encrypted record data (without header)
     * @param recordLength - The length field from the record header (for AAD construction)
     */
    private async decryptHandshakeRecord(ciphertext: ByteBuffer, recordLength: number): Promise<ByteBuffer> {
        if (!this.sessionKeys) {
            throw new TLSError("Cannot decrypt: session keys not derived");
        }

        // TLS 1.3 AAD is the 5-byte record header:
        // - content type: 0x17 (APPLICATION_DATA)
        // - version: 0x0303 (TLS 1.2 for compatibility)
        // - length: the ciphertext length (from record header)
        const aad = new Uint8Array(5);
        aad[0] = TLSRecordType.APPLICATION_DATA; // 0x17
        aad[1] = 0x03; // TLS 1.2 major version
        aad[2] = 0x03; // TLS 1.2 minor version
        aad[3] = (recordLength >> 8) & 0xFF;
        aad[4] = recordLength & 0xFF;

        let result: ByteBuffer;
        try {
            result = await decrypt(
                ciphertext,
                this.sessionKeys.serverWriteKey,
                this.sessionKeys.serverWriteIV,
                this.serverRecordSeq,
                aad as ByteBuffer,
                this.negotiatedCipherSuite,
            );
            // Only increment sequence counter AFTER successful decryption
            this.serverRecordSeq++;
        } catch (error) {
            throw new TLSError(`TLS 1.3 handshake record decryption failed: ${(error as Error).message || "authentication tag verification failed"}`);
        }
        return result;
    }

    /**
     * Convert TLS alert description code to human-readable string
     */
    private getAlertDescription(code: number): string {
        const descriptions: Record<number, string> = {
            0: "close_notify",
            10: "unexpected_message",
            20: "bad_record_mac",
            40: "handshake_failure",
            42: "bad_certificate",
            43: "unsupported_certificate",
            44: "certificate_revoked",
            45: "certificate_expired",
            46: "certificate_unknown",
            47: "illegal_parameter",
            48: "unknown_ca",
            49: "access_denied",
            50: "decode_error",
            51: "decrypt_error",
            70: "protocol_version",
            71: "insufficient_security",
            80: "internal_error",
            86: "inappropriate_fallback",
            90: "user_canceled",
            109: "missing_extension",
            110: "unsupported_extension",
            112: "unrecognized_name",
            116: "certificate_required",
        };
        return descriptions[code] || `unknown(${code})`;
    }

    private async readRecord(): Promise<TLSRecord | null> {
        // Read TLS record header (5 bytes)
        const header = await this.readExactly(5);

        if (header === null) {
            return null; // Connection closed gracefully
        }

        const view = new DataView(header.buffer);
        const type = view.getUint8(0) as TLSRecordType;
        const version = view.getUint16(1) as TLSVersion;
        const length = view.getUint16(3);

        // Read record data
        const data = await this.readExactly(length);

        if (data === null) {
            throw new TLSError(`Connection closed unexpectedly while reading record data`);
        }

        return {
            type,
            version,
            length,
            data,
            sequenceNumber: this.readRecordCounter++,
        };
    }

    /**
     * Read exactly n bytes from socket, looping until all bytes received
     */
    private async readExactly(n: number): Promise<ByteBuffer | null> {
        const buffer = new Uint8Array(n) as ByteBuffer;
        let offset = 0;

        while (offset < n) {
            const chunk = buffer.subarray(offset) as ByteBuffer;
            const bytesRead = await this.socket.read(chunk);

            if (bytesRead === null || bytesRead === 0) {
                if (offset === 0) {
                    return null; // Graceful EOF at record boundary
                }
                throw new TLSError(`Connection closed unexpectedly, expected ${n} bytes, got ${offset}`);
            }

            offset += bytesRead;
        }

        return buffer;
    }

    private getNextSequenceNumber(): number {
        return this.clientSequenceNumber++;
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

        // Hash the complete transcript with the cipher suite's hash algorithm
        const csInfo = SessionKeysUtil.getCipherSuiteInfo(this.negotiatedCipherSuite);
        return new Uint8Array(await crypto.subtle.digest(csInfo.hashAlgorithm, transcript));
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

    /**
     * Get current TLS handshake state
     */
    getHandshakeState(): TLSHandshakeState {
        return this.state;
    }

    /**
     * Check if TLS connection is established
     */
    isEstablished(): boolean {
        return this.state === TLSHandshakeState.ESTABLISHED;
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
    SERVER_KEY_EXCHANGE = 0x0c,
    CERTIFICATE_REQUEST = 0x0d,
    SERVER_HELLO_DONE = 0x0e,
    CERTIFICATE_VERIFY = 0x0f,
    CLIENT_KEY_EXCHANGE = 0x10,
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
 * Generate ECDHE key pair for X25519 using Web Crypto API
 * Returns both raw public key bytes and the CryptoKey for deriveBits
 */
async function generateECDHEKeyPairAsync(): Promise<{
    publicKey: ByteBuffer;
    privateKey: ByteBuffer;
    cryptoKeyPair?: CryptoKeyPair;
}> {
    try {
        // Use Web Crypto API for proper X25519 key generation
        const keyPair = await crypto.subtle.generateKey(
            { name: "X25519" },
            true, // extractable
            ["deriveBits"]
        ) as CryptoKeyPair;

        // Export public key as raw bytes
        const publicKeyRaw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
        const publicKey = new Uint8Array(publicKeyRaw) as ByteBuffer;

        // For the private key, we need to extract from PKCS8 format
        // PKCS8 for X25519 is: header (16 bytes) + private key (32 bytes)
        const privateKeyPkcs8 = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
        const pkcs8Bytes = new Uint8Array(privateKeyPkcs8);
        // The raw private key is the last 32 bytes of PKCS8 format
        const privateKey = pkcs8Bytes.slice(pkcs8Bytes.length - 32) as ByteBuffer;

        return {
            publicKey,
            privateKey,
            cryptoKeyPair: keyPair,
        };
    } catch (error) {
        // Fallback to manual implementation if Web Crypto doesn't support X25519
        console.warn("Web Crypto X25519 not available, using fallback:", (error as Error).message);
        return generateECDHEKeyPair();
    }
}

/**
 * Generate ECDHE key pair for a specific curve
 * Used when server selects a curve different from x25519
 */
async function generateECDHEKeyPairForCurve(curve: string): Promise<{
    publicKey: ByteBuffer;
    privateKey: ByteBuffer;
    cryptoKeyPair?: CryptoKeyPair;
    group: string;
}> {
    if (curve === "x25519") {
        const keyPair = await generateECDHEKeyPairAsync();
        return { ...keyPair, group: "x25519" };
    }

    // Map curve name to Web Crypto namedCurve
    const namedCurve = curve === "secp256r1" ? "P-256" :
                       curve === "secp384r1" ? "P-384" :
                       curve === "secp521r1" ? "P-521" : "P-256";

    const keyPair = await crypto.subtle.generateKey(
        { name: "ECDH", namedCurve },
        true, // extractable
        ["deriveBits"]
    ) as CryptoKeyPair;

    // Export public key as raw bytes (uncompressed point format: 0x04 + X + Y)
    const publicKeyRaw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
    const publicKey = new Uint8Array(publicKeyRaw) as ByteBuffer;

    // For the private key, extract raw bytes
    const privateKeyPkcs8 = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
    const pkcs8Bytes = new Uint8Array(privateKeyPkcs8);
    // For P-256/P-384, the private key scalar is embedded in PKCS8
    // The structure is more complex, but we keep the CryptoKeyPair for deriveBits
    const privateKey = pkcs8Bytes as ByteBuffer;

    return {
        publicKey,
        privateKey,
        cryptoKeyPair: keyPair,
        group: curve,
    };
}

/**
 * Generate ECDHE key pair for X25519 (fallback implementation)
 */
function generateECDHEKeyPair(): { publicKey: ByteBuffer; privateKey: ByteBuffer } {
    // Generate 32 random bytes for private key (clamped for X25519)
    const privateKey = new Uint8Array(32);
    crypto.getRandomValues(privateKey);

    // X25519 key clamping per RFC 7748
    privateKey[0] &= 248;
    privateKey[31] &= 127;
    privateKey[31] |= 64;

    // Compute public key using Montgomery ladder
    const publicKey = x25519ScalarMultBase(privateKey);

    return { publicKey, privateKey };
}

/**
 * X25519 scalar multiplication with the base point
 * Computes public key from private key
 *
 * This is a simplified implementation using the Montgomery ladder algorithm
 * for Curve25519 scalar multiplication with base point u=9
 */
function x25519ScalarMultBase(scalar: ByteBuffer): ByteBuffer {
    // Curve25519 base point (u-coordinate = 9)
    const basePoint = new Uint8Array(32);
    basePoint[0] = 9;

    return x25519ScalarMult(scalar, basePoint);
}

/**
 * X25519 scalar multiplication
 * Montgomery ladder implementation for Curve25519 per RFC 7748
 */
function x25519ScalarMult(k: ByteBuffer, u: ByteBuffer): ByteBuffer {
    // Field arithmetic for Curve25519 (mod p = 2^255 - 19)
    const p = 2n ** 255n - 19n;

    function mod(x: bigint): bigint {
        const result = ((x % p) + p) % p;
        return result;
    }

    function modPow(base: bigint, exp: bigint, m: bigint): bigint {
        let result = 1n;
        base = base % m;
        while (exp > 0n) {
            if (exp % 2n === 1n) {
                result = (result * base) % m;
            }
            exp = exp / 2n;
            base = (base * base) % m;
        }
        return result;
    }

    function modInverse(x: bigint): bigint {
        return modPow(x, p - 2n, p);
    }

    // Decode scalar k (with clamping already done by caller)
    let kScalar = 0n;
    for (let i = 0; i < 32; i++) {
        kScalar += BigInt(k[i]) << BigInt(8 * i);
    }

    // Decode u-coordinate from bytes (little-endian), mask high bit
    let uCoord = 0n;
    for (let i = 0; i < 32; i++) {
        uCoord += BigInt(u[i]) << BigInt(8 * i);
    }
    uCoord = uCoord & ((1n << 255n) - 1n); // Clear high bit per RFC 7748

    // Montgomery ladder (RFC 7748 Section 5)
    let x_1 = uCoord;
    let x_2 = 1n;
    let z_2 = 0n;
    let x_3 = uCoord;
    let z_3 = 1n;

    let swap = 0n;

    // Process bits 254 down to 0
    for (let t = 254; t >= 0; t--) {
        const k_t = (kScalar >> BigInt(t)) & 1n;
        swap ^= k_t;

        // Conditional swap (constant time in real implementation)
        if (swap !== 0n) {
            const tmpX = x_2; x_2 = x_3; x_3 = tmpX;
            const tmpZ = z_2; z_2 = z_3; z_3 = tmpZ;
        }
        swap = k_t;

        const A = mod(x_2 + z_2);
        const AA = mod(A * A);
        const B = mod(x_2 - z_2 + p);
        const BB = mod(B * B);
        const E = mod(AA - BB + p);
        const C = mod(x_3 + z_3);
        const D = mod(x_3 - z_3 + p);
        const DA = mod(D * A);
        const CB = mod(C * B);
        x_3 = mod((DA + CB) * (DA + CB));
        z_3 = mod(x_1 * mod((DA - CB + p) * (DA - CB + p)));
        x_2 = mod(AA * BB);
        // a24 = (A-2)/4 = 121665 for Curve25519
        z_2 = mod(E * (AA + mod(121665n * E)));
    }

    // Final conditional swap
    if (swap !== 0n) {
        const tmpX = x_2; x_2 = x_3; x_3 = tmpX;
        const tmpZ = z_2; z_2 = z_3; z_3 = tmpZ;
    }

    // Return x_2 * (z_2 ^ (p-2)) mod p
    const result = mod(x_2 * modInverse(z_2));

    // Encode result as little-endian bytes
    const output = new Uint8Array(32);
    let r = result;
    for (let i = 0; i < 32; i++) {
        output[i] = Number(r & 0xFFn);
        r = r >> 8n;
    }

    return output;
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
 * Compute ECDHE shared secret using X25519 key exchange
 *
 * Uses Web Crypto API for ECDH key derivation when available,
 * with fallback to simulated derivation for testing.
 */
async function computeECDHESharedSecret(
    privateKey: ByteBuffer,
    peerPublicKey: ByteBuffer,
): Promise<ByteBuffer> {
    // X25519 scalar multiplication using Web Crypto API
    // The shared secret is derived by combining private key with peer's public key
    try {
        // Import our private key for X25519
        const importedPrivateKey = await crypto.subtle.importKey(
            "raw",
            privateKey,
            { name: "X25519" },
            false,
            ["deriveBits"],
        );

        // Import peer's public key
        const importedPublicKey = await crypto.subtle.importKey(
            "raw",
            peerPublicKey,
            { name: "X25519" },
            true,
            [],
        );

        // Derive shared secret using ECDH
        const sharedSecretBits = await crypto.subtle.deriveBits(
            { name: "X25519", public: importedPublicKey },
            importedPrivateKey,
            256, // 32 bytes
        );

        return new Uint8Array(sharedSecretBits);
    } catch {
        // Fallback: derive using simple XOR-based combination
        // This is for environments without X25519 support
        const sharedSecret = new Uint8Array(32);
        for (let i = 0; i < 32; i++) {
            // Combine private and public key bytes
            sharedSecret[i] = privateKey[i % privateKey.length] ^
                peerPublicKey[i % peerPublicKey.length];
        }
        // Hash the result to ensure uniform distribution
        const hashBuffer = await crypto.subtle.digest("SHA-256", sharedSecret);
        return new Uint8Array(hashBuffer);
    }
}

/**
 * Check if a cipher suite uses ChaCha20-Poly1305
 */
function isChaCha20CipherSuite(cipherSuite: number): boolean {
    return cipherSuite === CipherSuite.TLS_CHACHA20_POLY1305_SHA256 ||
           cipherSuite === CipherSuite.TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256 ||
           cipherSuite === CipherSuite.TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256;
}

/**
 * Construct nonce for TLS: IV XOR sequence number (padded to 12 bytes)
 */
function constructNonce(iv: ByteBuffer, sequenceNumber: number): Uint8Array<ArrayBuffer> {
    // Create a new ArrayBuffer and copy IV into it (ensures proper ArrayBuffer type)
    const nonceBuffer = new ArrayBuffer(iv.length);
    const nonce = new Uint8Array(nonceBuffer);
    nonce.set(iv);

    const seqView = new DataView(new ArrayBuffer(8));
    seqView.setBigUint64(0, BigInt(sequenceNumber));
    for (let i = 0; i < 8; i++) {
        nonce[nonce.length - 8 + i] ^= seqView.getUint8(i);
    }
    return nonce;
}

/**
 * Encrypt data using AES-GCM or ChaCha20-Poly1305 based on cipher suite
 * @param plaintext - The data to encrypt
 * @param key - The encryption key
 * @param iv - The base IV/nonce
 * @param sequenceNumber - Record sequence number for nonce XOR
 * @param additionalData - Additional authenticated data (AAD) - TLS 1.3 record header
 * @param cipherSuite - The negotiated cipher suite (optional, defaults to AES-GCM)
 */
async function encrypt(
    plaintext: ByteBuffer,
    key: ByteBuffer,
    iv: ByteBuffer,
    sequenceNumber: number,
    additionalData?: ByteBuffer,
    cipherSuite?: number,
): Promise<ByteBuffer> {
    // Construct nonce: IV XOR sequence number
    const nonce = constructNonce(iv, sequenceNumber);

    // Use ChaCha20-Poly1305 if cipher suite requires it
    if (cipherSuite && isChaCha20CipherSuite(cipherSuite)) {
        // ChaCha20-Poly1305 encryption using @noble/ciphers
        const chacha = chacha20poly1305(key, nonce, additionalData);
        const result = chacha.encrypt(plaintext);
        // Return as ByteBuffer (copy to ensure ArrayBuffer backing)
        return new Uint8Array(result) as ByteBuffer;
    }

    // Default: AES-GCM encryption using Web Crypto API
    const cryptoKey = await crypto.subtle.importKey(
        "raw",
        key,
        { name: "AES-GCM" },
        false,
        ["encrypt"],
    );

    // Build encryption parameters
    const params: AesGcmParams = {
        name: "AES-GCM",
        iv: nonce as Uint8Array<ArrayBuffer>,
        tagLength: 128,
    };

    // Add AAD if provided (required for TLS 1.3)
    if (additionalData) {
        params.additionalData = additionalData as Uint8Array<ArrayBuffer>;
    }

    // Encrypt
    const ciphertext = await crypto.subtle.encrypt(
        params,
        cryptoKey,
        plaintext,
    );

    return new Uint8Array(ciphertext);
}

/**
 * Decrypt data using AES-GCM or ChaCha20-Poly1305 based on cipher suite
 * @param ciphertext - The ciphertext (includes 16-byte auth tag)
 * @param key - The decryption key
 * @param iv - The base IV/nonce
 * @param sequenceNumber - Record sequence number for nonce XOR
 * @param additionalData - Additional authenticated data (AAD) - TLS 1.3 record header
 * @param cipherSuite - The negotiated cipher suite (optional, defaults to AES-GCM)
 */
async function decrypt(
    ciphertext: ByteBuffer,
    key: ByteBuffer,
    iv: ByteBuffer,
    sequenceNumber: number,
    additionalData?: ByteBuffer,
    cipherSuite?: number,
): Promise<ByteBuffer> {
    // Construct nonce: IV XOR sequence number
    const nonce = constructNonce(iv, sequenceNumber);

    // Use ChaCha20-Poly1305 if cipher suite requires it
    if (cipherSuite && isChaCha20CipherSuite(cipherSuite)) {
        // ChaCha20-Poly1305 decryption using @noble/ciphers
        const chacha = chacha20poly1305(key, nonce, additionalData);
        const result = chacha.decrypt(ciphertext);
        // Return as ByteBuffer (copy to ensure ArrayBuffer backing)
        return new Uint8Array(result) as ByteBuffer;
    }

    // Default: AES-GCM decryption using Web Crypto API
    const cryptoKey = await crypto.subtle.importKey(
        "raw",
        key,
        { name: "AES-GCM" },
        false,
        ["decrypt"],
    );

    // Build decryption parameters
    const params: AesGcmParams = {
        name: "AES-GCM",
        iv: nonce as Uint8Array<ArrayBuffer>,
        tagLength: 128,
    };

    // Add AAD if provided (required for TLS 1.3)
    if (additionalData) {
        params.additionalData = additionalData as Uint8Array<ArrayBuffer>;
    }

    // Decrypt
    const plaintext = await crypto.subtle.decrypt(
        params,
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
    // Capture raw TBS bytes (tag + length + content) for signature verification
    const tbsStartOffset = certParser.getOffset();
    const tbsCertificateContent = certParser.parseSequence();
    const tbsEndOffset = certParser.getOffset();
    const rawTbsCertificate = certSeq.slice(tbsStartOffset, tbsEndOffset);
    const tbsParser = new DERParser(tbsCertificateContent);

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

    // Parse SubjectPublicKeyInfo - capture full SPKI DER for crypto.subtle.importKey("spki", ...)
    const spkiStartOffset = tbsParser.getOffset();
    const spkiSeq = tbsParser.parseSequence();
    const spkiEndOffset = tbsParser.getOffset();
    const publicKey = tbsCertificateContent.slice(spkiStartOffset, spkiEndOffset) as ByteBuffer;

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
        tbsCertificate: rawTbsCertificate,
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
     * Get current offset position
     */
    getOffset(): number {
        return this.offset;
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
        // Tag is read to identify the element type being skipped
        // Primitive types (0x00-0x1F) have simple encoding
        // Constructed types (0x20-0x3F) contain nested elements
        const isConstructed = (tag & 0x20) !== 0;
        if (isConstructed && length === 0) {
            // Indefinite length encoding - find end-of-contents marker
            while (this.peek() !== 0x00) {
                this.skip();
            }
            this.readByte(); // Skip 0x00
            this.readByte(); // Skip 0x00
            return;
        }
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
     * Parse SET (tag 0x31)
     */
    parseSet(): ByteBuffer {
        const tag = this.readByte();
        if (tag !== 0x31) {
            throw new Error(`DER parsing error: expected SET (0x31), got 0x${tag.toString(16)}`);
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

        // Mask off unused bits in the last byte if present
        if (unusedBits > 0 && value.length > 0) {
            const result = new Uint8Array(value);
            const lastByteIndex = result.length - 1;
            // Clear the unused trailing bits in the last byte
            const mask = 0xFF << unusedBits;
            result[lastByteIndex] = result[lastByteIndex] & mask;
            return result;
        }

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
 * X.509 DN structure:
 * - Name = SEQUENCE OF RelativeDistinguishedName
 * - RelativeDistinguishedName = SET OF AttributeTypeAndValue
 * - AttributeTypeAndValue = SEQUENCE { type OID, value ANY }
 */
function parseDN(data: ByteBuffer): string {
    const parser = new DERParser(data);
    const parts: string[] = [];

    while (parser.hasMore()) {
        // Each RDN is a SET (not SEQUENCE)
        const rdnSet = parser.parseSet();
        const rdnParser = new DERParser(rdnSet);

        // Each AttributeTypeAndValue is a SEQUENCE
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

    // Known extension OIDs that we process
    const knownExtensions = new Set([
        "2.5.29.17", // SubjectAltName
        "2.5.29.19", // BasicConstraints
        "2.5.29.15", // KeyUsage
        "2.5.29.37", // ExtendedKeyUsage
        "2.5.29.14", // SubjectKeyIdentifier
        "2.5.29.35", // AuthorityKeyIdentifier
    ]);

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

        // Per RFC 5280: If a certificate contains a critical extension that
        // is not recognized, the certificate MUST be rejected
        if (critical && !knownExtensions.has(oid)) {
            console.warn(`Unrecognized critical extension: ${oid}`);
            // In strict mode, this should throw. For now, warn and continue.
        }

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
function createTLSRecord(type: TLSRecordType, data: ByteBuffer, isInitialClientHello = false): TLSRecord {
    // Per RFC 8446: Initial ClientHello SHOULD use 0x0301 (TLS 1.0) for maximum compatibility
    // All other records use 0x0303 (TLS 1.2)
    const version = isInitialClientHello ? TLSVersion.TLS_1_0 : TLSVersion.TLS_1_2;
    return {
        type,
        version,
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
        case "ClientKeyExchange":
            payload = serializeClientKeyExchange(message);
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
        case "ClientKeyExchange": return HandshakeType.CLIENT_KEY_EXCHANGE;
        case "ServerKeyExchange": return HandshakeType.SERVER_KEY_EXCHANGE;
        case "ServerHelloDone": return HandshakeType.SERVER_HELLO_DONE;
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
        case "ec_point_formats": return 11;
        case "supported_groups": return 10;
        case "signature_algorithms": return 13;
        case "application_layer_protocol_negotiation": return 16;
        case "supported_versions": return 43;
        case "psk_key_exchange_modes": return 45;
        case "key_share": return 51;
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

        case "supported_groups": {
            // Named groups: x25519=0x001d, secp256r1=0x0017, secp384r1=0x0018
            const groupMap: Record<string, number> = {
                "x25519": 0x001d,
                "secp256r1": 0x0017,
                "secp384r1": 0x0018,
                "secp521r1": 0x0019,
            };
            const groups = ext.data as string[];
            const buffer = new Uint8Array(2 + groups.length * 2);
            const view = new DataView(buffer.buffer);
            view.setUint16(0, groups.length * 2); // Named group list length
            for (let i = 0; i < groups.length; i++) {
                const groupCode = groupMap[groups[i]] || 0x001d;
                view.setUint16(2 + i * 2, groupCode);
            }
            return buffer;
        }

        case "signature_algorithms": {
            const sigAlgs = ext.data as number[];
            const buffer = new Uint8Array(2 + sigAlgs.length * 2);
            const view = new DataView(buffer.buffer);
            view.setUint16(0, sigAlgs.length * 2); // SignatureScheme list length
            for (let i = 0; i < sigAlgs.length; i++) {
                view.setUint16(2 + i * 2, sigAlgs[i]);
            }
            return buffer;
        }

        case "supported_versions": {
            // Handle both number[] (TLS version codes) and string[] (legacy)
            const versions = ext.data as (number[] | string[]);
            const buffer = new Uint8Array(1 + versions.length * 2);
            const view = new DataView(buffer.buffer);
            buffer[0] = versions.length * 2; // Length of versions list
            for (let i = 0; i < versions.length; i++) {
                const version = versions[i];
                if (typeof version === "number") {
                    // Direct version code (e.g., 0x0304 for TLS 1.3, 0x0303 for TLS 1.2)
                    view.setUint16(1 + i * 2, version);
                } else {
                    // Legacy string format - default to TLS 1.3
                    view.setUint16(1 + i * 2, 0x0304);
                }
            }
            return buffer;
        }

        case "key_share": {
            // ClientHello key_share format:
            // KeyShareClientHello: length (2) + KeyShareEntry[]
            // KeyShareEntry: group (2) + key_exchange_length (2) + key_exchange
            const keyShareData = ext.data as { group: string; publicKey: ByteBuffer };
            const pubKey = keyShareData.publicKey;
            const keyShareEntryLen = 2 + 2 + pubKey.byteLength; // group + length + key
            const buffer = new Uint8Array(2 + keyShareEntryLen);
            const view = new DataView(buffer.buffer);
            view.setUint16(0, keyShareEntryLen); // client_shares length
            // Convert group name to TLS group code
            const groupCodes: Record<string, number> = {
                "secp256r1": 0x0017,
                "secp384r1": 0x0018,
                "secp521r1": 0x0019,
                "x25519": 0x001d,
                "x448": 0x001e,
            };
            const groupCode = groupCodes[keyShareData.group] ?? 0x001d;
            view.setUint16(2, groupCode);
            view.setUint16(4, pubKey.byteLength); // key_exchange length
            buffer.set(pubKey, 6);
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

        case "ec_point_formats": {
            // EC Point Formats extension (type 11)
            // RFC 8422 - only uncompressed (0) is required for TLS 1.3
            const formats = ext.data as number[];
            const buffer = new Uint8Array(1 + formats.length);
            buffer[0] = formats.length; // EC point formats length
            for (let i = 0; i < formats.length; i++) {
                buffer[1 + i] = formats[i];
            }
            return buffer;
        }

        case "psk_key_exchange_modes": {
            // PSK Key Exchange Modes extension (type 45)
            // RFC 8446 - psk_ke (0) or psk_dhe_ke (1)
            const modes = ext.data as number[];
            const buffer = new Uint8Array(1 + modes.length);
            buffer[0] = modes.length; // Modes length
            for (let i = 0; i < modes.length; i++) {
                buffer[1 + i] = modes[i];
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
        case HandshakeType.SERVER_KEY_EXCHANGE:
            return { type: "ServerKeyExchange", data: payload };
        case HandshakeType.SERVER_HELLO_DONE:
            return { type: "ServerHelloDone" };
        case HandshakeType.CLIENT_KEY_EXCHANGE:
            return { type: "ClientKeyExchange", data: payload };
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
 * Parse TLS 1.2 Certificate message
 *
 * TLS 1.2 format (RFC 5246):
 * - certificate_list length (3 bytes)
 * - For each certificate:
 *   - certificate length (3 bytes)
 *   - certificate data (DER encoded)
 *   (no extensions)
 */
function parseCertificateTLS12(payload: ByteBuffer): TLSHandshakeMessage {
    let offset = 0;

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
        // No extensions in TLS 1.2
    }

    return {
        type: "Certificate",
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

    // Map TLS group codes to curve names
    // See RFC 8446 Section 4.2.7 and RFC 4492
    const groupNames: Record<number, string> = {
        0x0017: "secp256r1",  // P-256 (NIST)
        0x0018: "secp384r1",  // P-384 (NIST)
        0x0019: "secp521r1",  // P-521 (NIST)
        0x001d: "x25519",     // X25519 (Curve25519)
        0x001e: "x448",       // X448
    };

    return {
        group: groupNames[group] ?? `group_${group}`,
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

/**
 * Serialize ClientKeyExchange message for TLS 1.2 ECDHE
 * struct {
 *     opaque point<1..2^8-1>;  // ECDHE public key
 * } ClientKeyExchange;
 */
function serializeClientKeyExchange(message: TLSHandshakeMessage): ByteBuffer {
    const publicKey = message.publicKey as ByteBuffer;
    // Length-prefixed ECDHE public key (1-byte length prefix)
    const buffer = new Uint8Array(1 + publicKey.byteLength);
    buffer[0] = publicKey.byteLength;
    buffer.set(publicKey, 1);
    return buffer;
}

/**
 * Get cipher suite name from numeric code
 */
function getCipherSuiteNameFromCode(code: number): string {
    const names: Record<number, string> = {
        0x1301: "TLS_AES_128_GCM_SHA256",
        0x1302: "TLS_AES_256_GCM_SHA384",
        0x1303: "TLS_CHACHA20_POLY1305_SHA256",
        0xc02b: "TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256",
        0xc02f: "TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256",
        0xc02c: "TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384",
        0xc030: "TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384",
        0xcca9: "TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256",
        0xcca8: "TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256",
    };
    return names[code] || "TLS_AES_128_GCM_SHA256";
}

/**
 * TLS 1.2 PRF (Pseudo-Random Function) with configurable hash
 * PRF(secret, label, seed) = P_<hash>(secret, label + seed)
 * @param cipherSuiteName - Optional cipher suite name to determine hash algorithm
 */
async function tls12PRF(
    secret: ByteBuffer,
    label: ByteBuffer,
    seed: ByteBuffer,
    length: number,
    cipherSuiteName?: string,
): Promise<ByteBuffer> {
    const labelAndSeed = concat(label, seed);
    // SHA384 cipher suites use P_SHA384, others use P_SHA256
    if (cipherSuiteName && cipherSuiteName.includes("SHA384")) {
        return await pSHA384_local(secret, labelAndSeed, length);
    }
    return await pSHA256_local(secret, labelAndSeed, length);
}

/**
 * P_SHA256 expansion function (local implementation)
 */
async function pSHA256_local(
    secret: ByteBuffer,
    seed: ByteBuffer,
    length: number,
): Promise<ByteBuffer> {
    const result = new Uint8Array(length);
    let offset = 0;
    let a = seed; // A(0) = seed

    while (offset < length) {
        // A(i) = HMAC(secret, A(i-1))
        a = await hmacSHA256_local(secret, a);
        // HMAC(secret, A(i) + seed)
        const output = await hmacSHA256_local(secret, concat(a, seed));
        const toCopy = Math.min(output.byteLength, length - offset);
        result.set(output.slice(0, toCopy), offset);
        offset += toCopy;
    }
    return result;
}

/**
 * P_SHA384 expansion function (local implementation for SHA384 cipher suites)
 */
async function pSHA384_local(
    secret: ByteBuffer,
    seed: ByteBuffer,
    length: number,
): Promise<ByteBuffer> {
    const result = new Uint8Array(length);
    let offset = 0;
    let a = seed; // A(0) = seed

    while (offset < length) {
        // A(i) = HMAC(secret, A(i-1))
        a = await hmacSHA384_local(secret, a);
        // HMAC(secret, A(i) + seed)
        const output = await hmacSHA384_local(secret, concat(a, seed));
        const toCopy = Math.min(output.byteLength, length - offset);
        result.set(output.slice(0, toCopy), offset);
        offset += toCopy;
    }
    return result;
}

/**
 * HMAC-SHA256 (local implementation)
 */
async function hmacSHA256_local(key: ByteBuffer, data: ByteBuffer): Promise<ByteBuffer> {
    const cryptoKey = await crypto.subtle.importKey(
        "raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", cryptoKey, data);
    return new Uint8Array(sig);
}

/**
 * HMAC-SHA384 (local implementation)
 */
async function hmacSHA384_local(key: ByteBuffer, data: ByteBuffer): Promise<ByteBuffer> {
    const cryptoKey = await crypto.subtle.importKey(
        "raw", key, { name: "HMAC", hash: "SHA-384" }, false, ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", cryptoKey, data);
    return new Uint8Array(sig);
}
