# Azure Blob Storage - Quick Reference

## Configuration

```env
# .env file (backend)
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=xxx;AccountKey=xxx;EndpointSuffix=core.windows.net
AZURE_CONTAINER_NAME=photos
```

## Backend Usage

```typescript
// In your Express routes
import { getAzureBlobSasUrl, downloadAzureBlob, isAzureConfigured } from './azureService';

if (isAzureConfigured()) {
  const url = await getAzureBlobSasUrl('photo_tenant_123.jpg');
  const content = await downloadAzureBlob('photo_tenant_123.jpg');
}
```

## API Endpoint

```
GET /api/tenants/:tenantId/main-photo/azure?format=url
```

Returns:
```json
{
  "photoUrl": "https://account.blob.core.windows.net/photos/...",
  "blobName": "photo_tenant_123.jpg",
  "source": "azure"
}
```

## Frontend Usage

### React Component
```tsx
<TenantFullScreenView 
  tenant={tenant}
  useAzurePhotos={true}
/>
```

### Direct API Call
```tsx
const response = await apiService.getTenantMainPhotoUrl(tenantId);
const { photoUrl } = response.data;
```

## Key Features

✓ Azure Blob Storage integration for photos  
✓ Fallback to local files  
✓ SAS URL generation  
✓ Error handling with graceful degradation  
✓ Support for both URL and blob streaming  

## Files Modified/Created

- `backend/src/azureService.ts` - Azure SDK wrapper
- `backend/src/index.ts` - API endpoint and initialization
- `frontend/src/api.ts` - API client functions
- `frontend/src/components/TenantFullScreenView.tsx` - Component with Azure support

## Next Steps

1. Set up Azure Storage Account
2. Configure environment variables
3. Upload photos to Azure container
4. Test with `useAzurePhotos={true}`
