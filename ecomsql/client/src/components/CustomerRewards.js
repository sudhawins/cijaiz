import React, { useState, useEffect, useCallback } from 'react';
import { getAvailableRewards } from '../api';
import './CustomerRewards.css';

const CustomerRewards = ({ email }) => {
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadRewardsMemo = useCallback(() => {
    loadRewards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  useEffect(() => {
    loadRewardsMemo();
  }, [loadRewardsMemo]);

  const loadRewards = async () => {
    setLoading(true);
    setError('');
    try {
      if (email) {
        const response = await getAvailableRewards(email);
        setRewards(Array.isArray(response.data) ? response.data : []);
      }
    } catch (err) {
      setError('Error loading your rewards');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getDaysRemaining = (validUntil) => {
    const now = new Date();
    const until = new Date(validUntil);
    const days = Math.ceil((until - now) / (1000 * 60 * 60 * 24));
    return Math.max(0, days);
  };

  if (loading) {
    return <div className="customer-rewards"><div className="loading">Loading your rewards...</div></div>;
  }

  return (
    <div className="customer-rewards">
      <h3>My Available Rewards</h3>
      
      {error && <div className="error-message">{error}</div>}

      {rewards.length === 0 ? (
        <div className="no-rewards">
          <p>You haven't earned any rewards yet.</p>
          <p className="rewards-info">Complete a purchase to earn 5% reward on your order value!</p>
        </div>
      ) : (
        <>
          <div className="rewards-summary">
            <div className="summary-item">
              <span className="label">Active Rewards:</span>
              <span className="value">{rewards.length}</span>
            </div>
            <div className="summary-item">
              <span className="label">Total Value:</span>
              <span className="value currency">₹{rewards.reduce((sum, r) => sum + r.reward_amount, 0).toFixed(2)}</span>
            </div>
          </div>

          <div className="rewards-list">
            {rewards.map(reward => (
              <div key={reward.id} className="reward-card">
                <div className="reward-header">
                  <div className="reward-code">
                    <label>Code:</label>
                    <code>{reward.reward_code}</code>
                  </div>
                  <div className="reward-amount">
                    ₹{reward.reward_amount.toFixed(2)}
                  </div>
                </div>

                <div className="reward-details">
                  <div className="detail-row">
                    <span className="detail-label">From Order:</span>
                    <span className="detail-value">₹{reward.original_order_value?.toFixed(2) || '0.00'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Earned:</span>
                    <span className="detail-value">{formatDate(reward.created_at)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Expires:</span>
                    <span className={`detail-value ${getDaysRemaining(reward.valid_until) < 7 ? 'expiring-soon' : ''}`}>
                      {formatDate(reward.valid_until)} ({getDaysRemaining(reward.valid_until)} days)
                    </span>
                  </div>
                </div>

                <div className="reward-status">
                  {getDaysRemaining(reward.valid_until) < 7 && (
                    <div className="expiring-warning">⚠️ Expiring Soon!</div>
                  )}
                  <span className="status-badge">Available</span>
                </div>
              </div>
            ))}
          </div>

          <div className="rewards-note">
            <strong>How to use:</strong>
            <ul>
              <li>Add items to your cart</li>
              <li>Go to checkout and enter your reward code</li>
              <li>The reward amount will be deducted from your order total</li>
              <li>Rewards are valid for 3 months from the date earned</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
};

export default CustomerRewards;
