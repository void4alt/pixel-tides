import type { AchievementProgress, LocationId, PlayerProfile, QuestProgress, Rarity } from "./types";

export interface QuestTemplate {
  id: string;
  title: string;
  description: string;
  type: QuestProgress["type"];
  target: number;
  rewardCoins: number;
  rewardXp: number;
  rarity?: Rarity;
  location?: LocationId;
}

const QUEST_TEMPLATES: QuestTemplate[] = [
  { id: "catch-5", title: "Tide Trio", description: "Catch 5 fish anywhere in the Pixel Tides.", type: "catch_count", target: 5, rewardCoins: 120, rewardXp: 60 },
  { id: "catch-12", title: "A Good Haul", description: "Catch 12 fish today.", type: "catch_count", target: 12, rewardCoins: 320, rewardXp: 150 },
  { id: "uncommon-3", title: "A Splash of Colour", description: "Catch 3 uncommon or better fish.", type: "catch_rarity", target: 3, rarity: "uncommon", rewardCoins: 240, rewardXp: 110 },
  { id: "rare-2", title: "Rare Company", description: "Catch 2 rare or better fish.", type: "catch_rarity", target: 2, rarity: "rare", rewardCoins: 520, rewardXp: 240 },
  { id: "epic-1", title: "The Deep Calls", description: "Catch an epic or better fish.", type: "catch_rarity", target: 1, rarity: "epic", rewardCoins: 800, rewardXp: 360 },
  { id: "discover-5", title: "Field Notes", description: "Discover 5 different fish species today.", type: "discover", target: 5, rewardCoins: 300, rewardXp: 140 },
  { id: "weight-5", title: "Heavyweight", description: "Catch a fish weighing at least 5 kg.", type: "weight", target: 5, rewardCoins: 360, rewardXp: 170 },
  { id: "weight-15", title: "Sea Monster", description: "Catch a fish weighing at least 15 kg.", type: "weight", target: 15, rewardCoins: 950, rewardXp: 420 },
  { id: "perfect-3", title: "Perfect Timing", description: "Land 3 perfect catches.", type: "perfect", target: 3, rewardCoins: 420, rewardXp: 200 },
  { id: "location-coral", title: "Reef Regular", description: "Catch 4 fish in Coral Bay.", type: "location", target: 4, rewardCoins: 400, rewardXp: 180, location: "coral-bay" },
  { id: "location-frost", title: "Cold Blooded", description: "Catch 4 fish in Frostbite Lake.", type: "location", target: 4, rewardCoins: 450, rewardXp: 200, location: "frostbite-lake" },
  { id: "location-mystic", title: "River Whispers", description: "Catch 4 fish in the Mystic Forest River.", type: "location", target: 4, rewardCoins: 500, rewardXp: 230, location: "mystic-river" },
  { id: "location-deep", title: "Into the Abyss", description: "Catch 3 fish in the Deep Ocean.", type: "location", target: 3, rewardCoins: 900, rewardXp: 400, location: "deep-ocean" },
  { id: "common-8", title: "Bread and Butter", description: "Catch 8 common fish.", type: "catch_rarity", target: 8, rarity: "common", rewardCoins: 180, rewardXp: 90 },
];

const WEEKLY_TEMPLATES: QuestTemplate[] = [
  { id: "weekly-catch-40", title: "A Week of Tides", description: "Catch 40 fish this week.", type: "catch_count", target: 40, rewardCoins: 1800, rewardXp: 900 },
  { id: "weekly-epic-4", title: "Deep Colours", description: "Catch 4 epic or better fish this week.", type: "catch_rarity", target: 4, rarity: "epic", rewardCoins: 2400, rewardXp: 1100 },
  { id: "weekly-discover-12", title: "Cartographer of Fish", description: "Discover 12 species this week.", type: "discover", target: 12, rewardCoins: 2000, rewardXp: 950 },
  { id: "weekly-weight-25", title: "The Big Ones", description: "Catch a fish weighing at least 25 kg.", type: "weight", target: 25, rewardCoins: 2600, rewardXp: 1200 },
  { id: "weekly-perfect-12", title: "Steady Hands", description: "Land 12 perfect catches this week.", type: "perfect", target: 12, rewardCoins: 2200, rewardXp: 1000 },
  { id: "weekly-mutation-2", title: "Strange Scales", description: "Catch 2 mutated fish this week.", type: "mutation", target: 2, rewardCoins: 3000, rewardXp: 1400 },
  { id: "weekly-treasure-5", title: "What the Tide Hid", description: "Recover 5 sunken treasures this week.", type: "treasure", target: 5, rewardCoins: 2500, rewardXp: 1100 },
  { id: "weekly-giant-1", title: "Giant of the Deep", description: "Help defeat a giant sea creature this week.", type: "giant", target: 1, rewardCoins: 4000, rewardXp: 1800 },
];

function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function todayKey(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

export function createDailyQuests(userId: string, level: number, date = todayKey()): QuestProgress[] {
  const h = hash(`${userId}:${date}`);
  const count = level >= 8 ? 4 : 3;
  const selected: QuestTemplate[] = [];
  let cursor = h;
  while (selected.length < count) {
    const template = QUEST_TEMPLATES[cursor % QUEST_TEMPLATES.length];
    if (!selected.some((q) => q.id === template.id)) selected.push(template);
    cursor = Math.imul(cursor ^ (cursor >>> 7), 2246822519) >>> 0;
    if (cursor === h) break;
  }
  return selected.map((template) => ({
    id: template.id,
    title: template.title,
    description: template.description,
    type: template.type,
    target: template.target,
    progress: 0,
    rewardCoins: template.rewardCoins,
    rewardXp: template.rewardXp,
    claimed: false,
    rarity: template.rarity,
    location: template.location,
  }));
}

export function ensureDaily(profile: PlayerProfile): void {
  const date = todayKey();
  if (!profile.daily || profile.daily.date !== date) {
    profile.daily = { date, quests: createDailyQuests(profile.id, profile.level, date) };
  }
}

export function weekKey(now = Date.now()): string {
  const date = new Date(now);
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function createWeeklyQuests(userId: string, level: number, week = weekKey()): QuestProgress[] {
  const h = hash(`${userId}:${week}:weekly`);
  const count = level >= 12 ? 4 : 3;
  const selected: QuestTemplate[] = [];
  let cursor = h;
  while (selected.length < count) {
    const template = WEEKLY_TEMPLATES[cursor % WEEKLY_TEMPLATES.length];
    if (!selected.some((q) => q.id === template.id)) selected.push(template);
    cursor = Math.imul(cursor ^ (cursor >>> 7), 2246822519) >>> 0;
    if (cursor === h) break;
  }
  return selected.map((template) => ({
    id: template.id,
    title: template.title,
    description: template.description,
    type: template.type,
    target: template.target,
    progress: 0,
    rewardCoins: template.rewardCoins,
    rewardXp: template.rewardXp,
    claimed: false,
    rarity: template.rarity,
    location: template.location,
  }));
}

export function ensureWeekly(profile: PlayerProfile): void {
  const week = weekKey();
  if (!profile.weekly || profile.weekly.week !== week) {
    profile.weekly = { week, quests: createWeeklyQuests(profile.id, profile.level, week) };
  }
}

export interface CatchForQuest {
  rarity: Rarity;
  weight: number;
  location: string;
  perfect: boolean;
  isNew: boolean;
  mutation?: boolean;
}

const RARITY_INDEX: Record<Rarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
  mythical: 5,
  secret: 6,
};

function applyQuestList(quests: QuestProgress[], catchInfo: CatchForQuest): void {
  for (const quest of quests) {
    if (quest.claimed) continue;
    switch (quest.type) {
      case "catch_count":
        quest.progress = Math.min(quest.target, quest.progress + 1);
        break;
      case "catch_rarity":
        if (RARITY_INDEX[catchInfo.rarity] >= RARITY_INDEX[quest.rarity ?? "common"]) {
          quest.progress = Math.min(quest.target, quest.progress + 1);
        }
        break;
      case "discover":
        if (catchInfo.isNew) quest.progress = Math.min(quest.target, quest.progress + 1);
        break;
      case "weight":
        if (catchInfo.weight >= quest.target) quest.progress = quest.target;
        break;
      case "perfect":
        if (catchInfo.perfect) quest.progress = Math.min(quest.target, quest.progress + 1);
        break;
      case "location":
        if (catchInfo.location === quest.location) {
          quest.progress = Math.min(quest.target, quest.progress + 1);
        }
        break;
      case "mutation":
        if (catchInfo.mutation) quest.progress = Math.min(quest.target, quest.progress + 1);
        break;
    }
  }
}

export function applyCatchToQuests(profile: PlayerProfile, catchInfo: CatchForQuest): void {
  ensureDaily(profile);
  ensureWeekly(profile);
  applyQuestList(profile.daily.quests, catchInfo);
  applyQuestList(profile.weekly.quests, catchInfo);
}

export function applyTreasureToQuests(profile: PlayerProfile, count = 1): void {
  ensureDaily(profile);
  ensureWeekly(profile);
  for (const list of [profile.daily.quests, profile.weekly.quests]) {
    for (const quest of list) {
      if (quest.claimed || quest.type !== "treasure") continue;
      quest.progress = Math.min(quest.target, quest.progress + count);
    }
  }
}

export function applyGiantToQuests(profile: PlayerProfile, count = 1): void {
  ensureDaily(profile);
  ensureWeekly(profile);
  for (const list of [profile.daily.quests, profile.weekly.quests]) {
    for (const quest of list) {
      if (quest.claimed || quest.type !== "giant") continue;
      quest.progress = Math.min(quest.target, quest.progress + count);
    }
  }
}

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  target: number;
  rewardCoins: number;
  metric: "totalCatches" | "biggestWeight" | "rarestRank" | "perfectCatches" | "fishSold" | "tournamentsWon" | "speciesDiscovered" | "totalValue" | "level" | "giantCatches" | "treasuresFound" | "mutationsFound" | "beachParties" | "eventsWon";
}

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  { id: "first-cast", title: "First Ripple", description: "Catch your very first fish.", target: 1, rewardCoins: 50, metric: "totalCatches" },
  { id: "angler-25", title: "Village Angler", description: "Catch 25 fish.", target: 25, rewardCoins: 300, metric: "totalCatches" },
  { id: "angler-100", title: "Tide Veteran", description: "Catch 100 fish.", target: 100, rewardCoins: 1200, metric: "totalCatches" },
  { id: "angler-500", title: "Legend of the Shore", description: "Catch 500 fish.", target: 500, rewardCoins: 8000, metric: "totalCatches" },
  { id: "heavy-10", title: "Ten-Kilo Tussle", description: "Catch a fish weighing at least 10 kg.", target: 10, rewardCoins: 600, metric: "biggestWeight" },
  { id: "heavy-50", title: "Leviathan Hunter", description: "Catch a fish weighing at least 50 kg.", target: 50, rewardCoins: 3000, metric: "biggestWeight" },
  { id: "rare-find", title: "Something Rare", description: "Discover a rare fish.", target: 3, rewardCoins: 400, metric: "rarestRank" },
  { id: "legend-find", title: "Living Legend", description: "Catch a legendary fish.", target: 5, rewardCoins: 2500, metric: "rarestRank" },
  { id: "myth-find", title: "Myth Made Real", description: "Catch a mythical fish.", target: 6, rewardCoins: 10000, metric: "rarestRank" },
  { id: "perfect-10", title: "Steady Hands", description: "Land 10 perfect catches.", target: 10, rewardCoins: 800, metric: "perfectCatches" },
  { id: "perfect-100", title: "Reel Master", description: "Land 100 perfect catches.", target: 100, rewardCoins: 6000, metric: "perfectCatches" },
  { id: "collector-10", title: "Curious Collector", description: "Discover 10 species.", target: 10, rewardCoins: 500, metric: "speciesDiscovered" },
  { id: "collector-50", title: "Encyclopedia Angler", description: "Discover 50 species.", target: 50, rewardCoins: 4000, metric: "speciesDiscovered" },
  { id: "collector-100", title: "Tide Scholar", description: "Discover 100 species.", target: 100, rewardCoins: 15000, metric: "speciesDiscovered" },
  { id: "merchant-1k", title: "First Fortune", description: "Earn 1,000 coins selling fish.", target: 1000, rewardCoins: 250, metric: "totalValue" },
  { id: "merchant-50k", title: "Fishmonger", description: "Earn 50,000 coins selling fish.", target: 50000, rewardCoins: 5000, metric: "totalValue" },
  { id: "tourney-win", title: "Champion of the Tides", description: "Win a fishing tournament.", target: 1, rewardCoins: 5000, metric: "tournamentsWon" },
  { id: "level-20", title: "Ocean Wanderer", description: "Reach level 20.", target: 20, rewardCoins: 2000, metric: "level" },
  { id: "giant-1", title: "Titan Tamer", description: "Help defeat a giant sea creature.", target: 1, rewardCoins: 1500, metric: "giantCatches" },
  { id: "giant-10", title: "Leviathan Legend", description: "Help defeat 10 giant sea creatures.", target: 10, rewardCoins: 8000, metric: "giantCatches" },
  { id: "treasure-10", title: "Wreck Diver", description: "Recover 10 sunken treasures.", target: 10, rewardCoins: 1200, metric: "treasuresFound" },
  { id: "mutation-5", title: "Strange Catch", description: "Catch 5 mutated fish.", target: 5, rewardCoins: 1400, metric: "mutationsFound" },
  { id: "mutation-25", title: "Mutation Scholar", description: "Catch 25 mutated fish.", target: 25, rewardCoins: 6000, metric: "mutationsFound" },
  { id: "party-1", title: "Beach Party", description: "Join a campfire beach party.", target: 1, rewardCoins: 500, metric: "beachParties" },
  { id: "event-5", title: "Tide Rider", description: "Take part in 5 world events.", target: 5, rewardCoins: 3000, metric: "eventsWon" },
];

export function createAchievementProgress(): AchievementProgress[] {
  return ACHIEVEMENT_DEFS.map((def) => ({
    id: def.id,
    title: def.title,
    description: def.description,
    target: def.target,
    progress: 0,
    rewardCoins: def.rewardCoins,
    claimed: false,
  }));
}

export function refreshAchievements(profile: PlayerProfile): AchievementProgress[] {
  const unlocked: AchievementProgress[] = [];
  for (const achievement of profile.achievements) {
    const def = ACHIEVEMENT_DEFS.find((d) => d.id === achievement.id);
    if (!def) continue;
    let value = 0;
    switch (def.metric) {
      case "totalCatches":
        value = profile.stats.totalCatches;
        break;
      case "biggestWeight":
        value = profile.stats.biggestWeight;
        break;
      case "rarestRank":
        value = profile.stats.rarestRank;
        break;
      case "perfectCatches":
        value = profile.stats.perfectCatches;
        break;
      case "fishSold":
        value = profile.stats.fishSold;
        break;
      case "tournamentsWon":
        value = profile.stats.tournamentsWon;
        break;
      case "speciesDiscovered":
        value = Object.keys(profile.collection).length;
        break;
      case "totalValue":
        value = profile.stats.totalValue;
        break;
      case "level":
        value = profile.level;
        break;
      case "giantCatches":
        value = profile.stats.giantCatches ?? 0;
        break;
      case "treasuresFound":
        value = profile.stats.treasuresFound ?? 0;
        break;
      case "mutationsFound":
        value = profile.stats.mutationsFound ?? 0;
        break;
      case "beachParties":
        value = profile.stats.beachParties ?? 0;
        break;
      case "eventsWon":
        value = profile.stats.eventsWon ?? 0;
        break;
    }
    achievement.progress = Math.max(achievement.progress, Math.min(def.target, value));
    if (achievement.progress >= def.target && !achievement.unlockedAt) {
      achievement.unlockedAt = Date.now();
      unlocked.push(achievement);
    }
  }
  return unlocked;
}

export function levelFromXp(xp: number): number {
  return Math.max(1, Math.floor(Math.pow(xp / 100, 0.55)) + 1);
}

export function xpForLevel(level: number): number {
  return Math.round(Math.pow(level - 1, 1 / 0.55) * 100);
}

export function xpToNextLevel(level: number): number {
  return Math.max(50, xpForLevel(level + 1) - xpForLevel(level));
}
