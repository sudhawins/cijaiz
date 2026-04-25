import { useState, useEffect } from 'react';
import { apiService } from '../api';
import { calculateCheckInProRataRent, ProRataRentCalculation } from '../utils/proRataCalculations';
import './CheckinModal.css';
import './ManagementStyles.css';

interface CheckinModalProps {
  tenantId: number;
  tenantName: string;
  onClose: () => void;
  onCheckInSuccess: (updatedOccupancy: any) => void;
}

interface VacantRoom {
  id: number;
  number: string;
  rent: number;
  beds: number;
  daysVacant?: number | null;
  vacancyStatus?: string;
  lastCheckOutDate?: string | null;
  lastTenantName?: string | null;
}

export default function CheckinModal({
  tenantId,
  tenantName,
  onClose,
  onCheckInSuccess
}: CheckinModalProps) {
  const [roomId, setRoomId] = useState<string>('');
  const [checkInDate, setCheckInDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [checkOutDate, setCheckOutDate] = useState<string>('');
  const [rentFixed, setRentFixed] = useState<string>('');
  const [depositReceived, setDepositReceived] = useState<string>('');
  const [vacantRooms, setVacantRooms] = useState<VacantRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [proRataCalculation, setProRataCalculation] = useState<ProRataRentCalculation | null>(null);

  // Fetch vacant rooms on mount
  useEffect(() => {
    const fetchVacantRooms = async () => {
      try {
        setIsLoadingRooms(true);
        const response = await apiService.getVacantRooms();
        setVacantRooms(response.data || []);
      } catch (err) {
        console.error('Error fetching vacant rooms:', err);
        setError('Failed to load vacant rooms');
      } finally {
        setIsLoadingRooms(false);
      }
    };
    
    fetchVacantRooms();
  }, []);

  // Auto-set checkout date to 3 months from check-in date
  useEffect(() => {
    if (checkInDate) {
      const checkIn = new Date(checkInDate);
      const checkOut = new Date(checkIn);
      checkOut.setMonth(checkOut.getMonth() + 3);
      setCheckOutDate(checkOut.toISOString().split('T')[0]);
    }
  }, [checkInDate]);

  // Calculate pro-rata rent when check-in date or rent amount changes
  useEffect(() => {
    if (checkInDate && rentFixed && parseFloat(rentFixed) > 0) {
      const calculation = calculateCheckInProRataRent(checkInDate, parseFloat(rentFixed));
      setProRataCalculation(calculation);
    } else {
      setProRataCalculation(null);
    }
  }, [checkInDate, rentFixed]);

  // Format date for display
  const formatDate = (dateStr: string): string => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Get today's date
  const getTodayDate = (): string => {
    return new Date().toISOString().split('T')[0];
  };

  // Get minimum checkout date (day after check-in)
  const getMinCheckOutDate = (): string => {
    const minDate = new Date(checkInDate);
    minDate.setDate(minDate.getDate() + 1);
    return minDate.toISOString().split('T')[0];
  };

  // Format vacancy age for display
  const formatVacancyAge = (daysVacant: number | null | undefined): string => {
    if (daysVacant === null || daysVacant === undefined) {
      return 'Never Occupied';
    }
    if (daysVacant === 0) {
      return 'Just Vacated';
    }
    if (daysVacant === 1) {
      return 'Vacant 1 day';
    }
    if (daysVacant < 7) {
      return `Vacant ${daysVacant} days`;
    }
    if (daysVacant < 30) {
      const weeks = Math.floor(daysVacant / 7);
      const days = daysVacant % 7;
      if (days === 0) {
        return `Vacant ${weeks} week${weeks > 1 ? 's' : ''}`;
      }
      return `Vacant ${weeks}w ${days}d`;
    }
    const months = Math.floor(daysVacant / 30);
    const days = daysVacant % 30;
    if (days === 0) {
      return `Vacant ${months} month${months > 1 ? 's' : ''}`;
    }
    return `Vacant ${months}m ${days}d`;
  };

  const handleCheckIn = async () => {
    if (!roomId) {
      setError('Please select a room');
      return;
    }
    if (!checkInDate) {
      setError('Please select a check-in date');
      return;
    }
    if (!checkOutDate) {
      setError('Please select a check-out date');
      return;
    }
    if (!rentFixed || parseFloat(rentFixed) <= 0) {
      setError('Please enter a valid rent amount');
      return;
    }
    if (depositReceived && parseFloat(depositReceived) < 0) {
      setError('Deposit amount cannot be negative');
      return;
    }
    if (new Date(checkOutDate) <= new Date(checkInDate)) {
      setError('Checkout date must be after check-in date');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiService.checkInTenant(
        tenantId, 
        parseInt(roomId), 
        checkInDate,
        checkOutDate,
        parseFloat(rentFixed),
        depositReceived ? parseFloat(depositReceived) : 0
      );
      onCheckInSuccess(response.data.occupancy);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check in tenant');
      setLoading(false);
    }
  };

  const handleClose = () => {
    setRoomId('');
    setCheckInDate(new Date().toISOString().split('T')[0]);
    setCheckOutDate('');
    setRentFixed('');
    setDepositReceived('');
    setError(null);
    setLoading(false);
    onClose();
  };

  const selectedRoom = vacantRooms.find(r => r.id === parseInt(roomId));

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleCheckIn(); }} className="tenant-form">
      {error && (
        <div className="form-error">
          <span>❌</span>
          {error}
        </div>
      )}

      {/* Tenant Information */}
      <div className="form-section">
        <h3>Tenant Information</h3>

        <div className="form-group">
          <label>Tenant Name</label>
          <input
            type="text"
            value={tenantName}
            disabled
            className="form-input-disabled"
          />
        </div>
      </div>

      {/* Check-In Details */}
      <div className="form-section">
        <h3>Check-In Details</h3>

        <div className="form-group">
          <label htmlFor="room-select">Select Room *</label>
          {isLoadingRooms ? (
            <div className="loading-spinner" style={{ marginTop: '0.5rem' }}>Loading rooms...</div>
          ) : vacantRooms.length === 0 ? (
            <div className="form-error">No vacant rooms available</div>
          ) : (
            <select
              id="room-select"
              value={roomId}
              onChange={(e) => {
                setRoomId(e.target.value);
                const room = vacantRooms.find(r => r.id === parseInt(e.target.value));
                if (room) {
                  setRentFixed(String(room.rent));
                } else {
                  setRentFixed('');
                }
                setError(null);
              }}
              disabled={loading}
              required
              className="form-select"
            >
              <option value="">-- Select a vacant room --</option>
              {vacantRooms.map(room => (
                <option key={room.id} value={room.id}>
                  Room {room.number} (₹{room.rent}/mo, {room.beds} bed{room.beds > 1 ? 's' : ''}) - {formatVacancyAge(room.daysVacant)}
                </option>
              ))}
            </select>
          )}
        </div>

        {roomId && (
          <div className="room-details-section" style={{
            backgroundColor: '#f5f5f5',
            padding: '1rem',
            borderRadius: '6px',
            marginBottom: '1rem',
            border: '1px solid #ddd'
          }}>
            {(() => {
              const selectedRoom = vacantRooms.find(r => r.id === parseInt(roomId));
              if (!selectedRoom) return null;
              
              return (
                <div>
                  <h4 style={{ margin: '0 0 0.75rem 0', color: '#333' }}>Room Details</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.9rem' }}>
                    <div><strong>Rent:</strong> ₹{selectedRoom.rent}/month</div>
                    <div><strong>Beds:</strong> {selectedRoom.beds}</div>
                    <div><strong>Vacancy Status:</strong> {selectedRoom.vacancyStatus || 'N/A'}</div>
                    <div><strong>Days Vacant:</strong> {selectedRoom.daysVacant !== null && selectedRoom.daysVacant !== undefined ? selectedRoom.daysVacant : 'N/A'}</div>
                    {selectedRoom.lastTenantName && (
                      <div><strong>Last Tenant:</strong> {selectedRoom.lastTenantName}</div>
                    )}
                    {selectedRoom.lastCheckOutDate && (
                      <div><strong>Last Checkout:</strong> {formatDate(selectedRoom.lastCheckOutDate)}</div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        <div className="form-group">
          <label htmlFor="checkin-date">Check-In Date *</label>
          <input
            id="checkin-date"
            type="date"
            value={checkInDate}
            onChange={(e) => {
              setCheckInDate(e.target.value);
              setError(null);
            }}
            max={getTodayDate()}
            disabled={loading}
            required
          />
          <p className="field-hint">
            Select a date up to today ({formatDate(getTodayDate())})
          </p>
        </div>

        <div className="form-group">
          <label htmlFor="checkout-date">Expected Check-Out Date *</label>
          <input
            id="checkout-date"
            type="date"
            value={checkOutDate}
            onChange={(e) => {
              setCheckOutDate(e.target.value);
              setError(null);
            }}
            min={checkInDate ? getMinCheckOutDate() : ''}
            disabled={loading || !checkInDate}
            required
          />
          <p className="field-hint">
            {checkInDate ? `Select a date after ${formatDate(checkInDate)}` : 'Select a check-in date first'}
          </p>
        </div>

        {roomId && selectedRoom && (
          <div className="form-group">
            <label>Room Details</label>
            <div className="room-details-display">
              <p><strong>Room Number:</strong> {selectedRoom.number}</p>
              <p><strong>Monthly Rent:</strong> ₹{selectedRoom.rent}</p>
              <p><strong>Beds:</strong> {selectedRoom.beds}</p>
            </div>
          </div>
        )}

        <div className="form-group">
          <label htmlFor="rent-fixed">Fixed Rent Amount *</label>
          <input
            id="rent-fixed"
            type="number"
            value={rentFixed}
            onChange={(e) => {
              setRentFixed(e.target.value);
              setError(null);
            }}
            min="0"
            step="0.01"
            disabled={loading}
            required
            placeholder="Auto-populated from room selection"
          />
          <p className="field-hint">
            Monthly rent amount to be fixed for this occupancy
          </p>
        </div>

        <div className="form-group">
          <label htmlFor="deposit-received">Deposit Received (Optional)</label>
          <input
            id="deposit-received"
            type="number"
            value={depositReceived}
            onChange={(e) => {
              setDepositReceived(e.target.value);
              setError(null);
            }}
            min="0"
            step="0.01"
            disabled={loading}
            placeholder="Security deposit amount"
          />
          <p className="field-hint">
            Security deposit or advance amount received from tenant
          </p>
        </div>
      </div>

      {/* Pro-Rata Rent Calculation Display */}
      {proRataCalculation && (
        <div className="form-section pro-rata-calculation">
          <h3>Pro-Rata Rent Calculation</h3>
          <div className="calculation-details">
            <div className="calculation-row">
              <span className="label">Check-In Date:</span>
              <span className="value">{formatDate(checkInDate)}</span>
            </div>
            <div className="calculation-row">
              <span className="label">Days in Month:</span>
              <span className="value">{proRataCalculation.totalDaysInMonth}</span>
            </div>
            <div className="calculation-row">
              <span className="label">Occupancy Days:</span>
              <span className="value highlight">{proRataCalculation.occupancyDays} days</span>
            </div>
            <div className="calculation-row">
              <span className="label">Full Month Rent:</span>
              <span className="value">₹{proRataCalculation.fullMonthRent.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
            </div>
            <div className="calculation-row pro-rata-result">
              <span className="label"><strong>Pro-Rata Rent:</strong></span>
              <span className="value highlight-large">
                <strong>₹{proRataCalculation.calculatedRent.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong>
              </span>
            </div>
            <div className="calculation-row">
              <span className="label">Percentage:</span>
              <span className="value">{proRataCalculation.proRataPercentage}%</span>
            </div>
          </div>
          <p className="calculation-note">
            Rent is calculated pro-rata from {formatDate(checkInDate)} to end of the month
          </p>
        </div>
      )}

      {/* Form Actions */}
      <div className="form-actions">
        <button
          type="button"
          className="btn-secondary"
          onClick={handleClose}
          disabled={loading}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="btn-primary"
          disabled={!roomId || !checkInDate || !checkOutDate || !rentFixed || loading || isLoadingRooms}
        >
          {loading ? 'Processing...' : 'Confirm Check-In'}
        </button>
      </div>
    </form>
  );
}
