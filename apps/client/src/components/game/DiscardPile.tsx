import type { Card } from "@/types/engine";
import CardView from "./CardView";
import { CARD_COLORS } from "@/lib/game/card-colors";

// Contorno "duro" (sin blur) alrededor de la silueta real de la carta: un
// borde común quedaba flotando lejos del arte porque la carta rota
// (-rotate-2) y el sprite tiene relleno transparente en el PNG. Apilar
// drop-shadows en 8 direcciones con blur 0 sí seguí la forma real, rotación
// incluida (el filter se aplica sobre el contenido ya rotado del wrapper).
function outlineFilter(hex: string, size = 3): string {
  const offsets = [
    [size, 0],
    [-size, 0],
    [0, size],
    [0, -size],
    [size, size],
    [size, -size],
    [-size, size],
    [-size, -size],
  ];
  return offsets.map(([x, y]) => `drop-shadow(${x}px ${y}px 0 ${hex})`).join(" ");
}

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
 <div className="absolute inset-0 translate-x-2 translate-y-2 rotate-6 bg-black/30" />
 <div className="absolute inset-0 translate-x-1.5 translate-y-1.5 rotate-3 bg-black/40" />
 <div className="absolute inset-0 translate-x-0.5 translate-y-0.5 -rotate-2 bg-black/50" />
        <div
          key={topCard?.id ?? "empty"}
          className="relative -rotate-2 animate-pop-in"
          style={activeHex ? { filter: outlineFilter(activeHex) } : undefined}
        >
          {topCard ? (
            <CardView card={{ ...topCard, color: activeColor ?? topCard.color }} size="lg" />
          ) : (
 <div className="w-[58px] h-[82px] md:w-20 md:h-[114px] border-[3px] border-[#0b0812] bg-surface" />
          )}
        </div>
      </div>
      <span className="tracking-wide">descarte · {count}</span>
    </div>
  );
}
