# Especificación de Diseño: Modelo de Sala — Miembros, Sala de Espera y Espectador

> **Estado:** contrato congelado. Las specs B (`next-match-signup`) y C (`room-runtime-settings`) dependen de este documento. Cualquier cambio aquí invalida a las otras dos.
>
> **Orden de merge:** esta tarea mergea primero. B y C rebasean sobre ella.

## 1. Resumen y Contexto

Hoy `GameRoom.players` cumple dos roles a la vez: son los **miembros de la sala** y los **jugadores del engine**. Al unirse, `GameRoom.addPlayer` agrega al engine directamente (`room.ts:76`), y `room:join` no valida estado ni capacidad (`room-manager.ts:55`). No existe forma de esperar en una sala con partida en curso, ni de volver a un lobby después de terminar.

Esta tarea separa ambos conceptos: los miembros viven en la sala; el engine contiene solo a los que juegan la partida actual. Habilita:

1. Ingresar a una sala con partida en curso como **waiter** y ver la mesa como espectador.
2. Volver al **lobby** tras terminar una partida, sin expulsar a nadie.
3. Host reasignable y autoridad derivada del estado del servidor (no del `localStorage`).

Es la base sobre la que B (anotarse para la próxima) y C (config en runtime en lobby) se apoyan.

## 2. Decisiones de Producto (cerradas)

| # | Decisión |
|---|---|
| A-D1 | `maxPlayers` limita a quién juega la partida, no a quién está en la sala. Tope duro de sala: 16 miembros. |
| A-D2 | Si hay más anotados que cupos, juegan los primeros por orden de anotación; el resto queda waiter. |
| A-D3 | Un ingreso a sala en `IN_PROGRESS` o `FINISHED` entra como waiter con `wantsNext = true`. |
| A-D4 | En `LOBBY` todos los presentes son elegibles para arrancar (todos `wantsNext = true`). |
| A-D5 | Nadie es expulsado por no anotarse: la sala siempre conserva a sus miembros. Solo `room:leave` o la gracia de desconexión vencida remueven. |
| A-D6 | El waiter ve la partida en vivo en modo solo-lectura (info pública, sin manos) + chat. |
| A-D7 | `hostId` se expone en `room:state`; si el host sale, se reasigna al miembro conectado más antiguo. El cliente deriva `isHost` del estado. |
| A-D8 | El reporte de partidas deja de depender de `localStorage.creds.isHost`. |

## 3. Contrato Congelado

### 3.1 Terminología

- **Miembro**: entrada en `GameRoom.players` (todos los que están en la sala).
- **Jugador (`PLAYING`)**: miembro que participa de la partida actual; está en el engine.
- **Waiter (`WAITING`)**: miembro que no participa de la partida actual; no está en el engine.
- **Anotado (`wantsNext`)**: miembro que quiere jugar la próxima partida. Los waiters entran anotados; los jugadores deben anotarse al terminar (spec B). En `LOBBY` todos son `wantsNext = true`.
- **Host**: `GameRoom.hostId`, mutable, reasignable.

### 3.2 Invariantes

1. `engine.getPublicState().players` contiene exactamente a los miembros con `membership === 'PLAYING'` y en el mismo orden.
2. En `LOBBY` el engine está vacío (no arrancado) y todos los miembros son `WAITING`.
3. `room.players` nunca supera los 16 miembros.
4. `wantsNext` de un miembro `PLAYING` se resetea a `false` cuando termina la partida y a `false` al sentarse a jugar.
5. Los bots son miembros `PLAYING` mientras juegan y `wantsNext = true` siempre.
6. La fuente de verdad del estado es `room:state`; no se agregan eventos de estado nuevos.

### 3.3 Estado Público

Se agrega a `PublicGameState` (en `packages/shared/src/engine.ts` y su copia en el cliente):

```ts
export type RoomMembership = 'PLAYING' | 'WAITING';

// PlayerPublicInfo (existente) + :
membership: RoomMembership;
wantsNext: boolean;
// Para WAITING: cardCount = 0, seatIndex = -1.

// PublicGameState (existente) + :
hostId: string;
options: RoomPublicOptions;
rematch: RematchPublicState | null;
```

```ts
export interface RoomPublicOptions {
  disconnectGraceSeconds: number;
  disconnectPolicy: DisconnectPolicy;
  turnTimeoutSeconds: number;
  rematchVoteSeconds: number;
  drawStack?: DrawStackConfig;
  colorMatchMode?: ColorMatchMode;
  targetScore?: number;
  finishOnSpecialCard?: FinishOnSpecialCardRule;
}

export interface RematchPublicState {
  deadline: number;      // epoch ms, server-authoritative
  signups: string[];     // ids de miembros con wantsNext = true (incluye bots)
}
```

`GameRoom.getPublicState()` compone el estado del engine con la lista de miembros (membership, wantsNext) y los campos de sala (`hostId`, `options`, `rematch`). En `LOBBY` el engine está vacío y el estado sale igual de esta composición.

### 3.4 Eventos

```ts
// ClientToServerEvents
'room:join'           // sin cambios de firma; cambia la semántica (ver 3.6)
'room:start'          // sin cambios de firma; ahora solo válido en LOBBY (host)
'room:add_bot'        // sin cambios; solo LOBBY (host)
'room:remove_bot'     // sin cambios; solo LOBBY (host)

// Spec B agrega: 'room:rematch_vote', 'room:return_lobby'
// Spec C agrega: 'room:update_options'
```

Para esta tarea no se agregan eventos nuevos: los cambios de membresía viajan por `room:state`.

### 3.5 Ciclo de Vida

```
LOBBY ──host start──► IN_PROGRESS ──fin──► FINISHED (ventana de anotación, spec B)
  ▲                        │                     │
  │ join → miembro         │ join → WAITING      │ superada la ventana → IN_PROGRESS o LOBBY
  │ (wantsNext=true)       │ (wantsNext=true)    │
  │                        │                     │
  └──── host "volver al lobby" (spec B) ─────────┘
```

Transiciones implementadas en esta tarea:
- `LOBBY → IN_PROGRESS` vía `room:start` (host): se construye un engine nuevo con los miembros seleccionados.
- `IN_PROGRESS → FINISHED`: transición del engine existente (la ventana de anotación es de la spec B).
- `FINISHED → LOBBY` vía `GameRoom.returnToLobby()` (mecanismo; el botón y evento son de la spec B): el engine se descarta y la sala queda con todos los miembros presentes en `WAITING` y `wantsNext = true`.

### 3.6 Matriz de Reglas

| Acción | Estado | Quién | Resultado |
|---|---|---|---|
| `room:join` | cualquier estado, sala < 16 | cualquiera | Nuevo miembro. En `LOBBY`: `WAITING`, `wantsNext=true`. En `IN_PROGRESS`/`FINISHED`: `WAITING`, `wantsNext=true`. En `FINISHED` con ventana activa: entra anotado (spec B). |
| `room:join` | sala con 16 miembros | cualquiera | Rechazado: `Room is full (16)`. |
| `room:reconnect` | cualquier estado | miembro con token | Restaura conexión. Si es waiter, sigue waiter. Recibe `room:state` completo y `player:hand` vacío. |
| `room:leave` | cualquier estado | miembro | Se remueve de `players` y de `signups` si estaba. Si era host, se reasigna. |
| desconexión | cualquier estado | cualquier miembro | Aplica gracia. Al vencer, se remueve. Un waiter desconectado no afecta al engine. |
| `room:start` | `LOBBY` | host | Selecciona hasta `maxPlayers` miembros por orden de ingreso; los seleccionados pasan a `PLAYING`, el resto queda `WAITING` con `wantsNext=true`. |
| `room:start` | `IN_PROGRESS`/`FINISHED` | host | Rechazado: `Can only start from the lobby`. (Fix del reset en partida en curso.) |
| `room:add_bot` | `LOBBY` | host | Agrega bot como miembro `WAITING`, `wantsNext=true`, `isBot=true`. |
| `room:add_bot` | `IN_PROGRESS`/`FINISHED` | host | Rechazado: `Bots can only be added in the lobby`. |
| `room:remove_bot` | `LOBBY` | host | Remueve bot miembro. |
| `chat:send` | cualquier estado | cualquier miembro | Permitido (waiters incluidos). |
| `player:hand` | — | solo `PLAYING` | Los waiters nunca reciben manos. |

## 4. Cambios por Componente

### 4.1 `packages/shared`

- `packages/shared/src/engine.ts`: `RoomMembership`, campos nuevos en `PlayerPublicInfo` y `PublicGameState`, `RoomPublicOptions`, `RematchPublicState`.
- `packages/shared/src/realtime.ts`: `rematchVoteSeconds?: number` en `RoomOptions` (lo consume la spec B, pero el tipo se congela acá para no tocar el contrato dos veces).

### 4.2 Copia de tipos del cliente

La copia local debe actualizarse en paralelo (el cliente NO importa `@al-mazo/shared`):

- `apps/client/src/types/shared/engine.ts` y `apps/client/src/types/shared/realtime.ts` (copia).
- `apps/client/src/types/engine.ts` y `apps/client/src/types/realtime.ts` (re-export).
- `apps/client/src/types/shared/index.ts` si agrega nuevos módulos.

### 4.3 `apps/server/src/realtime/types.ts`

```ts
export interface RoomPlayer {
  id: string;
  name: string;
  socketId: string | null;
  reconnectToken: string;
  isConnected: boolean;
  isBot: boolean;
  membership: 'PLAYING' | 'WAITING';
  wantsNext: boolean;
  disconnectTimer?: NodeJS.Timeout;
}
```

### 4.4 `apps/server/src/realtime/room.ts`

- `hostId` deja de ser `readonly`.
- `engine` deja de ser `readonly` (se reemplaza por instancia nueva al arrancar; verificado que nadie cachea referencias).
- El constructor ya no llama a `engine.addPlayer` por el host: crea un engine vacío con la definición efectiva.
- Nuevos métodos:
  - `addMember(id, name, socketId, token, isBot?)`: agrega a `players` con membership/wantsNext según estado y devuelve el miembro. No toca el engine.
  - `buildEngineFor(selectedIds: string[])`: reemplaza `this.engine` por una instancia nueva y agrega a los seleccionados; los marca `PLAYING` y `wantsNext=false`.
  - `startMatch(selectedIds)`: `buildEngineFor` + `engine.start()`. Arroja si el engine falla; el llamador decide el rollback (volver a LOBBY).
  - `returnToLobby()`: descarta el engine (instancia vacía), todos los miembros a `WAITING` y `wantsNext=true`, limpia `turnExpiresAt`/timers de turno.
  - `promoteHostIfNeeded()`: si el host ya no está, asigna al conectado más antiguo (orden del Map); si no hay conectados, al más antiguo.
  - `getMembership(id)`, `getPublicOptions()` y `getRematchState()` (este último devuelve `null` hasta la spec B).
- `getPublicState()`: compone engine + miembros (ver 3.3). `players` sale siempre de `room.players`, en orden de ingreso; para `PLAYING` se enriquece con `cardCount`/`seatIndex` del engine.
- `handleDisconnect` / `handleReconnect`: aplican a cualquier miembro; solo llaman `engine.setPlayerConnection` si `membership === 'PLAYING'`.
- `removePlayer`: remueve del engine solo si era `PLAYING`; de `signups` si estaba; reasigna host; no propaga `ABORT_MATCH` por desconexión de waiters.
- `dispose()`: limpia timers de votación si existen (spec B) y de desconexión de todos los miembros.

### 4.5 `apps/server/src/realtime/room-manager.ts`

- `joinRoom`: valida `room.players.size < 16`; delega la creación del miembro en `room.addMember` (waiter salvo `LOBBY`). Error claro si la sala no existe o está llena.
- `deleteRoom`: sin cambios funcionales; sigue limpiando Redis.

### 4.6 `apps/server/src/realtime/socket-server.ts`

- `room:join`: mismo flujo; al emitir `player:joined` y `room:state` ahora viajan waiters. El mensaje de sistema distingue ingreso a partida en curso (`X entró a esperar la próxima`).
- `room:start`: guard `status === 'LOBBY'`; selección por orden de ingreso hasta `maxPlayers`; emite `game:started`, `room:state` y manos solo a `PLAYING` (el helper `broadcastPlayerHands` debe filtrar por membership).
- `room:add_bot` / `room:remove_bot`: guard de estado `LOBBY`.
- `room:leave`: tras `removePlayer` llama a `promoteHostIfNeeded()` y emite `room:state`; el que se va recibe `player:left` como hoy.
- `scheduleTurnLifecycle`, `broadcastPlayerHands`, `emitSystemChat` y los caminos de bots deben leer `room.engine` (property read) y saltear waiters.
- Desconexión de un waiter: no programa `scheduleTurnLifecycle` ni toca el turno.

### 4.7 Cliente

- `apps/client/src/lib/socket/actions.ts`: sin eventos nuevos; nada que agregar en esta tarea salvo tipos.
- `apps/client/src/lib/room/room-context.tsx`:
  - `isHost` deja de leerse de `creds`; se deriva `publicState.hostId === selfPlayerId` (o se expone `hostId` en el contexto).
  - Exponer `membership` y `wantsNext` propios y del resto.
  - `joinRoom` sigue igual; manejar el error de sala llena.
- `apps/client/src/lib/room/credentials.ts`: se conserva `isHost` por compatibilidad de credenciales, pero deja de ser autoridad.
- `apps/client/src/lib/room/use-room.ts`: sin cambios de contrato.
- `apps/client/src/app/juego/[slug]/mesa/[roomCode]/page.tsx`:
  - `hostPlayerId` sale de `publicState.hostId`, no de `players[0]`.
  - `assignSeats` y los render de juego filtran `membership === 'PLAYING'`.
  - Nuevo branch: si `self.membership === 'WAITING'` y `status === 'IN_PROGRESS'`, renderiza `<WaitingRoom />` (espectador).
- `apps/client/src/components/game/WaitingRoom.tsx` (nuevo): mesa en modo solo-lectura + chat. Reutiliza los componentes de mesa actuales con controles deshabilitados (`canAct=false`, sin mano, sin botones de acción). Muestra "Partida en curso — entrás en la próxima".
- `apps/client/src/components/game/RoomLobby.tsx`: `hostPlayerId` desde `publicState.hostId`; los waiters no existen en `LOBBY` (todos son elegibles), así que no cambia la lista.

### 4.8 `apps/server/src/realtime/room-manager.test.ts` y tests nuevos

Ver sección 7.

## 5. Casos Borde y Fallos

| Caso | Comportamiento |
|---|---|
| Sala llena (16) | `room:join` rechazado con error legible. No afecta a partidas de hasta 12 según validador de juegos. |
| Host se va de la sala | `promoteHostIfNeeded()` al conectado más antiguo; si no hay conectados, al más antiguo restante. |
| Host cae (desconectado, no removido) | Sigue siendo host hasta que la gracia venza y se remueva. |
| Todos se van | La sala queda vacía en memoria (comportamiento actual; no se agrega cleanup por sala vacía en esta tarea). |
| Waiter reconecta | Mismo `room:reconnect`; recibe estado y hand vacío; sigue `WAITING`. |
| Miembro `PLAYING` reconecta | Recibe su mano; vuelve a `PLAYING`. |
| Bots en lobby | `room:add_bot` los crea como miembros `WAITING` con `wantsNext=true`; recién entran al engine en `room:start`. |
| Overflow de `maxPlayers` en `room:start` | Los primeros por orden de ingreso juegan; el resto queda `WAITING` con `wantsNext=true`. |
| `engine.start()` falla (pocos jugadores) | `room:start` devuelve error y la sala permanece `LOBBY` sin cambios. |
| Desconexión de waiter | No afecta turno, engine, ni timers de partida; se remueve al vencer su gracia. |
| Chat de waiter | Permitido; los mensajes de sistema son de sala, no de partida. |

## 6. Fog of War / Seguridad

- `player:hand` se emite únicamente a miembros `PLAYING` del socket correspondiente.
- Los waiters reciben `room:state` (información pública) y `chat:history`/`chat:message`. Verificado que la pregunta vigente de PROMPT viaja en `topDiscardCard` y es pública por diseño (`DesconectadosTable.tsx:26`); las manos nunca se exponen.
- El cliente espectador no puede actuar: los handlers de juego validan `player` contra el engine, que no contiene waiters.
- `room:start` deja de poder dispararse en `IN_PROGRESS` (hoy un host puede resetear una partida en curso).

## 7. Verificación

Tests Vitest en `apps/server/tests/realtime/` (extender `room-manager.test.ts` + nuevo `room-membership.test.ts`):

1. Join en `LOBBY` crea miembro `WAITING` y no toca el engine.
2. Join en `IN_PROGRESS` crea waiter; no aparece en `engine.getPublicState().players`.
3. Join con 16 miembros es rechazado.
4. `room:start` en `IN_PROGRESS` es rechazado.
5. `room:start` selecciona hasta `maxPlayers` por orden; el overflow queda waiter con `wantsNext=true`.
6. Host que sale: reasignación al conectado más antiguo y `hostId` correcto en el estado.
7. Waiter desconectado no dispara timers de turno; al vencer la gracia se remueve sin tocar el engine.
8. `returnToLobby()` deja a todos los miembros `WAITING`/`wantsNext=true` y el engine vacío.
9. `room:state` incluye `hostId`, `options`, `rematch: null` y membership/wantsNext por jugador.
10. Bots agregados en lobby no entran al engine hasta `room:start`.

Manual: crear sala, arrancar, unirse desde otra pestaña como waiter, verificar espectador solo-lectura y chat; host sale y el nuevo host puede iniciar; desconectar waiter y verificar que la partida no se ve afectada.

## 8. Fuera de Alcance

- La ventana de anotación, contador y botón "Volver al lobby" del host → spec B.
- La edición de opciones en runtime → spec C.
- Cleanup de salas vacías, reconexión de partidas persistidas, cambio de `disconnectPolicy` en vivo.
- Traducción ES/EN (tarea de i18n separada, aún no aprobada).

## 9. Notas de Coordinación

- B y C tocan `room.ts`, `socket-server.ts`, `room-context.tsx`, `RoomLobby.tsx` y la página de mesa. Este spec define los campos/tipos para que esos cambios se hagan contra el contrato.
- Los tipos duplicados cliente/shared son checklist obligatorio en cada PR.
- Worktree por tarea + rebase sobre `origin/main` antes del PR (AGENTS.md).
