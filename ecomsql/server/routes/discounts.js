const express = require('express');
const { getConnection, sql } = require('../config');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

// Helper function to get current time in IST (UTC+5:30)
function getNowIST() {
  const now = new Date();
  const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000)); // IST = UTC + 5:30
  return istTime;
}

// ============== DIAGNOSTIC ENDPOINT ==============
// Check if discounts table exists and has data
router.get('/health', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request().query(`
      SELECT 
        (SELECT COUNT(*) FROM discounts) as discount_count,
        (SELECT COUNT(*) FROM customer_rewards) as customer_rewards_count,
        (SELECT COUNT(*) FROM reward_transactions) as reward_transactions_count,
        (SELECT COUNT(*) FROM order_discounts) as order_discounts_count
    `);
    
    const data = result.recordset[0];
    console.log('[HEALTH CHECK] Database stats:', data);
    res.json({ 
      status: 'ok',
      database: 'connected',
      tables: data
    });
  } catch (error) {
    console.error('[HEALTH CHECK] Error:', error.message);
    res.status(500).json({ 
      status: 'error',
      message: error.message
    });
  }
});

// ============== DISCOUNT/COUPON ENDPOINTS ==============

// Validate and apply discount code
router.post('/validate-coupon', async (req, res) => {
  try {
    const { code, orderAmount, customerEmail } = req.body;

    if (!code || orderAmount === undefined || orderAmount === null) {
      return res.status(400).json({ error: 'Code and order amount required' });
    }

    const pool = await getConnection();

    // Get discount code
    const discountResult = await pool.request()
      .input('code', sql.NVarChar, code.toUpperCase())
      .query(`
        SELECT id, discount_type, discount_value, min_order_amount, max_discount_amount,
               max_uses, current_uses, valid_from, valid_until, is_active
        FROM discounts
        WHERE UPPER(code) = @code
      `);

    if (discountResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Invalid coupon code' });
    }

    const discount = discountResult.recordset[0];

    // Check if discount is active
    if (!discount.is_active) {
      return res.status(400).json({ error: 'This coupon code is no longer active' });
    }

    // Check validity dates using IST
    const nowIST = getNowIST();
    if (discount.valid_from) {
      const validFromTime = new Date(discount.valid_from);
      console.log('[DEBUG] Coupon valid_from check (IST):', {
        validFrom: validFromTime.toISOString(),
        nowIST: nowIST.toISOString(),
        isValid: validFromTime <= nowIST
      });
      if (validFromTime > nowIST) {
        return res.status(400).json({ error: 'This coupon code is not yet valid'});
      }
    }
    if (discount.valid_until) {
      const validUntilTime = new Date(discount.valid_until);
      console.log('[DEBUG] Coupon valid_until check (IST):', {
        validUntil: validUntilTime.toISOString(),
        nowIST: nowIST.toISOString(),
        isValid: validUntilTime >= nowIST
      });
      if (validUntilTime <= nowIST) {
        return res.status(400).json({ error: 'This coupon code has expired' });
      }
    }

    // Check usage limit
    if (discount.max_uses && discount.current_uses >= discount.max_uses) {
      return res.status(400).json({ error: 'This coupon code has reached its usage limit' });
    }

    // Check minimum order amount (orderAmount is product value only, before GST/shipping)
    if (discount.min_order_amount && orderAmount < discount.min_order_amount) {
      return res.status(400).json({ 
        error: `Minimum order amount of ₹${discount.min_order_amount} required` 
      });
    }

    // Calculate discount amount based on product value only
    let discountAmount = 0;
    if (discount.discount_type === 'percentage') {
      // Apply percentage to product value (orderAmount), not including GST/shipping
      discountAmount = (orderAmount * discount.discount_value) / 100;
    } else {
      // Fixed amount discount
      discountAmount = discount.discount_value;
    }

    // Apply maximum discount cap if set
    if (discount.max_discount_amount) {
      discountAmount = Math.min(discountAmount, discount.max_discount_amount);
    }

    // Ensure discount doesn't exceed product value
    discountAmount = Math.min(discountAmount, orderAmount);

    res.json({
      valid: true,
      discountCode: code.toUpperCase(),
      discountType: discount.discount_type,
      discountValue: discount.discount_value,
      discountAmount: Math.round(discountAmount * 100) / 100,
      savings: Math.round(discountAmount * 100) / 100
    });
  } catch (error) {
    console.error('[ERROR] Validate coupon error:', error);
    res.status(500).json({ error: 'Error validating coupon code' });
  }
});

// Apply discount code to order (called after order creation)
router.post('/apply-coupon', verifyToken, async (req, res) => {
  try {
    const { orderId, code, discountAmount } = req.body;

    if (!orderId || !code || discountAmount === undefined || discountAmount === null) {
      return res.status(400).json({ error: 'Order ID, coupon code, and discount amount required' });
    }

    const pool = await getConnection();

    // Get discount ID and current usage
    const discountResult = await pool.request()
      .input('code', sql.NVarChar, code.toUpperCase())
      .query(`
        SELECT id, discount_type, discount_value, current_uses, max_uses 
        FROM discounts 
        WHERE UPPER(code) = @code
      `);

    if (discountResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Coupon code not found' });
    }

    const discountRecord = discountResult.recordset[0];
    const discountId = discountRecord.id;

    // Verify usage limit before applying
    if (discountRecord.max_uses && discountRecord.current_uses >= discountRecord.max_uses) {
      return res.status(400).json({ error: 'This coupon code has reached its usage limit' });
    }

    // Get discount type for the order_discounts table
    const discountType = discountRecord.discount_type || 'coupon';

    // Insert order discount record
    await pool.request()
      .input('orderId', sql.Int, orderId)
      .input('discountId', sql.Int, discountId)
      .input('code', sql.NVarChar, code.toUpperCase())
      .input('discountAmount', sql.Decimal(10, 2), discountAmount)
      .input('discountType', sql.NVarChar, discountType)
      .query(`
        INSERT INTO order_discounts (order_id, discount_id, discount_code, discount_type, discount_amount)
        VALUES (@orderId, @discountId, @code, @discountType, @discountAmount)
      `);

    // Increment coupon usage count
    const updateResult = await pool.request()
      .input('code', sql.NVarChar, code.toUpperCase())
      .query(`
        UPDATE discounts
        SET current_uses = current_uses + 1
        WHERE UPPER(code) = @code;
        
        SELECT current_uses FROM discounts WHERE UPPER(code) = @code
      `);

    const newUsageCount = updateResult.recordset[updateResult.recordset.length - 1]?.[0]?.current_uses;

    // Update order with discount information
    await pool.request()
      .input('orderId', sql.Int, orderId)
      .input('discountAmount', sql.Decimal(10, 2), discountAmount)
      .input('code', sql.NVarChar, code.toUpperCase())
      .query(`
        UPDATE orders
        SET discount_amount = @discountAmount, 
            applied_discount_code = @code,
            updated_at = GETDATE()
        WHERE id = @orderId
      `);

    res.json({ 
      success: true, 
      message: 'Coupon applied successfully',
      discountAmount: Math.round(discountAmount * 100) / 100,
      newUsageCount: newUsageCount
    });
  } catch (error) {
    console.error('[ERROR] Apply coupon error:', error);
    res.status(500).json({ error: 'Error applying coupon code' });
  }
});

// Get all active discount codes
router.get('/active-discounts', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request().query(`
      SELECT code, description, discount_type, discount_value, min_order_amount, valid_from, valid_until, max_uses, current_uses, is_active
      FROM discounts
      WHERE is_active = 1
      ORDER BY created_at DESC;
    `);

    // Filter results based on IST time
    const nowIST = getNowIST();
    const activeDiscounts = result.recordset.filter(discount => {
      // Check if max uses reached
      if (discount.max_uses && discount.current_uses >= discount.max_uses) {
        return false;
      }
      
      // Check valid_from date (must be in past or null)
      if (discount.valid_from) {
        const validFromTime = new Date(discount.valid_from);
        if (validFromTime > nowIST) {
          console.log('[DEBUG] Discount filtered out - not yet valid:', discount.code, 'valid_from:', validFromTime.toISOString(), 'nowIST:', nowIST.toISOString());
          return false;
        }
      }
      
      // Check valid_until date (must be in future or null)
      if (discount.valid_until) {
        const validUntilTime = new Date(discount.valid_until);
        if (validUntilTime <= nowIST) {
          console.log('[DEBUG] Discount filtered out - expired:', discount.code, 'valid_until:', validUntilTime.toISOString(), 'nowIST:', nowIST.toISOString());
          return false;
        }
      }
      
      return true;
    });

    console.log('[DEBUG] Active discounts query returned:', result.recordset.length, 'total, filtered to:', activeDiscounts.length, 'active (IST-based)');
    
    res.json(activeDiscounts);
  } catch (error) {
    console.error('[ERROR] Get active discounts error:', error);
    res.status(500).json({ error: 'Error fetching discounts' });
  }
});

// ============== LOYALTY REWARDS ENDPOINTS ==============

// Get customer loyalty rewards
router.get('/loyalty/:customerEmail', async (req, res) => {
  try {
    const { customerEmail } = req.params;
    const pool = await getConnection();

    const result = await pool.request()
      .input('email', sql.NVarChar, customerEmail.toLowerCase())
      .query(`
        SELECT id, customer_email, total_points, redeemed_points, available_points,
               loyalty_tier, total_spent, order_count, last_order_date
        FROM customer_rewards
        WHERE LOWER(customer_email) = @email
      `);

    if (result.recordset.length === 0) {
      // Initialize rewards for new customer
      await pool.request()
        .input('email', sql.NVarChar, customerEmail.toLowerCase())
        .query(`
          INSERT INTO customer_rewards (customer_email, total_points, available_points)
          VALUES (@email, 0, 0)
        `);

      return res.json({
        customer_email: customerEmail.toLowerCase(),
        total_points: 0,
        available_points: 0,
        loyalty_tier: 'Silver',
        total_spent: 0,
        order_count: 0
      });
    }

    res.json(result.recordset[0]);
  } catch (error) {
    console.error('[ERROR] Get loyalty rewards error:', error);
    res.status(500).json({ error: 'Error fetching loyalty rewards' });
  }
});

// Add reward points to order (called after order completion)
router.post('/earn-rewards', verifyToken, async (req, res) => {
  try {
    const { orderId, customerEmail, orderAmount } = req.body;

    if (!orderId || !customerEmail || orderAmount === undefined || orderAmount === null) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const pool = await getConnection();

    // Calculate points based on product value only (orderAmount should be subtotal, not including GST/shipping)
    // 1 point per ₹10 spent on products
    const pointsEarned = Math.floor(orderAmount / 10);

    // Get current customer rewards
    const rewardsResult = await pool.request()
      .input('email', sql.NVarChar, customerEmail.toLowerCase())
      .query('SELECT * FROM customer_rewards WHERE LOWER(customer_email) = @email');

    let currentRewards = rewardsResult.recordset[0];

    if (!currentRewards) {
      // Initialize new customer
      await pool.request()
        .input('email', sql.NVarChar, customerEmail.toLowerCase())
        .query(`
          INSERT INTO customer_rewards (customer_email, total_points, available_points)
          VALUES (@email, 0, 0)
        `);
      currentRewards = { total_points: 0, redeemed_points: 0, total_spent: 0, order_count: 0 };
    }

    // Update customer rewards based on product value only (orderAmount)
    const newTotalPoints = (currentRewards.total_points || 0) + pointsEarned;
    const newAvailablePoints = (currentRewards.available_points || 0) + pointsEarned;
    const newTotalSpent = (currentRewards.total_spent || 0) + orderAmount;
    const newOrderCount = (currentRewards.order_count || 0) + 1;

    // Determine loyalty tier based on total_spent (product value only)
    let loyaltyTier = 'Silver';
    if (newTotalSpent >= 50000) loyaltyTier = 'Diamond';
    else if (newTotalSpent >= 25000) loyaltyTier = 'Platinum';
    else if (newTotalSpent >= 10000) loyaltyTier = 'Gold';

    await pool.request()
      .input('email', sql.NVarChar, customerEmail.toLowerCase())
      .input('totalPoints', sql.Int, newTotalPoints)
      .input('availablePoints', sql.Int, newAvailablePoints)
      .input('totalSpent', sql.Decimal(10, 2), newTotalSpent)
      .input('orderCount', sql.Int, newOrderCount)
      .input('tier', sql.NVarChar, loyaltyTier)
      .query(`
        UPDATE customer_rewards
        SET total_points = @totalPoints,
            available_points = @availablePoints,
            total_spent = @totalSpent,
            order_count = @orderCount,
            loyalty_tier = @tier,
            last_order_date = GETDATE()
        WHERE LOWER(customer_email) = @email
      `);

    // Record transaction
    await pool.request()
      .input('email', sql.NVarChar, customerEmail.toLowerCase())
      .input('type', sql.NVarChar, 'earned')
      .input('points', sql.Int, pointsEarned)
      .input('orderId', sql.Int, orderId)
      .input('description', sql.NVarChar, `Earned ${pointsEarned} points from order`)
      .query(`
        INSERT INTO reward_transactions (customer_email, transaction_type, points_amount, order_id, description)
        VALUES (@email, @type, @points, @orderId, @description)
      `);

    res.json({
      success: true,
      pointsEarned,
      totalPoints: newTotalPoints,
      availablePoints: newAvailablePoints,
      loyaltyTier
    });
  } catch (error) {
    console.error('[ERROR] Earn rewards error:', error);
    res.status(500).json({ error: 'Error processing reward points' });
  }
});

// Redeem loyalty points for discount
router.post('/redeem-points', verifyToken, async (req, res) => {
  try {
    const { customerEmail, pointsToRedeem, orderId } = req.body;

    if (!customerEmail || !pointsToRedeem || !orderId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const pool = await getConnection();

    // Get current customer rewards
    const rewardsResult = await pool.request()
      .input('email', sql.NVarChar, customerEmail.toLowerCase())
      .query('SELECT * FROM customer_rewards WHERE LOWER(customer_email) = @email');

    if (rewardsResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Customer rewards not found' });
    }

    const rewards = rewardsResult.recordset[0];

    if (rewards.available_points < pointsToRedeem) {
      return res.status(400).json({ 
        error: `Insufficient points. Available: ${rewards.available_points}` 
      });
    }

    // Calculate discount: 1 point = ₹0.50 (50 paisa)
    const discountAmount = pointsToRedeem * 0.50;

    // Update customer rewards
    const newAvailablePoints = rewards.available_points - pointsToRedeem;
    const newRedeemedPoints = (rewards.redeemed_points || 0) + pointsToRedeem;

    await pool.request()
      .input('email', sql.NVarChar, customerEmail.toLowerCase())
      .input('available', sql.Int, newAvailablePoints)
      .input('redeemed', sql.Int, newRedeemedPoints)
      .query(`
        UPDATE customer_rewards
        SET available_points = @available,
            redeemed_points = @redeemed
        WHERE LOWER(customer_email) = @email
      `);

    // Record transaction
    await pool.request()
      .input('email', sql.NVarChar, customerEmail.toLowerCase())
      .input('points', sql.Int, pointsToRedeem)
      .input('orderId', sql.Int, orderId)
      .query(`
        INSERT INTO reward_transactions (customer_email, transaction_type, points_amount, order_id, description)
        VALUES (@email, 'redeemed', @points, @orderId, 'Redeemed points for discount')
      `);

    // Record in order discounts
    await pool.request()
      .input('orderId', sql.Int, orderId)
      .input('discountAmount', sql.Decimal(10, 2), discountAmount)
      .query(`
        INSERT INTO order_discounts (order_id, discount_code, discount_type, discount_amount)
        VALUES (@orderId, 'LOYALTY_POINTS', 'loyalty_points', @discountAmount)
      `);

    res.json({
      success: true,
      pointsRedeemed: pointsToRedeem,
      discountAmount,
      availablePointsRemaining: newAvailablePoints
    });
  } catch (error) {
    console.error('[ERROR] Redeem points error:', error);
    res.status(500).json({ error: 'Error redeeming points' });
  }
});

// Get loyalty tier benefits
router.get('/tier-benefits/:tier', async (req, res) => {
  try {
    const { tier } = req.params;

    const benefits = {
      'Silver': {
        tier: 'Silver',
        multiplier: 1,
        discount: 0,
        benefits: ['1 point per ₹10 spent', 'Welcome offer']
      },
      'Gold': {
        tier: 'Gold',
        multiplier: 1.25,
        discount: 5,
        benefits: ['1.25 points per ₹10 spent', '5% extra discount', 'Priority support']
      },
      'Platinum': {
        tier: 'Platinum',
        multiplier: 1.5,
        discount: 10,
        benefits: ['1.5 points per ₹10 spent', '10% extra discount', 'Free shipping on select orders', 'Exclusive early access']
      },
      'Diamond': {
        tier: 'Diamond',
        multiplier: 2,
        discount: 15,
        benefits: ['2 points per ₹10 spent', '15% extra discount', 'Free shipping on all orders', 'Exclusive member events', 'Concierge support']
      }
    };

    const tierBenefit = benefits[tier] || benefits['Silver'];
    res.json(tierBenefit);
  } catch (error) {
    console.error('[ERROR] Get tier benefits error:', error);
    res.status(500).json({ error: 'Error fetching tier benefits' });
  }
});

// Get transaction history
router.get('/history/:customerEmail', async (req, res) => {
  try {
    const { customerEmail } = req.params;
    const pool = await getConnection();

    const result = await pool.request()
      .input('email', sql.NVarChar, customerEmail.toLowerCase())
      .query(`
        SELECT id, transaction_type, points_amount, order_id, description, created_at
        FROM reward_transactions
        WHERE LOWER(customer_email) = @email
        ORDER BY created_at DESC
        LIMIT 50
      `);

    res.json(result.recordset);
  } catch (error) {
    console.error('[ERROR] Get transaction history error:', error);
    res.status(500).json({ error: 'Error fetching transaction history' });
  }
});

// ============== SELLER/ADMIN MANAGEMENT ENDPOINTS ==============

// Get all coupons (Seller/Admin only)
router.get('/seller/coupons', verifyToken, async (req, res) => {
  try {
    console.log('[SELLER COUPONS] User:', req.user);
    
    // Check role
    if (!['Seller', 'Administrator'].includes(req.user?.roleType)) {
      console.log('[SELLER COUPONS] Access denied - roles:', req.user?.roleType);
      return res.status(403).json({ error: 'Only sellers and administrators can access this' });
    }

    const pool = await getConnection();
    console.log('[SELLER COUPONS] Database connection established');
    
    const result = await pool.request().query(`
      SELECT id, code, description, discount_type, discount_value, min_order_amount,
             max_discount_amount, max_uses, current_uses, valid_from, valid_until, 
             is_active, created_at, updated_at
      FROM discounts
      ORDER BY created_at DESC
    `);

    console.log('[SELLER COUPONS] Query returned:', result.recordset.length, 'records');
    res.json(result.recordset);
  } catch (error) {
    console.error('[ERROR] Get seller coupons error:', error.message);
    console.error('[ERROR] Full error:', error);
    res.status(500).json({ error: error.message || 'Error fetching coupons' });
  }
});

// Create new coupon (Seller/Admin only)
router.post('/seller/coupons', verifyToken, async (req, res) => {
  try {
    // Check role
    if (!['Seller', 'Administrator'].includes(req.user?.roleType)) {
      return res.status(403).json({ error: 'Only sellers and administrators can create coupons' });
    }

    const { code, description, discount_type, discount_value, min_order_amount, 
            max_discount_amount, max_uses, valid_from, valid_until } = req.body;

    // Validation
    if (!code || !discount_type || !discount_value) {
      return res.status(400).json({ error: 'Code, type, and value are required' });
    }

    if (!['percentage', 'fixed'].includes(discount_type)) {
      return res.status(400).json({ error: 'Invalid discount type' });
    }

    const pool = await getConnection();

    // Check if code already exists
    const existingResult = await pool.request()
      .input('code', sql.NVarChar, code.toUpperCase())
      .query('SELECT id FROM discounts WHERE UPPER(code) = @code');

    if (existingResult.recordset.length > 0) {
      return res.status(400).json({ error: 'Coupon code already exists' });
    }

    // Create coupon
    const result = await pool.request()
      .input('code', sql.NVarChar, code.toUpperCase())
      .input('description', sql.NVarChar, description || '')
      .input('discount_type', sql.NVarChar, discount_type)
      .input('discount_value', sql.Decimal(10, 2), discount_value)
      .input('min_order_amount', sql.Decimal(10, 2), min_order_amount || null)
      .input('max_discount_amount', sql.Decimal(10, 2), max_discount_amount || null)
      .input('max_uses', sql.Int, max_uses || null)
      .input('valid_from', sql.DateTime2, valid_from || null)
      .input('valid_until', sql.DateTime2, valid_until || null)
      .query(`
        INSERT INTO discounts (code, description, discount_type, discount_value, 
                              min_order_amount, max_discount_amount, max_uses, 
                              valid_from, valid_until, is_active)
        OUTPUT INSERTED.id, INSERTED.code, INSERTED.created_at
        VALUES (@code, @description, @discount_type, @discount_value, 
               @min_order_amount, @max_discount_amount, @max_uses, 
               @valid_from, @valid_until, 1)
      `);

    res.status(201).json({
      success: true,
      coupon: result.recordset[0]
    });
  } catch (error) {
    console.error('[ERROR] Create coupon error:', error);
    res.status(500).json({ error: 'Error creating coupon' });
  }
});

// Update coupon (Seller/Admin only)
router.put('/seller/coupons/:id', verifyToken, async (req, res) => {
  try {
    // Check role
    if (!['Seller', 'Administrator'].includes(req.user?.roleType)) {
      return res.status(403).json({ error: 'Only sellers and administrators can update coupons' });
    }

    const { id } = req.params;
    const { description, discount_value, min_order_amount, max_discount_amount, 
            max_uses, valid_from, valid_until, is_active } = req.body;

    const pool = await getConnection();

    await pool.request()
      .input('id', sql.Int, id)
      .input('description', sql.NVarChar, description || '')
      .input('discount_value', sql.Decimal(10, 2), discount_value)
      .input('min_order_amount', sql.Decimal(10, 2), min_order_amount || null)
      .input('max_discount_amount', sql.Decimal(10, 2), max_discount_amount || null)
      .input('max_uses', sql.Int, max_uses || null)
      .input('valid_from', sql.DateTime2, valid_from || null)
      .input('valid_until', sql.DateTime2, valid_until || null)
      .input('is_active', sql.Bit, is_active !== undefined ? is_active : 1)
      .query(`
        UPDATE discounts
        SET description = @description,
            discount_value = @discount_value,
            min_order_amount = @min_order_amount,
            max_discount_amount = @max_discount_amount,
            max_uses = @max_uses,
            valid_from = @valid_from,
            valid_until = @valid_until,
            is_active = @is_active,
            updated_at = GETDATE()
        WHERE id = @id
      `);

    res.json({ success: true, message: 'Coupon updated successfully' });
  } catch (error) {
    console.error('[ERROR] Update coupon error:', error);
    res.status(500).json({ error: 'Error updating coupon' });
  }
});

// Delete coupon (Seller/Admin only)
router.delete('/seller/coupons/:id', verifyToken, async (req, res) => {
  try {
    // Check role
    if (!['Seller', 'Administrator'].includes(req.user?.roleType)) {
      return res.status(403).json({ error: 'Only sellers and administrators can delete coupons' });
    }

    const { id } = req.params;
    const pool = await getConnection();

    await pool.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM discounts WHERE id = @id');

    res.json({ success: true, message: 'Coupon deleted successfully' });
  } catch (error) {
    console.error('[ERROR] Delete coupon error:', error);
    res.status(500).json({ error: 'Error deleting coupon' });
  }
});

// Get top customers with rewards (Seller/Admin only)
router.get('/seller/customers', verifyToken, async (req, res) => {
  try {
    // Check role
    if (!['Seller', 'Administrator'].includes(req.user?.roleType)) {
      return res.status(403).json({ error: 'Only sellers and administrators can access this' });
    }

    const pool = await getConnection();
    console.log('[SELLER CUSTOMERS] Fetching all customers...');
    
    const result = await pool.request().query(`
      SELECT 
        u.Id as id,
        TRIM(u.UserName) as email,
        ISNULL(cr.total_points, 0) as total_earned_points,
        ISNULL(cr.available_points, 0) as available_points,
        ISNULL(cr.redeemed_points, 0) as total_redeemed_points,
        ISNULL(cr.loyalty_tier, 'Bronze') as current_tier,
        ISNULL(cr.total_spent, 0) as total_spent,
        ISNULL(cr.order_count, 0) as order_count,
        cr.last_order_date
      FROM [User] u
      LEFT JOIN customer_rewards cr ON LOWER(TRIM(u.UserName)) = LOWER(cr.customer_email)
      WHERE u.UserName IS NOT NULL AND u.UserName != ''
      ORDER BY ISNULL(cr.total_spent, 0) DESC, u.UserName ASC
    `);

    console.log('[SELLER CUSTOMERS] Query returned:', result.recordset.length, 'records');
    res.json(result.recordset);
  } catch (error) {
    console.error('[SELLER CUSTOMERS] Error:', error.message);
    console.error('[SELLER CUSTOMERS] Full error:', error);
    res.status(500).json({ error: error.message || 'Error fetching customers' });
  }
});

// Get customer rewards detail (Seller/Admin only)
router.get('/seller/customers/:email', verifyToken, async (req, res) => {
  try {
    // Check role
    if (!['Seller', 'Administrator'].includes(req.user?.roleType)) {
      return res.status(403).json({ error: 'Only sellers and administrators can access this' });
    }

    let email = req.params.email;
    // Decode URL-encoded email
    try {
      email = decodeURIComponent(email);
    } catch (e) {
      console.warn('[SELLER CUSTOMER DETAIL] Could not decode email:', e.message);
    }
    
    const pool = await getConnection();

    console.log('[SELLER CUSTOMER DETAIL] Loading details for:', email);
    console.log('[SELLER CUSTOMER DETAIL] Searching with LOWER:', email.toLowerCase().trim());

    // Get customer info with rewards (if exists) from joined tables
    const customerResult = await pool.request()
      .input('email', sql.NVarChar, email.toLowerCase().trim())
      .query(`
        SELECT 
          u.Id as id,
          TRIM(u.UserName) as email,
          ISNULL(cr.total_points, 0) as total_earned_points,
          ISNULL(cr.available_points, 0) as available_points,
          ISNULL(cr.redeemed_points, 0) as total_redeemed_points,
          ISNULL(cr.loyalty_tier, 'Bronze') as current_tier,
          ISNULL(cr.total_spent, 0) as total_spent,
          ISNULL(cr.order_count, 0) as order_count,
          cr.last_order_date
        FROM [User] u
        LEFT JOIN customer_rewards cr ON LOWER(TRIM(u.UserName)) = LOWER(cr.customer_email)
        WHERE LOWER(TRIM(u.UserName)) = @email
      `);

    console.log('[SELLER CUSTOMER DETAIL] Query result count:', customerResult.recordset.length);
    if (customerResult.recordset.length === 0) {
      // Debug: Try to find similar records
      const debugResult = await pool.request()
        .input('email', sql.NVarChar, `%${email}%`)
        .query(`SELECT TOP 5 UserName FROM [User] WHERE UserName LIKE @email`);
      console.log('[SELLER CUSTOMER DETAIL] Similar users found:', debugResult.recordset.map(r => r.UserName));
      return res.status(404).json({ error: 'Customer not found', searched: email });
    }

    const customerData = customerResult.recordset[0];
    console.log('[SELLER CUSTOMER DETAIL] Customer found:', customerData.email);

    // Get transaction history
    let transactions = [];
    try {
      const transactionsResult = await pool.request()
        .input('email', sql.NVarChar, email.toLowerCase())
        .query(`
          SELECT 
            id,
            transaction_type,
            points_amount as points_change,
            order_id as reference_id,
            description,
            created_at
          FROM reward_transactions
          WHERE LOWER(customer_email) = @email
          ORDER BY created_at DESC
        `);
      
      transactions = transactionsResult.recordset || [];
      console.log('[SELLER CUSTOMER DETAIL] Transactions found:', transactions.length);
    } catch (transError) {
      console.warn('[SELLER CUSTOMER DETAIL] Error loading transactions:', transError.message);
      // Don't fail if transactions table doesn't exist or is empty
      transactions = [];
    }

    res.json({
      ...customerData,
      transactions
    });
  } catch (error) {
    console.error('[SELLER CUSTOMER DETAIL] Error:', error.message);
    console.error('[SELLER CUSTOMER DETAIL] Full error:', error);
    res.status(500).json({ error: error.message || 'Error fetching customer details' });
  }
});

// Manually adjust customer points (Seller/Admin only)
router.post('/seller/adjust-points', verifyToken, async (req, res) => {
  try {
    // Check role
    if (!['Seller', 'Administrator'].includes(req.user?.roleType)) {
      return res.status(403).json({ error: 'Only sellers and administrators can adjust points' });
    }

    const { customerEmail, pointsAdjustment, reason } = req.body;

    if (!customerEmail || pointsAdjustment === undefined) {
      return res.status(400).json({ error: 'Customer email and adjustment required' });
    }

    const pool = await getConnection();
    
    // Trim and lowercase email for consistency
    const normalizedEmail = customerEmail.toLowerCase().trim();
    console.log('[ADJUST POINTS] Email:', customerEmail, 'Normalized:', normalizedEmail);

    // Get current rewards
    let rewardsResult = await pool.request()
      .input('email', sql.NVarChar, normalizedEmail)
      .query('SELECT * FROM customer_rewards WHERE LOWER(TRIM(customer_email)) = @email');

    let rewards = rewardsResult.recordset[0];

    // Initialize rewards if they don't exist
    if (!rewards) {
      console.log('[ADJUST POINTS] Initializing rewards for new customer:', normalizedEmail);
      await pool.request()
        .input('email', sql.NVarChar, normalizedEmail)
        .query(`
          INSERT INTO customer_rewards (customer_email, total_points, available_points, loyalty_tier)
          VALUES (@email, 0, 0, 'Silver')
        `);
      
      // Fetch the newly created rewards
      rewardsResult = await pool.request()
        .input('email', sql.NVarChar, normalizedEmail)
        .query('SELECT * FROM customer_rewards WHERE LOWER(TRIM(customer_email)) = @email');
      
      rewards = rewardsResult.recordset[0];
      console.log('[ADJUST POINTS] Rewards initialized for:', normalizedEmail);
    }
    const newAvailablePoints = Math.max(0, (rewards.available_points || 0) + pointsAdjustment);
    const newTotalPoints = Math.max(0, (rewards.total_points || 0) + pointsAdjustment);

    // Update rewards
    await pool.request()
      .input('email', sql.NVarChar, normalizedEmail)
      .input('available', sql.Int, newAvailablePoints)
      .input('total', sql.Int, newTotalPoints)
      .query(`
        UPDATE customer_rewards
        SET available_points = @available,
            total_points = @total
        WHERE LOWER(TRIM(customer_email)) = @email
      `);

    // Record transaction
    await pool.request()
      .input('email', sql.NVarChar, normalizedEmail)
      .input('type', sql.NVarChar, pointsAdjustment > 0 ? 'earned' : 'redeemed')
      .input('points', sql.Int, Math.abs(pointsAdjustment))
      .input('description', sql.NVarChar, `Manual adjustment: ${reason || 'Admin action'}`)
      .query(`
        INSERT INTO reward_transactions (customer_email, transaction_type, points_amount, description)
        VALUES (@email, @type, @points, @description)
      `);

    res.json({ 
      success: true, 
      message: 'Points adjusted successfully',
      newAvailablePoints,
      newTotalPoints
    });
  } catch (error) {
    console.error('[ADJUST POINTS] Error:', error.message);
    console.error('[ADJUST POINTS] Full error:', error);
    res.status(500).json({ error: error.message || 'Error adjusting points' });
  }
});

// Get coupon usage stats (Seller/Admin only)
router.get('/seller/coupon-stats', verifyToken, async (req, res) => {
  try {
    console.log('[COUPON STATS] User:', req.user);
    
    // Check role
    if (!['Seller', 'Administrator'].includes(req.user?.roleType)) {
      console.log('[COUPON STATS] Access denied - role:', req.user?.roleType);
      return res.status(403).json({ error: 'Only sellers and administrators can access this' });
    }

    const pool = await getConnection();
    console.log('[COUPON STATS] Database connection established');
    
    const result = await pool.request().query(`
      SELECT 
        d.id,
        d.code,
        d.discount_type,
        d.discount_value,
        d.max_uses,
        d.current_uses,
        d.is_active,
        ISNULL(COUNT(od.id), 0) as order_count,
        ISNULL(SUM(od.discount_amount), 0) as total_discount_given
      FROM discounts d
      LEFT JOIN order_discounts od ON d.id = od.discount_id
      GROUP BY d.id, d.code, d.discount_type, d.discount_value, d.max_uses, d.current_uses, d.is_active
      ORDER BY d.created_at DESC
    `);

    console.log('[COUPON STATS] Query returned:', result.recordset.length, 'records');
    res.json(result.recordset);
  } catch (error) {
    console.error('[ERROR] Get coupon stats error:', error.message);
    console.error('[ERROR] Full error:', error);
    res.status(500).json({ error: error.message || 'Error fetching coupon statistics' });
  }
});

module.exports = router;
