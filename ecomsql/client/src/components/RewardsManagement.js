import React, { useState, useEffect, useCallback } from 'react';
import { getAllRewards, getRewardsStats, getRewardsByStatus } from '../api';
import './RewardsManagement.css';

const RewardsManagement = () => {
  const [rewards, setRewards] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // all, active, used, expired
  const [searchEmail, setSearchEmail] = useState('');

  const loadDataMemo = useCallback(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus]);

  useEffect(() => {
    loadDataMemo();
  }, [loadDataMemo]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load stats
      const statsResponse = await getRewardsStats();
      setStats(statsResponse.data);

      // Load rewards based on filter
      let rewardsResponse;
      if (filterStatus === 'all') {
        rewardsResponse = await getAllRewards();
      } else {
        rewardsResponse = await getRewardsByStatus(filterStatus);
      }

      let filteredRewards = rewardsResponse.data;

      // Apply email search filter
      if (searchEmail.trim()) {
        filteredRewards = filteredRewards.filter(reward =>
          reward.customer_email.toLowerCase().includes(searchEmail.toLowerCase())
        );
      }

      setRewards(filteredRewards);
      setMessage('');
    } catch (error) {
      setMessage('Error loading rewards data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadData();
  };

  const handleStatusFilter = (status) => {
    setFilterStatus(status);
  };

  const getStatusBadge = (reward) => {
    if (reward.is_used) {
      return <span className="badge badge-used">Used</span>;
    }

    const now = new Date();
    const validUntil = new Date(reward.valid_until);

    if (validUntil < now) {
      return <span className="badge badge-expired">Expired</span>;
    }

    return <span className="badge badge-active">Active</span>;
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading && rewards.length === 0) {
    return <div className="rewards-management"><div className="loading">Loading rewards...</div></div>;
  }

  return (
    <div className="rewards-management">
      <h2>Rewards & Coupons Management</h2>

      {/* Statistics Cards */}
      {stats && (
        <div className="stats-container">
          <div className="stat-card">
            <div className="stat-label">Total Rewards</div>
            <div className="stat-value">{stats.total_rewards}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Active Rewards</div>
            <div className="stat-value active">{stats.active_rewards}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Used Rewards</div>
            <div className="stat-value used">{stats.used_rewards}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Expired Rewards</div>
            <div className="stat-value expired">{stats.expired_rewards}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Active Value</div>
            <div className="stat-value currency">₹{stats.total_active_value?.toFixed(2) || '0.00'}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Redeemed Value</div>
            <div className="stat-value currency">₹{stats.total_redeemed_value?.toFixed(2) || '0.00'}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="filters-section">
        <div className="filter-buttons">
          <button
            className={`filter-btn ${filterStatus === 'all' ? 'active' : ''}`}
            onClick={() => handleStatusFilter('all')}
          >
            All ({stats?.total_rewards || 0})
          </button>
          <button
            className={`filter-btn ${filterStatus === 'active' ? 'active' : ''}`}
            onClick={() => handleStatusFilter('active')}
          >
            Active ({stats?.active_rewards || 0})
          </button>
          <button
            className={`filter-btn ${filterStatus === 'used' ? 'active' : ''}`}
            onClick={() => handleStatusFilter('used')}
          >
            Used ({stats?.used_rewards || 0})
          </button>
          <button
            className={`filter-btn ${filterStatus === 'expired' ? 'active' : ''}`}
            onClick={() => handleStatusFilter('expired')}
          >
            Expired ({stats?.expired_rewards || 0})
          </button>
        </div>

        <div className="search-section">
          <input
            type="email"
            placeholder="Search by customer email..."
            value={searchEmail}
            onChange={(e) => setSearchEmail(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="search-input"
          />
          <button onClick={handleSearch} className="search-btn">Search</button>
          <button 
            onClick={() => {
              setSearchEmail('');
              setFilterStatus('all');
              loadData();
            }}
            className="reset-btn"
          >
            Reset
          </button>
        </div>
      </div>

      {message && (
        <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
          {message}
        </div>
      )}

      {/* Rewards Table */}
      {rewards.length === 0 ? (
        <div className="empty-state">
          <p>No rewards found for the selected filter</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="rewards-table">
            <thead>
              <tr>
                <th>Reward Code</th>
                <th>Customer Email</th>
                <th>Order #</th>
                <th>Reward Amount</th>
                <th>Original Order Value</th>
                <th>Created</th>
                <th>Valid Until</th>
                <th>Days Remaining</th>
                <th>Used On</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rewards.map(reward => (
                <tr key={reward.id} className={`reward-row ${reward.is_used ? 'used' : ''}`}>
                  <td className="code-cell">
                    <code>{reward.reward_code}</code>
                  </td>
                  <td>{reward.customer_email}</td>
                  <td>{reward.order_number || 'N/A'}</td>
                  <td className="amount-cell">₹{reward.reward_amount?.toFixed(2) || '0.00'}</td>
                  <td>₹{reward.original_order_value?.toFixed(2) || '0.00'}</td>
                  <td>{formatDate(reward.created_at)}</td>
                  <td>{formatDate(reward.valid_until)}</td>
                  <td className="days-cell">
                    {reward.days_remaining !== null ? (
                      <span className={reward.days_remaining < 0 ? 'expired' : reward.days_remaining < 7 ? 'warning' : ''}>
                        {reward.days_remaining < 0 ? 'Expired' : `${reward.days_remaining}d`}
                      </span>
                    ) : 'N/A'}
                  </td>
                  <td>{reward.used_at ? formatDate(reward.used_at) : '-'}</td>
                  <td>{getStatusBadge(reward)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rewards-info">
        <h3>Rewards System Information</h3>
        <ul>
          <li>Customers earn 5% of their order value as a reward after successful order placement</li>
          <li>Rewards are valid for 3 months from the order date</li>
          <li>Customers can use rewards on their next purchases</li>
          <li>Reward amount cannot exceed the current cart value</li>
          <li>Each reward is tracked with a unique code and customer email</li>
        </ul>
      </div>
    </div>
  );
};

export default RewardsManagement;
