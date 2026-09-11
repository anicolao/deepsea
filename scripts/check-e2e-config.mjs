import ts from 'typescript';
import { checkPreview } from './check-preview.mjs';
import { runInNewContext } from 'node:vm';
import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';

export function loadConfig(source, env = {}) {
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  runInNewContext(code, {
    exports,
    process: { env },
    require(name) {
      if (name !== '@playwright/test') throw new Error('Unexpected config import');
      return { defineConfig: (value) => value };
    }
  }, { timeout: 1000 });
  return JSON.parse(JSON.stringify(exports.default, (_key, value) => {
    if (typeof value === 'function' || typeof value === 'undefined') throw new Error('Config must be declarative');
    return value;
  }));
}

export function configErrors(source, contract) {
  try {
    for (const env of [{}, { CI: 'true' }, { CI: 'true', PUBLIC_BASE_PATH: '/deepsea/pr-contract-check' }, { CI: 'true', LIVE_PREVIEW_URL: 'https://anicolao.github.io/deepsea/pr5/' }]) {
      const expected = structuredClone(contract);
      if (env.PUBLIC_BASE_PATH) {
        expected.use.baseURL = `http://127.0.0.1:4173${env.PUBLIC_BASE_PATH}/`;
        expected.webServer.url = expected.use.baseURL;
      }
      if (env.LIVE_PREVIEW_URL) { expected.use.baseURL = env.LIVE_PREVIEW_URL; delete expected.webServer; }
      if (!isDeepStrictEqual(loadConfig(source, env), expected)) return [
        'Playwright configuration differs from scripts/e2e-contract.json: preserve zero tolerances, timing, full discovery, canonical projects/browser, and fresh production server.'
      ];
    }
    return [];
  } catch (error) {
    return [`Cannot validate Playwright configuration: ${error.message}`];
  }
}

export function checkConfig() {
  const scripts = JSON.parse(readFileSync('package.json', 'utf8')).scripts;
  const required = {
    verify: 'npm run check && npm test && npm run test:unit && npm run test:e2e',
    'test:unit': 'vitest run',
    'test:preview': 'node scripts/run-e2e.mjs --live-preview',
    test: 'node --test scripts/*.test.mjs',
    'test:e2e': 'node scripts/run-e2e.mjs',
    'test:e2e:update': 'node scripts/run-e2e.mjs --update-snapshots',
    build: 'vite build',
    preview: 'vite preview --host 127.0.0.1 --port 4173 --strictPort',
    check: 'svelte-kit sync && svelte-check --tsconfig ./tsconfig.json'
  };
  return [
    ...checkPreview(),
    ...configErrors(readFileSync('playwright.config.ts', 'utf8'), JSON.parse(readFileSync('scripts/e2e-contract.json', 'utf8'))),
    ...Object.entries(required).filter(([name, value]) => scripts[name] !== value).map(([name]) => `package.json script ${name} must run the complete verification contract.`)
  ];
}
