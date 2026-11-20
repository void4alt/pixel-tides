# Pixel Tides 🌊🎣

<p align="center">
  <img src="docs/images/banner.png" alt="Pixel Tides Banner" width="100%">
</p>

<p align="center">
  <b>A cozy, server-authoritative multiplayer pixel-art fishing adventure.</b><br>
  <i>Cast lines from sunlit docks, battle legendary fish in skill minigames, sail wooden skiffs with friends, dive into sunken ruins, build your custom island aquarium, and conquer dynamic ocean world bosses in real-time.</i>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-%3E%3D22.5-brightgreen?logo=node.js" alt="Node version">
  <img src="https://img.shields.io/badge/Phaser-3.90-blue?logo=phaser" alt="Phaser 3">
  <img src="https://img.shields.io/badge/Colyseus-0.15-orange" alt="Colyseus">
  <img src="https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/Multiplayer-Real--Time-success" alt="Multiplayer">
  <img src="https://img.shields.io/badge/Database-SQLite%20%2F%20PostgreSQL-indigo" alt="Database">
</p>

---

## 📸 Screenshots & Showcase

### 🎮 Real-Time Cozy Multiplayer Gameplay
<p align="center">
  <img src="docs/images/gameplay.png" alt="Pixel Tides Gameplay" width="95%">
</p>

> *Cozy pixel-art pier life: Join rooms with up to 30 anglers, pilot boats across crystal waters, reel in catches with the interactive minigame, sprint with cooked fish energy, and chat with fellow anglers.*

### 🐟 123 Fish Species & Encyclopedia
<p align="center">
  <img src="docs/images/encyclopedia.png" alt="Fish Encyclopedia Showcase" width="95%">
</p>

> *Discover, record, and collect 123 procedural species across 7 rarities, complete with weights, lengths, coin values, and 5 rare shiny mutation variants (Golden, Albino, Crystal, Shadow, and Glowing).*

---

## ✨ Features at a Glance

### 👥 Real-Time Multiplayer & Social Systems
- **Server-Authoritative Rooms**: Powered by **Colyseus WebSocket rooms** supporting up to 30 players per room with zero client-side cheating.
- **Public & Private Rooms**: Instant drop-in matchmaking into public shores or generate private 6-character room codes (`ABC123`) to play exclusively with friends.
- **1-Click Invite Links**: Share URLs like `http://localhost:2567/?room=CODE` — friends join your exact session with one click!
- **Fast Reconnection**: Automatically resumes disconnected sessions within 20 seconds without losing spot or inventory.
- **Proximity & Village Chat**: Switch between room-wide village chat and proximity-based local chat with animated emotes.
- **Player Economy & Trading**: Direct player-to-player secure trading window for fish & coins, plus an asynchronous global Marketplace.
- **Guilds & Crews**: Form fishing guilds with custom tags, ranks, and private crew communication.
- **Beach Campfire Parties**: Gather around beach campfires to trigger music, dance parties, and shared feast buffs.

### 🎣 Deep Fishing Mechanics & Minigame
- **Skill-Based Reeling Minigame**: Dynamic tension & bobber mechanics. Keep the fish inside the sweet spot to land your catch.
- **123 Distinct Species**: Across 5 diverse fishing grounds, influenced by weather patterns, tides, and time of day.
- **7 Tiers of Rarity**: Common, Uncommon, Rare, Epic, Legendary, Mythic, and Exotic.
- **5 Shiny Mutations**: Golden (3× value), Albino (2× value), Crystal (4× value), Shadow (5× value), and Glowing (2.5× value) variants featuring shimmering particle effects.
- **8 Progressive Rods & 6 Baits**: From Bamboo and Fiberglass to Abyssal and Celestial rods, each modifying cast range, sweet spot width, and bite speeds.

### ⛵ Exploration, Boats & Underwater Diving
- **Steerable Skiffs & Boats**: Buy and paint custom skiffs, sail over deep waters, and transport passengers across the open sea.
- **Gull's Rest Secret Island**: Uncover hidden island waters, uncharted fish species, and hermit quests.
- **Underwater Diving**: Equip the Tide Diver's Kit to dive beneath the surface, swim through reef floors, and crack open sunken chests and ancient urns.

### 🏡 Player Housing & Custom Aquariums
- **Island Themes & Customization**: Decorate your private island retreat with placeable furniture, campfires, and custom flooring.
- **Living Aquarium Tanks**: Store live catches in custom themed aquariums, feed them to maintain happiness, and invite other players to visit your house.

### 🐙 Giant Ocean World Bosses & Dynamic Events
- **Server-Scheduled World Events**: Golden Hour, Meteor Showers, Blood Moons, Aurora Nights, Whale Migrations, and Fishing Frenzies.
- **Giant Sea Creatures**: Coordinate attacks against server-wide bosses including the Abyssal Kraken, Great White Reef Shark, Ancient Sea Serpent, and Leviathan Whale with shared health pools and contribution bounties.

---

## 🕹️ Controls Guide

| Action | Desktop | Mobile / Touch |
| :--- | :--- | :--- |
| **Move** | `WASD` or Arrow Keys | Virtual Joystick |
| **Sprint** | Hold `Shift` | `Sprint` Button |
| **Cast / Hook / Reel** | `Spacebar` or Left Click | `CAST` / `REEL` Buttons |
| **Interact / Cook / Open Chest** | `E` key | `E` Button |
| **Open Inventory (Bag)** | `I` key | Bag Button |
| **Fish Encyclopedia** | `F` key | Fish Button |
| **Quests & Achievements** | `Q` key | Quests Button |
| **World Map & Room Browser** | `M` key (or click Player Counter) | Map Button |
| **Voyage (Boats & Diving)** | `V` key | Voyage Button |
| **Island & Aquarium** | `H` key | Island Button |
| **Crew & Social (Guilds/Trade/Market)**| `G` key | Crew Button |
| **World Events & Bosses** | `N` key | Events Button |
| **Chat & Emotes** | `T` key | Chat Button |
| **Close Panels** | `Esc` key | `×` Close Button |

---

## 🌐 Multiplayer: How It Works

Pixel Tides provides seamless, zero-friction multiplayer:

```mermaid
flowchart LR
    A["Angler 1 (Browser)"] <-->|WebSocket| S["Colyseus WorldRoom (Port 2567)"]
    B["Angler 2 (Browser)"] <-->|WebSocket| S
    C["Angler 3 (Mobile)"] <-->|WebSocket| S
    S <--> D[("SQLite / PostgreSQL")]
```

1. **Automatic Public Matchmaking**:
   - Starting the game connects you directly into the active public room for your current location.
   - Each room accommodates up to 30 simultaneous anglers with server-authoritative movement, casting, and catch resolution.

2. **Private Rooms & Friend Invites**:
   - Open the **Map (`M`)** and click **Create Private Room** to generate a unique 6-character code (e.g., `TIDE77`).
   - The shareable link (`http://localhost:2567/?room=TIDE77`) is automatically copied to your clipboard!
   - Friends can either click the invite link or enter the code in the **Room Code** box on the title screen or in the Map panel.

3. **Room Switching**:
   - Click the room counter in the top HUD (`1/30`) or press `M` to view the live list of rooms, active anglers, and available shores.

---

## 🗺️ Locations & Unlocks

| Location | Min Level | Requirement | Water Type | Notable Species |
| :--- | :---: | :---: | :---: | :--- |
| **Sunny Shore** | Level 1 | Starter Shore | Shallows & Pier | Chub, Sunfish, Golden Carp, Striped Bass |
| **Coral Bay** | Level 4 | Level 4 | Coral Reefs | Parrotfish, Clownfish, Lionfish, Tiger Ray |
| **Misty Swamp** | Level 8 | Level 8 | Murky Marshes | Catfish, Bog Eel, Ghost Gar, Alligator Gar |
| **Deep Trench** | Level 12 | Level 12 | Abyssal Depths | Anglerfish, Oarfish, Abyssal Squid, Coelacanth |
| **Gull's Rest** | Level 15 | Skiff / Boat | Secret Ocean Island | Void Ray, Celestial Leviathan, Phantom Koi |

---

## 🛠️ Architecture & Tech Stack

- **Client**: [Phaser 3.90](https://phaser.io/) + TypeScript + Vite.
- **Procedural Engine**: 100% procedural runtime pixel-art generation for fish species, characters, boats, water shaders, and environmental props — no external binary sprite downloads required.
- **Audio Engine**: Procedural Web Audio API sound synthesis and dynamic chiptune melodies.
- **Multiplayer Server**: [Colyseus 0.15](https://colyseus.io/) WebSocket rooms + Express HTTP.
- **Persistence**: Hybrid database engine supporting built-in zero-config **SQLite** (`node:sqlite`) or production **PostgreSQL / Supabase**.

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js 22.5 or higher**
- **npm 10 or higher**

### 1. Installation
```bash
# Clone the repository
git clone https://github.com/void4alt/pixel-tides.git
cd pixel-tides

# Install dependencies
npm install
```

### 2. Development Mode
```bash
npm run dev
```
- Starts the Colyseus/Express server on port `2567` with hot-reload (`tsx watch`).
- Starts the Vite client dev server on port `5173` with WebSocket & API proxying.
- Open [http://localhost:5173](http://localhost:5173) in your browser.

### 3. Production Build & Run
```bash
# Typecheck + bundle client assets (Vite) + bundle server (tsup)
npm run build

# Start the unified production server
npm start
```
- Open [http://localhost:2567](http://localhost:2567).

---

## 🧪 Comprehensive Test Suites

Pixel Tides includes end-to-end integration and multiplayer test suites:

```bash
# Start server in the background (or run in another terminal):
npm start &

# 1. Multiplayer Synchronization Test
# Verifies 2 simultaneous clients, room codes, presence broadcasts, movement replication, and travel
npm run test:mp

# 2. End-to-End Gameplay Test
# Verifies guest auth, movement, casting, bite detection, minigame catch, inventory, and shops
npm test

# 3. Expansion Systems Test
# Verifies boats, diving, housing, guilds, player trading, marketplace, and giant creature boss fights
npm run test:expansion
```

---

## 🚢 Deployment & Production

Pixel Tides compiles to a single, self-contained Node service serving client assets, REST endpoints, and WebSocket rooms.

### Environment Configuration (`.env`)
```ini
PORT=2567
NODE_ENV=production

# Optional: PostgreSQL / Supabase
# DATABASE_URL=postgresql://postgres:PASSWORD@db.example.supabase.co:5432/postgres
# PGSSL=true

# Optional: SQLite Custom Path
# SQLITE_PATH=server/data/pixel-tides.db
```

### Container / Cloud Deployment (Docker / Render / Railway / Fly.io)
Ensure the host supports WebSocket upgrades. For Nginx:
```nginx
location / {
  proxy_pass http://127.0.0.1:2567;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_set_header Host $host;
}
```

---

## 📜 License & Credits

Built with ❤️ for cozy gamers, pixel-art lovers, and virtual anglers.
Created by [void4alt](https://github.com/void4alt).
Licensed under the [MIT License](LICENSE).
