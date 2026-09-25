"use client";

import { Icon } from "@iconify/react";
import Button from "@/components/Button";
import PromptCardView from "./PromptCardView";
import { promptFromCard } from "@/lib/game/desconectados";
import { decodePlayerName } from "@/lib/room/player-name";
import type { PublicGameState } from "@/types/engine";

/**
 * Mesa online de Desconectados: sin manos ni ganador. El jugador con el turno
 * responde la pregunta visible y saca la siguiente (REVEAL_CARD) o cierra la
 * ronda cuando se agotó el mazo (END_GAME).
 */
export default function DesconectadosTable({
  publicState,
  selfPlayerId,
  isActing,
  onExecuteAction,
}: {
  publicState: PublicGameState;
  selfPlayerId: string | null;
  isActing: boolean;
  onExecuteAction: (action: string, payload?: Record<string, unknown>) => void;
}) {
  const prompt = promptFromCard(publicState.topDiscardCard);
  const isMyTurn = publicState.currentTurnPlayerId === selfPlayerId;
  const deckEmpty = publicState.drawPileCount === 0;
  const answeredCount = Math.max(0, publicState.discardPileCount - 1);

  const currentIndex = publicState.players.findIndex(
    (player) => player.id === publicState.currentTurnPlayerId
  );
  const totalPlayers = publicState.players.length;
  const nextIndex =
    currentIndex >= 0 && totalPlayers > 0
      ? (currentIndex + publicState.turnDirection + totalPlayers) % totalPlayers
      : -1;
  const nextPlayer = nextIndex >= 0 ? publicState.players[nextIndex] : undefined;
  const nextName = nextPlayer ? decodePlayerName(nextPlayer.name).display : "";
  const currentPlayer =
    currentIndex >= 0 ? publicState.players[currentIndex] : undefined;
  const currentName = currentPlayer ? decodePlayerName(currentPlayer.name).display : "";

  return (
    <div className="flex flex-1 flex-col gap-3 px-3.5 md:px-6 py-3 overflow-y-auto">
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {publicState.players.map((player) => {
          const isTurn = player.id === publicState.currentTurnPlayerId;
          return (
            <span
              key={player.id}
              className={`inline-flex items-center gap-1.5 border-2 px-2.5 py-1 font-display text-[10px] md:text-[11px] font-bold transition-colors ${
                isTurn
                  ? "border-accent bg-accent/20 text-accent"
                  : "border-subtle bg-statusbar/70 text-ink-soft"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  player.isConnected ? "bg-success" : "bg-ink-faint"
                }`}
              />
              {decodePlayerName(player.name).display}
              {player.isBot && <Icon icon="pixelarticons:robot" width={11} height={11} />}
              {isTurn && <Icon icon="pixelarticons:arrow-left" width={11} height={11} />}
            </span>
          );
        })}
      </div>

      <div className="flex flex-none items-center justify-center gap-3 font-mono text-[10px] md:text-[11px] text-ink-faint">
        <span className="inline-flex items-center gap-1.5">
          <Icon icon="pixelarticons:notes" width={13} height={13} className="text-accent" />
          {answeredCount} respondidas
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Icon icon="pixelarticons:layers" width={13} height={13} className="text-accent" />
          mazo · {publicState.drawPileCount}
        </span>
      </div>

      <div className="flex flex-1 items-center justify-center py-2">
        {prompt ? (
          <PromptCardView prompt={prompt} />
        ) : (
          <div className="flex min-h-[190px] w-full max-w-[440px] items-center justify-center border-[3px] border-dashed border-subtle bg-statusbar/50 px-6 text-center font-display text-sm text-ink-faint">
            Todavía no hay pregunta sobre la mesa
          </div>
        )}
      </div>

      <div className="flex flex-none flex-col items-center gap-2 pb-1 text-center">
        {deckEmpty && (
          <span className="rounded-[6px] border-2 border-warning bg-warning/15 px-3 py-1 font-display text-[10px] font-black uppercase tracking-[0.16em] text-warning">
            Última pregunta
          </span>
        )}

        {isMyTurn ? (
          <>
            <Button
              variant="primary"
              disabled={isActing}
              onClick={() =>
                onExecuteAction(deckEmpty ? "END_GAME" : "REVEAL_CARD")
              }
            >
              <Icon
                icon={deckEmpty ? "pixelarticons:flag" : "pixelarticons:arrow-right"}
                width={16}
                height={16}
              />
              {deckEmpty ? "Cerrar la ronda" : "Respondí, sacar la siguiente"}
            </Button>
            <p className="m-0 max-w-[420px] text-[11px] md:text-xs text-ink-faint">
              {deckEmpty
                ? "Se acabaron las cartas: compartan la última respuesta y cierren la ronda."
                : `Respondé en voz alta y pasá el turno${nextName ? ` a ${nextName}` : ""}.`}
            </p>
          </>
        ) : (
          <p className="m-0 max-w-[420px] font-display text-[11px] md:text-xs text-ink-soft">
            {currentName
              ? `Le toca a ${currentName}: respondé y sacá la siguiente pregunta.`
              : "Esperando el próximo turno..."}
          </p>
        )}
      </div>
    </div>
  );
}
