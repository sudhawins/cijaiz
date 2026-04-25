# Multiple Photo Uploads for Products - Implementation Guide

## Overview
This implementation adds comprehensive support for uploading and viewing multiple product photos with an enhanced photo gallery interface.

## Changes Made

### 1. **Database Schema Enhancement**
**File:** [Scripts/add_primary_image_column.sql](Scripts/add_primary_image_column.sql)

New columns added to `product_images` table:
- `is_primary (BIT)` - Flags the primary/featured image for a product
- `display_order (INT)` - Custom ordering for image gallery display

**Features:**
- Automatically marks first image as primary
- Supports custom image ordering for galleries
- Optimized indexes for faster queries

**To Apply Migration:**
```sql
-- Run this script on your SQL Server database
sqlcmd -S YOUR_SERVER -d YOUR_DB -i Scripts\add_primary_image_column.sql
```

---

### 2. **Backend API Enhancements**
**File:** [server/routes/productImages.js](server/routes/productImages.js)

**New/Enhanced Endpoints:**

#### Get All Images for Product
```
GET /api/product-images/product/:productId
```
Returns all images sorted by primary, then display order.

#### Get Primary Image
```
GET /api/product-images/primary/:productId
```
Returns only the primary/featured image.

#### Upload Single Image
```
POST /api/product-images/upload/:productId
```
**Request:** multipart/form-data
- `image` - image file
- `isPrimary` (optional) - set as primary image (true/false)

#### Bulk Upload Multiple Images
```
POST /api/product-images/bulk-upload/:productId
```
**Request:** multipart/form-data
- `images` - multiple image files (max 10)

**Response:** Array of uploaded images with metadata

#### Set Image as Primary
```
PUT /api/product-images/:imageId/set-primary
```
Sets the image as primary and unsets others for the same product.

#### Reorder Images
```
PUT /api/product-images/reorder/:productId
```
**Request Body:**
```json
{
  "imageOrder": [
    { "id": 1, "display_order": 1 },
    { "id": 2, "display_order": 2 }
  ]
}
```

#### Delete Image
```
DELETE /api/product-images/:imageId
```
Deletes image from database and filesystem.

---

### 3. **Frontend Components**

#### New Component: ViewPhotos Modal
**File:** [client/src/components/ViewPhotos.js](client/src/components/ViewPhotos.js)

**Features:**
- Full-screen image gallery modal
- Main image display with navigation
- Thumbnail strip for quick selection
- Primary image indicator (★)
- Image deletion from modal
- Responsive design for mobile
- Upload date display

**Props:**
```javascript
<ViewPhotos
  productId={productId}
  productName={productName}
  onClose={onCloseHandler}
/>
```

**Styling:** [client/src/components/ViewPhotos.css](client/src/components/ViewPhotos.css)

---

#### Updated: ProductUpload Component
**File:** [client/src/components/ProductUpload.js](client/src/components/ProductUpload.js)

**New Features:**
- **Multi-image upload** - Select up to 10 images when creating a product
- **Image previews** - See selected images before submission
- **Upload progress** - Visual progress bar during image upload
- **Bulk upload** - All images uploaded in single operation
- **Error handling** - User-friendly error messages

**Usage:**
1. Create a new product with basic details
2. Select multiple images (JPG, PNG, GIF, WebP)
3. View image previews
4. Remove unwanted images from preview
5. Click "Create Product" to upload everything

**Styling:** [client/src/components/ProductUpload.css](client/src/components/ProductUpload.css) (Enhanced)

---

#### Updated: ProductListing Component
**File:** [client/src/components/ProductListing.js](client/src/components/ProductListing.js)

**New Features:**
- **"📸 Photos" Button** - New action button in product cards
- **Photo viewer integration** - Click to open ViewPhotos modal
- **Two-action layout** - "Add to Cart" and "View Photos" buttons

**Styling:** [client/src/components/ProductListing.css](client/src/components/ProductListing.css) (Enhanced)

---

### 4. **API Client Functions**
**File:** [client/src/api.js](client/src/api.js)

**New Functions Added:**

```javascript
// Get all images for a product
getProductImages(productId)

// Get primary image only
getPrimaryImage(productId)

// Upload single image
uploadProductImage(productId, file)

// Upload multiple images (bulk)
uploadProductImages(productId, files)

// Delete an image
deleteProductImage(imageId)

// Set image as primary
setProductImagePrimary(imageId)

// Reorder images
reorderProductImages(productId, imageOrder)
```

---

## Workflow Examples

### Creating a Product with Multiple Images
```javascript
1. User fills in product details (name, price, category, etc.)
2. User selects 1-10 images via file input
3. System shows image previews
4. User confirms and submits
5. API creates product first (returns productId)
6. API uploads all images to the product
7. User gets success notification with image count
```

### Viewing Product Photos
```javascript
1. User clicks "📸 Photos" button on product card
2. ViewPhotos modal opens
3. Shows main image with navigation controls
4. Shows thumbnail strip below/beside main image
5. User can:
   - Navigate with arrow buttons
   - Click thumbnails to jump to image
   - Delete individual images
   - See which is primary (★ indicator)
6. User closes modal to return to listing
```

### Managing Images (Future Admin Panel)
```javascript
// Set image as primary
setProductImagePrimary(imageId)

// Reorder images (via drag-and-drop)
reorderProductImages(productId, imageOrder)

// Upload additional images
uploadProductImages(productId, newFiles)

// Delete images
deleteProductImage(imageId)
```

---

## Configuration

### Environment Variables
No new environment variables required. Existing setup:
- `MAX_FILE_SIZE` - Default 5MB (can be configured in [server/middleware/upload.js](server/middleware/upload.js))
- Supported formats: JPG, PNG, GIF, WebP
- Max images per upload: 10

### Upload Directory
Images are stored in: `server/uploads/`
- Auto-created if doesn't exist
- Files are named: `product-{timestamp}-{random}.{ext}`

---

## Database Backup

Before applying migration, backup your database:
```sql
BACKUP DATABASE [your_database_name]
TO DISK = 'C:\backup\ecommerce_backup.bak'
WITH INIT;
```

---

## Testing Checklist

- [ ] Run database migration script
- [ ] Create a new product with multiple images (3-5)
- [ ] Verify images appear in product listing
- [ ] Click "📸 Photos" button to open gallery
- [ ] Navigate images with arrows and thumbnails
- [ ] Delete an image and verify refresh
- [ ] View product images on different screen sizes (mobile, tablet, desktop)
- [ ] Search/filter products to verify images still load
- [ ] Test with different image formats

---

## Performance Notes

1. **Image Loading:** Lazy loading used for product list images
2. **Caching:** GET requests cached for 5 minutes
3. **Indexing:** Optimized indexes added for:
   - `product_id` + `is_primary` lookup
   - `product_id` + `display_order` sorting

---

## Future Enhancements

Potential features to add:
- Image reordering via drag-and-drop in ViewPhotos
- Image editing (crop, rotate, compress)
- Admin panel for managing product images
- Image alt-text / descriptions per image
- Thumbnail generation for faster loading
- Image optimization on upload

---

## Troubleshooting

### Images not uploading
- Check file size (max 5MB)
- Check supported formats (JPG, PNG, GIF, WebP)
- Verify `server/uploads/` directory has write permissions

### ViewPhotos modal not opening
- Check browser console for errors
- Verify product has images in database
- Ensure ViewPhotos component is imported in ProductListing

### Database migration fails
- Ensure SQL Server connection string is correct
- Check if columns already exist
- Review migration script error messages

---

## Files Modified/Created

**Created:**
- Scripts/add_primary_image_column.sql
- client/src/components/ViewPhotos.js
- client/src/components/ViewPhotos.css

**Modified:**
- server/routes/productImages.js (enhanced)
- client/src/components/ProductUpload.js (enhanced)
- client/src/components/ProductUpload.css (enhanced)
- client/src/components/ProductListing.js (enhanced)
- client/src/components/ProductListing.css (enhanced)
- client/src/api.js (new functions added)

---

## Support

For issues or questions:
1. Check the browser console for client errors
2. Check server logs for API errors
3. Verify database connection and schema
4. Review this implementation guide

---

**Implementation Date:** March 3, 2026
**Version:** 1.0
