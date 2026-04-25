const express = require('express');
const router = express.Router();
const { getConnection } = require('../config');
const { verifyToken } = require('../middleware/auth');

// Add to wishlist
router.post('/', verifyToken, async (req, res) => {
  const userId = req.user.userId;
  const { productId } = req.body;
  if (!productId) {
    return res.status(400).json({ error: 'Product ID is required' });
  }
  try {
    const pool = await getConnection();
    await pool.request()
      .input('userId', userId)
      .input('productId', productId)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM wishlist WHERE user_id = @userId AND product_id = @productId)
        BEGIN
          INSERT INTO wishlist (user_id, product_id, created_at)
          VALUES (@userId, @productId, GETDATE())
        END
      `);
    res.json({ success: true });
  } catch (err) {
    console.error('Add to wishlist error:', err);
    res.status(500).json({ error: 'Failed to add to wishlist' });
  }
});

// Get wishlist for user
router.get('/', verifyToken, async (req, res) => {
  const userId = req.user.userId;
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('userId', userId)
      .query('SELECT w.product_id, p.* FROM wishlist w JOIN products p ON w.product_id = p.id WHERE w.user_id = @userId');
    res.json(result.recordset);
  } catch (err) {
    console.error('Get wishlist error:', err);
    res.status(500).json({ error: 'Failed to fetch wishlist' });
  }
});

// Remove from wishlist
router.delete('/:productId', verifyToken, async (req, res) => {
  const userId = req.user.userId;
  const { productId } = req.params;
  try {
    const pool = await getConnection();
    await pool.request()
      .input('userId', userId)
      .input('productId', productId)
      .query('DELETE FROM wishlist WHERE user_id = @userId AND product_id = @productId');
    res.json({ success: true });
  } catch (err) {
    console.error('Remove from wishlist error:', err);
    res.status(500).json({ error: 'Failed to remove from wishlist' });
  }
});

module.exports = router;
