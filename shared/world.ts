import type { LocationId } from "./types";

export const TILE = 16;
export const MAP_W = 100;
export const MAP_H = 75;

export const Tile = {
  Water: 0,
  Sand: 1,
  Grass: 2,
  Path: 3,
  Dock: 4,
  Stone: 5,
  Snow: 6,
  Ice: 7,
  DeepWater: 8,
  Shallow: 9,
  Coral: 10,
  Rock: 11,
  Bridge: 12,
  BoatDeck: 13,
} as const;

export type TileId = (typeof Tile)[keyof typeof Tile];

const WALKABLE = new Set<number>([
  Tile.Sand,
  Tile.Grass,
  Tile.Path,
  Tile.Dock,
  Tile.Stone,
  Tile.Snow,
  Tile.Ice,
  Tile.Bridge,
  Tile.BoatDeck,
]);

const WATER = new Set<number>([Tile.Water, Tile.DeepWater, Tile.Shallow, Tile.Coral]);

export interface NPCDef {
  id: string;
  name: string;
  x: number;
  y: number;
  role: string;
  dialog: string;
  shop?: "rods" | "baits" | "clothing" | "boat";
  secret?: boolean;
  nightOnly?: boolean;
}

export interface WorldMap {
  location: LocationId;
  width: number;
  height: number;
  tiles: Uint8Array;
  spawn: { x: number; y: number };
  npcs: NPCDef[];
  campfires: Array<{ x: number; y: number }>;
  dockCount: number;
  secretIsland?: { x: number; y: number; radius: number; name: string };
  underwater?: Array<{ x: number; y: number; kind: "cave" | "wreck" | "reef" }>;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

class MapBuilder {
  tiles: Uint8Array;
  constructor() {
    this.tiles = new Uint8Array(MAP_W * MAP_H);
  }
  set(x: number, y: number, tile: number) {
    if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H) this.tiles[y * MAP_W + x] = tile;
  }
  get(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return Tile.DeepWater;
    return this.tiles[y * MAP_W + x];
  }
  fill(tile: number) {
    this.tiles.fill(tile);
  }
  rect(x0: number, y0: number, x1: number, y1: number, tile: number) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, tile);
  }
  line(x0: number, y0: number, x1: number, y1: number, tile: number, width = 1) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= steps; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / steps);
      const y = Math.round(y0 + ((y1 - y0) * i) / steps);
      for (let oy = -Math.floor(width / 2); oy <= Math.floor(width / 2); oy++) {
        for (let ox = -Math.floor(width / 2); ox <= Math.floor(width / 2); ox++) this.set(x + ox, y + oy, tile);
      }
    }
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, tile: number) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
        if (d <= 1) this.set(x, y, tile);
      }
    }
  }
  edgeToTile(from: number, to: number) {
    for (let y = 1; y < MAP_H - 1; y++) {
      for (let x = 1; x < MAP_W - 1; x++) {
        if (this.get(x, y) !== from) continue;
        if (
          this.get(x + 1, y) === to || this.get(x - 1, y) === to ||
          this.get(x, y + 1) === to || this.get(x, y - 1) === to
        ) {
          this.set(x, y, to);
        }
      }
    }
  }
}

function sunnyShore(): WorldMap {
  const b = new MapBuilder();
  const rand = mulberry32(hash("sunny-shore"));
  for (let x = 0; x < MAP_W; x++) {
    const coast = 39 + Math.sin(x * 0.13) * 2.4 + Math.sin(x * 0.31 + 1.4) * 1.2;
    for (let y = 0; y < MAP_H; y++) {
      if (y < coast - 6) b.set(x, y, Tile.Grass);
      else if (y < coast) b.set(x, y, Tile.Sand);
      else if (y < coast + 4) b.set(x, y, Tile.Shallow);
      else b.set(x, y, Tile.Water);
    }
  }
  b.rect(0, 0, MAP_W - 1, 2, Tile.Grass);
  b.line(42, 26, 42, 39, Tile.Path, 2);
  b.line(20, 27, 78, 27, Tile.Path, 2);
  b.line(31, 28, 31, 39, Tile.Path, 1);
  b.line(69, 28, 69, 39, Tile.Path, 1);
  b.rect(28, 37, 34, 56, Tile.Dock);
  b.rect(66, 37, 71, 49, Tile.Dock);
  b.rect(49, 39, 52, 46, Tile.Dock);
  b.rect(40, 37, 45, 54, Tile.Dock);
  b.rect(28, 37, 34, 38, Tile.Sand);
  b.rect(66, 37, 71, 38, Tile.Sand);
  for (let y = 37; y <= 56; y += 3) {
    b.set(28, y, Tile.Dock);
    b.set(34, y, Tile.Dock);
  }
  b.ellipse(84, 49, 3, 2, Tile.Rock);
  b.ellipse(14, 51, 2, 3, Tile.Rock);
  for (let i = 0; i < 32; i++) {
    const x = 4 + Math.floor(rand() * 90);
    const y = 4 + Math.floor(rand() * 31);
    if (b.get(x, y) === Tile.Grass) b.set(x, y, rand() > 0.72 ? Tile.Stone : Tile.Grass);
  }
  return {
    location: "sunny-shore",
    width: MAP_W,
    height: MAP_H,
    tiles: b.tiles,
    spawn: { x: 42 * TILE + 8, y: 36 * TILE },
    dockCount: 3,
    campfires: [
      { x: 44 * TILE, y: 34 * TILE },
      { x: 60 * TILE, y: 34 * TILE },
    ],
    npcs: [
      {
        id: "mira",
        name: "Mira",
        x: 30 * TILE,
        y: 29 * TILE,
        role: "Baitkeeper",
        dialog: "The tide is gentle today. A garden worm and a patient heart will take you far.",
        shop: "baits",
      },
      {
        id: "finn",
        name: "Old Finn",
        x: 70 * TILE,
        y: 30 * TILE,
        role: "Rodmaker",
        dialog: "A rod is more than wood and line. Treat it well and it will remember the sea for you.",
        shop: "rods",
      },
      {
        id: "pearl",
        name: "Pearl",
        x: 46 * TILE,
        y: 30 * TILE,
        role: "Village Tailor",
        dialog: "Every great angler needs a hat that can survive a splash or two.",
        shop: "clothing",
      },
      {
        id: "captain",
        name: "Captain Rook",
        x: 62 * TILE,
        y: 35 * TILE,
        role: "Harbourmaster",
        dialog: "The Deep Ocean is no pond. Bring a skiff, a strong rod, and a stronger nerve.",
        shop: "boat",
      },
    ],
  };
}

function coralBay(): WorldMap {
  const b = new MapBuilder();
  const rand = mulberry32(hash("coral-bay"));
  b.fill(Tile.Water);
  for (let x = 0; x < MAP_W; x++) {
    const coast = 21 + Math.sin(x * 0.17 + 0.6) * 2 + Math.sin(x * 0.41) * 1.2;
    for (let y = 0; y < MAP_H; y++) {
      if (y < coast - 4) b.set(x, y, y < 10 ? Tile.Grass : Tile.Sand);
      else if (y < coast) b.set(x, y, Tile.Sand);
      else if (y < coast + 3) b.set(x, y, Tile.Shallow);
    }
  }
  b.ellipse(74, 27, 13, 8, Tile.Sand);
  b.ellipse(74, 26, 11, 6, Tile.Grass);
  b.ellipse(74, 27, 14, 9, Tile.Shallow);
  b.ellipse(74, 27, 13, 8, Tile.Sand);
  b.ellipse(74, 26, 11, 6, Tile.Grass);
  b.line(34, 16, 34, 20, Tile.Path, 2);
  b.line(18, 16, 58, 16, Tile.Path, 2);
  b.rect(20, 20, 25, 39, Tile.Dock);
  b.rect(46, 20, 51, 34, Tile.Dock);
  b.rect(56, 23, 65, 26, Tile.Dock);
  b.rect(56, 24, 65, 27, Tile.Dock);
  b.line(65, 25, 68, 25, Tile.Dock, 1);
  b.ellipse(86, 50, 5, 3, Tile.Coral);
  b.ellipse(18, 48, 6, 4, Tile.Coral);
  b.ellipse(38, 55, 9, 5, Tile.Coral);
  b.ellipse(58, 47, 4, 3, Tile.Coral);
  b.ellipse(88, 68, 3, 2, Tile.Rock);
  for (let i = 0; i < 20; i++) {
    const x = 3 + Math.floor(rand() * 93);
    const y = 3 + Math.floor(rand() * 16);
    if (b.get(x, y) === Tile.Grass) b.set(x, y, rand() > 0.7 ? Tile.Stone : Tile.Grass);
  }
  return {
    location: "coral-bay",
    width: MAP_W,
    height: MAP_H,
    tiles: b.tiles,
    spawn: { x: 34 * TILE, y: 15 * TILE },
    dockCount: 3,
    campfires: [
      { x: 38 * TILE, y: 14 * TILE },
      { x: 56 * TILE, y: 18 * TILE },
    ],
    npcs: [
      {
        id: "naia",
        name: "Naia",
        x: 24 * TILE,
        y: 18 * TILE,
        role: "Reef Guide",
        dialog: "The reef rewards a long cast. Watch the coral shadows — something bright always follows.",
        shop: "baits",
      },
      {
        id: "kito",
        name: "Kito",
        x: 48 * TILE,
        y: 18 * TILE,
        role: "Pearl Diver",
        dialog: "I saw a golden tail down there once. Nobody believes me. Maybe you will.",
        shop: "rods",
      },
      {
        id: "sunny",
        name: "Sunny",
        x: 72 * TILE,
        y: 24 * TILE,
        role: "Island Trader",
        dialog: "Coral Bay is best at sunrise. The fish wear the colours of the sky.",
        shop: "clothing",
      },
    ],
  };
}

function frostbiteLake(): WorldMap {
  const b = new MapBuilder();
  const rand = mulberry32(hash("frostbite-lake"));
  b.fill(Tile.Snow);
  b.ellipse(53, 37, 33, 20, Tile.Ice);
  b.ellipse(53, 37, 30, 17, Tile.Water);
  b.ellipse(53, 37, 28, 15, Tile.DeepWater);
  b.ellipse(30, 28, 8, 4, Tile.Ice);
  b.ellipse(75, 45, 7, 4, Tile.Ice);
  b.ellipse(40, 50, 5, 3, Tile.Ice);
  b.ellipse(66, 27, 5, 3, Tile.Ice);
  b.line(50, 62, 50, 54, Tile.Path, 2);
  b.line(20, 61, 80, 61, Tile.Path, 2);
  b.rect(47, 52, 53, 61, Tile.Dock);
  b.rect(24, 57, 28, 61, Tile.Dock);
  b.rect(74, 57, 78, 61, Tile.Dock);
  b.ellipse(53, 15, 4, 2, Tile.Rock);
  b.ellipse(86, 30, 3, 2, Tile.Rock);
  b.ellipse(13, 42, 3, 2, Tile.Rock);
  for (let i = 0; i < 45; i++) {
    const x = 3 + Math.floor(rand() * 93);
    const y = 3 + Math.floor(rand() * 69);
    if (b.get(x, y) === Tile.Snow) b.set(x, y, rand() > 0.78 ? Tile.Rock : Tile.Snow);
  }
  return {
    location: "frostbite-lake",
    width: MAP_W,
    height: MAP_H,
    tiles: b.tiles,
    spawn: { x: 50 * TILE, y: 64 * TILE },
    dockCount: 3,
    campfires: [{ x: 46 * TILE, y: 63 * TILE }],
    npcs: [
      {
        id: "bryn",
        name: "Bryn",
        x: 43 * TILE,
        y: 64 * TILE,
        role: "Ice Fisher",
        dialog: "Listen. Under the ice, the lake is singing. The old fish answer if you are quiet enough.",
        shop: "baits",
      },
      {
        id: "elowen",
        name: "Elowen",
        x: 61 * TILE,
        y: 64 * TILE,
        role: "Aurora Watcher",
        dialog: "The northern lights are early tonight. A good omen for rare catches.",
        shop: "rods",
      },
      {
        id: "orrin",
        name: "Orrin",
        x: 56 * TILE,
        y: 59 * TILE,
        role: "Warm Cloth Merchant",
        dialog: "Frostbite bites harder than any fish. Take a warm cloak, friend.",
        shop: "clothing",
      },
    ],
  };
}

function mysticRiver(): WorldMap {
  const b = new MapBuilder();
  const rand = mulberry32(hash("mystic-river"));
  b.fill(Tile.Grass);
  for (let y = 0; y < MAP_H; y++) {
    const cx = 48 + Math.sin(y * 0.085) * 13 + Math.sin(y * 0.21 + 1.2) * 4;
    const width = 5 + Math.sin(y * 0.13) * 1.4;
    for (let x = 0; x < MAP_W; x++) {
      const d = Math.abs(x - cx);
      if (d < width - 2) b.set(x, y, Tile.DeepWater);
      else if (d < width) b.set(x, y, Tile.Water);
      else if (d < width + 2) b.set(x, y, Tile.Shallow);
    }
  }
  b.ellipse(74, 24, 8, 5, Tile.Shallow);
  b.ellipse(74, 24, 6, 4, Tile.Water);
  b.ellipse(74, 24, 4, 3, Tile.DeepWater);
  b.line(20, 64, 80, 64, Tile.Path, 2);
  b.line(50, 10, 50, 64, Tile.Path, 1);
  b.line(48, 30, 56, 30, Tile.Path, 1);
  b.rect(45, 29, 51, 32, Tile.Bridge);
  b.rect(47, 50, 53, 55, Tile.Dock);
  b.rect(70, 28, 78, 31, Tile.Dock);
  b.line(48, 55, 48, 64, Tile.Path, 1);
  b.line(74, 31, 74, 64, Tile.Path, 1);
  b.ellipse(20, 20, 5, 4, Tile.Stone);
  b.ellipse(86, 52, 4, 3, Tile.Stone);
  b.ellipse(35, 45, 3, 2, Tile.Stone);
  for (let i = 0; i < 40; i++) {
    const x = 3 + Math.floor(rand() * 93);
    const y = 3 + Math.floor(rand() * 69);
    if (b.get(x, y) === Tile.Grass) b.set(x, y, rand() > 0.68 ? Tile.Stone : Tile.Grass);
  }
  return {
    location: "mystic-river",
    width: MAP_W,
    height: MAP_H,
    tiles: b.tiles,
    spawn: { x: 34 * TILE, y: 66 * TILE },
    dockCount: 2,
    campfires: [
      { x: 40 * TILE, y: 62 * TILE },
      { x: 72 * TILE, y: 35 * TILE },
    ],
    npcs: [
      {
        id: "rowan",
        name: "Rowan",
        x: 37 * TILE,
        y: 62 * TILE,
        role: "River Hermit",
        dialog: "The river remembers every cast. Make yours a kind one.",
        shop: "rods",
      },
      {
        id: "lily",
        name: "Lily",
        x: 76 * TILE,
        y: 32 * TILE,
        role: "Pond Witch",
        dialog: "Moon pearls are not sold in shops, child. But I know where the moon fish sleep.",
        shop: "baits",
      },
      {
        id: "ash",
        name: "Ash",
        x: 28 * TILE,
        y: 62 * TILE,
        role: "Wandering Tailor",
        dialog: "Cloth dyed in river light never fades. Would you like to see?",
        shop: "clothing",
      },
    ],
  };
}

function deepOcean(): WorldMap {
  const b = new MapBuilder();
  const rand = mulberry32(hash("deep-ocean"));
  b.fill(Tile.DeepWater);
  b.rect(38, 53, 62, 70, Tile.BoatDeck);
  b.rect(42, 48, 58, 53, Tile.BoatDeck);
  b.rect(45, 44, 55, 48, Tile.BoatDeck);
  b.rect(47, 41, 53, 44, Tile.BoatDeck);
  b.rect(39, 54, 39, 70, Tile.Dock);
  b.rect(61, 54, 61, 70, Tile.Dock);
  b.rect(43, 49, 43, 53, Tile.Dock);
  b.rect(57, 49, 57, 53, Tile.Dock);
  // Gull's Rest: a hidden island reachable only by sailing.
  b.ellipse(17, 59, 9, 7, Tile.Shallow);
  b.ellipse(17, 59, 7, 5, Tile.Sand);
  b.ellipse(17, 58, 3, 2, Tile.Grass);
  b.rect(23, 59, 27, 60, Tile.Dock);
  b.ellipse(78, 30, 5, 3, Tile.Rock);
  b.ellipse(26, 22, 4, 3, Tile.Rock);
  b.ellipse(70, 34, 5, 3, Tile.Coral);
  b.ellipse(88, 55, 4, 3, Tile.Rock);
  b.ellipse(12, 62, 5, 3, Tile.Rock);
  b.ellipse(30, 38, 3, 2, Tile.Coral);
  for (let i = 0; i < 10; i++) {
    const x = 5 + Math.floor(rand() * 90);
    const y = 5 + Math.floor(rand() * 35);
    b.set(x, y, rand() > 0.5 ? Tile.Coral : Tile.Rock);
  }
  return {
    location: "deep-ocean",
    width: MAP_W,
    height: MAP_H,
    tiles: b.tiles,
    spawn: { x: 50 * TILE, y: 60 * TILE },
    dockCount: 2,
    campfires: [{ x: 50 * TILE, y: 57 * TILE }],
    secretIsland: { x: 17 * TILE, y: 59 * TILE, radius: 92, name: "Gull's Rest" },
    underwater: [
      { x: 78 * TILE, y: 30 * TILE, kind: "wreck" },
      { x: 26 * TILE, y: 22 * TILE, kind: "cave" },
      { x: 70 * TILE, y: 34 * TILE, kind: "reef" },
    ],
    npcs: [
      {
        id: "rook",
        name: "Captain Rook",
        x: 50 * TILE,
        y: 55 * TILE,
        role: "Deep Sea Captain",
        dialog: "Beyond this rail, the water goes down forever. Cast well, and something ancient may look back.",
        shop: "boat",
      },
      {
        id: "hermit",
        name: "The Tide Hermit",
        x: 17 * TILE,
        y: 58 * TILE,
        role: "Keeper of Strange Things",
        dialog: "You found Gull's Rest. Most never do. I collect the sea's mistakes — the golden, the pale, the things that glow. Bring me proof and I will share my secrets.",
        secret: true,
        nightOnly: true,
      },
    ],
  };
}

const MAP_FACTORIES: Record<LocationId, () => WorldMap> = {
  "sunny-shore": sunnyShore,
  "coral-bay": coralBay,
  "frostbite-lake": frostbiteLake,
  "mystic-river": mysticRiver,
  "deep-ocean": deepOcean,
};

const cache = new Map<LocationId, WorldMap>();

export function createWorld(location: LocationId): WorldMap {
  const cached = cache.get(location);
  if (cached) return cached;
  const map = MAP_FACTORIES[location]();
  cache.set(location, map);
  return map;
}

export function tileAt(map: WorldMap, px: number, py: number): number {
  const tx = Math.floor(px / TILE);
  const ty = Math.floor(py / TILE);
  if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return Tile.DeepWater;
  return map.tiles[ty * map.width + tx];
}

export function isWalkableTile(tile: number): boolean {
  return WALKABLE.has(tile);
}

export function isWaterTile(tile: number): boolean {
  return WATER.has(tile);
}

export function canWalk(map: WorldMap, px: number, py: number, radius = 6): boolean {
  return (
    isWalkableTile(tileAt(map, px - radius, py - radius)) &&
    isWalkableTile(tileAt(map, px + radius, py - radius)) &&
    isWalkableTile(tileAt(map, px - radius, py + radius)) &&
    isWalkableTile(tileAt(map, px + radius, py + radius))
  );
}

export function nearWater(map: WorldMap, px: number, py: number, radius = 52): boolean {
  const steps = 10;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    if (isWaterTile(tileAt(map, px + Math.cos(a) * radius, py + Math.sin(a) * radius))) return true;
  }
  return isWaterTile(tileAt(map, px, py + radius)) || isWaterTile(tileAt(map, px, py - radius));
}

export function isFishingTarget(map: WorldMap, px: number, py: number): boolean {
  return isWaterTile(tileAt(map, px, py));
}

export function findWaterPoint(
  map: WorldMap,
  px: number,
  py: number,
  dirX: number,
  dirY: number,
  minDistance: number,
  maxDistance: number,
): { x: number; y: number } | null {
  const base = Math.atan2(dirY, dirX);
  for (let angleOffset = 0; angleOffset <= Math.PI; angleOffset += Math.PI / 12) {
    for (const sign of angleOffset === 0 ? [1] : [1, -1]) {
      const angle = base + angleOffset * sign;
      for (let d = minDistance; d <= maxDistance; d += 6) {
        const x = px + Math.cos(angle) * d;
        const y = py + Math.sin(angle) * d;
        if (isFishingTarget(map, x, y)) return { x, y };
      }
    }
  }
  return null;
}

export function clampToMap(map: WorldMap, x: number, y: number): { x: number; y: number } {
  return {
    x: Math.max(TILE, Math.min(map.width * TILE - TILE, x)),
    y: Math.max(TILE, Math.min(map.height * TILE - TILE, y)),
  };
}

export function locationSpawn(location: LocationId): { x: number; y: number } {
  return createWorld(location).spawn;
}

export function nearestCampfire(
  map: WorldMap,
  x: number,
  y: number,
  radius = 64,
): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  let bestDistance = radius;
  for (const fire of map.campfires) {
    const distance = Math.hypot(fire.x - x, fire.y - y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = fire;
    }
  }
  return best;
}

export function nearSecretIsland(map: WorldMap, x: number, y: number, pad = 0): boolean {
  if (!map.secretIsland) return false;
  return Math.hypot(map.secretIsland.x - x, map.secretIsland.y - y) <= map.secretIsland.radius + pad;
}

function sailableTile(tile: number): boolean {
  return isWaterTile(tile) || tile === Tile.Dock || tile === Tile.BoatDeck || tile === Tile.Bridge;
}

export function canSail(map: WorldMap, px: number, py: number, radius = 6): boolean {
  return (
    sailableTile(tileAt(map, px - radius, py - radius)) &&
    sailableTile(tileAt(map, px + radius, py - radius)) &&
    sailableTile(tileAt(map, px - radius, py + radius)) &&
    sailableTile(tileAt(map, px + radius, py + radius))
  );
}

export function canSwim(map: WorldMap, px: number, py: number, radius = 6): boolean {
  return (
    isWaterTile(tileAt(map, px - radius, py - radius)) &&
    isWaterTile(tileAt(map, px + radius, py - radius)) &&
    isWaterTile(tileAt(map, px - radius, py + radius)) &&
    isWaterTile(tileAt(map, px + radius, py + radius))
  );
}

export const MAP_SEED_RAND = mulberry32;
