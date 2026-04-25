import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getProducts, addToCart, API_BASE_URL, getWishlist } from '../api';
import { SearchCache } from '../utils/useDebounce';
import ViewPhotos from './ViewPhotos';
import './ProductListing.css';

// Rating star component
const RatingStars = ({ rating = 4.5, reviewCount = 0 }) => {
  const stars = Math.round(rating);
  return (
    <div className="rating-section">
      <span className="stars">{'★'.repeat(stars)}{'☆'.repeat(5 - stars)}</span>
      {reviewCount > 0 && <span className="review-count">({reviewCount} reviews)</span>}
    </div>
  );
};

// Memoized product card component
const ProductCard = React.memo(({ product, onAddToCart, onViewPhotos, isAuthenticated, isWishlisted, onWishlistAdd }) => {
  // Build image URL - works in both local dev and Docker
  const getImageUrl = () => {
    if (!product.image_url) {
      return 'https://via.placeholder.com/300?text=No+Image';
    }
    console.log('Original image URL:', product.image_url);
    // If it's an absolute URL, use it as-is
    if (product.image_url.startsWith('http')) {
      return product.image_url;
    }
    
    // If API_BASE_URL is set (local dev), use it
    if (API_BASE_URL) {
      console.log('Using API_BASE_URL:', API_BASE_URL);
      return `${API_BASE_URL}${product.image_url}`;
    }
    
    // In Docker with relative paths, use /uploads directly
    return product.image_url;
  };

  // Calculate discount percentage (mock data - replace with actual if available)
  const originalPrice = product.original_price || (product.price * 1.4);
  const discountPercent = Math.round(((originalPrice - product.price) / originalPrice) * 100);
  
  return (
    <div className={`product-card${isWishlisted ? ' wishlisted' : ''}`}>
      <div 
        className="product-image-wrapper"
        onClick={() => {
          if (ProductCard.onViewDetail) {
            ProductCard.onViewDetail(product.id);
          }
        }}
        style={{ cursor: 'pointer' }}
      >
        {product.stock === 0 && !product.is_preorder && <div className="out-of-stock-badge">Sold Out</div>}
        {product.is_preorder && <div className="preorder-badge">Pre-Order</div>}
        {product.stock > 0 && !product.is_preorder && discountPercent > 0 && (
          <span className="sale-badge">{discountPercent}% Off</span>
        )}
        <div className="product-image">
          <img 
            src={getImageUrl()}
            alt={product.name}
            loading="lazy"
            onError={(e) => { e.target.src = 'https://via.placeholder.com/300?text=No+Image'; }}
          />
        </div>
      </div>
      <div className="product-info">
        <h3>{product.name}</h3>
        {product.category_name && <p className="category">{product.category_name}</p>}
        {product.description && <p className="description">{product.description}</p>}
        
        <RatingStars rating={product.rating || 4.5} reviewCount={product.reviewCount || 0} />
        
        <div className="price-section">
          <span className="price">₹{product.price.toFixed(0)}</span>
          {originalPrice > product.price && (
            <span className="original-price">₹{originalPrice.toFixed(0)}</span>
          )}
        </div>
        
        <div className="product-actions">
          <button
            className={product.is_preorder ? 'preorder-btn' : 'add-to-cart-btn'}
            onClick={() => onAddToCart(product)}
            disabled={!product.is_preorder && product.stock === 0}
          >
            {product.is_preorder ? 'Pre-Order' : product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
          </button>
          <button
            className="view-details-btn"
            onClick={() => {
              if (ProductCard.onViewDetail) {
                ProductCard.onViewDetail(product.id);
              }
            }}
            title="View product details"
          >
            👁️
          </button>
          <button
            className="view-photos-btn"
            onClick={() => onViewPhotos(product)}
            title="View all product photos"
          >
            📸
          </button>
          {isAuthenticated && (
            <>
              <button
                className={`wishlist-btn${isWishlisted ? ' wishlisted' : ''}`}
                onClick={async () => {
                  try {
                    await import('../api').then(({ addToWishlist }) => addToWishlist(product.id));
                    if (onWishlistAdd) onWishlistAdd(product.id);
                  } catch (err) {
                    // Optionally show error in card
                  }
                }}
                title={isWishlisted ? 'Wishlisted' : 'Add to Wishlist'}
                disabled={isWishlisted}
              >
                {isWishlisted ? '♥' : '♡'}
              </button>
              {isWishlisted && <div className="wishlist-message">Added to wishlist!</div>}
            </>
          )}
        </div>
      </div>
    </div>
  );
});

ProductCard.displayName = 'ProductCard';

const ProductListing = ({ searchQuery: externalSearchQuery, setSearchQuery: externalSetSearchQuery, selectedCategory: externalSelectedCategory, setSelectedCategory: externalSetSelectedCategory, onViewProductDetail, onProductAdded, isAuthenticated = false, user = null }) => {
  const [products, setProducts] = useState([]);
  const [wishlistIds, setWishlistIds] = useState([]);
  const [expandedCategories, setExpandedCategories] = useState({});
  // Used to trigger re-render for wishlist message
  const [wishlistAdded, setWishlistAdded] = useState([]);
    // Load wishlist for highlighting
    useEffect(() => {
      if (!isAuthenticated) {
        setWishlistIds([]);
        return;
      }
      getWishlist().then(res => {
        if (Array.isArray(res.data)) {
          setWishlistIds(res.data.map(item => item.product_id));
        }
      }).catch(() => setWishlistIds([]));
    }, [isAuthenticated]);
  const [searchQuery, setSearchQuery] = useState(externalSearchQuery || '');
  const [selectedCategory, setSelectedCategory] = useState(externalSelectedCategory || '');
  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [rowScrollState, setRowScrollState] = useState({});

  // Create a cache instance that persists across renders
  const cacheRef = useRef(new SearchCache());
  const scrollRowRefs = useRef({});

  // Store the callback for ProductCard to use
  ProductCard.onViewDetail = onViewProductDetail;

  // Use external search query if provided
  useEffect(() => {
    console.log('[ProductListing] External search query changed:', externalSearchQuery);
    setSearchQuery(externalSearchQuery || '');
  }, [externalSearchQuery]);

  // Use external selected category if provided
  useEffect(() => {
    console.log('[ProductListing] External selected category changed:', externalSelectedCategory);
    setSelectedCategory(externalSelectedCategory || '');
  }, [externalSelectedCategory]);

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedCategory) params.categoryId = selectedCategory;
      if (searchQuery) params.search = searchQuery;
      
      // Check cache first
      const cacheKey = `${searchQuery}|${selectedCategory}`;
      const cachedResults = cacheRef.current.getIfValid(searchQuery, selectedCategory);
      
      if (cachedResults) {
        console.log('[ProductListing] Using cached results for:', cacheKey);
        setProducts(cachedResults);
        setError(null);
        setLoading(false);
        return;
      }
      
      console.log('[ProductListing] Loading products with params:', params);
      const response = await getProducts(params);
      
      // Handle both old format (array) and new format (object with data property)
      let loadedProducts = [];
      if (Array.isArray(response.data)) {
        loadedProducts = response.data;
      } else if (response.data?.data && Array.isArray(response.data.data)) {
        loadedProducts = response.data.data;
      }
      
      // Cache the results
      cacheRef.current.set(searchQuery, loadedProducts, selectedCategory);
      
      console.log('[ProductListing] Products loaded:', loadedProducts.length, 'items');
      setProducts(loadedProducts);
      setError(null);
    } catch (err) {
      setError('Failed to load products');
      console.error('[ProductListing] Error loading products:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    console.log('[ProductListing] Category or search changed - loading products');
    loadProducts();
  }, [selectedCategory, searchQuery, loadProducts]);

  const handleAddToCart = useCallback(async (product) => {
    try {
      const sessionId = localStorage.getItem('sessionId') || 'session-' + Date.now();
      localStorage.setItem('sessionId', sessionId);
      
      await addToCart({
        sessionId,
        productId: product.id,
        quantity: 1
      });
      
      // Show notification
      setNotification({
        icon: '✓',
        message: 'Product added to cart!',
        type: 'success'
      });
      
      // Auto-hide notification after 3 seconds
      setTimeout(() => setNotification(null), 3000);
      
      // Notify parent component to update cart count
      if (onProductAdded) {
        onProductAdded();
      }
    } catch (err) {
      setNotification({
        icon: '✕',
        message: 'Failed to add to cart',
        type: 'error'
      });
      setTimeout(() => setNotification(null), 3000);
      console.error(err);
    }
  }, [onProductAdded]);

  const handleViewPhotos = useCallback((product) => {
    setSelectedProduct(product);
  }, []);

  const getProductSubcategory = useCallback((product) => {
    return (
      product.subcategory_name ||
      product.sub_category_name ||
      product.subcategory ||
      product.sub_category ||
      'General'
    );
  }, []);

  const groupedProducts = useMemo(() => {
    return products.reduce((acc, product) => {
      const category = product.category_name || 'Uncategorized';
      const subcategory = getProductSubcategory(product);

      if (!acc[category]) {
        acc[category] = {};
      }

      if (!acc[category][subcategory]) {
        acc[category][subcategory] = [];
      }

      acc[category][subcategory].push(product);
      return acc;
    }, {});
  }, [products, getProductSubcategory]);

  useEffect(() => {
    setExpandedCategories((prev) => {
      const next = { ...prev };

      Object.keys(groupedProducts).forEach((categoryName) => {
        if (typeof next[categoryName] !== 'boolean') {
          next[categoryName] = true;
        }
      });

      Object.keys(next).forEach((categoryName) => {
        if (!groupedProducts[categoryName]) {
          delete next[categoryName];
        }
      });

      return next;
    });
  }, [groupedProducts]);

  const toggleCategory = useCallback((categoryName) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [categoryName]: !prev[categoryName]
    }));
  }, []);

  const scrollCategoryRow = useCallback((rowKey, direction) => {
    const row = scrollRowRefs.current[rowKey];
    if (!row) return;

    const scrollAmount = 320;
    row.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  }, []);

  const updateRowScrollState = useCallback((rowKey) => {
    const row = scrollRowRefs.current[rowKey];
    if (!row) return;

    const maxScrollLeft = row.scrollWidth - row.clientWidth;
    const canScrollLeft = row.scrollLeft > 0;
    const canScrollRight = row.scrollLeft < maxScrollLeft - 1;

    setRowScrollState((prev) => {
      const existing = prev[rowKey];
      if (
        existing &&
        existing.canScrollLeft === canScrollLeft &&
        existing.canScrollRight === canScrollRight
      ) {
        return prev;
      }

      return {
        ...prev,
        [rowKey]: {
          canScrollLeft,
          canScrollRight
        }
      };
    });
  }, []);

  useEffect(() => {
    Object.keys(scrollRowRefs.current).forEach((rowKey) => {
      updateRowScrollState(rowKey);
    });
  }, [groupedProducts, updateRowScrollState]);

  useEffect(() => {
    const handleResize = () => {
      Object.keys(scrollRowRefs.current).forEach((rowKey) => {
        updateRowScrollState(rowKey);
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateRowScrollState]);
// Add style for wishlist message

  return (
    <>
      {notification && (
        <div className={`notification notification-${notification.type}`}>
          <span className="notification-icon">{notification.icon}</span>
          <span className="notification-message">{notification.message}</span>
        </div>
      )}
      <div className="product-listing">

        {error && <div className="error">{error}</div>}

        {loading ? (
          <div className="loading">
            <h2>Loading Products...</h2>
            <p>Please wait while we fetch the latest products</p>
          </div>
        ) : (
          <>
            {products.length > 0 && <h2 className="section-title">Featured Products</h2>}
            {products.length === 0 ? (
              <div className="products-grid">
                <div className="no-products">
                  <h2>No Products Found</h2>
                  <p>Try adjusting your search or filter criteria</p>
                </div>
              </div>
            ) : (
              <div className="category-sections">
                {Object.entries(groupedProducts).map(([categoryName, subcategoryGroups]) => {
                  const categoryProductCount = Object.values(subcategoryGroups).reduce(
                    (sum, items) => sum + items.length,
                    0
                  );
                  const isExpanded = expandedCategories[categoryName] !== false;

                  return (
                    <section className="category-section" key={categoryName}>
                      <button
                        type="button"
                        className="category-toggle"
                        onClick={() => toggleCategory(categoryName)}
                        aria-expanded={isExpanded}
                      >
                        <span className="category-heading-text">{categoryName}</span>
                        <span className="category-meta">{categoryProductCount} products</span>
                        <span className="category-toggle-icon">{isExpanded ? '−' : '+'}</span>
                      </button>

                      {isExpanded && (
                        <div className="subcategory-sections">
                          {Object.entries(subcategoryGroups).map(([subcategoryName, items]) => {
                            const rowKey = `${categoryName}-${subcategoryName}`;
                            const scrollState = rowScrollState[rowKey] || {
                              canScrollLeft: false,
                              canScrollRight: true
                            };
                            return (
                              <div className="subcategory-section" key={rowKey}>
                              <div className="subcategory-heading-row">
                                <h3 className="subcategory-heading">{subcategoryName}</h3>
                                <div className="subcategory-meta-actions">
                                  <span className="subcategory-count">{items.length}</span>
                                  <button
                                    type="button"
                                    className="scroll-arrow-btn"
                                    onClick={() => scrollCategoryRow(rowKey, 'left')}
                                    aria-label={`Scroll ${subcategoryName} left`}
                                    disabled={!scrollState.canScrollLeft}
                                  >
                                    ‹
                                  </button>
                                  <button
                                    type="button"
                                    className="scroll-arrow-btn"
                                    onClick={() => scrollCategoryRow(rowKey, 'right')}
                                    aria-label={`Scroll ${subcategoryName} right`}
                                    disabled={!scrollState.canScrollRight}
                                  >
                                    ›
                                  </button>
                                </div>
                              </div>
                              <div
                                className="category-products-scroll"
                                ref={(node) => {
                                  if (node) {
                                    scrollRowRefs.current[rowKey] = node;
                                    updateRowScrollState(rowKey);
                                  }
                                }}
                                onScroll={() => updateRowScrollState(rowKey)}
                              >
                                <div className="products-row">
                                  {items.map((product) => (
                                    <ProductCard
                                      key={product.id}
                                      product={product}
                                      onAddToCart={handleAddToCart}
                                      onViewPhotos={handleViewPhotos}
                                      isAuthenticated={isAuthenticated}
                                      isWishlisted={wishlistIds.includes(product.id) || wishlistAdded.includes(product.id)}
                                      onWishlistAdd={(id) => setWishlistAdded((prev) => [...prev, id])}
                                    />
                                  ))}
                                </div>
                              </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {selectedProduct && (
        <ViewPhotos
          productId={selectedProduct.id}
          productName={selectedProduct.name}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </>
  );
};

export default ProductListing;
