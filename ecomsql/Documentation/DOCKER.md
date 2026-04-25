# Docker Setup Guide

This guide covers how to run the E-commerce application using Docker.

**⚠️ Having Docker build issues?** See [DOCKER_TROUBLESHOOTING.md](DOCKER_TROUBLESHOOTING.md) for solutions.

## Prerequisites

- Docker and Docker Compose installed on your system
  - [Install Docker Desktop](https://www.docker.com/products/docker-desktop)
  - Docker Compose is included with Docker Desktop

## Environment Variables

Before running the application, set up your environment variables:

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your database credentials and API configuration:
   ```
   # Database
   DB_SERVER=your-database-server.database.windows.net
   DB_NAME=your-database-name
   DB_USER=your-database-user
   DB_PASSWORD=your-database-password
   DB_PORT=1433
   
   # Client API URL (for Docker, use service-to-service communication)
   REACT_APP_API_URL=http://server:5000/api
   ```

### API URL Configuration

The `REACT_APP_API_URL` environment variable tells the client where to reach the API:

- **In Docker (recommended):** `http://server:5000/api`
  - Uses Docker service name for internal communication
  - No external port exposure needed
  - Automatically configured in `docker-compose.yml`

- **For external access:** `http://localhost:5000/api`
  - Use this if accessing from outside the container network
  - Add to `.env` file to override docker-compose default

- **For production:** `https://your-api-domain.com/api`
  - Use your actual production domain

## Running the Application

### Using Docker Compose (Recommended)

Run the entire application stack with a single command:

```bash
docker-compose up
```

This will:
- Build Docker images for both client and server
- Start the frontend on `http://localhost:3000`
- Start the backend API on `http://localhost:5000`
- Create a shared network for communication between services

### Running Services Individually

**Build images:**
```bash
docker-compose build
```

**Start services in background:**
```bash
docker-compose up -d
```

**Stop services:**
```bash
docker-compose down
```

**View logs:**
```bash
docker-compose logs -f
docker-compose logs -f server
docker-compose logs -f client
```

### Customizing the API URL

The client automatically picks up the `REACT_APP_API_URL` from the `.env` file:

```bash
# Override the API URL in .env
REACT_APP_API_URL=http://server:5000/api

# Then restart containers
docker-compose down
docker-compose up
```

To use a different API URL without rebuilding, set it in `.env`:

```bash
# For localhost (external access)
REACT_APP_API_URL=http://localhost:5000/api

# For production domain
REACT_APP_API_URL=https://api.example.com
```

## Accessing the Application

- **Frontend**: http://localhost:3000
- **API**: http://localhost:5000/api

## Building Images Manually

### Using Default Dockerfile (Slim)
```bash
cd client
docker build -t ecommerce-client:latest .
docker run -p 3000:3000 ecommerce-client:latest
```

### Using Alpine Dockerfile (Alternative - More Reliable)

If you're having issues pulling `node:18-slim`, use the Alpine version instead:

```bash
# Client
docker build -f Dockerfile.alpine -t ecommerce-client:latest .

# Server
docker build -f Dockerfile.alpine -t ecommerce-server:latest .
```

**When to use Alpine Dockerfile:**
- Behind a corporate proxy
- Experiencing image pull failures
- Network connectivity issues
- Want smaller image size
- Running on restricted environments

To use Alpine in docker-compose, update the build section:
```yaml
client:
  build:
    context: ./client
    dockerfile: Dockerfile.alpine  # Use this instead
```

### Server Image
```bash
cd server
docker build -t ecommerce-server:latest .
docker run -p 5000:5000 \
  -e DB_SERVER=your-server \
  -e DB_NAME=your-db \
  -e DB_USER=your-user \
  -e DB_PASSWORD=your-password \
  ecommerce-server:latest
```

## Managing Uploads

The server container maintains a volume for uploads:
- Docker Compose: `/uploads` directory is mounted from `./server/uploads`
- Files will persist between container restarts

To clear uploads:
```bash
rm -rf server/uploads/*
```

## Troubleshooting

### Database Connection Issues
- Ensure your database credentials in `.env` are correct
- Verify your database server is accessible from where Docker is running
- Check server logs: `docker-compose logs server`

### Port Already in Use
If ports 3000 or 5000 are already in use, modify the port mappings in `docker-compose.yml`:
```yaml
ports:
  - "3001:3000"  # Access on port 3001 instead
  - "5001:5000"  # Access on port 5001 instead
```

### Container Exits Immediately
Check logs for errors:
```bash
docker-compose logs server
docker-compose logs client
```

### NPM Install Failures During Build
If you see errors like `npm ci failed` or dependency installation issues:

**Error:** `process "/bin/sh -c npm ci" did not complete successfully`

**Solution:** Clear Docker cache and rebuild:
```bash
# Remove old images
docker-compose down
docker system prune -a

# Rebuild with no cache
docker-compose build --no-cache

# Start services
docker-compose up
```

**Alternative:** Manually rebuild specific service:
```bash
docker-compose build --no-cache client
docker-compose up client
```

**If still failing:**
1. Check your `package-lock.json` is not corrupted
2. Try deleting it and letting npm regenerate it:
   ```bash
   rm -f package-lock.json
   npm install --save-dev
   ```
3. The Dockerfile now uses `npm install` with `--legacy-peer-deps` flag for better compatibility

### Network Issues Between Services
The services are on the same Docker network (`ecommerce-network`). They can communicate using the service names:
- Client can reach server at: `http://server:5000`
- But the environment variable `REACT_APP_API_URL` uses `http://localhost:5000` for external access

## Production Deployment

For production use:
1. Use proper credentials management (Docker secrets or environment variable services)
2. Enable HTTPS/TLS
3. Set up proper logging and monitoring
4. Consider using a container orchestration platform (Kubernetes)
5. Use multi-stage builds as already done in the Dockerfiles
6. Implement health checks (already included for the server)

## Docker Hub (Optional)

To publish your images to Docker Hub:

```bash
docker tag ecommerce-client:latest your-username/ecommerce-client:latest
docker tag ecommerce-server:latest your-username/ecommerce-server:latest
docker push your-username/ecommerce-client:latest
docker push your-username/ecommerce-server:latest
```

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Best Practices for Node.js in Docker](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)
