const express = require('express');
const { getConnection, sql } = require('../config');
const { verifyToken, checkRole } = require('../middleware/auth');
const router = express.Router();

// Get all categories
router.get('/', async (req, res) => {
  try {
    const pool = await getConnection();
    
    console.log('[DEBUG] Fetching all categories...');
    
    const result = await pool.request()
      .query('SELECT id, name, description, created_at, updated_at FROM categories ORDER BY name');
    
    console.log('[DEBUG] Categories query returned:', result.recordset.length, 'records');
    
    if (result.recordset.length === 0) {
      console.log('[DEBUG] No categories found - database may not be seeded');
    }
    
    res.json(result.recordset);
  } catch (error) {
    console.error('[ERROR] Categories endpoint error:', error);
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

// Get category by ID
router.get('/:id', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('SELECT id, name, description, created_at, updated_at FROM categories WHERE id = @id');
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json(result.recordset[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Create category (Seller/Admin only)
router.post('/', verifyToken, checkRole(['Seller', 'Administrator']), async (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const pool = await getConnection();
    const result = await pool.request()
      .input('name', sql.NVarChar, name)
      .input('description', sql.NVarChar, description || null)
      .query(`INSERT INTO categories (name, description) OUTPUT INSERTED.id, INSERTED.name, INSERTED.description, INSERTED.created_at, INSERTED.updated_at VALUES (@name, @description)`);
    
    res.status(201).json(result.recordset[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Update category (Seller/Admin only)
router.put('/:id', verifyToken, checkRole(['Seller', 'Administrator']), async (req, res) => {
  try {
    const { name, description } = req.body;
    const pool = await getConnection();
    
    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('name', sql.NVarChar, name)
      .input('description', sql.NVarChar, description || null)
      .query(`UPDATE categories SET name = @name, description = @description, updated_at = GETDATE() OUTPUT INSERTED.id, INSERTED.name, INSERTED.description, INSERTED.created_at, INSERTED.updated_at WHERE id = @id`);
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json(result.recordset[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Delete category (Admin only)
router.delete('/:id', verifyToken, checkRole(['Administrator']), async (req, res) => {
  try {
    const pool = await getConnection();
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('DELETE FROM categories WHERE id = @id');
    
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
