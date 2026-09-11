import { test as base, type BrowserContext, type Page } from '@playwright/test';
import { expect } from './assertions';
import { assertStepsFinished } from './test-steps';

type Players = { readInvite: (page: Page) => Promise<string>; create: () => Promise<Page>; reload: (page: Page) => Promise<void>; setConnected: (page: Page, connected: boolean) => Promise<void> };
async function monitor(context: BrowserContext, page: Page, baseURL: string, problems: string[], reloading = new Set<Page>()) {
  const hosted = new URL(baseURL).origin === 'https://anicolao.github.io';
  const origins = new Set([new URL(baseURL).origin, ...(hosted ? ['https://identitytoolkit.googleapis.com', 'https://securetoken.googleapis.com', 'https://firestore.googleapis.com'] : ['http://127.0.0.1:9099', 'http://127.0.0.1:8080'])]);
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (!origins.has(url.origin)) { problems.push(`Unexpected network request: ${url.origin}`); await route.abort(); }
    else await route.continue();
  });
  page.on('pageerror', error => problems.push(error.message));
  page.on('console', message => { if (message.type() === 'error') problems.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) problems.push(`HTTP ${response.status()}: ${response.url()}`); });
  page.on('requestfailed', request => {
    const url = new URL(request.url());
    const failure = request.failure()?.errorText;
    // Reload intentionally cancels an open streaming subscription. Only that
    // endpoint, that Chromium cancellation code, and that navigation qualify.
    const reloadCancellation = reloading.has(page) && url.origin === (hosted ? 'https://firestore.googleapis.com' : 'http://127.0.0.1:8080') && url.pathname === '/google.firestore.v1.Firestore/Listen/channel' && failure === 'net::ERR_ABORTED';
    if (!reloadCancellation) problems.push(`Failed request: ${request.url()} (${failure})`);
  });
  context.on('page', () => problems.push('Unexpected extra page: use the shared players fixture.'));
}
export const test = base.extend<{ browserHealth: void; players: Players }>({
  browserHealth: [async ({ context, page, baseURL }, use, info) => {
    const problems: string[] = [];
    await monitor(context, page, baseURL!, problems);
    await use();
    expect(problems, 'No browser errors, failed resources, or external requests').toEqual([]);
    assertStepsFinished(info);
  }, { auto: true }],
  players: async ({ browser, baseURL }, use, info) => {
    const contexts: BrowserContext[] = [];
    const pages: Page[] = [];
    const reloading = new Set<Page>();
    const problems: string[] = [];
    try { await use({
      create: async () => {
        const { viewport, deviceScaleFactor, locale, timezoneId, colorScheme, contextOptions } = info.project.use;
        const context = await browser.newContext({ viewport, deviceScaleFactor, locale, timezoneId, colorScheme, ...contextOptions, serviceWorkers: 'block', baseURL });
        context.setDefaultTimeout(info.project.use.actionTimeout!);
        context.setDefaultNavigationTimeout(info.project.use.navigationTimeout!);
        contexts.push(context);
        const page = await context.newPage();
        pages.push(page);
        await monitor(context, page, baseURL!, problems, reloading);
        return page;
      },
      readInvite: async page => {
        if (!pages.includes(page)) throw new Error('Unknown player page');
        const invite = await page.evaluate(() => navigator.clipboard.readText());
        const url = new URL(invite);
        if (url.origin !== new URL(baseURL!).origin || url.pathname !== new URL('rooms/', baseURL!).pathname || !url.searchParams.get('room')) throw new Error('Clipboard does not contain an invite to this preview.');
        return invite;
      },
      reload: async page => {
        if (!pages.includes(page)) throw new Error('Unknown player page');
        reloading.add(page);
        try { await page.reload(); } finally { reloading.delete(page); }
      },
      setConnected: async (page, connected) => {
        if (!contexts.includes(page.context())) throw new Error('Unknown player context');
        await page.context().setOffline(!connected);
      }
    });
      expect(problems, 'No browser errors, failed resources, or external requests in any player context').toEqual([]);
      assertStepsFinished(info, pages);
    }
    finally { for (const context of contexts) await context.close(); }
  }
});
export { expect };
