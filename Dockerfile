# dockerfilefast
# Fast-build Dockerfile for Traefik Dynamic Config Editor (dev/local use)
# NOTE: using --platform to ensure BuildKit resolves the correct platform (avoid unnecessary pulls)
# and using BUILDKIT_INLINE_CACHE to allow inline cache export/import.

ARG BUILDKIT_INLINE_CACHE=1

# Stage 1: Build React frontend (dev-optimized)
FROM --platform=linux/arm64 node:20-alpine AS frontend-dev
WORKDIR /src/frontend/editorfront

# Install dependencies only if package files change
COPY frontend/editorfront/package.json frontend/editorfront/package-lock.json ./
RUN npm ci --legacy-peer-deps

# Copy all files except node_modules for robust dev build
COPY frontend/editorfront/. ./

# Fast build (no minification, source maps enabled)
RUN npm run build -- --mode development

# Stage 2: Build Go backend (dev-optimized)
FROM --platform=linux/arm64 golang:1.24-alpine AS backend-dev
WORKDIR /src/backend

# Install build deps and download modules only if go.mod changes
COPY backend/go.mod backend/go.sum ./
RUN apk add --no-cache git ca-certificates && \
    go env -w GOPROXY=https://proxy.golang.org && \
    go mod download

# Copy backend source (only .go files for fast rebuilds)
COPY backend/*.go ./

# Fast build (no CGO, no optimizations)
RUN CGO_ENABLED=0 go build -o traefik-dynamic-editor

# Runtime image (same as prod)
FROM --platform=linux/arm64 alpine:3.18
RUN apk add --no-cache ca-certificates
WORKDIR /app/backend

COPY --from=backend-dev /src/backend/traefik-dynamic-editor .
COPY --from=frontend-dev /src/frontend/editorfront/dist /app/frontend/editorfront/dist

EXPOSE 8010
ENV PORT=8010 \
    DYNAMIC_CONFIG_PATH=../dynamic/dynamic.yml \
    TRAEFIK_CONFIG_PATH=../config/traefik.yml

HEALTHCHECK --interval=10s --timeout=2s --start-period=5s CMD wget -qO- http://127.0.0.1:8010/health || exit 1

CMD ["./traefik-dynamic-editor"]
