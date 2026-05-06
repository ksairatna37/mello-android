# Android Text Cropping (Fraunces)

Read this BEFORE adding any Fraunces (or Playfair / DM Serif / similar high-contrast serif) text style.

## The rule

A Fraunces text style is **at risk** of descender clipping on Android (the bottom of `g`, `y`, `p`, `q` is cut off, especially on words like "evening", "waiting", "stirring", "weightless") if either:

1. It sets `includeFontPadding: false`, OR
2. Its `lineHeight` is less than `fontSize + 6`.

Fix:

- **Remove** `includeFontPadding: false`. Always. Don't try to compensate with a larger lineHeight while keeping it — the underlying glyph still gets clipped at the box bottom on some Android OEM skins. iOS doesn't care; Android does.
- Set `lineHeight` to at least:
  - `fontSize + 8` for **display sizes** (≥24).
  - `fontSize + 6` for body sizes.

This applies to ALL Fraunces variants (`Fraunces`, `Fraunces-Medium`, `Fraunces-Italic`, `Fraunces-MediumItalic`, `Fraunces-Text`, `Fraunces-Text-Italic`, `Fraunces-XL`, etc.).

It does NOT apply to JetBrainsMono, Inter, or any monospaced/sans-serif fonts in this app — those have less aggressive descenders and ship with safer Android metrics.

## Why

`includeFontPadding: false` tells Android to skip the OS's font-padding calculation. Android's font metrics for Fraunces (a high-contrast serif with tall ascenders + low descenders) leave very little room at the glyph bottom; the OS padding is what saves us. Disable it AND set a tight lineHeight, and the renderer literally has no pixels left for the descender to live in.

Concrete examples that bit us before this rule:

- "Good evening" greeting on Home — `g` clipped (40/44 + `padding:false`).
- "waiting" in Notifications headline — `g` clipped (36/40 + `padding:false`).
- "Weightless" on Sound Space player title — `g` clipped (38/40 + `padding:false`).
- "stirring" on the your-reading h1 — `g` clipped (30/38 + `padding:false`).

Each of these took a debugging round-trip to discover after they shipped. The rule below avoids re-discovering it.

## How to apply

When adding a new Fraunces text style:

```ts
// ❌ wrong — clips on Android
title: {
  fontFamily: 'Fraunces-Medium',
  fontSize: 32,
  lineHeight: 36,
  includeFontPadding: false,
}

// ✅ right
title: {
  fontFamily: 'Fraunces-Medium',
  fontSize: 32,
  lineHeight: 40,   // fontSize + 8 for display
}
```

When auditing existing code:

```sh
# Find every at-risk Fraunces style:
rg -nU 'fontFamily.*Fraunces[\s\S]*?(includeFontPadding: false|lineHeight)' components app
```

For every match, check:
1. Is `includeFontPadding: false` present? Remove it.
2. Is `lineHeight < fontSize + 6`? Bump it to at least `fontSize + 6` (or +8 for display).

## What NOT to do

- Don't keep `includeFontPadding: false` "just in case" — it's not a safety net, it's the cause of the bug.
- Don't add iOS-only padding hacks. iOS already renders fine; the fix lives entirely in the lineHeight + the absence of the override.
- Don't compensate with `paddingBottom` on the parent View. The clip happens INSIDE the text node before it composites — outer padding can't save it.

## Long-form

Original incident notes (with the Sound Space "Weightless" repro and the first time we landed the fix) live in [`docs/ANDROID_TEXT_CROPPING_NOTE.md`](../docs/ANDROID_TEXT_CROPPING_NOTE.md). Read that for the longer story; this file is the must-not-violate version.
