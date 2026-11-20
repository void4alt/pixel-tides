import type { FishSpecies, LocationId, MinigameState, Rarity, TimeOfDay, Weather } from "../../../shared/types";
import { FISH, RARITY_META, RARITY_RANK, getFish, fishForLocation, timeOfDayFromMinutes } from "../../../shared/fish";
import { BAITS_BY_ID, RODS_BY_ID, rarityMultiplier } from "../../../shared/items";

export type FishingPhase = "casting" | "waiting" | "bite" | "minigame" | "landed";

export interface Minigame {
  speciesId: string;
  zonePos: number;
  zoneVelocity: number;
  zoneSize: number;
  reelPower: number;
  fishPos: number;
  fishTarget: number;
  fishSpeed: number;
  progress: number;
  timeLeft: number;
  duration: number;
  reel: boolean;
  inZoneTime: number;
  elapsed: number;
  nextTargetAt: number;
  lastSentAt: number;
}

export interface FishingSession {
  phase: FishingPhase;
  castX: number;
  castY: number;
  castAt: number;
  biteAt: number;
  biteUntil: number;
  speciesId?: string;
  minigame?: Minigame;
  landedAt?: number;
  lastBiteNotify?: number;
  baitId: string;
}

export interface RolledCatch {
  species: FishSpecies;
  weight: number;
  length: number;
  value: number;
  xp: number;
  perfect: boolean;
}

export interface FishChoiceOptions {
  secretSpot?: boolean;
  eventRarity?: number;
  luckBonus?: number;
}

export function chooseFish(
  location: LocationId,
  weather: Weather,
  minutes: number,
  rodId: string,
  baitId: string,
  options: FishChoiceOptions = {},
): FishSpecies {
  const time = timeOfDayFromMinutes(minutes);
  const rod = RODS_BY_ID[rodId] ?? RODS_BY_ID.wooden;
  const bait = BAITS_BY_ID[baitId];
  const boost = rod.rarityBoost + (bait?.rarityBoost ?? 0) + (options.eventRarity ?? 0) + (options.luckBonus ?? 0);
  const pool = fishForLocation(location).filter((fish) => (fish.secretSpot ? !!options.secretSpot : true));
  const scored = pool.map((fish) => {
    let weight = RARITY_META[fish.rarity].weight;
    if (fish.weather.includes(weather)) weight *= 1.65;
    if (fish.time.includes(time)) weight *= 1.5;
    const rank = RARITY_RANK[fish.rarity];
    if (rank >= 3) weight *= 1 + boost * (rank - 1) * 1.6;
    else weight *= 1 + boost * 0.25;
    return { fish, weight };
  });
  const total = scored.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of scored) {
    roll -= item.weight;
    if (roll <= 0) return item.fish;
  }
  return scored[scored.length - 1].fish;
}

export function rollCatch(species: FishSpecies, perfect: boolean): RolledCatch {
  const ratio = Math.pow(Math.random(), 0.72);
  const weight = +(species.minWeight + (species.maxWeight - species.minWeight) * ratio).toFixed(2);
  const length = +(species.minLength + (species.maxLength - species.minLength) * ratio).toFixed(1);
  const base = species.basePrice * (0.72 + ratio * 0.62) * rarityMultiplier(species.rarity) * 0.35;
  const value = Math.max(1, Math.round(base * (perfect ? 1.3 : 1)));
  const xp = Math.round(RARITY_META[species.rarity].xp * (0.8 + ratio * 0.5) * (perfect ? 1.2 : 1));
  return { species, weight, length, value, xp, perfect };
}

export function createMinigame(species: FishSpecies, rodId: string): Minigame {
  const rod = RODS_BY_ID[rodId] ?? RODS_BY_ID.wooden;
  const difficulty = species.difficulty;
  const duration = 22;
  return {
    speciesId: species.id,
    zonePos: 0.5,
    zoneVelocity: 0,
    zoneSize: rod.zoneSize,
    reelPower: rod.reelPower,
    fishPos: 0.5,
    fishTarget: 0.5,
    fishSpeed: 0.13 + difficulty * 0.043,
    progress: 34,
    timeLeft: duration,
    duration,
    reel: false,
    inZoneTime: 0,
    elapsed: 0,
    nextTargetAt: 0.7 + Math.random() * 0.9,
    lastSentAt: 0,
  };
}

export interface MinigameTickResult {
  state: MinigameState;
  finished: boolean;
  won: boolean;
  perfect: boolean;
}

export function tickMinigame(mg: Minigame, dt: number): MinigameTickResult {
  const rod = RODS_BY_ID.wooden;
  const zoneSize = mg.zoneSize;
  mg.elapsed += dt;
  mg.timeLeft = Math.max(0, mg.timeLeft - dt);

  if (mg.reel) mg.zoneVelocity += 2.25 * mg.reelPower * dt;
  else mg.zoneVelocity -= 2.05 * dt;
  mg.zoneVelocity = Math.max(-0.55, Math.min(0.72, mg.zoneVelocity));
  mg.zonePos = Math.max(zoneSize / 2, Math.min(1 - zoneSize / 2, mg.zonePos + mg.zoneVelocity * dt));
  if (mg.zonePos <= zoneSize / 2 || mg.zonePos >= 1 - zoneSize / 2) mg.zoneVelocity *= 0.35;

  if (mg.elapsed >= mg.nextTargetAt) {
    const aggression = 0.45 + Math.random() * 0.55;
    mg.fishTarget = Math.max(0.08, Math.min(0.92, mg.fishPos + (Math.random() - 0.5) * 1.6 * aggression));
    mg.nextTargetAt = mg.elapsed + 0.55 + Math.random() * 1.3;
  }
  const fishDelta = mg.fishTarget - mg.fishPos;
  const step = Math.sign(fishDelta) * Math.min(Math.abs(fishDelta), mg.fishSpeed * dt);
  mg.fishPos = Math.max(0.04, Math.min(0.96, mg.fishPos + step));

  const inZone = Math.abs(mg.fishPos - mg.zonePos) <= zoneSize / 2;
  if (inZone) {
    mg.inZoneTime += dt;
    mg.progress = Math.min(100, mg.progress + (13 + (1 - mg.fishSpeed) * 10) * dt);
  } else {
    mg.progress = Math.max(0, mg.progress - (7.2 + mg.fishSpeed * 9) * dt);
  }

  const finished = mg.progress >= 100 || mg.progress <= 0 || mg.timeLeft <= 0;
  const won = mg.progress >= 100;
  const perfect = won && mg.inZoneTime / Math.max(0.01, mg.elapsed) >= 0.68;

  const species = getFish(mg.speciesId);
  return {
    state: {
      fishId: mg.speciesId,
      fishName: species.name,
      rarity: species.rarity,
      zonePos: mg.zonePos,
      zoneSize: mg.zoneSize,
      fishPos: mg.fishPos,
      fishTarget: mg.fishTarget,
      progress: mg.progress,
      timeLeft: mg.timeLeft,
      inZone,
      difficulty: species.difficulty,
    },
    finished,
    won,
    perfect,
  };
}

export function castRange(rodId: string): number {
  return (RODS_BY_ID[rodId] ?? RODS_BY_ID.wooden).castDistance;
}

export function biteDelay(baitId: string, speedMult = 1): number {
  const bait = BAITS_BY_ID[baitId];
  const speed = (bait?.biteSpeed ?? 1) * Math.max(0.4, speedMult);
  return (2400 + Math.random() * 5200) / speed;
}

export function rarityWeightFor(rarity: Rarity): number {
  return RARITY_META[rarity].weight;
}

export function allFishCount(): number {
  return FISH.length;
}
