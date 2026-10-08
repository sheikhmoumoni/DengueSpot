import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
process.env.DEMO_MODE = "true";
process.env.DATA_BACKEND = "demo";
process.env.STORAGE_BACKEND = "local";
process.env.DATA_DIR = path.join(
  tmpdir(),
  "denguespot-tests-" + randomBytes(6).toString("hex"),
);
for (const key of [
  "TRACKING_TOKEN_PEPPER",
  "QR_SIGNING_SECRET",
  "AUDIT_HASH_SECRET",
  "SESSION_SECRET",
  "DEMO_LOGIN_PASSWORD",
])
  process.env[key] = randomBytes(32).toString("hex");
