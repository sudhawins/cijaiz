# Azure Fallback - Quick Start

## 1-Minute Setup

```env
# Add to .env in backend directory
AZURE_BLOB_URL=https://complexstore.blob.core.windows.net/proofs
```

## How It Works

```
Request for photo
  ↓
Check local storage (/tenantphotos/)
  ↓
NOT FOUND? → Fetch from Azure
  ↓
Return from whichever source has it
```

## File Structure

Both locations expect the **same filename**:
- Local: `/tenantphotos/cb705263-e88f-443e-a05e-636abe6f0c11_IMG_20260318_132403.jpg`
- Azure: `https://complexstore.blob.core.windows.net/proofs/cb705263-e88f-443e-a05e-636abe6f0c11_IMG_20260318_132403.jpg`

## Usage

```bash
# Get photo (auto-fallback enabled)
curl http://localhost:5000/api/tenants/1/main-photo/azure?format=url
```

Response:
```json
{
  "photoUrl": "https://complexstore.blob.core.windows.net/proofs/cb705263-e88f...",
  "source": "azure",  // or "local"
  "fileName": "cb705263-e88f-443e-a05e-636abe6f0c11_IMG_20260318_132403.jpg",
  "tenantName": "K.Hemanathan"
}
```

## React Component

```tsx
<TenantFullScreenView 
  tenant={tenantData}
  useAzurePhotos={true}
/>
```

The component automatically uses the fallback-enabled endpoint.

## What's New

✓ Automatic fallback from local → Azure  
✓ Returns source in response (`local` or `azure`)  
✓ Handles case sensitivity and path variations  
✓ Graceful error handling for missing files  
✓ No code changes needed for frontend  

## Environment Variables

Only **one** is required:

```env
AZURE_BLOB_URL=https://your-storage-account.blob.core.windows.net/container-name
```

Others are optional:
```env
AZURE_STORAGE_CONNECTION_STRING=...  # For connection string auth (SDK methods)
AZURE_CONTAINER_NAME=proofs          # For connection string auth
```

## API Endpoint

```
GET /api/tenants/{tenantId}/main-photo/azure
```

Query parameters:
- `format=url` - Get URL (recommended)
- No params - Stream blob directly

## Response Source Header

When streaming blob (no format=url):
- Header `X-Photo-Source: local` or `X-Photo-Source: azure`

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Getting 404 | Check file exists in local OR Azure |
| Local files not loading | Check `/tenantphotos/` folder permissions |
| Azure files not loading | Verify `AZURE_BLOB_URL` is correct |
| Wrong source | Check case - filenames are case-sensitive in Azure |

## Migration Path

1. Set `AZURE_BLOB_URL` → Done! Fallback active
2. Upload photos to Azure
3. Delete local copies (optional)
4. Monitor using `X-Photo-Source` header

## Files Changed

- `backend/src/azureService.ts` - Added URL downloader
- `backend/src/index.ts` - Updated endpoint with fallback
- `backend/.env` - Added `AZURE_BLOB_URL`
- `frontend/.../TenantFullScreenView.tsx` - Already supports it

No frontend changes required!
