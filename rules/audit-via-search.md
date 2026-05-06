# Use search, not full reads, for design/code audits

**Rule.** When auditing screens against a design source (e.g. `mobile-screens-{a,b,c}.jsx`), or sweeping the codebase for drift, **default to `grep` over reading every file**. Reading 20 files end-to-end to compare against 20 design files burns the entire context budget and produces shallower output than 3 well-aimed greps.

## Why

Reading two parallel sets of files (design + impl) puts ~40 large blobs in context for one pass. The user has explicitly called this out as wasteful. A single `grep` over the design files extracts every kicker / headline / button label / right-icon glyph in seconds, and a parallel `grep` over our screens shows whether each one is present. The diff is the gap.

## How to apply

When the user asks for a "design vs code diff", "audit", "sweep", or "consistency check":

1. **Pick the high-leverage signals** — what would actually fail? Common ones for this codebase:
   - Hardcoded hex colors leaking past `BRAND` tokens (`grep -rn "#[0-9a-fA-F]\{6\}"`)
   - Old fonts leaking into new screens (`grep -rn "Outfit\|Playwrite\|MelloGradient"`)
   - Right-side topbar glyphs (`grep -nE "MBTopBar.*right=" design/`)
   - Exact copy strings the design specifies verbatim (`grep -nE "MBKicker>|mb-h1|mb-btn"` in design, then look for the same strings in our code)
2. **Batch the greps** — one Bash call with multiple patterns separated by `&& echo ===`, parallelize independent searches.
3. **Only read a file in full** when grep flagged a hit and you need the surrounding context to judge intent.
4. **Report a punch list, not a thesis.** One bullet per delta: file, line, what's wrong.

Reserve full-file reads for the 1-3 files where grep showed a real gap. Do not "read everything just to be sure" — that's the failure mode this rule exists to prevent.

## Trigger phrases

- "audit", "diff", "compare", "sweep", "check all pages"
- "see X and tell me what's missing"
- Anything where the search space is N files × M files
