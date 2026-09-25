import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@/types/realtime";

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// En dev, NEXT_PUBLIC_SOCKET_URL apunta directo al server (el proxy de
// `next dev` no hace confiablemente el upgrade de WebSocket). En prod se deja
// vacío para conectar al mismo origen del navegador, donde el reverse proxy
// (Nginx/Caddy) hace el upgrade de wss://dominio/socket.io/*.
export function createSocket(): GameSocket {
  const url = process.env.NEXT_PUBLIC_SOCKET_URL || undefined;
  return io(url, {
    path: "/socket.io",
    autoConnect: false,
    transports: ["websocket", "polling"],
  });
}
