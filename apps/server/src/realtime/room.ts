import { ModularGameEngine } from '../engine/modular-engine.js';
import { GameSchemaDefinition, PublicGameState, Card } from '../engine/types.js';
import { getColorMatchDefinition } from '../games/color-match/definition.js';
import { ChatMessage, DisconnectPolicy, RoomOptions, RoomPlayer } from './types.js';

export class GameRoom {
  public readonly code: string;
  public readonly gameSlug: string;
  public readonly hostId: string;
  public readonly disconnectGraceSeconds: number;
  public readonly disconnectPolicy: DisconnectPolicy;
  public turnTimeoutSeconds: number;
  public turnExpiresAt: number | null = null;
  public turnTimer?: NodeJS.Timeout;
  public readonly definition: GameSchemaDefinition;
  public readonly engine: ModularGameEngine;
  public readonly players: Map<string, RoomPlayer> = new Map();
  public readonly createdAt: Date = new Date();
  public chatHistory: ChatMessage[] = [];
  public botTimer?: NodeJS.Timeout;
  private botCounter = 0;

  constructor(
    code: string,
    definition: GameSchemaDefinition,
    hostPlayer: { id: string; name: string; socketId: string; reconnectToken: string },
    options?: RoomOptions
  ) {
    this.code = code;
    this.gameSlug = definition.slug;
    this.hostId = hostPlayer.id;
    this.disconnectGraceSeconds = options?.disconnectGraceSeconds ?? 60;
    this.disconnectPolicy = options?.disconnectPolicy ?? 'DISCARD_AND_CONTINUE';
    this.turnTimeoutSeconds =
      options?.turnTimeoutSeconds ?? definition.rules.turnTimeoutSeconds ?? 25;
    let baseDef = definition;
    if (
      (definition.slug === 'color-match' || definition.slug === 'color-match-blitz' || definition.slug === 'color-match-chaos') &&
      (options?.colorMatchMode || definition.slug.includes('blitz') || definition.slug.includes('chaos'))
    ) {
      const mode =
        options?.colorMatchMode ??
        (definition.slug.includes('blitz') ? 'BLITZ' : definition.slug.includes('chaos') ? 'CHAOS' : 'CLASSIC');
      baseDef = getColorMatchDefinition(mode);
    }

    const effectiveRules = {
      ...baseDef.rules,
      // Editor schemas may omit effects; keep GameRoom.definition valid for all
      // consumers (bots, action checks), mirroring the engine normalization.
      effects: baseDef.rules.effects ?? {},
      ...(options?.drawStack ? { drawStack: options.drawStack } : {}),
      customState: {
        ...(baseDef.rules.customState ?? {}),
        ...(options?.colorMatchMode ? { colorMatchMode: options.colorMatchMode } : {}),
      },
    };
    const effectiveDefinition = {
      ...baseDef,
      rules: effectiveRules,
    };
    this.definition = effectiveDefinition;
    this.engine = new ModularGameEngine(effectiveDefinition);

    this.addPlayer(hostPlayer.id, hostPlayer.name, hostPlayer.socketId, hostPlayer.reconnectToken);
  }

  public addPlayer(
    id: string,
    name: string,
    socketId: string | null,
    reconnectToken: string,
    isBot = false
  ): RoomPlayer {
    this.engine.addPlayer(id, name, isBot);

    const player: RoomPlayer = {
      id,
      name,
      socketId,
      reconnectToken,
      isConnected: socketId !== null,
      isBot,
    };

    this.players.set(id, player);
    return player;
  }

  public addBot(name?: string): RoomPlayer {
    this.botCounter += 1;
    const id = `bot_${this.botCounter}`;
    return this.addPlayer(id, name ?? `Bot ${this.botCounter}`, null, `bot_token_${id}`, true);
  }

  public removeBot(botId?: string): RoomPlayer {
    if (this.engine.getPublicState().status !== 'LOBBY') {
      throw new Error('Solo se pueden remover bots antes de iniciar la partida');
    }
    let target: RoomPlayer | undefined;
    if (botId) {
      target = this.players.get(botId);
    } else {
      const bots = Array.from(this.players.values()).filter((p) => p.isBot);
      target = bots[bots.length - 1];
    }
    if (!target || !target.isBot) {
      throw new Error('Bot no encontrado en la sala');
    }
    this.removePlayer(target.id);
    return target;
  }

  public getPlayerBySocketId(socketId: string): RoomPlayer | undefined {
    for (const player of this.players.values()) {
      if (player.socketId === socketId) return player;
    }
    return undefined;
  }

  public getPlayer(id: string): RoomPlayer | undefined {
    return this.players.get(id);
  }

  public handleDisconnect(
    playerId: string,
    onTimeout: (room: GameRoom, player: RoomPlayer) => void
  ): void {
    const player = this.players.get(playerId);
    if (!player) return;

    player.isConnected = false;
    player.socketId = null;
    this.engine.setPlayerConnection(playerId, false);

    // Clear any previous timer
    if (player.disconnectTimer) {
      clearTimeout(player.disconnectTimer);
    }

    // Start grace timer
    player.disconnectTimer = setTimeout(() => {
      onTimeout(this, player);
    }, this.disconnectGraceSeconds * 1000);
  }

  public handleReconnect(playerId: string, socketId: string, reconnectToken: string): boolean {
    const player = this.players.get(playerId);
    if (!player || player.reconnectToken !== reconnectToken) {
      return false;
    }

    if (player.disconnectTimer) {
      clearTimeout(player.disconnectTimer);
      player.disconnectTimer = undefined;
    }

    player.isConnected = true;
    player.socketId = socketId;
    this.engine.setPlayerConnection(playerId, true);
    return true;
  }

  public removePlayer(playerId: string): void {
    const player = this.players.get(playerId);
    if (player?.disconnectTimer) {
      clearTimeout(player.disconnectTimer);
    }

    this.players.delete(playerId);
    this.engine.removePlayer(
      playerId,
      this.disconnectPolicy === 'ABORT_MATCH' ? 'ABORT_MATCH' : 'DISCARD_AND_CONTINUE'
    );
  }

  public addChatMessage(msg: ChatMessage): void {
    this.chatHistory.push(msg);
    if (this.chatHistory.length > 50) {
      this.chatHistory.shift();
    }
  }

  public getPublicState(): PublicGameState {
    return { ...this.engine.getPublicState(), turnExpiresAt: this.turnExpiresAt };
  }

  public clearTurnTimer(): void {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = undefined;
    }
    this.turnExpiresAt = null;
  }

  public startTurnTimer(onTimeout: () => void): void {
    this.clearTurnTimer();
    // A turn timeout of 0 disables the inactivity auto-pass (conversation games
    // where players answer at their own pace).
    if (this.turnTimeoutSeconds <= 0) return;
    this.turnExpiresAt = Date.now() + this.turnTimeoutSeconds * 1000;
    this.turnTimer = setTimeout(() => {
      this.clearTurnTimer();
      onTimeout();
    }, this.turnTimeoutSeconds * 1000);
  }

  public getPlayerHand(playerId: string): Card[] {
    return this.engine.getPlayerHand(playerId);
  }

  public dispose(): void {
    this.clearTurnTimer();
    if (this.botTimer) {
      clearTimeout(this.botTimer);
      this.botTimer = undefined;
    }
    for (const player of this.players.values()) {
      if (player.disconnectTimer) {
        clearTimeout(player.disconnectTimer);
      }
    }
    this.players.clear();
  }
}
