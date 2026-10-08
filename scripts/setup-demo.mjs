import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
if (!existsSync(".env")) {
  let env = readFileSync(".env.example", "utf8");
  for (const key of [
    "QR_SIGNING_SECRET",
    "TRACKING_TOKEN_PEPPER",
    "AUDIT_HASH_SECRET",
    "SESSION_SECRET",
    "WEBHOOK_SIGNING_SECRET",
    "DEMO_LOGIN_PASSWORD",
    "POSTGRES_PASSWORD",
  ])
    env = env.replace(
      new RegExp("^" + key + "=$", "m"),
      key + "=" + randomBytes(32).toString("hex"),
    );
  env = env.replace(
    "DATA_DIR=.data",
    "DATA_DIR=" + process.cwd().replaceAll("\\", "/") + "/.data",
  );
  writeFileSync(".env", env, { mode: 0o600 });
  console.info(
    "Created .env with random development secrets. Demo login password is in DEMO_LOGIN_PASSWORD.",
  );
} else console.info("Existing .env preserved.");
