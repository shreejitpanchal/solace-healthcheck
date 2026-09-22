// Browser UI: upload management, broker cards, design targets, preview table and downloads.
// All DOM access is scoped to the root element passed to createApp().

import { classifyFile, detectHostname, createBroker, attachFile, detachFile, brokerHasFiles, buildProfile, FILE_KINDS } from "./broker.js";
import { buildChecklist, DEFAULT_TARGETS, rowWorstStatus, needsAttention } from "./checklist.js";
import { STATUS, STATUS_LABEL } from "./analyzers.js";
import { buildWorkbook, supplementalCommandScript, workbookFileName } from "./report.js";
import { formatDate } from "./sections.js";

const TARGETS_KEY = "solace-readiness.targets";
const SKIP_DIRS = new Set(["usr", "var", "tmp", "etc", "opt", "proc", "sys", "lib", "bin", "node_modules", ".git"]);
const BINARY_EXT = /\.(tgz|gz|zip|tar|xz|bz2|7z|bin|pdf|docx?|xlsx?|pptx?|png|jpe?g|gif|mp4|md5sum|json)$/i;
const MAX_FILE_BYTES = 40 * 1024 * 1024;
const ROLE_CLASS = { Primary: "role-primary", Backup: "role-backup", Monitor: "role-monitor", Standalone: "role-standalone", Unknown: "role-unknown" };

export function createApp(root) {
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
