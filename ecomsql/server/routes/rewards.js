const express = require('express');
const { getConnection, sql } = require('../config');
const router = express.Router();

// Generate unique reward code
function generateRewardCode() {
  const prefix = 'REW';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substr(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

// Get available rewards for a customer
router.get('/customer/:email', async (req, res) => {
  try {
    const email = req.params.email.toLowerCase().trim();

    const pool = await getConnection();
    
    const result = await pool.request()
      .input('email', sql.NVarChar, email)
      .input('now', sql.DateTime2, new Date())
      .query(`
        SELECT id, reward_code, reward_amount, original_order_value, reward_percentage,
               is_used, used_at, valid_from, valid_until, created_at
        FROM customer_rewards
        WHERE LOWER(RTRIM(LTRIM(customer_email))) = @email
        AND is_used = 0
        AND valid_until >= @now
        ORDER BY created_at DESC
      `);

    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching customer rewards:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all rewards for a customer (including used ones)
router.get('/customer-all/:email', async (req, res) => {
  try {
    const email = req.params.email.toLowerCase().trim();

    const pool = await getConnection();
    
    const result = await pool.request()
      .input('email', sql.NVarChar, email)
      .query(`
        SELECT id, reward_code, reward_amount, original_order_value, reward_percentage,
               is_used, used_at, valid_from, valid_until, created_at
        FROM customer_rewards
        WHERE LOWER(RTRIM(LTRIM(customer_email))) = @email
        ORDER BY created_at DESC
      `);

    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching customer rewards:', error);
    res.status(500).json({ error: error.message });
  }
});

// Validate and apply reward code
router.post('/validate', async (req, res) => {
  try {
    const { code, customerEmail, cartTotal } = req.body;

    if (!code || !customerEmail || cartTotal === undefined) {
      return res.status(400).json({ error: 'Code, customer email, and cart total are required' });
    }

    const pool = await getConnection();
    const now = new Date();
    
    // Get reward details
    const result = await pool.request()
      .input('code', sql.NVarChar, code.toUpperCase().trim())
      .input('email', sql.NVarChar, customerEmail.toLowerCase().trim())
      .input('now', sql.DateTime2, now)
      .query(`
        SELECT id, reward_code, reward_amount, reward_percentage, is_used, valid_until
        FROM customer_rewards
        WHERE UPPER(RTRIM(LTRIM(reward_code))) = @code
        AND LOWER(RTRIM(LTRIM(customer_email))) = @email
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Invalid reward code or not associated with this customer' });
    }

    const reward = result.recordset[0];

    // Check if reward is already used
    if (reward.is_used) {
      return res.status(400).json({ error: 'This reward has already been used' });
    }

    // Check if reward is expired
    if (new Date(reward.valid_until) < now) {
      return res.status(400).json({ error: 'This reward has expired' });
    }

    // Reward amount cannot exceed cart total
    const rewardAmount = Math.min(reward.reward_amount, cartTotal);

    res.json({
      success: true,
      reward: {
        code: reward.reward_code,
        amount: parseFloat(rewardAmount.toFixed(2)),
        percentage: reward.reward_percentage,
        originalAmount: reward.reward_amount
      }
    });
  } catch (error) {
    console.error('Reward validation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create reward after successful order (called by orders endpoint)
router.post('/create', async (req, res) => {
  try {
    const { customerEmail, orderId, orderValue } = req.body;

    if (!customerEmail || !orderId || orderValue === undefined) {
      return res.status(400).json({ error: 'Customer email, order ID, and order value are required' });
    }

    const pool = await getConnection();
    
    // Calculate 5% reward
    const rewardAmount = parseFloat((orderValue * 0.05).toFixed(2));
    const validUntil = new Date();
    validUntil.setMonth(validUntil.getMonth() + 3); // 3 months validity

    const rewardCode = generateRewardCode();

    const result = await pool.request()
      .input('customerEmail', sql.NVarChar, customerEmail.toLowerCase().trim())
      .input('orderId', sql.Int, orderId)
      .input('rewardCode', sql.NVarChar, rewardCode)
      .input('rewardAmount', sql.Decimal(10, 2), rewardAmount)
      .input('orderValue', sql.Decimal(10, 2), orderValue)
      .input('validUntil', sql.DateTime2, validUntil)
      .query(`
        INSERT INTO customer_rewards (customer_email, order_id, reward_code, reward_amount, original_order_value, valid_until)
        OUTPUT INSERTED.id, INSERTED.reward_code, INSERTED.reward_amount, INSERTED.valid_until
        VALUES (@customerEmail, @orderId, @rewardCode, @rewardAmount, @orderValue, @validUntil)
      `);

    res.status(201).json({
      success: true,
      reward: result.recordset[0]
    });
  } catch (error) {
    console.error('Error creating reward:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mark reward as used
router.put('/use/:rewardCode', async (req, res) => {
  try {
    const { orderIdUsedIn, customerEmail } = req.body;
    const rewardCode = req.params.rewardCode;

    if (!rewardCode || !orderIdUsedIn || !customerEmail) {
      return res.status(400).json({ error: 'Reward code, order ID, and customer email are required' });
    }

    const pool = await getConnection();
    
    const result = await pool.request()
      .input('code', sql.NVarChar, rewardCode.toUpperCase().trim())
      .input('email', sql.NVarChar, customerEmail.toLowerCase().trim())
      .input('orderId', sql.Int, orderIdUsedIn)
      .input('now', sql.DateTime2, new Date())
      .query(`
        UPDATE customer_rewards
        SET is_used = 1, 
            used_in_order_id = @orderId,
            used_at = @now,
            updated_at = @now
        OUTPUT INSERTED.id, INSERTED.reward_code, INSERTED.is_used
        WHERE UPPER(RTRIM(LTRIM(reward_code))) = @code
        AND LOWER(RTRIM(LTRIM(customer_email))) = @email
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Reward not found' });
    }

    res.json({
      success: true,
      reward: result.recordset[0]
    });
  } catch (error) {
    console.error('Error marking reward as used:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all rewards for seller dashboard (all active and used)
router.get('/admin/all-rewards', async (req, res) => {
  try {
    const pool = await getConnection();
    
    const result = await pool.request()
      .query(`
        SELECT TOP 1000 
          cr.id, 
          cr.customer_email, 
          cr.reward_code, 
          cr.reward_amount, 
          cr.original_order_value,
          cr.reward_percentage,
          cr.is_used, 
          cr.used_at, 
          cr.valid_until, 
          cr.created_at,
          o.order_number,
          DATEDIFF(day, GETDATE(), cr.valid_until) as days_remaining
        FROM customer_rewards cr
        LEFT JOIN orders o ON cr.order_id = o.id
        ORDER BY cr.created_at DESC
      `);

    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching all rewards:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get rewards statistics for seller
router.get('/admin/stats', async (req, res) => {
  try {
    const pool = await getConnection();
    
    const result = await pool.request()
      .query(`
        SELECT 
          COUNT(*) as total_rewards,
          SUM(CASE WHEN is_used = 0 THEN 1 ELSE 0 END) as active_rewards,
          SUM(CASE WHEN is_used = 1 THEN 1 ELSE 0 END) as used_rewards,
          SUM(CASE WHEN is_used = 0 AND valid_until < GETDATE() THEN 1 ELSE 0 END) as expired_rewards,
          CAST(SUM(CASE WHEN is_used = 0 THEN reward_amount ELSE 0 END) AS DECIMAL(10, 2)) as total_active_value,
          CAST(SUM(CASE WHEN is_used = 1 THEN reward_amount ELSE 0 END) AS DECIMAL(10, 2)) as total_redeemed_value
        FROM customer_rewards
      `);

    res.json(result.recordset[0]);
  } catch (error) {
    console.error('Error fetching rewards stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get rewards by status filter
router.get('/admin/filter/:status', async (req, res) => {
  try {
    const { status } = req.params;
    const pool = await getConnection();
    
    let query = `
      SELECT TOP 1000 
        cr.id, 
        cr.customer_email, 
        cr.reward_code, 
        cr.reward_amount, 
        cr.original_order_value,
        cr.is_used, 
        cr.used_at, 
        cr.valid_until, 
        cr.created_at,
        o.order_number,
        DATEDIFF(day, GETDATE(), cr.valid_until) as days_remaining
      FROM customer_rewards cr
      LEFT JOIN orders o ON cr.order_id = o.id
      WHERE 1=1
    `;

    if (status === 'active') {
      query += ` AND cr.is_used = 0 AND cr.valid_until >= GETDATE()`;
    } else if (status === 'used') {
      query += ` AND cr.is_used = 1`;
    } else if (status === 'expired') {
      query += ` AND cr.is_used = 0 AND cr.valid_until < GETDATE()`;
    }

    query += ` ORDER BY cr.created_at DESC`;

    const result = await pool.request().query(query);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error filtering rewards:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
