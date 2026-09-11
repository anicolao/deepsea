import { test, expect } from '../helpers/fixture';
import { TestSteps } from '../helpers/test-steps';

test('visitors see the home screen and can read the game brief', async ({ page }, info) => {
  const steps = new TestSteps(page, info, 'Gather your crew',
    'A visitor opens the production-built splash screen, reads the game brief with the keyboard, and returns to the splash. No backend is required.');

  await page.goto('./');
  await steps.step('splash', 'The game is clearly marked as ready for room creation', [
    { description: 'The page title and main heading identify Deep Sea.', assert: async () => {
      await expect(page).toHaveTitle('Deep Sea — Gather your crew');
      await expect(page.getByRole('heading', { level: 1, name: 'Deep Sea', exact: true })).toBeVisible();
    } },
    { description: 'Gather your crew and the three game facts are visible.', assert: async () => {
      await expect(page.getByRole('link', { name: 'Create room', exact: true })).toBeVisible();
      await expect(page.getByRole('list', { name: 'Game at a glance' })).toContainText('2–6');
      await expect(page.getByRole('list')).toContainText('Shared oxygen');
      await expect(page.getByRole('list')).toContainText('Three dives');
    } },
    { description: 'The hydrated About the game button is available; room creation is available.', assert: async () => {
      await expect(page.getByRole('button', { name: 'About the game' })).toBeEnabled();
      await expect(page.getByRole('link', { name: 'Create room', exact: true })).toBeVisible();
    } }
  ]);

  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Create room' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'About the game' })).toBeFocused();
  await page.keyboard.press('Enter');
  await steps.step('game-brief', 'A keyboard user can learn the game', [
    { description: 'An accessible dialog explains separate-device play and the shared oxygen supply.', assert: async () => {
      const dialog = page.getByRole('dialog', { name: 'Treasure is only yours if you make it back.' });
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText('each on their own device');
      await expect(dialog).toContainText('Everyone shares one oxygen supply');
    } },
    { description: 'The brief explains treasure risk in player language.', assert: async () => {
      await expect(page.getByRole('dialog')).toContainText('Carry only what you can bring home.');
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
    { description: 'The create-room link remains visible.', assert: async () => {
      await expect(page.getByRole('link', { name: 'Create room', exact: true })).toBeVisible();
    } }
  ]);
  steps.finish();
});
