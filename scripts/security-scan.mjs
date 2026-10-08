import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
const ignored = new Set([
  "node_modules",
  ".git",
  ".next",
  ".data",
  ".tools",
  "artifacts",
  "test-results",
  "playwright-report",
]);
const patterns = [
  ["unsafe HTML", /dangerouslySetInnerHTML/],
  ["wildcard CORS", /Access-Control-Allow-Origin[^\n]*["']\*["']/i],
  [
    "private logging",
    /console\.(log|info|error)\([^\n]*(?:trackingToken|exactLocation|phoneE164|access_token)/,
  ],
  [
    "service credential public",
    /NEXT_PUBLIC_[A-Z_]*(?:SERVICE_ROLE|SECRET|PEPPER)/,
  ],
  ["security TODO", /TODO SECURITY/],
  ["private public storage", /public\s*:\s*true/],
  [
    "hard-coded provider credential",
    /(?:sk-(?:proj-)?[A-Za-z0-9_-]{24,}|AKIA[A-Z0-9]{16}|ghp_[A-Za-z0-9]{30,})/,
  ],
];
const findings = [];
async function scan(dir) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    if (ignored.has(item.name)) continue;
    const file = path.join(dir, item.name);
    if (item.isDirectory()) await scan(file);
    else if (
      /\.(ts|tsx|js|mjs)$/.test(file) &&
      !file.endsWith("security-scan.mjs")
    ) {
      const text = await readFile(file, "utf8");
      for (const [label, regex] of patterns)
        if (regex.test(text)) findings.push({ file, label });
    }
  }
}
await scan(".");
if (findings.length) {
  console.error(findings);
  process.exitCode = 1;
} else
  console.info(
    "Static security pattern checks passed. Review threat model and tests for behavioral coverage.",
  );
