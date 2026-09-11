import { execFileSync, spawnSync } from 'node:child_process';

function fail(message) {
  console.error(`Prompt log check failed: ${message}`);
  process.exit(1);
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

try {
  const entries = git(['ls-files', '--stage', '--', 'PROMPTS.md']);
  if (!/^100644 [0-9a-f]+ 0\tPROMPTS\.md\n$/.test(entries)) {
    fail('Stage PROMPTS.md as a regular file with the verbatim user prompts.');
  }

  const staged = git(['show', ':PROMPTS.md']);
  let previous = '';
  if (spawnSync('git', ['rev-parse', '--verify', 'HEAD'], { stdio: 'ignore' }).status === 0) {
    const tracked = git(['ls-tree', '--name-only', 'HEAD', '--', 'PROMPTS.md']);
    if (tracked.trim()) previous = git(['show', 'HEAD:PROMPTS.md']);
  }

  if (!staged.startsWith(previous)) {
    fail('Existing prompt history must remain unchanged; append new entries.');
  }
  const added = staged.slice(previous.length);
  if (!/(?:^|\n)## Prompt [1-9][0-9]*\n\n\S[\s\S]*/.test(added)) {
    fail('Append the new verbatim prompt under a new "## Prompt N" heading and stage PROMPTS.md.');
  }
  console.log('Prompt log check passed.');
} catch (error) {
  fail(`Unable to read staged prompt history: ${error.message}`);
}
