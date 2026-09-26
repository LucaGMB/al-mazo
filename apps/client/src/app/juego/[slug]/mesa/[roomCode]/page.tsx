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
import CommunityTable, { getEscobaPointValue } from "@/components/game/CommunityTable";
import CardFlight from "@/components/game/CardFlight";
import CardView from "@/components/game/CardView";
import CardBack from "@/components/game/CardBack";
import DesconectadosTable from "@/components/game/DesconectadosTable";
import SubmissionTable from "@/components/game/SubmissionTable";
import { useRoom } from "@/lib/room/use-room";
import { assignSeats } from "@/lib/room/seating";
import { decodePlayerName } from "@/lib/room/player-name";
import { useSound } from "@/lib/sound/use-sound";
import { getGame } from "@/lib/api/games";
import { canPlayDiscardCard } from "@/lib/game/can-play-card";
import type { Card } from "@/types/engine";

const SLOT_ORDER: Array<"top" | "left" | "right"> = ["top", "left", "right"];

const QUICK_REACTIONS = [
  { text: "¡AL MAZO!", icon: "pixelarticons:megaphone" },
  { text: "¡Buena!", icon: "pixelarticons:thumbs-up" },
  { text: "¡Uff!", icon: "pixelarticons:zap" },
  { text: "¡Te toca!", icon: "pixelarticons:clock" },
  { text: "¡GG!", icon: "pixelarticons:trophy" },
] as const;

const CONFETTI_COLORS = ["#ffd23f", "#33c48d", "#ff8f4d", "#ff4d6d", "#f4f1ff", "#4fa8ff"];
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
    removeBot,
    playCard,
    drawCard,
    chooseColor,
    passTurn,
    leaveRoom,
    executeAction,
    unreadChatCount,
    clearUnreadChat,
    sendChatMessage,
    chatBubbles,
    forcedDraw,
  } = useRoom();

  const [isActing, setIsActing] = useState(false);
  const [isTapada, setIsTapada] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [maxPlayers, setMaxPlayers] = useState<number | undefined>(undefined);
  const [targetScore, setTargetScore] = useState<number | undefined>(undefined);
  const [hasShouted, setHasShouted] = useState(false);
  const [shoutToast, setShoutToast] = useState(false);
  const { play, muted, toggleMute } = useSound();

  // El server manda el modo de mesa explícito (TRICK/COMMUNITY/DISCARD) en
  // cada PublicGameState; usar heurísticas sobre campos opcionales (p. ej.
  // `tableCards` vacío es truthy) hacía que todos los juegos se vieran como
  // Escoba del 15.
  const gameMode = publicState?.gameMode;
  const isTruco = gameMode ? gameMode === "TRICK" : slug === "truco";
  const isCommunity = gameMode ? gameMode === "COMMUNITY" : slug === "escoba-del-15";
  const [selectedHandCardId, setSelectedHandCardId] = useState<string | null>(null);
  const [selectedTableCardIds, setSelectedTableCardIds] = useState<string[]>([]);

  // Prune table card selections if cards are no longer on table
  useEffect(() => {
    if (!publicState?.tableCards) return;
    const currentTableIds = new Set(publicState.tableCards.map((c) => c.id));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedTableCardIds((prev) => prev.filter((id) => currentTableIds.has(id)));
  }, [publicState?.tableCards]);

  // Reset selections when turn changes away from self
  useEffect(() => {
    if (publicState?.currentTurnPlayerId !== selfPlayerId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedHandCardId(null);
      setSelectedTableCardIds([]);
    }
  }, [publicState?.currentTurnPlayerId, selfPlayerId]);

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

  const gameAreaRef = useRef<HTMLDivElement | null>(null);

  // Detecta que a un jugador (cualquiera, vos incluido) le crecieron las
  // cartas en mano: le hace flotar un "+N" sobre su ficha y además anima una
  // carta viajando desde el mazo hasta esa ficha (robo propio o forzado por
  // un +2/+4 en su contra — no distingue el motivo; para el aviso puntual de
  // "te comieron cartas" está `forcedDraw`, más abajo).
  const [drawPulses, setDrawPulses] = useState<Record<string, { amount: number; key: number }>>({});
  const [drawFlights, setDrawFlights] = useState<
    Array<{ key: number; fromX: number; fromY: number; toX: number; toY: number }>
  >([]);
  const prevCardCountsRef = useRef<Record<string, number> | null>(null);
  useEffect(() => {
    if (!publicState) return;
    const prevCounts = prevCardCountsRef.current;
    const nextCounts: Record<string, number> = {};
    const additions: Record<string, { amount: number; key: number }> = {};

    for (const p of publicState.players) {
      nextCounts[p.id] = p.cardCount;
      const before = prevCounts?.[p.id];
      if (prevCounts && before !== undefined && p.cardCount > before) {
        additions[p.id] = { amount: p.cardCount - before, key: Date.now() + Math.random() };
      }
    }
    prevCardCountsRef.current = nextCounts;

    if (Object.keys(additions).length === 0) return;
    // Diff contra el ref del render anterior, no se puede derivar en el render
    // mismo (necesita comparar con el estado previo y expirar solo con un timer).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDrawPulses((old) => ({ ...old, ...additions }));
    for (const [playerId, pulse] of Object.entries(additions)) {
      window.setTimeout(() => {
        setDrawPulses((old) => {
          if (old[playerId]?.key !== pulse.key) return old;
          const next = { ...old };
          delete next[playerId];
          return next;
        });
      }, 1400);
    }

    const pileEl = gameAreaRef.current?.querySelector<HTMLElement>("[data-draw-pile]");
    if (pileEl) {
      const pileRect = pileEl.getBoundingClientRect();
      const newFlights: typeof drawFlights = [];
      for (const playerId of Object.keys(additions)) {
        const badgeEl = gameAreaRef.current?.querySelector<HTMLElement>(`[data-player-id="${playerId}"]`);
        if (!badgeEl) continue;
        const badgeRect = badgeEl.getBoundingClientRect();
        newFlights.push({
          key: Date.now() + Math.random(),
          fromX: pileRect.left + pileRect.width / 2,
          fromY: pileRect.top + pileRect.height / 2,
          toX: badgeRect.left + badgeRect.width / 2,
          toY: badgeRect.top + badgeRect.height / 2,
        });
      }
      if (newFlights.length > 0) setDrawFlights((old) => [...old, ...newFlights]);
    }
  }, [publicState]);

  // Anima la carta "volando" desde la ficha de quien la jugó hasta el mazo de
  // descarte, pero solo cuando quien jugó fue OTRO jugador (la tuya propia ya
  // desaparece de tu mano al instante, no hace falta mostrártela viajando).
  // El autor se infiere: es quien tenía el turno en el estado anterior a este
  // (el turno recién avanza después de resolverse la jugada; si quedó
  // pendiente elegir color, sigue siendo el mismo jugador, así que también da
  // bien ahí).
  const prevPlayTrackingRef = useRef<{ turnPlayerId: string | null; topCardId: string | null }>({
    turnPlayerId: null,
    topCardId: null,
  });
  const [flight, setFlight] = useState<{
    key: number;
    card: Card;
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
  } | null>(null);

  useEffect(() => {
    if (!publicState) return;
    const prevTracking = prevPlayTrackingRef.current;
    const topCard = publicState.topDiscardCard;
    const newTopId = topCard?.id ?? null;
    const isFirstSnapshot = prevTracking.topCardId === null && prevTracking.turnPlayerId === null;
    const actorId = prevTracking.turnPlayerId;

    if (
      !isFirstSnapshot &&
      topCard &&
      newTopId !== prevTracking.topCardId &&
      actorId &&
      actorId !== selfPlayerId &&
      gameAreaRef.current
    ) {
      const fromEl = gameAreaRef.current.querySelector<HTMLElement>(`[data-player-id="${actorId}"]`);
      const toEl = gameAreaRef.current.querySelector<HTMLElement>("[data-discard-pile]");
      if (fromEl && toEl) {
        const fromRect = fromEl.getBoundingClientRect();
        const toRect = toEl.getBoundingClientRect();
        setFlight({
          key: Date.now(),
          card: { ...topCard, color: publicState.activeColor ?? topCard.color },
          fromX: fromRect.left + fromRect.width / 2,
          fromY: fromRect.top + fromRect.height / 2,
          toX: toRect.left + toRect.width / 2,
          toY: toRect.top + toRect.height / 2,
        });
      }
    }

    prevPlayTrackingRef.current = { turnPlayerId: publicState.currentTurnPlayerId, topCardId: newTopId };
  }, [publicState, selfPlayerId]);

  useEffect(() => {
    let cancelled = false;
    getGame(slug)
      .then((game) => {
        if (!cancelled) {
          setMaxPlayers(game?.game.rules.maxPlayers);
          setTargetScore(game?.game.rules.winCondition?.targetScore);
        }
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
          <BackButton to={`/juego/${slug}`} />
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
          <BackButton to={`/juego/${slug}`} />
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
          <BackButton to={`/juego/${slug}`} />
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
 <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-danger text-[10px] font-bold text-ink flex items-center justify-center">
                  {unreadChatCount > 9 ? "9+" : unreadChatCount}
                </span>
              )}
            </span>
            <IconButton icon="logout" onClick={handleLeave} />
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
            onRemoveBot={(botId) => void removeBot(botId)}
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
    const isPromptGame = publicState.gameMode === "PROMPT";
    return (
      <div className="relative max-w-[480px] mx-auto min-h-screen flex flex-col items-center justify-center gap-4 bg-app text-center px-6 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          {CONFETTI.map((c, i) => (
            <span
              key={i}
 className="absolute top-0 "
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
          icon={isPromptGame ? "pixelarticons:coffee" : "pixelarticons:trophy"}
          width={56}
          height={56}
          className="relative z-10 animate-bounce text-warning"
        />
        <div className="relative z-10 font-display text-xl font-black text-warning">
          {isPromptGame
            ? "Se acabaron las preguntas"
            : isWinner
              ? "¡Victoria!"
              : "Partida Terminada"}
        </div>
        <div className="relative z-10 text-[14px] text-ink">
          {isPromptGame ? (
            "Gracias por desconectar un rato y escucharse."
          ) : winner ? (
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
  const customState = (publicState.customState ?? {}) as Record<string, unknown>;
  const isSubmission = Boolean(publicState.submission);
  const { self, others } = assignSeats(publicState.players, selfPlayerId);
  // El server agrega al host primero (GameRoom.addPlayer), mismo criterio que RoomLobby.
  const hostPlayerId = publicState.players[0]?.id;
  const isMyTurn = publicState.currentTurnPlayerId === selfPlayerId;
  // En fases simultáneas (submissions) la fuente de verdad es awaitingPlayerIds;
  // en juegos por turnos se mantiene el comportamiento clásico.
  const isAwaitingAction =
    publicState.awaitingPlayerIds !== undefined
      ? Boolean(selfPlayerId && publicState.awaitingPlayerIds.includes(selfPlayerId))
      : isMyTurn;
  const pendingChoiceForMe = publicState.pendingChoice?.playerId === selfPlayerId;
  const pendingChoiceForOther = !!publicState.pendingChoice && !pendingChoiceForMe;
  const pendingBet = isTruco ? customState.pendingBet ?? null : null;
  const isPromptGame = gameMode === "PROMPT";
  // Mientras hay un color pendiente de elegir (comodín recién jugado), el
  // turno sigue siendo del mismo jugador pero no puede jugar/robar otra carta
  // hasta resolver el color (ver GameEngine.playCard en el server).
  const canAct = isAwaitingAction && !pendingChoiceForMe && !isActing;
  const canPlayHandCards = canAct && (!isTruco || !pendingBet);

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

  async function handlePromptAction(action: string, payload?: Record<string, unknown>) {
    if (isActing) return;
    setIsActing(true);
    try {
      await executeAction(action, payload);
      play("playCard");
    } finally {
      setIsActing(false);
    }
  }

  async function handlePlay(cardId: string, tapada?: boolean) {
    if (!canAct) return;
    if (isTruco && pendingBet) return;
    setIsActing(true);
    try {
      const playingTapada = tapada !== undefined ? tapada : isTapada;
      await playCard(cardId, undefined, playingTapada);
      play("playCard");
      triggerShake();
    } finally {
      setIsActing(false);
    }
  }

  function handleHandCardClick(cardId: string) {
    if (isCommunity) {
      if (!canAct) return;
      setSelectedHandCardId((prev) => (prev === cardId ? null : cardId));
    } else {
      void handlePlay(cardId);
    }
  }

  function handleToggleTableCard(cardId: string) {
    if (!canAct) return;
    setSelectedTableCardIds((prev) =>
      prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]
    );
  }

  const selectedHandCard = hand.find((c) => c.id === selectedHandCardId);
  const selectedTableCards = (publicState?.tableCards ?? []).filter((c) =>
    selectedTableCardIds.includes(c.id)
  );
  const handCardPoint = selectedHandCard ? getEscobaPointValue(selectedHandCard) : 0;
  const tableCardsSum = selectedTableCards.reduce(
    (sum, c) => sum + getEscobaPointValue(c),
    0
  );
  const currentEscobaSum = (selectedHandCard ? handCardPoint : 0) + tableCardsSum;
  const isTargetSum = currentEscobaSum === 15;
  const canCapture =
    canAct &&
    Boolean(selectedHandCard) &&
    selectedTableCards.length > 0 &&
    isTargetSum;
  const isSweepEscoba =
    canCapture &&
    selectedTableCards.length === (publicState?.tableCards?.length ?? 0);

  async function handleCapture() {
    if (!canCapture || !selectedHandCardId) return;
    setIsActing(true);
    try {
      const res = (await executeAction("CAPTURE_CARDS", {
        cardId: selectedHandCardId,
        tableCardIds: selectedTableCardIds,
      })) as { success?: boolean; result?: { escoba?: boolean } } | undefined;

      setSelectedHandCardId(null);
      setSelectedTableCardIds([]);
      play("playCard");
      triggerShake();
      if (res?.result?.escoba) {
        play("victory");
      }
    } finally {
      setIsActing(false);
    }
  }

  async function handleDrop() {
    if (!canAct || !selectedHandCardId) return;
    setIsActing(true);
    try {
      await executeAction("DROP_CARD", {
        cardId: selectedHandCardId,
      });
      setSelectedHandCardId(null);
      setSelectedTableCardIds([]);
      play("playCard");
      triggerShake();
    } finally {
      setIsActing(false);
    }
  }

  function handleClearSelection() {
    setSelectedHandCardId(null);
    setSelectedTableCardIds([]);
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
    <div className="relative max-w-[480px] md:max-w-3xl mx-auto h-dvh overflow-hidden flex flex-col bg-app">
      {flight && (
        <CardFlight
          key={flight.key}
          content={<CardView card={flight.card} size="md" />}
          fromX={flight.fromX}
          fromY={flight.fromY}
          toX={flight.toX}
          toY={flight.toY}
          onDone={() => setFlight(null)}
        />
      )}
      {drawFlights.map((f) => (
        <CardFlight
          key={f.key}
          content={<CardBack size="sm" />}
          fromX={f.fromX}
          fromY={f.fromY}
          toX={f.toX}
          toY={f.toY}
          growOnArrive
          onDone={() => setDrawFlights((old) => old.filter((x) => x.key !== f.key))}
        />
      ))}
      {forcedDraw && (
        <div
          key={forcedDraw.key}
          className="absolute top-14 md:top-16 inset-x-0 z-40 flex justify-center px-4 pointer-events-none"
        >
 <div className="animate-bubble-pop flex items-center gap-2 border-2 border-danger bg-danger/20 backdrop-blur px-4 py-2 text-[13px] font-bold text-ink shadow-[0_0_18px_rgba(255,77,109,0.4)]">
            <Icon icon="pixelarticons:arrow-down" width={16} height={16} className="text-danger" />
            {decodePlayerName(forcedDraw.byName).display} te hizo robar {forcedDraw.count}{" "}
            {forcedDraw.count === 1 ? "carta" : "cartas"}
          </div>
        </div>
      )}
      <div className="flex-none px-3.5 md:px-6 py-2.5 md:py-4 flex items-center justify-between">
        <BackButton to={`/juego/${slug}`} />
        <div className="text-center">
 <div className="inline-flex flex-col items-center border-2 border-subtle bg-statusbar/90 px-4 py-1.5 shadow-[3px_3px_0_0_rgba(0,0,0,0.35)]">
            <div className="flex items-center gap-1.5 font-display text-xs md:text-sm font-black uppercase tracking-wider text-ink">
              <Icon icon="pixelarticons:gamepad" width={14} height={14} className="text-accent" />
              {slug}
            </div>
            <div className="font-mono text-[10px] md:text-[11px] font-bold tracking-[0.25em] text-accent">
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
 <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-danger text-[10px] font-bold text-ink flex items-center justify-center">
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
          <IconButton icon="logout" size={18} onClick={handleLeave} />
        </div>
      </div>

      {isSubmission ? (
        <div
          className={`flex-1 relative px-3 py-2 overflow-y-auto ${
            isShaking ? "animate-table-shake" : ""
          }`}
        >
          <SubmissionTable
            key={`${publicState.submission?.promptCard?.id ?? "prompt"}-${publicState.submission?.phase ?? "none"}`}
            publicState={publicState}
            selfPlayerId={selfPlayerId}
            hand={hand}
            onExecuteAction={handleTrucoAction}
            isActing={isActing}
            targetScore={targetScore}
          />
        </div>
      ) : isPromptGame ? (
        <DesconectadosTable
          publicState={publicState}
          selfPlayerId={selfPlayerId}
          isActing={isActing}
          onExecuteAction={handlePromptAction}
        />
      ) : isTruco ? (
        <div
          className={`flex-1 relative px-3 py-2 ${
            isShaking ? "animate-table-shake" : ""
          }`}
        >
          {others[0] && (
            <div className="relative w-full h-12 md:h-11 flex justify-center mb-1">
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
            onExecuteAction={handleTrucoAction}
            onPlayCard={(cardId, tapada) => handlePlay(cardId, tapada)}
            isActing={isActing}
            isTapada={isTapada}
            onToggleTapada={() => setIsTapada((prev) => !prev)}
          />
        </div>
      ) : (
        <div
          ref={gameAreaRef}
          className={`flex-1 min-h-0 relative px-4.5 py-1.5 overflow-hidden ${
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
              drawPulse={drawPulses[player.id] ?? null}
              score={publicState.scores?.[player.id]}
              escobas={
                (publicState.customState?.escobas as Record<string, number> | undefined)?.[player.id]
              }
              capturedCount={
                (publicState.customState?.capturedCounts as Record<string, number> | undefined)?.[
                  player.id
                ]
              }
            />
          ))}
          {others.length > 3 && (
            <div className="absolute top-1 right-1 left-1 flex flex-wrap justify-end gap-1">
              {others.slice(3).map((player) => (
                <PlayerBadge
                  key={player.id}
                  player={player}
                  position="top"
                  compact
                  isHost={player.id === hostPlayerId}
                  isCurrentTurn={publicState.currentTurnPlayerId === player.id}
                  turnExpiresAt={
                    publicState.currentTurnPlayerId === player.id ? publicState.turnExpiresAt : null
                  }
                  drawPulse={drawPulses[player.id] ?? null}
                  score={publicState.scores?.[player.id]}
                  escobas={
                    (publicState.customState?.escobas as Record<string, number> | undefined)?.[player.id]
                  }
                />
              ))}
            </div>
          )}

 <div className="felt-texture absolute top-[90px] md:top-[120px] left-1/2 -translate-x-1/2 w-[300px] h-[220px] md:w-[440px] md:h-[320px] border-[6px] border-[#0b0812] shadow-[6px_6px_0_0_rgba(0,0,0,0.5)]">
            <span className="pixel-rivet" style={{ top: 6, left: 6 }} />
            <span className="pixel-rivet" style={{ top: 6, right: 6 }} />
            <span className="pixel-rivet" style={{ bottom: 6, left: 6 }} />
            <span className="pixel-rivet" style={{ bottom: 6, right: 6 }} />
            {isCommunity ? (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
                <CommunityTable
                  tableCards={publicState.tableCards ?? []}
                  selectedTableCardIds={selectedTableCardIds}
                  onToggleTableCard={handleToggleTableCard}
                  drawPileCount={publicState.drawPileCount}
                  canAct={canAct}
                />
              </div>
            ) : (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center gap-5 md:gap-8 pointer-events-auto">
                <DrawPile
                  count={publicState.drawPileCount}
                  disabled={!canAct}
                  onClick={handleDraw}
                  pendingDrawCount={publicState.pendingDrawCount}
                />
                <DiscardPile
                  topCard={publicState.topDiscardCard}
                  count={publicState.discardPileCount}
                  activeColor={publicState.activeColor}
                  pendingDrawCount={publicState.pendingDrawCount}
                />
              </div>
            )}
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
              drawPulse={drawPulses[self.id] ?? null}
              score={publicState.scores?.[self.id]}
              escobas={
                (publicState.customState?.escobas as Record<string, number> | undefined)?.[self.id]
              }
              capturedCount={
                (publicState.customState?.capturedCounts as Record<string, number> | undefined)?.[
                  self.id
                ]
              }
            />
          )}
        </div>
      )}

      {isCommunity && isMyTurn && gameStatus === "IN_PROGRESS" && (
        <div className="flex-none px-3.5 md:px-6 pb-2">
 <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 border border-accent/40 bg-statusbar/95 p-2.5 md:p-3 shadow-[0_0_18px_rgba(32,168,216,0.18)] backdrop-blur">
            <div className="flex items-center gap-2 text-xs md:text-sm">
              {!selectedHandCard && selectedTableCards.length === 0 && (
                <span className="text-ink-faint">
                  Tocá una carta de tu mano para jugar o tirar
                </span>
              )}
              {selectedHandCard && selectedTableCards.length === 0 && (
                <span className="text-ink">
                  Carta elegida:{" "}
                  <strong className="text-accent font-black">
                    {selectedHandCard.color} {selectedHandCard.value} ({handCardPoint} pts)
                  </strong>{" "}
                  <span className="text-[11px] text-ink-faint hidden sm:inline">
                    (o tocá cartas de la mesa para sumar 15)
                  </span>
                </span>
              )}
              {selectedTableCards.length > 0 && (
                <span className="inline-flex items-center gap-2">
                  <span>
                    Suma:{" "}
                    <strong
                      className={
                        isTargetSum
                          ? "text-success font-black text-sm md:text-base"
                          : "text-warning font-black"
                      }
                    >
                      {currentEscobaSum}
                    </strong>{" "}
                    / 15
                  </span>
                  {isTargetSum ? (
 <span className=" bg-success/20 border border-success/60 px-2 py-0.5 text-[10px] font-black text-success animate-pulse">
                      {isSweepEscoba ? "🧹 ¡ESCOBA!" : "✓ ¡Suma 15!"}
                    </span>
                  ) : (
                    <span className="text-[10px] text-ink-faint">
                      {currentEscobaSum < 15
                        ? `(Faltan ${15 - currentEscobaSum})`
                        : `(Se pasa por ${currentEscobaSum - 15})`}
                    </span>
                  )}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {(selectedHandCard || selectedTableCards.length > 0) && (
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="px-2 py-1 text-xs text-ink-faint hover:text-ink cursor-pointer underline"
                >
                  Limpiar
                </button>
              )}

              {selectedHandCard && !canCapture && (
                <Button
                  variant="outline"
                  className="!h-8 !px-3 !text-xs"
                  onClick={handleDrop}
                  disabled={isActing}
                  title="Dejar esta carta en la mesa si no podés o no querés levantar"
                >
                  <Icon icon="pixelarticons:down-as-search" width={14} height={14} />
                  Tirar a la mesa
                </Button>
              )}

              {canCapture && (
                <Button
                  variant="primary"
                  onClick={handleCapture}
                  disabled={isActing}
                  className={`!h-8 !px-3 !text-xs ${
                    isSweepEscoba
                      ? "animate-bounce shadow-[0_0_16px_rgba(245,197,24,0.6)] !border-warning font-black"
                      : ""
                  }`}
                >
                  <Icon
                    icon="pixelarticons:trophy"
                    width={14}
                    height={14}
                    className={isSweepEscoba ? "text-warning" : ""}
                  />
                  {isSweepEscoba ? "¡Hacer Escoba! (+1 pt)" : "Capturar Baza"}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {!isTruco && !isPromptGame && !isSubmission && (
        <div className="flex-none px-3.5 md:px-6 py-1.5 md:py-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-medium text-[11px] md:text-sm text-ink">
 <span className={`w-2 h-2 ${isMyTurn ? "bg-accent" : "bg-ink-faint"}`} />
            {pendingChoiceForMe
              ? "Elegí un color"
              : pendingChoiceForOther
                ? "Esperando color..."
                : isMyTurn
                  ? "Tu turno"
                  : "Esperando turno"}
          </div>
          {canAct && !isCommunity && (
            <div className="flex gap-2">
              <Button variant="ghost" onClick={handlePass}>
                Pasar turno
              </Button>
            </div>
          )}
        </div>
      )}

      {lastError && <div className="text-[12px] text-danger text-center px-4 pb-2">{lastError}</div>}

      {!isTruco && !isCommunity && !isPromptGame && !isSubmission && self?.cardCount === 1 && !hasShouted && (
        <div className="flex-none flex justify-center pb-1">
          <button
            type="button"
            onClick={handleShout}
 className="animate-bounce rounded-none bg-warning border-[3px] border-[#241a44] px-5 py-1.5 font-display text-[13px] md:text-sm font-black text-[#171a35] shadow-[0_5px_0_0_#b0521f] active:translate-y-[3px] active:shadow-[0_1px_0_0_#b0521f] cursor-pointer"
          >
             <Icon icon="pixelarticons:megaphone" width={18} height={18} />
             ¡AL MAZO!
          </button>
        </div>
      )}

      {shoutToast && (
        <div className="flex-none flex justify-center pb-1">
 <span className=" border-2 border-[#241a44] bg-success px-4 py-1 text-[12px] font-bold text-[#f4f1ff] shadow-[0_0_14px_rgba(51,196,141,0.6)]">
            ¡Cantaste AL MAZO!
          </span>
        </div>
      )}

      <div className="flex-none flex justify-center px-2 pb-1">
        <div
 className="flex max-w-full flex-wrap items-center justify-center gap-1 md:gap-1.5 py-1 px-2 md:px-3 bg-statusbar/80 border-2 border-subtle mx-auto"
          role="group"
          aria-label="Bandeja de reacciones"
        >
          {QUICK_REACTIONS.map((reaction) => (
            <button
              key={reaction.text}
              type="button"
              onClick={() => handleReaction(reaction.text)}
 className="inline-flex cursor-pointer items-center gap-1 border-2 border-subtle bg-app/60 px-2 py-0.5 text-[10px] md:text-[11px] font-bold text-ink-soft transition-colors duration-150 hover:border-accent hover:text-accent"
            >
              <Icon icon={reaction.icon} width={13} height={13} aria-hidden />
              {reaction.text}
            </button>
          ))}
        </div>
      </div>

      {/* Truco renderiza su propia mano dentro de <TrucoTable />: no duplicar. */}
      {!isTruco && !isPromptGame && !isSubmission && (
        <Hand
          cards={hand}
          canPlay={isCommunity ? canAct : canPlayHandCards}
          selectedCardId={isCommunity ? selectedHandCardId : null}
          onPlay={isCommunity ? handleHandCardClick : (cardId) => handlePlay(cardId)}
          isCardPlayable={
            isCommunity ? undefined : (card) => canPlayDiscardCard(card, publicState.topDiscardCard, publicState.activeColor)
          }
          dragToPlay={!isCommunity}
        />
      )}

      <ChatDrawer isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </div>
  );
}
