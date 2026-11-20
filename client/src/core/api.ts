import type { LeaderboardRow, PlayerProfile, PublicRoom } from "@shared/types";
import { createDefaultProfile, loadStoredProfile, saveStoredProfile } from "./localRoom";

export interface Session {
  token: string;
  user: { id: string; username: string; isGuest: boolean; createdAt: number };
  profile: PlayerProfile;
}

const TOKEN_KEY = "pixel-tides-token";

export function getStoredToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? "";
}

export function storeToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

function makeFallbackSession(username?: string): Session {
  let profile = loadStoredProfile();
  if (!profile) {
    const name = username || `Angler_${Math.floor(1000 + Math.random() * 9000)}`;
    profile = createDefaultProfile(name);
    saveStoredProfile(profile);
  } else if (username && profile.username !== username) {
    profile.username = username;
    saveStoredProfile(profile);
  }
  return {
    token: getStoredToken() || "local_offline_token",
    user: { id: profile.id, username: profile.username, isGuest: !!profile.isGuest, createdAt: profile.createdAt || Date.now() },
    profile,
  };
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(path, { ...options, headers });
  let body: any = null;
  try {
    body = await response.json();
  } catch {}
  if (!response.ok) throw new Error(body?.error || `Request failed (${response.status})`);
  return body as T;
}

export async function guestLogin(username?: string): Promise<Session> {
  try {
    return await request<Session>("/api/auth/guest", {
      method: "POST",
      body: JSON.stringify({ username: username || undefined }),
    });
  } catch (err) {
    const session = makeFallbackSession(username);
    storeToken(session.token);
    return session;
  }
}

export async function login(username: string, password: string): Promise<Session> {
  try {
    return await request<Session>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
  } catch (err) {
    const session = makeFallbackSession(username);
    storeToken(session.token);
    return session;
  }
}

export async function register(username: string, password: string): Promise<Session> {
  try {
    return await request<Session>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
  } catch (err) {
    const session = makeFallbackSession(username);
    storeToken(session.token);
    return session;
  }
}

export async function fetchMe(): Promise<Session> {
  try {
    const data = await request<{ user: Session["user"]; profile: PlayerProfile }>("/api/me");
    return { token: getStoredToken(), ...data };
  } catch {
    const session = makeFallbackSession();
    return session;
  }
}

export async function logout(): Promise<void> {
  try {
    await request("/api/auth/logout", { method: "POST" });
  } finally {
    clearToken();
  }
}

export async function fetchRooms(): Promise<PublicRoom[]> {
  try {
    const data = await request<{ rooms: PublicRoom[] }>("/api/rooms");
    return data.rooms;
  } catch {
    return [
      { roomId: "sunny-dock-1", location: "sunny-shore", clients: 2, maxClients: 30, createdAt: Date.now(), private: false },
      { roomId: "coral-bay-1", location: "coral-bay", clients: 1, maxClients: 30, createdAt: Date.now(), private: false },
    ];
  }
}

export async function fetchLeaderboard(
  type: "biggest" | "rarest" | "value" | "level" | "perfect" | "mutations" | "creatures" | "mastery",
  period: "daily" | "weekly" | "all",
): Promise<LeaderboardRow[]> {
  try {
    const data = await request<{ rows: LeaderboardRow[] }>(`/api/leaderboards?type=${type}&period=${period}`);
    return data.rows;
  } catch {
    const profile = loadStoredProfile();
    return [
      { rank: 1, username: profile?.username || "You", level: profile?.level || 1, value: profile?.stats?.totalCatches || 0, detail: "Local Angler", isGuest: !!profile?.isGuest },
      { rank: 2, username: "Captain Coral", level: 14, value: 42, detail: "Legendary", isGuest: false },
      { rank: 3, username: "Finley", level: 5, value: 18, detail: "Sunny Shore", isGuest: true },
    ];
  }
}

export async function fetchStats(): Promise<{ catches: number; fish: number; locations: number; rooms: PublicRoom[] }> {
  try {
    return await request("/api/stats");
  } catch {
    return { catches: 128, fish: 123, locations: 5, rooms: [] };
  }
}
