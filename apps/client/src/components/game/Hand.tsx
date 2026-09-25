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

// Abanico: cada carta rota un poco más cuanto más lejos está del centro de la
// mano, con un leve descenso hacia los bordes (look de mano de naipes real).
// El spread total se achica en manos grandes para no desparramar demasiado.
function fanTransform(i: number, total: number): string {
  if (total <= 1) return "";
  const mid = (total - 1) / 2;
  const offset = i - mid;
  const step = Math.min(6, 40 / (total - 1));
  const rotate = offset * step;
  const lift = Math.abs(offset) * 2;
  return `rotate(${rotate}deg) translateY(${lift}px)`;
}

export default function Hand({
  cards,
  canPlay,
  selectedCardId,
  onPlay,
  isTapada,
}: {
  cards: Card[];
  canPlay: boolean;
  selectedCardId?: string | null;
  onPlay: (cardId: string) => void;
  isTapada?: boolean;
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
      className={`relative flex-none min-h-32 md:min-h-44 flex flex-wrap content-end items-end justify-center gap-y-3 md:gap-y-4 px-3 pb-2.5 md:pb-4 transition-colors duration-300 ${
        canPlay ? "ring-1 ring-accent/30 bg-accent/5" : ""
      }`}
    >
      {isTapada && (
        <div className="absolute top-1 text-[11px] font-black text-warning bg-black/85 px-3 py-0.5 rounded-full border border-warning/60 shadow-[0_0_10px_rgba(245,197,24,0.4)] animate-pulse z-30 pointer-events-none">
          MODO TAPADA: Elegí la carta a tirar boca abajo
        </div>
      )}
      {cards.map((card, i) => {
        const isSelected = card.id === selectedCardId;
        return (
          <div
            key={card.id}
            style={{ transform: fanTransform(i, cards.length), zIndex: isSelected ? 35 : i }}
            className={`group -mx-2.5 md:-mx-3.5 transition-all duration-150 ${
              canPlay ? "hover:-translate-y-4 hover:scale-105 hover:!z-30" : ""
            } ${isSelected ? "-translate-y-4 scale-105 !z-30" : ""}`}
          >
            <div
              className={`animate-deal-in opacity-0 ${
                canPlay
                  ? "rounded-xl ring-2 ring-warning/50 shadow-[0_0_12px_rgba(245,197,24,0.35)] group-hover:ring-warning group-hover:shadow-[0_0_20px_rgba(245,197,24,0.65)]"
                  : ""
              }`}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <CardView
                card={card}
                size="lg"
                selected={isSelected}
                onClick={canPlay ? () => onPlay(card.id) : undefined}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
