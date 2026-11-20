import Phaser from "phaser";
import type { Appearance, CreatureView, FishMutation, LocationId, TreasureView, WorldEventView } from "@shared/types";
import { FISH, RARITY_META, fishForLocation } from "@shared/fish";
import { LOCATIONS_BY_ID, RODS_BY_ID } from "@shared/items";
import { MUTATION_META } from "@shared/expansion";
import {
  MAP_H,
  MAP_W,
  TILE,
  Tile,
  canSail,
  canSwim,
  canWalk,
  createWorld,
  findWaterPoint,
  isWaterTile,
  nearestCampfire,
  tileAt,
  type NPCDef,
  type WorldMap,
} from "@shared/world";
import { bus } from "../../core/bus";
import type { NetPlayer, NetState, NetworkManager } from "../../core/network";
import { createWaterTextures, createWaterSheenTexture, addWorldTexture, PALETTES } from "../art/tiles";
import { createPropTextures, createExpansionTextures, propKeyFor } from "../art/props";
import { createCharacterSheet, CHARACTER_DIRS, type CharDir, type CharState } from "../art/characters";
import { createFishTextures, createFishingTextures } from "../art/fish";
import { hashString, rng } from "../art/pixel";
import { appStore } from "../../core/store";

interface PlayerView {
  sprite: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
  appearanceKey: string;
  anims: Record<CharDir, string>;
  states: Record<CharState, Record<CharDir, string>>;
  targetX: number;
  targetY: number;
  dir: CharDir;
  moving: boolean;
  running: boolean;
  fishingState: string;
  activity: string;
  level: number;
  name: string;
  connected: boolean;
}

interface NpcView {
  def: NPCDef;
  sprite: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
}

const FISH_DENSITY: Record<LocationId, number> = {
  "sunny-shore": 1.05,
  "coral-bay": 1.3,
  "frostbite-lake": 0.85,
  "mystic-river": 1.0,
  "deep-ocean": 1.12,
};

const WALK_SPEED = 124;
const RUN_SPEED = 182;

export class WorldScene extends Phaser.Scene {
  private map!: WorldMap;
  private location: LocationId = "sunny-shore";
  private state: NetState | null = null;
  private worldObjects: Phaser.GameObjects.GameObject[] = [];
  private waterSprite: Phaser.GameObjects.TileSprite | null = null;
  private waterSheen: Phaser.GameObjects.TileSprite | null = null;
  private waterKeys: string[] = [];
  private waterFrame = 0;
  private ambientFish: Phaser.GameObjects.Sprite[] = [];
  private ambientShadows = new Map<Phaser.GameObjects.Sprite, Phaser.GameObjects.Sprite>();
  private playerViews = new Map<string, PlayerView>();
  private npcViews: NpcView[] = [];
  private nearestNpc: NPCDef | null = null;
  private nearestFire: { x: number; y: number } | null = null;
  private treasureNear = false;
  private campfireFlames: Phaser.GameObjects.Sprite[] = [];
  private campfireGlows: Phaser.GameObjects.Sprite[] = [];
  private critters: Phaser.GameObjects.Sprite[] = [];
  private gulls: Phaser.GameObjects.Sprite[] = [];
  private fishingGfx: Phaser.GameObjects.Graphics | null = null;
  private bobbers = new Map<string, Phaser.GameObjects.Sprite>();
  private ripples = new Map<string, Phaser.GameObjects.Sprite>();
  private bubbles = new Map<string, Phaser.GameObjects.Text>();
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private mobileVec = { dx: 0, dy: 0 };
  private mobileSprint = false;
  private lastInputSent = 0;
  private lastInput = { dx: 0, dy: 0, running: false };
  private uiOpen = false;
  private mgActive = false;
  private showNames = true;
  private following = false;
  private environment: any = null;
  private unsubscribers: Array<() => void> = [];
  private lastFishingState = "";
  private lastWeather = "";
  private worldReady = false;
  private inputEnabledAt = 0;
  private nextJumpAt = 0;
  private nextGullAt = 0;
  private sheenOffset = 0;
  private lastFootprint = 0;
  private lastActivitySent = "";
  private lastRodSent = "";
  private castStart = new Map<string, number>();
  private stateSeen = new Map<string, string>();
  private boatSprites = new Map<string, Phaser.GameObjects.Sprite>();
  private treasureSprites = new Map<string, Phaser.GameObjects.Sprite>();
  private creatureData: CreatureView | null = null;
  private creatureSprite: Phaser.GameObjects.Sprite | null = null;
  private creatureLabel: Phaser.GameObjects.Text | null = null;
  private creatureGfx: Phaser.GameObjects.Graphics | null = null;
  private activeEvent: WorldEventView | null = null;
  private eventOverlay: Phaser.GameObjects.Rectangle | null = null;
  private eventGfx: Phaser.GameObjects.Graphics | null = null;
  private nextMeteorAt = 0;
  private nextRainAt = 0;
  private diveOverlay: Phaser.GameObjects.Rectangle | null = null;
  private lastDiving = false;
  private emoteCooldown = 0;

  constructor(private network: NetworkManager) {
    super("World");
  }

  create(): void {
    this.location = this.network.getState()?.location ?? "sunny-shore";
    this.state = this.network.getState();
    this.showNames = appStore.profile?.settings.showNames ?? true;
    createPropTextures(this);
    createExpansionTextures(this);
    createFishTextures(this);
    createFishingTextures(this);
    this.keys = this.input.keyboard!.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      up2: Phaser.Input.Keyboard.KeyCodes.UP,
      down2: Phaser.Input.Keyboard.KeyCodes.DOWN,
      left2: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right2: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      shift: Phaser.Input.Keyboard.KeyCodes.SHIFT,
    }) as Record<string, Phaser.Input.Keyboard.Key>;

    this.fishingGfx = this.add.graphics().setDepth(8500);
    this.creatureGfx = this.add.graphics().setDepth(8200);
    this.eventGfx = this.add.graphics().setScrollFactor(0).setDepth(7000);
    this.eventOverlay = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(6900);
    this.diveOverlay = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0x0a3550, 0)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(6800);
    this.buildWorld();
    this.bindInput();
    this.bindBus();
    this.bindResize();
    this.inputEnabledAt = performance.now() + 900;
    this.time.addEvent({
      delay: 150,
      loop: true,
      callback: () => {
        if (!this.waterSprite || !this.waterKeys.length) return;
        this.waterFrame = (this.waterFrame + 1) % this.waterKeys.length;
        this.waterSprite.setTexture(this.waterKeys[this.waterFrame]);
      },
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.shutdown());
    this.worldReady = true;
  }

  private bindResize(): void {
    this.scale.on("resize", () => {
      const zoom = this.targetZoom();
      this.cameras.main.setZoom(zoom);
      this.eventOverlay?.setSize(this.scale.width, this.scale.height);
      this.diveOverlay?.setSize(this.scale.width, this.scale.height);
    });
  }

  private targetZoom(): number {
    return this.scale.width < 720 ? 1.25 : 1.5;
  }

  private buildWorld(): void {
    for (const object of this.worldObjects) {
      this.tweens.killTweensOf(object);
      object.destroy();
    }
    this.worldObjects = [];
    this.ambientFish = [];
    this.ambientShadows.clear();
    this.npcViews = [];
    this.campfireFlames = [];
    this.campfireGlows = [];
    this.critters = [];
    this.gulls = [];
    this.nearestNpc = null;
    this.nearestFire = null;
    this.waterSheen = null;
    for (const sprite of this.bobbers.values()) sprite.destroy();
    for (const sprite of this.ripples.values()) sprite.destroy();
    for (const bubble of this.bubbles.values()) bubble.destroy();
    this.bobbers.clear();
    this.ripples.clear();
    this.bubbles.clear();

    this.map = createWorld(this.location);
    const palette = PALETTES[this.location];
    this.cameras.main.setBackgroundColor(palette.waterDeep);
    this.cameras.main.setBounds(0, 0, this.map.width * TILE, this.map.height * TILE);
    this.cameras.main.setZoom(this.targetZoom());
    this.cameras.main.roundPixels = true;

    this.waterKeys = createWaterTextures(this, this.location);
    this.waterFrame = 0;
    this.waterSprite = this.add
      .tileSprite(0, 0, this.map.width * TILE, this.map.height * TILE, this.waterKeys[0])
      .setOrigin(0)
      .setDepth(-10);
    this.worldObjects.push(this.waterSprite);

    const sheenKey = createWaterSheenTexture(this, this.location);
    this.waterSheen = this.add
      .tileSprite(0, 0, this.map.width * TILE, this.map.height * TILE, sheenKey)
      .setOrigin(0)
      .setDepth(-9)
      .setAlpha(0.35)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.worldObjects.push(this.waterSheen);

    const worldKey = addWorldTexture(this, this.map, this.location);
    const ground = this.add.image(0, 0, worldKey).setOrigin(0).setDepth(0);
    this.worldObjects.push(ground);

    this.createAmbientFish();
    this.createProps();
    this.createNpcs();
    this.createCampfires();
    this.createCritters();

    this.syncPlayers(this.state);
    this.applyEnvironment();

    if (this.environment?.location !== this.location) {
      // Environment will arrive shortly; this initial map is still playable.
    }
  }

  private createAmbientFish(): void {
    const waterPoints: Array<{ x: number; y: number }> = [];
    for (let ty = 1; ty < this.map.height - 1; ty++) {
      for (let tx = 1; tx < this.map.width - 1; tx++) {
        if (isWaterTile(this.map.tiles[ty * this.map.width + tx])) {
          waterPoints.push({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 });
        }
      }
    }
    if (!waterPoints.length) return;
    const random = rng(hashString(`${this.location}:ambient-fish-v2`));
    const species = fishForLocation(this.location);
    const common = species.filter((s) => ["common", "uncommon", "rare"].includes(s.rarity));
    const rare = species.filter((s) => ["epic", "legendary", "mythical", "secret"].includes(s.rarity));
    const target = Math.min(150, Math.max(60, Math.floor((waterPoints.length / 6) * (FISH_DENSITY[this.location] ?? 1))));

    // Fish gather near the shoreline and docks where anglers actually stand.
    const waterTile = (x: number, y: number) => {
      const tx = Math.floor(x / TILE);
      const ty = Math.floor(y / TILE);
      if (tx < 0 || ty < 0 || tx >= this.map.width || ty >= this.map.height) return false;
      return isWaterTile(this.map.tiles[ty * this.map.width + tx]);
    };
    const coastPoints = waterPoints.filter((point) => {
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [1, 1]] as const) {
        if (!waterTile(point.x + dx * TILE, point.y + dy * TILE)) return true;
      }
      return false;
    });
    const pickPoint = () =>
      random() < 0.68 && coastPoints.length
        ? coastPoints[Math.floor(random() * coastPoints.length)]
        : waterPoints[Math.floor(random() * waterPoints.length)];

    const addFish = (x: number, y: number, scale: number, alpha: number, pickRare = false) => {
      const pool = pickRare && rare.length ? rare : common.length ? common : species;
      const fish = pool[Math.floor(random() * pool.length)] ?? FISH[0];
      const sprite = this.add
        .sprite(x, y, `fish-${fish.id}`)
        .setScale(scale)
        .setAlpha(alpha)
        .setDepth(-2);
      sprite.play(`fish-swim-${fish.id}`);
      sprite.setFlipX(random() > 0.5);
      this.ambientFish.push(sprite);
      this.worldObjects.push(sprite);
      const shadow = this.add
        .sprite(x, y + 6, "shadow")
        .setScale(scale * 1.1, scale * 0.9)
        .setAlpha(0.14)
        .setDepth(-3);
      this.ambientShadows.set(sprite, shadow);
      this.worldObjects.push(shadow);
      const dx = (random() - 0.5) * (60 + random() * 120);
      const dy = (random() - 0.5) * (30 + random() * 60);
      const duration = 4200 + random() * 8000;
      this.tweens.add({
        targets: sprite,
        x: x + dx,
        y: y + dy,
        duration,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
        onYoyo: () => sprite.setFlipX(dx < 0),
      });
    };

    // Schools of small fish.
    const schools = Math.max(3, Math.floor(target / 11));
    for (let school = 0; school < schools; school++) {
      const center = pickPoint();
      if (!center) continue;
      const members = 4 + Math.floor(random() * 5);
      for (let i = 0; i < members; i++) {
        const x = center.x + (random() - 0.5) * 72;
        const y = center.y + (random() - 0.5) * 40;
        addFish(x, y, 0.62 + random() * 0.35, 0.45 + random() * 0.3);
      }
    }

    // Larger loners and rare glowing fish.
    let guard = 0;
    while (this.ambientFish.length < target && guard < target * 4) {
      guard++;
      const point = pickPoint();
      if (!point) continue;
      const isRare = random() < 0.09 && rare.length > 0;
      addFish(
        point.x + (random() - 0.5) * 24,
        point.y + (random() - 0.5) * 18,
        isRare ? 1.05 + random() * 0.35 : 0.8 + random() * 0.5,
        isRare ? 0.82 : 0.5 + random() * 0.3,
        isRare,
      );
    }

    // Drifting jellyfish in reef and deep waters.
    if (this.location === "coral-bay" || this.location === "deep-ocean") {
      const jellies = species.filter((s) => s.body === "jelly");
      const count = Math.min(14, Math.floor(waterPoints.length / 90));
      for (let i = 0; i < count; i++) {
        const point = pickPoint();
        if (!point) continue;
        const jelly = jellies[Math.floor(random() * jellies.length)] ?? species[0];
        const sprite = this.add
          .sprite(point.x, point.y, `fish-${jelly.id}`)
          .setScale(0.9 + random() * 0.5)
          .setAlpha(0.4 + random() * 0.25)
          .setDepth(-2);
        sprite.play(`fish-swim-${jelly.id}`);
        this.worldObjects.push(sprite);
        this.ambientFish.push(sprite);
        this.tweens.add({
          targets: sprite,
          y: sprite.y - 18 - random() * 20,
          x: sprite.x + (random() - 0.5) * 40,
          duration: 3600 + random() * 4200,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      }
    }

    // Bubbles and floating particles.
    for (let i = 0; i < Math.floor(target / 3); i++) {
      const point = pickPoint();
      if (!point) continue;
      const bubble = this.add
        .sprite(point.x + random() * 12 - 6, point.y + 6, "prop-bubble")
        .setAlpha(0.2 + random() * 0.3)
        .setDepth(-1);
      this.worldObjects.push(bubble);
      this.tweens.add({
        targets: bubble,
        y: bubble.y - 20 - random() * 16,
        alpha: 0,
        duration: 2600 + random() * 2600,
        repeat: -1,
        delay: random() * 3200,
      });
    }
  }

  private createProps(): void {
    const random = rng(hashString(`${this.location}:props`));
    const spawn = this.map.spawn;
    let placed = 0;
    const maxProps = 170;
    const npcPositions = this.map.npcs.map((npc) => ({ x: npc.x, y: npc.y }));
    const tooClose = (x: number, y: number) =>
      Math.hypot(x - spawn.x, y - spawn.y) < 52 ||
      npcPositions.some((pos) => Math.hypot(x - pos.x, y - pos.y) < 42);

    for (let ty = 2; ty < this.map.height - 2 && placed < maxProps; ty++) {
      for (let tx = 2; tx < this.map.width - 2 && placed < maxProps; tx++) {
        const tile = this.map.tiles[ty * this.map.width + tx];
        const x = tx * TILE + TILE / 2;
        const y = ty * TILE + TILE;
        if (tooClose(x, y)) continue;
        const roll = random();
        let key: string | null = null;
        let scale = 1;
        if (tile === 2 && roll < 0.026) {
          key = propKeyFor(this.location, "tree");
          scale = 1.1 + random() * 0.35;
        } else if (tile === 1 && roll < 0.009) {
          key = random() > 0.5 ? "prop-palm" : "prop-flower";
          scale = 1;
        } else if (tile === 6 && roll < 0.02) {
          key = random() > 0.55 ? "prop-pine" : "prop-rock";
          scale = 1;
        } else if ((tile === 5 || tile === 11) && roll < 0.12) {
          key = "prop-rock";
          scale = 0.9 + random() * 0.5;
        } else if (tile === 2 && roll < 0.06) {
          key = random() > 0.5 ? "prop-bush" : "prop-flower";
          scale = 0.9 + random() * 0.4;
        } else if (tile === 3 && roll < 0.014) {
          key = "prop-lamp";
          scale = 1;
        } else if (tile === 4 && roll < 0.045) {
          key = random() > 0.55 ? "prop-barrel" : "prop-crate";
          scale = 0.9 + random() * 0.35;
        } else if (tile === 10 && roll < 0.15) {
          key = "prop-coral";
          scale = 0.9 + random() * 0.6;
        } else if (tile === 0 && roll < 0.007) {
          key = "prop-rock";
          scale = 0.7;
        }
        if (!key) continue;
        const prop = this.add.sprite(x, y, key).setOrigin(0.5, 1).setScale(scale).setDepth(y);
        this.worldObjects.push(prop);
        if (key === "prop-palm" || key === "prop-tree" || key === "prop-pine") {
          this.tweens.add({
            targets: prop,
            angle: { from: -1.2, to: 1.2 },
            duration: 2600 + random() * 2600,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
          });
        }
        placed++;
      }
    }

    // Boats moored beside dock tiles.
    const dockTiles: Array<{ x: number; y: number }> = [];
    for (let ty = 2; ty < this.map.height - 2; ty++) {
      for (let tx = 2; tx < this.map.width - 2; tx++) {
        if (this.map.tiles[ty * this.map.width + tx] === 4) dockTiles.push({ x: tx, y: ty });
      }
    }
    const randomBoat = rng(hashString(`${this.location}:boats`));
    for (let i = 0; i < Math.min(3, Math.floor(dockTiles.length / 22)); i++) {
      const spot = dockTiles[Math.floor(randomBoat() * dockTiles.length)];
      if (!spot) continue;
      const boat = this.add
        .sprite(spot.x * TILE + 20, spot.y * TILE + 12, "prop-boat")
        .setOrigin(0.5, 1)
        .setDepth(spot.y * TILE + 12)
        .setScale(1.2);
      this.worldObjects.push(boat);
      this.tweens.add({
        targets: boat,
        y: boat.y - 2,
        angle: { from: -0.6, to: 0.6 },
        duration: 1800 + randomBoat() * 1000,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }

    // Dock posts and market crates.
    for (const spot of dockTiles) {
      const seed = hashString(`${this.location}:${spot.x}:${spot.y}:post`);
      if (seed % 17 !== 0) continue;
      const post = this.add
        .sprite(spot.x * TILE + 2, spot.y * TILE + 14, "prop-post")
        .setOrigin(0.5, 1)
        .setDepth(spot.y * TILE + 14);
      this.worldObjects.push(post);
    }
  }

  private createNpcs(): void {
    const random = rng(hashString(`${this.location}:npcs`));
    for (const npc of this.map.npcs) {
      const appearance: Appearance = {
        skin: ["#f2c8a0", "#d99a6c", "#a96b4a", "#c9895f"][Math.floor(random() * 4)],
        hair: ["#2f2a2a", "#6b432a", "#d8b26a", "#b45b3e", "#e8e1cf"][Math.floor(random() * 5)],
        shirt: ["#e66b5a", "#4d8fc9", "#58a77a", "#d8a04a", "#8b6ac9"][Math.floor(random() * 5)],
        pants: ["#3d4f66", "#5b4636", "#425c42", "#6b3d4f"][Math.floor(random() * 4)],
        hat: npc.shop === "boat" ? "captain" : npc.id === "pearl" ? "straw" : "none",
        hairStyle: Math.floor(random() * 4),
      };
      const sheet = createCharacterSheet(this, appearance);
      const sprite = this.add
        .sprite(npc.x, npc.y, sheet.key, 0)
        .setOrigin(0.5, 1)
        .setScale(1.4)
        .setDepth(npc.y);
      this.tweens.add({
        targets: sprite,
        y: npc.y - 1,
        duration: 1600 + random() * 1000,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
      const label = this.add
        .text(npc.x, npc.y - 58, `${npc.name}\n${npc.role}`, {
          fontFamily: "Silkscreen, monospace",
          fontSize: "6px",
          color: "#f8f2df",
          align: "center",
          stroke: "#071722",
          strokeThickness: 3,
        })
        .setOrigin(0.5, 1)
        .setDepth(9000);
      this.npcViews.push({ def: npc, sprite, label });
      this.worldObjects.push(sprite, label);
    }
  }

  private createCampfires(): void {
    for (const fire of this.map.campfires) {
      const base = this.add.sprite(fire.x, fire.y, "prop-campfire").setOrigin(0.5, 1).setDepth(fire.y);
      this.worldObjects.push(base);
      const glow = this.add
        .sprite(fire.x, fire.y - 12, "prop-glow")
        .setDepth(fire.y - 1)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0.5);
      this.worldObjects.push(glow);
      this.campfireGlows.push(glow);
      this.tweens.add({
        targets: glow,
        alpha: { from: 0.32, to: 0.68 },
        scale: { from: 0.85, to: 1.18 },
        duration: 820 + Math.random() * 300,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
      const flame = this.add
        .sprite(fire.x, fire.y - 19, "fire-0")
        .setOrigin(0.5, 1)
        .setDepth(fire.y + 1)
        .setScale(1.15);
      flame.play("campfire-burn");
      this.worldObjects.push(flame);
      this.campfireFlames.push(flame);
      const smoke = this.add
        .sprite(fire.x + 2, fire.y - 30, "prop-smoke")
        .setDepth(fire.y + 2)
        .setAlpha(0);
      this.worldObjects.push(smoke);
      this.tweens.add({
        targets: smoke,
        y: smoke.y - 34,
        x: smoke.x + 6,
        alpha: { from: 0.42, to: 0 },
        duration: 2800,
        repeat: -1,
        delay: 500,
      });
      for (let i = 0; i < 5; i++) {
        const ember = this.add
          .sprite(fire.x + (Math.random() - 0.5) * 10, fire.y - 12, "spark")
          .setTint(0xffb347)
          .setDepth(fire.y + 2)
          .setAlpha(0)
          .setScale(0.7 + Math.random() * 0.5);
        this.worldObjects.push(ember);
        this.tweens.add({
          targets: ember,
          y: ember.y - 24 - Math.random() * 18,
          x: ember.x + (Math.random() - 0.5) * 12,
          alpha: { from: 0.9, to: 0 },
          duration: 1200 + Math.random() * 900,
          repeat: -1,
          delay: Math.random() * 1800,
        });
      }
    }
  }

  private createCritters(): void {
    const random = rng(hashString(`${this.location}:critters`));
    const sandTiles: Array<{ x: number; y: number }> = [];
    const shallowTiles: Array<{ x: number; y: number }> = [];
    const dockTiles: Array<{ x: number; y: number }> = [];
    for (let ty = 2; ty < this.map.height - 2; ty++) {
      for (let tx = 2; tx < this.map.width - 2; tx++) {
        const tile = this.map.tiles[ty * this.map.width + tx];
        const point = { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
        if (tile === 1) sandTiles.push(point);
        else if (tile === 9) shallowTiles.push(point);
        else if (tile === 4) dockTiles.push(point);
      }
    }

    // Shells and starfish on the sand.
    for (let i = 0; i < Math.min(18, Math.floor(sandTiles.length / 40)); i++) {
      const point = sandTiles[Math.floor(random() * sandTiles.length)];
      if (!point) continue;
      const shell = this.add
        .sprite(point.x + (random() - 0.5) * 10, point.y + (random() - 0.5) * 8, random() > 0.55 ? "prop-shell" : "prop-starfish")
        .setDepth(point.y)
        .setScale(0.9 + random() * 0.4)
        .setAlpha(0.9);
      this.worldObjects.push(shell);
    }

    // Crabs scuttling across the sand.
    const crabs = Math.min(8, Math.max(2, Math.floor(sandTiles.length / 120)));
    for (let i = 0; i < crabs; i++) {
      const point = sandTiles[Math.floor(random() * sandTiles.length)];
      if (!point) continue;
      const crab = this.add
        .sprite(point.x, point.y, "prop-crab")
        .setOrigin(0.5, 1)
        .setDepth(point.y)
        .setScale(1);
      this.worldObjects.push(crab);
      this.critters.push(crab);
      this.tweens.add({
        targets: crab,
        x: crab.x + (random() > 0.5 ? 1 : -1) * (24 + random() * 40),
        duration: 2600 + random() * 2600,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
        onYoyo: () => crab.setFlipX(!crab.flipX),
      });
      this.tweens.add({
        targets: crab,
        y: crab.y - 1,
        duration: 260,
        yoyo: true,
        repeat: -1,
      });
    }

    // Swaying seaweed in the shallows.
    for (let i = 0; i < Math.min(26, Math.floor(shallowTiles.length / 10)); i++) {
      const point = shallowTiles[Math.floor(random() * shallowTiles.length)];
      if (!point) continue;
      const weed = this.add
        .sprite(point.x + (random() - 0.5) * 8, point.y + 4, "prop-seaweed")
        .setOrigin(0.5, 1)
        .setDepth(-1)
        .setAlpha(0.6)
        .setScale(0.8 + random() * 0.5);
      this.worldObjects.push(weed);
      this.tweens.add({
        targets: weed,
        angle: { from: -5, to: 5 },
        duration: 1600 + random() * 1600,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }

    // Fishing nets on dock corners.
    for (let i = 0; i < Math.min(5, Math.floor(dockTiles.length / 30)); i++) {
      const point = dockTiles[Math.floor(random() * dockTiles.length)];
      if (!point) continue;
      const net = this.add
        .sprite(point.x, point.y, "prop-net")
        .setOrigin(0.5, 1)
        .setDepth(point.y)
        .setScale(0.9 + random() * 0.3)
        .setAlpha(0.9);
      this.worldObjects.push(net);
    }

    // Seagulls gliding overhead.
    this.gulls = [];
    for (let i = 0; i < 3; i++) {
      const gull = this.add
        .sprite(-30 - i * 80, 70 + random() * 160, "prop-gull")
        .setDepth(9600)
        .setScale(1 + random() * 0.4)
        .setAlpha(0.9);
      this.worldObjects.push(gull);
      this.gulls.push(gull);
      this.tweens.add({
        targets: gull,
        x: this.map.width * TILE + 60,
        duration: 22000 + random() * 16000,
        repeat: -1,
        delay: i * 4200,
        ease: "Linear",
        onRepeat: () => {
          gull.y = 70 + random() * 200;
        },
      });
      this.tweens.add({
        targets: gull,
        y: gull.y - 8,
        duration: 900 + random() * 500,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }
  }

  private bindInput(): void {
    const kb = this.input.keyboard!;
    kb.on("keydown-SPACE", (event: KeyboardEvent) => {
      if (this.isTyping() || this.uiOpen) return;
      event.preventDefault();
      this.onPrimaryDown();
    });
    kb.on("keyup-SPACE", () => {
      if (this.mgActive) this.network.setReel(false);
    });
    kb.on("keydown-E", (event: KeyboardEvent) => {
      if (this.isTyping() || this.uiOpen) return;
      event.preventDefault();
      this.interact();
    });
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.uiOpen || this.isTyping() || performance.now() < this.inputEnabledAt) return;
      if (this.mgActive) {
        this.network.setReel(true);
        return;
      }
      const own = this.ownPlayer();
      if (!own) return;
      if (own.fishingState === "bite") {
        this.network.hook();
        return;
      }
      if (own.fishingState === "idle") {
        this.castAt(pointer.worldX, pointer.worldY);
      }
    });
    this.input.on("pointerup", () => {
      if (this.mgActive) this.network.setReel(false);
    });
  }

  private bindBus(): void {
    this.unsubscribers.push(
      bus.on("state", (state: NetState) => {
        this.state = state;
        this.syncPlayers(state);
      }),
      bus.on("environment", (environment: any) => {
        this.environment = environment;
        if (environment.location && environment.location !== this.location) {
          this.location = environment.location;
          this.buildWorld();
        }
        this.applyEnvironment();
      }),
      bus.on("profile", (profile: any) => {
        this.showNames = profile.settings?.showNames ?? true;
        for (const view of this.playerViews.values()) view.label.setVisible(this.showNames);
      }),
      bus.on("panelOpen", () => {
        this.uiOpen = true;
        this.mobileVec = { dx: 0, dy: 0 };
        this.network.setInput(0, 0, false);
      }),
      bus.on("panelClose", () => {
        this.uiOpen = false;
      }),
      bus.on("mobileInput", (vector: { dx: number; dy: number }) => {
        this.mobileVec = vector;
      }),
      bus.on("sprintToggle", () => {
        this.mobileSprint = !this.mobileSprint;
        bus.emit("sprintState", { sprinting: this.mobileSprint });
      }),
      bus.on("castRequest", () => {
        if (!this.uiOpen && !this.mgActive && performance.now() >= this.inputEnabledAt) this.castAuto();
      }),
      bus.on("reelHold", (reeling: boolean) => {
        if (this.mgActive) this.network.setReel(reeling);
      }),
      bus.on("interactRequest", () => {
        if (!this.uiOpen) this.interact();
      }),
      bus.on("minigameStart", () => {
        this.mgActive = true;
      }),
      bus.on("minigameEnd", (event: any) => {
        this.mgActive = false;
        this.network.setReel(false);
        if (event?.won && event.catch) {
          const own = this.ownPlayer();
          if (own && event.catch.username === own.username) {
            this.celebrateCatch(event.catch.rarity, own.castX, own.castY);
          }
        }
      }),
      bus.on("chat", (message: { username: string; text: string }) => {
        this.showChatBubble(message.username, message.text);
      }),
      bus.on("fishing", (event: { phase: string }) => {
        if (event.phase === "cancelled" || event.phase === "missed") this.mgActive = false;
      }),
      bus.on("creature", (event: any) => {
        this.creatureData = event.active ? event.creature : null;
        this.syncCreature();
      }),
      bus.on("creatureResult", () => {
        this.creatureData = null;
        this.syncCreature();
      }),
      bus.on("treasures", (event: any) => {
        for (const sprite of this.treasureSprites.values()) sprite.destroy();
        this.treasureSprites.clear();
        for (const treasure of Array.isArray(event.items) ? event.items : []) this.spawnTreasureSprite(treasure);
      }),
      bus.on("treasure", (event: any) => {
        if (event.type === "spawn" && event.treasure) this.spawnTreasureSprite(event.treasure);
        if (event.type === "remove") {
          this.treasureSprites.get(event.id)?.destroy();
          this.treasureSprites.delete(event.id);
        }
      }),
      bus.on("event", (view: WorldEventView) => {
        this.activeEvent = view;
        this.applyEventAtmosphere(view.id);
      }),
      bus.on("eventEnd", () => {
        this.activeEvent = null;
        this.applyEventAtmosphere(null);
      }),
      bus.on("emote", (event: any) => {
        this.showEmote(event.username, event.emote);
      }),
      bus.on("feast", (event: any) => {
        for (let i = 0; i < 18; i++) {
          const spark = this.add.sprite(event.x + (Math.random() - 0.5) * 40, event.y - 10, "spark").setDepth(event.y + 40).setTint(0xffc766);
          this.tweens.add({
            targets: spark,
            x: spark.x + (Math.random() - 0.5) * 60,
            y: spark.y - 30 - Math.random() * 40,
            alpha: 0,
            duration: 700 + Math.random() * 600,
            onComplete: () => spark.destroy(),
          });
        }
      }),
    );
  }

  private isTyping(): boolean {
    const el = document.activeElement as HTMLElement | null;
    return !!el && ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
  }

  private ownPlayer(): NetPlayer | null {
    if (!this.state) return null;
    return ((this.state.players as any).get?.(this.network.sessionId) as NetPlayer) ?? null;
  }

  private onPrimaryDown(): void {
    if (performance.now() < this.inputEnabledAt) return;
    const own = this.ownPlayer();
    if (!own) return;
    if (this.mgActive) {
      this.network.setReel(true);
      return;
    }
    if (own.fishingState === "bite") {
      this.network.hook();
      return;
    }
    if (own.fishingState === "idle") this.castAuto();
  }

  private castAuto(): void {
    const own = this.ownPlayer();
    if (!own) return;
    const dir = this.dirVector(own.dir);
    const rod = RODS_BY_ID[own.rod] ?? RODS_BY_ID.wooden;
    const target = findWaterPoint(this.map, own.x, own.y, dir.x, dir.y, 20, rod.castDistance);
    if (!target) {
      bus.emit("error", { message: "No open water in range. Move closer to the edge or dock." });
      return;
    }
    this.network.cast(target.x, target.y);
  }

  private castAt(worldX: number, worldY: number): void {
    const own = this.ownPlayer();
    if (!own) return;
    const rod = RODS_BY_ID[own.rod] ?? RODS_BY_ID.wooden;
    let targetX = worldX;
    let targetY = worldY;
    const dist = Math.hypot(targetX - own.x, targetY - own.y);
    if (dist > rod.castDistance || dist < 20 || !isWaterTile(tileAt(this.map, targetX, targetY))) {
      const dx = worldX - own.x;
      const dy = worldY - own.y;
      const mag = Math.hypot(dx, dy) || 1;
      const target = findWaterPoint(this.map, own.x, own.y, dx / mag, dy / mag, 20, rod.castDistance);
      if (!target) {
        bus.emit("error", { message: "That cast cannot reach open water." });
        return;
      }
      targetX = target.x;
      targetY = target.y;
    }
    this.network.cast(targetX, targetY);
  }

  private dirVector(dir: string): { x: number; y: number } {
    switch (dir) {
      case "left": return { x: -1, y: 0 };
      case "right": return { x: 1, y: 0 };
      case "up": return { x: 0, y: -1 };
      default: return { x: 0, y: 1 };
    }
  }

  private treasureReach(): number {
    return appStore.profile?.equipment?.includes("sonar") ? 130 : 70;
  }

  private interact(): void {
    const own = this.ownPlayer();
    if (own?.diving) {
      let closest: string | null = null;
      let best = this.treasureReach();
      for (const [id, sprite] of this.treasureSprites) {
        const distance = Math.hypot(sprite.x - own.x, sprite.y - own.y);
        if (distance < best) {
          best = distance;
          closest = id;
        }
      }
      if (closest) {
        this.network.collectTreasure(closest);
        return;
      }
    }
    if (this.nearestNpc) bus.emit("openNpc", this.nearestNpc);
    else if (this.nearestFire) bus.emit("openCook", this.nearestFire);
  }

  private spawnSplash(x: number, y: number): void {
    const splash = this.add.sprite(x, y, "splash").setDepth(y + 2).setScale(0.7).setAlpha(0.9);
    this.tweens.add({
      targets: splash,
      scale: 1.8,
      alpha: 0,
      duration: 620,
      onComplete: () => splash.destroy(),
    });
    const ring = this.add.sprite(x, y + 3, "ripple").setDepth(y + 1).setScale(0.6).setAlpha(0.9);
    this.tweens.add({
      targets: ring,
      scale: { from: 0.6, to: 2.4 },
      alpha: { from: 0.9, to: 0 },
      duration: 900,
      onComplete: () => ring.destroy(),
    });
  }

  private spawnFloatBubble(x: number, y: number): void {
    const bubble = this.add
      .sprite(x + (Math.random() - 0.5) * 12, y + 4, "prop-bubble")
      .setDepth(y + 2)
      .setAlpha(0.6)
      .setScale(0.8);
    this.tweens.add({
      targets: bubble,
      y: bubble.y - 12,
      alpha: 0,
      duration: 900,
      onComplete: () => bubble.destroy(),
    });
  }

  private celebrateCatch(rarity: string, x: number, y: number): void {
    if (!x && !y) return;
    const color = RARITY_META[rarity as keyof typeof RARITY_META]?.color ?? "#ffd166";
    const tint = Phaser.Display.Color.HexStringToColor(color).color;
    const count = rarity === "common" ? 8 : rarity === "legendary" || rarity === "mythical" || rarity === "secret" ? 24 : 14;
    for (let i = 0; i < count; i++) {
      const spark = this.add.sprite(x, y, "spark").setTint(tint).setDepth(y + 6).setScale(1 + Math.random());
      const angle = Math.random() * Math.PI * 2;
      const distance = 16 + Math.random() * 34;
      this.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance - 10,
        alpha: 0,
        scale: 0.2,
        duration: 500 + Math.random() * 500,
        ease: "Cubic.easeOut",
        onComplete: () => spark.destroy(),
      });
    }
    if (rarity === "legendary" || rarity === "mythical" || rarity === "secret") {
      const ring = this.add.sprite(x, y, "ripple").setTint(tint).setDepth(y + 5).setScale(0.4);
      this.tweens.add({
        targets: ring,
        scale: { from: 0.4, to: 3.4 },
        alpha: { from: 1, to: 0 },
        duration: 1100,
        onComplete: () => ring.destroy(),
      });
      this.cameras.main.shake(220, 0.0035);
    }
    const ownView = this.playerViews.get(this.network.sessionId);
    if (ownView) {
      const meta = RARITY_META[rarity as keyof typeof RARITY_META];
      const label = this.add
        .text(ownView.sprite.x, ownView.sprite.y - 46, (meta?.label ?? rarity).toUpperCase(), {
          fontFamily: "Silkscreen, monospace",
          fontSize: "8px",
          color,
          stroke: "#071722",
          strokeThickness: 3,
        })
        .setOrigin(0.5, 1)
        .setDepth(9400);
      this.tweens.add({
        targets: label,
        y: label.y - 22,
        alpha: { from: 1, to: 0 },
        duration: 1300,
        ease: "Cubic.easeOut",
        onComplete: () => label.destroy(),
      });
    }
  }

  private showChatBubble(username: string, text: string): void {
    const view = [...this.playerViews.values()].find((v) => v.name === username);
    if (!view) return;
    const bubble = this.add
      .text(view.sprite.x, view.sprite.y - 62, text.slice(0, 100), {
        fontFamily: "VT323, monospace",
        fontSize: "12px",
        color: "#f8f2df",
        backgroundColor: "rgba(7,23,34,0.88)",
        padding: { x: 5, y: 3 },
        wordWrap: { width: 140 },
        align: "center",
        stroke: "#071722",
        strokeThickness: 1,
      })
      .setOrigin(0.5, 1)
      .setDepth(9500);
    this.tweens.add({
      targets: bubble,
      y: bubble.y - 8,
      alpha: { from: 1, to: 0 },
      delay: 3000,
      duration: 600,
      onComplete: () => bubble.destroy(),
    });
  }

  private syncPlayers(state: NetState | null): void {
    if (!state) return;
    const seen = new Set<string>();
    (state.players as any).forEach?.((player: NetPlayer, sessionId: string) => {
      seen.add(sessionId);
      this.ensurePlayerView(sessionId, player);
    });
    for (const [sessionId, view] of this.playerViews) {
      if (!seen.has(sessionId)) {
        view.sprite.destroy();
        view.label.destroy();
        this.playerViews.delete(sessionId);
        this.bobbers.get(sessionId)?.destroy();
        this.bobbers.delete(sessionId);
        this.ripples.get(sessionId)?.destroy();
        this.ripples.delete(sessionId);
        this.bubbles.get(sessionId)?.destroy();
        this.bubbles.delete(sessionId);
        this.castStart.delete(sessionId);
        this.stateSeen.delete(sessionId);
      }
    }
  }

  private ensurePlayerView(sessionId: string, player: NetPlayer): void {
    let view = this.playerViews.get(sessionId);
    let appearance: Appearance;
    try {
      appearance = JSON.parse(player.appearance || "{}");
    } catch {
      appearance = {
        skin: "#f2c8a0", hair: "#2f2a2a", shirt: "#4d8fc9", pants: "#3d4f66", hat: "none", hairStyle: 0,
      };
    }
    const sheet = createCharacterSheet(this, appearance);
    if (!view) {
      const sprite = this.add
        .sprite(player.x, player.y, sheet.key, 0)
        .setOrigin(0.5, 1)
        .setScale(1.4)
        .setDepth(player.y);
      const label = this.add
        .text(player.x, player.y - 56, `Lv ${player.level} · ${player.username}`, {
          fontFamily: "Silkscreen, monospace",
          fontSize: "6px",
          color: "#f8f2df",
          align: "center",
          stroke: "#071722",
          strokeThickness: 3,
        })
        .setOrigin(0.5, 1)
        .setDepth(9000)
        .setVisible(this.showNames);
      view = {
        sprite,
        label,
        appearanceKey: sheet.key,
        anims: sheet.anims,
        states: sheet.states,
        targetX: player.x,
        targetY: player.y,
        dir: (player.dir as CharDir) || "down",
        moving: player.moving,
        running: player.running,
        fishingState: player.fishingState,
        activity: player.activity || "idle",
        level: player.level,
        name: player.username,
        connected: player.connected,
      };
      this.playerViews.set(sessionId, view);
      if (sessionId === this.network.sessionId) {
        this.cameras.main.startFollow(sprite, true, 0.3, 0.3);
        this.following = true;
      }
    } else if (view.appearanceKey !== sheet.key) {
      const x = view.sprite.x;
      const y = view.sprite.y;
      const depth = view.sprite.depth;
      view.sprite.destroy();
      view.sprite = this.add.sprite(x, y, sheet.key, 0).setOrigin(0.5, 1).setScale(1.4).setDepth(depth);
      view.appearanceKey = sheet.key;
      view.anims = sheet.anims;
      view.states = sheet.states;
      if (sessionId === this.network.sessionId) {
        this.cameras.main.startFollow(view.sprite, true, 0.3, 0.3);
      }
    }
    view.targetX = player.x;
    view.targetY = player.y;
    view.dir = (player.dir as CharDir) || "down";
    view.moving = player.moving;
    view.running = player.running;
    view.fishingState = player.fishingState;
    view.activity = player.activity || "idle";
    view.connected = player.connected;
    view.name = player.username;
    if (view.level !== player.level) {
      view.level = player.level;
      view.label.setText(`Lv ${player.level} · ${player.username}`);
    }
    view.sprite.setAlpha(player.connected ? 1 : 0.45);
    view.label.setAlpha(player.connected ? 1 : 0.4);
    view.label.setVisible(this.showNames);
  }

  private applyEnvironment(): void {
    if (!this.environment) return;
    if (this.environment.weather !== this.lastWeather) {
      this.lastWeather = this.environment.weather;
    }
  }

  update(time: number, delta: number): void {
    if (!this.worldReady) return;
    const dt = Math.min(0.1, delta / 1000);
    const now = performance.now();

    for (const [sessionId, view] of this.playerViews) {
      const own = this.ownPlayer();
      const canPredict = sessionId === this.network.sessionId && !!own && own.fishingState === "idle" && !this.uiOpen && !own.passengerOf;
      const input = canPredict ? this.readInput() : { dx: 0, dy: 0, running: false };
      const movingInput = Math.abs(input.dx) > 0.01 || Math.abs(input.dy) > 0.01;
      if (canPredict && movingInput) {
        const speed = own?.sailing ? 156 : own?.diving ? 96 : input.running ? RUN_SPEED : WALK_SPEED;
        const canMoveTo = (x: number, y: number) =>
          own?.sailing ? canSail(this.map, x, y, 6) : own?.diving ? canSwim(this.map, x, y, 6) : canWalk(this.map, x, y, 6);
        const nextX = view.sprite.x + input.dx * speed * dt;
        const nextY = view.sprite.y + input.dy * speed * dt;
        if (canMoveTo(nextX, view.sprite.y)) view.sprite.x = nextX;
        if (canMoveTo(view.sprite.x, nextY)) view.sprite.y = nextY;
        view.targetX = view.sprite.x;
        view.targetY = view.sprite.y;
        view.moving = true;
        view.running = input.running;
        if (Math.abs(input.dx) > Math.abs(input.dy)) view.dir = input.dx > 0 ? "right" : "left";
        else if (Math.abs(input.dy) > 0.15) view.dir = input.dy > 0 ? "down" : "up";
      } else {
        const distance = Phaser.Math.Distance.Between(view.sprite.x, view.sprite.y, view.targetX, view.targetY);
        if (distance > 140) {
          view.sprite.setPosition(view.targetX, view.targetY);
        } else {
          const factor = sessionId === this.network.sessionId ? 0.45 : 0.35;
          view.sprite.x = Phaser.Math.Linear(view.sprite.x, view.targetX, factor);
          view.sprite.y = Phaser.Math.Linear(view.sprite.y, view.targetY, factor);
        }
      }
      view.sprite.setDepth(view.sprite.y);
      const dirIndex = Math.max(0, CHARACTER_DIRS.indexOf(view.dir));
      let animState: CharState | null = null;
      if (view.activity === "cooking") animState = "cook";
      else if (view.activity === "eating") animState = "eat";
      else if (view.fishingState === "casting") animState = "cast";
      else if (view.fishingState === "waiting" || view.fishingState === "bite") animState = "wait";
      else if (view.fishingState === "minigame") animState = "reel";
      else if (view.fishingState === "landed") animState = "celebrate";
      else if (view.moving) animState = view.running ? "run" : "walk";
      if (animState) {
        const animKey = view.states[animState]?.[view.dir] ?? view.anims[view.dir];
        if (view.sprite.anims.currentAnim?.key !== animKey) view.sprite.play(animKey, true);
      } else {
        view.sprite.anims.stop();
        view.sprite.setFrame(dirIndex * 4);
      }
      view.label.setPosition(view.sprite.x, view.sprite.y - 58);
      view.label.setDepth(9000);
    }

    this.updateAmbient(time, dt);
    this.updateExpansionVisuals(time, dt);
    this.updateFishingLines(time);
    this.updateNpcProximity();
    this.sendMovement(now);
    this.emitStatus();
  }

  private syncCreature(): void {
    this.creatureSprite?.destroy();
    this.creatureSprite = null;
    this.creatureLabel?.destroy();
    this.creatureLabel = null;
    if (!this.creatureData) {
      this.creatureGfx?.clear();
      return;
    }
    const key = `prop-creature-${this.creatureData.kind}`;
    if (!this.textures.exists(key)) return;
    this.creatureSprite = this.add
      .sprite(this.creatureData.x, this.creatureData.y, key)
      .setOrigin(0.5, 0.85)
      .setDepth(this.creatureData.y)
      .setScale(1.15);
    this.creatureLabel = this.add
      .text(this.creatureData.x, this.creatureData.y - 84, this.creatureData.name, {
        fontFamily: "Silkscreen, monospace",
        fontSize: "8px",
        color: "#f8f2df",
        stroke: "#071722",
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1)
      .setDepth(9500);
  }

  private spawnTreasureSprite(treasure: TreasureView): void {
    if (this.treasureSprites.has(treasure.id)) return;
    const key = `prop-treasure-${treasure.kind}`;
    if (!this.textures.exists(key)) return;
    const sprite = this.add.sprite(treasure.x, treasure.y, key).setOrigin(0.5, 1).setDepth(treasure.y).setScale(1.1);
    this.tweens.add({
      targets: sprite,
      y: treasure.y - 3,
      duration: 1400 + Math.random() * 600,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    const glow = this.add.sprite(treasure.x, treasure.y - 10, "spark").setDepth(treasure.y + 1).setTint(0x9fe8ff).setAlpha(0.7);
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.2, to: 0.9 },
      scale: { from: 0.6, to: 1.5 },
      duration: 900,
      yoyo: true,
      repeat: -1,
    });
    sprite.setData("glow", glow);
    this.treasureSprites.set(treasure.id, sprite);
  }

  private applyEventAtmosphere(id: string | null): void {
    if (!this.eventOverlay) return;
    const colors: Record<string, { color: number; alpha: number }> = {
      "golden-hour": { color: 0xffb347, alpha: 0.12 },
      "meteor-shower": { color: 0x2a2450, alpha: 0.18 },
      "blood-moon": { color: 0x5a0f16, alpha: 0.26 },
      "aurora-night": { color: 0x071b2f, alpha: 0.2 },
      "whale-migration": { color: 0x1b3a5a, alpha: 0.1 },
      "pirate-ship": { color: 0x3a2a12, alpha: 0.14 },
      "fishing-frenzy": { color: 0xff8a4a, alpha: 0.07 },
      "heavy-rain": { color: 0x142838, alpha: 0.18 },
    };
    const spec = id ? colors[id] : null;
    this.eventOverlay.setFillStyle(spec?.color ?? 0x000000, spec?.alpha ?? 0);
    this.nextMeteorAt = 0;
    this.nextRainAt = 0;
  }

  private showEmote(username: string, emote: string): void {
    const view = [...this.playerViews.values()].find((entry) => entry.name === username);
    if (!view) return;
    const symbols: Record<string, string> = {
      wave: "✦", dance: "♪", heart: "♥", laugh: "☺", fish: "◉", sit: "▾", party: "✺", sleep: "☾",
    };
    const text = this.add
      .text(view.sprite.x, view.sprite.y - 70, symbols[emote] ?? "✦", {
        fontFamily: "Silkscreen, monospace",
        fontSize: "16px",
        color: emote === "heart" ? "#ff8fc7" : emote === "party" ? "#ffd166" : "#f8f2df",
        stroke: "#071722",
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1)
      .setDepth(9600);
    this.tweens.add({
      targets: text,
      y: text.y - 22,
      alpha: { from: 1, to: 0 },
      duration: 1600,
      ease: "Cubic.easeOut",
      onComplete: () => text.destroy(),
    });
  }

  private updateExpansionVisuals(time: number, dt: number): void {
    // Giant creature.
    if (this.creatureData && this.creatureSprite && this.creatureLabel) {
      const bob = Math.sin(time / 420) * 4;
      this.creatureSprite.setPosition(this.creatureData.x, this.creatureData.y + bob);
      this.creatureSprite.setDepth(this.creatureData.y);
      this.creatureLabel.setPosition(this.creatureData.x, this.creatureData.y - 92 + bob);
      const gfx = this.creatureGfx;
      if (gfx) {
        gfx.clear();
        const pct = Math.max(0, Math.min(1, this.creatureData.hp / Math.max(1, this.creatureData.maxHp)));
        gfx.fillStyle(0x071722, 0.8);
        gfx.fillRect(this.creatureData.x - 44, this.creatureData.y - 78, 88, 7);
        gfx.fillStyle(pct > 0.5 ? 0x58a77a : pct > 0.25 ? 0xe8b73d : 0xd05a4a, 1);
        gfx.fillRect(this.creatureData.x - 43, this.creatureData.y - 77, 86 * pct, 5);
      }
    }

    // Boats under sailing anglers.
    const seen = new Set<string>();
    (this.state?.players as any)?.forEach?.((player: NetPlayer, sessionId: string) => {
      const view = this.playerViews.get(sessionId);
      if (!view) return;
      if (!player.sailing || player.passengerOf) return;
      seen.add(sessionId);
      const key = `prop-skiff-${player.boatColor || "tide-blue"}`;
      if (!this.textures.exists(key)) return;
      let boat = this.boatSprites.get(sessionId);
      if (!boat) {
        boat = this.add.sprite(view.sprite.x, view.sprite.y + 3, key).setOrigin(0.5, 1).setDepth(view.sprite.y - 1);
        this.boatSprites.set(sessionId, boat);
      }
      boat.setTexture(key);
      boat.setPosition(view.sprite.x, view.sprite.y + 3);
      boat.setDepth(view.sprite.y - 1);
      boat.setFlipX(player.dir === "left");
      boat.setVisible(true);
      if (player.moving) boat.y += Math.sin(time / 120) * 1.2;
    });
    for (const [sessionId, boat] of this.boatSprites) {
      if (!seen.has(sessionId)) boat.setVisible(false);
    }

    // Diving tint and bubbles.
    const own = this.ownPlayer();
    const diving = !!own?.diving;
    if (this.diveOverlay) {
      const target = diving ? 0.2 + Math.sin(time / 600) * 0.03 : 0;
      this.diveOverlay.setFillStyle(0x0a3550, Phaser.Math.Linear(this.diveOverlay.fillAlpha, target, 0.08));
    }
    if (diving && !this.lastDiving) {
      this.spawnSplash(own!.x, own!.y);
    }
    if (diving && Math.random() < dt * 2.2) {
      this.spawnFloatBubble(own!.x + (Math.random() - 0.5) * 18, own!.y - 18);
    }
    this.lastDiving = diving;

    // Event atmosphere.
    const gfx = this.eventGfx;
    if (gfx) gfx.clear();
    if (this.activeEvent) {
      if (this.activeEvent.id === "meteor-shower" && time > this.nextMeteorAt) {
        this.nextMeteorAt = time + 260;
        const camera = this.cameras.main;
        const x = camera.worldView.x + Math.random() * camera.worldView.width;
        const y = camera.worldView.y + Math.random() * camera.worldView.height * 0.4;
        const spark = this.add.sprite(x, y, "spark").setDepth(9000).setTint(0xb9a8ff).setScale(1.2);
        this.tweens.add({
          targets: spark,
          x: x + 90 + Math.random() * 80,
          y: y + 160 + Math.random() * 120,
          alpha: { from: 1, to: 0 },
          duration: 700 + Math.random() * 400,
          onComplete: () => spark.destroy(),
        });
      }
      if (this.activeEvent.id === "heavy-rain" && time > this.nextRainAt) {
        this.nextRainAt = time + 55;
        const camera = this.cameras.main;
        const x = camera.worldView.x + Math.random() * camera.worldView.width;
        const y = camera.worldView.y + Math.random() * camera.worldView.height * 0.5;
        const drop = this.add.rectangle(x, y, 1, 8, 0xbfe3ff, 0.55).setDepth(9000).setAngle(12);
        this.tweens.add({
          targets: drop,
          y: y + 160,
          x: x + 22,
          alpha: 0,
          duration: 520,
          onComplete: () => drop.destroy(),
        });
      }
      if (this.activeEvent.id === "aurora-night" && gfx) {
        for (let band = 0; band < 3; band++) {
          const color = [0x7ff7b0, 0x7fd7f7, 0xb9a8ff][band];
          gfx.lineStyle(10 + band * 4, color, 0.14 + band * 0.03);
          gfx.beginPath();
          for (let x = 0; x <= this.scale.width; x += 14) {
            const y = 60 + band * 34 + Math.sin(x * 0.012 + time / 900 + band) * 18 + Math.sin(x * 0.03 + time / 500) * 6;
            if (x === 0) gfx.moveTo(x, y);
            else gfx.lineTo(x, y);
          }
          gfx.strokePath();
        }
      }
      if (this.activeEvent.id === "fishing-frenzy" && Math.random() < dt * 4) {
        const camera = this.cameras.main;
        const x = camera.worldView.x + Math.random() * camera.worldView.width;
        const y = camera.worldView.y + Math.random() * camera.worldView.height;
        if (isWaterTile(tileAt(this.map, x, y))) this.spawnFloatBubble(x, y);
      }
    }
  }

  private updateAmbient(time: number, dt: number): void {
    if (this.waterSheen) {
      this.sheenOffset += dt;
      this.waterSheen.tilePositionX = this.sheenOffset * 0.008;
      this.waterSheen.tilePositionY = Math.sin(this.sheenOffset * 0.0006) * 3;
    }
    const view = this.cameras.main.worldView;
    const margin = 48;
    for (const [fish, shadow] of this.ambientShadows) {
      if (
        fish.x < view.x - margin || fish.x > view.right + margin ||
        fish.y < view.y - margin || fish.y > view.bottom + margin
      ) continue;
      shadow.setPosition(fish.x, fish.y + 7);
    }
    if (time > this.nextJumpAt) {
      this.nextJumpAt = time + 2600 + Math.random() * 4200;
      this.spawnJumpingFish();
    }
    const own = this.ownPlayer();
    if (own && own.moving && time - this.lastFootprint > 260) {
      this.lastFootprint = time;
      if (tileAt(this.map, own.x, own.y + 5) === Tile.Sand) {
        this.spawnFootprint(own.x, own.y + 1);
      }
    }
  }

  private spawnFootprint(x: number, y: number): void {
    const print = this.add
      .sprite(x + (Math.random() - 0.5) * 4, y, "prop-footprint")
      .setDepth(1)
      .setAlpha(0.4)
      .setScale(0.9 + Math.random() * 0.3);
    this.tweens.add({
      targets: print,
      alpha: 0,
      duration: 4200,
      onComplete: () => print.destroy(),
    });
  }

  private spawnJumpingFish(): void {
    const camera = this.cameras.main;
    const random = Math.random;
    for (let attempt = 0; attempt < 14; attempt++) {
      const x = camera.worldView.x + random() * camera.worldView.width;
      const y = camera.worldView.y + random() * camera.worldView.height;
      if (!isWaterTile(tileAt(this.map, x, y))) continue;
      const species = fishForLocation(this.location);
      const fish = species[Math.floor(random() * species.length)] ?? FISH[0];
      const sprite = this.add.sprite(x, y, `fish-${fish.id}`).setDepth(y + 1).setScale(0.8);
      sprite.play(`fish-swim-${fish.id}`);
      const splash = this.add.sprite(x, y + 2, "splash").setDepth(y + 2).setAlpha(0.8);
      this.tweens.add({
        targets: splash,
        scale: { from: 0.6, to: 1.6 },
        alpha: { from: 0.9, to: 0 },
        duration: 700,
        onComplete: () => splash.destroy(),
      });
      this.tweens.add({
        targets: sprite,
        x: x + (random() > 0.5 ? 1 : -1) * (20 + random() * 26),
        y: y - 18 - random() * 12,
        angle: { from: -18, to: 18 },
        duration: 520,
        yoyo: true,
        ease: "Sine.easeOut",
        onComplete: () => sprite.destroy(),
      });
      return;
    }
  }

  private emitStatus(): void {
    const own = this.ownPlayer();
    if (!own) return;
    if (this.lastFishingState !== own.fishingState || this.lastRodSent !== own.rod) {
      this.lastFishingState = own.fishingState;
      this.lastRodSent = own.rod;
      bus.emit("fishingStatus", { state: own.fishingState, rod: own.rod });
    }
    if (this.lastActivitySent !== own.activity) {
      this.lastActivitySent = own.activity;
      bus.emit("activity", { activity: own.activity });
    }
  }

  private updateFishingLines(time: number): void {
    const gfx = this.fishingGfx;
    if (!gfx) return;
    gfx.clear();
    if (!this.state) return;
    const seen = new Set<string>();
    (this.state.players as any).forEach?.((player: NetPlayer, sessionId: string) => {
      const view = this.playerViews.get(sessionId);
      if (!view) return;
      const state = player.fishingState;
      if (!["casting", "waiting", "bite", "minigame", "landed"].includes(state)) {
        this.bobbers.get(sessionId)?.setVisible(false);
        this.ripples.get(sessionId)?.setVisible(false);
        this.bubbles.get(sessionId)?.setVisible(false);
        return;
      }
      seen.add(sessionId);
      const floatX = player.castX;
      const floatY = player.castY;
      if (!floatX && !floatY) return;
      const dir = this.dirVector(view.dir);
      const handX = view.sprite.x + dir.x * 8;
      const handY = view.sprite.y - 26 + dir.y * 3;
      const previousState = this.stateSeen.get(sessionId);
      if (previousState !== state) {
        this.stateSeen.set(sessionId, state);
        if (state === "casting") this.castStart.set(sessionId, time);
        if (state === "waiting") this.spawnSplash(floatX, floatY);
      }
      const castT = state === "casting"
        ? Math.min(1, (time - (this.castStart.get(sessionId) ?? time)) / 420)
        : 1;
      const bobX = handX + (floatX - handX) * castT;
      const bobY = handY + (floatY - handY) * castT - Math.sin(castT * Math.PI) * 24;
      const midX = (handX + floatX) / 2 + (dir.x === 0 ? 10 : 0);
      const midY = Math.min(handY, floatY) - 18;
      gfx.lineStyle(1, 0xf4efd8, 0.8);
      gfx.beginPath();
      gfx.moveTo(handX, handY);
      for (let i = 1; i <= 10; i++) {
        const t = i / 10;
        const x = (1 - t) * (1 - t) * handX + 2 * (1 - t) * t * midX + t * t * floatX;
        const y = (1 - t) * (1 - t) * handY + 2 * (1 - t) * t * midY + t * t * floatY;
        gfx.lineTo(x, y);
      }
      gfx.strokePath();
      gfx.lineStyle(2, 0x8a5c34, 1);
      gfx.beginPath();
      gfx.moveTo(handX, handY);
      gfx.lineTo(handX + dir.x * 13 + 3, handY + dir.y * 8 - 10);
      gfx.strokePath();

      let bobber = this.bobbers.get(sessionId);
      if (!bobber) {
        bobber = this.add.sprite(floatX, floatY, "bobber").setDepth(8600);
        this.bobbers.set(sessionId, bobber);
      }
      let ripple = this.ripples.get(sessionId);
      if (!ripple) {
        ripple = this.add.sprite(floatX, floatY + 4, "ripple").setDepth(8500).setAlpha(0.6);
        this.ripples.set(sessionId, ripple);
      }
      let bubble = this.bubbles.get(sessionId);
      if (!bubble) {
        bubble = this.add.text(floatX, floatY - 14, "!", {
          fontFamily: "Silkscreen, monospace",
          fontSize: "10px",
          color: "#ffd166",
          stroke: "#071722",
          strokeThickness: 3,
        }).setOrigin(0.5, 1).setDepth(8700);
        this.bubbles.set(sessionId, bubble);
      }
      const isBite = state === "bite";
      const bob = Math.sin(time / 260) * 1.6 + (isBite ? 3 : 0);
      bobber.setPosition(state === "casting" ? bobX : floatX, (state === "casting" ? bobY : floatY) + bob)
        .setVisible(state !== "minigame" && state !== "landed");
      ripple.setPosition(floatX, floatY + 4).setVisible(state !== "minigame" && state !== "landed");
      ripple.setScale(0.8 + Math.sin(time / 500) * 0.2);
      bubble.setPosition(floatX, floatY - 10 + bob).setVisible(isBite);
      if (isBite) {
        bubble.setAlpha(0.6 + Math.sin(time / 90) * 0.4);
      }
      if (state === "waiting" && Math.random() < 0.012) this.spawnFloatBubble(floatX, floatY);
      bobber.setDepth(floatY + 20);
      ripple.setDepth(floatY + 19);
      bubble.setDepth(8700);
    });
    for (const [sessionId, sprite] of this.bobbers) {
      if (!seen.has(sessionId)) sprite.setVisible(false);
    }
    for (const [sessionId, sprite] of this.ripples) {
      if (!seen.has(sessionId)) sprite.setVisible(false);
    }
    for (const [sessionId, sprite] of this.bubbles) {
      if (!seen.has(sessionId)) sprite.setVisible(false);
    }
  }

  private updateNpcProximity(): void {
    const own = this.ownPlayer();
    if (!own) {
      if (this.nearestNpc) {
        this.nearestNpc = null;
        bus.emit("npcLeave");
      }
      if (this.nearestFire) {
        this.nearestFire = null;
        bus.emit("campfireLeave");
      }
      return;
    }
    const fire = nearestCampfire(this.map, own.x, own.y, 66);
    if (fire !== this.nearestFire) {
      this.nearestFire = fire;
      if (fire) bus.emit("campfireNear", fire);
      else bus.emit("campfireLeave");
    }
    let closest: NPCDef | null = null;
    let best = 58;
    for (const npc of this.map.npcs) {
      const d = Math.hypot(npc.x - own.x, npc.y - own.y);
      if (d < best) {
        best = d;
        closest = npc;
      }
    }
    if (closest !== this.nearestNpc) {
      this.nearestNpc = closest;
      if (closest) bus.emit("npcNear", closest);
      else bus.emit("npcLeave");
    }
    let nearTreasure = false;
    if (own.diving) {
      for (const sprite of this.treasureSprites.values()) {
        if (Math.hypot(sprite.x - own.x, sprite.y - own.y) < this.treasureReach()) {
          nearTreasure = true;
          break;
        }
      }
    }
    if (nearTreasure !== this.treasureNear) {
      this.treasureNear = nearTreasure;
      if (nearTreasure) bus.emit("treasureNear");
      else bus.emit("treasureLeave");
    }
  }

  private readInput(): { dx: number; dy: number; running: boolean } {
    if (this.isTyping()) return { dx: 0, dy: 0, running: false };
    let dx = 0;
    let dy = 0;
    if (this.keys.left?.isDown || this.keys.left2?.isDown) dx -= 1;
    if (this.keys.right?.isDown || this.keys.right2?.isDown) dx += 1;
    if (this.keys.up?.isDown || this.keys.up2?.isDown) dy -= 1;
    if (this.keys.down?.isDown || this.keys.down2?.isDown) dy += 1;
    dx += this.mobileVec.dx;
    dy += this.mobileVec.dy;
    const mag = Math.hypot(dx, dy);
    if (mag > 1) {
      dx /= mag;
      dy /= mag;
    }
    const running = !!this.keys.shift?.isDown || this.mobileSprint;
    return { dx, dy, running };
  }

  private sendMovement(now: number): void {
    if (now - this.lastInputSent < 50) return;
    this.lastInputSent = now;
    if (this.uiOpen || !this.worldReady) {
      if (this.lastInput.dx !== 0 || this.lastInput.dy !== 0) {
        this.lastInput = { dx: 0, dy: 0, running: false };
        this.network.setInput(0, 0, false);
      }
      return;
    }
    const input = this.readInput();
    const active = Math.abs(input.dx) > 0.01 || Math.abs(input.dy) > 0.01;
    const changed =
      Math.abs(input.dx - this.lastInput.dx) >= 0.02 ||
      Math.abs(input.dy - this.lastInput.dy) >= 0.02 ||
      input.running !== this.lastInput.running;
    // Keep a heartbeat while moving so the server never times the input out.
    if (!changed && !active) return;
    this.lastInput = input;
    this.network.setInput(input.dx, input.dy, input.running);
  }

  private shutdown(): void {
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers = [];
    this.scale.off("resize");
    this.audioStop();
  }

  private audioStop(): void {}
}
