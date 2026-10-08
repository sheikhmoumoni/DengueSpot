import path from "node:path";
import { readFileSync, existsSync } from "node:fs";
// Next runs with apps/web as cwd; CLI tools run from the workspace root.
const workspaceRoot =
  path.basename(process.cwd()) === "web" &&
  path.basename(path.dirname(process.cwd())) === "apps"
    ? path.resolve(process.cwd(), "../..")
    : process.cwd();
// Root .env also works when Next.js is launched from apps/web.
for (const base of [process.cwd(), path.resolve(process.cwd(), "../..")]) {
  const file = path.join(base, ".env");
  if (existsSync(file))
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = /^([A-Z_]+)=(.*)$/.exec(line);
      if (match && process.env[match[1]] === undefined)
        process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
}
if (
  !process.env.DATABASE_URL &&
  process.env.DATABASE_HOST &&
  process.env.DATABASE_PASSWORD
) {
  process.env.DATABASE_URL = `postgresql://${encodeURIComponent(process.env.DATABASE_USER || "denguespot")}:${encodeURIComponent(process.env.DATABASE_PASSWORD)}@${process.env.DATABASE_HOST}:5432/${process.env.DATABASE_NAME || "denguespot"}`;
}
export const demoEnabled = () => process.env.DEMO_MODE === "true";
export function secret(key: string): string {
  const value = process.env[key];
  if (!value || value.length < 32)
    throw new Error(`Configure ${key} (at least 32 characters)`);
  return value;
}
export function dataDir() {
  return path.resolve(workspaceRoot, process.env.DATA_DIR || ".data");
}
export function databaseSsl() {
  return process.env.DATABASE_SSL === "true"
    ? {
        rejectUnauthorized: true,
        ...(process.env.DATABASE_CA_FILE
          ? { ca: readFileSync(process.env.DATABASE_CA_FILE, "utf8") }
          : {}),
      }
    : undefined;
}
export function numeric(
  key: string,
  fallback: number,
  min: number,
  max: number,
) {
  const value = Number(process.env[key] || fallback);
  if (!Number.isFinite(value) || value < min || value > max)
    throw new Error(`Invalid ${key}`);
  return value;
}
export function assertConfig() {
  secret("TRACKING_TOKEN_PEPPER");
  secret("QR_SIGNING_SECRET");
  secret("AUDIT_HASH_SECRET");
  secret("SESSION_SECRET");
  if (process.env.DATA_BACKEND !== "postgres" && !demoEnabled())
    throw new Error("File backend requires explicit DEMO_MODE=true");
  if (
    !demoEnabled() &&
    (!process.env.SUPABASE_URL ||
      !["supabase", "s3"].includes(process.env.STORAGE_BACKEND || ""))
  )
    throw new Error(
      "Production requires verified auth and private object storage",
    );
}
