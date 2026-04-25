import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import https from 'https';
import http from 'http';

// Azure configuration
const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const AZURE_CONTAINER_NAME = process.env.AZURE_CONTAINER_NAME || 'proofs';
const AZURE_BLOB_URL = process.env.AZURE_BLOB_URL || 'https://complexstore.blob.core.windows.net/proofs';

let blobServiceClient: BlobServiceClient | null = null;
let containerClient: ContainerClient | null = null;

// Initialize Azure Blob Storage client
export const initializeAzureClient = (): void => {
  if (!AZURE_STORAGE_CONNECTION_STRING || AZURE_STORAGE_CONNECTION_STRING === 'your_connection_string') {
    console.log('ℹ Azure Storage connection string not configured (optional). Using fallback URL-based downloads from:', AZURE_BLOB_URL);
    return;
  }

  try {
    blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
    containerClient = blobServiceClient.getContainerClient(AZURE_CONTAINER_NAME);
    console.log(`✓ Azure Blob Storage initialized with container: ${AZURE_CONTAINER_NAME}`);
  } catch (error) {
    console.warn('Could not initialize Azure Blob Storage client (using URL fallback instead):', (error as any).message);
  }
};

// Check if Azure is properly configured
export const isAzureConfigured = (): boolean => {
  return !!(blobServiceClient && containerClient && AZURE_STORAGE_CONNECTION_STRING);
};

// Get Azure Blob URL for a file
export const getAzureBlobUrl = (fileName: string): string => {
  return `${AZURE_BLOB_URL}/${fileName}`;
};

// Download from Azure Blob URL directly
export const downloadFromAzureBlobUrl = async (url: string): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    
    client.get(url, (response) => {
      if (response.statusCode === 404) {
        reject(new Error('Blob not found at URL'));
        return;
      }
      
      if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
        reject(new Error(`HTTP Error: ${response.statusCode}`));
        return;
      }

      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    }).on('error', reject);
  });
};

// Get a Shared Access Signature (SAS) URL for a blob
export const getAzureBlobSasUrl = async (blobName: string, expiryHours: number = 24): Promise<string> => {
  if (!containerClient) {
    throw new Error('Azure Blob Storage client is not initialized');
  }

  try {
    const blobClient = containerClient.getBlobClient(blobName);
    
    // Check if blob exists
    const exists = await blobClient.exists();
    if (!exists) {
      throw new Error(`Blob '${blobName}' not found in Azure Blob Storage`);
    }

    // Get the blob URL
    const blobUrl = blobClient.url;
    
    console.log(`✓ Retrieved Azure Blob URL for: ${blobName}`);
    return blobUrl;
  } catch (error) {
    console.error(`Failed to get Azure Blob SAS URL for ${blobName}:`, error);
    throw error;
  }
};

// Download blob content
export const downloadAzureBlob = async (blobName: string): Promise<Buffer> => {
  if (!containerClient) {
    throw new Error('Azure Blob Storage client is not initialized');
  }

  try {
    const blobClient = containerClient.getBlobClient(blobName);
    const downloadBlockBlobResponse = await blobClient.download(0);
    
    // Convert stream to buffer
    const chunks: Buffer[] = [];
    const readable = downloadBlockBlobResponse.readableStreamBody;
    
    if (!readable) {
      throw new Error('Failed to get readable stream from Azure Blob');
    }

    return new Promise((resolve, reject) => {
      readable.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      readable.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
      readable.on('error', reject);
    });
  } catch (error) {
    console.error(`Failed to download Azure Blob '${blobName}':`, error);
    throw error;
  }
};

export const downloadAzureBlobFromContainer = async (
  containerName: string,
  blobName: string
): Promise<{ buffer: Buffer; contentType?: string }> => {
  if (!blobServiceClient) {
    throw new Error('Azure Blob Storage client is not initialized');
  }

  try {
    const specificContainerClient = blobServiceClient.getContainerClient(containerName);
    const blobClient = specificContainerClient.getBlobClient(blobName);
    const downloadResponse = await blobClient.download(0);
    const readable = downloadResponse.readableStreamBody;

    if (!readable) {
      throw new Error('Failed to get readable stream from Azure Blob');
    }

    const chunks: Buffer[] = [];

    const buffer = await new Promise<Buffer>((resolve, reject) => {
      readable.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      readable.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
      readable.on('error', reject);
    });

    return {
      buffer,
      contentType: downloadResponse.contentType,
    };
  } catch (error) {
    console.error(`Failed to download Azure Blob '${blobName}' from container '${containerName}':`, error);
    throw error;
  }
};

// Upload file to Azure Blob Storage
export const uploadAzureBlob = async (blobName: string, fileBuffer: Buffer, contentType?: string): Promise<string> => {
  if (!containerClient) {
    throw new Error('Azure Blob Storage client is not initialized');
  }

  try {
    const blobClient = containerClient.getBlockBlobClient(blobName);
    await blobClient.upload(fileBuffer, fileBuffer.length, {
      blobHTTPHeaders: {
        blobContentType: contentType || 'application/octet-stream',
      },
    });

    console.log(`✓ Uploaded blob to Azure: ${blobName}`);
    return blobClient.url;
  } catch (error) {
    console.error(`Failed to upload blob to Azure '${blobName}':`, error);
    throw error;
  }
};

// Delete blob from Azure (using default container)
export const deleteAzureBlob = async (blobName: string): Promise<void> => {
  if (!containerClient) {
    throw new Error('Azure Blob Storage client is not initialized');
  }

  try {
    const blobClient = containerClient.getBlobClient(blobName);
    await blobClient.delete();
    console.log(`✓ Deleted blob from Azure: ${blobName}`);
  } catch (error: any) {
    // Handle "blob not found" errors gracefully (they're not really failures)
    if (error.code === 'BlobNotFound' || error.message?.includes('BlobNotFound')) {
      console.log(`ℹ Blob not found (already deleted or never existed): ${blobName}`);
      return; // Don't throw - this is not an error condition
    }
    
    console.error(`Failed to delete Azure Blob '${blobName}':`, error);
    throw error;
  }
};

// Delete blob from Azure (from a specific container)
export const deleteAzureBlobFromContainer = async (blobName: string, containerName: string): Promise<void> => {
  if (!blobServiceClient) {
    throw new Error('Azure Blob Storage client is not initialized');
  }

  try {
    const specificContainerClient = blobServiceClient.getContainerClient(containerName);
    const blobClient = specificContainerClient.getBlobClient(blobName);
    await blobClient.delete();
    console.log(`✓ Deleted blob from Azure container '${containerName}': ${blobName}`);
  } catch (error: any) {
    // Handle "blob not found" errors gracefully
    if (error.code === 'BlobNotFound' || error.message?.includes('BlobNotFound')) {
      console.log(`ℹ Blob not found in container '${containerName}' (already deleted or never existed): ${blobName}`);
      return; // Don't throw - this is not an error condition
    }

    console.error(`Failed to delete Azure Blob '${blobName}' from container '${containerName}':`, error);
    throw error;
  }
};

// Upload file to a specific Azure Blob Storage container (creates container if not exists)
export const uploadAzureBlobToContainer = async (
  containerName: string,
  blobName: string,
  fileBuffer: Buffer,
  contentType?: string
): Promise<string> => {
  if (!blobServiceClient) {
    throw new Error('Azure Blob Storage client is not initialized');
  }

  try {
    const targetContainer = blobServiceClient.getContainerClient(containerName);
    await targetContainer.createIfNotExists({ access: 'blob' });
    const blobClient = targetContainer.getBlockBlobClient(blobName);
    await blobClient.upload(fileBuffer, fileBuffer.length, {
      blobHTTPHeaders: {
        blobContentType: contentType || 'application/octet-stream',
      },
    });
    console.log(`✓ Uploaded blob to Azure container '${containerName}': ${blobName}`);
    return blobClient.url;
  } catch (error) {
    console.error(`Failed to upload blob to Azure container '${containerName}' - '${blobName}':`, error);
    throw error;
  }
};

// Get blob properties (metadata)
export const getAzureBlobProperties = async (blobName: string): Promise<any> => {
  if (!containerClient) {
    throw new Error('Azure Blob Storage client is not initialized');
  }

  try {
    const blobClient = containerClient.getBlobClient(blobName);
    const properties = await blobClient.getProperties();
    return properties;
  } catch (error) {
    console.error(`Failed to get Azure Blob properties for '${blobName}':`, error);
    throw error;
  }
};

export default {
  initializeAzureClient,
  isAzureConfigured,
  getAzureBlobUrl,
  downloadFromAzureBlobUrl,
  getAzureBlobSasUrl,
  downloadAzureBlob,
  downloadAzureBlobFromContainer,
  uploadAzureBlob,
  uploadAzureBlobToContainer,
  deleteAzureBlob,
  deleteAzureBlobFromContainer,
  getAzureBlobProperties,
};
