# Graph Report - readiness-checklist-automation  (2026-09-22)

## Corpus Check
- 26 files · ~33,609 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 329 nodes · 640 edges · 15 communities (14 shown, 1 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 20 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Broker Model & Checklist Assembly|Broker Model & Checklist Assembly]]
- [[_COMMUNITY_Analyzer Implementations|Analyzer Implementations]]
- [[_COMMUNITY_Workbook Report & XLSX Writer|Workbook Report & XLSX Writer]]
- [[_COMMUNITY_Broker Profile & Section Parsing|Broker Profile & Section Parsing]]
- [[_COMMUNITY_Data Flow & Config Parsing Concepts|Data Flow & Config Parsing Concepts]]
- [[_COMMUNITY_Analyzer Contract & Status Vocabulary|Analyzer Contract & Status Vocabulary]]
- [[_COMMUNITY_UI Shell & Bundle Build|UI Shell & Bundle Build]]
- [[_COMMUNITY_Project Docs & Dev Workflow|Project Docs & Dev Workflow]]
- [[_COMMUNITY_Config Tree Helpers|Config Tree Helpers]]
- [[_COMMUNITY_package.json Metadata|package.json Metadata]]
- [[_COMMUNITY_dev.sh Task Runner|dev.sh Task Runner]]
- [[_COMMUNITY_dev.ps1 Task Runner|dev.ps1 Task Runner]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]

## God Nodes (most connected - your core abstractions)
1. `buildProfile()` - 16 edges
2. `findSection()` - 16 edges
3. `extractConfigFacts()` - 15 edges
4. `ANALYZERS registry (keyed by ref)` - 14 edges
5. `Architecture` - 11 edges
6. `Developer guide` - 11 edges
7. `result()` - 10 edges
8. `valueOf()` - 10 edges
9. `Analyzer contract` - 9 edges
10. `detectHostname()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `Fixtures stay anonymised` --semantically_similar_to--> `Credential redaction at parse time (redactLine in parseConfig)`  [INFERRED] [semantically similar]
  CLAUDE.md → docs/architecture.md
- `gather-diagnostics bundle (cli-diagnostics.txt)` --shares_data_with--> `GATHER_DIAGNOSTICS_COMMANDS`  [INFERRED]
  README.md → src/analyzers.js
- `Supplemental CLI transcript` --conceptually_related_to--> `GATHER_DIAGNOSTICS_COMMANDS`  [INFERRED]
  README.md → src/analyzers.js
- `Analyzer contract` --references--> `result(status, output, note)`  [EXTRACTED]
  docs/architecture.md → src/analyzers.js
- `Data flow: file -> classifyFile -> detectHostname -> broker -> buildProfile -> buildChecklist/analyzeCheck -> UI table + buildWorkbook` --references--> `classifyFile`  [EXTRACTED]
  docs/architecture.md → src/broker.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Diagnostics-to-workbook data flow** — broker_classifyfile, broker_detecthostname, broker_buildprofile, checklist_buildchecklist, analyzers_analyzecheck, report_buildworkbook, ui_createapp [EXTRACTED 1.00]
- **Helpers available to analyzers under the analyzer contract** — analyzers_body, analyzers_has, analyzers_configonly, analyzers_kvlines, analyzers_referencedate, sections_valueof, sections_valuesof, sections_blockbetween, sections_counterof, sections_parsefixedtable [EXTRACTED 1.00]
- **Places that must change together when a verdict status is added** — analyzers_status, analyzers_status_label, analyzers_status_order, report_status_style, docs_developer_guide_solace_2025_theme, readme_verdict_statuses [EXTRACTED 1.00]

## Communities (15 total, 1 thin omitted)

### Community 0 - "Broker Model & Checklist Assembly"
Cohesion: 0.07
Nodes (44): Fixtures stay anonymised, cli-diagnostics.sample.txt fixture (brk-pri), current-config.sample.cli fixture, supplemental.sample.txt fixture, parseServiceTable(), STATUS, supplementalCommandsFor(), attachFile() (+36 more)

### Community 1 - "Analyzer Implementations"
Cohesion: 0.10
Nodes (30): analyzeCheck(), ANALYZERS, body(), bridgeConfig(), bridgeRows(), certificateAuthorities(), certificateStatus(), configList() (+22 more)

### Community 2 - "Workbook Report & XLSX Writer"
Cohesion: 0.16
Nodes (15): columnName(), concatBytes(), crc32(), CRC_TABLE, createWorkbook(), dosDateTime(), escapeXml(), FILLS (+7 more)

### Community 3 - "Broker Profile & Section Parsing"
Cohesion: 0.15
Nodes (28): buildProfile(), classifyFile(), detachFile(), detectHostname(), detectManagementIps(), detectRole(), detectSnapshot(), detectVersion() (+20 more)

### Community 4 - "Data Flow & Config Parsing Concepts"
Cohesion: 0.06
Nodes (40): referenceDate(ctx), buildProfile, classifyFile, CONFIG_HINT, CHECKS rows, Gates: scripts/dev.sh all (build + lint + test), ask don't run, Docs in sync: README + docs/*.md updated with behaviour changes, CLAUDE.md project conventions (+32 more)

### Community 5 - "Analyzer Contract & Status Vocabulary"
Cohesion: 0.13
Nodes (22): analyzeCheck, ANALYZERS registry (keyed by ref), body(ctx, cmds), configOnly(ctx), defaultOutcome, has(ctx, cmd), kvLines, result(status, output, note) (+14 more)

### Community 6 - "UI Shell & Bundle Build"
Cohesion: 0.08
Nodes (28): detectHostname, buildChecklist, DOM only in ui.js/main.js, scoped to createApp root, Add a broker form (one broker at a time), Assignment tray for files without a detected hostname, Bulk import of gather-diagnostics folders, Data flow: file -> classifyFile -> detectHostname -> broker -> buildProfile -> buildChecklist/analyzeCheck -> UI table + buildWorkbook, Generated app.js bundle (classic script IIFE) (+20 more)

### Community 7 - "Project Docs & Dev Workflow"
Cohesion: 0.17
Nodes (12): Adding or changing checks, Conventions, Day-to-day workflow, Developer guide, Inputs you can test with, Prerequisites, Quick start, Release and CI (+4 more)

### Community 8 - "Config Tree Helpers"
Cohesion: 0.25
Nodes (17): child(), children(), childValue(), collectBlocks(), countNodes(), dedupe(), extractConfigFacts(), finalizeMap() (+9 more)

### Community 9 - "package.json Metadata"
Cohesion: 0.14
Nodes (13): description, engines, node, license, name, private, scripts, build (+5 more)

### Community 10 - "dev.sh Task Runner"
Cohesion: 0.45
Nodes (10): dev.sh script, ok(), run_logged(), die(), task_build(), task_lint(), task_serve(), task_test() (+2 more)

### Community 11 - "dev.ps1 Task Runner"
Cohesion: 0.42
Nodes (8): Invoke-Logged(), Die(), Task-Build(), Task-Lint(), Task-Serve(), Task-Test(), Write-Ok(), Write-Step()

### Community 12 - "Community 12"
Cohesion: 0.25
Nodes (7): Adding a check (short form), Gates (ask, don't run), Hard rules, Layout in one glance, solace-healthcheck-utility, Status, Style

### Community 13 - "Community 13"
Cohesion: 0.25
Nodes (7): Development, Inputs, Limitations, Output, Run it, Solace Ops Readiness Checklist Builder, Verdicts

## Knowledge Gaps
- **83 isolated node(s):** `name`, `version`, `private`, `description`, `type` (+78 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Adding a check walkthrough` connect `Data Flow & Config Parsing Concepts` to `Broker Model & Checklist Assembly`, `Analyzer Contract & Status Vocabulary`?**
  _High betweenness centrality (0.163) - this node is a cross-community bridge._
- **Why does `GATHER_DIAGNOSTICS_COMMANDS` connect `Data Flow & Config Parsing Concepts` to `Analyzer Implementations`, `Analyzer Contract & Status Vocabulary`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **Why does `ANALYZERS registry (keyed by ref)` connect `Analyzer Contract & Status Vocabulary` to `Data Flow & Config Parsing Concepts`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _83 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Broker Model & Checklist Assembly` be split into smaller, more focused modules?**
  _Cohesion score 0.06623376623376623 - nodes in this community are weakly interconnected._
- **Should `Analyzer Implementations` be split into smaller, more focused modules?**
  _Cohesion score 0.09986504723346828 - nodes in this community are weakly interconnected._
- **Should `Broker Profile & Section Parsing` be split into smaller, more focused modules?**
  _Cohesion score 0.14962121212121213 - nodes in this community are weakly interconnected._