import { Icon } from "@iconify/react";

export default function DrawPile({
  count,
  onClick,
  disabled,
}: {
  count: number;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const interactive = !disabled;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative flex flex-col items-center gap-1 text-[9px] md:text-[11px] text-[#9B9B9B] ${
        interactive ? "cursor-pointer" : "cursor-not-allowed"
      }`}
    >
      <div
        className={`relative transition-transform duration-150 ${
          interactive ? "hover:-translate-y-1.5 hover:scale-105 active:scale-95" : "opacity-70"
        }`}
      >
        {/* Grosor 3D: varias cartas superpuestas bajo la de arriba. */}
        <div className="absolute inset-0 translate-x-1.5 translate-y-3 rounded-lg bg-[#11150f] border border-medium" />
        <div className="absolute inset-0 translate-x-1 translate-y-2 rounded-lg bg-[#1b1f22] border border-medium" />
        <div className="absolute inset-0 translate-x-0.5 translate-y-1 rounded-lg bg-subtle border border-medium" />
        <div
          className={`relative w-10 h-14 md:w-12 md:h-16 rounded-lg bg-subtle border flex items-center justify-center shadow-[0_4px_10px_rgba(0,0,0,0.4)] ${
            interactive
              ? "border-medium hover:border-accent hover:shadow-[0_0_16px_rgba(32,168,216,0.5)]"
              : "border-medium"
          }`}
        >
          {/* Dorso de carta: patrón de rombos pixelados + emblema central. */}
          <div className="flex w-7 h-10 md:w-8 md:h-11 items-center justify-center rounded border border-white/25 bg-[#162b25] [background-image:linear-gradient(45deg,transparent_42%,#4dbd74_43%,#4dbd74_57%,transparent_58%),linear-gradient(-45deg,transparent_42%,#20a8d8_43%,#20a8d8_57%,transparent_58%)] bg-[length:12px_12px]">
            <Icon
              icon="pixelarticons:notes"
              width={22}
              height={22}
              className={`text-accent/60 ${interactive ? "animate-pulse-glow" : ""}`}
            />
          </div>
        </div>
        {interactive && (
          <span className="absolute -top-6 left-1/2 -translate-x-1/2 inline-flex animate-float items-center gap-0.5 whitespace-nowrap rounded-full bg-accent px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white shadow-[0_0_10px_rgba(32,168,216,0.6)]">
            <Icon icon="pixelarticons:arrow-down" width={11} height={11} />
            Robar
          </span>
        )}
      </div>
      <span>mazo · {count}</span>
    </button>
  );
}
