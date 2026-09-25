"use client";

import { useRef, useState } from "react";
import type { Card } from "@/types/engine";
import CardView from "./CardView";

// Arrastrá la carta hacia arriba, más allá de esta distancia, para jugarla al
// soltar. Un movimiento menor a TAP_MAX_DISTANCE_PX se toma como un tap normal.
const PLAY_THRESHOLD_PX = 56;
const TAP_MAX_DISTANCE_PX = 6;

interface DragState {
  id: string;
  pointerId: number;
  startX: number;
  startY: number;
}

export default function Hand({
  cards,
  canPlay,
  onPlay,
}: {
  cards: Card[];
  canPlay: boolean;
  onPlay: (cardId: string) => void;
}) {
  const dragRef = useRef<DragState | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [armedId, setArmedId] = useState<string | null>(null);

  function resetDragVisuals(el: HTMLDivElement) {
    el.style.removeProperty("--drag-x");
    el.style.removeProperty("--drag-y");
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>, cardId: string) {
    if (!canPlay) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { id: cardId, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY };
    setDraggingId(cardId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>, cardId: string) {
    const drag = dragRef.current;
    if (!drag || drag.id !== cardId || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    e.currentTarget.style.setProperty("--drag-x", `${dx}px`);
    e.currentTarget.style.setProperty("--drag-y", `${dy}px`);
    const nowArmed = dy < -PLAY_THRESHOLD_PX;
    setArmedId((current) => {
      if (nowArmed) return current === cardId ? current : cardId;
      return current === cardId ? null : current;
    });
  }

  function handlePointerEnd(e: React.PointerEvent<HTMLDivElement>, cardId: string, playIfDropped: boolean) {
    const drag = dragRef.current;
    if (!drag || drag.id !== cardId || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const distance = Math.hypot(dx, dy);
    dragRef.current = null;
    setDraggingId(null);
    setArmedId(null);
    resetDragVisuals(e.currentTarget);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // el navegador ya pudo haber liberado la captura (p. ej. pointercancel)
    }
    if (playIfDropped && (dy < -PLAY_THRESHOLD_PX || distance < TAP_MAX_DISTANCE_PX)) {
      onPlay(cardId);
    }
  }

  return (
    <div
      className={`flex-none min-h-32 md:min-h-44 flex flex-wrap content-end items-end justify-center gap-y-3 md:gap-y-4 px-3 pb-2.5 md:pb-4 transition-colors duration-300 ${
        canPlay ? "ring-1 ring-accent/30 bg-accent/5" : ""
      }`}
    >
      {/* Con manos muy grandes las cartas no entran en una sola fila: en vez
          de desbordarse fuera de pantalla, `flex-wrap` las pasa a una segunda
          fila (cada fila se centra sola, así que se ve simétrico). */}
      {cards.map((card, i) => {
        const isDragging = draggingId === card.id;
        const isArmed = armedId === card.id;
        return (
          <div
            key={card.id}
            style={{
              // Fila recta, sin rotación de abanico: las cartas solo se
              // solapan horizontalmente (margen negativo en la clase de abajo).
              // El escalado al arrastrar va acá adentro: un estilo inline de
              // `transform` gana siempre sobre clases de Tailwind como
              // `scale-110`, así que agregarlo aparte no tendría efecto.
              transform: `translate(var(--drag-x, 0px), var(--drag-y, 0px))${
                isDragging ? " scale(1.08)" : ""
              }`,
              zIndex: isDragging ? 50 : i,
              transition: isDragging ? "none" : undefined,
              touchAction: canPlay ? "none" : undefined,
            }}
            className={`group -mx-2.5 md:-mx-3.5 transition-transform duration-150 ${
              canPlay ? "cursor-grab active:cursor-grabbing" : ""
            }`}
            onPointerDown={(e) => handlePointerDown(e, card.id)}
            onPointerMove={(e) => handlePointerMove(e, card.id)}
            onPointerUp={(e) => handlePointerEnd(e, card.id, true)}
            onPointerCancel={(e) => handlePointerEnd(e, card.id, false)}
          >
            <div
              className={`animate-deal-in opacity-0 rounded-[14%] transition-shadow duration-150 ${
                canPlay
                  ? isArmed
                    ? "ring-4 ring-warning shadow-[0_0_28px_rgba(255,143,77,0.85)]"
                    : "ring-2 ring-accent/50 shadow-[0_0_12px_rgba(255,210,63,0.35)] group-hover:ring-accent group-hover:shadow-[0_0_20px_rgba(255,210,63,0.65)]"
                  : ""
              }`}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <CardView card={card} size="lg" onClick={canPlay ? () => {} : undefined} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
