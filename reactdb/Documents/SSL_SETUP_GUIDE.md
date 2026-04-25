# SSL/TLS Setup Guide for nginx

## Overview

This guide explains how to enable SSL/TLS for the nginx reverse proxy in the Property Management Application. The application now supports both HTTP (redirected to HTTPS) and HTTPS.

## Architecture

```
Browser (HTTPS)
    ↓
nginx (port 443 - SSL/TLS termination)
    ↓
Frontend (port 3000 - internal HTTP)
Backend API (port 5000 - internal HTTP)
```

## Quick Start (Development)

### Option 1: Windows PowerShell

```powershell
# Navigate to project root
cd C:\Users\jc_vi\source\PhotoApp\reactdb

# Run certificate generation
powershell -ExecutionPolicy Bypass -File .\ssl\generate-certs.ps1

# Start containers
docker-compose up -d

# Access application
# https://localhost
```

### Option 2: Linux/WSL/Git Bash

```bash
# Navigate to project root
cd /path/to/reactdb

# Make script executable
chmod +x ssl/generate-certs.sh

# Generate certificates
./ssl/generate-certs.sh

# Start containers
docker-compose up -d

# Access application
# https://localhost
```

### Option 3: Manual Certificate Generation (OpenSSL)

```bash
# Create ssl directory if it doesn't exist
mkdir -p ssl

# Generate self-signed certificate (valid for 365 days)
openssl req -x509 \
  -newkey rsa:2048 \
  -keyout ssl/nginx.key \
  -out ssl/nginx.crt \
  -days 365 \
  -nodes \
  -subj "/CN=localhost"

# Set permissions
chmod 600 ssl/nginx.key
chmod 644 ssl/nginx.crt
```

## File Structure

After certificate generation, your directory structure will look like:

```
reactdb/
├── ssl/
│   ├── nginx.crt              # SSL certificate
│   ├── nginx.key              # Private key
│   ├── generate-certs.ps1     # Windows script
│   └── generate-certs.sh      # Linux/bash script
├── nginx.conf                 # Updated with SSL config
├── docker-compose.yml         # Updated with port mappings
└── ...
```

## Configuration Details

### nginx.conf Changes

The updated `nginx.conf` now includes:

1. **HTTP → HTTPS Redirect** (Port 80)
   ```nginx
   server {
       listen 80;
       return 301 https://$host$request_uri;  # Redirect to HTTPS
   }
   ```

2. **HTTPS Server** (Port 443)
   ```nginx
   server {
       listen 443 ssl http2;
       ssl_certificate /etc/nginx/ssl/nginx.crt;
       ssl_certificate_key /etc/nginx/ssl/nginx.key;
       ssl_protocols TLSv1.2 TLSv1.3;
   }
   ```

3. **Security Headers**
   - Strict-Transport-Security (HSTS)
   - X-Content-Type-Options
   - X-Frame-Options
   - X-XSS-Protection
   - Referrer-Policy

4. **Proxy Headers**
   - X-Forwarded-For
   - X-Forwarded-Proto (tells backend it's HTTPS)
   - X-Real-IP

### docker-compose.yml Changes

Port mappings updated to support HTTPS:

```yaml
nginx:
  ports:
    - "80:80"      # HTTP → container:80
    - "443:443"    # HTTPS → container:443
  volumes:
    - ./ssl:/etc/nginx/ssl:ro  # Mount certificates (read-only)
```

## Backend Configuration Updates

The backend needs to know it's behind HTTPS proxy. Update `frontend/src/api.ts`:

**Current (needs update for production):**
```typescript
// Uses HTTP address - fine for development
const API_URL = process.env.VITE_API_URL || 'http://localhost/api';
```

**For HTTPS deployment:**
```typescript
// Use https:// for production
const API_URL = process.env.VITE_API_URL || 'https://yourdomain.com/api';
```

Update `docker-compose.yml` frontend section:
```yaml
frontend:
  args:
    - VITE_API_URL=https://yourdomain.com/api  # HTTPS URL
  environment:
    - VITE_API_URL=https://yourdomain.com/api
```

## Certificate Types

### Development (Self-Signed)

**Pros:**
- Free
- No external dependencies
- Fast setup

**Cons:**
- Browser shows security warning
- Not trusted by browsers
- Not suitable for production

**Usage:**
```bash
# Self-signed valid for 365 days
openssl req -x509 -newkey rsa:2048 -keyout ssl/nginx.key \
  -out ssl/nginx.crt -days 365 -nodes -subj "/CN=localhost"
```

### Production (Let's Encrypt)

**Pros:**
- Free (no cost)
- Trusted by all major browsers
- Automatic renewal available
- Recommended for public sites

**Cons:**
- Requires domain name
- Requires DNS configuration
- Renewal must be automated

**Setup with Certbot:**

```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Generate certificate
sudo certbot certonly --standalone -d yourdomain.com

# Certificates will be in:
# /etc/letsencrypt/live/yourdomain.com/fullchain.pem
# /etc/letsencrypt/live/yourdomain.com/privkey.pem

# Copy to project (or update nginx.conf paths):
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ./ssl/nginx.crt
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ./ssl/nginx.key
sudo chmod 644 ./ssl/nginx.crt
sudo chmod 600 ./ssl/nginx.key

# Set up auto-renewal
sudo certbot renew --dry-run  # Test renewal
sudo systemctl enable certbot.timer  # Auto-renew
```

## SSL/TLS Verification

### Test with curl

```bash
# Allow self-signed cert (development)
curl -k https://localhost/

# Proper verification (production with valid cert)
curl https://yourdomain.com/
```

### Check Certificate Details

```bash
# View certificate
openssl x509 -in ssl/nginx.crt -text -noout

# Check expiration
openssl x509 -in ssl/nginx.crt -noout -dates

# Verify certificate matches key
openssl x509 -in ssl/nginx.crt -noout -modulus | md5sum
openssl rsa -in ssl/nginx.key -noout -modulus | md5sum
# Both should output the same hash
```

### Browser Check

1. Go to `https://localhost` (development)
2. Click on the lock icon (URL bar)
3. View certificate details
4. Check that CN (Common Name) matches your domain

## Performance Tuning

### SSL Session Caching

Current config includes session caching for performance:

```nginx
ssl_session_cache shared:SSL:10m;  # 10MB shared cache
ssl_session_timeout 10m;           # 10 minute timeout
```

This reduces handshake overhead for repeated connections.

### HTTP/2

Enabled for better performance:

```nginx
listen 443 ssl http2;  # HTTP/2 support
```

HTTP/2 multiplexes multiple streams over single connection.

### Cipher Selection

```nginx
ssl_protocols TLSv1.2 TLSv1.3;                    # Strong protocols
ssl_ciphers HIGH:!aNULL:!MD5;                     # Strong ciphers
ssl_prefer_server_ciphers on;                     # Server chooses
```

## Troubleshooting

### Issue: "Connection refused" on port 443

**Solution:** Check Docker is running and nginx container is up:
```bash
docker ps | grep nginx
docker logs <container-id>
```

### Issue: Certificate permission denied

**Solution:** Ensure correct permissions:
```bash
chmod 600 ssl/nginx.key    # Private key: read/write for owner only
chmod 644 ssl/nginx.crt    # Certificate: readable by all
```

### Issue: Browser shows "NET::ERR_CERT_AUTHORITY_INVALID"

**Expected for self-signed certificates in development.** Click "Proceed" or "Advanced" to continue.

### Issue: "bad certificate" error

**Solution:** Verify certificate matches key:
```bash
openssl x509 -in ssl/nginx.crt -noout -modulus | md5sum
openssl rsa -in ssl/nginx.key -noout -modulus | md5sum
```

Both should output the same hash.

### Issue: Certificate has expired

**Solution:** Generate new certificate:
```bash
# Remove old certificate
rm ssl/nginx.crt ssl/nginx.key

# Generate new one
./ssl/generate-certs.sh  # or generate-certs.ps1
```

## Monitoring

### Check SSL Handshakes

```bash
# Watch nginx error log
docker logs -f <container-id> --tail 100

# Check certificate validity in container
docker exec <container-id> openssl x509 -in /etc/nginx/ssl/nginx.crt -noout -dates
```

### SSL Labs Rating

For production domains, test at https://www.ssllabs.com/ssltest/

Current configuration should achieve **A or A+ rating**.

## Ports

| Port | Protocol | Purpose | Access |
|------|----------|---------|--------|
| 80 | HTTP | Redirect to HTTPS | Public |
| 443 | HTTPS | Encrypted traffic | Public |
| 3000 | HTTP | Frontend (internal) | Docker network only |
| 5000 | HTTP | Backend API (internal) | Docker network only |

## Network Flow

```
User (https://localhost)
    ↓
Docker Host:443
    ↓ (mounted volume with certificates)
nginx Container:443 (SSL termination)
    ↓ (HTTP proxy)
Frontend Container:3000
Backend Container:5000
```

## Deployment Checklist

- [ ] Generate SSL certificate (self-signed for dev, Let's Encrypt for prod)
- [ ] Verify certificate files exist in `./ssl/` directory
- [ ] Update `docker-compose.yml` with correct API URL
- [ ] Test locally: `https://localhost`
- [ ] Verify certificate details
- [ ] Check nginx error logs: `docker logs nginx`
- [ ] Test with curl: `curl -k https://localhost/api`
- [ ] Verify frontend loads without mixed content warnings

## Security Considerations

### Self-Signed Certificates (Development Only)
- ✓ Acceptable for local development
- ✗ Do NOT use in production
- ✗ Will be rejected by browsers and API clients

### Let's Encrypt (Production)
- ✓ Free and trusted
- ✓ Automatic renewal recommended
- ✓ Industry standard

### Certificate Pinning
For high-security applications, consider certificate pinning to prevent MITM attacks. See OWASP guidelines.

## Further Reading

- [Mozilla SSL Configuration](https://ssl-config.mozilla.org/)
- [OWASP TLS Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Protection_Cheat_Sheet.html)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [nginx SSL Documentation](http://nginx.org/en/docs/http/ngx_http_ssl_module.html)

## Support

For issues related to SSL/TLS setup:
1. Check nginx logs: `docker logs <container-id>`
2. Verify certificate files exist and have correct permissions
3. Review this guide's troubleshooting section
4. Check certificate validity: `openssl x509 -in ssl/nginx.crt -noout -dates`
