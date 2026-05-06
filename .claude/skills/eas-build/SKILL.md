---
name: eas-build
description: EAS build and submit workflow for Mello. Apply when the user talks about eas.json, build profiles (development/preview/production), adding env vars, EAS secrets, bundle ids, OTA updates, TestFlight, Play Console, iOS provisioning, or ships errors from `eas build` / `eas submit`. Enforces the three-profile structure and the app.config.js → config/env.ts contract.
---

# eas-build skill

Use for any EAS workflow or env var change. Mello's EAS config lives in `eas.json`, build-time env comes from `app.config.js`, runtime access goes through `config/env.ts`.

## Build profiles (`eas.json`)

- **development** — dev client with hot reload; installs on your device for live iteration
- **preview** — internal beta (TestFlight internal / Play internal sharing)
- **production** — store release; `autoIncrement: true` bumps build number

All three currently share these env vars: `HUME_CONFIG_ID`, `LIVEKIT_API_URL`, `AWS_BEDROCK_REGION`, `AWS_BEDROCK_MODEL_ARN`. Sensitive keys (`humeApiKey`, `awsAccessKeyId`, `awsSecretAccessKey`) come from EAS secrets.

## The env-var contract

Three layers — you MUST touch all three or the var won't reach runtime:

1. **Declare in `app.config.js`** — inject into `extra: { ... }`
2. **Register in `config/env.ts`** — add to the `ENV` object via `required()` (throws on missing) or as optional
3. **Use in code** — `import { ENV } from '@/config/env';` then `ENV.myKey`

For EAS-specific secrets:
```bash
eas secret:create --scope project --name MY_KEY --value "..."
```
Then reference in `eas.json` env as `$MY_KEY` or via EAS's auto-injection into `app.config.js`.

**Never import `process.env.*` directly in app code** — use `ENV` so missing vars fail fast at startup.

## Known security gap

AWS credentials (`awsAccessKeyId`, `awsSecretAccessKey`) are currently shipped inside the JS bundle. This is a real security issue — anyone who decompiles the APK can read them. Long-term fix: put AWS calls behind the existing AWS ECS backend and only ship a short-lived server-signed token to clients.

**Do NOT add more IAM secrets to the bundle.** If you need new AWS access, add an endpoint on the backend instead.

## Common commands

```bash
# Dev build (install dev client on your device once, then iterate)
eas build --profile development --platform android
eas build --profile development --platform ios

# Internal preview (shareable)
eas build --profile preview --platform all

# Production build
eas build --profile production --platform all

# Submit
eas submit --profile production --platform ios
eas submit --profile production --platform android

# OTA update (only for JS changes, not native)
eas update --branch production --message "Fix button alignment on Android"
```

## Pre-flight checklist before production build

- [ ] Version bumped in `app.config.js` → `version`
- [ ] `runtimeVersion` unchanged if the update is OTA-safe; bumped if native deps changed
- [ ] Privacy strings present in iOS Info.plist (microphone, speech recognition)
- [ ] Android permissions declared in `AndroidManifest.xml` (RECORD_AUDIO, POST_NOTIFICATIONS, MODIFY_AUDIO_SETTINGS)
- [ ] `npx tsc --noEmit` passes
- [ ] App runs end-to-end in a preview build on both iOS + Android
- [ ] No `console.log` noise in hot paths (voice/chat) — they cost time in release

## Troubleshooting

**"Missing env var X"** — you added to `config/env.ts` but not `app.config.js`. Must be in both.

**iOS build fails on signing** — use `eas credentials` to inspect; prefer EAS-managed credentials over local certs.

**Android Gradle OOM** — bump EAS build resource class (`"resourceClass": "large"` in `eas.json`).

**Reanimated babel plugin error** — verify it's still last in `babel.config.js` plugin list.

**OTA update didn't reach users** — only JS/image changes are OTA-safe. Any new native dep (LiveKit bump, audio module change) requires a new binary build.

## References

- [Expo Toolkit plugin](https://github.com/rahulkeerthi/expo-toolkit) — has `/build`, `/ios-preflight`, `/android-preflight` commands for Expo apps
- [Expo official skills](https://github.com/expo/skills) — Anthropic-adjacent collection
