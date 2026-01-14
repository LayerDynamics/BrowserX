/**
 * Network Stack Interface
 *
 * OS-level networking operations using Deno APIs.
 */

/**
 * Socket representation wrapping Deno.Conn
 */
export interface OSSocket {
    conn: Deno.Conn;
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
            conn: null as unknown as Deno.Conn, // Will be set in connect()
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
            // UDP doesn't have connection state in Deno
            // Store connection info for later use
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
        if (!socket.conn) {
            throw new Error("Socket not connected");
        }
        return await socket.conn.read(buffer);
    }

    /**
     * Write data to socket
     * @param socket - Connected socket
     * @param data - Data to write
     * @returns Number of bytes written
     */
    async write(socket: OSSocket, data: Uint8Array): Promise<number> {
        if (!socket.conn) {
            throw new Error("Socket not connected");
        }
        return await socket.conn.write(data);
    }

    /**
     * Close socket
     * @param socket - Socket to close
     */
    close(socket: OSSocket): void {
        if (socket.conn) {
            try {
                socket.conn.close();
            } catch {
                // Socket may already be closed, ignore error
            }
            // Set to null to prevent double-close attempts
            socket.conn = null as unknown as Deno.Conn;
        }
    }

    /**
     * Get local address of socket
     * @param socket - Connected socket
     * @returns Local address info
     */
    getLocalAddress(socket: OSSocket): Deno.Addr {
        if (!socket.conn) {
            throw new Error("Socket not connected");
        }
        return socket.conn.localAddr;
    }

    /**
     * Get remote address of socket
     * @param socket - Connected socket
     * @returns Remote address info
     */
    getRemoteAddress(socket: OSSocket): Deno.Addr {
        if (!socket.conn) {
            throw new Error("Socket not connected");
        }
        return socket.conn.remoteAddr;
    }
}
