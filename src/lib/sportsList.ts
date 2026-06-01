export interface SportOption {
  name: string;
  emoji: string;
}

export interface SportCategory {
  label: string;
  options: SportOption[];
}

export const SPORT_CATEGORIES: SportCategory[] = [
  {
    label: "Sport",
    options: [
      { name: "American Football", emoji: "🏈" },
      { name: "Atletiek", emoji: "🏃" },
      { name: "Badminton", emoji: "🏸" },
      { name: "Basketbal", emoji: "🏀" },
      { name: "Beach soccer", emoji: "⚽" },
      { name: "Beachtennis", emoji: "🎾" },
      { name: "Beachvolleybal", emoji: "🏐" },
      { name: "Biljart", emoji: "🎱" },
      { name: "Bowling", emoji: "🎳" },
      { name: "Cricket", emoji: "🏏" },
      { name: "Curling", emoji: "🥌" },
      { name: "Darts", emoji: "🎯" },
      { name: "Esport", emoji: "🎮" },
      { name: "Flag Football", emoji: "🏈" },
      { name: "Floorball", emoji: "🏑" },
      { name: "Freestyle voetbal", emoji: "⚽" },
      { name: "Golf", emoji: "⛳" },
      { name: "Handbal", emoji: "🤾" },
      { name: "Hockey", emoji: "🏑" },
      { name: "Honkbal / Softbal", emoji: "⚾" },
      { name: "IJshockey", emoji: "🏒" },
      { name: "Inlinehockey", emoji: "🛼" },
      { name: "Judo", emoji: "🥋" },
      { name: "Korfbal", emoji: "🥅" },
      { name: "Muurkaatsen", emoji: "🧱" },
      { name: "Netball", emoji: "🏐" },
      { name: "Padel", emoji: "🎾" },
      { name: "Pétanque / Jeu de boules", emoji: "🎱" },
      { name: "Pickleball", emoji: "🏓" },
      { name: "Racquetball", emoji: "🏸" },
      { name: "Rounders", emoji: "⚾" },
      { name: "Rugby", emoji: "🏉" },
      { name: "Sepak takraw", emoji: "🏐" },
      { name: "Squash", emoji: "🎾" },
      { name: "Tafeltennis", emoji: "🏓" },
      { name: "Tennis", emoji: "🎾" },
      { name: "Voetbal", emoji: "⚽" },
      { name: "Volleybal", emoji: "🏐" },
      { name: "Waterpolo", emoji: "🤽" },
      { name: "Worstelen", emoji: "🤼" },
      { name: "Zaalvoetbal (futsal)", emoji: "⚽" },
      { name: "Zwemmen", emoji: "🏊" },
    ],
  },
];

export const ALL_SPORTS = SPORT_CATEGORIES.flatMap((c) => c.options);

export const findSport = (name: string): SportOption | undefined =>
  ALL_SPORTS.find((s) => s.name === name);
