# Docker Build Troubleshooting

## Quick Links

- **NPM Install Failures?** See [NPM_TROUBLESHOOTING.md](NPM_TROUBLESHOOTING.md)
- **Dockerfile Issues?** See [DOCKERFILE_GUIDE.md](DOCKERFILE_GUIDE.md)
- **Environment Setup?** See [ENV_SETUP.md](ENV_SETUP.md)

## Common Docker Build Issues

### Issue 1: NPM Install Fails During Build

**Error:**
```
failed to solve: process "/bin/sh -c npm install" did not complete successfully: exit code: 1
```

**Causes:**
- Missing build tools (python3, make, g++, gcc)
- Peer dependency conflicts
- Network timeout
- Insufficient disk space

**Solution:**
This is now fixed in the updated Dockerfiles which include all build tools. Try:

```bash
docker-compose down
docker system prune -a --volumes -f
docker-compose build --no-cache
docker-compose up
```

**For detailed troubleshooting, see [NPM_TROUBLESHOOTING.md](NPM_TROUBLESHOOTING.md)**

### Issue 2: Docker Daemon Not Running

**Error:**
```
error during connect: this error may indicate the docker daemon is not running
```

**Solution:**
- **Windows:** Start Docker Desktop from Applications menu
- **Mac:** Open Docker.app
- **Linux:** Run `sudo systemctl start docker`

Verify it's running:
```bash
docker --version
docker ps
```

### Issue 3: Cannot Pull Docker Image

**Error:**
```
failed to resolve source metadata for docker.io/library/node:18-slim
```

**Causes:**
- Docker daemon not running
- No internet connection
- Docker registry timeout
- Docker authentication issues

**Solutions:**

**1. Restart Docker daemon:**
```bash
# Windows (PowerShell as Admin)
net stop com.docker.service
net start com.docker.service

# Or restart Docker Desktop
# Mac/Windows: Quit and reopen Docker Desktop

# Linux
sudo systemctl restart docker
```

**2. Try pulling the image manually:**
```bash
docker pull node:18.19.0-slim
```

**3. Use Alpine with build tools (Alternative Dockerfile):**
```bash
# Use the Alpine version instead
docker build -f client/Dockerfile.alpine -t ecommerce-client .
docker build -f server/Dockerfile.alpine -t ecommerce-server .
```

**4. Update docker-compose.yml to use Alpine:**
```yaml
# In docker-compose.yml, use Dockerfile.alpine
client:
  build:
    context: ./client
    dockerfile: Dockerfile.alpine  # Use this instead of Dockerfile
```

**5. Clear Docker cache and retry:**
```bash
# Remove dangling images
docker system prune -a

# Try building again
docker-compose build --no-cache
```

**6. Check Docker storage:**
```bash
# On Windows, check storage allocation in Docker Desktop settings
# Settings > Resources > Disk image size
# Ensure sufficient disk space is allocated
```

### Issue 3: Network Issues Behind Proxy

If you're behind a corporate proxy:

**Solution 1: Configure Docker Desktop**
- Windows/Mac: Settings > Resources > Proxies
- Set HTTP/HTTPS proxy settings

**Solution 2: Use Alpine directly (most reliable):**
```bash
docker build -f client/Dockerfile.alpine -t ecommerce-client .
docker build -f server/Dockerfile.alpine -t ecommerce-server .
```

### Available Dockerfiles

**Default (Recommended):**
- `Dockerfile` - Uses `node:18.19.0-slim`
- Most compatible, good balance of size and features
- Build: `docker-compose build`

**Alpine (Lightweight, more reliable behind proxies):**
- `Dockerfile.alpine` - Uses `node:18-alpine` with build tools
- Smaller image size
- Better for restricted networks
- Build: `docker build -f Dockerfile.alpine .`

### Quick Fix Checklist

- [ ] Docker daemon is running (`docker ps` works)
- [ ] Internet connection is working
- [ ] No Docker engine is already running the container
- [ ] Sufficient disk space available
- [ ] Try `docker pull node:18.19.0-slim` manually
- [ ] If all else fails, use `Dockerfile.alpine`

### Build Commands by Scenario

**Scenario 1: Normal conditions (recommended)**
```bash
docker-compose build
docker-compose up
```

**Scenario 2: Behind proxy or network issues**
```bash
# Edit docker-compose.yml to use Dockerfile.alpine
docker-compose build --no-cache
docker-compose up
```

**Scenario 3: Manual build with specific Dockerfile**
```bash
# For client
docker build -f client/Dockerfile.alpine -t ecommerce-client:latest ./client
docker run -p 3000:3000 ecommerce-client:latest

# For server
docker build -f server/Dockerfile.alpine -t ecommerce-server:latest ./server
docker run -p 5000:5000 ecommerce-server:latest
```

**Scenario 4: Force rebuild without cache**
```bash
docker-compose down
docker system prune -a --volumes
docker-compose build --no-cache
docker-compose up
```

### Detailed Troubleshooting Steps

1. **Check Docker is running:**
   ```bash
   docker version
   docker ps
   ```

2. **Test Docker connectivity:**
   ```bash
   docker pull hello-world
   ```

3. **Check logs:**
   ```bash
   # View build logs in detail
   docker-compose build --progress=plain client
   ```

4. **Verify images available locally:**
   ```bash
   docker image ls | grep node
   ```

5. **If image exists locally but compose doesn't use it:**
   ```bash
   # Force re-pull
   docker pull node:18.19.0-slim
   docker-compose build --pull --no-cache
   ```

### Still Having Issues?

If none of the above works:

1. **Provide Docker info:**
   ```bash
   docker version
   docker info
   ```

2. **Check docker-compose version:**
   ```bash
   docker-compose --version
   ```

3. **Try without Docker:**
   - Run server locally: `cd server && npm install && npm start`
   - Run client locally: `cd client && npm install && npm start`
   - This helps isolate if issue is Docker vs Node

4. **Platform-specific help:**
   - Windows: Check Docker Desktop settings for WSL 2 integration
   - Mac: Increase Docker Desktop memory allocation
   - Linux: Check Docker service and user permissions

### Recommended Solution

If you're having persistent Docker image pull issues:

**Use the Alpine Dockerfile:**
```bash
# Update docker-compose.yml
# Change: dockerfile: Dockerfile
# To: dockerfile: Dockerfile.alpine

docker-compose build
docker-compose up
```

Alpine images are more reliable and have smaller file sizes, especially in restricted network environments.
