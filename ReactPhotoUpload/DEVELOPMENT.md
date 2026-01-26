# Photo and Video Upload App - Development Guide

## Getting Started

### Option 1: Docker (Recommended)

#### On Windows:
```bash
# Run setup script
./setup.bat

# Start containers
docker-compose up
```

#### On Linux/Mac:
```bash
# Make setup script executable
chmod +x setup.sh

# Run setup script
./setup.sh

# Start containers
docker-compose up
```

#### Access the application:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000/api/health

### Option 2: Local Development

#### Backend Setup:
```bash
cd server
npm install

# Create .env file
echo PORT=5000 > .env
echo UPLOAD_DIR=../uploads >> .env
echo NODE_ENV=development >> .env

# Start development server
npm run dev
```

#### Frontend Setup (in another terminal):
```bash
cd client
npm install

# Create .env file
echo REACT_APP_API_URL=http://localhost:5000 > .env

# Start React dev server
npm start
```

## Working with Docker

### Build Images
```bash
# Build all images
docker-compose build

# Build specific image
docker-compose build backend
docker-compose build frontend
```

### Run Containers
```bash
# Start in foreground (see logs)
docker-compose up

# Start in background
docker-compose up -d

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend
```

### Container Management
```bash
# List running containers
docker-compose ps

# Stop containers
docker-compose stop

# Stop and remove containers
docker-compose down

# Remove everything including volumes (WARNING: deletes uploads!)
docker-compose down -v
```

## Volume Mount Explained

The `docker-compose.yml` includes:
```yaml
volumes:
  - ./uploads:/uploads
```

This means:
- Files uploaded to `/uploads` inside the container
- Are saved to `./uploads` on your host machine
- Persists even after containers stop/restart
- Accessible directly from your OS file explorer

## Modifying the Application

### Add a New API Endpoint

1. Edit `server/server.js`:
```javascript
app.get('/api/newendpoint', (req, res) => {
  res.json({ message: 'New endpoint works' });
});
```

2. Rebuild: `docker-compose build backend`
3. Restart: `docker-compose up`

### Modify Frontend Component

1. Edit files in `client/src/components/`
2. Changes automatically reflect in development mode
3. For Docker: rebuild `docker-compose build frontend`

### Update Dependencies

#### Backend:
```bash
cd server
npm install new-package
# Rebuild image
docker-compose build backend
```

#### Frontend:
```bash
cd client
npm install new-package
# Rebuild image
docker-compose build frontend
```

## Environment Variables

### Backend (.env):
```
PORT=5000
UPLOAD_DIR=/uploads
NODE_ENV=development
```

### Frontend (.env in root):
```
REACT_APP_API_URL=http://localhost:5000
```

## Debugging

### View Container Output
```bash
docker-compose logs backend
docker-compose logs frontend
```

### Execute Commands in Container
```bash
# Access backend shell
docker exec -it photo-upload-backend sh

# Access frontend shell
docker exec -it photo-upload-frontend sh

# List uploaded files
docker exec -it photo-upload-backend ls -la /uploads
```

### Check Container Health
```bash
docker-compose ps
docker stats
```

## Common Issues

### Port Already in Use
```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>

# Or use different ports in docker-compose.yml
ports:
  - "3001:3000"  # frontend
  - "5001:5000"  # backend
```

### Uploads Directory Permission Denied
```bash
# Linux/Mac:
chmod 777 ./uploads

# Windows: Right-click > Properties > Security > Edit
```

### API Connection Refused
1. Verify both containers are running: `docker-compose ps`
2. Check backend logs: `docker-compose logs backend`
3. Ensure correct port mapping in `docker-compose.yml`

### Slow Uploads
1. Check network speed
2. Monitor container resources: `docker stats`
3. Increase nginx timeout in `client/nginx.conf` if needed

## Performance Optimization

### Build Optimization
- Use multi-stage builds (already done in Dockerfiles)
- Leverage Docker layer caching
- Use `.dockerignore` files

### Runtime Optimization
- Use Alpine Linux base images (slim)
- Monitor container resource usage
- Consider using volume caching for node_modules

## Testing

### Test Backend
```bash
# Inside container
docker exec photo-upload-backend npm test
```

### Test Upload Manually
```bash
curl -X POST http://localhost:5000/api/upload \
  -F "file=@/path/to/image.jpg"
```

### Load Testing
```bash
# Using Apache Bench
ab -n 100 -c 10 http://localhost:3000/

# Using wrk
wrk -t4 -c100 -d30s http://localhost:3000/
```

## Production Deployment

### Before Deploying:
1. Set `NODE_ENV=production` in backend
2. Build production images
3. Use secrets management for sensitive data
4. Implement authentication
5. Set up monitoring and logging
6. Configure HTTPS/SSL
7. Use external volume storage (S3, Azure Blob, etc.)

### Deploy to Cloud:
- Docker Hub: Build and push images
- Kubernetes: Create deployment manifests
- AWS: ECS, Fargate
- Azure: App Service, Container Instances
- Google Cloud: Cloud Run, GKE

## Useful Commands Cheat Sheet

```bash
# Start everything
docker-compose up -d

# Stop everything
docker-compose down

# Rebuild everything
docker-compose build --no-cache

# View all logs
docker-compose logs

# Access backend shell
docker exec -it photo-upload-backend sh

# Restart specific service
docker-compose restart backend

# Check resource usage
docker stats

# Prune unused Docker resources
docker system prune -a
```

## Next Steps

1. Add user authentication
2. Implement database (MongoDB, PostgreSQL)
3. Add file compression
4. Setup CI/CD pipeline
5. Add automated tests
6. Deploy to production
7. Add monitoring/alerting
