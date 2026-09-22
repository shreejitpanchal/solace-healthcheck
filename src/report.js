// Turns a checklist into workbook sheets (Summary, Readiness Checklist, Supplemental Commands).

import { STYLE, createWorkbook } from "./xlsx.js";
import { STATUS, STATUS_LABEL, supplementalCommandsFor } from "./analyzers.js";
import { CHECKS } from "./checks.js";
import { formatDate } from "./sections.js";

const BASE_COLUMNS = ["#", "Control Item", "Control Statement", "Passing Criteria", "Validation Method", "Expected Result"];
const BASE_WIDTHS = [8, 30, 52, 26, 30, 38];
const RESULT_WIDTH = 14;
const OUTPUT_WIDTH = 80;

export const STATUS_STYLE = {
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
export function buildWorkbook(checklist, targets, generatedAt = new Date()) {
  return createWorkbook(
    [summarySheet(checklist, targets, generatedAt), checklistSheet(checklist), supplementalSheet()],
    { title: "Solace Ops Readiness Checklist", creator: "Solace Readiness Checklist Builder", created: generatedAt },
  );
}

/** Plain-text command list for the supplemental collection script. */
export function supplementalCommandScript() {
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

export function workbookFileName(checklist, generatedAt = new Date()) {
  const stamp = generatedAt.toISOString().slice(0, 10);
  const hosts = checklist.brokers.map((profile) => profile.hostname).slice(0, 3).join("_");
  return `SolaceReadinessChecklist_${hosts || "empty"}_${stamp}.xlsx`;
}
