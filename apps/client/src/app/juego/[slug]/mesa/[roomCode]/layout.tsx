"use client";

import { useParams } from "next/navigation";
import { RoomProvider } from "@/lib/room/room-context";

// La conexión de socket vive acá (no en el layout raíz): se crea al entrar a
// una sala y se cierra al salir de ella, en vez de mantenerse abierta
// mientras se navega el catálogo.
export default function MesaRoomLayout({ children }: { children: React.ReactNode }) {
  const { slug, roomCode } = useParams<{ slug: string; roomCode: string }>();

  return (
    <RoomProvider gameSlug={slug} roomCode={roomCode.toUpperCase()}>
      {children}
    </RoomProvider>
  );
}
