import { cp, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
const root = fileURLToPath(new URL("../", import.meta.url));
try {
  process.loadEnvFile(path.join(root, ".env"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const web = path.join(root, "apps/web");
const output = path.join(web, ".next/standalone/apps/web");
try {
  await access(path.join(output, "server.js"));
} catch {
  throw new Error("Run pnpm build before pnpm start.");
}
await cp(path.join(web, "public"), path.join(output, "public"), {
  recursive: true,
});
await cp(path.join(web, ".next/static"), path.join(output, ".next/static"), {
  recursive: true,
});
console.info(
  "Open DengueSpot: " +
    new URL(process.env.APP_URL || "http://localhost:3000").origin +
    "/bn-BD",
);
const child = spawn(process.execPath, [path.join(output, "server.js")], {
  stdio: "inherit",
  cwd: root,
  env: {
    ...process.env,
    NODE_ENV: "production",
    HOSTNAME: process.env.HOSTNAME || "127.0.0.1",
    DATA_DIR: path.resolve(root, process.env.DATA_DIR || ".data"),
  },
});
child.on("exit", (code) => {
  process.exitCode = code || 0;
});
child.on("error", () => {
  console.error("Production server could not start.");
  process.exitCode = 1;
});
