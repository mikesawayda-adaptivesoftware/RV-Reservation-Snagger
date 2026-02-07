# RV Reservation Snagger - Multi-stage Dockerfile
# Builds Angular frontend and Node.js backend into a single container

# ===========================================
# Stage 1: Build Frontend (Angular)
# ===========================================
FROM node:20-slim AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package files
COPY frontend/package*.json ./

# Install dependencies
RUN npm ci

# Copy frontend source
COPY frontend/ ./

# Copy shared types
COPY shared/ ../shared/

# Build Angular app for production
RUN npm run build -- --configuration=production

# ===========================================
# Stage 2: Build Backend (TypeScript)
# ===========================================
FROM node:20-slim AS backend-builder

WORKDIR /app/backend

# Copy backend package files
COPY backend/package*.json ./

# Install dependencies
RUN npm ci

# Copy backend source
COPY backend/ ./

# Copy shared types
COPY shared/ ../shared/

# Build TypeScript
RUN npm run build

# ===========================================
# Stage 3: Production Runtime
# ===========================================
FROM node:20-slim AS production

# Install chromium for puppeteer (used by scrapers)
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set puppeteer to use installed chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Copy backend production dependencies
COPY backend/package*.json ./
RUN npm ci --only=production

# Copy built backend
COPY --from=backend-builder /app/backend/dist ./dist

# Copy shared types (needed at runtime)
COPY --from=backend-builder /app/shared ./shared

# Copy built frontend to be served by backend
COPY --from=frontend-builder /app/frontend/dist/frontend/browser ./public

# Create a simple static file server middleware or configure express to serve frontend
# The backend will serve the frontend from /public

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start the server
CMD ["node", "dist/index.js"]
