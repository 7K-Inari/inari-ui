import { expect, test } from "@playwright/test";

test("source-qualified catalog and template deep links preserve identity", async ({ page }) => {
  await page.goto("/acme/catalog");
  await expect(page.getByRole("link", { name: "PostgreSQL on AWS", exact: true })).toHaveCount(2);
  await expect(page.locator('a[href="/acme/catalog/core/postgresql-aws"]')).toBeVisible();
  await expect(page.locator('a[href="/acme/catalog/community/postgresql-aws"]')).toBeVisible();

  await page.locator('a[href="/acme/catalog/community/postgresql-aws"]').first().click();
  await expect(page).toHaveURL(/\/acme\/catalog\/community\/postgresql-aws$/);
  await expect(page.getByRole("heading", { name: "PostgreSQL on AWS" })).toBeVisible();
  await expect(page.getByText("community", { exact: true })).toBeVisible();
  await expect(page.getByText("experimental", { exact: true })).toBeVisible();
  await expect(page.getByText("Unsigned — development only", { exact: true })).toBeVisible();

  await page.goto("/acme/catalog/core/postgresql-aws");
  await expect(page.getByText("core", { exact: true })).toBeVisible();
  await expect(page.getByText("reviewed", { exact: true })).toBeVisible();
  await expect(page.getByTestId("artifact-digest")).toContainText("sha256:52cc");

  await page.goto("/acme/templates");
  const scaffoldLink = page.locator('a[href="/acme/templates/core/web-service/scaffold"]');
  await expect(scaffoldLink).toBeVisible();
  await scaffoldLink.click();
  await expect(page).toHaveURL(/\/acme\/templates\/core\/web-service\/scaffold$/);
  await expect(page.getByRole("heading", { name: "Scaffold Web Service" })).toBeVisible();
  await expect(page.getByText("core", { exact: true })).toBeVisible();
  await expect(page.getByText("reviewed", { exact: true })).toBeVisible();
  await expect(page.getByText(/Digest: sha256:52cc/)).toBeVisible();
});
