import type {
  FishBody,
  FishPattern,
  FishSpecies,
  LocationId,
  Rarity,
  TimeOfDay,
  Weather,
} from "./types";

export const RARITY_ORDER: Rarity[] = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
  "mythical",
  "secret",
];

export const RARITY_META: Record<
  Rarity,
  {
    label: string;
    color: string;
    glow: string;
    weight: number;
    xp: number;
    priceMultiplier: number;
    difficulty: [number, number];
  }
> = {
  common: { label: "Common", color: "#b9c4b1", glow: "#8fa38c", weight: 52, xp: 8, priceMultiplier: 1, difficulty: [1, 2] },
  uncommon: { label: "Uncommon", color: "#72d38a", glow: "#3b9f5f", weight: 25, xp: 18, priceMultiplier: 1.7, difficulty: [2, 3] },
  rare: { label: "Rare", color: "#58b8ff", glow: "#2a76c9", weight: 13, xp: 42, priceMultiplier: 3.2, difficulty: [3, 4] },
  epic: { label: "Epic", color: "#c27dff", glow: "#7c3dcc", weight: 6, xp: 95, priceMultiplier: 7, difficulty: [4, 5] },
  legendary: { label: "Legendary", color: "#ffcc4d", glow: "#e08a1e", weight: 2.7, xp: 220, priceMultiplier: 16, difficulty: [5, 6] },
  mythical: { label: "Mythical", color: "#ff6fae", glow: "#c22969", weight: 1.1, xp: 500, priceMultiplier: 42, difficulty: [6, 7] },
  secret: { label: "Secret", color: "#7ff7e8", glow: "#24b9ac", weight: 0.2, xp: 1200, priceMultiplier: 100, difficulty: [7, 8] },
};

const NAMES: Record<Rarity, string[]> = {
  common: [
    "Sardine", "Bluegill", "Minnow", "Anchovy", "Sunfish", "Perch", "Carp", "Chub",
    "Smelt", "Herring", "Mackerel", "Guppy", "Tadpole", "Pond Loach", "Silver Bream",
    "Rainbow Trout", "Rock Bass", "Pumpkinseed", "Whitefish", "Shiner", "Dace",
    "Killifish", "Mudskipper", "Pufferling", "Sand Dab", "Sea Robin", "Ice Perch",
    "Snow Minnow", "River Snailfish", "Coral Damsel",
  ],
  uncommon: [
    "Clownfish", "Angelfish", "Butterflyfish", "Blue Tang", "Cleaner Wrasse", "Goby",
    "Flounder", "Mullet", "Sea Bream", "Catfish", "Largemouth Bass", "Northern Pike",
    "Grayling", "Arctic Char", "Arctic Cod", "Icefish", "Neon Tetra", "Rainbowfish",
    "Glassfish", "Hogfish", "Parrotfish", "Lionfish", "Barracuda", "Burbot",
    "Golden Shiner",
  ],
  rare: [
    "Swordfish", "Electric Eel", "Golden Koi", "Blue Marlin", "Yellowfin Tuna",
    "Sturgeon", "King Salmon", "Moonfish", "Lanternfish", "Viperfish",
    "Harlequin Tuskfish", "Mandarin Fish", "Moorish Idol", "Giant Grouper",
    "Wolffish", "Lake Trout", "Arapaima", "Payara", "Napoleon Wrasse", "Gulper Eel",
    "Flying Fish",
  ],
  epic: [
    "Oarfish", "Coelacanth", "Anglerfish", "Vampire Squid", "Ghost Shark",
    "Hammerhead Shark", "Whale Shark", "Goblin Shark", "Frilled Shark",
    "Glacier Pike", "Aurora Salmon", "Ember Eel", "Storm Ray", "Abyssal Stalker",
    "Moonlit Arowana", "Coral Dragonfish", "River Guardian",
  ],
  legendary: [
    "Ancient Sea Serpent", "Golden Leviathan", "Crystal Jellyfish", "Abyssal Dragon",
    "Celestial Whale", "Tempest Marlin", "Frost Wyrm", "Sunken Emperor",
    "Spirit Koi", "Volcanic Eel", "Lunar Sturgeon", "Deepsea Monarch",
  ],
  mythical: [
    "World Serpent", "Ocean's Heart", "Starfall Fish", "Chronofish",
    "Dreaming Leviathan", "Eclipse Ray", "Primordial Coelacanth", "Tidecaller",
  ],
  secret: [
    "Ghost of the Tides", "The First Fish", "Pixel Phantom", "Moonstone Spirit",
    "Developer Fish", "Atlantis Guardian",
  ],
};

const RARITY_BASE_PRICE: Record<Rarity, number> = {
  common: 14,
  uncommon: 40,
  rare: 130,
  epic: 520,
  legendary: 1900,
  mythical: 7600,
  secret: 22000,
};

const RARITY_WEIGHT: Record<Rarity, [number, number]> = {
  common: [0.08, 1.6],
  uncommon: [0.3, 4],
  rare: [2, 18],
  epic: [8, 65],
  legendary: [20, 180],
  mythical: [60, 420],
  secret: [100, 900],
};

const LOCATION_POOL: Record<Rarity, LocationId[]> = {
  common: ["sunny-shore", "sunny-shore", "coral-bay", "frostbite-lake", "mystic-river", "deep-ocean"],
  uncommon: ["sunny-shore", "coral-bay", "coral-bay", "frostbite-lake", "mystic-river", "deep-ocean"],
  rare: ["coral-bay", "frostbite-lake", "mystic-river", "deep-ocean"],
  epic: ["frostbite-lake", "mystic-river", "deep-ocean"],
  legendary: ["frostbite-lake", "mystic-river", "deep-ocean"],
  mythical: ["deep-ocean", "mystic-river"],
  secret: ["deep-ocean", "deep-ocean", "mystic-river"],
};

const BODY_POOL: FishBody[] = ["slim", "round", "long", "flat", "eel", "jelly", "serpent", "ray"];
const PATTERN_POOL: FishPattern[] = ["plain", "stripes", "spots", "scales", "glow", "gradient", "bands"];
const FIN_POOL: FishSpecies["fin"][] = ["fan", "forked", "round", "spiky", "ribbon"];

const PALETTES: Array<[string, string, string, string]> = [
  ["#3f6f8f", "#78b8c9", "#d7eef0", "#173549"],
  ["#6c7f3f", "#b2c66a", "#edf0c0", "#35421e"],
  ["#8c4b3d", "#d98a5a", "#ffe0b0", "#44221c"],
  ["#5d3e8e", "#a47bd6", "#efd6ff", "#2a1747"],
  ["#2f7b6d", "#64c9ad", "#d4fff0", "#154038"],
  ["#a04b7a", "#e58db4", "#ffe1ed", "#52203b"],
  ["#8a7a35", "#d9c55e", "#fff7c2", "#453b14"],
  ["#2d5f9e", "#6ba8e8", "#dcefff", "#132e56"],
  ["#7a352f", "#cf6558", "#ffd4c4", "#3d1815"],
  ["#3b6a4a", "#77b784", "#e1ffdc", "#173422"],
  ["#6b4a2f", "#bd8a54", "#ffe8c8", "#332012"],
  ["#3f3f68", "#8585c0", "#e2e2ff", "#1d1d36"],
  ["#a55b24", "#ed9f4d", "#fff0c0", "#50280c"],
  ["#357f9a", "#7fd3e2", "#ebffff", "#153e4b"],
  ["#7b3f86", "#c07cc9", "#ffe8ff", "#3d1842"],
  ["#69706f", "#b7c3be", "#f4fff9", "#303633"],
];

const BODY_BY_NAME: Record<string, FishBody> = {
  Sardine: "slim", Minnow: "slim", Anchovy: "slim", Herring: "slim", Smelt: "slim",
  Sunfish: "round", Bluegill: "round", Pumpkinseed: "round", Pufferling: "round",
  Carp: "round", Guppy: "round", Tadpole: "round", Swordfish: "long", Marlin: "long",
  "Blue Marlin": "long", "Yellowfin Tuna": "long", Barracuda: "long", Sturgeon: "long",
  Arapaima: "long", Oarfish: "serpent", "Electric Eel": "eel", "Gulper Eel": "eel",
  "Ember Eel": "eel", "Volcanic Eel": "eel", "Vampire Squid": "jelly",
  "Crystal Jellyfish": "jelly", "Ancient Sea Serpent": "serpent", "World Serpent": "serpent",
  "Golden Leviathan": "serpent", "Abyssal Dragon": "serpent", "Frost Wyrm": "serpent",
  "Dreaming Leviathan": "serpent", "Eclipse Ray": "ray", "Storm Ray": "ray",
  "Ghost Shark": "long", "Hammerhead Shark": "long", "Whale Shark": "long",
  "Goblin Shark": "long", "Frilled Shark": "eel", "Flounder": "flat", "Sand Dab": "flat",
  "Sea Robin": "flat", "Moonfish": "flat", "Moorish Idol": "flat",
  "Butterflyfish": "flat", "Angelfish": "flat", "Blue Tang": "flat",
};

const HABITAT_OVERRIDES: Record<string, LocationId[]> = {
  Sardine: ["sunny-shore", "coral-bay", "deep-ocean"],
  Clownfish: ["coral-bay"],
  Angelfish: ["coral-bay"],
  Butterflyfish: ["coral-bay"],
  "Blue Tang": ["coral-bay"],
  Parrotfish: ["coral-bay"],
  Lionfish: ["coral-bay"],
  "Coral Damsel": ["coral-bay"],
  "Golden Koi": ["mystic-river"],
  "Spirit Koi": ["mystic-river"],
  "Rainbow Trout": ["mystic-river", "frostbite-lake"],
  "Arctic Char": ["frostbite-lake"],
  Icefish: ["frostbite-lake"],
  "Snow Minnow": ["frostbite-lake"],
  "Ice Perch": ["frostbite-lake"],
  "Frost Wyrm": ["frostbite-lake"],
  "Aurora Salmon": ["frostbite-lake"],
  "Glacier Pike": ["frostbite-lake"],
  "Lake Trout": ["frostbite-lake"],
  Sturgeon: ["mystic-river", "frostbite-lake"],
  Catfish: ["mystic-river"],
  "Largemouth Bass": ["mystic-river", "sunny-shore"],
  "Northern Pike": ["mystic-river", "frostbite-lake"],
  Arapaima: ["mystic-river"],
  Payara: ["mystic-river"],
  "River Guardian": ["mystic-river"],
  "Moonlit Arowana": ["mystic-river"],
  Oarfish: ["deep-ocean"],
  Coelacanth: ["deep-ocean"],
  Anglerfish: ["deep-ocean"],
  "Ghost Shark": ["deep-ocean"],
  "Whale Shark": ["deep-ocean"],
  "Goblin Shark": ["deep-ocean"],
  "Frilled Shark": ["deep-ocean"],
  "Ancient Sea Serpent": ["deep-ocean"],
  "Golden Leviathan": ["deep-ocean"],
  "Crystal Jellyfish": ["deep-ocean"],
  "Celestial Whale": ["deep-ocean"],
  "Tempest Marlin": ["deep-ocean"],
  "World Serpent": ["deep-ocean"],
  "Ocean's Heart": ["deep-ocean"],
  "Starfall Fish": ["deep-ocean"],
  Chronofish: ["deep-ocean", "mystic-river"],
  "Eclipse Ray": ["deep-ocean"],
  "Primordial Coelacanth": ["deep-ocean"],
  Tidecaller: ["deep-ocean"],
  "Ghost of the Tides": ["deep-ocean"],
  "The First Fish": ["deep-ocean"],
  "Pixel Phantom": ["deep-ocean"],
  "Moonstone Spirit": ["deep-ocean"],
  "Developer Fish": ["deep-ocean"],
  "Atlantis Guardian": ["deep-ocean"],
};

const DESCRIPTION_STARTS = [
  "A shimmering regular of the shallows.",
  "Known for dancing between the reeds at dawn.",
  "Old sailors swear this one hums with the tide.",
  "Its scales catch the last light of the day.",
  "A curious wanderer with a taste for bright lures.",
  "The village kids tell stories about this catch.",
  "Rarely seen, but unforgettable when it appears.",
  "It carries the quiet magic of the deep water.",
];

function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function pick<T>(pool: T[], h: number, shift: number): T {
  return pool[(h >>> shift) % pool.length];
}

const TIME_POOL: TimeOfDay[][] = [
  ["morning", "afternoon"],
  ["afternoon", "evening"],
  ["evening", "night"],
  ["morning", "night"],
  ["morning", "afternoon", "evening"],
];

const WEATHER_POOL: Weather[][] = [
  ["sunny", "cloudy"],
  ["sunny", "rainy"],
  ["cloudy", "foggy"],
  ["rainy", "stormy"],
  ["sunny", "cloudy", "rainy"],
];

function buildSpecies(rarity: Rarity, name: string, index: number): FishSpecies {
  const id = slugify(name);
  const h = hashString(id);
  const body = BODY_BY_NAME[name] ?? pick(BODY_POOL, h, 3);
  const pattern = pick(PATTERN_POOL, h, 7);
  const [minWeight, maxWeight] = RARITY_WEIGHT[rarity];
  const weightScale = 0.7 + ((h >>> 11) % 100) / 100;
  const min = +(minWeight * weightScale).toFixed(2);
  const max = +(maxWeight * weightScale).toFixed(2);
  const lenScale = body === "serpent" || body === "eel" || body === "long" ? 1.65 : body === "round" || body === "jelly" ? 0.75 : 1;
  const baseLength = Math.max(5, Math.round((6 + Math.pow(maxWeight, 0.5) * 9) * lenScale));
  const [diffMin, diffMax] = RARITY_META[rarity].difficulty;
  const difficulty = diffMin + ((h >>> 17) % (diffMax - diffMin + 1));
  const habitats = HABITAT_OVERRIDES[name] ?? [pick(LOCATION_POOL[rarity], h, 5)];
  const weather = pick(WEATHER_POOL, h, 9);
  const time = pick(TIME_POOL, h, 13);
  const palette = PALETTES[(h + index) % PALETTES.length];
  const price = Math.round(RARITY_BASE_PRICE[rarity] * (0.75 + ((h >>> 21) % 60) / 100));
  const descStart = DESCRIPTION_STARTS[(h >>> 2) % DESCRIPTION_STARTS.length];
  const description = `${descStart} ${rarity === "common" ? "A dependable catch for any angler." : rarity === "uncommon" ? "Its colours are prized by collectors." : rarity === "rare" ? "Only appears when conditions align." : rarity === "epic" ? "The water grows still when it nears." : rarity === "legendary" ? "A living legend of the Pixel Tides." : rarity === "mythical" ? "Few have ever seen one, fewer still have landed one." : "The sea keeps this secret for a reason."}`;

  return {
    id,
    name,
    rarity,
    basePrice: price,
    minWeight: min,
    maxWeight: max,
    minLength: baseLength,
    maxLength: Math.round(baseLength * 1.55),
    habitats,
    weather,
    time,
    difficulty,
    description,
    body,
    pattern,
    colors: palette,
    fin: pick(FIN_POOL, h, 23),
  };
}

export const FISH: FishSpecies[] = [
  ...RARITY_ORDER.flatMap((rarity) => NAMES[rarity].map((name, index) => buildSpecies(rarity, name, index))),
  ...([
    ["rare", "Cave Lanternfish"],
    ["epic", "Sunken Admiral"],
    ["legendary", "Gull's Rest Spirit"],
    ["mythical", "Wreckbound Coelacanth"],
  ] as Array<[Rarity, string]>).map(([rarity, name], index) => {
    const base = buildSpecies(rarity, name, index);
    return {
      ...base,
      habitats: ["deep-ocean"] as LocationId[],
      secretSpot: true,
      description: `${base.description} This one only gathers around the hidden island of Gull's Rest.`,
    };
  }),
];

export const FISH_BY_ID: Record<string, FishSpecies> = Object.fromEntries(
  FISH.map((fish) => [fish.id, fish]),
);

export const RARITY_RANK: Record<Rarity, number> = {
  common: 1,
  uncommon: 2,
  rare: 3,
  epic: 4,
  legendary: 5,
  mythical: 6,
  secret: 7,
};

export function getFish(id: string): FishSpecies {
  return FISH_BY_ID[id] ?? FISH[0];
}

export function fishForLocation(location: LocationId): FishSpecies[] {
  return FISH.filter((fish) => fish.habitats.includes(location));
}

export function timeOfDayFromMinutes(minutes: number): TimeOfDay {
  const m = ((minutes % 1440) + 1440) % 1440;
  if (m >= 5 * 60 && m < 11 * 60) return "morning";
  if (m >= 11 * 60 && m < 17 * 60) return "afternoon";
  if (m >= 17 * 60 && m < 21 * 60) return "evening";
  return "night";
}

export function rarityScore(rarity: Rarity): number {
  return RARITY_RANK[rarity];
}

export function rarityLabel(rarity: Rarity): string {
  return RARITY_META[rarity].label;
}
