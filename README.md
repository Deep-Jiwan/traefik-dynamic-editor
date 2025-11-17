# Traefik Dynamic Config Editor

A fast, minimal, and modern web dashboard for managing Traefik's dynamic configuration.

## Features

- ✨ **Modern UI**: Clean, responsive interface built with TailwindCSS
- 🚀 **Fast & Lightweight**: Go backend with minimal footprint (~15-20MB container)
- 🔄 **Real-time Updates**: WebSocket support for live configuration changes
- 📝 **Easy Editing**: Intuitive GUI for adding/editing routers and services
- 🔌 **Swappable Backend**: RESTful API design allows easy backend replacement
- 🐳 **Docker Ready**: Containerized and ready for production deployment

## Architecture

### Backend (Go)
- RESTful API for CRUD operations
- File watching for real-time updates
- WebSocket support for live notifications
- YAML configuration parsing

### Frontend (Vanilla JS + TailwindCSS)
- No framework overhead
- Real-time WebSocket connection
- Responsive and modern design
- Easy to modify and extend

## API Endpoints

All endpoints follow standard REST conventions for easy backend replacement:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/config` | Get full configuration |
| `PUT` | `/api/config` | Update full configuration |
| `GET` | `/api/routers` | List all routers |
| `GET` | `/api/routers/{name}` | Get specific router |
| `POST` | `/api/routers/{name}` | Create/update router |
| `DELETE` | `/api/routers/{name}` | Delete router |
| `WS` | `/api/ws` | WebSocket for real-time updates |

## Quick Start

### Development

1. **Start the backend:**
   ```bash
   cd backend
   go mod download
   go run main.go
   ```

2. **Open in browser:**
   ```
   http://localhost:8080
   ```

### Docker

1. **Build and run:**
   ```bash
   docker-compose up -d
   ```

2. **Access dashboard:**
   ```
   http://localhost:8080
   ```

## Configuration

Environment variables:

- `DYNAMIC_CONFIG_PATH`: Path to dynamic.yml (default: `../dynamic/dynamic.yml`)
- `PORT`: Server port (default: `8080`)

## Production Deployment

### With Docker Compose

```yaml
version: '3.8'

services:
  traefik-editor:
    image: your-registry/traefik-editor:latest
    ports:
      - "8080:8080"
    volumes:
      - /path/to/traefik/dynamic:/dynamic
    environment:
      - DYNAMIC_CONFIG_PATH=/dynamic/dynamic.yml
    restart: unless-stopped
```

### Traefik Integration

Add to your Traefik dynamic configuration:

```yaml
http:
  routers:
    editor-router:
      rule: "Host(`editor.yourdomain.com`)"
      entryPoints:
        - websecure
      service: editor-service
      tls:
        certResolver: cloudflare

  services:
    editor-service:
      loadBalancer:
        servers:
          - url: "http://traefik-editor:8080"
```

## File Structure

```
traefik-dynamic-editor/
├── backend/
│   ├── main.go              # Go backend server
│   ├── go.mod               # Go dependencies
│   ├── go.sum               # Go dependency checksums
│   └── Dockerfile           # Backend container
├── frontend/
│   └── index.html           # Single-page application
├── dynamic/
│   └── dynamic.yml          # Traefik dynamic config
├── config/
│   └── traefik.yml          # Traefik static config (reference)
└── docker-compose.yml       # Docker orchestration
```

## Swapping the Backend

The frontend uses standard REST API calls, making it easy to replace the Go backend:

### API Contract

```typescript
// Get all routers
GET /api/routers
Response: { [name: string]: Router }

// Create/update router
POST /api/routers/{name}
Body: Router
Response: { message: string }

// Delete router
DELETE /api/routers/{name}
Response: { message: string }

// WebSocket updates
WS /api/ws
Message: { type: "config-updated", data: Config }
```

### Example: Node.js Backend

```javascript
const express = require('express');
const yaml = require('js-yaml');
const fs = require('fs');

app.get('/api/routers', (req, res) => {
  const config = yaml.load(fs.readFileSync('dynamic.yml'));
  res.json(config.http.routers);
});

// ... implement other endpoints
```

## Development

### Backend Requirements
- Go 1.21 or higher
- Dependencies managed with Go modules

### Frontend Requirements
- Modern web browser
- No build step required

## License

MIT

## Contributing

Contributions welcome! The modular design makes it easy to:
- Add new features to the frontend
- Implement the API in other languages
- Extend the configuration options
- Improve the UI/UX
