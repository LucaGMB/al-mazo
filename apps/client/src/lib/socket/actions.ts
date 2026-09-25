// Wrappers tipados en forma de Promise sobre los emit-con-callback (ack) de
// Socket.io. Un wrapper por evento en vez de un helper genérico variádico:
// más código pero sin trucos de tipado que rompan el chequeo estricto.

import type { GameSocket } from "./client";
import type { RoomOptions } from "@/types/realtime";
import type { Card } from "@/types/engine";

export function createRoom(
  socket: GameSocket,
  data: { gameSlug: string; playerName: string; options?: RoomOptions },
) {
  return new Promise<{
    success: boolean;
    roomCode?: string;
    playerId?: string;
    reconnectToken?: string;
    error?: string;
  }>((resolve) => socket.emit("room:create", data, resolve));
}

export function joinRoom(socket: GameSocket, data: { roomCode: string; playerName: string }) {
  return new Promise<{
    success: boolean;
    playerId?: string;
    reconnectToken?: string;
    error?: string;
  }>((resolve) => socket.emit("room:join", data, resolve));
}

export function reconnectRoom(
  socket: GameSocket,
  data: { roomCode: string; playerId: string; reconnectToken: string },
) {
  return new Promise<{
    success: boolean;
    state?: import("@/types/engine").PublicGameState;
    hand?: Card[];
    error?: string;
  }>((resolve) => socket.emit("room:reconnect", data, resolve));
}

export function startRoom(socket: GameSocket) {
  return new Promise<{ success: boolean; error?: string }>((resolve) =>
    socket.emit("room:start", resolve),
  );
}

export function addBot(socket: GameSocket, data: { name?: string } = {}) {
  return new Promise<{ success: boolean; playerId?: string; error?: string }>((resolve) =>
    socket.emit("room:add_bot", data, resolve),
  );
}

export function removeBot(socket: GameSocket, data: { botId?: string } = {}) {
  return new Promise<{ success: boolean; playerId?: string; error?: string }>((resolve) =>
    socket.emit("room:remove_bot", data, resolve),
  );
}

export function playCard(
  socket: GameSocket,
  data: { cardId: string; chosenColor?: string; isTapada?: boolean }
) {
  return new Promise<{ success: boolean; error?: string }>((resolve) =>
    socket.emit("game:play_card", data, resolve),
  );
}

export function executeGameAction(
  socket: GameSocket,
  data: { action: string; payload?: unknown }
) {
  return new Promise<{ success: boolean; result?: unknown; error?: string }>((resolve) =>
    socket.emit("game:action", data, resolve),
  );
}

export function drawCard(socket: GameSocket) {
  return new Promise<{ success: boolean; card?: Card; error?: string }>((resolve) =>
    socket.emit("game:draw_card", resolve),
  );
}

export function chooseColor(socket: GameSocket, data: { color: string }) {
  return new Promise<{ success: boolean; error?: string }>((resolve) =>
    socket.emit("game:choose_color", data, resolve),
  );
}

export function passTurn(socket: GameSocket) {
  return new Promise<{ success: boolean; error?: string }>((resolve) =>
    socket.emit("game:pass_turn", resolve),
  );
}

export function leaveRoom(socket: GameSocket) {
  return new Promise<{ success: boolean }>((resolve) => socket.emit("room:leave", resolve));
}

export function sendChatMessage(socket: GameSocket, text: string) {
  return new Promise<{ success: boolean; error?: string }>((resolve) =>
    socket.emit("chat:send", { text }, resolve),
  );
}

export function waitForConnect(socket: GameSocket): Promise<void> {
  if (socket.connected) return Promise.resolve();
  return new Promise((resolve) => socket.once("connect", () => resolve()));
}
