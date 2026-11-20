import "dotenv/config";
import { randomUUID } from "node:crypto";
import { Client, type Room } from "colyseus.js";
import { store } from "../server/src/db";
import { weekKey } from "../shared/quests";
import type { FishInstance, PlayerProfile } from "../shared/types";

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
  const username = `Exp${Math.floor(Math.random() * 900000 + 100000)}`;
  const res = await fetch(`${BASE}/api/auth/guest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });
  if (!res.ok) throw new Error(`guest auth failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as Session;
}

function testFish(speciesId: string, value = 120): FishInstance {
  return {
    uid: randomUUID(),
    speciesId,
    weight: 2.4,
    length: 34,
    value,
    caughtAt: Date.now(),
    location: "sunny-shore",
    perfect: false,
    mutation: "normal",
  };
}

async function main(): Promise<void> {
  const a = await guest();
  const b = await guest();
  console.log("✓ expansion guests", a.profile.username, b.profile.username);

  await store.init();
  const fishA1 = testFish("sardine", 140);
  const fishA2 = testFish("blue-tang", 220);
  const fishB1 = testFish("angelfish", 180);
  const savedA = await store.loadProfile(a.profile.id);
  const savedB = await store.loadProfile(b.profile.id);
  if (!savedA || !savedB) throw new Error("profiles were not persisted");
  Object.assign(savedA, {
    level: 15,
    coins: 60000,
    boatOwned: true,
    diveGear: true,
  });
  savedA.inventory.push(fishA1, fishA2);
  Object.assign(savedB, {
    level: 15,
    coins: 60000,
    boatOwned: true,
    diveGear: true,
  });
  savedB.inventory.push(fishB1);
  savedB.weekly = {
    week: weekKey(),
    quests: [
      {
        id: "weekly-catch-40",
        title: "A Week of Tides",
        description: "Catch 40 fish this week.",
        type: "catch_count",
        target: 40,
        progress: 40,
        rewardCoins: 1800,
        rewardXp: 900,
        claimed: false,
      },
    ],
  };
  savedB.secretQuests = [{ id: "hermit-mutations", progress: 2, claimed: false }];
  await store.saveProfile(savedA);
  await store.saveProfile(savedB);
  console.log("✓ seeded boats, dive gear, inventory, weekly and secret quests");

  const clientA = new Client(BASE);
  const clientB = new Client(BASE);
  const code = `EXP${Math.floor(Math.random() * 9000 + 1000)}`;
  const roomA = await clientA.joinOrCreate("world", { token: a.token, location: "sunny-shore", code });
  const roomB = await clientB.joinOrCreate("world", { token: b.token, location: "sunny-shore", code });
  if (roomA.roomId !== roomB.roomId) throw new Error("private code did not match rooms");
  console.log("✓ both expansion anglers joined", roomA.roomId);

  let stateA: any = null;
  let profileA: PlayerProfile | null = null;
  let profileB: PlayerProfile | null = null;
  const eventsA: any[] = [];
  const eventsB: any[] = [];
  const messagesA = new Map<string, any[]>();
  const messagesB = new Map<string, any[]>();
  const track = (room: Room, map: Map<string, any[]>, extra: string[] = []) => {
    for (const type of [
      "profile", "events", "event", "creature", "creatureHit", "creatureResult",
      "friends", "guild", "market", "trade", "tradeEnd", "houseVisit", "aquarium",
      "aquariumFed", "purchase", "questClaimed", "secretClaimed", "treasure", "treasures",
      ...extra,
    ]) {
      room.onMessage(type, (message: any) => {
        if (!map.has(type)) map.set(type, []);
        map.get(type)!.push(message);
        if (type === "events" || type === "event") {
          (room === roomA ? eventsA : eventsB).push(message);
        }
      });
    }
  };
  track(roomA, messagesA);
  track(roomB, messagesB);
  roomA.onStateChange((state) => { stateA = state; });
  roomA.onMessage("profile", (profile: PlayerProfile) => { profileA = profile; });
  roomB.onMessage("profile", (profile: PlayerProfile) => { profileB = profile; });
  await delay(250);
  roomA.send("requestProfile");
  roomB.send("requestProfile");

  await waitFor<boolean>((resolve) => {
    const check = () => {
      if (stateA?.players?.size >= 2 && profileA && profileB) resolve(true);
      else setTimeout(check, 100);
    };
    check();
  }, 15000, "both players and profiles");
  console.log("✓ room state and profiles ready");

  const playerA = () => stateA.players.get(roomA.sessionId);
  const playerB = () => stateA.players.get(roomB.sessionId);

  // Boat sailing.
  roomA.send("toggleSail");
  await waitFor<boolean>((resolve) => {
    const check = () => (playerA()?.sailing ? resolve(true) : setTimeout(check, 100));
    check();
  }, 5000, "sailing enabled");
  const sailStartY = playerA().y;
  for (let i = 0; i < 16; i++) {
    roomA.send("input", { dx: 0, dy: 1, running: false });
    await delay(70);
  }
  roomA.send("input", { dx: 0, dy: 0, running: false });
  await delay(350);
  if (playerA().y <= sailStartY + 20) throw new Error(`boat did not move: ${sailStartY} -> ${playerA().y}`);
  console.log("✓ boat sailing moved the skiff", sailStartY.toFixed(1), "->", playerA().y.toFixed(1));

  // Diving snaps into water and moves.
  roomB.send("toggleDive");
  await waitFor<boolean>((resolve) => {
    const check = () => (playerB()?.diving ? resolve(true) : setTimeout(check, 100));
    check();
  }, 5000, "diving enabled");
  const diveStartY = playerB().y;
  for (let i = 0; i < 14; i++) {
    roomB.send("input", { dx: 0, dy: 1, running: false });
    await delay(70);
  }
  roomB.send("input", { dx: 0, dy: 0, running: false });
  await delay(350);
  if (playerB().y <= diveStartY + 15) throw new Error(`diver did not move: ${diveStartY} -> ${playerB().y}`);
  console.log("✓ diving moved the swimmer", diveStartY.toFixed(1), "->", playerB().y.toFixed(1));

  // Housing, aquarium, visit.
  roomB.send("aquariumAdd", { uid: fishB1.uid });
  roomB.send("aquariumFeed");
  roomB.send("aquariumTheme", { themeId: "moonlit" });
  roomB.send("buyFurniture", { itemId: "rope-table", x: 3, y: 3 });
  roomB.send("buyFurniture", { itemId: "coral-lamp", x: 5, y: 2 });
  await delay(500);
  roomB.send("saveHouse", {
    theme: "lantern",
    name: "Expansion Island",
    furniture: [{ id: "f1", item: "rope-table", x: 3, y: 3 }, { id: "f2", item: "coral-lamp", x: 5, y: 2 }],
  });
  await delay(700);
  if (profileB?.house.name !== "Expansion Island") throw new Error("house name was not saved");
  if (profileB?.aquarium.theme !== "moonlit") throw new Error("aquarium theme was not saved");
  roomA.send("visitHouse", { username: b.profile.username });
  const visit = await waitFor<any>((resolve) => {
    const check = () => {
      const found = messagesA.get("houseVisit")?.[0];
      if (found) resolve(found);
      else setTimeout(check, 100);
    };
    check();
  }, 5000, "house visit");
  if (visit.owner !== b.profile.username || visit.house.name !== "Expansion Island") {
    throw new Error("house visit payload was wrong");
  }
  console.log("✓ housing, aquarium and island visits work");

  // Friends.
  roomA.send("friendAdd", { username: b.profile.username });
  const friends = await waitFor<any>((resolve) => {
    const check = () => {
      const found = messagesA.get("friends")?.find((message) => message.friends?.some((friend: any) => friend.username === b.profile.username));
      if (found) resolve(found);
      else setTimeout(check, 100);
    };
    check();
  }, 5000, "friend list");
  if (!friends.friends.some((friend: any) => friend.username === b.profile.username)) {
    throw new Error("friend was not added");
  }
  console.log("✓ friend list updated");

  // Guilds.
  roomA.send("guildCreate", { name: "Expansion Crew", tag: "EXPC", description: "Testing the living sea." });
  const guildView = await waitFor<any>((resolve) => {
    const check = () => {
      const found = messagesA.get("guild")?.find((message) => message.guild?.tag === "EXPC");
      if (found) resolve(found);
      else setTimeout(check, 100);
    };
    check();
  }, 5000, "guild creation");
  const guildId = guildView.guild.id;
  roomB.send("guildJoin", { guildId });
  await waitFor<boolean>((resolve) => {
    const check = () => {
      const found = messagesB.get("guild")?.find((message) => message.guild?.id === guildId);
      if (found) resolve(true);
      else setTimeout(check, 100);
    };
    check();
  }, 5000, "guild join");
  roomB.send("guildLeave");
  roomA.send("guildLeave");
  await delay(500);
  console.log("✓ guild create, join and leave work");

  // Marketplace.
  roomA.send("marketList", { uid: fishA1.uid, price: 321 });
  const listing = await waitFor<any>((resolve) => {
    const check = () => {
      const found = messagesA.get("market")?.flatMap((message) => message.listings ?? []).find((entry: any) => entry.price === 321);
      if (found) resolve(found);
      else setTimeout(check, 100);
    };
    check();
  }, 5000, "market listing");
  const coinsBeforeBuy = profileB?.coins ?? 0;
  roomB.send("marketBuy", { id: listing.id });
  await waitFor<boolean>((resolve) => {
    const check = () => {
      if ((profileB?.coins ?? 0) === coinsBeforeBuy - 321) resolve(true);
      else setTimeout(check, 100);
    };
    check();
  }, 5000, "market purchase");
  console.log("✓ marketplace listing and purchase work");

  // Trading.
  roomA.send("tradeRequest", { sessionId: roomB.sessionId });
  const trade = await waitFor<any>((resolve) => {
    const check = () => {
      const found = messagesB.get("trade")?.[0];
      if (found) resolve(found);
      else setTimeout(check, 100);
    };
    check();
  }, 5000, "trade request");
  roomA.send("tradeOffer", { tradeId: trade.id, uids: [fishA2.uid], coins: 50 });
  roomB.send("tradeOffer", { tradeId: trade.id, uids: [], coins: 0 });
  await delay(400);
  const coinsBeforeTrade = profileB?.coins ?? 0;
  roomB.send("tradeAccept", { tradeId: trade.id });
  await waitFor<boolean>((resolve) => {
    const check = () => {
      const ended = messagesB.get("tradeEnd")?.[0];
      if (ended?.accepted) resolve(true);
      else setTimeout(check, 100);
    };
    check();
  }, 5000, "trade completion");
  if ((profileB?.coins ?? 0) !== coinsBeforeTrade + 50) throw new Error("trade coins were not transferred");
  if (!profileB?.inventory.some((fish) => fish.uid === fishA2.uid)) throw new Error("traded fish did not arrive");
  console.log("✓ player-to-player trading swaps fish and coins");

  // Weekly and secret quests.
  const weeklyCoins = profileB?.coins ?? 0;
  roomB.send("claimWeekly", { questId: "weekly-catch-40" });
  await waitFor<boolean>((resolve) => {
    const check = () => ((profileB?.coins ?? 0) > weeklyCoins ? resolve(true) : setTimeout(check, 100));
    check();
  }, 5000, "weekly claim");
  roomB.send("secretClaim", { id: "hermit-mutations" });
  const secret = await waitFor<any>((resolve) => {
    const check = () => {
      const found = messagesB.get("secretClaimed")?.[0];
      if (found) resolve(found);
      else setTimeout(check, 100);
    };
    check();
  }, 5000, "secret claim");
  if (secret.cosmetic !== "hermit-charm") throw new Error("secret reward cosmetic was not granted");
  console.log("✓ weekly and secret quests reward correctly");

  // World event and giant creature.
  roomA.send("requestEvents");
  await waitFor<boolean>((resolve) => {
    const check = () => (eventsA.length > 0 ? resolve(true) : setTimeout(check, 100));
    check();
  }, 10000, "world events payload");
  console.log("✓ world event payload received");
  await waitFor<boolean>((resolve) => {
    const check = () => (stateA?.creatureActive ? resolve(true) : setTimeout(check, 100));
    check();
  }, 100000, "giant creature spawn");
  const creature = stateA.creatureName;
  const hpBefore = stateA.creatureHp;
  roomA.send("joinCreature");
  await delay(400);
  roomA.send("strikeCreature");
  await waitFor<boolean>((resolve) => {
    const check = () => (stateA.creatureHp < hpBefore ? resolve(true) : setTimeout(check, 100));
    check();
  }, 5000, "creature damage");
  const creatureView = messagesA.get("creature")?.slice(-1)[0]?.creature;
  console.log("✓ giant creature", creature, "spawned and took damage", hpBefore, "->", stateA.creatureHp, "participants", creatureView?.participants);

  await roomA.leave(true);
  await roomB.leave(true);
  console.log("\nALL EXPANSION TESTS PASSED");
}

main().catch((error) => {
  console.error("\nEXPANSION TEST FAILED:", error);
  process.exit(1);
});
