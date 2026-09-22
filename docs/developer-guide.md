# Developer guide

How to set up, run, change, test and troubleshoot the Solace Ops Readiness Checklist builder.
Read [architecture.md](architecture.md) first for the module map and the analyzer contract.

## Prerequisites

| Tool | Version | Used for |
|---|---|---|
| Node.js | 20 or newer (24 recommended) | build, lint, tests, local server |
| Git Bash / bash or PowerShell 5.1+ | any | dev scripts (`scripts/dev.sh`, `scripts/dev.ps1`) |
| graphify | optional | knowledge graph (not wired yet) |

There are no npm dependencies and nothing to install. `package.json` exists for the `type: module`
flag and the script aliases only.

## Quick start

```bash
./run-healthcheck.sh            # build app.js, serve on http://127.0.0.1:8788, open the browser
./run-healthcheck.sh --file     # build app.js and open index.html from disk (no server)
./run-healthcheck.sh --check    # build, lint, tests, then serve
```

Equivalent dev-script tasks (both shells behave identically):

```bash
scripts/dev.sh build          # generate app.js from src/
scripts/dev.sh lint           # load every module, syntax-check app.js
scripts/dev.sh test           # node:test suite
scripts/dev.sh all            # build + lint + test (run this after every change)
scripts/dev.sh serve          # static server only
```

```powershell
scripts\dev.ps1 all
```

Every task writes `scripts/logs/<task>.log` (fresh per run, plain UTF-8). When something fails,
read the log rather than the console scrollback.

## Repository layout

```
index.html  styles.css  app.js*     the deliverable (* generated)
run-healthcheck.sh                  launcher
src/                                ES modules (the source of truth)
scripts/                            build.mjs, lint.mjs, serve.mjs, dev.sh, dev.ps1, logs/
test/                               node:test suites + fixtures/
docs/                               this guide, architecture.md
legacy/app.v1.js                    previous implementation, reference only
```

## Day-to-day workflow

1. Edit under `src/`. Never edit `app.js`; it is overwritten by the build.
2. Run `scripts/dev.sh all`. It rebuilds the bundle, loads every module (catches syntax and import
   errors and duplicate top-level names) and runs the tests.
3. Reload the page. If you use `run-healthcheck.sh` it rebuilds on every launch, so a stale bundle
   cannot happen that way.
4. Drop a real `cli-diagnostics.txt` in the UI and check the affected rows by eye. Real bundles
   are the only realistic input; the fixtures are anonymised and condensed.

### Writing rules the build enforces

- Only relative imports (`import { x } from "./sections.js"`) and named export declarations
  (`export function`, `export const`, `export let`, `export class`). No `export default`,
  no `export { }` lists, no bare-specifier imports.
- Top-level identifiers must be unique across all modules. Prefer module-specific names
  (`parseServiceTable`, not `parse`).
- No top-level DOM access outside `ui.js` and `main.js`. Everything else must load in Node.
- `ui.js` scopes every query to the root element passed to `createApp`; never use
  `document.getElementById` or globals for application state.

## Testing

```bash
scripts/dev.sh test
node --test test/analyzers.test.js          # one suite
node --test --test-name-pattern="POST"      # one test by name
```

Suites and what they cover:

| Suite | Covers |
|---|---|
| `sections.test.js` | header and transcript parsing, CRLF, command alternatives, fixed-width tables, CLI dates |
| `config-parser.test.js` | indentation tree, redaction, per-block shutdown state, VPN/user/queue facts |
| `broker.test.js` | file classification, hostname detection, profile (role, version, snapshot, IPs, warnings) |
| `analyzers.test.js` | verdicts for the fixture broker, monitor-node N/A paths, design targets, config and supplemental fallbacks |
| `xlsx.test.js` | sanitising, truncation, zip structure, sheet names, workbook content, supplemental script |

Fixtures under `test/fixtures/`:

- `cli-diagnostics.sample.txt`: a condensed, anonymised gather-diagnostics output for a primary
  node (`brk-pri`) with deliberate findings: POST non-critical licence warning, plaintext ports,
  discards, an expired domain CA, RDP 400 errors.
- `current-config.sample.cli`: synthetic current-config with LDAP, VPN, client-username, ACL,
  queue and syslog blocks. The syntax is based on documented `show current-config` output, not on
  a customer export; validate against a real one when available.
- `supplemental.sample.txt`: a pasted CLI session with three `show` commands.

Rules: every analyzer change gets an assertion; fixtures stay anonymised (no customer hostnames,
IPs or organisation names); when you change a fixture, keep the existing assertions true or update
them in the same change.

## Adding or changing checks

See "Adding a check" in [architecture.md](architecture.md). In short: row in `checks.js`,
analyzer in `analyzers.js`, fixture section, test assertion, `scripts/dev.sh all`.

Analyzer style:

- Read values with the helpers (`valueOf`, `counterOf`, `blockBetween`, `parseFixedTable`)
  rather than ad-hoc regexes over the whole body.
- Put the human-readable evidence in `output` and the one-line judgement in `note`. The note is
  what the Summary sheet lists under "Items needing attention".
- Return `null` when the evidence is absent and the default Missing hint is good enough.
- Keep verdicts conservative: Warning for "needs a look", Fail only when the evidence contradicts
  the expected result outright.

## Inputs you can test with

- gather-diagnostics bundles: the `cli-diagnostics.txt` at the root of each
  `gather-diagnostics_<age>_<hostname>_<timestamp>/` folder. Dropping the folder is fine; the UI
  skips `usr/`, `var/`, `tmp/` and other system directories.
- Supplemental transcript: run the commands from **Supplemental commands (.txt)** in a CLI
  session with paging off and save the whole terminal transcript. Each output must follow its
  prompt line `hostname> show ...`. The gather-diagnostics header format is also accepted.
- Current-config export: `show current-config all` saved to a file. Passwords, secrets and keys
  are redacted at parse time.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Page renders but nothing happens on upload; status line is empty | `app.js` missing or stale | `scripts/dev.sh build` or `./run-healthcheck.sh`, then reload |
| Browser console: "Cannot use import statement outside a module" | `index.html` was pointed at `src/main.js` | It must reference `./app.js` (classic script) |
| `node --test test/` fails with MODULE_NOT_FOUND | Node treats a bare directory as a file | Use the dev scripts, which pass the file glob |
| Build fails with "duplicate top-level name" | two modules declare the same identifier | Rename one; the bundle shares one scope |
| A broker shows role "Unknown" | `show redundancy detail` and `show redundancy group` missing or truncated | Check the section exists in the diagnostics; rename/assign the broker manually if needed |
| Config export attached as "Supplemental" | the file contains `# CLI command:` or prompt lines | It is CLI output, not `show current-config`; attach the real export |
| Certificate days look wrong | snapshot time not found, so today's date was used | The 1.8.2 output says which reference date applied |
| Excel reports a repair on open | malformed XML | Run `xlsx.test.js`; check `sanitizeCellText` and merged ranges in `report.js` |

## Release and CI

There is no CI or release pipeline yet. A tag-triggered pipeline (GitHub Actions, mirrored
`dev.sh`/`dev.ps1` tasks including `vet`, `cov`, `scan`, `full`, and a zipped static-site release
asset) has been proposed via `/init-devops` and is pending approval. Until then, the release
artifact is the folder itself: `index.html`, `styles.css`, a freshly built `app.js`, and
`README.md`.

## Conventions

- Solace 2025 palette and typography are defined as CSS custom properties at the top of
  `styles.css`; reuse the tokens rather than new hex values.
- Status colours are semantic (`--sem-*`) and shared between UI pills and workbook fills.
- Do not log or display secrets: config redaction happens in `parseConfig`, and the dev-script
  logs must stay free of credentials.
- Keep `README.md` (user-facing), this guide and `architecture.md` in step with behaviour changes
  in the same commit.
