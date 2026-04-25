import { useState, useEffect } from 'react';
import { apiService } from '../api';
import './ManagementStyles.css';
import './TenantElectricityCharges.css';

interface TenantCharge {
  id: number;
  serviceConsumptionId: number;
  tenantId: number;
  tenantName: string;
  tenantPhone: string;
  roomId: number;
  roomNumber: string;
  serviceId: number;
  serviceName: string;
  meterNo: string;
  billingMonth: number;
  billingYear: number;
  totalUnitsForRoom: number;
  proRataUnits: number;
  proRataPercentage: number;
  chargePerUnit: number;
  totalCharge: number;
  checkInDate: string;
  checkOutDate?: string | null;
  occupancyDaysInMonth: number;
  totalDaysInMonth: number;
  status: string;
  createdDate: string;
  updatedDate?: string;
}

interface BillingReport {
  billingMonth: number;
  billingYear: number;
  billingPeriod: string;
  roomsWithCharges: number;
  servicesInvoiced: number;
  tenantsCharged: number;
  totalUnitsConsumed: number;
  avgOccupancyPercentage: number;
  totalChargeAmount: number;
}

interface RoomBilling {
  id: number;
  roomNumber: string;
  serviceId: number;
  serviceName: string;
  meterNo: string;
  totalUnitsConsumed: number;
  numberOfTenants: number;
  totalChargeForRoom: number;
  billingMonth: number;
  billingYear: number;
}

export default function TenantElectricityCharges(): JSX.Element {
  const [charges, setCharges] = useState<TenantCharge[]>([]);
  const [billingReport, setBillingReport] = useState<BillingReport | null>(null);
  const [roomBillings, setRoomBillings] = useState<RoomBilling[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().split('T')[0].slice(0, 7));
  const [viewMode, setViewMode] = useState<'report' | 'rooms' | 'tenants'>('report');
  const [selectedRoom, setSelectedRoom] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [chargePerUnit, setChargePerUnit] = useState(15);
  const [recalculateLoading, setRecalculateLoading] = useState(false);
  const [activeMobileTooltip, setActiveMobileTooltip] = useState<string | null>(null);

  const [year, month] = selectedMonth.split('-').map(Number);

  useEffect(() => {
    fetchBillingData();
  }, [selectedMonth]);

  useEffect(() => {
    setActiveMobileTooltip(null);
  }, [viewMode, selectedMonth, selectedRoom]);

  const fetchBillingData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all data in parallel
      const [chargesRes, reportRes, roomsRes] = await Promise.all([
        apiService.getTenantChargesForMonth(year, month),
        apiService.getMonthlyBillingReport(year, month),
        apiService.getRoomBillingSummary(year, month)
      ]);

      setCharges(chargesRes.data || []);
      setBillingReport(reportRes.data);
      setRoomBillings(roomsRes.data || []);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load billing data';
      setError(errorMsg);
      console.error('Error fetching billing data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculate = async () => {
    if (!window.confirm(`Recalculate all charges for ${month}/${year} at ₹${chargePerUnit}/unit?`)) {
      return;
    }

    try {
      setRecalculateLoading(true);
      await apiService.recalculateMonthlyCharges(year, month, chargePerUnit);
      await fetchBillingData();
      setError(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to recalculate charges';
      setError(errorMsg);
      console.error('Error recalculating:', err);
    } finally {
      setRecalculateLoading(false);
    }
  };

  const filteredCharges = charges.filter(charge =>
    searchTerm === '' ||
    charge.tenantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    charge.roomNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    charge.tenantPhone.includes(searchTerm)
  );

  const filteredChargesByRoom = selectedRoom
    ? filteredCharges.filter(c => c.roomId === selectedRoom)
    : filteredCharges;

  const formatDisplayDate = (dateString?: string | null): string => {
    if (!dateString) {
      return 'N/A';
    }

    const parsedDate = new Date(dateString);
    if (Number.isNaN(parsedDate.getTime())) {
      return dateString;
    }

    return parsedDate.toLocaleDateString('en-GB');
  };

  const isCheckoutInSelectedMonth = (checkOutDate?: string | null): boolean => {
    if (!checkOutDate) {
      return false;
    }

    // Prefer direct YYYY-MM-DD extraction to avoid timezone shifting edge cases.
    const datePart = checkOutDate.includes('T') ? checkOutDate.split('T')[0] : checkOutDate;
    const dateParts = datePart.split('-');

    if (dateParts.length >= 2) {
      const checkOutYear = Number(dateParts[0]);
      const checkOutMonth = Number(dateParts[1]);

      if (!Number.isNaN(checkOutYear) && !Number.isNaN(checkOutMonth)) {
        return checkOutYear === year && checkOutMonth === month;
      }
    }

    const parsedDate = new Date(checkOutDate);
    if (Number.isNaN(parsedDate.getTime())) {
      return false;
    }

    return parsedDate.getFullYear() === year && parsedDate.getMonth() + 1 === month;
  };

  const toggleMobileTooltip = (tooltipKey: string) => {
    setActiveMobileTooltip((current) => (current === tooltipKey ? null : tooltipKey));
  };

  const renderReportView = () => {
    if (!billingReport) {
      return (
        <div className="no-data">
          <div className="no-data-icon">📦</div>
          <p className="no-data-text">No billing data available</p>
        </div>
      );
    }

    return (
      <div className="summary-grid">
        <div className="summary-card revenue">
          <div className="card-label">Billing Period</div>
          <div className="card-value">{billingReport.billingPeriod}</div>
        </div>

        <div className="summary-card revenue">
          <div className="card-label">Total Charges</div>
          <div className="card-value">₹{billingReport.totalChargeAmount?.toFixed(2) || '0.00'}</div>
        </div>

        <div className="summary-card tenants">
          <div className="card-label">Total Units Consumed</div>
          <div className="card-value">{billingReport.totalUnitsConsumed}</div>
        </div>

        <div className="summary-card tenants">
          <div className="card-label">Tenants Charged</div>
          <div className="card-value">{billingReport.tenantsCharged}</div>
        </div>

        <div className="summary-card average">
          <div className="card-label">Rooms Billed</div>
          <div className="card-value">{billingReport.roomsWithCharges}</div>
        </div>

        <div className="summary-card average">
          <div className="card-label">Services</div>
          <div className="card-value">{billingReport.servicesInvoiced}</div>
        </div>

        <div className="summary-card total">
          <div className="card-label">Avg Occupancy</div>
          <div className="card-value">{billingReport.avgOccupancyPercentage?.toFixed(1)}%</div>
        </div>

        <div className="summary-card total">
          <div className="card-label">Rate/Unit</div>
          <div className="card-value">₹{chargePerUnit}</div>
        </div>
      </div>
    );
  };

  const renderRoomBillingsView = () => {
    if (roomBillings.length === 0) {
      return (
        <div className="no-data">
          <div className="no-data-icon">📦</div>
          <p className="no-data-text">No room billings available</p>
        </div>
      );
    }

    return (
      <table className="charges-table">
        <thead>
          <tr>
            <th>Room</th>
            <th>Service Name</th>
            <th>Meter No</th>
            <th>Units Consumed</th>
            <th>Tenants</th>
            <th>Total Charge</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {roomBillings.map(room => {
            const roomTenants = charges.filter(charge => charge.roomId === room.id);
            const uniqueRoomTenants = Array.from(
              new Map(roomTenants.map(charge => [charge.tenantId, charge])).values()
            );
            const hasOccupancy = roomTenants.length > 0;
            const hasCheckoutInSelectedMonth = uniqueRoomTenants.some((charge) =>
              isCheckoutInSelectedMonth(charge.checkOutDate)
            );
            const occupancyTooltip = hasOccupancy
              ? uniqueRoomTenants
                  .map((charge) => `${charge.tenantName} | Check-In: ${formatDisplayDate(charge.checkInDate)} | Check-Out: ${formatDisplayDate(charge.checkOutDate)}`)
                  .join('\n')
              : 'No occupied tenants for this billing month';

            return (
            <tr key={`${room.id}-${room.serviceId}`}>
              <td
                style={{ fontWeight: '600' }}
                className={hasOccupancy ? 'occupied-room-cell' : ''}
                title={occupancyTooltip}
              >
                <span>Room {room.roomNumber}</span>
                {hasOccupancy && <span className="occupied-person-icon" aria-label="Occupied room"> 👤</span>}
                {hasCheckoutInSelectedMonth && (
                  <span
                    className="checkout-month-icon"
                    aria-label="Has checkout in selected month"
                    title="Checkout in selected month"
                  >
                    <svg
                      className="checkout-month-icon-svg"
                      viewBox="0 0 20 20"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                    >
                      <path
                        d="M7.5 5.833h5v5M12.5 5.833l-5 5"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M5.833 3.75h8.334a2.083 2.083 0 0 1 2.083 2.083v8.334a2.083 2.083 0 0 1-2.083 2.083H5.833A2.083 2.083 0 0 1 3.75 14.167V5.833A2.083 2.083 0 0 1 5.833 3.75Z"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                )}
                <span className="mobile-tooltip-wrapper">
                  <button
                    type="button"
                    className="mobile-tooltip-trigger"
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleMobileTooltip(`room-${room.id}-${room.serviceId}`);
                    }}
                    aria-label="Show occupancy details"
                  >
                    i
                  </button>
                  {activeMobileTooltip === `room-${room.id}-${room.serviceId}` && (
                    <span className="mobile-tooltip-bubble" role="tooltip">{occupancyTooltip}</span>
                  )}
                </span>
              </td>
              <td>{room.serviceName}</td>
              <td>{room.meterNo}</td>
              <td style={{ textAlign: 'center' }}>{room.totalUnitsConsumed}</td>
              <td style={{ textAlign: 'center' }}>{room.numberOfTenants}</td>
              <td style={{ fontWeight: '600', textAlign: 'right' }}>₹{room.totalChargeForRoom?.toFixed(2) || '0.00'}</td>
              <td>
                <button
                  onClick={() => {
                    setSelectedRoom(room.id);
                    setViewMode('tenants');
                  }}
                  style={{
                    padding: '4px 8px',
                    fontSize: '12px',
                    background: 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  View Tenants
                </button>
              </td>
            </tr>
          )})}
        </tbody>
      </table>
    );
  };

  const renderTenantsView = () => {
    const displayCharges = selectedRoom ? filteredChargesByRoom : filteredCharges;

    if (displayCharges.length === 0) {
      return (
        <div className="no-data">
          <div className="no-data-icon">📦</div>
          <p className="no-data-text">No tenant charges available</p>
        </div>
      );
    }

    return (
      <>
        {selectedRoom && (
          <button
            onClick={() => {
              setSelectedRoom(null);
              setSearchTerm('');
            }}
            style={{
              marginBottom: '20px',
              padding: '10px 20px',
              background: '#ecf0f1',
              color: '#34495e',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            ← Back to All Rooms
          </button>
        )}

        <div style={{ marginBottom: '24px' }}>
          <input
            type="text"
            placeholder="Search by tenant name, room, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 15px',
              border: '2px solid #ecf0f1',
              borderRadius: '8px',
              fontSize: '14px'
            }}
          />
        </div>

        <table className="charges-table">
          <thead>
            <tr>
              <th>Room</th>
              <th>Tenant Name</th>
              <th>Phone</th>
              <th>Service</th>
              <th>Occupancy</th>
              <th>Pro-Rata %</th>
              <th>Units</th>
              <th>Charge (₹)</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {displayCharges.map(charge => {
              const tenantTooltip = `Check-In: ${formatDisplayDate(charge.checkInDate)} | Check-Out: ${formatDisplayDate(charge.checkOutDate)}`;
              const hasCheckoutInSelectedMonth = isCheckoutInSelectedMonth(charge.checkOutDate);
              const isGuestTenant = charge.occupancyDaysInMonth > 0 && charge.occupancyDaysInMonth < 5;

              return (
              <tr key={charge.id} title={tenantTooltip}>
                <td style={{ fontWeight: '600' }}>
                  <span>Room {charge.roomNumber}</span>
                  {hasCheckoutInSelectedMonth && (
                    <span
                      className="checkout-month-icon"
                      aria-label="Tenant checked out in selected month"
                      title="Tenant checked out in selected month"
                    >
                      <svg
                        className="checkout-month-icon-svg"
                        viewBox="0 0 20 20"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                      >
                        <path
                          d="M7.5 5.833h5v5M12.5 5.833l-5 5"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M5.833 3.75h8.334a2.083 2.083 0 0 1 2.083 2.083v8.334a2.083 2.083 0 0 1-2.083 2.083H5.833A2.083 2.083 0 0 1 3.75 14.167V5.833A2.083 2.083 0 0 1 5.833 3.75Z"
                          stroke="currentColor"
                          strokeWidth="1.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  )}
                </td>
                <td>
                  <span>{charge.tenantName}</span>
                  {isGuestTenant && (
                    <span
                      className="guest-tenant-indicator"
                      aria-label="Guest tenant, stayed less than 5 days"
                      title="Guest stay (less than 5 days)"
                    >
                      <svg
                        className="guest-tenant-icon-svg"
                        viewBox="0 0 20 20"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                      >
                        <path
                          d="M10 10.833a2.917 2.917 0 1 0 0-5.833 2.917 2.917 0 0 0 0 5.833Z"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M4.167 15.417c.5-2.167 2.25-3.334 5.833-3.334 3.583 0 5.333 1.167 5.833 3.334"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  )}
                  <span className="mobile-tooltip-wrapper">
                    <button
                      type="button"
                      className="mobile-tooltip-trigger"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleMobileTooltip(`tenant-${charge.id}`);
                      }}
                      aria-label="Show check-in and check-out"
                    >
                      i
                    </button>
                    {activeMobileTooltip === `tenant-${charge.id}` && (
                      <span className="mobile-tooltip-bubble" role="tooltip">{tenantTooltip}</span>
                    )}
                  </span>
                </td>
                <td><a href={`tel:${charge.tenantPhone}`}>{charge.tenantPhone}</a></td>
                <td>{charge.serviceName}</td>
                <td>{charge.occupancyDaysInMonth}/{charge.totalDaysInMonth} days</td>
                <td style={{ textAlign: 'center' }}>
                  <span className="status-badge calculated">{charge.proRataPercentage.toFixed(1)}%</span>
                </td>
                <td style={{ textAlign: 'center', fontWeight: '600' }}>{charge.proRataUnits.toFixed(2)}</td>
                <td style={{ fontWeight: '600', textAlign: 'right' }}>₹{charge.totalCharge.toFixed(2)}</td>
                <td>
                  <span className={`status-badge status-${charge.status.toLowerCase()}`}>
                    {charge.status}
                  </span>
                </td>
              </tr>
            )})}
          </tbody>
        </table>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '15px',
          marginTop: '20px',
          padding: '20px',
          backgroundColor: '#f9f9f9',
          borderRadius: '8px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: '600', color: '#666' }}>Total Charges:</span>
            <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#2196F3' }}>₹{displayCharges.reduce((sum, c) => sum + c.totalCharge, 0).toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: '600', color: '#666' }}>Total Units:</span>
            <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#2196F3' }}>{displayCharges.reduce((sum, c) => sum + c.proRataUnits, 0).toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: '600', color: '#666' }}>Rooms:</span>
            <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#2196F3' }}>{new Set(displayCharges.map(c => c.roomId)).size}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: '600', color: '#666' }}>Tenants:</span>
            <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#2196F3' }}>{new Set(displayCharges.map(c => c.tenantId)).size}</span>
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="electricity-charges-container">
      <h2 className="section-heading">Electricity Charges</h2>
      {error && <div className="message error">{error}</div>}

      <div className="charges-filters">
        <div className="filter-group">
          <label>Billing Month:</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label>Rate Per Unit (₹):</label>
          <input
            type="number"
            value={chargePerUnit}
            onChange={(e) => setChargePerUnit(parseFloat(e.target.value) || 15)}
            step="0.50"
            min="1"
          />
        </div>

        <div className="filter-group">
          <button
            onClick={handleRecalculate}
            disabled={recalculateLoading}
            style={{
              cursor: recalculateLoading ? 'not-allowed' : 'pointer',
              opacity: recalculateLoading ? 0.6 : 1
            }}
          >
            {recalculateLoading ? '⟳ Recalculating...' : '🔄 Recalculate Charges'}
          </button>
        </div>
      </div>

      <div className="tab-navigation">
        <button
          className={`tab-button ${viewMode === 'report' ? 'active' : ''}`}
          onClick={() => setViewMode('report')}
        >
          📊 Billing Report
        </button>
        <button
          className={`tab-button ${viewMode === 'rooms' ? 'active' : ''}`}
          onClick={() => setViewMode('rooms')}
        >
          🏠 Room Summary
        </button>
        <button
          className={`tab-button ${viewMode === 'tenants' ? 'active' : ''}`}
          onClick={() => setViewMode('tenants')}
        >
          👥 Tenant Charges
        </button>
      </div>

      {loading ? (
        <div className="loading">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading billing data...</p>
        </div>
      ) : (
        <div className="charges-content">
          {viewMode === 'report' && renderReportView()}
          {viewMode === 'rooms' && renderRoomBillingsView()}
          {viewMode === 'tenants' && renderTenantsView()}
        </div>
      )}
    </div>
  );
}
