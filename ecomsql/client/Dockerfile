# Build stage
# Using specific Node version tag for reliability
# Fallback: if slim doesn't work, Docker will use latest 18.x
FROM node:18.19.0-slim as builder

WORKDIR /app

# Install build essentials and dependencies
# Required for native module compilation (node-gyp, canvas, etc)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json package-lock.json .npmrc* ./

# Install dependencies
# Using npm install for better compatibility
# --prefer-offline helps with network issues
# --no-audit speeds up installation
RUN npm install --prefer-offline --no-audit --legacy-peer-deps 2>&1 && \
    npm cache clean --force

# Copy source code
COPY public public/
COPY src src/

# Build the application
RUN npm run build && \
    rm -rf node_modules

# Production stage
FROM node:18-slim

WORKDIR /app

# Install serve to run the production build
RUN npm install -g serve && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/build build/

# Expose port 3002
EXPOSE 3002

# Set environment to production
ENV NODE_ENV=production

# Start the application
CMD ["serve", "-s", "build", "-l", "3002"]
