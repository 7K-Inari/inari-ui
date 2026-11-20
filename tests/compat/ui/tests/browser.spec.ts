import { expect, test, type Page } from '@playwright/test';

async function installRemote(_page: Page, _incompatible = false) {
  // The VITE_COMPAT_FIXTURE development mock installs this remote through the
  // same registry API used by production.
  void _page;
  void _incompatible;
}

async function expectReady(page: Page) {
  await page.goto('/acme/extensions');
  await expect(page.locator('tr', { hasText: 'contract-fixture' }).getByText('ready', { exact: true })).toBeVisible();
}

async function openPageSlot({ page }: { page: Page }) {
  await installRemote(page);
  await expectReady(page);
  await page.goto('/acme/ext/contract');
  await expect(page.locator('[data-inari-slot="contract-page"]')).toBeVisible();
  await expect(page.locator('a[href="/acme/ext/contract"]').first()).toHaveCount(1);
}

test('slot nav-item:contract-nav', openPageSlot);
test('slot page:contract-page', openPageSlot);

test('slot catalog-card:contract-card', async ({ page }) => {
  await installRemote(page);
  await expectReady(page);
  await page.goto('/acme/catalog');
  await expect(page.locator('[data-inari-slot="contract-card"]').first()).toBeVisible();
});

test('slot cluster-tab:contract-tab', async ({ page }) => {
  await installRemote(page);
  await expectReady(page);
  await page.goto('/acme/clusters/cl-kind-dev');
  await page.getByRole('tab', { name: 'Contract', exact: true }).click();
  await expect(page.locator('[data-inari-slot="contract-tab"]')).toBeVisible();
});

test('slot instance-action:contract-action', async ({ page }) => {
  await installRemote(page);
  await expectReady(page);
  await page.goto('/acme/deploys/ri-orders-db');
  await page.getByRole('button', { name: 'Actions', exact: true }).click();
  const action = page.getByRole('button', { name: 'Contract action', exact: true });
  await expect(action).toBeVisible();
  await action.click();
});

test('slot form-widget:contract-picker', async ({ page }) => {
  await installRemote(page);
  await expectReady(page);
  await page.goto('/acme/catalog/core/postgresql-aws/deploy');
  await expect(page.locator('[data-inari-slot="contract-picker"]')).toBeVisible();
});

test('incompatible extension shows requirements and never mounts', async ({ page }) => {
  await installRemote(page, true);
  await page.goto('/acme/extensions?incompatible=1');
  await expect(page.getByText('incompatible', { exact: true })).toBeVisible();
  await expect(page.getByText(/inari.ui.v1/).first()).toBeVisible();
  await page.goto('/acme/catalog');
  await expect(page.locator('[data-inari-slot]')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Contract', exact: true })).toHaveCount(0);
});
