# Dockerfile Selection Guide

This project includes multiple Dockerfile options to handle different environments and scenarios.

## Available Dockerfiles

### 1. **Dockerfile** (Default - Recommended)
- **Base Image:** `node:18.19.0-slim`
- **Best For:** Standard environments, most Node.js projects
- **Advantages:**
  - Good balance between size and features
  - Better compatibility with most npm packages
  - More reliable in standard network conditions
- **Build:** `docker-compose build` (uses this by default)
- **Manual Build:**
  ```bash
  docker build -t ecommerce-client:latest ./client
  docker build -t ecommerce-server:latest ./server
  ```

### 2. **Dockerfile.alpine** (Alternative - Lightweight)
- **Base Image:** `node:18-alpine`
- **Best For:** Restricted networks, behind proxies, disk space constraints
- **Advantages:**
  - Smaller image size (~100-200MB vs 300-400MB)
  - Faster to pull and build
  - More reliable behind corporate proxies
  - Includes build tools for compilation
- **Build:** `docker build -f Dockerfile.alpine -t ecommerce-client:latest ./client`
- **Use When:**
  - Experiencing image pull failures
  - Behind corporate proxy
  - Limited disk space
  - Network connectivity issues

## Switching Between Dockerfiles

### Option 1: Update docker-compose.yml (Recommended)

Edit `docker-compose.yml` and change the dockerfile:

```yaml
services:
  client:
    build:
      context: ./client
      dockerfile: Dockerfile  # Change to: Dockerfile.alpine
      
  server:
    build:
      context: ./server
      dockerfile: Dockerfile  # Change to: Dockerfile.alpine
```

Then rebuild:
```bash
docker-compose build --no-cache
docker-compose up
```

### Option 2: Manual Build

```bash
# Build with Alpine
docker build -f client/Dockerfile.alpine -t ecommerce-client:latest ./client
docker build -f server/Dockerfile.alpine -t ecommerce-server:latest ./server

# Run manually
docker run -p 3000:3000 ecommerce-client:latest
docker run -p 5000:5000 ecommerce-server:latest
```

### Option 3: Using Helper Script

```bash
# Windows
docker-troubleshoot.bat alpine

# Linux/Mac
./docker-troubleshoot.sh alpine
```

## Troubleshooting: Which Dockerfile to Use?

### Problem: "failed to resolve source metadata for node:18-slim"

**Solution:** Use Alpine Dockerfile
```bash
docker build -f client/Dockerfile.alpine -t ecommerce-client:latest ./client
```

### Problem: Docker build succeeds but npm install fails

**Solution:** Both Dockerfiles include fallback patterns:
```dockerfile
RUN npm install --legacy-peer-deps || npm install
```

### Problem: Image is too large

**Solution:** Use Alpine Dockerfile (saves ~200MB per image)

### Problem: Behind corporate proxy

**Solution:** Use Alpine Dockerfile, it's more reliable with restricted networks

## Quick Decision Tree

```
Is your environment restricted (proxy, limited bandwidth)?
├─ YES → Use Dockerfile.alpine
└─ NO  → Use Dockerfile (default)

Is docker-compose build failing?
├─ YES → Try Dockerfile.alpine
└─ NO  → Use current Dockerfile

Do you want smallest possible image?
├─ YES → Use Dockerfile.alpine
└─ NO  → Use Dockerfile
```

## Building Locally vs CI/CD

### Local Development
- Start with **Dockerfile** (default)
- If issues occur, switch to **Dockerfile.alpine**

### CI/CD Pipelines (GitHub Actions, Jenkins, etc.)
- Use **Dockerfile.alpine** for reliability
- Set in docker-compose.yml or build command

### Production Deployment
- **Dockerfile** for maximum compatibility
- **Dockerfile.alpine** for minimal footprint
- Choose based on your infrastructure

## Image Size Comparison

| Dockerfile | Base Image | Final Size (approx) | Build Time |
|-----------|-----------|------------------|-----------|
| Dockerfile | node:18.19.0-slim | 400-450MB | 2-3 min |
| Dockerfile.alpine | node:18-alpine | 180-220MB | 1-2 min |

## Dockerfile Contents

### What's Different?

**Both Dockerfiles:**
- ✅ Multi-stage build (builder + production)
- ✅ Proper dependency installation
- ✅ Forward slash paths (/ everywhere)
- ✅ Health checks (server only)

**Unique to Dockerfile:**
- Uses `node:18.19.0-slim` (minimal Linux)

**Unique to Dockerfile.alpine:**
- Uses `node:18-alpine` (ultra-minimal)
- Includes: `python3`, `make`, `g++`, `cairo-dev`
- Better for compiling native modules

## Recommendations

| Use Case | Dockerfile | Reason |
|----------|-----------|--------|
| Corporate environment | alpine | Behind proxy, more reliable |
| Local development | default | Standard setup, better docs |
| Small VPS/Cloud | alpine | Saves bandwidth/storage |
| Kubernetes | alpine | Smaller is better for orchestration |
| Traditional servers | default | More compatible |

## Switching Back

If you switch to Alpine and need to go back:

1. Edit docker-compose.yml:
   ```yaml
   dockerfile: Dockerfile
   ```

2. Rebuild:
   ```bash
   docker-compose build --pull --no-cache
   docker-compose up
   ```

## Testing Different Dockerfiles

```bash
# Test default
docker build -t test-default ./client
docker run --rm test-default

# Test alpine
docker build -f client/Dockerfile.alpine -t test-alpine ./client
docker run --rm test-alpine

# Compare sizes
docker images | grep test-
```

## Troubleshooting Helper

Use the included helper script:

```bash
# Windows
docker-troubleshoot.bat check    # Check environment
docker-troubleshoot.bat alpine   # Build with Alpine
docker-troubleshoot.bat rebuild  # Rebuild everything

# Linux/Mac
./docker-troubleshoot.sh check
./docker-troubleshoot.sh alpine
./docker-troubleshoot.sh rebuild
```
