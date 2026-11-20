-- Pixel Tides PostgreSQL / Supabase schema
-- The server creates this schema automatically on first boot.
-- Run manually with: psql "$DATABASE_URL" -f server/sql/schema.postgres.sql

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
  weight DOUBLE PRECISION NOT NULL,
  length DOUBLE PRECISION NOT NULL,
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
CREATE INDEX IF NOT EXISTS idx_tournament_ended ON tournament_results(ended_at DESC);
CREATE INDEX IF NOT EXISTS idx_guild_members_guild ON guild_members(guild_id);
CREATE INDEX IF NOT EXISTS idx_market_created ON market_listings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_creature_user ON creature_hunts(user_id);
