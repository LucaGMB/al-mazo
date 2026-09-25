import { describe, it, expect, vi } from 'vitest';
import { RoomManager } from '../../src/realtime/room-manager.js';

describe('RoomManager & GameRoom Lifecycle', () => {
  it('creates a room with a 5-character alphanumeric PIN and host player', async () => {
    const manager = new RoomManager();
    const { room, reconnectToken } = await manager.createRoom('color-match', {
      id: 'host_1',
      name: 'Alice',
      socketId: 'sock_1',
    });

    expect(room.code).toBeDefined();
    expect(room.code.length).toBe(5);
    expect(reconnectToken).toBeDefined();
    expect(room.hostId).toBe('host_1');
    expect(manager.getRoom(room.code)).toBe(room);
  });

  it('allows second player to join via room code', async () => {
    const manager = new RoomManager();
    const { room } = await manager.createRoom('color-match', {
      id: 'host_1',
      name: 'Alice',
      socketId: 'sock_1',
    });

    const { roomPlayer, reconnectToken } = await manager.joinRoom(room.code, {
      id: 'p2',
      name: 'Bob',
      socketId: 'sock_2',
    });

    expect(roomPlayer.id).toBe('p2');
    expect(roomPlayer.name).toBe('Bob');
    expect(reconnectToken).toBeDefined();
    expect(room.players.size).toBe(2);
  });

  it('adds a bot flagged as isBot in public state', async () => {
    const manager = new RoomManager();
    const { room } = await manager.createRoom('color-match', {
      id: 'host_1',
      name: 'Alice',
      socketId: 'sock_1',
    });

    const bot = room.addBot();

    expect(bot.isBot).toBe(true);
    expect(bot.socketId).toBeNull();
    expect(room.players.size).toBe(2);

    const publicBot = room.getPublicState().players.find((p) => p.id === bot.id);
    expect(publicBot?.isBot).toBe(true);
  });

  it('handles disconnect and reconnect within grace period', async () => {
    vi.useFakeTimers();
    const manager = new RoomManager();
    const { room, reconnectToken } = await manager.createRoom(
      'color-match',
      { id: 'host_1', name: 'Alice', socketId: 'sock_1' },
      { disconnectGraceSeconds: 30 }
    );

    const onTimeoutMock = vi.fn();
    room.handleDisconnect('host_1', onTimeoutMock);

    const player = room.getPlayer('host_1');
    expect(player?.isConnected).toBe(false);
    expect(player?.socketId).toBeNull();

    // Fast-forward 10 seconds (before 30s timeout)
    vi.advanceTimersByTime(10000);
    expect(onTimeoutMock).not.toHaveBeenCalled();

    // Player reconnects with new socket ID and valid reconnectToken
    const reconnected = room.handleReconnect('host_1', 'new_sock_1', reconnectToken);
    expect(reconnected).toBe(true);
    expect(player?.isConnected).toBe(true);
    expect(player?.socketId).toBe('new_sock_1');

    // Fast-forward past original grace window
    vi.advanceTimersByTime(30000);
    expect(onTimeoutMock).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('initializes chatHistory empty for a new room', async () => {
    const manager = new RoomManager();
    const { room } = await manager.createRoom('color-match', {
      id: 'host_1',
      name: 'Alice',
      socketId: 'sock_1',
    });

    expect(room.chatHistory).toEqual([]);
  });

  it('stores chat messages and enforces the 50 message FIFO cap', async () => {
    const manager = new RoomManager();
    const { room } = await manager.createRoom('color-match', {
      id: 'host_1',
      name: 'Alice',
      socketId: 'sock_1',
    });

    for (let i = 0; i < 55; i += 1) {
      room.addChatMessage({
        id: `msg_${i}`,
        senderId: 'host_1',
        senderName: 'Alice',
        text: `message ${i}`,
        timestamp: i,
        isSystem: false,
      });
    }

    expect(room.chatHistory.length).toBe(50);
    // Oldest 5 messages were dropped, newest is kept.
    expect(room.chatHistory[0].text).toBe('message 5');
    expect(room.chatHistory[49].text).toBe('message 54');
  });

  it('triggers onTimeout callback when grace period expires', async () => {
    vi.useFakeTimers();
    const manager = new RoomManager();
    const { room } = await manager.createRoom(
      'color-match',
      { id: 'host_1', name: 'Alice', socketId: 'sock_1' },
      { disconnectGraceSeconds: 15 }
    );

    const onTimeoutMock = vi.fn();
    room.handleDisconnect('host_1', onTimeoutMock);

    // Fast-forward 16 seconds
    vi.advanceTimersByTime(16000);
    expect(onTimeoutMock).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it('startTurnTimer sets turnExpiresAt and invokes the callback on expiry', async () => {
    vi.useFakeTimers();
    const manager = new RoomManager();
    const { room } = await manager.createRoom(
      'color-match',
      { id: 'host_1', name: 'Alice', socketId: 'sock_1' },
      { turnTimeoutSeconds: 10 }
    );

    expect(room.turnTimeoutSeconds).toBe(10);
    expect(room.getPublicState().turnExpiresAt).toBeNull();

    const onTimeoutMock = vi.fn();
    room.startTurnTimer(onTimeoutMock);

    expect(room.turnExpiresAt).toBe(Date.now() + 10000);
    expect(room.getPublicState().turnExpiresAt).toBe(Date.now() + 10000);

    vi.advanceTimersByTime(9000);
    expect(onTimeoutMock).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);
    expect(onTimeoutMock).toHaveBeenCalledTimes(1);
    // Timer callback clears the timer and its expiry.
    expect(room.turnExpiresAt).toBeNull();

    vi.useRealTimers();
  });

  it('clearTurnTimer cancels a pending timer and resets turnExpiresAt', async () => {
    vi.useFakeTimers();
    const manager = new RoomManager();
    const { room } = await manager.createRoom(
      'color-match',
      { id: 'host_1', name: 'Alice', socketId: 'sock_1' },
      { turnTimeoutSeconds: 10 }
    );

    const onTimeoutMock = vi.fn();
    room.startTurnTimer(onTimeoutMock);
    expect(room.turnExpiresAt).not.toBeNull();

    room.clearTurnTimer();
    expect(room.turnExpiresAt).toBeNull();
    expect(room.getPublicState().turnExpiresAt).toBeNull();

    vi.advanceTimersByTime(20000);
    expect(onTimeoutMock).not.toHaveBeenCalled();

    vi.useRealTimers();
  });
});
