-- Add support for primary image designation in product_images table
-- This migration script adds an is_primary column to track which image is the main product image

-- Step 1: Add is_primary column if it doesn't exist
IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'product_images' 
    AND COLUMN_NAME = 'is_primary'
)
BEGIN
    ALTER TABLE product_images
    ADD is_primary BIT DEFAULT 0;
    
    PRINT 'Added is_primary column to product_images table';
END;

-- Step 2: Update existing products to mark their first image as primary
UPDATE pi
SET is_primary = 1
FROM product_images pi
INNER JOIN (
    SELECT product_id, MIN(id) as first_image_id
    FROM product_images
    GROUP BY product_id
) first_images
ON pi.id = first_images.first_image_id
WHERE pi.is_primary = 0;

PRINT 'Updated existing images to mark the first image as primary';

-- Step 3: Add display_order column for custom image ordering
IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'product_images' 
    AND COLUMN_NAME = 'display_order'
)
BEGIN
    ALTER TABLE product_images
    ADD display_order INT DEFAULT 0;
    
    PRINT 'Added display_order column to product_images table';
END;

-- Step 4: Set display_order based on upload order
UPDATE product_images
SET display_order = ROW_NUMBER() OVER (PARTITION BY product_id ORDER BY uploaded_at ASC)
WHERE display_order = 0;

PRINT 'Updated display_order for all product images';

-- Step 5: Add index on is_primary for faster queries
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_product_images_is_primary' AND object_id = OBJECT_ID('product_images'))
    CREATE INDEX idx_product_images_is_primary ON product_images(product_id, is_primary)
    WHERE is_primary = 1;

PRINT 'Added index for is_primary column';

-- Step 6: Add index on display_order for sorting
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_product_images_display_order' AND object_id = OBJECT_ID('product_images'))
    CREATE INDEX idx_product_images_display_order ON product_images(product_id, display_order);

PRINT 'Added index for display_order column';

PRINT 'Migration complete: Product images table enhanced successfully';
