import { Icon } from "@iconify/react";
import CardBack from "./CardBack";

export default function DrawPile({
  count,
  onClick,
  disabled,
  pendingDrawCount,
}: {
  count: number;
  onClick?: () => void;
  disabled?: boolean;
  pendingDrawCount?: number;
}) {
  const interactive = !disabled;
  const isForcedDraw = interactive && !!pendingDrawCount && pendingDrawCount > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative flex flex-col items-center gap-3 font-mono text-[9px] md:text-[11px] text-ink-faint ${
        interactive ? "cursor-pointer" : "cursor-not-allowed"
      }`}
    >
      <div
        data-draw-pile
        className={`relative transition-transform duration-150 ${
          interactive ? "hover:-translate-y-1.5 hover:scale-105 active:scale-95" : "opacity-70"
        }`}
      >
        {/* Grosor 3D: varias cartas superpuestas bajo la de arriba. */}
        <div className="absolute inset-0 translate-x-1.5 translate-y-3 rounded-[14%] bg-wood-dark border-2 border-[#241a44]" />
        <div className="absolute inset-0 translate-x-1 translate-y-2 rounded-[14%] bg-wood-dark border-2 border-[#241a44]" />
        <div className="absolute inset-0 translate-x-0.5 translate-y-1 rounded-[14%] bg-surface border-2 border-[#241a44]" />
        <CardBack size="md" interactive={interactive} glow={interactive} />
        {interactive && (
          <span
            className={`absolute -top-6 left-1/2 -translate-x-1/2 inline-flex items-center gap-0.5 whitespace-nowrap border-2 px-2 py-0.5 font-display text-[9px] uppercase tracking-wider ${
              isForcedDraw
                ? "animate-pulse border-white/60 bg-danger text-white shadow-[0_0_12px_rgba(239,68,68,0.8)]"
                : "animate-float border-[#241a44] bg-accent text-[#171a35] shadow-[0_0_10px_rgba(255,210,63,0.6)]"
            }`}
          >
            <Icon icon="pixelarticons:arrow-down" width={11} height={11} />
            {isForcedDraw ? `Robar +${pendingDrawCount}` : "Robar"}
          </span>
        )}
      </div>
      <span className="tracking-wide">mazo · {count}</span>
    </button>
  );
}
