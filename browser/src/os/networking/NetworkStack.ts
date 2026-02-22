/**
 * Network Stack Interface
 *
 * OS-level networking operations using Deno APIs.
 */

/**
 * Socket representation wrapping Deno.Conn for TCP or Deno.DatagramConn for UDP
 */
export interface OSSocket {
  conn: Deno.Conn | null;
  datagramConn: Deno.DatagramConn | null;
  family: string;
  type: string;
  remoteHost?: string;
  remotePort?: number;
}

/**
 * Network Stack - OS-level networking primitives
 */
export class NetworkStack {
  /**
   * Create a socket (TCP or UDP)
   * @param family - Address family ("IPv4" or "IPv6")
   * @param type - Socket type ("tcp" or "udp")
   * @returns Socket handle that can be connected
   */
  createSocket(family: string, type: string): OSSocket {
    // In Deno, we don't pre-create sockets, we connect directly
    // This returns a socket descriptor that will be used in connect()
    return {
      conn: null,
      datagramConn: null,
      family,
      type,
    };
  }

  /**
   * Connect socket to remote host
   * @param socket - Socket created by createSocket()
   * @param host - Hostname or IP address
   * @param port - Port number (1-65535)
   */
  async connect(socket: OSSocket, host: string, port: number): Promise<void> {
    if (socket.type === "tcp") {
      // Use Deno.connect for TCP connections
      const conn = await Deno.connect({
        hostname: host,
        port: port,
        transport: "tcp",
      });
      socket.conn = conn;
    } else if (socket.type === "udp") {
      // For UDP, create a datagram socket bound to ephemeral port (0)
      // Deno's UDP sockets use listenDatagram with port 0 for clients
      // Note: listenDatagram requires --unstable-net flag in Deno
      if (typeof Deno.listenDatagram !== "function") {
        throw new Error(
          "UDP sockets require --unstable-net flag. " +
            "Run with: deno run --unstable-net",
        );
      }
      const datagramConn = Deno.listenDatagram({
        port: 0, // Let OS assign ephemeral port
        transport: "udp",
        hostname: socket.family === "IPv6" ? "::" : "0.0.0.0",
      });
      socket.datagramConn = datagramConn;
      socket.remoteHost = host;
      socket.remotePort = port;
    } else {
      throw new Error(`Unsupported socket type: ${socket.type}`);
    }
  }

  /**
   * Read data from socket
   * @param socket - Connected socket
   * @param buffer - Buffer to read into
   * @returns Number of bytes read, or null if EOF
   */
  async read(socket: OSSocket, buffer: Uint8Array): Promise<number | null> {
    if (socket.type === "udp") {
      // For UDP, use datagramConn.receive()
      if (!socket.datagramConn) {
        throw new Error("UDP socket not initialized");
      }
      const [data, _addr] = await socket.datagramConn.receive();
      // Copy received data to buffer
      const bytesToCopy = Math.min(data.length, buffer.length);
      buffer.set(data.subarray(0, bytesToCopy));
      return bytesToCopy;
    } else {
      // TCP uses conn.read()
      if (!socket.conn) {
        throw new Error("Socket not connected");
      }
      return await socket.conn.read(buffer);
    }
  }

  /**
   * Write data to socket
   * @param socket - Connected socket
   * @param data - Data to write
   * @returns Number of bytes written
   */
  async write(socket: OSSocket, data: Uint8Array): Promise<number> {
    if (socket.type === "udp") {
      // For UDP, use datagramConn.send() with target address
      if (!socket.datagramConn) {
        throw new Error("UDP socket not initialized");
      }
      if (!socket.remoteHost || socket.remotePort === undefined) {
        throw new Error("UDP socket has no remote address configured");
      }
      const targetAddr: Deno.NetAddr = {
        transport: "udp",
        hostname: socket.remoteHost,
        port: socket.remotePort,
      };
      return await socket.datagramConn.send(data, targetAddr);
    } else {
      // TCP uses conn.write()
      if (!socket.conn) {
        throw new Error("Socket not connected");
      }
      return await socket.conn.write(data);
    }
  }

  /**
   * Close socket
   * @param socket - Socket to close
   */
  close(socket: OSSocket): void {
    // Close TCP connection if present
    if (socket.conn) {
      try {
        socket.conn.close();
      } catch {
        // Socket may already be closed, ignore error
      }
      socket.conn = null;
    }
    // Close UDP datagram connection if present
    if (socket.datagramConn) {
      try {
        socket.datagramConn.close();
      } catch {
        // Socket may already be closed, ignore error
      }
      socket.datagramConn = null;
    }
  }

  /**
   * Get local address of socket
   * @param socket - Connected socket
   * @returns Local address info
   */
  getLocalAddress(socket: OSSocket): Deno.Addr {
    if (socket.type === "udp") {
      // For UDP, get address from datagramConn
      if (!socket.datagramConn) {
        throw new Error("UDP socket not initialized");
      }
      return socket.datagramConn.addr;
    } else {
      // TCP uses conn.localAddr
      if (!socket.conn) {
        throw new Error("Socket not connected");
      }
      return socket.conn.localAddr;
    }
  }

  /**
   * Get remote address of socket
   * @param socket - Connected socket
   * @returns Remote address info
   */
  getRemoteAddress(socket: OSSocket): Deno.Addr {
    if (socket.type === "udp") {
      // For UDP, return the configured remote address
      if (!socket.remoteHost || socket.remotePort === undefined) {
        throw new Error("UDP socket has no remote address configured");
      }
      return {
        transport: "udp",
        hostname: socket.remoteHost,
        port: socket.remotePort,
      } as Deno.NetAddr;
    } else {
      // TCP uses conn.remoteAddr
      if (!socket.conn) {
        throw new Error("Socket not connected");
      }
      return socket.conn.remoteAddr;
    }
  }
}
