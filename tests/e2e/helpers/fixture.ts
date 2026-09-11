import { test as base, expect } from '@playwright/test';

export const test = base.extend<{ browserHealth: void }>({
  browserHealth: [async ({ context, page, baseURL }, use) => {
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
    await use();
    expect(problems, 'No browser errors, failed resources, or external requests').toEqual([]);
  }, { auto: true }]
});

export { expect };
