import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function infrastructure() {
  const load = (path, imports) => {
    const exports = {};
    const source = readFileSync(path, 'utf8');
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    runInNewContext(code, { exports, require: name => imports[name] ?? require(name), process, URL });
    return exports;
  };
  const assertions = load('tests/e2e/helpers/assertions.ts', {});
  const steps = load('tests/e2e/helpers/test-steps.ts', {
    './assertions': assertions,
    '@playwright/test': { test: { step: async (_title, body) => body() } }
  });
  const fixture = load('tests/e2e/helpers/fixture.ts', {
    '@playwright/test': { test: { extend: value => value } },
    './assertions': assertions,
    './test-steps': { assertStepsFinished() {} } // Step lifecycle has separate negative cases below.
  });
  return { ...steps, ...assertions, health: fixture.test.browserHealth, players: fixture.test.players };
}

test('runtime rejects missing TestSteps, omitted finish and empty walkthroughs', () => {
  const { TestSteps, assertStepsFinished } = infrastructure();
  assert.throws(() => assertStepsFinished({}), /Every scenario/);
  const info = {};
  const steps = new TestSteps({}, info, 'Title', 'Purpose');
  assert.throws(() => assertStepsFinished(info), /call finish/);
  assert.throws(() => steps.finish(), /at least one completed step/);
  assert.throws(() => new TestSteps({}, info, 'Title', 'Purpose'), /one TestSteps/);
});

test('runtime rejects semantic callbacks that execute no matcher before any screenshot', async () => {
  const { TestSteps } = infrastructure();
  const steps = new TestSteps({}, {}, 'Title', 'Purpose');
  await assert.rejects(steps.step('empty', 'Empty check', []), /semantic checks/);
  await assert.rejects(steps.step('empty', 'Empty check', [{ description: 'No assertion', assert: async () => {} }]), /execute an expect matcher/);
  await assert.rejects(steps.step('blank-description', 'Empty check', [{ description: ' ', assert: async () => {} }]), /require a description/);
});

test('counted assertions include negated and asynchronous matchers, not just expect construction', async () => {
  const { expect, assertionsPerformed } = infrastructure();
  expect(true);
  assert.equal(assertionsPerformed(), 0);
  expect(true).toBe(true);
  expect(true).not.toBe(false);
  await expect(Promise.resolve(42)).resolves.toBe(42);
  assert.equal(assertionsPerformed(), 3);
});

test('shared health fixture is automatic and rejects every browser/resource failure category', async () => {
  const { health } = infrastructure();
  assert.equal(health[1].auto, true);
  for (const [event, value] of [
    ['pageerror', new Error('uncaught failure')],
    ['console', { type: () => 'error', text: () => 'console failure' }],
    ['response', { status: () => 404, url: () => 'http://localhost/missing' }],
    ['requestfailed', { url: () => 'http://localhost/disconnected', failure: () => ({ errorText: 'net::ERR_FAILED' }) }],
    ['page', {}]
  ]) {
    const handlers = new Map();
    const page = { on: (name, handler) => handlers.set(name, handler) };
    const context = { route: async () => {}, on: page.on };
    await assert.rejects(health[0]({ context, page, baseURL: 'http://localhost/' }, async () => handlers.get(event)(value), {}), /No browser errors/);
  }
});

test('shared health fixture allows local assets and aborts external requests', async () => {
  const { health } = infrastructure();
  for (const external of [false, true]) {
    let handler;
    let aborted = false;
    let continued = false;
    const context = { route: async (_pattern, callback) => { handler = callback; }, on() {} };
    const page = { on() {} };
    const run = health[0]({ context, page, baseURL: 'http://localhost/' }, async () => {
      await handler({
        request: () => ({ url: () => external ? 'https://unexpected.invalid/font.woff' : 'http://localhost/font.woff' }),
        abort: async () => { aborted = true; }, continue: async () => { continued = true; }
      });
    }, {});
    if (external) await assert.rejects(run, /No browser errors/);
    else await run;
    assert.equal(aborted, external);
    assert.equal(continued, !external);
  }
});

function playerHarness() {
  const contexts = [];
  const browser = { newContext: async options => {
    const handlers = new Map();
    const context = {
      options, actionTimeout: null, navigationTimeout: null, closed: false, offline: false,
      on: (name, handler) => handlers.set(name, handler), route: async () => {},
      setDefaultTimeout: value => { context.actionTimeout = value; },
      setDefaultNavigationTimeout: value => { context.navigationTimeout = value; },
      setOffline: async value => { context.offline = value; },
      close: async () => { context.closed = true; },
      newPage: async () => page
    };
    const page = { context: () => context, on: context.on, reload: async () => {
      if (page.cancellation) handlers.get('requestfailed')(page.cancellation);
    }, cancellation: null, emit: (name, value) => handlers.get(name)(value) };
    contexts.push(context);
    return context;
  } };
  const info = { project: { use: { viewport: { width: 393, height: 852 }, deviceScaleFactor: 1, locale: 'en-CA', timezoneId: 'UTC', colorScheme: 'dark', contextOptions: { reducedMotion: 'reduce' }, actionTimeout: 2000, navigationTimeout: 2000 } } };
  return { browser, contexts, info };
}

test('additional contexts inherit canonical rendering, deadlines and cleanup', async () => {
  const { players } = infrastructure();
  const h = playerHarness();
  await players({ browser: h.browser, baseURL: 'http://localhost/' }, async factory => {
    const a = await factory.create(); const b = await factory.create();
    assert.notEqual(a.context(), b.context());
    await factory.setConnected(a, false);
    assert.equal(a.context().offline, true);
    await factory.setConnected(a, true);
    for (const context of h.contexts) {
      assert.equal(context.actionTimeout, 2000); assert.equal(context.navigationTimeout, 2000);
      assert.equal(context.options.locale, 'en-CA'); assert.equal(context.options.reducedMotion, 'reduce');
      assert.equal(context.options.serviceWorkers, 'block');
    }
  }, h.info);
  assert.ok(h.contexts.every(context => context.closed));
});

test('errors in a second player fail the scenario and still close all contexts', async () => {
  const { players } = infrastructure(); const h = playerHarness();
  await assert.rejects(players({ browser: h.browser, baseURL: 'http://localhost/' }, async factory => {
    await factory.create(); const guest = await factory.create();
    guest.emit('console', { type: () => 'error', text: () => 'guest failed' });
  }, h.info), /any player context/);
  assert.ok(h.contexts.every(context => context.closed));
});

test('reload cancellation classification is restricted to the exact stream, code and navigation', async () => {
  for (const [url, code, duringReload, allowed] of [
    ['http://127.0.0.1:8080/google.firestore.v1.Firestore/Listen/channel', 'net::ERR_ABORTED', true, true],
    ['http://127.0.0.1:8080/google.firestore.v1.Firestore/Listen/channel', 'net::ERR_FAILED', true, false],
    ['http://127.0.0.1:8080/missing-resource', 'net::ERR_ABORTED', true, false],
    ['http://127.0.0.1:8080/google.firestore.v1.Firestore/Listen/channel', 'net::ERR_ABORTED', false, false]
  ]) {
    const { players } = infrastructure(); const h = playerHarness();
    const run = players({ browser: h.browser, baseURL: 'http://localhost/' }, async factory => {
      const page = await factory.create();
      const failure = { url: () => url, failure: () => ({ errorText: code }) };
      if (duringReload) { page.cancellation = failure; await factory.reload(page); }
      else page.emit('requestfailed', failure);
    }, h.info);
    if (allowed) await run; else await assert.rejects(run, /any player context/);
  }
});
