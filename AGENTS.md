# Architecture rules

- Keep rounds-draw pot assignments per group in a phase-scoped browser draft and include them in the final draw report; phase-wide pot tables cannot replace group-specific assignments, and applying clears the draft.
- Style both live-draw dialogs with the shared draw-dialog-theme, draw-choice, draw-panel, and draw-table roles; shared tokens prevent the group and rounds workflows from drifting visually.
- Render both live draws inside one secured modal wizard that blocks outside-click and Escape dismissal; phase drafts preserve refresh recovery.
- Use equal-size pot choices and the shared fixed PotTeamSlots selector in both draw views; a bounded slot cannot overfill a pot and keeps assignment behavior consistent.
- Share one timestamp-driven 16:9 draw stage between admin and projector; inject organizer-only bowl and bottom controls into that stage, and publish presentation timing with the active phase session so reveal, selection hold and transfer stay synchronized without exposing controls.
- Fullscreen the director stage container rather than the document; mount its popovers and selectors within that container so controls remain usable in browser fullscreen.