# Especificación de Diseño: Configuración de Sala en Runtime (solo Lobby)

> **Depende de:** `2026-09-25-room-membership-waiting-lobby-design.md` (modelo de sala, `options` en el estado público, `returnToLobby`, `LOBBY` con engine vacío).
>
> **Orden de merge:** después de la spec A (comparte `room.ts` y `RoomLobby.tsx`). Puede desarrollarse en paralelo con B.

## 1. Resumen y Contexto

Hoy las opciones de sala se eligen una sola vez en `CreateRoomForm.tsx` y viajan en `room:create`; después no se pueden cambiar. La `RoomOptions` efectiva ya se mergea contra la definición del juego en el constructor de `GameRoom` (`room.ts:39-74`: `disconnectGraceSeconds`, `disconnectPolicy`, `turnTimeoutSeconds`, `drawStack`, `colorMatchMode`, `targetScore`, `finishOnSpecialCard`).

Esta tarea permite al host **reconfigurar la sala desde el lobby**, reutilizando exactamente las mismas opciones y validaciones que el formulario de creación. No se permiten cambios durante la partida.

## 2. Decisiones de Producto (cerradas)

| # | Decisión |
|---|---|
| C-D1 | Solo el host puede editar. |
| C-D2 | Solo en `LOBBY` (antes de la primera partida y al volver al lobby). En `IN_PROGRESS`/`FINISHED` se rechaza. |
| C-D3 | Se editan todas las opciones: tiempos, política de desconexión, `drawStack` y reglas por juego (`targetScore`, `colorMatchMode`, `finishOnSpecialCard`). |
| C-D4 | Los cambios aplican a la próxima partida que se inicie; no hay mutación de reglas en vivo. |
| C-D5 | La UI del lobby reutiliza los mismos controles del formulario de creación (un solo componente por opción). |

## 3. Contrato (completa el de la spec A)

`room:state.options` (definido en A como `RoomPublicOptions`) refleja la configuración vigente. Evento nuevo:

```ts
'room:update_options': (
  data: { options: Partial<RoomOptions> },
  callback: (res: { success: boolean; error?: string; options?: RoomPublicOptions }) => void
) => void;
```

- `RoomOptions` ya existe en `packages/shared/src/realtime.ts` con `rematchVoteSeconds` agregado por A.
- La respuesta devuelve el estado normalizado para que el cliente no adivine defaults.

## 4. Semántica Detallada

### 4.1 Validación

Server-side, en el handler (nunca confiar en el cliente):

| Campo | Regla |
|---|---|
| `disconnectGraceSeconds` | entero 0..300 |
| `turnTimeoutSeconds` | entero 0..300 (0 = sin auto-pass, comportamiento existente) |
| `rematchVoteSeconds` | entero 5..120 |
| `disconnectPolicy` | `DISCARD_AND_CONTINUE` \| `AUTO_PASS` \| `ABORT_MATCH` |
| `drawStack` | `rule` del enum existente + booleanos; solo si el juego lo soporta (`rules.drawStack` presente o efectos `DRAW_CARDS`) |
| `colorMatchMode` | `CLASSIC` \| `BLITZ` \| `CHAOS`; solo juegos color-match |
| `targetScore` | entero 5..50; solo juegos con `winCondition.type === 'SCORE_THRESHOLD'` |
| `finishOnSpecialCard` | enum existente; solo juegos con victoria por mano vacía |

- Campos desconocidos o no soportados por el juego: error `Option '<name>' is not supported by this game`. Nada de ignorar en silencio.
- El merge es parcial: solo se pisan los campos presentes en el patch.

### 4.2 Aplicación

1. Guard: host (`room.hostId === player.id`) y `engine.getStatus() === 'LOBBY'`.
2. Validar y normalizar el patch.
3. Recalcular la `effectiveDefinition` con el mismo merge del constructor (factorizado a `buildEffectiveDefinition(definition, options)`).
4. En `LOBBY` el engine está vacío (invariante de A): no hace falta reconstruirlo; la próxima llamada a `startMatch` lo construye con la definición vigente.
5. Guardar `this.options` normalizado; `getPublicOptions()` (A) lo expone.
6. Emitir `room:state` a toda la sala y mensaje de sistema ("El host actualizó la configuración de la sala").

### 4.3 Persistencia

Las opciones viven en memoria en `GameRoom`. Redis sigue guardando solo `{ gameSlug, hostId }` (`room-manager.ts:46`). No hay migración de datos ni cambios de Prisma.

## 5. Cambios por Componente

### 5.1 `apps/server/src/realtime/room.ts`

- Extraer el merge actual del constructor a `buildEffectiveDefinition(definition, options)` (misma lógica, sin cambios de comportamiento).
- Guardar las opciones normalizadas (con defaults resueltos: `rematchVoteSeconds` = 30 si no vino, etc.) y exponerlas vía `getPublicOptions(): RoomPublicOptions` (contrato de A).
- `updateOptions(patch: Partial<RoomOptions>): RoomPublicOptions`: valida, recalcula y devuelve el estado normalizado.
- `startMatch` usa `this.definition` recalculada.

### 5.2 `apps/server/src/realtime/socket-server.ts`

- Handler `room:update_options` con guards de host y estado; llama a `room.updateOptions`; emite estado/chat; callback con error legible.
- Sin cambios en `room:create` (sigue aplicando opciones iniciales).

### 5.3 Tipos

- `packages/shared/src/realtime.ts`: evento `room:update_options` (A ya congeló `rematchVoteSeconds`).
- Réplica en `apps/client/src/types/shared/realtime.ts` y re-exports.

### 5.4 Cliente

- `apps/client/src/components/game/RoomOptionsFields.tsx` (nuevo): extrae los controles de opciones de `CreateRoomForm.tsx` (tiempos, política, `drawStack`, `targetScore`, `colorMatchMode`, `finishOnSpecialCard`) a un componente parametrizable con `value`/`onChange` y visibilidad por juego. `CreateRoomForm` y el panel del lobby lo consumen; los presets y descripciones se mueven con él.
- `apps/client/src/components/game/RoomLobby.tsx`: botón de configuración (solo host) que despliega un panel con los campos; "Guardar" emite `room:update_options`; estado de carga y error; al éxito el panel se cierra y el estado refleja los valores normalizados.
- `apps/client/src/lib/socket/actions.ts`: `updateRoomOptions(socket, options)`.
- `apps/client/src/lib/room/room-context.tsx`: exponer la acción y los `options` del estado.

## 6. Casos Borde y Fallos

| Caso | Comportamiento |
|---|---|
| No host intenta cambiar | Error `Only the room host can change options`; sin cambios. |
| Cambio en `IN_PROGRESS`/`FINISHED` | Error `Options can only be changed in the lobby`; sin cambios. |
| Valor fuera de rango | Error con el campo y el rango; sin cambios (todo o nada). |
| `drawStack` en juego sin robo | Error de opción no soportada. |
| Cambio durante una ventana de anotación (spec B) | Rechazado por estado `FINISHED`. |
| Dos cambios seguidos | El último gana; cada uno emite estado. |
| Opciones con bots/miembros en lobby | No afectan a nadie hasta `startMatch`; no se toca el engine vacío. |
| Cambio de `rematchVoteSeconds` antes de que B exista | Aceptado y expuesto en `options`; sin efecto hasta que B lo consuma. |
| Sala vuelve al lobby (A/B) | `options` se conserva; no se resetea a los defaults del juego. |

## 7. Verificación

Tests Vitest en `apps/server/tests/realtime/room-options.test.ts`:

1. Host actualiza un campo válido en lobby: `getPublicOptions()` refleja el valor y se emite estado.
2. No host es rechazado sin cambios.
3. Cambio en `IN_PROGRESS` es rechazado.
4. Valores fuera de rango rechazados y sin efecto.
5. `targetScore` actualizado cambia la definición efectiva y la próxima partida arranca con el nuevo valor.
6. Opción no soportada por el juego rechazada.
7. Patch parcial no pisa el resto.
8. `rematchVoteSeconds` sobrevive a `returnToLobby()`.

Manual: en lobby, abrir configuración, cambiar tiempo de turno y `drawStack`, guardar; verificar que la próxima partida los aplica. Verificar que un invitado no ve el botón.

## 8. Fuera de Alcance

- Cambios en vivo durante la partida (reglas o tiempos).
- Persistir opciones en Redis/DB o sobrevivir reinicios del server.
- Configuración por jugador.
- Traducción ES/EN de la UI nueva (tarea de i18n separada).

## 9. Dependencias y Coordinación

- Requiere A (estado `options`, `LOBBY` con engine vacío, `RoomLobby` con host desde el estado).
- Comparte `room.ts`, `RoomLobby.tsx` y `CreateRoomForm.tsx` con B y A: rebase antes del PR.
- Las listas de opciones y descripciones duplicadas entre `CreateRoomForm` y el nuevo panel se unifican en `RoomOptionsFields` para evitar divergencia.
