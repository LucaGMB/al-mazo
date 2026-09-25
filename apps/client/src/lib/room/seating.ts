import type { PlayerPublicInfo } from "@/types/engine";

// Rota la lista de jugadores para que "yo" quede primero (posición `self` en
// la mesa) y el resto se reparta en los slots visuales disponibles
// (top/left/right). El server no fija posiciones fijas de 4 jugadores: puede
// haber entre 2 y maxPlayers (8 en color-match).
export function assignSeats(
  players: PlayerPublicInfo[],
  selfPlayerId: string | null,
): { self: PlayerPublicInfo | null; others: PlayerPublicInfo[] } {
  const selfIndex = players.findIndex((p) => p.id === selfPlayerId);
  if (selfIndex === -1) return { self: null, others: players };
  const self = players[selfIndex];
  const others = [...players.slice(selfIndex + 1), ...players.slice(0, selfIndex)];
  return { self, others };
}
