/**
 * TLS Module
 *
 * Exports TLS handshake and connection implementation
 */

export {
  TLS12_CIPHER_SUITES,
  TLS13_CIPHER_SUITES,
  TLSHandshake,
  TLSHandshakeState,
  TLSVersion,
} from "./tls_handshake.ts";
export type { CipherSuite, TLSCertificate, TLSHandshakeConfig } from "./tls_handshake.ts";

export { createTLSConnection, TLSConnection, wrapWithTLS } from "./tls_connection.ts";
export type {
  TLSConnectionConfig,
  TLSConnectionInfo,
  TLSConnectionStats,
} from "./tls_connection.ts";
