import { test } from 'node:test';
import assert from 'node:assert/strict';
import { policyErrors } from './check-e2e-policy.mjs';
import { configErrors } from './check-e2e-config.mjs';
import { reviewErrors, digest } from './check-e2e-reviews.mjs';
import { readFileSync } from 'node:fs';

const imports = "import { test, expect } from '../helpers/fixture';\n";

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
  ]) assert.ok(policyErrors(imports + source, 'tests/e2e/example.spec.ts').length > 0, source);
});

test('policy accepts observable assertions and the shared screenshot helper', () => {
  assert.deepEqual(policyErrors(imports + 'await expect(button).toBeEnabled(); await button.click();', 'tests/e2e/example.spec.ts'), []);
  assert.deepEqual(policyErrors('await expect(page).toHaveScreenshot(`${id}.png`);', 'tests/e2e/helpers/test-steps.ts'), []);
});

test('every canonical configuration field is checked, including nested overrides', () => {
  const contract = JSON.parse(readFileSync('scripts/e2e-contract.json', 'utf8'));
  const actual = readFileSync('playwright.config.ts', 'utf8');
  assert.deepEqual(configErrors(actual, contract), []);
  const variants = [
    ['retries: 0', 'retries: 1'], ['forbidOnly: true', 'forbidOnly: false'],
    ['retries: 0', 'retries: process.env.CI ? 1 : 0'],
    ['maxDiffPixels: 0', 'maxDiffPixels: 1'], ['maxDiffPixelRatio: 0', 'maxDiffPixelRatio: 0.1'],
    ['threshold: 0', 'threshold: 0.1'], ['timeout: 2_000', 'timeout: 3_000'],
    ['actionTimeout: 2_000', 'actionTimeout: 5_000'], ['navigationTimeout: 2_000', 'navigationTimeout: 5_000'],
    ['timeout: 30_000', 'timeout: 60_000'], ['timeout: 60_000', 'timeout: 120_000'],
    ["updateSnapshots: 'none'", "updateSnapshots: 'all'"],
    ['reuseExistingServer: false', 'reuseExistingServer: true'],
    ["command: 'node scripts/start-test-services.mjs'", "command: 'npm run dev'"],
    ["testMatch: '**/*.spec.ts'", "testMatch: '**/selected.spec.ts'"],
    ["name: 'phone', use:", "name: 'phone', retries: 2, use:"],
    ['headless: true', 'headless: false'], ["browserName: 'chromium'", "browserName: 'firefox'"],
    ['deviceScaleFactor: 1', 'deviceScaleFactor: 2'], ["locale: 'en-CA'", "locale: 'en-US'"],
    ["timezoneId: 'UTC'", "timezoneId: 'Europe/London'"],
    ["colorScheme: 'dark'", "colorScheme: 'light'"],
    ["reducedMotion: 'reduce'", "reducedMotion: 'no-preference'"],
    ['width: 393', 'width: 400'], ['workers: 1', 'workers: 2'],
    ["launchOptions: {", "launchOptions: { executablePath: '/usr/bin/chromium',"],
    ["toHaveScreenshot: {", "toHaveScreenshot: { mask: [],"],
  ];
  for (const [before, after] of variants) {
    assert.ok(actual.includes(before), before);
    assert.ok(configErrors(actual.replace(before, after), contract).length, after);
  }
});

test('real-app policy rejects DOM manipulation, mocks, alternate contexts and uncontrolled inputs', () => {
  for (const source of [
    'await page.evaluate(() => document.querySelector("aside").remove());',
    'await page.setContent("fake page");', 'await page.route("**/*", handler);',
    'await context.addInitScript(callback);', 'await browser.newContext();',
    'await page.dispatchEvent("button", "click");', 'Math.random();', 'Date.now();',
    'new Date();', 'await page.waitForEvent("popup");', 'const pause = page.waitForTimeout;',
    'const pause = page[method];', 'const options = { mask };',
    'const options = { ["threshold"]: 1 };', 'test.use({ locale: "fr" });',
    'await import("./bypass");', 'const t = test;', 'page.off("console", handler);',
    'import { helper } from "./unguarded-helper";',
    'await expect(page).toMatchSnapshot();'
  ]) assert.ok(policyErrors(imports + source, 'tests/e2e/example.spec.ts').length, source);
});

test('scenarios cannot bypass the health fixture or counted assertions', () => {
  for (const source of [
    'import { test, expect } from "@playwright/test";',
    'import { test as unchecked, expect } from "../helpers/fixture";',
    'import { test } from "../helpers/fixture";'
  ]) assert.ok(policyErrors(source, 'tests/e2e/example.spec.ts').length, source);
});

test('baseline review must cover the exact bytes, with notes and no orphan entries', () => {
  const files = { 'splash.png': Buffer.from('approved pixels') };
  const review = { 'splash.png': { sha256: digest(files['splash.png']), review: 'Checked content, focus and layout in the phone screenshot.' } };
  assert.deepEqual(reviewErrors(files, review), []);
  assert.ok(reviewErrors(files, {}).length);
  assert.ok(reviewErrors({ 'splash.png': Buffer.from('changed pixels') }, review).length);
  assert.ok(reviewErrors(files, { 'splash.png': { ...review['splash.png'], review: '' } }).length);
  assert.ok(reviewErrors({}, review).length);
});

test('only the exact clipboard-read fixture expression may evaluate browser code', () => {
  assert.deepEqual(policyErrors('await page.evaluate(() => navigator.clipboard.readText());', 'tests/e2e/helpers/fixture.ts'), []);
  for (const expression of ['page.evaluate(() => localStorage.clear())', 'page.evaluate(() => window.seedGame())']) assert.notDeepEqual(policyErrors(expression, 'tests/e2e/helpers/fixture.ts'), []);
});

test('random initialization never permits scenario response fulfillment', () => {
  assert.ok(policyErrors("route.fulfill({ json: { board: 'fake' } });", 'tests/e2e/helpers/fixture.ts').length);
  assert.ok(policyErrors("route.fulfill({ response, json: { ...config, local: { ...config.local, initialSeed: seed }, preview: config.preview ? { ...config.preview, initialSeed: seed } : null } });", 'tests/e2e/example.spec.ts').length);
});
