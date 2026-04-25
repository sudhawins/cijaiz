import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import ProductListing from './components/ProductListing';
import Wishlist from './components/Wishlist';
import RefundPolicy from './components/RefundPolicy';
import ProductDetail from './components/ProductDetail';
import ProductUpload from './components/ProductUpload';
import ProductManagement from './components/ProductManagement';
import EditProduct from './components/EditProduct';
import ProductImagesManagement from './components/ProductImagesManagement';
import CategoryManagement from './components/CategoryManagement';
import ImageUpload from './components/ImageUpload';
import ShoppingCart from './components/ShoppingCart';
import OrderManagement from './components/OrderManagement';
import RewardsManagement from './components/RewardsManagement';
import AdminPanel from './components/AdminPanel';
import Login from './components/Login';
import Register from './components/Register';
import UserProfile from './components/UserProfile';
import SearchableCategoryDropdown from './components/SearchableCategoryDropdown';
import { RoleBasedRoute } from './components/ProtectedRoute';
import { getUser, hasRole, hasAnyRole, isAuthenticated } from './utils/authUtils';
import { getCartItems, getCategories } from './api';
import { useDebounce } from './utils/useDebounce';
import './App.css';

// Error Boundary
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', color: 'red', fontFamily: 'monospace' }}>
          <h2>⚠️ Error Loading Page</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false, error: null })}>
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/refund-policy" element={<RefundPolicy />} />
          <Route
            path="/*"
            element={<MainApp />}
          />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

function MainApp() {
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [currentPage, setCurrentPage] = useState('products');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [cartCount, setCartCount] = useState(0);
  const [editingProduct, setEditingProduct] = useState(null);
  const [managingImagesProduct, setManagingImagesProduct] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [categories, setCategories] = useState([]);
  const [isGuestAuthPanelOpen, setIsGuestAuthPanelOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const guestAuthPanelRef = useRef(null);
  const mobileNavRef = useRef(null);

  const loadCategories = useCallback(async () => {
    try {
      const response = await getCategories();
      setCategories(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error('Error loading categories:', err);
      setCategories([]);
    }
  }, []);

  const updateCartCount = useCallback(async () => {
    try {
      const sessionId = localStorage.getItem('sessionId');
      if (!sessionId) {
        setCartCount(0);
        return;
      }
      const response = await getCartItems(sessionId);
      const items = Array.isArray(response.data) ? response.data : [];
      setCartCount(items.length);
    } catch (err) {
      console.error('Error fetching cart count:', err);
      setCartCount(0);
    }
  }, []);

  useEffect(() => {
    const storedUser = getUser();
    if (storedUser) {
      setUser(storedUser);
    }
    updateCartCount();
    loadCategories();
  }, [updateCartCount, loadCategories]);

  useEffect(() => {
    const syncUserFromStorage = () => {
      const storedUser = getUser();
      setUser(storedUser || null);
    };

    window.addEventListener('auth-changed', syncUserFromStorage);
    window.addEventListener('storage', syncUserFromStorage);

    return () => {
      window.removeEventListener('auth-changed', syncUserFromStorage);
      window.removeEventListener('storage', syncUserFromStorage);
    };
  }, []);

  useEffect(() => {
    if (!isGuestAuthPanelOpen) {
      return undefined;
    }

    const handleOutsideClick = (event) => {
      if (guestAuthPanelRef.current && !guestAuthPanelRef.current.contains(event.target)) {
        setIsGuestAuthPanelOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isGuestAuthPanelOpen]);

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    setUser(null);
    window.location.href = '/login';
  };

  const handleSearch = () => {
    console.log('Search button clicked');
    console.log('Search query:', searchQuery);
    if (searchQuery.trim()) {
      setCurrentPage('products');
    } else {
      alert('Please enter a search term');
    }
  };

  const handleClearSearch = () => {
    console.log('[App] Clearing search');
    setSearchQuery('');
    setCurrentPage('products');
  };

  const handleLoginNavigation = () => {
    setIsGuestAuthPanelOpen(false);
    window.location.href = '/login';
  };

  const handleRegisterNavigation = () => {
    setIsGuestAuthPanelOpen(false);
    window.location.href = '/register';
  };

  const navigateTo = (page) => {
    setCurrentPage(page);
    setIsMobileNavOpen(false);
  };

  const renderPage = () => {
    // Handle /wishlist URL path
    if (location.pathname === '/wishlist') {
      if (!isAuthenticated()) {
        window.location.href = '/login';
        return null;
      }
      return <Wishlist />;
    }

    // Redirect to login if trying to access protected pages
    const protectedPages = ['orders', 'profile'];
    if (protectedPages.includes(currentPage) && !isAuthenticated()) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '60vh',
          textAlign: 'center',
          padding: '20px',
          background: '#f5f5f5'
        }}>
          <h2 style={{ color: '#0066cc', marginBottom: '10px' }}>Login Required</h2>
          <p style={{ color: '#666', marginBottom: '20px' }}>
            Please log in to access this feature.
          </p>
          <div>
            <button
              onClick={() => window.location.href = '/login'}
              style={{
                padding: '12px 24px',
                background: '#0066cc',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: '600',
                marginRight: '10px'
              }}
            >
              Login
            </button>
            <button
              onClick={() => window.location.href = '/register'}
              style={{
                padding: '12px 24px',
                background: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: '600'
              }}
            >
              Register
            </button>
          </div>
        </div>
      );
    }

    switch (currentPage) {
      case 'products':
        return (
          <ProductListing 
            searchQuery={debouncedSearchQuery} 
            setSearchQuery={setSearchQuery}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            onViewProductDetail={(productId) => {
              setSelectedProductId(productId);
              setCurrentPage('productDetail');
            }}
            onProductAdded={updateCartCount}
            isAuthenticated={isAuthenticated()}
            user={user}
          />
        );
      case 'productDetail':
        return (
          <ProductDetail 
            productId={selectedProductId}
            onBackClick={() => setCurrentPage('products')}
            isAuthenticated={isAuthenticated()}
            user={user}
          />
        );
      case 'upload':
        return (
          <RoleBasedRoute requiredRole="Seller">
            <ProductUpload />
          </RoleBasedRoute>
        );
      case 'manage':
        return (
          <RoleBasedRoute requiredRole="Seller">
            <>
              <ProductManagement 
                onEditProduct={(product) => setEditingProduct(product)}
                onManageImages={(product) => setManagingImagesProduct(product)}
              />
              {editingProduct && (
                <EditProduct
                  product={editingProduct}
                  onClose={() => setEditingProduct(null)}
                  onSaved={() => {
                    setEditingProduct(null);
                    // Refresh product management list
                  }}
                />
              )}
              {managingImagesProduct && (
                <ProductImagesManagement
                  product={managingImagesProduct}
                  onClose={() => setManagingImagesProduct(null)}
                />
              )}
            </>
          </RoleBasedRoute>
        );
      case 'categories':
        return (
          <RoleBasedRoute requiredRole="Seller">
            <CategoryManagement onClose={() => setCurrentPage('manage')} />
          </RoleBasedRoute>
        );
      case 'images':
        return (
          <RoleBasedRoute requiredRole="Seller">
            <ImageUpload />
          </RoleBasedRoute>
        );
      case 'cart':
        return (
          <ShoppingCart 
            onCartCountChange={setCartCount}
            onOrderComplete={() => {
              if (isAuthenticated()) {
                setCurrentPage('orders');
              }
            }}
          />
        );
      case 'orders':
        return <OrderManagement />;
      case 'rewards':
        return (
          <RoleBasedRoute requiredRole="Seller">
            <RewardsManagement />
          </RoleBasedRoute>
        );
      case 'admin':
        return (
          <RoleBasedRoute requiredRole={['Administrator', 'Seller']}>
            <AdminPanel />
          </RoleBasedRoute>
        );
      case 'profile':
        return <UserProfile />;
      default:
        return (
          <ProductListing 
            searchQuery={searchQuery} 
            setSearchQuery={setSearchQuery}
            onViewProductDetail={(productId) => {
              setSelectedProductId(productId);
              setCurrentPage('productDetail');
            }}
            onProductAdded={updateCartCount}
            isAuthenticated={isAuthenticated()}
            user={user}
          />
        );
    }
  };

  return (
    <div className="App">
      <header className="app-header">
        <div className="header-top-row">
          <div className="header-content">
            <h1>✨ VSM - Sparkle Nest</h1>
          </div>

          {/* Desktop nav */}
          {!isAuthenticated() && (
            <nav className="main-nav guest-nav desktop-nav">
              <button className={`nav-link ${currentPage === 'products' ? 'active' : ''}`} onClick={() => navigateTo('products')}>Browse</button>
              <button className={`nav-link ${currentPage === 'cart' ? 'active' : ''}`} onClick={() => navigateTo('cart')} style={{ position: 'relative' }}>
                🛒 Cart
                {cartCount > 0 && <span className="cart-badge-pill">{cartCount}</span>}
              </button>
            </nav>
          )}
          {isAuthenticated() && (
            <nav className="main-nav desktop-nav">
              <button className={`nav-link ${currentPage === 'products' ? 'active' : ''}`} onClick={() => navigateTo('products')}>Browse</button>
              <button className={`nav-link ${currentPage === 'orders' ? 'active' : ''}`} onClick={() => navigateTo('orders')}>My Orders</button>
              <button className={`nav-link ${currentPage === 'cart' ? 'active' : ''}`} onClick={() => navigateTo('cart')} style={{ position: 'relative' }}>
                🛒 Cart
                {cartCount > 0 && <span className="cart-badge-pill">{cartCount}</span>}
              </button>
              {user && (hasRole('Seller') || hasRole('Administrator')) && (
                <>
                  <button className={`nav-link ${currentPage === 'upload' ? 'active' : ''}`} onClick={() => navigateTo('upload')}>New Product</button>
                  <button className={`nav-link ${currentPage === 'manage' ? 'active' : ''}`} onClick={() => navigateTo('manage')}>My Products</button>
                  <button className={`nav-link ${currentPage === 'categories' ? 'active' : ''}`} onClick={() => navigateTo('categories')}>Categories</button>
                  <button className={`nav-link ${currentPage === 'rewards' ? 'active' : ''}`} onClick={() => navigateTo('rewards')}>Rewards</button>
                </>
              )}
              {user && hasAnyRole(['Administrator', 'Seller']) && (
                <button className={`nav-link admin-link ${currentPage === 'admin' ? 'active' : ''}`} onClick={() => navigateTo('admin')}>Admin</button>
              )}
              {user && (
                <div className="nav-user-section">
                  <button onClick={() => navigateTo('profile')} className={`nav-link nav-name ${currentPage === 'profile' ? 'active' : ''}`}>
                    👤 {user.name}
                  </button>
                  <button onClick={handleLogout} className="nav-link logout-nav">Logout</button>
                </div>
              )}
            </nav>
          )}

          {/* Guest account dropdown */}
          {!isAuthenticated() && (
            <div className="guest-auth-menu" ref={guestAuthPanelRef}>
              <button
                type="button"
                className={`guest-auth-toggle ${isGuestAuthPanelOpen ? 'open' : ''}`}
                onClick={() => setIsGuestAuthPanelOpen((prev) => !prev)}
                aria-expanded={isGuestAuthPanelOpen}
                aria-controls="guest-auth-panel"
              >
                Account <span className="guest-auth-caret">{isGuestAuthPanelOpen ? '▴' : '▾'}</span>
              </button>
              {isGuestAuthPanelOpen && (
                <div id="guest-auth-panel" className="guest-auth-panel">
                  <button type="button" className="auth-action-button login-action" onClick={handleLoginNavigation}>Login</button>
                  <button type="button" className="auth-action-button register-action" onClick={handleRegisterNavigation}>Register</button>
                </div>
              )}
            </div>
          )}

          {/* Mobile hamburger */}
          <button
            className={`hamburger-btn ${isMobileNavOpen ? 'open' : ''}`}
            onClick={() => setIsMobileNavOpen((prev) => !prev)}
            aria-label="Toggle navigation menu"
            aria-expanded={isMobileNavOpen}
          >
            <span className="hamburger-bar" />
            <span className="hamburger-bar" />
            <span className="hamburger-bar" />
          </button>
        </div>

        {/* Search bar row */}
        <div className="header-search-row">
          <div className="header-search">
            <input
              type="text"
              placeholder="Search for products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <SearchableCategoryDropdown
              categories={categories}
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              placeholder="All Categories"
            />
            <button
              onClick={handleSearch}
              className="search-submit-btn"
              title={searchQuery !== debouncedSearchQuery ? 'Searching...' : 'Search'}
            >
              {searchQuery !== debouncedSearchQuery ? '⏳' : '🔍'} Search
            </button>
            {searchQuery && (
              <button onClick={handleClearSearch} className="search-clear-btn" title="Clear search">
                ✕ Clear
              </button>
            )}
          </div>
        </div>

        {/* Mobile nav drawer */}
        {isMobileNavOpen && (
          <nav className="mobile-nav" ref={mobileNavRef}>
            <button className={`mobile-nav-link ${currentPage === 'products' ? 'active' : ''}`} onClick={() => navigateTo('products')}>🏠 Browse</button>
            <button className={`mobile-nav-link ${currentPage === 'cart' ? 'active' : ''}`} onClick={() => navigateTo('cart')}>
              🛒 Cart {cartCount > 0 && <span className="mobile-cart-count">{cartCount}</span>}
            </button>
            {isAuthenticated() && (
              <>
                <button className={`mobile-nav-link ${currentPage === 'orders' ? 'active' : ''}`} onClick={() => navigateTo('orders')}>📦 My Orders</button>
                {user && (hasRole('Seller') || hasRole('Administrator')) && (
                  <>
                    <button className={`mobile-nav-link ${currentPage === 'upload' ? 'active' : ''}`} onClick={() => navigateTo('upload')}>📝 New Product</button>
                    <button className={`mobile-nav-link ${currentPage === 'manage' ? 'active' : ''}`} onClick={() => navigateTo('manage')}>🗂️ My Products</button>
                    <button className={`mobile-nav-link ${currentPage === 'categories' ? 'active' : ''}`} onClick={() => navigateTo('categories')}>📋 Categories</button>
                    <button className={`mobile-nav-link ${currentPage === 'rewards' ? 'active' : ''}`} onClick={() => navigateTo('rewards')}>🎁 Rewards</button>
                  </>
                )}
                {user && hasAnyRole(['Administrator', 'Seller']) && (
                  <button className={`mobile-nav-link ${currentPage === 'admin' ? 'active' : ''}`} onClick={() => navigateTo('admin')}>🔐 Admin</button>
                )}
                {user && (
                  <>
                    <button className={`mobile-nav-link ${currentPage === 'profile' ? 'active' : ''}`} onClick={() => navigateTo('profile')}>👤 {user.name}</button>
                    <button className="mobile-nav-link mobile-logout" onClick={handleLogout}>🚪 Logout</button>
                  </>
                )}
              </>
            )}
            {!isAuthenticated() && (
              <>
                <button className="mobile-nav-link mobile-login" onClick={handleLoginNavigation}>Login</button>
                <button className="mobile-nav-link mobile-register" onClick={handleRegisterNavigation}>Create Account</button>
              </>
            )}
          </nav>
        )}
      </header>

      <main className="app-main">
        {renderPage()}
      </main>

      <footer className="app-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <span className="footer-logo">✨ VSM - Sparkle Nest</span>
            <p className="footer-tagline">Where Every Purchase Sparkles</p>
          </div>
          <div className="footer-links">
            <Link to="/refund-policy" className="footer-link">Refunds &amp; Returns</Link>
            <Link to="/wishlist" className="footer-link">My Wishlist</Link>
          </div>
          <div className="footer-copy">
            <p>&copy; 2026 VSM - Sparkle Nest. Fast &amp; Reliable Service.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
