# Quick Start - Multiple Photo Upload Implementation

## Step-by-Step Implementation

### Step 1: Database Migration (Required)
```bash
# Run the migration script on your SQL Server database
sqlcmd -S localhost\SQLEXPRESS -d ecommerce -i Scripts\add_primary_image_column.sql
```

Or use SQL Server Management Studio:
1. Open `Scripts/add_primary_image_column.sql`
2. Execute the script
3. Verify no errors

### Step 2: Restart Server
If your server is running, restart it to load the new API routes:
```bash
# Stop any running server processes
# Navigate to server directory
cd server

# Start server
npm start
```

### Step 3: Test in Browser
1. Navigate to product listing page
2. You should see new "📸 Photos" button on each product
3. Create a new product:
   - Go to "Add Product" tab
   - Fill in product details
   - NEW: Select multiple images (up to 10)
   - See preview of selected images
   - Click "Create Product"

### Step 4: View Photos
1. On product listing, click "📸 Photos" button
2. Modal opens with image gallery
3. Use arrows to navigate between images
4. Click thumbnails to jump to specific image
5. Close modal by clicking X or outside modal

---

## File Structure Overview

```
ecomsql/
├── Scripts/
│   ├── add_primary_image_column.sql          [NEW - Database migration]
│   └── ecommerce.sql                          [Existing schema]
│
├── server/
│   ├── routes/
│   │   └── productImages.js                   [ENHANCED - New endpoints]
│   ├── middleware/
│   │   └── upload.js                          [Existing - file upload]
│   └── uploads/                               [Image storage directory]
│
└── client/
    └── src/
        ├── components/
        │   ├── ViewPhotos.js                  [NEW - Photo gallery modal]
        │   ├── ViewPhotos.css                 [NEW - Gallery styles]
        │   ├── ProductUpload.js               [ENHANCED - Multi-upload]
        │   ├── ProductUpload.css              [ENHANCED - New upload UI]
        │   ├── ProductListing.js              [ENHANCED - Photo button]
        │   └── ProductListing.css             [ENHANCED - Button styles]
        └── api.js                             [ENHANCED - New API functions]
```

---

## API Endpoints Reference

### Image Upload/Management
```
POST   /api/product-images/upload/:productId       (single image)
POST   /api/product-images/bulk-upload/:productId  (multiple images, max 10)
GET    /api/product-images/product/:productId      (get all images)
GET    /api/product-images/primary/:productId      (get primary only)
PUT    /api/product-images/:imageId/set-primary    (mark as primary)
PUT    /api/product-images/reorder/:productId      (reorder images)
DELETE /api/product-images/:imageId                (delete image)
```

---

## Component Props Reference

### ViewPhotos Component
```javascript
<ViewPhotos
  productId={123}                    // Product ID
  productName="Product Name"         // Product name for title
  onClose={() => setOpen(false)}     // Close handler
/>
```

### ProductCard Component
- Automatically includes "📸 Photos" button
- Shows primary product image
- Click Photos button opens ViewPhotos modal

---

## Key Features

✅ **Multiple Image Upload**
- Upload 1-10 images to each product
- Bulk upload in one request
- Progress indicator during upload

✅ **Photo Gallery Viewer**
- Full-screen responsive modal
- Navigate with arrows and thumbnails
- See primary image indicator

✅ **Image Management**
- Delete images from gallery
- Mark images as primary
- Reorder images (backend ready)

✅ **Responsive Design**
- Mobile-friendly gallery
- Touch-friendly navigation
- Adapts to all screen sizes

---

## Database Changes Summary

**Table Modified:** `product_images`

**New Columns:**
- `is_primary` (BIT, default 0) - Primary image flag
- `display_order` (INT, default 0) - Display order

**New Indexes:**
- idx_product_images_is_primary - Fast primary image lookup
- idx_product_images_display_order - Fast sorting

**Backward Compatible:** ✅ Existing data preserved, new columns default to 0

---

## Common Issues & Solutions

### Images not uploading
**Solution:** Check browser console for errors, verify file size < 5MB

### ViewPhotos modal won't open
**Solution:** Verify ViewPhotos.js is in components folder and imported in ProductListing.js

### Database migration errors
**Solution:** Run in SQL Server Management Studio with admin privileges

### Images not displaying
**Solution:** Check server/uploads/ folder has proper read permissions

---

## Next Steps (Optional)

Future features you can add:
- Image reordering with drag-and-drop
- Image editing (crop, rotate)
- Admin panel for batch image management
- Image optimization on upload
- CDN integration for image serving

---

## Support Resources

- **Database Migration:** See `Scripts/add_primary_image_column.sql`
- **Backend Documentation:** See `MULTIPLE_PHOTOS_IMPLEMENTATION.md`
- **API Testing:** Use Postman with provided endpoint examples
- **Component Usage:** See ProductUpload.js and ProductListing.js examples

---

**Ready to go!** Follow Step 1-4 above to get started. 🚀
