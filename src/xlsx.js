// Minimal XLSX writer (no dependencies): multiple sheets, styles, merges, freeze panes, autofilter.
//
// Cells are strings or { v: string, s: styleIndex }. Styles are fixed (see STYLE below).
// Text is sanitised for XML 1.0 and truncated to Excel's 32,767 character cell limit.

export const STYLE = {
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
export const CELL_LIMIT = 32767;

export function sanitizeCellText(value) {
  let text = String(value ?? "").replace(/\r\n?/g, "\n").replace(XML_INVALID, "");
  if (text.length > CELL_LIMIT) {
    const marker = "\n... [truncated to fit Excel cell limit]";
    text = `${text.slice(0, CELL_LIMIT - marker.length)}${marker}`;
  }
  return text;
}

export function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function columnName(index) {
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
export function createWorkbook(sheets, meta = {}) {
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

export function crc32(data) {
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

export function zipStore(files, date = new Date()) {
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
