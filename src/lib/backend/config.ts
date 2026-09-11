export type BackendConfig = { mode: 'local' | 'preview' | 'production'; initialSeed?: number; namespace?: string; projectId: string; apiKey: string; appId?: string; authDomain?: string; authHost?: string; firestoreHost?: string };
type Hosted = { initialSeed?: number; projectId: string; apiKey: string; appId: string; authDomain: string };
export type DeploymentConfig = { local: { initialSeed?: number; projectId: string; authHost: string; firestoreHost: string }; preview: Hosted | null; production: Hosted | null };
export function selectConfig(config: DeploymentConfig, url: URL): BackendConfig {
  if (!config || !config.local) throw new Error('Room setup is not available on this deployment yet.');
  if (['localhost', '127.0.0.1'].includes(url.hostname)) {
    if (!config.local.projectId.startsWith('demo-') || config.local.authHost !== '127.0.0.1:9099' || config.local.firestoreHost !== '127.0.0.1:8080') throw new Error('Invalid local room configuration.');
    return { ...config.local, mode: 'local', namespace: 'local', apiKey: 'local-emulator-key' };
  }
  if (url.origin !== 'https://anicolao.github.io' || !url.pathname.startsWith('/deepsea/')) throw new Error('Room setup is not available on this deployment yet.');
  if (url.pathname.startsWith('/deepsea/pr') && !/^\/deepsea\/pr[0-9]+\//.test(url.pathname)) throw new Error('Invalid preview room configuration.');
  const mode = /^\/deepsea\/pr[0-9]+\//.test(url.pathname) ? 'preview' : 'production';
  const selected = config[mode];
  if (!selected) throw new Error('Room setup is not available on this deployment yet.');
  if (!selected.projectId || selected.projectId.startsWith('demo-') || !selected.apiKey || !selected.appId || !selected.authDomain ||
    (config.preview && config.production && config.preview.projectId === config.production.projectId)) throw new Error('Invalid room environment configuration.');
  if (mode === 'production' && selected.initialSeed !== undefined) throw new Error('Production games require fresh randomness.');
  if (selected.initialSeed !== undefined && (!Number.isInteger(selected.initialSeed) || selected.initialSeed < 0 || selected.initialSeed > 0xffffffff)) throw new Error('Invalid initialization seed.');
  return { ...selected, mode, namespace: mode === 'preview' ? url.pathname.split('/')[2] : 'production' };
}
