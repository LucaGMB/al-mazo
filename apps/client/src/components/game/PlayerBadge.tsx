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

// Paleta para jugadores sin rol especial: se elige por hash del nombre para
// que cada jugador tenga siempre el mismo color dentro de la partida.
const AVATAR_GRADIENTS = [
  "from-emerald-400 to-emerald-700",
  "from-rose-400 to-rose-700",
  "from-indigo-400 to-indigo-700",
  "from-orange-400 to-orange-700",
  "from-teal-400 to-teal-700",
  "from-pink-400 to-pink-700",
];

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(h);
}

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
}) {
  const { display } = decodePlayerName(player.name);
  const avatarGradient = player.isBot
    ? "from-purple-400 to-purple-700"
    : isSelf
      ? "from-cyan-400 to-cyan-700"
      : isHost
        ? "from-amber-300 to-amber-600"
        : AVATAR_GRADIENTS[hashName(player.name) % AVATAR_GRADIENTS.length];
  const avatarIcon = player.isBot
    ? "pixelarticons:robot"
    : isHost
      ? "pixelarticons:crown"
      : "pixelarticons:user";
  const ringClasses = isCurrentTurn
    ? "border-warning/80 border-2 shadow-[0_0_18px_rgba(245,197,24,0.45)]"
    : "";
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
  const timerClasses = !showTimer
    ? ""
    : remainingSeconds <= 5
      ? "bg-danger/20 border-danger/60 text-danger font-bold animate-pulse"
      : remainingSeconds <= 10
        ? "bg-warning/20 border-warning/60 text-warning"
        : "bg-accent/15 border-accent/50 text-accent";

  return (
    <div
      className={`absolute flex items-center gap-2 md:gap-3 bg-statusbar border border-subtle rounded-full py-1 md:py-1.5 shadow-[0_2px_6px_rgba(0,0,0,0.35)] ${POSITION_CLASSES[position]} ${ringClasses}`}
    >
      {recentMessage && (
        <div
          key={recentMessage}
          className="absolute -top-7 left-1/2 -translate-x-1/2 z-30 pointer-events-none whitespace-nowrap rounded-full border border-accent/60 bg-statusbar/95 px-2.5 py-0.5 text-[11px] font-bold text-accent shadow-[0_0_12px_rgba(32,168,216,0.4)] animate-bubble-pop"
        >
          {recentMessage}
          <span
            aria-hidden
            className="absolute left-1/2 top-full -translate-x-1/2 h-0 w-0 border-x-[5px] border-t-[5px] border-x-transparent border-t-accent/60"
          />
        </div>
      )}
      <div
        className={`relative shrink-0 rounded-full bg-gradient-to-br ${avatarGradient} flex items-center justify-center ${
          isSelf ? "w-7 h-7 md:w-9 md:h-9" : "w-6 h-6 md:w-8 md:h-8"
        } ${!player.isConnected ? "opacity-40" : ""}`}
      >
        <Icon
          icon={avatarIcon}
          width={isSelf ? 16 : 14}
          height={isSelf ? 16 : 14}
          className="text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.55)]"
          aria-hidden
        />
        {!player.isConnected && (
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse rounded-full border border-statusbar bg-danger shadow-[0_0_6px_rgba(248,108,107,0.9)]" />
        )}
      </div>
      <div>
        <div className="font-medium text-[11px] md:text-sm text-ink inline-flex items-center gap-1">
          {display}
          {player.isBot && (
            <Icon icon="pixelarticons:robot" width={13} height={13} className="text-accent" aria-label="Bot" />
          )}
          {isSelf ? " (vos)" : ""}
        </div>
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
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-danger" />
              desconectado
            </span>
          )}
          {showTimer && (
            <span
              className={`ml-0.5 inline-flex items-center gap-0.5 rounded-full border px-1.5 py-px ${timerClasses}`}
            >
              <Icon icon="pixelarticons:clock" width={11} height={11} aria-hidden />
              {remainingSeconds}s
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
