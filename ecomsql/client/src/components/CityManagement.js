import React, { useState, useEffect, useCallback } from 'react';
import { getAllCities, getAllStates, addCity, updateCity, deleteCity, getShippingZones } from '../api';
import './CityManagement.css';

const CityManagement = ({ onClose }) => {
  const [cities, setCities] = useState([]);
  const [states, setStates] = useState([]);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterState, setFilterState] = useState('');
  
  const [formData, setFormData] = useState({
    city_name: '',
    zip_code: '',
    state: '',
    shipping_zone: ''
  });

  const loadDataMemo = useCallback(() => {
    loadCities();
    loadStates();
    loadZones();
  }, []);

  useEffect(() => {
    loadDataMemo();
  }, [loadDataMemo]);

  const loadCities = async () => {
    try {
      setLoading(true);
      setMessage('');
      const response = await getAllCities();
      console.log('[CityManagement] Cities loaded:', response.data);
      const citiesData = Array.isArray(response.data) ? response.data : [];
      setCities(citiesData);
      
      if (citiesData.length === 0) {
        setMessage('No cities found in database. Please add cities to get started.');
        setMessageType('info');
      }
    } catch (err) {
      console.error('[CityManagement] Error loading cities:', err);
      const errorMsg = err.response?.data?.error || err.message || 'Error loading cities';
      setMessage(errorMsg);
      setMessageType('error');
      setCities([]);
    } finally {
      setLoading(false);
    }
  };

  const loadStates = async () => {
    try {
      const response = await getAllStates();
      console.log('[CityManagement] States loaded from database:', response.data);
      const statesList = Array.isArray(response.data) ? response.data : [];
      setStates(statesList);
      
      if (statesList.length === 0) {
        console.warn('[CityManagement] No states found in database. Add cities to populate states.');
      }
    } catch (err) {
      console.error('[CityManagement] Error loading states:', err);
      const errorMsg = err.response?.data?.error || err.message || 'Error loading states';
      console.error('[CityManagement] States error details:', errorMsg);
      setStates([]);
    }
  };

  const loadZones = async () => {
    try {
      const response = await getShippingZones();
      console.log('[CityManagement] Zones loaded from database:', response.data);
      const zonesData = Array.isArray(response.data) ? response.data : [];
      setZones(zonesData);
      
      if (zonesData.length === 0) {
        console.warn('[CityManagement] No shipping zones found in database. Add zones to populate dropdown.');
      }
    } catch (err) {
      console.error('[CityManagement] Error loading zones:', err);
      const errorMsg = err.response?.data?.error || err.message || 'Error loading zones';
      console.error('[CityManagement] Zones error details:', errorMsg);
      setZones([]);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const resetForm = () => {
    setFormData({
      city_name: '',
      zip_code: '',
      state: '',
      shipping_zone: ''
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    if (!formData.city_name.trim() || !formData.zip_code.trim() || !formData.state.trim() || !formData.shipping_zone.trim()) {
      setMessage('All fields are required');
      setMessageType('error');
      return;
    }

    try {
      if (editingId) {
        await updateCity(editingId, formData);
        setMessage('City updated successfully');
        setMessageType('success');
      } else {
        await addCity(formData);
        setMessage('City added successfully');
        setMessageType('success');
      }
      resetForm();
      loadCities();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Error saving city');
      setMessageType('error');
      console.error(err);
    }
  };

  const handleEdit = (city) => {
    setFormData({
      city_name: city.city_name,
      zip_code: city.zip_code,
      state: city.state,
      shipping_zone: city.shipping_zone
    });
    setEditingId(city.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this city?')) {
      return;
    }

    try {
      await deleteCity(id);
      setMessage('City deleted successfully');
      setMessageType('success');
      loadCities();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Error deleting city');
      setMessageType('error');
      console.error(err);
    }
  };

  const filteredCities = cities.filter(city => {
    const matchesSearch = city.city_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          city.zip_code.includes(searchTerm);
    const matchesState = !filterState || city.state === filterState;
    return matchesSearch && matchesState;
  });

  return (
    <div className="cm-modal">
      <div className="cm-container">
        <div className="cm-header">
          <h2>Manage Cities & Zip Codes</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="cm-content">
          {message && (
            <div className={`message ${messageType}`}>
              {message}
            </div>
          )}

          {loading && <div className="loading">Loading cities...</div>}

          {!loading && (
            <>
              {!showForm ? (
                <div className="cities-list-section">
                  <button 
                    className="btn btn-primary mb-20"
                    onClick={() => setShowForm(true)}
                  >
                    + Add New City
                  </button>

                  <div className="filters-section">
                    <input
                      type="text"
                      placeholder="Search by city name or zip code..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="search-input"
                    />
                    <select
                      value={filterState}
                      onChange={(e) => setFilterState(e.target.value)}
                      className="filter-select"
                    >
                      <option value="">All States</option>
                      {states.map(state => (
                        <option key={state} value={state}>{state}</option>
                      ))}
                    </select>
                  </div>

                  {filteredCities.length === 0 ? (
                    <p className="empty-message">
                      {searchTerm || filterState ? 'No cities match your filters' : 'No cities found'}
                    </p>
                  ) : (
                    <div className="cities-table">
                      <table>
                        <thead>
                          <tr>
                            <th>City Name</th>
                            <th>Zip Code</th>
                            <th>State</th>
                            <th>Shipping Zone</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredCities.map(city => (
                            <tr key={city.id}>
                              <td>{city.city_name}</td>
                              <td><code>{city.zip_code}</code></td>
                              <td>{city.state}</td>
                              <td>
                                <span className="zone-badge">{city.shipping_zone}</span>
                              </td>
                              <td className="actions">
                                <button
                                  className="btn btn-sm btn-info"
                                  onClick={() => handleEdit(city)}
                                >
                                  Edit
                                </button>
                                <button
                                  className="btn btn-sm btn-danger"
                                  onClick={() => handleDelete(city.id)}
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="list-footer">
                    Total: {filteredCities.length} cities
                  </div>
                </div>
              ) : (
                <div className="form-section">
                  <h3>{editingId ? 'Edit City' : 'Add New City'}</h3>
                  <form onSubmit={handleSubmit}>
                    <div className="form-group">
                      <label htmlFor="city_name">City Name *</label>
                      <input
                        type="text"
                        id="city_name"
                        name="city_name"
                        value={formData.city_name}
                        onChange={handleChange}
                        placeholder="e.g., Mumbai"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="zip_code">Zip Code *</label>
                      <input
                        type="text"
                        id="zip_code"
                        name="zip_code"
                        value={formData.zip_code}
                        onChange={handleChange}
                        placeholder="e.g., 400001"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="state">State *</label>
                      <input
                        type="text"
                        id="state"
                        name="state"
                        value={formData.state}
                        onChange={handleChange}
                        placeholder="e.g., Maharashtra"
                        list="states-list"
                        required
                      />
                      <datalist id="states-list">
                        {states.map(state => (
                          <option key={state} value={state} />
                        ))}
                      </datalist>
                    </div>

                    <div className="form-group">
                      <label htmlFor="shipping_zone">Shipping Zone *</label>
                      <select
                        id="shipping_zone"
                        name="shipping_zone"
                        value={formData.shipping_zone}
                        onChange={handleChange}
                        required
                        disabled={zones.length === 0}
                      >
                        <option value="">{zones.length === 0 ? 'No zones available' : 'Select Zone'}</option>
                        {zones.map(zone => (
                          <option key={zone.id} value={zone.zone_code}>
                            {zone.zone_name} (₹{zone.shipping_charge})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-actions">
                      <button type="submit" className="btn btn-primary">
                        {editingId ? 'Update City' : 'Add City'}
                      </button>
                      <button 
                        type="button" 
                        className="btn btn-secondary"
                        onClick={resetForm}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CityManagement;
