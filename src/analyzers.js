// Per-check analyzers: turn CLI sections and config facts into an output text plus a verdict.
//
// Every analyzer receives a context and returns { status, output, note } (or null to fall
// back to the default behaviour: dump the found sections). Analyzers are keyed by check ref.
//
// Status vocabulary:
//   pass     evidence found and it meets the expected result
//   warn     evidence found and it needs attention (not necessarily a failure)
//   fail     evidence found and it contradicts the expected result
//   info     evidence found; comparison against the design is left to the reviewer
//   manual   no CLI evidence can answer this check; verify by procedure
//   na       not applicable to this broker (e.g. HA checks on a monitor node)
//   missing  the check asks for CLI sections that were not uploaded

import { findSection, valueOf, valuesOf, linesStartingWith, blockBetween, counterOf, parseFixedTable, parseCliDate, formatDate, daysBetween } from "./sections.js";
import { commandAlternatives } from "./checks.js";

export const STATUS = {
  PASS: "pass",
  WARN: "warn",
  FAIL: "fail",
  INFO: "info",
  MANUAL: "manual",
  NA: "na",
  MISSING: "missing",
};

export const STATUS_LABEL = {
  pass: "Pass",
  warn: "Warning",
  fail: "Fail",
  info: "Info",
  manual: "Manual",
  na: "N/A",
  missing: "Missing",
};

export const STATUS_ORDER = ["fail", "warn", "missing", "info", "pass", "manual", "na"];

// Commands the standard gather-diagnostics bundle produces (verified against real bundles).
export const GATHER_DIAGNOSTICS_COMMANDS = new Set([
  "show hostname", "show version", "show router-name", "show hardware detail", "show system post", "show system detail",
  "show system health", "show ip vrf management", "show redundancy detail", "show redundancy group", "show message-spool detail",
  "show stats client detail", "show environment", "show config-sync", "show config-sync database detail",
  "show config-sync database remote", "show replication stats", "show interface detail", "show process",
  "show message-spool stats", "show product-key", "show ssl server-certificate detail", "show certificate-authority ca-name * cert",
  "show client-certificate-authority ca-name * cert", "show domain-certificate-authority ca-name * cert",
  "show ssl certificate-files detail", "show storage-element * detail", "show service", "show memory",
  "show log rest rest-delivery-point errors wide", "show log no-subscription-match wide", "show log acl client-connect wide",
  "show log acl publish-topic wide", "show log acl subscribe-topic wide", "show bridge *", "show message-vpn *",
  "show message-vpn * dynamic-message-routing", "show message-vpn * replication", "show message-vpn #config-sync detail",
  "show routing", "show semp-session *", "show session", "show debug dns", "show debug ad-show-alarms", "show web-manager",
  "show interface intf0", "show bridge #msgvpn_replication_bridge message-vpn * detail",
  "show queue #msgvpn_replication_data_queue message-vpn * detail", "show message-spool message-vpn #config-sync detail",
]);

export const CERT_WARN_DAYS = 90;
export const USAGE_WARN_PERCENT = 80;

function result(status, output, note = "") {
  return { status, output: output ?? "", note };
}

function body(ctx, command) {
  const section = findSection(ctx.profile.sections, command);
  return section ? section.body : "";
}

function has(ctx, command) {
  return Boolean(findSection(ctx.profile.sections, command));
}

function joinSections(ctx, commands, { withTitles = true } = {}) {
  const parts = [];
  for (const entry of commands) {
    const section = findSection(ctx.profile.sections, entry);
    if (!section) continue;
    parts.push(withTitles && commands.length > 1 ? `--- ${section.command}\n${section.body}` : section.body);
  }
  return parts.join("\n\n");
}

function kvLines(text, labels) {
  return linesStartingWith(text, labels).map((line) => line.trim());
}

function referenceDate(ctx) {
  return ctx.profile.snapshot || ctx.now || new Date();
}

function percent(value) {
  const match = /(\d+(?:\.\d+)?)\s*%/.exec(String(value));
  return match ? Number(match[1]) : null;
}

function configOnly(ctx) {
  return Boolean(ctx.profile.facts);
}

// ---- Service table --------------------------------------------------------------------------

const MESSAGING_SERVICES = new Set(["SMF", "AMQP", "REST", "MQTT"]);
const MANAGEMENT_SERVICES = new Set(["SEMP"]);

export function parseServiceTable(text) {
  const table = parseFixedTable(text, /^Service\s+TP\s+S C R\s+VRF/);
  return table.rows.map((row) => {
    const [ssl = "-", compressed = "-", routing = "-"] = (row["S C R"] || "").split(/\s+/);
    const [admin = "-", oper = "-"] = (row["A O"] || "").split(/\s+/);
    return {
      service: row.Service,
      transport: row.TP,
      ssl,
      compressed,
      routing,
      vrf: row.VRF,
      vpn: row.MsgVpn,
      port: row.Port,
      admin,
      oper,
      reason: row["Failed Reason"],
      line: row.__line.trim(),
    };
  });
}

function describeService(row) {
  return `${row.service} ${row.transport} ${row.port || "(no port)"}${row.vpn ? ` [${row.vpn}]` : ""}`;
}

function plaintextUp(rows, services) {
  return rows.filter((row) => services.has(row.service) && row.ssl === "N" && row.oper === "U");
}

// ---- Certificates ---------------------------------------------------------------------------

export function parseCertificates(text) {
  const certificates = [];
  let cert = null;
  let mode = null;
  let lastTitle = "";

  for (const raw of (text || "").split("\n")) {
    const line = raw.trim();
    const title = /^(Filename|Certificate Authority|Client Certificate Authority|Domain Certificate Authority|Chain depth)\s*:\s*(.*)$/.exec(line);
    if (title) {
      lastTitle = title[1] === "Chain depth" ? `Chain depth ${title[2]}` : title[2].trim();
      continue;
    }
    if (/^Version:\s*\d/.test(line)) {
      cert = { title: lastTitle, issuer: {}, subject: {}, san: [], signatureAlgorithm: "", notBefore: null, notAfter: null, keyBits: "", isCa: false };
      certificates.push(cert);
      mode = null;
      continue;
    }
    if (!cert) continue;

    if (/^Signature Algorithm:/.test(line) && !cert.signatureAlgorithm) {
      cert.signatureAlgorithm = line.split(":")[1].trim();
      continue;
    }
    if (/^Issuer:/.test(line)) {
      mode = "issuer";
      parseInlineName(line.replace(/^Issuer:\s*/, ""), cert.issuer);
      continue;
    }
    if (/^Subject:/.test(line)) {
      mode = "subject";
      parseInlineName(line.replace(/^Subject:\s*/, ""), cert.subject);
      continue;
    }
    if (line === "Validity") {
      mode = null;
      continue;
    }
    if (/^Not Before:/.test(line)) {
      cert.notBefore = parseCliDate(line.replace(/^Not Before:\s*/, ""));
      continue;
    }
    if (/^Not After\s*:/.test(line)) {
      cert.notAfter = parseCliDate(line.replace(/^Not After\s*:\s*/, ""));
      continue;
    }
    if (/^Subject Public Key Info/.test(line)) {
      mode = null;
      continue;
    }
    const key = /^Public-Key:\s*\((\d+)\s*bit\)/.exec(line);
    if (key) {
      cert.keyBits = key[1];
      continue;
    }
    if (/^X509v3 Subject Alternative Name/.test(line)) {
      mode = "san";
      continue;
    }
    if (mode === "san") {
      cert.san.push(...line.split(/,\s*/).map((item) => item.trim()).filter(Boolean));
      mode = null;
      continue;
    }
    if (/^CA:\s*TRUE/i.test(line)) cert.isCa = true;
    if (mode === "issuer" || mode === "subject") {
      const pair = /^([A-Za-z]+)\s*=\s*(.*)$/.exec(line);
      if (pair) cert[mode][pair[1]] = pair[2].trim();
      else mode = null;
    }
  }
  return certificates;
}

function parseInlineName(text, target) {
  if (!text) return;
  for (const part of text.split(/,\s*(?=[A-Za-z]+=)/)) {
    const pair = /^([A-Za-z]+)\s*=\s*(.*)$/.exec(part.trim());
    if (pair) target[pair[1]] = pair[2].trim();
  }
}

function describeCertificate(cert, reference) {
  const days = cert.notAfter ? daysBetween(reference, cert.notAfter) : null;
  const lines = [];
  if (cert.title) lines.push(cert.title);
  if (cert.subject.CN) lines.push(`  Subject CN: ${cert.subject.CN}${cert.subject.O ? ` (O=${cert.subject.O})` : ""}`);
  if (cert.issuer.CN) lines.push(`  Issuer CN:  ${cert.issuer.CN}`);
  if (cert.notBefore || cert.notAfter) {
    lines.push(`  Valid:      ${formatDate(cert.notBefore) || "?"} -> ${formatDate(cert.notAfter) || "?"}`);
  }
  if (days !== null) lines.push(`  Remaining:  ${days} days${days < 0 ? " (EXPIRED)" : days < CERT_WARN_DAYS ? " (renew soon)" : ""}`);
  if (cert.signatureAlgorithm || cert.keyBits) lines.push(`  Key/Sig:    ${cert.keyBits ? `${cert.keyBits}-bit` : ""} ${cert.signatureAlgorithm}`.replace(/\s+/g, " ").trimEnd());
  return lines.join("\n");
}

function certificateStatus(certs, reference) {
  let status = STATUS.PASS;
  const notes = [];
  for (const cert of certs) {
    if (!cert.notAfter) continue;
    const days = daysBetween(reference, cert.notAfter);
    if (days < 0) {
      status = STATUS.FAIL;
      notes.push(`${cert.subject.CN || cert.title} expired ${-days} days ago`);
    } else if (days < CERT_WARN_DAYS) {
      if (status !== STATUS.FAIL) status = STATUS.WARN;
      notes.push(`${cert.subject.CN || cert.title} expires in ${days} days`);
    }
  }
  return { status, note: notes.join("; ") };
}

// ---- Storage --------------------------------------------------------------------------------

export function parseStorageElements(text) {
  const elements = [];
  let current = null;
  for (const raw of (text || "").split("\n")) {
    const line = raw.trim();
    const start = /^Storage Element\s*:\s*(.+)$/.exec(line);
    if (start) {
      current = { name: start[1].trim(), device: "", size: "", used: "", available: "", usePercent: null, elementUsed: "", threshold: "" };
      elements.push(current);
      continue;
    }
    if (!current) continue;
    const pair = /^([A-Za-z %]+?)\s*:\s*(.*)$/.exec(line);
    if (!pair) continue;
    const [, key, value] = pair;
    if (key === "Name" && !current.device) current.device = value.trim();
    else if (key === "Size" && !current.size) current.size = value.trim();
    else if (key === "Used" && !current.used) current.used = value.trim();
    else if (key === "Used" && current.used) current.elementUsed = value.trim();
    else if (key === "Available") current.available = value.trim();
    else if (key === "Use %") current.usePercent = percent(value);
    else if (key === "Usage Threshold") current.threshold = value.trim();
  }
  return elements;
}

function storageSummary(elements) {
  const header = "Element              Device            Size            Used            Use%";
  const rows = elements.map((element) => `${element.name.padEnd(20)} ${element.device.padEnd(17)} ${element.size.padEnd(15)} ${element.used.padEnd(15)} ${element.usePercent === null ? "-" : `${element.usePercent}%`}`);
  return [header, ...rows].join("\n");
}

// ---- Tables used by several analyzers ------------------------------------------------------

function messageVpnRows(text) {
  return [...(text || "").matchAll(/^(\S+)\s+(Up|Down|Standby)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*$/gm)].map((match) => ({
    name: match[1],
    status: match[2],
    connections: Number(match[6]),
    line: match[0].trim(),
  }));
}

function replicationRows(text) {
  const table = parseFixedTable(text, /^Message VPN\s+A C B R Q S M T/);
  return table.rows.map((row) => {
    const flags = (row["A C B R Q S M T"] || "").split(/\s+/);
    return { name: row["Message VPN"], admin: flags[0] || "-", configState: flags[1] || "-", line: row.__line.trim() };
  });
}

function bridgeRows(text) {
  const lines = (text || "").split("\n");
  const start = lines.findIndex((line) => /^-{4,}\s+-{4,}/.test(line));
  if (start === -1) return [];
  const rows = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) break;
    const match = /^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+([UD-]) ([LR-]) ([UD-]) ([UD-]) ([UD-]) ([PBA-])\s+(.*)$/.exec(line);
    if (match) {
      rows.push({ name: match[1], localVpn: match[2], remoteVpn: match[3], remoteRouter: match[4], admin: match[5], establisher: match[6], inbound: match[7], outbound: match[8], queue: match[9], redundancy: match[10], uptime: match[11].trim(), line: line.trim() });
    } else if (rows.length && /^\s+\S/.test(line)) {
      const continuation = line.trim().split(/\s+/);
      rows[rows.length - 1].name += continuation[0];
      rows[rows.length - 1].line += ` ${line.trim()}`;
    }
  }
  return rows;
}

function countTableRows(text) {
  const lines = (text || "").split("\n");
  const dash = lines.findIndex((line) => /^-{5,}/.test(line.trim()));
  if (dash === -1) return 0;
  return lines.slice(dash + 1).filter((line) => /^\d{4}-\d{2}-\d{2}T/.test(line.trim())).length;
}

// ---- Config-fallback renderers --------------------------------------------------------------

function listMap(map, render) {
  return [...map.values()].map(render).join("\n\n");
}

function vpnAuthSummary(vpn) {
  return [
    `${vpn.name}:`,
    `  Basic Authentication: ${vpn.basicState || "Enabled (default)"}${vpn.basicAuthType ? `, auth-type ${vpn.basicAuthType}` : ""}${vpn.basicProfile ? `, profile ${vpn.basicProfile}` : ""}`,
    `  Client Certificate Authentication: ${vpn.clientCertificateState || "Disabled (default)"}`,
    `  OAuth Authentication: ${vpn.oauthState || "Disabled (default)"}${vpn.oauthDefaultProfile ? `, default profile ${vpn.oauthDefaultProfile}` : ""}`,
    `  Authorization Type: ${vpn.authorizationType || "internal (default)"}`,
  ].join("\n");
}

// ---- Analyzers ------------------------------------------------------------------------------

const ANALYZERS = {
  "1.1.1": (ctx) => {
    const text = body(ctx, "show interface intf0") || body(ctx, "show interface detail");
    if (!text) return null;
    const enabled = valueOf(text, "Enabled");
    const oper = valueOf(text, "Operational State");
    const link = valueOf(text, "Link detected");
    const ok = /^yes/i.test(enabled) && /^Up/i.test(oper) && /^yes/i.test(link);
    const output = kvLines(text, ["Interface:", "OS Physical Interface:", "IP address:", "Enabled:", "Operational State:", "Link detected:", "Last Failure Reason:"]).join("\n");
    return result(ok ? STATUS.PASS : STATUS.FAIL, output, ok ? "" : `Enabled=${enabled || "?"}, Operational=${oper || "?"}, Link=${link || "?"}`);
  },

  "1.1.2": (ctx) => {
    const text = body(ctx, "show redundancy detail");
    if (!text) return null;
    if (ctx.profile.role === "Monitor" || ctx.profile.role === "Standalone") {
      return result(STATUS.NA, `Role: ${ctx.profile.role}. ADB links only apply to the active/standby pair.`);
    }
    const link = valueOf(text, "ADB Link To Mate");
    const hello = valueOf(text, "ADB Hello To Mate");
    const lines = blockBetween(text, /^ADB Link To Mate/, /^Interface\s+Static Address/).map((line) => line.trimEnd());
    const ok = /^Up/i.test(link) && /^Up/i.test(hello);
    return result(ok ? STATUS.PASS : STATUS.FAIL, lines.join("\n"), ok ? "" : `ADB Link=${link || "?"}, ADB Hello=${hello || "?"}`);
  },

  "1.1.3": (ctx) => {
    const text = body(ctx, "show system post");
    if (!text) return null;
    const overall = valueOf(text, "Overall Power-On Self Test (POST) Status");
    if (/^PASSED/i.test(overall)) return result(STATUS.PASS, text);
    const critical = text.split("\n").filter((line) => /\[CRITICAL\]/.test(line));
    const nonCritical = text.split("\n").filter((line) => /\[NON-CRITICAL\]/.test(line));
    if (critical.length) return result(STATUS.FAIL, text, `${critical.length} critical POST item(s)`);
    if (nonCritical.length) return result(STATUS.WARN, text, `POST FAILED with ${nonCritical.length} non-critical item(s): ${nonCritical.map((line) => line.trim().replace(/^\d+\s+\[NON-CRITICAL\]\s*/, "")).join("; ")}`);
    return result(STATUS.FAIL, text, `POST status ${overall || "unknown"}`);
  },

  "1.1.4": (ctx) => {
    const text = body(ctx, "show ip vrf management");
    if (!text) return null;
    const ips = ctx.profile.managementIps;
    const defaultRoute = text.split("\n").find((line) => /^default\s+\S+/.test(line.trim()));
    const interfaces = blockBetween(text, /^Interface\s+V Router/, /^\s*$/);
    const output = [...interfaces, "", defaultRoute ? defaultRoute.trim() : "default route: NOT FOUND"].join("\n");
    if (!ips.length) return result(STATUS.FAIL, output, "No IPv4 address on the management interface");
    if (!defaultRoute) return result(STATUS.FAIL, output, "No default route");
    if (ips.length > 1) return result(STATUS.WARN, output, `${ips.length} IPv4 addresses on the management interface: ${ips.join(", ")}`);
    return result(STATUS.PASS, output);
  },

  "1.1.5": (ctx) => {
    const text = body(ctx, "show version");
    if (!text) return null;
    const version = ctx.profile.version;
    const output = kvLines(text, ["Solace PubSub+", "Current load is:", "System uptime:", "Backout load"]).join("\n");
    if (ctx.targets.version) {
      const ok = version === ctx.targets.version.trim();
      return result(ok ? STATUS.PASS : STATUS.FAIL, output, ok ? `Matches design version ${ctx.targets.version}` : `Design version ${ctx.targets.version}, broker runs ${version}`);
    }
    const versions = new Set(ctx.profiles.map((profile) => profile.version).filter(Boolean));
    if (versions.size > 1) return result(STATUS.WARN, output, `Versions differ across brokers: ${[...versions].join(", ")}`);
    return result(ctx.profiles.length > 1 ? STATUS.PASS : STATUS.INFO, output, ctx.profiles.length > 1 ? `Consistent across ${ctx.profiles.length} brokers` : "Set a design version in Design targets to enforce");
  },

  "1.1.6": (ctx) => {
    const text = body(ctx, "show service");
    if (!text) return null;
    const rows = parseServiceTable(text).filter((row) => MANAGEMENT_SERVICES.has(row.service));
    if (!rows.length) return result(STATUS.MISSING, "", "SEMP rows not found in show service");
    const secureUp = rows.some((row) => row.ssl === "Y" && row.oper === "U");
    const plain = rows.filter((row) => row.ssl === "N" && row.oper === "U");
    const output = rows.map((row) => row.line).join("\n");
    if (!secureUp) return result(STATUS.FAIL, output, "Secure SEMP (1943) is not operationally Up");
    if (plain.length) return result(STATUS.WARN, output, `Plaintext SEMP is Up: ${plain.map(describeService).join(", ")}`);
    return result(STATUS.PASS, output);
  },

  "1.1.7": (ctx) => {
    const text = body(ctx, "show service");
    if (!text) return null;
    const rows = parseServiceTable(text).filter((row) => MESSAGING_SERVICES.has(row.service));
    const up = rows.filter((row) => row.oper === "U");
    const plain = plaintextUp(rows, MESSAGING_SERVICES);
    const brokerLevel = up.filter((row) => !row.vpn);
    const vpnLevel = up.filter((row) => row.vpn);
    const output = [
      "Broker-level messaging services Up:",
      ...(brokerLevel.length ? brokerLevel.map((row) => `  ${describeService(row)}${row.ssl === "Y" ? " (TLS)" : " (plaintext)"}`) : ["  none"]),
      "",
      "Message VPN services Up:",
      ...(vpnLevel.length ? vpnLevel.map((row) => `  ${describeService(row)}${row.ssl === "Y" ? " (TLS)" : " (plaintext)"}`) : ["  none"]),
    ].join("\n");
    if (plain.length) return result(STATUS.WARN, output, `Plaintext messaging services Up: ${plain.map(describeService).join(", ")}`);
    return result(STATUS.PASS, output, "Only TLS messaging services are Up");
  },

  "1.1.8": (ctx) => {
    const text = body(ctx, "show system detail|show system");
    if (!text) return null;
    const scaling = blockBetween(text, /^Scaling:/, /^\s*$/).map((line) => line.trimEnd());
    const max = valueOf(text, "Max Connections");
    const output = scaling.join("\n");
    if (ctx.targets.maxConnections) {
      const ok = String(max).trim() === String(ctx.targets.maxConnections).trim();
      return result(ok ? STATUS.PASS : STATUS.FAIL, output, ok ? "" : `Design tier ${ctx.targets.maxConnections}, broker reports ${max}`);
    }
    return result(STATUS.INFO, output, `Max Connections ${max || "?"}. Set the design tier in Design targets to enforce`);
  },

  "1.1.9": (ctx) => {
    const hostText = body(ctx, "show hostname");
    const routerText = body(ctx, "show router-name");
    if (!hostText && !routerText) return null;
    const hostname = valueOf(hostText, "Hostname");
    const routerName = valueOf(routerText, "Router Name");
    const mirroring = valueOf(routerText, "Mirroring Hostname");
    const output = [...kvLines(hostText, ["Hostname:"]), ...kvLines(routerText, ["Router Name:", "Mirroring Hostname:", "Unique Id:"])].join("\n");
    const duplicates = ctx.profiles.filter((profile) => profile.hostname === ctx.profile.hostname).length;
    if (duplicates > 1) return result(STATUS.FAIL, output, "Hostname is not unique across uploaded brokers");
    if (hostname && routerName && hostname === routerName && /^Yes/i.test(mirroring)) return result(STATUS.PASS, output);
    return result(STATUS.WARN, output, `Router name ${routerName || "?"} vs hostname ${hostname || "?"}; mirroring=${mirroring || "?"}`);
  },

  "1.1.10": (ctx) => {
    const text = body(ctx, "show debug dns");
    if (!text) return null;
    const servers = [...text.matchAll(/^\s*server:\s*"([^"]+)"/gm)].map((match) => match[1]);
    const output = servers.length ? `DNS servers:\n${servers.map((server) => `  ${server}`).join("\n")}` : "No DNS servers configured";
    if (servers.length >= 2) return result(STATUS.PASS, output);
    if (servers.length === 1) return result(STATUS.WARN, output, "Only one DNS server configured; no redundancy");
    return result(STATUS.FAIL, output);
  },

  "1.2.1": (ctx) => {
    const text = body(ctx, "show storage-element * detail");
    if (!text) return null;
    const elements = parseStorageElements(text);
    const devices = [...new Set(elements.map((element) => element.device.replace(/\s*\(\d+\)$/, "")).filter(Boolean))];
    const hot = elements.filter((element) => element.usePercent !== null && element.usePercent >= USAGE_WARN_PERCENT);
    const output = `${storageSummary(elements)}\n\nDevices: ${devices.join(", ") || "none"}`;
    if (hot.length) return result(STATUS.WARN, output, `Usage at or above ${USAGE_WARN_PERCENT}%: ${hot.map((element) => `${element.name} ${element.usePercent}%`).join(", ")}`);
    return result(STATUS.INFO, output, "Confirm on the host that these devices map to external block storage");
  },

  "1.2.2": (ctx) => {
    const text = body(ctx, "show message-spool detail|show message-spool");
    if (!text) return null;
    const max = valueOf(text, "Maximum Spool Usage");
    const output = kvLines(text, ["Config Status:", "Maximum Spool Usage:", "Using Internal Disk:", "Active Disk Partition Usage:"]).join("\n");
    if (ctx.targets.spoolMb) {
      const value = Number(String(max).replace(/[^\d]/g, ""));
      const ok = value === Number(ctx.targets.spoolMb);
      return result(ok ? STATUS.PASS : STATUS.FAIL, output, ok ? "" : `Design spool ${ctx.targets.spoolMb} MB, broker reports ${max}`);
    }
    return result(STATUS.INFO, output, `Maximum Spool Usage ${max || "?"}. Set the design spool size in Design targets to enforce`);
  },

  "1.2.3": (ctx) => {
    const text = body(ctx, "show message-spool detail|show message-spool");
    if (!text) return null;
    const config = valueOf(text, "Config Status");
    const oper = valueOf(text, "Operational Status");
    const sync = valueOf(text, "Synchronization Status");
    const output = kvLines(text, ["Config Status:", "Operational Status:", "Datapath Status:", "Synchronization Status:", "Spool-Sync Status:"]).join("\n");
    const role = ctx.profile.role;
    if (role === "Monitor") return result(STATUS.NA, `${output}\n\nMonitoring node: message spool is expected to be Disabled.`);
    let expectedConfig = "Enabled (Primary)";
    if (role === "Backup") expectedConfig = "Enabled (Backup)";
    const configOk = config.startsWith(expectedConfig);
    const operOk = /^AD-(Active|Standby)/.test(oper);
    if (!configOk) return result(STATUS.FAIL, output, `Expected "${expectedConfig}" for a ${role} node, found "${config || "?"}"`);
    if (!operOk) return result(STATUS.FAIL, output, `Operational status ${oper || "?"}`);
    if (sync && !/^Synced/i.test(sync)) return result(STATUS.WARN, output, `Synchronization status ${sync}`);
    const note = oper.startsWith("AD-Standby") && role === "Primary" ? "Primary is standby: the backup currently holds activity" : "";
    return result(STATUS.PASS, output, note);
  },

  "1.2.4": (ctx) => {
    const text = body(ctx, "show message-spool detail");
    if (!text) return null;
    const block = blockBetween(text, /^Defragmentation:/, /^Number of delete in-progress/).map((line) => line.trimEnd());
    const schedule = valueOf(text, "Schedule Enabled");
    const threshold = valueOf(text, "Threshold Enabled");
    const output = block.join("\n");
    if (ctx.profile.role === "Monitor") return result(STATUS.NA, output, "Monitoring node has no active spool");
    if (/^Yes/i.test(schedule) || /^Yes/i.test(threshold)) return result(STATUS.PASS, output, `Schedule=${schedule}, Threshold=${threshold}`);
    return result(STATUS.WARN, output, "Neither scheduled nor threshold defragmentation is enabled; monitor SYSTEM_AD_SPOOL_FILES_HIGH");
  },

  "1.3.1": (ctx) => {
    const text = body(ctx, "show redundancy detail");
    const groupText = body(ctx, "show redundancy group");
    if (!text && !groupText) return null;
    const groupTable = groupText ? blockBetween(groupText, /^Node Router-Name/, /^\s*$/).map((line) => line.trimEnd()) : [];
    const groupRows = groupText ? parseFixedTable(groupText, /^Node Router-Name\s+Node Type/).rows : [];
    const offline = groupRows.filter((row) => !/^Online/i.test(row.Status || ""));

    if (ctx.profile.role === "Standalone") {
      return result(STATUS.NA, kvLines(text, ["Configuration Status", "Redundancy Status"]).join("\n"), "Redundancy is disabled: standalone broker");
    }
    if (ctx.profile.role === "Monitor") {
      const output = [...kvLines(text, ["Configuration Status", "Redundancy Status", "Operating Mode"]), "", ...groupTable].join("\n");
      if (offline.length) return result(STATUS.WARN, output, `Group members not Online: ${offline.map((row) => row["Node Router-Name"]).join(", ")}`);
      return result(groupRows.length ? STATUS.PASS : STATUS.INFO, output, groupRows.length ? `All ${groupRows.length} group members Online` : "");
    }

    const configStatus = valueOf(text, "Configuration Status");
    const status = valueOf(text, "Redundancy Status");
    const link = valueOf(text, "ADB Link To Mate");
    const hello = valueOf(text, "ADB Hello To Mate");
    const ssl = ctx.profile.mateLinkSsl;
    const output = [
      ...kvLines(text, ["Configuration Status", "Redundancy Status", "Last Failure Reason", "Last Failure Time", "Operating Mode", "Redundancy Mode", "Active-Standby Role", "Mate Router Name", "Mate-Link Connect Via", "Remote Port", "SSL", "ADB Link To Mate", "ADB Hello To Mate"]),
      "",
      ...(/^Activity Status/m.test(text) ? [text.split("\n").find((line) => /^Activity Status/.test(line)).trimEnd()] : []),
      "",
      ...groupTable,
    ].join("\n").replace(/\n{3,}/g, "\n\n").trim();

    if (!/^Enabled/i.test(configStatus)) return result(STATUS.FAIL, output, `Configuration status ${configStatus || "?"}`);
    if (!/^Up/i.test(status)) return result(STATUS.FAIL, output, `Redundancy status ${status || "?"}`);
    if (!/^Up/i.test(link) || !/^Up/i.test(hello)) return result(STATUS.FAIL, output, `ADB Link=${link || "?"}, ADB Hello=${hello || "?"}`);
    if (offline.length) return result(STATUS.WARN, output, `Group members not Online: ${offline.map((row) => row["Node Router-Name"]).join(", ")}`);
    if (ssl && !/^Yes/i.test(ssl)) return result(STATUS.WARN, output, "Mate-link is not SSL enabled");
    return result(STATUS.PASS, output, `Role ${ctx.profile.role}, activity ${ctx.profile.activity || "?"}`);
  },

  "1.3.2": (ctx) => {
    const text = body(ctx, "show config-sync");
    const dbText = body(ctx, "show config-sync database detail");
    if (!text && !dbText) return null;
    if (ctx.profile.role === "Monitor") return result(STATUS.NA, kvLines(text, ["Admin Status", "Oper Status"]).join("\n"), "Config-sync does not run on a monitoring node");
    if (ctx.profile.role === "Standalone") return result(STATUS.NA, kvLines(text, ["Admin Status", "Oper Status"]).join("\n"), "Standalone broker");
    const admin = valueOf(text, "Admin Status");
    const oper = valueOf(text, "Oper Status");
    const ssl = valueOf(text, "SSL Enabled");
    const states = [];
    if (dbText) {
      const names = [...valuesOf(dbText, "Router"), ...valuesOf(dbText, "Message-VPN")];
      const syncStates = valuesOf(dbText, "Sync State");
      const results = valuesOf(dbText, "Last Result");
      names.forEach((name, index) => states.push({ name, state: syncStates[index] || "?", last: results[index] || "" }));
    }
    const output = [
      ...kvLines(text, ["Admin Status", "Oper Status", "SSL Enabled", "Connection State", "Last Fail Reason"]),
      ...(states.length ? ["", "Database sync state:", ...states.map((state) => `  ${state.name.padEnd(24)} ${state.state}${state.last ? ` (last result ${state.last})` : ""}`)] : []),
    ].join("\n");
    if (!/^Enabled/i.test(admin)) return result(STATUS.FAIL, output, `Admin status ${admin || "?"}`);
    if (!/^Up/i.test(oper)) return result(STATUS.FAIL, output, `Oper status ${oper || "?"}`);
    const outOfSync = states.filter((state) => !/^In-Sync/i.test(state.state));
    if (outOfSync.length) return result(STATUS.WARN, output, `Not In-Sync: ${outOfSync.map((state) => `${state.name} (${state.state})`).join(", ")}`);
    if (ssl && !/^Yes/i.test(ssl)) return result(STATUS.WARN, output, "Config-sync SSL is not enabled");
    return result(STATUS.PASS, output);
  },

  "1.4.1": (ctx) => {
    if (has(ctx, "show ldap-profile * detail")) return null;
    if (!configOnly(ctx)) return null;
    const profiles = ctx.profile.facts.ldapProfiles;
    if (!profiles.size) return result(STATUS.INFO, "No LDAP profile in current-config", "Not configured (fine when LDAP is not part of the design)");
    return result(STATUS.INFO, listMap(profiles, (profile) => profile.text), "Source: current-config");
  },

  "1.4.2": (ctx) => {
    if (has(ctx, "show oauth-profile * detail")) return null;
    if (!configOnly(ctx)) return null;
    const profiles = ctx.profile.facts.oauthProfiles;
    if (!profiles.size) return result(STATUS.INFO, "No OAuth profile in current-config", "Not configured (fine when OAuth is not part of the design)");
    return result(STATUS.INFO, listMap(profiles, (profile) => profile.text), "Source: current-config");
  },

  "1.5.1": (ctx) => {
    if (has(ctx, "show username * detail")) return null;
    if (!configOnly(ctx)) return null;
    const users = ctx.profile.facts.usernames;
    if (!users.length) return result(STATUS.INFO, "No CLI usernames in current-config", "Only the built-in admin exists");
    const output = users.map((user) => `${user.name.padEnd(24)} ${user.level || "(level not in export)"}${user.state ? ` [${user.state}]` : ""}`).join("\n");
    const admins = users.filter((user) => /^admin$/i.test(user.level)).map((user) => user.name);
    return result(STATUS.INFO, output, `Source: current-config. Admin-level users: ${admins.join(", ") || "none listed"}`);
  },

  "1.5.2": (ctx) => defaultAccess(ctx),
  "4.3.1": (ctx) => defaultAccess(ctx),

  "1.5.3": (ctx) => {
    if (has(ctx, "show authentication access-level detail")) return null;
    if (!configOnly(ctx)) return null;
    const types = ctx.profile.facts.authTypes;
    return result(STATUS.INFO, types.length ? types.join("\n") : "No auth-type lines under authentication; internal authentication (default)", "Source: current-config");
  },

  "1.5.4": (ctx) => {
    if (has(ctx, "show authentication access-level ldap detail|show authentication access-level ldap")) return null;
    if (!configOnly(ctx)) return null;
    const groups = ctx.profile.facts.ldapGroups;
    return result(STATUS.INFO, groups.length ? groups.join("\n\n") : "No LDAP authorization groups in current-config", "Source: current-config");
  },

  "1.5.5": (ctx) => {
    if (has(ctx, "show oauth-profile * access-level detail|show oauth-profile * access-level")) return null;
    if (!configOnly(ctx)) return null;
    const profiles = ctx.profile.facts.oauthProfiles;
    return result(STATUS.INFO, profiles.size ? listMap(profiles, (profile) => profile.text) : "No OAuth profile in current-config", "Source: current-config");
  },

  "1.6.1": (ctx) => {
    if (has(ctx, "show syslog")) return null;
    if (!configOnly(ctx)) return null;
    const { syslogs, loggingText } = ctx.profile.facts;
    const output = [listMap(syslogs, (item) => item.text), loggingText].filter(Boolean).join("\n\n");
    if (!syslogs.size) return result(STATUS.WARN, output || "No syslog forwarding in current-config", "No remote syslog host configured");
    return result(STATUS.INFO, output, "Source: current-config");
  },

  "1.7.1": (ctx) => {
    if (has(ctx, "show backup")) return null;
    if (!configOnly(ctx)) return null;
    const text = ctx.profile.facts.backupText;
    if (!text) return result(STATUS.WARN, "No backup schedule in current-config", "Scheduled backup not configured");
    return result(STATUS.INFO, text, "Source: current-config");
  },

  "1.8.1": (ctx) => {
    const text = body(ctx, "show ssl server-certificate detail");
    if (!text) return null;
    const certs = parseCertificates(text);
    const leaf = certs[0];
    if (!leaf) return result(STATUS.FAIL, text.split("\n").slice(0, 5).join("\n"), "No server certificate configured");
    const reference = referenceDate(ctx);
    const san = leaf.san;
    const sanDns = san.filter((item) => /^DNS:/i.test(item)).map((item) => item.replace(/^DNS:/i, "").toLowerCase());
    const sanIps = san.filter((item) => /^IP Address:/i.test(item)).map((item) => item.replace(/^IP Address:/i, "").trim());
    const expected = ctx.profiles.filter((profile) => profile.role !== "Monitor" || profile === ctx.profile);
    const coverage = [];
    let missing = 0;
    for (const profile of expected) {
      const host = profile.hostname.toLowerCase();
      const hostOk = sanDns.some((name) => name === host || name.startsWith(`${host}.`));
      const ipOk = profile.managementIps.length === 0 || profile.managementIps.some((ip) => sanIps.includes(ip));
      if (!hostOk || !ipOk) missing += 1;
      coverage.push(`  ${profile.hostname.padEnd(24)} hostname ${hostOk ? "in SAN" : "NOT in SAN"}${profile.managementIps.length ? `, IP ${ipOk ? "in SAN" : "NOT in SAN"}` : ""}`);
    }
    const output = [
      describeCertificate(leaf, reference),
      "",
      `SAN (${san.length}):`,
      ...(san.length ? san.map((item) => `  ${item}`) : ["  none"]),
      "",
      "Coverage of uploaded brokers:",
      ...coverage,
      ...(certs.length > 1 ? ["", `Chain: ${certs.slice(1).map((cert) => cert.subject.CN || cert.title).join(" -> ")}`] : []),
    ].join("\n");
    if (missing) return result(STATUS.WARN, output, `${missing} broker(s) not covered by CN/SAN`);
    return result(STATUS.PASS, output, `CN ${leaf.subject.CN || "?"}; all uploaded brokers covered by SAN`);
  },

  "1.8.2": (ctx) => {
    const text = body(ctx, "show ssl server-certificate detail");
    if (!text) return null;
    const certs = parseCertificates(text);
    if (!certs.length) return result(STATUS.FAIL, "", "No server certificate configured");
    const reference = referenceDate(ctx);
    const output = [
      `Reference date: ${formatDate(reference)}${ctx.profile.snapshot ? ` (diagnostics snapshot)` : " (today; snapshot time not found)"}`,
      "",
      ...certs.map((cert) => describeCertificate(cert, reference)),
    ].join("\n\n").replace(/\n\n\n/g, "\n\n");
    const verdict = certificateStatus(certs, reference);
    const leafDays = certs[0].notAfter ? daysBetween(reference, certs[0].notAfter) : null;
    return result(verdict.status, output, verdict.note || (leafDays !== null ? `Server certificate valid for ${leafDays} more days` : ""));
  },

  "1.8.3": (ctx) => certificateAuthorities(ctx, "show domain-certificate-authority ca-name * cert", "domain"),
  "1.8.4": (ctx) => certificateAuthorities(ctx, "show client-certificate-authority ca-name * cert", "client"),

  "1.9.1": (ctx) => replicationCheck(ctx, ["Replication Interface", "Replication Mate", "Plain Text", "Compressed", "SSL"]),
  "1.9.2": (ctx) => replicationCheck(ctx, ["ConfigSync", "Bridge", "Admin State", "State", "Authentication", "Pre-Shared Key", "Compressed"]),

  "1.10.1": (ctx) => {
    const text = body(ctx, "show system detail|show system");
    const memoryText = body(ctx, "show memory");
    if (!text && !memoryText) return null;
    const lines = blockBetween(text, /^System Resource\s+Available\s+Required/, /^\s*$/).map((line) => line.trimEnd());
    const problems = [];
    for (const line of lines) {
      const match = /^\s{2}(Cores|Host Virtual Memory|Memory Cgroup Limit|Shared Memory)\s+([\d.]+)\s+([\d.]+)/.exec(line);
      if (match && Number(match[2]) < Number(match[3])) problems.push(`${match[1]} ${match[2]} < required ${match[3]}`);
    }
    const memoryLines = kvLines(memoryText, ["Physical memory usage:", "Subscription memory usage:", "Subscriptions load factor:"]);
    const nabLine = memoryText.split("\n").find((line) => /^\d+\/\d+\s+\d+%/.test(line.trim()));
    const physical = percent(valueOf(memoryText, "Physical memory usage"));
    const nab = nabLine ? percent(nabLine) : null;
    const output = [...lines, "", ...memoryLines, ...(nabLine ? [`NAB buffer load factor: ${nab}%`] : [])].join("\n").trim();
    if (problems.length) return result(STATUS.FAIL, output, problems.join("; "));
    if ((physical !== null && physical >= USAGE_WARN_PERCENT) || (nab !== null && nab >= USAGE_WARN_PERCENT)) {
      return result(STATUS.WARN, output, `High utilisation: physical memory ${physical ?? "?"}%, NAB buffers ${nab ?? "?"}%`);
    }
    return result(lines.length ? STATUS.PASS : STATUS.INFO, output, lines.length ? "Available resources meet the container requirements" : "");
  },

  "1.10.3": (ctx) => {
    const text = body(ctx, "show storage-element * detail");
    if (!text) return null;
    const elements = parseStorageElements(text);
    return result(STATUS.INFO, storageSummary(elements), "Confirm device class (SSD block storage) on the host");
  },

  "1.11.1": (ctx) => {
    const alarmsText = body(ctx, "show debug ad-show-alarms");
    const healthText = body(ctx, "show system health");
    if (!alarmsText && !healthText) return null;
    const active = alarmsText.split("\n").filter((line) => /alarm\(ON\)/i.test(line)).map((line) => line.trim().split(/\s{2,}/)[0]);
    const healthRows = blockBetween(healthText, /^\s*Units\s+Min\s+Max/, /^\s*$/).map((line) => line.trimEnd());
    const events = healthRows.slice(2).map((line) => {
      const parts = line.trim().split(/\s+/);
      return { name: line.trim().replace(/\s{2,}.*$/, ""), events: Number(parts[parts.length - 1]) };
    }).filter((row) => Number.isFinite(row.events) && row.events > 0);
    const output = [
      `AD alarms active: ${active.length ? active.join(", ") : "none"}`,
      "",
      ...(healthRows.length ? [`System health (${valueOf(healthText, "Statistics since") || "since reload"}):`, ...healthRows] : []),
    ].join("\n").trim();
    if (active.length) return result(STATUS.WARN, output, `Active alarms: ${active.join(", ")}`);
    if (events.length) return result(STATUS.WARN, output, `Latency threshold events: ${events.map((row) => `${row.name} x${row.events}`).join(", ")}`);
    return result(STATUS.PASS, output, "No active alarms and no latency threshold events");
  },

  "1.11.2": (ctx) => {
    const rdpText = body(ctx, "show log rest rest-delivery-point errors wide");
    const systemLog = body(ctx, "show log system lines 100");
    if (!rdpText && !systemLog) return null;
    const rdpCount = countTableRows(rdpText);
    const reasons = new Map();
    for (const match of rdpText.matchAll(/^(\d{4}-\d{2}-\d{2}T[\d:+-]+)\s+(\S+)\s+(\S+)\s+(\S+)\s+\S+\s+(\S+)\s+(\d{3}\s+[A-Za-z ]+?)\s*$/gm)) {
      const key = `${match[2]}/${match[3]} -> ${match[5]}: ${match[6].trim()}`;
      reasons.set(key, (reasons.get(key) || 0) + 1);
    }
    const errorTypes = new Map();
    for (const match of rdpText.matchAll(/"type":"([a-z_]+)"/g)) errorTypes.set(match[1], (errorTypes.get(match[1]) || 0) + 1);
    const systemErrors = systemLog ? systemLog.split("\n").filter((line) => /\b(ERROR|CRITICAL|ALERT|EMERGENCY)\b/.test(line)) : [];
    const output = [
      `REST delivery point errors in log window: ${rdpCount}`,
      ...[...reasons.entries()].map(([key, count]) => `  ${count} x ${key}`),
      ...(errorTypes.size ? ["  Error types:", ...[...errorTypes.entries()].map(([key, count]) => `    ${key}: ${count}`)] : []),
      ...(systemLog ? ["", `System log lines with ERROR/CRITICAL: ${systemErrors.length}`, ...systemErrors.slice(0, 20).map((line) => `  ${line.trim()}`)] : ["", "show log system lines 100: not collected (add to the supplemental transcript)"]),
    ].join("\n");
    if (rdpCount > 0 || systemErrors.length) return result(STATUS.WARN, output, `${rdpCount} RDP error(s)${systemErrors.length ? `, ${systemErrors.length} system log error line(s)` : ""} in the captured window`);
    return result(systemLog ? STATUS.PASS : STATUS.INFO, output, systemLog ? "" : "No RDP errors; system log not collected");
  },

  "1.11.3": (ctx) => {
    const clientText = body(ctx, "show stats client detail");
    const spoolText = body(ctx, "show message-spool stats");
    if (!clientText && !spoolText) return null;
    const counters = [
      ["Total Ingress Discards", counterOf(clientText, "Total Ingress Discards")],
      ["Total Egress Discards", counterOf(clientText, "Total Egress Discards")],
      ["  Transmit Congestion", counterOf(clientText, "Transmit Congestion")],
      ["  Client Not Connected", counterOf(clientText, "Client Not Connected")],
      ["  TTL Exceeded", counterOf(clientText, "TTL Exceeded")],
      ["  Message Spool Egress Discards", counterOf(clientText, "Message Spool Egress Discards")],
      ["Spool: Messages Expired To Discard", counterOf(spoolText, "Messages Expired To Discard")],
      ["Spool: Messages Expired To DMQ", counterOf(spoolText, "Messages Expired To DMQ")],
      ["Spool: TTL Exceeded To Discard", counterOf(spoolText, "TTL Exceeded To Discard")],
      ["Spool: Max Redelivery Exceeded To Discard", counterOf(spoolText, "Max Redelivery Exceeded To Discard")],
      ["Spool: Max Redelivery Exceeded To DMQ", counterOf(spoolText, "Max Redelivery Exceeded To DMQ")],
      ["Spool: Spool Over Quota", counterOf(spoolText, "Spool Over Quota")],
      ["Spool: Queue/Topic-Endpoint Over Quota", counterOf(spoolText, "Queue/Topic-Endpoint Over Quota")],
    ].filter(([, value]) => value !== null);
    const nonZero = counters.filter(([name, value]) => value > 0 && !/^Total Egress Discards$/.test(name));
    const output = [
      `Counters since last reload (uptime ${ctx.profile.uptime || "?"}):`,
      ...counters.map(([name, value]) => `  ${name.padEnd(44)} ${value.toLocaleString("en-US")}`),
    ].join("\n");
    if (nonZero.length) return result(STATUS.WARN, output, `Non-zero: ${nonZero.map(([name, value]) => `${name.trim()} ${value.toLocaleString("en-US")}`).join("; ")}`);
    return result(STATUS.PASS, output, "No discards recorded");
  },

  "1.11.4": (ctx) => {
    const clientText = body(ctx, "show stats client detail");
    const aclConnect = body(ctx, "show log acl client-connect wide");
    const aclPublish = body(ctx, "show log acl publish-topic wide");
    const aclSubscribe = body(ctx, "show log acl subscribe-topic wide");
    const noMatch = body(ctx, "show log no-subscription-match wide");
    if (!clientText && !aclConnect && !aclPublish && !aclSubscribe && !noMatch) return null;
    const counters = [
      ["Denied Authorization Failed", counterOf(clientText, "Denied Authorization Failed")],
      ["Denied Duplicate Clients", counterOf(clientText, "Denied Duplicate Clients")],
      ["Denied Client Connect ACL", counterOf(clientText, "Denied Client Connect ACL")],
      ["Denied Subscribe Topic ACL", counterOf(clientText, "Denied Subscribe Topic ACL")],
      ["Publish Topic ACL (ingress discards)", counterOf(clientText, "Publish Topic ACL")],
      ["No Subscription Match (ingress discards)", counterOf(clientText, "No Subscription Match")],
    ].filter(([, value]) => value !== null);
    const logs = [
      ["ACL client-connect denials logged", aclConnect ? countTableRows(aclConnect) : null],
      ["ACL publish-topic denials logged", aclPublish ? countTableRows(aclPublish) : null],
      ["ACL subscribe-topic denials logged", aclSubscribe ? countTableRows(aclSubscribe) : null],
      ["No-subscription-match events logged", noMatch ? countTableRows(noMatch) : null],
    ].filter(([, value]) => value !== null);
    const nonZero = [...counters, ...logs].filter(([, value]) => value > 0);
    const output = [
      ...counters.map(([name, value]) => `${name.padEnd(44)} ${value.toLocaleString("en-US")}`),
      "",
      ...logs.map(([name, value]) => `${name.padEnd(44)} ${value}`),
    ].join("\n").trim();
    if (nonZero.length) return result(STATUS.WARN, output, `Non-zero: ${nonZero.map(([name, value]) => `${name} ${value.toLocaleString("en-US")}`).join("; ")}`);
    return result(STATUS.PASS, output, "No denials recorded");
  },

  "2.1.1": (ctx) => {
    const text = body(ctx, "show message-vpn *");
    if (!text) return null;
    const rows = messageVpnRows(text);
    const output = blockBetween(text, /^Message-VPN\s+Local/, /^\s*$/).map((line) => line.trimEnd()).join("\n");
    const defaultVpn = rows.find((row) => row.name === "default");
    const custom = rows.filter((row) => !row.name.startsWith("#") && row.name !== "default");
    const down = custom.filter((row) => row.status !== "Up");
    const note = [`Custom VPNs: ${custom.map((row) => `${row.name} (${row.status}, ${row.connections} conns)`).join(", ") || "none"}`];
    if (defaultVpn && defaultVpn.status !== "Down") return result(STATUS.FAIL, output, `default VPN is ${defaultVpn.status}. ${note.join(" ")}`);
    if (down.length && ctx.profile.role !== "Monitor") return result(STATUS.WARN, output, `VPN not Up: ${down.map((row) => `${row.name} (${row.status})`).join(", ")}`);
    return result(STATUS.PASS, output, note.join(" "));
  },

  "2.1.2": (ctx) => {
    if (has(ctx, "show message-vpn * detail")) return null;
    if (!configOnly(ctx)) return null;
    const vpns = [...ctx.profile.facts.vpns.values()].filter((vpn) => !vpn.name.startsWith("#"));
    if (!vpns.length) return result(STATUS.INFO, "No message-vpn blocks in current-config");
    return result(STATUS.INFO, vpns.map(vpnAuthSummary).join("\n\n"), "Source: current-config");
  },

  "2.1.3": (ctx) => {
    if (has(ctx, "show message-vpn * detail")) return null;
    if (!configOnly(ctx)) return null;
    const vpns = [...ctx.profile.facts.vpns.values()].filter((vpn) => !vpn.name.startsWith("#"));
    if (!vpns.length) return result(STATUS.INFO, "No message-vpn blocks in current-config");
    const output = vpns.map((vpn) => [
      `${vpn.name}:`,
      `  Max Connections: ${vpn.maxConnections || "(default)"}`,
      `  Max Subscriptions: ${vpn.maxSubscriptions || "(default)"}`,
      `  Max Spool Usage (MB): ${vpn.maxSpoolUsage || "(default)"}`,
      `  Max Endpoints: ${vpn.maxEndpoints || "(default)"}`,
      `  Max Ingress Flows: ${vpn.maxIngressFlows || "(default)"}`,
      `  Max Egress Flows: ${vpn.maxEgressFlows || "(default)"}`,
    ].join("\n")).join("\n\n");
    return result(STATUS.INFO, output, "Source: current-config; '(default)' means the export did not override the value");
  },

  "2.1.4": (ctx) => {
    if (has(ctx, "show message-vpn * service")) return null;
    const serviceText = body(ctx, "show service");
    if (serviceText) {
      const rows = parseServiceTable(serviceText).filter((row) => row.vpn && !row.vpn.startsWith("#"));
      const up = rows.filter((row) => row.oper === "U");
      const plain = up.filter((row) => row.ssl === "N");
      const output = rows.length ? rows.map((row) => row.line).join("\n") : "No VPN-scoped service rows in show service";
      if (plain.length) return result(STATUS.WARN, output, `Plaintext VPN services Up: ${plain.map(describeService).join(", ")}`);
      return result(up.length ? STATUS.PASS : STATUS.INFO, output, up.length ? "Only TLS VPN services are Up" : "SMF is broker-wide; see 1.1.7");
    }
    if (!configOnly(ctx)) return null;
    const vpns = [...ctx.profile.facts.vpns.values()].filter((vpn) => vpn.serviceText);
    return result(STATUS.INFO, vpns.length ? vpns.map((vpn) => `${vpn.name}:\n${vpn.serviceText}`).join("\n\n") : "No VPN service blocks in current-config", "Source: current-config");
  },

  "2.1.5": (ctx) => configList(ctx, "show client-profile * detail", "clientProfiles", "client profiles"),
  "2.1.6": (ctx) => configList(ctx, "show acl-profile * detail", "aclProfiles", "ACL profiles"),
  "4.2.1": (ctx) => configList(ctx, "show acl-profile * detail", "aclProfiles", "ACL profiles"),
  "4.2.2": (ctx) => configList(ctx, "show acl-profile * detail", "aclProfiles", "ACL profiles"),
  "4.2.3": (ctx) => configList(ctx, "show acl-profile * detail", "aclProfiles", "ACL profiles"),
  "4.2.4": (ctx) => configList(ctx, "show client-profile * detail", "clientProfiles", "client profiles"),

  "2.1.7": (ctx) => {
    if (has(ctx, "show client-username * detail")) return null;
    if (!configOnly(ctx)) return null;
    const users = [...ctx.profile.facts.clientUsernames.values()];
    if (!users.length) return result(STATUS.INFO, "No client-username blocks in current-config");
    const output = users.map((user) => `${user.name.padEnd(28)} vpn ${user.vpn.padEnd(16)} client-profile ${user.clientProfile || "default"}; acl-profile ${user.aclProfile || "default"}; ${user.state || "state not in export"}`).join("\n");
    const enabledDefault = users.filter((user) => user.name === "default" && user.state === "Enabled");
    if (enabledDefault.length) return result(STATUS.WARN, output, `default client-username enabled in: ${enabledDefault.map((user) => user.vpn).join(", ")}`);
    return result(STATUS.INFO, output, "Source: current-config");
  },

  "2.1.8": (ctx) => {
    if (has(ctx, "show queue * detail")) return null;
    if (!configOnly(ctx)) return null;
    const queues = [...ctx.profile.facts.queues.values()];
    if (!queues.length) return result(STATUS.INFO, "No queue blocks in current-config");
    return result(STATUS.INFO, queues.map((queue) => queue.text).join("\n\n"), `Source: current-config (${queues.length} queue(s))`);
  },

  "2.1.9": (ctx) => {
    if (has(ctx, "show queue * subscriptions")) return null;
    if (!configOnly(ctx)) return null;
    const queues = [...ctx.profile.facts.queues.values()];
    if (!queues.length) return result(STATUS.INFO, "No queue blocks in current-config");
    const output = queues.map((queue) => `${queue.name} (${queue.vpn}):\n${queue.subscriptions.length ? queue.subscriptions.map((topic) => `  ${topic}`).join("\n") : "  (no topic subscriptions)"}`).join("\n\n");
    return result(STATUS.INFO, output, "Source: current-config");
  },

  "2.2.1": (ctx) => {
    const text = body(ctx, "show bridge *");
    if (!text) return null;
    const rows = bridgeRows(text);
    const table = blockBetween(text, /^\s+Local\s+Remote\s+Remote/, /^\s*$/).map((line) => line.trimEnd());
    const detail = body(ctx, "show bridge * detail");
    const configured = rows.filter((row) => row.admin !== "-");
    const output = [...table, ...(detail ? ["", "--- show bridge * detail", detail] : [])].join("\n");
    if (!rows.length) return result(STATUS.NA, text.split("\n").slice(0, 4).join("\n"), "No VPN bridges configured");
    const down = configured.filter((row) => row.admin === "U" && ((row.inbound === "D") || (row.outbound === "D") || row.queue === "D"));
    const adminDown = configured.filter((row) => row.admin === "D");
    if (down.length) return result(STATUS.FAIL, output, `Bridge operationally down: ${down.map((row) => row.name).join(", ")}`);
    if (adminDown.length) return result(STATUS.WARN, output, `Bridge administratively shut down: ${adminDown.map((row) => row.name).join(", ")}`);
    return result(STATUS.PASS, output, `${rows.length} bridge row(s), all configured bridges Up`);
  },

  "2.2.2": (ctx) => bridgeConfig(ctx, "show bridge * detail"),
  "2.2.3": (ctx) => bridgeConfig(ctx, "show bridge * detail"),
  "2.2.4": (ctx) => bridgeConfig(ctx, "show bridge * detail"),
  "4.4.1": (ctx) => {
    const text = body(ctx, "show bridge *");
    const rows = text ? bridgeRows(text) : [];
    if (text && !rows.length) return result(STATUS.NA, "", "No VPN bridges configured");
    const detail = body(ctx, "show bridge * detail");
    if (detail) {
      const sslLines = detail.split("\n").filter((line) => /SSL|TLS/i.test(line)).map((line) => line.trim());
      return result(STATUS.INFO, sslLines.join("\n") || detail, "Review SSL flags per remote message-vpn");
    }
    if (configOnly(ctx)) {
      const bridges = [...ctx.profile.facts.bridges.values()];
      if (!bridges.length) return result(rows.length ? STATUS.INFO : STATUS.NA, rows.length ? "Bridges exist on the broker but not in the config export" : "", rows.length ? "Source: current-config has no bridge blocks; collect show bridge * detail" : "No VPN bridges configured");
      const output = bridges.map((bridge) => `${bridge.name} (${bridge.vpn}):\n${bridge.text.split("\n").filter((line) => /remote|ssl|tls|connect-via/i.test(line)).join("\n") || bridge.text}`).join("\n\n");
      const plain = bridges.filter((bridge) => /remote message-vpn/i.test(bridge.text) && !/\bssl\b/i.test(bridge.text));
      if (plain.length) return result(STATUS.WARN, output, `Remote VPN without ssl keyword: ${plain.map((bridge) => bridge.name).join(", ")}`);
      return result(STATUS.INFO, output, "Source: current-config");
    }
    return null;
  },

  "2.3.1": (ctx) => replicationVpns(ctx),
  "2.3.2": (ctx) => replicationVpns(ctx),
  "2.3.3": (ctx) => replicationVpns(ctx),
  "2.3.4": (ctx) => replicationVpns(ctx),

  "4.1.1": (ctx) => {
    const text = body(ctx, "show service");
    if (!text) return null;
    const rows = parseServiceTable(text);
    const plain = rows.filter((row) => row.ssl === "N" && row.oper === "U" && (MESSAGING_SERVICES.has(row.service) || MANAGEMENT_SERVICES.has(row.service)));
    const secure = rows.filter((row) => row.ssl === "Y" && row.oper === "U");
    const output = [
      "Plaintext services operationally Up:",
      ...(plain.length ? plain.map((row) => `  ${row.line}`) : ["  none"]),
      "",
      "TLS services operationally Up:",
      ...(secure.length ? secure.map((row) => `  ${row.line}`) : ["  none"]),
    ].join("\n");
    if (plain.length) return result(STATUS.WARN, output, `Disable or justify: ${plain.map(describeService).join(", ")}`);
    return result(STATUS.PASS, output, "No plaintext client-facing service is Up");
  },

  "4.1.2": (ctx) => {
    const text = body(ctx, "show message-vpn *");
    if (text) {
      const row = messageVpnRows(text).find((item) => item.name === "default");
      if (!row) return result(STATUS.INFO, "default VPN not listed", "");
      return result(row.status === "Down" ? STATUS.PASS : STATUS.FAIL, row.line, row.status === "Down" ? "default VPN is shut down" : `default VPN is ${row.status}`);
    }
    if (!configOnly(ctx)) return null;
    const vpn = ctx.profile.facts.vpns.get("default");
    if (!vpn || !vpn.state) return result(STATUS.INFO, "default VPN state not in current-config");
    return result(vpn.state === "Disabled" ? STATUS.PASS : STATUS.FAIL, `message-vpn "default": ${vpn.state}`, "Source: current-config");
  },

  "4.1.3": (ctx) => {
    const text = body(ctx, "show client-username default message-vpn *|show client-username * detail");
    if (text) {
      const blocks = text.split(/\n(?=Client Username\s*:)/).filter((block) => /Client Username\s*:\s*default/.test(block));
      const enabled = blocks.filter((block) => /^\s*Enabled\s*:\s*Yes/im.test(block));
      const output = blocks.map((block) => kvLines(block, ["Client Username", "Message VPN", "Enabled"]).join("\n")).join("\n\n") || text;
      if (enabled.length) return result(STATUS.FAIL, output, `${enabled.length} default client-username(s) enabled`);
      return result(blocks.length ? STATUS.PASS : STATUS.INFO, output, blocks.length ? "All default client-usernames disabled" : "");
    }
    if (!configOnly(ctx)) return null;
    const defaults = [...ctx.profile.facts.clientUsernames.values()].filter((user) => user.name === "default");
    if (!defaults.length) return result(STATUS.INFO, "No default client-username blocks in current-config", "Export may omit default objects; verify with show client-username default message-vpn *");
    const output = defaults.map((user) => `default @ ${user.vpn}: ${user.state || "state not in export"}`).join("\n");
    const enabled = defaults.filter((user) => user.state === "Enabled");
    if (enabled.length) return result(STATUS.FAIL, output, `Enabled in: ${enabled.map((user) => user.vpn).join(", ")}`);
    if (defaults.every((user) => user.state === "Disabled")) return result(STATUS.PASS, output, "Source: current-config");
    return result(STATUS.INFO, output, "Source: current-config");
  },

  "4.1.4": (ctx) => {
    if (has(ctx, "show client-username *|show client-username * detail")) return null;
    if (!configOnly(ctx)) return null;
    const users = [...ctx.profile.facts.clientUsernames.values()].filter((user) => user.name !== "default");
    return result(STATUS.INFO, users.length ? users.map((user) => `${user.name} @ ${user.vpn}`).join("\n") : "No application client-usernames in current-config", "Compare against the application inventory");
  },

  "4.1.5": (ctx) => {
    const caText = body(ctx, "show client-certificate-authority ca-name * cert");
    const cas = caText ? parseCertificates(caText).filter((cert) => cert.title) : [];
    const vpnText = body(ctx, "show message-vpn * detail");
    const parts = [];
    if (vpnText) parts.push(vpnText.split("\n").filter((line) => /^(Message VPN:|Client Certificate Authentication)/.test(line.trim())).join("\n"));
    else if (configOnly(ctx)) {
      const vpns = [...ctx.profile.facts.vpns.values()].filter((vpn) => !vpn.name.startsWith("#"));
      parts.push(vpns.map((vpn) => `${vpn.name}: Client Certificate Authentication ${vpn.clientCertificateState || "Disabled (default)"}`).join("\n") || "No message-vpn blocks in current-config");
    }
    if (caText) parts.push(`Client certificate authorities: ${cas.length ? cas.map((cert) => cert.title).join(", ") : "none"}`);
    if (!parts.length) return null;
    return result(STATUS.INFO, parts.join("\n\n"), "Passwordless authentication is design dependent");
  },

  "4.3.2": (ctx) => privilegedUsers(ctx, /^(admin|read-write|mesh-manager)$/i),
  "4.3.3": (ctx) => privilegedUsers(ctx, /^(admin|read-write)$/i),

  "4.4.2": (ctx) => {
    const serviceText = body(ctx, "show service");
    const webText = body(ctx, "show web-manager");
    if (!serviceText && !webText) return null;
    const rows = parseServiceTable(serviceText).filter((row) => row.service === "SEMP");
    const secure = rows.find((row) => row.ssl === "Y" && row.oper === "U");
    const plain = rows.filter((row) => row.ssl === "N" && row.oper === "U");
    const redirectConfig = valueOf(webText, "Redirect Manager Config Status");
    const redirectOper = valueOf(webText, "Redirect Manager Oper Status");
    const output = [...rows.map((row) => row.line), "", ...kvLines(webText, ["Allow Unencrypted Wizards", "Redirect Manager Config Status", "Redirect Manager Oper Status"])].join("\n").trim();
    if (!secure) return result(STATUS.FAIL, output, "Secure SEMP is not Up");
    if (plain.length && !/^Enabled/i.test(redirectConfig)) return result(STATUS.WARN, output, "Plaintext SEMP is Up and HTTPS redirect is not enabled");
    if (plain.length) return result(STATUS.WARN, output, `Plaintext SEMP is Up (redirect ${redirectOper || "?"}); disable 8080 if not required`);
    return result(STATUS.PASS, output);
  },

  "4.4.3": (ctx) => {
    const text = body(ctx, "show stats client detail");
    if (!text) return null;
    const total = counterOf(text, "Total Clients Connected");
    const ssl = counterOf(text, "SSL");
    const nonSsl = counterOf(text, "Non-SSL");
    const configSyncText = body(ctx, "show message-vpn #config-sync detail");
    const internal = configSyncText ? counterFromValue(valueOf(configSyncText, "Active Incoming Connections")) : 0;
    const output = kvLines(text, ["Total Clients:", "Total Clients Connected:", "SSL:", "Non-SSL:", "Service SMF:", "Service Web Transport:", "Service REST:", "Service MQTT:", "Service AMQP:"]).join("\n");
    if (nonSsl === null) return result(STATUS.INFO, output);
    const external = Math.max(0, nonSsl - internal);
    const note = `${ssl ?? "?"} TLS, ${nonSsl} non-TLS of ${total ?? "?"} connected` + (internal ? ` (${internal} non-TLS are internal #config-sync sessions)` : "");
    if (external > 0) return result(STATUS.WARN, output, `${external} client connection(s) without TLS. ${note}`);
    return result(STATUS.PASS, output, note);
  },

  "4.4.4": (ctx) => {
    const parts = [];
    let status = STATUS.INFO;
    let note = "";
    const vpnText = body(ctx, "show message-vpn * detail") || body(ctx, "show message-vpn #config-sync detail");
    if (vpnText) {
      const lines = vpnText.split("\n").filter((line) => /^(Message VPN:|SSL to plain text downgrade allowed)/.test(line.trim())).map((line) => line.trim());
      parts.push(lines.join("\n"));
      if (lines.some((line) => /downgrade allowed:\s*Yes/i.test(line))) {
        status = STATUS.FAIL;
        note = "A message VPN allows SSL downgrade to plaintext";
      } else if (lines.some((line) => /downgrade allowed:\s*No/i.test(line)) && !body(ctx, "show message-vpn * detail")) {
        note = "Only the internal #config-sync VPN is in gather-diagnostics; collect show message-vpn * detail for the others";
      }
    }
    const profileText = body(ctx, "show client-profile * detail");
    if (profileText) {
      const lines = profileText.split("\n").filter((line) => /^(Client Profile|Profile Name|Message VPN|\s*Allow Downgrade to Plain Text)/i.test(line.trim())).map((line) => line.trim());
      parts.push(lines.join("\n"));
      if (lines.some((line) => /Allow Downgrade to Plain Text\s*:\s*Yes/i.test(line))) {
        status = STATUS.FAIL;
        note = "A client profile allows SSL downgrade to plaintext";
      }
    }
    if (configOnly(ctx)) {
      const vpns = [...ctx.profile.facts.vpns.values()].filter((vpn) => vpn.sslDowngrade);
      const profiles = [...ctx.profile.facts.clientProfiles.values()].map((profile) => ({ profile, lines: profile.text.split("\n").filter((line) => /allow-downgrade-to-plain-text/.test(line)) })).filter((item) => item.lines.length);
      if (vpns.length || profiles.length) {
        parts.push([
          ...vpns.map((vpn) => `message-vpn ${vpn.name}: ssl downgrade ${vpn.sslDowngrade}`),
          ...profiles.map((item) => `client-profile ${item.profile.name} (${item.profile.vpn}): ${item.lines.map((line) => line.trim()).join("; ")}`),
        ].join("\n"));
        if (vpns.some((vpn) => vpn.sslDowngrade === "Enabled") || profiles.some((item) => item.lines.some((line) => !/^\s*no\s/.test(line)))) {
          status = STATUS.FAIL;
          note = "Downgrade to plaintext is enabled in current-config";
        } else if (status === STATUS.INFO) {
          status = STATUS.PASS;
          note = "Downgrade explicitly disabled in current-config";
        }
      }
    }
    if (!parts.length) return null;
    if (status === STATUS.INFO && parts.some((part) => /downgrade allowed:\s*No/i.test(part)) && !note) {
      status = STATUS.PASS;
      note = "Downgrade to plaintext is not allowed";
    }
    return result(status, parts.join("\n\n"), note);
  },

  "4.4.5": (ctx) => {
    if (has(ctx, "show ssl allow-tls-version|show ssl")) return null;
    if (!configOnly(ctx)) return null;
    const lines = ctx.profile.facts.sslText.split("\n").filter((line) => /tls-version/i.test(line)).map((line) => line.trim());
    if (!lines.length) return result(STATUS.INFO, "No TLS version override in current-config (broker default: TLS 1.2 only)", "Confirm with show ssl allow-tls-version");
    const legacy = lines.filter((line) => /^allow-tls-version-1\.[01]/.test(line));
    if (legacy.length) return result(STATUS.FAIL, lines.join("\n"), `Legacy TLS enabled: ${legacy.join(", ")}`);
    return result(STATUS.PASS, lines.join("\n"), "Source: current-config");
  },

  "4.4.6": (ctx) => {
    const text = body(ctx, "show ssl server-certificate detail");
    if (!text) return null;
    const certs = parseCertificates(text);
    if (!certs.length) return result(STATUS.FAIL, "", "No server certificate configured");
    const output = certs.map((cert) => `${cert.title || cert.subject.CN}: ${cert.signatureAlgorithm || "?"}${cert.keyBits ? ` (${cert.keyBits}-bit key)` : ""}`).join("\n");
    const weak = certs.filter((cert) => /sha1|md5|md2/i.test(cert.signatureAlgorithm));
    if (weak.length) return result(STATUS.FAIL, output, `Weak signature algorithm: ${weak.map((cert) => cert.subject.CN || cert.title).join(", ")}`);
    if (certs.every((cert) => /sha(256|384|512)/i.test(cert.signatureAlgorithm))) return result(STATUS.PASS, output, "SHA-2 family throughout the chain");
    return result(STATUS.INFO, output);
  },

  "4.4.7": (ctx) => {
    if (has(ctx, "show ssl cipher-suite-list management") || has(ctx, "show ssl cipher-suite-list msg-backbone")) return null;
    if (!configOnly(ctx)) return null;
    const lines = ctx.profile.facts.sslText.split("\n").filter((line) => /cipher-suite/i.test(line)).map((line) => line.trim());
    return result(STATUS.INFO, lines.length ? lines.join("\n") : "No cipher-suite override in current-config (broker defaults apply)", "Source: current-config");
  },

  "4.5.2": (ctx) => {
    const text = body(ctx, "show service");
    if (!text) return null;
    const up = parseServiceTable(text).filter((row) => row.oper === "U");
    const output = ["Operationally Up services (exposed ports):", ...up.map((row) => `  ${row.line}`)].join("\n");
    return result(STATUS.INFO, output, "Compare with the container/firewall port mappings");
  },

  "4.6.2": (ctx) => {
    if (has(ctx, "show logging command")) return null;
    if (!configOnly(ctx)) return null;
    const text = ctx.profile.facts.loggingText;
    return result(STATUS.INFO, text || "No logging overrides in current-config (command logging enabled by default)", "Source: current-config");
  },
};

// ---- Shared analyzer bodies ----------------------------------------------------------------

function defaultAccess(ctx) {
  const text = body(ctx, "show authentication access-level default|show authentication access-level detail");
  if (text) {
    const match = /Global Acces?s Level\s*:\s*(\S+)/i.exec(text);
    const level = match ? match[1] : "";
    const output = blockBetween(text, /Default:/, /^\S/).map((line) => line.trimEnd()).join("\n") || text;
    if (!level) return result(STATUS.INFO, output);
    return result(/^none$/i.test(level) ? STATUS.PASS : STATUS.FAIL, output, `Default global access level: ${level}`);
  }
  if (!configOnly(ctx)) return null;
  const level = ctx.profile.facts.defaultGlobalAccess;
  if (!level) return result(STATUS.INFO, "No default global-access-level override in current-config (broker default is none)", "Confirm with show authentication access-level default");
  return result(/^none$/i.test(level) ? STATUS.PASS : STATUS.FAIL, `Default global-access-level: ${level}`, "Source: current-config");
}

function configList(ctx, command, factKey, label) {
  if (has(ctx, command)) return null;
  if (!configOnly(ctx)) return null;
  const items = [...ctx.profile.facts[factKey].values()];
  if (!items.length) return result(STATUS.INFO, `No ${label} in current-config`);
  return result(STATUS.INFO, items.map((item) => item.text).join("\n\n"), `Source: current-config (${items.length} ${label})`);
}

function bridgeConfig(ctx, command) {
  if (has(ctx, command)) return null;
  const table = body(ctx, "show bridge *");
  if (table && !bridgeRows(table).length) return result(STATUS.NA, "", "No VPN bridges configured");
  if (!configOnly(ctx)) return null;
  const bridges = [...ctx.profile.facts.bridges.values()];
  const profiles = [...ctx.profile.facts.clientProfiles.values()].filter((profile) => /bridge/i.test(profile.name));
  if (!bridges.length && !table) return result(STATUS.INFO, "No bridge blocks in current-config");
  const output = [
    ...bridges.map((bridge) => bridge.text),
    ...profiles.map((profile) => `--- client-profile used by bridges\n${profile.text}`),
  ].join("\n\n");
  return result(STATUS.INFO, output || "Bridges exist on the broker but not in the config export", "Source: current-config");
}

function certificateAuthorities(ctx, command, kind) {
  const section = findSection(ctx.profile.sections, command);
  if (!section) return null;
  const text = section.body;
  const certs = parseCertificates(text);
  if (!certs.length) {
    return result(STATUS.INFO, `No ${kind} certificate authorities configured`, kind === "client" ? "Required only when client-certificate authentication is used" : "Required only for TLS connections to external systems (LDAP, remote brokers)");
  }
  const reference = referenceDate(ctx);
  const output = certs.map((cert) => describeCertificate(cert, reference)).join("\n\n");
  const verdict = certificateStatus(certs, reference);
  return result(verdict.status, output, verdict.note || `${certs.length} CA certificate(s), all valid`);
}

function replicationCheck(ctx, labels) {
  const vpnText = body(ctx, "show message-vpn * replication");
  const statsText = body(ctx, "show replication stats|show replication");
  if (!vpnText && !statsText) return null;
  const rows = vpnText ? replicationRows(vpnText) : [];
  const active = rows.filter((row) => row.admin === "U");
  const output = [
    ...(rows.length ? ["Message VPN replication admin state:", ...rows.map((row) => `  ${row.line}`)] : []),
    ...(statsText ? ["", ...kvLines(statsText, labels)] : []),
  ].join("\n").trim();
  if (rows.length && !active.length) return result(STATUS.NA, output, "Replication is not enabled on any message VPN");
  return result(STATUS.INFO, output, active.length ? `Replication enabled on: ${active.map((row) => row.name).join(", ")}` : "");
}

function replicationVpns(ctx) {
  const vpnText = body(ctx, "show message-vpn * replication");
  if (!vpnText) {
    if (configOnly(ctx)) {
      const vpns = [...ctx.profile.facts.vpns.values()].filter((vpn) => vpn.replicationText);
      if (!vpns.length) return result(STATUS.NA, "", "No replication blocks in current-config");
      return result(STATUS.INFO, vpns.map((vpn) => `${vpn.name}:\n${vpn.replicationText}`).join("\n\n"), "Source: current-config");
    }
    return null;
  }
  const rows = replicationRows(vpnText);
  const active = rows.filter((row) => row.admin === "U");
  if (!active.length) return result(STATUS.NA, rows.map((row) => row.line).join("\n"), "Replication is not enabled on any message VPN");
  const detail = body(ctx, "show bridge #MSGVPN_REPLICATION_BRIDGE message-vpn * detail");
  return result(STATUS.INFO, [rows.map((row) => row.line).join("\n"), detail].filter(Boolean).join("\n\n"), `Replication enabled on: ${active.map((row) => row.name).join(", ")}`);
}

function privilegedUsers(ctx, levelRe) {
  const sectionsFound = ctx.check.commands.some((entry) => has(ctx, entry));
  if (sectionsFound) return null;
  if (!configOnly(ctx)) return null;
  const { usernames, ldapGroups, oauthProfiles } = ctx.profile.facts;
  const privileged = usernames.filter((user) => levelRe.test(user.level));
  const output = [
    `Internal users with ${levelRe.source.replace(/[\^$()]/g, "").replace(/\|/g, "/")}:`,
    ...(privileged.length ? privileged.map((user) => `  ${user.name} (${user.level})`) : ["  none in current-config"]),
    ...(ldapGroups.length ? ["", "LDAP groups:", ...ldapGroups.map((group) => `  ${group.split("\n")[0]}`)] : []),
    ...(oauthProfiles.size ? ["", `OAuth profiles: ${[...oauthProfiles.keys()].join(", ")}`] : []),
  ].join("\n");
  return result(STATUS.INFO, output, "Source: current-config. Confirm each privileged identity is authorised");
}

function counterFromValue(value) {
  const match = /^\s*(\d+)/.exec(String(value));
  return match ? Number(match[1]) : 0;
}

// ---- Entry point ----------------------------------------------------------------------------

/**
 * Analyzes one check for one broker.
 * @param check   row from CHECKS
 * @param ctx     { profile, profiles, targets, now }
 */
export function analyzeCheck(check, ctx) {
  const context = { ...ctx, check };
  const analyzer = ANALYZERS[check.ref];
  let outcome = null;
  try {
    outcome = analyzer ? analyzer(context) : null;
  } catch (error) {
    outcome = result(STATUS.INFO, joinSections(context, check.commands), `Analyzer error: ${error.message}`);
  }
  if (!outcome) outcome = defaultOutcome(check, context);

  const usedCommands = check.commands.flatMap(commandAlternatives).filter((command) => findSection(context.profile.sections, command));
  const sources = new Set(usedCommands.map((command) => context.profile.sectionSources.get(command.toLowerCase().replace(/\s+/g, " ")) || "diagnostics"));
  if (/Source: current-config/.test(outcome.note)) sources.add("config");
  return { ...outcome, source: [...sources].join("+"), commands: usedCommands };
}

function defaultOutcome(check, ctx) {
  if (!check.commands.length) return result(STATUS.MANUAL, "", "Manual verification; no CLI evidence for this item");
  const found = check.commands.filter((entry) => findSection(ctx.profile.sections, entry));
  if (found.length) {
    const output = joinSections(ctx, check.commands);
    const missing = check.commands.filter((entry) => !findSection(ctx.profile.sections, entry)).map((entry) => commandAlternatives(entry)[0]);
    return result(STATUS.INFO, output, missing.length ? `Not collected: ${missing.join(", ")}` : "");
  }
  const preferred = check.commands.map((entry) => commandAlternatives(entry)[0]);
  const inGather = preferred.filter((command) => GATHER_DIAGNOSTICS_COMMANDS.has(command.toLowerCase()));
  const supplemental = preferred.filter((command) => !GATHER_DIAGNOSTICS_COMMANDS.has(command.toLowerCase()));
  const hints = [];
  if (inGather.length) hints.push(`Expected in cli-diagnostics.txt: ${inGather.join(", ")}`);
  if (supplemental.length) hints.push(`Collect via supplemental transcript: ${supplemental.join(", ")}`);
  if (!ctx.profile.facts && !ctx.profile.files.diagnostics) hints.push("No diagnostics uploaded for this broker");
  return result(STATUS.MISSING, "", hints.join(". "));
}

export function supplementalCommandsFor(checks) {
  const commands = new Set();
  for (const check of checks) {
    for (const entry of check.commands || []) {
      const preferred = commandAlternatives(entry)[0];
      if (preferred && !GATHER_DIAGNOSTICS_COMMANDS.has(preferred.toLowerCase())) commands.add(preferred);
    }
  }
  return [...commands].sort();
}
