import "dotenv/config";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import colyseus from "colyseus";
const { Server } = colyseus;
import { WorldRoom } from "./rooms/WorldRoom";
import { store, type StoredUser } from "./db";
import {
  createProfile,
  hashPassword,
  makeToken,
  normalizeProfile,
  publicUser,
  sanitizeUsername,
  uniqueGuestName,
  validateUsername,
  verifyPassword,
} from "./profile";
import { listPublicRooms, roomCount } from "./registry";
import { FISH } from "../../shared/fish";
import { LOCATIONS } from "../../shared/items";

const PORT = Number(process.env.PORT || 2567);
const app = express();
app.disable("x-powered-by");
app.use(cors({ origin: process.env.CLIENT_ORIGIN || true, credentials: true }));
app.use(express.json({ limit: "256kb" }));

interface AuthedRequest extends Request {
  user?: StoredUser;
}

function tokenFrom(req: Request): string {
  const header = req.headers.authorization ?? "";
  if (header.startsWith("Bearer ")) return header.slice(7);
  return "";
}

async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await store.getUserByToken(tokenFrom(req));
    if (!user) {
      res.status(401).json({ error: "Session expired. Please sign in again." });
      return;
    }
    req.user = user;
    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Authentication failed." });
  }
}

async function issueSession(user: StoredUser): Promise<{ token: string; profile: ReturnType<typeof createProfile> }> {
  const token = makeToken();
  await store.createSession(token, user.id, Date.now());
  let profile = await store.loadProfile(user.id);
  if (!profile) {
    profile = createProfile(user);
    await store.saveProfile(profile);
  } else {
    profile = normalizeProfile(profile);
  }
  return { token, profile };
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "pixel-tides",
    rooms: roomCount(),
    fish: FISH.length,
    locations: LOCATIONS.length,
    database: store.dialect,
    uptime: Math.round(process.uptime()),
  });
});

app.post("/api/auth/guest", async (req, res) => {
  try {
    const requested = sanitizeUsername(String(req.body?.username ?? ""));
    let username = requested;
    if (username) {
      const error = validateUsername(username);
      if (error) return res.status(400).json({ error });
      if (await store.findUserByUsername(username)) {
        return res.status(409).json({ error: "That name is already sailing these waters." });
      }
    } else {
      username = await uniqueGuestName();
    }
    const user: StoredUser = {
      id: randomUUID(),
      username,
      passwordHash: "",
      isGuest: 1,
      createdAt: Date.now(),
    };
    await store.createUser(user);
    const session = await issueSession(user);
    res.json({ token: session.token, user: publicUser(user), profile: session.profile });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not create guest account." });
  }
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const username = sanitizeUsername(String(req.body?.username ?? ""));
    const password = String(req.body?.password ?? "");
    const error = validateUsername(username);
    if (error) return res.status(400).json({ error });
    if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters." });
    if (await store.findUserByUsername(username)) {
      return res.status(409).json({ error: "That name is already taken." });
    }
    const user: StoredUser = {
      id: randomUUID(),
      username,
      passwordHash: hashPassword(password),
      isGuest: 0,
      createdAt: Date.now(),
    };
    await store.createUser(user);
    const session = await issueSession(user);
    res.json({ token: session.token, user: publicUser(user), profile: session.profile });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not create account." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const username = sanitizeUsername(String(req.body?.username ?? ""));
    const password = String(req.body?.password ?? "");
    const user = await store.findUserByUsername(username);
    if (!user || user.isGuest || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: "Wrong name or password." });
    }
    const session = await issueSession(user);
    res.json({ token: session.token, user: publicUser(user), profile: session.profile });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not sign in." });
  }
});

app.post("/api/auth/logout", async (req, res) => {
  const token = tokenFrom(req);
  if (token) await store.deleteSession(token);
  res.json({ ok: true });
});

app.get("/api/me", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const user = req.user!;
    let profile = await store.loadProfile(user.id);
    if (!profile) {
      profile = createProfile(user);
      await store.saveProfile(profile);
    } else {
      profile = normalizeProfile(profile);
    }
    res.json({ user: publicUser(user), profile });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not load profile." });
  }
});

app.get("/api/rooms", (_req, res) => {
  res.json({ rooms: listPublicRooms() });
});

app.get("/api/leaderboards", async (req, res) => {
  try {
    const type = ["biggest", "rarest", "value", "level", "perfect", "mutations", "creatures", "mastery"].includes(String(req.query.type))
      ? (String(req.query.type) as "biggest" | "rarest" | "value" | "level" | "perfect" | "mutations" | "creatures" | "mastery")
      : "biggest";
    const period = ["daily", "weekly", "all"].includes(String(req.query.period))
      ? (String(req.query.period) as "daily" | "weekly" | "all")
      : "weekly";
    const rows = await store.leaderboard(type, period);
    res.json({ type, period, rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not load leaderboard." });
  }
});

app.get("/api/stats", async (_req, res) => {
  try {
    const catches = await store.getRecentCatchCount();
    res.json({
      catches,
      fish: FISH.length,
      locations: LOCATIONS.length,
      rooms: listPublicRooms(),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not load stats." });
  }
});

const clientDist = resolve(process.cwd(), "dist/client");
if (existsSync(clientDist)) {
  app.use(express.static(clientDist, { maxAge: process.env.NODE_ENV === "production" ? "1h" : 0 }));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/") || req.path.startsWith("/colyseus")) return next();
    res.sendFile(resolve(clientDist, "index.html"));
  });
} else {
  app.get("/", (_req, res) => {
    res.type("text/plain").send("Pixel Tides server is running. Start the Vite client with `npm run dev:client` or build with `npm run build`.");
  });
}

const httpServer = createServer(app);
const gameServer = new Server({ server: httpServer });
gameServer.define("world", WorldRoom).filterBy(["location", "code"]);

async function main(): Promise<void> {
  await store.init();
  await gameServer.listen(PORT);
  console.log(`\n  🌊 Pixel Tides server listening on http://localhost:${PORT}`);
  console.log(`  🗄  Database: ${store.dialect}`);
  console.log(`  🐟 ${FISH.length} fish species across ${LOCATIONS.length} locations\n`);
}

const shutdown = async (signal: string) => {
  console.log(`\n${signal} received. Saving the tide...`);
  try {
    await gameServer.gracefullyShutdown();
  } catch {}
  await store.close();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

main().catch((error) => {
  console.error("Failed to start Pixel Tides:", error);
  process.exit(1);
});
