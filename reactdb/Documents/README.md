# Mansion App - React + Express with Azure SQL

A full-stack application with React frontend, Express backend, and Azure SQL Database integration, all containerized with Docker.

## Project Structure

```
reactdb/
├── backend/                 # Express.js API
│   ├── src/
│   │   ├── index.ts        # Main server file
│   │   └── database.ts     # Database connection setup
│   ├── package.json
│   ├── tsconfig.json
│   ├── Dockerfile
│   └── .env.example
├── frontend/               # React + Vite
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── App.css
│   │   └── api.ts
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   └── Dockerfile
├── docker-compose.yml      # Orchestration
└── README.md
```

## Prerequisites

- Docker and Docker Compose installed
- Node.js 20+ (for local development)
- Azure SQL Server access with the provided credentials

## Quick Start with Docker Compose

### 1. Build and run all services

```bash
docker-compose up --build
```

### 2. Access the application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000/api

### 3. Stop services

```bash
docker-compose down
```

## Backend Setup

### Local Development

```bash
cd backend
npm install
npm run dev
```

The backend will start on `http://localhost:5000`

### Environment Variables

Create a `.env` file in the `backend` directory:

```
DB_SERVER=gnanabi.database.windows.net
DB_PORT=1433
DB_DATABASE=mansion
DB_USER=servergnanaabi
DB_PASSWORD=serverpassword@123
EXPRESS_PORT=5000
NODE_ENV=development
```

### API Endpoints

- `GET /api/health` - Check backend status
- `GET /api/database/status` - Check database connection
- `GET /api/tables` - Get all database tables

## Frontend Setup

### Local Development

```bash
cd frontend
npm install
npm run dev
```

The frontend will start on `http://localhost:3000` with hot reload enabled.

## Building Docker Images Separately

### Build Backend Image

```bash
docker build -t mansion-backend ./backend
docker run -p 5000:5000 \
  -e DB_SERVER=gnanabi.database.windows.net \
  -e DB_PORT=1433 \
  -e DB_DATABASE=mansion \
  -e DB_USER=servergnanaabi \
  -e DB_PASSWORD=serverpassword@123 \
  mansion-backend
```

### Build Frontend Image

```bash
docker build -t mansion-frontend ./frontend
docker run -p 3000:3000 mansion-frontend
```

## Troubleshooting

### Database Connection Issues

1. Verify credentials in environment variables
2. Check if your IP is whitelisted in Azure SQL firewall rules
3. Ensure the database server is accessible from your network
4. Test connection: `telnet gnanabi.database.windows.net 1433`

### Frontend Can't Reach Backend

- Check if `REACT_APP_API_URL` environment variable is correctly set
- Ensure backend container is running: `docker-compose ps`
- Check container logs: `docker-compose logs backend`

### Container Build Failures

- Clear Docker cache: `docker system prune`
- Rebuild from scratch: `docker-compose up --build --force-recreate`

## Development Tips

### View Container Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Access Container Terminal

```bash
docker-compose exec backend sh
docker-compose exec frontend sh
```

## Production Considerations

1. **Environment Security**: Use Docker secrets or environment file for sensitive data
2. **Database**: Ensure SSL/TLS encryption is enabled (already configured)
3. **CORS**: Configure CORS in backend for specific frontend domains
4. **Rate Limiting**: Add rate limiting middleware to API
5. **Logging**: Implement comprehensive logging for debugging
6. **Error Handling**: Implement proper error handling and monitoring

## Additional Resources

- [Express.js Documentation](https://expressjs.com/)
- [React Documentation](https://react.dev)
- [Vite Documentation](https://vitejs.dev)
- [Docker Documentation](https://docs.docker.com)
- [MSSQL Node.js Driver](https://github.com/tediousjs/node-mssql)
