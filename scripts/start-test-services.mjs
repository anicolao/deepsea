import { spawn } from 'node:child_process';
if (!process.env.IN_NIX_SHELL) throw new Error('Start test services through nix develop');
const child = spawn(process.execPath, ['node_modules/firebase-tools/lib/bin/firebase.js', 'emulators:exec', '--project', 'demo-deepsea', '--only', 'auth,firestore', 'node scripts/serve-test.mjs'], { stdio: 'inherit', env: { ...process.env, CI: 'true' } });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill('SIGINT'));
child.on('error', error => { console.error(error); process.exit(1); });
child.on('exit', code => process.exit(code ?? 1));
