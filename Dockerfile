# Multi-stage Dockerfile for Traefik Dynamic Config Editor

# Stage 1: Build React frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /src/frontend/editorfront

# Copy frontend package files
COPY frontend/editorfront/package.json frontend/editorfront/package-lock.json ./

# Install dependencies
RUN npm ci

# Copy frontend source code
COPY frontend/editorfront/ ./

# Build the React application
RUN npm run build

# Stage 2: Build Go backend
FROM golang:1.24-alpine AS backend-builder

# Allow build args for cross-compilation (buildx sets these automatically)
ARG TARGETOS=linux
ARG TARGETARCH=amd64
ARG TARGETVARIANT=

WORKDIR /src

# Copy backend module files to allow dependency download before copying entire repo
COPY backend/go.mod backend/go.sum ./backend/

# Install build deps and download modules inside the backend folder
WORKDIR /src/backend
RUN apk add --no-cache git ca-certificates && \
    go env -w GOPROXY=https://proxy.golang.org && \
    go mod download

# Ensure we copy repository into /src (not into /src/backend)
WORKDIR /src
# Copy the backend source
COPY backend/ ./backend/

# Build the backend binary
WORKDIR /src/backend
# Build for the target architecture. When using `docker buildx --platform` the
# buildkit engine will set TARGETOS/TARGETARCH/TARGETVARIANT automatically.
RUN if [ -n "${TARGETVARIANT}" ] && echo "${TARGETVARIANT}" | grep -q "v7"; then \
        GOARM=7 CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} go build -o traefik-dynamic-editor; \
    else \
        CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} go build -o traefik-dynamic-editor; \
    fi

### Runtime image
FROM alpine:3.18
RUN apk add --no-cache ca-certificates

WORKDIR /app/backend

# Copy binary from backend builder
COPY --from=backend-builder /src/backend/traefik-dynamic-editor .

# Copy built frontend dist files from frontend builder
COPY --from=frontend-builder /src/frontend/editorfront/dist /app/frontend/editorfront/dist

# Expose port used by the app
EXPOSE 8010

# Default environment variables
ENV PORT=8010 \
    DYNAMIC_CONFIG_PATH=../dynamic/dynamic.yml \
    TRAEFIK_CONFIG_PATH=../config/traefik.yml

CMD ["./traefik-dynamic-editor"]