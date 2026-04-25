import React, { useState, useEffect, useCallback } from 'react';
import { updateProduct, getCategories, getSubcategories } from '../api';
import SearchableCategoryDropdown from './SearchableCategoryDropdown';
import SearchableSubcategoryDropdown from './SearchableSubcategoryDropdown';
import './EditProduct.css';

const EditProduct = ({ product, onClose, onSaved }) => {
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const [formData, setFormData] = useState({
    name: product.name || '',
    description: product.description || '',
    category_id: product.category_id || '',
    subcategory_id: product.subcategory_id || '',
    price: product.price || '',
    weight_kg: product.weight_kg || '0.50',
    stock: product.stock || '',
    sku: product.sku || '',
    model_number: product.model_number || '',
    is_preorder: product.is_preorder || false,
    preorder_release_date: product.preorder_release_date
      ? new Date(product.preorder_release_date).toISOString().split('T')[0]
      : ''
  });

  const loadCategoriesMemo = useCallback(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadCategoriesMemo();
  }, [loadCategoriesMemo]);

  const loadCategories = async () => {
    try {
      const [categoriesResponse, subcategoriesResponse] = await Promise.all([
        getCategories(),
        getSubcategories()
      ]);
      setCategories(Array.isArray(categoriesResponse.data) ? categoriesResponse.data : []);
      setSubcategories(Array.isArray(subcategoriesResponse.data) ? subcategoriesResponse.data : []);
    } catch (err) {
      console.error('Error loading categories and subcategories:', err);
      setCategories([]);
      setSubcategories([]);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      setMessage('Product name is required');
      return false;
    }
    if (!formData.category_id) {
      setMessage('Please select a category');
      return false;
    }
    if (!formData.price || parseFloat(formData.price) <= 0) {
      setMessage('Please enter a valid price');
      return false;
    }
    if (!formData.weight_kg || parseFloat(formData.weight_kg) <= 0) {
      setMessage('Please enter a valid product weight in kg');
      return false;
    }
    if (!formData.stock || parseInt(formData.stock) < 0) {
      setMessage('Please enter a valid stock quantity');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    if (!validateForm()) return;

    try {
      setLoading(true);
      await updateProduct(product.id, {
        name: formData.name,
        description: formData.description,
        category_id: parseInt(formData.category_id),
        subcategory_id: formData.subcategory_id ? parseInt(formData.subcategory_id) : null,
        price: parseFloat(formData.price),
        weight_kg: parseFloat(formData.weight_kg),
        stock: parseInt(formData.stock),
        sku: formData.sku,
        model_number: formData.model_number || null,
        is_preorder: formData.is_preorder,
        preorder_release_date: formData.is_preorder ? formData.preorder_release_date || null : null
      });

      setMessage('Product updated successfully!');
      setTimeout(() => {
        onSaved && onSaved();
        onClose && onClose();
      }, 1500);
    } catch (err) {
      setMessage('Error updating product: ' + (err.response?.data?.error || err.message));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="edit-product-modal">
      <div className="edit-product-container">
        <div className="edit-header">
          <h2>Edit Product</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {message && (
          <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="edit-form">
          <div className="form-group">
            <label>Product Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter product name"
              required
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Enter product description"
              rows="4"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Category *</label>
              <SearchableCategoryDropdown
                categories={categories}
                value={formData.category_id}
                onChange={(e) => setFormData(prev => ({ ...prev, category_id: e.target.value }))}
                placeholder="Select a category"
              />
            </div>

            <div className="form-group">
              <label>Subcategory (Optional)</label>
              <SearchableSubcategoryDropdown
                subcategories={subcategories}
                categoryId={formData.category_id}
                value={formData.subcategory_id}
                onChange={(e) => setFormData(prev => ({ ...prev, subcategory_id: e.target.value }))}
                placeholder="Select a subcategory"
              />
            </div>

            <div className="form-group">
              <label>Price (₹) *</label>
              <input
                type="number"
                name="price"
                value={formData.price}
                onChange={handleChange}
                placeholder="Enter price"
                step="0.01"
                min="0"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Stock Quantity *</label>
              <input
                type="number"
                name="stock"
                value={formData.stock}
                onChange={handleChange}
                placeholder="Enter stock quantity"
                min="0"
                required
              />
            </div>

            <div className="form-group">
              <label>Weight (kg) *</label>
              <input
                type="number"
                name="weight_kg"
                value={formData.weight_kg}
                onChange={handleChange}
                placeholder="0.50"
                step="0.01"
                min="0.01"
                required
              />
            </div>

            <div className="form-group">
              <label>SKU (optional)</label>
              <input
                type="text"
                name="sku"
                value={formData.sku}
                onChange={handleChange}
                placeholder="Enter SKU"
              />
            </div>

            <div className="form-group">
              <label>Model Number (Optional)</label>
              <input
                type="text"
                name="model_number"
                value={formData.model_number}
                onChange={handleChange}
                placeholder="Product model number (e.g., iPhone-15-Pro)"
              />
            </div>
          </div>

          {/* Pre-Order */}
          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="is_preorder"
                checked={formData.is_preorder}
                onChange={handleChange}
              />
              <span>Pre-Order Product</span>
            </label>
          </div>

          {formData.is_preorder && (
            <div className="form-group">
              <label>Expected Release Date</label>
              <input
                type="date"
                name="preorder_release_date"
                value={formData.preorder_release_date}
                onChange={handleChange}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
          )}

          <div className="form-actions">
            <button
              type="button"
              className="btn-cancel"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-submit"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProduct;
