import type {
  Appearance,
  ChatMessage,
  CreatureView,
  FishSpecies,
  FishMutation,
  GuildView,
  HouseVisitView,
  LeaderboardRow,
  LocationId,
  MarketListing,
  MinigameState,
  PlayerProfile,
  PublicRoom,
  TournamentView,
  TradeView,
  TreasureView,
  WorldEventView,
} from "@shared/types";
import { FISH, RARITY_META, RARITY_ORDER, RARITY_RANK, getFish } from "@shared/fish";
import {
  BAITS,
  BAITS_BY_ID,
  BOAT,
  COSMETICS,
  COSMETICS_BY_ID,
  LOCATIONS,
  LOCATIONS_BY_ID,
  RODS,
  RODS_BY_ID,
  locationUnlocked,
  recipeForRarity,
} from "@shared/items";
import { xpForLevel, xpToNextLevel } from "@shared/quests";
import {
  AQUARIUM_THEMES,
  BOAT_PAINTS,
  COOKING_BUFFS,
  EQUIPMENT,
  FURNITURE,
  FURNITURE_BY_ID,
  HOUSE_THEMES,
  MATERIALS,
  MATERIALS_BY_ID,
  MUTATION_META,
  MUTATION_ORDER,
  SECRET_QUESTS,
  SEASON_LABEL,
  WORLD_EVENTS_BY_ID,
  currentSeason,
  masteryProgress,
} from "@shared/expansion";
import type { NPCDef } from "@shared/world";
import { bus } from "../core/bus";
import type { NetState, NetworkManager } from "../core/network";
import type { AudioManager } from "../core/audio";
import { fetchLeaderboard, fetchRooms } from "../core/api";
import { appStore } from "../core/store";
import { renderFishCanvas } from "../game/art/fish";
import { renderCharacterCanvas } from "../game/art/characters";

type PanelName =
  | "inventory"
  | "collection"
  | "shop"
  | "quests"
  | "map"
  | "tournament"
  | "leaderboard"
  | "settings"
  | "npc"
  | "cook"
  | "fish-detail"
  | "voyage"
  | "island"
  | "social"
  | "events";

type InvTab = "fish" | "rods" | "baits";
type ShopTab = "rods" | "baits" | "clothing" | "boat" | "gear" | "paints";
type LeaderboardType = "biggest" | "rarest" | "value" | "level" | "perfect" | "mutations" | "creatures" | "mastery";
type LeaderboardPeriod = "daily" | "weekly" | "all";
type SocialTab = "friends" | "guild" | "market" | "trade";

const WEATHER_ICON: Record<string, string> = {
  sunny: "☀",
  cloudy: "☁",
  rainy: "☂",
  stormy: "⚡",
  foggy: "≈",
};

const EMOTE_LABEL: Record<string, string> = {
  wave: "waves hello",
  dance: "dances a little jig",
  heart: "sends a heart",
  laugh: "laughs",
  fish: "shows off a fish",
  sit: "sits by the water",
  party: "starts a beach party",
  sleep: "dozes off",
};

const SKIN_SWATCHES = ["#f2c8a0", "#d99a6c", "#a96b4a", "#7a4a33", "#f6d7b8", "#c9895f"];
const HAIR_SWATCHES = ["#2f2a2a", "#6b432a", "#d8b26a", "#b45b3e", "#e8e1cf", "#4c3a72", "#8a3b52"];
const SHIRT_SWATCHES = ["#e66b5a", "#4d8fc9", "#58a77a", "#d8a04a", "#8b6ac9", "#e6e1d3", "#c95a8a"];
const PANTS_SWATCHES = ["#3d4f66", "#5b4636", "#425c42", "#6b3d4f", "#34363f", "#7a6a4e"];

function $(id: string): HTMLElement {
  return document.getElementById(id)!;
}

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

function timeLabel(minutes: number): string {
  const total = ((Math.floor(minutes) % 1440) + 1440) % 1440;
  const h = Math.floor(total / 60);
  const m = total % 60;
  const suffix = h >= 12 ? "PM" : "AM";
  const hh = h % 12 || 12;
  return `${String(hh).padStart(2, "0")}:${String(m).padStart(2, "0")} ${suffix}`;
}

function rarityStyle(rarity: string): string {
  return `--rarity:${RARITY_META[rarity as keyof typeof RARITY_META]?.color ?? "#b9c4b1"}`;
}

function countdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function phaseLabel(phase: string): string {
  switch (phase) {
    case "active": return "IN PROGRESS";
    case "results": return "RESULTS";
    case "starting": return "STARTING";
    default: return "NEXT TOURNAMENT";
  }
}

function statPill(label: string, value: string): string {
  return `<span class="stat-pill">${esc(label)} ${esc(value)}</span>`;
}

export class UIManager {
  private profile: PlayerProfile | null = null;
  private state: NetState | null = null;
  private environment: any = null;
  private tournamentView: TournamentView | null = null;
  private openPanelName: PanelName | null = null;
  private panelScroll = 0;
  private invTab: InvTab = "fish";
  private shopTab: ShopTab = "rods";
  private shopTitle = "Village Shops";
  private collectionSearch = "";
  private collectionRarity = "all";
  private collectionHabitat = "all";
  private selectedFish: string | null = null;
  private npc: NPCDef | null = null;
  private currentNpc: NPCDef | null = null;
  private roomId = "";
  private rooms: PublicRoom[] | null = null;
  private roomsLoading = false;
  private leaderboardType: LeaderboardType = "biggest";
  private leaderboardPeriod: LeaderboardPeriod = "weekly";
  private leaderboardRows: LeaderboardRow[] | null = null;
  private leaderboardLoading = false;
  private appearanceDraft: Appearance | null = null;
  private minigameActive = false;
  private mgState: MinigameState | null = null;
  private mgZoneDisplay = 0.5;
  private mgFishDisplay = 0.5;
  private mgLastFrame = 0;
  private mgRaf = 0;
  private biteTimeout = 0;
  private chatOpen = false;
  private chatLocal = false;
  private lastHud = 0;
  private tournamentTimer = 0;
  private mobileTouch = false;
  private campfireNear = false;
  private sprintOn = false;
  private revealTimeout = 0;
  private fireTimer = 0;
  private lastFishingState = "";
  private catchHistory: Array<{ speciesId: string; weight: number; length: number; value: number; location: LocationId; at: number; rarity: string; perfect: boolean; isNew: boolean; mutation?: FishMutation }> = [];
  private eventView: WorldEventView | null = null;
  private eventNextAt = 0;
  private creatureView: CreatureView | null = null;
  private treasures: TreasureView[] = [];
  private socialTab: SocialTab = "friends";
  private friends: Array<{ id: string; username: string; addedAt: number; online: boolean }> = [];
  private guild: GuildView | null = null;
  private guildList: Array<{ id: string; name: string; tag: string; description: string; ownerId: string; xp: number; createdAt: number; members: number }> = [];
  private market: MarketListing[] = [];
  private trade: TradeView | null = null;
  private tradeUids: string[] = [];
  private tradeCoins = 0;
  private houseVisit: HouseVisitView | null = null;
  private furnishing = false;
  private selectedFurniture = "driftwood-bench";
  private marketUid = "";
  private marketPrice = 100;
  private partyActive = false;
  private partyCount = 0;
  private emoteCooldown = 0;
  private eventTimer = 0;

  constructor(
    private network: NetworkManager,
    private audio: AudioManager,
  ) {
    this.mobileTouch = window.matchMedia("(pointer: coarse)").matches || (navigator.maxTouchPoints ?? 0) > 0;
    try {
      const stored = localStorage.getItem("pixel-tides-catch-history");
      if (stored) this.catchHistory = JSON.parse(stored);
    } catch {
      this.catchHistory = [];
    }
    this.bindStatic();
    this.bindBus();
    this.bindPanelDelegation();
    this.bindJoystick();
    this.tournamentTimer = window.setInterval(() => this.tickTournament(), 1000);
    this.eventTimer = window.setInterval(() => this.tickEvent(), 1000);
  }

  private bindStatic(): void {
    for (const btn of document.querySelectorAll<HTMLElement>("[data-panel]")) {
      btn.addEventListener("click", () => {
        this.audio.play("click");
        this.togglePanel(btn.dataset.panel as PanelName);
      });
    }
    $("panel-close").addEventListener("click", () => this.closePanel());
    $("panel-backdrop").addEventListener("click", () => this.closePanel());
    $("btn-settings").addEventListener("click", () => this.togglePanel("settings"));
    $("btn-chat").addEventListener("click", () => this.toggleChat());
    $("chat-close").addEventListener("click", () => this.toggleChat(false));
    $("chat-mode").addEventListener("click", () => {
      this.chatLocal = !this.chatLocal;
      $("chat-mode").textContent = this.chatLocal ? "LOCAL" : "NEAR";
      $("chat-mode").classList.toggle("is-on", this.chatLocal);
      this.toast(this.chatLocal ? "Chat is now proximity-based." : "Chat is now village-wide.", "");
    });
    $("chat-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const input = $("chat-input") as HTMLInputElement;
      const text = input.value.trim();
      if (!text) return;
      this.network.send("chat", { text, local: this.chatLocal });
      input.value = "";
    });
    $("npc-prompt-btn").addEventListener("click", () => {
      if (this.currentNpc) this.openNpc(this.currentNpc);
    });
    $("mobile-cast").addEventListener("click", () => {
      this.audio.play("click");
      bus.emit("castRequest");
    });
    $("mobile-interact").addEventListener("click", () => {
      bus.emit("interactRequest");
    });
    const reel = $("mobile-reel");
    const startReel = (event: Event) => {
      event.preventDefault();
      bus.emit("reelHold", true);
    };
    const stopReel = (event: Event) => {
      event.preventDefault();
      bus.emit("reelHold", false);
    };
    reel.addEventListener("pointerdown", startReel);
    reel.addEventListener("pointerup", stopReel);
    reel.addEventListener("pointercancel", stopReel);
    reel.addEventListener("pointerleave", stopReel);

    $("mobile-bag").addEventListener("click", () => {
      this.audio.play("click");
      this.togglePanel("inventory");
    });
    $("mobile-sprint").addEventListener("click", () => {
      this.audio.play("click");
      bus.emit("sprintToggle");
    });
    $("mobile-eat").addEventListener("click", () => {
      this.audio.play("click");
      this.network.eatBest();
    });
    $("mobile-sail").addEventListener("click", () => {
      this.audio.play("click");
      this.network.toggleSail();
    });
    $("mobile-dive").addEventListener("click", () => {
      this.audio.play("click");
      this.network.toggleDive();
    });
    $("mobile-emote").addEventListener("click", () => {
      this.audio.play("click");
      const now = performance.now();
      if (now - this.emoteCooldown < 1600) return;
      this.emoteCooldown = now;
      const options = ["wave", "dance", "heart", "fish", "party"];
      this.network.emote(options[Math.floor(Math.random() * options.length)]);
    });
    $("campfire-prompt-btn").addEventListener("click", () => {
      this.openPanel("cook");
    });
    $("treasure-prompt-btn").addEventListener("click", () => {
      bus.emit("interactRequest");
    });
    $("reveal-close").addEventListener("click", () => this.hideCatchReveal());
    $("catch-reveal").addEventListener("click", (event) => {
      if (event.target === $("catch-reveal")) this.hideCatchReveal();
    });

    document.addEventListener("click", (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>("[data-action]");
      if (!target) return;
      const action = target.dataset.action;
      if (action === "join-creature") {
        this.network.joinCreature();
        this.audio.play("click");
      } else if (action === "strike-creature") {
        this.network.strikeCreature();
        this.audio.play("click");
      } else if (action === "collect-treasure") {
        this.network.collectTreasure(target.dataset.id!);
        this.audio.play("click");
      } else if (action === "emote") {
        this.network.emote(target.dataset.emote!);
        this.audio.play("click");
      }
    });

    window.addEventListener("keydown", (event) => {
      const target = event.target as HTMLElement;
      const typing = target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      if (event.key === "Escape") {
        if (this.openPanelName) {
          event.preventDefault();
          this.closePanel();
        }
        return;
      }
      if (typing) return;
      const key = event.key.toLowerCase();
      if (key === "i") { event.preventDefault(); this.togglePanel("inventory"); }
      else if (key === "f") { event.preventDefault(); this.togglePanel("collection"); }
      else if (key === "q") { event.preventDefault(); this.togglePanel("quests"); }
      else if (key === "m") { event.preventDefault(); this.togglePanel("map"); }
      else if (key === "t") { event.preventDefault(); this.toggleChat(); }
      else if (key === "r") { event.preventDefault(); this.togglePanel("leaderboard"); }
      else if (key === "v") { event.preventDefault(); this.togglePanel("voyage"); }
      else if (key === "h") { event.preventDefault(); this.togglePanel("island"); }
      else if (key === "g") { event.preventDefault(); this.togglePanel("social"); }
      else if (key === "n") { event.preventDefault(); this.togglePanel("events"); }
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) bus.emit("reelHold", false);
    });
  }

  private bindBus(): void {
    bus.on("connected", (data) => {
      this.roomId = data.roomId;
      $("connection-banner").classList.add("is-hidden");
    });
    bus.on("state", (state: NetState) => this.onState(state));
    bus.on("profile", (profile: PlayerProfile) => this.setProfile(profile));
    bus.on("environment", (environment) => this.onEnvironment(environment));
    bus.on("chat", (message: ChatMessage) => this.addChat(message));
    bus.on("system", (message: { text: string }) => {
      this.addChat({ id: String(Date.now()), username: "Tide", text: message.text, at: Date.now(), system: true });
    });
    bus.on("presence", (presence: { type: string; username: string }) => {
      this.addChat({
        id: String(Date.now() + Math.random()),
        username: "Tide",
        text: `${presence.username} ${presence.type === "join" ? "arrived at the water" : "left the water"}.`,
        at: Date.now(),
        system: true,
      });
    });
    bus.on("presenceList", (presence: { count: number }) => {
      const el = $("hud-players");
      if (el) el.textContent = String(presence.count);
    });
    const playersWrap = $("hud-players")?.parentElement;
    if (playersWrap) {
      playersWrap.style.cursor = "pointer";
      playersWrap.title = "Anglers in this room · Click to open room browser";
      playersWrap.addEventListener("click", () => this.openPanel("map"));
    }
    bus.on("catch", (event: any) => this.addCatchFeed(event));
    bus.on("sale", (event: any) => this.addSaleFeed(event));
    bus.on("error", (event: { message: string }) => {
      this.toast(event.message, "error");
      this.audio.play("error");
    });
    bus.on("purchase", (event: { message: string }) => {
      this.toast(event.message, "gold");
      this.audio.play("buy");
    });
    bus.on("sold", (event: { count: number; coins: number }) => {
      this.toast(`Sold ${event.count} fish for ${fmt(event.coins)} coins.`, "gold");
      this.audio.play("coin");
    });
    bus.on("questClaimed", (event: { coins: number; xp: number }) => {
      this.toast(`Quest complete! +${fmt(event.coins)} coins, +${fmt(event.xp)} XP.`, "gold");
      this.audio.play("buy");
    });
    bus.on("achievement", (achievement: { title: string }) => {
      this.toast(`Achievement unlocked: ${achievement.title}`, "gold");
      this.audio.play("perfect");
    });
    bus.on("achievementClaimed", (event: { coins: number }) => {
      this.toast(`Achievement reward: +${fmt(event.coins)} coins.`, "gold");
      this.audio.play("coin");
    });
    bus.on("levelUp", (event: { level: number }) => {
      this.toast(`Level ${event.level} reached! New waters may await.`, "gold");
      this.audio.play("levelup");
    });
    bus.on("fishing", (event: { phase: string; message?: string }) => this.onFishing(event));
    bus.on("bite", () => this.onBite());
    bus.on("minigameStart", (event: any) => this.onMinigameStart(event));
    bus.on("mg", (state: MinigameState) => this.onMinigameState(state));
    bus.on("minigameEnd", (event: any) => this.onMinigameEnd(event));
    bus.on("tournament", (view: TournamentView) => {
      this.tournamentView = view;
      if (this.openPanelName === "tournament") this.renderPanel(true);
    });
    bus.on("tournamentResult", (event: any) => {
      this.toast(
        event.place
          ? `Tournament finished — place #${event.place}! +${fmt(event.coins)} coins, +${fmt(event.xp)} XP.`
          : "Tournament finished.",
        "gold",
      );
      this.audio.play(event.place <= 3 ? "perfect" : "coin");
    });
    bus.on("weather", (event: { weather: string }) => {
      this.toast(`Weather: ${event.weather}`, "gold");
    });
    bus.on("treasureNear", () => {
      $("treasure-prompt").classList.remove("is-hidden");
    });
    bus.on("treasureLeave", () => {
      $("treasure-prompt").classList.add("is-hidden");
    });
    bus.on("campfireNear", () => {
      this.campfireNear = true;
      $("campfire-prompt").classList.remove("is-hidden");
      if (!this.fireTimer) {
        this.fireTimer = window.setInterval(() => this.audio.play("fire"), 1400);
      }
    });
    bus.on("campfireLeave", () => {
      this.campfireNear = false;
      $("campfire-prompt").classList.add("is-hidden");
      window.clearInterval(this.fireTimer);
      this.fireTimer = 0;
    });
    bus.on("openCook", () => this.openPanel("cook"));
    bus.on("cooked", (event: any) => {
      this.toast(`${event.name} cooked! +${event.energy} energy when eaten.`, "gold");
      this.audio.play("cook");
      if (this.openPanelName === "cook" || this.openPanelName === "inventory") this.renderPanel(true);
    });
    bus.on("ate", (event: any) => {
      this.toast(`Ate ${event.name}. +${event.energy} energy.`, "gold");
      this.audio.play("eat");
      if (this.openPanelName === "inventory" || this.openPanelName === "cook") this.renderPanel(true);
    });
    bus.on("events", (event: any) => {
      this.eventView = event.active ?? null;
      this.eventNextAt = Number(event.nextAt ?? 0);
      this.creatureView = event.creatureActive ? this.creatureView : this.creatureView;
      this.updateEventBanner();
    });
    bus.on("event", (view: WorldEventView) => {
      this.eventView = view;
      this.eventNextAt = view.endsAt;
      this.updateEventBanner();
      this.toast(`${view.icon} ${view.name}: ${view.description}`, "gold");
      this.audio.play("levelup");
    });
    bus.on("eventEnd", () => {
      this.eventView = null;
      this.updateEventBanner();
    });
    bus.on("eventReward", (event: any) => {
      this.toast(`${event.name} ended — +${fmt(event.coins)} coins, +${fmt(event.xp)} XP for your part.`, "gold");
      this.audio.play("coin");
    });
    bus.on("creature", (event: any) => {
      this.creatureView = event.active ? event.creature : null;
      this.updateCreatureBanner();
    });
    bus.on("creatureHit", (event: any) => {
      if (!this.creatureView) return;
      this.creatureView.hp = event.hp;
      this.creatureView.contribution = event.contribution;
      this.updateCreatureBanner();
      this.toast(`${event.critical ? "CRITICAL! " : ""}${fmt(event.damage)} damage to ${this.creatureView.name}.`, event.critical ? "gold" : "");
      this.audio.play(event.critical ? "perfect" : "hook");
    });
    bus.on("creatureResult", (event: any) => {
      this.creatureView = null;
      this.updateCreatureBanner();
      this.toast(
        `${event.name} ${event.killed ? "defeated" : "escaped"}. +${fmt(event.coins)} coins, +${fmt(event.xp)} XP${event.drop ? ` · ${MATERIALS_BY_ID[event.drop]?.name ?? event.drop}` : ""}.`,
        "gold",
      );
      this.audio.play(event.killed ? "legendary" : "coin");
    });
    bus.on("treasures", (event: any) => {
      this.treasures = Array.isArray(event.items) ? event.items : [];
    });
    bus.on("treasure", (event: any) => {
      if (event.type === "spawn" && event.treasure) this.treasures = [...this.treasures, event.treasure];
      if (event.type === "remove") this.treasures = this.treasures.filter((treasure) => treasure.id !== event.id);
    });
    bus.on("treasureCollected", (event: any) => {
      this.toast(`Recovered ${event.name}! +${fmt(event.coins)} coins, +${fmt(event.xp)} XP.`, "gold");
      this.audio.play("coin");
    });
    bus.on("sailing", (event: any) => {
      this.toast(event.sailing ? "You set sail. The open water is yours." : "You moored the skiff.", "gold");
    });
    bus.on("aboard", (event: any) => {
      this.toast(event.captain ? `You climbed aboard ${event.captain}'s skiff.` : "You stepped off the boat.", "gold");
    });
    bus.on("diving", (event: any) => {
      this.toast(event.diving ? "You dive beneath the surface." : "You surface for air.", "gold");
      this.audio.play("splash");
    });
    bus.on("party", (event: any) => {
      this.partyActive = !!event.active;
      this.partyCount = Number(event.count ?? 0);
      if (event.active) this.toast(`Beach party! ${event.count} anglers gathered at the campfire.`, "gold");
      const el = $("party-banner");
      if (el) {
        el.classList.toggle("is-hidden", !event.active);
        if (event.active) el.textContent = `BEACH PARTY · ${event.count} ANGLERS`;
      }
    });
    bus.on("emote", (event: any) => {
      if (this.profile && event.username !== this.profile.username) {
        this.toast(`${event.username} ${EMOTE_LABEL[event.emote] ?? "waves"}.`, "");
      }
    });
    bus.on("friends", (event: any) => {
      this.friends = Array.isArray(event.friends) ? event.friends : [];
      if (this.openPanelName === "social") this.renderPanel(true);
    });
    bus.on("guild", (event: any) => {
      this.guild = event.guild ?? null;
      this.guildList = Array.isArray(event.list) ? event.list : [];
      if (this.openPanelName === "social") this.renderPanel(true);
    });
    bus.on("guildChat", (message: ChatMessage) => {
      this.addChat({ ...message, username: `[Guild] ${message.username}` });
    });
    bus.on("market", (event: any) => {
      this.market = Array.isArray(event.listings) ? event.listings : [];
      if (this.openPanelName === "social") this.renderPanel(true);
    });
    bus.on("trade", (view: TradeView) => {
      this.trade = view;
      this.tradeUids = [];
      this.tradeCoins = 0;
      this.toast(`Trade with ${view.from === this.profile?.username ? view.to : view.from} opened.`, "gold");
      if (this.openPanelName === "social") {
        this.socialTab = "trade";
        this.renderPanel(true);
      }
    });
    bus.on("tradeEnd", (event: any) => {
      this.trade = null;
      this.tradeUids = [];
      this.toast(event.reason ?? "Trade closed.", event.accepted ? "gold" : "");
      if (this.openPanelName === "social") this.renderPanel(true);
    });
    bus.on("houseSaved", () => {
      if (this.openPanelName === "island") this.renderPanel(true);
    });
    bus.on("houseVisit", (view: HouseVisitView) => {
      this.houseVisit = view;
      if (this.openPanelName === "island") this.renderPanel(true);
      this.toast(`Visited ${view.owner}'s island.`, "gold");
    });
    bus.on("aquarium", () => {
      if (this.openPanelName === "island") this.renderPanel(true);
    });
    bus.on("aquariumFed", (event: any) => {
      this.toast(`Aquarium fed. Food: ${event.food}.`, "gold");
      this.audio.play("splash");
    });
    bus.on("feast", (event: any) => {
      this.toast(`${event.username} cooked a feast for ${event.guests} guests!`, "gold");
      this.audio.play("cook");
    });
    bus.on("secretClaimed", (event: any) => {
      this.toast(`Secret quest complete: ${event.title}. +${fmt(event.coins)} coins, +${fmt(event.xp)} XP.`, "gold");
      this.audio.play("legendary");
    });
    bus.on("fishingStatus", (event: { state: string; rod: string }) => {
      this.lastFishingState = event.state;
      const el = $("hud-fishing-status");
      if (!el) return;
      const rod = RODS_BY_ID[event.rod] ?? RODS[0];
      const labels: Record<string, string> = {
        idle: "ROD READY",
        casting: "CASTING",
        waiting: "WAITING FOR A BITE",
        bite: "BITE! HOOK NOW",
        minigame: "REELING IN",
        landed: "CATCH!",
      };
      el.textContent = `${rod.name.toUpperCase()} · ${labels[event.state] ?? event.state.toUpperCase()}`;
      el.className = `fishing-status ${event.state === "bite" ? "bite" : ["casting", "waiting", "minigame"].includes(event.state) ? "active" : ""}`;
    });
    bus.on("sprintState", (event: { sprinting: boolean }) => {
      this.sprintOn = event.sprinting;
      $("mobile-sprint").classList.toggle("is-on", this.sprintOn);
    });
    bus.on("npcNear", (npc: NPCDef) => {
      this.currentNpc = npc;
      $("npc-prompt").classList.remove("is-hidden");
    });
    bus.on("npcLeave", () => {
      this.currentNpc = null;
      $("npc-prompt").classList.add("is-hidden");
    });
    bus.on("openNpc", (npc: NPCDef) => this.openNpc(npc));
    bus.on("disconnected", () => {
      $("connection-banner").classList.remove("is-hidden");
      $("connection-banner").textContent = "Reconnecting to the tide…";
    });
    bus.on("reconnecting", () => {
      $("connection-banner").classList.remove("is-hidden");
      $("connection-banner").textContent = "Reconnecting to the tide…";
    });
    bus.on("reconnected", () => {
      $("connection-banner").classList.add("is-hidden");
      this.toast("Reconnected.", "gold");
    });
    bus.on("connectionLost", () => {
      $("connection-banner").classList.remove("is-hidden");
      $("connection-banner").textContent = "Connection lost. Refresh to return to the tide.";
    });
    bus.on("roomError", (event: { message?: string }) => {
      this.toast(event.message || "The tide room had a problem.", "error");
    });
    bus.on("reelHold", (reeling: boolean) => {
      if (this.minigameActive) this.network.setReel(reeling);
    });
  }

  showGame(profile: PlayerProfile): void {
    $("auth-screen").classList.add("is-hidden");
    $("game-shell").classList.remove("is-hidden");
    this.setProfile(profile);
    this.paintCharacterPreview();
    this.updateMobileControls();
    this.audio.setVolumes(profile.settings.music, profile.settings.sfx);
    this.audio.startAmbientBirds();
  }

  setProfile(profile: PlayerProfile): void {
    this.profile = profile;
    appStore.profile = profile;
    this.updateHud();
    this.paintCharacterPreview();
    this.updateMobileControls();
    this.audio.setVolumes(profile.settings.music, profile.settings.sfx);
    if (this.openPanelName && this.openPanelName !== "npc") this.renderPanel(true);
  }

  private onState(state: NetState): void {
    this.state = state;
    this.updateWorldVisuals(state.weather, state.timeMinutes);
    if (this.environment) {
      const location = LOCATIONS_BY_ID[this.environment.location as LocationId];
      if (location) this.audio.setEnvironment(location.ambient, state.weather as any);
    }
    const now = performance.now();
    if (now - this.lastHud > 100) {
      this.lastHud = now;
      this.updateHud();
    }
  }

  private updateWorldVisuals(weather: string, minutes: number): void {
    const weatherOverlay = $("weather-overlay");
    weatherOverlay.className = `weather-overlay ${weather}`;
    const dayOverlay = $("day-overlay");
    const m = ((minutes % 1440) + 1440) % 1440;
    let color = "rgba(5, 16, 34, 0)";
    if (m < 300) color = "rgba(4, 12, 32, 0.56)";
    else if (m < 390) color = "rgba(255, 148, 92, 0.13)";
    else if (m < 1020) color = "rgba(255, 245, 210, 0)";
    else if (m < 1140) color = "rgba(255, 126, 70, 0.2)";
    else if (m < 1260) color = "rgba(40, 44, 100, 0.3)";
    else color = "rgba(4, 12, 32, 0.56)";
    dayOverlay.style.background = color;
  }

  private onEnvironment(environment: any): void {
    this.environment = environment;
    const location = LOCATIONS_BY_ID[environment.location as LocationId];
    if (location) {
      $("hud-location").textContent = location.name;
      this.audio.setEnvironment(location.ambient, environment.weather);
      this.updateWorldVisuals(environment.weather, environment.timeMinutes);
      if (this.profile) this.profile.location = location.id;
    }
    this.updateHud();
  }

  private updateHud(): void {
    if (!this.profile) return;
    const p = this.profile;
    $("hud-level").textContent = String(p.level);
    $("hud-username").textContent = p.username;
    $("hud-coins").textContent = fmt(p.coins);
    const cur = xpForLevel(p.level);
    const next = xpForLevel(p.level + 1);
    const pct = Math.max(0, Math.min(100, ((p.xp - cur) / Math.max(1, next - cur)) * 100));
    ($("hud-xp-bar") as HTMLElement).style.width = `${pct}%`;
    $("hud-xp-text").textContent = `${fmt(Math.max(0, p.xp - cur))} / ${fmt(Math.max(1, next - cur))} XP`;

    let energy = p.energy ?? 100;
    const maxEnergy = p.maxEnergy ?? 100;
    if (this.state) {
      const own = (this.state.players as any)?.get?.(this.network.sessionId);
      if (own && typeof own.energy === "number") energy = own.energy;
    }
    const energyPct = Math.max(0, Math.min(100, (energy / Math.max(1, maxEnergy)) * 100));
    ($("hud-energy-bar") as HTMLElement).style.width = `${energyPct}%`;
    $("hud-energy-text").textContent = String(Math.round(energy));

    if (this.state) {
      let count = 0;
      (this.state.players as any).forEach?.(() => count++);
      $("hud-players").textContent = String(count || 1);
      const weather = this.state.weather;
      const minutes = this.state.timeMinutes;
      $("hud-environment").textContent = `${WEATHER_ICON[weather] ?? "☀"} ${weather[0].toUpperCase()}${weather.slice(1)} · ${timeLabel(minutes)}`;
      const location = LOCATIONS_BY_ID[this.state.location];
      if (location) $("hud-location").textContent = location.name;
    } else if (this.environment) {
      const weather = this.environment.weather;
      const minutes = this.environment.timeMinutes;
      $("hud-environment").textContent = `${WEATHER_ICON[weather] ?? "☀"} ${weather[0].toUpperCase()}${weather.slice(1)} · ${timeLabel(minutes)}`;
    }
  }

  private updateMobileControls(): void {
    const show = this.mobileTouch || !!this.profile?.settings.showJoystick;
    $("mobile-controls").classList.toggle("is-hidden", !show);
  }

  private toggleChat(force?: boolean): void {
    this.chatOpen = force ?? !this.chatOpen;
    const dock = $("chat-dock");
    dock.classList.toggle("is-collapsed", !this.chatOpen);
    if (this.chatOpen) {
      $("chat-input").focus();
      const log = $("chat-log");
      log.scrollTop = log.scrollHeight;
    }
  }

  private addChat(message: ChatMessage): void {
    const log = $("chat-log");
    const line = document.createElement("div");
    line.className = `chat-line${message.system ? " system" : ""}`;
    line.innerHTML = message.system
      ? esc(message.text)
      : `<b>${esc(message.username)}:</b> ${esc(message.text)}`;
    log.appendChild(line);
    while (log.children.length > 80) log.removeChild(log.firstChild!);
    log.scrollTop = log.scrollHeight;
  }

  toast(message: string, type = ""): void {
    const container = $("toasts");
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.textContent = message;
    container.appendChild(el);
    while (container.children.length > 4) container.removeChild(container.firstChild!);
    window.setTimeout(() => {
      el.classList.add("out");
      window.setTimeout(() => el.remove(), 260);
    }, 3800);
  }

  private addCatchFeed(event: any): void {
    const species = getFish(event.speciesId);
    const meta = RARITY_META[species.rarity];
    const mutation = (event.mutation && event.mutation !== "normal" ? MUTATION_META[event.mutation as FishMutation] : null);
    const feed = $("catch-feed");
    const el = document.createElement("div");
    el.className = "catch-toast";
    el.style.setProperty("--rarity", mutation?.color ?? meta.color);
    el.innerHTML = `<span>${event.perfect ? "★" : "◉"}</span><span><b>${esc(event.username)}</b> caught a <b>${esc(species.name)}</b> <em>${Number(event.weight).toFixed(2)} kg</em> <span class="rarity-chip ${species.rarity}">${meta.label}</span>${mutation ? ` <span class="mutation-chip" style="--variant:${mutation.color}">${mutation.label}</span>` : ""}</span>`;
    feed.appendChild(el);
    while (feed.children.length > 5) feed.removeChild(feed.firstChild!);
    window.setTimeout(() => el.remove(), 6000);
  }

  private addSaleFeed(event: any): void {
    if (!this.profile || event.username !== this.profile.username) return;
    const feed = $("catch-feed");
    const el = document.createElement("div");
    el.className = "catch-toast";
    el.style.setProperty("--rarity", "#ffd166");
    el.innerHTML = `<span>◉</span><span>Sold <b>${event.count}</b> fish for <b>${fmt(event.coins)}</b> coins</span>`;
    feed.appendChild(el);
    window.setTimeout(() => el.remove(), 5000);
  }

  private onFishing(event: { phase: string; message?: string }): void {
    if (event.phase === "casting") {
      this.audio.play("cast");
    } else if (event.phase === "waiting") {
      this.audio.play("splash");
      this.hideBite();
    } else if (event.phase === "cancelled" || event.phase === "missed") {
      if (event.message) this.toast(event.message, "error");
      this.hideBite();
      this.hideMinigame();
    }
  }

  private onBite(): void {
    this.hideMinigame();
    $("bite-prompt").classList.remove("is-hidden");
    this.audio.play("bite");
    window.clearTimeout(this.biteTimeout);
    this.biteTimeout = window.setTimeout(() => this.hideBite(), 2450);
  }

  private hideBite(): void {
    window.clearTimeout(this.biteTimeout);
    $("bite-prompt").classList.add("is-hidden");
  }

  private onMinigameStart(event: any): void {
    this.hideBite();
    const state = event.state as MinigameState;
    this.mgState = state;
    this.mgZoneDisplay = state.zonePos;
    this.mgFishDisplay = state.fishPos;
    this.minigameActive = true;
    document.body.classList.add("fishing-active");
    $("minigame").classList.remove("is-hidden");
    $("mobile-reel").classList.add("is-visible");
    $("mg-fish").textContent = event.fishName;
    const rarity = $("mg-rarity");
    rarity.textContent = RARITY_META[event.rarity as keyof typeof RARITY_META].label;
    rarity.className = `rarity-chip ${event.rarity}`;
    this.audio.play("hook");
    this.mgLastFrame = performance.now();
    cancelAnimationFrame(this.mgRaf);
    this.mgRaf = requestAnimationFrame(this.mgLoop);
  }

  private onMinigameState(state: MinigameState): void {
    this.mgState = state;
    if (!this.minigameActive) return;
    $("mg-time").textContent = `${state.timeLeft.toFixed(1)}s`;
    $("mg-percent").textContent = `${Math.round(state.progress)}%`;
    ($("mg-progress") as HTMLElement).style.width = `${state.progress}%`;
    const rarity = $("mg-rarity");
    rarity.textContent = RARITY_META[state.rarity].label;
    rarity.className = `rarity-chip ${state.rarity}`;
  }

  private mgLoop = (now: number): void => {
    if (!this.minigameActive || !this.mgState) return;
    const dt = Math.min(0.05, (now - this.mgLastFrame) / 1000);
    this.mgLastFrame = now;
    const lerp = 1 - Math.pow(0.001, dt);
    this.mgZoneDisplay += (this.mgState.zonePos - this.mgZoneDisplay) * lerp;
    this.mgFishDisplay += (this.mgState.fishPos - this.mgFishDisplay) * lerp;
    const size = this.mgState.zoneSize;
    const zone = $("mg-zone");
    zone.style.width = `${size * 100}%`;
    zone.style.left = `${(this.mgZoneDisplay - size / 2) * 100}%`;
    $("mg-fish-marker").style.left = `${this.mgFishDisplay * 100}%`;
    this.mgRaf = requestAnimationFrame(this.mgLoop);
  };

  private onMinigameEnd(event: any): void {
    this.hideMinigame();
    if (event.won) {
      this.audio.play(event.perfect ? "perfect" : "catch");
      const species = getFish(event.catch?.speciesId ?? "");
      this.toast(
        `${event.perfect ? "PERFECT! " : ""}Caught ${species.name} — ${Number(event.catch?.weight ?? 0).toFixed(2)} kg · ${fmt(event.catch?.value ?? 0)} coins${event.isNew ? " · NEW SPECIES!" : ""}`,
        "gold",
      );
      this.showCatchReveal(event);
      this.recordCatch(event);
    } else {
      this.audio.play("fail");
      if (event.reason) this.toast(event.reason, "error");
    }
  }

  private showCatchReveal(event: any): void {
    if (!event.catch) return;
    const species = getFish(event.catch.speciesId ?? "");
    const rarity = (event.catch.rarity ?? species.rarity) as keyof typeof RARITY_META;
    const meta = RARITY_META[rarity] ?? RARITY_META.common;
    const card = $("catch-reveal");
    card.className = `catch-reveal rarity-${rarity}`;
    card.style.setProperty("--rarity", meta.color);
    const mutation = event.catch.mutation && event.catch.mutation !== "normal"
      ? MUTATION_META[event.catch.mutation as FishMutation]
      : null;
    $("reveal-banner").textContent = event.isNew
      ? "NEW FISH DISCOVERED!"
      : mutation
        ? `${mutation.label.toUpperCase()} CATCH!`
        : event.perfect
          ? "PERFECT CATCH!"
          : "FISH CAUGHT!";
    $("reveal-name").textContent = mutation ? `${mutation.label} ${species.name}` : species.name;
    const badge = $("reveal-rarity");
    badge.textContent = meta.label;
    badge.className = `reveal-rarity rarity-badge ${rarity}`;
    $("reveal-weight").textContent = `${Number(event.catch.weight ?? 0).toFixed(2)} kg`;
    $("reveal-length").textContent = `${Math.round(Number(event.catch.length ?? event.fish?.length ?? 0))} cm`;
    $("reveal-value").textContent = fmt(event.catch.value ?? 0);
    $("reveal-xp").textContent = fmt(event.xp ?? 0);
    const locationId = (event.catch.location ?? event.fish?.location ?? this.profile?.location) as LocationId;
    $("reveal-where").textContent = LOCATIONS_BY_ID[locationId]?.name ?? "Unknown waters";
    const art = $("reveal-art");
    art.innerHTML = "";
    art.appendChild(renderFishCanvas(species.id, 210, 128, 1, (event.catch.mutation ?? "normal") as FishMutation));
    card.classList.remove("is-hidden");
    window.clearTimeout(this.revealTimeout);
    this.revealTimeout = window.setTimeout(() => this.hideCatchReveal(), 7000);
    if (rarity === "legendary" || rarity === "mythical" || rarity === "secret") {
      this.audio.play("legendary");
    }
  }

  private recordCatch(event: any): void {
    if (!event.catch) return;
    const species = getFish(event.catch.speciesId ?? "");
    const entry = {
      speciesId: species.id,
      weight: Number(event.catch.weight ?? 0),
      length: Number(event.catch.length ?? event.fish?.length ?? 0),
      value: Number(event.catch.value ?? 0),
      location: (event.catch.location ?? event.fish?.location ?? this.profile?.location ?? "sunny-shore") as LocationId,
      at: Date.now(),
      rarity: species.rarity,
      perfect: !!event.perfect,
      isNew: !!event.isNew,
      mutation: (event.catch.mutation ?? "normal") as FishMutation,
    };
    this.catchHistory.unshift(entry);
    this.catchHistory = this.catchHistory.slice(0, 80);
    try {
      localStorage.setItem("pixel-tides-catch-history", JSON.stringify(this.catchHistory));
    } catch {
      // Storage may be unavailable; the in-memory history still works.
    }
  }

  private hideCatchReveal(): void {
    window.clearTimeout(this.revealTimeout);
    $("catch-reveal").classList.add("is-hidden");
  }

  private hideMinigame(): void {
    this.minigameActive = false;
    this.mgState = null;
    document.body.classList.remove("fishing-active");
    cancelAnimationFrame(this.mgRaf);
    $("minigame").classList.add("is-hidden");
    $("mobile-reel").classList.remove("is-visible");
  }

  // ------------------------------------------------------------------ panels
  togglePanel(name: PanelName): void {
    if (this.openPanelName === name) this.closePanel();
    else this.openPanel(name);
  }

  openPanel(name: PanelName): void {
    this.openPanelName = name;
    if (name === "settings") this.appearanceDraft = this.profile ? { ...this.profile.appearance } : null;
    if (name === "collection") this.selectedFish = null;
    $("panel-backdrop").classList.remove("is-hidden");
    $("panel").classList.remove("is-hidden");
    bus.emit("panelOpen");
    this.renderPanel();
    if (name === "map") void this.loadRooms();
    if (name === "leaderboard") void this.loadLeaderboard();
    if (name === "tournament") this.network.send("requestTournament");
  }

  closePanel(): void {
    const wasSettings = this.openPanelName === "settings";
    this.openPanelName = null;
    $("panel-backdrop").classList.add("is-hidden");
    $("panel").classList.add("is-hidden");
    if (wasSettings) {
      this.appearanceDraft = null;
      this.paintCharacterPreview();
    }
    bus.emit("panelClose");
  }

  private renderPanel(preserveScroll = false): void {
    if (!this.openPanelName || !this.profile) return;
    const body = $("panel-body");
    if (preserveScroll) this.panelScroll = body.scrollTop;
    else this.panelScroll = 0;
    let kicker = "";
    let title = "";
    let html = "";
    switch (this.openPanelName) {
      case "inventory":
        kicker = "YOUR CREEL";
        title = "Inventory";
        html = this.renderInventory();
        break;
      case "collection":
        kicker = "FIELD NOTES";
        title = "Fish Encyclopedia";
        html = this.renderCollection();
        break;
      case "shop":
        kicker = "VILLAGE MARKET";
        title = this.shopTitle;
        html = this.renderShop();
        break;
      case "quests":
        kicker = "DAILY TIDES";
        title = "Quests & Achievements";
        html = this.renderQuests();
        break;
      case "map":
        kicker = "THE OPEN WATER";
        title = "World Map";
        html = this.renderMap();
        break;
      case "tournament":
        kicker = "COMPETITIVE TIDES";
        title = "Fishing Tournament";
        html = this.renderTournament();
        break;
      case "leaderboard":
        kicker = "NAMES IN THE TIDE";
        title = "Leaderboards";
        html = this.renderLeaderboard();
        break;
      case "settings":
        kicker = "YOUR VOYAGE";
        title = "Settings & Appearance";
        html = this.renderSettings();
        break;
      case "npc":
        kicker = this.npc?.role ?? "VILLAGER";
        title = this.npc?.name ?? "Villager";
        html = this.renderNpc();
        break;
      case "cook":
        kicker = "CAMPFIRE KITCHEN";
        title = "Cooking & Eating";
        html = this.renderCook();
        break;
      case "fish-detail":
        kicker = "ENCYCLOPEDIA ENTRY";
        title = this.selectedFish ? getFish(this.selectedFish).name : "Fish";
        html = this.renderFishDetail();
        break;
      case "voyage":
        kicker = "BOATS & DEEP WATER";
        title = "Voyage";
        html = this.renderVoyage();
        break;
      case "island":
        kicker = "YOUR HOME WATERS";
        title = "Island & Aquarium";
        html = this.renderIsland();
        break;
      case "social":
        kicker = "THE VILLAGE";
        title = "Crew & Marketplace";
        html = this.renderSocial();
        break;
      case "events":
        kicker = "THE LIVING SEA";
        title = "World Events";
        html = this.renderEvents();
        break;
    }
    $("panel-kicker").textContent = kicker;
    $("panel-title").textContent = title;
    body.innerHTML = html;
    body.scrollTop = this.panelScroll;
    this.paintThumbs();
    this.paintCharacterPreview();
  }

  private paintThumbs(): void {
    for (const el of document.querySelectorAll<HTMLElement>("[data-fish-id]")) {
      const id = el.dataset.fishId!;
      el.innerHTML = "";
      const canvas = renderFishCanvas(
        id,
        Number(el.dataset.fishWidth || 96),
        Number(el.dataset.fishHeight || 62),
        1,
        (el.dataset.fishMutation as FishMutation) || "normal",
      );
      el.appendChild(canvas);
    }
  }

  private paintCharacterPreview(): void {
    for (const el of document.querySelectorAll<HTMLElement>("[data-character]")) {
      if (!this.profile) return;
      const appearance = this.appearanceDraft ?? this.profile.appearance;
      el.innerHTML = "";
      el.appendChild(renderCharacterCanvas(appearance, Number(el.dataset.charWidth || 64), Number(el.dataset.charHeight || 96)));
    }
  }

  // ------------------------------------------------------------------ inventory
  private renderInventory(): string {
    const p = this.profile!;
    const tabs = `
      <div class="panel-tabs">
        <button class="tab-btn ${this.invTab === "fish" ? "is-active" : ""}" data-action="inv-tab" data-tab="fish">Fish · ${p.inventory.length}/${p.inventorySlots}</button>
        <button class="tab-btn ${this.invTab === "rods" ? "is-active" : ""}" data-action="inv-tab" data-tab="rods">Rods · ${p.rods.length}/${RODS.length}</button>
        <button class="tab-btn ${this.invTab === "baits" ? "is-active" : ""}" data-action="inv-tab" data-tab="baits">Bait</button>
      </div>`;
    if (this.invTab === "fish") {
      const total = p.inventory.reduce((sum, fish) => sum + fish.value, 0);
      const upgradeCost = Math.round(1100 * Math.pow(1.75, (p.inventorySlots - 24) / 8));
      const cards = [...p.inventory].sort((a, b) => b.caughtAt - a.caughtAt).map((fish) => {
        const species = getFish(fish.speciesId);
        const mutation = fish.mutation ?? "normal";
        const mutationMeta = MUTATION_META[mutation] ?? MUTATION_META.normal;
        return `<div class="inv-card ${fish.cooked ? "is-cooked" : ""}" style="${rarityStyle(species.rarity)};--variant:${mutationMeta.color}">
          <div class="fish-thumb" data-fish-id="${species.id}" data-fish-mutation="${mutation}" data-fish-width="96" data-fish-height="62"></div>
          <div class="inv-copy">
            <strong>${esc(fish.cooked ? fish.cookedName ?? "Cooked fish" : species.name)}${fish.cooked ? `<span class="cooked-tag">COOKED</span>` : ""}${mutation !== "normal" ? `<span class="mutation-chip" style="--variant:${mutationMeta.color}">${mutationMeta.label}</span>` : ""}</strong>
            <span>${fish.weight.toFixed(2)} kg · ${fish.length.toFixed(1)} cm${fish.cooked ? ` · +${fish.energy ?? 0} EN` : ""}</span>
            <span class="price">◉ ${fmt(fish.value)}</span>
          </div>
          <div class="inv-actions">
            ${fish.cooked ? `<button class="pixel-btn small" data-action="eat-fish" data-uid="${esc(fish.uid)}">Eat</button>` : ""}
            <button class="pixel-btn small ghost" data-action="sell-fish" data-uid="${esc(fish.uid)}">Sell</button>
          </div>
        </div>`;
      }).join("");
      return `${tabs}
        <div class="inv-summary">
          <span class="slots">CREEL <b>${p.inventory.length}</b> / ${p.inventorySlots} · TOTAL VALUE <b>${fmt(total)}</b></span>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${p.inventory.length ? `<button class="pixel-btn small gold" data-action="sell-all">Sell All · ◉ ${fmt(total)}</button>` : ""}
            <button class="pixel-btn small ghost" data-action="upgrade-inventory" ${p.inventorySlots >= 72 ? "disabled" : ""}>+8 Slots · ◉ ${fmt(upgradeCost)}</button>
          </div>
        </div>
        ${p.inventory.length ? `<div class="inv-grid">${cards}</div>` : `<div class="empty-state"><span class="big-icon">◉</span>Your creel is empty.<br />Cast a line from the dock and fill it with stories.</div>`}
        <div class="creel-upgrade">
          <span>Bigger creels hold more fish. Each upgrade adds 8 slots.</span>
          <button class="pixel-btn small ghost" data-action="upgrade-inventory" ${p.inventorySlots >= 72 ? "disabled" : ""}>Upgrade · ◉ ${fmt(upgradeCost)}</button>
        </div>`;
    }
    if (this.invTab === "rods") {
      const cards = RODS.map((rod) => {
        const owned = p.rods.includes(rod.id);
        const equipped = p.equippedRod === rod.id;
        return `<div class="shop-card" style="--accent:${rod.color}">
          <div class="shop-top"><h3>${esc(rod.name)}</h3>${equipped ? `<span class="owned-tag">EQUIPPED</span>` : owned ? `<span class="owned-tag">OWNED</span>` : ""}</div>
          <p>${esc(rod.description)}</p>
          <div class="shop-stats">
            ${statPill("CAST", String(rod.castDistance))}
            ${statPill("LUCK", rod.luck.toFixed(2))}
            ${statPill("ZONE", rod.zoneSize.toFixed(2))}
            ${statPill("REEL", rod.reelPower.toFixed(2))}
          </div>
          <div class="shop-buy">
            ${owned
              ? equipped ? `<span class="owned-tag">READY</span>` : `<button class="pixel-btn small" data-action="equip-rod" data-id="${rod.id}">Equip</button>`
              : `<span class="shop-price">◉ ${fmt(rod.price)}</span><button class="pixel-btn small gold" data-action="buy-rod" data-id="${rod.id}" ${p.coins < rod.price ? "disabled" : ""}>Buy</button>`}
          </div>
        </div>`;
      }).join("");
      return `${tabs}<div class="shop-grid">${cards}</div>`;
    }
    const cards = BAITS.map((bait) => {
      const count = p.baits[bait.id] ?? 0;
      const equipped = p.equippedBait === bait.id;
      return `<div class="shop-card" style="--accent:${bait.color}">
        <div class="shop-top"><h3>${esc(bait.name)}</h3>${equipped ? `<span class="owned-tag">EQUIPPED</span>` : ""}</div>
        <p>${esc(bait.description)}</p>
        <div class="shop-stats">${statPill("IN BAG", String(count))}${statPill("RARITY", `+${Math.round(bait.rarityBoost * 100)}%`)}${statPill("BITE", `+${Math.round((bait.biteSpeed - 1) * 100)}%`)}</div>
        <div class="shop-buy">
          <span class="shop-price">◉ ${fmt(bait.price)} <small>/ ${bait.bundle}</small></span>
          <div style="display:flex;gap:4px">
            ${count > 0 ? `<button class="pixel-btn small ghost" data-action="equip-bait" data-id="${bait.id}">Equip</button>` : ""}
            <button class="pixel-btn small gold" data-action="buy-bait" data-id="${bait.id}" ${p.coins < bait.price ? "disabled" : ""}>Buy</button>
          </div>
        </div>
      </div>`;
    }).join("");
    return `${tabs}<div class="shop-grid">${cards}</div>`;
  }

  // ------------------------------------------------------------------ cooking
  private renderCook(): string {
    const p = this.profile!;
    const raw = p.inventory.filter((fish) => !fish.cooked).sort((a, b) => b.value - a.value);
    const cooked = p.inventory.filter((fish) => fish.cooked).sort((a, b) => (b.cookedAt ?? 0) - (a.cookedAt ?? 0));
    let energy = Math.round(p.energy ?? 100);
    if (this.state) {
      const own = (this.state.players as any)?.get?.(this.network.sessionId);
      if (own && typeof own.energy === "number") energy = Math.round(own.energy);
    }
    const maxEnergy = Math.round(p.maxEnergy ?? 100);
    const header = `<div class="cook-header">
      <div><strong>CAMPFIRE KITCHEN</strong><span>Cook raw fish to raise their value and restore energy.</span></div>
      <div style="text-align:right"><span class="energy-big">${energy} / ${maxEnergy}</span><div style="font-size:12px;color:#8a7c53">ENERGY</div></div>
    </div>`;
    const rawCards = raw.slice(0, 48).map((fish) => {
      const species = getFish(fish.speciesId);
      const recipe = recipeForRarity(species.rarity);
      return `<div class="cook-card" style="${rarityStyle(species.rarity)}">
        <div class="fish-thumb" data-fish-id="${species.id}" data-fish-width="70" data-fish-height="46"></div>
        <div class="cook-copy">
          <strong>${esc(species.name)}</strong>
          <span>${esc(recipe.name)}</span>
          <span class="cook-energy">+${recipe.energy} energy · ◉ ${fmt(Math.round(fish.value * recipe.valueMultiplier))}</span>
          <button class="pixel-btn small gold" data-action="cook-fish" data-uid="${esc(fish.uid)}">Cook</button>
        </div>
      </div>`;
    }).join("");
    const cookedCards = cooked.slice(0, 24).map((fish) => {
      const species = getFish(fish.speciesId);
      return `<div class="cook-card" style="${rarityStyle(species.rarity)}">
        <div class="fish-thumb" data-fish-id="${species.id}" data-fish-width="70" data-fish-height="46"></div>
        <div class="cook-copy">
          <strong>${esc(fish.cookedName ?? "Cooked fish")}</strong>
          <span>${esc(species.name)} · ${fish.weight.toFixed(2)} kg</span>
          <span class="cook-energy">+${fish.energy ?? recipeForRarity(species.rarity).energy} energy · ◉ ${fmt(fish.value)}</span>
          <button class="pixel-btn small" data-action="eat-fish" data-uid="${esc(fish.uid)}">Eat</button>
        </div>
      </div>`;
    }).join("");
    return `${header}
      ${raw.length ? `<div class="section-title">RAW CATCH · ${raw.length}</div><div class="cook-grid">${rawCards}</div>` : `<div class="empty-state"><span class="big-icon">◉</span>No raw fish to cook.<br />Catch something first, then return to the fire.</div>`}
      ${cooked.length ? `<div class="section-title">READY TO EAT · ${cooked.length}</div><div class="cook-grid">${cookedCards}</div>` : ""}`;
  }

  // ------------------------------------------------------------------ collection
  private renderCollection(): string {
    const p = this.profile!;
    const discovered = Object.keys(p.collection).length;
    const recent = this.catchHistory.length
      ? this.catchHistory.slice(0, 10).map((entry) => ({
          speciesId: entry.speciesId,
          weight: entry.weight,
          value: entry.value,
          location: entry.location,
          at: entry.at,
          cooked: false,
          cookedName: undefined as string | undefined,
        }))
      : [...p.inventory]
          .sort((a, b) => b.caughtAt - a.caughtAt)
          .slice(0, 10)
          .map((fish) => ({
            speciesId: fish.speciesId,
            weight: fish.weight,
            value: fish.value,
            location: fish.location,
            at: fish.caughtAt,
            cooked: !!fish.cooked,
            cookedName: fish.cookedName,
          }));
    const history = recent.length
      ? `<div class="section-title">RECENT CATCHES</div>
        <div class="history-list">
          ${recent.map((fish) => {
            const species = getFish(fish.speciesId);
            const when = new Date(fish.at);
            return `<div class="history-row" style="${rarityStyle(species.rarity)}">
              <div class="fish-thumb" data-fish-id="${species.id}" data-fish-width="40" data-fish-height="26"></div>
              <div><b>${esc(fish.cooked ? fish.cookedName ?? species.name : species.name)}</b><small>${fish.weight.toFixed(2)} kg · ${LOCATIONS_BY_ID[fish.location]?.name ?? "Unknown"} · ${when.toLocaleDateString()} ${when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small></div>
              <span class="price">◉ ${fmt(fish.value)}</span>
            </div>`;
          }).join("")}
        </div>`
      : "";
    return `
      <div class="collection-toolbar">
        <input id="collection-search" placeholder="Search species..." value="${esc(this.collectionSearch)}" />
        <select id="rarity-filter">
          <option value="all">All rarities</option>
          ${RARITY_ORDER.map((r) => `<option value="${r}" ${this.collectionRarity === r ? "selected" : ""}>${RARITY_META[r].label}</option>`).join("")}
        </select>
        <select id="habitat-filter">
          <option value="all">All habitats</option>
          ${LOCATIONS.map((loc) => `<option value="${loc.id}" ${this.collectionHabitat === loc.id ? "selected" : ""}>${loc.name}</option>`).join("")}
        </select>
        <span class="collection-count">${discovered} / ${FISH.length} DISCOVERED</span>
      </div>
      <div id="collection-grid">${this.renderCollectionGrid()}</div>
      ${history}`;
  }

  private renderCollectionGrid(): string {
    const p = this.profile!;
    const search = this.collectionSearch.toLowerCase();
    const list = [...FISH]
      .filter((fish) => this.collectionRarity === "all" || fish.rarity === this.collectionRarity)
      .filter((fish) => this.collectionHabitat === "all" || fish.habitats.includes(this.collectionHabitat as LocationId))
      .filter((fish) => {
        if (!search) return true;
        const entry = p.collection[fish.id];
        return entry ? fish.name.toLowerCase().includes(search) : "undiscovered".includes(search);
      })
      .sort((a, b) => {
        const ad = p.collection[a.id] ? 0 : 1;
        const bd = p.collection[b.id] ? 0 : 1;
        return ad - bd || RARITY_RANK[a.rarity] - RARITY_RANK[b.rarity] || a.name.localeCompare(b.name);
      });
    if (!list.length) return `<div class="empty-state">No fish match those waters.</div>`;
    return `<div class="fish-grid">${list.map((fish) => {
      const entry = p.collection[fish.id];
      if (!entry) {
        return `<div class="fish-card undiscovered" style="${rarityStyle(fish.rarity)}">
          <span class="rarity-dot"></span>
          <div class="fish-thumb">?</div>
          <strong>???</strong>
          <small>${RARITY_META[fish.rarity].label}</small>
        </div>`;
      }
      return `<button class="fish-card" data-action="fish-detail" data-id="${fish.id}" style="${rarityStyle(fish.rarity)}">
        <span class="rarity-dot"></span><span class="discovered-mark">✓</span>
        <div class="fish-thumb" data-fish-id="${fish.id}" data-fish-mutation="${entry.bestMutation ?? "normal"}" data-fish-width="112" data-fish-height="70"></div>
        <strong>${esc(fish.name)}</strong>
        <small>×${entry.count} · ${entry.bestWeight.toFixed(1)} kg${entry.bestMutation && entry.bestMutation !== "normal" ? ` · ${MUTATION_META[entry.bestMutation].label}` : ""}</small>
      </button>`;
    }).join("")}</div>`;
  }

  private renderFishDetail(): string {
    const p = this.profile!;
    const species = getFish(this.selectedFish ?? FISH[0].id);
    const entry = p.collection[species.id];
    if (!entry) return `<div class="empty-state">This fish has not been discovered yet.</div>`;
    return `
      <button class="pixel-btn small ghost" data-action="panel-collection" style="margin-bottom:12px">← Back to encyclopedia</button>
      <div class="detail-modal">
        <div>
          <div class="detail-art" data-fish-id="${species.id}" data-fish-mutation="${entry.bestMutation ?? "normal"}" data-fish-width="300" data-fish-height="180"></div>
          <div class="detail-tags">
            <span class="rarity-badge ${species.rarity}">${RARITY_META[species.rarity].label}</span>
            ${species.habitats.map((h) => `<span class="stat-pill">${LOCATIONS_BY_ID[h].shortName}</span>`).join("")}
          </div>
        </div>
        <div class="detail-copy">
          <h3>${esc(species.name)}</h3>
          <p class="desc">${esc(species.description)}</p>
          <div class="detail-stats">
            <div class="detail-stat"><span>CAUGHT</span><b>${entry.count}</b></div>
            <div class="detail-stat"><span>BEST WEIGHT</span><b>${entry.bestWeight.toFixed(2)} kg</b></div>
            <div class="detail-stat"><span>BEST LENGTH</span><b>${entry.bestLength.toFixed(1)} cm</b></div>
            <div class="detail-stat"><span>BASE VALUE</span><b>◉ ${fmt(species.basePrice)}</b></div>
            <div class="detail-stat"><span>WEIGHT RANGE</span><b>${species.minWeight}–${species.maxWeight} kg</b></div>
            <div class="detail-stat"><span>DIFFICULTY</span><b>${"★".repeat(Math.min(8, species.difficulty))}</b></div>
          </div>
          <div class="detail-tags" style="margin-top:10px">
            <span class="stat-pill">WEATHER: ${species.weather.join(", ")}</span>
            <span class="stat-pill">TIME: ${species.time.join(", ")}</span>
            <span class="stat-pill">HABITAT: ${species.habitats.map((h) => LOCATIONS_BY_ID[h].name).join(", ")}</span>
          </div>
          <div class="section-title" style="margin-top:12px">MUTATION VARIANTS</div>
          <div class="variant-row">
            ${MUTATION_ORDER.map((mutation) => {
              const count = entry.variants?.[mutation] ?? 0;
              const meta = MUTATION_META[mutation];
              return `<span class="variant-chip ${count ? "is-found" : ""}" style="--variant:${meta.color}">${esc(meta.label)} · ${count}</span>`;
            }).join("")}
          </div>
          <p class="desc" style="margin-top:10px">First discovered ${new Date(entry.firstCaughtAt).toLocaleDateString()}. Best value ◉ ${fmt(entry.bestValue)}. ${entry.bestMutation && entry.bestMutation !== "normal" ? `Finest variant: ${MUTATION_META[entry.bestMutation].label}.` : ""}</p>
        </div>
      </div>`;
  }

  // ------------------------------------------------------------------ voyage
  private renderVoyage(): string {
    const p = this.profile!;
    const own = (this.state?.players as any)?.get?.(this.network.sessionId);
    const sailing = !!own?.sailing;
    const diving = !!own?.diving;
    const paints = BOAT_PAINTS.map((paint) => {
      const owned = p.boatPaints?.includes(paint.id);
      const active = p.boatColor === paint.id;
      return `<div class="paint-card ${active ? "is-active" : ""}" style="--accent:${paint.color}">
        <span class="paint-swatch" style="background:${paint.color}"></span>
        <div><b>${esc(paint.name)}</b><small>${owned ? (active ? "IN USE" : "OWNED") : `◉ ${fmt(paint.price)}`}</small></div>
        ${owned
          ? active ? `<span class="owned-tag">ACTIVE</span>` : `<button class="pixel-btn small ghost" data-action="equip-paint" data-id="${paint.id}">Use</button>`
          : `<button class="pixel-btn small gold" data-action="buy-paint" data-id="${paint.id}" ${p.coins < paint.price ? "disabled" : ""}>Buy</button>`}
      </div>`;
    }).join("");
    const gear = Object.values(EQUIPMENT).map((item) => {
      const owned = item.id === "dive-gear" ? p.diveGear : p.equipment.includes(item.id);
      return `<div class="shop-card" style="--accent:#7fb8c9">
        <div class="shop-top"><h3>${esc(item.name)}</h3>${owned ? `<span class="owned-tag">OWNED</span>` : ""}</div>
        <p>${esc(item.description)}</p>
        <div class="shop-buy"><span class="shop-price">◉ ${fmt(item.price)}</span>${owned ? `<span class="owned-tag">READY</span>` : `<button class="pixel-btn small gold" data-action="buy-gear" data-id="${item.id}" ${p.coins < item.price ? "disabled" : ""}>Buy</button>`}</div>
      </div>`;
    }).join("");
    const treasureRows = this.treasures.length
      ? this.treasures.map((treasure) => `<div class="treasure-row">
          <span class="treasure-icon">${treasure.kind === "chest" ? "▣" : treasure.kind === "urn" ? "⚱" : "▤"}</span>
          <div><b>${treasure.kind === "chest" ? "Sunken Chest" : treasure.kind === "urn" ? "Old Urn" : "Barnacled Crate"}</b><small>${Math.round((treasure.x) / 16)}, ${Math.round((treasure.y) / 16)} · ${countdown(treasure.expiresAt - Date.now())} left</small></div>
          <button class="pixel-btn small gold" data-action="collect-treasure" data-id="${esc(treasure.id)}">Open</button>
        </div>`).join("")
      : `<div class="empty-state" style="padding:16px">No sunken treasure marked nearby. Sail and dive to find more.</div>`;
    const sailors: Array<{ sessionId: string; username: string; distance: number }> = [];
    (this.state?.players as any)?.forEach?.((player: any, sessionId: string) => {
      if (sessionId !== this.network.sessionId && player.sailing) {
        sailors.push({
          sessionId,
          username: player.username,
          distance: own ? Math.round(Math.hypot(player.x - own.x, player.y - own.y)) : 0,
        });
      }
    });
    const sailorRows = sailors.length
      ? sailors.map((sailor) => `<div class="friend-row"><div><b>${esc(sailor.username)}</b><small>Sailing · ${sailor.distance} px away</small></div><button class="pixel-btn small gold" data-action="board-boat" data-session="${esc(sailor.sessionId)}">Board</button></div>`).join("")
      : `<div class="empty-state" style="padding:14px">No other skiffs are sailing here right now.</div>`;
    return `<div class="voyage-hero">
      <div><span class="voyage-kicker">${p.boatOwned ? "TIDE SKIFF · MOORED" : "NO BOAT YET"}</span><h3>${p.boatOwned ? "The open water is yours" : "Buy the Tide Skiff"}</h3><p>${p.boatOwned ? "Sail across deep water, carry passengers and reach the hidden island of Gull's Rest. Diving gear reveals chests below the waves." : "The harbourmaster sells a sturdy skiff for ◉ 3,200. It unlocks the Deep Ocean and secret islands."}</p></div>
      <div class="voyage-actions">
        ${p.boatOwned ? `<button class="pixel-btn small ${sailing ? "danger" : "gold"}" data-action="toggle-sail">${sailing ? "Dock Boat" : "Set Sail"}</button>` : `<button class="pixel-btn small gold" data-action="buy-boat" ${p.coins < BOAT.price ? "disabled" : ""}>Buy Skiff · ◉ ${fmt(BOAT.price)}</button>`}
        ${p.diveGear ? `<button class="pixel-btn small ${diving ? "danger" : ""}" data-action="toggle-dive">${diving ? "Surface" : "Dive"}</button>` : ""}
        ${own?.passengerOf ? `<button class="pixel-btn small danger" data-action="leave-boat">Leave Boat</button>` : ""}
      </div>
    </div>
    <div class="section-title">ANGLERS AFLOAT</div>
    <div class="friend-list">${sailorRows}</div>
    <div class="section-title">BOAT PAINTS</div>
    <div class="paint-grid">${paints}</div>
    <div class="section-title">DIVE & EXPLORATION GEAR</div>
    <div class="shop-grid">${gear}</div>
    <div class="section-title">MARKED TREASURE · ${this.treasures.length}</div>
    <div class="treasure-list">${treasureRows}</div>
    <p class="panel-note">Sailing moves you over water. Other anglers can board your skiff from this Voyage panel. Dive gear lets you swim and open sunken chests, but drains energy.</p>`;
  }

  // ------------------------------------------------------------------ island
  private renderIsland(): string {
    const p = this.profile!;
    const house = p.house;
    const aquarium = p.aquarium;
    const mastery = masteryProgress(p.mastery[p.location] ?? 0);
    const themes = HOUSE_THEMES.map((theme) => `<button class="tab-btn ${house.theme === theme.id ? "is-active" : ""}" data-action="house-theme" data-id="${theme.id}">${esc(theme.name)}</button>`).join("");
    const aquaThemes = AQUARIUM_THEMES.map((theme) => `<button class="tab-btn ${aquarium.theme === theme.id ? "is-active" : ""}" data-action="aquarium-theme" data-id="${theme.id}">${esc(theme.name)}</button>`).join("");
    const furnitureRows = house.furniture.length
      ? house.furniture.map((placement) => {
          const def = FURNITURE_BY_ID[placement.item];
          return `<div class="furniture-row"><span class="furniture-chip" style="background:${def?.color ?? "#8a6a48"}"></span><div><b>${esc(def?.name ?? placement.item)}</b><small>Placed at ${placement.x}, ${placement.y}</small></div><button class="pixel-btn small ghost" data-action="remove-furniture" data-id="${esc(placement.id)}">Store</button></div>`;
        }).join("")
      : `<div class="empty-state" style="padding:14px">Your island is bare. Buy furniture below and place it here.</div>`;
    const placedCounts: Record<string, number> = {};
    for (const placement of house.furniture) {
      placedCounts[placement.item] = (placedCounts[placement.item] ?? 0) + 1;
    }
    const storedRows = FURNITURE.filter((item) => (p.furniture?.[item.id] ?? 0) > (placedCounts[item.id] ?? 0)).map((item) => {
      const spare = (p.furniture?.[item.id] ?? 0) - (placedCounts[item.id] ?? 0);
      return `<div class="furniture-row"><span class="furniture-chip" style="background:${item.color}"></span><div><b>${esc(item.name)}</b><small>×${spare} stored</small></div><button class="pixel-btn small gold" data-action="place-furniture" data-id="${item.id}">Place</button></div>`;
    }).join("");
    const ownedFish = p.inventory.filter((fish) => !fish.cooked);
    const aquariumFish = aquarium.fish.length
      ? aquarium.fish.map((fish) => {
          const species = getFish(fish.speciesId);
          const meta = MUTATION_META[fish.mutation] ?? MUTATION_META.normal;
          return `<div class="aquarium-row" style="--rarity:${meta.color}">
            <div class="fish-thumb" data-fish-id="${species.id}" data-fish-mutation="${fish.mutation}" data-fish-width="56" data-fish-height="36"></div>
            <div><b>${esc(meta.label)} ${esc(species.name)}</b><small>${fish.weight.toFixed(2)} kg · ${meta.description}</small></div>
            <button class="pixel-btn small ghost" data-action="aquarium-remove" data-uid="${esc(fish.uid)}">Remove</button>
          </div>`;
        }).join("")
      : `<div class="empty-state" style="padding:14px">Your aquarium is empty. Add a fish from your creel.</div>`;
    const addFish = ownedFish.length
      ? ownedFish.slice(0, 30).map((fish) => {
          const species = getFish(fish.speciesId);
          const meta = MUTATION_META[fish.mutation ?? "normal"] ?? MUTATION_META.normal;
          return `<button class="mini-fish-card" data-action="aquarium-add" data-uid="${esc(fish.uid)}" style="--rarity:${meta.color}">
            <div class="fish-thumb" data-fish-id="${species.id}" data-fish-mutation="${fish.mutation ?? "normal"}" data-fish-width="48" data-fish-height="30"></div>
            <span>${esc(species.name)}</span><small>${meta.label} · ${fish.weight.toFixed(1)} kg</small>
          </button>`;
        }).join("")
      : `<div class="empty-state" style="padding:12px">No raw fish in your creel.</div>`;
    const trophies = p.trophies.length
      ? p.trophies.map((trophy) => {
          const species = getFish(trophy.speciesId);
          const meta = MUTATION_META[trophy.mutation] ?? MUTATION_META.normal;
          return `<div class="trophy-card" style="--rarity:${meta.color}">
            <div class="fish-thumb" data-fish-id="${species.id}" data-fish-mutation="${trophy.mutation}" data-fish-width="64" data-fish-height="40"></div>
            <b>${esc(trophy.label)}</b><small>${trophy.weight.toFixed(2)} kg · ${trophy.length.toFixed(1)} cm</small>
          </div>`;
        }).join("")
      : `<div class="empty-state" style="padding:14px">Land a legendary fish or a record-sized catch to fill the trophy shelf.</div>`;
    const visit = this.houseVisit
      ? `<div class="house-visit">
          <div class="section-title">VISITING ${esc(this.houseVisit.owner.toUpperCase())}'S ISLAND</div>
          <p>${esc(this.houseVisit.house.name)} · ${esc(HOUSE_THEMES.find((theme) => theme.id === this.houseVisit!.house.theme)?.name ?? "Island home")} · ${this.houseVisit.visits} visits</p>
          <div class="furniture-grid">${this.houseVisit.house.furniture.map((placement) => `<div class="furniture-row"><span class="furniture-chip" style="background:${FURNITURE_BY_ID[placement.item]?.color ?? "#8a6a48"}"></span><b>${esc(FURNITURE_BY_ID[placement.item]?.name ?? placement.item)}</b></div>`).join("")}</div>
          <div class="section-title">THEIR TROPHIES</div>
          <div class="trophy-grid">${this.houseVisit.trophies.length ? this.houseVisit.trophies.map((trophy) => `<div class="trophy-card"><b>${esc(trophy.label)}</b><small>${trophy.weight.toFixed(2)} kg</small></div>`).join("") : `<div class="empty-state" style="padding:12px">No trophies yet.</div>`}</div>
        </div>`
      : "";
    const furnitureShop = FURNITURE.map((item) => `<button class="furniture-shop-card" data-action="buy-furniture" data-id="${item.id}" style="--accent:${item.color}" ${p.coins < item.price ? "disabled" : ""}>
      <span class="furniture-chip" style="background:${item.color}"></span>
      <div><b>${esc(item.name)}</b><small>${esc(item.type.toUpperCase())} · ◉ ${fmt(item.price)} · owned ${p.furniture?.[item.id] ?? 0}</small></div>
    </button>`).join("");
    return `<div class="island-hero">
      <div><span class="voyage-kicker">PERSONAL ISLAND</span><h3>${esc(house.name)}</h3><p>${esc(HOUSE_THEMES.find((theme) => theme.id === house.theme)?.description ?? "A quiet home on the tide.")} · ${house.visits} visits · ${house.furniture.length}/60 furnishings</p></div>
      <div class="mastery-pill"><span>MASTERY · ${esc(LOCATIONS_BY_ID[p.location]?.shortName ?? "TIDE")}</span><b>LV ${mastery.level}</b><div class="mastery-track"><i style="width:${(mastery.into / mastery.next) * 100}%"></i></div></div>
    </div>
    <div class="section-title">HOUSE THEME</div>
    <div class="panel-tabs">${themes}</div>
    <div class="section-title">FURNISHINGS · ${house.furniture.length}</div>
    <div class="furniture-list">${furnitureRows}</div>
    <div class="section-title">STORED FURNITURE</div>
    <div class="furniture-list">${storedRows || `<div class="empty-state" style="padding:14px">Everything you own is placed.</div>`}</div>
    <div class="section-title">FURNITURE SHOP</div>
    <div class="furniture-grid">${furnitureShop}</div>
    <div class="section-title">AQUARIUM · ${aquarium.fish.length}/${aquarium.slots}</div>
    <div class="aquarium-box" style="--accent:${AQUARIUM_THEMES.find((theme) => theme.id === aquarium.theme)?.color ?? "#ff8fc7"}">
      <div class="aquarium-water">${aquarium.fish.length ? aquarium.fish.map((fish) => `<span class="aquarium-swimmer" data-fish-id="${fish.speciesId}" data-fish-width="54" data-fish-height="34"></span>`).join("") : `<span class="aquarium-empty">The tank waits for a first fish.</span>`}</div>
      <div class="aquarium-controls"><button class="pixel-btn small gold" data-action="aquarium-feed">Feed · ◉ 25</button><span class="stat-pill">FOOD ${aquarium.food}</span></div>
    </div>
    <div class="panel-tabs">${aquaThemes}</div>
    <div class="aquarium-list">${aquariumFish}</div>
    <div class="section-title">ADD FROM CREEL</div>
    <div class="mini-fish-grid">${addFish}</div>
    <div class="section-title">TROPHY ROOM</div>
    <div class="trophy-grid">${trophies}</div>
    <div class="section-title">VISIT A FRIEND</div>
    <div class="inline-form"><input id="visit-name" placeholder="Angler name" /><button class="pixel-btn small" data-action="visit-house">Visit Island</button></div>
    ${visit}`;
  }

  // ------------------------------------------------------------------ social
  private renderSocial(): string {
    const p = this.profile!;
    const tabs = (["friends", "guild", "market", "trade"] as SocialTab[])
      .map((tab) => `<button class="tab-btn ${this.socialTab === tab ? "is-active" : ""}" data-action="social-tab" data-tab="${tab}">${tab === "friends" ? "Crew" : tab === "guild" ? "Guild" : tab === "market" ? "Market" : "Trade"}</button>`)
      .join("");
    if (this.socialTab === "friends") {
      const rows = this.friends.length
        ? this.friends.map((friend) => `<div class="friend-row">
            <span class="online-dot ${friend.online ? "on" : ""}"></span>
            <div><b>${esc(friend.username)}</b><small>${friend.online ? "Online now" : "Away"}</small></div>
            <button class="pixel-btn small ghost" data-action="visit-friend" data-username="${esc(friend.username)}">Visit Island</button>
            <button class="pixel-btn small ghost" data-action="friend-remove" data-id="${esc(friend.id)}">Remove</button>
          </div>`).join("")
        : `<div class="empty-state" style="padding:18px">Your crew list is empty. Add anglers by name above.</div>`;
      return `<div class="panel-tabs">${tabs}</div>
        <div class="inline-form"><input id="friend-name" placeholder="Angler name" /><button class="pixel-btn small gold" data-action="friend-add">Add to Crew</button></div>
        <div class="section-title">CREW · ${this.friends.length}</div>
        <div class="friend-list">${rows}</div>
        <div class="section-title">EMOTES</div>
        <div class="emote-bar">${Object.entries(EMOTE_LABEL).map(([id, label]) => `<button class="emote-btn" data-action="emote" data-emote="${id}" title="${esc(label)}">${{ wave: "✦", dance: "♪", heart: "♥", laugh: "☺", fish: "◉", sit: "▾", party: "✺", sleep: "☾" }[id] ?? "✦"}<small>${esc(label)}</small></button>`).join("")}</div>`;
    }
    if (this.socialTab === "guild") {
      const guild = this.guild;
      const memberRows = guild?.members.length
        ? guild.members.map((member) => `<div class="friend-row"><span class="online-dot ${member.online ? "on" : ""}"></span><div><b>${esc(member.username)}</b><small>${esc(member.role)} · LV ${member.level} · ${fmt(member.contribution)} contribution</small></div></div>`).join("")
        : "";
      const joinRows = this.guildList.length
        ? this.guildList.map((entry) => `<div class="friend-row"><div><b>[${esc(entry.tag)}] ${esc(entry.name)}</b><small>${entry.members} members · ${esc(entry.description || "No creed yet.")}</small></div><button class="pixel-btn small gold" data-action="guild-join" data-id="${esc(entry.id)}" ${guild ? "disabled" : ""}>Join</button></div>`).join("")
        : `<div class="empty-state" style="padding:16px">No guilds founded yet. Start the first one.</div>`;
      return `<div class="panel-tabs">${tabs}</div>
        ${guild ? `<div class="guild-hero"><h3>[${esc(guild.tag)}] ${esc(guild.name)}</h3><p>${esc(guild.description || "A crew bound by the tide.")}</p><div class="guild-stats"><span class="stat-pill">LV ${guild.level}</span><span class="stat-pill">${fmt(guild.xp)} XP</span><span class="stat-pill">${guild.members.length} MEMBERS</span></div><button class="pixel-btn small danger" data-action="guild-leave">Leave Guild</button></div>
          <div class="section-title">MEMBERS</div><div class="friend-list">${memberRows}</div>
          <div class="section-title">GUILD CHAT</div>
          <form id="guild-chat-form" class="inline-form"><input id="guild-chat-input" maxlength="140" placeholder="Speak to your guild…" /><button class="pixel-btn small" type="submit">Send</button></form>`
          : `<div class="section-title">FOUND A GUILD · ◉ 2,500</div>
            <div class="inline-form"><input id="guild-name" placeholder="Guild name" maxlength="24" /><input id="guild-tag" placeholder="TAG" maxlength="5" /><input id="guild-desc" placeholder="Short creed" maxlength="140" /><button class="pixel-btn small gold" data-action="guild-create" ${p.coins < 2500 ? "disabled" : ""}>Found</button></div>`}
        <div class="section-title">GUILDS OF THE TIDE</div><div class="friend-list">${joinRows}</div>`;
    }
    if (this.socialTab === "market") {
      const ownFish = p.inventory.filter((fish) => !fish.cooked);
      const options = ownFish.map((fish) => {
        const species = getFish(fish.speciesId);
        const meta = MUTATION_META[fish.mutation ?? "normal"] ?? MUTATION_META.normal;
        return `<option value="${esc(fish.uid)}">${esc(meta.label)} ${esc(species.name)} · ${fish.weight.toFixed(2)} kg · ◉ ${fmt(fish.value)}</option>`;
      }).join("");
      const listings = this.market.length
        ? this.market.map((listing) => {
            const species = getFish(listing.speciesId);
            const meta = MUTATION_META[listing.mutation] ?? MUTATION_META.normal;
            const own = listing.sellerId === p.id;
            return `<div class="market-row" style="--rarity:${meta.color}">
              <div class="fish-thumb" data-fish-id="${species.id}" data-fish-width="56" data-fish-height="36"></div>
              <div><b>${esc(meta.label)} ${esc(species.name)}</b><small>${listing.weight.toFixed(2)} kg · sold by ${esc(listing.sellerName)}</small></div>
              <span class="price">◉ ${fmt(listing.price)}</span>
              ${own
                ? `<button class="pixel-btn small ghost" data-action="market-cancel" data-id="${esc(listing.id)}">Cancel</button>`
                : `<button class="pixel-btn small gold" data-action="market-buy" data-id="${esc(listing.id)}" ${p.coins < listing.price ? "disabled" : ""}>Buy</button>`}
            </div>`;
          }).join("")
        : `<div class="empty-state" style="padding:18px">The market is quiet. List the first fish.</div>`;
      return `<div class="panel-tabs">${tabs}</div>
        <div class="section-title">LIST A FISH</div>
        <div class="inline-form market-form">
          <select id="market-fish">${options || `<option value="">No fish to list</option>`}</select>
          <input id="market-price" type="number" min="10" placeholder="Price" value="${this.marketPrice}" />
          <button class="pixel-btn small gold" data-action="market-list" ${options ? "" : "disabled"}>List for Sale</button>
        </div>
        <div class="section-title">MARKET LISTINGS · ${this.market.length}</div>
        <div class="market-list">${listings}</div>`;
    }
    const trade = this.trade;
    if (!trade) {
      const players: Array<{ id: string; username: string }> = [];
      (this.state?.players as any)?.forEach?.((player: any, sessionId: string) => {
        if (player.id !== p.id) players.push({ id: sessionId, username: player.username });
      });
      const rows = players.length
        ? players.map((player) => `<div class="friend-row"><div><b>${esc(player.username)}</b><small>Nearby angler</small></div><button class="pixel-btn small gold" data-action="trade-request" data-session="${esc(player.id)}">Offer Trade</button></div>`).join("")
        : `<div class="empty-state" style="padding:18px">No other anglers nearby to trade with.</div>`;
      return `<div class="panel-tabs">${tabs}</div><div class="section-title">ANGLERS IN THIS ROOM</div><div class="friend-list">${rows}</div>
        <p class="panel-note">Trading swaps fish and coins directly between two anglers. Both offers are validated by the server before anything moves.</p>`;
    }
    const mine = trade.from === p.username ? trade.fromOffer : trade.toOffer;
    const theirs = trade.from === p.username ? trade.toOffer : trade.fromOffer;
    const otherName = trade.from === p.username ? trade.to : trade.from;
    const offerFish = p.inventory.filter((fish) => !fish.cooked).slice(0, 24).map((fish) => {
      const species = getFish(fish.speciesId);
      const meta = MUTATION_META[fish.mutation ?? "normal"] ?? MUTATION_META.normal;
      const selected = this.tradeUids.includes(fish.uid);
      return `<label class="trade-fish ${selected ? "is-selected" : ""}" style="--rarity:${meta.color}">
        <input type="checkbox" data-trade-uid="${esc(fish.uid)}" ${selected ? "checked" : ""} />
        <span>${esc(meta.label)} ${esc(species.name)}</span><small>${fish.weight.toFixed(2)} kg · ◉ ${fmt(fish.value)}</small>
      </label>`;
    }).join("");
    const renderOffer = (offer: TradeView["fromOffer"]) => offer.fish.length
      ? offer.fish.map((fish) => `<div class="trade-line"><span>${esc(MUTATION_META[fish.mutation]?.label ?? "Natural")} ${esc(getFish(fish.speciesId).name)}</span><small>${fish.weight.toFixed(2)} kg</small></div>`).join("") + (offer.coins ? `<div class="trade-line"><span>Coins</span><small>◉ ${fmt(offer.coins)}</small></div>` : "")
      : `<div class="trade-empty">Nothing offered yet</div>`;
    return `<div class="panel-tabs">${tabs}</div>
      <div class="trade-hero"><h3>Trading with ${esc(otherName)}</h3><p>Select fish from your creel and set coins, then update your offer. Accept only when both sides look right.</p></div>
      <div class="trade-columns">
        <div class="trade-column"><div class="section-title">YOUR OFFER</div>${renderOffer(mine)}</div>
        <div class="trade-column"><div class="section-title">THEIR OFFER</div>${renderOffer(theirs)}</div>
      </div>
      <div class="section-title">ADD TO YOUR OFFER</div>
      <div class="trade-fish-grid">${offerFish || `<div class="empty-state" style="padding:12px">No fish to offer.</div>`}</div>
      <div class="inline-form"><input id="trade-coins" type="number" min="0" max="${p.coins}" value="${this.tradeCoins}" placeholder="Coins" /><button class="pixel-btn small" data-action="trade-offer">Update Offer</button><button class="pixel-btn small gold" data-action="trade-accept">Accept Trade</button><button class="pixel-btn small danger" data-action="trade-cancel">Cancel</button></div>`;
  }

  // ------------------------------------------------------------------ events
  private renderEvents(): string {
    const active = this.eventView;
    const def = active ? WORLD_EVENTS_BY_ID[active.id] : null;
    const creature = this.creatureView;
    const party = this.partyActive ? `<div class="event-card party-card"><h3>Beach Party</h3><p>${this.partyCount} anglers are gathered at a campfire. Cook a feast, dance, and share the evening.</p></div>` : "";
    const activeCard = active && def
      ? `<div class="event-hero" style="--event:${active.color}">
          <span class="event-big-icon">${esc(active.icon)}</span>
          <div><span class="voyage-kicker">ACTIVE WORLD EVENT</span><h3>${esc(active.name)}</h3><p>${esc(active.description)}</p>
          <div class="event-bonuses"><span class="stat-pill">RARITY +${Math.round(def.rarityBoost * 100)}%</span><span class="stat-pill">VALUE ×${def.valueMult.toFixed(2)}</span><span class="stat-pill">XP ×${def.xpMult.toFixed(2)}</span><span class="stat-pill">MUTATION +${Math.round(def.mutationBoost * 100)}%</span></div></div>
          <div class="event-clock"><span>ENDS IN</span><b id="event-panel-countdown">${countdown(active.endsAt - Date.now())}</b></div>
        </div>`
      : `<div class="event-hero is-idle"><div><span class="voyage-kicker">THE SEA IS QUIET</span><h3>No event right now</h3><p>The next tide event gathers in ${this.eventNextAt ? countdown(this.eventNextAt - Date.now()) : "a little while"}. Keep casting.</p></div></div>`;
    const creatureCard = creature
      ? `<div class="creature-card">
          <div class="creature-card-head"><div><span class="voyage-kicker">GIANT OF THE DEEP</span><h3>${esc(creature.name)}</h3><p>${esc(creature.kind.toUpperCase())} · ${creature.participants} hunters · ends in ${countdown(creature.endsAt - Date.now())}</p></div><div class="creature-actions">${creature.joined ? `<button class="pixel-btn small gold" data-action="strike-creature">STRIKE</button>` : `<button class="pixel-btn small gold" data-action="join-creature">JOIN HUNT</button>`}</div></div>
          <div class="creature-hp big"><i style="width:${Math.max(0, Math.min(100, (creature.hp / Math.max(1, creature.maxHp)) * 100))}%"></i></div>
          <div class="creature-meta"><span>${fmt(creature.hp)} / ${fmt(creature.maxHp)} HP</span><span>YOUR DAMAGE ${fmt(creature.contribution)}</span></div>
        </div>`
      : `<div class="event-card"><h3>No giant nearby</h3><p>Whales, serpents, sharks and the kraken surface from time to time. Watch the horizon.</p></div>`;
    const treasureRows = this.treasures.length
      ? this.treasures.map((treasure) => `<div class="treasure-row"><span class="treasure-icon">▣</span><div><b>${treasure.kind === "urn" ? "Old Urn" : treasure.kind === "crate" ? "Barnacled Crate" : "Sunken Chest"}</b><small>${countdown(treasure.expiresAt - Date.now())} left · dive to open</small></div><button class="pixel-btn small gold" data-action="collect-treasure" data-id="${esc(treasure.id)}">Open</button></div>`).join("")
      : `<div class="empty-state" style="padding:16px">No treasure marked. Explore the water and check back.</div>`;
    const catalog = Object.values(WORLD_EVENTS_BY_ID).map((event) => `<div class="event-catalog-card" style="--event:${event.color}">
      <span>${esc(event.icon)}</span><div><b>${esc(event.name)}</b><small>${esc(event.description)}</small></div>
    </div>`).join("");
    return `${activeCard}
      ${creatureCard}
      ${party}
      <div class="section-title">SUNKEN TREASURE · ${this.treasures.length}</div>
      <div class="treasure-list">${treasureRows}</div>
      <div class="section-title">EVENT CATALOG</div>
      <div class="event-catalog">${catalog}</div>
      <p class="panel-note">Events are timed by the server for every angler in the room. Rewards are granted based on your contribution when the event ends.</p>`;
  }

  // ------------------------------------------------------------------ shop
  private renderShop(): string {
    const p = this.profile!;
    const tabs = `
      <div class="panel-tabs shop-tabs">
        <button class="tab-btn ${this.shopTab === "rods" ? "is-active" : ""}" data-action="shop-tab" data-tab="rods">Fishing Rods</button>
        <button class="tab-btn ${this.shopTab === "baits" ? "is-active" : ""}" data-action="shop-tab" data-tab="baits">Bait</button>
        <button class="tab-btn ${this.shopTab === "clothing" ? "is-active" : ""}" data-action="shop-tab" data-tab="clothing">Clothing</button>
        <button class="tab-btn ${this.shopTab === "boat" ? "is-active" : ""}" data-action="shop-tab" data-tab="boat">Boats</button>
      </div>`;
    if (this.shopTab === "rods") {
      return `${tabs}<div class="shop-grid">${RODS.map((rod) => {
        const owned = p.rods.includes(rod.id);
        return `<div class="shop-card" style="--accent:${rod.color}">
          <div class="shop-top"><h3>${esc(rod.name)}</h3>${owned ? `<span class="owned-tag">OWNED</span>` : ""}</div>
          <p>${esc(rod.description)}</p>
          <div class="shop-stats">${statPill("CAST", String(rod.castDistance))}${statPill("LUCK", rod.luck.toFixed(2))}${statPill("ZONE", rod.zoneSize.toFixed(2))}${statPill("REEL", rod.reelPower.toFixed(2))}</div>
          <div class="shop-buy"><span class="shop-price">◉ ${fmt(rod.price)}</span>${owned ? `<span class="owned-tag">IN CREEL</span>` : `<button class="pixel-btn small gold" data-action="buy-rod" data-id="${rod.id}" ${p.coins < rod.price ? "disabled" : ""}>Buy</button>`}</div>
        </div>`;
      }).join("")}</div>`;
    }
    if (this.shopTab === "baits") {
      return `${tabs}<div class="shop-grid">${BAITS.map((bait) => {
        const count = p.baits[bait.id] ?? 0;
        return `<div class="shop-card" style="--accent:${bait.color}">
          <div class="shop-top"><h3>${esc(bait.name)}</h3><span class="stat-pill">×${count}</span></div>
          <p>${esc(bait.description)}</p>
          <div class="shop-stats">${statPill("BUNDLE", String(bait.bundle))}${statPill("RARITY", `+${Math.round(bait.rarityBoost * 100)}%`)}${statPill("LEVEL", String(bait.levelRequired))}</div>
          <div class="shop-buy"><span class="shop-price">◉ ${fmt(bait.price)}</span><button class="pixel-btn small gold" data-action="buy-bait" data-id="${bait.id}" ${p.coins < bait.price || p.level < bait.levelRequired ? "disabled" : ""}>${p.level < bait.levelRequired ? `LV ${bait.levelRequired}` : "Buy"}</button></div>
        </div>`;
      }).join("")}</div>`;
    }
    if (this.shopTab === "clothing") {
      const season = currentSeason();
      return `${tabs}<div class="shop-grid">${COSMETICS.filter((item) => !item.rewardOnly).map((item) => {
        const owned = p.cosmetics.includes(item.id);
        const locked = !!item.season && item.season !== season;
        return `<div class="shop-card" style="--accent:${item.type === "outfit" ? item.value : "#e8c17a"}">
          <div class="shop-top"><h3>${esc(item.name)}</h3>${owned ? `<span class="owned-tag">OWNED</span>` : `<span class="stat-pill">${item.season ? SEASON_LABEL[item.season].toUpperCase() : item.type.toUpperCase()}</span>`}</div>
          <p>${esc(item.description)}</p>
          <div class="shop-buy"><span class="shop-price">◉ ${fmt(item.price)}</span>${owned ? `<span class="owned-tag">IN WARDROBE</span>` : locked ? `<span class="stat-pill">RETURNS IN ${SEASON_LABEL[item.season!].toUpperCase()}</span>` : `<button class="pixel-btn small gold" data-action="buy-cosmetic" data-id="${item.id}" ${p.coins < item.price ? "disabled" : ""}>Buy</button>`}</div>
        </div>`;
      }).join("")}</div>`;
    }
    return `${tabs}
      <div class="shop-grid">
        <div class="shop-card" style="--accent:#5f8dff">
          <div class="shop-top"><h3>${esc(BOAT.name)}</h3>${p.boatOwned ? `<span class="owned-tag">OWNED</span>` : ""}</div>
          <p>${esc(BOAT.description)}</p>
          <div class="shop-stats">${statPill("UNLOCKS", "Deep Ocean")}${statPill("LEVEL", "15")}</div>
          <div class="shop-buy"><span class="shop-price">◉ ${fmt(BOAT.price)}</span>${p.boatOwned ? `<span class="owned-tag">MOORED</span>` : `<button class="pixel-btn small gold" data-action="buy-boat" ${p.coins < BOAT.price ? "disabled" : ""}>Buy</button>`}</div>
        </div>
        <div class="shop-card" style="--accent:#4cc9b0">
          <div class="shop-top"><h3>Creel Expansion</h3><span class="stat-pill">+8 SLOTS</span></div>
          <p>Handwoven kelp basket. More room for the big ones.</p>
          <div class="shop-stats">${statPill("CURRENT", String(p.inventorySlots))}${statPill("MAX", "72")}</div>
          <div class="shop-buy"><span class="shop-price">◉ ${fmt(Math.round(1100 * Math.pow(1.75, (p.inventorySlots - 24) / 8)))}</span><button class="pixel-btn small gold" data-action="upgrade-inventory" ${p.inventorySlots >= 72 ? "disabled" : ""}>Upgrade</button></div>
        </div>
      </div>`;
  }

  // ------------------------------------------------------------------ quests
  private renderQuests(): string {
    const p = this.profile!;
    const quests = p.daily.quests.map((quest) => {
      const complete = quest.progress >= quest.target;
      return `<div class="quest-card ${complete ? "is-complete" : ""} ${quest.claimed ? "is-claimed" : ""}">
        <div class="quest-icon">${complete ? "✓" : "◈"}</div>
        <div class="quest-copy">
          <strong>${esc(quest.title)}</strong>
          <p>${esc(quest.description)}</p>
          <div class="quest-progress"><i style="width:${Math.min(100, (quest.progress / quest.target) * 100)}%"></i></div>
          <div class="quest-meta"><span>${Math.min(quest.progress, quest.target)} / ${quest.target}</span><span>◉ ${fmt(quest.rewardCoins)} · ${fmt(quest.rewardXp)} XP</span></div>
        </div>
        ${quest.claimed
          ? `<span class="owned-tag">CLAIMED</span>`
          : complete
            ? `<button class="pixel-btn small gold" data-action="claim-quest" data-id="${quest.id}">Claim</button>`
            : `<span class="quest-reward">IN PROGRESS</span>`}
      </div>`;
    }).join("");
    const achievements = p.achievements.map((a) => {
      const complete = a.progress >= a.target;
      return `<div class="quest-card ${complete ? "is-complete" : ""} ${a.claimed ? "is-claimed" : ""}">
        <div class="quest-icon">${a.claimed ? "★" : complete ? "✓" : "☆"}</div>
        <div class="quest-copy">
          <strong>${esc(a.title)}</strong>
          <p>${esc(a.description)}</p>
          <div class="quest-progress"><i style="width:${Math.min(100, (a.progress / a.target) * 100)}%"></i></div>
          <div class="quest-meta"><span>${Math.min(a.progress, a.target)} / ${a.target}</span><span>◉ ${fmt(a.rewardCoins)}</span></div>
        </div>
        ${a.claimed
          ? `<span class="owned-tag">CLAIMED</span>`
          : complete && a.unlockedAt
            ? `<button class="pixel-btn small gold" data-action="claim-achievement" data-id="${a.id}">Claim</button>`
            : `<span class="quest-reward">LOCKED</span>`}
      </div>`;
    }).join("");
    const weekly = p.weekly.quests.map((quest) => {
      const complete = quest.progress >= quest.target;
      return `<div class="quest-card ${complete ? "is-complete" : ""} ${quest.claimed ? "is-claimed" : ""}">
        <div class="quest-icon">${quest.claimed ? "★" : complete ? "✓" : "◷"}</div>
        <div class="quest-copy">
          <strong>${esc(quest.title)}</strong>
          <p>${esc(quest.description)}</p>
          <div class="quest-progress"><i style="width:${Math.min(100, (quest.progress / quest.target) * 100)}%"></i></div>
          <div class="quest-meta"><span>${Math.min(quest.progress, quest.target)} / ${quest.target}</span><span>◉ ${fmt(quest.rewardCoins)} · ${fmt(quest.rewardXp)} XP</span></div>
        </div>
        ${quest.claimed
          ? `<span class="owned-tag">CLAIMED</span>`
          : complete
            ? `<button class="pixel-btn small gold" data-action="claim-weekly" data-id="${quest.id}">Claim</button>`
            : `<span class="quest-reward">IN PROGRESS</span>`}
      </div>`;
    }).join("");
    const secret = SECRET_QUESTS.map((def) => {
      const progress = p.secretQuests.find((entry) => entry.id === def.id);
      const current = progress?.progress ?? 0;
      const complete = current >= def.target;
      return `<div class="quest-card secret-quest ${progress?.claimed ? "is-claimed" : ""}">
        <div class="quest-icon">${progress?.claimed ? "★" : complete ? "✓" : "✦"}</div>
        <div class="quest-copy">
          <strong>${esc(def.title)}</strong>
          <p>${esc(def.description)}</p>
          ${progress ? `<div class="quest-progress"><i style="width:${Math.min(100, (current / def.target) * 100)}%"></i></div><div class="quest-meta"><span>${Math.min(current, def.target)} / ${def.target}</span><span>◉ ${fmt(def.rewardCoins)} · ${fmt(def.rewardXp)} XP</span></div>` : `<div class="quest-meta"><span>Speak to the Tide Hermit on Gull's Rest.</span><span>◉ ${fmt(def.rewardCoins)}</span></div>`}
        </div>
        ${progress?.claimed
          ? `<span class="owned-tag">CLAIMED</span>`
          : complete
            ? `<button class="pixel-btn small gold" data-action="secret-claim" data-id="${def.id}">Claim</button>`
            : progress
              ? `<span class="quest-reward">IN PROGRESS</span>`
              : `<button class="pixel-btn small" data-action="secret-accept" data-id="${def.id}">Accept</button>`}
      </div>`;
    }).join("");
    return `<div class="section-title">DAILY QUESTS · RESET ${p.daily.date}</div>
      <div class="quest-grid">${quests || `<div class="empty-state">No quests today. Cast a line!</div>`}</div>
      <div class="section-title">WEEKLY QUESTS · ${p.weekly.week}</div>
      <div class="quest-grid">${weekly || `<div class="empty-state">No weekly quests.</div>`}</div>
      <div class="section-title">SECRET QUESTS</div>
      <div class="quest-grid">${secret}</div>
      <div class="section-title">ACHIEVEMENTS</div>
      <div class="quest-grid">${achievements}</div>`;
  }

  // ------------------------------------------------------------------ map
  private renderMap(): string {
    const p = this.profile!;
    const locationCards = LOCATIONS.map((loc) => {
      const unlocked = locationUnlocked(p.level, p.boatOwned, loc);
      const current = p.location === loc.id;
      return `<div class="location-card ${current ? "is-current" : ""} ${unlocked ? "" : "is-locked"}" style="--accent:${loc.accent}">
        <h3>${esc(loc.name)}</h3>
        <span class="loc-water">${esc(loc.waterName)}</span>
        <p>${esc(loc.description)}</p>
        <div class="loc-foot">
          ${current ? `<span class="owned-tag">YOU ARE HERE</span>` : unlocked
            ? `<button class="pixel-btn small" data-action="travel" data-id="${loc.id}">Sail Here</button>`
            : `<span class="lock-note">${loc.requiresBoat && !p.boatOwned ? "REQUIRES BOAT" : `LEVEL ${loc.unlockLevel}`}</span><button class="pixel-btn small ghost" disabled>Locked</button>`}
          <span class="stat-pill">${loc.unlockLevel > 1 ? `LV ${loc.unlockLevel}` : "STARTER"}</span>
        </div>
      </div>`;
    }).join("");

    let roomsHtml = `<div class="empty-state" style="padding:18px">Looking for other anglers…</div>`;
    if (!this.roomsLoading && this.rooms) {
      roomsHtml = this.rooms.length
        ? this.rooms.map((room) => `<div class="rank-row">
            <span class="rank-num">${room.clients}</span>
            <div><div class="rank-name">${esc(LOCATIONS_BY_ID[room.location]?.name ?? room.location)}</div><div class="rank-detail">Room ${esc(room.roomId.slice(0, 8))} · ${room.clients}/${room.maxClients} anglers</div></div>
            <button class="pixel-btn small" data-action="join-room" data-id="${esc(room.roomId)}" ${room.clients >= room.maxClients ? "disabled" : ""}>Join</button>
          </div>`).join("")
        : `<div class="empty-state" style="padding:18px">No public rooms right now. Sail out and start one!</div>`;
    }
    return `<div class="map-grid">${locationCards}</div>
      <div class="section-title">MULTIPLAYER ROOMS</div>
      <div style="display:flex;gap:6px;margin-bottom:9px">
        <button class="pixel-btn small ghost" data-action="refresh-rooms">Refresh</button>
        <button class="pixel-btn small" data-action="create-private">Create Private Room</button>
      </div>
      <div class="rank-list">${roomsHtml}</div>
      <div class="section-title">JOIN WITH A ROOM CODE</div>
      <div style="display:flex;gap:6px">
        <input id="private-code" maxlength="10" placeholder="ROOM CODE" style="flex:1;background:#061821;border:1px solid #25505b;padding:8px 10px;color:#f8f2df;font-size:17px;outline:none" />
        <button class="pixel-btn small" data-action="join-code">Join Code</button>
      </div>
      <p style="font-size:15px;color:#7f9da0">Public rooms hold up to 30 anglers. Private rooms use a shareable code and the same live world.</p>`;
  }

  // ------------------------------------------------------------------ tournament
  private renderTournament(): string {
    const view = this.tournamentView;
    if (!view) {
      this.network.send("requestTournament");
      return `<div class="empty-state"><span class="big-icon">♛</span>Calling the harbourmaster…</div>`;
    }
    const now = Date.now();
    const active = view.phase === "active";
    const countdownMs = active ? view.endsAt - now : view.phase === "results" ? 0 : view.startsAt - now;
    const results = view.results?.length
      ? `<div class="result-list">${view.results.map((r) => `<div class="rank-row ${r.place === 1 ? "top1" : ""}">
          <span class="rank-num">#${r.place}</span>
          <div><div class="rank-name">${esc(r.username)}</div><div class="rank-detail">${r.catches} fish · ${fmt(r.score)} points</div></div>
          <span class="rank-value">${r.place === 1 ? "WINNER" : ""}</span>
        </div>`).join("")}</div>`
      : "";
    return `<div class="tournament-hero">
      <h3>${phaseLabel(view.phase)}</h3>
      <p>Every catch during the tournament scores its sale value. The angler with the highest total wins coins, XP and glory. The server keeps score.</p>
      <div class="tourney-stats">
        <div class="tourney-stat"><span>STARTS / ENDS IN</span><b id="tourney-countdown" class="tourney-countdown">${active ? countdown(countdownMs) : view.phase === "results" ? "FINISHED" : countdown(countdownMs)}</b></div>
        <div class="tourney-stat"><span>ENTERED</span><b>${view.entries}</b></div>
        <div class="tourney-stat"><span>YOUR SCORE</span><b>${fmt(view.score)}</b></div>
        <div class="tourney-stat"><span>STATUS</span><b>${view.joined ? "JOINED" : "NOT ENTERED"}</b></div>
      </div>
      <div class="tourney-actions">
        ${view.joined
          ? `<button class="pixel-btn small danger" data-action="tournament-leave">Leave Tournament</button>`
          : `<button class="pixel-btn small gold" data-action="tournament-join" ${view.phase === "results" ? "disabled" : ""}>${active ? "Join In Progress" : "Enter Next Tournament"}</button>`}
        <button class="pixel-btn small ghost" data-action="refresh-tournament">Refresh</button>
      </div>
      <p style="margin-top:10px;font-size:14px;color:#8a7c53">Rewards: 1st ◉ 1,500 + 500 XP · 2nd ◉ 750 + 250 XP · 3rd ◉ 350 + 120 XP · all entrants receive a reward.</p>
    </div>
    ${results}`;
  }

  private updateEventBanner(): void {
    const el = $("event-banner");
    if (!el) return;
    if (this.eventView) {
      el.classList.remove("is-hidden");
      el.style.setProperty("--event", this.eventView.color);
      el.innerHTML = `<span class="event-icon">${esc(this.eventView.icon)}</span><span><b>${esc(this.eventView.name)}</b><em id="event-countdown">${countdown(this.eventView.endsAt - Date.now())}</em></span>`;
      el.title = this.eventView.description;
    } else {
      el.classList.add("is-hidden");
    }
  }

  private updateCreatureBanner(): void {
    const el = $("creature-banner");
    if (!el) return;
    const creature = this.creatureView;
    if (!creature) {
      el.classList.add("is-hidden");
      return;
    }
    el.classList.remove("is-hidden");
    const pct = Math.max(0, Math.min(100, (creature.hp / Math.max(1, creature.maxHp)) * 100));
    el.innerHTML = `<div class="creature-copy"><span class="creature-kicker">GIANT OF THE DEEP · ${esc(creature.kind.toUpperCase())}</span><b>${esc(creature.name)}</b><div class="creature-hp"><i style="width:${pct}%"></i></div><small>${fmt(creature.hp)} / ${fmt(creature.maxHp)} HP · ${creature.participants} hunters · your damage ${fmt(creature.contribution)}</small></div><div class="creature-actions">${creature.joined ? `<button class="pixel-btn small gold" data-action="strike-creature">STRIKE</button>` : `<button class="pixel-btn small gold" data-action="join-creature">JOIN HUNT</button>`}</div>`;
  }

  private tickEvent(): void {
    if (this.eventView) {
      const el = document.getElementById("event-countdown");
      if (el) el.textContent = countdown(this.eventView.endsAt - Date.now());
      const panel = document.getElementById("event-panel-countdown");
      if (panel) panel.textContent = countdown(this.eventView.endsAt - Date.now());
    }
  }

  private tickTournament(): void {
    if (!this.tournamentView) return;
    const el = document.getElementById("tourney-countdown");
    if (!el) return;
    const now = Date.now();
    const view = this.tournamentView;
    if (view.phase === "active") el.textContent = countdown(view.endsAt - now);
    else if (view.phase === "idle") el.textContent = countdown(view.startsAt - now);
    else if (view.phase === "results") el.textContent = "FINISHED";
  }

  // ------------------------------------------------------------------ leaderboard
  private renderLeaderboard(): string {
    const tabs = (["biggest", "rarest", "value", "level", "perfect", "mutations", "creatures", "mastery"] as LeaderboardType[])
      .map((type) => `<button class="tab-btn ${this.leaderboardType === type ? "is-active" : ""}" data-action="lb-type" data-type="${type}">${{ biggest: "Biggest Fish", rarest: "Rarest Fish", value: "Total Value", level: "Level", perfect: "Perfect Catches", mutations: "Mutations", creatures: "Giants", mastery: "Mastery" }[type]}</button>`)
      .join("");
    const periods = (["daily", "weekly", "all"] as LeaderboardPeriod[])
      .map((period) => `<button class="tab-btn ${this.leaderboardPeriod === period ? "is-active" : ""}" data-action="lb-period" data-period="${period}">${period[0].toUpperCase()}${period.slice(1)}</button>`)
      .join("");
    let rows = `<div class="empty-state" style="padding:30px">${this.leaderboardLoading ? "Reading the tide charts…" : "No records yet. Be the first name in the tide."}</div>`;
    if (!this.leaderboardLoading && this.leaderboardRows?.length) {
      rows = this.leaderboardRows.map((row) => `<div class="rank-row ${row.rank === 1 ? "top1" : row.rank === 2 ? "top2" : row.rank === 3 ? "top3" : ""}">
        <span class="rank-num">#${row.rank}</span>
        <div><div class="rank-name">${esc(row.username)}${row.isGuest ? `<span class="guest-tag">GUEST</span>` : ""}</div><div class="rank-detail">${esc(row.detail)}</div></div>
        <span class="rank-value">${row.value % 1 === 0 ? fmt(row.value) : row.value.toFixed(2)}<small>${this.leaderboardType === "level" ? "XP" : this.leaderboardType === "biggest" ? "KG" : this.leaderboardType === "rarest" ? "RARITY" : this.leaderboardType === "mutations" ? "MUTATIONS" : this.leaderboardType === "creatures" ? "DAMAGE" : this.leaderboardType === "mastery" ? "MASTERY" : "SCORE"}</small></span>
      </div>`).join("");
    }
    return `<div class="rank-toolbar">${tabs}</div>
      <div class="rank-toolbar">${periods}<button class="tab-btn" data-action="refresh-leaderboard">↻ Refresh</button></div>
      <div class="rank-list">${rows}</div>`;
  }

  // ------------------------------------------------------------------ settings
  private renderSettings(): string {
    const p = this.profile!;
    const appearance = this.appearanceDraft ?? p.appearance;
    const ownedHats = COSMETICS.filter((c) => c.type === "hat" && p.cosmetics.includes(c.id));
    const ownedOutfits = COSMETICS.filter((c) => c.type === "outfit" && p.cosmetics.includes(c.id));
    const swatches = (label: string, field: keyof Appearance, colors: string[]) => `<div class="swatch-group"><span>${label}</span><div class="swatches">${colors.map((color) => `<button class="swatch ${appearance[field] === color ? "is-active" : ""}" style="background:${color}" data-action="swatch" data-field="${field}" data-value="${color}" title="${color}"></button>`).join("")}</div></div>`;
    return `<div class="settings-list">
      <div class="setting-row">
        <div class="setting-copy"><strong>Music volume</strong><span>Gentle procedural tides and melodies.</span></div>
        <input id="music-volume" type="range" min="0" max="1" step="0.05" value="${p.settings.music}" />
      </div>
      <div class="setting-row">
        <div class="setting-copy"><strong>Sound effects</strong><span>Waves, bites, reels, coins and birds.</span></div>
        <input id="sfx-volume" type="range" min="0" max="1" step="0.05" value="${p.settings.sfx}" />
      </div>
      <div class="setting-row">
        <div class="setting-copy"><strong>Graphics quality</strong><span>Lower this if the tide runs slowly.</span></div>
        <select id="quality-select">
          <option value="high" ${p.settings.quality === "high" ? "selected" : ""}>High</option>
          <option value="medium" ${p.settings.quality === "medium" ? "selected" : ""}>Medium</option>
          <option value="low" ${p.settings.quality === "low" ? "selected" : ""}>Low</option>
        </select>
      </div>
      <div class="setting-row">
        <div class="setting-copy"><strong>Show player names</strong><span>Display names above every angler.</span></div>
        <button class="toggle ${p.settings.showNames ? "on" : ""}" data-action="toggle-setting" data-key="showNames"></button>
      </div>
      <div class="setting-row">
        <div class="setting-copy"><strong>Touch controls</strong><span>Show the virtual joystick and action buttons.</span></div>
        <button class="toggle ${p.settings.showJoystick ? "on" : ""}" data-action="toggle-setting" data-key="showJoystick"></button>
      </div>
    </div>
    <div class="section-title">APPEARANCE</div>
    <div class="appearance-grid">
      <div class="character-preview" data-character data-char-width="96" data-char-height="144"></div>
      <div style="display:grid;gap:10px;flex:1;min-width:240px">
        <div class="swatches" style="max-width:none">${swatches("SKIN", "skin", SKIN_SWATCHES)}</div>
        <div class="swatches" style="max-width:none">${swatches("HAIR", "hair", HAIR_SWATCHES)}</div>
        <div class="swatches" style="max-width:none">${swatches("SHIRT", "shirt", SHIRT_SWATCHES)}</div>
        <div class="swatches" style="max-width:none">${swatches("PANTS", "pants", PANTS_SWATCHES)}</div>
      </div>
    </div>
    <div class="section-title">HAIR STYLE</div>
    <div class="panel-tabs">${[0, 1, 2, 3].map((style) => `<button class="tab-btn ${appearance.hairStyle === style ? "is-active" : ""}" data-action="hair" data-style="${style}">Style ${style + 1}</button>`).join("")}</div>
    <div class="section-title">HATS</div>
    <div class="panel-tabs">
      <button class="tab-btn ${appearance.hat === "none" ? "is-active" : ""}" data-action="hat" data-hat="none">None</button>
      ${ownedHats.map((hat) => `<button class="tab-btn ${appearance.hat === hat.value ? "is-active" : ""}" data-action="hat" data-hat="${esc(hat.value)}">${esc(hat.name)}</button>`).join("")}
    </div>
    <div class="section-title">OUTFITS</div>
    <div class="panel-tabs">
      ${ownedOutfits.length
        ? ownedOutfits.map((outfit) => `<button class="tab-btn ${appearance.shirt === outfit.value ? "is-active" : ""}" data-action="equip-outfit" data-value="${esc(outfit.value)}">${esc(outfit.name)}</button>`).join("")
        : `<span class="panel-note">Buy clothing to unlock outfits.</span>`}
    </div>
    <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
      <button class="pixel-btn small gold" data-action="save-appearance">Save Appearance</button>
      <button class="pixel-btn small ghost" data-action="open-shop-clothing">Buy More Clothing</button>
    </div>
    <div class="section-title">ACCOUNT</div>
    <div class="setting-row">
      <div class="setting-copy"><strong>${esc(p.username)}</strong><span>${p.isGuest ? "Guest account · saved on this device's session" : "Registered account"} · Level ${p.level} · ${fmt(p.stats.totalCatches)} catches</span></div>
      <button class="pixel-btn small danger" data-action="logout">Sign Out</button>
    </div>`;
  }

  // ------------------------------------------------------------------ npc
  private renderNpc(): string {
    if (!this.npc) return "";
    return `<div class="detail-modal">
      <div class="detail-art" data-character data-char-width="120" data-char-height="180" style="min-height:200px"></div>
      <div class="detail-copy">
        <h3>${esc(this.npc.name)}</h3>
        <span class="stat-pill">${esc(this.npc.role)}</span>
        <p class="desc" style="margin-top:12px">“${esc(this.npc.dialog)}”</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${this.npc.shop ? `<button class="pixel-btn small gold" data-action="npc-shop" data-shop="${this.npc.shop}">Browse ${this.npc.shop === "boat" ? "Boats" : this.npc.shop[0].toUpperCase() + this.npc.shop.slice(1)}</button>` : ""}
          <button class="pixel-btn small ghost" data-action="close-panel">Leave Conversation</button>
        </div>
      </div>
    </div>`;
  }

  // ------------------------------------------------------------------ interactions
  private bindPanelDelegation(): void {
    const body = $("panel-body");
    body.addEventListener("click", (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>("[data-action]");
      if (!target) return;
      const action = target.dataset.action!;
      this.audio.play("click");
      switch (action) {
        case "inv-tab":
          this.invTab = target.dataset.tab as InvTab;
          this.renderPanel();
          break;
        case "shop-tab":
          this.shopTab = target.dataset.tab as ShopTab;
          this.shopTitle = "Village Shops";
          this.renderPanel();
          break;
        case "fish-detail":
          this.selectedFish = target.dataset.id!;
          this.openPanelName = "fish-detail";
          this.renderPanel();
          break;
        case "panel-collection":
          this.openPanelName = "collection";
          this.renderPanel();
          break;
        case "sell-fish":
          this.network.send("sellFish", { uids: [target.dataset.uid] });
          break;
        case "sell-all":
          this.network.send("sellAll");
          break;
        case "cook-fish":
          this.network.cook(target.dataset.uid!);
          break;
        case "eat-fish":
          this.network.eat(target.dataset.uid!);
          break;
        case "upgrade-inventory":
          this.network.send("buyInventory");
          break;
        case "buy-rod":
          this.network.send("buyRod", { rodId: target.dataset.id });
          break;
        case "equip-rod":
          this.network.send("equipRod", { rodId: target.dataset.id });
          break;
        case "buy-bait":
          this.network.send("buyBait", { baitId: target.dataset.id });
          break;
        case "equip-bait":
          this.network.send("equipBait", { baitId: target.dataset.id });
          break;
        case "buy-cosmetic":
          this.network.send("buyCosmetic", { cosmeticId: target.dataset.id });
          break;
        case "buy-boat":
          this.network.send("buyBoat");
          break;
        case "claim-quest":
          this.network.send("claimQuest", { questId: target.dataset.id });
          break;
        case "claim-achievement":
          this.network.send("claimAchievement", { achievementId: target.dataset.id });
          break;
        case "travel":
          void this.travel(target.dataset.id as LocationId);
          break;
        case "join-room":
          void this.joinRoom(target.dataset.id!);
          break;
        case "refresh-rooms":
          void this.loadRooms(true);
          break;
        case "create-private":
          void this.createPrivate();
          break;
        case "join-code": {
          const input = document.getElementById("private-code") as HTMLInputElement | null;
          const code = (input?.value ?? "").trim().toUpperCase();
          if (code.length < 3) this.toast("Enter a room code first.", "error");
          else void this.joinPrivate(code);
          break;
        }
        case "tournament-join":
          this.network.send("tournamentJoin");
          break;
        case "tournament-leave":
          this.network.send("tournamentLeave");
          break;
        case "refresh-tournament":
          this.network.send("requestTournament");
          break;
        case "lb-type":
          this.leaderboardType = target.dataset.type as LeaderboardType;
          this.leaderboardRows = null;
          void this.loadLeaderboard();
          break;
        case "lb-period":
          this.leaderboardPeriod = target.dataset.period as LeaderboardPeriod;
          this.leaderboardRows = null;
          void this.loadLeaderboard();
          break;
        case "refresh-leaderboard":
          this.leaderboardRows = null;
          void this.loadLeaderboard();
          break;
        case "swatch":
          if (this.appearanceDraft) {
            (this.appearanceDraft as any)[target.dataset.field!] = target.dataset.value!;
            this.renderPanel(true);
          }
          break;
        case "hair":
          if (this.appearanceDraft) {
            this.appearanceDraft.hairStyle = Number(target.dataset.style);
            this.renderPanel(true);
          }
          break;
        case "hat":
          if (this.appearanceDraft) {
            this.appearanceDraft.hat = target.dataset.hat!;
            this.renderPanel(true);
          }
          break;
        case "equip-outfit":
          if (this.appearanceDraft) {
            this.appearanceDraft.shirt = target.dataset.value!;
            this.renderPanel(true);
          }
          break;
        case "save-appearance":
          if (this.appearanceDraft) {
            this.network.send("setAppearance", this.appearanceDraft);
            this.toast("Appearance saved.", "gold");
          }
          break;
        case "open-shop-clothing":
          this.shopTab = "clothing";
          this.shopTitle = "Village Tailor";
          this.openPanel("shop");
          break;
        case "toggle-setting": {
          const key = target.dataset.key as "showNames" | "showJoystick";
          if (!this.profile) break;
          const value = !this.profile.settings[key];
          this.network.send("setSettings", { ...this.profile.settings, [key]: value });
          target.classList.toggle("on", value);
          if (key === "showJoystick") {
            this.profile.settings.showJoystick = value;
            this.updateMobileControls();
          }
          break;
        }
        case "logout":
          bus.emit("logout");
          break;
        case "close-panel":
          this.closePanel();
          break;
        case "npc-shop": {
          const shop = target.dataset.shop as "rods" | "baits" | "clothing" | "boat";
          this.shopTab = shop;
          this.shopTitle = shop === "boat" ? "Harbour Boats" : shop === "clothing" ? "Village Tailor" : shop === "baits" ? "Bait & Tackle" : "Rodmaker's Shop";
          this.openPanel("shop");
          break;
        }
        case "social-tab":
          this.socialTab = target.dataset.tab as SocialTab;
          if (this.socialTab === "friends") this.network.requestFriends();
          if (this.socialTab === "guild") this.network.requestGuild();
          if (this.socialTab === "market") this.network.requestMarket();
          this.renderPanel();
          break;
        case "friend-add": {
          const input = document.getElementById("friend-name") as HTMLInputElement | null;
          if (input?.value.trim()) {
            this.network.friendAdd(input.value.trim());
            input.value = "";
          }
          break;
        }
        case "friend-remove":
          this.network.friendRemove(target.dataset.id!);
          break;
        case "visit-friend":
          this.network.visitHouse(target.dataset.username!);
          this.openPanel("island");
          break;
        case "visit-house": {
          const input = document.getElementById("visit-name") as HTMLInputElement | null;
          if (input?.value.trim()) {
            this.network.visitHouse(input.value.trim());
            input.value = "";
          } else {
            this.toast("Enter an angler name first.", "error");
          }
          break;
        }
        case "guild-create": {
          const name = (document.getElementById("guild-name") as HTMLInputElement | null)?.value ?? "";
          const tag = (document.getElementById("guild-tag") as HTMLInputElement | null)?.value ?? "";
          const description = (document.getElementById("guild-desc") as HTMLInputElement | null)?.value ?? "";
          this.network.guildCreate(name, tag, description);
          break;
        }
        case "guild-join":
          this.network.guildJoin(target.dataset.id!);
          break;
        case "guild-leave":
          this.network.guildLeave();
          break;
        case "market-list": {
          const uid = (document.getElementById("market-fish") as HTMLSelectElement | null)?.value ?? "";
          const price = Number((document.getElementById("market-price") as HTMLInputElement | null)?.value ?? 0);
          if (uid) this.network.marketList(uid, price);
          break;
        }
        case "market-buy":
          this.network.marketBuy(target.dataset.id!);
          break;
        case "market-cancel":
          this.network.marketCancel(target.dataset.id!);
          break;
        case "trade-request":
          this.network.tradeRequest(target.dataset.session!);
          break;
        case "trade-offer": {
          if (!this.trade) break;
          const uids = [...document.querySelectorAll<HTMLInputElement>("[data-trade-uid]:checked")].map((input) => input.dataset.tradeUid!);
          const coins = Number((document.getElementById("trade-coins") as HTMLInputElement | null)?.value ?? 0);
          this.tradeUids = uids;
          this.tradeCoins = coins;
          this.network.tradeOffer(this.trade.id, uids, coins);
          break;
        }
        case "trade-accept":
          if (this.trade) this.network.tradeAccept(this.trade.id);
          break;
        case "trade-cancel":
          if (this.trade) this.network.tradeCancel(this.trade.id);
          break;
        case "buy-paint":
          this.network.buyBoatPaint(target.dataset.id!);
          break;
        case "equip-paint":
          this.network.setBoatColor(target.dataset.id!);
          break;
        case "buy-gear":
          this.network.buyEquipment(target.dataset.id!);
          break;
        case "toggle-sail":
          this.network.toggleSail();
          break;
        case "toggle-dive":
          this.network.toggleDive();
          break;
        case "board-boat":
          this.network.boardBoat(target.dataset.session!);
          break;
        case "leave-boat":
          this.network.leaveBoat();
          break;
        case "aquarium-add":
          this.network.aquariumAdd(target.dataset.uid!);
          break;
        case "aquarium-remove":
          this.network.aquariumRemove(target.dataset.uid!);
          break;
        case "aquarium-feed":
          this.network.aquariumFeed();
          break;
        case "aquarium-theme":
          this.network.aquariumTheme(target.dataset.id!);
          break;
        case "buy-furniture":
          this.network.buyFurniture(target.dataset.id!, 4 + Math.floor(Math.random() * 8), 3 + Math.floor(Math.random() * 6));
          break;
        case "place-furniture":
          if (this.profile) {
            this.network.saveHouse({
              theme: this.profile.house.theme,
              name: this.profile.house.name,
              furniture: [
                ...this.profile.house.furniture,
                {
                  id: `p-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
                  item: target.dataset.id!,
                  x: 2 + Math.floor(Math.random() * 12),
                  y: 2 + Math.floor(Math.random() * 8),
                },
              ],
            });
          }
          break;
        case "house-theme":
          if (this.profile) {
            this.network.saveHouse({
              theme: target.dataset.id!,
              name: this.profile.house.name,
              furniture: this.profile.house.furniture,
            });
          }
          break;
        case "remove-furniture":
          if (this.profile) {
            this.network.saveHouse({
              theme: this.profile.house.theme,
              name: this.profile.house.name,
              furniture: this.profile.house.furniture.filter((entry) => entry.id !== target.dataset.id),
            });
          }
          break;
        case "claim-weekly":
          this.network.claimWeekly(target.dataset.id!);
          break;
        case "secret-accept":
          this.network.secretAccept(target.dataset.id!);
          break;
        case "secret-claim":
          this.network.secretClaim(target.dataset.id!);
          break;
      }
    });

    body.addEventListener("submit", (event) => {
      const target = event.target as HTMLFormElement;
      if (target.id !== "guild-chat-form") return;
      event.preventDefault();
      const input = document.getElementById("guild-chat-input") as HTMLInputElement | null;
      if (input?.value.trim()) {
        this.network.guildChat(input.value.trim());
        input.value = "";
      }
    });

    body.addEventListener("input", (event) => {
      const target = event.target as HTMLInputElement;
      if (target.id === "collection-search") {
        this.collectionSearch = target.value;
        const grid = document.getElementById("collection-grid");
        if (grid) grid.innerHTML = this.renderCollectionGrid();
        this.paintThumbs();
      } else if (target.id === "music-volume") {
        const value = Number(target.value);
        this.audio.setVolumes(value, this.profile?.settings.sfx ?? 0.7);
        this.network.send("setSettings", { ...this.profile?.settings, music: value });
      } else if (target.id === "sfx-volume") {
        const value = Number(target.value);
        this.audio.setVolumes(this.profile?.settings.music ?? 0.45, value);
        this.network.send("setSettings", { ...this.profile?.settings, sfx: value });
      }
    });
    body.addEventListener("change", (event) => {
      const target = event.target as HTMLInputElement | HTMLSelectElement;
      if (target.id === "rarity-filter") {
        this.collectionRarity = target.value;
        const grid = document.getElementById("collection-grid");
        if (grid) grid.innerHTML = this.renderCollectionGrid();
        this.paintThumbs();
      } else if (target.id === "habitat-filter") {
        this.collectionHabitat = target.value;
        const grid = document.getElementById("collection-grid");
        if (grid) grid.innerHTML = this.renderCollectionGrid();
        this.paintThumbs();
      } else if (target.id === "quality-select") {
        this.network.send("setSettings", { ...this.profile?.settings, quality: target.value });
      }
    });
  }

  private bindJoystick(): void {
    const joystick = $("joystick");
    const knob = $("joystick-knob");
    let pointerId = -1;
    const update = (event: PointerEvent) => {
      const rect = joystick.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = event.clientX - cx;
      let dy = event.clientY - cy;
      const max = rect.width * 0.34;
      const mag = Math.hypot(dx, dy);
      if (mag > max) {
        dx = (dx / mag) * max;
        dy = (dy / mag) * max;
      }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      const nx = dx / max;
      const ny = dy / max;
      bus.emit("mobileInput", { dx: Math.abs(nx) > 0.12 ? nx : 0, dy: Math.abs(ny) > 0.12 ? ny : 0 });
    };
    joystick.addEventListener("pointerdown", (event) => {
      pointerId = event.pointerId;
      joystick.setPointerCapture(pointerId);
      update(event);
    });
    joystick.addEventListener("pointermove", (event) => {
      if (event.pointerId === pointerId) update(event);
    });
    const release = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      pointerId = -1;
      knob.style.transform = "translate(-50%, -50%)";
      bus.emit("mobileInput", { dx: 0, dy: 0 });
    };
    joystick.addEventListener("pointerup", release);
    joystick.addEventListener("pointercancel", release);
  }

  private openNpc(npc: NPCDef): void {
    this.npc = npc;
    this.openPanel("npc");
  }

  private async travel(location: LocationId): Promise<void> {
    const def = LOCATIONS_BY_ID[location];
    if (!this.profile || !locationUnlocked(this.profile.level, this.profile.boatOwned, def)) {
      this.toast(`${def.name} is still locked.`, "error");
      return;
    }
    this.closePanel();
    $("loading").classList.remove("is-hidden");
    $("loading-text").textContent = `Sailing to ${def.name}…`;
    try {
      await this.network.travel(location);
      this.toast(`Welcome to ${def.name}.`, "gold");
    } catch (error: any) {
      this.toast(error?.message || "Could not reach those waters.", "error");
    } finally {
      $("loading").classList.add("is-hidden");
    }
  }

  private async loadRooms(force = false): Promise<void> {
    if (this.roomsLoading) return;
    this.roomsLoading = true;
    if (this.openPanelName === "map") this.renderPanel(true);
    try {
      this.rooms = await fetchRooms();
    } catch {
      this.rooms = [];
    } finally {
      this.roomsLoading = false;
      if (this.openPanelName === "map") this.renderPanel(true);
    }
  }

  private async joinRoom(roomId: string): Promise<void> {
    if (roomId === this.roomId) {
      this.toast("You are already in that room.");
      return;
    }
    this.closePanel();
    $("loading").classList.remove("is-hidden");
    $("loading-text").textContent = "Joining the room…";
    try {
      await this.network.joinRoomById(roomId);
    } catch (error: any) {
      this.toast(error?.message || "Could not join that room.", "error");
    } finally {
      $("loading").classList.add("is-hidden");
    }
  }

  private async createPrivate(): Promise<void> {
    const code = Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
    const location = this.profile?.location ?? "sunny-shore";
    this.closePanel();
    $("loading").classList.remove("is-hidden");
    $("loading-text").textContent = `Creating private room ${code}…`;
    try {
      await this.network.travel(location, code);
      this.toast(`Private room created! Code: ${code}`, "gold");
      const shareUrl = `${window.location.origin}/?room=${code}`;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(shareUrl).then(() => {
          this.toast("Invite link copied to clipboard!", "gold");
        }).catch(() => {});
      }
      this.addChat({ id: String(Date.now()), username: "Tide", text: `Private room: ${code} · Share link: ${shareUrl}`, at: Date.now(), system: true });
    } catch (error: any) {
      this.toast(error?.message || "Could not create a private room.", "error");
    } finally {
      $("loading").classList.add("is-hidden");
    }
  }

  private async joinPrivate(code: string): Promise<void> {
    const location = this.profile?.location ?? "sunny-shore";
    this.closePanel();
    $("loading").classList.remove("is-hidden");
    $("loading-text").textContent = `Joining room ${code}…`;
    try {
      await this.network.travel(location, code);
      this.toast(`Joined private room ${code}.`, "gold");
    } catch (error: any) {
      this.toast(error?.message || "Could not join that room code.", "error");
    } finally {
      $("loading").classList.add("is-hidden");
    }
  }

  private async loadLeaderboard(): Promise<void> {
    this.leaderboardLoading = true;
    if (this.openPanelName === "leaderboard") this.renderPanel(true);
    try {
      this.leaderboardRows = await fetchLeaderboard(this.leaderboardType, this.leaderboardPeriod);
    } catch {
      this.leaderboardRows = [];
    } finally {
      this.leaderboardLoading = false;
      if (this.openPanelName === "leaderboard") this.renderPanel(true);
    }
  }

  dispose(): void {
    window.clearInterval(this.tournamentTimer);
    window.clearInterval(this.eventTimer);
    window.clearInterval(this.fireTimer);
    cancelAnimationFrame(this.mgRaf);
    this.audio.dispose();
  }
}
