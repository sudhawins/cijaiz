const express = require('express');
const { getConnection, sql } = require('../config');
const router = express.Router();

// Get cart items for session
router.get('/:sessionId', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('sessionId', sql.NVarChar, req.params.sessionId)
      .query(`
        SELECT c.id, c.cart_session_id, c.product_id, c.quantity, c.added_at,
               p.name as product_name, p.price, p.stock, p.weight_kg
        FROM cart_items c
        LEFT JOIN products p ON c.product_id = p.id
        WHERE c.cart_session_id = @sessionId
        ORDER BY c.added_at DESC
      `);
    
    res.json(result.recordset);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Add item to cart
router.post('/', async (req, res) => {
  try {
    const { sessionId, productId, quantity } = req.body;
    
    if (!sessionId || !productId || !quantity) {
      return res.status(400).json({ error: 'sessionId, productId, and quantity are required' });
    }

    const pool = await getConnection();
    
    // Check if item already in cart
    const existingItem = await pool.request()
      .input('sessionId', sql.NVarChar, sessionId)
      .input('productId', sql.Int, productId)
      .query('SELECT id, quantity FROM cart_items WHERE cart_session_id = @sessionId AND product_id = @productId');
    
    if (existingItem.recordset.length > 0) {
      // Update quantity
      const result = await pool.request()
        .input('sessionId', sql.NVarChar, sessionId)
        .input('productId', sql.Int, productId)
        .input('quantity', sql.Int, quantity)
        .query(`
          UPDATE cart_items 
          SET quantity = quantity + @quantity
          OUTPUT INSERTED.id, INSERTED.cart_session_id, INSERTED.product_id, INSERTED.quantity, INSERTED.added_at
          WHERE cart_session_id = @sessionId AND product_id = @productId
        `);
      
      return res.status(200).json(result.recordset[0]);
    }

    // Insert new item
    const result = await pool.request()
      .input('sessionId', sql.NVarChar, sessionId)
      .input('productId', sql.Int, productId)
      .input('quantity', sql.Int, quantity)
      .query(`
        INSERT INTO cart_items (cart_session_id, product_id, quantity)
        OUTPUT INSERTED.id, INSERTED.cart_session_id, INSERTED.product_id, INSERTED.quantity, INSERTED.added_at
        VALUES (@sessionId, @productId, @quantity)
      `);
    
    res.status(201).json(result.recordset[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Update cart item quantity
router.put('/:itemId', async (req, res) => {
  try {
    const { quantity } = req.body;
    
    if (!quantity || quantity < 1) {
      return res.status(400).json({ error: 'Quantity must be greater than 0' });
    }

    const pool = await getConnection();
    const result = await pool.request()
      .input('itemId', sql.Int, req.params.itemId)
      .input('quantity', sql.Int, quantity)
      .query(`
        UPDATE cart_items 
        SET quantity = @quantity
        OUTPUT INSERTED.id, INSERTED.cart_session_id, INSERTED.product_id, INSERTED.quantity, INSERTED.added_at
        WHERE id = @itemId
      `);
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Cart item not found' });
    }
    res.json(result.recordset[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Remove item from cart
router.delete('/:itemId', async (req, res) => {
  try {
    const pool = await getConnection();
    await pool.request()
      .input('itemId', sql.Int, req.params.itemId)
      .query('DELETE FROM cart_items WHERE id = @itemId');
    
    res.json({ message: 'Item removed from cart' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Clear cart
router.delete('/session/:sessionId', async (req, res) => {
  try {
    const pool = await getConnection();
    await pool.request()
      .input('sessionId', sql.NVarChar, req.params.sessionId)
      .query('DELETE FROM cart_items WHERE cart_session_id = @sessionId');
    
    res.json({ message: 'Cart cleared' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
