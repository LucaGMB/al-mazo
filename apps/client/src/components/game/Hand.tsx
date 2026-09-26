"use client";

import { useRef, useState } from "react";
import type { Card } from "@/types/engine";
import CardView from "./CardView";

// Distancia que hay que arrastrar una carta hacia arriba para soltarla y que
// se juegue (en vez de volver a la mano).
const DRAG_PLAY_THRESHOLD = 64;

export default function Hand({
  cards,
  canPlay,
  selectedCardId,
  onPlay,
  isCardPlayable,
  dragToPlay,
  isTapada,
}: {
  cards: Card[];
  canPlay: boolean;
  selectedCardId?: string | null;
  onPlay: (cardId: string) => void;
  isCardPlayable?: (card: Card) => boolean;
  dragToPlay?: boolean;
  isTapada?: boolean;
}) {
  return (
    <div
      className={`relative flex-none min-h-32 md:min-h-44 flex flex-wrap content-end items-end justify-center gap-y-3 md:gap-y-4 px-3 pb-2.5 md:pb-4 transition-colors duration-300 ${
        canPlay ? "ring-1 ring-accent/30 bg-accent/5" : ""
      }`}
    >
      {isTapada && (
        <div className="absolute top-1 text-[11px] font-black text-warning bg-black/85 px-3 py-0.5 border border-warning/60 shadow-[0_0_10px_rgba(245,197,24,0.4)] animate-pulse z-30 pointer-events-none">
          MODO TAPADA: Elegí la carta a tirar boca abajo
        </div>
      )}
      {cards.map((card, i) => {
        const isSelected = card.id === selectedCardId;
        const matches = isCardPlayable ? isCardPlayable(card) : true;
        return (
          <HandCard
            key={card.id}
            card={card}
            index={i}
            isSelected={isSelected}
            interactive={canPlay}
            matches={matches}
            dragToPlay={dragToPlay}
            onPlay={() => onPlay(card.id)}
          />
        );
      })}
    </div>
  );
}

function HandCard({
  card,
  index,
  isSelected,
  interactive,
  matches,
  dragToPlay,
  onPlay,
}: {
  card: Card;
  index: number;
  isSelected: boolean;
  interactive: boolean;
  matches: boolean;
  dragToPlay?: boolean;
  onPlay: () => void;
}) {
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [invalid, setInvalid] = useState(false);
  const draggedRef = useRef(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  function shakeInvalid() {
    setInvalid(true);
    window.setTimeout(() => setInvalid(false), 350);
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!interactive) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    startRef.current = { x: e.clientX, y: e.clientY };
    draggedRef.current = false;
    setDrag({ x: 0, y: 0 });
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!startRef.current) return;
    const x = e.clientX - startRef.current.x;
    const y = e.clientY - startRef.current.y;
    if (Math.abs(x) > 4 || Math.abs(y) > 4) draggedRef.current = true;
    setDrag({ x, y });
  }

  function handlePointerUp() {
    const wasDragged = draggedRef.current;
    const lastDrag = drag;
    startRef.current = null;
    draggedRef.current = false;
    setDrag(null);

    if (!interactive) return;

    if (!matches) {
      shakeInvalid();
      return;
    }

    if (!wasDragged) {
      onPlay();
      return;
    }

    if (dragToPlay && lastDrag && lastDrag.y < -DRAG_PLAY_THRESHOLD) {
      onPlay();
    }
  }

  function handlePointerCancel() {
    startRef.current = null;
    draggedRef.current = false;
    setDrag(null);
  }

  const dragTransform = drag
    ? `translate(${drag.x}px, ${drag.y}px) scale(1.1) rotate(${drag.x / 14}deg)`
    : "";
  const dimmed = interactive && !matches;

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      style={{
        transform: drag ? dragTransform : undefined,
        zIndex: drag ? 50 : isSelected ? 35 : index,
        touchAction: interactive ? "none" : undefined,
        transition: drag ? "none" : "transform 150ms",
      }}
      className={`group -mx-1.5 md:-mx-2 ${drag ? "" : "transition-all duration-150"} ${
        interactive ? (matches ? "hover:-translate-y-4 hover:scale-105 hover:!z-30 cursor-grab active:cursor-grabbing" : "cursor-not-allowed") : ""
      } ${isSelected ? "-translate-y-4 scale-105 !z-30" : ""} ${invalid ? "animate-table-shake" : ""}`}
    >
      <div
        className={`animate-deal-in opacity-0 ${dimmed ? "[filter:grayscale(0.6)_opacity(0.5)]" : ""} ${
          interactive && matches
            ? "ring-2 ring-warning/50 shadow-[0_0_12px_rgba(245,197,24,0.35)] group-hover:ring-warning group-hover:shadow-[0_0_20px_rgba(245,197,24,0.65)]"
            : ""
        }`}
        style={{ animationDelay: `${index * 60}ms` }}
      >
        <CardView card={card} size="lg" selected={isSelected} />
      </div>
    </div>
  );
}
