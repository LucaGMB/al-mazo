"use client";

import { Icon } from "@iconify/react";

interface MetadataSectionProps {
  title: string;
  slug: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  isExisting: boolean;
  onChange: (fields: Partial<{
    title: string;
    slug: string;
    description: string;
    minPlayers: number;
    maxPlayers: number;
  }>) => void;
}

export default function MetadataSection({
  title,
  slug,
  description,
  minPlayers,
  maxPlayers,
  isExisting,
  onChange,
}: MetadataSectionProps) {
  function handleTitleChange(newTitle: string) {
    const patch: Record<string, unknown> = { title: newTitle };
    if (!isExisting) {
      // Auto-generate slug when creating a new game if title changes
      const generated = newTitle
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 50);
      if (generated) patch.slug = generated;
    }
    onChange(patch);
  }

  return (
 <div className="flex flex-col gap-5 border-2 border-subtle bg-statusbar p-5 md:p-6 shadow-[4px_4px_0_0_rgba(0,0,0,0.3)]">
      <div className="flex items-center gap-3 pb-3 border-b border-subtle">
 <span className="flex h-10 w-10 items-center justify-center border border-accent/40 bg-accent/15 text-accent shadow-[0_0_12px_rgba(32,168,216,0.2)]">
          <Icon icon="pixelarticons:edit" width={20} height={20} />
        </span>
        <div>
          <h2 className="text-base md:text-lg font-black text-ink">Información Básica</h2>
          <p className="text-xs text-ink-faint">Nombre, identificador y cantidad de participantes</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1.5 text-xs font-bold text-ink-soft">
          <span>Título del Juego *</span>
          <input
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Ej: Descarte Relámpago"
 className="h-11 border border-subtle bg-app/80 px-3.5 text-sm text-ink focus:border-accent focus:outline-none transition-colors"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-xs font-bold text-ink-soft">
          <span>Identificador (Slug) *</span>
          <div className="relative flex items-center">
            <input
              type="text"
              value={slug}
              disabled={isExisting}
              onChange={(e) =>
                onChange({
                  slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                })
              }
              placeholder="descarte-relampago"
 className="h-11 w-full border border-subtle bg-app/80 px-3.5 text-sm font-mono text-ink disabled:opacity-60 focus:border-accent focus:outline-none transition-colors"
            />
            {isExisting && (
              <span className="absolute right-3 text-[10px] text-ink-faint uppercase font-bold tracking-wider">
                Fijo
              </span>
            )}
          </div>
        </label>
      </div>

      <label className="flex flex-col gap-1.5 text-xs font-bold text-ink-soft">
        <span>Descripción del Juego *</span>
        <textarea
          rows={3}
          value={description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Explicá en pocas líneas de qué trata tu juego, cómo se gana y qué lo hace único..."
 className=" border border-subtle bg-app/80 p-3.5 text-sm text-ink focus:border-accent focus:outline-none transition-colors resize-none"
        />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
 <div className="flex flex-col gap-2 border border-subtle bg-app/50 p-4">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-ink-soft">Mínimo de Jugadores</span>
            <span className="font-black text-accent text-sm">{minPlayers}</span>
          </div>
          <input
            type="range"
            min={2}
            max={8}
            value={minPlayers}
            onChange={(e) => {
              const val = Number(e.target.value);
              onChange({
                minPlayers: val,
                maxPlayers: Math.max(val, maxPlayers),
              });
            }}
            className="w-full accent-accent cursor-pointer"
          />
          <span className="text-[10px] text-ink-faint">Mínimo permitido por mesa</span>
        </div>

 <div className="flex flex-col gap-2 border border-subtle bg-app/50 p-4">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-ink-soft">Máximo de Jugadores</span>
            <span className="font-black text-accent text-sm">{maxPlayers}</span>
          </div>
          <input
            type="range"
            min={minPlayers}
            max={12}
            value={maxPlayers}
            onChange={(e) => onChange({ maxPlayers: Number(e.target.value) })}
            className="w-full accent-accent cursor-pointer"
          />
          <span className="text-[10px] text-ink-faint">Hasta 12 jugadores simultáneos</span>
        </div>
      </div>
    </div>
  );
}
