# Build stage - Install dependencies with build tools
FROM node:18.19.0-slim AS builder

WORKDIR /app

# Install build essentials for native module compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json package-lock.json .npmrc* ./

# Install production dependencies only
RUN npm install --production --prefer-offline --no-audit --legacy-peer-deps 2>&1 && \
    npm cache clean --force

# Final stage - Minimal production image
FROM node:18.19.0-slim

WORKDIR /app

# Set environment to production
ENV NODE_ENV=production

# Copy only node_modules and source code from builder
COPY --from=builder /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY server.js ./
COPY config.js ./
COPY routes ./routes
COPY middleware ./middleware
COPY services ./services

# Create uploads directory
RUN mkdir -p uploads

# Expose port 5000
EXPOSE 5000

# Health check (simplified to just check if port is open)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:5000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))" || exit 1

# Start the server
CMD ["npm", "start"]
