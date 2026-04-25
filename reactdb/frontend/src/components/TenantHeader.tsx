interface TenantHeaderProps {
  totalTenants: number;
  occupiedTenants: number;
  vacantTenants: number;
  onAddTenant: () => void;
  isFormVisible?: boolean;
  occupancyFilter?: 'all' | 'occupied' | 'vacant';
  onOccupancyFilterChange?: (filter: 'all' | 'occupied' | 'vacant') => void;
}

export default function TenantHeader({
  totalTenants,
  occupiedTenants,
  vacantTenants,
  onAddTenant,
  isFormVisible = false,
  occupancyFilter = 'all',
  onOccupancyFilterChange,
}: TenantHeaderProps) {
  const handleStatCardClick = (filter: 'all' | 'occupied' | 'vacant') => {
    if (onOccupancyFilterChange) {
      onOccupancyFilterChange(filter === occupancyFilter ? 'all' : filter);
    }
  };

  return (
    <div className="tenant-header">
      <div className="tenant-stats">
        <div
          className={`stat-card ${occupancyFilter === 'all' ? 'active' : ''}`}
          onClick={() => handleStatCardClick('all')}
          style={{ cursor: 'pointer' }}
        >
          <div className="stat-label">Total Tenants</div>
          <div className="stat-value">{totalTenants}</div>
        </div>
        <div
          className={`stat-card occupied ${occupancyFilter === 'occupied' ? 'active' : ''}`}
          onClick={() => handleStatCardClick('occupied')}
          style={{ cursor: 'pointer' }}
        >
          <div className="stat-label">Occupied Tenants</div>
          <div className="stat-value">{occupiedTenants}</div>
        </div>
        <div
          className={`stat-card vacant ${occupancyFilter === 'vacant' ? 'active' : ''}`}
          onClick={() => handleStatCardClick('vacant')}
          style={{ cursor: 'pointer' }}
        >
          <div className="stat-label">Vacant Tenants</div>
          <div className="stat-value">{vacantTenants}</div>
        </div>
      </div>
      {!isFormVisible && (
        <button className="btn-primary btn-create" onClick={onAddTenant}>
          + Add New Tenant
        </button>
      )}
    </div>
  );
}
