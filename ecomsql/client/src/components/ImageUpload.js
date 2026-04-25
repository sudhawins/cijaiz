import React, { useState, useEffect, useCallback } from 'react';
import { getProducts, getProductById, uploadProductImage, getProductImages, deleteProductImage, API_BASE_URL } from '../api';
import './ImageUpload.css';

const SearchableDropdown = ({ products, value, onChange, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = React.useRef(null);

  const filteredProducts = searchTerm.trim() === '' 
    ? products 
    : products.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (product.sku && product.sku.toLowerCase().includes(searchTerm.toLowerCase()))
      );

  const selectedProductObj = products.find(p => p.id === parseInt(value));

  const handleSelect = (productId) => {
    onChange({ target: { value: productId } });
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleInputChange = (e) => {
    setSearchTerm(e.target.value);
    setIsOpen(true);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="searchable-dropdown" ref={dropdownRef}>
      <input
        type="text"
        value={isOpen ? searchTerm : (selectedProductObj ? selectedProductObj.name : '')}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        placeholder={placeholder}
        className="dropdown-input"
        autoComplete="off"
      />
      {isOpen && (
        <div className="dropdown-menu">
          {filteredProducts.length > 0 ? (
            filteredProducts.map(product => (
              <div
                key={product.id}
                className={`dropdown-item ${value === String(product.id) ? 'selected' : ''}`}
                onClick={() => handleSelect(product.id)}
              >
                <div className="product-name">{product.name}</div>
                {product.sku && <div className="product-sku">SKU: {product.sku}</div>}
              </div>
            ))
          ) : (
            <div className="dropdown-no-results">No products found</div>
          )}
        </div>
      )}
    </div>
  );
};

const ImageUpload = () => {
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [images, setImages] = useState([]);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [productId, setProductId] = useState('');

  const loadProductsMemo = useCallback(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    loadProductsMemo();
  }, [loadProductsMemo]);

  const loadProducts = async () => {
    try {
      const response = await getProducts();
      setProducts(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error('Error loading products:', err);
      setProducts([]);
    }
  };

  const handleProductSelect = async (e) => {
    const id = e.target.value;
    setProductId(id);
    
    if (id) {
      try {
        const response = await getProductById(id);
        setSelectedProduct(response.data);
        await loadImages(id);
      } catch (err) {
        setMessage('Error loading product');
        console.error(err);
      }
    } else {
      setSelectedProduct(null);
      setImages([]);
    }
  };

  const loadImages = async (id) => {
    try {
      const response = await getProductImages(id);
      setImages(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error('Error loading images:', err);
      setImages([]);
    }
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    
    if (!file) {
      setMessage('Please select a file');
      return;
    }

    if (!productId) {
      setMessage('Please select a product');
      return;
    }

    try {
      setUploading(true);
      setMessage('');

      await uploadProductImage(productId, file);
      setMessage('Image uploaded successfully!');
      setFile(null);
      if (e.target.reset) {
        e.target.reset();
      }
      await loadImages(productId);
    } catch (err) {
      setMessage('Error uploading image: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteImage = async (imageId) => {
    if (!window.confirm('Are you sure you want to delete this image?')) {
      return;
    }

    try {
      await deleteProductImage(imageId);
      setMessage('Image deleted successfully');
      await loadImages(productId);
    } catch (err) {
      setMessage('Error deleting image');
      console.error(err);
    }
  };

  return (
    <div className="image-upload">
      <h2>Product Image Upload</h2>

      {message && (
        <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
          {message}
        </div>
      )}

      <div className="upload-section">
        <h3>Upload Image</h3>
        
        <div className="form-group">
          <label>Select Product *</label>
          <SearchableDropdown 
            products={products}
            value={productId}
            onChange={handleProductSelect}
            placeholder="Search by product name or SKU..."
          />
        </div>

        {selectedProduct && (
          <div className="product-info">
            <p><strong>Product:</strong> {selectedProduct.name}</p>
            <p><strong>SKU:</strong> {selectedProduct.sku || 'N/A'}</p>
            <p><strong>Price:</strong> ₹{selectedProduct.price.toFixed(2)}</p>
          </div>
        )}

        {selectedProduct && (
          <form onSubmit={handleUpload} className="upload-form">
            <div className="form-group">
              <label>Select Image File *</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                required
              />
              <small>Supported formats: JPEG, PNG, GIF, WebP (Max 5MB)</small>
            </div>

            <button type="submit" disabled={uploading} className="upload-btn">
              {uploading ? 'Uploading...' : 'Upload Image'}
            </button>
          </form>
        )}
      </div>

      {images.length > 0 && (
        <div className="images-section">
          <h3>Product Images ({images.length})</h3>
          <div className="images-grid">
            {images.map(image => (
              <div key={image.id} className="image-card">
                <div className="image-preview">
                  <img src={`${API_BASE_URL}${image.image_url}`} alt={image.filename} />
                </div>
                <div className="image-info">
                  <p className="filename">{image.filename}</p>
                  <p className="upload-date">
                    {new Date(image.uploaded_at).toLocaleDateString()}
                  </p>
                  <button
                    className="delete-btn"
                    onClick={() => handleDeleteImage(image.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedProduct && images.length === 0 && (
        <div className="no-images">
          <p>No images uploaded for this product yet</p>
        </div>
      )}
    </div>
  );
};

export default ImageUpload;
