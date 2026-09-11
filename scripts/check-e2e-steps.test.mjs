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
  return { ...steps, ...assertions, health: fixture.test.browserHealth };
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
  await assert.rejects(steps.step('empty', 'Empty check', [{ description: ' ', assert: async () => {} }]), /require a description/);
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
    ['requestfailed', { url: () => 'http://localhost/disconnected' }],
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
