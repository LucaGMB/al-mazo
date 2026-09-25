import { Icon } from "@iconify/react";

const COLORS = [
  { value: "RED", hex: "#F86C6B", label: "Rojo" },
  { value: "BLUE", hex: "#20A8D8", label: "Azul" },
  { value: "GREEN", hex: "#4DBD74", label: "Verde" },
  { value: "YELLOW", hex: "#F5C518", label: "Amarillo" },
] as const;

const SUITS = [
  { value: "ESPADAS", hex: "#2D5B88", icon: "pixelarticons:sword", label: "Espadas" },
  { value: "BASTOS", hex: "#3E5C38", icon: "pixelarticons:shield", label: "Bastos" },
  { value: "OROS", hex: "#C49000", icon: "pixelarticons:coin", label: "Oros" },
  { value: "COPAS", hex: "#9E2A2B", icon: "pixelarticons:trophy", label: "Copas" },
] as const;

export default function ColorPicker({
  onChoose,
  gameSlug,
}: {
  onChoose: (color: string) => void;
  gameSlug?: string;
}) {
  const options = gameSlug === "descarte-criollo" ? SUITS : COLORS;

  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center rounded-full bg-black/65 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="color-picker-title"
    >
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/20 bg-[#18241d]/95 p-5 shadow-[0_0_30px_rgba(245,197,24,0.2)]">
        <div id="color-picker-title" className="text-sm font-bold uppercase tracking-[0.18em] text-white">
          {gameSlug === "descarte-criollo" ? "Elegí un palo" : "Elegí un color"}
        </div>
        <div className="flex gap-3">
          {options.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => onChoose(c.value)}
              className="group flex flex-col items-center gap-1.5 text-[10px] font-bold text-white/75 transition-transform duration-150 hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
              aria-label={c.label}
            >
              <span
                className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-white/60 shadow-[0_0_0_5px_rgba(255,255,255,0.08),0_0_18px_currentColor]"
                style={{ backgroundColor: c.hex, color: c.hex }}
              >
                {"icon" in c && <Icon icon={c.icon} width={25} height={25} className="text-white" />}
              </span>
              <span>{c.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
