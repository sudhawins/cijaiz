import { useState, useEffect, useMemo } from 'react';
import { apiService } from '../api';
import SearchableDropdown from './SearchableDropdown';
import './TenantPaymentBalance.css';

interface TenantBalance {
  occupancyId: number;
  tenantId: number;
  tenantName: string;
  roomNumber: string;
  roomRent: number;
  checkInDate: string;
  checkOutDate: string | null;
  isActive: boolean;
  
  // Pro-rata calculations
  checkInProRata: number;
  checkOutProRata: number | null;
  expectedRent: number;
  
  // Payment information
  totalPaid: number;
  balance: number;
  balanceStatus: 'paid' | 'partial' | 'pending';
  
  // Tracking
  lastPaymentDate: string | null;
  paymentCount: number;
}

interface FilterStats {
  totalTenants: number;
  totalExpectedRent: number;
  totalPaid: number;
  totalBalance: number;
  paidCount: number;
  partialCount: number;
  pendingCount: number;
}

export default function TenantPaymentBalance() {
  const [tenantBalances, setTenantBalances] = useState<TenantBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [selectedTenant, setSelectedTenant] = useState<string>('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'paid' | 'partial' | 'pending'>('all');
  const [selectedRoom, setSelectedRoom] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showExpiredOnly, setShowExpiredOnly] = useState(false);

  // Load data on mount
  useEffect(() => {
    fetchPaymentBalances();
  }, []);

  const fetchPaymentBalances = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch payment balance data with pro-rata calculations from backend
      const balancesRes = await apiService.getPaymentBalance();
      const balances = balancesRes.data || [];
      
      setTenantBalances(balances);
    } catch (err) {
      console.error('Error fetching payment balances:', err);
      setError(err instanceof Error ? err.message : 'Failed to load payment balances');
    } finally {
      setLoading(false);
    }
  };

  // Generate tenant options
  const tenantOptions = useMemo(() => {
    const uniqueTenants = new Set<string>();
    tenantBalances.forEach((b) => {
      uniqueTenants.add(b.tenantName);
    });
    
    return Array.from(uniqueTenants)
      .sort()
      .map((name) => ({
        id: name,
        label: name
      }));
  }, [tenantBalances]);

  // Generate room options
  const roomOptions = useMemo(() => {
    const uniqueRooms = new Set<string>();
    tenantBalances.forEach((b) => {
      uniqueRooms.add(b.roomNumber);
    });
    
    const sortedRooms = Array.from(uniqueRooms).sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      return a.localeCompare(b);
    });
    
    return sortedRooms.map((room) => ({
      id: room,
      label: `Room ${room}`
    }));
  }, [tenantBalances]);

  // Filter balances
  const filteredBalances = useMemo(() => {
    return tenantBalances.filter((balance) => {
      // Status filter
      if (selectedStatusFilter !== 'all' && balance.balanceStatus !== selectedStatusFilter) {
        return false;
      }
      
      // Tenant filter
      if (selectedTenant && balance.tenantName !== selectedTenant) {
        return false;
      }
      
      // Room filter
      if (selectedRoom && balance.roomNumber !== selectedRoom) {
        return false;
      }
      
      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesTenantName = balance.tenantName.toLowerCase().includes(term);
        const matchesRoomNumber = balance.roomNumber.toLowerCase().includes(term);
        const matchesBalance = balance.balance.toString().includes(term);
        
        if (!matchesTenantName && !matchesRoomNumber && !matchesBalance) {
          return false;
        }
      }
      
      // Show expired only filter
      if (showExpiredOnly && balance.isActive) {
        return false;
      }
      
      return true;
    });
  }, [tenantBalances, selectedStatusFilter, selectedTenant, selectedRoom, searchTerm, showExpiredOnly]);

  // Calculate summary stats
  const summary = useMemo((): FilterStats => {
    return {
      totalTenants: filteredBalances.length,
      totalExpectedRent: filteredBalances.reduce((sum, b) => sum + b.expectedRent, 0),
      totalPaid: filteredBalances.reduce((sum, b) => sum + b.totalPaid, 0),
      totalBalance: filteredBalances.reduce((sum, b) => sum + Math.max(0, b.balance), 0),
      paidCount: filteredBalances.filter((b) => b.balanceStatus === 'paid').length,
      partialCount: filteredBalances.filter((b) => b.balanceStatus === 'partial').length,
      pendingCount: filteredBalances.filter((b) => b.balanceStatus === 'pending').length
    };
  }, [filteredBalances]);

  // Format currency
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  // Format date
  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="payment-balance-container">
        <div className="loading-spinner">Loading payment balances...</div>
      </div>
    );
  }

  return (
    <div className="payment-balance-container">
      <div className="page-header">
        <h1>Tenant Payment Balance Tracking</h1>
        <p>Track rent balance with pro-rata calculations based on check-in/check-out dates</p>
      </div>

      {error && (
        <div className="error-banner">
          <span>⚠️</span>
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="summary-cards-grid">
        <div className="summary-card total-expected">
          <div className="card-header">Total Expected Rent</div>
          <div className="card-amount">{formatCurrency(summary.totalExpectedRent)}</div>
          <div className="card-meta">For {summary.totalTenants} active tenants</div>
        </div>

        <div className="summary-card total-collected">
          <div className="card-header">Total Collected</div>
          <div className="card-amount">{formatCurrency(summary.totalPaid)}</div>
          <div className="card-meta">{summary.paidCount} fully paid</div>
        </div>

        <div className="summary-card total-balance">
          <div className="card-header">Outstanding Balance</div>
          <div className="card-amount highlight">{formatCurrency(summary.totalBalance)}</div>
          <div className="card-meta">
            {summary.partialCount} partial + {summary.pendingCount} pending
          </div>
        </div>

        <div className="summary-card collection-rate">
          <div className="card-header">Collection Rate</div>
          <div className="card-amount">
            {summary.totalExpectedRent > 0 
              ? Math.round((summary.totalPaid / summary.totalExpectedRent) * 100) 
              : 0}%
          </div>
          <div className="card-meta">₹{formatCurrency(summary.totalPaid)} of {formatCurrency(summary.totalExpectedRent)}</div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="filters-section">
        <div className="filters-grid">
          <div className="filter-group">
            <label>Status Filter</label>
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value as any)}
              className="filter-select"
            >
              <option value="all">All Statuses</option>
              <option value="paid">Fully Paid</option>
              <option value="partial">Partially Paid</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Tenant</label>
            <SearchableDropdown
              options={tenantOptions}
              value={selectedTenant}
              onChange={(option) => setSelectedTenant(option.id as string)}
              placeholder="Select tenant..."
            />
          </div>

          <div className="filter-group">
            <label>Room</label>
            <SearchableDropdown
              options={roomOptions}
              value={selectedRoom}
              onChange={(option) => setSelectedRoom(option.id as string)}
              placeholder="Select room..."
            />
          </div>

          <div className="filter-group">
            <label>Search</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search tenant, room, or balance..."
              className="filter-input"
            />
          </div>

          <div className="filter-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={showExpiredOnly}
                onChange={(e) => setShowExpiredOnly(e.target.checked)}
              />
              Show Expired Only
            </label>
          </div>
        </div>
      </div>

      {/* Results */}
      {filteredBalances.length === 0 ? (
        <div className="no-results">
          <p>No tenant payment records found matching your filters.</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="payment-balance-table">
            <thead>
              <tr>
                <th>Tenant</th>
                <th>Room</th>
                <th>Check-In</th>
                <th>Check-Out</th>
                <th>Full Month Rent</th>
                <th>Pro-Rata Expected</th>
                <th>Amount Paid</th>
                <th>Outstanding</th>
                <th>Status</th>
                <th>Last Payment</th>
                <th>Payments</th>
              </tr>
            </thead>
            <tbody>
              {filteredBalances.map((balance) => (
                <tr key={balance.occupancyId} className={`status-${balance.balanceStatus}`}>
                  <td className="tenant-name">
                    <strong>{balance.tenantName}</strong>
                  </td>
                  <td className="room-number">Room {balance.roomNumber}</td>
                  <td className="date">{formatDate(balance.checkInDate)}</td>
                  <td className="date">
                    {balance.checkOutDate ? formatDate(balance.checkOutDate) : 'Active'}
                  </td>
                  <td className="currency">{formatCurrency(balance.roomRent)}</td>
                  <td className="currency pro-rata">
                    <div className="pro-rata-cell">
                      {balance.checkOutDate ? (
                        <>
                          <div className="pro-rata-value">{formatCurrency(balance.checkOutProRata || 0)}</div>
                          <div className="pro-rata-label">Checkout: {balance.checkOutProRata}</div>
                        </>
                      ) : (
                        <>
                          <div className="pro-rata-value">{formatCurrency(balance.checkInProRata)}</div>
                          <div className="pro-rata-label">Check-in: {balance.checkInProRata}</div>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="currency paid">{formatCurrency(balance.totalPaid)}</td>
                  <td className={`currency balance ${balance.balance > 0 ? 'pending' : 'zero'}`}>
                    {formatCurrency(Math.max(0, balance.balance))}
                  </td>
                  <td className="status-badge">
                    <span className={`badge ${balance.balanceStatus}`}>
                      {balance.balanceStatus.charAt(0).toUpperCase() + balance.balanceStatus.slice(1)}
                    </span>
                  </td>
                  <td className="date">{formatDate(balance.lastPaymentDate)}</td>
                  <td className="text-center">{balance.paymentCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div className="legend">
        <h4>Pro-Rata Calculation Legend:</h4>
        <div className="legend-items">
          <div className="legend-item">
            <span className="check-in-label">Check-In Pro-Rata:</span>
            Rent calculated from check-in date to end of month
          </div>
          <div className="legend-item">
            <span className="checkout-label">Checkout Pro-Rata:</span>
            Rent calculated from 1st of month to checkout date
          </div>
          <div className="legend-item">
            <span className="collection-label">Collection Rate:</span>
            Percentage of total expected rent that has been collected
          </div>
        </div>
      </div>
    </div>
  );
}
