export type Rarity =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary"
  | "mythical"
  | "secret";

export type FishMutation = "normal" | "golden" | "albino" | "crystal" | "shadow" | "glowing";

export type Weather = "sunny" | "cloudy" | "rainy" | "stormy" | "foggy";
export type TimeOfDay = "morning" | "afternoon" | "evening" | "night";
export type LocationId =
  | "sunny-shore"
  | "coral-bay"
  | "frostbite-lake"
  | "mystic-river"
  | "deep-ocean";

export type FishBody =
  | "slim"
  | "round"
  | "long"
  | "flat"
  | "eel"
  | "jelly"
  | "serpent"
  | "ray";

export type FishPattern =
  | "plain"
  | "stripes"
  | "spots"
  | "scales"
  | "glow"
  | "gradient"
  | "bands";

export interface FishSpecies {
  id: string;
  name: string;
  rarity: Rarity;
  basePrice: number;
  minWeight: number;
  maxWeight: number;
  minLength: number;
  maxLength: number;
  habitats: LocationId[];
  weather: Weather[];
  time: TimeOfDay[];
  difficulty: number;
  description: string;
  body: FishBody;
  pattern: FishPattern;
  colors: [string, string, string, string];
  fin: "fan" | "forked" | "round" | "spiky" | "ribbon";
  secretSpot?: boolean;
}

export interface Appearance {
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
  hat: string;
  hairStyle: number;
}

export interface FishInstance {
  uid: string;
  speciesId: string;
  weight: number;
  length: number;
  value: number;
  caughtAt: number;
  location: LocationId;
  perfect: boolean;
  mutation?: FishMutation;
  cooked?: boolean;
  cookedName?: string;
  energy?: number;
  cookedAt?: number;
  buff?: string;
  buffUntil?: number;
}

export interface CollectionEntry {
  count: number;
  firstCaughtAt: number;
  bestWeight: number;
  bestLength: number;
  bestValue: number;
  variants?: Partial<Record<FishMutation, number>>;
  bestMutation?: FishMutation;
}

export interface QuestProgress {
  id: string;
  title: string;
  description: string;
  type: "catch_count" | "catch_rarity" | "discover" | "weight" | "location" | "perfect" | "mutation" | "treasure" | "giant";
  target: number;
  progress: number;
  rewardCoins: number;
  rewardXp: number;
  claimed: boolean;
  rarity?: Rarity;
  location?: LocationId;
}

export interface AchievementProgress {
  id: string;
  title: string;
  description: string;
  target: number;
  progress: number;
  rewardCoins: number;
  unlockedAt?: number;
  claimed: boolean;
}

export interface PlayerStats {
  totalCatches: number;
  totalValue: number;
  biggestWeight: number;
  rarestRank: number;
  perfectCatches: number;
  fishSold: number;
  tournamentsWon: number;
  bestTournamentScore: number;
  playSeconds: number;
  giantCatches: number;
  treasuresFound: number;
  mutationsFound: number;
  beachParties: number;
  eventsWon: number;
}

export interface PlayerSettings {
  music: number;
  sfx: number;
  quality: "high" | "medium" | "low";
  showNames: boolean;
  showJoystick: boolean;
}

export interface PlayerProfile {
  id: string;
  username: string;
  isGuest: boolean;
  coins: number;
  xp: number;
  level: number;
  skillXp: number;
  skillLevel: number;
  energy: number;
  maxEnergy: number;
  location: LocationId;
  appearance: Appearance;
  rods: string[];
  equippedRod: string;
  baits: Record<string, number>;
  equippedBait: string;
  inventory: FishInstance[];
  inventorySlots: number;
  collection: Record<string, CollectionEntry>;
  stats: PlayerStats;
  daily: {
    date: string;
    quests: QuestProgress[];
  };
  achievements: AchievementProgress[];
  boatOwned: boolean;
  boatColor: string;
  boatPaints: string[];
  diveGear: boolean;
  equipment: string[];
  cosmetics: string[];
  mastery: Record<string, number>;
  weekly: {
    week: string;
    quests: QuestProgress[];
  };
  aquarium: AquariumState;
  house: HouseState;
  trophies: TrophyEntry[];
  materials: Record<string, number>;
  furniture: Record<string, number>;
  buffs: Array<{ id: string; until: number }>;
  guildId: string;
  friends: FriendEntry[];
  secretQuests: SecretQuestProgress[];
  settings: PlayerSettings;
  createdAt: number;
  updatedAt: number;
}

export interface LeaderboardRow {
  rank: number;
  username: string;
  level: number;
  value: number;
  detail: string;
  isGuest: boolean;
}

export interface PublicRoom {
  roomId: string;
  location: LocationId;
  clients: number;
  maxClients: number;
  private: boolean;
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  username: string;
  text: string;
  at: number;
  system?: boolean;
}

export interface CatchEvent {
  username: string;
  speciesId: string;
  rarity: Rarity;
  weight: number;
  value: number;
  perfect: boolean;
  length?: number;
  location?: LocationId;
  isNew?: boolean;
  mutation?: FishMutation;
}

export interface MinigameState {
  fishId: string;
  fishName: string;
  rarity: Rarity;
  zonePos: number;
  zoneSize: number;
  fishPos: number;
  fishTarget: number;
  progress: number;
  timeLeft: number;
  inZone: boolean;
  difficulty: number;
}

export interface TournamentView {
  phase: "idle" | "starting" | "active" | "results";
  endsAt: number;
  startsAt: number;
  entries: number;
  joined: boolean;
  score: number;
  results?: Array<{ username: string; score: number; catches: number; place: number }>;
}

export interface AquariumFish {
  uid: string;
  speciesId: string;
  mutation: FishMutation;
  weight: number;
  addedAt: number;
}

export interface AquariumState {
  slots: number;
  theme: string;
  fish: AquariumFish[];
  fedAt: number;
  food: number;
}

export interface FurniturePlacement {
  id: string;
  item: string;
  x: number;
  y: number;
}

export interface HouseState {
  theme: string;
  furniture: FurniturePlacement[];
  visits: number;
  name: string;
}

export interface TrophyEntry {
  id: string;
  speciesId: string;
  mutation: FishMutation;
  weight: number;
  length: number;
  at: number;
  label: string;
}

export interface FriendEntry {
  id: string;
  username: string;
  addedAt: number;
}

export interface SecretQuestProgress {
  id: string;
  progress: number;
  claimed: boolean;
}

export type WorldEventId =
  | "golden-hour"
  | "meteor-shower"
  | "blood-moon"
  | "aurora-night"
  | "whale-migration"
  | "pirate-ship"
  | "fishing-frenzy"
  | "heavy-rain";

export interface WorldEventView {
  id: WorldEventId;
  name: string;
  description: string;
  startedAt: number;
  endsAt: number;
  color: string;
  icon: string;
}

export type GiantCreatureId = "ancient-whale" | "storm-serpent" | "reef-shark" | "abyssal-kraken";

export interface CreatureView {
  id: GiantCreatureId;
  name: string;
  kind: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  endsAt: number;
  participants: number;
  joined: boolean;
  contribution: number;
}

export interface TreasureView {
  id: string;
  x: number;
  y: number;
  kind: string;
  expiresAt: number;
}

export interface GuildMemberView {
  id: string;
  username: string;
  role: string;
  level: number;
  contribution: number;
  online: boolean;
}

export interface GuildView {
  id: string;
  name: string;
  tag: string;
  description: string;
  ownerId: string;
  level: number;
  xp: number;
  members: GuildMemberView[];
  joined: boolean;
}

export interface MarketListing {
  id: string;
  sellerId: string;
  sellerName: string;
  speciesId: string;
  mutation: FishMutation;
  weight: number;
  length: number;
  price: number;
  createdAt: number;
}

export interface TradeOfferView {
  fish: Array<{ uid: string; speciesId: string; mutation: FishMutation; weight: number; value: number }>;
  coins: number;
}

export interface TradeView {
  id: string;
  from: string;
  to: string;
  fromOffer: TradeOfferView;
  toOffer: TradeOfferView;
  status: "pending" | "open" | "accepted" | "declined" | "cancelled";
}

export interface HouseVisitView {
  owner: string;
  house: HouseState;
  aquarium: AquariumState;
  trophies: TrophyEntry[];
  level: number;
  visits: number;
}
