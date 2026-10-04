---
target: frontend/src/components/AppScreen.tsx
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/home/eogan-sullivan/Projects/6Nations/frontend/src/components/AppScreen.tsx"
target_fingerprint: "sha256:788867f4df0058848740d0788adc7df74c0f42b6a21626210f59603ac1eb51e2"
target_path: /home/eogan-sullivan/Projects/6Nations/frontend/src/components/AppScreen.tsx
timestamp: 2026-10-04T20-04-43Z
slug: frontend-src-components-appscreen-tsx
---
⚠️ DEGRADED: single-context (spawn_agent unavailable in this session)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3/4 | Preview and deadline states are clearer, but status language remains inconsistent across screens. |
| 2 | Match System / Real World | 3/4 | Rugby concepts are strong; “OPEN” and “AVAILABLE” imply interactions that do not exist. |
| 3 | User Control and Freedom | 2/4 | Navigation is available, but modal/drawer escape and collapsed desktop-rail behavior need a complete focus model. |
| 4 | Consistency and Standards | 3/4 | Shared shell is coherent, while squad and secondary screens still use different density and labeling conventions. |
| 5 | Error Prevention | 3/4 | Squad validation is visible; preview screens could prevent false expectations more directly. |
| 6 | Recognition Rather Than Recall | 3/4 | Position, deadline, and squad progress are easy to recognize. |
| 7 | Flexibility and Efficiency | 2/4 | The main squad workflow is efficient, but desktop navigation adds an extra collapse affordance and secondary rows are inert. |
| 8 | Aesthetic and Minimalist Design | 3/4 | The pitch is distinctive; the app still carries too many rounded containers and micro-labels around it. |
| 9 | Error Recovery | 2/4 | Squad recovery is good, but empty/preview states do not offer a concrete next step. |
| 10 | Help and Documentation | 2/4 | Rules are named but not yet reachable from the secondary surfaces. |
| **Total** | | **26/40** | Solid foundation; interaction truth and focus behavior are the main gaps. |

## Design Specificity Verdict

The interface feels authored for fantasy rugby, especially through the pitch, jerseys, nation colors, captaincy, and deadline framing. The shell is less specific: the rail, repeated panel treatments, and compact status labels could belong to a generic dark operations dashboard.

The deterministic detector found no findings in the scanned React Native surfaces. That is useful confirmation that no obvious mechanical anti-pattern was detected, but it does not validate hierarchy, interaction truth, or native focus behavior. No ignore file exists.

## Overall Impression

The squad is the product’s strongest surface and has a clear point of view. The current refinement successfully quieted the old command-center chrome, but the next quality jump comes from making every visible affordance honest: if a row says it opens, it should open; if a surface is preview-only, it should say what the user can do next.

## What’s Working

- The pitch remains the unmistakable signature surface.
- Amber/neutral preview treatment is more truthful than green “live” signaling.
- Deadline, progress, and squad validation form a strong task hierarchy.
- Matches uses real pressable rows and a focused detail surface, giving that secondary route a stronger interaction model.

## Priority Issues

### [P1] Desktop navigation is visually persistent but behaviorally collapsible

Why it matters: A primary rail that can collapse behind a command-dock toggle weakens wayfinding and makes the layout feel less stable than the design spec implies.

Fix: On desktop, remove the expand/collapse state from the rail, keep navigation always visible, and reserve the toggle behavior for mobile. Ensure the desktop rail has a clear selected state and visible keyboard focus.

Suggested command: $impeccable audit

### [P1] Secondary-screen rows still overpromise interaction

Why it matters: Stats rows show “OPEN”; Profile rows show “AVAILABLE”, but these are not actionable controls. This creates dead ends and damages trust in a preview product.

Fix: Make each row a real Pressable with a destination, or replace the status with “Preview only” / “Not connected”. For Rules & help, provide a real readable surface rather than an inert label.

Suggested command: $impeccable clarify

### [P1] Modal and rail focus behavior is incomplete

Why it matters: The UI exposes modal semantics, but there is no evidence of focus trapping, focus restoration, or keyboard navigation across the rail and drawers. Keyboard and assistive-technology users may lose context.

Fix: Verify focus enters the opened modal, remains contained, returns to the triggering control on close, and supports Escape/back consistently. Add an explicit focus ring treatment for rail destinations and modal close controls.

Suggested command: $impeccable harden

### [P2] The visual system is still slightly too card-heavy around the pitch

Why it matters: AppScreen rows and empty states use rounded borders and shadows, while the squad uses additional cards, pills, and labeled blocks. The pitch remains primary, but supporting surfaces still compete for attention.

Fix: Reserve elevation for the pitch, deadline, and one active task surface. Flatten passive rows, reduce repeated rounded containers, and replace some uppercase micro-labels with sentence-case supporting text.

Suggested command: $impeccable distill

## Persona Red Flags

**Jordan, first-time manager**

- “Leagues” correctly explains that the preview is unavailable, but gives no next action such as signing in or returning to squad.
- “Stats & Fixtures” presents illustrative rows with “OPEN”, which suggests a working stats detail page.
- Rules are visible as a profile row but cannot be opened.

**Alex, power user**

- Desktop navigation requires an unnecessary dock toggle despite being a persistent rail.
- The squad has several dense control clusters for filters, reserves, captaincy, drawers, and review; keyboard traversal order should be tested end-to-end.
- The primary action is clear, but focus styling is inherited globally rather than intentionally designed for the rail and high-value controls.

**Morgan, trust-sensitive sports fan**

- “HALFTIME PREVIEW” is clearer, but event dots and point impacts still use the same positive emerald treatment as valid/selected states.
- The preview disclaimer is accurate but does not explain when official data will become available or what the user can safely do now.

## Minor Observations

- CommandDock still labels the desktop rail as a “Command dock” and “Command centre”; this is leftover operational language from the chrome the refinement is trying to reduce.
- The mobile dock footer repeats deadline and matchday context already present on squad and match surfaces.
- The stats screen has both a “Synthetic preview” filter bar and an empty-state explanation; these could be combined.
- The shared SectionRow is non-interactive by construction, making it easy for future screens to create more inert affordances.

## Questions to Consider

1. Should desktop navigation be permanently open, with the command-dock collapse behavior retained only on mobile?
2. Should Rules & help become the next real secondary surface, or should all unavailable rows be explicitly flattened to “Preview only” until their destinations exist?
3. Should the next pass prioritize accessibility/focus correctness or reducing the remaining card density?
