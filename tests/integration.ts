import { Client } from "colyseus.js";
import { createWorld, findWaterPoint } from "../shared/world";
import type { PlayerProfile } from "../shared/types";

const BASE = process.env.PIXEL_TIDES_URL || "http://localhost:2567";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitFor<T>(fn: (resolve: (value: T) => void, reject: (reason?: unknown) => void) => void, timeout = 15000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timed out waiting for event")), timeout);
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

async function main(): Promise<void> {
  const username = `Test${Math.floor(Math.random() * 900000 + 100000)}`;
  const authRes = await fetch(`${BASE}/api/auth/guest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });
  if (!authRes.ok) throw new Error(`guest auth failed: ${authRes.status} ${await authRes.text()}`);
  const session = (await authRes.json()) as { token: string; profile: PlayerProfile };
  console.log("✓ guest login", username);

  const client = new Client(BASE);
  const room = await client.joinOrCreate("world", { token: session.token, location: "sunny-shore", code: "" });
  console.log("✓ joined room", room.roomId, "session", room.sessionId);

  let profile: PlayerProfile = session.profile;
  let state: any = null;
  let bite = false;
  let mg: any = null;
  let minigameStarted = false;
  let ended: any = null;
  let chatSeen = false;
  let sold: any = null;
  let lastError = "";
  const profileWaiters: Array<(p: PlayerProfile) => void> = [];
  const emitProfile = (p: PlayerProfile) => {
    profile = p;
    for (const waiter of profileWaiters.splice(0)) waiter(p);
  };

  room.onMessage("profile", emitProfile);
  room.onMessage("environment", (env) => console.log("✓ environment", env.location, env.weather));
  room.onMessage("fishing", (event) => console.log("  fishing:", event.phase, event.message ?? ""));
  room.onMessage("bite", () => {
    bite = true;
    console.log("✓ bite");
  });
  room.onMessage("minigameStart", (event) => {
    minigameStarted = true;
    mg = event.state;
    console.log("✓ minigame started:", event.fishName, event.rarity);
  });
  room.onMessage("mg", (event) => {
    mg = event;
  });
  room.onMessage("minigameEnd", (event) => {
    ended = event;
    console.log("✓ minigame ended", event.won ? "WON" : "LOST", event.reason ?? "");
  });
  room.onMessage("chat", (event) => {
    if (event.text === "hello from integration test") chatSeen = true;
  });
  room.onMessage("sold", (event) => {
    sold = event;
  });
  room.onMessage("error", (event) => {
    lastError = event.message;
    console.log("  server error:", event.message);
  });
  room.onStateChange((next) => {
    state = next;
  });

  await waitFor((resolve) => {
    const check = () => {
      if (state?.players?.get?.(room.sessionId)) resolve(true);
      else setTimeout(check, 100);
    };
    check();
  }, 10000);
  console.log("✓ player state present");
  const own = () => state.players.get(room.sessionId);

  const before = { x: own().x, y: own().y };
  for (let i = 0; i < 20; i++) {
    room.send("input", { dx: 0, dy: 1, running: false });
    await delay(50);
  }
  room.send("input", { dx: 0, dy: 0, running: false });
  await delay(300);
  const after = { x: own().x, y: own().y };
  if (after.y <= before.y + 2) throw new Error(`movement did not work: ${JSON.stringify({ before, after })}`);
  console.log("✓ movement", before, "->", after);

  const map = createWorld("sunny-shore");
  const target = findWaterPoint(map, own().x, own().y, 0, 1, 26, 150);
  if (!target) throw new Error("no water target found");
  room.send("cast", { x: target.x, y: target.y });
  console.log("✓ cast sent", target);

  await waitFor((resolve) => {
    const check = () => {
      if (bite) resolve(true);
      else setTimeout(check, 100);
    };
    check();
  }, 15000);
  room.send("hook");
  console.log("✓ hook sent");

  await waitFor((resolve) => {
    const check = () => {
      if (minigameStarted) resolve(true);
      else setTimeout(check, 50);
    };
    check();
  }, 5000);

  let reelState = false;
  const controller = setInterval(() => {
    if (!mg) return;
    const shouldReel = mg.fishPos > mg.zonePos + 0.005;
    if (shouldReel !== reelState) {
      reelState = shouldReel;
      room.send("reel", { reeling: reelState });
    }
  }, 35);

  await waitFor((resolve, reject) => {
    const check = () => {
      if (ended) resolve(true);
      else setTimeout(check, 100);
    };
    check();
  }, 30000);
  clearInterval(controller);
  room.send("reel", { reeling: false });

  if (!ended.won) throw new Error(`minigame was lost: ${JSON.stringify(ended)}`);
  console.log("✓ catch recorded", ended.catch?.speciesId, "perfect:", ended.perfect);

  await waitFor((resolve) => {
    const check = () => {
      if (profile.inventory.length > 0) resolve(true);
      else setTimeout(check, 100);
    };
    check();
  }, 5000);
  console.log("✓ inventory has", profile.inventory.length, "fish; collection", Object.keys(profile.collection).length);

  const coinsBefore = profile.coins;
  room.send("sellAll");
  await waitFor((resolve) => {
    const check = () => {
      if (sold) resolve(true);
      else setTimeout(check, 100);
    };
    check();
  }, 5000);
  await delay(300);
  if (profile.coins <= coinsBefore) throw new Error("selling did not add coins");
  console.log("✓ sold fish for", sold.coins, "coins; balance", profile.coins);

  const baitBefore = profile.baits.worm ?? 0;
  room.send("buyBait", { baitId: "worm" });
  await waitFor((resolve) => {
    const check = () => {
      if ((profile.baits.worm ?? 0) > baitBefore) resolve(true);
      else setTimeout(check, 100);
    };
    check();
  }, 5000);
  console.log("✓ bought bait; worms", profile.baits.worm);

  room.send("chat", { text: "hello from integration test" });
  await waitFor((resolve) => {
    const check = () => {
      if (chatSeen) resolve(true);
      else setTimeout(check, 100);
    };
    check();
  }, 5000);
  console.log("✓ chat broadcast received");

  room.send("tournamentJoin");
  await delay(500);
  room.send("tournamentLeave");

  const meRes = await fetch(`${BASE}/api/me`, { headers: { Authorization: `Bearer ${session.token}` } });
  const me = (await meRes.json()) as { profile: PlayerProfile };
  if (me.profile.coins !== profile.coins) throw new Error("profile was not persisted");
  console.log("✓ persistence verified; coins", me.profile.coins, "catches", me.profile.stats.totalCatches);

  if (lastError) console.log("last server error:", lastError);
  await room.leave(true);
  console.log("\nALL INTEGRATION TESTS PASSED");
}

main().catch((error) => {
  console.error("\nINTEGRATION TEST FAILED:", error);
  process.exit(1);
});
