"use client";

import type { Card } from "@/types/engine";
import CardView from "./CardView";

// Reemplaza las 5 cartas fijas con `handTransforms` hardcodeado de la demo
// por un abanico generado dinámicamente según la cantidad real de cartas.
function fanTransform(index: number, total: number): string {
  const mid = (total - 1) / 2;
  const offset = index - mid;
  const rotate = offset * 8;
  const lift = Math.abs(offset) * 6;
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
  return (
    <div
      className={`relative flex-none h-32 md:h-44 flex items-end justify-center pb-2.5 md:pb-4 rounded-xl transition-colors duration-300 ${
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
