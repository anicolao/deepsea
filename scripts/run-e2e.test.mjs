import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

for (const [name, args, env, message] of [
  ['selective test runs', ['--grep', 'splash'], {}, /Supported option/],
  ['baseline updates in CI', ['--update-snapshots'], { CI: 'true' }, /CI only verifies/],
  ['non-Nix execution', [], { IN_NIX_SHELL: '' }, /Run through nix develop/],
  ['mismatched browser versions', [], { DEEPSEA_PLAYWRIGHT_VERSION: '0.0.0' }, /must match/],
  ['system browser substitution', [], { PLAYWRIGHT_BROWSERS_PATH: '/usr/bin' }, /supplied by the Nix flake/],
  ['uncontrolled font configuration', [], { FONTCONFIG_FILE: '/tmp/fonts.conf' }, /supplied by the Nix flake/]
]) test(`runner rejects ${name} before building or starting a browser`, () => {
  const result = spawnSync(process.execPath, ['scripts/run-e2e.mjs', ...args], {
    env: { ...process.env, ...env }, encoding: 'utf8'
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, message);
  assert.doesNotMatch(result.stdout, /vite|Running \d+ tests/);
});
