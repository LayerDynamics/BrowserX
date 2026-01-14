/**
 * Proxy Chain
 *
 * Support for connecting through upstream proxies (proxy -> proxy -> origin)
 */

import { HTTPHeaders } from "../utils/headers.ts";

/**
 * Proxy protocol type
 */
export enum ProxyProtocol {
  HTTP = "HTTP",
  HTTPS = "HTTPS",
  SOCKS4 = "SOCKS4",
  SOCKS5 = "SOCKS5",
}

/**
 * Proxy authentication
 */
export interface ProxyAuth {
  username: string;
  password: string;
}

/**
 * Proxy configuration
 */
export interface ProxyConfig {
  protocol: ProxyProtocol;
  host: string;
  port: number;
  auth?: ProxyAuth;
}

/**
 * Proxy chain configuration
 */
export interface ProxyChainConfig {
  proxies: ProxyConfig[];
  timeout?: number;
}

/**
 * Proxy chain connection result
 */
export interface ProxyChainConnection {
  conn: Deno.Conn;
  chain: ProxyConfig[];
  totalTime: number;
}

/**
 * Proxy chain manager
 */
export class ProxyChain {
  private config: ProxyChainConfig;

  constructor(config: ProxyChainConfig) {
    this.config = {
      timeout: 30000,
      ...config,
    };
  }

  /**
   * Connect through proxy chain to target
   */
  async connect(targetHost: string, targetPort: number): Promise<ProxyChainConnection> {
    const startTime = Date.now();
    const chain = [...this.config.proxies];

    if (chain.length === 0) {
      throw new Error("Proxy chain is empty");
    }

    // Connect to first proxy
    let conn = await this.connectToProxy(chain[0]);

    try {
      // Tunnel through each proxy in chain
      for (let i = 0; i < chain.length; i++) {
        const nextHop = i === chain.length - 1
          ? { host: targetHost, port: targetPort }
          : { host: chain[i + 1].host, port: chain[i + 1].port };

        conn = await this.tunnel(conn, chain[i], nextHop.host, nextHop.port);
      }

      const totalTime = Date.now() - startTime;

      return {
        conn,
        chain,
        totalTime,
      };
    } catch (error) {
      try {
        conn.close();
      } catch {
        // Ignore close errors
      }
      throw error;
    }
  }

  /**
   * Connect to a single proxy
   */
  private async connectToProxy(proxy: ProxyConfig): Promise<Deno.Conn> {
    const conn = await Deno.connect({
      hostname: proxy.host,
      port: proxy.port,
    });

    // Upgrade to TLS if needed
    if (proxy.protocol === ProxyProtocol.HTTPS) {
      return await Deno.startTls(conn, {
        hostname: proxy.host,
      });
    }

    return conn;
  }

  /**
   * Tunnel through proxy to next hop
   */
  private async tunnel(
    conn: Deno.Conn,
    proxy: ProxyConfig,
    nextHost: string,
    nextPort: number,
  ): Promise<Deno.Conn> {
    switch (proxy.protocol) {
      case ProxyProtocol.HTTP:
      case ProxyProtocol.HTTPS:
        return await this.tunnelHTTP(conn, proxy, nextHost, nextPort);
      case ProxyProtocol.SOCKS5:
        return await this.tunnelSOCKS5(conn, proxy, nextHost, nextPort);
      case ProxyProtocol.SOCKS4:
        return await this.tunnelSOCKS4(conn, nextHost, nextPort);
      default:
        throw new Error(`Unsupported proxy protocol: ${proxy.protocol}`);
    }
  }

  /**
   * Tunnel through HTTP proxy using CONNECT method
   */
  private async tunnelHTTP(
    conn: Deno.Conn,
    proxy: ProxyConfig,
    targetHost: string,
    targetPort: number,
  ): Promise<Deno.Conn> {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    // Build CONNECT request
    let request = `CONNECT ${targetHost}:${targetPort} HTTP/1.1\r\n`;
    request += `Host: ${targetHost}:${targetPort}\r\n`;

    // Add proxy authentication if needed
    if (proxy.auth) {
      const credentials = `${proxy.auth.username}:${proxy.auth.password}`;
      const encoded = btoa(credentials);
      request += `Proxy-Authorization: Basic ${encoded}\r\n`;
    }

    request += `\r\n`;

    // Send CONNECT request
    await conn.write(encoder.encode(request));

    // Read response
    const buffer = new Uint8Array(8192);
    let response = "";
    let headersEnd = -1;

    while (headersEnd === -1) {
      const n = await conn.read(buffer);
      if (n === null) {
        throw new Error("Connection closed while waiting for CONNECT response");
      }

      response += decoder.decode(buffer.subarray(0, n));
      headersEnd = response.indexOf("\r\n\r\n");
    }

    // Parse response
    const lines = response.substring(0, headersEnd).split("\r\n");
    const statusLine = lines[0];
    const [, statusCode, statusText] = statusLine.split(" ");

    if (statusCode !== "200") {
      throw new Error(`Proxy CONNECT failed: ${statusCode} ${statusText}`);
    }

    // Connection established
    return conn;
  }

  /**
   * Tunnel through SOCKS5 proxy
   */
  private async tunnelSOCKS5(
    conn: Deno.Conn,
    proxy: ProxyConfig,
    targetHost: string,
    targetPort: number,
  ): Promise<Deno.Conn> {
    const encoder = new TextEncoder();

    // Step 1: Greeting and authentication method selection
    const greeting = new Uint8Array([
      0x05, // SOCKS version 5
      0x02, // Number of authentication methods
      0x00, // No authentication
      0x02, // Username/password authentication
    ]);
    await conn.write(greeting);

    // Read authentication method response
    const greetingResponse = new Uint8Array(2);
    await conn.read(greetingResponse);

    if (greetingResponse[0] !== 0x05) {
      throw new Error("Invalid SOCKS5 greeting response");
    }

    const authMethod = greetingResponse[1];

    // Step 2: Authentication (if required)
    if (authMethod === 0x02) {
      // Username/password authentication
      if (!proxy.auth) {
        throw new Error("SOCKS5 proxy requires authentication");
      }

      const username = encoder.encode(proxy.auth.username);
      const password = encoder.encode(proxy.auth.password);

      const authRequest = new Uint8Array(3 + username.length + password.length);
      authRequest[0] = 0x01; // Auth version
      authRequest[1] = username.length;
      authRequest.set(username, 2);
      authRequest[2 + username.length] = password.length;
      authRequest.set(password, 3 + username.length);

      await conn.write(authRequest);

      const authResponse = new Uint8Array(2);
      await conn.read(authResponse);

      if (authResponse[1] !== 0x00) {
        throw new Error("SOCKS5 authentication failed");
      }
    } else if (authMethod === 0xFF) {
      throw new Error("No acceptable SOCKS5 authentication methods");
    }

    // Step 3: Connection request
    const hostBytes = encoder.encode(targetHost);
    const request = new Uint8Array(7 + hostBytes.length);

    request[0] = 0x05; // SOCKS version
    request[1] = 0x01; // Connect command
    request[2] = 0x00; // Reserved
    request[3] = 0x03; // Address type: Domain name
    request[4] = hostBytes.length;
    request.set(hostBytes, 5);
    request[5 + hostBytes.length] = (targetPort >> 8) & 0xFF;
    request[6 + hostBytes.length] = targetPort & 0xFF;

    await conn.write(request);

    // Read connection response
    const responseHeader = new Uint8Array(4);
    await conn.read(responseHeader);

    if (responseHeader[0] !== 0x05) {
      throw new Error("Invalid SOCKS5 response");
    }

    if (responseHeader[1] !== 0x00) {
      const errorMessages: Record<number, string> = {
        0x01: "General SOCKS server failure",
        0x02: "Connection not allowed by ruleset",
        0x03: "Network unreachable",
        0x04: "Host unreachable",
        0x05: "Connection refused",
        0x06: "TTL expired",
        0x07: "Command not supported",
        0x08: "Address type not supported",
      };
      const message = errorMessages[responseHeader[1]] || "Unknown error";
      throw new Error(`SOCKS5 connection failed: ${message}`);
    }

    // Read bound address (we don't need it, but must read it)
    const addressType = responseHeader[3];
    if (addressType === 0x01) {
      // IPv4
      await conn.read(new Uint8Array(6)); // 4 bytes IP + 2 bytes port
    } else if (addressType === 0x03) {
      // Domain name
      const lengthByte = new Uint8Array(1);
      await conn.read(lengthByte);
      await conn.read(new Uint8Array(lengthByte[0] + 2)); // Domain + port
    } else if (addressType === 0x04) {
      // IPv6
      await conn.read(new Uint8Array(18)); // 16 bytes IP + 2 bytes port
    }

    // Connection established
    return conn;
  }

  /**
   * Tunnel through SOCKS4 proxy
   */
  private async tunnelSOCKS4(
    conn: Deno.Conn,
    targetHost: string,
    targetPort: number,
  ): Promise<Deno.Conn> {
    // SOCKS4 only supports IPv4
    // For simplicity, we'll resolve the hostname first
    const addresses = await Deno.resolveDns(targetHost, "A");
    if (addresses.length === 0) {
      throw new Error(`Cannot resolve ${targetHost} to IPv4 address`);
    }

    const ipParts = addresses[0].split(".").map((s) => parseInt(s));

    // Build SOCKS4 request
    const request = new Uint8Array(9);
    request[0] = 0x04; // SOCKS version 4
    request[1] = 0x01; // Connect command
    request[2] = (targetPort >> 8) & 0xFF; // Port high byte
    request[3] = targetPort & 0xFF; // Port low byte
    request[4] = ipParts[0]; // IP address
    request[5] = ipParts[1];
    request[6] = ipParts[2];
    request[7] = ipParts[3];
    request[8] = 0x00; // Null-terminated user ID (empty)

    await conn.write(request);

    // Read response
    const response = new Uint8Array(8);
    await conn.read(response);

    if (response[0] !== 0x00) {
      throw new Error("Invalid SOCKS4 response");
    }

    if (response[1] !== 0x5A) {
      const errorMessages: Record<number, string> = {
        0x5B: "Request rejected or failed",
        0x5C: "Request failed because client is not running identd",
        0x5D: "Request failed because client's identd could not confirm user ID",
      };
      const message = errorMessages[response[1]] || "Unknown error";
      throw new Error(`SOCKS4 connection failed: ${message}`);
    }

    // Connection established
    return conn;
  }

  /**
   * Get proxy chain configuration
   */
  getConfig(): ProxyChainConfig {
    return { ...this.config };
  }

  /**
   * Add proxy to chain
   */
  addProxy(proxy: ProxyConfig): void {
    this.config.proxies.push(proxy);
  }

  /**
   * Remove proxy from chain
   */
  removeProxy(index: number): void {
    this.config.proxies.splice(index, 1);
  }

  /**
   * Clear proxy chain
   */
  clear(): void {
    this.config.proxies = [];
  }
}
