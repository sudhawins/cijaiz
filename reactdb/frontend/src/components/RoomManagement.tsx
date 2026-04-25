import { useState, useEffect, useMemo, MouseEvent } from 'react';
import { useAuth } from './AuthContext';
import { apiService, getFileUrl } from '../api';
import { getOccupancyLinks } from '../api';
import './RoomManagement.css';

interface Room {
  id: number;
  roomNumber: string;
  beds: number;
  roomRent: number;
}

interface TenantHistory {
  occupancyId: number;
  tenantId: number;
  tenantName: string;
  tenantPhone: string;
  tenantCity: string;
  checkInDate: string;
  checkOutDate: string | null;
  rentFixed: number;
  advanceCollected: number;
  isActive: boolean;
  currentRentReceived: number;
  currentPendingPayment: number;
}

interface TenantDetails {
  id: number;
  name: string;
  phone: string;
  address: string;
  city: string;
  photoUrl?: string;
  roomNumber?: string;
  checkInDate?: string;
  checkOutDate?: string;
}

interface RoomWithHistory extends Room {
  tenantHistory: TenantHistory[];
}

export default function RoomManagement(): JSX.Element {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  
  const [rooms, setRooms] = useState<RoomWithHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [expandedRooms, setExpandedRooms] = useState<Set<number>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [roomSearchTerm, setRoomSearchTerm] = useState('');
  const [phoneSearchTerm, setPhoneSearchTerm] = useState('');
  const [occupancyFilter, setOccupancyFilter] = useState<'all' | 'occupied' | 'vacant'>('all');
  const [editingRentRoomId, setEditingRentRoomId] = useState<number | null>(null);
  const [editingRentValue, setEditingRentValue] = useState<string>('');
  const [showStatsGrid, setShowStatsGrid] = useState(true);
  const [selectedTenant, setSelectedTenant] = useState<TenantDetails | null>(null);
  const [tenantModalLoading, setTenantModalLoading] = useState(false);
  const [tenantModalError, setTenantModalError] = useState<string | null>(null);

  // Fetch rooms and occupancy data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get rooms data
        const roomsResponse = await apiService.getRooms();
        const roomsList = roomsResponse.data || [];

        // Get occupancy links (includes all tenant history)
        const occupancyData = await getOccupancyLinks();

        // Group occupancy data by room
        const roomsWithHistory: RoomWithHistory[] = roomsList.map((room: any) => {
          const tenantHistory = occupancyData.filter(
            (occ: any) => Number(occ.roomId) === Number(room.id)
          );

          return {
            id: room.id,
            roomNumber: String(room.roomNumber || room.number || ''),
            beds: room.beds || 0,
            roomRent: room.roomRent || room.rent || 0,
            tenantHistory: tenantHistory
          };
        });

        // Sort rooms by number
        roomsWithHistory.sort((a, b) => {
          const roomNumA = String(a.roomNumber || '');
          const roomNumB = String(b.roomNumber || '');
          const numA = parseInt(roomNumA, 10);
          const numB = parseInt(roomNumB, 10);
          if (!isNaN(numA) && !isNaN(numB)) {
            return numA - numB;
          }
          return roomNumA.localeCompare(roomNumB);
        });

        setRooms(roomsWithHistory);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load room management data');
        console.error('Error fetching room data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalRooms = rooms.length;
    const occupiedRooms = rooms.filter(r => r.tenantHistory.some(t => t.isActive)).length;
    
    // Count vacant rooms using the same logic as getVacancyStatus
    const vacantRooms = rooms.filter(room => {
      const hasActiveTenant = room.tenantHistory.some(t => t.isActive);
      if (hasActiveTenant) return false;
      
      // Room is vacant if it has no active tenants
      return true;
    }).length;
    
    const totalMonthlyRent = rooms.reduce((sum, r) => sum + r.roomRent, 0);

    return {
      totalRooms,
      occupiedRooms,
      vacantRooms,
      totalMonthlyRent
    };
  }, [rooms]);

  // Filter rooms based on room number, phone search, and occupancy
  const filteredRooms = useMemo(() => {
    return rooms.filter(room => {
      // Apply occupancy filter
      if (occupancyFilter === 'occupied') {
        const hasActiveTenant = room.tenantHistory.some(t => t.isActive);
        if (!hasActiveTenant) return false;
      } else if (occupancyFilter === 'vacant') {
        const hasActiveTenant = room.tenantHistory.some(t => t.isActive);
        if (hasActiveTenant) return false;
      }

      // Apply search filters
      const roomSearchActive = roomSearchTerm.trim().length > 0;
      const phoneSearchActive = phoneSearchTerm.trim().length > 0;

      if (!roomSearchActive && !phoneSearchActive) return true;

      const roomTerm = roomSearchTerm.toLowerCase();
      const phoneTerm = phoneSearchTerm.toLowerCase();

      let matchesRoom = !roomSearchActive || room.roomNumber.toLowerCase().includes(roomTerm);
      let matchesPhone = !phoneSearchActive || room.tenantHistory.some(
        t => String(t.tenantPhone || '').toLowerCase().includes(phoneTerm)
      );

      return matchesRoom && matchesPhone;
    });
  }, [rooms, roomSearchTerm, phoneSearchTerm, occupancyFilter]);

  // Auto-expand/collapse rooms based on search
  useEffect(() => {
    if (phoneSearchTerm.trim().length > 0) {
      // Auto-expand rooms with matching phone numbers
      const searchTerm = phoneSearchTerm.toLowerCase();
      const roomsWithMatchingPhone = new Set<number>();
      
      filteredRooms.forEach(room => {
        if (room.tenantHistory.some(t => String(t.tenantPhone || '').toLowerCase().includes(searchTerm))) {
          roomsWithMatchingPhone.add(room.id);
        }
      });
      
      console.log('[RoomManagement] Auto-expanding rooms with matching phone:', { phoneSearchTerm, roomIds: Array.from(roomsWithMatchingPhone) });
      setExpandedRooms(roomsWithMatchingPhone);
    } else if (roomSearchTerm.trim().length > 0) {
      // Auto-collapse when searching by room
      console.log('[RoomManagement] Collapsing all rooms due to room search:', roomSearchTerm);
      setExpandedRooms(new Set());
    }
  }, [roomSearchTerm, phoneSearchTerm, filteredRooms]);

  // Group filtered rooms by category
  const groupedRooms = useMemo(() => {
    const shops = filteredRooms.filter(r => (r.beds || 0) === 0);
    const residential = filteredRooms.filter(r => (r.beds || 0) > 0);
    
    return {
      shops: shops.sort((a, b) => parseInt(a.roomNumber) - parseInt(b.roomNumber)),
      residential: residential.sort((a, b) => parseInt(a.roomNumber) - parseInt(b.roomNumber))
    };
  }, [filteredRooms]);

  const toggleRoomExpanded = (roomId: number) => {
    setExpandedRooms(prev => {
      const newSet = new Set(prev);
      if (newSet.has(roomId)) {
        newSet.delete(roomId);
      } else {
        newSet.add(roomId);
      }
      return newSet;
    });
  };

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

  const getRoomCategory = (beds: number): string => {
    if (beds === 0) return 'Shop';
    return `${beds} bed${beds > 1 ? 's' : ''}`;
  };

  const getRoomAdvanceTotal = (tenantHistory: TenantHistory[]): number => {
    return tenantHistory
      .filter((tenant) => tenant.isActive)
      .reduce((sum, tenant) => sum + (tenant.advanceCollected || 0), 0);
  };

  const renderHighlightedPhone = (phone: string, searchTerm: string): JSX.Element => {
    if (!phone) return <></>;
    const display = (() => {
      if (!searchTerm.trim()) return phone;
      const lowerPhone = phone.toLowerCase();
      const lowerSearch = searchTerm.toLowerCase();
      const index = lowerPhone.indexOf(lowerSearch);
      if (index === -1) return phone;
      return <>
        {phone.substring(0, index)}
        <span className="phone-highlight">{phone.substring(index, index + searchTerm.length)}</span>
        {phone.substring(index + searchTerm.length)}
      </>;
    })();
    return (
      <a href={`tel:${phone}`}>{display}</a>
    );
  };

  const getVacancyStatus = (tenantHistory: TenantHistory[]): { isVacant: boolean; daysVacant: number; lastCheckoutDate: string | null } => {
    // Check if the room has any active tenants
    const hasActiveTenant = tenantHistory.some(t => t.isActive);
    
    if (hasActiveTenant) {
      return { isVacant: false, daysVacant: 0, lastCheckoutDate: null };
    }

    // If no active tenant, find the most recent checkout date
    if (tenantHistory.length === 0) {
      return { isVacant: true, daysVacant: 0, lastCheckoutDate: null };
    }

    // Get the most recent checkout date
    const checkouts = tenantHistory
      .filter(t => t.checkOutDate)
      .map(t => ({ ...t, checkOutDateTime: new Date(t.checkOutDate!).getTime() }));

    if (checkouts.length === 0) {
      // No checkout date means it's never been occupied or still occupied
      return { isVacant: false, daysVacant: 0, lastCheckoutDate: null };
    }

    const lastCheckout = checkouts.reduce((max, current) => 
      current.checkOutDateTime > max.checkOutDateTime ? current : max
    );

    const lastCheckoutDate = lastCheckout.checkOutDate!;
    const today = new Date();
    const lastCheckoutDateObj = new Date(lastCheckoutDate);
    
    // Calculate days vacant
    const daysVacant = Math.floor((today.getTime() - lastCheckoutDateObj.getTime()) / (1000 * 60 * 60 * 24));

    return { isVacant: true, daysVacant, lastCheckoutDate: lastCheckoutDate };
  };

  const handleEditRent = (roomId: number, currentRent: number) => {
    if (!isAdmin) return;
    setEditingRentRoomId(roomId);
    setEditingRentValue(String(currentRent));
  };

  const handleSaveRent = async (roomId: number) => {
    try {
      const newRent = parseFloat(editingRentValue);
      if (isNaN(newRent) || newRent < 0) {
        setError('Invalid rent amount');
        return;
      }

      // Call the API to update the rent
      await apiService.updateRoom(roomId, { rent: newRent });

      // Update the room in the local state
      setRooms(rooms.map(r => 
        r.id === roomId ? { ...r, roomRent: newRent } : r
      ));

      setSuccessMessage('Room rent updated successfully!');
      setEditingRentRoomId(null);
      setEditingRentValue('');
      setError(null);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update rent');
      console.error('Error updating room rent:', err);
    }
  };

  const handleCancelEditRent = () => {
    setEditingRentRoomId(null);
    setEditingRentValue('');
  };

  const handleExpandAll = () => {
    console.log('[RoomManagement] Expand All clicked, total rooms:', rooms.length);
    setExpandedRooms(new Set(rooms.map(r => r.id)));
  };

  const handleCollapseAll = () => {
    console.log('[RoomManagement] Collapse All button clicked');
    setExpandedRooms(new Set());
  };

  const toggleCategoryExpanded = (categoryName: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryName)) {
        newSet.delete(categoryName);
      } else {
        newSet.add(categoryName);
      }
      return newSet;
    });
  };

  const handleRoomCardClick = (roomId: number, event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as Element | null;

    if (!target) {
      toggleRoomExpanded(roomId);
      return;
    }

    const isInteractiveElement = target.closest('button, a, input, select, textarea, label');
    const isInsideTenantHistory = target.closest('.tenant-history');

    if (isInteractiveElement || isInsideTenantHistory) {
      return;
    }

    toggleRoomExpanded(roomId);
  };

  const handleViewTenant = async (tenantId: number) => {
    try {
      setTenantModalLoading(true);
      setTenantModalError(null);
      const response = await apiService.getTenantById(tenantId);
      setSelectedTenant(response.data || null);
    } catch (err) {
      setTenantModalError(err instanceof Error ? err.message : 'Failed to load tenant details');
      setSelectedTenant(null);
    } finally {
      setTenantModalLoading(false);
    }
  };

  const closeTenantModal = () => {
    setSelectedTenant(null);
    setTenantModalError(null);
  };

  if (loading) {
    return (
      <div className="room-management-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading room management data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="room-management-container">
      <h2 className="section-heading">Room Management</h2>
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

      {/* Success Message */}
      {successMessage && (
        <div className="success-card">
          <span>✅</span>
          <div>
            <strong>Success</strong>
            <p>{successMessage}</p>
          </div>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="section-header">
        <h2>Room Statistics</h2>
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
            <div className="stat-icon">🏠</div>
            <div className="stat-content">
              <h3>Total Rooms</h3>
              <p className="stat-value">{stats.totalRooms}</p>
            </div>
          </div>

          <div 
            className={`stat-card occupied ${occupancyFilter === 'occupied' ? 'active-filter' : ''}`}
            onClick={() => setOccupancyFilter(occupancyFilter === 'occupied' ? 'all' : 'occupied')}
            style={{ cursor: 'pointer' }}
            title="Click to filter by occupied rooms"
          >
            <div className="stat-icon">✓</div>
            <div className="stat-content">
              <h3>Occupied</h3>
              <p className="stat-value">{stats.occupiedRooms}</p>
            </div>
          </div>

          <div 
            className={`stat-card vacant ${occupancyFilter === 'vacant' ? 'active-filter' : ''}`}
            onClick={() => setOccupancyFilter(occupancyFilter === 'vacant' ? 'all' : 'vacant')}
            style={{ cursor: 'pointer' }}
            title="Click to filter by vacant rooms"
          >
            <div className="stat-icon">⊗</div>
            <div className="stat-content">
              <h3>Vacant</h3>
              <p className="stat-value">{stats.vacantRooms}</p>
            </div>
          </div>

          <div className="stat-card monthly-rent">
            <div className="stat-icon">💵</div>
            <div className="stat-content">
              <h3>Total Monthly Rent</h3>
              <p className="stat-value">{formatCurrency(stats.totalMonthlyRent)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="search-section">
        <div className="search-inputs-container">
          <div className="search-input-group">
            <label className="search-label">🏠 Room</label>
            <input
              type="text"
              placeholder="Search by room number..."
              value={roomSearchTerm}
              onChange={(e) => setRoomSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          <div className="search-input-group">
            <label className="search-label">📱 Phone</label>
            <input
              type="text"
              placeholder="Search by tenant phone..."
              value={phoneSearchTerm}
              onChange={(e) => setPhoneSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
        </div>
        <div className="expand-collapse-buttons">
          <button
            onClick={handleExpandAll}
            className="btn-expand-all"
            title="Expand all room details"
          >
            ▼ Expand All
          </button>
          <button
            onClick={handleCollapseAll}
            className="btn-collapse-all"
            title="Collapse all room details"
          >
            ▶ Collapse All
          </button>
        </div>
      </div>

      {(tenantModalLoading || tenantModalError || selectedTenant) && (
        <div className="tenant-view-modal-overlay" onClick={closeTenantModal}>
          <div className="tenant-view-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tenant-view-modal-header">
              <h3>Tenant Details</h3>
              <button className="tenant-view-close" onClick={closeTenantModal} aria-label="Close tenant details">✕</button>
            </div>

            {tenantModalLoading && <p className="tenant-view-loading">Loading tenant details...</p>}

            {!tenantModalLoading && tenantModalError && (
              <p className="tenant-view-error">{tenantModalError}</p>
            )}

            {!tenantModalLoading && !tenantModalError && selectedTenant && (
              <div className="tenant-view-content">
                <div className="tenant-view-photo-wrap">
                  {selectedTenant.photoUrl ? (
                    <img
                      src={getFileUrl(selectedTenant.photoUrl)}
                      alt={selectedTenant.name || 'Tenant'}
                      className="tenant-view-photo"
                    />
                  ) : (
                    <div className="tenant-view-photo-placeholder">
                      {(selectedTenant.name || '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="tenant-view-fields">
                  <p><strong>Name:</strong> {selectedTenant.name || '-'}</p>
                  <p><strong>Phone:</strong> {selectedTenant.phone || '-'}</p>
                  <p><strong>City:</strong> {selectedTenant.city || '-'}</p>
                  <p><strong>Address:</strong> {selectedTenant.address || '-'}</p>
                  <p><strong>Current Room:</strong> {selectedTenant.roomNumber || '-'}</p>
                  <p><strong>Check-In:</strong> {selectedTenant.checkInDate ? formatDate(selectedTenant.checkInDate) : '-'}</p>
                  <p><strong>Check-Out:</strong> {selectedTenant.checkOutDate ? formatDate(selectedTenant.checkOutDate) : '-'}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rooms List */}
      <div className="rooms-list">
        {groupedRooms.shops.length > 0 || groupedRooms.residential.length > 0 ? (
          <>
            {/* Shops Category */}
            {groupedRooms.shops.length > 0 && (
              <>
                <div className="category-heading">
                  <div className="category-title">
                    <button
                      onClick={() => toggleCategoryExpanded('shops')}
                      className={`category-toggle ${expandedCategories.has('shops') ? 'expanded' : ''}`}
                      title="Toggle shops section"
                    >
                      {expandedCategories.has('shops') ? '▼' : '▶'}
                    </button>
                    <h2>🏪 Shops</h2>
                  </div>
                  <span className="category-count">{groupedRooms.shops.length}</span>
                </div>
                {expandedCategories.has('shops') && (
                  <>
                    {groupedRooms.shops.map(room => (
                  <div key={room.id} className="room-card" onClick={(event) => handleRoomCardClick(room.id, event)}>
                    <div className="room-header">
                      <div className="room-info">
                        <h3 className="room-number">Shop #{room.roomNumber}</h3>
                        <div className="room-badges">
                          <span className="room-beds">{getRoomCategory(room.beds || 0)}</span>
                          <span className="tenants-count">Tenants: {room.tenantHistory.length}</span>
                          <span className="advance-total-badge">Advance: {formatCurrency(getRoomAdvanceTotal(room.tenantHistory))}</span>
                          {(() => {
                            const vacancy = getVacancyStatus(room.tenantHistory);
                            return vacancy.isVacant ? (
                              <span className="vacancy-badge">{vacancy.daysVacant === 0 ? 'Just Vacant' : `Vacant: ${vacancy.daysVacant}d`}</span>
                            ) : null;
                          })()}
                        </div>
                      </div>

                      <div className="room-rent-section">
                        {editingRentRoomId === room.id ? (
                          <div className="rent-edit-form">
                            <input
                              type="number"
                              value={editingRentValue}
                              onChange={(e) => setEditingRentValue(e.target.value)}
                              className="rent-input"
                              min="0"
                              step="100"
                            />
                            <button
                              onClick={() => handleSaveRent(room.id)}
                              className="btn-save"
                              disabled={!isAdmin}
                            >
                              Save
                            </button>
                            <button
                              onClick={handleCancelEditRent}
                              className="btn-cancel"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="rent-display">
                            <span className="rent-label">Rent:</span>
                            <span className="rent-amount">{formatCurrency(room.roomRent)}</span>
                            {isAdmin && (
                              <button
                                onClick={() => handleEditRent(room.id, room.roomRent)}
                                className="btn-edit"
                                title="Edit rent (Admin only)"
                              >
                                ✎
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="occupancy-status">
                        {room.tenantHistory.some(t => t.isActive) ? (
                          <span className="badge active">🟢 Occupied</span>
                        ) : (
                          <span className="badge vacant">🔴 Vacant</span>
                        )}
                      </div>

                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleRoomExpanded(room.id);
                        }}
                        className={`expand-btn ${expandedRooms.has(room.id) ? 'expanded' : ''}`}
                      >
                        {expandedRooms.has(room.id) ? '▼' : '▶'}
                      </button>
                    </div>

                    {/* Tenant History */}
                    {expandedRooms.has(room.id) && (
                      <div className="tenant-history">
                        <h4>Tenant History</h4>
                        {room.tenantHistory.length > 0 ? (
                          <table className="history-table">
                            <thead>
                              <tr>
                                <th>Status</th>
                                <th>View</th>
                                <th>Tenant Name</th>
                                <th>Phone</th>
                                <th>City</th>
                                <th>Check-In</th>
                                <th>Check-Out</th>
                                <th>Rent</th>
                                <th>Advance</th>
                                <th>Collected</th>
                                <th>Pending</th>
                              </tr>
                            </thead>
                            <tbody>
                              {room.tenantHistory
                                .sort((a, b) => new Date(b.checkInDate).getTime() - new Date(a.checkInDate).getTime())
                                .map(tenant => (
                                  <tr key={tenant.occupancyId} className={tenant.isActive ? 'active' : 'inactive'}>
                                    <td className="status-cell">
                                      <span className={`badge ${tenant.isActive ? 'active' : 'inactive'}`}>
                                        {tenant.isActive ? '🟢 Active' : '🔴 Ended'}
                                      </span>
                                    </td>
                                    <td>
                                      <button
                                        type="button"
                                        className="tenant-view-btn"
                                        title="View tenant"
                                        aria-label={`View ${tenant.tenantName || 'tenant'}`}
                                        onClick={() => handleViewTenant(tenant.tenantId)}
                                      >
                                        👁
                                      </button>
                                    </td>
                                    <td className="tenant-name">{(tenant.tenantName || '').trim()}</td>
                                    <td className="phone">{renderHighlightedPhone((tenant.tenantPhone || '').trim(), phoneSearchTerm)}</td>
                                    <td className="city">{(tenant.tenantCity || '').trim()}</td>
                                    <td className="date">{formatDate(tenant.checkInDate)}</td>
                                    <td className="date">{tenant.checkOutDate ? formatDate(tenant.checkOutDate) : '-'}</td>
                                    <td className="currency">{formatCurrency(tenant.rentFixed)}</td>
                                    <td className="currency collected">{formatCurrency(tenant.advanceCollected)}</td>
                                    <td className="currency collected">{formatCurrency(tenant.currentRentReceived)}</td>
                                    <td className="currency pending">{formatCurrency(tenant.currentPendingPayment)}</td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        ) : (
                          <p className="no-history">No tenant history for this shop</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                  </>
                )}
              </>
            )}

            {/* Residential Rooms Category */}
            {groupedRooms.residential.length > 0 && (
              <>
                <div className="category-heading">
                  <div className="category-title">
                    <button
                      onClick={() => toggleCategoryExpanded('residential')}
                      className={`category-toggle ${expandedCategories.has('residential') ? 'expanded' : ''}`}
                      title="Toggle residential rooms section"
                    >
                      {expandedCategories.has('residential') ? '▼' : '▶'}
                    </button>
                    <h2>🏠 Residential Rooms</h2>
                  </div>
                  <span className="category-count">{groupedRooms.residential.length}</span>
                </div>
                {expandedCategories.has('residential') && (
                  <>
                    {groupedRooms.residential.map(room => (
                  <div key={room.id} className="room-card" onClick={(event) => handleRoomCardClick(room.id, event)}>
                    <div className="room-header">
                      <div className="room-info">
                        <h3 className="room-number">Room #{room.roomNumber}</h3>
                        <div className="room-badges">
                          <span className="room-beds">{getRoomCategory(room.beds || 0)}</span>
                          <span className="tenants-count">Tenants: {room.tenantHistory.length}</span>
                          <span className="advance-total-badge">Advance: {formatCurrency(getRoomAdvanceTotal(room.tenantHistory))}</span>
                          {(() => {
                            const vacancy = getVacancyStatus(room.tenantHistory);
                            return vacancy.isVacant ? (
                              <span className="vacancy-badge">{vacancy.daysVacant === 0 ? 'Just Vacant' : `Vacant: ${vacancy.daysVacant}d`}</span>
                            ) : null;
                          })()}
                        </div>
                      </div>

                      <div className="room-rent-section">
                        {editingRentRoomId === room.id ? (
                          <div className="rent-edit-form">
                            <input
                              type="number"
                              value={editingRentValue}
                              onChange={(e) => setEditingRentValue(e.target.value)}
                              className="rent-input"
                              min="0"
                              step="100"
                            />
                            <button
                              onClick={() => handleSaveRent(room.id)}
                              className="btn-save"
                              disabled={!isAdmin}
                            >
                              Save
                            </button>
                            <button
                              onClick={handleCancelEditRent}
                              className="btn-cancel"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="rent-display">
                            <span className="rent-label">Rent:</span>
                            <span className="rent-amount">{formatCurrency(room.roomRent)}</span>
                            {isAdmin && (
                              <button
                                onClick={() => handleEditRent(room.id, room.roomRent)}
                                className="btn-edit"
                                title="Edit rent (Admin only)"
                              >
                                ✎
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="occupancy-status">
                        {room.tenantHistory.some(t => t.isActive) ? (
                          <span className="badge active">🟢 Occupied</span>
                        ) : (
                          <span className="badge vacant">🔴 Vacant</span>
                        )}
                      </div>

                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleRoomExpanded(room.id);
                        }}
                        className={`expand-btn ${expandedRooms.has(room.id) ? 'expanded' : ''}`}
                      >
                        {expandedRooms.has(room.id) ? '▼' : '▶'}
                      </button>
                    </div>

                    {/* Tenant History */}
                    {expandedRooms.has(room.id) && (
                      <div className="tenant-history">
                        <h4>Tenant History</h4>
                        {room.tenantHistory.length > 0 ? (
                          <table className="history-table">
                            <thead>
                              <tr>
                                <th>Status</th>
                                <th>View</th>
                                <th>Tenant Name</th>
                                <th>Phone</th>
                                <th>City</th>
                                <th>Check-In</th>
                                <th>Check-Out</th>
                                <th>Rent</th>
                                <th>Advance</th>
                                <th>Collected</th>
                                <th>Pending</th>
                              </tr>
                            </thead>
                            <tbody>
                              {room.tenantHistory
                                .sort((a, b) => new Date(b.checkInDate).getTime() - new Date(a.checkInDate).getTime())
                                .map(tenant => (
                                  <tr key={tenant.occupancyId} className={tenant.isActive ? 'active' : 'inactive'}>
                                    <td className="status-cell">
                                      <span className={`badge ${tenant.isActive ? 'active' : 'inactive'}`}>
                                        {tenant.isActive ? '🟢 Active' : '🔴 Ended'}
                                      </span>
                                    </td>
                                    <td>
                                      <button
                                        type="button"
                                        className="tenant-view-btn"
                                        title="View tenant"
                                        aria-label={`View ${tenant.tenantName || 'tenant'}`}
                                        onClick={() => handleViewTenant(tenant.tenantId)}
                                      >
                                        👁
                                      </button>
                                    </td>
                                    <td className="tenant-name">{(tenant.tenantName || '').trim()}</td>
                                    <td className="phone">{renderHighlightedPhone((tenant.tenantPhone || '').trim(), phoneSearchTerm)}</td>
                                    <td className="city">{(tenant.tenantCity || '').trim()}</td>
                                    <td className="date">{formatDate(tenant.checkInDate)}</td>
                                    <td className="date">{tenant.checkOutDate ? formatDate(tenant.checkOutDate) : '-'}</td>
                                    <td className="currency">{formatCurrency(tenant.rentFixed)}</td>
                                    <td className="currency collected">{formatCurrency(tenant.advanceCollected)}</td>
                                    <td className="currency collected">{formatCurrency(tenant.currentRentReceived)}</td>
                                    <td className="currency pending">{formatCurrency(tenant.currentPendingPayment)}</td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        ) : (
                          <p className="no-history">No tenant history for this room</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                  </>
                )}
              </>
            )}
          </>
        ) : (
          <div className="no-results">
            <p>📭 No rooms found matching your search criteria</p>
          </div>
        )}
      </div>
    </div>
  );
}
