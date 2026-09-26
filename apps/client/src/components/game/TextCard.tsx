"use client";

import type { Card } from "@/types/engine";

const SIZE_CLASSES = {
  sm: "w-14 h-20 text-[8px]",
  md: "w-20 h-28 text-[10px]",
  lg: "w-28 h-40 text-[11px] md:w-32 md:h-44 md:text-xs",
} as const;

export function getCardText(card: Card): string {
  if (typeof card.metadata?.text === "string") return card.metadata.text;
  return String(card.value ?? card.type);
}

export default function TextCard({
  card,
  selected,
  disabled,
  size = "md",
  badge,
  onClick,
}: {
  card: Card;
  selected?: boolean;
  disabled?: boolean;
  size?: keyof typeof SIZE_CLASSES;
  badge?: string | number;
  onClick?: () => void;
}) {
  const text = getCardText(card);
  const isPrompt = card.type === "PROMPT";
  const isArticleOptional = card.metadata?.articleOptional === true;
  const isInteractive = Boolean(onClick) && !disabled;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || !onClick}
      aria-pressed={selected}
      title={text}
      className={`group relative shrink-0 ${SIZE_CLASSES[size]} overflow-hidden rounded-lg border-2 p-1.5 text-left font-bold leading-tight shadow-[0_5px_12px_rgba(0,0,0,0.45)] transition-all duration-150 ${
        isPrompt
          ? "border-white/25 bg-[#15161a] text-ink"
          : "border-black/30 bg-[#f4f2ea] text-[#15161a]"
      } ${selected ? "-translate-y-2 ring-2 ring-warning shadow-[0_0_16px_rgba(245,197,24,0.5)]" : ""} ${
        isInteractive ? "cursor-pointer hover:-translate-y-1.5" : "cursor-default"
      }`}
    >
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
      <span className="relative z-10 block h-full w-full overflow-hidden">{text}</span>
      {isArticleOptional && (
        <span className="absolute bottom-0.5 right-1 z-10 text-[7px] font-black uppercase tracking-wider opacity-50">
          Art. opcional
        </span>
      )}
      {badge !== undefined && (
        <span className="absolute -top-1 -right-1 z-20 flex h-5 w-5 items-center justify-center rounded-full bg-warning text-[10px] font-black text-black shadow">
          {badge}
        </span>
      )}
    </button>
  );
}
