import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createWorkbook, sanitizeCellText, escapeXml, columnName, CELL_LIMIT, STYLE } from "../src/xlsx.js";
import { buildWorkbook, supplementalCommandScript, workbookFileName } from "../src/report.js";
import { createBroker, attachFile, buildProfile } from "../src/broker.js";
import { buildChecklist } from "../src/checklist.js";

const diagnostics = readFileSync(new URL("./fixtures/cli-diagnostics.sample.txt", import.meta.url), "utf8");

function zipEntryCount(bytes) {
  // End of central directory record is the last 22 bytes when there is no comment.
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = bytes.length - 22;
  assert.equal(view.getUint32(eocd, true), 0x06054b50, "EOCD signature");
  return view.getUint16(eocd + 10, true);
}

function zipNames(bytes) {
  const decoder = new TextDecoder();
  const names = [];
  let offset = 0;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  while (view.getUint32(offset, true) === 0x04034b50) {
    const size = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    names.push(decoder.decode(bytes.subarray(offset + 30, offset + 30 + nameLength)));
    offset += 30 + nameLength + extraLength + size;
  }
  return names;
}

test("sanitizes XML-invalid characters and truncates to the Excel cell limit", () => {
  assert.equal(sanitizeCellText("a\u0000b\u001bc\td\ne"), "abc\td\ne");
  const long = "x".repeat(CELL_LIMIT + 500);
  const truncated = sanitizeCellText(long);
  assert.equal(truncated.length, CELL_LIMIT);
  assert.match(truncated, /truncated to fit Excel cell limit\]$/);
  assert.equal(escapeXml(`<a href="x">'&'</a>`), "&lt;a href=&quot;x&quot;&gt;&apos;&amp;&apos;&lt;/a&gt;");
});

test("column names follow Excel conventions", () => {
  assert.equal(columnName(1), "A");
  assert.equal(columnName(26), "Z");
  assert.equal(columnName(27), "AA");
  assert.equal(columnName(52), "AZ");
  assert.equal(columnName(53), "BA");
});

test("createWorkbook emits one worksheet part per sheet plus package parts", () => {
  const bytes = createWorkbook([
    { name: "One", rows: [[{ v: "Title", s: STYLE.title }], ["a", "b"]], freeze: { rows: 1, cols: 0 }, autoFilter: { fromRow: 1, toRow: 2, fromCol: 1, toCol: 2 } },
    { name: "Two/Invalid:Name?", rows: [["x"]] },
  ]);
  assert.equal(bytes[0], 0x50);
  assert.equal(bytes[1], 0x4b);
  const names = zipNames(bytes);
  assert.equal(zipEntryCount(bytes), names.length);
  assert.ok(names.includes("xl/worksheets/sheet1.xml"));
  assert.ok(names.includes("xl/worksheets/sheet2.xml"));
  assert.ok(names.includes("xl/styles.xml"));
  const text = new TextDecoder().decode(bytes);
  assert.match(text, /<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"\/>/);
  assert.match(text, /<autoFilter ref="A1:B2"\/>/);
  assert.match(text, /<sheet name="Two Invalid Name" sheetId="2"/);
});

test("buildWorkbook produces Summary, Checklist and Supplemental sheets with broker columns", () => {
  const broker = createBroker("brk-pri");
  attachFile(broker, { kind: "diagnostics", name: "cli-diagnostics.txt", text: diagnostics });
  const checklist = buildChecklist([buildProfile(broker)]);
  const bytes = buildWorkbook(checklist, { version: "10.25.0.148" }, new Date("2026-09-22T00:00:00Z"));
  const text = new TextDecoder().decode(bytes);
  assert.match(text, /<sheet name="Summary"/);
  assert.match(text, /<sheet name="Readiness Checklist"/);
  assert.match(text, /<sheet name="Supplemental Commands"/);
  assert.match(text, /brk-pri \(Primary\)/);
  assert.match(text, /Actual Output \/ Value/);
  assert.match(text, /Items needing attention/);
  assert.ok(!/[\u0000-\u0008]/.test(text), "no control characters in the package");
  assert.equal(workbookFileName(checklist, new Date("2026-09-22T00:00:00Z")), "SolaceReadinessChecklist_brk-pri_2026-09-22.xlsx");
});

test("supplemental command script lists commands gather-diagnostics does not collect", () => {
  const script = supplementalCommandScript();
  assert.match(script, /^show ldap-profile \* detail$/m);
  assert.match(script, /^show syslog$/m);
  assert.doesNotMatch(script, /^show version$/m);
  assert.doesNotMatch(script, /^show redundancy detail$/m);
});
