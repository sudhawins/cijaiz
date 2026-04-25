# Azure Blob Storage Fallback - Implementation Guide

## Overview

The system now implements automatic fallback logic for retrieving tenant main photos:
1. **First attempt**: Check local file storage
2. **Fallback**: If not found locally, automatically fetch from Azure Blob Storage
3. **Error handling**: Returns clear error if file is not found in either location

## Configuration

Update your `.env` file with the Azure Blob Storage URL:

```env
# Azure Blob Storage (for fallback when local files are missing)
AZURE_BLOB_URL=https://complexstore.blob.core.windows.net/proofs
```

## How It Works

### Local-First Approach
The system checks for files in `/tenantphotos/` directory first. This ensures:
- Fast retrieval for files already in local storage
- Minimal latency for locally cached files
- Backward compatibility with existing deployments

### Azure Fallback
If a file is not found locally, the system automatically:
1. Constructs the Azure Blob URL: `{AZURE_BLOB_URL}/{fileName}`
2. Attempts to download from Azure
3. Returns the file if found
4. Returns a 404 if not found in either location

### Example Flow for K.Hemanathan
```
Request → /api/tenants/1/main-photo/azure
  ↓
Check local: /tenantphotos/cb705263-e88f-443e-a05e-636abe6f0c11_IMG_20260318_132403.jpg
  ↓ (Not found locally)
Check Azure: https://complexstore.blob.core.windows.net/proofs/cb705263-e88f-443e-a05e-636abe6f0c11_IMG_20260318_132403.jpg
  ↓ (Found!)
Return file with source='azure'
```

## API Endpoint

### Get Tenant Main Photo
**Endpoint:** `GET /api/tenants/:tenantId/main-photo/azure`

**Query Parameters:**
- `format=url` - Returns URL object (recommended for images)
- Default - Streams the image blob directly

**Example Requests:**
```bash
# Get photo URL (recommended)
curl "http://localhost:5000/api/tenants/1/main-photo/azure?format=url"

# Get photo blob directly
curl "http://localhost:5000/api/tenants/1/main-photo/azure" > photo.jpg
```

**Response (format=url):**
```json
{
  "photoUrl": "/api/tenantphotos/photo.jpg",
  "fileName": "photo.jpg",
  "source": "local",
  "tenantName": "K.Hemanathan"
}
```

Or if from Azure:
```json
{
  "photoUrl": "https://complexstore.blob.core.windows.net/proofs/cb705263-e88f-443e-a05e-636abe6f0c11_IMG_20260318_132403.jpg",
  "fileName": "cb705263-e88f-443e-a05e-636abe6f0c11_IMG_20260318_132403.jpg",
  "source": "azure",
  "tenantName": "K.Hemanathan"
}
```

**Response Headers (blob mode):**
- `X-Photo-Source: local` or `X-Photo-Source: azure` - Indicates where photo came from
- `Content-Type: image/jpeg`
- `Content-Disposition: inline; filename="..."`

## Frontend Usage

```tsx
import TenantFullScreenView from './components/TenantFullScreenView';

export function TenantDetail({ tenant }) {
  return (
    <TenantFullScreenView 
      tenant={tenant}
      useAzurePhotos={true}  // Enables the fallback-enabled endpoint
    />
  );
}
```

The endpoint automatically handles the fallback, so the frontend doesn't need to implement any special logic.

## Supported File Name Formats

The system handles various file name formats in the database:
- `photo.jpg`
- `tenantphotos/photo.jpg`
- `https://example.com/photo.jpg`
- `cb705263-e88f-443e-a05e-636abe6f0c11_IMG_20260318_132403.jpg`

## Error Responses

### Tenant Not Found
```json
{
  "error": "Tenant not found"
}
```
**Status:** 404

### Photo Not Found (Not in Local or Azure)
```json
{
  "error": "Photo not found",
  "details": "Photo not found in local storage or Azure Blob Storage for tenant: K.Hemanathan",
  "fileName": "cb705263-e88f-443e-a05e-636abe6f0c11_IMG_20260318_132403.jpg",
  "tenantId": "1"
}
```
**Status:** 404

### Server Error
```json
{
  "error": "Failed to process request",
  "message": "Error details..."
}
```
**Status:** 500

## Deployment

### Docker Deployment
Set the environment variable in your docker-compose.yml:

```yaml
services:
  backend:
    environment:
      AZURE_BLOB_URL: https://complexstore.blob.core.windows.net/proofs
```

In your `.env` file for Docker:
```env
AZURE_BLOB_URL=https://complexstore.blob.core.windows.net/proofs
```

### Production Considerations

1. **File Upload Strategy**
   - New uploads go to local storage by default
   - Consider archiving old files to Azure for cost savings
   - Set up automated backup to Azure

2. **Performance**
   - Local files load faster (no network request)
   - Azure fallback adds ~100-500ms latency
   - Consider implementing caching for Azure URLs

3. **Storage Management**
   - Monitor local storage space
   - Archive to Azure when local storage reaches 80% capacity
   - Implement cleanup for stale temporary files

4. **Monitoring**
   - Log source ('local' vs 'azure') for analytics
   - Alert on too many 404s (indicates data issues)
   - Monitor Azure bandwidth costs

## Migration from Local-Only to Hybrid

If you're migrating from local-only storage:

1. **No action needed** - The system works with existing local files
2. **Optional**: Copy some files to Azure for testing
3. **Gradual migration**: Move old files to Azure while keeping recent ones local
4. **Automatic fallback**: Already enabled, just set `AZURE_BLOB_URL`

## Troubleshooting

### Issue: Photos load from local but not from Azure
**Check:**
- `AZURE_BLOB_URL` environment variable is set correctly
- File exists in Azure at the specified URL
- Azure Storage account allows public read access (or use SAS tokens)

### Issue: Photos load from Azure but return 404 occasionally
**Check:**
- Filename matches exactly between database and Azure storage
- Azure Storage account isn't rate-limited (429 errors)
- Network connectivity to Azure is stable

### Issue: All photos return 404
**Check:**
- Tenant exists in database
- Photo filename is stored in `photoUrl` field
- Files exist in either local storage or Azure

### Viewing Logs
The backend logs photo source for debugging:
```
✓ Loaded photo from local storage: photo.jpg
✓ Loaded photo from Azure Blob Storage: photo.jpg
Could not load from local storage: File not found
Could not load from Azure: 404 Not Found
```

## Performance Optimization

### Caching Strategy
```typescript
// Browser caching (automatic via HTTP headers)
res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours

// Or implement Redis caching on backend for Azure URLs
const cacheKey = `photo_${tenantId}`;
const cachedUrl = await redis.get(cacheKey);
```

### Bandwidth Optimization
- Request with `format=url` to avoid streaming full blob
- Let browser cache the image URL
- Use Azure CDN for faster delivery

## Limits and Quotas

### Azure Storage
- Standard blob download: 60MB/sec baseline
- No file size limits for blobs
- Rate limits: 20,000 operations per second per storage account

### Bandwidth
- Monitor your Azure bandwidth costs
- Consider using Azure CDN for frequently accessed photos
- Implement local caching for recent photos

## Support and References

- Azure Blob Storage Docs: https://docs.microsoft.com/en-us/azure/storage/blobs/
- Node.js Azure SDK: https://github.com/Azure/azure-sdk-for-js/tree/main/sdk/storage/storage-blob
