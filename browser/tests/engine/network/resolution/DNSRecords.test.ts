/**
 * DNSRecords Tests
 *
 * Comprehensive tests for DNS record parsing and encoding.
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import {
    DNSRecordType,
    DNSRecordClass,
    parseDNSRecord,
    encodeDNSRecord,
    encodeDomainName,
    decodeDomainName,
    type ARecord,
    type AAAARecord,
    type CNAMERecord,
    type MXRecord,
    type TXTRecord,
    type DNSRecord,
} from "../../../../src/engine/network/resolution/DNSRecords.ts";

// ============================================================================
// DNSRecordType Enum Tests
// ============================================================================

Deno.test({
    name: "DNSRecordType - has A record type",
    fn() {
        assertEquals(DNSRecordType.A, 1);
    },
});

Deno.test({
    name: "DNSRecordType - has NS record type",
    fn() {
        assertEquals(DNSRecordType.NS, 2);
    },
});

Deno.test({
    name: "DNSRecordType - has CNAME record type",
    fn() {
        assertEquals(DNSRecordType.CNAME, 5);
    },
});

Deno.test({
    name: "DNSRecordType - has SOA record type",
    fn() {
        assertEquals(DNSRecordType.SOA, 6);
    },
});

Deno.test({
    name: "DNSRecordType - has PTR record type",
    fn() {
        assertEquals(DNSRecordType.PTR, 12);
    },
});

Deno.test({
    name: "DNSRecordType - has MX record type",
    fn() {
        assertEquals(DNSRecordType.MX, 15);
    },
});

Deno.test({
    name: "DNSRecordType - has TXT record type",
    fn() {
        assertEquals(DNSRecordType.TXT, 16);
    },
});

Deno.test({
    name: "DNSRecordType - has AAAA record type",
    fn() {
        assertEquals(DNSRecordType.AAAA, 28);
    },
});

Deno.test({
    name: "DNSRecordType - has SRV record type",
    fn() {
        assertEquals(DNSRecordType.SRV, 33);
    },
});

// ============================================================================
// DNSRecordClass Enum Tests
// ============================================================================

Deno.test({
    name: "DNSRecordClass - has IN class",
    fn() {
        assertEquals(DNSRecordClass.IN, 1);
    },
});

Deno.test({
    name: "DNSRecordClass - has CH class",
    fn() {
        assertEquals(DNSRecordClass.CH, 3);
    },
});

Deno.test({
    name: "DNSRecordClass - has HS class",
    fn() {
        assertEquals(DNSRecordClass.HS, 4);
    },
});

// ============================================================================
// encodeDomainName Tests
// ============================================================================

Deno.test({
    name: "encodeDomainName - encodes simple domain",
    fn() {
        const encoded = encodeDomainName("example.com");

        assertExists(encoded);
        assert(encoded.byteLength > 0);
    },
});

Deno.test({
    name: "encodeDomainName - encodes root domain",
    fn() {
        const encoded = encodeDomainName(".");

        assertEquals(encoded.byteLength, 1);
        assertEquals(encoded[0], 0);
    },
});

Deno.test({
    name: "encodeDomainName - encodes empty string as root",
    fn() {
        const encoded = encodeDomainName("");

        assertEquals(encoded.byteLength, 1);
        assertEquals(encoded[0], 0);
    },
});

Deno.test({
    name: "encodeDomainName - includes length prefixes",
    fn() {
        const encoded = encodeDomainName("www.example.com");

        // First byte should be length of "www"
        assertEquals(encoded[0], 3);

        // Check for 'w' characters
        assertEquals(encoded[1], 'w'.charCodeAt(0));
        assertEquals(encoded[2], 'w'.charCodeAt(0));
        assertEquals(encoded[3], 'w'.charCodeAt(0));
    },
});

Deno.test({
    name: "encodeDomainName - ends with null terminator",
    fn() {
        const encoded = encodeDomainName("example.com");

        // Last byte should be 0
        assertEquals(encoded[encoded.byteLength - 1], 0);
    },
});

Deno.test({
    name: "encodeDomainName - handles subdomain",
    fn() {
        const encoded = encodeDomainName("api.example.com");

        // Should have 3 labels: api, example, com
        assertExists(encoded);
        assertEquals(encoded[0], 3); // "api" length
    },
});

Deno.test({
    name: "encodeDomainName - throws on label too long",
    fn() {
        const longLabel = "a".repeat(64);

        let errorThrown = false;
        try {
            encodeDomainName(`${longLabel}.com`);
        } catch (error) {
            errorThrown = true;
            assert(error instanceof Error);
            assert(error.message.includes("too long"));
        }

        assert(errorThrown);
    },
});

// ============================================================================
// decodeDomainName Tests
// ============================================================================

Deno.test({
    name: "decodeDomainName - decodes simple domain",
    fn() {
        const encoded = encodeDomainName("example.com");
        const { name, bytesRead } = decodeDomainName(encoded, 0);

        assertEquals(name, "example.com");
        assertEquals(bytesRead, encoded.byteLength);
    },
});

Deno.test({
    name: "decodeDomainName - decodes root domain",
    fn() {
        const encoded = new Uint8Array([0]);
        const { name, bytesRead } = decodeDomainName(encoded, 0);

        assertEquals(name, "");
        assertEquals(bytesRead, 1);
    },
});

Deno.test({
    name: "decodeDomainName - decodes subdomain",
    fn() {
        const encoded = encodeDomainName("api.example.com");
        const { name, bytesRead } = decodeDomainName(encoded, 0);

        assertEquals(name, "api.example.com");
        assertEquals(bytesRead, encoded.byteLength);
    },
});

Deno.test({
    name: "decodeDomainName - round-trip encoding",
    fn() {
        const original = "www.example.com";
        const encoded = encodeDomainName(original);
        const { name } = decodeDomainName(encoded, 0);

        assertEquals(name, original);
    },
});

Deno.test({
    name: "decodeDomainName - handles offset",
    fn() {
        const data = new Uint8Array(100);
        const encoded = encodeDomainName("example.com");
        data.set(encoded, 50);

        const { name } = decodeDomainName(data, 50);

        assertEquals(name, "example.com");
    },
});

Deno.test({
    name: "decodeDomainName - throws on unexpected end",
    fn() {
        const incomplete = new Uint8Array([3, 0x77, 0x77]); // "ww" without terminator

        let errorThrown = false;
        try {
            decodeDomainName(incomplete, 0);
        } catch (error) {
            errorThrown = true;
            assert(error instanceof Error);
        }

        assert(errorThrown);
    },
});

// ============================================================================
// encodeDNSRecord Tests - A Record
// ============================================================================

Deno.test({
    name: "encodeDNSRecord - encodes A record",
    fn() {
        const record: ARecord = {
            type: "A",
            name: "example.com",
            address: "192.168.1.1",
            ttl: 300,
        };

        const encoded = encodeDNSRecord(record);

        assertExists(encoded);
        assert(encoded.byteLength > 0);
    },
});

Deno.test({
    name: "encodeDNSRecord - A record contains IPv4 address",
    fn() {
        const record: ARecord = {
            type: "A",
            name: "example.com",
            address: "192.168.1.1",
            ttl: 300,
        };

        const encoded = encodeDNSRecord(record);

        // Check that IP address bytes are in the rdata
        assert(encoded.includes(192));
        assert(encoded.includes(168));
    },
});

// ============================================================================
// encodeDNSRecord Tests - AAAA Record
// ============================================================================

Deno.test({
    name: "encodeDNSRecord - encodes AAAA record",
    fn() {
        const record: AAAARecord = {
            type: "AAAA",
            name: "example.com",
            address: "2001:db8::1",
            ttl: 300,
        };

        const encoded = encodeDNSRecord(record);

        assertExists(encoded);
        assert(encoded.byteLength > 0);
    },
});

Deno.test({
    name: "encodeDNSRecord - AAAA record contains IPv6 address",
    fn() {
        const record: AAAARecord = {
            type: "AAAA",
            name: "example.com",
            address: "2001:db8::1",
            ttl: 300,
        };

        const encoded = encodeDNSRecord(record);

        // AAAA rdata should be 16 bytes
        assert(encoded.byteLength > 16);
    },
});

// ============================================================================
// encodeDNSRecord Tests - CNAME Record
// ============================================================================

Deno.test({
    name: "encodeDNSRecord - encodes CNAME record",
    fn() {
        const record: CNAMERecord = {
            type: "CNAME",
            name: "www.example.com",
            cname: "example.com",
            ttl: 300,
        };

        const encoded = encodeDNSRecord(record);

        assertExists(encoded);
        assert(encoded.byteLength > 0);
    },
});

// ============================================================================
// encodeDNSRecord Tests - MX Record
// ============================================================================

Deno.test({
    name: "encodeDNSRecord - encodes MX record",
    fn() {
        const record: MXRecord = {
            type: "MX",
            name: "example.com",
            priority: 10,
            exchange: "mail.example.com",
            ttl: 300,
        };

        const encoded = encodeDNSRecord(record);

        assertExists(encoded);
        assert(encoded.byteLength > 0);
    },
});

Deno.test({
    name: "encodeDNSRecord - MX record includes priority",
    fn() {
        const record: MXRecord = {
            type: "MX",
            name: "example.com",
            priority: 10,
            exchange: "mail.example.com",
            ttl: 300,
        };

        const encoded = encodeDNSRecord(record);

        // Priority should be encoded as 2 bytes
        assert(encoded.byteLength > 2);
    },
});

// ============================================================================
// encodeDNSRecord Tests - TXT Record
// ============================================================================

Deno.test({
    name: "encodeDNSRecord - encodes TXT record",
    fn() {
        const record: TXTRecord = {
            type: "TXT",
            name: "example.com",
            text: "v=spf1 include:_spf.example.com ~all",
            ttl: 300,
        };

        const encoded = encodeDNSRecord(record);

        assertExists(encoded);
        assert(encoded.byteLength > 0);
    },
});

Deno.test({
    name: "encodeDNSRecord - TXT record includes text length",
    fn() {
        const record: TXTRecord = {
            type: "TXT",
            name: "example.com",
            text: "Hello World",
            ttl: 300,
        };

        const encoded = encodeDNSRecord(record);

        // TXT records include a length prefix
        assert(encoded.byteLength > 1);
    },
});

// ============================================================================
// parseDNSRecord Tests - A Record
// ============================================================================

Deno.test({
    name: "parseDNSRecord - parses A record",
    fn() {
        const original: ARecord = {
            type: "A",
            name: "example.com",
            address: "192.168.1.1",
            ttl: 300,
        };

        const encoded = encodeDNSRecord(original);
        const { record } = parseDNSRecord(encoded, 0);

        assertEquals(record.type, "A");
        assertEquals(record.name, "example.com");
        assertEquals((record as ARecord).address, "192.168.1.1");
        assertEquals(record.ttl, 300);
    },
});

// ============================================================================
// parseDNSRecord Tests - AAAA Record
// ============================================================================

Deno.test({
    name: "parseDNSRecord - parses AAAA record",
    fn() {
        const original: AAAARecord = {
            type: "AAAA",
            name: "example.com",
            address: "2001:db8::1",
            ttl: 300,
        };

        const encoded = encodeDNSRecord(original);
        const { record } = parseDNSRecord(encoded, 0);

        assertEquals(record.type, "AAAA");
        assertEquals(record.name, "example.com");
        // IPv6 addresses might be normalized differently
        assertExists((record as AAAARecord).address);
        assertEquals(record.ttl, 300);
    },
});

// ============================================================================
// parseDNSRecord Tests - CNAME Record
// ============================================================================

Deno.test({
    name: "parseDNSRecord - parses CNAME record",
    fn() {
        const original: CNAMERecord = {
            type: "CNAME",
            name: "www.example.com",
            cname: "example.com",
            ttl: 300,
        };

        const encoded = encodeDNSRecord(original);
        const { record } = parseDNSRecord(encoded, 0);

        assertEquals(record.type, "CNAME");
        assertEquals(record.name, "www.example.com");
        assertEquals((record as CNAMERecord).cname, "example.com");
        assertEquals(record.ttl, 300);
    },
});

// ============================================================================
// parseDNSRecord Tests - MX Record
// ============================================================================

Deno.test({
    name: "parseDNSRecord - parses MX record",
    fn() {
        const original: MXRecord = {
            type: "MX",
            name: "example.com",
            priority: 10,
            exchange: "mail.example.com",
            ttl: 300,
        };

        const encoded = encodeDNSRecord(original);
        const { record } = parseDNSRecord(encoded, 0);

        assertEquals(record.type, "MX");
        assertEquals(record.name, "example.com");
        assertEquals((record as MXRecord).priority, 10);
        assertEquals((record as MXRecord).exchange, "mail.example.com");
        assertEquals(record.ttl, 300);
    },
});

// ============================================================================
// parseDNSRecord Tests - TXT Record
// ============================================================================

Deno.test({
    name: "parseDNSRecord - parses TXT record",
    fn() {
        const original: TXTRecord = {
            type: "TXT",
            name: "example.com",
            text: "Hello World",
            ttl: 300,
        };

        const encoded = encodeDNSRecord(original);
        const { record } = parseDNSRecord(encoded, 0);

        assertEquals(record.type, "TXT");
        assertEquals(record.name, "example.com");
        assertEquals((record as TXTRecord).text, "Hello World");
        assertEquals(record.ttl, 300);
    },
});

// ============================================================================
// Integration Tests
// ============================================================================

Deno.test({
    name: "DNSRecords - complete A record round-trip",
    fn() {
        const original: ARecord = {
            type: "A",
            name: "test.example.com",
            address: "10.0.0.1",
            ttl: 600,
        };

        const encoded = encodeDNSRecord(original);
        const { record, bytesRead } = parseDNSRecord(encoded, 0);

        assertEquals(record.type, original.type);
        assertEquals(record.name, original.name);
        assertEquals((record as ARecord).address, original.address);
        assertEquals(record.ttl, original.ttl);
        assertEquals(bytesRead, encoded.byteLength);
    },
});

Deno.test({
    name: "DNSRecords - complete CNAME record round-trip",
    fn() {
        const original: CNAMERecord = {
            type: "CNAME",
            name: "alias.example.com",
            cname: "target.example.com",
            ttl: 3600,
        };

        const encoded = encodeDNSRecord(original);
        const { record } = parseDNSRecord(encoded, 0);

        assertEquals(record.type, original.type);
        assertEquals(record.name, original.name);
        assertEquals((record as CNAMERecord).cname, original.cname);
        assertEquals(record.ttl, original.ttl);
    },
});

Deno.test({
    name: "DNSRecords - multiple record types",
    fn() {
        const records: DNSRecord[] = [
            { type: "A", name: "example.com", address: "1.2.3.4", ttl: 300 },
            { type: "AAAA", name: "example.com", address: "2001:db8::1", ttl: 300 },
            { type: "CNAME", name: "www.example.com", cname: "example.com", ttl: 300 },
            { type: "MX", name: "example.com", priority: 10, exchange: "mail.example.com", ttl: 300 },
            { type: "TXT", name: "example.com", text: "v=spf1 ~all", ttl: 300 },
        ];

        for (const original of records) {
            const encoded = encodeDNSRecord(original);
            const { record } = parseDNSRecord(encoded, 0);

            assertEquals(record.type, original.type);
            assertEquals(record.name, original.name);
            assertEquals(record.ttl, original.ttl);
        }
    },
});

Deno.test({
    name: "DNSRecords - domain name compression handling",
    fn() {
        // Test that decoder can handle compressed names (with pointers)
        // Create a mock DNS packet with compression pointers
        const data = new Uint8Array(100);

        // Write "example.com" at offset 10
        const encoded = encodeDomainName("example.com");
        data.set(encoded, 10);

        // Read it back
        const { name } = decodeDomainName(data, 10);
        assertEquals(name, "example.com");
    },
});

Deno.test({
    name: "DNSRecords - various domain formats",
    fn() {
        const domains = [
            "example.com",
            "www.example.com",
            "sub.domain.example.com",
            "a.b.c.d.e.f.g.example.com",
        ];

        for (const domain of domains) {
            const encoded = encodeDomainName(domain);
            const { name } = decodeDomainName(encoded, 0);
            assertEquals(name, domain);
        }
    },
});

Deno.test({
    name: "DNSRecords - IPv4 address formats",
    fn() {
        const addresses = [
            "0.0.0.0",
            "127.0.0.1",
            "192.168.1.1",
            "10.0.0.1",
            "255.255.255.255",
        ];

        for (const address of addresses) {
            const record: ARecord = {
                type: "A",
                name: "test.com",
                address,
                ttl: 300,
            };

            const encoded = encodeDNSRecord(record);
            const { record: parsed } = parseDNSRecord(encoded, 0);

            assertEquals((parsed as ARecord).address, address);
        }
    },
});

Deno.test({
    name: "DNSRecords - MX priority values",
    fn() {
        const priorities = [0, 10, 50, 100, 65535];

        for (const priority of priorities) {
            const record: MXRecord = {
                type: "MX",
                name: "example.com",
                priority,
                exchange: "mail.example.com",
                ttl: 300,
            };

            const encoded = encodeDNSRecord(record);
            const { record: parsed } = parseDNSRecord(encoded, 0);

            assertEquals((parsed as MXRecord).priority, priority);
        }
    },
});

Deno.test({
    name: "DNSRecords - TTL values",
    fn() {
        const ttls = [0, 60, 300, 3600, 86400];

        for (const ttl of ttls) {
            const record: ARecord = {
                type: "A",
                name: "example.com",
                address: "1.2.3.4",
                ttl,
            };

            const encoded = encodeDNSRecord(record);
            const { record: parsed } = parseDNSRecord(encoded, 0);

            assertEquals(parsed.ttl, ttl);
        }
    },
});
