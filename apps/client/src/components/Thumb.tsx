"use client";

import { Icon } from "@iconify/react";

export default function Thumb({ className = "w-full h-24 rounded", gameSlug }: { className?: string; gameSlug?: string }) {
  const config = {
    "color-match-blitz": { className: "from-cyan-500 via-blue-600 to-indigo-900", icon: "pixelarticons:zap", badge: "BLITZ" },
    "color-match-chaos": { className: "from-violet-950 via-purple-700 to-fuchsia-950", icon: "pixelarticons:reload", badge: "CHAOS" },
    "descarte-criollo": { className: "from-amber-500 via-red-800 to-[#35151a]", icon: "pixelarticons:sword", badge: "CRIOLLO" },
  }[gameSlug ?? ""];

  if (gameSlug === "color-match") {
    return (
      <div className={`relative grid grid-cols-2 overflow-hidden rounded ${className}`}>
        {(["bg-red-500", "bg-blue-500", "bg-green-500", "bg-yellow-400"] as const).map((color) => <span key={color} className={color} />)}
        <div className="pointer-events-none absolute inset-3 rounded border-2 border-white/70" />
      </div>
    );
  }

  return (
    <div className={`relative flex shrink-0 items-center justify-center overflow-hidden bg-gradient-to-br text-white ${config?.className ?? "from-slate-700 via-slate-800 to-slate-950"} ${className}`}>
      <Icon icon={config?.icon ?? "pixelarticons:dice"} width={config ? 32 : 28} height={config ? 32 : 28} />
      {config?.badge && <span className="absolute bottom-1.5 right-1.5 rounded bg-black/45 px-1.5 py-0.5 text-[9px] font-black tracking-widest">{config.badge}</span>}
    </div>
  );
}
