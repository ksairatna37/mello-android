---
name: rn-a11y
description: Accessibility guidance for Mello's React Native UI. Apply when creating buttons, inputs, custom Pressable surfaces, icons, or any interactive component; also apply when the user mentions VoiceOver, TalkBack, screen reader, contrast, hit targets, or accessibility audit. Enforces accessibilityRole/Label/State, 44×44 hit targets, contrast against Mello's soft palette, and reduced-motion respect.
---

# rn-a11y skill

Mental-health apps serve users in low-agency moments — accessibility is baseline, not polish.

## Minimum checklist for any interactive element

- [ ] `accessibilityRole` set (`button`, `link`, `image`, `header`, `text`, `adjustable`, etc.)
- [ ] `accessibilityLabel` set — in plain language, not UI-lingo ("Continue" not "cta_btn")
- [ ] `accessibilityHint` when the action isn't obvious ("Saves your answer and goes to the next question")
- [ ] `accessibilityState` set for stateful components (`{ selected, disabled, busy }`)
- [ ] `hitSlop={{ top:8, bottom:8, left:8, right:8 }}` if touch target < 44×44 pt
- [ ] Not hidden from screen readers unless decorative (then `importantForAccessibility="no-hide-descendants"` on Android, `accessibilityElementsHidden` on iOS)

## Patterns

**Icon-only buttons — always label**

```tsx
<Pressable
  accessibilityRole="button"
  accessibilityLabel="Go back"
  hitSlop={8}
  onPress={handleBack}
>
  <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
</Pressable>
```

**Stateful chips / toggles**

```tsx
<Pressable
  accessibilityRole="button"
  accessibilityLabel={`Feeling ${label}`}
  accessibilityState={{ selected: isSelected }}
  onPress={toggle}
>
  {/* ... */}
</Pressable>
```

**Sliders**

```tsx
<View
  accessibilityRole="adjustable"
  accessibilityLabel="Emotional battery"
  accessibilityValue={{ min: 0, max: 100, now: value }}
/>
```

**Inputs**

```tsx
<TextInput
  accessibilityLabel="Your first name"
  accessibilityHint="Used to personalize your Mello"
  placeholder="Your first name"
/>
```

**Images** — decorative vs. content

```tsx
// Decorative backdrop gradient
<Image source={bg} accessibilityElementsHidden importantForAccessibility="no" />

// Meaningful image (profile avatar)
<Image source={avatar} accessibilityLabel="Your avatar" />
```

## Contrast rules (Mello's light palette)

The soft purples/pinks are easy to under-contrast. Spot-check text:

- **Body text** on `#f8f7ff` — use `#1a1625` (primary text); muted gets `#666666` minimum (NOT the `#9999A8` onboarding uses for subtitle unless font is ≥ 15 SemiBold)
- **Text on purple button** (`#b9a6ff` or `#8B7EF8`) — use `#FFFFFF` SemiBold or higher, never thin weights
- **Placeholder text** — `#BBBBCC` is low contrast; only use for TextInput placeholders, never for information

Rule of thumb: WCAG AA is 4.5:1 for normal text, 3:1 for large (18pt / 14pt bold+). Mello leans soft — err toward AA.

## Motion — respect reduced motion

The onboarding flow uses entrance animations. Respect system reduced-motion:

```tsx
import { AccessibilityInfo } from 'react-native';

const [reduceMotion, setReduceMotion] = useState(false);
useEffect(() => {
  AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
  return () => sub.remove();
}, []);

const duration = reduceMotion ? 0 : 420;
```

## Focus management

After navigation, announce the screen:

```tsx
import { AccessibilityInfo, findNodeHandle } from 'react-native';

const headerRef = useRef(null);
useEffect(() => {
  const node = findNodeHandle(headerRef.current);
  if (node) AccessibilityInfo.setAccessibilityFocus(node);
}, []);
```

Use sparingly — mostly for screens that replace the current one (onboarding-new uses `router.replace`).

## Audit commands

```bash
# iOS — Simulator > Accessibility Inspector (hardware menu)
# Android — Settings > Accessibility > TalkBack, or adb shell dumpsys accessibility
```

Manual smoke test: flip VoiceOver / TalkBack on, sweep through a screen, and make sure (a) every control is announced with purpose and (b) the order matches the visual flow.

## Guardrails

- Don't ship an icon-only `Pressable` without `accessibilityLabel`.
- Don't set `accessible={false}` to silence warnings — label it properly.
- Don't rely on color alone for state — selected chips need a visible non-color cue (checkmark, border, filled bg).
- Don't forget reduced motion when adding new entrance animations.
