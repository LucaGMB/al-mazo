import type { Card } from "@/types/engine";
import CardView from "./CardView";

// Mismos hex que CardView (paleta del juego color-match).
const ACTIVE_COLOR_HEX: Record<string, string> = {
  RED: "#F86C6B",
  BLUE: "#20A8D8",
  GREEN: "#4DBD74",
  YELLOW: "#F5C518",
};

export default function DiscardPile({
  topCard,
  count,
  activeColor,
}: {
  topCard: Card | null;
  count: number;
  activeColor: string | null;
}) {
  const halo = activeColor ? ACTIVE_COLOR_HEX[activeColor] : null;

  return (
    <div className="relative flex flex-col items-center gap-1 text-[9px] md:text-[11px] text-[#9B9B9B]">
      <div className="relative">
        {/* Capas apiladas: ilusión de pila orgánica de descartes. */}
        <div className="absolute inset-0 translate-x-2 translate-y-2 rotate-6 rounded-lg bg-black/30 blur-[1px]" />
        <div className="absolute inset-0 translate-x-1.5 translate-y-1.5 rotate-3 rounded-lg bg-black/40" />
        <div className="absolute inset-0 translate-x-0.5 translate-y-0.5 -rotate-2 rounded-lg bg-black/50" />
        {halo && (
          <>
            {/* Halo cromático del color activo, con pulso. */}
            <div
              className="absolute -inset-2 animate-pulse rounded-xl"
              style={{ boxShadow: `0 0 20px 4px ${halo}`, opacity: 0.7 }}
            />
            <div
              className="absolute -inset-1 rounded-lg"
              style={{ boxShadow: `0 0 8px 1px ${halo}` }}
            />
          </>
        )}
        <div key={topCard?.id ?? "empty"} className="relative -rotate-2 animate-pop-in">
          {topCard ? (
            // Si la carta de arriba es un comodín, se pinta con el color activo
            // elegido (activeColor), no con su color original 'ANY'.
            <CardView card={{ ...topCard, color: activeColor ?? topCard.color }} size="md" />
          ) : (
            <div className="w-10 h-14 md:w-12 md:h-16 rounded-lg bg-[#F0F3F5] border border-[#C8CED3]" />
          )}
        </div>
      </div>
      <span>descarte · {count}</span>
    </div>
  );
}
