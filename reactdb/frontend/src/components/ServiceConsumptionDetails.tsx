import { useState, useEffect } from 'react';
import { apiService } from '../api';
import '../components/ManagementStyles.css';

interface ConsumptionDetail {
  id: number;
  serviceAllocId: number;
  roomId: number;
  roomNumber: string;
  consumerNo: string;
  consumerName?: string;
  meterNo?: string;
  serviceId?: number;
  readingTakenDate: string;
  startingMeterReading: number;
  endingMeterReading: number;
  unitsConsumed: number;
  amountToBeCollected: number;
  unitRate: number;
  meterPhoto1Url?: string;
  meterPhoto2Url?: string;
  meterPhoto3Url?: string;
  createdDate: string;
}

interface RoomOption {
  id: number;
  number: string;
}

interface ServiceAllocation {
  id: number;
  roomNumber: string;
  roomId: number;
  consumerNo: string;
  consumerName: string;
  meterNo: string;
  serviceId: number;
  displayName: string;
}

interface BillSummary {
  totalUnits: number;
  totalAmount: number;
  averageUnitRate: number;
  roomCount: number;
}

interface PaymentData {
  consumerNo: string;
  consumerName: string;
  lastPaymentDate: string | null;
  billAmount: number | null;
}

interface CategoryGroup {
  consumerNo: string;
  consumerName: string;
  lastPaymentDate: string | null;
  details: ConsumptionDetail[];
  totalUnits: number;
  totalAmount: number;
}

export default function ServiceConsumptionDetails() {
  const [consumptionDetails, setConsumptionDetails] = useState<ConsumptionDetail[]>([]);
  const [filteredDetails, setFilteredDetails] = useState<ConsumptionDetail[]>([]);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [filteredServiceAllocations, setFilteredServiceAllocations] = useState<ServiceAllocation[]>([]);
  const [paymentDataMap, setPaymentDataMap] = useState<Map<string, PaymentData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Filter states
  const [selectedRoom, setSelectedRoom] = useState<number>(0);
  const [startDate, setStartDate] = useState<string>(getCurrentMonthStart());
  const [endDate, setEndDate] = useState<string>(getCurrentMonthEnd());
  const [showForm, setShowForm] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    serviceAllocId: null as number | null,
    startingMeterReading: 0,
    endingMeterReading: 0,
  });

  // const [previousMonthReading, setPreviousMonthReading] = useState<number | null>(null); // Not used
  const [isAutoFilledStarting, setIsAutoFilledStarting] = useState(false);
  // const [searchTerm, setSearchTerm] = useState(''); // Not used
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreview, setPhotoPreview] = useState<string[]>([]);

  // Helper function to get current month start
  function getCurrentMonthStart(): string {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    return first.toISOString().split('T')[0];
  }

  // Helper function to get current month end
  function getCurrentMonthEnd(): string {
    const now = new Date();
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return last.toISOString().split('T')[0];
  }

  // Fetch consumption details
  useEffect(() => {
    fetchConsumptionDetails();
    fetchRooms();
    fetchServiceAllocations();
  }, []);

  // Filter details
  useEffect(() => {
    let filtered = consumptionDetails;

    if (selectedRoom !== 0) {
      filtered = filtered.filter(d => d.roomId === selectedRoom);
    }

    if (startDate) {
      const start = new Date(startDate).getTime();
      filtered = filtered.filter(d => new Date(d.readingTakenDate).getTime() >= start);
    }

    if (endDate) {
      const end = new Date(endDate).getTime();
      filtered = filtered.filter(d => new Date(d.readingTakenDate).getTime() <= end);
    }

    setFilteredDetails(filtered);
  }, [selectedRoom, startDate, endDate, consumptionDetails]);

  async function fetchConsumptionDetails() {
    try {
      setLoading(true);
      const response = await apiService.getServiceConsumption({
        startDate,
        endDate,
      });
      setConsumptionDetails(response.data);
      setError(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch consumption details';
      setError(errorMsg);
      console.error('Error fetching consumption details:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchRooms() {
    try {
      const response = await apiService.getRooms();
      setRooms(response.data);
    } catch (err) {
      console.error('Error fetching rooms:', err);
    }
  }

  async function fetchServiceAllocations() {
    try {
      const response = await apiService.getServiceAllocationsForReading();
      
      if (!response.data || response.data.length === 0) {
        console.warn('No service allocations found in response');
        setFilteredServiceAllocations([]);
        setError('No rooms/services available for meter reading');
        return;
      }

      // Transform and set the allocations - backend returns nested structure with service and room objects
      const allocations = response.data.map((item: any) => {
        const roomNumber = item.room?.number || 'N/A';
        const consumerNo = item.service?.consumerNo || 'N/A';
        const consumerName = item.service?.consumerName || 'N/A';
        const meterNo = item.service?.meterNo || 'N/A';
        
        return {
          id: item.id,
          roomId: item.roomId,
          roomNumber: roomNumber,
          consumerNo: consumerNo,
          consumerName: consumerName,
          meterNo: meterNo,
          serviceId: item.serviceId,
          displayName: `Room ${roomNumber} - ${consumerName} (${consumerNo})`,
        };
      });
      
      console.log('Fetched service allocations:', allocations);
      
      setFilteredServiceAllocations(allocations);
      setError(null);

      // Build payment data map
      const paymentMap = new Map<string, PaymentData>();
      response.data.forEach((item: any) => {
        const consumerNo = item.service?.consumerNo;
        if (consumerNo && !paymentMap.has(consumerNo)) {
          paymentMap.set(consumerNo, {
            consumerNo: consumerNo,
            consumerName: item.service?.consumerName || 'N/A',
            lastPaymentDate: null,
            billAmount: null,
          });
        }
      });
      setPaymentDataMap(paymentMap);
    } catch (err) {
      console.error('Error fetching service allocations:', err);
      setError('Failed to load rooms/services. Please refresh the page.');
      setFilteredServiceAllocations([]);
    }
  }

  async function fetchPreviousMonthReading(serviceAllocId: number) {
    try {
      const today = new Date();
      const currentMonth = today.getMonth() + 1;
      const currentYear = today.getFullYear();
      
      const response = await apiService.getPreviousMonthEndingReading(
        serviceAllocId,
        currentMonth,
        currentYear
      );
      
      if (response.data && response.data.length > 0) {
        const reading = parseInt(response.data[0].endingMeterReading) || 0;
        // setPreviousMonthReading(reading); // Not used
        setFormData(prev => ({
          ...prev,
          startingMeterReading: reading,
        }));
        setIsAutoFilledStarting(true);
      } else {
        // setPreviousMonthReading(null); // Not used
        setFormData(prev => ({
          ...prev,
          startingMeterReading: 0,
        }));
        setIsAutoFilledStarting(false);
      }
    } catch (err) {
      console.error('Error fetching previous month reading:', err);
      // setPreviousMonthReading(null); // Not used
      setIsAutoFilledStarting(false);
    }
  }

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>, index: number) {
    const file = e.target.files?.[0];
    if (file) {
      const newPhotos = [...photos];
      newPhotos[index] = file;
      setPhotos(newPhotos);

      // Create preview
      const reader = new FileReader();
      reader.onload = () => {
        const newPreview = [...photoPreview];
        newPreview[index] = reader.result as string;
        setPhotoPreview(newPreview);
      };
      reader.readAsDataURL(file);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.serviceAllocId || formData.serviceAllocId === 0) {
      setError('Please select a service');
      return;
    }

    if (formData.endingMeterReading <= formData.startingMeterReading) {
      setError('Ending meter reading must be greater than starting meter reading');
      return;
    }

    try {
      setFormSubmitting(true);
      
      // Create submission data with photo data URLs
      const submitData = {
        serviceAllocId: formData.serviceAllocId,
        startingMeterReading: formData.startingMeterReading,
        endingMeterReading: formData.endingMeterReading,
        readingTakenDate: new Date().toISOString(),
        unitRate: 15,
        isAutoFilledStartingReading: isAutoFilledStarting,
        meterPhoto1: photoPreview[0] || null,
        meterPhoto2: photoPreview[1] || null,
        meterPhoto3: photoPreview[2] || null,
      };

      const response = await apiService.createServiceConsumption(submitData);

      if (response.data) {
        setConsumptionDetails([...consumptionDetails, response.data]);
        setShowForm(false);
        setFormData({ serviceAllocId: null, startingMeterReading: 0, endingMeterReading: 0 });
        setPhotos([]);
        setPhotoPreview([]);
        // setPreviousMonthReading(null); // Not used
        setIsAutoFilledStarting(false);
        setError(null);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to save consumption details';
      setError(errorMsg);
      console.error('Error saving consumption details:', err);
    } finally {
      setFormSubmitting(false);
    }
  }

  // Calculate bill summary for current month
  const billSummary: BillSummary = {
    totalUnits: filteredDetails.reduce((sum, d) => sum + d.unitsConsumed, 0),
    totalAmount: filteredDetails.reduce((sum, d) => sum + d.amountToBeCollected, 0),
    averageUnitRate: filteredDetails.length > 0
      ? filteredDetails.reduce((sum, d) => sum + d.unitRate, 0) / filteredDetails.length
      : 0,
    roomCount: new Set(filteredDetails.map(d => d.roomId)).size,
  };

  // Get categorized data grouped by consumer number
  const getCategorizedData = (): CategoryGroup[] => {
    const groupMap = new Map<string, CategoryGroup>();
    
    filteredDetails.forEach((detail) => {
      const consumerNo = detail.consumerNo;
      if (!groupMap.has(consumerNo)) {
        const paymentInfo = paymentDataMap.get(consumerNo);
        groupMap.set(consumerNo, {
          consumerNo: consumerNo,
          consumerName: detail.consumerName || paymentInfo?.consumerName || 'N/A',
          lastPaymentDate: paymentInfo?.lastPaymentDate || null,
          details: [],
          totalUnits: 0,
          totalAmount: 0,
        });
      }
      
      const group = groupMap.get(consumerNo)!;
      group.details.push(detail);
      group.totalUnits += detail.unitsConsumed;
      group.totalAmount += detail.amountToBeCollected;
    });
    
    return Array.from(groupMap.values()).sort((a, b) => 
      a.consumerNo.localeCompare(b.consumerNo)
    );
  };

  async function handleDeleteConsumption(id: number) {
    if (!window.confirm('Are you sure you want to delete this consumption record?')) {
      return;
    }

    try {
      await apiService.deleteServiceConsumption(id);
      setConsumptionDetails(consumptionDetails.filter(d => d.id !== id));
      setError(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete consumption record';
      setError(errorMsg);
      console.error('Error deleting consumption record:', err);
    }
  }

  if (loading) {
    return <div className="management-section">Loading...</div>;
  }

  return (
    <div className="management-section">
      <h2 className="section-heading">Service Consumption</h2>

      {error && <div className="error-message">{error}</div>}

      {/* Filters */}
      <div className="filter-group">
        <div className="filter-item">
          <label>Room Filter:</label>
          <select
            value={selectedRoom}
            onChange={(e) => setSelectedRoom(parseInt(e.target.value))}
            className="filter-input"
          >
            <option value={0}>All Rooms</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                Room {room.number}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-item">
          <label>From Date:</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="filter-input"
          />
        </div>

        <div className="filter-item">
          <label>To Date:</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="filter-input"
          />
        </div>

        <button
          onClick={() => {
            setStartDate(getCurrentMonthStart());
            setEndDate(getCurrentMonthEnd());
            setSelectedRoom(0);
          }}
          className="reset-btn"
        >
          Reset to Current Month
        </button>

        <button
          onClick={() => {
            setShowForm(!showForm);
            // Clear form data when closing the form
            if (showForm) {
              setFormData({ serviceAllocId: null, startingMeterReading: 0, endingMeterReading: 0 });
              setPhotos([]);
              setPhotoPreview([]);
              setIsAutoFilledStarting(false);
              setError(null);
            }
          }}
          className="add-btn"
        >
          {showForm ? '✕ Cancel' : '+ Add Reading'}
        </button>
      </div>

      {/* Bill Summary */}
      <div className="bill-summary">
        <div className="bill-card">
          <span className="bill-label">Total Units Consumed:</span>
          <span className="bill-value">{billSummary.totalUnits} Units</span>
        </div>
        <div className="bill-card">
          <span className="bill-label">Total Amount Due:</span>
          <span className="bill-value" style={{ color: '#dc3545' }}>₹{billSummary.totalAmount.toFixed(2)}</span>
        </div>
        <div className="bill-card">
          <span className="bill-label">Avg Unit Rate:</span>
          <span className="bill-value">₹{billSummary.averageUnitRate.toFixed(2)}/unit</span>
        </div>
        <div className="bill-card">
          <span className="bill-label">Rooms Included:</span>
          <span className="bill-value">{billSummary.roomCount}</span>
        </div>
      </div>

      {/* Add Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="consumption-form">
          <h3>📝 Add New Reading</h3>

          {filteredServiceAllocations.length === 0 ? (
            <div style={{
              background: '#fef3c7',
              border: '1px solid #fbbf24',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '16px',
              color: '#92400e'
            }}>
              <strong>⚠️ No rooms/services available</strong>
              <p style={{ marginTop: '8px', marginBottom: 0, fontSize: '0.9rem' }}>
                Please ensure that rooms and services have been allocated before adding meter readings.
              </p>
            </div>
          ) : (
            <>
              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Service/Room:</label>
                  <select
                    value={formData.serviceAllocId || ''}
                    onChange={(e) => {
                      const allocId = parseInt(e.target.value) || null;
                      if (allocId) {
                        // Reset form when a new service is selected
                        setFormData({
                          serviceAllocId: allocId,
                          startingMeterReading: 0,
                          endingMeterReading: 0,
                        });
                        setPhotos([]);
                        setPhotoPreview([]);
                        setIsAutoFilledStarting(false);
                        setError(null);
                        // Fetch previous month reading for the selected service
                        fetchPreviousMonthReading(allocId);
                      }
                    }}
                    className="form-input"
                  >
                    <option value="">-- Select a Service/Room --</option>
                    {filteredServiceAllocations.map((alloc) => (
                      <option key={alloc.id} value={alloc.id}>
                        Room {alloc.roomNumber} - {alloc.consumerName} ({alloc.consumerNo})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Display selected room details */}
              {formData.serviceAllocId && (
                <div style={{
                  background: '#f0f9ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  marginBottom: '16px'
                }}>
                  {(() => {
                    const selected = filteredServiceAllocations.find(a => a.id === formData.serviceAllocId);
                    if (!selected) {
                      return (
                        <div style={{ color: '#64748b', fontSize: '0.9rem' }}>
                          Loading room details...
                        </div>
                      );
                    }
                    return (
                      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                        <div>
                          <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Room Number:</span>
                          <div style={{ fontSize: '1rem', color: '#1e293b', fontWeight: '600' }}>Room {selected.roomNumber || 'N/A'}</div>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Consumer:</span>
                          <div style={{ fontSize: '1rem', color: '#1e293b', fontWeight: '600' }}>{selected.consumerName || 'N/A'}</div>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Meter No:</span>
                          <div style={{ fontSize: '1rem', color: '#1e293b', fontWeight: '600' }}>{selected.meterNo || 'N/A'}</div>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Consumer No:</span>
                          <div style={{ fontSize: '1rem', color: '#1e293b', fontWeight: '600' }}>{selected.consumerNo || 'N/A'}</div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label>Starting Meter Reading:</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="number"
                      value={formData.startingMeterReading}
                      onChange={(e) => {
                        setFormData({ ...formData, startingMeterReading: parseInt(e.target.value) || 0 });
                        setIsAutoFilledStarting(false);
                      }}
                      className="form-input"
                    />
                    {isAutoFilledStarting && (
                      <span style={{
                        fontSize: '0.75rem',
                        color: '#28a745',
                        marginTop: '0.25rem',
                        display: 'block'
                      }}>
                        ✓ Auto-filled from previous month
                      </span>
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label>Ending Meter Reading:</label>
                  <input
                    type="number"
                    value={formData.endingMeterReading}
                    onChange={(e) =>
                      setFormData({ ...formData, endingMeterReading: parseInt(e.target.value) || 0 })
                    }
                    className="form-input"
                  />
                </div>
              </div>

              {/* Photo Upload */}
              <div className="photo-upload-section">
                <h4>📸 Upload Meter Photos (Up to 3)</h4>
                <div className="photo-grid">
                  {[0, 1, 2].map((index) => (
                    <div key={index} className="photo-upload-box">
                      <label className="photo-label">Photo {index + 1}</label>
                      {photoPreview[index] && (
                        <img src={photoPreview[index]} alt={`Preview ${index + 1}`} className="photo-preview" />
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handlePhotoUpload(e, index)}
                        className="photo-input"
                        disabled={formSubmitting}
                      />
                      {photos[index] && (
                        <span className="photo-filename">{photos[index].name}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <button type="submit" className="submit-btn" disabled={formSubmitting}>
                {formSubmitting ? '⟳ Saving...' : 'Save Reading & Photos'}
              </button>
            </>
          )}
        </form>
      )}

      {/* Categorized View by Consumer */}
      {getCategorizedData().length > 0 && (
        <div className="categorized-consumption-section">
          <h3>📊 Consumption by Consumer Number</h3>
          <div className="consumer-categories">
            {getCategorizedData().map((group) => (
              <div key={group.consumerNo} className="consumer-category-card">
                <div className="category-header">
                  <div className="consumer-info">
                    <span className="consumer-badge">{group.consumerNo}</span>
                    <div className="consumer-details">
                      <span className="consumer-name">{group.consumerName}</span>
                      {group.lastPaymentDate && (
                        <span className="last-payment">
                          Last Payment: {new Date(group.lastPaymentDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="category-stats">
                    <div className="stat">
                      <span className="stat-label">Units:</span>
                      <span className="stat-value units">{group.totalUnits}</span>
                    </div>
                    <div className="stat">
                      <span className="stat-label">Amount:</span>
                      <span className="stat-value amount">₹{group.totalAmount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                
                <div className="category-records">
                  <table className="category-table">
                    <thead>
                      <tr>
                        <th>Room</th>
                        <th>Date</th>
                        <th>Units</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.details.map((detail) => (
                        <tr key={detail.id}>
                          <td>Room {detail.roomNumber}</td>
                          <td>{new Date(detail.readingTakenDate).toLocaleDateString()}</td>
                          <td className="units-cell">{detail.unitsConsumed}</td>
                          <td className="amount-cell">₹{detail.amountToBeCollected.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Details Table */}
      <div className="table-responsive">
        <table className="management-table">
          <thead>
            <tr>
              <th>Room</th>
              <th>Date</th>
              <th>Starting Reading</th>
              <th>Ending Reading</th>
              <th>Units Used</th>
              <th>Unit Rate</th>
              <th>Amount</th>
              <th>Photos</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredDetails.length === 0 ? (
              <tr>
                <td colSpan={9} className="no-data">
                  No consumption details found for the selected filters
                </td>
              </tr>
            ) : (
              filteredDetails.map((detail) => (
                <tr key={detail.id}>
                  <td className="room-cell">Room {detail.roomNumber}</td>
                  <td>{new Date(detail.readingTakenDate).toLocaleDateString()}</td>
                  <td>{detail.startingMeterReading}</td>
                  <td>{detail.endingMeterReading}</td>
                  <td className="units-cell">{detail.unitsConsumed}</td>
                  <td>₹{detail.unitRate.toFixed(2)}</td>
                  <td className="amount-cell">₹{detail.amountToBeCollected.toFixed(2)}</td>
                  <td>
                    <div className="photo-count">
                      {[detail.meterPhoto1Url, detail.meterPhoto2Url, detail.meterPhoto3Url].filter(Boolean).length}/3
                    </div>
                  </td>
                  <td>
                    <button className="action-btn edit-btn" disabled>Edit</button>
                    <button 
                      className="action-btn delete-btn"
                      onClick={() => handleDeleteConsumption(detail.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
