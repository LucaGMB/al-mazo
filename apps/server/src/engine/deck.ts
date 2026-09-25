import { randomInt } from 'node:crypto';
import { Card, DeckConfig } from './types.js';

export class DeckManager {
  private cards: Card[] = [];

  constructor(config?: DeckConfig) {
    if (config) {
      this.generateFromConfig(config);
    }
  }

  public generateFromConfig(config: DeckConfig): Card[] {
    this.cards = [];
    let counter = 1;

    for (const template of config.templates) {
      for (let i = 0; i < template.count; i++) {
        this.cards.push({
          id: `card_${counter++}`,
          type: template.type,
          color: template.color,
          value: template.value,
          metadata: template.metadata ? { ...template.metadata } : undefined,
        });
      }
    }

    this.shuffle();
    return this.cards;
  }

  /**
   * Cryptographically secure Fisher-Yates shuffle
   */
  public shuffle(): void {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      const temp = this.cards[i];
      this.cards[i] = this.cards[j];
      this.cards[j] = temp;
    }
  }

  public draw(): Card | null {
    return this.cards.pop() ?? null;
  }

  public drawMultiple(count: number): Card[] {
    const drawn: Card[] = [];
    for (let i = 0; i < count; i++) {
      const card = this.draw();
      if (!card) break;
      drawn.push(card);
    }
    return drawn;
  }

  public recycleDiscard(discardPile: Card[]): void {
    // Keep top card on the table, recycle the rest into draw pile
    if (discardPile.length <= 1) return;

    const cardsToRecycle = discardPile.splice(0, discardPile.length - 1);
    this.cards.push(...cardsToRecycle);
    this.shuffle();
  }

  public get count(): number {
    return this.cards.length;
  }

  public get rawCards(): Card[] {
    return [...this.cards];
  }
}
