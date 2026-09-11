import { test as base, type BrowserContext, type Page, type Request } from '@playwright/test';
import { expect } from './assertions';
import { assertStepsFinished } from './test-steps';

type Players = { visit: (page: Page, url: string) => Promise<void>; readInvite: (page: Page) => Promise<string>; create: () => Promise<Page>; reload: (page: Page) => Promise<void>; setConnected: (page: Page, connected: boolean) => Promise<void> };
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
  const consoleErrors: { text: string; url: string }[] = [];
  const conflicts: { url: string; name: string; fields: string }[] = [];
  const acknowledgements: { name: string; fields: string | null }[] = [];
  const inspections: Promise<void>[] = [];
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push({ text: message.text(), url: message.location?.().url ?? '' }); });
  const received = new Set<Request>();
  const completedStreams: Request[] = [];
  const acknowledgedStreams = new Set<Request>();
  const channel = (request: Request) => {
    const url = new URL(request.url());
    if (request.method?.() !== 'GET' || url.origin !== (hosted ? 'https://firestore.googleapis.com' : 'http://127.0.0.1:8080') || url.pathname !== '/google.firestore.v1.Firestore/Listen/channel' || url.searchParams.get('RID') !== 'rpc' || !url.searchParams.get('SID') || !/^\d+$/.test(url.searchParams.get('AID') ?? '')) return null;
    return { session: url.searchParams.get('SID'), database: url.searchParams.get('database'), acknowledged: Number(url.searchParams.get('AID')) };
  };
  page.on('response', response => {
    if (response.status() === 200 && response.request && channel(response.request())) received.add(response.request());
    inspections.push((async () => {
      const url = new URL(response.url());
      const commit = url.origin === (hosted ? 'https://firestore.googleapis.com' : 'http://127.0.0.1:8080') && /^\/v1\/projects\/[^/]+\/databases\/\(default\)\/documents:commit$/.test(url.pathname);
      if (commit && [200,409].includes(response.status())) {
        const body = response.request().postDataJSON();
        const writes = body?.writes ?? [];
        const eventWrites = writes.filter((write: { update?: { name: string }; verify?: string }) => /\/documents\/environments\/[A-Za-z0-9_-]+\/games\/[A-Za-z0-9_-]+\/events\/[A-Za-z0-9_-]+$/.test(write.update?.name ?? write.verify ?? ''));
        if (response.status() === 200) {
          for (const write of eventWrites) if (write.update || (write.verify && typeof write.currentDocument?.updateTime === 'string')) acknowledgements.push({ name: write.update?.name ?? write.verify, fields: write.update ? JSON.stringify(write.update.fields) : null });
        } else {
          const result = await response.json();
          const first = eventWrites.at(0);
          if (eventWrites.length === 1 && first.update && result?.error?.code === 409 && ['ALREADY_EXISTS','ABORTED'].includes(result?.error?.status)) {
            conflicts.push({ url: response.url(), name: first.update.name, fields: JSON.stringify(first.update.fields) });
            return;
          }
        }
      }
      if (response.status() >= 400) problems.push('HTTP ' + response.status() + ': ' + response.url());
    })().catch(error => { problems.push('Response inspection failed: ' + error.message); }));
  });
  const active = new Set<Request>();
  streams.set(page, active);
  const isStream = (request: Request) => {
    const url = new URL(request.url());
    return url.origin === (hosted ? 'https://firestore.googleapis.com' : 'http://127.0.0.1:8080') && (url.pathname === '/google.firestore.v1.Firestore/Listen/channel' || /^\/v1\/projects\/[^/]+\/databases\/\(default\)\/documents:(commit|batchGet)$/.test(url.pathname));
  };
  page.on('request', request => { if (isStream(request)) active.add(request); if (channel(request)) acknowledgedStreams.add(request); });
  page.on('requestfinished', request => { active.delete(request); cancelledByReload.delete(request); });
  page.on('requestfailed', request => {
    active.delete(request);
    const failure = request.failure()?.errorText;
    // Chromium can report the old document's cancellation after reload resolves.
    // Identify the exact already-open request, never a time window or new stream.
    const previousStream = cancelledByReload.delete(request);
    const reloadCancellation = previousStream && isStream(request) && failure === 'net::ERR_ABORTED';
    if (!reloadCancellation && failure === 'net::ERR_ABORTED' && channel(request)) { completedStreams.push(request); return; }
    if (!reloadCancellation) problems.push(`Failed request: ${request.url()} (${failure})`);
  });
  context.on('page', () => problems.push('Unexpected extra page: use the shared players fixture.'));
  return async () => {
    await Promise.all(inspections);
    for (const request of completedStreams) {
      const prior = channel(request)!;
      const advanced = received.has(request) && [...acknowledgedStreams].some(next => {
        const successor = channel(next)!;
        return successor.session === prior.session && successor.database === prior.database && successor.acknowledged > prior.acknowledged;
      });
      if (!advanced) problems.push('Unacknowledged cancelled Firestore stream: ' + request.url());
    }
    const expectedConsole = new Map<string, number>();
    for (const conflict of conflicts) {
      if (!acknowledgements.some(ack => ack.name === conflict.name && (ack.fields === null || ack.fields === conflict.fields))) problems.push('Unrecovered immutable event conflict: ' + conflict.name);
      expectedConsole.set(conflict.url, (expectedConsole.get(conflict.url) ?? 0) + 1);
    }
    for (const message of consoleErrors) {
      const expected = expectedConsole.get(message.url) ?? 0;
      if (expected && message.text === 'Failed to load resource: the server responded with a status of 409 (Conflict)') expectedConsole.set(message.url, expected - 1);
      else problems.push(message.text);
    }
  };
}
export const test = base.extend<{ browserHealth: void; players: Players }>({
  browserHealth: [async ({ context, page, baseURL }, use, info) => {
    const problems: string[] = [];
    const inspected = await monitor(context, page, baseURL!, problems);
    await use();
    await inspected();
    expect(problems, 'No browser errors, failed resources, or external requests').toEqual([]);
    assertStepsFinished(info);
  }, { auto: true }],
  players: async ({ browser, baseURL }, use, info) => {
    const contexts: BrowserContext[] = [];
    const checks: (() => Promise<void>)[] = [];
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
        checks.push(await monitor(context, page, baseURL!, problems, streams, cancelledByReload));
        return page;
      },
      readInvite: async page => {
        if (!pages.includes(page)) throw new Error('Unknown player page');
        const invite = await page.evaluate(() => navigator.clipboard.readText());
        const url = new URL(invite);
        if (url.origin !== new URL(baseURL!).origin || url.pathname !== new URL('rooms/', baseURL!).pathname || !url.searchParams.get('room')) throw new Error('Clipboard does not contain an invite to this preview.');
        return invite;
      },
      visit: async (page, url) => {
        if (!pages.includes(page)) throw new Error('Unknown player page');
        if (new URL(url).origin !== new URL(baseURL!).origin) throw new Error('Player navigation must stay on this deployment');
        for (const request of streams.get(page) ?? []) cancelledByReload.add(request);
        await page.goto(url);
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
      for (const inspect of checks) await inspect();
      expect(problems, 'No browser errors, failed resources, or external requests in any player context').toEqual([]);
      assertStepsFinished(info, pages);
    }
    finally { for (const context of contexts) await context.close(); }
  }
});
export { expect };
