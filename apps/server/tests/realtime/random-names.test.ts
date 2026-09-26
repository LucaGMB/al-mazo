import { describe, it, expect } from 'vitest';
import { NAME_FIGURES, NAME_MODIFIERS, randomPlayerName } from '@al-mazo/shared';
import { RoomManager } from '../../src/realtime/room-manager.js';

describe('Random player names', () => {
  it('combines the first modifier and figure with an rng at zero', () => {
    expect(randomPlayerName(() => 0)).toBe(`${NAME_MODIFIERS[0]} ${NAME_FIGURES[0]}`);
  });

  it('combines the last modifier and figure with an rng near one', () => {
    expect(randomPlayerName(() => 0.999999)).toBe(
      `${NAME_MODIFIERS[NAME_MODIFIERS.length - 1]} ${NAME_FIGURES[NAME_FIGURES.length - 1]}`
    );
  });

  it('offers at least 400 combinations', () => {
    expect(NAME_MODIFIERS.length * NAME_FIGURES.length).toBeGreaterThanOrEqual(400);
  });

  it('names bots with combinations and avoids duplicates inside a room', async () => {
    const manager = new RoomManager();
    const { room } = await manager.createRoom('color-match', {
      id: 'host_1',
      name: 'Alice',
      socketId: 'sock_1',
    });

    const bot1 = room.addBot();
    const bot2 = room.addBot();

    for (const bot of [bot1, bot2]) {
      expect(NAME_MODIFIERS.some((m) => bot.name.startsWith(`${m} `))).toBe(true);
      expect(NAME_FIGURES.some((f) => bot.name.endsWith(` ${f}`))).toBe(true);
    }
    expect(bot1.name).not.toBe(bot2.name);
  });
});
