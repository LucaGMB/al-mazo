"use client";

import { useState } from "react";
import { Icon } from "@iconify/react";
import type { Card, PublicGameState } from "@/types/engine";
import CardView from "./CardView";
import { calculateEnvidoScore } from "@/types/shared/truco-rules";

type TrucoPendingBet = {
  type: "ENVIDO" | "TRUCO";
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
  pendingBet?: TrucoPendingBet | null;
  lastActionText?: string;
};

interface TrucoTableProps {
  publicState: PublicGameState;
  selfPlayerId: string | null;
  hand: Card[];
  canAct: boolean;
  onExecuteAction: (action: string, payload?: Record<string, unknown>) => Promise<void>;
  isActing: boolean;
  onPlaySound?: (sound: string) => void;
  isTapada?: boolean;
  onToggleTapada?: () => void;
}

export default function TrucoTable({
  publicState,
  selfPlayerId,
  hand,
  canAct,
  onExecuteAction,
  isActing,
  isTapada,
  onToggleTapada,
}: TrucoTableProps) {
  const [localTapadaMode, setLocalTapadaMode] = useState(false);
  const tapadaMode = isTapada !== undefined ? isTapada : localTapadaMode;
  const toggleTapada = onToggleTapada ?? (() => setLocalTapadaMode((prev) => !prev));

  const customState = (publicState.customState ?? {}) as TrucoCustomState;
  const manoPlayerId = customState.manoPlayerId ?? "";
  const targetScore = customState.targetScore ?? 30;
  const currentTrick = customState.currentTrick ?? 1;
  const roundTricks = customState.roundTricks ?? [];
  const envidoState = customState.envido ?? { state: "AVAILABLE" };
  const trucoState = customState.truco ?? { state: "AVAILABLE", currentLevel: null };
  const pendingBet = customState.pendingBet ?? null;
  const lastActionText = customState.lastActionText ?? "";

  // Identify players
  const players = publicState.players ?? [];
  const self = players.find((p) => p.id === selfPlayerId) ?? players[0];
  const rival = players.find((p) => p.id !== selfPlayerId) ?? players[1];

  const selfScore = (publicState.scores?.[self?.id ?? ""] ?? 0);
  const rivalScore = (publicState.scores?.[rival?.id ?? ""] ?? 0);

  const isPendingForMe = pendingBet && pendingBet.challengedId === selfPlayerId;
  const isPendingForRival = pendingBet && pendingBet.callerId === selfPlayerId;

  // Calculate self envido points
  const selfEnvido = calculateEnvidoScore(hand);

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
    envidoState.state === "AVAILABLE";

  async function handleAction(action: string, payload?: Record<string, unknown>) {
    if (isActing) return;
    try {
      await onExecuteAction(action, payload);
    } catch {
      // Handled by parent
    }
  }

  // Render matchstick box for a group of up to 5 points
  function renderMatchBox(pointsInBox: number) {
    // 0 = empty, 1 = left, 2 = left+bottom, 3 = left+bottom+right, 4 = box, 5 = box+diagonal
    const p = Math.max(0, Math.min(5, pointsInBox));
    return (
      <div className="relative w-6 h-6 border border-subtle/40 bg-black/20 rounded-xs flex items-center justify-center">
        {p >= 1 && <span className="absolute left-0.5 top-0.5 bottom-0.5 w-[2px] bg-[#d4af37] rounded-xs" />}
        {p >= 2 && <span className="absolute left-0.5 right-0.5 bottom-0.5 h-[2px] bg-[#d4af37] rounded-xs" />}
        {p >= 3 && <span className="absolute right-0.5 top-0.5 bottom-0.5 w-[2px] bg-[#d4af37] rounded-xs" />}
        {p >= 4 && <span className="absolute left-0.5 right-0.5 top-0.5 h-[2px] bg-[#d4af37] rounded-xs" />}
        {p >= 5 && (
          <span className="absolute inset-x-0.5 top-1/2 -translate-y-1/2 h-[2px] bg-[#d4af37] rotate-45 rounded-xs" />
        )}
      </div>
    );
  }

  function renderScoreBoxes(score: number, maxScore: number) {
    const totalBoxes = Math.ceil(maxScore / 5);
    const boxes = [];
    for (let i = 0; i < totalBoxes; i++) {
      const pts = Math.max(0, score - i * 5);
      boxes.push(renderMatchBox(pts));
    }
    return boxes;
  }

  return (
    <div className="flex flex-col gap-3 w-full max-w-2xl mx-auto select-none">
      {/* 1. TANTEADOR CRIOLLO */}
      <div className="rounded-2xl border-2 border-[#b8860b]/40 bg-[#161f1a]/95 p-3.5 shadow-[0_8px_24px_rgba(0,0,0,0.6)] backdrop-blur">
        <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2.5">
          <div className="flex items-center gap-2">
            <Icon icon="pixelarticons:trophy" className="text-warning" width={18} height={18} />
            <span className="text-xs font-black uppercase tracking-wider text-ink">
              Tanteador ({targetScore} Puntos)
            </span>
          </div>
          {manoPlayerId && (
            <span className="inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/15 px-2.5 py-0.5 text-[11px] font-bold text-warning">
              <Icon icon="pixelarticons:flag" width={12} height={12} />
              Mano: {manoPlayerId === self?.id ? "Vos" : rival?.name ?? "Rival"}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 text-center">
          {/* NOSOTROS / YO */}
          <div className="rounded-xl border border-subtle bg-black/30 p-2.5 flex flex-col items-center">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xs font-bold text-accent truncate max-w-[120px]">
                {self?.name ?? "Vos"}
              </span>
              {manoPlayerId === self?.id && (
                <span className="text-[9px] bg-warning text-black px-1 rounded-xs font-black">MANO</span>
              )}
            </div>
            <div className="text-2xl font-black text-white leading-none mb-1">
              {selfScore} <span className="text-[11px] text-ink-faint font-normal">/ {targetScore}</span>
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint mb-1.5">
              {selfScore < 15 ? "Malas" : "Buenas"}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-1">
              {renderScoreBoxes(selfScore, targetScore)}
            </div>
          </div>

          {/* ELLOS / RIVAL */}
          <div className="rounded-xl border border-subtle bg-black/30 p-2.5 flex flex-col items-center">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xs font-bold text-danger truncate max-w-[120px]">
                {rival?.name ?? "Rival"}
              </span>
              {manoPlayerId === rival?.id && (
                <span className="text-[9px] bg-warning text-black px-1 rounded-xs font-black">MANO</span>
              )}
            </div>
            <div className="text-2xl font-black text-white leading-none mb-1">
              {rivalScore} <span className="text-[11px] text-ink-faint font-normal">/ {targetScore}</span>
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint mb-1.5">
              {rivalScore < 15 ? "Malas" : "Buenas"}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-1">
              {renderScoreBoxes(rivalScore, targetScore)}
            </div>
          </div>
        </div>
      </div>

      {/* 2. BANNER DE ÚLTIMA ACCIÓN */}
      {lastActionText && (
        <div className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-2 text-center text-xs md:text-sm font-bold text-accent shadow-sm animate-fade-in flex items-center justify-center gap-2">
          <Icon icon="pixelarticons:zap" width={16} height={16} className="text-warning shrink-0" />
          <span>{lastActionText}</span>
        </div>
      )}

      {/* 3. MESA CENTRAL DE LAS 3 BAZAS */}
      <div className="relative rounded-2xl border-4 border-[#3e2723] bg-[radial-gradient(circle_at_50%_40%,#1f5731,#12381e_70%,#0a2011_100%)] p-4 shadow-[inset_0_0_30px_rgba(0,0,0,0.6),0_10px_30px_rgba(0,0,0,0.5)]">
        <div className="text-center text-[11px] font-black uppercase tracking-widest text-[#d4af37]/80 mb-3">
          Mesa de Bazas · Ronda {customState.round ?? 1}
        </div>

        <div className="grid grid-cols-3 gap-2 md:gap-4">
          {[1, 2, 3].map((bazaNum) => {
            const trick = roundTricks.find((t) => t.trickNumber === bazaNum);
            const isCurrent = currentTrick === bazaNum;
            const rivalTrickCard =
              trick?.cards.find((c) => c.playerId === rival?.id) ??
              (isCurrent ? publicState.trickCards?.find((c) => c.playerId === rival?.id) : null);
            const selfTrickCard =
              trick?.cards.find((c) => c.playerId === self?.id) ??
              (isCurrent ? publicState.trickCards?.find((c) => c.playerId === self?.id) : null);

            let winnerBadge = null;
            if (trick?.winnerId === self?.id) {
              winnerBadge = (
                <span className="rounded-full bg-success/20 border border-success/40 px-2 py-0.5 text-[9px] font-black text-success">
                  Ganaste
                </span>
              );
            } else if (trick?.winnerId === rival?.id) {
              winnerBadge = (
                <span className="rounded-full bg-danger/20 border border-danger/40 px-2 py-0.5 text-[9px] font-black text-danger">
                  Rival
                </span>
              );
            } else if (trick?.winnerId === "EMPATE") {
              winnerBadge = (
                <span className="rounded-full bg-warning/20 border border-warning/40 px-2 py-0.5 text-[9px] font-black text-warning">
                  Parda
                </span>
              );
            }

            return (
              <div
                key={bazaNum}
                className={`rounded-xl border p-2 flex flex-col items-center justify-between min-h-[160px] md:min-h-[190px] transition-all duration-200 ${
                  isCurrent
                    ? "border-warning/60 bg-black/40 shadow-[0_0_15px_rgba(245,197,24,0.2)]"
                    : "border-white/10 bg-black/25 opacity-90"
                }`}
              >
                <div className="text-[10px] font-black uppercase tracking-wider text-ink-faint flex items-center justify-between w-full">
                  <span>{bazaNum}ª Baza</span>
                  {winnerBadge}
                </div>

                {/* Rival card */}
                <div className="flex flex-col items-center justify-center my-1">
                  {rivalTrickCard ? (
                    <CardView
                      card={rivalTrickCard.card}
                      size="sm"
                    />
                  ) : (
                    <div className="w-8 h-11 md:w-11 md:h-[60px] rounded-lg border border-dashed border-white/15 flex items-center justify-center text-[10px] text-white/20">
                      Rival
                    </div>
                  )}
                </div>

                {/* Self card */}
                <div className="flex flex-col items-center justify-center my-1">
                  {selfTrickCard ? (
                    <CardView
                      card={selfTrickCard.card}
                      size="sm"
                    />
                  ) : (
                    <div className="w-8 h-11 md:w-11 md:h-[60px] rounded-lg border border-dashed border-white/15 flex items-center justify-center text-[10px] text-white/20">
                      Vos
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* TANTOS DEL JUGADOR */}
        <div className="mt-3 flex items-center justify-between rounded-xl border border-white/10 bg-black/40 px-3 py-1.5 text-xs">
          <span className="text-ink-soft font-medium flex items-center gap-1.5">
            <Icon icon="pixelarticons:cards" className="text-accent" width={14} height={14} />
            Tus tantos de Envido:
          </span>
          <span className="font-black text-warning">
            {selfEnvido.points} {selfEnvido.suit ? `(${selfEnvido.suit})` : ""}
          </span>
        </div>
      </div>

      {/* 4. BANDEJA DE APUESTAS Y CANTOS (ALERTA DE CANTO PENDIENTE) */}
      {isPendingForMe && (
        <div className="rounded-2xl border-2 border-warning bg-warning/10 p-4 shadow-[0_0_20px_rgba(245,197,24,0.35)] animate-pulse">
          <div className="text-center mb-3">
            <div className="text-xs font-black uppercase tracking-widest text-warning">
              ¡Canto en curso!
            </div>
            <div className="text-lg font-black text-white mt-0.5">
              {rival?.name ?? "Rival"} cantó {pendingBet.call.replace("_", " ")}
            </div>
            <div className="text-xs text-ink-soft">
              ¿Aceptás la apuesta? (Por {pendingBet.pointsAtStake} pts)
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              disabled={isActing}
              onClick={() => handleAction("QUIERO")}
              className="cursor-pointer flex-1 min-w-[120px] rounded-xl bg-success px-4 py-3 text-sm font-black text-white shadow-lg transition-transform hover:scale-105 active:scale-95 flex items-center justify-center gap-1.5"
            >
              <Icon icon="pixelarticons:check" width={18} height={18} />
              ¡QUIERO!
            </button>

            <button
              type="button"
              disabled={isActing}
              onClick={() => handleAction("NO_QUIERO")}
              className="cursor-pointer flex-1 min-w-[120px] rounded-xl bg-danger px-4 py-3 text-sm font-black text-white shadow-lg transition-transform hover:scale-105 active:scale-95 flex items-center justify-center gap-1.5"
            >
              <Icon icon="pixelarticons:close" width={18} height={18} />
              NO QUIERO
            </button>
          </div>

          {/* Subir la apuesta si corresponde */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 border-t border-white/10 pt-2.5">
            {pendingBet.type === "ENVIDO" && pendingBet.call === "ENVIDO" && (
              <>
                <button
                  type="button"
                  disabled={isActing}
                  onClick={() => handleAction("RESPOND_BET", { raise: "REAL_ENVIDO" })}
                  className="cursor-pointer rounded-lg border border-warning/60 bg-black/40 px-3 py-1.5 text-xs font-bold text-warning hover:bg-warning/20"
                >
                  Subir a Real Envido (+3)
                </button>
                <button
                  type="button"
                  disabled={isActing}
                  onClick={() => handleAction("RESPOND_BET", { raise: "FALTA_ENVIDO" })}
                  className="cursor-pointer rounded-lg border border-warning/60 bg-black/40 px-3 py-1.5 text-xs font-bold text-warning hover:bg-warning/20"
                >
                  ¡Falta Envido!
                </button>
              </>
            )}

            {pendingBet.type === "ENVIDO" && pendingBet.call === "REAL_ENVIDO" && (
              <button
                type="button"
                disabled={isActing}
                onClick={() => handleAction("RESPOND_BET", { raise: "FALTA_ENVIDO" })}
                className="cursor-pointer rounded-lg border border-warning/60 bg-black/40 px-3 py-1.5 text-xs font-bold text-warning hover:bg-warning/20"
              >
                ¡Falta Envido!
              </button>
            )}

            {pendingBet.type === "TRUCO" && pendingBet.call === "TRUCO" && (
              <button
                type="button"
                disabled={isActing}
                onClick={() => handleAction("RESPOND_BET", { raise: "RETRUCO" })}
                className="cursor-pointer rounded-lg border border-accent/60 bg-accent/20 px-3 py-1.5 text-xs font-bold text-accent hover:bg-accent/30"
              >
                ¡Quiero Retruco! (+3)
              </button>
            )}

            {pendingBet.type === "TRUCO" && pendingBet.call === "RETRUCO" && (
              <button
                type="button"
                disabled={isActing}
                onClick={() => handleAction("RESPOND_BET", { raise: "VALE_CUATRO" })}
                className="cursor-pointer rounded-lg border border-accent/60 bg-accent/20 px-3 py-1.5 text-xs font-bold text-accent hover:bg-accent/30"
              >
                ¡Quiero Vale Cuatro! (+4)
              </button>
            )}
          </div>
        </div>
      )}

      {isPendingForRival && (
        <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-center text-xs md:text-sm font-bold text-warning flex items-center justify-center gap-2">
          <Icon icon="pixelarticons:clock" className="animate-spin" width={16} height={16} />
          Esperando que {rival?.name ?? "Rival"} responda a tu canto de {pendingBet.call}...
        </div>
      )}

      {/* 5. ACCIONES DE TURNO PROPIO (SI NO HAY APUESTA PENDIENTE) */}
      {!pendingBet && canAct && (
        <div className="rounded-2xl border border-subtle bg-statusbar/90 p-3 flex flex-col gap-2.5">
          <div className="flex items-center justify-between text-[11px] font-bold text-ink-soft">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
              Tu turno de cantar o tirar carta
            </span>

            {/* Toggle Carta Tapada */}
            <button
              type="button"
              onClick={toggleTapada}
              className={`cursor-pointer px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border transition-colors ${
                tapadaMode
                  ? "border-warning bg-warning text-black shadow-[0_0_10px_rgba(245,197,24,0.5)]"
                  : "border-white/20 bg-black/30 text-ink-soft hover:text-white"
              }`}
            >
              {tapadaMode ? "Modo: Carta Tapada" : "Tirar Tapada"}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Cantos de Envido */}
            {canCallEnvido && (
              <>
                <button
                  type="button"
                  disabled={isActing}
                  onClick={() => handleAction("CALL_ENVIDO")}
                  className="cursor-pointer rounded-xl bg-accent/20 border border-accent/60 px-3 py-2 text-xs font-black text-accent hover:bg-accent/30 transition-transform active:scale-95"
                >
                  Envido (+2)
                </button>
                <button
                  type="button"
                  disabled={isActing}
                  onClick={() => handleAction("CALL_REAL_ENVIDO")}
                  className="cursor-pointer rounded-xl bg-accent/20 border border-accent/60 px-3 py-2 text-xs font-black text-accent hover:bg-accent/30 transition-transform active:scale-95"
                >
                  Real Envido (+3)
                </button>
                <button
                  type="button"
                  disabled={isActing}
                  onClick={() => handleAction("CALL_FALTA_ENVIDO")}
                  className="cursor-pointer rounded-xl bg-accent/20 border border-accent/60 px-3 py-2 text-xs font-black text-accent hover:bg-accent/30 transition-transform active:scale-95"
                >
                  Falta Envido
                </button>
              </>
            )}

            {/* Cantos de Truco */}
            {canCallTruco && (
              <button
                type="button"
                disabled={isActing}
                onClick={() => handleAction("CALL_TRUCO")}
                className="cursor-pointer rounded-xl bg-warning/20 border border-warning/60 px-4 py-2 text-xs font-black text-warning hover:bg-warning/30 transition-transform active:scale-95 shadow-[0_0_12px_rgba(245,197,24,0.2)]"
              >
                ¡Truco! (+2)
              </button>
            )}

            {canCallRetruco && (
              <button
                type="button"
                disabled={isActing}
                onClick={() => handleAction("CALL_RETRUCO")}
                className="cursor-pointer rounded-xl bg-warning/20 border border-warning/60 px-4 py-2 text-xs font-black text-warning hover:bg-warning/30 transition-transform active:scale-95"
              >
                ¡Retruco! (+3)
              </button>
            )}

            {canCallValeCuatro && (
              <button
                type="button"
                disabled={isActing}
                onClick={() => handleAction("CALL_VALE_CUATRO")}
                className="cursor-pointer rounded-xl bg-warning/20 border border-warning/60 px-4 py-2 text-xs font-black text-warning hover:bg-warning/30 transition-transform active:scale-95"
              >
                ¡Vale Cuatro! (+4)
              </button>
            )}

            {/* Irse al Mazo */}
            <button
              type="button"
              disabled={isActing}
              onClick={() => handleAction("FOLD")}
              className="cursor-pointer ml-auto rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-xs font-bold text-danger hover:bg-danger/20 transition-transform active:scale-95"
            >
              Irse al mazo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
