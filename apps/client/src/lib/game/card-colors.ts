// Paleta "arcade" (saturada, tipo ficha de casino) para los colores/palos
// jugables. Independiente del theme de Tailwind (ver también
// apps/server/src/games/*/definition.ts). Compartido por CardView,
// DiscardPile y ColorPicker para que nunca queden desincronizados entre sí.
export const CARD_COLORS: Record<string, string> = {
  RED: "#ff4d6d",
  BLUE: "#4fa8ff",
  GREEN: "#33c48d",
  YELLOW: "#ffd23f",
  ESPADAS: "#4fa8ff",
  BASTOS: "#33c48d",
  OROS: "#ffd23f",
  COPAS: "#ff4d6d", // antes naranja, sin relación con ningún color real del engine
  ANY: "#241a44",
};

export const COLOR_LABELS: Record<string, string> = {
  RED: "Rojo",
  BLUE: "Azul",
  GREEN: "Verde",
  YELLOW: "Amarillo",
};

export const SUIT_LABELS: Record<string, string> = {
  ESPADAS: "Espadas",
  BASTOS: "Bastos",
  OROS: "Oros",
  COPAS: "Copas",
};
