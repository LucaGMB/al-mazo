import {
  ModularGameEngine,
  TrickPlayEntry,
  RoundTrickRecord,
  EnvidoState,
  TrucoBetState,
  TrucoCustomState,
} from '../../engine/modular-engine.js';
import { GameSchemaDefinition } from '../../engine/types.js';
import { InternalPlayer } from '../../engine/state-machine.js';

export type {
  InternalPlayer,
  TrickPlayEntry,
  RoundTrickRecord,
  EnvidoState,
  TrucoBetState,
  TrucoCustomState,
};

export class TrucoEngine extends ModularGameEngine {
  constructor(definition: GameSchemaDefinition) {
    super(definition);
  }
}
