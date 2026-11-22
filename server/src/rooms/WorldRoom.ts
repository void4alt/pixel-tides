import colyseus, { type Client } from "colyseus";
const { Room } = colyseus;
import { randomUUID } from "node:crypto";
import type {
  Appearance,
  CatchEvent,
  CreatureView,
  FishInstance,
  FishMutation,
  GiantCreatureId,
  HouseVisitView,
  GuildView,
  LocationId,
  MarketListing,
  MinigameState,
  PlayerProfile,
  TradeView,
  TournamentView,
  TreasureView,
  Weather,
  WorldEventView,
} from "../../../shared/types";
import {
  BAITS_BY_ID,
  BOAT,
  COSMETICS,
  COSMETICS_BY_ID,
  LOCATIONS_BY_ID,
  RODS_BY_ID,
  cookedFishValue,
  locationUnlocked,
  recipeForRarity,
} from "../../../shared/items";
import {
  AQUARIUM_THEMES,
  BOAT_PAINTS_BY_ID,
  COOKING_BUFFS,
  CREATURES_BY_ID,
  EQUIPMENT,
  EVENT_INTERMISSION_MS,
  FURNITURE_BY_ID,
  GIANT_CREATURES,
  HOUSE_THEMES,
  MATERIALS_BY_ID,
  MUTATION_META,
  SECRET_QUESTS,
  SEASON_LABEL,
  TREASURE_KINDS,
  WORLD_EVENTS,
  WORLD_EVENTS_BY_ID,
  currentSeason,
  masteryLevel,
  masteryValueBonus,
  rollMutation,
  type CreatureDef,
  type WorldEventDef,
} from "../../../shared/expansion";
import { getFish, RARITY_RANK, RARITY_META } from "../../../shared/fish";
import { addXp, createProfile, normalizeProfile } from "../profile";
import { store, type StoredUser } from "../db";
import { WorldState, PlayerState } from "./WorldState";
import {
  TILE,
  canSail,
  canSwim,
  canWalk,
  clampToMap,
  createWorld,
  findWaterPoint,
  isFishingTarget,
  nearSecretIsland,
  nearWater,
  nearestCampfire,
  type WorldMap,
} from "../../../shared/world";
import {
  biteDelay,
  castRange,
  chooseFish,
  createMinigame,
  rollCatch,
  tickMinigame,
  type FishingSession,
} from "../game/fishing";
import {
  applyCatchToQuests,
  applyGiantToQuests,
  applyTreasureToQuests,
  ensureDaily,
  ensureWeekly,
  refreshAchievements,
  weekKey,
} from "../../../shared/quests";
import { registerRoom, removeRoom, updateRoom } from "../registry";

interface InputState {
  dx: number;
  dy: number;
  running: boolean;
  at: number;
}

interface AuthData {
  user: StoredUser;
  profile: PlayerProfile;
}

interface TournamentParticipant {
  name: string;
  userId: string;
  score: number;
  catches: number;
}

interface TournamentResultRow {
  username: string;
  score: number;
  catches: number;
  place: number;
}

interface TradeState {
  id: string;
  fromSession: string;
  toSession: string;
  fromOffer: { uids: string[]; coins: number };
  toOffer: { uids: string[]; coins: number };
  status: "pending" | "open" | "accepted" | "declined" | "cancelled";
  createdAt: number;
}

interface CreatureRuntime {
  def: CreatureDef;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  endsAt: number;
  contributions: Map<string, number>;
  lastStrike: Map<string, number>;
}

const MAX_CHAT_LENGTH = 140;
const TOURNAMENT_LENGTH = 4 * 60 * 1000;
const TOURNAMENT_INTERMISSION = 2 * 60 * 1000;
const DAY_LENGTH_MS = 10 * 60 * 1000;

function validLocation(value: unknown): LocationId {
  return typeof value === "string" && value in LOCATIONS_BY_ID ? (value as LocationId) : "sunny-shore";
}

function safeNumber(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export class WorldRoom extends Room<WorldState> {
  private map!: WorldMap;
  private location!: LocationId;
  private code = "";
  private isPrivate = false;
  private profiles = new Map<string, PlayerProfile>();
  private inputs = new Map<string, InputState>();
  private fishing = new Map<string, FishingSession>();
  private chatTimes = new Map<string, number>();
  private tournamentParticipants = new Map<string, TournamentParticipant>();
  private tournamentResults: TournamentResultRow[] = [];
  private tournamentResultsUntil = 0;
  private startedAt = Date.now();
  private lastPeriodicSave = 0;
  private lastTimeSent = 0;
  private eventDef: WorldEventDef | null = null;
  private eventEndsAt = 0;
  private eventNextAt = 0;
  private eventParticipants = new Map<string, number>();
  private creature: CreatureRuntime | null = null;
  private creatureNextAt = 0;
  private treasures = new Map<string, TreasureView>();
  private treasureNextAt = 0;
  private trades = new Map<string, TradeState>();
  private emoteTimes = new Map<string, number>();
  private partyMembers = new Set<string>();
  private partySince = 0;
  private partyActive = false;
  private visitTimes = new Map<string, number>();
  private weatherBeforeEvent: string | null = null;

  async onAuth(_client: Client, options: Record<string, unknown>): Promise<AuthData> {
    const token = typeof options.token === "string" ? options.token : "";
    const user = token ? await store.getUserByToken(token) : null;
    if (!user) throw new Error("Your session has expired. Please sign in again.");
    const location = validLocation(options.location);
    const existing = await store.loadProfile(user.id);
    const profile = existing ? normalizeProfile(existing) : createProfile(user);
    if (!existing) await store.saveProfile(profile);
    const locationDef = LOCATIONS_BY_ID[location];
    if (!locationUnlocked(profile.level, profile.boatOwned, locationDef)) {
      throw new Error(`${locationDef.name} is locked. Reach level ${locationDef.unlockLevel}${locationDef.requiresBoat ? " and buy a boat" : ""}.`);
    }
    return { user, profile };
  }

  async onCreate(options: Record<string, unknown>): Promise<void> {
    this.location = validLocation(options.location);
    this.code = typeof options.code === "string" ? options.code.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10) : "";
    this.isPrivate = this.code.length > 0;
    this.maxClients = Math.min(30, Math.max(2, Number(options.maxClients) || 30));
    this.map = createWorld(this.location);
    this.setState(new WorldState());
    this.state.location = this.location;
    this.state.weather = (LOCATIONS_BY_ID[this.location].weatherBias[Math.floor(Math.random() * LOCATIONS_BY_ID[this.location].weatherBias.length)] ?? "sunny");
    this.state.tournamentPhase = "idle";
    this.state.tournamentStartsAt = Date.now() + TOURNAMENT_INTERMISSION;
    this.state.tournamentEndsAt = 0;
    const started = Date.now();
    this.eventNextAt = started + 25000;
    this.creatureNextAt = started + 75000;
    this.treasureNextAt = started + 12000;

    this.setMetadata({
      location: this.location,
      locationName: LOCATIONS_BY_ID[this.location].name,
      private: this.isPrivate,
      createdAt: this.startedAt,
    });

    registerRoom({
      roomId: this.roomId,
      location: this.location,
      clients: 0,
      maxClients: this.maxClients,
      private: this.isPrivate,
      code: this.code,
      createdAt: this.startedAt,
    });

    this.clock.setInterval(() => this.changeWeather(), 165000);
    this.clock.setInterval(() => this.broadcastPresence(), 30000);
    this.setSimulationInterval((deltaTime) => this.update(deltaTime), 33);
    this.patchRate = 33;

    this.onMessage("input", (client, data) => this.handleInput(client, data));
    this.onMessage("cast", (client, data) => this.handleCast(client, data));
    this.onMessage("hook", (client) => this.handleHook(client));
    this.onMessage("reel", (client, data) => this.handleReel(client, data));
    this.onMessage("cancel", (client) => this.cancelFishing(client, "You reeled in your line."));
    this.onMessage("chat", (client, data) => this.handleChat(client, data));
    this.onMessage("sellFish", (client, data) => this.handleSellFish(client, data));
    this.onMessage("sellAll", (client) => this.handleSellAll(client));
    this.onMessage("buyRod", (client, data) => this.handleBuyRod(client, data));
    this.onMessage("equipRod", (client, data) => this.handleEquipRod(client, data));
    this.onMessage("buyBait", (client, data) => this.handleBuyBait(client, data));
    this.onMessage("equipBait", (client, data) => this.handleEquipBait(client, data));
    this.onMessage("buyInventory", (client) => this.handleBuyInventory(client));
    this.onMessage("buyBoat", (client) => this.handleBuyBoat(client));
    this.onMessage("buyCosmetic", (client, data) => this.handleBuyCosmetic(client, data));
    this.onMessage("setAppearance", (client, data) => this.handleSetAppearance(client, data));
    this.onMessage("setSettings", (client, data) => this.handleSetSettings(client, data));
    this.onMessage("claimQuest", (client, data) => this.handleClaimQuest(client, data));
    this.onMessage("claimAchievement", (client, data) => this.handleClaimAchievement(client, data));
    this.onMessage("tournamentJoin", (client) => this.handleTournamentJoin(client));
    this.onMessage("tournamentLeave", (client) => this.handleTournamentLeave(client));
    this.onMessage("requestProfile", (client) => this.sendProfile(client));
    this.onMessage("requestTournament", (client) => this.sendTournament(client));
    this.onMessage("cook", (client, data) => this.handleCook(client, data));
    this.onMessage("eat", (client, data) => this.handleEat(client, data));
    this.onMessage("eatBest", (client) => this.handleEatBest(client));

    // Expansion: boats, diving, creatures, events.
    this.onMessage("toggleSail", (client) => this.handleToggleSail(client));
    this.onMessage("setBoatColor", (client, data) => this.handleSetBoatColor(client, data));
    this.onMessage("buyBoatPaint", (client, data) => this.handleBuyBoatPaint(client, data));
    this.onMessage("boardBoat", (client, data) => this.handleBoardBoat(client, data));
    this.onMessage("leaveBoat", (client) => this.handleLeaveBoat(client));
    this.onMessage("buyDiveGear", (client) => this.handleBuyEquipment(client, "dive-gear"));
    this.onMessage("buyEquipment", (client, data) => this.handleBuyEquipment(client, String(data.itemId ?? "")));
    this.onMessage("toggleDive", (client) => this.handleToggleDive(client));
    this.onMessage("collectTreasure", (client, data) => this.handleCollectTreasure(client, data));
    this.onMessage("joinCreature", (client) => this.handleJoinCreature(client));
    this.onMessage("strikeCreature", (client) => this.handleStrikeCreature(client));
    this.onMessage("requestEvents", (client) => this.sendEvents(client));

    // Expansion: housing, aquarium, social.
    this.onMessage("saveHouse", (client, data) => this.handleSaveHouse(client, data));
    this.onMessage("buyFurniture", (client, data) => this.handleBuyFurniture(client, data));
    this.onMessage("aquariumAdd", (client, data) => this.handleAquariumAdd(client, data));
    this.onMessage("aquariumRemove", (client, data) => this.handleAquariumRemove(client, data));
    this.onMessage("aquariumFeed", (client) => this.handleAquariumFeed(client));
    this.onMessage("aquariumTheme", (client, data) => this.handleAquariumTheme(client, data));
    this.onMessage("visitHouse", (client, data) => this.handleVisitHouse(client, data));
    this.onMessage("emote", (client, data) => this.handleEmote(client, data));
    this.onMessage("friendAdd", (client, data) => this.handleFriendAdd(client, data));
    this.onMessage("friendRemove", (client, data) => this.handleFriendRemove(client, data));
    this.onMessage("requestFriends", (client) => this.sendFriends(client));
    this.onMessage("guildCreate", (client, data) => this.handleGuildCreate(client, data));
    this.onMessage("guildJoin", (client, data) => this.handleGuildJoin(client, data));
    this.onMessage("guildLeave", (client) => this.handleGuildLeave(client));
    this.onMessage("requestGuild", (client) => this.sendGuild(client));
    this.onMessage("guildChat", (client, data) => this.handleGuildChat(client, data));
    this.onMessage("marketList", (client, data) => this.handleMarketList(client, data));
    this.onMessage("marketBuy", (client, data) => this.handleMarketBuy(client, data));
    this.onMessage("marketCancel", (client, data) => this.handleMarketCancel(client, data));
    this.onMessage("requestMarket", (client) => this.sendMarket(client));
    this.onMessage("tradeRequest", (client, data) => this.handleTradeRequest(client, data));
    this.onMessage("tradeOffer", (client, data) => this.handleTradeOffer(client, data));
    this.onMessage("tradeAccept", (client, data) => this.handleTradeAccept(client, data));
    this.onMessage("tradeCancel", (client, data) => this.handleTradeCancel(client, data));
    this.onMessage("claimWeekly", (client, data) => this.handleClaimWeekly(client, data));
    this.onMessage("secretAccept", (client, data) => this.handleSecretAccept(client, data));
    this.onMessage("secretClaim", (client, data) => this.handleSecretClaim(client, data));
    this.onMessage("cookFeast", (client) => this.handleCookFeast(client));
  }

  async onJoin(client: Client, options: Record<string, unknown>, auth?: any): Promise<void> {
    let profile: PlayerProfile | null = null;
    if (auth && typeof auth === "object" && auth.profile) {
      profile = normalizeProfile(auth.profile);
    } else {
      const token = typeof options?.token === "string" ? options.token : "";
      const user = token ? await store.getUserByToken(token) : null;
      if (!user) throw new Error("Missing session data. Please sign in again.");
      const existing = await store.loadProfile(user.id);
      profile = existing ? normalizeProfile(existing) : createProfile(user);
    }
    profile = normalizeProfile(profile);
    const locationDef = LOCATIONS_BY_ID[this.location];
    if (!locationUnlocked(profile.level, profile.boatOwned, locationDef)) {
      throw new Error(`${locationDef.name} is locked.`);
    }
    profile.location = this.location;
    profile.updatedAt = Date.now();
    this.profiles.set(client.sessionId, profile);
    this.inputs.set(client.sessionId, { dx: 0, dy: 0, running: false, at: 0 });
    await store.saveProfile(profile);

    const player = new PlayerState();
    player.id = profile.id;
    player.username = profile.username;
    player.x = this.map.spawn.x;
    player.y = this.map.spawn.y;
    player.dir = "down";
    player.rod = profile.equippedRod;
    player.level = profile.level;
    player.appearance = JSON.stringify(profile.appearance);
    player.perfectCatches = profile.stats.perfectCatches;
    player.energy = Math.round(profile.energy);
    player.connected = true;
    player.boatColor = profile.boatColor;
    const guild = profile.guildId ? await store.getGuild(profile.guildId) : null;
    player.guildTag = guild?.tag ?? "";
    this.state.players.set(client.sessionId, player);

    updateRoom(this.roomId, this.clients.length);
    console.log(`[${this.location}] ${profile.username} joined (${this.clients.length}/${this.maxClients})`);

    // Give the client a moment to attach message handlers before the initial burst.
    this.clock.setTimeout(() => {
      if (!this.state.players.has(client.sessionId)) return;
      this.sendProfile(client);
      client.send("environment", {
        location: this.location,
        weather: this.state.weather,
        timeMinutes: this.state.timeMinutes,
        map: { width: this.map.width, height: this.map.height, spawn: this.map.spawn, npcs: this.map.npcs },
      });
      this.sendTournament(client);
      this.sendEvents(client);
      this.sendCreature(client);
      client.send("treasures", { items: [...this.treasures.values()] });
      client.send("party", { active: this.partyActive, count: this.partyMembers.size });
      this.broadcast("presence", { type: "join", username: profile.username });
    }, 120);
  }

  async onLeave(client: Client, consented: boolean): Promise<void> {
    const player = this.state.players.get(client.sessionId);
    if (player) player.connected = false;
    if (!consented) {
      try {
        await this.allowReconnection(client, 20);
        if (player) player.connected = true;
        updateRoom(this.roomId, this.clients.length);
        return;
      } catch {
        // reconnection window expired
      }
    }
    this.cleanupPlayer(client);
  }

  onDispose(): void {
    for (const profile of this.profiles.values()) {
      void store.saveProfile(profile);
    }
    removeRoom(this.roomId);
  }

  private cleanupPlayer(client: Client): void {
    const profile = this.profiles.get(client.sessionId);
    const player = this.state.players.get(client.sessionId);
    this.state.players.delete(client.sessionId);
    this.profiles.delete(client.sessionId);
    this.inputs.delete(client.sessionId);
    this.fishing.delete(client.sessionId);
    this.tournamentParticipants.delete(client.sessionId);
    this.chatTimes.delete(client.sessionId);
    this.chatTimes.delete(`guild:${client.sessionId}`);
    this.emoteTimes.delete(client.sessionId);
    this.visitTimes.delete(client.sessionId);
    for (const [tradeId, trade] of [...this.trades.entries()]) {
      if (trade.fromSession === client.sessionId || trade.toSession === client.sessionId) {
        this.trades.delete(tradeId);
        const otherId = trade.fromSession === client.sessionId ? trade.toSession : trade.fromSession;
        this.clients.find((c) => c.sessionId === otherId)?.send("tradeEnd", { tradeId, reason: "The other angler left." });
      }
    }
    for (const player of this.state.players.values()) {
      if (player.passengerOf === client.sessionId) player.passengerOf = "";
    }
    if (profile) {
      profile.updatedAt = Date.now();
      void store.saveProfile(profile);
      this.broadcast("presence", { type: "leave", username: profile.username });
      console.log(`[${this.location}] ${profile.username} left`);
    }
    if (player) this.state.tournamentEntries = this.tournamentParticipants.size;
    updateRoom(this.roomId, this.clients.length);
  }

  private update(deltaTime: number): void {
    const now = Date.now();
    const dt = Math.min(0.25, Math.max(0, deltaTime / 1000));
    this.state.serverTime = now;
    const dayProgress = (now % DAY_LENGTH_MS) / DAY_LENGTH_MS;
    this.state.timeMinutes = (Math.floor(dayProgress * 1440) + 8 * 60) % 1440;

    for (const [sessionId, player] of this.state.players.entries()) {
      if (player.passengerOf) {
        const boat = this.state.players.get(player.passengerOf);
        if (boat) {
          player.x = boat.x - 12;
          player.y = boat.y + 10;
          player.moving = boat.moving;
          player.running = false;
          player.dir = boat.dir;
          player.sailing = false;
        } else {
          player.passengerOf = "";
        }
        continue;
      }
      const input = this.inputs.get(sessionId);
      if (!input || !player.connected || now - input.at > 600) continue;
      const session = this.fishing.get(sessionId);
      const magnitude = Math.hypot(input.dx, input.dy);
      if (magnitude < 0.08) {
        player.moving = false;
        const idleProfile = this.profiles.get(sessionId);
        if (idleProfile) {
          idleProfile.energy = Math.min(idleProfile.maxEnergy, idleProfile.energy + 0.55 * dt);
          player.energy = Math.round(idleProfile.energy);
        }
        continue;
      }
      if (session && (session.phase === "casting" || session.phase === "waiting" || session.phase === "bite")) {
        this.cancelFishingById(sessionId, "You moved and the fish slipped away.");
      }
      if (session?.phase === "minigame") {
        player.moving = false;
        continue;
      }
      const dx = input.dx / magnitude;
      const dy = input.dy / magnitude;
      const profile = this.profiles.get(sessionId);
      const canRun = input.running && (profile?.energy ?? 0) > 0 && !player.sailing && !player.diving;
      const speed = player.sailing ? 156 : player.diving ? 96 : canRun ? 182 : 124;
      const canMoveTo = (x: number, y: number) =>
        player.sailing ? canSail(this.map, x, y, 6) : player.diving ? canSwim(this.map, x, y, 6) : canWalk(this.map, x, y, 6);
      const nextX = player.x + dx * speed * dt;
      const nextY = player.y + dy * speed * dt;
      let moved = false;
      if (canMoveTo(nextX, player.y)) {
        player.x = nextX;
        moved = true;
      }
      if (canMoveTo(player.x, nextY)) {
        player.y = nextY;
        moved = true;
      }
      if ((canRun || player.diving) && moved && profile) {
        profile.energy = Math.max(0, profile.energy - (player.diving ? 1.8 : 1.15) * dt);
      } else if (profile) {
        profile.energy = Math.min(profile.maxEnergy, profile.energy + 0.3 * dt);
      }
      const clamped = clampToMap(this.map, player.x, player.y);
      player.x = clamped.x;
      player.y = clamped.y;
      player.moving = moved;
      player.running = canRun && moved;
      if (profile) player.energy = Math.round(profile.energy);
      if (Math.abs(dx) > Math.abs(dy)) player.dir = dx > 0 ? "right" : "left";
      else if (Math.abs(dy) > 0.15) player.dir = dy > 0 ? "down" : "up";
    }

    for (const [sessionId, session] of [...this.fishing.entries()]) {
      const player = this.state.players.get(sessionId);
      const client = this.clients.find((c) => c.sessionId === sessionId);
      if (!player || !client) {
        this.fishing.delete(sessionId);
        continue;
      }
      if (session.phase === "casting" && now >= session.castAt) {
        session.phase = "waiting";
        session.biteAt = now + biteDelay(session.baitId, this.eventDef?.biteSpeed ?? 1);
        player.fishingState = "waiting";
        client.send("fishing", { phase: "waiting", x: session.castX, y: session.castY });
      } else if (session.phase === "waiting" && now >= session.biteAt) {
        session.phase = "bite";
        session.biteUntil = now + 2400;
        player.fishingState = "bite";
        client.send("bite", { x: session.castX, y: session.castY, windowMs: 2400 });
      } else if (session.phase === "bite" && now >= session.biteUntil) {
        player.fishingState = "idle";
        this.fishing.delete(sessionId);
        client.send("fishing", { phase: "missed", message: "Too slow! The fish stole your bait." });
      } else if (session.phase === "landed" && session.landedAt && now >= session.landedAt) {
        player.fishingState = "idle";
        this.fishing.delete(sessionId);
      } else if (session.phase === "minigame" && session.minigame) {
        const tick = tickMinigame(session.minigame, dt);
        if (now - session.minigame.lastSentAt > 80) {
          session.minigame.lastSentAt = now;
          client.send("mg", tick.state);
        }
        if (tick.finished) {
          client.send("mg", tick.state);
          if (tick.won) {
            this.awardCatch(client, session, tick.perfect);
          } else {
            player.fishingState = "idle";
            this.fishing.delete(sessionId);
            client.send("minigameEnd", { won: false, reason: tick.state.progress <= 0 ? "The line went slack..." : "The fish escaped!" });
          }
        }
      }
    }

    this.updateTournament(now);
    this.updateEvents(now);
    this.updateCreatures(now);
    this.updateTreasures(now);

    if (now - this.lastTimeSent > 1000) {
      this.lastTimeSent = now;
      this.state.serverTime = now;
    }
    if (now - this.lastPeriodicSave > 30000) {
      this.lastPeriodicSave = now;
      for (const profile of this.profiles.values()) {
        profile.updatedAt = now;
        void store.saveProfile(profile);
      }
    }
  }

  private handleInput(client: Client, data: Record<string, unknown>): void {
    const input = this.inputs.get(client.sessionId);
    if (!input) return;
    input.dx = safeNumber(data.dx, 0, -1, 1);
    input.dy = safeNumber(data.dy, 0, -1, 1);
    input.running = !!data.running;
    input.at = Date.now();
  }

  private handleCast(client: Client, data: Record<string, unknown>): void {
    const player = this.state.players.get(client.sessionId);
    const profile = this.profiles.get(client.sessionId);
    if (!player || !profile) return;
    if (this.fishing.has(client.sessionId) || player.fishingState !== "idle") {
      this.fail(client, "You are already fishing.");
      return;
    }
    const rod = RODS_BY_ID[profile.equippedRod] ?? RODS_BY_ID.wooden;
    let targetX = safeNumber(data.x, player.x, 0, this.map.width * 16);
    let targetY = safeNumber(data.y, player.y + 90, 0, this.map.height * 16);
    const distance = Math.hypot(targetX - player.x, targetY - player.y);
    if (distance < 20 || distance > rod.castDistance) {
      this.fail(client, `Cast within ${rod.castDistance} pixels of your rod.`);
      return;
    }
    if (!nearWater(this.map, player.x, player.y, 70)) {
      this.fail(client, "Move closer to the water's edge.");
      return;
    }
    if (!isFishingTarget(this.map, targetX, targetY)) {
      this.fail(client, "Aim your cast at open water.");
      return;
    }
    const clamped = clampToMap(this.map, targetX, targetY);
    targetX = clamped.x;
    targetY = clamped.y;

    let baitId = profile.equippedBait;
    if (!baitId || (profile.baits[baitId] ?? 0) <= 0) {
      const fallback = Object.entries(profile.baits).find(([, count]) => count > 0);
      baitId = fallback?.[0] ?? "";
    }
    if (baitId && (profile.baits[baitId] ?? 0) > 0) {
      profile.baits[baitId] -= 1;
    }
    const now = Date.now();
    const session: FishingSession = {
      phase: "casting",
      castX: targetX,
      castY: targetY,
      castAt: now + 700,
      biteAt: 0,
      biteUntil: 0,
      baitId,
    };
    this.fishing.set(client.sessionId, session);
    player.fishingState = "casting";
    player.castX = targetX;
    player.castY = targetY;
    player.dir = targetY > player.y + 20 ? "down" : targetX > player.x ? "right" : targetX < player.x ? "left" : "up";
    client.send("fishing", { phase: "casting", x: targetX, y: targetY });
    this.sendProfile(client);
  }

  private handleHook(client: Client): void {
    const session = this.fishing.get(client.sessionId);
    const player = this.state.players.get(client.sessionId);
    const profile = this.profiles.get(client.sessionId);
    if (!session || !player || !profile || session.phase !== "bite") {
      return;
    }
    if (Date.now() > session.biteUntil) {
      this.fail(client, "Too late! The fish got away.");
      return;
    }
    const activeBuff = (id: string) => profile.buffs.some((buff) => buff.id === id && buff.until > Date.now());
    const celestial = activeBuff("celestial");
    const species = chooseFish(this.location, this.state.weather as Weather, this.state.timeMinutes, profile.equippedRod, session.baitId, {
      secretSpot: player.diving || nearSecretIsland(this.map, player.x, player.y, 48),
      eventRarity: (this.eventDef?.rarityBoost ?? 0) + (celestial ? 0.12 : activeBuff("tidecall") ? 0.1 : 0),
      luckBonus: celestial ? 0.2 : activeBuff("tidecall") ? 0.15 : 0,
    });
    session.phase = "minigame";
    session.speciesId = species.id;
    session.minigame = createMinigame(species, profile.equippedRod);
    player.fishingState = "minigame";
    client.send("minigameStart", {
      fishId: species.id,
      fishName: species.name,
      rarity: species.rarity,
      difficulty: species.difficulty,
      state: {
        fishId: species.id,
        fishName: species.name,
        rarity: species.rarity,
        zonePos: session.minigame.zonePos,
        zoneSize: session.minigame.zoneSize,
        fishPos: session.minigame.fishPos,
        fishTarget: session.minigame.fishTarget,
        progress: session.minigame.progress,
        timeLeft: session.minigame.timeLeft,
        inZone: false,
        difficulty: species.difficulty,
      } satisfies MinigameState,
    });
  }

  private handleReel(client: Client, data: Record<string, unknown>): void {
    const session = this.fishing.get(client.sessionId);
    if (!session || session.phase !== "minigame" || !session.minigame) return;
    session.minigame.reel = !!data.reeling;
  }

  private cancelFishing(client: Client, message: string): void {
    this.cancelFishingById(client.sessionId, message);
  }

  private cancelFishingById(sessionId: string, message: string): void {
    const player = this.state.players.get(sessionId);
    if (player) player.fishingState = "idle";
    this.fishing.delete(sessionId);
    const client = this.clients.find((c) => c.sessionId === sessionId);
    client?.send("fishing", { phase: "cancelled", message });
  }

  private awardCatch(client: Client, session: FishingSession, perfect: boolean): void {
    const profile = this.profiles.get(client.sessionId);
    const player = this.state.players.get(client.sessionId);
    if (!profile || !player || !session.speciesId) {
      this.fishing.delete(client.sessionId);
      return;
    }
    if (profile.inventory.length >= profile.inventorySlots) {
      player.fishingState = "idle";
      this.fishing.delete(client.sessionId);
      client.send("minigameEnd", { won: false, reason: "Your inventory is full! Sell some fish first." });
      return;
    }
    const species = getFish(session.speciesId);
    const rolled = rollCatch(species, perfect);
    const rod = RODS_BY_ID[profile.equippedRod] ?? RODS_BY_ID.wooden;
    const activeBuff = (id: string) => profile.buffs.some((buff) => buff.id === id && buff.until > Date.now());
    const celestial = activeBuff("celestial");
    const charmBonus = profile.equipment.includes("luck-charm") ? 0.06 : 0;
    const mutation = rollMutation(
      rod.luck + (BAITS_BY_ID[profile.equippedBait]?.mutationBoost ?? 0),
      (this.eventDef?.mutationBoost ?? 0) + charmBonus + (celestial ? 0.12 : activeBuff("luck") ? 0.08 : 0),
    );
    const mutationMeta = MUTATION_META[mutation];
    const masteryXp = profile.mastery[this.location] ?? 0;
    const value = Math.round(
      rolled.value *
        mutationMeta.valueMultiplier *
        (this.eventDef?.valueMult ?? 1) *
        masteryValueBonus(masteryXp),
    );
    const xpGain = Math.round(
      rolled.xp *
        mutationMeta.xpMultiplier *
        (this.eventDef?.xpMult ?? 1) *
        (celestial || activeBuff("feast") ? 1.25 : 1),
    );
    const fish: FishInstance = {
      uid: randomUUID(),
      speciesId: species.id,
      weight: rolled.weight,
      length: rolled.length,
      value,
      caughtAt: Date.now(),
      location: this.location,
      perfect,
      mutation,
    };
    profile.inventory.push(fish);
    const previous = profile.collection[species.id];
    const isNew = !previous;
    const variants = { ...(previous?.variants ?? {}) };
    variants[mutation] = (variants[mutation] ?? 0) + 1;
    const previousBest = previous?.bestMutation ? MUTATION_META[previous.bestMutation].valueMultiplier : 0;
    profile.collection[species.id] = {
      count: (previous?.count ?? 0) + 1,
      firstCaughtAt: previous?.firstCaughtAt ?? Date.now(),
      bestWeight: Math.max(previous?.bestWeight ?? 0, rolled.weight),
      bestLength: Math.max(previous?.bestLength ?? 0, rolled.length),
      bestValue: Math.max(previous?.bestValue ?? 0, value),
      variants,
      bestMutation: mutationMeta.valueMultiplier > previousBest ? mutation : previous?.bestMutation ?? mutation,
    };
    profile.stats.totalCatches += 1;
    profile.stats.biggestWeight = Math.max(profile.stats.biggestWeight, rolled.weight);
    profile.stats.rarestRank = Math.max(profile.stats.rarestRank, RARITY_RANK[species.rarity]);
    if (perfect) profile.stats.perfectCatches += 1;
    if (mutation !== "normal") profile.stats.mutationsFound += 1;
    player.perfectCatches = profile.stats.perfectCatches;
    profile.mastery[this.location] = masteryXp + Math.max(1, Math.round(rolled.xp * 0.5));

    if (RARITY_RANK[species.rarity] >= 4 || rolled.weight >= species.maxWeight * 0.82) {
      profile.trophies.unshift({
        id: randomUUID(),
        speciesId: species.id,
        mutation,
        weight: rolled.weight,
        length: rolled.length,
        at: Date.now(),
        label: `${mutationMeta.label} ${species.name}`,
      });
      profile.trophies = profile.trophies.sort((a, b) => b.weight - a.weight).slice(0, 12);
    }

    if (this.eventDef) {
      this.eventParticipants.set(client.sessionId, (this.eventParticipants.get(client.sessionId) ?? 0) + value);
    }
    if (mutation !== "normal") this.advanceSecretQuests(profile, "mutation", 1);
    this.awardGuild(profile, Math.max(1, Math.round(value / 10)));

    const xpResult = addXp(profile, xpGain);
    applyCatchToQuests(profile, {
      rarity: species.rarity,
      weight: rolled.weight,
      location: this.location,
      perfect,
      isNew,
      mutation: mutation !== "normal",
    });
    const unlocked = refreshAchievements(profile);

    const participant = this.tournamentParticipants.get(client.sessionId);
    if (participant && this.state.tournamentPhase === "active") {
      participant.score += value;
      participant.catches += 1;
      profile.stats.bestTournamentScore = Math.max(profile.stats.bestTournamentScore, participant.score);
    }

    profile.updatedAt = Date.now();
    void store.saveProfile(profile);
    void store.insertCatch({
      id: randomUUID(),
      userId: profile.id,
      fishId: species.id,
      rarity: species.rarity,
      weight: rolled.weight,
      length: rolled.length,
      value,
      location: this.location,
      perfect: perfect ? 1 : 0,
      mutation,
      caughtAt: Date.now(),
    });

    const catchEvent: CatchEvent = {
      username: profile.username,
      speciesId: species.id,
      rarity: species.rarity,
      weight: rolled.weight,
      value,
      perfect,
      length: rolled.length,
      location: this.location,
      isNew,
      mutation,
    };
    this.broadcast("catch", catchEvent);
    for (const achievement of unlocked) {
      client.send("achievement", achievement);
    }
    client.send("minigameEnd", {
      won: true,
      perfect,
      catch: catchEvent,
      xp: xpGain,
      isNew,
      fish,
    });
    if (xpResult.leveledUp) {
      client.send("levelUp", { level: profile.level, username: profile.username });
      this.broadcast("levelUp", { level: profile.level, username: profile.username });
    }
    this.sendProfile(client);
    session.phase = "landed";
    session.landedAt = Date.now() + 1800;
    session.minigame = undefined;
    player.fishingState = "landed";
  }

  private handleSellFish(client: Client, data: Record<string, unknown>): void {
    const profile = this.profiles.get(client.sessionId);
    if (!profile) return;
    const uids = Array.isArray(data.uids) ? data.uids.map(String).slice(0, 200) : [];
    if (!uids.length) return;
    const selling = profile.inventory.filter((fish) => uids.includes(fish.uid));
    if (!selling.length) return;
    const value = selling.reduce((sum, fish) => sum + fish.value, 0);
    profile.inventory = profile.inventory.filter((fish) => !uids.includes(fish.uid));
    profile.coins += value;
    profile.stats.fishSold += selling.length;
    profile.stats.totalValue += value;
    addXp(profile, Math.round(value * 0.04));
    refreshAchievements(profile);
    profile.updatedAt = Date.now();
    void store.saveProfile(profile);
    this.sendProfile(client);
    client.send("sold", { count: selling.length, coins: value });
    this.broadcast("sale", { username: profile.username, count: selling.length, coins: value });
  }

  private handleSellAll(client: Client): void {
    const profile = this.profiles.get(client.sessionId);
    if (!profile || !profile.inventory.length) return;
    const value = profile.inventory.reduce((sum, fish) => sum + fish.value, 0);
    const count = profile.inventory.length;
    profile.inventory = [];
    profile.coins += value;
    profile.stats.fishSold += count;
    profile.stats.totalValue += value;
    addXp(profile, Math.round(value * 0.04));
    refreshAchievements(profile);
    profile.updatedAt = Date.now();
    void store.saveProfile(profile);
    this.sendProfile(client);
    client.send("sold", { count, coins: value });
    this.broadcast("sale", { username: profile.username, count, coins: value });
  }

  private handleBuyRod(client: Client, data: Record<string, unknown>): void {
    const profile = this.profiles.get(client.sessionId);
    if (!profile) return;
    const rod = RODS_BY_ID[String(data.rodId ?? "")];
    if (!rod) return this.fail(client, "Unknown rod.");
    if (profile.rods.includes(rod.id)) return this.fail(client, "You already own that rod.");
    if (profile.coins < rod.price) return this.fail(client, "Not enough coins.");
    profile.coins -= rod.price;
    profile.rods.push(rod.id);
    profile.equippedRod = rod.id;
    const player = this.state.players.get(client.sessionId);
    if (player) player.rod = rod.id;
    profile.updatedAt = Date.now();
    void store.saveProfile(profile);
    this.sendProfile(client);
    client.send("purchase", { message: `Purchased ${rod.name}!` });
  }

  private handleEquipRod(client: Client, data: Record<string, unknown>): void {
    const profile = this.profiles.get(client.sessionId);
    if (!profile) return;
    const rodId = String(data.rodId ?? "");
    if (!profile.rods.includes(rodId)) return this.fail(client, "You do not own that rod.");
    profile.equippedRod = rodId;
    const player = this.state.players.get(client.sessionId);
    if (player) player.rod = rodId;
    profile.updatedAt = Date.now();
    void store.saveProfile(profile);
    this.sendProfile(client);
  }

  private handleBuyBait(client: Client, data: Record<string, unknown>): void {
    const profile = this.profiles.get(client.sessionId);
    if (!profile) return;
    const bait = BAITS_BY_ID[String(data.baitId ?? "")];
    if (!bait) return this.fail(client, "Unknown bait.");
    if (profile.level < bait.levelRequired) return this.fail(client, `Reach level ${bait.levelRequired} to buy ${bait.name}.`);
    if (profile.coins < bait.price) return this.fail(client, "Not enough coins.");
    profile.coins -= bait.price;
    profile.baits[bait.id] = (profile.baits[bait.id] ?? 0) + bait.bundle;
    profile.equippedBait = bait.id;
    profile.updatedAt = Date.now();
    void store.saveProfile(profile);
    this.sendProfile(client);
    client.send("purchase", { message: `Bought ${bait.bundle}× ${bait.name}.` });
  }

  private handleEquipBait(client: Client, data: Record<string, unknown>): void {
    const profile = this.profiles.get(client.sessionId);
    if (!profile) return;
    const baitId = String(data.baitId ?? "");
    if (!BAITS_BY_ID[baitId]) return;
    profile.equippedBait = baitId;
    profile.updatedAt = Date.now();
    void store.saveProfile(profile);
    this.sendProfile(client);
  }

  private handleBuyInventory(client: Client): void {
    const profile = this.profiles.get(client.sessionId);
    if (!profile) return;
    if (profile.inventorySlots >= 72) return this.fail(client, "Your creel is already fully upgraded.");
    const cost = Math.round(1100 * Math.pow(1.75, (profile.inventorySlots - 24) / 8));
    if (profile.coins < cost) return this.fail(client, `You need ${cost} coins for a bigger creel.`);
    profile.coins -= cost;
    profile.inventorySlots += 8;
    profile.updatedAt = Date.now();
    void store.saveProfile(profile);
    this.sendProfile(client);
    client.send("purchase", { message: `Creel upgraded to ${profile.inventorySlots} slots.` });
  }

  private handleBuyBoat(client: Client): void {
    const profile = this.profiles.get(client.sessionId);
    if (!profile) return;
    if (profile.boatOwned) return this.fail(client, "You already own the Tide Skiff.");
    if (profile.coins < BOAT.price) return this.fail(client, `The Tide Skiff costs ${BOAT.price} coins.`);
    profile.coins -= BOAT.price;
    profile.boatOwned = true;
    profile.updatedAt = Date.now();
    void store.saveProfile(profile);
    this.sendProfile(client);
    client.send("purchase", { message: "The Tide Skiff is yours! The Deep Ocean awaits." });
  }

  private handleBuyCosmetic(client: Client, data: Record<string, unknown>): void {
    const profile = this.profiles.get(client.sessionId);
    if (!profile) return;
    const cosmetic = COSMETICS_BY_ID[String(data.cosmeticId ?? "")];
    if (!cosmetic) return;
    if (cosmetic.rewardOnly) return this.fail(client, "That garment is a reward, not a shop item.");
    if (cosmetic.season && cosmetic.season !== currentSeason()) {
      return this.fail(client, `${cosmetic.name} returns during ${SEASON_LABEL[cosmetic.season]}.`);
    }
    if (profile.cosmetics.includes(cosmetic.id)) return this.fail(client, "You already own that.");
    if (profile.coins < cosmetic.price) return this.fail(client, "Not enough coins.");
    profile.coins -= cosmetic.price;
    profile.cosmetics.push(cosmetic.id);
    if (cosmetic.type === "hat") profile.appearance.hat = cosmetic.value;
    else profile.appearance.shirt = cosmetic.value;
    const player = this.state.players.get(client.sessionId);
    if (player) player.appearance = JSON.stringify(profile.appearance);
    profile.updatedAt = Date.now();
    void store.saveProfile(profile);
    this.sendProfile(client);
    client.send("purchase", { message: `Purchased ${cosmetic.name}.` });
  }

  private handleSetAppearance(client: Client, data: Record<string, unknown>): void {
    const profile = this.profiles.get(client.sessionId);
    if (!profile) return;
    const current = profile.appearance;
    const isHex = (value: unknown) => typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
    const next: Appearance = {
      skin: isHex(data.skin) ? String(data.skin) : current.skin,
      hair: isHex(data.hair) ? String(data.hair) : current.hair,
      shirt: isHex(data.shirt) ? String(data.shirt) : current.shirt,
      pants: isHex(data.pants) ? String(data.pants) : current.pants,
      hat: typeof data.hat === "string" ? data.hat.slice(0, 20) : current.hat,
      hairStyle: Math.round(safeNumber(data.hairStyle, current.hairStyle, 0, 3)),
    };
    if (next.hat !== "none") {
      const hatCosmetic = Object.values(COSMETICS_BY_ID).find((c) => c.type === "hat" && c.value === next.hat);
      if (hatCosmetic && !profile.cosmetics.includes(hatCosmetic.id)) next.hat = current.hat;
    }
    profile.appearance = next;
    const player = this.state.players.get(client.sessionId);
    if (player) player.appearance = JSON.stringify(next);
    profile.updatedAt = Date.now();
    void store.saveProfile(profile);
    this.sendProfile(client);
  }

  private handleSetSettings(client: Client, data: Record<string, unknown>): void {
    const profile = this.profiles.get(client.sessionId);
    if (!profile) return;
    profile.settings.music = clamp01(safeNumber(data.music, profile.settings.music, 0, 1));
    profile.settings.sfx = clamp01(safeNumber(data.sfx, profile.settings.sfx, 0, 1));
    if (["high", "medium", "low"].includes(String(data.quality))) {
      profile.settings.quality = data.quality as "high" | "medium" | "low";
    }
    if (typeof data.showNames === "boolean") profile.settings.showNames = data.showNames;
    if (typeof data.showJoystick === "boolean") profile.settings.showJoystick = data.showJoystick;
    profile.updatedAt = Date.now();
    void store.saveProfile(profile);
    this.sendProfile(client);
  }

  private handleClaimQuest(client: Client, data: Record<string, unknown>): void {
    const profile = this.profiles.get(client.sessionId);
    if (!profile) return;
    ensureDaily(profile);
    const quest = profile.daily.quests.find((q) => q.id === String(data.questId ?? ""));
    if (!quest) return;
    if (quest.claimed) return this.fail(client, "Already claimed.");
    if (quest.progress < quest.target) return this.fail(client, "Quest not complete yet.");
    quest.claimed = true;
    profile.coins += quest.rewardCoins;
    addXp(profile, quest.rewardXp);
    profile.updatedAt = Date.now();
    void store.saveProfile(profile);
    this.sendProfile(client);
    client.send("questClaimed", { questId: quest.id, coins: quest.rewardCoins, xp: quest.rewardXp });
  }

  private handleClaimAchievement(client: Client, data: Record<string, unknown>): void {
    const profile = this.profiles.get(client.sessionId);
    if (!profile) return;
    const achievement = profile.achievements.find((a) => a.id === String(data.achievementId ?? ""));
    if (!achievement || achievement.claimed || !achievement.unlockedAt) return;
    achievement.claimed = true;
    profile.coins += achievement.rewardCoins;
    profile.updatedAt = Date.now();
    void store.saveProfile(profile);
    this.sendProfile(client);
    client.send("achievementClaimed", { achievementId: achievement.id, coins: achievement.rewardCoins });
  }

  private handleChat(client: Client, data: Record<string, unknown>): void {
    const profile = this.profiles.get(client.sessionId);
    if (!profile) return;
    const now = Date.now();
    const last = this.chatTimes.get(client.sessionId) ?? 0;
    if (now - last < 700) return;
    this.chatTimes.set(client.sessionId, now);
    const text = String(data.text ?? "")
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .trim()
      .slice(0, MAX_CHAT_LENGTH);
    if (!text) return;
    const message = {
      id: randomUUID(),
      username: profile.username,
      text,
      at: now,
    };
    if (!data.local) {
      this.broadcast("chat", message);
      return;
    }
    const speaker = this.state.players.get(client.sessionId);
    if (!speaker) return;
    for (const other of this.clients) {
      const listener = this.state.players.get(other.sessionId);
      if (!listener) continue;
      if (other.sessionId === client.sessionId || Math.hypot(listener.x - speaker.x, listener.y - speaker.y) <= 280) {
        other.send("chat", message);
      }
    }
  }

  private handleTournamentJoin(client: Client): void {
    const profile = this.profiles.get(client.sessionId);
    if (!profile) return;
    if (this.state.tournamentPhase === "results") return this.fail(client, "This tournament has just finished.");
    this.tournamentParticipants.set(client.sessionId, {
      name: profile.username,
      userId: profile.id,
      score: 0,
      catches: 0,
    });
    this.state.tournamentEntries = this.tournamentParticipants.size;
    if (this.state.tournamentPhase === "idle" && this.state.tournamentStartsAt - Date.now() > 90000) {
      this.state.tournamentStartsAt = Date.now() + 60000;
    }
    this.sendTournament(client);
    this.broadcastTournament();
  }

  private handleTournamentLeave(client: Client): void {
    this.tournamentParticipants.delete(client.sessionId);
    this.state.tournamentEntries = this.tournamentParticipants.size;
    this.sendTournament(client);
    this.broadcastTournament();
  }

  private updateTournament(now: number): void {
    if (this.state.tournamentPhase === "idle" && now >= this.state.tournamentStartsAt) {
      if (this.tournamentParticipants.size > 0) {
        this.state.tournamentPhase = "active";
        this.state.tournamentEndsAt = now + TOURNAMENT_LENGTH;
        this.state.tournamentStartsAt = 0;
        this.tournamentResults = [];
        this.broadcastTournament();
        this.broadcast("system", { text: "The fishing tournament has begun! Catch the most valuable fish." });
      } else {
        this.state.tournamentStartsAt = now + TOURNAMENT_INTERMISSION;
      }
    } else if (this.state.tournamentPhase === "active" && now >= this.state.tournamentEndsAt) {
      this.finishTournament(now);
    } else if (this.state.tournamentPhase === "results" && now >= this.tournamentResultsUntil) {
      this.state.tournamentPhase = "idle";
      this.state.tournamentStartsAt = now + TOURNAMENT_INTERMISSION;
      this.state.tournamentEndsAt = 0;
      this.tournamentParticipants.clear();
      this.state.tournamentEntries = 0;
      this.tournamentResults = [];
      this.broadcastTournament();
    }
  }

  private finishTournament(now: number): void {
    const sorted = [...this.tournamentParticipants.entries()]
      .map(([sessionId, entry]) => ({ sessionId, ...entry }))
      .sort((a, b) => b.score - a.score || b.catches - a.catches);
    this.tournamentResults = sorted.map((entry, index) => ({
      username: entry.name,
      score: entry.score,
      catches: entry.catches,
      place: index + 1,
    }));
    const rewards = [
      { coins: 1500, xp: 500 },
      { coins: 750, xp: 250 },
      { coins: 350, xp: 120 },
    ];
    for (const [index, entry] of sorted.entries()) {
      const profile = this.profiles.get(entry.sessionId);
      const client = this.clients.find((c) => c.sessionId === entry.sessionId);
      if (!profile) continue;
      const reward = rewards[index] ?? { coins: 60, xp: 25 };
      profile.coins += reward.coins;
      addXp(profile, reward.xp);
      profile.stats.bestTournamentScore = Math.max(profile.stats.bestTournamentScore, entry.score);
      if (index === 0) profile.stats.tournamentsWon += 1;
      refreshAchievements(profile);
      profile.updatedAt = now;
      void store.saveProfile(profile);
      void store.insertTournamentResult({
        id: randomUUID(),
        roomId: this.roomId,
        userId: entry.userId,
        username: entry.name,
        score: entry.score,
        catches: entry.catches,
        place: index + 1,
        endedAt: now,
      });
      if (client) {
        client.send("tournamentResult", {
          place: index + 1,
          score: entry.score,
          coins: reward.coins,
          xp: reward.xp,
        });
        this.sendProfile(client);
      }
    }
    this.state.tournamentPhase = "results";
    this.state.tournamentEndsAt = now + 15000;
    this.tournamentResultsUntil = now + 15000;
    this.broadcastTournament();
    if (sorted[0]) {
      this.broadcast("system", { text: `${sorted[0].name} wins the tournament with ${sorted[0].score.toLocaleString()} points!` });
    }
  }

  private sendTournament(client: Client): void {
    const participant = this.tournamentParticipants.get(client.sessionId);
    const view: TournamentView = {
      phase: this.state.tournamentPhase as TournamentView["phase"],
      endsAt: this.state.tournamentEndsAt,
      startsAt: this.state.tournamentStartsAt,
      entries: this.state.tournamentEntries,
      joined: !!participant,
      score: participant?.score ?? 0,
      results: this.state.tournamentPhase === "results" ? this.tournamentResults : undefined,
    };
    client.send("tournament", view);
  }

  private broadcastTournament(): void {
    for (const client of this.clients) this.sendTournament(client);
  }

  private handleCook(client: Client, data: Record<string, unknown>): void {
    const profile = this.profiles.get(client.sessionId);
    const player = this.state.players.get(client.sessionId);
    if (!profile || !player) return;
    if (player.fishingState !== "idle") return this.fail(client, "Reel in your line before cooking.");
    if (!nearestCampfire(this.map, player.x, player.y, 72)) {
      return this.fail(client, "Stand beside a campfire to cook.");
    }
    const uid = String(data.uid ?? "");
    const fish = profile.inventory.find((item) => item.uid === uid);
    if (!fish) return this.fail(client, "That fish is no longer in your creel.");
    if (fish.cooked) return this.fail(client, "That fish is already cooked.");
    const species = getFish(fish.speciesId);
    const recipe = recipeForRarity(species.rarity);
    fish.cooked = true;
    fish.cookedName = recipe.name;
    fish.energy = recipe.energy;
    fish.cookedAt = Date.now();
    fish.value = cookedFishValue(fish.value, species.rarity);
    const buff = COOKING_BUFFS[species.rarity];
    if (buff) {
      fish.buff = buff.id;
      fish.buffUntil = Date.now() + buff.durationMs;
      profile.buffs = profile.buffs.filter((entry) => entry.id !== buff.id);
      profile.buffs.push({ id: buff.id, until: fish.buffUntil });
    }
    player.activity = "cooking";
    this.clock.setTimeout(() => {
      const live = this.state.players.get(client.sessionId);
      if (live) live.activity = "idle";
    }, 1900);
    profile.updatedAt = Date.now();
    void store.saveProfile(profile);
    client.send("cooked", {
      uid,
      name: recipe.name,
      energy: recipe.energy,
      value: fish.value,
      speciesId: species.id,
    });
    this.sendProfile(client);
  }

  private handleEat(client: Client, data: Record<string, unknown>): void {
    const profile = this.profiles.get(client.sessionId);
    const player = this.state.players.get(client.sessionId);
    if (!profile || !player) return;
    if (player.fishingState !== "idle") return this.fail(client, "Reel in your line before eating.");
    const uid = String(data.uid ?? "");
    const index = profile.inventory.findIndex((item) => item.uid === uid);
    if (index < 0) return this.fail(client, "That fish is no longer in your creel.");
    const fish = profile.inventory[index];
    if (!fish.cooked) return this.fail(client, "Cook that fish at a campfire first.");
    const restored = Math.max(1, fish.energy ?? recipeForRarity(getFish(fish.speciesId).rarity).energy);
    const before = profile.energy;
    profile.energy = Math.min(profile.maxEnergy, profile.energy + restored);
    const gained = Math.round(profile.energy - before);
    profile.inventory.splice(index, 1);
    player.energy = Math.round(profile.energy);
    player.activity = "eating";
    this.clock.setTimeout(() => {
      const live = this.state.players.get(client.sessionId);
      if (live) live.activity = "idle";
    }, 1500);
    profile.updatedAt = Date.now();
    void store.saveProfile(profile);
    client.send("ate", {
      name: fish.cookedName ?? "Cooked fish",
      energy: gained,
      total: Math.round(profile.energy),
      maxEnergy: profile.maxEnergy,
    });
    this.sendProfile(client);
  }

  private handleEatBest(client: Client): void {
    const profile = this.profiles.get(client.sessionId);
    if (!profile) return;
    const cooked = profile.inventory
      .filter((item) => item.cooked)
      .sort((a, b) => (b.energy ?? 0) - (a.energy ?? 0));
    if (!cooked.length) return this.fail(client, "No cooked fish yet. Cook one at a campfire first.");
    this.handleEat(client, { uid: cooked[0].uid });
  }

  // ── Boats & diving ────────────────────────────────────────────────────────
  private handleToggleSail(client: Client): void {
    const profile = this.profiles.get(client.sessionId);
    const player = this.state.players.get(client.sessionId);
    if (!profile || !player) return;
    if (!profile.boatOwned) return this.fail(client, "You need to buy the Tide Skiff first.");
    if (player.diving) return this.fail(client, "Climb out of the water before setting sail.");
    if (player.passengerOf) return this.fail(client, "Ask the captain to let you off first.");
    if (player.sailing) {
      if (!canWalk(this.map, player.x, player.y, 6)) {
        const shore = this.findShorePoint(player.x, player.y);
        if (!shore) return this.fail(client, "Sail to a dock before mooring the skiff.");
        player.x = shore.x;
        player.y = shore.y;
      }
      player.sailing = false;
      for (const [sessionId, passenger] of this.state.players) {
        if (passenger.passengerOf !== client.sessionId) continue;
        passenger.passengerOf = "";
        this.clients.find((entry) => entry.sessionId === sessionId)?.send("aboard", { captain: null });
      }
    } else {
      const point = canSail(this.map, player.x, player.y, 6)
        ? { x: player.x, y: player.y }
        : this.findSailPoint(player.x, player.y);
      if (!point) return this.fail(client, "Move closer to open water to launch the skiff.");
      player.x = point.x;
      player.y = point.y;
      player.sailing = true;
    }
    player.fishingState = "idle";
    this.cancelFishingById(client.sessionId, "You stowed your rod.");
    client.send("sailing", { sailing: player.sailing, boatColor: profile.boatColor });
  }

  private handleSetBoatColor(client: Client, data: Record<string, unknown>): void {
    const profile = this.profiles.get(client.sessionId);
    const player = this.state.players.get(client.sessionId);
    if (!profile || !player) return;
    if (!profile.boatOwned) return this.fail(client, "You need a boat before painting it.");
    const paint = BOAT_PAINTS_BY_ID[String(data.paintId ?? "")];
    if (!paint) return this.fail(client, "Unknown boat paint.");
    if (!profile.boatPaints.includes(paint.id)) return this.fail(client, "You do not own that paint.");
    profile.boatColor = paint.id;
    player.boatColor = paint.id;
    profile.updatedAt = Date.now();
    void store.saveProfile(profile);
    client.send("sailing", { sailing: player.sailing, boatColor: paint.id });
    this.sendProfile(client);
  }

  private handleBuyBoatPaint(client: Client, data: Record<string, unknown>): void {
    const profile = this.profiles.get(client.sessionId);
    if (!profile) return;
    if (!profile.boatOwned) return this.fail(client, "Buy the Tide Skiff before buying paints.");
    const paint = BOAT_PAINTS_BY_ID[String(data.paintId ?? "")];
    if (!paint) return this.fail(client, "Unknown boat paint.");
    if (profile.boatPaints.includes(paint.id)) return this.fail(client, "You already own that paint.");
    if (profile.coins < paint.price) return this.fail(client, "Not enough coins.");
    profile.coins -= paint.price;
    profile.boatPaints.push(paint.id);
    profile.boatColor = paint.id;
    const player = this.state.players.get(client.sessionId);
    if (player) player.boatColor = paint.id;
    profile.updatedAt = Date.now();
    void store.saveProfile(profile);
    this.sendProfile(client);
    client.send("purchase", { message: `Painted your skiff ${paint.name}.` });
  }

  private handleBoardBoat(client: Client, data: Record<string, unknown>): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const targetId = String(data.sessionId ?? "");
    const boat = this.state.players.get(targetId);
    if (!boat || boat.id === player.id) return this.fail(client, "That angler is not here.");
    if (!boat.sailing) return this.fail(client, "They are not sailing right now.");
    if (Math.hypot(boat.x - player.x, boat.y - player.y) > 110) return this.fail(client, "Move closer to the boat.");
    this.cancelFishingById(client.sessionId, "You climbed aboard.");
    player.passengerOf = targetId;
    player.diving = false;
    player.sailing = false;
    client.send("aboard", { captain: boat.username });
  }

  private handleLeaveBoat(client: Client): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    if (!player.passengerOf) return;
    player.passengerOf = "";
    client.send("aboard", { captain: null });
  }

  private handleBuyEquipment(client: Client, itemId: string): void {
    const profile = this.profiles.get(client.sessionId);
    if (!profile) return;
    const item = Object.values(EQUIPMENT).find((entry) => entry.id === itemId);
    if (!item) return this.fail(client, "Unknown equipment.");
    if (item.id === "dive-gear" && profile.diveGear) return this.fail(client, "You already own the diver's kit.");
    if (profile.equipment.includes(item.id)) return this.fail(client, "You already own that.");
    if (profile.coins < item.price) return this.fail(client, `You need ${item.price} coins for the ${item.name}.`);
    profile.coins -= item.price;
    profile.equipment.push(item.id);
    if (item.id === "dive-gear") profile.diveGear = true;
    profile.updatedAt = Date.now();
    void store.saveProfile(profile);
    this.sendProfile(client);
    client.send("purchase", { message: `Purchased ${item.name}.` });
  }

  private handleToggleDive(client: Client): void {
    const profile = this.profiles.get(client.sessionId);
    const player = this.state.players.get(client.sessionId);
    if (!profile || !player) return;
    if (!profile.diveGear) return this.fail(client, "Buy the Tide Diver's Kit at the shop first.");
    if (player.sailing) return this.fail(client, "Dock the boat before diving.");
    if (player.passengerOf) return this.fail(client, "Leave the boat before diving.");
    this.cancelFishingById(client.sessionId, "You stowed your rod.");
    if (player.diving) {
      if (!canWalk(this.map, player.x, player.y, 6)) {
        const shore = this.findShorePoint(player.x, player.y);
        if (!shore) return this.fail(client, "Swim closer to a dock or shore before surfacing.");
        player.x = shore.x;
        player.y = shore.y;
      }
      player.diving = false;
    } else {
      if (!canSwim(this.map, player.x, player.y, 6)) {
        const point = this.findSwimPoint(player.x, player.y);
        if (!point) return this.fail(client, "Move beside open water to dive.");
        player.x = point.x;
        player.y = point.y;
      }
      player.diving = true;
    }
    client.send("diving", { diving: player.diving });
  }

  private findShorePoint(x: number, y: number): { x: number; y: number } | null {
    for (let radius = 10; radius <= 220; radius += 10) {
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 10) {
        const px = x + Math.cos(angle) * radius;
        const py = y + Math.sin(angle) * radius;
        if (canWalk(this.map, px, py, 6)) {
          return clampToMap(this.map, px, py);
        }
      }
    }
    return null;
  }

  private findSailPoint(x: number, y: number): { x: number; y: number } | null {
    for (let radius = 10; radius <= 220; radius += 10) {
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 10) {
        const px = x + Math.cos(angle) * radius;
        const py = y + Math.sin(angle) * radius;
        if (canSail(this.map, px, py, 6)) {
          return clampToMap(this.map, px, py);
        }
      }
    }
    return null;
  }

  private findSwimPoint(x: number, y: number): { x: number; y: number } | null {
    for (let radius = 8; radius <= 180; radius += 8) {
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 10) {
        const px = x + Math.cos(angle) * radius;
        const py = y + Math.sin(angle) * radius;
        if (canSwim(this.map, px, py, 6)) {
          return clampToMap(this.map, px, py);
        }
      }
    }
    return null;
  }

  // ── Treasures ─────────────────────────────────────────────────────────────
  private spawnTreasure(now: number): void {
    const players = [...this.state.players.values()];
    const base = players[Math.floor(Math.random() * Math.max(1, players.length))];
    const origin = base ?? { x: (this.map.width * TILE) / 2, y: (this.map.height * TILE) / 2 };
    let point: { x: number; y: number } | null = null;
    for (let attempt = 0; attempt < 8 && !point; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const candidate = findWaterPoint(
        this.map,
        origin.x,
        origin.y,
        Math.cos(angle),
        Math.sin(angle),
        90 + Math.random() * 120,
        420,
      );
      if (!candidate) continue;
      const tooClose = [...this.treasures.values()].some(
        (existing) => Math.hypot(existing.x - candidate.x, existing.y - candidate.y) < 90,
      );
      if (!tooClose) point = candidate;
    }
    if (!point) return;
    const kind = TREASURE_KINDS[Math.floor(Math.random() * TREASURE_KINDS.length)];
    const treasure: TreasureView = {
      id: randomUUID(),
      x: Math.round(point.x),
      y: Math.round(point.y),
      kind: kind.id,
      expiresAt: now + 150000,
    };
    this.treasures.set(treasure.id, treasure);
    this.broadcast("treasure", { type: "spawn", treasure });
  }

  private updateTreasures(now: number): void {
    for (const [id, treasure] of [...this.treasures.entries()]) {
      if (now < treasure.expiresAt) continue;
      this.treasures.delete(id);
      this.broadcast("treasure", { type: "remove", id });
    }
    if (now >= this.treasureNextAt && this.treasures.size < 6) {
      this.treasureNextAt = now + 24000;
      this.spawnTreasure(now);
    }
  }

  private handleCollectTreasure(client: Client, data: Record<string, unknown>): void {
    const profile = this.profiles.get(client.sessionId);
    const player = this.state.players.get(client.sessionId);
    if (!profile || !player) return;
    const treasure = this.treasures.get(String(data.id ?? ""));
    if (!treasure) return this.fail(client, "That treasure is gone.");
    if (!profile.diveGear) return this.fail(client, "You need the Tide Diver's Kit to reach sunken treasure.");
    if (!player.diving) return this.fail(client, "Dive down to open the chest.");
    const reach = profile.equipment.includes("sonar") ? 130 : 64;
    if (Math.hypot(treasure.x - player.x, treasure.y - player.y) > reach) return this.fail(client, "Swim closer to the treasure.");
    const kind = TREASURE_KINDS.find((entry) => entry.id === treasure.kind) ?? TREASURE_KINDS[0];
    const coins = kind.coins[0] + Math.floor(Math.random() * (kind.coins[1] - kind.coins[0] + 1));
    const material = kind.materials[Math.floor(Math.random() * kind.materials.length)];
    profile.coins += coins;
    profile.materials[material] = (profile.materials[material] ?? 0) + 1;
    profile.stats.treasuresFound += 1;
    addXp(profile, kind.xp);
    applyTreasureToQuests(profile, 1);
    this.advanceSecretQuests(profile, "treasure", 1);
    this.awardGuild(profile, 25);
    refreshAchievements(profile);
    profile.updatedAt = Date.now();
    void store.saveProfile(profile);
    this.treasures.delete(treasure.id);
    this.broadcast("treasure", { type: "remove", id: treasure.id });
    client.send("treasureCollected", {
      coins,
      material,
      name: MATERIALS_BY_ID[material]?.name ?? "Sunken treasure",
      xp: kind.xp,
    });
    this.sendProfile(client);
  }

  // ── World events ──────────────────────────────────────────────────────────
  private eventView(): WorldEventView | null {
    if (!this.eventDef) return null;
    return {
      id: this.eventDef.id,
      name: this.eventDef.name,
      description: this.eventDef.description,
      startedAt: this.eventDef ? this.eventEndsAt - this.eventDef.durationMs : 0,
      endsAt: this.eventEndsAt,
      color: this.eventDef.color,
      icon: this.eventDef.icon,
    };
  }

  private sendEvents(client: Client): void {
    client.send("events", {
      active: this.eventView(),
      nextAt: this.eventNextAt,
      intermission: EVENT_INTERMISSION_MS,
      creatureActive: !!this.creature,
    });
  }

  private broadcastEvents(): void {
    for (const client of this.clients) this.sendEvents(client);
  }

  private updateEvents(now: number): void {
    if (this.eventDef && now >= this.eventEndsAt) this.endEvent(now);
    else if (!this.eventDef && now >= this.eventNextAt) this.startEvent(now);
    if (this.partyActive && now - this.partySince > 45000) {
      this.partyActive = false;
      this.partyMembers.clear();
      this.broadcast("party", { active: false, count: 0 });
    }
  }

  private startEvent(now: number): void {
    const def = WORLD_EVENTS[Math.floor(Math.random() * WORLD_EVENTS.length)];
    this.eventDef = def;
    this.eventEndsAt = now + def.durationMs;
    this.eventNextAt = this.eventEndsAt + EVENT_INTERMISSION_MS;
    this.state.eventId = def.id;
    this.state.eventName = def.name;
    this.state.eventStartedAt = now;
    this.state.eventEndsAt = this.eventEndsAt;
    this.eventParticipants.clear();
    if (def.weather) {
      if (!this.weatherBeforeEvent) this.weatherBeforeEvent = this.state.weather;
      this.state.weather = def.weather;
      this.broadcast("weather", { weather: def.weather });
    }
    if (def.spawnCreature) this.spawnCreature(def.spawnCreature, now);
    this.broadcastEvents();
    this.broadcast("event", this.eventView());
    this.broadcast("system", { text: `${def.icon} ${def.name} — ${def.description}` });
  }

  private endEvent(now: number): void {
    const def = this.eventDef;
    if (!def) return;
    const entries = [...this.eventParticipants.entries()].sort((a, b) => b[1] - a[1]);
    for (const [sessionId, score] of entries) {
      const profile = this.profiles.get(sessionId);
      if (!profile) continue;
      const coins = Math.round(120 + score * 0.08);
      const xp = Math.round(60 + score * 0.04);
      profile.coins += coins;
      addXp(profile, xp);
      profile.stats.eventsWon += 1;
      refreshAchievements(profile);
      profile.updatedAt = now;
      void store.saveProfile(profile);
      const client = this.clients.find((entry) => entry.sessionId === sessionId);
      client?.send("eventReward", { eventId: def.id, name: def.name, coins, xp, score });
      if (client) this.sendProfile(client);
    }
    this.eventParticipants.clear();
    if (this.weatherBeforeEvent) {
      this.state.weather = this.weatherBeforeEvent;
      this.weatherBeforeEvent = null;
      this.broadcast("weather", { weather: this.state.weather });
    }
    this.eventDef = null;
    this.state.eventId = "";
    this.state.eventName = "";
    this.state.eventStartedAt = 0;
    this.state.eventEndsAt = 0;
    this.eventNextAt = now + EVENT_INTERMISSION_MS;
    this.broadcastEvents();
    this.broadcast("eventEnd", { eventId: def.id });
  }

  // ── Giant creatures ───────────────────────────────────────────────────────
  private creatureView(sessionId?: string): CreatureView | null {
    const runtime = this.creature;
    if (!runtime) return null;
    const contribution = sessionId ? runtime.contributions.get(sessionId) ?? 0 : 0;
    return {
      id: runtime.def.id,
      name: runtime.def.name,
      kind: runtime.def.kind,
      x: Math.round(runtime.x),
      y: Math.round(runtime.y),
      hp: Math.round(runtime.hp),
      maxHp: runtime.maxHp,
      endsAt: runtime.endsAt,
      participants: runtime.contributions.size,
      joined: sessionId ? runtime.contributions.has(sessionId) : false,
      contribution: Math.round(contribution),
    };
  }

  private sendCreature(client: Client): void {
    client.send("creature", { active: !!this.creature, creature: this.creatureView(client.sessionId) });
  }

  private broadcastCreature(): void {
    for (const client of this.clients) this.sendCreature(client);
  }

  private updateCreatures(now: number): void {
    if (this.creature && now >= this.creature.endsAt) {
      this.resolveCreature(false, now);
    } else if (!this.creature && now >= this.creatureNextAt && this.state.players.size > 0) {
      this.spawnCreature(null, now);
    }
  }

  private spawnCreature(id: GiantCreatureId | null, now: number): void {
    if (this.creature) return;
    const pool = GIANT_CREATURES.filter((creature) => creature.locations.includes(this.location));
    const def = (id ? CREATURES_BY_ID[id] : pool[Math.floor(Math.random() * pool.length)]) ?? pool[0];
    if (!def || !def.locations.includes(this.location)) return;
    const originX = (this.map.width * TILE) / 2;
    const originY = (this.map.height * TILE) / 2;
    const point = findWaterPoint(this.map, originX, originY, 0, 1, 90, 720) ?? { x: originX, y: originY };
    const clamped = clampToMap(this.map, point.x, point.y);
    this.creature = {
      def,
      x: clamped.x,
      y: clamped.y,
      hp: def.hp,
      maxHp: def.hp,
      endsAt: now + 240000,
      contributions: new Map(),
      lastStrike: new Map(),
    };
    this.state.creatureActive = true;
    this.state.creatureId = def.id;
    this.state.creatureName = def.name;
    this.state.creatureKind = def.kind;
    this.state.creatureX = Math.round(clamped.x);
    this.state.creatureY = Math.round(clamped.y);
    this.state.creatureHp = def.hp;
    this.state.creatureMaxHp = def.hp;
    this.state.creatureEndsAt = this.creature.endsAt;
    this.creatureNextAt = this.creature.endsAt + 120000;
    this.broadcastCreature();
    this.broadcast("system", { text: `${def.name} has surfaced nearby! Join the hunt and strike together.` });
  }

  private handleJoinCreature(client: Client): void {
    const runtime = this.creature;
    const profile = this.profiles.get(client.sessionId);
    const player = this.state.players.get(client.sessionId);
    if (!runtime || !profile || !player) return this.fail(client, "No giant creature is nearby.");
    if (profile.level < runtime.def.minLevel) return this.fail(client, `Reach level ${runtime.def.minLevel} to face ${runtime.def.name}.`);
    if (Math.hypot(runtime.x - player.x, runtime.y - player.y) > 420) return this.fail(client, "Sail closer to the creature.");
    if (!runtime.contributions.has(client.sessionId)) {
      runtime.contributions.set(client.sessionId, 0);
      client.send("system", { text: `You joined the hunt for ${runtime.def.name}. Strike it with your rod!` });
    }
    this.sendCreature(client);
    this.broadcastCreature();
  }

  private handleStrikeCreature(client: Client): void {
    const runtime = this.creature;
    const profile = this.profiles.get(client.sessionId);
    const player = this.state.players.get(client.sessionId);
    if (!runtime || !profile || !player) return;
    if (!runtime.contributions.has(client.sessionId)) return this.fail(client, "Join the hunt before striking.");
    const now = Date.now();
    const last = runtime.lastStrike.get(client.sessionId) ?? 0;
    if (now - last < 520) return;
    if (Math.hypot(runtime.x - player.x, runtime.y - player.y) > 440) return this.fail(client, "Move closer to strike.");
    runtime.lastStrike.set(client.sessionId, now);
    const rod = RODS_BY_ID[profile.equippedRod] ?? RODS_BY_ID.wooden;
    const mastery = profile.mastery[this.location] ?? 0;
    const critical = Math.random() < 0.12;
    const damage = Math.round((40 + rod.luck * 28 + profile.level * 2 + Math.random() * 40) * (1 + mastery / 2400) * (critical ? 1.8 : 1));
    runtime.hp = Math.max(0, runtime.hp - damage);
    const contribution = (runtime.contributions.get(client.sessionId) ?? 0) + damage;
    runtime.contributions.set(client.sessionId, contribution);
    this.state.creatureHp = Math.round(runtime.hp);
    client.send("creatureHit", {
      damage,
      critical,
      hp: Math.round(runtime.hp),
      maxHp: runtime.maxHp,
      contribution: Math.round(contribution),
    });
    if (runtime.hp <= 0) this.resolveCreature(true, now);
    else this.broadcastCreature();
  }

  private resolveCreature(killed: boolean, now: number): void {
    const runtime = this.creature;
    if (!runtime) return;
    const def = runtime.def;
    const total = [...runtime.contributions.values()].reduce((sum, value) => sum + value, 0) || 1;
    const sorted = [...runtime.contributions.entries()].sort((a, b) => b[1] - a[1]);
    const topSession = sorted[0]?.[0];
    for (const [sessionId, damage] of sorted) {
      const profile = this.profiles.get(sessionId);
      if (!profile) continue;
      const share = damage / total;
      const coins = Math.round(def.rewardCoins * (0.35 + share * 0.65));
      const xp = Math.round(def.rewardXp * (0.35 + share * 0.65));
      profile.coins += coins;
      addXp(profile, xp);
      this.awardGuild(profile, Math.round(damage / 8));
      if (killed) {
        profile.stats.giantCatches += 1;
        applyGiantToQuests(profile, 1);
      }
      const drop = killed && sessionId === topSession ? def.drop : null;
      if (drop) profile.materials[drop] = (profile.materials[drop] ?? 0) + 1;
      refreshAchievements(profile);
      profile.updatedAt = now;
      void store.saveProfile(profile);
      void store.insertCreatureHunt({
        id: randomUUID(),
        roomId: this.roomId,
        creatureId: def.id,
        userId: profile.id,
        username: profile.username,
        damage,
        killed: killed ? 1 : 0,
        at: now,
      });
      const client = this.clients.find((entry) => entry.sessionId === sessionId);
      client?.send("creatureResult", {
        killed,
        name: def.name,
        coins,
        xp,
        damage: Math.round(damage),
        share: Math.round(share * 100),
        drop,
      });
      if (client) this.sendProfile(client);
    }
    this.creature = null;
    this.state.creatureActive = false;
    this.state.creatureId = "";
    this.state.creatureName = "";
    this.state.creatureKind = "";
    this.state.creatureHp = 0;
    this.state.creatureMaxHp = 0;
    this.state.creatureEndsAt = 0;
    this.creatureNextAt = now + 150000;
    this.broadcastCreature();
    this.broadcast("system", {
      text: killed ? `${def.name} has been defeated! The hunters share the spoils.` : `${def.name} slipped back into the deep.`,
    });
  }

  // ── Housing & aquarium ────────────────────────────────────────────────────
  private handleSaveHouse(client: Client, data: Record<string, unknown>): void {
    const profile = this.profiles.get(client.sessionId);
    if (!profile) return;
    if (typeof data.theme === "string" && HOUSE_THEMES.some((theme) => theme.id === data.theme)) {
      profile.house.theme = data.theme;
    }
    if (typeof data.name === "string") {
      const name = data.name.replace(/[<>&]/g, "").trim().slice(0, 24);
      if (name) profile.house.name = name;
    }
    if (Array.isArray(data.furniture)) {
      const owned = new Map<string, number>(Object.entries(profile.furniture ?? {}));
      const used = new Map<string, number>();
      const placements = data.furniture
        .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object")
        .map((entry) => ({
          id: String(entry.id ?? randomUUID()).slice(0, 40),
          item: String(entry.item ?? ""),
          x: Math.round(safeNumber(entry.x, 0, 0, 15)),
          y: Math.round(safeNumber(entry.y, 0, 0, 11)),
        }))
        .filter((entry) => {
          if (!FURNITURE_BY_ID[entry.item]) return false;
          const available = owned.get(entry.item) ?? 0;
          const usedCount = used.get(entry.item) ?? 0;
          if (usedCount >= available) return false;
          used.set(entry.item, usedCount + 1);
          return true;
        })
        .slice(0, 60);
      profile.house.furniture = placements;
    }
    profile.updatedAt = Date.now();
    void store.saveProfile(profile);
    this.sendProfile(client);
    client.send("houseSaved", { house: profile.house });
  }

  private handleBuyFurniture(client: Client, data: Record<string, unknown>): void {
    const profile = this.profiles.get(client.sessionId);
    if (!profile) return;
    const item = FURNITURE_BY_ID[String(data.itemId ?? "")];
    if (!item) return this.fail(client, "Unknown furniture.");
    if (profile.coins < item.price) return this.fail(client, "Not enough coins.");
    if (profile.house.furniture.length >= 60) return this.fail(client, "Your house is full.");
    profile.coins -= item.price;
    profile.furniture[item.id] = (profile.furniture[item.id] ?? 0) + 1;
    profile.house.furniture.push({
      id: randomUUID(),
      item: item.id,
      x: Math.round(safeNumber(data.x, 4, 0, 15)),
      y: Math.round(safeNumber(data.y, 4, 0, 11)),
    });
    profile.updatedAt = Date.now();
    void store.saveProfile(profile);
    this.sendProfile(client);
    client.send("houseSaved", { house: profile.house });
    client.send("purchase", { message: `Placed ${item.name}.` });
  }

  private handleAquariumAdd(client: Client, data: Record<string, unknown>): void {
    const profile = this.profiles.get(client.sessionId);
    if (!profile) return;
    const uid = String(data.uid ?? "");
    const fish = profile.inventory.find((entry) => entry.uid === uid);
    if (!fish) return this.fail(client, "That fish is not in your creel.");
    if (profile.aquarium.fish.length >= profile.aquarium.slots) {
      return this.fail(client, "Your aquarium is full. Remove a fish first.");
    }
    profile.inventory = profile.inventory.filter((entry) => entry.uid !== uid);
    profile.aquarium.fish.push({
      uid: fish.uid,
      speciesId: fish.speciesId,
      mutation: fish.mutation ?? "normal",
      weight: fish.weight,
      addedAt: Date.now(),
    });
    profile.updatedAt = Date.now();
    void store.saveProfile(profile);
    this.sendProfile(client);
    client.send("aquarium", { aquarium: profile.aquarium });
  }

  private handleAquariumRemove(client: Client, data: Record<string, unknown>): void {
    const profile = this.profiles.get(client.sessionId);
    if (!profile) return;
    const uid = String(data.uid ?? "");
    const index = profile.aquarium.fish.findIndex((entry) => entry.uid === uid);
    if (index < 0) return;
    if (profile.inventory.length >= profile.inventorySlots) return this.fail(client, "Your creel is full.");
    const entry = profile.aquarium.fish[index];
    profile.aquarium.fish.splice(index, 1);
    const species = getFish(entry.speciesId);
    profile.inventory.push({
      uid: randomUUID(),
      speciesId: entry.speciesId,
      weight: entry.weight,
      length: Math.round(species.minLength + (species.maxLength - species.minLength) * 0.6),
      value: Math.round(species.basePrice * (1 + entry.weight / 12)),
      caughtAt: Date.now(),
      location: this.location,
      perfect: false,
      mutation: entry.mutation,
    });
    profile.updatedAt = Date.now();
    void store.saveProfile(profile);
    this.sendProfile(client);
    client.send("aquarium", { aquarium: profile.aquarium });
  }

  private handleAquariumFeed(client: Client): void {
    const profile = this.profiles.get(client.sessionId);
    if (!profile) return;
    if (profile.coins < 25) return this.fail(client, "Feeding costs 25 coins.");
    profile.coins -= 25;
    profile.aquarium.food += 1;
    profile.aquarium.fedAt = Date.now();
    addXp(profile, 8);
    profile.updatedAt = Date.now();
    void store.saveProfile(profile);
    this.sendProfile(client);
    client.send("aquariumFed", { food: profile.aquarium.food });
  }

  private handleAquariumTheme(client: Client, data: Record<string, unknown>): void {
    const profile = this.profiles.get(client.sessionId);
    if (!profile) return;
    const theme = AQUARIUM_THEMES.find((entry) => entry.id === String(data.themeId ?? ""));
    if (!theme) return this.fail(client, "Unknown aquarium theme.");
    profile.aquarium.theme = theme.id;
    profile.updatedAt = Date.now();
    void store.saveProfile(profile);
    this.sendProfile(client);
    client.send("aquarium", { aquarium: profile.aquarium });
  }

  private async handleVisitHouse(client: Client, data: Record<string, unknown>): Promise<void> {
    const now = Date.now();
    const last = this.visitTimes.get(client.sessionId) ?? 0;
    if (now - last < 3500) return;
    this.visitTimes.set(client.sessionId, now);
    const found = await store.findProfileByUsername(String(data.username ?? ""));
    if (!found) return this.fail(client, "No island belongs to that angler.");
    found.profile.house.visits += 1;
    await store.saveProfile(found.profile);
    const view: HouseVisitView = {
      owner: found.profile.username,
      house: found.profile.house,
      aquarium: found.profile.aquarium,
      trophies: found.profile.trophies,
      level: found.profile.level,
      visits: found.profile.house.visits,
    };
    client.send("houseVisit", view);
  }

  // ── Social ────────────────────────────────────────────────────────────────
  private handleEmote(client: Client, data: Record<string, unknown>): void {
    const profile = this.profiles.get(client.sessionId);
    const player = this.state.players.get(client.sessionId);
    if (!profile || !player) return;
    const allowed = ["wave", "dance", "heart", "laugh", "fish", "sit", "party", "sleep"];
    const emote = String(data.emote ?? "");
    if (!allowed.includes(emote)) return;
    const now = Date.now();
    const last = this.emoteTimes.get(client.sessionId) ?? 0;
    if (now - last < 1600) return;
    this.emoteTimes.set(client.sessionId, now);
    this.broadcast("emote", {
      sessionId: client.sessionId,
      username: profile.username,
      emote,
      x: Math.round(player.x),
      y: Math.round(player.y),
    });
    if (emote === "party") {
      const fire = nearestCampfire(this.map, player.x, player.y, 120);
      const nearby = [...this.state.players.values()].filter(
        (other) => other.id !== player.id && Math.hypot(other.x - player.x, other.y - player.y) < 140,
      );
      if (fire && nearby.length >= 1) this.startParty(player, nearby.length + 1);
    }
  }

  private startParty(player: PlayerState, count: number): void {
    const now = Date.now();
    if (this.partyActive && now - this.partySince < 15000) return;
    this.partyActive = true;
    this.partySince = now;
    this.partyMembers.clear();
    this.partyMembers.add(player.id);
    const profile = [...this.profiles.values()].find((entry) => entry.id === player.id);
    if (profile) {
      profile.stats.beachParties += 1;
      addXp(profile, 30);
      refreshAchievements(profile);
      profile.updatedAt = now;
      void store.saveProfile(profile);
    }
    this.broadcast("party", { active: true, count, host: player.username });
    this.broadcast("system", { text: `${player.username} started a beach party at the campfire!` });
  }

  private handleFriendAdd(client: Client, data: Record<string, unknown>): void {
    const profile = this.profiles.get(client.sessionId);
    if (!profile) return;
    void (async () => {
      const user = await store.findUserByUsername(String(data.username ?? ""));
      if (!user) return this.fail(client, "No angler by that name.");
      if (user.id === profile.id) return this.fail(client, "You are already your own best friend.");
      if (profile.friends.some((friend) => friend.id === user.id)) return this.fail(client, "Already on your crew list.");
      profile.friends.push({ id: user.id, username: user.username, addedAt: Date.now() });
      profile.updatedAt = Date.now();
      await store.saveProfile(profile);
      this.sendFriends(client);
    })();
  }

  private handleFriendRemove(client: Client, data: Record<string, unknown>): void {
    const profile = this.profiles.get(client.sessionId);
    if (!profile) return;
    const id = String(data.id ?? data.username ?? "");
    profile.friends = profile.friends.filter((friend) => friend.id !== id && friend.username !== id);
    profile.updatedAt = Date.now();
    void store.saveProfile(profile);
    this.sendFriends(client);
  }

  private sendFriends(client: Client): void {
    const profile = this.profiles.get(client.sessionId);
    if (!profile) return;
    const online = new Set([...this.profiles.values()].map((entry) => entry.id));
    client.send("friends", {
      friends: profile.friends.map((friend) => ({
        ...friend,
        online: online.has(friend.id),
      })),
    });
  }

  // ── Guilds ────────────────────────────────────────────────────────────────
  private async sendGuild(client: Client): Promise<void> {
    const profile = this.profiles.get(client.sessionId);
    if (!profile) return;
    const guild = profile.guildId ? await store.getGuild(profile.guildId) : null;
    const members = guild ? await store.getGuildMembers(guild.id) : [];
    const list = await store.listGuilds(14);
    const online = new Set([...this.profiles.values()].map((entry) => entry.id));
    const view: GuildView | null = guild
      ? {
          id: guild.id,
          name: guild.name,
          tag: guild.tag,
          description: guild.description,
          ownerId: guild.ownerId,
          level: Math.max(1, 1 + Math.floor(guild.xp / 1200)),
          xp: guild.xp,
          members: members.map((member) => ({
            id: member.userId,
            username: member.username,
            role: member.role,
            level: member.level,
            contribution: member.contribution,
            online: online.has(member.userId),
          })),
          joined: true,
        }
      : null;
    client.send("guild", { guild: view, list });
  }

  private handleGuildCreate(client: Client, data: Record<string, unknown>): void {
    const profile = this.profiles.get(client.sessionId);
    if (!profile) return;
    const name = String(data.name ?? "").replace(/[<>&]/g, "").trim().slice(0, 24);
    const tag = String(data.tag ?? "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 5);
    const description = String(data.description ?? "").replace(/[<>&]/g, "").trim().slice(0, 140);
    if (name.length < 3) return this.fail(client, "Guild names need at least 3 characters.");
    if (tag.length < 2) return this.fail(client, "Guild tags need 2–5 letters.");
    if (profile.guildId) return this.fail(client, "Leave your current guild first.");
    if (profile.coins < 2500) return this.fail(client, "Founding a guild costs 2,500 coins.");
    void (async () => {
      if (await store.getGuildByName(name)) return this.fail(client, "A guild already uses that name.");
      const id = randomUUID();
      await store.createGuild({
        id,
        name,
        tag,
        description,
        ownerId: profile.id,
        xp: 0,
        createdAt: Date.now(),
      });
      await store.addGuildMember(profile.id, id, "leader", Date.now());
      profile.coins -= 2500;
      profile.guildId = id;
      profile.updatedAt = Date.now();
      await store.saveProfile(profile);
      const player = this.state.players.get(client.sessionId);
      if (player) player.guildTag = tag;
      await this.sendGuild(client);
      this.sendProfile(client);
      client.send("purchase", { message: `Founded the ${name} guild!` });
      this.broadcast("system", { text: `${profile.username} founded the guild [${tag}] ${name}.` });
    })();
  }

  private handleGuildJoin(client: Client, data: Record<string, unknown>): void {
    const profile = this.profiles.get(client.sessionId);
    if (!profile) return;
    if (profile.guildId) return this.fail(client, "Leave your current guild first.");
    const guildId = String(data.guildId ?? "");
    void (async () => {
      const guild = await store.getGuild(guildId);
      if (!guild) return this.fail(client, "That guild no longer exists.");
      const members = await store.getGuildMembers(guild.id);
      if (members.length >= 40) return this.fail(client, "That guild is full.");
      await store.addGuildMember(profile.id, guild.id, "member", Date.now());
      profile.guildId = guild.id;
      profile.updatedAt = Date.now();
      await store.saveProfile(profile);
      const player = this.state.players.get(client.sessionId);
      if (player) player.guildTag = guild.tag;
      await this.sendGuild(client);
      this.sendProfile(client);
      client.send("purchase", { message: `Joined [${guild.tag}] ${guild.name}.` });
      this.broadcast("system", { text: `${profile.username} joined [${guild.tag}] ${guild.name}.` });
    })();
  }

  private handleGuildLeave(client: Client): void {
    const profile = this.profiles.get(client.sessionId);
    if (!profile || !profile.guildId) return;
    const guildId = profile.guildId;
    void (async () => {
      const guild = await store.getGuild(guildId);
      if (guild && guild.ownerId === profile.id) {
        await store.deleteGuild(guildId);
        this.broadcast("system", { text: `[${guild.tag}] ${guild.name} has disbanded.` });
      } else {
        await store.removeGuildMember(profile.id);
        if (guild) this.broadcast("system", { text: `${profile.username} left [${guild.tag}] ${guild.name}.` });
      }
      profile.guildId = "";
      profile.updatedAt = Date.now();
      await store.saveProfile(profile);
      const player = this.state.players.get(client.sessionId);
      if (player) player.guildTag = "";
      await this.sendGuild(client);
      this.sendProfile(client);
    })();
  }

  private handleGuildChat(client: Client, data: Record<string, unknown>): void {
    const profile = this.profiles.get(client.sessionId);
    if (!profile || !profile.guildId) return;
    const now = Date.now();
    const last = this.chatTimes.get(`guild:${client.sessionId}`) ?? 0;
    if (now - last < 700) return;
    this.chatTimes.set(`guild:${client.sessionId}`, now);
    const text = String(data.text ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, MAX_CHAT_LENGTH);
    if (!text) return;
    for (const other of this.clients) {
      const otherProfile = this.profiles.get(other.sessionId);
      if (!otherProfile || otherProfile.guildId !== profile.guildId) continue;
      other.send("guildChat", {
        id: randomUUID(),
        username: profile.username,
        text,
        at: now,
      });
    }
  }

  // ── Marketplace ───────────────────────────────────────────────────────────
  private async sendMarket(client: Client): Promise<void> {
    const listings = await store.listMarket(60);
    const view: MarketListing[] = listings.map((listing) => ({
      id: listing.id,
      sellerId: listing.sellerId,
      sellerName: listing.sellerName,
      speciesId: listing.speciesId,
      mutation: listing.mutation as FishMutation,
      weight: listing.weight,
      length: listing.length,
      price: listing.price,
      createdAt: listing.createdAt,
    }));
    client.send("market", { listings: view });
  }

  private handleMarketList(client: Client, data: Record<string, unknown>): void {
    const profile = this.profiles.get(client.sessionId);
    if (!profile) return;
    const uid = String(data.uid ?? "");
    const price = Math.round(safeNumber(data.price, 0, 1, 10_000_000));
    const fish = profile.inventory.find((entry) => entry.uid === uid);
    if (!fish) return this.fail(client, "That fish is not in your creel.");
    if (fish.cooked) return this.fail(client, "Cooked fish cannot be listed.");
    if (price < 10) return this.fail(client, "Set a price of at least 10 coins.");
    void (async () => {
      if ((await store.marketCountForSeller(profile.id)) >= 5) {
        return this.fail(client, "You can list at most 5 fish at a time.");
      }
      profile.inventory = profile.inventory.filter((entry) => entry.uid !== uid);
      await store.addMarketListing({
        id: randomUUID(),
        sellerId: profile.id,
        sellerName: profile.username,
        speciesId: fish.speciesId,
        mutation: fish.mutation ?? "normal",
        weight: fish.weight,
        length: fish.length,
        value: fish.value,
        price,
        createdAt: Date.now(),
      });
      profile.updatedAt = Date.now();
      await store.saveProfile(profile);
      this.sendProfile(client);
      await this.sendMarket(client);
      client.send("purchase", { message: `Listed ${getFish(fish.speciesId).name} for ${price} coins.` });
    })();
  }

  private handleMarketBuy(client: Client, data: Record<string, unknown>): void {
    const profile = this.profiles.get(client.sessionId);
    if (!profile) return;
    const id = String(data.id ?? "");
    void (async () => {
      const listings = await store.listMarket(80);
      const listing = listings.find((entry) => entry.id === id);
      if (!listing) return this.fail(client, "That listing is gone.");
      if (listing.sellerId === profile.id) return this.fail(client, "That is your own listing.");
      if (profile.inventory.length >= profile.inventorySlots) return this.fail(client, "Your creel is full.");
      if (profile.coins < listing.price) return this.fail(client, "Not enough coins.");
      const taken = await store.takeMarketListing(id);
      if (!taken) return this.fail(client, "Someone bought it first.");
      profile.coins -= taken.price;
      profile.inventory.push({
        uid: randomUUID(),
        speciesId: taken.speciesId,
        weight: taken.weight,
        length: taken.length,
        value: taken.value,
        caughtAt: Date.now(),
        location: this.location,
        perfect: false,
        mutation: taken.mutation as FishMutation,
      });
      await this.creditOfflineSeller(taken.sellerId, taken.price);
      profile.updatedAt = Date.now();
      await store.saveProfile(profile);
      this.sendProfile(client);
      await this.sendMarket(client);
      client.send("purchase", { message: `Bought ${getFish(taken.speciesId).name} for ${taken.price} coins.` });
    })();
  }

  private handleMarketCancel(client: Client, data: Record<string, unknown>): void {
    const profile = this.profiles.get(client.sessionId);
    if (!profile) return;
    const id = String(data.id ?? "");
    void (async () => {
      if (profile.inventory.length >= profile.inventorySlots) return this.fail(client, "Make room in your creel first.");
      const removed = await store.cancelMarketListing(id, profile.id);
      if (!removed) return this.fail(client, "That listing is not yours.");
      profile.inventory.push({
        uid: randomUUID(),
        speciesId: removed.speciesId,
        weight: removed.weight,
        length: removed.length,
        value: removed.value,
        caughtAt: Date.now(),
        location: this.location,
        perfect: false,
        mutation: removed.mutation as FishMutation,
      });
      profile.updatedAt = Date.now();
      await store.saveProfile(profile);
      this.sendProfile(client);
      await this.sendMarket(client);
    })();
  }

  private async creditOfflineSeller(sellerId: string, amount: number): Promise<void> {
    const online = [...this.profiles.values()].find((entry) => entry.id === sellerId);
    if (online) {
      online.coins += amount;
      online.updatedAt = Date.now();
      await store.saveProfile(online);
      return;
    }
    const seller = await store.loadProfile(sellerId);
    if (!seller) return;
    seller.coins += amount;
    seller.updatedAt = Date.now();
    await store.saveProfile(seller);
  }

  // ── Trading ───────────────────────────────────────────────────────────────
  private tradeView(trade: TradeState): TradeView {
    const fromProfile = this.profiles.get(trade.fromSession);
    const toProfile = this.profiles.get(trade.toSession);
    const offer = (profile: PlayerProfile | undefined, uids: string[], coins: number) => ({
      fish: uids
        .map((uid) => profile?.inventory.find((fish) => fish.uid === uid))
        .filter((fish): fish is FishInstance => !!fish)
        .map((fish) => ({
          uid: fish.uid,
          speciesId: fish.speciesId,
          mutation: fish.mutation ?? ("normal" as FishMutation),
          weight: fish.weight,
          value: fish.value,
        })),
      coins,
    });
    return {
      id: trade.id,
      from: fromProfile?.username ?? "Angler",
      to: toProfile?.username ?? "Angler",
      fromOffer: offer(fromProfile, trade.fromOffer.uids, trade.fromOffer.coins),
      toOffer: offer(toProfile, trade.toOffer.uids, trade.toOffer.coins),
      status: trade.status,
    };
  }

  private sendTradeTo(trade: TradeState): void {
    const view = this.tradeView(trade);
    for (const sessionId of [trade.fromSession, trade.toSession]) {
      this.clients.find((client) => client.sessionId === sessionId)?.send("trade", view);
    }
  }

  private handleTradeRequest(client: Client, data: Record<string, unknown>): void {
    const profile = this.profiles.get(client.sessionId);
    if (!profile) return;
    const target = this.clients.find(
      (candidate) =>
        candidate.sessionId === String(data.sessionId ?? "") ||
        this.profiles.get(candidate.sessionId)?.username === String(data.username ?? ""),
    );
    if (!target || target.sessionId === client.sessionId) return this.fail(client, "That angler is not here.");
    for (const trade of this.trades.values()) {
      if (trade.fromSession === client.sessionId || trade.toSession === client.sessionId) {
        return this.fail(client, "Finish your current trade first.");
      }
    }
    const trade: TradeState = {
      id: randomUUID(),
      fromSession: client.sessionId,
      toSession: target.sessionId,
      fromOffer: { uids: [], coins: 0 },
      toOffer: { uids: [], coins: 0 },
      status: "pending",
      createdAt: Date.now(),
    };
    this.trades.set(trade.id, trade);
    this.sendTradeTo(trade);
  }

  private handleTradeOffer(client: Client, data: Record<string, unknown>): void {
    const trade = this.trades.get(String(data.tradeId ?? ""));
    if (!trade) return;
    if (trade.fromSession !== client.sessionId && trade.toSession !== client.sessionId) return;
    const profile = this.profiles.get(client.sessionId);
    if (!profile) return;
    const side = trade.fromSession === client.sessionId ? trade.fromOffer : trade.toOffer;
    const uids = Array.isArray(data.uids) ? data.uids.map(String).slice(0, 8) : [];
    side.uids = uids.filter((uid) => profile.inventory.some((fish) => fish.uid === uid));
    side.coins = Math.round(safeNumber(data.coins, 0, 0, profile.coins));
    trade.status = "open";
    this.sendTradeTo(trade);
  }

  private handleTradeAccept(client: Client, data: Record<string, unknown>): void {
    const trade = this.trades.get(String(data.tradeId ?? ""));
    if (!trade) return;
    if (trade.fromSession !== client.sessionId && trade.toSession !== client.sessionId) return;
    const fromProfile = this.profiles.get(trade.fromSession);
    const toProfile = this.profiles.get(trade.toSession);
    if (!fromProfile || !toProfile) return this.fail(client, "The other angler is offline.");
    if (fromProfile.coins < trade.fromOffer.coins || toProfile.coins < trade.toOffer.coins) {
      return this.fail(client, "Not enough coins to complete the trade.");
    }
    const fromFish = fromProfile.inventory.filter((fish) => trade.fromOffer.uids.includes(fish.uid));
    const toFish = toProfile.inventory.filter((fish) => trade.toOffer.uids.includes(fish.uid));
    if (fromFish.length !== trade.fromOffer.uids.length || toFish.length !== trade.toOffer.uids.length) {
      return this.fail(client, "One of the offered fish is no longer available.");
    }
    if (
      fromProfile.inventory.length - fromFish.length + toFish.length > fromProfile.inventorySlots ||
      toProfile.inventory.length - toFish.length + fromFish.length > toProfile.inventorySlots
    ) {
      return this.fail(client, "One creel is too full for this trade.");
    }
    fromProfile.inventory = fromProfile.inventory.filter((fish) => !trade.fromOffer.uids.includes(fish.uid));
    toProfile.inventory = toProfile.inventory.filter((fish) => !trade.toOffer.uids.includes(fish.uid));
    fromProfile.inventory.push(...toFish);
    toProfile.inventory.push(...fromFish);
    fromProfile.coins -= trade.fromOffer.coins;
    toProfile.coins += trade.fromOffer.coins;
    toProfile.coins -= trade.toOffer.coins;
    fromProfile.coins += trade.toOffer.coins;
    trade.status = "accepted";
    this.trades.delete(trade.id);
    for (const [profile, sessionId] of [
      [fromProfile, trade.fromSession],
      [toProfile, trade.toSession],
    ] as Array<[PlayerProfile, string]>) {
      profile.updatedAt = Date.now();
      void store.saveProfile(profile);
      const tradeClient = this.clients.find((candidate) => candidate.sessionId === sessionId);
      tradeClient?.send("tradeEnd", { tradeId: trade.id, reason: "Trade complete!", accepted: true });
      if (tradeClient) this.sendProfile(tradeClient);
    }
  }

  private handleTradeCancel(client: Client, data: Record<string, unknown>): void {
    const trade = this.trades.get(String(data.tradeId ?? ""));
    if (!trade) return;
    if (trade.fromSession !== client.sessionId && trade.toSession !== client.sessionId) return;
    this.trades.delete(trade.id);
    for (const sessionId of [trade.fromSession, trade.toSession]) {
      this.clients
        .find((candidate) => candidate.sessionId === sessionId)
        ?.send("tradeEnd", { tradeId: trade.id, reason: "Trade cancelled.", accepted: false });
    }
  }

  // ── Progression & secret quests ───────────────────────────────────────────
  private handleClaimWeekly(client: Client, data: Record<string, unknown>): void {
    const profile = this.profiles.get(client.sessionId);
    if (!profile) return;
    ensureWeekly(profile);
    const quest = profile.weekly.quests.find((entry) => entry.id === String(data.questId ?? ""));
    if (!quest) return;
    if (quest.claimed) return this.fail(client, "Already claimed.");
    if (quest.progress < quest.target) return this.fail(client, "Weekly quest not complete yet.");
    quest.claimed = true;
    profile.coins += quest.rewardCoins;
    addXp(profile, quest.rewardXp);
    profile.updatedAt = Date.now();
    void store.saveProfile(profile);
    this.sendProfile(client);
    client.send("questClaimed", { questId: quest.id, coins: quest.rewardCoins, xp: quest.rewardXp });
  }

  private handleSecretAccept(client: Client, data: Record<string, unknown>): void {
    const profile = this.profiles.get(client.sessionId);
    if (!profile) return;
    const def = SECRET_QUESTS.find((entry) => entry.id === String(data.id ?? ""));
    if (!def) return;
    if (profile.secretQuests.some((entry) => entry.id === def.id)) return this.fail(client, "Already accepted.");
    profile.secretQuests.push({ id: def.id, progress: 0, claimed: false });
    profile.updatedAt = Date.now();
    void store.saveProfile(profile);
    this.sendProfile(client);
    client.send("system", { text: `Secret quest accepted: ${def.title}.` });
  }

  private handleSecretClaim(client: Client, data: Record<string, unknown>): void {
    const profile = this.profiles.get(client.sessionId);
    if (!profile) return;
    const def = SECRET_QUESTS.find((entry) => entry.id === String(data.id ?? ""));
    const progress = profile.secretQuests.find((entry) => entry.id === String(data.id ?? ""));
    if (!def || !progress) return;
    if (progress.claimed) return this.fail(client, "Already claimed.");
    if (progress.progress < def.target) return this.fail(client, "The hermit is not satisfied yet.");
    progress.claimed = true;
    profile.coins += def.rewardCoins;
    addXp(profile, def.rewardXp);
    if (def.rewardCosmetic && !profile.cosmetics.includes(def.rewardCosmetic)) {
      profile.cosmetics.push(def.rewardCosmetic);
    }
    profile.updatedAt = Date.now();
    void store.saveProfile(profile);
    this.sendProfile(client);
    client.send("secretClaimed", {
      id: def.id,
      title: def.title,
      coins: def.rewardCoins,
      xp: def.rewardXp,
      cosmetic: def.rewardCosmetic,
    });
  }

  private awardGuild(profile: PlayerProfile, amount: number): void {
    if (!profile.guildId || amount <= 0) return;
    const xp = Math.max(1, Math.round(amount));
    void store.addGuildXp(profile.guildId, xp);
    void store.addGuildContribution(profile.id, xp);
  }

  private advanceSecretQuests(profile: PlayerProfile, kind: "mutation" | "treasure", amount: number): void {
    for (const progress of profile.secretQuests) {
      if (progress.claimed) continue;
      const def = SECRET_QUESTS.find((entry) => entry.id === progress.id);
      if (!def) continue;
      if (kind === "mutation" && def.id !== "hermit-mutations") continue;
      if (kind === "treasure" && def.id !== "hermit-treasures") continue;
      progress.progress = Math.min(def.target, progress.progress + amount);
    }
  }

  private handleCookFeast(client: Client): void {
    const profile = this.profiles.get(client.sessionId);
    const player = this.state.players.get(client.sessionId);
    if (!profile || !player) return;
    if (player.fishingState !== "idle") return this.fail(client, "Reel in your line first.");
    if (!nearestCampfire(this.map, player.x, player.y, 96)) return this.fail(client, "Stand beside a campfire for a feast.");
    const raw = profile.inventory.filter((fish) => !fish.cooked).slice(0, 5);
    if (!raw.length) return this.fail(client, "No raw fish to cook.");
    let energy = 0;
    for (const fish of raw) {
      const species = getFish(fish.speciesId);
      const recipe = recipeForRarity(species.rarity);
      fish.cooked = true;
      fish.cookedName = recipe.name;
      fish.energy = recipe.energy;
      fish.cookedAt = Date.now();
      fish.value = cookedFishValue(fish.value, species.rarity);
      energy += recipe.energy;
    }
    profile.energy = Math.min(profile.maxEnergy, profile.energy + Math.round(energy * 0.35));
    player.energy = Math.round(profile.energy);
    player.activity = "cooking";
    this.clock.setTimeout(() => {
      const live = this.state.players.get(client.sessionId);
      if (live) live.activity = "idle";
    }, 2200);
    const nearby = [...this.state.players.values()].filter(
      (other) => other.id !== player.id && Math.hypot(other.x - player.x, other.y - player.y) < 150,
    );
    this.startParty(player, nearby.length + 1);
    addXp(profile, 45);
    profile.updatedAt = Date.now();
    void store.saveProfile(profile);
    this.sendProfile(client);
    this.broadcast("feast", {
      username: profile.username,
      count: raw.length,
      guests: nearby.length,
      x: Math.round(player.x),
      y: Math.round(player.y),
    });
  }

  private sendProfile(client: Client): void {
    const profile = this.profiles.get(client.sessionId);
    if (!profile) return;
    client.send("profile", profile);
    const player = this.state.players.get(client.sessionId);
    if (player) {
      player.level = profile.level;
      player.rod = profile.equippedRod;
      player.appearance = JSON.stringify(profile.appearance);
      player.energy = Math.round(profile.energy);
    }
  }

  private fail(client: Client, message: string): void {
    client.send("error", { message });
  }

  private changeWeather(): void {
    if (this.eventDef?.weather) return;
    const bias = LOCATIONS_BY_ID[this.location].weatherBias;
    const options = ["sunny", "cloudy", "rainy", "stormy", "foggy"];
    const weather = Math.random() < 0.6
      ? bias[Math.floor(Math.random() * bias.length)]
      : options[Math.floor(Math.random() * options.length)];
    this.state.weather = weather;
    this.broadcast("weather", { weather });
    this.broadcast("system", { text: `The weather shifts to ${weather}.` });
  }

  private broadcastPresence(): void {
    this.broadcast("presenceList", {
      count: this.clients.length,
      players: [...this.state.players.values()].map((p) => p.username),
    });
  }
}
