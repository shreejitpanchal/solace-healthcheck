// Assembles the checklist rows for a set of broker profiles.

import { CHECKS, isGroupRef, isCategoryRef } from "./checks.js";
import { analyzeCheck, STATUS, STATUS_ORDER } from "./analyzers.js";
import { sortProfiles } from "./broker.js";

export const DEFAULT_TARGETS = { version: "", maxConnections: "", spoolMb: "" };

export function rowKind(ref) {
  if (isGroupRef(ref)) return "group";
  if (isCategoryRef(ref)) return "category";
  return "check";
}

/**
 * @param profiles  broker profiles from buildProfile()
 * @param targets   design targets { version, maxConnections, spoolMb }
 * @returns { brokers, rows, summary }
 */
export function buildChecklist(profiles, targets = DEFAULT_TARGETS, now = new Date()) {
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

export function emptyCounts() {
  return Object.fromEntries(Object.values(STATUS).map((status) => [status, 0]));
}

export function summarize(rows, brokers) {
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
export function rowWorstStatus(row) {
  const statuses = Object.values(row.cells).map((cell) => cell.status);
  for (const status of STATUS_ORDER) if (statuses.includes(status)) return status;
  return "";
}

export function needsAttention(status) {
  return status === STATUS.FAIL || status === STATUS.WARN || status === STATUS.MISSING;
}
