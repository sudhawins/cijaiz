import { useState, useEffect } from 'react';
import { apiService } from '../api';
import SearchableDropdown from './SearchableDropdown';
import './ManagementStyles.css';

interface LastPayment {
  id: number;
  billAmount: number;
  billDate: string;
  billedUnits?: number;
  createdDate: string;
}

interface ServiceAllocation {
  id: number;
  serviceId: number;
  roomId: number;
  service?: {
    id: number;
    consumerNo: string;
    meterNo: number;
    load: string;
    serviceCategory: string;
    consumerName: string;
  };
  room?: {
    id: number;
    number: string;
    rent: number;
    beds: number;
  };
  lastPayment?: LastPayment | null;
}

interface Service {
  id: number;
  consumerNo: string;
  meterNo: number;
  load: string;
  serviceCategory: string;
  consumerName: string;
}

interface Room {
  id: number;
  number: string;
  rent: number;
  beds: number;
}

export default function ServiceAllocationManagement() {
  const [allocations, setAllocations] = useState<ServiceAllocation[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingAllocation, setEditingAllocation] = useState<ServiceAllocation | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterRoom, setFilterRoom] = useState<string>('');
  const [sortBy, setSortBy] = useState<'service' | 'room' | 'category'>('service');

  const [formData, setFormData] = useState({
    serviceId: 0,
    roomId: 0
  });

  // Fetch data
  const fetchAllocations = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getServiceAllocationsWithPayments();
      setAllocations(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch allocations');
    } finally {
      setLoading(false);
    }
  };

  const fetchServices = async () => {
    try {
      const response = await apiService.getServiceDetails();
      setServices(response.data);
    } catch (err) {
      console.error('Failed to fetch services:', err);
    }
  };

  const fetchRooms = async () => {
    try {
      const response = await apiService.getRooms();
      setRooms(response.data);
    } catch (err) {
      console.error('Failed to fetch rooms:', err);
    }
  };

  useEffect(() => {
    fetchAllocations();
    fetchServices();
    fetchRooms();
  }, []);

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);

      const dataToSubmit = {
        serviceId: parseInt(formData.serviceId.toString()),
        roomId: parseInt(formData.roomId.toString())
      };

      if (editingAllocation) {
        await apiService.updateServiceAllocation(editingAllocation.id, dataToSubmit);
        setSuccessMessage('Service allocation updated successfully!');
      } else {
        await apiService.createServiceAllocation(dataToSubmit);
        setSuccessMessage('Service allocation created successfully!');
      }

      setShowForm(false);
      setEditingAllocation(null);
      setFormData({ serviceId: 0, roomId: 0 });
      fetchAllocations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save allocation');
    } finally {
      setLoading(false);
    }
  };

  // Delete allocation
  const handleDelete = async (id: number) => {
    try {
      setLoading(true);
      await apiService.deleteServiceAllocation(id);
      setSuccessMessage('Service allocation deleted successfully!');
      setShowDeleteConfirm(null);
      fetchAllocations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete allocation');
    } finally {
      setLoading(false);
    }
  };

  // Edit allocation
  const handleEdit = (allocation: ServiceAllocation) => {
    setEditingAllocation(allocation);
    setFormData({
      serviceId: allocation.serviceId,
      roomId: allocation.roomId
    });
    setShowForm(true);
  };

  // Get unique categories and rooms for filter dropdowns
  const uniqueCategories = Array.from(new Set(services.map(s => s.serviceCategory))).sort();
  const uniqueRooms = (Array.from(new Set(allocations.map(a => a.room?.number))).filter(Boolean) as (string | number)[]).sort();

  const filteredAllocations = allocations.filter(a => {
    // Search filter
    const searchMatch = !searchQuery ||
      a.service?.consumerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.service?.serviceCategory.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.room?.number.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Category filter
    const categoryMatch = !filterCategory || a.service?.serviceCategory === filterCategory;
    
    // Room filter
    const roomMatch = !filterRoom || a.room?.number === filterRoom;
    
    return searchMatch && categoryMatch && roomMatch;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'service':
        return (a.service?.consumerName || '').localeCompare(b.service?.consumerName || '');
      case 'room':
        return (a.room?.number || '').localeCompare(b.room?.number || '');
      case 'category':
        return (a.service?.serviceCategory || '').localeCompare(b.service?.serviceCategory || '');
      default:
        return 0;
    }
  });

  // Group allocations by consumer number
  const groupedByConsumer = filteredAllocations.reduce((groups: { [key: string]: { allocations: typeof filteredAllocations; consumerName?: string; serviceCategory?: string; load?: string; lastPayment?: LastPayment | null } }, allocation) => {
    const consumerNo = allocation.service?.consumerNo || 'Unassigned';
    if (!groups[consumerNo]) {
      groups[consumerNo] = {
        allocations: [],
        consumerName: allocation.service?.consumerName,
        serviceCategory: allocation.service?.serviceCategory,
        load: allocation.service?.load,
        lastPayment: allocation.lastPayment || null
      };
    }
    groups[consumerNo].allocations.push(allocation);
    return groups;
  }, {});

  const sortedConsumers = Object.keys(groupedByConsumer).sort();

  return (
    <div className="management-container">
      <h2 className="section-heading">Service Allocation</h2>
      {error && <div className="error-message">{error}</div>}
      {successMessage && <div className="success-message">{successMessage}</div>}

      <div className="toolbar">
        <input
          type="text"
          placeholder="Search allocations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
        <SearchableDropdown
          value={filterCategory || null}
          onChange={(option) => setFilterCategory(option.id.toString())}
          options={[
            { id: '', label: 'All Categories' },
            ...uniqueCategories.map(cat => ({ id: cat, label: cat }))
          ]}
          placeholder="Filter by category..."
        />
        <SearchableDropdown
          value={filterRoom || null}
          onChange={(option) => setFilterRoom(option.id.toString())}
          options={[
            { id: '', label: 'All Rooms' },
            ...uniqueRooms.map(room => ({ id: room, label: `Room ${room}` }))
          ]}
          placeholder="Filter by room..."
        />
        <SearchableDropdown
          value={sortBy}
          onChange={(option) => setSortBy(option.id as any)}
          options={[
            { id: 'service', label: 'Sort by Service' },
            { id: 'room', label: 'Sort by Room' },
            { id: 'category', label: 'Sort by Category' }
          ]}
          placeholder="Sort by..."
        />
        {(filterCategory || filterRoom) && (
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => {
              setFilterCategory('');
              setFilterRoom('');
            }}
            title="Clear all filters"
          >
            Clear Filters
          </button>
        )}
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditingAllocation(null);
            setFormData({ serviceId: 0, roomId: 0 });
            setShowForm(true);
          }}
        >
          + Add Allocation
        </button>
      </div>

      {showForm && (
        <div className="form-container">
          <h3>{editingAllocation ? 'Edit Service Allocation' : 'Add New Service Allocation'}</h3>
          <form onSubmit={handleSubmit}>
            <SearchableDropdown
              value={formData.serviceId || null}
              onChange={(option) => setFormData({ ...formData, serviceId: option.id as number })}
              options={services.map((service) => ({
                id: service.id,
                label: `${service.consumerName} - ${service.serviceCategory} (Meter: ${service.meterNo})`
              }))}
              placeholder="Select Service"
            />
            <SearchableDropdown
              value={formData.roomId || null}
              onChange={(option) => setFormData({ ...formData, roomId: option.id as number })}
              options={rooms.map((room) => ({
                id: room.id,
                label: `Room ${room.number} (Rent: $${room.rent}, Beds: ${room.beds})`
              }))}
              placeholder="Select Room"
            />
            <div className="form-buttons">
              <button type="submit" className="btn btn-success" disabled={loading}>
                {loading ? 'Saving...' : 'Save Allocation'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="filter-info">
        {(filterCategory || filterRoom || searchQuery) && (
          <p>Showing {filteredAllocations.length} of {allocations.length} allocations</p>
        )}
      </div>

      {loading ? (
        <div className="loading-spinner"></div>
      ) : filteredAllocations.length === 0 ? (
        <div className="no-results-message">
          <p>No service allocations found for the selected filters.</p>
        </div>
      ) : (
        <div>
          {sortedConsumers.map((consumerNo) => (
            <div key={consumerNo} className="consumer-section">
              <div className="consumer-header">
                <div>
                  <h3 className="consumer-title">
                    👤 {groupedByConsumer[consumerNo].consumerName || 'Unknown Service'}
                  </h3>
                  <p className="consumer-meta">
                    <span className="consumer-no">Consumer No: {consumerNo}</span>
                    {groupedByConsumer[consumerNo].lastPayment && (
                      <>
                        <span className="consumer-payment-date">
                          Last Payment: {new Date(groupedByConsumer[consumerNo].lastPayment!.billDate).toLocaleDateString()}
                        </span>
                        <span className="consumer-bill-amount">
                          Amount: ₹{parseFloat(groupedByConsumer[consumerNo].lastPayment!.billAmount.toString()).toFixed(2)}
                        </span>
                      </>
                    )}
                    {groupedByConsumer[consumerNo].serviceCategory && (
                      <span className="consumer-category">Category: {groupedByConsumer[consumerNo].serviceCategory}</span>
                    )}
                    {groupedByConsumer[consumerNo].load && (
                      <span className="consumer-load">Load: {groupedByConsumer[consumerNo].load}</span>
                    )}
                  </p>
                </div>
                <span className="consumer-count">({groupedByConsumer[consumerNo].allocations.length})</span>
              </div>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Service</th>
                      <th>Category</th>
                      <th>Room</th>
                      <th>Meter No</th>
                      <th>Billed Units</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedByConsumer[consumerNo].allocations.map((allocation) => (
                      <tr key={allocation.id}>
                        <td>{allocation.service?.consumerName || 'N/A'}</td>
                        <td>{allocation.service?.serviceCategory || 'N/A'}</td>
                        <td>Room {allocation.room?.number || 'N/A'}</td>
                        <td>{allocation.service?.meterNo || 'N/A'}</td>
                        <td>
                          {allocation.lastPayment?.billedUnits ? (
                            <span className="billed-units">
                              {allocation.lastPayment.billedUnits} units
                            </span>
                          ) : (
                            <span className="no-payment">-</span>
                          )}
                        </td>
                        <td className="actions">
                          <button className="btn btn-sm btn-info" onClick={() => handleEdit(allocation)}>
                            Edit
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => setShowDeleteConfirm(allocation.id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {showDeleteConfirm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Confirm Delete</h3>
            <p>Are you sure you want to delete this service allocation?</p>
            <div className="modal-buttons">
              <button
                className="btn btn-danger"
                onClick={() => handleDelete(showDeleteConfirm)}
              >
                Delete
              </button>
              <button className="btn btn-secondary" onClick={() => setShowDeleteConfirm(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
