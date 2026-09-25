"use client";

import { Icon } from "@iconify/react";

// Gradientes saturados tipo ficha de casino/arcade: cada modo tiene su
// propia variante dentro de la misma paleta.
export default function Thumb({ className = "w-full h-24 rounded", gameSlug }: { className?: string; gameSlug?: string }) {
  const config = {
    "color-match-blitz": { className: "from-[#ffd23f] via-[#ff8f4d] to-[#12163a]", icon: "pixelarticons:zap", badge: "BLITZ" },
    "color-match-chaos": { className: "from-[#ff6b9d] via-[#9b6bff] to-[#12163a]", icon: "pixelarticons:reload", badge: "CHAOS" },
    "descarte-criollo": { className: "from-[#ffd23f] via-[#ff8f4d] to-[#4d2c1a]", icon: "pixelarticons:sword", badge: "CRIOLLO" },
    desconectados: { className: "from-[#4fa8ff] via-[#33c48d] to-[#12163a]", icon: "pixelarticons:message-text", badge: "CHARLA" },
  }[gameSlug ?? ""];

  if (gameSlug === "color-match") {
    return (
      <div className={`relative grid grid-cols-2 overflow-hidden rounded ${className}`}>
        {(["#ff4d6d", "#4fa8ff", "#33c48d", "#ffd23f"] as const).map((color) => (
          <span key={color} style={{ backgroundColor: color }} />
        ))}
        <div className="pointer-events-none absolute inset-3 rounded border-2 border-paper/70" />
      </div>
    );
  }

  return (
    <div className={`relative flex shrink-0 items-center justify-center overflow-hidden bg-gradient-to-br text-[#f4f1ff] ${config?.className ?? "from-wood via-wood-dark to-[#171a35]"} ${className}`}>
      <Icon icon={config?.icon ?? "pixelarticons:dice"} width={config ? 32 : 28} height={config ? 32 : 28} />
      {config?.badge && <span className="absolute bottom-1.5 right-1.5 rounded bg-black/45 px-1.5 py-0.5 text-[9px] font-black tracking-widest">{config.badge}</span>}
    </div>
  );
}
