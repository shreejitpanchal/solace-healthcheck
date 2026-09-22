# Architecture

The tool is a static, single-page browser application with no runtime dependencies.
Source lives in `src/` as ES modules so it can be unit-tested in Node; for the browser a
build step concatenates the modules into one classic script (`app.js`) so `index.html` works
when opened from disk as well as over HTTP.

## Module map

```
index.html                  page shell: Add-a-broker form, bulk import, design targets, results table
styles.css                  Solace 2025 theme (light content, dark code blocks)
app.js                      GENERATED bundle of src/ (scripts/build.mjs) - never edit by hand
run-healthcheck.sh            launcher: build, serve (or open from disk), optional lint+tests

src/main.js                 entry point: createApp(document.querySelector("#app"))
src/ui.js                   DOM only: file pickers, drop zone, broker cards, targets, table, downloads
src/checks.js               CHECKS data (checklist rows) + ref helpers; generated once from the legacy list
src/sections.js             CLI section extraction (gather-diagnostics headers, prompt transcripts) + body helpers
src/config-parser.js        current-config tree parser, credential redaction, fact extraction
src/broker.js               file classification, hostname detection, broker profile (role, version, snapshot)
src/analyzers.js            per-check verdict logic keyed by ref; default outcome; supplemental command list
src/checklist.js            buildChecklist(profiles, targets) -> rows with one cell per broker; summary counts
src/report.js               workbook sheets (Summary, Readiness Checklist, Supplemental Commands)
src/xlsx.js                 minimal XLSX/ZIP writer: fixed styles, freeze panes, autofilter, sanitising

scripts/build.mjs           bundler: dependency-ordered concatenation, import/export stripping, IIFE
scripts/lint.mjs            loads every module and syntax-checks app.js
scripts/serve.mjs           zero-dependency static server (127.0.0.1:8788)
scripts/dev.sh / dev.ps1    mirrored task runners: build, lint, test, all, serve (logs in scripts/logs/)
test/*.test.js              node:test suites; test/fixtures/ holds anonymised sample inputs
legacy/app.v1.js            the previous single-file implementation, read-only reference
```

Dependency order (also the bundle order): `sections -> checks -> config-parser -> broker ->
analyzers -> checklist -> xlsx -> report -> ui -> main`. Lower modules never import higher ones.

## Data flow

```
file (File API)
  -> classifyFile(name, text)            diagnostics | config | supplemental | other
  -> detectHostname(kind, text, path)    show hostname / "! Router:" / prompt / folder name
  -> broker { hostname, files: { diagnostics, config, supplemental[] } }
  -> buildProfile(broker)                sections (merged), config facts, role, version, snapshot, IPs
  -> buildChecklist(profiles, targets)   for each check x broker: analyzeCheck(check, ctx)
  -> UI table (ui.js)  and  buildWorkbook(checklist) (report.js -> xlsx.js)
```

Two ways to add a broker exist in the UI and converge on the same `attach()` call:

- **Add a broker** form: `cli-diagnostics.txt` (required) plus an optional current-config export.
  The hostname is read from the diagnostics on selection and can be edited. A "config" file that
  turns out to be CLI output is attached as a supplemental transcript instead.
- **Bulk import**: files or whole `gather-diagnostics_*` folders. Kind and hostname are detected
  per file; system folders (`usr/`, `var/`, `tmp/`, ...) and binary files are skipped; files
  without a detectable hostname go to an assignment tray.

## Inputs and section extraction

`parseSections` (sections.js) recognises two formats in the same file:

1. gather-diagnostics headers: a rule line of `#`, `# CLI command: <cmd>`, `# Host: <name>`, rule line.
2. CLI prompt lines: `hostname> show ...` or `hostname(configure)# show ...`.

Sections are keyed by the normalised command (single spaces, lower case). A check lists its
evidence in `commands`; each entry may hold alternatives separated by `|`, first match wins.
Supplemental transcripts are merged over the diagnostics, and `profile.sectionSources` records
where each section came from so the UI can label the source.

## Broker profile

`buildProfile` derives:

- **role**: `show redundancy detail` (`Configuration Status` Disabled -> Standalone,
  `Operating Mode` Monitoring Node -> Monitor, `Active-Standby Role` Primary/Backup), falling back
  to the `*` row of `show redundancy group`. Columns are sorted Primary, Backup, Monitor.
- **version / uptime / edition** from `show version`; **platform / POST** from hardware and POST.
- **snapshot time** from `show storage-element * detail` ("Last Refreshed"), then SMRP, SEMP
  session and RDP log timestamps. Certificate day counts are computed against this, not today.
- **management IPs** from `show ip vrf management`, used for SAN coverage.
- **config facts** from `extractConfigFacts` when a current-config export is attached; a router
  name mismatch becomes a profile warning shown on the card and in the Summary sheet.

## Analyzer contract

```js
ANALYZERS["1.2.3"] = (ctx) => result(status, output, note) | null;
// ctx = { check, profile, profiles, targets, now }
```

- Return `null` to fall back to `defaultOutcome`: dump the found sections as **Info**, or
  **Missing** with a hint that says whether the command belongs to gather-diagnostics or must be
  collected through the supplemental transcript.
- Helpers: `body(ctx, "show x|show y")`, `has(ctx, cmd)`, `configOnly(ctx)`, `kvLines`,
  `referenceDate(ctx)`, and from sections.js `valueOf`, `valuesOf`, `blockBetween`,
  `counterOf`, `parseFixedTable`.
- Analyzer exceptions are caught and surfaced as Info with an "Analyzer error" note, so one bad
  regex never blanks a whole column.
- Statuses: `pass`, `warn`, `fail`, `info`, `manual`, `na`, `missing` (see `STATUS` in
  analyzers.js). UI pills and workbook fills key off the same strings.
- Role awareness: HA-pair checks return `na` on Monitor and Standalone nodes; `1.2.3` expects
  `Enabled (Primary)` or `Enabled (Backup)` according to the detected role.
- Design targets (`version`, `maxConnections`, `spoolMb`) turn 1.1.5, 1.1.8 and 1.2.2 from
  Info into Pass/Fail when set.

## Config parser

`parseConfig` builds a tree from indentation (two spaces per level); `exit` lines are ignored and
`!` comment lines are collected separately (`! Router: "name"` gives the router name). Every
fact is read from an explicit path, so the `shutdown` of a client-username is never confused with
the `shutdown` of a message-vpn. `redactLine` masks password, secret and key values at parse
time, before anything can reach the table or the workbook.

## Workbook

`report.js` produces plain row arrays where a cell is a string or `{ v, s }` with `s` from
`STYLE`. `xlsx.js` knows nothing about the checklist. It writes inline strings, sanitises
XML-invalid characters, truncates to Excel's 32,767-character cell limit, freezes the two header
rows and first two columns, and puts the autofilter on row 2 (no vertical merges there). Fill
colours follow the Solace palette; Fail uses a soft red because the palette has no red.

## Build

`scripts/build.mjs` concatenates the modules in dependency order, drops relative `import`
lines, strips the `export` keyword from named declarations and wraps everything in one strict-mode
IIFE. Consequences for authors:

- top-level names must be unique across all modules (the build fails loudly otherwise);
- only relative `./x.js` imports and named `export function|const|let|class` are supported;
- `app.js` must be regenerated after any change under `src/` (`scripts/dev.sh build`,
  `run-healthcheck.sh` or `scripts/dev.sh all` do it).

## Adding a check

1. Append a row to `CHECKS` in `src/checks.js` with a unique three-segment `ref` under the right
   category. List the evidence in `commands` (alternatives separated by `|`).
2. If it can be judged automatically, add `ANALYZERS[ref]` in `src/analyzers.js`.
3. If the command is produced by the standard bundle, add it to `GATHER_DIAGNOSTICS_COMMANDS`
   so the Missing hint is accurate; otherwise nothing else is needed, it joins the supplemental
   command list automatically.
4. Add the section to `test/fixtures/cli-diagnostics.sample.txt` (anonymised) and an assertion in
   `test/analyzers.test.js`.
5. Run `scripts/dev.sh all` (rebuilds `app.js`, then lint and tests).

## Adding an input format

`classifyFile` (broker.js) decides the kind from content. Extend `PROMPT_COMMAND` in
sections.js for a new transcript style, or `CONFIG_HINT` in broker.js for a new config export
shape. Config syntax variations only need new regexes inside `extractConfigFacts`.
