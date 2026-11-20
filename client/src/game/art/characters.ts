import type * as Phaser from "phaser";
import type { Appearance } from "@shared/types";
import { addSpriteSheetFromCanvas, hashString, makeCanvas, px, shade } from "./pixel";

const CW = 24;
const CH = 36;
const TOP = 2;
const DIRS = ["down", "left", "right", "up"] as const;
export type CharDir = (typeof DIRS)[number];

export const CHAR_STATES = ["walk", "run", "cast", "wait", "reel", "celebrate", "cook", "eat"] as const;
export type CharState = (typeof CHAR_STATES)[number];
export const CHAR_STATE_FRAMES: Record<CharState, number> = {
  walk: 4,
  run: 4,
  cast: 2,
  wait: 2,
  reel: 2,
  celebrate: 2,
  cook: 2,
  eat: 2,
};
const STATE_ROW: Record<CharState, number> = (() => {
  const map = {} as Record<CharState, number>;
  let row = 0;
  for (const state of CHAR_STATES) {
    map[state] = row;
    row += DIRS.length;
  }
  return map;
})();
const ROWS = CHAR_STATES.length * DIRS.length;

const OUTLINE = "#2b2230";
const BOOT = "#5a3a25";
const BOOT_LIGHT = "#7d5434";
const BOOT_DARK = "#3a2417";
const EYE = "#2b2230";
const EYE_LIGHT = "#f7ead6";
const BLUSH = "#e29a8a";
const MOUTH = "#a0524a";
const SCARF = "#b8452f";
const SCARF_DARK = "#8a3022";
const STRAP = "#6b4a2f";
const SATCHEL = "#8a5a30";
const SATCHEL_LIGHT = "#a87342";
const BUCKLE = "#d9a94a";
const ROD = "#8a5c34";
const ROD_LIGHT = "#c08a4e";
const ROD_TIP = "#e9d9a8";
const REEL = "#c9a24a";
const LINE = "#f4efd8";

function drawShadow(ctx: CanvasRenderingContext2D): void {
  ctx.globalAlpha = 0.26;
  px(ctx, 5, 33, 14, 2, "#1c2020");
  px(ctx, 7, 32, 10, 1, "#1c2020");
  px(ctx, 3, 34, 18, 1, "#1c2020");
  ctx.globalAlpha = 1;
}

function drawHairBack(ctx: CanvasRenderingContext2D, appearance: Appearance, dir: CharDir, headY: number): void {
  const hair = appearance.hair;
  const dark = shade(hair, -0.36);
  const style = appearance.hairStyle;
  if (style === 1) {
    // Long hair falling behind the shoulders.
    const left = dir === "left" ? 11 : 4;
    const right = dir === "right" ? 6 : 17;
    for (const [x] of [[left], [right]] as const) {
      px(ctx, x, headY + 5, 3, 13, OUTLINE);
      px(ctx, x + 1, headY + 6, 1, 11, dark);
      px(ctx, x + 1, headY + 6, 1, 3, hair);
    }
  } else if (style === 3) {
    // Low ponytail behind the head.
    if (dir === "left") {
      px(ctx, 12, headY + 7, 4, 7, OUTLINE);
      px(ctx, 13, headY + 8, 2, 5, dark);
      px(ctx, 13, headY + 8, 1, 4, hair);
    } else if (dir === "right") {
      px(ctx, 5, headY + 7, 4, 7, OUTLINE);
      px(ctx, 6, headY + 8, 2, 5, dark);
      px(ctx, 6, headY + 8, 1, 4, hair);
    } else if (dir === "up") {
      px(ctx, 10, headY + 11, 5, 6, OUTLINE);
      px(ctx, 11, headY + 11, 3, 5, dark);
      px(ctx, 11, headY + 11, 1, 4, hair);
    }
  }
}

function drawHairFront(ctx: CanvasRenderingContext2D, appearance: Appearance, dir: CharDir, headY: number): void {
  const hair = appearance.hair;
  const dark = shade(hair, -0.34);
  const light = shade(hair, 0.22);
  const style = appearance.hairStyle;

  if (dir === "up") {
    // Back of the head: rounded hair silhouette.
    px(ctx, 8, headY, 8, 1, OUTLINE);
    px(ctx, 7, headY + 1, 10, 1, OUTLINE);
    px(ctx, 6, headY + 2, 12, 7, OUTLINE);
    px(ctx, 7, headY + 9, 10, 1, OUTLINE);
    px(ctx, 8, headY + 10, 8, 1, OUTLINE);
    px(ctx, 8, headY + 1, 8, 1, hair);
    px(ctx, 7, headY + 2, 10, 7, hair);
    px(ctx, 8, headY + 9, 8, 1, hair);
    px(ctx, 8, headY + 1, 7, 1, light);
    px(ctx, 7, headY + 2, 2, 6, dark);
    px(ctx, 7, headY + 7, 10, 2, dark);
    px(ctx, 10, headY + 3, 1, 4, dark);
    px(ctx, 14, headY + 3, 1, 5, dark);
    if (style === 1) {
      px(ctx, 6, headY + 8, 12, 3, dark);
      px(ctx, 10, headY + 10, 5, 6, OUTLINE);
      px(ctx, 11, headY + 10, 3, 5, dark);
      px(ctx, 11, headY + 10, 1, 3, hair);
      px(ctx, 10, headY + 10, 5, 1, "#8a4a34");
    }
    return;
  }

  // Cap of hair.
  px(ctx, 7, headY, 10, 1, OUTLINE);
  px(ctx, 6, headY + 1, 12, 2, hair);
  px(ctx, 8, headY + 1, 7, 1, light);
  px(ctx, 6, headY + 1, 1, 4, dark);
  px(ctx, 17, headY + 1, 1, 4, dark);

  // Solid fringe with a soft highlight.
  px(ctx, 7, headY + 3, 10, 1, hair);
  px(ctx, 8, headY + 3, 6, 1, light);
  px(ctx, 7, headY + 4, 1, 1, hair);
  px(ctx, 16, headY + 4, 1, 1, hair);
  if (style === 0) {
    px(ctx, 6, headY + 4, 1, 3, hair);
    px(ctx, 17, headY + 4, 1, 3, hair);
    px(ctx, 7, headY + 4, 1, 2, dark);
    px(ctx, 16, headY + 4, 1, 2, dark);
  } else if (style === 1) {
    // Short face-framing locks; the length falls behind the shoulders.
    px(ctx, 5, headY + 3, 2, 5, OUTLINE);
    px(ctx, 17, headY + 3, 2, 5, OUTLINE);
    px(ctx, 6, headY + 4, 1, 3, hair);
    px(ctx, 17, headY + 4, 1, 3, hair);
    px(ctx, 5, headY + 4, 1, 3, dark);
    px(ctx, 18, headY + 4, 1, 3, dark);
    px(ctx, 6, headY + 4, 1, 1, light);
  } else if (style === 2) {
    for (const [x, y, h] of [[7, -1, 2], [9, -2, 3], [11, -3, 4], [13, -2, 3], [15, -1, 2]] as const) {
      px(ctx, x, headY + y, 2, h, OUTLINE);
      px(ctx, x, headY + y, 1, h - 1, hair);
    }
    px(ctx, 6, headY + 4, 1, 2, hair);
    px(ctx, 17, headY + 4, 1, 2, hair);
  } else {
    // Bob with a side part.
    px(ctx, 5, headY + 3, 2, 7, OUTLINE);
    px(ctx, 17, headY + 3, 2, 7, OUTLINE);
    px(ctx, 6, headY + 4, 1, 5, hair);
    px(ctx, 17, headY + 4, 1, 5, hair);
    px(ctx, 5, headY + 4, 1, 5, dark);
    px(ctx, 18, headY + 4, 1, 5, dark);
    px(ctx, 8, headY + 3, 1, 1, light);
  }
}

function drawHat(ctx: CanvasRenderingContext2D, appearance: Appearance, headY: number): void {
  const hat = appearance.hat;
  const brimY = headY - 2;
  const crownY = headY - 7;
  if (hat === "straw") {
    // Brim connected to the crown.
    px(ctx, 4, brimY, 16, 1, "#efdcae");
    px(ctx, 4, brimY + 1, 16, 1, "#d9bd7f");
    px(ctx, 4, brimY, 1, 2, OUTLINE);
    px(ctx, 19, brimY, 1, 2, OUTLINE);
    px(ctx, 5, brimY + 2, 14, 1, "#8a6a3a");
    px(ctx, 8, crownY, 8, 5, OUTLINE);
    px(ctx, 9, crownY + 1, 6, 4, "#d8b872");
    px(ctx, 9, crownY + 1, 6, 1, "#f2e2b4");
    px(ctx, 9, crownY + 4, 6, 1, "#9a4a34");
    px(ctx, 12, crownY + 2, 1, 1, "#c47a4a");
  } else if (hat === "captain") {
    px(ctx, 4, brimY, 16, 1, "#1f3a57");
    px(ctx, 4, brimY + 1, 16, 1, "#101d2b");
    px(ctx, 4, brimY, 1, 2, OUTLINE);
    px(ctx, 19, brimY, 1, 2, OUTLINE);
    px(ctx, 5, brimY + 2, 14, 1, "#0b141d");
    px(ctx, 8, crownY, 8, 5, OUTLINE);
    px(ctx, 9, crownY + 1, 6, 3, "#f1eee1");
    px(ctx, 9, crownY + 4, 6, 1, "#1d3a57");
    px(ctx, 11, crownY + 2, 3, 2, "#d9a94a");
    px(ctx, 12, crownY + 2, 1, 1, "#fff1b8");
  } else if (hat === "bucket") {
    px(ctx, 5, brimY, 14, 1, "#e4d8b6");
    px(ctx, 5, brimY + 1, 14, 1, "#cbbd97");
    px(ctx, 5, brimY, 1, 2, OUTLINE);
    px(ctx, 18, brimY, 1, 2, OUTLINE);
    px(ctx, 6, brimY + 2, 12, 1, "#8a7a58");
    px(ctx, 8, crownY, 8, 5, OUTLINE);
    px(ctx, 9, crownY + 1, 6, 4, "#c2b48d");
    px(ctx, 9, crownY + 1, 6, 1, "#e4d8b6");
    px(ctx, 9, crownY + 4, 6, 1, "#7d6f52");
  } else if (hat === "flower") {
    px(ctx, 4, brimY, 16, 1, "#f7ecc8");
    px(ctx, 4, brimY + 1, 16, 1, "#e0cfa2");
    px(ctx, 4, brimY, 1, 2, OUTLINE);
    px(ctx, 19, brimY, 1, 2, OUTLINE);
    px(ctx, 5, brimY + 2, 14, 1, "#a08a5c");
    px(ctx, 8, crownY, 8, 5, OUTLINE);
    px(ctx, 9, crownY + 1, 6, 4, "#efe0b6");
    px(ctx, 9, crownY + 1, 6, 1, "#fbf1d4");
    for (const fx of [10, 13]) {
      const fy = crownY + 3;
      px(ctx, fx - 1, fy, 3, 1, "#e88ba6");
      px(ctx, fx, fy - 1, 1, 3, "#e88ba6");
      px(ctx, fx, fy, 1, 1, "#ffe1a8");
    }
    px(ctx, 5, brimY + 1, 1, 1, "#e88ba6");
    px(ctx, 18, brimY + 1, 1, 1, "#e88ba6");
  }
}

function drawHead(
  ctx: CanvasRenderingContext2D,
  appearance: Appearance,
  dir: CharDir,
  headY: number,
): void {
  const skin = appearance.skin;
  const skinLight = shade(skin, 0.14);
  const skinShade = shade(skin, -0.2);
  const hair = appearance.hair;
  const hairDark = shade(hair, -0.34);

  // Ears.
  px(ctx, 5, headY + 3, 2, 3, OUTLINE);
  px(ctx, 6, headY + 3, 1, 2, skinShade);
  px(ctx, 17, headY + 3, 2, 3, OUTLINE);
  px(ctx, 17, headY + 3, 1, 2, skinShade);

  if (dir === "up") {
    // Hair-covered head is drawn by drawHairFront.
    px(ctx, 10, headY + 10, 4, 3, OUTLINE);
    px(ctx, 11, headY + 10, 2, 3, skinShade);
    return;
  }

  // Head shape.
  px(ctx, 7, headY, 10, 1, OUTLINE);
  px(ctx, 6, headY + 1, 12, 10, OUTLINE);
  px(ctx, 7, headY + 1, 10, 9, skin);
  px(ctx, 7, headY + 1, 10, 1, skinLight);
  px(ctx, 7, headY + 2, 10, 1, shade(skin, -0.07));
  px(ctx, 7, headY + 6, 1, 2, skinShade);
  px(ctx, 16, headY + 6, 1, 2, skinShade);
  px(ctx, 7, headY + 7, 10, 2, skinShade);
  px(ctx, 8, headY + 9, 8, 1, skinShade);
  px(ctx, 8, headY + 10, 8, 1, OUTLINE);

  // Neck.
  px(ctx, 10, headY + 10, 4, 3, OUTLINE);
  px(ctx, 11, headY + 10, 2, 3, skinShade);

  if (dir === "down") {
    // Eyes.
    px(ctx, 9, headY + 4, 2, 2, EYE_LIGHT);
    px(ctx, 14, headY + 4, 2, 2, EYE_LIGHT);
    px(ctx, 10, headY + 4, 1, 2, EYE);
    px(ctx, 15, headY + 4, 1, 2, EYE);
    px(ctx, 9, headY + 3, 2, 1, hairDark);
    px(ctx, 14, headY + 3, 2, 1, hairDark);
    // Nose, mouth, blush.
    px(ctx, 12, headY + 6, 1, 1, skinShade);
    px(ctx, 11, headY + 7, 2, 1, MOUTH);
    px(ctx, 7, headY + 6, 1, 1, BLUSH);
    px(ctx, 16, headY + 6, 1, 1, BLUSH);
  } else if (dir === "left") {
    px(ctx, 8, headY + 4, 2, 2, EYE_LIGHT);
    px(ctx, 8, headY + 4, 1, 2, EYE);
    px(ctx, 8, headY + 3, 2, 1, hairDark);
    px(ctx, 6, headY + 6, 1, 1, skinShade);
    px(ctx, 7, headY + 7, 2, 1, MOUTH);
    px(ctx, 6, headY + 6, 1, 1, BLUSH);
  } else if (dir === "right") {
    px(ctx, 14, headY + 4, 2, 2, EYE_LIGHT);
    px(ctx, 15, headY + 4, 1, 2, EYE);
    px(ctx, 14, headY + 3, 2, 1, hairDark);
    px(ctx, 17, headY + 6, 1, 1, skinShade);
    px(ctx, 15, headY + 7, 2, 1, MOUTH);
    px(ctx, 17, headY + 6, 1, 1, BLUSH);
  }
}

type ArmMode = "walk" | "cast" | "hold" | "reel" | "up" | "cook" | "eat";

function drawArm(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  shirt: string,
  skin: string,
  left: boolean,
  mode: ArmMode,
): void {
  const sleeve = shade(shirt, -0.24);
  const sleeveLight = shade(shirt, 0.02);
  const skinShade = shade(skin, -0.16);
  const dir = left ? -1 : 1;
  const ix = x + 1;

  if (mode === "up") {
    px(ctx, x, y - 7, 3, 8, OUTLINE);
    px(ctx, ix, y - 6, 1, 4, sleeve);
    px(ctx, ix, y - 6, 1, 1, sleeveLight);
    px(ctx, x, y - 9, 3, 3, OUTLINE);
    px(ctx, ix, y - 8, 1, 2, skin);
    return;
  }
  if (mode === "cast") {
    px(ctx, x, y, 3, 6, OUTLINE);
    px(ctx, ix, y + 1, 1, 4, sleeve);
    px(ctx, x + dir * 2, y - 1, 4, 3, OUTLINE);
    px(ctx, x + dir * 2, y - 1, 3, 2, skin);
    return;
  }
  if (mode === "hold" || mode === "reel" || mode === "cook") {
    px(ctx, x, y, 3, 6, OUTLINE);
    px(ctx, ix, y + 1, 1, 4, sleeve);
    px(ctx, ix, y + 1, 1, 1, sleeveLight);
    px(ctx, x + dir * 2, y + 3, 3, 3, OUTLINE);
    px(ctx, x + dir * 2, y + 3, 2, 2, skin);
    px(ctx, x + dir * 2, y + 4, 2, 1, skinShade);
    return;
  }
  if (mode === "eat") {
    px(ctx, x, y, 3, 6, OUTLINE);
    px(ctx, ix, y + 1, 1, 3, sleeve);
    px(ctx, x + dir * 2, y - 2, 3, 3, OUTLINE);
    px(ctx, x + dir * 2, y - 1, 2, 2, skin);
    return;
  }
  // Walking swing.
  px(ctx, x, y + 1, 3, 6, OUTLINE);
  px(ctx, ix, y + 2, 2, 4, sleeve);
  px(ctx, ix, y + 2, 2, 1, sleeveLight);
  px(ctx, ix, y + 6, 2, 1, skin);
}

function drawTorso(
  ctx: CanvasRenderingContext2D,
  appearance: Appearance,
  dir: CharDir,
  step: number,
  bob: number,
  mode: ArmMode,
): void {
  const shirt = appearance.shirt;
  const shirtLight = shade(shirt, 0.22);
  const shirtDark = shade(shirt, -0.3);
  const pants = appearance.pants;
  const skin = appearance.skin;
  const y = 17 + bob;

  // Body.
  px(ctx, 5, y, 14, 10, OUTLINE);
  px(ctx, 6, y + 1, 12, 8, shirt);
  px(ctx, 6, y + 1, 12, 1, shirtLight);
  px(ctx, 6, y + 2, 2, 5, shirtDark);
  px(ctx, 16, y + 2, 2, 5, shirtDark);
  px(ctx, 6, y + 7, 12, 2, shade(shirt, -0.42));

  if (dir === "up") {
    // Backpack.
    px(ctx, 7, y + 1, 10, 8, OUTLINE);
    px(ctx, 8, y + 2, 8, 6, SATCHEL);
    px(ctx, 8, y + 2, 8, 1, SATCHEL_LIGHT);
    px(ctx, 8, y + 4, 8, 1, shade(SATCHEL, -0.24));
    px(ctx, 10, y + 3, 4, 1, BUCKLE);
    px(ctx, 8, y - 1, 1, 3, STRAP);
    px(ctx, 15, y - 1, 1, 3, STRAP);
  } else {
    // Collar and neckerchief.
    px(ctx, 9, y, 6, 1, OUTLINE);
    px(ctx, 8, y + 1, 2, 1, shirtLight);
    px(ctx, 14, y + 1, 2, 1, shirtLight);
    px(ctx, 10, y + 1, 4, 1, SCARF);
    px(ctx, 10, y + 2, 3, 1, SCARF_DARK);
    px(ctx, 13, y + 1, 1, 2, SCARF);
    px(ctx, 14, y + 2, 1, 2, SCARF_DARK);
    // Suspenders.
    px(ctx, 8, y + 1, 1, 6, STRAP);
    px(ctx, 15, y + 1, 1, 6, STRAP);
    px(ctx, 8, y + 4, 1, 1, BUCKLE);
    px(ctx, 15, y + 4, 1, 1, BUCKLE);
    // Belt.
    px(ctx, 6, y + 7, 12, 1, "#4a3524");
    px(ctx, 11, y + 7, 2, 1, BUCKLE);
  }

  // Satchel at the hip.
  if (dir === "down") {
    px(ctx, 3, y + 6, 4, 4, OUTLINE);
    px(ctx, 4, y + 7, 2, 2, SATCHEL);
    px(ctx, 4, y + 7, 2, 1, SATCHEL_LIGHT);
    for (let i = 0; i < 6; i++) px(ctx, 15 - i, y + 1 + i, 1, 1, STRAP);
  } else if (dir === "left") {
    px(ctx, 4, y + 5, 3, 4, OUTLINE);
    px(ctx, 5, y + 6, 1, 2, SATCHEL);
  } else if (dir === "right") {
    px(ctx, 17, y + 5, 3, 4, OUTLINE);
    px(ctx, 17, y + 6, 1, 2, SATCHEL);
  }

  // Pants under the belt.
  px(ctx, 7, y + 8, 10, 2, OUTLINE);
  px(ctx, 8, y + 8, 8, 2, pants);
  px(ctx, 8, y + 8, 8, 1, shade(pants, 0.12));

  const swingL = step > 0 ? 1 : 0;
  const swingR = step < 0 ? 1 : 0;
  if (dir === "left") {
    drawArm(ctx, 2, y + 1 + swingL, shirt, skin, true, mode);
  } else if (dir === "right") {
    drawArm(ctx, 19, y + 1 + swingR, shirt, skin, false, mode);
  } else {
    drawArm(ctx, 2, y + 1 + swingL, shirt, skin, true, mode);
    drawArm(ctx, 19, y + 1 + swingR, shirt, skin, false, mode);
  }
}

function drawLeg(
  ctx: CanvasRenderingContext2D,
  x: number,
  hipY: number,
  lift: number,
  pants: string,
  pantsLight: string,
  pantsDark: string,
): void {
  const bootY = 29 - lift;
  px(ctx, x - 1, hipY, 5, 6, OUTLINE);
  px(ctx, x, hipY, 3, 5, pants);
  px(ctx, x, hipY, 1, 5, pantsLight);
  px(ctx, x + 2, hipY, 1, 5, pantsDark);
  px(ctx, x - 1, bootY, 5, 4, OUTLINE);
  px(ctx, x, bootY, 3, 3, BOOT);
  px(ctx, x, bootY, 3, 1, BOOT_LIGHT);
  px(ctx, x + 2, bootY + 1, 1, 2, BOOT_DARK);
}

function drawLegs(
  ctx: CanvasRenderingContext2D,
  appearance: Appearance,
  step: number,
  bob: number,
  running: boolean,
): void {
  const pants = appearance.pants;
  const pantsLight = shade(pants, 0.16);
  const pantsDark = shade(pants, -0.3);
  const hipY = 25 + bob;
  const spread = running ? 1 : 0;
  const leftX = 8 - spread - (step > 0 ? 1 : 0);
  const rightX = 13 + spread + (step < 0 ? 1 : 0);
  const leftLift = step < 0 ? 1 : 0;
  const rightLift = step > 0 ? 1 : 0;

  drawLeg(ctx, leftX, hipY, leftLift, pants, pantsLight, pantsDark);
  drawLeg(ctx, rightX, hipY, rightLift, pants, pantsDark, pantsDark);
}

function drawRod(ctx: CanvasRenderingContext2D, dir: CharDir, state: CharState, frame: number): void {
  let hx = 21;
  let hy = 24;
  let tx = 26;
  let ty = 9;
  if (dir === "left") {
    hx = 3;
    hy = 24;
    tx = -2;
    ty = 9;
  } else if (dir === "up") {
    hx = 21;
    hy = 23;
    tx = 25;
    ty = 7;
  }
  if (state === "cast" && frame === 1) {
    tx += dir === "left" ? -3 : 3;
    ty -= 2;
  }
  if (state === "reel") ty += 3;
  const steps = Math.max(Math.abs(tx - hx), Math.abs(ty - hy));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = Math.round(hx + (tx - hx) * t);
    const y = Math.round(hy + (ty - hy) * t);
    px(ctx, x, y, 1, 1, i < steps * 0.35 ? ROD_LIGHT : ROD);
    if (i === steps) px(ctx, x, y, 1, 2, ROD_TIP);
  }
  px(ctx, hx - 1, hy - 1, 3, 3, REEL);
  px(ctx, hx, hy, 1, 1, "#5a3a25");
  if (state === "wait" || state === "reel") {
    const drop = state === "reel" ? 4 : 7;
    for (let i = 1; i <= drop; i++) px(ctx, tx + 1, ty + i, 1, 1, LINE);
  }
}

function drawCookingProp(ctx: CanvasRenderingContext2D, dir: CharDir): void {
  const x = dir === "left" ? 0 : 18;
  px(ctx, x, 24, 6, 2, "#3b3b44");
  px(ctx, x + 1, 22, 4, 2, "#6b6b78");
  px(ctx, x + 1, 21, 4, 1, "#a2a2b0");
  px(ctx, x + 2, 20, 1, 1, "#f2c94c");
  px(ctx, x + 4, 20, 1, 1, "#ff9a4a");
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  appearance: Appearance,
  dir: CharDir,
  state: CharState,
  frame: number,
): void {
  const step = state === "walk" ? [0, 1, 0, -1][frame % 4] : state === "run" ? [0, 2, 0, -2][frame % 4] : 0;
  const bob = state === "walk" || state === "run" || state === "wait" || state === "reel"
    ? (frame % 2 === 1 ? -1 : 0)
    : 0;
  const headY = 5 + bob;
  let mode: ArmMode = "walk";
  if (state === "run") mode = "walk";
  else if (state === "cast") mode = "cast";
  else if (state === "wait") mode = "hold";
  else if (state === "reel") mode = "reel";
  else if (state === "celebrate") mode = "up";
  else if (state === "cook") mode = "cook";
  else if (state === "eat") mode = "eat";

  ctx.save();
  ctx.translate(0, TOP);
  drawShadow(ctx);
  drawHairBack(ctx, appearance, dir, headY);
  drawLegs(ctx, appearance, step, bob, state === "run");
  drawTorso(ctx, appearance, dir, step, bob, mode);
  drawHead(ctx, appearance, dir, headY);
  drawHairFront(ctx, appearance, dir, headY);
  drawHat(ctx, appearance, headY);
  if (state === "cast" || state === "wait" || state === "reel" || state === "celebrate") {
    drawRod(ctx, dir, state, frame);
  }
  if (state === "cook") drawCookingProp(ctx, dir);
  if (state === "eat") {
    const mx = dir === "left" ? 6 : dir === "right" ? 16 : 12;
    px(ctx, mx, headY + 7, 2, 2, "#f2c94c");
    px(ctx, mx, headY + 7, 1, 1, "#ff9a4a");
  }
  ctx.restore();
}

export function appearanceKey(appearance: Appearance): string {
  return hashString(JSON.stringify(appearance)).toString(36);
}

export interface CharacterSheet {
  key: string;
  anims: Record<CharDir, string>;
  states: Record<CharState, Record<CharDir, string>>;
}

export function createCharacterSheet(scene: Phaser.Scene, appearance: Appearance): CharacterSheet {
  const hash = appearanceKey(appearance);
  const key = `char-${hash}`;
  if (!scene.textures.exists(key)) {
    const { canvas, ctx } = makeCanvas(CW * 4, CH * ROWS);
    for (const state of CHAR_STATES) {
      const frames = CHAR_STATE_FRAMES[state];
      for (let dirIndex = 0; dirIndex < DIRS.length; dirIndex++) {
        const row = STATE_ROW[state] + dirIndex;
        for (let frame = 0; frame < frames; frame++) {
          ctx.save();
          ctx.translate(frame * CW, row * CH);
          drawFrame(ctx, appearance, DIRS[dirIndex], state, frame);
          ctx.restore();
        }
      }
    }
    addSpriteSheetFromCanvas(scene, key, canvas, CW, CH);
  }
  const states = {} as Record<CharState, Record<CharDir, string>>;
  for (const state of CHAR_STATES) {
    const byDir = {} as Record<CharDir, string>;
    for (let dirIndex = 0; dirIndex < DIRS.length; dirIndex++) {
      const dir = DIRS[dirIndex];
      const animKey = `char-${hash}-${state}-${dir}`;
      byDir[dir] = animKey;
      if (!scene.anims.exists(animKey)) {
        const frames = CHAR_STATE_FRAMES[state];
        const row = STATE_ROW[state] + dirIndex;
        scene.anims.create({
          key: animKey,
          frames: Array.from({ length: frames }, (_, frame) => ({ key, frame: row * 4 + frame })),
          frameRate: state === "run" ? 13 : state === "walk" ? 8 : state === "reel" ? 10 : 6,
          repeat: -1,
        });
      }
    }
    states[state] = byDir;
  }
  const anims = states.walk;
  return { key, anims, states };
}

export function stateFrame(appearance: Appearance, dir: CharDir, state: CharState, frame = 0): { key: string; frame: number } {
  const dirIndex = DIRS.indexOf(dir);
  const row = STATE_ROW[state] + dirIndex;
  return { key: `char-${appearanceKey(appearance)}`, frame: row * 4 + (frame % CHAR_STATE_FRAMES[state]) };
}

export function idleFrame(appearance: Appearance, dir: CharDir): { key: string; frame: number } {
  return stateFrame(appearance, dir, "walk", 0);
}

export function renderCharacterCanvas(appearance: Appearance, width = 64, height = 96, state: CharState = "walk"): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(width, height);
  ctx.imageSmoothingEnabled = false;
  const source = makeCanvas(CW, CH);
  drawFrame(source.ctx, appearance, "down", state, 0);
  const scale = Math.max(1, Math.floor(Math.min(width / CW, height / CH)));
  const drawW = CW * scale;
  const drawH = CH * scale;
  ctx.drawImage(source.canvas, Math.floor((width - drawW) / 2), Math.floor((height - drawH) / 2), drawW, drawH);
  return canvas;
}

export const CHARACTER_DIRS = DIRS;
