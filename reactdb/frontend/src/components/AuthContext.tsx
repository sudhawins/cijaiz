import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { login as apiLogin } from '../api';

interface User {
  id: number;
  username: string;
  name: string;
  roles: string;
  nextLoginDuration?: number | null;
  lastLogin?: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  error: string | null;
  clearError: () => void;
  hasRole: (role: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logoutTimer, setLogoutTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Setup auto-logout timer when user logs in
  const setupAutoLogout = (nextLoginDuration: number | null | undefined) => {
    console.log('[Auto-Logout] setupAutoLogout called with:', {
      nextLoginDuration,
      type: typeof nextLoginDuration,
      isValid: nextLoginDuration && nextLoginDuration > 0
    });

    // Clear any existing timer
    if (logoutTimer) {
      console.log('[Auto-Logout] Clearing existing timer');
      clearTimeout(logoutTimer);
    }

    // If nextLoginDuration is set and valid, schedule auto-logout
    if (nextLoginDuration && nextLoginDuration > 0) {
      // Convert days to milliseconds
      const timeoutMs = nextLoginDuration * 24 * 60 * 60 * 1000;
      console.log(`[Auto-Logout] Setting timer for ${nextLoginDuration} day(s) = ${timeoutMs}ms`, {
        nextLoginDuration,
        calculation: `${nextLoginDuration} * 24 * 60 * 60 * 1000`,
        daysInMs: 24 * 60 * 60 * 1000,
        totalSeconds: timeoutMs / 1000
      });
      
      if (Number.isFinite(nextLoginDuration) && nextLoginDuration > 0) {
          const timeoutMs = nextLoginDuration * 24 * 60 * 60 * 1000;
          console.log("Scheduling logout in", timeoutMs, "ms");
          const timer = setTimeout(logout, timeoutMs);
          setLogoutTimer(timer);
        } else {
          console.warn("Invalid nextLoginDuration:", nextLoginDuration);
        }

      // const timer = setTimeout(() => {
      //   console.log('[Auto-Logout] ⏰ Session expired, logging out user');
      //   logout();
      // }, timeoutMs);

      // setLogoutTimer(timer);
    } else {
      console.log('[Auto-Logout] No timer set - nextLoginDuration is null/undefined/invalid');
      setLogoutTimer(null);
    }
  };

  // Check if user is already logged in on mount
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('user');
      const storedToken = localStorage.getItem('authToken');
      
      console.log('[Auth] Checking for stored session on mount:', {
        hasStoredUser: !!storedUser,
        hasStoredToken: !!storedToken
      });
      
      if (storedUser && storedToken) {
        const parsedUser = JSON.parse(storedUser);
        console.log('[Auth] Restored user from localStorage:', {
          id: parsedUser.id,
          username: parsedUser.username,
          nextLoginDuration: parsedUser.nextLoginDuration
        });
        setUser(parsedUser);
        // Setup auto-logout for restored session
        setupAutoLogout(parsedUser.nextLoginDuration);
      } else {
        console.log('[Auth] No stored session found on mount');
      }
    } catch (err) {
      console.error('Error restoring auth state:', err);
      localStorage.removeItem('user');
      localStorage.removeItem('authToken');
      localStorage.removeItem('refreshToken');
    } finally {
      setLoading(false);
    }
  }, []);

  const login = async (username: string, password: string) => {
    try {
      setError(null);
      setLoading(true);
      
      const response = await apiLogin(username, password);
      
      // Validate response structure
      if (!response || !response.token || !response.user) {
        console.error('[Auth] Invalid response structure:', response);
        throw new Error('Invalid login response: missing token or user data');
      }
      
      console.log('[Auth] Login response received:', {
        token: response.token ? 'present' : 'missing',
        user: response.user,
        roles: response.user.roles,
        rolesType: typeof response.user.roles
      });
      
      // Validate that roles field exists and is a string
      if (!response.user.roles) {
        console.error('[Auth] Missing roles in response, defaulting to "user"');
        response.user.roles = 'user';
      }
      
      if (typeof response.user.roles !== 'string') {
        console.error('[Auth] Roles is not a string:', response.user.roles);
        response.user.roles = String(response.user.roles || 'user');
      }
      
      // Store token and user info
      localStorage.setItem('authToken', response.token);
      if (response.refreshToken) {
        localStorage.setItem('refreshToken', response.refreshToken);
      }
      localStorage.setItem('user', JSON.stringify(response.user));
      
      console.log('[Auth] User data stored in localStorage:', {
        user: {
          id: response.user.id,
          username: response.user.username,
          roles: response.user.roles,
          nextLoginDuration: response.user.nextLoginDuration,
          nextLoginDurationType: typeof response.user.nextLoginDuration
        }
      });
      
      setUser(response.user);
      
      // Setup auto-logout based on NextLoginDuration
      console.log('[Auth] About to setup auto-logout with nextLoginDuration:', response.user.nextLoginDuration);
      setupAutoLogout(response.user.nextLoginDuration);
    } catch (err) {
      const errorMessage = err instanceof Error 
        ? err.message 
        : 'Login failed. Please try again.';
      setError(errorMessage);
      console.error('[Auth Error]', { username, error: errorMessage });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    console.log('[Auth] logout() called', {
      hasTimer: !!logoutTimer,
      currentUser: user ? { id: user.id, username: user.username } : null,
      stack: new Error().stack
    });

    // Clear auto-logout timer
    if (logoutTimer) {
      console.log('[Auth] Clearing auto-logout timer');
      clearTimeout(logoutTimer);
      setLogoutTimer(null);
    }

    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setUser(null);
    setError(null);
  };

  useEffect(() => {
    const handleLogoutEvent = () => {
      logout();
    };

    window.addEventListener('auth:logout', handleLogoutEvent);
    return () => {
      window.removeEventListener('auth:logout', handleLogoutEvent);
    };
  }, [logout]);

  const clearError = () => {
    setError(null);
  };

  const hasRole = (role: string): boolean => {
    if (!user || !user.roles) return false;
    return user.roles.split(',').map(r => r.trim()).includes(role);
  };

  const hasAnyRole = (roles: string[]): boolean => {
    if (!user || !user.roles) return false;
    const userRoles = user.roles.split(',').map(r => r.trim()).filter(r => r);
    return roles.some(role => userRoles.includes(role));
  };

  const value: AuthContextType = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    logout,
    error,
    clearError,
    hasRole,
    hasAnyRole
  };

  // Cleanup timer on component unmount
  useEffect(() => {
    return () => {
      if (logoutTimer) {
        clearTimeout(logoutTimer);
      }
    };
  }, [logoutTimer]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
