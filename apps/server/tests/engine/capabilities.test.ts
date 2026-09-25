import { describe, it, expect } from 'vitest';
import {
  BUILTIN_ACTIONS,
  getCapabilitiesManifest,
} from '../../src/engine/capabilities/registry.js';
import {
  getDeckPresetTemplates,
  getDeckPresetsSummary,
} from '../../src/engine/capabilities/deck-presets.js';

const EXPECTED_ACTIONS = [
  'PLAY_CARD',
  'DRAW_CARD',
  'CHOOSE_COLOR',
  'PASS_TURN',
  'CALL_BET',
  'RESPOND_BET',
  'FOLD',
];

const EXPECTED_CONDITIONS = [
  'IS_ACTIVE_PLAYER',
  'MATCH_TOP_CARD',
  'HAS_MIN_CARDS',
  'EVALUATE_CARD_HIERARCHY',
  'IS_BET_PENDING',
];

const EXPECTED_EFFECTS = [
  'MOVE_CARD',
  'DEAL_CARDS',
  'ADVANCE_TURN',
  'SET_ACTIVE_COLOR',
  'RESOLVE_TRICK',
  'AWARD_POINTS',
  'CHANGE_PHASE',
  'RESET_ROUND',
];

describe('Capabilities Registry', () => {
  it('exposes every capability category with content', () => {
    const manifest = getCapabilitiesManifest();

    expect(manifest.actions.length).toBeGreaterThan(0);
    expect(manifest.conditions.length).toBeGreaterThan(0);
    expect(manifest.effects.length).toBeGreaterThan(0);
    expect(manifest.zones.length).toBeGreaterThan(0);
    expect(manifest.deckPresets.length).toBeGreaterThan(0);
  });

  it('catalogs all builtin actions', () => {
    const ids = BUILTIN_ACTIONS.map((action) => action.id);
    for (const id of EXPECTED_ACTIONS) {
      expect(ids).toContain(id);
    }
  });

  it('catalogs all builtin conditions and effects', () => {
    const manifest = getCapabilitiesManifest();
    const conditionTypes = manifest.conditions.map((condition) => condition.type);
    const effectTypes = manifest.effects.map((effect) => effect.type);

    for (const type of EXPECTED_CONDITIONS) {
      expect(conditionTypes).toContain(type);
    }
    for (const type of EXPECTED_EFFECTS) {
      expect(effectTypes).toContain(type);
    }
  });

  it('returns valid structures for every catalog entry', () => {
    const manifest = getCapabilitiesManifest();

    for (const action of manifest.actions) {
      expect(action.id).toBeTruthy();
      expect(action.name).toBeTruthy();
      expect(action.description).toBeTruthy();
      for (const condition of action.requiredConditions ?? []) {
        expect(condition.type).toBeTruthy();
      }
    }

    for (const condition of manifest.conditions) {
      expect(condition.type).toBeTruthy();
      expect(condition.description).toBeTruthy();
    }

    for (const effect of manifest.effects) {
      expect(effect.type).toBeTruthy();
      expect(effect.description).toBeTruthy();
    }

    for (const zone of manifest.zones) {
      expect(zone.id).toBeTruthy();
      expect(zone.name).toBeTruthy();
      expect(zone.type).toBeTruthy();
      expect(zone.visibility).toBeTruthy();
    }
  });
});

describe('Deck Presets', () => {
  it('summarizes all standard presets with correct card totals', () => {
    const summaries = getDeckPresetsSummary();
    const byId = Object.fromEntries(summaries.map((preset) => [preset.id, preset.totalCards]));

    expect(byId.SPANISH_40).toBe(40);
    expect(byId.SPANISH_50).toBe(50);
    expect(byId.FRENCH_52).toBe(52);
    expect(byId.COLOR_MATCH_108).toBe(108);

    for (const preset of summaries) {
      expect(preset.name).toBeTruthy();
      expect(preset.description).toBeTruthy();
    }
  });

  it('materializes template arrays matching the summary totals', () => {
    const summaries = getDeckPresetsSummary();

    for (const summary of summaries) {
      const templates = getDeckPresetTemplates(summary.id);
      const total = templates.reduce((sum, template) => sum + template.count, 0);
      expect(total).toBe(summary.totalCards);
      expect(templates.length).toBeGreaterThan(0);
    }
  });

  it('rejects unknown preset ids', () => {
    expect(() => getDeckPresetTemplates('NOPE')).toThrow('Unknown deck preset');
  });
});