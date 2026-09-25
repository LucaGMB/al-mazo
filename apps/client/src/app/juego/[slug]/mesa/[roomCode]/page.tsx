"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { useParams, useRouter } from "next/navigation";
import BackButton from "@/components/BackButton";
import Button from "@/components/Button";
import IconButton from "@/components/IconButton";
import JoinRoomForm from "@/components/game/JoinRoomForm";
import RoomLobby from "@/components/game/RoomLobby";
import PlayerBadge from "@/components/game/PlayerBadge";
import DrawPile from "@/components/game/DrawPile";
import DiscardPile from "@/components/game/DiscardPile";
import Hand from "@/components/game/Hand";
import ColorPicker from "@/components/game/ColorPicker";
import ChatDrawer from "@/components/game/ChatDrawer";
import TrucoTable from "@/components/game/TrucoTable";
import { useRoom } from "@/lib/room/use-room";
import { assignSeats } from "@/lib/room/seating";
import { decodePlayerName } from "@/lib/room/player-name";
import { useSound } from "@/lib/sound/use-sound";
import { getGame } from "@/lib/api/games";

const SLOT_ORDER: Array<"top" | "left" | "right"> = ["top", "left", "right"];

const QUICK_REACTIONS = [
  { text: "¡AL MAZO!", icon: "pixelarticons:megaphone" },
  { text: "¡Buena!", icon: "pixelarticons:thumbs-up" },
  { text: "¡Uff!", icon: "pixelarticons:zap" },
  { text: "¡Te toca!", icon: "pixelarticons:clock" },
  { text: "¡GG!", icon: "pixelarticons:trophy" },
] as const;

const CONFETTI_COLORS = ["#20A8D8", "#4DBD74", "#F5C518", "#F86C6B", "#9B59B6", "#E67E22"];
const CONFETTI = Array.from({ length: 28 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: (i % 10) * 130,
  duration: 1900 + (i % 5) * 350,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  size: 6 + (i % 3) * 3,
}));

export default function MesaPage() {
  const { slug, roomCode } = useParams<{ slug: string; roomCode: string }>();
  const router = useRouter();
  const {
    connection,
    publicState,
    hand,
    selfPlayerId,
    isHost,
    lastError,
    startRoom,
    addBot,
    playCard,
    drawCard,
    chooseColor,
    passTurn,
    leaveRoom,
    unreadChatCount,
    clearUnreadChat,
    sendChatMessage,
    chatBubbles,
    executeAction,
  } = useRoom();

  const [isActing, setIsActing] = useState(false);
  const [isTapada, setIsTapada] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [maxPlayers, setMaxPlayers] = useState<number | undefined>(undefined);
  const [hasShouted, setHasShouted] = useState(false);
  const [shoutToast, setShoutToast] = useState(false);
  const { play, muted, toggleMute } = useSound();

  // Sacudida de mesa (feedback físico) al gritar o jugar una carta.
  const shakeTimerRef = useRef<number | null>(null);
  function triggerShake() {
    setIsShaking(true);
    if (shakeTimerRef.current) window.clearTimeout(shakeTimerRef.current);
    shakeTimerRef.current = window.setTimeout(() => setIsShaking(false), 400);
  }
  useEffect(
    () => () => {
      if (shakeTimerRef.current) window.clearTimeout(shakeTimerRef.current);
    },
    []
  );

  const currentTurnPlayerId = publicState?.currentTurnPlayerId ?? null;
  const gameStatus = publicState?.status;
  const winnerId = publicState?.winnerId ?? null;

  // Sonido sólo cuando pasa a ser mi turno (ignora el primer estado real para
  // no sonar al entrar a una partida ya empezada).
  const prevTurnRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!publicState) return;
    const prev = prevTurnRef.current;
    prevTurnRef.current = currentTurnPlayerId;
    if (prev === undefined) return;
    if (currentTurnPlayerId !== prev && currentTurnPlayerId === selfPlayerId) {
      play("turnNotification");
    }
  }, [publicState, currentTurnPlayerId, selfPlayerId, play]);

  useEffect(() => {
    if (gameStatus === "FINISHED" && winnerId === selfPlayerId) play("victory");
  }, [gameStatus, winnerId, selfPlayerId, play]);

  const prevErrorRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastError && lastError !== prevErrorRef.current) play("error");
    prevErrorRef.current = lastError;
  }, [lastError, play]);

  useEffect(() => {
    let cancelled = false;
    getGame(slug)
      .then((game) => {
        if (!cancelled) setMaxPlayers(game?.game.rules.maxPlayers);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [slug]);

  function handleLeave() {
    void leaveRoom();
    router.push(`/juego/${slug}`);
  }

  if (connection === "needs_join") {
    return (
      <div className="max-w-[480px] mx-auto min-h-screen flex flex-col bg-app">
        <div className="px-4 pt-4">
          <BackButton />
        </div>
        <Suspense fallback={null}>
          <JoinRoomForm roomCode={roomCode.toUpperCase()} />
        </Suspense>
      </div>
    );
  }

  if (connection === "connecting" || connection === "idle") {
    return (
      <div className="min-h-screen flex items-center justify-center text-[13px] text-ink-faint">
        Conectando...
      </div>
    );
  }

  if (connection === "error" && !publicState) {
    return (
      <div className="max-w-[480px] mx-auto min-h-screen flex flex-col bg-app">
        <div className="px-4 pt-4">
          <BackButton />
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
          <div className="text-[13px] text-danger">{lastError ?? "Ocurrió un error"}</div>
          <Button to={`/juego/${slug}/mesa`} variant="outline">
            Volver a intentar
          </Button>
        </div>
      </div>
    );
  }

  if (!publicState) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[13px] text-ink-faint">
        Cargando sala...
      </div>
    );
  }

  if (publicState.status === "LOBBY") {
    return (
      <div className="relative min-h-screen bg-app flex flex-col">
        <div className="flex items-center justify-between px-4 pt-4">
          <BackButton />
          <div className="flex items-center gap-1">
            <span className="relative">
              <IconButton
                icon="message-text"
                size={18}
                active={isChatOpen}
                onClick={() => {
                  setIsChatOpen(true);
                  clearUnreadChat();
                }}
                aria-label="Abrir chat"
                title="Chat"
              />
              {unreadChatCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-danger text-[10px] font-bold text-ink flex items-center justify-center">
                  {unreadChatCount > 9 ? "9+" : unreadChatCount}
                </span>
              )}
            </span>
            <IconButton icon="log-out" onClick={handleLeave} />
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-4">
          <RoomLobby
            roomCode={roomCode.toUpperCase()}
            publicState={publicState}
            isHost={isHost}
            maxPlayers={maxPlayers}
            onStart={() => void startRoom()}
            onAddBot={() => void addBot()}
          />
          {lastError && <div className="text-[13px] text-danger text-center px-4">{lastError}</div>}
        </div>
        <ChatDrawer isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
      </div>
    );
  }

  if (publicState.status === "FINISHED") {
    const winner = publicState.players.find((p) => p.id === publicState.winnerId);
    const isWinner = winnerId === selfPlayerId;
    return (
      <div className="relative max-w-[480px] mx-auto min-h-screen flex flex-col items-center justify-center gap-4 bg-app text-center px-6 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          {CONFETTI.map((c, i) => (
            <span
              key={i}
              className="absolute top-0 rounded-sm"
              style={{
                left: `${c.left}%`,
                width: c.size,
                height: c.size * 1.6,
                backgroundColor: c.color,
                animation: `confetti-fall ${c.duration}ms linear ${c.delay}ms infinite`,
              }}
            />
          ))}
        </div>
        <Icon
          icon="pixelarticons:trophy"
          width={56}
          height={56}
          className="relative z-10 animate-bounce text-warning"
        />
        <div className="relative z-10 text-xl font-black text-warning">
          {isWinner ? "¡Victoria!" : "Partida Terminada"}
        </div>
        <div className="relative z-10 text-[14px] text-ink">
          {winner ? (
            <>
              Ganó{" "}
              <span className="font-bold text-accent">
                {decodePlayerName(winner.name).display}
              </span>
            </>
          ) : (
            "Sin ganador"
          )}
        </div>
        <div className="relative z-10 flex w-full max-w-[240px] flex-col gap-2">
          <Button
            variant="primary"
            fullWidth
            onClick={() => {
              setHasShouted(false);
              void startRoom();
            }}
          >
            <Icon icon="pixelarticons:reload" width={16} height={16} />
            Jugar de nuevo
          </Button>
          <Button variant="outline" fullWidth to="/">
            <Icon icon="pixelarticons:home" width={16} height={16} />
            Volver al catálogo
          </Button>
        </div>
        {lastError && <div className="relative z-10 text-[12px] text-danger">{lastError}</div>}
      </div>
    );
  }

  // IN_PROGRESS
  const isTruco = slug === "truco";
  const { self, others } = assignSeats(publicState.players, selfPlayerId);
  // El server agrega al host primero (GameRoom.addPlayer), mismo criterio que RoomLobby.
  const hostPlayerId = publicState.players[0]?.id;
  const isMyTurn = publicState.currentTurnPlayerId === selfPlayerId;
  const pendingChoiceForMe = publicState.pendingChoice?.playerId === selfPlayerId;
  const pendingChoiceForOther = !!publicState.pendingChoice && !pendingChoiceForMe;
  const customState = (publicState.customState ?? {}) as Record<string, any>;
  const pendingBet = isTruco ? customState.pendingBet ?? null : null;
  // Mientras hay un color pendiente de elegir (comodín recién jugado), el
  // turno sigue siendo del mismo jugador pero no puede jugar/robar otra carta
  // hasta resolver el color (ver GameEngine.playCard en el server).
  const canAct = isMyTurn && !pendingChoiceForMe && !isActing;
  const canPlayHandCards = canAct && (!isTruco || !pendingBet);

  async function handlePlay(cardId: string, tapada?: boolean) {
    if (!canAct) return;
    if (isTruco && pendingBet) return;
    setIsActing(true);
    try {
      const playingTapada = tapada !== undefined ? tapada : isTapada;
      await playCard(cardId, undefined, playingTapada);
      setIsTapada(false);
      play("playCard");
      triggerShake();
    } finally {
      setIsActing(false);
    }
  }

  async function handleTrucoAction(action: string, payload?: Record<string, unknown>) {
    if (isActing) return;
    setIsActing(true);
    try {
      await executeAction(action, payload);
      play("reaction");
    } finally {
      setIsActing(false);
    }
  }

  async function handleDraw() {
    if (!canAct) return;
    setIsActing(true);
    try {
      await drawCard();
      play("drawCard");
    } finally {
      setIsActing(false);
    }
  }

  async function handlePass() {
    if (!canAct) return;
    setIsActing(true);
    try {
      await passTurn();
    } finally {
      setIsActing(false);
    }
  }

  function handleShout() {
    play("alMazo");
    void sendChatMessage("¡AL MAZO!");
    setHasShouted(true);
    setShoutToast(true);
    triggerShake();
    window.setTimeout(() => setShoutToast(false), 2500);
  }

  function handleReaction(text: string) {
    void sendChatMessage(text);
    if (text === "¡AL MAZO!") {
      play("alMazo");
      setHasShouted(true);
      triggerShake();
    } else {
      play("reaction");
    }
  }

  return (
    <div className="max-w-[480px] md:max-w-3xl mx-auto min-h-screen flex flex-col bg-app">
      <div className="flex-none px-3.5 md:px-6 py-2.5 md:py-4 flex items-center justify-between">
        <BackButton />
        <div className="text-center">
          <div className="inline-flex flex-col items-center rounded-xl border border-subtle bg-statusbar/90 px-4 py-1.5 shadow-[0_0_18px_rgba(32,168,216,0.15)] backdrop-blur">
            <div className="flex items-center gap-1.5 text-xs md:text-sm font-black uppercase tracking-wider text-ink">
              <Icon icon="pixelarticons:gamepad" width={14} height={14} className="text-accent" />
              {slug}
            </div>
            <div className="text-[10px] md:text-[11px] font-bold tracking-[0.25em] text-accent">
              SALA {roomCode.toUpperCase()}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span className="relative">
            <IconButton
              icon="message-text"
              size={18}
              active={isChatOpen}
              onClick={() => {
                setIsChatOpen(true);
                clearUnreadChat();
              }}
              aria-label="Abrir chat"
              title="Chat"
            />
            {unreadChatCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-danger text-[10px] font-bold text-ink flex items-center justify-center">
                {unreadChatCount > 9 ? "9+" : unreadChatCount}
              </span>
            )}
          </span>
          <IconButton
            icon={muted ? "volume-x" : "volume-2"}
            size={18}
            onClick={toggleMute}
            aria-label={muted ? "Activar sonido" : "Silenciar sonido"}
            title={muted ? "Activar sonido" : "Silenciar sonido"}
          />
          <IconButton icon="log-out" size={18} onClick={handleLeave} />
        </div>
      </div>

      {isTruco ? (
        <div
          className={`flex-1 relative px-3 py-2 overflow-y-auto ${
            isShaking ? "animate-table-shake" : ""
          }`}
        >
          {others[0] && (
            <div className="relative w-full h-11 flex justify-center mb-1">
              <PlayerBadge
                player={others[0]}
                position="top"
                isHost={others[0].id === hostPlayerId}
                isCurrentTurn={publicState.currentTurnPlayerId === others[0].id}
                turnExpiresAt={
                  publicState.currentTurnPlayerId === others[0].id ? publicState.turnExpiresAt : null
                }
                recentMessage={chatBubbles[others[0].id]?.text ?? null}
              />
            </div>
          )}

          <TrucoTable
            publicState={publicState}
            selfPlayerId={selfPlayerId}
            hand={hand}
            canAct={canAct}
            onPlayCard={(cardId, tapada) => handlePlay(cardId, tapada)}
            onExecuteAction={handleTrucoAction}
            isActing={isActing}
            isTapada={isTapada}
            onToggleTapada={() => setIsTapada((prev) => !prev)}
          />
        </div>
      ) : (
        <div
          className={`flex-1 relative px-4.5 py-1.5 min-h-[420px] md:min-h-[560px] ${
            isShaking ? "animate-table-shake" : ""
          }`}
        >
          {others.slice(0, 3).map((player, i) => (
            <PlayerBadge
              key={player.id}
              player={player}
              position={SLOT_ORDER[i]}
              isHost={player.id === hostPlayerId}
              isCurrentTurn={publicState.currentTurnPlayerId === player.id}
              turnExpiresAt={
                publicState.currentTurnPlayerId === player.id ? publicState.turnExpiresAt : null
              }
              recentMessage={chatBubbles[player.id]?.text ?? null}
            />
          ))}
          {others.length > 3 && (
            <div className="absolute top-1 right-1 text-[10px] text-ink-faint">
              +{others.length - 3} más
            </div>
          )}

          <div className="absolute top-[90px] md:top-[120px] left-1/2 -translate-x-1/2 w-[300px] h-[300px] md:w-[440px] md:h-[440px] rounded-full border-[10px] border-[#3E2723] shadow-[inset_0_0_0_2px_rgba(212,175,55,0.5),inset_0_0_30px_rgba(0,0,0,0.55),0_0_0_1px_#0B160F,0_0_24px_rgba(212,175,55,0.18)] bg-[radial-gradient(circle_at_40%_35%,#2E6F40,#1D4B2B_70%,#112B19_100%)]">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center gap-5 md:gap-8 pointer-events-auto">
              <DrawPile count={publicState.drawPileCount} disabled={!canAct} onClick={handleDraw} />
              <DiscardPile
                topCard={publicState.topDiscardCard}
                count={publicState.discardPileCount}
                activeColor={publicState.activeColor}
              />
            </div>
            {pendingChoiceForMe && (
              <ColorPicker
                gameSlug={slug}
                onChoose={(color) => {
                  play("colorChosen");
                  void chooseColor(color);
                }}
              />
            )}
          </div>

          {self && (
            <PlayerBadge
              player={self}
              position="self"
              isSelf
              isHost={self.id === hostPlayerId}
              isCurrentTurn={isMyTurn}
              turnExpiresAt={isMyTurn ? publicState.turnExpiresAt : null}
              recentMessage={chatBubbles[self.id]?.text ?? null}
            />
          )}
        </div>
      )}

       {isMyTurn && gameStatus === "IN_PROGRESS" && (
         <div className="flex-none flex justify-center pb-1">
           <div className="inline-flex animate-bounce items-center gap-2 rounded-full border border-warning/60 bg-[#3a2a0b] px-4 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-warning shadow-[0_0_18px_rgba(245,197,24,0.25)]">
             <span className="h-2 w-2 animate-pulse rounded-full bg-warning" />
             Tu Turno
           </div>
         </div>
       )}

       {!isTruco && (
         <div className="flex-none px-3.5 md:px-6 py-1.5 md:py-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-medium text-[11px] md:text-sm text-ink">
            <span className={`w-2 h-2 rounded-full ${isMyTurn ? "bg-accent" : "bg-ink-faint"}`} />
            {pendingChoiceForMe
              ? "Elegí un color"
              : pendingChoiceForOther
                ? "Esperando color..."
                : isMyTurn
                  ? "Tu turno"
                  : "Esperando turno"}
          </div>
          {canAct && (
            <div className="flex gap-2">
              <Button variant="ghost" onClick={handlePass}>
                Pasar turno
              </Button>
            </div>
          )}
        </div>
       )}

      {lastError && <div className="text-[12px] text-danger text-center px-4 pb-2">{lastError}</div>}

      {!isTruco && self?.cardCount === 1 && !hasShouted && (
        <div className="flex-none flex justify-center pb-1">
          <button
            type="button"
            onClick={handleShout}
            className="animate-bounce rounded-full bg-warning border-2 border-black/20 px-5 py-1.5 text-[13px] md:text-sm font-black text-black shadow-[0_0_18px_rgba(255,193,7,0.7)] cursor-pointer"
          >
             <Icon icon="pixelarticons:bullhorn" width={18} height={18} />
             ¡AL MAZO!
          </button>
        </div>
      )}

      {shoutToast && (
        <div className="flex-none flex justify-center pb-1">
          <span className="rounded-full bg-success px-4 py-1 text-[12px] font-bold text-white shadow-[0_0_14px_rgba(77,189,116,0.6)]">
            ¡Cantaste AL MAZO!
          </span>
        </div>
      )}

      <div className="flex-none flex justify-center pb-1">
        <div
          className="flex items-center justify-center gap-1.5 py-1 px-3 bg-statusbar/80 backdrop-blur rounded-full border border-subtle mx-auto"
          role="group"
          aria-label="Bandeja de reacciones"
        >
          {QUICK_REACTIONS.map((reaction) => (
            <button
              key={reaction.text}
              type="button"
              onClick={() => handleReaction(reaction.text)}
              className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-subtle bg-app/60 px-2 py-0.5 text-[10px] md:text-[11px] font-bold text-ink-soft transition-colors duration-150 hover:border-accent/60 hover:text-accent"
            >
              <Icon icon={reaction.icon} width={13} height={13} aria-hidden />
              {reaction.text}
            </button>
          ))}
        </div>
      </div>

      <Hand cards={hand} canPlay={canPlayHandCards} onPlay={(cardId) => handlePlay(cardId)} isTapada={isTapada} />

      <ChatDrawer isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </div>
  );
}
