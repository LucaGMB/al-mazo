import { Server as HttpServer } from 'node:http';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { redis } from '../db/redis.js';
import { roomManager } from './room-manager.js';
import { GameRoom } from './room.js';
import { ChatMessage, ClientToServerEvents, ServerToClientEvents } from './types.js';
import { decideBotMove } from '../engine/bot.js';
import { ModularGameEngine } from '../engine/modular-engine.js';
import { TrucoEngine } from '../games/truco/truco-engine.js';

const BOT_MIN_DELAY_MS = 800;
const BOT_MAX_DELAY_MS = 1200;

type IoServer = Server<ClientToServerEvents, ServerToClientEvents>;

function emitSystemChat(io: IoServer, room: GameRoom, text: string): void {
  const msg: ChatMessage = {
    id: `sys_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    senderId: 'system',
    senderName: 'Al Mazo',
    text,
    timestamp: Date.now(),
    isSystem: true,
  };
  room.addChatMessage(msg);
  io.to(room.code).emit('chat:message', msg);
}

function emitGameFinished(io: IoServer, room: GameRoom, winnerId: string | null): void {
  io.to(room.code).emit('game:finished', { winnerId });
  const winner = winnerId ? room.getPlayer(winnerId) : undefined;
  emitSystemChat(io, room, `¡Partida finalizada! Ganador: ${winner?.name ?? 'desconocido'}`);
}

/**
 * If the current turn belongs to a bot, schedule its move after a
 * human-like 800-1200ms delay.
 */
function scheduleBotTurn(io: IoServer, room: GameRoom): void {
  if (room.botTimer) {
    clearTimeout(room.botTimer);
    room.botTimer = undefined;
  }

  const state = room.getPublicState();
  if (state.status !== 'IN_PROGRESS') return;

  const current = state.players.find((p) => p.id === state.currentTurnPlayerId);
  if (!current?.isBot) return;

  const delay =
    BOT_MIN_DELAY_MS + Math.floor(Math.random() * (BOT_MAX_DELAY_MS - BOT_MIN_DELAY_MS + 1));

  room.botTimer = setTimeout(() => {
    room.botTimer = undefined;
    playBotTurn(io, room);
  }, delay);
}

/**
 * Clears any pending bot/turn timer and starts the right one for whoever
 * currently holds the turn: a bot delay for bots, an inactivity timeout for
 * humans (which also broadcasts the new turnExpiresAt).
 */
function scheduleTurnLifecycle(io: IoServer, room: GameRoom): void {
  room.clearTurnTimer();
  if (room.botTimer) {
    clearTimeout(room.botTimer);
    room.botTimer = undefined;
  }

  const state = room.getPublicState();
  if (state.status !== 'IN_PROGRESS') return;

  const current = state.players.find((p) => p.id === state.currentTurnPlayerId);
  if (!current) return;

  if (current.isBot) {
    scheduleBotTurn(io, room);
  } else {
    room.startTurnTimer(() => {
      handleHumanTurnTimeout(io, room, current.id);
    });
    io.to(room.code).emit('room:state', room.getPublicState());
  }
}

function handleHumanTurnTimeout(io: IoServer, room: GameRoom, timedOutPlayerId: string): void {
  const state = room.getPublicState();
  if (state.status !== 'IN_PROGRESS' || state.currentTurnPlayerId !== timedOutPlayerId) return;
  const player = room.getPlayer(timedOutPlayerId);
  if (!player) return;

  if (room.engine instanceof TrucoEngine) {
    try {
      const hand = room.getPlayerHand(timedOutPlayerId);
      if (hand.length > 0) {
        room.engine.playCard(timedOutPlayerId, hand[0].id);
      }
    } catch {
      // turn already resolved elsewhere; nothing left to do
    }
  } else {
    const modularEngine = room.engine as ModularGameEngine;
    try {
      if (state.pendingChoice && state.pendingChoice.playerId === timedOutPlayerId) {
        const defaultChoice = room.definition.slug === 'descarte-criollo' ? 'ESPADAS' : 'RED';
        modularEngine.chooseColor(timedOutPlayerId, defaultChoice);
      } else {
        modularEngine.drawCard(timedOutPlayerId);
        modularEngine.passTurn(timedOutPlayerId);
      }
    } catch {
      try {
        modularEngine.passTurn(timedOutPlayerId);
      } catch {
        // turn already resolved elsewhere; nothing left to do
      }
    }
  }

  emitSystemChat(io, room, `⏳ ${player.name} agotó su tiempo (pase automático)`);
  const newState = room.getPublicState();
  io.to(room.code).emit('room:state', newState);

  if (player.socketId) {
    const hand = room.getPlayerHand(player.id);
    io.to(player.socketId).emit('player:hand', hand);
    io.to(player.socketId).emit('error:notification', { message: 'Se agotó tu tiempo de turno' });
  }

  if (newState.status === 'FINISHED') {
    emitGameFinished(io, room, newState.winnerId);
  } else {
    scheduleTurnLifecycle(io, room);
  }
}

function playBotTurn(io: IoServer, room: GameRoom): void {
  const state = room.getPublicState();
  if (state.status !== 'IN_PROGRESS') return;

  const botId = state.currentTurnPlayerId;
  if (!botId) return;
  const bot = room.getPlayer(botId);
  if (!bot?.isBot) return;

  try {
    if (room.engine instanceof TrucoEngine) {
      room.engine.executeBotTurn(botId);
      for (const p of room.players.values()) {
        if (p.socketId) {
          io.to(p.socketId).emit('player:hand', room.getPlayerHand(p.id));
        }
      }
    } else {
      const modularEngine = room.engine as ModularGameEngine;
      const hand = room.getPlayerHand(botId);
      const move = decideBotMove(
        hand,
        state.topDiscardCard,
        state.activeColor,
        room.definition.rules
      );

      if (move) {
        modularEngine.playCard(botId, move.cardId, move.chosenColor);
      } else {
        modularEngine.drawCard(botId);
        modularEngine.passTurn(botId);
      }
    }
  } catch (err: unknown) {
    // ponytail: a bot error is logged, not fatal; humans can keep playing.
    io.to(room.code).emit('error:notification', {
      message: err instanceof Error ? err.message : 'Bot failed to move',
    });
    return;
  }

  const newState = room.getPublicState();
  io.to(room.code).emit('room:state', newState);

  if (newState.status === 'FINISHED') {
    emitGameFinished(io, room, newState.winnerId);
  } else {
    scheduleTurnLifecycle(io, room);
  }
}

export function initializeSocketServer(
  httpServer: HttpServer,
  corsOrigin: string = '*'
): Server<ClientToServerEvents, ServerToClientEvents> {
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: corsOrigin === '*' ? true : corsOrigin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Attach Redis adapter if Redis is available
  try {
    const pubClient = redis.getClient();
    const subClient = pubClient.duplicate();
    io.adapter(createAdapter(pubClient, subClient));
  } catch {
    // Falls back to in-memory adapter gracefully
  }

  io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
    // 1. Create Room
    socket.on('room:create', async ({ gameSlug, playerName, options }, callback) => {
      try {
        const playerId = `usr_${socket.id.slice(0, 8)}`;
        const { room, reconnectToken } = await roomManager.createRoom(
          gameSlug,
          { id: playerId, name: playerName, socketId: socket.id },
          options
        );

        socket.join(room.code);

        callback({
          success: true,
          roomCode: room.code,
          playerId,
          reconnectToken,
        });

        io.to(room.code).emit('room:state', room.getPublicState());
      } catch (err: unknown) {
        callback({
          success: false,
          error: err instanceof Error ? err.message : 'Failed to create room',
        });
      }
    });

    // 2. Join Room
    socket.on('room:join', async ({ roomCode, playerName }, callback) => {
      try {
        const playerId = `usr_${socket.id.slice(0, 8)}`;
        const { room, roomPlayer, reconnectToken } = await roomManager.joinRoom(
          roomCode,
          { id: playerId, name: playerName, socketId: socket.id }
        );

        socket.join(room.code);

        callback({
          success: true,
          playerId: roomPlayer.id,
          reconnectToken,
        });

        socket.emit('chat:history', room.chatHistory);

        socket.to(room.code).emit('player:joined', { id: roomPlayer.id, name: roomPlayer.name });
        io.to(room.code).emit('room:state', room.getPublicState());
        emitSystemChat(io, room, `${roomPlayer.name} se unió a la sala`);
      } catch (err: unknown) {
        callback({
          success: false,
          error: err instanceof Error ? err.message : 'Failed to join room',
        });
      }
    });

    // 3. Reconnect with Token
    socket.on('room:reconnect', async ({ roomCode, playerId, reconnectToken }, callback) => {
      try {
        const room = roomManager.getRoom(roomCode);
        if (!room) {
          return callback({ success: false, error: 'Room not found' });
        }

        const success = room.handleReconnect(playerId, socket.id, reconnectToken);
        if (!success) {
          return callback({ success: false, error: 'Invalid reconnect credentials' });
        }

        socket.join(room.code);

        const hand = room.getPlayerHand(playerId);
        const state = room.getPublicState();

        callback({
          success: true,
          state,
          hand,
        });

        socket.emit('chat:history', room.chatHistory);

        socket.to(room.code).emit('player:reconnected', { playerId });
        io.to(room.code).emit('room:state', state);
      } catch (err: unknown) {
        callback({
          success: false,
          error: err instanceof Error ? err.message : 'Failed to reconnect',
        });
      }
    });

    // 4. Start Game
    socket.on('room:start', (callback) => {
      try {
        const match = roomManager.getRoomBySocketId(socket.id);
        if (!match) return callback({ success: false, error: 'Not in a room' });
        const { room, player } = match;

        if (room.hostId !== player.id) {
          return callback({ success: false, error: 'Only room host can start the game' });
        }

        room.engine.start();

        io.to(room.code).emit('game:started');
        io.to(room.code).emit('room:state', room.getPublicState());
        emitSystemChat(io, room, '¡La partida ha comenzado!');

        // Send private hands directly to each individual player
        for (const p of room.players.values()) {
          if (p.socketId) {
            const hand = room.getPlayerHand(p.id);
            io.to(p.socketId).emit('player:hand', hand);
          }
        }

        scheduleTurnLifecycle(io, room);
        callback({ success: true });
      } catch (err: unknown) {
        callback({
          success: false,
          error: err instanceof Error ? err.message : 'Failed to start game',
        });
      }
    });

    // Add Bot (host only, before the game starts)
    socket.on('room:add_bot', (data, callback) => {
      try {
        const match = roomManager.getRoomBySocketId(socket.id);
        if (!match) return callback({ success: false, error: 'Not in a room' });
        const { room, player } = match;

        if (room.hostId !== player.id) {
          return callback({ success: false, error: 'Only room host can add bots' });
        }

        const bot = room.addBot(data?.name);

        io.to(room.code).emit('player:joined', { id: bot.id, name: bot.name });
        io.to(room.code).emit('room:state', room.getPublicState());
        emitSystemChat(io, room, `${bot.name} fue agregado a la sala`);

        callback({ success: true, playerId: bot.id });
      } catch (err: unknown) {
        callback({
          success: false,
          error: err instanceof Error ? err.message : 'Failed to add bot',
        });
      }
    });

    // Unified Game Action
    socket.on('game:action', ({ action, payload }, callback) => {
      try {
        const match = roomManager.getRoomBySocketId(socket.id);
        if (!match) return callback({ success: false, error: 'Not in a room' });
        const { room, player } = match;

        let result: unknown;
        if (room.engine instanceof TrucoEngine) {
          const res = room.engine.executeAction(player.id, action, payload as Record<string, unknown> | undefined);
          result = res.result;
        } else {
          const modularEngine = room.engine as ModularGameEngine;
          if (action === 'PLAY_CARD') {
            modularEngine.playCard(player.id, (payload as any)?.cardId, (payload as any)?.chosenColor);
          } else if (action === 'DRAW_CARD') {
            result = modularEngine.drawCard(player.id);
          } else if (action === 'CHOOSE_COLOR') {
            modularEngine.chooseColor(player.id, (payload as any)?.color);
          } else if (action === 'PASS_TURN') {
            modularEngine.passTurn(player.id);
          } else {
            return callback({ success: false, error: `Acción no soportada: ${action}` });
          }
        }

        // Update hands for all players (in case of round reset in trick taking)
        for (const p of room.players.values()) {
          if (p.socketId) {
            io.to(p.socketId).emit('player:hand', room.getPlayerHand(p.id));
          }
        }

        const state = room.getPublicState();
        io.to(room.code).emit('room:state', state);

        if (state.status === 'FINISHED') {
          emitGameFinished(io, room, state.winnerId);
        } else {
          scheduleTurnLifecycle(io, room);
        }

        callback({ success: true, result });
      } catch (err: unknown) {
        callback({
          success: false,
          error: err instanceof Error ? err.message : 'Action failed',
        });
      }
    });

    // 5. Play Card
    socket.on('game:play_card', (payload: any, callback) => {
      try {
        const match = roomManager.getRoomBySocketId(socket.id);
        if (!match) return callback({ success: false, error: 'Not in a room' });
        const { room, player } = match;

        const cardId = typeof payload === 'string' ? payload : payload.cardId;
        const chosenColor = payload?.chosenColor;
        const isTapada = Boolean(payload?.isTapada);

        (room.engine as any).playCard(player.id, cardId, chosenColor, isTapada);

        // Update player hands
        for (const p of room.players.values()) {
          if (p.socketId) {
            io.to(p.socketId).emit('player:hand', room.getPlayerHand(p.id));
          }
        }

        const state = room.getPublicState();
        io.to(room.code).emit('room:state', state);

        if (state.status === 'FINISHED') {
          emitGameFinished(io, room, state.winnerId);
        }

        scheduleTurnLifecycle(io, room);
        callback({ success: true });
      } catch (err: unknown) {
        callback({
          success: false,
          error: err instanceof Error ? err.message : 'Failed to play card',
        });
      }
    });

    // 6. Draw Card
    socket.on('game:draw_card', (callback) => {
      try {
        const match = roomManager.getRoomBySocketId(socket.id);
        if (!match) return callback({ success: false, error: 'Not in a room' });
        const { room, player } = match;

        if (room.engine instanceof TrucoEngine) {
          return callback({ success: false, error: 'Truco no permite robar cartas del mazo' });
        }

        const drawnCard = (room.engine as ModularGameEngine).drawCard(player.id);

        // Update player hand
        const updatedHand = room.getPlayerHand(player.id);
        socket.emit('player:hand', updatedHand);

        io.to(room.code).emit('room:state', room.getPublicState());

        callback({ success: true, card: drawnCard });
      } catch (err: unknown) {
        callback({
          success: false,
          error: err instanceof Error ? err.message : 'Failed to draw card',
        });
      }
    });

    // 7. Choose Color (for Wild cards)
    socket.on('game:choose_color', ({ color }, callback) => {
      try {
        const match = roomManager.getRoomBySocketId(socket.id);
        if (!match) return callback({ success: false, error: 'Not in a room' });
        const { room, player } = match;

        if (room.engine instanceof TrucoEngine) {
          return callback({ success: false, error: 'Truco no requiere elegir color' });
        }

        (room.engine as ModularGameEngine).chooseColor(player.id, color);
        io.to(room.code).emit('room:state', room.getPublicState());

        scheduleTurnLifecycle(io, room);
        callback({ success: true });
      } catch (err: unknown) {
        callback({
          success: false,
          error: err instanceof Error ? err.message : 'Failed to set color',
        });
      }
    });

    // 8. Pass Turn
    socket.on('game:pass_turn', (callback) => {
      try {
        const match = roomManager.getRoomBySocketId(socket.id);
        if (!match) return callback({ success: false, error: 'Not in a room' });
        const { room, player } = match;

        if (room.engine instanceof TrucoEngine) {
          return callback({ success: false, error: 'Truco no permite pasar turno; debés tirar una carta o irte al mazo' });
        }

        (room.engine as ModularGameEngine).passTurn(player.id);
        io.to(room.code).emit('room:state', room.getPublicState());

        scheduleTurnLifecycle(io, room);
        callback({ success: true });
      } catch (err: unknown) {
        callback({
          success: false,
          error: err instanceof Error ? err.message : 'Failed to pass turn',
        });
      }
    });

    // 9. Leave Room
    socket.on('room:leave', (callback) => {
      const match = roomManager.getRoomBySocketId(socket.id);
      if (match) {
        const { room, player } = match;
        const hadActiveTurn = room.getPublicState().currentTurnPlayerId === player.id;
        if (hadActiveTurn) room.clearTurnTimer();
        room.removePlayer(player.id);
        socket.leave(room.code);
        socket.to(room.code).emit('player:left', { playerId: player.id, name: player.name });
        io.to(room.code).emit('room:state', room.getPublicState());
        scheduleTurnLifecycle(io, room);
      }
      callback({ success: true });
    });

    // Chat: send a message to everyone in the room
    socket.on('chat:send', (data, callback) => {
      try {
        const match = roomManager.getRoomBySocketId(socket.id);
        if (!match) return callback({ success: false, error: 'Not in a room' });
        const { room, player } = match;

        const rawText = data?.text?.trim();
        if (!rawText || rawText.length === 0) {
          return callback({ success: false, error: 'Message cannot be empty' });
        }
        if (rawText.length > 200) {
          return callback({ success: false, error: 'Message too long (max 200 chars)' });
        }

        const safeText = rawText.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const msg: ChatMessage = {
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          senderId: player.id,
          senderName: player.name,
          text: safeText,
          timestamp: Date.now(),
          isSystem: false,
        };
        room.addChatMessage(msg);
        io.to(room.code).emit('chat:message', msg);
        callback({ success: true });
      } catch (err: unknown) {
        callback({ success: false, error: err instanceof Error ? err.message : 'Chat error' });
      }
    });

    // 10. Disconnection (Grace Period)
    socket.on('disconnect', () => {
      const match = roomManager.getRoomBySocketId(socket.id);
      if (!match) return;

      const { room, player } = match;
      if (room.getPublicState().currentTurnPlayerId === player.id) {
        room.clearTurnTimer();
      }

      room.handleDisconnect(player.id, (expiredRoom, expiredPlayer) => {
        // Callback executed when grace timer expires
        expiredRoom.removePlayer(expiredPlayer.id);

        io.to(expiredRoom.code).emit('player:left', {
          playerId: expiredPlayer.id,
          name: expiredPlayer.name,
        });

        const updatedState = expiredRoom.getPublicState();
        io.to(expiredRoom.code).emit('room:state', updatedState);

        if (updatedState.status === 'FINISHED') {
          emitGameFinished(io, expiredRoom, updatedState.winnerId);
        }

        scheduleTurnLifecycle(io, expiredRoom);
      });

      socket.to(room.code).emit('player:disconnected', {
        playerId: player.id,
        graceSeconds: room.disconnectGraceSeconds,
      });

      io.to(room.code).emit('room:state', room.getPublicState());
    });
  });

  return io;
}
