import { expect, test } from "@playwright/test";

const url = "https://grafana.team.example/d/payments-api-overview/overview?var-namespace=payments";

test("existing-instance links appear only for ready verified server evidence", async ({ page }) => {
  const grafanaRequests: string[] = [];
  page.on("request", (request) => { if (request.url().includes("grafana.team.example")) grafanaRequests.push(request.url()); });

  for (const state of ["blocked_external_gate", "approval_pending", "waiting_for_app", "render_pending", "deploying", "verification_pending", "verification_failed", "expired", "stale", "revoked", "unavailable", "cancelled"]) {
    await page.goto(`/acme/deploys/ri-observability-${state}`);
    await expect(page.getByRole("heading", { name: "Observability" })).toBeVisible();
    await expect(page.getByText("LINKS 0", { exact: true })).toBeVisible();
    await expect(page.locator('a[href*="grafana"]')).toHaveCount(0);
    await expect(page.locator("iframe")).toHaveCount(0);
  }

  await page.goto("/acme/deploys/ri-observability-ready");
  const link = page.getByRole("link", { name: "Open Service overview on Grafana (new tab)" });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", url);
  await expect(page.locator("iframe")).toHaveCount(0);
  expect(grafanaRequests).toEqual([]);
});
