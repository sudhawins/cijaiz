# Nginx Reverse Proxy Configuration

## Overview

Nginx is now configured as the main entry point for the application. It acts as a reverse proxy that:
- Serves the React frontend on `/`
- Proxies API requests to `/api/` to the Node.js backend
- Handles compression and load balancing
- Provides a single, unified interface on port 80

## Architecture

```
┌─────────────────────────────────────────┐
│         Client Browser                   │
│     http://localhost (port 80)           │
└────────────────────┬────────────────────┘
                     │
                     ▼
        ┌────────────────────────┐
        │   Nginx Reverse Proxy   │
        │   (Port 80)             │
        └────┬──────────────┬─────┘
             │              │
        ┌────▼────┐    ┌────▼──────┐
        │ Routes  │    │ Routes to  │
        │ / to    │    │ /api/ to   │
        │Client   │    │Server      │
        └────┬────┘    └────┬──────┘
             │              │
        ┌────▼────┐    ┌────▼──────┐
        │React App│    │Node Server │
        │ Port 3000   │ Port 5000  │
        └─────────┘    └───────────┘
```

## Configuration Files

### 1. **nginx.conf** - Main Configuration
Located in root directory. Defines:
- Upstream servers (client and api)
- Server block listening on port 80
- Location blocks for routing
- Compression settings
- Timeout and buffer settings

### 2. **Dockerfile.nginx** - Docker Image
Builds nginx image with custom configuration:
- Uses nginx:1.25-alpine (lightweight)
- Copies custom nginx.conf
- Exposes port 80

### 3. **docker-compose.yml** - Service Definition
Defines the nginx service with:
- Build context pointing to Dockerfile.nginx
- Port 80 exposed to host
- Dependencies on client and server
- Network configuration
- Health checks

## Location Blocks

### `location /` - Frontend
```nginx
location / {
    proxy_pass http://client;
}
```
Routes all root requests to the React frontend (port 3000)

### `location /api/` - Backend API
```nginx
location /api/ {
    proxy_pass http://api/api/;
}
```
Routes `/api/*` requests to Node.js backend (port 5000)

### `location /health` - Health Check
```nginx
location /health {
    proxy_pass http://api/api/health;
}
```
Health check endpoint for docker-compose

## URL Mappings

| Request | Routes To | Port |
|---------|-----------|------|
| http://localhost/ | React Frontend | 3000 |
| http://localhost/api/* | Node Backend | 5000 |
| http://localhost/health | Backend Health | 5000 |

## Configuration Details

### Proxy Headers
```nginx
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```
These forward client information to upstream servers.

### Gzip Compression
```nginx
gzip on;
gzip_types text/plain text/css text/javascript application/json;
gzip_min_length 1000;
```
Automatically compresses responses > 1KB for faster delivery.

### Client Max Body Size
```nginx
client_max_body_size 20M;
```
Allows file uploads up to 20MB.

### WebSocket Support
```nginx
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection 'upgrade';
```
Enables WebSocket proxying for real-time features (if used).

## Runtime Configuration

### Environment Variables in docker-compose.yml

**Client:**
```yaml
REACT_APP_API_URL=http://localhost/api
```
Client connects to API through nginx on `/api/` path.

**Server:**
```yaml
CLIENT_URL=http://localhost
```
Server references frontend at root, handled by nginx.

## Building and Running

### With Nginx (Recommended)
```bash
# Start all services with nginx
docker-compose up

# Access application at http://localhost
# Frontend: http://localhost
# API: http://localhost/api
```

### Without Nginx (Manual/Local Development)
```bash
# Terminal 1: Start server
cd server
npm install
npm start

# Terminal 2: Start client
cd client
npm install
npm start
# Update client/.env to point to http://localhost:5000/api
```

## Accessing the Application

### With Nginx (Default)
- **Frontend:** http://localhost
- **API:** http://localhost/api
- **Health Check:** http://localhost/health

### Without Nginx
- **Frontend:** http://localhost:3000
- **API:** http://localhost:5000/api
- **Health Check:** http://localhost:5000/api/health

## Troubleshooting

### Nginx Container Won't Start
```bash
# Check logs
docker-compose logs nginx

# Verify nginx.conf syntax
docker exec ecommerce-nginx nginx -t
```

### API Requests Return 404
1. Verify nginx location blocks in nginx.conf
2. Check server is running: `docker-compose logs server`
3. Test direct API: `curl http://localhost:5000/api/health`

### Slow Response Times
1. Check compression is enabled in nginx.conf
2. Verify buffer sizes are adequate
3. Check server logs for database issues

### Large File Uploads Fail
- Increase `client_max_body_size` in nginx.conf
- Default is 20M, increase if needed

### Static Assets Not Loading
1. Verify React build created `build/` directory
2. Check `client/Dockerfile` is copying build assets
3. Rebuild client: `docker-compose build --no-cache client`

## Performance Optimization

### Enable Caching
```nginx
location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
    expires 30d;
    add_header Cache-Control "public, immutable";
}
```

### Connection Pooling
```nginx
upstream api {
    server server:5000;
    keepalive 32;
}
```

### Load Balancing (Multiple Servers)
```nginx
upstream api {
    server server1:5000;
    server server2:5000;
    server server3:5000;
    least_conn;  # Least connections algorithm
}
```

## Security Considerations

### HTTPS in Production
Add SSL certificate:
```nginx
server {
    listen 443 ssl http2;
    ssl_certificate /etc/nginx/certs/cert.pem;
    ssl_certificate_key /etc/nginx/certs/key.pem;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    return 301 https://$host$request_uri;
}
```

### Rate Limiting
```nginx
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

location /api/ {
    limit_req zone=api_limit burst=20 nodelay;
    proxy_pass http://api/api/;
}
```

### CORS Headers
```nginx
location /api/ {
    add_header 'Access-Control-Allow-Origin' '$http_origin' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization' always;
}
```

## Monitoring

### Check Service Health
```bash
# Using curl
curl http://localhost/health

# Using docker-compose
docker-compose ps

# View nginx logs
docker-compose logs nginx
```

### Nginx Stats
```bash
# Connect to nginx container
docker exec -it ecommerce-nginx /bin/sh

# Check active connections
ps aux | grep nginx

# Test configuration
nginx -t
```

## Scaling

To scale with multiple backend servers:

1. Update nginx.conf upstream:
```nginx
upstream api {
    server server:5000;
    server server2:5000;
    server server3:5000;
}
```

2. Scale services in docker-compose:
```bash
docker-compose up --scale server=3
```

## Maintenance

### Reload Configuration (No Downtime)
```bash
docker exec ecommerce-nginx nginx -s reload
```

### View Nginx Version
```bash
docker exec ecommerce-nginx nginx -v
```

### Access Nginx Container
```bash
docker exec -it ecommerce-nginx /bin/sh
```

## Alternative: Docker Networking

If you don't want to use nginx, you can access services directly:

**From Host:**
- Frontend: http://localhost:3000
- API: http://localhost:5000

**From Docker Network:**
- Frontend: http://client:3000
- API: http://server:5000

Update `REACT_APP_API_URL` accordingly in client/.env

## Benefits of Nginx Reverse Proxy

✅ **Single Entry Point** - One URL for entire application
✅ **Load Balancing** - Distribute traffic across multiple servers
✅ **Compression** - Automatic Gzip for faster delivery
✅ **Security** - Hide internal service details
✅ **Performance** - Caching, connection pooling
✅ **Scalability** - Easy to add more servers
✅ **SSL/TLS** - Centralized certificate management
✅ **URL Rewriting** - Flexible routing rules
