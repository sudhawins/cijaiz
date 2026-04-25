# SSL/TLS Deployment Checklist

## Pre-Deployment

### Environment Verification
- [ ] Docker Desktop installed and running
- [ ] Docker Compose installed (`docker-compose --version` works)
- [ ] OpenSSL installed (`openssl version` works) 
- [ ] 443 port is available (not in use)
- [ ] 80 port is available (not in use)
- [ ] At least 2GB free disk space

### Project Setup
- [ ] Running from correct project directory (has docker-compose.yml)
- [ ] Backend builds successfully (`npm run build` in backend/)
- [ ] Frontend builds successfully (`npm run build` in frontend/)
- [ ] All configuration files present:
  - [ ] nginx.conf
  - [ ] docker-compose.yml
  - [ ] Dockerfile (backend and frontend)

## Certificate Generation

### Option A: Automated Setup (Recommended)

#### Windows
- [ ] Run `setup-ssl.bat`
- [ ] Follow prompts
- [ ] Verify "Setup Complete!" message
- [ ] Check `ssl/nginx.crt` exists
- [ ] Check `ssl/nginx.key` exists

#### Linux/WSL
- [ ] Run `chmod +x setup-ssl.sh && ./setup-ssl.sh`
- [ ] Follow prompts
- [ ] Verify "Setup Complete!" message
- [ ] Check `ssl/nginx.crt` exists
- [ ] Check `ssl/nginx.key` exists

### Option B: Manual Certificate Generation
- [ ] Create `ssl/` directory
- [ ] Run OpenSSL command to generate certificate
- [ ] Verify both files created: `nginx.crt` and `nginx.key`
- [ ] Set permissions: `chmod 600 ssl/nginx.key`

### Certificate Validation
- [ ] Certificate file size > 0 bytes
- [ ] Key file size > 0 bytes
- [ ] Subject contains "localhost" (for development)
- [ ] Not yet expired
- [ ] Certificate matches key (modulus check)

```bash
# Verify certificate and key match
openssl x509 -in ssl/nginx.crt -noout -modulus | md5sum
openssl rsa -in ssl/nginx.key -noout -modulus | md5sum
# Both should output the same hash
```

## Docker Deployment

### Container Startup
- [ ] Run `docker-compose up -d`
- [ ] Wait 10-15 seconds for containers to initialize
- [ ] Verify all containers running: `docker ps`

Expected containers:
- [ ] nginx (1 instance)
- [ ] frontend (1 instance)
- [ ] backend (3 instances for load balancing)

### Container Logs
```bash
# Check for errors
docker-compose logs nginx
docker-compose logs frontend
docker-compose logs backend
```

- [ ] No error messages in nginx logs
- [ ] No connection refused errors
- [ ] No certificate validation errors

### Port Verification

#### Windows (PowerShell)
```powershell
netstat -ano | findstr :80
netstat -ano | findstr :443
```

#### Linux/WSL
```bash
netstat -tlnp | grep :80
netstat -tlnp | grep :443
```

When running `docker-compose up -d`:
- [ ] Port 80 is listening on nginx container
- [ ] Port 443 is listening on nginx container
- [ ] No "Address already in use" errors

## HTTPS Connectivity Tests

### Basic HTTPS Test (Development)
```bash
curl -k https://localhost/
```
- [ ] Returns HTTP 200 or 301 (redirect)
- [ ] No SSL certificate errors (with -k flag)
- [ ] Response headers visible

### Frontend Access
```bash
curl -k https://localhost -I
```
- [ ] HTTP 200 status
- [ ] Content-Type includes text/html
- [ ] No 502/503/504 errors

### Backend API Test
```bash
curl -k https://localhost/api/roles
```
- [ ] HTTP 200 status
- [ ] JSON response received
- [ ] No 502/503/504 errors

### Browser Test
1. [ ] Open `https://localhost` in browser
2. [ ] Accept security warning (expected for self-signed cert)
3. [ ] Frontend page loads
4. [ ] Check browser console for errors: F12 → Console tab
5. [ ] No mixed content warnings

## Security Verification

### Certificate Check

```bash
openssl x509 -in ssl/nginx.crt -noout -text
```

- [ ] Subject: CN=localhost (development)
- [ ] Validity: Valid starting date and end date
- [ ] Not expired yet
- [ ] Public Key: RSA 2048-bit or stronger
- [ ] Signature Algorithm: sha256WithRSAEncryption or better

### SSL Protocol Check
```bash
openssl s_client -connect localhost:443 < /dev/null
```

- [ ] SSL connection successful
- [ ] Protocol: TLSv1.2 or TLSv1.3
- [ ] Cipher: HIGH strength
- [ ] Server Certificate verified or self-signed (expected)

### Security Headers Check
```bash
curl -k -I https://localhost | grep -i "strict-transport-security\|x-content-type\|x-frame\|x-xss"
```

- [ ] Strict-Transport-Security header present
- [ ] X-Content-Type-Options header present
- [ ] X-Frame-Options header present
- [ ] X-XSS-Protection header present

## Application Functionality

### Frontend Tests
- [ ] Page loads without 404 errors
- [ ] CSS/JavaScript loaded correctly
- [ ] No visual anomalies or missing images
- [ ] Responsive design works (test on mobile size)

### Backend API Tests
- [ ] Health check endpoint responds: `curl -k https://localhost/api/roles`
- [ ] Authentication endpoint works: `curl -k -X POST https://localhost/api/auth/login`
- [ ] No backend timeout errors
- [ ] Response times reasonable (< 2 seconds)

### Full Application Tests
- [ ] Login with test credentials works
- [ ] Dashboard displays without errors
- [ ] Navigation menu functional
- [ ] Sample API calls from frontend succeed
- [ ] No console errors in browser DevTools

## Docker Container Health

### Container Status
```bash
docker-compose ps
```

- [ ] All containers show "Up" status
- [ ] No containers in "Exited" status
- [ ] No containers in "Restarting" status

### Container Resource Usage
```bash
docker stats --no-stream
```

- [ ] nginx CPU usage < 5%
- [ ] frontend CPU usage < 10%
- [ ] backend CPU usage < 10%
- [ ] Memory usage reasonable (< 500MB each)

### Container Restarts
```bash
docker inspect nginx | grep RestartCount
```

- [ ] Restart count should be 0 (for stable deployment)
- [ ] Or increasing very slowly (< 1 per hour indicates issue)

## Network Connectivity

### DNS Resolution (if using domain)
```bash
# Windows
nslookup yourdomain.com

# Linux
dig yourdomain.com
```
- [ ] DNS resolves to correct IP

### Port Accessibility
```bash
# Test from different machine on network
curl -k https://your-server-ip
```
- [ ] Accessible from other machines on network (if firewall allows)

### Firewall Configuration (if applicable)
- [ ] Port 80 allowed if reverse proxy outside firewall
- [ ] Port 443 allowed if reverse proxy outside firewall
- [ ] Internal ports (3000, 5000) not exposed externally

## Monitoring Setup (Optional)

### Log Monitoring
```bash
# Tail nginx access logs
docker-compose exec nginx tail -f /var/log/nginx/access.log

# Tail nginx error logs
docker-compose exec nginx tail -f /var/log/nginx/error.log
```

- [ ] Logs accessible
- [ ] No repeated error messages
- [ ] Access pattern as expected

### SSL Certificate Monitoring
Add to calendar or task scheduler:
- [ ] Check certificate expiration date (365 days from generation)
- [ ] Certificate renewal before expiration
- [ ] Monitor for certificate errors

## Performance Testing

### Response Time Benchmark
```bash
# Simple load test (10 requests)
for i in {1..10}; do curl -k -w "@curl-format.txt" -o /dev/null -s https://localhost/; done
```

- [ ] Average response time acceptable (< 500ms)
- [ ] No significant variation between requests
- [ ] No timeout errors

### Concurrent Connection Test
```bash
# Test 5 concurrent connections
seq 1 5 | xargs -P 5 -I {} curl -k https://localhost/ -o /dev/null
```

- [ ] All requests complete successfully
- [ ] No connection refused errors
- [ ] No dropped connections

## File Permissions and Security

### SSL Certificate Files
```bash
ls -la ssl/
```

- [ ] ssl/nginx.crt owned by current user
- [ ] ssl/nginx.key owned by current user
- [ ] nginx.key permissions: -rw------- (600 or 400)
- [ ] nginx.crt permissions: -rw-r--r-- (644 or 444)

### Source Files
- [ ] nginx.conf readable
- [ ] docker-compose.yml readable
- [ ] Dockerfile files readable

### Git Configuration
- [ ] `ssl/.gitignore` prevents .key file commits
- [ ] Verified with: `git check-ignore ssl/nginx.key`
- [ ] No private keys in git history

## Backup and Recovery

### Pre-Deployment Backup
- [ ] Backup certificate: `cp ssl/nginx.crt ssl/nginx.crt.backup`
- [ ] Backup configuration: `cp nginx.conf nginx.conf.backup`
- [ ] Backup docker-compose: `cp docker-compose.yml docker-compose.yml.backup`

### Recovery Plan Documented
- [ ] Documented steps to regenerate certificates
- [ ] Documented steps to rollback to HTTP if needed
- [ ] Documented certificate renewal process

## Production Deployment (If Applicable)

### Domain Configuration
- [ ] Domain name registered
- [ ] DNS A record pointing to server IP
- [ ] DNS propagation verified

### Certificate Acquisition
- [ ] Let's Encrypt certificate obtained
- [ ] Certificate and key files in place
- [ ] Certificate not expired

### Configuration Updates
- [ ] nginx.conf updated with domain name
- [ ] Frontend API URL updated: `https://yourdomain.com/api`
- [ ] Backend configured for production
- [ ] Database credentials updated

### Pre-Production Testing
- [ ] Test with real domain: `https://yourdomain.com`
- [ ] SSL Labs test: https://www.ssllabs.com/ssltest/
- [ ] Expected rating: A or A+
- [ ] Mobile compatibility tested
- [ ] API endpoints tested with HTTPS

## Post-Deployment Verification

### First 24 Hours
- [ ] Monitor error logs every hour
- [ ] Check certificate validity
- [ ] Monitor resource usage
- [ ] Verify no certificate warnings in production

### Weekly
- [ ] Review container logs for errors
- [ ] Verify backup procedures working
- [ ] Check if certificate renewal needed (Let's Encrypt)

### Monthly
- [ ] Full system test
- [ ] Performance review
- [ ] Security audit
- [ ] Backup verification

## Rollback Plan

If SSL deployment fails:

1. [ ] Stop containers: `docker-compose down`
2. [ ] Remove SSL certificate: `rm ssl/nginx.*`
3. [ ] Revert nginx.conf to HTTP mode
4. [ ] Revert docker-compose.yml port mappings
5. [ ] Restart with HTTP: `docker-compose up -d`
6. [ ] Verify services running: `docker ps`

## Sign-Off

- [ ] All checklist items completed
- [ ] Application functional with HTTPS
- [ ] Security verified
- [ ] Performance acceptable
- [ ] Documentation updated
- [ ] Team notified of SSL deployment
- [ ] Ready for production use

---

**Deployment Date:** _____________
**Deployed By:** _________________
**Authorized By:** _______________
**Notes:** _______________________

For issues or questions, see `SSL_SETUP_GUIDE.md`
