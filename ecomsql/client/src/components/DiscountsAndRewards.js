import React, { useState, useEffect } from 'react';
import { 
  validateCoupon, 
  getActiveDiscounts, 
  getCustomerLoyalty, 
  getTierBenefits 
} from '../api';
import './DiscountsAndRewards.css';

const DiscountsAndRewards = ({ 
  orderAmount = 0, 
  customerEmail = '', 
  isAuthenticated = false,
  onDiscountApplied = () => {},
  onRewardsApplied = () => {}
}) => {
  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [activeDiscounts, setActiveDiscounts] = useState([]);
  const [showDiscounts, setShowDiscounts] = useState(false);

  // Loyalty rewards state
  const [loyaltyData, setLoyaltyData] = useState(null);
  const [tierBenefits, setTierBenefits] = useState(null);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [loyaltyLoading, setLoyaltyLoading] = useState(true);
  const [showRedemption, setShowRedemption] = useState(false);
  const [appliedRewards, setAppliedRewards] = useState(null);

  // Load active discounts on mount
  useEffect(() => {
    const loadDiscounts = async () => {
      try {
        const response = await getActiveDiscounts();
        setActiveDiscounts(response.data || []);
      } catch (error) {
        console.error('Error loading discounts:', error);
      }
    };
    loadDiscounts();
  }, []);

  // Load customer loyalty data
  useEffect(() => {
    if (!customerEmail) {
      setLoyaltyLoading(false);
      return;
    }

    const loadLoyalty = async () => {
      try {
        setLoyaltyLoading(true);
        const response = await getCustomerLoyalty(customerEmail);
        console.log('[DiscountsAndRewards] Loyalty data loaded:', response.data);
        setLoyaltyData(response.data);
        
        // Load tier benefits
        if (response.data?.loyalty_tier) {
          const benefitsResponse = await getTierBenefits(response.data.loyalty_tier);
          setTierBenefits(benefitsResponse.data);
        }
      } catch (error) {
        console.error('[DiscountsAndRewards] Error loading loyalty data:', error);
      } finally {
        setLoyaltyLoading(false);
      }
    };
    loadLoyalty();
  }, [customerEmail]);

  // Validate and apply coupon
  const handleValidateCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponError('Please enter a coupon code');
      return;
    }

    if (orderAmount <= 0) {
      setCouponError('Order amount must be greater than 0');
      return;
    }

    try {
      setCouponLoading(true);
      setCouponError('');
      
      const response = await validateCoupon(couponCode, orderAmount, customerEmail);
      setAppliedCoupon(response.data);
      setCouponCode('');
      
      // Notify parent
      onDiscountApplied({
        code: response.data.discountCode,
        amount: response.data.discountAmount,
        type: 'coupon'
      });
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Invalid coupon code';
      setCouponError(errorMsg);
    } finally {
      setCouponLoading(false);
    }
  };

  // Remove applied coupon
  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponError('');
    setCouponCode('');
    onDiscountApplied({ type: 'coupon', amount: 0 });
  };

  // Redeem loyalty points
  const handleRedeemPoints = async () => {
    if (!isAuthenticated || !customerEmail) {
      setCouponError('Please log in to apply loyalty points.');
      return;
    }

    if (!pointsToRedeem || pointsToRedeem <= 0) {
      setCouponError('Please enter a valid number of points');
      return;
    }

    if (pointsToRedeem > (loyaltyData?.available_points || 0)) {
      setCouponError(`Insufficient points. Available: ${loyaltyData?.available_points}`);
      return;
    }

    try {
      setRedeemLoading(true);
      setCouponError('');
      
      // Calculate discount: 1 point = ₹0.10 (10 paisa)
      const discountAmount = pointsToRedeem * 0.10;
      
      const rewardsData = {
        points: pointsToRedeem,
        discountAmount,
        type: 'loyalty_points'
      };
      
      // Set applied rewards locally for UI display
      setAppliedRewards(rewardsData);
      
      // Notify parent
      onRewardsApplied(rewardsData);

      setShowRedemption(false);
      setPointsToRedeem(0);
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Error redeeming points';
      setCouponError(errorMsg);
    } finally {
      setRedeemLoading(false);
    }
  };

  // Remove applied rewards
  const handleRemoveRewards = () => {
    setAppliedRewards(null);
    setShowRedemption(false);
    setPointsToRedeem(0);
    onRewardsApplied(null);
  };

  return (
    <div className="dar-container">
      {console.log('[DiscountsAndRewards] Render: customerEmail=', customerEmail, 'loyaltyLoading=', loyaltyLoading, 'loyaltyData=', loyaltyData)}
      {/* Coupons Section */}
      <div className="dar-section">
        <h3 className="dar-title">🎟️ Apply Coupon Code</h3>

        {appliedCoupon ? (
          <div className="dar-applied">
            <div className="dar-applied-content">
              <span className="dar-applied-badge">✓ Applied</span>
              <div className="dar-applied-details">
                <p className="dar-applied-code">{appliedCoupon.discountCode}</p>
                <p className="dar-applied-savings">
                  You save: <strong>₹{appliedCoupon.discountAmount}</strong>
                </p>
              </div>
            </div>
            <button 
              className="dar-btn-remove"
              onClick={handleRemoveCoupon}
            >
              Remove
            </button>
          </div>
        ) : (
          <div className="dar-input-group">
            <input
              type="text"
              placeholder="Enter coupon code (e.g., WELCOME10)"
              value={couponCode}
              onChange={(e) => {
                setCouponCode(e.target.value.toUpperCase());
                setCouponError('');
              }}
              className="dar-input"
              disabled={couponLoading || !orderAmount}
            />
            <button
              className="dar-btn-apply"
              onClick={handleValidateCoupon}
              disabled={couponLoading || !orderAmount || !couponCode.trim()}
            >
              {couponLoading ? 'Validating...' : 'Apply'}
            </button>
          </div>
        )}

        {couponError && <p className="dar-error">{couponError}</p>}

        {/* Available Discounts and Rewards Offers */}
        {activeDiscounts.length > 0 && (
          <div className="dar-available">
            <button 
              className="dar-toggle"
              onClick={() => setShowDiscounts(!showDiscounts)}
            >
              {showDiscounts ? '▼' : '▶'} Available Offers ({activeDiscounts.length})
            </button>
            
            {showDiscounts && (
              <div className="dar-discounts-list">
                {/* Active Coupon Discounts */}
                {!appliedCoupon && activeDiscounts.map((discount, idx) => (
                  <div key={idx} className="dar-discount-item">
                    <div className="dar-discount-header">
                      <strong>{discount.code}</strong>
                      <span className="dar-discount-value">
                        {discount.discount_type === 'percentage' 
                          ? `${discount.discount_value}% OFF` 
                          : `₹${discount.discount_value} OFF`}
                      </span>
                    </div>
                    <p className="dar-discount-desc">{discount.description}</p>
                    {discount.min_order_amount && (
                      <p className="dar-discount-condition">
                        Min order: ₹{discount.min_order_amount}
                      </p>
                    )}
                    <button
                      className="dar-btn-use"
                      onClick={() => setCouponCode(discount.code)}
                    >
                      Use Code
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {!isAuthenticated && (
        <div className="dar-section dar-rewards">
          <h3 className="dar-title">⭐ Loyalty Rewards</h3>
          <p className="dar-info">Log in to view and apply your loyalty points during checkout.</p>
          <button
            className="dar-btn-apply"
            onClick={() => {
              window.location.href = '/login';
            }}
          >
            Login to Use Rewards
          </button>
        </div>
      )}

      {/* Loyalty Rewards Section */}
      {isAuthenticated && customerEmail && !loyaltyLoading && loyaltyData && (
        <div className="dar-section dar-rewards">
          <h3 className="dar-title">⭐ Loyalty Rewards</h3>
          
          {loyaltyData.loyalty_tier || loyaltyData.available_points !== undefined || loyaltyData.total_spent !== undefined ? (
            <>
              <div className="dar-loyalty-status">
                {loyaltyData.loyalty_tier && (
                  <div className="dar-tier">
                    <p className="dar-tier-label">Current Tier</p>
                    <p className="dar-tier-value">{loyaltyData.loyalty_tier}</p>
                  </div>
                )}
                {loyaltyData.available_points !== undefined && (
                  <div className="dar-points">
                    <p className="dar-points-label">Available Points</p>
                    <p className="dar-points-value">{loyaltyData.available_points}</p>
                  </div>
                )}
                {loyaltyData.total_spent !== undefined && (
                  <div className="dar-spent">
                    <p className="dar-spent-label">Total Spent</p>
                    <p className="dar-spent-value">₹{loyaltyData.total_spent}</p>
                  </div>
                )}
              </div>

              {/* Tier Benefits */}
              {tierBenefits && (
                <div className="dar-tier-benefits">
                  <h4>Tier Benefits</h4>
                  <ul className="dar-benefits-list">
                    {tierBenefits.benefits && tierBenefits.benefits.map((benefit, idx) => (
                      <li key={idx}>{benefit}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Redeem Points */}
              {loyaltyData.available_points > 0 && (
                <div className="dar-redemption">
                  {appliedRewards ? (
                    <div className="dar-applied">
                      <div className="dar-applied-content">
                        <span className="dar-applied-badge">✓ Applied</span>
                        <div className="dar-applied-details">
                          <p className="dar-applied-code">Loyalty Points</p>
                          <p className="dar-applied-savings">
                            {appliedRewards.points} points = <strong>₹{appliedRewards.discountAmount.toFixed(2)} discount</strong>
                          </p>
                        </div>
                      </div>
                      <button 
                        className="dar-btn-remove"
                        onClick={handleRemoveRewards}
                      >
                        Remove
                      </button>
                    </div>
                  ) : !showRedemption ? (
                    <button
                      className="dar-btn-redeem"
                      onClick={() => setShowRedemption(true)}
                    >
                      💳 Redeem Points
                    </button>
                  ) : (
                    <div className="dar-redeem-form">
                      <div className="dar-input-group">
                        <input
                          type="number"
                          min="1"
                          max={loyaltyData.available_points}
                          value={pointsToRedeem}
                          onChange={(e) => setPointsToRedeem(parseInt(e.target.value) || 0)}
                          placeholder={`Enter points (Max: ${loyaltyData.available_points})`}
                          className="dar-input"
                        />
                        <span className="dar-redeem-value">
                          = ₹{(pointsToRedeem * 0.10).toFixed(2)}
                        </span>
                      </div>
                      <div className="dar-redeem-actions">
                        <button
                          className="dar-btn-confirm"
                          onClick={handleRedeemPoints}
                          disabled={redeemLoading || pointsToRedeem <= 0}
                        >
                          {redeemLoading ? 'Processing...' : 'Redeem'}
                        </button>
                        <button
                          className="dar-btn-cancel"
                          onClick={() => {
                            setShowRedemption(false);
                            setPointsToRedeem(0);
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <p style={{ color: '#999', fontSize: '13px' }}>Loading loyalty information...</p>
          )}
        </div>
      )}
    </div>
  );
};

export default DiscountsAndRewards;
