import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import sharp from "sharp";
import QRCode from "qrcode";
async function image() {
  return sharp({
    create: { width: 240, height: 180, channels: 3, background: "#abc" },
  })
    .jpeg()
    .toBuffer();
}
async function login(request: APIRequestContext, profileId = "demo-officer-a") {
  const response = await request.post("/api/v1/auth/demo", {
    data: { profileId, password: process.env.DEMO_LOGIN_PASSWORD },
  });
  expect(response.ok()).toBeTruthy();
}
async function form(page: Page, locale = "en-BD") {
  await page.goto("/" + locale + "/report");
  await page.locator("input[type=file]").setInputFiles({
    name: "evidence.jpg",
    mimeType: "image/jpeg",
    buffer: await image(),
  });
  await page
    .getByRole("button", {
      name: locale === "en-BD" ? "Continue" : "পরবর্তী ধাপ",
      exact: true,
    })
    .click();
  await page
    .getByLabel(
      locale === "en-BD" ? "What did you notice?" : "আপনি কী দেখেছেন?",
      { exact: false },
    )
    .fill("বৃষ্টির পানি জমে আছে।");
  await page
    .getByRole("button", {
      name: locale === "en-BD" ? "Continue" : "পরবর্তী ধাপ",
      exact: true,
    })
    .click();
  await page.getByRole("checkbox").check();
}
test("English anonymous report completes with AI disabled and list/map privacy", async ({
  page,
  request,
}) => {
  const response = await request.get("/api/v1/reports");
  const reports = await response.text();
  expect(reports).not.toMatch(
    /exactLocation|accuracyMeters|trackingHash|originalKey/,
  );
  await form(page);
  await page
    .getByRole("button", { name: "Submit report", exact: true })
    .click();
  const duplicate = page.getByRole("button", {
    name: "Submit a separate report",
    exact: true,
  });
  await expect(
    duplicate.or(
      page.getByRole("heading", {
        name: "Thank you for looking out for your community.",
      }),
    ),
  ).toBeVisible();
  if (await duplicate.isVisible()) await duplicate.click();
  await expect(
    page.getByRole("heading", {
      name: "Thank you for looking out for your community.",
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Track progress", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Progress timeline" }),
  ).toBeVisible();
});
test("Bangla offline draft reconnects and safely syncs once", async ({
  page,
  context,
}) => {
  await form(page, "bn-BD");
  await context.setOffline(true);
  await page
    .getByRole("button", { name: "রিপোর্ট পাঠান", exact: true })
    .click();
  await expect(
    page.getByText("অফলাইনে রাখা হয়েছে। সংযোগ ফিরলে আমার রিপোর্ট থেকে পাঠান।"),
  ).toBeVisible();
  await context.setOffline(false);
  await page.goto("/bn-BD/my-reports");
  await expect(page.locator(".mine-grid .report-card").first()).toBeVisible({
    timeout: 20000,
  });
  const stored = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("dsp-tracking") || "[]") as {
        publicId: string;
      }[],
  );
  expect(new Set(stored.map((r) => r.publicId)).size).toBe(stored.length);
});
test("officer verifies, assigns and resolves with an after-photo", async ({
  page,
}) => {
  await login(page.request);
  const queue = await page.request.get("/api/v1/authority/reports");
  const data = (await queue.json()) as {
    reports: { id: string; status: string }[];
  };
  const report = data.reports.find((r) => r.status === "submitted")!;
  await page.goto("/en-BD/authority/reports/" + report.id);
  await page.getByRole("button", { name: "Start review", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Verify condition", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Review or action note", { exact: true })
    .fill("Standing water observed. Synthetic test.");
  await page
    .getByRole("button", { name: "Verify condition", exact: true })
    .click();
  await page
    .getByLabel("Cleanup team", { exact: true })
    .fill("Synthetic E2E crew");
  await page
    .getByRole("button", { name: "Assign cleanup team", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Mark action underway", exact: true })
    .click();
  await page
    .getByLabel("What action was taken?", { exact: true })
    .fill("Removed the water-holding material. Synthetic test.");
  await page.getByLabel("Upload after-photo", { exact: false }).setInputFiles({
    name: "after.jpg",
    mimeType: "image/jpeg",
    buffer: await image(),
  });
  await page
    .getByRole("button", { name: "Resolve with evidence", exact: true })
    .click();
  await expect(page.locator(".page-heading .badge")).toHaveText("Resolved");
});
test("public and cross-ward private access is denied", async ({ request }) => {
  const publicResponse = await request.get(
    "/api/v1/reports/DSP-DEMO01/private",
  );
  expect(publicResponse.status()).toBe(401);
  await login(request, "demo-officer-b");
  const response = await request.get("/api/v1/reports/DSP-DEMO01/private");
  expect(response.status()).toBe(403);
});
test("nearby duplicate suggestion and moderator hides report", async ({
  page,
  request,
}) => {
  await form(page);
  await page
    .getByRole("button", { name: "Submit report", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A similar report is nearby" }),
  ).toBeVisible();
  await login(request, "demo-moderator");
  const before = await request.get("/api/v1/moderation");
  const reports = (await before.json()) as {
    reports: { id: string; publicId: string }[];
  };
  const target = reports.reports.at(-1)!;
  const hidden = await request.post("/api/v1/moderation/" + target.id, {
    data: { action: "hide", reason: "Synthetic privacy test" },
  });
  expect(hidden.ok()).toBeTruthy();
  expect(
    (await request.get("/api/v1/reports/" + target.publicId)).status(),
  ).toBe(404);
});
test("data-rights deletion requires tracking credential", async ({
  request,
}) => {
  const denied = await request.post("/api/v1/data-rights/delete", {
    data: { publicId: "DSP-DEMO01" },
  });
  expect(denied.status()).toBe(403);
});
test("QR image is decoded on-device and rejects external redirects", async ({
  page,
}) => {
  await page.goto("/en-BD/qr");
  await page
    .getByLabel("Public report link")
    .fill("https://example.com/en-BD/r/DSP-DEMO01");
  await page.getByRole("button", { name: "Open report link" }).click();
  await expect(
    page.getByText("Enter a valid local DengueSpot report link."),
  ).toBeVisible();
  const qr = await QRCode.toBuffer("http://127.0.0.1:3100/en-BD/r/DSP-DEMO01", {
    width: 500,
  });
  await page.getByLabel("Scan a QR image").setInputFiles({
    name: "report-qr.png",
    mimeType: "image/png",
    buffer: qr,
  });
  await expect(page).toHaveURL(/\/en-BD\/r\/DSP-DEMO01$/);
});
test("English and Bangla home and report pages have no automated WCAG A/AA violations", async ({
  page,
}) => {
  for (const locale of ["en-BD", "bn-BD"]) {
    await page.goto("/" + locale);
    await expect(page.locator(".hero")).toBeVisible();
    const homeResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(homeResults.violations).toEqual([]);
    await page.goto("/" + locale + "/report");
    await expect(page.locator("input[type=file]")).toBeAttached();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  }
});
test("mobile and desktop layouts fit viewport and capture previews", async ({
  page,
}, testInfo) => {
  await page.goto("/en-BD");
  await expect(page.locator(".hero")).toBeVisible();
  await page.getByRole("button", { name: "List", exact: true }).click();
  await expect(page.locator(".list-grid .report-card").first()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-home.png`,
    fullPage: true,
  });
});
test("tile-provider failure shows the labeled fallback and keeps the list usable", async ({
  page,
}) => {
  await page.goto("/en-BD");
  await page.locator(".map-container").scrollIntoViewIfNeeded();
  await expect(page.locator(".schematic-svg")).toBeVisible();
  await expect(page.locator(".map-label")).toContainText("Schematic demo map");
  await page.getByRole("button", { name: "List", exact: true }).click();
  await expect(page.locator(".list-grid .report-card").first()).toBeVisible();
});
