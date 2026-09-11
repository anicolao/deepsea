import { createHash } from 'node:crypto';
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
  if (!added && previous) {
    const work = git(['show', ':PROMPT_WORK.md']);
    const trackedWork = git(['ls-tree', '--name-only', 'HEAD', '--', 'PROMPT_WORK.md']);
    const oldWork = trackedWork.trim() ? git(['show', 'HEAD:PROMPT_WORK.md']) : '';
    const latest = [...staged.matchAll(/^## Prompt ([1-9][0-9]*): /gm)].at(-1)?.[1];
    const digest = createHash('sha256').update(staged).digest('hex');
    const line = work.slice(oldWork.length).trim();
    const parts = line.split(' | ');
    if (!work.startsWith(oldWork) || parts.length !== 3 || parts[0] !== 'Prompt ' + latest || parts[1] !== digest || !/^[^\n]{10,200}$/.test(parts[2]) || oldWork.includes(line)) {
      fail('Append a unique continuation for the latest prompt with its exact SHA-256 to PROMPT_WORK.md.');
    }
    console.log('Prompt continuation check passed.');
    process.exit(0);
  }
  if (!/(?:^|\n)## Prompt [1-9][0-9]*: \S+(?: \S+){1,2}\n\n\S[\s\S]*/.test(added)) {
    fail('Append the verbatim prompt under "## Prompt N: Summary" with a 2–3 word summary and stage PROMPTS.md.');
  }
  console.log('Prompt log check passed.');
} catch (error) {
  fail(`Unable to read staged prompt history: ${error.message}`);
}
