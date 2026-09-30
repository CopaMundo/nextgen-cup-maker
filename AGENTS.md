# Architecture rules

- Keep rounds-draw pot assignments per group in a phase-scoped browser draft and include them in the final draw report; phase-wide pot tables cannot replace group-specific assignments, and applying clears the draft.
- Style both live-draw dialogs with the shared draw-dialog-theme, draw-choice, draw-panel, and draw-table roles; shared tokens prevent the group and rounds workflows from drifting visually.
- Render live draws as in-page tournament views rather than overlays; this prevents accidental dismissal and keeps browser refresh recovery predictable.
- Use equal-size pot choices and the shared fixed PotTeamSlots selector in both draw views; a bounded slot cannot overfill a pot and keeps assignment behavior consistent.