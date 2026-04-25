import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUser } from '../api';
import './Login.css';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Email validation regex
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate email
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }
    if (!password.trim()) {
      setError('Phone number is required');
      return;
    }

    setLoading(true);

    try {
      // Use email as the login credential
      const response = await loginUser(email.trim().toLowerCase(), password.trim());
      
      console.log('[Login] Login successful. Response:', {
        hasToken: !!response.data.token,
        tokenLength: response.data.token?.length,
        user: response.data.user?.userName
      });
      
      // Store token and user data
      localStorage.setItem('authToken', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      localStorage.setItem('userPassword', password.trim());
      window.dispatchEvent(new Event('auth-changed'));

      console.log('[Login] Token saved to localStorage');
      console.log('[Login] Stored token:', localStorage.getItem('authToken')?.substring(0, 20) + '...');
      
      // Redirect to home
      navigate('/');
    } catch (error) {
      console.error('[Login] Login error:', error);
      const apiError = error.response?.data;
      const validationMessage = Array.isArray(apiError?.errors)
        ? apiError.errors[0]?.msg
        : null;
      setError(apiError?.error || validationMessage || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterClick = () => {
    navigate('/register');
  };

  const handleGuestClick = () => {
    navigate('/');
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>Login</h1>
        
        {error && <div className="error-message">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email:</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              placeholder="Enter your email address"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Phone Number (used as password):</label>
            <input
              type="tel"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              placeholder="Enter your phone number"
              autoComplete="tel"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="login-button"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="guest-divider">
          <span>or</span>
        </div>

        <button
          type="button"
          onClick={handleGuestClick}
          className="guest-button"
        >
          Continue as Guest
        </button>

        <div className="login-footer">
          <p>Don't have an account? 
            <button 
              onClick={handleRegisterClick}
              className="register-link"
            >
              Register here
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
