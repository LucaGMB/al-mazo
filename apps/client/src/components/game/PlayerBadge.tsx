import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { decodePlayerName } from "@/lib/room/player-name";
import type { PlayerPublicInfo } from "@/types/engine";

const POSITION_CLASSES: Record<string, string> = {
  top: "top-2 left-1/2 -translate-x-1/2 pl-1 pr-3",
  left: "top-1/2 -translate-y-1/2 left-2 pl-1 pr-2.5",
  right: "top-1/2 -translate-y-1/2 right-2 pl-1 pr-2.5",
  self: "bottom-2 left-1/2 -translate-x-1/2 pl-1 pr-3.5",
};

// Paleta de "fichas" para jugadores sin rol especial: se elige por hash del
// nombre para que cada jugador tenga siempre el mismo color dentro de la
// partida. Tonos saturados tipo ficha de casino, no colores rústicos.
const AVATAR_COLORS = ["#4fa8ff", "#ff8f4d", "#ff6b9d", "#33c48d", "#9b6bff", "#ffb84d"];

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// El server no expone la duración real del turno (GameRoom.turnTimeoutSeconds
// en apps/server/src/realtime/room.ts, hoy siempre 25 y sin override), así
// que el aro usa esta constante como referencia del 100%.
// ponytail: si el turno pasa a ser configurable por juego, exponerlo en
// publicState y reemplazar esta constante.
const TURN_TIMER_SECONDS = 25;

// Adaptado de la demo: reemplaza "vida"/"maná" (ficticios, no existen en el
// server) por cardCount real y resaltado de turno.
export default function PlayerBadge({
  player,
  position,
  isSelf,
  isHost,
  isCurrentTurn,
  turnExpiresAt,
  recentMessage,
  score,
  escobas,
  capturedCount,
  drawPulse,
  compact,
}: {
  player: PlayerPublicInfo;
  position: "top" | "left" | "right" | "self";
  isSelf?: boolean;
  isHost?: boolean;
  isCurrentTurn?: boolean;
  turnExpiresAt?: number | null;
  recentMessage?: string | null;
  score?: number;
  escobas?: number;
  capturedCount?: number;
  drawPulse?: { amount: number; key: number } | null;
  // Ficha chica en flujo normal (no absolute), para cuando hay más
  // oponentes de los que entran en los 3 slots fijos alrededor de la mesa.
  compact?: boolean;
}) {
  const { display } = decodePlayerName(player.name);
  const avatarColor = player.isBot
    ? "#33c48d"
    : isSelf
      ? "#ffd23f"
      : isHost
        ? "#ff4d6d"
        : AVATAR_COLORS[hashName(player.name) % AVATAR_COLORS.length];
  const avatarIcon = player.isBot
    ? "pixelarticons:robot"
    : isHost
      ? "pixelarticons:crown"
      : "pixelarticons:user";
  const ringClasses = isCurrentTurn ? "border-warning border-[3px]" : "";
  const hasTimer = isCurrentTurn && typeof turnExpiresAt === "number";

  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  useEffect(() => {
    if (!hasTimer || typeof turnExpiresAt !== "number") return;
    const update = () => {
      const seconds = Math.max(0, Math.ceil((turnExpiresAt - Date.now()) / 1000));
      setRemainingSeconds(seconds > 0 ? seconds : null);
    };
    const id = setInterval(update, 500);
    const initial = setTimeout(update, 0);
    return () => {
      clearInterval(id);
      clearTimeout(initial);
    };
  }, [hasTimer, turnExpiresAt]);

  const showTimer = remainingSeconds !== null;
  const ringStrokeClass = !showTimer
    ? ""
    : remainingSeconds <= 5
      ? "stroke-danger animate-pulse"
      : remainingSeconds <= 10
        ? "stroke-warning"
        : "stroke-accent";
  const timerPct = showTimer ? Math.min(1, remainingSeconds / TURN_TIMER_SECONDS) : 1;

  return (
    <div
      data-player-id={player.id}
      className={
        compact
          ? `flex items-center gap-1.5 bg-statusbar border-2 border-subtle py-0.5 pl-1 pr-2 shadow-[2px_2px_0_0_rgba(0,0,0,0.35)] ${ringClasses}`
 : `absolute flex items-center gap-2 md:gap-3 bg-statusbar border-2 border-subtle py-1 md:py-1.5 shadow-[3px_3px_0_0_rgba(0,0,0,0.35)] ${POSITION_CLASSES[position]} ${ringClasses}`
      }
    >
      {!compact && recentMessage && (
        <div
          key={recentMessage}
 className="absolute -top-7 left-1/2 -translate-x-1/2 z-30 pointer-events-none whitespace-nowrap border-2 border-accent bg-statusbar/95 px-2.5 py-0.5 text-[11px] font-bold text-accent shadow-[0_0_12px_rgba(255,210,63,0.4)] animate-bubble-pop"
        >
          {recentMessage}
          <span
            aria-hidden
            className="absolute left-1/2 top-full -translate-x-1/2 h-0 w-0 border-x-[5px] border-t-[5px] border-x-transparent border-t-accent/60"
          />
        </div>
      )}
      {/* Avatar plano: círculo de color sólido + borde grueso, sin gradiente
          ni relieve simulado. */}
      <div
 className={`relative shrink-0 border-[3px] border-[#0b0812] flex items-center justify-center ${
          compact ? "w-4 h-4" : isSelf ? "w-7 h-7 md:w-9 md:h-9" : "w-6 h-6 md:w-8 md:h-8"
        } ${!player.isConnected ? "opacity-40" : ""}`}
        style={{ backgroundColor: avatarColor }}
      >
        <Icon
          icon={avatarIcon}
          width={compact ? 10 : isSelf ? 16 : 14}
          height={compact ? 10 : isSelf ? 16 : 14}
          className="text-[#f4f1ff]"
          aria-hidden
        />
        {!player.isConnected && (
 <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse border border-statusbar bg-danger" />
        )}
        {drawPulse && (
          <span
            key={drawPulse.key}
 className="pointer-events-none absolute -right-1.5 -top-1.5 z-20 border-2 border-[#241a44] bg-warning px-1.5 py-0.5 font-display text-[10px] text-[#171a35] animate-draw-pulse"
          >
            +{drawPulse.amount}
          </span>
        )}
        {showTimer && (
          <svg viewBox="0 0 36 36" className="pointer-events-none absolute -inset-1 -rotate-90" aria-hidden>
            <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(0,0,0,0.45)" strokeWidth="3" />
            <circle
              cx="18"
              cy="18"
              r="16"
              fill="none"
              strokeWidth="3"
              strokeLinecap="butt"
              pathLength={100}
              strokeDasharray={100}
              strokeDashoffset={100 - timerPct * 100}
              className={`transition-[stroke-dashoffset] duration-500 ease-linear ${ringStrokeClass}`}
            />
          </svg>
        )}
      </div>
      <div>
        <div
          className={`font-medium text-ink inline-flex items-center gap-1 ${
            compact ? "text-[10px] max-w-[72px] truncate" : "text-[11px] md:text-sm"
          }`}
        >
          {display}
          {player.isBot && (
            <Icon icon="pixelarticons:robot" width={13} height={13} className="text-accent shrink-0" aria-label="Bot" />
          )}
          {isSelf ? " (vos)" : ""}
        </div>
        {!compact && (
          <div className="flex items-center gap-1 text-[10px] md:text-xs text-ink-faint">
            <Icon icon="pixelarticons:notes" width={11} height={11} aria-hidden />
            <span>{player.cardCount} en mano</span>
            {typeof score === "number" && (
              <span className="font-bold text-warning ml-0.5">· {score} pts</span>
            )}
            {typeof escobas === "number" && escobas > 0 && (
              <span className="text-accent ml-0.5" title="Escobas">🧹{escobas}</span>
            )}
            {!player.isConnected && (
              <span className="inline-flex items-center gap-0.5 text-danger">
 <span className="h-1.5 w-1.5 animate-pulse bg-danger" />
                desconectado
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
