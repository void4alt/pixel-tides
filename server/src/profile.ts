import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { Appearance, PlayerProfile } from "../../shared/types";
import { createAchievementProgress, ensureDaily, ensureWeekly, levelFromXp } from "../../shared/quests";
import { store, type StoredUser } from "./db";

const SKINS = ["#f2c8a0", "#d99a6c", "#a96b4a", "#7a4a33", "#f6d7b8", "#c9895f"];
const HAIRS = ["#2f2a2a", "#6b432a", "#d8b26a", "#b45b3e", "#e8e1cf", "#4c3a72", "#8a3b52"];
const SHIRTS = ["#e66b5a", "#4d8fc9", "#58a77a", "#d8a04a", "#8b6ac9", "#e6e1d3", "#c95a8a"];
const PANTS = ["#3d4f66", "#5b4636", "#425c42", "#6b3d4f", "#34363f", "#7a6a4e"];

export const GUEST_ADJECTIVES = ["Salty", "Calm", "Tidal", "Sunny", "Lucky", "Misty", "Coral", "Breezy", "Moonlit", "Drifting"];
export const GUEST_NOUNS = ["Otter", "Gull", "Angler", "Puffer", "Heron", "Seal", "Koi", "Minnow", "Wave", "Reef"];

export function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export function randomAppearance(): Appearance {
  return {
    skin: pick(SKINS),
    hair: pick(HAIRS),
    shirt: pick(SHIRTS),
    pants: pick(PANTS),
    hat: "none",
    hairStyle: Math.floor(Math.random() * 4),
  };
}

export function createProfile(user: StoredUser): PlayerProfile {
  const now = Date.now();
  const profile: PlayerProfile = {
    id: user.id,
    username: user.username,
    isGuest: !!user.isGuest,
    coins: 150,
    xp: 0,
    level: 1,
    skillXp: 0,
    skillLevel: 1,
    energy: 100,
    maxEnergy: 100,
    location: "sunny-shore",
    appearance: randomAppearance(),
    rods: ["wooden"],
    equippedRod: "wooden",
    baits: { worm: 20 },
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
    achievements: createAchievementProgress(),
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
    settings: { music: 0.45, sfx: 0.7, quality: "high", showNames: true, showJoystick: false },
    createdAt: now,
    updatedAt: now,
  };
  ensureDaily(profile);
  ensureWeekly(profile);
  return profile;
}

export function normalizeProfile(profile: PlayerProfile): PlayerProfile {
  profile.coins = Math.max(0, Math.floor(profile.coins || 0));
  profile.xp = Math.max(0, Math.floor(profile.xp || 0));
  profile.level = Math.max(profile.level || 1, levelFromXp(profile.xp));
  profile.skillLevel = Math.max(1, Math.min(50, profile.skillLevel || 1));
  profile.maxEnergy = Math.max(50, Math.min(200, profile.maxEnergy || 100));
  profile.energy = Math.max(0, Math.min(profile.maxEnergy, profile.energy ?? profile.maxEnergy));
  profile.inventorySlots = Math.max(24, profile.inventorySlots || 24);
  profile.rods = Array.isArray(profile.rods) && profile.rods.length ? profile.rods : ["wooden"];
  if (!profile.rods.includes(profile.equippedRod)) profile.equippedRod = profile.rods[0];
  profile.baits = profile.baits && typeof profile.baits === "object" ? profile.baits : { worm: 0 };
  profile.inventory = Array.isArray(profile.inventory) ? profile.inventory : [];
  profile.collection = profile.collection && typeof profile.collection === "object" ? profile.collection : {};
  profile.cosmetics = Array.isArray(profile.cosmetics) ? profile.cosmetics : [];
  profile.boatColor = typeof profile.boatColor === "string" ? profile.boatColor : "tide-blue";
  profile.boatPaints = Array.isArray(profile.boatPaints) ? profile.boatPaints.map(String) : ["tide-blue"];
  if (!profile.boatPaints.includes("tide-blue")) profile.boatPaints.unshift("tide-blue");
  profile.diveGear = !!profile.diveGear;
  profile.equipment = Array.isArray(profile.equipment) ? profile.equipment : [];
  profile.mastery = profile.mastery && typeof profile.mastery === "object" ? profile.mastery : {};
  profile.materials = profile.materials && typeof profile.materials === "object" ? profile.materials : {};
  profile.buffs = Array.isArray(profile.buffs) ? profile.buffs.filter((buff) => buff && typeof buff.id === "string") : [];
  profile.trophies = Array.isArray(profile.trophies) ? profile.trophies.slice(0, 12) : [];
  profile.guildId = typeof profile.guildId === "string" ? profile.guildId : "";
  profile.friends = Array.isArray(profile.friends) ? profile.friends.slice(0, 60) : [];
  profile.secretQuests = Array.isArray(profile.secretQuests) ? profile.secretQuests : [];
  if (!profile.aquarium || typeof profile.aquarium !== "object") {
    profile.aquarium = { slots: 6, theme: "reef", fish: [], fedAt: 0, food: 0 };
  }
  profile.aquarium.slots = Math.max(4, Math.min(18, Math.floor(profile.aquarium.slots || 6)));
  profile.aquarium.theme = typeof profile.aquarium.theme === "string" ? profile.aquarium.theme : "reef";
  profile.aquarium.fish = Array.isArray(profile.aquarium.fish) ? profile.aquarium.fish.slice(0, profile.aquarium.slots) : [];
  profile.aquarium.food = Math.max(0, Math.floor(profile.aquarium.food || 0));
  if (!profile.house || typeof profile.house !== "object") {
    profile.house = { theme: "driftwood", furniture: [], visits: 0, name: "My Island" };
  }
  profile.house.theme = typeof profile.house.theme === "string" ? profile.house.theme : "driftwood";
  profile.house.name = typeof profile.house.name === "string" ? profile.house.name.slice(0, 24) : "My Island";
  profile.house.furniture = Array.isArray(profile.house.furniture) ? profile.house.furniture.slice(0, 60) : [];
  profile.house.visits = Math.max(0, Math.floor(profile.house.visits || 0));
  if (!profile.furniture || typeof profile.furniture !== "object") {
    profile.furniture = {};
  }
  const placedCounts: Record<string, number> = {};
  for (const placement of profile.house.furniture) {
    placedCounts[placement.item] = (placedCounts[placement.item] ?? 0) + 1;
  }
  for (const [item, count] of Object.entries(placedCounts)) {
    profile.furniture[item] = Math.max(profile.furniture[item] ?? 0, count);
  }
  if (!profile.weekly || typeof profile.weekly !== "object") profile.weekly = { week: "", quests: [] };
  profile.stats = {
    ...({
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
    } as PlayerProfile["stats"]),
    ...(profile.stats ?? {}),
  };
  if (!profile.settings) {
    profile.settings = { music: 0.45, sfx: 0.7, quality: "high", showNames: true, showJoystick: false };
  }
  if (!profile.appearance) profile.appearance = randomAppearance();
  if (!profile.achievements || !profile.achievements.length) profile.achievements = createAchievementProgress();
  ensureDaily(profile);
  ensureWeekly(profile);
  return profile;
}

export function addXp(profile: PlayerProfile, amount: number): { leveledUp: boolean; levels: number } {
  const before = profile.level;
  profile.xp += Math.max(0, Math.round(amount));
  profile.level = Math.max(profile.level, levelFromXp(profile.xp));
  profile.skillXp += Math.max(0, Math.round(amount * 0.6));
  profile.skillLevel = Math.max(1, Math.min(50, 1 + Math.floor(profile.stats.totalCatches / 12)));
  return { leveledUp: profile.level > before, levels: profile.level - before };
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  try {
    const expected = Buffer.from(hash, "hex");
    const actual = scryptSync(password, salt, 64);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function makeToken(): string {
  return randomBytes(32).toString("hex");
}

export function sanitizeUsername(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, 18);
}

export function validateUsername(value: string): string | null {
  if (!value) return "Please choose a name.";
  if (value.length < 2 || value.length > 18) return "Name must be 2-18 characters.";
  if (!/^[a-zA-Z0-9_\- ]+$/.test(value)) return "Letters, numbers, spaces, _ and - only.";
  return null;
}

export async function uniqueGuestName(): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const name = `${pick(GUEST_ADJECTIVES)}${pick(GUEST_NOUNS)}${Math.floor(10 + Math.random() * 90)}`;
    const existing = await store.findUserByUsername(name);
    if (!existing) return name;
  }
  return `Angler${randomBytes(3).toString("hex")}`;
}

export function publicUser(user: StoredUser): { id: string; username: string; isGuest: boolean; createdAt: number } {
  return { id: user.id, username: user.username, isGuest: !!user.isGuest, createdAt: user.createdAt };
}
