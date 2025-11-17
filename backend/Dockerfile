# Build stage
FROM golang:1.21-alpine AS builder

WORKDIR /build

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source
COPY main.go ./

# Build
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o app .

# Runtime stage
FROM alpine:latest

RUN apk --no-cache add ca-certificates

WORKDIR /app

# Copy binary from builder
COPY --from=builder /build/app .

# Create directory for dynamic config
RUN mkdir -p /dynamic

# Expose port
EXPOSE 8080

# Environment variables
ENV DYNAMIC_CONFIG_PATH=/dynamic/dynamic.yml
ENV PORT=8080

CMD ["./app"]
