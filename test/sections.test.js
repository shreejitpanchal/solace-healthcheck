import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseSections, findSection, valueOf, parseFixedTable, parseCliDate, daysBetween, counterOf } from "../src/sections.js";

const diagnostics = readFileSync(new URL("./fixtures/cli-diagnostics.sample.txt", import.meta.url), "utf8");
const supplemental = readFileSync(new URL("./fixtures/supplemental.sample.txt", import.meta.url), "utf8");

test("parses gather-diagnostics header sections", () => {
  const { sections, host } = parseSections(diagnostics);
  assert.equal(host, "brk-pri");
  assert.ok(sections.size >= 30, `expected many sections, got ${sections.size}`);
  const hostname = sections.get("show hostname");
  assert.equal(hostname.host, "brk-pri");
  assert.equal(valueOf(hostname.body, "Hostname"), "brk-pri");
  assert.ok(!hostname.body.includes("####"), "rule lines must not leak into the body");
});

test("empty sections exist but have an empty body", () => {
  const { sections } = parseSections(diagnostics);
  const clientCa = sections.get("show client-certificate-authority ca-name * cert");
  assert.ok(clientCa);
  assert.equal(clientCa.body, "");
});

test("parses CLI transcript sections keyed by prompt line", () => {
  const { sections, host } = parseSections(supplemental);
  assert.equal(host, "brk-pri");
  assert.equal(sections.size, 3);
  assert.match(sections.get("show ssl allow-tls-version").body, /Allowed TLS versions: 1\.2/);
  assert.match(sections.get("show log system lines 100").body, /SYSTEM_AD_MSG_SPOOL_HIGH/);
});

test("handles CRLF input", () => {
  const { sections } = parseSections(diagnostics.replace(/\n/g, "\r\n"));
  assert.equal(valueOf(sections.get("show version").body, "Current load is"), "soltr_10.25.0.148");
});

test("findSection honours alternatives and whitespace", () => {
  const { sections } = parseSections(diagnostics);
  assert.ok(findSection(sections, "show system|show system detail"));
  assert.ok(findSection(sections, "SHOW   SYSTEM   DETAIL"));
  assert.equal(findSection(sections, "show nothing"), null);
});

test("parseFixedTable slices the show service table by header positions", () => {
  const { sections } = parseSections(diagnostics);
  const table = parseFixedTable(sections.get("show service").body, /^Service\s+TP\s+S C R\s+VRF/);
  assert.deepEqual(table.columns, ["Service", "TP", "S C R", "VRF", "MsgVpn", "Port", "A O", "Failed Reason"]);
  const amqp = table.rows.find((row) => row.Service === "AMQP" && row.Port === "");
  assert.equal(amqp["Failed Reason"], "Not Permitted");
  const rest = table.rows.find((row) => row.Service === "REST" && row.Port === "9443");
  assert.equal(rest.MsgVpn, "APPVPN");
  assert.equal(rest["A O"], "U U");
});

test("counterOf reads statistics counters", () => {
  const { sections } = parseSections(diagnostics);
  assert.equal(counterOf(sections.get("show stats client detail").body, "Denied Authorization Failed"), 2990);
  assert.equal(counterOf(sections.get("show stats client detail").body, "Total Ingress Discards"), 0);
  assert.equal(counterOf(sections.get("show stats client detail").body, "Does Not Exist"), null);
});

test("parseCliDate handles certificate, CLI and ISO formats", () => {
  assert.equal(parseCliDate("May  9 11:18:25 2028 GMT").toISOString(), "2028-05-09T11:18:25.000Z");
  assert.equal(parseCliDate("Sep 07 2026 15:19:21").toISOString(), "2026-09-07T15:19:21.000Z");
  assert.equal(parseCliDate("Sep 07 2026 15:19:21 +08").toISOString(), "2026-09-07T07:19:21.000Z");
  assert.equal(parseCliDate("2026-09-07T15:19:24+08:00").toISOString(), "2026-09-07T07:19:24.000Z");
  assert.equal(parseCliDate("garbage"), null);
  assert.equal(daysBetween(new Date("2026-09-07T00:00:00Z"), new Date("2028-05-09T11:18:25Z")), 610);
});
