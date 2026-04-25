# Azure Blob Storage Integration Guide

## Overview

This guide explains how to integrate Azure Blob Storage for retrieving tenant main photos in your React Photo App.

## Features

- **Query tenant main photos directly from Azure Blob Storage**
- **Fallback to local files if Azure fails**
- **SAS URL generation for secure access**
- **Support for both blob content streaming and URL retrieval**
- **Automatic error handling with graceful degradation**

## Prerequisites

1. Azure Storage Account
2. Connection String for the storage account
3. Container created in Azure Blob Storage (default: "photos")
4. Photos uploaded to Azure Blob Storage

## Setup Instructions

### Step 1: Install Dependencies

The Azure SDK is already installed via:
```bash
npm install @azure/storage-blob
```

### Step 2: Configure Environment Variables

Add the following to your `.env` file in the backend:

```env
# Azure Blob Storage Configuration
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=YOUR_STORAGE_ACCOUNT;AccountKey=YOUR_ACCOUNT_KEY;EndpointSuffix=core.windows.net
AZURE_CONTAINER_NAME=photos
```

**To find your connection string:**
1. Go to Azure Portal → Storage Accounts → Your Account
2. Click "Access keys" in the left sidebar
3. Copy the "Connection string" under "key1"

### Step 3: Upload Photos to Azure

Upload your tenant photos to the Azure Blob Storage container with the filename format:
- Use the same filenames that are stored in your database (e.g., `photo_tenant_123.jpg`)
- Path example: `photos/photo_tenant_123.jpg`

## API Endpoints

### Get Main Photo from Azure

**Endpoint:** `GET /api/tenants/:tenantId/main-photo/azure`

**Query Parameters:**
- `format=url` - Returns a URL object (default) instead of blob content

**Request:**
```bash
# Get the photo URL
curl "http://localhost:5000/api/tenants/1/main-photo/azure?format=url"

# Get the photo blob (streams the image)
curl "http://localhost:5000/api/tenants/1/main-photo/azure"
```

**Response (format=url):**
```json
{
  "photoUrl": "https://yourstorageaccount.blob.core.windows.net/photos/photo_tenant_123.jpg",
  "blobName": "photo_tenant_123.jpg",
  "source": "azure"
}
```

**Response (format=blob):**
- Returns the image file directly with `Content-Type: image/jpeg`

## Frontend Usage

### Option 1: Enable Azure for Specific Component

```tsx
import TenantFullScreenView from './components/TenantFullScreenView';

export function MyComponent() {
  return (
    <TenantFullScreenView 
      tenant={tenantData}
      useAzurePhotos={true}  // Enable Azure Blob Storage
      onClose={() => {}}
    />
  );
}
```

### Option 2: Manual API Call

```tsx
import { apiService } from './api';

async function loadAzurePhoto(tenantId: number) {
  try {
    const response = await apiService.getTenantMainPhotoUrl(tenantId);
    const { photoUrl } = response.data;
    console.log('Photo URL:', photoUrl);
    // Use photoUrl in your img tag
  } catch (error) {
    console.error('Failed to load photo:', error);
  }
}
```

## Backend API Methods

The `azureService.ts` module provides these functions:

```typescript
// Get a blob URL
await getAzureBlobSasUrl(blobName, expiryHours);

// Download blob content as buffer
await downloadAzureBlob(blobName);

// Upload file to Azure
await uploadAzureBlob(blobName, fileBuffer, contentType);

// Delete blob
await deleteAzureBlob(blobName);

// Get blob properties
await getAzureBlobProperties(blobName);

// Check if Azure is configured
isAzureConfigured();
```

## Docker Deployment

For Docker deployments, set the environment variables:

```yaml
environment:
  AZURE_STORAGE_CONNECTION_STRING: ${AZURE_STORAGE_CONNECTION_STRING}
  AZURE_CONTAINER_NAME: ${AZURE_CONTAINER_NAME}
```

In your `.env` for Docker:
```env
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=YOUR_ACCOUNT;AccountKey=YOUR_KEY;EndpointSuffix=core.windows.net
AZURE_CONTAINER_NAME=photos
```

## Error Handling

The implementation includes comprehensive error handling:

1. **Missing Configuration**: Returns 503 with proper error message
2. **Blob Not Found**: Returns 404 when blob doesn't exist
3. **Network Issues**: Falls back to local files in frontend
4. **Invalid Credentials**: Error logged with clear message

## Troubleshooting

### Issue: "Azure Blob Storage is not configured"
**Solution:** Ensure `AZURE_STORAGE_CONNECTION_STRING` environment variable is set.

### Issue: "Blob not found in Azure Blob Storage"
**Solution:** Verify the blob name matches exactly what's stored in your database. Check Azure Portal to confirm the file exists.

### Issue: Photos still loading from local filesystem
**Solution:** Ensure `useAzurePhotos={true}` prop is passed to the component.

### Issue: "Failed to load photo from Azure, using fallback"
**Solution:** This is expected behavior - it will automatically fallback to local files. Check backend logs for specific error details.

## Performance Considerations

- **URL Retrieval** (`format=url`): Fastest - returns immediately
- **Blob Streaming**: Recommended for one-time reads
- **Caching**: Consider implementing browser caching for URLs

## Security

- **Connection String**: Never commit to version control; use environment variables
- **SAS URLs**: Generated with configurable expiry (default: 24 hours)
- **Access Control**: Use Azure storage access keys with appropriate permissions

## Data Migration

To migrate from local storage to Azure:

1. Upload all files to Azure Blob Storage with matching names
2. Update database with Azure paths (or leave as-is for backward compatibility)
3. Enable `useAzurePhotos={true}` in components
4. Monitor logs to ensure Azure retrieval is working
5. Optionally use API to upload new files to Azure

## Support

For Azure SDK issues, refer to: https://github.com/Azure/azure-sdk-for-js/tree/main/sdk/storage/storage-blob
