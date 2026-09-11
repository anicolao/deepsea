import { test, type Page, type TestInfo } from '@playwright/test';
import { expect, assertionsPerformed } from './assertions';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

type Check = { description: string; assert: () => Promise<unknown> };
type CompletedStep = { id: string; title: string; checks: string[] };
const scenarios = new WeakMap<TestInfo, Map<string, TestSteps>>();

export function assertStepsFinished(info: TestInfo, pages: Page[] = []) {
  const steps = scenarios.get(info);
  if (!steps || [...steps.values()].some(view => !view.finished)) throw new Error('Every scenario must construct TestSteps, run semantic steps, and call finish().');
  if (pages.some(page => ![...steps.values()].some(view => view.uses(page)))) throw new Error('Every player context needs a completed named view.');
}

export class TestSteps {
  private completed: CompletedStep[] = [];
  private ids = new Set<string>();
  finished = false;
  uses(page: Page) { return this.page === page; }

  constructor(
    private page: Page,
    private info: TestInfo,
    private title: string,
    private description: string,
    private viewId = 'primary',
    private layout: 'splash' | 'room' | 'game' = 'splash'
  ) {
    if (!/^[a-z][a-z0-9-]*$/.test(viewId)) throw new Error('Use a stable named player view.');
    const views = scenarios.get(info) ?? new Map<string, TestSteps>();
    if (views.has(viewId)) throw new Error('Use one TestSteps walkthrough per named player view.');
    views.set(viewId, this);
    scenarios.set(info, views);
  }

  roomLayout() { this.layout = 'room'; }
  gameLayout() { this.layout = 'game'; }

  async step(id: string, title: string, checks: Check[]) {
    if (this.finished || !title.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || !checks.length) {
      throw new Error('Each step needs a stable kebab-case ID and semantic checks.');
    }
    if (this.ids.has(id)) throw new Error('Duplicate step ID');
    this.ids.add(id);
    const numberedId = `${String(this.completed.length).padStart(3, '0')}-${id}${this.viewId === 'primary' ? '' : `-${this.viewId}`}`;
    await test.step(title, async () => {
      for (const check of checks) await test.step(check.description, async () => {
        if (!check.description.trim()) throw new Error('Semantic checks require a description.');
        const before = assertionsPerformed();
        await check.assert();
        if (assertionsPerformed() === before) throw new Error('Each semantic check must execute an expect matcher.');
      });
      await expect(this.page.locator('body')).toBeVisible();
      // Readiness is a condition on local fonts, not a delay or screenshot-only style change.
      await expect(this.page.locator('html')).toHaveJSProperty('lang', 'en');
      expect(await this.page.evaluate(() => document.fonts.status)).toBe('loaded');
      const layoutProblems = await this.page.evaluate((layout) => {
        const errors: string[] = [];
        const root = document.documentElement;
        if (root.scrollWidth > innerWidth || root.scrollHeight > innerHeight) errors.push('Splash overflows viewport');
        const modal = document.querySelector('dialog[open]');
        const scope = modal ?? document.querySelector('main')!;
        if (layout === 'game') {
          for (const selector of ['[data-game-path]', '[data-game-actions]']) {
            const region = document.querySelector<HTMLElement>(selector);
            if (!region || !region.checkVisibility()) { errors.push(`Missing visible ${selector}`); continue; }
            const bounds = region.getBoundingClientRect();
            if (bounds.top < 0 || bounds.left < 0 || bounds.bottom > innerHeight || bounds.right > innerWidth || bounds.height <= 0) errors.push(`Unreachable ${selector}`);
            if (selector === '[data-game-path]' && !['auto', 'scroll'].includes(getComputedStyle(region).overflowY)) errors.push('Game path needs its own scroll container');
          }
        }
        for (const element of scope.querySelectorAll<HTMLElement>('h1, h2, p, li, button, footer, input, label, dt, dd')) {
          if (!element.checkVisibility()) continue;
          if (layout === 'game' && element.closest('[data-game-path]')) continue;
          const rect = element.getBoundingClientRect();
          if (rect.left < 0 || rect.top < 0 || rect.right > innerWidth || rect.bottom > innerHeight) {
            errors.push(`Clipped ${element.tagName}: ${element.textContent?.trim()}`);
          }
          if (element.tagName === 'BUTTON' && (rect.width < 44 || rect.height < 44)) errors.push('Touch target smaller than 44px');
        }
        const visibleBox = (element: HTMLElement) => {
          const box = element.getBoundingClientRect();
          const panel = layout === 'game' ? element.closest('[data-game-path]') : null;
          if (!panel) return box;
          const clip = panel.getBoundingClientRect();
          return { left: Math.max(box.left,clip.left), right: Math.min(box.right,clip.right), top: Math.max(box.top,clip.top), bottom: Math.min(box.bottom,clip.bottom) };
        };
        const controls = Array.from(scope.querySelectorAll<HTMLElement>('button, a, input, select')).filter((element) => {
          const box = visibleBox(element);
          return element.checkVisibility() && box.right > box.left && box.bottom > box.top;
        });
        for (let left = 0; left < controls.length; left++) {
          for (let right = left + 1; right < controls.length; right++) {
            const a = visibleBox(controls[left]);
            const b = visibleBox(controls[right]);
            if (Math.min(a.right, b.right) > Math.max(a.left, b.left) && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top)) errors.push('Interactive controls overlap');
          }
        }
        return errors;
      }, this.layout);
      expect(layoutProblems, 'Splash content fits and controls remain reachable').toEqual([]);
      await expect(this.page).toHaveScreenshot(`${numberedId}.png`);
    });
    this.completed.push({ id: numberedId, title, checks: checks.map((check) => check.description) });
  }

  finish() {
    if (this.finished || !this.completed.length) throw new Error('Finish exactly once, after at least one completed step.');
    this.finished = true;
    const views = [...scenarios.get(this.info)!.values()];
    if (this.info.project.name !== 'desktop' || views.some(view => !view.finished)) return;
    const first = views[0];
    const content = [
      `# ${first.title}`,
      '',
      '> Generated by TestSteps from the passing browser scenario. Do not edit manually.',
      '',
      first.description,
      ...views.flatMap(view => [
      ...(views.length > 1 ? ['', `## ${view.viewId}`, '', view.description] : []),
      ...view.completed.flatMap((step) => [
        '', `## ${step.title}`, '',
        ...step.checks.map((check) => `- ${check}`),
        '', `![Desktop: ${step.title}](screenshots/${step.id}-desktop.png)`,
        '', `![Phone: ${step.title}](screenshots/${step.id}-phone.png)`
      ])]),
      ''
    ].join('\n');
    const path = join(dirname(this.info.file), 'README.md');
    if (process.env.UPDATE_E2E_DOCS === '1') writeFileSync(path, content);
    else expect(readFileSync(path, 'utf8'), 'Walkthrough matches the tested steps').toBe(content);
  }
}
