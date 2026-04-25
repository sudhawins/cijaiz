const express = require('express');
const { getConnection, sql } = require('../config');
const { verifyToken, checkRole, optionalAuth } = require('../middleware/auth');
const router = express.Router();

// Get all products with category info and first image
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { categoryId, search, sellerOnly, page = 1, limit = 20 } = req.query;
    const pool = await getConnection();
    
    console.log('[PRODUCTS] ========== REQUEST RECEIVED ==========');
    console.log('[PRODUCTS] Query params:', { categoryId, search, sellerOnly, page, limit });
    console.log('[PRODUCTS] Auth status:', req.user ? 'AUTHENTICATED' : 'NOT AUTHENTICATED');
    if (req.user) {
      console.log('[PRODUCTS] User details:', { 
        userId: req.user.userId, 
        userName: req.user.userName,
        roleType: req.user.roleType 
      });
    }
    console.log('[PRODUCTS] Authorization header:', req.headers.authorization ? 'PRESENT' : 'MISSING');
    
    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset = (pageNum - 1) * pageSize;
    
    let query = `
      SELECT p.id, p.name, p.description, p.category_id, p.subcategory_id, p.price, p.stock, p.sku, p.weight_kg, p.model_number, p.seller_id,
             p.is_preorder, p.preorder_release_date,
             p.created_at, p.updated_at, c.name as category_name, s.name as subcategory_name,
             (SELECT TOP 1 image_url FROM product_images WHERE product_id = p.id ORDER BY uploaded_at DESC) as image_url
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN subcategories s ON p.subcategory_id = s.id
      WHERE 1=1
    `;
    
    const request = pool.request();
    
    // Filter by seller if requested (requires token)
    if (sellerOnly === 'true' && req.user?.userId) {
      query += ` AND p.seller_id = @sellerId`;
      request.input('sellerId', sql.Int, req.user.userId);
      console.log('[PRODUCTS] ✓ FILTERING BY SELLER - seller_id:', req.user.userId);
    } else if (sellerOnly === 'true') {
      console.log('[PRODUCTS] ✗ CANNOT FILTER BY SELLER - sellerOnly=true but req.user not set');
      console.log('[PRODUCTS]   Reason:', req.user ? 'req.user missing userId' : 'req.user is null/undefined');
    }
    
    if (categoryId) {
      query += ` AND p.category_id = @categoryId`;
      request.input('categoryId', sql.Int, categoryId);
    }
    
    // Optimize search: check if search term is at least 2 characters
    if (search && search.trim().length >= 2) {
      query += ` AND (p.name LIKE @search OR p.description LIKE @search OR s.name LIKE @search)`;
      request.input('search', sql.NVarChar, `%${search.trim()}%`);
    }
    
    // Add pagination
    query += ` ORDER BY p.created_at DESC OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`;
    request.input('offset', sql.Int, offset);
    request.input('pageSize', sql.Int, pageSize);
    
    console.log('[DEBUG] Fetching products - Page:', pageNum, 'Size:', pageSize);
    console.log('[DEBUG] Parameters:', { categoryId, search: search?.trim(), sellerOnly, page: pageNum, limit: pageSize });
    
    const result = await request.query(query);
    
    // Get total count for pagination info
    let countQuery = `SELECT COUNT(*) as total FROM products p LEFT JOIN subcategories s ON p.subcategory_id = s.id WHERE 1=1`;
    const countRequest = pool.request();
    
    if (sellerOnly === 'true' && req.user?.userId) {
      countQuery += ` AND p.seller_id = @sellerId`;
      countRequest.input('sellerId', sql.Int, req.user.userId);
    }
    
    if (categoryId) {
      countQuery += ` AND p.category_id = @categoryId`;
      countRequest.input('categoryId', sql.Int, categoryId);
    }
    
    if (search && search.trim().length >= 2) {
      countQuery += ` AND (p.name LIKE @search OR p.description LIKE @search OR s.name LIKE @search)`;
      countRequest.input('search', sql.NVarChar, `%${search.trim()}%`);
    }
    
    const countResult = await countRequest.query(countQuery);
    const totalCount = countResult.recordset[0]?.total || 0;
    
    console.log('[DEBUG] Products query returned:', result.recordset.length, 'records, Total:', totalCount);
    
    res.json({
      data: result.recordset,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total: totalCount,
        pages: Math.ceil(totalCount / pageSize)
      }
    });
  } catch (error) {
    console.error('[ERROR] Products endpoint error:', error);
    console.error('[ERROR] Error details:', {
      code: error.code,
      number: error.number,
      message: error.message
    });
    res.status(500).json({ 
      error: error.message,
      code: error.code,
      details: 'Check server logs for more information'
    });
  }
});

// Get product by ID with images
router.get('/:id', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query(`
        SELECT p.id, p.name, p.description, p.category_id, p.subcategory_id, p.price, p.stock, p.sku, p.weight_kg, p.model_number, p.seller_id,
               p.is_preorder, p.preorder_release_date,
               p.created_at, p.updated_at, c.name as category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.id = @id
      `);
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = result.recordset[0];
    
    // Get images
    const imagesResult = await pool.request()
      .input('productId', sql.Int, req.params.id)
      .query('SELECT id, product_id, image_url, filename, thumbnail_url, uploaded_at FROM product_images WHERE product_id = @productId');
    
    product.images = imagesResult.recordset;
    
    console.log('[DEBUG] Product detail response:', {
      productId: product.id,
      productName: product.name,
      imageCount: product.images.length,
      images: product.images
    });
    
    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Create product (Seller/Admin only)
router.post('/', verifyToken, checkRole(['Seller', 'Administrator']), async (req, res) => {
  try {
    const { name, description, category_id, subcategory_id, price, stock, sku, weight_kg, model_number, is_preorder, preorder_release_date } = req.body;
    const sellerId = req.user.userId;
    
    console.log('[CREATE_PRODUCT] Received request:', {
      name,
      category_id,
      price,
      stock,
      sku,
      weight_kg,
      is_preorder,
      preorder_release_date,
      sellerId
    });
    
    if (!name || !category_id || !price || !sku) {
      return res.status(400).json({ error: 'Name, category_id, price, and SKU are required' });
    }

    const pool = await getConnection();
    const result = await pool.request()
      .input('name', sql.NVarChar, name)
      .input('description', sql.NVarChar, description || null)
      .input('category_id', sql.Int, category_id)
      .input('subcategory_id', sql.Int, subcategory_id || null)
      .input('price', sql.Decimal(10, 2), price)
      .input('stock', sql.Int, stock || 0)
      .input('sku', sql.NVarChar, sku || null)
      .input('weight_kg', sql.Decimal(10, 2), weight_kg || 0.5)
      .input('model_number', sql.NVarChar, model_number || null)
      .input('seller_id', sql.Int, sellerId)
      .input('is_preorder', sql.Bit, is_preorder ? 1 : 0)
      .input('preorder_release_date', sql.Date, preorder_release_date || null)
      .query(`
        INSERT INTO products (name, description, category_id, subcategory_id, price, stock, sku, weight_kg, model_number, seller_id, is_preorder, preorder_release_date)
        OUTPUT INSERTED.id, INSERTED.name, INSERTED.description, INSERTED.category_id, INSERTED.subcategory_id,
               INSERTED.price, INSERTED.stock, INSERTED.sku, INSERTED.weight_kg, INSERTED.model_number, INSERTED.seller_id,
               INSERTED.is_preorder, INSERTED.preorder_release_date,
               INSERTED.created_at, INSERTED.updated_at
        VALUES (@name, @description, @category_id, @subcategory_id, @price, @stock, @sku, @weight_kg, @model_number, @seller_id, @is_preorder, @preorder_release_date)
      `);
    
    console.log('[CREATE_PRODUCT] Product created successfully:', result.recordset[0]);
    res.status(201).json(result.recordset[0]);
  } catch (error) {
    console.error('[CREATE_PRODUCT] Error:', {
      message: error.message,
      code: error.code,
      number: error.number,
      lineNumber: error.lineNumber
    });
    res.status(500).json({ 
      error: error.message,
      code: error.code,
      details: 'Check server logs for full error details'
    });
  }
});

// Update product (Seller/Admin only)
router.put('/:id', verifyToken, checkRole(['Seller', 'Administrator']), async (req, res) => {
  try {
    const { name, description, category_id, subcategory_id, price, stock, sku, weight_kg, model_number, is_preorder, preorder_release_date } = req.body;
    const productId = req.params.id;
    const pool = await getConnection();
    
    const result = await pool.request()
      .input('id', sql.Int, productId)
      .input('name', sql.NVarChar, name)
      .input('description', sql.NVarChar, description || null)
      .input('category_id', sql.Int, category_id)
      .input('subcategory_id', sql.Int, subcategory_id || null)
      .input('price', sql.Decimal(10, 2), price)
      .input('stock', sql.Int, stock)
      .input('sku', sql.NVarChar, sku || null)
      .input('weight_kg', sql.Decimal(10, 2), weight_kg || 0.5)
      .input('model_number', sql.NVarChar, model_number || null)
      .input('is_preorder', sql.Bit, is_preorder ? 1 : 0)
      .input('preorder_release_date', sql.Date, preorder_release_date || null)
      .query(`
        UPDATE products 
        SET name = @name, description = @description, category_id = @category_id, subcategory_id = @subcategory_id,
            price = @price, stock = @stock, sku = @sku, weight_kg = @weight_kg, model_number = @model_number,
            is_preorder = @is_preorder, preorder_release_date = @preorder_release_date,
            updated_at = GETDATE()
        OUTPUT INSERTED.id, INSERTED.name, INSERTED.description, INSERTED.category_id, INSERTED.subcategory_id,
               INSERTED.price, INSERTED.stock, INSERTED.sku, INSERTED.weight_kg, INSERTED.model_number, INSERTED.seller_id,
               INSERTED.is_preorder, INSERTED.preorder_release_date,
               INSERTED.created_at, INSERTED.updated_at
        WHERE id = @id
      `);
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(result.recordset[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Delete product (Seller/Admin only)
router.delete('/:id', verifyToken, checkRole(['Seller', 'Administrator']), async (req, res) => {
  try {
    const productId = req.params.id;
    const pool = await getConnection();
    
    // Delete product (will cascade delete related images)
    await pool.request()
      .input('id', sql.Int, productId)
      .query('DELETE FROM products WHERE id = @id');
    
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
