"use client";

import { useState } from "react";
import { Icon } from "@iconify/react";
import Button from "@/components/Button";
import { decodePlayerName } from "@/lib/room/player-name";
import type { Card, PublicGameState, TownRole } from "@/types/engine";

interface TownTableProps {
  publicState: PublicGameState;
  selfPlayerId: string | null;
  hand: Card[];
  isActing: boolean;
  onExecuteAction: (action: string, payload?: Record<string, unknown>) => void;
}

const ROLE_INFO: Record<
  TownRole,
  { name: string; faction: "TOWN" | "MAFIA"; color: string; icon: string; desc: string; ability: string }
> = {
  MAFIOSO: {
    name: "Mafioso",
    faction: "MAFIA",
    color: "#ff4d6d",
    icon: "pixelarticons:bullseye",
    desc: "Miembro de la Mafia. Conoce a sus aliados y busca eliminar al Pueblo.",
    ability: "Atacar y eliminar a un jugador vivo.",
  },
  DOCTOR: {
    name: "Doctor",
    faction: "TOWN",
    color: "#33c48d",
    icon: "pixelarticons:heart",
    desc: "Médico del Pueblo. Salva vidas protegiendo de los ataques nocturnos.",
    ability: "Curar a un jugador para evitar que muera esta noche.",
  },
  SHERIFF: {
    name: "Sheriff",
    faction: "TOWN",
    color: "#4fa8ff",
    icon: "pixelarticons:search",
    desc: "Investigador oficial del Pueblo. Busca a los infiltrados de la Mafia.",
    ability: "Investigar a un jugador y saber si es Bueno o Malvado.",
  },
  TOWNIE: {
    name: "Aldeano",
    faction: "TOWN",
    color: "#ffd23f",
    icon: "pixelarticons:user",
    desc: "Poblador inocente. Descubre y lincha a la Mafia en las votaciones.",
    ability: "No tienes habilidad nocturna. El pueblo duerme...",
  },
};

export default function TownTable({
  publicState,
  selfPlayerId,
  hand,
  isActing,
  onExecuteAction,
}: TownTableProps) {
  const townState = publicState.townState;
  const phase = townState?.phase ?? "NIGHT";
  const dayNumber = townState?.dayNumber ?? 1;
  const isFinished = publicState.status === "FINISHED";

  // Identify self player
  const selfTownInfo = townState?.players.find((p) => p.id === selfPlayerId);
  const isAlive = selfTownInfo?.isAlive ?? true;

  // Extract secret role from private hand card
  const roleCard = hand.find((c) => c.type === "ROLE");
  const selfRole = (roleCard?.value as TownRole | undefined) ?? selfTownInfo?.role ?? "TOWNIE";
  const roleMeta = ROLE_INFO[selfRole] ?? ROLE_INFO.TOWNIE;
  const mafiaAllies = (roleCard?.metadata?.allies as string[] | undefined) ?? [];

  // Local selection state
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);

  // Night submission status
  const nightSubmitted = Boolean(
    selfPlayerId && townState?.nightTargetSubmitted?.includes(selfPlayerId)
  );

  // Current vote by self
  const currentVote = selfPlayerId && townState?.votes ? townState.votes[selfPlayerId] : undefined;

  // Has active night ability
  const hasNightAbility = isAlive && ["MAFIOSO", "DOCTOR", "SHERIFF"].includes(selfRole);

  const canTargetPlayerAtNight = (targetId: string): boolean => {
    if (!hasNightAbility || nightSubmitted || isActing) return false;
    const target = townState?.players.find((p) => p.id === targetId);
    if (!target || !target.isAlive) return false;
    if (selfRole === "MAFIOSO" && targetId === selfPlayerId) return false;
    if (selfRole === "SHERIFF" && targetId === selfPlayerId) return false;
    return true;
  };

  const handleSelectNightTarget = (targetId: string) => {
    if (!canTargetPlayerAtNight(targetId)) return;
    setSelectedTargetId(targetId);
  };

  const handleConfirmNightAction = () => {
    if (!selectedTargetId) return;
    onExecuteAction("SUBMIT_NIGHT_ACTION", { targetPlayerId: selectedTargetId });
    setSelectedTargetId(null);
  };

  const handleCastVote = (targetPlayerId: string) => {
    if (!isAlive || isActing) return;
    onExecuteAction("CAST_VOTE", { targetPlayerId });
  };

  const handleStartVote = () => {
    if (!isAlive || isActing) return;
    onExecuteAction("START_DAY_VOTE");
  };


  // Phase appearance
  const phaseConfig = {
    NIGHT: {
      title: `NOCHE ${dayNumber}`,
      subtitle: "La Mafia ataca en las sombras, el Doctor protege y el Sheriff investiga.",
      icon: "pixelarticons:moon",
      bgClass: "from-[#13112c] to-[#0a0915] border-[#2f2256]",
      iconColor: "text-[#b28dff]",
      badge: "FASE NOCTURNA",
      badgeColor: "bg-[#2f2256] text-[#d6bbfb]",
    },
    DAY_CHAT: {
      title: `DÍA ${dayNumber} - DEBATE`,
      subtitle: "Amanece en el pueblo. Discutan las sospechas y pistas de la noche.",
      icon: "pixelarticons:sun-alt",
      bgClass: "from-[#2b1f11] to-[#120e09] border-[#664614]",
      iconColor: "text-[#ffd23f]",
      badge: "DEBATE DIURNO",
      badgeColor: "bg-[#543b12] text-[#ffd23f]",
    },
    DAY_VOTE: {
      title: `DÍA ${dayNumber} - VOTACIÓN`,
      subtitle: "Voten para linchar a un sospechoso o elijan no linchar a nadie.",
      icon: "pixelarticons:scale",
      bgClass: "from-[#2f1118] to-[#14080b] border-[#661b2c]",
      iconColor: "text-[#ff4d6d]",
      badge: "JUICIO DEL PUEBLO",
      badgeColor: "bg-[#541221] text-[#ff8097]",
    },
  }[phase];

  return (
    <div className="flex flex-1 flex-col gap-2.5 px-3 md:px-6 py-2 overflow-y-auto max-w-4xl mx-auto w-full">
      {/* 1. Atmospheric Phase Header */}
      <div
        className={`relative border-2 bg-gradient-to-b p-3 rounded shadow-[3px_3px_0_0_rgba(0,0,0,0.4)] ${phaseConfig.bgClass}`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon icon={phaseConfig.icon} width={24} height={24} className={phaseConfig.iconColor} />
            <div>
              <span className={`inline-block px-1.5 py-0.5 font-display text-[9px] font-black uppercase tracking-widest rounded ${phaseConfig.badgeColor}`}>
                {phaseConfig.badge}
              </span>
              <h2 className="font-display text-sm md:text-base font-black text-ink tracking-wide">
                {phaseConfig.title}
              </h2>
            </div>
          </div>
          {phase === "DAY_CHAT" && isAlive && !isFinished && (
            <Button
              variant="cta"
              onClick={handleStartVote}
              disabled={isActing}
              className="text-[11px] py-1 px-2.5 shadow-none"
            >
              <Icon icon="pixelarticons:scale" width={14} height={14} className="mr-1" />
              Abrir Votación
            </Button>
          )}
        </div>
        <p className="mt-1 text-[11px] text-ink-soft">{phaseConfig.subtitle}</p>
      </div>

      {/* 2. Finished Game Banner */}
      {isFinished && (
        <div className={`border-2 p-3 text-center rounded shadow-[3px_3px_0_0_rgba(0,0,0,0.4)] ${
          townState?.winnerFaction === "TOWN"
            ? "border-success bg-success/15 text-success"
            : "border-danger bg-danger/15 text-danger"
        }`}>
          <div className="flex items-center justify-center gap-2 font-display text-base md:text-lg font-black uppercase tracking-wider">
            <Icon icon="pixelarticons:trophy" width={22} height={22} />
            {townState?.winnerFaction === "TOWN"
              ? "¡Victoria del Pueblo!"
              : "¡Victoria de la Mafia!"}
          </div>
          <p className="mt-1 text-xs text-ink">
            {townState?.winnerFaction === "TOWN"
              ? "Todos los miembros de la Mafia han sido eliminados del pueblo."
              : "La Mafia ha alcanzado la mayoría o paridad numérica en el pueblo."}
          </p>
        </div>
      )}

      {/* 3. Latest News Announcement Banner */}
      {!isFinished && phase === "DAY_CHAT" && townState?.lastNightResult && (
        <div className="border-2 border-subtle bg-statusbar/90 px-3 py-2 rounded flex items-center gap-2.5 text-xs text-ink shadow-[2px_2px_0_0_rgba(0,0,0,0.3)]">
          <Icon
            icon={townState.lastNightResult.killedPlayerId ? "pixelarticons:mood-sad" : "pixelarticons:shield"}
            width={20}
            height={20}
            className={townState.lastNightResult.killedPlayerId ? "text-danger" : "text-success"}
          />
          <div className="flex-1">
            <span className="font-bold text-accent mr-1">Noticia matutina:</span>
            {townState.lastNightResult.announcement}
          </div>
        </div>
      )}

      {!isFinished && phase === "NIGHT" && townState?.lastDayResult && (
        <div className="border-2 border-subtle bg-statusbar/90 px-3 py-2 rounded flex items-center gap-2.5 text-xs text-ink shadow-[2px_2px_0_0_rgba(0,0,0,0.3)]">
          <Icon icon="pixelarticons:scale" width={20} height={20} className="text-warning" />
          <div className="flex-1">
            <span className="font-bold text-accent mr-1">Juicio anterior:</span>
            {townState.lastDayResult.announcement}
          </div>
        </div>
      )}

      {/* 4. Secret Role Card & Private Intelligence */}
      <div className="border-2 border-subtle bg-statusbar/80 p-3 rounded shadow-[2px_2px_0_0_rgba(0,0,0,0.3)]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-10 h-10 rounded border-2 flex items-center justify-center shrink-0"
              style={{ borderColor: roleMeta.color, backgroundColor: `${roleMeta.color}22` }}
            >
              <Icon icon={roleMeta.icon} width={24} height={24} style={{ color: roleMeta.color }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-sm font-black text-ink">{roleMeta.name}</span>
                <span
                  className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider"
                  style={{
                    backgroundColor: `${roleMeta.color}25`,
                    color: roleMeta.color,
                    border: `1px solid ${roleMeta.color}`,
                  }}
                >
                  {roleMeta.faction === "MAFIA" ? "Facción Mafia" : "Facción Pueblo"}
                </span>
                {!isAlive && (
                  <span className="bg-danger/20 border border-danger text-danger px-1.5 py-0.2 rounded text-[9px] font-bold">
                    💀 Eliminado
                  </span>
                )}
              </div>
              <p className="text-[11px] text-ink-soft leading-tight mt-0.5">{roleMeta.desc}</p>
            </div>
          </div>
        </div>

        {/* Night ability detail */}
        <div className="mt-2.5 pt-2 border-t border-subtle/50 flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-ink-soft">
            <Icon icon="pixelarticons:zap" width={14} height={14} className="text-accent shrink-0" />
            <span><strong className="text-ink">Habilidad:</strong> {roleMeta.ability}</span>
          </div>

          {/* Mafia allies indicator */}
          {selfRole === "MAFIOSO" && mafiaAllies.length > 0 && (
            <div className="flex items-center gap-1 text-[11px] text-danger bg-danger/10 px-2 py-0.5 rounded border border-danger/30">
              <Icon icon="pixelarticons:users" width={13} height={13} />
              <span>Aliados: {mafiaAllies.join(", ")}</span>
            </div>
          )}

          {/* Sheriff private investigation result */}
          {selfRole === "SHERIFF" && townState?.sheriffInvestigation && (
            <div className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border ${
              townState.sheriffInvestigation.verdict === "Malvado"
                ? "bg-danger/20 text-danger border-danger"
                : "bg-success/20 text-success border-success"
            }`}>
              <Icon icon="pixelarticons:search" width={13} height={13} />
              <span>
                <strong>{townState.sheriffInvestigation.targetName}:</strong> {townState.sheriffInvestigation.verdict}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 5. Town Square: Players Grid */}
      <div className="flex-1 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-ink-soft">
          <span className="font-display font-bold uppercase tracking-wider flex items-center gap-1">
            <Icon icon="pixelarticons:home" width={14} height={14} className="text-accent" />
            Plaza del Pueblo ({townState?.players.length ?? 0} pobladores)
          </span>

          {phase === "DAY_VOTE" && isAlive && !isFinished && (
            <button
              type="button"
              onClick={() => handleCastVote("SKIP")}
              disabled={isActing}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded border transition-colors ${
                currentVote === "SKIP"
                  ? "border-warning bg-warning/25 text-warning"
                  : "border-subtle bg-statusbar/60 text-ink-soft hover:border-warning/50"
              }`}
            >
              <Icon icon="pixelarticons:close" width={13} height={13} />
              No linchar a nadie
              {townState?.voteCounts?.["SKIP"] ? (
                <span className="ml-1 bg-warning text-black px-1.5 py-0.2 rounded-full text-[9px] font-black">
                  {townState.voteCounts["SKIP"]}
                </span>
              ) : null}
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {townState?.players.map((player) => {
            const isSelf = player.id === selfPlayerId;
            const isPlayerAlive = player.isAlive;
            const voteCount = townState?.voteCounts?.[player.id] ?? 0;
            const hasVotedForThis = currentVote === player.id;
            const isSelectedNightTarget = selectedTargetId === player.id;
            const canNightTarget = phase === "NIGHT" && isAlive && canTargetPlayerAtNight(player.id);
            const canVoteTarget = phase === "DAY_VOTE" && isAlive && isPlayerAlive && !isSelf && !isFinished;

            return (
              <div
                key={player.id}
                onClick={() => {
                  if (canNightTarget) handleSelectNightTarget(player.id);
                  else if (canVoteTarget) handleCastVote(player.id);
                }}
                className={`relative border-2 p-2.5 rounded flex flex-col justify-between transition-all ${
                  !isPlayerAlive
                    ? "border-subtle/50 bg-[#101018]/60 opacity-60"
                    : isSelectedNightTarget
                    ? "border-accent bg-accent/20 shadow-[0_0_12px_rgba(255,210,63,0.3)] cursor-pointer"
                    : hasVotedForThis
                    ? "border-danger bg-danger/20 shadow-[0_0_12px_rgba(255,77,109,0.3)] cursor-pointer"
                    : canNightTarget || canVoteTarget
                    ? "border-subtle bg-statusbar/80 hover:border-accent cursor-pointer"
                    : "border-subtle bg-statusbar/80"
                }`}
              >
                {/* Header: Name and Status */}
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-display text-xs font-bold text-ink truncate">
                      {decodePlayerName(player.name).display}
                      {isSelf && " (Tú)"}
                    </span>
                    <span
                      className={`h-2 w-2 rounded-full shrink-0 ${
                        isPlayerAlive ? "bg-success" : "bg-danger"
                      }`}
                      title={isPlayerAlive ? "Vivo" : "Eliminado"}
                    />
                  </div>

                  {/* Role badge if dead or revealed */}
                  {player.role ? (
                    <div className="mt-1 flex items-center gap-1 text-[10px]">
                      <Icon
                        icon={ROLE_INFO[player.role]?.icon ?? "pixelarticons:user"}
                        width={12}
                        height={12}
                        style={{ color: ROLE_INFO[player.role]?.color }}
                      />
                      <span
                        className="font-bold"
                        style={{ color: ROLE_INFO[player.role]?.color }}
                      >
                        {ROLE_INFO[player.role]?.name ?? player.role}
                      </span>
                    </div>
                  ) : (
                    <div className="mt-1 text-[10px] text-ink-faint">
                      {isPlayerAlive ? "Ciudadano" : "Rol Oculto"}
                    </div>
                  )}
                </div>

                {/* Footer: Vote Count / Action status */}
                <div className="mt-2.5 pt-1.5 border-t border-subtle/40 flex items-center justify-between text-[10px]">
                  {phase === "DAY_VOTE" && isPlayerAlive ? (
                    <div className="flex items-center gap-1 w-full justify-between">
                      <span className="text-ink-soft">Votos:</span>
                      <span
                        className={`px-1.5 py-0.2 rounded font-mono font-bold ${
                          voteCount > 0 ? "bg-danger text-ink" : "bg-subtle/40 text-ink-faint"
                        }`}
                      >
                        {voteCount}
                      </span>
                    </div>
                  ) : phase === "NIGHT" && isSelectedNightTarget ? (
                    <span className="text-accent font-bold">Objetivo seleccionado</span>
                  ) : !isPlayerAlive ? (
                    <span className="text-danger flex items-center gap-1">
                      <Icon icon="pixelarticons:mood-sad" width={11} height={11} />
                      Muerto
                    </span>
                  ) : (
                    <span className="text-success flex items-center gap-1">
                      <Icon icon="pixelarticons:check" width={11} height={11} />
                      Vivo
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. Night Action Confirmation Bar */}
      {phase === "NIGHT" && hasNightAbility && !isFinished && (
        <div className="border-2 border-accent bg-accent/10 p-2.5 rounded flex items-center justify-between gap-3 shadow-[2px_2px_0_0_rgba(0,0,0,0.3)]">
          <div className="text-xs">
            {nightSubmitted ? (
              <span className="text-success font-bold flex items-center gap-1.5">
                <Icon icon="pixelarticons:check" width={16} height={16} />
                Acción nocturna confirmada. Esperando al resto del pueblo...
              </span>
            ) : selectedTargetId ? (
              <span>
                Objetivo seleccionado:{" "}
                <strong className="text-accent">
                  {decodePlayerName(townState?.players.find((p) => p.id === selectedTargetId)?.name ?? "").display}
                </strong>
              </span>
            ) : (
              <span className="text-ink-soft">
                Selecciona a un jugador en la plaza para usar tu habilidad ({roleMeta.name}).
              </span>
            )}
          </div>
          {!nightSubmitted && (
            <Button
              variant="cta"
              onClick={handleConfirmNightAction}
              disabled={!selectedTargetId || isActing}
              className="text-xs py-1 px-3 shadow-none shrink-0"
            >
              Confirmar Objetivo
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
