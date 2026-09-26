"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import Button from "@/components/Button";
import MenuListItem from "@/components/MenuListItem";
import StatBlock from "@/components/StatBlock";
import { AuthForm } from "@/components/auth/AuthModal";
import { useSession } from "@/lib/session/use-session";
import { useUserStats, useUserMatches } from "@/lib/api/use-user-stats";

const AVATAR_KEY = "almazo:avatar";

const AVATARS = [
  { id: "robot", icon: "pixelarticons:robot" },
  { id: "gamepad", icon: "pixelarticons:gamepad" },
  { id: "crown", icon: "pixelarticons:crown" },
  { id: "fire", icon: "pixelarticons:fire" },
  { id: "shield", icon: "pixelarticons:shield" },
  { id: "zap", icon: "pixelarticons:zap" },
] as const;

function levelTitle(level: number): string {
  if (level >= 40) return "Leyenda Viviente";
  if (level >= 25) return "Maestro del Mazo";
  if (level >= 15) return "Estratega";
  if (level >= 5) return "Aprendiz";
  return "Novato";
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function Profile() {
  const router = useRouter();
  const { user, isLoading, isLoggedIn, updateName, logout } = useSession();
  const { stats } = useUserStats(isLoggedIn ? (user?.id ?? null) : null);
  const { matches, isLoading: matchesLoading } = useUserMatches(
    isLoggedIn ? (user?.id ?? null) : null,
  );

  const [avatar, setAvatar] = useState<string>(AVATARS[0].id);
  const [isEditing, setIsEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(AVATAR_KEY);
    if (stored && AVATARS.some((a) => a.id === stored)) {
      // Lectura de storage externo al montar (no hay forma de derivarlo en SSR).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAvatar(stored);
    }
  }, []);

  function chooseAvatar(id: string) {
    setAvatar(id);
    window.localStorage.setItem(AVATAR_KEY, id);
  }

  function startEdit() {
    setNameDraft(user?.name ?? "");
    setNameError(null);
    setIsEditing(true);
  }

  async function saveName() {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed.length > 30) {
      setNameError("Entre 1 y 30 caracteres");
      return;
    }
    setSavingName(true);
    setNameError(null);
    try {
      await updateName(trimmed);
      setIsEditing(false);
    } catch {
      setNameError("No se pudo guardar el nombre");
    } finally {
      setSavingName(false);
    }
  }

  const totals = stats?.reduce(
    (acc, s) => ({
      matchesPlayed: acc.matchesPlayed + s.matchesPlayed,
      matchesWon: acc.matchesWon + s.matchesWon,
    }),
    { matchesPlayed: 0, matchesWon: 0 },
  );

  if (isLoading) {
    return <div className="px-4 py-8 text-[13px] text-ink-faint">Cargando...</div>;
  }

  if (!isLoggedIn || !user) {
    return (
      <div className="flex flex-col gap-4 px-4 py-8 md:max-w-md md:mx-auto md:pt-14">
        <div className="flex flex-col items-center gap-2 text-center">
 <div className="w-[72px] h-[72px] bg-subtle border border-medium flex items-center justify-center text-accent">
            <Icon icon="pixelarticons:lock" width={36} height={36} />
          </div>
          <div className="font-bold text-lg text-ink">Entrá a tu cuenta</div>
          <div className="text-[13px] text-ink-faint">
            Solo los jugadores registrados con usuario y clave pueden crear, publicar y clonar
            juegos.
          </div>
        </div>
        <div className="border-[3px] border-subtle bg-statusbar/90 p-5 shadow-[6px_8px_0_0_rgba(0,0,0,0.35)]">
          <AuthForm />
        </div>
      </div>
    );
  }

  const level = Math.min(
    50,
    Math.floor(Math.sqrt((totals?.matchesPlayed ?? 0) * 3 + (totals?.matchesWon ?? 0) * 6)) + 1,
  );
  const winRate =
    totals && totals.matchesPlayed > 0
      ? Math.round((totals.matchesWon / totals.matchesPlayed) * 100)
      : 0;
  const avatarIcon = AVATARS.find((a) => a.id === avatar)?.icon ?? AVATARS[0].icon;

  return (
    <div className="flex flex-col md:max-w-md md:mx-auto md:pt-10">
 <div className="flex flex-col items-center gap-2 px-4 py-5 md:py-8 bg-statusbar border-b border-subtle md:border">
 <div className="w-[72px] h-[72px] md:w-24 md:h-24 bg-subtle border-2 border-medium flex items-center justify-center text-accent">
          <Icon icon={avatarIcon} width={44} height={44} />
        </div>

        {isEditing ? (
          <div className="flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-2">
              <input
                value={nameDraft}
                maxLength={30}
                autoFocus
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void saveName();
                  if (e.key === "Escape") setIsEditing(false);
                }}
                aria-label="Nombre"
 className="h-8 w-[140px] border border-medium bg-app px-2 text-[13px] text-ink outline-none focus:border-accent"
              />
              <Button variant="cta" onClick={() => void saveName()} disabled={savingName}>
                Guardar
              </Button>
              <Button variant="ghost" onClick={() => setIsEditing(false)}>
                Cancelar
              </Button>
            </div>
            {nameError && <div className="text-[11px] text-danger">{nameError}</div>}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-2">
              <div className="font-bold text-base md:text-xl text-ink">{user.name}</div>
              <button
                type="button"
                onClick={startEdit}
                aria-label="Editar nombre"
                title="Editar nombre"
                className="text-ink-faint hover:text-accent cursor-pointer"
              >
                <Icon icon="pixelarticons:edit" width={16} height={16} />
              </button>
            </div>
            {user.email && <div className="text-[11px] text-ink-faint">{user.email}</div>}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-2">
          {user.role === "ADMIN" && (
            <span className="inline-flex items-center gap-1 border border-danger/40 bg-danger/15 px-2.5 py-0.5 text-[11px] font-bold text-danger">
              <Icon icon="pixelarticons:shield" width={13} height={13} />
              Admin
            </span>
          )}
          <span className=" border border-success/40 bg-success/15 px-2.5 py-0.5 text-[11px] font-bold text-success">
            Registrado
          </span>
          <span className=" border border-accent/40 bg-accent/15 px-2.5 py-0.5 text-[11px] font-bold text-accent">
            Nivel {level}
          </span>
          <span className="text-xs text-ink-faint">{levelTitle(level)}</span>
        </div>

        {user.role === "ADMIN" && (
          <div className="w-full max-w-[260px] mt-2">
            <Button to="/admin" variant="cta" fullWidth className="!h-9 !text-xs">
              <Icon icon="pixelarticons:shield" width={16} height={16} />
              Panel de Administración
            </Button>
          </div>
        )}

        {totals && (
          <div className="flex gap-5 mt-1.5">
            <StatBlock value={totals.matchesPlayed} label="partidas jugadas" />
            <StatBlock value={totals.matchesWon} label="ganadas" />
            <StatBlock value={`${winRate}%`} label="win-rate" />
          </div>
        )}

        <div className="w-full max-w-[260px] mt-1">
 <div className="h-2 overflow-hidden bg-subtle">
            <div
 className="h-full bg-accent transition-all"
              style={{ width: `${winRate}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 px-4 py-3">
        <div className="font-medium text-[13px] text-ink-soft">Avatar</div>
        <div className="grid grid-cols-6 gap-2">
          {AVATARS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => chooseAvatar(a.id)}
              aria-label={`Avatar ${a.id}`}
              aria-pressed={avatar === a.id}
 className={`flex h-11 items-center justify-center border transition-colors cursor-pointer ${
                avatar === a.id
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-subtle bg-surface text-ink-soft hover:border-medium"
              }`}
            >
              <Icon icon={a.icon} width={24} height={24} />
            </button>
          ))}
        </div>
      </div>

      {stats && stats.length > 0 && (
        <div className="flex flex-col gap-2 px-4 py-3">
          <div className="font-medium text-[13px] text-ink-soft">Por juego</div>
          {stats.map((s) => (
            <div key={s.gameSlug} className="flex items-center justify-between text-[13px] text-ink">
              <span>{s.gameSlug}</span>
              <span className="text-ink-faint">
                {s.matchesWon}/{s.matchesPlayed} ganadas
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 px-4 py-3">
        <div className="font-medium text-[13px] text-ink-soft">Historial reciente</div>
        {matchesLoading && <div className="text-[12px] text-ink-faint">Cargando...</div>}
        {!matchesLoading && matches && matches.length === 0 && (
          <div className="text-[12px] text-ink-faint">Todavía no hay partidas registradas.</div>
        )}
        {matches?.map((m) => {
          const won = m.participants.some((p) => p.userId === user.id && p.isWinner);
          return (
            <div
              key={m.id}
 className="flex items-center justify-between border border-subtle bg-surface px-3 py-2"
            >
              <div className="min-w-0">
                <div className="truncate text-[13px] text-ink">
                  {m.game?.title ?? m.game?.slug ?? "Partida"}
                </div>
                <div className="text-[11px] text-ink-faint">
                  {formatDate(m.endedAt)} · {formatDuration(m.durationSec)}
                </div>
              </div>
              <span
 className={`shrink-0 border px-2.5 py-0.5 text-[11px] font-bold ${
                  won
                    ? "border-success/40 bg-success/15 text-success"
                    : "border-danger/40 bg-danger/15 text-danger"
                }`}
              >
                {won ? "Victoria" : "Derrota"}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col px-4 py-3">
        {user.role === "ADMIN" && (
          <MenuListItem
            icon="shield"
            label="Panel de Administración & Moderación"
            onClick={() => router.push("/admin")}
          />
        )}
        <MenuListItem icon="logout" label="Cerrar sesión" danger onClick={logout} />
      </div>
    </div>
  );
}
