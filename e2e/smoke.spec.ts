import { expect, test } from '@playwright/test';

test('bill drill dry fire saves to history', async ({ page }) => {
  await page.goto('/settings');
  await page.getByTestId('delay-min').fill('0');
  await page.getByTestId('delay-max').fill('0');
  await page.goto('/drills');
  await page.getByTestId('drill-bill-drill-6-dryTap').click();
  await expect(page.getByTestId('dry-mic-hint')).toBeVisible();
  await expect(page.getByTestId('shot-pad')).toHaveCount(0);
  await page.getByTestId('start').click();
  await page.getByTestId('stop').click();
  await page.getByTestId('save-session').click();
  await expect(page.getByTestId('history-item')).toBeVisible();
  await page.getByTestId('back-to-drill').click();
  await expect(page.getByTestId('start')).toBeVisible();
  await expect(page.getByTestId('dry-mic-hint')).toBeVisible();
});

test('free timer, PAR error in French, and language switch', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('home-free').click();
  await page.goto('/settings');
  await page.getByTestId('delay-min').fill('0');
  await page.getByTestId('delay-max').fill('0');
  await page.getByTestId('language').selectOption('fr');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Réglages');
  await page.goto('/run?drillId=draw&input=dryPar');
  await page.getByTestId('start').click();
  await expect(page.getByTestId('run-error')).toHaveText('Cet exercice n’a pas de fenêtre PAR.');
  await page.goto('/run?drillId=free-timer&input=dryTap');
  await page.getByTestId('start').click();
  await page.getByTestId('stop').click();
  await expect(page.getByTestId('save-session')).toBeVisible();
  await page.goto('/settings');
  await page.getByTestId('language').selectOption('pl');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Ustawienia');
});
