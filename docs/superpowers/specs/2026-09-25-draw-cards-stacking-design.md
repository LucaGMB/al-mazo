# Especificación de Diseño: Acumulación Configurable de Cartas de Robo (+2 / +4)

## 1. Resumen y Contexto
Al-Mazo es una plataforma modular de juegos de mesa y cartas regida por la **Ley de Cero Hardcoding**.
Esta especificación define la arquitectura para hacer que las cartas de penalización de robo (`DRAW_CARDS`: +2 y +4 comodín) sean acumulables por defecto en modalidad "Todas con todas (`ALL`)", pero totalmente configurables por partida al crear una sala y en el Editor Visual.

## 2. Decisiones de Producto y Reglas de Juego
1. **Modos de Acumulación (`DrawStackRule`)**:
   - `'ALL'` (Default): Cualquier carta de robo puede acumularse sobre otra (+2 sobre +2, +4 sobre +4, +4 sobre +2, +2 sobre +4).
   - `'SAME_TYPE'`: Solo cartas del mismo tipo/valor exacto (+2 sobre +2, +4 sobre +4).
   - `'HIGHER_OR_EQUAL'`: Cartas de penalización igual o mayor (+2 sobre +2, +4 sobre +2, +4 sobre +4; pero nunca +2 sobre +4).
   - `'OFF'`: Acumulación desactivada (comportamiento vanilla: la penalización se aplica inmediatamente al siguiente jugador).

2. **Comportamiento tras Robar el Pozo (`endsTurnOnDraw: boolean`)**:
   - Default: `true` (Terminar turno automáticamente al robar el pozo de cartas acumuladas).
   - Configurable a `false`: El jugador roba todas las cartas acumuladas pero conserva la oportunidad de jugar una carta válida en ese mismo turno.

3. **Modificador de Color para +2 sobre +4 (`allowAnyColorDraw2OnDraw4: boolean`)**:
   - Default: `true` (En modo `ALL`, un +2 de cualquier color puede responder a un +4 comodín).
   - Configurable a `false`: Exige que el +2 coincida con el color activo elegido por quien tiró el +4.

## 3. Arquitectura y Cambios por Componente

### 3.1 `@al-mazo/shared`
- **`packages/shared/src/engine.ts`**:
  - Definición de tipos:
    ```ts
    export type DrawStackRule = 'OFF' | 'SAME_TYPE' | 'HIGHER_OR_EQUAL' | 'ALL';

    export interface DrawStackConfig {
      rule: DrawStackRule;
      endsTurnOnDraw: boolean;
      allowAnyColorDraw2OnDraw4: boolean;
    }

    export const DEFAULT_DRAW_STACK_CONFIG: DrawStackConfig = {
      rule: 'ALL',
      endsTurnOnDraw: true,
      allowAnyColorDraw2OnDraw4: true,
    };
    ```
  - Incorporar `drawStack?: DrawStackConfig` a `GameRulesConfig`.
  - Incorporar `pendingDrawCount: number` a `PublicGameState`.
- **`packages/shared/src/realtime.ts`**:
  - Incorporar `drawStack?: DrawStackConfig` a `RoomOptions`.
  - Asegurar evento `'player:forced_draw': (data: { count: number; byName: string }) => void` en `ServerToClientEvents`.

### 3.2 Motor Central (`apps/server/src/engine/`)
- **`apps/server/src/engine/state-machine.ts`**:
  - Propiedad de estado interna: `protected pendingDrawCount: number = 0;`.
  - Inclusión de `pendingDrawCount` en `getPublicState()`.
  - `playCard(playerId, cardId, chosenColor)`:
    - Validación contra `pendingDrawCount` usando `validateCardPlay`.
    - Si la carta jugada tiene efecto `DRAW_CARDS`:
      - Si `rule === 'OFF'`: comportamiento previo de robo inmediato.
      - Si está habilitada: acumula `drawCount` al `pendingDrawCount`.
      - Si es WILD (+4), espera selección de color (`pendingChoice`).
      - Una vez fijado el color (o si es +2), avanza el turno en 1 paso al siguiente jugador (quien hereda la amenaza del pozo).
  - `drawCard(playerId)`:
    - Si `pendingDrawCount > 0`:
      - Roba la cantidad total `pendingDrawCount` de cartas.
      - Limpia `pendingDrawCount = 0`.
      - Si `endsTurnOnDraw === true`, finaliza el turno inmediatamente (`advanceTurn(1)`).
    - Si `pendingDrawCount === 0`:
      - Flujo estándar de robo de 1 carta.
- **`apps/server/src/engine/validator.ts`**:
  - Extender `validateCardPlay(card, topDiscardCard, activeColor, rules, pendingDrawCount?: number)`.
  - Si `pendingDrawCount && pendingDrawCount > 0`:
    - Deshabilita cualquier carta que no sea de robo (`DRAW_CARDS`).
    - Valida según `rule` (`SAME_TYPE`, `HIGHER_OR_EQUAL`, `ALL`) y `allowAnyColorDraw2OnDraw4`.
- **`apps/server/src/engine/bot.ts`**:
  - `decideBotMove`: si `pendingDrawCount > 0`, busca y prioriza jugar una carta acumulable válida en su mano; de no tenerla, retorna `null` para que el bot proceda a robar el acumulado.

### 3.3 Esquemas Oficiales (`apps/server/src/games/`)
- Actualizar `color-match`, `color-match-blitz`, `color-match-chaos`, y `descarte-criollo` con `drawStack: DEFAULT_DRAW_STACK_CONFIG`.

### 3.4 Sincronización de Salas y Servidor en Tiempo Real (`apps/server/src/realtime/`)
- **`apps/server/src/realtime/room.ts`**:
  - Sobreescribir las reglas del motor `this.engine` si `options.drawStack` fue provisto por el anfitrión al crear la sala.
- **`apps/server/src/realtime/socket-server.ts`**:
  - Al ejecutar `game:draw_card`, si `pendingDrawCount > 0`, emitir notificación de chat del sistema y evento `player:forced_draw` con el conteo de cartas robadas.

### 3.5 Frontend y Editor Visual (`apps/client/`)
- **`CreateRoomForm.tsx`**:
  - Selector en opciones avanzadas para `Regla de acumulación (+2 / +4)`:
    - Todas con todas (`ALL`)
    - Solo cartas iguales (`SAME_TYPE`)
    - Igual o mayor (`HIGHER_OR_EQUAL`)
    - Desactivada (`OFF`)
  - Checkboxes para `Terminar turno al robar pozo` y `Permitir +2 de cualquier color sobre +4`.
- **`RulesSection.tsx`**:
  - Controles en el Editor Visual para que cualquier juego custom pueda definir o anular la regla de acumulación.
- **`MesaPage.tsx` y `DiscardPile.tsx`**:
  - Indicador visual prominente `🔥 Acumulado +N` sobre el descarte / mesa cuando `pendingDrawCount > 0`.
  - Botón de robo con feedback del pozo a robar si es el turno del jugador y no puede contrarrestar.

## 4. Plan de Pruebas y Validación
1. **Tests unitarios del motor**:
   - Acumulación +2 sobre +2 (+4 acumulado).
   - Acumulación +4 sobre +2 (+6 acumulado).
   - Modo `SAME_TYPE` rechaza +4 sobre +2.
   - Modo `HIGHER_OR_EQUAL` permite +4 sobre +2 pero rechaza +2 sobre +4.
   - Modo `OFF` aplica robo inmediato sin acumulación.
   - Robo del pozo acumulado extrae todas las cartas acumuladas y pasa el turno.
   - Elección de color en comodín +4 acumulado.
2. **Tests de integración de socket / salas**:
   - Creación de sala con opciones custom de `drawStack`.
   - Emisión de `player:forced_draw` y actualización de `publicState.pendingDrawCount`.
3. **Tests de IA de bots**:
   - Bot acumula si tiene carta válida.
   - Bot roba el pozo si no tiene carta para responder.
4. **Verificación visual y de build**:
   - `pnpm lint`, `pnpm build`, `pnpm test`.
