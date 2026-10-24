import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';

test('service worker file list and version are up to date', () => {
  const tool = new URL('../tools/gen-precache.mjs', import.meta.url);
  assert.doesNotThrow(() => execFileSync(process.execPath, [tool.pathname, '--check'], { stdio: 'pipe' }),
    'run npm run precache');
});
