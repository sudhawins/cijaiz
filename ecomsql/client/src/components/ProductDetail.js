import React, { useState, useEffect, useCallback } from 'react';
import { addToWishlist, getWishlist, removeFromWishlist } from '../api';
import { getProductById, getProducts, addToCart, API_BASE_URL } from '../api';
import { isAuthenticated } from '../utils/authUtils';
import './ProductDetail.css';

const ProductDetail = ({ productId, onBackClick, isAuthenticated: isAuthenticatedProp = null, user = null }) => {
  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // Use prop if provided, otherwise use utility function
  const authenticated = isAuthenticatedProp !== null ? isAuthenticatedProp : isAuthenticated();

  const loadProductDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      // Load main product
      const response = await getProductById(productId);
      console.log('[ProductDetail] Full API Response:', response);
      console.log('[ProductDetail] Response Status:', response.status);
      console.log('[ProductDetail] Response Data:', response.data);
      
      // Handle response - check if data is wrapped in additional property
      let productData = response.data;
      console.log('[ProductDetail] Product Data structure:', productData);
      console.log('[ProductDetail] Has images?:', productData?.images);
      console.log('[ProductDetail] Images array:', productData?.images);
      
      if (!productData) {
        setError('Failed to load product data');
        setLoading(false);
        return;
      }
      
      setProduct(productData);
      setActiveImageIndex(0);

      // Load related products from same category
      if (response.data.category_id) {
        const relatedResponse = await getProducts({ categoryId: response.data.category_id });
        const filtered = Array.isArray(relatedResponse.data)
          ? relatedResponse.data.filter(p => p.id !== parseInt(productId)).slice(0, 4)
          : [];
        setRelatedProducts(filtered);
      }
    } catch (err) {
      setError('Failed to load product details');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    loadProductDetails();
  }, [productId, loadProductDetails]);

  const handleAddToCart = async () => {
    try {
      const sessionId = localStorage.getItem('sessionId') || 'session-' + Date.now();
      localStorage.setItem('sessionId', sessionId);

      await addToCart({
        sessionId,
        productId: product.id,
        quantity
      });

      setSuccess('Product added to cart successfully!');
      setTimeout(() => setSuccess(''), 3000);
      setQuantity(1);
    } catch (err) {
      setError('Failed to add product to cart');
      console.error(err);
    }
  };

  const handleQuantityChange = (newQuantity) => {
    if (newQuantity >= 1 && newQuantity <= (product?.stock || 0)) {
      setQuantity(newQuantity);
    }
  };

  const navigateImage = (direction) => {
    if (!product?.images || product.images.length === 0) return;
    
    let newIndex = activeImageIndex + direction;
    if (newIndex < 0) {
      newIndex = product.images.length - 1;
    } else if (newIndex >= product.images.length) {
      newIndex = 0;
    }
    setActiveImageIndex(newIndex);
  };

  const goToRelatedProduct = (relatedProductId) => {
    setProduct(null);
    setQuantity(1);
    setTimeout(() => {
      // This will trigger a reload by changing the productId prop
    }, 0);
  };

  if (loading) {
    return (
      <div className="product-detail-container">
        <div className="loading">Loading product details...</div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="product-detail-container">
        <div className="error">Product not found</div>
        <button className="back-link" onClick={onBackClick}>← Back to Products</button>
      </div>
    );
  }

  const mainImage = product.images && product.images.length > 0 
    ? product.images[activeImageIndex]?.image_url 
    : null;

  const inStock = product.stock > 0;
  const isPreorder = !!product.is_preorder;
  const discountPercent = 15; // Example discount
  const hasImages = product.images && product.images.length > 0;

  // Helper function to get image URL
  const getImageUrl = (imagePath) => {
    if (!imagePath) return null;

    // If API_BASE_URL is set (local dev), use it
    if (API_BASE_URL) {
      console.log('Using API_BASE_URL Product Detail:', API_BASE_URL);
      return `${API_BASE_URL}${imagePath}`;
    }

    // If it's already an absolute path, use it as-is
    if (imagePath.startsWith('http') || imagePath.startsWith('/')) {
      return imagePath;
    }

    // Otherwise prepend relative path
    return `/${imagePath}`;
  };

  return (
    <div className="product-detail-container">
      <button className="back-link" onClick={onBackClick}>← Back to Products</button>

      <div className="product-detail-content">
        {/* Left: Image Gallery */}
        <div className="product-images-section">
          <div className="main-image-wrapper">
            {mainImage ? (
              <img 
                src={getImageUrl(mainImage)} 
                alt={product.name}
                className="main-image"
                onError={(e) => {
                  console.log('[ProductDetail] Image failed to load:', e.target.src);
                  e.target.style.display = 'none';
                }}
              />
            ) : (
              <div style={{ textAlign: 'center', zIndex: 1 }}>
                <div style={{ fontSize: '60px', marginBottom: '10px' }}>📷</div>
                <p style={{ color: '#999', margin: 0 }}>No image available</p>
              </div>
            )}
            {!inStock && !isPreorder && <div className="out-of-stock-overlay">Out of Stock</div>}
            {isPreorder && <div className="preorder-overlay">Pre-Order</div>}
            {discountPercent > 0 && !isPreorder && (
              <div className="discount-badge">{discountPercent}% OFF</div>
            )}
            
            {hasImages && product.images.length > 1 && (
              <div className="image-nav">
                <button 
                  className="nav-btn prev-btn" 
                  onClick={() => navigateImage(-1)}
                  aria-label="Previous image"
                >
                  &#10094;
                </button>
                <button 
                  className="nav-btn next-btn" 
                  onClick={() => navigateImage(1)}
                  aria-label="Next image"
                >
                  &#10095;
                </button>
              </div>
            )}
          </div>

          {hasImages && product.images.length > 1 && (
            <div className="thumbnails">
              {product.images.map((img, index) => (
                <button
                  key={index}
                  className={`thumbnail ${index === activeImageIndex ? 'active' : ''}`}
                  onClick={() => setActiveImageIndex(index)}
                  aria-label={`View image ${index + 1}`}
                >
                  <img 
                    src={getImageUrl(img.image_url)}
                    alt={`${product.name} - ${index + 1}`}
                    onError={(e) => {
                      console.log('[ProductDetail] Thumbnail failed to load:', e.target.src);
                      e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="70" height="70"%3E%3Crect fill="%23f5f5f5" width="70" height="70"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-size="12"%3E📷%3C/text%3E%3C/svg%3E';
                    }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Product Info */}
        <div className="product-info-section">
          <div className="breadcrumb">
            <span onClick={onBackClick} style={{ cursor: 'pointer' }}>Home</span>
            <span className="separator">›</span>
            <span>{product.category_name || 'Category'}</span>
            <span className="separator">›</span>
            <span className="current">{product.name}</span>
          </div>

          <h1 className="product-name">{product.name}</h1>

          <div className="rating-section">
            <div className="stars">★★★★★</div>
            <span className="review-count">(128 reviews)</span>
          </div>

          <div className="price-section">
            <span className="current-price">₹{product.price.toFixed(2)}</span>
            <span className="original-price">₹{(product.price * 1.18).toFixed(2)}</span>
            <span className="savings">Save ₹{((product.price * 1.18) - product.price).toFixed(2)}</span>
          </div>

          <div className="product-meta">
            <div className="meta-item">
              <span className="label">SKU:</span>
              <span className="value">{product.sku || 'N/A'}</span>
            </div>
            {product.model_number && (
              <div className="meta-item">
                <span className="label">Model:</span>
                <span className="value">{product.model_number}</span>
              </div>
            )}
            <div className="meta-item">
              <span className="label">Category:</span>
              <span className="value">{product.category_name || 'General'}</span>
            </div>
            <div className="meta-item">
              <span className="label">In Stock:</span>
              <span className={`value ${inStock ? 'in-stock' : 'out-of-stock'}`}>
                {isPreorder
                  ? 'Pre-Order'
                  : inStock
                    ? `${product.stock} available`
                    : 'Out of Stock'}
              </span>
            </div>
            {isPreorder && product.preorder_release_date && (
              <div className="meta-item">
                <span className="label">Release Date:</span>
                <span className="value preorder-release-date">
                  {new Date(product.preorder_release_date).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              </div>
            )}
          </div>

          <div className="product-features">
            <h3>Key Features</h3>
            <ul>
              <li>High-quality product</li>
              <li>Fast shipping available</li>
              <li>2-day return policy</li>
              <li>Secure payment options</li>
            </ul>
          </div>

          <div className="description-section">
            <h3>Description</h3>
            <p className="product-description">
              {product.description || 'No description available'}
            </p>
          </div>

          {/* Add to Cart Section */}
          <div className="cart-section">
            <div className="quantity-selector">
              <label htmlFor="quantity">Quantity:</label>
              <div className="quantity-controls">
                <button 
                  className="qty-btn"
                  onClick={() => handleQuantityChange(quantity - 1)}
                  disabled={quantity <= 1 || (!isPreorder && !inStock)}
                >
                  −
                </button>
                <input 
                  id="quantity"
                  type="number" 
                  min="1" 
                  max={product.stock || 1}
                  value={quantity}
                  onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
                  disabled={!isPreorder && !inStock}
                />
                <button 
                  className="qty-btn"
                  onClick={() => handleQuantityChange(quantity + 1)}
                  disabled={quantity >= (product.stock || 1) || (!isPreorder && !inStock)}
                >
                  +
                </button>
              </div>
            </div>

            {success && <div className="success-message">{success}</div>}
            {error && <div className="error-message">{error}</div>}

            <button 
              className={`add-to-cart-btn ${isPreorder ? 'preorder-action-btn' : ''} ${(!isPreorder && !inStock) ? 'disabled' : ''}`}
              onClick={handleAddToCart}
              disabled={!isPreorder && (!inStock || quantity < 1)}
            >
              {isPreorder ? '⏳ Pre-Order Now' : !inStock ? 'Out of Stock' : '🛒 Add to Cart'}
            </button>

            <button
              className="wishlist-btn"
              onClick={async () => {
                if (!authenticated) {
                  const shouldLogin = window.confirm('You need to be logged in to add items to wishlist. Would you like to login?');
                  if (shouldLogin) window.location.href = '/login';
                  return;
                }
                try {
                  await addToWishlist(product.id);
                  setSuccess('Added to wishlist!');
                  setTimeout(() => setSuccess(''), 2000);
                } catch (err) {
                  setError('Failed to add to wishlist');
                  setTimeout(() => setError(''), 2000);
                }
              }}
            >
              ♡ Add to Wishlist
            </button>
          </div>

          {/* Shipping Info */}
          <div className="shipping-info">
            <div className="shipping-item">
              <span className="icon">🚚</span>
              <div>
                <strong>Free Shipping</strong>
                <p>On orders over ₹5000</p>
              </div>
            </div>
            <div className="shipping-item">
              <span className="icon">↩️</span>
              <div>
                <strong>Easy Returns</strong>
                <p>2-day return policy</p>
              </div>
            </div>
            <div className="shipping-item">
              <span className="icon">✓</span>
              <div>
                <strong>Secure Payment</strong>
                <p>SSL encrypted checkout</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <div className="related-products-section">
          <h2>Related Products</h2>
          <div className="related-products-grid">
            {relatedProducts.map(item => (
              <div key={item.id} className="related-product-card" onClick={() => goToRelatedProduct(item.id)}>
                <div className="related-image-wrapper">
                  {item.image_url ? (
                    <img 
                      src={getImageUrl(item.image_url)} 
                      alt={item.name}
                      onError={(e) => {
                        console.log('[ProductDetail] Related product image failed:', e.target.src);
                        e.target.src = '/placeholder.png';
                      }}
                    />
                  ) : (
                    <div className="placeholder">No Image</div>
                  )}
                  {item.stock <= 0 && <div className="stock-badge">Out of Stock</div>}
                </div>
                <h4>{item.name}</h4>
                <p className="related-price">₹{item.price.toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductDetail;
