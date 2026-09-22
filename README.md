# Solace Ops Readiness Checklist Builder

Browser tool that turns Solace PubSub+ software broker diagnostics into the Ops Readiness
Checklist workbook, with a Pass / Warning / Fail verdict per check and per broker. Everything
runs locally in the browser; no data leaves the machine.

## Run it

Quickest: `./run-healthcheck.sh` (Git Bash, macOS or Linux) builds `app.js`, starts the local server and opens the browser. `./run-healthcheck.sh --file` builds and opens `index.html` from disk instead; `--check` also runs lint and tests first.

Manually: open `index.html` in a browser. No server, install or network access is needed (Google Fonts are
loaded when online and fall back to Segoe UI otherwise).

`app.js` is generated from the modules under `src/`; after editing anything in `src/`, rebuild it:

```powershell
scripts\dev.ps1 build     # Windows
scripts/dev.sh build      # bash
```

`scripts/dev.sh serve` still offers a local server for development, but it is optional.

## Inputs

Add brokers one at a time with the **Add a broker** form: `cli-diagnostics.txt` is required, the
current-config export is optional, and the hostname is detected from the diagnostics (editable).
Alternatively use **Bulk import** to drop whole gather-diagnostics folders; brokers are then detected
from the file content, so the primary, backup and monitor bundles can be dropped in one go.

| Input | Where it comes from | What it feeds |
|---|---|---|
| `cli-diagnostics.txt` | `gather-diagnostics` bundle (drop the whole folder; `usr/`, `var/`, `tmp/` are skipped) | Most checks: redundancy, spool, certificates, services, health counters |
| Supplemental transcript | `show` commands that gather-diagnostics does not run. Download the list with **Supplemental commands (.txt)**, run them in a CLI session on each broker with paging off (`no paging`) and save the whole terminal transcript. Each output must be preceded by its prompt line `hostname> show ...`; the gather-diagnostics `# CLI command:` header format is accepted too | LDAP/OAuth profiles, usernames, access levels, syslog, backup, client-profiles, ACLs, queues |
| Current-config export | `show current-config all` saved to a file | Fallback for the same checks when no transcript exists; default objects, downgrade flags, queue subscriptions. Credential values are redacted before display |

Files whose hostname cannot be detected land in an assignment tray where you pick or create the broker.

## Verdicts

| Status | Meaning |
|---|---|
| Pass | Evidence found and it meets the expected result |
| Warning | Evidence found; needs attention or justification (plaintext ports up, discards, certificate expiring within 90 days) |
| Fail | Evidence contradicts the expected result (redundancy down, expired certificate, default VPN enabled) |
| Info | Evidence captured; comparison against the design is left to the reviewer |
| Manual | No CLI evidence can answer this item |
| N/A | Not applicable to this broker (HA-pair checks on a monitor node, replication when not configured) |
| Missing | The CLI sections for this item were not uploaded; the note says which command to collect |

Certificate expiry and "days remaining" are computed against the diagnostics snapshot time
(taken from `show storage-element * detail`), not today's date. Set **Design targets** (SolOS
version, connection tier, spool size) to turn the matching Info items into Pass/Fail.

## Output

**Download checklist (.xlsx)** produces a workbook with three sheets: *Summary* (broker inventory,
counts, items needing attention, legend), *Readiness Checklist* (the standard checklist with a
Result and Actual Output column per broker, frozen header, autofilter) and *Supplemental Commands*.

## Development

```powershell
scripts\dev.ps1 all      # build app.js + lint (module load) + tests
scripts\dev.ps1 test
```

Logs land in `scripts/logs/<task>.log`. Tests use anonymised fixtures under `test/fixtures/`.
See [docs/developer-guide.md](docs/developer-guide.md) for setup, workflow, testing and
troubleshooting, and [docs/architecture.md](docs/architecture.md) for the module map, data flow
and the "add a new check" walkthrough. The previous single-file implementation is kept read-only
under `legacy/` for reference.

## Limitations

- `show message-vpn * detail`, client-profile, ACL and queue details are not part of
  gather-diagnostics; those checks stay Info/Missing until a supplemental transcript or config export is added.
- NTP and time-zone (1.1.11) cannot be read from broker CLI output and remain manual.
- The workbook writer is deliberately minimal (inline strings, fixed styles); it opens in Excel and LibreOffice but has no formulas.
