import { useState, useEffect, useMemo } from 'react';
import { apiService } from '../api';
import SearchableDropdown from './SearchableDropdown';
import './PaymentTracking.css';

interface PaymentRecord {
  occupancyId: number;
  tenantId: number;
  tenantName: string;
  roomNumber: string;
  rentFixed: number;
  rentReceivedOn: string | null;
  rentReceived: number;
  charges: number;
  proRataRent: number;
  rentBalance: number;
  occupancyDays: number;
  month: number;
  year: number;
  checkInDate: string;
  checkOutDate: string | null;
  paymentStatus: 'paid' | 'pending' | 'partial';
}

interface MonthYearOption {
  month: number;
  year: number;
  label: string;
}

// Helper function to safely format dates
const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return 'Invalid date';
  
  try {
    // Extract just the date part if it includes time
    const dateOnly = dateString.split('T')[0];
    
    // Parse YYYY-MM-DD format directly
    const match = dateOnly.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      return 'Invalid date';
    }
    
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    
    // Validate ranges
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return 'Invalid date';
    }
    
    // Format as DD/MM/YYYY using the parsed components
    return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
  } catch (err) {
    return 'Invalid date';
  }
};

// Helper function to get days in month
const getDaysInMonth = (month: number, year: number): number => {
  return new Date(year, month, 0).getDate();
};

// Helper function to format balance tooltip
const getBalanceTooltip = (payment: PaymentRecord): string => {
  const daysInMonth = getDaysInMonth(payment.month, payment.year);
  const occupancyDays = payment.occupancyDays || daysInMonth;
  const monthName = new Date(payment.year, payment.month - 1).toLocaleDateString('en-US', { month: 'long' });
  
  return `Occupancy: ${occupancyDays} of ${daysInMonth} days in ${monthName} ${payment.year}\nPro-rata rent balance`;
};

export default function PaymentTracking() {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'paid' | 'pending' | 'partial' | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<string>('');

  // Generate available month-year options (current month and last 12 months)
  const monthYearOptions = useMemo(() => {
    const options: MonthYearOption[] = [];
    const today = new Date();

    for (let i = 0; i < 13; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const month = date.getMonth() + 1;
      const year = date.getFullYear();
      const monthName = date.toLocaleDateString('en-US', { month: 'long' });
      options.push({
        month,
        year,
        label: `${monthName} ${year}`,
      });
    }
    return options;
  }, []);

  // Generate available room options
  const roomOptions = useMemo(() => {
    const uniqueRooms = new Set<string>();
    payments.forEach((p) => {
      if (p.roomNumber) {
        uniqueRooms.add(p.roomNumber);
      }
    });
    
    // Sort rooms numerically if they're numbers, otherwise alphabetically
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
      label: `Room ${room}`,
    }));
  }, [payments]);

  // Calculate summary statistics based on filtered payments (checkout >= today)
  const summary = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activePayments = payments.filter((p) => {
      // If no checkOutDate, include the record
      if (!p.checkOutDate) return true;
      
      // Parse the checkout date
      const checkoutDate = new Date(p.checkOutDate);
      checkoutDate.setHours(0, 0, 0, 0);
      
      // Include if checkout date is >= today
      return checkoutDate >= today;
    });

    return {
      totalTenants: activePayments.length,
      totalRent: activePayments.reduce((sum, p) => sum + p.rentFixed, 0),
      totalReceived: activePayments.reduce((sum, p) => sum + p.rentReceived + p.charges, 0),
      totalPending: activePayments.reduce((sum, p) => sum + Math.max(0, p.rentBalance), 0),
      paidCount: activePayments.filter((p) => p.paymentStatus === 'paid').length,
      partialCount: activePayments.filter((p) => p.paymentStatus === 'partial').length,
      pendingCount: activePayments.filter((p) => p.paymentStatus === 'pending').length,
    };
  }, [payments]);

  // Filter payments based on selected status and checkout date >= today
  const filteredPayments = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let filtered = payments.filter((p) => {
      // If no checkOutDate, include the record
      if (!p.checkOutDate) return true;
      
      // Parse the checkout date
      const checkoutDate = new Date(p.checkOutDate);
      checkoutDate.setHours(0, 0, 0, 0);
      
      // Include if checkout date is >= today
      return checkoutDate >= today;
    });

    // Apply status filter if selected
    if (selectedStatusFilter) {
      filtered = filtered.filter((p) => p.paymentStatus === selectedStatusFilter);
    }

    // Apply room filter if selected
    if (selectedRoom) {
      filtered = filtered.filter((p) => p.roomNumber === selectedRoom);
    }

    return filtered;
  }, [payments, selectedStatusFilter, selectedRoom]);

  // Fetch payment data for selected month
  useEffect(() => {
    if (!selectedMonth) {
      setPayments([]);
      return;
    }

    const fetchPayments = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiService.getPaymentsByMonth(selectedMonth);
        console.log('Fetched payments:', response.data);
        setPayments(response.data);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to fetch payment data';
        setError(errorMsg);
        setPayments([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPayments();
  }, [selectedMonth]);

  const getStatusBadgeClass = (status: string): string => {
    switch (status) {
      case 'paid':
        return 'badge-paid';
      case 'pending':
        return 'badge-pending';
      case 'partial':
        return 'badge-partial';
      default:
        return 'badge-pending';
    }
  };

  return (
    <div className="payment-tracking-container">
      <h2 className="section-heading">Payment Tracking</h2>
      {/* Month/Year Selection and Room Filter */}
      <div className="month-selector-wrapper">
        <div className="month-selector">
          <SearchableDropdown
            label="Select Month & Year"
            value={selectedMonth}
            onChange={(option) => setSelectedMonth(option.id.toString())}
            options={monthYearOptions.map(opt => ({
              id: `${opt.year}-${String(opt.month).padStart(2, '0')}`,
              label: opt.label
            }))}
            placeholder="Search month and year..."
          />
        </div>
        
        {selectedMonth && roomOptions.length > 0 && (
          <div className="room-filter">
            <SearchableDropdown
              label="Filter by Room"
              value={selectedRoom}
              onChange={(option) => setSelectedRoom(option.id.toString())}
              options={roomOptions}
              placeholder="Search room..."
            />
            {selectedRoom && (
              <button 
                className="clear-room-filter"
                onClick={() => setSelectedRoom('')}
                title="Clear room filter"
              >
                ✕ Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* Summary Cards */}
      {selectedMonth && (
        <div className="summary-cards">
          <div className="summary-card">
            <div className="summary-label">Total Tenants</div>
            <div className="summary-value">{summary.totalTenants}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Total Rent Due</div>
            <div className="summary-value">₹{summary.totalRent.toLocaleString()}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Total Received</div>
            <div className="summary-value success">
              ₹{summary.totalReceived.toLocaleString()}
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Total Pending</div>
            <div className="summary-value pending">
              ₹{summary.totalPending.toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* Status Summary */}
      {selectedMonth && (
        <div className="status-summary">
          <div 
            className={`status-badge paid ${selectedStatusFilter === 'paid' ? 'active' : ''}`}
            onClick={() => setSelectedStatusFilter(selectedStatusFilter === 'paid' ? null : 'paid')}
            role="button"
            tabIndex={0}
          >
            <span className="status-label">Paid</span>
            <span className="status-count">{summary.paidCount}</span>
          </div>
          <div 
            className={`status-badge partial ${selectedStatusFilter === 'partial' ? 'active' : ''}`}
            onClick={() => setSelectedStatusFilter(selectedStatusFilter === 'partial' ? null : 'partial')}
            role="button"
            tabIndex={0}
          >
            <span className="status-label">Partial</span>
            <span className="status-count">{summary.partialCount}</span>
          </div>
          <div 
            className={`status-badge pending ${selectedStatusFilter === 'pending' ? 'active' : ''}`}
            onClick={() => setSelectedStatusFilter(selectedStatusFilter === 'pending' ? null : 'pending')}
            role="button"
            tabIndex={0}
          >
            <span className="status-label">Pending</span>
            <span className="status-count">{summary.pendingCount}</span>
          </div>
        </div>
      )}

      {/* Loading/Error States */}
      {loading && (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading payment records...</p>
        </div>
      )}

      {error && (
        <div className="error-state">
          <p>Error: {error}</p>
        </div>
      )}

      {/* Payment Table */}
      {selectedMonth && !loading && filteredPayments.length > 0 && (
        <div className="payment-table-wrapper">
          <table className="payment-table">
            <thead>
              <tr>
                <th>Tenant Name</th>
                <th>Room Number</th>
                <th>Rent Fixed</th>
                <th>Charges</th>
                <th>Rent Received</th>
                <th>Total Receivable</th>
                <th>Balance</th>
                <th>Payment Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map((payment) => (
                <tr 
                  key={`${payment.occupancyId}-${payment.month}-${payment.year}`}
                  className="payment-row"
                >
                  <td 
                    className="tenant-name"
                    data-label="Tenant"
                    title={`Check-in: ${formatDate(payment.checkInDate)}\nCheck-out: ${payment.checkOutDate ? formatDate(payment.checkOutDate) : 'Active'}`}
                  >
                    {payment.tenantName}
                  </td>
                  <td data-label="Room">
                    {payment.roomNumber}
                  </td>
                  <td className="amount" data-label="Rent Fixed">
                    ₹{payment.rentFixed.toLocaleString()}
                  </td>
                  <td className="amount" data-label="Charges">
                    {payment.charges > 0 ? `₹${payment.charges.toLocaleString()}` : '-'}
                  </td>
                  <td className="amount success" data-label="Rent Received">
                    ₹{payment.rentReceived.toLocaleString()}
                  </td>
                  <td className="amount maroon" data-label="Total Receivable">
                    ₹{(payment.proRataRent + payment.charges).toLocaleString()}
                  </td>
                  <td
                    className={`amount ${
                      payment.rentBalance > 0 ? 'pending' : 'success'
                    }`}
                    data-label="Balance"
                    title={getBalanceTooltip(payment)}
                  >
                    ₹{payment.rentBalance.toLocaleString()}
                  </td>
                  <td data-label="Payment Date">
                    {payment.rentReceivedOn
                      ? formatDate(payment.rentReceivedOn)
                      : '-'}
                  </td>
                  <td data-label="Status">
                    <span
                      className={`badge ${getStatusBadgeClass(
                        payment.paymentStatus
                      )}`}
                    >
                      {payment.paymentStatus.charAt(0).toUpperCase() +
                        payment.paymentStatus.slice(1)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty State */}
      {/* Empty State - No Records for Month */}
      {selectedMonth && !loading && payments.length === 0 && !error && (
        <div className="empty-state">
          <p>No payment records found for the selected month</p>
        </div>
      )}

      {/* Empty State - Filter Applied but No Matches */}
      {selectedMonth && !loading && payments.length > 0 && filteredPayments.length === 0 && !error && (
        <div className="empty-state">
          <p>No {selectedStatusFilter} payment records found</p>
          <button 
            className="btn btn-secondary"
            onClick={() => setSelectedStatusFilter(null)}
          >
            Clear Filter
          </button>
        </div>
      )}
    </div>
  );
}
