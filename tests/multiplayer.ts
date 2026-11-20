import "dotenv/config";
import { Client } from "colyseus.js";
import { store } from "../server/src/db";
import type { PlayerProfile } from "../shared/types";

const BASE = process.env.PIXEL_TIDES_URL || "http://localhost:2567";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitFor<T>(
  fn: (resolve: (value: T) => void, reject: (reason?: unknown) => void) => void,
  timeout = 15000,
  label = "event",
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${label}`)), timeout);
    fn(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (reason) => {
        clearTimeout(timer);
        reject(reason);
      },
    );
  });
}

interface Session {
  token: string;
  profile: PlayerProfile;
}

async function guest(): Promise<Session> {
  const username = `Sync${Math.floor(Math.random() * 900000 + 100000)}`;
  const res = await fetch(`${BASE}/api/auth/guest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });
  if (!res.ok) throw new Error(`guest auth failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as Session;
}

async function main(): Promise<void> {
  const a = await guest();
  const b = await guest();
  console.log("✓ two guest sessions", a.profile.username, b.profile.username);

  // Promote angler A so the travel test can reach Coral Bay (level 4).
  await store.init();
  const savedA = await store.loadProfile(a.profile.id);
  if (!savedA) throw new Error("profile A was not persisted");
  savedA.level = Math.max(savedA.level, 15);
  savedA.coins = Math.max(savedA.coins, 50000);
  savedA.boatOwned = true;
  await store.saveProfile(savedA);
  console.log("✓ promoted", a.profile.username, "to level", savedA.level);

  const clientA = new Client(BASE);
  const clientB = new Client(BASE);
  const code = `SYNC${Math.floor(Math.random() * 9000 + 1000)}`;
  const roomA = await clientA.joinOrCreate("world", { token: a.token, location: "sunny-shore", code });
  console.log("✓ angler A joined private room", roomA.roomId, "code", code);

  let stateA: any = null;
  let presenceB = false;
  let chatFromB = false;
  roomA.onStateChange((state) => {
    stateA = state;
  });
  roomA.onMessage("presence", (event: any) => {
    if (event.type === "join" && event.username === b.profile.username) presenceB = true;
  });
  roomA.onMessage("chat", (event: any) => {
    if (event.username === b.profile.username && event.text === "sync hello from B") chatFromB = true;
  });

  const roomB = await clientB.joinOrCreate("world", { token: b.token, location: "sunny-shore", code });
  console.log("✓ angler B joined the same room", roomB.roomId);
  if (roomA.roomId !== roomB.roomId) throw new Error("room code did not match anglers into one room");

  await waitFor<boolean>((resolve) => {
    const check = () => {
      if (stateA?.players?.size >= 2) resolve(true);
      else setTimeout(check, 100);
    };
    check();
  }, 10000, "both players in room state");
  console.log("✓ room state shows", stateA.players.size, "anglers");

  await waitFor<boolean>((resolve) => {
    const check = () => {
      if (presenceB) resolve(true);
      else setTimeout(check, 100);
    };
    check();
  }, 10000, "presence join for B");
  console.log("✓ presence join broadcast received");

  const playerB = () => stateA.players.get(roomB.sessionId);
  const startY = playerB().y;
  for (let i = 0; i < 18; i++) {
    roomB.send("input", { dx: 0, dy: 1, running: false });
    await delay(60);
  }
  roomB.send("input", { dx: 0, dy: 0, running: false });
  await delay(300);
  if (playerB().y <= startY + 4) throw new Error(`movement did not replicate: ${startY} -> ${playerB().y}`);
  console.log("✓ movement replicated to the other client", startY.toFixed(1), "->", playerB().y.toFixed(1));

  roomB.send("chat", { text: "sync hello from B" });
  await waitFor<boolean>((resolve) => {
    const check = () => {
      if (chatFromB) resolve(true);
      else setTimeout(check, 100);
    };
    check();
  }, 5000, "chat from B");
  console.log("✓ chat broadcast crossed clients");

  await roomB.leave(true);
  console.log("✓ angler B left");

  // Travel: A sails to Coral Bay (unlocked by the promotion above).
  await roomA.leave(true);
  const roomA2 = await clientA.joinOrCreate("world", { token: a.token, location: "coral-bay", code: "" });
  let coralEnv: any = null;
  roomA2.onMessage("environment", (event: any) => {
    coralEnv = event;
  });
  await waitFor<any>((resolve) => {
    const check = () => {
      if (coralEnv?.location === "coral-bay") resolve(coralEnv);
      else setTimeout(check, 100);
    };
    check();
  }, 10000, "coral-bay environment");
  console.log("✓ travelled to", coralEnv.location, "room", roomA2.roomId);
  if (coralEnv.map.width !== 100 || coralEnv.map.height !== 75) throw new Error("coral-bay map was not delivered");
  await roomA2.leave(true);

  // Locked locations stay locked for a fresh angler.
  const c = await guest();
  const clientC = new Client(BASE);
  let lockedError = "";
  try {
    const roomC = await clientC.joinOrCreate("world", { token: c.token, location: "coral-bay", code: "" });
    await roomC.leave(true);
  } catch (error: any) {
    lockedError = String(error?.message || error);
  }
  if (!/locked/i.test(lockedError)) throw new Error(`coral-bay should be locked for a level 1 angler (got: ${lockedError || "no error"})`);
  console.log("✓ locked location rejected a level 1 angler");

  const me = (await (await fetch(`${BASE}/api/me`, { headers: { Authorization: `Bearer ${a.token}` } })).json()) as { profile: PlayerProfile };
  if (me.profile.level < 15) throw new Error("promoted level was not persisted");
  console.log("✓ profile persistence verified; level", me.profile.level, "location", me.profile.location);

  console.log("\nALL MULTIPLAYER TESTS PASSED");
}

main().catch((error) => {
  console.error("\nMULTIPLAYER TEST FAILED:", error);
  process.exit(1);
});
