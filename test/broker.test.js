import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { classifyFile, detectHostname, hostnameFromPath, createBroker, attachFile, detachFile, buildProfile, sortProfiles } from "../src/broker.js";

const diagnostics = readFileSync(new URL("./fixtures/cli-diagnostics.sample.txt", import.meta.url), "utf8");
const config = readFileSync(new URL("./fixtures/current-config.sample.cli", import.meta.url), "utf8");
const supplemental = readFileSync(new URL("./fixtures/supplemental.sample.txt", import.meta.url), "utf8");

test("classifies files by content", () => {
  assert.equal(classifyFile("cli-diagnostics.txt", diagnostics), "diagnostics");
  assert.equal(classifyFile("anything.cli", config), "config");
  assert.equal(classifyFile("session.log", supplemental), "supplemental");
  assert.equal(classifyFile("linux-diagnostics.txt", "# id\nuid=0(root)\n# uname -a\nLinux"), "other");
  // Header format with only a few sections is a supplemental collection, not a full bundle.
  assert.equal(classifyFile("extra.txt", "#####\n# CLI command: show syslog\n# Host: x\n#####\nnothing"), "supplemental");
});

test("detects hostnames from content and from bundle folder names", () => {
  assert.equal(detectHostname("diagnostics", diagnostics), "brk-pri");
  assert.equal(detectHostname("config", config), "brk-pri");
  assert.equal(detectHostname("supplemental", supplemental), "brk-pri");
  assert.equal(detectHostname("config", 'message-vpn "SDEG"\n  no shutdown\n  exit'), "", "must not fall back to a VPN name");
  assert.equal(hostnameFromPath("gather-diagnostics_2d_pc03leabsd2scs1_2026-08-26T16.09.57/cli-diagnostics.txt"), "pc03leabsd2scs1");
  assert.equal(hostnameFromPath("/gather-diagnostics_31d_ac04leabcssis1q/cli-diagnostics.txt"), "ac04leabcssis1q");
  assert.equal(hostnameFromPath("random/path.txt"), "");
});

test("attach and detach files; supplemental files accumulate", () => {
  const broker = createBroker("brk-pri");
  attachFile(broker, { kind: "diagnostics", name: "a.txt", text: diagnostics });
  attachFile(broker, { kind: "supplemental", name: "s1.txt", text: supplemental });
  attachFile(broker, { kind: "supplemental", name: "s2.txt", text: supplemental });
  attachFile(broker, { kind: "supplemental", name: "s1.txt", text: supplemental });
  assert.equal(broker.files.supplemental.length, 2);
  detachFile(broker, "supplemental", "s1.txt");
  assert.deepEqual(broker.files.supplemental.map((file) => file.name), ["s2.txt"]);
  detachFile(broker, "diagnostics");
  assert.equal(broker.files.diagnostics, null);
});

test("builds a profile with role, version, snapshot and management IP", () => {
  const broker = createBroker("brk-pri");
  attachFile(broker, { kind: "diagnostics", name: "cli-diagnostics.txt", text: diagnostics });
  attachFile(broker, { kind: "config", name: "current-config.cli", text: config });
  attachFile(broker, { kind: "supplemental", name: "supplemental.txt", text: supplemental });
  const profile = buildProfile(broker);
  assert.equal(profile.role, "Primary");
  assert.equal(profile.activity, "Local Active");
  assert.equal(profile.redundancyStatus, "Up");
  assert.equal(profile.mate, "brk-bak");
  assert.equal(profile.mateLinkSsl, "Yes");
  assert.equal(profile.version, "10.25.0.148");
  assert.equal(profile.edition, "Enterprise");
  assert.equal(profile.uptime, "60d 0h 6m 39s");
  assert.equal(profile.snapshot.toISOString(), "2026-09-07T15:19:21.000Z");
  assert.deepEqual(profile.managementIps, ["10.10.10.11"]);
  assert.equal(profile.postStatus, "FAILED");
  assert.ok(profile.facts, "config facts present");
  assert.equal(profile.sectionSources.get("show ssl allow-tls-version"), "supplemental");
  assert.equal(profile.sectionSources.get("show version"), "diagnostics");
  assert.deepEqual(profile.warnings, []);
});

test("warns when a config export names a different router", () => {
  const broker = createBroker("other-host");
  attachFile(broker, { kind: "config", name: "current-config.cli", text: config });
  const profile = buildProfile(broker);
  assert.equal(profile.warnings.length, 1);
  assert.match(profile.warnings[0], /brk-pri/);
});

test("sorts profiles primary, backup, monitor", () => {
  const sorted = sortProfiles([
    { hostname: "m", role: "Monitor" },
    { hostname: "z", role: "Unknown" },
    { hostname: "b", role: "Backup" },
    { hostname: "p", role: "Primary" },
  ]);
  assert.deepEqual(sorted.map((profile) => profile.hostname), ["p", "b", "m", "z"]);
});
