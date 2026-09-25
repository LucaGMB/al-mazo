import type { Card } from "@/types/engine";

// Metadatos visuales de las secciones de Desconectados. El texto y la
// categoría viajan en `metadata` de cada carta (definición del servidor);
// acá sólo mapeamos color e ícono para la UI.
export const PROMPT_CATEGORY_META: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  PERSPECTIVA: { label: "Perspectiva", color: "#4fa8ff", icon: "pixelarticons:eye" },
  PRESENTACION: { label: "Presentación", color: "#33c48d", icon: "pixelarticons:user" },
  PROFUNDIDAD: { label: "Profundidad", color: "#ff4d6d", icon: "pixelarticons:heart" },
  DESCOMPRIMIR: { label: "Descomprimir", color: "#ffd23f", icon: "pixelarticons:smile" },
  EN_BLANCO: { label: "En blanco", color: "#9a9fd4", icon: "pixelarticons:edit" },
};

export function promptCategoryMeta(category?: string) {
  return (
    PROMPT_CATEGORY_META[category ?? ""] ?? {
      label: category || "Pregunta",
      color: "#9a9fd4",
      icon: "pixelarticons:notes",
    }
  );
}

export interface PromptCard {
  id: string;
  type: string;
  category: string;
  categoryLabel: string;
  question: string;
  value?: string | number;
}

/** Normaliza una carta pública del servidor a la vista de pregunta. */
export function promptFromCard(card: Card | null | undefined): PromptCard | null {
  if (!card) return null;
  const metadata = (card.metadata ?? {}) as Record<string, unknown>;
  if (typeof metadata.question !== "string") return null;

  return {
    id: card.id,
    type: card.type,
    category: String(metadata.category ?? card.color ?? ""),
    categoryLabel: String(metadata.categoryLabel ?? ""),
    question: metadata.question,
    value: card.value,
  };
}

/**
 * Expande las plantillas del `deckConfig` del servidor en cartas jugables
 * para el modo local (pass-and-play), sin necesidad de sockets.
 */
export function buildLocalPromptDeck(deckConfig: unknown): PromptCard[] {
  const templates = (deckConfig as { templates?: Array<Record<string, unknown>> } | undefined)
    ?.templates;
  if (!Array.isArray(templates)) return [];

  const cards: PromptCard[] = [];
  let counter = 1;

  for (const template of templates) {
    const type = String(template.type ?? "");
    if (type !== "PROMPT" && type !== "BLANK") continue;

    const count = Number(template.count ?? 0);
    const metadata = (template.metadata ?? {}) as Record<string, unknown>;
    for (let i = 0; i < count; i++) {
      cards.push({
        id: `local_${counter++}`,
        type,
        category: String(metadata.category ?? template.color ?? ""),
        categoryLabel: String(metadata.categoryLabel ?? ""),
        question: String(metadata.question ?? ""),
        value: template.value as string | number | undefined,
      });
    }
  }

  return cards;
}

export function shufflePromptDeck(cards: PromptCard[]): PromptCard[] {
  const shuffled = [...cards];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
