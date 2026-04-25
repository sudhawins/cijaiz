# Environment Configuration Guide

## Overview

This project uses environment variables for configuration. Both the server and client need proper setup.

## Server Configuration

### File: `server/.env`
Create or edit `server/.env` with your database credentials:

```env
# SQL Server/Azure Connection
DB_SERVER=your-server.database.windows.net
DB_NAME=your-database-name
DB_USER=your-username
DB_PASSWORD=your-password
DB_PORT=1433

# Server Settings
PORT=5000
NODE_ENV=production
CLIENT_URL=http://localhost:3000
```

### Environment Variables:
- `DB_SERVER`: Your SQL Server or Azure SQL Database hostname
- `DB_NAME`: Database name (e.g., `ecommerce`)
- `DB_USER`: Database user (e.g., `sa` for local, or Azure username)
- `DB_PASSWORD`: Database password
- `DB_PORT`: SQL Server port (default `1433`)
- `PORT`: Port the server runs on (default `5000`)
- `NODE_ENV`: Set to `production` for production builds
- `CLIENT_URL`: Frontend URL (for CORS configuration)

## Client Configuration

### File: `client/.env`
Create or edit `client/.env` with your API endpoint:

```env
REACT_APP_API_URL=http://localhost:5000/api
```

### For Different Environments:

**Development (local):**
```env
REACT_APP_API_URL=http://localhost:5000/api
```

**Docker (using service names):**
```env
REACT_APP_API_URL=http://server:5000/api
```

**Production:**
```env
REACT_APP_API_URL=https://your-api-domain.com/api
```

### Important Notes:
- Must start with `REACT_APP_` prefix to be picked up by Create React App
- The API backend must be running when the client makes requests
- The URL should include `/api` suffix for the API route prefix
- No trailing slash needed

## Setup Steps

1. **Copy environment templates:**
   ```bash
   cp .env.example .env                 # Root .env
   cp client/.env.example client/.env    # Client .env
   cp server/.env.example server/.env    # Server .env (if exists)
   ```

2. **Update with your credentials:**
   ```bash
   # Edit these files with your actual values:
   # - .env (database credentials)
   # - client/.env (API URL - usually http://localhost:5000/api)
   # - server/.env (same database credentials)
   ```

3. **Start the server:**
   ```bash
   cd server
   npm start
   ```

4. **In another terminal, start the client:**
   ```bash
   cd client
   npm start
   ```

## Docker Configuration

When using Docker Compose, the `.env` file in the root directory is used:

```env
DB_SERVER=your-server.database.windows.net
DB_NAME=your-database
DB_USER=your-username
DB_PASSWORD=your-password
REACT_APP_API_URL=http://localhost:5000/api
```

## Troubleshooting

**Client can't connect to API:**
- Check `REACT_APP_API_URL` in `client/.env`
- Ensure server is running on the port specified in the URL
- Check browser console for CORS errors
- Make sure URL matches the actual server URL

**API requests return to wrong server:**
- Verify `REACT_APP_API_URL` is pointing to correct host:port
- Empty `API_BASE_URL` means it's using the default `/api` path
- Check browser Network tab to see actual request URL

**Database connection fails:**
- Verify all `DB_*` variables in `.env` are correct
- Check SQL Server is running and accessible
- Test connection with debug endpoint: `curl http://localhost:5000/api/debug`

## Security Notes

- **Never commit `.env` files to version control** - they contain sensitive credentials
- Use `.env.example` as a template with placeholder values
- Keep database passwords secure and use strong credentials
- In production, use environment variables set by your deployment platform (AWS, Azure, Heroku, etc.)
- Don't expose API URLs that reveal your infrastructure

## Loading Order

React loads environment variables in this order:
1. Variables in `client/.env` file
2. System environment variables
3. Defaults in code (e.g., `process.env.REACT_APP_API_URL || '/api'`)

Node.js (server) loads from `dotenv`:
1. Variables in `server/.env` file
2. System environment variables
3. Defaults in code

## Production Deployment

When deploying:
1. Set environment variables through your hosting platform
2. Do NOT include `.env` files in your deployment
3. Use secure credential management (e.g., AWS Secrets Manager, Azure Key Vault)
4. Update `REACT_APP_API_URL` to point to your production API domain
5. Set proper CORS origins in `CLIENT_URL`
