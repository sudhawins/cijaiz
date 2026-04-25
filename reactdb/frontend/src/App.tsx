import { useState, useEffect, useRef } from 'react';
import './App.css';
import './styles/mobile.css';
//import RentalCollection from './components/RentalCollection';
import RentalCollectionDetails from './components/RentalCollectionDetails';
import Diagnostic from './components/Diagnostic';
import PaymentTracking from './components/PaymentTracking';
import TenantManagement from './components/TenantManagement';
import RoomOccupancy from './components/RoomOccupancy';
import RoomManagement from './components/RoomManagement';
import OccupancyLinks from './components/OccupancyLinks';
import ComplaintsManagement from './components/ComplaintsManagement';
import ServiceDetailsManagement from './components/ServiceDetailsManagement';
import EBServicePaymentsManagement from './components/EBServicePaymentsManagement';
import LoginScreen from './components/LoginScreen';
import UserManagement from './components/UserManagement';
import RoleManagement from './components/RoleManagement';
import TransactionManagement from './components/TransactionManagement';
import StockManagement from './components/StockManagement';
import DailyStatusManagement from './components/DailyStatusManagement';
import GuestCheckinManagement from './components/GuestCheckinManagement';
import ServiceAllocationManagement from './components/ServiceAllocationManagement';
import RollingBanner from './components/RollingBanner';
import ServiceConsumptionDetails from './components/ServiceConsumptionDetails';
import MonthlyMeterReading from './components/MonthlyMeterReading';
import TenantElectricityCharges from './components/TenantElectricityCharges';
import { AuthProvider, useAuth } from './components/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';

type Page = 'home' | 'diagnostic' | 'payment' | 'rental-collection' | 'tenants' | 'occupancy' | 'room-wise-analysis' | 'room-management' | 'occupancy-links' | 'complaints' | 'services' | 'eb-payments' | 'users' | 'roles' | 'transactions' | 'stock' | 'daily-status' | 'guest-checkin' | 'service-allocation' | 'consumption' | 'meter-reading' | 'electricity-charges';

// Role requirements for each screen
const SCREEN_ROLES: Record<Page, string[]> = {
  home: [],
  diagnostic: ['admin'],
  payment: ['admin', 'manager', 'accountant'],
  'rental-collection': ['admin', 'manager', 'accountant', 'property_manager'],
  tenants: ['admin', 'manager', 'property_manager'],
  occupancy: ['admin', 'manager', 'property_manager'],
  'room-wise-analysis': ['admin', 'property_manager'],
  'room-management': ['admin', 'manager', 'property_manager'],
  'occupancy-links': ['admin'],
  complaints: ['admin', 'manager', 'maintenance'],
  services: ['admin'],
  'eb-payments': ['admin', 'manager', 'accountant'],
  users: ['admin'],
  roles: ['admin'],
  transactions: ['admin', 'manager', 'accountant'],
  stock: ['admin', 'manager', 'inventory_manager'],
  'daily-status': ['admin', 'manager', 'maintenance', 'property_manager'],
  'guest-checkin': ['admin', 'manager', 'maintenance', 'property_manager'],
  'service-allocation': ['admin'],
  consumption: ['admin', 'manager', 'utilities_manager'],
  'meter-reading': ['admin', 'manager', 'utilities_manager'],
  'electricity-charges': ['admin', 'manager', 'utilities_manager', 'accountant']
};

// Navigation menu items with labels and required roles
const NAV_ITEMS: Array<{ page: Page; label: string; roles: string[] }> = [
  { page: 'home', label: 'Home', roles: [] },
  { page: 'occupancy-links', label: 'Occupancy History', roles: SCREEN_ROLES['occupancy-links'] },
  { page: 'occupancy', label: 'Room Occupancy', roles: SCREEN_ROLES.occupancy },
  { page: 'room-wise-analysis', label: 'Room Wise Analysis', roles: SCREEN_ROLES['room-wise-analysis'] },
  { page: 'room-management', label: 'Room Management', roles: SCREEN_ROLES['room-management'] },
  { page: 'tenants', label: 'Tenant Management', roles: SCREEN_ROLES.tenants },
  { page: 'payment', label: 'Payment Tracking', roles: SCREEN_ROLES.payment },
  { page: 'rental-collection', label: 'Rental Collection', roles: SCREEN_ROLES['rental-collection'] },
  { page: 'meter-reading', label: 'EB Meter Reading', roles: SCREEN_ROLES['meter-reading'] },
  { page: 'electricity-charges', label: 'Electricity Charges', roles: SCREEN_ROLES['electricity-charges'] },
  { page: 'complaints', label: 'Complaints', roles: SCREEN_ROLES.complaints },
  { page: 'services', label: 'Service Details', roles: SCREEN_ROLES.services },
  { page: 'consumption', label: 'Service Consumption', roles: SCREEN_ROLES.consumption },
  { page: 'eb-payments', label: 'EB Payments', roles: SCREEN_ROLES['eb-payments'] },
  { page: 'users', label: 'Users', roles: SCREEN_ROLES.users },
  { page: 'roles', label: 'Roles & Access', roles: SCREEN_ROLES.roles },
  { page: 'transactions', label: 'Transactions', roles: SCREEN_ROLES.transactions },
  { page: 'stock', label: 'Stock', roles: SCREEN_ROLES.stock },
  { page: 'daily-status', label: 'Daily Status', roles: SCREEN_ROLES['daily-status'] },
  { page: 'guest-checkin', label: 'Guest Check-In', roles: SCREEN_ROLES['guest-checkin'] },
  { page: 'service-allocation', label: 'Service Allocation', roles: SCREEN_ROLES['service-allocation'] },
  { page: 'diagnostic', label: 'Diagnostic', roles: SCREEN_ROLES.diagnostic }
];

function AppContent() {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [headerHidden, setHeaderHidden] = useState(false);
  const lastScrollPosRef = useRef(0);
  const headerHiddenRef = useRef(false);
  const { isAuthenticated, user, logout } = useAuth();

  // Debug logging for authentication state
  useEffect(() => {
    console.log('[AppContent] Auth state changed:', {
      isAuthenticated,
      user: user ? { id: user.id, username: user.username, roles: user.roles } : null,
      timestamp: new Date().toISOString()
    });
  }, [isAuthenticated, user]);

  // Close mobile menu when page changes
  useEffect(() => {
    setMobileMenuOpen(false);
    setUserMenuOpen(false);
  }, [currentPage]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element | null;
      const userMenuEl = document.querySelector('.user-profile-dropdown');
      const navEl = document.querySelector('.header-nav');
      const clickedHamburger = Boolean(target?.closest('.hamburger-btn'));
      
      if (userMenuEl && !userMenuEl.contains(target as Node)) {
        setUserMenuOpen(false);
      }

      if (navEl && !navEl.contains(target as Node) && !clickedHamburger) {
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Auto-hide header on scroll
  useEffect(() => {
    let ticking = false;
    
    const handleScroll = () => {
      // Get scroll position from multiple sources for compatibility
      const scrollPos = window.scrollY || 
                       document.documentElement.scrollTop || 
                       document.body.scrollTop || 
                       0;
      
      const isScrollingDown = scrollPos > lastScrollPosRef.current;
      
      // Adaptive threshold based on screen size
      let scrollThreshold = 50; // Default for mobile
      
      if (window.innerWidth > 1024) {
        scrollThreshold = 100; // Desktop
      } else if (window.innerWidth > 768) {
        scrollThreshold = 75; // Tablet landscape
      } else {
        scrollThreshold = 50; // Tablet portrait and mobile
      }
      
      // Debug: log scroll events
      console.log('Scroll detected:', { scrollPos, isScrollingDown, scrollThreshold, headerHidden });
      
      if (isScrollingDown && scrollPos > scrollThreshold) {
        if (!headerHiddenRef.current) {
          headerHiddenRef.current = true;
          setHeaderHidden(true);
          console.log('Header hidden at scroll pos:', scrollPos);
        }
      } else if (scrollPos <= scrollThreshold || !isScrollingDown) {
        if (headerHiddenRef.current) {
          headerHiddenRef.current = false;
          setHeaderHidden(false);
          console.log('Header shown at scroll pos:', scrollPos);
        }
      }
      
      lastScrollPosRef.current = scrollPos;
      ticking = false;
    };
    
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(handleScroll);
        ticking = true;
      }
    };
    
    // Listen on multiple elements for compatibility
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('scroll', onScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('scroll', onScroll);
    };
  }, []);

  // If not authenticated, show login screen
  if (!isAuthenticated) {
    console.log('[AppContent] Not authenticated, showing login screen');
    return <LoginScreen />;
  }

  console.log('[AppContent] Authenticated, rendering app with currentPage:', currentPage);

  const renderPage = () => {
    if (currentPage === 'diagnostic') {
      return (
        <ProtectedRoute requiredRoles={SCREEN_ROLES.diagnostic}>
          <Diagnostic />
        </ProtectedRoute>
      );
    }

    if (currentPage === 'payment') {
      return (
        <ProtectedRoute requiredRoles={SCREEN_ROLES.payment}>
          <PaymentTracking />
        </ProtectedRoute>
      );
    }

    if (currentPage === 'rental-collection') {
      return (
        <ProtectedRoute requiredRoles={SCREEN_ROLES['rental-collection']}>
          <RentalCollectionDetails />
        </ProtectedRoute>
      );
    }

    if (currentPage === 'tenants') {
      return (
        <ProtectedRoute requiredRoles={SCREEN_ROLES.tenants}>
          <TenantManagement />
        </ProtectedRoute>
      );
    }

    if (currentPage === 'occupancy') {
      return (
        <ProtectedRoute requiredRoles={SCREEN_ROLES.occupancy}>
          <RoomOccupancy mode="occupancy" />
        </ProtectedRoute>
      );
    }

    if (currentPage === 'room-wise-analysis') {
      return (
        <ProtectedRoute requiredRoles={SCREEN_ROLES['room-wise-analysis']}>
          <RoomOccupancy mode="analysis" />
        </ProtectedRoute>
      );
    }

    if (currentPage === 'room-management') {
      return (
        <ProtectedRoute requiredRoles={SCREEN_ROLES['room-management']}>
          <RoomManagement />
        </ProtectedRoute>
      );
    }

    if (currentPage === 'occupancy-links') {
      return (
        <ProtectedRoute requiredRoles={SCREEN_ROLES['occupancy-links']}>
          <OccupancyLinks />
        </ProtectedRoute>
      );
    }

    if (currentPage === 'complaints') {
      return (
        <ProtectedRoute requiredRoles={SCREEN_ROLES.complaints}>
          <ComplaintsManagement />
        </ProtectedRoute>
      );
    }

    if (currentPage === 'services') {
      return (
        <ProtectedRoute requiredRoles={SCREEN_ROLES.services}>
          <ServiceDetailsManagement />
        </ProtectedRoute>
      );
    }

    if (currentPage === 'eb-payments') {
      return (
        <ProtectedRoute requiredRoles={SCREEN_ROLES['eb-payments']}>
          <EBServicePaymentsManagement />
        </ProtectedRoute>
      );
    }

    if (currentPage === 'users') {
      return (
        <ProtectedRoute requiredRoles={SCREEN_ROLES.users}>
          <UserManagement />
        </ProtectedRoute>
      );
    }

    if (currentPage === 'roles') {
      return (
        <ProtectedRoute requiredRoles={SCREEN_ROLES.roles}>
          <RoleManagement />
        </ProtectedRoute>
      );
    }

    if (currentPage === 'transactions') {
      return (
        <ProtectedRoute requiredRoles={SCREEN_ROLES.transactions}>
          <TransactionManagement />
        </ProtectedRoute>
      );
    }

    if (currentPage === 'stock') {
      return (
        <ProtectedRoute requiredRoles={SCREEN_ROLES.stock}>
          <StockManagement />
        </ProtectedRoute>
      );
    }

    if (currentPage === 'daily-status') {
      return (
        <ProtectedRoute requiredRoles={SCREEN_ROLES['daily-status']}>
          <DailyStatusManagement />
        </ProtectedRoute>
      );
    }

    if (currentPage === 'guest-checkin') {
      return (
        <ProtectedRoute requiredRoles={SCREEN_ROLES['guest-checkin']}>
          <GuestCheckinManagement />
        </ProtectedRoute>
      );
    }

    if (currentPage === 'service-allocation') {
      return (
        <ProtectedRoute requiredRoles={SCREEN_ROLES['service-allocation']}>
          <ServiceAllocationManagement />
        </ProtectedRoute>
      );
    }

    if (currentPage === 'consumption') {
      return (
        <ProtectedRoute requiredRoles={SCREEN_ROLES.consumption}>
          <ServiceConsumptionDetails />
        </ProtectedRoute>
      );
    }

    if (currentPage === 'meter-reading') {
      return (
        <ProtectedRoute requiredRoles={SCREEN_ROLES['meter-reading']}>
          <MonthlyMeterReading />
        </ProtectedRoute>
      );
    }

    if (currentPage === 'electricity-charges') {
      return (
        <ProtectedRoute requiredRoles={SCREEN_ROLES['electricity-charges']}>
          <TenantElectricityCharges />
        </ProtectedRoute>
      );
    }

    console.log('[AppContent] Rendering home page for user:', user?.username);
    return (
      <>
        <RollingBanner />
        <div className="container">
        </div>
      </>
    );
  };

  return (
    <>
      <div className={`top-header-bar ${headerHidden ? 'hidden' : ''}`}>
        <div className="header-left">
          <button 
            className="hamburger-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            title="Menu"
          >
            ☰
          </button>
          <div className="app-branding">
            <span className="app-logo">🏢</span>
            <span className="app-name">Mansion</span>
          </div>
        </div>
        
        <div className="header-center">
          <h2 className="page-title">
            {NAV_ITEMS.find(item => item.page === currentPage)?.label || 'Mansion'}
          </h2>
        </div>

        <div className={`header-nav ${mobileMenuOpen ? 'open' : ''}`}>
          <div className={`nav-items-container`}>
            {NAV_ITEMS.map(item => {
              const userRoles = user?.roles?.split(',').map(r => r.trim()).filter(r => r) || [];
              const hasAccess = item.roles.length === 0 || userRoles.some(r => item.roles.includes(r));

              if (!hasAccess) return null;

              return (
                <button
                  key={item.page}
                  className={`nav-item ${currentPage === item.page ? 'active' : ''}`}
                  onClick={() => {
                    setCurrentPage(item.page);
                    setMobileMenuOpen(false);
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {mobileMenuOpen && (
          <div
            className="mobile-nav-backdrop"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
        <div className="header-right">
          <div className="user-profile-dropdown">
            <button 
              className="user-profile-btn"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              title={user?.name || user?.username}
            >
              <span className="user-avatar">{(user?.name || user?.username || 'U')[0].toUpperCase()}</span>
              <span className="user-name-short">{user?.name || user?.username}</span>
              <span className="dropdown-arrow">▼</span>
            </button>
            
            {userMenuOpen && (
              <div className="user-dropdown-menu">
                <div className="dropdown-header">
                  <div className="dropdown-user-name">{user?.name || user?.username}</div>
                  <div className="dropdown-user-roles">{user?.roles || 'Guest'}</div>
                  {user?.lastLogin && (
                    <div className="dropdown-last-login">
                      Last Login: {new Date(user.lastLogin).toLocaleDateString()} {new Date(user.lastLogin).toLocaleTimeString()}
                    </div>
                  )}
                  {user?.nextLoginDuration && (
                    <div className="dropdown-next-login">
                      Valid for: {user.nextLoginDuration} day{user.nextLoginDuration !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
                <hr className="dropdown-divider" />
                <button 
                  className="dropdown-logout-btn"
                  onClick={() => {
                    setUserMenuOpen(false);
                    logout();
                  }}
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className={currentPage === 'home' ? 'main-content' : 'main-content with-top-space'}>
        {renderPage()}
      </div>
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
