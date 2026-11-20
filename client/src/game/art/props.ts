import type * as Phaser from "phaser";
import type { LocationId } from "@shared/types";
import { makeCanvas, px, pixelEllipse, shade, line } from "./pixel";
import { PALETTES } from "./tiles";

function add(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, canvas);
}

export function createPropTextures(scene: Phaser.Scene): void {
  {
    const { canvas, ctx } = makeCanvas(34, 54);
    ctx.globalAlpha = 0.22;
    pixelEllipse(ctx, 17, 50, 12, 3, "#071722");
    ctx.globalAlpha = 1;
    for (let y = 18; y < 50; y++) {
      const sway = Math.round(Math.sin((y - 18) * 0.11) * 2);
      px(ctx, 15 + sway, y, 4, 1, "#5a3a25");
      px(ctx, 16 + sway, y, 2, 1, "#8a5c34");
      px(ctx, 14 + sway, y, 1, 1, "#3c2518");
    }
    const cx = 17;
    const cy = 17;
    const fronds: Array<[number, number, number, number]> = [
      [-15, -8, -1, 1], [15, -8, 1, 1], [-13, 4, -1, 2], [13, 4, 1, 2],
      [-8, -14, 0, 1], [8, -14, 0, 1], [-16, 8, -1, 3], [16, 8, 1, 3],
    ];
    for (const [dx, dy, sag, thick] of fronds) {
      for (let t = 0; t <= 1; t += 0.1) {
        const x = cx + dx * t;
        const y = cy + dy * t + sag * t * t * 2;
        px(ctx, x, y, 3, thick + 1, "#2d7444");
        px(ctx, x, y, 2, thick, "#4da55f");
        px(ctx, x, y, 1, thick, "#73c777");
      }
    }
    px(ctx, 14, 13, 6, 5, "#2d7444");
    px(ctx, 15, 13, 4, 3, "#4da55f");
    px(ctx, 16, 14, 2, 1, "#8bdb8a");
    px(ctx, 9, 33, 3, 2, "#d9b45a");
    px(ctx, 22, 30, 3, 2, "#c4a052");
    add(scene, "prop-palm", canvas);
  }

  {
    const { canvas, ctx } = makeCanvas(28, 50);
    ctx.globalAlpha = 0.2;
    pixelEllipse(ctx, 14, 47, 9, 3, "#071722");
    ctx.globalAlpha = 1;
    px(ctx, 12, 30, 4, 18, "#5a3a25");
    px(ctx, 13, 30, 2, 18, "#805233");
    for (let i = 0; i < 4; i++) {
      const width = 22 - i * 4;
      const y = 8 + i * 8;
      const color = i % 2 === 0 ? "#2e6448" : "#397654";
      for (let row = 0; row < 9; row++) {
        const rowWidth = width - row * 1.6;
        px(ctx, 14 - rowWidth / 2, y + row, rowWidth, 1, color);
      }
      px(ctx, 14 - width / 2 + 2, y + 1, 2, 5, "#4d8e64");
      px(ctx, 6, y + 8, width, 1, "#173e2b");
    }
    px(ctx, 12, 5, 4, 6, "#2e6448");
    px(ctx, 13, 4, 2, 4, "#4d8e64");
    add(scene, "prop-pine", canvas);
  }

  {
    const { canvas, ctx } = makeCanvas(36, 48);
    ctx.globalAlpha = 0.22;
    pixelEllipse(ctx, 18, 45, 11, 3, "#071722");
    ctx.globalAlpha = 1;
    px(ctx, 16, 27, 5, 18, "#5a3a25");
    px(ctx, 17, 27, 2, 18, "#845635");
    pixelEllipse(ctx, 18, 19, 13, 12, "#1e5735", "#0c2e1d");
    pixelEllipse(ctx, 16, 16, 9, 8, "#2f7a47");
    pixelEllipse(ctx, 15, 14, 6, 5, "#469b5a");
    px(ctx, 12, 12, 3, 2, "#67bb6d");
    px(ctx, 22, 22, 2, 2, "#173f28");
    px(ctx, 9, 24, 2, 2, "#255f38");
    add(scene, "prop-tree", canvas);
  }

  {
    const { canvas, ctx } = makeCanvas(20, 16);
    ctx.globalAlpha = 0.2;
    pixelEllipse(ctx, 10, 14, 7, 2, "#071722");
    ctx.globalAlpha = 1;
    pixelEllipse(ctx, 10, 8, 7, 5, "#27633d", "#153a25");
    pixelEllipse(ctx, 8, 6, 4, 3, "#3e8a53");
    px(ctx, 6, 5, 2, 1, "#63b36a");
    px(ctx, 13, 9, 2, 1, "#1a492d");
    add(scene, "prop-bush", canvas);
  }

  {
    const { canvas, ctx } = makeCanvas(10, 12);
    px(ctx, 4, 6, 1, 5, "#3f7d45");
    px(ctx, 4, 4, 3, 3, "#f2c9d0");
    px(ctx, 5, 3, 1, 1, "#fff4dd");
    px(ctx, 3, 4, 1, 1, "#e88b9d");
    px(ctx, 7, 4, 1, 1, "#e88b9d");
    px(ctx, 5, 5, 1, 1, "#f7df7a");
    add(scene, "prop-flower", canvas);
  }

  {
    const { canvas, ctx } = makeCanvas(20, 15);
    ctx.globalAlpha = 0.2;
    pixelEllipse(ctx, 10, 13, 8, 2, "#071722");
    ctx.globalAlpha = 1;
    px(ctx, 2, 6, 16, 7, "#4a5a5c");
    px(ctx, 3, 5, 13, 2, "#78898a");
    px(ctx, 4, 8, 5, 2, "#657577");
    px(ctx, 11, 9, 4, 1, "#38484a");
    px(ctx, 3, 12, 14, 1, "#2e3c3e");
    px(ctx, 5, 6, 2, 1, "#9aabaa");
    add(scene, "prop-rock", canvas);
  }

  {
    const { canvas, ctx } = makeCanvas(14, 16);
    px(ctx, 1, 3, 12, 12, "#4e3521");
    px(ctx, 2, 4, 10, 10, "#8f5d32");
    px(ctx, 2, 5, 10, 2, "#b97b43");
    px(ctx, 2, 10, 10, 2, "#5f3d23");
    px(ctx, 2, 4, 1, 10, "#6d4829");
    px(ctx, 11, 4, 1, 10, "#6d4829");
    px(ctx, 5, 8, 4, 1, "#c99559");
    add(scene, "prop-barrel", canvas);
  }

  {
    const { canvas, ctx } = makeCanvas(15, 15);
    px(ctx, 1, 2, 13, 12, "#5a3b22");
    px(ctx, 2, 3, 11, 10, "#9a6a3f");
    px(ctx, 2, 3, 11, 1, "#c18d55");
    px(ctx, 7, 3, 1, 10, "#5a3b22");
    px(ctx, 2, 8, 11, 1, "#5a3b22");
    px(ctx, 4, 5, 1, 1, "#d3a66a");
    px(ctx, 10, 11, 1, 1, "#5a3b22");
    add(scene, "prop-crate", canvas);
  }

  {
    const { canvas, ctx } = makeCanvas(12, 32);
    px(ctx, 5, 12, 2, 19, "#3e4b4d");
    px(ctx, 4, 30, 4, 1, "#2a3536");
    px(ctx, 3, 2, 6, 10, "#26383c");
    px(ctx, 4, 3, 4, 8, "#f3d58a");
    px(ctx, 4, 4, 4, 1, "#fff0be");
    px(ctx, 5, 5, 2, 5, "#d5a93f");
    px(ctx, 3, 1, 6, 1, "#3e4b4d");
    ctx.globalAlpha = 0.25;
    pixelEllipse(ctx, 6, 7, 7, 6, "#ffe3a0");
    ctx.globalAlpha = 1;
    add(scene, "prop-lamp", canvas);
  }

  {
    const { canvas, ctx } = makeCanvas(52, 30);
    ctx.globalAlpha = 0.25;
    pixelEllipse(ctx, 26, 27, 22, 3, "#071722");
    ctx.globalAlpha = 1;
    for (let x = 3; x < 49; x++) {
      const edge = Math.abs(x - 26) / 23;
      const top = 9 + Math.round(edge * 5);
      px(ctx, x, top, 1, 18 - Math.round(edge * 6), "#6e452b");
      if (x % 5 === 0) px(ctx, x, top + 1, 1, 12, "#4a2d1b");
    }
    px(ctx, 4, 10, 44, 3, "#b07a49");
    px(ctx, 7, 13, 38, 10, "#8a5a35");
    px(ctx, 10, 15, 32, 2, "#b9834d");
    px(ctx, 15, 20, 22, 1, "#5b3a22");
    px(ctx, 23, 2, 2, 13, "#5a3a25");
    px(ctx, 24, 1, 5, 4, "#e6e0c6");
    px(ctx, 26, 2, 3, 2, "#f8f4df");
    add(scene, "prop-boat", canvas);
  }

  {
    const { canvas, ctx } = makeCanvas(22, 22);
    px(ctx, 9, 10, 3, 11, "#5a3a25");
    px(ctx, 2, 3, 18, 9, "#8a5a35");
    px(ctx, 3, 4, 16, 7, "#b9814a");
    px(ctx, 3, 4, 16, 1, "#d6a463");
    px(ctx, 5, 7, 12, 1, "#6c4529");
    px(ctx, 6, 9, 10, 1, "#6c4529");
    add(scene, "prop-sign", canvas);
  }

  {
    const { canvas, ctx } = makeCanvas(8, 14);
    px(ctx, 2, 0, 4, 14, "#5a3a25");
    px(ctx, 3, 1, 2, 12, "#8a5c34");
    px(ctx, 2, 2, 4, 1, "#3b2517");
    px(ctx, 2, 9, 4, 1, "#3b2517");
    add(scene, "prop-post", canvas);
  }

  {
    const { canvas, ctx } = makeCanvas(22, 20);
    ctx.globalAlpha = 0.25;
    pixelEllipse(ctx, 11, 17, 8, 2, "#071722");
    ctx.globalAlpha = 1;
    for (let i = 0; i < 4; i++) {
      const x = 4 + i * 4;
      const h = 6 + (i % 2) * 5;
      px(ctx, x, 15 - h, 2, h, "#c34c71");
      px(ctx, x, 15 - h, 1, h, "#ff8aa6");
      px(ctx, x - 2, 15 - h + 2, 2, 3, "#ff9bb5");
      px(ctx, x + 2, 15 - h + 4, 2, 2, "#e05a82");
    }
    px(ctx, 3, 15, 16, 2, "#8f3a59");
    add(scene, "prop-coral", canvas);
  }

  {
    const { canvas, ctx } = makeCanvas(6, 6);
    pixelEllipse(ctx, 3, 3, 2, 2, "#c9f7ef", "#7ddbd0");
    px(ctx, 2, 2, 1, 1, "#ffffff");
    add(scene, "prop-bubble", canvas);
  }

  {
    const { canvas, ctx } = makeCanvas(40, 20);
    px(ctx, 0, 0, 40, 20, "#1f4f3d");
    px(ctx, 2, 2, 36, 16, "#2e6b50");
    for (let i = 0; i < 9; i++) {
      const x = 4 + i * 4;
      const y = 5 + (i % 3) * 4;
      px(ctx, x, y, 2, 2, "#f2c94c");
      px(ctx, x + 1, y, 1, 1, "#fff0a8");
    }
    add(scene, "prop-crate-market", canvas);
  }

  // Campfire: stone ring, crossed logs, embers.
  {
    const { canvas, ctx } = makeCanvas(34, 30);
    ctx.globalAlpha = 0.24;
    pixelEllipse(ctx, 17, 27, 14, 3, "#071722");
    ctx.globalAlpha = 1;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const x = 17 + Math.cos(a) * 11;
      const y = 22 + Math.sin(a) * 5;
      px(ctx, x - 1, y - 1, 4, 3, "#4b4f55");
      px(ctx, x, y - 1, 2, 2, "#737a80");
      px(ctx, x, y, 1, 1, "#9aa1a6");
    }
    // Logs.
    for (let i = 0; i < 10; i++) {
      px(ctx, 8 + i, 21 - Math.floor(i * 0.4), 3, 3, "#5a3a25");
      px(ctx, 8 + i, 21 - Math.floor(i * 0.4), 2, 1, "#8a5c34");
    }
    for (let i = 0; i < 10; i++) {
      px(ctx, 24 - i, 21 - Math.floor(i * 0.4), 3, 3, "#4a2e1d");
      px(ctx, 24 - i, 21 - Math.floor(i * 0.4), 2, 1, "#7a4f2d");
    }
    px(ctx, 12, 18, 10, 3, "#3a2417");
    add(scene, "prop-campfire", canvas);
  }

  // Animated flame frames.
  for (let frame = 0; frame < 3; frame++) {
    const { canvas, ctx } = makeCanvas(18, 24);
    const sway = [0, 1, -1][frame];
    for (let y = 0; y < 16; y++) {
      const t = y / 15;
      const w = Math.max(1, Math.round(2 + t * 7 - (frame === 1 && t > 0.6 ? 1 : 0)));
      const cx = 9 + Math.round(sway * t * 2);
      px(ctx, cx - Math.floor(w / 2), 18 - y, w, 1, y < 5 ? "#ffe27a" : y < 11 ? "#ff9a3c" : "#e8513d");
      if (y > 3 && y < 12) px(ctx, cx, 18 - y, 1, 1, "#fff3c4");
    }
    px(ctx, 6, 18, 7, 2, "#e8513d");
    px(ctx, 7, 19, 5, 1, "#8a2f22");
    add(scene, `fire-${frame}`, canvas);
  }
  if (!scene.anims.exists("campfire-burn")) {
    scene.anims.create({
      key: "campfire-burn",
      frames: [{ key: "fire-0" }, { key: "fire-1" }, { key: "fire-2" }, { key: "fire-1" }],
      frameRate: 7,
      repeat: -1,
    });
  }

  // Warm glow and smoke.
  {
    const { canvas, ctx } = makeCanvas(56, 56);
    for (let r = 26; r > 2; r -= 3) {
      ctx.globalAlpha = 0.05;
      pixelEllipse(ctx, 28, 28, r, r, "#ffb347");
    }
    ctx.globalAlpha = 1;
    add(scene, "prop-glow", canvas);
  }
  {
    const { canvas, ctx } = makeCanvas(8, 8);
    ctx.globalAlpha = 0.42;
    pixelEllipse(ctx, 4, 4, 3, 3, "#cfd6d8");
    ctx.globalAlpha = 1;
    add(scene, "prop-smoke", canvas);
  }

  // Seaweed.
  {
    const { canvas, ctx } = makeCanvas(12, 24);
    ctx.globalAlpha = 0.2;
    pixelEllipse(ctx, 6, 22, 5, 2, "#071722");
    ctx.globalAlpha = 1;
    for (let i = 0; i < 3; i++) {
      const baseX = 3 + i * 3;
      for (let y = 0; y < 18; y++) {
        const sway = Math.round(Math.sin(y * 0.4 + i * 1.7) * 2);
        px(ctx, baseX + sway, 22 - y, 2, 1, i % 2 === 0 ? "#2f7a4a" : "#3e9a5c");
        if (y % 4 === 0) px(ctx, baseX + sway, 22 - y, 1, 1, "#6fc47e");
      }
    }
    add(scene, "prop-seaweed", canvas);
  }

  // Crab.
  {
    const { canvas, ctx } = makeCanvas(14, 10);
    ctx.globalAlpha = 0.2;
    pixelEllipse(ctx, 7, 9, 5, 1, "#071722");
    ctx.globalAlpha = 1;
    px(ctx, 3, 4, 8, 4, "#c14b35");
    px(ctx, 4, 3, 6, 1, "#e8694a");
    px(ctx, 4, 5, 6, 1, "#8f3224");
    px(ctx, 1, 4, 2, 2, "#c14b35");
    px(ctx, 11, 4, 2, 2, "#c14b35");
    px(ctx, 4, 2, 1, 1, "#241a2a");
    px(ctx, 9, 2, 1, 1, "#241a2a");
    for (const x of [3, 5, 7, 9, 11]) px(ctx, x, 8, 1, 1, "#8f3224");
    add(scene, "prop-crab", canvas);
  }

  // Seagull.
  {
    const { canvas, ctx } = makeCanvas(18, 8);
    px(ctx, 7, 3, 4, 2, "#f4f1e6");
    px(ctx, 8, 2, 2, 1, "#ffffff");
    px(ctx, 11, 3, 2, 1, "#f2c94c");
    px(ctx, 2, 1, 5, 1, "#e8e4d6");
    px(ctx, 4, 2, 3, 1, "#f4f1e6");
    px(ctx, 11, 1, 5, 1, "#e8e4d6");
    px(ctx, 11, 2, 3, 1, "#f4f1e6");
    px(ctx, 8, 3, 1, 1, "#241a2a");
    add(scene, "prop-gull", canvas);
  }

  // Shells and starfish.
  {
    const { canvas, ctx } = makeCanvas(8, 6);
    px(ctx, 1, 3, 6, 2, "#f6d8c8");
    px(ctx, 2, 2, 4, 1, "#fce8dd");
    px(ctx, 3, 3, 1, 1, "#e0a08a");
    px(ctx, 5, 3, 1, 1, "#e0a08a");
    px(ctx, 2, 4, 4, 1, "#d99a86");
    add(scene, "prop-shell", canvas);
  }
  {
    const { canvas, ctx } = makeCanvas(10, 10);
    const arms = [
      [5, 1, 1, 3], [5, 6, 1, 3], [1, 5, 3, 1], [6, 5, 3, 1],
    ];
    for (const [x, y, w, h] of arms) px(ctx, x, y, w, h, "#e8794a");
    px(ctx, 3, 3, 4, 4, "#f2955e");
    px(ctx, 4, 4, 2, 2, "#ffd08a");
    add(scene, "prop-starfish", canvas);
  }

  // Fishing net draped on the dock.
  {
    const { canvas, ctx } = makeCanvas(24, 16);
    for (let x = 1; x < 23; x += 3) px(ctx, x, 2, 1, 12, "#c9b78c");
    for (let y = 2; y < 14; y += 3) px(ctx, 1, y, 22, 1, "#a8956a");
    px(ctx, 1, 1, 22, 1, "#6b4a2f");
    px(ctx, 1, 13, 22, 1, "#6b4a2f");
    add(scene, "prop-net", canvas);
  }

  // Footprints pressed into the sand.
  {
    const { canvas, ctx } = makeCanvas(9, 7);
    ctx.globalAlpha = 0.5;
    px(ctx, 1, 1, 3, 2, "#b98f4e");
    px(ctx, 2, 3, 2, 2, "#a87f45");
    px(ctx, 5, 2, 3, 2, "#b98f4e");
    px(ctx, 6, 4, 2, 2, "#a87f45");
    ctx.globalAlpha = 1;
    add(scene, "prop-footprint", canvas);
  }
}

function drawSkiff(scene: Phaser.Scene, key: string, trim: string): void {
  const { canvas, ctx } = makeCanvas(56, 30);
  ctx.globalAlpha = 0.25;
  pixelEllipse(ctx, 28, 27, 22, 3, "#071722");
  ctx.globalAlpha = 1;
  // Hull.
  for (let x = 8; x < 48; x++) {
    const edge = Math.abs(x - 28) / 20;
    const top = 15 + Math.round(edge * 3);
    px(ctx, x, top, 1, 9 - Math.round(edge * 4), "#7a4f2e");
    px(ctx, x, top + 1, 1, 6 - Math.round(edge * 3), "#a97945");
    px(ctx, x, top + 7 - Math.round(edge * 4), 1, 1, trim);
  }
  px(ctx, 6, 15, 4, 3, "#5d3a22");
  px(ctx, 46, 15, 4, 3, "#5d3a22");
  // Mast and sail.
  px(ctx, 27, 2, 2, 14, "#5d3a22");
  px(ctx, 28, 3, 1, 11, "#8a5c34");
  px(ctx, 29, 4, 12, 8, "#f4ecd2");
  px(ctx, 29, 4, 12, 1, "#d8c9a4");
  px(ctx, 29, 11, 12, 1, "#d8c9a4");
  px(ctx, 34, 5, 1, 6, "#e6dcc0");
  px(ctx, 30, 2, 8, 2, trim);
  // Little lantern at the bow.
  px(ctx, 47, 12, 2, 3, "#e8c06a");
  px(ctx, 48, 13, 1, 1, "#fff2c2");
  add(scene, key, canvas);
}

function drawCreature(scene: Phaser.Scene, key: string, kind: string, color: string): void {
  if (kind === "whale") {
    const { canvas, ctx } = makeCanvas(128, 64);
    ctx.globalAlpha = 0.25;
    pixelEllipse(ctx, 64, 58, 46, 4, "#071722");
    ctx.globalAlpha = 1;
    pixelEllipse(ctx, 62, 32, 40, 16, "#203040");
    pixelEllipse(ctx, 62, 32, 38, 14, color);
    pixelEllipse(ctx, 62, 38, 30, 7, "#c9dce8");
    pixelEllipse(ctx, 98, 27, 14, 10, color);
    px(ctx, 104, 25, 3, 3, "#0b1a20");
    px(ctx, 105, 26, 1, 1, "#f8f4df");
    px(ctx, 44, 18, 4, 4, "#dff2ff");
    px(ctx, 36, 36, 10, 3, "#2f4f63");
    // Tail.
    px(ctx, 20, 26, 8, 4, color);
    px(ctx, 12, 18, 10, 6, color);
    px(ctx, 12, 34, 10, 6, color);
    px(ctx, 20, 30, 8, 4, color);
    // Water spout.
    px(ctx, 92, 12, 2, 8, "#bfe9ff");
    px(ctx, 89, 9, 8, 2, "#dff6ff");
    add(scene, key, canvas);
  } else if (kind === "serpent") {
    const { canvas, ctx } = makeCanvas(112, 64);
    ctx.globalAlpha = 0.25;
    pixelEllipse(ctx, 56, 59, 38, 3, "#071722");
    ctx.globalAlpha = 1;
    for (let i = 0; i < 5; i++) {
      const x = 14 + i * 17;
      const y = 44 - Math.sin(i * 1.2) * 14;
      pixelEllipse(ctx, x, y, 10, 7, "#1f3f3a");
      pixelEllipse(ctx, x, y, 8, 5, color);
      px(ctx, x - 3, y - 3, 2, 2, "#dff6ee");
    }
    pixelEllipse(ctx, 92, 22, 13, 9, color);
    px(ctx, 96, 20, 3, 3, "#0b1a20");
    px(ctx, 97, 21, 1, 1, "#ffe36a");
    px(ctx, 88, 16, 3, 3, "#dff6ee");
    px(ctx, 100, 27, 8, 2, "#ff6b6b");
    add(scene, key, canvas);
  } else if (kind === "kraken") {
    const { canvas, ctx } = makeCanvas(104, 88);
    ctx.globalAlpha = 0.25;
    pixelEllipse(ctx, 52, 82, 34, 4, "#071722");
    ctx.globalAlpha = 1;
    for (let i = 0; i < 6; i++) {
      const x = 20 + i * 13;
      const bend = i % 2 === 0 ? -1 : 1;
      for (let j = 0; j < 8; j++) {
        const y = 44 + j * 5;
        px(ctx, x + Math.round(Math.sin(j * 0.7) * 6) + bend * j, y, 4, 4, j % 2 ? color : "#7f5bb0");
      }
    }
    pixelEllipse(ctx, 52, 34, 20, 15, "#2a1f3d");
    pixelEllipse(ctx, 52, 33, 18, 13, color);
    px(ctx, 44, 28, 5, 6, "#ffe36a");
    px(ctx, 57, 28, 5, 6, "#ffe36a");
    px(ctx, 45, 30, 2, 3, "#0b1a20");
    px(ctx, 58, 30, 2, 3, "#0b1a20");
    px(ctx, 49, 40, 7, 3, "#1a1226");
    add(scene, key, canvas);
  } else {
    const { canvas, ctx } = makeCanvas(96, 44);
    ctx.globalAlpha = 0.25;
    pixelEllipse(ctx, 48, 39, 32, 3, "#071722");
    ctx.globalAlpha = 1;
    pixelEllipse(ctx, 48, 24, 28, 10, "#203040");
    pixelEllipse(ctx, 48, 24, 26, 8, color);
    pixelEllipse(ctx, 48, 28, 20, 4, "#d8e6ee");
    px(ctx, 20, 17, 9, 7, color);
    px(ctx, 10, 14, 9, 5, color);
    px(ctx, 10, 28, 9, 5, color);
    px(ctx, 20, 24, 9, 6, color);
    pixelEllipse(ctx, 68, 21, 10, 7, color);
    px(ctx, 72, 19, 3, 3, "#0b1a20");
    px(ctx, 73, 20, 1, 1, "#f8f4df");
    for (let i = 0; i < 6; i++) px(ctx, 60 + i * 3, 16 + (i % 2), 2, 2, "#e8f4f8");
    px(ctx, 60, 29, 16, 2, "#e8f4f8");
    add(scene, key, canvas);
  }
}

function drawTreasure(scene: Phaser.Scene, key: string, kind: string): void {
  const { canvas, ctx } = makeCanvas(28, 24);
  ctx.globalAlpha = 0.3;
  pixelEllipse(ctx, 14, 22, 10, 2, "#071722");
  ctx.globalAlpha = 1;
  if (kind === "urn") {
    pixelEllipse(ctx, 14, 14, 7, 7, "#8a6a48");
    px(ctx, 7, 7, 14, 3, "#a97945");
    px(ctx, 9, 6, 10, 2, "#c9a06a");
    px(ctx, 8, 12, 12, 2, "#6b4a2f");
    px(ctx, 10, 9, 2, 2, "#e8c06a");
    px(ctx, 16, 9, 2, 2, "#e8c06a");
  } else if (kind === "crate") {
    px(ctx, 5, 8, 18, 14, "#7a4f2e");
    px(ctx, 6, 9, 16, 12, "#a97945");
    px(ctx, 5, 8, 18, 2, "#c9a06a");
    px(ctx, 5, 18, 18, 2, "#5d3a22");
    px(ctx, 12, 9, 2, 12, "#6b4a2f");
    px(ctx, 6, 12, 16, 1, "#6b4a2f");
    px(ctx, 8, 14, 2, 2, "#e8c06a");
    px(ctx, 17, 14, 2, 2, "#e8c06a");
  } else {
    px(ctx, 4, 10, 20, 12, "#7a4f2e");
    px(ctx, 5, 11, 18, 10, "#a97945");
    for (let x = 5; x < 23; x++) px(ctx, x, 11, 1, 1, "#e8c06a");
    px(ctx, 4, 7, 20, 4, "#8a5c34");
    px(ctx, 5, 8, 18, 2, "#c9a06a");
    px(ctx, 12, 9, 4, 5, "#e8c06a");
    px(ctx, 13, 10, 2, 3, "#6b4a2f");
    px(ctx, 8, 14, 3, 2, "#f4e0a0");
    px(ctx, 17, 15, 2, 2, "#f4e0a0");
  }
  add(scene, key, canvas);
}

export function createExpansionTextures(scene: Phaser.Scene): void {
  drawSkiff(scene, "prop-skiff-tide-blue", "#4d8fc9");
  drawSkiff(scene, "prop-skiff-coral-red", "#d07a55");
  drawSkiff(scene, "prop-skiff-kelp-green", "#4f8f7a");
  drawSkiff(scene, "prop-skiff-moon-white", "#e8e1cf");
  drawSkiff(scene, "prop-skiff-abyss-purple", "#8a6fbf");
  drawCreature(scene, "prop-creature-whale", "whale", "#7f9fd1");
  drawCreature(scene, "prop-creature-serpent", "serpent", "#6fd6b0");
  drawCreature(scene, "prop-creature-shark", "shark", "#8fb9c9");
  drawCreature(scene, "prop-creature-kraken", "kraken", "#b48ce0");
  drawTreasure(scene, "prop-treasure-chest", "chest");
  drawTreasure(scene, "prop-treasure-crate", "crate");
  drawTreasure(scene, "prop-treasure-urn", "urn");
}

export function propKeyFor(location: LocationId, variant: string): string {
  if (variant === "tree") {
    if (location === "sunny-shore" || location === "coral-bay") return "prop-palm";
    if (location === "frostbite-lake") return "prop-pine";
    return "prop-tree";
  }
  return `prop-${variant}`;
}

export function paletteFor(location: LocationId) {
  return PALETTES[location];
}
