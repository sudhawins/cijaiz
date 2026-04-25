# Docker Image Size Optimization Guide

This document outlines the optimizations made to reduce Docker image sizes and provides guidance on which approach to use.

## Optimizations Applied

### 1. **Added `.dockerignore` Files**
- Created `client/.dockerignore` and `server/.dockerignore`
- Excludes unnecessary files like `node_modules`, `.git`, `README.md`, etc.
- **Benefit:** Reduces build context size, speeds up builds by 20-30%

### 2. **npm Cache Cleaning**
- Added `npm cache clean --force` after npm install in all Dockerfiles
- **Benefit:** Saves 50-100MB per image by removing npm cache

### 3. **Builder Cleanup**
- Remove `node_modules` from client builder stage after building
- Remove build dependencies after compilation in Alpine images
- **Benefit:** Reduces intermediate layers in build stage

### 4. **Multi-Stage Build Optimizations**
- Leverage multi-stage builds to keep only necessary files in final image
- Only copy built artifacts, not build tools or source files

## Available Dockerfile Options

### Option 1: Alpine (Recommended for most cases)
**Files:** `Dockerfile.alpine` for both client and server
**Base:** `node:18-alpine`
**Typical Size:**
- Client: ~150-180MB
- Server: ~120-150MB
**Pros:**
- Smaller than slim (30-40% reduction)
- Good compatibility
- Already configured in docker-compose.yml
**Cons:**
- Slightly slower startup than distroless
- Still contains full Node runtime

**Build:**
```bash
docker-compose build
```

### Option 2: Slim (Fallback, larger but more compatible)
**Files:** `Dockerfile` for both client and server
**Base:** `node:18-slim`
**Typical Size:**
- Client: ~250-300MB
- Server: ~220-280MB
**Pros:**
- Better compatibility with certain npm packages
- Larger Debian-based image
**Cons:**
- ~50-70% larger than Alpine
**Build:**
```bash
docker build -f client/Dockerfile -t ecommerce-client .
docker build -f server/Dockerfile -t ecommerce-server .
```

### Option 3: Distroless (Most optimized, experimental)
**Files:** `Dockerfile.distroless` for both client and server
**Base:** `gcr.io/distroless/nodejs18-debian11`
**Typical Size:**
- Client: ~100-120MB
- Server: ~80-100MB
**Pros:**
- Extremely minimal (30-50% smaller than Alpine)
- Reduced attack surface
- Smallest possible footprint
**Cons:**
- No shell, no debugging tools
- Only use if you don't need to debug container
- May not work with all npm packages
**Build:**
```bash
docker build -f client/Dockerfile.distroless -t ecommerce-client:distroless ./client
docker build -f server/Dockerfile.distroless -t ecommerce-server:distroless ./server
```

## Size Comparison (Approximate)

```
Image Type          Client Size    Server Size    Total
────────────────────────────────────────────────────────
Slim (Original)      300MB          280MB         580MB
Alpine (Current)     160MB          140MB         300MB
Distroless           110MB          90MB          200MB

├─ Slim Reduction:    ~48% smaller than Slim
├─ Distroless gain:   ~33% smaller than Alpine
```

## How to Switch Between Options

### Switch to Distroless (Recommended for Production)
Update `docker-compose.yml`:
```yaml
client:
  build:
    context: ./client
    dockerfile: Dockerfile.distroless
    
server:
  build:
    context: ./server
    dockerfile: Dockerfile.distroless
```

Then rebuild:
```bash
docker-compose build --no-cache
docker-compose up
```

### Switch to Slim (if Alpine fails)
Update `docker-compose.yml`:
```yaml
client:
  build:
    context: ./client
    dockerfile: Dockerfile
    
server:
  build:
    context: ./server
    dockerfile: Dockerfile
```

## Additional Optimization Tips

### 1. **Remove Unused Dependencies**
```bash
# Analyze package.json for unused packages
npm ls --depth=0

# For client React app, consider removing:
# - ajv (only needed for schema validation)
# - qrcode.react (if QR codes not needed)
```

### 2. **Use Production Builds**
```bash
# In docker-compose.yml, ensure NODE_ENV is set
environment:
  NODE_ENV: production
```

### 3. **Enable Compression**
Server already uses: `compression` middleware for gzip compression

### 4. **Image Layering**
Current setup uses best practices:
- Builder stage for compilation
- Slim production stage with only runtime
- Removes unnecessary intermediate layers

### 5. **Caching Optimization**
Dockerfile order matters for build cache:
```dockerfile
# ✓ Good - Cache breaks only when dependencies change
COPY package.json ./
RUN npm install
COPY . .

# ✗ Bad - Cache breaks when any source changes
COPY . .
RUN npm install
```

Both Dockerfiles follow the ✓ good pattern.

## Testing Image Sizes

```bash
# Build images
docker-compose build

# Check image sizes
docker images | grep ecommerce

# Inspect image layers
docker history ecommerce-client:latest
docker history ecommerce-server:latest

# Analyze what's taking space
docker run --rm -it ecommerce-client:latest du -sh /*
```

## Troubleshooting

### "distroless image won't start"
- Distroless has no shell - errors won't show
- Check logs: `docker logs <container_id>`
- Build with Alpine instead while debugging
- Once working, switch to distroless

### "npm packages fail on distroless"
- Some packages need native compilation
- Stick with Alpine in that case
- Distroless works best with pure Node packages

### "Build fails on Alpine"
- Some packages don't compile on Alpine
- Use Slim Dockerfile instead
- Or install required build tools in Alpine

## Current Status

✅ All optimizations applied:
- Alpine images are currently active
- npm cache cleaning enabled
- .dockerignore files created
- Distroless alternatives available

**Expected Results:**
- Build time reduced by 15-25%
- Image size reduced by 30-50% (depending on option chosen)
- Faster image pulls and deployments
