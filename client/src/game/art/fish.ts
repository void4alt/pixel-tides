import type * as Phaser from "phaser";
import type { FishMutation, FishSpecies } from "@shared/types";
import { FISH } from "@shared/fish";
import { MUTATION_META } from "@shared/expansion";
import { addSpriteSheetFromCanvas, hashString, makeCanvas, mix, px, rng, shade } from "./pixel";

const W = 32;
const H = 20;

function inEllipse(x: number, y: number, cx: number, cy: number, rx: number, ry: number): boolean {
  return ((x - cx) * (x - cx)) / (rx * rx) + ((y - cy) * (y - cy)) / (ry * ry) <= 1;
}

function fillEllipse(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: string,
  outline = "#0b1a20",
): void {
  for (let y = -ry - 1; y <= ry + 1; y++) {
    for (let x = -rx - 1; x <= rx + 1; x++) {
      if (inEllipse(x, y, 0, 0, rx + 1, ry + 1)) px(ctx, cx + x, cy + y, 1, 1, outline);
    }
  }
  for (let y = -ry; y <= ry; y++) {
    for (let x = -rx; x <= rx; x++) {
      if (inEllipse(x, y, 0, 0, rx, ry)) px(ctx, cx + x, cy + y, 1, 1, color);
    }
  }
}

function drawTail(ctx: CanvasRenderingContext2D, species: FishSpecies, bodyLeft: number, cy: number, frame: number): void {
  const wiggle = [-1, 0, 1, 0][frame % 4];
  const dark = species.colors[3];
  const color = species.colors[1];
  const tailY = cy + wiggle;
  switch (species.fin) {
    case "forked":
      for (let i = 0; i < 6; i++) {
        px(ctx, bodyLeft - i, tailY - Math.floor(i / 2) - 1, 1, 2 + Math.floor(i / 2) * 2, color);
        px(ctx, bodyLeft - i, tailY - Math.floor(i / 2) - 1, 1, 1, dark);
      }
      px(ctx, bodyLeft - 6, tailY - 4, 2, 2, color);
      px(ctx, bodyLeft - 6, tailY + 3, 2, 2, color);
      break;
    case "round":
      fillEllipse(ctx, bodyLeft - 3, tailY, 3, 4, color, dark);
      break;
    case "spiky":
      for (let i = 0; i < 5; i++) {
        px(ctx, bodyLeft - i, tailY - 4 + i, 1, 9 - i * 2, color);
      }
      px(ctx, bodyLeft - 1, tailY - 1, 2, 3, dark);
      break;
    case "ribbon":
      for (let i = 0; i < 9; i++) {
        const y = tailY + Math.round(Math.sin(i * 0.7 + frame) * 2);
        px(ctx, bodyLeft - i, y, 1, 2, color);
        px(ctx, bodyLeft - i, y, 1, 1, dark);
      }
      break;
    default:
      for (let i = 0; i < 6; i++) {
        const spread = Math.floor(i / 2);
        px(ctx, bodyLeft - i, tailY - spread, 1, spread * 2 + 2, color);
      }
      px(ctx, bodyLeft - 1, tailY - 2, 1, 5, dark);
      break;
  }
}

function drawDorsal(ctx: CanvasRenderingContext2D, species: FishSpecies, cx: number, top: number): void {
  const color = species.colors[1];
  const dark = species.colors[3];
  const fin = species.fin;
  if (fin === "spiky") {
    for (let i = 0; i < 5; i++) {
      px(ctx, cx - 5 + i * 2, top - 3 - (i % 2), 1, 3 + (i % 2), color);
    }
  } else if (fin === "ribbon") {
    for (let i = 0; i < 5; i++) px(ctx, cx - 3 + i, top - 3 - Math.floor(i / 2), 1, 3, color);
  } else {
    for (let i = 0; i < 7; i++) {
      const h = 2 + Math.round(Math.sin((i / 6) * Math.PI) * 2);
      px(ctx, cx - 4 + i, top - h, 1, h, color);
    }
    px(ctx, cx - 3, top - 1, 5, 1, dark);
  }
}

function drawPattern(ctx: CanvasRenderingContext2D, species: FishSpecies, cx: number, cy: number, rx: number, ry: number): void {
  const [, light, belly, dark] = species.colors;
  const random = rng(hashString(species.id));
  switch (species.pattern) {
    case "stripes":
      for (let x = -rx + 2; x < rx - 1; x += 3) {
        for (let y = -ry; y <= ry; y++) {
          if (inEllipse(x, y, 0, 0, rx, ry)) px(ctx, cx + x, cy + y, 1, 1, light);
        }
      }
      break;
    case "spots":
      for (let i = 0; i < 12; i++) {
        const x = Math.floor((random() * 2 - 1) * (rx - 2));
        const y = Math.floor((random() * 2 - 1) * (ry - 1));
        if (inEllipse(x, y, 0, 0, rx, ry)) px(ctx, cx + x, cy + y, 1 + Math.floor(random() * 2), 1, light);
      }
      break;
    case "scales":
      for (let y = -ry + 1; y < ry; y += 2) {
        for (let x = -rx + 1; x < rx; x += 2) {
          if (inEllipse(x, y, 0, 0, rx, ry)) px(ctx, cx + x, cy + y, 1, 1, (x + y) % 4 === 0 ? light : dark);
        }
      }
      break;
    case "glow":
      for (let x = -rx + 2; x < rx - 1; x += 4) {
        px(ctx, cx + x, cy - Math.floor(ry / 2), 1, 1, light);
        px(ctx, cx + x + 1, cy + Math.floor(ry / 2), 1, 1, light);
      }
      break;
    case "gradient":
      for (let y = -ry; y <= ry; y++) {
        for (let x = -rx; x <= rx; x++) {
          if (inEllipse(x, y, 0, 0, rx, ry)) {
            const t = (y + ry) / (ry * 2);
            px(ctx, cx + x, cy + y, 1, 1, mix(light, belly, t));
          }
        }
      }
      break;
    case "bands":
      for (let y = -ry + 2; y < ry; y += 4) {
        for (let x = -rx; x <= rx; x++) {
          if (inEllipse(x, y, 0, 0, rx, ry)) px(ctx, cx + x, cy + y, 1, 1, dark);
        }
      }
      break;
    default:
      for (let x = -rx + 2; x < rx - 2; x += 3) {
        if (inEllipse(x, -1, 0, 0, rx, ry)) px(ctx, cx + x, cy - 1, 1, 1, shade(light, 0.12));
      }
  }
}

function drawEel(ctx: CanvasRenderingContext2D, species: FishSpecies, frame: number): void {
  const [body, light, , dark] = species.colors;
  const wiggle = [-1, 0, 1, 0][frame % 4];
  for (let i = 0; i < 22; i++) {
    const x = 4 + i;
    const y = 11 + Math.round(Math.sin(i * 0.42 + frame * 0.8) * 2.2);
    const thickness = i < 4 ? 2 : i > 18 ? 3 : 4;
    px(ctx, x, y - thickness / 2, 1, thickness, dark);
    px(ctx, x, y - thickness / 2 + 1, 1, thickness - 2, body);
    if (i % 4 === 0) px(ctx, x, y - 1, 1, 1, light);
  }
  const headX = 26;
  const headY = 11 + Math.round(Math.sin(26 * 0.42 + frame * 0.8) * 1);
  fillEllipse(ctx, headX, headY, 4, 3, body, dark);
  px(ctx, headX + 2, headY - 1, 2, 2, "#f6f3df");
  px(ctx, headX + 3, headY - 1, 1, 1, "#071722");
  drawDorsal(ctx, species, 14, 6 + wiggle);
}

function drawJelly(ctx: CanvasRenderingContext2D, species: FishSpecies, frame: number): void {
  const [body, light, belly, dark] = species.colors;
  const bob = [0, -1, 0, 1][frame % 4];
  for (let y = -7; y <= 0; y++) {
    const rx = Math.round(Math.sqrt(1 - (y / 7) ** 2) * 8);
    px(ctx, 16 - rx, 10 + y + bob, rx * 2, 1, dark);
    px(ctx, 17 - rx, 10 + y + bob, Math.max(1, rx * 2 - 2), 1, body);
  }
  for (let i = 0; i < 5; i++) {
    const x = 10 + i * 3;
    for (let t = 0; t < 5; t++) {
      const y = 10 + t * 2 + bob;
      const wobble = Math.round(Math.sin(t * 1.4 + i + frame) * 1);
      px(ctx, x + wobble, y, 1, 2, i % 2 ? light : belly);
    }
  }
  px(ctx, 13, 7 + bob, 2, 2, "#ffffff");
  px(ctx, 13, 7 + bob, 1, 1, dark);
  px(ctx, 20, 7 + bob, 2, 2, "#ffffff");
  px(ctx, 21, 7 + bob, 1, 1, dark);
  ctx.globalAlpha = 0.22;
  fillEllipse(ctx, 16, 9 + bob, 10, 8, light, light);
  ctx.globalAlpha = 1;
}

function drawSerpent(ctx: CanvasRenderingContext2D, species: FishSpecies, frame: number): void {
  const [body, light, belly, dark] = species.colors;
  const points: Array<[number, number]> = [];
  for (let i = 0; i < 24; i++) {
    const x = 4 + i;
    const y = 11 + Math.round(Math.sin(i * 0.35 + frame * 0.9) * 3.2);
    points.push([x, y]);
  }
  for (const [x, y] of points) {
    px(ctx, x, y - 2, 1, 5, dark);
    px(ctx, x, y - 1, 1, 3, body);
    if (x % 3 === 0) px(ctx, x, y, 1, 1, light);
  }
  const [hx, hy] = points[points.length - 1];
  fillEllipse(ctx, hx + 1, hy, 4, 3, body, dark);
  px(ctx, hx + 3, hy - 1, 2, 2, "#f6f3df");
  px(ctx, hx + 4, hy - 1, 1, 1, "#071722");
  px(ctx, hx - 1, hy - 4, 2, 2, belly);
  px(ctx, hx + 1, hy - 5, 1, 2, light);
  px(ctx, 4, 12, 2, 3, belly);
}

function drawRay(ctx: CanvasRenderingContext2D, species: FishSpecies, frame: number): void {
  const [body, light, belly, dark] = species.colors;
  const flap = [0, -1, 0, 1][frame % 4];
  for (let y = 0; y < 9; y++) {
    const width = 13 - Math.abs(y - 4) * 2;
    px(ctx, 16 - width, 8 + y + flap, width * 2, 1, dark);
    px(ctx, 17 - width, 8 + y + flap, Math.max(1, width * 2 - 2), 1, body);
  }
  px(ctx, 9, 5 + flap, 14, 1, light);
  px(ctx, 2, 14 + flap, 8, 1, belly);
  px(ctx, 2, 13 + flap, 1, 3, dark);
  px(ctx, 22, 10 + flap, 3, 2, dark);
  px(ctx, 23, 9 + flap, 2, 1, "#f6f3df");
  px(ctx, 24, 9 + flap, 1, 1, "#071722");
  px(ctx, 7, 16 + flap, 2, 1, light);
  px(ctx, 22, 16 + flap, 2, 1, light);
}

function drawFishFrame(ctx: CanvasRenderingContext2D, species: FishSpecies, frame: number): void {
  const [body, light, belly, dark] = species.colors;
  const rare = species.rarity !== "common" && species.rarity !== "uncommon";
  if (rare) {
    ctx.globalAlpha = 0.16;
    fillEllipse(ctx, 16, 10, 14, 8, species.rarity === "secret" ? "#7ff7e8" : light, light);
    ctx.globalAlpha = 1;
  }
  if (species.body === "eel") {
    drawEel(ctx, species, frame);
    return;
  }
  if (species.body === "jelly") {
    drawJelly(ctx, species, frame);
    return;
  }
  if (species.body === "serpent") {
    drawSerpent(ctx, species, frame);
    return;
  }
  if (species.body === "ray") {
    drawRay(ctx, species, frame);
    return;
  }

  let rx = 9;
  let ry = 4;
  let cx = 17;
  let cy = 10;
  if (species.body === "round") {
    rx = 7;
    ry = 6;
    cx = 18;
  } else if (species.body === "long") {
    rx = 11;
    ry = 3.5;
    cx = 17;
  } else if (species.body === "flat") {
    rx = 7.5;
    ry = 7;
    cx = 18;
  } else if (species.body === "slim") {
    rx = 8.5;
    ry = 3.5;
    cx = 18;
  }
  const bodyLeft = Math.round(cx - rx);
  drawTail(ctx, species, bodyLeft, cy, frame);
  fillEllipse(ctx, cx, cy, rx, ry, body, dark);
  drawPattern(ctx, species, cx, cy, Math.floor(rx), Math.floor(ry));
  fillEllipse(ctx, cx - 1, cy + Math.floor(ry / 2), Math.floor(rx * 0.7), Math.max(1, Math.floor(ry / 3)), belly, belly);
  drawDorsal(ctx, species, cx, cy - Math.ceil(ry));
  if (species.body === "flat") {
    px(ctx, cx - 2, cy + ry + 1, 3, 3, light);
    px(ctx, cx - 3, cy + ry + 3, 5, 1, dark);
  } else {
    px(ctx, cx - 2, cy + ry, 2, 2, light);
    px(ctx, cx + 2, cy + ry, 1, 1, dark);
  }
  // Head shading and eye.
  px(ctx, cx + Math.floor(rx) - 3, cy - 2, 3, 4, light);
  px(ctx, cx + Math.floor(rx) - 1, cy - 2, 2, 2, "#f8f4df");
  px(ctx, cx + Math.floor(rx), cy - 2, 1, 1, "#071722");
  px(ctx, cx + Math.floor(rx) - 1, cy + 1, 2, 1, dark);
  // Gill line.
  px(ctx, cx + Math.floor(rx) - 4, cy - 1, 1, 3, dark);
  if (species.rarity === "secret") {
    px(ctx, cx + 2, cy - 4, 1, 1, "#ffffff");
    px(ctx, cx - 4, cy + 2, 1, 1, "#ffffff");
  }
}

export function fishSheetCanvas(species: FishSpecies): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(W * 4, H);
  for (let frame = 0; frame < 4; frame++) {
    ctx.save();
    ctx.translate(frame * W, 0);
    drawFishFrame(ctx, species, frame);
    ctx.restore();
  }
  return canvas;
}

export function createFishTextures(scene: Phaser.Scene): void {
  for (const species of FISH) {
    const key = `fish-${species.id}`;
    if (scene.textures.exists(key)) continue;
    addSpriteSheetFromCanvas(scene, key, fishSheetCanvas(species), W, H);
    const animKey = `fish-swim-${species.id}`;
    if (!scene.anims.exists(animKey)) {
      scene.anims.create({
        key: animKey,
        frames: [0, 1, 2, 3].map((frame) => ({ key, frame })),
        frameRate: 8,
        repeat: -1,
      });
    }
  }
}

export function renderFishCanvas(
  speciesId: string,
  width = 144,
  height = 90,
  frame = 1,
  mutation: FishMutation = "normal",
): HTMLCanvasElement {
  const species = FISH.find((f) => f.id === speciesId) ?? FISH[0];
  const { canvas, ctx } = makeCanvas(width, height);
  ctx.imageSmoothingEnabled = false;
  const source = makeCanvas(W, H);
  drawFishFrame(source.ctx, species, frame);
  const scale = Math.max(1, Math.floor(Math.min(width / W, height / H)));
  const drawW = W * scale;
  const drawH = H * scale;
  ctx.drawImage(source.canvas, Math.floor((width - drawW) / 2), Math.floor((height - drawH) / 2), drawW, drawH);
  if (mutation && mutation !== "normal") {
    const meta = MUTATION_META[mutation] ?? MUTATION_META.golden;
    ctx.save();
    ctx.globalCompositeOperation = "source-atop";
    ctx.globalAlpha = mutation === "glowing" ? 0.4 : 0.3;
    ctx.fillStyle = meta.color;
    ctx.fillRect(0, 0, width, height);
    if (mutation === "glowing" || mutation === "crystal") {
      ctx.globalAlpha = 0.7;
      for (let i = 0; i < 14; i++) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(Math.random() * width, Math.random() * height, 1, 1);
      }
    }
    ctx.restore();
  }
  return canvas;
}

export function createFishingTextures(scene: Phaser.Scene): void {
  {
    const { canvas, ctx } = makeCanvas(8, 10);
    px(ctx, 3, 0, 2, 6, "#e9e4d4");
    px(ctx, 2, 2, 4, 5, "#e9e4d4");
    px(ctx, 2, 2, 4, 2, "#e8513d");
    px(ctx, 2, 5, 4, 2, "#e9e4d4");
    px(ctx, 3, 8, 2, 2, "#8a5a35");
    px(ctx, 1, 3, 1, 2, "#071722");
    px(ctx, 6, 3, 1, 2, "#071722");
    if (scene.textures.exists("bobber")) scene.textures.remove("bobber");
    scene.textures.addCanvas("bobber", canvas);
  }
  {
    const { canvas, ctx } = makeCanvas(24, 10);
    ctx.globalAlpha = 0.7;
    for (let x = 2; x < 22; x += 2) {
      px(ctx, x, 4, 1, 1, "#d8f7ef");
      px(ctx, x - 1, 6, 2, 1, "#8dd9d2");
    }
    if (scene.textures.exists("ripple")) scene.textures.remove("ripple");
    scene.textures.addCanvas("ripple", canvas);
  }
  {
    const { canvas, ctx } = makeCanvas(10, 10);
    ctx.globalAlpha = 0.22;
    px(ctx, 1, 7, 8, 2, "#071722");
    px(ctx, 2, 8, 6, 1, "#071722");
    if (scene.textures.exists("shadow")) scene.textures.remove("shadow");
    scene.textures.addCanvas("shadow", canvas);
  }
  {
    const { canvas, ctx } = makeCanvas(20, 20);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      px(ctx, 10 + Math.cos(a) * 6, 10 + Math.sin(a) * 3, 1, 1, "#c9f7ef");
    }
    px(ctx, 9, 9, 2, 2, "#ffffff");
    if (scene.textures.exists("splash")) scene.textures.remove("splash");
    scene.textures.addCanvas("splash", canvas);
  }
  {
    const { canvas, ctx } = makeCanvas(3, 12);
    px(ctx, 0, 0, 1, 8, "#b9e6f2");
    px(ctx, 2, 3, 1, 7, "#8fcfe0");
    if (scene.textures.exists("rain-drop")) scene.textures.remove("rain-drop");
    scene.textures.addCanvas("rain-drop", canvas);
  }
  {
    const { canvas, ctx } = makeCanvas(8, 8);
    px(ctx, 2, 0, 4, 4, "#f8f2df");
    px(ctx, 1, 1, 6, 2, "#f8f2df");
    px(ctx, 2, 4, 4, 2, "#d8e7ea");
    px(ctx, 3, 3, 2, 2, "#b6ccd2");
    if (scene.textures.exists("snowflake")) scene.textures.remove("snowflake");
    scene.textures.addCanvas("snowflake", canvas);
  }
  {
    const { canvas, ctx } = makeCanvas(4, 4);
    px(ctx, 0, 0, 4, 4, "#f4e3a8");
    if (scene.textures.exists("spark")) scene.textures.remove("spark");
    scene.textures.addCanvas("spark", canvas);
  }
}
