# Azure Fallback Testing Guide

## Prerequisites

- Backend running on `http://localhost:5002` (adjust port if different)
- `curl` command available
- `jq` for JSON formatting (optional)

## Test Scenarios

### 1. Get Photo from Local Storage

**Scenario:** Photo exists in `/tenantphotos/` directory

```bash
# Get photo URL
curl "http://localhost:5002/api/tenants/1/main-photo/azure?format=url" | jq .

# Expected response:
{
  "photoUrl": "/api/tenantphotos/photo.jpg",
  "fileName": "photo.jpg",
  "source": "local",
  "tenantName": "John Doe"
}
```

### 2. Get Photo from Azure Fallback

**Scenario:** Photo NOT in local storage, but exists in Azure

```bash
# Get photo from Azure fallback
curl "http://localhost:5002/api/tenants/2/main-photo/azure?format=url" | jq .

# Expected response:
{
  "photoUrl": "https://complexstore.blob.core.windows.net/proofs/cb705263-e88f-443e-a05e-636abe6f0c11_IMG_20260318_132403.jpg",
  "fileName": "cb705263-e88f-443e-a05e-636abe6f0c11_IMG_20260318_132403.jpg",
  "source": "azure",
  "tenantName": "K.Hemanathan"
}
```

### 3. Download Photo Blob (Local)

**Scenario:** Stream photo directly from local storage

```bash
# Download and save photo
curl "http://localhost:5002/api/tenants/1/main-photo/azure" \
  -o my_photo.jpg

# Check where it came from
curl -I "http://localhost:5002/api/tenants/1/main-photo/azure" | grep X-Photo-Source
# Output: X-Photo-Source: local
```

### 4. Download Photo Blob (Azure)

**Scenario:** Stream photo directly from Azure

```bash
# Download from Azure
curl "http://localhost:5002/api/tenants/2/main-photo/azure" \
  -o my_photo.jpg

# Check source header
curl -I "http://localhost:5002/api/tenants/2/main-photo/azure" | grep X-Photo-Source
# Output: X-Photo-Source: azure
```

### 5. Test Non-Existent Tenant

```bash
curl "http://localhost:5002/api/tenants/99999/main-photo/azure?format=url" | jq .

# Expected response:
{
  "error": "Tenant not found"
}
```

### 6. Test Missing Photo (Not in Local or Azure)

```bash
curl "http://localhost:5002/api/tenants/3/main-photo/azure?format=url" | jq .

# Expected response:
{
  "error": "Photo not found",
  "details": "Photo not found in local storage or Azure Blob Storage for tenant: Jane Smith",
  "fileName": "missing_photo.jpg",
  "tenantId": "3"
}
```

## Testing with cURL Headers

### Get Response Headers
```bash
# Show all response headers (including X-Photo-Source)
curl -i "http://localhost:5002/api/tenants/1/main-photo/azure?format=url"
```

### Test Different Content Types
```bash
# Check Content-Type header
curl -D - "http://localhost:5002/api/tenants/1/main-photo/azure" -o /dev/null

# Should show:
# Content-Type: image/jpeg
```

### Get HTTP Status Code
```bash
# Get only the status code
curl -s -o /dev/null -w "%{http_code}" "http://localhost:5002/api/tenants/1/main-photo/azure"

# Expected output:
# 200 (success)
# 404 (not found)
# 500 (server error)
```

## Batch Testing

### Test Multiple Tenants

```bash
#!/bin/bash
# Test script to check multiple tenants

for tenant_id in {1..10}; do
  echo "Testing tenant $tenant_id..."
  response=$(curl -s "http://localhost:5002/api/tenants/$tenant_id/main-photo/azure?format=url")
  source=$(echo $response | jq -r '.source // "ERROR"')
  name=$(echo $response | jq -r '.tenantName // "NOT FOUND"')
  echo "  Source: $source, Name: $name"
done
```

## PowerShell Testing

### Using PowerShell Instead of curl

```powershell
# Get photo URL using PowerShell
$response = Invoke-WebRequest -Uri "http://localhost:5002/api/tenants/1/main-photo/azure?format=url"
$json = $response.Content | ConvertFrom-Json
$json | Format-Table

# Output photo source
Write-Host "Photo source: $($json.source)"
```

### PowerShell Batch Test

```powershell
# Test multiple tenants
for ($i = 1; $i -le 10; $i++) {
    $response = Invoke-WebRequest -Uri "http://localhost:5002/api/tenants/$i/main-photo/azure?format=url" -ErrorAction SilentlyContinue
    if ($response -and $response.StatusCode -eq 200) {
        $json = $response.Content | ConvertFrom-Json
        Write-Host "Tenant $i: source=$($json.source), name=$($json.tenantName)"
    }
}
```

## JavaScript/Fetch Testing

### Test from Browser Console

```javascript
// Fetch photo URL
const tenantId = 1;
fetch(`/api/tenants/${tenantId}/main-photo/azure?format=url`)
  .then(r => r.json())
  .then(data => {
    console.log('Photo source:', data.source);
    console.log('Photo URL:', data.photoUrl);
    console.log('Tenant:', data.tenantName);
  })
  .catch(err => console.error('Error:', err));
```

## Postman Testing

### Import as Postman Collection

```json
{
  "info": {
    "name": "Azure Fallback Tests",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Get Photo URL - Local",
      "request": {
        "method": "GET",
        "url": "http://localhost:5002/api/tenants/1/main-photo/azure?format=url"
      }
    },
    {
      "name": "Get Photo URL - Azure",
      "request": {
        "method": "GET",
        "url": "http://localhost:5002/api/tenants/2/main-photo/azure?format=url"
      }
    },
    {
      "name": "Download Photo Blob",
      "request": {
        "method": "GET",
        "url": "http://localhost:5002/api/tenants/1/main-photo/azure"
      }
    }
  ]
}
```

## Performance Testing

### Test Response Time

```bash
# Measure response time
time curl "http://localhost:5002/api/tenants/1/main-photo/azure?format=url" -s -o /dev/null

# Local storage should be <50ms
# Azure fallback should be <1000ms
```

### Load Testing with Apache Bench

```bash
# Install: brew install httpd (macOS) or apt-get install apache2-utils (Linux)

# Test 100 requests with 10 concurrent
ab -n 100 -c 10 "http://localhost:5002/api/tenants/1/main-photo/azure?format=url"
```

## Debugging

### Enable Verbose cURL Output

```bash
# See all request/response details
curl -v "http://localhost:5002/api/tenants/1/main-photo/azure?format=url"

# Shows:
# > GET /api/tenants/1/main-photo/azure?format=url HTTP/1.1
# < HTTP/1.1 200 OK
# < Content-Type: application/json
# < X-Photo-Source: local
```

### Check Network Issues

```bash
# Test connectivity to Azure
curl -I "https://complexstore.blob.core.windows.net/proofs/test.jpg"

# Test backend connectivity
curl -I "http://localhost:5002/api/health"
```

### Verify Backend Logs

```bash
# From backend terminal, you should see:
# ✓ Loaded photo from local storage: photo.jpg
# OR
# ✓ Loaded photo from Azure Blob Storage: photo.jpg
# OR
# Could not load from local storage: File not found
```

## Automation Scripts

### Bash Script - Check All Tenants

```bash
#!/bin/bash
# check_all_photos.sh

API_URL="http://localhost:5002/api/tenants"

echo "Tenant ID | Name             | Source | Status"
echo "----------|------------------|--------|--------"

for tenant_id in $(seq 1 100); do
  response=$(curl -s "$API_URL/$tenant_id/main-photo/azure?format=url")
  
  if echo "$response" | jq -e '.photoUrl' > /dev/null 2>&1; then
    name=$(echo "$response" | jq -r '.tenantName')
    source=$(echo "$response" | jq -r '.source')
    printf "%-9d | %-16s | %-6s | ✓\n" "$tenant_id" "$name" "$source"
  fi
done
```

### Python Script - Test and Log Results

```python
#!/usr/bin/env python3
import requests
import json
from datetime import datetime

API_URL = "http://localhost:5002/api/tenants"
LOG_FILE = "photo_test_results.log"

def test_tenant(tenant_id):
    try:
        response = requests.get(f"{API_URL}/{tenant_id}/main-photo/azure?format=url")
        if response.status_code == 200:
            data = response.json()
            return {
                'tenant_id': tenant_id,
                'source': data.get('source'),
                'name': data.get('tenantName'),
                'status': 'success'
            }
        else:
            return {
                'tenant_id': tenant_id,
                'status': 'not_found',
                'code': response.status_code
            }
    except Exception as e:
        return {
            'tenant_id': tenant_id,
            'status': 'error',
            'error': str(e)
        }

# Test tenants 1-100
results = []
for i in range(1, 101):
    results.append(test_tenant(i))

# Save results
with open(LOG_FILE, 'w') as f:
    f.write(f"Photo Test Results - {datetime.now()}\n")
    f.write("=" * 60 + "\n")
    for result in results:
        f.write(json.dumps(result) + "\n")

print(f"Results saved to {LOG_FILE}")
```

## Expected Outputs Checklist

- [ ] Local photo returns: `"source": "local"`
- [ ] Azure photo returns: `"source": "azure"`
- [ ] Missing photo returns: 404 status code
- [ ] Blob responses include: `X-Photo-Source` header
- [ ] URL responses include: `photoUrl`, `fileName`, `source`, `tenantName`
- [ ] Response time for local: <50ms
- [ ] Response time for Azure: <1000ms
- [ ] Backend logs show loading messages

## Common Issues & Fixes

### Issue: Always Returns 404
```
Solution: Check that photos exist in either:
- /tenantphotos/ directory (local)
- https://complexstore.blob.core.windows.net/proofs/ (Azure)
```

### Issue: Always Uses Local, Never Falls Back to Azure
```
Solution:
1. Verify AZURE_BLOB_URL is set correctly
2. Manually test Azure URL in browser
3. Check backend logs for "Could not load from Azure"
```

### Issue: Slow Response Times
```
Solution:
1. Local photos: Check disk I/O, should be <50ms
2. Azure photos: Check network latency, expect ~100-500ms
3. Consider caching URLs for frequently accessed photos
```

## Success Indicators

After successful testing, you should see:
- ✅ Local photos load instantly (<50ms)
- ✅ Azure photos load with fallback (<1000ms total)
- ✅ Source correctly identified in response
- ✅ Headers show correct source
- ✅ No 500 errors
- ✅ Backend logs show "✓ Loaded photo from..."
