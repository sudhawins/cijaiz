import React, { useState, useEffect, useCallback } from 'react';
import { 
  getSellerCoupons, 
  createCoupon, 
  updateCoupon, 
  deleteCoupon,
  checkDiscountsHealth
} from '../api';
import './CouponManagement.css';

const CouponManagement = ({ onClose }) => {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    code: '',
    description: '',
    discount_type: 'percentage',
    discount_value: '',
    min_order_amount: '',
    max_discount_amount: '',
    max_uses: '',
    valid_from: '',
    valid_until: '',
    is_active: true
  });

  const loadCoupons = useCallback(async () => {
    try {
      setLoading(true);
      console.log('[CouponManagement] Loading coupons...');
      const response = await getSellerCoupons();
      console.log('[CouponManagement] Coupons response:', response);
      setCoupons(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('[CouponManagement] Error loading coupons:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Error loading coupons';
      setMessage(errorMsg);
      setMessageType('error');
      
      // Run diagnostic check
      try {
        console.log('[CouponManagement] Running health check...');
        const health = await checkDiscountsHealth();
        console.log('[CouponManagement] Health check result:', health);
      } catch (healthError) {
        console.error('[CouponManagement] Health check failed:', healthError);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCoupons();
  }, [loadCoupons]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const resetForm = () => {
    setFormData({
      code: '',
      description: '',
      discount_type: 'percentage',
      discount_value: '',
      min_order_amount: '',
      max_discount_amount: '',
      max_uses: '',
      valid_from: '',
      valid_until: '',
      is_active: true
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    if (!formData.code.trim() || !formData.discount_value) {
      setMessage('Code and discount value are required');
      setMessageType('error');
      return;
    }

    try {
      if (editingId) {
        console.log('[CouponManagement] Updating coupon:', editingId, formData);
        await updateCoupon(editingId, formData);
        setMessage('Coupon updated successfully');
      } else {
        console.log('[CouponManagement] Creating new coupon:', formData);
        await createCoupon(formData);
        setMessage('Coupon created successfully');
      }
      setMessageType('success');
      resetForm();
      await loadCoupons();
    } catch (error) {
      console.error('[CouponManagement] Error saving coupon:', error);
      setMessage(error.response?.data?.error || error.message || 'Error saving coupon');
      setMessageType('error');
    }
  };

  const handleEdit = (coupon) => {
    setFormData({
      code: coupon.code || '',
      description: coupon.description || '',
      discount_type: coupon.discount_type || 'percentage',
      discount_value: coupon.discount_value || '',
      min_order_amount: coupon.min_order_amount || '',
      max_discount_amount: coupon.max_discount_amount || '',
      max_uses: coupon.max_uses || '',
      valid_from: coupon.valid_from ? new Date(coupon.valid_from).toISOString().slice(0, 16) : '',
      valid_until: coupon.valid_until ? new Date(coupon.valid_until).toISOString().slice(0, 16) : '',
      is_active: coupon.is_active
    });
    setEditingId(coupon.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this coupon?')) {
      try {
        console.log('[CouponManagement] Deleting coupon:', id);
        await deleteCoupon(id);
        setMessage('Coupon deleted successfully');
        setMessageType('success');
        await loadCoupons();
      } catch (error) {
        console.error('[CouponManagement] Error deleting coupon:', error);
        setMessage(error.response?.data?.error || error.message || 'Error deleting coupon');
        setMessageType('error');
      }
    }
  };

  const filteredCoupons = coupons.filter(coupon =>
    coupon.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="cm-modal"><div className="cm-container"><div className="loading">Loading coupons...</div></div></div>;
  }

  return (
    <div className="cm-modal">
      <div className="cm-container">
        <div className="cm-header">
          <h2>Manage Coupons</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="cm-content">
          {message && (
            <div className={`message ${messageType}`}>
              {message}
            </div>
          )}

          {!showForm ? (
            <div className="coupons-list-section">
              <button 
                className="btn btn-primary mb-20"
                onClick={() => setShowForm(true)}
              >
                + Create New Coupon
              </button>

              <div className="filters-section">
                <input
                  type="text"
                  placeholder="Search by coupon code..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
              </div>

              {filteredCoupons.length === 0 ? (
                <p className="empty-message">
                  {coupons.length === 0 
                    ? 'No coupons yet. Create your first coupon to get started!' 
                    : 'No matching coupons found'}
                </p>
              ) : (
                <div className="coupons-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Type</th>
                        <th>Value</th>
                        <th>Min Order</th>
                        <th>Used/Max</th>
                        <th>Valid Until</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCoupons.map(coupon => {
                        return (
                          <tr key={coupon.id}>
                            <td><strong>{coupon.code}</strong></td>
                            <td>
                              <span className="type-badge">
                                {coupon.discount_type === 'percentage' ? '%' : '₹'}
                              </span>
                            </td>
                            <td>
                              {coupon.discount_type === 'percentage' 
                                ? `${coupon.discount_value}%` 
                                : `₹${coupon.discount_value}`}
                            </td>
                            <td>
                              {coupon.min_order_amount ? `₹${coupon.min_order_amount}` : '-'}
                            </td>
                            <td>
                              {coupon.max_uses 
                                ? `${coupon.current_uses}/${coupon.max_uses}` 
                                : `${coupon.current_uses}/∞`}
                            </td>
                            <td>
                              {coupon.valid_until 
                                ? new Date(coupon.valid_until).toLocaleDateString() 
                                : '-'}
                            </td>
                            <td>
                              <span className={`status-badge ${coupon.is_active ? 'active' : 'inactive'}`}>
                                {coupon.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="actions">
                              <button
                                className="btn btn-sm btn-info"
                                onClick={() => handleEdit(coupon)}
                              >
                                Edit
                              </button>
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() => handleDelete(coupon.id)}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="list-footer">
                Total: {filteredCoupons.length} coupons
              </div>
            </div>
          ) : (
            <div className="form-section">
              <h3>{editingId ? 'Edit Coupon' : 'Create New Coupon'}</h3>
              <form onSubmit={handleSubmit}>
                <div className="form-grid">
                  <div className="form-group">
                    <label htmlFor="code">Coupon Code *</label>
                    <input
                      type="text"
                      id="code"
                      name="code"
                      value={formData.code}
                      onChange={handleChange}
                      placeholder="e.g., WELCOME10"
                      disabled={editingId}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="discount_type">Discount Type *</label>
                    <select
                      id="discount_type"
                      name="discount_type"
                      value={formData.discount_type}
                      onChange={handleChange}
                      required
                    >
                      <option value="percentage">Percentage (%)</option>
                      <option value="fixed">Fixed Amount (₹)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="discount_value">Discount Value *</label>
                    <input
                      type="number"
                      id="discount_value"
                      name="discount_value"
                      value={formData.discount_value}
                      onChange={handleChange}
                      placeholder={formData.discount_type === 'percentage' ? "e.g., 10" : "e.g., 50"}
                      step="0.01"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="min_order_amount">Min Order Amount (₹)</label>
                    <input
                      type="number"
                      id="min_order_amount"
                      name="min_order_amount"
                      value={formData.min_order_amount}
                      onChange={handleChange}
                      placeholder="e.g., 500"
                      step="0.01"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="max_discount_amount">Max Discount Amount (₹)</label>
                    <input
                      type="number"
                      id="max_discount_amount"
                      name="max_discount_amount"
                      value={formData.max_discount_amount}
                      onChange={handleChange}
                      placeholder="e.g., 1000"
                      step="0.01"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="max_uses">Max Uses</label>
                    <input
                      type="number"
                      id="max_uses"
                      name="max_uses"
                      value={formData.max_uses}
                      onChange={handleChange}
                      placeholder="Leave empty for unlimited"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="valid_from">Valid From</label>
                    <input
                      type="datetime-local"
                      id="valid_from"
                      name="valid_from"
                      value={formData.valid_from}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="valid_until">Valid Until</label>
                    <input
                      type="datetime-local"
                      id="valid_until"
                      name="valid_until"
                      value={formData.valid_until}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="form-group full-width">
                  <label htmlFor="description">Description</label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="e.g., Welcome discount for new customers"
                    rows="3"
                  ></textarea>
                </div>

                <div className="form-group checkbox">
                  <label>
                    <input
                      type="checkbox"
                      name="is_active"
                      checked={formData.is_active}
                      onChange={handleChange}
                    />
                    Active
                  </label>
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn btn-primary">
                    {editingId ? 'Update Coupon' : 'Create Coupon'}
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={resetForm}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CouponManagement;
