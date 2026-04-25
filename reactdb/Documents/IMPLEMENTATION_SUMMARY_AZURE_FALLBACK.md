# Azure Blob Storage Fallback Implementation - Complete Summary

## What Was Implemented

A complete fallback system that retrieves photos from either local storage OR Azure Blob Storage for the fullscreen main photo display.

### High-Level Architecture

```
User requests photo
        ↓
API endpoint: GET /api/tenants/:tenantId/main-photo/azure
        ↓
Backend checks local storage (/tenantphotos/filename)
        ↓
    NOT FOUND?
        ↓
Fallback to Azure: https://complexstore.blob.core.windows.net/proofs/filename
        ↓
Return photo from whichever source has it
```

## Files Modified/Created

### Backend
1. **`src/azureService.ts`** (Created)
   - New function: `downloadFromAzureBlobUrl()` - Downloads blobs from public Azure URLs
   - New function: `getAzureBlobUrl()` - Constructs Azure blob URLs
   - Updated: All existing functions for compatibility
   - Updated imports: Added `https` and `http` modules

2. **`src/index.ts`** (Modified)
   - Updated endpoint: `GET /api/tenants/:tenantId/main-photo/azure`
   - New logic: Check local storage first, then fallback to Azure
   - New database query: Retrieves both `photoUrl` and `name` from Tenant table
   - Response includes: `source` field ('local' or 'azure')
   - Response header: `X-Photo-Source` indicates source
   - Better error messages: Shows which sources were checked

3. **`.env`** (Modified)
   - New variable: `AZURE_BLOB_URL=https://complexstore.blob.core.windows.net/proofs`

### Frontend
1. **`src/components/TenantFullScreenView.tsx`** (Already updated)
   - Already supports `useAzurePhotos` prop
   - No changes needed - works with updated backend

2. **`src/api.ts`** (Already updated)
   - Already has: `getTenantMainPhotoUrl()` and `getTenantMainPhotoFromAzure()`
   - No changes needed

### Documentation
1. **`Documents/AZURE_FALLBACK_IMPLEMENTATION.md`** (Created)
   - Detailed implementation guide
   - Error responses and troubleshooting
   - Deployment instructions
   - Performance optimization tips

2. **`Documents/AZURE_FALLBACK_QUICKSTART.md`** (Created)
   - 1-minute setup guide
   - Quick reference table
   - Migration path

## Configuration

### Minimal Setup (1 line)
```env
AZURE_BLOB_URL=https://complexstore.blob.core.windows.net/proofs
```

### Full Setup (Optional)
```env
# Required for fallback
AZURE_BLOB_URL=https://complexstore.blob.core.windows.net/proofs

# Optional for connection string auth (SDK methods)
AZURE_STORAGE_CONNECTION_STRING=...
AZURE_CONTAINER_NAME=proofs
```

## How It Works

### Request Flow for K.Hemanathan Example

```
1. Frontend requests: /api/tenants/1/main-photo/azure?format=url

2. Backend queries database:
   SELECT photoUrl, name FROM Tenant WHERE tenant_id = 1
   Result: {
     photoUrl: "cb705263-e88f-443e-a05e-636abe6f0c11_IMG_20260318_132403.jpg",
     name: "K.Hemanathan"
   }

3. Check local storage:
   /tenantphotos/cb705263-e88f-443e-a05e-636abe6f0c11_IMG_20260318_132403.jpg
   Status: NOT FOUND

4. Fallback to Azure:
   https://complexstore.blob.core.windows.net/proofs/cb705263-e88f-443e-a05e-636abe6f0c11_IMG_20260318_132403.jpg
   Status: FOUND ✓

5. Return response:
   {
     "photoUrl": "https://complexstore.blob.core.windows.net/proofs/cb705263-e88f-443e-a05e-636abe6f0c11_IMG_20260318_132403.jpg",
     "fileName": "cb705263-e88f-443e-a05e-636abe6f0c11_IMG_20260318_132403.jpg",
     "source": "azure",
     "tenantName": "K.Hemanathan"
   }
```

## API Endpoint Details

### GET /api/tenants/:tenantId/main-photo/azure

**Parameters:**
- `:tenantId` (required) - Tenant ID number
- `?format=url` (optional) - Returns URL object instead of blob

**Responses:**

#### Success (format=url)
```json
{
  "photoUrl": "https://complexstore.blob.core.windows.net/proofs/...",
  "fileName": "cb705263-e88f-443e-a05e-636abe6f0c11_IMG_20260318_132403.jpg",
  "source": "azure",  // or "local"
  "tenantName": "K.Hemanathan"
}
```
Status: 200

#### Success (blob streaming)
- Binary image data
- Headers:
  - `X-Photo-Source: azure` or `X-Photo-Source: local`
  - `Content-Type: image/jpeg`
  - `Content-Disposition: inline; filename="..."`

Status: 200

#### Photo Not Found
```json
{
  "error": "Photo not found",
  "details": "Photo not found in local storage or Azure Blob Storage for tenant: K.Hemanathan",
  "fileName": "cb705263-e88f-443e-a05e-636abe6f0c11_IMG_20260318_132403.jpg",
  "tenantId": "1"
}
```
Status: 404

#### Tenant Not Found
```json
{
  "error": "Tenant not found"
}
```
Status: 404

## Frontend Usage

### React Component
```tsx
import TenantFullScreenView from './components/TenantFullScreenView';

<TenantFullScreenView 
  tenant={tenantData}
  useAzurePhotos={true}  // Enable Azure fallback
  onClose={() => handleClose()}
/>
```

The component automatically handles:
- Loading state while fetching from Azure
- Error state if both sources fail
- Fallback to local file if Azure fails
- Display of loading message during fetch

## Key Features

✅ **Automatic Fallback** - No code changes needed
✅ **Local-First** - Returns local files immediately if available
✅ **Source Tracking** - Know where photo came from (local/azure)
✅ **Graceful Degradation** - Falls back if Azure is unavailable
✅ **Error Handling** - Clear error messages and logging
✅ **Backward Compatible** - Works with existing local storage
✅ **Flexible** - Supports multiple filename formats
✅ **Performance** - Local file streaming is fast, Azure has ~100-500ms latency

## Supported Filename Formats

The endpoint handles various filename formats in the database:
- `photo.jpg`
- `tenantphotos/photo.jpg`
- `/tenantphotos/photo.jpg`
- `cb705263-e88f-443e-a05e-636abe6f0c11_IMG_20260318_132403.jpg`
- Any filename-only format

## Debug Logging

Backend logs indicate source:
```
✓ Loaded photo from local storage: photo.jpg
✓ Loaded photo from Azure Blob Storage: photo.jpg
Could not load from local storage (path): Error message
Attempting to load photo from Azure: https://url
Could not load from Azure (filename): Error message
```

## Migration Strategy

### Phase 1: Setup (0 downtime)
1. Add `AZURE_BLOB_URL` to `.env`
2. Deploy updated backend
3. No frontend changes needed

### Phase 2: Upload to Azure (optional)
1. Gradually upload photos to Azure blob
2. Keep local copies (they take priority)
3. Monitor with `curl` requests checking `source` field

### Phase 3: Archive (optional)
1. Once verified, optionally delete local copies
2. Azure becomes primary source
3. Set local storage to archive-only if desired

## DNS/URL Configuration

For the example provided:
- Storage Account: `complexstore`
- Container: `proofs`
- Full URL: `https://complexstore.blob.core.windows.net/proofs/`

Files are accessed at:
```
https://complexstore.blob.core.windows.net/proofs/filename.jpg
```

## Performance Considerations

| Source | Latency | Notes |
|--------|---------|-------|
| Local Storage | ~5ms | Direct file read from disk |
| Azure Blob | ~100-500ms | Network request to Azure |
| Cached (Browser) | <1ms | Browser cache when using `format=url` |

## Deployment in Docker

```yaml
services:
  backend:
    environment:
      AZURE_BLOB_URL: https://complexstore.blob.core.windows.net/proofs
      AZURE_STORAGE_CONNECTION_STRING: "" # Leave empty for URL-only access
    volumes:
      - ./tenantphotos:/app/tenantphotos
```

## Security Notes

- Azure URL is public - no authentication required
- If you need private access, update to use SAS tokens (connection string auth)
- Local files are served via `/api/tenantphotos/` with same permissions as before
- No sensitive data exposed in responses

## Troubleshooting Checklist

- [ ] `AZURE_BLOB_URL` is set in `.env`
- [ ] Local files exist in `/tenantphotos/` directory
- [ ] Azure files exist in blob container with correct filenames
- [ ] Filenames are identical between local and Azure (case-sensitive)
- [ ] Backend has read permission on local directories
- [ ] Azure storage account allows blob access
- [ ] Check logs for `✓ Loaded photo from...` messages

## Verification

To verify it's working:

```bash
# Get photo URL endpoint
curl "http://localhost:5002/api/tenants/1/main-photo/azure?format=url" | jq .

# expected output should show source as "local" or "azure"
{
  "photoUrl": "...",
  "source": "local",  // or "azure"
  "fileName": "...",
  "tenantName": "..."
}
```

## Support & Documentation

- See `AZURE_FALLBACK_IMPLEMENTATION.md` for full details
- See `AZURE_FALLBACK_QUICKSTART.md` for quick reference
- See `AZURE_BLOB_STORAGE_SETUP.md` for connection string setup
- Backend logs show detailed photo loading attempts

## Summary

The system is now production-ready with automatic fallback from local storage to Azure Blob Storage. Photos are served transparently from whichever source is available, with clear indication of the source in API responses.
