---
name: rn-perf
description: React Native performance guidance for Mello — apply when the user reports jank, slow startup, dropped frames, laggy scroll, Android sluggishness, or asks to "optimize" a screen. Covers FlashList tuning, re-render elimination, reanimated worklets, Hermes, image handling, and when to profile vs. optimize.
---

# rn-perf skill

When in doubt, **profile first, optimize second**. Mello runs on mid-range Android, so perf regressions show up there before iOS. Priority order:

1. Measure — don't guess
2. Reduce work on the JS thread
3. Move work to worklets (reanimated) or native
4. Reduce re-renders
5. Optimize images and bundle size last

## Quick diagnostic rubric

| Symptom | First thing to check |
|---|---|
| Dropped frames during scroll | `FlatList` that should be `FlashList`; missing `getItemLayout`; large inline component in `renderItem` |
| Slow screen mount | Heavy imports at module scope; big sync JSON parse; fetch blocking render |
| Animation judder | Animation on the JS thread (`Animated` w/o `useNativeDriver`); should be a reanimated worklet |
| Jank when tapping buttons | Parent re-render on every press; missing `React.memo`; inline object/array passed as prop |
| App startup slow | Fonts loading before render; large top-level `require` in `_layout.tsx`; unnecessary polyfills |
| Voice screen glitches | Main thread blocked by Hume prosody processing; should be in a worker/native |

## FlashList is the default — not FlatList

Anything scrollable above ~20 items should use `@shopify/flash-list`:

```tsx
import { FlashList } from '@shopify/flash-list';

<FlashList
  data={chats}
  renderItem={renderChat}
  estimatedItemSize={72}
  keyExtractor={(item) => item.id}
/>
```

- **`estimatedItemSize`** is required — measure one item's height on device (`onLayout` → log) and plug in.
- `renderItem` MUST be stable — define at module scope or wrap in `useCallback` + `React.memo` on the row component.
- Do NOT wrap in `ScrollView` — FlashList handles scrolling.

## Re-renders

Common fixes:

```tsx
// ❌ New object every render — all children re-render
<Child style={{ padding: 10 }} />

// ✅ Hoist or memoize
const childStyle = { padding: 10 };
<Child style={childStyle} />

// ❌ Inline function invalidates memo
<Child onPress={() => doThing(id)} />

// ✅ useCallback
const onPress = useCallback(() => doThing(id), [id]);
<Child onPress={onPress} />
```

- Wrap reusable rows and cards in `React.memo` (with a custom comparator only if props contain objects).
- Lift context reads down the tree — `useAuth()` in a root component re-renders everything on session change. Subscribe from leaves where possible.

## Reanimated, not Animated

The codebase uses reanimated v4 + worklets for everything animated. Don't add `Animated.Value` anywhere.

```tsx
const opacity = useSharedValue(0);
const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
opacity.value = withTiming(1, { duration: 300 });
```

- Run gesture + scroll-driven animations on the UI thread (worklet). If you see animations via `setState` + `useEffect`, that's JS thread — migrate.
- `react-native-reanimated/plugin` must be LAST in `babel.config.js` plugin list — currently it is. Don't move it.

## Hermes & startup

- Hermes is on by default in Expo 54 — don't disable it.
- Don't import all of `lodash` — cherry-pick: `import debounce from 'lodash/debounce'`.
- Don't eagerly load heavy SDKs at app startup. LiveKit, LLM services etc. should lazy-load on first use.
- Fonts: `expo-font` in `app/_layout.tsx` — if you add a font, measure TTI impact.

## Images

- Use `expo-image` if introducing new image-heavy screens (not currently in deps — discuss before adding).
- Existing pattern uses core `Image` — acceptable for small avatars but specify `width`/`height` to avoid layout thrash.
- Use `resizeMode="cover"` or `contain` explicitly — don't rely on defaults.

## Bundle size

Check `expo-doctor` and `npx expo-lint` periodically. Flag any dep > 500 KB.

## When to reach for the `perf-auditor` agent

Delegate to the `perf-auditor` subagent when:

- The user says "the whole app feels slow" or "startup is slow" — needs cross-screen investigation.
- A specific screen has multiple suspected issues.
- You need to audit bundle size or startup traces.

## References to borrow from

Callstack's [react-native-best-practices skill](https://github.com/callstackincubator/agent-skills/tree/main/skills/react-native-best-practices) — install via `/plugin marketplace add callstackincubator/agent-skills` and `/plugin install react-native-best-practices@callstack-agent-skills` for 27 detailed guides organized as `js-*`, `native-*`, `bundle-*` with CRITICAL / HIGH / MEDIUM impact tags.

## Guardrails

- Never claim "this is faster" without a measurement. Say "this should reduce re-renders because X."
- Don't add Flipper / perf tooling to the build without discussion.
- Don't replace FlashList with FlatList "for compatibility."
