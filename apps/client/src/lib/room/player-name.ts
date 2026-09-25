// El protocolo de sala del server solo transporta un `playerName: string` por
// jugador (ver ClientToServerEvents en al-mazo-server/src/realtime/types.ts) —
// no hay ningún campo para asociar el `userId` de guest de cada jugador a la
// partida. Como sí queremos que /api/users/:id/stats refleje historial real
// (decisión de producto confirmada), codificamos el userId dentro del propio
// nombre que se envía al crear/unirse a una sala, y lo decodificamos en cada
// punto donde se muestra un nombre. El server solo lo relaya como texto
// opaco, así que esto no requiere ningún cambio en el backend.

const DELIMITER = "::";

export function encodePlayerName(displayName: string, userId?: string): string {
  const safeDisplay = displayName.trim().replaceAll(DELIMITER, ":");
  return userId ? `${safeDisplay}${DELIMITER}${userId}` : safeDisplay;
}

export function decodePlayerName(raw: string): { display: string; userId?: string } {
  const idx = raw.lastIndexOf(DELIMITER);
  if (idx === -1) return { display: raw };
  return { display: raw.slice(0, idx), userId: raw.slice(idx + DELIMITER.length) };
}

// Algunos textos los arma el server concatenando `player.name` (por ejemplo
// `lastActionText`: "Ronda 1. Mano: Host::<uuid>"). Este helper limpia el
// userId embebido en cualquier texto para mostrarlo sin el sufijo técnico.
export function decodePlayerNamesInText(text: string): string {
  return text.replace(/::[A-Za-z0-9_-]+/g, "");
}
