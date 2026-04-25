import { useState, useEffect, useMemo } from 'react';
import { getOccupancyLinks } from '../api';
import SearchableDropdown from './SearchableDropdown';
import CheckoutModal from './CheckoutModal';
import './OccupancyLinks.css';

interface OccupancyLink {
  occupancyId: number;
  tenantId: number;
  tenantName: string;
  tenantPhone: string;
  tenantAddress: string;
  tenantCity: string;
  tenantPhoto?: string;
  roomId: number;
  roomNumber: string;
  roomRent: number;
  beds: number;
  checkInDate: string;
  checkOutDate: string | null;
  rentFixed: number;
  isActive: boolean;
  currentRentReceived: number;
  currentPendingPayment: number;
  lastPaymentDate?: string;
}

interface Stats {
  totalOccupancies: number;
  activeOccupancies: number;
  inactiveOccupancies: number;
  totalRentsCollected: number;
  totalPendingPayments: number;
}

export default function OccupancyLinks(): JSX.Element {
  const [occupancies, setOccupancies] = useState<OccupancyLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [searchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'tenant' | 'room' | 'checkIn'>('checkIn');
  const [showStatsGrid, setShowStatsGrid] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<string>('');
  const [selectedTenant, setSelectedTenant] = useState<string>('');
  const [selectedPhone, setSelectedPhone] = useState<string>('');
  const [checkInDateFrom, setCheckInDateFrom] = useState<string>('');
  const [checkInDateTo, setCheckInDateTo] = useState<string>('');
  const [checkOutDateFrom, setCheckOutDateFrom] = useState<string>('');
  const [checkOutDateTo, setCheckOutDateTo] = useState<string>('');
  const [selectedOccupancy, setSelectedOccupancy] = useState<OccupancyLink | null>(null);

  useEffect(() => {
    const fetchOccupancies = async () => {
      try {
        setLoading(true);
        const data = await getOccupancyLinks();
        setOccupancies(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load occupancy links');
        console.error('Error fetching occupancies:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchOccupancies();
  }, []);

  // Calculate statistics
  const stats = useMemo((): Stats => {
    const active = occupancies.filter(o => o.isActive).length;
    const inactive = occupancies.length - active;
    const totalCollected = occupancies.reduce((sum, o) => sum + (o.currentRentReceived || 0), 0);
    const totalPending = occupancies.reduce((sum, o) => sum + (o.currentPendingPayment || 0), 0);

    return {
      totalOccupancies: occupancies.length,
      activeOccupancies: active,
      inactiveOccupancies: inactive,
      totalRentsCollected: totalCollected,
      totalPendingPayments: totalPending
    };
  }, [occupancies]);

  // Generate room options
  const roomOptions = useMemo(() => {
    const roomStatusMap = new Map<string, boolean>(); // room -> has active occupancy
    occupancies.forEach((o) => {
      if (o.roomNumber) {
        const room = String(o.roomNumber).trim();
        if (o.isActive) {
          roomStatusMap.set(room, true);
        } else if (!roomStatusMap.has(room)) {
          roomStatusMap.set(room, false);
        }
      }
    });
    
    const uniqueRooms = Array.from(roomStatusMap.keys());
    const sortedRooms = uniqueRooms.sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      return a.localeCompare(b);
    });

    return sortedRooms.map((room) => ({
      id: room,
      label: roomStatusMap.get(room) ? `Room ${room} (Occupied)` : `Room ${room} (Vacant)`,
    }));
  }, [occupancies]);

  // Generate tenant options
  const tenantOptions = useMemo(() => {
    // Count rooms per tenant
    const tenantRoomCount = new Map<string, Set<string>>();
    occupancies.forEach((o) => {
      if (o.tenantName) {
        const tenantName = o.tenantName.trim();
        if (!tenantRoomCount.has(tenantName)) {
          tenantRoomCount.set(tenantName, new Set<string>());
        }
        if (o.roomNumber) {
          tenantRoomCount.get(tenantName)!.add(String(o.roomNumber).trim());
        }
      }
    });

    // Get unique tenants and create options
    const uniqueTenants = new Set<string>();
    occupancies.forEach((o) => {
      if (o.tenantName) {
        uniqueTenants.add(o.tenantName.trim());
      }
    });
    
    const sortedTenants = Array.from(uniqueTenants).sort((a, b) => a.localeCompare(b));
    return sortedTenants.map((tenant) => ({
      id: tenant,
      label: tenantRoomCount.get(tenant)!.size > 1 ? `${tenant} +` : tenant,
    }));
  }, [occupancies]);

  // Generate phone options
  const phoneOptions = useMemo(() => {
    const uniquePhones = new Set<string>();
    occupancies.forEach((o) => {
      if (o.tenantPhone) {
        uniquePhones.add(o.tenantPhone.trim());
      }
    });
    
    const sortedPhones = Array.from(uniquePhones).sort();
    return sortedPhones.map((phone) => ({
      id: phone,
      label: phone,
    }));
  }, [occupancies]);

  // Filter and sort occupancies
  const filteredAndSorted = useMemo(() => {
    let filtered = occupancies.filter(occ => {
      // Filter by status
      if (filterStatus === 'active' && !occ.isActive) return false;
      if (filterStatus === 'inactive' && occ.isActive) return false;

      // Filter by room
      if (selectedRoom && String(occ.roomNumber).trim() !== selectedRoom) return false;

      // Filter by tenant
      if (selectedTenant && occ.tenantName.trim() !== selectedTenant) return false;

      // Filter by phone
      if (selectedPhone && occ.tenantPhone.trim() !== selectedPhone) return false;

      // Filter by check-in date range
      if (checkInDateFrom || checkInDateTo) {
        const checkInDate = new Date(occ.checkInDate);
        checkInDate.setHours(0, 0, 0, 0);
        if (checkInDateFrom) {
          const fromDate = new Date(checkInDateFrom);
          fromDate.setHours(0, 0, 0, 0);
          if (checkInDate < fromDate) return false;
        }
        if (checkInDateTo) {
          const toDate = new Date(checkInDateTo);
          toDate.setHours(0, 0, 0, 0);
          if (checkInDate > toDate) return false;
        }
      }

      // Filter by check-out date range
      if ((checkOutDateFrom || checkOutDateTo) && occ.checkOutDate) {
        const checkOutDate = new Date(occ.checkOutDate);
        checkOutDate.setHours(0, 0, 0, 0);
        if (checkOutDateFrom) {
          const fromDate = new Date(checkOutDateFrom);
          fromDate.setHours(0, 0, 0, 0);
          if (checkOutDate < fromDate) return false;
        }
        if (checkOutDateTo) {
          const toDate = new Date(checkOutDateTo);
          toDate.setHours(0, 0, 0, 0);
          if (checkOutDate > toDate) return false;
        }
      }

      // Filter by search term
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          occ.tenantName.toLowerCase().includes(term) ||
          occ.roomNumber.toLowerCase().includes(term) ||
          occ.tenantPhone.toLowerCase().includes(term) ||
          occ.tenantCity.toLowerCase().includes(term)
        );
      }

      return true;
    });

    // Sort
    return filtered.sort((a, b) => {
      if (sortBy === 'tenant') return a.tenantName.localeCompare(b.tenantName);
      if (sortBy === 'room') return a.roomNumber.localeCompare(b.roomNumber);
      // Default: checkIn
      return new Date(b.checkInDate).getTime() - new Date(a.checkInDate).getTime();
    });
  }, [occupancies, filterStatus, searchTerm, sortBy, selectedRoom, selectedTenant, selectedPhone, checkInDateFrom, checkInDateTo, checkOutDateFrom, checkOutDateTo]);

  const formatCurrency = (value: number | undefined): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value || 0);
  };

  const formatDate = (dateStr: string | undefined): string => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="occupancy-links-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading room-tenant linkages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="occupancy-links-container">
      <h2 className="section-heading">Occupancy History</h2>
      {/* Error Message */}
      {error && (
        <div className="error-card">
          <span>❌</span>
          <div>
            <strong>Error</strong>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="section-header">
        <h2>Statistics</h2>
        <button 
          className={`toggle-btn ${showStatsGrid ? 'expanded' : 'collapsed'}`}
          onClick={() => setShowStatsGrid(!showStatsGrid)}
          aria-expanded={showStatsGrid}
        >
          {showStatsGrid ? '▼' : '▶'}
        </button>
      </div>
      
      <div className={`collapsible-content ${showStatsGrid ? 'open' : 'closed'}`}>
        <div className="stats-grid">
        <div className="stat-card total">
          <div className="stat-icon">🔗</div>
          <div className="stat-content">
            <h3>Total Linkages</h3>
            <p className="stat-value">{stats.totalOccupancies}</p>
          </div>
        </div>

        <div className="stat-card active">
          <div className="stat-icon">✓</div>
          <div className="stat-content">
            <h3>Active</h3>
            <p className="stat-value">{stats.activeOccupancies}</p>
          </div>
        </div>

        <div className="stat-card inactive">
          <div className="stat-icon">⊗</div>
          <div className="stat-content">
            <h3>Inactive</h3>
            <p className="stat-value">{stats.inactiveOccupancies}</p>
          </div>
        </div>

        <div className="stat-card collected">
          <div className="stat-icon">💵</div>
          <div className="stat-content">
            <h3>Rents Collected</h3>
            <p className="stat-value">{formatCurrency(stats.totalRentsCollected)}</p>
          </div>
        </div>

        <div className="stat-card pending">
          <div className="stat-icon">⏳</div>
          <div className="stat-content">
            <h3>Pending</h3>
            <p className="stat-value">{formatCurrency(stats.totalPendingPayments)}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="section-header">
        <h2>Filters & Search</h2>
        <button 
          className={`toggle-btn ${showFilters ? 'expanded' : 'collapsed'}`}
          onClick={() => setShowFilters(!showFilters)}
          aria-expanded={showFilters}
        >
          {showFilters ? '▼' : '▶'}
        </button>
      </div>

      <div className={`collapsible-content ${showFilters ? 'open' : 'closed'}`}>
        <div className="filters-section">
          {/* Status & Sort Controls Row */}
          <div className="filter-controls">
            <div className="filter-buttons">
              <button
                className={`filter-btn ${filterStatus === 'all' ? 'active' : ''}`}
                onClick={() => setFilterStatus('all')}
              >
                All ({stats.totalOccupancies})
              </button>
              <button
                className={`filter-btn ${filterStatus === 'active' ? 'active' : ''}`}
                onClick={() => setFilterStatus('active')}
              >
                Active ({stats.activeOccupancies})
              </button>
              <button
                className={`filter-btn ${filterStatus === 'inactive' ? 'active' : ''}`}
                onClick={() => setFilterStatus('inactive')}
              >
                Inactive ({stats.inactiveOccupancies})
              </button>
            </div>

            <div className="sort-controls">
              <label>Sort by:</label>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="sort-select">
                <option value="checkIn">Check-In Date (Newest)</option>
                <option value="tenant">Tenant Name</option>
                <option value="room">Room Number</option>
              </select>
            </div>
          </div>

          {/* Dropdowns Row */}
          <div className="filter-dropdowns">
            <div className="dropdown-container">
              <label>Room:</label>
              <select
                value={selectedRoom}
                onChange={(e) => setSelectedRoom(e.target.value)}
                className="filter-select"
              >
                <option value="">Select room</option>
                {roomOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="dropdown-container">
              <label>Tenant:</label>
              <select
                value={selectedTenant}
                onChange={(e) => setSelectedTenant(e.target.value)}
                className="filter-select"
              >
                <option value="">Select tenant</option>
                {tenantOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="dropdown-container">
              <label>Phone:</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <SearchableDropdown
                  options={phoneOptions}
                  value={selectedPhone}
                  onChange={(option) => setSelectedPhone(String(option?.id || ''))}
                  placeholder="Select phone"
                />
                {selectedPhone && (
                  <button
                    className="clear-filter-btn"
                    onClick={() => setSelectedPhone('')}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Date Ranges Row */}
          <div className="filter-date-ranges">
            <div className="date-range-container">
              <label>Check-In Date:</label>
              <div className="date-inputs">
                <input
                  type="date"
                  value={checkInDateFrom}
                  onChange={(e) => setCheckInDateFrom(e.target.value)}
                  className="date-input"
                  placeholder="From"
                />
                <span className="date-range-sep">to</span>
                <input
                  type="date"
                  value={checkInDateTo}
                  onChange={(e) => setCheckInDateTo(e.target.value)}
                  className="date-input"
                  placeholder="To"
                />
                {(checkInDateFrom || checkInDateTo) && (
                  <button
                    className="clear-filter-btn"
                    onClick={() => {
                      setCheckInDateFrom('');
                      setCheckInDateTo('');
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            <div className="date-range-container">
              <label>Check-Out Date:</label>
              <div className="date-inputs">
                <input
                  type="date"
                  value={checkOutDateFrom}
                  onChange={(e) => setCheckOutDateFrom(e.target.value)}
                  className="date-input"
                  placeholder="From"
                />
                <span className="date-range-sep">to</span>
                <input
                  type="date"
                  value={checkOutDateTo}
                  onChange={(e) => setCheckOutDateTo(e.target.value)}
                  className="date-input"
                  placeholder="To"
                />
                {(checkOutDateFrom || checkOutDateTo) && (
                  <button
                    className="clear-filter-btn"
                    onClick={() => {
                      setCheckOutDateFrom('');
                      setCheckOutDateTo('');
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Occupancy History Table */}
      <div className="table-wrapper">
        <table className="occupancy-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Room</th>
              <th>Tenant</th>
              <th>Phone</th>
              <th>Check-In</th>
              <th>Check-Out</th>
              <th>Rent Fixed</th>
              <th>Collected</th>
              <th>Pending</th>
              <th>Last Payment</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSorted.length > 0 ? (
              filteredAndSorted.map(occ => (
                <tr key={occ.occupancyId} className={`row ${occ.isActive ? 'active' : 'inactive'}`}>
                  <td className="status-cell">
                    <span className={`badge ${occ.isActive ? 'active' : 'inactive'}`}>
                      {occ.isActive ? '🟢 Active' : '🔴 Ended'}
                    </span>
                  </td>
                  <td className="room-cell">
                    <strong>#{occ.roomNumber.trim()}</strong>
                    <small>{occ.beds} bed{occ.beds > 1 ? 's' : ''}</small>
                  </td>
                  <td className="tenant-cell">
                    <strong>{occ.tenantName.trim()}</strong>
                    <small>{occ.tenantCity.trim()}</small>
                  </td>
                  <td className="phone-cell">
                    <a href={`tel:${occ.tenantPhone.trim()}`}>{occ.tenantPhone.trim()}</a>
                  </td>
                  <td>{formatDate(occ.checkInDate)}</td>
                  <td>{occ.checkOutDate ? formatDate(occ.checkOutDate) : '-'}</td>
                  <td className="currency-cell">
                    <strong>{formatCurrency(occ.rentFixed)}</strong>
                  </td>
                  <td className="currency-cell collected">
                    {formatCurrency(occ.currentRentReceived)}
                  </td>
                  <td className="currency-cell pending">
                    {formatCurrency(occ.currentPendingPayment)}
                  </td>
                  <td>{occ.lastPaymentDate ? formatDate(occ.lastPaymentDate) : '-'}</td>
                  <td className="actions-cell">
                    {occ.isActive && (
                      <button
                        className="action-btn checkout-btn"
                        onClick={() => {
                          setSelectedOccupancy(occ);
                        }}
                        title="Checkout tenant"
                      >
                        Checkout
                      </button>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr className="no-data">
                <td colSpan={11}>
                  <p>📭 No occupancy history found matching your criteria</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Checkout Modal */}
      {selectedOccupancy && (
        <CheckoutModal
          occupancyId={selectedOccupancy.occupancyId}
          tenantName={selectedOccupancy.tenantName}
          roomNumber={selectedOccupancy.roomNumber}
          checkInDate={selectedOccupancy.checkInDate}
          onClose={() => {
            setSelectedOccupancy(null);
          }}
          onCheckoutSuccess={() => {
            setSelectedOccupancy(null);
            // Refresh the occupancies list
            const fetchOccupancies = async () => {
              try {
                const data = await getOccupancyLinks();
                setOccupancies(data);
              } catch (err) {
                console.error('Error refreshing occupancies:', err);
              }
            };
            fetchOccupancies();
          }}
        />
      )}
    </div>
    </div>
  );
}
