/**
 * Config plugin: with-android-light-theme
 *
 * Permanent fix for the Android back-press dark flash.
 *
 * The flash is the Activity window background showing through during native
 * stack transitions. Without this plugin, `expo prebuild` generates a
 * `Theme.AppCompat.DayNight.NoActionBar` AppTheme — under system dark mode the
 * `windowBackground` resolves to a dark surface, which peeks through any time
 * react-native-screens slides a screen out.
 *
 * This plugin runs on every prebuild and:
 *   - Switches AppTheme parent to `Theme.AppCompat.Light.NoActionBar` (the app
 *     is light-only by design — `userInterfaceStyle: "light"` in app.json).
 *   - Pins `android:windowBackground` to `@color/appCanvas` (#FBF5EE).
 *   - Sets `android:forceDarkAllowed=false` to block Android 10+ forced dark.
 *   - Adds the `appCanvas` color resource so the theme can reference it.
 *
 * Without this in plugins[], `prebuild --clean` will regenerate styles.xml
 * from scratch and re-introduce the flash. Do not delete.
 */

const {
  withAndroidStyles,
  withAndroidColors,
  withAndroidManifest,
  AndroidConfig,
} = require('@expo/config-plugins');

const CANVAS_HEX = '#FBF5EE';

function upsertItem(items, name, value) {
  const idx = items.findIndex((it) => it.$ && it.$.name === name);
  if (idx >= 0) {
    items[idx]._ = value;
  } else {
    items.push({ $: { name }, _: value });
  }
}

function applyAppThemeOverrides(stylesResult) {
  const styles = stylesResult.resources.style || [];
  const appTheme = styles.find((s) => s.$ && s.$.name === 'AppTheme');
  if (!appTheme) return;

  // Force the parent to Light so DayNight cannot auto-darken windowBackground.
  appTheme.$.parent = 'Theme.AppCompat.Light.NoActionBar';

  appTheme.item = appTheme.item || [];
  upsertItem(appTheme.item, 'android:windowBackground', '@color/appCanvas');
  upsertItem(appTheme.item, 'android:forceDarkAllowed', 'false');
}

const withLightTheme = (config) => {
  // 1. Mutate styles.xml on every prebuild.
  config = withAndroidStyles(config, (mod) => {
    applyAppThemeOverrides(mod.modResults);
    return mod;
  });

  // 2. Make sure the appCanvas color resource exists.
  config = withAndroidColors(config, (mod) => {
    mod.modResults = AndroidConfig.Colors.assignColorValue(mod.modResults, {
      name: 'appCanvas',
      value: CANVAS_HEX,
    });
    return mod;
  });

  // 3. Disable Android 14 predictive back gesture system animation.
  //
  // Without this, Android paints a dim scrim over the outgoing screen
  // during back transitions — which IS the dark overlay you saw on
  // personalize-intro → credibility back. react-native-screens / React
  // Navigation does not yet implement the predictive back contract, so
  // the OS-level preview animation conflicts with the JS slide animation
  // and produces a half-rendered, dimmed view.
  //
  // Setting this flag to "false" on the <application> tag opts out of
  // the system animation entirely; the JS slide animation runs alone
  // and back transitions stay clean.
  config = withAndroidManifest(config, (mod) => {
    const app = mod.modResults.manifest.application?.[0];
    if (app) {
      app.$ = app.$ || {};
      app.$['android:enableOnBackInvokedCallback'] = 'false';
    }
    return mod;
  });

  return config;
};

module.exports = withLightTheme;
