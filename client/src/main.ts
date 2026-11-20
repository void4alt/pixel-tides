import "./style.css";
import Phaser from "phaser";
import type { PlayerProfile, LocationId } from "@shared/types";
import { LOCATIONS_BY_ID, locationUnlocked } from "@shared/items";
import { bus } from "./core/bus";
import { AudioManager } from "./core/audio";
import { NetworkManager } from "./core/network";
import { UIManager } from "./ui/UIManager";
import { fetchMe, guestLogin, login, logout, register, storeToken, clearToken, getStoredToken, type Session } from "./core/api";
import { appStore } from "./core/store";
import { BootScene } from "./game/scenes/BootScene";
import { WorldScene } from "./game/scenes/WorldScene";

const authScreen = document.getElementById("auth-screen")!;
const gameShell = document.getElementById("game-shell")!;
const loading = document.getElementById("loading")!;
const loadingText = document.getElementById("loading-text")!;
const authError = document.getElementById("auth-error")!;
const guestForm = document.getElementById("guest-form") as HTMLFormElement;
const loginForm = document.getElementById("login-form") as HTMLFormElement;
const registerForm = document.getElementById("register-form") as HTMLFormElement;

let audio: AudioManager | null = null;
let network: NetworkManager | null = null;
let ui: UIManager | null = null;
let game: Phaser.Game | null = null;
let starting = false;

function setAuthError(message: string): void {
  authError.textContent = message;
}

function setAuthBusy(busy: boolean): void {
  for (const button of authScreen.querySelectorAll<HTMLButtonElement>("button")) button.disabled = busy;
}

function showLoading(text: string): void {
  loadingText.textContent = text;
  loading.classList.remove("is-hidden");
}

function hideLoading(): void {
  loading.classList.add("is-hidden");
}

function showAuth(): void {
  authScreen.classList.remove("is-hidden");
  gameShell.classList.add("is-hidden");
  hideLoading();
}

for (const tab of document.querySelectorAll<HTMLButtonElement>("[data-auth-tab]")) {
  tab.addEventListener("click", () => {
    const target = tab.dataset.authTab;
    for (const other of document.querySelectorAll<HTMLElement>("[data-auth-tab]")) {
      other.classList.toggle("is-active", other === tab);
    }
    guestForm.classList.toggle("is-hidden", target !== "guest");
    loginForm.classList.toggle("is-hidden", target !== "login");
    registerForm.classList.toggle("is-hidden", target !== "register");
    setAuthError("");
  });
}

function fallbackLocation(profile: PlayerProfile): LocationId {
  const def = LOCATIONS_BY_ID[profile.location] ?? LOCATIONS_BY_ID["sunny-shore"];
  if (locationUnlocked(profile.level, profile.boatOwned, def)) return def.id;
  return "sunny-shore";
}

function getUrlRoomCode(): string {
  try {
    const params = new URLSearchParams(window.location.search);
    return (params.get("room") || params.get("code") || "").trim().toUpperCase();
  } catch {
    return "";
  }
}

async function beginSession(session: Session, roomCode = ""): Promise<void> {
  if (starting) return;
  starting = true;
  storeToken(session.token);
  setAuthError("");
  authScreen.classList.add("is-hidden");
  gameShell.classList.remove("is-hidden");
  showLoading("Finding a quiet spot on the dock…");
  setAuthBusy(true);

  const profile = session.profile;
  const location = fallbackLocation(profile);
  appStore.profile = profile;

  audio = new AudioManager();
  try {
    await audio.init();
    audio.setVolumes(profile.settings.music, profile.settings.sfx);
  } catch {
    // Audio is optional; the game remains fully playable without it.
  }
  network = new NetworkManager();

  const code = roomCode || getUrlRoomCode();
  try {
    await network.connect(session.token, location, code);
  } catch (error: any) {
    network = null;
    audio?.dispose();
    audio = null;
    starting = false;
    setAuthBusy(false);
    clearToken();
    showAuth();
    setAuthError(error?.message || "Could not reach the tide server. Is it running?");
    return;
  }

  ui = new UIManager(network, audio!);
  ui.showGame(profile);
  if (code) {
    ui.toast(`Sailing into room ${code}!`, "gold");
  }
  const state = network.getState();
  bus.emit("environment", {
    location: state?.location ?? location,
    weather: state?.weather ?? "sunny",
    timeMinutes: state?.timeMinutes ?? 480,
  });
  if (state) bus.emit("state", state);
  network.send("requestProfile");

  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game-container",
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: "#0a2748",
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    disableContextMenu: true,
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.NO_CENTER,
    },
    render: {
      pixelArt: true,
      antialias: false,
      roundPixels: true,
      powerPreference: "high-performance",
    },
    fps: { target: 60, forceSetTimeOut: false },
    scene: [new BootScene(), new WorldScene(network)],
  });

  window.setTimeout(() => hideLoading(), 450);
  setAuthBusy(false);
  starting = false;
  (window as any).__pixelTides = {
    get game() { return game; },
    get network() { return network; },
    get ui() { return ui; },
    get audio() { return audio; },
  };
}

async function runAuth(kind: "guest" | "login" | "register", form: HTMLFormElement): Promise<void> {
  setAuthBusy(true);
  setAuthError("");
  try {
    let session: Session;
    let roomCode = "";
    if (kind === "guest") {
      const name = (document.getElementById("guest-name") as HTMLInputElement).value.trim();
      const codeInput = document.getElementById("guest-room-code") as HTMLInputElement | null;
      roomCode = (codeInput?.value || getUrlRoomCode()).trim().toUpperCase();
      session = await guestLogin(name || undefined);
    } else if (kind === "login") {
      const name = (document.getElementById("login-name") as HTMLInputElement).value.trim();
      const password = (document.getElementById("login-password") as HTMLInputElement).value;
      if (!name || !password) throw new Error("Enter your name and password.");
      roomCode = getUrlRoomCode();
      session = await login(name, password);
    } else {
      const name = (document.getElementById("register-name") as HTMLInputElement).value.trim();
      const password = (document.getElementById("register-password") as HTMLInputElement).value;
      if (!name || password.length < 6) throw new Error("Choose a name and a 6+ character password.");
      roomCode = getUrlRoomCode();
      session = await register(name, password);
    }
    await beginSession(session, roomCode);
  } catch (error: any) {
    setAuthError(error?.message || "The tide refused that request. Try again.");
    setAuthBusy(false);
  }
}

guestForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void runAuth("guest", guestForm);
});
loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void runAuth("login", loginForm);
});
registerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void runAuth("register", registerForm);
});

bus.on("logout", async () => {
  try {
    await logout();
  } catch {}
  window.location.reload();
});

window.addEventListener("beforeunload", () => {
  void network?.disconnect();
  game?.destroy(true);
  ui?.dispose();
});

document.addEventListener(
  "pointerdown",
  () => {
    void audio?.init();
  },
  { once: true },
);

async function restoreSession(): Promise<void> {
  const token = getStoredToken();
  const roomCode = getUrlRoomCode();
  if (roomCode) {
    const codeInput = document.getElementById("guest-room-code") as HTMLInputElement | null;
    if (codeInput) codeInput.value = roomCode;
  }
  if (!token) return;
  try {
    const session = await fetchMe();
    await beginSession(session, roomCode);
  } catch {
    clearToken();
    showAuth();
  }
}

void restoreSession();
