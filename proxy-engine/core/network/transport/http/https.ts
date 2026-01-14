/**
 * HTTPS Protocol Handler
 *
 * Wraps HTTP/1.1 with TLS encryption using Deno's native TLS support
 */

import { HTTP11Client, type HTTPRequest, type HTTPResponse } from "./http.ts";
import { Socket } from "../socket/socket.ts";

/**
 * TLS connection options
 */
export interface TLSOptions {
  /**
   * Server hostname for SNI (Server Name Indication)
   */
  hostname?: string;

  /**
   * Certificate authority bundle (PEM format)
   */
  caCerts?: string[];

  /**
   * Client certificate (PEM format)
   */
  cert?: string;

  /**
   * Client private key (PEM format)
   */
  key?: string;

  /**
   * ALPN protocols (e.g., ["h2", "http/1.1"])
   */
  alpnProtocols?: string[];
}

/**
 * HTTPS client configuration
 */
export interface HTTPSClientConfig {
  host: string;
  port?: number;
  tlsOptions?: TLSOptions;
  timeout?: number;
}

/**
 * HTTPS client
 */
export class HTTPSClient {
  private tlsConn: Deno.TlsConn | null = null;
  private socket: Socket | null = null;
  private httpClient: HTTP11Client | null = null;

  constructor(
    private host: string,
    private port: number = 443,
    private tlsOptions: TLSOptions = {},
  ) {}

  /**
   * Connect with TLS
   */
  async connect(timeout?: number): Promise<void> {
    const connectOptions: Deno.ConnectTlsOptions = {
      hostname: this.host,
      port: this.port,
      caCerts: this.tlsOptions.caCerts,
      alpnProtocols: this.tlsOptions.alpnProtocols,
      // Note: cert and key are custom options not in Deno.ConnectTlsOptions
      // Use certChain and privateKey if client certificates are needed
    };

    if (timeout) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        this.tlsConn = await Deno.connectTls(connectOptions);
      } finally {
        clearTimeout(timeoutId);
      }
    } else {
      this.tlsConn = await Deno.connectTls(connectOptions);
    }

    // Wrap TLS connection in Socket
    this.socket = Socket.fromConn(this.tlsConn as unknown as Deno.TcpConn);

    // Create HTTP client
    this.httpClient = new HTTP11Client(this.socket);
  }

  /**
   * Send HTTPS request
   */
  async sendRequest(request: HTTPRequest): Promise<HTTPResponse> {
    if (!this.httpClient) {
      throw new Error("Not connected. Call connect() first.");
    }

    return await this.httpClient.sendRequest(request);
  }

  /**
   * Get TLS connection
   */
  getTLSConnection(): Deno.TlsConn | null {
    return this.tlsConn;
  }

  /**
   * Get underlying socket
   */
  getSocket(): Socket | null {
    return this.socket;
  }

  /**
   * Get HTTP/1.1 client
   */
  getHTTPClient(): HTTP11Client | null {
    return this.httpClient;
  }

  /**
   * Get host
   */
  getHost(): string {
    return this.host;
  }

  /**
   * Get port
   */
  getPort(): number {
    return this.port;
  }

  /**
   * Get TLS options
   */
  getTLSOptions(): TLSOptions {
    return this.tlsOptions;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.tlsConn !== null && this.httpClient !== null;
  }

  /**
   * Close HTTPS connection
   */
  close(): void {
    if (this.httpClient) {
      this.httpClient.close();
      this.httpClient = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    if (this.tlsConn) {
      this.tlsConn.close();
      this.tlsConn = null;
    }
  }

  /**
   * Get TLS handshake info
   */
  async getHandshakeInfo(): Promise<Deno.TlsHandshakeInfo | null> {
    if (!this.tlsConn?.handshake) {
      return null;
    }
    return await this.tlsConn.handshake();
  }
}

/**
 * Convenience function to make HTTPS request
 */
export async function makeHTTPSRequest(
  host: string,
  port: number = 443,
  request: HTTPRequest,
  tlsOptions: TLSOptions = {},
): Promise<HTTPResponse> {
  const client = new HTTPSClient(host, port, tlsOptions);

  try {
    await client.connect();
    return await client.sendRequest(request);
  } finally {
    client.close();
  }
}

/**
 * Make request to URL (auto-detects HTTP vs HTTPS)
 */
export async function makeRequest(
  url: string,
  request: Partial<HTTPRequest> = {},
): Promise<HTTPResponse> {
  const parsedURL = new URL(url);
  const isHTTPS = parsedURL.protocol === "https:";
  const host = parsedURL.hostname;
  const port = parsedURL.port ? parseInt(parsedURL.port, 10) : (isHTTPS ? 443 : 80);
  const path = parsedURL.pathname + parsedURL.search + parsedURL.hash;

  const fullRequest: HTTPRequest = {
    method: request.method || "GET",
    uri: path,
    version: request.version || "1.1",
    headers: {
      host: `${host}:${port}`,
      ...request.headers,
    },
    body: request.body,
  };

  if (isHTTPS) {
    return await makeHTTPSRequest(host, port, fullRequest, {
      hostname: host,
    });
  } else {
    const { makeHTTPRequest } = await import("./http.ts");
    return await makeHTTPRequest(host, port, fullRequest);
  }
}
