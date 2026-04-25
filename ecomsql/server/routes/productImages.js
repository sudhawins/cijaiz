const express = require('express');
const { getConnection, sql } = require('../config');
const upload = require('../middleware/upload');
const path = require('path');
const fs = require('fs');
const { verifyToken, checkRole } = require('../middleware/auth');
const router = express.Router();

// Get all images for a product
router.get('/product/:productId', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('productId', sql.Int, req.params.productId)
      .query(`
        SELECT id, product_id, image_url, filename, thumbnail_url, uploaded_at, 
               ISNULL(is_primary, 0) as is_primary, ISNULL(display_order, 0) as display_order
        FROM product_images 
        WHERE product_id = @productId 
        ORDER BY is_primary DESC, display_order ASC
      `);
    
    res.json(result.recordset);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Get primary image for a product
router.get('/primary/:productId', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('productId', sql.Int, req.params.productId)
      .query(`
        SELECT TOP 1 id, product_id, image_url, filename, thumbnail_url, uploaded_at, 
               ISNULL(is_primary, 0) as is_primary
        FROM product_images 
        WHERE product_id = @productId 
        ORDER BY is_primary DESC, uploaded_at DESC
      `);
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'No images found for product' });
    }
    
    res.json(result.recordset[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Upload single product image (Seller/Admin only)
router.post('/upload/:productId', verifyToken, checkRole(['Seller', 'Administrator']), upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const productId = req.params.productId;
    const imageUrl = `/uploads/${req.file.filename}`;
    const isPrimary = req.body.isPrimary === 'true' ? 1 : 0;
    
    // Verify product exists
    const pool = await getConnection();
    const productCheck = await pool.request()
      .input('productId', sql.Int, productId)
      .query('SELECT id FROM products WHERE id = @productId');
    
    if (productCheck.recordset.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Get current image count to set display_order
    const countResult = await pool.request()
      .input('productId', sql.Int, productId)
      .query('SELECT ISNULL(MAX(display_order), 0) + 1 as nextOrder FROM product_images WHERE product_id = @productId');
    
    const displayOrder = countResult.recordset[0].nextOrder;

    // If this is primary, unset other primary images
    if (isPrimary === 1) {
      await pool.request()
        .input('productId', sql.Int, productId)
        .query(`
          UPDATE product_images 
          SET is_primary = 0 
          WHERE product_id = @productId AND is_primary = 1
        `);
    }

    // Insert image record
    const result = await pool.request()
      .input('productId', sql.Int, productId)
      .input('imageUrl', sql.NVarChar, imageUrl)
      .input('filename', sql.NVarChar, req.file.filename)
      .input('isPrimary', sql.Bit, isPrimary)
      .input('displayOrder', sql.Int, displayOrder)
      .query(`
        INSERT INTO product_images (product_id, image_url, filename, is_primary, display_order)
        OUTPUT INSERTED.id, INSERTED.product_id, INSERTED.image_url, INSERTED.filename, 
               INSERTED.thumbnail_url, INSERTED.uploaded_at, INSERTED.is_primary, INSERTED.display_order
        VALUES (@productId, @imageUrl, @filename, @isPrimary, @displayOrder)
      `);
    
    res.status(201).json(result.recordset[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Bulk upload multiple images (Seller/Admin only)
router.post('/bulk-upload/:productId', verifyToken, checkRole(['Seller', 'Administrator']), upload.array('images', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const productId = req.params.productId;
    const pool = await getConnection();
    
    // Verify product exists
    const productCheck = await pool.request()
      .input('productId', sql.Int, productId)
      .query('SELECT id FROM products WHERE id = @productId');
    
    if (productCheck.recordset.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Get current max display_order
    const countResult = await pool.request()
      .input('productId', sql.Int, productId)
      .query('SELECT ISNULL(MAX(display_order), 0) as maxOrder FROM product_images WHERE product_id = @productId');
    
    let displayOrder = countResult.recordset[0].maxOrder;
    const uploadedImages = [];

    // Insert all images
    for (const file of req.files) {
      displayOrder++;
      const imageUrl = `/uploads/${file.filename}`;
      
      const result = await pool.request()
        .input('productId', sql.Int, productId)
        .input('imageUrl', sql.NVarChar, imageUrl)
        .input('filename', sql.NVarChar, file.filename)
        .input('displayOrder', sql.Int, displayOrder)
        .query(`
          INSERT INTO product_images (product_id, image_url, filename, display_order, is_primary)
          OUTPUT INSERTED.id, INSERTED.product_id, INSERTED.image_url, INSERTED.filename, 
                 INSERTED.thumbnail_url, INSERTED.uploaded_at, ISNULL(INSERTED.is_primary, 0) as is_primary, INSERTED.display_order
          VALUES (@productId, @imageUrl, @filename, @displayOrder, 0)
        `);
      
      uploadedImages.push(result.recordset[0]);
    }
    
    res.status(201).json({ 
      message: `Successfully uploaded ${uploadedImages.length} images`,
      images: uploadedImages 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Delete product image (Seller/Admin only)
router.delete('/:imageId', verifyToken, checkRole(['Seller', 'Administrator']), async (req, res) => {
  try {
    const pool = await getConnection();
    
    // Get image
    const imageResult = await pool.request()
      .input('imageId', sql.Int, req.params.imageId)
      .query(`
        SELECT pi.filename, pi.product_id 
        FROM product_images pi
        WHERE pi.id = @imageId
      `);
    
    if (imageResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    const image = imageResult.recordset[0];

    // Delete from database
    await pool.request()
      .input('imageId', sql.Int, req.params.imageId)
      .query('DELETE FROM product_images WHERE id = @imageId');
    
    // Delete from filesystem
    const filePath = path.join(__dirname, '../uploads', image.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    res.json({ message: 'Image deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Set image as primary
router.put('/:imageId/set-primary', async (req, res) => {
  try {
    const pool = await getConnection();
    
    // Get product_id from image
    const imageResult = await pool.request()
      .input('imageId', sql.Int, req.params.imageId)
      .query('SELECT product_id FROM product_images WHERE id = @imageId');
    
    if (imageResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Image not found' });
    }

    const productId = imageResult.recordset[0].product_id;

    // Unset all other primary images for this product
    await pool.request()
      .input('productId', sql.Int, productId)
      .query(`
        UPDATE product_images 
        SET is_primary = 0 
        WHERE product_id = @productId AND is_primary = 1
      `);

    // Set this image as primary
    const result = await pool.request()
      .input('imageId', sql.Int, req.params.imageId)
      .query(`
        UPDATE product_images 
        SET is_primary = 1 
        OUTPUT INSERTED.id, INSERTED.product_id, INSERTED.image_url, INSERTED.filename, 
               INSERTED.thumbnail_url, INSERTED.uploaded_at, INSERTED.is_primary, INSERTED.display_order
        WHERE id = @imageId
      `);
    
    res.json(result.recordset[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Update display order for images
router.put('/reorder/:productId', async (req, res) => {
  try {
    const { imageOrder } = req.body; // Array of { id, display_order }
    
    if (!Array.isArray(imageOrder) || imageOrder.length === 0) {
      return res.status(400).json({ error: 'Invalid image order' });
    }

    const pool = await getConnection();
    
    // Update display order for all images
    for (const item of imageOrder) {
      await pool.request()
        .input('id', sql.Int, item.id)
        .input('order', sql.Int, item.display_order)
        .query(`
          UPDATE product_images 
          SET display_order = @order 
          WHERE id = @id
        `);
    }
    
    res.json({ message: 'Image order updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
