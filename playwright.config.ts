import { defineConfig, devices } from "@playwright/test";
import { randomBytes } from "node:crypto";
import path from "node:path";
import "./packages/config/src/index";
const password =
  process.env.DEMO_LOGIN_PASSWORD || randomBytes(32).toString("hex");
process.env.DEMO_LOGIN_PASSWORD = password;
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60000,
  expect: { timeout: 12000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command:
      "node apps/web/node_modules/next/dist/bin/next dev apps/web --port 3100 --hostname 127.0.0.1",
    url: "http://127.0.0.1:3100/en-BD",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      DEMO_MODE: "true",
      DATA_BACKEND: "demo",
      STORAGE_BACKEND: "local",
      DATA_DIR: path.resolve(".data/e2e-" + randomBytes(5).toString("hex")),
      APP_URL: "http://127.0.0.1:3100",
      MAP_TILE_URL: "http://127.0.0.1:3100/tiles-disabled/{z}/{x}/{y}.png",
      MAP_ATTRIBUTION: "Synthetic test map; no external tiles requested",
      DEMO_LOGIN_PASSWORD: password,
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
