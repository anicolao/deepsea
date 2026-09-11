import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const initial = '# Project prompts\n\n## Prompt 1: First Prompt\n\nFirst user prompt.\n';
const next = '\n## Prompt 2: Next User Prompt\n\nNext user prompt.\n';

function fixture(t) {
  const cwd = mkdtempSync(join(tmpdir(), 'deepsea-prompts-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const env = { ...process.env, HUSKY: '1', IN_NIX_SHELL: '1', XDG_CONFIG_HOME: join(cwd, 'config') };
  const git = (...args) => execFileSync('git', args, { cwd, env, stdio: 'pipe' });
  git('init');
  git('config', 'user.name', 'Hook Test');
  git('config', 'user.email', 'hook-test@example.invalid');
  git('config', 'commit.gpgsign', 'false');
  mkdirSync(join(cwd, '.husky'));
  mkdirSync(join(cwd, 'scripts'));
  // These fixtures exercise prompt enforcement through the real hook. Stub the
  // separate app verifier so its own guard tests do not recursively run themselves.
  writeFileSync(join(cwd, 'package.json'), JSON.stringify({ scripts: { verify: 'node -e "process.exit(0)"' } }));
  for (const path of ['.husky/pre-commit', 'scripts/check-prompts.mjs']) {
    copyFileSync(join(root, path), join(cwd, path));
  }
  execFileSync(process.execPath, [join(root, 'node_modules/husky/bin.js')], { cwd, env });
  const write = (value) => writeFileSync(join(cwd, 'PROMPTS.md'), value);
  const commit = () => spawnSync('git', ['commit', '--allow-empty', '-m', 'Test'], {
    cwd, env, encoding: 'utf8',
  });
  const seed = () => {
    write(initial);
    git('add', 'PROMPTS.md');
    const result = commit();
    assert.equal(result.status, 0, result.stderr);
  };
  return { git, write, commit, seed };
}

function rejected(result) {
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /Prompt log check failed/);
}

test('initial commit without a prompt log is rejected', (t) => {
  rejected(fixture(t).commit());
});

test('initial commit with a staged prompt succeeds', (t) => {
  fixture(t).seed();
});

test('unchanged log is rejected after the initial commit', (t) => {
  const f = fixture(t);
  f.seed();
  rejected(f.commit());
});

test('an unstaged new prompt is rejected', (t) => {
  const f = fixture(t);
  f.seed();
  f.write(initial + next);
  rejected(f.commit());
});

test('a staged new prompt succeeds', (t) => {
  const f = fixture(t);
  f.seed();
  f.write(initial + next);
  f.git('add', 'PROMPTS.md');
  const result = f.commit();
  assert.equal(result.status, 0, result.stderr);
});

test('rewriting earlier prompts is rejected even with a new entry', (t) => {
  const f = fixture(t);
  f.seed();
  f.write(initial.replace('First', 'Changed') + next);
  f.git('add', 'PROMPTS.md');
  rejected(f.commit());
});

test('deleting the prompt log is rejected', (t) => {
  const f = fixture(t);
  f.seed();
  f.git('rm', 'PROMPTS.md');
  rejected(f.commit());
});

test('whitespace or an empty prompt entry is rejected', (t) => {
  const f = fixture(t);
  f.seed();
  for (const addition of ['\n  \n', '\n## Prompt 2: Empty Prompt\n\n   \n']) {
    f.write(initial + addition);
    f.git('add', 'PROMPTS.md');
    rejected(f.commit());
  }
});

test('missing, short, or long summaries are rejected', (t) => {
  const f = fixture(t);
  f.seed();
  for (const heading of ['## Prompt 2', '## Prompt 2: Summary', '## Prompt 2: This Has Four Words']) {
    f.write(initial + `\n${heading}\n\nVerbatim prompt.\n`);
    f.git('add', 'PROMPTS.md');
    rejected(f.commit());
  }
});
