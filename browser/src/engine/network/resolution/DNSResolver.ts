/**
 * DNS Resolver
 *
 * Performs DNS queries (A, AAAA, CNAME) with caching support.
 * Supports both UDP DNS and DNS-over-HTTPS (DoH).
 */

import type { ByteBuffer, Port } from "../../../types/identifiers.ts";
import { AddressFamily, SocketImpl, SocketType } from "../primitives/Socket.ts";
import { decodeDomainName, DNSRecordType, encodeDomainName, parseDNSRecord } from "./DNSRecords.ts";

/**
 * DNS header flags
 */
interface DNSHeader {
    id: number; // Query ID
    qr: boolean; // Query/Response flag
    opcode: number; // Operation code
    aa: boolean; // Authoritative answer
    tc: boolean; // Truncated
    rd: boolean; // Recursion desired
    ra: boolean; // Recursion available
    rcode: number; // Response code
    qdcount: number; // Question count
    ancount: number; // Answer count
    nscount: number; // Authority count
    arcount: number; // Additional count
}

/**
 * DNS query result
 */
export interface DNSResult {
    hostname: string;
    addresses: string[];
    ttl: number;
    timestamp: number;
}

export class DNSResolver {
    private nameservers: string[] = ["8.8.8.8", "8.8.4.4"]; // Google DNS
    private dohEndpoint?: string; // DNS-over-HTTPS endpoint

    constructor(options?: {
        nameservers?: string[];
        dohEndpoint?: string;
    }) {
        if (options?.nameservers) {
            this.nameservers = options.nameservers;
        }
        if (options?.dohEndpoint) {
            this.dohEndpoint = options.dohEndpoint;
        }
    }

    /**
     * Set nameservers for DNS queries
     *
     * @param nameservers - Array of nameserver IP addresses
     */
    setNameservers(nameservers: string[]): void {
        this.nameservers = nameservers;
    }

    /**
     * Set DNS-over-HTTPS endpoint
     *
     * @param endpoint - DoH endpoint URL (e.g., "https://dns.google/dns-query")
     */
    setDoHEndpoint(endpoint: string): void {
        this.dohEndpoint = endpoint;
    }

    /**
     * Resolve hostname to IP addresses
     *
     * @param hostname - Hostname to resolve
     * @param type - DNS record type (A or AAAA)
     * @returns DNS resolution result
     */
    async resolve(hostname: string, type: DNSRecordType = DNSRecordType.A): Promise<DNSResult> {
        // Try DNS-over-HTTPS first if configured
        if (this.dohEndpoint) {
            try {
                return await this.queryDoH(hostname, type);
            } catch (error) {
                console.warn(`DoH query failed: ${(error as Error).message}, falling back to UDP`);
            }
        }

        // Try each nameserver until one succeeds
        let lastError: Error | null = null;

        for (const nameserver of this.nameservers) {
            try {
                return await this.queryUDP(hostname, type, nameserver);
            } catch (error) {
                lastError = error as Error;
                console.warn(`DNS query to ${nameserver} failed: ${lastError.message}`);
            }
        }

        // All nameservers failed
        throw new Error(
            `DNS resolution failed: ${lastError?.message || "All nameservers unreachable"}`,
        );
    }

    /**
     * Perform UDP DNS query
     *
     * @param hostname - Hostname to query
     * @param type - Record type
     * @param nameserver - DNS server address
     */
    private async queryUDP(
        hostname: string,
        type: DNSRecordType,
        nameserver: string,
    ): Promise<DNSResult> {
        // Build DNS query packet
        const query = this.buildQuery(hostname, type);

        // Create UDP socket
        const socket = new SocketImpl(AddressFamily.IPv4, SocketType.DGRAM);

        try {
            // Connect to DNS server (UDP port 53)
            await socket.connect(nameserver, 53 as Port);

            // Send query
            await socket.write(query as ByteBuffer);

            // Receive response (max 512 bytes for UDP DNS)
            const responseBuffer = new Uint8Array(512);
            const bytesRead = await socket.read(responseBuffer);

            if (bytesRead === null || bytesRead === 0) {
                throw new Error("No response from DNS server");
            }

            // Parse response
            const response = responseBuffer.slice(0, bytesRead);
            return this.parseResponse(response);
        } finally {
            // Always close socket
            await socket.close();
        }
    }

    /**
     * Perform DNS-over-HTTPS query
     *
     * @param hostname - Hostname to query
     * @param type - Record type
     *
     * Uses DNS-over-HTTPS (RFC 8484) for encrypted DNS queries
     */
    private async queryDoH(hostname: string, type: DNSRecordType): Promise<DNSResult> {
        if (!this.dohEndpoint) {
            throw new Error("DoH endpoint not configured");
        }

        // Build DNS query packet
        const query = this.buildQuery(hostname, type);

        // Convert to base64url encoding (RFC 4648)
        const base64 = btoa(String.fromCharCode(...query))
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=/g, "");

        // Send DoH query via HTTPS GET
        const url = `${this.dohEndpoint}?dns=${base64}`;
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Accept": "application/dns-message",
            },
        });

        if (!response.ok) {
            throw new Error(`DoH query failed: ${response.statusText}`);
        }

        // Parse response
        const responseData = new Uint8Array(await response.arrayBuffer());
        return this.parseResponse(responseData);
    }

    /**
     * Parse DNS response packet
     *
     * Parses a DNS response packet according to RFC 1035
     */
    private parseResponse(data: Uint8Array): DNSResult {
        if (data.byteLength < 12) {
            throw new Error("DNS response too short");
        }

        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

        // Parse header
        const header: DNSHeader = {
            id: view.getUint16(0),
            qr: ((view.getUint16(2) >> 15) & 0x1) === 1,
            opcode: (view.getUint16(2) >> 11) & 0xF,
            aa: ((view.getUint16(2) >> 10) & 0x1) === 1,
            tc: ((view.getUint16(2) >> 9) & 0x1) === 1,
            rd: ((view.getUint16(2) >> 8) & 0x1) === 1,
            ra: ((view.getUint16(2) >> 7) & 0x1) === 1,
            rcode: view.getUint16(2) & 0xF,
            qdcount: view.getUint16(4),
            ancount: view.getUint16(6),
            nscount: view.getUint16(8),
            arcount: view.getUint16(10),
        };

        // Check response code
        if (header.rcode !== 0) {
            const errorMessages: Record<number, string> = {
                1: "Format error",
                2: "Server failure",
                3: "Name error (NXDOMAIN)",
                4: "Not implemented",
                5: "Refused",
            };
            throw new Error(
                `DNS query failed: ${errorMessages[header.rcode] || `Error code ${header.rcode}`}`,
            );
        }

        let offset = 12;

        // Skip question section
        for (let i = 0; i < header.qdcount; i++) {
            const { bytesRead } = decodeDomainName(data, offset);
            offset += bytesRead + 4; // +4 for QTYPE and QCLASS
        }

        // Parse answer section
        const addresses: string[] = [];
        let hostname = "";
        let minTTL = Infinity;

        for (let i = 0; i < header.ancount; i++) {
            try {
                const { record, bytesRead } = parseDNSRecord(data, offset);
                offset += bytesRead;

                if (!hostname) {
                    hostname = record.name;
                }

                // Track minimum TTL
                minTTL = Math.min(minTTL, record.ttl);

                // Extract addresses
                if (record.type === "A" || record.type === "AAAA") {
                    addresses.push(record.address);
                } else if (record.type === "CNAME") {
                    // For CNAME, we might need to follow it
                    // For now, just note it
                    hostname = record.cname;
                }
            } catch (error) {
                // Skip malformed records
                console.warn(`Failed to parse DNS record: ${(error as Error).message}`);
                break;
            }
        }

        if (addresses.length === 0) {
            throw new Error("No addresses found in DNS response");
        }

        return {
            hostname,
            addresses,
            ttl: minTTL === Infinity ? 300 : minTTL, // Default 5 minutes
            timestamp: Date.now(),
        };
    }

    /**
     * Build DNS query packet
     *
     * Constructs a DNS query packet according to RFC 1035
     */
    private buildQuery(hostname: string, type: DNSRecordType): Uint8Array {
        // Generate random query ID
        const queryId = Math.floor(Math.random() * 65536);

        // Encode hostname
        const encodedName = encodeDomainName(hostname);

        // Build DNS header (12 bytes)
        const header = new Uint8Array(12);
        const view = new DataView(header.buffer);

        // ID
        view.setUint16(0, queryId);

        // Flags: Standard query with recursion desired
        // QR=0 (query), Opcode=0 (standard), AA=0, TC=0, RD=1, RA=0, Z=0, RCODE=0
        view.setUint16(2, 0x0100); // RD flag set

        // Counts
        view.setUint16(4, 1); // QDCOUNT = 1 question
        view.setUint16(6, 0); // ANCOUNT = 0
        view.setUint16(8, 0); // NSCOUNT = 0
        view.setUint16(10, 0); // ARCOUNT = 0

        // Build question section
        const question = new Uint8Array(encodedName.length + 4);
        question.set(encodedName, 0);

        const questionView = new DataView(question.buffer, encodedName.length);
        questionView.setUint16(0, type); // QTYPE
        questionView.setUint16(2, 1); // QCLASS = IN (Internet)

        // Combine header + question
        const packet = new Uint8Array(header.length + question.length);
        packet.set(header, 0);
        packet.set(question, header.length);

        return packet;
    }
}
