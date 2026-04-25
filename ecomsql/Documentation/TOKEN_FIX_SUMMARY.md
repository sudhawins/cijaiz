# "Failed to load orders: Invalid or expired token" - SOLUTION

## The Issue
When trying to load orders, you're getting: `Failed to load orders: Invalid or expired token`

This means the server cannot verify your authentication token - likely due to JWT_SECRET not being loaded.

---

## ROOT CAUSE
The `JWT_SECRET` environment variable was added to `server/.env` but the server process didn't restart to load it. This causes:
- New logins: tokens generated with JWT_SECRET
- Order requests: server tries to verify with fallback 'your-secret-key'
- Result: signature mismatch → "Invalid or expired token"

---

## SOLUTION (3 STEPS)

### Step 1: Verify JWT_SECRET is in server/.env
```bash
cd server
cat .env | grep JWT_SECRET
```

You should see:
```
JWT_SECRET=ecommerce-jwt-secret-key-photoshop-2024
```

If missing, add it:
```bash
echo "JWT_SECRET=ecommerce-jwt-secret-key-photoshop-2024" >> .env
```

### Step 2: Restart the Server
```bash
# Stop current server (Ctrl+C), then:
npm run dev
```

**Watch for startup confirmation:**
```
[SERVER] JWT Configuration: {
  jwtSecretSet: true,
  jwtSecretSource: 'from .env'
}
[SERVER] Server running on port 5002
```

If you see `jwtSecretSource: 'using fallback'` → .env not loaded, check again

### Step 3: Login Again & Test Orders
1. Go to http://localhost:3002
2. Logout (if already logged in)
3. Login with your credentials
4. Navigate to Orders section
5. Orders should now load successfully ✓

---

## VERIFICATION

### Quick Diagnostic Test
**Windows:**
```bash
check-auth.bat
```

**Mac/Linux:**
```bash
bash check-auth.sh
```

### Advanced: Test Token Directly
1. Login to app
2. Open browser Console (F12)
3. Copy token:
   ```javascript
   console.log(localStorage.getItem('authToken'))
   ```
4. Test with server:
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN_HERE" http://localhost:5002/api/token-debug
   ```

Should return:
```json
{
  "success": true,
  "message": "Token is valid",
  "decoded": {
    "userId": 1,
    "userName": "user@example.com",
    "roleType": "Customer",
    "expiresAt": "2026-03-16T12:34:56.000Z"
  }
}
```

---

## IF ISSUE PERSISTS

### Option 1: Clear Browser Data & Retry
```
1. Ctrl+Shift+Delete (or Cmd+Shift+Backspace on Mac)
2. Clear cookies and cache
3. Go to localhost:3002
4. Hard refresh: Ctrl+Shift+R
5. Login again
```

### Option 2: Check Server Logs
In server terminal, look for:
```
[verifyToken] Token verified. User: { userId: X, userName: '...', roleType: '...' }
```
If you see this → token is working
If you see error → check JWT_SECRET

### Option 3: Full Reset
```bash
# 1. Stop both server and client
# 2. Delete node_modules and package-lock.json
npm ci

# 3. Restart server
npm run dev

# 4. Restart client  
npm start

# 5. Login fresh
```

---

## WHAT WAS FIXED

✅ Added `/api/token-debug` endpoint to validate tokens
✅ Enhanced JWT logging with startup configuration display
✅ Improved client error messages for 401 errors
✅ Added token validation debugging to API interceptor
✅ Created TOKEN_TROUBLESHOOTING.md documentation
✅ Created check-auth.bat and check-auth.sh diagnostic scripts

---

## FILES MODIFIED

- `server/.env` - Added JWT_SECRET
- `server/server.js` - Added token diagnostic endpoint
- `server/middleware/auth.js` - Enhanced logging
- `client/src/api.js` - Improved error logging
- `client/src/components/OrderManagement.js` - Better error messages
- Documentation/TOKEN_TROUBLESHOOTING.md - Full troubleshooting guide

---

## PREVENTION TIPS

1. **Always restart server after .env changes**
   ```bash
   # Edit .env
   # Then:
   npm run dev
   ```

2. **Monitor startup logs**
   Look for JWT configuration output to confirm settings

3. **Use /api/token-debug periodically**
   Quick validation that tokens are working

4. **Clear localStorage if token issues occur**
   ```javascript
   localStorage.clear()
   ```

---

## NEXT STEPS

1. ✅ Verify JWT_SECRET is in server/.env
2. ✅ Restart server
3. ✅ Logout and login again
4. ✅ Test orders loading
5. ✅ If still failing, run check-auth.bat or check-auth.sh

**Expected outcome:** Orders load successfully, no authentication errors

---

## Support Resources

- 📖 [TOKEN_TROUBLESHOOTING.md](TOKEN_TROUBLESHOOTING.md) - Comprehensive guide
- 🔧 [check-auth.bat](../check-auth.bat) - Windows diagnostic tool
- 🔧 [check-auth.sh](../check-auth.sh) - Mac/Linux diagnostic tool
- 🐛 Server logs with [verifyToken] output for debugging
