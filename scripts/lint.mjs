// Syntax and import-resolution check: imports every module (except the browser entry point).
// Exits non-zero on the first module that fails to load.
import { readdirSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Test files are deliberately excluded: importing them would run the suite (that is the `test` task).
const targets = readdirSync(path.join(root, "src"))
  .filter((name) => name.endsWith(".js") && name !== "main.js" && name !== "ui.js")
  .map((name) => path.join(root, "src", name));

let failed = 0;
for (const file of targets) {
  try {
    await import(pathToFileURL(file).href);
    console.log(`ok    ${path.relative(root, file)}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL  ${path.relative(root, file)}\n      ${error.message}`);
  }
}

// ui.js touches the DOM only inside createApp(); importing it is safe but needs `document` for nothing at load time.
try {
  await import(pathToFileURL(path.join(root, "src", "ui.js")).href);
  console.log("ok    src/ui.js");
} catch (error) {
  failed += 1;
  console.error(`FAIL  src/ui.js\n      ${error.message}`);
}

// The generated bundle must parse as a classic script.
const bundle = path.join(root, "app.js");
if (existsSync(bundle)) {
  const check = spawnSync(process.execPath, ["--check", bundle], { encoding: "utf8" });
  if (check.status === 0) console.log("ok    app.js (bundle syntax)");
  else {
    failed += 1;
    console.error(`FAIL  app.js\n      ${check.stderr.trim()}`);
  }
} else {
  console.error("WARN  app.js missing; run the build task");
}

if (failed) {
  console.error(`${failed} module(s) failed to load`);
  process.exit(1);
}
console.log(`${targets.length + 1} module(s) loaded`);
