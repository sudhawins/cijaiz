import React, { useState, useEffect, useCallback } from 'react';
import { getCategories, createCategory, updateCategory, getSubcategories } from '../api';
import './CategoryManagement.css';

const CategoryManagement = ({ onClose }) => {
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });

  const loadCategoriesMemo = useCallback(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadCategoriesMemo();
  }, [loadCategoriesMemo]);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const [categoriesResponse, subcategoriesResponse] = await Promise.all([
        getCategories(),
        getSubcategories()
      ]);
      setCategories(Array.isArray(categoriesResponse.data) ? categoriesResponse.data : []);
      setSubcategories(Array.isArray(subcategoriesResponse.data) ? subcategoriesResponse.data : []);
      setMessage('');
    } catch (err) {
      setMessage('Error loading categories and subcategories');
      console.error(err);
      setCategories([]);
      setSubcategories([]);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    if (!formData.name.trim()) {
      setMessage('Category name is required');
      return;
    }

    try {
      if (editingId) {
        await updateCategory(editingId, formData);
        setMessage('Category updated successfully');
      } else {
        await createCategory(formData);
        setMessage('Category created successfully');
      }
      
      setFormData({ name: '', description: '' });
      setEditingId(null);
      setTimeout(() => loadCategories(), 500);
    } catch (err) {
      setMessage('Error: ' + (err.response?.data?.error || err.message));
      console.error(err);
    }
  };

  const handleEdit = (category) => {
    setEditingId(category.id);
    setFormData({
      name: category.name,
      description: category.description || ''
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setFormData({ name: '', description: '' });
    setMessage('');
  };

  if (loading) {
    return (
      <div className="cm-modal">
        <div className="cm-container">
          <div className="cm-header">
            <h2>Category Management</h2>
            <button className="close-btn" onClick={onClose}>✕</button>
          </div>
          <div className="loading-state">Loading categories...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="cm-modal">
      <div className="cm-container">
        <div className="cm-header">
          <h2>Manage Categories</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {message && (
          <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
            {message}
          </div>
        )}

        <div className="cm-content">
          {/* Add/Edit Form */}
          <div className="form-section">
            <h3>{editingId ? 'Edit Category' : 'Create New Category'}</h3>
            
            <form onSubmit={handleSubmit} className="cm-form">
              <div className="form-group">
                <label>Category Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Enter category name"
                  required
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Enter category description (optional)"
                  rows="3"
                />
              </div>

              <div className="form-actions">
                {editingId && (
                  <button
                    type="button"
                    className="btn-cancel"
                    onClick={handleCancel}
                  >
                    Cancel Edit
                  </button>
                )}
                <button type="submit" className="btn-submit">
                  {editingId ? 'Update Category' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>

          {/* Categories List */}
          <div className="list-section">
            <h3>All Categories ({categories.length})</h3>
            
            {categories.length === 0 ? (
              <div className="no-categories">
                <p>No categories available. Create one above!</p>
              </div>
            ) : (
              <div className="categories-list">
                {categories.map(category => {
                  const categorySubcategories = subcategories.filter(sub => sub.category_id === category.id);
                  
                  return (
                    <div key={category.id} className="category-item">
                      <div className="category-info">
                        <h4>{category.name}</h4>
                        {category.description && (
                          <p className="description">{category.description}</p>
                        )}
                        <div className="subcategories-section">
                          <h5>Subcategories ({categorySubcategories.length})</h5>
                          {categorySubcategories.length === 0 ? (
                            <p className="no-subcategories">No subcategories yet</p>
                          ) : (
                            <div className="subcategories-list">
                              {categorySubcategories.map(subcategory => (
                                <div key={subcategory.id} className="subcategory-item">
                                  <span className="subcategory-name">{subcategory.name}</span>
                                  {subcategory.description && (
                                    <span className="subcategory-description"> - {subcategory.description}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        className="btn-edit"
                        onClick={() => handleEdit(category)}
                      >
                        ✏️ Edit
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CategoryManagement;
