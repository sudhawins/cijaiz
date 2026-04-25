import React, { useState } from 'react';
import RoleManagement from './RoleManagement';
import ShippingZoneManagement from './ShippingZoneManagement';
import CityManagement from './CityManagement';
import CouponManagement from './CouponManagement';
import CustomerRewardsManagement from './CustomerRewardsManagement';
import { hasAnyRole, isAdmin } from '../utils/authUtils';
import './AdminPanel.css';

const AdminPanel = () => {
  const [activeTab, setActiveTab] = useState('shipping');
  const [showShippingZones, setShowShippingZones] = useState(false);
  const [showCities, setShowCities] = useState(false);
  const [showCoupons, setShowCoupons] = useState(false);
  const [showCustomerRewards, setShowCustomerRewards] = useState(false);
  
  // Check if user is Seller or Administrator
  const isSellerOrAdmin = hasAnyRole(['Seller', 'Administrator']);

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h1>🔐 Admin Panel</h1>
        <p>System Administration & Control</p>
      </div>

      <div className="admin-tabs">
        {isAdmin() && (
          <button
            className={`tab-button ${activeTab === 'roles' ? 'active' : ''}`}
            onClick={() => setActiveTab('roles')}
          >
            👥 Role Management
          </button>
        )}
        {isSellerOrAdmin && (
          <button
            className={`tab-button ${activeTab === 'shipping' ? 'active' : ''}`}
            onClick={() => setActiveTab('shipping')}
          >
            🚚 Shipping Management
          </button>
        )}
        {isSellerOrAdmin && (
          <button
            className={`tab-button ${activeTab === 'discounts' ? 'active' : ''}`}
            onClick={() => setActiveTab('discounts')}
          >
            💰 Discounts & Rewards
          </button>
        )}
        <button
          className={`tab-button ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
          disabled
        >
          ⚙️ Settings
        </button>
      </div>

      <div className="admin-content">
        {activeTab === 'roles' && isAdmin() && (
          <div className="tab-content">
            <RoleManagement />
          </div>
        )}
        {activeTab === 'shipping' && isSellerOrAdmin && (
          <div className="tab-content">
            <div className="shipping-management">
              <h2>🚚 Shipping Management</h2>
              <div className="shipping-options">
                <button 
                  className="management-btn"
                  onClick={() => setShowShippingZones(true)}
                >
                  <span className="icon">📍</span>
                  <span className="text">
                    <strong>Manage Shipping Zones</strong>
                    <p>Configure shipping rates and zones</p>
                  </span>
                </button>
                <button 
                  className="management-btn"
                  onClick={() => setShowCities(true)}
                >
                  <span className="icon">🏙️</span>
                  <span className="text">
                    <strong>Manage Cities & Zip Codes</strong>
                    <p>Add, edit, or remove delivery cities</p>
                  </span>
                </button>
              </div>
            </div>

            {showShippingZones && (
              <ShippingZoneManagement onClose={() => setShowShippingZones(false)} />
            )}

            {showCities && (
              <CityManagement onClose={() => setShowCities(false)} />
            )}
          </div>
        )}
        {activeTab === 'discounts' && isSellerOrAdmin && (
          <div className="tab-content">
            <div className="discounts-management">
              <h2>💰 Discounts & Rewards Management</h2>
              <div className="rewards-options">
                <button 
                  className="management-btn"
                  onClick={() => setShowCoupons(true)}
                >
                  <span className="icon">🎟️</span>
                  <span className="text">
                    <strong>Manage Coupons</strong>
                    <p>Create, edit, and manage discount coupons</p>
                  </span>
                </button>
                <button 
                  className="management-btn"
                  onClick={() => setShowCustomerRewards(true)}
                >
                  <span className="icon">⭐</span>
                  <span className="text">
                    <strong>Manage Customer Rewards</strong>
                    <p>View and adjust customer loyalty points</p>
                  </span>
                </button>
              </div>
            </div>

            {showCoupons && (
              <CouponManagement onClose={() => setShowCoupons(false)} />
            )}

            {showCustomerRewards && (
              <CustomerRewardsManagement onClose={() => setShowCustomerRewards(false)} />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
