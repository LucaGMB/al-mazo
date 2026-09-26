# Architecture

Al Mazo is a pnpm-workspace monorepo with a declarative rules engine at its core. The server is authoritative: it owns the deck, validates every move and decides what each socket is allowed to see.

## Monorepo layout

| Path | Contents |
| :--- | :--- |
| `packages/shared` | Types, contracts, Socket.io events and declarative capabilities shared by client and server. |
| `apps/server` | Fastify + Socket.io API, Prisma/PostgreSQL persistence, Redis room cache, rules engine and official games. |
| `apps/client` | Next.js app: game tables, room state and the visual editor. |

## Deployment topology

Client and server deploy independently. The server runs as a container behind a reverse proxy that terminates HTTPS/WSS; PostgreSQL and Redis stay on a private network.

```
                  Internet (HTTPS / WSS)
                            │
                            ▼
                   ┌──────────────────┐
                   │   Reverse proxy  │
                   │  (Nginx / Caddy) │
                   └────────┬─────────┘
                            │
           ┌────────────────┼────────────────┐
           │ (/)            │ (/api)         │ (/socket.io)
           ▼                ▼                ▼
    ┌─────────────┐   ┌─────────────────────────────┐
    │  Frontend   │   │        al-mazo-server       │
    │  (Next.js)  │   │  (Fastify + Socket.io)      │
    └─────────────┘   └──────────────┬──────────────┘
                                     │
                      ┌──────────────┴──────────────┐
                      ▼                             ▼
               ┌─────────────┐               ┌─────────────┐
               │ PostgreSQL  │               │    Redis    │
               │  (Prisma)   │               │ (rooms/TTL) │
               └─────────────┘               └─────────────┘
```

## Stack

- **Node.js + TypeScript** — shared types between client and server.
- **Fastify** — REST API.
- **Socket.io** — realtime rooms, with `@socket.io/redis-adapter` for multi-instance deployments.
- **PostgreSQL 16 + Prisma** — users, match history and game schemas (JSON in `jsonb` columns).
- **Redis 7** — ephemeral room lookups by 5-character PIN, reconnect tickets and TTLs.
- **Next.js 16 + React 19 + Tailwind** — client, game tables and visual editor.
- **Vitest** — engine, games, rooms and API tests.

## Rules engine

A game is a `GameSchemaDefinition` (see `packages/shared/src/engine.ts`):

- `deckConfig`: card templates (count, type, color, value, metadata).
- `rules`: hand size, player limits, matching properties, card effects, draw stacking, win condition, zones, phases and optional per-game config such as `submission`.
- `customState`: game-specific public flags.

Mechanics are declared as reusable capabilities (`packages/shared/src/capabilities.ts`): effects, conditions, zones, actions and phases. The engine in `apps/server/src/engine/` implements generic handlers; there are no `if (gameSlug === ...)` branches. Official games live in `apps/server/src/games/` and are registered by slug.

`GameRoom` applies per-match options on top of the game schema, but only when the game supports them:

| Option | Applies when |
| :--- | :--- |
| `drawStack` | The game defines draw-card effects. |
| `finishOnSpecialCard` | The win condition is `EMPTY_HAND`. |
| `targetScore` | The win condition is `SCORE_THRESHOLD`. |
| `colorMatchMode` | The room is a ColorMatch variant. |
| `disconnectGraceSeconds`, `disconnectPolicy`, `turnTimeoutSeconds` | Any game. |

## Hidden information

The server is the only source of truth. Every socket receives `room:state`, a public projection of the match: discard pile, active color, current turn, direction, pending draw count and the numeric card count of each player. Hands are never included in public state; `player:hand` is emitted only to the owner's socket. Hands are not encrypted at the application level — confidentiality relies on the direct socket delivery over WSS.

## Reconnection

Each player gets a secret `reconnectToken` when joining. If the socket drops, the room starts a grace timer (default 60s). A player who returns with a valid token recovers their seat and hand. When the timer expires, the player is removed: their cards go to the discard pile and the match continues. Rooms can opt into `ABORT_MATCH` instead, which ends the match.

## Local mode and offline sync

The client can run a full match without a server. When connectivity returns, the client reports the result to `POST /api/matches/sync`, which persists history and updates player stats.

## Visual editor (beta)

The editor (`/editor`) reads the available capabilities from `GET /api/games/capabilities`, validates schemas with `POST /api/games/validate`, and creates or forks games as drafts (`POST /api/games`, `POST /api/games/:id/fork`) before publishing them (`POST /api/games/:id/publish`). Schemas and capabilities are still evolving.

## Official games

- **ColorMatch** — 108-card discard game (4 colors, 0–9, SKIP, REVERSE, DRAW_2, WILD, WILD_DRAW_4). Classic, Blitz and Chaos modes change deck composition, hand size and rules per match.
- **Truco Argentino** — 40-card Spanish deck with the official hierarchy, 3 tricks per round, envido, flor and contraflor, "el envido está primero" and carta tapada.
- **Escoba del 15** — capture table cards that add up to 15, escobas, initial-table special rule and end-of-round scoring.
- **Chinchón** — Spanish-deck rummy: melds, closing with the lowest score and a target score of 100.
- **Descarte Criollo** — 40-card Spanish-deck discard game with suit-based powers.
- **Desconectados** — conversation game with public reveals (`REVEAL_CARD`), no winner (`NONE`), no turn timer, plus a local pass-and-play mode.
- **HDP (Hasta Donde Puedas)** — hidden-answer party game built on a reusable `rules.submission` capability: simultaneous anonymous submissions, a rotating judge and configurable scoring.
- **Town of Salem** — social deduction with hidden roles, night actions and day voting (faction elimination win condition).

## REST API

| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Server status, uptime and DB/Redis connectivity. |
| `GET` | `/api/games` | Published catalog, with optional `status`, `type` and `search` filters. |
| `GET` | `/api/games/:slug` | Full declarative schema of a published game. |
| `GET` | `/api/games/capabilities` | Available declarative capabilities. |
| `POST` | `/api/games/validate` | Validate a game schema. |
| `GET` | `/api/games/mine` | Games owned by the authenticated author, drafts included. |
| `POST` | `/api/games` | Create a draft game. |
| `PUT` | `/api/games/:id` | Update a game. |
| `POST` | `/api/games/:id/publish` | Publish a draft. |
| `POST` | `/api/games/:id/fork` | Fork an existing game. |
| `POST` | `/api/auth/guest` | Anonymous guest session. |
| `POST` | `/api/auth/register` | Create an account. |
| `POST` | `/api/auth/login` | Log in. |
| `GET` | `/api/auth/me` | Current session. |
| `PATCH` | `/api/users/:id` | Update the player profile. |
| `GET` | `/api/users/:id/stats` | Aggregated matches played and won. |
| `GET` | `/api/users/:id/matches` | Match history for a player. |
| `GET` | `/api/matches` | Recent matches. |
| `POST` | `/api/matches/sync` | Sync offline or local match reports. |

## Socket.io events

Client to server:

- `room:create` `{ gameSlug, playerName, options? }`
- `room:join` `{ roomCode, playerName }`
- `room:reconnect` `{ roomCode, playerId, reconnectToken }`
- `room:start` (host only)
- `room:add_bot` `{ name? }` / `room:remove_bot` `{ botId? }`
- `game:play_card` `{ cardId, chosenColor?, isTapada? }`
- `game:draw_card` / `game:pass_turn` / `game:choose_color` `{ color }`
- `game:action` `{ action, payload? }`
- `room:leave` / `chat:send` `{ text }`

Server to client:

- `room:state` `PublicGameState` (public projection)
- `player:hand` `Card[]` (owner only)
- `player:joined` / `player:left` / `player:disconnected` / `player:reconnected`
- `player:forced_draw` `{ count, byName }`
- `game:started` / `game:finished` `{ winnerId }`
- `error:notification` `{ message }`
- `chat:message` / `chat:history`

## Local development

```bash
pnpm install
docker compose up -d
cp .env.example .env
pnpm --filter al-mazo-server prisma:generate
pnpm dev
```

`pnpm dev` builds `@al-mazo/shared` and starts the API (`:3000`) and the client (`:3001`) in parallel. Run the test suite with `pnpm test`; lint everything with `pnpm lint`.
