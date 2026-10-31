# Stage 1: Build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Build backend (includes dev dependencies for TypeScript compilation)
FROM node:20-alpine AS backend-build
WORKDIR /app
COPY server/package.json ./server/
WORKDIR /app/server
RUN npm install
COPY server/ .
RUN npx tsc

# Stage 3: Production (only runtime dependencies)
FROM node:20-alpine AS production
WORKDIR /app

# Install only production dependencies
COPY server/package.json ./server/
WORKDIR /app/server
RUN npm install --omit=dev
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

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

CMD ["node", "server/dist/index.js"]
