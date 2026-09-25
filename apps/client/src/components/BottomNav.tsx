"use client";

import { Icon } from "@iconify/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", icon: "home", label: "Inicio", end: true },
  { href: "/explorar", icon: "search", label: "Explorar" },
  { href: "/editor", icon: "sliders", label: "Editor" },
  { href: "/perfil", icon: "user", label: "Perfil" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden flex-none h-16 backdrop-blur-lg bg-surface/90 border-t border-white/10 shadow-[0_-4px_20px_rgba(0,0,0,0.5)] flex items-center justify-around sticky bottom-0 z-30 px-2">
      {items.map(({ href, icon, label, end }) => {
        const isActive = end ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center gap-0.5 no-underline transition-all duration-150 ${
              isActive
                ? "bg-accent/15 border border-accent/40 text-accent font-bold scale-105 shadow-[0_0_14px_rgba(32,168,216,0.25)] rounded-full px-4 py-1"
                : "border border-transparent text-ink-faint hover:text-accent hover:-translate-y-0.5"
            }`}
          >
            <Icon
              icon={`pixelarticons:${icon}`}
              width={22}
              height={22}
              className="shrink-0"
            />
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
