# Troubleshooting Quick Reference

## 📖 Documentation Guide

This project includes comprehensive documentation for different issues:

| Issue | Guide | Quick Fix |
|-------|-------|-----------|
| **Docker build fails** | [DOCKER_TROUBLESHOOTING.md](DOCKER_TROUBLESHOOTING.md) | `docker system prune -a && docker-compose build --no-cache` |
| **NPM install error** | [NPM_TROUBLESHOOTING.md](NPM_TROUBLESHOOTING.md) | `.npmrc` files already configured, ensure build tools installed |
| **No products/orders show** | [DEBUGGING.md](DEBUGGING.md) | Run `curl http://localhost:5000/api/debug` |
| **API URL issues** | [ENV_SETUP.md](ENV_SETUP.md) | Check `client/.env` has correct REACT_APP_API_URL |
| **Dockerfile choice** | [DOCKERFILE_GUIDE.md](DOCKERFILE_GUIDE.md) | Use `Dockerfile` (default) or `Dockerfile.alpine` (lightweight) |
| **Database won't connect** | [DEBUGGING.md](DEBUGGING.md) | Verify DB_* variables in `.env` and run `db-setup.bat init` |

## 🔧 Common Commands

### Start Application
```bash
# Using Docker (recommended)
docker-compose up

# Using Alpine Dockerfile (if network issues)
docker-compose -f docker-compose.yml build -f Dockerfile.alpine
docker-compose up

# Local development
cd server && npm start          # Terminal 1
cd client && npm start          # Terminal 2
```

### Debug Issues
```bash
# Check Docker setup
docker-troubleshoot.bat check

# Check database
curl http://localhost:5000/api/debug

# Check product/order data
curl http://localhost:5000/api/products
curl http://localhost:5000/api/orders

# View logs
docker-compose logs -f
docker-compose logs -f server
docker-compose logs -f client
```

### Clean & Rebuild
```bash
# Remove everything and start fresh
docker-compose down
docker system prune -a --volumes -f
docker-compose build --no-cache
docker-compose up
```

### Database Setup
```bash
# Windows
.\db-setup.bat init

# Linux/Mac
./db-setup.sh init
```

## 🐛 Decision Tree

### Docker build fails
```
↓
Is Docker daemon running?
├─ NO → Start Docker Desktop
└─ YES
   ├─ Can't pull node:18.19.0-slim?
   │  └─ Use: docker build -f Dockerfile.alpine
   └─ npm install fails?
      └─ Check [NPM_TROUBLESHOOTING.md](NPM_TROUBLESHOOTING.md)
```

### No products showing
```
↓
Server running?
├─ NO → Start: cd server && npm start
└─ YES
   ├─ Run: curl http://localhost:5000/api/debug
   ├─ Database connected?
   │  ├─ NO → Check [DEBUGGING.md](DEBUGGING.md)
   │  └─ YES → Run: .\db-setup.bat init
   └─ API returns data?
      └─ Check client REACT_APP_API_URL in [ENV_SETUP.md](ENV_SETUP.md)
```

### Client can't connect to API
```
↓
Check client/.env
├─ REACT_APP_API_URL=http://localhost:5000/api (local dev)
└─ REACT_APP_API_URL=http://server:5000/api (Docker)
   └─ See [ENV_SETUP.md](ENV_SETUP.md)
```

## 📋 Full Documentation

### Setup Guides
- [README.md](README.md) - Main project documentation
- [DOCKER.md](DOCKER.md) - Complete Docker setup instructions
- [ENV_SETUP.md](ENV_SETUP.md) - Environment variables configuration

### Troubleshooting Guides
- [DEBUGGING.md](DEBUGGING.md) - Database, products, and orders issues
- [DOCKER_TROUBLESHOOTING.md](DOCKER_TROUBLESHOOTING.md) - Docker build and runtime errors
- [NPM_TROUBLESHOOTING.md](NPM_TROUBLESHOOTING.md) - NPM installation problems
- [DOCKERFILE_GUIDE.md](DOCKERFILE_GUIDE.md) - Understanding and switching Dockerfiles

### Quick Reference
- [QUICKSTART.md](QUICKSTART.md) - Fast setup instructions
- [API_DOCUMENTATION.md](API_DOCUMENTATION.md) - API endpoints
- [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) - Architecture overview

## 🚀 Quick Start

### Docker (Recommended)
```bash
# 1. Configure environment
cp .env.example .env
# Edit .env with your database credentials

# 2. Start services
docker-compose up

# 3. Access application
# Frontend: http://localhost:3000
# API: http://localhost:5000/api
```

### Local Development
```bash
# Terminal 1: Server
cd server
npm install
npm start

# Terminal 2: Client
cd client
npm install
npm start
```

### Database Setup
```bash
# Initialize database with schema and sample data
.\db-setup.bat init      # Windows
./db-setup.sh init       # Linux/Mac
```

## 🔍 Verify Setup

Use the verification scripts:
```bash
# Windows
.\verify-setup.bat

# Linux/Mac
./verify-setup.sh
```

Use the troubleshooting helper:
```bash
# Windows
docker-troubleshoot.bat check

# Linux/Mac
./docker-troubleshoot.sh check
```

## 📞 Need Help?

1. **Check relevant documentation** - Use the table above
2. **Run debug command** - `curl http://localhost:5000/api/debug`
3. **Check logs** - `docker-compose logs`
4. **Clear cache** - `docker system prune -a --volumes`
5. **Rebuild** - `docker-compose build --no-cache`

## ✅ What Should Work

After successful setup:
- ✅ Frontend loads at http://localhost:3000
- ✅ Products display in product listing
- ✅ Can add products to cart
- ✅ Can place orders
- ✅ API returns data at http://localhost:5000/api/products
- ✅ Database debug at http://localhost:5000/api/debug shows connected

## 🛠️ Configuration Files

- `.env` - Database and deployment configuration
- `client/.env` - React API URL
- `client/.npmrc` - NPM optimization settings
- `server/.npmrc` - NPM optimization settings
- `docker-compose.yml` - Multi-container orchestration
- `Dockerfile` - Client/Server container images
- `Dockerfile.alpine` - Alternative lightweight images

## 📦 Key Files

```
ecomsql/
├── .env                           # Configuration (create from .env.example)
├── docker-compose.yml             # Docker orchestration
├── client/
│   ├── Dockerfile                 # Default (slim)
│   ├── Dockerfile.alpine          # Alternative (lightweight)
│   ├── .env                       # React config
│   └── .npmrc                     # NPM config
├── server/
│   ├── Dockerfile                 # Default (slim)
│   ├── Dockerfile.alpine          # Alternative (lightweight)
│   ├── .env                       # Node config
│   └── .npmrc                     # NPM config
├── Scripts/
│   ├── ecommerce.sql              # Database schema
│   └── ecommerce_seed.sql         # Sample data
├── db-setup.bat / db-setup.sh     # Database initialization
├── docker-troubleshoot.bat/.sh    # Docker helper
└── verify-setup.bat/.sh           # Setup verification
```

## 🎯 Success Indicators

✅ Docker build completes without errors
✅ Containers start and stay running
✅ Frontend accessible at http://localhost:3000
✅ API responds at http://localhost:5000/api
✅ Products load from database
✅ Can interact with application

If you see these, setup is successful!
