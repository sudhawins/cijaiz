# Enable Fullscreen Photo - Exact File & Line

## TLDR: One Line Change

**File:** `frontend/src/components/TenantManagement.tsx`  
**Line:** 484-490

**Change this:**
```tsx
<TenantFullScreenView
  tenant={fullScreenTenant}
  onClose={handleCloseFullscreen}
  onViewPhoto={handleViewPhoto}
  onViewProof={handleViewProof}
/>
```

**To this:**
```tsx
<TenantFullScreenView
  tenant={fullScreenTenant}
  onClose={handleCloseFullscreen}
  onViewPhoto={handleViewPhoto}
  onViewProof={handleViewProof}
  useAzurePhotos={true}
/>
```

**Just add one line: `useAzurePhotos={true}`**

---

## Step-by-Step

1. Open: `frontend/src/components/TenantManagement.tsx`

2. Find line 485 (search for `<TenantFullScreenView`)

3. Add this line before the closing `/>`:
   ```tsx
   useAzurePhotos={true}
   ```

4. Save the file

5. Run frontend: `npm run dev`

6. Done! ✅

---

## Before & After Comparison

### BEFORE (Current)
**File: TenantManagement.tsx, Lines 484-490**

```tsx
          <TenantFullScreenView
            tenant={fullScreenTenant}
            onClose={handleCloseFullscreen}
            onViewPhoto={handleViewPhoto}
            onViewProof={handleViewProof}
          />
```

### AFTER (Fixed)
**File: TenantManagement.tsx, Lines 484-491**

```tsx
          <TenantFullScreenView
            tenant={fullScreenTenant}
            onClose={handleCloseFullscreen}
            onViewPhoto={handleViewPhoto}
            onViewProof={handleViewProof}
            useAzurePhotos={true}
          />
```

---

## Verify It Works

After adding the line:

```bash
# Build front-end
cd frontend
npm run build

# If build succeeds with no errors, you're good!
# Should show output like:
# ✓ 127 modules transformed
# ✓ built in X.XXs
```

## Run & Test

```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev
```

Then:
1. Open http://localhost:3000
2. Click on any tenant to view details
3. Click fullscreen photo button
4. Photo should display from Azure
5. Open DevTools (F12) → Console
6. Should show: `✓ Loaded main photo from Azure Blob Storage`

## What This Does

With `useAzurePhotos={true}`:
- Component automatically fetches photo from Azure endpoint
- Component displays loading state while fetching
- Component automatically falls back to local file if Azure fails
- Source tracking (knows if photo came from "local" or "azure")

## That's It!

No other components needed updates. TenantManagement.tsx is the only place that uses TenantFullScreenView in your codebase.

---

## If You Have Multiple TenantFullScreenView Uses

We only found one in TenantManagement.tsx. But if there are others (e.g., in mobile views or other components), add the same `useAzurePhotos={true}` prop to all of them.

To find all usages:
```bash
grep -n "TenantFullScreenView" frontend/src/components/*.tsx
```

---

## Rollback (If Needed)

If something goes wrong, just remove the `useAzurePhotos={true}` line:

```tsx
<TenantFullScreenView
  tenant={fullScreenTenant}
  onClose={handleCloseFullscreen}
  onViewPhoto={handleViewPhoto}
  onViewProof={handleViewProof}
  // useAzurePhotos={true}  ← Comment this out or delete it
/>
```

---

## File Locations for Reference

| File | Purpose |
|------|---------|
| `frontend/src/components/TenantManagement.tsx` | **← UPDATE THIS LINE 490** |
| `frontend/src/components/TenantFullScreenView.tsx` | Component (already updated, don't change) |
| `backend/src/index.ts` | Backend endpoint (already fixed, don't change) |
| `backend/.env` | Config (already set correctly, don't change) |

---

## Status Check

- ✅ Backend: Fixed SQL query, endpoint working
- ✅ Frontend: Fixed TypeScript errors, component ready
- ⏳ You: Add `useAzurePhotos={true}` prop (15 seconds)
- ⏳ Test: Run and verify photo displays

---

## Support

If something doesn't work after making the change:
1. Check file saved correctly
2. Check no typos in the prop name
3. Run `npm run build` to verify no compilation errors
4. Check backend is running: `curl http://localhost:5002/api/health`
5. Check browser console (F12) for error messages
6. Refer to `AZURE_FALLBACK_TESTING.md` for detailed troubleshooting
