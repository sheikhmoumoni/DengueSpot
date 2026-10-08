import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";
const ignored = new Set([
  "node_modules",
  ".next",
  ".git",
  ".data",
  ".tools",
  ".terraform",
  ".vercel",
  "artifacts",
  "test-results",
  "playwright-report",
  "coverage",
]);
async function tree(dir, prefix = "") {
  const entries = (await readdir(dir, { withFileTypes: true }))
    .filter(
      (e) =>
        !ignored.has(e.name) &&
        !(/^\.env(?:\.|$)/.test(e.name) && e.name !== ".env.example") &&
        !/\.tsbuildinfo$|\.tfstate|\.tfplan$/.test(e.name) &&
        e.name !== "terraform.tfvars" &&
        e.name !== "terraform.tfvars.json",
    )
    .sort(
      (a, b) =>
        Number(b.isDirectory()) - Number(a.isDirectory()) ||
        a.name.localeCompare(b.name),
    );
  const lines = [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i],
      last = i === entries.length - 1;
    lines.push(
      prefix + (last ? "└── " : "├── ") + e.name + (e.isDirectory() ? "/" : ""),
    );
    if (e.isDirectory())
      lines.push(
        ...(await tree(
          path.join(dir, e.name),
          prefix + (last ? "    " : "│   "),
        )),
      );
  }
  return lines;
}
const content =
  "# Generated source file tree\n\nComplete deliverable source tree. Local secrets, dependencies, build output, downloaded verification runtimes, test artifacts and private state are deliberately excluded. Regenerate with `node scripts/generate-file-tree.mjs`.\n\n```text\nDengueSpot/\n" +
  (await tree(".")).join("\n") +
  "\n```\n";
await writeFile("docs/FILE_TREE.md", content);
console.info("Generated docs/FILE_TREE.md");
