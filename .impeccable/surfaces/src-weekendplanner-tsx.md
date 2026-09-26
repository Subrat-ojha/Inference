---
version: 1
slug: "src-weekendplanner-tsx"
primary_target: "src/WeekendPlanner.tsx"
related_targets: ["src/App.tsx","src/weekend-events.ts","src/weekend-planner.css","functions/tracker.ts","functions/db/schema.ts"]
---

# Weekend planner

- Primary target: `src/WeekendPlanner.tsx`
- Mode: Operate
- Audience: one Hyderabad resident with free time on Saturdays and Sundays.
- Job: find a free local event, save it beside personal weekend tasks, and mark the plan done.
- Constraints: event suggestions need dated source and signup links; never imply attendance or registration; personal tasks stay on Saturdays and Sundays; account-scoped Neon sync, local offline recovery, responsive web, accessible controls.

## Direction contract

THESIS: A weekend is a small, deliberate plan: local opportunities beside the user's own next actions.
OWN-WORLD: Inherit the Study Ledger's paper, ink, sage rules, square controls, and green only for selected or completed state.
STORY: Compare free Hyderabad events by weekend, save a choice into the agenda, then add personal tasks and close the loop.
FIRST VIEWPORT: Show the selected weekend and task action above one flat agenda; place sourced event suggestions in a scannable list beside or directly before that agenda, never a generic event-card grid.
FORM: Precisely specified extension of the established app; candidate event rows move into the saved agenda through an explicit Add action. Seed: N/A (no concept roll for a local extension).
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
