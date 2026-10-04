---
target: frontend/src/app/(tabs)/squad.tsx
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/home/eogan-sullivan/Projects/6Nations/frontend/src/app/(tabs)/squad.tsx"
target_fingerprint: "sha256:aabcfaa4c4e000e0ea029868f9afc74991056232452b7c50b983273b836a34a0"
target_path: /home/eogan-sullivan/Projects/6Nations/frontend/src/app/(tabs)/squad.tsx
timestamp: 2026-10-04T18-42-22Z
slug: frontend-src-app-tabs-squad-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|---:|---|
| 1 | Visibility of System Status | 3 | Strong squad status, deadline, validation and provisional-score language; countdown/status values are static demo content. |
| 2 | Match System / Real World | 3 | Rugby vocabulary and pitch/bench model are clear, but "Command Dock", "Tactical Desk" and dense labels add product-specific jargon. |
| 3 | User Control and Freedom | 3 | Draft editing, replacement, reset and modal close paths are present; the dock and sheets add interaction layers that are easy to miss. |
| 4 | Consistency and Standards | 3 | Tokens, typography and button primitives are coherent; compact buttons and mixed row affordances are inconsistent. |
| 5 | Error Prevention | 3 | Position, budget, duplicate, nation and captain constraints are surfaced before lock; some disabled demo actions do not explain a next step in-place. |
| 6 | Recognition Rather Than Recall | 3 | Slot labels, player metadata and status cards help; the main squad screen still asks users to parse many simultaneous metrics and controls. |
| 7 | Flexibility and Efficiency | 2 | Pitch/list modes and search help power users, but navigation is hidden behind a custom expandable dock and key actions are buried below a long screen. |
| 8 | Aesthetic and Minimalist Design | 2 | Strong authored visual language, but the squad screen stacks hero, command strip, metrics, pitch, bench, quotas, validation, fixtures and drawers into one dense flow. |
| 9 | Error Recovery | 3 | Storage/API errors expose retry and recovery paths; modal and form error focus/announcement behavior is not fully explicit. |
| 10 | Help and Documentation | 2 | Copy explains local/demo state, but Rules & help, READ, OPEN and notifications are largely non-interactive or incomplete. |
| **Total** |  | **27/40** | **Acceptable: strong foundation, meaningful release polish still needed.** |

## Design Specificity Verdict

The implementation is clearly authored for Six Nations fantasy rugby rather than being a generic dashboard: the pitch, jersey cards, captaincy, bench ordering, matchday freshness language and green/amber match palette give it a recognizable point of view. The main risk is density, not lack of identity. The deterministic detector found 0 findings in `frontend/src`; that confirms no configured detector rules fired, but it does not validate visual hierarchy or interaction ergonomics.

## Overall Impression

This feels like a thoughtful sports-management product with unusually good data-trust language for a demo. The biggest opportunity is to make the first decision—selecting and locking a legal XV—feel simpler and more legible. The squad screen currently presents too many secondary systems before the user has completed the primary job.

## What's Working

- The pitch/list toggle, formation labels, jersey treatment and reserve ordering make the fantasy-rugby model tangible instead of presenting a generic data table.
- Provisional, synthetic and local-only states are called out repeatedly, which protects user trust while the data/API layer is incomplete.
- The theme token structure, shared Button component, 44px default button sizing, visible focus outline and semantic labels on most major controls are solid foundations.

## Priority Issues

### [P1] The primary workflow is visually overloaded

Why it matters: New managers must scan the hero, deadline, command strip, three metrics, pitch, bench, nation quotas, validation, status and action area before they reach a confident lock decision. The dense layout competes with the actual selection task and increases abandonment on mobile.

Fix: Make “complete your XV” the dominant first state. Collapse deadline/command information into a compact summary, keep budget and validity adjacent to the player pool, and move fixtures/scoring education below the lock action. On mobile, use a persistent single primary action with one supporting status line.

Suggested command: `$impeccable distill` or `$impeccable layout`

### [P1] Compact controls fall below the 44px touch target

Why it matters: `Button.compact` sets `minHeight: 36` and is used for pitch/list, open match, reserve arrows, swap, sign-in and other important actions. This creates small targets and weakens touch confidence, especially on the narrow squad view.

Fix: Keep the visual compactness through padding/typography, but preserve a 44px hit box; for icon-only reserve arrows, provide a 44px wrapper and visible pressed/focus states. Verify with a 320px-wide viewport and synthesized touch.

Suggested command: `$impeccable adapt`

### [P1] Light theme leaks dark page chrome

Why it matters: `ThemeProvider` writes `--bg`, while `global.css` uses `var(--background, #07111A)` for `html, body, #root`. In light mode, the app content can be light while page gutters and scrollbar styling retain the dark fallback, producing a visibly unfinished theme switch.

Fix: Use one canonical token name (`--bg`) in the global CSS or write the exact `--background` alias from the provider. Add a web test that asserts the body/root computed background after toggling to light.

Suggested command: `$impeccable colorize`

### [P2] The bottom command dock hides core navigation and competes with fixed actions

Why it matters: Navigation is not discoverable until the user recognizes and expands a branded “6” control. The squad screen also has an absolute mobile action bar near the same bottom region, so the dock can obscure or compete with save/lock controls.

Fix: On web/desktop, expose the five destinations in a conventional persistent nav rail or top bar. On mobile, keep the dock but add an explicit “Navigation” label and ensure the action bar reserves safe-area space above it; test expanded and keyboard-open states.

Suggested command: `$impeccable adapt`

### [P2] Several visible affordances are dead ends in the demo

Why it matters: Leagues renders disabled “DEMO ONLY” create/join buttons, while Profile renders “READ”, “OFF” and “Rules & help” as status-like text with no action. Users can’t tell whether these are intentionally unavailable, unfinished, or broken.

Fix: Replace disabled actions with explanatory empty states and one clear next step, or make the rows explicitly non-interactive and label them “Coming in the full game”. Make Rules & help open a real rules surface before launch.

Suggested command: `$impeccable clarify` or `$impeccable harden`

## Persona Red Flags

**Jordan (First-Timer):** The squad screen introduces “Matchday Command”, “Tactical Desk”, “VC”, “auto-substitution”, nation quota, and multiple status layers before explaining the shortest path to a legal team. “Save Squad” leads into review/lock semantics that are not obvious from the label.

**Alex (Power User):** Search and pitch/list modes help, but navigation and theme controls are hidden behind the expandable dock. Reserve reordering requires small compact controls and the player pool is visually separated from the active slot context on narrow layouts.

**Riley (Accessibility/Low Vision):** Many labels are 9–12px uppercase microcopy; compact controls are 36px high; and modal focus/role management is only partially explicit. The status line uses `accessibilityLiveRegion`, but error/review transitions do not visibly move focus to the new context.

## Minor Observations

- `OverlaySurface` marks the surface as modal but does not give it an explicit dialog role or a clear focus-return strategy; verify keyboard focus trapping/return on web.
- `global.css` applies a 200ms transition to every `div`, `button`, `input`, `textarea` and `a` under `[data-theme]`; this is broad and can create unnecessary paint work during theme changes. Prefer targeted theme surfaces and preserve reduced-motion behavior.
- Static strings such as `Fri 31 Jan, 19:30` and `2d 14h 32m` are appropriate for a fixture demo but should be clearly owned by one time-aware component before live data is introduced.
- The detector scan was clean, but there is no automated detector coverage for contrast, focus order, modal focus, or touch target size.

## Questions to Consider

- What is the one action the user should feel proud to complete in the first 30 seconds: selecting a player, completing the XV, or locking the round?
- Could the squad screen show only the active slot, player pool, budget and one next action until the user asks for deeper tactical detail?
- Is the custom command dock memorable enough to justify hiding navigation, or should the brand character live inside a conventional navigation structure?
- Which “demo only” surfaces should become real before launch, and which should be removed from the navigation until they are useful?
