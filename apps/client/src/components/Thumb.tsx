"use client";

import { Icon } from "@iconify/react";

// Color plano por modo (no degradados) + grano como textura, con el dorso
// de carta pixel-art real como ícono para la familia color-match.
export default function Thumb({ className = "w-full h-24 ", gameSlug }: { className?: string; gameSlug?: string }) {
  const config = {
    "color-match-blitz": { bg: "var(--color-accent)", ink: "#171a35", icon: "pixelarticons:zap", badge: "BLITZ", cardArt: true },
    "color-match-chaos": { bg: "var(--color-danger)", ink: "#171a35", icon: "pixelarticons:reload", badge: "CHAOS", cardArt: true },
    "descarte-criollo": { bg: "var(--color-warning)", ink: "#171a35", icon: "pixelarticons:sword", badge: "CRIOLLO", cardArt: true },
    desconectados: { bg: "var(--color-info)", ink: "#171a35", icon: "pixelarticons:message-text", badge: "CHARLA" },
  }[gameSlug ?? ""];

  if (gameSlug === "color-match") {
    return (
 <div className={`relative grid grid-cols-2 overflow-hidden ${className}`}>
        {(["#ff4d6d", "#4fa8ff", "#33c48d", "#ffd23f"] as const).map((color) => (
          <span key={color} style={{ backgroundColor: color }} />
        ))}
 <div className="pointer-events-none absolute inset-3 border-2 border-paper/70" />
      </div>
    );
  }

  return (
    <div
      className={`grain relative flex shrink-0 items-center justify-center overflow-hidden ${className}`}
      style={{ backgroundColor: config?.bg ?? "var(--color-wood-dark)", color: config?.ink ?? "#f4f1ff" }}
    >
      {config?.cardArt ? (
        <img
          src="/pixel/cards/back.png"
          alt=""
          draggable={false}
          className="h-[70%] w-auto [image-rendering:pixelated] drop-shadow-[2px_3px_0_rgba(0,0,0,0.4)]"
        />
      ) : (
        <Icon icon={config?.icon ?? "pixelarticons:dice"} width={28} height={28} />
      )}
      {config?.badge && (
 <span className="absolute bottom-1.5 right-1.5 bg-black/45 px-1.5 py-0.5 text-[9px] font-black tracking-widest text-[#f4f1ff]">
          {config.badge}
        </span>
      )}
    </div>
  );
}
