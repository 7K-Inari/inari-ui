import { test, expect, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";

// Representative route per console section (tenant-scoped, mock org "acme").
const ROUTES: Array<{ name: string; path: string }> = [
  { name: "overview", path: "/acme/overview" },
  { name: "catalog", path: "/acme/catalog" },
  { name: "clusters", path: "/acme/clusters" },
  { name: "approvals", path: "/acme/approvals" },
  { name: "audit-log", path: "/acme/audit-log" },
  { name: "deploys", path: "/acme/deploys" },
  { name: "fleet", path: "/acme/fleet" },
  { name: "cloud-accounts", path: "/acme/cloud-accounts" },
  { name: "tenant-zones", path: "/acme/tenant-zones" },
  { name: "templates", path: "/acme/templates" },
  { name: "platform", path: "/acme/platform" },
  { name: "access", path: "/acme/access/members" },
  { name: "extensions", path: "/acme/extensions" },
  { name: "settings-notifications", path: "/acme/settings/notifications" },
  { name: "settings-org", path: "/acme/settings/org" },
];

const FIXED_NOW = new Date("2026-10-13T12:00:00Z");

async function preparePage(page: Page) {
  // Freeze time so relative timestamps ("15m ago") are stable in snapshots.
  await page.clock.install({ now: FIXED_NOW });
  // CDN fonts are unreachable in some environments; stub them so rendering
  // (and screenshots) use the same fallback fonts everywhere.
  await page.route("**/cdn.jsdelivr.net/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/css", body: "" }),
  );
  // No extension remoteEntry in this environment; fail it fast and
  // deterministically so the error UI settles before screenshots.
  await page.route("**/extensions/**/remoteEntry.js", (route) =>
    route.fulfill({ status: 404, body: "not found" }),
  );
}

async function gotoSettled(page: Page, path: string) {
  await page.goto(path, { waitUntil: "networkidle" });
  // Wait out skeleton loaders/loading states before asserting or shooting.
  await expect
    .poll(async () => page.locator("[aria-busy='true']:visible").count(), {
      timeout: 15_000,
    })
    .toBe(0);
  // Theme is applied via data-theme; never screenshot the unthemed frame.
  await page.waitForSelector("html[data-theme='dark']");
  // Let lazy chunks, fonts, and layout finish before screenshots.
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  await page.waitForTimeout(300);
}

for (const route of ROUTES) {
  test.describe(route.name, () => {
    test.beforeEach(async ({ page }) => {
      await preparePage(page);
      await gotoSettled(page, route.path);
    });

    test("has no automatically detectable accessibility violations", async ({
      page,
    }) => {
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      const violations = results.violations.map(
        (v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s) — ${v.help}`,
      );
      expect(violations).toEqual([]);
    });

    test("does not overflow horizontally", async ({ page }) => {
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);
    });

    test("matches the visual baseline", async ({ page }) => {
      await expect(page).toHaveScreenshot(`${route.name}.png`, {
        fullPage: true,
        animations: "disabled",
        maxDiffPixelRatio: 0.01,
      });
    });
  });
}

// WCAG 2.5.8 (AA): pointer targets at least 24x24 CSS px, mobile viewport.
for (const route of ROUTES) {
  test(`${route.name}: interactive elements meet 24px tap target`, async ({
    page,
  }) => {
    test.skip(
      page.viewportSize()?.width !== 390,
      "tap-target audit runs in the mobile project only",
    );
    await preparePage(page);
    await gotoSettled(page, route.path);
    const tooSmall = await page.evaluate(() => {
      const selector = "button, a[href], input, select, [role='button'], [role='menuitem'], [role='tab']";
      const results: string[] = [];
      for (const el of Array.from(document.querySelectorAll(selector))) {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue; // hidden
        const style = getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") continue;
        if (rect.width < 24 || rect.height < 24) {
          const label =
            el.getAttribute("aria-label") ??
            el.textContent?.trim().slice(0, 40) ??
            el.tagName;
          results.push(
            `${el.tagName.toLowerCase()} "${label}" ${Math.round(rect.width)}x${Math.round(rect.height)}`,
          );
        }
      }
      return results;
    });
    expect(tooSmall).toEqual([]);
  });
}
