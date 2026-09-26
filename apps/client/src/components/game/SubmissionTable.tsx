"use client";

import { useState } from "react";
import { Icon } from "@iconify/react";
import type { Card, PublicGameState, SubmissionRoundState } from "@/types/engine";
import TextCard, { getCardText } from "./TextCard";
import { decodePlayerName } from "@/lib/room/player-name";

interface SubmissionTableProps {
  publicState: PublicGameState;
  selfPlayerId: string | null;
  hand: Card[];
  onExecuteAction: (action: string, payload?: Record<string, unknown>) => Promise<void>;
  isActing: boolean;
  targetScore?: number;
}

function displayName(state: PublicGameState, playerId: string | null | undefined): string {
  if (!playerId) return "—";
  const player = state.players.find((p) => p.id === playerId);
  return player ? decodePlayerName(player.name).display : "—";
}

function ActionButton({
  label,
  icon,
  disabled,
  onClick,
  variant = "primary",
}: {
  label: string;
  icon: string;
  disabled?: boolean;
  onClick: () => void;
  variant?: "primary" | "outline" | "warning";
}) {
  const styles = {
    primary: "border-accent/60 bg-accent/20 text-accent hover:bg-accent/30",
    warning: "border-warning/60 bg-warning/20 text-warning hover:bg-warning/30",
    outline: "border-subtle bg-app/60 text-ink-soft hover:border-accent/50 hover:text-ink",
  }[variant];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${styles}`}
    >
      <Icon icon={icon} width={15} height={15} aria-hidden />
      {label}
    </button>
  );
}

export default function SubmissionTable({
  publicState,
  selfPlayerId,
  hand,
  onExecuteAction,
  isActing,
  targetScore,
}: SubmissionTableProps) {
  const submission = (publicState.submission ?? null) as SubmissionRoundState | null;
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [isExchangeMode, setIsExchangeMode] = useState(false);

  const phase = submission?.phase ?? "PREPARE";
  const customState = (publicState.customState ?? {}) as Record<string, unknown>;
  const round = Number(customState.round ?? 1);

  const judgeId = submission?.judgeId ?? null;
  const isJudge = Boolean(selfPlayerId && judgeId === selfPlayerId);
  const isExpected = Boolean(selfPlayerId && submission?.expectedSubmitters.includes(selfPlayerId));
  const hasSubmitted = Boolean(
    selfPlayerId && submission?.submittedPlayerIds.includes(selfPlayerId)
  );
  const isAwaitingMe = Boolean(selfPlayerId && publicState.awaitingPlayerIds?.includes(selfPlayerId));

  const requiredPicks = submission?.requiredPicks ?? 1;
  const receivedCount = submission?.submittedPlayerIds.length ?? 0;
  const expectedCount = submission?.expectedSubmitters.length ?? 0;
  const isSelectingAnswers = phase === "COLLECTING" && isExpected && !hasSubmitted;
  const isExchanging = phase === "PREPARE" && isJudge && isExchangeMode;
  const canSelectCards = isSelectingAnswers || isExchanging;

  function toggleCard(cardId: string) {
    setSelectedCardIds((previous) => {
      if (previous.includes(cardId)) {
        return previous.filter((id) => id !== cardId);
      }
      const limit = isSelectingAnswers ? requiredPicks : Number.POSITIVE_INFINITY;
      if (previous.length >= limit) return previous;
      return [...previous, cardId];
    });
  }

  async function run(action: string, payload?: Record<string, unknown>) {
    if (isActing) return;
    try {
      await onExecuteAction(action, payload);
      setSelectedCardIds([]);
      if (action === "EXCHANGE_CARDS") setIsExchangeMode(false);
    } catch {
      // El error se muestra desde el contexto de sala
    }
  }

  return (
    <div className="flex w-full max-w-2xl mx-auto select-none flex-col gap-3">
      <div className="rounded-2xl border-2 border-[#b8860b]/40 bg-[#161f1a]/95 p-3.5 shadow-[0_8px_24px_rgba(0,0,0,0.6)] backdrop-blur">
        <div className="mb-2.5 flex items-center justify-between border-b border-white/10 pb-2">
          <div className="flex items-center gap-2">
            <Icon icon="pixelarticons:cards" className="text-warning" width={18} height={18} />
            <span className="text-xs font-black uppercase tracking-wider text-ink">
              HDP · Ronda {round}
            </span>
          </div>
          <span className="rounded-full border border-warning/40 bg-warning/15 px-2.5 py-0.5 text-[11px] font-bold text-warning">
            Meta: {targetScore ?? "—"} pts
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {publicState.players.map((player) => {
            const isJudgeChip = player.id === judgeId;
            const isSelfChip = player.id === selfPlayerId;
            return (
              <span
                key={player.id}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                  isJudgeChip
                    ? "border-warning/60 bg-warning/15 text-warning"
                    : "border-subtle bg-app/60 text-ink-soft"
                }`}
              >
                {isJudgeChip && <Icon icon="pixelarticons:user" width={12} height={12} />}
                {displayName(publicState, player.id)}
                {isSelfChip ? " (vos)" : ""}
                <span className="text-ink-faint">· {publicState.scores?.[player.id] ?? 0}</span>
              </span>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border-2 border-white/15 bg-[#101114]/95 p-4 text-center shadow-[0_8px_24px_rgba(0,0,0,0.6)] backdrop-blur">
        <div className="text-[10px] font-black uppercase tracking-[0.25em] text-ink-faint">
          Consigna del HDP
        </div>
        {submission?.promptCard ? (
          <p className="mx-auto mt-2 max-w-xl text-sm font-black leading-snug text-ink md:text-base">
            {getCardText(submission.promptCard)}
          </p>
        ) : (
          <p className="mt-2 text-sm text-ink-faint">Preparando la próxima consigna...</p>
        )}
        <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2 text-[11px] text-ink-faint">
          <span>
            HDP:{" "}
            <strong className="text-warning">{displayName(publicState, judgeId)}</strong>
          </span>
          <span aria-hidden>·</span>
          <span>
            {requiredPicks > 1
              ? `Se necesitan ${requiredPicks} cartas por respuesta`
              : "Se necesita 1 carta por respuesta"}
          </span>
        </div>
      </div>

      {phase === "COLLECTING" && (
        <div className="rounded-2xl border border-subtle bg-statusbar/90 p-3.5 backdrop-blur">
          <div className="flex items-center justify-between text-[11px] font-bold text-ink-soft">
            <span>Respuestas recibidas</span>
            <span className={receivedCount === expectedCount ? "text-success" : "text-warning"}>
              {receivedCount} / {expectedCount}
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-app/70">
            <div
              className="h-full rounded-full bg-accent transition-all duration-300"
              style={{
                width: `${expectedCount > 0 ? (receivedCount / expectedCount) * 100 : 0}%`,
              }}
            />
          </div>
          <div className="mt-2.5 text-xs text-ink-faint">
            {isJudge
              ? "Esperá a que todos envíen su respuesta. Se revelarán de forma anónima."
              : isSelectingAnswers
                ? `Elegí ${requiredPicks > 1 ? `${requiredPicks} cartas en orden` : "una carta"} y enviala boca abajo.`
                : hasSubmitted
                  ? "¡Respuesta enviada! Esperá al resto."
                  : "Esperando..."}
          </div>
        </div>
      )}

      {phase === "JUDGING" && (
        <div className="rounded-2xl border border-subtle bg-statusbar/90 p-3.5 backdrop-blur">
          <div className="mb-2.5 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-ink">
            <Icon icon="pixelarticons:eye-closed" className="text-accent" width={16} height={16} />
            {isJudge ? "Elegí la respuesta más zarpada" : "El HDP está eligiendo"}
          </div>
          {isJudge ? (
            <div className="flex flex-col gap-2.5">
              {(submission?.submissions ?? []).map((entry, index) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 rounded-xl border border-subtle bg-app/60 p-2.5"
                >
                  <span className="w-6 shrink-0 text-center text-xs font-black text-ink-faint">
                    #{index + 1}
                  </span>
                  <div className="flex flex-1 flex-wrap gap-1.5">
                    {entry.cards.map((card) => (
                      <TextCard key={card.id} card={card} size="sm" />
                    ))}
                  </div>
                  <ActionButton
                    label="Elegir"
                    icon="pixelarticons:check"
                    variant="warning"
                    disabled={isActing}
                    onClick={() => run("PICK_SUBMISSION", { submissionId: entry.id })}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-ink-faint">
              Se recibieron {submission?.submissions.length ?? expectedCount} respuestas anónimas.
            </p>
          )}
        </div>
      )}

      {phase === "RESOLVED" && (
        <div className="rounded-2xl border-2 border-success/50 bg-success/10 p-4 text-center backdrop-blur">
          <Icon
            icon="pixelarticons:trophy"
            className="mx-auto text-warning"
            width={26}
            height={26}
          />
          <div className="mt-1.5 text-sm font-black text-ink">
            ¡{displayName(publicState, submission?.winnerPlayerId)} se llevó la ronda!
          </div>
          <div className="mt-3 flex justify-center gap-2">
            {(submission?.submissions.find((e) => e.id === submission.winnerSubmissionId)?.cards ??
              []
            ).map((card) => (
              <TextCard key={card.id} card={card} size="md" />
            ))}
          </div>
          {isJudge && isAwaitingMe && (
            <div className="mt-3 flex justify-center">
              <ActionButton
                label="Siguiente ronda"
                icon="pixelarticons:reload"
                disabled={isActing}
                onClick={() => run("CONFIRM_PHASE")}
              />
            </div>
          )}
        </div>
      )}

      {phase === "PREPARE" && (
        <div className="rounded-2xl border border-subtle bg-statusbar/90 p-3.5 backdrop-blur">
          {isJudge ? (
            <div className="flex flex-col gap-2.5">
              <div className="text-xs text-ink-faint">
                Podés recambiar las cartas que quieras antes de leer la consigna.
              </div>
              <div className="flex flex-wrap gap-2">
                <ActionButton
                  label={
                    isExchanging
                      ? `Recambiar ${selectedCardIds.length || ""}`.trim()
                      : "Recambiar cartas"
                  }
                  icon="pixelarticons:reload"
                  variant="outline"
                  disabled={isActing || (isExchanging && selectedCardIds.length === 0)}
                  onClick={() => {
                    if (isExchanging) {
                      void run("EXCHANGE_CARDS", { cardIds: selectedCardIds });
                    } else {
                      setIsExchangeMode(true);
                    }
                  }}
                />
                {isExchanging && (
                  <ActionButton
                    label="Cancelar"
                    icon="pixelarticons:close"
                    variant="outline"
                    disabled={isActing}
                    onClick={() => {
                      setIsExchangeMode(false);
                      setSelectedCardIds([]);
                    }}
                  />
                )}
                <ActionButton
                  label="Leer consigna"
                  icon="pixelarticons:cards"
                  disabled={isActing}
                  onClick={() => run("CONFIRM_PHASE")}
                />
              </div>
            </div>
          ) : (
            <p className="text-xs text-ink-faint">
              El HDP está preparando la consigna. Podés ir pensando tu respuesta.
            </p>
          )}
        </div>
      )}

      {canSelectCards && (
        <div className="rounded-2xl border border-accent/30 bg-accent/5 p-2.5">
          <div className="mb-1.5 flex items-center justify-between px-1 text-[10px] font-black uppercase tracking-wider text-ink-faint">
            <span>{isExchanging ? "Elegí cartas para recambiar" : "Tu mano"}</span>
            {isSelectingAnswers && (
              <span className="text-accent">
                {selectedCardIds.length} / {requiredPicks}
              </span>
            )}
          </div>
          <div className="flex gap-1.5 overflow-x-auto px-1 pb-2 pt-3">
            {hand.map((card) => {
              const position = selectedCardIds.indexOf(card.id);
              return (
                <TextCard
                  key={card.id}
                  card={card}
                  size="md"
                  selected={position >= 0}
                  badge={isSelectingAnswers && position >= 0 ? position + 1 : undefined}
                  onClick={() => toggleCard(card.id)}
                />
              );
            })}
          </div>
        </div>
      )}

      {isSelectingAnswers && (
        <div className="flex justify-center">
          <ActionButton
            label="Enviar respuestas"
            icon="pixelarticons:check"
            disabled={isActing || selectedCardIds.length !== requiredPicks}
            onClick={() => run("SUBMIT_CARDS", { cardIds: selectedCardIds })}
          />
        </div>
      )}
    </div>
  );
}
