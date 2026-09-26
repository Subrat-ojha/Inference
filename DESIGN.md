---
name: Engineering Track
description: A quiet study ledger for engineering, private references, and English clarity practice.
colors:
  paper: "#f7f7f4"
  paper-raised: "#fbfcfa"
  ink: "#171c1a"
  muted: "#626c68"
  faint: "#59635f"
  rule: "#cbd5d0"
  rule-strong: "#9fb2aa"
  state-green: "#226b49"
  state-green-dark: "#174b35"
  danger: "#9e3e34"
  focus: "#c97a3d"
  white: "#ffffff"
  dark-paper: "#111613"
  dark-paper-raised: "#171d1a"
  dark-ink: "#edf2ef"
  dark-muted: "#adb9b3"
  dark-rule: "#34423b"
  dark-state-green: "#5fc28e"
typography:
  display:
    fontFamily: "JetBrains Mono Variable, monospace"
    fontSize: "clamp(1.5rem, 2vw, 2.05rem)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.05em"
  body:
    fontFamily: "Source Sans 3 Variable, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "JetBrains Mono Variable, monospace"
    fontSize: "0.73rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.08em"
rounded:
  control: "2px"
  status: "50%"
spacing:
  compact: "8px"
  field: "16px"
  gutter-mobile: "20px"
  gutter-desktop: "32px"
components:
  state-progress:
    backgroundColor: "{colors.state-green}"
    rounded: "{rounded.control}"
    height: "12px"
  text-field:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "13px 16px"
  reset-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.white}"
    rounded: "{rounded.control}"
    padding: "7px 12px"
---

## Overview

**Creative North Star: The Study Ledger.** The interface should feel like a calm engineering record: precise, quiet, and built around visible reading and practice rather than decoration.

**The Practice Before Progress Rule.** Reading gives direction, but checked progress belongs to small hands-on tasks. Every stage therefore pairs specific official reading with focused practice and optional notes.

## Colors

Use paper tones for the canvas and raised fields, ink for primary content, and muted or faint ink only for supporting copy. Dark mode uses near-black green paper, pale ink, stronger rules, and a brighter state green while preserving the same semantic hierarchy. **The One Green Rule:** reserve green for state, progress, focus, and successful synchronization. Danger red belongs only to destructive confirmation. The warm focus token makes keyboard location unmistakable without competing with state color.

## Typography

**The Measurement Voice Rule.** JetBrains Mono is for headings, labels, numbers, dates, and status text—the parts that behave like recorded measurements. Source Sans 3 is for instructions, explanations, and user-entered prose. Keep headings compact and uppercase; do not use monospace for long reading passages.

## Layout

Treat each roadmap stage as a ledger row inside a centered reading column. **The One Open Sheet Rule:** only one stage or one dated practice day should expose its full run sheet at a time. A compact two-tab switch selects the inference or Java track without turning into a navigation sidebar. The top-level section switch keeps exactly four primary sections (the engineering roadmap, personal vault, English clarity record, and weekend planner) equally accessible without mixing their content. Selecting a practice day moves keyboard focus to the active sheet; on narrow screens, bring that sheet into view. Use the desktop gutter above 1050px, reduce density below that point, and stack detail columns on narrow screens. Controls must remain comfortable to tap on narrow screens.

## Elevation & Depth

**The Flat Sheet Rule.** Do not use shadows. Create hierarchy with rules, restrained tonal changes, whitespace, and the expanded sheet's structure. Raised paper is a field affordance, not simulated physical depth.

## Shapes

The system is intentionally square and technical. Inputs, buttons, checks, and progress rails use the small control radius. Reserve circles for status dots only. Avoid pills, ornamental curves, and oversized rounded cards.

## Components

- **Ledger row:** A full-width stage trigger with its index, title, state, and reveal marker. Hover and focus may strengthen the rule or text but must not shift the layout.
- **Track switcher:** Two restrained, full-width tabs show each track's sprint count and independent progress.
- **Mobile study dock:** A safe-area-aware bottom control keeps AI/Java selection, the current stage code, and an “Open stage” action within thumb reach below 700px.
- **Task checkbox:** A compact square check paired with an action sentence. Completion changes the check and text state while retaining readable contrast.
- **Reading list:** Two official links per stage, each with a precise instruction describing what to read and why it matters.
- **Study notes:** An optional full-width text area for questions, commands, and observations from the sprint.
- **Progress rule:** A thin deterministic bar showing completed tasks across all stages, accompanied by an exact numeric label.
- **Inference signal header:** A faint stepped trace sits behind the tracker header, with one moving green packet and one pulsing current node. It must remain subordinate to the account, stage, and progress content, adapt to both themes, and respect reduced-motion preferences.
- **Primary section switcher:** Four full-width ledger tabs move between the engineering roadmap, personal vault, English clarity record, and weekend planner while preserving the current account and theme controls.
- **Personal vault:** A private, account-scoped workspace for GitHub references, prompts, projects, and freeform text. Desktop uses a filter rail, searchable results column, and reading/editor pane; narrow screens stack those regions without hiding actions.
- **Vault note:** Each note has one type, title, body, optional URL, tags, pin state, and timestamps. Empty, loading, saving, error, delete-confirmation, and session-expired states must remain explicit.
- **English clarity ledger:** A private, account-scoped rehearsal record for the exact run from 26 September through 25 October 2026. Desktop pairs a sticky dated index with one active run sheet; narrow screens cap the index and move the selected day into view. Every day exposes the same 45-minute sequence: 10 minutes listening and dictation, 10 minutes sound mechanics, 15 minutes shadowing, and 10 minutes workplace rehearsal. It also includes three workplace sentences (90 total), completion state, and one short evidence note. The learner chooses one US or UK pronunciation model for consistency, and each of six clip links repeats across a five-day block. Copy must frame the goal as intelligibility while preserving the learner's accent, never as a fluency or accent-removal promise.
- **Weekend planner:** A private, account-scoped Saturday/Sunday agenda pairs personal tasks with sourced Hyderabad event listings. Preloaded listings are explicitly tentative, show registration and source links, and never imply that the user has RSVP'd. The selected weekend's event suggestions sit beside a flat agenda; users can add weekend-dated tasks, complete them, or remove them. Keep this as a scannable planning surface, not a generic event-card grid, and stack its columns on narrow screens.
- **Sync status:** A persistent, non-interactive status notice communicates loading, saving, saved, offline recovery, or demo data. English practice and the weekend planner save to the signed-in user's Neon row; each keeps an account-keyed, versioned local record with a dirty flag so failed writes remain in the browser and retry when the browser reports that it is online. English practice also reports invalid clip links.
- **Theme toggle:** A compact square switch in the status block. It follows the device on first visit, then remembers the learner's explicit choice.
- **Reset confirmation:** A destructive action that expands beside its trigger and always offers an immediate safe exit.

## Do's and Don'ts

- Do make the next useful action obvious.
- Do make the one-hour scope and the difference between orientation and mastery explicit.
- Do preserve keyboard focus, readable contrast, and reduced-motion behavior.
- Do keep synchronization state visible and truthful.
- Don't promise fluency or accent removal from the dated English practice cycle.
- Don't imply that passive reading equals engineering ability.
- Don't use green as general decoration.
- Don't hide multiple expanded stage sheets in the page.
- Don't add shadows, glossy gradients, pills, or ornamental dashboard cards.
