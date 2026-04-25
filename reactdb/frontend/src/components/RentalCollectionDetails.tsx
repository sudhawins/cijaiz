import { useState, useEffect } from 'react';
import { apiService, getRentalPaymentProofUrl } from '../api';
import { useAuth } from './AuthContext';
import SearchableDropdown from './SearchableDropdown';
import './RentalCollectionDetails.css';

interface OccupancyInfo {
  occupancyId: number;
  tenantId: number;
  tenantName: string;
  roomNumber: string;
  rentFixed: number;
  proRataRent: number;
  totalRentReceived: number;
  totalCharges: number;
  paymentRecordsCount: number;
  lastPaymentDate: string | null;
  checkInDate: string;
  checkOutDate: string | null;
}

interface MonthlyPaymentStatus {
  occupancyId: number;
  tenantId: number;
  tenantName: string;
  roomNumber: string;
  rentFixed: number;
  rentReceivedOn: string | null;
  rentReceived: number;
  charges: number;
  month: number;
  year: number;
  checkInDate: string;
  checkOutDate: string | null;
  screenshotUrl: string | null;
  folder: string | null;
  paymentStatus: 'paid' | 'partial' | 'pending';
  proRataRent: number;
  rentBalance: number;
  occupancyDays: number;
  reviewDecision: TenantReviewDecision;
  reviewComment: string | null;
  reviewVerifiedBy: string | null;
  reviewVerifiedOn: string | null;
}

type TenantReviewDecision = 'approved' | 'rejected' | null;

interface TenantReviewState {
  decision: TenantReviewDecision;
  comment: string;
}

interface RentalRecord {
  id: number;
  occupancyId: number;
  tenantId: number;
  tenantName: string;
  roomNumber: string;
  rentFixed: number;
  rentReceivedOn: string;
  rentReceived: number;
  charges: number;
  rentBalance: number;
  modeOfPayment: string | null;
  screenshotUrl: string | null;
  folder: string | null;
  createdDate: string;
  updatedDate: string | null;
}

interface OccupancyOption {
  id: number;
  label: string;
  roomNumber: string;
}

interface FormData {
  rentReceived: string;
  charges: string;
  modeOfPayment: string;
  rentReceivedOn: string;
  screenshot: File | null;
}

function getDefaultMonthValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export default function RentalCollectionDetails() {
  const { hasRole, hasAnyRole } = useAuth();
  const [occupancyOptions, setOccupancyOptions] = useState<OccupancyOption[]>([]);
  const [selectedOccupancyId, setSelectedOccupancyId] = useState<number | null>(null);
  const [occupancyInfo, setOccupancyInfo] = useState<OccupancyInfo | null>(null);
  const [rentalRecords, setRentalRecords] = useState<RentalRecord[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [proofPreview, setProofPreview] = useState<{ url: string; alt: string } | null>(null);
  const [editingRecord, setEditingRecord] = useState<RentalRecord | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<RentalRecord & { screenshot: File | null }>>({})
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>(getDefaultMonthValue());
  const [selectedRoomFilter, setSelectedRoomFilter] = useState<string>('all');
  const [editPreviewUrl, setEditPreviewUrl] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<FormData>({
    rentReceived: '',
    charges: '',
    modeOfPayment: 'cash',
    rentReceivedOn: new Date().toISOString().split('T')[0],
    screenshot: null
  });
  const [currentMonthPayments, setCurrentMonthPayments] = useState<MonthlyPaymentStatus[]>([]);
  const [currentMonthLoading, setCurrentMonthLoading] = useState(false);
  const [currentMonthError, setCurrentMonthError] = useState<string | null>(null);
  const [tenantReviews, setTenantReviews] = useState<Record<number, TenantReviewState>>({});
  const [expandedReviewRows, setExpandedReviewRows] = useState<Record<number, boolean>>({});
  const [savingReviewRows, setSavingReviewRows] = useState<Record<number, boolean>>({});

  const currentMonthYear = selectedMonthFilter;
  const paidOccupancyIds = new Set(
    currentMonthPayments
      .filter((payment) => payment.paymentStatus === 'paid')
      .map((payment) => payment.occupancyId)
  );

  const roomFilterOptions = Array.from(
    new Set(currentMonthPayments.map((payment) => payment.roomNumber))
  ).sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }));

  const filteredCurrentMonthPayments = currentMonthPayments.filter((payment) =>
    selectedRoomFilter === 'all' ? true : payment.roomNumber === selectedRoomFilter
  );
  const canChangeReviewStatus = hasAnyRole(['admin', 'accountant']) || !hasRole('manager');

  const getProofUrl = (
    screenshotUrl: string | null,
    paymentDate?: string | null,
    containerName?: string | null
  ): string => {
    if (!screenshotUrl) return '';
    return getRentalPaymentProofUrl(screenshotUrl, paymentDate, containerName);
  };

  const compareRoomNumbers = (left: string, right: string): number =>
    left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });

  const fetchCurrentMonthPayments = async () => {
    try {
      setCurrentMonthLoading(true);
      setCurrentMonthError(null);
      const response = await apiService.getPaymentsByMonth(currentMonthYear);
      const records = ((response.data || response || []) as MonthlyPaymentStatus[]).sort(
        (a: MonthlyPaymentStatus, b: MonthlyPaymentStatus) =>
          compareRoomNumbers(a.roomNumber, b.roomNumber)
      );
      setCurrentMonthPayments(records);
      setTenantReviews(
        records.reduce<Record<number, TenantReviewState>>((accumulator, record) => {
          accumulator[record.occupancyId] = {
            decision: record.reviewDecision || null,
            comment: record.reviewComment || ''
          };

          return accumulator;
        }, {})
      );
    } catch (err) {
      console.error('Error fetching current month payments:', err);
      setCurrentMonthError('Failed to load current month occupied room status.');
    } finally {
      setCurrentMonthLoading(false);
    }
  };

  const formatMonthTitle = (monthYear: string): string => {
    const [year, month] = monthYear.split('-').map(Number);
    if (!year || !month) {
      return monthYear;
    }

    return new Date(year, month - 1, 1).toLocaleDateString('en-IN', {
      month: 'long',
      year: 'numeric'
    });
  };

  // Load occupancy options on mount
  useEffect(() => {
    fetchOccupancies();
    fetchCurrentMonthPayments();
  }, []);

  // Re-fetch when month filter changes
  useEffect(() => {
    fetchCurrentMonthPayments();
  }, [currentMonthYear]);

  // Reset room filter when month changes
  useEffect(() => {
    setSelectedRoomFilter('all');
  }, [currentMonthYear]);

  const fetchOccupancies = async () => {
    try {
      setLoading(true);
      const response = await apiService.getOccupancyLinks();
      const occupancies = response.data || response;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const optionsWithDates = occupancies.map((occupancy: any) => {
        const checkInDate = new Date(occupancy.checkInDate).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: '2-digit'
        });
        
        let checkOutDate = 'Active';
        let checkOutTime = Infinity; // Active tenants sort first (highest value)
        
        if (occupancy.checkOutDate) {
          const checkOut = new Date(occupancy.checkOutDate);
          checkOut.setHours(0, 0, 0, 0);
          checkOutTime = checkOut.getTime();
          
          if (checkOut < today) {
            checkOutDate = checkOut.toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: '2-digit'
            });
          }
        }
        
        return {
          id: occupancy.occupancyId,
          label: `${occupancy.tenantName.trim()} - Room ${occupancy.roomNumber.trim()} (In: ${checkInDate}, Out: ${checkOutDate})`,
          roomNumber: occupancy.roomNumber.trim(),
          sortKey: checkOutTime
        };
      });
      
      const sortedOptions = optionsWithDates.sort((a: any, b: any) =>
        compareRoomNumbers(a.roomNumber, b.roomNumber) || b.sortKey - a.sortKey
      );
      
      const options = sortedOptions.map(
        ({ id, label, roomNumber }: { id: number; label: string; roomNumber: string }) => ({
          id,
          label,
          roomNumber
        })
      );
      setOccupancyOptions(options);
    } catch (err) {
      console.error('Error fetching occupancies:', err);
      setError('Failed to load occupancies. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch rental details when occupancy is selected
  useEffect(() => {
    if (selectedOccupancyId) {
      fetchRentalDetails();
    }
  }, [selectedOccupancyId]);

  const fetchRentalDetails = async () => {
    if (!selectedOccupancyId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const [summaryRes, recordsRes] = await Promise.all([
        apiService.getRentalSummaryByOccupancy(selectedOccupancyId),
        apiService.getRentalCollectionByOccupancy(selectedOccupancyId)
      ]);
      
      setOccupancyInfo(summaryRes.data || summaryRes);
      setRentalRecords(recordsRes.data || recordsRes || []);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch rental details';
      setError(errorMsg);
      console.error('Error fetching rental details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setFormData(prev => ({
        ...prev,
        screenshot: file
      }));
      // Create preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedOccupancyId) {
      setError('Please select an occupancy');
      return;
    }

    if (!formData.rentReceived) {
      setError('Rent received amount is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setUploadProgress(0);

      const paymentDate = formData.rentReceivedOn || new Date().toISOString().split('T')[0];
      const selectedPaymentMode = formData.modeOfPayment || 'cash';

      if (selectedPaymentMode === 'checkout') {
        const shouldProceedWithCheckout = window.confirm(
          'This will save payment and check out the room on the selected payment date. Do you want to continue?'
        );

        if (!shouldProceedWithCheckout) {
          setLoading(false);
          return;
        }
      }

      const formDataToSend = new FormData();
      formDataToSend.append('occupancyId', selectedOccupancyId.toString());
      formDataToSend.append('rentReceived', formData.rentReceived);
      formDataToSend.append('charges', formData.charges || '0');
      formDataToSend.append('modeOfPayment', selectedPaymentMode);
      formDataToSend.append('rentReceivedOn', paymentDate);
      
      if (formData.screenshot) {
        formDataToSend.append('screenshot', formData.screenshot);
      }

      const response = await apiService.uploadPaymentScreenshot(
        formDataToSend,
        setUploadProgress
      );

      let checkoutWarning: string | null = null;
      if (selectedPaymentMode === 'checkout') {
        try {
          const parsedCharges = formData.charges ? parseFloat(formData.charges) : 0;
          await apiService.checkoutOccupancy(
            selectedOccupancyId,
            paymentDate,
            undefined,
            Number.isFinite(parsedCharges) ? parsedCharges : 0
          );
        } catch (checkoutError) {
          checkoutWarning = checkoutError instanceof Error
            ? `Payment saved, but checkout failed: ${checkoutError.message}`
            : 'Payment saved, but checkout failed.';
          console.error('Checkout failed after payment save:', checkoutError);
        }
      }

      // Reset form and refresh data
      setFormData({
        rentReceived: '',
        charges: '',
        modeOfPayment: 'cash',
        rentReceivedOn: new Date().toISOString().split('T')[0],
        screenshot: null
      });
      
      setPreviewUrl(null);
      setShowForm(false);
      setUploadProgress(0);
      
      // Refresh rental details
      await fetchRentalDetails();
      await fetchCurrentMonthPayments();
      await fetchOccupancies();

      if (checkoutWarning) {
        setError(checkoutWarning);
      }
      
      // Show success message
      console.log('Payment recorded successfully:', response);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to upload payment';
      setError(errorMsg);
      console.error('Error uploading payment:', err);
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const handleEditClick = (record: RentalRecord) => {
    setEditingRecord(record);
    setEditFormData({
      rentReceived: record.rentReceived,
      charges: record.charges,
      modeOfPayment: record.modeOfPayment || 'cash',
      rentReceivedOn: new Date(record.rentReceivedOn).toISOString().split('T')[0]
    });
  };

  const handleCancelEdit = () => {
    setEditingRecord(null);
    setEditFormData({});
    setEditPreviewUrl(null);
  };

  const handleEditFormChange = (field: string, value: any) => {
    setEditFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleEditFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setEditFormData(prev => ({
        ...prev,
        screenshot: file
      }));
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingRecord) return;

    try {
      setLoading(true);
      setUploadProgress(0);

      const paymentDate = editFormData.rentReceivedOn?.toString() || '';
      const selectedPaymentMode = editFormData.modeOfPayment?.toString() || 'cash';

      if (selectedPaymentMode === 'checkout') {
        const shouldProceedWithCheckout = window.confirm(
          'This will update payment and check out the room on the payment date. Do you want to continue?'
        );

        if (!shouldProceedWithCheckout) {
          setLoading(false);
          return;
        }
      }
      
      // Create FormData for update
      const updateData = new FormData();
      updateData.append('occupancyId', editingRecord.occupancyId.toString());
      updateData.append('rentReceived', editFormData.rentReceived?.toString() || '0');
      updateData.append('charges', editFormData.charges?.toString() || '0');
      updateData.append('modeOfPayment', selectedPaymentMode);
      updateData.append('rentReceivedOn', paymentDate);
      
      if (editFormData.screenshot) {
        updateData.append('screenshot', editFormData.screenshot);
      }

      // Use the uploadPaymentScreenshot method which handles both create and update
      // Pass progress callback for file upload feedback
      await apiService.uploadPaymentScreenshot(updateData, (progress) => {
        setUploadProgress(progress);
      });

      let checkoutWarning: string | null = null;
      if (selectedPaymentMode === 'checkout' && paymentDate) {
        try {
          const parsedCharges = Number(editFormData.charges || 0);
          await apiService.checkoutOccupancy(
            editingRecord.occupancyId,
            paymentDate,
            undefined,
            Number.isFinite(parsedCharges) ? parsedCharges : 0
          );
        } catch (checkoutError) {
          checkoutWarning = checkoutError instanceof Error
            ? `Payment updated, but checkout failed: ${checkoutError.message}`
            : 'Payment updated, but checkout failed.';
          console.error('Checkout failed after payment update:', checkoutError);
        }
      }

      // Refresh rental details
      await fetchRentalDetails();
      await fetchCurrentMonthPayments();
      await fetchOccupancies();

      if (checkoutWarning) {
        setError(checkoutWarning);
      }
      
      // Close modal
      handleCancelEdit();
      
      // Show success
      alert(checkoutWarning ? 'Payment updated. Checkout failed; please retry from occupancy checkout.' : 'Payment updated successfully');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update payment';
      setError(errorMsg);
      alert(errorMsg);
      console.error('Error updating payment:', err);
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const formatCurrency = (value: number | string): string => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(num);
  };

  const getTotalReceived = (rentReceived: number, charges: number): number =>
    Number(rentReceived || 0) + Number(charges || 0);

  const getDisplayBalance = (record: RentalRecord): number => {
    const storedBalance = Number(record.rentBalance || 0);
    if (storedBalance > 0) {
      return storedBalance;
    }

    // Fallback when legacy records have 0 in RentBalance even for partial payments.
    const fallback = Number(record.rentFixed || 0) - (Number(record.rentReceived || 0) + Number(record.charges || 0));
    return Math.max(0, fallback);
  };

  const openProofPreview = (url: string, alt: string) => {
    setProofPreview({ url, alt });
  };

  const formatReviewSavedDate = (value: string | null): string | null => {
    if (!value) {
      return null;
    }

    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
      return null;
    }

    return parsedDate.toLocaleDateString('en-IN');
  };

  const applySavedReviewToPayments = (
    occupancyId: number,
    review: {
      reviewDecision: TenantReviewDecision;
      reviewComment: string | null;
      reviewVerifiedBy: string | null;
      reviewVerifiedOn: string | null;
    }
  ) => {
    setCurrentMonthPayments((prev) =>
      prev.map((payment) =>
        payment.occupancyId === occupancyId
          ? {
              ...payment,
              ...review
            }
          : payment
      )
    );
  };

  const persistTenantReview = async (occupancyId: number, review: TenantReviewState) => {
    try {
      setSavingReviewRows((prev) => ({
        ...prev,
        [occupancyId]: true
      }));

      const response = await apiService.saveRentalReview(occupancyId, {
        monthYear: currentMonthYear,
        decision: review.decision,
        comment: review.comment.trim() || null
      });

      const savedReview = response.data || response;

      setTenantReviews((prev) => ({
        ...prev,
        [occupancyId]: {
          decision: savedReview.reviewDecision || null,
          comment: savedReview.reviewComment || ''
        }
      }));

      applySavedReviewToPayments(occupancyId, {
        reviewDecision: savedReview.reviewDecision || null,
        reviewComment: savedReview.reviewComment || null,
        reviewVerifiedBy: savedReview.reviewVerifiedBy || null,
        reviewVerifiedOn: savedReview.reviewVerifiedOn || null
      });
    } catch (reviewError) {
      console.error('Error saving tenant review:', reviewError);
      setError(reviewError instanceof Error ? reviewError.message : 'Failed to save rental review.');
    } finally {
      setSavingReviewRows((prev) => ({
        ...prev,
        [occupancyId]: false
      }));
    }
  };

  const handleTenantReviewDecision = async (occupancyId: number, decision: Exclude<TenantReviewDecision, null>) => {
    const existingReview = tenantReviews[occupancyId] || { decision: null, comment: '' };
    const nextReview: TenantReviewState = {
      decision,
      comment: existingReview.comment || ''
    };

    setTenantReviews((prev) => ({
      ...prev,
      [occupancyId]: nextReview
    }));

    setExpandedReviewRows((prev) => ({
      ...prev,
      [occupancyId]: false
    }));

    await persistTenantReview(occupancyId, nextReview);
  };

  const handleTenantReviewComment = (occupancyId: number, comment: string) => {
    setTenantReviews((prev) => ({
      ...prev,
      [occupancyId]: {
        decision: prev[occupancyId]?.decision ?? null,
        comment
      }
    }));
  };

  const handleTenantReviewBlur = async (event: React.FocusEvent<HTMLTextAreaElement>, occupancyId: number) => {
    const nextFocusedElement = event.relatedTarget as HTMLElement | null;

    // If focus moves to approve/reject actions, let that click path handle persistence.
    if (nextFocusedElement?.closest('.tenant-review-actions')) {
      return;
    }

    const review = tenantReviews[occupancyId] || { decision: null, comment: '' };
    await persistTenantReview(occupancyId, review);
  };

  const toggleTenantReviewPanel = (occupancyId: number) => {
    setExpandedReviewRows((prev) => ({
      ...prev,
      [occupancyId]: !prev[occupancyId]
    }));
  };

  if (loading && !occupancyInfo) {
    return (
      <div className="rental-collection-details">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading rental collection details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rental-collection-details">
      <h2 className="section-heading">Rental Collection</h2>
      {error && (
        <div className="error-alert">
          <span>{error}</span>
          <button onClick={() => setError(null)}>&times;</button>
        </div>
      )}

      <div className="current-month-status-card">
        <div className="current-month-header">
          <div>
            <h3>Occupied Rooms Rental Status - {formatMonthTitle(currentMonthYear)}</h3>
            <p>Shows rental payment status for all occupied rooms in the selected period.</p>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={fetchCurrentMonthPayments}
            disabled={currentMonthLoading}
          >
            {currentMonthLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {/* Date Range Filter */}
        <div className="rental-date-filter-bar">
          <div className="rental-date-filter-group">
            <label htmlFor="selectedMonthFilter">Month</label>
            <input
              type="month"
              id="selectedMonthFilter"
              value={selectedMonthFilter}
              onChange={(e) => setSelectedMonthFilter(e.target.value)}
            />
          </div>
          <div className="rental-date-filter-group">
            <label htmlFor="selectedRoomFilter">Room</label>
            <select
              id="selectedRoomFilter"
              value={selectedRoomFilter}
              onChange={(e) => setSelectedRoomFilter(e.target.value)}
            >
              <option value="all">All Rooms</option>
              {roomFilterOptions.map((roomNumber) => (
                <option key={roomNumber} value={roomNumber}>
                  Room {roomNumber}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="rental-reset-filter-btn"
            onClick={() => {
              setSelectedMonthFilter(getDefaultMonthValue());
              setSelectedRoomFilter('all');
            }}
          >
            Reset to Current Month
          </button>
        </div>

        {currentMonthError && (
          <div className="current-month-error">{currentMonthError}</div>
        )}

        {!currentMonthError && filteredCurrentMonthPayments.length === 0 && !currentMonthLoading && (
          <div className="empty-state compact">
            <p>No occupied room records found for this filter.</p>
          </div>
        )}

        {filteredCurrentMonthPayments.length > 0 && (
          <>
            <div className="current-month-summary-grid">
              <div className="current-month-summary-item">
                <span>Total Occupied Rooms</span>
                <strong>{filteredCurrentMonthPayments.length}</strong>
              </div>
              <div className="current-month-summary-item">
                <span>Fully Paid</span>
                <strong>{filteredCurrentMonthPayments.filter((item) => item.paymentStatus === 'paid').length}</strong>
              </div>
              <div className="current-month-summary-item">
                <span>Partial</span>
                <strong>{filteredCurrentMonthPayments.filter((item) => item.paymentStatus === 'partial').length}</strong>
              </div>
              <div className="current-month-summary-item">
                <span>Pending</span>
                <strong>{filteredCurrentMonthPayments.filter((item) => item.paymentStatus === 'pending').length}</strong>
              </div>
              <div className="current-month-summary-item highlight-received">
                <span>Total Pro-Rata Rent Received</span>
                <strong>{formatCurrency(filteredCurrentMonthPayments.reduce((sum, item) => sum + (item.rentReceived || 0), 0))}</strong>
              </div>
              <div className="current-month-summary-item highlight-charges">
                <span>Total Charges</span>
                <strong>{formatCurrency(filteredCurrentMonthPayments.reduce((sum, item) => sum + (item.charges || 0), 0))}</strong>
              </div>
            </div>

            <div className="table-wrapper current-month-table-wrapper">
              <table className="payment-table current-month-table compact-grid">
                <thead>
                  <tr>
                    <th>Room</th>
                    <th>Tenant</th>
                    <th>Pro-Rata Rent</th>
                    <th>Charges</th>
                    <th>Balance</th>
                    <th>Status</th>
                    <th>Last Payment</th>
                    <th>Received</th>
                    <th>Proof</th>
                    <th>Review</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCurrentMonthPayments.map((item) => {
                    const review = tenantReviews[item.occupancyId] || { decision: null, comment: '' };
                    const isReviewExpanded = expandedReviewRows[item.occupancyId] || false;
                    const isSavingReview = savingReviewRows[item.occupancyId] || false;
                    const savedReviewDate = formatReviewSavedDate(item.reviewVerifiedOn);

                    return (
                      <tr key={item.occupancyId}>
                        <td>{item.roomNumber}</td>
                        <td>{item.tenantName}</td>
                        <td className="amount">{formatCurrency(item.proRataRent)}</td>
                        <td className="amount">{formatCurrency(item.charges)}</td>
                        <td className="amount balance">{formatCurrency(item.rentBalance)}</td>
                        <td>
                          <span className={`payment-status-badge ${item.paymentStatus}`}>
                            {item.paymentStatus}
                          </span>
                        </td>
                        <td>
                          {item.rentReceivedOn
                            ? new Date(item.rentReceivedOn).toLocaleDateString('en-IN')
                            : 'No payment'}
                        </td>
                        <td className="amount received">{formatCurrency(getTotalReceived(item.rentReceived, item.charges))}</td>
                        <td>
                          {item.screenshotUrl ? (
                            <button
                              type="button"
                              className="last-proof-link"
                              title="Preview latest payment proof"
                              onClick={() =>
                                openProofPreview(
                                  getProofUrl(item.screenshotUrl, item.rentReceivedOn, item.folder),
                                  `Payment proof ${item.tenantName}`
                                )
                              }
                            >
                              <img
                                src={getProofUrl(item.screenshotUrl, item.rentReceivedOn, item.folder)}
                                alt={`Payment proof ${item.tenantName}`}
                                className="last-proof-thumb"
                              />
                            </button>
                          ) : (
                            <span className="no-proof">-</span>
                          )}
                        </td>
                        <td className="review-cell">
                          <div className="tenant-review-panel">
                            <div className="tenant-review-topline">
                              <div className="tenant-review-actions" role="group" aria-label={`Review actions for ${item.tenantName}`}>
                                <button
                                  type="button"
                                  className={`review-icon-button approve ${review.decision === 'approved' ? 'active' : ''}`}
                                  onClick={() => handleTenantReviewDecision(item.occupancyId, 'approved')}
                                  aria-pressed={review.decision === 'approved'}
                                  title={canChangeReviewStatus ? `Approve ${item.tenantName}` : 'Managers can update comments only'}
                                  disabled={isSavingReview || !canChangeReviewStatus}
                                >
                                  <span className="review-icon" aria-hidden="true">✓</span>
                                </button>
                                <button
                                  type="button"
                                  className={`review-icon-button reject ${review.decision === 'rejected' ? 'active' : ''}`}
                                  onClick={() => handleTenantReviewDecision(item.occupancyId, 'rejected')}
                                  aria-pressed={review.decision === 'rejected'}
                                  title={canChangeReviewStatus ? `Reject ${item.tenantName}` : 'Managers can update comments only'}
                                  disabled={isSavingReview || !canChangeReviewStatus}
                                >
                                  <span className="review-icon" aria-hidden="true">✕</span>
                                </button>
                              </div>
                              <button
                                type="button"
                                className={`review-status-trigger ${review.decision || 'unreviewed'}`}
                                onClick={() => toggleTenantReviewPanel(item.occupancyId)}
                                aria-expanded={isReviewExpanded}
                                aria-controls={`review-panel-${item.occupancyId}`}
                                aria-label={review.decision ? `Marked ${review.decision}` : 'Pending review'}
                                title={review.decision ? `Marked ${review.decision}` : 'Pending review'}
                                disabled={isSavingReview}
                              >
                                <span className={`review-status-text ${review.decision || 'unreviewed'}`}>
                                  {review.decision === 'approved' ? (
                                    <span className="review-status-icon approved" aria-hidden="true">✓</span>
                                  ) : review.decision === 'rejected' ? (
                                    <span className="review-status-icon rejected" aria-hidden="true">✕</span>
                                  ) : (
                                    <span className="review-status-icon" aria-hidden="true"></span>
                                  )}
                                </span>
                                <span className={`review-status-caret ${isReviewExpanded ? 'expanded' : ''}`} aria-hidden="true">
                                  ▾
                                </span>
                              </button>
                            </div>
                            {isReviewExpanded && (
                              <div
                                id={`review-panel-${item.occupancyId}`}
                                className="review-panel-body"
                              >
                                <label className="review-comment-label" htmlFor={`review-comment-${item.occupancyId}`}>
                                  Reviewer Comment
                                </label>
                                <textarea
                                  id={`review-comment-${item.occupancyId}`}
                                  className="review-comment-input"
                                  value={review.comment}
                                  onChange={(event) => handleTenantReviewComment(item.occupancyId, event.target.value)}
                                  onBlur={(event) => handleTenantReviewBlur(event, item.occupancyId)}
                                  placeholder={
                                    review.decision === 'approved'
                                      ? 'Add an approval note'
                                      : review.decision === 'rejected'
                                        ? 'Add a rejection reason'
                                        : 'Add an optional review comment'
                                  }
                                  rows={3}
                                  maxLength={240}
                                  disabled={isSavingReview}
                                />
                                <div className="review-comment-footer">
                                  <span className="review-meta-text">
                                    {item.reviewVerifiedBy
                                      ? `Saved by ${item.reviewVerifiedBy}${savedReviewDate ? ` on ${savedReviewDate}` : ''}`
                                      : 'Not saved yet'}
                                  </span>
                                  {!canChangeReviewStatus && (
                                    <span className="review-meta-text">Managers can update comments only.</span>
                                  )}
                                  <span>{isSavingReview ? 'Saving...' : `${review.comment.length}/240`}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Occupancy Selector */}
      <div className="selector-card">
        <div className="selector-wrapper">
          <label className="selector-label">Select Tenant & Room</label>
          <SearchableDropdown
            value={selectedOccupancyId?.toString() || ''}
            onChange={(option) => setSelectedOccupancyId(parseInt(option.id.toString()))}
            options={occupancyOptions.map(opt => ({
              id: opt.id.toString(),
              label: opt.label,
              optionClassName: paidOccupancyIds.has(opt.id) ? 'paid-occupancy-option' : '',
              optionBadgeText: paidOccupancyIds.has(opt.id) ? 'Paid' : undefined,
              optionBadgeVariant: paidOccupancyIds.has(opt.id) ? 'success' : undefined
            }))}
            placeholder="Search by tenant name or room number..."
          />
        </div>
      </div>

      {occupancyInfo && (
        <>
          {/* Occupancy Information Card */}
          <div className="occupancy-info-card">
            <div className="info-header">
              <h2>{occupancyInfo.tenantName}</h2>
              <span className="room-badge">Room {occupancyInfo.roomNumber}</span>
            </div>
            
            <div className="info-grid">
              <div className="info-item">
                <label>Check-In Date</label>
                <p>{new Date(occupancyInfo.checkInDate).toLocaleDateString()}</p>
              </div>
              <div className="info-item">
                <label>Check-Out Date</label>
                <p>{occupancyInfo.checkOutDate ? new Date(occupancyInfo.checkOutDate).toLocaleDateString() : 'Active'}</p>
              </div>
              <div className="info-item">
                <label>Monthly Rent</label>
                <p className="amount">{formatCurrency(occupancyInfo.rentFixed)}</p>
              </div>
              <div className="info-item">
                <label>Last Payment Date</label>
                <p>{occupancyInfo.lastPaymentDate ? new Date(occupancyInfo.lastPaymentDate).toLocaleDateString() : 'No payments'}</p>
              </div>
            </div>
          </div>

          {/* Financial Summary Cards */}
          <div className="summary-cards-grid">
            <div className="summary-card">
              <div className="card-label">Total Received (Rent + Charges)</div>
              <div className="card-value received">{formatCurrency(getTotalReceived(occupancyInfo.totalRentReceived, occupancyInfo.totalCharges))}</div>
              <div className="card-subtext">{occupancyInfo.paymentRecordsCount} payment(s)</div>
            </div>
            
            <div className="summary-card">
              <div className="card-label">Total Charges</div>
              <div className="card-value charges">{formatCurrency(occupancyInfo.totalCharges)}</div>
            </div>
            
            <div className="summary-card">
              <div className="card-label">Outstanding Balance (Est.)</div>
              <div className="card-value balance">
                {formatCurrency(Math.max(0, occupancyInfo.proRataRent - (occupancyInfo.totalRentReceived + occupancyInfo.totalCharges)))}
              </div>
            </div>
          </div>

          {/* Add Payment Button */}
          <div className="action-section">
            <button
              className="btn btn-primary btn-large"
              onClick={() => setShowForm(!showForm)}
              disabled={loading}
            >
              {showForm ? '✕ Cancel' : '+ Add Payment'}
            </button>
          </div>

          {/* Payment Form */}
          {showForm && (
            <div className="payment-form-card">
              <h3>Record Payment</h3>
              <form onSubmit={handleSubmit} className="payment-form">
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="rentReceivedOn">Payment Date</label>
                    <input
                      type="date"
                      id="rentReceivedOn"
                      name="rentReceivedOn"
                      value={formData.rentReceivedOn}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="rentReceived">Rent Received (₹)</label>
                    <input
                      type="number"
                      id="rentReceived"
                      name="rentReceived"
                      value={formData.rentReceived}
                      onChange={handleInputChange}
                      placeholder="0.00"
                      step="0.01"
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="charges">Charges/Adjustments (₹)</label>
                    <input
                      type="number"
                      id="charges"
                      name="charges"
                      value={formData.charges}
                      onChange={handleInputChange}
                      placeholder="0.00"
                      step="0.01"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="modeOfPayment">Payment Mode</label>
                    <select
                      id="modeOfPayment"
                      name="modeOfPayment"
                      value={formData.modeOfPayment}
                      onChange={handleInputChange}
                    >
                      <option value="cash">Cash</option>
                      <option value="cheque">Cheque</option>
                      <option value="upi">UPI</option>
                      <option value="bank">Bank Transfer</option>
                      <option value="other">Other</option>
                      <option value="checkout">CheckOut</option>
                    </select>
                  </div>
                </div>

                <div className="form-group full-width">
                  <label htmlFor="screenshot">Payment Proof (Screenshot)</label>
                  <div className="file-input-wrapper">
                    <input
                      type="file"
                      id="screenshot"
                      name="screenshot"
                      accept="image/*"
                      onChange={handleFileChange}
                    />
                    <div className="file-label">
                      {formData.screenshot ? (
                        <>
                          <span className="upload-icon">✓</span>
                          <span className="file-name">{formData.screenshot.name}</span>
                        </>
                      ) : (
                        <>
                          <span className="upload-icon">📷</span>
                          <span>Click to upload or drag and drop</span>
                          <span className="file-hint">PNG, JPG, GIF up to 50MB</span>
                        </>
                      )}
                    </div>
                  </div>

                  {previewUrl && (
                    <div className="preview-container">
                      <p className="preview-label">Preview</p>
                      <img src={previewUrl} alt="Payment proof preview" className="preview-image" />
                    </div>
                  )}
                </div>

                {uploadProgress > 0 && uploadProgress < 100 && (
                  <div className="progress-section">
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                    <p className="progress-text">Uploading... {uploadProgress}%</p>
                  </div>
                )}

                <div className="form-actions">
                  <button
                    type="submit"
                    className="btn btn-success"
                    disabled={loading || uploadProgress > 0}
                  >
                    {loading ? 'Saving...' : 'Save Payment'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowForm(false);
                      setFormData({
                        rentReceived: '',
                        charges: '',
                        modeOfPayment: 'cash',
                        rentReceivedOn: new Date().toISOString().split('T')[0],
                        screenshot: null
                      });
                      setPreviewUrl(null);
                    }}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Payment History Table */}
          <div className="payment-history-section">
            <h3>Payment History & Details Breakdown</h3>
            
            {rentalRecords.length > 0 ? (
              <div className="payment-records-container">
                {rentalRecords.map((record) => (
                  <div key={record.id} className="payment-record-card">
                    <div className="payment-record-header">
                      <div className="payment-date">
                        <span className="label">Payment Date</span>
                        <span className="value">
                          {new Date(record.rentReceivedOn).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </span>
                      </div>
                      <div className="payment-mode">
                        <span className="label">Mode</span>
                        {record.modeOfPayment ? (
                          <span className="badge-mode">{record.modeOfPayment}</span>
                        ) : (
                          <span className="badge-mode gray">—</span>
                        )}
                      </div>
                      <button 
                        className="payment-record-edit-btn"
                        title="Edit payment record"
                        onClick={() => handleEditClick(record)}
                      >
                        ✏️ Edit
                      </button>
                    </div>

                    <div className="payment-record-details">
                      <div className="detail-item">
                        <span className="label">Fixed Rent</span>
                        <span className="value">{formatCurrency(record.rentFixed)}</span>
                      </div>
                      <div className="detail-item">
                        <span className="label">Charges</span>
                        <span className="value">{formatCurrency(record.charges)}</span>
                      </div>
                      <div className="detail-item">
                        <span className="label">Received</span>
                        <span className="value received">{formatCurrency(getTotalReceived(record.rentReceived, record.charges))}</span>
                      </div>
                      <div className="detail-item">
                        <span className="label">Balance</span>
                        <span className="value balance">{formatCurrency(getDisplayBalance(record))}</span>
                      </div>
                    </div>

                    {record.screenshotUrl && (
                      <div className="payment-screenshot">
                        <div className="screenshot-label">Payment Proof</div>
                        <button
                          type="button"
                          className="screenshot-link"
                          onClick={() =>
                            openProofPreview(
                              getProofUrl(record.screenshotUrl, record.rentReceivedOn, record.folder),
                              `Payment proof screenshot for ${record.tenantName}`
                            )
                          }
                          title="Preview payment proof"
                        >
                          <img
                            src={getProofUrl(record.screenshotUrl, record.rentReceivedOn, record.folder)}
                            alt="Payment proof screenshot"
                            className="screenshot-thumbnail"
                          />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>No payment records yet. {showForm ? '' : 'Click "Add Payment" to record the first payment.'}</p>
              </div>
            )}
          </div>
        </>
      )}

      {!selectedOccupancyId && !loading && (
        <div className="empty-state">
          <p>👆 Select a tenant and room to view rental collection details</p>
        </div>
      )}

      {proofPreview && (
        <div
          className="proof-preview-overlay"
          onClick={() => setProofPreview(null)}
          role="presentation"
        >
          <div
            className="proof-preview-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Payment proof preview"
          >
            <button
              type="button"
              className="proof-preview-close"
              onClick={() => setProofPreview(null)}
              aria-label="Close payment proof preview"
            >
              ✕
            </button>
            <img
              src={proofPreview.url}
              alt={proofPreview.alt}
              className="proof-preview-image"
            />
          </div>
        </div>
      )}

      {/* Edit Payment Modal */}
      {editingRecord && (
        <div className="edit-payment-modal-overlay">
          <div className="edit-payment-modal">
            <button 
              className="modal-close-btn"
              onClick={handleCancelEdit}
              aria-label="Close"
            >
              ✕
            </button>
            
            <h2>Edit Payment Record</h2>
            <p className="modal-subtitle">Occupancy: {editingRecord.tenantName} - Room {editingRecord.roomNumber}</p>
            
            <div className="edit-form-container">
              <div className="edit-form-group">
                <label htmlFor="editRentReceived">Rent Received (₹)</label>
                <input
                  type="number"
                  id="editRentReceived"
                  value={editFormData.rentReceived || ''}
                  onChange={(e) => handleEditFormChange('rentReceived', parseFloat(e.target.value))}
                  placeholder="Enter amount"
                  min="0"
                  step="0.01"
                />
              </div>

              <div className="edit-form-group">
                <label htmlFor="editCharges">Charges (₹)</label>
                <input
                  type="number"
                  id="editCharges"
                  value={editFormData.charges || ''}
                  onChange={(e) => handleEditFormChange('charges', parseFloat(e.target.value))}
                  placeholder="Enter charges"
                  min="0"
                  step="0.01"
                />
              </div>

              <div className="edit-form-group">
                <label htmlFor="editPaymentDate">Payment Date</label>
                <input
                  type="date"
                  id="editPaymentDate"
                  value={editFormData.rentReceivedOn || ''}
                  onChange={(e) => handleEditFormChange('rentReceivedOn', e.target.value)}
                  disabled
                  title="Payment date cannot be changed. Create a new payment record if the date needs to be corrected."
                />
                <small className="field-note">Payment date cannot be edited (uniquely identifies this payment)</small>
              </div>

              <div className="edit-form-group">
                <label htmlFor="editPaymentMode">Mode of Payment</label>
                <select
                  id="editPaymentMode"
                  value={editFormData.modeOfPayment || 'cash'}
                  onChange={(e) => handleEditFormChange('modeOfPayment', e.target.value)}
                >
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="online_payment">Online Payment</option>
                  <option value="upi">UPI</option>
                  <option value="checkout">CheckOut</option>
                </select>
              </div>

              {editingRecord.screenshotUrl && !editFormData.screenshot && (
                <div className="current-image-section">
                  <h3>Current Payment Proof</h3>
                  <img 
                    src={getProofUrl(editingRecord.screenshotUrl, editingRecord.rentReceivedOn, editingRecord.folder)} 
                    alt="Current payment proof" 
                    className="current-image"
                  />
                  <p className="image-note">Upload a new image below to replace it</p>
                </div>
              )}

              <div className="edit-form-group full-width">
                <label htmlFor="editScreenshot">
                  {editingRecord.screenshotUrl ? 'Replace Payment Proof' : 'Add Payment Proof (Screenshot)'}
                </label>
                <div className="file-input-wrapper">
                  <input
                    type="file"
                    id="editScreenshot"
                    name="editScreenshot"
                    accept="image/*"
                    onChange={handleEditFileChange}
                  />
                  <div className="file-label">
                    {editFormData.screenshot ? (
                      <>
                        <span>✓ {editFormData.screenshot.name}</span>
                        <small>Click to change</small>
                      </>
                    ) : (
                      <>
                        <span>📎 {editingRecord.screenshotUrl ? 'Replace' : 'Attach'} Payment Proof</span>
                        <small>JPG, PNG up to 5MB</small>
                      </>
                    )}
                  </div>
                </div>
                {editPreviewUrl && (
                  <div className="file-preview">
                    <h4>New Image Preview</h4>
                    <img src={editPreviewUrl} alt="Payment proof preview" />
                    <button
                      type="button"
                      className="remove-preview-btn"
                      onClick={() => {
                        setEditFormData(prev => ({ ...prev, screenshot: null }));
                        setEditPreviewUrl(null);
                      }}
                    >
                      ✕ Remove
                    </button>
                  </div>
                )}
              </div>
            </div>

            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="progress-section">
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${uploadProgress}%` }}></div>
                </div>
                <p className="progress-text">Uploading... {uploadProgress}%</p>
              </div>
            )}

            <div className="edit-modal-buttons">
              <button 
                className="edit-save-btn"
                onClick={handleSaveEdit}
                disabled={loading}
              >
                {loading ? '⏳ Saving...' : '💾 Save Changes'}
              </button>
              <button 
                className="edit-cancel-btn"
                onClick={handleCancelEdit}
                disabled={loading}
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
