import { readFileSync } from 'node:fs';
// This structural gate protects the required deployment path. Its actual result
// is tested by preview-smoke against the exact published revision.
export function previewErrors(workflow) {
  const required = [
    "    if: always() && github.event_name == 'pull_request'",
    "        if: needs.publish.result != 'success'",
    '  preview-smoke:', '    needs: publish', '    needs: verify',
    'LIVE_PREVIEW_URL: https://anicolao.github.io/deepsea/pr${{ github.event.number }}/',
    'PREVIEW_REVISION: ${{ github.event.pull_request.head.sha }}',
    'run: nix develop -c npm run test:preview',
    'build/revision.json',
    "GET /repos/{owner}/{repo}/pages/builds/{build_id}"
  ];
  const errors = /continue-on-error:\s*true/.test(workflow) ? ['Preview/verification failures must not be ignored.'] : [];
  return [...errors, ...required.filter(text => !workflow.includes(text)).map(text => `Required usable PR preview contract missing: ${text}`)];
}
export function checkPreview() {
  return previewErrors(readFileSync('.github/workflows/verify-and-preview.yml', 'utf8'));
}
