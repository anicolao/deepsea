import ts from 'typescript';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const forbiddenCalls = new Set([
  'waitForTimeout', 'waitForFunction', 'waitForSelector', 'waitForLoadState',
  'waitForResponse', 'waitForRequest', 'waitForURL', 'waitFor',
  'setTimeout', 'setInterval', 'sleep', 'poll', 'toPass',
  'setDefaultTimeout', 'setDefaultNavigationTimeout', 'slow',
  'skip', 'fixme', 'only', 'screenshot', 'addStyleTag'
]);
const forbiddenOptions = new Set([
  'mask', 'maskColor', 'stylePath', 'style', 'maxDiffPixels', 'maxDiffPixelRatio',
  'threshold', 'timeout', 'actionTimeout', 'navigationTimeout', 'retries',
  'animations', 'clip', 'omitBackground', 'force'
]);

export function policyErrors(source, filename) {
  const file = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true);
  const errors = [];
  const report = (node, message) => {
    const { line } = file.getLineAndCharacterOfPosition(node.getStart(file));
    errors.push(`${filename}:${line + 1}: ${message}`);
  };
  const nameOf = (node) => ts.isIdentifier(node) || ts.isStringLiteral(node) ? node.text : undefined;
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const name = ts.isPropertyAccessExpression(callee) ? callee.name.text
        : ts.isElementAccessExpression(callee) ? nameOf(callee.argumentExpression)
          : nameOf(callee);
      if (forbiddenCalls.has(name)) report(node, `Forbidden E2E call: ${name}`);
      if (name === 'toHaveScreenshot' && (!filename.endsWith('/helpers/test-steps.ts') || node.arguments.length !== 1)) {
        report(node, 'Screenshots belong in TestSteps with one filename argument and no options.');
      }
    }
    if (ts.isPropertyAssignment(node) && forbiddenOptions.has(nameOf(node.name))) {
      report(node, `Do not override ${nameOf(node.name)} in a scenario or helper.`);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return errors;
}

function filesIn(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesIn(path) : /\.[cm]?[jt]s$/.test(path) ? [path] : [];
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = filesIn('tests/e2e').flatMap((path) => policyErrors(readFileSync(path, 'utf8'), path));
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
  console.log('E2E source policy passed.');
}
