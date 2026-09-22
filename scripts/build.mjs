// Bundles src/*.js into a single classic script (app.js) so index.html works from file://.
//
// The modules only use relative imports and named exports, so bundling is a concatenation:
// imports are dropped, `export` keywords removed, and everything is wrapped in one IIFE.
// Top-level names must therefore be unique across modules; the build fails loudly otherwise.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ORDER = ["sections", "checks", "config-parser", "broker", "analyzers", "checklist", "xlsx", "report", "ui", "main"];
const OUTPUT = path.join(root, "app.js");

const IMPORT_RE = /^import\s[\s\S]*?from\s+"\.\/[^"]+";[ \t]*\r?\n?/gm;
const EXPORT_RE = /^export\s+(?=(?:async\s+)?function\b|const\b|let\b|class\b)/gm;
const DECL_RE = /^(?:export\s+)?(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm;

const seen = new Map();
const parts = [];
for (const name of ORDER) {
  const file = path.join(root, "src", `${name}.js`);
  let source = readFileSync(file, "utf8").replace(/\r\n?/g, "\n");

  for (const match of source.matchAll(DECL_RE)) {
    const identifier = match[1];
    if (seen.has(identifier)) {
      console.error(`FAIL  duplicate top-level name "${identifier}" in src/${name}.js and src/${seen.get(identifier)}.js`);
      process.exit(1);
    }
    seen.set(identifier, name);
  }

  const leftover = source.replace(IMPORT_RE, "").match(/^import\s/m);
  if (leftover) {
    console.error(`FAIL  src/${name}.js has an import the bundler does not understand (only relative "./x.js" imports are supported)`);
    process.exit(1);
  }
  if (/^export\s+(?:default|\{|\*)/m.test(source)) {
    console.error(`FAIL  src/${name}.js uses an export form the bundler does not understand (use named declarations)`);
    process.exit(1);
  }

  source = source.replace(IMPORT_RE, "").replace(EXPORT_RE, "");
  parts.push(`// ---- src/${name}.js ${"-".repeat(Math.max(0, 80 - name.length - 16))}\n${source.trim()}\n`);
}

const banner = `// GENERATED FILE - do not edit. Built by scripts/build.mjs from src/*.js (${new Date().toISOString()}).
// Edit the modules under src/ and run: scripts/dev.sh build  (or scripts\\dev.ps1 build)
`;
const bundle = `${banner}(() => {\n"use strict";\n\n${parts.join("\n")}\n})();\n`;
writeFileSync(OUTPUT, bundle, "utf8");
console.log(`built ${path.relative(root, OUTPUT)} (${(bundle.length / 1024).toFixed(0)} KB) from ${ORDER.length} modules`);
