import type * as Phaser from "phaser";
import type { LocationId } from "@shared/types";
import { MAP_W, Tile, TILE, type WorldMap } from "@shared/world";
import { hashString, makeCanvas, noiseDots, px, rng, shade } from "./pixel";

export interface LocationPalette {
  water: string;
  waterDeep: string;
  waterShallow: string;
  foam: string;
  sand: string;
  sandDark: string;
  grass: string;
  grassDark: string;
  path: string;
  pathDark: string;
  dock: string;
  dockDark: string;
  stone: string;
  stoneDark: string;
  snow: string;
  snowShadow: string;
  ice: string;
  iceDark: string;
  coral: string;
  coralDark: string;
  rock: string;
  rockDark: string;
  tree: string;
  treeDark: string;
  accent: string;
}

export const PALETTES: Record<LocationId, LocationPalette> = {
  "sunny-shore": {
    water: "#2a8fa3",
    waterDeep: "#1c6e88",
    waterShallow: "#5fc5c4",
    foam: "#d8f7ef",
    sand: "#f0d488",
    sandDark: "#d4ad5d",
    grass: "#67b568",
    grassDark: "#3e804b",
    path: "#c99b60",
    pathDark: "#a17444",
    dock: "#9a6840",
    dockDark: "#684126",
    stone: "#8d9d93",
    stoneDark: "#65766e",
    snow: "#eef5f3",
    snowShadow: "#c3dce2",
    ice: "#b9e5ef",
    iceDark: "#83c5d8",
    coral: "#ff7e9e",
    coralDark: "#c34c71",
    rock: "#6d7d7c",
    rockDark: "#475a5b",
    tree: "#3f8b50",
    treeDark: "#276039",
    accent: "#f2c879",
  },
  "coral-bay": {
    water: "#2d8fba",
    waterDeep: "#1c638e",
    waterShallow: "#68d1cf",
    foam: "#e2fff7",
    sand: "#f7dda2",
    sandDark: "#dbb76d",
    grass: "#55ab72",
    grassDark: "#327d51",
    path: "#d0a467",
    pathDark: "#a67a47",
    dock: "#a26c45",
    dockDark: "#6d452b",
    stone: "#91a19a",
    stoneDark: "#697b75",
    snow: "#eef5f3",
    snowShadow: "#c3dce2",
    ice: "#b9e5ef",
    iceDark: "#83c5d8",
    coral: "#ff729d",
    coralDark: "#c73c72",
    rock: "#6f7e7e",
    rockDark: "#495b5c",
    tree: "#3c9458",
    treeDark: "#22663e",
    accent: "#ff8fc7",
  },
  "frostbite-lake": {
    water: "#4d83a2",
    waterDeep: "#2f6180",
    waterShallow: "#9bd1df",
    foam: "#e8fbff",
    sand: "#cdd8cf",
    sandDark: "#aabcb8",
    grass: "#7aa18b",
    grassDark: "#557a6c",
    path: "#b5c7c8",
    pathDark: "#8fa5a7",
    dock: "#7b5d45",
    dockDark: "#533c2c",
    stone: "#8d9ba6",
    stoneDark: "#657480",
    snow: "#eff6f8",
    snowShadow: "#c2dbe4",
    ice: "#b8e7f2",
    iceDark: "#83c7da",
    coral: "#92c9d8",
    coralDark: "#6099ae",
    rock: "#73808d",
    rockDark: "#4b5865",
    tree: "#4c7a6c",
    treeDark: "#2e554b",
    accent: "#aee8ff",
  },
  "mystic-river": {
    water: "#2c6f6d",
    waterDeep: "#1b4f53",
    waterShallow: "#5bb3a1",
    foam: "#c8f3dc",
    sand: "#c6b47d",
    sandDark: "#a08d58",
    grass: "#43834f",
    grassDark: "#285d37",
    path: "#8f7148",
    pathDark: "#6d5434",
    dock: "#7b5436",
    dockDark: "#523620",
    stone: "#71856f",
    stoneDark: "#4e6452",
    snow: "#e8f1e7",
    snowShadow: "#c5d8c9",
    ice: "#b4dfd2",
    iceDark: "#7fbdae",
    coral: "#79d3a0",
    coralDark: "#42946d",
    rock: "#657a66",
    rockDark: "#445844",
    tree: "#2f7448",
    treeDark: "#1a4d2f",
    accent: "#9be7a8",
  },
  "deep-ocean": {
    water: "#123b64",
    waterDeep: "#092647",
    waterShallow: "#2e6f92",
    foam: "#8ed8e6",
    sand: "#8e8b6a",
    sandDark: "#6f6e52",
    grass: "#3f7060",
    grassDark: "#264d44",
    path: "#8c7854",
    pathDark: "#67553a",
    dock: "#6d4b33",
    dockDark: "#432c1e",
    stone: "#516576",
    stoneDark: "#344757",
    snow: "#d8e7eb",
    snowShadow: "#adc6ce",
    ice: "#9ed4df",
    iceDark: "#6aaebb",
    coral: "#6fd6c9",
    coralDark: "#359d9a",
    rock: "#43566a",
    rockDark: "#293b4d",
    tree: "#2e6458",
    treeDark: "#1b423b",
    accent: "#5f8dff",
  },
};

function baseTile(ctx: CanvasRenderingContext2D, palette: LocationPalette, color: string, seed: number, dark: string): void {
  px(ctx, 0, 0, 16, 16, color);
  noiseDots(ctx, 16, 16, seed, [shade(color, 0.06), dark], 7, 1);
}

function drawSand(ctx: CanvasRenderingContext2D, palette: LocationPalette, seed: number, x: number, y: number): void {
  baseTile(ctx, palette, palette.sand, seed, palette.sandDark);
  const random = rng(seed);
  for (let i = 0; i < 3; i++) {
    px(ctx, Math.floor(random() * 14), Math.floor(random() * 14), 1, 1, shade(palette.sand, 0.22));
  }
  if (random() > 0.88) {
    px(ctx, 4, 9, 3, 1, shade(palette.sand, -0.22));
    px(ctx, 5, 8, 1, 1, shade(palette.sand, -0.22));
  }
  if ((x + y) % 11 === 0) px(ctx, 11, 4, 1, 1, palette.accent);
}

function drawGrass(ctx: CanvasRenderingContext2D, palette: LocationPalette, seed: number): void {
  baseTile(ctx, palette, palette.grass, seed, palette.grassDark);
  const random = rng(seed);
  for (let i = 0; i < 4; i++) {
    const x = 1 + Math.floor(random() * 13);
    const y = 4 + Math.floor(random() * 10);
    px(ctx, x, y, 1, 3, shade(palette.grass, -0.22));
    px(ctx, x - 1, y + 1, 1, 2, shade(palette.grass, -0.12));
    px(ctx, x + 1, y + 2, 1, 1, shade(palette.grass, 0.12));
  }
  if (random() > 0.92) {
    px(ctx, 6, 6, 2, 2, palette.accent);
    px(ctx, 7, 5, 1, 1, "#fff3cf");
  }
}

function drawPath(ctx: CanvasRenderingContext2D, palette: LocationPalette, seed: number): void {
  baseTile(ctx, palette, palette.path, seed, palette.pathDark);
  const random = rng(seed);
  for (let i = 0; i < 5; i++) {
    px(ctx, Math.floor(random() * 15), Math.floor(random() * 15), 2, 1, shade(palette.path, -0.16));
  }
  px(ctx, 2, 2, 1, 1, shade(palette.path, 0.15));
  px(ctx, 13, 11, 1, 1, shade(palette.path, -0.28));
}

function drawDock(ctx: CanvasRenderingContext2D, palette: LocationPalette, seed: number, boat = false): void {
  px(ctx, 0, 0, 16, 16, palette.dockDark);
  const random = rng(seed);
  for (let row = 0; row < 4; row++) {
    const y = row * 4;
    const color = row % 2 === 0 ? palette.dock : shade(palette.dock, -0.08);
    px(ctx, 0, y + 1, 16, 3, color);
    px(ctx, 0, y + 1, 16, 1, shade(color, 0.14));
    px(ctx, (row * 5 + Math.floor(random() * 4)) % 16, y + 2, 1, 1, shade(palette.dock, -0.4));
    px(ctx, (row * 7 + 4) % 16, y + 2, 1, 1, shade(palette.dock, 0.22));
  }
  px(ctx, 0, 15, 16, 1, shade(palette.dockDark, -0.2));
  if (boat) {
    px(ctx, 2, 0, 1, 16, "#b0a58b");
    px(ctx, 13, 0, 1, 16, "#b0a58b");
  }
}

function drawStone(ctx: CanvasRenderingContext2D, palette: LocationPalette, seed: number): void {
  baseTile(ctx, palette, palette.stone, seed, palette.stoneDark);
  const random = rng(seed);
  px(ctx, 2, 4, 5, 1, shade(palette.stone, 0.18));
  px(ctx, 9, 9, 4, 1, shade(palette.stone, -0.24));
  if (random() > 0.5) {
    px(ctx, 6, 3, 1, 4, shade(palette.stone, -0.28));
    px(ctx, 6, 7, 3, 1, shade(palette.stone, -0.28));
  }
}

function drawSnow(ctx: CanvasRenderingContext2D, palette: LocationPalette, seed: number): void {
  px(ctx, 0, 0, 16, 16, palette.snow);
  noiseDots(ctx, 16, 16, seed, [palette.snowShadow, "#ffffff"], 6, 1);
  const random = rng(seed);
  for (let i = 0; i < 2; i++) {
    px(ctx, Math.floor(random() * 14), Math.floor(random() * 14), 2, 1, shade(palette.snowShadow, 0.08));
  }
  if (random() > 0.85) px(ctx, 11, 4, 1, 1, "#ffffff");
}

function drawIce(ctx: CanvasRenderingContext2D, palette: LocationPalette, seed: number): void {
  px(ctx, 0, 0, 16, 16, palette.ice);
  const random = rng(seed);
  px(ctx, 0, 0, 16, 1, shade(palette.ice, 0.2));
  for (let i = 0; i < 3; i++) {
    px(ctx, Math.floor(random() * 12), Math.floor(random() * 12), 2 + Math.floor(random() * 4), 1, palette.iceDark);
  }
  px(ctx, 12, 2, 1, 4, shade(palette.iceDark, 0.1));
  px(ctx, 3, 11, 5, 1, shade(palette.ice, 0.25));
}

function drawRock(ctx: CanvasRenderingContext2D, palette: LocationPalette, seed: number): void {
  const random = rng(seed);
  px(ctx, 1, 5, 14, 10, palette.rockDark);
  px(ctx, 2, 3, 11, 9, palette.rock);
  px(ctx, 4, 2, 7, 3, shade(palette.rock, 0.15));
  px(ctx, 3, 10, 10, 2, shade(palette.rock, -0.18));
  for (let i = 0; i < 3; i++) {
    px(ctx, 3 + Math.floor(random() * 9), 5 + Math.floor(random() * 5), 1, 1, shade(palette.rock, -0.3));
  }
}

function drawCoral(ctx: CanvasRenderingContext2D, palette: LocationPalette, seed: number): void {
  const random = rng(seed);
  for (let i = 0; i < 4; i++) {
    const x = 2 + Math.floor(random() * 11);
    const y = 5 + Math.floor(random() * 8);
    const h = 3 + Math.floor(random() * 5);
    px(ctx, x, y - h, 1, h, palette.coralDark);
    px(ctx, x - 2, y - h + 1, 1, 3, palette.coral);
    px(ctx, x + 2, y - h + 2, 1, 2, palette.coral);
    px(ctx, x - 1, y - h - 1, 2, 1, shade(palette.coral, 0.15));
  }
  if (random() > 0.6) px(ctx, 5, 12, 3, 1, palette.coralDark);
}

function drawTile(
  ctx: CanvasRenderingContext2D,
  tile: number,
  palette: LocationPalette,
  x: number,
  y: number,
  seed: number,
): void {
  switch (tile) {
    case Tile.Sand:
      drawSand(ctx, palette, seed, x, y);
      break;
    case Tile.Grass:
      drawGrass(ctx, palette, seed);
      break;
    case Tile.Path:
      drawPath(ctx, palette, seed);
      break;
    case Tile.Dock:
      drawDock(ctx, palette, seed);
      break;
    case Tile.BoatDeck:
      drawDock(ctx, palette, seed, true);
      break;
    case Tile.Stone:
      drawStone(ctx, palette, seed);
      break;
    case Tile.Snow:
      drawSnow(ctx, palette, seed);
      break;
    case Tile.Ice:
      drawIce(ctx, palette, seed);
      break;
    case Tile.Rock:
      drawRock(ctx, palette, seed);
      break;
    case Tile.Coral:
      drawCoral(ctx, palette, seed);
      break;
    case Tile.Bridge:
      drawDock(ctx, palette, seed);
      px(ctx, 0, 0, 1, 16, shade(palette.dockDark, -0.15));
      px(ctx, 15, 0, 1, 16, shade(palette.dockDark, -0.15));
      px(ctx, 0, 7, 16, 1, shade(palette.dock, 0.2));
      break;
    default:
      break;
  }
}

function waterTexture(location: LocationId, frame: number): HTMLCanvasElement {
  const palette = PALETTES[location];
  const { canvas, ctx } = makeCanvas(64, 64);
  px(ctx, 0, 0, 64, 64, palette.water);
  const base = rng(hashString(`${location}-water`));
  const deep = shade(palette.water, -0.12);
  const mid = shade(palette.water, 0.06);
  const light = shade(palette.water, 0.14);
  const glint = shade(palette.waterShallow, 0.28);

  // Faint horizontal ripple lines instead of full bands, to avoid visible tiling blocks.
  for (let band = 0; band < 3; band++) {
    const y = Math.floor(base() * 64);
    ctx.globalAlpha = 0.08;
    px(ctx, 0, y, 64, 1, band % 2 === 0 ? deep : light);
    ctx.globalAlpha = 1;
  }

  // Long wave crests drifting coherently from frame to frame.
  const waves = Array.from({ length: 3 }, () => ({
    x: Math.floor(base() * 64),
    y: Math.floor(base() * 64),
    len: 12 + Math.floor(base() * 14),
    tone: base(),
    speed: 2 + Math.floor(base() * 2),
  }));
  for (const wave of waves) {
    const color = wave.tone > 0.55 ? light : wave.tone > 0.25 ? mid : deep;
    const start = (wave.x + frame * wave.speed) % 64;
    ctx.globalAlpha = 0.42;
    for (let ox = 0; ox < wave.len; ox++) {
      const x = (start + ox) % 64;
      const fade = ox < 2 || ox > wave.len - 3 ? 0 : 1;
      px(ctx, x, wave.y, 1, 1, color);
      if (fade && ox % 4 === 0) px(ctx, x, (wave.y + 1) % 64, 1, 1, shade(color, -0.07));
    }
    ctx.globalAlpha = 1;
  }

  // Scattered wavelets and glints.
  for (let i = 0; i < 10; i++) {
    const x = (Math.floor(base() * 64) + Math.floor(frame * 1.5)) % 64;
    const y = Math.floor(base() * 64);
    const len = 2 + Math.floor(base() * 4);
    ctx.globalAlpha = 0.28;
    px(ctx, x, y, len, 1, i % 3 === 0 ? light : deep);
    if (i % 3 === 0) px(ctx, (x + len + 1) % 64, (y + 1) % 64, 1, 1, glint);
    ctx.globalAlpha = 1;
  }
  for (let i = 0; i < 5; i++) {
    const x = (Math.floor(base() * 64) + Math.floor(frame * 0.75)) % 64;
    const y = Math.floor(base() * 64);
    ctx.globalAlpha = 0.3;
    px(ctx, x, y, 1, 1, glint);
    ctx.globalAlpha = 1;
  }

  // Rare foam flecks drifting with the tide.
  for (let i = 0; i < 3; i++) {
    const x = (Math.floor(base() * 64) + frame * 2) % 64;
    const y = Math.floor(base() * 64);
    ctx.globalAlpha = 0.26;
    px(ctx, x, y, 1, 1, palette.foam);
    ctx.globalAlpha = 1;
  }

  if (location === "deep-ocean") {
    ctx.globalAlpha = 0.18;
    for (let i = 0; i < 6; i++) {
      px(ctx, Math.floor(base() * 64), Math.floor(base() * 64), 1, 1, shade(palette.waterShallow, 0.45));
    }
    ctx.globalAlpha = 1;
  }
  if (location === "frostbite-lake") {
    ctx.globalAlpha = 0.24;
    for (let i = 0; i < 3; i++) {
      px(ctx, Math.floor(base() * 56), Math.floor(base() * 56), 4 + Math.floor(base() * 6), 1, "#e8fbff");
    }
    ctx.globalAlpha = 1;
  }
  return canvas;
}

export function createWaterTextures(scene: Phaser.Scene, location: LocationId): string[] {
  const keys: string[] = [];
  for (let frame = 0; frame < 6; frame++) {
    const key = `water-${location}-${frame}`;
    const canvas = waterTexture(location, frame);
    if (scene.textures.exists(key)) scene.textures.remove(key);
    scene.textures.addCanvas(key, canvas);
    keys.push(key);
  }
  return keys;
}

export function createWaterSheenTexture(scene: Phaser.Scene, location: LocationId): string {
  const key = `water-sheen-${location}`;
  if (scene.textures.exists(key)) return key;
  const palette = PALETTES[location];
  const { canvas, ctx } = makeCanvas(64, 64);
  const random = rng(hashString(`${location}-sheen`));
  const color = shade(palette.waterShallow, 0.42);
  for (let i = 0; i < 10; i++) {
    const x = Math.floor(random() * 64);
    const y = Math.floor(random() * 64);
    const len = 6 + Math.floor(random() * 12);
    ctx.globalAlpha = 0.06 + random() * 0.09;
    px(ctx, x, y, len, 1, color);
    if (random() > 0.6) px(ctx, (x + len + 2) % 64, (y + 2) % 64, 3, 1, color);
  }
  ctx.globalAlpha = 1;
  scene.textures.addCanvas(key, canvas);
  return key;
}

export function createWorldCanvas(map: WorldMap, location: LocationId): HTMLCanvasElement {
  const palette = PALETTES[location];
  const { canvas, ctx } = makeCanvas(map.width * TILE, map.height * TILE);
  ctx.imageSmoothingEnabled = false;
  const waterTiles = new Set<number>([Tile.Water, Tile.DeepWater, Tile.Shallow, Tile.Coral]);

  for (let ty = 0; ty < map.height; ty++) {
    for (let tx = 0; tx < map.width; tx++) {
      const tile = map.tiles[ty * map.width + tx];
      if (waterTiles.has(tile)) {
        if (tile === Tile.Shallow) {
          ctx.globalAlpha = 0.16;
          px(ctx, tx * TILE, ty * TILE, TILE, TILE, palette.waterShallow);
          ctx.globalAlpha = 1;
        } else if (tile === Tile.Coral) {
          ctx.save();
          ctx.translate(tx * TILE, ty * TILE);
          drawCoral(ctx, palette, hashString(`${tx}:${ty}:coral`));
          ctx.restore();
        }
        continue;
      }
      ctx.save();
      ctx.translate(tx * TILE, ty * TILE);
      drawTile(ctx, tile, palette, tx, ty, hashString(`${location}:${tx}:${ty}`));
      ctx.restore();
    }
  }

  // Foam and shoreline highlights on the water side of every coast tile.
  ctx.globalAlpha = 0.55;
  for (let ty = 0; ty < map.height; ty++) {
    for (let tx = 0; tx < map.width; tx++) {
      const tile = map.tiles[ty * map.width + tx];
      if (!waterTiles.has(tile) || tile === Tile.Coral) continue;
      const neighbors = [
        [0, -1, 0, 0, 16, 1],
        [0, 1, 0, 15, 16, 1],
        [-1, 0, 0, 0, 1, 16],
        [1, 0, 15, 0, 1, 16],
      ] as const;
      for (const [dx, dy, ox, oy, w, h] of neighbors) {
        const nx = tx + dx;
        const ny = ty + dy;
        if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
        const neighbor = map.tiles[ny * map.width + nx];
        if (waterTiles.has(neighbor)) continue;
        const baseX = tx * TILE + ox;
        const baseY = ty * TILE + oy;
        const random = rng(hashString(`${tx}:${ty}:${dx}:${dy}`));
        ctx.globalAlpha = 0.3;
        if (w === 16) px(ctx, baseX, baseY, 16, 1, palette.foam);
        else px(ctx, baseX, baseY, 1, 16, palette.foam);
        ctx.globalAlpha = 0.55;
        for (let i = 0; i < 6; i++) {
          if (random() > 0.6) continue;
          const length = 1 + Math.floor(random() * 3);
          if (w === 16) px(ctx, baseX + Math.floor(random() * 15), baseY + (random() > 0.6 ? 1 : 0), length, 1, palette.foam);
          else px(ctx, baseX + (random() > 0.6 ? 1 : 0), baseY + Math.floor(random() * 15), 1, length, palette.foam);
        }
        ctx.globalAlpha = 0.55;
      }
    }
  }
  ctx.globalAlpha = 1;

  // Subtle edge shadows where land meets water.
  ctx.globalAlpha = 0.18;
  for (let ty = 0; ty < map.height; ty++) {
    for (let tx = 0; tx < map.width; tx++) {
      const tile = map.tiles[ty * map.width + tx];
      if (waterTiles.has(tile)) continue;
      const below = ty + 1 < map.height ? map.tiles[(ty + 1) * map.width + tx] : Tile.Water;
      if (waterTiles.has(below)) px(ctx, tx * TILE, ty * TILE + 15, TILE, 1, "#071722");
    }
  }
  ctx.globalAlpha = 1;

  return canvas;
}

export function addWorldTexture(scene: Phaser.Scene, map: WorldMap, location: LocationId): string {
  const key = `world-${location}`;
  if (scene.textures.exists(key)) return key;
  const canvas = createWorldCanvas(map, location);
  scene.textures.addCanvas(key, canvas);
  return key;
}

export function tileColor(location: LocationId, tile: number): string {
  const p = PALETTES[location];
  switch (tile) {
    case Tile.Sand:
      return p.sand;
    case Tile.Grass:
      return p.grass;
    case Tile.Path:
      return p.path;
    case Tile.Dock:
    case Tile.Bridge:
      return p.dock;
    case Tile.Snow:
      return p.snow;
    case Tile.Ice:
      return p.ice;
    case Tile.Stone:
      return p.stone;
    case Tile.Rock:
      return p.rock;
    case Tile.Shallow:
      return p.waterShallow;
    case Tile.DeepWater:
      return p.waterDeep;
    default:
      return p.water;
  }
}

export function mapPixelWidth(): number {
  return MAP_W * TILE;
}
