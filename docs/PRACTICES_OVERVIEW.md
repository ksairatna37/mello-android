# Practices — Current Shelf (for brainstorming)

A plain-English map of every practice activity currently on the Practices page in Mello / Self Mind. No code, no implementation detail — just what the app asks the user to do, how they do it, and where they land.

---

## Index page (the shelf)

A scrollable index titled **"A shelf of small, kind things."**

- **Today's suggested** — one big featured card (currently always Box breath).
- **Saved · one you kept** — a second featured card pulled randomly from the user's hearted practices. Hidden if they've saved nothing.
- Three grouped sections of small rows:
  - **when anxiety is loud** — 5-4-3-2-1 grounding, Name the weather, Box breath
  - **for scattered focus** — Brain dump, The next physical step, One nouny verb
  - **for connection** — Reach out rehearsed, Map your circle, Draw a boundary
- A coral heart appears next to any practice the user has saved.
- Tap a row → opens the practice. Tap "Start" on a featured card → same.

Total: **9 unique practices** (Box breath appears twice on the index but is one practice).

---

## The practices

### 1. Box breath · 4 min
**Bucket:** when anxiety is loud
- **Asks:** "Breathe in / Hold gently / Breathe out / Pause here."
- **User does:** Watches an animated square outline trace one side per phase, with a pulsing orb in the middle. Can pause/resume or end early.
- **Structure:** 12 cycles of 4 phases (in · hold · out · hold), 4 seconds per phase. Phase instructions crossfade at the top.
- **Ends with:** A summary card ("You made room"), cycles + time, and a heart to save the practice.
- **Variant:** If the user came from a crisis path and did at least 4 cycles, they get a calmer return-to-resources screen instead of the celebration summary.

### 2. 5-4-3-2-1 grounding · 3 min
**Bucket:** when anxiety is loud
- **Asks:** "Name five things you can see. Four you can feel. Three you can hear. Two you can smell. One you can taste."
- **User does:** Reads the prompt for each sense (out loud or silently), taps "I named [count]" to advance.
- **Structure:** 5 sequential sense slots that light up one by one. Completed ones get a checkmark.
- **Ends with:** Returns to the index. No summary, no save.

### 3. Name the weather · 2 min
**Bucket:** when anxiety is loud
- **Asks:** "What's the weather inside?"
- **User does:** Picks one of eight weather chips (soft sun, bright sun, light clouds, heavy clouds, drizzle, storm, fog, wind). A reflective one-liner appears under the choice.
- **Structure:** Single tap. No timer. Tap → see reflection → tap "Carry it."
- **Ends with:** Returns to the index. The act of naming *is* the practice.

### 4. Brain dump · 6 min
**Bucket:** for scattered focus
- **Asks:** "Put it down. We'll sort it." — every looping thought, one at a time.
- **User does:** Types or dictates a thought, hits return; the thought drops into one of three colored buckets — **do soon**, **park it**, or **sit with** — auto-sorted in the background. Can manually re-bucket any thought via a popup, filter by bucket, or view all. A pinned card at the bottom suggests opening "the next physical step" for whatever's in *do soon*.
- **Structure:** Open-ended composer. As many entries as the user wants. Persists between visits.
- **Ends with:** No closing screen — the list lives on. Designed as something to come back to.

### 5. The next physical step · 4 min
**Bucket:** for scattered focus
- **Asks:** "Pick one nouny verb. The smallest, most specific thing your body could do next."
- **User does:** Picks one of 6 suggestions (Drink water, Open the window, etc.) or types their own. Taps "Do it · 2 min" → screen flips to a dark canvas with a 2-minute countdown, the verb echoed at the top, and a pulsing orb. Can end early.
- **Structure:** Three phases — pick → do (timed) → done.
- **Ends with:** A confirmation screen: "You did the small thing. That's how the rest catches up."

### 6. One nouny verb · 2 min
**Bucket:** for scattered focus
- **Asks:** "Name today in two words. A noun and a verb that fit."
- **User does:** Types a noun (with hint like "the noise") and a verb (hint like "asking for slow"). A live preview builds underneath as they type. When both are filled, the "Carry it" button enables.
- **Structure:** Two text fields. Live preview. Single submit.
- **Ends with:** Returns to the index. Nothing saved long-term — the noticing is the point.

### 7. Reach out, rehearsed · 5 min
**Bucket:** for connection
- **Asks:** "What do you want them to hear?" — recipient, topic, tone.
- **User does:** Types a name and a topic. Picks one of four tone pills (warm / honest / boundaried / playful). Three message drafts appear in a horizontal pager. Swipe to compare. Tap "Share this draft" → opens the native share sheet (SMS, WhatsApp, etc.).
- **Structure:** Two inputs → tone picker → 3 generated drafts. Drafts regenerate when inputs change.
- **Ends with:** User sends the message outside the app, or returns to the index.

### 8. Map your circle · 8 min
**Bucket:** for connection
- **Asks:** "Who's close, sometimes, far?" — map people into three zones of emotional proximity.
- **User does:** Taps a zone (peach = close, butter = sometimes, lavender = far), types a name in the dock at the bottom, hits return — the chip lands in that zone. Tap a chip to remove. Names persist across visits.
- **Structure:** Three colored bands, name dock, open-ended. No timer, no end.
- **Ends with:** Stays on the screen — designed as an ongoing reflection tool the user can revisit and update.

### 9. Draw a boundary · 6 min
**Bucket:** for connection
- **Asks:** "What do you actually need to say?"
- **User does:** Reads three pre-written boundary drafts in different tones (soft / clear / warm+firm). Taps "Use this" to open the native share sheet. ("Tweak" exists but isn't wired yet.) A closing card reminds them: "A boundary isn't a punishment. It's information about what keeps you soft."
- **Structure:** Static context card → three example drafts → share.
- **Ends with:** User sends the message outside the app, or returns to the index.

---

## Patterns across the shelf

Useful when brainstorming new ones — every current practice fits one of these shapes:

| Shape | Practices | What's similar |
|---|---|---|
| **Timed embodied loop** | Box breath, Next physical step | Animated visual + timer + a soft "end early" out |
| **Guided sequence** | 5-4-3-2-1 grounding | Step-through prompts the user advances manually |
| **Single naming** | Name the weather, One nouny verb | One small choice/word that *is* the practice |
| **Open composer** | Brain dump, Map your circle | Persistent list the user revisits, no end state |
| **Drafted message** | Reach out, Draw a boundary | Generated text → native share sheet → out of app |

## What's missing / open territory

Things the current shelf does **not** cover (potential brainstorming spots):

- **Body / sensation** beyond breath (no body-scan, no progressive relaxation, no posture cue).
- **Movement** (no walking, stretching, shaking, posture).
- **Gratitude / appreciation / savoring** (the existing weather + nouny-verb capture distress more than warmth).
- **Sleep / wind-down** specifically.
- **Self-compassion script / inner-voice reframe** (closest is Boundary, but that's outward).
- **Reflection on a past moment** (journal-prompt covers some of this, but no practice-shelf entry).
- **Sensory shift via media** (music, soundscape, image).
- **Two-person / shared practice** (everything is solo).
- **Ritual / closing of the day** (no "end of day" or "open of day" practice).

## Tone & design rules to keep in mind

- Lowercase, warm, no clinical language ("a soft no, kept in your own voice").
- Each practice has a one-line *hero* that promises something small.
- "End softly" — never "Quit" or "Cancel."
- Outcome screens are reflective, not congratulatory ("You made room," not "Great job!").
- No streaks, no scoring, no badges anywhere on the shelf.
