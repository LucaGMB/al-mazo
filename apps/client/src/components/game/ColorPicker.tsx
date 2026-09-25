import { Icon } from "@iconify/react";
import { CARD_COLORS, COLOR_LABELS, SUIT_LABELS } from "@/lib/game/card-colors";

const SUIT_ICONS: Record<string, string> = {
  ESPADAS: "pixelarticons:sword",
  BASTOS: "pixelarticons:shield",
  OROS: "pixelarticons:coin",
  COPAS: "pixelarticons:trophy",
};

interface PickerOption {
  value: string;
  hex: string;
  label: string;
  icon?: string;
}

const COLORS: PickerOption[] = (Object.keys(COLOR_LABELS) as Array<keyof typeof COLOR_LABELS>).map(
  (value) => ({ value, hex: CARD_COLORS[value], label: COLOR_LABELS[value] })
);

const SUITS: PickerOption[] = (Object.keys(SUIT_LABELS) as Array<keyof typeof SUIT_LABELS>).map(
  (value) => ({ value, hex: CARD_COLORS[value], icon: SUIT_ICONS[value], label: SUIT_LABELS[value] })
);

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
      <div className="flex flex-col items-center gap-4 border-[3px] border-accent bg-felt-dark/95 p-5 shadow-[0_0_30px_rgba(255,210,63,0.25)]">
        <div
          id="color-picker-title"
          className="font-display text-sm font-bold uppercase tracking-[0.18em] text-ink"
        >
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
                {c.icon && <Icon icon={c.icon} width={25} height={25} className="text-white" />}
              </span>
              <span>{c.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
