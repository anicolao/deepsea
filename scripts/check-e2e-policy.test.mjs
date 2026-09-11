import { test } from 'node:test';
import assert from 'node:assert/strict';
import { policyErrors } from './check-e2e-policy.mjs';

test('policy rejects delays, manual waiting, retries, hidden pixels, and test bypasses', () => {
  for (const source of [
    'await page.waitForTimeout(100);',
    'await page["waitForLoadState"]("networkidle");',
    'await expect.poll(readState).toBe(true);',
    'test.skip("unfinished", callback);',
    'await expect(page).toHaveScreenshot("x.png", { mask: [locator] });',
    'test.use({ actionTimeout: 2000, retries: 1 });',
    'await expect(locator).toBeVisible({ timeout: 9999 });',
    'await page.screenshot();',
    'await button.click({ force: true });',
    'await page.addStyleTag({ content: "aside { display:none }" });'
  ]) assert.ok(policyErrors(source, 'tests/e2e/example.spec.ts').length > 0, source);
});

test('policy accepts observable assertions and the shared screenshot helper', () => {
  assert.deepEqual(policyErrors('await expect(button).toBeEnabled(); await button.click();', 'tests/e2e/example.spec.ts'), []);
  assert.deepEqual(policyErrors('await expect(page).toHaveScreenshot(`${id}.png`);', 'tests/e2e/helpers/test-steps.ts'), []);
});
