"use client";

import type { Card } from "@/types/engine";
import CardView from "./CardView";
import DrawPile from "./DrawPile";

export const ESCOBA_CARD_POINTS: Record<string, number> = {
  "1": 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "10": 8,
  "11": 9,
  "12": 10,
};

export function getEscobaPointValue(card: { value?: string | number }): number {
  return ESCOBA_CARD_POINTS[String(card.value)] ?? (Number.isNaN(Number(card.value)) ? 0 : Number(card.value));
}

export default function CommunityTable({
  tableCards,
  selectedTableCardIds,
  onToggleTableCard,
  drawPileCount,
  canAct,
}: {
  tableCards: Card[];
  selectedTableCardIds: string[];
  onToggleTableCard?: (cardId: string) => void;
  drawPileCount: number;
  canAct?: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 md:gap-3 w-full h-full p-2 select-none">
      {/* Top indicator: draw pile info & clean table badge */}
      <div className="flex items-center gap-2.5">
        <DrawPile count={drawPileCount} disabled={true} />
        {tableCards.length === 0 && (
 <div className="animate-pulse border border-warning/60 bg-black/60 px-3.5 py-1 text-xs font-black text-warning shadow-[0_0_12px_rgba(245,197,24,0.35)] backdrop-blur">
            🧹 ¡Mesa limpia! (sin cartas)
          </div>
        )}
      </div>

      {/* Community cards container */}
      <div className="flex flex-wrap items-center justify-center gap-2 max-w-[270px] md:max-w-[370px] max-h-[160px] md:max-h-[220px] overflow-y-auto p-1">
        {tableCards.map((card) => {
          const isSelected = selectedTableCardIds.includes(card.id);
          const val = getEscobaPointValue(card);

          return (
            <div
              key={card.id}
              className={`relative flex flex-col items-center transition-transform duration-150 ${
                isSelected ? "-translate-y-1 scale-105" : ""
              }`}
            >
              <CardView
                card={card}
                size="md"
                selected={isSelected}
                onClick={canAct && onToggleTableCard ? () => onToggleTableCard(card.id) : undefined}
              />
              <span
 className={`mt-0.5 px-1.5 py-px text-[9px] font-black border transition-colors ${
                  isSelected
                    ? "bg-accent text-white border-accent shadow-[0_0_8px_rgba(32,168,216,0.7)]"
                    : "bg-black/70 text-white/90 border-white/20"
                }`}
              >
                {val} pts
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
