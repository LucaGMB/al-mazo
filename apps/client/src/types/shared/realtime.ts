import type {
  Card,
  DrawStackConfig,
  FinishOnSpecialCardRule,
  PublicGameState,
} from './engine.js';

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

export type DisconnectPolicy =
  | 'DISCARD_AND_CONTINUE'
  | 'AUTO_PASS'
  | 'ABORT_MATCH';

export type ColorMatchMode = 'CLASSIC' | 'BLITZ' | 'CHAOS';

export interface RoomOptions {
  disconnectGraceSeconds?: number;
  disconnectPolicy?: DisconnectPolicy;
  turnTimeoutSeconds?: number;
  drawStack?: DrawStackConfig;
  colorMatchMode?: ColorMatchMode;
  targetScore?: number;
  finishOnSpecialCard?: FinishOnSpecialCardRule;
}

export interface ClientToServerEvents {
  'room:create': (
    data: { gameSlug: string; playerName: string; options?: RoomOptions },
    callback: (res: {
      success: boolean;
      roomCode?: string;
      playerId?: string;
      reconnectToken?: string;
      error?: string;
    }) => void
  ) => void;

  'room:join': (
    data: { roomCode: string; playerName: string },
    callback: (res: {
      success: boolean;
      playerId?: string;
      reconnectToken?: string;
      error?: string;
    }) => void
  ) => void;

  'room:reconnect': (
    data: { roomCode: string; playerId: string; reconnectToken: string },
    callback: (res: {
      success: boolean;
      state?: PublicGameState;
      hand?: Card[];
      error?: string;
    }) => void
  ) => void;

  'room:start': (
    callback: (res: { success: boolean; error?: string }) => void
  ) => void;

  'room:add_bot': (
    data: { name?: string },
    callback: (res: { success: boolean; playerId?: string; error?: string }) => void
  ) => void;

  'room:remove_bot': (
    data: { botId?: string },
    callback: (res: { success: boolean; playerId?: string; error?: string }) => void
  ) => void;

  'game:play_card': (
    data: { cardId: string; chosenColor?: string },
    callback: (res: { success: boolean; error?: string }) => void
  ) => void;

  'game:draw_card': (
    callback: (res: { success: boolean; card?: Card; error?: string }) => void
  ) => void;

  'game:choose_color': (
    data: { color: string },
    callback: (res: { success: boolean; error?: string }) => void
  ) => void;

  'game:pass_turn': (
    callback: (res: { success: boolean; error?: string }) => void
  ) => void;

  'room:leave': (callback: (res: { success: boolean }) => void) => void;

  'game:action': (
    data: { action: string; payload?: unknown },
    callback: (response: { success: boolean; error?: string; result?: unknown }) => void
  ) => void;

  'chat:send': (
    data: { text: string },
    callback: (res: { success: boolean; error?: string }) => void
  ) => void;
}

export interface ServerToClientEvents {
  'room:state': (state: PublicGameState) => void;
  'player:hand': (hand: Card[]) => void;
  'player:joined': (player: { id: string; name: string }) => void;
  'player:left': (data: { playerId: string; name: string }) => void;
  'player:disconnected': (data: { playerId: string; graceSeconds: number }) => void;
  'player:reconnected': (data: { playerId: string }) => void;
  'game:started': () => void;
  'game:finished': (data: { winnerId: string | null }) => void;
  'error:notification': (data: { message: string }) => void;
  'player:forced_draw': (data: { count: number; byName: string }) => void;
  'chat:message': (message: ChatMessage) => void;
  'chat:history': (messages: ChatMessage[]) => void;
}
