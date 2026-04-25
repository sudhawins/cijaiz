import { useState, useEffect } from 'react';
import { apiService } from '../api';
import SearchableDropdown from './SearchableDropdown';
import './RentalCollection.css';

interface SummaryData {
  month: string;
  total_occupancies: number;
  total_records: number;
  total_collected: number;
  total_outstanding: number;
}

interface UnpaidTenant {
  month: string;
  outstanding_count: number;
  total_outstanding: number;
}

interface UnpaidDetail {
  OccupancyId: number;
  TenantName: string;
  RoomNumber: string;
  CheckInDate: string;
  CheckOutDate: string | null;
  proRataRent: number;
  pending_amount: number;
  collected_amount: number;
  records_count: number;
  latest_date: string;
}

function getCurrentMonthRange(): { start: string; end: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  return { start: fmt(firstDay), end: fmt(lastDay) };
}

export default function RentalCollection() {
  const [summary, setSummary] = useState<SummaryData[]>([]);
  const [unpaidTenants, setUnpaidTenants] = useState<UnpaidTenant[]>([]);
  const [unpaidDetails, setUnpaidDetails] = useState<UnpaidDetail[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingOccupancyId, setEditingOccupancyId] = useState<number | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editingMonth, setEditingMonth] = useState('');
  const [editingTenantName, setEditingTenantName] = useState('');
  const [editingProRataRent, setEditingProRataRent] = useState(0);
  const defaultRange = getCurrentMonthRange();
  const [startDate, setStartDate] = useState<string>(defaultRange.start);
  const [endDate, setEndDate] = useState<string>(defaultRange.end);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [summaryRes, unpaidRes] = await Promise.all([
        apiService.getRentalSummary(),
        apiService.getUnpaidTenants(),
      ]);
      
      console.log('Summary response:', summaryRes.data);
      console.log('Unpaid response:', unpaidRes.data);
      
      setSummary(summaryRes.data);
      setUnpaidTenants(unpaidRes.data);
      
      if (unpaidRes.data.length > 0) {
        setSelectedMonth(unpaidRes.data[0].month);
        const detailsRes = await apiService.getUnpaidDetails(unpaidRes.data[0].month);
        setUnpaidDetails(detailsRes.data);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch rental data';
      setError(errorMsg);
      console.error('Error fetching rental data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMonthChange = async (month: string) => {
    setSelectedMonth(month);
    try {
      const res = await apiService.getUnpaidDetails(month);
      console.log('Details response:', res.data);
      setUnpaidDetails(res.data);
    } catch (err) {
      console.error('Error fetching details:', err);
    }
  };

  const handleEditClick = (detail: UnpaidDetail, month: string) => {
    setEditingOccupancyId(detail.OccupancyId);
    setEditAmount(detail.collected_amount.toString());
    setEditingMonth(month);
    setEditingTenantName(detail.TenantName);
    setEditingProRataRent(detail.proRataRent);
  };

  const handleCancelEdit = () => {
    setEditingOccupancyId(null);
    setEditAmount('');
    setEditingMonth('');
    setEditingTenantName('');
    setEditingProRataRent(0);
  };

  const handleSaveEdit = async () => {
    if (!editingOccupancyId || !editAmount) {
      alert('Please enter a valid amount');
      return;
    }

    try {
      // Call API to update the payment
      await apiService.updateRentalPayment(editingOccupancyId, {
        collectedAmount: parseFloat(editAmount),
        month: editingMonth
      });

      // Refresh the details
      const res = await apiService.getUnpaidDetails(editingMonth);
      setUnpaidDetails(res.data);
      
      // Refresh summary
      const summaryRes = await apiService.getRentalSummary();
      setSummary(summaryRes.data);

      // Close the edit modal
      handleCancelEdit();
      alert('Payment updated successfully');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update payment';
      alert(errorMsg);
      console.error('Error updating payment:', err);
    }
  };

  if (loading) {
    return (
      <div className="rental-container">
        <div className="loading">Loading rental data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rental-container">
        <div className="error-box">
          <strong>Error:</strong> {error}
        </div>
      </div>
    );
  }

  const startMonth = startDate.substring(0, 7);
  const endMonth = endDate.substring(0, 7);

  const filteredSummary = summary.filter(s => s.month >= startMonth && s.month <= endMonth);
  const filteredUnpaidTenants = unpaidTenants.filter(t => t.month >= startMonth && t.month <= endMonth);

  const totalCollected = filteredSummary.reduce((sum, s) => sum + (s.total_collected as number || 0), 0);
  const totalOutstanding = filteredSummary.reduce((sum, s) => sum + (s.total_outstanding as number || 0), 0);
  const totalProRataCharges = totalCollected + totalOutstanding;
  const totalOccupancies = filteredSummary.reduce((max, s) => Math.max(max, s.total_occupancies || 0), 0);

  return (
    <div className="rental-container">
      <div className="rental-header">
        <h1>Rental Collection Dashboard</h1>
        <p>Monitor rental payments and identify outstanding dues</p>
      </div>

      {/* Date Range Filter */}
      <div className="date-filter-bar">
        <div className="date-filter-group">
          <label htmlFor="startDate">From</label>
          <input
            type="date"
            id="startDate"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="date-filter-group">
          <label htmlFor="endDate">To</label>
          <input
            type="date"
            id="endDate"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <button
          className="reset-filter-btn"
          onClick={() => { const r = getCurrentMonthRange(); setStartDate(r.start); setEndDate(r.end); }}
        >
          Reset to Current Month
        </button>
      </div>

      {/* Summary Cards */}
      <div className="summary-cards">
        <div className="card">
          <div className="card-content">
            <h3>Total Pro-Rata Charges</h3>
            <p className="amount">₹ {totalProRataCharges.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
          </div>
        </div>
        <div className="card">
          <div className="card-content">
            <h3>Total Pro-Rata Rent Received</h3>
            <p className="amount collected">₹ {totalCollected.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
          </div>
        </div>
        <div className="card">
          <div className="card-content">
            <h3>Outstanding Due (Pro-Rata)</h3>
            <p className="amount unpaid">₹ {totalOutstanding.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
          </div>
        </div>
        <div className="card">
          <div className="card-content">
            <h3>Active Properties</h3>
            <p className="amount">{totalOccupancies}</p>
          </div>
        </div>
      </div>

      {/* Monthly Summary */}
      <div className="section">
        <h2>Monthly Summary</h2>
        {filteredSummary.length > 0 ? (
          <div className="table-wrapper">
            <table className="summary-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Properties</th>
                  <th>Total Records</th>
                  <th>Pro-Rata Charges</th>
                  <th>Total Collected</th>
                  <th>Outstanding Due</th>
                </tr>
              </thead>
              <tbody>
                {filteredSummary.map((row, idx) => (
                  <tr key={idx}>
                    <td><strong>{row.month}</strong></td>
                    <td>{row.total_occupancies}</td>
                    <td>{row.total_records}</td>
                    <td>₹ {((row.total_collected as number) + (row.total_outstanding as number)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                    <td className="paid">₹ {(row.total_collected as number).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                    <td className="unpaid">₹ {(row.total_outstanding as number).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="info-box">No rental data available for selected period</div>
        )}
      </div>

      {/* Unpaid Tenants by Month */}
      <div className="section">
        <h2>Unpaid Tenants by Month</h2>
        {filteredUnpaidTenants.length > 0 ? (
          <>
            <div className="month-selector">
              <label>Select Month:</label>
              <SearchableDropdown
                value={selectedMonth}
                onChange={(option) => handleMonthChange(option.id.toString())}
                options={filteredUnpaidTenants.map((tenant) => ({
                  id: tenant.month,
                  label: `${tenant.month} (${tenant.outstanding_count} unpaid)`
                }))}
                placeholder="Select month..."
              />
            </div>

            {unpaidDetails.length > 0 ? (
              <div className="table-wrapper">
                <table className="details-table">
                  <thead>
                    <tr>
                      <th>Tenant Name</th>
                      <th>Room</th>
                      <th>Check-In Date</th>
                      <th>Pro-Rata Rent</th>
                      <th>Collected Amount</th>
                      <th>Outstanding Balance</th>
                      <th>Records</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unpaidDetails.map((detail, idx) => (
                      <tr key={idx}>
                        <td className="tenant-name"><strong>{detail.TenantName}</strong></td>
                        <td className="room-number">{detail.RoomNumber}</td>
                        <td className="check-in-date">
                          {detail.CheckInDate ? new Date(detail.CheckInDate).toLocaleDateString('en-IN') : '—'}
                        </td>
                        <td className="pro-rata">₹ {detail.proRataRent.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                        <td className="paid">₹ {parseFloat(detail.collected_amount.toString()).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                        <td className="amount outstanding">₹ {parseFloat(detail.pending_amount.toString()).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                        <td className="text-center">{detail.records_count}</td>
                        <td className="actions">
                          <button 
                            className="edit-btn"
                            onClick={() => handleEditClick(detail, selectedMonth)}
                            title="Edit payment"
                          >
                            ✏️ Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="info-box">
                No unpaid records for {selectedMonth}
              </div>
            )}
          </>
        ) : (
          <div className="info-box">
            No unpaid rental records found for selected period
          </div>
        )}
      </div>

      {/* Edit Payment Modal */}
      {editingOccupancyId !== null && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Edit Payment - {editingTenantName}</h2>
            <p className="modal-subtitle">Month: {editingMonth}</p>
            
            <div className="pro-rata-info">
              <div className="info-row">
                <span className="label">Pro-Rata Rent:</span>
                <span className="value">₹ {editingProRataRent.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="info-row">
                <span className="label">Already Collected:</span>
                <span className="value">₹ {parseFloat(editAmount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="info-row">
                <span className="label">Remaining Balance:</span>
                <span className="value balance">₹ {Math.max(0, editingProRataRent - parseFloat(editAmount)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
            </div>
            
            <div className="form-group">
              <label htmlFor="editAmount">Collected Amount (₹)</label>
              <input
                type="number"
                id="editAmount"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                placeholder="Enter collected amount"
                min="0"
                step="0.01"
              />
            </div>

            <div className="modal-buttons">
              <button 
                className="save-btn"
                onClick={handleSaveEdit}
              >
                💾 Save
              </button>
              <button 
                className="cancel-btn"
                onClick={handleCancelEdit}
              >
                ✕ Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
