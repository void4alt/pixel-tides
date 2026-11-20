import type {
  Appearance,
  CatchEvent,
  ChatMessage,
  FishInstance,
  LocationId,
  MinigameState,
  PlayerProfile,
  Weather,
} from "@shared/types";
import { getFish, RARITY_RANK } from "@shared/fish";
import {
  BAITS_BY_ID,
  LOCATIONS_BY_ID,
  RODS_BY_ID,
  cookedFishValue,
  locationUnlocked,
  recipeForRarity,
} from "@shared/items";
import {
  chooseFish,
  rollCatch,
  createMinigame,
  tickMinigame,
  biteDelay,
  type Minigame,
} from "@shared/fishing";
import {
  canSail,
  canSwim,
  canWalk,
  clampToMap,
  createWorld,
  TILE,
  type WorldMap,
} from "@shared/world";
import { ensureDaily, ensureWeekly, refreshAchievements, levelFromXp } from "@shared/quests";
import { rollMutation } from "@shared/expansion";
import type { NetPlayer, NetState } from "./network";

const STORAGE_KEY = "pixel-tides-profile";

export function loadStoredProfile(): PlayerProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveStoredProfile(profile: PlayerProfile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {}
}

export function createDefaultProfile(username = "GuestAngler"): PlayerProfile {
  const now = Date.now();
  const profile: PlayerProfile = {
    id: "local_guest",
    username,
    isGuest: true,
    coins: 150,
    xp: 0,
    level: 1,
    skillXp: 0,
    skillLevel: 1,
    energy: 100,
    maxEnergy: 100,
    location: "sunny-shore",
    appearance: {
      skin: "#f2c8a0",
      hair: "#6b432a",
      shirt: "#e66b5a",
      pants: "#3d4f66",
      hat: "none",
      hairStyle: 0,
    },
    rods: ["wooden"],
    equippedRod: "wooden",
    baits: { worm: 25 },
    equippedBait: "worm",
    inventory: [],
    inventorySlots: 24,
    collection: {},
    stats: {
      totalCatches: 0,
      totalValue: 0,
      biggestWeight: 0,
      rarestRank: 0,
      perfectCatches: 0,
      fishSold: 0,
      tournamentsWon: 0,
      bestTournamentScore: 0,
      playSeconds: 0,
      giantCatches: 0,
      treasuresFound: 0,
      mutationsFound: 0,
      beachParties: 0,
      eventsWon: 0,
    },
    daily: { date: "", quests: [] },
    weekly: { week: "", quests: [] },
    achievements: [],
    boatOwned: false,
    boatColor: "tide-blue",
    boatPaints: ["tide-blue"],
    diveGear: false,
    equipment: [],
    cosmetics: [],
    mastery: {},
    aquarium: { slots: 6, theme: "reef", fish: [], fedAt: 0, food: 0 },
    house: {
      theme: "driftwood",
      furniture: [
        { id: "starter-rug", item: "shell-rug", x: 3, y: 4 },
        { id: "starter-bench", item: "driftwood-bench", x: 2, y: 2 },
      ],
      visits: 0,
      name: "My Island",
    },
    trophies: [],
    materials: {},
    furniture: {},
    buffs: [],
    guildId: "",
    friends: [],
    secretQuests: [],
    settings: { music: 0.7, sfx: 0.8, quality: "high", showNames: true, showJoystick: false },
    createdAt: now,
    updatedAt: now,
  };
  ensureDaily(profile);
  ensureWeekly(profile);
  return profile;
}

export class LocalRoom {
  public roomId = "local-shore";
  public sessionId = "angler_local";
  public reconnectionToken = "local_token";

  private stateChangeListeners: ((state: NetState) => void)[] = [];
  private messageListeners = new Map<string, ((data: any) => void)[]>();
  private leaveListeners: ((code: number) => void)[] = [];
  private errorListeners: ((code: number, message: string) => void)[] = [];

  public state: NetState;
  private map: WorldMap;
  private profile: PlayerProfile;
  private minigame: Minigame | null = null;
  private minigameTimer: any = null;
  private biteTimer: any = null;
  private targetFishId = "";
  private timeTicker: any = null;
  private weatherTicker: any = null;

  constructor(location: LocationId = "sunny-shore", profile?: PlayerProfile | null) {
    this.map = createWorld(location);
    this.profile = profile || loadStoredProfile() || createDefaultProfile();
    this.profile.location = location;

    const playersMap = new Map<string, NetPlayer>();

    const spawnX = (this.map.spawn?.x ?? 42) * TILE;
    const spawnY = (this.map.spawn?.y ?? 36) * TILE;

    playersMap.set(this.sessionId, {
      id: this.sessionId,
      username: this.profile.username,
      x: spawnX,
      y: spawnY,
      dir: "down",
      moving: false,
      running: false,
      fishingState: "idle",
      castX: 0,
      castY: 0,
      rod: this.profile.equippedRod,
      level: this.profile.level,
      appearance: JSON.stringify(this.profile.appearance),
      connected: true,
      perfectCatches: this.profile.stats?.perfectCatches ?? 0,
      energy: this.profile.energy ?? 100,
      activity: "idle",
      sailing: false,
      diving: false,
      boatColor: this.profile.boatColor ?? "tide-blue",
      passengerOf: "",
      guildTag: "SOLO",
    });

    // Spawn 2 cozy ambient anglers on Sunny Shore for immersion
    if (location === "sunny-shore") {
      playersMap.set("npc_finley", {
        id: "npc_finley",
        username: "Finley",
        x: spawnX + 48,
        y: spawnY + 32,
        dir: "down",
        moving: false,
        running: false,
        fishingState: "waiting",
        castX: spawnX + 48,
        castY: spawnY + 96,
        rod: "bamboo",
        level: 5,
        appearance: JSON.stringify({ skin: "#f2c8a0", hair: "#6b432a", shirt: "#4d8fc9", pants: "#3d4f66", hat: "straw-hat", hairStyle: 1 }),
        connected: true,
        perfectCatches: 12,
        energy: 100,
        activity: "fishing",
        sailing: false,
        diving: false,
        boatColor: "tide-blue",
        passengerOf: "",
        guildTag: "TIDE",
      });

      playersMap.set("npc_marina", {
        id: "npc_marina",
        username: "Marina",
        x: spawnX - 64,
        y: spawnY + 16,
        dir: "right",
        moving: false,
        running: false,
        fishingState: "idle",
        castX: 0,
        castY: 0,
        rod: "fiberglass",
        level: 9,
        appearance: JSON.stringify({ skin: "#d99a6c", hair: "#d8b26a", shirt: "#58a77a", pants: "#5b4636", hat: "none", hairStyle: 2 }),
        connected: true,
        perfectCatches: 28,
        energy: 100,
        activity: "idle",
        sailing: false,
        diving: false,
        boatColor: "emerald",
        passengerOf: "",
        guildTag: "REEF",
      });
    }

    this.state = {
      location,
      weather: "sunny",
      timeMinutes: 520,
      serverTime: Date.now(),
      tournamentPhase: "idle",
      tournamentEndsAt: 0,
      tournamentStartsAt: Date.now() + 600000,
      tournamentEntries: 1,
      eventId: "",
      eventName: "",
      eventStartedAt: 0,
      eventEndsAt: 0,
      creatureActive: false,
      creatureId: "",
      creatureName: "",
      creatureKind: "",
      creatureX: 0,
      creatureY: 0,
      creatureHp: 0,
      creatureMaxHp: 0,
      creatureEndsAt: 0,
      partyActive: false,
      partyCount: playersMap.size,
      players: playersMap,
    };

    this.startTickers();

    // Initial burst of environment & presence
    setTimeout(() => {
      this.emitMessage("environment", {
        location: this.state.location,
        weather: this.state.weather,
        timeMinutes: this.state.timeMinutes,
        map: { width: this.map.width, height: this.map.height, spawn: this.map.spawn, npcs: this.map.npcs },
      });
      this.emitMessage("profile", this.profile);
      this.emitMessage("presenceList", { count: playersMap.size });
      this.emitState();
    }, 50);
  }

  private startTickers(): void {
    // Advance in-game time 1 minute every 1.5 seconds
    this.timeTicker = setInterval(() => {
      this.state.timeMinutes = (this.state.timeMinutes + 1) % 1440;
      this.state.serverTime = Date.now();
    }, 1500);

    // Weather changes periodically
    this.weatherTicker = setInterval(() => {
      const weathers: Weather[] = ["sunny", "cloudy", "rainy"];
      const next = weathers[Math.floor(Math.random() * weathers.length)];
      if (next !== this.state.weather) {
        this.state.weather = next;
        this.emitMessage("weather", { weather: next });
        this.emitState();
      }
    }, 60000);
  }

  public onStateChange(cb: (state: NetState) => void): void {
    this.stateChangeListeners.push(cb);
  }

  public onMessage(type: string, cb: (data: any) => void): void {
    if (!this.messageListeners.has(type)) {
      this.messageListeners.set(type, []);
    }
    this.messageListeners.get(type)!.push(cb);
  }

  public onLeave(cb: (code: number) => void): void {
    this.leaveListeners.push(cb);
  }

  public onError(cb: (code: number, message: string) => void): void {
    this.errorListeners.push(cb);
  }

  private emitState(): void {
    for (const listener of this.stateChangeListeners) {
      try {
        listener(this.state);
      } catch (err) {
        console.error(err);
      }
    }
  }

  private emitMessage(type: string, data: any): void {
    const listeners = this.messageListeners.get(type);
    if (!listeners) return;
    for (const cb of listeners) {
      try {
        cb(data);
      } catch (err) {
        console.error(err);
      }
    }
  }

  private getPlayer(): NetPlayer | undefined {
    return (this.state.players as Map<string, NetPlayer>).get(this.sessionId);
  }

  public send(type: string, payload?: any): void {
    switch (type) {
      case "requestProfile":
        this.emitMessage("profile", this.profile);
        break;

      case "input":
        this.handleInput(payload);
        break;

      case "cast":
        this.handleCast(payload);
        break;

      case "hook":
        this.handleHook();
        break;

      case "reel":
        if (this.minigame) {
          this.minigame.reel = !!payload?.reeling;
        }
        break;

      case "cancel":
        this.handleCancel();
        break;

      case "buyRod":
        this.handleBuyRod(payload?.rodId);
        break;

      case "equipRod":
        this.handleEquipRod(payload?.rodId);
        break;

      case "buyBait":
        this.handleBuyBait(payload?.baitId);
        break;

      case "equipBait":
        this.handleEquipBait(payload?.baitId);
        break;

      case "buyBoat":
        this.handleBuyBoat();
        break;

      case "toggleSail":
        this.handleToggleSail();
        break;

      case "sellFish":
        this.handleSellFish(payload?.uids);
        break;

      case "sellAll":
        this.handleSellAll();
        break;

      case "cook":
        this.handleCook(payload?.uid);
        break;

      case "eat":
      case "eatBest":
        this.handleEat(payload?.uid);
        break;

      case "chat":
        this.handleChat(payload?.text);
        break;

      case "travel":
        this.handleTravel(payload?.location);
        break;

      case "setAppearance":
        if (payload) {
          this.profile.appearance = payload;
          const p = this.getPlayer();
          if (p) p.appearance = JSON.stringify(payload);
          saveStoredProfile(this.profile);
          this.emitMessage("profile", this.profile);
          this.emitState();
        }
        break;

      case "setSettings":
        if (payload) {
          this.profile.settings = payload;
          saveStoredProfile(this.profile);
          this.emitMessage("profile", this.profile);
        }
        break;

      default:
        break;
    }
  }

  private handleInput(data: { dx: number; dy: number; running: boolean }): void {
    const p = this.getPlayer();
    if (!p) return;

    const dx = data.dx || 0;
    const dy = data.dy || 0;
    const running = !!data.running && (p.energy > 5);

    p.moving = dx !== 0 || dy !== 0;
    p.running = running;

    if (dx < 0) p.dir = "left";
    else if (dx > 0) p.dir = "right";
    else if (dy < 0) p.dir = "up";
    else if (dy > 0) p.dir = "down";

    if (p.moving && p.fishingState === "idle") {
      const speed = (running ? 115 : 68) * 0.05;
      const nx = p.x + dx * speed;
      const ny = p.y + dy * speed;

      const tx = Math.floor(nx / TILE);
      const ty = Math.floor(ny / TILE);

      const walkable = p.sailing
        ? canSail(this.map, tx, ty)
        : p.diving
        ? canSwim(this.map, tx, ty)
        : canWalk(this.map, tx, ty);

      if (walkable) {
        const clamped = clampToMap(this.map, nx, ny);
        p.x = clamped.x;
        p.y = clamped.y;
      }
    }
    this.emitState();
  }

  private handleCast(data: { x: number; y: number }): void {
    const p = this.getPlayer();
    if (!p) return;

    p.fishingState = "casting";
    p.castX = data.x;
    p.castY = data.y;
    this.emitState();

    setTimeout(() => {
      if (p.fishingState !== "casting") return;
      p.fishingState = "waiting";
      this.emitState();

      // Pick target fish and schedule bite
      const chosen = chooseFish(
        this.state.location,
        this.state.weather as Weather,
        this.state.timeMinutes,
        this.profile.equippedRod,
        this.profile.equippedBait,
      );
      this.targetFishId = chosen.id;

      const delayMs = biteDelay(this.profile.equippedBait);
      this.biteTimer = setTimeout(() => {
        if (p.fishingState !== "waiting") return;
        p.fishingState = "bite";
        this.emitMessage("bite", { x: data.x, y: data.y });
        this.emitState();

        // 3.5s window to hook
        this.biteTimer = setTimeout(() => {
          if (p.fishingState === "bite") {
            p.fishingState = "idle";
            this.emitState();
          }
        }, 3500);
      }, delayMs);
    }, 450);
  }

  private handleHook(): void {
    const p = this.getPlayer();
    if (!p || p.fishingState !== "bite") return;

    clearTimeout(this.biteTimer);
    p.fishingState = "reel";

    const species = getFish(this.targetFishId);
    this.minigame = createMinigame(species, this.profile.equippedRod);
    this.emitMessage("minigameStart", {
      fishId: species.id,
      fishName: species.name,
      rarity: species.rarity,
      zonePos: this.minigame.zonePos,
      zoneSize: this.minigame.zoneSize,
      fishPos: this.minigame.fishPos,
      progress: this.minigame.progress,
      timeLeft: this.minigame.timeLeft,
      difficulty: species.difficulty,
    });

    const dt = 0.05;
    this.minigameTimer = setInterval(() => {
      if (!this.minigame) {
        clearInterval(this.minigameTimer);
        return;
      }

      const res = tickMinigame(this.minigame, dt);
      this.emitMessage("mg", res.state);

      if (res.finished) {
        clearInterval(this.minigameTimer);
        this.minigame = null;
        p.fishingState = "idle";

        if (res.won) {
          const catchData = rollCatch(species, res.perfect);
          const mut = rollMutation(1, 0);
          const mutation = mut !== "normal" ? mut : undefined;
          const uid = `local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

          const fishInstance: FishInstance = {
            uid,
            speciesId: species.id,
            weight: catchData.weight,
            length: catchData.length,
            value: catchData.value * (mutation ? 2.5 : 1),
            caughtAt: Date.now(),
            location: this.state.location,
            perfect: res.perfect,
            mutation,
          };

          this.profile.inventory.push(fishInstance);
          const col = this.profile.collection[species.id];
          if (!col) {
            this.profile.collection[species.id] = {
              count: 1,
              firstCaughtAt: Date.now(),
              bestWeight: catchData.weight,
              bestLength: catchData.length,
              bestValue: catchData.value,
            };
          } else {
            col.count += 1;
            col.bestWeight = Math.max(col.bestWeight, catchData.weight);
            col.bestLength = Math.max(col.bestLength, catchData.length);
            col.bestValue = Math.max(col.bestValue, catchData.value);
          }

          this.profile.xp += catchData.xp;
          const newLevel = levelFromXp(this.profile.xp);
          if (newLevel > this.profile.level) {
            this.profile.level = newLevel;
            p.level = newLevel;
            this.emitMessage("levelUp", { level: newLevel });
          }

          this.profile.stats.totalCatches += 1;
          this.profile.stats.totalValue += catchData.value;
          this.profile.stats.biggestWeight = Math.max(this.profile.stats.biggestWeight, catchData.weight);
          this.profile.stats.rarestRank = Math.max(this.profile.stats.rarestRank, RARITY_RANK[species.rarity]);
          if (res.perfect) this.profile.stats.perfectCatches += 1;

          refreshAchievements(this.profile);
          saveStoredProfile(this.profile);

          const catchEvent: CatchEvent = {
            username: this.profile.username,
            speciesId: species.id,
            rarity: species.rarity,
            weight: catchData.weight,
            length: catchData.length,
            value: catchData.value,
            perfect: res.perfect,
            location: this.state.location,
            mutation,
          };
          this.emitMessage("catch", catchEvent);
          this.emitMessage("profile", this.profile);
        }

        this.emitMessage("minigameEnd", { won: res.won, perfect: res.perfect, fish: species });
        this.emitState();
      }
    }, 50);
  }

  private handleCancel(): void {
    const p = this.getPlayer();
    if (p) p.fishingState = "idle";
    clearTimeout(this.biteTimer);
    if (this.minigameTimer) clearInterval(this.minigameTimer);
    this.minigame = null;
    this.emitState();
  }

  private handleBuyRod(rodId: string): void {
    const def = RODS_BY_ID[rodId];
    if (!def || this.profile.rods.includes(rodId) || this.profile.coins < def.price) return;
    this.profile.coins -= def.price;
    this.profile.rods.push(rodId);
    this.profile.equippedRod = rodId;
    saveStoredProfile(this.profile);
    this.emitMessage("purchase", { message: `Acquired the ${def.name}!` });
    this.emitMessage("profile", this.profile);
  }

  private handleEquipRod(rodId: string): void {
    if (this.profile.rods.includes(rodId)) {
      this.profile.equippedRod = rodId;
      const p = this.getPlayer();
      if (p) p.rod = rodId;
      saveStoredProfile(this.profile);
      this.emitMessage("profile", this.profile);
      this.emitState();
    }
  }

  private handleBuyBait(baitId: string): void {
    const def = BAITS_BY_ID[baitId];
    if (!def || this.profile.coins < def.price) return;
    this.profile.coins -= def.price;
    this.profile.baits[baitId] = (this.profile.baits[baitId] ?? 0) + def.bundle;
    this.profile.equippedBait = baitId;
    saveStoredProfile(this.profile);
    this.emitMessage("purchase", { message: `Bought ${def.bundle}× ${def.name}!` });
    this.emitMessage("profile", this.profile);
  }

  private handleEquipBait(baitId: string): void {
    if ((this.profile.baits[baitId] ?? 0) > 0) {
      this.profile.equippedBait = baitId;
      saveStoredProfile(this.profile);
      this.emitMessage("profile", this.profile);
    }
  }

  private handleBuyBoat(): void {
    if (this.profile.boatOwned || this.profile.coins < 2500) return;
    this.profile.coins -= 2500;
    this.profile.boatOwned = true;
    saveStoredProfile(this.profile);
    this.emitMessage("purchase", { message: "Purchased the Explorer's Skiff!" });
    this.emitMessage("profile", this.profile);
  }

  private handleToggleSail(): void {
    if (!this.profile.boatOwned) return;
    const p = this.getPlayer();
    if (!p) return;
    p.sailing = !p.sailing;
    this.emitMessage("sailing", { sailing: p.sailing });
    this.emitState();
  }

  private handleSellFish(uids?: string[]): void {
    if (!uids || !uids.length) return;
    let earned = 0;
    const remaining: FishInstance[] = [];

    for (const fish of this.profile.inventory) {
      if (uids.includes(fish.uid)) {
        earned += fish.value;
      } else {
        remaining.push(fish);
      }
    }

    if (earned > 0) {
      this.profile.coins += earned;
      this.profile.inventory = remaining;
      this.profile.stats.fishSold += uids.length;
      saveStoredProfile(this.profile);
      this.emitMessage("sale", { count: uids.length, coins: earned });
      this.emitMessage("sold", { count: uids.length, coins: earned });
      this.emitMessage("profile", this.profile);
    }
  }

  private handleSellAll(): void {
    const uids = this.profile.inventory.map((f) => f.uid);
    this.handleSellFish(uids);
  }

  private handleCook(uid?: string): void {
    const fish = this.profile.inventory.find((f) => f.uid === uid && !f.cooked);
    if (!fish) return;
    const species = getFish(fish.speciesId);
    fish.cooked = true;
    fish.cookedName = `Grilled ${species.name}`;
    fish.energy = 45;
    saveStoredProfile(this.profile);
    this.emitMessage("cooked", { name: fish.cookedName, energy: fish.energy });
    this.emitMessage("profile", this.profile);
  }

  private handleEat(uid?: string): void {
    const idx = this.profile.inventory.findIndex((f) => (uid ? f.uid === uid : f.cooked));
    if (idx === -1) return;
    const fish = this.profile.inventory.splice(idx, 1)[0];
    const energyGain = fish.energy || 25;
    const p = this.getPlayer();
    if (p) p.energy = Math.min(100, p.energy + energyGain);
    this.profile.energy = p?.energy ?? 100;
    saveStoredProfile(this.profile);
    this.emitMessage("ate", { name: fish.cookedName || "fish", energy: energyGain });
    this.emitMessage("profile", this.profile);
    this.emitState();
  }

  private handleChat(text?: string): void {
    if (!text) return;
    const msg: ChatMessage = {
      id: `chat_${Date.now()}`,
      username: this.profile.username,
      text,
      at: Date.now(),
    };
    this.emitMessage("chat", msg);

    // Occasional friendly greeting from ambient anglers
    if (Math.random() < 0.35) {
      setTimeout(() => {
        const npcResponses = [
          "Fine day for casting lines!",
          "Watch for bubbles out in the deep water.",
          "The tide is rolling in nicely today.",
          "Good catch! What bait are you using?",
          "Heard rumors of a golden koi near the pier.",
        ];
        const npc = Math.random() < 0.5 ? "Finley" : "Marina";
        this.emitMessage("chat", {
          id: `npc_${Date.now()}`,
          username: npc,
          text: npcResponses[Math.floor(Math.random() * npcResponses.length)],
          at: Date.now(),
        });
      }, 900);
    }
  }

  private handleTravel(newLocation?: LocationId): void {
    if (!newLocation || newLocation === this.state.location) return;
    const def = LOCATIONS_BY_ID[newLocation];
    if (!def || !locationUnlocked(this.profile.level, this.profile.boatOwned, def)) return;

    this.state.location = newLocation;
    this.profile.location = newLocation;
    this.map = createWorld(newLocation);

    const p = this.getPlayer();
    if (p) {
      p.x = (this.map.spawn?.x ?? 42) * TILE;
      p.y = (this.map.spawn?.y ?? 36) * TILE;
      p.fishingState = "idle";
    }

    saveStoredProfile(this.profile);
    this.emitMessage("environment", {
      location: this.state.location,
      weather: this.state.weather,
      timeMinutes: this.state.timeMinutes,
      map: { width: this.map.width, height: this.map.height, spawn: this.map.spawn, npcs: this.map.npcs },
    });
    this.emitMessage("profile", this.profile);
    this.emitState();
  }

  public leave(): Promise<void> {
    clearInterval(this.timeTicker);
    clearInterval(this.weatherTicker);
    clearTimeout(this.biteTimer);
    if (this.minigameTimer) clearInterval(this.minigameTimer);
    for (const listener of this.leaveListeners) {
      listener(1000);
    }
    return Promise.resolve();
  }
}
