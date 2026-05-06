╭────────────────────────────────────────────────────────────────╮
│  🌿 Mello / Self Mind — Claude Code workspace                  │
│  Expo 54 · RN 0.81 · React 19 · expo-router · TypeScript       │
╰────────────────────────────────────────────────────────────────╯

📖 Project memory: CLAUDE.md (read this first — stack, conventions, landmines)

🧰 Skills (auto-activate based on task context)
  • mello-ui          → tokens, gradients, Outfit font, safe-area, Pressable
  • rn-feature        → scaffold a new feature (components + services + route)
  • onboarding-screen → screens under app/(onboarding-new)/ (cascade anims, #8B7EF8, saveCurrentStep)
  • rn-perf           → jank, FlashList, re-renders, reanimated worklets
  • rn-a11y           → VoiceOver/TalkBack labels, hit targets, contrast
  • eas-build         → EAS profiles, env vars, submit flows, OTA

🤖 Subagents (delegate for focused investigations)
  • rn-reviewer   → "Run rn-reviewer on the current branch"  (RN-specific review punch list)
  • ui-designer   → "Use ui-designer to plan <screen>"       (layout spec BEFORE coding)
  • perf-auditor  → "Use perf-auditor on <screen>"           (evidence-backed perf plan)

💡 How to use
  Just describe your task in plain English — relevant skills fire automatically.
  Delegate explicitly when you want a focused specialist:
      "Use the ui-designer agent to plan a new mood-insights screen"
      "Run rn-reviewer on my diff against main"

🎨 Prototype reference: ~/Desktop/mello prototyping/ (32 screens, design system)
      "Check the prototype for journal-insights"
      "Look at the prototype's Q2 screen and port its layout"

🔔 Rebrand pending: Mello → Self Mind (new palette + DM Serif Text). Not applied yet.
   Say "apply the Self Mind rebrand" when ready.
