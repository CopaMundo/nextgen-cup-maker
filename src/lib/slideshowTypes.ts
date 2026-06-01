// Shared types for slideshow configuration

export type BlockType =
  | "group_standing"      // klassement van een groep
  | "group_schedule"      // wedstrijdschema van een groep
  | "group_combo"         // stand + schema samen
  | "bracket"             // knockout-bracket per fase
  | "upcoming_matches"    // globale komende wedstrijden
  | "recent_results"      // globale laatste uitslagen
  | "topscorers"
  | "assists"
  | "fairplay"
  | "image";              // afbeelding/foto blok

export type BlockWidth = 33 | 50 | 66 | 100;

export interface SlideBlock {
  id: string;
  type: BlockType;
  refId?: string | null;   // group_id, phase_id afhankelijk van type
  /** Voor bracket: welke sub-bracket binnen de phase ("main" of een loser-prefix zoals "5-8") */
  bracketKey?: string | null;
  width: BlockWidth;       // procent
  // Voor group_combo: hoe stand+schema verdeeld worden (default 50/50)
  comboLayout?: "standing_schedule" | "standing" | "schedule";
  // Voor image-blok: URL naar de afbeelding
  imageUrl?: string | null;
}

export interface Slide {
  id: string;
  name?: string;
  durationSec: number;
  enabled: boolean;
  blocks: SlideBlock[];
}

export interface SponsorBar {
  enabled: boolean;
}

export interface SlideshowOptions {
  showTournamentName: boolean;
  showCurrentTime: boolean;
  defaultDurationSec: number;
}

export interface SlideshowRow {
  id: string;
  tournament_id: string;
  name: string;
  sort_order: number;
  slides: Slide[];
  sponsor_bar: SponsorBar;
  options: SlideshowOptions;
  /** Beperk deze voorstelling tot één divisie. null = alle divisies */
  category_id?: string | null;
}

export const DEFAULT_OPTIONS: SlideshowOptions = {
  showTournamentName: true,
  showCurrentTime: true,
  defaultDurationSec: 15,
};

export const DEFAULT_SPONSOR_BAR: SponsorBar = { enabled: true };

export const BLOCK_LABELS: Record<BlockType, string> = {
  group_standing: "Stand",
  group_schedule: "Schema",
  group_combo: "Stand en schema",
  bracket: "Bracket",
  upcoming_matches: "Aankomende wedstrijden",
  recent_results: "Laatste resultaten",
  topscorers: "Topscorers",
  assists: "Assists",
  fairplay: "Fairplay",
  image: "Afbeelding",
};
