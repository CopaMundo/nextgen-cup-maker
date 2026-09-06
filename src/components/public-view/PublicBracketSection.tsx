import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { MapPin } from "lucide-react";
import WhistleIcon from "@/components/icons/WhistleIcon";
import CountryFlag from "@/components/CountryFlag";
import PublicMatchCard from "@/components/public-view/PublicMatchCard";
import { useIsMobile } from "@/hooks/use-mobile";
import { useBroadcastStyle } from "@/contexts/BroadcastStyleContext";
import { ds } from "@/lib/broadcastStyles";
import { firstRefereeName } from "@/lib/refereeConfig";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { getMatchSideDisplayName } from "@/lib/slotLabels";
import PublicMatchDetailDialog from "@/components/public-view/PublicMatchDetailDialog";
import { useScoringSystems } from "@/hooks/useScoringSystems";
import { getMatchFormatSuffix } from "@/lib/matchFormatLabel";
import { getMatchTeamPositions } from "@/lib/standingsCalculator";
import { displayFieldName } from "@/lib/fieldLocations";

interface BracketSectionProps {
  groups: any[];
  labelGroups?: any[];
  matches: any[];
  teams: any[];
  slots?: any[];
  tournament: any;
  phases?: any[];
  showAllOnly?: boolean;
  favoriteTeam?: string | null;
  scrollToGroupId?: string | null;
  formatName?: string;
  hideSectionDividers?: boolean;
  presentationCompact?: boolean;
  /**
   * Voor presentaties met zeer grote brackets (128 teams):
   * skip de eerste N rondes uit de visuele bracket-tree zodat alleen
   * de overzichtelijke latere rondes getoond worden. De gespeelde
   * resultaten van die rondes blijven in de matches-data zodat de
   * bracket logica (winnaar-doorstroming) intact blijft.
   */
  skipFirstRounds?: number;
  groupTeams?: any[];
  scoringSystems?: any[];
}

// --- Bracket structure detection (mirrors BracketView.tsx logic) ---

const parseReference = (label: string | null): { type: "Winnaar" | "Verliezer"; matchName: string } | null => {
  if (!label) return null;
  const parsed = label.match(/^(Winnaar|Verliezer)\s+(.+)$/);
  if (!parsed) return null;
  return { type: parsed[1] as "Winnaar" | "Verliezer", matchName: parsed[2] };
};

const hasBaseSlot = (label: string | null) => !!label && !/^(Winnaar|Verliezer)\s+/i.test(label);

const getSeedNumbersFromLabel = (label: string | null, matchesByName: Map<string, any>, visited = new Set<string>()): number[] => {
  if (!label) return [];
  const slotMatch = label.match(/^S(\d+)$/i);
  if (slotMatch) return [parseInt(slotMatch[1], 10)];
  const ref = parseReference(label);
  if (!ref) return [];
  const m = matchesByName.get(ref.matchName);
  if (!m || visited.has(m.id)) return [];
  const next = new Set(visited); next.add(m.id);
  return [
    ...getSeedNumbersFromLabel(m.home_slot_label, matchesByName, next),
    ...getSeedNumbersFromLabel(m.away_slot_label, matchesByName, next),
  ];
};

const sortMatchesByStructure = (items: any[], matchesByName: Map<string, any>) => {
  return [...items].sort((a, b) => {
    const roundDiff = (a.round_number ?? 999) - (b.round_number ?? 999);
    if (roundDiff !== 0) return roundDiff;
    const aSeeds = getSeedRange(a, matchesByName);
    const bSeeds = getSeedRange(b, matchesByName);
    if (aSeeds.min !== bSeeds.min) return aSeeds.min - bSeeds.min;
    if (aSeeds.max !== bSeeds.max) return aSeeds.max - bSeeds.max;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
};

const getSeedRange = (match: any, matchesByName: Map<string, any>) => {
  const seeds = [
    ...getSeedNumbersFromLabel(match.home_slot_label, matchesByName),
    ...getSeedNumbersFromLabel(match.away_slot_label, matchesByName),
  ].filter(Number.isFinite);
  if (seeds.length === 0) return { min: Number.MAX_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER };
  return { min: Math.min(...seeds), max: Math.max(...seeds) };
};

export const extractLoserPrefix = (round: any, bracketGroupMap?: Record<string, string>): string | null => {
  // Check stored mapping first (most reliable, survives renames)
  if (bracketGroupMap && bracketGroupMap[round.id]) return bracketGroupMap[round.id];
  // Old format: "Plaatsing X-Y: ..."
  const fromName = round.name?.match(/^Plaatsing\s+(\d+-\d+)/i);
  if (fromName) return fromName[1];
  // Match names have the bracket prefix (P-prefix or Finale prefix)
  for (const m of round.matches) {
    const fromMatch = m.match_name?.match(/(?:^P|Finale\s+)(\d+-\d+)/i);
    if (fromMatch) return fromMatch[1];
    for (const label of [m.home_slot_label, m.away_slot_label]) {
      const fromRef = label?.match(/(?:Winnaar|Verliezer)\s+(?:P(\d+-\d+)|Finale\s+(\d+-\d+))/i);
      if (fromRef) return fromRef[1] || fromRef[2];
    }
  }
  // New format group name: "RoundName: Plaats X-Y"
  const fromNewName = round.name?.match(/Plaats\s+(\d+-\d+)/i);
  if (fromNewName) {
    for (const m of round.matches) {
      for (const label of [m.home_slot_label, m.away_slot_label]) {
        const ref = label?.match(/(?:Winnaar|Verliezer)\s+P(\d+-\d+)/i);
        if (ref) return ref[1];
      }
    }
    return fromNewName[1];
  }
  return null;
};

export interface BracketStructure {
  mainRounds: any[];
  loserBrackets: Record<string, any[]>;
  sortedLoserKeys: string[];
  topLevelLoserKeys: string[];
  loserBracketChildren: Record<string, string[]>;
  placementRounds: any[];
  loserPlacementRounds: Record<string, any[]>;
}

export function detectBracketStructure(groups: any[], matches: any[], bracketGroupMap?: Record<string, string>, phaseMatchType?: string): BracketStructure {
  const getBaseMatchName = (name: string | null) => {
    if (!name) return "";
    return name.replace(/\s+\(Heen\)$/, "").replace(/\s+\(Terug\)$/, "");
  };

  const matchesByName = new Map<string, any>();
  for (const m of matches) {
    if (m.match_name && !matchesByName.has(m.match_name)) matchesByName.set(m.match_name, m);
    // Always register base name for downstream "Winnaar BaseName" references
    // (works for both phase-level H&A and per-match H&A)
    if (m.match_name && /\s+\((Heen|Terug)\)$/.test(m.match_name)) {
      const base = getBaseMatchName(m.match_name);
      if (base && !matchesByName.has(base)) matchesByName.set(base, m);
    }
  }

  const allRounds = groups.map(g => {
    let gm = sortMatchesByStructure(matches.filter((m: any) => m.group_id === g.id), matchesByName);
    // Always filter out "(Terug)" matches — they're shown inline in the Heen card
    // regardless of whether H&A is set at phase or per-match level
    gm = gm.filter((m: any) => !m.match_name?.endsWith("(Terug)"));
    const minRound = gm.length > 0 ? Math.min(...gm.map((m: any) => m.round_number ?? 999)) : 999;
    return { ...g, matches: gm, minRound };
  });

  const visibleGroupIds = new Set(groups.map((g: any) => g.id));

  // Build edges
  const winnerEdges = new Map<string, Set<string>>();
  const loserSourceGroupsByRound = new Map<string, Set<string>>();

  for (const round of allRounds) {
    for (const match of round.matches) {
      for (const label of [match.home_slot_label, match.away_slot_label]) {
        const ref = parseReference(label);
        if (!ref) continue;
        const src = matchesByName.get(ref.matchName);
        if (!src?.group_id || !visibleGroupIds.has(src.group_id) || src.group_id === round.id) continue;
        if (ref.type === "Winnaar") {
          if (!winnerEdges.has(src.group_id)) winnerEdges.set(src.group_id, new Set());
          winnerEdges.get(src.group_id)!.add(round.id);
        } else {
          if (!loserSourceGroupsByRound.has(round.id)) loserSourceGroupsByRound.set(round.id, new Set());
          loserSourceGroupsByRound.get(round.id)!.add(src.group_id);
        }
      }
    }
  }

  // Detect main bracket
  const seedGroupIds = new Set(
    allRounds.filter(r => r.matches.some((m: any) => hasBaseSlot(m.home_slot_label) || hasBaseSlot(m.away_slot_label))).map(r => r.id)
  );
  if (seedGroupIds.size === 0 && allRounds.length > 0) seedGroupIds.add(allRounds[0].id);

  const mainGroupIds = new Set(seedGroupIds);
  const queue = [...seedGroupIds];
  while (queue.length > 0) {
    const gid = queue.shift()!;
    const next = winnerEdges.get(gid);
    if (!next) continue;
    for (const nid of next) { if (!mainGroupIds.has(nid)) { mainGroupIds.add(nid); queue.push(nid); } }
  }

  const mainRounds = allRounds.filter(r => mainGroupIds.has(r.id)).sort((a, b) => a.minRound - b.minRound);

  // Placement detection - associate with correct bracket
  const isPlacementRound = (round: any) => {
    if (round.matches.length !== 1) return false;
    const sg = loserSourceGroupsByRound.get(round.id);
    if (!sg || sg.size !== 1) return false;
    const [sgId] = Array.from(sg);
    const sr = allRounds.find(r => r.id === sgId);
    return !!sr && sr.matches.length === 2;
  };

  const getPlacementSource = (round: any): string | null => {
    const sg = loserSourceGroupsByRound.get(round.id);
    if (!sg || sg.size !== 1) return null;
    return Array.from(sg)[0];
  };

  const placementRounds: any[] = [];
  const loserPlacementRounds: Record<string, any[]> = {};
  const loserBrackets: Record<string, any[]> = {};

  for (const round of allRounds) {
    if (mainGroupIds.has(round.id)) continue;
    if (isPlacementRound(round)) {
      // Determine which bracket this placement belongs to
      const sourceGroupId = getPlacementSource(round);
      if (sourceGroupId && mainGroupIds.has(sourceGroupId)) {
        placementRounds.push(round);
      } else {
        // Find which loser bracket the source belongs to
        let assigned = false;
        // First collect all non-placement loser bracket rounds
         const prefix = extractLoserPrefix(round, bracketGroupMap);
        if (prefix) {
          if (!loserBrackets[prefix]) loserBrackets[prefix] = [];
          loserBrackets[prefix].push(round);
          assigned = true;
        }
        if (!assigned) {
          // Check if source group is in a loser bracket
          for (const [key, rounds] of Object.entries(loserBrackets)) {
            if (rounds.some(r => r.id === sourceGroupId)) {
              if (!loserPlacementRounds[key]) loserPlacementRounds[key] = [];
              loserPlacementRounds[key].push(round);
              assigned = true;
              break;
            }
          }
          if (!assigned) placementRounds.push(round);
        }
      }
      continue;
    }
    const prefix = extractLoserPrefix(round, bracketGroupMap);
    if (!prefix) { placementRounds.push(round); continue; }
    if (!loserBrackets[prefix]) loserBrackets[prefix] = [];
    loserBrackets[prefix].push(round);
  }

  // Second pass: associate placement rounds with loser brackets by checking source group
  for (const round of allRounds) {
    if (mainGroupIds.has(round.id)) continue;
    if (!isPlacementRound(round)) continue;
    const sourceGroupId = getPlacementSource(round);
    if (!sourceGroupId || mainGroupIds.has(sourceGroupId)) continue;
    // Already handled above via prefix check, but check if it was missed
    const alreadyAssigned = Object.values(loserBrackets).flat().some(r => r.id === round.id)
      || Object.values(loserPlacementRounds).flat().some(r => r.id === round.id)
      || placementRounds.some(r => r.id === round.id);
    if (alreadyAssigned) continue;
    for (const [key, rounds] of Object.entries(loserBrackets)) {
      if (rounds.some(r => r.id === sourceGroupId)) {
        if (!loserPlacementRounds[key]) loserPlacementRounds[key] = [];
        loserPlacementRounds[key].push(round);
        break;
      }
    }
  }

  for (const key of Object.keys(loserBrackets)) loserBrackets[key].sort((a, b) => a.minRound - b.minRound);

  const sortedLoserKeys = Object.keys(loserBrackets).sort((a, b) => parseInt(a) - parseInt(b));

  // Parent-child detection
  const getParent = (prefix: string): string | null => {
    const br = loserBrackets[prefix];
    if (!br?.length) return null;
    for (const match of br[0].matches) {
      for (const label of [match.home_slot_label, match.away_slot_label]) {
        const ref = parseReference(label);
        if (ref?.type === "Verliezer") {
          const src = matchesByName.get(ref.matchName);
          if (src) {
            for (const [op, or] of Object.entries(loserBrackets)) {
              if (op === prefix) continue;
              if ((or as any[]).some((r: any) => r.matches.some((m: any) => m.id === src.id))) return op;
            }
          }
        }
      }
    }
    return null;
  };

  const parents: Record<string, string | null> = {};
  for (const p of sortedLoserKeys) parents[p] = getParent(p);
  const topLevelLoserKeys = sortedLoserKeys.filter(k => !parents[k]);
  const loserBracketChildren: Record<string, string[]> = {};
  for (const p of sortedLoserKeys) {
    const parent = parents[p];
    if (parent) {
      if (!loserBracketChildren[parent]) loserBracketChildren[parent] = [];
      loserBracketChildren[parent].push(p);
    }
  }

  return { mainRounds, loserBrackets, sortedLoserKeys, topLevelLoserKeys, loserBracketChildren, placementRounds, loserPlacementRounds };
}

// --- Tab structure ---

interface BracketTab {
  id: string;
  label: string;
  rounds: any[];
  children?: BracketTab[];
}

// Helper: insert placement rounds before the last round (finale is always last)
const insertPlacementBeforeFinale = (mainRounds: any[], placementRounds: any[]): any[] => {
  if (placementRounds.length === 0 || mainRounds.length === 0) return [...mainRounds];
  return [...mainRounds.slice(0, -1), ...placementRounds, mainRounds[mainRounds.length - 1]];
};

function buildTabs(structure: BracketStructure): BracketTab[] {
  const tabs: BracketTab[] = [];

  if (structure.mainRounds.length > 0) {
    tabs.push({ id: "main", label: "Hoofdbracket", rounds: insertPlacementBeforeFinale(structure.mainRounds, structure.placementRounds) });
  }

  const buildChildTabs = (prefix: string): BracketTab => {
    const children = (structure.loserBracketChildren[prefix] || []).map(buildChildTabs);
    const placementForBracket = structure.loserPlacementRounds[prefix] || [];
    const bracketRounds = structure.loserBrackets[prefix] || [];
    return {
      id: `bracket-${prefix}`,
      label: `Bracket ${prefix}`,
      rounds: insertPlacementBeforeFinale(bracketRounds, placementForBracket),
      children,
    };
  };

  for (const key of structure.topLevelLoserKeys) {
    tabs.push(buildChildTabs(key));
  }

  return tabs;
}

// --- Components ---

const teamName = (teams: any[], id: string | null) => teams.find((t: any) => t.id === id)?.name || "–";
const teamLogo = (teams: any[], id: string | null) => teams.find((t: any) => t.id === id)?.logo_url;

// Bracket VISUAL with SVG lines
const BracketTree = ({ bracketRounds, teams, slots = [], tournament, phases, groups, labelGroups, favoriteTeam, allMatches, phaseMatchType, presentationCompact = false, skipFirstRounds = 0 }: { bracketRounds: any[]; teams: any[]; slots?: any[]; tournament: any; phases?: any[]; groups?: any[]; labelGroups?: any[]; favoriteTeam?: string | null; allMatches?: any[]; phaseMatchType?: string; presentationCompact?: boolean; skipFirstRounds?: number }) => {
  const { systems: scoringSystems } = useScoringSystems(tournament?.id);
  const phaseIsHA = phaseMatchType === "home_away";
  const getBaseMatchName = (name: string | null) => {
    if (!name) return "";
    return name.replace(/\s+\(Heen\)$/, "").replace(/\s+\(Terug\)$/, "");
  };
  // Per-match H&A detection (works even when phase is single_leg but match has Heen/Terug pair)
  const isMatchHA = (match: any): boolean => {
    if (!match?.match_name) return false;
    if (phaseIsHA) return true;
    return /\s+\((Heen|Terug)\)$/.test(match.match_name);
  };
  const findPairedMatch = (match: any): any | null => {
    if (!match?.match_name || !allMatches) return null;
    if (!isMatchHA(match)) return null;
    const base = getBaseMatchName(match.match_name);
    const isHeen = match.match_name.endsWith("(Heen)");
    const targetName = isHeen ? `${base} (Terug)` : `${base} (Heen)`;
    return allMatches.find((m: any) => m.match_name === targetName && m.group_id === match.group_id) || null;
  };
  const [selectedHAMatch, setSelectedHAMatch] = useState<any>(null);
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeRound, setActiveRound] = useState(0);
  const isMobile = useIsMobile();
  const bStyle = useBroadcastStyle();
  const rafId = useRef<number>(0);

  const PEEK_W = 60;
  const EDGE_PAD = 20;
  const compactTree = presentationCompact && !isMobile;
  // Compact (slideshow) cards have generous broadcast-style sizing — the BracketAutoFit
  // wrapper scales the entire tree down to fit the viewport.
  // Base sizes scale with the number of rounds in this bracket: fewer rounds = larger,
  // more spacious cards (since there is more room per match). All cards within ONE bracket
  // share the same size — only the base scale differs between brackets.
  const effectiveRoundCount = Math.max(1, bracketRounds.length - Math.max(0, skipFirstRounds));
  const bracketRoundCount = effectiveRoundCount;
  // Map rounds → scale: 6+ rounds (R32+) → 1.0, 5 (R16+) → 1.25, 4 (QF+) → 1.55, ≤3 (SF/F) → 1.85
  const compactBracketScale = bracketRoundCount >= 6 ? 1.0
    : bracketRoundCount === 5 ? 1.25
    : bracketRoundCount === 4 ? 1.55
    : 1.85;
  const COMPACT_BASE_W = Math.round(200 * compactBracketScale);
  const COMPACT_BASE_H = Math.round(64 * compactBracketScale);
  const CARD_W = isMobile ? Math.min(288, typeof window !== "undefined" ? window.innerWidth - EDGE_PAD - PEEK_W - 8 : 268) : compactTree ? COMPACT_BASE_W : 268;
  const CONNECTOR_W = isMobile ? 0 : compactTree ? Math.round(28 * Math.min(compactBracketScale, 1.4)) : 32;
  const CARD_H = isMobile ? 120 : compactTree ? COMPACT_BASE_H : 120;

  const GAP = isMobile ? 12 : CONNECTOR_W;
  const HEADER_H = isMobile ? 28 : compactTree ? Math.round(26 * Math.min(compactBracketScale, 1.3)) : 36;
  // Column = card + some gap, so the next column's cards are visible as peek
  const MOBILE_COL_W = CARD_W + 24;
  const DESKTOP_COL_W = CARD_W + CONNECTOR_W;
  const COMPACT_SPACING = GAP + CARD_H;
  const TOP_OFFSET = compactTree ? 4 : 16;

  const isLoserRef = (label: string | null) => (label ?? "").startsWith("Verliezer ");

  // Detect placement rounds
  const placementRoundIndices = new Set<number>();
  const placementMatches: any[] = [];
  
  for (let i = 0; i < bracketRounds.length; i++) {
    const round = bracketRounds[i];
    if (round.matches.length === 1) {
      const m = round.matches[0];
      if (isLoserRef(m.home_slot_label) || isLoserRef(m.away_slot_label)) {
        placementRoundIndices.add(i);
        placementMatches.push({ ...m, roundName: round.name });
      }
    }
  }

  const lastRound = bracketRounds[bracketRounds.length - 1];
  if (lastRound && lastRound.matches.length === 2 && !placementRoundIndices.has(bracketRounds.length - 1)) {
    const loserMatch = lastRound.matches.find((m: any) => isLoserRef(m.home_slot_label) || isLoserRef(m.away_slot_label));
    const winnerMatch = lastRound.matches.find((m: any) => !isLoserRef(m.home_slot_label) && !isLoserRef(m.away_slot_label));
    if (loserMatch && winnerMatch && loserMatch.id !== winnerMatch.id) {
      placementMatches.push({ ...loserMatch, roundName: loserMatch.match_name || "Plaatsingswedstrijd" });
      bracketRounds = bracketRounds.map((r, idx) => idx === bracketRounds.length - 1 ? { ...r, matches: [winnerMatch] } : r);
    }
  }

  let displayRounds = bracketRounds.filter((_, idx) => !placementRoundIndices.has(idx));
  if (skipFirstRounds > 0 && displayRounds.length > skipFirstRounds) {
    displayRounds = displayRounds.slice(skipFirstRounds);
  }
  const firstRoundCount = displayRounds.length > 0 ? displayRounds[0].matches.length : 1;
  const totalHeight = firstRoundCount * CARD_H + (firstRoundCount - 1) * GAP;

  // Precompute treeY and compactY per round
  const matchPositions = useMemo(() => {
    const positions: { roundIdx: number; matchIdx: number; treeY: number; compactY: number; matchId: string }[] = [];
    const roundTotalH = firstRoundCount * CARD_H + (firstRoundCount - 1) * GAP;

    for (let roundIdx = 0; roundIdx < displayRounds.length; roundIdx++) {
      const round = displayRounds[roundIdx];
      const matchCount = round.matches.length;
      const slotH = roundTotalH / matchCount;

      for (let matchIdx = 0; matchIdx < round.matches.length; matchIdx++) {
        const isFirst = roundIdx === 0;
        const treeY = isFirst
          ? matchIdx * (CARD_H + GAP)
          : slotH * matchIdx + (slotH - CARD_H) / 2;
        const compactY = TOP_OFFSET + matchIdx * COMPACT_SPACING;
        positions.push({ roundIdx, matchIdx, treeY, compactY, matchId: round.matches[matchIdx].id });
      }
    }
    return positions;
  }, [displayRounds, firstRoundCount, CARD_H, GAP, COMPACT_SPACING, TOP_OFFSET]);

  // Tree positions by round (for connectors)
  const roundTreePositions = useMemo(() => {
    const byRound: { top: number; centerY: number }[][] = [];
    for (let i = 0; i < displayRounds.length; i++) {
      byRound.push(
        matchPositions
          .filter(p => p.roundIdx === i)
          .map(p => ({ top: p.treeY, centerY: p.treeY + CARD_H / 2 }))
      );
    }
    return byRound;
  }, [matchPositions, displayRounds.length, CARD_H]);

  // Container height - dynamic based on active round
  const activeMatchCount = displayRounds[activeRound]?.matches.length ?? firstRoundCount;
  const activeCompactH = TOP_OFFSET + activeMatchCount * COMPACT_SPACING + 16;
  // Only add placement height when we're on the last round (where placement matches live)
  const isLastRoundActive = activeRound === displayRounds.length - 1;
  const placementExtraH = (placementMatches.length > 0 && isLastRoundActive) ? (CARD_H + GAP + 20) * placementMatches.length : 0;
  const mobileTotalH = activeCompactH + placementExtraH;

  // Track scroll progress per round for opacity/position transitions
  const [roundProgress, setRoundProgress] = useState<number[]>(displayRounds.map(() => 0));

  const detectActiveRound = useCallback(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    const viewportCenter = el.scrollLeft + el.clientWidth / 2;
    let closestIdx = 0;
    let closestDist = Infinity;
    const colWidth = isMobile ? MOBILE_COL_W : DESKTOP_COL_W;

    // Calculate per-round progress: 0 = centered, 1 = fully scrolled away
    const newProgress = displayRounds.map((_, i) => {
      const colCenter = i * colWidth + colWidth / 2;
      const dist = Math.abs(colCenter - viewportCenter);
      if (dist < closestDist) { closestDist = dist; closestIdx = i; }
      return Math.min(1, dist / colWidth);
    });

    setActiveRound(closestIdx);
    if (isMobile) setRoundProgress(newProgress);
  }, [isMobile, MOBILE_COL_W, DESKTOP_COL_W, displayRounds.length]);

  const handleScroll = useCallback(() => {
    cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(detectActiveRound);
  }, [detectActiveRound]);

  // Initialize active round on mount
  useEffect(() => {
    if (scrollRef.current) {
      let targetRoundIdx = -1;

      if (favoriteTeam) {
        // Scroll to the round with fav team's first unplayed match
        for (let i = 0; i < displayRounds.length; i++) {
          const hasUnplayed = displayRounds[i].matches.some((m: any) =>
            !m.is_played && (m.home_team_id === favoriteTeam || m.away_team_id === favoriteTeam)
          );
          if (hasUnplayed) { targetRoundIdx = i; break; }
        }
        // Fallback: last round where fav team has a played match
        if (targetRoundIdx === -1) {
          for (let i = displayRounds.length - 1; i >= 0; i--) {
            const hasMatch = displayRounds[i].matches.some((m: any) =>
              m.home_team_id === favoriteTeam || m.away_team_id === favoriteTeam
            );
            if (hasMatch) { targetRoundIdx = i; break; }
          }
        }
      } else {
        // No favorite team: scroll to first round with any unplayed match (current active round)
        for (let i = 0; i < displayRounds.length; i++) {
          const hasUnplayed = displayRounds[i].matches.some((m: any) => !m.is_played);
          if (hasUnplayed) { targetRoundIdx = i; break; }
        }
        // If all played, stay at last round
        if (targetRoundIdx === -1 && displayRounds.length > 0) {
          targetRoundIdx = displayRounds.length - 1;
        }
      }

      if (targetRoundIdx > 0) {
        const colWidth = isMobile ? MOBILE_COL_W : DESKTOP_COL_W;
        scrollRef.current.scrollLeft = targetRoundIdx * colWidth;
      }
    }
    requestAnimationFrame(() => detectActiveRound());
    return () => cancelAnimationFrame(rafId.current);
  }, [detectActiveRound, favoriteTeam]);

  const getSlotLabel = (match: any, side: "home" | "away") => {
    return getMatchSideDisplayName(match, side, teams, { slots, phases, groups: labelGroups || groups, emptyLabel: "TBD" });
  };

  const renderMatchCard = (match: any, compact?: boolean, _logoOnly?: boolean, sizeOverride?: { w: number; h: number; scale: number }) => {
    const cardW = sizeOverride?.w ?? CARD_W;
    const cardH = sizeOverride?.h ?? CARD_H;
    // Font scale: in compact (slideshow) mode the bracket-level scale dictates sizing
    // so all cards in one bracket share identical typography.
    const scale = sizeOverride?.scale ?? (compactTree ? compactBracketScale : 1);
    const fsName = Math.round(11 * scale);
    const fsScore = Math.round(18 * scale);
    const logoSize = Math.round(16 * scale);
    const flagW = Math.round(16 * scale);
    const flagH = Math.round(12 * scale);
    // H&A: detect per-match (works also when phase is single_leg but match has Heen/Terug pair)
    const matchIsHA = isMatchHA(match);
    const pairedMatch = matchIsHA ? findPairedMatch(match) : null;
    const isHeen = match.match_name?.endsWith("(Heen)");
    const heenMatch = isHeen || !pairedMatch ? match : pairedMatch;
    const terugMatch = isHeen ? pairedMatch : (pairedMatch ? match : null);

    // H&A total
    const haTotal = matchIsHA && pairedMatch && heenMatch && terugMatch ? (() => {
      const homeTotal = (heenMatch.home_score ?? 0) + (terugMatch.away_score ?? 0);
      const awayTotal = (heenMatch.away_score ?? 0) + (terugMatch.home_score ?? 0);
      const bothPlayed = heenMatch.is_played && terugMatch.is_played;
      const anyScored = heenMatch.home_score !== null || terugMatch.home_score !== null;
      const isTied = homeTotal === awayTotal && bothPlayed;
      // Penalties: stored on the Terug (last) match, in Terug orientation
      const homePen = terugMatch.away_penalties ?? 0;
      const awayPen = terugMatch.home_penalties ?? 0;
      const hasPenalties = isTied && homePen !== awayPen;
      // Display total: show actual total (no +1), penalties shown separately
      return { homeTotal, awayTotal, bothPlayed, anyScored, isTied, hasPenalties, homePen, awayPen, heenMatch, terugMatch };
    })() : null;

    const homeWon = haTotal
      ? haTotal.bothPlayed && (haTotal.homeTotal > haTotal.awayTotal || (haTotal.isTied && haTotal.homePen > haTotal.awayPen))
      : match.is_played && ((match.home_score ?? 0) > (match.away_score ?? 0) || ((match.home_score ?? 0) === (match.away_score ?? 0) && (match.home_penalties ?? 0) > (match.away_penalties ?? 0)));
    const awayWon = haTotal
      ? haTotal.bothPlayed && (haTotal.awayTotal > haTotal.homeTotal || (haTotal.isTied && haTotal.awayPen > haTotal.homePen))
      : match.is_played && !homeWon;

    const phase = phases?.find((p: any) => p.id === match.phase_id);
    const group = groups?.find((g: any) => g.id === match.group_id);
    const baseDisplayName = matchIsHA ? getBaseMatchName(match.match_name) : match.match_name;
    const displayNameSuffix = matchIsHA
      ? ""
      : getMatchFormatSuffix(
          match,
          scoringSystems as any,
          (phases ?? []) as any,
          (groups ?? []) as any
        );
    const displayName = baseDisplayName ? `${baseDisplayName}${displayNameSuffix}` : baseDisplayName;

    const renderSide = (side: "home" | "away") => {
      const tid = side === "home" ? match.home_team_id : match.away_team_id;
      const won = side === "home" ? homeWon : awayWon;
      const logo = teamLogo(teams, tid);
      const name = getSlotLabel(match, side);
      const country = tid ? teams.find((t: any) => t.id === tid)?.country : null;
      const tightSide = compact || compactTree;
      const isCompactPretty = compactTree && !compact;
      const winRowClass = won ? ds(bStyle, "matchTeamRowWin") : "";
      const winRowHasEdgeMarker = /\bborder-l(?:-|$)|\bborder-l-\[/.test(winRowClass);

      // H&A: show only total score (no +1)
      const displayScore = matchIsHA && haTotal && haTotal.anyScored
        ? (side === "home" ? haTotal.homeTotal : haTotal.awayTotal)
        : (side === "home" ? match.home_score : match.away_score);

      const isPlayedish = match.is_played
        || (match.home_score != null && match.away_score != null)
        || (matchIsHA && haTotal?.anyScored);


      return (
        <div
          className={`relative flex items-center ${isCompactPretty ? "gap-1.5 pl-2 pr-0 py-0" : tightSide ? "gap-0.5 pl-1 pr-0 py-0" : "gap-2 pl-2.5 pr-0 h-[34px]"} ${winRowClass}`}
          style={tightSide ? { height: cardH / 2 } : undefined}
        >
          {won && !winRowHasEdgeMarker && (
            <span
              aria-hidden
              className={`absolute left-0 top-0 bottom-0 ${ds(bStyle, "bracketQualBar") || "bg-primary"}`}
              style={{ width: tightSide ? 2 : 3 }}
            />
          )}
          {logo && <img src={logo} className={`${tightSide ? "" : "h-6 w-6"} object-contain flex-shrink-0`} alt="" style={isCompactPretty ? { height: logoSize, width: logoSize } : tightSide && !isCompactPretty ? { height: 10, width: 10 } : undefined} />}
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <span
              className={`truncate leading-none ${tid ? ds(bStyle, "matchTeamName") : "text-[10px] text-muted-foreground"} ${won ? "font-bold" : ""}`}
              style={isCompactPretty ? { fontSize: fsName, lineHeight: `${fsName + 3}px` } : tightSide ? { fontSize: 7, lineHeight: "12px" } : undefined}
            >{name}</span>
            {tournament?.show_country && country && (!compactTree || isCompactPretty) && (
              <span className="inline-flex items-center justify-center flex-shrink-0" style={isCompactPretty ? { height: flagH, width: flagW } : tightSide ? { height: 10, width: 14 } : { height: 12, width: 16 }}>
                <CountryFlag country={country} className="w-full h-full object-contain" />
              </span>
            )}
          </div>
          {isPlayedish && !hideScores && (() => {
            const penValue = matchIsHA
              ? (haTotal?.hasPenalties ? (side === "home" ? haTotal.homePen : haTotal.awayPen) : null)
              : (match.home_penalties !== null && match.away_penalties !== null ? (side === "home" ? match.home_penalties : match.away_penalties) : null);
            const scoreW = tightSide ? 12 : isCompactPretty ? Math.max(14, (fsScore ?? 15)) : 18;
            const hasPen = penValue !== null && penValue !== undefined;
            // Keep the complete score block near the card edge while reserving
            // enough room for a two-digit shoot-out score such as “(10)”.
            const penSlot = tightSide ? 14 : 20;
            return (
              <div className="flex items-center shrink-0 ml-1.5">
                <span
                  className={`tabular-nums text-right leading-none ${won ? "font-bold " + ds(bStyle, "matchScoreWin") : ds(bStyle, "matchScoreLose")} ${isCompactPretty ? "font-semibold" : tightSide ? "" : "text-[18px]"}`}
                  style={{
                    minWidth: scoreW,
                    ...(isCompactPretty ? { fontSize: fsScore, lineHeight: 1 } : tightSide ? { fontSize: 11, lineHeight: 1 } : {}),
                  }}
                >{displayScore ?? "–"}</span>
                {/* Fixed-width penalty slot: always reserved so the main score never shifts */}
                <span
                  className="text-left text-[9px] text-muted-foreground font-medium leading-none whitespace-nowrap tabular-nums ml-0.5 shrink-0"
                  style={{ width: penSlot }}
                >{hasPen ? `(${penValue})` : ""}</span>
              </div>
            );

          })()}

        </div>
      );

    };

    // For H&A: show field/ref/time of the *active* (next unplayed) leg.
    // - Both unplayed → Heen
    // - Heen played, Terug unplayed → Terug
    // - Both played → none
    const activeLegMatch = matchIsHA && pairedMatch && heenMatch
      ? (heenMatch.is_played && terugMatch && !terugMatch.is_played ? terugMatch
        : (!heenMatch.is_played ? heenMatch : null))
      : match;
    const displayField = activeLegMatch?.field ? displayFieldName(activeLegMatch.field) : null;
    const displayReferee = firstRefereeName(activeLegMatch?.referee) || null;
    const displayTimeStr = activeLegMatch?.match_time?.substring(0, 5);
    const showInlineTime = matchIsHA && pairedMatch
      ? (!!activeLegMatch && !activeLegMatch.is_played && !!displayTimeStr)
      : (!match.is_played && !!displayTimeStr);
    const showOverlayTime = showInlineTime;

    // Bij H&A: als de heenwedstrijd gespeeld is en we tonen de tijd van de
    // terugwedstrijd, dan tonen we het resultaat van de heenwedstrijd eronder.
    const heenLegScoreLabel =
      matchIsHA && pairedMatch && heenMatch?.is_played && activeLegMatch === terugMatch &&
      heenMatch.home_score != null && heenMatch.away_score != null
        ? `HEEN ${heenMatch.home_score}-${heenMatch.away_score}`
        : null;

    // Bij een nog niet gespeelde terugwedstrijd tonen we geen totaalscore
    // naast de ploegen; enkel de heenscore-badge onder het tijdsbalkje.
    const hideScores = matchIsHA && pairedMatch && activeLegMatch === terugMatch && !terugMatch?.is_played;


    // Every chip is clickable — H&A opens aggregate dialog, others open match detail dialog
    const isHAClick = matchIsHA && !!pairedMatch;
    const isClickable = true;
    const handleClick = () => {
      if (isHAClick) {
        setSelectedHAMatch({ match, haTotal, heenMatch, terugMatch });
      } else {
        setSelectedMatch(match);
      }
    };

    const tight = (compact && !isMobile) || compactTree;
    const card = (
      <div
        className={`${ds(bStyle, "card")} ${tight ? "" : "w-[268px]"} ${isClickable ? "cursor-pointer hover:ring-1 hover:ring-primary/30 transition-shadow" : ""}`}
        style={{ overflow: "hidden", width: tight ? cardW : undefined, height: tight ? cardH : undefined, boxSizing: "border-box" }}
        onClick={isClickable ? handleClick : undefined}
      >
        <div className={`ttx-match-context ${ds(bStyle, "matchContext")}`} style={compactTree ? { display: "none" } : undefined}>
          <div className="flex items-center gap-1.5">
          {phase?.logo_url && (
            <img
              src={phase.logo_url}
              alt=""
              className={`${tight ? "h-3 w-3" : "h-4 w-4"} object-contain flex-shrink-0`}
            />
          )}
          <div className={`min-w-0 flex-1 grid grid-cols-[1fr_auto] items-center gap-x-3 ${tight ? "gap-y-0" : "gap-y-0.5"} leading-none ${tight ? "" : "py-0.5 min-h-[22px]"}`}>
            {phase?.name ? (
              displayName && !compactTree ? (
                <>
                  <div className={`truncate ${ds(bStyle, "matchContextText")} ${tight ? "!text-[6px] !leading-none" : ""}`}>
                    {phase.name}
                  </div>
                  {displayField ? (
                    <div className={`font-bold text-muted-foreground inline-flex items-center gap-0.5 justify-end leading-none ${tight ? "text-[7px]" : "text-[9px]"}`}>
                      <MapPin className="h-2 w-2 flex-shrink-0" /> <span className="leading-none truncate max-w-[110px]" title={displayField || undefined}>{displayField}</span>
                    </div>
                  ) : <div />}
                  <div className={`flex min-w-0 items-center gap-1.5 ${tight ? "text-[7px]" : "text-[9px]"}`}>
                    <span className="truncate text-muted-foreground/70">{displayName}</span>
                    {matchIsHA && <span className={`shrink-0 ${ds(bStyle, "matchLegBadge")}`}>2 wedstrijden</span>}
                  </div>
                  {displayReferee ? (
                    <div className={`text-muted-foreground/70 inline-flex items-center gap-0.5 justify-end leading-none ${tight ? "text-[7px]" : "text-[9px]"}`}>
                      <WhistleIcon className="h-2 w-2 flex-shrink-0" /> <span className="leading-none truncate max-w-[110px]" title={activeLegMatch?.referee || undefined}>{displayReferee}</span>
                    </div>
                  ) : <div />}
                </>
              ) : (
                <>
                  <div className={`truncate ${ds(bStyle, "matchContextText")} ${tight ? "!text-[6px] !leading-none" : ""}`}>
                    {phase.name}
                  </div>
                  {displayField ? (
                    <div className={`font-bold text-muted-foreground inline-flex items-center gap-0.5 justify-end leading-none ${tight ? "text-[7px]" : "text-[9px]"}`}>
                      <MapPin className="h-2 w-2 flex-shrink-0" /> <span className="leading-none truncate max-w-[110px]" title={displayField || undefined}>{displayField}</span>
                    </div>
                  ) : displayReferee ? (
                    <div className={`text-muted-foreground/70 inline-flex items-center gap-0.5 justify-end leading-none ${tight ? "text-[7px]" : "text-[9px]"}`}>
                      <WhistleIcon className="h-2 w-2 flex-shrink-0" /> <span className="leading-none truncate max-w-[110px]" title={activeLegMatch?.referee || undefined}>{displayReferee}</span>
                    </div>
                  ) : <div />}
                  {displayField && displayReferee && (
                    <>
                      <div />
                      <div className={`text-muted-foreground/70 inline-flex items-center gap-0.5 justify-end leading-none ${tight ? "text-[7px]" : "text-[9px]"}`}>
                        <WhistleIcon className="h-2 w-2 flex-shrink-0" /> <span className="leading-none truncate max-w-[110px]" title={activeLegMatch?.referee || undefined}>{displayReferee}</span>
                      </div>
                    </>
                  )}
                </>
              )
            ) : (
              <>
                <div className={`flex min-w-0 items-center gap-1.5 ${ds(bStyle, "matchContextText")} ${tight ? "!text-[6px] !leading-none" : ""}`}>
                  <span className="truncate">{displayName}</span>
                  {matchIsHA && <span className={`shrink-0 ${ds(bStyle, "matchLegBadge")}`}>2 wedstrijden</span>}
                </div>
                {displayField ? (
                  <div className={`font-bold text-muted-foreground inline-flex items-center gap-0.5 justify-end leading-none ${tight ? "text-[7px]" : "text-[9px]"}`}>
                    <MapPin className="h-2 w-2 flex-shrink-0" /> <span className="leading-none truncate max-w-[110px]" title={displayField || undefined}>{displayField}</span>
                  </div>
                ) : displayReferee ? (
                  <div className={`text-muted-foreground/70 inline-flex items-center gap-0.5 justify-end leading-none ${tight ? "text-[7px]" : "text-[9px]"}`}>
                    <WhistleIcon className="h-2 w-2 flex-shrink-0" /> <span className="leading-none truncate max-w-[110px]" title={activeLegMatch?.referee || undefined}>{displayReferee}</span>
                  </div>
                ) : <div />}
                {displayField && displayReferee && (
                  <>
                    <div />
                    <div className={`text-muted-foreground/70 inline-flex items-center gap-0.5 justify-end leading-none ${tight ? "text-[7px]" : "text-[9px]"}`}>
                      <WhistleIcon className="h-2 w-2 flex-shrink-0" /> <span className="leading-none truncate max-w-[110px]" title={activeLegMatch?.referee || undefined}>{displayReferee}</span>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
          </div>
        </div>
        <div className="relative leading-none" style={compactTree ? { height: cardH, overflow: "hidden" } : undefined}>
          {renderSide("home")}
          {renderSide("away")}
          {showOverlayTime && (
            tight ? (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col items-center font-bold text-muted-foreground leading-none gap-0.5">
                <span className="text-[10px]">{displayTimeStr}</span>
                {heenLegScoreLabel && (
                  <span className={`shrink-0 ${ds(bStyle, "matchLegBadge")}`}>{heenLegScoreLabel}</span>
                )}
              </div>
            ) : (
              <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 z-10 flex flex-col items-center leading-none gap-0.5">
                <span className={ds(bStyle, "matchTimeBadge")}>{displayTimeStr}</span>
                {heenLegScoreLabel && (
                  <span className={`shrink-0 ${ds(bStyle, "matchLegBadge")}`}>{heenLegScoreLabel}</span>
                )}
              </div>
            )
          )}

        </div>

      </div>
    );

    return card;
  };

  // Unified Flashscore-style dialog (single + sets + H&A)
  const renderUnifiedDialog = () => {
    if (selectedHAMatch) {
      const { match: m, heenMatch: hm, terugMatch: tm } = selectedHAMatch;
      const paired = m === hm ? tm : hm;
      return (
        <PublicMatchDetailDialog
          open={!!selectedHAMatch}
          onClose={() => setSelectedHAMatch(null)}
          match={m}
          pairedMatch={paired}
          teams={teams}
          tournament={tournament ?? null}
          phases={phases}
          groups={groups}
          slots={slots}
        />
      );
    }
    if (selectedMatch) {
      return (
        <PublicMatchDetailDialog
          open={!!selectedMatch}
          onClose={() => setSelectedMatch(null)}
          match={selectedMatch}
          pairedMatch={null}
          teams={teams}
          tournament={tournament ?? null}
          phases={phases}
          groups={groups}
          slots={slots}
        />
      );
    }
    return null;
  };

  if (bracketRounds.length === 0) return null;

  // === MOBILE: Large cards, peek next round, fade on scroll ===
  if (isMobile) {
    return (
      <>
      {renderUnifiedDialog()}
      <div className="relative">
        {/* Round indicator dots */}
        <div className="flex justify-center gap-1.5 mb-2">
          {displayRounds.map((_: any, idx: number) => (
            <div
              key={idx}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === activeRound ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>

        <div
          ref={scrollRef}
          className="overflow-x-auto overflow-y-hidden pb-4"
          style={{
            scrollSnapType: "x mandatory",
            scrollSnapStop: "always" as any,
            WebkitOverflowScrolling: "touch",
            paddingLeft: EDGE_PAD,
            paddingRight: EDGE_PAD,
          }}
          onScroll={handleScroll}
        >
          <div className="flex" style={{ width: displayRounds.length * MOBILE_COL_W + EDGE_PAD }}>
            {displayRounds.map((round: any, roundIdx: number) => {
              const matchCount = round.matches.length;
              const progress = roundProgress[roundIdx] ?? 0;
              const isActive = roundIdx === activeRound;
              const opacity = isActive ? 1 : Math.max(0.15, 1 - progress * 2.5);
              const compactH = TOP_OFFSET + matchCount * COMPACT_SPACING + 16;
              const focusMatchCount = displayRounds[activeRound]?.matches.length ?? 0;
              const focusCompactHeight = Math.max(CARD_H, (focusMatchCount - 1) * COMPACT_SPACING + CARD_H);
              const getFutureRoundTreeY = (matchIdx: number) => {
                if (focusMatchCount <= 0 || matchCount <= 0) return 0;
                const slotH = focusCompactHeight / matchCount;
                return TOP_OFFSET + slotH * matchIdx + (slotH - CARD_H) / 2;
              };

              return (
                <div
                  key={round.id}
                  className="flex-shrink-0"
                  style={{
                    width: MOBILE_COL_W,
                    scrollSnapAlign: "start",
                    scrollSnapStop: "always" as any,
                  }}
                >
                  <div className="mx-auto" style={{ width: CARD_W, opacity, transition: "opacity 200ms ease" }}>
                    <div className="text-center mb-2 flex items-center justify-center" style={{ height: HEADER_H }}>
                      <span className={`${ds(bStyle, "badge")} !text-[9px] !px-2 !py-0.5`}>
                        {round.name}
                      </span>
                    </div>
                    <div className="relative" style={{ height: isActive ? compactH : mobileTotalH, transition: "height 300ms ease" }}>
                      {round.matches.map((match: any, matchIdx: number) => {
                        const pos = matchPositions.find(p => p.matchId === match.id);
                        const y = isActive
                          ? (pos?.compactY ?? 0)
                          : getFutureRoundTreeY(matchIdx);
                        return (
                          <div
                            key={match.id}
                            className="absolute left-0 right-0"
                            style={{
                              top: 0,
                              transform: `translateY(${y}px)`,
                              transition: "transform 250ms ease",
                              willChange: "transform",
                            }}
                          >
                            {renderMatchCard(match, false)}
                          </div>
                        );
                      })}

                      {/* Placement below finale */}
                      {roundIdx === displayRounds.length - 1 && placementMatches.length > 0 && (() => {
                        // Position placement right below the last match in this round
                        const lastMatchY = isActive
                          ? (TOP_OFFSET + (matchCount - 1) * COMPACT_SPACING)
                          : roundIdx > activeRound
                            ? getFutureRoundTreeY(matchCount - 1)
                            : (matchPositions.find(p => p.roundIdx === roundIdx && p.matchIdx === matchCount - 1)?.treeY ?? 0);
                        const placementTop = lastMatchY + CARD_H + GAP;
                        return (
                          <div className="absolute left-0 right-0" style={{ transform: `translateY(${placementTop}px)`, transition: "transform 250ms ease" }}>
                            {placementMatches.map((pm: any, pmIdx: number) => (
                              <div key={pm.id} style={{ marginTop: pmIdx > 0 ? 10 : 0 }}>
                                <div className="text-center mb-1">
                                  <span className={`${ds(bStyle, "badge")} !text-[7px] !px-1.5 !py-0.5`}>
                                    {pm.roundName || pm.match_name || "Plaatsing"}
                                  </span>
                                </div>
                                {renderMatchCard(pm, false)}
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      </>
    );
  }

  // === DESKTOP: static horizontal bracket with SVG connectors ===
  // Desktop uses fixed totalHeight based on first round - no dynamic collapsing
  // Calculate the actual content height needed (placement below finale)
  const lastRoundMatchCount = displayRounds.length > 0 ? displayRounds[displayRounds.length - 1].matches.length : 1;
  const finaleTopDesktop = lastRoundMatchCount === 1 && displayRounds.length > 1
    ? (totalHeight - CARD_H) / 2
    : 0;
  const placementBottomDesktop = placementMatches.length > 0
    ? finaleTopDesktop + CARD_H + GAP + (compactTree ? 4 : 16) + placementMatches.length * (CARD_H + (compactTree ? 10 : 36))
    : totalHeight;
  const desktopContainerH = Math.max(totalHeight, placementBottomDesktop);

  // === MIRRORED LAYOUT (presentation slideshow only) ===
  // Splits bracket into left + right halves meeting at the final in the center.
  // Activates when compact mode is on, the last round is a single final, and there are at least 2 matches in the first round (so we can split into halves).
  // This includes the small 4-team case (SF + Final) which becomes: SF1 — Final — SF2.
  const useMirrored =
    compactTree &&
    displayRounds.length >= 2 &&
    lastRoundMatchCount === 1 &&
    displayRounds[0].matches.length >= 2 &&
    displayRounds[0].matches.length % 2 === 0;

  if (useMirrored) {
    // Build sides: each side has the rounds before the final, with matches split top/bottom
    const finalRound = displayRounds[displayRounds.length - 1];
    const sideRounds = displayRounds.slice(0, -1);
    const halfFirstCount = displayRounds[0].matches.length / 2;
    const sideHeight = halfFirstCount * CARD_H + (halfFirstCount - 1) * GAP;

    const leftRounds = sideRounds.map((r: any) => ({
      ...r,
      matches: r.matches.slice(0, Math.ceil(r.matches.length / 2)),
    }));
    const rightRounds = sideRounds.map((r: any) => ({
      ...r,
      matches: r.matches.slice(Math.ceil(r.matches.length / 2)),
    }));

    const renderSide = (sideRoundsArr: any[], side: "left" | "right") => {
      const orderedRounds = side === "left" ? sideRoundsArr : [...sideRoundsArr].reverse();
      return (
        <div className="flex">
          {orderedRounds.map((round: any, displayIdx: number) => {
            // Map displayIdx back to original round index for connector logic
            const roundIdx = side === "left" ? displayIdx : sideRoundsArr.length - 1 - displayIdx;
            const matchCount = round.matches.length;
            const slotH = sideHeight / matchCount;
            const isFirstStructural = roundIdx === 0;
            const getTop = (idx: number) =>
              isFirstStructural ? idx * (CARD_H + GAP) : slotH * idx + (slotH - CARD_H) / 2;
            const getCenterY = (idx: number) => getTop(idx) + CARD_H / 2;

            // For connectors: connect THIS round to the NEXT structural round (roundIdx + 1)
            const nextStructuralRound = sideRoundsArr[roundIdx + 1];
            const nextMatchCount = nextStructuralRound ? nextStructuralRound.matches.length : 0;
            const nextSlotH = nextMatchCount > 0 ? sideHeight / nextMatchCount : 0;
            const getNextCenterY = (idx: number) =>
              nextSlotH * idx + (nextSlotH - CARD_H) / 2 + CARD_H / 2;

            const showConnector = roundIdx < sideRoundsArr.length - 1 && matchCount >= 2;
            const connectorEl = showConnector ? (
              <svg
                className="flex-shrink-0"
                width={CONNECTOR_W}
                style={{ marginTop: HEADER_H, height: sideHeight }}
                xmlns="http://www.w3.org/2000/svg"
              >
                {round.matches.map((_: any, matchIdx: number) => {
                  if (matchIdx % 2 !== 0) return null;
                  const y1 = getCenterY(matchIdx);
                  const y2 = getCenterY(matchIdx + 1);
                  const nextIdx = Math.floor(matchIdx / 2);
                  const yTarget = getNextCenterY(nextIdx);
                  const midX = CONNECTOR_W / 2;
                  // Mirror connector horizontally for right side
                  const xCardEdge = side === "left" ? 0 : CONNECTOR_W;
                  const xFar = side === "left" ? CONNECTOR_W : 0;
                  return (
                    <g key={matchIdx}>
                      <line x1={xCardEdge} y1={y1} x2={midX} y2={y1} className={ds(bStyle, "bracketConnector") || "stroke-border"} strokeWidth={1.5} />
                      <line x1={xCardEdge} y1={y2} x2={midX} y2={y2} className={ds(bStyle, "bracketConnector") || "stroke-border"} strokeWidth={1.5} />
                      <line x1={midX} y1={y1} x2={midX} y2={y2} className={ds(bStyle, "bracketConnector") || "stroke-border"} strokeWidth={1.5} />
                      <line x1={midX} y1={yTarget} x2={xFar} y2={yTarget} className={ds(bStyle, "bracketConnector") || "stroke-border"} strokeWidth={1.5} />
                    </g>
                  );
                })}
              </svg>
            ) : null;

            // All rounds within this bracket share the same card size — the base size
            // is already scaled per-bracket via compactBracketScale (fewer rounds = bigger).
            const columnEl = (
              <div className="flex flex-col flex-shrink-0" style={{ width: CARD_W }}>
                <div className={`${compactTree ? "mb-2 h-5" : "mb-3 h-6"} text-center flex items-center justify-center`}>
                  <span className={`${ds(bStyle, "badge")} ${compactTree ? "!px-2 !py-0.5" : ""}`} style={compactTree ? { fontSize: Math.round(10 * compactBracketScale) } : undefined}>
                    {round.name}
                  </span>
                </div>
                <div className="relative" style={{ height: sideHeight }}>
                  {round.matches.map((match: any, matchIdx: number) => (
                    <div key={match.id} className="absolute left-0 right-0" style={{ top: getTop(matchIdx) }}>
                      {renderMatchCard(match, false, false)}
                    </div>
                  ))}
                </div>
              </div>
            );

            // Left side: column then connector. Right side: connector then column (mirrored).
            return (
              <div key={round.id} className="flex flex-shrink-0">
                {side === "left" ? (
                  <>
                    {columnEl}
                    {connectorEl}
                  </>
                ) : (
                  <>
                    {connectorEl}
                    {columnEl}
                  </>
                )}
              </div>
            );
          })}
        </div>
      );
    };

    // Center column: final + optional placement (3rd place) below.
    // Same card size as the rest of the bracket — uniform within one bracket.
    const centerColEl = (
      <div className="flex flex-col flex-shrink-0" style={{ width: CARD_W }}>
        <div className={`${compactTree ? "mb-2 h-5" : "mb-3 h-6"} text-center flex items-center justify-center`}>
          <span className={`${ds(bStyle, "badge")} ${compactTree ? "!px-2 !py-0.5" : ""}`} style={compactTree ? { fontSize: Math.round(10 * compactBracketScale) } : undefined}>
            {finalRound.name}
          </span>
        </div>
        <div className="relative" style={{ height: sideHeight }}>
          <div
            className="absolute left-0 right-0"
            style={{ top: (sideHeight - CARD_H) / 2 }}
          >
            {renderMatchCard(finalRound.matches[0], false, false)}
            {placementMatches.length > 0 && (
              <div style={{ marginTop: compactTree ? 12 : 16 }}>
                {placementMatches.map((pm: any, pmIdx: number) => (
                  <div key={pm.id} style={{ marginTop: pmIdx > 0 ? (compactTree ? 6 : 16) : 0 }}>
                    <div className={compactTree ? "text-center mb-1" : "text-center mb-1.5"}>
                      <span className={`${ds(bStyle, "badge")} ${compactTree ? "!px-2 !py-0.5" : ""}`} style={compactTree ? { fontSize: Math.round(10 * compactBracketScale) } : undefined}>
                        {pm.roundName || pm.match_name || "Plaatsingswedstrijd"}
                      </span>
                    </div>
                    {renderMatchCard(pm, false, false)}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );

    return (
      <>
        {renderUnifiedDialog()}
      <div className="pb-0">
          <div className="flex items-start justify-center">
            {renderSide(leftRounds, "left")}
            {/* Small spacer between side and center */}
            <div style={{ width: CONNECTOR_W }} />
            {centerColEl}
            <div style={{ width: CONNECTOR_W }} />
            {renderSide(rightRounds, "right")}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
    {renderUnifiedDialog()}
    <div className="overflow-x-auto pb-4">
      <div className="flex">
        {displayRounds.map((round: any, roundIdx: number) => {
          const matchCount = round.matches.length;
          const slotH = totalHeight / matchCount;
          const isFirstRound = roundIdx === 0;
          const getTop = (idx: number) => isFirstRound
            ? idx * (CARD_H + GAP)
            : slotH * idx + (slotH - CARD_H) / 2;
          const getCenterY = (idx: number) => getTop(idx) + CARD_H / 2;

          const nextRound = roundIdx < displayRounds.length - 1 ? displayRounds[roundIdx + 1] : null;
          const nextMatchCount = nextRound ? nextRound.matches.length : 0;
          const nextSlotH = nextMatchCount > 0 ? totalHeight / nextMatchCount : 0;
          const getNextTop = (idx: number) => nextSlotH * idx + (nextSlotH - CARD_H) / 2;
          const getNextCenterY = (idx: number) => getNextTop(idx) + CARD_H / 2;
          
          // Last round with placement: height = placement bottom; others = totalHeight
          const roundHeight = roundIdx === displayRounds.length - 1 && placementMatches.length > 0
            ? placementBottomDesktop
            : totalHeight;

          return (
            <div key={round.id} className="flex flex-shrink-0">
              <div className="flex flex-col flex-shrink-0" style={{ width: CARD_W }}>
                <div className={`${compactTree ? "mb-2 h-5" : "mb-3 h-6"} text-center flex items-center justify-center`}>
                  <span className={`${ds(bStyle, "badge")} ${compactTree ? "!text-[10px] !px-2 !py-0.5" : ""}`}>
                    {round.name}
                  </span>
                </div>
                <div className="relative" style={{ height: roundHeight }}>
                  {round.matches.map((match: any, matchIdx: number) => (
                    <div key={match.id} className="absolute left-0 right-0" style={{ top: getTop(matchIdx) }}>
                      {renderMatchCard(match, false, false)}
                    </div>
                  ))}

                  {roundIdx === displayRounds.length - 1 && placementMatches.length > 0 && (() => {
                    const finaleTop = displayRounds.length > 1 ? (totalHeight - CARD_H) / 2 : 0;
      const placementTop = finaleTop + CARD_H + GAP + (compactTree ? 4 : 16);
                    return (
                      <div className="absolute left-0 right-0" style={{ top: placementTop }}>
                        {placementMatches.map((pm: any, pmIdx: number) => (
            <div key={pm.id} style={{ marginTop: pmIdx > 0 ? (compactTree ? 4 : 16) : 0 }}>
              <div className={compactTree ? "text-center mb-0.5" : "text-center mb-1.5"}>
                <span className={`${ds(bStyle, "badge")} ${compactTree ? "!text-[10px] !px-2 !py-0.5" : ""}`}>
                                {pm.roundName || pm.match_name || "Plaatsingswedstrijd"}
                              </span>
                            </div>
                            {renderMatchCard(pm)}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
              {roundIdx < displayRounds.length - 1 && matchCount >= 2 && (
                <svg className="flex-shrink-0" width={CONNECTOR_W} style={{ marginTop: HEADER_H, height: totalHeight }} xmlns="http://www.w3.org/2000/svg">
                  {round.matches.map((_: any, matchIdx: number) => {
                    if (matchIdx % 2 !== 0) return null;
                    const y1 = getCenterY(matchIdx);
                    const y2 = getCenterY(matchIdx + 1);
                    const nextIdx = Math.floor(matchIdx / 2);
                    const yTarget = getNextCenterY(nextIdx);
                    const midX = CONNECTOR_W / 2;
                    return (
                      <g key={matchIdx}>
                        <line x1={0} y1={y1} x2={midX} y2={y1} className={ds(bStyle, "bracketConnector") || "stroke-border"} strokeWidth={1.5} />
                        <line x1={0} y1={y2} x2={midX} y2={y2} className={ds(bStyle, "bracketConnector") || "stroke-border"} strokeWidth={1.5} />
                        <line x1={midX} y1={y1} x2={midX} y2={y2} className={ds(bStyle, "bracketConnector") || "stroke-border"} strokeWidth={1.5} />
                        <line x1={midX} y1={yTarget} x2={CONNECTOR_W} y2={yTarget} className={ds(bStyle, "bracketConnector") || "stroke-border"} strokeWidth={1.5} />
                      </g>
                    );
                  })}
                </svg>
              )}
            </div>
          );
        })}
      </div>
    </div>
    </>
  );
};

// List view for a set of rounds - using unified match card
const BracketListRounds = ({ rounds, teams, slots = [], tournament, phases, groups, allMatches, groupTeams = [], scoringSystems = [] }: { rounds: any[]; teams: any[]; slots?: any[]; tournament: any; phases?: any[]; groups?: any[]; allMatches?: any[]; groupTeams?: any[]; scoringSystems?: any[] }) => {
  const bStyle = useBroadcastStyle();
  return (
    <div className="space-y-4">
      {rounds.map((round: any) => {
        if (round.matches.length === 0) return null;
        return (
          <div key={round.id} className={ds(bStyle, "card")}>
            <div className={ds(bStyle, "cardHeader")}>
              <div className={ds(bStyle, "cardHeaderDot")} />
              <h4 className={ds(bStyle, "cardHeaderTitle")}>{round.name}</h4>
            </div>
            <div className="divide-y divide-border">
              {round.matches.map((m: any) => {
                const positions = getMatchTeamPositions(m, groupTeams, allMatches || [], groups, phases, scoringSystems, tournament);
                return (
                <PublicMatchCard
                  key={m.id}
                  match={m}
                  teams={teams}
                  phases={phases}
                  groups={groups}
                  slots={slots}
                  tournament={tournament}
                  allMatches={allMatches}
                  {...positions}
                />
              );})}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Main component - Two-level tab navigation
const PublicBracketSection = ({ groups, labelGroups, matches, teams, slots = [], tournament, phases, showAllOnly, favoriteTeam, scrollToGroupId, formatName, hideSectionDividers = false, presentationCompact = false, skipFirstRounds = 0, groupTeams = [], scoringSystems = [] }: BracketSectionProps) => {
  const bStyle = useBroadcastStyle();
  const [selectedTopTab, setSelectedTopTab] = useState<string>("all");
  const [selectedSubTab, setSelectedSubTab] = useState<string>("all");
  const sectionContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to section containing scrollToGroupId
  useEffect(() => {
    if (!scrollToGroupId || !sectionContainerRef.current) return;
    const timer = setTimeout(() => {
      // Find the section div whose data-bracket-group contains our target group ID
      const sections = sectionContainerRef.current?.querySelectorAll("[data-bracket-group]");
      if (!sections) return;
      for (const el of sections) {
        const ids = el.getAttribute("data-bracket-group") || "";
        if (ids.includes(scrollToGroupId!)) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
          break;
        }
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [scrollToGroupId]);

  const bracketGroupMap = useMemo(() => {
    const pid = groups.length > 0 ? groups[0]?.phase_id : null;
    const phase = pid && phases ? phases.find((p: any) => p.id === pid) : null;
    return ((phase?.match_config as any)?.bracketGroupMap || {}) as Record<string, string>;
  }, [groups, phases]);


  const bracketNames = useMemo(() => {
    const pid = groups.length > 0 ? groups[0]?.phase_id : null;
    const phase = pid && phases ? phases.find((p: any) => p.id === pid) : null;
    return ((phase?.match_config as any)?.bracketNames || {}) as Record<string, string>;
  }, [groups, phases]);

  const getSubBracketLabel = (key: string) => bracketNames[key] || (key === "main" ? "Hoofdbracket" : `Plaatsing ${key}`);
  const getBracketLabel = (key: string) => getSubBracketLabel(key);

  const phaseMatchType = useMemo(() => {
    const pid = groups.length > 0 ? groups[0]?.phase_id : null;
    const phase = pid && phases ? phases.find((p: any) => p.id === pid) : null;
    return (phase?.match_config as any)?.matchType || "single_leg";
  }, [groups, phases]);

  const structure = useMemo(() => detectBracketStructure(groups, matches, bracketGroupMap, phaseMatchType), [groups, matches, bracketGroupMap, phaseMatchType]);

  // Auto-selecteer de (sub)bracket met de eerstvolgende ONGESPEELDE wedstrijd van het favoriete team
  const autoSelectedRef = useRef<string | null>(null);
  useEffect(() => {
    if (showAllOnly || !favoriteTeam) return;
    if (autoSelectedRef.current === favoriteTeam) return;
    const isFav = (m: any) => m?.home_team_id === favoriteTeam || m?.away_team_id === favoriteTeam;
    const hasFav = (rounds: any[], onlyUnplayed: boolean) =>
      (rounds || []).some((r: any) =>
        (r.matches || []).some((m: any) => isFav(m) && (!onlyUnplayed || !m.is_played)),
      );

    const apply = (onlyUnplayed: boolean): boolean => {
      const findIn = (prefix: string): string | null => {
        if (
          hasFav(structure.loserBrackets[prefix] || [], onlyUnplayed) ||
          hasFav(structure.loserPlacementRounds[prefix] || [], onlyUnplayed)
        )
          return prefix;
        for (const child of structure.loserBracketChildren[prefix] || []) {
          const found = findIn(child);
          if (found) return found;
        }
        return null;
      };

      // Loser/placement brackets eerst: als het team daar nog moet spelen, is dat de actuele plek
      for (const key of structure.topLevelLoserKeys) {
        const found = findIn(key);
        if (found) {
          autoSelectedRef.current = favoriteTeam;
          setSelectedTopTab(key);
          setSelectedSubTab(found === key ? `main-${key}` : `bracket-${found}`);
          return true;
        }
      }

      if (hasFav(structure.mainRounds, onlyUnplayed) || hasFav(structure.placementRounds, onlyUnplayed)) {
        autoSelectedRef.current = favoriteTeam;
        setSelectedTopTab("main");
        setSelectedSubTab("all");
        return true;
      }
      return false;
    };

    if (apply(true)) return;
    apply(false);
  }, [favoriteTeam, structure, showAllOnly]);




  // Top-level tabs: Hoofdbracket + each top-level loser bracket (5-8, 9-16, etc.)
  const topLevelTabs = useMemo(() => {
    const result: { id: string; label: string }[] = [];
    if (structure.mainRounds.length > 0) {
      result.push({ id: "main", label: getBracketLabel("main") });
    }
    for (const key of structure.topLevelLoserKeys) {
      result.push({ id: key, label: getBracketLabel(key) });
    }
    return result;
  }, [structure, bracketNames, formatName]);

  // Get sub-tabs for the selected top-level tab
  const getSubContent = useMemo(() => {
    if (selectedTopTab === "all") {
      const allRounds: { section: string; rounds: any[] }[] = [];
      if (structure.mainRounds.length > 0) {
        allRounds.push({ section: getBracketLabel("main"), rounds: insertPlacementBeforeFinale(structure.mainRounds, structure.placementRounds) });
      }
      const addAll = (prefix: string) => {
        const br = structure.loserBrackets[prefix] || [];
        const pl = structure.loserPlacementRounds[prefix] || [];
        allRounds.push({ section: getBracketLabel(prefix), rounds: insertPlacementBeforeFinale(br, pl) });
        for (const child of structure.loserBracketChildren[prefix] || []) addAll(child);
      };
      for (const key of structure.topLevelLoserKeys) addAll(key);
      return { hasSubTabs: false, subTabs: [] as { id: string; label: string; rounds: any[] }[], allRounds };
    }

    if (selectedTopTab === "main") {
      const mainRounds = insertPlacementBeforeFinale(structure.mainRounds, structure.placementRounds);
      return { hasSubTabs: false, subTabs: [] as { id: string; label: string; rounds: any[] }[], allRounds: [{ section: getBracketLabel("main"), rounds: mainRounds }] };
    }

    const prefix = selectedTopTab;
    const bracketRounds = structure.loserBrackets[prefix] || [];
    const placementForBracket = structure.loserPlacementRounds[prefix] || [];
    const mainBracketRounds = insertPlacementBeforeFinale(bracketRounds, placementForBracket);
    const children = structure.loserBracketChildren[prefix] || [];

    if (children.length === 0) {
      return { hasSubTabs: false, subTabs: [], allRounds: [{ section: getBracketLabel(prefix), rounds: mainBracketRounds }] };
    }

    const subTabs: { id: string; label: string; rounds: any[] }[] = [];
    subTabs.push({ id: `main-${prefix}`, label: getBracketLabel(prefix), rounds: mainBracketRounds });

    const addChildTabs = (childPrefix: string) => {
      const childRounds = structure.loserBrackets[childPrefix] || [];
      const childPlacement = structure.loserPlacementRounds[childPrefix] || [];
      subTabs.push({ id: `bracket-${childPrefix}`, label: getBracketLabel(childPrefix), rounds: insertPlacementBeforeFinale(childRounds, childPlacement) });
      for (const grandchild of structure.loserBracketChildren[childPrefix] || []) {
        addChildTabs(grandchild);
      }
    };
    for (const child of children) addChildTabs(child);

    const allRounds: { section: string; rounds: any[] }[] = [{ section: getBracketLabel(prefix), rounds: mainBracketRounds }];
    const addAllSections = (childPrefix: string) => {
      const childRounds = structure.loserBrackets[childPrefix] || [];
      const childPlacement = structure.loserPlacementRounds[childPrefix] || [];
      allRounds.push({ section: getBracketLabel(childPrefix), rounds: insertPlacementBeforeFinale(childRounds, childPlacement) });
      for (const grandchild of structure.loserBracketChildren[childPrefix] || []) addAllSections(grandchild);
    };
    for (const child of children) addAllSections(child);

    return { hasSubTabs: true, subTabs, allRounds };
  }, [selectedTopTab, structure, bracketNames, formatName]);

  const activeSubRounds = useMemo(() => {
    if (selectedSubTab === "all") return null;
    return getSubContent.subTabs.find(t => t.id === selectedSubTab)?.rounds || null;
  }, [selectedSubTab, getSubContent]);

  const handleTopTabChange = (tabId: string) => {
    setSelectedTopTab(tabId);
    setSelectedSubTab("all");
  };

  const showTopTabs = !showAllOnly && topLevelTabs.length > 1;
  const showSubTabs = !showAllOnly && getSubContent.hasSubTabs;

  // When showAllOnly, always render all brackets with titles
  const allRoundsToRender = showAllOnly
    ? (() => {
        const all: { section: string; rounds: any[] }[] = [];
        if (structure.mainRounds.length > 0) {
          all.push({ section: getBracketLabel("main"), rounds: insertPlacementBeforeFinale(structure.mainRounds, structure.placementRounds) });
        }
        const addAll = (prefix: string) => {
          const br = structure.loserBrackets[prefix] || [];
          const pl = structure.loserPlacementRounds[prefix] || [];
          all.push({ section: getBracketLabel(prefix), rounds: insertPlacementBeforeFinale(br, pl) });
          for (const child of structure.loserBracketChildren[prefix] || []) addAll(child);
        };
        for (const key of structure.topLevelLoserKeys) addAll(key);
        return all;
      })()
    : null;

  return (
    <div className={presentationCompact ? "space-y-0" : "space-y-2"}>
      {/* Level 1: Top-level bracket tabs */}
      {showTopTabs && (
        <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-none">
          <button
            onClick={() => { handleTopTabChange("all"); }}
            className={`${ds(bStyle, "phaseTab")} ${
              selectedTopTab === "all" ? ds(bStyle, "phaseTabActive") : ds(bStyle, "phaseTabInactive")
            }`}
          >Alle</button>
          {topLevelTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTopTabChange(tab.id)}
              className={`${ds(bStyle, "phaseTab")} ${
                selectedTopTab === tab.id ? ds(bStyle, "phaseTabActive") : ds(bStyle, "phaseTabInactive")
              }`}
            >{tab.label}</button>
          ))}
        </div>
      )}

      {/* Level 2: Sub-bracket tabs */}
      {showSubTabs && selectedTopTab !== "all" && (
        <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-none">
          <button
            onClick={() => setSelectedSubTab("all")}
            className={`${ds(bStyle, "phaseTab")} ${
              selectedSubTab === "all" ? ds(bStyle, "phaseTabActive") : ds(bStyle, "phaseTabInactive")
            }`}
          >Alle</button>
          {getSubContent.subTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedSubTab(tab.id)}
              className={`${ds(bStyle, "phaseTab")} ${
                selectedSubTab === tab.id ? ds(bStyle, "phaseTabActive") : ds(bStyle, "phaseTabInactive")
              }`}
            >{tab.label}</button>
          ))}
        </div>
      )}

      {/* Content */}
      {allRoundsToRender ? (
        <div className="space-y-0" ref={!allRoundsToRender ? undefined : sectionContainerRef}>
          {allRoundsToRender.map((section, idx) => (
            <div key={section.section} data-bracket-group={section.rounds.flatMap((r: any) => r.matches.map((m: any) => m.group_id)).filter(Boolean).join(",")}>
              {allRoundsToRender.length > 1 && (
                <div className={`flex items-center gap-2 ${presentationCompact ? "mb-1.5" : "mb-3"} ${idx > 0 ? (presentationCompact ? "mt-3" : "mt-6") : ""}`}>
                  <div className={ds(bStyle, "sectionDot")} />
                  <h3 className={`${ds(bStyle, "sectionTitle") || "text-sm font-black uppercase tracking-wider"} !text-xs ${bStyle === "teletext" ? "ttx-title-solo" : ""}`}>{section.section}</h3>
                  {bStyle !== "teletext" && <div className={ds(bStyle, "sectionLine")} />}
                </div>
              )}
              <BracketTree bracketRounds={section.rounds} teams={teams} slots={slots} tournament={tournament} phases={phases} groups={groups} labelGroups={labelGroups} favoriteTeam={favoriteTeam} allMatches={matches} phaseMatchType={phaseMatchType} presentationCompact={presentationCompact} skipFirstRounds={skipFirstRounds} />
            </div>
          ))}
        </div>
      ) : (selectedSubTab === "all" || !activeSubRounds) ? (
        <div className="space-y-0" ref={allRoundsToRender ? undefined : sectionContainerRef}>
          {getSubContent.allRounds.map((section, idx) => (
            <div key={section.section} data-bracket-group={section.rounds.flatMap((r: any) => r.matches.map((m: any) => m.group_id)).filter(Boolean).join(",")}>
              {getSubContent.allRounds.length > 1 && (
                <div className={`flex items-center gap-2 ${presentationCompact ? "mb-1.5" : "mb-3"} ${idx > 0 ? (presentationCompact ? "mt-3" : "mt-6") : ""}`}>
                  <div className={ds(bStyle, "sectionDot")} />
                  <h3 className={`${ds(bStyle, "sectionTitle") || "text-sm font-black uppercase tracking-wider"} !text-xs ${bStyle === "teletext" ? "ttx-title-solo" : ""}`}>{section.section}</h3>
                  {bStyle !== "teletext" && <div className={ds(bStyle, "sectionLine")} />}
                </div>
              )}
              <BracketTree bracketRounds={section.rounds} teams={teams} slots={slots} tournament={tournament} phases={phases} groups={groups} labelGroups={labelGroups} favoriteTeam={favoriteTeam} allMatches={matches} phaseMatchType={phaseMatchType} presentationCompact={presentationCompact} skipFirstRounds={skipFirstRounds} />
            </div>
          ))}
        </div>
      ) : (
        <BracketTree bracketRounds={activeSubRounds} teams={teams} slots={slots} tournament={tournament} phases={phases} groups={groups} labelGroups={labelGroups} favoriteTeam={favoriteTeam} allMatches={matches} phaseMatchType={phaseMatchType} presentationCompact={presentationCompact} skipFirstRounds={skipFirstRounds} />
      )}
    </div>
  );
};

export default PublicBracketSection;
