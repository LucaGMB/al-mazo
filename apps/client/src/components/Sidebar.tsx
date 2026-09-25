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
      <div className="flex items-center px-3">
        <img
          src="/text-logo.png"
          alt="Al Mazo"
          draggable={false}
          className="h-8 w-auto [image-rendering:pixelated]"
        />
      </div>
      <nav className="flex flex-col gap-1">
        {items.map(({ href, icon, label, end }) => {
          const isActive = end ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
 className={`relative flex items-center gap-3 px-3 py-2.5 text-sm font-medium no-underline transition-all duration-150 ${
                isActive
                  ? "bg-accent/15 border-2 border-accent/60 text-accent font-bold shadow-[3px_3px_0_0_rgba(0,0,0,0.3)]"
                  : "border-2 border-transparent text-ink-faint hover:bg-statusbar hover:text-ink hover:translate-x-0.5"
              }`}
            >
              {isActive && (
 <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 bg-accent" />
              )}
              <Icon icon={`pixelarticons:${icon}`} width={20} height={20} />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
