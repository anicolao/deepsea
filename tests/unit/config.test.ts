import { it, expect } from 'vitest';
import config from '../../static/backend.json';
import { selectConfig, type DeploymentConfig } from '../../src/lib/backend/config';
it('requires a demo project on explicit loopback endpoints', () => {
  expect(selectConfig(config, new URL('http://127.0.0.1:4173/deepsea/pr-e2e/rooms/')).mode).toBe('local');
  expect(() => selectConfig({ ...config, local: { ...config.local, projectId: 'live-project' } }, new URL('http://localhost/'))).toThrow();
  expect(() => selectConfig({ ...config, local: { ...config.local, authHost: 'example.com:9099' } }, new URL('http://localhost/'))).toThrow();
});
it('never falls back to production or loopback on hosted previews or unknown origins', () => {
  for (const url of ['https://anicolao.github.io/deepsea/pr5/rooms/', 'https://anicolao.github.io/deepsea/rooms/', 'https://example.com/rooms/']) expect(() => selectConfig({ ...config, preview: null, production: null }, new URL(url))).toThrow();
});
it('requires distinct explicitly configured live environments', () => {
  const hosted = { projectId: 'preview', apiKey: 'public-key', appId: 'app', authDomain: 'preview.firebaseapp.com' };
  const configured: DeploymentConfig = { ...config, preview: hosted, production: { ...hosted, projectId: 'production' } };
  expect(selectConfig(configured, new URL('https://anicolao.github.io/deepsea/pr5/rooms/')).projectId).toBe('preview');
  expect(selectConfig(configured, new URL('https://anicolao.github.io/deepsea/pr5/rooms/')).namespace).toBe('pr5');
  expect(selectConfig(configured, new URL('https://anicolao.github.io/deepsea/pr6/rooms/')).namespace).toBe('pr6');
  expect(selectConfig(configured, new URL('https://anicolao.github.io/deepsea/rooms/')).projectId).toBe('production');
  expect(() => selectConfig({ ...configured, production: hosted }, new URL('https://anicolao.github.io/deepsea/pr5/rooms/'))).toThrow();
});

it('connects retained previews to their isolated live namespace', () => {
  const selected = selectConfig(config, new URL('https://anicolao.github.io/deepsea/pr5/rooms/'));
  expect(selected.mode).toBe('preview');
  expect(selected.projectId).toBe('deepsea-preview-anicolao');
  expect(selected.namespace).toBe('pr5');
  expect(selected.authHost).toBeUndefined();
  expect(selected.firestoreHost).toBeUndefined();
});
