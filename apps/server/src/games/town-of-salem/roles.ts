import type { CardTemplate, TownFaction, TownRole } from '@al-mazo/shared';

export interface TownRoleMetadata {
  role: TownRole;
  faction: TownFaction;
  name: string;
  icon: string;
  color: string;
  description: string;
  nightAbility: string;
}

export const TOWN_ROLES: Record<TownRole, TownRoleMetadata> = {
  MAFIOSO: {
    role: 'MAFIOSO',
    faction: 'MAFIA',
    name: 'Mafioso',
    icon: 'pixelarticons:bullseye',
    color: '#ff4d6d',
    description: 'Miembro de la Mafia. Conoce a sus aliados y busca eliminar al Pueblo.',
    nightAbility: 'Elegí a 1 jugador vivo para atacarlo y eliminarlo.',
  },
  DOCTOR: {
    role: 'DOCTOR',
    faction: 'TOWN',
    name: 'Doctor',
    icon: 'pixelarticons:heart',
    color: '#33c48d',
    description: 'Médico del Pueblo. Salva vidas protegiendo de los ataques nocturnos.',
    nightAbility: 'Elegí a 1 jugador vivo para curarlo y evitar su muerte esta noche.',
  },
  SHERIFF: {
    role: 'SHERIFF',
    faction: 'TOWN',
    name: 'Sheriff',
    icon: 'pixelarticons:search',
    color: '#4fa8ff',
    description: 'Investigador oficial del Pueblo. Busca a los infiltrados de la Mafia.',
    nightAbility: 'Elegí a 1 jugador vivo para investigarlo y saber si es Bueno o Malvado.',
  },
  TOWNIE: {
    role: 'TOWNIE',
    faction: 'TOWN',
    name: 'Aldeano',
    icon: 'pixelarticons:user',
    color: '#ffd23f',
    description: 'Poblador inocente. Descubre y lincha a la Mafia en las votaciones.',
    nightAbility: 'No tienes habilidad nocturna. El pueblo duerme...',
  },
};

/**
 * Returns balanced roles for a given player count (min 4, max 8).
 * 4 players: 1 Mafioso, 1 Doctor, 1 Sheriff, 1 Townie
 * 5 players: 1 Mafioso, 1 Doctor, 1 Sheriff, 2 Townies
 * 6 players: 2 Mafiosos, 1 Doctor, 1 Sheriff, 2 Townies
 * 7 players: 2 Mafiosos, 1 Doctor, 1 Sheriff, 3 Townies
 * 8 players: 2 Mafiosos, 1 Doctor, 1 Sheriff, 4 Townies
 */
export function getRolesForPlayerCount(playerCount: number): TownRole[] {
  if (playerCount <= 4) return ['MAFIOSO', 'DOCTOR', 'SHERIFF', 'TOWNIE'];
  if (playerCount === 5) return ['MAFIOSO', 'DOCTOR', 'SHERIFF', 'TOWNIE', 'TOWNIE'];
  if (playerCount === 6) return ['MAFIOSO', 'MAFIOSO', 'DOCTOR', 'SHERIFF', 'TOWNIE', 'TOWNIE'];
  if (playerCount === 7) return ['MAFIOSO', 'MAFIOSO', 'DOCTOR', 'SHERIFF', 'TOWNIE', 'TOWNIE', 'TOWNIE'];
  return ['MAFIOSO', 'MAFIOSO', 'DOCTOR', 'SHERIFF', 'TOWNIE', 'TOWNIE', 'TOWNIE', 'TOWNIE'];
}

export function generateTownRoleCardTemplates(): CardTemplate[] {
  return (Object.keys(TOWN_ROLES) as TownRole[]).map((roleKey) => {
    const meta = TOWN_ROLES[roleKey];
    return {
      count: 2, // Pool available in deck
      type: 'ROLE',
      color: meta.faction === 'MAFIA' ? 'MAFIA' : 'TOWN',
      value: roleKey,
      metadata: {
        ...meta,
      },
    };
  });
}

/**
 * Victory Condition Check (as specified in design document):
 * - Town wins when all living Mafia members are eliminated.
 * - Mafia wins when living Mafia members equal or exceed living Town members.
 */
export function checkTownWinCondition(
  players: Array<{ id: string; role: TownRole; isAlive: boolean }>
): 'TOWN' | 'MAFIA' | null {
  const livingPlayers = players.filter((p) => p.isAlive);
  const livingMafia = livingPlayers.filter((p) => p.role === 'MAFIOSO').length;
  const livingTown = livingPlayers.filter((p) => p.role !== 'MAFIOSO').length;

  if (livingMafia === 0) {
    return 'TOWN'; // Pueblo gana: toda la mafia fue eliminada
  }

  if (livingMafia >= livingTown) {
    return 'MAFIA'; // Mafia gana: paridad o mayoría
  }

  return null; // Partida continúa
}
