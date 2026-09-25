import type { GameDefinitionData } from "./presets";

export interface ClientValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateGameClient(data: GameDefinitionData): ClientValidationResult {
  const errors: string[] = [];

  if (!data.title || data.title.trim().length < 3) {
    errors.push("El título debe tener al menos 3 caracteres.");
  }

  if (!data.slug || !/^[a-z0-9-]+$/.test(data.slug)) {
    errors.push("El slug solo puede contener letras minúsculas, números y guiones.");
  }

  if (!data.description || data.description.trim().length < 5) {
    errors.push("La descripción debe explicar brevemente la dinámica del juego.");
  }

  const { minPlayers, maxPlayers } = data.rules;
  if (!minPlayers || minPlayers < 2) {
    errors.push("El mínimo de jugadores debe ser al menos 2.");
  }
  if (!maxPlayers || maxPlayers > 12) {
    errors.push("El máximo de jugadores no puede superar 12.");
  }
  if (minPlayers && maxPlayers && maxPlayers < minPlayers) {
    errors.push("El máximo de jugadores debe ser mayor o igual al mínimo.");
  }

  const templates = data.deckConfig?.templates;
  if (!Array.isArray(templates) || templates.length === 0) {
    errors.push("El mazo debe tener al menos una plantilla de carta configurada.");
  } else {
    const totalCount = templates.reduce((sum, t) => sum + (t.count || 0), 0);
    if (totalCount < 10) {
      errors.push("El mazo debe contener un número razonable de cartas (mínimo 10).");
    }
  }

  const hasMatching =
    Array.isArray(data.rules.matchingProperties) && data.rules.matchingProperties.length > 0;
  const hasPhases = Array.isArray(data.rules.phases) && data.rules.phases.length > 0;
  const hasZones = Array.isArray(data.rules.zones) && data.rules.zones.length > 0;
  const hasHierarchy =
    !!data.rules.cardHierarchy && Object.keys(data.rules.cardHierarchy).length > 0;

  if (!hasMatching && !hasPhases && !hasZones && !hasHierarchy) {
    errors.push("Las reglas deben definir al menos propiedades de coincidencia, fases, zonas o jerarquía.");
  }

  if (!data.rules.winCondition || !data.rules.winCondition.type) {
    errors.push("Debe especificarse una condición de victoria válida.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
