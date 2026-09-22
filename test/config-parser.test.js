import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseConfig, extractConfigFacts, findNodes, flatten, redactLine } from "../src/config-parser.js";

const config = readFileSync(new URL("./fixtures/current-config.sample.cli", import.meta.url), "utf8");

test("builds a tree from indentation and ignores exit lines", () => {
  const parsed = parseConfig(config);
  assert.equal(parsed.routerName, "brk-pri");
  const vpn = parsed.root.children.find((node) => node.text === 'message-vpn "APPVPN"');
  assert.ok(vpn);
  const auth = vpn.children.find((node) => node.text === "authentication");
  const basic = auth.children.find((node) => node.text === "basic");
  assert.equal(basic.children[0].text, "auth-type internal");
  assert.ok(!findNodes(parsed.root, /^exit$/).length, "exit lines must not become nodes");
});

test("redacts credentials before they reach any output", () => {
  const parsed = parseConfig(config);
  const text = flatten(parsed.root, { includeSelf: false, maxLines: 1000 });
  assert.ok(!text.includes("S3cretValue"), "password value leaked");
  assert.match(text, /admin password \[redacted\]/);
  assert.equal(redactLine('client-secret "abc"'), "client-secret [redacted]");
  assert.equal(redactLine("max-connections 1000"), "max-connections 1000");
});

test("shutdown state is resolved per block, not by line order", () => {
  const facts = extractConfigFacts(parseConfig(config));
  assert.equal(facts.vpns.get("APPVPN").state, "Enabled");
  assert.equal(facts.vpns.get("default").state, "Disabled");
  assert.equal(facts.clientUsernames.get("app-pub@APPVPN").state, "Enabled");
  assert.equal(facts.clientUsernames.get("default@APPVPN").state, "Disabled");
  assert.equal(facts.clientUsernames.get("default@default").state, "Disabled");
  assert.equal(facts.ldapProfiles.get("corp-ldap").state, "Enabled");
});

test("extracts VPN limits, authentication and profile assignments", () => {
  const facts = extractConfigFacts(parseConfig(config));
  const vpn = facts.vpns.get("APPVPN");
  assert.equal(vpn.maxConnections, "1000");
  assert.equal(vpn.maxSpoolUsage, "60000");
  assert.equal(vpn.basicAuthType, "internal");
  assert.equal(vpn.clientCertificateState, "Disabled");
  assert.equal(vpn.oauthState, "Disabled");
  const user = facts.clientUsernames.get("app-pub@APPVPN");
  assert.equal(user.clientProfile, "app-profile");
  assert.equal(user.aclProfile, "app-acl");
  assert.equal(facts.clientProfiles.get("app-profile@APPVPN").text.includes("no ssl allow-downgrade-to-plain-text"), true);
  assert.match(facts.aclProfiles.get("app-acl@APPVPN").text, /client-connect default-action disallow/);
});

test("extracts queues with subscriptions, usernames, auth types and syslog", () => {
  const facts = extractConfigFacts(parseConfig(config));
  const queue = facts.queues.get("Q.APP.IN@APPVPN");
  assert.deepEqual(queue.subscriptions, ["app/in/>", "app/events/*"]);
  assert.deepEqual(facts.usernames.map((user) => [user.name, user.level]), [["ops-admin", "admin"], ["ops-ro", "read-only"]]);
  assert.deepEqual(facts.authTypes, ["user-class cli: auth-type ldap"]);
  assert.equal(facts.defaultGlobalAccess, "");
  assert.match(facts.syslogs.get("central").text, /host "10.10.10.50" transport tcp port 514/);
});
