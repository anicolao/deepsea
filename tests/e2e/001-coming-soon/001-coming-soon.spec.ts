import { test, expect } from '../helpers/fixture';
import { TestSteps } from '../helpers/test-steps';

test('visitors see the coming-soon screen and can read the game brief', async ({ page }, info) => {
  const steps = new TestSteps(page, info, 'Coming soon',
    'A visitor opens the production-built splash screen, reads the game brief with the keyboard, and returns to the splash. No backend is required.');

  await page.goto('./');
  await steps.step('splash', 'The game is clearly marked as coming soon', [
    { description: 'The page title and main heading identify Deep Sea.', assert: async () => {
      await expect(page).toHaveTitle('Deep Sea — Coming soon');
      await expect(page.getByRole('heading', { level: 1, name: 'Deep Sea', exact: true })).toBeVisible();
    } },
    { description: 'Coming soon and the three game facts are visible.', assert: async () => {
      await expect(page.getByText('Coming soon', { exact: true })).toBeVisible();
      await expect(page.getByRole('list', { name: 'Game at a glance' })).toContainText('2–6');
      await expect(page.getByRole('list')).toContainText('Shared oxygen');
      await expect(page.getByRole('list')).toContainText('Three dives');
    } },
    { description: 'The hydrated About the game button is available; no play or room controls are offered.', assert: async () => {
      await expect(page.getByRole('button', { name: 'About the game' })).toBeEnabled();
      await expect(page.getByRole('button', { name: /create.*room|join.*room|start.*dive/i })).toHaveCount(0);
    } }
  ]);

  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'About the game' })).toBeFocused();
  await page.keyboard.press('Enter');
  await steps.step('game-brief', 'A keyboard user can read what is being built', [
    { description: 'An accessible dialog explains separate-device play and the shared oxygen supply.', assert: async () => {
      const dialog = page.getByRole('dialog', { name: 'Treasure is only yours if you make it back.' });
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText('each on their own device');
      await expect(dialog).toContainText('Everyone shares one oxygen supply');
    } },
    { description: 'The brief explicitly says room creation and play will arrive later.', assert: async () => {
      await expect(page.getByRole('dialog')).toContainText('Room creation and play will arrive later.');
    } },
    { description: 'The close control receives focus and is keyboard operable.', assert: async () => {
      await expect(page.getByRole('button', { name: 'Back to the surface' })).toBeFocused();
    } }
  ]);

  await page.keyboard.press('Escape');
  await steps.step('return', 'Closing the brief restores the visitor’s place', [
    { description: 'Escape closes the dialog and restores focus to About the game.', assert: async () => {
      await expect(page.getByRole('dialog')).not.toBeVisible();
      await expect(page.getByRole('button', { name: 'About the game' })).toBeFocused();
    } },
    { description: 'The coming-soon status remains visible.', assert: async () => {
      await expect(page.getByText('Coming soon', { exact: true })).toBeVisible();
    } }
  ]);
  steps.finish();
});
