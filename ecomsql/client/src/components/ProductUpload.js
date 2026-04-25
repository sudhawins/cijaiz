import React, { useState, useCallback, useEffect } from 'react';
import { createProduct, createCategory, getCategories, getSubcategories, uploadProductImages } from '../api';
import SearchableCategoryDropdown from './SearchableCategoryDropdown';
import SearchableSubcategoryDropdown from './SearchableSubcategoryDropdown';
import './ProductUpload.css';

const ProductUpload = () => {
  const [activeTab, setActiveTab] = useState('product');
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);

  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    category_id: '',
    subcategory_id: '',
    price: '',
    weight_kg: '0.50',
    stock: '',
    sku: '',
    model_number: '',
    is_preorder: false,
    preorder_release_date: ''
  });

  const [selectedFiles, setSelectedFiles] = useState([]);

  const [categoryForm, setCategoryForm] = useState({
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

  const handleProductChange = (e) => {
    const { name, value, type, checked } = e.target;
    setProductForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    // Clear subcategory when category changes
    if (name === 'category_id') {
      setProductForm(prev => ({
        ...prev,
        subcategory_id: ''
      }));
    }
  };

  const handleCategoryChange = (e) => {
    const { name, value } = e.target;
    setCategoryForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    
    // Validate file count (max 10)
    if (files.length > 10) {
      setMessage('Maximum 10 images allowed');
      return;
    }

    // Create preview URLs
    files.forEach(file => {
      const reader = new FileReader();

      reader.onload = (event) => {
        console.log(`Preview loaded for ${file.name}`);
      };

      reader.readAsDataURL(file);
    });

    setSelectedFiles(files);
    setMessage('');
  };



  const handleCreateProduct = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setMessage('');
      setUploadProgress(0);

      if (!productForm.name || !productForm.category_id || !productForm.price || !productForm.sku) {
        setMessage('Please fill in all required fields (Name, Category, Price, and SKU)');
        setLoading(false);
        return;
      }

      // Step 1: Create product
      setUploadProgress(20);
      const productResponse = await createProduct({
        name: productForm.name,
        description: productForm.description,
        category_id: parseInt(productForm.category_id),
        subcategory_id: productForm.subcategory_id ? parseInt(productForm.subcategory_id) : null,
        price: parseFloat(productForm.price),
        weight_kg: parseFloat(productForm.weight_kg) || 0.5,
        stock: parseInt(productForm.stock) || 0,
        sku: productForm.sku,
        model_number: productForm.model_number || null,
        is_preorder: productForm.is_preorder,
        preorder_release_date: productForm.is_preorder ? productForm.preorder_release_date || null : null
      });

      const productId = productResponse.data.id;

      // Step 2: Upload images if any are selected
      if (selectedFiles.length > 0) {
        setUploadProgress(40);
        await uploadProductImages(productId, selectedFiles);
        setUploadProgress(80);
      }

      setUploadProgress(100);
      setMessage(`Product created successfully${selectedFiles.length > 0 ? ` with ${selectedFiles.length} image(s)` : ''}!`);
      
      // Reset form
      setProductForm({
        name: '',
        description: '',
        category_id: '',
        subcategory_id: '',
        price: '',
        weight_kg: '0.50',
        stock: '',
        sku: '',
        model_number: '',
        is_preorder: false,
        preorder_release_date: ''
      });
      setSelectedFiles([]);
      setUploadProgress(0);

      // Auto-refresh categories
      await loadCategories();
    } catch (err) {
      setMessage('Error creating product: ' + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setMessage('');

      if (!categoryForm.name) {
        setMessage('Category name is required');
        return;
      }

      await createCategory({
        name: categoryForm.name,
        description: categoryForm.description
      });

      setMessage('Category created successfully!');
      setCategoryForm({ name: '', description: '' });
      await loadCategories();
    } catch (err) {
      setMessage('Error creating category: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="product-upload">
      <div className="upload-container">
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'product' ? 'active' : ''}`}
            onClick={() => setActiveTab('product')}
          >
            Add Product
          </button>
          <button
            className={`tab ${activeTab === 'category' ? 'active' : ''}`}
            onClick={() => setActiveTab('category')}
          >
            Add Category
          </button>
        </div>

        {message && (
          <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
            {message}
          </div>
        )}

        {uploadProgress > 0 && uploadProgress < 100 && (
          <div className="progress-container">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${uploadProgress}%` }}></div>
            </div>
            <p className="progress-text">Uploading... {uploadProgress}%</p>
          </div>
        )}

        {activeTab === 'product' && (
          <form onSubmit={handleCreateProduct} className="form">
            <h2>Add New Product</h2>

            <div className="form-group">
              <label>Product Name *</label>
              <input
                type="text"
                name="name"
                value={productForm.name}
                onChange={handleProductChange}
                placeholder="Enter product name"
                required
              />
            </div>

            <div className="form-group">
              <label>Category *</label>
              <SearchableCategoryDropdown
                categories={categories}
                value={productForm.category_id}
                onChange={(e) => setProductForm(prev => ({ ...prev, category_id: e.target.value }))}
                placeholder="Select a category"
              />
            </div>

            <div className="form-group">
              <label>Subcategory (Optional)</label>
              <SearchableSubcategoryDropdown
                subcategories={subcategories}
                categoryId={productForm.category_id}
                value={productForm.subcategory_id}
                onChange={(e) => setProductForm(prev => ({ ...prev, subcategory_id: e.target.value }))}
                placeholder="Select a subcategory"
              />
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                name="description"
                value={productForm.description}
                onChange={handleProductChange}
                placeholder="Enter product description"
                rows={4}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Price *</label>
                <input
                  type="number"
                  name="price"
                  value={productForm.price}
                  onChange={handleProductChange}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  required
                />
              </div>

              <div className="form-group">
                <label>Weight (kg) *</label>
                <input
                  type="number"
                  name="weight_kg"
                  value={productForm.weight_kg}
                  onChange={handleProductChange}
                  placeholder="0.50"
                  step="0.01"
                  min="0.01"
                  required
                />
              </div>

              <div className="form-group">
                <label>Stock</label>
                <input
                  type="number"
                  name="stock"
                  value={productForm.stock}
                  onChange={handleProductChange}
                  placeholder="0"
                  min="0"
                />
              </div>
            </div>

            <div className="form-group">
              <label>SKU *</label>
              <input
                type="text"
                name="sku"
                value={productForm.sku}
                onChange={handleProductChange}
                placeholder="Product SKU (Unique identifier)"
                required
              />
            </div>

            <div className="form-group">
              <label>Model Number (Optional)</label>
              <input
                type="text"
                name="model_number"
                value={productForm.model_number}
                onChange={handleProductChange}
                placeholder="Product model number (e.g., iPhone-15-Pro)"
              />
            </div>

            {/* Pre-Order Section */}
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="is_preorder"
                  checked={productForm.is_preorder}
                  onChange={handleProductChange}
                />
                <span>Pre-Order Product</span>
              </label>
              <p className="field-hint">Customers can place pre-orders before the product is available.</p>
            </div>

            {productForm.is_preorder && (
              <div className="form-group">
                <label>Expected Release Date</label>
                <input
                  type="date"
                  name="preorder_release_date"
                  value={productForm.preorder_release_date}
                  onChange={handleProductChange}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            )}

            {/* Image Upload Section */}
            <div className="form-group">
              <label>Product Images (Optional - Max 10)</label>
              <div className="file-input-wrapper">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileSelect}
                  disabled={loading}
                  id="file-input"
                />
                <label htmlFor="file-input" className="file-input-label">
                  📸 Click to select images or drag & drop
                </label>
              </div>
              <p className="file-info">
                Upload up to 10 images. Supported formats: JPG, PNG, GIF, WebP
              </p>
            </div>

<button type="submit" disabled={loading} className="submit-btn">
              {loading ? `Creating... ${uploadProgress > 0 ? uploadProgress + '%' : ''}` : 'Create Product'}
            </button>
          </form>
        )}

        {activeTab === 'category' && (
          <form onSubmit={handleCreateCategory} className="form">
            <h2>Add New Category</h2>

            <div className="form-group">
              <label>Category Name *</label>
              <input
                type="text"
                name="name"
                value={categoryForm.name}
                onChange={handleCategoryChange}
                placeholder="Enter category name"
                required
              />
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                name="description"
                value={categoryForm.description}
                onChange={handleCategoryChange}
                placeholder="Enter category description"
                rows={4}
              />
            </div>

            <button type="submit" disabled={loading} className="submit-btn">
              {loading ? 'Creating...' : 'Create Category'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ProductUpload;
