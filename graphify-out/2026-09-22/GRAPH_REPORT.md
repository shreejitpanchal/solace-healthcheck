# Graph Report - .  (2026-09-22)

## Corpus Check
- Corpus is ~33,609 words - fits in a single context window. You may not need a graph.

## Summary
- 293 nodes · 608 edges · 12 communities
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 21 edges (avg confidence: 0.87)
- Token cost: 84,298 input · 0 output

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

## God Nodes (most connected - your core abstractions)
1. `buildProfile()` - 16 edges
2. `findSection()` - 16 edges
3. `extractConfigFacts()` - 15 edges
4. `ANALYZERS registry (keyed by ref)` - 14 edges
5. `result()` - 10 edges
6. `valueOf()` - 10 edges
7. `detectHostname()` - 8 edges
8. `createWorkbook()` - 8 edges
9. `Analyzer contract: ANALYZERS[ref] = (ctx) => result(...) | null` - 8 edges
10. `Adding a check walkthrough` - 8 edges

## Surprising Connections (you probably didn't know these)
- `Fixtures stay anonymised` --semantically_similar_to--> `Credential redaction at parse time (redactLine in parseConfig)`  [INFERRED] [semantically similar]
  CLAUDE.md → docs/architecture.md
- `Adding a check walkthrough` --references--> `GATHER_DIAGNOSTICS_COMMANDS`  [EXTRACTED]
  docs/architecture.md → src/analyzers.js
- `gather-diagnostics bundle (cli-diagnostics.txt)` --shares_data_with--> `GATHER_DIAGNOSTICS_COMMANDS`  [INFERRED]
  README.md → src/analyzers.js
- `Supplemental CLI transcript` --conceptually_related_to--> `GATHER_DIAGNOSTICS_COMMANDS`  [INFERRED]
  README.md → src/analyzers.js
- `README.md (user guide)` --references--> `legacy/app.v1.js (read-only previous implementation)`  [EXTRACTED]
  README.md → legacy/app.v1.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Diagnostics-to-workbook data flow** — broker_classifyfile, broker_detecthostname, broker_buildprofile, checklist_buildchecklist, analyzers_analyzecheck, report_buildworkbook, ui_createapp [EXTRACTED 1.00]
- **Helpers available to analyzers under the analyzer contract** — analyzers_body, analyzers_has, analyzers_configonly, analyzers_kvlines, analyzers_referencedate, sections_valueof, sections_valuesof, sections_blockbetween, sections_counterof, sections_parsefixedtable [EXTRACTED 1.00]
- **Places that must change together when a verdict status is added** — analyzers_status, analyzers_status_label, analyzers_status_order, report_status_style, docs_developer_guide_solace_2025_theme, readme_verdict_statuses [EXTRACTED 1.00]

## Communities (12 total, 0 thin omitted)

### Community 0 - "Broker Model & Checklist Assembly"
Cohesion: 0.09
Nodes (33): Fixtures stay anonymised, cli-diagnostics.sample.txt fixture (brk-pri), current-config.sample.cli fixture, supplemental.sample.txt fixture, parseServiceTable(), STATUS, attachFile(), brokerHasFiles() (+25 more)

### Community 1 - "Analyzer Implementations"
Cohesion: 0.10
Nodes (30): analyzeCheck(), ANALYZERS, body(), bridgeConfig(), bridgeRows(), certificateAuthorities(), certificateStatus(), configList() (+22 more)

### Community 2 - "Workbook Report & XLSX Writer"
Cohesion: 0.10
Nodes (26): supplementalCommandsFor(), BASE_COLUMNS, BASE_WIDTHS, buildWorkbook(), checklistSheet(), summarySheet(), supplementalCommandScript(), supplementalSheet() (+18 more)

### Community 3 - "Broker Profile & Section Parsing"
Cohesion: 0.15
Nodes (28): buildProfile(), classifyFile(), detachFile(), detectHostname(), detectManagementIps(), detectRole(), detectSnapshot(), detectVersion() (+20 more)

### Community 4 - "Data Flow & Config Parsing Concepts"
Cohesion: 0.10
Nodes (26): referenceDate(ctx), buildProfile, classifyFile, CONFIG_HINT, detectHostname, Role awareness: HA-pair checks return na on Monitor and Standalone, extractConfigFacts, parseConfig (+18 more)

### Community 5 - "Analyzer Contract & Status Vocabulary"
Cohesion: 0.12
Nodes (24): analyzeCheck, ANALYZERS registry (keyed by ref), body(ctx, cmds), configOnly(ctx), defaultOutcome, has(ctx, cmd), kvLines, result(status, output, note) (+16 more)

### Community 6 - "UI Shell & Bundle Build"
Cohesion: 0.11
Nodes (19): DOM only in ui.js/main.js, scoped to createApp root, Add a broker form (one broker at a time), Assignment tray for files without a detected hostname, Bulk import of gather-diagnostics folders, Generated app.js bundle (classic script IIFE), Module dependency order sections->checks->config-parser->broker->analyzers->checklist->xlsx->report->ui->main, node:test suites (sections, config-parser, broker, analyzers, xlsx), index.html page shell (+11 more)

### Community 7 - "Project Docs & Dev Workflow"
Cohesion: 0.16
Nodes (17): readiness_run.sh script, CHECKS rows, Gates: scripts/dev.sh all (build + lint + test), ask don't run, Docs in sync: README + docs/*.md updated with behaviour changes, CLAUDE.md project conventions, docs/architecture.md, Adding a check walkthrough, docs/developer-guide.md (+9 more)

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

## Knowledge Gaps
- **53 isolated node(s):** `name`, `version`, `private`, `description`, `type` (+48 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Adding a check walkthrough` connect `Project Docs & Dev Workflow` to `Broker Model & Checklist Assembly`, `Data Flow & Config Parsing Concepts`, `Analyzer Contract & Status Vocabulary`?**
  _High betweenness centrality (0.152) - this node is a cross-community bridge._
- **Why does `GATHER_DIAGNOSTICS_COMMANDS` connect `Data Flow & Config Parsing Concepts` to `Analyzer Implementations`, `Analyzer Contract & Status Vocabulary`, `Project Docs & Dev Workflow`?**
  _High betweenness centrality (0.083) - this node is a cross-community bridge._
- **Why does `ANALYZERS registry (keyed by ref)` connect `Analyzer Contract & Status Vocabulary` to `Data Flow & Config Parsing Concepts`, `Project Docs & Dev Workflow`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _53 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Broker Model & Checklist Assembly` be split into smaller, more focused modules?**
  _Cohesion score 0.08636977058029689 - nodes in this community are weakly interconnected._
- **Should `Analyzer Implementations` be split into smaller, more focused modules?**
  _Cohesion score 0.09986504723346828 - nodes in this community are weakly interconnected._
- **Should `Workbook Report & XLSX Writer` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._