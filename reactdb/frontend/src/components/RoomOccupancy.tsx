import { useState, useEffect, useMemo } from 'react';
import { apiService, getRoomOccupancyData } from '../api';
import SearchableDropdown from './SearchableDropdown';
import './RoomOccupancy.css';

interface OccupancyData {
  roomId: number;
  roomNumber: string;
  roomRent: number;
  beds: number;
  isOccupied: boolean;
  tenantName?: string;
  tenantPhone?: string;
  checkInDate?: string;
  checkOutDate?: string | null;
  lastCheckOutDate?: string | null;
  currentRentReceived?: number;
  lastPaymentDate?: string;
}

interface MonthlyPaymentRecord {
  roomNumber: string;
  proRataRent: number;
  rentBalance: number;
  rentReceived?: number;
}

interface YearlyVacancyRow {
  roomId: number;
  roomNumber: string;
  occupiedMonths: number;
  vacantMonths: number;
  occupiedDays: number;
  vacantDays: number;
}

interface RevenueChartPoint {
  roomId: number;
  roomNumber: string;
  expected: number;
  received: number;
  pending: number;
  isOccupied: boolean;
}

interface RevenuePieSlice {
  label: string;
  value: number;
  percentage: number;
  color: string;
  startAngle: number;
  endAngle: number;
}

interface RoomOccupancyProps {
  mode?: 'occupancy' | 'analysis';
}

const REVENUE_PIE_COLORS = [
  '#0f766e', '#2563eb', '#ea580c', '#7c3aed', '#0ea5e9', '#dc2626',
  '#ca8a04', '#0891b2', '#4f46e5', '#16a34a', '#64748b'
];

const normalizeRoomKey = (value: string | number | null | undefined): string =>
  String(value ?? '')
    .trim()
    .replace(/^room\s+/i, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();

const getYearMonthKeys = (year: number, currentYear: number, currentMonth: number): string[] => {
  const endMonth = year === currentYear ? currentMonth : 12;
  return Array.from({ length: endMonth }, (_, index) =>
    `${year}-${String(index + 1).padStart(2, '0')}`
  );
};

const getAllYearMonthKeys = (year: number): string[] =>
  Array.from({ length: 12 }, (_, index) =>
    `${year}-${String(index + 1).padStart(2, '0')}`
  );

const getRevenueMonthsByFilter = (
  selectedYear: number,
  currentYear: number,
  currentMonth: number
): string[] => {
  if (!Number.isFinite(selectedYear)) {
    return [];
  }

  return getYearMonthKeys(selectedYear, currentYear, currentMonth);
};

const getEffectiveDaysInMonth = (
  year: number,
  month: number,
  currentYear: number,
  currentMonth: number,
  currentDay: number
): number => {
  if (year === currentYear && month === currentMonth) {
    return currentDay;
  }
  return new Date(year, month, 0).getDate();
};

const getEffectiveDaysInYear = (
  year: number,
  currentYear: number,
  currentMonth: number,
  currentDay: number
): number => {
  const endMonth = year === currentYear ? currentMonth : 12;
  return Array.from({ length: endMonth }, (_, index) =>
    getEffectiveDaysInMonth(year, index + 1, currentYear, currentMonth, currentDay)
  ).reduce((sum, days) => sum + days, 0);
};

export default function RoomOccupancy({ mode = 'occupancy' }: RoomOccupancyProps): JSX.Element {
  const isAnalysisMode = mode === 'analysis';
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();
  const [rooms, setRooms] = useState<OccupancyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterOccupancy, setFilterOccupancy] = useState<'all' | 'occupied' | 'vacant'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoom, setSelectedRoom] = useState('');
  const [expandedRooms, setExpandedRooms] = useState<Set<number>>(new Set());
  const [showStatsGrid, setShowStatsGrid] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [showRevenueChart, setShowRevenueChart] = useState(false);
  const [showVacancyChart, setShowVacancyChart] = useState(false);

  const [showVacancyFullscreen, setShowVacancyFullscreen] = useState(false);
  const [selectedRevenueYear, setSelectedRevenueYear] = useState<number>(new Date().getFullYear());
  const [selectedRevenueRoom, setSelectedRevenueRoom] = useState<string>('');
  const [yearlyRevenueRecords, setYearlyRevenueRecords] = useState<MonthlyPaymentRecord[]>([]);
  const [yearlyRevenueLoading, setYearlyRevenueLoading] = useState(false);
  const [yearlyRevenueError, setYearlyRevenueError] = useState<string | null>(null);
  const [selectedPieYear, setSelectedPieYear] = useState<number>(new Date().getFullYear());
  const [selectedPieRoom, setSelectedPieRoom] = useState<string>('');
  const [yearlyPieRevenueRecords, setYearlyPieRevenueRecords] = useState<MonthlyPaymentRecord[]>([]);
  const [yearlyPieRevenueLoading, setYearlyPieRevenueLoading] = useState(false);
  const [yearlyPieRevenueError, setYearlyPieRevenueError] = useState<string | null>(null);
  const [selectedVacancyYear, setSelectedVacancyYear] = useState<number>(new Date().getFullYear());
  const [selectedVacancyRoom, setSelectedVacancyRoom] = useState<string>('');
  const [yearlyVacancyRows, setYearlyVacancyRows] = useState<YearlyVacancyRow[]>([]);
  const [yearlyVacancyLoading, setYearlyVacancyLoading] = useState(false);
  const [yearlyVacancyError, setYearlyVacancyError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRoomData = async () => {
      try {
        setLoading(true);
        const data = await getRoomOccupancyData();
        setRooms(data || []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load room occupancy data');
      } finally {
        setLoading(false);
      }
    };

    fetchRoomData();
  }, []);

  useEffect(() => {
    const fetchYearlyRevenue = async () => {
      if (!isAnalysisMode) {
        setYearlyRevenueRecords([]);
        return;
      }

      try {
        setYearlyRevenueLoading(true);
        setYearlyRevenueError(null);

        const months = getRevenueMonthsByFilter(selectedRevenueYear, currentYear, currentMonth);

        if (!months.length) {
          setYearlyRevenueRecords([]);
          return;
        }

        const monthlyResponses = await Promise.all(
          months.map((month) => apiService.getPaymentsByMonth(month))
        );

        const records = monthlyResponses.flatMap((response) =>
          ((response.data || []) as MonthlyPaymentRecord[])
        );

        setYearlyRevenueRecords(records);
      } catch {
        setYearlyRevenueError('Failed to load yearly room revenue data.');
        setYearlyRevenueRecords([]);
      } finally {
        setYearlyRevenueLoading(false);
      }
    };

    fetchYearlyRevenue();
  }, [isAnalysisMode, selectedRevenueYear, currentMonth, currentYear]);

  useEffect(() => {
    const fetchYearlyVacancy = async () => {
      if (!isAnalysisMode) {
        setYearlyVacancyRows([]);
        return;
      }

      try {
        setYearlyVacancyLoading(true);
        setYearlyVacancyError(null);

        const months = getYearMonthKeys(selectedVacancyYear, currentYear, currentMonth);

        const monthlyResponses = await Promise.all(
          months.map((month) => apiService.getPaymentsByMonth(month))
        );

        const occupiedRoomsByMonth = monthlyResponses.map((response) => {
          const records = (response.data || []) as MonthlyPaymentRecord[];
          return new Set(
            records
              .map((record) => normalizeRoomKey(record.roomNumber))
              .filter((roomNumber) => roomNumber.length > 0)
          );
        }).map((occupiedSet, index) => {
          const month = Number(months[index].split('-')[1]);
          const daysInMonth = getEffectiveDaysInMonth(
            selectedVacancyYear,
            month,
            currentYear,
            currentMonth,
            currentDay
          );
          return { occupiedSet, daysInMonth };
        });

        const rows = [...rooms]
          .sort((left, right) => compareRoomNumbers(String(left.roomNumber || ''), String(right.roomNumber || '')))
          .map((room) => {
            const roomNumber = String(room.roomNumber || room.roomId).trim();
            const normalizedRoomKey = normalizeRoomKey(room.roomNumber || room.roomId);
            const occupiedMonths = occupiedRoomsByMonth.reduce(
              (sum, monthData) => sum + (monthData.occupiedSet.has(normalizedRoomKey) ? 1 : 0),
              0
            );

            const occupiedDays = occupiedRoomsByMonth.reduce(
              (sum, monthData) => sum + (monthData.occupiedSet.has(normalizedRoomKey) ? monthData.daysInMonth : 0),
              0
            );

            const vacantDays = occupiedRoomsByMonth.reduce(
              (sum, monthData) => sum + (monthData.occupiedSet.has(normalizedRoomKey) ? 0 : monthData.daysInMonth),
              0
            );

            return {
              roomId: room.roomId,
              roomNumber,
              occupiedMonths,
              vacantMonths: Math.max(0, months.length - occupiedMonths),
              occupiedDays,
              vacantDays
            };
          });

        setYearlyVacancyRows(rows);
      } catch {
        setYearlyVacancyError('Failed to load yearly vacancy data.');
        setYearlyVacancyRows([]);
      } finally {
        setYearlyVacancyLoading(false);
      }
    };

    fetchYearlyVacancy();
  }, [isAnalysisMode, rooms, selectedVacancyYear, currentDay, currentMonth, currentYear]);

  useEffect(() => {
    const fetchYearlyPieRevenue = async () => {
      if (!isAnalysisMode) {
        setYearlyPieRevenueRecords([]);
        return;
      }

      try {
        setYearlyPieRevenueLoading(true);
        setYearlyPieRevenueError(null);

        const months = getAllYearMonthKeys(selectedPieYear);

        const monthlyResponses = await Promise.all(
          months.map((month) => apiService.getPaymentsByMonth(month))
        );

        const records = monthlyResponses.flatMap((response) =>
          ((response.data || []) as MonthlyPaymentRecord[])
        );

        setYearlyPieRevenueRecords(records);
      } catch {
        setYearlyPieRevenueError('Failed to load yearly room revenue data.');
        setYearlyPieRevenueRecords([]);
      } finally {
        setYearlyPieRevenueLoading(false);
      }
    };

    fetchYearlyPieRevenue();
  }, [isAnalysisMode, selectedPieYear, currentMonth, currentYear]);

  const compareRoomNumbers = (left: string, right: string): number =>
    left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });

  const stats = useMemo(() => {
    const totalRooms = rooms.length;
    const occupiedRooms = rooms.filter((room) => room.isOccupied).length;
    const vacantRooms = totalRooms - occupiedRooms;
    const totalMonthlyRent = rooms.reduce((sum, room) => sum + (room.roomRent || 0), 0);
    const totalCurrentPayment = rooms.reduce((sum, room) => sum + (room.currentRentReceived || 0), 0);
    const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

    return {
      totalRooms,
      occupiedRooms,
      vacantRooms,
      totalMonthlyRent,
      totalCurrentPayment,
      occupancyRate,
    };
  }, [rooms]);

  const roomOptions = useMemo(() => {
    const unique = new Set<string>();
    rooms.forEach((room) => {
      if (filterOccupancy === 'occupied' && !room.isOccupied) return;
      if (filterOccupancy === 'vacant' && room.isOccupied) return;
      if (room.roomNumber) unique.add(String(room.roomNumber));
    });

    return Array.from(unique)
      .sort(compareRoomNumbers)
      .map((roomNumber) => ({ id: roomNumber, label: `Room ${roomNumber}` }));
  }, [rooms, filterOccupancy]);

  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      if (selectedRoom && String(room.roomNumber || '') !== selectedRoom) return false;
      if (filterOccupancy === 'occupied' && !room.isOccupied) return false;
      if (filterOccupancy === 'vacant' && room.isOccupied) return false;

      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        String(room.roomNumber || '').toLowerCase().includes(term) ||
        String(room.tenantName || '').toLowerCase().includes(term)
      );
    });
  }, [rooms, selectedRoom, filterOccupancy, searchTerm]);

  const sortedFilteredRooms = useMemo(
    () => [...filteredRooms].sort((a, b) => compareRoomNumbers(String(a.roomNumber || ''), String(b.roomNumber || ''))),
    [filteredRooms]
  );

  const revenueChartData = useMemo((): RevenueChartPoint[] => {
    const roomRevenueMap = new Map<string, { expected: number; pending: number; received: number }>();

    yearlyRevenueRecords.forEach((record) => {
      const roomNumber = normalizeRoomKey(record.roomNumber);
      if (!roomNumber) return;

      const expected = Number(record.proRataRent) || 0;
      const pending = Number(record.rentBalance) || 0;
      const receivedFromApi = Number(record.rentReceived);
      const received = Number.isFinite(receivedFromApi)
        ? Math.max(0, receivedFromApi)
        : Math.max(0, expected - pending);

      const existing = roomRevenueMap.get(roomNumber) || { expected: 0, pending: 0, received: 0 };
      existing.expected += expected;
      existing.pending += pending;
      existing.received += received;
      roomRevenueMap.set(roomNumber, existing);
    });

    return [...rooms]
      .sort((left, right) => compareRoomNumbers(String(left.roomNumber || ''), String(right.roomNumber || '')))
      .map((room) => {
        const roomNumber = String(room.roomNumber || room.roomId).trim();
        const roomKey = normalizeRoomKey(room.roomNumber || room.roomId);
        const totals = roomRevenueMap.get(roomKey) || { expected: 0, pending: 0, received: 0 };
        const received = Math.max(0, totals.received);

        return {
          roomId: room.roomId,
          roomNumber,
          expected: Math.max(0, totals.expected),
          received,
          pending: Math.max(0, totals.pending),
          isOccupied: room.isOccupied,
        };
      });
  }, [rooms, yearlyRevenueRecords]);

  const revenueRoomOptions = useMemo(
    () =>
      revenueChartData
        .map((item) => String(item.roomNumber || '').trim())
        .filter((value) => value.length > 0)
        .sort(compareRoomNumbers),
    [revenueChartData]
  );

  const filteredRevenueChartData = useMemo(() => {
    if (!selectedRevenueRoom) return revenueChartData;
    const selectedKey = normalizeRoomKey(selectedRevenueRoom);
    return revenueChartData.filter((item) => normalizeRoomKey(item.roomNumber) === selectedKey);
  }, [revenueChartData, selectedRevenueRoom]);

  const maxRevenueValue = useMemo(
    () => Math.max(1, ...filteredRevenueChartData.map((item) => Math.max(item.expected, item.received))),
    [filteredRevenueChartData]
  );

  const pieRevenueChartData = useMemo((): RevenueChartPoint[] => {
    const roomRevenueMap = new Map<string, { expected: number; pending: number; received: number }>();

    yearlyPieRevenueRecords.forEach((record) => {
      const roomNumber = normalizeRoomKey(record.roomNumber);
      if (!roomNumber) return;

      const expected = Number(record.proRataRent) || 0;
      const pending = Number(record.rentBalance) || 0;
      const receivedFromApi = Number(record.rentReceived);
      const received = Number.isFinite(receivedFromApi)
        ? Math.max(0, receivedFromApi)
        : Math.max(0, expected - pending);

      const existing = roomRevenueMap.get(roomNumber) || { expected: 0, pending: 0, received: 0 };
      existing.expected += expected;
      existing.pending += pending;
      existing.received += received;
      roomRevenueMap.set(roomNumber, existing);
    });

    return [...rooms]
      .sort((left, right) => compareRoomNumbers(String(left.roomNumber || ''), String(right.roomNumber || '')))
      .map((room) => {
        const roomNumber = String(room.roomNumber || room.roomId).trim();
        const roomKey = normalizeRoomKey(room.roomNumber || room.roomId);
        const totals = roomRevenueMap.get(roomKey) || { expected: 0, pending: 0, received: 0 };
        const received = Math.max(0, totals.received);

        return {
          roomId: room.roomId,
          roomNumber,
          expected: Math.max(0, totals.expected),
          received,
          pending: Math.max(0, totals.pending),
          isOccupied: room.isOccupied,
        };
      });
  }, [rooms, yearlyPieRevenueRecords]);

  const pieRevenueRoomOptions = useMemo(
    () =>
      pieRevenueChartData
        .map((item) => String(item.roomNumber || '').trim())
        .filter((value) => value.length > 0)
        .sort(compareRoomNumbers),
    [pieRevenueChartData]
  );

  const filteredPieRevenueChartData = useMemo(() => {
    if (!selectedPieRoom) return pieRevenueChartData;
    const selectedKey = normalizeRoomKey(selectedPieRoom);
    return pieRevenueChartData.filter((item) => normalizeRoomKey(item.roomNumber) === selectedKey);
  }, [pieRevenueChartData, selectedPieRoom]);

  const pieRevenueSlices = useMemo((): RevenuePieSlice[] => {
    const source = filteredPieRevenueChartData
      .map((item) => ({ label: `Room ${item.roomNumber}`, value: item.received, roomNumber: item.roomNumber }))
      .filter((item) => item.value > 0)
      .sort((a, b) => {
        // Extract numeric part for natural room order
        const numA = parseInt(String(a.roomNumber).replace(/\D/g, ''));
        const numB = parseInt(String(b.roomNumber).replace(/\D/g, ''));
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return String(a.roomNumber).localeCompare(String(b.roomNumber), undefined, { numeric: true, sensitivity: 'base' });
      });

    if (!source.length) return [];

    // Show all rooms, do not group into 'Others'
    const merged = source;
    const total = merged.reduce((sum, item) => sum + item.value, 0);
    let angle = -90;

    return merged.map((item, index) => {
      const percentage = (item.value / total) * 100;
      const sweep = (percentage / 100) * 360;
      const slice: RevenuePieSlice = {
        label: item.label,
        value: item.value,
        percentage,
        color: REVENUE_PIE_COLORS[index % REVENUE_PIE_COLORS.length],
        startAngle: angle,
        endAngle: angle + sweep,
      };
      angle += sweep;
      return slice;
    });
  }, [filteredPieRevenueChartData]);

  const pieRevenueTotal = useMemo(() => pieRevenueSlices.reduce((sum, slice) => sum + slice.value, 0), [pieRevenueSlices]);

  const vacancyRoomOptions = useMemo(
    () =>
      yearlyVacancyRows
        .map((row) => String(row.roomNumber || '').trim())
        .filter((value) => value.length > 0)
        .sort(compareRoomNumbers),
    [yearlyVacancyRows]
  );

  const filteredYearlyVacancyRows = useMemo(() => {
    if (!selectedVacancyRoom) return yearlyVacancyRows;
    const selectedKey = normalizeRoomKey(selectedVacancyRoom);
    return yearlyVacancyRows.filter((row) => normalizeRoomKey(row.roomNumber) === selectedKey);
  }, [yearlyVacancyRows, selectedVacancyRoom]);

  const vacancyYearSummary = useMemo(() => {
    const roomCount = Math.max(1, filteredYearlyVacancyRows.length);
    const totalDaysInYear = getEffectiveDaysInYear(selectedVacancyYear, currentYear, currentMonth, currentDay);
    const totalRoomDays = roomCount * totalDaysInYear;
    const occupiedRoomMonths = filteredYearlyVacancyRows.reduce((sum, row) => sum + row.occupiedMonths, 0);
    const vacantRoomMonths = filteredYearlyVacancyRows.reduce((sum, row) => sum + row.vacantMonths, 0);
    const occupiedRoomDays = filteredYearlyVacancyRows.reduce((sum, row) => sum + row.occupiedDays, 0);
    const vacantRoomDays = filteredYearlyVacancyRows.reduce((sum, row) => sum + row.vacantDays, 0);
    const occupancyRate = Math.round((occupiedRoomDays / Math.max(1, totalRoomDays)) * 100);
    const maxVacantDays = Math.max(1, ...filteredYearlyVacancyRows.map((row) => row.vacantDays));

    return {
      occupiedRoomMonths,
      vacantRoomMonths,
      occupiedRoomDays,
      vacantRoomDays,
      occupancyRate,
      maxVacantDays
    };
  }, [filteredYearlyVacancyRows, selectedVacancyYear, currentDay, currentMonth, currentYear]);

  const revenueYearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, index) => currentYear - index);
  }, []);

  const formatCurrency = (value: number): string =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value || 0);

  const formatDate = (value?: string | null): string =>
    value
      ? new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
      : 'N/A';

  const calculateOccupancyAging = (checkInDate?: string): string => {
    if (!checkInDate) return 'N/A';
    const checkIn = new Date(checkInDate);
    const today = new Date();
    checkIn.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const days = Math.floor((today.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
    if (days <= 0) return 'Today';
    if (days === 1) return '1 day';
    if (days < 30) return `${days} days`;
    if (days < 365) return `${Math.floor(days / 30)} months`;
    return `${Math.floor(days / 365)} years`;
  };

  function getVacancyAgingDays(checkOutDate?: string | null): number {
    if (!checkOutDate) return 0;
    const checkOut = new Date(checkOutDate);
    const today = new Date();
    checkOut.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return Math.max(0, Math.floor((today.getTime() - checkOut.getTime()) / (1000 * 60 * 60 * 24)));
  }

  const calculateVacancyAging = (checkOutDate?: string | null): string => {
    const days = getVacancyAgingDays(checkOutDate);
    if (!checkOutDate) return 'N/A';
    if (days === 0) return 'Today';
    if (days === 1) return '1 day';
    if (days < 30) return `${days} days`;
    return `${Math.floor(days / 30)} months`;
  };

  const getOccupancyStatus = (checkOutDate?: string | null): string => {
    if (!checkOutDate) return 'Active';
    const checkOut = new Date(checkOutDate);
    const today = new Date();
    checkOut.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return checkOut > today ? 'Active' : 'Ended';
  };

  const toggleRoomExpanded = (roomId: number) => {
    setExpandedRooms((prev) => {
      const next = new Set(prev);
      if (next.has(roomId)) next.delete(roomId);
      else next.add(roomId);
      return next;
    });
  };

  const polarToCartesian = (centerX: number, centerY: number, radius: number, angleDeg: number) => {
    const angleRad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: centerX + radius * Math.cos(angleRad), y: centerY + radius * Math.sin(angleRad) };
  };

  const describePieArc = (centerX: number, centerY: number, radius: number, startAngle: number, endAngle: number) => {
    const start = polarToCartesian(centerX, centerY, radius, endAngle);
    const end = polarToCartesian(centerX, centerY, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
    return `M ${centerX} ${centerY} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
  };

  if (loading) {
    return (
      <div className="occupancy-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading room occupancy data...</p>
        </div>
      </div>
    );
  }

  const occupancyDonutDegrees = Math.round((vacancyYearSummary.occupancyRate / 100) * 360);

  return (
    <div className="occupancy-container">
      <h2 className="section-heading">{isAnalysisMode ? 'Room Wise Analysis' : 'Room Occupancy'}</h2>

      {error && (
        <div className="error-card">
          <span>❌</span>
          <div>
            <strong>Error</strong>
            <p>{error}</p>
          </div>
        </div>
      )}

      <div className="section-header">
        <h2>Statistics</h2>
        <button className={`toggle-btn ${showStatsGrid ? 'expanded' : 'collapsed'}`} onClick={() => setShowStatsGrid(!showStatsGrid)}>
          {showStatsGrid ? '▼' : '▶'}
        </button>
      </div>

      <div className={`collapsible-content ${showStatsGrid ? 'open' : 'closed'}`}>
        <div className="stats-grid">
          <div className="stat-card total"><div className="stat-icon">🔑</div><div className="stat-content"><h3>Total Rooms</h3><p className="stat-value">{stats.totalRooms}</p></div></div>
          <div className="stat-card occupied"><div className="stat-icon">👥</div><div className="stat-content"><h3>Occupied</h3><p className="stat-value">{stats.occupiedRooms}</p><span className="stat-percentage">{stats.occupancyRate}%</span></div></div>
          <div className="stat-card vacant"><div className="stat-icon">🏡</div><div className="stat-content"><h3>Vacant</h3><p className="stat-value">{stats.vacantRooms}</p></div></div>
          <div className="stat-card revenue"><div className="stat-icon">💰</div><div className="stat-content"><h3>Total Monthly Rent</h3><p className="stat-value">{formatCurrency(stats.totalMonthlyRent)}</p></div></div>
          <div className="stat-card collected"><div className="stat-icon">✓</div><div className="stat-content"><h3>Collected This Month</h3><p className="stat-value">{formatCurrency(stats.totalCurrentPayment)}</p></div></div>
          <div className="stat-card pending"><div className="stat-icon">⏳</div><div className="stat-content"><h3>Pending Payment</h3><p className="stat-value">{formatCurrency(stats.totalMonthlyRent - stats.totalCurrentPayment)}</p></div></div>
        </div>
      </div>

      {isAnalysisMode ? (
        <>
          <div className="section-header"><h2>Room Analytics</h2></div>

          <section className="analytics-card">
            <div className="analytics-card-header">
              <div className="analytics-header-row">
                <div>
                  <h3>Room-Wise Revenue Pie Chart ({selectedPieYear})</h3>
                  <p>Revenue share distribution across rooms</p>
                </div>
                <div className="revenue-year-selector">
                  <label htmlFor="pieYear">Year</label>
                  <select id="pieYear" value={selectedPieYear} onChange={(e) => setSelectedPieYear(Number(e.target.value))}>
                    {revenueYearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
                  </select>
                </div>
                <div className="revenue-year-selector">
                  <label htmlFor="pieRoomFilter">Room</label>
                  <select id="pieRoomFilter" value={selectedPieRoom} onChange={(e) => setSelectedPieRoom(e.target.value)}>
                    <option value="">All Rooms</option>
                    {pieRevenueRoomOptions.map((roomNumber) => (
                      <option key={roomNumber} value={roomNumber}>Room {roomNumber}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {yearlyPieRevenueLoading ? (
              <div className="chart-info-state">Loading yearly room revenue...</div>
            ) : yearlyPieRevenueError ? (
              <div className="chart-info-state error">{yearlyPieRevenueError}</div>
            ) : pieRevenueSlices.length > 0 ? (
              <div className="revenue-pie-section">
                <div className="revenue-pie-layout">
                  <div className="revenue-pie-wrap">
                    <svg viewBox="0 0 240 240" className="revenue-pie-svg">
                      {pieRevenueSlices.map((slice) => (
                        <path key={slice.label} d={describePieArc(120, 120, 98, slice.startAngle, slice.endAngle)} fill={slice.color} stroke="#ffffff" strokeWidth="1.5" />
                      ))}
                      <circle cx="120" cy="120" r="52" fill="#ffffff" />
                      <text x="120" y="112" textAnchor="middle" className="pie-total-label">Total</text>
                      <text x="120" y="133" textAnchor="middle" className="pie-total-value">{formatCurrency(pieRevenueTotal)}</text>
                    </svg>
                  </div>
                  <div className="revenue-pie-legend">
                    {pieRevenueSlices.map((slice) => (
                      <div key={slice.label} className="revenue-pie-legend-item">
                        <span className="pie-color-dot" style={{ backgroundColor: slice.color }} />
                        <span className="pie-room-label">{slice.label}</span>
                        <span className="pie-room-value">{formatCurrency(slice.value)}</span>
                        <span className="pie-room-share">{slice.percentage.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="chart-info-state">No revenue data available for the selected filters.</div>
            )}
          </section>

          <div className="analytics-grid">
            <section className="analytics-card">
              <div className="analytics-card-header">
                <div className="analytics-header-row">
                  <div>
                    <h3>Room-Wise Revenue Chart</h3>
                    <p>Total expected vs received rent for all months in {selectedRevenueYear}</p>
                  </div>
                  <div className="revenue-year-selector">
                    <label htmlFor="revenueYear">Year</label>
                    <select id="revenueYear" value={selectedRevenueYear} onChange={(e) => setSelectedRevenueYear(Number(e.target.value))}>
                      {revenueYearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
                    </select>
                  </div>
                  <div className="revenue-year-selector">
                    <label htmlFor="revenueRoomFilter">Room</label>
                    <select id="revenueRoomFilter" value={selectedRevenueRoom} onChange={(e) => setSelectedRevenueRoom(e.target.value)}>
                      <option value="">All Rooms</option>
                      {revenueRoomOptions.map((roomNumber) => (
                        <option key={roomNumber} value={roomNumber}>Room {roomNumber}</option>
                      ))}
                    </select>
                  </div>
                  <button className="fullscreen-btn" onClick={() => setShowRevenueChart((prev) => !prev)}>
                    {showRevenueChart ? 'Hide Chart' : 'Show Chart'}
                  </button>
                </div>
              </div>

              {showRevenueChart && (
                <>
                  {yearlyRevenueLoading ? (
                    <div className="chart-info-state">Loading yearly room revenue...</div>
                  ) : yearlyRevenueError ? (
                    <div className="chart-info-state error">{yearlyRevenueError}</div>
                  ) : (
                    <div className="revenue-chart-scroll">
                      <div className="revenue-chart-canvas">
                        {filteredRevenueChartData.map((item) => {
                          const expectedWidth = Math.max(6, (item.expected / maxRevenueValue) * 100);
                          const receivedWidth = Math.max(4, (item.received / maxRevenueValue) * 100);
                          const collectionRate = item.expected > 0 ? Math.round((item.received / item.expected) * 100) : 0;

                          // Find the room to get lastCheckOutDate
                          const room = rooms.find(r => r.roomId === item.roomId);
                          const lastCheckOutDate = room?.lastCheckOutDate;

                          return (
                            <div key={item.roomId} className="revenue-row">
                              <div className="revenue-room-meta">
                                <span className="room-pill">Room {item.roomNumber}</span>
                                <span className={`room-state ${item.isOccupied ? 'occupied' : 'vacant'}`}>{item.isOccupied ? 'Occupied' : 'Vacant'}</span>
                                {!item.isOccupied && lastCheckOutDate && (
                                  <span className="last-checkout-date">Last Checkout: {formatDate(lastCheckOutDate)}</span>
                                )}
                              </div>
                              <div className="revenue-bars">
                                <div className="bar-track expected-track"><div className="bar-fill expected-fill" style={{ width: `${expectedWidth}%` }} /></div>
                                <div className="bar-track received-track"><div className="bar-fill received-fill" style={{ width: `${receivedWidth}%` }} /></div>
                              </div>
                              <div className="revenue-amounts">
                                <span>Expected {formatCurrency(item.expected)}</span>
                                <span>Received {formatCurrency(item.received)}</span>
                                <span className={item.pending > 0 ? 'pending-amount' : 'clear-amount'}>Pending {formatCurrency(item.pending)}</span>
                                <span className="collection-rate">{collectionRate}% Collected</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="chart-legend">
                    <span><i className="legend-dot expected-dot" />Expected Rent</span>
                    <span><i className="legend-dot received-dot" />Received Rent</span>
                  </div>
                </>
              )}
            </section>

            <section className="analytics-card">
              <div className="analytics-card-header">
                <div className="analytics-header-row">
                  <div>
                    <h3>Vacancy-Wise Chart (All Rooms)</h3>
                    <p>Year-wise room vacancy distribution for {selectedVacancyYear}</p>
                  </div>
                  <div className="revenue-year-selector">
                    <label htmlFor="vacancyYear">Year</label>
                    <select id="vacancyYear" value={selectedVacancyYear} onChange={(e) => setSelectedVacancyYear(Number(e.target.value))}>
                      {revenueYearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
                    </select>
                  </div>
                  <div className="revenue-year-selector">
                    <label htmlFor="vacancyRoomFilter">Room</label>
                    <select id="vacancyRoomFilter" value={selectedVacancyRoom} onChange={(e) => setSelectedVacancyRoom(e.target.value)}>
                      <option value="">All Rooms</option>
                      {vacancyRoomOptions.map((roomNumber) => (
                        <option key={roomNumber} value={roomNumber}>Room {roomNumber}</option>
                      ))}
                    </select>
                  </div>
                  <button className="fullscreen-btn" onClick={() => setShowVacancyChart((prev) => !prev)}>
                    {showVacancyChart ? 'Hide Chart' : 'Show Chart'}
                  </button>
                  <button className="fullscreen-btn" onClick={() => setShowVacancyFullscreen(true)}>Full Screen</button>
                </div>
              </div>

              {showVacancyChart && (
                <>
                  {yearlyVacancyLoading ? (
                    <div className="chart-info-state">Loading yearly vacancy data...</div>
                  ) : yearlyVacancyError ? (
                    <div className="chart-info-state error">{yearlyVacancyError}</div>
                  ) : (
                    <>
                      <div className="vacancy-overview">
                        <div className="vacancy-donut" style={{ background: `conic-gradient(#0f766e 0deg ${occupancyDonutDegrees}deg, #b45309 ${occupancyDonutDegrees}deg 360deg)` }}>
                          <div className="vacancy-donut-center"><strong>{vacancyYearSummary.occupancyRate}%</strong><span>Occupied</span></div>
                        </div>
                        <div className="vacancy-summary">
                          <div><strong>{vacancyYearSummary.occupiedRoomDays}</strong><span>Occupied Days</span></div>
                          <div><strong>{vacancyYearSummary.vacantRoomDays}</strong><span>Vacant Days</span></div>
                          <div><strong>{filteredYearlyVacancyRows.length}</strong><span>Total Rooms</span></div>
                        </div>
                      </div>

                      <div className="vacancy-list">
                        {filteredYearlyVacancyRows.map((item) => {
                          const width = Math.max(6, (item.vacantDays / vacancyYearSummary.maxVacantDays) * 100);
                          // Find the room in the main rooms array to check current vacancy
                          const room = rooms.find(r => r.roomId === item.roomId);
                          const isCurrentlyVacant = room && !room.isOccupied;
                          return (
                            <div
                              key={item.roomId}
                              className={`vacancy-row${isCurrentlyVacant ? ' currently-vacant' : ''}`}
                              style={isCurrentlyVacant ? { border: '2px solid #2563eb', borderRadius: '10px' } : {}}
                            >
                              <div className="vacancy-room">
                                Room {item.roomNumber}
                                {/* Visual highlight only, no badge text */}
                              </div>
                              <div className="vacancy-track"><div className={`vacancy-fill ${item.vacantDays === 0 ? 'occupied' : 'vacant'}`} style={{ width: `${width}%` }} /></div>
                              <div className="vacancy-value">{item.vacantDays} vacant / {item.occupiedDays} occupied days</div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="chart-legend">
                        <span><i className="legend-dot occupied-dot" />No vacancy days</span>
                        <span><i className="legend-dot vacant-dot" />Vacancy days</span>
                      </div>
                    </>
                  )}
                </>
              )}
            </section>
          </div>

          {showVacancyFullscreen && (
            <div className="fullscreen-overlay" role="dialog" aria-modal="true">
              <div className="fullscreen-content">
                <div className="fullscreen-header">
                  <div><h2>Vacancy-Wise Chart (All Rooms)</h2><p>Full-screen view for room-level vacancy tracking</p></div>
                  <button className="fullscreen-close-btn" onClick={() => setShowVacancyFullscreen(false)}>Close</button>
                </div>
                <div className="fullscreen-vacancy-body">
                  {yearlyVacancyLoading ? (
                    <div className="chart-info-state">Loading yearly vacancy data...</div>
                  ) : yearlyVacancyError ? (
                    <div className="chart-info-state error">{yearlyVacancyError}</div>
                  ) : (
                    <div className="vacancy-list">
                      {filteredYearlyVacancyRows.map((item) => {
                        const width = Math.max(6, (item.vacantDays / vacancyYearSummary.maxVacantDays) * 100);
                        return (
                          <div key={item.roomId} className="vacancy-row">
                            <div className="vacancy-room">Room {item.roomNumber}</div>
                            <div className="vacancy-track"><div className={`vacancy-fill ${item.vacantDays === 0 ? 'occupied' : 'vacant'}`} style={{ width: `${width}%` }} /></div>
                            <div className="vacancy-value">{item.vacantDays} vacant / {item.occupiedDays} occupied days</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="section-header">
            <h2>Filters & Search</h2>
            <button className={`toggle-btn ${showFilters ? 'expanded' : 'collapsed'}`} onClick={() => setShowFilters(!showFilters)}>
              {showFilters ? '▼' : '▶'}
            </button>
          </div>

          <div className={`collapsible-content ${showFilters ? 'open' : 'closed'}`}>
            <div className="filters-section">
              <div className="filter-group">
                <input type="text" placeholder="Search by room number or tenant name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="search-input" />
              </div>
              <div className="filter-buttons">
                <button className={`filter-btn ${filterOccupancy === 'all' ? 'active' : ''}`} onClick={() => setFilterOccupancy('all')}>All Rooms ({rooms.length})</button>
                <button className={`filter-btn ${filterOccupancy === 'occupied' ? 'active' : ''}`} onClick={() => setFilterOccupancy('occupied')}>Occupied ({stats.occupiedRooms})</button>
                <button className={`filter-btn ${filterOccupancy === 'vacant' ? 'active' : ''}`} onClick={() => setFilterOccupancy('vacant')}>Vacant ({stats.vacantRooms})</button>
              </div>
              <div className="room-filter">
                <SearchableDropdown options={roomOptions} value={selectedRoom} onChange={(option) => setSelectedRoom(option.id as string)} placeholder="Filter by Room" />
                {selectedRoom && <button onClick={() => setSelectedRoom('')} className="clear-room-filter">Clear Room Filter</button>}
              </div>
            </div>
          </div>

          <div className="section-header"><h2>Rooms</h2></div>
          <div className="rooms-grid">
            {sortedFilteredRooms.length > 0 ? (
              sortedFilteredRooms.map((room) => (
                <div key={room.roomId} className={`room-card ${room.isOccupied ? 'occupied' : 'vacant'}`}>
                  <div className="room-header">
                    <div>
                      <h3>
                        Room {room.roomNumber}
                        {!room.isOccupied && <span className="room-aging-inline"> • Aging: {calculateVacancyAging(room.lastCheckOutDate)}</span>}
                      </h3>
                      <p className="room-rent">{formatCurrency(room.roomRent || 0)}/month • {room.beds} bed{room.beds > 1 ? 's' : ''}</p>
                    </div>
                    <div className={`occupancy-badge ${room.isOccupied ? 'occupied' : 'vacant'}`}>{room.isOccupied ? '🟢 Occupied' : '🔴 Vacant'}</div>
                    <button className="toggle-room-info-btn" onClick={() => toggleRoomExpanded(room.roomId)}>
                      {expandedRooms.has(room.roomId) ? '−' : '+'}
                    </button>
                  </div>

                  {expandedRooms.has(room.roomId) && (
                    room.isOccupied && room.tenantName ? (
                      <div className="room-tenant-info">
                        <div className="tenant-section">
                          <h4>Tenant Information</h4>
                          <p className="tenant-name">👤 {room.tenantName}</p>
                          <p className="tenant-contact">📱 <a href={`tel:${room.tenantPhone}`}>{room.tenantPhone}</a></p>
                          <p className="check-in">📅 Check-in: {formatDate(room.checkInDate)}</p>
                          <p className="aging-info">⏱️ Occupancy Aging: {calculateOccupancyAging(room.checkInDate)}</p>
                          {room.checkOutDate && <p className="check-out">📅 Check-out: {formatDate(room.checkOutDate)}</p>}
                          <p className={`occupancy-status ${getOccupancyStatus(room.checkOutDate).toLowerCase().replace(/ /g, '-')}`}>Status: {getOccupancyStatus(room.checkOutDate)}</p>
                        </div>
                        <div className="payment-section">
                          <h4>Payment Status</h4>
                          <div className="payment-row"><span>Received:</span><span className="amount received">{formatCurrency(room.currentRentReceived || 0)}</span></div>
                          <div className="payment-row"><span>Pending:</span><span className="amount pending">{formatCurrency((room.roomRent || 0) - (room.currentRentReceived || 0))}</span></div>
                          {room.lastPaymentDate && <p className="last-payment">Last Payment: {formatDate(room.lastPaymentDate)}</p>}
                        </div>
                      </div>
                    ) : (
                      <div className="room-vacant-info">
                        <p className="vacant-message">No tenant assigned</p>
                        <p className="vacant-action">Ready for new occupant</p>
                        <p className="vacancy-aging">⏱️ Vacancy Aging: {calculateVacancyAging(room.lastCheckOutDate)}</p>
                      </div>
                    )
                  )}
                </div>
              ))
            ) : (
              <div className="no-results">
                <p>📭 No rooms found matching your criteria</p>
                <p>Try adjusting your search or filter settings</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
