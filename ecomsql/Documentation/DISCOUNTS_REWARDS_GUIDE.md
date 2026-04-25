# Discounts & Loyalty Rewards System

## Overview
A comprehensive discount and loyalty rewards system that includes:
- **Coupon Codes**: Percentage and fixed amount discounts with validation
- **Loyalty Points**: Earn points on purchases, redeem for discounts
- **Tier-Based Benefits**: Silver, Gold, Platinum, Diamond tiers with escalating benefits
- **Real-time Calculation**: Automatic discount computation and tier progression

## Features

### 1. Coupon Code System
- **Percentage Discounts**: e.g., 10% off
- **Fixed Amount Discounts**: e.g., ₹50 off
- **Validation Rules**:
  - Minimum order amount requirements
  - Usage limits per coupon
  - Validity date ranges (valid_from, valid_until)
  - Active/Inactive status
  - Maximum discount caps
- **One Coupon Per Order**: Only one coupon code can be applied per order

### 1.5. Minimum Order Value Requirement
- **Global Minimum**: ₹200 (applies to all orders)
- **Validation**: Checked during order placement
- **Error Handling**: Order is rejected if subtotal < ₹200 with clear error message
- **Scope**: Applies before GST and shipping charges are added

### 2. Loyalty Points Program
- **Earn Rate**: 1 point per ₹10 spent (10% of order value)
- **Redemption**: 1 point = ₹0.10 (10 paisa)
- **Minimum Order Value**: ₹200 (orders below this amount cannot be placed)
- **Automatic Tier Upgrade**: Based on total spending
  - **Silver**: ₹0+ (default)
  - **Gold**: ₹10,000+
  - **Platinum**: ₹25,000+
  - **Diamond**: ₹50,000+

### 3. Tier Benefits

| Tier | Point Multiplier | Extra Discount | Benefits |
|------|------------------|-----------------|----------|
| Silver | 1x | 0% | Welcome offer |
| Gold | 1.25x | 5% | Priority support, Extra discount |
| Platinum | 1.5x | 10% | Free select shipping, Exclusive access |
| Diamond | 2x | 15% | Free all shipping, Concierge support, Events |

### 4. Order Discounts
- Track all discounts applied to each order
- Support multiple discount types: coupon, loyalty_points, tier_bonus
- Store discount history for analytics

## Database Schema

### Tables Created

```sql
-- Discounts Table (Coupon Codes)
discounts
  ├── id (PK)
  ├── code (UNIQUE)
  ├── description
  ├── discount_type ('percentage' or 'fixed')
  ├── discount_value
  ├── max_uses
  ├── current_uses
  ├── min_order_amount
  ├── max_discount_amount
  ├── valid_from (DATETIME)
  ├── valid_until (DATETIME)
  ├── is_active (BIT)
  └── timestamps

-- Customer Rewards Table
customer_rewards
  ├── id (PK)
  ├── customer_email (UNIQUE)
  ├── total_points
  ├── redeemed_points
  ├── available_points
  ├── loyalty_tier
  ├── total_spent
  ├── order_count
  ├── last_order_date
  └── timestamps

-- Reward Transactions Table
reward_transactions
  ├── id (PK)
  ├── customer_email (FK)
  ├── transaction_type ('earned' or 'redeemed')
  ├── points_amount
  ├── order_id (FK)
  ├── description
  └── created_at

-- Order Discounts Table
order_discounts
  ├── id (PK)
  ├── order_id (FK)
  ├── discount_id (FK)
  ├── discount_code
  ├── discount_type
  ├── discount_amount
  └── applied_at
```

### Orders Table Updates
Added columns to orders table:
- `discount_amount DECIMAL(10, 2)` - Total discount applied
- `loyalty_points_used INT` - Points redeemed in order
- `loyalty_points_earned INT` - Points earned from order
- `applied_discount_code NVARCHAR(50)` - Coupon code applied

## API Endpoints

### Discount Endpoints

#### 1. Validate Coupon
```
POST /api/discounts/validate-coupon
```
**Request:**
```json
{
  "code": "WELCOME10",
  "orderAmount": 1500,
  "customerEmail": "user@example.com"
}
```

**Response:**
```json
{
  "valid": true,
  "discountCode": "WELCOME10",
  "discountType": "percentage",
  "discountValue": 10,
  "discountAmount": 150,
  "savings": 150
}
```

**Validation Checks:**
- Code exists and is active
- Within validity dates
- Usage limit not exceeded
- Minimum order amount met
- Applied discount cap considered

#### 2. Apply Coupon to Order
```
POST /api/discounts/apply-coupon
```
**Request:**
```json
{
  "orderId": 123,
  "code": "WELCOME10",
  "discountAmount": 150
}
```

**Response:**
```json
{
  "success": true,
  "message": "Coupon applied successfully"
}
```

#### 3. Get Active Discounts
```
GET /api/discounts/active-discounts
```

**Response:**
```json
[
  {
    "code": "WELCOME10",
    "description": "Welcome discount - 10% off",
    "discount_type": "percentage",
    "discount_value": 10,
    "min_order_amount": 100
  },
  {
    "code": "SAVE50",
    "description": "Flat ₹50 discount",
    "discount_type": "fixed",
    "discount_value": 50,
    "min_order_amount": null
  }
]
```

### Loyalty Rewards Endpoints

#### 1. Get Customer Loyalty Status
```
GET /api/discounts/loyalty/:customerEmail
```

**Response:**
```json
{
  "id": 1,
  "customer_email": "user@example.com",
  "total_points": 500,
  "available_points": 450,
  "redeemed_points": 50,
  "loyalty_tier": "Gold",
  "total_spent": 12000,
  "order_count": 8,
  "last_order_date": "2026-03-15T10:30:00Z"
}
```

#### 2. Earn Reward Points
```
POST /api/discounts/earn-rewards
```

**Request:**
```json
{
  "orderId": 123,
  "customerEmail": "user@example.com",
  "orderAmount": 5000
}
```

**Response:**
```json
{
  "success": true,
  "pointsEarned": 500,
  "totalPoints": 1000,
  "availablePoints": 950,
  "loyaltyTier": "Gold"
}
```

**Calculation:** Points = floor(orderAmount / 10) = 10% of order value

#### 3. Redeem Loyalty Points
```
POST /api/discounts/redeem-points
```

**Request:**
```json
{
  "customerEmail": "user@example.com",
  "pointsToRedeem": 200,
  "orderId": 123
}
```

**Response:**
```json
{
  "success": true,
  "pointsRedeemed": 200,
  "discountAmount": 20,
  "availablePointsRemaining": 250
}
```

**Calculation:** Discount = pointsToRedeem * 0.10 (1 point = ₹0.10)

**Validation:** 
- Customer must have sufficient available points
- Points are deducted from available balance

#### 4. Get Tier Benefits
```
GET /api/discounts/tier-benefits/:tier
```

**Response:**
```json
{
  "tier": "Gold",
  "multiplier": 1.25,
  "discount": 5,
  "benefits": [
    "1.25 points per ₹10 spent",
    "5% extra discount",
    "Priority support"
  ]
}
```

#### 5. Get Transaction History
```
GET /api/discounts/history/:customerEmail
```

**Response:**
```json
[
  {
    "id": 1,
    "transaction_type": "earned",
    "points_amount": 500,
    "order_id": 123,
    "description": "Earned 500 points from order",
    "created_at": "2026-03-15T10:30:00Z"
  },
  {
    "id": 2,
    "transaction_type": "redeemed",
    "points_amount": 200,
    "order_id": 124,
    "description": "Redeemed points for discount",
    "created_at": "2026-03-14T15:45:00Z"
  }
]
```

## Frontend Components

### DiscountsAndRewards Component
Located: `client/src/components/DiscountsAndRewards.js`

**Props:**
```typescript
interface Props {
  orderAmount: number;              // Current order amount
  customerEmail: string;             // Customer email for loyalty lookup
  onDiscountApplied: (discount) => void;  // Callback when coupon applied
  onRewardsApplied: (rewards) => void;    // Callback when points redeemed
}
```

**Features:**
- Real-time coupon validation
- Active discounts display
- Loyalty points dashboard
- Tier benefits preview
- Quick discount application UI

**Integration:**
```jsx
<DiscountsAndRewards
  orderAmount={5000}
  customerEmail="user@example.com"
  onDiscountApplied={(discount) => {
    console.log('Applied:', discount);
    // Update order total
  }}
  onRewardsApplied={(rewards) => {
    console.log('Redeemed:', rewards);
    // Deduct from order total
  }}
/>
```

## Usage Flow

### Customer Applying Coupon Code
1. Customer enters coupon code in checkout
2. Frontend validates code via `validateCoupon` API
3. Backend checks:
   - Code exists and is active
   - Valid dates and usage limits
   - Minimum order amount
4. Discount amount calculated and displayed
5. Customer confirms and code applied to order
6. On order creation, `applyCoupon` called to record usage

### Customer Earning Rewards
1. Order created and completed
2. Backend calls `earnRewardPoints` endpoint
3. Points calculated: `orderAmount / 10`
4. Customer rewards record updated
5. Loyalty tier auto-upgraded if threshold reached
6. Transaction recorded for history

### Customer Redeeming Points
1. Customer initiates redemption in checkout
2. Frontend validates sufficient available points
3. Backend processes `redeemPoints` call
4. Points deducted, discount recorded
5. Order created with reduced total

## Implementation Checklist

**Database:**
- [x] Create discounts schema
- [x] Add reward transaction tracking
- [x] Update orders table with discount fields
- [x] Create indexes for performance

**Backend:**
- [x] Create `/api/discounts` routes
- [x] Implement coupon validation logic
- [x] Implement points calculation
- [x] Implement tier progression
- [x] Add error handling and validation

**Frontend:**
- [x] Create DiscountsAndRewards component
- [x] Add to Checkout flow
- [x] Integrate with API methods
- [x] Add styling and UX polish

**Next Steps:**
- [ ] Execute SQL schema script on production database
- [ ] Add sample coupon codes
- [ ] Test coupon validation flow
- [ ] Test loyalty points calculation
- [ ] Integrate discount totals into order confirmation
- [ ] Add admin panel for managing discounts
- [ ] Add customer loyalty dashboard view
- [ ] Set up automated tier promotion emails

## Sample Coupon Codes

Pre-loaded coupons in database:
1. **WELCOME10** - 10% off, Min order ₹100
2. **SAVE50** - ₹50 flat discount

## Error Handling

**Common Errors & Responses:**
- Invalid Code: `{ error: "Invalid coupon code" }` (404)
- Expired Code: `{ error: "This coupon code has expired" }` (400)
- Usage Limit Exceeded: `{ error: "Coupon code has reached its usage limit" }` (400)
- Insufficient Points: `{ error: "Insufficient points. Available: 100" }` (400)
- API Error: `{ error: "Error processing request" }` (500)

## Security Considerations

1. **Coupon Limits**: Usage tracking prevents abuse
2. **Point Validation**: Available points verified before redemption
3. **Tier Verification**: Automatic tier updates prevent spoofing
4. **Order Association**: Transactions linked to orders for audit trail
5. **Email Normalization**: Consistent case handling for loyalty lookup

## Performance Optimizations

1. **Indexes** on frequently queried columns:
   - `discounts.code`
   - `customer_rewards.customer_email`
   - `reward_transactions.customer_email`

2. **Database Queries** optimized with:
   - Direct lookups instead of scans
   - Limited result sets for transaction history

3. **Frontend Caching**:
   - Active discounts cached on component mount
   - Loyalty data fetched once per session

## Future Enhancements

1. **Referral Program**: Earn points for referring friends
2. **Birthday Bonus**: Extra points on customer birthday
3. **Flash Sales**: Time-limited coupon codes
4. **VIP Benefits**: Exclusive discounts for top customers
5. **Point Expiration**: Auto-expire unused points after period
6. **Coupon Bundles**: Combine multiple coupons for bigger savings
7. **Analytics Dashboard**: Track discount usage, tier distribution
8. **SMS/Email Notifications**: Notify customers of tier upgrades, expiring points

