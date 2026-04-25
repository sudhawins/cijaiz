# Image Loading Fix - Docker Setup

## Problem
Product images were not displaying in Docker because:
1. **Missing nginx route**: `/uploads/` path wasn't proxied to the API server
2. **Image URL construction**: Client was building incorrect image URLs

## Solution Implemented

### 1. Updated nginx.conf
Added a new location block to proxy image requests:
```nginx
# Uploaded files (images, documents, etc)
location /uploads/ {
    proxy_pass http://api/uploads/;
    expires 30d;
    add_header Cache-Control "public, immutable";
}
```

**What this does:**
- Routes all `/uploads/*` requests through nginx to the server
- Caches images for 30 days to improve performance
- Server (running on port 5000) serves files from `/app/uploads` directory

### 2. Updated ProductListing.js
Improved image URL logic to handle multiple scenarios:
```javascript
const getImageUrl = () => {
  if (!product.image_url) return placeholder;
  if (product.image_url.startsWith('http')) return product.image_url; // Absolute URL
  if (API_BASE_URL) return `${API_BASE_URL}${product.image_url}`;    // Local dev
  return product.image_url;                                           // Docker relative
};
```

**What this does:**
- Works in local development (uses API_BASE_URL)
- Works in Docker (uses relative /uploads/ path through nginx)
- Gracefully handles missing or invalid images

## How Image Serving Works in Docker

```
┌─────────────────┐
│  Browser/Client │
│ http://localhost│
└────────┬────────┘
         │ GET /uploads/image.jpg
         ▼
    ┌─────────────────────────────────────────────────────┐
    │              Nginx (Port 80)                         │
    │  location /uploads/ → proxy_pass http://api/uploads/│
    └──────────────────────┬──────────────────────────────┘
                           │ Internal network
                           ▼
                 ┌──────────────────────────────────────┐
                 │  Express Server (Port 5000)          │
                 │  app.use('/uploads', static(...))    │
                 │  Serves from: /app/uploads           │
                 └──────────────────────────────────────┘
                           │
                           ▼
                 ┌──────────────────────────────────────┐
                 │    Docker Volume               
                 │  ./server/uploads:/app/uploads       │
                 │  (persistent file storage)           │
                 └──────────────────────────────────────┘
```

## File Structure in Docker

```
Docker Container
├── /app (Express server)
│   ├── server.js
│   ├── uploads/ ← Mounted from host
│   │   ├── product-1772259510885-191569804.jpg
│   │   ├── product-1772259838875-567804125.jpg
│   │   └── ...
│   └── ...
└── ...

Host Machine
└── ./server/uploads ← Shared with container
    ├── product-1772259510885-191569804.jpg
    ├── product-1772259838875-567804125.jpg
    └── ...
```

## API Response Format

Products API returns:
```json
{
  "id": 1,
  "name": "Product Name",
  "price": 29.99,
  "image_url": "/uploads/product-1772259510885-191569804.jpg"
}
```

**Image URL resolution in browser:**
- Docker: `/uploads/product....jpg` → nginx proxies → server serves
- Local: `http://localhost:5000/uploads/product....jpg` → server serves directly

## Environment Configuration

### docker-compose.yml
```yaml
services:
  client:
    environment:
      - REACT_APP_API_URL=${REACT_APP_API_URL:-http://localhost/api}
  
  server:
    volumes:
      - ./server/uploads:/app/uploads  # ← Images persist here
```

### client/.env (Local Development Only)
```
REACT_APP_API_URL=http://localhost:5000/api
```

## Testing Image Loading

### Check if images are uploaded
```bash
# In container
docker exec ecommerce-server ls -la /app/uploads

# On host
ls -la ./server/uploads
```

### Test direct image access
```bash
# Should work in Docker
curl http://localhost/uploads/filename.jpg

# Check via nginx (200 OK expected)
curl -I http://localhost/uploads/filename.jpg
```

### Verify database links
```bash
# Check if products are linked to images in DB
# Via API
curl http://localhost/api/products | grep image_url

# Should see: "image_url": "/uploads/product-123.jpg"
```

## Troubleshooting

### Images show as blank/broken
1. **Check nginx logs**: `docker logs ecommerce-nginx`
2. **Verify volume mount**: `docker inspect ecommerce-server | grep Mounts`
3. **Check file existence**: `docker exec ecommerce-server ls /app/uploads`

### 404 errors on image requests
- Nginx not proxying `/uploads/` → Rebuild: `docker-compose build --no-cache nginx`
- Server not serving uploads → Check server logs: `docker logs ecommerce-server`

### Uploads disappear after container restart
- Volume not mounted → Check docker-compose.yml has: `volumes: - ./server/uploads:/app/uploads`
- Files not in host directory → Uploads failed, check server logs

### Images load locally but not in Docker
- Wrong API_URL in docker-compose
- Client still using old environment variable
- Rebuild client: `docker-compose build --no-cache client`

## Optimization Tips

### Enable browser caching
Images cached for 30 days via nginx headers:
```
Cache-Control: public, immutable
Expires: 30 days
```

### Compression
Images served with gzip compression for responsive formats.

### CDN Integration (Future)
Replace nginx `/uploads/` location with CDN endpoint:
```nginx
location /uploads/ {
    return 301 https://cdn.example.com$request_uri;
}
```

## Docker Build & Deploy

### Fresh build with image support
```bash
# Build all services
docker-compose build

# Start services
docker-compose up -d

# Verify images are accessible
curl http://localhost/uploads/ 
# Should show 403 Forbidden (directory listing disabled) or images load
```

### Rebuild just nginx (if you edited nginx.conf)
```bash
docker-compose build --no-cache nginx
docker-compose up -d nginx
```

## Notes

- Images are stored in `./server/uploads` on the host machine
- Volume is mounted at `/app/uploads` in the server container
- Nginx proxies `/uploads/*` requests to the server
- Client builds relative image paths, resolved by browser through nginx
- All changes to nginx.conf require a rebuild: `docker-compose build --no-cache nginx`
