"use client";

import { useState } from "react";
import { Icon } from "@iconify/react";
import Button from "@/components/Button";
import { decodePlayerName } from "@/lib/room/player-name";
import type { PublicGameState } from "@/types/engine";

export default function RoomLobby({
  roomCode,
  publicState,
  isHost,
  maxPlayers,
  onStart,
  onAddBot,
  onRemoveBot,
}: {
  roomCode: string;
  publicState: PublicGameState;
  isHost: boolean;
  maxPlayers?: number;
  onStart: () => void;
  onAddBot: () => void;
  onRemoveBot?: (botId: string) => void;
}) {
  const isFull = maxPlayers !== undefined && publicState.players.length >= maxPlayers;
  const [copied, setCopied] = useState(false);
  // El server agrega al host primero (GameRoom.addPlayer), así que el primer
  // jugador de la lista es el creador de la sala.
  const hostPlayerId = publicState.players[0]?.id;
  const colorMatchMode = publicState.customState?.colorMatchMode as
    | "CLASSIC"
    | "BLITZ"
    | "CHAOS"
    | undefined;

  async function handleCopy() {
    await navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleWhatsApp() {
    window.open(
      `https://api.whatsapp.com/send?text=${encodeURIComponent(
        `¡Sumate a mi partida de Al Mazo! Código: ${roomCode} ${window.location.href}`
      )}`,
      "_blank"
    );
  }

  return (
    <div className="max-w-lg w-full mx-auto my-auto p-6 md:p-8 border-[3px] border-subtle bg-statusbar/95 shadow-[6px_8px_0_0_rgba(0,0,0,0.35)] text-center flex flex-col items-center gap-5">
      <div className="flex items-center gap-2 font-display text-lg font-black text-ink">
        <Icon icon="pixelarticons:users" width={22} height={22} className="text-accent" />
        Sala de espera
      </div>

      <div className="flex flex-col items-center gap-3">
        <div className="text-[11px] uppercase tracking-[0.25em] text-ink-faint">
          Código para unirse
        </div>
        <div className="font-mono text-4xl md:text-5xl font-black tracking-[0.3em] text-accent [text-shadow:3px_3px_0_rgba(0,0,0,0.35)]">
          {roomCode}
        </div>
        {colorMatchMode && (
          <div className="inline-flex items-center gap-1.5 border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-bold text-accent">
            <Icon
              icon={
                colorMatchMode === "BLITZ"
                  ? "pixelarticons:zap"
                  : colorMatchMode === "CHAOS"
                  ? "pixelarticons:reload"
                  : "pixelarticons:sliders"
              }
              width={14}
              height={14}
            />
            <span>
              Modo:{" "}
              {colorMatchMode === "BLITZ"
                ? "Blitz (4 cartas · Rápido)"
                : colorMatchMode === "CHAOS"
                ? "Chaos (Swap & Discard)"
                : "Clásico"}
            </span>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button variant="outline" onClick={handleCopy}>
            <Icon icon="pixelarticons:copy" width={16} height={16} />
            {copied ? "¡Copiado!" : "Copiar enlace"}
          </Button>
          <Button variant="outline" onClick={handleWhatsApp}>
            <Icon icon="pixelarticons:whatsapp" width={16} height={16} />
            Compartir por WhatsApp
          </Button>
        </div>
      </div>

      <div className="w-full flex flex-col gap-2">
        {publicState.players.map((p) => {
          const isHostPlayer = p.id === hostPlayerId;
          return (
            <div
              key={p.id}
 className="flex w-full items-center gap-3 border-2 border-subtle bg-app/50 px-3 py-2.5 text-left"
            >
              <span
 className={`h-2.5 w-2.5 shrink-0 ${
                  p.isConnected
                    ? "animate-pulse bg-success shadow-[0_0_8px_rgba(51,196,141,0.9)]"
                    : "bg-ink-faint"
                }`}
                aria-hidden
              />
              <span className="flex-1 truncate text-[13px] font-medium text-ink">
                {decodePlayerName(p.name).display}
              </span>
              {isHostPlayer && (
 <span className="inline-flex items-center gap-1 border-2 border-warning/60 bg-warning/15 px-2 py-0.5 text-[10px] font-bold text-warning">
                  <Icon icon="pixelarticons:crown" width={12} height={12} />
                  ANFITRIÓN
                </span>
              )}
              {p.isBot && (
 <span className="inline-flex items-center gap-1 border-2 border-accent/60 bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent">
                  <Icon icon="pixelarticons:robot" width={12} height={12} />
                  BOT
                </span>
              )}
              {isHost && p.isBot && onRemoveBot && (
                <button
                  type="button"
                  onClick={() => onRemoveBot(p.id)}
                  aria-label="Eliminar bot"
                  title="Eliminar bot"
 className="inline-flex items-center justify-center w-6 h-6 border border-danger/40 bg-danger/10 text-danger hover:bg-danger/25 hover:border-danger transition-colors cursor-pointer text-xs font-bold"
                >
                  <Icon icon="pixelarticons:close" width={14} height={14} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {isHost ? (
        <div className="flex w-full flex-col gap-2">
          {!isFull && (
            <Button variant="outline" fullWidth onClick={onAddBot}>
              <Icon icon="pixelarticons:robot" width={16} height={16} />
              Sumar Bot a la mesa
            </Button>
          )}
          {publicState.players.length < 2 && (
            <div className="text-[12px] text-ink-faint">
              Se necesitan al menos 2 jugadores en la mesa. Podés sumar un bot o compartir el enlace.
            </div>
          )}
          <Button
            variant="primary"
            fullWidth
            onClick={onStart}
            disabled={publicState.players.length < 2}
            className="!h-12 !text-base"
          >
            <Icon icon="pixelarticons:play" width={18} height={18} />
            Iniciar partida
          </Button>
        </div>
      ) : (
        <div className="text-[13px] text-ink-faint">Esperando a que el anfitrión inicie la partida...</div>
      )}
    </div>
  );
}
