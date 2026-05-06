#!/usr/bin/env node
/**
 * Post-prebuild assertion: the Android AppTheme matches what the
 * with-android-light-theme config plugin is supposed to produce.
 *
 * Why this exists: `expo prebuild --clean` regenerates the entire
 * android/ directory from scratch. If the config plugin is ever
 * removed from app.json (or breaks silently), prebuild would fall
 * back to Expo's default `Theme.AppCompat.DayNight.NoActionBar`,
 * which re-introduces the back-press dark flash on phones in dark
 * mode. This script catches that regression.
 *
 * Run after every `expo prebuild` (or wire it into the build
 * pipeline). Exits 0 on pass, 1 on fail. No-ops if android/ has
 * not been generated yet (i.e. on a fresh clone or in CI without
 * prebuild).
 *
 * Usage:
 *   node scripts/check-android-theme.mjs
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const STYLES_PATH = resolve(REPO_ROOT, 'android/app/src/main/res/values/styles.xml');

const REQUIRED = [
  {
    label: 'AppTheme parent → Theme.AppCompat.Light.NoActionBar',
    pattern: /<style\s+name="AppTheme"\s+parent="Theme\.AppCompat\.Light\.NoActionBar"/,
    why: 'DayNight parent re-introduces the back-press dark flash on dark-mode phones.',
  },
  {
    label: 'android:windowBackground → @color/appCanvas',
    pattern: /<item\s+name="android:windowBackground">@color\/appCanvas<\/item>/,
    why: 'Without this, the Activity window paints the system default and bleeds through transitions.',
  },
  {
    label: 'android:forceDarkAllowed → false',
    pattern: /<item\s+name="android:forceDarkAllowed">false<\/item>/,
    why: 'Android 10+ will otherwise auto-darken cream surfaces.',
  },
];

function pass(label) {
  console.log(`  ✓ ${label}`);
}

function fail(label, why) {
  console.error(`  ✗ ${label}`);
  console.error(`      ${why}`);
}

function main() {
  if (!existsSync(STYLES_PATH)) {
    console.log('[check-android-theme] android/ not generated yet — skipping.');
    process.exit(0);
  }

  const xml = readFileSync(STYLES_PATH, 'utf8');
  let failures = 0;

  console.log(`[check-android-theme] ${STYLES_PATH}`);
  for (const r of REQUIRED) {
    if (r.pattern.test(xml)) {
      pass(r.label);
    } else {
      fail(r.label, r.why);
      failures += 1;
    }
  }

  if (failures > 0) {
    console.error(
      `\n[check-android-theme] FAILED — ${failures} assertion(s) did not match.\n` +
      `The with-android-light-theme config plugin may have been removed from\n` +
      `app.json, or prebuild may have regenerated styles.xml without it.\n`,
    );
    process.exit(1);
  }

  console.log('[check-android-theme] OK — theme matches the back-press-flash fix.');
}

main();
