import { Client, type Room } from "colyseus.js";
import type { LocationId } from "@shared/types";
import { bus } from "./bus";

export interface NetPlayer {
  id: string;
  username: string;
  x: number;
  y: number;
  dir: string;
  moving: boolean;
  running: boolean;
  fishingState: string;
  castX: number;
  castY: number;
  rod: string;
  level: number;
  appearance: string;
  connected: boolean;
  perfectCatches: number;
  energy: number;
  activity: string;
  sailing: boolean;
  diving: boolean;
  boatColor: string;
  passengerOf: string;
  guildTag: string;
}

export interface NetState {
  location: LocationId;
  weather: string;
  timeMinutes: number;
  serverTime: number;
  tournamentPhase: string;
  tournamentEndsAt: number;
  tournamentStartsAt: number;
  tournamentEntries: number;
  eventId: string;
  eventName: string;
  eventStartedAt: number;
  eventEndsAt: number;
  creatureActive: boolean;
  creatureId: string;
  creatureName: string;
  creatureKind: string;
  creatureX: number;
  creatureY: number;
  creatureHp: number;
  creatureMaxHp: number;
  creatureEndsAt: number;
  partyActive: boolean;
  partyCount: number;
  players: Map<string, NetPlayer> | { forEach: (cb: (player: NetPlayer, key: string) => void) => void };
}

const SERVER_URL = (import.meta as any).env?.VITE_SERVER_URL
  || ((import.meta as any).env?.DEV ? "http://localhost:2567" : window.location.origin);

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class NetworkManager {
  private client = new Client(SERVER_URL);
  private room: Room<NetState> | null = null;
  private token = "";
  private currentLocation: LocationId = "sunny-shore";
  private currentCode = "";
  private leaving = false;
  private reconnecting = false;
  private state: NetState | null = null;

  get sessionId(): string {
    return this.room?.sessionId ?? "";
  }

  get location(): LocationId {
    return this.currentLocation;
  }

  getState(): NetState | null {
    return this.state;
  }

  async connect(token: string, location: LocationId, code = ""): Promise<void> {
    this.token = token;
    this.currentLocation = location;
    this.currentCode = code;
    this.leaving = false;
    const room = code
      ? await this.client.joinOrCreate<NetState>("world", { token, location, code })
      : await this.client.joinOrCreate<NetState>("world", { token, location, code: "" });
    this.attach(room);
  }

  private attach(room: Room<NetState>): void {
    this.room = room;
    this.reconnecting = false;
    this.bindRoom(room);
    bus.emit("connected", { roomId: room.roomId, sessionId: room.sessionId });
  }

  private bindRoom(room: Room<NetState>): void {
    room.onStateChange((state) => {
      if (this.room !== room) return;
      this.state = state;
      bus.emit("state", state);
    });
    room.onMessage("profile", (profile) => bus.emit("profile", profile));
    room.onMessage("environment", (environment) => bus.emit("environment", environment));
    room.onMessage("chat", (message) => bus.emit("chat", message));
    room.onMessage("system", (message) => bus.emit("system", message));
    room.onMessage("presence", (presence) => bus.emit("presence", presence));
    room.onMessage("presenceList", (presence) => bus.emit("presenceList", presence));
    room.onMessage("catch", (event) => bus.emit("catch", event));
    room.onMessage("sale", (event) => bus.emit("sale", event));
    room.onMessage("bite", (event) => bus.emit("bite", event));
    room.onMessage("fishing", (event) => bus.emit("fishing", event));
    room.onMessage("minigameStart", (event) => bus.emit("minigameStart", event));
    room.onMessage("mg", (event) => bus.emit("mg", event));
    room.onMessage("minigameEnd", (event) => bus.emit("minigameEnd", event));
    room.onMessage("error", (event) => bus.emit("error", event));
    room.onMessage("purchase", (event) => bus.emit("purchase", event));
    room.onMessage("sold", (event) => bus.emit("sold", event));
    room.onMessage("questClaimed", (event) => bus.emit("questClaimed", event));
    room.onMessage("achievement", (event) => bus.emit("achievement", event));
    room.onMessage("achievementClaimed", (event) => bus.emit("achievementClaimed", event));
    room.onMessage("levelUp", (event) => bus.emit("levelUp", event));
    room.onMessage("tournament", (event) => bus.emit("tournament", event));
    room.onMessage("tournamentResult", (event) => bus.emit("tournamentResult", event));
    room.onMessage("weather", (event) => bus.emit("weather", event));
    room.onMessage("cooked", (event) => bus.emit("cooked", event));
    room.onMessage("ate", (event) => bus.emit("ate", event));
    room.onMessage("events", (event) => bus.emit("events", event));
    room.onMessage("event", (event) => bus.emit("event", event));
    room.onMessage("eventEnd", (event) => bus.emit("eventEnd", event));
    room.onMessage("eventReward", (event) => bus.emit("eventReward", event));
    room.onMessage("creature", (event) => bus.emit("creature", event));
    room.onMessage("creatureHit", (event) => bus.emit("creatureHit", event));
    room.onMessage("creatureResult", (event) => bus.emit("creatureResult", event));
    room.onMessage("treasure", (event) => bus.emit("treasure", event));
    room.onMessage("treasures", (event) => bus.emit("treasures", event));
    room.onMessage("treasureCollected", (event) => bus.emit("treasureCollected", event));
    room.onMessage("sailing", (event) => bus.emit("sailing", event));
    room.onMessage("aboard", (event) => bus.emit("aboard", event));
    room.onMessage("diving", (event) => bus.emit("diving", event));
    room.onMessage("party", (event) => bus.emit("party", event));
    room.onMessage("emote", (event) => bus.emit("emote", event));
    room.onMessage("friends", (event) => bus.emit("friends", event));
    room.onMessage("guild", (event) => bus.emit("guild", event));
    room.onMessage("guildChat", (event) => bus.emit("guildChat", event));
    room.onMessage("market", (event) => bus.emit("market", event));
    room.onMessage("trade", (event) => bus.emit("trade", event));
    room.onMessage("tradeEnd", (event) => bus.emit("tradeEnd", event));
    room.onMessage("houseSaved", (event) => bus.emit("houseSaved", event));
    room.onMessage("houseVisit", (event) => bus.emit("houseVisit", event));
    room.onMessage("aquarium", (event) => bus.emit("aquarium", event));
    room.onMessage("aquariumFed", (event) => bus.emit("aquariumFed", event));
    room.onMessage("feast", (event) => bus.emit("feast", event));
    room.onMessage("secretClaimed", (event) => bus.emit("secretClaimed", event));

    room.onLeave((code) => {
      if (this.room !== room || this.leaving) return;
      bus.emit("disconnected", { code });
      if (code === 1000) return;
      void this.tryReconnect(room);
    });
    room.onError((code, message) => {
      bus.emit("roomError", { code, message });
    });
  }

  private async tryReconnect(previous: Room<NetState>): Promise<void> {
    if (this.reconnecting) return;
    this.reconnecting = true;
    bus.emit("reconnecting");
    for (let attempt = 0; attempt < 8; attempt++) {
      await delay(1200 + attempt * 400);
      try {
        const room = await this.client.reconnect<NetState>(previous.reconnectionToken);
        this.attach(room);
        bus.emit("reconnected");
        return;
      } catch {
        // try again
      }
    }
    this.reconnecting = false;
    bus.emit("connectionLost");
  }

  send(type: string, payload?: unknown): void {
    this.room?.send(type, payload);
  }

  setInput(dx: number, dy: number, running: boolean): void {
    this.send("input", { dx, dy, running });
  }

  cast(x: number, y: number): void {
    this.send("cast", { x, y });
  }

  hook(): void {
    this.send("hook");
  }

  setReel(reeling: boolean): void {
    this.send("reel", { reeling });
  }

  cancelFishing(): void {
    this.send("cancel");
  }

  cook(uid: string): void {
    this.send("cook", { uid });
  }

  eat(uid: string): void {
    this.send("eat", { uid });
  }

  eatBest(): void {
    this.send("eatBest");
  }

  toggleSail(): void {
    this.send("toggleSail");
  }

  setBoatColor(paintId: string): void {
    this.send("setBoatColor", { paintId });
  }

  buyBoatPaint(paintId: string): void {
    this.send("buyBoatPaint", { paintId });
  }

  boardBoat(sessionId: string): void {
    this.send("boardBoat", { sessionId });
  }

  leaveBoat(): void {
    this.send("leaveBoat");
  }

  buyEquipment(itemId: string): void {
    this.send("buyEquipment", { itemId });
  }

  toggleDive(): void {
    this.send("toggleDive");
  }

  collectTreasure(id: string): void {
    this.send("collectTreasure", { id });
  }

  joinCreature(): void {
    this.send("joinCreature");
  }

  strikeCreature(): void {
    this.send("strikeCreature");
  }

  requestEvents(): void {
    this.send("requestEvents");
  }

  saveHouse(house: { theme: string; name: string; furniture: Array<{ id: string; item: string; x: number; y: number }> }): void {
    this.send("saveHouse", house);
  }

  buyFurniture(itemId: string, x: number, y: number): void {
    this.send("buyFurniture", { itemId, x, y });
  }

  aquariumAdd(uid: string): void {
    this.send("aquariumAdd", { uid });
  }

  aquariumRemove(uid: string): void {
    this.send("aquariumRemove", { uid });
  }

  aquariumFeed(): void {
    this.send("aquariumFeed");
  }

  aquariumTheme(themeId: string): void {
    this.send("aquariumTheme", { themeId });
  }

  visitHouse(username: string): void {
    this.send("visitHouse", { username });
  }

  emote(emote: string): void {
    this.send("emote", { emote });
  }

  friendAdd(username: string): void {
    this.send("friendAdd", { username });
  }

  friendRemove(id: string): void {
    this.send("friendRemove", { id });
  }

  requestFriends(): void {
    this.send("requestFriends");
  }

  guildCreate(name: string, tag: string, description: string): void {
    this.send("guildCreate", { name, tag, description });
  }

  guildJoin(guildId: string): void {
    this.send("guildJoin", { guildId });
  }

  guildLeave(): void {
    this.send("guildLeave");
  }

  requestGuild(): void {
    this.send("requestGuild");
  }

  guildChat(text: string): void {
    this.send("guildChat", { text });
  }

  marketList(uid: string, price: number): void {
    this.send("marketList", { uid, price });
  }

  marketBuy(id: string): void {
    this.send("marketBuy", { id });
  }

  marketCancel(id: string): void {
    this.send("marketCancel", { id });
  }

  requestMarket(): void {
    this.send("requestMarket");
  }

  tradeRequest(sessionId: string): void {
    this.send("tradeRequest", { sessionId });
  }

  tradeOffer(tradeId: string, uids: string[], coins: number): void {
    this.send("tradeOffer", { tradeId, uids, coins });
  }

  tradeAccept(tradeId: string): void {
    this.send("tradeAccept", { tradeId });
  }

  tradeCancel(tradeId: string): void {
    this.send("tradeCancel", { tradeId });
  }

  claimWeekly(questId: string): void {
    this.send("claimWeekly", { questId });
  }

  secretAccept(id: string): void {
    this.send("secretAccept", { id });
  }

  secretClaim(id: string): void {
    this.send("secretClaim", { id });
  }

  cookFeast(): void {
    this.send("cookFeast");
  }

  async travel(location: LocationId, code = ""): Promise<void> {
    this.leaving = true;
    try {
      await this.room?.leave(true);
    } catch {}
    this.room = null;
    this.state = null;
    this.currentLocation = location;
    this.currentCode = code;
    this.leaving = false;
    await this.connect(this.token, location, code);
  }

  async joinRoomById(roomId: string): Promise<void> {
    this.leaving = true;
    try {
      await this.room?.leave(true);
    } catch {}
    this.room = null;
    this.state = null;
    this.leaving = false;
    const room = await this.client.joinById<NetState>(roomId, { token: this.token });
    this.attach(room);
  }

  async disconnect(): Promise<void> {
    this.leaving = true;
    try {
      await this.room?.leave(true);
    } catch {}
    this.room = null;
    this.state = null;
  }
}
