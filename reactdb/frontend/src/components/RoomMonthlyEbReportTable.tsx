import { useEffect, useMemo, useState } from 'react';
import { apiService } from '../api';
import './RoomMonthlyEbReportTable.css';

interface RoomOption {
  id: number;
  number: string;
}

interface TenantSplit {
  tenantChargeId: number;
  tenantId: number;
  tenantName: string;
  tenantPhone: string;
  splitUnits: number;
  splitPercentage: number;
  splitCharge: number;
  checkInDate: string | null;
  checkOutDate: string | null;
  occupancyDaysInMonth: number;
  totalDaysInMonth: number;
  status: string;
}

interface RoomMonthlyEbRecord {
  serviceConsumptionId: number;
  serviceAllocId: number;
  roomId: number;
  roomNumber: string;
  beds?: number;
  roomType?: string;
  serviceId: number;
  serviceName: string;
  meterNo: string;
  readingTakenDate: string;
  startingReading: number;
  endingReading: string;
  unitsConsumed: number;
  unitRate: number;
  totalAmount: number;
  tenants: TenantSplit[];
}

interface Props {
  selectedMonth: string;
  roomOptions: RoomOption[];
  refreshKey?: number;
}

export default function RoomMonthlyEbReportTable({ selectedMonth, roomOptions, refreshKey = 0 }: Props): JSX.Element {
  const [selectedRoomId, setSelectedRoomId] = useState<number>(0);
  const [records, setRecords] = useState<RoomMonthlyEbRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedMonth = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    return { year, month };
  }, [selectedMonth]);

  const fetchReport = async () => {
    if (!parsedMonth.year || !parsedMonth.month) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await apiService.getRoomMonthlyEbReport(
        parsedMonth.year,
        parsedMonth.month,
        selectedRoomId || undefined
      );

      setRecords(response.data?.data || []);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load room monthly EB report';
      setError(errorMsg);
      console.error('Error loading room monthly EB report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [parsedMonth.year, parsedMonth.month, selectedRoomId, refreshKey]);

  const formatDate = (value: string | null): string => {
    if (!value) {
      return '-';
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString();
  };

  const getActiveTenants = (tenants: TenantSplit[]): string => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeNames = tenants
      .filter((tenant) => {
        if (!tenant.checkOutDate) {
          return true;
        }

        const checkOut = new Date(tenant.checkOutDate);
        if (Number.isNaN(checkOut.getTime())) {
          return false;
        }

        checkOut.setHours(0, 0, 0, 0);
        return checkOut >= today;
      })
      .map((tenant) => tenant.tenantName)
      .filter(Boolean);

    return activeNames.join(', ');
  };

  const getRoomCategory = (record: RoomMonthlyEbRecord): 'shop' | 'residential' => {
    if (typeof record.beds === 'number') {
      return record.beds === 0 ? 'shop' : 'residential';
    }

    return (record.roomType || '').toLowerCase() === 'shop' ? 'shop' : 'residential';
  };

  const categorizedRecords = useMemo(() => {
    return records.reduce(
      (acc, record) => {
        const category = getRoomCategory(record);
        acc[category].push(record);
        return acc;
      },
      {
        shop: [] as RoomMonthlyEbRecord[],
        residential: [] as RoomMonthlyEbRecord[]
      }
    );
  }, [records]);

  const renderRecordCard = (record: RoomMonthlyEbRecord, isShop: boolean): JSX.Element => {
    const activeTenants = getActiveTenants(record.tenants);
    const activeTenantLabel = activeTenants || 'Vacant';
    const isVacant = activeTenantLabel === 'Vacant';

    return (
      <div
        key={record.serviceConsumptionId}
        className={`eb-report-card ${isShop ? 'eb-report-card-shop' : 'eb-report-card-residential'} ${record.tenants.length === 0 ? 'eb-report-card-vacant' : ''}`}
      >
        <div className="eb-report-card-head">
          <div>
            <strong>Room {record.roomNumber}</strong>
            <span className={`eb-report-category-badge ${isShop ? 'eb-report-category-shop' : 'eb-report-category-residential'}`}>
              {isShop ? 'Shop' : 'Residential'}
            </span>
            {' - '}{record.serviceName}
            <div className={`eb-report-active-tenant ${isVacant ? 'eb-report-active-tenant-vacant' : ''}`}>
              Active Tenant: {activeTenantLabel}
            </div>
            {record.tenants.length === 0 && (
              <span className="eb-report-vacant-badge">Vacant</span>
            )}
          </div>
          <div>Meter: {record.meterNo}</div>
        </div>

        <div className="eb-report-metrics">
          <span>Reading Date: {new Date(record.readingTakenDate).toLocaleDateString()}</span>
          <span>Start: {record.startingReading}</span>
          <span>End: {String(record.endingReading).trim()}</span>
          <span>Units: {record.unitsConsumed}</span>
          <span>Rate: ₹{Number(record.unitRate || 0).toFixed(2)}/unit</span>
          <span>Total: ₹{Number(record.totalAmount || 0).toFixed(2)}</span>
        </div>

        <div className="eb-report-tenant-title">Tenant Split</div>
        <div className="eb-report-table-wrap">
          <table className="eb-report-table">
            <thead>
              <tr>
                <th>Tenant</th>
                <th>Check-In</th>
                <th>Check-Out</th>
                <th>Units</th>
                <th>Share %</th>
                <th>Charge</th>
                <th>Occupancy</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {record.tenants.length === 0 ? (
                <tr>
                  <td colSpan={8} className="no-tenant-row">Vacant room - no tenant split available.</td>
                </tr>
              ) : (
                record.tenants.map((tenant) => (
                  <tr key={tenant.tenantChargeId}>
                    <td>{tenant.tenantName}</td>
                    <td>{formatDate(tenant.checkInDate)}</td>
                    <td>{formatDate(tenant.checkOutDate)}</td>
                    <td>{Number(tenant.splitUnits || 0).toFixed(2)}</td>
                    <td>{Number(tenant.splitPercentage || 0).toFixed(2)}%</td>
                    <td>₹{Number(tenant.splitCharge || 0).toFixed(2)}</td>
                    <td>{tenant.occupancyDaysInMonth}/{tenant.totalDaysInMonth}</td>
                    <td>{tenant.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="eb-report-section">
      <div className="eb-report-header">
        <h3>Room-Wise Monthly EB Report</h3>
        <div className="eb-report-filters">
          <label>Room:</label>
          <select
            value={selectedRoomId}
            onChange={(e) => setSelectedRoomId(parseInt(e.target.value, 10) || 0)}
          >
            <option value={0}>All Rooms</option>
            {roomOptions.map((room) => (
              <option key={room.id} value={room.id}>
                Room {room.number}
              </option>
            ))}
          </select>
          <button type="button" onClick={fetchReport} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && <div className="message error">{error}</div>}

      {loading ? (
        <div className="eb-report-loading">Loading monthly report...</div>
      ) : records.length === 0 ? (
        <div className="eb-report-empty">No monthly EB records found for this selection.</div>
      ) : (
        <div className="eb-report-list">
          {categorizedRecords.shop.length > 0 && (
            <div className="eb-report-category-section">
              <div className="eb-report-category-header eb-report-category-header-shop">
                Shop Rooms ({categorizedRecords.shop.length})
              </div>
              <div className="eb-report-category-list">
                {categorizedRecords.shop.map((record) => renderRecordCard(record, true))}
              </div>
            </div>
          )}

          {categorizedRecords.residential.length > 0 && (
            <div className="eb-report-category-section">
              <div className="eb-report-category-header eb-report-category-header-residential">
                Residential Rooms ({categorizedRecords.residential.length})
              </div>
              <div className="eb-report-category-list">
                {categorizedRecords.residential.map((record) => renderRecordCard(record, false))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
