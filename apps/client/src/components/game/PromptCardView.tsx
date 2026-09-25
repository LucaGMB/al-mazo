"use client";

import type { ReactNode } from "react";
import { Icon } from "@iconify/react";
import { promptCategoryMeta, type PromptCard } from "@/lib/game/desconectados";

/**
 * Carta de pregunta de Desconectados. Es la vista pública que comparten el
 * modo online y el pass-and-play local.
 */
export default function PromptCardView({
  prompt,
  blankText,
  children,
}: {
  prompt: PromptCard;
  blankText?: string;
  children?: ReactNode;
}) {
  const meta = promptCategoryMeta(prompt.category);
  const isBlank = prompt.type === "BLANK";
  const text = isBlank ? blankText?.trim() : prompt.question;
  const showChildren = isBlank && !text;

  return (
    <div className="relative w-full max-w-[440px] border-[3px] border-[#241a44] bg-paper text-[#241a44] shadow-[6px_8px_0_0_rgba(0,0,0,0.4)]">
      <div
        className="flex items-center justify-between gap-2 border-b-[3px] border-[#241a44] px-4 py-2.5"
        style={{ backgroundColor: meta.color }}
      >
        <span className="flex items-center gap-2 font-display text-[11px] md:text-xs font-black uppercase tracking-[0.14em] text-[#171a35]">
          <Icon icon={meta.icon} width={16} height={16} />
          {prompt.categoryLabel || meta.label}
        </span>
        {prompt.value !== undefined && prompt.value !== "EN_BLANCO" && (
          <span className="font-mono text-[10px] font-bold text-[#171a35]/80">
            #{prompt.value}
          </span>
        )}
      </div>

      <div className="flex min-h-[190px] md:min-h-[240px] flex-col items-center justify-center gap-4 px-5 py-7 md:px-8 text-center">
        {showChildren ? (
          children
        ) : (
          <p className="m-0 font-display text-[15px] md:text-lg font-bold leading-relaxed">
            {text}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between border-t-[3px] border-[#241a44]/20 px-4 py-2 font-mono text-[9px] uppercase tracking-[0.2em] text-[#241a44]/60">
        <span>Desconectados</span>
        {isBlank && <span>Pregunta libre</span>}
      </div>
    </div>
  );
}
