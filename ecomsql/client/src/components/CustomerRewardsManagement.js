import React, { useState, useEffect, useCallback } from 'react';
import { 
  getSellerCustomers, 
  getSellerCustomerDetail,
  adjustCustomerPoints
} from '../api';
import './CustomerRewardsManagement.css';

const CustomerRewardsManagement = ({ onClose }) => {
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerDetails, setCustomerDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);

  const [adjustForm, setAdjustForm] = useState({
    points_adjustment: '',
    reason: ''
  });

  const tierLabels = {
    'Bronze': { color: '#CD7F32', label: 'Bronze' },
    'Silver': { color: '#C0C0C0', label: 'Silver' },
    'Gold': { color: '#FFD700', label: 'Gold' },
    'Platinum': { color: '#E5E4E2', label: 'Platinum' },
    'Diamond': { color: '#B9F2FF', label: 'Diamond' }
  };

  const loadCustomers = useCallback(async () => {
    try {
      setLoading(true);
      console.log('[CustomerRewardsManagement] Loading customers...');
      const response = await getSellerCustomers();
      console.log('[CustomerRewardsManagement] Customers response:', response);
      console.log('[CustomerRewardsManagement] Number of customers:', response.data?.length || 0);
      const customersData = Array.isArray(response.data) ? response.data : [];
      console.log('[CustomerRewardsManagement] Customers data:', customersData);
      setCustomers(customersData);
      setFilteredCustomers(customersData);
      setMessage('');
    } catch (error) {
      console.error('[CustomerRewardsManagement] Error loading customers:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Error loading customers';
      setMessage(errorMsg);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const handleSearch = (e) => {
    const term = e.target.value.toLowerCase();
    setSearchTerm(term);
    
    const filtered = customers.filter(customer =>
      customer.email.toLowerCase().includes(term)
    );
    setFilteredCustomers(filtered);
  };

  const handleViewDetails = async (email) => {
    try {
      setLoadingDetails(true);
      setMessage('');
      // Trim email to remove any whitespace
      const trimmedEmail = email.trim();
      console.log('[CustomerRewardsManagement] Loading details for:', trimmedEmail);
      const response = await getSellerCustomerDetail(trimmedEmail);
      console.log('[CustomerRewardsManagement] Customer detail response:', response);
      setCustomerDetails(response.data);
      setSelectedCustomer(trimmedEmail);
      setAdjustForm({ points_adjustment: '', reason: '' });
    } catch (error) {
      console.error('[CustomerRewardsManagement] Error loading customer details:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Error loading customer details';
      setMessage(errorMsg);
      setMessageType('error');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleAdjustChange = (e) => {
    const { name, value } = e.target;
    setAdjustForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    if (!adjustForm.points_adjustment || !adjustForm.reason.trim()) {
      setMessage('Points and reason are required');
      setMessageType('error');
      return;
    }

    try {
      console.log('[CustomerRewardsManagement] Adjusting points for:', selectedCustomer, adjustForm);
      await adjustCustomerPoints(
        selectedCustomer,
        parseInt(adjustForm.points_adjustment),
        adjustForm.reason
      );
      setMessage('Points adjusted successfully');
      setMessageType('success');
      setAdjustForm({ points_adjustment: '', reason: '' });
      setShowAdjustModal(false);
      
      // Reload customer details
      await handleViewDetails(selectedCustomer);
      // Reload customers list
      await loadCustomers();
    } catch (error) {
      console.error('[CustomerRewardsManagement] Error adjusting points:', error);
      setMessage(error.response?.data?.error || error.message || 'Error adjusting points');
      setMessageType('error');
    }
  };

  const closeCustDetail = () => {
    setSelectedCustomer(null);
    setCustomerDetails(null);
    setShowAdjustModal(false);
  };

  if (loading) {
    return <div className="crm-modal"><div className="crm-container"><div className="loading">Loading customers...</div></div></div>;
  }

  if (selectedCustomer && customerDetails) {
    return (
      <div className="crm-modal">
        <div className="crm-container detail-container">
          <div className="crm-header">
            <h2>Customer Details</h2>
            <button className="close-btn" onClick={closeCustDetail}>×</button>
          </div>

          <div className="crm-content detail-content">
            {message && (
              <div className={`message ${messageType}`}>
                {message}
              </div>
            )}

            <div className="customer-header">
              <div className="customer-info">
                <h3>{customerDetails.email}</h3>
                <div className="info-row">
                  <span className="label">Total Spent:</span>
                  <span className="value">₹{customerDetails.total_spent?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="info-row">
                  <span className="label">Current Tier:</span>
                  <span className="tier-badge" style={{ 
                    backgroundColor: tierLabels[customerDetails.current_tier]?.color || '#ccc',
                    color: customerDetails.current_tier === 'Platinum' ? '#333' : 'white'
                  }}>
                    {customerDetails.current_tier}
                  </span>
                </div>
              </div>
              
              <div className="reward-summary">
                <div className="reward-item">
                  <span className="label">Available Points</span>
                  <span className="value points">{customerDetails.available_points}</span>
                </div>
                <div className="reward-item">
                  <span className="label">Total Earned</span>
                  <span className="value">{customerDetails.total_earned_points}</span>
                </div>
                <div className="reward-item">
                  <span className="label">Total Redeemed</span>
                  <span className="value">{customerDetails.total_redeemed_points}</span>
                </div>
              </div>
            </div>

            <button 
              className="btn btn-primary mb-20"
              onClick={() => setShowAdjustModal(true)}
            >
              Adjust Points
            </button>

            {showAdjustModal && (
              <div className="adjust-form-container">
                <h4>Adjust Customer Points</h4>
                <form onSubmit={handleAdjustSubmit}>
                  <div className="form-group">
                    <label htmlFor="points_adjustment">Points Adjustment *</label>
                    <div className="points-input-group">
                      <input
                        type="number"
                        id="points_adjustment"
                        name="points_adjustment"
                        value={adjustForm.points_adjustment}
                        onChange={handleAdjustChange}
                        placeholder="Enter positive or negative number"
                        required
                      />
                      <span className="hint">Use - for deduction (e.g., -100)</span>
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="reason">Reason *</label>
                    <textarea
                      id="reason"
                      name="reason"
                      value={adjustForm.reason}
                      onChange={handleAdjustChange}
                      placeholder="e.g., Refund, Complaint resolution, Bonus"
                      rows="3"
                      required
                    ></textarea>
                  </div>

                  <div className="form-actions">
                    <button type="submit" className="btn btn-primary">
                      Confirm Adjustment
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-secondary"
                      onClick={() => {
                        setShowAdjustModal(false);
                        setAdjustForm({ points_adjustment: '', reason: '' });
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="transactions-section">
              <h4>Transaction History</h4>
              {customerDetails.transactions && customerDetails.transactions.length > 0 ? (
                <div className="transactions-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Points</th>
                        <th>Type</th>
                        <th>Reference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerDetails.transactions.map((trans, idx) => (
                        <tr key={idx}>
                          <td>{new Date(trans.created_at).toLocaleDateString()}</td>
                          <td>
                            <span className={`points-badge ${trans.points_change > 0 ? 'positive' : 'negative'}`}>
                              {trans.points_change > 0 ? '+' : ''}{trans.points_change}
                            </span>
                          </td>
                          <td>{trans.transaction_type}</td>
                          <td>{trans.reference_id || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="empty-message">No transactions yet</p>
              )}
            </div>

            <button 
              className="btn btn-secondary back-btn"
              onClick={closeCustDetail}
            >
              Back to Customers
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="crm-modal">
      <div className="crm-container">
        <div className="crm-header">
          <h2>Manage Customer Rewards</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="crm-content">
          {message && (
            <div className={`message ${messageType}`}>
              {message}
            </div>
          )}

          <div className="filters-section">
            <input
              type="text"
              placeholder="Search by email..."
              value={searchTerm}
              onChange={handleSearch}
              className="search-input"
            />
          </div>

          {filteredCustomers.length === 0 ? (
            <p className="empty-message">
              {customers.length === 0 ? 'No customers found' : 'No matching customers'}
            </p>
          ) : (
            <div className="customers-table">
              <table>
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Tier</th>
                    <th>Total Spent</th>
                    <th>Available Points</th>
                    <th>Total Earned</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map(customer => (
                    <tr key={customer.email}>
                      <td>{customer.email}</td>
                      <td>
                        <span className="tier-badge" style={{ 
                          backgroundColor: tierLabels[customer.current_tier]?.color || '#ccc',
                          color: customer.current_tier === 'Platinum' ? '#333' : 'white'
                        }}>
                          {customer.current_tier}
                        </span>
                      </td>
                      <td>₹{customer.total_spent?.toFixed(2) || '0.00'}</td>
                      <td>
                        <strong>{customer.available_points}</strong>
                      </td>
                      <td>{customer.total_earned_points}</td>
                      <td>
                        <button
                          className="btn btn-sm btn-info"
                          onClick={() => handleViewDetails(customer.email)}
                          disabled={loadingDetails && selectedCustomer === customer.email}
                        >
                          {loadingDetails && selectedCustomer === customer.email ? 'Loading...' : 'View Details'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="list-footer">
            Showing {filteredCustomers.length} of {customers.length} customers
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerRewardsManagement;
