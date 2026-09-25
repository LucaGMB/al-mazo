"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import { createSocket, type GameSocket } from "@/lib/socket/client";
import {
  addBot as addBotAction,
  removeBot as removeBotAction,
  chooseColor as chooseColorAction,
  drawCard as drawCardAction,
  executeGameAction,
  joinRoom as joinRoomAction,
  leaveRoom as leaveRoomAction,
  passTurn as passTurnAction,
  playCard as playCardAction,
  reconnectRoom,
  sendChatMessage as sendChatMessageAction,
  startRoom as startRoomAction,
  waitForConnect,
} from "@/lib/socket/actions";
import {
  clearRoomCredentials,
  getRoomCredentials,
  saveRoomCredentials,
} from "@/lib/room/credentials";
import { encodePlayerName } from "@/lib/room/player-name";
import { buildMatchSyncPayload } from "@/lib/room/match-report";
import { syncMatch } from "@/lib/api/matches";
import { useSession } from "@/lib/session/use-session";
import { soundManager } from "@/lib/sound/sound-manager";
import type { Card, PublicGameState } from "@/types/engine";
import type { ChatMessage, RoomOptions } from "@/types/realtime";

type ConnectionStatus = "idle" | "needs_join" | "connecting" | "connected" | "error";

interface RoomState {
  connection: ConnectionStatus;
  publicState: PublicGameState | null;
  hand: Card[];
  selfPlayerId: string | null;
  isHost: boolean;
  lastError: string | null;
  chatMessages: ChatMessage[];
  // Último mensaje de chat en vivo por jugador, para el globo flotante sobre
  // su avatar. `at` es la hora de recepción en el cliente (expira a los 3s).
  chatBubbles: Record<string, { text: string; at: number }>;
  unreadChatCount: number;
  // Último "te comiste cartas" (DRAW_2/+4 en tu contra). Se limpia solo.
  forcedDraw: { count: number; byName: string; key: number } | null;
}

type Action =
  | { type: "NEEDS_JOIN" }
  | { type: "CONNECTING" }
  | {
      type: "CONNECTED";
      selfPlayerId: string;
      isHost: boolean;
      publicState: PublicGameState | null;
      hand: Card[];
    }
  | { type: "ROOM_STATE"; state: PublicGameState }
  | { type: "HAND"; hand: Card[] }
  | { type: "CHAT_MESSAGE"; message: ChatMessage; at: number }
  | { type: "CHAT_BUBBLE_EXPIRE"; senderId: string; at: number }
  | { type: "CHAT_HISTORY"; messages: ChatMessage[] }
  | { type: "CLEAR_UNREAD_CHAT" }
  | { type: "ERROR"; message: string }
  | { type: "FORCED_DRAW"; count: number; byName: string; key: number }
  | { type: "FORCED_DRAW_CLEAR"; key: number };

function reducer(state: RoomState, action: Action): RoomState {
  switch (action.type) {
    case "NEEDS_JOIN":
      return { ...state, connection: "needs_join" };
    case "CONNECTING":
      return { ...state, connection: "connecting", lastError: null };
    case "CONNECTED":
      return {
        ...state,
        connection: "connected",
        selfPlayerId: action.selfPlayerId,
        isHost: action.isHost,
        publicState: action.publicState ?? state.publicState,
        hand: action.hand,
        lastError: null,
      };
    case "ROOM_STATE":
      return { ...state, publicState: action.state };
    case "HAND":
      return { ...state, hand: action.hand };
    case "CHAT_MESSAGE":
      return {
        ...state,
        chatMessages: [...state.chatMessages, action.message].slice(-50),
        chatBubbles: action.message.isSystem
          ? state.chatBubbles
          : {
              ...state.chatBubbles,
              [action.message.senderId]: { text: action.message.text, at: action.at },
            },
        unreadChatCount: state.unreadChatCount + 1,
      };
    case "CHAT_BUBBLE_EXPIRE": {
      if (state.chatBubbles[action.senderId]?.at !== action.at) return state;
      const chatBubbles = { ...state.chatBubbles };
      delete chatBubbles[action.senderId];
      return { ...state, chatBubbles };
    }
    case "CHAT_HISTORY":
      return { ...state, chatMessages: action.messages.slice(-50) };
    case "CLEAR_UNREAD_CHAT":
      return { ...state, unreadChatCount: 0 };
    case "ERROR":
      return { ...state, connection: "error", lastError: action.message };
    case "FORCED_DRAW":
      return {
        ...state,
        forcedDraw: { count: action.count, byName: action.byName, key: action.key },
      };
    case "FORCED_DRAW_CLEAR":
      if (state.forcedDraw?.key !== action.key) return state;
      return { ...state, forcedDraw: null };
    default:
      return state;
  }
}

const initialState: RoomState = {
  connection: "idle",
  publicState: null,
  hand: [],
  selfPlayerId: null,
  isHost: false,
  lastError: null,
  chatMessages: [],
  chatBubbles: {},
  unreadChatCount: 0,
  forcedDraw: null,
};

// Cuánto queda visible el aviso de "te comiste cartas" (ver FORCED_DRAW_TOAST_TTL_MS).
const FORCED_DRAW_TOAST_TTL_MS = 3200;

// Vida del globo de chat sobre el avatar (la animación bubble-pop dura 2.8s).
const CHAT_BUBBLE_TTL_MS = 3000;

interface RoomContextValue extends RoomState {
  joinRoom: (playerName: string) => Promise<void>;
  startRoom: () => Promise<void>;
  addBot: (name?: string) => Promise<void>;
  removeBot: (botId?: string) => Promise<void>;
  playCard: (cardId: string, chosenColor?: string, isTapada?: boolean) => Promise<void>;
  drawCard: () => Promise<void>;
  chooseColor: (color: string) => Promise<void>;
  passTurn: () => Promise<void>;
  leaveRoom: () => Promise<void>;
  sendChatMessage: (text: string) => Promise<void>;
  clearUnreadChat: () => void;
  executeAction: (action: string, payload?: Record<string, unknown>) => Promise<unknown>;
}

export const RoomContext = createContext<RoomContextValue | null>(null);

export function RoomProvider({
  gameSlug,
  roomCode,
  children,
}: {
  gameSlug: string;
  roomCode: string;
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const socketRef = useRef<GameSocket | null>(null);
  const matchStartedAtRef = useRef<string | null>(null);
  const matchReportedRef = useRef(false);
  // Espejo del último PublicGameState recibido, leído dentro del handler de
  // game:finished. No podemos leer `state.publicState` ahí porque los
  // listeners se registran una sola vez (ver el efecto de abajo) y quedarían
  // atados al closure del render en que se adjuntaron, siempre viejo.
  const publicStateRef = useRef<PublicGameState | null>(null);
  // Mismo motivo que publicStateRef: los listeners se registran una sola vez,
  // así que necesitamos un ref para saber quién es "yo" al decidir si suena el
  // aviso de chat (no suena en los mensajes propios).
  const selfPlayerIdRef = useRef<string | null>(null);
  const { createGuest, user } = useSession();

  const attachRoomListeners = useCallback(
    (socket: GameSocket) => {
      socket.on("room:state", (roomState) => {
        publicStateRef.current = roomState;
        dispatch({ type: "ROOM_STATE", state: roomState });
      });
      socket.on("player:hand", (hand) => dispatch({ type: "HAND", hand }));
      socket.on("game:started", () => {
        matchStartedAtRef.current = new Date().toISOString();
        matchReportedRef.current = false;
      });
      socket.on("game:finished", () => {
        const creds = getRoomCredentials(roomCode);
        if (!creds?.isHost || matchReportedRef.current) return;
        const currentState = publicStateRef.current;
        if (!currentState || !matchStartedAtRef.current) return;
        matchReportedRef.current = true;
        const payload = buildMatchSyncPayload({
          gameSlug,
          startedAt: matchStartedAtRef.current,
          state: currentState,
        });
        syncMatch(payload).catch((err) => {
          console.error("No se pudo reportar la partida a /api/matches/sync", err);
        });
      });
      socket.on("chat:message", (msg) => {
        const at = Date.now();
        dispatch({ type: "CHAT_MESSAGE", message: msg, at });
        if (msg.senderId !== selfPlayerIdRef.current) {
          soundManager.play("chat");
        }
        // El globo sobre el avatar expira solo; si llega otro mensaje del
        // mismo jugador antes, el `at` viejo no coincide y no se borra.
        window.setTimeout(() => {
          dispatch({ type: "CHAT_BUBBLE_EXPIRE", senderId: msg.senderId, at });
        }, CHAT_BUBBLE_TTL_MS);
      });
      socket.on("chat:history", (messages) => dispatch({ type: "CHAT_HISTORY", messages }));
      socket.on("error:notification", ({ message }) => dispatch({ type: "ERROR", message }));
      socket.on("player:forced_draw", ({ count, byName }) => {
        const key = Date.now();
        dispatch({ type: "FORCED_DRAW", count, byName, key });
        soundManager.play("forcedDraw");
        window.setTimeout(() => dispatch({ type: "FORCED_DRAW_CLEAR", key }), FORCED_DRAW_TOAST_TTL_MS);
      });
    },
    [gameSlug, roomCode],
  );

  useEffect(() => {
    const creds = getRoomCredentials(roomCode);
    if (!creds) {
      dispatch({ type: "NEEDS_JOIN" });
      return;
    }

    const socket = createSocket();
    socketRef.current = socket;
    dispatch({ type: "CONNECTING" });
    attachRoomListeners(socket);

    socket.on("connect", () => {
      reconnectRoom(socket, {
        roomCode,
        playerId: creds.playerId,
        reconnectToken: creds.reconnectToken,
      }).then((res) => {
        if (res.success) {
          publicStateRef.current = res.state ?? null;
          selfPlayerIdRef.current = creds.playerId;
          dispatch({
            type: "CONNECTED",
            selfPlayerId: creds.playerId,
            isHost: creds.isHost,
            publicState: res.state ?? null,
            hand: res.hand ?? [],
          });
        } else {
          clearRoomCredentials(roomCode);
          dispatch({ type: "ERROR", message: res.error ?? "No se pudo reconectar a la sala" });
        }
      });
    });

    socket.connect();

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomCode, attachRoomListeners]);

  const joinRoom = useCallback(
    async (playerName: string) => {
      dispatch({ type: "CONNECTING" });
      const guest = user ?? (await createGuest(playerName));

      const socket = createSocket();
      socketRef.current = socket;
      attachRoomListeners(socket);
      socket.connect();
      await waitForConnect(socket);

      const res = await joinRoomAction(socket, {
        roomCode,
        playerName: encodePlayerName(playerName, guest.id),
      });

      if (!res.success || !res.playerId || !res.reconnectToken) {
        dispatch({ type: "ERROR", message: res.error ?? "No se pudo unir a la sala" });
        socket.disconnect();
        return;
      }

      saveRoomCredentials(roomCode, {
        gameSlug,
        playerId: res.playerId,
        reconnectToken: res.reconnectToken,
        isHost: false,
      });

      selfPlayerIdRef.current = res.playerId;
      dispatch({
        type: "CONNECTED",
        selfPlayerId: res.playerId,
        isHost: false,
        publicState: null,
        hand: [],
      });
    },
    [attachRoomListeners, createGuest, gameSlug, roomCode, user],
  );

  const withSocket = useCallback(
    async <T,>(fn: (socket: GameSocket) => Promise<{ success: boolean; error?: string } & T>) => {
      const socket = socketRef.current;
      if (!socket) return;
      const res = await fn(socket);
      if (!res.success && res.error) {
        dispatch({ type: "ERROR", message: res.error });
      }
    },
    [],
  );

  const startRoom = useCallback(() => withSocket((s) => startRoomAction(s)), [withSocket]);
  const addBot = useCallback(
    (name?: string) => withSocket((s) => addBotAction(s, { name })),
    [withSocket],
  );
  const drawCard = useCallback(() => withSocket((s) => drawCardAction(s)), [withSocket]);
  const passTurn = useCallback(() => withSocket((s) => passTurnAction(s)), [withSocket]);
  const chooseColor = useCallback(
    (color: string) => withSocket((s) => chooseColorAction(s, { color })),
    [withSocket],
  );
  const removeBot = useCallback(
    (botId?: string) => withSocket((s) => removeBotAction(s, { botId })),
    [withSocket],
  );
  const playCard = useCallback(
    (cardId: string, chosenColor?: string, isTapada?: boolean) =>
      withSocket((s) => playCardAction(s, { cardId, chosenColor, isTapada })),
    [withSocket],
  );

  const executeAction = useCallback(
    async (action: string, payload?: Record<string, unknown>) => {
      const socket = socketRef.current;
      if (!socket) return;
      const res = await executeGameAction(socket, { action, payload });
      if (!res.success && res.error) {
        dispatch({ type: "ERROR", message: res.error });
        throw new Error(res.error);
      }
      return res.result;
    },
    [],
  );
  const leaveRoom = useCallback(async () => {
    const socket = socketRef.current;
    if (!socket) return;
    await leaveRoomAction(socket);
    clearRoomCredentials(roomCode);
  }, [roomCode]);

  const sendChatMessage = useCallback((text: string) => {
    const socket = socketRef.current;
    if (!socket) return Promise.resolve();
    return sendChatMessageAction(socket, text).then((res) => {
      if (!res.success && res.error) {
        dispatch({ type: "ERROR", message: res.error });
      }
    });
  }, []);

  const clearUnreadChat = useCallback(() => dispatch({ type: "CLEAR_UNREAD_CHAT" }), []);

  return (
    <RoomContext.Provider
      value={{
        ...state,
        joinRoom,
        startRoom,
        addBot,
        removeBot,
        playCard,
        drawCard,
        chooseColor,
        passTurn,
        leaveRoom,
        sendChatMessage,
        clearUnreadChat,
        executeAction,
      }}
    >
      {children}
    </RoomContext.Provider>
  );
}

// Opciones de sala expuestas como avanzadas/opcionales en el form de creación.
export const DISCONNECT_POLICIES: { value: NonNullable<RoomOptions["disconnectPolicy"]>; label: string }[] = [
  { value: "DISCARD_AND_CONTINUE", label: "Descartar su turno y continuar" },
  { value: "AUTO_PASS", label: "Pasar su turno automáticamente" },
  { value: "ABORT_MATCH", label: "Cancelar la partida" },
];
