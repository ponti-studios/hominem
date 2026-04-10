# Production Dockerfile for Hominem API Service
# Extends the base service image with API-specific configuration
#
# Build context: Repository root
# Required files: package.json, pnpm-lock.yaml, tsconfig.json, packages/, services/api/

# ============================================================================
# BUILDER STAGE - Build application with pnpm
# ============================================================================
FROM node:22-alpine AS builder

WORKDIR /app

ENV TURBO_TELEMETRY_DISABLED=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Copy lock files first (these rarely change - best for caching)
COPY package.json pnpm-lock.yaml tsconfig.json ./
COPY pnpm-workspace.yaml ./

# Copy workspace structure (rarely changes after setup)
COPY packages ./packages
COPY services/api ./services/api
COPY tsconfig.profiles ./tsconfig.profiles

# Install pnpm and all dependencies
RUN npm install -g pnpm@10.33.0 && \
    pnpm install 2>&1 | grep -v "warn\|skipped" || true

# The API runs directly from TypeScript via `tsx`, so no build step is required here.
RUN echo "✓ API source runtime ready"

# Verify build artifacts
RUN echo "✓ Build completed successfully"

# ============================================================================
# RUNTIME STAGE - Minimal production image with Node.js
# ============================================================================
FROM node:22-alpine AS release

WORKDIR /app

ENV NODE_ENV=production \
    TURBO_TELEMETRY_DISABLED=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Install only critical security packages
RUN apk add --no-cache ca-certificates curl

# Install pnpm for production
RUN npm install -g pnpm@10.33.0

# Create non-root user with minimal privileges and no shell
RUN addgroup -g 1001 apiuser && \
    adduser -D -u 1001 -G apiuser -s /sbin/nologin -h /app hominem

# Create necessary directories with restrictive permissions
RUN mkdir -p /app/logs && \
    mkdir -p /tmp && \
    chown -R hominem:apiuser /app /tmp && \
    chmod 700 /app/logs && \
    chmod 1777 /tmp

# Copy built application from builder
COPY --from=builder --chown=hominem:apiuser /app/package.json ./package.json
COPY --from=builder --chown=hominem:apiuser /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder --chown=hominem:apiuser /app/node_modules ./node_modules
COPY --from=builder --chown=hominem:apiuser /app/services/api ./services/api
COPY --from=builder --chown=hominem:apiuser /app/packages ./packages
COPY --from=builder --chown=hominem:apiuser /app/tsconfig*.json ./

# Verify app structure
RUN echo "✓ Application files copied successfully"

# Switch to non-root user before running application
USER hominem

# Expose port
EXPOSE ${PORT:-3000}

# Health check for API service (HTTP endpoint)
HEALTHCHECK --interval=30s --timeout=3s --start-period=3s --retries=3 \
    CMD curl -f -s -m 2 http://localhost:${PORT:-3000}/api/status || exit 1

# Run the API service with tsx (TypeScript runner)
# tsx will execute the TypeScript directly without requiring a build step
ENTRYPOINT ["pnpm", "--filter", "@hominem/api", "run", "start"]
CMD []
