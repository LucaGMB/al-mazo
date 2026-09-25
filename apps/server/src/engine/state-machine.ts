import { DeckManager } from './deck.js';
import {
  Card,
  GameSchemaDefinition,
  PlayerPublicInfo,
  PublicGameState,
  TurnDirection,
} from './types.js';
import { validateCardPlay } from './validator.js';

export interface InternalPlayer {
  id: string;
  name: string;
  hand: Card[];
  isConnected: boolean;
  isBot: boolean;
  hasDrawnThisTurn: boolean;
}

export class GameEngine {
  protected definition: GameSchemaDefinition;
  protected deckManager: DeckManager;
  protected players: InternalPlayer[] = [];
  protected discardPile: Card[] = [];
  protected currentTurnIndex = 0;
  protected turnDirection: TurnDirection = 1;
  protected activeColor: string | null = null;
  protected status: 'LOBBY' | 'IN_PROGRESS' | 'FINISHED' = 'LOBBY';
  protected winnerId: string | null = null;
  private pendingChoice: { playerId: string; type: 'COLOR' } | null = null;

  constructor(definition: GameSchemaDefinition) {
    this.definition = definition;
    this.deckManager = new DeckManager(definition.deckConfig);
  }

  public addPlayer(id: string, name: string, isBot = false): void {
    if (this.status !== 'LOBBY') {
      throw new Error('Cannot add player: Game already started');
    }
    if (this.players.length >= this.definition.rules.maxPlayers) {
      throw new Error('Cannot add player: Room is full');
    }
    if (this.players.some((p) => p.id === id)) {
      throw new Error(`Player ${id} already in game`);
    }

    this.players.push({
      id,
      name,
      hand: [],
      isConnected: true,
      isBot,
      hasDrawnThisTurn: false,
    });
  }

  public removePlayer(
    id: string,
    policy: 'DISCARD_AND_CONTINUE' | 'ABORT_MATCH' = 'DISCARD_AND_CONTINUE'
  ): void {
    const playerIndex = this.players.findIndex((p) => p.id === id);
    if (playerIndex === -1) return;

    const [removedPlayer] = this.players.splice(playerIndex, 1);

    if (this.status === 'IN_PROGRESS') {
      // Return cards to draw pile or recycle
      if (removedPlayer.hand.length > 0) {
        this.discardPile.push(...removedPlayer.hand);
      }

      if (this.players.length < this.definition.rules.minPlayers || policy === 'ABORT_MATCH') {
        this.status = 'FINISHED';
        this.winnerId = this.players[0]?.id ?? null;
        return;
      }

      if (this.currentTurnIndex >= this.players.length) {
        this.currentTurnIndex = 0;
      }
    }
  }

  public setPlayerConnection(id: string, isConnected: boolean): void {
    const player = this.players.find((p) => p.id === id);
    if (player) {
      player.isConnected = isConnected;
    }
  }

  public start(): void {
    if (this.players.length < this.definition.rules.minPlayers) {
      throw new Error(
        `At least ${this.definition.rules.minPlayers} players required to start`
      );
    }

    this.deckManager.generateFromConfig(this.definition.deckConfig);

    // Deal initial hands
    for (const player of this.players) {
      player.hand = this.deckManager.drawMultiple(
        this.definition.rules.initialHandSize
      );
      player.hasDrawnThisTurn = false;
    }

    // Flip top card for discard pile (ensure it's not a wild card initially if possible)
    let initialCard = this.deckManager.draw();
    while (initialCard && initialCard.type === 'WILD') {
      // Re-insert wild card and pick another
      this.deckManager.recycleDiscard([initialCard]);
      initialCard = this.deckManager.draw();
    }

    if (!initialCard) {
      throw new Error('Not enough cards in deck to start');
    }

    this.discardPile = [initialCard];
    this.activeColor = initialCard.color ?? null;
    this.currentTurnIndex = 0;
    this.turnDirection = 1;
    this.status = 'IN_PROGRESS';
  }

  public getCurrentPlayer(): InternalPlayer {
    return this.players[this.currentTurnIndex];
  }

  public getPlayerHand(playerId: string): Card[] {
    const player = this.players.find((p) => p.id === playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }
    return [...player.hand];
  }

  public hasPlayableCard(playerId: string): boolean {
    const player = this.players.find((p) => p.id === playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }
    return player.hand.some(
      (card) =>
        validateCardPlay(
          card,
          this.getTopDiscardCard(),
          this.activeColor,
          this.definition.rules
        ).isValid
    );
  }

  public playCard(playerId: string, cardId: string, chosenColor?: string): void {
    if (this.status !== 'IN_PROGRESS') {
      throw new Error('Game is not in progress');
    }

    if (this.pendingChoice) {
      throw new Error(`Player ${this.pendingChoice.playerId} must choose color before continuing`);
    }

    const currentPlayer = this.getCurrentPlayer();
    if (currentPlayer.id !== playerId) {
      throw new Error('Not your turn');
    }

    const cardIndex = currentPlayer.hand.findIndex((c) => c.id === cardId);
    if (cardIndex === -1) {
      throw new Error('Card not found in hand');
    }

    const card = currentPlayer.hand[cardIndex];
    const topCard = this.getTopDiscardCard();

    const validation = validateCardPlay(
      card,
      topCard,
      this.activeColor,
      this.definition.rules
    );

    if (!validation.isValid) {
      throw new Error(validation.reason ?? 'Invalid card play');
    }

    // Remove from hand and add to discard pile
    currentPlayer.hand.splice(cardIndex, 1);
    this.discardPile.push(card);
    currentPlayer.hasDrawnThisTurn = false;

    // Set active color
    if (card.color && card.color !== 'ANY') {
      this.activeColor = card.color;
    }

    // Check win condition
    const winCondition = this.definition.rules.winCondition;
    const winsOnEmptyHand = !winCondition || winCondition.type === 'EMPTY_HAND';
    if (currentPlayer.hand.length === 0 && winsOnEmptyHand) {
      this.status = 'FINISHED';
      this.winnerId = currentPlayer.id;
      return;
    }

    // Handle Card Effects
    const effectKey = String(card.value ?? card.type);
    const effect = this.definition.rules.effects[effectKey];

    if (effect?.type === 'SWAP_HANDS') {
      const targetPlayer = this.players[this.getNextPlayerIndex(1)];
      if (targetPlayer && targetPlayer.id !== currentPlayer.id) {
        const tempHand = [...currentPlayer.hand];
        currentPlayer.hand = [...targetPlayer.hand];
        targetPlayer.hand = tempHand;
      }
      // Wild SWAP cards still require a color choice, handled below.
    }

    if (effect?.type === 'DISCARD_ALL_COLOR') {
      const matchColor = card.color ?? this.activeColor;
      if (matchColor && matchColor !== 'ANY') {
        const matchingIndices: number[] = [];
        currentPlayer.hand.forEach((c, idx) => {
          if (c.color === matchColor) {
            matchingIndices.push(idx);
          }
        });
        // Discard matching from highest index to lowest to keep indices stable
        for (let i = matchingIndices.length - 1; i >= 0; i--) {
          const [discarded] = currentPlayer.hand.splice(matchingIndices[i], 1);
          this.discardPile.push(discarded);
        }
      }
      if (currentPlayer.hand.length === 0 && winsOnEmptyHand) {
        this.status = 'FINISHED';
        this.winnerId = currentPlayer.id;
        return;
      }
    }

    if (card.type === 'WILD' || effect?.type === 'CHOOSE_COLOR') {
      if (chosenColor) {
        this.activeColor = chosenColor;
      } else {
        this.pendingChoice = { playerId: currentPlayer.id, type: 'COLOR' };
        return; // Wait for player color selection before advancing turn
      }
    }

    this.applyCardEffect(effect);
  }

  public chooseColor(playerId: string, color: string): void {
    if (!this.pendingChoice || this.pendingChoice.playerId !== playerId) {
      throw new Error('No pending color choice for this player');
    }

    this.activeColor = color;
    const topCard = this.getTopDiscardCard();
    this.pendingChoice = null;

    // If top card was a WILD_DRAW_4, apply drawing effect now
    if (topCard) {
      const effectKey = String(topCard.value ?? topCard.type);
      const effect = this.definition.rules.effects[effectKey];
      if (effect && effect.type === 'DRAW_CARDS') {
        this.applyCardEffect(effect);
        return;
      }
    }

    this.advanceTurn(1);
  }

  public drawCard(playerId: string): Card {
    if (this.status !== 'IN_PROGRESS') {
      throw new Error('Game is not in progress');
    }

    const currentPlayer = this.getCurrentPlayer();
    if (currentPlayer.id !== playerId) {
      throw new Error('Not your turn');
    }

    if (currentPlayer.hasDrawnThisTurn) {
      throw new Error('Already drawn a card this turn');
    }

    if (this.deckManager.count === 0 && this.definition.rules.reshuffleDiscardPile) {
      this.deckManager.recycleDiscard(this.discardPile);
    }

    const card = this.deckManager.draw();
    if (!card) {
      throw new Error('No cards left in draw pile');
    }

    currentPlayer.hand.push(card);
    currentPlayer.hasDrawnThisTurn = true;

    if (
      this.definition.rules.autoPassOnDraw &&
      !this.hasPlayableCard(playerId)
    ) {
      currentPlayer.hasDrawnThisTurn = false;
      this.advanceTurn(1);
    }

    return card;
  }

  public passTurn(playerId: string): void {
    if (this.status !== 'IN_PROGRESS') {
      throw new Error('Game is not in progress');
    }

    const currentPlayer = this.getCurrentPlayer();
    if (currentPlayer.id !== playerId) {
      throw new Error('Not your turn');
    }

    if (!currentPlayer.hasDrawnThisTurn) {
      throw new Error('Must draw a card before passing');
    }

    currentPlayer.hasDrawnThisTurn = false;
    this.advanceTurn(1);
  }

  protected applyCardEffect(effect?: { type: string; params?: { drawCount?: number; skipTarget?: boolean; step?: number } }): void {
    if (!effect) {
      this.advanceTurn(1);
      return;
    }

    switch (effect.type) {
      case 'SKIP': {
        const step = effect.params?.step ?? 2;
        this.advanceTurn(step);
        break;
      }

      case 'REVERSE': {
        this.turnDirection = (this.turnDirection * -1) as TurnDirection;
        this.advanceTurn(1);
        break;
      }

      case 'DRAW_CARDS': {
        const count = effect.params?.drawCount ?? 2;
        const targetIndex = this.getNextPlayerIndex(1);
        const targetPlayer = this.players[targetIndex];

        if (this.deckManager.count < count && this.definition.rules.reshuffleDiscardPile) {
          this.deckManager.recycleDiscard(this.discardPile);
        }

        const drawnCards = this.deckManager.drawMultiple(count);
        targetPlayer.hand.push(...drawnCards);

        if (effect.params?.skipTarget) {
          this.advanceTurn(2);
        } else {
          this.advanceTurn(1);
        }
        break;
      }

      default: {
        this.advanceTurn(1);
        break;
      }
    }
  }

  protected advanceTurn(steps: number): void {
    const totalPlayers = this.players.length;
    let nextIndex = (this.currentTurnIndex + this.turnDirection * steps) % totalPlayers;
    if (nextIndex < 0) {
      nextIndex += totalPlayers;
    }
    this.currentTurnIndex = nextIndex;
    const current = this.getCurrentPlayer();
    if (current) {
      current.hasDrawnThisTurn = false;
    }
  }

  protected getNextPlayerIndex(steps: number): number {
    const totalPlayers = this.players.length;
    let nextIndex = (this.currentTurnIndex + this.turnDirection * steps) % totalPlayers;
    if (nextIndex < 0) {
      nextIndex += totalPlayers;
    }
    return nextIndex;
  }

  public getTopDiscardCard(): Card | null {
    return this.discardPile[this.discardPile.length - 1] ?? null;
  }

  /**
   * Returns public state with hidden information redacted (no competitor hands)
   */
  public getPublicState(): PublicGameState {
    const publicPlayers: PlayerPublicInfo[] = this.players.map((p, index) => ({
      id: p.id,
      name: p.name,
      cardCount: p.hand.length,
      isConnected: p.isConnected,
      seatIndex: index,
      isBot: p.isBot,
    }));

    return {
      status: this.status,
      currentTurnPlayerId: this.players[this.currentTurnIndex]?.id ?? null,
      turnDirection: this.turnDirection,
      topDiscardCard: this.getTopDiscardCard(),
      activeColor: this.activeColor,
      drawPileCount: this.deckManager.count,
      discardPileCount: this.discardPile.length,
      players: publicPlayers,
      winnerId: this.winnerId,
      pendingChoice: this.pendingChoice,
    };
  }
}
