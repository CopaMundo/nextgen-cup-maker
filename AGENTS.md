# Architecture rules

- Keep rounds-draw pot assignments per group in the dialog draft and include them in the final draw report; the existing phase-wide pot tables cannot safely replace group-specific assignments, and closing must discard unsaved changes.
- Style both live-draw dialogs with the shared draw-dialog-theme, draw-choice, draw-panel, and draw-table roles; shared tokens prevent the group and rounds workflows from drifting visually.