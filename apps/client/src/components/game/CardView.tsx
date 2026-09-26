"use client";

import type { CSSProperties, ReactNode } from "react";
import type { Card } from "@/types/engine";
import { Icon } from "@iconify/react";
import { CARD_COLORS } from "@/lib/game/card-colors";
import { getUnoCardImageSrc, getSpanishCardImageSrc, hasColorFallbackOnly } from "@/lib/game/card-assets";

const SUIT_ICONS: Record<string, string> = {
  ESPADAS: "pixelarticons:sword",
  BASTOS: "pixelarticons:shield",
  OROS: "pixelarticons:coin",
  COPAS: "pixelarticons:trophy",
};

const ACTION_ICONS: Record<string, string> = {
  SKIP: "pixelarticons:close",
  REVERSE: "pixelarticons:sync",
  SWAP: "pixelarticons:reload",
  DISCARD_ALL: "pixelarticons:trash",
  WILD: "pixelarticons:sparkles",
};

// Contenido de las esquinas (sólo Familia A, naipe español): valor + palo.
function pipInfo(card: Card): { text: string | null; icon: string | null } {
  const suit = SUIT_ICONS[card.color ?? ""];
  if (suit) return { text: card.value != null ? String(card.value) : null, icon: suit };
  if (card.type === "NUMBER") return { text: String(card.value ?? ""), icon: null };
  if (card.value === "DRAW_2") return { text: "+2", icon: "pixelarticons:arrow-down" };
  if (card.value === "WILD_DRAW_4") return { text: "+4", icon: "pixelarticons:arrow-down" };
  if (card.value === "WILD") return { text: null, icon: "pixelarticons:sparkles" };
  return { text: null, icon: ACTION_ICONS[card.value ?? ""] ?? null };
}

function CardPip({ card, inverted, ink }: { card: Card; inverted?: boolean; ink: string }) {
  const { text, icon } = pipInfo(card);
  if (!text && !icon) return null;
  return (
    <span
      className={`pointer-events-none absolute z-10 flex flex-col items-center gap-px font-display font-bold leading-none ${
        inverted ? "bottom-[5%] right-[8%] rotate-180" : "top-[5%] left-[8%]"
      }`}
      style={{ color: ink }}
    >
      {text && <span className="text-[0.4em]">{text}</span>}
      {icon && <Icon icon={icon} width="0.44em" height="0.44em" />}
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
  const interactiveClasses = onClick
    ? "cursor-pointer hover:-translate-y-2 hover:scale-105"
    : "cursor-default";
  const selectedClasses = selected ? "outline outline-[3px] outline-accent" : "";

  // Una carta sin onClick es presentacional: si se renderizara como <button
  // disabled> tragaría el click y los contenedores con onClick (mano del truco,
  // mesas) no lo recibirían. Por eso se usa <div> en ese caso.
  const wrapper = (className: string, content: ReactNode, style?: CSSProperties) =>
    onClick ? (
      <button type="button" onClick={onClick} className={className} style={style}>
        {content}
      </button>
    ) : (
      <div className={className} style={style}>
        {content}
      </div>
    );

  // Familia B con asset real (color-match / -chaos / -blitz): sprite tal cual.
  const unoSrc = getUnoCardImageSrc(card);
  if (unoSrc) {
    return wrapper(
      `group relative shrink-0 ${SIZE_CLASSES[size]} transition-transform duration-150 ${interactiveClasses} ${selectedClasses}`,
      <img
        src={unoSrc}
        alt=""
        draggable={false}
        className="h-full w-full [image-rendering:pixelated] drop-shadow-[3px_4px_0_rgba(0,0,0,0.4)]"
      />
    );
  }

  // Familia B sin asset todavía (REVERSE / DISCARD_ALL): color plano real +
  // ícono vectorial, sin gradiente ni blur.
  if (hasColorFallbackOnly(card)) {
    const bg = CARD_COLORS[card.color ?? "ANY"] ?? CARD_COLORS.ANY;
    const icon = ACTION_ICONS[card.value as string];
    return wrapper(
 `group relative shrink-0 ${SIZE_CLASSES[size]} border-[3px] border-[#0b0812] flex items-center justify-center shadow-[3px_4px_0_0_rgba(0,0,0,0.4)] transition-transform duration-150 ${interactiveClasses} ${selectedClasses}`,
      icon && <Icon icon={icon} width="1.4em" height="1.4em" className="text-white" />,
      { backgroundColor: bg }
    );
  }

  // Familia A con asset real (naipe español pixel-art, truco/escoba/chinchón/
  // descarte-criollo): sprite tal cual, mismo trato que Familia B.
  const spanishSrc = getSpanishCardImageSrc(card);
  if (spanishSrc) {
    return wrapper(
      `group relative shrink-0 ${SIZE_CLASSES[size]} transition-transform duration-150 ${interactiveClasses} ${selectedClasses}`,
      <img
        src={spanishSrc}
        alt=""
        draggable={false}
        className="h-full w-full [image-rendering:pixelated] drop-shadow-[3px_4px_0_rgba(0,0,0,0.4)]"
      />
    );
  }

  // Fallback vectorial (valor/palo sin asset todavía, no debería alcanzarse
  // con el mazo español completo de arriba).
  const fg = CARD_COLORS[card.color ?? "ANY"] ?? CARD_COLORS.ANY;
  return wrapper(
 `group relative shrink-0 ${SIZE_CLASSES[size]} card-paper border-[3px] border-[#241a44] flex items-center justify-center transition-all duration-150 shadow-[3px_4px_0_0_rgba(0,0,0,0.4)] ${interactiveClasses} ${
      selected ? "outline outline-[3px] outline-accent shadow-[0_0_0_3px_rgba(255,210,63,0.4),3px_4px_0_0_rgba(0,0,0,0.4)]" : ""
    }`,
    <>
      <CardPip card={card} ink={fg} />
      <CardPip card={card} inverted ink={fg} />
      <span
        className="relative z-10 flex flex-col items-center gap-0.5 text-center text-[1.55em] leading-none font-display font-bold [text-shadow:2px_2px_0_rgba(0,0,0,0.15)]"
        style={{ color: fg }}
      >
        {cardCenter(card)}
      </span>
    </>
  );
}
