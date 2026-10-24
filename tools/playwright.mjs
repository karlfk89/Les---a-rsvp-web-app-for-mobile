// Loads Playwright from the project or, if not installed there, from the
// global npm modules (the cloud dev environment ships it globally).
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function load() {
  try {
    return require('playwright');
  } catch {
    const globalRoot = execSync('npm root -g').toString().trim();
    return require(`${globalRoot}/playwright`);
  }
}

export const { chromium, devices } = load();
