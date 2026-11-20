import type {
  FishMutation,
  GiantCreatureId,
  LocationId,
  Rarity,
  WorldEventId,
} from "./types";

export interface MutationMeta {
  id: FishMutation;
  label: string;
  color: string;
  glow: string;
  valueMultiplier: number;
  xpMultiplier: number;
  weight: number;
  description: string;
}

export const MUTATION_META: Record<FishMutation, MutationMeta> = {
  normal: {
    id: "normal",
    label: "Natural",
    color: "#d9cba8",
    glow: "#8a7c53",
    valueMultiplier: 1,
    xpMultiplier: 1,
    weight: 0,
    description: "A true child of the tide, unmarked by magic.",
  },
  golden: {
    id: "golden",
    label: "Golden",
    color: "#ffd166",
    glow: "#e8b73d",
    valueMultiplier: 2.2,
    xpMultiplier: 1.6,
    weight: 8,
    description: "Gilded scales that catch every ray of light.",
  },
  albino: {
    id: "albino",
    label: "Albino",
    color: "#f4f0e6",
    glow: "#c9c1ae",
    valueMultiplier: 1.9,
    xpMultiplier: 1.5,
    weight: 10,
    description: "Pale as sea-foam, with eyes like pink pearls.",
  },
  crystal: {
    id: "crystal",
    label: "Crystal",
    color: "#9fe8ff",
    glow: "#4fb8d9",
    valueMultiplier: 2.7,
    xpMultiplier: 1.9,
    weight: 5,
    description: "Its body has grown into clear, ringing crystal.",
  },
  shadow: {
    id: "shadow",
    label: "Shadow",
    color: "#a98ce0",
    glow: "#5d3f99",
    valueMultiplier: 3.1,
    xpMultiplier: 2.1,
    weight: 3,
    description: "A fish woven from the dark between waves.",
  },
  glowing: {
    id: "glowing",
    label: "Glowing",
    color: "#7ff7e8",
    glow: "#24b9ac",
    valueMultiplier: 3.6,
    xpMultiplier: 2.4,
    weight: 2,
    description: "Bioluminescent veins pulse with living light.",
  },
};

export const MUTATION_ORDER: FishMutation[] = ["normal", "golden", "albino", "crystal", "shadow", "glowing"];

export function rollMutation(luck = 1, bonus = 0, random = Math.random): FishMutation {
  const chance = Math.max(0, Math.min(0.65, 0.075 + Math.max(0, luck - 1) * 0.035 + bonus));
  if (random() >= chance) return "normal";
  const pool = MUTATION_ORDER.filter((id) => id !== "normal");
  const total = pool.reduce((sum, id) => sum + MUTATION_META[id].weight, 0);
  let roll = random() * total;
  for (const id of pool) {
    roll -= MUTATION_META[id].weight;
    if (roll <= 0) return id;
  }
  return "golden";
}

export interface WorldEventDef {
  id: WorldEventId;
  name: string;
  description: string;
  color: string;
  icon: string;
  durationMs: number;
  rarityBoost: number;
  valueMult: number;
  xpMult: number;
  mutationBoost: number;
  biteSpeed: number;
  treasureBoost: number;
  spawnCreature?: GiantCreatureId;
  weather?: string;
}

export const WORLD_EVENTS: WorldEventDef[] = [
  {
    id: "golden-hour",
    name: "Golden Hour",
    description: "The sea turns to honey. Every catch is worth more while the light lasts.",
    color: "#ffc766",
    icon: "☀",
    durationMs: 120000,
    rarityBoost: 0.04,
    valueMult: 1.25,
    xpMult: 1.1,
    mutationBoost: 0.02,
    biteSpeed: 1.1,
    treasureBoost: 0,
    weather: "sunny",
  },
  {
    id: "meteor-shower",
    name: "Meteor Shower",
    description: "Starfall dust drifts onto the water. Strange mutations surface to drink it.",
    color: "#b9a8ff",
    icon: "☄",
    durationMs: 110000,
    rarityBoost: 0.1,
    valueMult: 1.15,
    xpMult: 1.2,
    mutationBoost: 0.09,
    biteSpeed: 1,
    treasureBoost: 0.2,
  },
  {
    id: "blood-moon",
    name: "Blood Moon",
    description: "The moon bleeds red. Ancient things stir beneath the black water.",
    color: "#ff7a6b",
    icon: "◐",
    durationMs: 130000,
    rarityBoost: 0.12,
    valueMult: 1.2,
    xpMult: 1.25,
    mutationBoost: 0.07,
    biteSpeed: 0.95,
    treasureBoost: 0.15,
    spawnCreature: "abyssal-kraken",
  },
  {
    id: "aurora-night",
    name: "Aurora Night",
    description: "Ribbons of green fire dance overhead. Every lesson of the sea sinks deeper.",
    color: "#7ff7b0",
    icon: "✧",
    durationMs: 120000,
    rarityBoost: 0.06,
    valueMult: 1.1,
    xpMult: 1.45,
    mutationBoost: 0.05,
    biteSpeed: 1.1,
    treasureBoost: 0.1,
  },
  {
    id: "whale-migration",
    name: "Whale Migration",
    description: "A pod of giants passes through. The old whale accepts offerings from brave anglers.",
    color: "#8fc4ff",
    icon: "≈",
    durationMs: 140000,
    rarityBoost: 0.05,
    valueMult: 1.15,
    xpMult: 1.2,
    mutationBoost: 0.03,
    biteSpeed: 1,
    treasureBoost: 0.1,
    spawnCreature: "ancient-whale",
  },
  {
    id: "pirate-ship",
    name: "Pirate Ship",
    description: "A ghostly galleon anchors offshore. Sunken chests rise with the tide.",
    color: "#e0b45a",
    icon: "⚓",
    durationMs: 120000,
    rarityBoost: 0.04,
    valueMult: 1.35,
    xpMult: 1.1,
    mutationBoost: 0.03,
    biteSpeed: 1,
    treasureBoost: 0.6,
  },
  {
    id: "fishing-frenzy",
    name: "Fishing Frenzy",
    description: "The whole reef is feeding. Bites come fast and the creel fills itself.",
    color: "#ff9f6b",
    icon: "≋",
    durationMs: 100000,
    rarityBoost: 0.03,
    valueMult: 1.15,
    xpMult: 1.2,
    mutationBoost: 0.02,
    biteSpeed: 1.6,
    treasureBoost: 0,
  },
  {
    id: "heavy-rain",
    name: "Heavy Rain",
    description: "Warm rain hammers the surface. Deep fish rise to taste the storm.",
    color: "#7fa8d9",
    icon: "☂",
    durationMs: 110000,
    rarityBoost: 0.08,
    valueMult: 1.1,
    xpMult: 1.1,
    mutationBoost: 0.04,
    biteSpeed: 1.2,
    treasureBoost: 0.1,
    weather: "rainy",
  },
];

export const WORLD_EVENTS_BY_ID: Record<WorldEventId, WorldEventDef> = Object.fromEntries(
  WORLD_EVENTS.map((event) => [event.id, event]),
) as Record<WorldEventId, WorldEventDef>;

export const EVENT_INTERMISSION_MS = 45000;

export interface CreatureDef {
  id: GiantCreatureId;
  name: string;
  kind: string;
  hp: number;
  minLevel: number;
  locations: LocationId[];
  rewardCoins: number;
  rewardXp: number;
  color: string;
  description: string;
  drop: string;
}

export const GIANT_CREATURES: CreatureDef[] = [
  {
    id: "reef-shark",
    name: "Coral Reaper",
    kind: "shark",
    hp: 2600,
    minLevel: 4,
    locations: ["coral-bay", "sunny-shore"],
    rewardCoins: 900,
    rewardXp: 320,
    color: "#8fb9c9",
    description: "A scarred reef shark that has learned the taste of fishing lines.",
    drop: "shark-tooth",
  },
  {
    id: "ancient-whale",
    name: "The Long Song",
    kind: "whale",
    hp: 6200,
    minLevel: 8,
    locations: ["deep-ocean", "coral-bay"],
    rewardCoins: 2200,
    rewardXp: 760,
    color: "#7f9fd1",
    description: "An ancient whale older than the harbour. Its song can be heard through the hull.",
    drop: "whale-song",
  },
  {
    id: "storm-serpent",
    name: "Tempest Coil",
    kind: "serpent",
    hp: 4800,
    minLevel: 10,
    locations: ["deep-ocean", "mystic-river"],
    rewardCoins: 1800,
    rewardXp: 620,
    color: "#6fd6b0",
    description: "A sea serpent that rides the lightning. It hates the taste of iron.",
    drop: "storm-scale",
  },
  {
    id: "abyssal-kraken",
    name: "The Unlit One",
    kind: "kraken",
    hp: 9400,
    minLevel: 15,
    locations: ["deep-ocean"],
    rewardCoins: 4200,
    rewardXp: 1400,
    color: "#b48ce0",
    description: "A kraken from the lightless trench. Its ink writes the end of voyages.",
    drop: "kraken-ink",
  },
];

export const CREATURES_BY_ID: Record<GiantCreatureId, CreatureDef> = Object.fromEntries(
  GIANT_CREATURES.map((creature) => [creature.id, creature]),
) as Record<GiantCreatureId, CreatureDef>;

export interface MaterialDef {
  id: string;
  name: string;
  description: string;
  color: string;
  value: number;
}

export const MATERIALS: MaterialDef[] = [
  { id: "pearl", name: "Sea Pearl", description: "A smooth pearl from a sunken chest.", color: "#f6ecd2", value: 120 },
  { id: "coral-shard", name: "Coral Shard", description: "A living fragment of the deep reef.", color: "#ff8fc7", value: 90 },
  { id: "ancient-coin", name: "Ancient Coin", description: "Currency from a drowned kingdom.", color: "#d9b45a", value: 180 },
  { id: "star-shard", name: "Star Shard", description: "A splinter of fallen sky, still warm.", color: "#b9a8ff", value: 240 },
  { id: "shark-tooth", name: "Reaper Tooth", description: "A trophy from the Coral Reaper.", color: "#e8e1cf", value: 420 },
  { id: "whale-song", name: "Whale Song", description: "A glass vial that hums with an old melody.", color: "#8fc4ff", value: 520 },
  { id: "storm-scale", name: "Storm Scale", description: "A scale that crackles when held.", color: "#6fd6b0", value: 480 },
  { id: "kraken-ink", name: "Kraken Ink", description: "Ink that moves on its own in the dark.", color: "#b48ce0", value: 900 },
];

export const MATERIALS_BY_ID: Record<string, MaterialDef> = Object.fromEntries(
  MATERIALS.map((material) => [material.id, material]),
);

export interface FurnitureDef {
  id: string;
  name: string;
  description: string;
  price: number;
  type: "floor" | "wall" | "table" | "light" | "plant" | "art" | "tank";
  color: string;
  size: number;
}

export const FURNITURE: FurnitureDef[] = [
  { id: "driftwood-bench", name: "Driftwood Bench", description: "Salt-smoothed planks from a broken hull.", price: 0, type: "floor", color: "#8a6a48", size: 1 },
  { id: "shell-rug", name: "Shell Rug", description: "Woven from sun-bleached shells and kelp fibre.", price: 0, type: "floor", color: "#e8d5a8", size: 1 },
  { id: "rope-table", name: "Rope Table", description: "A sturdy table bound with tarred rope.", price: 420, type: "table", color: "#a97945", size: 1 },
  { id: "lantern-post", name: "Lantern Post", description: "A brass lantern that never gutters.", price: 560, type: "light", color: "#e8c06a", size: 1 },
  { id: "kelp-planter", name: "Kelp Planter", description: "A living planter of swaying kelp.", price: 640, type: "plant", color: "#4f8f7a", size: 1 },
  { id: "fish-painting", name: "Fish Painting", description: "A hand-painted portrait of a golden koi.", price: 880, type: "wall", color: "#ffd166", size: 1 },
  { id: "captains-chair", name: "Captain's Chair", description: "High-backed, brass-studded, slightly salty.", price: 1200, type: "floor", color: "#6b4a30", size: 1 },
  { id: "coral-lamp", name: "Coral Lamp", description: "A lamp grown, not built. It glows pink at night.", price: 1600, type: "light", color: "#ff8fc7", size: 1 },
  { id: "tide-clock", name: "Tide Clock", description: "Its hands follow the moon, not the hour.", price: 2100, type: "wall", color: "#9fe8ff", size: 1 },
  { id: "aquarium-tank", name: "Aquarium Tank", description: "A glass tank for your living trophies.", price: 3000, type: "tank", color: "#7ff7e8", size: 1 },
  { id: "trophy-shelf", name: "Trophy Shelf", description: "A shelf for the fish that made the stories.", price: 2600, type: "art", color: "#e8c06a", size: 1 },
  { id: "moon-window", name: "Moon Window", description: "A round window that shows the sea even indoors.", price: 3600, type: "wall", color: "#b9a8ff", size: 1 },
  { id: "shell-chandelier", name: "Shell Chandelier", description: "A chandelier of hanging shells and sea-glass.", price: 4200, type: "light", color: "#f6ecd2", size: 1 },
  { id: "abyss-couch", name: "Abyss Couch", description: "Deep blue cushions that seem to breathe.", price: 5400, type: "floor", color: "#3f4f8f", size: 1 },
];

export const FURNITURE_BY_ID: Record<string, FurnitureDef> = Object.fromEntries(
  FURNITURE.map((item) => [item.id, item]),
);

export const HOUSE_THEMES: Array<{ id: string; name: string; color: string; description: string }> = [
  { id: "driftwood", name: "Driftwood Cottage", color: "#8a6a48", description: "Warm planks, rope and lantern light." },
  { id: "shell", name: "Shell House", color: "#e8d5a8", description: "Curved walls of pale shell and pearl." },
  { id: "lantern", name: "Lantern Lodge", color: "#e8c06a", description: "Brass fittings and a hundred small lights." },
  { id: "abyss", name: "Abyss Retreat", color: "#3f4f8f", description: "Dark blue rooms lit by glowing fish." },
];

export const AQUARIUM_THEMES: Array<{ id: string; name: string; color: string; description: string }> = [
  { id: "reef", name: "Coral Reef", color: "#ff8fc7", description: "Pink coral and warm sand." },
  { id: "abyss", name: "Abyssal Trench", color: "#5f8dff", description: "Cold blue dark and drifting lights." },
  { id: "moonlit", name: "Moonlit Pool", color: "#b9a8ff", description: "Silver water under a permanent moon." },
];

export const EQUIPMENT = {
  diveGear: {
    id: "dive-gear",
    name: "Tide Diver's Kit",
    description: "A brass helmet and weighted boots. Lets you dive into deep water and open sunken chests.",
    price: 3200,
  },
  luckCharm: {
    id: "luck-charm",
    name: "Tidecaller Charm",
    description: "A moonstone charm that nudges the odds toward strange and beautiful mutations.",
    price: 7800,
  },
  sonar: {
    id: "sonar",
    name: "Wreck Sonar",
    description: "Pings the sea floor and lets you open sunken chests from farther away.",
    price: 2400,
  },
};

export const BOAT_PAINTS: Array<{ id: string; name: string; color: string; price: number }> = [
  { id: "tide-blue", name: "Tide Blue", color: "#4d8fc9", price: 0 },
  { id: "coral-red", name: "Coral Red", color: "#d07a55", price: 450 },
  { id: "kelp-green", name: "Kelp Green", color: "#4f8f7a", price: 450 },
  { id: "moon-white", name: "Moon White", color: "#e8e1cf", price: 900 },
  { id: "abyss-purple", name: "Abyss Purple", color: "#8a6fbf", price: 1200 },
];

export const BOAT_PAINTS_BY_ID: Record<string, { id: string; name: string; color: string; price: number }> =
  Object.fromEntries(BOAT_PAINTS.map((paint) => [paint.id, paint]));

export interface SecretQuestDef {
  id: string;
  title: string;
  description: string;
  target: number;
  rewardCoins: number;
  rewardXp: number;
  rewardCosmetic: string;
  npc: string;
}

export const SECRET_QUESTS: SecretQuestDef[] = [
  {
    id: "hermit-mutations",
    title: "The Hermit's Question",
    description: "The Tide Hermit wants to see two mutated fish. Any strange colour will do.",
    target: 2,
    rewardCoins: 1500,
    rewardXp: 600,
    rewardCosmetic: "hermit-charm",
    npc: "hermit",
  },
  {
    id: "hermit-treasures",
    title: "What the Sea Kept",
    description: "Bring the Tide Hermit five treasures recovered from the dark.",
    target: 5,
    rewardCoins: 2200,
    rewardXp: 800,
    rewardCosmetic: "diver-bandana",
    npc: "hermit",
  },
];

export interface CookingBuff {
  id: string;
  label: string;
  description: string;
  durationMs: number;
  energyBonus: number;
}

export const COOKING_BUFFS: Record<Rarity, CookingBuff | null> = {
  common: null,
  uncommon: null,
  rare: {
    id: "sprint",
    label: "Reef Sprint",
    description: "Move faster for 3 minutes.",
    durationMs: 180000,
    energyBonus: 6,
  },
  epic: {
    id: "luck",
    label: "Epic Fortune",
    description: "Better mutation odds for 4 minutes.",
    durationMs: 240000,
    energyBonus: 10,
  },
  legendary: {
    id: "feast",
    label: "Legendary Feast",
    description: "Bonus XP from catches for 5 minutes.",
    durationMs: 300000,
    energyBonus: 16,
  },
  mythical: {
    id: "tidecall",
    label: "Tidecall",
    description: "Rare fish are drawn to your line for 6 minutes.",
    durationMs: 360000,
    energyBonus: 22,
  },
  secret: {
    id: "celestial",
    label: "Celestial Blessing",
    description: "All bonuses at once for 8 minutes.",
    durationMs: 480000,
    energyBonus: 30,
  },
};

export function masteryLevel(xp: number): number {
  return Math.max(1, Math.min(20, 1 + Math.floor(Math.max(0, xp) / 600)));
}

export function masteryProgress(xp: number): { level: number; into: number; next: number } {
  const level = masteryLevel(xp);
  const base = (level - 1) * 600;
  return { level, into: Math.max(0, xp - base), next: 600 };
}

export function masteryValueBonus(xp: number): number {
  return 1 + (masteryLevel(xp) - 1) * 0.025;
}

export function currentSeason(now = Date.now()): "spring" | "summer" | "autumn" | "winter" {
  const month = new Date(now).getMonth();
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "summer";
  if (month >= 8 && month <= 10) return "autumn";
  return "winter";
}

export const SEASON_LABEL: Record<string, string> = {
  spring: "Spring Tide",
  summer: "High Summer",
  autumn: "Harvest Tide",
  winter: "Long Night",
};

export const TREASURE_KINDS = [
  { id: "chest", name: "Sunken Chest", coins: [90, 320], materials: ["pearl", "ancient-coin"], xp: 30 },
  { id: "crate", name: "Barnacled Crate", coins: [60, 220], materials: ["coral-shard", "pearl"], xp: 22 },
  { id: "urn", name: "Old Urn", coins: [140, 460], materials: ["ancient-coin", "star-shard"], xp: 40 },
] as const;
