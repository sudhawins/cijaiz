import React, { useState, useEffect, useCallback } from 'react';
import { getCartItems, updateCartItem, removeFromCart, getCustomerLoyalty } from '../api';
import DiscountsAndRewards from './DiscountsAndRewards';
import Checkout from './Checkout';
import './ShoppingCart.css';

const ShoppingCart = ({ onCartCountChange, onOrderComplete }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);
  const [appliedDiscount, setAppliedDiscount] = useState(null);
  const [appliedRewards, setAppliedRewards] = useState(null);
  const [customerRewards, setCustomerRewards] = useState(null);
  const [rewardsLoading, setRewardsLoading] = useState(false);

  const sessionId = localStorage.getItem('sessionId');
  const userString = localStorage.getItem('user');
  const user = userString ? JSON.parse(userString) : null;
  const customerEmail = user?.userName || '';

  const loadCart = useCallback(async () => {
    try {
      if (!sessionId) {
        setItems([]);
        onCartCountChange && onCartCountChange(0);
        setLoading(false);
        return;
      }

      const response = await getCartItems(sessionId);
      const cartItems = Array.isArray(response.data) ? response.data : [];
      setItems(cartItems);
      onCartCountChange && onCartCountChange(cartItems.length);
    } catch (err) {
      setMessage('Error loading cart');
      console.error(err);
      onCartCountChange && onCartCountChange(0);
    } finally {
      setLoading(false);
    }
  }, [sessionId, onCartCountChange]);

  const loadRewards = useCallback(async () => {
    if (!customerEmail) return;
    
    try {
      setRewardsLoading(true);
      const response = await getCustomerLoyalty(customerEmail);
      setCustomerRewards(response.data);
    } catch (error) {
      console.error('[ShoppingCart] Error loading customer rewards:', error);
    } finally {
      setRewardsLoading(false);
    }
  }, [customerEmail]);

  useEffect(() => {
    loadCart();
  }, [loadCart]);

  // Load customer rewards data
  useEffect(() => {
    loadRewards();
  }, [loadRewards]);

  const handleQuantityChange = async (itemId, newQuantity) => {
    if (newQuantity < 1) return;

    try {
      await updateCartItem(itemId, { quantity: newQuantity });
      await loadCart();
    } catch (err) {
      setMessage('Error updating quantity');
      console.error(err);
    }
  };

  const handleRemoveItem = async (itemId) => {
    try {
      await removeFromCart(itemId);
      await loadCart();
    } catch (err) {
      setMessage('Error removing item');
      console.error(err);
    }
  };

  const handleCheckoutClose = async () => {
    setShowCheckout(false);
    await loadCart(); // Reload cart in case order was created
    
    // Reload rewards data after order completion to reflect redeemed points
    await loadRewards();
    
    // Reset applied discount and rewards state after order completion
    setAppliedDiscount(null);
    setAppliedRewards(null);
  };

  // Calculate charges
  const MINIMUM_ORDER_VALUE = 200;
  const subtotalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const GST_RATE = 0; // 0% GST
  
  // Discounts are applied ONLY to product value (subtotal), NOT to GST or shipping
  const discountAmount = (appliedDiscount?.amount || 0) + (appliedRewards?.discountAmount || 0);
  const subtotalAfterDiscount = Math.max(0, subtotalAmount - discountAmount);
  
  // GST MUST NEVER be discounted - always calculated on ORIGINAL product subtotal
  // Applies to coupons, loyalty points, or any other discount type
  const gstAmount = subtotalAmount * GST_RATE;
  const shippingCharge = 0; // Shipping calculated during checkout based on delivery location
  
  // Total = discounted product value + GST on original value + shipping
  const totalAmount = subtotalAfterDiscount + gstAmount + shippingCharge;
  
  // Check if minimum order requirement is met
  const isBelowMinimum = subtotalAmount < MINIMUM_ORDER_VALUE;
  const amountNeeded = MINIMUM_ORDER_VALUE - subtotalAmount;

  if (loading) {
    return <div className="shopping-cart"><div className="loading">Loading cart...</div></div>;
  }

  return (
    <div className="shopping-cart">
      <h2>Shopping Cart</h2>

      {message && (
        <div className={`message ${message.includes('Error') || message.includes('Invalid') ? 'error' : 'success'}`}>
          {message}
        </div>
      )}

      {items.length === 0 ? (
        <div className="empty-cart">
          <p>Your cart is empty</p>
        </div>
      ) : (
        <div className="cart-container">
          <table className="cart-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Price</th>
                <th>Quantity</th>
                <th>Subtotal</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td>{item.product_name}</td>
                  <td>₹{item.price.toFixed(2)}</td>
                  <td>
                    <div className="quantity-control">
                      <button onClick={() => handleQuantityChange(item.id, item.quantity - 1)}>-</button>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 1)}
                        min="1"
                      />
                      <button onClick={() => handleQuantityChange(item.id, item.quantity + 1)}>+</button>
                    </div>
                  </td>
                  <td>₹{(item.price * item.quantity).toFixed(2)}</td>
                  <td>
                    <button
                      className="remove-btn"
                      onClick={() => handleRemoveItem(item.id)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="cart-summary">
            <div className="summary-breakdown">
              <div className="summary-row">
                <span>Subtotal:</span>
                <span className="amount">₹{subtotalAmount.toFixed(2)}</span>
              </div>
              
              {appliedDiscount && (
                <div className="summary-row promo-row">
                  <span>Discount ({appliedDiscount.code}):</span>
                  <span className="amount promo-amount">-₹{appliedDiscount.amount.toFixed(2)}</span>
                </div>
              )}

              {appliedRewards && (
                <div className="summary-row promo-row">
                  <span>Reward (Loyalty Points - {appliedRewards.points}):</span>
                  <span className="amount promo-amount">-₹{appliedRewards.discountAmount.toFixed(2)}</span>
                </div>
              )}

              <div className="summary-row">
                <span>Amount After Promo:</span>
                <span className="amount">₹{(subtotalAmount - discountAmount).toFixed(2)}</span>
              </div>
              
              <div className="summary-row">
                <span>GST (0%):</span>
                <span className="amount">₹{gstAmount.toFixed(2)}</span>
              </div>
              <div className="summary-row">
                <span>Shipping:</span>
                <span className="amount">
                  {shippingCharge === 0 ? (
                    <span style={{ color: '#28a745' }}>Free</span>
                  ) : (
                    <span style={{ color: '#FFC107' }}>₹{shippingCharge.toFixed(2)}</span>
                  )}
                </span>
              </div>
              {shippingCharge > 0 && (
                <div className="summary-row summary-note">
                  <span style={{ fontSize: '12px', color: '#666' }}>Free shipping on orders above ₹5000</span>
                </div>
              )}
              {discountAmount > 0 && (
                <div className="summary-row discount-row">
                  <span style={{ color: '#FFC107', fontWeight: '600' }}>Discount:</span>
                  <span className="amount" style={{ color: '#FFC107', fontWeight: '600' }}>-₹{discountAmount.toFixed(2)}</span>
                </div>
              )}
            </div>
            
            {/* Rewards Points Display */}
            {!rewardsLoading && customerRewards && customerRewards.available_points > 0 && (
              <div className="rewards-points-banner">
                <div className="rewards-header">
                  <span className="rewards-icon">🎁</span>
                  <div className="rewards-info">
                    <p className="rewards-label">Reward Points Available</p>
                    <p className="rewards-value">{customerRewards.available_points} points</p>
                  </div>
                </div>
                <div className="rewards-conversion">
                  <p><strong>Each point = ₹0.10 (10 paisa)</strong></p>
                  <p className="rewards-max">Max redemption: ₹{(Math.min(customerRewards.available_points * 0.10, subtotalAmount)).toFixed(2)}</p>
                </div>
              </div>
            )}
            {/* Discounts and Rewards Component */}
            <DiscountsAndRewards
              orderAmount={subtotalAmount}
              customerEmail={customerEmail}
              isAuthenticated={Boolean(user)}
              onDiscountApplied={(discount) => setAppliedDiscount(discount)}
              onRewardsApplied={(rewards) => setAppliedRewards(rewards)}
            />
            
            {/* Minimum Order Requirement Alert */}
            {isBelowMinimum && (
              <div className="minimum-order-alert">
                <div className="alert-icon">⚠️</div>
                <div className="alert-content">
                  <p className="alert-title">Minimum Order Requirement</p>
                  <p className="alert-message">
                    Minimum order value is ₹{MINIMUM_ORDER_VALUE}. Add ₹{amountNeeded.toFixed(2)} more to proceed.
                  </p>
                </div>
              </div>
            )}
            
            <div className="total">
              <span>Total:</span>
              <span className="amount">₹{totalAmount.toFixed(2)}</span>
            </div>
            <button 
              className="checkout-btn" 
              onClick={() => setShowCheckout(true)}
              disabled={isBelowMinimum}
              title={isBelowMinimum ? `Add ₹${amountNeeded.toFixed(2)} more to reach minimum order value` : 'Proceed to checkout'}
            >
              {isBelowMinimum ? `Add ₹${amountNeeded.toFixed(2)} more` : 'Proceed to Checkout'}
            </button>
          </div>

          {showCheckout && (
            <Checkout 
              cartItems={items}
              subtotalAmount={subtotalAmount}
              gstAmount={gstAmount}
              shippingCharge={shippingCharge}
              discountAmount={appliedDiscount?.amount}  
              discountCode={appliedDiscount?.code}
              rewardAmount={appliedRewards?.discountAmount}
              rewardCode={appliedRewards?.type === 'loyalty_points' ? `Loyalty Points (${appliedRewards?.points})` : appliedRewards?.code}
              totalAmount={totalAmount}
              appliedDiscount={appliedDiscount}
              appliedRewards={appliedRewards}
              onClose={handleCheckoutClose}
              onOrderComplete={onOrderComplete}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default ShoppingCart;

