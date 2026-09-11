import { spawn, spawnSync } from 'node:child_process';
if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080' || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099') throw new Error('Tests require the configured local emulators.');
const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', '--config', 'vitest.integration.config.ts'], { stdio: 'inherit', env: process.env });
if (result.status !== 0) process.exit(result.status ?? 1);
const preview = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], { stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => preview.kill(signal));
preview.on('exit', code => process.exit(code ?? 1));
