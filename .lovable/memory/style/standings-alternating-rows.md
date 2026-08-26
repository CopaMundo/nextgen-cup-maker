---
name: Standings alternating rows
description: All public standings tables must use a consistent zebra-stripe pattern across every broadcast theme.
type: design
---
Every public standings table uses alternating row colors so that odd and even positions are visually distinct.

Implementation:
- `PublicStandings.tsx` applies `ds(bStyle, "tableRowAlt")` to rows where `idx % 2 !== 0` (i.e. even table positions).
- All broadcast styles in `src/lib/broadcastStyles.ts` set `tableRowAlt: "bg-secondary/35"`, making the alternate row color consistent and theme-aware via the `--secondary` token.

This applies to every broadcast theme, including Copa Mundo, European Nights, La Rosa, Teletext, etc.
