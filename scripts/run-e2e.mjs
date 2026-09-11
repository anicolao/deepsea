import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const version = require('@playwright/test/package.json').version;
const args = process.argv.slice(2);
if (!process.env.IN_NIX_SHELL || process.env.DEEPSEA_PLAYWRIGHT_VERSION !== version) {
  console.error('Run through nix develop. The npm Playwright version must match the browser version pinned by flake.lock.');
  process.exit(1);
}
if (process.platform !== 'linux' || process.arch !== 'x64') {
  console.error('Canonical screenshots require the x86_64-linux Nix shell (use Linux CI on other platforms).');
  process.exit(1);
}
if (!process.env.PLAYWRIGHT_BROWSERS_PATH?.startsWith('/nix/store/') || !process.env.FONTCONFIG_FILE?.startsWith('/nix/store/')) {
  console.error('Use the browser distribution and font configuration supplied by the Nix flake.');
  process.exit(1);
}
if (args.some((arg) => !['--update-snapshots', '--live-preview'].includes(arg))) {
  console.error('Supported options: --update-snapshots or --live-preview. Configure projects and policies in playwright.config.ts.');
  process.exit(1);
}
const live = args.includes('--live-preview');
if (live) {
  if (args.length !== 1 || !/^https:\/\/anicolao\.github\.io\/deepsea\/pr[1-9][0-9]*\/$/.test(process.env.LIVE_PREVIEW_URL ?? '')) throw new Error('Live smoke requires an exact retained PR preview URL.');
  const configuration = JSON.parse(readFileSync('static/backend.json', 'utf8'));
  if (!configuration.preview || configuration.preview.projectId === configuration.production?.projectId) throw new Error('Configure an isolated live preview backend first.');
  if (process.env.PREVIEW_REVISION) {
    const response = await fetch(new URL('revision.json', process.env.LIVE_PREVIEW_URL), { cache: 'no-store' });
    if (!response.ok || (await response.json()).revision !== process.env.PREVIEW_REVISION) throw new Error('The deployed preview is not the revision under review.');
  }
} else if (process.env.LIVE_PREVIEW_URL) throw new Error('Use --live-preview to run against a hosted preview.');
const updating = args.includes('--update-snapshots');
if (updating && process.env.CI) {
  console.error('CI only verifies committed screenshots; update and review baselines locally.');
  process.exit(1);
}
const env = {
  ...process.env,
  PUBLIC_BASE_PATH: process.env.PUBLIC_BASE_PATH ?? '/deepsea/pr-e2e',
  UPDATE_E2E_DOCS: updating ? '1' : '0'
};
for (const [command, commandArgs] of [
  ['node', ['scripts/check-e2e-policy.mjs']],
  ...(!live ? [
    ['node', ['node_modules/firebase-tools/lib/bin/firebase.js', 'setup:emulators:firestore']],
    ['npm', ['run', 'build']]
  ] : []),
  ['node', ['node_modules/@playwright/test/cli.js', 'test', ...args.filter(arg => arg !== '--live-preview')]]
]) {
  const result = spawnSync(command, commandArgs, { env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
