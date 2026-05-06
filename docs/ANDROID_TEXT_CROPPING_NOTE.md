# Android Text Cropping Note

## Issue

Some Fraunces text is visually cropped at the bottom on Android. The most obvious symptom is lowercase descenders being cut off, especially the final `g` in words like:

- `Weightless` on the Sound Space player title
- `Good evening` on the Home greeting
- `waiting` in the Notifications headline

iOS renders the same text acceptably, so this is Android-specific font metric behavior.

## Likely Cause

Several large Fraunces text styles use a tight `lineHeight` and/or `includeFontPadding: false`.

On Android, React Native text layout relies on Android font metrics. When `includeFontPadding` is disabled and the `lineHeight` is close to the `fontSize`, Android can clip glyph descenders and lower curves. Fraunces is especially sensitive because its display cuts have tall/expressive glyph shapes.

## Fix That Worked

We fixed the Sound Space player title in:

`components/spaces/SelfMindSoundSpaceSitting.tsx`

Before:

```ts
title: {
  fontFamily: 'Fraunces-Medium',
  fontSize: 38,
  lineHeight: 40,
  letterSpacing: -0.8,
  color: C.ink,
  includeFontPadding: false,
}
```

After:

```ts
title: {
  fontFamily: 'Fraunces-Medium',
  fontSize: 38,
  lineHeight: 46,
  letterSpacing: -0.8,
  color: C.ink,
}
```

This worked because:

- `lineHeight` increased from `40` to `46`, giving the glyph bottom room.
- `includeFontPadding: false` was removed, allowing Android to keep its native font padding.

## Recommended Rule

For large Fraunces headlines on Android:

- Avoid `includeFontPadding: false` unless visually verified on Android.
- Keep `lineHeight` at least `fontSize + 6` for display text.
- For very large home/onboarding headlines, consider `fontSize + 8` or more.
- Check words with descenders: `good`, `evening`, `feeling`, `waiting`, `grounding`, `Weightless`.

## Places To Audit Next

Search for:

```sh
rg -n "Fraunces.*|includeFontPadding: false|lineHeight" components app
```

Priority files seen during this session:

- `components/home/SelfMindHome.tsx`
- `components/home/SelfMindNotifications.tsx`
- `components/spaces/SelfMindSoundSpaceSitting.tsx`
- `components/spaces/SpaceCard.tsx`
- `components/mood/MoodSelectedCard.tsx`
- onboarding screens/components with large Fraunces titles

## Practical Patch Pattern

For any cropped Fraunces title:

1. Remove `includeFontPadding: false`.
2. Increase `lineHeight` by `4-8px`.
3. Verify on Android first, then iOS.
4. Keep the visual spacing similar by adjusting surrounding `marginTop`/`marginBottom` only if needed.

