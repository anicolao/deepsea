import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export function screenshotFiles(directory = 'tests/e2e') {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? screenshotFiles(path) : path.endsWith('.png') ? [path] : [];
  });
}

export const digest = bytes => createHash('sha256').update(bytes).digest('hex');

export function reviewErrors(files, reviews) {
  const errors = [];
  for (const [path, bytes] of Object.entries(files)) {
    const entry = reviews[path];
    if (!entry || entry.sha256 !== digest(bytes) || typeof entry.review !== 'string' || entry.review.trim().length < 20) {
      errors.push(`${path}: missing or stale visual review in E2E_REVIEWS.json (SHA-256 and specific review notes required).`);
    }
  }
  for (const path of Object.keys(reviews)) if (!(path in files)) errors.push(`${path}: review has no matching baseline.`);
  return errors;
}

export function checkReviews() {
  try {
    return reviewErrors(Object.fromEntries(screenshotFiles().map(path => [path, readFileSync(path)])), JSON.parse(readFileSync('E2E_REVIEWS.json', 'utf8')));
  } catch (error) {
    return [`Cannot validate baseline reviews: ${error.message}`];
  }
}
