export * from '@al-mazo/shared';

export interface RoomPlayer {
  id: string;
  name: string;
  socketId: string | null;
  reconnectToken: string;
  isConnected: boolean;
  isBot: boolean;
  disconnectTimer?: NodeJS.Timeout;
}
