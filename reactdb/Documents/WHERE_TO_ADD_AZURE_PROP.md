# Where to Add useAzurePhotos={true}

## TenantCard Component (Most Likely Location)

Find your `TenantCard.tsx` component and look for where TenantFullScreenView is rendered:

**File:** `frontend/src/components/TenantCard.tsx`

```tsx
// BEFORE (without Azure):
<TenantFullScreenView 
  tenant={tenant}
  onClose={() => setShowFullScreen(false)}
/>

// AFTER (with Azure - CHANGE THIS):
<TenantFullScreenView 
  tenant={tenant}
  onClose={() => setShowFullScreen(false)}
  useAzurePhotos={true}  // ← ADD THIS LINE
/>
```

## TenantManagement Component

Find in `frontend/src/components/TenantManagement.tsx`:

```tsx
// BEFORE:
<TenantFullScreenView 
  tenant={selectedTenant}
  onClose={handleCloseFullScreen}
/>

// AFTER:
<TenantFullScreenView 
  tenant={selectedTenant}
  onClose={handleCloseFullScreen}
  useAzurePhotos={true}  // ← ADD THIS LINE
/>
```

## SearchTenants / SearchResults Component

If you have a separate search results view showing tenant details:

```tsx
// BEFORE:
<TenantFullScreenView 
  tenant={result}
  onClose={() => setFullScreenView(null)}
/>

// AFTER:
<TenantFullScreenView 
  tenant={result}
  onClose={() => setFullScreenView(null)}
  useAzurePhotos={true}  // ← ADD THIS LINE
/>
```

## OccupancyManagement / TenantDetail Component

If you have a dedicated tenant detail page:

```tsx
// BEFORE:
<TenantFullScreenView 
  tenant={currentTenant}
  onClose={handleClose}
  onViewPhoto={handlePhotoGallery}
  onViewProof={handleProofGallery}
/>

// AFTER:
<TenantFullScreenView 
  tenant={currentTenant}
  onClose={handleClose}
  onViewPhoto={handlePhotoGallery}
  onViewProof={handleProofGallery}
  useAzurePhotos={true}  // ← ADD THIS LINE
/>
```

## How to Find All Locations

1. Open VS Code
2. Press `Ctrl+Shift+F` to open Find in Files
3. Search for: `TenantFullScreenView`
4. For each result, add `useAzurePhotos={true}` to the props

## 5-Second Fix

In each location where you have:
```tsx
<TenantFullScreenView 
  tenant={...}
```

Just add this line before the closing `/>`:
```tsx
useAzurePhotos={true}
```

**That's it!**

## Verify It Works

After making the change:

1. **Rebuild frontend:**
   ```bash
   cd frontend
   npm run build
   ```
   Should complete without errors ✅

2. **Run dev server:**
   ```bash
   npm run dev
   ```
   Frontend should start on http://localhost:3000

3. **Verify in app:**
   - Navigate to any tenant
   - Click fullscreen photo
   - Open DevTools (F12)
   - Look for in Console:
     - `✓ Loaded main photo from Azure Blob Storage`
   - Or check Network tab for `/api/tenants/.../main-photo/azure` request

## Testing Different Scenarios

### Photo in Local Storage
- Should load instantly (<50ms)
- Console shows nothing (uses local file)

### Photo Only in Azure
- Should load within 500ms
- Console shows: `✓ Loaded main photo from Azure Blob Storage`

### Photo Nowhere
- Should show error
- Console shows: `Failed to load photo from Azure`
- Fallback to existing behavior

## One Command to Find All Locations

```bash
grep -r "TenantFullScreenView" frontend/src/
```

This shows all components using TenantFullScreenView.

## Summary

| Step | Action | Result |
|------|--------|--------|
| 1 | Find all `<TenantFullScreenView` | List of files to update |
| 2 | Add `useAzurePhotos={true}` | Component uses new endpoint |
| 3 | Run `npm run build` | Verify no errors |
| 4 | Run `npm run dev` | Test in browser |
| 5 | Load a tenant view | Photo displays from Azure |

---

**That's all you need to do!**

The backend is already working, the endpoint is tested, and the component is ready. Just enable the feature with one prop on each location.
