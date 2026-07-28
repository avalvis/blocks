import { expect, test } from '@playwright/test';

test('starts, accepts keyboard input, pauses, and restarts', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('blocks');
  await expect(page.getByRole('img', { name: /animated falling blocks/i })).toBeVisible();
  await expect(page.locator('canvas')).toBeInViewport();
  await expect(page.locator('.next-list .preview-grid')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: /^play$/i }).click();
  await expect(page.locator('canvas')).toBeVisible();

  await page.keyboard.press('Space');
  await expect(page.getByText(/\+\d+ hard drop/i)).toBeVisible();

  await page.keyboard.press('p');
  await expect(page.getByRole('heading', { name: /run paused/i })).toBeVisible();
  await page.getByRole('button', { name: /resume/i }).click();
  await expect(page.getByRole('heading', { name: /run paused/i })).toBeHidden();
});

test('supports cell-targeted mouse placement, dropping, holding, and persistence', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'Desktop mouse-mode assertion');
  await page.goto('/');
  await page.getByRole('button', { name: 'Mouse', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Mouse', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('canvas')).toHaveCSS('cursor', 'auto');
  await page.getByRole('button', { name: /^play$/i }).click();

  const board = page.locator('canvas');
  const bounds = await board.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(bounds!.x + bounds!.width * 0.82, bounds!.y + bounds!.height * 0.88);
  await page.mouse.click(bounds!.x + bounds!.width * 0.82, bounds!.y + bounds!.height * 0.88);
  await expect(page.getByText(/\+\d+ hard drop/i)).toBeVisible();

  await page.mouse.click(
    bounds!.x + bounds!.width * 0.28,
    bounds!.y + bounds!.height * 0.72,
    { button: 'right' },
  );
  await expect(page.locator('[aria-label^="Held piece:"]:not([aria-label$="empty"])')).toHaveCount(1);

  await page.reload();
  await expect(page.getByRole('button', { name: 'Mouse', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('publishes cache-busted favicon fallbacks', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute('href', '/favicon.svg?v=3');
  await expect(page.locator('link[rel="icon"][type="image/png"][sizes="32x32"]')).toHaveAttribute(
    'href',
    '/favicon-32.png?v=3',
  );
  await expect(page.locator('link[rel="shortcut icon"][type="image/x-icon"]')).toHaveAttribute(
    'href',
    '/favicon.ico?v=3',
  );

  for (const asset of ['/favicon.svg?v=3', '/favicon-32.png?v=3', '/favicon.ico?v=3']) {
    const response = await page.request.get(asset);
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toMatch(/^image\//);
  }
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

test('publishes themed creator links in the footer', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'The compact mobile layout hides the footer');
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Avalvis on GitHub' })).toHaveAttribute(
    'href',
    'https://github.com/avalvis',
  );
  await expect(page.getByRole('link', { name: 'Visit avalvis.gr' })).toHaveAttribute(
    'href',
    'https://www.avalvis.gr/',
  );
  await expect(page.getByRole('link', { name: 'Email info@avalvis.gr' })).toHaveAttribute(
    'href',
    'mailto:info@avalvis.gr',
  );
});

test('shows usable touch controls on a mobile viewport', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Mobile-only layout assertion');
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Move left' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hard drop' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hold piece' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rotate counter-clockwise' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rotate clockwise' })).toBeVisible();
  const touchSize = await page.getByRole('button', { name: 'Hard drop' }).boundingBox();
  expect(touchSize?.width).toBeGreaterThanOrEqual(44);
  expect(touchSize?.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: /^play$/i }).click();
  await page.getByRole('button', { name: 'Hard drop' }).click();
  await expect(page.locator('canvas')).toBeInViewport();
});
