# ============================================
# Stage 1: Build frontend
# ============================================
FROM node:22-alpine AS frontend-build
WORKDIR /app

# Install dependencies with reduced concurrency for low-RAM VDS
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund --maxsockets=2

COPY . .
RUN npm run build

# ============================================
# Stage 2: Build backend (needs devDeps for tsc)
# ============================================
FROM node:22-alpine AS backend-build

# Install build tools for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++

WORKDIR /app/server
COPY server/package.json ./
RUN npm install --no-audit --no-fund --maxsockets=2

COPY server/ .
RUN npx tsc

# ============================================
# Stage 3: Production image (minimal)
# ============================================
FROM node:22-alpine AS production

# Runtime deps for better-sqlite3
RUN apk add --no-cache libstdc++

WORKDIR /app

# Install only production dependencies
COPY server/package.json ./server/
WORKDIR /app/server
RUN npm install --omit=dev --no-audit --no-fund --maxsockets=2
WORKDIR /app

# Copy built frontend
COPY --from=frontend-build /app/dist ./dist

# Copy built backend
COPY --from=backend-build /app/server/dist ./server/dist

# Create data directory for SQLite
RUN mkdir -p /app/data

# Environment
ENV NODE_ENV=production
ENV PORT=3001
ENV DB_PATH=/app/data/fairdraw.db
# Reduce Node.js memory footprint
ENV NODE_OPTIONS="--max-old-space-size=256"

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

CMD ["node", "server/dist/index.js"]
