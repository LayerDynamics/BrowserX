import { assertEquals, assertExists } from "@std/assert";

import { Printer, PrinterDiscovery } from "../../../src/os/devices/Printer.ts";
import type { PrintJob, PrinterInfo } from "../../../src/os/devices/Printer.ts";

Deno.test({ name: "Printer - list returns array", sanitizeResources: false, fn: async () => {
  const printers = await Printer.list();
  assertExists(printers);
  assertEquals(Array.isArray(printers), true);
}});

Deno.test("Printer - getStatus when disconnected", () => {
  const printer = new Printer();
  const status = printer.getStatus();
  assertEquals(status.connected, false);
  assertEquals(status.ready, false);
});

Deno.test("Printer - disconnect when not connected returns false", () => {
  const printer = new Printer();
  assertEquals(printer.disconnect(), false);
});

Deno.test("Printer - setOSPrinter", () => {
  const printer = new Printer();
  printer.setOSPrinter("TestPrinter");
  // No error thrown
});

Deno.test("PrintJob interface - valid construction", () => {
  const job: PrintJob = {
    content: "Hello, printer!",
    format: "text",
    copies: 1,
    options: {
      bold: true,
      align: "center",
      cut: true,
    },
  };
  assertEquals(job.format, "text");
  assertEquals(job.copies, 1);
  assertEquals(job.options?.bold, true);
});

Deno.test("PrinterInfo interface - valid construction", () => {
  const info: PrinterInfo = {
    name: "Receipt Printer",
    type: "serial",
    port: "/dev/ttyUSB0",
    status: "available",
  };
  assertEquals(info.type, "serial");
  assertEquals(info.status, "available");
});

Deno.test("PrinterDiscovery - PRINTER_VIDS contains known vendors", () => {
  assertEquals(PrinterDiscovery.PRINTER_VIDS.includes(0x04B8), true); // Epson
  assertEquals(PrinterDiscovery.PRINTER_VIDS.includes(0x04F9), true); // Brother
  assertEquals(PrinterDiscovery.PRINTER_VIDS.includes(0x03F0), true); // HP
});

Deno.test("PrinterDiscovery - discover returns array", async () => {
  const printers = await PrinterDiscovery.discover();
  assertExists(printers);
  assertEquals(Array.isArray(printers), true);
});
