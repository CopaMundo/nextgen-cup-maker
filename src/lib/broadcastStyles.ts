export type BroadcastStyle =
  | "copa_mundo_bc"
  | "european_nights"
  | "la_rosa"
  | "teletext"
  | "wc26"
  | "retro_bw"
  | "serie_a";


export const BROADCAST_STYLES: Record<BroadcastStyle, { name: string; description: string; preview: string }> = {
  copa_mundo_bc: { name: "Copa Mundo", description: "Broadcast Style #1 — de native Copa Mundo identiteit: donkergroen/zwart met geel (dark) en diep blauw (light), Inter typografie", preview: "🟡" },
  european_nights: { name: "European Nights", description: "Broadcast Style #2 — premium Europese voetbalavond: nachtblauw met elektrisch blauw, cyan, violet en prisma-accenten, Roboto Condensed + Inter", preview: "🌙" },
  wc26: { name: "World Cup 26", description: "Broadcast Style #7 — internationale broadcastlook: zwart-wit met turquoise accent en spaarzaam goud, Barlow Condensed + Inter", preview: "🟦" },
  la_rosa: { name: "La Rosa", description: "Broadcast Style #8 — moderne Italiaanse sportkrant: roze papier, zwarte inkt en magenta accenten, Roboto Condensed headlines + Roboto body", preview: "🩷" },
  teletext: { name: "Teletext Football", description: "Broadcast Style #12 — klassieke voetbalteletekst: zwart scherm met cyan/geel/groen/rood, VT323 als enige lettertype, pagenummers en platte kolommen", preview: "▚" },
  retro_bw: { name: "Retro Black & White", description: "Broadcast Style #4 — vintage matchdayprogramma in zwart-wit: warm gebroken wit, dunne lijnen en Barlow Condensed scoreboardtypografie", preview: "⬛" },
  serie_a: { name: "Serie A", description: "Broadcast Style #13 — Italiaanse topflight scoreboardlook: diepe navy met een felgroen-naar-turquoise gradient-accent, scherpe hoeken en Barlow Condensed typografie", preview: "🟢" },
};


const STYLES: Record<BroadcastStyle, Record<string, string>> = {
  // ── 1. CHAMPIONS LEAGUE ───

  // ── 2. FIFA / EA SPORTS ───

  // ── 3. RETRO SCOREBORD ───

  // ── 4. BREAKING NEWS / ESPN ───

  // ── 5. STREET FOOTBALL ───

  // ── 6. DATA GEEK ───

  // ── 7. LA GAZZETTA ───

  // ── 8. SOCIAL MEDIA FEED ───

  // ── 9. COPA MUNDO ─── premium European night-football: deep navy + electric blue

  // ── 10. NETFLIX ───

  // ── 11. WORLD CUP 2026 ───

  // ── 12. WORLD CUP — MEXICO (green Trionda) ───
  // Identiek aan world_cup base; enkel TITELBALKEN krijgen Mexico-groen met chevron-motief.

  // ── 13. WORLD CUP — CANADA (red Trionda) ───

  // ── 14. WORLD CUP — USA (blue Trionda stars) ───

  // ── 15. RETRO FOOTBALL ─── 1978 matchday programme: cream paper, forest green, faded red
  // ── BROADCAST #1: COPA MUNDO (new generation) ───
  copa_mundo_bc: {
    sectionDot: "h-3.5 w-1 rounded-full bg-primary",
    sectionTitle: "text-[15px] font-bold text-foreground tracking-tight",
    sectionMeta: "text-[11px] font-medium text-muted-foreground",
    sectionLine: "flex-1 h-px bg-border",
    card: "rounded-[3px] border border-border bg-card overflow-hidden",
    matchCardWrapper: "rounded-[3px] border border-border bg-card overflow-hidden",
    cardHeader: "bg-secondary border-b border-border px-3 py-2 flex items-center gap-2",
    cardHeaderDot: "h-1.5 w-1.5 rounded-full bg-primary",
    cardHeaderTitle: "text-[10px] font-semibold text-foreground uppercase tracking-[0.08em]",
    homeCardHeader: "bg-secondary border-b border-border px-3 py-2 flex items-center gap-2",
    homeCardHeaderTitle: "text-[11px] font-semibold text-foreground uppercase tracking-[0.08em]",
    tabContainer: "flex gap-1 rounded-[3px] bg-secondary border border-border p-1",
    tabActive: "flex-1 px-3 py-1.5 rounded-[3px] text-[11px] font-semibold transition-colors bg-primary text-primary-foreground",
    tabInactive: "flex-1 px-3 py-1.5 rounded-[3px] text-[11px] font-medium transition-colors text-muted-foreground hover:text-foreground",
    badge: "inline-flex items-center rounded-[3px] bg-secondary border border-border px-2 py-0.5 text-[10px] font-semibold text-foreground tabular-nums",
    label: "text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground",
    backButton: "flex items-center gap-1 text-[11px] font-semibold text-primary",
    matchContext: "bg-secondary px-3 py-1.5 border-b border-border",
    matchContextText: "text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground cm-match-context",
    matchLegBadge: "inline-flex items-center rounded-[3px] bg-primary/10 border border-primary/30 px-1.5 py-0.5 text-[7px] font-bold uppercase text-primary",
    matchTeamRow: "px-3 py-2",
    matchTeamRowWin: "bg-primary/[0.06] border-l-[3px] border-l-primary/70 cm-match-winner",
    bracketQualBar: "bg-primary",
    matchTeamName: "text-[12px] font-semibold truncate cm-match-name",
    matchTeamNameFav: "text-primary",
    matchScore: "text-[14px] font-extrabold tabular-nums cm-match-score",
    matchScoreWin: "text-foreground cm-match-score",
    matchScoreLose: "text-muted-foreground cm-match-score",
    matchTimeBadge: "inline-flex items-center rounded-[3px] border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary tabular-nums",
    matchFooter: "flex items-center justify-between px-3 py-1.5 bg-secondary/60 border-t border-border",
    navBar: "bg-background/95 backdrop-blur-md border-t border-border",
    navCenter: "bg-card text-muted-foreground border-border rounded-[3px]",
    navCenterActive: "bg-card text-primary border-primary rounded-[3px] scale-105",
    navTab: "text-muted-foreground hover:text-foreground",
    navTabActive: "text-primary",
    navIndicator: "absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-[3px] bg-primary",
    tableHeader: "bg-secondary text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground border-b border-border",
    tableRowAlt: "bg-secondary/35",
    ptsBadge: "inline-flex items-center justify-center rounded-[3px] bg-primary px-1.5 py-0.5 text-[11px] font-extrabold text-primary-foreground tabular-nums",
    timeslotHeader: "bg-secondary text-foreground flex items-center gap-2 px-3 py-1 border-b border-border",
    timeslotBadge: "inline-flex items-center rounded-[3px] border border-primary bg-primary/10 px-2 py-0 text-[10px] font-bold text-primary tabular-nums",
    timeslotHeaderMeta: "text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground",
    dateHeader: "bg-primary text-primary-foreground px-2.5 py-0.5 rounded-[3px] text-[10px] font-semibold uppercase tracking-[0.06em]",
    phaseTab: "px-3 py-1.5 rounded-[3px] text-[10px] font-semibold uppercase tracking-[0.06em] whitespace-nowrap transition-colors",
    phaseTabActive: "bg-primary text-primary-foreground",
    phaseTabInactive: "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/40",
    subHeader: "px-3 py-2 flex items-center justify-between gap-2 bg-secondary border-l-2 border-l-primary",
    subHeaderTitle: "text-[11px] font-bold uppercase tracking-[0.06em] text-foreground",
    subLabel: "inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground",
    coverOverlay: "cm-cover",
  },
  // ── BROADCAST #2: EUROPEAN NIGHTS (new generation) ───
  european_nights: {
    sectionDot: "h-4 w-[3px] rounded-[3px] bg-gradient-to-b from-[hsl(var(--broadcast-cyan))] via-primary to-[hsl(var(--broadcast-violet))]",
    sectionTitle: "font-['Roboto_Condensed'] text-[17px] font-bold uppercase tracking-[0.04em] text-foreground",
    sectionMeta: "text-[11px] font-medium text-muted-foreground",
    sectionLine: "flex-1 h-px bg-gradient-to-r from-border via-border to-transparent",
    card: "rounded-[3px] border border-border bg-card overflow-hidden shadow-sm",
    matchCardWrapper: "rounded-[3px] border border-border bg-card overflow-hidden shadow-sm",
    cardHeader: "bg-secondary border-b border-border px-3 py-1.5 flex items-center gap-2",
    cardHeaderDot: "h-3 w-[3px] rounded-[3px] bg-primary",
    cardHeaderTitle: "font-['Roboto_Condensed'] text-[12px] font-bold text-foreground uppercase tracking-[0.06em]",
    homeCardHeader: "bg-secondary border-b border-border border-l-2 border-l-primary px-3 py-1.5 flex items-center gap-2",
    homeCardHeaderTitle: "font-['Roboto_Condensed'] text-[13px] font-bold text-foreground uppercase tracking-[0.06em]",
    tabContainer: "flex gap-4 border-b border-border",
    tabActive: "flex-1 px-1 pb-2 pt-1 font-['Roboto_Condensed'] text-[13px] font-bold uppercase tracking-[0.06em] text-primary border-b-2 border-primary transition-colors duration-150",
    tabInactive: "flex-1 px-1 pb-2 pt-1 font-['Roboto_Condensed'] text-[13px] font-medium uppercase tracking-[0.06em] text-muted-foreground border-b-2 border-transparent hover:text-foreground transition-colors duration-150",
    badge: "inline-flex items-center rounded-[3px] bg-secondary border border-border px-2 py-0.5 font-['Roboto_Condensed'] text-[11px] font-bold uppercase tracking-[0.06em] text-foreground tabular-nums",
    label: "text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground",
    backButton: "flex items-center gap-1 font-['Roboto_Condensed'] text-[12px] font-bold uppercase tracking-[0.06em] text-primary",
    matchContext: "en-infobar px-3 py-1 border-b border-[hsl(226_45%_26%)]",
    matchContextText: "font-['Roboto_Condensed'] text-[11px] font-bold uppercase tracking-[0.07em] text-[hsl(223_29%_78%)]",
    matchLegBadge: "inline-flex items-center rounded-[3px] bg-primary/10 border border-primary/30 px-1.5 py-0.5 font-['Roboto_Condensed'] text-[7px] font-bold uppercase text-primary",
    matchTeamRow: "px-3 py-2 rounded-[3px]",
    matchTeamRowWin: "bg-[hsl(var(--broadcast-primary)/0.16)] border-l-[3px] border-l-[hsl(var(--broadcast-primary)/0.55)]",
    bracketQualBar: "bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.6)]",

    matchTeamName: "text-[12px] font-semibold truncate",
    matchTeamNameFav: "text-primary",
    matchScore: "font-['Roboto_Condensed'] text-[17px] font-extrabold tabular-nums",
    matchScoreWin: "text-foreground",
    matchScoreLose: "text-muted-foreground",
    matchTimeBadge: "inline-flex items-center rounded-[3px] bg-primary px-2 py-0.5 font-['Roboto_Condensed'] text-[13px] font-extrabold text-primary-foreground tabular-nums",
    matchFooter: "flex items-center justify-between px-3 py-1 bg-secondary/60 border-t border-border",
    navBar: "bg-secondary/95 backdrop-blur-md border-t border-border",
    navCenter: "en-home-btn border-border !rounded-full",
    navCenterActive: "en-home-btn border-primary !rounded-full scale-105 shadow-[0_0_16px_hsl(var(--primary)/0.4)]",

    navTab: "text-muted-foreground hover:text-foreground",
    navTabActive: "text-primary",
    navIndicator: "absolute -bottom-1 left-1/2 -translate-x-1/2 w-5 h-[2px] rounded-[3px] bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.8)]",
    tableHeader: "bg-secondary font-['Roboto_Condensed'] text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground border-b border-border",
    tableRowAlt: "bg-secondary/35",
    ptsBadge: "inline-flex items-center justify-center rounded-[3px] bg-[hsl(var(--broadcast-score))] px-1.5 py-0.5 font-['Roboto_Condensed'] text-[13px] font-extrabold text-primary-foreground tabular-nums",
    timeslotHeader: "en-timeslot-header bg-primary text-primary-foreground flex items-center gap-2 px-3 py-1.5",
    timeslotBadge: "inline-flex items-center rounded-[3px] bg-primary-foreground/15 border border-primary-foreground/30 px-2 py-0.5 font-['Roboto_Condensed'] text-[14px] font-extrabold text-primary-foreground tabular-nums",
    timeslotHeaderMeta: "font-['Roboto_Condensed'] text-[12px] font-bold uppercase tracking-[0.06em] text-primary-foreground/85",
    dateHeader: "bg-primary text-primary-foreground px-2.5 py-0.5 rounded-[3px] font-['Roboto_Condensed'] text-[12px] font-bold uppercase tracking-[0.06em]",
    phaseTab: "px-3 py-1 rounded-[3px] font-['Roboto_Condensed'] text-[12px] font-bold uppercase tracking-[0.07em] whitespace-nowrap transition-colors duration-150",
    phaseTabActive: "bg-primary text-primary-foreground shadow-[0_0_12px_hsl(var(--primary)/0.35)]",
    phaseTabInactive: "bg-secondary border border-border text-muted-foreground hover:text-foreground hover:border-primary/50",
    subHeader: "px-3 py-1.5 flex items-center justify-between gap-2 bg-secondary border-l-2 border-l-primary",
    subHeaderTitle: "font-['Roboto_Condensed'] text-[13px] font-bold uppercase tracking-[0.06em] text-foreground",
    subLabel: "inline-flex items-center px-2 py-0.5 font-['Roboto_Condensed'] text-[11px] font-bold uppercase tracking-[0.07em] text-muted-foreground",
    coverOverlay: "en-cover-prism",
    logoFrame: "ring-1 ring-primary/40 shadow-[0_0_28px_hsl(var(--primary)/0.28)]",
    bracketConnector: "en-connector",
  },
  // ── BROADCAST #3: JOGA BONITO (new generation) ───
  
  // ── BROADCAST #13: SERIE A ───
  serie_a: {
    sectionDot: "h-4 w-1 rounded-none bg-gradient-to-b from-[hsl(var(--broadcast-primary))] to-[hsl(var(--broadcast-cyan))]",
    sectionTitle: "font-['Barlow_Condensed'] text-[19px] font-extrabold uppercase tracking-[0.04em] text-foreground",
    sectionMeta: "font-['Barlow_Condensed'] text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground",
    sectionLine: "flex-1 h-px bg-border",
    card: "sa-card border border-border bg-card overflow-hidden",
    matchCardWrapper: "sa-card border border-border bg-card overflow-hidden",
    cardHeader: "sa-gradient-bar px-3 py-2 flex items-center gap-2",
    cardHeaderDot: "h-3 w-1 bg-white/80",
    cardHeaderTitle: "font-['Barlow_Condensed'] text-[12px] font-bold text-white uppercase tracking-[0.1em]",
    homeCardHeader: "sa-gradient-bar px-3 py-2 flex items-center gap-2",
    homeCardHeaderTitle: "font-['Barlow_Condensed'] text-[13px] font-extrabold text-white uppercase tracking-[0.1em]",
    tabContainer: "flex gap-1 rounded-none bg-secondary border border-border p-1",
    tabActive: "flex-1 px-3 py-1.5 rounded-none font-['Barlow_Condensed'] text-[12px] font-bold uppercase tracking-[0.08em] transition-colors bg-primary text-primary-foreground",
    tabInactive: "flex-1 px-3 py-1.5 rounded-none font-['Barlow_Condensed'] text-[12px] font-semibold uppercase tracking-[0.08em] transition-colors text-muted-foreground hover:text-foreground",
    badge: "inline-flex items-center rounded-none bg-secondary border border-border px-2 py-0.5 font-['Barlow_Condensed'] text-[11px] font-bold uppercase tracking-[0.06em] text-foreground tabular-nums",
    label: "font-['Barlow_Condensed'] text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground",
    backButton: "flex items-center gap-1 font-['Barlow_Condensed'] text-[12px] font-bold uppercase tracking-[0.1em] text-primary",
    matchContext: "bg-secondary px-3 py-1.5 border-b border-border border-l-2 border-l-primary",
    matchContextText: "font-['Barlow_Condensed'] text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground",
    matchLegBadge: "inline-flex items-center rounded-none bg-primary/10 border border-primary/30 px-1.5 py-0.5 font-['Barlow_Condensed'] text-[7px] font-bold uppercase text-primary",
    matchTeamRow: "px-3 py-2",
    matchTeamRowWin: "bg-primary/[0.08] border-l-[3px] border-l-primary",
    bracketQualBar: "bg-gradient-to-b from-[hsl(var(--broadcast-primary))] to-[hsl(var(--broadcast-cyan))]",
    matchTeamName: "text-[13px] font-semibold truncate",
    matchTeamNameFav: "font-bold text-primary",
    matchScore: "font-['Barlow_Condensed'] text-[22px] font-extrabold tabular-nums",
    matchScoreWin: "text-foreground",
    matchScoreLose: "text-muted-foreground",
    matchTimeBadge: "inline-flex items-center rounded-none bg-primary px-2 py-0.5 font-['Barlow_Condensed'] text-[13px] font-bold text-primary-foreground tabular-nums",
    matchFooter: "flex items-center justify-between px-3 py-1.5 bg-secondary/60 border-t border-border",
    navBar: "bg-[hsl(var(--broadcast-night))] border-t border-border",
    navCenter: "rounded-none bg-card text-foreground border border-border",
    navCenterActive: "rounded-none bg-card text-primary border border-primary scale-105",
    navTab: "text-white/55 hover:text-white",
    navTabActive: "text-primary",
    navIndicator: "absolute -bottom-1 left-1/2 -translate-x-1/2 w-5 h-[2px] bg-primary",
    tableHeader: "sa-gradient-bar font-['Barlow_Condensed'] text-[10px] font-bold uppercase tracking-[0.1em] text-white",
    tableRowAlt: "bg-secondary/35",
    ptsBadge: "inline-flex items-center justify-center min-w-[24px] rounded-none bg-primary px-1.5 py-0.5 font-['Barlow_Condensed'] text-[13px] font-extrabold text-primary-foreground tabular-nums",
    timeslotHeader: "sa-gradient-bar flex items-center gap-2 px-3 py-2",
    timeslotBadge: "inline-flex items-center rounded-none bg-white/15 border border-white/30 px-2 py-0.5 font-['Barlow_Condensed'] text-[14px] font-extrabold text-white tabular-nums",
    timeslotHeaderMeta: "font-['Barlow_Condensed'] text-[11px] font-bold uppercase tracking-[0.1em] text-white/85",
    dateHeader: "sa-gradient-bar text-white px-3 py-1.5 font-['Barlow_Condensed'] text-[13px] font-extrabold uppercase tracking-[0.08em]",
    phaseTab: "px-3 py-1.5 rounded-none font-['Barlow_Condensed'] text-[12px] font-bold uppercase tracking-[0.08em] whitespace-nowrap transition-colors",
    phaseTabActive: "bg-primary text-primary-foreground border border-primary",
    phaseTabInactive: "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/50",
    subHeader: "px-3 py-2 flex items-center justify-between gap-2 sa-gradient-bar",
    subHeaderTitle: "font-['Barlow_Condensed'] text-[13px] font-extrabold uppercase tracking-[0.08em] text-white",
    subLabel: "inline-flex items-center px-2 py-0.5 font-['Barlow_Condensed'] text-[11px] font-bold uppercase tracking-[0.1em] text-white/75",
    coverOverlay: "sa-cover",
    logoFrame: "border-border bg-card",
    bracketConnector: "sa-connector",
  },
  
  // ── RETRO BLACK & WHITE ───
  retro_bw: {
    sectionDot: "h-2.5 w-2.5 bg-foreground",
    sectionTitle: "font-['Barlow_Condensed'] text-[18px] font-bold uppercase tracking-[0.12em] text-foreground",
    sectionMeta: "font-['Barlow_Condensed'] text-[12px] font-semibold uppercase tracking-[0.1em] text-muted-foreground",
    sectionLine: "flex-1 h-px bg-border",
    card: "rbw-card border border-border bg-card overflow-hidden",
    matchCardWrapper: "rbw-card border border-border bg-card overflow-hidden",
    cardHeader: "bg-secondary border-b border-border px-3 py-1.5 flex items-center gap-2",
    cardHeaderDot: "h-2 w-2 bg-foreground",
    cardHeaderTitle: "font-['Barlow_Condensed'] text-[12px] font-bold text-foreground uppercase tracking-[0.1em]",
    homeCardHeader: "bg-foreground border-b border-foreground px-3 py-1.5 flex items-center gap-2",
    homeCardHeaderTitle: "font-['Barlow_Condensed'] text-[13px] font-bold uppercase tracking-[0.12em] text-background",
    tabContainer: "flex gap-1.5",
    tabActive: "flex-1 px-2.5 py-1.5 rbw-card bg-foreground text-background font-['Barlow_Condensed'] text-[13px] font-bold uppercase tracking-[0.1em] transition-colors",
    tabInactive: "flex-1 px-2.5 py-1.5 rbw-card border border-border bg-card text-muted-foreground font-['Barlow_Condensed'] text-[13px] font-semibold uppercase tracking-[0.1em] hover:text-foreground transition-colors",
    badge: "inline-flex items-center rbw-card border border-border bg-secondary px-2 py-0.5 font-['Barlow_Condensed'] text-[12px] font-bold uppercase tracking-[0.08em] text-foreground tabular-nums",
    label: "font-['Barlow_Condensed'] text-[12px] font-bold uppercase tracking-[0.16em] text-foreground",
    backButton: "flex items-center gap-1 font-['Barlow_Condensed'] text-[13px] font-bold uppercase tracking-[0.1em] text-foreground",
    matchContext: "bg-secondary px-3 py-1 border-b border-border",
    matchContextText: "font-['Barlow_Condensed'] text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground",
    matchLegBadge: "inline-flex items-center rbw-card bg-foreground/10 border border-foreground/30 px-1.5 py-0.5 font-['Barlow_Condensed'] text-[7px] font-bold uppercase text-foreground",
    matchTeamRow: "px-3 py-1.5",
    matchTeamRowWin: "rbw-bracket-winner bg-secondary border-l-2 border-l-foreground",
    bracketQualBar: "rbw-bracket-qualbar bg-foreground",
    matchTeamName: "font-['Barlow_Condensed'] text-[14px] font-semibold uppercase tracking-[0.02em] truncate",
    matchTeamNameFav: "font-bold underline decoration-2 underline-offset-2",
    matchScore: "font-['Barlow_Condensed'] text-[20px] font-extrabold tabular-nums",
    matchScoreWin: "text-foreground",
    matchScoreLose: "text-muted-foreground",
    matchTimeBadge: "inline-flex items-center rbw-card bg-foreground px-2 py-0.5 font-['Barlow_Condensed'] text-[13px] font-extrabold text-background tabular-nums",
    matchFooter: "flex items-center justify-between px-3 py-1 bg-secondary border-t border-border",
    navBar: "bg-background border-t border-border",
    navCenter: "rbw-home-btn rbw-card bg-foreground text-background border-foreground",
    navCenterActive: "rbw-home-btn rbw-card bg-foreground text-background border-foreground scale-105",
    navTab: "text-muted-foreground hover:text-foreground",
    navTabActive: "text-foreground",
    navIndicator: "absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-[3px] bg-foreground",
    tableHeader: "bg-secondary font-['Barlow_Condensed'] text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground border-b border-border",
    tableRowAlt: "bg-secondary/35",
    ptsBadge: "inline-flex items-center justify-center min-w-[22px] rbw-card bg-foreground px-1.5 py-0.5 font-['Barlow_Condensed'] text-[13px] font-extrabold text-background tabular-nums",
    timeslotHeader: "bg-foreground text-background flex items-center gap-2 px-3 py-1.5 border-b border-foreground",
    timeslotBadge: "inline-flex items-center rbw-card bg-background px-2 py-0.5 font-['Barlow_Condensed'] text-[14px] font-extrabold text-foreground tabular-nums",
    timeslotHeaderMeta: "font-['Barlow_Condensed'] text-[12px] font-bold uppercase tracking-[0.1em] text-background/70",
    dateHeader: "rbw-brush bg-foreground text-background px-3 py-1 font-['Barlow_Condensed'] text-[13px] font-extrabold uppercase tracking-[0.12em]",
    phaseTab: "px-3 py-1 rbw-card font-['Barlow_Condensed'] text-[13px] font-bold uppercase tracking-[0.1em] whitespace-nowrap transition-colors",
    phaseTabActive: "bg-foreground text-background border border-foreground",
    phaseTabInactive: "bg-card border border-border text-muted-foreground hover:text-foreground",
    subHeader: "px-3 py-1.5 flex items-center justify-between gap-2 bg-foreground",
    subHeaderTitle: "font-['Barlow_Condensed'] text-[13px] font-bold uppercase tracking-[0.12em] text-background",
    subLabel: "inline-flex items-center px-2 py-0.5 font-['Barlow_Condensed'] text-[12px] font-bold uppercase tracking-[0.1em] text-background/70",
    coverOverlay: "rbw-cover",
    logoFrame: "border-border",
    bracketConnector: "rbw-connector",
  },
// ── OLD NEWSPAPER ───

  // ── MODERN BLACK & WHITE ───
// ── WORLD CUP 26 ───
  wc26: {
    sectionDot: "h-4 w-1 rounded-none bg-primary",
    sectionTitle: "font-['Barlow_Condensed'] text-[19px] font-extrabold uppercase tracking-[0.05em] text-foreground",
    sectionMeta: "font-['Barlow_Condensed'] text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground",
    sectionLine: "flex-1 h-px bg-border",
    card: "wc26-card border border-border bg-card overflow-hidden",
    matchCardWrapper: "wc26-card border border-border bg-card overflow-hidden",
    cardHeader: "bg-foreground border-b border-foreground px-3 py-2 flex items-center gap-2",
    cardHeaderDot: "h-3 w-1 bg-primary",
    cardHeaderTitle: "font-['Barlow_Condensed'] text-[12px] font-bold text-background uppercase tracking-[0.1em]",
    homeCardHeader: "bg-foreground border-b border-foreground px-3 py-2 flex items-center gap-2",
    homeCardHeaderTitle: "font-['Barlow_Condensed'] text-[13px] font-extrabold uppercase tracking-[0.12em] text-background",
    tabContainer: "flex gap-2",
    tabActive: "flex-1 px-3 py-2 wc26-card bg-primary text-primary-foreground font-['Barlow_Condensed'] text-[12px] font-bold uppercase tracking-[0.1em] transition-colors",
    tabInactive: "flex-1 px-3 py-2 wc26-card border border-border bg-card text-muted-foreground font-['Barlow_Condensed'] text-[12px] font-semibold uppercase tracking-[0.1em] hover:text-foreground transition-colors",
    badge: "inline-flex items-center wc26-card border border-primary/40 bg-primary/10 px-2 py-0.5 font-['Barlow_Condensed'] text-[12px] font-bold uppercase tracking-[0.08em] text-foreground tabular-nums",
    label: "font-['Barlow_Condensed'] text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground",
    backButton: "flex items-center gap-1 font-['Barlow_Condensed'] text-[12px] font-bold uppercase tracking-[0.12em] text-foreground",
    matchContext: "wc26-context bg-foreground px-3 py-1.5 border-b border-foreground",
    matchContextText: "font-['Barlow_Condensed'] text-[11px] font-semibold uppercase tracking-[0.12em] text-background",
    matchLegBadge: "wc26-leg-badge inline-flex items-center rounded-none bg-primary/10 border border-primary/30 px-1.5 py-0.5 font-['Barlow_Condensed'] text-[7px] font-bold uppercase text-[hsl(var(--broadcast-cyan))]",
    matchTeamRow: "px-3 py-2",
    matchTeamRowWin: "bg-primary/10",
    matchTeamName: "text-[14px] font-semibold truncate",
    matchTeamNameFav: "font-bold text-primary",
    matchScore: "font-['Barlow_Condensed'] text-[25px] font-bold tabular-nums",
    matchScoreWin: "text-primary",
    matchScoreLose: "text-primary/60",
    matchTimeBadge: "inline-flex items-center wc26-card bg-foreground px-2 py-0.5 font-['Barlow_Condensed'] text-[13px] font-bold text-background tabular-nums",
    matchFooter: "flex items-center justify-between px-3 py-1.5 border-t border-border",
    navBar: "bg-[hsl(var(--broadcast-night))] border-t border-border",
    navCenter: "wc26-card bg-card text-foreground border-[hsl(var(--broadcast-gold))]",
    navCenterActive: "wc26-card bg-card text-primary border-primary",
    navTab: "text-white/60 hover:text-white",
    navTabActive: "text-primary",
    navIndicator: "absolute -bottom-1 left-1/2 -translate-x-1/2 w-5 h-[2px] bg-primary",
    tableHeader: "bg-foreground font-['Barlow_Condensed'] text-[10px] font-bold uppercase tracking-[0.14em] text-background border-b border-border",
    tableRowAlt: "bg-secondary/35",
    ptsBadge: "inline-flex items-center justify-center min-w-[24px] rounded-none bg-primary px-1.5 py-0.5 font-['Barlow_Condensed'] text-[13px] font-bold text-black tabular-nums",
    timeslotHeader: "bg-primary/[0.08] text-foreground flex items-center gap-2 px-3 py-2 border-l-4 border-y border-r border-primary rounded-t-[6px]",
    timeslotBadge: "inline-flex items-center wc26-card bg-primary px-2 py-0.5 font-['Barlow_Condensed'] text-[14px] font-bold text-primary-foreground tabular-nums",
    timeslotHeaderMeta: "font-['Barlow_Condensed'] text-[11px] font-bold uppercase tracking-[0.14em] text-primary",
    dateHeader: "wc26-card bg-foreground text-background px-3 py-1.5 font-['Barlow_Condensed'] text-[14px] font-extrabold uppercase tracking-[0.1em]",
    phaseTab: "px-3 py-1.5 wc26-card font-['Barlow_Condensed'] text-[12px] font-bold uppercase tracking-[0.1em] whitespace-nowrap transition-colors",
    phaseTabActive: "bg-primary text-primary-foreground border border-primary",
    phaseTabInactive: "bg-card border border-border text-muted-foreground hover:text-foreground",
    subHeader: "px-3 py-2 flex items-center justify-between gap-2 bg-foreground",
    subHeaderTitle: "font-['Barlow_Condensed'] text-[13px] font-extrabold uppercase tracking-[0.12em] text-background",
    subLabel: "inline-flex items-center px-2 py-0.5 font-['Barlow_Condensed'] text-[11px] font-semibold uppercase tracking-[0.14em] text-background/70",
    coverOverlay: "wc26-cover",
    logoFrame: "!border-foreground bg-card",
    bracketConnector: "wc26-connector",
  },
// ── LA ROSA ───
  la_rosa: {
    sectionDot: "h-5 w-[3px] rounded-none bg-primary",
    sectionTitle: "font-['Roboto_Condensed'] text-[21px] font-black uppercase tracking-[0.02em] text-foreground",
    sectionMeta: "font-['Roboto_Condensed'] text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground",
    sectionLine: "flex-1 h-px bg-[hsl(var(--broadcast-border))]",
    card: "lrosa-card border border-[hsl(var(--broadcast-border))] bg-card overflow-hidden",
    matchCardWrapper: "lrosa-card border border-[hsl(var(--broadcast-border))] bg-card overflow-hidden",
    cardHeader: "bg-[hsl(var(--broadcast-surface-secondary))] border-b border-[hsl(var(--broadcast-border))] px-3 py-2 flex items-center gap-2",
    cardHeaderDot: "h-3.5 w-[3px] bg-primary",
    cardHeaderTitle: "font-['Roboto_Condensed'] text-[12px] font-bold text-foreground uppercase tracking-[0.12em]",
    homeCardHeader: "bg-foreground border-b border-foreground px-3 py-2 flex items-center gap-2",
    homeCardHeaderTitle: "font-['Roboto_Condensed'] text-[13px] font-black uppercase tracking-[0.12em] text-background",
    tabContainer: "flex gap-0 border-b border-[hsl(var(--broadcast-border))]",
    tabActive: "flex-1 px-3 py-2 border-b-2 border-primary font-['Roboto_Condensed'] text-[13px] font-black uppercase tracking-[0.1em] text-foreground transition-colors",
    tabInactive: "flex-1 px-3 py-2 border-b-2 border-transparent font-['Roboto_Condensed'] text-[13px] font-bold uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground transition-colors",
    badge: "inline-flex items-center rounded-none border border-[hsl(var(--broadcast-border))] bg-[hsl(var(--broadcast-surface-secondary))] px-2 py-0.5 font-['Roboto_Condensed'] text-[12px] font-bold uppercase tracking-[0.08em] text-foreground tabular-nums",
    label: "font-['Roboto_Condensed'] text-[11px] font-bold uppercase tracking-[0.18em] text-primary",
    backButton: "flex items-center gap-1 font-['Roboto_Condensed'] text-[12px] font-bold uppercase tracking-[0.12em] text-foreground",
    matchContext: "bg-[hsl(var(--broadcast-surface-secondary))] px-3 py-1.5 border-b border-[hsl(var(--broadcast-border))]",
    matchContextText: "font-['Roboto_Condensed'] text-[11px] font-bold uppercase tracking-[0.12em] text-foreground",
    matchLegBadge: "inline-flex items-center rounded-none bg-primary/10 border border-primary/30 px-1.5 py-0.5 font-['Roboto_Condensed'] text-[7px] font-black uppercase text-primary",
    matchTeamRow: "px-3 py-2",
    matchTeamRowWin: "bg-primary/10",
    bracketQualBar: "bg-primary",
    matchTeamName: "text-[14px] font-semibold truncate",
    matchTeamNameFav: "font-bold text-primary",
    matchScore: "font-['Roboto_Condensed'] text-[26px] font-black tabular-nums leading-none",
    matchScoreWin: "text-foreground",
    matchScoreLose: "text-muted-foreground",
    matchTimeBadge: "inline-flex items-center rounded-none bg-foreground px-2 py-0.5 font-['Roboto_Condensed'] text-[13px] font-bold text-background tabular-nums",
    matchFooter: "flex items-center justify-between px-3 py-1.5 border-t border-[hsl(var(--broadcast-border))]",
    navBar: "bg-[hsl(var(--broadcast-night))] border-t border-[hsl(var(--broadcast-night))]",
    navCenter: "lrosa-home-btn rounded-none",
    navCenterActive: "lrosa-home-btn rounded-none !border-primary",
    navTab: "text-white/60 hover:text-white",
    navTabActive: "text-primary",
    navIndicator: "absolute -bottom-1 left-1/2 -translate-x-1/2 w-5 h-[2px] bg-primary",
    tableHeader: "bg-foreground font-['Roboto_Condensed'] text-[10px] font-bold uppercase tracking-[0.14em] text-background",
    tableRowAlt: "bg-secondary/35",
    ptsBadge: "inline-flex items-center justify-center min-w-[26px] rounded-none bg-foreground px-1.5 py-0.5 font-['Roboto_Condensed'] text-[13px] font-black text-background tabular-nums",
    timeslotHeader: "bg-foreground text-background flex items-center gap-2 px-3 py-2",
    timeslotBadge: "inline-flex items-center rounded-none font-['Roboto_Condensed'] text-[19px] font-black text-background tabular-nums tracking-[0.02em]",
    timeslotHeaderMeta: "font-['Roboto_Condensed'] text-[11px] font-bold uppercase tracking-[0.14em] text-background/70",
    dateHeader: "rounded-none bg-primary text-primary-foreground px-3 py-1.5 font-['Roboto_Condensed'] text-[15px] font-black uppercase tracking-[0.1em]",
    phaseTab: "px-3 py-1.5 rounded-none font-['Roboto_Condensed'] text-[12px] font-bold uppercase tracking-[0.1em] whitespace-nowrap transition-colors",
    phaseTabActive: "bg-primary text-primary-foreground border border-primary",
    phaseTabInactive: "bg-card border border-[hsl(var(--broadcast-border))] text-muted-foreground hover:text-foreground",
    subHeader: "px-3 py-2 flex items-center justify-between gap-2 bg-foreground",
    subHeaderTitle: "font-['Roboto_Condensed'] text-[13px] font-black uppercase tracking-[0.12em] text-background",
    subLabel: "inline-flex items-center px-2 py-0.5 font-['Roboto_Condensed'] text-[11px] font-bold uppercase tracking-[0.14em] text-background/70",
    coverOverlay: "lrosa-cover",
    logoFrame: "border border-foreground bg-[hsl(var(--broadcast-paper))]",
    bracketConnector: "lrosa-connector",
  },
// ── SOCCERTEC MASTERS ───
// ── OLD CLUBHOUSE ───
// ── STICKER ALBUM ───
// ── TELETEXT FOOTBALL ───
  teletext: {
    sectionDot: "hidden",
    sectionTitle: "ttx-section-title ttx-bar-blue px-2 font-['VT323'] text-[26px] leading-[1.15] uppercase tracking-[0.06em]",
    sectionMeta: "ttx-section-meta font-['VT323'] text-[12px] uppercase tracking-[0.12em]",
    sectionLine: "ttx-section-line ttx-bar-blue flex-1 self-stretch",
    card: "ttx-panel overflow-hidden",
    matchCardWrapper: "ttx-panel overflow-hidden",
    cardHeader: "ttx-bar-cyan px-3 py-1 flex items-center gap-2",
    cardHeaderDot: "h-3 w-[8px] bg-black",
    cardHeaderTitle: "font-['VT323'] text-[18px] uppercase tracking-[0.08em]",
    homeCardHeader: "ttx-bar-cyan px-3 py-1 flex items-center gap-2",
    homeCardHeaderTitle: "font-['VT323'] text-[19px] uppercase tracking-[0.08em]",
    tabContainer: "flex gap-[2px] p-0 bg-[hsl(var(--broadcast-surface-secondary))]",
    tabActive: "flex-1 px-3 py-2 ttx-bar-yellow font-['VT323'] text-[18px] uppercase tracking-[0.08em]",
    tabInactive: "flex-1 px-3 py-2 bg-[hsl(var(--broadcast-surface))] font-['VT323'] text-[18px] uppercase tracking-[0.08em] text-[hsl(var(--broadcast-cyan))]",
    badge: "inline-flex items-center bg-[hsl(var(--broadcast-surface-secondary))] px-2 py-0.5 font-['VT323'] text-[17px] uppercase tracking-[0.06em] tabular-nums text-[hsl(var(--broadcast-cyan))]",
    label: "font-['VT323'] text-[12px] uppercase tracking-[0.16em] text-[hsl(var(--broadcast-cyan))]",
    backButton: "flex items-center gap-1 font-['VT323'] text-[18px] uppercase tracking-[0.08em] text-[hsl(var(--broadcast-cyan))]",
    matchContext: "flex items-center gap-2 px-3 py-1 bg-[hsl(var(--broadcast-surface-secondary))]",
    matchContextText: "font-['VT323'] text-[12px] uppercase tracking-[0.1em] text-[hsl(var(--broadcast-bright))]",
    matchLegBadge: "inline-flex items-center bg-[hsl(var(--broadcast-score)/0.15)] border border-[hsl(var(--broadcast-score)/0.35)] px-1.5 py-0 font-['VT323'] text-[10px] uppercase text-[hsl(var(--broadcast-score))]",
    matchTeamRow: "px-3 py-2",
    matchTeamRowWin: "bg-[hsl(var(--broadcast-success)/0.10)]",
    bracketQualBar: "bg-[hsl(var(--broadcast-success))]",
    matchTeamName: "font-['VT323'] text-[15px] uppercase tracking-[0.04em] text-[hsl(var(--broadcast-cyan))] truncate",
    matchTeamNameFav: "text-[hsl(var(--broadcast-score))]",
    matchScore: "font-['VT323'] text-[30px] tabular-nums leading-none",
    matchScoreWin: "text-[hsl(var(--broadcast-score))]",
    matchScoreLose: "text-[hsl(var(--broadcast-score))]/70",
    matchTimeBadge: "inline-flex items-center px-2 py-0.5 font-['VT323'] text-[19px] tabular-nums text-[hsl(var(--broadcast-bright))]",
    matchFooter: "flex items-center justify-between px-3 py-1 border-t border-[hsl(var(--broadcast-border))]",
    navBar: "bg-[hsl(var(--broadcast-surface))] border-t-2 border-[hsl(var(--broadcast-cyan))]",
    navCenter: "bg-[hsl(var(--broadcast-surface-secondary))] border-[hsl(var(--broadcast-cyan))] text-[hsl(var(--broadcast-cyan))]",
    navCenterActive: "bg-[hsl(60_100%_50%)] border-[hsl(60_100%_50%)] text-black",
    navTab: "text-[hsl(var(--broadcast-cyan))] hover:text-foreground",
    navTabActive: "text-[hsl(var(--broadcast-score))]",
    navIndicator: "absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-[3px] bg-[hsl(var(--broadcast-score))]",
    tableHeader: "ttx-bar-blue font-['VT323'] text-[12px] uppercase tracking-[0.1em]",
    tableRowAlt: "bg-secondary/35",
    ptsBadge: "inline-flex items-center justify-center min-w-[24px] px-1 font-['VT323'] text-[21px] tabular-nums text-[hsl(var(--broadcast-score))]",
    timeslotHeader: "ttx-bar-cyan ttx-timeslot px-3 py-1 flex items-center justify-between gap-2",
    timeslotBadge: "font-['VT323'] text-[22px] tabular-nums tracking-[0.04em]",
    timeslotHeaderMeta: "font-['VT323'] text-[12px] uppercase tracking-[0.1em]",
    dateHeader: "ttx-bar-yellow px-3 py-1 font-['VT323'] text-[20px] uppercase tracking-[0.1em]",
    phaseTab: "px-3 py-1.5 font-['VT323'] text-[18px] uppercase tracking-[0.08em] whitespace-nowrap transition-colors",
    phaseTabActive: "ttx-bar-yellow",
    phaseTabInactive: "bg-[hsl(var(--broadcast-surface-secondary))] text-[hsl(var(--broadcast-cyan))]",
    subHeader: "px-3 py-1.5 flex items-center justify-between gap-2 ttx-bar-blue",
    subHeaderTitle: "font-['VT323'] text-[19px] uppercase tracking-[0.1em]",
    subLabel: "inline-flex items-center px-2 py-0.5 font-['VT323'] text-[12px] uppercase tracking-[0.1em]",
    coverOverlay: "ttx-cover",
    logoFrame: "border border-[hsl(var(--broadcast-cyan))] p-[3px]",
    bracketConnector: "ttx-connector",
  },
};




/** Nieuwe generatie broadcast styles (light + dark via semantische tokens). */
export const NEW_BROADCAST_STYLES: BroadcastStyle[] = ["copa_mundo_bc", "european_nights", "la_rosa", "teletext", "wc26", "retro_bw", "serie_a"];

/** Enkel deze 6 stijlen zijn kiesbaar in de UI. */
export const SELECTABLE_BROADCAST_STYLES: BroadcastStyle[] = ["copa_mundo_bc", "european_nights", "la_rosa", "teletext", "wc26", "retro_bw", "serie_a"];


export const BROADCAST_GENERATION: Record<BroadcastStyle, "broadcast" | "legacy"> = Object.fromEntries(
  (Object.keys(BROADCAST_STYLES) as BroadcastStyle[]).map((k) => [k, NEW_BROADCAST_STYLES.includes(k) ? "broadcast" : "legacy"])
) as Record<BroadcastStyle, "broadcast" | "legacy">;



export function ds(style: BroadcastStyle, token: string): string {
  return STYLES[style]?.[token] ?? "";
}

/** True als de stijl vierkante kaders gebruikt (geen border-radius). */
export function isSquareStyle(style: BroadcastStyle): boolean {
  const w = ds(style, "matchCardWrapper");
  return Boolean(w) && !/rounded-(?!none)/.test(w);
}

/** Standaard verschijning (light/dark) per broadcaststijl. Default = dark. */
export const STYLE_DEFAULT_APPEARANCE: Partial<Record<BroadcastStyle, "light" | "dark">> = {
  copa_mundo_bc: "dark",
  european_nights: "dark",
  teletext: "dark",
  retro_bw: "dark",
  la_rosa: "light",
  wc26: "light",
  serie_a: "light",
};

export function defaultAppearanceForStyle(style: BroadcastStyle): "light" | "dark" {
  return STYLE_DEFAULT_APPEARANCE[style] ?? "dark";
}

/** Zet elke (verwijderde/legacy) stijl om naar een geldige, kiesbare stijl. Fallback = Copa Mundo. */
export function normalizeBroadcastStyle(style: string | null | undefined): BroadcastStyle {
  return SELECTABLE_BROADCAST_STYLES.includes(style as BroadcastStyle)
    ? (style as BroadcastStyle)
    : "copa_mundo_bc";
}
