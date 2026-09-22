import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createBroker, attachFile, buildProfile } from "../src/broker.js";
import { buildChecklist } from "../src/checklist.js";
import { parseCertificates, parseServiceTable, STATUS } from "../src/analyzers.js";
import { CHECKS, isCheckRef } from "../src/checks.js";

const diagnostics = readFileSync(new URL("./fixtures/cli-diagnostics.sample.txt", import.meta.url), "utf8");
const config = readFileSync(new URL("./fixtures/current-config.sample.cli", import.meta.url), "utf8");
const supplemental = readFileSync(new URL("./fixtures/supplemental.sample.txt", import.meta.url), "utf8");

function profileWith({ withConfig = false, withSupplemental = false, hostname = "brk-pri", text = diagnostics } = {}) {
  const broker = createBroker(hostname);
  if (text) attachFile(broker, { kind: "diagnostics", name: "cli-diagnostics.txt", text });
  if (withConfig) attachFile(broker, { kind: "config", name: "current-config.cli", text: config });
  if (withSupplemental) attachFile(broker, { kind: "supplemental", name: "supplemental.txt", text: supplemental });
  return buildProfile(broker);
}

function cell(checklist, ref, hostname = "brk-pri") {
  const row = checklist.rows.find((item) => item.ref === ref);
  assert.ok(row, `row ${ref} exists`);
  return row.cells[hostname];
}

const base = buildChecklist([profileWith()], {}, new Date("2026-09-22T00:00:00Z"));

test("every check row has a cell with a known status", () => {
  const statuses = new Set(Object.values(STATUS));
  for (const row of base.rows) {
    if (row.kind !== "check") continue;
    const result = row.cells["brk-pri"];
    assert.ok(result, `${row.ref} has a result`);
    assert.ok(statuses.has(result.status), `${row.ref} status ${result.status}`);
  }
  assert.equal(base.rows.filter((row) => row.kind === "check").length, CHECKS.filter((check) => isCheckRef(check.ref)).length);
});

test("POST failed with only non-critical items is a warning that names the item", () => {
  const result = cell(base, "1.1.3");
  assert.equal(result.status, STATUS.WARN);
  assert.match(result.note, /licensed to run on a maximum of 2 cores/);
});

test("interface, IP, hostname, DNS and version checks", () => {
  assert.equal(cell(base, "1.1.1").status, STATUS.PASS);
  assert.equal(cell(base, "1.1.4").status, STATUS.PASS);
  assert.equal(cell(base, "1.1.9").status, STATUS.PASS);
  assert.equal(cell(base, "1.1.10").status, STATUS.PASS);
  assert.equal(cell(base, "1.1.5").status, STATUS.INFO);
  const targeted = buildChecklist([profileWith()], { version: "10.25.0.148", maxConnections: "1000", spoolMb: "75000" });
  assert.equal(cell(targeted, "1.1.5").status, STATUS.PASS);
  assert.equal(cell(targeted, "1.1.8").status, STATUS.PASS);
  assert.equal(cell(targeted, "1.2.2").status, STATUS.PASS);
  const wrong = buildChecklist([profileWith()], { version: "10.26.0.1", maxConnections: "100", spoolMb: "1" });
  assert.equal(cell(wrong, "1.1.5").status, STATUS.FAIL);
  assert.equal(cell(wrong, "1.1.8").status, STATUS.FAIL);
  assert.equal(cell(wrong, "1.2.2").status, STATUS.FAIL);
});

test("plaintext services are flagged", () => {
  assert.equal(cell(base, "1.1.6").status, STATUS.WARN);
  assert.match(cell(base, "1.1.6").note, /8080/);
  assert.equal(cell(base, "1.1.7").status, STATUS.WARN);
  assert.match(cell(base, "1.1.7").note, /55555/);
  assert.equal(cell(base, "4.1.1").status, STATUS.WARN);
  assert.equal(cell(base, "4.4.2").status, STATUS.WARN);
  const rows = parseServiceTable(base.brokers[0].sections.get("show service").body);
  assert.equal(rows.find((row) => row.port === "5671").vpn, "APPVPN");
});

test("spool, redundancy and config-sync on a primary node", () => {
  assert.equal(cell(base, "1.2.3").status, STATUS.PASS);
  assert.equal(cell(base, "1.2.4").status, STATUS.PASS);
  assert.equal(cell(base, "1.1.2").status, STATUS.PASS);
  assert.equal(cell(base, "1.3.1").status, STATUS.PASS);
  assert.match(cell(base, "1.3.1").output, /brk-mon\s+Monitor/);
  assert.equal(cell(base, "1.3.2").status, STATUS.PASS);
  assert.match(cell(base, "1.3.2").output, /APPVPN\s+In-Sync/);
});

test("monitor node gets N/A for HA-pair-only checks", () => {
  const monitorText = diagnostics
    .replace(/Hostname: brk-pri/g, "Hostname: brk-mon")
    .replace("Operating Mode           : Message Routing Node", "Operating Mode           : Monitoring Node")
    .replace("Active-Standby Role      : Primary", "Active-Standby Role      : ");
  const checklist = buildChecklist([profileWith({ hostname: "brk-mon", text: monitorText })]);
  assert.equal(checklist.brokers[0].role, "Monitor");
  assert.equal(cell(checklist, "1.1.2", "brk-mon").status, STATUS.NA);
  assert.equal(cell(checklist, "1.2.3", "brk-mon").status, STATUS.NA);
  assert.equal(cell(checklist, "1.3.2", "brk-mon").status, STATUS.NA);
});

test("certificate checks compute expiry against the snapshot date and verify SAN coverage", () => {
  const expiry = cell(base, "1.8.2");
  assert.equal(expiry.status, STATUS.PASS);
  assert.match(expiry.note, /valid for 609 more days/);
  const san = cell(base, "1.8.1");
  assert.equal(san.status, STATUS.PASS);
  assert.match(san.output, /Subject CN: broker-vip.example.test/);
  assert.equal(cell(base, "4.4.6").status, STATUS.PASS);

  const domainCa = cell(base, "1.8.3");
  assert.equal(domainCa.status, STATUS.FAIL, "an expired CA in the trust store must fail");
  assert.match(domainCa.note, /Old Root CA expired/);
  assert.equal(cell(base, "1.8.4").status, STATUS.INFO, "no client CA configured is informational");

  const certs = parseCertificates(base.brokers[0].sections.get("show ssl server-certificate detail").body);
  assert.equal(certs.length, 2);
  assert.equal(certs[0].keyBits, "4096");
  assert.equal(certs[0].san.length, 10);
  assert.equal(certs[1].isCa, true);
});

test("SAN coverage warns when another uploaded broker is not in the certificate", () => {
  const other = profileWith({ hostname: "brk-other", text: diagnostics.replace(/Hostname: brk-pri/g, "Hostname: brk-other").replace("intf0:1         static    10.10.10.11/28", "intf0:1         static    10.10.10.99/28") });
  const checklist = buildChecklist([profileWith(), other]);
  assert.equal(cell(checklist, "1.8.1").status, STATUS.WARN);
  assert.match(cell(checklist, "1.8.1").output, /brk-other\s+hostname NOT in SAN/);
});

test("health checks surface discards, denials and RDP errors", () => {
  assert.equal(cell(base, "1.11.1").status, STATUS.PASS);
  const discards = cell(base, "1.11.3");
  assert.equal(discards.status, STATUS.WARN);
  assert.match(discards.note, /Transmit Congestion 420,849/);
  assert.match(discards.note, /Messages Expired To Discard 23,399/);
  const denials = cell(base, "1.11.4");
  assert.equal(denials.status, STATUS.WARN);
  assert.match(denials.note, /Denied Authorization Failed 2,990/);
  const logs = cell(base, "1.11.2");
  assert.equal(logs.status, STATUS.WARN);
  assert.match(logs.output, /REST delivery point errors in log window: 2/);
  assert.match(logs.output, /document_parsing_exception: 1/);
});

test("VPN, bridge and replication checks", () => {
  assert.equal(cell(base, "2.1.1").status, STATUS.PASS);
  assert.equal(cell(base, "4.1.2").status, STATUS.PASS);
  const bridges = cell(base, "2.2.1");
  assert.equal(bridges.status, STATUS.PASS);
  assert.match(bridges.output, /B\.APP\.TO\.REM/);
  assert.equal(cell(base, "1.9.1").status, STATUS.NA);
  assert.equal(cell(base, "2.3.1").status, STATUS.NA);
  assert.equal(cell(base, "1.10.1").status, STATUS.PASS);
  assert.equal(cell(base, "4.4.3").status, STATUS.WARN);
  assert.match(cell(base, "4.4.3").note, /3 non-TLS are internal/);
});

test("checks without evidence are Missing with a collection hint, manual items are Manual", () => {
  const ldap = cell(base, "1.4.1");
  assert.equal(ldap.status, STATUS.MISSING);
  assert.match(ldap.note, /supplemental transcript: show ldap-profile \* detail/);
  assert.equal(cell(base, "3.1.1").status, STATUS.MANUAL);
  assert.equal(cell(base, "5.4.2").status, STATUS.MANUAL);
});

test("config export fills config-only checks and evaluates default objects", () => {
  const checklist = buildChecklist([profileWith({ withConfig: true })]);
  assert.equal(cell(checklist, "1.4.1").status, STATUS.INFO);
  assert.match(cell(checklist, "1.4.1").output, /ldaps:\/\/ldap1.example.test/);
  assert.ok(!cell(checklist, "1.4.1").output.includes("S3cretValue"));
  assert.equal(cell(checklist, "1.5.1").status, STATUS.INFO);
  assert.match(cell(checklist, "1.5.1").note, /ops-admin/);
  assert.equal(cell(checklist, "4.1.3").status, STATUS.PASS);
  assert.equal(cell(checklist, "2.1.3").status, STATUS.INFO);
  assert.match(cell(checklist, "2.1.3").output, /Max Spool Usage \(MB\): 60000/);
  assert.equal(cell(checklist, "4.4.4").status, STATUS.PASS);
  assert.equal(cell(checklist, "1.6.1").status, STATUS.INFO);
  assert.match(cell(checklist, "2.1.9").output, /app\/in\/>/);
  assert.equal(cell(checklist, "4.4.1").source, "diagnostics+config");
});

test("supplemental transcript sections override missing evidence", () => {
  const checklist = buildChecklist([profileWith({ withSupplemental: true })]);
  assert.equal(cell(checklist, "1.5.2").status, STATUS.PASS);
  assert.equal(cell(checklist, "1.5.2").source, "supplemental");
  assert.equal(cell(checklist, "4.4.5").status, STATUS.INFO);
  assert.match(cell(checklist, "4.4.5").output, /Allowed TLS versions: 1\.2/);
  assert.equal(cell(checklist, "1.11.2").status, STATUS.WARN);
  assert.match(cell(checklist, "1.11.2").output, /System log lines with ERROR\/CRITICAL: 0/);
});

test("summary counts add up to the number of checks", () => {
  const total = Object.values(base.summary.total).reduce((sum, value) => sum + value, 0);
  assert.equal(total, base.rows.filter((row) => row.kind === "check").length);
  assert.ok(base.summary.total.fail >= 1);
  assert.ok(base.summary.total.pass >= 10);
});
