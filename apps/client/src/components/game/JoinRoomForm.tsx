"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Button from "@/components/Button";
import { useRoom } from "@/lib/room/use-room";

// Formulario embebido dentro de /juego/[slug]/mesa/[roomCode] cuando no hay
// credenciales guardadas para ese código (link compartido, o el jugador tipeó
// un código en /mesa). Reusa el mismo socket persistente del RoomProvider
// (useRoom().joinRoom), a diferencia de CreateRoomForm que usa uno temporal.
export default function JoinRoomForm({ roomCode }: { roomCode: string }) {
  const searchParams = useSearchParams();
  const { joinRoom, lastError } = useRoom();
  const [name, setName] = useState(searchParams.get("name") ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (!name.trim()) return;
    setIsSubmitting(true);
    try {
      await joinRoom(name.trim());
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 max-w-sm mx-auto px-4 py-10 text-center">
      <div className="text-[13px] text-ink-faint">Unirte a la sala</div>
      <div className="text-2xl font-bold tracking-widest text-ink">{roomCode}</div>

      <label className="flex flex-col gap-1.5 text-[13px] text-ink-soft text-left">
        Tu nombre
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Ana"
          className="h-10 rounded border border-subtle bg-statusbar text-ink text-sm px-3 focus:outline-none focus:border-accent"
        />
      </label>

      {lastError && <div className="text-[13px] text-danger">{lastError}</div>}

      <Button variant="primary" fullWidth disabled={isSubmitting} onClick={handleSubmit}>
        {isSubmitting ? "Uniéndote..." : "Unirme"}
      </Button>
    </div>
  );
}
