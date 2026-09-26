# Al Mazo Server 🃏

![Al Mazo](apps/client/public/readme-image.jpeg)

Servidor modular de juegos de mesa y cartas en tiempo real para la plataforma **Al Mazo**. Diseñado con una arquitectura modular y desacoplada, cuenta con un motor de reglas declarativo en JSON, multijugador online con separación estricta de información oculta (manos privadas vs. estado público), resiliencia nativa a desconexiones y sincronización de partidas offline/locales.

---

## 🏛️ Arquitectura y Topología de Red

El servidor está pensado para desplegarse como un **Monolito Modular** en un contenedor Docker dentro de una red privada, operando detrás de un **Reverse Proxy (Nginx o Caddy)** en el borde:

```
                   Internet (HTTPS / WSS)
                             │
                             ▼
                    ┌──────────────────┐
                    │   dominio.app    │
                    │  (Nginx / Caddy) │
                    └────────┬─────────┘
                             │
            ┌────────────────┼────────────────┐
            │ (Ruta /)       │ (Ruta /api)    │ (Ruta /socket.io)
            ▼                ▼                ▼
     ┌─────────────┐   ┌─────────────────────────────┐
     │  Frontend   │   │       al-mazo-server        │
     │  (SPA React)│   │  (Fastify + Socket.io Node) │
     └─────────────┘   └──────────────┬──────────────┘
                                      │
                       ┌──────────────┴──────────────┐
                       ▼                             ▼
                ┌─────────────┐               ┌─────────────┐
                │ PostgreSQL  │               │    Redis    │
                │  (Prisma)   │               │  (Salas/TTL)│
                └─────────────┘               └─────────────┘
```

* `https://dominio.app/` ➔ Sirve los archivos estáticos de la aplicación React.
* `https://dominio.app/api/*` ➔ Redirige a las rutas REST de Fastify.
* `wss://dominio.app/socket.io/*` ➔ Realiza el upgrade de WebSockets a Socket.io.

---

## 🚀 Tecnologías Principales

* **Node.js (LTS)** + **TypeScript**: Tipado riguroso y modelos compartibles con el cliente.
* **Fastify**: Framework web de alto rendimiento y bajo consumo.
* **Socket.io** (`@socket.io/redis-adapter`): Comunicación bidireccional en tiempo real con rooms y soporte de clustering.
* **PostgreSQL 16** + **Prisma ORM**: Persistencia relacional para usuarios, historial y esquemas de juegos en columnas `jsonb`.
* **Redis 7**: Cache de salas efímeras (lookup O(1) por código PIN de 5 caracteres), tickets de reconexión y TTL.
* **Vitest**: Suite de pruebas unitarias y de integración.

---

## ⚙️ Características Clave

### 1. Motor de Reglas Declarativo (Declarative Rules Engine)
Las reglas de los juegos no están "cableadas" en código estático; se definen mediante un esquema estructurado en JSON (`GameSchemaDefinition`). Esto permite que en fases posteriores los usuarios creen sus propios juegos visualmente (ej. con React Flow) sin requerir ejecución de código inseguro (`eval`).

### 2. Primer Juego Oficial: ColorMatch (Clean IP)
Implementación oficial de un juego de descarte de 108 cartas por color o valor numérico (mecánicas tipo UNO / Ocho Loco) con derechos limpios:
* Colores: Rojo, Azul, Verde, Amarillo + Comodines.
* Acciones especiales: `SKIP` (salto), `REVERSE` (cambio de sentido), `DRAW_2` (robar 2 y saltar).
* Comodines: `WILD` (elección de color) y `WILD_DRAW_4` (color + roba 4).

### 3. Segundo Juego Oficial: Truco Argentino Criollo (Bazas, Envido, Flor y Jerarquía)
Implementación 100% fiel al reglamento oficial de Bureau de Juegos:
* Baraja española de 40 cartas tradicional y jerarquía oficial (del As de Espadas al 4).
* Mecánica de 3 bazas por ronda con desempates por mano y parda.
* Envite completo de Envido con prioridad de cobro sobre el truco.
* Regla de **La Flor** (3 cartas del mismo palo): Flor solitaria (+3 pts automáticos), Flor vs Flor (+4 / +3 me achico), Contraflor (+6 / +4) y Contraflor al resto. Anula Envido.
* Regla de **"El Envido está primero"**: Pausa automática de la apuesta de truco en 1ª baza al cantar envido, con reanudación posterior del truco.
* Soporte para **Carta Tapada** (fuerza 0).
* Todas las acciones, condiciones y efectos están desacoplados como capacidades modulares para el Editor Visual de Juegos (`/editor`).

### 4. Juego Oficial: Desconectados (Conversación sin ganador)
Juego de preguntas para conectar sin pantallas, con modo online y pass-and-play local:
* 192 preguntas en cuatro secciones (Perspectiva, Presentación, Profundidad y Descomprimir) más cartas en blanco.
* Mecánica declarativa de **revelado público**: `REVEAL_CARD` da vuelta la carta superior del mazo sin pasar por ninguna mano, `END_GAME` cierra la ronda sin ganador y la condición de victoria `NONE` deja el resultado abierto.
* `turnTimeoutSeconds: 0` desactiva el auto-pase por inactividad: cada grupo responde a su ritmo.
* Modo local pass-and-play en el cliente, con mazo, turnos y progreso persistidos en el dispositivo.

### 5. Juego Oficial: HDP (Hasta Donde Puedas)
Juego de jurado con respuestas ocultas, implementado como capacidad declarativa reutilizable (`rules.submission`):
* 10 cartas de respuesta por jugador y consignas con 1 a 3 espacios a completar.
* El rol de HDP (juez) rota a la izquierda; puede recambiar cartas antes de leer la consigna.
* Envíos simultáneos y anónimos: el estado público solo expone el contenido cuando todos respondieron, y la identidad del autor recién al revelarse la ganadora.
* Puntaje configurable y partida a 5 puntos por defecto; las manos se reponen al tamaño inicial.
* Mazo original de ejemplo (22 consignas + 90 respuestas) editable o reemplazable desde el Editor Visual (`HDP_DEMO`).

### 6. Información Oculta (Anti-Cheat / Fog of War)
El servidor es autoritativo:
* **Estado Público (`room:state`)**: Se transmite a todos los jugadores (carta superior en descarte, color activo, turno actual, sentido y **conteo numérico** de cartas restantes de cada jugador).
* **Mano Privada (`player:hand`)**: Solo se transmite de forma directa y cifrada al socket del jugador propietario.

### 7. Resiliencia ante Desconexiones en Móviles
* Cada jugador recibe un `reconnectToken` secreto al unirse a la sala.
* Si el socket se desconecta (por caída de red móvil o bloqueo de pantalla), se inicia una **ventana de gracia configurable** (default: 60s).
* Si el jugador se reconecta antes de que expire, retoma su mano y su asiento automáticamente.
* Si vence la ventana de gracia, se ejecuta la política configurada por la sala (`DISCARD_AND_CONTINUE`, `AUTO_PASS`, o `ABORT_MATCH`).

### 8. Modo Local y Sincronización Offline
El frontend puede ejecutar el motor de forma 100% desconectada. Al recuperar conexión, envía el reporte de la partida a `POST /api/matches/sync` para persistir el historial y actualizar estadísticas.

---

## 📦 Puesta en Marcha

### Prerrequisitos
* Node.js v20+
* pnpm v10+
* Docker y Docker Compose

### 1. Clonar e Instalar Dependencias
```bash
pnpm install
```

### 2. Levantar Servicios Locales (PostgreSQL + Redis)
```bash
docker compose up -d
```

### 3. Configurar Variables de Entorno
Copia el archivo de ejemplo:
```bash
cp .env.example .env
```

### 4. Generar el Cliente de Base de Datos
```bash
pnpm prisma:generate
```

### 5. Ejecutar en Modo Desarrollo
```bash
pnpm dev
```
El servidor quedará escuchando en `http://localhost:3000`.

---

## 🧪 Pruebas Automatizadas

Para correr toda la suite de tests (motor, ColorMatch, salas y API):
```bash
pnpm test
```

Para correr en modo interactivo/watch:
```bash
pnpm test:watch
```

---

## 📡 Referencia de API REST

| Método | Ruta | Descripción |
| :--- | :--- | :--- |
| `GET` | `/health` | Estado del servidor, uptime y conectividad con DB y Redis. |
| `GET` | `/api/games` | Catálogo de juegos oficiales y comunitarios publicados. |
| `GET` | `/api/games/:slug` | Esquema declarativo completo del juego (reglas, componentes, cartas). |
| `POST` | `/api/auth/guest` | Genera una sesión de invitado anónimo para juego sin fricción. |
| `GET` | `/api/users/:id/stats` | Estadísticas acumuladas de un jugador (partidas jugadas y ganadas). |
| `POST` | `/api/matches/sync` | Sincroniza reportes de partidas jugadas offline o en salas locales. |
| `GET` | `/api/matches` | Historial de las últimas partidas registradas. |

---

## 🔌 Eventos WebSocket (Socket.io)

### Cliente ➔ Servidor
* `room:create`: `{ gameSlug, playerName, options? }`
* `room:join`: `{ roomCode, playerName }`
* `room:reconnect`: `{ roomCode, playerId, reconnectToken }`
* `room:start`: `()` (Solo el anfitrión)
* `game:play_card`: `{ cardId, chosenColor? }`
* `game:draw_card`: `()`
* `game:choose_color`: `{ color }`
* `game:pass_turn`: `()`
* `room:leave`: `()`

### Servidor ➔ Cliente
* `room:state`: Transmite el `PublicGameState` actualizado.
* `player:hand`: Transmite la mano privada al socket propietario.
* `player:joined`: Notifica la llegada de un nuevo jugador a la sala.
* `player:left`: Notifica la salida de un jugador.
* `player:disconnected`: Notifica que un jugador se desconectó temporalmente y el tiempo de gracia restante.
* `player:reconnected`: Notifica la recuperación exitosa de un jugador.
* `game:started`: Señal de inicio de partida.
* `game:finished`: `{ winnerId }` Fin de partida con ganador.
