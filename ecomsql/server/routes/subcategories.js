const express = require('express');
const { getConnection, sql } = require('../config');
const { verifyToken, checkRole } = require('../middleware/auth');
const router = express.Router();

// Get all subcategories (with optional category filter)
router.get('/', async (req, res) => {
  try {
    const { categoryId } = req.query;
    const pool = await getConnection();
    
    let query = 'SELECT id, category_id, name, description, created_at, updated_at FROM subcategories';
    const request = pool.request();
    
    if (categoryId) {
      query += ' WHERE category_id = @categoryId';
      request.input('categoryId', sql.Int, categoryId);
    }
    
    query += ' ORDER BY name';
    const result = await request.query(query);
    
    res.json(result.recordset);
  } catch (error) {
    console.error('[ERROR] Subcategories endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get subcategory by ID
router.get('/:id', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('SELECT id, category_id, name, description, created_at, updated_at FROM subcategories WHERE id = @id');
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Subcategory not found' });
    }
    res.json(result.recordset[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Get subcategories for a specific category
router.get('/category/:categoryId', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('categoryId', sql.Int, req.params.categoryId)
      .query('SELECT id, category_id, name, description, created_at, updated_at FROM subcategories WHERE category_id = @categoryId ORDER BY name');
    
    res.json(result.recordset);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Create subcategory (Seller/Admin only)
router.post('/', verifyToken, checkRole(['Seller', 'Administrator']), async (req, res) => {
  try {
    const { category_id, name, description } = req.body;
    
    if (!category_id || !name) {
      return res.status(400).json({ error: 'Category ID and subcategory name are required' });
    }

    const pool = await getConnection();
    
    // Verify category exists
    const categoryCheck = await pool.request()
      .input('categoryId', sql.Int, category_id)
      .query('SELECT id FROM categories WHERE id = @categoryId');
    
    if (categoryCheck.recordset.length === 0) {
      return res.status(404).json({ error: 'Parent category not found' });
    }

    const result = await pool.request()
      .input('category_id', sql.Int, category_id)
      .input('name', sql.NVarChar, name)
      .input('description', sql.NVarChar, description || null)
      .query(`INSERT INTO subcategories (category_id, name, description) 
              OUTPUT INSERTED.id, INSERTED.category_id, INSERTED.name, INSERTED.description, INSERTED.created_at, INSERTED.updated_at 
              VALUES (@category_id, @name, @description)`);
    
    res.status(201).json(result.recordset[0]);
  } catch (error) {
    console.error(error);
    if (error.number === 2627) {
      res.status(400).json({ error: 'Subcategory name already exists for this category' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Update subcategory (Seller/Admin only)
router.put('/:id', verifyToken, checkRole(['Seller', 'Administrator']), async (req, res) => {
  try {
    const { name, description } = req.body;
    const pool = await getConnection();
    
    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('name', sql.NVarChar, name)
      .input('description', sql.NVarChar, description || null)
      .query(`UPDATE subcategories 
              SET name = @name, description = @description, updated_at = GETDATE() 
              OUTPUT INSERTED.id, INSERTED.category_id, INSERTED.name, INSERTED.description, INSERTED.created_at, INSERTED.updated_at 
              WHERE id = @id`);
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Subcategory not found' });
    }
    res.json(result.recordset[0]);
  } catch (error) {
    console.error(error);
    if (error.number === 2627) {
      res.status(400).json({ error: 'Subcategory name already exists for this category' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Delete subcategory (Admin only)
router.delete('/:id', verifyToken, checkRole(['Administrator']), async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('DELETE FROM subcategories WHERE id = @id');
    
    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Subcategory not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
