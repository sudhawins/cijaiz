import { useState, useEffect } from 'react';
import { apiService } from '../api';
import './ManagementStyles.css';

interface Stock {
  id: number;
  name: string;
  description?: string;
  quantity: number;
  createdDate: string;
  createdBy: string;
  updatedDate?: string;
  updatedBy?: string;
  imageURL?: string;
}

export default function StockManagement() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingStock, setEditingStock] = useState<Stock | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'quantity-desc' | 'quantity-asc'>('name');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    quantity: 0,
    createdBy: localStorage.getItem('currentUser') || 'Admin'
  });

  // Fetch stocks
  const fetchStocks = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getStockDetails();
      setStocks(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch stocks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStocks();
  }, []);

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);

      if (editingStock) {
        await apiService.updateStock(editingStock.id, {
          ...formData,
          updatedBy: localStorage.getItem('currentUser') || 'Admin'
        });
        setSuccessMessage('Stock updated successfully!');
      } else {
        await apiService.createStock(formData);
        setSuccessMessage('Stock created successfully!');
      }

      setShowForm(false);
      setEditingStock(null);
      setFormData({
        name: '',
        description: '',
        quantity: 0,
        createdBy: localStorage.getItem('currentUser') || 'Admin'
      });
      fetchStocks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save stock');
    } finally {
      setLoading(false);
    }
  };

  // Delete stock
  const handleDelete = async (id: number) => {
    try {
      setLoading(true);
      await apiService.deleteStock(id);
      setSuccessMessage('Stock deleted successfully!');
      setShowDeleteConfirm(null);
      fetchStocks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete stock');
    } finally {
      setLoading(false);
    }
  };

  // Edit stock
  const handleEdit = (stock: Stock) => {
    setEditingStock(stock);
    setFormData({
      name: stock.name,
      description: stock.description || '',
      quantity: stock.quantity,
      createdBy: stock.createdBy
    });
    setShowForm(true);
  };

  const filteredStocks = stocks.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.description?.toLowerCase().includes(searchQuery.toLowerCase())
  ).sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'quantity-desc':
        return b.quantity - a.quantity;
      case 'quantity-asc':
        return a.quantity - b.quantity;
      default:
        return 0;
    }
  });

  return (
    <div className="management-container stock-container">
      <h2 className="section-heading">Stock</h2>
      {error && <div className="error-message">{error}</div>}
      {successMessage && <div className="success-message">{successMessage}</div>}

      <div className="toolbar">
        <input
          type="text"
          placeholder="Search stocks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="sort-select"
        >
          <option value="name">By Name</option>
          <option value="quantity-desc">Highest Quantity</option>
          <option value="quantity-asc">Lowest Quantity</option>
        </select>
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditingStock(null);
            setFormData({
              name: '',
              description: '',
              quantity: 0,
              createdBy: localStorage.getItem('currentUser') || 'Admin'
            });
            setShowForm(true);
          }}
        >
          + Add Stock
        </button>
      </div>

      {showForm && (
        <div className="form-container">
          <h3>{editingStock ? 'Edit Stock' : 'Add New Stock'}</h3>
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              placeholder="Stock Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <textarea
              placeholder="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
            <input
              type="number"
              placeholder="Quantity"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
              required
            />
            <div className="form-buttons">
              <button type="submit" className="btn btn-success" disabled={loading}>
                {loading ? 'Saving...' : 'Save Stock'}
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
      ) : (
        <div className="items-grid">
          {filteredStocks.map((stock) => (
            <div key={stock.id} className="item-card">
              <div className="item-header">
                <h4>{stock.name}</h4>
                <div className="item-actions">
                  <button className="btn btn-sm btn-info" onClick={() => handleEdit(stock)}>
                    Edit
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => setShowDeleteConfirm(stock.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <p><strong>Quantity:</strong> {stock.quantity} units</p>
              {stock.description && (
                <p><strong>Description:</strong> {stock.description}</p>
              )}
              <p><strong>Created By:</strong> {stock.createdBy}</p>
              <p><strong>Created Date:</strong> {new Date(stock.createdDate).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      )}

      {showDeleteConfirm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Confirm Delete</h3>
            <p>Are you sure you want to delete this stock?</p>
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
