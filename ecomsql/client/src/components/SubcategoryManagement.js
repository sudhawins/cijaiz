import React, { useState, useEffect, useCallback } from 'react';
import { getSubcategories, getCategories, createSubcategory, updateSubcategory, deleteSubcategory } from '../api';
import './SubcategoryManagement.css';

const SubcategoryManagement = () => {
  const [subcategories, setSubcategories] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [editingSubcategory, setEditingSubcategory] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [formData, setFormData] = useState({
    category_id: '',
    name: '',
    description: ''
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [subcategoriesResponse, categoriesResponse] = await Promise.all([
        getSubcategories(),
        getCategories()
      ]);

      setSubcategories(Array.isArray(subcategoriesResponse.data) ? subcategoriesResponse.data : []);
      setCategories(Array.isArray(categoriesResponse.data) ? categoriesResponse.data : []);
      setMessage('');
    } catch (err) {
      console.error('[SubcategoryManagement] Error loading data:', err);
      setMessage('Error loading subcategories: ' + (err.message || 'Unknown error'));
      setSubcategories([]);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const resetForm = () => {
    setFormData({
      category_id: '',
      name: '',
      description: ''
    });
    setEditingSubcategory(null);
    setShowCreateForm(false);
  };

  const handleCreateSubcategory = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setMessage('');

      if (!formData.category_id || !formData.name) {
        setMessage('Category and subcategory name are required');
        setLoading(false);
        return;
      }

      await createSubcategory({
        category_id: parseInt(formData.category_id),
        name: formData.name,
        description: formData.description || null
      });

      setMessage('Subcategory created successfully!');
      resetForm();
      loadData();
    } catch (err) {
      setMessage('Error creating subcategory: ' + (err.response?.data?.error || err.message));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSubcategory = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setMessage('');

      if (!formData.name) {
        setMessage('Subcategory name is required');
        setLoading(false);
        return;
      }

      await updateSubcategory(editingSubcategory.id, {
        name: formData.name,
        description: formData.description || null
      });

      setMessage('Subcategory updated successfully!');
      resetForm();
      loadData();
    } catch (err) {
      setMessage('Error updating subcategory: ' + (err.response?.data?.error || err.message));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSubcategory = async (subcategoryId) => {
    try {
      await deleteSubcategory(subcategoryId);
      setMessage('Subcategory deleted successfully');
      setDeleteConfirm(null);
      loadData();
    } catch (err) {
      setMessage('Error deleting subcategory: ' + (err.response?.data?.error || err.message));
      console.error(err);
    }
  };

  const startEdit = (subcategory) => {
    setEditingSubcategory(subcategory);
    setFormData({
      category_id: subcategory.category_id,
      name: subcategory.name,
      description: subcategory.description || ''
    });
    setShowCreateForm(true);
  };

  const getCategoryName = (categoryId) => {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.name : 'Unknown Category';
  };

  if (loading && subcategories.length === 0) {
    return <div className="subcategory-management"><div className="loading">Loading subcategories...</div></div>;
  }

  return (
    <div className="subcategory-management">
      <div className="sm-header">
        <h2>Subcategory Management</h2>
        <p className="sm-subtitle">Manage product subcategories for better organization</p>
      </div>

      {message && (
        <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
          {message}
        </div>
      )}

      <div className="sm-actions">
        <button
          className="btn btn-primary"
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
          {showCreateForm ? 'Cancel' : '+ Add Subcategory'}
        </button>
      </div>

      {showCreateForm && (
        <div className="form-container">
          <form onSubmit={editingSubcategory ? handleUpdateSubcategory : handleCreateSubcategory} className="form">
            <h3>{editingSubcategory ? 'Edit Subcategory' : 'Create New Subcategory'}</h3>

            <div className="form-group">
              <label>Parent Category *</label>
              <select
                name="category_id"
                value={formData.category_id}
                onChange={handleFormChange}
                required
                disabled={!!editingSubcategory} // Can't change category when editing
              >
                <option value="">Select a category</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Subcategory Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleFormChange}
                placeholder="Enter subcategory name"
                required
              />
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleFormChange}
                placeholder="Enter subcategory description (optional)"
                rows={3}
              />
            </div>

            <div className="form-actions">
              <button type="submit" disabled={loading} className="submit-btn">
                {loading ? (editingSubcategory ? 'Updating...' : 'Creating...') : (editingSubcategory ? 'Update Subcategory' : 'Create Subcategory')}
              </button>
              <button type="button" onClick={resetForm} className="cancel-btn">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="subcategories-grid">
        {subcategories.length === 0 ? (
          <div className="empty-subcategories">
            <p>No subcategories found.</p>
            <p style={{ color: '#999', fontSize: '14px' }}>Create your first subcategory using the button above.</p>
          </div>
        ) : (
          subcategories.map(subcategory => (
            <div key={subcategory.id} className="subcategory-card">
              <div className="subcategory-header">
                <h3>{subcategory.name}</h3>
                <span className="category-badge">{getCategoryName(subcategory.category_id)}</span>
              </div>

              <div className="subcategory-details">
                {subcategory.description && (
                  <p className="description">{subcategory.description}</p>
                )}
                <div className="subcategory-meta">
                  <span className="meta-item">ID: {subcategory.id}</span>
                  <span className="meta-item">
                    Created: {new Date(subcategory.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="subcategory-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => startEdit(subcategory)}
                  title="Edit subcategory"
                >
                  ✏️ Edit
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => setDeleteConfirm(subcategory.id)}
                  title="Delete subcategory"
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {deleteConfirm && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Confirm Delete</h3>
            <p>Are you sure you want to delete this subcategory? This action cannot be undone.</p>
            <div className="modal-actions">
              <button
                className="btn btn-danger"
                onClick={() => handleDeleteSubcategory(deleteConfirm)}
              >
                Delete
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setDeleteConfirm(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubcategoryManagement;