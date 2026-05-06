# Rules

Codified scar tissue. Read the relevant file BEFORE touching the corresponding area. Each file is a must-not-violate contract; the longer-form taxonomy lives in `docs/STYLE_GUIDE.md`.

## When to read what

| If you are about to… | Read |
|---|---|
| Add a new screen, change a back-handler, modify RouterGate, add any `router.push/replace/back`, wire a redirect, change a Stack `_layout.tsx` | [routing.md](./routing.md) |
| Create or redesign a screen, choose colors / typography, add a scrollable view, add a pinned CTA, build a new card / button | [page-design.md](./page-design.md) |
| Audit screens against the design source, diff our code vs `mobile-screens-*.jsx`, sweep for drift, "check all pages" | [audit-via-search.md](./audit-via-search.md) |
| Add or change ANY Fraunces text style — display headlines, body, sheets — anywhere in the app | [android-text-cropping.md](./android-text-cropping.md) |

## How to use

These files are short on purpose. They are not tutorials — they are the rules that, when broken, cost us a debugging round-trip. Each rule has a "why" footnote so you can judge edge cases.

Most rules cite a concrete failure that prompted them (e.g. the ghost-screen rule cites the `name-input.tsx` back-loop that bit us 3–4 times). When you find yourself wanting to break a rule, re-read its "why" — usually the answer is no.

If you discover a new pattern that's worth codifying, add it here in the same shape: rule, why, how-to-apply. Don't bury new rules in `docs/STYLE_GUIDE.md` — those long sections get skimmed past.

## Source of truth

- `rules/` — the must-not-violate contracts (read before changes).
- `docs/STYLE_GUIDE.md` — long-form design system taxonomy (reference while building).
- `CLAUDE.md` — project memory for AI assistants (stack, layout, invariants).
- `/Users/warmachine37/Downloads/selfmind app design screens` — visual mockups.
