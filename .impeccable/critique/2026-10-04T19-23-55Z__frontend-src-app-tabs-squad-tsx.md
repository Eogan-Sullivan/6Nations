---
target: frontend/src/app/(tabs)/squad.tsx
total_score: 23
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 4
target_identity: "file:/home/eogan-sullivan/Projects/6Nations/frontend/src/app/(tabs)/squad.tsx"
target_fingerprint: "sha256:aabcfaa4c4e000e0ea029868f9afc74991056232452b7c50b983273b836a34a0"
target_path: /home/eogan-sullivan/Projects/6Nations/frontend/src/app/(tabs)/squad.tsx
timestamp: 2026-10-04T19-23-55Z
slug: frontend-src-app-tabs-squad-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|---:|---|
| 1 | Visibility of System Status | 3 | Progress, budget, validation, saving, deadline, and demo status are visible. |
| 2 | Match System / Real World | 3 | Rugby concepts map well, but command-centre metaphors layer over a simpler fantasy workflow. |
| 3 | User Control and Freedom | 2 | Reset, removal, and dismissal exist, but navigation is hidden and several surfaces compete for escape routes. |
| 4 | Consistency and Standards | 3 | Shared themed controls are coherent; navigation is split across dock, hub, tactical, and route screens. |
| 5 | Error Prevention | 2 | Validation is strong, but the dense invalid state and incomplete rules affordance remain confusing. |
| 6 | Recognition Rather Than Recall | 3 | Slot labels, active context, role badges, and player metadata are effective. |
| 7 | Flexibility and Efficiency | 2 | Pitch/list modes and search help, but editing 18 slots remains click-heavy. |
| 8 | Aesthetic and Minimalist Design | 2 | The visual identity is strong, but multiple summaries and action surfaces compete. |
| 9 | Error Recovery | 2 | Retry/reset paths exist, but demo confirmation still resembles real lock/submission. |
| 10 | Help and Documentation | 1 | Rules/help remains incomplete; “Rules & Admin” visibly dead-ends. |
| **Total** |  | **23/40** | **Acceptable, but still cognitively heavy.** |

## Design Specificity Verdict

The app remains strongly product-specific. Formation pitch, jerseys, captaincy, reserves, nation limits, and match deadlines clearly belong to Six Nations fantasy rugby. The deterministic detector found 0 findings in `frontend/src`.

The update improved the implementation foundation, but the product still feels like a fantasy squad workflow wrapped in a “tactical command centre” concept. That layering is the main source of remaining complexity.

## Overall Impression

The work improved status clarity, touch-target sizing, theme consistency, and accessibility intent. However, the main mobile task is still too dense, and the app continues to hide primary navigation behind a collapsed dock. The next meaningful improvement is structural prioritisation, not more visual decoration.

## What’s Working

- The rugby-specific visual system is convincing and cohesive.
- “SELECTING FOR…” and compatible-position feedback give the player pool useful context.
- Shared controls now generally expose roles, labels, hints, states, and 44px hit areas.
- The compact workflow summary is a better hierarchy than the previous repeated command/metric cards.

## Priority Issues

### [P1] Mobile squad editing remains too dense

The pitch is tall, jersey slots are narrow, jersey cards carry many data points, and reserve actions are compressed into one row. The separate remove affordance is still only 22×22px in `PlayerJersey.tsx`.

Fix: use a focused mobile list or one-slot-at-a-time editor, enlarge remove hit areas to 44px, and move reserve reordering into a dedicated action sheet.

Suggested command: `$impeccable adapt`

### [P1] Navigation remains hidden behind the collapsed dock

The collapsed dock exposes only the current destination. Users must discover that it expands before they can navigate. The mobile action bar at `bottom: 64` also sits close to the dock at `bottom: 16`.

Fix: use persistent bottom tabs on mobile or expose desktop navigation permanently; reserve the command dock for secondary matchday actions.

Suggested command: `$impeccable adapt`

### [P1] “Rules & Admin” dead-ends

The row looks interactive, displays `INFO`, and has a handler path that does nothing for the relevant item. This is a direct violation of user expectation.

Fix: route it to a real rules surface, make it visibly unavailable, or remove it until implemented.

Suggested command: `$impeccable harden`

### [P2] Demo confirmation still sounds authoritative

The primary action says “LOCK SQUAD”, but the result is local demo storage and no server submission. The disclosure exists, but too late in the flow.

Fix: use “Save demo squad” or place “Demo only” directly beside the primary action. Reserve “Lock squad” for authoritative backend behavior.

Suggested command: `$impeccable clarify`

### [P1] Wide layout uses a fixed horizontal offset

The wide layout applies a fixed 192px margin around the 1024px breakpoint without a corresponding persistent sidebar. This can create unnecessary horizontal offset or overflow.

Fix: replace the margin with a bounded grid/sidebar column or remove it and validate 1024–1280px widths.

Suggested command: `$impeccable adapt`

## Audit Health Score

| Dimension | Score | Key Finding |
|---|---:|---|
| Accessibility | 2/4 | Better labels and 44px controls, but microcopy and fixed text sizes remain difficult at larger font scales. |
| Performance | 3/4 | Memoized player rows and capped pagination; no obvious expensive layout work. |
| Theming | 3/4 | Runtime theme system works broadly; raw sport palettes and dark fallbacks remain. |
| Responsive Design | 2/4 | Breakpoints exist, but fixed wide offset and bottom overlays remain risky. |
| Implementation Integrity | 4/4 | Detector clean and product-specific structure is coherent. |
| **Total** | **14/20** | **Good; address weak dimensions.** |

## Persona Red Flags

- **First-timer:** may not discover navigation, must infer that selecting a jersey changes pool context, and may read “Lock squad” as real submission.
- **Mobile manager:** small jersey/remove controls, a 650px pitch, crowded reserve actions, and stacked bottom surfaces make one-handed editing difficult.
- **Power user:** no fast fill path, and tactical/hub/transfer/review surfaces add steps instead of accelerating squad completion.

## Minor Observations

- Many labels remain 7–11px, which is fragile for Dynamic Type and large font settings.
- `CommandDock` reads reduced-motion state once and does not subscribe to changes while mounted.
- `OverlaySurface` is coherent, but `SquadScreen` still has several bespoke modal systems.
- Sport-specific nation colors are valid, but should remain named semantic tokens rather than raw palette constants.

## Questions to Consider

- What if the squad screen had one primary job—fill the XV—and every other tool appeared only when needed?
- Should mobile use a conventional persistent tab bar instead of making navigation a discovery problem?
- Is “Lock squad” intentionally demo theater, or should the language be honest about local saving?
- Would the rugby identity be stronger if the pitch were simpler and the player decision surface larger?
