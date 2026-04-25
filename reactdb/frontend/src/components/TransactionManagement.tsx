import { useState, useEffect, useMemo } from 'react';
import { apiService } from '../api';
import SearchableDropdown from './SearchableDropdown';
import './ManagementStyles.css';

interface Transaction {
  id: number;
  description: string;
  transactionTypeId: number;
  transactionDate: string;
  createdDate: string;
  updatedDate?: string;
  amount: number;
  occupancyId?: number;
  transactionType?: {
    id: number;
    transactionType: string;
  };
}

interface TransactionType {
  id: number;
  transactionType: string;
}

interface ExpensePieSlice {
  label: string;
  value: number;
  color: string;
  percentage: number;
  startAngle: number;
  endAngle: number;
  breakdown?: Array<{ label: string; value: number }>;
}

const EXPENSE_PIE_COLORS = ['#0f766e', '#2563eb', '#dc2626', '#ea580c', '#7c3aed', '#0891b2', '#ca8a04'];

export default function TransactionManagement() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionTypes, setTransactionTypes] = useState<TransactionType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date-desc' | 'amount-desc' | 'amount-asc'>('date-desc');
  const [viewMode, setViewMode] = useState<'list' | 'category'>('category');
  const [selectedExpenseYear, setSelectedExpenseYear] = useState<string>('all');

  const isExpenseType = (transactionType?: string): boolean => {
    const normalized = String(transactionType || '').trim().toLowerCase();
    return normalized.includes('expense') && normalized !== 'cashdep';
  };

  const formatAmount = (value: number, fractionDigits: number = 2): string => {
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits
    }).format(Number(value) || 0);
  };

  // Helper to format date as YYYY-MM-DD using local date (no timezone conversion)
  const formatLocalDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Get current month date range
  const getCurrentMonthDates = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      startDate: formatLocalDate(firstDay),
      endDate: formatLocalDate(lastDay)
    };
  };

  const monthDates = getCurrentMonthDates();
  const [dateRange, setDateRange] = useState({
    startDate: monthDates.startDate,
    endDate: monthDates.endDate
  });

  const [formData, setFormData] = useState({
    description: '',
    transactionTypeId: 0,
    transactionDate: formatLocalDate(new Date()),
    amount: 0,
    occupancyId: ''
  });

  // Fetch transactions
  const fetchTransactions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getTransactions();
      setTransactions(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch transactions');
    } finally {
      setLoading(false);
    }
  };

  // Fetch transaction types
  const fetchTransactionTypes = async () => {
    try {
      const response = await apiService.getTransactionTypes();
      setTransactionTypes(response.data);
    } catch (err) {
      console.error('Failed to fetch transaction types:', err);
    }
  };

  useEffect(() => {
    fetchTransactions();
    fetchTransactionTypes();
  }, []);

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);

      const dataToSubmit = {
        ...formData,
        transactionTypeId: parseInt(formData.transactionTypeId.toString()),
        occupancyId: formData.occupancyId ? parseInt(formData.occupancyId.toString()) : null
      };

      if (editingTransaction) {
        await apiService.updateTransaction(editingTransaction.id, dataToSubmit);
        setSuccessMessage('Transaction updated successfully!');
      } else {
        await apiService.createTransaction(dataToSubmit);
        setSuccessMessage('Transaction created successfully!');
      }

      setShowForm(false);
      setEditingTransaction(null);
      setFormData({
        description: '',
        transactionTypeId: 0,
        transactionDate: formatLocalDate(new Date()),
        amount: 0,
        occupancyId: ''
      });
      fetchTransactions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save transaction');
    } finally {
      setLoading(false);
    }
  };

  // Delete transaction
  const handleDelete = async (id: number) => {
    try {
      setLoading(true);
      await apiService.deleteTransaction(id);
      setSuccessMessage('Transaction deleted successfully!');
      setShowDeleteConfirm(null);
      fetchTransactions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete transaction');
    } finally {
      setLoading(false);
    }
  };

  // Edit transaction
  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setFormData({
      description: transaction.description,
      transactionTypeId: transaction.transactionTypeId,
      transactionDate: transaction.transactionDate.split('T')[0],
      amount: transaction.amount,
      occupancyId: transaction.occupancyId?.toString() || ''
    });
    setShowForm(true);
  };

  // Filter and sort transactions
  const filteredTransactions = transactions.filter(t => {
    const transactionDate = new Date(t.transactionDate);
    const startDate = new Date(dateRange.startDate);
    const endDate = new Date(dateRange.endDate);
    
    return transactionDate >= startDate && 
           transactionDate <= endDate &&
           t.description.toLowerCase().includes(searchQuery.toLowerCase());
  }).sort((a, b) => {
    switch (sortBy) {
      case 'date-desc':
        return new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime();
      case 'amount-desc':
        return b.amount - a.amount;
      case 'amount-asc':
        return a.amount - b.amount;
      default:
        return 0;
    }
  });

  const getCategoryTotalBadgeClassName = (transactionType: string) => {
    const normalizedType = transactionType.trim().toLowerCase();

    if (normalizedType === 'income') {
      return 'stat-badge total income-total';
    }

    if (normalizedType === 'expense') {
      return 'stat-badge total expense-total';
    }

    return 'stat-badge total';
  };

  const yearlyExpenseReport = useMemo(() => {
    const expenseTransactions = transactions.filter((t) => isExpenseType(t.transactionType?.transactionType));
    if (expenseTransactions.length === 0) return [] as Array<{
      year: number;
      periodLabel: string;
      transactionCount: number;
      totalExpense: number;
    }>;

    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const currentYear = today.getFullYear();

    const yearsWithData = expenseTransactions
      .map((t) => new Date(t.transactionDate).getFullYear())
      .filter((year) => !Number.isNaN(year));

    const minYear = Math.min(...yearsWithData);
    const allYears = Array.from({ length: currentYear - minYear + 1 }, (_, index) => currentYear - index);

    return allYears.map((year) => {
      const periodStart = new Date(year, 0, 1, 0, 0, 0, 0);
      const periodEnd = year === currentYear
        ? new Date(today)
        : new Date(year, 11, 31, 23, 59, 59, 999);

      const inPeriod = expenseTransactions.filter((t) => {
        const transactionDate = new Date(t.transactionDate);
        return transactionDate >= periodStart && transactionDate <= periodEnd;
      });

      const totalExpense = inPeriod.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
      const periodLabel = year === currentYear
        ? `Jan 1 - ${today.toLocaleDateString()}`
        : 'Jan 1 - Dec 31';

      return {
        year,
        periodLabel,
        transactionCount: inPeriod.length,
        totalExpense
      };
    });
  }, [transactions]);

  const expenseTransactions = useMemo(
    () => transactions.filter((t) => isExpenseType(t.transactionType?.transactionType)),
    [transactions]
  );

  const expenseYearOptions = useMemo(() => {
    return yearlyExpenseReport.map((row) => String(row.year));
  }, [yearlyExpenseReport]);

  const filteredYearlyExpenseReport = useMemo(() => {
    if (selectedExpenseYear === 'all') return yearlyExpenseReport;
    return yearlyExpenseReport.filter((row) => String(row.year) === selectedExpenseYear);
  }, [yearlyExpenseReport, selectedExpenseYear]);

  const expensePieSlices = useMemo((): ExpensePieSlice[] => {
    const source = filteredYearlyExpenseReport
      .filter((row) => row.totalExpense > 0)
      .map((row) => ({ label: String(row.year), value: row.totalExpense }))
      .sort((left, right) => right.value - left.value);

    if (!source.length) return [];

    const total = source.reduce((sum, item) => sum + item.value, 0);

    let angle = -90;
    return source.map((item, index) => {
      const percentage = (item.value / total) * 100;
      const sweep = (percentage / 100) * 360;
      const slice: ExpensePieSlice = {
        label: item.label,
        value: item.value,
        color: EXPENSE_PIE_COLORS[index % EXPENSE_PIE_COLORS.length],
        percentage,
        startAngle: angle,
        endAngle: angle + sweep
      };
      angle += sweep;
      return slice;
    });
  }, [filteredYearlyExpenseReport]);

  const expensePieTotal = useMemo(
    () => expensePieSlices.reduce((sum, slice) => sum + slice.value, 0),
    [expensePieSlices]
  );

  const yearlyExpenseCategoryCharts = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const currentYear = today.getFullYear();

    return filteredYearlyExpenseReport.map((yearRow) => {
      const year = yearRow.year;
      const periodStart = new Date(year, 0, 1, 0, 0, 0, 0);
      const periodEnd = year === currentYear
        ? new Date(today)
        : new Date(year, 11, 31, 23, 59, 59, 999);

      const categoryMap = new Map<string, number>();

      expenseTransactions.forEach((transaction) => {
        const transactionDate = new Date(transaction.transactionDate);
        if (transactionDate < periodStart || transactionDate > periodEnd) return;

        const category = String(transaction.description || '').trim() || 'Uncategorized';
        categoryMap.set(category, (categoryMap.get(category) || 0) + (Number(transaction.amount) || 0));
      });

      const source = [...categoryMap.entries()]
        .map(([label, value]) => ({ label, value }))
        .filter((item) => item.value > 0)
        .sort((left, right) => right.value - left.value);

      const total = source.reduce((sum, item) => sum + item.value, 0);

      let angle = -90;
      const slices: ExpensePieSlice[] = source.map((item, index) => {
        const percentage = total > 0 ? (item.value / total) * 100 : 0;
        const sweep = (percentage / 100) * 360;
        const slice: ExpensePieSlice = {
          label: item.label,
          value: item.value,
          color: EXPENSE_PIE_COLORS[index % EXPENSE_PIE_COLORS.length],
          percentage,
          startAngle: angle,
          endAngle: angle + sweep
        };
        angle += sweep;
        return slice;
      });

      return {
        year,
        periodLabel: yearRow.periodLabel,
        total,
        slices
      };
    });
  }, [expenseTransactions, filteredYearlyExpenseReport]);

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

  return (
    <div className="management-container transactions-container">
      <h2 className="section-heading">Transactions</h2>
      {error && <div className="error-message">{error}</div>}
      {successMessage && <div className="success-message">{successMessage}</div>}

      <div className="category-section">
        <div className="category-header">
          <h3 className="category-title">Year-Wise Expense Report</h3>
          <div className="category-stats">
            <select
              className="sort-select"
              value={selectedExpenseYear}
              onChange={(e) => setSelectedExpenseYear(e.target.value)}
              aria-label="Filter expense report by year"
            >
              <option value="all">All Years</option>
              {expenseYearOptions.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <span className="stat-badge">Till date for current year</span>
          </div>
        </div>
        {filteredYearlyExpenseReport.length === 0 ? (
          <div className="no-results-message">
            <p>No expense transactions available for report.</p>
          </div>
        ) : (
          <div className="expense-report-content">
            {expensePieSlices.length > 0 && (
              <div className="expense-pie-section">
                <div className="expense-pie-wrap">
                  <svg viewBox="0 0 240 240" className="expense-pie-svg">
                    {expensePieSlices.map((slice) => (
                      <path key={slice.label} d={describePieArc(120, 120, 98, slice.startAngle, slice.endAngle)} fill={slice.color} stroke="#ffffff" strokeWidth="1.5" />
                    ))}
                    <circle cx="120" cy="120" r="52" fill="#ffffff" />
                    <text x="120" y="112" textAnchor="middle" className="expense-pie-total-label">Total</text>
                    <text x="120" y="133" textAnchor="middle" className="expense-pie-total-value">₹{formatAmount(expensePieTotal, 0)}</text>
                  </svg>
                </div>
                <div className="expense-pie-legend">
                  {expensePieSlices.map((slice) => (
                    <div key={slice.label} className="expense-pie-legend-item-wrap">
                      <div className="expense-pie-legend-item">
                        <span className="expense-pie-color-dot" style={{ backgroundColor: slice.color }} />
                        <span className="expense-pie-label">{slice.label}</span>
                        <span className="expense-pie-value">₹{formatAmount(slice.value)}</span>
                        <span className="expense-pie-share">{slice.percentage.toFixed(1)}%</span>
                      </div>
                      {slice.label === 'Others' && slice.breakdown && slice.breakdown.length > 0 && (
                        <div className="expense-pie-others-breakdown">
                          {slice.breakdown.map((item) => (
                            <div key={item.label} className="expense-pie-others-row">
                              <span>{item.label}</span>
                              <span>₹{formatAmount(item.value)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="table-responsive">
              <table className="data-table expense-report-table">
                <thead>
                  <tr>
                    <th>Year</th>
                    <th>Covered Period</th>
                    <th className="text-right">Expense Count</th>
                    <th className="text-right">Total Expense (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredYearlyExpenseReport.map((row) => (
                    <tr key={row.year}>
                      <td>{row.year}</td>
                      <td>{row.periodLabel}</td>
                      <td className="text-right">{row.transactionCount}</td>
                      <td className="text-right">{formatAmount(row.totalExpense)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="expense-category-year-grid">
              {yearlyExpenseCategoryCharts.map((yearChart) => (
                <div key={yearChart.year} className="expense-category-year-card">
                  <div className="expense-category-year-header">
                    <h4>Expense Category Pie - {yearChart.year}</h4>
                    <p>{yearChart.periodLabel}</p>
                  </div>

                  {yearChart.slices.length === 0 ? (
                    <div className="chart-info-state">No expense category data for this year.</div>
                  ) : (
                    <div className="expense-pie-section">
                      <div className="expense-pie-wrap">
                        <svg viewBox="0 0 240 240" className="expense-pie-svg">
                          {yearChart.slices.map((slice) => (
                            <path key={slice.label} d={describePieArc(120, 120, 98, slice.startAngle, slice.endAngle)} fill={slice.color} stroke="#ffffff" strokeWidth="1.5" />
                          ))}
                          <circle cx="120" cy="120" r="52" fill="#ffffff" />
                          <text x="120" y="112" textAnchor="middle" className="expense-pie-total-label">Total</text>
                          <text x="120" y="133" textAnchor="middle" className="expense-pie-total-value">₹{formatAmount(yearChart.total, 0)}</text>
                        </svg>
                      </div>
                      <div className="expense-pie-legend">
                        {yearChart.slices.map((slice) => (
                          <div key={slice.label} className="expense-pie-legend-item-wrap">
                            <div className="expense-pie-legend-item">
                              <span className="expense-pie-color-dot" style={{ backgroundColor: slice.color }} />
                              <span className="expense-pie-label" title={slice.label}>{slice.label}</span>
                              <span className="expense-pie-value">₹{formatAmount(slice.value)}</span>
                              <span className="expense-pie-share">{slice.percentage.toFixed(1)}%</span>
                            </div>
                            {slice.label === 'Others' && slice.breakdown && slice.breakdown.length > 0 && (
                              <div className="expense-pie-others-breakdown">
                                {slice.breakdown.map((item) => (
                                  <div key={item.label} className="expense-pie-others-row">
                                    <span title={item.label}>{item.label}</span>
                                    <span>₹{formatAmount(item.value)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="toolbar">
        <input
          type="text"
          placeholder="Search transactions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
        <div className="date-filter-group">
          <label>From:</label>
          <input
            type="date"
            value={dateRange.startDate}
            onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
            className="date-input"
          />
          <label>To:</label>
          <input
            type="date"
            value={dateRange.endDate}
            onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
            className="date-input"
          />
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => {
              const dates = getCurrentMonthDates();
              setDateRange({ startDate: dates.startDate, endDate: dates.endDate });
            }}
            title="Reset to current month"
          >
            Reset
          </button>
        </div>
        <SearchableDropdown
          value={sortBy}
          onChange={(option) => setSortBy(option.id as any)}
          options={[
            { id: 'date-desc', label: 'Newest First' },
            { id: 'amount-desc', label: 'Highest Amount' },
            { id: 'amount-asc', label: 'Lowest Amount' }
          ]}
          placeholder="Sort by..."
        />
        <div className="view-mode-toggle">
          <button
            className={`btn ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setViewMode('list')}
            title="List view"
          >
            📋 List
          </button>
          <button
            className={`btn ${viewMode === 'category' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setViewMode('category')}
            title="Category-wise view"
          >
            🏷️ Category
          </button>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditingTransaction(null);
            setFormData({
              description: '',
              transactionTypeId: 0,
              transactionDate: formatLocalDate(new Date()),
              amount: 0,
              occupancyId: ''
            });
            setShowForm(true);
          }}
        >
          + Add Transaction
        </button>
      </div>

      {showForm && (
        <div className="form-container">
          <h3>{editingTransaction ? 'Edit Transaction' : 'Add New Transaction'}</h3>
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              placeholder="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
            />
            <SearchableDropdown
              value={formData.transactionTypeId || null}
              onChange={(option) => setFormData({ ...formData, transactionTypeId: option.id as number })}
              options={transactionTypes.map(type => ({ id: type.id, label: type.transactionType }))}
              placeholder="Select Transaction Type"
            />
            <input
              type="date"
              value={formData.transactionDate}
              onChange={(e) => setFormData({ ...formData, transactionDate: e.target.value })}
              required
            />
            <input
              type="number"
              placeholder="Amount"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
              required
            />
            <input
              type="number"
              placeholder="Occupancy ID (optional)"
              value={formData.occupancyId}
              onChange={(e) => setFormData({ ...formData, occupancyId: e.target.value })}
            />
            <div className="form-buttons">
              <button type="submit" className="btn btn-success" disabled={loading}>
                {loading ? 'Saving...' : 'Save Transaction'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="loading-spinner"></div>
      ) : filteredTransactions.length === 0 ? (
        <div className="no-results-message">
          <p>No transactions found.</p>
        </div>
      ) : viewMode === 'list' ? (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Type</th>
                <th>Date</th>
                <th className="text-right">Amount (₹)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((transaction) => (
                <tr key={transaction.id}>
                  <td>{transaction.description}</td>
                  <td>{transaction.transactionType?.transactionType || 'Unknown'}</td>
                  <td>{new Date(transaction.transactionDate).toLocaleDateString()}</td>
                  <td className="text-right">{formatAmount(transaction.amount)}</td>
                  <td className="actions">
                    <button className="btn btn-sm btn-info" onClick={() => handleEdit(transaction)}>
                      Edit
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => setShowDeleteConfirm(transaction.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div>
          {Object.entries(
            filteredTransactions.reduce((groups: { [key: number]: { type: string; transactions: Transaction[]; total: number } }, transaction) => {
              const typeId = transaction.transactionTypeId;
              if (!groups[typeId]) {
                groups[typeId] = {
                  type: transaction.transactionType?.transactionType || 'Unknown',
                  transactions: [],
                  total: 0
                };
              }
              groups[typeId].transactions.push(transaction);
              groups[typeId].total += transaction.amount;
              return groups;
            }, {})
          ).map(([typeId, groupedData]) => (
            <div key={typeId} className="category-section">
              <div className="category-header">
                <h3 className="category-title">
                  💰 {groupedData.type}
                </h3>
                <div className="category-stats">
                  <span className="stat-badge">Count: {groupedData.transactions.length}</span>
                  <span className={getCategoryTotalBadgeClassName(groupedData.type)}>Total: ₹{formatAmount(groupedData.total)}</span>
                </div>
              </div>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th>Date</th>
                      <th className="text-right">Amount (₹)</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedData.transactions.map((transaction) => (
                      <tr key={transaction.id}>
                        <td>{transaction.description}</td>
                        <td>{new Date(transaction.transactionDate).toLocaleDateString()}</td>
                        <td className="text-right">{formatAmount(transaction.amount)}</td>
                        <td className="actions">
                          <button className="btn btn-sm btn-info" onClick={() => handleEdit(transaction)}>
                            Edit
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => setShowDeleteConfirm(transaction.id)}
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
          {filteredTransactions.length > 0 && (
            <div className="net-balance-summary">
              <div className="net-balance-content">
                <span className="net-balance-label">Net Balance (Total Amount):</span>
                <span className="net-balance-value">₹{formatAmount(filteredTransactions.reduce((sum, t) => {
                  const transactionType = t.transactionType?.transactionType;
                  if (transactionType === 'Income') {
                    return sum + t.amount;
                  } else if (transactionType === 'Expense' || transactionType === 'CashDep') {
                    return sum - t.amount;
                  }
                  return sum;
                }, 0))}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {showDeleteConfirm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Confirm Delete</h3>
            <p>Are you sure you want to delete this transaction?</p>
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
