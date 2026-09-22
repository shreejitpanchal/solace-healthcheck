// Broker model: classifies uploaded files, detects hostnames and builds a profile
// (role, version, snapshot time, sections, config facts) for each broker.

import { parseSections, mergeSections, findSection, valueOf, parseCliDate, parseFixedTable } from "./sections.js";
import { parseConfig, extractConfigFacts } from "./config-parser.js";

export const FILE_KINDS = {
  diagnostics: { label: "cli-diagnostics.txt", short: "Diagnostics" },
  config: { label: "current-config export", short: "Config" },
  supplemental: { label: "supplemental show-command transcript", short: "Supplemental" },
  other: { label: "unrecognised file", short: "Other" },
};

export const ROLE_ORDER = { Primary: 0, Backup: 1, Monitor: 2, Standalone: 3, Unknown: 4 };

const CONFIG_HINT = /^(?:!\s*Router:|create message-vpn\s|message-vpn\s+"|create client-username\s|client-username\s+"|ldap-profile\s+"|client-profile\s+"|acl-profile\s+"|create username\s|hostname\s+"?[\w.-]+"?\s*$)/m;
const PROMPT_HINT = /^[A-Za-z0-9][\w.-]*(?:\([\w/ -]+\))?[>#]\s*show\s/m;

/** Decides what an uploaded file is by looking at its content, not its name. */
export function classifyFile(name, text) {
  const body = String(text ?? "");
  const headerCount = (body.match(/^# CLI command:/gm) || []).length;
  if (headerCount > 0) {
    const hasCore = /^# CLI command:\s*show hostname\s*$/m.test(body) && /^# CLI command:\s*show version\s*$/m.test(body);
    return hasCore && headerCount >= 20 ? "diagnostics" : "supplemental";
  }
  if (PROMPT_HINT.test(body)) return "supplemental";
  if (CONFIG_HINT.test(body)) return "config";
  return "other";
}

/** Hostname from the folder name gather-diagnostics creates, e.g. gather-diagnostics_2d_broker1_2026-08-26T16.09.57 */
export function hostnameFromPath(path) {
  const match = /gather-diagnostics_\d+[dhm]_([A-Za-z0-9][\w.-]*?)(?:_\d{4}-\d{2}-\d{2}T[\d.]+)?(?:[\\/]|$)/.exec(String(path ?? ""));
  return match ? match[1] : "";
}

export function detectHostname(kind, text, path = "") {
  const body = String(text ?? "");
  if (kind === "diagnostics" || kind === "supplemental") {
    const { sections, host } = parseSections(body);
    const hostnameSection = findSection(sections, "show hostname");
    const declared = hostnameSection ? valueOf(hostnameSection.body, "Hostname") : "";
    if (declared) return declared;
    if (host) return host;
  }
  if (kind === "config") {
    const parsed = parseConfig(body);
    if (parsed.routerName) return parsed.routerName;
  }
  return hostnameFromPath(path);
}

export function createBroker(hostname) {
  return { hostname, files: { diagnostics: null, config: null, supplemental: [] } };
}

/** Attaches a classified file to a broker. Supplemental transcripts accumulate; the others replace. */
export function attachFile(broker, file) {
  if (file.kind === "supplemental") {
    broker.files.supplemental = broker.files.supplemental.filter((item) => item.name !== file.name);
    broker.files.supplemental.push(file);
  } else if (file.kind === "diagnostics" || file.kind === "config") {
    broker.files[file.kind] = file;
  }
  return broker;
}

export function detachFile(broker, kind, name) {
  if (kind === "supplemental") {
    broker.files.supplemental = broker.files.supplemental.filter((item) => item.name !== name);
  } else if (broker.files[kind] && (!name || broker.files[kind].name === name)) {
    broker.files[kind] = null;
  }
  return broker;
}

export function brokerHasFiles(broker) {
  return Boolean(broker.files.diagnostics || broker.files.config || broker.files.supplemental.length);
}

function detectRole(sections) {
  const redundancy = findSection(sections, "show redundancy detail");
  const group = findSection(sections, "show redundancy group");
  let role = "Unknown";
  let activity = "";
  let status = "";
  let mode = "";
  let mate = "";
  let sslMateLink = "";

  if (redundancy) {
    const configStatus = valueOf(redundancy.body, "Configuration Status");
    status = valueOf(redundancy.body, "Redundancy Status");
    mode = valueOf(redundancy.body, "Redundancy Mode");
    mate = valueOf(redundancy.body, "Mate Router Name");
    sslMateLink = valueOf(redundancy.body, "SSL");
    const operating = valueOf(redundancy.body, "Operating Mode");
    const activeStandby = valueOf(redundancy.body, "Active-Standby Role");
    if (/^Disabled/i.test(configStatus)) role = "Standalone";
    else if (/Monitor/i.test(operating)) role = "Monitor";
    else if (/^Primary/i.test(activeStandby)) role = "Primary";
    else if (/^Backup/i.test(activeStandby)) role = "Backup";

    const activityMatch = /^Activity Status\s+(Local Active|Mate Active|Shutdown|Standby|Unknown)/m.exec(redundancy.body);
    if (activityMatch) activity = activityMatch[1];
  }

  if (role === "Unknown" && group) {
    const table = parseFixedTable(group.body, /^Node Router-Name\s+Node Type/);
    const self = table.rows.find((row) => /\*$/.test(row["Node Router-Name"] || ""));
    if (self && /Monitor/i.test(self["Node Type"] || "")) role = "Monitor";
  }

  return { role, activity, redundancyStatus: status, redundancyMode: mode, mate, mateLinkSsl: sslMateLink };
}

function detectSnapshot(sections) {
  const candidates = [
    ["show storage-element * detail", (body) => valueOf(body, "Last Refreshed"), "storage-element Last Refreshed"],
    ["show smrp database detail", (body) => valueOf(body, "Block Summary Checksum Last Updated"), "SMRP checksum time"],
    ["show semp-session *", (body) => {
      const match = /\S+\s+\S+\s+([A-Z][a-z]{2} \d{2} \d{4} \d{2}:\d{2}:\d{2})/.exec(body);
      return match ? match[1] : "";
    }, "SEMP session time"],
    ["show log rest rest-delivery-point errors wide", (body) => {
      const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2})/m.exec(body);
      return match ? match[1] : "";
    }, "RDP log timestamp"],
  ];
  for (const [command, pick, source] of candidates) {
    const section = findSection(sections, command);
    if (!section) continue;
    const raw = pick(section.body);
    const date = parseCliDate(raw);
    if (date) return { snapshot: date, snapshotSource: source, snapshotRaw: raw };
  }
  return { snapshot: null, snapshotSource: "", snapshotRaw: "" };
}

function detectVersion(sections) {
  const version = findSection(sections, "show version");
  if (!version) return { version: "", load: "", uptime: "", edition: "" };
  const edition = /Solace PubSub\+\s+(\w+)\s+Version\s+(\S+)/.exec(version.body);
  return {
    edition: edition ? edition[1] : "",
    version: edition ? edition[2] : valueOf(version.body, "Current load is").replace(/^soltr_/, ""),
    load: valueOf(version.body, "Current load is"),
    uptime: valueOf(version.body, "System uptime"),
  };
}

function detectManagementIps(sections) {
  const vrf = findSection(sections, "show ip vrf management");
  if (!vrf) return [];
  return [...vrf.body.matchAll(/^\s*intf\d+(?::\d+)?\s+\S+\s+(\d{1,3}(?:\.\d{1,3}){3})\/\d+/gm)].map((match) => match[1]);
}

/**
 * Builds the analysed profile for a broker from its attached files.
 * The profile is what the analyzers and the UI consume.
 */
export function buildProfile(broker) {
  const warnings = [];
  const diagnosticsText = broker.files.diagnostics?.text || "";
  const diagnostics = diagnosticsText ? parseSections(diagnosticsText) : { sections: new Map(), host: "" };

  const supplementalMaps = [];
  const supplementalHosts = new Set();
  for (const file of broker.files.supplemental) {
    const parsed = parseSections(file.text);
    supplementalMaps.push(parsed.sections);
    if (parsed.host) supplementalHosts.add(parsed.host);
    if (parsed.host && parsed.host !== broker.hostname) {
      warnings.push(`Supplemental file ${file.name} reports host ${parsed.host}; it is attached to ${broker.hostname}.`);
    }
  }

  const sections = mergeSections(diagnostics.sections, ...supplementalMaps);
  const sectionSources = new Map();
  for (const key of diagnostics.sections.keys()) sectionSources.set(key, "diagnostics");
  for (const map of supplementalMaps) for (const key of map.keys()) sectionSources.set(key, "supplemental");

  let config = null;
  let facts = null;
  if (broker.files.config?.text) {
    config = parseConfig(broker.files.config.text);
    facts = extractConfigFacts(config);
    if (config.routerName && config.routerName !== broker.hostname) {
      warnings.push(`Config export names router ${config.routerName}; it is attached to ${broker.hostname}.`);
    }
  }

  const redundancy = detectRole(sections);
  const versionInfo = detectVersion(sections);
  const snapshot = detectSnapshot(sections);
  const post = findSection(sections, "show system post");
  const hardware = findSection(sections, "show hardware detail");

  return {
    hostname: broker.hostname,
    files: {
      diagnostics: broker.files.diagnostics?.name || "",
      config: broker.files.config?.name || "",
      supplemental: broker.files.supplemental.map((file) => file.name),
    },
    sections,
    sectionSources,
    config,
    facts,
    ...redundancy,
    ...versionInfo,
    ...snapshot,
    platform: hardware ? valueOf(hardware.body, "Platform") : post ? valueOf(post.body, "Platform") : "",
    postStatus: post ? valueOf(post.body, "Overall Power-On Self Test (POST) Status") : "",
    managementIps: detectManagementIps(sections),
    warnings,
  };
}

export function sortProfiles(profiles) {
  return [...profiles].sort((a, b) => {
    const order = (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9);
    return order !== 0 ? order : a.hostname.localeCompare(b.hostname);
  });
}
