import { MapSchema, Schema, type } from "@colyseus/schema";

export class PlayerState extends Schema {
  @type("string") id = "";
  @type("string") username = "";
  @type("number") x = 0;
  @type("number") y = 0;
  @type("string") dir = "down";
  @type("boolean") moving = false;
  @type("boolean") running = false;
  @type("string") fishingState = "idle";
  @type("number") castX = 0;
  @type("number") castY = 0;
  @type("string") rod = "wooden";
  @type("number") level = 1;
  @type("string") appearance = "{}";
  @type("boolean") connected = true;
  @type("number") perfectCatches = 0;
  @type("number") energy = 100;
  @type("string") activity = "idle";
  @type("boolean") sailing = false;
  @type("boolean") diving = false;
  @type("string") boatColor = "tide-blue";
  @type("string") passengerOf = "";
  @type("string") guildTag = "";
}

export class WorldState extends Schema {
  @type("string") location = "sunny-shore";
  @type("string") weather = "sunny";
  @type("number") timeMinutes = 480;
  @type("number") serverTime = 0;
  @type("string") tournamentPhase = "idle";
  @type("number") tournamentEndsAt = 0;
  @type("number") tournamentStartsAt = 0;
  @type("number") tournamentEntries = 0;
  @type("string") eventId = "";
  @type("string") eventName = "";
  @type("number") eventStartedAt = 0;
  @type("number") eventEndsAt = 0;
  @type("boolean") creatureActive = false;
  @type("string") creatureId = "";
  @type("string") creatureName = "";
  @type("string") creatureKind = "";
  @type("number") creatureX = 0;
  @type("number") creatureY = 0;
  @type("number") creatureHp = 0;
  @type("number") creatureMaxHp = 0;
  @type("number") creatureEndsAt = 0;
  @type("boolean") partyActive = false;
  @type("number") partyCount = 0;
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
}
