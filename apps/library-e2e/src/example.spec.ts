import { test, expect } from '@playwright/test';

test('shows the library and can add a book', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Keep every story',
  );
  await page.getByPlaceholder('e.g. The Left Hand of Darkness').fill('Dune');
  await page.getByPlaceholder('e.g. Ursula K. Le Guin').fill('Frank Herbert');
  await page.getByRole('button', { name: 'Add book' }).click();
  await expect(page.getByRole('heading', { name: 'Dune' })).toBeVisible();
});

test('opens the AI chat workspace', async ({ page }) => {
  await page.goto('/chat');

  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'What are we exploring today?',
  );
  await expect(page.getByLabel('Message Leafmark AI')).toBeVisible();
});
