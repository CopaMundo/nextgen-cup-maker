import { useSearchParams } from "react-router-dom";
import { DrawShow } from "@/components/draw/DrawShow";
import { emptyContainerRules } from "@/lib/liveDraw";
import type { DrawSessionState } from "@/lib/drawSession";
import type { DrawPresentation } from "@/lib/drawPresentation";
import type { DrawStudioTheme } from "@/lib/drawStudio";

const CLUBS: [string, string, string][] = [
  ["FC Aurora", "Netherlands", "#c8102e"], ["Real Norte", "Spain", "#005ea9"], ["Sporting Vale", "Portugal", "#00813a"],
  ["Olympique Sud", "France", "#002157"], ["Inter Mare", "Italy", "#0068a8"], ["Rapid Ede", "Germany", "#000000"],
  ["Celtic Nord", "Scotland", "#018749"], ["Ajax Zuid", "Netherlands", "#d2122e"],
  ["Dynamo Oost", "Ukraine", "#005bbb"], ["FC Lumi", "Belgium", "#ef3340"], ["Rangers West", "Scotland", "#1d428a"],
  ["Bastia Marine", "France", "#009ee0"], ["Torino Giallo", "Italy", "#e1a200"], ["Sevilla Roja", "Spain", "#c60b1e"],
  ["Malmö Blå", "Sweden", "#003057"], ["Brann Fjell", "Norway", "#b91c1c"],
];

const logo = (name: string, color: string) => {
  const initials = name.split(" ").map((word) => word[0]).join("").slice(0, 3).toUpperCase();
  return `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><circle cx="64" cy="64" r="58" fill="${color}"/><text x="64" y="82" font-family="Arial,Helvetica,sans-serif" font-size="46" font-weight="bold" fill="#ffffff" text-anchor="middle">${initials}</text></svg>`)}`;
};

export default function DrawStudioPreview() {
  const [params] = useSearchParams();
  const theme = (params.get("theme") ?? "copa-gold") as DrawStudioTheme;
  const count = Math.max(1, Math.min(CLUBS.length, Number(params.get("teams") ?? 16)));
  const tournamentName = params.get("name") ?? "SOCCERTEC MASTERS";
  const ids = CLUBS.slice(0, count).map((_, index) => `t${index}`);
  const teams = CLUBS.slice(0, count).map(([name, country, color], index) => ({ id: `t${index}`, name, country, logoUrl: logo(name, color) }));
  const half = Math.ceil(count / 2);
  const pots = [
    { id: "p1", name: "Pot 1", teamIds: ids.slice(0, half) },
    { id: "p2", name: "Pot 2", teamIds: ids.slice(half) },
  ];
  const placed = new Set<string>([ids[0], ids[1], ids[half]].filter(Boolean));
  const session = {
    kind: "containers", mode: "pots", phaseName: "Groepsfase", teams, pots,
    containers: [
      { id: "g1", name: "Groep A", capacity: 4, slotIds: ["a1", "a2", "a3", "a4"], teamIds: [ids[0], ids[1]].filter(Boolean) },
      { id: "g2", name: "Groep B", capacity: 4, slotIds: ["b1", "b2", "b3", "b4"], teamIds: [ids[half]].filter(Boolean) },
      { id: "g3", name: "Groep C", capacity: 4, slotIds: ["c1", "c2", "c3", "c4"], teamIds: [] },
      { id: "g4", name: "Groep D", capacity: 4, slotIds: ["d1", "d2", "d3", "d4"], teamIds: [] },
    ],
    containerRules: emptyContainerRules(),
    remaining: ids.filter((id) => !placed.has(id)),
    activePotId: "p1",
    roundsGroups: [], roundsRules: null, pairs: [], activeGroupIndex: 0, activeRound: 1, availableThisRound: [],
    pending: null, history: [], log: [], finished: false,
  } as unknown as DrawSessionState;
  const presentation = {
    tournamentName, theme, speed: 1, revealAt: Date.now(), activePotId: "p1", selection: null, sweep: null, flagBackdrops: true, language: "nl",
  } as DrawPresentation;
  return <main className="draw-projector-stage flex h-dvh items-center justify-center overflow-hidden bg-background text-foreground">
    <DrawShow session={session} presentation={presentation} />
  </main>;
}
