# Token Authentication Troubleshooting Guide

## Error: "Failed to load orders: Invalid or expired token"

### What This Means
Your API request includes an authentication token, but the server cannot verify it. This can happen for several reasons:

1. **Token is expired** - Tokens are valid for 24 hours
2. **JWT_SECRET mismatch** - Server restart needed to load new .env
3. **Token format is invalid** - Malformed or corrupted token
4. **Server and client using different secrets** - Configuration mismatch

---

## Quick Diagnostics

### Step 1: Check if Token Exists
Open your browser's Developer Tools (F12) and run:
```javascript
localStorage.getItem('authToken')
```

**If it returns null:** You're not logged in. Go to login page and login again.

**If it returns a string:** Your token exists. Proceed to Step 2.

### Step 2: Check Token Validity with Server
With the token from Step 1, run:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN_HERE" http://localhost:5002/api/token-debug
```

Replace `YOUR_TOKEN_HERE` with the actual token from localStorage.

**Example:**
```bash
curl -H "Authorization: Bearer eyJhbGc..." http://localhost:5002/api/token-debug
```

This will tell you:
- ✅ Token is valid 
- ❌ Token is expired
- ❌ Token signature is invalid

### Step 3: Check Server Configuration
```bash
# Check if JWT_SECRET is set
cat server/.env | grep JWT_SECRET

# Restart the server
npm run dev  # in server directory
```

**Important:** After updating `.env`, you MUST restart the server for changes to take effect.

---

## Solutions

### Solution 1: Server Needs Restart
**Problem:** `JWT_SECRET` was added to `.env` but server hasn't restarted yet.

**Fix:**
1. Stop the server (Ctrl+C)
2. Verify `.env` has `JWT_SECRET`:
   ```bash
   cat server/.env
   ```
   Should show:
   ```
   JWT_SECRET=ecommerce-jwt-secret-key-photoshop-2024
   ```
3. Restart server:
   ```bash
   npm run dev
   ```
4. Check startup logs show:
   ```
   [SERVER] JWT Configuration: {
     jwtSecretSet: true,
     jwtSecretSource: 'from .env'
   }
   ```

### Solution 2: Token is Expired
**Problem:** Token was generated 24+ hours ago.

**Fix:** 
1. Logout (clear localStorage and cookies)
2. Login again to get a fresh token
3. Continue with your request

### Solution 3: Browser Cache Issue
**Problem:** Old token still cached in browser.

**Fix:**
1. Clear browser cache/cookies:
   - Chrome: Ctrl+Shift+Delete
   - Firefox: Ctrl+Shift+Delete
   - Safari: Develop → Clear Caches

2. Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

3. Logout and login again

### Solution 4: LocalStorage Corrupted
**Problem:** Token in localStorage is corrupted or malformed.

**Fix:**
```javascript
// In browser console:
localStorage.clear()
// Then reload page and login again
```

---

## Advanced Debugging

### Enable Verbose Logging
The server now logs all token verification attempts. Check server console for:

```
[verifyToken] Token received. Verifying...
[verifyToken] Token verified. User: { userId: 1, userName: 'user@example.com', roleType: 'Customer' }
```

OR

```
[verifyToken] Token verification failed: jwt expired
[verifyToken] Error name: TokenExpiredError
```

### Check Token Payload
To see what's inside your token (without validating):
```javascript
// In browser console:
const token = localStorage.getItem('authToken');
const payload = JSON.parse(atob(token.split('.')[1]));
console.log(payload);
// Output shows: userId, userName, roleType, exp (expiration time)
```

Check the `exp` value:
```javascript
// Check if expired
const exp = payload.exp * 1000; // Convert to milliseconds
const isExpired = new Date(exp) < new Date();
console.log('Token expires at:', new Date(exp));
console.log('Is expired:', isExpired);
```

---

## JWT Flow Diagram

```
LOGIN FLOW:
┌─────────┐
│ Login   │
└────┬────┘
     │ POST /auth/login
     v
┌─────────────────────────────────┐
│ Server:                         │
│ 1. Verify username/password    │
│ 2. Generate JWT with secret    │
│ 3. Return token                │
└────┬────────────────────────────┘
     │
     v
┌────────────────────────────────────┐
│ Client:                            │
│ localStorage.setItem('authToken')   │
└────┬───────────────────────────────┘
     │

ORDER FETCH FLOW:
┌──────────────────────┐
│ GET /orders          │
└────┬─────────────────┘
     │ Add token to header:
     │ Authorization: Bearer TOKEN
     v
┌────────────────────────────────────┐
│ Server:                            │
│ 1. Extract token from header      │
│ 2. Verify with JWT_SECRET         │
│ 3. Extract userId                 │
│ 4. Get user's orders from DB      │
│ 5. Return orders                  │
└────┬───────────────────────────────┘
     │
     v
┌────────────────────-┐
│ Client: Show orders │
└─────────────────────┘
```

---

## Configuration Checklist

- [ ] `server/.env` exists and contains `JWT_SECRET`
- [ ] Server was restarted after adding/updating `.env`
- [ ] Server logs show `jwtSecretSet: true` on startup
- [ ] User is logged in (token in localStorage)
- [ ] Token is not expired (< 24 hours old)
- [ ] Browser cache cleared
- [ ] API interceptor is adding Authorization header

---

## Testing Endpoints

### Test 1: Health Check (No Auth Required)
```bash
curl http://localhost:5002/api/health
```
**Expected:** `{"status":"Server is running"}`

### Test 2: Token Validation
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:5002/api/token-debug
```
**Expected:** Token details OR error with hint

### Test 3: Get Orders (Auth Required)
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:5002/api/orders
```
**Expected:** Array of orders OR 401 with token error

---

## Common Error Messages & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| "No token provided" | Header missing Authorization | Ensure login completed, check localStorage |
| "Invalid or expired token" | JWT signature mismatch | Restart server to load JWT_SECRET from .env |
| "token expired" | Token > 24 hours old | Login again to get fresh token |
| "invalid token" | Token corrupted/malformed | Clear localStorage and login again |
| "malformed jwt" | Token format incorrect | Logout and login, don't manually edit token |

---

## Environment Variable Setup

### server/.env (Required)
```
JWT_SECRET=ecommerce-jwt-secret-key-photoshop-2024
DB_SERVER=gnanabi.database.windows.net
DB_NAME=mansion
DB_USER=servergnanaabi
DB_PASSWORD=serverpassword@123
PORT=5002
```

### Verify Setup
```bash
# In server directory
echo $JWT_SECRET  # Should show the secret
npm run dev      # Watch for "[SERVER] jwtSecretSet: true" log
```

---

## Getting Help

1. Check server console logs for `[verifyToken]` entries
2. Check client console (F12) for API error details
3. Run token debug endpoint
4. Check browser localStorage for authToken
5. Try /api/token-debug endpoint to validate token

If issues persist:
- Restart both server and client
- Clear browser cache completely
- Delete and regenerate .env
- Restart browser entirely
