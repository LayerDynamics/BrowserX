/**
 * DNS Record Types and Utilities
 *
 * Defines DNS record structures and parsing utilities according to RFC 1035.
 */

/**
 * DNS record type codes
 */
export enum DNSRecordType {
    A = 1, // IPv4 address
    NS = 2, // Name server
    CNAME = 5, // Canonical name
    SOA = 6, // Start of authority
    PTR = 12, // Pointer
    MX = 15, // Mail exchange
    TXT = 16, // Text
    AAAA = 28, // IPv6 address
    SRV = 33, // Service
}

/**
 * DNS record class codes
 */
export enum DNSRecordClass {
    IN = 1, // Internet
    CH = 3, // CHAOS
    HS = 4, // Hesiod
}

/**
 * DNS A record (IPv4 address)
 */
export interface ARecord {
    type: "A";
    name: string;
    address: string;
    ttl: number;
}

/**
 * DNS AAAA record (IPv6 address)
 */
export interface AAAARecord {
    type: "AAAA";
    name: string;
    address: string;
    ttl: number;
}

/**
 * DNS CNAME record (canonical name)
 */
export interface CNAMERecord {
    type: "CNAME";
    name: string;
    cname: string;
    ttl: number;
}

/**
 * DNS MX record (mail exchange)
 */
export interface MXRecord {
    type: "MX";
    name: string;
    priority: number;
    exchange: string;
    ttl: number;
}

/**
 * DNS TXT record
 */
export interface TXTRecord {
    type: "TXT";
    name: string;
    text: string;
    ttl: number;
}

/**
 * Union type for all DNS records
 */
export type DNSRecord = ARecord | AAAARecord | CNAMERecord | MXRecord | TXTRecord;

/**
 * Parse DNS record from wire format
 *
 * @param data - Full DNS packet data (for pointer resolution)
 * @param offset - Offset to start parsing
 * @returns Parsed DNS record and bytes read
 */
export function parseDNSRecord(data: Uint8Array, offset: number): {
    record: DNSRecord;
    bytesRead: number;
} {
    let pos = offset;

    // Parse name (with compression support)
    const { name, bytesRead: nameBytes } = decodeDomainName(data, pos);
    pos += nameBytes;

    // Parse fixed fields
    const view = new DataView(data.buffer, data.byteOffset + pos);
    const type = view.getUint16(0);
    const rclass = view.getUint16(2);
    const ttl = view.getUint32(4);
    const rdlength = view.getUint16(8);
    pos += 10;

    // Parse rdata based on type
    const rdata = data.slice(pos, pos + rdlength);

    let record: DNSRecord;

    switch (type) {
        case DNSRecordType.A: {
            if (rdlength !== 4) throw new Error("Invalid A record length");
            const address = Array.from(rdata).map((b) => b.toString()).join(".");
            record = { type: "A", name, address, ttl };
            break;
        }

        case DNSRecordType.AAAA: {
            if (rdlength !== 16) throw new Error("Invalid AAAA record length");
            const parts: string[] = [];
            for (let i = 0; i < 16; i += 2) {
                const value = (rdata[i] << 8) | rdata[i + 1];
                parts.push(value.toString(16));
            }
            let address = parts.join(":");
            address = address.replace(/\b:?(?:0+:?){2,}/, "::");
            record = { type: "AAAA", name, address, ttl };
            break;
        }

        case DNSRecordType.CNAME: {
            const { name: cname } = decodeDomainName(data, pos);
            record = { type: "CNAME", name, cname, ttl };
            break;
        }

        case DNSRecordType.MX: {
            const priority = (rdata[0] << 8) | rdata[1];
            const { name: exchange } = decodeDomainName(data, pos + 2);
            record = { type: "MX", name, priority, exchange, ttl };
            break;
        }

        case DNSRecordType.TXT: {
            let textOffset = 0;
            const texts: string[] = [];
            while (textOffset < rdata.byteLength) {
                const len = rdata[textOffset++];
                const chunk = rdata.slice(textOffset, textOffset + len);
                texts.push(new TextDecoder().decode(chunk));
                textOffset += len;
            }
            const text = texts.join("");
            record = { type: "TXT", name, text, ttl };
            break;
        }

        default:
            throw new Error(`Unsupported DNS record type: ${type}`);
    }

    pos += rdlength;
    return { record, bytesRead: pos - offset };
}

/**
 * Encode DNS record to wire format
 *
 * @param record - DNS record
 * @returns Encoded record data
 */
export function encodeDNSRecord(record: DNSRecord): Uint8Array {
    // Encode name
    const encodedName = encodeDomainName(record.name);

    // Encode rdata based on type
    let rdata: Uint8Array;
    let type: DNSRecordType;

    switch (record.type) {
        case "A": {
            type = DNSRecordType.A;
            const parts = record.address.split(".");
            rdata = new Uint8Array(parts.map((p) => parseInt(p, 10)));
            break;
        }

        case "AAAA": {
            type = DNSRecordType.AAAA;
            // Expand :: notation
            let expanded = record.address;
            if (expanded.includes("::")) {
                const [left, right] = expanded.split("::");
                const leftParts = left ? left.split(":") : [];
                const rightParts = right ? right.split(":") : [];
                const zerosNeeded = 8 - leftParts.length - rightParts.length;
                const zeros = Array(zerosNeeded).fill("0");
                expanded = [...leftParts, ...zeros, ...rightParts].join(":");
            }
            const parts = expanded.split(":");
            rdata = new Uint8Array(16);
            for (let i = 0; i < 8; i++) {
                const value = parseInt(parts[i], 16);
                rdata[i * 2] = (value >> 8) & 0xFF;
                rdata[i * 2 + 1] = value & 0xFF;
            }
            break;
        }

        case "CNAME": {
            type = DNSRecordType.CNAME;
            rdata = encodeDomainName(record.cname);
            break;
        }

        case "MX": {
            type = DNSRecordType.MX;
            const priority = new Uint8Array(2);
            priority[0] = (record.priority >> 8) & 0xFF;
            priority[1] = record.priority & 0xFF;
            const exchange = encodeDomainName(record.exchange);
            rdata = new Uint8Array(priority.length + exchange.length);
            rdata.set(priority, 0);
            rdata.set(exchange, 2);
            break;
        }

        case "TXT": {
            type = DNSRecordType.TXT;
            const encoded = new TextEncoder().encode(record.text);
            rdata = new Uint8Array(encoded.length + 1);
            rdata[0] = encoded.length;
            rdata.set(encoded, 1);
            break;
        }
    }

    // Build full record
    const result = new Uint8Array(encodedName.length + 10 + rdata.length);
    const view = new DataView(result.buffer);
    let offset = 0;

    // Name
    result.set(encodedName, offset);
    offset += encodedName.length;

    // Type, Class, TTL, RDLength
    view.setUint16(offset, type);
    view.setUint16(offset + 2, DNSRecordClass.IN);
    view.setUint32(offset + 4, record.ttl);
    view.setUint16(offset + 8, rdata.length);
    offset += 10;

    // RData
    result.set(rdata, offset);

    return result;
}

/**
 * Encode domain name to DNS wire format
 */
export function encodeDomainName(name: string): Uint8Array {
    if (name === "" || name === ".") {
        return new Uint8Array([0]); // Root domain
    }

    const labels = name.split(".");
    const encoded: number[] = [];

    for (const label of labels) {
        if (label.length === 0) continue;
        if (label.length > 63) throw new Error("DNS label too long");

        encoded.push(label.length);
        for (let i = 0; i < label.length; i++) {
            encoded.push(label.charCodeAt(i));
        }
    }

    encoded.push(0); // Null terminator
    return new Uint8Array(encoded);
}

/**
 * Decode domain name from DNS wire format (handles compression)
 */
export function decodeDomainName(
    data: Uint8Array,
    offset: number,
): { name: string; bytesRead: number } {
    const labels: string[] = [];
    let pos = offset;
    let jumped = false;
    let jumpPos = 0;

    while (true) {
        if (pos >= data.byteLength) throw new Error("Unexpected end of DNS name");

        const length = data[pos];

        // Null terminator
        if (length === 0) {
            pos++;
            break;
        }

        // Pointer (DNS compression)
        if ((length & 0xC0) === 0xC0) {
            const pointerOffset = ((length & 0x3F) << 8) | data[pos + 1];

            if (!jumped) {
                jumpPos = pos + 2;
                jumped = true;
            }

            pos = pointerOffset;
            continue;
        }

        // Regular label
        if (length > 63) throw new Error("DNS label too long");

        pos++;
        const label = new TextDecoder().decode(data.slice(pos, pos + length));
        labels.push(label);
        pos += length;
    }

    const name = labels.join(".");
    const bytesRead = jumped ? jumpPos - offset : pos - offset;

    return { name, bytesRead };
}
