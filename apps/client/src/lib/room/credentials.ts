// Credenciales de reconexión por sala, persistidas en localStorage. El server
// identifica a un jugador reconectante por (roomCode, playerId,
// reconnectToken) — ver room:reconnect en al-mazo-server/src/realtime/types.ts.
// `isHost` no viene en ningún evento del server (es privado del GameRoom del
// lado servidor); lo recordamos nosotros mismos desde el momento en que
// creamos o nos unimos a la sala.

export interface RoomCredentials {
  gameSlug: string;
  playerId: string;
  reconnectToken: string;
  isHost: boolean;
}

function storageKey(roomCode: string): string {
  return `almazo.room.${roomCode.toUpperCase()}`;
}

export function getRoomCredentials(roomCode: string): RoomCredentials | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(roomCode));
    return raw ? (JSON.parse(raw) as RoomCredentials) : null;
  } catch {
    return null;
  }
}

export function saveRoomCredentials(roomCode: string, creds: RoomCredentials): void {
  window.localStorage.setItem(storageKey(roomCode), JSON.stringify(creds));
}

export function clearRoomCredentials(roomCode: string): void {
  window.localStorage.removeItem(storageKey(roomCode));
}
