// Parses a Solace "show current-config" export into a tree and extracts facts from it.
//
// The export is indentation based: a block opens with a line such as `message-vpn "SDEG"`
// and its children are indented by two more spaces; `exit` lines close blocks. Comment
// lines start with "!" and carry hints such as `! Router: "broker1"`.
//
// Rather than pattern-matching individual lines in isolation (which confuses e.g. the
// `shutdown` of a client-username with the `shutdown` of a message-vpn), the parser builds
// the tree and every fact is read from an explicit path.

import { normalizeNewlines } from "./sections.js";

const REDACT_RE = /\b(password|secret|passphrase|client-secret|pre-shared-key|shared-secret|private-key|key)\b(\s+)(\S.*)$/i;

/** Masks credential values on a config line so they never reach the sheet or the logs. */
export function redactLine(line) {
  return String(line).replace(REDACT_RE, (match, keyword, space) => `${keyword}${space}[redacted]`);
}

export function parseConfig(text) {
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
export function findNodes(node, pattern, { maxDepth = Infinity } = {}) {
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

export function child(node, pattern) {
  return node ? node.children.find((item) => pattern.test(item.text)) || null : null;
}

export function children(node, pattern) {
  return node ? node.children.filter((item) => pattern.test(item.text)) : [];
}

/** Captured group of the first child matching pattern, or "". */
export function childValue(node, pattern, group = 1) {
  const found = child(node, pattern);
  if (!found) return "";
  const match = pattern.exec(found.text);
  return match ? (match[group] ?? "").replace(/^"|"$/g, "") : "";
}

/** Renders a subtree as indented text. Long subtrees are truncated with a marker. */
export function flatten(node, { maxLines = 60, includeSelf = true } = {}) {
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
export function extractConfigFacts(config) {
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
