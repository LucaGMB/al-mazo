import type { Card } from "@/types/engine";
import CardView from "./CardView";
import { CARD_COLORS } from "@/lib/game/card-colors";

export default function DiscardPile({
  topCard,
  count,
  activeColor,
}: {
  topCard: Card | null;
  count: number;
  activeColor: string | null;
}) {
  const activeHex = activeColor ? CARD_COLORS[activeColor] : null;

  return (
    <div className="relative flex flex-col items-center gap-1 font-mono text-[9px] md:text-[11px] text-ink-faint">
      <div data-discard-pile className="relative">
        {/* Capas apiladas: ilusión de pila orgánica de descartes, sin blur. */}
 <div className="absolute inset-0 translate-x-2 translate-y-2 rotate-6 bg-black/30" />
 <div className="absolute inset-0 translate-x-1.5 translate-y-1.5 rotate-3 bg-black/40" />
 <div className="absolute inset-0 translate-x-0.5 translate-y-0.5 -rotate-2 bg-black/50" />
        {activeHex && (
          // Color activo (comodín elegido): anillo sólido, sin glow difuso.
 <div className="absolute -inset-1.5 border-[3px]" style={{ borderColor: activeHex }} />
        )}
        <div key={topCard?.id ?? "empty"} className="relative -rotate-2 animate-pop-in">
          {topCard ? (
            <CardView card={{ ...topCard, color: activeColor ?? topCard.color }} size="md" />
          ) : (
 <div className="w-10 h-14 md:w-12 md:h-16 border-[3px] border-[#0b0812] bg-surface" />
          )}
        </div>
      </div>
      <span className="tracking-wide">descarte · {count}</span>
    </div>
  );
}
