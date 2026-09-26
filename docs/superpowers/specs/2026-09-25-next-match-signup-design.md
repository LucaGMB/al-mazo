# Especificación de Diseño: Anotarse para la Próxima Partida (Revancha por Jugador)

> **Depende de:** `2026-09-25-room-membership-waiting-lobby-design.md` (contrato congelado: miembros vs jugadores, `wantsNext`, `hostId`, `rematch` en el estado público).
>
> **Orden de merge:** después de la spec A. Rebase obligatorio antes del PR.

## 1. Resumen y Contexto

Hoy el botón "Jugar de nuevo" de la pantalla final llama a `room:start`, que el server permite solo al host (`socket-server.ts:461`) y que resetea la partida para **todos** los `players` (`modular-engine.ts:245`). Los jugadores no host que tocan el botón reciben un error.

Esta tarea reemplaza ese flujo por una **anotación por jugador** con ventana de tiempo automática al terminar la partida:

- Los finishers se anotan con un toggle ("Quiero jugar la próxima").
- Los waiters entran auto-anotados (regla A-D3).
- Al vencer la ventana: si los anotados conectados + bots llegan a `minPlayers`, arranca la próxima partida con ellos; si no, la sala vuelve a `LOBBY` con todos los presentes.
- Nadie es expulsado: el no anotado queda como waiter/espectador.
- El host conserva un botón "Volver al lobby" que cancela la ventana y devuelve a todos.

## 2. Decisiones de Producto (cerradas)

| # | Decisión |
|---|---|
| B-D1 | La ventana se abre automáticamente al terminar la partida; el deadline es server-authoritative y viaja en `room:state`. |
| B-D2 | `rematchVoteSeconds` default 30s, configurable al crear la sala y en runtime en lobby (spec C). |
| B-D3 | Waiters auto-anotados; finishers opt-in con toggle (pueden des-anotarse antes de que arranque). |
| B-D4 | Arranque temprano solo si **todos los humanos presentes ya están anotados** y ninguno está en gracia de desconexión. Si alguien no decidió, manda el deadline. |
| B-D5 | Al deadline con quórum: arrancan los anotados conectados + bots, hasta `maxPlayers` por orden de anotación; el resto queda waiter. Requiere al menos 1 humano anotado. |
| B-D6 | Al deadline sin quórum: cancela la ventana y `returnToLobby()` con todos los presentes. No hay expulsiones. |
| B-D7 | Bots: no cuentan para la unanimidad, son anotados permanentes y cuentan para `minPlayers`. |
| B-D8 | Un humano desconectado durante la ventana bloquea el arranque temprano; al deadline solo se sientan los conectados. Al reconectar, conserva su anotación. |
| B-D9 | "Volver al lobby" es host-only e inmediato: cancela la ventana y devuelve a todos los miembros presentes a `LOBBY`. |
| B-D10 | La pantalla final muestra tres caminos claros: "Quiero jugar la próxima" (toggle), "Volver al lobby" (host) y "Volver al catálogo" (leave). |

## 3. Contrato (completa el de la spec A)

Se usa el campo `rematch` de `PublicGameState` definido en A:

```ts
rematch: { deadline: number; signups: string[] } | null
```

Eventos nuevos:

```ts
'room:rematch_vote': (
  data: { want: boolean },
  callback: (res: { success: boolean; error?: string }) => void
) => void;

'room:return_lobby': (
  callback: (res: { success: boolean; error?: string }) => void
) => void;
```

`wantsNext` por miembro es la fuente de verdad; `rematch.signups` es su proyección pública (incluye bots).

## 4. Semántica Detallada

### 4.1 Apertura de la ventana

En `emitGameFinished` (`socket-server.ts:78`), después de emitir `game:finished`:

1. Solo si el engine quedó `FINISHED` y `rematch === null` (idempotente).
2. Todos los miembros pasan a `WAITING`; los humanos que estaban `PLAYING` quedan `wantsNext = false`; bots y waiters conservan `wantsNext = true`.
3. `rematch = { deadline: now + rematchVoteSeconds * 1000, signups: ids con wantsNext }`.
4. `startRematchTimer()`: al disparar, `evaluateRematchDeadline()`.
5. `game:started` limpia la ventana (`rematch = null`, timer cancelado).

Si la sala quedó vacía, `dispose()` cancela el timer.

### 4.2 `room:rematch_vote`

- Requiere: miembro de la sala, `rematch !== null`, `!isBot`.
- `want: true` agrega al final de `signups` (orden de anotación); `want: false` lo quita.
- Setea `wantsNext` y re-emite `room:state`.
- Tras cada cambio evalúa `tryEarlyStart()`.

### 4.3 Arranque temprano (B-D4)

Condición exacta, evaluada tras cada voto, join, leave, reconnect y desconexión:

```
rematch activo
∧ todos los miembros humanos tienen wantsNext === true
∧ todos los miembros humanos están conectados (ninguno en gracia)
```

Si se cumple: `startFromRematch()` con todos los humanos anotados y los bots como relleno hasta `maxPlayers`.

### 4.4 Deadline (B-D5 / B-D6)

```
humanos = signups conectados, no bots, en orden de anotación
seleccionados = humanos (hasta maxPlayers) + bots para cubrir los cupos restantes (hasta maxPlayers)
si humanos.length >= 1 ∧ seleccionados.length >= minPlayers:
    startFromRematch(seleccionados)
sino:
    notificar "Faltan jugadores para arrancar; vuelven al lobby"
    returnToLobby()
```

Los bots nunca desplazan a un humano anotado: primero se sientan los humanos por orden de anotación y luego los bots hasta completar `maxPlayers`.

- `minPlayers` sale de `definition.rules.minPlayers`.
- `startFromRematch` usa `GameRoom.startMatch()` (spec A). Si el engine lanza (ej. datos corruptos), se loguea, se notifica y `returnToLobby()`.
- Los humanos anotados que quedaron fuera por `maxPlayers` conservan `wantsNext = true` y quedan waiters.

### 4.5 `room:return_lobby`

- Requiere host y `FINISHED`. Cancela el timer, `rematch = null`, `returnToLobby()`.
- Emite `room:state` y mensaje de sistema ("El host devolvió la sala al lobby").
- No remueve a nadie.

### 4.6 Desconexiones y reconexiones durante la ventana

- Un miembro que se desconecta conserva su `wantsNext`; su voto no se pierde.
- Mientras tenga gracia activa, `tryEarlyStart()` no dispara (condición de conectados).
- Al deadline, si no reconectó, no se lo sienta; queda waiter.
- Al reconectar, recibe el `rematch` vigente y sigue participando si el deadline no venció.

## 5. Cambios por Componente

### 5.1 `apps/server/src/realtime/room.ts`

- Campos: `rematch: RematchPublicState | null`, `rematchTimer?: NodeJS.Timeout`, `signupOrder: string[]`.
- Métodos: `openRematchWindow()`, `setRematchVote(id, want)`, `tryEarlyStart()`, `evaluateRematchDeadline()`, `startFromRematch(ids)`, `cancelRematch()`.
- `getRematchState()` devuelve `rematch` (A lo dejó en `null` hasta esta spec).
- `returnToLobby()` (A) limpia `rematch` y el timer.
- `removePlayer` quita al miembro de `signups`.
- `dispose()` cancela el timer.

### 5.2 `apps/server/src/realtime/socket-server.ts`

- `emitGameFinished`: llama a `room.openRematchWindow()`.
- Nuevos handlers `room:rematch_vote` y `room:return_lobby` con guards de estado/miembro/host.
- `room:join` en `FINISHED` con ventana activa: el waiter entra con `wantsNext=true` y se re-evalúa el arranque temprano.
- Mensajes de sistema: apertura de ventana ("La revancha está abierta: 30s"), inicio con anotados, retorno a lobby por falta de jugadores.

### 5.3 Tipos

- `packages/shared/src/realtime.ts`: eventos nuevos (ya congelados en A, se implementan acá).
- Réplica exacta en `apps/client/src/types/shared/realtime.ts` + re-exports.

### 5.4 Cliente

- `apps/client/src/lib/socket/actions.ts`: `rematchVote(socket, want)` y `returnToLobby(socket)`.
- `apps/client/src/lib/room/room-context.tsx`: acciones conectadas; sin cambios de reducer más allá de los campos nuevos del estado.
- `apps/client/src/app/juego/[slug]/mesa/[roomCode]/page.tsx` (branch `FINISHED`):
  - Resultado de la partida (queda igual).
  - Contador: "`X` de `N` quieren jugar" (`N` = humanos presentes; `X` = humanos anotados).
  - Countdown `mm:ss` derivado de `rematch.deadline` con corrección por `Date.now()` local.
  - Botón toggle "Quiero jugar la próxima" / "Anotado ✓" (deshabilitado mientras se envía; des-anotarse permitido).
  - Botón "Volver al lobby" visible solo para el host del estado (`hostId === selfPlayerId`).
  - Botón "Volver al catálogo" (leave, existente).
  - Estado sin ventana (`rematch === null`): solo catálogo + lobby (host); la ventana debería estar activa, pero el cliente no debe romper si llega `null`.

## 6. Casos Borde y Fallos

| Caso | Comportamiento |
|---|---|
| Nadie se anota | Al deadline no hay quórum → `returnToLobby()` con todos. |
| Todos se anotan (incluidos waiters) | Arranque temprano sin esperar el deadline. |
| Un humano no decide y los demás sí | Se espera al deadline; al vencer arranca con anotados conectados. |
| Un anotado se desconecta y reconecta | Conserva el voto; se reevalúa el arranque. |
| Un anotado se desconecta y no vuelve | No se lo sienta; si el resto llega a `minPlayers`, arrancan sin él. |
| Anfritrión (host) no anotado | No afecta el arranque; conserva su botón de volver al lobby. |
| Host se va de la sala durante la ventana | Reasignación de A; el nuevo host puede volver al lobby. |
| Toggle justo cuando vence el timer | Node es single-thread; el deadline limpia `rematch` y cancela el timer antes de evaluar; un voto posterior al cierre recibe error `Rematch window is closed`. |
| `engine.start()` falla al arrancar por anotación | Notificación y `returnToLobby()`. |
| Sala vacía durante la ventana | `dispose()` cancela el timer (sin timers colgados). |
| Partida PROMPT termina | Mismo flujo (pantalla "Se acabaron las preguntas" + ventana). |
| `game:finished` emitido dos veces | `openRematchWindow()` es idempotente por `rematch !== null`. |

## 7. Verificación

Tests Vitest en `apps/server/tests/realtime/rematch.test.ts`:

1. Al terminar la partida se abre la ventana con deadline y signups esperados.
2. Un finisher que no se anota no entra en `signups`; un waiter sí (auto).
3. Toggle agrega/quita y re-emite estado; usuario ajeno recibe error.
4. Unanimidad de humanos presentes dispara arranque temprano antes del deadline.
5. Con un humano en gracia, no hay arranque temprano.
6. Deadline con quórum arranca con anotados conectados + bots; overflow por `maxPlayers` queda waiter.
7. Deadline sin quórum ejecuta `returnToLobby()` con todos y limpia la ventana.
8. `room:return_lobby` host-only, cancela la ventana y no remueve a nadie.
9. Al inicio de la nueva partida, `wantsNext` de los sentados queda `false` y `rematch` es `null`.
10. `dispose()` cancela el timer.
11. Reconnect durante la ventana preserva la anotación.

Manual: partida de 2, uno toca "Quiero jugar", el otro no → al vencer arranca con los dos si ambos se anotaron; si solo uno, vuelven al lobby. Esperar el deadline sin tocar nada y verificar que nadie sea expulsado.

## 8. Fuera de Alcance

- Mayoría simple (solo unanimidad temprana + quórum al deadline).
- Persistencia de votos entre reinicios del server.
- Notificaciones push/email del resultado de la ventana.
- Traducción ES/EN de la nueva UI (tarea de i18n separada).

## 9. Dependencias y Coordinación

- Requiere A mergeada (miembros, `wantsNext`, `returnToLobby`, `startMatch`).
- La spec C expone `rematchVoteSeconds` en el panel de lobby; si C mergea antes que B, el campo se mantiene sin UI de votación.
- Toca `room.ts`, `socket-server.ts`, `room-context.tsx`, `actions.ts` y la página de mesa: coordinar rebase con C.
