import { execFileSync } from 'node:child_process';

try {
  const git = args => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const unstaged = git(['diff', '--name-only']);
  const untracked = git(['ls-files', '--others', '--exclude-standard']);
  if (unstaged || untracked) throw new Error(`Stage all verification inputs before committing:\n${unstaged}${untracked}`);
} catch (error) {
  console.error(`Staged tree check failed: ${error.message}`);
  process.exit(1);
}
