# Database & API Testing Guide

## Useful SQL Queries

### Check Product Images with New Columns
```sql
-- View all product images with new columns
SELECT 
    pi.id,
    pi.product_id,
    p.name as product_name,
    pi.filename,
    pi.is_primary,
    pi.display_order,
    pi.uploaded_at
FROM product_images pi
INNER JOIN products p ON pi.product_id = p.id
ORDER BY pi.product_id, pi.display_order;
```

### View Primary Images Only
```sql
-- Get primary image for each product
SELECT 
    p.id,
    p.name,
    pi.image_url,
    pi.filename,
    pi.uploaded_at
FROM products p
LEFT JOIN product_images pi ON p.id = pi.product_id 
    AND pi.is_primary = 1
WHERE p.id IN (SELECT DISTINCT product_id FROM product_images)
ORDER BY p.id;
```

### Image Count per Product
```sql
-- Count images per product
SELECT 
    p.id,
    p.name,
    COUNT(pi.id) as image_count,
    SUM(CASE WHEN pi.is_primary = 1 THEN 1 ELSE 0 END) as primary_count
FROM products p
LEFT JOIN product_images pi ON p.id = pi.product_id
GROUP BY p.id, p.name
ORDER BY image_count DESC;
```

### Find Products Without Primary Image
```sql
-- Identify products with multiple images but no primary
SELECT 
    p.id,
    p.name,
    COUNT(pi.id) as image_count
FROM products p
INNER JOIN product_images pi ON p.id = pi.product_id
GROUP BY p.id, p.name
HAVING COUNT(pi.id) > 0 
    AND NOT EXISTS (
        SELECT 1 FROM product_images 
        WHERE product_id = p.id AND is_primary = 1
    );
```

### Update Display Order for Product
```sql
-- Update display order for all images of a product
-- (In case reorder endpoint wasn't used)
DECLARE @productId INT = 1;

WITH Ordered AS (
    SELECT id, 
           ROW_NUMBER() OVER (PARTITION BY product_id ORDER BY uploaded_at) as new_order
    FROM product_images
    WHERE product_id = @productId
)
UPDATE pi
SET pi.display_order = o.new_order
FROM product_images pi
INNER JOIN Ordered o ON pi.id = o.id;
```

---

## API Testing Examples

### Using cURL

#### Test: Upload Multiple Images
```bash
curl -X POST http://localhost:5000/api/product-images/bulk-upload/1 \
  -F "images=@image1.jpg" \
  -F "images=@image2.png" \
  -F "images=@image3.jpg"
```

#### Test: Get All Images for Product
```bash
curl http://localhost:5000/api/product-images/product/1
```

#### Test: Get Primary Image
```bash
curl http://localhost:5000/api/product-images/primary/1
```

#### Test: Set Primary Image
```bash
curl -X PUT http://localhost:5000/api/product-images/5/set-primary
```

#### Test: Delete Image
```bash
curl -X DELETE http://localhost:5000/api/product-images/5
```

#### Test: Reorder Images
```bash
curl -X PUT http://localhost:5000/api/product-images/reorder/1 \
  -H "Content-Type: application/json" \
  -d '{
    "imageOrder": [
      {"id": 1, "display_order": 3},
      {"id": 2, "display_order": 1},
      {"id": 3, "display_order": 2}
    ]
  }'
```

---

### Using Postman

#### Collection Setup
1. Create new Postman Collection: "Product Images API"
2. Create environment variables:
   - `baseUrl` = `http://localhost:5000`
   - `productId` = `1`
   - `imageId` = `1`

#### Request 1: Get All Images
```
GET {{baseUrl}}/api/product-images/product/{{productId}}
```

#### Request 2: Upload Images
```
POST {{baseUrl}}/api/product-images/bulk-upload/{{productId}}

Body:
- form-data
- Key: images (type: File)
- Select multiple image files
```

#### Request 3: Get Primary Image
```
GET {{baseUrl}}/api/product-images/primary/{{productId}}
```

#### Request 4: Set Primary Image
```
PUT {{baseUrl}}/api/product-images/{{imageId}}/set-primary
```

#### Request 5: Delete Image
```
DELETE {{baseUrl}}/api/product-images/{{imageId}}
```

#### Request 6: Reorder Images
```
PUT {{baseUrl}}/api/product-images/reorder/{{productId}}

Headers:
- Content-Type: application/json

Body (raw JSON):
{
  "imageOrder": [
    {"id": 1, "display_order": 2},
    {"id": 2, "display_order": 1},
    {"id": 3, "display_order": 3}
  ]
}
```

---

## Browser Console Testing

### Test ViewPhotos Component
```javascript
// In browser console on product listing page

// Navigate to product
// Click on "📸 Photos" button

// Should see ViewPhotos modal open
// Check console for any errors

// Test image navigation
document.querySelector('.nav-btn.next-btn').click();
document.querySelector('.nav-btn.prev-btn').click();

// Should navigate between images without errors
```

### Test Image Upload Progress
```javascript
// In browser console on ProductUpload page

// Select multiple images (3-5)
// Click "Create Product"

// Watch upload progress
document.querySelector('.progress-fill').style.width
// Should increase from 0% to 100%
```

---

## Performance Testing

### Load Test: Get Images for Product with Many Images
```sql
-- Check response time for product with 10 images
SET STATISTICS TIME ON;

SELECT * FROM product_images 
WHERE product_id = 1 
ORDER BY is_primary DESC, display_order ASC;

SET STATISTICS TIME OFF;
```

### Index Usage Check
```sql
-- Verify indexes are being used
SET STATISTICS IO ON;

SELECT pi.* 
FROM product_images pi
WHERE pi.product_id = 1 AND pi.is_primary = 1;

SET STATISTICS IO OFF;
-- Should show index seek, not table scan
```

---

## Data Cleanup (if needed)

### Reset All Product Images
```sql
-- WARNING: This deletes all product images!
-- Backup your database first

DELETE FROM product_images;

-- Reset identity seed
DBCC CHECKIDENT ('product_images', RESEED, 0);
```

### Remove Images for Specific Product
```sql
-- Delete all images for product ID 1
DELETE FROM product_images WHERE product_id = 1;
```

### Clear Orphaned Images
```sql
-- Delete images for non-existent products
DELETE FROM product_images 
WHERE product_id NOT IN (SELECT id FROM products);
```

---

## Monitoring & Diagnostics

### Check Disk Usage by Images
```sql
-- Estimate disk usage for images
SELECT 
    COUNT(*) as total_images,
    SUM(DATALENGTH(image_url) + DATALENGTH(filename)) as estimated_db_size_bytes
FROM product_images;
```

### Find Unused Uploads Directory Files
```powershell
# PowerShell script to find orphaned image files
$uploadDir = "C:\path\to\server\uploads"
$dbFiles = Get-Content "database_filenames.txt" # Export from SQL

Get-ChildItem $uploadDir | Where-Object {
    $_.Name -notin $dbFiles
} | Select-Object Name, LastWriteTime
```

### API Response Time Monitoring
```javascript
// In browser console
const timings = {
  getImages: 0,
  uploadImages: 0,
  deleteImage: 0
};

// Wrap API calls to measure
const originalFetch = window.fetch;
window.fetch = function(...args) {
  const start = performance.now();
  return originalFetch.apply(this, args)
    .then(r => {
      const time = performance.now() - start;
      console.log(`Request to ${args[0]}: ${time.toFixed(2)}ms`);
      return r;
    });
};
```

---

## Troubleshooting Checklist

- [ ] Database migration completed successfully
- [ ] `product_images.is_primary` column exists
- [ ] `product_images.display_order` column exists
- [ ] Indexes created on new columns
- [ ] Server restarted after code changes
- [ ] ViewPhotos.js in components folder
- [ ] ViewPhotos imported in ProductListing.js
- [ ] API endpoints responding to GET/POST/PUT/DELETE
- [ ] Images uploading to server/uploads folder
- [ ] File permissions allow creating/deleting files
- [ ] Product images display in product listing

---

## Sample Test Data

### Create Test Product with Images
```sql
-- Create test product
INSERT INTO products (name, description, category_id, price, stock, sku)
VALUES ('Test Product with Photos', 'Sample product for testing multiple images', 1, 99.99, 10, 'TEST-PHOTOS-001');

-- Get inserted product ID
DECLARE @productId INT = SCOPE_IDENTITY();

-- Insert sample images
INSERT INTO product_images (product_id, image_url, filename, is_primary, display_order)
VALUES 
    (@productId, '/uploads/product-test-1.jpg', 'product-test-1.jpg', 1, 1),
    (@productId, '/uploads/product-test-2.jpg', 'product-test-2.jpg', 0, 2),
    (@productId, '/uploads/product-test-3.jpg', 'product-test-3.jpg', 0, 3);
```

---

**Last Updated:** March 3, 2026
**API Version:** 1.0
