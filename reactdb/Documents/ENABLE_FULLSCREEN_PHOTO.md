# Enable Fullscreen Main Photo - Quick Guide

## The Issue Was

The fullscreen main photo wasn't displaying because:
1. Frontend had TypeScript errors (wrong property names)
2. Backend SQL query was looking for wrong column names

Both are now **FIXED** ✅

## How to Enable It

### Step 1: Update Your Component

Find where you use `TenantFullScreenView` and add the `useAzurePhotos={true}` prop:

**Current code:**
```tsx
<TenantFullScreenView 
  tenant={tenant}
  onClose={handleClose}
/>
```

**Updated code:**
```tsx
<TenantFullScreenView 
  tenant={tenant}
  onClose={handleClose}
  useAzurePhotos={true}  // ADD THIS LINE
/>
```

### Step 2: That's It!

The component now:
1. Automatically calls the Azure photo endpoint
2. Checks local storage first
3. Falls back to Azure if not found locally
4. Displays the photo seamlessly

## Example Code

If you're in `TenantManagement.tsx` or similar:

```tsx
import TenantFullScreenView from './TenantFullScreenView';

export default function TenantManagement() {
  const [selectedTenant, setSelectedTenant] = useState<TenantWithOccupancy | null>(null);

  return (
    <div>
      {selectedTenant && (
        <TenantFullScreenView
          tenant={selectedTenant}
          useAzurePhotos={true}  // ← Add this!
          onClose={() => setSelectedTenant(null)}
          onViewPhoto={(index) => {/* handle */}}
          onViewProof={(index) => {/* handle */}}
        />
      )}
      
      {/* Rest of your component */}
    </div>
  );
}
```

## What Happens Under the Hood

```
1. User clicks fullscreen photo
   ↓
2. <TenantFullScreenView useAzurePhotos={true} />
   ↓
3. Component fetches from: /api/tenants/{id}/main-photo/azure?format=url
   ↓
4. Backend checks:
   - Local storage: /tenantphotos/filename
   - Azure: https://complexstore.blob.core.windows.net/proofs/filename
   ↓
5. Returns whichever has the file
   ↓
6. Photo displays in fullscreen
```

## Build & Run

```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend  
cd frontend
npm run dev
```

Then open: http://localhost:3000

## Testing

1. Navigate to any tenant
2. Click "View Details" or fullscreen photo button
3. Photo should load from Azure
4. Check browser console (F12) for:
   - `✓ Loaded main photo from Azure Blob Storage`
   - No error messages

## If Photo Still Doesn't Show

### Check 1: Is backend running?
```bash
curl http://localhost:5002/api/health
# Should return: {"status":"ok","message":"Backend is running"}
```

### Check 2: Is the endpoint working?
```bash
curl "http://localhost:5002/api/tenants/22/main-photo/azure?format=url"
# Should return: {"photoUrl":"https://...", "source":"azure", ...}
```

### Check 3: Is the prop set?
Make sure you have `useAzurePhotos={true}` in your TenantFullScreenView component.

### Check 4: Browser console
Open Developer Tools (F12) and check:
- Network tab → look for `/api/tenants/.../main-photo/azure` request
- Console tab → check for error messages

## Component Props

```typescript
interface TenantFullScreenViewProps {
  tenant: TenantWithOccupancy;        // Required: The tenant data
  onClose?: () => void;               // Optional: Called when closing
  onViewPhoto?: (index: number) => void; // Optional: Photo gallery callback
  onViewProof?: (index: number) => void; // Optional: Proof gallery callback
  useAzurePhotos?: boolean;           // Optional: Enable Azure fallback (default: false)
}
```

## Status Summary

| Component | Status | Details |
|-----------|--------|---------|
| Frontend TypeScript | ✅ Fixed | No compilation errors |
| Backend SQL Query | ✅ Fixed | Correct column names |
| API Endpoint | ✅ Working | Returns photo URLs |
| Photo Display | ✅ Ready | Works when `useAzurePhotos={true}` |

## Files to Check

If you need to verify the changes:
- `frontend/src/components/TenantFullScreenView.tsx` - Component with Azure support
- `backend/src/index.ts` - API endpoint implementation
- `backend/src/azureService.ts` - Azure integration
- `frontend/src/api.ts` - API client

## Questions?

Refer to:
- `FULLSCREEN_PHOTO_FIXED.md` - Full troubleshooting guide
- `AZURE_FALLBACK_IMPLEMENTATION.md` - Technical details
- `AZURE_FALLBACK_TESTING.md` - Testing procedures
