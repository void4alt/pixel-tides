import type { LocationId, Rarity, Weather } from "./types";

export interface RodDef {
  id: string;
  name: string;
  description: string;
  price: number;
  castDistance: number;
  luck: number;
  zoneSize: number;
  reelPower: number;
  durability: number;
  rarityBoost: number;
  color: string;
}

export const RODS: RodDef[] = [
  {
    id: "wooden",
    name: "Driftwood Rod",
    description: "A humble rod carved from salt-washed driftwood. It has never let a village kid down.",
    price: 0,
    castDistance: 150,
    luck: 1,
    zoneSize: 0.29,
    reelPower: 1,
    durability: 100,
    rarityBoost: 0,
    color: "#a97945",
  },
  {
    id: "fiberglass",
    name: "Fiberglass Rod",
    description: "A springy starter rod with a smooth reel. A fine upgrade for a working angler.",
    price: 650,
    castDistance: 200,
    luck: 1.12,
    zoneSize: 0.27,
    reelPower: 1.08,
    durability: 160,
    rarityBoost: 0.02,
    color: "#73c6d8",
  },
  {
    id: "carbon",
    name: "Carbon Rod",
    description: "Light, fast, and precise. Carbon construction makes long casts feel effortless.",
    price: 3200,
    castDistance: 255,
    luck: 1.3,
    zoneSize: 0.245,
    reelPower: 1.18,
    durability: 240,
    rarityBoost: 0.05,
    color: "#4d5668",
  },
  {
    id: "golden",
    name: "Golden Rod",
    description: "Gilded fittings and a whisper-quiet reel. Luck seems to follow its gleaming tip.",
    price: 14500,
    castDistance: 310,
    luck: 1.6,
    zoneSize: 0.225,
    reelPower: 1.28,
    durability: 360,
    rarityBoost: 0.1,
    color: "#e8b73d",
  },
  {
    id: "mythical",
    name: "Tidecaller Rod",
    description: "Forged from moonstone and sea-glass. The ocean itself leans in when you cast.",
    price: 68000,
    castDistance: 380,
    luck: 2.1,
    zoneSize: 0.2,
    reelPower: 1.4,
    durability: 520,
    rarityBoost: 0.18,
    color: "#78e6d5",
  },
  {
    id: "coral",
    name: "Living Coral Rod",
    description: "Grown around a reef spine. It flexes like a living thing and sings when a rare fish nears.",
    price: 21000,
    castDistance: 340,
    luck: 1.85,
    zoneSize: 0.215,
    reelPower: 1.34,
    durability: 430,
    rarityBoost: 0.14,
    color: "#ff8fc7",
  },
  {
    id: "abyssal",
    name: "Abyss Harpoon Rod",
    description: "A deep-trench relic of black metal. It pulls monsters toward the light.",
    price: 96000,
    castDistance: 420,
    luck: 2.4,
    zoneSize: 0.19,
    reelPower: 1.5,
    durability: 640,
    rarityBoost: 0.22,
    color: "#b48ce0",
  },
];

export const RODS_BY_ID: Record<string, RodDef> = Object.fromEntries(RODS.map((rod) => [rod.id, rod]));

export interface BaitDef {
  id: string;
  name: string;
  description: string;
  price: number;
  bundle: number;
  rarityBoost: number;
  biteSpeed: number;
  mutationBoost?: number;
  color: string;
  levelRequired: number;
}

export const BAITS: BaitDef[] = [
  {
    id: "worm",
    name: "Garden Worm",
    description: "A wriggly classic. Reliable, cheap, and loved by nearly every fish.",
    price: 20,
    bundle: 10,
    rarityBoost: 0,
    biteSpeed: 1,
    color: "#d47a62",
    levelRequired: 1,
  },
  {
    id: "shrimp",
    name: "Fresh Shrimp",
    description: "Salty and irresistible. Uncommon fish take notice.",
    price: 120,
    bundle: 10,
    rarityBoost: 0.06,
    biteSpeed: 1.15,
    color: "#f1a47f",
    levelRequired: 4,
  },
  {
    id: "glow",
    name: "Glow Larva",
    description: "Bioluminescent bait that shines beneath the waves. Attracts rare and epic fish.",
    price: 600,
    bundle: 8,
    rarityBoost: 0.15,
    biteSpeed: 1.25,
    color: "#7ff7d4",
    levelRequired: 8,
  },
  {
    id: "storm",
    name: "Storm Krill",
    description: "Harvested in rough weather. Legendary fish find the scent impossible to resist.",
    price: 2400,
    bundle: 6,
    rarityBoost: 0.3,
    biteSpeed: 1.4,
    color: "#9c8cff",
    levelRequired: 12,
  },
  {
    id: "moon",
    name: "Moon Pearl",
    description: "A tiny pearl humming with tidal magic. Mythical fish may answer its call.",
    price: 9800,
    bundle: 4,
    rarityBoost: 0.55,
    biteSpeed: 1.55,
    color: "#ffe6a1",
    levelRequired: 18,
  },
  {
    id: "starfall",
    name: "Starfall Dust",
    description: "Ground meteor dust that makes scales shimmer in colours that do not exist.",
    price: 4200,
    bundle: 5,
    rarityBoost: 0.38,
    biteSpeed: 1.3,
    mutationBoost: 0.09,
    color: "#b9a8ff",
    levelRequired: 14,
  },
];

export const BAITS_BY_ID: Record<string, BaitDef> = Object.fromEntries(BAITS.map((bait) => [bait.id, bait]));

export interface LocationDef {
  id: LocationId;
  name: string;
  shortName: string;
  description: string;
  unlockLevel: number;
  requiresBoat: boolean;
  waterName: string;
  weatherBias: Weather[];
  accent: string;
  ambient: "waves" | "reef" | "snow" | "forest" | "deep";
}

export const LOCATIONS: LocationDef[] = [
  {
    id: "sunny-shore",
    name: "Sunny Shore",
    shortName: "Shore",
    description: "A warm beginner beach with wooden docks, tide pools, and friendly locals.",
    unlockLevel: 1,
    requiresBoat: false,
    waterName: "Sunlit Shallows",
    weatherBias: ["sunny", "cloudy"],
    accent: "#f2c879",
    ambient: "waves",
  },
  {
    id: "coral-bay",
    name: "Coral Bay",
    shortName: "Coral",
    description: "A jewel-toned reef alive with tropical fish. Bring a long cast and a steady reel.",
    unlockLevel: 4,
    requiresBoat: false,
    waterName: "Coral Gardens",
    weatherBias: ["sunny", "rainy"],
    accent: "#ff8fc7",
    ambient: "reef",
  },
  {
    id: "frostbite-lake",
    name: "Frostbite Lake",
    shortName: "Frost",
    description: "A silent alpine lake beneath the northern lights. Ice fishing at its finest.",
    unlockLevel: 7,
    requiresBoat: false,
    waterName: "Glacier Lake",
    weatherBias: ["foggy", "cloudy", "stormy"],
    accent: "#aee8ff",
    ambient: "snow",
  },
  {
    id: "mystic-river",
    name: "Mystic Forest River",
    shortName: "Mystic",
    description: "An ancient forest where the river glows at dusk and koi whisper old secrets.",
    unlockLevel: 10,
    requiresBoat: false,
    waterName: "Whispering River",
    weatherBias: ["foggy", "rainy", "cloudy"],
    accent: "#9be7a8",
    ambient: "forest",
  },
  {
    id: "deep-ocean",
    name: "The Deep Ocean",
    shortName: "Deep",
    description: "Open water beyond the horizon. Only a sturdy boat and a brave angler may enter.",
    unlockLevel: 15,
    requiresBoat: true,
    waterName: "Abyssal Blue",
    weatherBias: ["stormy", "foggy", "rainy"],
    accent: "#5f8dff",
    ambient: "deep",
  },
];

export const LOCATIONS_BY_ID: Record<LocationId, LocationDef> = Object.fromEntries(
  LOCATIONS.map((location) => [location.id, location]),
) as Record<LocationId, LocationDef>;

export const BOAT = {
  id: "skiff",
  name: "Tide Skiff",
  description: "A sturdy little boat that unlocks travel to the Deep Ocean and lets you fish far from shore.",
  price: 9000,
};

export interface CosmeticDef {
  id: string;
  name: string;
  description: string;
  price: number;
  type: "hat" | "outfit";
  value: string;
  season?: "spring" | "summer" | "autumn" | "winter";
  rewardOnly?: boolean;
}

export const COSMETICS: CosmeticDef[] = [
  { id: "straw-hat", name: "Straw Hat", description: "A sun-bleached fisherman's hat.", price: 220, type: "hat", value: "straw" },
  { id: "captain-hat", name: "Captain's Hat", description: "For the angler who gives the orders.", price: 1400, type: "hat", value: "captain" },
  { id: "flower-crown", name: "Flower Crown", description: "A crown of coral blossoms.", price: 800, type: "hat", value: "flower" },
  { id: "bucket-hat", name: "Bucket Hat", description: "Practical. Cozy. Slightly damp.", price: 320, type: "hat", value: "bucket" },
  { id: "sunset-shirt", name: "Sunset Shirt", description: "Warm colours for golden-hour casts.", price: 900, type: "outfit", value: "#e8794a" },
  { id: "kelp-jacket", name: "Kelp Jacket", description: "Woven sea-green cloth with pearl buttons.", price: 1200, type: "outfit", value: "#3f8f73" },
  { id: "moon-cloak", name: "Moon Cloak", description: "A shimmering cloak for night fishing.", price: 3400, type: "outfit", value: "#6b6ab5" },
  { id: "summer-sun", name: "Sun Festival Shirt", description: "Dyed in the colours of a summer festival.", price: 2200, type: "outfit", value: "#e8794a", season: "summer" },
  { id: "autumn-ember", name: "Ember Harvest Coat", description: "Rust and gold cloth woven for the harvest tide.", price: 2400, type: "outfit", value: "#b45b3e", season: "autumn" },
  { id: "winter-frost", name: "Frostlight Parka", description: "Pale blue cloth that never feels cold.", price: 2600, type: "outfit", value: "#9fd7e8", season: "winter" },
  { id: "spring-bloom", name: "Bloom Tide Vest", description: "Soft pink cloth scattered with embroidered petals.", price: 2200, type: "outfit", value: "#c98fb0", season: "spring" },
  { id: "hermit-charm", name: "Hermit's Charm", description: "A woven charm given by the Tide Hermit. It smells of old rope and rain.", price: 0, type: "outfit", value: "#d8c08a", rewardOnly: true },
  { id: "diver-bandana", name: "Diver's Bandana", description: "A faded bandana recovered from a sunken chest.", price: 0, type: "outfit", value: "#3f8f9f", rewardOnly: true },
];

export const COSMETICS_BY_ID: Record<string, CosmeticDef> = Object.fromEntries(
  COSMETICS.map((cosmetic) => [cosmetic.id, cosmetic]),
);

export function locationUnlocked(level: number, boatOwned: boolean, location: LocationDef): boolean {
  return level >= location.unlockLevel && (!location.requiresBoat || boatOwned);
}

export function rarityBoostFor(rodId: string, baitId: string): number {
  const rod = RODS_BY_ID[rodId] ?? RODS[0];
  const bait = BAITS_BY_ID[baitId];
  return rod.rarityBoost + (bait?.rarityBoost ?? 0);
}

export function rarityMultiplier(rarity: Rarity): number {
  return (
    {
      common: 1,
      uncommon: 1.7,
      rare: 3.2,
      epic: 7,
      legendary: 16,
      mythical: 42,
      secret: 100,
    } as Record<Rarity, number>
  )[rarity];
}

export interface CookingRecipe {
  id: string;
  name: string;
  rarity: Rarity;
  energy: number;
  valueMultiplier: number;
  description: string;
}

export const COOKING_RECIPES: Record<Rarity, CookingRecipe> = {
  common: {
    id: "grilled-catch",
    name: "Grilled Catch",
    rarity: "common",
    energy: 14,
    valueMultiplier: 1.6,
    description: "Salted over open flame. Simple, warm, and honest.",
  },
  uncommon: {
    id: "seared-fillet",
    name: "Seared Fillet",
    rarity: "uncommon",
    energy: 20,
    valueMultiplier: 1.8,
    description: "Crisp edges, tender centre, a squeeze of lemon.",
  },
  rare: {
    id: "roasted-delicacy",
    name: "Roasted Delicacy",
    rarity: "rare",
    energy: 30,
    valueMultiplier: 2.1,
    description: "A reef fish roasted with herbs and a little butter.",
  },
  epic: {
    id: "golden-fish-steak",
    name: "Golden Fish Steak",
    rarity: "epic",
    energy: 44,
    valueMultiplier: 2.5,
    description: "Cut thick, glazed in honey, seared until golden.",
  },
  legendary: {
    id: "legendary-sea-feast",
    name: "Legendary Sea Feast",
    rarity: "legendary",
    energy: 62,
    valueMultiplier: 3.1,
    description: "A feast worthy of a harbour festival.",
  },
  mythical: {
    id: "mythic-tide-banquet",
    name: "Mythic Tide Banquet",
    rarity: "mythical",
    energy: 82,
    valueMultiplier: 3.6,
    description: "Steam curls into shapes of old sea stories.",
  },
  secret: {
    id: "celestial-platter",
    name: "Celestial Platter",
    rarity: "secret",
    energy: 100,
    valueMultiplier: 4.2,
    description: "It glows faintly. The tide itself seems to lean closer.",
  },
};

export function recipeForRarity(rarity: Rarity): CookingRecipe {
  return COOKING_RECIPES[rarity] ?? COOKING_RECIPES.common;
}

export function cookedFishValue(value: number, rarity: Rarity): number {
  return Math.max(1, Math.round(value * recipeForRarity(rarity).valueMultiplier));
}

export function cookedFishEnergy(rarity: Rarity): number {
  return recipeForRarity(rarity).energy;
}
