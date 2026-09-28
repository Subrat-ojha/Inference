---
version: 1
slug: "src-schedule-tsx"
primary_target: "src/Schedule.tsx"
related_targets: ["src/App.tsx", "src/schedule.css", "functions/tracker.ts", "functions/db/schema.ts"]
---

# Personal schedule

- Primary target: `src/Schedule.tsx`
- Mode: Operate
- Audience: one person organizing their personal and work life.
- Job: record upcoming dates, tasks, appointments, and plans, then scan the month or a chronological agenda to see what's next.
- Constraints: arbitrary dates (not weekend-only), editable account-scoped records, all-day and timed items, date ranges, clear loading/saving/offline/empty states, responsive and keyboard accessible. Keep the Weekend Planner separate.

## Direction contract

THESIS: A readable personal datebook that turns a month of commitments into a clear next action.
OWN-WORLD: Inherit the Study Ledger's paper, ink, sage rules, square controls, and green only for selected or completed state.
STORY: Browse the month, select a day, then add or edit a dated task, event, or appointment in the adjacent agenda.
FIRST VIEWPORT: Show the month controls, a real date grid, the selected date's entries, and an inline add-entry action together; the calendar remains an actual interactive calendar, not a static illustration.
FORM: A precise extension of the existing Study Ledger; one flat calendar/agenda split, no generic card grid, no external Notion integration claim.
SIGNATURE INTERACTION: Selecting any date makes it the active ledger row and pre-fills the inline schedule editor; next/previous month preserves a valid selected date.
MOTION: Keep state visible without ornamental movement; selection changes are immediate and respect reduced motion.
BUILD PATH: code-led local extension; no comp round.
FINISH: inspect desktop and mobile once, fix the observed batch, build, run detector once, then review and document the built state.
