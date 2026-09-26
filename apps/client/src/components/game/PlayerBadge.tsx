import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { decodePlayerName } from "@/lib/room/player-name";
import type { PlayerPublicInfo } from "@/types/engine";

const POSITION_CLASSES: Record<string, string> = {
  top: "top-2 left-1/2 -translate-x-1/2",
  left: "top-1/2 -translate-y-1/2 left-2",
  right: "top-1/2 -translate-y-1/2 right-2",
  self: "bottom-2 left-1/2 -translate-x-1/2",
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
// server) por cardCount real y resaltado de turno. Ícono arriba, una sola
// línea de texto abajo (nombre + puntaje) — sin marco para los oponentes,
// solo vos (self) llevás fondo/borde propio.
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

  // hasTimer && no solo remainingSeconds !== null: sin el hasTimer, el aro
  // quedaba pegado en cualquier jugador que alguna vez tuvo el turno (el
  // estado nunca se limpiaba al pasar a otro jugador).
  const showTimer = hasTimer && remainingSeconds !== null;
  const ringStrokeClass = !showTimer
    ? ""
    : remainingSeconds <= 5
      ? "stroke-danger animate-pulse"
      : remainingSeconds <= 10
        ? "stroke-warning"
        : "stroke-accent";
  const timerPct = showTimer ? Math.min(1, remainingSeconds / TURN_TIMER_SECONDS) : 1;

  const avatarSize = compact ? "w-6 h-6" : isSelf ? "w-9 h-9 md:w-11 md:h-11" : "w-8 h-8 md:w-10 md:h-10";
  const iconSize = compact ? 12 : isSelf ? 18 : 16;

  return (
    <div
      data-player-id={player.id}
      className={
        compact
          ? "flex flex-col items-center gap-0.5"
          : `absolute flex flex-col items-center gap-1 ${POSITION_CLASSES[position]} ${
              isSelf
                ? `bg-statusbar border-2 px-2.5 py-1.5 shadow-[3px_3px_0_0_rgba(0,0,0,0.35)] ${
                    isCurrentTurn ? "border-warning" : "border-subtle"
                  }`
                : ""
            }`
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
          ni relieve simulado. Redondo para que el aro de turno lo abrace
          bien (con esquina recta quedaba flotando en las puntas). */}
      <div
        className={`relative shrink-0 rounded-full border-[3px] border-[#0b0812] flex items-center justify-center ${avatarSize} ${
          !player.isConnected ? "opacity-40" : ""
        }`}
        style={{ backgroundColor: avatarColor }}
      >
        <Icon icon={avatarIcon} width={iconSize} height={iconSize} className="text-[#f4f1ff]" aria-hidden />
        {!player.isConnected && (
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full animate-pulse border border-statusbar bg-danger" />
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
      <div
        className={`flex items-center gap-1 whitespace-nowrap font-medium text-ink ${
          compact ? "text-[9px]" : "text-[10px] md:text-xs"
        }`}
      >
        <span className={compact ? "max-w-[56px] truncate" : "max-w-[92px] truncate"}>{display}</span>
        {player.isBot && (
          <Icon icon="pixelarticons:robot" width={compact ? 10 : 12} height={compact ? 10 : 12} className="shrink-0 text-accent" aria-label="Bot" />
        )}
        {typeof score === "number" && <span className="shrink-0 font-bold text-warning">· {score} pts</span>}
        {!compact && typeof escobas === "number" && escobas > 0 && (
          <span className="shrink-0 text-accent" title="Escobas">🧹{escobas}</span>
        )}
        {!compact && !player.isConnected && (
          <span className="shrink-0 inline-flex items-center gap-0.5 text-danger">
            <span className="h-1.5 w-1.5 rounded-full animate-pulse bg-danger" />
            desconectado
          </span>
        )}
      </div>
    </div>
  );
}
