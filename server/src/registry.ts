import type { LocationId, PublicRoom } from "../../shared/types";

interface RoomEntry extends PublicRoom {
  code: string;
}

const rooms = new Map<string, RoomEntry>();

export function registerRoom(entry: RoomEntry): void {
  rooms.set(entry.roomId, entry);
}

export function updateRoom(roomId: string, clients: number): void {
  const room = rooms.get(roomId);
  if (room) room.clients = clients;
}

export function removeRoom(roomId: string): void {
  rooms.delete(roomId);
}

export function listPublicRooms(): PublicRoom[] {
  return [...rooms.values()]
    .filter((room) => !room.private)
    .sort((a, b) => a.location.localeCompare(b.location) || a.createdAt - b.createdAt)
    .map(({ code: _code, ...room }) => room);
}

export function roomCount(): number {
  return rooms.size;
}

export function findRoomByCode(code: string): PublicRoom | null {
  const room = [...rooms.values()].find((entry) => entry.code === code);
  if (!room) return null;
  const { code: _code, ...publicRoom } = room;
  return publicRoom;
}

export type { RoomEntry, LocationId };
