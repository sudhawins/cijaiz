import { useState, useEffect } from 'react';
import { apiService } from '../api';
import { calculateCheckOutProRataRent, ProRataRentCalculation } from '../utils/proRataCalculations';
import './CheckoutModal.css';
import './ManagementStyles.css';

interface CheckoutModalProps {
  occupancyId: number;
  tenantName: string;
  roomNumber: string;
  checkInDate: string;
  onClose: () => void;
  onCheckoutSuccess: (updatedOccupancy: any) => void;
}

export default function CheckoutModal({
  occupancyId,
  tenantName,
  roomNumber,
  checkInDate,
  onClose,
  onCheckoutSuccess
}: CheckoutModalProps) {
  const [checkoutDate, setCheckoutDate] = useState<string>('');
  const [depositRefunded, setDepositRefunded] = useState<string>('');
  const [charges, setCharges] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [occupancyData, setOccupancyData] = useState<any>(null);
  const [proRataCalculation, setProRataCalculation] = useState<ProRataRentCalculation | null>(null);

  // Fetch occupancy details on mount
  useEffect(() => {
    const fetchOccupancyData = async () => {
      try {
        const response = await apiService.getRentalSummaryByOccupancy(occupancyId);
        setOccupancyData(response.data);
      } catch (err) {
        console.error('Error fetching occupancy data:', err);
        setError('Failed to load occupancy details');
      }
    };
    fetchOccupancyData();
  }, [occupancyId]);

  // Auto-calculate deposit refunded when charges change
  useEffect(() => {
    if (occupancyData) {
      const depositRcvd = occupancyData.depositReceived || 0;
      const currentPending = occupancyData.currentMonthPending || 0;
      const chargesAmount = charges ? parseFloat(charges) : 0;
      
      // Formula: depositReceived - currentMonthPending - charges
      const calculated = depositRcvd - currentPending - chargesAmount;
      setDepositRefunded(Math.max(0, calculated).toFixed(2));
    }
  }, [charges, occupancyData]);

  // Calculate pro-rata rent when checkout date changes
  useEffect(() => {
    if (checkoutDate && occupancyData?.roomRent) {
      const calculation = calculateCheckOutProRataRent(checkoutDate, occupancyData.roomRent);
      setProRataCalculation(calculation);
    } else {
      setProRataCalculation(null);
    }
  }, [checkoutDate, occupancyData?.roomRent]);
  const formatDate = (dateStr: string): string => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Calculate stay duration
  const calculateStayDuration = (): string => {
    const checkIn = new Date(checkInDate);
    const checkout = checkoutDate ? new Date(checkoutDate) : new Date();
    const days = Math.floor((checkout.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
    const months = Math.floor(days / 30);
    const remainingDays = days % 30;
    
    if (months === 0) {
      return `${days} day${days !== 1 ? 's' : ''}`;
    } else if (remainingDays === 0) {
      return `${months} month${months !== 1 ? 's' : ''}`;
    } else {
      return `${months} month${months !== 1 ? 's' : ''} ${remainingDays} day${remainingDays !== 1 ? 's' : ''}`;
    }
  };

  // Get minimum date (check-in date + 1 day)
  const getMinDate = (): string => {
    const minDate = new Date(checkInDate);
    minDate.setDate(minDate.getDate() + 1);
    return minDate.toISOString().split('T')[0];
  };

  const handleCheckout = async () => {
    if (!checkoutDate) {
      setError('Please select a checkout date');
      return;
    }
    if (charges && parseFloat(charges) < 0) {
      setError('Charges amount cannot be negative');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiService.checkoutOccupancy(
        occupancyId,
        checkoutDate,
        depositRefunded ? parseFloat(depositRefunded) : 0,
        charges ? parseFloat(charges) : 0
      );
      onCheckoutSuccess(response.data.occupancy);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to checkout occupancy');
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCheckoutDate('');
    setDepositRefunded('');
    setCharges('');
    setError(null);
    setLoading(false);
    onClose();
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleCheckout(); }} className="tenant-form">
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

          <div className="form-group">
            <label>Room Number</label>
            <input
              type="text"
              value={roomNumber}
              disabled
              className="form-input-disabled"
            />
          </div>

          <div className="form-group">
            <label>Check-in Date</label>
            <input
              type="text"
              value={formatDate(checkInDate)}
              disabled
              className="form-input-disabled"
            />
          </div>
        </div>

        {/* Checkout Details */}
        <div className="form-section">
          <h3>Checkout Details</h3>

          <div className="form-group">
            <label htmlFor="checkout-date">
              Checkout Date <span className="required-field">*</span>
            </label>
            <input
              id="checkout-date"
              type="date"
              value={checkoutDate}
              onChange={(e) => {
                setCheckoutDate(e.target.value);
                setError(null);
              }}
              min={getMinDate()}
              disabled={loading}
              required
            />
            <p className="field-hint">
              Select a date from {formatDate(getMinDate())} onwards
            </p>
          </div>

          {checkoutDate && (
            <div className="form-group">
              <label>Total Stay Duration</label>
              <div className="stay-duration-display">
                {calculateStayDuration()}
              </div>
            </div>
          )}

          {/* Pro-Rata Rent Calculation Display */}
          {proRataCalculation && occupancyData?.roomRent && (
            <div className="form-group pro-rata-calculation-checkout">
              <label>Pro-Rata Rent Calculation for Checkout</label>
              <div className="calculation-details-checkout">
                <div className="calculation-row">
                  <span className="label">Checkout Date:</span>
                  <span className="value">{formatDate(checkoutDate)}</span>
                </div>
                <div className="calculation-row">
                  <span className="label">Days in Month:</span>
                  <span className="value">{proRataCalculation.totalDaysInMonth}</span>
                </div>
                <div className="calculation-row">
                  <span className="label">Days Occupied (from month start):</span>
                  <span className="value highlight">{proRataCalculation.occupancyDays} days</span>
                </div>
                <div className="calculation-row">
                  <span className="label">Full Month Rent:</span>
                  <span className="value">₹{proRataCalculation.fullMonthRent.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                </div>
                <div className="calculation-row pro-rata-result">
                  <span className="label"><strong>Pro-Rata Rent (by Checkout):</strong></span>
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
                Rent owed from start of month to {formatDate(checkoutDate)} on pro-rata basis
              </p>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="deposit-refunded">
              Deposit Refunded (Auto-calculated)
            </label>
            <input
              id="deposit-refunded"
              type="number"
              value={depositRefunded}
              disabled
              className="form-input-disabled"
              placeholder="0.00"
            />
            {occupancyData && (
              <p className="field-hint">
                Calculation: ₹{occupancyData.depositReceived?.toFixed(2)} (Deposit) - ₹{occupancyData.currentMonthPending?.toFixed(2)} (Pending Rent) - ₹{charges || '0'} (Charges) = ₹{depositRefunded}
              </p>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="charges">
              Charges (Optional)
            </label>
            <input
              id="charges"
              type="number"
              value={charges}
              onChange={(e) => {
                setCharges(e.target.value);
                setError(null);
              }}
              min="0"
              step="0.01"
              placeholder="0.00"
              disabled={loading}
            />
            {charges && parseFloat(charges) < 0 && (
              <p className="field-error">Charges amount cannot be negative</p>
            )}
          </div>
        </div>

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
            disabled={!checkoutDate || loading}
          >
            {loading ? 'Processing...' : 'Confirm Checkout'}
          </button>
        </div>
      </form>
  );
}
