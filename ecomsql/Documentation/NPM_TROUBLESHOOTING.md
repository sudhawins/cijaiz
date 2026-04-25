# NPM Installation Troubleshooting Guide

## Common NPM Install Failures in Docker

### Problem 1: Native Module Compilation Fails

**Error:**
```
gyp ERR! configure error
gyp ERR! stack Error: not found: make
gyp ERR! stack at childProcess.exitHandler
```

**Cause:**
Missing build tools (python3, make, g++, gcc) required to compile native modules like `mssql`, `bcrypt`, `canvas`, etc.

**Solution:**
The updated Dockerfiles now include build tools. The key addition is:

```dockerfile
# For Debian/Ubuntu (slim base):
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ gcc \
    && rm -rf /var/lib/apt/lists/*

# For Alpine:
RUN apk add --no-cache --virtual .build-deps \
    python3 make g++ gcc cairo-dev
```

**Quick Fix:**
```bash
docker-compose build --no-cache
docker-compose up
```

### Problem 2: Peer Dependency Warnings/Errors

**Error:**
```
npm ERR! peer dep missing: react@^18.0.0
```

**Solution:**
Both Dockerfiles use `--legacy-peer-deps` flag:
```dockerfile
RUN npm install --legacy-peer-deps --prefer-offline --no-audit
```

This ignores peer dependency warnings that aren't critical.

### Problem 3: Network Timeout During Install

**Error:**
```
npm ERR! code ETIMEDOUT
npm ERR! syscall connect
npm ERR! errno ETIMEDOUT
```

**Solution:**
Use `--prefer-offline` and increase timeout:
```bash
npm install --prefer-offline --no-audit --legacy-peer-deps --timeout=60000
```

Or in Dockerfile:
```bash
npm config set fetch-timeout 60000
npm config set fetch-retry-mintimeout 20000
npm config set fetch-retry-maxtimeout 120000
npm install --legacy-peer-deps
```

### Problem 4: Package Lock File Issues

**Error:**
```
npm ERR! The integrity values in the package-lock don't match the package.json
```

**Solution:**
Regenerate package-lock.json locally:
```bash
rm -f package-lock.json
npm install
git add package-lock.json
git commit -m "Regenerate package-lock"
```

Then rebuild Docker image.

### Problem 5: Disk Space Issues

**Error:**
```
npm ERR! ENOSPC: no space left on device
```

**Solution:**
Check Docker disk allocation:
```bash
docker system df
docker system prune -a --volumes
```

On Windows/Mac Docker Desktop:
- Settings > Resources > Disk image size
- Increase to at least 20GB

## Debugging NPM Install in Docker

### Step 1: Check Which Step Fails

```bash
docker-compose build --progress=plain
```

This shows each line of output. Look for the failing command.

### Step 2: Build with Verbose Logging

```bash
docker build --progress=plain \
  -t ecommerce-client:debug \
  --build-arg NPM_CONFIG_LOGLEVEL=verbose \
  ./client
```

### Step 3: Test Locally First

Install dependencies locally to identify issues:

```bash
cd client
npm install --verbose
```

or 

```bash
cd server
npm install --production --verbose
```

If this fails locally, fix it before trying in Docker.

### Step 4: Enter Docker Container Interactively

Create a temporary Dockerfile to debug:

```dockerfile
FROM node:18.19.0-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ gcc \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./

# This will keep container running
CMD ["/bin/bash"]
```

Build and run:
```bash
docker build -t debug-build .
docker run -it debug-build
# Inside container:
npm install --verbose
```

## NPM Configuration Optimization

### Create .npmrc File

Add `client/.npmrc` and `server/.npmrc`:

```ini
# Optimize npm for Docker
legacy-peer-deps=true
prefer-offline=true
no-audit=true
fetch-timeout=60000
fetch-retry-mintimeout=20000
fetch-retry-maxtimeout=120000
depth=0

# Use npm cache effectively
cache=/tmp/npm-cache

# Use specific registry if behind proxy
# registry=https://registry.npmjs.org/
```

Then in Dockerfile:
```dockerfile
COPY package.json package-lock.json .npmrc ./
RUN npm install  # Uses .npmrc settings
```

### Dockerfile Configuration

```dockerfile
# Set npm config in Dockerfile
RUN npm config set fetch-timeout 60000 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm install --legacy-peer-deps
```

## Common Packages That Need Build Tools

These packages require native compilation and need build tools:

**Server (mssql driver):**
- `mssql` - Requires native modules
- `node-gyp` - Build tool for native modules

**Client (optional/rare):**
- `canvas` - Image processing
- `sharp` - Image resizing
- `bcrypt` - Password hashing
- `sqlite3` - Database

## Quick Solutions

### Solution 1: Use Provided Dockerfiles (Recommended)

The updated `Dockerfile` and `Dockerfile.alpine` now include all necessary build tools.

```bash
docker-compose build --no-cache
docker-compose up
```

### Solution 2: Manual Configuration

If still failing, check the Dockerfile has:

```dockerfile
# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ gcc

# npm install with proper flags
RUN npm install \
    --legacy-peer-deps \
    --prefer-offline \
    --no-audit
```

### Solution 3: Use Alpine Dockerfile

Alpine is more reliable for npm install in Docker:

```bash
docker build -f client/Dockerfile.alpine -t ecommerce-client:latest ./client
docker build -f server/Dockerfile.alpine -t ecommerce-server:latest ./server
```

### Solution 4: Clear Everything and Rebuild

```bash
# Stop containers
docker-compose down

# Remove images and cache
docker system prune -a --volumes -f

# Rebuild without cache
docker-compose build --no-cache

# Start fresh
docker-compose up
```

## Monitoring npm Install

### Watch Build Progress

```bash
docker-compose build --progress=plain client
```

### See Live Logs During Build

```bash
docker-compose build --progress=plain 2>&1 | tee build.log
```

### Build Specific Service

```bash
docker-compose build --no-cache client
```

## Environment Variables for NPM

In docker-compose.yml:

```yaml
services:
  client:
    build:
      context: ./client
      dockerfile: Dockerfile
      args:
        - NPM_CONFIG_FETCH_TIMEOUT=60000
        - NPM_CONFIG_LEGACY_PEER_DEPS=true
    environment:
      - NODE_ENV=production
```

## Verification

After successful npm install:

```bash
# Check node_modules exists and has content
docker exec ecommerce-client ls -la /app/node_modules | head -20

# Check specific package
docker exec ecommerce-client ls /app/node_modules/react
```

## Production Best Practices

For production builds:

1. **Use .npmrc with optimized settings:**
   ```ini
   legacy-peer-deps=true
   prefer-offline=true
   fetch-timeout=60000
   depth=0
   ```

2. **Install build-essential once:**
   ```dockerfile
   RUN apt-get update && apt-get install -y --no-install-recommends \
       build-essential python3 \
       && rm -rf /var/lib/apt/lists/*
   ```

3. **Cache npm modules:**
   ```dockerfile
   COPY package*.json ./
   RUN npm ci --production  # After build tools are installed
   ```

4. **Remove build tools from final image:**
   ```dockerfile
   # In final stage (not builder)
   FROM node:18.19.0-slim
   COPY --from=builder /app/node_modules ./node_modules
   # Don't install build tools in final stage
   ```

## Still Failing?

1. **Run diagnosis:**
   ```bash
   docker-troubleshoot.bat check
   ```

2. **Check npm cache:**
   ```bash
   docker run --rm node:18.19.0-slim npm cache clean --force
   ```

3. **Try without package-lock:**
   ```bash
   rm package-lock.json
   docker-compose build --no-cache
   ```

4. **Use verbose logging:**
   ```bash
   docker-compose build --progress=plain --build-arg NPM_CONFIG_LOGLEVEL=debug
   ```

5. **Check Docker resources:**
   ```bash
   docker stats
   # Make sure Docker has at least 4GB RAM
   ```

If still stuck, check the specific error message in build output and search for that error with "npm" + "docker" keywords.
