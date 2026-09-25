import type { PublicGameState } from "@/types/engine";
import type { SyncMatchInput } from "@/types/api";
import { decodePlayerName } from "./player-name";

// Solo mode: 'ONLINE_ROOM' entra en v1: no requiere motor de reglas propio en
// el cliente, ya tenemos toda la data necesaria en PublicGameState. El modo
// 'LOCAL_OFFLINE' (partidas sin conexión) queda fuera de alcance porque
// requeriría portar el rules engine del server al cliente.
//
// `score`: no hay un puntaje natural en color-match (es ganar/perder), así
// que usamos 1 para el ganador y 0 para el resto (decisión de producto
// confirmada).
export function buildMatchSyncPayload(params: {
  gameSlug: string;
  startedAt: string;
  state: PublicGameState;
}): SyncMatchInput {
  const { gameSlug, startedAt, state } = params;
  const winner = state.players.find((p) => p.id === state.winnerId);

  return {
    gameSlug,
    mode: "ONLINE_ROOM",
    startedAt,
    endedAt: new Date().toISOString(),
    durationSec: Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 1000)),
    winnerName: winner ? decodePlayerName(winner.name).display : undefined,
    participants: state.players.map((p) => {
      const { display, userId } = decodePlayerName(p.name);
      return {
        userId,
        name: display,
        isWinner: p.id === state.winnerId,
        score: p.id === state.winnerId ? 1 : 0,
      };
    }),
  };
}
