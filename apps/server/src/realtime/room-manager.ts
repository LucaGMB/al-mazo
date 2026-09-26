import { customAlphabet } from 'nanoid';
import { GameRoom } from './room.js';
import { RoomOptions, RoomPlayer } from './types.js';
import { resolveGameDefinition } from '../games/resolver.js';
import { redis } from '../db/redis.js';

// 5-character readable alphanumeric code (excluding ambiguous 0, O, 1, I)
const generateCode = customAlphabet('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', 5);

export class RoomManager {
  private rooms: Map<string, GameRoom> = new Map();

  public async createRoom(
    gameSlug: string,
    host: { id: string; name: string; socketId: string },
    options?: RoomOptions
  ): Promise<{ room: GameRoom; reconnectToken: string }> {
    const definition = await resolveGameDefinition(gameSlug);
    if (!definition) {
      throw new Error(`Game '${gameSlug}' not found`);
    }

    let code: string;
    let attempts = 0;
    do {
      code = generateCode();
      attempts++;
    } while (this.rooms.has(code) && attempts < 10);

    const reconnectToken = `token_${code}_${host.id}_${Date.now()}`;
    const room = new GameRoom(
      code,
      definition,
      {
        id: host.id,
        name: host.name,
        socketId: host.socketId,
        reconnectToken,
      },
      options
    );

    this.rooms.set(code, room);

    // Save room code mapping in Redis for quick presence lookup with 2 hours TTL
    await redis.set(`room:${code}`, JSON.stringify({ gameSlug, hostId: host.id }), 7200);

    return { room, reconnectToken };
  }

  public async joinRoom(
    code: string,
    player: { id: string; name: string; socketId: string }
  ): Promise<{ room: GameRoom; roomPlayer: RoomPlayer; reconnectToken: string }> {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) {
      throw new Error(`Room with code '${code}' does not exist`);
    }

    const reconnectToken = `token_${code}_${player.id}_${Date.now()}`;
    const roomPlayer = room.addPlayer(
      player.id,
      player.name,
      player.socketId,
      reconnectToken
    );

    return { room, roomPlayer, reconnectToken };
  }

  public getRoom(code: string): GameRoom | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  public getRoomBySocketId(socketId: string): { room: GameRoom; player: RoomPlayer } | undefined {
    for (const room of this.rooms.values()) {
      const player = room.getPlayerBySocketId(socketId);
      if (player) {
        return { room, player };
      }
    }
    return undefined;
  }

  public async deleteRoom(code: string): Promise<void> {
    const uppercaseCode = code.toUpperCase();
    const room = this.rooms.get(uppercaseCode);
    if (room) {
      room.dispose();
      this.rooms.delete(uppercaseCode);
      await redis.del(`room:${uppercaseCode}`);
    }
  }

  public getActiveRoomCount(): number {
    return this.rooms.size;
  }
}

export const roomManager = new RoomManager();
