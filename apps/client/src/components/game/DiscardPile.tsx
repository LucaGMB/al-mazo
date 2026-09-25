import type { Card } from "@/types/engine";
import CardView from "./CardView";
import { CARD_COLORS } from "@/lib/game/card-colors";

export default function DiscardPile({
  topCard,
  count,
  activeColor,
  pendingDrawCount,
}: {
  topCard: Card | null;
  count: number;
  activeColor: string | null;
  pendingDrawCount?: number;
}) {
  const activeHex = activeColor ? CARD_COLORS[activeColor] : null;

  return (
    <div className="relative flex flex-col items-center gap-1 font-mono text-[9px] md:text-[11px] text-ink-faint">
      {pendingDrawCount && pendingDrawCount > 0 ? (
        <div className="absolute -top-7 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-danger text-white font-black text-[10px] md:text-xs tracking-wider shadow-[0_0_14px_rgba(239,68,68,0.9)] border border-white/40 animate-bounce">
          <span>🔥</span>
          <span>+{pendingDrawCount}</span>
        </div>
      ) : null}
      <div data-discard-pile className="relative">
        {/* Capas apiladas: ilusión de pila orgánica de descartes, sin blur. */}
        <div className="absolute inset-0 translate-x-2 translate-y-2 rotate-6 rounded-lg bg-black/30" />
        <div className="absolute inset-0 translate-x-1.5 translate-y-1.5 rotate-3 rounded-lg bg-black/40" />
        <div className="absolute inset-0 translate-x-0.5 translate-y-0.5 -rotate-2 rounded-lg bg-black/50" />
        {activeHex && (
          // Color activo (comodín elegido): anillo sólido, sin glow difuso.
          <div className="absolute -inset-1.5 rounded-lg border-[3px]" style={{ borderColor: activeHex }} />
        )}
        <div key={topCard?.id ?? "empty"} className="relative -rotate-2 animate-pop-in">
          {topCard ? (
            <CardView card={{ ...topCard, color: activeColor ?? topCard.color }} size="md" />
          ) : (
            <div className="w-10 h-14 md:w-12 md:h-16 rounded-[10%] border-[3px] border-[#0b0812] bg-surface" />
          )}
        </div>
      </div>
      <span className="tracking-wide">descarte · {count}</span>
    </div>
  );
}
