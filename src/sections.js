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

export function normalizeNewlines(text) {
  return String(text ?? "").replace(/\r\n?/g, "\n");
}

export function normalizeCommand(command) {
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
export function parseSections(text) {
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
export function findSection(sections, entry) {
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
export function mergeSections(...maps) {
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
export function valueOf(body, label) {
  const pattern = new RegExp(`^\\s*${escapeRegExp(label)}\\s*:\\s*(.*?)\\s*$`, "im");
  const match = pattern.exec(body || "");
  return match ? match[1] : "";
}

/** All values for a repeated "Label :" line. */
export function valuesOf(body, label) {
  const pattern = new RegExp(`^\\s*${escapeRegExp(label)}\\s*:\\s*(.*?)\\s*$`, "gim");
  return [...(body || "").matchAll(pattern)].map((match) => match[1]);
}

/** Lines whose trimmed text starts with one of the prefixes, in original order. */
export function linesStartingWith(body, prefixes) {
  const list = Array.isArray(prefixes) ? prefixes : [prefixes];
  return (body || "").split("\n").filter((line) => {
    const trimmed = line.trim();
    return list.some((prefix) => trimmed.startsWith(prefix));
  });
}

/** Lines from the first line matching startRe up to (not including) the first later line matching stopRe. */
export function blockBetween(body, startRe, stopRe) {
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
export function counterOf(body, name) {
  const pattern = new RegExp(`^\\s*${escapeRegExp(name)}\\s*:?\\s+(\\d[\\d,]*)\\s*$`, "im");
  const match = pattern.exec(body || "");
  return match ? Number(match[1].replace(/,/g, "")) : null;
}

/** First and second numeric columns of a "Name   received   sent" statistics line. */
export function counterPairOf(body, name) {
  const pattern = new RegExp(`^\\s*${escapeRegExp(name)}\\s*:?\\s+(\\d[\\d,]*)\\s+(\\d[\\d,]*)\\s*$`, "im");
  const match = pattern.exec(body || "");
  return match ? [Number(match[1].replace(/,/g, "")), Number(match[2].replace(/,/g, ""))] : null;
}

/**
 * Parses a fixed-width CLI table. Column boundaries come from the dashed separator line
 * under the header when present (each run of dashes is one column), otherwise from the
 * header words (columns separated by two or more spaces). Rows end at the first blank line.
 */
export function parseFixedTable(body, headerRe) {
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
export function parseCliDate(text) {
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

export function formatDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return date.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
}

export function daysBetween(from, to) {
  if (!from || !to) return null;
  return Math.floor((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}
