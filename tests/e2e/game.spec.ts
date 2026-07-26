import { expect, test } from '@playwright/test';

test('starts, accepts keyboard input, pauses, and restarts', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('blocks');
  await expect(page.getByRole('heading', { name: /find your flow/i })).toBeVisible();
  await expect(page.locator('canvas')).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: /play blocks/i }).click();
  await expect(page.locator('canvas')).toBeVisible();

  await page.keyboard.press('Space');
  await expect(page.getByText(/\+\d+ hard drop/i)).toBeVisible();

  await page.keyboard.press('p');
  await expect(page.getByRole('heading', { name: 'Paused' })).toBeVisible();
  await page.getByRole('button', { name: /keep playing/i }).click();
  await expect(page.getByRole('heading', { name: 'Paused' })).toBeHidden();
});

test('opens help and sound settings', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open controls' }).click();
  await expect(page.getByRole('heading', { name: 'Controls' })).toBeVisible();
  await page.getByRole('button', { name: 'Close panel' }).click();
  await page.getByRole('button', { name: 'Open sound settings' }).click();
  await expect(page.getByRole('heading', { name: 'Sound' })).toBeVisible();
  await expect(page.getByLabel('Master volume')).toBeVisible();
});

test('shows usable touch controls on a mobile viewport', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Mobile-only layout assertion');
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Move left' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hard drop' })).toBeVisible();
  const touchSize = await page.getByRole('button', { name: 'Hard drop' }).boundingBox();
  expect(touchSize?.width).toBeGreaterThanOrEqual(38);
  expect(touchSize?.height).toBeGreaterThanOrEqual(38);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: /play blocks/i }).click();
  await page.getByRole('button', { name: 'Hard drop' }).click();
  await expect(page.locator('canvas')).toBeInViewport();
});
