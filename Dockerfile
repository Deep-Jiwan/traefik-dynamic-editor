# dockerfilefast
# Fast-build Dockerfile for Traefik Dynamic Config Editor (dev/local use)
# NOTE: using --platform to ensure BuildKit resolves the correct platform (avoid unnecessary pulls)
# and using BUILDKIT_INLINE_CACHE to allow inline cache export/import.

ARG BUILDKIT_INLINE_CACHE=1

# Stage 1: Build React frontend
FROM node:20-alpine AS frontend-build
WORKDIR /src/frontend/editorfront

# Install dependencies only if package files change
COPY frontend/editorfront/package.json frontend/editorfront/package-lock.json ./
RUN npm ci --legacy-peer-deps

# Copy all files except node_modules
COPY frontend/editorfront/. ./

# Production build (minified, optimized)
RUN npm run build

# Stage 2: Build Go backend
FROM golang:1.24-alpine AS backend-build
WORKDIR /src/backend

# Install build deps and download modules only if go.mod changes
COPY backend/go.mod backend/go.sum ./
RUN apk add --no-cache git ca-certificates && \
    go env -w GOPROXY=https://proxy.golang.org && \
    go mod download

# Copy backend source files
COPY backend/*.go ./

# Production build (optimized, no debug symbols)
RUN CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -ldflags="-s -w" -o traefik-dynamic-editor

# Runtime image
FROM alpine:3.18
RUN apk add --no-cache ca-certificates wget curl
WORKDIR /app/backend

# Copy backend binary
COPY --from=backend-build /src/backend/traefik-dynamic-editor .

# Copy frontend build
COPY --from=frontend-build /src/frontend/editorfront/dist /app/frontend/editorfront/dist

EXPOSE 8010
ENV PORT=8010 \
    DYNAMIC_CONFIG_PATH=../dynamic/dynamic.yml \
    TRAEFIK_CONFIG_PATH=../config/traefik.yml \
    TRAEFIK_DASHBOARD_URL=""

HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
  CMD curl -f http://127.0.0.1:8010/api/health || exit 1

CMD ["./traefik-dynamic-editor"]
