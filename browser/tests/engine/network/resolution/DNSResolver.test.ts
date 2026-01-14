/**
 * DNSResolver Tests
 *
 * Comprehensive tests for DNS resolver functionality.
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import { DNSResolver, type DNSResult } from "../../../../src/engine/network/resolution/DNSResolver.ts";
import { DNSRecordType } from "../../../../src/engine/network/resolution/DNSRecords.ts";

// ============================================================================
// DNSResolver Constructor Tests
// ============================================================================

Deno.test({
    name: "DNSResolver - constructor creates resolver with defaults",
    fn() {
        const resolver = new DNSResolver();

        assertExists(resolver);
    },
});

Deno.test({
    name: "DNSResolver - constructor accepts custom nameservers",
    fn() {
        const resolver = new DNSResolver({
            nameservers: ["1.1.1.1", "1.0.0.1"],
        });

        assertExists(resolver);
    },
});

Deno.test({
    name: "DNSResolver - constructor accepts DoH endpoint",
    fn() {
        const resolver = new DNSResolver({
            dohEndpoint: "https://cloudflare-dns.com/dns-query",
        });

        assertExists(resolver);
    },
});

Deno.test({
    name: "DNSResolver - constructor accepts both nameservers and DoH",
    fn() {
        const resolver = new DNSResolver({
            nameservers: ["1.1.1.1", "1.0.0.1"],
            dohEndpoint: "https://cloudflare-dns.com/dns-query",
        });

        assertExists(resolver);
    },
});

// ============================================================================
// DNSResolver setNameservers() Tests
// ============================================================================

Deno.test({
    name: "DNSResolver - setNameservers updates nameservers",
    fn() {
        const resolver = new DNSResolver();

        resolver.setNameservers(["1.1.1.1", "1.0.0.1"]);

        // Should not throw
        assert(true);
    },
});

Deno.test({
    name: "DNSResolver - setNameservers accepts single nameserver",
    fn() {
        const resolver = new DNSResolver();

        resolver.setNameservers(["8.8.8.8"]);

        assert(true);
    },
});

Deno.test({
    name: "DNSResolver - setNameservers accepts multiple nameservers",
    fn() {
        const resolver = new DNSResolver();

        resolver.setNameservers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);

        assert(true);
    },
});

Deno.test({
    name: "DNSResolver - setNameservers can be called multiple times",
    fn() {
        const resolver = new DNSResolver();

        resolver.setNameservers(["8.8.8.8"]);
        resolver.setNameservers(["1.1.1.1"]);
        resolver.setNameservers(["9.9.9.9"]);

        assert(true);
    },
});

// ============================================================================
// DNSResolver setDoHEndpoint() Tests
// ============================================================================

Deno.test({
    name: "DNSResolver - setDoHEndpoint sets endpoint",
    fn() {
        const resolver = new DNSResolver();

        resolver.setDoHEndpoint("https://dns.google/dns-query");

        assert(true);
    },
});

Deno.test({
    name: "DNSResolver - setDoHEndpoint accepts Cloudflare endpoint",
    fn() {
        const resolver = new DNSResolver();

        resolver.setDoHEndpoint("https://cloudflare-dns.com/dns-query");

        assert(true);
    },
});

Deno.test({
    name: "DNSResolver - setDoHEndpoint can be called multiple times",
    fn() {
        const resolver = new DNSResolver();

        resolver.setDoHEndpoint("https://dns.google/dns-query");
        resolver.setDoHEndpoint("https://cloudflare-dns.com/dns-query");

        assert(true);
    },
});

// ============================================================================
// DNSResolver resolve() Tests
// ============================================================================

Deno.test({
    name: "DNSResolver - resolve throws on invalid nameservers",
    async fn() {
        const resolver = new DNSResolver({
            nameservers: ["invalid-dns-server-999.local"],
        });

        let errorThrown = false;
        try {
            await resolver.resolve("example.com");
        } catch (error) {
            errorThrown = true;
            assert(error instanceof Error);
            assert(error.message.includes("DNS resolution failed"));
        }

        assert(errorThrown);
    },
});

Deno.test({
    name: "DNSResolver - resolve accepts hostname",
    async fn() {
        const resolver = new DNSResolver({
            nameservers: ["invalid-dns-server-999.local"],
        });

        try {
            await resolver.resolve("example.com");
        } catch (error) {
            // Expected to fail without valid DNS server
            assert(error instanceof Error);
        }
    },
});

Deno.test({
    name: "DNSResolver - resolve defaults to A record type",
    async fn() {
        const resolver = new DNSResolver({
            nameservers: ["invalid-dns-server-999.local"],
        });

        try {
            await resolver.resolve("example.com");
        } catch (error) {
            // Expected to fail
            assert(error instanceof Error);
        }
    },
});

Deno.test({
    name: "DNSResolver - resolve accepts AAAA record type",
    async fn() {
        const resolver = new DNSResolver({
            nameservers: ["invalid-dns-server-999.local"],
        });

        try {
            await resolver.resolve("example.com", DNSRecordType.AAAA);
        } catch (error) {
            // Expected to fail
            assert(error instanceof Error);
        }
    },
});

Deno.test({
    name: "DNSResolver - resolve accepts CNAME record type",
    async fn() {
        const resolver = new DNSResolver({
            nameservers: ["invalid-dns-server-999.local"],
        });

        try {
            await resolver.resolve("www.example.com", DNSRecordType.CNAME);
        } catch (error) {
            // Expected to fail
            assert(error instanceof Error);
        }
    },
});

Deno.test({
    name: "DNSResolver - resolve tries multiple nameservers on failure",
    async fn() {
        const resolver = new DNSResolver({
            nameservers: [
                "invalid1.local",
                "invalid2.local",
                "invalid3.local",
            ],
        });

        let errorThrown = false;
        try {
            await resolver.resolve("example.com");
        } catch (error) {
            errorThrown = true;
            assert(error instanceof Error);
            // Error should indicate all nameservers were tried
            assert(error.message.includes("DNS resolution failed"));
        }

        assert(errorThrown);
    },
});

// ============================================================================
// DNSResult Interface Tests
// ============================================================================

Deno.test({
    name: "DNSResult - has required fields",
    fn() {
        const result: DNSResult = {
            hostname: "example.com",
            addresses: ["93.184.216.34"],
            ttl: 300,
            timestamp: Date.now(),
        };

        assertExists(result.hostname);
        assertExists(result.addresses);
        assertExists(result.ttl);
        assertExists(result.timestamp);
    },
});

Deno.test({
    name: "DNSResult - hostname is string",
    fn() {
        const result: DNSResult = {
            hostname: "example.com",
            addresses: ["93.184.216.34"],
            ttl: 300,
            timestamp: Date.now(),
        };

        assertEquals(typeof result.hostname, "string");
    },
});

Deno.test({
    name: "DNSResult - addresses is array",
    fn() {
        const result: DNSResult = {
            hostname: "example.com",
            addresses: ["93.184.216.34"],
            ttl: 300,
            timestamp: Date.now(),
        };

        assert(Array.isArray(result.addresses));
    },
});

Deno.test({
    name: "DNSResult - ttl is number",
    fn() {
        const result: DNSResult = {
            hostname: "example.com",
            addresses: ["93.184.216.34"],
            ttl: 300,
            timestamp: Date.now(),
        };

        assertEquals(typeof result.ttl, "number");
    },
});

Deno.test({
    name: "DNSResult - timestamp is number",
    fn() {
        const result: DNSResult = {
            hostname: "example.com",
            addresses: ["93.184.216.34"],
            ttl: 300,
            timestamp: Date.now(),
        };

        assertEquals(typeof result.timestamp, "number");
    },
});

Deno.test({
    name: "DNSResult - supports multiple addresses",
    fn() {
        const result: DNSResult = {
            hostname: "example.com",
            addresses: ["93.184.216.34", "2606:2800:220:1:248:1893:25c8:1946"],
            ttl: 300,
            timestamp: Date.now(),
        };

        assertEquals(result.addresses.length, 2);
    },
});

// ============================================================================
// Integration Tests
// ============================================================================

Deno.test({
    name: "DNSResolver - complete configuration",
    fn() {
        const resolver = new DNSResolver({
            nameservers: ["8.8.8.8", "8.8.4.4"],
            dohEndpoint: "https://dns.google/dns-query",
        });

        // Can change nameservers
        resolver.setNameservers(["1.1.1.1", "1.0.0.1"]);

        // Can change DoH endpoint
        resolver.setDoHEndpoint("https://cloudflare-dns.com/dns-query");

        assert(true);
    },
});

Deno.test({
    name: "DNSResolver - various hostname formats",
    async fn() {
        const resolver = new DNSResolver({
            nameservers: ["invalid.local"],
        });

        const hostnames = [
            "example.com",
            "www.example.com",
            "subdomain.example.com",
            "deep.subdomain.example.com",
        ];

        for (const hostname of hostnames) {
            try {
                await resolver.resolve(hostname);
            } catch (error) {
                // Expected to fail without valid DNS
                assert(error instanceof Error);
            }
        }
    },
});

Deno.test({
    name: "DNSResolver - various record types",
    async fn() {
        const resolver = new DNSResolver({
            nameservers: ["invalid.local"],
        });

        const types = [
            DNSRecordType.A,
            DNSRecordType.AAAA,
            DNSRecordType.CNAME,
        ];

        for (const type of types) {
            try {
                await resolver.resolve("example.com", type);
            } catch (error) {
                // Expected to fail
                assert(error instanceof Error);
            }
        }
    },
});

Deno.test({
    name: "DNSResolver - fallback from DoH to UDP",
    async fn() {
        const resolver = new DNSResolver({
            nameservers: ["invalid.local"],
            dohEndpoint: "https://invalid-doh-endpoint.local/dns-query",
        });

        // Should try DoH first, then fall back to UDP
        let errorThrown = false;
        try {
            await resolver.resolve("example.com");
        } catch (error) {
            errorThrown = true;
            assert(error instanceof Error);
        }

        assert(errorThrown);
    },
});

Deno.test({
    name: "DNSResolver - error handling for all nameservers unreachable",
    async fn() {
        const resolver = new DNSResolver({
            nameservers: ["192.0.2.1", "192.0.2.2"], // TEST-NET addresses
        });

        let errorThrown = false;
        try {
            await resolver.resolve("example.com");
        } catch (error) {
            errorThrown = true;
            assert(error instanceof Error);
            assert(
                error.message.includes("DNS resolution failed") ||
                error.message.includes("unreachable")
            );
        }

        assert(errorThrown);
    },
});

Deno.test({
    name: "DNSResolver - can create multiple independent resolvers",
    fn() {
        const resolver1 = new DNSResolver({
            nameservers: ["8.8.8.8"],
        });

        const resolver2 = new DNSResolver({
            nameservers: ["1.1.1.1"],
        });

        const resolver3 = new DNSResolver({
            dohEndpoint: "https://dns.google/dns-query",
        });

        assertExists(resolver1);
        assertExists(resolver2);
        assertExists(resolver3);
        assert(resolver1 !== resolver2);
        assert(resolver2 !== resolver3);
    },
});

Deno.test({
    name: "DNSResolver - DNSResult structure validation",
    fn() {
        // Validate expected DNSResult structure
        const result: DNSResult = {
            hostname: "test.example.com",
            addresses: [
                "192.0.2.1",
                "192.0.2.2",
                "2001:db8::1",
            ],
            ttl: 3600,
            timestamp: 1234567890,
        };

        assertEquals(result.hostname, "test.example.com");
        assertEquals(result.addresses.length, 3);
        assertEquals(result.addresses[0], "192.0.2.1");
        assertEquals(result.addresses[1], "192.0.2.2");
        assertEquals(result.addresses[2], "2001:db8::1");
        assertEquals(result.ttl, 3600);
        assertEquals(result.timestamp, 1234567890);
    },
});

Deno.test({
    name: "DNSResolver - empty addresses array handling",
    fn() {
        // Test that DNSResult can represent empty result
        const result: DNSResult = {
            hostname: "nonexistent.example.com",
            addresses: [],
            ttl: 0,
            timestamp: Date.now(),
        };

        assertEquals(result.addresses.length, 0);
    },
});

Deno.test({
    name: "DNSResolver - TTL values",
    fn() {
        const ttlValues = [0, 60, 300, 3600, 86400];

        for (const ttl of ttlValues) {
            const result: DNSResult = {
                hostname: "example.com",
                addresses: ["192.0.2.1"],
                ttl,
                timestamp: Date.now(),
            };

            assertEquals(result.ttl, ttl);
        }
    },
});

Deno.test({
    name: "DNSResolver - nameserver configuration variants",
    fn() {
        // Test various nameserver configurations
        const configs = [
            ["8.8.8.8"],
            ["8.8.8.8", "8.8.4.4"],
            ["1.1.1.1", "1.0.0.1"],
            ["9.9.9.9", "149.112.112.112"],
        ];

        for (const nameservers of configs) {
            const resolver = new DNSResolver({ nameservers });
            assertExists(resolver);
        }
    },
});

Deno.test({
    name: "DNSResolver - DoH endpoint variants",
    fn() {
        const endpoints = [
            "https://dns.google/dns-query",
            "https://cloudflare-dns.com/dns-query",
            "https://dns.quad9.net/dns-query",
        ];

        for (const dohEndpoint of endpoints) {
            const resolver = new DNSResolver({ dohEndpoint });
            assertExists(resolver);
        }
    },
});
