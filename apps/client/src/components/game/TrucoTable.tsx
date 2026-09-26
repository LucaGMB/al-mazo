"use client";

import { useState } from "react";
import { Icon } from "@iconify/react";
import type { Card, PublicGameState } from "@/types/engine";
import CardView from "./CardView";
import Button from "@/components/Button";
import { decodePlayerName, decodePlayerNamesInText } from "@/lib/room/player-name";
import {
  calculateEnvidoScore,
  checkHasFlor,
  calculateFlorPoints,
} from "@/types/shared/truco-rules";

type TrucoPendingBet = {
  type: "ENVIDO" | "TRUCO" | "FLOR";
  call: string;
  callerId: string;
  challengedId: string;
  pointsAtStake: number;
  pointsIfRefused: number;
};

type TrucoCustomState = {
  round?: number;
  manoPlayerId?: string;
  targetScore?: number;
  currentTrick?: number;
  roundTricks?: Array<{
    trickNumber: number;
    cards: Array<{ playerId: string; card: Card; isTapada?: boolean }>;
    winnerId: string | "EMPATE" | null;
  }>;
  envido?: { state: string };
  truco?: { state: string; currentLevel: string | null; lastCallerId?: string | null };
  flor?: { state?: string; playersWithFlor?: string[]; cantadas?: string[] };
  pendingBet?: TrucoPendingBet | null;
  lastActionText?: string;
};

interface TrucoTableProps {
  publicState: PublicGameState;
  selfPlayerId: string | null;
  hand: Card[];
  canAct: boolean;
  onExecuteAction: (action: string, payload?: Record<string, unknown>) => Promise<void>;
  onPlayCard?: (cardId: string, tapada?: boolean) => void;
  isActing: boolean;
  onPlaySound?: (sound: string) => void;
  isTapada?: boolean;
  onToggleTapada?: () => void;
}

// Ficha de puntaje chica, mismo lenguaje visual que PlayerBadge (chip con
// borde grueso y sombra dura, sin caja gigante ni degradado detrás).
function ScoreChip({
  name,
  score,
  targetScore,
  isMano,
  accentClass,
}: {
  name: string;
  score: number;
  targetScore: number;
  isMano: boolean;
  accentClass: string;
}) {
  return (
    <div className="inline-flex items-center gap-2 bg-statusbar border-2 border-subtle px-3 py-1.5 shadow-[3px_3px_0_0_rgba(0,0,0,0.35)]">
      <div className="flex flex-col leading-none">
        <span className={`text-[11px] md:text-xs font-bold truncate max-w-[110px] ${accentClass}`}>
          {name}
        </span>
        <span className="text-[9px] text-ink-faint">{score < 15 ? "Malas" : "Buenas"}</span>
      </div>
      <span className="font-display text-lg md:text-xl font-black text-ink">
        {score}
        <span className="text-[10px] font-normal text-ink-faint">/{targetScore}</span>
      </span>
      {isMano && (
        <span className="shrink-0 border-2 border-warning bg-warning/15 px-1.5 py-0.5 text-[8px] font-black text-warning">
          MANO
        </span>
      )}
    </div>
  );
}

export default function TrucoTable({
  publicState,
  selfPlayerId,
  hand,
  canAct,
  onExecuteAction,
  onPlayCard,
  isActing,
  isTapada,
  onToggleTapada,
}: TrucoTableProps) {
  const [localTapadaMode, setLocalTapadaMode] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const tapadaMode = isTapada !== undefined ? isTapada : localTapadaMode;
  const toggleTapada = onToggleTapada ?? (() => setLocalTapadaMode((prev) => !prev));

  function handleCardClick(cardId: string) {
    if (!canAct || pendingBet || isActing) return;
    setSelectedCardId(cardId);
    if (onPlayCard) {
      onPlayCard(cardId, tapadaMode);
    } else {
      void handleAction("PLAY_CARD", { cardId, isTapada: tapadaMode });
    }
  }

  const customState = (publicState.customState ?? {}) as TrucoCustomState;
  const manoPlayerId = customState.manoPlayerId ?? "";
  const targetScore = customState.targetScore ?? 30;
  const currentTrick = customState.currentTrick ?? 1;
  const roundTricks = customState.roundTricks ?? [];
  const envidoState = customState.envido ?? { state: "AVAILABLE" };
  const florState = customState.flor ?? { state: "AVAILABLE" };
  const trucoState = customState.truco ?? { state: "AVAILABLE", currentLevel: null };
  const pendingBet = customState.pendingBet ?? null;
  const lastActionText = decodePlayerNamesInText(customState.lastActionText ?? "");

  // Identify players
  const players = publicState.players ?? [];
  const self = players.find((p) => p.id === selfPlayerId) ?? players[0];
  const rival = players.find((p) => p.id !== selfPlayerId) ?? players[1];
  const selfName = decodePlayerName(self?.name ?? "Vos").display;
  const rivalName = decodePlayerName(rival?.name ?? "Rival").display;

  const selfScore = (publicState.scores?.[self?.id ?? ""] ?? 0);
  const rivalScore = (publicState.scores?.[rival?.id ?? ""] ?? 0);

  const isPendingForMe = pendingBet && pendingBet.challengedId === selfPlayerId;
  const isPendingForRival = pendingBet && pendingBet.callerId === selfPlayerId;

  // Calculate self envido and flor points
  const selfEnvido = calculateEnvidoScore(hand);
  const hasFlor = checkHasFlor(hand);
  const florPoints = hasFlor ? calculateFlorPoints(hand) : 0;

  // Flor bet eligibility
  const canCallFlor =
    canAct &&
    !pendingBet &&
    currentTrick === 1 &&
    hasFlor &&
    (florState.state === "AVAILABLE" || florState.state === "DISABLED");

  // Truco bet level calculations
  const trucoLevel = trucoState.currentLevel;
  const canCallTruco =
    canAct &&
    !pendingBet &&
    trucoLevel === null &&
    trucoState.state === "AVAILABLE";

  const canCallRetruco =
    canAct &&
    !pendingBet &&
    trucoLevel === "TRUCO" &&
    trucoState.lastCallerId !== selfPlayerId;

  const canCallValeCuatro =
    canAct &&
    !pendingBet &&
    trucoLevel === "RETRUCO" &&
    trucoState.lastCallerId !== selfPlayerId;

  const canCallEnvido =
    canAct &&
    !pendingBet &&
    currentTrick === 1 &&
    !hasFlor &&
    florState.state !== "RESOLVED" &&
    florState.state !== "PENDING" &&
    envidoState.state === "AVAILABLE";

  async function handleAction(action: string, payload?: Record<string, unknown>) {
    if (isActing) return;
    try {
      await onExecuteAction(action, payload);
    } catch {
      // Handled by parent
    }
  }

  return (
    <div className="flex flex-col gap-2 md:gap-3 w-full max-w-2xl mx-auto select-none">
      {/* Ficha del rival, arriba */}
      <div className="flex justify-center">
        <ScoreChip
          name={rivalName}
          score={rivalScore}
          targetScore={targetScore}
          isMano={manoPlayerId === rival?.id}
          accentClass="text-danger"
        />
      </div>

      {/* Mesa de fieltro: mismo look que color-match, sin gradiente ni cajas
          por baza — solo espaciado y un indicador chico de ganador. */}
      <div className="felt-texture relative border-[6px] border-[#0b0812] shadow-[6px_6px_0_0_rgba(0,0,0,0.5)] px-2 py-3 md:px-4 md:py-4">
        <span className="pixel-rivet" style={{ top: 6, left: 6 }} />
        <span className="pixel-rivet" style={{ top: 6, right: 6 }} />
        <span className="pixel-rivet" style={{ bottom: 6, left: 6 }} />
        <span className="pixel-rivet" style={{ bottom: 6, right: 6 }} />

        <div className="text-center text-[9px] md:text-[11px] font-black uppercase tracking-widest text-ink-faint mb-2">
          Ronda {customState.round ?? 1} · {currentTrick}ª baza
        </div>

        <div className="grid grid-cols-3 gap-1.5 md:gap-3">
          {[1, 2, 3].map((bazaNum) => {
            const trick = roundTricks.find((t) => t.trickNumber === bazaNum);
            const isCurrent = currentTrick === bazaNum;
            const rivalTrickCard =
              trick?.cards.find((c) => c.playerId === rival?.id) ??
              (isCurrent ? publicState.trickCards?.find((c) => c.playerId === rival?.id) : null);
            const selfTrickCard =
              trick?.cards.find((c) => c.playerId === self?.id) ??
              (isCurrent ? publicState.trickCards?.find((c) => c.playerId === self?.id) : null);

            const winnerColor =
              trick?.winnerId === self?.id
                ? "text-success"
                : trick?.winnerId === rival?.id
                  ? "text-danger"
                  : trick?.winnerId === "EMPATE"
                    ? "text-warning"
                    : "text-ink-faint/50";

            return (
              <div
                key={bazaNum}
                className={`flex flex-col items-center justify-between gap-1 py-1 transition-opacity duration-200 ${
                  isCurrent ? "" : "opacity-80"
                }`}
              >
                <span className={`text-[9px] md:text-[10px] font-black ${winnerColor}`}>
                  {bazaNum}ª
                </span>
                <div className="flex flex-col items-center gap-1.5">
                  {rivalTrickCard ? (
                    <CardView card={rivalTrickCard.card} size="sm" />
                  ) : (
                    <div className="w-7 h-9 md:w-11 md:h-[60px] border-2 border-dashed border-white/15" />
                  )}
                  {selfTrickCard ? (
                    <CardView card={selfTrickCard.card} size="sm" />
                  ) : (
                    <div className="w-7 h-9 md:w-11 md:h-[60px] border-2 border-dashed border-white/15" />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-2 md:mt-3 flex flex-wrap items-center justify-center gap-2 text-[10px] md:text-xs">
          <span className="inline-flex items-center gap-1.5 border-2 border-subtle bg-statusbar/80 px-2.5 py-1 text-ink-soft">
            <Icon icon="pixelarticons:cards" className="text-accent" width={13} height={13} />
            Tantos: <span className="font-black text-warning">{selfEnvido.points}</span>
            {selfEnvido.suit && <span className="text-ink-faint">({selfEnvido.suit})</span>}
          </span>
          {hasFlor && (
            <span className="inline-flex items-center gap-1.5 border-2 border-success bg-success/15 px-2.5 py-1 font-black text-success animate-pulse">
              <Icon icon="pixelarticons:sparkles" width={12} height={12} />
              ¡Tenés Flor! ({florPoints} pts)
            </span>
          )}
        </div>
      </div>

      {lastActionText && (
        <div className="flex items-center justify-center gap-1.5 border-2 border-accent bg-accent/10 px-3 py-1.5 text-center text-[11px] md:text-sm font-bold text-accent">
          <Icon icon="pixelarticons:zap" width={14} height={14} className="text-warning shrink-0" />
          <span>{lastActionText}</span>
        </div>
      )}

      {isPendingForRival && (
        <div className="flex items-center justify-center gap-2 border-2 border-warning bg-warning/10 px-3 py-2 text-center text-[11px] md:text-sm font-bold text-warning">
          <Icon icon="pixelarticons:clock" className="animate-spin" width={16} height={16} />
          Esperando que {rivalName} responda a tu canto de {pendingBet.call}...
        </div>
      )}

      {/* Canto pendiente para mí */}
      {isPendingForMe && (
        <div className="border-2 border-warning bg-warning/10 p-3 md:p-4 shadow-[4px_4px_0_0_rgba(0,0,0,0.4)]">
          <div className="text-center mb-2 md:mb-3">
            <div className="text-[10px] md:text-xs font-black uppercase tracking-widest text-warning">
              ¡Canto en curso!
            </div>
            <div className="text-base md:text-lg font-black text-ink mt-0.5">
              {rivalName} cantó {pendingBet.call.replace(/_/g, " ")}
            </div>
            <div className="text-[11px] md:text-xs text-ink-soft">
              {pendingBet.type === "FLOR"
                ? `Desafío de Flor (por ${pendingBet.pointsAtStake} pts / ${pendingBet.pointsIfRefused} si te achicás)`
                : `¿Aceptás la apuesta? (Por ${pendingBet.pointsAtStake} pts / ${pendingBet.pointsIfRefused} al no querer)`}
            </div>
          </div>

          {pendingBet.type === "FLOR" && (
            <div className="flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button variant="success" disabled={isActing} onClick={() => handleAction("CON_FLOR_QUIERO")}>
                  <Icon icon="pixelarticons:check" width={16} height={16} />
                  ¡CON FLOR QUIERO!
                </Button>
                <Button variant="danger" disabled={isActing} onClick={() => handleAction("CON_FLOR_ME_ACHICO")}>
                  <Icon icon="pixelarticons:close" width={16} height={16} />
                  CON FLOR ME ACHICO
                </Button>
              </div>

              {pendingBet.call === "FLOR" && (
                <div className="flex flex-wrap items-center justify-center gap-2 border-t border-white/10 pt-2">
                  <Button variant="cta" disabled={isActing} onClick={() => handleAction("CALL_CONTRA_FLOR")}>
                    ¡Contraflor! (+6)
                  </Button>
                  <Button variant="cta" disabled={isActing} onClick={() => handleAction("CALL_CONTRA_FLOR_AL_RESTO")}>
                    ¡Contraflor al Resto!
                  </Button>
                </div>
              )}
            </div>
          )}

          {pendingBet.type !== "FLOR" && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button variant="success" disabled={isActing} onClick={() => handleAction("QUIERO")}>
                <Icon icon="pixelarticons:check" width={16} height={16} />
                ¡QUIERO!
              </Button>
              <Button variant="danger" disabled={isActing} onClick={() => handleAction("NO_QUIERO")}>
                <Icon icon="pixelarticons:close" width={16} height={16} />
                NO QUIERO
              </Button>
            </div>
          )}

          {pendingBet.type === "ENVIDO" && (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 border-t border-white/10 pt-2.5">
              {pendingBet.call === "ENVIDO" && (
                <>
                  <Button variant="cta" disabled={isActing} onClick={() => handleAction("RESPOND_BET", { raise: "REAL_ENVIDO" })}>
                    Subir a Real Envido (+3)
                  </Button>
                  <Button variant="cta" disabled={isActing} onClick={() => handleAction("RESPOND_BET", { raise: "FALTA_ENVIDO" })}>
                    ¡Falta Envido!
                  </Button>
                </>
              )}
              {pendingBet.call === "REAL_ENVIDO" && (
                <Button variant="cta" disabled={isActing} onClick={() => handleAction("RESPOND_BET", { raise: "FALTA_ENVIDO" })}>
                  ¡Falta Envido!
                </Button>
              )}
            </div>
          )}

          {pendingBet.type === "TRUCO" && (
            <div className="mt-3 flex flex-col gap-2 border-t border-white/10 pt-2.5">
              <div className="flex flex-wrap items-center justify-center gap-2">
                {pendingBet.call === "TRUCO" && (
                  <Button variant="cta" disabled={isActing} onClick={() => handleAction("RESPOND_BET", { raise: "RETRUCO" })}>
                    ¡Quiero Retruco! (+3)
                  </Button>
                )}
                {pendingBet.call === "RETRUCO" && (
                  <Button variant="cta" disabled={isActing} onClick={() => handleAction("RESPOND_BET", { raise: "VALE_CUATRO" })}>
                    ¡Quiero Vale Cuatro! (+4)
                  </Button>
                )}
              </div>

              {currentTrick === 1 && (
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1 border-t border-white/5">
                  {hasFlor && (
                    <Button variant="cta" disabled={isActing} onClick={() => handleAction("CALL_FLOR")}>
                      🌸 ¡Cantar Flor primero! (+3)
                    </Button>
                  )}
                  {!hasFlor && envidoState.state === "AVAILABLE" && (
                    <>
                      <Button variant="cta" disabled={isActing} onClick={() => handleAction("EL_ENVIDO_ESTA_PRIMERO")}>
                        ⚡ ¡El Envido está primero!
                      </Button>
                      <Button variant="cta" disabled={isActing} onClick={() => handleAction("CALL_REAL_ENVIDO")}>
                        Real Envido primero (+3)
                      </Button>
                      <Button variant="cta" disabled={isActing} onClick={() => handleAction("CALL_FALTA_ENVIDO")}>
                        ¡Falta Envido primero!
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Acciones de mi turno */}
      {!pendingBet && canAct && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={tapadaMode ? "cta" : "ghost"}
            onClick={toggleTapada}
          >
            <Icon icon="pixelarticons:visible" width={13} height={13} />
            {tapadaMode ? "Modo: Tapada" : "Tirar Tapada"}
          </Button>

          {canCallFlor && (
            <Button variant="success" disabled={isActing} onClick={() => handleAction("CALL_FLOR")}>
              <Icon icon="pixelarticons:sparkles" width={14} height={14} />
              ¡Flor! (+3)
            </Button>
          )}

          {canCallEnvido && (
            <>
              <Button variant="cta" disabled={isActing} onClick={() => handleAction("CALL_ENVIDO")}>
                Envido (+2)
              </Button>
              <Button variant="cta" disabled={isActing} onClick={() => handleAction("CALL_REAL_ENVIDO")}>
                Real Envido (+3)
              </Button>
              <Button variant="cta" disabled={isActing} onClick={() => handleAction("CALL_FALTA_ENVIDO")}>
                Falta Envido
              </Button>
            </>
          )}

          {canCallTruco && (
            <Button variant="cta" disabled={isActing} onClick={() => handleAction("CALL_TRUCO")}>
              ¡Truco! (+2)
            </Button>
          )}
          {canCallRetruco && (
            <Button variant="cta" disabled={isActing} onClick={() => handleAction("CALL_RETRUCO")}>
              ¡Retruco! (+3)
            </Button>
          )}
          {canCallValeCuatro && (
            <Button variant="cta" disabled={isActing} onClick={() => handleAction("CALL_VALE_CUATRO")}>
              ¡Vale Cuatro! (+4)
            </Button>
          )}

          <Button variant="danger" disabled={isActing} onClick={() => handleAction("FOLD")} className="ml-auto">
            Irse al mazo
          </Button>
        </div>
      )}

      {/* Ficha propia + estado de turno */}
      <div className="flex items-center justify-between gap-2">
        <ScoreChip
          name={`${selfName} (vos)`}
          score={selfScore}
          targetScore={targetScore}
          isMano={manoPlayerId === self?.id}
          accentClass="text-accent"
        />
        <span className="text-[10px] md:text-[11px] font-bold text-ink-faint text-right">
          {canAct && !pendingBet ? (
            <span className="text-success font-black animate-pulse">
              {tapadaMode ? "Tirá TAPADA" : "Tocá una carta"}
            </span>
          ) : pendingBet ? (
            isPendingForMe ? (
              <span className="text-warning">Respondé el canto</span>
            ) : (
              <span className="text-warning">Esperando a {rivalName}...</span>
            )
          ) : (
            "Turno del rival..."
          )}
        </span>
      </div>

      {/* Mano: fila superpuesta, mismo trato que color-match (sin caja, sin
          texto descriptivo por carta — el sprite real ya se lee solo). */}
      <div className="flex items-end justify-center gap-0 py-1">
        {hand.map((card, i) => {
          const isPlayable = canAct && !pendingBet && !isActing;
          return (
            <div
              key={card.id}
              style={{ zIndex: selectedCardId === card.id ? 30 : i }}
              className={`-mx-1.5 md:-mx-2 transition-all duration-150 ${
                isPlayable ? "hover:-translate-y-3 hover:scale-105 cursor-pointer" : ""
              } ${selectedCardId === card.id ? "-translate-y-3 scale-105" : ""}`}
            >
              <CardView
                card={card}
                size="lg"
                selected={selectedCardId === card.id}
                onClick={isPlayable ? () => handleCardClick(card.id) : undefined}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
