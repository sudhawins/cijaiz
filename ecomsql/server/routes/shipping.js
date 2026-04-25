const express = require('express');
const { getConnection, sql } = require('../config');
const { verifyToken, optionalAuth, checkRole } = require('../middleware/auth');
const router = express.Router();

function roundTo2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function getEstimatedDistanceKm(zoneCode) {
  const normalizedZone = String(zoneCode || '').trim().toUpperCase();
  const compactZone = normalizedZone.replace(/[^A-Z0-9]/g, '');
  const distanceByZone = {
    A: 15,
    B: 40,
    C: 90,
    D: 180,
    E: 320,
    NORTH: 80,
    SOUTH: 80,
    EAST: 80,
    WEST: 80,
    CENTRAL: 45
  };

  if (distanceByZone[normalizedZone]) {
    return distanceByZone[normalizedZone];
  }

  const zoneSuffix = compactZone.match(/([A-E])$/);
  if (zoneSuffix && distanceByZone[zoneSuffix[1]]) {
    return distanceByZone[zoneSuffix[1]];
  }

  return null;
}

async function hasSellerIdColumn(pool) {
  const result = await pool.request().query(`
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID('shipping_zones')
      AND name = 'seller_id'
  `);

  return result.recordset.length > 0;
}

// Get all cities with their shipping zones
router.get('/all', async (req, res) => {
  try {
    const pool = await getConnection();
    const supportsSellerScopedZones = await hasSellerIdColumn(pool);
    
    const result = await pool.request()
      .query(`
        SELECT 
          id,
          city_name,
          zip_code,
          state,
          shipping_zone
        FROM cities
        WHERE shipping_zone IS NOT NULL
        ORDER BY city_name
      `);
    
    res.json(result.recordset);
  } catch (error) {
    console.error('[ERROR] Cities endpoint error:', error);
    res.status(500).json({ 
      error: error.message,
      details: 'Failed to fetch cities'
    });
  }
});

// Get shipping zones
router.get('/shipping-zones', optionalAuth, async (req, res) => {
  try {
    const pool = await getConnection();
    const supportsSellerScopedZones = await hasSellerIdColumn(pool);

    let result;

    if (!supportsSellerScopedZones) {
      result = await pool.request().query(`
        SELECT
          id,
          zone_name,
          zone_code,
          shipping_charge,
          description
        FROM shipping_zones
        WHERE is_active = 1
        ORDER BY shipping_charge
      `);
    } else if (req.user?.roleType === 'Seller') {
      result = await pool.request()
        .input('sellerId', sql.Int, req.user.userId)
        .query(`
          SELECT
            id,
            zone_name,
            zone_code,
            shipping_charge,
            description,
            seller_id
          FROM shipping_zones
          WHERE is_active = 1 AND seller_id = @sellerId
          ORDER BY shipping_charge
        `);
    } else if (req.user?.roleType === 'Administrator') {
      result = await pool.request().query(`
        SELECT
          id,
          zone_name,
          zone_code,
          shipping_charge,
          description,
          seller_id
        FROM shipping_zones
        WHERE is_active = 1
        ORDER BY CASE WHEN seller_id IS NULL THEN 0 ELSE 1 END, shipping_charge
      `);
    } else {
      result = await pool.request().query(`
        SELECT
          id,
          zone_name,
          zone_code,
          shipping_charge,
          description
        FROM shipping_zones
        WHERE is_active = 1 AND seller_id IS NULL
        ORDER BY shipping_charge
      `);
    }
    
    res.json(result.recordset);
  } catch (error) {
    console.error('[ERROR] Shipping zones endpoint error:', error);
    res.status(500).json({ 
      error: error.message,
      details: 'Failed to fetch shipping zones'
    });
  }
});

// Calculate shipping charge based on city zone and total cart weight.
router.post('/calculate', async (req, res) => {
  try {
    const { city, items } = req.body;

    if (!city || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'city and items are required' });
    }

    const sanitizedItems = items
      .map(item => ({
        productId: Number(item.productId),
        quantity: Math.max(1, Number(item.quantity) || 1)
      }))
      .filter(item => Number.isInteger(item.productId) && item.productId > 0);

    if (sanitizedItems.length === 0) {
      return res.status(400).json({ error: 'At least one valid product item is required' });
    }

    const pool = await getConnection();

    const cityResult = await pool.request()
      .input('city', sql.NVarChar(100), city.trim())
      .query(`
        SELECT TOP 1 shipping_zone, city_name
        FROM cities
        WHERE LOWER(city_name) = LOWER(@city)
      `);

    if (cityResult.recordset.length === 0) {
      return res.status(404).json({ error: 'City not found for shipping calculation' });
    }

    const { shipping_zone: zoneCode, city_name: cityName } = cityResult.recordset[0];
    const uniqueProductIds = [...new Set(sanitizedItems.map(item => item.productId))];
    const supportsSellerScopedZones = await hasSellerIdColumn(pool);

    const productsRequest = pool.request();
    const productIdParams = uniqueProductIds.map((productId, index) => {
      const paramName = `productId${index}`;
      productsRequest.input(paramName, sql.Int, productId);
      return `@${paramName}`;
    });

    const productsResult = await productsRequest.query(`
      SELECT id, ISNULL(weight_kg, 0.50) AS weight_kg, seller_id
      FROM products
      WHERE id IN (${productIdParams.join(', ')})
    `);

    const weightsByProductId = new Map(
      productsResult.recordset.map(row => [Number(row.id), Number(row.weight_kg) || 0.5])
    );

    let totalWeightKg = 0;
    for (const item of sanitizedItems) {
      const itemWeight = weightsByProductId.get(item.productId) || 0.5;
      totalWeightKg += itemWeight * item.quantity;
    }

    const sellerIds = [...new Set(
      productsResult.recordset
        .map(row => Number(row.seller_id))
        .filter(id => Number.isInteger(id) && id > 0)
    )];

    const sellerIdForRate = sellerIds.length === 1 ? sellerIds[0] : null;
    let zoneResult;

    if (supportsSellerScopedZones && sellerIdForRate) {
      zoneResult = await pool.request()
        .input('zoneCode', sql.NVarChar(20), zoneCode)
        .input('sellerId', sql.Int, sellerIdForRate)
        .query(`
          SELECT TOP 1 shipping_charge, seller_id
          FROM shipping_zones
          WHERE zone_code = @zoneCode
            AND is_active = 1
            AND (seller_id = @sellerId OR seller_id IS NULL)
          ORDER BY CASE WHEN seller_id = @sellerId THEN 0 ELSE 1 END
        `);
    } else if (supportsSellerScopedZones) {
      zoneResult = await pool.request()
        .input('zoneCode', sql.NVarChar(20), zoneCode)
        .query(`
          SELECT TOP 1 shipping_charge, seller_id
          FROM shipping_zones
          WHERE zone_code = @zoneCode
            AND is_active = 1
            AND seller_id IS NULL
        `);
    } else {
      zoneResult = await pool.request()
        .input('zoneCode', sql.NVarChar(20), zoneCode)
        .query(`
          SELECT TOP 1 shipping_charge
          FROM shipping_zones
          WHERE zone_code = @zoneCode AND is_active = 1
        `);
    }

    if (zoneResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Shipping zone not found or inactive' });
    }

    const baseShippingCharge = Number(zoneResult.recordset[0].shipping_charge || 0);

    const chargeableWeightKg = Math.max(1, Math.ceil(totalWeightKg));
    const shippingCharge = roundTo2(baseShippingCharge * chargeableWeightKg);
    const estimatedDistanceKm = getEstimatedDistanceKm(zoneCode);

    res.json({
      success: true,
      city: cityName,
      zone: zoneCode,
      baseShippingCharge: roundTo2(baseShippingCharge),
      totalWeightKg: roundTo2(totalWeightKg),
      chargeableWeightKg,
      estimatedDistanceKm,
      sellerIdForRate,
      shippingCharge
    });
  } catch (error) {
    console.error('[ERROR] Shipping calculation error:', error);
    res.status(500).json({
      error: error.message,
      details: 'Failed to calculate shipping'
    });
  }
});

// Backward-compatible endpoint used by checkout helper.
router.get('/rate-by-city', async (req, res) => {
  try {
    const { city } = req.query;

    if (!city) {
      return res.status(400).json({ error: 'city query parameter is required' });
    }

    const pool = await getConnection();

    const cityResult = await pool.request()
      .input('city', sql.NVarChar(100), city.trim())
      .query(`
        SELECT TOP 1 shipping_zone, city_name
        FROM cities
        WHERE LOWER(city_name) = LOWER(@city)
      `);

    if (cityResult.recordset.length === 0) {
      return res.status(404).json({ error: 'City not found' });
    }

    const { shipping_zone: zoneCode, city_name: cityName } = cityResult.recordset[0];
    const zoneResult = supportsSellerScopedZones
      ? await pool.request()
          .input('zoneCode', sql.NVarChar(20), zoneCode)
          .query(`
            SELECT TOP 1 shipping_charge
            FROM shipping_zones
            WHERE zone_code = @zoneCode AND is_active = 1 AND seller_id IS NULL
          `)
      : await pool.request()
          .input('zoneCode', sql.NVarChar(20), zoneCode)
          .query(`
            SELECT TOP 1 shipping_charge
            FROM shipping_zones
            WHERE zone_code = @zoneCode AND is_active = 1
          `);

    if (zoneResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Shipping zone not found or inactive' });
    }

    const shippingCharge = roundTo2(zoneResult.recordset[0].shipping_charge || 0);
    res.json({ success: true, city: cityName, zone: zoneCode, shippingCharge });
  } catch (error) {
    console.error('[ERROR] Rate by city endpoint error:', error);
    res.status(500).json({
      error: error.message,
      details: 'Failed to fetch shipping rate by city'
    });
  }
});

// Search cities by name or zipcode
router.get('/search', async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.length < 1) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }
    
    const pool = await getConnection();
    
    const result = await pool.request()
      .input('searchQuery', sql.NVarChar(100), `${query}%`)
      .query(`
        SELECT TOP 20
          id,
          city_name,
          zip_code,
          state,
          shipping_zone
        FROM cities
        WHERE city_name LIKE @searchQuery OR zip_code LIKE @searchQuery
        ORDER BY city_name
      `);
    
    res.json(result.recordset);
  } catch (error) {
    console.error('[ERROR] City search endpoint error:', error);
    res.status(500).json({ 
      error: error.message,
      details: 'Failed to search cities'
    });
  }
});

// Get city by name
router.get('/by-city/:cityName', async (req, res) => {
  try {
    const { cityName } = req.params;
    
    const pool = await getConnection();
    
    const result = await pool.request()
      .input('cityName', sql.NVarChar(100), cityName)
      .query(`
        SELECT 
          id,
          city_name,
          zip_code,
          state,
          shipping_zone
        FROM cities
        WHERE city_name = @cityName
      `);
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'City not found' });
    }
    
    res.json(result.recordset[0]);
  } catch (error) {
    console.error('[ERROR] Get city by name error:', error);
    res.status(500).json({ 
      error: error.message,
      details: 'Failed to fetch city'
    });
  }
});

// Get cities by state
router.get('/by-state/:state', async (req, res) => {
  try {
    const { state } = req.params;
    
    const pool = await getConnection();
    
    const result = await pool.request()
      .input('state', sql.NVarChar(50), state)
      .query(`
        SELECT 
          id,
          city_name,
          zip_code,
          state,
          shipping_zone
        FROM cities
        WHERE state = @state
        ORDER BY city_name
      `);
    
    res.json(result.recordset);
  } catch (error) {
    console.error('[ERROR] Get cities by state error:', error);
    res.status(500).json({ 
      error: error.message,
      details: 'Failed to fetch cities by state'
    });
  }
});

// Get shipping charge by zone code
router.get('/shipping/:zoneCode', async (req, res) => {
  try {
    const { zoneCode } = req.params;
    
    const pool = await getConnection();
    const supportsSellerScopedZones = await hasSellerIdColumn(pool);
    
    const result = supportsSellerScopedZones
      ? await pool.request()
          .input('zoneCode', sql.NVarChar(20), zoneCode)
          .query(`
            SELECT
              zone_name,
              zone_code,
              shipping_charge
            FROM shipping_zones
            WHERE zone_code = @zoneCode AND is_active = 1 AND seller_id IS NULL
          `)
      : await pool.request()
          .input('zoneCode', sql.NVarChar(20), zoneCode)
          .query(`
            SELECT
              zone_name,
              zone_code,
              shipping_charge
            FROM shipping_zones
            WHERE zone_code = @zoneCode AND is_active = 1
          `);
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Shipping zone not found' });
    }
    
    res.json(result.recordset[0]);
  } catch (error) {
    console.error('[ERROR] Get shipping charge error:', error);
    res.status(500).json({ 
      error: error.message,
      details: 'Failed to fetch shipping charge'
    });
  }
});

// Get all states
router.get('/states/all', async (req, res) => {
  try {
    const pool = await getConnection();
    
    const result = await pool.request()
      .query(`
        SELECT DISTINCT state
        FROM cities
        WHERE state IS NOT NULL
        ORDER BY state
      `);
    
    const states = result.recordset.map(row => row.state);
    res.json(states);
  } catch (error) {
    console.error('[ERROR] Get states error:', error);
    res.status(500).json({ 
      error: error.message,
      details: 'Failed to fetch states'
    });
  }
});

// ============================================================================
// MANAGEMENT ENDPOINTS - Protected (Seller & Admin Only)
// ============================================================================

// Add a new city
router.post('/manage/cities', verifyToken, checkRole(['Seller', 'Administrator']), async (req, res) => {
  try {
    const { city_name, zip_code, state, shipping_zone } = req.body;

    if (!city_name || !zip_code || !state || !shipping_zone) {
      return res.status(400).json({ 
        error: 'Missing required fields: city_name, zip_code, state, shipping_zone' 
      });
    }

    const pool = await getConnection();

    const result = await pool.request()
      .input('city_name', sql.NVarChar(100), city_name)
      .input('zip_code', sql.NVarChar(10), zip_code)
      .input('state', sql.NVarChar(50), state)
      .input('shipping_zone', sql.NVarChar(20), shipping_zone)
      .query(`
        INSERT INTO cities (city_name, zip_code, state, shipping_zone, created_at)
        VALUES (@city_name, @zip_code, @state, @shipping_zone, GETUTCDATE())
        SELECT SCOPE_IDENTITY() as id
      `);

    res.status(201).json({ 
      message: 'City added successfully',
      id: result.recordset[0].id
    });
  } catch (error) {
    console.error('[ERROR] Add city error:', error);
    res.status(500).json({ 
      error: error.message,
      details: 'Failed to add city'
    });
  }
});

// Update a city
router.put('/manage/cities/:id', verifyToken, checkRole(['Seller', 'Administrator']), async (req, res) => {
  try {
    const { id } = req.params;
    const { city_name, zip_code, state, shipping_zone } = req.body;

    if (!city_name && !zip_code && !state && !shipping_zone) {
      return res.status(400).json({ 
        error: 'At least one field is required for update' 
      });
    }

    const pool = await getConnection();

    let updateQuery = 'UPDATE cities SET ';
    const updates = [];
    
    if (city_name) updates.push('city_name = @city_name');
    if (zip_code) updates.push('zip_code = @zip_code');
    if (state) updates.push('state = @state');
    if (shipping_zone) updates.push('shipping_zone = @shipping_zone');
    
    updateQuery += updates.join(', ') + ', updated_at = GETUTCDATE() WHERE id = @id';

    const request = pool.request()
      .input('id', sql.Int, id);

    if (city_name) request.input('city_name', sql.NVarChar(100), city_name);
    if (zip_code) request.input('zip_code', sql.NVarChar(10), zip_code);
    if (state) request.input('state', sql.NVarChar(50), state);
    if (shipping_zone) request.input('shipping_zone', sql.NVarChar(20), shipping_zone);

    const result = await request.query(updateQuery);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'City not found' });
    }

    res.json({ message: 'City updated successfully' });
  } catch (error) {
    console.error('[ERROR] Update city error:', error);
    res.status(500).json({ 
      error: error.message,
      details: 'Failed to update city'
    });
  }
});

// Delete a city
router.delete('/manage/cities/:id', verifyToken, checkRole(['Seller', 'Administrator']), async (req, res) => {
  try {
    const { id } = req.params;

    const pool = await getConnection();

    const result = await pool.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM cities WHERE id = @id');

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'City not found' });
    }

    res.json({ message: 'City deleted successfully' });
  } catch (error) {
    console.error('[ERROR] Delete city error:', error);
    res.status(500).json({ 
      error: error.message,
      details: 'Failed to delete city'
    });
  }
});

// Add a new shipping zone
router.post('/manage/zones', verifyToken, checkRole(['Seller', 'Administrator']), async (req, res) => {
  try {
    const { zone_name, zone_code, shipping_charge, description } = req.body;

    if (!zone_name || !zone_code || shipping_charge === undefined) {
      return res.status(400).json({ 
        error: 'Missing required fields: zone_name, zone_code, shipping_charge' 
      });
    }

    const pool = await getConnection();
    const supportsSellerScopedZones = await hasSellerIdColumn(pool);
    const isSeller = req.user?.roleType === 'Seller';

    if (isSeller && !supportsSellerScopedZones) {
      return res.status(400).json({ error: 'Seller-specific shipping rates require database migration' });
    }

    const sellerId = supportsSellerScopedZones && isSeller ? req.user.userId : null;

    let result;

    if (supportsSellerScopedZones) {
      result = await pool.request()
        .input('zone_name', sql.NVarChar(50), zone_name)
        .input('zone_code', sql.NVarChar(20), zone_code)
        .input('shipping_charge', sql.Decimal(10, 2), shipping_charge)
        .input('description', sql.NVarChar(255), description || null)
        .input('is_active', sql.Bit, 1)
        .input('seller_id', sql.Int, sellerId)
        .query(`
          INSERT INTO shipping_zones (zone_name, zone_code, shipping_charge, description, is_active, seller_id, created_at)
          VALUES (@zone_name, @zone_code, @shipping_charge, @description, @is_active, @seller_id, GETUTCDATE())
          SELECT SCOPE_IDENTITY() as id
        `);
    } else {
      result = await pool.request()
        .input('zone_name', sql.NVarChar(50), zone_name)
        .input('zone_code', sql.NVarChar(20), zone_code)
        .input('shipping_charge', sql.Decimal(10, 2), shipping_charge)
        .input('description', sql.NVarChar(255), description || null)
        .input('is_active', sql.Bit, 1)
        .query(`
          INSERT INTO shipping_zones (zone_name, zone_code, shipping_charge, description, is_active, created_at)
          VALUES (@zone_name, @zone_code, @shipping_charge, @description, @is_active, GETUTCDATE())
          SELECT SCOPE_IDENTITY() as id
        `);
    }

    res.status(201).json({ 
      message: 'Shipping zone added successfully',
      id: result.recordset[0].id
    });
  } catch (error) {
    console.error('[ERROR] Add shipping zone error:', error);
    res.status(500).json({ 
      error: error.message,
      details: 'Failed to add shipping zone'
    });
  }
});

// Update a shipping zone
router.put('/manage/zones/:id', verifyToken, checkRole(['Seller', 'Administrator']), async (req, res) => {
  try {
    const { id } = req.params;
    const { zone_name, zone_code, shipping_charge, description, is_active } = req.body;

    if (!zone_name && !zone_code && shipping_charge === undefined && description === undefined && is_active === undefined) {
      return res.status(400).json({ 
        error: 'At least one field is required for update' 
      });
    }

    const pool = await getConnection();
    const supportsSellerScopedZones = await hasSellerIdColumn(pool);
    const isSeller = req.user?.roleType === 'Seller';

    if (isSeller && !supportsSellerScopedZones) {
      return res.status(400).json({ error: 'Seller-specific shipping rates require database migration' });
    }

    let updateQuery = 'UPDATE shipping_zones SET ';
    const updates = [];
    
    if (zone_name) updates.push('zone_name = @zone_name');
    if (zone_code) updates.push('zone_code = @zone_code');
    if (shipping_charge !== undefined) updates.push('shipping_charge = @shipping_charge');
    if (description !== undefined) updates.push('description = @description');
    if (is_active !== undefined) updates.push('is_active = @is_active');
    
    updateQuery += updates.join(', ') + ', updated_at = GETUTCDATE() WHERE id = @id';
    if (supportsSellerScopedZones && isSeller) {
      updateQuery += ' AND seller_id = @sellerId';
    }

    const request = pool.request()
      .input('id', sql.Int, id);

    if (supportsSellerScopedZones && isSeller) {
      request.input('sellerId', sql.Int, req.user.userId);
    }

    if (zone_name) request.input('zone_name', sql.NVarChar(50), zone_name);
    if (zone_code) request.input('zone_code', sql.NVarChar(20), zone_code);
    if (shipping_charge !== undefined) request.input('shipping_charge', sql.Decimal(10, 2), shipping_charge);
    if (description !== undefined) request.input('description', sql.NVarChar(255), description);
    if (is_active !== undefined) request.input('is_active', sql.Bit, is_active);

    const result = await request.query(updateQuery);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Shipping zone not found' });
    }

    res.json({ message: 'Shipping zone updated successfully' });
  } catch (error) {
    console.error('[ERROR] Update shipping zone error:', error);
    res.status(500).json({ 
      error: error.message,
      details: 'Failed to update shipping zone'
    });
  }
});

// Delete a shipping zone
router.delete('/manage/zones/:id', verifyToken, checkRole(['Seller', 'Administrator']), async (req, res) => {
  try {
    const { id } = req.params;

    const pool = await getConnection();
    const supportsSellerScopedZones = await hasSellerIdColumn(pool);
    const isSeller = req.user?.roleType === 'Seller';

    if (isSeller && !supportsSellerScopedZones) {
      return res.status(400).json({ error: 'Seller-specific shipping rates require database migration' });
    }

    const request = pool.request()
      .input('id', sql.Int, id);

    let deleteQuery = 'DELETE FROM shipping_zones WHERE id = @id';
    if (supportsSellerScopedZones && isSeller) {
      request.input('sellerId', sql.Int, req.user.userId);
      deleteQuery += ' AND seller_id = @sellerId';
    }

    const result = await request.query(deleteQuery);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Shipping zone not found' });
    }

    res.json({ message: 'Shipping zone deleted successfully' });
  } catch (error) {
    console.error('[ERROR] Delete shipping zone error:', error);
    res.status(500).json({ 
      error: error.message,
      details: 'Failed to delete shipping zone'
    });
  }
});

module.exports = router;
