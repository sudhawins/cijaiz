import React, { useState, useEffect, useCallback } from 'react';
import { getProducts, deleteProduct, API_BASE_URL } from '../api';
import './ProductManagement.css';

const ProductManagement = ({ onEditProduct, onManageImages }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const loadSellerProducts = useCallback(async () => {
    try {
      console.log('[ProductManagement] Loading seller products...');
      setLoading(true);
      const response = await getProducts({ sellerOnly: 'true' });
      console.log('[ProductManagement] API response:', response);
      console.log('[ProductManagement] response.data structure:', {
        type: typeof response.data,
        isArray: Array.isArray(response.data),
        hasDataProperty: response.data?.data !== undefined,
        dataLength: response.data?.data?.length
      });
      
      // Handle both response.data as array OR response.data.data as array
      const productsArray = Array.isArray(response.data) 
        ? response.data 
        : Array.isArray(response.data?.data) 
          ? response.data.data 
          : [];
      
      setProducts(productsArray);
      console.log('[ProductManagement] Products loaded and set:', productsArray.length, 'items');
      console.log('[ProductManagement] First product:', productsArray[0]);
      setMessage('');
    } catch (err) {
      console.error('[ProductManagement] Error loading products:', err);
      setMessage('Error loading your products: ' + (err.message || 'Unknown error'));
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    console.log('[ProductManagement] Component mounted, loading products');
    loadSellerProducts();
  }, [loadSellerProducts]);

  const handleDeleteProduct = async (productId) => {
    try {
      await deleteProduct(productId);
      setMessage('Product deleted successfully');
      setDeleteConfirm(null);
      loadSellerProducts();
    } catch (err) {
      setMessage('Error deleting product: ' + (err.response?.data?.error || err.message));
      console.error(err);
    }
  };

  const getImageUrl = (imagePath) => {
    if (!imagePath) return 'https://via.placeholder.com/100?text=No+Image';
    if (imagePath.startsWith('http')) return imagePath;
    if (API_BASE_URL) return `${API_BASE_URL}${imagePath}`;
    return imagePath;
  };

  if (loading) {
    return <div className="product-management"><div className="loading">Loading your products...</div></div>;
  }

  return (
    <div className="product-management">
      <div className="pm-header">
        <h2>Product Management</h2>
        <p className="pm-subtitle">Manage your products, images, and inventory</p>
      </div>

      {message && (
        <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
          {message}
        </div>
      )}

      {products.length === 0 ? (
        <div className="empty-products">
          <p>You haven't created any products yet.</p>
          <p style={{ color: '#999', fontSize: '14px' }}>Click "Sell" above to create your first product.</p>
        </div>
      ) : (
        <div className="products-grid">
          {products.map(product => (
            <div key={product.id} className="product-card">
              <div className="product-image-container">
                <img
                  src={getImageUrl(product.image_url)}
                  alt={product.name}
                  className="product-image"
                  onError={(e) => {
                    e.target.src = 'https://via.placeholder.com/100?text=No+Image';
                  }}
                />
                <div className="stock-badge">
                  Stock: <strong>{product.stock}</strong>
                </div>
              </div>

              <div className="product-details">
                <h3>{product.name}</h3>
                <p className="description">{product.description ? product.description.substring(0, 50) + '...' : 'No description'}</p>

                <div className="product-info">
                  <div className="info-row">
                    <span className="label">Price:</span>
                    <span className="value">₹{product.price.toFixed(2)}</span>
                  </div>
                  <div className="info-row">
                    <span className="label">Category:</span>
                    <span className="value">{product.category_name || 'N/A'}</span>
                  </div>
                  {product.sku && (
                    <div className="info-row">
                      <span className="label">SKU:</span>
                      <span className="value">{product.sku}</span>
                    </div>
                  )}
                  {product.model_number && (
                    <div className="info-row">
                      <span className="label">Model:</span>
                      <span className="value">{product.model_number}</span>
                    </div>
                  )}
                </div>

                <div className="product-actions">
                  <button
                    className="btn btn-primary"
                    onClick={() => onEditProduct(product)}
                    title="Edit product details"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    className="btn btn-info"
                    onClick={() => onManageImages(product)}
                    title="Manage product images"
                  >
                    📸 Images
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => setDeleteConfirm(product.id)}
                    title="Delete product"
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>

              {deleteConfirm === product.id && (
                <div className="delete-confirmation">
                  <p>Delete "{product.name}"?</p>
                  <div className="confirm-actions">
                    <button
                      className="btn-confirm-yes"
                      onClick={() => handleDeleteProduct(product.id)}
                    >
                      Yes, Delete
                    </button>
                    <button
                      className="btn-confirm-no"
                      onClick={() => setDeleteConfirm(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductManagement;
