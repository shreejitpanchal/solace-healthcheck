// GENERATED FILE - do not edit. Built by scripts/build.mjs from src/*.js (2026-09-22T07:41:35.538Z).
// Edit the modules under src/ and run: scripts/dev.sh build  (or scripts\dev.ps1 build)
(() => {
"use strict";

// ---- src/sections.js --------------------------------------------------------
// Extracts "show ..." command sections from Solace CLI output.
//
// Two input formats are recognised and may be mixed in one file:
//
// 1. gather-diagnostics headers (cli-diagnostics.txt):
//      #################################################################
//      # CLI command: show hostname
//      # Host:        broker1
//      #################################################################
//      <output>
//
// 2. CLI transcripts (pasted terminal session or `cli -A < commands.txt`):
//      broker1> show hostname
//      <output>
//      broker1# show version
//
// Sections are keyed by the normalised command text (single spaces, lower case).

const HEADER_RULE = /^#{20,}\s*$/;
const HEADER_COMMAND = /^# CLI command:\s*(.+?)\s*$/;
const HEADER_HOST = /^# Host:\s*(.+?)\s*$/;
const PROMPT_COMMAND = /^([A-Za-z0-9][\w.-]*)(?:\([\w/ -]+\))?[>#]\s*(show\s.+?)\s*$/;

function normalizeNewlines(text) {
  return String(text ?? "").replace(/\r\n?/g, "\n");
}

function normalizeCommand(command) {
  return String(command ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function trimBlankLines(lines) {
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start].trim() === "") start += 1;
  while (end > start && lines[end - 1].trim() === "") end -= 1;
  return lines.slice(start, end);
}

/**
 * Parses CLI output into sections.
 * @returns {{ sections: Map<string, {command:string, key:string, host:string, body:string, format:string}>, host: string }}
 */
function parseSections(text) {
  const lines = normalizeNewlines(text).split("\n");
  const sections = new Map();
  let current = null;
  let firstHost = "";
  let skipHeaderTail = false;

  const flush = () => {
    if (!current) return;
    current.body = trimBlankLines(current.lines).join("\n");
    delete current.lines;
    if (!sections.has(current.key)) sections.set(current.key, current);
    current = null;
  };

  const start = (command, host, format) => {
    flush();
    current = { command: command.trim(), key: normalizeCommand(command), host: host || "", body: "", format, lines: [] };
    if (host && !firstHost) firstHost = host;
  };

  for (const line of lines) {
    if (HEADER_RULE.test(line)) {
      // Rule lines belong to the header block, never to the body.
      continue;
    }

    const headerCommand = HEADER_COMMAND.exec(line);
    if (headerCommand) {
      start(headerCommand[1], "", "header");
      skipHeaderTail = true;
      continue;
    }

    if (skipHeaderTail) {
      const headerHost = HEADER_HOST.exec(line);
      if (headerHost && current) {
        current.host = headerHost[1];
        if (!firstHost) firstHost = headerHost[1];
        continue;
      }
      skipHeaderTail = false;
    }

    const prompt = PROMPT_COMMAND.exec(line);
    if (prompt) {
      start(prompt[2], prompt[1], "transcript");
      continue;
    }

    if (current) current.lines.push(line);
  }

  flush();
  return { sections, host: firstHost };
}

/**
 * Finds a section for a commands entry. The entry may list alternatives separated by "|".
 * Matching ignores case and repeated whitespace.
 */
function findSection(sections, entry) {
  if (!sections) return null;
  for (const alternative of String(entry).split("|")) {
    const key = normalizeCommand(alternative);
    if (!key) continue;
    const section = sections.get(key);
    if (section) return section;
  }
  return null;
}

/** Merges several section maps; later maps override earlier ones for the same command. */
function mergeSections(...maps) {
  const merged = new Map();
  for (const map of maps) {
    if (!map) continue;
    for (const [key, section] of map) merged.set(key, section);
  }
  return merged;
}

// ---- Body helpers used by the analyzers -------------------------------------------------

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Value after "Label :" on the first line that starts with the label (case-insensitive). */
function valueOf(body, label) {
  const pattern = new RegExp(`^\\s*${escapeRegExp(label)}\\s*:\\s*(.*?)\\s*$`, "im");
  const match = pattern.exec(body || "");
  return match ? match[1] : "";
}

/** All values for a repeated "Label :" line. */
function valuesOf(body, label) {
  const pattern = new RegExp(`^\\s*${escapeRegExp(label)}\\s*:\\s*(.*?)\\s*$`, "gim");
  return [...(body || "").matchAll(pattern)].map((match) => match[1]);
}

/** Lines whose trimmed text starts with one of the prefixes, in original order. */
function linesStartingWith(body, prefixes) {
  const list = Array.isArray(prefixes) ? prefixes : [prefixes];
  return (body || "").split("\n").filter((line) => {
    const trimmed = line.trim();
    return list.some((prefix) => trimmed.startsWith(prefix));
  });
}

/** Lines from the first line matching startRe up to (not including) the first later line matching stopRe. */
function blockBetween(body, startRe, stopRe) {
  const lines = (body || "").split("\n");
  const start = lines.findIndex((line) => startRe.test(line));
  if (start === -1) return [];
  const output = [lines[start]];
  for (let index = start + 1; index < lines.length; index += 1) {
    if (stopRe && stopRe.test(lines[index])) break;
    output.push(lines[index]);
  }
  return output;
}

/** Counter value from a "Name   12345" or "Name:   12345" statistics line. Returns null when absent. */
function counterOf(body, name) {
  const pattern = new RegExp(`^\\s*${escapeRegExp(name)}\\s*:?\\s+(\\d[\\d,]*)\\s*$`, "im");
  const match = pattern.exec(body || "");
  return match ? Number(match[1].replace(/,/g, "")) : null;
}

/** First and second numeric columns of a "Name   received   sent" statistics line. */
function counterPairOf(body, name) {
  const pattern = new RegExp(`^\\s*${escapeRegExp(name)}\\s*:?\\s+(\\d[\\d,]*)\\s+(\\d[\\d,]*)\\s*$`, "im");
  const match = pattern.exec(body || "");
  return match ? [Number(match[1].replace(/,/g, "")), Number(match[2].replace(/,/g, ""))] : null;
}

/**
 * Parses a fixed-width CLI table. Column boundaries come from the dashed separator line
 * under the header when present (each run of dashes is one column), otherwise from the
 * header words (columns separated by two or more spaces). Rows end at the first blank line.
 */
function parseFixedTable(body, headerRe) {
  const lines = (body || "").split("\n");
  const headerIndex = lines.findIndex((line) => headerRe.test(line));
  if (headerIndex === -1) return { columns: [], rows: [] };
  const header = lines[headerIndex];
  const separator = lines[headerIndex + 1] || "";
  const hasSeparator = /^[-\s]+$/.test(separator) && separator.includes("-");

  const columns = [];
  if (hasSeparator) {
    for (const run of separator.matchAll(/-+/g)) columns.push({ start: run.index });
    columns.forEach((column, index) => {
      column.end = index + 1 < columns.length ? columns[index + 1].start : Infinity;
      column.name = header.slice(column.start, column.end === Infinity ? undefined : column.end).trim();
    });
  } else {
    const tokenRe = /\S+(?: \S+)*/g;
    let token;
    while ((token = tokenRe.exec(header)) !== null) {
      columns.push({ name: token[0], start: token.index });
    }
    columns.forEach((column, index) => {
      column.end = index + 1 < columns.length ? columns[index + 1].start : Infinity;
    });
  }

  const rows = [];
  let cursor = headerIndex + 1;
  if (hasSeparator) cursor += 1;
  for (; cursor < lines.length; cursor += 1) {
    const line = lines[cursor];
    if (line.trim() === "") break;
    const row = {};
    for (const column of columns) {
      row[column.name] = line.slice(column.start, column.end === Infinity ? undefined : column.end).trim();
    }
    row.__line = line;
    rows.push(row);
  }
  return { columns: columns.map((column) => column.name), rows };
}

/** Parses "Mon DD YYYY HH:MM:SS" / "Mon D HH:MM:SS YYYY GMT" style CLI dates to a Date (UTC). */
function parseCliDate(text) {
  if (!text) return null;
  const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  const value = String(text).trim();

  // Certificate style: "May  9 11:18:25 2028 GMT"
  let match = /^([A-Za-z]{3})\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})\s+(\d{4})(?:\s+GMT)?$/.exec(value);
  if (match) {
    const month = months[match[1].toLowerCase()];
    if (month === undefined) return null;
    return new Date(Date.UTC(Number(match[6]), month, Number(match[2]), Number(match[3]), Number(match[4]), Number(match[5])));
  }

  // CLI style: "Sep 07 2026 15:19:21" optionally followed by a "+08" offset.
  match = /^([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4})\s+(\d{2}):(\d{2}):(\d{2})(?:\s+([+-]\d{2})(?::?(\d{2}))?)?$/.exec(value);
  if (match) {
    const month = months[match[1].toLowerCase()];
    if (month === undefined) return null;
    let stamp = Date.UTC(Number(match[3]), month, Number(match[2]), Number(match[4]), Number(match[5]), Number(match[6]));
    if (match[7]) {
      const sign = match[7].startsWith("-") ? -1 : 1;
      const hours = Number(match[7].slice(1));
      const minutes = Number(match[8] || 0);
      stamp -= sign * (hours * 60 + minutes) * 60 * 1000;
    }
    return new Date(stamp);
  }

  // ISO style from log tables.
  match = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.exec(value);
  if (match) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function formatDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return date.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
}

function daysBetween(from, to) {
  if (!from || !to) return null;
  return Math.floor((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

// ---- src/checks.js ----------------------------------------------------------
// Solace Ops Readiness Checklist definition.
//
// Each entry is one row of the checklist. Rows whose ref has one segment ("1") are
// groups, two segments ("1.1") are categories and three segments ("1.1.1") are checks.
//
// `commands` lists the CLI sections that provide evidence for the check. Each entry may
// contain alternatives separated by "|" (first match wins), e.g. "show system detail|show system".
// Sections come from cli-diagnostics.txt (gather-diagnostics) or from a supplemental CLI
// transcript. Checks without commands are either answered from the current-config export
// (see config-parser.js) or are manual.
//
// The verdict logic for each ref lives in analyzers.js. Add a new check by appending a row
// here and, if it can be evaluated automatically, an analyzer keyed by its ref.

const CHECKS = [
  {
    ref: "1",
    check: "Group: System Configuration",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "1.1",
    check: "Category: Basic System Configuration",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "1.1.1",
    check: "Management Link",
    description: "Management interface should be detected on the Solace broker",
    requirement: "As stated",
    source: "CLI/SEMP (Software):\n\"show interface intf0\"",
    expected: "Interface: intf0\n  Enabled: yes\n  Operational State: Up\n  Link detected: yes",
    commands: [
      "show interface intf0"
    ]
  },
  {
    ref: "1.1.2",
    check: "ADB Links",
    description: "For HA pairs only, the ADB links should be established between active and backup nodes",
    requirement: "As stated",
    source: "NA",
    expected: "NA",
    commands: [
      "show redundancy detail"
    ]
  },
  {
    ref: "1.1.3",
    check: "System POST",
    description: "The System Power On Self Test (POST) should be successfully passed",
    requirement: "As stated",
    source: "CLI/SEMP:\n \"show system post\"",
    expected: "Overall Power-On Self Test (POST) Status: PASSED",
    commands: [
      "show system post"
    ]
  },
  {
    ref: "1.1.4",
    check: "IP address assignment - Management Interface",
    description: "A single IP address should be assigned to the management interface and the default route must be configured",
    requirement: "As stated",
    source: "CLI/SEMP:\n \"show ip vrf management\"",
    expected: "IP Address and default gateway are assigned to interface: intf0\n",
    commands: [
      "show ip vrf management"
    ]
  },
  {
    ref: "1.1.5",
    check: "SolOS firmware Version",
    description: "Solace brokers have SolOS version as decided in design",
    requirement: "Version: <solOS version>",
    source: "CLI/SEMP: \n\"show version\"",
    expected: "Version <solOS version>",
    commands: [
      "show version"
    ]
  },
  {
    ref: "1.1.6",
    check: "Management Service Configuration",
    description: "SEMP services are enabled and configured with ports according to configuration plan",
    requirement: "SEMP (Secure) only",
    source: "CLI/SEMP:\n \"show service\"",
    expected: "SEMP Port 8080 (PlainText): Up/Down\nSEMP Port 1943 (Secure): Up",
    commands: [
      "show service"
    ]
  },
  {
    ref: "1.1.7",
    check: "Messaging Service Configuration",
    description: "Only the required messaging services are enabled as per design specification",
    requirement: "SMF (Secure)",
    source: "CLI/SEMP:\n \"show service\"\n\n\"show message-vpn <vpn-name> service\"",
    expected: "Broker Enabled Services:\n- SMF\n\nMessage VPN Enabled Service:\n- SMF (Secure)",
    commands: [
      "show service"
    ]
  },
  {
    ref: "1.1.8",
    check: "Connection Scaling Tier",
    description: "Event brokers should be configured with the max-connection scaling tier as per design specification (Software broker)",
    requirement: "Software broker: 1000",
    source: "CLI/SEMP:\n \"show system\"",
    expected: "Max Connections: 1000",
    commands: [
      "show system detail"
    ]
  },
  {
    ref: "1.1.9",
    check: "Hostname and router name",
    description: "A unique hostname and corresponding router name should be assigned to each broker. The router name should mirror the hostname",
    requirement: "",
    source: "CLI/SEMP:\n\"show hostname\"\n\"show router-name\"",
    expected: "Verify CLI output for hostname and router-name",
    commands: [
      "show hostname",
      "show router-name"
    ]
  },
  {
    ref: "1.1.10",
    check: "DNS Server Configuration",
    description: "Redundant DNS servers are configured for each Solace broker",
    requirement: "",
    source: "OS (Software):\ncat /etc/resolv.conf",
    expected: "nameserver <dns ip>",
    commands: [
      "show debug dns"
    ]
  },
  {
    ref: "1.1.11",
    check: "NTP Server Configuration",
    description: "NTP servers must be configured in order to synchronise the Solace broker's clock with an NTP server and the correct timezone should be applied",
    requirement: "",
    source: "OS (Software):\nntpstat\ntimedatectl status",
    expected: "ntpstat output: synchronized\n\nTime zone: <your-timezone>\n\nSystem clock synchronized: yes or \nNTP synchronized: yes\n\nNTP service: active or \nNTP enabled: yes\n",
    commands: []
  },
  {
    ref: "1.2",
    check: "Message Spool Configuration",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "1.2.1",
    check: "Storage Externalization",
    description: "Solace event brokers' storage should be mounted on external block storage",
    requirement: "Size: xx GB",
    source: "OS (Software):\nVerify volume mapping to container directory: /var/lib/solace",
    expected: "Solace Storage Elements are mounted on external block device",
    commands: [
      "show storage-element * detail"
    ]
  },
  {
    ref: "1.2.2",
    check: "Message Spool Configuration",
    description: "The message-spool must be configured with the max-spool usage as per design specification",
    requirement: "xx_000 MB",
    source: "CLI/SEMP:\n\"show message-spool\"",
    expected: "Maximum Spool Usage: <spool size> MB",
    commands: [
      "show message-spool detail"
    ]
  },
  {
    ref: "1.2.3",
    check: "Message Spool State",
    description: "The message-spool must be enabled. The state of the message-spool depends on the Solace broker deployment:\n> Enabled (Primary) for standalone brokers, and the primary broker in an HA pair\n> Enabled (Backup) for the backup broker in an HA pair",
    requirement: "As stated",
    source: "CLI/SEMP:\n\"show message-spool\"",
    expected: "Primary appliance:\nConfig Status: Enabled (Primary)\nOperational Status: AD-Active\n\nBackup appliance:\nConfig Status: Enabled (Backup)\nOperational Status: AD-Standby",
    commands: [
      "show message-spool detail"
    ]
  },
  {
    ref: "1.2.4",
    check: "Message Spool Defragmentation",
    description: "The message-spool should have auto defragmentation with either scheduled or threshold method.\nWhen auto defragmentation is not configured, the SYSTEM_AD_SPOOL_FILES_HIGH event should be monitored and manual defragmentation should be performed manually.",
    requirement: "Threshold condition: \n50% fragmentation and\n50% spool usage",
    source: "CLI/SEMP:\n\"show message-spool detail\"",
    expected: "Schedule Enabled: Yes/No\n  Days: <days-of-week>\n  Times: <times-of-week>\nThreshold Enabled: Yes\n  Fragmentation: 50% \n  Spool Usage: 50%",
    commands: [
      "show message-spool detail"
    ]
  },
  {
    ref: "1.3",
    check: "Fault-Tolerant Configuration",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "1.3.1",
    check: "Redundancy",
    description: "Solace brokers deployed as an HA pair must have the redundancy service configured and enabled. Matelink should be SSL enabled",
    requirement: "As stated",
    source: "CLI/SEMP (Software):\n\"show redundancy detail\"",
    expected: "Configuration Status     : Enabled\nRedundancy Status      : Up\nADB Link To Mate         : Up\nADB Hello To Mate        : Up\n  Mate-Link Connect Via  : \n    Remote Port          : 8741\n    SSL                  : Yes",
    commands: [
      "show redundancy detail",
      "show redundancy group"
    ]
  },
  {
    ref: "1.3.2",
    check: "Config-Sync",
    description: "Solace brokers deployed as an HA pair must have the Config-Sync service enabled in order to synchronise configuration parameters. SSL should be enabled",
    requirement: "As stated",
    source: "CLI/SEMP:\n\"show config-sync\"",
    expected: "Admin Status: Enabled\nOper Status: Up\nSSL Enabled: Yes",
    commands: [
      "show config-sync",
      "show config-sync database detail"
    ]
  },
  {
    ref: "1.4",
    check: "External Authentication",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "1.4.1",
    check: "LDAP Profile Configuration",
    description: "LDAP Profile is configured as per design specification",
    requirement: "",
    source: "CLI/SEMP:\n \"show ldap-profile <profile-name> detail\"",
    expected: "Admin Status: Enabled\nAdmin DN: <LDAP query user>\nSTARTTLS: Yes/No\nSearch:\nBase DN: <base search dn>\nLDAP Server Index #: <ldap-server-fqdn>",
    commands: [
      "show ldap-profile * detail"
    ]
  },
  {
    ref: "1.4.2",
    check: "Oauth Profile Configuration",
    description: "Oauth Profile is configured as per design specification",
    requirement: "",
    source: "CLI/SEMP:\n\"show authentication user-class cli-semp\"\n\n \"show oauth-profile <profile-name> detail\"",
    expected: "Default Oauth Profile: <profile-name>\n\nAdmin Status: Enabled\nActive: Yes\nClient ID: <oauth-id>\nClient Secret Configured: Yes\nUsername Claim: <assignd>\nGroup Claim: <asigned>\nIssuer: <configured>",
    commands: [
      "show authentication access-level detail",
      "show oauth-profile * detail"
    ]
  },
  {
    ref: "1.5",
    check: "Management User Configuration",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "1.5.1",
    check: "Global CLI Users",
    description: "Global CLI and File transfer Users  should be configured as per design specification",
    requirement: "",
    source: "CLI/SEMP: \n\"show username *\"\n\"show username * detail\"",
    expected: "Only authorized internal CLI and filetransfer users are created.",
    commands: [
      "show username * detail"
    ]
  },
  {
    ref: "1.5.2",
    check: "Default Global Access",
    description: "Default Global Access is set to none",
    requirement: "As stated",
    source: "CLI/SEMP:\n \"show authentication access-level default\"",
    expected: "Access-Level Configuration:\n  Default:\n    Global Acces Level: none",
    commands: [
      "show authentication access-level default|show authentication access-level detail"
    ]
  },
  {
    ref: "1.5.3",
    check: "CLI Authentication type",
    description: "CLI authentication type is configured as per design specification:\nAuth-type:\nInternal\nLDAP\nRadius",
    requirement: "",
    source: "CLI/SEMP:\nshow authentication access-level detail",
    expected: "CLI and SEMP user class:\n  auth-type:  <type>\n  profile-name: <profile-name>",
    commands: [
      "show authentication access-level detail"
    ]
  },
  {
    ref: "1.5.4",
    check: "CLI LDAP Authorization Group",
    description: "LDAP Groups are assigned to one of the following permissions as per design specification",
    requirement: "",
    source: "CLI/SEMP:\n \"show authentication access-level ldap\"\n\n \"show authentication access-level ldap detail\"",
    expected: "Only authorized LDAP groups are assigned with one of the global access permissions:\nnone\nread-only\nmesh-manager\nread-write\nadmin\nand VPN access level exceptions:\nread-only\nread-write",
    commands: [
      "show authentication access-level ldap detail|show authentication access-level ldap"
    ]
  },
  {
    ref: "1.5.5",
    check: "CLI Oauth Authorization Group",
    description: "OAuth Groups are assigned to one of the following permissions as per design specification:\nread-only\nmesh-manager\nread-write\nadmin",
    requirement: "",
    source: "CLI/SEMP:\n \"show oauth-profile <oauth-profile-name> access-level\"\n\n \"show oauth-profile <oauth-profile-name> access-level detail\"",
    expected: "Only authorized Oauth groups are assigned with one of the global access permissions:\nnone\nread-only\nmesh-manager\nread-write\nadmin\nand VPN access level exceptions:\nread-only\nread-write",
    commands: [
      "show oauth-profile * access-level detail|show oauth-profile * access-level"
    ]
  },
  {
    ref: "1.6",
    check: "Monitoring Configuration",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "1.6.1",
    check: "Syslog Forwarding",
    description: "Local Syslog log files must be forwarded to remote hosts for archival and retention ",
    requirement: "",
    source: "CLI/SEMP:\n\"show syslog\"",
    expected: "Facilities: event system\nHosts: <syslog server ip:port>\nTransport: TCP/UDP",
    commands: [
      "show syslog"
    ]
  },
  {
    ref: "1.6.2",
    check: "Syslog Server",
    description: "Solace Logs are recorded in Syslog Server",
    requirement: "",
    source: "Verify at external Syslog Server",
    expected: "Broker event and system logs are recorded in external syslog server",
    commands: []
  },
  {
    ref: "1.6.3",
    check: "Metrics Monitoring",
    description: "Solace metrics are collected at monitoring server as per design specification",
    requirement: "",
    source: "Verify at external Monitoring Server",
    expected: "Broker metrics are recorded in external monitoring server",
    commands: []
  },
  {
    ref: "1.7",
    check: "Backup Configuration",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "1.7.1",
    check: "Scheduled Backup Configuration",
    description: "A scheduled backup must be configured for all Solace brokers to the local file system with a retention period of XX copies as per design specification",
    requirement: "",
    source: "CLI/SEMP: \n\"show backup\"",
    expected: "Schedule: <day> <time>\nMax Backups: <number of retention>",
    commands: [
      "show backup"
    ]
  },
  {
    ref: "1.7.2",
    check: "Backup Archival",
    description: "The local configuration backups must be transferred to a remote location for retention and archival if required for retention beyond the “max-backups” configuration on the broker scheduled backup.",
    requirement: "",
    source: "External scheduling for collecting backup file from Solace broker",
    expected: "Backup files are copied to external storage",
    commands: []
  },
  {
    ref: "1.8",
    check: "Certificates",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "1.8.1",
    check: "Server Certificate Configuration",
    description: "A server certificate must be generated and configured for each Solace broker with correct CN and SAN ",
    requirement: "",
    source: "CLI/SEMP: \n\"show ssl server-certificate detail\"",
    expected: "CN: primary-router name\nSAN: primary fqdn, backup fqdn",
    commands: [
      "show ssl server-certificate detail"
    ]
  },
  {
    ref: "1.8.2",
    check: "Server Certificate Expiry",
    description: "The server certificate configured on the Solace appliance must be valid and not expired",
    requirement: "",
    source: "CLI/SEMP: \n\"show ssl server-certificate detail\" ",
    expected: "Server Certificate is valid",
    commands: [
      "show ssl server-certificate detail"
    ]
  },
  {
    ref: "1.8.3",
    check: "Domain/Trust Certificate",
    description: "Certificate Authorities must be configured for connection to external secure systems (Remote brokers, LDAP)",
    requirement: "",
    source: "CLI/SEMP: \n\"show domain-certificate-authority ca-name * cert\" ",
    expected: "Certificates are valid",
    commands: [
      "show domain-certificate-authority ca-name * cert"
    ]
  },
  {
    ref: "1.8.4",
    check: "Client Certificate",
    description: "Client Certificate Authorities must be configured for accepting client-certificate authentication from client and bridge users",
    requirement: "",
    source: "CLI/SEMP: \n\"show client-certificate-authority ca-name * cert\" ",
    expected: "Certificates are valid",
    commands: [
      "show client-certificate-authority ca-name * cert"
    ]
  },
  {
    ref: "1.9",
    check: "DR Replication Configuration",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "1.9.1",
    check: "Replication",
    description: "Replication Mate is configured as per design specification",
    requirement: "When DR replication is configured",
    source: "CLI/SEMP: \n\"show replication\"",
    expected: "Replication Mate: v:<router-name>\n    Plain Text:      <ip/hostname>:55555\n    Compressed: <ip/hostname>:55003\n    SSL:               <ip/hostname>:55443\nSSL:\n  Trusted Common Names: <certificate CN>",
    commands: [
      "show replication stats|show replication",
      "show message-vpn * replication"
    ]
  },
  {
    ref: "1.9.2",
    check: "Config-Sync",
    description: "Replication Config-sync between the active and standby site is configured (with SSL enabled.)",
    requirement: "When DR replication is configured",
    source: "CLI/SEMP:\n\"show replication\"",
    expected: "ConfigSync:\n  Bridge:                          \n    Admin State: Enabled\n    State: Up\nSSL: Yes/No",
    commands: [
      "show replication stats|show replication"
    ]
  },
  {
    ref: "1.10",
    check: "Host System Configuration",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "1.10.1",
    check: "Compute Resources",
    description: "Solace broker workload is allocated with sufficient CPU and RAM according to the broker size and other scaling parameters.",
    requirement: "",
    source: "",
    expected: "",
    commands: [
      "show system detail",
      "show memory"
    ]
  },
  {
    ref: "1.10.2",
    check: "Virtual Machine Network",
    description: "Virtual Network Interface is assigned with sufficient bandwidth.",
    requirement: "1Gbps or higher\nVmware: use VMX3",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "1.10.3",
    check: "Storage",
    description: "High performance external storage to be assigned for Solace broker.\nAppliance: SAN SSD storage\nSoftware/Cloud: Volume mapping from SSD Block storage\n",
    requirement: "",
    source: "",
    expected: "",
    commands: [
      "show storage-element * detail"
    ]
  },
  {
    ref: "1.10.4",
    check: "Container Runtime Network",
    description: "High performance container runtime network must be used for Solace software broker\n",
    requirement: "Docker/Podman: Use host or bridge network",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "1.10.5",
    check: "Additional co-located services",
    description: "Co-located services running on the same host as Solace broker must have additional CPU, memory, and disk resources being allocated. Each service should be reviewed to ensure it does not negatively impact broker's performance.",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "1.11",
    check: "System Health",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "1.11.1",
    check: "No System Alarms",
    description: "There should be no system alarms displayed for the Solace appliance - any alarms displayed should be acted upon to remediate the situation",
    requirement: "",
    source: "NA",
    expected: "NA",
    commands: [
      "show debug ad-show-alarms",
      "show system health"
    ]
  },
  {
    ref: "1.11.2",
    check: "No recurring errors in Logs",
    description: "There should be no recurring errors in the System Log indicative of an error condition",
    requirement: "As stated",
    source: "CLI/SEMP:\n \"show log system lines 100\"",
    expected: "No recurring error in System Log",
    commands: [
      "show log rest rest-delivery-point errors wide",
      "show log system lines 100"
    ]
  },
  {
    ref: "1.11.3",
    check: "Message Discards",
    description: "Egress and ingress discard counters should not be growing. Transmit congestion, spool egress discards, expired and TTL-exceeded messages indicate slow consumers or misconfigured TTLs.",
    requirement: "No unexplained discards",
    source: "CLI/SEMP:\n\"show stats client detail\"\n\"show message-spool stats\"",
    expected: "Total Ingress Discards: 0\nTotal Egress Discards: 0 (or explained)\nMessages Expired To Discard: 0\nTTL Exceeded To Discard: 0",
    commands: [
      "show stats client detail",
      "show message-spool stats"
    ]
  },
  {
    ref: "2",
    check: "Message-VPN Configuration",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "2.1",
    check: "Basic VPN Configuration",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "2.1.1",
    check: "VPN Name and Status",
    description: "Message VPN name is created as per naming convention and its status is configured as per design specification",
    requirement: "",
    source: "CLI/SEMP from active broker:\n \"show message-vpn <name>\"",
    expected: "Message VPN: default\nLocal Status: Down\n\nMessage VPN: <others>\nLocal Status: Up/Standby/Down",
    commands: [
      "show message-vpn *"
    ]
  },
  {
    ref: "2.1.2",
    check: "VPN Authentication and Authorization",
    description: "Message VPN should be configured with authentication and authorization method as per design specification",
    requirement: "",
    source: "CLI/SEMP:\n \"show message-vpn <name>\"\n \"show message-vpn <name> authorization\"",
    expected: "BASIC:\nBasic Authentication: Enabled\n  Auth Type: internal/ldap\n  Auth Profile: <ldap-profile-name>\n\nCLIENT CERTIFICATE:\nClient Certificate Authentication :  Enabled/Disabled\n\nOAUTH:\nOauth Authentication Enabled: Yes/No\n(oauth) Default Profile Name: <oauth-profile>\n\nAUTHORIZATION TYPE:\nAuthorization Type: Internal/ldap",
    commands: [
      "show message-vpn * detail"
    ]
  },
  {
    ref: "2.1.3",
    check: "VPN Limits",
    description: "VPN Resouces should be set as per connection scaling tier and the properties of message-spool: \n- size\n- connections\n- subscriptions\n- message-spool quota\n- ingress flows\n- egress flows\nare configured as per design specification",
    requirement: "",
    source: "CLI/SEMP:\n \"show message-vpn <name>\"\n\n\"show message-spool message-vpn <name>\"",
    expected: "Max Incoming Connections: 1000\n\nMaximum Queues and Topic-Endpoints:1000\nMax Allowed Spool Usage (MB): 60000\nMax Egress Flows: 1000\nMax Ingress Flows: 1000",
    commands: [
      "show message-vpn * detail",
      "show message-spool message-vpn * detail"
    ]
  },
  {
    ref: "2.1.4",
    check: "VPN Messaging Service Configuration",
    description: "Only the required messaging services are enabled",
    requirement: "SMF",
    source: "CLI/SEMP:\n \"show message-vpn <name> service\"",
    expected: "SMF TCP 55443: Up",
    commands: [
      "show message-vpn * service"
    ]
  },
  {
    ref: "2.1.5",
    check: "Client Profiles",
    description: "Client Profiles should be created as per design specification",
    requirement: "",
    source: "CLI/SEMP:\n \"show client-profile * detail\"",
    expected: "App Profile:\nProfile Name: <client-profile>\nMessage VPN: <vpn>\nGuaranteed Message Send: allow\nGuaranteed Message Receive: allow\nGuaranteed Endpoint Create: deny\nTransacted Sessions: deny\nAllow Bridge Connections: No\nAllow Shared Subscriptions: No\n\nBridge Profile:\nProfile Name: <client-profile>\nMessage VPN: <vpn>\nGuaranteed Message Send: allow\nGuaranteed Message Receive: allow\nGuaranteed Endpoint Create: deny\nTransacted Sessions: deny\nAllow Bridge Connections: Yes\nAllow Shared Subscriptions: No",
    commands: [
      "show client-profile * detail"
    ]
  },
  {
    ref: "2.1.6",
    check: "ACL Profiles",
    description: "ACL Profiles should be created as per design specification",
    requirement: "",
    source: "CLI/SEMP:\n \"show acl-profile *\"",
    expected: "Conn: n, exception: [list]\nPub: n, exception: [list]\nSub: n, exception: [list]\nShare: y",
    commands: [
      "show acl-profile * detail"
    ]
  },
  {
    ref: "2.1.7",
    check: "Client Usernames",
    description: "Client Usernames should be created as per design specification and assigned to correct client profile and acl profile\nDefault username should be disabled",
    requirement: "",
    source: "CLI/SEMP:\n \"show client-username * detail\"",
    expected: "Username: default\nEnabled: No\n\nUsername: <username>\nMessage VPN: <vpn>\nClient Profile: <client-profile>\nACL Profile: <acl-profile>\nEnabled: yes",
    commands: [
      "show client-username * detail"
    ]
  },
  {
    ref: "2.1.8",
    check: "Queue",
    description: "All queues should be created as per design specification and configured will appropriate permissions (owner, permissions and access-type)",
    requirement: "",
    source: "CLI/SEMP: \n\"show queue * detail\"",
    expected: "App Queue:\nName: <queue name>\nMessage VPN: <vpn>\nOwner: <owner name>\nAll Other Permission: <Consume/Read-Only/No Access>\n\nRemote Bridge Queue:\nName: <queue name>\nMessage VPN: <vpn>\nAccess Type: Exclusive\nOwner: <bridge user>\nAll Other Permission: <Consume/Read-Only/No Access>\nMax Bind Count: 1",
    commands: [
      "show queue * detail"
    ]
  },
  {
    ref: "2.1.9",
    check: "Topic to Queue mapping",
    description: "Queues have topic subscriptions as per design specification",
    requirement: "",
    source: "CLI/SEMP: \n\"show queue * subscriptions\"",
    expected: "Queue subscribes only to required topics",
    commands: [
      "show queue * subscriptions"
    ]
  },
  {
    ref: "2.2",
    check: "VPN Bridge Configuration",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "2.2.1",
    check: "VPN Bridge",
    description: "VPN Bridges should be configured between VPNs as per design specification, such as:\nAuthentication scheme\nTransport property\nMax TTL\nSpool queue and window size",
    requirement: "",
    source: "CLI/SEMP: \n\"show bridge * detail\"",
    expected: "Unidirectional:\nAdmin State: Up\nConnection Establisher: Local\nInbound Oper State: Up\n\nBidirectional:\nAdmin State: Up\nConnection Establisher: Local\nInbound Oper State: Up\nOutbound Oper State: Up",
    commands: [
      "show bridge *",
      "show bridge * detail"
    ]
  },
  {
    ref: "2.2.2",
    check: "Remote Queue Subscriptions",
    description: "Bridge remote queue should be configured with subscriptions as per design specification",
    requirement: "",
    source: "Local VPN (destination):\nCLI/SEMP: \n\"show bridge <name> message-vpn <vpn> detail\"\n\nRemote VPN (source):\nshow queue <source-queue> message-vpn <source-vpn> subscriptions",
    expected: "Local VPN (destination):\nQueue Oper State: Bound\nRemote Message VPN: <source-vpn>\n  Message Spool\n    Queue: <source-queue>\n    Queue Bind State: Up\n\nRemote VPN(source):\nSubscription: <list of subscribed topics>",
    commands: [
      "show bridge * detail"
    ]
  },
  {
    ref: "2.2.3",
    check: "Keepalive (optional)",
    description: "Determine duration (seconds) for micro-outage tolerance baseline. The value is to be used for calculating Keepalive value in of VPN Bridge.",
    requirement: "Keepalive Retry: 5\nKeepalive Time (sec): 3\nKeepalive Interval (sec): 1 ",
    source: "CLI/SEMP:\n\"show client-profile <bridge-client-profile-name> message-vpn <name> detail",
    expected: "Keepalive\n  Count: 5\n  Idle: 3 seconds\n  Interval: 1 seconds",
    commands: [
      "show client-profile * detail",
      "show bridge * detail"
    ]
  },
  {
    ref: "2.2.4",
    check: "WAN Tuning (optional)",
    description: "Determine acceptable bridge throughput on the WAN bandwidth and identify the optimum value for Message Spool Windows Size (msgs)",
    requirement: "Message Spool\n  Window Size (msgs): 255\n\nClient Profile's Priority Queues\n  G-1 Minimum Burst: 255\n\nWindow Size and G-1 Minimum Burst value must be the same\n",
    source: "CLI/SEMP:\n\"show bridge <bridge-name> message-vpn <name> detail\"\n\n\"show client-profile <bridge-client-profile-name> message-vpn <name> detail",
    expected: "Message Spool\n  Window Size: 255\n\nPriority Queue Min Burst\n  G-1: 255",
    commands: [
      "show bridge * detail",
      "show client-profile * detail"
    ]
  },
  {
    ref: "2.3",
    check: "VPN Replication (DR)",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "2.3.1",
    check: "Replication Bridge",
    description: "VPN Bridge for site replication is enabled with SSL and Client Certificate Authentication",
    requirement: "When DR replication is configured",
    source: "CLI/SEMP: \nAt primary and standby sites:\n\"show message-vpn <name> replication detail\"\n\nAt replication (standby) site:\nshow bridge #MSGVPN_REPLICATION_BRIDGE message-vpn <name> detail",
    expected: "Admin status: Yes\nUsing Server Certificate:    Yes\nSSL: Yes\n\nAdmin State:                  Enabled\nConn Establisher:             Local\nInbound Oper State:           Ready-InSync\nOutbound Oper State:          NotApplicable\nQueue Oper State:             Bound\nUsing Server Certificate:    Yes\nSSL: Yes",
    commands: [
      "show message-vpn * replication",
      "show bridge #MSGVPN_REPLICATION_BRIDGE message-vpn * detail"
    ]
  },
  {
    ref: "2.3.2",
    check: "Replication Subscriptions",
    description: "Replication queue should have subscriptions as per design specification",
    requirement: "When DR replication is configured",
    source: "CLI/SEMP:\n\"show queue #MSGVPN_REPLICATION_DATA_QUEUE message-vpn <name> subscription\"",
    expected: "Subscription: <list of subscribed topics>",
    commands: [
      "show queue #MSGVPN_REPLICATION_DATA_QUEUE message-vpn * detail"
    ]
  },
  {
    ref: "2.3.3",
    check: "Keepalive (optional)",
    description: "Determine duration (seconds) for micro-outage tolerance baseline. The value is to be used for calculating Keepalive value in of VPN Replication",
    requirement: "Keepalive Retry: 5\nKeepalive Time (sec): 3\nKeepalive Interval (sec): 1 ",
    source: "CLI/SEMP:\n\"show client-profile <replication-client-profile-name> message-vpn <name> detail",
    expected: "Keepalive\n  Count: 5\n  Idle: 3 seconds\n  Interval: 1 seconds",
    commands: [
      "show message-vpn * replication"
    ]
  },
  {
    ref: "2.3.4",
    check: "WAN Tuning (optional)",
    description: "Determine acceptable replication throughput on the WAN bandwidth and identify the optimum value for Message Spool Windows Size (msgs)",
    requirement: "Message Spool\n  Window Size (msgs): 255\n\nClient Profile's Priority Queues\n  G-1 Minimum Burst: 255\n\nWindow Size and G-1 Minimum Burst value must be the same\n",
    source: "CLI/SEMP:\n\"show message-vpn <name> replication detail\"\n\n\"show client-profile <replication-client-profile-name> message-vpn <name> detail",
    expected: "Message Spool\n  Window Size: 255\n\nPriority Queue Min Burst\n  G-1: 255",
    commands: [
      "show message-vpn * replication"
    ]
  },
  {
    ref: "3",
    check: "Client Configuration",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "3.1",
    check: "Application Configuration",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "3.1.1",
    check: "Application reconnect parameters",
    description: "Ensure that Client applications are configured to retry their connection to the broker on disconnection",
    requirement: "Client will attemp to reconnect to Solace broker and successfully reconnected",
    source: "While client is connected to Solace broker, restart msg-backbone service (standalone) or failover to HA mate",
    expected: "Client will attemp to reconnect to Solace broker and successfully reconnected",
    commands: []
  },
  {
    ref: "3.1.2",
    check: "Consumer clients re-subscribe or re-bind endpoint after reconnection",
    description: "Ensure that consumer clients are configured to re-subscribe to topics or re-connect to queue/topic-endpoint when reconnection occurs",
    requirement: "Consumer client will resume topics subscription or queue binding after reconnection",
    source: "While client is connected to Solace broker, restart msg-backbone service (standalone) or failover to HA mate",
    expected: "Consumer client will resume topics subscription or queue binding after reconnection",
    commands: []
  },
  {
    ref: "3.1.3",
    check: "Client Connection Flapping",
    description: "Ensure that customer clients retain connections when sending streaming events and avoid flapping the client connection (continuous connect & disconnect)",
    requirement: "No client connection flapping",
    source: "Verify the broker system or event logs",
    expected: "No client connection flapping",
    commands: []
  },
  {
    ref: "3.1.4",
    check: "Client Messaging Rate",
    description: "Client application to include messaging rate be measured in its test procedure.",
    requirement: "Client applications can publish and subscribe messages at expected throughput",
    source: "Verify client throughput at customer's monitoring system (recommended) or broker metrics snapshot if no monitoring system available",
    expected: "Client applications can publish and subscribe messages at expected throughput",
    commands: []
  },
  {
    ref: "3.1.5",
    check: "DR Failover (if applicable)",
    description: "Ensure that customer clients have a procedure for connecting DR brokers and have the procedure be validated in its testing.",
    requirement: "Client applications can connect to DR brokers after being activated",
    source: "Verify the DR broker system or event logs",
    expected: "Client applications can connect to DR brokers after being activated",
    commands: []
  },
  {
    ref: "3.1.6",
    check: "DMQ Eligible Property (prior 10.26.0 SolOS)",
    description: "Publisher client application enable DMQ Eligible property for allowing DMQ message handling",
    requirement: "As needed according to requirements",
    source: "Persistent messaged enqueued in Solace broker has DMQ Eligible property value: 'Yes'",
    expected: "As needed according to requirements",
    commands: []
  },
  {
    ref: "4",
    check: "Security",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "4.1",
    check: "Client Access and Authentication",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "4.1.1",
    check: "Disable unused services",
    description: "Disable all Solace services and ports except those required. All non-secure ports are to be disabled. The only messaging service protocols to be enabled are: \n- SMF Secure\n- AMQP(SSL)",
    requirement: "",
    source: "CLI/SEMP:\n \"show service\"",
    expected: "See 1.1.7",
    commands: [
      "show service"
    ]
  },
  {
    ref: "4.1.2",
    check: "Disable “default” Message-vpn",
    description: "The default Message VPN should be disabled, particularly for deployments to production. Having the default Message VPN enabled may enable clients with an incorrect message VPN name to gain access to the broker.",
    requirement: "",
    source: "CLI/SEMP:\n \"show message-vpn default\"",
    expected: "default VPN is disabled",
    commands: [
      "show message-vpn *"
    ]
  },
  {
    ref: "4.1.3",
    check: "Disable “default” client-username",
    description: "Every message VPN comes with a “default” client username that cannot be deleted. When a client username is not provided for a connection, “default” would be assumed. For proper implementation of access control, the “default” client username shall be disabled. Otherwise, any applications can connect to the message VPN using this client username.",
    requirement: "",
    source: "CLI/SEMP:\n \"show client-username default\"",
    expected: "All default users are disabled",
    commands: [
      "show client-username default message-vpn *|show client-username * detail"
    ]
  },
  {
    ref: "4.1.4",
    check: "Use Client-Usernames",
    description: "Use a unique client username for each distinct application that will access your VPN. This is useful for audit purposes, and also allows each application and/or client to have a unique ACL. ",
    requirement: "",
    source: "Verify application design and configuration against the client usernames in broker.\n\nCLI/SEMP:\n \"show client-username *\"",
    expected: "Validation at client application",
    commands: [
      "show client-username *|show client-username * detail"
    ]
  },
  {
    ref: "4.1.5",
    check: "Use Passsword-less authentication where possible",
    description: "Enable Client Certificate authentication at VPNs as per design specification",
    requirement: "",
    source: "CLI/SEMP:\nVerify client certificate is enabled at message-vpn:\n \"show message-vpn <name>\"\n\nVerify client-certificate configuration:\n\"show client-certificate-authority ca-name * cert\" \n\nVerify certificate user is configured in client-username:\n\"show client-username *\"",
    expected: "Client authentication is enabled at message VPN\n\nClient certificate is registered\n\nCertificate user is enabled in client-username",
    commands: [
      "show message-vpn * detail",
      "show client-certificate-authority ca-name * cert"
    ]
  },
  {
    ref: "4.2",
    check: "Client Authentication",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "4.2.1",
    check: "Use ACL profiles for authorization\n(Client Connect)",
    description: "Use the client connect configuration settings to restrict the IP addresses which clients should be allowed to connect from (CIDR Format) ",
    requirement: "",
    source: "CLI/SEMP:\n \"show acl-profile * detail\"",
    expected: "",
    commands: [
      "show acl-profile * detail"
    ]
  },
  {
    ref: "4.2.2",
    check: "Use ACL profiles for authorization\n(Publish Topic)",
    description: "Use the Publish Topic settings of an ACL to control where the client is allowed to publish to, including wildcarded topics and queues.",
    requirement: "",
    source: "CLI/SEMP:\n \"show acl-profile * detail\"",
    expected: "",
    commands: [
      "show acl-profile * detail"
    ]
  },
  {
    ref: "4.2.3",
    check: "Use ACL profiles for authorization\n(Subscribe Topic)",
    description: "Use the Subscribe Topic settings of an ACL to control where the client is allowed to subscribe to, including wildcarded topics.",
    requirement: "",
    source: "CLI/SEMP:\n \"show acl-profile * detail\"",
    expected: "",
    commands: [
      "show acl-profile * detail"
    ]
  },
  {
    ref: "4.2.4",
    check: "Limit user access via Client Profiles",
    description: "Limit a client’s acess to the functions required by setting these in the client-profile accordingly as per design specification",
    requirement: "",
    source: "CLI/SEMP:\n \"show client-profile * detail\"",
    expected: "",
    commands: [
      "show client-profile * detail"
    ]
  },
  {
    ref: "4.3",
    check: "Management Access and Authorization",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "4.3.1",
    check: "Set default management access to none",
    description: "Ensure the management Default Global Access is set to none",
    requirement: "",
    source: "CLI/SEMP:\n \"show authentication access-level default\"",
    expected: "See 1.5.2",
    commands: [
      "show authentication access-level default|show authentication access-level detail"
    ]
  },
  {
    ref: "4.3.2",
    check: "Limit access to management users and groups with “admin”,  \"read-write\", and \"mesh-manager\" permissions",
    description: "Management users and groups with “admin”, \"read-write\", and \"mesh-manager role can perform all or partial broker administration functions. Therefore, access to this role should be limited through operational procedures",
    requirement: "",
    source: "CLI/SEMP:\n\nVerify internal users role:\n\"show username *\"\n\nVerify ldap group role:\n\"show authentication access-level ldap\"\n\nVerify oauth group role:\n\"show oauth-profile * access-level\"",
    expected: "Only limited authorized users have admin and read-write permissions\n\nSee:\n1.5.1 (internal user), \n1.5.4 (ldap group), \nand 1.5.5 (oauth group)",
    commands: [
      "show username *|show username * detail",
      "show authentication access-level ldap",
      "show oauth-profile * access-level"
    ]
  },
  {
    ref: "4.3.3",
    check: "Limit message-vpn access with \"read-write\" permission",
    description: "Users and groups with any global management roles that have message-vpn \"read-write\" exception access can perform configuration changes at message-vpn level. Therefore, this exception access should be limited through operational procedures",
    requirement: "",
    source: "CLI/SEMP:\n\nVerify internal users role:\n\"show username * detail\"\n\nVerify ldap group role:\n\"show authentication access-level ldap group *\"\n\nVerify oauth group role:\n\"show oauth-profile * access-level detail\"",
    expected: "Only limited authorized users have message-vpn \"read-write\" access-level\n\nSee:\n1.5.1 (internal user), \n1.5.4 (ldap group), \nand 1.5.5 (oauth group)",
    commands: [
      "show username * detail",
      "show authentication access-level ldap detail",
      "show oauth-profile * access-level detail"
    ]
  },
  {
    ref: "4.3.4",
    check: "Limit access to CLI admin user",
    description: "Access to Solace broker default admin user must be restricted and controlled through operational procedures.",
    requirement: "",
    source: "Usage of admin user must be strictly controlled",
    expected: "Usage of admin user is strictly controlled",
    commands: []
  },
  {
    ref: "4.3.5",
    check: "Limit privilege access to host and container Linux shell",
    description: "Access to solace broker default support and root users must be restricted and controlled through operational procedures.",
    requirement: "",
    source: "Access to container host must be strictly controlled",
    expected: "Access to container host is strictly controlled",
    commands: []
  },
  {
    ref: "4.3.6",
    check: "Securely manage default management account passwords",
    description: "Securely manage the default management accounts with Privilege ID Management tool and procedure of the organization",
    requirement: "",
    source: "Securely manage default CLI admin user",
    expected: "Default CLI admin is securely managed",
    commands: []
  },
  {
    ref: "4.4",
    check: "Transport Security",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "4.4.1",
    check: "Use TLS for VPN bridges",
    description: "Use TLS/SSL for securing non loopback VPN bridge connections",
    requirement: "",
    source: "CLI/SEMP:\n \"show bridge <name> detail\"",
    expected: "Remote VPNs use TLS Enabled",
    commands: [
      "show bridge *",
      "show bridge * detail"
    ]
  },
  {
    ref: "4.4.2",
    check: "Use HTTPS for management",
    description: "Use HTTPS for accessing the Solace management console over the WebUI",
    requirement: "",
    source: "CLI/SEMP:\n \"show service\"\n\"show web-manager\"",
    expected: "See 1.1.6\nSEMP TCP 8080 (PlainText): Up/Down\nSEMP TCP 1943 (Secure): Up\n\nRedirect Manager Config Status : Enabled\nRedirect Manager Oper Status   : Up",
    commands: [
      "show service",
      "show web-manager"
    ]
  },
  {
    ref: "4.4.3",
    check: "Use TLS for Client Connections",
    description: "Use TLS/SSL for securing client connections",
    requirement: "",
    source: "CLI/SEMP:\n \"show stats client detail\"\n\nReview event log\n\nAnd verify at client application configuration",
    expected: "Clients are connected on secure port",
    commands: [
      "show stats client detail"
    ]
  },
  {
    ref: "4.4.4",
    check: "Disable TLS connection downgrade",
    description: "Client connections over TLS can be downgraded, meaning, the client still authenticates over a TLS connection but the transportation of the messages that follows is in plain-text. Ensure this is disabled unless required",
    requirement: "",
    source: "CLI/SEMP:\n \"show message-vpn <name>\"\n\n\"show client-profile <name> detail\"",
    expected: "SSL to plain text downgrade allowed: No\n  \nSSL                                   \n    Allow Downgrade to Plain Text       : No",
    commands: [
      "show message-vpn * detail",
      "show client-profile * detail"
    ]
  },
  {
    ref: "4.4.5",
    check: "Use TLS v1.2, disable TLS v1.1 and v1.0",
    description: "Disable TLS v1.1 on the software broker (disabled by default)",
    requirement: "",
    source: "CLI/SEMP:\n \"show ssl allow-tls-version\"",
    expected: "Allowed TLS versions: 1.2",
    commands: [
      "show ssl allow-tls-version|show ssl"
    ]
  },
  {
    ref: "4.4.6",
    check: "Use SHA-256 not SHA-1",
    description: "Use SHA-256 to generate certificates. While the broker also supports SHA-1 Cipher suites, SHA-1 is now considered feasibly breakable.",
    requirement: "",
    source: "CLI/SEMP:\n\"show ssl server-certificate detail\"",
    expected: "Signature Algorithm: sha256",
    commands: [
      "show ssl server-certificate detail"
    ]
  },
  {
    ref: "4.4.7",
    check: "Enable only required Cipher suites",
    description: "Enable cipher suites as per design specification",
    requirement: "",
    source: "CLI/SEMP:\n\"show ssl cipher-suite-list management\"\n\n\"show ssl cipher-suite-list msg-backbone\"",
    expected: "",
    commands: [
      "show ssl cipher-suite-list management",
      "show ssl cipher-suite-list msg-backbone"
    ]
  },
  {
    ref: "4.5",
    check: "Network Security",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "4.5.1",
    check: "Place the Solace broker behind a firewall",
    description: "Solace broker should be placed behind the firewall so that it is protected against Distributed Denial of Service (DDOS) attacks in general.",
    requirement: "",
    source: "Validation at network configuration",
    expected: "",
    commands: []
  },
  {
    ref: "4.5.2",
    check: "Only expose services and ports as required",
    description: "Only expose Solace appropriate ports for external access.",
    requirement: "",
    source: "CLI/SEMP:\n \"show service\"\n\nContainer runtime service port mappings",
    expected: "See \n1.1.6 (management service)\n1.1.7 (messaging services)",
    commands: [
      "show service"
    ]
  },
  {
    ref: "4.6",
    check: "Audit and Logging",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "4.6.1",
    check: "Centralized Syslog Forwarding",
    description: "Forward Solace syslogs to centralized Syslog servers for both real time monitoring and after-the-fact analysis and troubleshooting.",
    requirement: "",
    source: "Validate at external syslog monitoring",
    expected: "",
    commands: []
  },
  {
    ref: "4.6.2",
    check: "Enable Command Logging",
    description: "Solace provides a ‘command’ log that captures commands issued to the appliance along with the user that issued them. It is recommended that command logging is enabled for audit trail purposes. (This is the default setting).\n\n“show” commands should be silenced to ensure that the command log file does not fill up unnecessarily.",
    requirement: "",
    source: "CLI/SEMP:\n \"show logging command\"",
    expected: "CLI                   config\nSEMP/mgmt     config\nSEMP/msgbus config",
    commands: [
      "show logging command"
    ]
  },
  {
    ref: "4.6.3",
    check: "Monitoring Authentication Log Messages",
    description: "The following shows a list of recommended Syslog messages to be monitored concerning the authentication of users/ clients for audit purposes. As authentication is the first step against unauthorized access, logging of those events provides clues to unauthorized connection attempts.\n\n1.\tSYSTEM_AUTHENTICATION_SESSION_CLOSED\n2.\tSYSTEM_AUTHENTICATION_SESSION_DENIED\n3.\tSYSTEM_AUTHENTICATION_SESSION_OPENED\n4.\tSYSTEM_AUTHENTICATION_SHELL_ACCESS_DENIED\n5.\tSYSTEM_AUTHENTICATION_SHELL_ACCESS_GRANTED",
    requirement: "",
    source: "Validate at external syslog monitoring",
    expected: "",
    commands: []
  },
  {
    ref: "5",
    check: "Testing",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "5.1",
    check: "Infrastructure Performance Baseline",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "5.1.1",
    check: "Disk Performance",
    description: "Use disk test tool to measure external storage performance",
    requirement: "Establish baseline of disk performance",
    source: "Software broker:\nOS:\nsolacectl shell\nsoldisktest --dir=/usr/sw/internalSpool",
    expected: "Disk write performance is within acceptable rate",
    commands: []
  },
  {
    ref: "5.1.2",
    check: "LAN Performance (recommended)",
    description: "Use iperf tool to measure Local Area Network performance between Solace broker messaging network segment and client application network segment",
    requirement: "Establish baseline of LAN performance",
    source: "Use network iperf tool to test network throughput between broker messaging network segment and client network segment",
    expected: "Establish baseline of LAN performance",
    commands: []
  },
  {
    ref: "5.1.3",
    check: "WAN Performance (recommended)",
    description: "Use iperf tool to measure Wide Area Network performance between Solace broker network segment at one data center  and another data center of Solace broker and/or client application network segment",
    requirement: "Establish baseline of WAN performance",
    source: "Use network iperf tool to test network throughput between two data centers network segments",
    expected: "Establish baseline of WAN performance",
    commands: []
  },
  {
    ref: "5.2",
    check: "Broker Connectivity",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "5.2.1",
    check: "Management connectivity",
    description: "The Solace broker must be reachable over the management interface at SSH and HTTPS protocols from external servers on the network",
    requirement: "",
    source: "Software broker:\nOS:\nssh sysadmin@<solace-ip>\nCLI:\nssh -p 2222 <cli-admin>@<solace-ip>\n\nWeb browser or SolAdmin:\nhttps://<solace-fqdn>:1943\nUser: <cli-admin>",
    expected: "Succesfully login to CLI and WebUI",
    commands: []
  },
  {
    ref: "5.2.2",
    check: "File Transfer Connectivity",
    description: "File transfer users on the Solace broker must be able to log on and upload/download files",
    requirement: "",
    source: "Software broker:\nsftp -P 2222 <file-transfer-user>@<solace-ip>",
    expected: "Successfully login to FTP",
    commands: []
  },
  {
    ref: "5.2.3",
    check: "Message-backbone connectivity",
    description: "Message backbone service is reachable from client application network using SMF protocol on plain-text port",
    requirement: "",
    source: "Sdkperf:\n./sdkperf_java.sh -cip=tcp://<ip-address>:55555 -cu=<user>@<vpn> -cp=<password> -ptl=<topicname> -msa=2000 -mn=100 -mr=10 -stl=<topicname> -md",
    expected: "Total Messages transmitted = 10\nTotal Messages received across all subscribers = 10",
    commands: []
  },
  {
    ref: "5.2.4",
    check: "Message-backbone connectivity",
    description: "Message backbone service is reachable from client application network using SMF protocol on secure port",
    requirement: "",
    source: "Sdkperf:\n./sdkperf_java.sh -cip=tcps://<ip-address>:55443 -cu=<user>@<vpn> -cp=<password> -ptl=<topicname> -msa=2000 -mn=100 -mr=10 -stl=<topicname> -md",
    expected: "Total Messages transmitted = 10\nTotal Messages received across all subscribers = 10",
    commands: []
  },
  {
    ref: "5.2.5",
    check: "Message-backbone connectivity",
    description: "Message backbone service is reachable from client application network using <other> protocol",
    requirement: "",
    source: "",
    expected: "Client can publish and subscribe on <other> protocol",
    commands: []
  },
  {
    ref: "5.2.6",
    check: "Message-backbone connectivity",
    description: "Message backbone service is reachable from client application network using <other> protocol on secure port",
    requirement: "",
    source: "",
    expected: "Client can publish and subscribe on <other>  protocol on secure port",
    commands: []
  },
  {
    ref: "5.3",
    check: "Messaging Performance Baseline",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "5.3.1",
    check: "Direct Messaging Performance",
    description: "Use sdkperf to publish and subscribe at broker / network interface bandwidth limit",
    requirement: "Payload size: 2KB\nSimulated send rate: 50,000 msgs/s\nDuration: 2 minutes",
    source: "Publisher client:\n./sdkperf_java.sh -cip=tcps://<ip-address>:55443 -cu=<user>@<vpn> -cp=<password> -ptl=<topicname> -msa=2048 -mn=60000000 -mr=50000\n\nSubscriber client:\n./sdkperf_java.sh -cip=tcps://<ip-address>:55443 -cu=<user>@<vpn> -cp=<password> -stl=<topicname>",
    expected: "Computed publish rate (msg/sec) = nnn\n\n\n\n\nComputed subscriber rate (msg/sec across all subscribers) = nnn",
    commands: []
  },
  {
    ref: "5.3.2",
    check: "Guaranteed Messaging Performance",
    description: "Use sdkperf to publish and subscribe at broker / network interface bandwidth limit\n\nPre-condition:\nSolace broker has <queuename> created with <topicname> in its subscription",
    requirement: "Payload size: 2KB\nSimulated send rate: 50,000 msgs/s\nDuration: 2 minutes",
    source: "Publisher client:\n./sdkperf_java.sh -cip=tcps://<ip-address>:55443 -cu=<user>@<vpn> -cp=<password> -ptl=<topicname> -msa=2048 -mn=60000000 -mr=50000 -mt=persistent\n\nSubscriber client:\n./sdkperf_java.sh -cip=tcps://<ip-address>:55443 -cu=<user>@<vpn> -cp=<password> -sql=<queuename>",
    expected: "Computed publish rate (msg/sec) = nnn\n\n\n\n\nComputed subscriber rate (msg/sec across all subscribers) = nnn",
    commands: []
  },
  {
    ref: "5.4",
    check: "Fault Tolerance",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "5.4.1",
    check: "Client HA failover",
    description: "Use Sdkperf to publish and subscribe from/to appliance and software broker while performing HA failover / failback tests below\n\nPre-condition:\nSolace broker has <queuename> created with <topicname> in its subscription",
    requirement: "",
    source: "Sdkperf:\n./sdkperf_java.sh -cip=tcps:<primary-node-ip-address>:55443,tcps:<backup-node-ip-address>:55443 -cu=<user>@<vpn> -cp=<password> -pql=<queuename> -msa=2000 -mn=100 -mr=1 -mt=persistent -sql=<queuename> -md -rc=300",
    expected: "Total Messages transmitted = 100\nTotal Messages received across all subscribers = >=100 ",
    commands: []
  },
  {
    ref: "5.4.2",
    check: "Graceful HA failovers",
    description: "Brokers in HA deployment should be able to withstand a graceful failover initiated by an administrator\nPre-condition: HA is configured. Primary node is active. Backup node is standby",
    requirement: "",
    source: "Primary node:\nCLI/SEMP:\nenable\nconfigure\nredundancy release-activity\n(wait for approx 10 seconds and verify the redundancy status)\nshow redundancy\n(re-enable redundancy status)\nredundancy no release-activity",
    expected: "Primary Node:\nActivity Status: Mate Active",
    commands: []
  },
  {
    ref: "5.4.3",
    check: "Graceful HA failback",
    description: "Brokers in HA deployment should be able to withstand a graceful failover initiated by an administrator\nPre-condition: HA is configured. Backup node is active. Primary node is standby",
    requirement: "",
    source: "Backup node:\nCLI/SEMP:\nenable\nadmin\nredundancy revert-activity\nshow redundancy",
    expected: "Backup Node:\nActivity Status: Mate Active",
    commands: []
  },
  {
    ref: "5.4.4",
    check: "Abrupt HA failovers",
    description: "Brokers in HA deployment should be able to withstand an ungraceful failover e.g. an active broker restart\nPre-condition: HA is configured. Primary node is active. Backup Node is Standby",
    requirement: "",
    source: "Reboot Primary VM:\nOS:\nreboot\n\nVerify on backup node:\nshow redundancy\n",
    expected: "Backup Node:\nActivity Status: Local Active",
    commands: []
  },
  {
    ref: "5.4.5",
    check: "Abrupt HA failback",
    description: "Brokers in HA deployment should be able to withstand an ungraceful failover e.g. an active broker restart\nPre-condition: HA is configured. Backup node is active. Primary node is standby",
    requirement: "",
    source: "Reboot Backup VM:\nOS:\nreboot\n\nVerify on primary node:\nshow redundancy\n",
    expected: "Primary Node:\nActivity Status: Local Active",
    commands: []
  },
  {
    ref: "5.4.6",
    check: "Client DR failover",
    description: "Use Sdkperf to publish and subscribe from/to appliance and software broker while performing DR failover / failback tests below\n\nPre-condition:\nSolace broker has <queuename> created with <topicname> in its subscription\n<topicname> is added in VPN replication replicated topic with SYNC mode",
    requirement: "",
    source: "Sdkperf:\n./sdkperf_java.sh -cip=tcps:<primary-site-primary-ip>:55443,tcps:<primary-site-backup-ip>:55443,tcps:<dr-site-primary-ip>:55443,tcps:<dr-site-backup-ip>:55443 -cu=<user>@<vpn> -cp=<password> -pql=<queuename> -msa=2048 -mn=100 -mr=1 -mt=persistent -sql=<queuename> -md -rc=300",
    expected: "Total Messages transmitted = 100\nTotal Messages received across all subscribers = >=100 ",
    commands: []
  },
  {
    ref: "5.4.7",
    check: "DR failovers",
    description: "Brokers in DR deployment should be able to withstand a graceful failover initiated by an administrator\nPre-condition: DR replication is configured. Primary site VPN is active. DR site VPN is standby",
    requirement: "",
    source: "Primary site VPN:\nCLI/SEMP:\nenable\nconfigure\nmessage-vpn <name>\nreplication state standby\n\nwait for 1 minute\n\nDR site VPN:\nCLI/SEMP:\nenable\nconfigure\nmessage-vpn <name>\nreplication state active",
    expected: "Primary site VPN:\nLocal Status: Standby\n\nDR site VPN:\nLocal Status: Up\n\nReplication\n  ConfigSync:\n    Bridge:\n      State: Up",
    commands: []
  },
  {
    ref: "5.4.8",
    check: "DR failback",
    description: "Brokers in DR deployment should be able to withstand a graceful failover initiated by an administrator\nPre-condition: DR replication is configured. DR site VPN is active. Primary site VPN is standby",
    requirement: "",
    source: "DR site VPN:\nCLI/SEMP:\nenable\nconfigure\nmessage-vpn <name>\nreplication state standby\nshow message-vpn <name>\n\nwait for 1 minute\n\nPrimary site VPN:\nCLI/SEMP:\nenable\nconfigure\nmessage-vpn <name>\nreplication state active\nshow message-vpn <name>\nshow replication",
    expected: "DR site VPN:\nLocal Status: Standby\n\nPrimary site VPN:\nLocal Status: Up\n\nReplication\n  ConfigSync:\n    Bridge:\n      State: Up",
    commands: []
  },
  {
    ref: "5.5",
    check: "Monitoring Testing",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "5.5.1",
    check: "Monitoring Tool Integration",
    description: "The monitoring solution for Solace ( Syslog/SEMP)) must be fully tested against the monitoring use cases to ensure the monitoring solution operates as expected and meets requirements",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "5.5.2",
    check: "Monitoring Host Connectivity",
    description: "Any monitoring hosts must be able to retrieve data from the Solace appliance via CLI/SEMP",
    requirement: "",
    source: "Verify Metrics Monitoring server can connect and collect metrics from management IP",
    expected: "",
    commands: []
  },
  {
    ref: "5.5.3",
    check: "Alerting",
    description: "Verify that the correct monitoring alert recipients are configured and they receive the corresponding alerts",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "5.6",
    check: "Application Testing",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "5.6.1",
    check: "Application connectivity",
    description: "Validate application connectivity",
    requirement: "Client authentication is successful and no connection flapping",
    source: "Verify client application logs,  Solace system or event logs",
    expected: "Client authentication is successful and no connection flapping",
    commands: []
  },
  {
    ref: "5.6.2",
    check: "End-to-end event flows",
    description: "Validate that the application can send/receive messages over the bridge link",
    requirement: "All clients can send and receive messages as designed",
    source: "Verify client application logs,  Solace system or event logs",
    expected: "All clients can send and receive messages as designed",
    commands: []
  },
  {
    ref: "5.6.3",
    check: "Applications should withstand HA failover",
    description: "Applications connecting to a Solace HA Pair should be able to withstand an HA failover - applications should automatically reconnect to the backup Solace broker on an HA failover",
    requirement: "Applications connecting to a Solace broker should automatically reconnect; and consumer clients will rebind to Queues or resubscribe to Topics when HA failover/disconnected from a Solace broker",
    source: "While publishing and subscribing  messages, perform HA failover",
    expected: "Applications connecting to a Solace broker should automatically reconnect; and consumer clients will rebind to Queues or resubscribe to Topics when HA failover/disconnected from a Solace broker",
    commands: []
  },
  {
    ref: "5.6.4",
    check: "DR Replication",
    description: "Applications connecting to a Solace HA Pair should be able to withstand an DR (Site) failover as designed in DR activation procedure.",
    requirement: "Clients can send and receive messages at DR brokers",
    source: "Perform DR failover procedure",
    expected: "Validation at client application",
    commands: []
  },
  {
    ref: "5.7",
    check: "Support Readiness",
    description: "",
    requirement: "",
    source: "",
    expected: "",
    commands: []
  },
  {
    ref: "5.7.1",
    check: "Support Hotline",
    description: "New Solace customer should be familiar of product support contact methods",
    requirement: "Customer can contact support hotline and receive response within expected response time",
    source: "Simulate a hotline call",
    expected: "Customer can contact support hotline and receive response within expected response time",
    commands: []
  }
];

function isGroupRef(ref) {
  return /^\d+$/.test(ref);
}

function isCategoryRef(ref) {
  return /^\d+\.\d+$/.test(ref);
}

function isCheckRef(ref) {
  return /^\d+\.\d+\.\d+$/.test(ref);
}

// Splits a commands entry into its alternatives.
function commandAlternatives(entry) {
  return String(entry).split("|").map((value) => value.trim()).filter(Boolean);
}

// Every distinct command a check may ask for, across all alternatives.
function allRequestedCommands() {
  const commands = new Set();
  for (const check of CHECKS) {
    for (const entry of check.commands || []) {
      for (const alt of commandAlternatives(entry)) commands.add(alt);
    }
  }
  return [...commands];
}

// ---- src/config-parser.js ---------------------------------------------------
// Parses a Solace "show current-config" export into a tree and extracts facts from it.
//
// The export is indentation based: a block opens with a line such as `message-vpn "SDEG"`
// and its children are indented by two more spaces; `exit` lines close blocks. Comment
// lines start with "!" and carry hints such as `! Router: "broker1"`.
//
// Rather than pattern-matching individual lines in isolation (which confuses e.g. the
// `shutdown` of a client-username with the `shutdown` of a message-vpn), the parser builds
// the tree and every fact is read from an explicit path.


const REDACT_RE = /\b(password|secret|passphrase|client-secret|pre-shared-key|shared-secret|private-key|key)\b(\s+)(\S.*)$/i;

/** Masks credential values on a config line so they never reach the sheet or the logs. */
function redactLine(line) {
  return String(line).replace(REDACT_RE, (match, keyword, space) => `${keyword}${space}[redacted]`);
}

function parseConfig(text) {
  const lines = normalizeNewlines(text).split("\n");
  const root = { text: "", indent: -1, children: [], parent: null, line: 0 };
  const stack = [root];
  const comments = [];
  let routerName = "";

  lines.forEach((rawLine, index) => {
    const line = rawLine.replace(/\t/g, "  ").replace(/\s+$/, "");
    const trimmed = line.trim();
    if (!trimmed) return;

    if (trimmed.startsWith("!")) {
      comments.push({ text: trimmed, line: index + 1 });
      const router = /^!\s*Router:\s*"([^"]+)"/.exec(trimmed);
      if (router && !routerName) routerName = router[1];
      return;
    }

    if (trimmed === "exit" || trimmed === "end") return;

    const indent = line.length - line.trimStart().length;
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();
    const parent = stack[stack.length - 1];
    const node = { text: redactLine(trimmed), indent, children: [], parent, line: index + 1 };
    parent.children.push(node);
    stack.push(node);
  });

  if (!routerName) {
    const hostNode = root.children.find((node) => /^(?:hostname|router-name)\s+"?[\w.-]+"?$/.test(node.text));
    if (hostNode) routerName = hostNode.text.replace(/^(?:hostname|router-name)\s+/, "").replace(/"/g, "");
  }

  return { root, comments, routerName, lineCount: lines.length };
}

/** Depth-first search for nodes whose text matches the pattern. */
function findNodes(node, pattern, { maxDepth = Infinity } = {}) {
  const results = [];
  const visit = (current, depth) => {
    for (const child of current.children) {
      if (pattern.test(child.text)) results.push(child);
      if (depth + 1 < maxDepth) visit(child, depth + 1);
    }
  };
  visit(node, 0);
  return results;
}

function child(node, pattern) {
  return node ? node.children.find((item) => pattern.test(item.text)) || null : null;
}

function children(node, pattern) {
  return node ? node.children.filter((item) => pattern.test(item.text)) : [];
}

/** Captured group of the first child matching pattern, or "". */
function childValue(node, pattern, group = 1) {
  const found = child(node, pattern);
  if (!found) return "";
  const match = pattern.exec(found.text);
  return match ? (match[group] ?? "").replace(/^"|"$/g, "") : "";
}

/** Renders a subtree as indented text. Long subtrees are truncated with a marker. */
function flatten(node, { maxLines = 60, includeSelf = true } = {}) {
  const output = [];
  const visit = (current, depth) => {
    if (output.length >= maxLines) return;
    output.push(`${"  ".repeat(depth)}${current.text}`);
    for (const item of current.children) visit(item, depth + 1);
  };
  if (includeSelf) visit(node, 0);
  else node.children.forEach((item) => visit(item, 0));
  const total = countNodes(node, includeSelf);
  if (total > maxLines) output.push(`... (${total - maxLines} more lines)`);
  return output.join("\n");
}

function countNodes(node, includeSelf) {
  let total = includeSelf ? 1 : 0;
  for (const item of node.children) total += countNodes(item, true);
  return total;
}

function shutdownState(node) {
  if (!node) return "";
  if (child(node, /^no shutdown$/)) return "Enabled";
  if (child(node, /^shutdown$/)) return "Disabled";
  return "";
}

/** Merges the same-named blocks (a "create" line and one or more configure blocks) into one view. */
function collectBlocks(root, createRe, blockRe) {
  const map = new Map();
  const ensure = (name) => {
    if (!map.has(name)) map.set(name, { name, created: false, blocks: [] });
    return map.get(name);
  };
  for (const node of root.children) {
    const created = createRe.exec(node.text);
    if (created) {
      ensure(created[1]).created = true;
      continue;
    }
    const block = blockRe.exec(node.text);
    if (block) ensure(block[1]).blocks.push(node);
  }
  return map;
}

function mergedState(blocks) {
  for (const block of blocks) {
    const state = shutdownState(block);
    if (state) return state;
  }
  return "";
}

function firstDescendantValue(blocks, pattern, group = 1) {
  for (const block of blocks) {
    const nodes = findNodes(block, pattern);
    if (nodes.length) {
      const match = pattern.exec(nodes[0].text);
      return match ? (match[group] ?? "").replace(/^"|"$/g, "") : "";
    }
  }
  return "";
}

function flattenBlocks(blocks, options) {
  return blocks.map((block) => flatten(block, options)).join("\n");
}

/**
 * Extracts the facts the checklist analyzers need from a parsed config.
 * Every value is a string ("" when not present) or a Map keyed by object name.
 */
function extractConfigFacts(config) {
  const root = config.root;

  const usernames = [];
  for (const node of root.children) {
    const match = /^(?:create\s+)?username\s+"([^"]+)"/.exec(node.text);
    if (!match) continue;
    const inline = /global-access-level\s+"?([\w-]+)"?/.exec(node.text);
    const level = inline ? inline[1] : childValue(node, /^global-access-level\s+"?([\w-]+)"?/);
    const existing = usernames.find((item) => item.name === match[1]);
    if (existing) {
      if (level) existing.level = level;
      if (!existing.state) existing.state = shutdownState(node);
    } else {
      usernames.push({ name: match[1], level, state: shutdownState(node) });
    }
  }

  const authenticationBlocks = children(root, /^authentication$/);
  const defaultGlobalAccess = (() => {
    for (const block of authenticationBlocks) {
      const nodes = findNodes(block, /global-access-level\s+"?([\w-]+)"?/).filter((node) => {
        let cursor = node.parent;
        while (cursor && cursor !== block) {
          if (/^(?:group|username|user)\b/.test(cursor.text)) return false;
          cursor = cursor.parent;
        }
        return !/^(?:group|username|user)\b/.test(node.text);
      });
      if (nodes.length) {
        const match = /global-access-level\s+"?([\w-]+)"?/.exec(nodes[0].text);
        return match ? match[1] : "";
      }
    }
    return "";
  })();

  const authTypes = [];
  for (const block of authenticationBlocks) {
    for (const node of findNodes(block, /^auth-type\s+(\S+)/)) {
      const path = [];
      let cursor = node.parent;
      while (cursor && cursor !== block) {
        path.unshift(cursor.text);
        cursor = cursor.parent;
      }
      authTypes.push(`${path.join(" > ") || "authentication"}: ${node.text}`);
    }
  }

  const ldapGroups = authenticationBlocks
    .flatMap((block) => findNodes(block, /^(?:ldap\s+)?group\s+"/))
    .map((node) => flatten(node, { maxLines: 8 }));

  const ldapProfiles = collectBlocks(root, /^create\s+ldap-profile\s+"([^"]+)"/, /^ldap-profile\s+"([^"]+)"/);
  const oauthProfiles = collectBlocks(root, /^create\s+oauth-profile\s+"([^"]+)"/, /^oauth-profile\s+"([^"]+)"/);
  const syslogs = collectBlocks(root, /^create\s+syslog\s+"([^"]+)"/, /^syslog\s+"([^"]+)"/);
  const loggingNodes = children(root, /^logging\b/);
  const backupNodes = [...children(root, /backup/i), ...findNodes(root, /^schedule\b.*backup|^backup\b/i, { maxDepth: 3 })];
  const sslBlocks = children(root, /^ssl$/);
  const webManager = children(root, /^web-manager\b/);
  const serviceBlocks = children(root, /^service$/);
  const replicationBlocks = children(root, /^replication$/);

  const vpns = new Map();
  const vpnBlocks = collectBlocks(root, /^create\s+message-vpn\s+"([^"]+)"/, /^message-vpn\s+"([^"]+)"$/);
  for (const [name, entry] of vpnBlocks) {
    const blocks = entry.blocks;
    const authentication = blocks.map((block) => child(block, /^authentication$/)).filter(Boolean);
    const authorization = blocks.map((block) => child(block, /^authorization$/)).filter(Boolean);
    const service = blocks.map((block) => child(block, /^service$/)).filter(Boolean);
    const replication = blocks.map((block) => child(block, /^replication$/)).filter(Boolean);
    const basic = authentication.map((block) => child(block, /^basic$/)).filter(Boolean);
    const clientCertificate = authentication.map((block) => child(block, /^client-certificate$/)).filter(Boolean);
    const oauth = authentication.map((block) => child(block, /^oauth$/)).filter(Boolean);

    vpns.set(name, {
      name,
      state: mergedState(blocks),
      maxConnections: firstDescendantValue(blocks, /^max-connections\s+(\d+)/),
      maxSubscriptions: firstDescendantValue(blocks, /^max-subscriptions\s+(\d+)/),
      maxSpoolUsage: firstDescendantValue(blocks, /^max-spool-usage\s+(\d+)/),
      maxEgressFlows: firstDescendantValue(blocks, /^max-egress-flows\s+(\d+)/),
      maxIngressFlows: firstDescendantValue(blocks, /^max-ingress-flows\s+(\d+)/),
      maxEndpoints: firstDescendantValue(blocks, /^max-(?:endpoints|queues-and-topic-endpoints)\s+(\d+)/),
      basicState: mergedState(basic),
      basicAuthType: firstDescendantValue(basic, /^auth-type\s+(\S+)/),
      basicProfile: firstDescendantValue(basic, /^(?:ldap-profile|radius-profile|auth-profile|profile)\s+"?([^"\s]+)"?/),
      clientCertificateState: mergedState(clientCertificate),
      oauthState: mergedState(oauth),
      oauthDefaultProfile: firstDescendantValue(oauth, /^default-profile\s+"?([^"\s]*)"?/),
      authorizationType: firstDescendantValue(authorization, /^(?:authorization-type|type)\s+(\S+)/),
      authenticationText: flattenBlocks(authentication, { maxLines: 40 }),
      authorizationText: flattenBlocks(authorization, { maxLines: 20 }),
      serviceText: flattenBlocks(service, { maxLines: 40 }),
      replicationText: flattenBlocks(replication, { maxLines: 40 }),
      sslDowngrade: (() => {
        const nodes = blocks.flatMap((block) => findNodes(block, /allow-downgrade-to-plain-text/));
        if (!nodes.length) return "";
        return nodes.some((node) => /^no\s/.test(node.text)) ? "Disabled" : "Enabled";
      })(),
    });
  }

  const clientUsernames = new Map();
  for (const node of root.children) {
    const match = /^(?:create\s+)?client-username\s+"([^"]+)"\s+message-vpn\s+"([^"]+)"/.exec(node.text);
    if (!match) continue;
    const key = `${match[1]}@${match[2]}`;
    const entry = clientUsernames.get(key) || { name: match[1], vpn: match[2], blocks: [], state: "", clientProfile: "", aclProfile: "" };
    if (!/^create\s/.test(node.text)) entry.blocks.push(node);
    entry.state = entry.state || shutdownState(node);
    entry.clientProfile = entry.clientProfile || childValue(node, /^client-profile\s+"?([^"\s]+)"?/);
    entry.aclProfile = entry.aclProfile || childValue(node, /^acl-profile\s+"?([^"\s]+)"?/);
    clientUsernames.set(key, entry);
  }

  const clientProfiles = new Map();
  const aclProfiles = new Map();
  const bridges = new Map();
  for (const node of root.children) {
    let match = /^(?:create\s+)?client-profile\s+"([^"]+)"\s+message-vpn\s+"([^"]+)"/.exec(node.text);
    if (match) {
      const key = `${match[1]}@${match[2]}`;
      const entry = clientProfiles.get(key) || { name: match[1], vpn: match[2], blocks: [] };
      if (!/^create\s/.test(node.text)) entry.blocks.push(node);
      clientProfiles.set(key, entry);
      continue;
    }
    match = /^(?:create\s+)?acl-profile\s+"([^"]+)"\s+message-vpn\s+"([^"]+)"/.exec(node.text);
    if (match) {
      const key = `${match[1]}@${match[2]}`;
      const entry = aclProfiles.get(key) || { name: match[1], vpn: match[2], blocks: [] };
      if (!/^create\s/.test(node.text)) entry.blocks.push(node);
      aclProfiles.set(key, entry);
      continue;
    }
    match = /^(?:create\s+)?bridge\s+"([^"]+)"\s+message-vpn\s+"([^"]+)"/.exec(node.text);
    if (match) {
      const key = `${match[1]}@${match[2]}`;
      const entry = bridges.get(key) || { name: match[1], vpn: match[2], blocks: [] };
      if (!/^create\s/.test(node.text)) entry.blocks.push(node);
      bridges.set(key, entry);
    }
  }

  const queues = new Map();
  for (const spool of children(root, /^message-spool\s+message-vpn\s+"([^"]+)"/)) {
    const vpn = /message-vpn\s+"([^"]+)"/.exec(spool.text)[1];
    for (const node of spool.children) {
      const match = /^(?:create\s+)?queue\s+"([^"]+)"/.exec(node.text);
      if (!match) continue;
      const key = `${match[1]}@${vpn}`;
      const entry = queues.get(key) || { name: match[1], vpn, blocks: [], subscriptions: [] };
      if (!/^create\s/.test(node.text)) {
        entry.blocks.push(node);
        for (const sub of findNodes(node, /^subscription\s+topic\s+"([^"]+)"/)) {
          entry.subscriptions.push(/"([^"]+)"/.exec(sub.text)[1]);
        }
      }
      queues.set(key, entry);
    }
  }

  return {
    routerName: config.routerName,
    usernames,
    defaultGlobalAccess,
    authTypes,
    ldapGroups,
    authenticationText: flattenBlocks(authenticationBlocks, { maxLines: 60 }),
    ldapProfiles: mapBlocks(ldapProfiles, 30),
    oauthProfiles: mapBlocks(oauthProfiles, 30),
    syslogs: mapBlocks(syslogs, 20),
    loggingText: loggingNodes.map((node) => flatten(node, { maxLines: 10 })).join("\n"),
    backupText: dedupe(backupNodes).map((node) => flatten(node, { maxLines: 10 })).join("\n"),
    sslText: flattenBlocks(sslBlocks, { maxLines: 40 }),
    webManagerText: webManager.map((node) => flatten(node, { maxLines: 10 })).join("\n"),
    serviceText: flattenBlocks(serviceBlocks, { maxLines: 40 }),
    replicationText: flattenBlocks(replicationBlocks, { maxLines: 40 }),
    vpns,
    clientUsernames: finalizeMap(clientUsernames, 20),
    clientProfiles: finalizeMap(clientProfiles, 40),
    aclProfiles: finalizeMap(aclProfiles, 40),
    bridges: finalizeMap(bridges, 40),
    queues: finalizeMap(queues, 30),
  };
}

function dedupe(nodes) {
  return [...new Set(nodes)];
}

function mapBlocks(map, maxLines) {
  const output = new Map();
  for (const [name, entry] of map) {
    output.set(name, {
      name,
      state: mergedState(entry.blocks),
      text: flattenBlocks(entry.blocks, { maxLines }) || (entry.created ? `create ... "${name}" (no configuration block)` : ""),
    });
  }
  return output;
}

function finalizeMap(map, maxLines) {
  const output = new Map();
  for (const [key, entry] of map) {
    output.set(key, {
      ...entry,
      state: entry.state || mergedState(entry.blocks),
      text: flattenBlocks(entry.blocks, { maxLines }) || `${entry.name} (${entry.vpn}) created without a configuration block`,
    });
  }
  return output;
}

// ---- src/broker.js ----------------------------------------------------------
// Broker model: classifies uploaded files, detects hostnames and builds a profile
// (role, version, snapshot time, sections, config facts) for each broker.


const FILE_KINDS = {
  diagnostics: { label: "cli-diagnostics.txt", short: "Diagnostics" },
  config: { label: "current-config export", short: "Config" },
  supplemental: { label: "supplemental show-command transcript", short: "Supplemental" },
  other: { label: "unrecognised file", short: "Other" },
};

const ROLE_ORDER = { Primary: 0, Backup: 1, Monitor: 2, Standalone: 3, Unknown: 4 };

const CONFIG_HINT = /^(?:!\s*Router:|create message-vpn\s|message-vpn\s+"|create client-username\s|client-username\s+"|ldap-profile\s+"|client-profile\s+"|acl-profile\s+"|create username\s|hostname\s+"?[\w.-]+"?\s*$)/m;
const PROMPT_HINT = /^[A-Za-z0-9][\w.-]*(?:\([\w/ -]+\))?[>#]\s*show\s/m;

/** Decides what an uploaded file is by looking at its content, not its name. */
function classifyFile(name, text) {
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
function hostnameFromPath(path) {
  const match = /gather-diagnostics_\d+[dhm]_([A-Za-z0-9][\w.-]*?)(?:_\d{4}-\d{2}-\d{2}T[\d.]+)?(?:[\\/]|$)/.exec(String(path ?? ""));
  return match ? match[1] : "";
}

function detectHostname(kind, text, path = "") {
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

function createBroker(hostname) {
  return { hostname, files: { diagnostics: null, config: null, supplemental: [] } };
}

/** Attaches a classified file to a broker. Supplemental transcripts accumulate; the others replace. */
function attachFile(broker, file) {
  if (file.kind === "supplemental") {
    broker.files.supplemental = broker.files.supplemental.filter((item) => item.name !== file.name);
    broker.files.supplemental.push(file);
  } else if (file.kind === "diagnostics" || file.kind === "config") {
    broker.files[file.kind] = file;
  }
  return broker;
}

function detachFile(broker, kind, name) {
  if (kind === "supplemental") {
    broker.files.supplemental = broker.files.supplemental.filter((item) => item.name !== name);
  } else if (broker.files[kind] && (!name || broker.files[kind].name === name)) {
    broker.files[kind] = null;
  }
  return broker;
}

function brokerHasFiles(broker) {
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
function buildProfile(broker) {
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

function sortProfiles(profiles) {
  return [...profiles].sort((a, b) => {
    const order = (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9);
    return order !== 0 ? order : a.hostname.localeCompare(b.hostname);
  });
}

// ---- src/analyzers.js -------------------------------------------------------
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


const STATUS = {
  PASS: "pass",
  WARN: "warn",
  FAIL: "fail",
  INFO: "info",
  MANUAL: "manual",
  NA: "na",
  MISSING: "missing",
};

const STATUS_LABEL = {
  pass: "Pass",
  warn: "Warning",
  fail: "Fail",
  info: "Info",
  manual: "Manual",
  na: "N/A",
  missing: "Missing",
};

const STATUS_ORDER = ["fail", "warn", "missing", "info", "pass", "manual", "na"];

// Commands the standard gather-diagnostics bundle produces (verified against real bundles).
const GATHER_DIAGNOSTICS_COMMANDS = new Set([
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

const CERT_WARN_DAYS = 90;
const USAGE_WARN_PERCENT = 80;

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

function parseServiceTable(text) {
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

function parseCertificates(text) {
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

function parseStorageElements(text) {
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
function analyzeCheck(check, ctx) {
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

function supplementalCommandsFor(checks) {
  const commands = new Set();
  for (const check of checks) {
    for (const entry of check.commands || []) {
      const preferred = commandAlternatives(entry)[0];
      if (preferred && !GATHER_DIAGNOSTICS_COMMANDS.has(preferred.toLowerCase())) commands.add(preferred);
    }
  }
  return [...commands].sort();
}

// ---- src/checklist.js -------------------------------------------------------
// Assembles the checklist rows for a set of broker profiles.


const DEFAULT_TARGETS = { version: "", maxConnections: "", spoolMb: "" };

function rowKind(ref) {
  if (isGroupRef(ref)) return "group";
  if (isCategoryRef(ref)) return "category";
  return "check";
}

/**
 * @param profiles  broker profiles from buildProfile()
 * @param targets   design targets { version, maxConnections, spoolMb }
 * @returns { brokers, rows, summary }
 */
function buildChecklist(profiles, targets = DEFAULT_TARGETS, now = new Date()) {
  const brokers = sortProfiles(profiles);
  const merged = { ...DEFAULT_TARGETS, ...(targets || {}) };
  const rows = CHECKS.map((check) => {
    const kind = rowKind(check.ref);
    const cells = {};
    if (kind === "check") {
      for (const profile of brokers) {
        cells[profile.hostname] = analyzeCheck(check, { profile, profiles: brokers, targets: merged, now });
      }
    }
    return { ...check, kind, cells };
  });

  return { brokers, rows, summary: summarize(rows, brokers) };
}

function emptyCounts() {
  return Object.fromEntries(Object.values(STATUS).map((status) => [status, 0]));
}

function summarize(rows, brokers) {
  const perBroker = {};
  for (const profile of brokers) perBroker[profile.hostname] = emptyCounts();
  const total = emptyCounts();
  for (const row of rows) {
    if (row.kind !== "check") continue;
    for (const profile of brokers) {
      const cell = row.cells[profile.hostname];
      if (!cell) continue;
      perBroker[profile.hostname][cell.status] += 1;
      total[cell.status] += 1;
    }
  }
  return { perBroker, total };
}

/** Worst status in a row across brokers, using STATUS_ORDER (fail first). */
function rowWorstStatus(row) {
  const statuses = Object.values(row.cells).map((cell) => cell.status);
  for (const status of STATUS_ORDER) if (statuses.includes(status)) return status;
  return "";
}

function needsAttention(status) {
  return status === STATUS.FAIL || status === STATUS.WARN || status === STATUS.MISSING;
}

// ---- src/xlsx.js ------------------------------------------------------------
// Minimal XLSX writer (no dependencies): multiple sheets, styles, merges, freeze panes, autofilter.
//
// Cells are strings or { v: string, s: styleIndex }. Styles are fixed (see STYLE below).
// Text is sanitised for XML 1.0 and truncated to Excel's 32,767 character cell limit.

const STYLE = {
  normal: 0,
  header: 1,
  group: 2,
  category: 3,
  pass: 4,
  warn: 5,
  fail: 6,
  info: 7,
  manual: 8,
  na: 9,
  missing: 10,
  mono: 11,
  title: 12,
  label: 13,
  subtle: 14,
};

// Solace 2025 palette (ARGB). Status fills are light tints so the text stays legible.
const FILLS = [
  "FFFFFFFF", // 0 none/white
  "FF093B5F", // 1 Deep Blue (header)
  "FF03213B", // 2 Dark Blue (group)
  "FFC7FFCB", // 3 Spring Green (category)
  "FFDDF7E6", // 4 pass
  "FFFFF7C2", // 5 warn (Sunrise Yellow)
  "FFFAD4D4", // 6 fail
  "FFC2F7FF", // 7 info (Sky Blue)
  "FFF4F4F4", // 8 manual (Cool Gray 12)
  "FFEAEAEA", // 9 na (Cool Gray 13)
  "FFFDE7C3", // 10 missing (Orange tint)
];

const XML_INVALID = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;
const CELL_LIMIT = 32767;

function sanitizeCellText(value) {
  let text = String(value ?? "").replace(/\r\n?/g, "\n").replace(XML_INVALID, "");
  if (text.length > CELL_LIMIT) {
    const marker = "\n... [truncated to fit Excel cell limit]";
    text = `${text.slice(0, CELL_LIMIT - marker.length)}${marker}`;
  }
  return text;
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function columnName(index) {
  let name = "";
  let current = index;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    current = Math.floor((current - remainder) / 26);
  }
  return name;
}

function cellValue(cell) {
  return typeof cell === "object" && cell !== null ? cell.v : cell;
}

function cellStyle(cell, fallback) {
  return typeof cell === "object" && cell !== null && cell.s !== undefined ? cell.s : fallback;
}

/**
 * @param sheet { name, rows, colWidths, freeze: {rows, cols}, autoFilter: {fromRow, toRow, fromCol, toCol}, merges: ["A1:A2"], defaultStyle, rowHeight(rowIndex, row) }
 */
function worksheetXml(sheet) {
  const rows = sheet.rows || [];
  const colCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const widths = sheet.colWidths || [];
  const colXml = Array.from({ length: colCount }, (_, index) => {
    const width = widths[index] ?? 20;
    return `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`;
  }).join("");

  const rowXml = rows.map((row, rowIndex) => {
    const cells = row.map((cell, colIndex) => {
      const value = sanitizeCellText(cellValue(cell));
      const style = cellStyle(cell, sheet.defaultStyle ?? STYLE.normal);
      const ref = `${columnName(colIndex + 1)}${rowIndex + 1}`;
      if (value === "") return `<c r="${ref}" s="${style}"/>`;
      return `<c r="${ref}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
    }).join("");
    const height = sheet.rowHeight ? sheet.rowHeight(rowIndex, row) : null;
    const heightAttr = height ? ` ht="${height}" customHeight="1"` : "";
    return `<row r="${rowIndex + 1}"${heightAttr}>${cells}</row>`;
  }).join("");

  let paneXml = "";
  if (sheet.freeze && (sheet.freeze.rows || sheet.freeze.cols)) {
    const { rows: freezeRows = 0, cols: freezeCols = 0 } = sheet.freeze;
    const topLeft = `${columnName(freezeCols + 1)}${freezeRows + 1}`;
    const activePane = freezeRows && freezeCols ? "bottomRight" : freezeRows ? "bottomLeft" : "topRight";
    paneXml = `<pane${freezeCols ? ` xSplit="${freezeCols}"` : ""}${freezeRows ? ` ySplit="${freezeRows}"` : ""} topLeftCell="${topLeft}" activePane="${activePane}" state="frozen"/>`;
  }
  const sheetViews = `<sheetViews><sheetView workbookViewId="0"${sheet.showGridLines === false ? ' showGridLines="0"' : ""}>${paneXml}</sheetView></sheetViews>`;

  const mergeXml = sheet.merges?.length
    ? `<mergeCells count="${sheet.merges.length}">${sheet.merges.map((ref) => `<mergeCell ref="${ref}"/>`).join("")}</mergeCells>`
    : "";
  const filterXml = sheet.autoFilter
    ? `<autoFilter ref="${columnName(sheet.autoFilter.fromCol)}${sheet.autoFilter.fromRow}:${columnName(sheet.autoFilter.toCol)}${sheet.autoFilter.toRow}"/>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
${sheetViews}
<sheetFormatPr defaultRowHeight="15"/>
<cols>${colXml}</cols>
<sheetData>${rowXml}</sheetData>
${filterXml}
${mergeXml}
<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>
</worksheet>`;
}

function stylesXml() {
  const fills = FILLS.map((rgb, index) => (index === 0
    ? `<fill><patternFill patternType="none"/></fill>`
    : `<fill><patternFill patternType="solid"><fgColor rgb="${rgb}"/><bgColor indexed="64"/></patternFill></fill>`));
  // Excel requires fill index 1 to be gray125; insert it and shift our indexes by one.
  fills.splice(1, 0, `<fill><patternFill patternType="gray125"/></fill>`);
  const fill = (index) => (index === 0 ? 0 : index + 1);

  const fonts = [
    `<font><sz val="10"/><color rgb="FF093B5F"/><name val="Calibri"/></font>`, // 0 body
    `<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>`, // 1 white bold
    `<font><b/><sz val="10"/><color rgb="FF093B5F"/><name val="Calibri"/></font>`, // 2 bold body
    `<font><sz val="9"/><color rgb="FF03213B"/><name val="Consolas"/></font>`, // 3 mono
    `<font><b/><sz val="16"/><color rgb="FF093B5F"/><name val="Calibri"/></font>`, // 4 title
    `<font><sz val="9"/><color rgb="FF63717D"/><name val="Calibri"/></font>`, // 5 subtle
  ];

  const xf = (fontId, fillId, { bold = false, center = false, wrap = true } = {}) =>
    `<xf numFmtId="0" fontId="${fontId}" fillId="${fill(fillId)}" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment wrapText="${wrap ? 1 : 0}" vertical="${center ? "center" : "top"}"${center ? ' horizontal="center"' : ""}/></xf>`;

  const cellXfs = [
    xf(0, 0), // 0 normal
    xf(1, 1, { center: true }), // 1 header
    xf(1, 2), // 2 group
    xf(2, 3), // 3 category
    xf(0, 4), // 4 pass
    xf(0, 5), // 5 warn
    xf(0, 6), // 6 fail
    xf(0, 7), // 7 info
    xf(0, 8), // 8 manual
    xf(0, 9), // 9 na
    xf(0, 10), // 10 missing
    xf(3, 0), // 11 mono
    `<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center"/></xf>`, // 12 title
    xf(2, 0), // 13 label
    `<xf numFmtId="0" fontId="5" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>`, // 14 subtle
  ];

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="${fonts.length}">${fonts.join("")}</fonts>
<fills count="${fills.length}">${fills.join("")}</fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFD6D6D6"/></left><right style="thin"><color rgb="FFD6D6D6"/></right><top style="thin"><color rgb="FFD6D6D6"/></top><bottom style="thin"><color rgb="FFD6D6D6"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="${cellXfs.length}">${cellXfs.join("")}</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

/**
 * Builds a workbook.
 * @param sheets  array of sheet definitions (see worksheetXml)
 * @param meta    { title, creator }
 * @returns Uint8Array (zip bytes)
 */
function createWorkbook(sheets, meta = {}) {
  const files = {};
  const sheetEntries = sheets.map((sheet, index) => ({ sheet, id: index + 1, name: sanitizeSheetName(sheet.name || `Sheet${index + 1}`) }));

  files["[Content_Types].xml"] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${sheetEntries.map((entry) => `<Override PartName="/xl/worksheets/sheet${entry.id}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("\n")}
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;

  files["_rels/.rels"] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;

  files["docProps/app.xml"] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
<Application>${escapeXml(meta.creator || "Solace Readiness Checklist Builder")}</Application>
</Properties>`;

  files["docProps/core.xml"] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>${escapeXml(meta.title || "Solace Ops Readiness Checklist")}</dc:title>
<dc:creator>${escapeXml(meta.creator || "Solace Readiness Checklist Builder")}</dc:creator>
<cp:lastModifiedBy>${escapeXml(meta.creator || "Solace Readiness Checklist Builder")}</cp:lastModifiedBy>
<dcterms:created xsi:type="dcterms:W3CDTF">${(meta.created || new Date()).toISOString()}</dcterms:created>
</cp:coreProperties>`;

  files["xl/workbook.xml"] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${sheetEntries.map((entry) => `<sheet name="${escapeXml(entry.name)}" sheetId="${entry.id}" r:id="rId${entry.id}"/>`).join("")}</sheets>
</workbook>`;

  files["xl/_rels/workbook.xml.rels"] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheetEntries.map((entry) => `<Relationship Id="rId${entry.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${entry.id}.xml"/>`).join("\n")}
<Relationship Id="rId${sheetEntries.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  files["xl/styles.xml"] = stylesXml();
  for (const entry of sheetEntries) {
    files[`xl/worksheets/sheet${entry.id}.xml`] = worksheetXml(entry.sheet);
  }

  return zipStore(files);
}

function sanitizeSheetName(name) {
  return String(name).replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 31) || "Sheet";
}

// ---- ZIP (store only) -----------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let c = index;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[index] = c >>> 0;
  }
  return table;
})();

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value) {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return bytes;
}

function u32(value) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value >>> 0, true);
  return bytes;
}

function concatBytes(...arrays) {
  const total = arrays.reduce((sum, item) => sum + item.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const item of arrays) {
    output.set(item, offset);
    offset += item.length;
  }
  return output;
}

function dosDateTime(date) {
  const time = ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | ((date.getSeconds() >> 1) & 0x1f);
  const day = (((date.getFullYear() - 1980) & 0x7f) << 9) | (((date.getMonth() + 1) & 0x0f) << 5) | (date.getDate() & 0x1f);
  return { time, day };
}

function zipStore(files, date = new Date()) {
  const encoder = new TextEncoder();
  const { time, day } = dosDateTime(date);
  const entries = Object.entries(files).map(([name, content]) => ({
    nameBytes: encoder.encode(name),
    data: content instanceof Uint8Array ? content : encoder.encode(content),
  }));

  let offset = 0;
  const localParts = [];
  const centralParts = [];

  for (const entry of entries) {
    const crc = crc32(entry.data);
    const localHeader = concatBytes(
      u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(time), u16(day), u32(crc),
      u32(entry.data.length), u32(entry.data.length), u16(entry.nameBytes.length), u16(0), entry.nameBytes,
    );
    localParts.push(localHeader, entry.data);
    centralParts.push(concatBytes(
      u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(time), u16(day), u32(crc),
      u32(entry.data.length), u32(entry.data.length), u16(entry.nameBytes.length), u16(0), u16(0),
      u16(0), u16(0), u32(0), u32(offset), entry.nameBytes,
    ));
    offset += localHeader.length + entry.data.length;
  }

  const central = concatBytes(...centralParts);
  const end = concatBytes(u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(central.length), u32(offset), u16(0));
  return concatBytes(...localParts, central, end);
}

// ---- src/report.js ----------------------------------------------------------
// Turns a checklist into workbook sheets (Summary, Readiness Checklist, Supplemental Commands).


const BASE_COLUMNS = ["#", "Control Item", "Control Statement", "Passing Criteria", "Validation Method", "Expected Result"];
const BASE_WIDTHS = [8, 30, 52, 26, 30, 38];
const RESULT_WIDTH = 14;
const OUTPUT_WIDTH = 80;

const STATUS_STYLE = {
  pass: STYLE.pass,
  warn: STYLE.warn,
  fail: STYLE.fail,
  info: STYLE.info,
  manual: STYLE.manual,
  na: STYLE.na,
  missing: STYLE.missing,
};

function lineCount(text) {
  return String(text ?? "").split("\n").length;
}

function checklistSheet(checklist) {
  const { brokers, rows } = checklist;
  // Row 1 groups columns (broker names), row 2 carries the filterable labels. No vertical
  // merges: Excel's autofilter must not sit on merged header cells.
  const header1 = BASE_COLUMNS.map(() => ({ v: "", s: STYLE.header }));
  const header2 = BASE_COLUMNS.map((label) => ({ v: label, s: STYLE.header }));
  header1[0] = { v: "Solace Ops Readiness Checklist", s: STYLE.header };
  header1[4] = { v: "Software Broker", s: STYLE.header };

  const merges = ["A1:D1", "E1:F1"];
  const widths = [...BASE_WIDTHS];
  brokers.forEach((profile, index) => {
    const col = 7 + index * 2;
    const title = `${profile.hostname}${profile.role && profile.role !== "Unknown" ? ` (${profile.role})` : ""}`;
    header1.push({ v: title, s: STYLE.header }, { v: "", s: STYLE.header });
    header2.push({ v: "Result", s: STYLE.header }, { v: "Actual Output / Value", s: STYLE.header });
    merges.push(`${col1(col)}1:${col1(col + 1)}1`);
    widths.push(RESULT_WIDTH, OUTPUT_WIDTH);
  });
  if (!brokers.length) {
    header1.push({ v: "Broker", s: STYLE.header }, { v: "", s: STYLE.header });
    header2.push({ v: "Result", s: STYLE.header }, { v: "Actual Output / Value", s: STYLE.header });
    merges.push("G1:H1");
    widths.push(RESULT_WIDTH, OUTPUT_WIDTH);
  }

  const dataRows = rows.map((row) => {
    const style = row.kind === "group" ? STYLE.group : row.kind === "category" ? STYLE.category : STYLE.normal;
    const base = [row.ref, row.check, row.description, row.requirement, row.source, row.expected].map((value) => ({ v: value, s: style }));
    const cells = [];
    for (const profile of brokers) {
      const cell = row.cells[profile.hostname];
      if (!cell) {
        cells.push({ v: "", s: style }, { v: "", s: style });
        continue;
      }
      const label = `${STATUS_LABEL[cell.status] || cell.status}${cell.note ? `\n${cell.note}` : ""}`;
      cells.push({ v: label, s: STATUS_STYLE[cell.status] ?? STYLE.normal }, { v: cell.output, s: STYLE.mono });
    }
    if (!brokers.length) cells.push({ v: "", s: style }, { v: "", s: style });
    return [...base, ...cells];
  });

  const allRows = [header1, header2, ...dataRows];
  const lastCol = allRows[0].length;

  return {
    name: "Readiness Checklist",
    rows: allRows,
    colWidths: widths,
    merges,
    freeze: { rows: 2, cols: 2 },
    autoFilter: { fromRow: 2, toRow: allRows.length, fromCol: 1, toCol: lastCol },
    rowHeight: (rowIndex, row) => {
      if (rowIndex < 2) return 24;
      const kind = rows[rowIndex - 2]?.kind;
      if (kind !== "check") return 20;
      const lines = row.reduce((max, cell) => Math.max(max, lineCount(typeof cell === "object" ? cell.v : cell)), 1);
      return Math.min(320, Math.max(30, lines * 12.5 + 6));
    },
  };
}

function col1(index) {
  let name = "";
  let current = index;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    current = Math.floor((current - remainder) / 26);
  }
  return name;
}

function summarySheet(checklist, targets, generatedAt) {
  const { brokers, summary } = checklist;
  const rows = [];
  const push = (...cells) => rows.push(cells);

  push({ v: "Solace Ops Readiness Checklist", s: STYLE.title });
  push({ v: `Generated ${formatDate(generatedAt)}`, s: STYLE.subtle });
  push({ v: `${brokers.length} broker(s). Verdicts are computed from cli-diagnostics.txt, supplemental CLI transcripts and current-config exports; items marked Info or Manual still need a reviewer.`, s: STYLE.subtle });
  push();

  push({ v: "Design targets", s: STYLE.label });
  push({ v: "SolOS version", s: STYLE.label }, targets.version || "(not set)");
  push({ v: "Connection scaling tier", s: STYLE.label }, targets.maxConnections || "(not set)");
  push({ v: "Max spool usage (MB)", s: STYLE.label }, targets.spoolMb || "(not set)");
  push();

  push({ v: "Broker inventory", s: STYLE.label });
  const inventoryHeader = ["Hostname", "Role", "Activity", "Redundancy", "Version", "Uptime", "Platform", "POST", "Snapshot time", "Management IP", "Files"];
  push(...inventoryHeader.map((label) => ({ v: label, s: STYLE.header })));
  for (const profile of brokers) {
    push(
      profile.hostname,
      profile.role,
      profile.activity || "",
      profile.redundancyStatus || "",
      profile.version || "",
      profile.uptime || "",
      profile.platform || "",
      profile.postStatus || "",
      profile.snapshot ? `${formatDate(profile.snapshot)} (${profile.snapshotSource})` : "unknown",
      profile.managementIps.join(", "),
      [profile.files.diagnostics, profile.files.config, ...profile.files.supplemental].filter(Boolean).join("\n"),
    );
  }
  push();

  push({ v: "Results per broker", s: STYLE.label });
  const statuses = Object.values(STATUS);
  push({ v: "Hostname", s: STYLE.header }, ...statuses.map((status) => ({ v: STATUS_LABEL[status], s: STYLE.header })));
  for (const profile of brokers) {
    const counts = summary.perBroker[profile.hostname];
    push(profile.hostname, ...statuses.map((status) => ({ v: String(counts[status]), s: counts[status] ? STATUS_STYLE[status] : STYLE.normal })));
  }
  push({ v: "All brokers", s: STYLE.label }, ...statuses.map((status) => ({ v: String(summary.total[status]), s: summary.total[status] ? STATUS_STYLE[status] : STYLE.normal })));
  push();

  const attention = [];
  for (const row of checklist.rows) {
    if (row.kind !== "check") continue;
    for (const profile of brokers) {
      const cell = row.cells[profile.hostname];
      if (cell && (cell.status === STATUS.FAIL || cell.status === STATUS.WARN)) {
        attention.push([row.ref, row.check, profile.hostname, { v: STATUS_LABEL[cell.status], s: STATUS_STYLE[cell.status] }, cell.note]);
      }
    }
  }
  push({ v: "Items needing attention", s: STYLE.label });
  push(...["#", "Control Item", "Broker", "Result", "Finding"].map((label) => ({ v: label, s: STYLE.header })));
  if (attention.length) attention.forEach((item) => push(...item));
  else push({ v: "No failures or warnings", s: STYLE.pass });
  push();

  const warnings = brokers.flatMap((profile) => profile.warnings.map((warning) => [profile.hostname, warning]));
  if (warnings.length) {
    push({ v: "Upload warnings", s: STYLE.label });
    warnings.forEach((item) => push(...item));
    push();
  }

  push({ v: "Legend", s: STYLE.label });
  push({ v: STATUS_LABEL.pass, s: STYLE.pass }, "Evidence found and it meets the expected result");
  push({ v: STATUS_LABEL.warn, s: STYLE.warn }, "Evidence found; needs attention or justification");
  push({ v: STATUS_LABEL.fail, s: STYLE.fail }, "Evidence found and it contradicts the expected result");
  push({ v: STATUS_LABEL.info, s: STYLE.info }, "Evidence captured; compare against the design specification");
  push({ v: STATUS_LABEL.manual, s: STYLE.manual }, "No CLI evidence can answer this item; verify by procedure");
  push({ v: STATUS_LABEL.na, s: STYLE.na }, "Not applicable to this broker (role or feature not in use)");
  push({ v: STATUS_LABEL.missing, s: STYLE.missing }, "The CLI sections for this item were not uploaded");

  return {
    name: "Summary",
    rows,
    colWidths: [30, 18, 16, 16, 16, 16, 26, 12, 34, 18, 40],
    freeze: { rows: 0, cols: 0 },
    showGridLines: false,
  };
}

function supplementalSheet() {
  const commands = supplementalCommandsFor(CHECKS);
  const rows = [
    [{ v: "Supplemental CLI commands", s: STYLE.title }],
    [{ v: "gather-diagnostics does not collect these sections. Run them on each broker, save the transcript (the prompt line 'hostname> show ...' must precede each output) and upload it as a supplemental file.", s: STYLE.subtle }],
    [],
    [{ v: "Command", s: STYLE.header }, { v: "Used by checks", s: STYLE.header }],
  ];
  for (const command of commands) {
    const refs = CHECKS.filter((check) => (check.commands || []).some((entry) => entry.split("|")[0].trim() === command)).map((check) => check.ref);
    rows.push([{ v: command, s: STYLE.mono }, refs.join(", ")]);
  }
  return { name: "Supplemental Commands", rows, colWidths: [60, 40], showGridLines: false };
}

/** Builds the workbook bytes for a checklist. */
function buildWorkbook(checklist, targets, generatedAt = new Date()) {
  return createWorkbook(
    [summarySheet(checklist, targets, generatedAt), checklistSheet(checklist), supplementalSheet()],
    { title: "Solace Ops Readiness Checklist", creator: "Solace Readiness Checklist Builder", created: generatedAt },
  );
}

/** Plain-text command list for the supplemental collection script. */
function supplementalCommandScript() {
  const commands = supplementalCommandsFor(CHECKS);
  return [
    "! Supplemental show commands for the Solace Ops Readiness Checklist.",
    "! Run these in a CLI session on each broker and save the whole terminal transcript",
    "! (e.g. enable session logging in your SSH client before pasting them).",
    "! The tool matches each output to the 'hostname> show ...' prompt line that precedes it.",
    "no paging",
    ...commands,
    "",
  ].join("\n");
}

function workbookFileName(checklist, generatedAt = new Date()) {
  const stamp = generatedAt.toISOString().slice(0, 10);
  const hosts = checklist.brokers.map((profile) => profile.hostname).slice(0, 3).join("_");
  return `SolaceReadinessChecklist_${hosts || "empty"}_${stamp}.xlsx`;
}

// ---- src/ui.js --------------------------------------------------------------
// Browser UI: upload management, broker cards, design targets, preview table and downloads.
// All DOM access is scoped to the root element passed to createApp().


const TARGETS_KEY = "solace-readiness.targets";
const SKIP_DIRS = new Set(["usr", "var", "tmp", "etc", "opt", "proc", "sys", "lib", "bin", "node_modules", ".git"]);
const BINARY_EXT = /\.(tgz|gz|zip|tar|xz|bz2|7z|bin|pdf|docx?|xlsx?|pptx?|png|jpe?g|gif|mp4|md5sum|json)$/i;
const MAX_FILE_BYTES = 40 * 1024 * 1024;
const ROLE_CLASS = { Primary: "role-primary", Backup: "role-backup", Monitor: "role-monitor", Standalone: "role-standalone", Unknown: "role-unknown" };

function createApp(root) {
  const $ = (selector) => root.querySelector(selector);
  const el = {
    diagPick: $("#diagPick"),
    configPick: $("#configPick"),
    diagName: $("#diagName"),
    configName: $("#configName"),
    hostnameInput: $("#hostnameInput"),
    addBroker: $("#addBrokerButton"),
    dropzone: $("#dropzone"),
    fileInput: $("#fileInput"),
    folderInput: $("#folderInput"),
    slotInput: $("#slotInput"),
    brokerGrid: $("#brokerGrid"),
    unassigned: $("#unassigned"),
    unassignedList: $("#unassignedList"),
    ignored: $("#ignoredFiles"),
    targetVersion: $("#targetVersion"),
    targetConnections: $("#targetConnections"),
    targetSpool: $("#targetSpool"),
    summary: $("#summaryStrip"),
    filters: $("#filters"),
    search: $("#search"),
    tableHead: $("#tableHead"),
    tableBody: $("#tableBody"),
    tableMeta: $("#tableMeta"),
    download: $("#downloadButton"),
    downloadScript: $("#downloadScriptButton"),
    clear: $("#clearButton"),
    status: $("#status"),
    emptyState: $("#emptyState"),
  };

  const state = {
    brokers: new Map(),
    unassigned: [],
    ignored: [],
    targets: loadTargets(),
    filter: "all",
    search: "",
    checklist: null,
    pendingSlot: null,
    fileCounter: 0,
    form: { diagnostics: null, config: null, detectedHostname: "" },
  };

  // ---- Persistence --------------------------------------------------------------------------

  function loadTargets() {
    try {
      const raw = globalThis.localStorage?.getItem(TARGETS_KEY);
      return raw ? { ...DEFAULT_TARGETS, ...JSON.parse(raw) } : { ...DEFAULT_TARGETS };
    } catch {
      return { ...DEFAULT_TARGETS };
    }
  }

  function saveTargets() {
    try {
      globalThis.localStorage?.setItem(TARGETS_KEY, JSON.stringify(state.targets));
    } catch {
      // Storage is a convenience only.
    }
  }

  // ---- Status line --------------------------------------------------------------------------

  function setStatus(message, tone = "") {
    el.status.textContent = message;
    el.status.className = `status${tone ? ` ${tone}` : ""}`;
  }

  // ---- File ingestion -----------------------------------------------------------------------

  async function readEntry(entry, depth, out) {
    if (entry.isFile) {
      await new Promise((resolve) => entry.file((file) => {
        out.push({ file, path: entry.fullPath || file.name });
        resolve();
      }, () => resolve()));
      return;
    }
    if (entry.isDirectory) {
      if (depth > 0 && SKIP_DIRS.has(entry.name.toLowerCase())) return;
      if (depth > 3) return;
      const reader = entry.createReader();
      const entries = [];
      // readEntries returns batches; keep reading until an empty batch.
      for (;;) {
        const batch = await new Promise((resolve) => reader.readEntries(resolve, () => resolve([])));
        if (!batch.length) break;
        entries.push(...batch);
      }
      for (const child of entries) await readEntry(child, depth + 1, out);
    }
  }

  async function collectDropped(dataTransfer) {
    const out = [];
    const items = dataTransfer.items ? [...dataTransfer.items] : [];
    const entries = items.map((item) => (typeof item.webkitGetAsEntry === "function" ? item.webkitGetAsEntry() : null));
    if (entries.some(Boolean)) {
      for (const entry of entries) if (entry) await readEntry(entry, 0, out);
    } else {
      for (const file of dataTransfer.files || []) out.push({ file, path: file.webkitRelativePath || file.name });
    }
    return out;
  }

  function shouldSkip(file, path) {
    if (BINARY_EXT.test(file.name)) return "binary or non-CLI file";
    if (file.size > MAX_FILE_BYTES) return "larger than 40 MB";
    const parts = String(path).split(/[\\/]/).filter(Boolean);
    if (parts.slice(0, -1).some((part) => SKIP_DIRS.has(part.toLowerCase()))) return "inside a system folder of the bundle";
    return "";
  }

  async function ingest(items, forcedSlot = null) {
    const added = [];
    const replaced = [];
    const unassigned = [];
    const ignored = [];

    for (const { file, path } of items) {
      const skipReason = shouldSkip(file, path);
      if (skipReason) {
        ignored.push({ name: file.name, reason: skipReason });
        continue;
      }
      let text;
      try {
        text = await file.text();
      } catch (error) {
        ignored.push({ name: file.name, reason: `could not read (${error.message})` });
        continue;
      }
      const kind = forcedSlot?.kind || classifyFile(file.name, text);
      if (kind === "other") {
        ignored.push({ name: file.name, reason: "not a cli-diagnostics, config or show-command transcript" });
        continue;
      }
      const record = { id: `f${++state.fileCounter}`, name: file.name, path, kind, text, size: file.size };
      const hostname = forcedSlot?.hostname || detectHostname(kind, text, path);
      if (!hostname) {
        unassigned.push(record);
        continue;
      }
      const outcome = attach(hostname, record);
      (outcome === "replaced" ? replaced : added).push(`${hostname} ← ${FILE_KINDS[kind].short}`);
    }

    state.unassigned.push(...unassigned);
    state.ignored = ignored;
    rebuild();

    const parts = [];
    if (added.length) parts.push(`Added ${added.join(", ")}.`);
    if (replaced.length) parts.push(`Replaced ${replaced.join(", ")}.`);
    if (unassigned.length) parts.push(`${unassigned.length} file(s) need a broker assignment.`);
    if (ignored.length) parts.push(`${ignored.length} file(s) ignored.`);
    if (!parts.length) parts.push("No usable files found.");
    setStatus(parts.join(" "), unassigned.length || (!added.length && !replaced.length) ? "warn" : "ok");
  }

  // ---- Add-a-broker form ------------------------------------------------------------------

  function showPicked(node, file) {
    node.textContent = file ? `${file.name} (${formatBytes(file.size)})` : "No file selected";
    node.classList.toggle("empty", !file);
  }

  async function onDiagnosticsPicked() {
    const file = el.diagPick.files[0] || null;
    state.form.diagnostics = file;
    showPicked(el.diagName, file);
    el.addBroker.disabled = !file;
    if (!file) return;
    try {
      const text = await file.text();
      const kind = classifyFile(file.name, text);
      if (kind !== "diagnostics" && kind !== "supplemental") {
        setStatus(`${file.name} does not look like cli-diagnostics.txt (no "# CLI command:" sections).`, "warn");
        return;
      }
      const detected = detectHostname("diagnostics", text, file.webkitRelativePath || file.name);
      state.form.detectedHostname = detected;
      if (!el.hostnameInput.value.trim() || el.hostnameInput.dataset.auto === "1") {
        el.hostnameInput.value = detected;
        el.hostnameInput.dataset.auto = "1";
      }
      setStatus(detected ? `Detected broker ${detected}. Add the config export if you have it, then click Add broker.` : "Hostname not found in the file; type it in the Hostname field.", detected ? "ok" : "warn");
    } catch (error) {
      setStatus(`Could not read ${file.name}: ${error.message}`, "warn");
    }
  }

  function onConfigPicked() {
    const file = el.configPick.files[0] || null;
    state.form.config = file;
    showPicked(el.configName, file);
  }

  async function addBrokerFromForm() {
    const diagnosticsFile = state.form.diagnostics;
    if (!diagnosticsFile) {
      setStatus("Select the broker's cli-diagnostics.txt first.", "warn");
      return;
    }
    const hostname = el.hostnameInput.value.trim() || state.form.detectedHostname;
    if (!hostname) {
      setStatus("Enter the broker hostname; it could not be detected from the file.", "warn");
      el.hostnameInput.focus();
      return;
    }
    if (shouldSkip(diagnosticsFile, diagnosticsFile.name)) {
      setStatus(`${diagnosticsFile.name}: ${shouldSkip(diagnosticsFile, diagnosticsFile.name)}.`, "warn");
      return;
    }

    setStatus("Reading files…");
    const diagnosticsText = await diagnosticsFile.text();
    const replaced = state.brokers.get(hostname)?.files.diagnostics ? "replaced" : "added";
    attach(hostname, { id: `f${++state.fileCounter}`, name: diagnosticsFile.name, path: diagnosticsFile.name, kind: "diagnostics", text: diagnosticsText, size: diagnosticsFile.size });

    const notes = [`${hostname}: diagnostics ${replaced}`];
    const configFile = state.form.config;
    if (configFile) {
      const configText = await configFile.text();
      const kind = classifyFile(configFile.name, configText);
      if (kind === "diagnostics" || kind === "supplemental") {
        notes.push(`${configFile.name} looks like CLI output, not a current-config export; it was attached as a supplemental transcript`);
        attach(hostname, { id: `f${++state.fileCounter}`, name: configFile.name, path: configFile.name, kind: "supplemental", text: configText, size: configFile.size });
      } else {
        attach(hostname, { id: `f${++state.fileCounter}`, name: configFile.name, path: configFile.name, kind: "config", text: configText, size: configFile.size });
        notes.push("config attached");
      }
    }

    resetForm();
    rebuild();
    setStatus(`${notes.join("; ")}.`, "ok");
  }

  function resetForm() {
    state.form = { diagnostics: null, config: null, detectedHostname: "" };
    el.diagPick.value = "";
    el.configPick.value = "";
    el.hostnameInput.value = "";
    el.hostnameInput.dataset.auto = "1";
    showPicked(el.diagName, null);
    showPicked(el.configName, null);
    el.addBroker.disabled = true;
  }

  function attach(hostname, record) {
    let broker = state.brokers.get(hostname);
    if (!broker) {
      broker = createBroker(hostname);
      state.brokers.set(hostname, broker);
    }
    const replaced = record.kind !== "supplemental" && broker.files[record.kind] !== null;
    attachFile(broker, record);
    return replaced ? "replaced" : "added";
  }

  // ---- Rebuild & render ---------------------------------------------------------------------

  function rebuild() {
    for (const [hostname, broker] of [...state.brokers]) {
      if (!brokerHasFiles(broker)) state.brokers.delete(hostname);
    }
    const profiles = [...state.brokers.values()].map((broker) => buildProfile(broker));
    state.checklist = buildChecklist(profiles, state.targets);
    renderBrokers(state.checklist.brokers);
    renderUnassigned();
    renderIgnored();
    renderSummary();
    renderTable();
    const hasData = state.brokers.size > 0;
    el.download.disabled = !hasData;
    el.clear.disabled = !hasData && !state.unassigned.length;
    el.emptyState.hidden = hasData;
  }

  function renderBrokers(profiles) {
    el.brokerGrid.textContent = "";
    if (!profiles.length) {
      el.brokerGrid.hidden = true;
      return;
    }
    el.brokerGrid.hidden = false;
    const counts = state.checklist.summary.perBroker;
    for (const profile of profiles) {
      const broker = state.brokers.get(profile.hostname);
      const card = document.createElement("article");
      card.className = "broker-card";

      const head = document.createElement("header");
      const title = document.createElement("h3");
      title.textContent = profile.hostname;
      const badge = document.createElement("span");
      badge.className = `badge ${ROLE_CLASS[profile.role] || "role-unknown"}`;
      badge.textContent = profile.role === "Unknown" ? "Role unknown" : profile.role;
      head.append(title, badge);

      const meta = document.createElement("dl");
      meta.className = "meta";
      const metaPairs = [
        ["Version", profile.version || "—"],
        ["Activity", profile.activity || (profile.redundancyStatus ? `Redundancy ${profile.redundancyStatus}` : "—")],
        ["Uptime", profile.uptime || "—"],
        ["Snapshot", profile.snapshot ? formatDate(profile.snapshot) : "unknown"],
        ["Mgmt IP", profile.managementIps.join(", ") || "—"],
      ];
      for (const [label, value] of metaPairs) {
        const dt = document.createElement("dt");
        dt.textContent = label;
        const dd = document.createElement("dd");
        dd.textContent = value;
        meta.append(dt, dd);
      }

      const slots = document.createElement("div");
      slots.className = "slots";
      slots.append(
        slot(profile.hostname, "diagnostics", broker.files.diagnostics),
        slot(profile.hostname, "config", broker.files.config),
        supplementalSlot(profile.hostname, broker.files.supplemental),
      );

      const results = document.createElement("div");
      results.className = "mini-counts";
      const c = counts[profile.hostname];
      for (const status of [STATUS.FAIL, STATUS.WARN, STATUS.MISSING, STATUS.PASS]) {
        const pill = document.createElement("span");
        pill.className = `pill pill-${status}`;
        pill.textContent = `${c[status]} ${STATUS_LABEL[status]}`;
        results.append(pill);
      }

      const actions = document.createElement("div");
      actions.className = "card-actions";
      const rename = button("Rename", "ghost", () => {
        const next = globalThis.prompt?.("Broker hostname", profile.hostname);
        if (!next || next.trim() === profile.hostname) return;
        renameBroker(profile.hostname, next.trim());
      });
      const remove = button("Remove broker", "ghost danger", () => {
        state.brokers.delete(profile.hostname);
        rebuild();
        setStatus(`Removed ${profile.hostname}.`);
      });
      actions.append(rename, remove);

      card.append(head, meta, slots, results, actions);
      if (profile.warnings.length) {
        const warn = document.createElement("p");
        warn.className = "card-warning";
        warn.textContent = profile.warnings.join(" ");
        card.append(warn);
      }
      el.brokerGrid.append(card);
    }
  }

  function slot(hostname, kind, file) {
    const wrap = document.createElement("div");
    wrap.className = `slot${file ? " filled" : ""}`;
    const label = document.createElement("span");
    label.className = "slot-label";
    label.textContent = FILE_KINDS[kind].short;
    const value = document.createElement("span");
    value.className = "slot-value";
    value.textContent = file ? file.name : `No ${FILE_KINDS[kind].label}`;
    value.title = file ? `${file.name} (${formatBytes(file.size)})` : "";
    wrap.append(label, value);
    const controls = document.createElement("span");
    controls.className = "slot-controls";
    controls.append(button(file ? "Replace" : "Add", "ghost small", () => pickForSlot(hostname, kind)));
    if (file) controls.append(button("×", "ghost small icon", () => {
      detachFile(state.brokers.get(hostname), kind, file.name);
      rebuild();
    }, "Remove file"));
    wrap.append(controls);
    return wrap;
  }

  function supplementalSlot(hostname, files) {
    const wrap = document.createElement("div");
    wrap.className = `slot${files.length ? " filled" : ""}`;
    const label = document.createElement("span");
    label.className = "slot-label";
    label.textContent = FILE_KINDS.supplemental.short;
    const value = document.createElement("span");
    value.className = "slot-value";
    if (!files.length) value.textContent = "No supplemental transcript";
    else {
      for (const file of files) {
        const chip = document.createElement("span");
        chip.className = "chip";
        chip.textContent = file.name;
        const x = button("×", "chip-remove", () => {
          detachFile(state.brokers.get(hostname), "supplemental", file.name);
          rebuild();
        }, "Remove file");
        chip.append(x);
        value.append(chip);
      }
    }
    wrap.append(label, value);
    const controls = document.createElement("span");
    controls.className = "slot-controls";
    controls.append(button("Add", "ghost small", () => pickForSlot(hostname, "supplemental")));
    wrap.append(controls);
    return wrap;
  }

  function pickForSlot(hostname, kind) {
    state.pendingSlot = { hostname, kind };
    el.slotInput.value = "";
    el.slotInput.click();
  }

  function renameBroker(from, to) {
    if (state.brokers.has(to)) {
      setStatus(`A broker named ${to} already exists.`, "warn");
      return;
    }
    const broker = state.brokers.get(from);
    state.brokers.delete(from);
    broker.hostname = to;
    state.brokers.set(to, broker);
    rebuild();
  }

  function renderUnassigned() {
    el.unassignedList.textContent = "";
    el.unassigned.hidden = !state.unassigned.length;
    if (!state.unassigned.length) return;
    const hostnames = [...state.brokers.keys()];
    for (const record of state.unassigned) {
      const row = document.createElement("div");
      row.className = "unassigned-row";
      const name = document.createElement("span");
      name.className = "file-name";
      name.textContent = `${record.name}`;
      const kind = document.createElement("span");
      kind.className = "chip kind";
      kind.textContent = FILE_KINDS[record.kind].short;
      const select = document.createElement("select");
      for (const hostname of hostnames) {
        const option = document.createElement("option");
        option.value = hostname;
        option.textContent = hostname;
        select.append(option);
      }
      const custom = document.createElement("option");
      custom.value = "__new__";
      custom.textContent = "New broker…";
      select.append(custom);
      if (!hostnames.length) select.value = "__new__";
      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = "hostname";
      input.hidden = select.value !== "__new__";
      select.addEventListener("change", () => {
        input.hidden = select.value !== "__new__";
      });
      const assign = button("Assign", "primary small", () => {
        const hostname = select.value === "__new__" ? input.value.trim() : select.value;
        if (!hostname) {
          setStatus("Enter a hostname for the new broker.", "warn");
          return;
        }
        attach(hostname, record);
        state.unassigned = state.unassigned.filter((item) => item.id !== record.id);
        rebuild();
        setStatus(`Assigned ${record.name} to ${hostname}.`, "ok");
      });
      const drop = button("Discard", "ghost small", () => {
        state.unassigned = state.unassigned.filter((item) => item.id !== record.id);
        rebuild();
      });
      row.append(name, kind, select, input, assign, drop);
      el.unassignedList.append(row);
    }
  }

  function renderIgnored() {
    el.ignored.textContent = "";
    el.ignored.hidden = !state.ignored.length;
    if (!state.ignored.length) return;
    const summary = document.createElement("summary");
    summary.textContent = `${state.ignored.length} file(s) ignored`;
    el.ignored.append(summary);
    const list = document.createElement("ul");
    for (const item of state.ignored.slice(0, 50)) {
      const li = document.createElement("li");
      li.textContent = `${item.name} — ${item.reason}`;
      list.append(li);
    }
    el.ignored.append(list);
  }

  function renderSummary() {
    el.summary.textContent = "";
    const total = state.checklist.summary.total;
    const brokers = state.checklist.brokers.length;
    const head = document.createElement("div");
    head.className = "summary-head";
    head.textContent = brokers ? `${brokers} broker${brokers === 1 ? "" : "s"} analysed` : "No brokers yet";
    el.summary.append(head);
    for (const status of [STATUS.FAIL, STATUS.WARN, STATUS.MISSING, STATUS.INFO, STATUS.PASS, STATUS.MANUAL, STATUS.NA]) {
      const pill = button(`${total[status]} ${STATUS_LABEL[status]}`, `pill pill-${status}${state.filter === status ? " active" : ""}`, () => {
        state.filter = state.filter === status ? "all" : status;
        renderFilters();
        renderTable();
      });
      pill.disabled = !brokers;
      el.summary.append(pill);
    }
  }

  function renderFilters() {
    for (const chip of el.filters.querySelectorAll("[data-filter]")) {
      chip.classList.toggle("active", chip.dataset.filter === state.filter);
    }
    for (const pill of el.summary.querySelectorAll(".pill")) {
      const status = [...pill.classList].find((name) => name.startsWith("pill-"))?.slice(5);
      pill.classList.toggle("active", status === state.filter);
    }
  }

  function rowVisible(row) {
    if (row.kind !== "check") return true;
    const worst = rowWorstStatus(row);
    if (state.filter === "attention" && !needsAttention(worst) && !Object.values(row.cells).some((cell) => needsAttention(cell.status))) return false;
    if (state.filter !== "all" && state.filter !== "attention" && !Object.values(row.cells).some((cell) => cell.status === state.filter)) return false;
    if (state.search) {
      const haystack = [row.ref, row.check, row.description, row.expected, ...Object.values(row.cells).flatMap((cell) => [cell.note, cell.output])].join("\n").toLowerCase();
      if (!haystack.includes(state.search)) return false;
    }
    return true;
  }

  function renderTable() {
    const { brokers, rows } = state.checklist;
    el.tableHead.textContent = "";
    el.tableBody.textContent = "";

    const head1 = document.createElement("tr");
    const head2 = document.createElement("tr");
    for (const label of ["#", "Control Item", "Control Statement", "Passing Criteria"]) {
      const th = document.createElement("th");
      th.rowSpan = 2;
      th.textContent = label;
      head1.append(th);
    }
    const software = document.createElement("th");
    software.colSpan = 2;
    software.textContent = "Software Broker";
    head1.append(software);
    for (const label of ["Validation Method", "Expected Result"]) {
      const th = document.createElement("th");
      th.textContent = label;
      head2.append(th);
    }
    const visibleBrokers = brokers.length ? brokers : [null];
    for (const profile of visibleBrokers) {
      const th = document.createElement("th");
      th.className = "broker-head";
      th.textContent = profile ? profile.hostname : "Broker";
      if (profile && profile.role !== "Unknown") {
        const badge = document.createElement("span");
        badge.className = `badge ${ROLE_CLASS[profile.role]}`;
        badge.textContent = profile.role;
        th.append(" ", badge);
      }
      head1.append(th);
      const th2 = document.createElement("th");
      th2.textContent = "Result / Actual Output";
      head2.append(th2);
    }
    el.tableHead.append(head1, head2);

    let visibleChecks = 0;
    let pendingGroup = null;
    let pendingCategory = null;
    const fragment = document.createDocumentFragment();
    const totalColumns = 6 + visibleBrokers.length;

    for (const row of rows) {
      if (row.kind === "group") {
        pendingGroup = row;
        pendingCategory = null;
        continue;
      }
      if (row.kind === "category") {
        pendingCategory = row;
        continue;
      }
      if (!rowVisible(row)) continue;
      if (pendingGroup) {
        fragment.append(headingRow(pendingGroup, "group-row", totalColumns));
        pendingGroup = null;
      }
      if (pendingCategory) {
        fragment.append(headingRow(pendingCategory, "category-row", totalColumns));
        pendingCategory = null;
      }
      visibleChecks += 1;
      const tr = document.createElement("tr");
      tr.className = "check-row";
      for (const value of [row.ref, row.check, row.description, row.requirement]) {
        const td = document.createElement("td");
        td.textContent = value;
        tr.append(td);
      }
      for (const value of [row.source, row.expected]) {
        const td = document.createElement("td");
        td.className = "pre-cell";
        td.textContent = value;
        tr.append(td);
      }
      for (const profile of visibleBrokers) {
        const td = document.createElement("td");
        td.className = "result-cell";
        if (profile) td.append(resultCell(row.cells[profile.hostname]));
        tr.append(td);
      }
      fragment.append(tr);
    }
    el.tableBody.append(fragment);

    const totalChecks = rows.filter((row) => row.kind === "check").length;
    el.tableMeta.textContent = `${visibleChecks} of ${totalChecks} checks shown`;
  }

  function headingRow(row, className, span) {
    const tr = document.createElement("tr");
    tr.className = className;
    const ref = document.createElement("td");
    ref.textContent = row.ref;
    const title = document.createElement("td");
    title.colSpan = span - 1;
    title.textContent = row.check.replace(/^(Group|Category):\s*/, "");
    tr.append(ref, title);
    return tr;
  }

  function resultCell(cell) {
    const wrap = document.createElement("div");
    wrap.className = "result";
    if (!cell) return wrap;
    const top = document.createElement("div");
    top.className = "result-top";
    const pill = document.createElement("span");
    pill.className = `pill pill-${cell.status}`;
    pill.textContent = STATUS_LABEL[cell.status] || cell.status;
    top.append(pill);
    if (cell.source) {
      const source = document.createElement("span");
      source.className = "source";
      source.textContent = cell.source;
      top.append(source);
    }
    wrap.append(top);
    if (cell.note) {
      const note = document.createElement("p");
      note.className = "note";
      note.textContent = cell.note;
      wrap.append(note);
    }
    if (cell.output) {
      const lines = cell.output.split("\n").length;
      const pre = document.createElement("pre");
      pre.textContent = cell.output;
      if (lines > 10) {
        const details = document.createElement("details");
        const summary = document.createElement("summary");
        summary.textContent = `Show output (${lines} lines)`;
        details.append(summary, pre);
        wrap.append(details);
      } else {
        wrap.append(pre);
      }
    }
    return wrap;
  }

  // ---- Downloads ----------------------------------------------------------------------------

  function download(bytes, name, type) {
    const blob = new Blob([bytes], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    root.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ---- Wiring -------------------------------------------------------------------------------

  function bind() {
    el.diagPick.addEventListener("change", onDiagnosticsPicked);
    el.configPick.addEventListener("change", onConfigPicked);
    el.hostnameInput.dataset.auto = "1";
    el.hostnameInput.addEventListener("input", () => {
      el.hostnameInput.dataset.auto = el.hostnameInput.value.trim() ? "0" : "1";
    });
    el.addBroker.addEventListener("click", () => {
      addBrokerFromForm().catch((error) => setStatus(`Could not add broker: ${error.message}`, "warn"));
    });

    for (const eventName of ["dragenter", "dragover"]) {
      el.dropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        el.dropzone.classList.add("drag");
      });
    }
    for (const eventName of ["dragleave", "drop"]) {
      el.dropzone.addEventListener(eventName, () => el.dropzone.classList.remove("drag"));
    }
    el.dropzone.addEventListener("drop", async (event) => {
      event.preventDefault();
      setStatus("Reading files…");
      const items = await collectDropped(event.dataTransfer);
      await ingest(items);
    });
    el.fileInput.addEventListener("change", async () => {
      const items = [...el.fileInput.files].map((file) => ({ file, path: file.webkitRelativePath || file.name }));
      el.fileInput.value = "";
      await ingest(items);
    });
    el.folderInput.addEventListener("change", async () => {
      const items = [...el.folderInput.files].map((file) => ({ file, path: file.webkitRelativePath || file.name }));
      el.folderInput.value = "";
      setStatus(`Reading ${items.length} file(s) from folder…`);
      await ingest(items);
    });
    el.slotInput.addEventListener("change", async () => {
      const slotTarget = state.pendingSlot;
      state.pendingSlot = null;
      const items = [...el.slotInput.files].map((file) => ({ file, path: file.name }));
      el.slotInput.value = "";
      if (!slotTarget || !items.length) return;
      await ingest(items.slice(0, slotTarget.kind === "supplemental" ? items.length : 1), slotTarget);
    });

    const targetInputs = [
      [el.targetVersion, "version"],
      [el.targetConnections, "maxConnections"],
      [el.targetSpool, "spoolMb"],
    ];
    for (const [input, key] of targetInputs) {
      input.value = state.targets[key] || "";
      input.addEventListener("input", () => {
        state.targets[key] = input.value.trim();
        saveTargets();
        rebuild();
      });
    }

    for (const chip of el.filters.querySelectorAll("[data-filter]")) {
      chip.addEventListener("click", () => {
        state.filter = chip.dataset.filter;
        renderFilters();
        renderTable();
      });
    }
    el.search.addEventListener("input", () => {
      state.search = el.search.value.trim().toLowerCase();
      renderTable();
    });

    el.download.addEventListener("click", () => {
      const now = new Date();
      const bytes = buildWorkbook(state.checklist, state.targets, now);
      download(bytes, workbookFileName(state.checklist, now), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      setStatus("Workbook downloaded.", "ok");
    });
    el.downloadScript.addEventListener("click", () => {
      download(new TextEncoder().encode(supplementalCommandScript()), "supplemental-commands.txt", "text/plain");
    });
    el.clear.addEventListener("click", () => {
      state.brokers.clear();
      state.unassigned = [];
      state.ignored = [];
      state.filter = "all";
      state.search = "";
      el.search.value = "";
      resetForm();
      rebuild();
      renderFilters();
      setStatus("Cleared. Add a broker's cli-diagnostics.txt to start again.");
    });
  }

  function button(label, className, onClick, title = "") {
    const node = document.createElement("button");
    node.type = "button";
    node.className = className;
    node.textContent = label;
    if (title) node.title = title;
    node.addEventListener("click", onClick);
    return node;
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes)) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  bind();
  rebuild();
  renderFilters();
  setStatus("Choose a broker's cli-diagnostics.txt to begin. The current-config export is optional.");

  return { state, rebuild, ingest };
}

// ---- src/main.js ------------------------------------------------------------
const root = document.querySelector("#app");
if (root) {
  globalThis.solaceReadiness = createApp(root);
}

})();
