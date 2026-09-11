import { test as base, type BrowserContext, type Page, type Request } from '@playwright/test';
import { expect } from './assertions';
import { assertStepsFinished } from './test-steps';

type Players = { readInvite: (page: Page) => Promise<string>; create: () => Promise<Page>; reload: (page: Page) => Promise<void>; setConnected: (page: Page, connected: boolean) => Promise<void> };
async function monitor(context: BrowserContext, page: Page, baseURL: string, problems: string[], streams = new Map<Page, Set<Request>>(), cancelledByReload = new Set<Request>()) {
  const hosted = new URL(baseURL).origin === 'https://anicolao.github.io';
  const origins = new Set([new URL(baseURL).origin, ...(hosted ? ['https://identitytoolkit.googleapis.com', 'https://securetoken.googleapis.com', 'https://firestore.googleapis.com'] : ['http://127.0.0.1:9099', 'http://127.0.0.1:8080'])]);
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (!origins.has(url.origin)) { problems.push(`Unexpected network request: ${url.origin}`); await route.abort(); }
    else if (url.pathname === new URL('backend.json', baseURL).pathname) {
      const response = await route.fetch();
      const config = await response.json();
      // Only reproducible randomness at initialization: no identities, actions or board state.
      await route.fulfill({ response, json: { ...config, local: { ...config.local, initialSeed: 2026 }, preview: config.preview ? { ...config.preview, initialSeed: 2026 } : null } });
    } else await route.continue();
  });
  page.on('pageerror', error => problems.push(error.message));
  page.on('console', message => { if (message.type() === 'error') problems.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) problems.push(`HTTP ${response.status()}: ${response.url()}`); });
  const active = new Set<Request>();
  streams.set(page, active);
  const isStream = (request: Request) => {
    const url = new URL(request.url());
    return url.origin === (hosted ? 'https://firestore.googleapis.com' : 'http://127.0.0.1:8080') && url.pathname === '/google.firestore.v1.Firestore/Listen/channel';
  };
  page.on('request', request => { if (isStream(request)) active.add(request); });
  page.on('requestfinished', request => { active.delete(request); cancelledByReload.delete(request); });
  page.on('requestfailed', request => {
    active.delete(request);
    const failure = request.failure()?.errorText;
    // Chromium can report the old document's cancellation after reload resolves.
    // Identify the exact already-open request, never a time window or new stream.
    const previousStream = cancelledByReload.delete(request);
    const reloadCancellation = previousStream && isStream(request) && failure === 'net::ERR_ABORTED';
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
    const streams = new Map<Page, Set<Request>>();
    const cancelledByReload = new Set<Request>();
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
        await monitor(context, page, baseURL!, problems, streams, cancelledByReload);
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
        for (const request of streams.get(page) ?? []) cancelledByReload.add(request);
        await page.reload();
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
