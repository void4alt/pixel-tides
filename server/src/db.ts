import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";
import pg from "pg";
import type { LeaderboardRow, PlayerProfile } from "../../shared/types";
import { getFish, RARITY_RANK } from "../../shared/fish";

export interface StoredUser {
  id: string;
  username: string;
  passwordHash: string;
  isGuest: number;
  createdAt: number;
}

export interface CatchRow {
  id: string;
  userId: string;
  fishId: string;
  rarity: string;
  weight: number;
  length: number;
  value: number;
  location: string;
  perfect: number;
  mutation?: string;
  caughtAt: number;
}

export interface MarketRow {
  id: string;
  sellerId: string;
  sellerName: string;
  speciesId: string;
  mutation: string;
  weight: number;
  length: number;
  value: number;
  price: number;
  createdAt: number;
}

export interface GuildRow {
  id: string;
  name: string;
  tag: string;
  description: string;
  ownerId: string;
  xp: number;
  createdAt: number;
}

export interface GuildMemberRow {
  userId: string;
  username: string;
  role: string;
  contribution: number;
  level: number;
  joinedAt: number;
}

const SQLITE_SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  username_lower TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL DEFAULT '',
  is_guest INTEGER NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS player_state (
  user_id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS catches (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  fish_id TEXT NOT NULL,
  rarity TEXT NOT NULL,
  weight REAL NOT NULL,
  length REAL NOT NULL,
  value INTEGER NOT NULL,
  location TEXT NOT NULL,
  perfect INTEGER NOT NULL DEFAULT 0,
  mutation TEXT NOT NULL DEFAULT 'normal',
  caught_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS tournament_results (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  score INTEGER NOT NULL,
  catches INTEGER NOT NULL,
  place INTEGER NOT NULL,
  ended_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS guilds (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_lower TEXT NOT NULL UNIQUE,
  tag TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  owner_id TEXT NOT NULL,
  xp BIGINT NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS guild_members (
  user_id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  contribution BIGINT NOT NULL DEFAULT 0,
  joined_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS market_listings (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL,
  seller_name TEXT NOT NULL,
  species_id TEXT NOT NULL,
  mutation TEXT NOT NULL DEFAULT 'normal',
  weight REAL NOT NULL,
  length REAL NOT NULL,
  value INTEGER NOT NULL,
  price INTEGER NOT NULL,
  created_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS creature_hunts (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  creature_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  damage INTEGER NOT NULL,
  killed INTEGER NOT NULL DEFAULT 0,
  at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_catches_user ON catches(user_id);
CREATE INDEX IF NOT EXISTS idx_catches_weight ON catches(weight DESC);
CREATE INDEX IF NOT EXISTS idx_catches_caught ON catches(caught_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_guild_members_guild ON guild_members(guild_id);
CREATE INDEX IF NOT EXISTS idx_market_created ON market_listings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_creature_user ON creature_hunts(user_id);
`;

const PG_SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  username_lower TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL DEFAULT '',
  is_guest INTEGER NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS player_state (
  user_id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS catches (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  fish_id TEXT NOT NULL,
  rarity TEXT NOT NULL,
  weight DOUBLE PRECISION NOT NULL,
  length DOUBLE PRECISION NOT NULL,
  value INTEGER NOT NULL,
  location TEXT NOT NULL,
  perfect INTEGER NOT NULL DEFAULT 0,
  mutation TEXT NOT NULL DEFAULT 'normal',
  caught_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS tournament_results (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  score INTEGER NOT NULL,
  catches INTEGER NOT NULL,
  place INTEGER NOT NULL,
  ended_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS guilds (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_lower TEXT NOT NULL UNIQUE,
  tag TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  owner_id TEXT NOT NULL,
  xp BIGINT NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS guild_members (
  user_id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  contribution BIGINT NOT NULL DEFAULT 0,
  joined_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS market_listings (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL,
  seller_name TEXT NOT NULL,
  species_id TEXT NOT NULL,
  mutation TEXT NOT NULL DEFAULT 'normal',
  weight REAL NOT NULL,
  length REAL NOT NULL,
  value INTEGER NOT NULL,
  price INTEGER NOT NULL,
  created_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS creature_hunts (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  creature_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  damage INTEGER NOT NULL,
  killed INTEGER NOT NULL DEFAULT 0,
  at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_catches_user ON catches(user_id);
CREATE INDEX IF NOT EXISTS idx_catches_weight ON catches(weight DESC);
CREATE INDEX IF NOT EXISTS idx_catches_caught ON catches(caught_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_guild_members_guild ON guild_members(guild_id);
CREATE INDEX IF NOT EXISTS idx_market_created ON market_listings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_creature_user ON creature_hunts(user_id);
`;

function toPgPlaceholders(sql: string): string {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

export class Store {
  private sqlite: DatabaseSyncType | null = null;
  private pool: pg.Pool | null = null;
  readonly dialect: "sqlite" | "postgres";

  constructor() {
    const url = process.env.DATABASE_URL;
    this.dialect = url && /^postgres(ql)?:\/\//.test(url) ? "postgres" : "sqlite";
  }

  async init(): Promise<void> {
    if (this.dialect === "postgres") {
      this.pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : undefined,
        max: 10,
      });
      await this.pool.query(PG_SCHEMA);
      await this.pool.query("ALTER TABLE catches ADD COLUMN IF NOT EXISTS mutation TEXT NOT NULL DEFAULT 'normal'");
      return;
    }
    const dbPath = resolve(process.cwd(), process.env.SQLITE_PATH || "server/data/pixel-tides.db");
    mkdirSync(dirname(dbPath), { recursive: true });
    const sqliteModule = (process as any).getBuiltinModule?.("node:sqlite");
    if (!sqliteModule) throw new Error("This Node.js version does not provide node:sqlite. Use Node 22.5+ or set DATABASE_URL to PostgreSQL.");
    const sqlite = new sqliteModule.DatabaseSync(dbPath);
    sqlite.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;");
    sqlite.exec(SQLITE_SCHEMA);
    try {
      sqlite.exec("ALTER TABLE catches ADD COLUMN mutation TEXT NOT NULL DEFAULT 'normal'");
    } catch {
      // Column already exists.
    }
    this.sqlite = sqlite;
  }

  private async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    if (this.pool) {
      const result = await this.pool.query(toPgPlaceholders(sql), params);
      return result.rows as T[];
    }
    if (!this.sqlite) throw new Error("Database not initialised");
    const statement = this.sqlite.prepare(sql);
    const rows = statement.all(...(params as never[]));
    return rows as T[];
  }

  private async run(sql: string, params: unknown[] = []): Promise<void> {
    if (this.pool) {
      await this.pool.query(toPgPlaceholders(sql), params);
      return;
    }
    if (!this.sqlite) throw new Error("Database not initialised");
    this.sqlite.prepare(sql).run(...(params as never[]));
  }

  async createUser(user: StoredUser): Promise<void> {
    await this.run(
      `INSERT INTO users (id, username, username_lower, password_hash, is_guest, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [user.id, user.username, user.username.toLowerCase(), user.passwordHash, user.isGuest, user.createdAt],
    );
  }

  async findUserByUsername(username: string): Promise<StoredUser | null> {
    const rows = await this.query<Record<string, unknown>>(
      `SELECT id, username, password_hash as passwordHash, is_guest as isGuest, created_at as createdAt
       FROM users WHERE username_lower = ?`,
      [username.toLowerCase()],
    );
    if (!rows[0]) return null;
    const row = rows[0];
    return {
      id: String(row.id),
      username: String(row.username),
      passwordHash: String(row.passwordHash ?? ""),
      isGuest: Number(row.isGuest ?? 0),
      createdAt: Number(row.createdAt ?? 0),
    };
  }

  async findUserById(id: string): Promise<StoredUser | null> {
    const rows = await this.query<Record<string, unknown>>(
      `SELECT id, username, password_hash as passwordHash, is_guest as isGuest, created_at as createdAt
       FROM users WHERE id = ?`,
      [id],
    );
    if (!rows[0]) return null;
    const row = rows[0];
    return {
      id: String(row.id),
      username: String(row.username),
      passwordHash: String(row.passwordHash ?? ""),
      isGuest: Number(row.isGuest ?? 0),
      createdAt: Number(row.createdAt ?? 0),
    };
  }

  async createSession(token: string, userId: string, createdAt: number): Promise<void> {
    await this.run("INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)", [token, userId, createdAt]);
  }

  async getUserByToken(token: string): Promise<StoredUser | null> {
    const rows = await this.query<Record<string, unknown>>(
      `SELECT u.id, u.username, u.password_hash as passwordHash, u.is_guest as isGuest, u.created_at as createdAt
       FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`,
      [token],
    );
    if (!rows[0]) return null;
    const row = rows[0];
    return {
      id: String(row.id),
      username: String(row.username),
      passwordHash: String(row.passwordHash ?? ""),
      isGuest: Number(row.isGuest ?? 0),
      createdAt: Number(row.createdAt ?? 0),
    };
  }

  async deleteSession(token: string): Promise<void> {
    await this.run("DELETE FROM sessions WHERE token = ?", [token]);
  }

  async loadProfile(userId: string): Promise<PlayerProfile | null> {
    const rows = await this.query<Record<string, unknown>>("SELECT data FROM player_state WHERE user_id = ?", [userId]);
    if (!rows[0]) return null;
    try {
      return JSON.parse(String(rows[0].data)) as PlayerProfile;
    } catch {
      return null;
    }
  }

  async saveProfile(profile: PlayerProfile): Promise<void> {
    const data = JSON.stringify(profile);
    const now = Date.now();
    if (this.pool) {
      await this.run(
        `INSERT INTO player_state (user_id, data, updated_at) VALUES (?, ?, ?)
         ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at`,
        [profile.id, data, now],
      );
    } else {
      await this.run(
        `INSERT INTO player_state (user_id, data, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
        [profile.id, data, now],
      );
    }
  }

  async insertCatch(row: CatchRow): Promise<void> {
    await this.run(
      `INSERT INTO catches (id, user_id, fish_id, rarity, weight, length, value, location, perfect, mutation, caught_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [row.id, row.userId, row.fishId, row.rarity, row.weight, row.length, row.value, row.location, row.perfect, row.mutation ?? "normal", row.caughtAt],
    );
  }

  async insertTournamentResult(row: {
    id: string;
    roomId: string;
    userId: string;
    username: string;
    score: number;
    catches: number;
    place: number;
    endedAt: number;
  }): Promise<void> {
    await this.run(
      `INSERT INTO tournament_results (id, room_id, user_id, username, score, catches, place, ended_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [row.id, row.roomId, row.userId, row.username, row.score, row.catches, row.place, row.endedAt],
    );
  }

  async insertCreatureHunt(row: {
    id: string;
    roomId: string;
    creatureId: string;
    userId: string;
    username: string;
    damage: number;
    killed: number;
    at: number;
  }): Promise<void> {
    await this.run(
      `INSERT INTO creature_hunts (id, room_id, creature_id, user_id, username, damage, killed, at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [row.id, row.roomId, row.creatureId, row.userId, row.username, row.damage, row.killed, row.at],
    );
  }

  async findProfileByUsername(username: string): Promise<{ user: StoredUser; profile: PlayerProfile } | null> {
    const user = await this.findUserByUsername(username);
    if (!user) return null;
    const profile = await this.loadProfile(user.id);
    if (!profile) return null;
    return { user, profile };
  }

  async listMarket(limit = 40): Promise<MarketRow[]> {
    const rows = await this.query<Record<string, unknown>>(
      `SELECT id, seller_id as sellerId, seller_name as sellerName, species_id as speciesId,
              mutation, weight, length, value, price, created_at as createdAt
       FROM market_listings ORDER BY created_at DESC LIMIT ?`,
      [Math.max(1, Math.min(80, limit))],
    );
    return rows.map((row) => ({
      id: String(row.id),
      sellerId: String(row.sellerId),
      sellerName: String(row.sellerName),
      speciesId: String(row.speciesId),
      mutation: String(row.mutation ?? "normal"),
      weight: Number(row.weight ?? 0),
      length: Number(row.length ?? 0),
      value: Number(row.value ?? 0),
      price: Number(row.price ?? 0),
      createdAt: Number(row.createdAt ?? 0),
    }));
  }

  async addMarketListing(row: MarketRow): Promise<void> {
    await this.run(
      `INSERT INTO market_listings (id, seller_id, seller_name, species_id, mutation, weight, length, value, price, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [row.id, row.sellerId, row.sellerName, row.speciesId, row.mutation, row.weight, row.length, row.value, row.price, row.createdAt],
    );
  }

  async takeMarketListing(id: string): Promise<MarketRow | null> {
    const rows = await this.query<Record<string, unknown>>(
      `DELETE FROM market_listings WHERE id = ?
       RETURNING id, seller_id as sellerId, seller_name as sellerName, species_id as speciesId,
                 mutation, weight, length, value, price, created_at as createdAt`,
      [id],
    );
    if (!rows[0]) return null;
    const row = rows[0];
    return {
      id: String(row.id),
      sellerId: String(row.sellerId),
      sellerName: String(row.sellerName),
      speciesId: String(row.speciesId),
      mutation: String(row.mutation ?? "normal"),
      weight: Number(row.weight ?? 0),
      length: Number(row.length ?? 0),
      value: Number(row.value ?? 0),
      price: Number(row.price ?? 0),
      createdAt: Number(row.createdAt ?? 0),
    };
  }

  async cancelMarketListing(id: string, sellerId: string): Promise<MarketRow | null> {
    const rows = await this.query<Record<string, unknown>>(
      `DELETE FROM market_listings WHERE id = ? AND seller_id = ?
       RETURNING id, seller_id as sellerId, seller_name as sellerName, species_id as speciesId,
                 mutation, weight, length, value, price, created_at as createdAt`,
      [id, sellerId],
    );
    if (!rows[0]) return null;
    const row = rows[0];
    return {
      id: String(row.id),
      sellerId: String(row.sellerId),
      sellerName: String(row.sellerName),
      speciesId: String(row.speciesId),
      mutation: String(row.mutation ?? "normal"),
      weight: Number(row.weight ?? 0),
      length: Number(row.length ?? 0),
      value: Number(row.value ?? 0),
      price: Number(row.price ?? 0),
      createdAt: Number(row.createdAt ?? 0),
    };
  }

  async marketCountForSeller(sellerId: string): Promise<number> {
    const rows = await this.query<Record<string, unknown>>("SELECT COUNT(*) as total FROM market_listings WHERE seller_id = ?", [sellerId]);
    return Number(rows[0]?.total ?? 0);
  }

  async createGuild(row: GuildRow): Promise<void> {
    await this.run(
      `INSERT INTO guilds (id, name, name_lower, tag, description, owner_id, xp, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [row.id, row.name, row.name.toLowerCase(), row.tag, row.description, row.ownerId, row.xp, row.createdAt],
    );
  }

  async getGuild(id: string): Promise<GuildRow | null> {
    const rows = await this.query<Record<string, unknown>>(
      `SELECT id, name, tag, description, owner_id as ownerId, xp, created_at as createdAt FROM guilds WHERE id = ?`,
      [id],
    );
    if (!rows[0]) return null;
    const row = rows[0];
    return {
      id: String(row.id),
      name: String(row.name),
      tag: String(row.tag),
      description: String(row.description ?? ""),
      ownerId: String(row.ownerId),
      xp: Number(row.xp ?? 0),
      createdAt: Number(row.createdAt ?? 0),
    };
  }

  async getGuildByName(name: string): Promise<GuildRow | null> {
    const rows = await this.query<Record<string, unknown>>(
      `SELECT id, name, tag, description, owner_id as ownerId, xp, created_at as createdAt FROM guilds WHERE name_lower = ?`,
      [name.toLowerCase()],
    );
    if (!rows[0]) return null;
    const row = rows[0];
    return {
      id: String(row.id),
      name: String(row.name),
      tag: String(row.tag),
      description: String(row.description ?? ""),
      ownerId: String(row.ownerId),
      xp: Number(row.xp ?? 0),
      createdAt: Number(row.createdAt ?? 0),
    };
  }

  async getGuildForUser(userId: string): Promise<GuildRow | null> {
    const rows = await this.query<Record<string, unknown>>(
      `SELECT g.id, g.name, g.tag, g.description, g.owner_id as ownerId, g.xp, g.created_at as createdAt
       FROM guild_members gm JOIN guilds g ON g.id = gm.guild_id WHERE gm.user_id = ?`,
      [userId],
    );
    if (!rows[0]) return null;
    const row = rows[0];
    return {
      id: String(row.id),
      name: String(row.name),
      tag: String(row.tag),
      description: String(row.description ?? ""),
      ownerId: String(row.ownerId),
      xp: Number(row.xp ?? 0),
      createdAt: Number(row.createdAt ?? 0),
    };
  }

  async listGuilds(limit = 20): Promise<Array<GuildRow & { members: number }>> {
    const rows = await this.query<Record<string, unknown>>(
      `SELECT g.id, g.name, g.tag, g.description, g.owner_id as ownerId, g.xp, g.created_at as createdAt,
              (SELECT COUNT(*) FROM guild_members gm WHERE gm.guild_id = g.id) as members
       FROM guilds g ORDER BY g.xp DESC LIMIT ?`,
      [Math.max(1, Math.min(40, limit))],
    );
    return rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      tag: String(row.tag),
      description: String(row.description ?? ""),
      ownerId: String(row.ownerId),
      xp: Number(row.xp ?? 0),
      createdAt: Number(row.createdAt ?? 0),
      members: Number(row.members ?? 0),
    }));
  }

  async addGuildMember(userId: string, guildId: string, role: string, joinedAt: number): Promise<void> {
    await this.run(
      `INSERT INTO guild_members (user_id, guild_id, role, contribution, joined_at)
       VALUES (?, ?, ?, 0, ?)
       ON CONFLICT (user_id) DO UPDATE SET guild_id = excluded.guild_id, role = excluded.role, joined_at = excluded.joined_at`,
      [userId, guildId, role, joinedAt],
    );
  }

  async removeGuildMember(userId: string): Promise<void> {
    await this.run("DELETE FROM guild_members WHERE user_id = ?", [userId]);
  }

  async getGuildMembers(guildId: string): Promise<GuildMemberRow[]> {
    const rows = await this.query<Record<string, unknown>>(
      `SELECT gm.user_id as userId, u.username, gm.role, gm.contribution, gm.joined_at as joinedAt, p.data
       FROM guild_members gm
       JOIN users u ON u.id = gm.user_id
       LEFT JOIN player_state p ON p.user_id = gm.user_id
       WHERE gm.guild_id = ? ORDER BY gm.contribution DESC LIMIT 50`,
      [guildId],
    );
    return rows.map((row) => {
      let level = 1;
      try {
        const parsed = row.data ? JSON.parse(String(row.data)) : null;
        if (parsed && typeof parsed.level === "number") level = parsed.level;
      } catch {
        // ignore malformed profile data
      }
      return {
        userId: String(row.userId),
        username: String(row.username),
        role: String(row.role ?? "member"),
        contribution: Number(row.contribution ?? 0),
        level,
        joinedAt: Number(row.joinedAt ?? 0),
      };
    });
  }

  async addGuildXp(guildId: string, xp: number): Promise<void> {
    await this.run("UPDATE guilds SET xp = xp + ? WHERE id = ?", [Math.max(0, Math.round(xp)), guildId]);
  }

  async addGuildContribution(userId: string, amount: number): Promise<void> {
    await this.run("UPDATE guild_members SET contribution = contribution + ? WHERE user_id = ?", [Math.max(0, Math.round(amount)), userId]);
  }

  async deleteGuild(guildId: string): Promise<void> {
    await this.run("DELETE FROM guild_members WHERE guild_id = ?", [guildId]);
    await this.run("DELETE FROM guilds WHERE id = ?", [guildId]);
  }

  async leaderboard(type: "biggest" | "rarest" | "value" | "level" | "perfect" | "mutations" | "creatures" | "mastery", period: "daily" | "weekly" | "all"): Promise<LeaderboardRow[]> {
    const since = period === "daily" ? Date.now() - 86400000 : period === "weekly" ? Date.now() - 7 * 86400000 : 0;
    if (type === "level" || type === "mastery") {
      const rows = await this.query<Record<string, unknown>>(
        `SELECT u.username, u.is_guest as isGuest, p.data FROM player_state p JOIN users u ON u.id = p.user_id
         ORDER BY p.updated_at DESC LIMIT 500`,
      );
      const parsed = rows
        .map((row) => {
          try {
            return { profile: JSON.parse(String(row.data)) as PlayerProfile, username: String(row.username), isGuest: Number(row.isGuest) };
          } catch {
            return null;
          }
        })
        .filter((row): row is { profile: PlayerProfile; username: string; isGuest: number } => !!row)
        .sort((a, b) => {
          if (type === "mastery") {
            const ax = Object.values(a.profile.mastery ?? {}).reduce((sum, value) => sum + Number(value || 0), 0);
            const bx = Object.values(b.profile.mastery ?? {}).reduce((sum, value) => sum + Number(value || 0), 0);
            return bx - ax;
          }
          return b.profile.level - a.profile.level || b.profile.xp - a.profile.xp;
        })
        .slice(0, 20);
      return parsed.map((row, index) => {
        const mastery = Object.values(row.profile.mastery ?? {}).reduce((sum, value) => sum + Number(value || 0), 0);
        return {
          rank: index + 1,
          username: row.username,
          level: row.profile.level,
          value: type === "mastery" ? mastery : row.profile.xp,
          detail: type === "mastery" ? `${mastery.toLocaleString()} mastery` : `${row.profile.xp.toLocaleString()} XP`,
          isGuest: !!row.isGuest,
        };
      });
    }

    const where = since > 0 ? `WHERE c.caught_at >= ${since}` : "";
    if (type === "mutations") {
      const mutationWhere = `${where ? `${where} AND` : "WHERE"} c.mutation IS NOT NULL AND c.mutation != 'normal'`;
      const rows = await this.query<Record<string, unknown>>(
        `SELECT u.username, u.is_guest as isGuest, COUNT(*) as total
         FROM catches c JOIN users u ON u.id = c.user_id ${mutationWhere}
         GROUP BY c.user_id, u.username, u.is_guest ORDER BY total DESC LIMIT 20`,
      );
      return rows.map((row, index) => ({
        rank: index + 1,
        username: String(row.username),
        level: 0,
        value: Number(row.total ?? 0),
        detail: `${Number(row.total ?? 0)} mutated fish`,
        isGuest: !!Number(row.isGuest ?? 0),
      }));
    }
    if (type === "creatures") {
      const rows = await this.query<Record<string, unknown>>(
        `SELECT u.username, u.is_guest as isGuest, SUM(h.damage) as total, COUNT(*) as hunts
         FROM creature_hunts h JOIN users u ON u.id = h.user_id
         WHERE h.killed = 1 GROUP BY h.user_id, u.username, u.is_guest ORDER BY total DESC LIMIT 20`,
      );
      return rows.map((row, index) => ({
        rank: index + 1,
        username: String(row.username),
        level: 0,
        value: Number(row.total ?? 0),
        detail: `${Number(row.hunts ?? 0)} giants felled`,
        isGuest: !!Number(row.isGuest ?? 0),
      }));
    }
    if (type === "value") {
      const rows = await this.query<Record<string, unknown>>(
        `SELECT u.username, u.is_guest as isGuest, SUM(c.value) as total, COUNT(*) as catches
         FROM catches c JOIN users u ON u.id = c.user_id ${where}
         GROUP BY c.user_id, u.username, u.is_guest ORDER BY total DESC LIMIT 20`,
      );
      return rows.map((row, index) => ({
        rank: index + 1,
        username: String(row.username),
        level: 0,
        value: Number(row.total ?? 0),
        detail: `${Number(row.catches ?? 0)} fish sold`,
        isGuest: !!Number(row.isGuest ?? 0),
      }));
    }
    if (type === "perfect") {
      const rows = await this.query<Record<string, unknown>>(
        `SELECT u.username, u.is_guest as isGuest, COUNT(*) as total
         FROM catches c JOIN users u ON u.id = c.user_id ${where} ${where ? "AND" : "WHERE"} c.perfect = 1
         GROUP BY c.user_id, u.username, u.is_guest ORDER BY total DESC LIMIT 20`,
      );
      return rows.map((row, index) => ({
        rank: index + 1,
        username: String(row.username),
        level: 0,
        value: Number(row.total ?? 0),
        detail: `${Number(row.total ?? 0)} perfect catches`,
        isGuest: !!Number(row.isGuest ?? 0),
      }));
    }
    const order = type === "rarest" ? "rarity DESC, c.weight DESC" : "c.weight DESC";
    const rows = await this.query<Record<string, unknown>>(
      `SELECT u.username, u.is_guest as isGuest, c.fish_id as fishId, c.rarity, c.weight, c.value, c.length
       FROM catches c JOIN users u ON u.id = c.user_id ${where}
       ORDER BY ${order} LIMIT 20`,
    );
    return rows.map((row, index) => {
      const fish = getFish(String(row.fishId));
      const weight = Number(row.weight ?? 0);
      const rarity = String(row.rarity ?? fish.rarity);
      const value = type === "rarest" ? RARITY_RANK[rarity as keyof typeof RARITY_RANK] ?? 1 : weight;
      return {
        rank: index + 1,
        username: String(row.username),
        level: 0,
        value,
        detail: `${fish.name} · ${weight.toFixed(2)} kg${type === "rarest" ? ` · ${rarity}` : ""}`,
        isGuest: !!Number(row.isGuest ?? 0),
      };
    });
  }

  async getRecentCatchCount(): Promise<number> {
    const rows = await this.query<Record<string, unknown>>("SELECT COUNT(*) as total FROM catches");
    return Number(rows[0]?.total ?? 0);
  }

  async close(): Promise<void> {
    if (this.pool) await this.pool.end();
    if (this.sqlite) this.sqlite.close();
  }
}

export const store = new Store();
