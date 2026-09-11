import { test as base } from '@playwright/test';
import { expect } from './assertions';
import { assertStepsFinished } from './test-steps';

export const test = base.extend<{ browserHealth: void }>({
  browserHealth: [async ({ context, page, baseURL }, use, info) => {
    const problems: string[] = [];
    const origin = new URL(baseURL!).origin;
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) {
        problems.push(`Unexpected network request: ${url.origin}`);
        await route.abort();
      } else {
        await route.continue();
      }
    });
    page.on('pageerror', (error) => problems.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(message.text());
    });
    page.on('response', (response) => {
      if (response.status() >= 400) problems.push(`HTTP ${response.status()}: ${response.url()}`);
    });
    page.on('requestfailed', (request) => problems.push(`Failed request: ${request.url()}`));
    context.on('page', () => problems.push('Unexpected extra page: extend the shared fixture before testing multiple pages.'));
    await use();
    expect(problems, 'No browser errors, failed resources, or external requests').toEqual([]);
    assertStepsFinished(info);
  }, { auto: true }]
});

export { expect };
