# Onboarding Questions

The 10-question flow that runs after `name-input` and before `analysing`. Source of truth is `app/(onboarding)/_components/types.ts` — keep this doc in sync with the `QUESTIONS` array.

Structure: 5 questions → "Did you know" interstitial → 5 questions. Single-select options auto-advance on tap (no Continue button); battery / leaf / freeform / interstitial commit explicitly. The user sees questions numbered 1–10; the interstitial doesn't carry a number.

| # | ID                  | Type      | Tone     | Storage key         |
|---|---------------------|-----------|----------|---------------------|
| 1 | `bring_here`        | options   | peach    | `qBringHere`        |
| 2 | `hardest_time`      | options   | lavender | `qHardestTime`      |
| 3 | `body_location`     | options   | sage     | `qBodyLocation`     |
| 4 | `inner_voice`       | options   | butter   | `qInnerVoice`       |
| 5 | `emotional_battery` | battery   | coral    | `emotionalBattery`  |
| — | `did_you_know`      | fact      | —        | —                   |
| 6 | `village`           | options   | peach    | `qVillage`          |
| 7 | `rest`              | options   | lavender | `qRest`             |
| 8 | `tried_things`      | options   | sage     | `qTriedThings`      |
| 9 | `emotional_growth`  | leaf      | butter   | `emotionalGrowth`   |
|10 | `make_it_work`      | freeform  | coral    | `qMakeItWork`       |

---

## Q1 — What brings you here *right now*?

*Kicker: no wrong answer · Tone: peach*

> Pick the one that feels closest. You can change later.

| ID | Label | Subtitle |
|----|-------|----------|
| `loud` | My head feels loud most days. | anxiety · overthinking |
| `exhausted` | I'm exhausted in a way sleep doesn't fix. | burnout · depletion |
| `lonely` | I feel lonely even when I'm not alone. | loneliness · disconnect |
| `focus` | I can't focus, and I'm mad at myself for it. | ADHD · focus |
| `unclear` | Something hurts and I don't have a word for it. | not sure yet |

---

## Q2 — When is it *hardest*?

*Kicker: the shape of the day · Tone: lavender*

> If many are true, pick the loudest one.

| ID | Label | Subtitle |
|----|-------|----------|
| `sunday` | Sunday late afternoon | the anticipatory tax |
| `afternoon` | The 2–4pm slump | afternoon energy cliff |
| `post-work` | Right after work | the re-entry hour |
| `late` | Late at night | when the quiet gets loud |
| `morning` | Honestly, mornings | bracing before the day |

---

## Q3 — Where does it *live* in your body?

*Kicker: a small body check · Tone: sage*

> A body-first reading. Pick the one that stands out.

| ID | Label |
|----|-------|
| `chest` | Tight chest · shallow breath |
| `jaw` | Jaw · shoulders · neck |
| `stomach` | Stomach · a low-grade knot |
| `limbs` | My hands or legs want to move |
| `numb` | Honestly, I've stopped noticing |

---

## Q4 — Which inner voice sounds *most familiar*?

*Kicker: the voice in your head · Tone: butter*

> None of these are wrong. They're just patterns.

| ID | Label | Subtitle |
|----|-------|----------|
| `critic` | "You should've already done that." | the critic |
| `editor` | "You're too much. Dial it down." | the editor |
| `driver` | "Just keep going. Don't stop to feel." | the driver |
| `deflator` | "What's the point, really." | the quiet deflator |
| `pleaser` | "Please, everyone be okay with me." | the pleaser |

---

## Q5 — How full is your *emotional battery*?

*Kicker: a calibration · Tone: coral · Type: battery slider*

> Take a moment to tune in. Drag to feel your way there.

Slider — `0` (empty) to `100` (full). Stored as a string in `emotionalBattery` to keep the schema consistent with the other persisted fields.

---

## Did You Know

*Type: fact interstitial · No user input*

A short informational card sitting between Q5 and Q6 to give the user a breath. Single Continue action commits without writing to onboarding storage.

---

## Q6 — How's your *circle* these days?

*Kicker: who's near · Tone: peach*

> Not judgement — just a reading.

| ID | Label | Subtitle |
|----|-------|----------|
| `close-active` | A few close people I can reach today. | close + active |
| `close-quiet` | Good people, but I haven't reached out lately. | close + quiet |
| `shallow` | Mostly surface-level, not deep. | wide + shallow |
| `unseen` | I feel outside most rooms I'm in. | present but unseen |
| `alone` | Honestly, I'm mostly alone these days. | alone |

---

## Q7 — How's *rest* been?

*Kicker: your sleep & rest · Tone: lavender*

> Sleep tells on us first.

| ID | Label | Subtitle |
|----|-------|----------|
| `solid` | Solid. I wake up feeling like me. | — |
| `fine` | Fine-ish. A bit wired on Sunday nights. | — |
| `onset` | Falling asleep is the hard part. | onset |
| `witching` | I wake at 3am and the brain starts. | the witching hour |
| `un-rested` | I sleep enough, but never feel rested. | un-restoring |

---

## Q8 — What have you *tried* before?

*Kicker: what you've tried · Tone: sage*

> So I don't suggest what hasn't worked. Pick the most recent.

| ID | Label |
|----|-------|
| `therapy-now` | Therapy — currently |
| `therapy-past` | Therapy — in the past |
| `medication` | Medication |
| `meditation` | Meditation / breathwork apps |
| `journaling` | Journaling on my own |
| `first-time` | This is my first time trying something |

---

## Q9 — Where are you in your *growth*?

*Kicker: the rhythm of growth · Tone: butter · Type: leaf-stage picker*

> No wrong spot — just where you are today.

Four stages of leaf growth, indexed `0`–`3` and stored as a string in `emotionalGrowth`:

| Value | Stage |
|-------|-------|
| `0` | Not yet — just curious |
| `1` | Seedling — starting to notice |
| `2` | Growing — making real progress |
| `3` | Thriving — mostly steady |

---

## Q10 — What would make this *actually work* for you?

*Kicker: one last thing · Tone: coral · Type: freeform text · Skippable*

> Open field. Or skip — I'll learn as we go.

Placeholder: *"I think I'd keep coming back if…"*

`qMakeItWork` is the only freeform answer in the chain. It's intentionally optional and excluded from the gate that decides whether the user has finished pre-auth onboarding (see `deriveOnboardingStep` policy notes — the 9 multi-choice answers are required; Q10 is colour, not score).

---

## What gates the Continue path

Per `utils/onboardingProgress.ts` (deleted) and now inlined in the auth screens, "finished pre-auth onboarding" requires three signals at minimum:

- `firstName` (from `/name-input`)
- `personalizeTopics.length > 0` (from `/personalize-intro`)
- `qBringHere` (Q1)

The full Q-fields contribute to emotional-profile generation in `services/chat/bedrockService.ts` (`buildEmotionalAnswers`). When a question's answer is missing, that signal is dropped from the prompt — Bedrock makes do with what it has, and the deterministic fallback in `composeDeterministicProfile` covers the worst case.
