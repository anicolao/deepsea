import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { previewErrors } from './check-preview.mjs';
const workflow = readFileSync('.github/workflows/verify-and-preview.yml', 'utf8');
test('every PR runs real browser journeys after deployment and verifies the reviewed revision', () => {
  assert.deepEqual(previewErrors(workflow), []);
  for (const text of ['  preview-smoke:', '    needs: publish', 'run: nix develop -c npm run test:preview', 'build/revision.json', 'PREVIEW_REVISION: ${{ github.event.pull_request.head.sha }}']) assert.notDeepEqual(previewErrors(workflow.replaceAll(text, 'removed')), []);
});

test('failed or skipped deployment cannot qualify as a working preview', () => {
  assert.notDeepEqual(previewErrors(workflow.replace("if: always() && github.event_name == 'pull_request'", 'if: false')), []);
  assert.notDeepEqual(previewErrors(workflow + '\ncontinue-on-error: true\n'), []);
});

test('the preview workflow passes the pinned actionlint validator', () => {
  const result = spawnSync('actionlint', [], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.error?.message ?? result.stdout + result.stderr);
});
