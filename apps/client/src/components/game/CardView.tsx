"use client";

import type { Card } from "@/types/engine";
import { Icon } from "@iconify/react";

// Colores del juego (color-match), independientes de la paleta de UI del
// theme de Tailwind: ver al-mazo-server/src/games/color-match/definition.ts.
const CARD_COLORS: Record<string, string> = {
  RED: "#F86C6B",
  BLUE: "#20A8D8",
  GREEN: "#4DBD74",
  YELLOW: "#F5C518",
  ESPADAS: "#2D5B88",
  BASTOS: "#3E5C38",
  OROS: "#C49000",
  COPAS: "#9E2A2B",
  ANY: "#3A3F44",
};

const SUIT_ICONS: Record<string, string> = {
  ESPADAS: "pixelarticons:sword",
  BASTOS: "pixelarticons:shield",
  OROS: "pixelarticons:coin",
  COPAS: "pixelarticons:trophy",
};

const ACTION_ICONS: Record<string, string> = {
  SKIP: "pixelarticons:close",
  REVERSE: "pixelarticons:arrow-bar-both",
  SWAP: "pixelarticons:reload",
  DISCARD_ALL: "pixelarticons:trash",
  WILD: "pixelarticons:sparkles",
};

// Contenido de las esquinas: valor + palo (o ícono de acción).
function pipInfo(card: Card): { text: string | null; icon: string | null } {
  const suit = SUIT_ICONS[card.color ?? ""];
  if (suit) return { text: card.value != null ? String(card.value) : null, icon: suit };
  if (card.type === "NUMBER") return { text: String(card.value ?? ""), icon: null };
  if (card.value === "DRAW_2") return { text: "+2", icon: "pixelarticons:arrow-down" };
  if (card.value === "WILD_DRAW_4") return { text: "+4", icon: "pixelarticons:arrow-down" };
  if (card.value === "WILD") return { text: null, icon: "pixelarticons:sparkles" };
  return { text: null, icon: ACTION_ICONS[card.value ?? ""] ?? null };
}

function CardPip({ card, inverted }: { card: Card; inverted?: boolean }) {
  const { text, icon } = pipInfo(card);
  if (!text && !icon) return null;
  return (
    <span
      className={`pointer-events-none absolute z-10 flex flex-col items-center gap-px font-black leading-none ${
        inverted ? "bottom-0.5 right-0.5 rotate-180" : "top-0.5 left-0.5"
      }`}
    >
      {text && <span className="text-[0.5em]">{text}</span>}
      {icon && <Icon icon={icon} width="0.5em" height="0.5em" />}
    </span>
  );
}

function cardCenter(card: Card) {
  const suitIcon = SUIT_ICONS[card.color ?? ""];
  if (suitIcon) {
    return (
      <>
        <Icon icon={suitIcon} width="1em" height="1em" />
        <span className="text-[0.7em] leading-none">{card.value}</span>
      </>
    );
  }

  if (card.type === "NUMBER") return String(card.value ?? "");
  if (card.value === "DRAW_2" || card.value === "WILD_DRAW_4") {
    return card.value === "DRAW_2" ? "+2" : "+4";
  }

  const icon = ACTION_ICONS[card.value ?? ""];
  return icon ? <Icon icon={icon} width="1.15em" height="1.15em" /> : "?";
}

const SIZE_CLASSES = {
  sm: "w-8 h-11 md:w-11 md:h-[60px] text-xs",
  md: "w-10 h-14 md:w-12 md:h-16 text-sm",
  lg: "w-[58px] h-[82px] md:w-20 md:h-[114px] text-base",
} as const;

export default function CardView({
  card,
  selected,
  onClick,
  size = "md",
}: {
  card: Card;
  selected?: boolean;
  onClick?: () => void;
  size?: keyof typeof SIZE_CLASSES;
}) {
  const bg = CARD_COLORS[card.color ?? "ANY"] ?? CARD_COLORS.ANY;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`group relative shrink-0 ${SIZE_CLASSES[size]} overflow-hidden rounded-lg border-2 border-white/20 flex items-center justify-center font-bold text-white shadow-[0_5px_12px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.35),inset_0_-2px_0_rgba(0,0,0,0.3)] transition-all duration-150 ${
        onClick
          ? "cursor-pointer hover:-translate-y-2 hover:scale-105 hover:shadow-[0_12px_24px_rgba(0,0,0,0.6)]"
          : "cursor-default"
      } ${selected ? "border-accent shadow-[0_0_14px_rgba(32,168,216,0.6)]" : ""}`}
      style={{ backgroundColor: bg }}
    >
      {/* Brillo diagonal sutil sobre la superficie de la carta. */}
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/15 to-transparent" />
      <span className="pointer-events-none absolute inset-[3px] rounded-md border border-white/20" />
      <CardPip card={card} />
      <CardPip card={card} inverted />
      <span className="relative z-10 flex flex-col items-center gap-0.5 text-center text-[1.45em] leading-none">
        {cardCenter(card)}
      </span>
    </button>
  );
}
