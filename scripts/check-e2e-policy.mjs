import ts from 'typescript';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkConfig } from './check-e2e-config.mjs';
import { checkReviews } from './check-e2e-reviews.mjs';

const forbiddenCalls = new Set([
  'waitForTimeout', 'waitForFunction', 'waitForSelector', 'waitForLoadState',
  'waitForResponse', 'waitForRequest', 'waitForURL', 'waitFor',
  'setTimeout', 'setInterval', 'sleep', 'poll', 'toPass',
  'setDefaultTimeout', 'setDefaultNavigationTimeout', 'slow',
  'skip', 'fixme', 'only', 'screenshot', 'addStyleTag', 'addScriptTag',
  'setContent', 'addInitScript', 'evaluateHandle', '$eval', '$$eval',
  'dispatchEvent', 'setInputFiles', 'fulfill', 'routeFromHAR', 'unroute', 'unrouteAll',
  'newContext', 'newPage', 'launch', 'launchPersistentContext', 'connect',
  'setViewportSize', 'setOffline', 'emulateMedia', 'setSystemTime', 'setFixedTime', 'fastForward',
  'setExtraHTTPHeaders', 'addCookies', 'clearCookies', 'extend', 'use', 'configure',
  'setTimeout', 'toMatchSnapshot', 'random', 'now', 'eval', 'Function', 'require',
  'apply', 'bind', 'call', 'remove', 'removeChild', 'replaceChildren', 'setAttribute',
  'insertAdjacentHTML', 'write', 'writeFileSync'
]);
const forbiddenOptions = new Set([
  'mask', 'maskColor', 'stylePath', 'style', 'maxDiffPixels', 'maxDiffPixelRatio',
  'threshold', 'timeout', 'actionTimeout', 'navigationTimeout', 'retries',
  'animations', 'clip', 'omitBackground', 'force', 'caret', 'scale', 'fullPage',
  'innerHTML', 'outerHTML', 'textContent', 'testIdAttribute', 'storageState'
]);

export function policyErrors(source, filename) {
  const file = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true);
  const errors = [];
  const helper = filename.endsWith('/helpers/test-steps.ts');
  const fixture = filename.endsWith('/helpers/fixture.ts');
  const assertions = filename.endsWith('/helpers/assertions.ts');
  const report = (node, message) => {
    const { line } = file.getLineAndCharacterOfPosition(node.getStart(file));
    errors.push(`${filename}:${line + 1}: ${message}`);
  };
  const nameOf = (node) => ts.isIdentifier(node) || ts.isStringLiteral(node) ? node.text : undefined;
  if (filename.endsWith('.spec.ts')) {
    const imports = file.statements.filter(ts.isImportDeclaration);
    const fixtureImport = imports.find(node => node.moduleSpecifier.text === '../helpers/fixture');
    const bindings = fixtureImport?.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings) || !bindings.elements.some(node => node.name.text === 'test' && !node.propertyName) || !bindings.elements.some(node => node.name.text === 'expect' && !node.propertyName)) {
      report(file, 'Scenarios must import unaliased test and expect from ../helpers/fixture.');
    }
  }
  const seededConfig = (node) => fixture && node.getText(file) === 'route.fulfill({ response, json: { ...config, local: { ...config.local, initialSeed: seed, testRun }, preview: config.preview ? { ...config.preview, initialSeed: seed, testRun } : null } })';
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && node.initializer && ts.isIdentifier(node.initializer) && ['test', 'expect'].includes(node.initializer.text)) report(node, 'Do not alias the shared test or expect.');
    if (ts.isImportSpecifier(node) && node.propertyName && !fixture && !assertions) report(node, 'Do not alias E2E imports.');
    if (ts.isImportDeclaration(node)) {
      const module = node.moduleSpecifier.text;
      const permitted = filename.endsWith('.spec.ts')
        ? ['../helpers/fixture', '../helpers/test-steps']
        : helper ? ['@playwright/test', './assertions', 'node:fs', 'node:path']
          : fixture ? ['@playwright/test', './test-steps', './assertions']
            : assertions ? ['@playwright/test', 'node:async_hooks'] : [];
      if (!permitted.includes(module)) report(node, `Unapproved E2E import: ${module}`);
      if (module === '@playwright/test' && helper && /\bexpect\b/.test(node.importClause?.getText(file) ?? '')) {
        report(node, 'TestSteps must use the counted assertions.');
      }
    }
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      const name = ts.isPropertyAccessExpression(node) ? node.name.text : nameOf(node.argumentExpression);
      const trusted = seededConfig(node.parent) || seededConfig(node) || (fixture && ['extend', 'route', 'newContext', 'newPage', 'setOffline', 'setDefaultTimeout', 'setDefaultNavigationTimeout'].includes(name)) || (fixture && name === 'use' && node.expression.getText(file) === 'info.project') || (helper && name === 'writeFileSync') || (assertions && name === 'apply');
      if (!trusted && (forbiddenCalls.has(name) || name?.startsWith('waitFor'))) report(node, `Forbidden E2E member: ${name}`);
      if (name === 'toHaveScreenshot' && !helper) report(node, 'Only TestSteps may access screenshot assertions.');
      if (ts.isElementAccessExpression(node) && !helper && !assertions) report(node, 'Use named APIs, not computed member access.');
      if (['evaluate', 'route', 'on', 'once', 'off', 'removeAllListeners'].includes(name) && !(helper && name === 'evaluate') && !(fixture && (['route', 'on'].includes(name) || (name === 'evaluate' && node.parent.getText(file) === 'page.evaluate(() => navigator.clipboard.readText())')))) {
        report(node, `Only the shared infrastructure may use ${name}.`);
      }
    }
    if (ts.isNewExpression(node) && !(assertions && node.expression.getText(file) === 'AsyncLocalStorage') && !['TestSteps', 'Error', 'URL', 'Proxy', 'WeakMap', 'Map', 'Set'].includes(node.expression.getText(file))) report(node, 'Unapproved E2E constructor.');
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) report(node, 'Dynamic imports bypass E2E policy.');
    if (ts.isStringLiteral(node) && node.text === 'networkidle') report(node, 'Do not use networkidle.');
    if (ts.isBinaryExpression(node) && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment) {
      if (ts.isPropertyAccessExpression(node.left) && !node.left.expression.getText(file).startsWith('this')) report(node, 'Do not mutate browser/application properties.');
    }
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const name = ts.isPropertyAccessExpression(callee) ? callee.name.text
        : ts.isElementAccessExpression(callee) ? nameOf(callee.argumentExpression)
          : nameOf(callee);
      const trusted = seededConfig(node.parent) || seededConfig(node) || (fixture && ['extend', 'use', 'newContext', 'newPage', 'setOffline', 'setDefaultTimeout', 'setDefaultNavigationTimeout'].includes(name)) || (helper && name === 'writeFileSync') || (assertions && name === 'apply');
      if (!trusted && (forbiddenCalls.has(name) || name?.startsWith('waitFor'))) report(node, `Forbidden E2E call: ${name}`);
      if (name === 'expect' && ts.isIdentifier(callee) && node.arguments.length === 0) report(node, 'An assertion needs an observed value.');
      if (name === 'toHaveScreenshot' && (!filename.endsWith('/helpers/test-steps.ts') || node.arguments.length !== 1)) {
        report(node, 'Screenshots belong in TestSteps with one filename argument and no options.');
      }
    }
    if (ts.isPropertyAssignment(node) && forbiddenOptions.has(nameOf(node.name))) {
      report(node, `Do not override ${nameOf(node.name)} in a scenario or helper.`);
    }
    if (ts.isShorthandPropertyAssignment(node) && forbiddenOptions.has(node.name.text)) report(node, `Do not override ${node.name.text}.`);
    if (ts.isComputedPropertyName(node)) report(node, 'Computed option names bypass E2E policy.');
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
  const errors = [
    ...checkConfig(), ...(process.env.UPDATE_E2E_DOCS === '1' && !process.env.CI ? [] : checkReviews()),
    ...filesIn('tests/e2e').flatMap((path) => policyErrors(readFileSync(path, 'utf8'), path))
  ];
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
  console.log('E2E source policy passed.');
}
