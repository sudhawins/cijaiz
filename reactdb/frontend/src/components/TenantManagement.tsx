import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { apiService } from '../api';
import SearchableDropdown from './SearchableDropdown';
import TenantForm from './TenantForm';
import TenantCard from './TenantCard';
import TenantHeader from './TenantHeader';
import TenantSearchFilters, { SearchField, SortOption } from './TenantSearchFilters';
import TenantFullScreenView from './TenantFullScreenView';
import TenantPhotoGalleryModal from './TenantPhotoGalleryModal';
import CheckoutModal from './CheckoutModal';
import CheckinModal from './CheckinModal';
import './TenantManagement.css';

export interface Tenant {
  id: number;
  name: string;
  phone: string;
  address: string;
  city: string;
  photoUrl: string | null;
  photo2Url?: string | null;
  photo3Url?: string | null;
  photo4Url?: string | null;
  photo5Url?: string | null;
  photo6Url?: string | null;
  photo7Url?: string | null;
  photo8Url?: string | null;
  photo9Url?: string | null;
  photo10Url?: string | null;
  proof1Url: string | null;
  proof2Url: string | null;
  proof3Url: string | null;
  proof4Url?: string | null;
  proof5Url?: string | null;
  proof6Url?: string | null;
  proof7Url?: string | null;
  proof8Url?: string | null;
  proof9Url?: string | null;
  proof10Url?: string | null;
}

export interface TenantWithOccupancy extends Tenant {
  occupancyId?: number;
  roomNumber?: string;
  roomId?: number;
  roomIds?: number[];
  checkInDate?: string;
  checkOutDate?: string | null;
  rentFixed?: number;
  isCurrentlyOccupied?: boolean;
  currentPendingPayment?: number;
  currentRentReceived?: number;
  lastPaymentDate?: string;
  azurePhotoUrl?: string | null;
}

export default function TenantManagement() {
  const [filteredTenants, setFilteredTenants] = useState<TenantWithOccupancy[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchField, setSearchField] = useState<SearchField>('all');
  const [sortBy, setSortBy] = useState<SortOption>('recently-added');
  const [occupancyFilter, setOccupancyFilter] = useState<'all' | 'occupied' | 'vacant'>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingTenant, setEditingTenant] = useState<TenantWithOccupancy | null>(null);
  const editFormRef = useRef<HTMLDivElement>(null);
  const checkoutFormRef = useRef<HTMLDivElement>(null);
  const checkInFormRef = useRef<HTMLDivElement>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutOccupancy, setCheckoutOccupancy] = useState<any>(null);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [checkInTenant, setCheckInTenant] = useState<TenantWithOccupancy | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [fullScreenTenant, setFullScreenTenant] = useState<TenantWithOccupancy | null>(null);
  const [fullscreenPhotoIndex, setFullscreenPhotoIndex] = useState<number | null>(null);
  const [fullscreenProofIndex, setFullscreenProofIndex] = useState<number | null>(null);
  const [fullscreenMediaTab, setFullscreenMediaTab] = useState<'photos' | 'proofs'>('photos');
  const [selectedRoom, setSelectedRoom] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [allUniqueTenants, setAllUniqueTenants] = useState<TenantWithOccupancy[]>([]); // Store all tenants

  // Scroll to edit form when editing is triggered
  useEffect(() => {
    if (showForm && editingTenant && editFormRef.current) {
      setTimeout(() => {
        editFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
    }
  }, [showForm, editingTenant]);

  // Scroll to checkout form when checkout is triggered
  useEffect(() => {
    if (showCheckout && checkoutOccupancy && checkoutFormRef.current) {
      setTimeout(() => {
        checkoutFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
    }
  }, [showCheckout, checkoutOccupancy]);

  // Scroll to check-in form when check-in is triggered
  useEffect(() => {
    if (showCheckIn && checkInTenant && checkInFormRef.current) {
      setTimeout(() => {
        checkInFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
    }
  }, [showCheckIn, checkInTenant]);

  // Helper function to normalize phone numbers
  const normalizePhone = (phone: string): string => {
    if (!phone) return '';
    return phone.replace(/[\s\-()+.]/g, '').toLowerCase();
  };

  const fetchTenants = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getAllTenantsWithOccupancy();
      // Normalize room numbers by trimming whitespace - ensures consistency
      const normalizedTenants = response.data.map((tenant: TenantWithOccupancy) => ({
        ...tenant,
        roomNumber: tenant.roomNumber ? String(tenant.roomNumber).trim() : tenant.roomNumber,
      }));
      
      // Construct Azure photo URLs for all tenants
      const tenantsWithAzurePhotos = normalizedTenants.map((tenant: TenantWithOccupancy) => {
        if (tenant.photoUrl) {
          const azureUrl = `${tenant.photoUrl}`;
          return {
            ...tenant,
            azurePhotoUrl: azureUrl,
          };
        }
        return tenant;
      });
      
      // Store all tenants (no pagination)
      setAllUniqueTenants(tenantsWithAzurePhotos);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch tenants';
      setError(errorMsg);
      console.error('Error fetching tenants:', errorMsg);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch tenants with occupancy details
  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  // Filter tenants based on search query, occupancy filter, and room filter
  useEffect(() => {
    const filtered = allUniqueTenants.filter((tenant) => {
      // Apply occupancy status filter
      if (occupancyFilter === 'occupied' && !tenant.isCurrentlyOccupied) return false;
      if (occupancyFilter === 'vacant' && tenant.isCurrentlyOccupied) return false;

      // Apply room filter first
      if (selectedRoom) {
        // Normalize room numbers for comparison: remove whitespace, handle numbers
        const tenantRoom = tenant.roomNumber ? String(tenant.roomNumber).trim() : '';
        const selectedRoomValue = String(selectedRoom).trim();
        
        // Try exact match first
        let isMatch = tenantRoom === selectedRoomValue;
        
        // Also try numeric comparison if both are numeric
        if (!isMatch && !isNaN(Number(tenantRoom)) && !isNaN(Number(selectedRoomValue))) {
          isMatch = Number(tenantRoom) === Number(selectedRoomValue);
        }
        
        if (!isMatch) {
          return false;  // Exclude if room doesn't match
        }
      }

      // If no search query, include tenant (already passed room filter if applicable)
      if (!searchQuery.trim()) return true;
      
      // Apply search filters only if search query exists
      const query = searchQuery.trim();
      const lowerQuery = query.toLowerCase();
      const normalizedQuery = normalizePhone(query);
      
      switch (searchField) {
        case 'name':
          return tenant.name.toLowerCase().includes(lowerQuery);
        case 'phone': {
          const tenantPhone = tenant.phone || '';
          const normalizedPhone = normalizePhone(tenantPhone);
          
          if (/^\d+/.test(query)) {
            if (normalizedPhone.includes(normalizedQuery)) return true;
          }
          
          return tenantPhone.toLowerCase().includes(lowerQuery);
        }
        case 'city':
          return tenant.city.toLowerCase().includes(lowerQuery);
        case 'address':
          return tenant.address.toLowerCase().includes(lowerQuery);
        case 'room':
          return (tenant.roomNumber || '').toString().toLowerCase().includes(lowerQuery);
        case 'all':
        default: {
          const tenantPhone = tenant.phone || '';
          const normalizedPhone = normalizePhone(tenantPhone);
          const roomNumber = tenant.roomNumber || '';
          
          return (
            tenant.name.toLowerCase().includes(lowerQuery) ||
            tenantPhone.toLowerCase().includes(lowerQuery) ||
            (/^\d+/.test(query) && normalizedPhone.includes(normalizedQuery)) ||
            tenant.city.toLowerCase().includes(lowerQuery) ||
            tenant.address.toLowerCase().includes(lowerQuery) ||
            roomNumber.toString().toLowerCase().includes(lowerQuery)
          );
        }
      }
    });
    setFilteredTenants(filtered);
  }, [searchQuery, searchField, allUniqueTenants, selectedRoom, occupancyFilter]);

  // Generate available room options
  const roomOptions = useMemo(() => {
    const uniqueRooms = new Set<string>();
    allUniqueTenants.forEach((t) => {
      if (t.roomNumber) {
        // Convert to string and trim to ensure consistent format
        const room = String(t.roomNumber).trim();
        if (room) {  // Also check that it's not an empty string after trimming
          uniqueRooms.add(room);
        }
      }
    });
    
    // Sort rooms numerically if they're all numbers, otherwise alphabetically
    const sortedRooms = Array.from(uniqueRooms).sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      // If both can be parsed as numbers, sort numerically
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      // Otherwise sort alphabetically
      return a.localeCompare(b);
    });

    // Create dropdown options with room, and count tenants in each room
    return sortedRooms.map((room) => {
      const tenantCount = allUniqueTenants.filter(t => {
        const tenantRoom = t.roomNumber ? String(t.roomNumber).trim() : '';
        return tenantRoom === room;
      }).length;
      
      return {
        id: room,
        label: `Room ${room} (${tenantCount})`,
      };
    });
  }, [allUniqueTenants]);

  // Sort filtered tenants
  const sortedAndFilteredTenants = useMemo(() => {
    const sorted = [...filteredTenants];
    
    switch (sortBy) {
      case 'name-asc':
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case 'name-desc':
        return sorted.sort((a, b) => b.name.localeCompare(a.name));
      case 'phone-asc':
        return sorted.sort((a, b) => a.phone.localeCompare(b.phone));
      case 'city-asc':
        return sorted.sort((a, b) => a.city.localeCompare(b.city));
      case 'recently-added':
        return sorted.sort((a, b) => {
          // Primary sort: by checkInDate (most recent first)
          const dateA = a.checkInDate ? new Date(a.checkInDate).getTime() : 0;
          const dateB = b.checkInDate ? new Date(b.checkInDate).getTime() : 0;
          
          if (dateB !== dateA) {
            return dateB - dateA; // Most recent first (descending)
          }
          
          // Fallback: sort by tenant ID (descending) if dates are the same
          return b.id - a.id;
        });
      default:
        // Default: sort by recently-added (descending order by creation)
        return sorted.sort((a, b) => {
          const dateA = a.checkInDate ? new Date(a.checkInDate).getTime() : 0;
          const dateB = b.checkInDate ? new Date(b.checkInDate).getTime() : 0;
          
          if (dateB !== dateA) {
            return dateB - dateA; // Most recent first (descending)
          }
          
          // Fallback: sort by tenant ID (descending) if dates are the same
          return b.id - a.id;
        });
    }
  }, [filteredTenants, sortBy]);

  const handleAddTenant = () => {
    setEditingTenant(null);
    setShowForm(true);
  };

  const handleEditTenant = (tenant: TenantWithOccupancy) => {
    console.log('Editing tenant:', tenant);
    setEditingTenant(tenant);
    setShowForm(true);
  };

  const handleDeleteTenant = async (tenantId: number) => {
    try {
      const tenantToDelete = allUniqueTenants.find(t => t.id === tenantId);
      await apiService.deleteTenant(tenantId);
      setShowDeleteConfirm(null);
      setSuccessMessage(`✓ Tenant "${tenantToDelete?.name}" deleted successfully`);
      await fetchTenants();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete tenant';
      setError(errorMsg);
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingTenant(null);
  };

  const handleFormSubmit = async (
    formData: Omit<TenantWithOccupancy, 'id'>
  ) => {
    try {
      const tenantName = formData.name.trim();
      const hasOccupancy = (
        Boolean(formData.roomId) ||
        (Array.isArray(formData.roomIds) && formData.roomIds.length > 0)
      ) && Boolean(formData.checkInDate);
      
      if (editingTenant) {
        await apiService.updateTenant(editingTenant.id, formData);
        
        // Create contextual update message
        if (hasOccupancy) {
          setSuccessMessage(`✓ Tenant "${tenantName}" updated with room assignment`);
        } else {
          setSuccessMessage(`✓ Tenant "${tenantName}" updated successfully`);
        }
      } else {
        await apiService.createTenant(formData);
        
        // Create contextual creation message
        if (hasOccupancy) {
          setSuccessMessage(`✓ New tenant "${tenantName}" created & assigned to occupancy`);
        } else {
          setSuccessMessage(`✓ New tenant "${tenantName}" created successfully`);
        }
      }
      handleFormClose();
      await fetchTenants();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to save tenant';
      setError(errorMsg);
    }
  };

  const handleViewTenant = (tenant: TenantWithOccupancy) => {
    setFullScreenTenant(tenant);
    setFullscreenPhotoIndex(null);
    setFullscreenProofIndex(null);
    setFullscreenMediaTab('photos');
  };

  const handleCheckoutSuccess = async () => {
    // Refresh tenants list after successful checkout
    try {
      setSuccessMessage('Tenant checked out successfully');
      await fetchTenants();
      handleCheckoutClose();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      console.error('Error refreshing tenants after checkout:', err);
    }
  };

  const handleCheckoutOpen = (occupancy: any) => {
    setCheckoutOccupancy(occupancy);
    setShowCheckout(true);
  };

  const handleCheckoutClose = () => {
    setShowCheckout(false);
    setCheckoutOccupancy(null);
  };

  const handleCheckInOpen = (tenant: TenantWithOccupancy) => {
    setCheckInTenant(tenant);
    setShowCheckIn(true);
  };

  const handleCheckInClose = () => {
    setShowCheckIn(false);
    setCheckInTenant(null);
  };

  const handleCheckInSuccess = async () => {
    // Refresh tenants list after successful check-in
    try {
      setSuccessMessage('Tenant checked in successfully');
      await fetchTenants();
      handleCheckInClose();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      console.error('Error refreshing tenants after check-in:', err);
    }
  };

  const handleCloseFullscreen = () => {
    setFullScreenTenant(null);
    setFullscreenPhotoIndex(null);
    setFullscreenProofIndex(null);
    setFullscreenMediaTab('photos');
  };

  const handleViewPhoto = (photoIndex: number) => {
    setFullscreenPhotoIndex(photoIndex);
    setFullscreenProofIndex(null);
    setFullscreenMediaTab('photos');
  };

  const handleViewProof = (proofIndex: number) => {
    setFullscreenPhotoIndex(null);
    setFullscreenProofIndex(proofIndex);
    setFullscreenMediaTab('proofs');
  };

  const stats = useMemo(() => {
    const uniqueTenantIds = new Set(allUniqueTenants.map((tenant) => tenant.id));
    const occupiedTenantIds = new Set(
      allUniqueTenants
        .filter((tenant) => tenant.isCurrentlyOccupied)
        .map((tenant) => tenant.id)
    );

    return {
      totalTenants: uniqueTenantIds.size,
      occupiedTenants: occupiedTenantIds.size,
      vacantTenants: uniqueTenantIds.size - occupiedTenantIds.size,
    };
  }, [allUniqueTenants]);

  return (
    <div className="tenant-management-container">
      <h2 className="section-heading">Tenant Management</h2>
      {/* Header with Stats and Create Button */}
      <TenantHeader
        totalTenants={stats.totalTenants}
        occupiedTenants={stats.occupiedTenants}
        vacantTenants={stats.vacantTenants}
        onAddTenant={handleAddTenant}
        isFormVisible={showForm}
        occupancyFilter={occupancyFilter}
        onOccupancyFilterChange={setOccupancyFilter}
      />

      {/* Success Message */}
      {successMessage && (
        <div className="success-message">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)}>✕</button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="error-message">
          <span>{error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Add Tenant Form Card */}
      {showForm && !editingTenant && (
        <div className="tenant-form-card">
          <h3>Add New Tenant</h3>
          <TenantForm
            tenant={null}
            onSubmit={handleFormSubmit}
            onCancel={handleFormClose}
            cardMode={true}
          />
        </div>
      )}

      {/* Edit Tenant Form Card */}
      {showForm && editingTenant && (
        <div className="tenant-form-card" ref={editFormRef}>
          <h3>Edit Tenant - {editingTenant.name}</h3>
          <TenantForm
            tenant={editingTenant}
            onSubmit={handleFormSubmit}
            onCancel={handleFormClose}
            cardMode={true}
          />
        </div>
      )}

      {/* Checkout Tenant Form Card */}
      {showCheckout && checkoutOccupancy && (
        <div className="tenant-form-card" ref={checkoutFormRef}>
          <h3>Checkout Tenant - {checkoutOccupancy.tenantName}</h3>
          <CheckoutModal
            occupancyId={checkoutOccupancy.id}
            tenantName={checkoutOccupancy.tenantName}
            roomNumber={checkoutOccupancy.roomNumber}
            checkInDate={checkoutOccupancy.checkInDate}
            onClose={handleCheckoutClose}
            onCheckoutSuccess={handleCheckoutSuccess}
          />
        </div>
      )}

      {/* Check-In Tenant Form Card */}
      {showCheckIn && checkInTenant && (
        <div className="tenant-form-card" ref={checkInFormRef}>
          <h3>Check-In Tenant - {checkInTenant.name}</h3>
          <CheckinModal
            tenantId={checkInTenant.id}
            tenantName={checkInTenant.name}
            onClose={handleCheckInClose}
            onCheckInSuccess={handleCheckInSuccess}
          />
        </div>
      )}

      {/* Filter Toggle Button */}
      <button className="filter-toggle-btn" onClick={() => setShowFilters(!showFilters)}>
        {showFilters ? '▼' : '▶'} {showFilters ? 'Hide' : 'Show'} Filters
      </button>

      {/* Search and Filter Sections */}
      {showFilters && (
        <>
          {/* Search and Filter Section */}
          <TenantSearchFilters
            searchQuery={searchQuery}
            searchField={searchField}
            sortBy={sortBy}
            onSearchQueryChange={setSearchQuery}
            onSearchFieldChange={setSearchField}
            onSortByChange={setSortBy}
            onClearSearch={() => setSearchQuery('')}
          />

          {/* Room Filter Section */}
          <div className="room-filter">
            <SearchableDropdown
              options={roomOptions}
              value={selectedRoom}
              onChange={(option) => {
                setSelectedRoom(option.id as string);
              }}
              placeholder="Filter by Room"
            />
            {selectedRoom && (
              <button
                onClick={() => setSelectedRoom('')}
                className="clear-room-filter"
              >
                Clear Room Filter
              </button>
            )}
          </div>
        </>
      )}

      {/* Loading State */}
      {loading && (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading tenants...</p>
        </div>
      )}

      {/* Tenants Grid */}
      {!loading && sortedAndFilteredTenants.length > 0 && (
        <div className="tenants-grid">
          {sortedAndFilteredTenants.map((tenant) => (
            <TenantCard
              key={`${tenant.id}-${tenant.occupancyId ?? 'vacant'}`}
              tenant={tenant}
              onView={handleViewTenant}
              onEdit={handleEditTenant}
              onCheckout={handleCheckoutOpen}
              onCheckIn={handleCheckInOpen}
              onDeleteClick={setShowDeleteConfirm}
              onDeleteConfirm={handleDeleteTenant}
              showDeleteConfirm={showDeleteConfirm}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && sortedAndFilteredTenants.length === 0 && allUniqueTenants.length > 0 && (
        <div className="empty-state">
          <p>No tenants found matching your search criteria</p>
          <button
            className="btn-secondary"
            onClick={() => {
              setSearchQuery('');
              setSearchField('all');
            }}
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* No Tenants State */}
      {!loading && allUniqueTenants.length === 0 && !error && (
        <div className="empty-state">
          <p>No tenants found. Start by adding a new tenant.</p>
          <button className="btn-primary" onClick={handleAddTenant}>
            + Add First Tenant
          </button>
        </div>
      )}

      {/* Full Screen Tenant View */}
      {fullScreenTenant && (
        <>
          {/* Main Tenant View */}
          <TenantFullScreenView
            tenant={fullScreenTenant}
            onClose={handleCloseFullscreen}
            onViewPhoto={handleViewPhoto}
            onViewProof={handleViewProof}
          />

          {/* Photo Gallery Modal (overlays on top) */}
          {(fullscreenPhotoIndex !== null || fullscreenProofIndex !== null) && (
            <TenantPhotoGalleryModal
              tenant={fullScreenTenant}
              onClose={handleCloseFullscreen}
              initialPhotoIndex={fullscreenPhotoIndex}
              initialProofIndex={fullscreenProofIndex}
              initialTab={fullscreenMediaTab}
            />
          )}
        </>
      )}

      {/* Edit Tenant Form Card */}
      {showForm && editingTenant && (
        <div className="tenant-form-card">
          <h3>Edit Tenant - {editingTenant.name}</h3>
          <TenantForm
            tenant={editingTenant}
            onSubmit={handleFormSubmit}
            onCancel={handleFormClose}
            cardMode={true}
          />
        </div>
      )}
    </div>
  );
}
