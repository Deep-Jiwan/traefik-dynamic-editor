# Traefik Dynamic Config Editor

A fast, minimal, and modern web dashboard for managing Traefik's dynamic configuration.
Why Use This?
If you find Docker labels tedious for setting up Traefik routes but want the simplicity of editing dynamic.yml to add new services, this app is for you. It provides a clean web interface to manage your Traefik dynamic configuration without manually editing YAML files.  
  
Prerequisites  
Before using this app, ensure you have:

✅ Traefik installed and running  
✅ DNS configured  
✅ Domain validation setup (SSL certificates)   

Note: This app currently only edits the dynamic.yml file. Your base Traefik configuration should already be working.
Quick Start

1. Deploy the app with your Traefik dynamic.yml mounted as a volume
2. Ensure network connectivity between your services and Traefik (shared Docker network)
3. Add a new router through the web interface
4. Verify in Traefik's dashboard that the route was created successfully
5. Access your service by clicking the hostname in the table to open it in a new tab

Current Status
⚠️ Development Stage: This app is still under active development. Extended testing is required before production use.


## Features

- ✨ **Modern UI**: Clean, responsive interface built with TailwindCSS
- 🚀 **Fast & Lightweight**: Go backend with minimal footprint (~15-20MB container). Atlease thats what claude told me.
- 🔄 **Real-time Updates**: WebSocket support for live configuration changes
- 📝 **Easy Editing**: Intuitive GUI for adding/editing routers and services
- 🔌 **Swappable Backend**: RESTful API design allows easy backend replacement
- 🐳 **Docker Ready**: Containerized for easy deployment

## Screenshots
<img width="1919" height="916" alt="image" src="https://github.com/user-attachments/assets/a29a7fb7-79a0-48e0-8f61-513d4287b58a" />

<img width="1913" height="916" alt="image" src="https://github.com/user-attachments/assets/06d2e46e-0a80-4c67-9e22-26ac9ecc48be" />


## Architecture

Bunch of yapp  

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

## Other

### Development

1. **Start the backend:**
   ```bash
   cd backend
   go mod download
   go run main.go
   ```

2. **Open in browser:**
   ```
   http://localhost:port
   ```

### Docker

1. **Build and run:**
   ```bash
   docker-compose up -d
   ```

2. **Access dashboard:**
   ```
   http://localhost:port
   ```

## Configuration

Environment variables:

- `DYNAMIC_CONFIG_PATH`: Path to dynamic.yml (default: `../dynamic/dynamic.yml`)
- `PORT`: Server port (default: `8080`)


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
│   └── index.html           # web side application
├── dynamic/
│   └── dynamic.yml          # Traefik dynamic config
├── config/
│   └── traefik.yml          # Traefik static config (reference)
└── docker-compose.yml       # Docker orchestration
```

## Swapping the Backend

The frontend uses standard REST API calls, making it easy to replace the Go backend if need be:


## License

MIT

## Contributing

Contributions welcome! Looking to
- Add new features to the frontend
- Extended testing and checking
- Extend the configuration options, ability to fully setup traefik end to end.
- Improve the UI/UX
- Optimize CI/CD