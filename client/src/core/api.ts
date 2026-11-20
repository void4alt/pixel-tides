import type { LeaderboardRow, PlayerProfile, PublicRoom } from "@shared/types";

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
  return request<Session>("/api/auth/guest", {
    method: "POST",
    body: JSON.stringify({ username: username || undefined }),
  });
}

export async function login(username: string, password: string): Promise<Session> {
  return request<Session>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export async function register(username: string, password: string): Promise<Session> {
  return request<Session>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export async function fetchMe(): Promise<Session> {
  const data = await request<{ user: Session["user"]; profile: PlayerProfile }>("/api/me");
  return { token: getStoredToken(), ...data };
}

export async function logout(): Promise<void> {
  try {
    await request("/api/auth/logout", { method: "POST" });
  } finally {
    clearToken();
  }
}

export async function fetchRooms(): Promise<PublicRoom[]> {
  const data = await request<{ rooms: PublicRoom[] }>("/api/rooms");
  return data.rooms;
}

export async function fetchLeaderboard(
  type: "biggest" | "rarest" | "value" | "level" | "perfect" | "mutations" | "creatures" | "mastery",
  period: "daily" | "weekly" | "all",
): Promise<LeaderboardRow[]> {
  const data = await request<{ rows: LeaderboardRow[] }>(`/api/leaderboards?type=${type}&period=${period}`);
  return data.rows;
}

export async function fetchStats(): Promise<{ catches: number; fish: number; locations: number; rooms: PublicRoom[] }> {
  return request("/api/stats");
}
