# AI Agent Guide: Traefik Dynamic Configuration Editor

## Project Overview

**Purpose**: A fast and simple web-based dashboard for managing Traefik dynamic configuration files (`dynamic.yml`). Enables real-time editing of routers, services, and entry points through an intuitive interface.

**Tech Stack**:
- **Backend**: Go 1.21 with Gorilla Mux (HTTP router), Gorilla WebSocket, and fsnotify (file watching)
- **Frontend**: Vanilla JavaScript, HTML5, CSS3 with Tailwind-inspired utility classes
- **Port**: 8010
- **Primary Configuration File**: `dynamic/dynamic.yml`

## Architecture

### Backend (`backend/`)
- **`main.go`**: Entry point, HTTP server, WebSocket handler, file watcher
- **API Endpoints**:
  - `GET /api/config` - Returns current dynamic.yml content
  - `POST /api/config` - Saves updated configuration
  - `WebSocket /ws` - Real-time configuration updates
- **File Watching**: Monitors `dynamic/dynamic.yml` for external changes
- **Validation**: YAML parsing and structure validation before writes

### Frontend (`frontend/`)
- **`index.html`**: Main UI structure with modals for adding/editing routers
- **`js/app.js`**: Client logic for CRUD operations, WebSocket handling, DOM manipulation
- **`css/style.css`**: Custom dark theme with Traefik official colors (~220 lines, rebuilt from scratch)

### Configuration (`config/`)
- **`traefik.yml`**: Static Traefik configuration (entry points, providers)
- **`dynamic/dynamic.yml`**: Dynamic configuration (routers, services, middlewares)

## Design System

### Color Palette (Traefik Official Colors)
```css
--bg-main: #081727          /* Main background */
--bg-table: #1e2b39         /* Table/card backgrounds */
--bg-dark: #081727          /* Dark elements */
--bg-entry: #192735         /* Entry point cards */
--color-teal: #2aa2c1       /* Primary accent (buttons, links) */
--color-hover: hsla(206, 100%, 50%, 0.04)  /* Hover states */
--text-default: hsla(0, 0%, 100%, 0.74)    /* Primary text */
--text-subtle: hsla(0, 0%, 100%, 0.51)     /* Secondary text */
--border-separator: hsl(209, 21%, 23%)     /* Borders and dividers */
```

### Typography
- **Font**: Rubik (Google Fonts)
- **Hierarchy**: 
  - Headers: font-bold text-xl/2xl
  - Body: text-sm/base
  - Labels: text-xs uppercase tracking-wider

### Animations
- **Modals**: 300ms fade-in/fade-out with backdrop blur
 # AI Agent Guide: Traefik Dynamic Configuration Editor

## Project Overview

**Purpose**: A fast and simple web-based dashboard for managing Traefik dynamic configuration files (`dynamic/dynamic.yml`). Enables real-time editing of routers, services, and entry points through an intuitive interface.

**Tech Stack**:
- **Backend**: Go 1.21 with Gorilla Mux (HTTP router), Gorilla WebSocket, and fsnotify (file watching)
- **Frontend**: Vanilla JavaScript, HTML5, CSS3 with Tailwind-inspired utility classes
- **Port**: 8010 (default)
- **Primary Configuration File**: `dynamic/dynamic.yml`

## Architecture

### Backend (`backend/`)
- **`main.go`**: Entry point — HTTP server, API handlers, WebSocket handler, and file watcher that watches `dynamic/dynamic.yml`.
- **Static files**: Served from `../frontend` (the server serves the UI directly).
- **Environment**: Paths are configurable via environment variables:
  - `DYNAMIC_CONFIG_PATH` (default `../dynamic/dynamic.yml`)
  - `TRAEFIK_CONFIG_PATH` (default `../config/traefik.yml`)

### API Endpoints (exact)
- `GET  /api/config`           — return full dynamic config (JSON)
- `PUT  /api/config`           — replace/save full dynamic config (JSON)
- `GET  /api/entrypoints`      — return entry points from `traefik.yml`
- `GET  /api/routers`          — list routers (JSON)
- `GET  /api/routers/{name}`   — get a single router
- `POST /api/routers/{name}`   — create a router (or update)
- `PUT  /api/routers/{name}`   — update a router
- `DELETE /api/routers/{name}` — delete a router
- `GET  /api/ping?host=...`    — simple reachability check (optional `scheme` param)
- `WebSocket /api/ws`          — real-time notifications (message type used: `config-updated`)

### Frontend (`frontend/`)
- **`index.html`**: UI markup, modals, and structure.
- **`js/app.js`**: Core client logic — fetches data, renders routers and entry points, handles forms, WebSocket connection, and service status polling/backoff.
- **`css/style.css`**: Rebuilt custom stylesheet using CSS variables and small utility classes (kept intentionally compact for maintainability).

## Design System

### Colors & Variables (examples present in `css/style.css`)
```css
:root {
  --bg-main: #081727;
  --bg-table: #1e2b39;
  --bg-entry: #192735;
  --color-teal: #2aa2c1;
  --color-teal-dark: #238a9f;
  --text-default: hsla(0, 0%, 100%, 0.74);
  --text-subtle: hsla(0, 0%, 100%, 0.51);
  --border-separator: hsl(209, 21%, 23%);
}
```

### Typography
- **Font**: Rubik (loaded from Google Fonts in `index.html`).

### Animations
- Modals use a 300ms fade-in/fade-out (JS toggles opacity with a 300ms timeout).
- Hover and color transitions use 200-300ms durations for a polished feel.

## Key Components (behavior & implementation notes)

### Entry Points
- `loadEntryPoints()` calls `GET /api/entrypoints` and renders cards into `#entrypoints-list`.
- Cards use `.bg-entry-point` (now without a white border) and are generated dynamically by `app.js`.
- The UI currently shows a "+ Add Entry Point" button which opens a small client-side modal/notification; persistent creation of entry points in `traefik.yml` is not implemented (the code intentionally notifies the user "Entry points are defined in traefik.yml... Feature in progress").

### Routers Table
- `loadRouters()` fetches routers and renders rows using `createRouterCard(name, router)`.
- Each row stores `data-host`, `data-name`, and `data-tls` attributes for status polling.
- Status badges are created with ids prefixed `r-` (via `sanitizeId(name)`) and are polled via `startStatusPolling()`.

### Service Status Polling
- The frontend implements per-service polling with exponential backoff.
- Constants in `app.js`: `BASE_BACKOFF = 1000` (1s) and `MAX_BACKOFF = 180000` (3 minutes).
- Polling uses `GET /api/ping?host=<host>&scheme=<http|https>` and updates badge classes `status-up` / `status-down`.

### Modals & Forms
- `showAddRouterModal()`, `editRouter(name)`, and `closeModal()` manage the router modal with fade transitions.
- Form submission uses `saveRouter()` which does two steps:
  1. `POST /api/routers/{name}` to create/update the router object
  2. Fetch and update full config via `GET /api/config` then `PUT /api/config` to set service backend URL(s)

### WebSocket Behavior
- Frontend connects to: `ws://localhost:8010/api/ws` (see `connectWebSocket()` in `app.js`).
- The backend broadcasts a JSON message with `type: "config-updated"` and the updated config when the watched file changes; the frontend responds by reloading routers and entry points.
- The client auto-reconnects (attempt after 3s) when the socket closes.

## Common Tasks & Exact Commands

### Start the application (development)
PowerShell:
```powershell
cd backend
go run main.go

# Then open http://localhost:8010 in your browser (server serves frontend)
```

### Troubleshooting Backend `Exit Code: 1`
**Common causes**:
- Port `8010` already in use
- Invalid YAML in `dynamic/dynamic.yml` or `config/traefik.yml`
- Missing Go modules/dependencies

**Quick checks**:
```powershell
# Check if port in use
Get-NetTCPConnection -LocalPort 8010

# Ensure modules are downloaded
cd backend; go mod tidy

# Run backend and read stdout/stderr for a specific error
go run main.go
```

If logs point to YAML parsing errors, correct the offending config and restart.

## Troubleshooting Frontend Changes Not Appearing
- Browser caching: hard refresh `Ctrl+Shift+R` or clear cache.
- Verify files were saved and served from `frontend/` (backend serves `../frontend`).
- Use repository search (`grep_search`) to ensure no duplicated/old files (e.g., `index-old.html` exists as a backup).

## Notable Implementation Details for Agents
- Static file serving path: server uses `http.FileServer(http.Dir("../frontend"))`.
- Config paths are resolved with `getEnv` so tests can set `DYNAMIC_CONFIG_PATH` or `TRAEFIK_CONFIG_PATH` for alternate files.
- WebSocket path is `/api/ws` (not just `/ws`).
- The message type used by the backend is `config-updated` (frontend listens for that exact type).
- `saveRouter()` flow performs both router save and then updates `config.http.services` via `PUT /api/config`.

## Code Patterns (accurate examples)

### WebSocket Communication (frontend)
```javascript
// Frontend connection (app.js)
const ws = new WebSocket('ws://localhost:8010/api/ws');
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.type === 'config-updated') {
    loadRouters();
    loadEntryPoints();
  }
};
```

### API Calls (examples)
```javascript
// Get full dynamic config
const config = await fetch(`${API_BASE}/config`).then(r => r.json());

// Update full dynamic config
await fetch(`${API_BASE}/config`, {
  method: 'PUT',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify(config)
});
```

## CSS Notes
- `frontend/css/style.css` contains CSS variables and utility classes. The `bg-entry-point` style no longer adds a white border.
- The Rubik font is loaded from Google Fonts in `index.html`.

## Files & Backups
- Active UI: `frontend/index.html`
- Backup(s): `frontend/index-old.html` (previous version kept during swaps)
- Main JS: `frontend/js/app.js`
- Main CSS: `frontend/css/style.css`

## Best Practices for AI Agents Working on This Repo
1. Read relevant files before edits (`read_file`).
2. Search (`grep_search`) to find all occurrences before replacing.
3. Use `manage_todo_list` to track multi-step changes.
4. Batch edits with `multi_replace_string_in_file` when making multiple unrelated replacements.
5. Verify changes by re-checking with `grep_search` and quick `read_file` snippets.
6. If editing the backend, run `go mod tidy` and `go run main.go` to validate.

## Known Issues (current)
1. Backend may exit with code `1` if YAML is invalid or port conflicts exist.
2. Some UI features (like persistently adding entry points to `traefik.yml`) are intentionally unimplemented; UI shows a notification for that.
3. Auto-formatters or manual swaps can leave backups (e.g., `index-old.html`) which agents should be aware of.

## Quick Reference (PowerShell)
```powershell
# Start backend
cd backend
go run main.go

# Check port usage
Get-NetTCPConnection -LocalPort 8010

# Swap frontend files (example used during CSS rebuilds)
cd f:\Projects\traefik-dynamic-editor\frontend
Move-Item -Path index.html -Destination index-old.html -Force
Move-Item -Path index-new.html -Destination index.html -Force
```

---

**Last Updated**: November 17, 2025
**Version**: 1.1
**Maintainer**: AI Agent Team
