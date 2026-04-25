const express = require('express');
const { getConnection, sql } = require('../config');
const { verifyToken, optionalAuth, checkRole } = require('../middleware/auth');
const userService = require('../services/userService');
const router = express.Router();

function roundTo2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function extractCityFromShippingAddress(shippingAddress) {
  if (!shippingAddress || typeof shippingAddress !== 'string') {
    return null;
  }

  const match = shippingAddress.match(/,\s*([^,]+?)\s*-\s*\d+\s*$/);
  return match?.[1]?.trim() || null;
}

function normalizeOrdersWithDiscounts(rows) {
  const orderMap = new Map();

  for (const row of rows) {
    let order = orderMap.get(row.id);

    if (!order) {
      order = {
        id: row.id,
        order_number: row.order_number,
        total_amount: row.total_amount,
        status: row.status,
        customer_email: row.customer_email,
        customer_name: row.customer_name,
        customer_phone: row.customer_phone,
        shipping_address: row.shipping_address,
        payment_method: row.payment_method,
        payment_screenshot: row.payment_screenshot,
        discount_amount: row.discount_amount,
        applied_discount_code: row.applied_discount_code,
        created_at: row.created_at,
        updated_at: row.updated_at,
        discounts: []
      };
      orderMap.set(row.id, order);
    }

    if (row.od_discount_code) {
      order.discounts.push({
        discount_code: row.od_discount_code,
        discount_type: row.od_discount_type,
        discount_amount: row.od_discount_amount
      });
    }
  }

  return Array.from(orderMap.values());
}

// Generate unique order number
function generateOrderNumber() {
  return 'ORD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9).toUpperCase();
}

// Get seller's orders (all orders from all customers)
router.get('/seller/orders', verifyToken, async (req, res) => {
  try {
    const sellerId = req.user.userId;
    const pool = await getConnection();
    const hasPaginationQuery = req.query.page !== undefined || req.query.limit !== undefined || req.query.offset !== undefined;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 200);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const offset = req.query.offset !== undefined
      ? Math.max(parseInt(req.query.offset, 10) || 0, 0)
      : (page - 1) * limit;
    
    console.log('[ORDERS Seller] Fetching orders for seller:', sellerId, 'limit:', limit, 'offset:', offset, 'paged:', hasPaginationQuery);

    if (!hasPaginationQuery) {
      const fullResult = await pool.request()
        .query(`
         SELECT o.id, o.order_number, o.total_amount, o.status,
           o.customer_email, o.customer_name, u.PhoneNumber AS customer_phone, o.shipping_address,
           o.payment_method, o.payment_screenshot, o.discount_amount, o.applied_discount_code,
           o.created_at, o.updated_at,
           od.discount_code AS od_discount_code,
           od.discount_type AS od_discount_type,
           od.discount_amount AS od_discount_amount
         FROM orders o
         LEFT JOIN [User] u ON LOWER(LTRIM(RTRIM(u.UserName))) = LOWER(LTRIM(RTRIM(o.customer_email)))
         LEFT JOIN order_discounts od ON od.order_id = o.id
         ORDER BY o.created_at DESC
        `);

      const ordersWithDiscounts = normalizeOrdersWithDiscounts(fullResult.recordset || []);
      return res.json(ordersWithDiscounts);
    }

    const countResult = await pool.request().query('SELECT COUNT(*) AS total FROM orders');
    const total = countResult.recordset?.[0]?.total || 0;
    
    const result = await pool.request()
      .input('limit', sql.Int, limit)
      .input('offset', sql.Int, offset)
      .query(`
       WITH paged_orders AS (
         SELECT o.id, o.order_number, o.total_amount, o.status,
           o.customer_email, o.customer_name, u.PhoneNumber AS customer_phone, o.shipping_address,
           o.payment_method, o.payment_screenshot, o.discount_amount, o.applied_discount_code,
           o.created_at, o.updated_at
         FROM orders o
         LEFT JOIN [User] u ON LOWER(LTRIM(RTRIM(u.UserName))) = LOWER(LTRIM(RTRIM(o.customer_email)))
         ORDER BY o.created_at DESC
         OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
       )
       SELECT p.id, p.order_number, p.total_amount, p.status,
         p.customer_email, p.customer_name, p.customer_phone, p.shipping_address,
         p.payment_method, p.payment_screenshot, p.discount_amount, p.applied_discount_code,
         p.created_at, p.updated_at,
               od.discount_code AS od_discount_code,
               od.discount_type AS od_discount_type,
               od.discount_amount AS od_discount_amount
       FROM paged_orders p
       LEFT JOIN order_discounts od ON od.order_id = p.id
       ORDER BY p.created_at DESC
      `);
    
    const ordersWithDiscounts = normalizeOrdersWithDiscounts(result.recordset || []);

    res.json({
      orders: ordersWithDiscounts,
      pagination: {
        page,
        limit,
        offset,
        total,
        hasMore: offset + ordersWithDiscounts.length < total
      }
    });
  } catch (error) {
    console.error('[ERROR] Seller orders endpoint error:', error);
    res.status(500).json({ 
      error: error.message,
      details: 'Check server logs for more information'
    });
  }
});

// Get all orders for current logged-in user
router.get('/', verifyToken, async (req, res) => {
  try {
    const pool = await getConnection();
    // Normalize userName to match order storage: trim and lowercase.
    const userEmail = (req.user?.userName || '').trim().toLowerCase();

    const hasPaginationQuery = req.query.page !== undefined || req.query.limit !== undefined || req.query.offset !== undefined;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 200);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const offset = req.query.offset !== undefined
      ? Math.max(parseInt(req.query.offset, 10) || 0, 0)
      : (page - 1) * limit;

    if (!hasPaginationQuery) {
      const result = await pool.request()
        .input('customerEmail', sql.NVarChar, userEmail)
        .query(`
           SELECT o.id, o.order_number, o.total_amount, o.status, o.customer_email, o.customer_name,
            u.PhoneNumber AS customer_phone, o.shipping_address, o.payment_method, o.payment_screenshot, o.discount_amount, o.applied_discount_code,
             o.created_at, o.updated_at,
             od.discount_code AS od_discount_code,
             od.discount_type AS od_discount_type,
             od.discount_amount AS od_discount_amount
          FROM orders o
         LEFT JOIN [User] u ON LOWER(LTRIM(RTRIM(u.UserName))) = LOWER(LTRIM(RTRIM(o.customer_email)))
          LEFT JOIN order_discounts od ON od.order_id = o.id
          WHERE o.customer_email = @customerEmail
           ORDER BY o.created_at DESC
        `);

      const ordersWithDiscounts = normalizeOrdersWithDiscounts(result.recordset || []);
      return res.json(ordersWithDiscounts);
    }

    const countResult = await pool.request()
      .input('customerEmail', sql.NVarChar, userEmail)
      .query('SELECT COUNT(*) AS total FROM orders WHERE customer_email = @customerEmail');
    const total = countResult.recordset?.[0]?.total || 0;

    const result = await pool.request()
      .input('limit', sql.Int, limit)
      .input('offset', sql.Int, offset)
      .input('customerEmail', sql.NVarChar, userEmail)
      .query(`
         WITH paged_orders AS (
           SELECT o.id, o.order_number, o.total_amount, o.status,
             o.customer_email, o.customer_name, u.PhoneNumber AS customer_phone, o.shipping_address,
             o.payment_method, o.payment_screenshot, o.discount_amount, o.applied_discount_code,
             o.created_at, o.updated_at
           FROM orders o
           LEFT JOIN [User] u ON LOWER(LTRIM(RTRIM(u.UserName))) = LOWER(LTRIM(RTRIM(o.customer_email)))
           WHERE o.customer_email = @customerEmail
           ORDER BY o.created_at DESC
           OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
         )
         SELECT p.id, p.order_number, p.total_amount, p.status,
           p.customer_email, p.customer_name, p.customer_phone, p.shipping_address,
           p.payment_method, p.payment_screenshot, p.discount_amount, p.applied_discount_code,
           p.created_at, p.updated_at,
           od.discount_code AS od_discount_code,
           od.discount_type AS od_discount_type,
           od.discount_amount AS od_discount_amount
         FROM paged_orders p
         LEFT JOIN order_discounts od ON od.order_id = p.id
         ORDER BY p.created_at DESC
      `);

    const ordersWithDiscounts = normalizeOrdersWithDiscounts(result.recordset || []);
    
    res.json({
      orders: ordersWithDiscounts,
      pagination: {
        page,
        limit,
        offset,
        total,
        hasMore: offset + ordersWithDiscounts.length < total
      }
    });
  } catch (error) {
    console.error('[ORDERS Get] Error endpoint error:', error);
    console.error('[ORDERS Get] Error details:', {
      code: error.code,
      number: error.number,
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ 
      error: error.message,
      code: error.code,
      details: 'Failed to retrieve orders'
    });
  }
});

// Get shipping charge audit breakdown for an order (Seller/Admin only)
router.get('/:id/shipping-breakdown', async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }

    const pool = await getConnection();
    const orderResult = await pool.request()
      .input('orderId', sql.Int, orderId)
      .query(`
        SELECT id, order_number, shipping_address, shipping_charge
        FROM orders
        WHERE id = @orderId
      `);

    if (orderResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderResult.recordset[0];
    const cityName = extractCityFromShippingAddress(order.shipping_address);

    const itemsResult = await pool.request()
      .input('orderId', sql.Int, orderId)
      .query(`
        SELECT oi.product_id, oi.quantity, ISNULL(p.weight_kg, 0.50) AS weight_kg
        FROM order_items oi
        LEFT JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = @orderId
      `);

    const lineItems = itemsResult.recordset || [];
    const totalWeightKg = lineItems.reduce((acc, item) => {
      const itemWeight = Number(item.weight_kg) || 0.5;
      const quantity = Math.max(1, Number(item.quantity) || 1);
      return acc + (itemWeight * quantity);
    }, 0);

    const chargeableWeightKg = Math.max(1, Math.ceil(totalWeightKg));

    let zoneCode = null;
    let baseShippingCharge = null;
    let calculatedShippingCharge = null;

    if (cityName) {
      const cityResult = await pool.request()
        .input('city', sql.NVarChar(100), cityName)
        .query(`
          SELECT TOP 1 shipping_zone
          FROM cities
          WHERE LOWER(city_name) = LOWER(@city)
        `);

      if (cityResult.recordset.length > 0) {
        zoneCode = cityResult.recordset[0].shipping_zone;

        const zoneResult = await pool.request()
          .input('zoneCode', sql.NVarChar(20), zoneCode)
          .query(`
            SELECT TOP 1 shipping_charge
            FROM shipping_zones
            WHERE zone_code = @zoneCode AND is_active = 1
          `);

        if (zoneResult.recordset.length > 0) {
          baseShippingCharge = Number(zoneResult.recordset[0].shipping_charge || 0);
          calculatedShippingCharge = roundTo2(baseShippingCharge * chargeableWeightKg);
        }
      }
    }

    const storedShippingCharge = Number(order.shipping_charge || 0);

    res.json({
      orderId: order.id,
      orderNumber: order.order_number,
      city: cityName,
      zone: zoneCode,
      baseShippingCharge: baseShippingCharge !== null ? roundTo2(baseShippingCharge) : null,
      totalWeightKg: roundTo2(totalWeightKg),
      chargeableWeightKg,
      calculatedShippingCharge,
      storedShippingCharge: roundTo2(storedShippingCharge),
      difference: calculatedShippingCharge !== null
        ? roundTo2(storedShippingCharge - calculatedShippingCharge)
        : null,
      itemCount: lineItems.length
    });
  } catch (error) {
    console.error('[ORDERS Shipping Breakdown] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get order by ID with items
router.get('/:id', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query(`
        SELECT id, order_number, total_amount, status, customer_email, customer_name, 
               (
                 SELECT TOP 1 u.PhoneNumber
                 FROM [User] u
                 WHERE LOWER(LTRIM(RTRIM(u.UserName))) = LOWER(LTRIM(RTRIM(orders.customer_email)))
               ) AS customer_phone,
               shipping_address, payment_method, payment_screenshot, discount_amount, applied_discount_code,
               subtotal_amount, gst_amount, shipping_charge, created_at, updated_at
        FROM orders
        WHERE id = @id
      `);
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = result.recordset[0];
    
    // Get order items
    const itemsResult = await pool.request()
      .input('orderId', sql.Int, req.params.id)
      .query(`
        SELECT oi.id, oi.order_id, oi.product_id, oi.product_name, oi.quantity, oi.unit_price,
               (
                 SELECT TOP 1 image_url
                 FROM product_images
                 WHERE product_id = oi.product_id
                 ORDER BY ISNULL(is_primary, 0) DESC, display_order ASC, uploaded_at DESC
               ) AS image_url
        FROM order_items oi
        WHERE oi.order_id = @orderId
      `);
    
    order.items = itemsResult.recordset;

    // Get discount details
    const discountsResult = await pool.request()
      .input('orderId', sql.Int, req.params.id)
      .query(`
        SELECT discount_code, discount_type, discount_amount
        FROM order_discounts
        WHERE order_id = @orderId
      `);
    
    order.discounts = discountsResult.recordset || [];
    
    res.json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Create order from cart
router.post('/', optionalAuth, async (req, res) => {
  try {
    const { sessionId, customerEmail, customerName, customerPhone, shippingAddress, items, subtotalAmount, gstAmount, shippingCharge, totalAmount, paymentMethod, paymentScreenshot, orderDate, appliedDiscount, appliedRewards } = req.body;
    const effectiveGstAmount = 0;
    
    // Extract discount and reward values from objects
    const discountAmount = appliedDiscount?.amount || 0;
    const discountCode = appliedDiscount?.code || null;
    const rewardAmount = appliedRewards?.discountAmount || 0;
    const rewardCode = appliedRewards?.type === 'loyalty_points' ? `LOYALTY_POINTS_${appliedRewards?.points}` : null;
    
    console.log('[ORDERS Post] Received order creation request:', {
      customerEmail: customerEmail,
      customerName: customerName,
      itemCount: items?.length,
      subtotalAmount: subtotalAmount,
      discountAmount: discountAmount,
      discountCode: discountCode,
      rewardAmount: rewardAmount,
      rewardCode: rewardCode,
      gstAmount: effectiveGstAmount,
      shippingCharge: shippingCharge,
      totalAmount: totalAmount,
      paymentMethod: paymentMethod,
      rewardPoints: appliedRewards?.points || 0
    });
    
    if (!customerEmail || !customerName || !items || items.length === 0) {
      return res.status(400).json({ error: 'Missing required order information' });
    }

    // Validate minimum order value of ₹200
    const MINIMUM_ORDER_VALUE = 200;
    if (subtotalAmount < MINIMUM_ORDER_VALUE) {
      return res.status(400).json({ 
        error: `Minimum order value of ₹${MINIMUM_ORDER_VALUE} required. Current order value: ₹${subtotalAmount.toFixed(2)}` 
      });
    }

    const pool = await getConnection();
    const orderNumber = generateOrderNumber();
    
    // Normalize customer email by trimming whitespace and converting to lowercase
    const normalizedEmail = customerEmail.trim().toLowerCase();
    const authenticatedEmail = (req.user?.userName || '').trim().toLowerCase();

    if (appliedRewards?.points > 0) {
      if (!req.user) {
        return res.status(401).json({ error: 'Login required to apply loyalty points' });
      }

      if (authenticatedEmail !== normalizedEmail) {
        return res.status(403).json({ error: 'Loyalty points can only be applied to the logged-in customer account' });
      }
    }
    
    // Use provided orderDate or fall back to current server time
    const createdDate = orderDate ? new Date(orderDate) : new Date();

    console.log('[ORDERS Post] Creating order with normalized email:', normalizedEmail);

    // Start transaction
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // Create order
      const orderRequest = new sql.Request(transaction);
      const orderResult = await orderRequest
        .input('orderNumber', sql.NVarChar, orderNumber)
        .input('subtotalAmount', sql.Decimal(10, 2), subtotalAmount || 0)
        .input('gstAmount', sql.Decimal(10, 2), effectiveGstAmount)
        .input('shippingCharge', sql.Decimal(10, 2), shippingCharge || 0)
        .input('discountAmount', sql.Decimal(10, 2), discountAmount || 0)
        .input('discountCode', sql.NVarChar, discountCode || null)
        .input('rewardCodeUsed', sql.NVarChar, rewardCode || null)
        .input('totalAmount', sql.Decimal(10, 2), totalAmount)
        .input('customerEmail', sql.NVarChar, normalizedEmail)
        .input('customerName', sql.NVarChar, customerName)
        .input('shippingAddress', sql.NVarChar, shippingAddress || null)
        .input('paymentMethod', sql.NVarChar(50), paymentMethod || null)
        .input('paymentScreenshot', sql.NVarChar(sql.MAX), paymentScreenshot || null)
        .input('createdAt', sql.DateTime2, createdDate)
        .query(`
          INSERT INTO orders (order_number, subtotal_amount, gst_amount, shipping_charge, discount_amount, discount_code, reward_code_used, total_amount, customer_email, customer_name, shipping_address, payment_method, payment_screenshot, status, created_at)
          OUTPUT INSERTED.id, INSERTED.order_number, INSERTED.total_amount, INSERTED.status, 
                 INSERTED.customer_email, INSERTED.customer_name, INSERTED.shipping_address, INSERTED.payment_method,
                 INSERTED.created_at, INSERTED.updated_at
          VALUES (@orderNumber, @subtotalAmount, @gstAmount, @shippingCharge, @discountAmount, @discountCode, @rewardCodeUsed, @totalAmount, @customerEmail, @customerName, @shippingAddress, @paymentMethod, @paymentScreenshot, 'pending', @createdAt)
        `);

      const orderId = orderResult.recordset[0].id;
      console.log('[ORDERS Post] Order created with ID:', orderId, 'Order#:', orderResult.recordset[0].order_number);

      // Add order items and reduce stock
      for (const item of items) {
        const itemRequest = new sql.Request(transaction);
        await itemRequest
          .input('orderId', sql.Int, orderId)
          .input('productId', sql.Int, item.productId)
          .input('productName', sql.NVarChar, item.productName)
          .input('quantity', sql.Int, item.quantity)
          .input('unitPrice', sql.Decimal(10, 2), item.price)
          .query(`
            INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price)
            VALUES (@orderId, @productId, @productName, @quantity, @unitPrice)
          `);

        // Reduce stock only for non-preorder products.
        // Preorder items are allowed even when current stock is insufficient.
        const stockRequest = new sql.Request(transaction);
        const stockResult = await stockRequest
          .input('productId', sql.Int, item.productId)
          .input('quantity', sql.Int, item.quantity)
          .query(`
            UPDATE products 
            SET stock = CASE
              WHEN ISNULL(is_preorder, 0) = 1 THEN stock
              ELSE stock - @quantity
            END
            WHERE id = @productId
              AND (
                ISNULL(is_preorder, 0) = 1
                OR stock >= @quantity
              )
          `);

        if (stockResult.rowsAffected[0] === 0) {
          const productStateRequest = new sql.Request(transaction);
          const productStateResult = await productStateRequest
            .input('productId', sql.Int, item.productId)
            .query(`
              SELECT id, ISNULL(is_preorder, 0) AS is_preorder, stock
              FROM products
              WHERE id = @productId
            `);

          if (productStateResult.recordset.length === 0) {
            throw new Error(`Product not found for product ID: ${item.productId}`);
          }

          const productState = productStateResult.recordset[0];
          const isPreorder = Number(productState.is_preorder) === 1;

          if (isPreorder) {
            throw new Error(`Unable to process preorder item for product ID: ${item.productId}`);
          }

          throw new Error(`Insufficient stock for product ID: ${item.productId}. Available: ${productState.stock}, Requested: ${item.quantity}`);
        }

        console.log('[ORDERS Post] Stock reduced for product:', item.productId, 'by quantity:', item.quantity);
      }
      console.log('[ORDERS Post] Order items added:', items.length);

      // Clear cart
      const cartRequest = new sql.Request(transaction);
      await cartRequest
        .input('sessionId', sql.NVarChar, sessionId)
        .query('DELETE FROM cart_items WHERE cart_session_id = @sessionId');

      await transaction.commit();
      console.log('[ORDERS Post] Order transaction committed successfully');
      
      const orderEmail = orderResult.recordset[0].customer_email;
      
      // Update customer rewards after order is successfully created
      try {
        console.log('[ORDERS Post] Updating customer rewards for:', orderEmail, 'with product value (subtotal):', subtotalAmount);
        
        // Calculate points based on product value only (subtotalAmount), not GST or shipping
        // 1 point per ₹10 spent on products
        const pointsEarned = Math.floor(subtotalAmount / 10);

        // Get current customer rewards
        const rewardsResult = await pool.request()
          .input('email', sql.NVarChar, orderEmail)
          .query('SELECT * FROM customer_rewards WHERE LOWER(customer_email) = LOWER(@email)');

        let currentRewards = rewardsResult.recordset[0];

        if (!currentRewards) {
          // Initialize new customer rewards
          console.log('[ORDERS Post] No existing rewards found, creating new record for:', orderEmail);
          await pool.request()
            .input('email', sql.NVarChar, orderEmail)
            .query(`
              INSERT INTO customer_rewards (customer_email, total_points, available_points, total_spent, order_count)
              VALUES (@email, 0, 0, 0, 0)
            `);
          currentRewards = { total_points: 0, available_points: 0, redeemed_points: 0, total_spent: 0, order_count: 0 };
        }

        // Update customer rewards with new totals based on product value (subtotalAmount)
        const newTotalPoints = (currentRewards.total_points || 0) + pointsEarned;
        const newAvailablePoints = (currentRewards.available_points || 0) + pointsEarned;
        const newTotalSpent = (currentRewards.total_spent || 0) + subtotalAmount;
        const newOrderCount = (currentRewards.order_count || 0) + 1;

        // Determine loyalty tier based on total_spent (product value only)
        let loyaltyTier = 'Bronze';
        if (newTotalSpent >= 50000) loyaltyTier = 'Diamond';
        else if (newTotalSpent >= 25000) loyaltyTier = 'Platinum';
        else if (newTotalSpent >= 10000) loyaltyTier = 'Gold';
        else if (newTotalSpent >= 5000) loyaltyTier = 'Silver';

        console.log('[ORDERS Post] Updating rewards:', {
          email: orderEmail,
          subtotalAmount: subtotalAmount,
          pointsEarned: pointsEarned,
          newTotalPoints: newTotalPoints,
          newTotalSpent: newTotalSpent,
          newOrderCount: newOrderCount,
          tier: loyaltyTier
        });

        await pool.request()
          .input('email', sql.NVarChar, orderEmail)
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
            WHERE LOWER(customer_email) = LOWER(@email)
          `);

        // Record transaction
        await pool.request()
          .input('email', sql.NVarChar, orderEmail)
          .input('type', sql.NVarChar, 'earned')
          .input('points', sql.Int, pointsEarned)
          .input('orderId', sql.Int, orderId)
          .input('description', sql.NVarChar, `Earned ${pointsEarned} points from order #${orderResult.recordset[0].order_number}`)
          .query(`
            INSERT INTO reward_transactions (customer_email, transaction_type, points_amount, order_id, description)
            VALUES (@email, @type, @points, @orderId, @description)
          `);

        // Handle reward points redemption if customer redeemed points for this order
        if (appliedRewards && appliedRewards.points > 0) {
          console.log('[ORDERS Post] Processing reward points redemption:', {
            email: orderEmail,
            pointsRedeemed: appliedRewards.points,
            discountAmount: appliedRewards.discountAmount
          });

          // Get current rewards again to ensure we have latest data
          const currentRewardsCheck = await pool.request()
            .input('email', sql.NVarChar, orderEmail)
            .query('SELECT available_points, redeemed_points FROM customer_rewards WHERE LOWER(customer_email) = LOWER(@email)');

          if (currentRewardsCheck.recordset.length > 0) {
            const currentCheck = currentRewardsCheck.recordset[0];
            const availableAfterEarning = (currentCheck.available_points || 0);
            const redeemCount = Math.min(appliedRewards.points, availableAfterEarning);

            if (redeemCount > 0) {
              const newAvailableAfterRedeem = availableAfterEarning - redeemCount;
              const newRedeemedTotal = (currentCheck.redeemed_points || 0) + redeemCount;

              // Update available points and redeemed points
              await pool.request()
                .input('email', sql.NVarChar, orderEmail)
                .input('availablePoints', sql.Int, newAvailableAfterRedeem)
                .input('redeemedPoints', sql.Int, newRedeemedTotal)
                .query(`
                  UPDATE customer_rewards
                  SET available_points = @availablePoints,
                      redeemed_points = @redeemedPoints
                  WHERE LOWER(customer_email) = LOWER(@email)
                `);

              // Record redemption transaction
              await pool.request()
                .input('email', sql.NVarChar, orderEmail)
                .input('type', sql.NVarChar, 'redeemed')
                .input('points', sql.Int, redeemCount)
                .input('orderId', sql.Int, orderId)
                .input('description', sql.NVarChar, `Redeemed ${redeemCount} points for ₹${appliedRewards.discountAmount || redeemCount} discount on order #${orderResult.recordset[0].order_number}`)
                .query(`
                  INSERT INTO reward_transactions (customer_email, transaction_type, points_amount, order_id, description)
                  VALUES (@email, @type, @points, @orderId, @description)
                `);

              // Insert order discount record for loyalty rewards
              await pool.request()
                .input('orderId', sql.Int, orderId)
                .input('code', sql.NVarChar, `LOYALTY_POINTS_${redeemCount}`)
                .input('discountAmount', sql.Decimal(10, 2), appliedRewards.discountAmount || 0)
                .input('discountType', sql.NVarChar, 'loyalty_points')
                .query(`
                  INSERT INTO order_discounts (order_id, discount_code, discount_type, discount_amount)
                  VALUES (@orderId, @code, @discountType, @discountAmount)
                `);

              console.log('[ORDERS Post] Reward points redeemed successfully:', {
                email: orderEmail,
                pointsRedeemed: redeemCount,
                newAvailable: newAvailableAfterRedeem,
                discountAmountRecorded: appliedRewards.discountAmount
              });
            }
          }
        }

        console.log('[ORDERS Post] Customer rewards updated successfully');
      } catch (rewardError) {
        console.error('[ORDERS Post] Error updating rewards (non-blocking):', rewardError.message);
        // Don't fail the order creation if rewards fail to update
      }

      // Handle coupon code usage tracking
      if (appliedDiscount && appliedDiscount.code) {
        try {
          console.log('[ORDERS Post] Processing coupon code:', {
            code: appliedDiscount.code,
            discountAmount: appliedDiscount.amount
          });

          // Get discount ID and update usage
          const couponResult = await pool.request()
            .input('code', sql.NVarChar, appliedDiscount.code.toUpperCase())
            .query(`
              SELECT id FROM discounts 
              WHERE UPPER(code) = @code
            `);

          if (couponResult.recordset.length > 0) {
            const discountId = couponResult.recordset[0].id;

            // Insert order discount record
            await pool.request()
              .input('orderId', sql.Int, orderId)
              .input('discountId', sql.Int, discountId)
              .input('code', sql.NVarChar, appliedDiscount.code.toUpperCase())
              .input('discountAmount', sql.Decimal(10, 2), appliedDiscount.amount || 0)
              .input('discountType', sql.NVarChar, appliedDiscount.type || 'coupon')
              .query(`
                INSERT INTO order_discounts (order_id, discount_id, discount_code, discount_type, discount_amount)
                VALUES (@orderId, @discountId, @code, @discountType, @discountAmount)
              `);

            // Increment coupon usage count
            const updateResult = await pool.request()
              .input('code', sql.NVarChar, appliedDiscount.code.toUpperCase())
              .query(`
                UPDATE discounts
                SET current_uses = current_uses + 1
                WHERE UPPER(code) = @code;
                
                SELECT current_uses FROM discounts WHERE UPPER(code) = @code
              `);

            const newUsageCount = updateResult.recordset[updateResult.recordset.length - 1]?.[0]?.current_uses;
            console.log('[ORDERS Post] Coupon usage count updated:', {
              code: appliedDiscount.code,
              newUsage: newUsageCount
            });
          } else {
            console.warn('[ORDERS Post] Coupon code not found in database:', appliedDiscount.code);
          }
        } catch (couponError) {
          console.error('[ORDERS Post] Error updating coupon usage (non-blocking):', couponError.message);
          // Don't fail the order creation if coupon tracking fails
        }
      }
      
      console.log('[ORDERS Post] Returning order:', {
        id: orderResult.recordset[0].id,
        order_number: orderResult.recordset[0].order_number,
        customer_email: orderResult.recordset[0].customer_email
      });

      let checkoutAuth = null;

      // Guest checkout: auto register/login using email + phone so customer can access account immediately.
      if (!req.user && customerPhone) {
        try {
          checkoutAuth = await userService.checkoutAutoRegisterOrLogin(
            normalizedEmail,
            customerName,
            customerPhone,
            shippingAddress || null
          );
        } catch (authError) {
          console.warn('[ORDERS Post] Checkout auto auth skipped:', authError.message);
        }
      }

      res.status(201).json({
        ...orderResult.recordset[0],
        checkoutAuth
      });
    } catch (error) {
      console.error('[ORDERS Post] Transaction error:', error);
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error('[ORDERS Post] Endpoint error:', error.message);
    console.error('[ORDERS Post] Full error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update order status
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    // Validate status values
    const validStatuses = ['pending', 'processing', 'ready for shipping', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const pool = await getConnection();
    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('status', sql.NVarChar, status)
      .query(`
        UPDATE orders 
        SET status = @status, updated_at = GETDATE()
        OUTPUT INSERTED.id, INSERTED.order_number, INSERTED.total_amount, INSERTED.status, 
               INSERTED.customer_email, INSERTED.customer_name, INSERTED.shipping_address, 
               INSERTED.payment_screenshot, INSERTED.created_at, INSERTED.updated_at
        WHERE id = @id
      `);
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(result.recordset[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
