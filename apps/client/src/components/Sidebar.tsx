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

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:flex-col md:w-60 md:shrink-0 md:h-screen md:sticky md:top-0 gap-8 border-r border-subtle bg-surface px-4 py-6">
      <div className="flex items-center gap-3 px-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-warning/60 bg-warning/10 text-warning shadow-[0_0_16px_rgba(255,193,7,0.25)]">
          <Icon icon="pixelarticons:notes" width={22} height={22} />
        </span>
        <span className="flex flex-col leading-tight">
          <span className="font-black tracking-[0.16em] text-ink">AL MAZO</span>
          <span className="text-[10px] uppercase tracking-[0.14em] text-ink-faint">Arcade Lounge</span>
        </span>
      </div>
      <nav className="flex flex-col gap-1">
        {items.map(({ href, icon, label, end }) => {
          const isActive = end ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-full text-sm font-medium no-underline transition-all duration-150 ${
                isActive
                  ? "bg-accent/15 border border-accent/40 text-accent font-bold shadow-[0_0_14px_rgba(32,168,216,0.25)]"
                  : "border border-transparent text-ink-faint hover:bg-statusbar hover:text-ink hover:translate-x-0.5"
              }`}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-accent shadow-[0_0_8px_rgba(32,168,216,0.8)]" />
              )}
              <Icon icon={`pixelarticons:${icon}`} width={20} height={20} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto flex items-center gap-2 px-3 text-[10px] text-ink-faint">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success shadow-[0_0_8px_rgba(77,189,116,0.8)]" />
        v1.2 · Servidores Activos
      </div>
    </aside>
  );
}
