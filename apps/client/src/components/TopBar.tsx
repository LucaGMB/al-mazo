"use client";

import { Icon } from "@iconify/react";
import Link from "next/link";
import Avatar from "./Avatar";
import { useSession } from "@/lib/session/use-session";
import { useUserStats } from "@/lib/api/use-user-stats";

export default function TopBar({ title }: { title: string }) {
  const { user } = useSession();
  const { stats } = useUserStats(user?.id ?? null);
  const matchesPlayed = stats?.reduce((total, stat) => total + stat.matchesPlayed, 0) ?? 0;
  const matchesWon = stats?.reduce((total, stat) => total + stat.matchesWon, 0) ?? 0;
  const level = Math.min(50, Math.floor(Math.sqrt(matchesPlayed * 3 + matchesWon * 6)) + 1);

  return (
    <div className="flex items-center justify-between gap-4 border-b border-subtle/60 py-3.5 md:py-4">
      <Link href="/" className="flex items-center gap-2 text-inherit no-underline">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-warning/30 bg-warning/10 text-warning"><Icon icon="pixelarticons:notes" width={19} height={19} /></span>
        <span className="hidden font-display text-sm font-black tracking-[0.16em] text-ink sm:block">AL MAZO</span>
        <span className="hidden items-center gap-1.5 rounded-full bg-success/15 px-2 py-1 text-[9px] font-bold tracking-wider text-success sm:flex"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" /> EN VIVO</span>
      </Link>
      <Link href="/perfil" className="flex items-center gap-2 rounded-full border border-subtle bg-surface px-2 py-1.5 text-inherit no-underline transition-colors hover:border-accent">
        <Avatar size={32} />
        <span className="hidden max-w-28 truncate text-xs font-bold text-ink sm:block">{user?.name ?? title}</span>
        {user && <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent">Nv. {level}</span>}
      </Link>
    </div>
  );
}
