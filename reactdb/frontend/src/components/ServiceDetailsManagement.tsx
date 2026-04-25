import { useState, useEffect, useMemo } from 'react';
import { apiService } from '../api';
import './ServiceDetailsManagement.css';

interface ServiceDetail {
  id: number;
  consumerNo: string;
  meterNo: number;
  load: string;
  serviceCategory: string;
  consumerName: string;
  createdDate: string;
  updatedDate?: string | null;
}

interface ServiceDetailFormData {
  consumerNo: string;
  meterNo: number;
  load: string;
  serviceCategory: string;
  consumerName: string;
}

export default function ServiceDetailsManagement(): JSX.Element {
  const [services, setServices] = useState<ServiceDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchField, setSearchField] = useState<'consumerName' | 'consumerNo' | 'meterNo' | 'serviceCategory'>('consumerName');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<ServiceDetailFormData>({
    consumerNo: '',
    meterNo: 0,
    load: '',
    serviceCategory: '',
    consumerName: ''
  });

  // Fetch services data
  useEffect(() => {
    const fetchServices = async () => {
      try {
        setLoading(true);
        const data = await apiService.getServiceDetails();
        setServices(data.data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load service details');
        console.error('Error fetching services:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchServices();
  }, []);

  // Filter and search services
  const filteredServices = useMemo(() => {
    if (!searchTerm) return services;

    const term = searchTerm.toLowerCase();
    return services.filter(service => {
      switch (searchField) {
        case 'consumerName':
          return service.consumerName.toLowerCase().includes(term);
        case 'consumerNo':
          return service.consumerNo.toLowerCase().includes(term);
        case 'meterNo':
          return service.meterNo.toString().includes(term);
        case 'serviceCategory':
          return service.serviceCategory.toLowerCase().includes(term);
        default:
          return true;
      }
    });
  }, [services, searchTerm, searchField]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'meterNo' ? parseInt(value) || 0 : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.consumerNo || !formData.meterNo || !formData.load || !formData.serviceCategory || !formData.consumerName) {
      setError('All fields are required');
      return;
    }

    try {
      if (editingId) {
        await apiService.updateServiceDetail(editingId, formData);
        setServices(services.map(s => s.id === editingId ? { ...s, ...formData } : s));
      } else {
        const response = await apiService.createServiceDetail(formData);
        setServices([...services, response.data]);
      }

      setFormData({
        consumerNo: '',
        meterNo: 0,
        load: '',
        serviceCategory: '',
        consumerName: ''
      });
      setEditingId(null);
      setShowForm(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save service detail');
      console.error('Error saving service detail:', err);
    }
  };

  const handleEdit = (service: ServiceDetail) => {
    setFormData({
      consumerNo: service.consumerNo,
      meterNo: service.meterNo,
      load: service.load,
      serviceCategory: service.serviceCategory,
      consumerName: service.consumerName
    });
    setEditingId(service.id);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this service detail?')) return;

    try {
      await apiService.deleteServiceDetail(id);
      setServices(services.filter(s => s.id !== id));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete service detail');
      console.error('Error deleting service detail:', err);
    }
  };

  const handleCancel = () => {
    setFormData({
      consumerNo: '',
      meterNo: 0,
      load: '',
      serviceCategory: '',
      consumerName: ''
    });
    setEditingId(null);
    setShowForm(false);
  };

  const formatDate = (dateStr: string | undefined): string => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="service-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading service details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="service-container">
      <h2 className="section-heading">Service Details</h2>
      {/* Header */}
      <div className="service-header">
        <button 
          className="btn btn-primary"
          onClick={() => {
            if (showForm && !editingId) {
              handleCancel();
            } else {
              setShowForm(true);
            }
          }}
        >
          {showForm && !editingId ? 'Cancel' : '+ Add Service'}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="error-card">
          <span>❌</span>
          <div>
            <strong>Error</strong>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Form Section */}
      {showForm && (
        <div className="form-card">
          <h2>{editingId ? 'Edit' : 'Add New'} Service Detail</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="consumerName">Consumer Name *</label>
                <input
                  type="text"
                  id="consumerName"
                  name="consumerName"
                  value={formData.consumerName}
                  onChange={handleInputChange}
                  placeholder="Enter consumer name"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="consumerNo">Consumer Number *</label>
                <input
                  type="text"
                  id="consumerNo"
                  name="consumerNo"
                  value={formData.consumerNo}
                  onChange={handleInputChange}
                  placeholder="Enter consumer number"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="meterNo">Meter Number *</label>
                <input
                  type="number"
                  id="meterNo"
                  name="meterNo"
                  value={formData.meterNo || ''}
                  onChange={handleInputChange}
                  placeholder="Enter meter number"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="load">Load *</label>
                <input
                  type="text"
                  id="load"
                  name="load"
                  value={formData.load}
                  onChange={handleInputChange}
                  placeholder="e.g., 1kW, 2.5kW"
                  required
                />
              </div>

              <div className="form-group full-width">
                <label htmlFor="serviceCategory">Service Category *</label>
                <select
                  id="serviceCategory"
                  name="serviceCategory"
                  value={formData.serviceCategory}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Select service category</option>
                  <option value="Domestic">Domestic</option>
                  <option value="Commercial">Commercial</option>
                  <option value="Industrial">Industrial</option>
                  <option value="Agriculture">Agriculture</option>
                  <option value="Others">Others</option>
                </select>
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-success">
                {editingId ? 'Update' : 'Add'} Service Detail
              </button>
              <button type="button" className="btn btn-secondary" onClick={handleCancel}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search Section */}
      <div className="search-section">
        <div className="search-group">
          <div className="search-field-selector">
            <label htmlFor="searchField">Search By:</label>
            <select
              id="searchField"
              value={searchField}
              onChange={(e) => setSearchField(e.target.value as any)}
              className="search-field-select"
            >
              <option value="consumerName">Consumer Name</option>
              <option value="consumerNo">Consumer Number</option>
              <option value="meterNo">Meter Number</option>
              <option value="serviceCategory">Service Category</option>
            </select>
          </div>
          <input
            type="text"
            placeholder={`Search by ${searchField}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        {searchTerm && (
          <div className="search-results-info">
            Found {filteredServices.length} result{filteredServices.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Services List */}
      <div className="services-list">
        {filteredServices.length > 0 ? (
          <div className="table-responsive">
            <table className="services-table">
              <thead>
                <tr>
                  <th>Consumer Name</th>
                  <th>Consumer No</th>
                  <th>Meter No</th>
                  <th>Load</th>
                  <th>Service Category</th>
                  <th>Created Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredServices.map(service => (
                  <tr key={service.id}>
                    <td className="bold">{service.consumerName}</td>
                    <td>{service.consumerNo}</td>
                    <td>{service.meterNo}</td>
                    <td>{service.load}</td>
                    <td>
                      <span className={`badge badge-${service.serviceCategory.toLowerCase()}`}>
                        {service.serviceCategory}
                      </span>
                    </td>
                    <td>{formatDate(service.createdDate)}</td>
                    <td className="actions-cell">
                      <button
                        className="btn-icon edit"
                        title="Edit"
                        onClick={() => handleEdit(service)}
                      >
                        ✏️
                      </button>
                      <button
                        className="btn-icon delete"
                        title="Delete"
                        onClick={() => handleDelete(service.id)}
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="no-results">
            <p>📭 No service details found</p>
            <p>{searchTerm ? 'Try adjusting your search criteria' : 'Add the first service detail to get started'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
