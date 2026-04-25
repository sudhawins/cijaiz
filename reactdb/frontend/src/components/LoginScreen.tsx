import { useState } from 'react';
import { useAuth } from './AuthContext';
import RollingBanner from './RollingBanner';
import MapNavigation from './MapNavigation';
import './LoginScreen.css';

export default function LoginScreen() {
  const { login, error, clearError, loading } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const validateForm = (): boolean => {
    if (!username.trim()) {
      setFormError('Username is required');
      return false;
    }
    if (!password.trim()) {
      setFormError('Password is required');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    clearError();

    if (!validateForm()) {
      return;
    }

    try {
      await login(username, password);
    } catch (err) {
      // Error is already handled in AuthContext
      console.error('Login error:', err);
    }
  };

  return (
    <div className="login-container">
      {/* Banner at top */}
      <div className="login-banner-wrapper">
        <RollingBanner />
      </div>
      
      {/* Map Background Below Banner */}
      <div className="login-map-container">
        <MapNavigation 
          defaultZoom={13}
          defaultCenter={{ lat: 9.9252, lng: 78.1198 }}
        />
      </div>

      {/* Login Form Floating Over */}
      <div className="login-content">
        <div className="login-card">
          <div className="login-header">
            <div className="logo">🏢</div>
            <h1>Mansion App</h1>
            <p>Property Management System</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form" autoComplete="on">
            {error && (
              <div className="error-message">
                <span>⚠️</span>
                <div>
                  <p className="error-title">Login Failed</p>
                  <p className="error-text">{error}</p>
                </div>
              </div>
            )}

            {formError && (
              <div className="form-error-message">
                <span>⚠️</span>
                <p>{formError}</p>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="username">
                <span className="label-icon">👤</span>
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setFormError(null);
                }}
                placeholder="Enter your username"
                disabled={loading}
                required
                autoComplete="username"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">
                <span className="label-icon">🔒</span>
                Password
              </label>
              <div className="password-input-wrapper">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setFormError(null);
                  }}
                  placeholder="Enter your password"
                  disabled={loading}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="login-button"
              disabled={loading || !username.trim() || !password.trim()}
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Logging in...
                </>
              ) : (
                <>
                  <span>🔓</span>
                  Sign In
                </>
              )}
            </button>
          </form>

          <div className="login-footer">
            <p className="demo-hint">Demo Credentials Available</p>
            <p className="demo-text">Contact administrator for access</p>
          </div>
        </div>

        <div className="login-info">
          <div className="info-card">
            <h3>📊 Features</h3>
            <ul>
              <li>Tenant Management</li>
              <li>Room Occupancy Tracking</li>
              <li>Payment Tracking</li>
              <li>Rent Collection</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
