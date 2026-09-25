import { Server as HttpServer } from 'node:http';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { redis } from '../db/redis.js';
import { roomManager } from './room-manager.js';
import { GameRoom } from './room.js';
import {
  Card,
  ChatMessage,
  ClientToServerEvents,
  PublicGameState,
  RoomPlayer,
  ServerToClientEvents,
} from './types.js';
import { decideBotMove, decideEscobaBotMove } from '../engine/bot.js';
import { ModularGameEngine } from '../engine/modular-engine.js';

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

function broadcastPlayerHands(io: IoServer, room: GameRoom): void {
  for (const p of room.players.values()) {
    if (p.socketId && p.isConnected) {
      io.to(p.socketId).emit('player:hand', room.getPlayerHand(p.id));
    }
  }
}

function getNextPlayer(room: GameRoom, state: PublicGameState): RoomPlayer | undefined {
  const index = state.players.findIndex((p) => p.id === state.currentTurnPlayerId);
  const total = state.players.length;
  if (index === -1 || total === 0) return undefined;
  const next = state.players[(index + state.turnDirection + total) % total];
  return next ? room.getPlayer(next.id) : undefined;
}

function specialCardChatMessage(
  card: Card,
  playerName: string,
  nextPlayerName?: string,
  pendingDrawCount?: number
): string | null {
  switch (String(card.value ?? card.type)) {
    case 'DRAW_2':
      if (pendingDrawCount && pendingDrawCount > 2) {
        return `🔥 ${playerName} acumuló un +2. ¡El pozo sube a +${pendingDrawCount} cartas para ${nextPlayerName ?? 'el siguiente'}!`;
      }
      return `🃏 ${playerName} tiró un +2. ${nextPlayerName ?? 'El siguiente jugador'} debe responder o robar.`;
    case 'SKIP':
      return `🚫 ${playerName} tiró Salteo.`;
    case 'REVERSE':
      return `🔄 ${playerName} cambió el sentido de la ronda.`;
    case 'WILD_DRAW_4':
      if (pendingDrawCount && pendingDrawCount > 4) {
        return `🔥 ${playerName} acumuló un +4. ¡El pozo sube a +${pendingDrawCount} cartas para ${nextPlayerName ?? 'el siguiente'}!`;
      }
      return `🃏 ${playerName} tiró un +4. ${nextPlayerName ?? 'El siguiente jugador'} debe responder o robar.`;
    default:
      return null;
  }
}

function emitGameFinished(io: IoServer, room: GameRoom, winnerId: string | null): void {
  io.to(room.code).emit('game:finished', { winnerId });
  const winner = winnerId ? room.getPlayer(winnerId) : undefined;
  emitSystemChat(
    io,
    room,
    winner ? `¡Partida finalizada! Ganador: ${winner.name}` : '¡Partida finalizada!'
  );
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

function emitPlayerHands(io: IoServer, room: GameRoom): void {
  for (const p of room.players.values()) {
    if (p.socketId) {
      const hand = room.getPlayerHand(p.id);
      io.to(p.socketId).emit('player:hand', hand);
    }
  }
}

function handleHumanTurnTimeout(io: IoServer, room: GameRoom, timedOutPlayerId: string): void {
  const state = room.getPublicState();
  if (state.status !== 'IN_PROGRESS' || state.currentTurnPlayerId !== timedOutPlayerId) return;
  const player = room.getPlayer(timedOutPlayerId);
  if (!player) return;

  if (room.engine.isRoundTrickGame) {
    try {
      const pendingBet = state.customState?.pendingBet as
        | { type?: string; challengedId?: string }
        | undefined;
      if (pendingBet?.challengedId === timedOutPlayerId) {
        // Si no contesta la apuesta, se achica: pierde lo apostado.
        room.engine.executeAction(
          timedOutPlayerId,
          pendingBet.type === 'FLOR' ? 'CON_FLOR_ME_ACHICO' : 'NO_QUIERO'
        );
      } else {
        const hand = room.getPlayerHand(timedOutPlayerId);
        if (hand.length > 0) {
          room.engine.playCard(timedOutPlayerId, hand[0].id);
        }
      }
    } catch {
      // turn already resolved elsewhere; nothing left to do
    }
  } else if (room.engine.isCommunityGame()) {
    try {
      const hand = room.getPlayerHand(timedOutPlayerId);
      if (hand.length > 0) {
        // Se juega/descarta la primera carta para no trabar la ronda.
        room.engine.executeAction(timedOutPlayerId, 'PLAY_CARD', { cardId: hand[0].id });
      }
    } catch {
      // turn already resolved elsewhere; nothing left to do
    }
  } else {
    const modularEngine = room.engine as ModularGameEngine;
    const allowedActions =
      room.definition.rules.phases?.find((phase) => phase.id === state.currentPhase)
        ?.allowedActions ?? [];
    const usesRevealFlow =
      allowedActions.includes('REVEAL_CARD') || allowedActions.includes('END_GAME');
    try {
      if (state.pendingChoice && state.pendingChoice.playerId === timedOutPlayerId) {
        const defaultChoice =
          (room.definition.deckConfig.templates.find((t) => t.color && t.color !== 'ANY')?.color) ??
          'RED';
        modularEngine.chooseColor(timedOutPlayerId, defaultChoice);
      } else if (usesRevealFlow) {
        const action =
          state.drawPileCount > 0 && allowedActions.includes('REVEAL_CARD')
            ? 'REVEAL_CARD'
            : 'END_GAME';
        modularEngine.executeAction(timedOutPlayerId, action);
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
  emitPlayerHands(io, room);
  const newState = room.getPublicState();
  io.to(room.code).emit('room:state', newState);

  if (player.socketId) {
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

  let playedCard: Card | undefined;
  let nextPlayerName: string | undefined;

  try {
    const hand = room.getPlayerHand(botId);
    const isEscoba = room.engine.isCommunityGame();

    if (room.engine.isRoundTrickGame) {
      // Bazas + apuestas: el motor decide canto de envido/flor/truco y qué carta jugar.
      room.engine.executeBotTurn(botId);
      broadcastPlayerHands(io, room);
    } else if (isEscoba) {
      const tableCards =
        state.tableCards ??
        ((state.customState?.tableCards as Card[]) || []);
      const move = decideEscobaBotMove(hand, tableCards);
      const actionResult = room.engine.executeAction(botId, move.action, {
        cardId: move.cardId,
        tableCardIds: move.tableCardIds,
      });
      if (!actionResult.success) {
        // Nunca dejar el turno del bot trabado: jugar la primera carta.
        const fallback = hand[0];
        if (fallback) {
          room.engine.executeAction(botId, 'PLAY_CARD', { cardId: fallback.id });
        }
      } else if ((actionResult.result as { escoba?: boolean } | undefined)?.escoba) {
        emitSystemChat(io, room, `¡${bot.name} hizo Escoba! (+1 punto)`);
      }
    } else {
      const modularEngine = room.engine as ModularGameEngine;
      nextPlayerName = getNextPlayer(room, state)?.name;

      const allowedActions =
        room.definition.rules.phases?.find((phase) => phase.id === state.currentPhase)
          ?.allowedActions ?? [];
      if (allowedActions.includes('REVEAL_CARD') && state.drawPileCount > 0) {
        modularEngine.executeAction(botId, 'REVEAL_CARD');
      } else if (allowedActions.includes('END_GAME') && state.drawPileCount === 0) {
        modularEngine.executeAction(botId, 'END_GAME');
      } else {
        const pendingBefore = state.pendingDrawCount ?? 0;
        const move = decideBotMove(
          hand,
          state.topDiscardCard,
          state.activeColor,
          room.definition.rules,
          pendingBefore
        );

        if (move) {
          playedCard = hand.find((c) => c.id === move.cardId);
          modularEngine.playCard(botId, move.cardId, move.chosenColor);
        } else {
          modularEngine.drawCard(botId);
          if (pendingBefore > 0) {
            io.to(room.code).emit('player:forced_draw', { count: pendingBefore, byName: bot.name });
            emitSystemChat(io, room, `💥 ${bot.name} se comió el pozo acumulado de ${pendingBefore} cartas.`);
          }
          if (room.engine.getPublicState().currentTurnPlayerId === botId) {
            modularEngine.passTurn(botId);
          }
        }
      }
    }
  } catch (err: unknown) {
    // ponytail: a bot error is logged, not fatal; humans can keep playing.
    io.to(room.code).emit('error:notification', {
      message: err instanceof Error ? err.message : 'Bot failed to move',
    });
    return;
  }

  broadcastPlayerHands(io, room);

  const newState = room.getPublicState();
  if (playedCard) {
    const chat = specialCardChatMessage(playedCard, bot.name, nextPlayerName, newState.pendingDrawCount);
    if (chat) emitSystemChat(io, room, chat);
  }

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
    // Sin un handler de 'error', un Redis caído emite un evento no manejado y
    // tumba el proceso entero. Con esto el adapter simplemente deja de relayar.
    pubClient.on('error', () => {});
    subClient.on('error', () => {});
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

        broadcastPlayerHands(io, room);

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

    // Remove Bot (host only, before the game starts)
    socket.on('room:remove_bot', (data: { botId?: string }, callback) => {
      try {
        const match = roomManager.getRoomBySocketId(socket.id);
        if (!match) return callback({ success: false, error: 'Not in a room' });
        const { room, player } = match;

        if (room.hostId !== player.id) {
          return callback({ success: false, error: 'Solo el anfitrión puede remover bots' });
        }

        const bot = room.removeBot(data?.botId);

        io.to(room.code).emit('player:left', { playerId: bot.id, name: bot.name });
        io.to(room.code).emit('room:state', room.getPublicState());
        emitSystemChat(io, room, `🤖 ${bot.name} fue removido de la sala`);

        callback({ success: true, playerId: bot.id });
      } catch (err: unknown) {
        callback({
          success: false,
          error: err instanceof Error ? err.message : 'Error al remover bot',
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
        if (action === 'CAPTURE_CARDS' || action === 'DROP_CARD') {
          const res = (room.engine as any).executeAction(player.id, action, payload);
          if (!res?.success) {
            return callback({ success: false, error: String(res?.result || 'Action failed') });
          }
          result = res.result;
          if ((res.result as any)?.escoba) {
            emitSystemChat(io, room, `¡${player.name} hizo Escoba! (+1 punto)`);
          }
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
          } else if (typeof (room.engine as any).executeAction === 'function') {
            const res = (room.engine as any).executeAction(player.id, action, payload);
            if (!res?.success) {
              return callback({ success: false, error: String(res?.result || 'Action failed') });
            }
            result = res.result;
          } else {
            return callback({ success: false, error: `Acción no soportada: ${action}` });
          }
        }

        broadcastPlayerHands(io, room);

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

        if (room.engine.isCommunityGame()) {
          // En juegos de mesa comunitaria "jugar" una carta puede capturar
          // (si viene con tableCardIds) o dejarla en la mesa.
          const res = room.engine.executeAction(player.id, 'PLAY_CARD', {
            cardId,
            chosenColor,
            isTapada,
            tableCardIds: payload?.tableCardIds,
          });
          if (!res.success) {
            return callback({ success: false, error: String(res.result || 'Action failed') });
          }
          if ((res.result as { escoba?: boolean } | undefined)?.escoba) {
            emitSystemChat(io, room, `¡${player.name} hizo Escoba! (+1 punto)`);
          }
        } else {
          const card = room.getPlayerHand(player.id).find((c) => c.id === cardId);
          const nextPlayer = getNextPlayer(room, room.getPublicState());

          (room.engine as any).playCard(player.id, cardId, chosenColor, isTapada);

          if (card) {
            const nextState = room.getPublicState();
            const chat = specialCardChatMessage(
              card,
              player.name,
              nextPlayer?.name,
              nextState.pendingDrawCount
            );
            if (chat && card.type !== 'WILD') emitSystemChat(io, room, chat);
          }
        }

        broadcastPlayerHands(io, room);

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

        if (room.engine.isRoundTrickGame || room.engine.isCommunityGame()) {
          return callback({ success: false, error: 'Este juego no permite robar cartas del mazo' });
        }

        const stateBefore = room.getPublicState();
        const pendingBefore = stateBefore.pendingDrawCount ?? 0;
        const turnBefore = stateBefore.currentTurnPlayerId;
        const drawnCard = (room.engine as ModularGameEngine).drawCard(player.id);

        broadcastPlayerHands(io, room);

        const state = room.getPublicState();
        io.to(room.code).emit('room:state', state);

        if (pendingBefore > 0) {
          io.to(room.code).emit('player:forced_draw', { count: pendingBefore, byName: player.name });
          emitSystemChat(io, room, `💥 ${player.name} se comió el pozo acumulado de ${pendingBefore} cartas.`);
        } else if (state.currentTurnPlayerId !== turnBefore) {
          emitSystemChat(io, room, `🃏 ${player.name} robó una carta (pase automático).`);
        }

        if (state.currentTurnPlayerId !== turnBefore) {
          scheduleTurnLifecycle(io, room);
        }

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

        if (room.engine.isRoundTrickGame) {
          return callback({ success: false, error: 'Truco no requiere elegir color' });
        }

        const stateBefore = room.getPublicState();
        const topCard = stateBefore.topDiscardCard;
        const nextPlayer = getNextPlayer(room, stateBefore);

        (room.engine as ModularGameEngine).chooseColor(player.id, color);

        broadcastPlayerHands(io, room);

        const stateAfterColor = room.getPublicState();
        const topValue = String(topCard?.value ?? topCard?.type ?? '');
        if (topValue === 'WILD_DRAW_4') {
          const chat = specialCardChatMessage(
            topCard!,
            player.name,
            nextPlayer?.name,
            stateAfterColor.pendingDrawCount
          );
          if (chat) emitSystemChat(io, room, chat);
        } else if (topValue === 'WILD') {
          emitSystemChat(io, room, `🎨 ${player.name} cambió el color a ${color}.`);
        }
        io.to(room.code).emit('room:state', stateAfterColor);

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

        if (room.engine.isRoundTrickGame || room.engine.isCommunityGame()) {
          return callback({
            success: false,
            error: 'Este juego no permite pasar el turno; jugá o tirá una carta',
          });
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
