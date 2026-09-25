# Acumulación Configurable de Cartas de Robo (+2 y +4)

Hacer que las cartas de penalización de robo (`DRAW_CARDS`: +2 y +4) sean acumulables por defecto en modalidad "Todas con todas (`ALL`)", totalmente configurables por partida al crear una sala y en el Editor Visual, cumpliendo estrictamente con la Ley de Cero Hardcoding.

## User Review Required

> [!IMPORTANT]
> - **Valores por Defecto Definidos**:
>   1. Regla de acumulación: `ALL` (Todas con todas: +2 sobre +2, +4 sobre +4, +4 sobre +2, +2 sobre +4 libremente).
>   2. Fin de turno al robar el pozo: `true` (Robar el acumulado termina el turno automáticamente).
>   3. Modificador de color (+2 sobre +4): `true` (Cualquier +2 de cualquier color puede responder a un +4).
> - **Configurabilidad por Partida**: El anfitrión de la sala puede personalizar estas 3 opciones desde la pantalla de creación de sala (en opciones avanzadas) o en el Editor de Juegos.

## Proposed Changes

Grupo de cambios organizados por capas:

---

### Shared (`packages/shared`)

#### [MODIFY] [engine.ts](file:///home/lucagmb/workspace/2026/greatx-labs/al-mazo/packages/shared/src/engine.ts)
- Definir tipos `DrawStackRule`: `'OFF' | 'SAME_TYPE' | 'HIGHER_OR_EQUAL' | 'ALL'`.
- Definir interfaz `DrawStackConfig` con `rule`, `endsTurnOnDraw`, `allowAnyColorDraw2OnDraw4`.
- Definir constante `DEFAULT_DRAW_STACK_CONFIG`.
- Agregar `drawStack?: DrawStackConfig` en `GameRulesConfig`.
- Agregar `pendingDrawCount: number` en `PublicGameState`.

#### [MODIFY] [realtime.ts](file:///home/lucagmb/workspace/2026/greatx-labs/al-mazo/packages/shared/src/realtime.ts)
- Agregar `drawStack?: DrawStackConfig` en `RoomOptions`.
- Asegurar evento `'player:forced_draw': (data: { count: number; byName: string }) => void` en `ServerToClientEvents`.

---

### Servidor & Motor Modular (`apps/server`)

#### [MODIFY] [validator.ts](file:///home/lucagmb/workspace/2026/greatx-labs/al-mazo/apps/server/src/engine/validator.ts)
- Extender `validateCardPlay` para aceptar `pendingDrawCount?: number`.
- Si `pendingDrawCount > 0`, rechazar cartas que no tengan efecto `DRAW_CARDS`.
- Validar según regla activa (`ALL`, `SAME_TYPE`, `HIGHER_OR_EQUAL`) y modificador de color.

#### [MODIFY] [state-machine.ts](file:///home/lucagmb/workspace/2026/greatx-labs/al-mazo/apps/server/src/engine/state-machine.ts)
- Agregar `pendingDrawCount: number = 0` al estado del motor.
- En `playCard`:
  - Si la carta jugada tiene efecto `DRAW_CARDS` y la regla no es `'OFF'`, sumar `drawCount` a `pendingDrawCount`.
  - Si requiere elegir color (+4), guardar elección antes de avanzar.
  - Al completar la jugada, avanzar el turno al jugador atacado (quien recibe la penalización).
- En `drawCard`:
  - Si `pendingDrawCount > 0`, robar la cantidad acumulada, reiniciar `pendingDrawCount = 0`, y si `endsTurnOnDraw === true`, pasar turno automáticamente.
- Exponer `pendingDrawCount` en `getPublicState()`.

#### [MODIFY] [bot.ts](file:///home/lucagmb/workspace/2026/greatx-labs/al-mazo/apps/server/src/engine/bot.ts)
- Actualizar `decideBotMove` para pasar `pendingDrawCount`.
- Si hay un pozo acumulado, priorizar responder con una carta de robo acumulable válida; si no hay, retornar `null` para robar el acumulado.

#### [MODIFY] [color-match/definition.ts](file:///home/lucagmb/workspace/2026/greatx-labs/al-mazo/apps/server/src/games/color-match/definition.ts)
#### [MODIFY] [color-match-blitz/definition.ts](file:///home/lucagmb/workspace/2026/greatx-labs/al-mazo/apps/server/src/games/color-match-blitz/definition.ts)
#### [MODIFY] [color-match-chaos/definition.ts](file:///home/lucagmb/workspace/2026/greatx-labs/al-mazo/apps/server/src/games/color-match-chaos/definition.ts)
#### [MODIFY] [descarte-criollo/definition.ts](file:///home/lucagmb/workspace/2026/greatx-labs/al-mazo/apps/server/src/games/descarte-criollo/definition.ts)
- Incorporar `drawStack: DEFAULT_DRAW_STACK_CONFIG` en las reglas oficiales.

#### [MODIFY] [room.ts](file:///home/lucagmb/workspace/2026/greatx-labs/al-mazo/apps/server/src/realtime/room.ts)
- Aplicar `options.drawStack` a las reglas de la sala si fue especificado por el creador.

#### [MODIFY] [socket-server.ts](file:///home/lucagmb/workspace/2026/greatx-labs/al-mazo/apps/server/src/realtime/socket-server.ts)
- Emitir mensaje de chat del sistema y evento `player:forced_draw` cuando un jugador roba el pozo acumulado.

---

### Frontend Client (`apps/client`)

#### [MODIFY] [CreateRoomForm.tsx](file:///home/lucagmb/workspace/2026/greatx-labs/al-mazo/apps/client/src/components/game/CreateRoomForm.tsx)
- Agregar controles interactivos en "Opciones avanzadas":
  - Selector de variante: Todas con todas (`ALL`), Solo iguales (`SAME_TYPE`), Igual o mayor (`HIGHER_OR_EQUAL`), Desactivado (`OFF`).
  - Checkbox para terminar turno tras robar pozo.
  - Checkbox para permitir +2 de cualquier color sobre +4.
- Enviar `options.drawStack` al emitir `room:create`.

#### [MODIFY] [RulesSection.tsx](file:///home/lucagmb/workspace/2026/greatx-labs/al-mazo/apps/client/src/components/editor/RulesSection.tsx)
- Agregar controles para la configuración de `drawStack` en el Editor Visual.

#### [MODIFY] [DiscardPile.tsx](file:///home/lucagmb/workspace/2026/greatx-labs/al-mazo/apps/client/src/components/game/DiscardPile.tsx) / [page.tsx](file:///home/lucagmb/workspace/2026/greatx-labs/al-mazo/apps/client/src/app/juego/%5Bslug%5D/mesa/%5BroomCode%5D/page.tsx)
- Mostrar un indicador visual llamativo (`🔥 POZO: +N`) en la mesa cuando `pendingDrawCount > 0`.
- El botón de robo indica cuántas cartas se van a robar (ej: "Robar 6 cartas") si es el turno del jugador y hay pozo acumulado.

---

## Verification Plan

### Automated Tests
1. **Tests unitarios del motor**:
   - `apps/server/tests/engine/draw-stacking.test.ts` (Nuevo archivo de pruebas dedicadas):
     - Acumulación de +2 sobre +2 (+4 en pozo).
     - Acumulación de +4 sobre +2 (+6 en pozo) y elección de color.
     - Acumulación de +2 sobre +4 con cualquier color y con color estricto.
     - Variantes `SAME_TYPE` y `HIGHER_OR_EQUAL`.
     - Modo `OFF` (robo directo sin acumulación).
     - Robo del pozo acumulado con fin de turno automático y sin fin de turno.
     - Descarte o juego no permitido cuando hay un pozo pendiente.
     - Comportamiento de bot ante pozo pendiente.
2. **Ejecución de suite completa**:
   - `pnpm test` (Vitest)
   - `pnpm build`
   - `pnpm lint`

### CI/CD, PR y Merge
- Crear rama `feat/draw-cards-stacking` (ya creada sobre `origin/main`).
- Push a GitHub: `git push -u origin feat/draw-cards-stacking`.
- Crear Pull Request: `gh pr create --title "feat(engine): configurable draw card stacking per match and editor" --body "..."`.
- Auto-merge o merge a main: `gh pr merge --auto --squash --delete-branch` (o `gh pr merge --squash --delete-branch`).
